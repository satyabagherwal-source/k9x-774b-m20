# Forensic Learning Record (Deep Inspection): tokio-rs/console

> **Canonical Artifact**: `07_PROJECT_LEARNING/tokio-rs-console-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tokio-rs/console](https://github.com/tokio-rs/console))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:38:46.112Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tokio-rs/console`
- **Description**: a debugger for async rust!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4604 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tokio-console/src/state/async_ops.rs`
```
use crate::{
    intern::{self, InternedStr},
    state::{
        pb_duration,
        resources::Resource,
        store::{self, Id, Store},
        tasks::Task,
        Attribute, Field, Metadata, Visibility,
    },
    view,
};
use console_api as proto;
use ratatui::text::Span;
use std::{
    cell::RefCell,
    collections::HashMap,
    convert::{TryFrom, TryInto},
    rc::{Rc, Weak},
    time::{Duration, SystemTime},
};

#[derive(Default, Debug)]
pub(crate) struct AsyncOpsState {
    async_ops: Store<AsyncOp>,
    dropped_events: u64,
}

#[derive(Debug, Copy, Clone, Default)]
#[repr(usize)]
pub(crate) enum SortBy {
    #[default]
    Aid = 0,
    Task = 1,
    Source = 2,
    Total = 3,
    Busy = 4,
    Idle = 5,
    Polls = 6,
}

#[derive(Debug)]
pub(crate) struct AsyncOp {
    id: Id<AsyncOp>,
    parent_id: InternedStr,
    resource_id: Id<Resource>,
    meta_id: u64,
    source: InternedStr,
    stats: AsyncOpStats,
}

pub(crate) type AsyncOpRef = store::Ref<AsyncOp>;

#[derive(Debug)]
struct AsyncOpStats {
    created_at: SystemTime,
    dropped_at: Option<SystemTime>,

    polls: u64,
    busy: Duration,
    last_poll_started: Option<SystemTime>,
    last_poll_ended: Option<SystemTime>,
    idle: Option<Duration>,
    total: Option<Duration>,
    task_id: Option<Id<Task>>,
    task_id_str: InternedStr,
    formatted_attributes: Vec<Vec<Span<'static>>>,
}

impl SortBy {
    pub fn sort(&self, now: SystemTime, ops: &mut [Weak<RefCell<AsyncOp>>]) {
        match self {
            Self::Aid => ops.sort_unstable_by_key(|ao| ao.upgrade().map(|a| a.borrow().id)),
            Self::Task => ops.sort_unstable_by_key(|ao| ao.upgrade().map(|a| a.borrow().task_id())),
            Self::Source => {
                ops.sort_unstable_by_key(|ao| ao.upgrade().map(|a| a.borrow().source.clone()))
            }
            Self::Total => {
                ops.sort_unstable_by_key(|ao| ao.upgrade().map(|a| a.borrow().total(now)))
            }
            Self::Busy => ops.sort_unstable_by_key(|ao| ao.upgrade().map(|a| a.borrow().busy(now))),
            Self::Idle => ops.sort_unstable_by_key(|ao| ao.upgrade().map(|a| a.borrow().idle(now))),
            Self::Polls => {
                ops.sort_unstable_by_key(|ao| ao.upgrade().map(|a| a.borrow().stats.polls))
            }
        }
    }
}

impl TryFrom<usize> for SortBy {
    type Error = ();
    fn try_from(idx: usize) -> Result<Self, Self::Error> {
        match idx {
            idx if idx == Self::Aid as usize => Ok(Self::Aid),
            idx if idx == Self::Task as usize => Ok(Self::Task),
            idx if idx == Self::Source as usize => Ok(Self::Source),
            idx if idx == Self::Total as usize => Ok(Self::Total),
            idx if idx == Self::Busy as usize => Ok(Self::Busy),
            idx if idx == Self::Idle as usize => Ok(Self::Idle),
            idx if idx == Self::Polls as usize => Ok(Self::Polls),
            _ => Err(()),
        }
    }
}

impl view::SortBy for SortBy {
    fn as_column(&self) -> usize {
        *self as usize
    }
}

impl AsyncOpsState {
    /// Returns any new async ops for a resource that were added since the last async ops update.
    pub(crate) fn take_new_async_ops(&mut self) -> impl Iterator<Item = AsyncOpRef> + '_ {
        self.async_ops.take_new_items()
    }

    /// Returns all async ops.
    pub(crate) fn async_ops(&self) -> impl Iterator<Item = AsyncOpRef> + '_ {
        self.async_ops.values().map(Rc::downgrade)
    }

    // Clippy warns us that having too many arguments is bad style. In this case, however
    // it does not make much sense to group any of them.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn update_async_ops(
        &mut self,
        styles: &view::Styles,
        strings: &mut intern::Strings,
        metas: &HashMap<u64, Metadata>,
        update: proto::async_ops::AsyncOpUpdate,
        resource_ids: &mut store::Ids<Resource>,
        task_ids: &mut store::Ids<Task>,
        visibility: Visibility,
    ) {
        let mut stats_update = update.stats_update;

        self.async_ops
            .insert_with(visibility, update.new_async_ops, |ids, async_op| {
                let span_id = match async_op.id.as_ref() {
                    Some(id) => id.id,
                    None => {
                        tracing::warn!(?async_op, "skipping async op with no id");
                        return None;
                    }
                };
                let meta_id = match async_op.metadata.as_ref() {
                    Some(id) => id.id,
                    None => {
                        tracing::warn!(?async_op, "async op has no metadata id, skipping");
                        return None;
                    }
                };
                let meta = match metas.get(&meta_id) {
                    Some(meta) => meta,
                    None => {
                        tracing::warn!(?async_op, meta_id, "no metadata for async op, skipping");
                        return None;
                    }
                };

                let stats = AsyncOpStats::from_proto(
                    stats_update.remove(&span_id)?,
                    meta,
                    styles,
                    strings,
                    task_ids,
                );

                let id = ids.id_for(span_id);
                let resource_id = resource_ids.id_for(async_op.resource_id?.id);
                let parent_id = match async_op.parent_async_op_id {
                    Some(id) => strings.string(format!("{}", ids.id_for(id.id))),
                    None => strings.string("n/a".to_string()),
                };

                let source = strings.string(async_op.source);

                let async_op = AsyncOp {
                    id,
                    parent_id,
                    resource_id,
                    meta_id,
                    source,
                    stats,
                };
                Some((id, async_op))
            });

        for (stats, mut async_op) in self.async_ops.updated(stats_update) {
            if let Some(meta) = metas.get(&async_op.meta_id) {
                tracing::trace!(?async_op, ?stats, "processing stats update for");
                async_op.stats = AsyncOpStats::from_proto(stats, meta, styles, strings, task_ids);
            }
        }

        self.dropped_events += update.dropped_events;
    }

    pub(crate) fn retain_active(&mut self, now: SystemTime, retain_for: Duration) {
        self.async_ops.retain(|_, async_op| {
            let async_op = async_op.borrow();

            async_op
                .stats
                .dropped_at
                .map(|d| {
                    let dropped_for = now.duration_since(d).unwrap_or_default();
                    retain_for > dropped_for
                })
                .unwrap_or(true)
        })
    }

    pub(crate) fn dropped_events(&self) -> u64 {
        self.dropped_events
    }
}

impl AsyncOp {
    pub(crate) fn id(&self) -> Id<AsyncOp> {
        self.id
    }

    pub(crate) fn parent_id(&self) -> &str {
        &self.parent_id
    }

    pub(crate) fn resource_id(&self) -> Id<Resource> {
        self.resource_id
    }

    pub(crate) fn task_id(&self) -> Option<Id<Task>> {
        self.stats.task_id
    }

    pub(crate) fn task_id_str(&self) -> &str {
        &self.stats.task_id_str
    }

    pub(crate) fn source(&self) -> &str {
        &self.source
    }

    pub(crate) fn total(&self, since: SystemTime) -> Duration {
        self.stats
            .total
            .or_else(|| since.duration_since(self.stats.created_at).ok())
            .unwrap_or_default()
    }

    pub(crate) fn busy(&self, since: SystemTime) -> Duration {
        if let (Some(last_poll_started), None) =
            (self.stats.last_poll_started, self.stats.last_poll_ended)
        {
            let current_time_in_poll = since.duration_since(last_poll_started).unwrap_or_default();
            return self.stats.busy + current_time_in_poll;
        }
        self.stats.busy
    }

    pub(crate) fn idle(&self, since: SystemTime) -> Duration {
        self.stats
            .idle
            .or_else(|| self.total(since).checked_sub(self.busy(since)))
            .unwrap_or_default()
    }

    pub(crate) fn total_polls(&self) -> u64 {
        self.stats.polls
    }

    pub(crate) fn dropped(&self) -> bool {
        self.stats.total.is_some()
    }

    pub(crate) fn formatted_attributes(&self) -> &[Vec<Span<'static>>] {
        &self.stats.formatted_attributes
    }
}

