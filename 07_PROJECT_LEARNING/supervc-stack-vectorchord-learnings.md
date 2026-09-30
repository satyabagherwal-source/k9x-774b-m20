# Forensic Learning Record (Deep Inspection): supervc-stack/VectorChord

> **Canonical Artifact**: `07_PROJECT_LEARNING/supervc-stack-vectorchord-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/supervc-stack/VectorChord](https://github.com/supervc-stack/VectorChord))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:38:04.252Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `supervc-stack/VectorChord`
- **Description**: Scalable, fast, and disk-friendly vector search in Postgres, the successor of pgvecto.rs.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 1808 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/always_equal/src/lib.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

use std::cmp::Ordering;
use std::hash::Hash;

#[derive(Debug, Clone, Copy, Default)]
#[repr(transparent)]
pub struct AlwaysEqual<T>(pub T);

impl<T> PartialEq for AlwaysEqual<T> {
    #[inline(always)]
    fn eq(&self, _: &Self) -> bool {
        true
    }
}

impl<T> Eq for AlwaysEqual<T> {}

#[allow(clippy::non_canonical_partial_ord_impl)]
impl<T> PartialOrd for AlwaysEqual<T> {
    #[inline(always)]
    fn partial_cmp(&self, _: &Self) -> Option<Ordering> {
        Some(Ordering::Equal)
    }
}

impl<T> Ord for AlwaysEqual<T> {
    #[inline(always)]
    fn cmp(&self, _: &Self) -> Ordering {
        Ordering::Equal
    }
}

impl<T> Hash for AlwaysEqual<T> {
    #[inline(always)]
    fn hash<H: std::hash::Hasher>(&self, _: &mut H) {}
}

```

### Core Architecture Module: `crates/feistel/src/lib.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

pub fn feistel<I>(width: u32, x: I, round: u32, secret: impl Fn(u32, I) -> I) -> I
where
    I: Copy,
    I: Ord,
    I: std::ops::Add<Output = I>,
    I: std::ops::Sub<Output = I>,
    I: std::ops::BitAnd<Output = I>,
    I: std::ops::BitOr<Output = I>,
    I: std::ops::BitXor<Output = I>,
    I: std::ops::Shl<u32, Output = I>,
    I: std::ops::Shr<u32, Output = I>,
    I: Zero,
    I: One,
    I: std::fmt::Debug,
{
    assert_eq!(width % 2, 0);
    assert_eq!(x >> width, I::zero());

    let half_width = width >> 1;
    let half_mask = (I::one() << half_width) - I::one();

    let mut left = (x >> half_width) & half_mask;
    let mut right = x & half_mask;

    for i in 0..round {
        (left, right) = (right, left ^ (secret(i, right) & half_mask));
    }

    (left << half_width) | right
}

pub trait Zero {
    fn zero() -> Self;
}

pub trait One {
    fn one() -> Self;
}

macro_rules! impl_traits {
    ($t:ty) => {
        impl Zero for $t {
            fn zero() -> Self {
                0
            }
        }

        impl One for $t {
            fn one() -> Self {
                1
            }
        }
    };
}

impl_traits!(u8);
impl_traits!(u16);
impl_traits!(u32);
impl_traits!(u64);
impl_traits!(u128);

// This is a standalone crate, simply because we want to run tests for it.

#[test]
fn is_a_permutation() {
    let key_0 = [7u8; _];
    let key_1 = [8u8; _];
    let secret = move |round: u32, x: u32| {
        let buffer = [round.to_le_bytes(), x.to_le_bytes(), key_0, key_1];
        wyhash::wyhash(buffer.as_flattened(), 0) as u32
    };
    for width in (0..if cfg!(not(miri)) { 20 } else { 10 }).step_by(2) {
        let mut y = Vec::new();
        for x in 0..1 << width {
            y.push(feistel::<u32>(width, x, 8, secret));
        }
        if width <= 8 {
            eprintln!("feistel({width}, _, 8, *) = {y:?}");
        }
        y.sort_unstable();
        for x in 0..1 << width {
            assert_eq!(y[x as usize], x);
        }
    }
}

#[test]
fn sample() {
    let n = if cfg!(not(miri)) { 6370_u32 } else { 637_u32 };
    let width = (n.ilog2() + 1).next_multiple_of(2);
    let key_0 = rand::RngExt::random(&mut rand::rng());
    let key_1 = rand::RngExt::random(&mut rand::rng());
    let secret = move |round: u32, x: u32| {
        let buffer = [round.to_le_bytes(), x.to_le_bytes(), key_0, key_1];
        wyhash::wyhash(buffer.as_flattened(), 0) as u32
    };
    let mut permutation = (0..1 << width)
        .map(move |i| feistel(width, i, 8, secret))
        .filter(move |&x| x < n);
    for _ in 0..n {
        assert!(permutation.next().is_some());
    }
    assert_eq!(permutation.next(), None);
}

```

### Core Architecture Module: `crates/index/src/accessor.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

use distance::Distance;
use rabitq::byte::CodeMetadata;
use simd::{Floating, f16};
use std::marker::PhantomData;
use vector::rabitq4::Rabitq4Owned;
use vector::rabitq8::Rabitq8Owned;
use vector::vect::VectOwned;

#[derive(Debug, Clone, Copy)]
pub struct L2S;

#[derive(Debug, Clone, Copy)]
pub struct Dot;

pub trait Accessor2<E0, E1, M0, M1> {
    type Output;
    fn push(&mut self, input: &[E0], target: &[E1]);
    fn finish(self, input: M0, target: M1) -> Self::Output;
}

impl<E0, E1, M0: Copy, M1: Copy> Accessor2<E0, E1, M0, M1> for () {
    type Output = ();

    #[inline(always)]
    fn push(&mut self, _: &[E0], _: &[E1]) {}

    #[inline(always)]
    fn finish(self, _: M0, _: M1) -> Self::Output {}
}

impl<E0, E1, M0: Copy, M1: Copy, A: Accessor2<E0, E1, M0, M1>> Accessor2<E0, E1, M0, M1> for (A,) {
    type Output = (A::Output,);

    #[inline(always)]
    fn push(&mut self, input: &[E0], target: &[E1]) {
        self.0.push(input, target);
    }

    #[inline(always)]
    fn finish(self, input: M0, target: M1) -> Self::Output {
        (self.0.finish(input, target),)
    }
}

impl<E0, E1, M0: Copy, M1: Copy, A: Accessor2<E0, E1, M0, M1>, B: Accessor2<E0, E1, M0, M1>>
    Accessor2<E0, E1, M0, M1> for (A, B)
{
    type Output = (A::Output, B::Output);

    #[inline(always)]
    fn push(&mut self, input: &[E0], target: &[E1]) {
        self.0.push(input, target);
        self.1.push(input, target);
    }

    #[inline(always)]
    fn finish(self, input: M0, target: M1) -> Self::Output {
        (self.0.finish(input, target), self.1.finish(input, target))
    }
}

pub trait Accessor1<E, M> {
    type Output;
    fn push(&mut self, input: &[E]);
    fn finish(self, input: M) -> Self::Output;
}

impl<E, M: Copy> Accessor1<E, M> for () {
    type Output = ();

    #[inline(always)]
    fn push(&mut self, _: &[E]) {}

    #[inline(always)]
    fn finish(self, _: M) -> Self::Output {}
}

impl<E, M: Copy, A> Accessor1<E, M> for (A,)
where
    A: Accessor1<E, M>,
{
    type Output = (A::Output,);

    #[inline(always)]
    fn push(&mut self, input: &[E]) {
        self.0.push(input);
    }

    #[inline(always)]
    fn finish(self, input: M) -> Self::Output {
        (self.0.finish(input),)
    }
}

impl<E, M: Copy, A, B> Accessor1<E, M> for (A, B)
where
    A: Accessor1<E, M>,
    B: Accessor1<E, M>,
{
    type Output = (A::Output, B::Output);

    #[inline(always)]
    fn push(&mut self, input: &[E]) {
        self.0.push(input);
        self.1.push(input);
    }

    #[inline(always)]
    fn finish(self, input: M) -> Self::Output {
        (self.0.finish(input), self.1.finish(input))
    }
}

pub struct FunctionalAccessor<T, P, F> {
    data: T,
    p: P,
    f: F,
}

impl<T, P, F> FunctionalAccessor<T, P, F> {
    #[inline(always)]
    pub fn new(data: T, p: P, f: F) -> Self {
        Self { data, p, f }
    }
}

impl<E, M, T, P, F, R> Accessor1<E, M> for FunctionalAccessor<T, P, F>
where
    P: for<'a> FnMut(&'a mut T, &'a [E]),
    F: FnOnce(T, M) -> R,
{
    type Output = R;

    #[inline(always)]
    fn push(&mut self, input: &[E]) {
        (self.p)(&mut self.data, input);
    }

    #[inline(always)]
    fn finish(self, input: M) -> Self::Output {
        (self.f)(self.data, input)
    }
}

pub struct LAccess<'a, E, M, A> {
    elements: &'a [E],
    metadata: M,
    accessor: A,
}

impl<'a, E, M, A> LAccess<'a, E, M, A> {
    #[inline(always)]
    pub fn new((elements, metadata): (&'a [E], M), accessor: A) -> Self {
        Self {
            elements,
            metadata,
            accessor,
        }
    }
}

impl<E0, E1, M0, M1, A: Accessor2<E0, E1, M0, M1>> Accessor1<E1, M1> for LAccess<'_, E0, M0, A> {
    type Output = A::Output;

    #[inline(always)]
    fn push(&mut self, rhs: &[E1]) {
        let (lhs, elements) = self.elements.split_at(rhs.len());
        self.accessor.push(lhs, rhs);
        self.elements = elements;
    }

    #[inline(always)]
    fn finish(self, rhs: M1) -> Self::Output {
        assert!(self.elements.is_empty(), "goal is shorter than expected");
        self.accessor.finish(self.metadata, rhs)
    }
}

pub struct RAccess<'a, E, M, A> {
    elements: &'a [E],
    metadata: M,
    accessor: A,
}

impl<'a, E, M, A> RAccess<'a, E, M, A> {
    #[inline(always)]
    pub fn new((elements, metadata): (&'a [E], M), accessor: A) -> Self {
        Self {
            elements,
            metadata,
            accessor,
        }
    }
}

impl<E0, E1, M0, M1, A: Accessor2<E0, E1, M0, M1>> Accessor1<E0, M0> for RAccess<'_, E1, M1, A> {
    type Output = A::Output;

    #[inline(always)]
    fn push(&mut self, lhs: &[E0]) {
        let (rhs, elements) = self.elements.split_at(lhs.len());
        self.accessor.push(lhs, rhs);
        self.elements = elements;
    }

    #[inline(always)]
    fn finish(self, lhs: M0) -> Self::Output {
        assert!(self.elements.is_empty(), "goal is shorter than expected");
        self.accessor.finish(lhs, self.metadata)
    }
}

pub trait TryAccessor1<E, M>: Sized {
    type Output;
    #[must_use]
    fn push(&mut self, input: &[E]) -> Option<()>;
    #[must_use]
    fn finish(self, input: M) -> Option<Self::Output>;
}

impl<E, M: Copy> TryAccessor1<E, M> for () {
    type Output = ();

    #[inline(always)]
    fn push(&mut self, _: &[E]) -> Option<()> {
        Some(())
    }

    #[inline(always)]
    fn finish(self, _: M) -> Option<Self::Output> {
        Some(())
    }
}

impl<E, M: Copy, A> TryAccessor1<E, M> for (A,)
where
    A: TryAccessor1<E, M>,
{
    type Output = (A::Output,);

    #[inline(always)]
    fn push(&mut self, input: &[E]) -> Option<()> {
        self.0.push(input)?;
        Some(())
    }

    #[inline(always)]
    fn finish(self, input: M) -> Option<Self::Output> {
        Some((self.0.finish(input)?,))
    }
}

impl<E, M: Copy, A, B> TryAccessor1<E, M> for (A, B)
where
    A: TryAccessor1<E, M>,
    B: TryAccessor1<E, M>,
{
    type Output = (A::Output, B::Output);

    #[inline(always)]
    fn push(&mut self, input: &[E]) -> Option<()> {
        self.0.push(input)?;
        self.1.push(input)?;
        Some(())
    }

    #[inline(always)]
    fn finish(self, input: M) -> Option<Self::Output> {
        Some((self.0.finish(input)?, self.1.finish(input)?))
    }
}

pub struct LTryAccess<'a, E, M, A> {
    elements: &'a [E],
    metadata: M,
    accessor: A,
}

impl<'a, E, M, A> LTryAccess<'a, E, M, A> {
    #[inline(always)]
    pub fn new((elements, metadata): (&'a [E], M), accessor: A) -> Self {
        Self {
            elements,
            metadata,
            accessor,
        }
    }
}

impl<E0, E1, M0, M1, A: Accessor2<E0, E1, M0, M1>> TryAccessor1<E1, M1>
    for LTryAccess<'_, E0, M0, A>
{
    type Output = A::Output;

    #[inline(always)]
    fn push(&mut self, rhs: &[E1]) -> Option<()> {
        let (lhs, elements) = self.elements.split_at_checked(rhs.len())?;
        self.accessor.push(lhs, rhs);
        self.elements = elements;
        Some(())
    }

    #[inline(always)]
    fn finish(self, rhs: M1) -> Option<Self::Output> {
        if !self.elements.is_empty() {
            return None;
        }
        Some(self.accessor.finish(self.metadata, rhs))
    }
}

#[derive(Debug)]
pub struct DistanceAccessor<V, D>(f32, PhantomData<fn(V) -> V>, PhantomData<fn(D) -> D>);

impl<V, D> Default for DistanceAccessor<V, D> {
    #[inline(always)]
    fn default() -> Self {
        Self(0.0, PhantomData, 
```

### Core Architecture Module: `crates/index/src/bump.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

pub trait Bump: 'static {
    #[allow(clippy::mut_from_ref)]
    fn alloc<T: Copy>(&self, value: T) -> &mut T;
    #[allow(clippy::mut_from_ref)]
    fn alloc_slice<T: Copy>(&self, slice: &[T]) -> &mut [T];
}

impl Bump for bumpalo::Bump {
    #[inline]
    fn alloc<T: Copy>(&self, value: T) -> &mut T {
        self.alloc(value)
    }

    #[inline]
    fn alloc_slice<T: Copy>(&self, slice: &[T]) -> &mut [T] {
        self.alloc_slice_copy(slice)
    }
}

```

### Core Architecture Module: `crates/index/src/fetch.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

use crate::packed::PackedRefMut;
use always_equal::AlwaysEqual;

pub type BorrowedIter<'b> = small_iter::borrowed::Iter<'b, u32, 1>;

pub trait Fetch<'b> {
    type Iter: ExactSizeIterator<Item = u32> + 'b;
    #[must_use]
    fn fetch(&self) -> Self::Iter;
}

impl Fetch<'_> for u32 {
    type Iter = std::iter::Once<u32>;
    #[inline(always)]
    fn fetch(&self) -> std::iter::Once<u32> {
        std::iter::once(*self)
    }
}

impl<'b, T, A, B, W: 'b + PackedRefMut<T = (A, B, BorrowedIter<'b>)>> Fetch<'b>
    for (T, AlwaysEqual<W>)
{
    type Iter = BorrowedIter<'b>;
    #[inline(always)]
    fn fetch(&self) -> BorrowedIter<'b> {
        let (.., list) = self.1.0.get();
        *list
    }
}

impl<'b, T, A, B, C> Fetch<'b> for (T, AlwaysEqual<&mut (A, B, C, BorrowedIter<'b>)>) {
    type Iter = BorrowedIter<'b>;
    #[inline(always)]
    fn fetch(&self) -> BorrowedIter<'b> {
        let (_, AlwaysEqual((.., list))) = self;
        *list
    }
}

impl<T> Fetch<'_> for (T, AlwaysEqual<(u32, u16)>) {
    type Iter = std::iter::Once<u32>;
    #[inline(always)]
    fn fetch(&self) -> std::iter::Once<u32> {
        let (_, AlwaysEqual((x, _))) = self;
        std::iter::once(*x)
    }
}

impl Fetch<'_> for (u32, u16) {
    type Iter = std::iter::Once<u32>;
    #[inline(always)]
    fn fetch(&self) -> std::iter::Once<u32> {
        std::iter::once(self.0)
    }
}

impl<T> Fetch<'_> for (T, AlwaysEqual<((u32, u16), (u32, u16))>) {
    type Iter = std::iter::Once<u32>;
    #[inline(always)]
    fn fetch(&self) -> std::iter::Once<u32> {
        let (_, AlwaysEqual(((x, _), _))) = self;
        std::iter::once(*x)
    }
}

pub trait Fetch1 {
    fn fetch_1(&self) -> u32;
}

#[repr(transparent)]
pub struct Fetch1Iter<I> {
    iter: I,
}

impl<I: Iterator> Iterator for Fetch1Iter<I>
where
    I::Item: Fetch1,
{
    type Item = u32;

    #[inline(always)]
    fn next(&mut self) -> Option<Self::Item> {
        self.iter.next().map(|x| x.fetch_1())
    }

    #[inline(always)]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.iter.size_hint()
    }
}

impl<I: ExactSizeIterator> ExactSizeIterator for Fetch1Iter<I> where I::Item: Fetch1 {}

impl<'b, T, F: Fetch1 + Copy> Fetch<'b> for (T, AlwaysEqual<&'b [F]>) {
    type Iter = Fetch1Iter<std::iter::Copied<std::slice::Iter<'b, F>>>;

    #[inline(always)]
    fn fetch(&self) -> Self::Iter {
        Fetch1Iter {
            iter: self.1.0.iter().copied(),
        }
    }
}

impl<'b, T, U, F: Fetch1 + Copy> Fetch<'b> for (T, AlwaysEqual<(&'b [F], U)>) {
    type Iter = Fetch1Iter<std::iter::Copied<std::slice::Iter<'b, F>>>;

    #[inline(always)]
    fn fetch(&self) -> Self::Iter {
        Fetch1Iter {
            iter: self.1.0.0.iter().copied(),
        }
    }
}

```

### Core Architecture Module: `crates/index/src/lib.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

// pub mod accessor;
pub mod bump;
pub mod fetch;
pub mod packed;
pub mod prefetcher;
pub mod relation;
pub mod tuples;

```

### Core Architecture Module: `crates/index/src/packed.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

pub trait PackedRefMut {
    type T;
    fn get(&self) -> &Self::T;
    fn get_mut(&mut self) -> &mut Self::T;
}

impl<T> PackedRefMut for &mut T {
    type T = T;
    #[inline(always)]
    fn get(&self) -> &T {
        self
    }
    #[inline(always)]
    fn get_mut(&mut self) -> &mut T {
        self
    }
}

#[repr(Rust, packed(4))]
pub struct PackedRefMut4<'b, T>(pub &'b mut T);

impl<'b, T> PackedRefMut for PackedRefMut4<'b, T> {
    type T = T;
    #[inline(always)]
    fn get(&self) -> &T {
        self.0
    }
    #[inline(always)]
    fn get_mut(&mut self) -> &mut T {
        self.0
    }
}

#[repr(Rust, packed(8))]
pub struct PackedRefMut8<'b, T>(pub &'b mut T);

impl<'a, T> PackedRefMut for PackedRefMut8<'a, T> {
    type T = T;
    #[inline(always)]
    fn get(&self) -> &T {
        self.0
    }
    #[inline(always)]
    fn get_mut(&mut self) -> &mut T {
        self.0
    }
}