impl AsyncOpStats {
    fn from_proto(
        pb: proto::async_ops::Stats,
        meta: &Metadata,
        styles: &view::Styles,
        strings: &mut intern::Strings,
        task_ids: &mut store::Ids<Task>,
    ) -> Self {
        let mut pb = pb;

        let mut attributes = pb
            .attributes
            .drain(..)
            .filter_map(|pb| {
                let field = pb.field?;
                let field = Field::from_proto(field, meta, strings)?;
                Some(Attribute {
                    field,
                    unit: pb.unit,
                })
            })
            .collect::<Vec<_>>();

        let created_at = pb
            .created_at
            .expect("async op span was never created")
            .try_into()
            .unwrap();

        let dropped_at: Option<SystemTime> = pb.dropped_at.map(|v| v.try_into().unwrap());
        let total = dropped_at.map(|d| d.duration_since(created_at).unwrap_or_default());

        let poll_stats = pb.poll_stats.expect("task should have poll stats");
        let busy = poll_stats.busy_time.map(pb_duration).unwrap_or_default();
        let idle = total.map(|total| total.checked_sub(busy).unwrap_or_default());
        let formatted_attributes = Attribute::make_formatted(styles, &mut attributes);
        let task_id = pb.task_id.map(|id| task_ids.id_for(id.id));
        let task_id_str = strings.string(
            
```

### Core Architecture Module: `tokio-console/src/state/histogram.rs`
```
use console_api::tasks as proto;
use hdrhistogram::Histogram;
use std::{io::Cursor, time::Duration};

#[derive(Debug)]
pub(crate) struct DurationHistogram {
    pub(crate) histogram: Histogram<u64>,
    pub(crate) high_outliers: u64,
    pub(crate) highest_outlier: Option<Duration>,
}

impl DurationHistogram {
    pub(crate) fn from_poll_durations(
        proto: &proto::task_details::PollTimesHistogram,
    ) -> Option<Self> {
        match proto {
            proto::task_details::PollTimesHistogram::Histogram(hist) => Self::from_proto(hist),
            proto::task_details::PollTimesHistogram::LegacyHistogram(bytes) => {
                Self::from_proto_legacy(&bytes[..])
            }
        }
    }

    fn from_proto_legacy(bytes: &[u8]) -> Option<Self> {
        let histogram = deserialize_histogram(bytes)?;
        Some(Self {
            histogram,
            high_outliers: 0,
            highest_outlier: None,
        })
    }

    pub(crate) fn from_proto(proto: &proto::DurationHistogram) -> Option<Self> {
        let histogram = deserialize_histogram(&proto.raw_histogram[..])?;
        Some(Self {
            histogram,
            high_outliers: proto.high_outliers,
            highest_outlier: proto.highest_outlier.map(Duration::from_nanos),
        })
    }
}

fn deserialize_histogram(bytes: &[u8]) -> Option<Histogram<u64>> {
    hdrhistogram::serialization::Deserializer::new()
        .deserialize(&mut Cursor::new(&bytes))
        .ok()
}

```

### Core Architecture Module: `tokio-console/src/state/mod.rs`
```
use self::{async_ops::AsyncOpsState, resources::ResourcesState};
use crate::{
    intern::{self, InternedStr},
    view,
    warnings::Linter,
};
use console_api as proto;
use ratatui::{
    style::{Color, Modifier},
    text::Span,
};
use std::{
    cell::RefCell,
    cmp::Ordering,
    collections::HashMap,
    convert::{TryFrom, TryInto},
    fmt,
    rc::Rc,
    time::{Duration, SystemTime},
};
use tasks::{Details, Task, TasksState};

pub mod async_ops;
pub mod histogram;
pub mod resources;
pub mod store;
pub mod tasks;

pub(crate) use self::store::Id;

pub(crate) type DetailsRef = Rc<RefCell<Option<Details>>>;

#[derive(Default, Debug)]
pub(crate) struct State {
    metas: HashMap<u64, Metadata>,
    last_updated_at: Option<SystemTime>,
    temporality: Temporality,
    tasks_state: TasksState,
    resources_state: ResourcesState,
    async_ops_state: AsyncOpsState,
    current_task_details: DetailsRef,
    retain_for: Option<Duration>,
    strings: intern::Strings,
}

pub(crate) enum Visibility {
    Show,
    Hide,
}

#[derive(Debug)]
pub(crate) struct Metadata {
    field_names: Vec<InternedStr>,
    target: InternedStr,
    id: u64,
    //TODO: add more metadata as needed
}

#[derive(Debug, Eq, PartialEq)]
pub(crate) struct Field {
    pub(crate) name: InternedStr,
    pub(crate) value: FieldValue,
}

#[derive(Debug, Eq, PartialEq, Ord, PartialOrd)]
pub(crate) enum FieldValue {
    Bool(bool),
    Str(String),
    U64(u64),
    I64(i64),
    Debug(String),
}

#[derive(Debug, Default)]
pub(crate) enum Temporality {
    Unpausing,
    #[default]
    Live,
    Pausing,
    Paused,
}

impl From<proto::instrument::Temporality> for Temporality {
    fn from(pb: proto::instrument::Temporality) -> Self {
        match pb {
            proto::instrument::Temporality::Live => Self::Live,
            proto::instrument::Temporality::Paused => Self::Paused,
        }
    }
}

#[derive(Debug, Eq, PartialEq)]
pub(crate) struct Attribute {
    field: Field,
    unit: Option<String>,
}

impl State {
    pub(crate) fn with_retain_for(mut self, retain_for: Option<Duration>) -> Self {
        self.retain_for = retain_for;
        self
    }

    pub(crate) fn with_task_linters(
        mut self,
        linters: impl IntoIterator<Item = Linter<Task>>,
    ) -> Self {
        self.tasks_state.linters.extend(linters);
        self
    }

    pub(crate) fn last_updated_at(&self) -> Option<SystemTime> {
        self.last_updated_at
    }

    pub(crate) fn update(
        &mut self,
        styles: &view::Styles,
        current_view: &view::ViewState,
        update: proto::instrument::Update,
    ) {
        if let Some(now) = update.now.map(|v| v.try_into().unwrap()) {
            self.last_updated_at = Some(now);
        }

        let strings = &mut self.strings;
        if let Some(new_metadata) = update.new_metadata {
            let metas = new_metadata.metadata.into_iter().filter_map(|meta| {
                let id = meta.id?.id;
                let metadata = meta.metadata?;
                Some((id, Metadata::from_proto(metadata, id, strings)))
            });
            self.metas.extend(metas);
        }

        if let Some(tasks_update) = update.task_update {
            let visibility = if matches!(current_view, view::ViewState::TasksList) {
                Visibility::Show
            } else {
                Visibility::Hide
            };
            self.tasks_state.update_tasks(
                styles,
                &mut self.strings,
                &self.metas,
                tasks_update,
                visibility,
            )
        }

        if let Some(resources_update) = update.resource_update {
            let visibility = if matches!(current_view, view::ViewState::ResourcesList) {
                Visibility::Show
            } else {
                Visibility::Hide
            };
            self.resources_state.update_resources(
                styles,
                &mut self.strings,
                &self.metas,
                resources_update,
                visibility,
            )
        }

        if let Some(async_ops_update) = update.async_op_update {
            let visibility = if matches!(current_view, view::ViewState::ResourceInstance(_)) {
                Visibility::Show
            } else {
                Visibility::Hide
            };
            self.async_ops_state.update_async_ops(
                styles,
                &mut self.strings,
                &self.metas,
                async_ops_update,
                self.resources_state.ids_mut(),
                self.tasks_state.ids_mut(),
                visibility,
            )
        }
    }

    pub(crate) fn retain_active(&mut self) {
        if self.is_paused() {
            return;
        }

        if let (Some(now), Some(retain_for)) = (self.last_updated_at(), self.retain_for) {
            self.tasks_state.retain_active(now, retain_for);
            self.resources_state.retain_active(now, retain_for);
            self.async_ops_state.retain_active(now, retain_for);
        }

        // After dropping idle tasks & resources, prune any interned strings
        // that are no longer referenced.
        self.strings.retain_referenced();
    }

    pub(crate) fn task_details_ref(&self) -> DetailsRef {
        self.current_task_details.clone()
    }

    pub(crate) fn tasks_state(&mut self) -> &TasksState {
        &self.tasks_state
    }

    pub(crate) fn tasks_state_mut(&mut self) -> &mut TasksState {
        &mut self.tasks_state
    }

    pub(crate) fn resources_state(&mut self) -> &ResourcesState {
        &self.resources_state
    }

    pub(crate) fn resources_state_mut(&mut self) -> &mut ResourcesState {
        &mut self.resources_state
    }

    pub(crate) fn async_ops_state(&self) -> &AsyncOpsState {
        &self.async_ops_state
    }

    pub(crate) fn async_ops_state_mut(&mut self) -> &mut AsyncOpsState {
        &mut self.async_ops_state
    }

    pub(crate) fn update_task_details(&mut self, update: proto::tasks::TaskDetails) {
        if let Some(id) = update.task_id {
            let details = Details {
                span_id: id.id,
                poll_times_histogram: update
                    .poll_times_histogram
                    .as_ref()
                    .and_then(histogram::DurationHistogram::from_poll_durations),
                scheduled_times_histogram: update
                    .scheduled_times_histogram
                    .as_ref()
                    .and_then(histogram::DurationHistogram::from_proto),
            };

            *self.current_task_details.borrow_mut() = Some(details);
        }
    }

    pub(crate) fn unset_task_details(&mut self) {
        *self.current_task_details.borrow_mut() = None;
    }

    // temporality methods
    pub(crate) fn temporality(&self) -> &Temporality {
        &self.temporality
    }

    pub(crate) fn start_unpausing(&mut self) {
        self.temporality = Temporality::Unpausing;
    }

    pub(crate) fn start_pausing(&mut self) {
        self.temporality = Temporality::Pausing;
    }

    pub(crate) fn update_state(&mut self, state: proto::instrument::State) {
        self.temporality = proto::instrument::Temporality::try_from(state.temporality)
            .expect("invalid temporality")
            .into();
    }

    pub(crate) fn is_paused(&self) -> bool {
        matches!(self.temporality, Temporality::Paused | Temporality::Pausing)
    }
}

impl Metadata {
    fn from_proto(pb: proto::Metadata, id: u64, strings: &mut intern::Strings) -> Self {
        Self {
            field_names: pb
                .field_names
                .into_iter()
                .map(|n| strings.string(n))
                .collect(),
            target: strings.string(pb.target),
            id,
        }
    }
}

// === impl Field ===

impl Field {
    const SPAWN_LOCATION: &'static str = "spawn.location";
    const KIND: &'static str = "kind";
    const NAME: &'static str = "task.name";
    const TASK_ID: &'static str = "task.id";
    const SIZE_BYTES: &'static str = "size.bytes";
    const ORIGINAL_SIZE_BYTES: &'static str = "original_size.bytes";

    /// Creates a new Field with a pre-interned `name` and a `FieldValue`.
    fn new(name: InternedStr, value: FieldValue) -> Self {
        Field { name, value }
    }

    /// Converts a wire-format `Field` into an internal `Field` representation,
    /// using the provided `Metadata` for the task span that the field came
    /// from.
    ///
    /// If the field is invalid or it has a string value which is empty, this
    /// returns `None`.
    fn from_proto(
        proto::Field {
            name,
            metadata_id,
            value,
        }: proto::Field,
        meta: &Metadata,
        strings: &mut intern::Strings,
    ) -> Option<Self> {
        use proto::field::Name;
        let name = match name? {
            Name::StrName(n) => strings.string(n),
            Name::NameIdx(idx) => {
                let meta_id = metadata_id.map(|m| m.id);
                if meta_id != Some(meta.id) {
                    tracing::warn!(
                        task.meta_id = meta.id,
                        field.meta.id = ?meta_id,
                        field.name_index = idx,
                        ?meta,
                        "skipping malformed field name (metadata id mismatch)"
                    );
                    debug_assert_eq!(
                        meta_id,
                        Some(meta.id),
                        "malformed field name: metadata ID mismatch! (name idx={}; metadata={:#?})",
                        idx,
                        meta,
                    );
                    return None;
                }
                match meta.field_names.get(idx as usize).cloned() {
                    Some(name) => name,
                    None => {
                        tracing::warn!(
                            task.meta_id = meta.id
```

### Core Architecture Module: `tokio-console/src/state/resources.rs`
```
use crate::intern::{self, InternedStr};
use crate::state::{
    format_location,
    store::{self, Id, SpanId, Store},
    Attribute, Field, Metadata, Visibility,
};
use crate::view;
use console_api as proto;
use ratatui::{style::Color, text::Span};
use std::{
    collections::HashMap,
    convert::{TryFrom, TryInto},
    rc::Rc,
    time::{Duration, SystemTime},
};

#[derive(Default, Debug)]
pub(crate) struct ResourcesState {
    resources: Store<Resource>,
    dropped_events: u64,
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub(crate) enum TypeVisibility {
    Public,
    Internal,
}

#[derive(Debug, Copy, Clone, Default)]
#[repr(usize)]
pub(crate) enum SortBy {
    #[default]
    Id = 0,
    ParentId = 1,
    Kind = 2,
    Total = 3,
    Target = 4,
    ConcreteType = 5,
    Visibility = 6,
    Location = 7,
    Attributes = 8,
}

#[derive(Debug)]
pub(crate) struct Resource {
    /// The resource's pretty (console-generated, sequential) ID.
    ///
    /// This is NOT the `tracing::span::Id` for the resource's `tracing` span on the
    /// remote.
    id: Id<Resource>,
    /// The `tracing::span::Id` on the remote process for this resource's span.
    ///
    /// This is used when requesting a resource details stream.
    span_id: SpanId,
    id_str: InternedStr,
    parent: InternedStr,
    parent_id: InternedStr,
    meta_id: u64,
    kind: InternedStr,
    stats: ResourceStats,
    target: InternedStr,
    concrete_type: InternedStr,
    location: String,
    visibility: TypeVisibility,
}

pub(crate) type ResourceRef = store::Ref<Resource>;

#[derive(Debug)]
struct ResourceStats {
    created_at: SystemTime,
    dropped_at: Option<SystemTime>,
    total: Option<Duration>,
    formatted_attributes: Vec<Vec<Span<'static>>>,
}

impl SortBy {
    pub fn sort(&self, now: SystemTime, resources: &mut [ResourceRef]) {
        match self {
            Self::Id => {
                resources.sort_unstable_by_key(|resource| resource.upgrade().map(|r| r.borrow().id))
            }
            Self::ParentId => resources.sort_unstable_by_key(|resource| {
                resource.upgrade().map(|r| r.borrow().parent_id.clone())
            }),
            Self::Kind => resources.sort_unstable_by_key(|resource| {
                resource.upgrade().map(|r| r.borrow().kind.clone())
            }),
            Self::Total => resources
                .sort_unstable_by_key(|resource| resource.upgrade().map(|r| r.borrow().total(now))),
            Self::Target => resources.sort_unstable_by_key(|resource| {
                resource.upgrade().map(|r| r.borrow().target.clone())
            }),
            Self::ConcreteType => resources.sort_unstable_by_key(|resource| {
                resource.upgrade().map(|r| r.borrow().concrete_type.clone())
            }),
            Self::Visibility => resources
                .sort_unstable_by_key(|resource| resource.upgrade().map(|r| r.borrow().visibility)),
            Self::Location => resources.sort_unstable_by_key(|resource| {
                resource.upgrade().map(|r| r.borrow().location.clone())
            }),
            Self::Attributes => resources.sort_unstable_by_key(|resource| {
                resource.upgrade().and_then(|r| {
                    // FIXME - we are taking only the key of the first attribute as sorting key here.
                    // Instead, attributes should probably be parsed and sorted according to their actual values.
                    //
                    // See https://github.com/tokio-rs/console/issues/496
                    r.borrow()
                        .formatted_attributes()
                        .first()
                        .and_then(|a| a.first())
                        .map(|key| key.content.clone())
                })
            }),
        }
    }
}

impl TryFrom<usize> for SortBy {
    type Error = ();
    fn try_from(idx: usize) -> Result<Self, Self::Error> {
        match idx {
            idx if idx == Self::Id as usize => Ok(Self::Id),
            idx if idx == Self::ParentId as usize => Ok(Self::ParentId),
            idx if idx == Self::Kind as usize => Ok(Self::Kind),
            idx if idx == Self::Total as usize => Ok(Self::Total),
            idx if idx == Self::Target as usize => Ok(Self::Target),
            idx if idx == Self::ConcreteType as usize => Ok(Self::ConcreteType),
            idx if idx == Self::Visibility as usize => Ok(Self::Visibility),
            idx if idx == Self::Location as usize => Ok(Self::Location),
            idx if idx == Self::Attributes as usize => Ok(Self::Attributes),
            _ => Err(()),
        }
    }
}

impl view::SortBy for SortBy {
    fn as_column(&self) -> usize {
        *self as usize
    }
}

impl ResourcesState {
    pub(crate) fn take_new_resources(&mut self) -> impl Iterator<Item = ResourceRef> + '_ {
        self.resources.take_new_items()
    }

    pub(crate) fn ids_mut(&mut self) -> &mut store::Ids<Resource> {
        self.resources.ids_mut()
    }

    pub(crate) fn update_resources(
        &mut self,
        styles: &view::Styles,
        strings: &mut intern::Strings,
        metas: &HashMap<u64, Metadata>,
        update: proto::resources::ResourceUpdate,
        visibility: Visibility,
    ) {
        let parents: HashMap<Id<Resource>, ResourceRef> = update
            .new_resources
            .iter()
            .filter_map(|resource| {
                let parent_id = resource.parent_resource_id?.id;
                let parent = self.resources.get_by_span(parent_id)?;
                Some((parent.borrow().id, Rc::downgrade(parent)))
            })
            .collect();

        let mut stats_update = update.stats_update;
        self.resources
            .insert_with(visibility, update.new_resources, |ids, resource| {
                let span_id = match resource.id.as_ref() {
                    Some(id) => id.id,
                    None => {
                        tracing::warn!(?resource, "skipping resource with no id");
                        return None;
                    }
                };

                let meta_id = match resource.metadata.as_ref() {
                    Some(id) => id.id,
                    None => {
                        tracing::warn!(?resource, "resource has no metadata id skipping");
                        return None;
                    }
                };
                let meta = match metas.get(&meta_id) {
                    Some(meta) => meta,
                    None => {
                        tracing::warn!(?resource, meta_id, "no metadata for resource, skipping");
                        return None;
                    }
                };
                let kind = match kind_from_proto(resource.kind?, strings) {
                    Ok(kind) => kind,
                    Err(err) => {
                        tracing::warn!(%err, "resource kind cannot be parsed");
                        return None;
                    }
                };

                let stats = ResourceStats::from_proto(
                    stats_update.remove(&span_id)?,
                    meta,
                    styles,
                    strings,
                );

                let id = ids.id_for(span_id);
                let parent_id = resource.parent_resource_id.map(|id| ids.id_for(id.id));

                let parent = strings.string(match parent_id {
                    Some(id) => parents
                        .get(&id)
                        .and_then(|r| r.upgrade())
                        .map(|r| {
                            let r = r.borrow();
                            format!("{} ({}::{})", r.id(), r.target(), r.concrete_type())
                        })
                        .unwrap_or_else(|| id.to_string()),
                    None => "n/a".to_string(),
                });

                let parent_id = strings.string(
                    parent_id
                        .as_ref()
                        .map(Id::<Resource>::to_string)
                        .unwrap_or_else(|| "n/a".to_string()),
                );

                let location = format_location(resource.location);
                let visibility = if resource.is_internal {
                    TypeVisibility::Internal
                } else {
                    TypeVisibility::Public
                };

                let resource = Resource {
                    id,
                    span_id,
                    id_str: strings.string(id.to_string()),
                    parent,
                    parent_id,
                    kind,
                    stats,
                    target: meta.target.clone(),
                    concrete_type: strings.string(resource.concrete_type),
                    meta_id,
                    location,
                    visibility,
                };
                Some((id, resource))
            });

        self.dropped_events += update.dropped_events;

        for (stats, mut resource) in self.resources.updated(stats_update) {
            if let Some(meta) = metas.get(&resource.meta_id) {
                tracing::trace!(?resource, ?stats, "processing stats update for");
                resource.stats = ResourceStats::from_proto(stats, meta, styles, strings);
            }
        }
    }

    pub(crate) fn retain_active(&mut self, now: SystemTime, retain_for: Duration) {
        self.resources.retain(|_, resource| {
            let resource = resource.borrow();

            resource
                .stats
                .dropped_at
                .map(|d| {
                    let dropped_for = now.duration_since(d).unwrap_or_default();
                    retain_for > dropped_for
                })
                .unwrap_or(true)
        })
    }

    pub(crate) fn dropped_events(&self) -> u64 {
        self.dropped_events
    }
}

impl Resource {
    pub(crate) fn id(&self) -> Id<Resource> {
        self.id
    }

    pub(crate) fn 
```

### Core Architecture Module: `tokio-console/src/state/store.rs`
```
use std::{
    any,
    cell::{self, RefCell},
    cmp,
    collections::hash_map::{self, Entry, HashMap},
    fmt,
    hash::{Hash, Hasher},
    marker::PhantomData,
    rc::{Rc, Weak},
    vec,
};

use super::Visibility;

/// Stores a set of items which are associated with a [`SpanId`] and a rewritten
/// sequential [`Id`].
#[derive(Debug)]
pub(crate) struct Store<T> {
    ids: Ids<T>,
    store: HashMap<Id<T>, Stored<T>>,
    new_items: Vec<Ref<T>>,
}

pub(crate) type Ref<T> = Weak<RefCell<T>>;
pub(crate) type Stored<T> = Rc<RefCell<T>>;
pub(crate) type SpanId = u64;

/// A rewritten sequential ID.
///
/// This is distinct from the remote server's span ID, which may be reused and
/// is not sequential.
pub(crate) struct Id<T> {
    id: u64,
    _ty: PhantomData<fn(T)>,
}

/// Stores the rewritten sequential IDs of items in a [`Store`].
pub(crate) struct Ids<T> {
    next: u64,
    map: HashMap<u64, Id<T>>,
}

// === impl Store ===

impl<T> Store<T> {
    pub fn get(&self, id: Id<T>) -> Option<&Stored<T>> {
        self.store.get(&id)
    }

    pub fn get_by_span(&self, span_id: SpanId) -> Option<&Stored<T>> {
        let id = self.ids.map.get(&span_id)?;
        self.get(*id)
    }

    pub fn ids_mut(&mut self) -> &mut Ids<T> {
        &mut self.ids
    }

    /// Given an iterator of `U`-typed items and a function `f` mapping a
    /// `U`-typed item to a `T`-typed item and an [`Id`] for that item, inserts
    /// the `T`-typed items into the store along with their IDs.
    ///
    /// This function has an admittedly somewhat complex signature. It would be
    /// nicer if this could just be an `iter::Extend` implementation, but that
    /// makes borrowing the set of [`Ids`] in the closure that's mapped over the
    /// iterator challenging, because the `extend` method mutably borrows the
    /// whole `Store`.
    pub fn insert_with<U>(
        &mut self,
        visibility: Visibility,
        items: impl IntoIterator<Item = U>,
        mut f: impl FnMut(&mut Ids<T>, U) -> Option<(Id<T>, T)>,
    ) {
        self.set_visibility(visibility);
        let items = items
            .into_iter()
            .filter_map(|item| f(&mut self.ids, item))
            .map(|(id, item)| {
                let item = Rc::new(RefCell::new(item));
                self.new_items.push(Rc::downgrade(&item));
                (id, item)
            });
        self.store.extend(items);
    }

    pub fn updated<'store, U, I>(
        &'store mut self,
        update: I,
    ) -> impl Iterator<Item = (U, cell::RefMut<'store, T>)> + 'store
    where
        I: IntoIterator<Item = (SpanId, U)>,
        I::IntoIter: 'store,
    {
        update.into_iter().filter_map(|(span_id, update)| {
            let id = self.ids.map.get(&span_id)?;
            let item = self.store.get(id)?;
            Some((update, item.borrow_mut()))
        })
    }

    /// Applies a predicate to each element in the [`Store`], removing the item
    /// if the predicate returns `false`.
    pub fn retain(&mut self, f: impl FnMut(&Id<T>, &mut Stored<T>) -> bool) {
        self.store.retain(f);
        // If a removed element was in `new_items`, remove it.
        self.new_items.retain(|item| item.upgrade().is_some());
        // TODO(eliza): remove from `ids` if it's no longer in `store`?
    }

    /// Returns an iterator over all of the items which have been added to this
    /// `Store` since the last time `take_new_items` was called.
    pub fn take_new_items(&mut self) -> vec::Drain<'_, Ref<T>> {
        self.new_items.drain(..)
    }

    pub fn values(&self) -> hash_map::Values<'_, Id<T>, Stored<T>> {
        self.store.values()
    }

    pub fn iter(&self) -> hash_map::Iter<'_, Id<T>, Stored<T>> {
        self.store.iter()
    }

    fn set_visibility(&mut self, visibility: Visibility) {
        if matches!(visibility, Visibility::Show) {
            self.new_items.clear();
        }
    }
}

impl<T> Default for Store<T> {
    fn default() -> Self {
        Self {
            ids: Ids::default(),
            store: HashMap::default(),
            new_items: Vec::default(),
        }
    }
}

impl<'store, T> IntoIterator for &'store Store<T> {
    type Item = (&'store Id<T>, &'store Stored<T>);
    type IntoIter = hash_map::Iter<'store, Id<T>, Stored<T>>;

    #[inline]
    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

// === impl Ids ===

impl<T> Ids<T> {
    pub(crate) fn id_for(&mut self, span_id: SpanId) -> Id<T> {
        match self.map.entry(span_id) {
            Entry::Occupied(entry) => *entry.get(),
            Entry::Vacant(entry) => {
                let id = Id {
                    id: self.next,
                    _ty: PhantomData,
                };
                entry.insert(id);
                self.next = self.next.wrapping_add(1);
                id
            }
        }
    }
}

impl<T> Default for Ids<T> {
    fn default() -> Self {
        Self {
            next: 1,
            map: Default::default(),
        }
    }
}

impl<T> fmt::Debug for Ids<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Ids")
            .field("next", &self.next)
            .field("map", &self.map)
            .field("type", &format_args!("{}", any::type_name::<T>()))
            .finish()
    }
}

// === impl Id ===

impl<T> Clone for Id<T> {
    #[inline]
    fn clone(&self) -> Self {
        *self
    }
}

impl<T> Copy for Id<T> {}

impl<T> fmt::Debug for Id<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let path = any::type_name::<T>();
        let type_name = path.split("::").last().unwrap_or(path);
        write!(f, "Id<{}>({})", type_name, self.id)
    }
}

impl<T> fmt::Display for Id<T> {
    #[inline]
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.id, f)
    }
}

impl<T> Hash for Id<T> {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        state.write_u64(self.id);
    }
}

impl<T> PartialEq for Id<T> {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl<T> Eq for Id<T> {}

impl<T> cmp::Ord for Id<T> {
    #[inline]
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        self.id.cmp(&other.id)
    }
}

impl<T> cmp::PartialOrd for Id<T> {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<cmp::Ordering> {
        Some(self.cmp(other))
    }
}

```

### Core Architecture Module: `tokio-console/src/state/tasks.rs`
```
use crate::{
    intern::{self, InternedStr},
    state::{
        format_location,
        histogram::DurationHistogram,
        pb_duration,
        store::{self, Id, SpanId, Store},
        Field, FieldValue, Metadata, Visibility,
    },
    util::Percentage,
    view,
    warnings::{Lint, Linter},
};
use console_api as proto;
use ratatui::{style::Color, text::Span};
use std::{
    cell::RefCell,
    collections::{HashMap, HashSet},
    convert::{TryFrom, TryInto},
    rc::{Rc, Weak},
    time::{Duration, SystemTime},
};

#[derive(Default, Debug)]
pub(crate) struct TasksState {
    tasks: Store<Task>,
    pending_lint: HashSet<Id<Task>>,
    pub(crate) linters: Vec<Linter<Task>>,
    dropped_events: u64,
}

#[derive(Debug, Default)]
pub(crate) struct Details {
    pub(crate) span_id: SpanId,
    pub(crate) poll_times_histogram: Option<DurationHistogram>,
    pub(crate) scheduled_times_histogram: Option<DurationHistogram>,
}

#[derive(Debug, Copy, Clone, Default)]
#[repr(usize)]
pub(crate) enum SortBy {
    Warns = 0,
    Tid = 1,
    State = 2,
    Name = 3,
    #[default]
    Total = 4,
    Busy = 5,
    Scheduled = 6,
    Idle = 7,
    Polls = 8,
    Target = 9,
    Location = 10,
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub(crate) enum TaskState {
    Completed,
    Idle,
    Running,
    Scheduled,
}

pub(crate) type TaskRef = store::Ref<Task>;

/// The Id for a Tokio task.
///
/// This should be equivalent to [`tokio::task::Id`], which can't be
/// used because it's not possible to construct outside the `tokio`
/// crate.
///
/// Within the context of `tokio-console`, we don't depend on it
/// being the same as Tokio's own type, as the task id is recorded
/// as a `u64` in tracing and then sent via the wire protocol as such.
pub(crate) type TaskId = u64;

#[derive(Debug)]
pub(crate) struct Task {
    /// The task's pretty (console-generated, sequential) task ID.
    ///
    /// This is NOT the `tracing::span::Id` for the task's tracing span on the
    /// remote.
    id: Id<Task>,
    /// The `tokio::task::Id` in the remote tokio runtime.
    task_id: Option<TaskId>,
    /// The `tracing::span::Id` on the remote process for this task's span.
    ///
    /// This is used when requesting a task details stream.
    span_id: SpanId,
    /// A cached string representation of the Id for display purposes.
    id_str: String,
    /// A precomputed short description string used in the async ops table
    short_desc: InternedStr,
    /// Fields that don't have their own column, pre-formatted
    formatted_fields: Vec<Vec<Span<'static>>>,
    /// The task statistics that are updated over the lifetime of the task
    stats: TaskStats,
    /// The target of the span representing the task
    target: InternedStr,
    /// The name of the task (when `tokio::task::Builder` is used)
    name: Option<InternedStr>,
    /// Currently active warnings for this task.
    warnings: Vec<Linter<Task>>,
    /// The source file and line number the task was spawned from
    location: String,
    /// The kind of task, currently one of task, blocking, block_on, local
    kind: InternedStr,
    /// The size of the future driving the task
    size_bytes: Option<usize>,
    /// The original size of the future (before runtime auto-boxing)
    original_size_bytes: Option<usize>,
}

#[derive(Debug)]
struct TaskStats {
    polls: u64,
    created_at: SystemTime,
    dropped_at: Option<SystemTime>,
    busy: Duration,
    scheduled: Duration,
    last_poll_started: Option<SystemTime>,
    last_poll_ended: Option<SystemTime>,
    idle: Option<Duration>,
    total: Option<Duration>,

    // === waker stats ===
    /// Total number of times the task has been woken over its lifetime.
    wakes: u64,
    /// Total number of times the task's waker has been cloned
    waker_clones: u64,

    /// Total number of times the task's waker has been dropped.
    waker_drops: u64,

    /// The timestamp of when the task was last woken.
    last_wake: Option<SystemTime>,
    /// Total number of times the task has woken itself.
    self_wakes: u64,
}

impl TasksState {
    /// Returns any new tasks that were added since the last task update.
    pub(crate) fn take_new_tasks(&mut self) -> impl Iterator<Item = TaskRef> + '_ {
        self.tasks.take_new_items()
    }

    pub(crate) fn ids_mut(&mut self) -> &mut store::Ids<Task> {
        self.tasks.ids_mut()
    }

    pub(crate) fn update_tasks(
        &mut self,
        styles: &view::Styles,
        strings: &mut intern::Strings,
        metas: &HashMap<u64, Metadata>,
        update: proto::tasks::TaskUpdate,
        visibility: Visibility,
    ) {
        let mut stats_update = update.stats_update;
        let linters = &self.linters;

        // Gathers the tasks that need to be linted again on the next update cycle
        let mut next_pending_lint = HashSet::new();

        self.tasks
            .insert_with(visibility, update.new_tasks, |ids, mut task| {
                let span_id = match task.id.as_ref() {
                    Some(id) => id.id,
                    None => {
                        tracing::warn!(?task, "task has no id, skipping");
                        return None;
                    }
                };

                let meta_id = match task.metadata.as_ref() {
                    Some(id) => id.id,
                    None => {
                        tracing::warn!(?task, "task has no metadata id, skipping");
                        return None;
                    }
                };
                let meta = match metas.get(&meta_id) {
                    Some(meta) => meta,
                    None => {
                        tracing::warn!(?task, meta_id, "no metadata for task, skipping");
                        return None;
                    }
                };
                let mut name = None;
                let mut task_id = None;
                let mut kind = strings.string(String::new());
                let mut size_bytes = None;
                let mut original_size_bytes = None;
                let target_field = Field::new(
                    strings.string_ref("target"),
                    FieldValue::Str(meta.target.to_string()),
                );
                let mut fields = task
                    .fields
                    .drain(..)
                    .filter_map(|pb| {
                        let field = Field::from_proto(pb, meta, strings)?;
                        // the `task.name` field gets its own column, if it's present.
                        match &*field.name {
                            Field::NAME => {
                                name = Some(strings.string(field.value.to_string()));
                                None
                            }
                            Field::TASK_ID => {
                                task_id = match field.value {
                                    FieldValue::U64(id) => Some(id as TaskId),
                                    _ => None,
                                };
                                None
                            }
                            Field::KIND => {
                                kind = strings.string(field.value.to_string());
                                None
                            }
                            Field::SIZE_BYTES => {
                                size_bytes = match field.value {
                                    FieldValue::U64(size_bytes) => Some(size_bytes as usize),
                                    _ => None,
                                };
                                // Include size in pre-formatted fields
                                Some(field)
                            }
                            Field::ORIGINAL_SIZE_BYTES => {
                                original_size_bytes = match field.value {
                                    FieldValue::U64(original_size_bytes) => {
                                        Some(original_size_bytes as usize)
                                    }
                                    _ => None,
                                };
                                // Include size in pre-formatted fields
                                Some(field)
                            }
                            _ => Some(field),
                        }
                    })
                    // We wish to include the target in the fields as we won't give it a dedicated column.
                    .chain([target_field])
                    .collect::<Vec<_>>();

                let formatted_fields = Field::make_formatted(styles, &mut fields);

                let stats = stats_update.remove(&span_id)?.into();
                let location = format_location(task.location);

                // remap the server's ID to a pretty, sequential task ID
                let id = ids.id_for(span_id);

                let short_desc = strings.string(match (task_id, name.as_ref()) {
                    (Some(task_id), Some(name)) => format!("{task_id} ({name})"),
                    (Some(task_id), None) => task_id.to_string(),
                    (None, Some(name)) => name.as_ref().to_owned(),
                    (None, None) => "".to_owned(),
                });

                let mut task = Task {
                    name,
                    id,
                    task_id,
                    span_id,
                    id_str: task_id.map(|id| id.to_string()).unwrap_or_default(),
                    short_desc,
                    formatted_fields,
                    stats,
                    target: meta.target.clone(),
                    warnings: Vec::new(),
                    location,
                    kind,
                    size_bytes,
                    original_size_bytes,
                };
                if let TaskLintResult::RequiresRecheck = task.lint(linters) {
                    next_pending_lint.insert(t
```

### Core Architecture Module: `tokio-console/src/util.rs`
```
pub(crate) trait Percentage {
    // Using an extension trait for this is maybe a bit excessive, but making it
    // a method has the nice advantage of making it *really* obvious which is
    // the total and which is the amount.
    fn percent_of(self, total: Self) -> Self;
}

impl Percentage for usize {
    fn percent_of(self, total: Self) -> Self {
        percentage(total as f64, self as f64) as Self
    }
}

impl Percentage for u64 {
    fn percent_of(self, total: Self) -> Self {
        percentage(total as f64, self as f64) as Self
    }
}

impl Percentage for f64 {
    fn percent_of(self, total: Self) -> Self {
        percentage(total, self)
    }
}

pub(crate) fn percentage(total: f64, amount: f64) -> f64 {
    debug_assert!(
        total >= amount,
        "assertion failed: total >= amount; total={}, amount={}",
        total,
        amount
    );
    (amount / total) * 100.0
}

```

### Core Architecture Module: `console-api/src/async_ops.rs`
```
#![allow(warnings)]

include!("generated/rs.tokio.console.async_ops.rs");

```

### Core Architecture Module: `console-api/src/common.rs`
```
use std::fmt;

pub use generated::*;

mod generated {
    #![allow(warnings)]
    include!("generated/rs.tokio.console.common.rs");
}

impl From<tracing_core::Level> for metadata::Level {
    fn from(level: tracing_core::Level) -> Self {
        match level {
            tracing_core::Level::ERROR => metadata::Level::Error,
            tracing_core::Level::WARN => metadata::Level::Warn,
            tracing_core::Level::INFO => metadata::Level::Info,
            tracing_core::Level::DEBUG => metadata::Level::Debug,
            tracing_core::Level::TRACE => metadata::Level::Trace,
        }
    }
}

impl From<tracing_core::metadata::Kind> for metadata::Kind {
    fn from(kind: tracing_core::metadata::Kind) -> Self {
        // /!\ Note that this is intentionally *not* implemented using match.
        // The `metadata::Kind` struct in `tracing_core` was written not
        // intending to allow exhaustive matches, but accidentally did.
        //
        // Therefore, we shouldn't be able to write a match against both
        // variants without a wildcard arm. However, on versions of
        // `tracing_core` where the type was exhaustively matchable, a wildcard
        // arm will result in a warning. Thus we must write this rather
        // tortured-looking `if` statement to get non-exhaustive matching
        // behavior.
        if kind == tracing_core::metadata::Kind::SPAN {
            metadata::Kind::Span
        } else {
            metadata::Kind::Event
        }
    }
}

impl<'a> From<&'a tracing_core::Metadata<'a>> for Metadata {
    fn from(meta: &'a tracing_core::Metadata<'a>) -> Self {
        let kind = if meta.is_span() {
            metadata::Kind::Span
        } else {
            debug_assert!(meta.is_event());
            metadata::Kind::Event
        };

        let field_names = meta.fields().iter().map(|f| f.name().to_string()).collect();
        Metadata {
            name: meta.name().to_string(),
            target: meta.target().to_string(),
            location: Some(meta.into()),
            kind: kind as i32,
            level: metadata::Level::from(*meta.level()) as i32,
            field_names,
            ..Default::default()
        }
    }
}

impl<'a> From<&'a tracing_core::Metadata<'a>> for Location {
    fn from(meta: &'a tracing_core::Metadata<'a>) -> Self {
        Location {
            file: meta.file().map(String::from),
            module_path: meta.module_path().map(String::from),
            line: meta.line(),
            column: None, // tracing doesn't support columns yet
        }
    }
}

impl<'a> From<&'a std::panic::Location<'a>> for Location {
    fn from(loc: &'a std::panic::Location<'a>) -> Self {
        Location {
            file: Some(loc.file().to_string()),
            line: Some(loc.line()),
            column: Some(loc.column()),
            ..Default::default()
        }
    }
}

impl fmt::Display for field::Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            field::Value::BoolVal(v) => fmt::Display::fmt(v, f)?,
            field::Value::StrVal(v) => fmt::Display::fmt(v, f)?,
            field::Value::U64Val(v) => fmt::Display::fmt(v, f)?,
            field::Value::DebugVal(v) => fmt::Display::fmt(v, f)?,
            field::Value::I64Val(v) => fmt::Display::fmt(v, f)?,
        }

        Ok(())
    }
}

impl fmt::Display for Field {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name_val = (self.name.as_ref(), self.value.as_ref());
        if let (Some(field::Name::StrName(name)), Some(val)) = name_val {
            write!(f, "{}={}", name, val)?;
        }

        Ok(())
    }
}

impl fmt::Display for Location {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match (self.module_path.as_ref(), self.file.as_ref()) {
            // Module paths take precedence because they're shorter...
            (Some(module), _) => f.write_str(module.as_ref())?,
            (None, Some(file)) => f.write_str(file.as_ref())?,
            // If there's no file or module path, then printing the line and
            // column makes no sense...
            (None, None) => return f.write_str("<unknown location>"),
        };