```

### Core Architecture Module: `crates/index/src/prefetcher.rs`
```
// This software is licensed under a dual license model:
//
// GNU Affero General Public License v3 (AGPLv3): You may use, modify, and
// distribute this software under the terms of the AGPLv3.
//
// Elastic License v2 (ELv2): You may also use, modify, and distribute this
// software under the Elastic License v2, which has specific restrictions.
//
// We welcome any commercial collaboration or support. For inquiries
// regarding the licenses, please contact us at:
// vectorchord-inquiry@tensorchord.ai
//
// Copyright (c) 2025-2026 TensorChord Inc.

use crate::fetch::Fetch;
use crate::relation::{
    Hints, ReadStream, RelationPrefetch, RelationRead, RelationReadStream, RelationReadTypes,
};
use dary_heap::DaryHeap;
use std::collections::{BinaryHeap, VecDeque};

pub const WINDOW_SIZE: usize = 32;
const _: () = assert!(WINDOW_SIZE > 0);

pub trait Sequence {
    type Item;
    type Inner: Iterator<Item = Self::Item>;
    #[must_use]
    fn next(&mut self) -> Option<Self::Item>;
    #[must_use]
    fn peek(&mut self) -> Option<&Self::Item>;
    #[must_use]
    fn into_inner(self) -> Self::Inner;
}

impl<T: Ord> Sequence for BinaryHeap<T> {
    type Item = T;
    type Inner = std::vec::IntoIter<T>;
    #[inline]
    fn next(&mut self) -> Option<T> {
        self.pop()
    }
    #[inline]
    fn peek(&mut self) -> Option<&T> {
        (self as &Self).peek()
    }
    #[inline]
    fn into_inner(self) -> Self::Inner {
        self.into_vec().into_iter()
    }
}

impl<const N: usize, T: Ord> Sequence for DaryHeap<T, N> {
    type Item = T;
    type Inner = std::vec::IntoIter<T>;
    #[inline]
    fn next(&mut self) -> Option<T> {
        self.pop()
    }
    #[inline]
    fn peek(&mut self) -> Option<&T> {
        (self as &Self).peek()
    }
    #[inline]
    fn into_inner(self) -> Self::Inner {
        self.into_vec().into_iter()
    }
}

impl<I: Iterator> Sequence for std::iter::Peekable<I> {
    type Item = I::Item;
    type Inner = std::iter::Peekable<I>;
    #[inline]
    fn next(&mut self) -> Option<I::Item> {
        Iterator::next(self)
    }
    #[inline]
    fn peek(&mut self) -> Option<&I::Item> {
        self.peek()
    }
    #[inline]
    fn into_inner(self) -> Self::Inner {
        self
    }
}

impl<T> Sequence for VecDeque<T> {
    type Item = T;
    type Inner = std::collections::vec_deque::IntoIter<T>;
    #[inline]
    fn next(&mut self) -> Option<T> {
        self.pop_front()
    }
    #[inline]
    fn peek(&mut self) -> Option<&T> {
        self.front()
    }
    #[inline]
    fn into_inner(self) -> Self::Inner {
        self.into_iter()
    }
}

pub trait Prefetcher<'b>: IntoIterator
where
    Self::Item: Fetch<'b>,
{
    type R: RelationRead + 'b;
    type Guards: ExactSizeIterator<Item = <Self::R as RelationReadTypes>::ReadGuard<'b>>;

    #[must_use]
    fn next(&mut self) -> Option<(Self::Item, Self::Guards)>;
    #[must_use]
    fn next_if(
        &mut self,
        predicate: impl FnOnce(&Self::Item) -> bool,
    ) -> Option<(Self::Item, Self::Guards)>;
}

pub struct PlainPrefetcher<'b, R, S: Sequence> {
    relation: &'b R,
    sequence: S,
}

impl<'b, R, S: Sequence> PlainPrefetcher<'b, R, S> {
    #[inline]
    pub fn new(relation: &'b R, sequence: S) -> Self {
        Self { relation, sequence }
    }
}

impl<'b, R, S: Sequence> IntoIterator for PlainPrefetcher<'b, R, S> {
    type Item = S::Item;

    type IntoIter = S::Inner;

    #[inline]
    fn into_iter(self) -> Self::IntoIter {
        self.sequence.into_inner()
    }
}

impl<'b, R: RelationRead, S: Sequence> Prefetcher<'b> for PlainPrefetcher<'b, R, S>
where
    S::Item: Fetch<'b>,
{
    type R = R;
    type Guards = PlainPrefetcherGuards<'b, R, <S::Item as Fetch<'b>>::Iter>;

    #[inline]
    fn next(
        &mut self,
    ) -> Option<(
        Self::Item,
        PlainPrefetcherGuards<'b, R, <S::Item as Fetch<'b>>::Iter>,
    )> {
        let e = self.sequence.next()?;
        let list = e.fetch();
        Some((
            e,
            PlainPrefetcherGuards {
                relation: self.relation,
                list,
            },
        ))
    }

    #[inline]
    fn next_if(
        &mut self,
        predicate: impl FnOnce(&Self::Item) -> bool,
    ) -> Option<(
        S::Item,
        PlainPrefetcherGuards<'b, R, <S::Item as Fetch<'b>>::Iter>,
    )> {
        if !predicate(self.sequence.peek()?) {
            return None;
        }
        let e = self.sequence.next()?;
        let list = e.fetch();
        Some((
            e,
            PlainPrefetcherGuards {
                relation: self.relation,
                list,
            },
        ))
    }
}

pub struct PlainPrefetcherGuards<'b, R, L> {
    relation: &'b R,
    list: L,
}

impl<'b, R: RelationRead, L: Iterator<Item = u32>> Iterator for PlainPrefetcherGuards<'b, R, L> {
    type Item = R::ReadGuard<'b>;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        let id = self.list.next()?;
        Some(self.relation.read(id))
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.list.size_hint()
    }
}

impl<'b, R: RelationRead, L: Iterator<Item = u32>> ExactSizeIterator
    for PlainPrefetcherGuards<'b, R, L>
{
}

pub struct SimplePrefetcher<'b, R, S: Sequence> {
    relation: &'b R,
    window: VecDeque<S::Item>,
    sequence: S,
}

impl<'b, R, S: Sequence> SimplePrefetcher<'b, R, S> {
    #[inline]
    pub fn new(relation: &'b R, sequence: S) -> Self {
        Self {
            relation,
            window: VecDeque::new(),
            sequence,
        }
    }
}

impl<'b, R, S: Sequence> IntoIterator for SimplePrefetcher<'b, R, S> {
    type Item = S::Item;

    type IntoIter = std::iter::Chain<std::collections::vec_deque::IntoIter<S::Item>, S::Inner>;

    #[inline]
    fn into_iter(self) -> Self::IntoIter {
        self.window.into_iter().chain(self.sequence.into_inner())
    }
}

impl<'b, R: RelationRead + RelationPrefetch, S: Sequence> Prefetcher<'b>
    for SimplePrefetcher<'b, R, S>
where
    S::Item: Fetch<'b>,
{
    type R = R;
    type Guards = SimplePrefetcherGuards<'b, R, <S::Item as Fetch<'b>>::Iter>;

    #[inline]
    fn next(
        &mut self,
    ) -> Option<(
        Self::Item,
        SimplePrefetcherGuards<'b, R, <S::Item as Fetch<'b>>::Iter>,
    )> {
        while self.window.len() < WINDOW_SIZE
            && let Some(e) = self.sequence.next()
        {
            for id in e.fetch() {
                self.relation.prefetch(id);
            }
            self.window.push_back(e);
        }
        let e = self.window.pop_front()?;
        let list = e.fetch();
        Some((
            e,
            SimplePrefetcherGuards {
                relation: self.relation,
                list,
            },
        ))
    }

    #[inline]
    fn next_if(
        &mut self,
        predicate: impl FnOnce(&S::Item) -> bool,
    ) -> Option<(
        S::Item,
        SimplePrefetcherGuards<'b, R, <S::Item as Fetch<'b>>::Iter>,
    )> {
        while self.window.len() < WINDOW_SIZE
            && let Some(e) = self.sequence.next()
        {
            for id in e.fetch() {
                self.relation.prefetch(id);
            }
            self.window.push_back(e);
        }
        let e = self.window.pop_front_if(move |x| predicate(x))?;
        let list = e.fetch();
        Some((
            e,
            SimplePrefetcherGuards {
                relation: self.relation,
                list,
            },
        ))
    }
}

pub struct SimplePrefetcherGuards<'b, R, L> {
    relation: &'b R,
    list: L,
}

impl<'b, R: RelationRead, L: Iterator<Item = u32>> Iterator for SimplePrefetcherGuards<'b, R, L> {
    type Item = R::ReadGuard<'b>;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        let id = self.list.next()?;
        Some(self.relation.read(id))
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.list.size_hint()
    }
}

impl<'b, R: RelationRead, L
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #478** (2026-09-22): **feat(vchordrq): add pluggable exact MaxSim reranking**
  *Symptoms*: ## Summary  This is the second implementation slice proposed in Discussion #476.  It introduces a storage-independent exact MaxSim reranking boundary and a CPU reference backend. The reference tensor source reads the indexed expression from the PostgreSQL heap under the active scan snapshot; it does not introduce an external registry, network transport, GPU dependency, or quantized format.  ## User-visible behavior  - Existing behavior remains the default through `vchordrq.maxsim_backend = 'coarse_only'`. - Exact reranking is opt-in with `vchordrq.maxsim_backend = 'cpu_exact'`. - Exact mode requires an explicit positive `vchordrq.maxsim_candidate_limit`, bounded at 65,536. - Candidate generation remains the existing vchordrq MaxSim path. Only the bounded candidate set is rescored using the full heap tensor.  ## Architecture boundary  - `CandidateTensorSource` separates full-tensor retrieval from scoring. - `ExactMaxsimBackend` separates exact scoring from candidate generation and storage. - `HeapTensorSource` is the only source in this PR. - `CpuExactMaxsimBackend` is the only backend in this PR.  External tensor-source registration and any optional GPU process remain separate follow-up proposals, contingent on maintainer feedback.  ## Correctness and safety  - Uses the existing `HeapFetcher`, active PostgreSQL snapshot, and indexed-expression evaluation. - Rechecks the active scan qual before materializing a candidate tensor. - Rejects null, mismatched-kind, and mismatched-d
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > I have read the CLA Document and I hereby sign the CLA