        if let Some(line) = self.line {
            write!(f, ":{}", line)?;

            // Printing the column only makes sense if there's a line...
            if let Some(column) = self.column {
                write!(f, ":{}", column)?;
            }
        }

        Ok(())
    }
}

// === IDs ===

impl From<&'static tracing_core::Metadata<'static>> for MetaId {
    fn from(meta: &'static tracing_core::Metadata) -> Self {
        MetaId {
            id: meta as *const _ as u64,
        }
    }
}

impl From<tracing_core::span::Id> for SpanId {
    fn from(id: tracing_core::span::Id) -> Self {
        SpanId { id: id.into_u64() }
    }
}

impl From<SpanId> for tracing_core::span::Id {
    fn from(span_id: SpanId) -> Self {
        tracing_core::span::Id::from_u64(span_id.id)
    }
}

impl From<u64> for SpanId {
    fn from(id: u64) -> Self {
        SpanId { id }
    }
}

impl From<&'static tracing_core::Metadata<'static>> for register_metadata::NewMetadata {
    fn from(meta: &'static tracing_core::Metadata) -> Self {
        register_metadata::NewMetadata {
            id: Some(meta.into()),
            metadata: Some(meta.into()),
        }
    }
}

impl From<i64> for field::Value {
    fn from(val: i64) -> Self {
        field::Value::I64Val(val)
    }
}

impl From<u64> for field::Value {
    fn from(val: u64) -> Self {
        field::Value::U64Val(val)
    }
}

impl From<bool> for field::Value {
    fn from(val: bool) -> Self {
        field::Value::BoolVal(val)
    }
}

impl From<&str> for field::Value {
    fn from(val: &str) -> Self {
        field::Value::StrVal(val.into())
    }
}

impl From<&str> for field::Name {
    fn from(val: &str) -> Self {
        field::Name::StrName(val.into())
    }
}

impl From<&dyn std::fmt::Debug> for field::Value {
    fn from(val: &dyn std::fmt::Debug) -> Self {
        field::Value::DebugVal(format!("{:?}", val))
    }
}

// === IDs ===

impl From<u64> for Id {
    fn from(id: u64) -> Self {
        Id { id }
    }
}

impl From<Id> for u64 {
    fn from(id: Id) -> Self {
        id.id
    }
}

impl From<tracing_core::span::Id> for Id {
    fn from(id: tracing_core::span::Id) -> Self {
        Id { id: id.into_u64() }
    }
}

```

### Core Architecture Module: `console-api/src/generated/rs.tokio.console.async_ops.rs`
```
// This file is @generated by prost-build.
/// An `AsyncOp` state update.
///
/// This includes a list of any new async ops, and updates to the associated statistics
/// for any async ops that have changed since the last update.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct AsyncOpUpdate {
    /// A list of new async operations that were created since the last `AsyncOpUpdate`
    /// was sent. Note that the fact that an async operation has been created
    /// does not mean that is has been polled or is being polled. This information
    /// is reflected in the `Stats` of the operation.
    #[prost(message, repeated, tag = "1")]
    pub new_async_ops: ::prost::alloc::vec::Vec<AsyncOp>,
    /// Any async op stats that have changed since the last update.
    #[prost(map = "uint64, message", tag = "2")]
    pub stats_update: ::std::collections::HashMap<u64, Stats>,
    /// A count of how many async op events (e.g. polls, creation, etc) were not
    /// recorded because the application's event buffer was at capacity.
    ///
    /// If everything is working normally, this should be 0. If it is greater
    /// than 0, that may indicate that some data is missing from this update, and
    /// it may be necessary to increase the number of events buffered by the
    /// application to ensure that data loss is avoided.
    ///
    /// If the application's instrumentation ensures reliable delivery of events,
    /// this will always be 0.
    #[prost(uint64, tag = "3")]
    pub dropped_events: u64,
}
/// An async operation.
///
/// An async operation is an operation that is associated with a resource
/// This could, for example, be a read or write on a TCP stream, or a receive operation on
/// a channel.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct AsyncOp {
    /// The async op's ID.
    ///
    /// This uniquely identifies this op across all *currently live*
    /// ones.
    #[prost(message, optional, tag = "1")]
    pub id: ::core::option::Option<super::common::Id>,
    /// The numeric ID of the op's `Metadata`.
    ///
    /// This identifies the `Metadata` that describes the `tracing` span
    /// corresponding to this async op. The metadata for this ID will have been sent
    /// in a prior `RegisterMetadata` message.
    #[prost(message, optional, tag = "2")]
    pub metadata: ::core::option::Option<super::common::MetaId>,
    /// The source of this async operation. Most commonly this should be the name
    /// of the method where the instantiation of this op has happened.
    #[prost(string, tag = "3")]
    pub source: ::prost::alloc::string::String,
    /// The ID of the parent async op.
    ///
    /// This field is only set if this async op was created while inside of another
    /// async op.  For example, `tokio::sync`'s `Mutex::lock` internally calls
    /// `Semaphore::acquire`.
    ///
    /// This field can be empty; if it is empty, this async op is not a child of another
    /// async op.
    #[prost(message, optional, tag = "4")]
    pub parent_async_op_id: ::core::option::Option<super::common::Id>,
    /// The resources's ID.
    #[prost(message, optional, tag = "5")]
    pub resource_id: ::core::option::Option<super::common::Id>,
}
/// Statistics associated with a given async operation.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Stats {
    /// Timestamp of when the async op has been created.
    #[prost(message, optional, tag = "1")]
    pub created_at: ::core::option::Option<::prost_types::Timestamp>,
    /// Timestamp of when the async op was dropped.
    #[prost(message, optional, tag = "2")]
    pub dropped_at: ::core::option::Option<::prost_types::Timestamp>,
    /// The Id of the task that is awaiting on this op.
    #[prost(message, optional, tag = "4")]
    pub task_id: ::core::option::Option<super::common::Id>,
    /// Contains the operation poll stats.
    #[prost(message, optional, tag = "5")]
    pub poll_stats: ::core::option::Option<super::common::PollStats>,
    /// State attributes of the async op.
    #[prost(message, repeated, tag = "6")]
    pub attributes: ::prost::alloc::vec::Vec<super::common::Attribute>,
}

```

### Core Architecture Module: `console-api/src/generated/rs.tokio.console.common.rs`
```
// This file is @generated by prost-build.
/// Unique identifier for each task.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Id {
    /// The unique identifier's concrete value.
    #[prost(uint64, tag = "1")]
    pub id: u64,
}
/// A Rust source code location.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Location {
    /// The file path
    #[prost(string, optional, tag = "1")]
    pub file: ::core::option::Option<::prost::alloc::string::String>,
    /// The Rust module path
    #[prost(string, optional, tag = "2")]
    pub module_path: ::core::option::Option<::prost::alloc::string::String>,
    /// The line number in the source code file.
    #[prost(uint32, optional, tag = "3")]
    pub line: ::core::option::Option<u32>,
    /// The character in `line`.
    #[prost(uint32, optional, tag = "4")]
    pub column: ::core::option::Option<u32>,
}
/// Unique identifier for metadata.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct MetaId {
    /// The unique identifier's concrete value.
    #[prost(uint64, tag = "1")]
    pub id: u64,
}
/// Unique identifier for spans.
#[derive(Clone, Copy, PartialEq, Eq, Hash, ::prost::Message)]
pub struct SpanId {
    /// The unique identifier's concrete value.
    #[prost(uint64, tag = "1")]
    pub id: u64,
}
/// A message representing a key-value pair of data associated with a `Span`
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Field {
    /// Metadata for the task span that the field came from.
    #[prost(message, optional, tag = "8")]
    pub metadata_id: ::core::option::Option<MetaId>,
    /// The key of the key-value pair.
    ///
    /// This is either represented as a string, or as an index into a `Metadata`'s
    /// array of field name strings.
    #[prost(oneof = "field::Name", tags = "1, 2")]
    pub name: ::core::option::Option<field::Name>,
    /// The value of the key-value pair.
    #[prost(oneof = "field::Value", tags = "3, 4, 5, 6, 7")]
    pub value: ::core::option::Option<field::Value>,
}
/// Nested message and enum types in `Field`.
pub mod field {
    /// The key of the key-value pair.
    ///
    /// This is either represented as a string, or as an index into a `Metadata`'s
    /// array of field name strings.
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Oneof)]
    pub enum Name {
        /// The string representation of the name.
        #[prost(string, tag = "1")]
        StrName(::prost::alloc::string::String),
        /// An index position into the `Metadata.field_names` of the metadata
        /// for the task span that the field came from.
        #[prost(uint64, tag = "2")]
        NameIdx(u64),
    }
    /// The value of the key-value pair.
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Oneof)]
    pub enum Value {
        /// A value serialized to a string using `fmt::Debug`.
        #[prost(string, tag = "3")]
        DebugVal(::prost::alloc::string::String),
        /// A string value.
        #[prost(string, tag = "4")]
        StrVal(::prost::alloc::string::String),
        /// An unsigned integer value.
        #[prost(uint64, tag = "5")]
        U64Val(u64),
        /// A signed integer value.
        #[prost(sint64, tag = "6")]
        I64Val(i64),
        /// A boolean value.
        #[prost(bool, tag = "7")]
        BoolVal(bool),
    }
}
/// Represents a period of time in which a program was executing in a particular context.
///
/// Corresponds to `Span` in the `tracing` crate.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Span {
    /// An Id that uniquely identifies it in relation to other spans.
    #[prost(message, optional, tag = "1")]
    pub id: ::core::option::Option<SpanId>,
    /// Identifier for metadata describing static characteristics of all spans originating
    /// from that callsite, such as its name, source code location, verbosity level, and
    /// the names of its fields.
    #[prost(message, optional, tag = "2")]
    pub metadata_id: ::core::option::Option<MetaId>,
    /// User-defined key-value pairs of arbitrary data that describe the context the span represents,
    #[prost(message, repeated, tag = "3")]
    pub fields: ::prost::alloc::vec::Vec<Field>,
    /// Timestamp for the span.
    #[prost(message, optional, tag = "4")]
    pub at: ::core::option::Option<::prost_types::Timestamp>,
}
/// Any new metadata that was registered since the last update.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct RegisterMetadata {
    /// The new metadata that was registered since the last update.
    #[prost(message, repeated, tag = "1")]
    pub metadata: ::prost::alloc::vec::Vec<register_metadata::NewMetadata>,
}
/// Nested message and enum types in `RegisterMetadata`.
pub mod register_metadata {
    /// One metadata element registered since the last update.
    #[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
    pub struct NewMetadata {
        /// Unique identifier for `metadata`.
        #[prost(message, optional, tag = "1")]
        pub id: ::core::option::Option<super::MetaId>,
        /// The metadata payload.
        #[prost(message, optional, tag = "2")]
        pub metadata: ::core::option::Option<super::Metadata>,
    }
}
/// Metadata associated with a span or event.
#[derive(Clone, PartialEq, Eq, Hash, ::prost::Message)]
pub struct Metadata {
    /// The name of the span or event.
    #[prost(string, tag = "1")]
    pub name: ::prost::alloc::string::String,
    /// Describes the part of the system where the span or event that this
    /// metadata describes occurred.
    #[prost(string, tag = "2")]
    pub target: ::prost::alloc::string::String,
    /// The path to the Rust module where the span occurred.
    #[prost(string, tag = "3")]
    pub module_path: ::prost::alloc::string::String,
    /// The Rust source location associated with the span or event.
    #[prost(message, optional, tag = "4")]
    pub location: ::core::option::Option<Location>,
    /// Indicates whether metadata is associated with a span or with an event.
    #[prost(enumeration = "metadata::Kind", tag = "5")]
    pub kind: i32,
    /// Describes the level of verbosity of a span or event.
    #[prost(enumeration = "metadata::Level", tag = "6")]
    pub level: i32,
    /// The names of the key-value fields attached to the
    /// span or event this metadata is associated with.
    #[prost(string, repeated, tag = "7")]
    pub field_names: ::prost::alloc::vec::Vec<::prost::alloc::string::String>,
}
/// Nested message and enum types in `Metadata`.
pub mod metadata {
    /// Indicates whether metadata is associated with a span or with an event.
    #[derive(
        Clone,
        Copy,
        Debug,
        PartialEq,
        Eq,
        Hash,
        PartialOrd,
        Ord,
        ::prost::Enumeration
    )]
    #[repr(i32)]
    pub enum Kind {
        /// Indicates metadata is associated with a span.
        Span = 0,
        /// Indicates metadata is associated with an event.
        Event = 1,
    }
    impl Kind {
        /// String value of the enum field names used in the ProtoBuf definition.
        ///
        /// The values are not transformed in any way and thus are considered stable
        /// (if the ProtoBuf definition does not change) and safe for programmatic use.
        pub fn as_str_name(&self) -> &'static str {
            match self {
                Self::Span => "SPAN",
                Self::Event => "EVENT",
            }
        }
        /// Creates an enum from field names used in the ProtoBuf definition.
        pub fn from_str_name(value: &str) -> ::core::option::Option<Self> {
            match value {
                "SPAN" => Some(Self::Span),
                "EVENT" => Some(Self::Event),
                _ => None,
            }
        }
    }
    /// Describes the level of verbosity of a span or event.
    ///
    /// Corresponds to `Level` in the `tracing` crate.
    #[derive(
        Clone,
        Copy,
        Debug,
        PartialEq,
        Eq,
        Hash,
        PartialOrd,
        Ord,
        ::prost::Enumeration
    )]
    #[repr(i32)]
    pub enum Level {
        /// The "error" level.
        ///
        /// Designates very serious errors.
        Error = 0,
        /// The "warn" level.
        ///
        /// Designates hazardous situations.
        Warn = 1,
        /// The "info" level.
        /// Designates useful information.
        Info = 2,
        /// The "debug" level.
        ///
        /// Designates lower priority information.
        Debug = 3,
        /// The "trace" level.
        ///
        /// Designates very low priority, often extremely verbose, information.
        Trace = 4,
    }
    impl Level {
        /// String value of the enum field names used in the ProtoBuf definition.
        ///
        /// The values are not transformed in any way and thus are considered stable
        /// (if the ProtoBuf definition does not change) and safe for programmatic use.
        pub fn as_str_name(&self) -> &'static str {
            match self {
                Self::Error => "ERROR",
                Self::Warn => "WARN",
                Self::Info => "INFO",
                Self::Debug => "DEBUG",
                Self::Trace => "TRACE",
            }
        }
        /// Creates an enum from field names used in the ProtoBuf definition.
        pub fn from_str_name(value: &str) -> ::core::option::Option<Self> {
            match value {
                "ERROR" => Some(Self::Error),
                "WARN" => Some(Self::Warn),
                "INFO" => Some(Self::Info),
                "DEBUG" => Some(Self::Debug),
                "TRACE" => Some(Self::Trace),
                _ => None,
            }
        }
    }
}
/// Contains stats about objects that can be polled. Currently these can be:
/// - tasks that have been spawned
/// - async operations on resources that are performed within the context of a task
#[derive(Clone, Copy, PartialEq, E
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #676** (2026-08-07): **refactor: resolve clippy lints**
  *Symptoms*: ```console warning: redundant reference in `eprintln!` argument    --> console-subscriber/src/builder.rs:434:25     | 434 |                         &self.filter_env_var, log_filter, e     |                         ^^^^^^^^^^^^^^^^^^^^ help: remove the redundant `&`: `self.filter_env_var`     |     = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.97.0/index.html#useless_borrows_in_formatting     = note: `#[warn(clippy::useless_borrows_in_formatting)]` on by default  warning: manual checked division    --> tokio-console/src/view/mini_histogram.rs:139:20     | 139 |                 if max != 0 {     |                    ^^^^^^^^ check performed here 140 |                     let r = e * u64::from(area.height) * 8 / max;     |                             ------------------------------------ division performed here     |     = help: consider using `checked_div`     = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.97.0/index.html#manual_checked_ops     = note: `#[warn(clippy::manual_checked_ops)]` on by default ```