- **Issue #477** (2026-09-22): **feat(vchordrq): estimate MaxSim planner cost**
  *Symptoms*: ## Summary  - persist the indexed vector/token count in unused `MetaTuple` padding without changing tuple offsets - update the count after index build and bulk deletion - add a MaxSim-specific planner model based on heap rows, indexed tokens, probes, query-token count, filters, and LIMIT - preserve the existing planner path for every non-MaxSim opfamily  This is the first focused implementation PR proposed in #476. It does not add an exact reranker, external tensor storage, a network protocol, or GPU code.  ## Compatibility  The statistic uses the existing 2-byte and 6-byte padding regions in the meta tuple. Compile-time offset assertions and unit tests protect the on-disk layout.  - Old indexes expose the statistic as `None`. - The planner falls back to a configurable average document-token count. - Build and subsequent vacuum/bulk-delete operations publish an exact count. - No REINDEX is required solely for compatibility.  The planner query-token and fallback document-token values are configurable until expression/page-level statistics are available.  ## Validation  - `cargo test -p vchordrq` - `cargo test --locked --workspace --exclude vchord --no-fail-fast` - PostgreSQL 16 release extension build through the repository `xtask` build   inside a clean PostgreSQL development container - `cargo fmt --all -- --check` - `git diff --check`  ## Review notes  The cost constants are intentionally conservative and hardware-independent. The model prices the eager token search and pag
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > > Thank you for your submission, we really appreciate it. Like many open-source projects, we ask that you sign our [Contributor License Agreement](https://gist.githubusercontent.com/gaocegege/92886a860e3648842e07651feb836719/raw/10663798a5e459707042a3d37bd6f89ac784dada/CLA.md) before we can accept your contribution. You can sign the CLA by just posting a Pull Request Comment same as the below format. >  > I have read the CLA Document and I hereby sign the CLA >  > You can retrigger this bot by commenting **recheck** in this Pull Request. Posted by the **CLA Assistant Lite bot**.  I have read the CLA Document and I hereby sign the CLA
  > I have read the CLA Document and I hereby sign the CLA

- **Issue #473** (2026-07-16): **Feature/tutti io pipeline**
  *Symptoms*: 

- **Issue #472** (2026-07-13): **Feature/tilemaxsim phase3**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <br/>Thank you for your submission, we really appreciate it. Like many open-source projects, we ask that you all sign our [Contributor License Agreement](https://gist.githubusercontent.com/gaocegege/92886a860e3648842e07651feb836719/raw/10663798a5e459707042a3d37bd6f89ac784dada/CLA.md) before we can accept your contribution. You can sign the CLA by just posting a Pull Request Comment same as the below format.<br/>    - - -    I have read the CLA Document and I hereby sign the CLA    - - -    **2** out of **3** committers have signed the CLA.<br/>:white_check_mark: (spenc-r)[https://github.com/spenc-r]<br/>:white_check_mark: (ameyypawar)[https://github.com/ameyypawar]<br/>:x: @CooperLee996<br/><sub>You can retrigger this bot by commenting **recheck** in this Pull Request. </sub><sub>Posted by the **CLA Assistant Lite bot**.</sub>

- **Issue #467** (2026-06-30): **build: fix target features for rustc 1.96**
  *Symptoms*: Currently, build of vchord fails on rustc 1.96 with `rustc-LLVM ERROR: Cannot select: intrinsic %llvm.x86.avx512.vpdpbusd.512`  This intrinsic is a part of `avx512f`, which doesn't seem to be enabled here. The way it worked previously is I guess because it was most likely implied by other `avx512` features  I haven't found the exact rustc bug, but it seems this kind of problems is not something new, and better avoided by specifying features explicitly  - https://github.com/rust-lang/rust/issues/134792 - https://github.com/rust-lang/rust/issues/116516 - https://github.com/rust-lang/rust/issues/125492 - https://github.com/rust-lang/rust/pull/121088
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > I have read the CLA Document and I hereby sign the CLA
  > It seems that it was not caused by rustc this time, but incorrect rustc packaging in nixos  This patch can be merged for correctness WRT implied features (`avx512f` is a part of `x86_64-v4` after all), but should not be actually a problem

- **Issue #465** (2026-07-30): **build(deps): bump actions/checkout from 6.0.2 to 7.0.0**
  *Symptoms*: Bumps [actions/checkout](https://github.com/actions/checkout) from 6.0.2 to 7.0.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/checkout/releases">actions/checkout's releases</a>.</em></p> <blockquote> <h2>v7.0.0</h2> <h2>What's Changed</h2> <ul> <li>block checking out fork pr for pull_request_target and workflow_run by <a href="https://github.com/aiqiaoy"><code>@​aiqiaoy</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2454">actions/checkout#2454</a></li> <li>Bump actions/publish-immutable-action from 0.0.3 to 0.0.4 in the minor-actions-dependencies group across 1 directory by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2458">actions/checkout#2458</a></li> <li>Bump flatted from 3.3.1 to 3.4.2 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2460">actions/checkout#2460</a></li> <li>Bump js-yaml from 4.1.0 to 4.2.0 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2461">actions/checkout#2461</a></li> <li>Bump <code>@​actions/core</code> and <code>@​actions/tool-cache</code> and Remove uuid by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2459
  **Post-Mortem & Fix Analysis**:
  > Superseded by #474.

- **Issue #462** (2026-06-25): **build(deps): bump actions/checkout from 6.0.2 to 6.0.3**
  *Symptoms*: Bumps [actions/checkout](https://github.com/actions/checkout) from 6.0.2 to 6.0.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/checkout/releases">actions/checkout's releases</a>.</em></p> <blockquote> <h2>v6.0.3</h2> <h2>What's Changed</h2> <ul> <li>Update changelog by <a href="https://github.com/ericsciple"><code>@​ericsciple</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2357">actions/checkout#2357</a></li> <li>fix: expand merge commit SHA regex and add SHA-256 test cases by <a href="https://github.com/yaananth"><code>@​yaananth</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2414">actions/checkout#2414</a></li> <li>Fix checkout init for SHA-256 repositories by <a href="https://github.com/yaananth"><code>@​yaananth</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2439">actions/checkout#2439</a></li> <li>Update changelog for v6.0.3 by <a href="https://github.com/yaananth"><code>@​yaananth</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2446">actions/checkout#2446</a></li> </ul> <h2>New Contributors</h2> <ul> <li><a href="https://github.com/yaananth"><code>@​yaananth</code></a> made their first contribution in <a href="https://redirect.github.com/actions/checkout/pull/2414">actions/checkout#2414</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/actions/checkout/compare/v6...v6.0.3">https://githu
  **Post-Mortem & Fix Analysis**:
  > Superseded by #465.

- **Issue #456** (2026-08-06): **build(deps): bump mozilla-actions/sccache-action from 0.0.9 to 0.0.10**
  *Symptoms*: Bumps [mozilla-actions/sccache-action](https://github.com/mozilla-actions/sccache-action) from 0.0.9 to 0.0.10. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/mozilla-actions/sccache-action/releases">mozilla-actions/sccache-action's releases</a>.</em></p> <blockquote> <h2>v0.0.10</h2> <h2>What's Changed</h2> <ul> <li>Use tar on all platforms by <a href="https://github.com/brianmichel"><code>@​brianmichel</code></a> in <a href="https://redirect.github.com/Mozilla-Actions/sccache-action/pull/193">Mozilla-Actions/sccache-action#193</a></li> <li>Bump eslint-plugin-prettier from 5.2.3 to 5.2.5 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/Mozilla-Actions/sccache-action/pull/196">Mozilla-Actions/sccache-action#196</a></li> <li>Bump typescript from 5.7.2 to 5.8.2 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/Mozilla-Actions/sccache-action/pull/195">Mozilla-Actions/sccache-action#195</a></li> <li>Bump <code>@​types/node</code> from 22.13.0 to 22.13.17 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/Mozilla-Actions/sccache-action/pull/194">Mozilla-Actions/sccache-action#194</a></li> <li>Bump undici from 5.28.5 to 5.29.0 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github
  **Post-Mortem & Fix Analysis**:
  > Superseded by #475.

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

### Incident Patch 1: `71f8383b` (2026-03-24)
**Commit Message**: fix: don't create sqlite database until stats are written (#448)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `src/recorder/worker.rs` (modified, +13/-7)
```diff
@@ -17,14 +17,14 @@ use std::cell::RefMut;
 use std::fs;
 use std::path::Path;
 
-// Safety: The directory name must start with "pgsql_tmp" to be excluded by pg_basebackup
+// The directory name must start with "pgsql_tmp" to be excluded by pg_basebackup
 const RECORDER_DIR: &str = "pgsql_tmp_vchord_sampling";
 const RECORDER_VERSION: u32 = 1;
 
 static CONNECTION: PgRefCell<Option<rusqlite::Connection>> =
     PgRefCell::<Option<rusqlite::Connection>>::new(None);
 
-fn get<'a>() -> Option<RefMut<'a, rusqlite::Connection>> {
+fn get<'a>(create: bool) -> Option<RefMut<'a, rusqlite::Connection>> {
     if unsafe { !pgrx::pg_sys::IsBackendPid(pgrx::pg_sys::MyProcPid) } {
         return None;
     }
@@ -36,10 +36,16 @@ fn get<'a>() -> Option<RefMut<'a, rusqlite::Connection>> {
     if connection.is_none()
         && let Err(err) = || -> rusqlite::Result<()> {
             if !Path::new(RECORDER_DIR).exists() {
-                let _ = fs::create_dir_all(RECORDER_DIR);
+                if create {
+                    let _ = fs::create_dir_all(RECORDER_DIR);
+                }
             }
             let p = format!("{RECORDER_DIR}/database_{database_oid}.sqlite");
-            let mut conn = rusqlite::Connection::open(&p)?;
+            let mut flags = rusqlite::OpenFlags::default();
+            if !create {
+                flags.remove(rusqlite::OpenFlags::SQLITE_OPEN_CREATE);
+            }
+            let mut conn = rusqlite::Connection::open_with_flags(&p, flags)?;
             conn.pragma_update(Some("main"), "journal_mode", "WAL")?;
             conn.pragma_update(Some("main"), "synchronous", "NORMAL")?;
             let tx = conn.transaction()?;
@@ -72,7 +78,7 @@ fn get<'a>() -> Option<RefMut<'a, rusqlite::Connection>> {
 }
 
 pub fn push(index: u32, sample: &str, max_records: u32) {
-    let mut connection = match get() {
+    let mut connection = match get(true) {
         Some(c) => c,
         None => return,
     };
@@ -105,7 +111,7 @@ pub fn push(index: u32, sample: &str, max_records: u32) {
 }
 
 pub fn delete_index(index: u32) {
-    let connection = match get() {
+    let connection = match get(false) {
         Some(c) => c,
         None => return,
     };
@@ -122,7 +128,7 @@ pub fn delete_database(database_oid: u32) {
 }
 
 pub fn dump(index: u32) -> Vec<String> {
-    let connection = match get() {
+    let connection = match get(false) {
         Some(c) => c,
         None => return Vec::new(),
     };
```

---

### Incident Patch 2: `43bb3dc8` (2026-03-24)
**Commit Message**: fix: WHPG compatibility (#444)

Signed-off-by: Narek Galstyan <narekg@berkeley.edu>
Co-authored-by: Artjoms Iskovs <mildbyte@gmail.com>

**File**: `src/index/vchordrq/am/am_build.rs` (modified, +4/-3)
```diff
@@ -517,9 +517,10 @@ mod vchordrq_cached {
                     }
                     let pages_s = buffer.len();
                     buffer.extend(pages.iter().flat_map(|x| unsafe {
-                        std::mem::transmute::<&PostgresPage<vchordrq::Opaque>, &[u8; 8192]>(
-                            x.as_ref(),
-                        )
+                        std::mem::transmute::<
+                            &PostgresPage<vchordrq::Opaque>,
+                            &[u8; pgrx::pg_sys::BLCKSZ as usize],
+                        >(x.as_ref())
                     }));
                     let pages_e = buffer.len();
                     while buffer.len() % ALIGN != 0 {
```

**File**: `src/index/vchordrq/dispatch.rs` (modified, +3/-3)
```diff
@@ -179,15 +179,15 @@ pub fn maintain<R>(
             check,
         ),
     };
-    pgrx::info!(
+    pgrx::debug1!(
         "maintain: number_of_formerly_allocated_pages = {}",
         maintain.number_of_formerly_allocated_pages
     );
-    pgrx::info!(
+    pgrx::debug1!(
         "maintain: number_of_freshly_allocated_pages = {}",
         maintain.number_of_freshly_allocated_pages
     );
-    pgrx::info!(
+    pgrx::debug1!(
         "maintain: number_of_freed_pages = {}",
         maintain.number_of_freed_pages
     );
```

**File**: `src/sql/finalize.sql` (modified, +4/-4)
```diff
@@ -189,16 +189,16 @@ CREATE OPERATOR @# (
 -- List of functions
 
 CREATE FUNCTION sphere(vector, real) RETURNS sphere_vector
-IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)';
+IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)::sphere_vector';
 
 CREATE FUNCTION sphere(halfvec, real) RETURNS sphere_halfvec
-IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)';
+IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)::sphere_halfvec';
 
 CREATE FUNCTION sphere(rabitq8, real) RETURNS sphere_rabitq8
-IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)';
+IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)::sphere_rabitq8';
 
 CREATE FUNCTION sphere(rabitq4, real) RETURNS sphere_rabitq4
-IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)';
+IMMUTABLE PARALLEL SAFE LANGUAGE sql AS 'SELECT ROW($1, $2)::sphere_rabitq4';
 
 CREATE FUNCTION quantize_to_rabitq8(vector) RETURNS rabitq8
 IMMUTABLE STRICT PARALLEL SAFE LANGUAGE c AS 'MODULE_PATHNAME', '_vchord_vector_quantize_to_rabitq8_wrapper';
```

---

### Incident Patch 3: `c6c51441` (2026-02-28)
**Commit Message**: fix: tests (#437)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `.github/workflows/check.yml` (modified, +2/-1)
```diff
@@ -1009,7 +1009,8 @@ jobs:
           sudo -iu postgres createuser -s -r $(whoami)
           sudo -iu postgres createdb -O $(whoami) $(whoami)
           if [ "${{ matrix.version }}" -ge "18" ]; then
-            sudo -iu postgres psql -c 'ALTER SYSTEM SET io_method = io_uring'
+            # valgrind works not well
+            sudo -iu postgres psql -c 'ALTER SYSTEM SET io_method = worker'
           fi
           sudo -iu postgres psql -c 'ALTER SYSTEM SET max_worker_processes = 1024'
           sudo -iu postgres psql -c 'ALTER SYSTEM SET shared_preload_libraries = "vchord"'
```

**File**: `tests/vchordg/index_vector_rabitq.slt` (modified, +2/-4)
```diff
@@ -18,7 +18,7 @@ statement ok
 CREATE INDEX ti ON t USING vchordg ((quantize_to_rabitq8(val)::rabitq8(64)) rabitq8_l2_ops);
 
 query I
-SELECT index FROM t ORDER BY quantize_to_rabitq8(val) <-> quantize_to_rabitq8(array_cat(ARRAY[0.6, 0.8], ARRAY(SELECT 0.0 FROM generate_series(1, 62)))::vector) LIMIT 10;
+SELECT index FROM t ORDER BY quantize_to_rabitq8(val) <-> quantize_to_rabitq8(array_cat(ARRAY[0.6, 0.8], ARRAY(SELECT 0.0 FROM generate_series(1, 62)))::vector) LIMIT 9;
 ----
 1608
 155
@@ -29,7 +29,6 @@ SELECT index FROM t ORDER BY quantize_to_rabitq8(val) <-> quantize_to_rabitq8(ar
 60
 218
 1080
-1568
 
 statement ok
 DROP INDEX ti;
@@ -58,7 +57,7 @@ statement ok
 CREATE INDEX ti ON t USING vchordg ((quantize_to_rabitq8(val)::rabitq8(64)) rabitq8_cosine_ops);
 
 query I
-SELECT index FROM t ORDER BY quantize_to_rabitq8(val) <=> quantize_to_rabitq8(array_cat(ARRAY[0.6, 0.8], ARRAY(SELECT 0.0 FROM generate_series(1, 62)))::vector) LIMIT 10;
+SELECT index FROM t ORDER BY quantize_to_rabitq8(val) <=> quantize_to_rabitq8(array_cat(ARRAY[0.6, 0.8], ARRAY(SELECT 0.0 FROM generate_series(1, 62)))::vector) LIMIT 9;
 ----
 1608
 155
@@ -69,7 +68,6 @@ SELECT index FROM t ORDER BY quantize_to_rabitq8(val) <=> quantize_to_rabitq8(ar
 60
 218
 1080
-1568
 
 statement ok
 DROP INDEX ti;
```

---

### Incident Patch 4: `f021160c` (2026-02-14)
**Commit Message**: readme: fix formatting (#429)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `README.md` (modified, +3/-5)
```diff
@@ -1,14 +1,11 @@
 <div align="center">
-<h1 align=center>VectorChord</h1>
-<h4 align=center>Ready for the Billion-Scale Era. Host 100M vectors on a single i4i.xlarge ($247/mo) and (scale seamlessly to 1B+)[https://blog.vectorchord.ai/scaling-vector-search-to-1-billion-on-postgresql].</h4>
-</div>
 
-<div align=center>
+# VectorChord
 
+**Ready for the Billion-Scale Era. Host 100M vectors on a single i4i.xlarge ($247/mo) and [scale seamlessly to 1B+](https://blog.vectorchord.ai/scaling-vector-search-to-1-billion-on-postgresql).**
 
 [Official Site][official-site-link] · [Blog][blog-link] · [Docs][docs-link] · [Feedback][github-issues-link] · [Contact Us][email-link]
 
-
 [![][github-release-shield]][github-release-link]
 [![][docker-release-shield]][docker-release-link]
 [![][docker-pulls-shield]][docker-pulls-link]
@@ -19,6 +16,7 @@
 [![][deepwiki-shield]][deepwiki-link]
 [![][license-1-shield]][license-1-link]
 [![][license-2-shield]][license-2-link]
+
 </div>
 
 VectorChord (vchord) is a PostgreSQL extension engineered for scalable, high-performance, and cost-effective vector search.
```

---

### Incident Patch 5: `b2b20a0e` (2026-02-10)
**Commit Message**: fix: validate table name in external build (#423)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `src/index/vchordrq/types.rs` (modified, +34/-0)
```diff
@@ -109,9 +109,43 @@ impl Default for VchordrqInternalBuildOptions {
 #[derive(Debug, Clone, Serialize, Deserialize, Validate)]
 #[serde(deny_unknown_fields)]
 pub struct VchordrqExternalBuildOptions {
+    #[validate(custom(function = VchordrqExternalBuildOptions::validate_table))]
     pub table: String,
 }
 
+impl VchordrqExternalBuildOptions {
+    fn validate_table(table: &str) -> Result<(), ValidationError> {
+        let (schema_name, table_name) = if let Some((left, right)) = table.split_once(".") {
+            (Some(left), right)
+        } else {
+            (None, table)
+        };
+        fn check(s: &str) -> bool {
+            if s.is_empty() {
+                return false;
+            }
+            if !matches!(s.as_bytes()[0],  b'A'..=b'Z' | b'a'..=b'z' | b'_') {
+                return false;
+            }
+            for c in s.as_bytes().iter().copied() {
+                if !matches!(c,  b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z' | b'_' | b'$') {
+                    return false;
+                }
+            }
+            true
+        }
+        if let Some(schema_name) = schema_name {
+            if !check(schema_name) {
+                return Err(ValidationError::new("table name is not well-formed"));
+            }
+        }
+        if !check(table_name) {
+            return Err(ValidationError::new("table name is not well-formed"));
+        }
+        Ok(())
+    }
+}
+
 #[derive(Debug, Clone, Serialize, Deserialize)]
 #[serde(deny_unknown_fields)]
 #[serde(rename_all = "snake_case")]
```

**File**: `tests/vchordrq/external_build_sql_inject.slt` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+statement ok
+CREATE TABLE t (val vector(3));
+
+statement error table name is not well-formed
+CREATE INDEX ON t USING vchordrq (val vector_l2_ops)
+WITH (options = $$
+build.external.table = "s; SELECT s"
+$$);
+
+statement ok
+DROP TABLE t;
```

---

### Incident Patch 6: `9f723b31` (2026-01-10)
**Commit Message**: fix: remove dependabot for cargo (#409)

It looks like Dependabot also opens PRs for non-security updates, which
is really annoying, so disable it.

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `.github/dependabot.yml` (modified, +0/-15)
```diff
@@ -1,20 +1,5 @@
 version: 2
 updates:
-  - package-ecosystem: cargo
-    directory: /
-    schedule:
-      interval: weekly
-    # https://blog.yossarian.net/2025/11/21/We-should-all-be-using-dependency-cooldowns
-#    cooldown: # applies only to non-security updates
-#      semver-patch: 7 # wait 7 days before applying patch updates
-#      semver-minor: 14
-#      semver-major: 28
-    # dependabot is forbidden to suggest patch / minor / major updates and let CI test for regressions automatically
-    groups:
-      cargo:
-        applies-to: version-updates
-        exclude-patterns: ["*"]
-
   - package-ecosystem: github-actions
     directory: /
     schedule:
```

**File**: `Cargo.lock` (modified, +83/-157)
```diff
@@ -78,22 +78,22 @@ dependencies = [
 
 [[package]]
 name = "anstyle-query"
-version = "1.1.4"
+version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9e231f6134f61b71076a3eab506c379d4f36122f2af15a9ff04415ea4c3339e2"
+checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.60.2",
+ "windows-sys",
 ]
 
 [[package]]
 name = "anstyle-wincon"
-version = "3.0.10"
+version = "3.0.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3e0633414522a32ffaac8ac6cc8f748e090c5717661fddeea04219e2344f5f2a"
+checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.60.2",
+ "windows-sys",
 ]
 
 [[package]]
@@ -153,9 +153,9 @@ dependencies = [
 
 [[package]]
 name = "bumpalo"
-version = "3.19.0"
+version = "3.19.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "46c5e41b57b8bba42a04676d81cb89e9ee8e859a1a66f80a5a72e1cb76b34d43"
+checksum = "5dd9dc738b7a8311c7ade152424974d8115f2cdad61e8dab8dac9f2362298510"
 
 [[package]]
 name = "cargo_toml"
@@ -175,9 +175,9 @@ checksum = "37b2a672a2cb129a2e41c10b1224bb368f9f37a2b16b612598138befd7b37eb5"
 
 [[package]]
 name = "cc"
-version = "1.2.44"
+version = "1.2.52"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "37521ac7aabe3d13122dc382493e20c9416f299d2ccd5b3a5340a2570cdeb0f3"
+checksum = "cd4932aefd12402b36c60956a4fe0035421f544799057659ff86f923657aada3"
 dependencies = [
  "find-msvc-tools",
  "shlex",
@@ -248,19 +248,19 @@ dependencies = [
 
 [[package]]
 name = "clap"
-version = "4.5.51"
+version = "4.5.54"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4c26d721170e0295f191a69bd9a1f93efcdb0aff38684b61ab5750468972e5f5"
+checksum = "c6e6ff9dcd79cff5cd969a17a545d79e84ab086e444102a591e288a8aa3ce394"
 dependencies = [
  "clap_builder",
  "clap_derive",
 ]
 
 [[package]]
 name = "clap_builder"
-version = "4.5.51"
+version = "4.5.54"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "75835f0c7bf681bfd05abe44e965760fea999a5286c6eb2d59883634fd02011a"
+checksum = "fa42cf4d2b7a41bc8f663a7cab4031ebafa1bf3875705bfaf8466dc60ab52c00"
 dependencies = [
  "anstream",
  "anstyle",
@@ -507,7 +507,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys",
 ]
 
 [[package]]
@@ -548,9 +548,9 @@ dependencies = [
 
 [[package]]
 name = "find-msvc-tools"
-version = "0.1.4"
+version = "0.1.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "52051878f80a721bb68ebfbc930e07b65ba72f2da88968ea5c06fd6ca3d3a127"
+checksum = "f449e6c6c08c865631d4890cfacf252b3d396c9bcc83adb6623cdb02a8336c41"
 
 [[package]]
 name = "fixedbitset"
@@ -726,9 +726,9 @@ checksum = "7aedcccd01fc5fe81e6b489c15b247b8b0690feb23304303a9e560f37efc560a"
 
 [[package]]
 name = "icu_properties"
-version = "2.1.1"
+version = "2.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e93fcd3157766c0c8da2f8cff6ce651a31f0810eaa1c51ec363ef790bbb5fb99"
+checksum = "020bfc02fe870ec3a66d93e677ccca0562506e5872c650f893269e08615d74ec"
 dependencies = [
  "icu_collections",
  "icu_locale_core",
@@ -740,9 +740,9 @@ dependencies = [
 
 [[package]]
 name = "icu_properties_data"
-version = "2.1.1"
+version = "2.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "02845b3647bb045f1100ecd6480ff52f34c35f82d9880e029d329c21d1054899"
+checksum = "616c294cf8d725c6afcd8f55abc17c56464ef6211f9ed59cccffe534129c77af"
 
 [[package]]
 name = "icu_provider"
@@ -809,9 +809,9 @@ dependencies = [
 
 [[package]]
 name = "indexmap"
-version = "2.12.0"
+version = "2.13.0"
 source = "registry+https://github.com/rust-lang/crates
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -46,7 +46,7 @@ rayon.workspace = true
 rusqlite = { version = "0.38.0", features = ["bundled"] }
 seq-macro.workspace = true
 serde.workspace = true
-toml = "0.9.8"
+toml = "0.9.11+spec-1.1.0"
 validator.workspace = true
 wyhash.workspace = true
 zerocopy.workspace = true
@@ -66,7 +66,7 @@ version = "0.0.0"
 edition = "2024"
 
 [workspace.dependencies]
-bumpalo = "3.19.0"
+bumpalo = "3.19.1"
 dary_heap = "0.3.8"
 paste = "1.0.15"
 rand = "0.9.2"
@@ -76,7 +76,7 @@ seq-macro = "0.3.6"
 serde = { version = "1.0.228", features = ["derive"] }
 validator = { version = "0.20.0", features = ["derive"] }
 wyhash = "0.6.0"
-zerocopy = { version = "0.8.27", features = ["derive"] }
+zerocopy = { version = "0.8.33", features = ["derive"] }
 
 [workspace.lints]
 # complexity
```

**File**: `crates/simd/Cargo.toml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ criterion = "0.8.1"
 rand.workspace = true
 
 [build-dependencies]
-cc = "1.2.44"
+cc = "1.2.52"
 which = "8.0.0"
 
 [lints]
```

**File**: `crates/xtask/Cargo.toml` (modified, +3/-3)
```diff
@@ -5,13 +5,13 @@ edition.workspace = true
 publish = false
 
 [dependencies]
-clap = { version = "4.5.51", features = ["derive", "env"] }
+clap = { version = "4.5.54", features = ["derive", "env"] }
 object = { version = "0.38.1", features = ["read", "wasm"] }
 serde.workspace = true
-serde_json = "1.0.145"
+serde_json = "1.0.149"
 shlex = "1.3.0"
 target-triple = "1.0.0"
-tempfile = "3.23.0"
+tempfile = "3.24.0"
 
 [lints]
 workspace = true
```

---

### Incident Patch 7: `570104b4` (2026-01-08)
**Commit Message**: fix: lto (#402)

https://github.com/rust-lang/rust/issues/51009

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `crates/xtask/src/main.rs` (modified, +4/-1)
```diff
@@ -205,8 +205,11 @@ fn build(
     target: &str,
 ) -> Result<PathBuf, Box<dyn Error>> {
     let mut command = Command::new("cargo");
+    command.args(["rustc"]);
+    if !matches!(profile, "dev" | "test") {
+        command.args(["--crate-type", "cdylib"]);
+    }
     command
-        .args(["build"])
         .args(["-p", "vchord", "--lib"])
         .args(["--profile", profile])
         .args(["--target", target])
```

---

### Incident Patch 8: `5a204a57` (2026-01-06)
**Commit Message**: fix: add sve tests (#400)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `crates/simd/src/byte.rs` (modified, +7/-21)
```diff
@@ -13,9 +13,7 @@
 // Copyright (c) 2025 TensorChord Inc.
 
 pub mod reduce_sum_of_xy {
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v4")]
@@ -75,9 +73,7 @@ pub mod reduce_sum_of_xy {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v4")]
@@ -146,9 +142,7 @@ pub mod reduce_sum_of_xy {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v3")]
@@ -218,9 +212,7 @@ pub mod reduce_sum_of_xy {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v2")]
@@ -412,9 +404,7 @@ pub fn reduce_sum_of_xy(s: &[u8], t: &[u8]) -> u32 {
 }
 
 pub mod reduce_sum_of_x {
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v4")]
@@ -460,9 +450,7 @@ pub mod reduce_sum_of_x {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v3")]
@@ -509,9 +497,7 @@ pub mod reduce_sum_of_x {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v2")]
```

**File**: `crates/simd/src/emulate.rs` (modified, +10/-10)
```diff
@@ -44,7 +44,7 @@ pub(crate) use partial_load;
 // Instructions. arXiv preprint arXiv:2112.06342.
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v4")]
+#[target_feature(enable = "avx512f")]
 pub fn emulate_mm512_2intersect_epi32(
     a: core::arch::x86_64::__m512i,
     b: core::arch::x86_64::__m512i,
@@ -99,7 +99,7 @@ pub fn emulate_mm512_2intersect_epi32(
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v3")]
+#[target_feature(enable = "avx")]
 pub fn emulate_mm256_reduce_add_ps(mut x: core::arch::x86_64::__m256) -> f32 {
     use core::arch::x86_64::*;
     x = _mm256_add_ps(x, _mm256_permute2f128_ps(x, x, 1));
@@ -110,7 +110,7 @@ pub fn emulate_mm256_reduce_add_ps(mut x: core::arch::x86_64::__m256) -> f32 {
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v2")]
+#[target_feature(enable = "ssse3")]
 pub fn emulate_mm_reduce_add_ps(mut x: core::arch::x86_64::__m128) -> f32 {
     use core::arch::x86_64::*;
     x = _mm_hadd_ps(x, x);
@@ -120,7 +120,7 @@ pub fn emulate_mm_reduce_add_ps(mut x: core::arch::x86_64::__m128) -> f32 {
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v3")]
+#[target_feature(enable = "avx2")]
 pub fn emulate_mm256_reduce_add_epi32(mut x: core::arch::x86_64::__m256i) -> i32 {
     use core::arch::x86_64::*;
     x = _mm256_add_epi32(x, _mm256_permute2f128_si256(x, x, 1));
@@ -131,7 +131,7 @@ pub fn emulate_mm256_reduce_add_epi32(mut x: core::arch::x86_64::__m256i) -> i32
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v2")]
+#[target_feature(enable = "ssse3")]
 pub fn emulate_mm_reduce_add_epi32(mut x: core::arch::x86_64::__m128i) -> i32 {
     use core::arch::x86_64::*;
     x = _mm_hadd_epi32(x, x);
@@ -141,7 +141,7 @@ pub fn emulate_mm_reduce_add_epi32(mut x: core::arch::x86_64::__m128i) -> i32 {
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v3")]
+#[target_feature(enable = "avx")]
 pub fn emulate_mm256_reduce_min_ps(x: core::arch::x86_64::__m256) -> f32 {
     use crate::aligned::Aligned16;
     use core::arch::x86_64::*;
@@ -157,7 +157,7 @@ pub fn emulate_mm256_reduce_min_ps(x: core::arch::x86_64::__m256) -> f32 {
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v2")]
+#[target_feature(enable = "sse")]
 pub fn emulate_mm_reduce_min_ps(x: core::arch::x86_64::__m128) -> f32 {
     use crate::aligned::Aligned16;
     use core::arch::x86_64::*;
@@ -171,7 +171,7 @@ pub fn emulate_mm_reduce_min_ps(x: core::arch::x86_64::__m128) -> f32 {
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v3")]
+#[target_feature(enable = "avx")]
 pub fn emulate_mm256_reduce_max_ps(x: core::arch::x86_64::__m256) -> f32 {
     use crate::aligned::Aligned16;
     use core::arch::x86_64::*;
@@ -187,7 +187,7 @@ pub fn emulate_mm256_reduce_max_ps(x: core::arch::x86_64::__m256) -> f32 {
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v2")]
+#[target_feature(enable = "sse")]
 pub fn emulate_mm_reduce_max_ps(x: core::arch::x86_64::__m128) -> f32 {
     use crate::aligned::Aligned16;
     use core::arch::x86_64::*;
@@ -201,7 +201,7 @@ pub fn emulate_mm_reduce_max_ps(x: core::arch::x86_64::__m128) -> f32 {
 
 #[inline]
 #[cfg(target_arch = "x86_64")]
-#[crate::target_cpu(enable = "v3")]
+#[target_feature(enable = "avx2")]
 pub fn emulate_mm256_reduce_add_epi64(mut x: core::arch::x86_64::__m256i) -> i64 {
     use core::arch::x86_64::*;
     x = _mm256_add_epi64(x, _mm256_permute2f128_si256(x, x, 1));
```

**File**: `crates/simd/src/floating_f32.rs` (modified, +52/-2)
```diff
@@ -1250,7 +1250,32 @@ mod reduce_sum_of_xy {
     #[test]
     #[cfg_attr(miri, ignore)]
     fn reduce_sum_of_xy_a3_256_test() {
-        //
+        use rand::Rng;
+        const EPSILON: f32 = 0.004;
+        if !crate::is_cpu_detected!("a3.256") {
+            println!("test {} ... skipped (a3.256)", module_path!());
+            return;
+        }
+        let mut rng = rand::rng();
+        for _ in 0..if cfg!(not(miri)) { 256 } else { 1 } {
+            let n = 4016;
+            let lhs = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
+            let rhs = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
+            for z in 3984..4016 {
+                let lhs = &lhs[..z];
+                let rhs = &rhs[..z];
+                let specialized = unsafe { reduce_sum_of_xy_a3_256(lhs, rhs) };
+                let fallback = fallback(lhs, rhs);
+                assert!(
+                    (specialized - fallback).abs() < EPSILON,
+                    "specialized = {specialized}, fallback = {fallback}."
+                );
+            }
+        }
     }
 
     #[inline]
@@ -1530,7 +1555,32 @@ mod reduce_sum_of_d2 {
     #[test]
     #[cfg_attr(miri, ignore)]
     fn reduce_sum_of_d2_a3_256_test() {
-        //
+        use rand::Rng;
+        const EPSILON: f32 = 0.02;
+        if !crate::is_cpu_detected!("a3.256") {
+            println!("test {} ... skipped (a3.256)", module_path!());
+            return;
+        }
+        let mut rng = rand::rng();
+        for _ in 0..if cfg!(not(miri)) { 256 } else { 1 } {
+            let n = 4016;
+            let lhs = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
+            let rhs = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
+            for z in 3984..4016 {
+                let lhs = &lhs[..z];
+                let rhs = &rhs[..z];
+                let specialized = unsafe { reduce_sum_of_d2_a3_256(lhs, rhs) };
+                let fallback = fallback(lhs, rhs);
+                assert!(
+                    (specialized - fallback).abs() < EPSILON,
+                    "specialized = {specialized}, fallback = {fallback}."
+                );
+            }
+        }
     }
 
     #[inline]
```

**File**: `crates/simd/src/halfbyte.rs` (modified, +4/-12)
```diff
@@ -13,9 +13,7 @@
 // Copyright (c) 2025 TensorChord Inc.
 
 pub mod reduce_sum_of_xy {
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v4")]
@@ -81,9 +79,7 @@ pub mod reduce_sum_of_xy {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v4")]
@@ -153,9 +149,7 @@ pub mod reduce_sum_of_xy {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v3")]
@@ -226,9 +220,7 @@ pub mod reduce_sum_of_xy {
         }
     }
 
-    /// # Safety
-    ///
-    /// * Don't call it. Internal use.
+    #[doc(hidden)]
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v2")]
```

**File**: `crates/simd/src/quantize.rs` (modified, +28/-12)
```diff
@@ -50,17 +50,21 @@ mod mul_add_round {
     #[test]
     #[cfg_attr(miri, ignore)]
     fn mul_add_round_v4_test() {
+        use rand::Rng;
         if !crate::is_cpu_detected!("v4") {
             println!("test {} ... skipped (v4)", module_path!());
             return;
         }
+        let mut rng = rand::rng();
         for _ in 0..if cfg!(not(miri)) { 256 } else { 1 } {
             let n = 4010;
-            let x = (0..n).map(|_| rand::random::<_>()).collect::<Vec<_>>();
+            let x = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
             for z in 3990..4010 {
                 let x = &x[..z];
-                let k = 20.0;
-                let b = 20.0;
+                let k = 127.0;
+                let b = 127.0;
                 let specialized = unsafe { mul_add_round_v4(x, k, b) };
                 let fallback = fallback(x, k, b);
                 assert_eq!(specialized, fallback);
@@ -118,17 +122,21 @@ mod mul_add_round {
     #[cfg(all(target_arch = "x86_64", test))]
     #[test]
     fn mul_add_round_v3_test() {
+        use rand::Rng;
         if !crate::is_cpu_detected!("v3") {
             println!("test {} ... skipped (v3)", module_path!());
             return;
         }
+        let mut rng = rand::rng();
         for _ in 0..if cfg!(not(miri)) { 256 } else { 1 } {
             let n = 4010;
-            let x = (0..n).map(|_| rand::random::<_>()).collect::<Vec<_>>();
+            let x = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
             for z in 3990..4010 {
                 let x = &x[..z];
-                let k = 20.0;
-                let b = 20.0;
+                let k = 127.0;
+                let b = 127.0;
                 let specialized = unsafe { mul_add_round_v3(x, k, b) };
                 let fallback = fallback(x, k, b);
                 assert_eq!(specialized, fallback);
@@ -181,17 +189,21 @@ mod mul_add_round {
     #[cfg(all(target_arch = "x86_64", test))]
     #[test]
     fn mul_add_round_v2_fma_test() {
+        use rand::Rng;
         if !crate::is_cpu_detected!("v2") || !crate::is_feature_detected!("fma") {
             println!("test {} ... skipped (v2:fma)", module_path!());
             return;
         }
+        let mut rng = rand::rng();
         for _ in 0..if cfg!(not(miri)) { 256 } else { 1 } {
             let n = 4010;
-            let x = (0..n).map(|_| rand::random::<_>()).collect::<Vec<_>>();
+            let x = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
             for z in 3990..4010 {
                 let x = &x[..z];
-                let k = 20.0;
-                let b = 20.0;
+                let k = 127.0;
+                let b = 127.0;
                 let specialized = unsafe { mul_add_round_v2_fma(x, k, b) };
                 let fallback = fallback(x, k, b);
                 assert_eq!(specialized, fallback);
@@ -251,17 +263,21 @@ mod mul_add_round {
     #[test]
     #[cfg_attr(miri, ignore)]
     fn mul_add_round_a2_test() {
+        use rand::Rng;
         if !crate::is_cpu_detected!("a2") {
             println!("test {} ... skipped (a2)", module_path!());
             return;
         }
+        let mut rng = rand::rng();
         for _ in 0..if cfg!(not(miri)) { 256 } else { 1 } {
             let n = 4010;
-            let x = (0..n).map(|_| rand::random::<_>()).collect::<Vec<_>>();
+            let x = (0..n)
+                .map(|_| rng.random_range(-1.0..=1.0))
+                .collect::<Vec<_>>();
             for z in 3990..4010 {
                 let x = &x[..z];
-                let k = 20.0;
-                let b = 20.0;
+                let k = 127.0;
+                let b = 127.0;
                 let specialized = unsafe { mul_add_round_a2(x, k, b) };
                 let fallback = fallback(x, k, b);
                 assert_eq!(special
```

---

### Incident Patch 9: `10fe3c2d` (2025-12-24)
**Commit Message**: fix: ci (#396)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `.github/workflows/check.yml` (modified, +34/-27)
```diff
@@ -23,7 +23,7 @@ jobs:
         run: |
           curl -fsSL https://github.com/tamasfe/taplo/releases/download/0.10.0/taplo-linux-$(uname -m).gz | gzip -d - | install -m 755 /dev/stdin /usr/local/bin/taplo
 
-          curl -fsSL https://github.com/EmbarkStudios/cargo-deny/releases/download/0.18.2/cargo-deny-0.18.2-$(uname -m)-unknown-linux-musl.tar.gz | tar -xOzf - cargo-deny-0.18.2-$(uname -m)-unknown-linux-musl/cargo-deny | install -m 755 /dev/stdin /usr/local/bin/cargo-deny
+          curl -fsSL https://github.com/EmbarkStudios/cargo-deny/releases/download/0.19.2/cargo-deny-0.18.2-$(uname -m)-unknown-linux-musl.tar.gz | tar -xOzf - cargo-deny-0.19.2-$(uname -m)-unknown-linux-musl/cargo-deny | install -m 755 /dev/stdin /usr/local/bin/cargo-deny
 
       - name: Install Rust
         run: rustup update
@@ -134,8 +134,7 @@ jobs:
 
       - name: Cargo Test (Miri)
         env:
-          # https://github.com/rust-lang/rust/issues/149314
-          RUSTFLAGS: "-Ctarget-cpu=sapphirerapids -Zcodegen-backend=llvm"
+          RUSTFLAGS: "-Ctarget-cpu=sapphirerapids"
           MIRIFLAGS: "-Zmiri-strict-provenance"
         run: |
           cargo miri test --locked --target x86_64-unknown-linux-gnu \
@@ -250,6 +249,9 @@ jobs:
           curl --proto '=https' --tlsv1.2 -sSf https://apt.llvm.org/llvm.sh | sudo bash -s -- 18
           echo CC=clang-18 >> $GITHUB_ENV
 
+      - name: Set up Sccache
+        uses: mozilla-actions/sccache-action@v0.0.9
+
       - name: Install PostgreSQL & pgvector
         run: |
           sudo apt-get remove -y '^postgres.*' '^libpq.*'
@@ -284,9 +286,6 @@ jobs:
 
           sudo apt-get install -y --no-install-recommends postgresql-${{ matrix.version }}-pgvector
 
-      - name: Set up Sccache
-        uses: mozilla-actions/sccache-action@v0.0.9
-
       - name: Checkout
         uses: actions/checkout@v4
 
@@ -360,6 +359,9 @@ jobs:
       - name: Install Clang
         run: echo CC=$(brew --prefix llvm@18)/bin/clang >> $GITHUB_ENV
 
+      - name: Set up Sccache
+        uses: mozilla-actions/sccache-action@v0.0.9
+
       - name: Install PostgreSQL & pgvector
         run: |
           brew install postgresql@${{ matrix.version }}
@@ -377,11 +379,8 @@ jobs:
 
           mkdir ~/pgvector-install
           curl -fsSL https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.1.tar.gz | tar -xz -C ~/pgvector-install
-          make -C ~/pgvector-install/pgvector-0.8.1 PG_CONFIG=$(brew --prefix postgresql@${{ matrix.version }})/bin/pg_config
-          sudo make -C ~/pgvector-install/pgvector-0.8.1 PG_CONFIG=$(brew --prefix postgresql@${{ matrix.version }})/bin/pg_config install
-
-      - name: Set up Sccache
-        uses: mozilla-actions/sccache-action@v0.0.9
+          make -C ~/pgvector-install/pgvector-0.8.1 PG_CONFIG=$(brew --prefix postgresql@${{ matrix.version }})/bin/pg_config CC='sccache clang'
+          sudo make -C ~/pgvector-install/pgvector-0.8.1 PG_CONFIG=$(brew --prefix postgresql@${{ matrix.version }})/bin/pg_config CC='sccache clang' install
 
       - name: Checkout
         uses: actions/checkout@v4
@@ -455,6 +454,9 @@ jobs:
       - name: Install Rust
         run: rustup update
 
+      - name: Set up Sccache
+        uses: mozilla-actions/sccache-action@v0.0.9
+
       - name: Install PostgreSQL & pgvector
         run: |
           'PGBIN','PGDATA','PGROOT', 'PGUSER', 'PGPASSWORD' | ForEach-Object { Remove-Item "env:$_" }
@@ -500,8 +502,8 @@ jobs:
           nmake /F Makefile.win PGROOT="D:\postgresql-install\pgsql" install
           Pop-Location
 
-      - name: Set up Sccache
-        uses: mozilla-actions/sccache-action@v0.0.9
+      - name: Install Clang
+        run: Add-Content -Path $env:GITHUB_ENV -Value "CC=clang-cl.exe"
 
       - name: Checkout
         uses: actions/checkout@v4
@@ -586,7 +588,12 @@ jobs:
           echo RUSTC_BOOTSTRAP=1 >> $GITHUB_ENV
 
       - name: Install Clang
-        run: sudo apk add --no-cache clang18-dev
+        run: |
+          
```

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ jobs:
       - name: Install Clang
         run: |
           curl --proto '=https' --tlsv1.2 -sSf https://apt.llvm.org/llvm.sh | sudo bash -s -- 18
-          sudo update-alternatives --install /usr/bin/clang clang $(which clang-18) 255
+          echo CC=clang-18 >> $GITHUB_ENV
 
       - name: Install PostgreSQL
         run: |
```

**File**: `crates/simd/src/floating_f32.rs` (modified, +0/-3)
```diff
@@ -965,9 +965,6 @@ mod reduce_sum_of_x2 {
 }
 
 mod reduce_min_max_of_x {
-    // Semanctics of `f32::min` is different from `_mm256_min_ps`,
-    // which may lead to issues...
-
     #[inline]
     #[cfg(target_arch = "x86_64")]
     #[crate::target_cpu(enable = "v4")]
```

**File**: `crates/simd/src/lib.rs` (modified, +0/-1)
```diff
@@ -14,7 +14,6 @@
 
 #![allow(unsafe_code)]
 #![cfg_attr(feature = "nightly_f16", feature(f16))]
-#![cfg_attr(target_arch = "s390x", feature(stdarch_s390x_feature_detection))]
 #![cfg_attr(target_arch = "s390x", feature(s390x_target_feature))]
 #![cfg_attr(target_arch = "s390x", feature(stdarch_s390x))]
 #![cfg_attr(target_arch = "powerpc64", feature(stdarch_powerpc_feature_detection))]
```

---

### Incident Patch 10: `866fbada` (2025-12-16)
**Commit Message**: fix: slips in dump-codegen (#394)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `devtools/dump-codegen.sh` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ Datum amhandler() {
   IndexAmRoutine *amroutine = makeNode(IndexAmRoutine);
   amroutine->amsupport = 1;
   amroutine->amcanorderbyop = true;
-  (Datum) amroutine;
+  return (Datum) amroutine;
 }
 EOF
 
```

#### Recent Merged Pull Requests:
- **PR #478** (closed): feat(vchordrq): add pluggable exact MaxSim reranking (@HuXinjing)
- **PR #477** (closed): feat(vchordrq): estimate MaxSim planner cost (@HuXinjing)
- **PR #473** (closed): Feature/tutti io pipeline (@HuXinjing)
- **PR #472** (closed): Feature/tilemaxsim phase3 (@HuXinjing)
- **PR #467** (closed): build: fix target features for rustc 1.96 (@CertainLach)
- **PR #465** (closed): build(deps): bump actions/checkout from 6.0.2 to 7.0.0 (@dependabot[bot])
- **PR #462** (closed): build(deps): bump actions/checkout from 6.0.2 to 6.0.3 (@dependabot[bot])
- **PR #456** (closed): build(deps): bump mozilla-actions/sccache-action from 0.0.9 to 0.0.10 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