- **Issue #675** (2026-08-08): **Update ratatui from 0.29 to 0.30**
  *Symptoms*: Release notes:  - https://github.com/ratatui/ratatui/releases/tag/ratatui-v0.30.0 - https://github.com/ratatui/ratatui/releases/tag/ratatui-v0.30.1 - https://github.com/ratatui/ratatui/releases/tag/ratatui-v0.30.2
  **Post-Mortem & Fix Analysis**:
  > `cargo clippy` failure in CI is unrelated to this PR. Fix: https://github.com/tokio-rs/console/pull/676
  > - Rebased over https://github.com/tokio-rs/console/pull/676.

- **Issue #668** (2026-06-30): **chore: bump js-yaml from 4.1.0 to 4.2.0 in /console-subscriber/examples/grpc_web/app**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.1.0 to 4.2.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>[4.2.0] - 2026-06-01</h2> <h3>Added</h3> <ul> <li>Added <code>docs/safety.md</code> with notes about processing untrusted YAML.</li> <li>Added <code>maxDepth</code> (100) loader option. Not a problem, but gives a better exception instead of RangeError on stack overflow.</li> <li>Added <code>maxMergeSeqLength</code> (20) loader option. Not a problem after <code>merge</code> fix, but an additional restriction for safety.</li> <li>Added sourcemaps to <code>dist/</code> builds.</li> </ul> <h3>Changed</h3> <ul> <li>Stop resolving numbers with underscores as numeric scalars, <a href="https://redirect.github.com/nodeca/js-yaml/issues/627">#627</a>.</li> <li>Switched dev toolchains to Vite / neostandard.</li> <li>Updated demo.</li> <li>Reorganized tests.</li> <li><code>dist/</code> files are no longer kept in the repository.</li> </ul> <h3>Fixed</h3> <ul> <li>Fix parsing of properties on the first implicit block mapping key, <a href="https://redirect.github.com/nodeca/js-yaml/issues/62">#62</a>.</li> <li>Fix trailing whitespace handling when folding flow scalar lines, <a href="https://redirect.github.com/nodeca/js-yaml/issues/307">#307</a>.</li> <li>Reject top-level block scalars without content indentation, <a href="https://redirect.git
  **Post-Mortem & Fix Analysis**:
  > Superseded by #671.

- **Issue #663** (2026-06-13): **chore: bump vite and @vitejs/plugin-react in /console-subscriber/examples/grpc_web/app**
  *Symptoms*: Bumps [vite](https://github.com/vitejs/vite/tree/HEAD/packages/vite) and [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/HEAD/packages/plugin-react). These dependencies needed to be updated together. Updates `vite` from 5.4.18 to 8.0.8 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/vitejs/vite/releases">vite's releases</a>.</em></p> <blockquote> <h2>v8.0.8</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.8/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.7</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.7/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.6</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.6/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.5</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.5/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.4</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.4/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>create-vite@8.0.3</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/create-vite@8.0.3/packages/create-vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>v8.0.3</h2> <p>Please refer to <a href="https://github.com/vitejs/vite/blob/v8.0.3/packages/vite/CHANGELOG.md">CHANGELOG.md</a> for details.</p> <h2>create-v
  **Post-Mortem & Fix Analysis**:
  > Superseded by #666.

- **Issue #658** (2026-03-28): **chore: raise required compiler to rust 1.84**
  *Symptoms*: Rust 1.84.0 (released in January 2025) stabilized the MSRV-aware resolver in Cargo: https://blog.rust-lang.org/2025/01/09/Rust-1.84.0/#cargo-considers-rust-versions-for-dependency-version-selection. This makes it unnecessary to disallow using `tokio-console` with more recent versions of `clap`.  Specifically, I am interested in building `tokio-console` against `clap` 4.6 &mdash; using a much newer compiler than 1.74.0 obviously. But this is prohibited by the current dependency specification.

- **Issue #657** (2026-03-28): **Resolve clippy lints**
  *Symptoms*: ```console warning: the `Err`-variant returned from this closure is very large    --> console-subscriber/tests/support/subscriber.rs:314:14     | 314 |         .map(|expected| validate_expected_task(expected, &actual_tasks))     |              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ the `Err`-variant is at least 160 bytes     |     = help: try reducing the size of `support::task::TaskValidationFailure`, for example by boxing large elements or replacing it with `Box<support::task::TaskValidationFailure>`     = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.94.0/index.html#result_large_err     = note: `#[warn(clippy::result_large_err)]` on by default  warning: this `impl` can be derived   --> tokio-console/src/state/async_ops.rs:68:1    | 68 | / impl Default for SortBy { 69 | |     fn default() -> Self { 70 | |         Self::Aid 71 | |     } 72 | | }    | |_^    |    = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.94.0/index.html#derivable_impls    = note: `#[warn(clippy::derivable_impls)]` on by default help: replace the manual implementation with a derive attribute and mark the default variant    | 30 + #[derive(Default)] 31 | pub(crate) enum SortBy { 32 ~     #[default] 33 ~     Aid = 0,    |  warning: this `impl` can be derived   --> tokio-console/src/state/resources.rs:76:1    | 76 | / impl Default for SortBy { 77 | |     fn default() -> Self { 78

- **Issue #654** (2026-03-28): **chore(deps): bump bytes from 1.10.1 to 1.11.1**
  *Symptoms*: Bumps [bytes](https://github.com/tokio-rs/bytes) from 1.10.1 to 1.11.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/tokio-rs/bytes/releases">bytes's releases</a>.</em></p> <blockquote> <h2>Bytes v1.11.1</h2> <h1>1.11.1 (February 3rd, 2026)</h1> <ul> <li>Fix integer overflow in <code>BytesMut::reserve</code></li> </ul> <h2>Bytes v1.11.0</h2> <h1>1.11.0 (November 14th, 2025)</h1> <ul> <li>Bump MSRV to 1.57 (<a href="https://redirect.github.com/tokio-rs/bytes/issues/788">#788</a>)</li> </ul> <h3>Fixed</h3> <ul> <li>fix: <code>BytesMut</code> only reuse if src has remaining (<a href="https://redirect.github.com/tokio-rs/bytes/issues/803">#803</a>)</li> <li>Specialize <code>BytesMut::put::&lt;Bytes&gt;</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/793">#793</a>)</li> <li>Reserve capacity in <code>BytesMut::put</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/794">#794</a>)</li> <li>Change <code>BytesMut::remaining_mut</code> to use <code>isize::MAX</code> instead of <code>usize::MAX</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/795">#795</a>)</li> </ul> <h3>Internal changes</h3> <ul> <li>Guarantee address in <code>slice()</code> for empty slices. (<a href="https://redirect.github.com/tokio-rs/bytes/issues/780">#780</a>)</li> <li>Rename <code>Vtable::to_*</code> -&gt; <code>Vtable::into_*</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/776">#776</a>)</li> <l
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.
  > (Oops, wrong button.)

- **Issue #649** (2026-06-22): **chore(deps-dev): bump js-yaml from 4.1.0 to 4.1.1 in /console-subscriber/examples/grpc_web/app**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.1.0 to 4.1.1. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>[4.1.1] - 2025-11-12</h2> <h3>Security</h3> <ul> <li>Fix prototype pollution issue in yaml merge (&lt;&lt;) operator.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/cc482e775913e6625137572a3712d2826170e53a"><code>cc482e7</code></a> 4.1.1 released</li> <li><a href="https://github.com/nodeca/js-yaml/commit/50968b862e75866ef90e626572fe0b2f97b55f9f"><code>50968b8</code></a> dist rebuild</li> <li><a href="https://github.com/nodeca/js-yaml/commit/d092d866031751cb27c12d93f3e2470ad74d678b"><code>d092d86</code></a> lint fix</li> <li><a href="https://github.com/nodeca/js-yaml/commit/383665ff4248ec2192d1274e934462bb30426879"><code>383665f</code></a> fix prototype pollution in merge (&lt;&lt;)</li> <li><a href="https://github.com/nodeca/js-yaml/commit/0d3ca7a27b03a6c974790a30a89e456007d62976"><code>0d3ca7a</code></a> README.md: HTTP =&gt; HTTPS (<a href="https://redirect.github.com/nodeca/js-yaml/issues/678">#678</a>)</li> <li><a href="https://github.com/nodeca/js-yaml/commit/49baadd52af887d2991e2c39a6639baa56d6c71b"><code>49baadd</code></a> doc: 'empty' style option for !!null</li> <li><a href="https://github.com/nodeca/js-yaml/commit/ba3460eb9d3e4478edcbc2
  **Post-Mortem & Fix Analysis**:
  > Superseded by #668.

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

### Incident Patch 1: `b59758e5` (2026-08-08)
**Commit Message**: Update ratatui from 0.29 to 0.30 (#675)

* chore: raise required compiler to rust 1.88

* chore: update ratatui from 0.29 to 0.30

* chore: bump direct dependencies to fix -Zdirect-minimal-versions

cfg-if:

    error: failed to select a version for `cfg-if`.
        ... required by package `ratatui-crossterm v0.1.2`
        ... which satisfies dependency `ratatui-crossterm = "^0.1.2"` of package `ratatui v0.30.2`
        ... which satisfies dependency `ratatui = "^0.30.2"` of package `tokio-console v0.1.14 (/Users/dtolnay/git/tokio-console/tokio-console)`
    versions that meet the requirements `^1.0.1` are: 1.0.4, 1.0.3, 1.0.1

    all possible versions conflict with previously selected packages

      previously selected package `cfg-if v1.0.0`
        ... which satisfies dependency `cfg-if = "^1.0.0"` of package `tokio-console v0.1.14 (/Users/dtolnay/git/tokio-console/tokio-console)`

    failed to select a version for `cfg-if` which could resolve this conflict

serde:

    error: failed to select a version for `serde_derive`.
        ... required by package `serde_core v1.0.220`
        ... which satisfies dependency `serde_core = "^1.0.220"` of package `time v0.3.47`
        

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ jobs:
           - rust: stable
             os: windows-latest
             extraFeatures: ""
-          - rust: 1.84.0
+          - rust: 1.88.0
             os: ubuntu-latest
             extraFeatures: vsock
           # Try to build on the latest nightly. This job is allowed to fail, but
```

**File**: `Cargo.lock` (modified, +212/-97)
```diff
@@ -88,6 +88,15 @@ version = "1.0.100"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a23eb6b1614318a8071c9b2521f36b424b2c83db5eb3a0fead4a6c0809af6e61"
 
+[[package]]
+name = "approx"
+version = "0.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cab112f0a86d568ea0e627cc1d6be74a1e9cd55214684db5561995f6dad897c6"
+dependencies = [
+ "num-traits",
+]
+
 [[package]]
 name = "async-trait"
 version = "0.1.89"
@@ -194,9 +203,15 @@ checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
 
 [[package]]
 name = "bitflags"
-version = "2.9.4"
+version = "2.13.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b588b76d00fde79687d7646a9b5bdf3cc0f655e0bbd080335a95d7e96f3587da"
+
+[[package]]
+name = "by_address"
+version = "1.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2261d10cca569e4643e526d8dc2e62e433cc8aba21ab764233731f8d369bf394"
+checksum = "64fa3c856b712db6612c019f14756e64e4bcea13337a6b33b696333a9eaa2d06"
 
 [[package]]
 name = "byteorder"
@@ -210,12 +225,6 @@ version = "1.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1e748733b7cbc798e1434b6ac524f0c1ff2ab456fe201501e6497c8417a4fc33"
 
-[[package]]
-name = "cassowary"
-version = "0.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "df8670b8c7b9dae1793364eafadf7239c40d669904660c5960d74cfd80b46a53"
-
 [[package]]
 name = "castaway"
 version = "0.2.4"
@@ -323,9 +332,9 @@ checksum = "b05b61dc5112cbb17e4b6cd61790d9845d13888356391624cbe7e41efeac1e75"
 
 [[package]]
 name = "compact_str"
-version = "0.8.1"
+version = "0.9.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3b79c4069c6cad78e2e0cdfcbd26275770669fb39fd308a752dc110e83b9af32"
+checksum = "9dfdd1c2274d9aa354115b09dc9a901d6c5576818cdf70d14cae2bdb47df00ab"
 dependencies = [
  "castaway",
  "cfg-if",
@@ -440,22 +449,6 @@ version = "0.8.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d0a5c400df2834b80a4c3327b3aad3a4c4cd4de0629063962b03235697506a28"
 
-[[package]]
-name = "crossterm"
-version = "0.28.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "829d955a0bb380ef178a640b91779e3987da38c9aea133b20614cfed8cdea9c6"
-dependencies = [
- "bitflags",
- "crossterm_winapi",
- "mio",
- "parking_lot",
- "rustix 0.38.44",
- "signal-hook",
- "signal-hook-mio",
- "winapi",
-]
-
 [[package]]
 name = "crossterm"
 version = "0.29.0"
@@ -469,7 +462,7 @@ dependencies = [
  "futures-core",
  "mio",
  "parking_lot",
- "rustix 1.1.2",
+ "rustix",
  "signal-hook",
  "signal-hook-mio",
  "winapi",
@@ -519,6 +512,12 @@ dependencies = [
  "syn",
 ]
 
+[[package]]
+name = "deranged"
+version = "0.5.8"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
+
 [[package]]
 name = "derive_more"
 version = "2.0.1"
@@ -661,9 +660,9 @@ checksum = "3f9eec918d3f24069decb9af1554cad7c880e2da24a9afd88aca000531ab82c1"
 
 [[package]]
 name = "foldhash"
-version = "0.1.5"
+version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d9c4f5dac5e15c24eb999c26181a6ca40b39fe946cbe4c263c7209467bc83af2"
+checksum = "77ce24cb58228fbb8aa041425bb1050850ac19177686ea6e0f41a70416f56fdb"
 
 [[package]]
 name = "form_urlencoded"
@@ -819,9 +818,9 @@ dependencies = [
 
 [[package]]
 name = "hashbrown"
-version = "0.15.5"
+version = "0.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9229cfe53dfd69f0609a49f65461bd93001ea1ef889cd5529dd176593f5338a1"
+checksum = "5419bdc4f6a9207fbeba6d11b604d481addf78ecd10c11ad51e76c2f6482748d"
 dependencies = [
  "allocator-api2",
  "equivalent",
@@ -830,9 +829,14 @@ dependencies = [
 
 [[package]]
 name = "hashbrown"
-version = "0.16.0"
+version = "0.17.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5419bdc4f6a9207fbeba6d11b604d481addf78ecd10c11ad51e76c2f6482748d"
+checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"
+dependencies = [
+ "allocator-api2",
+ "equivalent",
+ "foldhash",
+]
 
 [[package]]
 name = "hdrhistogram"
@@ -1137,15 +1141,6 @@ version = "1.70.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7943c866cc5cd64cbc25b2e01621d07fa8eb2a1a23160ee81ce38704e97b8ecf"
 
-[[package]]
-name = "itertools"
-version = "0.13.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "413ee7dfc52ee1a4949ceeb7dbc8a33f2d6c088194d9f922fb8318faf1f01186"
-dependencies = [
- "either",
-]
-
 [[package]]
 name = "itertools"
 version = "0.14.0"
@@ -1161,6 +1156,17 @@ version = "1.0.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4a5f13b858c8d314ee3e8f639011f7ccefe71f97f96e50151fb991f267928e2c"
 
+[[package]]
+name = "ka
```

**File**: `console-api/Cargo.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name = "console-api"
 version = "0.9.0"
 license = "MIT"
 edition = "2021"
-rust-version = "1.84.0"
+rust-version = "1.88.0"
 authors = ["Eliza Weisman <eliza@buoyant.io>", "Tokio Contributors <team@tokio.rs>",]
 readme = "README.md"
 repository = "https://github.com/tokio-rs/console/"
```

**File**: `console-subscriber/Cargo.toml` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@ name = "console-subscriber"
 version = "0.5.0"
 license = "MIT"
 edition = "2021"
-rust-version = "1.84.0"
+rust-version = "1.88.0"
 authors = ["Eliza Weisman <eliza@buoyant.io>", "Tokio Contributors <team@tokio.rs>",]
 readme = "README.md"
 repository = "https://github.com/tokio-rs/console/"
@@ -50,7 +50,7 @@ prost-types = "0.14.1"
 hyper-util = { version = "0.1.6", features = ["tokio"] }
 
 # Required for recording:
-serde = { version = "1.0.145", features = ["derive"] }
+serde = { version = "1.0.220", features = ["derive"] }
 serde_json = "1"
 crossbeam-channel = "0.5"
 
```

**File**: `console-subscriber/README.md` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ console project.
 ## Supported Rust Versions
 
 The Tokio console is built against the latest stable release. The minimum
-supported version is 1.84. The current Tokio console version is not guaranteed
+supported version is 1.88. The current Tokio console version is not guaranteed
 to build on Rust versions earlier than the minimum supported version.
 
 ## License
```

**File**: `tokio-console/Cargo.toml` (modified, +4/-4)
```diff
@@ -4,7 +4,7 @@ version = "0.1.14"
 license = "MIT"
 repository = "https://github.com/tokio-rs/console"
 edition = "2021"
-rust-version = "1.84.0"
+rust-version = "1.88.0"
 authors = ["Eliza Weisman <eliza@buoyant.io>", "Tokio Contributors <team@tokio.rs>",]
 readme = "README.md"
 default-run = "tokio-console"
@@ -39,7 +39,7 @@ clap_complete = "4.5.2"
 tokio = { version = "1.47.1", features = ["full", "rt-multi-thread"] }
 tonic = { version = "0.14.2", features = ["transport"] }
 futures = "0.3"
-ratatui = { version = "0.29.0", default-features = false, features = ["crossterm"] }
+ratatui = { version = "0.30.2", default-features = false, features = ["crossterm"] }
 tower = { version = "0.5.2", features = ["util"] }
 tracing = "0.1.35"
 tracing-subscriber = { version = "0.3.17" }
@@ -54,9 +54,9 @@ hdrhistogram = { version = "7.4.0", default-features = false, features = ["seria
 h2 = "0.4.6"
 regex = "1.11"
 once_cell = "1.17.1"
-cfg-if = "1.0.0"
+cfg-if = "1.0.1"
 humantime = "2.1.0"
-serde = { version = "1.0.145", features = ["derive"] }
+serde = { version = "1.0.220", features = ["derive"] }
 toml = "0.9"
 dirs = "6"
 hyper-util = { version = "0.1.6", features = ["tokio"] }
```

**File**: `tokio-console/README.md` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ console project.
 ## Supported Rust Versions
 
 The Tokio console is built against the latest stable release. The minimum
-supported version is 1.84. The current Tokio console version is not guaranteed
+supported version is 1.88. The current Tokio console version is not guaranteed
 to build on Rust versions earlier than the minimum supported version.
 
 ## License
```

**File**: `tokio-console/src/view/mini_histogram.rs` (modified, +2/-2)
```diff
@@ -26,7 +26,7 @@ pub(crate) struct MiniHistogram<'a> {
     /// widget uses the max of the dataset)
     max: Option<u64>,
     /// A set of bar symbols used to represent the give data
-    bar_set: symbols::bar::Set,
+    bar_set: symbols::bar::Set<'a>,
     /// Duration precision for the labels
     duration_precision: usize,
 }
@@ -215,7 +215,7 @@ impl<'a> MiniHistogram<'a> {
     }
 
     #[allow(dead_code)]
-    pub fn bar_set(mut self, bar_set: symbols::bar::Set) -> MiniHistogram<'a> {
+    pub fn bar_set(mut self, bar_set: symbols::bar::Set<'a>) -> MiniHistogram<'a> {
         self.bar_set = bar_set;
         self
     }
```

---

### Incident Patch 2: `c3ba5bcd` (2026-03-28)
**Commit Message**: chore: raise required compiler to rust 1.84 (#658)

* Raise required compiler to rust 1.84

* Allow using tokio-console with newer version of clap

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ jobs:
           - rust: stable
             os: windows-latest
             extraFeatures: ""
-          - rust: 1.74.0
+          - rust: 1.84.0
             os: ubuntu-latest
             extraFeatures: vsock
           # Try to build on the latest nightly. This job is allowed to fail, but
```

**File**: `console-api/Cargo.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name = "console-api"
 version = "0.9.0"
 license = "MIT"
 edition = "2021"
-rust-version = "1.74.0"
+rust-version = "1.84.0"
 authors = ["Eliza Weisman <eliza@buoyant.io>", "Tokio Contributors <team@tokio.rs>",]
 readme = "README.md"
 repository = "https://github.com/tokio-rs/console/"
```

**File**: `console-subscriber/Cargo.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name = "console-subscriber"
 version = "0.5.0"
 license = "MIT"
 edition = "2021"
-rust-version = "1.74.0"
+rust-version = "1.84.0"
 authors = ["Eliza Weisman <eliza@buoyant.io>", "Tokio Contributors <team@tokio.rs>",]
 readme = "README.md"
 repository = "https://github.com/tokio-rs/console/"
```

**File**: `console-subscriber/README.md` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ console project.
 ## Supported Rust Versions
 
 The Tokio console is built against the latest stable release. The minimum
-supported version is 1.74. The current Tokio console version is not guaranteed
+supported version is 1.84. The current Tokio console version is not guaranteed
 to build on Rust versions earlier than the minimum supported version.
 
 ## License
```

**File**: `tokio-console/Cargo.toml` (modified, +3/-3)
```diff
@@ -4,7 +4,7 @@ version = "0.1.14"
 license = "MIT"
 repository = "https://github.com/tokio-rs/console"
 edition = "2021"
-rust-version = "1.74.0"
+rust-version = "1.84.0"
 authors = ["Eliza Weisman <eliza@buoyant.io>", "Tokio Contributors <team@tokio.rs>",]
 readme = "README.md"
 default-run = "tokio-console"
@@ -34,8 +34,8 @@ eula = false
 
 [dependencies]
 console-api = { version = "0.9.0", path = "../console-api", features = ["transport"] }
-clap = { version = "~4.5.4", features = ["wrap_help", "cargo", "derive", "env"] }
-clap_complete = "~4.5.2"
+clap = { version = "4.5.4", features = ["wrap_help", "cargo", "derive", "env"] }
+clap_complete = "4.5.2"
 tokio = { version = "1.47.1", features = ["full", "rt-multi-thread"] }
 tonic = { version = "0.14.2", features = ["transport"] }
 futures = "0.3"
```

**File**: `tokio-console/README.md` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ console project.
 ## Supported Rust Versions
 
 The Tokio console is built against the latest stable release. The minimum
-supported version is 1.74. The current Tokio console version is not guaranteed
+supported version is 1.84. The current Tokio console version is not guaranteed
 to build on Rust versions earlier than the minimum supported version.
 
 ## License
```

**File**: `xtask/Cargo.toml` (modified, +2/-2)
```diff
@@ -3,13 +3,13 @@ name = "xtask"
 version = "0.1.0"
 license = "MIT"
 edition = "2021"
-rust-version = "1.74.0"
+rust-version = "1.84.0"
 publish = false
 
 [dependencies]
 tonic-prost-build = { version = "0.14.2", default-features = false, features = [
     "transport"
 ] }
-clap = { version = "~4.5.4", features = ["derive"] }
+clap = { version = "4.5.4", features = ["derive"] }
 color-eyre = "0.6"
 regex = "1.11"
```

---

### Incident Patch 3: `d3848d71` (2025-09-29)
**Commit Message**: Fix Nix builds and update the lock file (#641)

* Fix clippy warnings

* Fix doc example

* Clean up tonic-web usage

It looks like `tonic_web::enable` was removed with the 0.13.x release so
this code hasn't actually compiled for a long time. The doc and code
examples all use a custom cors layer so whatever heavy lifting the 0.12
method was doing doesn't seem necessary anymore

* ci: run clippy with all features enabled

Features are additive so this should be safe to lint them all together
(and avoid the combinatorics of using cargo-hack)

* ci: run all crate tests in one invocation

1. We've already committed our lockfile so there's no need to test the
   API/subscriber crates individually (if we want to test with the
   latest available versions we should be running a `cargo update` in
   CI, so this change remains compatible with the previous behavior)
2. Also enable some non-default feature flags to ensure they are being
   tested

* Fix nix builds

* flake.lock: Update

Flake lock file updates:

• Updated input 'flake-utils':
    'github:numtide/flake-utils/cfacdce06f30d2b68473a46042957675eebb3401' (2023-04-11)
  → 'github:numtide/flake-utils/11707dc2f618dd54ca8739b309ec4fc02

**File**: `flake.lock` (modified, +9/-12)
```diff
@@ -5,11 +5,11 @@
         "systems": "systems"
       },
       "locked": {
-        "lastModified": 1681202837,
-        "narHash": "sha256-H+Rh19JDwRtpVPAWp64F+rlEtxUWBAQW28eAi3SRSzg=",
+        "lastModified": 1731533236,
+        "narHash": "sha256-l0KFg5HjrsfsO/JpG+r7fRrqm12kzFHyUHqHCVpMMbI=",
         "owner": "numtide",
         "repo": "flake-utils",
-        "rev": "cfacdce06f30d2b68473a46042957675eebb3401",
+        "rev": "11707dc2f618dd54ca8739b309ec4fc024de578b",
         "type": "github"
       },
       "original": {
@@ -20,11 +20,11 @@
     },
     "nixpkgs": {
       "locked": {
-        "lastModified": 1707689078,
-        "narHash": "sha256-UUGmRa84ZJHpGZ1WZEBEUOzaPOWG8LZ0yPg1pdDF/yM=",
+        "lastModified": 1759036355,
+        "narHash": "sha256-0m27AKv6ka+q270dw48KflE0LwQYrO7Fm4/2//KCVWg=",
         "owner": "NixOS",
         "repo": "nixpkgs",
-        "rev": "f9d39fb9aff0efee4a3d5f4a6d7c17701d38a1d8",
+        "rev": "e9f00bd893984bc8ce46c895c3bf7cac95331127",
         "type": "github"
       },
       "original": {
@@ -43,19 +43,16 @@
     },
     "rust-overlay": {
       "inputs": {
-        "flake-utils": [
-          "flake-utils"
-        ],
         "nixpkgs": [
           "nixpkgs"
         ]
       },
       "locked": {
-        "lastModified": 1707790272,
-        "narHash": "sha256-KQXPNl3BLdRbz7xx+mwIq/017fxLRk6JhXHxVWCKsTU=",
+        "lastModified": 1759113356,
+        "narHash": "sha256-xm4kEUcV2jk6u15aHazFP4YsMwhq+PczA+Ul/4FDKWI=",
         "owner": "oxalica",
         "repo": "rust-overlay",
-        "rev": "8dfbe2dffc28c1a18a29ffa34d5d0b269622b158",
+        "rev": "be3b8843a2be2411500f6c052876119485e957a2",
         "type": "github"
       },
       "original": {
```

**File**: `flake.nix` (modified, +25/-4)
```diff
@@ -8,7 +8,6 @@
       url = "github:oxalica/rust-overlay";
       inputs = {
         nixpkgs.follows = "nixpkgs";
-        flake-utils.follows = "flake-utils";
       };
     };
   };
@@ -66,12 +65,32 @@
               pname = cargoTOML.package.name;
               version = cargoTOML.package.version;
 
-              nativeBuildInputs = [ protobuf ];
+              nativeBuildInputs = [
+                installShellFiles
+                protobuf
+              ];
+
+              RUSTFLAGS = "--cfg tokio_unstable";
 
               inherit src;
 
               cargoLock = { lockFile = "${src}/Cargo.lock"; };
 
+              checkFlags = [
+                # tests depend upon git repository at test execution time
+                "--skip bootstrap"
+                "--skip config::tests::args_example_changed"
+                "--skip config::tests::toml_example_changed"
+                "--skip cli_tests"
+              ];
+
+              postInstall = lib.optionalString (stdenv.buildPlatform.canExecute stdenv.hostPlatform) ''
+                installShellCompletion --cmd tokio-console \
+                  --bash <($out/bin/tokio-console --log-dir $(mktemp -d) gen-completion bash) \
+                  --fish <($out/bin/tokio-console --log-dir $(mktemp -d) gen-completion fish) \
+                  --zsh <($out/bin/tokio-console --log-dir $(mktemp -d) gen-completion zsh)
+              '';
+
               meta = {
                 inherit (cargoTOML.package) description homepage license;
                 maintainers = cargoTOML.package.authors;
@@ -84,8 +103,7 @@
           devShell = with pkgs;
             mkShell {
               name = "tokio-console-env";
-              buildInputs = tokio-console.buildInputs ++ lib.optional stdenv.isDarwin libiconv;
-              nativeBuildInputs = tokio-console.nativeBuildInputs;
+              inputsFrom = [ tokio-console ];
               RUST_SRC_PATH = "${rustPlatform.rustLibSrc}";
               CARGO_TERM_COLOR = "always";
               RUST_BACKTRACE = "full";
@@ -105,5 +123,8 @@
             inherit tokio-console;
             default = self.packages.${system}.tokio-console;
           };
+          checks = {
+            inherit tokio-console;
+          };
         });
 }
```

---

### Incident Patch 4: `4238e732` (2025-09-29)
**Commit Message**: Fix some clippy warnings and building with `--all-features` (#640)

* Fix clippy warnings

* Fix doc example

* Clean up tonic-web usage

It looks like `tonic_web::enable` was removed with the 0.13.x release so
this code hasn't actually compiled for a long time. The doc and code
examples all use a custom cors layer so whatever heavy lifting the 0.12
method was doing doesn't seem necessary anymore

* ci: run clippy with all features enabled

Features are additive so this should be safe to lint them all together
(and avoid the combinatorics of using cargo-hack)

* ci: run all crate tests in one invocation

1. We've already committed our lockfile so there's no need to test the
   API/subscriber crates individually (if we want to test with the
   latest available versions we should be running a `cargo update` in
   CI, so this change remains compatible with the previous behavior)
2. Also enable some non-default feature flags to ensure they are being
   tested

**File**: `.github/workflows/ci.yml` (modified, +10/-10)
```diff
@@ -71,15 +71,21 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        os: [ubuntu-latest, macos-latest, windows-latest]
+        os: [ubuntu-latest, macos-latest]
         rust: [stable]
+        extraFeatures: [vsock]
         include:
+          - rust: stable
+            os: windows-latest
+            extraFeatures: ""
           - rust: 1.74.0
             os: ubuntu-latest
+            extraFeatures: vsock
           # Try to build on the latest nightly. This job is allowed to fail, but
           # it's useful to help catch bugs in upcoming Rust versions.
           - rust: nightly
             os: ubuntu-latest
+            extraFeatures: vsock
     steps:
       - name: Checkout sources
         uses: actions/checkout@v4
@@ -95,14 +101,8 @@ jobs:
         with:
           repo-token: ${{ secrets.GITHUB_TOKEN }}
 
-      - name: Run cargo test (API)
-        run: cargo test -p console-api
-
-      - name: Run cargo test (subscriber)
-        run: cargo test -p console-subscriber
-
-      - name: Run cargo test (console)
-        run: cargo test -p tokio-console --locked
+      - name: Run cargo test
+        run: cargo test --workspace --locked --features "transport,grpc-web,${{ matrix.extraFeatures }}"
 
   lints:
     name: Lints
@@ -122,7 +122,7 @@ jobs:
         run: cargo fmt --all -- --check
 
       - name: Run cargo clippy
-        run: cargo clippy --workspace --all-targets --no-deps -- -D warnings
+        run: cargo clippy --workspace --all-features --all-targets --no-deps -- -D warnings
 
   docs:
     name: Docs
```

**File**: `console-subscriber/Cargo.toml` (modified, +2/-4)
```diff
@@ -28,7 +28,7 @@ keywords = [
 default = ["env-filter"]
 parking_lot = ["dep:parking_lot", "tracing-subscriber/parking_lot"]
 env-filter = ["tracing-subscriber/env-filter"]
-grpc-web = ["dep:tonic-web"]
+grpc-web = []
 vsock = ["dep:tokio-vsock"]
 
 [dependencies]
@@ -54,9 +54,6 @@ serde = { version = "1.0.145", features = ["derive"] }
 serde_json = "1"
 crossbeam-channel = "0.5"
 
-# Only for the web feature:
-tonic-web = { version = "0.13", optional = true }
-
 # Only for the vsock feature:
 tokio-vsock = { version = "0.7.1", optional = true, features = ["tonic013"]}
 
@@ -66,6 +63,7 @@ tower = { version = "0.4.12", default-features = false, features = ["util"] }
 futures = "0.3"
 http = "1.1"
 tower-http = { version = "0.5", features = ["cors"] }
+tonic-web = "0.13"
 
 [lints.rust.unexpected_cfgs]
 level = "warn"
```

**File**: `console-subscriber/src/builder.rs` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ impl Builder {
     /// ```
     /// # use console_subscriber::Builder;
     /// # #[cfg(feature = "vsock")]
-    /// let builder = Builder::default().server_addr((tokio_vsock::VMADDR_CID_ANY, 6669));
+    /// let builder = Builder::default().server_addr(tokio_vsock::VsockAddr::new(tokio_vsock::VMADDR_CID_ANY, 6669));
     /// ```
     ///
     /// [environment variable]: `Builder::with_default_env`
```

**File**: `console-subscriber/src/lib.rs` (modified, +1/-13)
```diff
@@ -974,16 +974,6 @@ impl Server {
     ///
     /// # Examples
     ///
-    /// To serve the instrument server with gRPC-Web support with the default
-    /// settings:
-    ///
-    /// ```rust
-    /// # async fn docs() -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
-    /// # let (_, server) = console_subscriber::ConsoleLayer::new();
-    /// server.serve_with_grpc_web(tonic::transport::Server::default()).await
-    /// # }
-    /// ```
-    ///
     /// To serve the instrument server with gRPC-Web support and a custom CORS configuration, use the
     /// following code:
     ///
@@ -1076,9 +1066,7 @@ impl Server {
             instrument_server,
             aggregator,
         } = self.into_parts();
-        let router = builder
-            .accept_http1(true)
-            .add_service(tonic_web::enable(instrument_server));
+        let router = builder.accept_http1(true).add_service(instrument_server);
         let aggregate = spawn_named(aggregator.run(), "console::aggregate");
         let res = match addr {
             ServerAddr::Tcp(addr) => {
```

**File**: `console-subscriber/tests/support/subscriber.rs` (modified, +1/-2)
```diff
@@ -207,8 +207,7 @@ async fn console_client(client_stream: DuplexStream, mut test_state: TestState)
                 // We need to return a Result from this async block, which is
                 // why we don't unwrap the `client` here.
                 client.map(TokioIo::new).ok_or_else(|| {
-                    std::io::Error::new(
-                        std::io::ErrorKind::Other,
+                    std::io::Error::other(
                         "console-test error: client already taken. This shouldn't happen.",
                     )
                 })
```

**File**: `tokio-console/src/conn.rs` (modified, +1/-1)
```diff
@@ -271,7 +271,7 @@ impl Connection {
         }
     }
 
-    pub fn render(&self, styles: &crate::view::Styles) -> ratatui::text::Line {
+    pub fn render(&self, styles: &crate::view::Styles) -> ratatui::text::Line<'_> {
         use ratatui::{
             style::{Color, Modifier},
             text::{Line, Span},
```

---

### Incident Patch 5: `85acb905` (2025-04-10)
**Commit Message**: chore: fix new clippy lint from Rust 1.86 (#622)

The new [`clippy::doc_overindented_list_items`] lint was triggering on a
few lines in the documentation of our Tokio Console config struct. These
have been aligned with Clippy's suggestions.

[`clippy::doc_overindented_list_items`]: https://rust-lang.github.io/rust-clippy/master/index.html#doc_overindented_list_items

**File**: `tokio-console/src/config.rs` (modified, +6/-6)
```diff
@@ -58,17 +58,17 @@ pub struct Config {
     /// Each warning is specified by its name, which is one of:
     ///
     /// * `self-wakes` -- Warns when a task wakes itself more than a certain percentage of its total wakeups.
-    ///                   Default percentage is 50%.
+    ///   Default percentage is 50%.
     ///
     /// * `lost-waker` -- Warns when a task is dropped without being woken.
     ///
     /// * `never-yielded` -- Warns when a task has never yielded.
     ///
     /// * `auto-boxed-future` -- Warnings when the future driving a task was automatically boxed by
-    ///                          the runtime because it was large.
+    ///   the runtime because it was large.
     ///
     /// * `large-future` -- Warnings when the future driving a task occupies a large amount of
-    ///                     stack space.
+    ///   stack space.
     #[clap(long = "warn", short = 'W', value_delimiter = ',', num_args = 1..)]
     #[clap(default_values_t = KnownWarnings::default_enabled_warnings())]
     pub(crate) warnings: Vec<KnownWarnings>,
@@ -80,17 +80,17 @@ pub struct Config {
     /// Each warning is specified by its name, which is one of:
     ///
     /// * `self-wakes` -- Warns when a task wakes itself more than a certain percentage of its total wakeups.
-    ///                  Default percentage is 50%.
+    ///   Default percentage is 50%.
     ///
     /// * `lost-waker` -- Warns when a task is dropped without being woken.
     ///
     /// * `never-yielded` -- Warns when a task has never yielded.
     ///
     /// * `auto-boxed-future` -- Warnings when the future driving a task was automatically boxed by
-    ///                          the runtime because it was large.
+    ///   the runtime because it was large.
     ///
     /// * `large-future` -- Warnings when the future driving a task occupies a large amount of
-    ///                     stack space.
+    ///   stack space.
     ///
     /// If this is set to `all`, all warnings are allowed.
     ///
```

---

### Incident Patch 6: `ada7dab7` (2025-03-31)
**Commit Message**: fix(console): add dynamic constraints layout in task details screen (#614)

The changes I've made is for accommodating long location names.

I've changed the .. to the long name; it widens the task rectangle if its longer
than the default (50%) and goes to the next line if its longer than what we can
accommodate in a single line. This fixes issue #523, I have attached screenshots
of the same in the PR, before and after changes.

Fixes #523

Co-authored-by: Hayden Stainsby <[REDACTED_EMAIL]>

**File**: `tokio-console/src/view/task.rs` (modified, +47/-31)
```diff
@@ -68,6 +68,18 @@ impl TaskView {
             })
             .collect();
 
+        let location_heading = "Location: ";
+        let max_width_stats_area = area.width - 45; //NOTE: 45 is min width needed, this is a calculated number according to the string: 'Last woken: 75.831727ms ago' but with some more extra pixels.
+        let location_lines_vector: Vec<String> = task
+            .location()
+            .to_string()
+            .chars()
+            .collect::<Vec<char>>()
+            .chunks(max_width_stats_area as usize)
+            .map(|chunk| chunk.iter().collect())
+            .collect();
+        let task_stats_height = 9 + location_lines_vector.len() as u16;
+        // Id, Name, Target, Location (multiple), total, busy, scheduled, and idle times + top/bottom borders
         let (
             controls_area,
             stats_area,
@@ -83,7 +95,7 @@ impl TaskView {
                         // controls
                         layout::Constraint::Length(controls.height()),
                         // task stats
-                        layout::Constraint::Length(10),
+                        layout::Constraint::Length(task_stats_height),
                         // poll duration
                         layout::Constraint::Length(9),
                         // scheduled duration
@@ -105,7 +117,7 @@ impl TaskView {
                         // warnings (add 2 for top and bottom borders)
                         layout::Constraint::Length(warnings.len() as u16 + 2),
                         // task stats
-                        layout::Constraint::Length(10),
+                        layout::Constraint::Length(task_stats_height),
                         // poll duration
                         layout::Constraint::Length(9),
                         // scheduled duration
@@ -127,15 +139,15 @@ impl TaskView {
             )
         };
 
+        let stats_constraints = [
+            // 15 is the length of "| Location:     |"
+            layout::Constraint::Min(task.location().len() as u16 + 15),
+            layout::Constraint::Min(32),
+        ];
+
         let stats_area = Layout::default()
             .direction(layout::Direction::Horizontal)
-            .constraints(
-                [
-                    layout::Constraint::Percentage(50),
-                    layout::Constraint::Percentage(50),
-                ]
-                .as_ref(),
-            )
+            .constraints(stats_constraints.as_ref())
             .split(stats_area);
 
         // Just preallocate capacity for ID, name, target, total, busy, and idle.
@@ -152,17 +164,12 @@ impl TaskView {
 
         overview.push(Line::from(vec![bold("Target: "), Span::raw(task.target())]));
 
-        let title = "Location: ";
-        let location_max_width = stats_area[0].width as usize - 2 - title.len(); // NOTE: -2 for the border
-        let location = if task.location().len() > location_max_width {
-            let ellipsis = styles.if_utf8("\u{2026}", "...");
-            let start = task.location().len() - location_max_width + ellipsis.chars().count();
-            format!("{}{}", ellipsis, &task.location()[start..])
-        } else {
-            task.location().to_string()
-        };
-
-        overview.push(Line::from(vec![bold(title), Span::raw(location)]));
+        let location_vector = vec![bold(location_heading), Span::raw(&location_lines_vector[0])];
+        overview.push(Line::from(location_vector));
+        for line in &location_lines_vector[1..] {
+            overview.push(Line::from(Span::raw(format!("          {}", line))));
+            //10 spaces to be precise due to the Length of  "Location: "
+        }
 
         let total = task.total(now);
 
@@ -185,28 +192,37 @@ impl TaskView {
 
         let mut waker_stats = vec![Line::from(vec![
             bold("Current wakers: "),
-            Span::from(format!("{} (", task.waker_count())),
-            bold("clones: "),
-            Span::from(format!("{}, ", task.waker_clones())),
-            bold("drops: "),
-            Span::from(format!("{})", task.waker_drops())),
+            Span::from(format!("{} ", task.waker_count())),
         ])];
+        let waker_stats_clones = vec![
+            bold("  Clones: "),
+            Span::from(format!("{}, ", task.waker_clones())),
+        ];
 
-        let mut wakeups = vec![
+        let waker_stats_drops = vec![
+            bold("  Drops: "),
+            Span::from(format!("{}", task.waker_drops())),
+        ];
+
+        let wakeups = vec![
             bold("Woken: "),
             Span::from(format!("{} times", task.wakes())),
         ];
 
+        let mut last_woken_line = vec![];
+
         // If the task has been woken, add the time since wake to its stats as well.
         if let Some(since) = task.since_wake(now) {
-            wakeups.reserve(3);
-            wakeups.push(Span::raw(", "));
-            wakeups.push(bold("last woken: "));
-            wakeups.push(styles.time_u
```

---

### Incident Patch 7: `3dbca7a7` (2024-12-26)
**Commit Message**: docs(subscriber): fix typo in doc comment

**File**: `console-subscriber/src/builder.rs` (modified, +1/-1)
```diff
@@ -659,7 +659,7 @@ impl<'a> From<&'a Path> for ServerAddr {
 ///
 /// If the "env-filter" crate feature flag is enabled, the `RUST_LOG`
 /// environment variable will be parsed using the [`EnvFilter`] type from
-/// `tracing-subscriber. If the "env-filter" feature is **not** enabled, the
+/// `tracing-subscriber`. If the "env-filter" feature is **not** enabled, the
 /// [`Targets`] filter is used instead. The `EnvFilter` type accepts all the
 /// same syntax as `Targets`, but with the added ability to filter dynamically
 /// on span field values. See the documentation for those types for details.
```

---

### Incident Patch 8: `dd646291` (2024-12-12)
**Commit Message**: fix: bump the url to 2.5.4 (#602)

close #601

As Remedy said, because we are not directly dependent on `idna`. 
So we just need to bump the `url` to 2.5.4 or later.

Signed-off-by: Rustin170506 <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +265/-31)
```diff
@@ -510,6 +510,17 @@ dependencies = [
  "windows-sys 0.48.0",
 ]
 
+[[package]]
+name = "displaydoc"
+version = "0.2.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "97369cbbc041bc366949bc74d34658d6cda5621039731c6310521892a3a20ae0"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
 [[package]]
 name = "dunce"
 version = "1.0.5"
@@ -891,14 +902,143 @@ dependencies = [
  "tracing",
 ]
 
+[[package]]
+name = "icu_collections"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "db2fa452206ebee18c4b5c2274dbf1de17008e874b4dc4f0aea9d01ca79e4526"
+dependencies = [
+ "displaydoc",
+ "yoke",
+ "zerofrom",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_locid"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "13acbb8371917fc971be86fc8057c41a64b521c184808a698c02acc242dbf637"
+dependencies = [
+ "displaydoc",
+ "litemap",
+ "tinystr",
+ "writeable",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_locid_transform"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "01d11ac35de8e40fdeda00d9e1e9d92525f3f9d887cdd7aa81d727596788b54e"
+dependencies = [
+ "displaydoc",
+ "icu_locid",
+ "icu_locid_transform_data",
+ "icu_provider",
+ "tinystr",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_locid_transform_data"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fdc8ff3388f852bede6b579ad4e978ab004f139284d7b28715f773507b946f6e"
+
+[[package]]
+name = "icu_normalizer"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "19ce3e0da2ec68599d193c93d088142efd7f9c5d6fc9b803774855747dc6a84f"
+dependencies = [
+ "displaydoc",
+ "icu_collections",
+ "icu_normalizer_data",
+ "icu_properties",
+ "icu_provider",
+ "smallvec",
+ "utf16_iter",
+ "utf8_iter",
+ "write16",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_normalizer_data"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f8cafbf7aa791e9b22bec55a167906f9e1215fd475cd22adfcf660e03e989516"
+
+[[package]]
+name = "icu_properties"
+version = "1.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "93d6020766cfc6302c15dbbc9c8778c37e62c14427cb7f6e601d849e092aeef5"
+dependencies = [
+ "displaydoc",
+ "icu_collections",
+ "icu_locid_transform",
+ "icu_properties_data",
+ "icu_provider",
+ "tinystr",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_properties_data"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "67a8effbc3dd3e4ba1afa8ad918d5684b8868b3b26500753effea8d2eed19569"
+
+[[package]]
+name = "icu_provider"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6ed421c8a8ef78d3e2dbc98a973be2f3770cb42b606e3ab18d6237c4dfde68d9"
+dependencies = [
+ "displaydoc",
+ "icu_locid",
+ "icu_provider_macros",
+ "stable_deref_trait",
+ "tinystr",
+ "writeable",
+ "yoke",
+ "zerofrom",
+ "zerovec",
+]
+
+[[package]]
+name = "icu_provider_macros"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1ec89e9337638ecdc08744df490b221a7399bf8d164eb52a665454e60e075ad6"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
 [[package]]
 name = "idna"
-version = "0.5.0"
+version = "1.0.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "686f825264d630750a544639377bae737628043f20d38bbc029e8f29ea968a7e"
+dependencies = [
+ "idna_adapter",
+ "smallvec",
+ "utf8_iter",
+]
+
+[[package]]
+name = "idna_adapter"
+version = "1.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "634d9b1461af396cad843f47fdba5597a4f9e6ddd4bfb6ff5d85028c25cb12f6"
+checksum = "daca1df1c957320b2cf139ac61e7bd64fed304c5040df000a745aa1de3b4ef71"
 dependencies = [
- "unicode-bidi",
- "unicode-normalization",
+ "icu_normalizer",
+ "icu_properties",
 ]
 
 [[package]]
@@ -986,6 +1126,12 @@ version = "0.4.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "78b3ae25bc7c8c38cec158d1f2757ee79e9b3740fbc7ccf0e59e4b08d793fa89"
 
+[[package]]
+name = "litemap"
+version = "0.7.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "4ee93343901ab17bd981295f2cf0026d4ad018c7c31ba84549a4ddbb47a45104"
+
 [[package]]
 name = "lock_api"
 version = "0.4.12"
@@ -1675,6 +1821,12 @@ dependencies = [
  "syn",
 ]
 
+[[package]]
+name = "stable_deref_trait"
+version = "1.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a8f112729512f8e442d81f95a8a7ddf2b7c6b8a1a6f509a95864142b30cab2d3"
+
 [[package]]
 name = "static_assertions"
 version = "1.1.0"
@@ -1732,6 +1884,17 @@ version = "1.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a7065abeca94b6a8a577f9bd45aa0867a2238b74e8eb67cf10d492bc39351394"
 
+[[package]]
+name
```

---

### Incident Patch 9: `1f41b61f` (2024-11-04)
**Commit Message**: fix(api): bump minimum version of tonic (#593)

Change the minimum version of tonic from 0.12 to 0.12.3. This fixes
compilation in downstream projects with old lock files, since the
generated code now uses a constant only present in tonic 0.12.3.

Closes #592

**File**: `console-api/Cargo.toml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ keywords = [
 transport = ["tonic/transport"]
 
 [dependencies]
-tonic = { version = "0.12", default-features = false, features = [
+tonic = { version = "0.12.3", default-features = false, features = [
     "prost",
     "codegen",
     "transport",
```

---

### Incident Patch 10: `f8e1bee7` (2024-08-29)
**Commit Message**: fix(console): correct the grammar issue (#579)

I know the best solution is to ensure we can distinguish singular or plural here.
But for now, let's correct the grammar issue first.

**File**: `tokio-console/src/warnings.rs` (modified, +1/-1)
```diff
@@ -174,7 +174,7 @@ pub(crate) struct LostWaker;
 
 impl Warn<Task> for LostWaker {
     fn summary(&self) -> &str {
-        "tasks have lost their waker"
+        "tasks have lost their wakers"
     }
 
     fn check(&self, task: &Task) -> Warning {
```

---

### Incident Patch 11: `c4420630` (2024-07-29)
**Commit Message**: fix(subscriber): remove unused `AggregatorHandle` and fix other lints (#578)

A number of new or updated Clippy lints in Rust 1.80.0 need to be fixed.

An update to the `dead_code` pointed out that the `AggregatorHandle` is
not used, and it is not constructable from outside the crate because it
has a private field. This struct was introduced in #451 as part of the
`Server::into_parts` method. Originally, this method was going to return
the `AggregatorHandle`, which wrapped the join handle from the task
where the `Aggregator` had been spawned. This was later replaced by
returning the `Aggregator` itself, which the user had the obligation to
spawn themselves. However, it seems that the `AggregatorHandle` wasn't
removed, even though it was never used.

A new lint is the one for unexpected `--cfg` items. We now need to
declare those in `Cargo.toml`.

An update to `needless_borrows_for_generic_args` causes a false positive
changing a `&mut` to a move, which we can't do as the same value is used
afterwards.

**File**: `console-subscriber/Cargo.toml` (modified, +4/-0)
```diff
@@ -63,6 +63,10 @@ futures = "0.3"
 http = "1.1"
 tower-http = { version = "0.5", features = ["cors"] }
 
+[lints.rust.unexpected_cfgs]
+level = "warn"
+check-cfg = [ 'cfg(tokio_unstable)', 'cfg(console_without_tokio_unstable)' ]
+
 [package.metadata.docs.rs]
 all-features = true
 rustdoc-args = ["--cfg", "docsrs"]
```

**File**: `console-subscriber/README.md` (modified, +4/-4)
```diff
@@ -94,12 +94,12 @@ runtime][Tokio] is considered *experimental*. In order to use
   level].
 
   + If you're using the [`console_subscriber::init()`][init] or
-  [`console_subscriber::Builder`][builder] APIs, these targets are enabled
-  automatically.
+    [`console_subscriber::Builder`][builder] APIs, these targets are enabled
+    automatically.
 
   + If you are manually configuring the `tracing` subscriber using the
-  [`EnvFilter`] or [`Targets`] filters from [`tracing-subscriber`], add
-  `"tokio=trace,runtime=trace"` to your filter configuration.
+    [`EnvFilter`] or [`Targets`] filters from [`tracing-subscriber`], add
+    `"tokio=trace,runtime=trace"` to your filter configuration.
 
   + Also, ensure you have not enabled any of the [compile time filter
     features][compile_time_filters] in your `Cargo.toml`.
```

**File**: `console-subscriber/src/lib.rs` (modified, +1/-36)
```diff
@@ -15,10 +15,7 @@ use std::{
 use thread_local::ThreadLocal;
 #[cfg(unix)]
 use tokio::net::UnixListener;
-use tokio::{
-    sync::{mpsc, oneshot},
-    task::JoinHandle,
-};
+use tokio::sync::{mpsc, oneshot};
 #[cfg(unix)]
 use tokio_stream::wrappers::UnixListenerStream;
 use tracing_core::{
@@ -1187,38 +1184,6 @@ pub struct ServerParts {
     pub aggregator: Aggregator,
 }
 
-/// Aggregator handle.
-///
-/// This object is returned from [`Server::into_parts`]. It can be
-/// used to abort the aggregator task.
-///
-/// The aggregator collects the traces that implement the async runtime
-/// being observed and prepares them to be served by the gRPC server.
-///
-/// Normally, if the server, started with [`Server::serve`] or
-/// [`Server::serve_with`] stops for any reason, the aggregator is aborted,
-/// hoewver, if the server was started with the [`InstrumentServer`] returned
-/// from [`Server::into_parts`], then it is the responsibility of the user
-/// of the API to stop the aggregator task by calling [`abort`] on this
-/// object.
-///
-/// [`abort`]: fn@crate::AggregatorHandle::abort
-pub struct AggregatorHandle {
-    join_handle: JoinHandle<()>,
-}
-
-impl AggregatorHandle {
-    /// Aborts the task running this aggregator.
-    ///
-    /// To avoid having a disconnected aggregator running forever, this
-    /// method should be called when the [`tonic::transport::Server`] started
-    /// with the [`InstrumentServer`] also returned from [`Server::into_parts`]
-    /// stops running.
-    pub fn abort(&mut self) {
-        self.join_handle.abort();
-    }
-}
-
 #[tonic::async_trait]
 impl proto::instrument::instrument_server::Instrument for Server {
     type WatchUpdatesStream =
```

**File**: `console-subscriber/src/record.rs` (modified, +3/-0)
```diff
@@ -83,6 +83,9 @@ fn record_io(file: File, rx: Receiver<Event>) -> io::Result<()> {
     use std::io::{BufWriter, Write};
 
     fn write<T: Serialize>(mut file: &mut BufWriter<File>, val: &T) -> io::Result<()> {
+        // Clippy throws a false positive here. We can't actually pass the owned `file` to
+        // `to_writer` because we need it again in the line blow.
+        #[allow(clippy::needless_borrows_for_generic_args)]
         serde_json::to_writer(&mut file, val)?;
         file.write_all(b"\n")
     }
```

---

### Incident Patch 12: `9205e159` (2024-07-24)
**Commit Message**: fix(console): avoid crash when accessing selected item (#570)

We should check the length before using the index to access it.

Closes #565

Test locally:

https://github.com/tokio-rs/console/assets/29879298/5c4fd5da-e1c7-490b-bd67-1257972076d3

But it is difficult to view it, you can try it by following the steps from the issue.

**File**: `tokio-console/src/view/mod.rs` (modified, +3/-3)
```diff
@@ -132,7 +132,7 @@ impl View {
                 // mutate the currently selected view.
                 match event {
                     key!(Enter) => {
-                        if let Some(task) = self.tasks_list.selected_item().upgrade() {
+                        if let Some(task) = self.tasks_list.selected_item() {
                             update_kind = UpdateKind::SelectTask(task.borrow().span_id());
                             self.state = TaskInstance(self::task::TaskView::new(
                                 task,
@@ -149,7 +149,7 @@ impl View {
             ResourcesList => {
                 match event {
                     key!(Enter) => {
-                        if let Some(res) = self.resources_list.selected_item().upgrade() {
+                        if let Some(res) = self.resources_list.selected_item() {
                             update_kind = UpdateKind::SelectResource(res.borrow().span_id());
                             self.state = ResourceInstance(self::resource::ResourceView::new(res));
                         }
@@ -169,7 +169,7 @@ impl View {
                         update_kind = UpdateKind::Other;
                     }
                     key!(Enter) => {
-                        if let Some(op) = view.async_ops_table.selected_item().upgrade() {
+                        if let Some(op) = view.async_ops_table.selected_item() {
                             if let Some(task_id) = op.borrow().task_id() {
                                 let task = self
                                     .tasks_list
```

**File**: `tokio-console/src/view/table.rs` (modified, +13/-9)
```diff
@@ -13,7 +13,7 @@ use ratatui::{
 use std::convert::TryFrom;
 
 use std::cell::RefCell;
-use std::rc::Weak;
+use std::rc::{Rc, Weak};
 
 pub(crate) trait TableList<const N: usize> {
     type Row;
@@ -154,18 +154,22 @@ impl<T: TableList<N>, const N: usize> TableListState<T, N> {
         self.scroll_with(|_, _| 0)
     }
 
-    pub(in crate::view) fn selected_item(&self) -> Weak<RefCell<T::Row>> {
+    pub(in crate::view) fn selected_item(&self) -> Option<Rc<RefCell<T::Row>>> {
         self.table_state
             .selected()
-            .map(|i| {
-                let selected = if self.sort_descending {
-                    i
+            .and_then(|i| {
+                if self.sort_descending {
+                    if i < self.sorted_items.len() {
+                        Some(self.sorted_items[i].clone())
+                    } else {
+                        None
+                    }
                 } else {
-                    self.sorted_items.len() - i - 1
-                };
-                self.sorted_items[selected].clone()
+                    let adjusted_index = self.sorted_items.len().checked_sub(i + 1)?;
+                    self.sorted_items.get(adjusted_index).cloned()
+                }
             })
-            .unwrap_or_default()
+            .and_then(|weak| weak.upgrade())
     }
 
     pub(in crate::view) fn render(
```

---

### Incident Patch 13: `6ad0def9` (2024-07-03)
**Commit Message**: fix: handle Windows path correctly (#555)

We need to make truncate_registry_path can
handle Windows path as well.
Because tokio-console can connect to any
server from different platforms,
so we use the same path separator to have the same experience.

**File**: `tokio-console/src/state/mod.rs` (modified, +69/-10)
```diff
@@ -504,22 +504,42 @@ impl Attribute {
     }
 }
 
+// A naive way to determine if a path is a Windows path.
+// If the path has a drive letter and more backslashes than forward slashes, it's a Windows path.
+fn is_windows_path(path: &str) -> bool {
+    use once_cell::sync::OnceCell;
+    use regex::Regex;
+
+    static REGEX: OnceCell<Regex> = OnceCell::new();
+    let regex = REGEX.get_or_init(|| Regex::new(r"^[a-zA-Z]:\\").expect("failed to compile regex"));
+    let has_drive_letter = regex.is_match(path);
+    let slash_count = path.chars().filter(|&c| c == '/').count();
+    let backslash_count = path.chars().filter(|&c| c == '\\').count();
+    has_drive_letter && backslash_count > slash_count
+}
+
 fn truncate_registry_path(s: String) -> String {
     use once_cell::sync::OnceCell;
     use regex::Regex;
     use std::borrow::Cow;
 
     static REGEX: OnceCell<Regex> = OnceCell::new();
     let regex = REGEX.get_or_init(|| {
-        Regex::new(r".*/\.cargo(/registry/src/[^/]*/|/git/checkouts/)")
+        Regex::new(r".*[/\\]\.cargo[/\\](registry[/\\]src[/\\][^/\\]*[/\\]|git[/\\]checkouts[/\\])")
             .expect("failed to compile regex")
     });
 
-    return match regex.replace(&s, "<cargo>/") {
+    let rep = if is_windows_path(&s) {
+        "<cargo>\\"
+    } else {
+        "<cargo>/"
+    };
+
+    match regex.replace(&s, rep) {
         Cow::Owned(s) => s,
         // String was not modified, return the original.
-        Cow::Borrowed(_) => s.to_string(),
-    };
+        Cow::Borrowed(_) => s,
+    }
 }
 
 fn format_location(loc: Option<proto::Location>) -> String {
@@ -586,30 +606,69 @@ mod tests {
     #[test]
     fn test_format_location_macos() {
         // macOS style paths.
-        let location4 = proto::Location {
+        let location1 = proto::Location {
             file: Some("/Users/user/.cargo/registry/src/github.com-1ecc6299db9ec823/tokio-1.0.1/src/lib.rs".to_string()),
             ..Default::default()
         };
-        let location5 = proto::Location {
+        let location2 = proto::Location {
             file: Some("/Users/user/.cargo/git/checkouts/tokio-1.0.1/src/lib.rs".to_string()),
             ..Default::default()
         };
-        let location6 = proto::Location {
+        let location3 = proto::Location {
             file: Some("/Users/user/projects/tokio-1.0.1/src/lib.rs".to_string()),
             ..Default::default()
         };
 
         assert_eq!(
-            format_location(Some(location4)),
+            format_location(Some(location1)),
             "<cargo>/tokio-1.0.1/src/lib.rs"
         );
         assert_eq!(
-            format_location(Some(location5)),
+            format_location(Some(location2)),
             "<cargo>/tokio-1.0.1/src/lib.rs"
         );
         assert_eq!(
-            format_location(Some(location6)),
+            format_location(Some(location3)),
             "/Users/user/projects/tokio-1.0.1/src/lib.rs"
         );
     }
+
+    #[test]
+    fn test_format_location_windows() {
+        // Windows style paths.
+        let location1 = proto::Location {
+            file: Some(
+                "C:\\Users\\user\\.cargo\\registry\\src\\github.com-1ecc6299db9ec823\\tokio-1.0.1\\src\\lib.rs"
+                    .to_string(),
+            ),
+            ..Default::default()
+        };
+
+        let location2 = proto::Location {
+            file: Some(
+                "C:\\Users\\user\\.cargo\\git\\checkouts\\tokio-1.0.1\\src\\lib.rs".to_string(),
+            ),
+            ..Default::default()
+        };
+
+        let location3 = proto::Location {
+            file: Some("C:\\Users\\user\\projects\\tokio-1.0.1\\src\\lib.rs".to_string()),
+            ..Default::default()
+        };
+
+        assert_eq!(
+            format_location(Some(location1)),
+            "<cargo>\\tokio-1.0.1\\src\\lib.rs"
+        );
+
+        assert_eq!(
+            format_location(Some(location2)),
+            "<cargo>\\tokio-1.0.1\\src\\lib.rs"
+        );
+
+        assert_eq!(
+            format_location(Some(location3)),
+            "C:\\Users\\user\\projects\\tokio-1.0.1\\src\\lib.rs"
+        );
+    }
 }
```

---

### Incident Patch 14: `5bdd1f2e` (2024-06-21)
**Commit Message**: chore(deps-dev): bump braces from 3.0.2 to 3.0.3 (#563)

Bumps [braces](https://github.com/micromatch/braces) from 3.0.2 to 3.0.3.
- [Changelog](https://github.com/micromatch/braces/blob/master/CHANGELOG.md)
- [Commits](https://github.com/micromatch/braces/compare/3.0.2...3.0.3)

---
updated-dependencies:
- dependency-name: braces
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `console-subscriber/examples/grpc_web/app/package-lock.json` (modified, +7/-7)
```diff
@@ -1787,12 +1787,12 @@
       }
     },
     "node_modules/braces": {
-      "version": "3.0.2",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.2.tgz",
-      "integrity": "sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==",
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
       "dev": true,
       "dependencies": {
-        "fill-range": "^7.0.1"
+        "fill-range": "^7.1.1"
       },
       "engines": {
         "node": ">=8"
@@ -2379,9 +2379,9 @@
       }
     },
     "node_modules/fill-range": {
-      "version": "7.0.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.0.1.tgz",
-      "integrity": "sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==",
+      "version": "7.1.1",
+      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
       "dev": true,
       "dependencies": {
         "to-regex-range": "^5.0.1"
```

---

### Incident Patch 15: `0c28c9c0` (2024-06-20)
**Commit Message**: fix(console): tidy Cargo.lock (#562)

tokio-console would be 0.1.11.

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -1843,7 +1843,7 @@ dependencies = [
 
 [[package]]
 name = "tokio-console"
-version = "0.2.0"
+version = "0.1.11"
 dependencies = [
  "clap",
  "clap_complete",
```

#### Recent Merged Pull Requests:
- **PR #676** (2026-08-07): refactor: resolve clippy lints (@dtolnay)
- **PR #675** (2026-08-08): Update ratatui from 0.29 to 0.30 (@dtolnay)
- **PR #668** (closed): chore: bump js-yaml from 4.1.0 to 4.2.0 in /console-subscriber/examples/grpc_web/app (@dependabot[bot])
- **PR #663** (closed): chore: bump vite and @vitejs/plugin-react in /console-subscriber/examples/grpc_web/app (@dependabot[bot])
- **PR #658** (2026-03-28): chore: raise required compiler to rust 1.84 (@dtolnay)
- **PR #657** (2026-03-28): Resolve clippy lints (@dtolnay)
- **PR #656** (closed): Replace manual Default impls with #[derive(Default)] (@ghost)
- **PR #654** (2026-03-28): chore(deps): bump bytes from 1.10.1 to 1.11.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
