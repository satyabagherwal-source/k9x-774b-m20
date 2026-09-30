# Forensic Learning Record (Deep Inspection): carbon-design-system/carbon-components-svelte

> **Canonical Artifact**: `07_PROJECT_LEARNING/carbon-design-system-carbon-components-svelte-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/carbon-design-system/carbon-components-svelte](https://github.com/carbon-design-system/carbon-components-svelte))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:41.994Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `carbon-design-system/carbon-components-svelte`
- **Description**: Svelte implementation of the Carbon Design System
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2913 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/batchStoreUpdates.bench.ts`
```
// Pure-logic benchmark: no jsdom, no Svelte, run directly via bun (`bunx ostia bench bench/<this file>.bench.ts`, optionally filtered — see CONTRIBUTING.md).
// batchStoreUpdates backs Tabs/TabsVertical/ContentSwitcher/OverflowMenu/Menu/
// UserAvatarGroup/TagSet/ProgressIndicator child registration: every child
// calls the batched update once, synchronously, from its own mount pass.
// Without batching, N children registering in the same tick means N
// store.update() calls, each re-notifying every subscriber — and a
// subscriber that re-derives something over the whole list (registered
// order, roving-focus index, ...) turns that into O(n^2) for the mount.
// This is the exact shape the registration-fanout fixes targeted, so the
// bench compares batched vs. unbatched directly instead of trusting the
// module's O(n) shape on paper.
import { group, range, task } from "ostia";
import { batchStoreUpdates } from "../src/utils/batch-store-updates.js";

// Minimal stand-in for a Svelte `Writable`: just enough surface
// (`update`) for batchStoreUpdates to wrap, plus a subscriber-cost hook
// that re-derives something over the full list on every notify — the
// part of a real store that makes unbatched notification count matter.
function createStore(subscriberCost: (value: number[]) => void) {
  let value: number[] = [];
  return {
    update(fn: (value: number[]) => number[]) {
      value = fn(value);
      subscriberCost(value);
    },
  };
}

function registeredOrderIndex(value: number[]) {
  const index = new Map<number, number>();
  value.forEach((id, i) => {
    index.set(id, i);
  });
  return index;
}

group(
  "N children registering in one tick, unbatched (direct store.update per child)",
  () => {
    for (const size of range(10, 1000)) {
      task(`${size} children`, () => {
        const store = createStore(registeredOrderIndex);
        for (let i = 0; i < size; i++) {
          store.update((list) => [...list, i]);
        }
      });
    }
  },
  { gc: true },
);

group(
  "N children registering in one tick, batched (batchStoreUpdates)",
  () => {
    for (const size of range(10, 1000)) {
      task(`${size} children`, async () => {
        const store = createStore(registeredOrderIndex);
        const batchedUpdate = batchStoreUpdates(store);
        for (let i = 0; i < size; i++) {
          batchedUpdate((list) => [...list, i]);
        }
        // batchStoreUpdates schedules its flush via `Promise.resolve().then`
        // on the first push in this tick; awaiting a fresh already-resolved
        // promise here queues our continuation behind it in the microtask
        // queue, so the flush has run by the time this task resolves.
        await Promise.resolve();
      });
    }
  },
  { gc: true },
);

```

### Core Architecture Module: `bench/boundedFifoCache.bench.ts`
```
// Pure-logic benchmark: no jsdom, no Svelte, run directly via bun (`bunx ostia bench bench/<this file>.bench.ts`, optionally filtered — see CONTRIBUTING.md).
// BoundedFifoCache backs DataTable's resolvePath path-segment cache (see
// dataTableSort.bench.ts) and is a Map wrapper with `.keys().next().value`
// eviction — expected O(1) per set() regardless of cache size. A naive FIFO
// implementation (e.g. `Array.from(map.keys())[0]`) would be O(size) instead.
//
// Measured result is more nuanced than a clean O(1)/O(n) verdict: a single
// evicting set(), measured in isolation (below), scales with maxSize —
// ~110ns at 100 → ~11.7µs at 10,000 (confirmed with and without `.gc("inner")`,
// so this isn't a mitata batching artifact) — because V8's Map does periodic
// backing-table compaction proportional to table size after repeated
// delete+insert cycles. But amortized over many sets in a tight loop, the
// average cost is far lower (~0.3ns → ~12ns at the same sizes) because most
// individual sets don't trigger a compaction. Both numbers are "real" —
// they just answer different questions, so both are benched here. At this
// cache's actual codebase size (MAX_PATH_CACHE_SIZE = 1000 in
// data-table-utils.js) and its real workload (fills once, then mostly
// cache-hit gets — evictions are rare, not back-to-back), the single-call
// number is the more representative one, and even that is negligible
// (sub-microsecond) at this scale.
import { group, range, task } from "ostia";
import { BoundedFifoCache } from "../src/utils/bounded-fifo-cache.js";

// Cache held at capacity (maxSize == size), so every set() past warmup
// evicts — the worst case for eviction cost, not the empty-cache case.
group("BoundedFifoCache set() at capacity, single call", () => {
  for (const size of range(100, 10_000)) {
    const cache = new BoundedFifoCache<number, number>(size);
    for (let i = 0; i < size; i++) cache.set(i, i);
    let next = size;
    task(`${size} maxSize`, () => cache.set(next++, next));
  }
});

const AMORTIZE_COUNT = 1000;

group(
  `BoundedFifoCache set() at capacity, amortized over ${AMORTIZE_COUNT} calls`,
  () => {
    for (const size of range(100, 10_000)) {
      const cache = new BoundedFifoCache<number, number>(size);
      for (let i = 0; i < size; i++) cache.set(i, i);
      let next = size;
      task(`${size} maxSize`, () => {
        for (let i = 0; i < AMORTIZE_COUNT; i++) cache.set(next++, next);
      });
    }
  },
);

```

### Core Architecture Module: `bench/combobox-filter.dom.bench.ts`
```
import { fireEvent, render } from "@testing-library/svelte";
import ComboBox from "carbon-components-svelte/ComboBox/ComboBox.svelte";
import { task } from "ostia";
import { tick } from "svelte";

// ComboBox filterMode benchmark: compare "hide" vs "remove" per keystroke on
// a 100-item menu (at the auto-virtualization cutoff, so every option is
// mounted when the menu opens). Instances are rendered ONCE and persist
// for the whole file's run — the timed closure fires only the input event,
// matching datatable-filter.dom.bench.ts. Alternating "Item 7"/"Item 8"
// swaps two disjoint-ish match sets so every iteration does genuine filter
// work.
//
// Default is "remove": at this size, remounting ~11 matches is cheaper than
// updating `hidden` on all 100 option nodes.

function buildItems(count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({ id: String(i), text: `Item ${(i * 37) % count}` });
  }
  return items;
}

const items100 = buildItems(100);

const shouldFilterItem = (item: { text: string }, value: string): boolean =>
  item.text.toLowerCase().includes(value.toLowerCase());

const hideInstance = render(ComboBox, {
  props: {
    items: items100,
    placeholder: "Options",
    open: true,
    virtualize: false,
    filterMode: "hide",
    shouldFilterItem,
  },
});
const removeInstance = render(ComboBox, {
  props: {
    items: items100,
    placeholder: "Options",
    open: true,
    virtualize: false,
    filterMode: "remove",
    shouldFilterItem,
  },
});

const getInput = (instance: typeof hideInstance) => {
  const input = instance.container.querySelector("input");
  if (!input) throw new Error("combobox input not found");
  return input;
};

const hideInput = getInput(hideInstance);
await fireEvent.input(hideInput, { target: { value: "Item 7" } });
await tick();
const hideMounted =
  hideInstance.container.querySelectorAll('[role="option"]').length;
const hideVisible = hideInstance.container.querySelectorAll(
  '[role="option"]:not([hidden])',
).length;
const removeInput = getInput(removeInstance);
await fireEvent.input(removeInput, { target: { value: "Item 7" } });
await tick();
const removeMounted =
  removeInstance.container.querySelectorAll('[role="option"]').length;
process.stdout.write(
  `sanity: hide mounted=${hideMounted} hide visible=${hideVisible} remove mounted=${removeMounted}\n`,
);

const registerKeystrokeCase = (
  title: string,
  input: HTMLInputElement,
): void => {
  let n = 0;
  task(title, async () => {
    const value = n++ % 2 === 0 ? "Item 8" : "Item 7";
    await fireEvent.input(input, { target: { value } });
    await tick();
  });
};

registerKeystrokeCase(
  "filter keystroke, ComboBox 100 items, filterMode hide",
  hideInput,
);
registerKeystrokeCase(
  "filter keystroke, ComboBox 100 items, filterMode remove",
  removeInput,
);

```

### Core Architecture Module: `bench/combobox-mount.dom.bench.ts`
```
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import ComboBox from "carbon-components-svelte/ComboBox/ComboBox.svelte";
import { task } from "ostia";

// Mirrors multiselect-mount.dom.bench.ts: ComboBox shares the same
// `virtualize.js` util (already proven O(1) in item count at the pure-logic
// tier, see virtualize.bench.ts) and the same auto-virtualization threshold
// (100 items). This checks whether the real component's mount/open cost
// actually gets the same payoff MultiSelect's did, since ComboBox has never
// been benched at the component tier — only its filtering (structurally
// identical to fuzzyMatch, already covered).
//
// ComboBox and MultiSelect both gate the item list behind `{#if open}`
// (same as OverflowMenu). A closed ComboBox never mounts item nodes
// regardless of item count, so cases below open the menu (either as part
// of the timed closure, or via `open: true` from the start) instead of
// measuring a closed mount.
function buildItems(count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    // Scrambled, not sequential — see multiselect-mount.dom.bench.ts's
    // comment. ComboBox's default filter is a plain substring match (no
    // sort), but scrambling keeps this fixture consistent with its sibling
    // and avoids accidentally-ordered data masking any future finding.
    items.push({ id: String(i), text: `Item ${(i * 37) % count}` });
  }
  return items;
}

const items100 = buildItems(100);
const items1000 = buildItems(1000);

// Reused across iterations so the benchmark measures ComboBox, not the cost
// of setting up userEvent.
const user = userEvent.setup();

// 100 items is at the auto-virtualization cutoff (virtualize kicks in
// above 100), so this mounts every menu item.
task("mount open ComboBox, 100 items", () => {
  render(ComboBox, {
    props: { items: items100, placeholder: "Options", open: true },
  });
  cleanup();
});

task("mount open ComboBox, 1000 items (virtualized default)", () => {
  render(ComboBox, {
    props: { items: items1000, placeholder: "Options", open: true },
  });
  cleanup();
});

task("mount open ComboBox, 1000 items, virtualize disabled", () => {
  render(ComboBox, {
    props: {
      items: items1000,
      placeholder: "Options",
      open: true,
      virtualize: false,
    },
  });
  cleanup();
});

task("mount + click-open ComboBox, 1000 items", async () => {
  const { getByRole } = render(ComboBox, {
    props: { items: items1000, placeholder: "Options" },
  });

  await user.click(getByRole("combobox"));

  cleanup();
});

```

### Core Architecture Module: `bench/content-switcher-mount.dom.bench.ts`
```
import { cleanup, render } from "@testing-library/svelte";
import { group, range, task } from "ostia";
import { tick } from "svelte";
import ContentSwitcherBench from "./fixtures/ContentSwitcherBench.svelte";

// ContentSwitcher.add() used to reassign the shared `switches` array on
// every child's script body: `switches = [...switches, {...}]`, preceded by
// an O(n) `switches.some(id match)` dedupe, retriggering `$: iconOnly =
// switches.every(...)` each time. N children registering one at a time
// made mount O(n²). Registration now goes through `batchStoreUpdates` so
// those N copies flush once, matching Tabs / OverflowMenu / ProgressIndicator.
// Time through `tick()` so the measurement includes that microtask flush.
group("mount ContentSwitcher", () => {
  for (const size of range(10, 1000)) {
    task(`${size} switches`, async () => {
      render(ContentSwitcherBench, { props: { count: size } });
      await tick();
      cleanup();
    });
  }
});

```

### Core Architecture Module: `bench/contextmenuradiogroup-mount.dom.bench.ts`
```
import { cleanup, render } from "@testing-library/svelte";
import { group, range, task } from "ostia";
import ContextMenuRadioGroupBench from "./fixtures/ContextMenuRadioGroupBench.svelte";

// addOption() appends to `radioIds` with an `.includes()` dedup. Nothing
// derived from that store fans out to siblings, so this should stay closer
// to ContentSwitcher than to the O(n^2) group components. The bench is
// here to measure that, not infer it from the source.
group("mount ContextMenuRadioGroup", () => {
  for (const size of range(10, 1000)) {
    task(`${size} options`, () => {
      render(ContextMenuRadioGroupBench, { props: { count: size } });
      cleanup();
    });
  }
});

```

### Core Architecture Module: `bench/dataTableFilter.bench.ts`
```
// Pure-logic benchmark: no jsdom, no Svelte, run directly via bun (`bunx ostia bench bench/<this file>.bench.ts`, optionally filtered — see CONTRIBUTING.md).
// Mirrors DataTable.svelte's `filterRows` default predicate exactly —
// rows.filter((row) => searchableKeys.some((key) => { const v = resolvePath(row, key); return (typeof v === "string" || typeof v === "number") ? `${v}`.toLowerCase().includes(value) : false; }))
// — which recomputes on every rows/searchValue change (default path when no customFilter is provided).
// This is the hot path: ToolbarSearch invokes filterRows on every keystroke over all rows.
import { group, range, task } from "ostia";
import { resolvePath } from "../src/DataTable/data-table-utils.js";

type Row = {
  id: number;
  name: string;
  age: number;
  contact: { company: string };
};

const COMPANIES = ["Acme", "Globex", "Initech", "Umbrella", "Soylent"];

function buildRows(count: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Row ${i}`,
      age: (i * 37) % 100,
      contact: { company: COMPANIES[i % COMPANIES.length] },
    });
  }
  return rows;
}

// `{ gc: true }` on every group forces `Bun.gc(true)` between trials —
// mitata's per-bench `.gc("inner")` equivalent (see CONTRIBUTING.md). Without
// it, these cases (which each allocate a fresh filtered array per call)
// mis-calibrate batch size and report numbers inflated by 20-60x — e.g.
// filtering at 10k rows without this flag could measure several hundred ms/iter,
// vs. ~5-10ms/iter with it (allocation-heavy array.filter calls).
// Cross-check any surprising absolute number from an allocation-heavy bench
// against a manual loop before trusting it.

// Few matches: only "Row 7" matches the search term "row 7" (one exact row ID match).
group(
  "DataTable default filter, few matches",
  () => {
    for (const size of range(100, 10_000)) {
      const rows = buildRows(size);
      const keys = ["name", "age", "contact.company"];
      const value = "row 7";
      task(`${size} rows`, () =>
        rows.filter((row) =>
          keys.some((key) => {
            const v = resolvePath(row, key);
            return typeof v === "string" || typeof v === "number"
              ? `${v}`.toLowerCase().includes(value)
              : false;
          }),
        ),
      );
    }
  },
  { gc: true },
);

// Many matches: "acme" matches ~1/5 of rows via contact.company (COMPANIES[i % 5] cycles through "Acme" frequently).
group(
  "DataTable default filter, many matches",
  () => {
    for (const size of range(100, 10_000)) {
      const rows = buildRows(size);
      const keys = ["name", "age", "contact.company"];
      const value = "acme";
      task(`${size} rows`, () =>
        rows.filter((row) =>
          keys.some((key) => {
            const v = resolvePath(row, key);
            return typeof v === "string" || typeof v === "number"
              ? `${v}`.toLowerCase().includes(value)
              : false;
          }),
        ),
      );
    }
  },
  { gc: true },
);

// No matches: "zzzz" does not match any row field.
group(
  "DataTable default filter, no matches",
  () => {
    for (const size of range(100, 10_000)) {
      const rows = buildRows(size);
      const keys = ["name", "age", "contact.company"];
      const value = "zzzz";
      task(`${size} rows`, () =>
        rows.filter((row) =>
          keys.some((key) => {
            const v = resolvePath(row, key);
            return typeof v === "string" || typeof v === "number"
              ? `${v}`.toLowerCase().includes(value)
              : false;
          }),
        ),
      );
    }
  },
  { gc: true },
);

```

### Core Architecture Module: `bench/dataTableSort.bench.ts`
```
// Pure-logic benchmark: no jsdom, no Svelte, run directly via bun (`bunx ostia bench bench/<this file>.bench.ts`, optionally filtered — see CONTRIBUTING.md).
// Mirrors DataTable.svelte's `$: sortedRows` reactive block exactly —
// [...rows].sort((a, b) => compareValues(resolvePath(a, key), resolvePath(b, key), ascending))
// — which recomputes on every rows/sortKey/sortDirection change.
import { group, range, task } from "ostia";
import {
  compareValues,
  resolvePath,
} from "../src/DataTable/data-table-utils.js";

type Row = {
  id: number;
  name: string;
  age: number;
  contact: { company: string };
};

const COMPANIES = ["Acme", "Globex", "Initech", "Umbrella", "Soylent"];

function buildRows(count: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Row ${i}`,
      age: (i * 37) % 100,
      contact: { company: COMPANIES[i % COMPANIES.length] },
    });
  }
  return rows;
}

// `{ gc: true }` on every group forces `Bun.gc(true)` between trials —
// mitata's per-bench `.gc("inner")` equivalent (see CONTRIBUTING.md). Without
// it, these two cases (which each allocate a fresh sorted array per call)
// mis-calibrate batch size and report numbers inflated by 20-60x — e.g. the
// nested-string case below measured 9.38s/iter at 10k rows without this
// flag, vs. ~180ms/iter with it (confirmed against a plain performance.now()
// loop). Cross-check any surprising absolute number from an
// allocation-heavy bench against a manual loop before trusting it.

// Flat numeric key: resolvePath's `path in object` fast path, compareValues'
// numeric fast path.
group(
  "DataTable sort, flat numeric key",
  () => {
    for (const size of range(100, 10_000)) {
      const rows = buildRows(size);
      task(`${size} rows`, () =>
        [...rows].sort((a, b) => {
          const itemA = resolvePath(a, "age");
          const itemB = resolvePath(b, "age");
          return compareValues(itemA, itemB, true);
        }),
      );
    }
  },
  { gc: true },
);

// Nested string key: exercises resolvePath's split + path-cache lookup and
// compareValues' localeCompare path — the more expensive combination.
group(
  "DataTable sort, nested string key",
  () => {
    for (const size of range(100, 10_000)) {
      const rows = buildRows(size);
      task(`${size} rows`, () =>
        [...rows].sort((a, b) => {
          const itemA = resolvePath(a, "contact.company");
          const itemB = resolvePath(b, "contact.company");
          return compareValues(itemA, itemB, true);
        }),
      );
    }
  },
  { gc: true },
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3782** (2026-09-10): **Dropdown width scales with the selected text but does not take into account the clear button.**
  *Symptoms*:  No selection:  <img width="1692" height="108" alt="Image" src="https://github.com/user-attachments/assets/bb62f61e-247a-4c2b-8702-114d13f8f880" />   The Dropdown is scaled to accomodated a long text:  <img width="1690" height="92" alt="Image" src="https://github.com/user-attachments/assets/5fcb9378-a6d6-4823-aa8d-77c5f9b0d0e4" />   When the Dropdown is declared as `clearable`, the clear button is over the text:  <img width="1690" height="100" alt="Image" src="https://github.com/user-attachments/assets/f6b7d675-e03c-4605-a692-2c03304ee852" />  # To reproduce  ```html <script>   import { Grid, Column, Row, Dropdown } from "carbon-components-svelte"; </script>  <svelte:head><link rel="stylesheet" href="https://unpkg.com/carbon-components-svelte@0.107.1/css/g100.css" /></svelte:head>  <Grid> 	<Row> 		<Column> 			<Dropdown 				clearable                 items={[ 					{ id: 1, text:"short"}, 					{ id: 2, text:"a very long name"}				 				]} 	    /> 		</Column> 		<Column/> 		<Column/> 		<Column/> 		<Column/> 	</Row> </Grid> ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.112.0](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.112.0)

- **Issue #3778** (2026-09-09): **Toolbar Buttons other than primary are not resized when in a "short" Datatable**
  *Symptoms*: Using `size="short"`:  <img width="1708" height="300" alt="Image" src="https://github.com/user-attachments/assets/478685ee-9a89-41ce-bb7a-fa13b03a370c" />  Note that other sizes have no effect on the tollbar height.   # To reproduce  ```html <script>   import { DataTable, Toolbar, ToolbarContent, Button } from "carbon-components-svelte"; </script>  <svelte:head><link rel="stylesheet" href="https://unpkg.com/carbon-components-svelte@0.107.1/css/g100.css" /></svelte:head>  <DataTable   size="short"    headers={[     { key: "name", value: "Name" },     { key: "protocol", value: "Protocol" },     { key: "port", value: "Port", width: "72px" },     { key: "rule", value: "Rule" },   ]}   rows={[     {       id: "a",       name: "Load Balancer 3",       protocol: "HTTP",       port: 3000,       rule: "Round robin",     },   ]} >   <Toolbar>     <ToolbarContent>       <Button kind="primary">Primary</Button>       <Button kind="secondary">Secondary</Button>       <Button kind="tertiary">Tertiary</Button>     </ToolbarContent>   </Toolbar>  </DataTable> ```` 
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.112.0](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.112.0)

- **Issue #3777** (2026-09-09): **Datatable default expandIcon is smaller when a header has a width.**
  *Symptoms*: The usual look of the chevron of an expandable Datatable:  <img width="1708" height="316" alt="Image" src="https://github.com/user-attachments/assets/f423029f-57e8-4b53-a3a2-3b21df2f9891" />  The look of the chevron when a header has a width:  <img width="1700" height="322" alt="Image" src="https://github.com/user-attachments/assets/2d3763c4-8658-4633-b11e-cec60bfee5d5" />  # To reproduce  Take the "Expandable rows" example from the Datatable documentation: https://svelte.carbondesignsystem.com/components/DataTable#expandable-rows  Add a `width` to any of the header:  ```ts   headers={[     { key: "name", value: "Name" },     { key: "protocol", value: "Protocol" },  -   { key: "port", value: "Port" },  +   { key: "port", value: "Port", width: "72px" },     { key: "rule", value: "Rule" },   ]} ```  # Notes  Tested on version 0.111.1 
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.112.0](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.112.0)

- **Issue #3710** (2026-08-20): **Bug: Select in modals triggers a click outside when selecting a value**
  *Symptoms*: When having a Select component in a Modal, clicking an item will close the modal (cause "clickoutisde"), the issue doesn't occur when using a Dropdown component I've just found out that the issue is present since 105.1 after [this PR ](https://github.com/carbon-design-system/carbon-components-svelte/pull/2808) (it's ok in 105.0) Issue still exists in 0.111.0  Reproduction (change the versions in the imports) https://svelte.dev/playground/37dcec10caaf4254961a43e528d3da89?version=5.56.9 
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.111.1](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.111.1)

- **Issue #3709** (2026-08-29): **[a11y]: ListBox menu options (ComboBox / Dropdown / MultiSelect) truncate at 400% zoom, WCAG 1.4.10 Reflow**
  *Symptoms*: @metonym I'm wondering if you have any thoughts on doing something to handle this here since it doesn't seem to have gotten much traction from the carbon team?: https://github.com/carbon-design-system/carbon/issues/22462  `.bx--list-box__menu-item__option` is fixed at 2.5rem with `white-space: nowrap` / `text-overflow: ellipsis`. At 1280×1024 and 400% zoom, any label longer than the (now very narrow) field is cut off.   Wrapping with css when they aren't virtualized isn't a problem, but once the virtualizer kicks in with lists over 100 it assumes a fixed `itemHeight` (`offsetY = startIndex * itemHeight, totalHeight = length * itemHeight`).  Since wrapping deviates from Carbon's design, I'm thinking an opt-in prop on Dropdown / ComboBox / MultiSelect (e.g. wrapItems) that:  1. Applies wrap styles to the option (`height: auto; white-space: normal; overflow-wrap: anywhere`), including the checkbox label in MultiSelect. 2. Switches virtualization to measured row heights: something like a per-index height cache with a running-average estimate for unmeasured rows, prefix sums for offsets, binary search in getVisibleRange, and scrollTop correction when a row above the viewport is measured. The existing fixed-height path stays the default, so nothing changes for current consumers.  I could work on a PR if that approach sounds workable or maybe you've got other ideas?
  **Post-Mortem & Fix Analysis**:
  > Hello Brian, thank you for raising this issue. Agreed that this should be solved.  The opt-in approach sounds great, a PR is welcome. LMK how I can help.

- **Issue #3444** (2026-07-29): **DatePicker: portalMenu reverted to static:true on reactive re-run inside Modal**
  *Symptoms*:  When DatePicker is inside a ComposedModal (or any container with overflow: hidden) and portalMenu is true, the calendar is correctly appended to body on first creation. However, on any subsequent re-evaluation of the reactive statement calling initCalendar, the flatpickrProps loop applies calendar.set("static", true) (from the default { static: true }), which moves the calendar back inside the date picker container where it gets clipped.    Root cause: In initCalendar, when calendar already exists:     ```js     for (const [option, value] of Object.entries(flatpickrProps)) {       applyOptionIfChanged(option, value);     }   ```     This applies static: true from the default flatpickrProps, overriding the static: false that was set during   initial creation when portalMenu was true.     Workaround: Explicitly set flatpickrProps={{ static: false }} alongside portalMenu={true}.     Expected fix: The flatpickrProps loop should skip static when effectivePortalMenu is true, or the initial   static: false should be tracked in lastAppliedOptions so it isn't overwritten.
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting.  Fixed in [v0.110.2](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.110.2)

- **Issue #3434** (2026-07-17): **Wrong import of CheckmarkFilled in StructuredList and StructuredListRow**
  *Symptoms*: [StructuredList](https://github.com/carbon-design-system/carbon-components-svelte/blob/9cd2c8db09ce6e9c3d01783c3605a26fc1f61241/src/StructuredList/StructuredList.svelte#L36) and [StructuredListRow](https://github.com/carbon-design-system/carbon-components-svelte/blob/9cd2c8db09ce6e9c3d01783c3605a26fc1f61241/src/StructuredList/StructuredListRow.svelte#L17) import `CheckmarkFilled.svelte` from `carbon-icons-svelte` instead of [src/icons/CheckmarkFilled.svelte](https://github.com/carbon-design-system/carbon-components-svelte/blob/master/src/icons/CheckmarkFilled.svelte).  Both imports were added recently in #3368.
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this. Fixed in [v0.110.1](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.110.1)  
  > Thanks!

- **Issue #3170** (2026-06-07): **Multiselect won't work inside a modal**
  *Symptoms*: See the comparison below for outside modal and inside modal.  https://github.com/user-attachments/assets/ea5125a0-76fd-4e7b-a944-7f99c538ffff  Code ```svelte <script lang="ts"> 	import { 		Button, 		DatePicker, 		DatePickerInput, 		Form, 		Heading, 		Modal, 		MultiSelect, 		Stack, 		TextInput 	} from "carbon-components-svelte"; 	import { Add } from "carbon-icons-svelte"; 	let open = $state(false); </script>  <Heading>Album</Heading> <Button 	kind="ghost" 	size="small" 	icon={Add} 	on:click={() => { 		open = false; 		open = true; 	}} > 	Add </Button> <Modal 	preventCloseOnClickOutside 	bind:open 	modalHeading=" album" 	primaryButtonText="Submit" 	secondaryButtonText="Cancel" 	hasForm 	formId="sdfsedfsdf" 	on:click:button--secondary={() => (open = false)} > 	<Form 		id="sdfsedfsdf" 		class="form" 		on:submit={(e) => { 			e.preventDefault(); 			// submit(); 		}} 		><Stack gap={5}> 			<TextInput labelText="Name" name="name" placeholder="Name..." required={true} /> 			<DatePicker datePickerType="single" on:change dateFormat="d/m/Y"> 				<DatePickerInput labelText="Published Date" placeholder="dd/mm/yyyy" /> 			</DatePicker> 			<MultiSelect 				name="genres-multiselect" 				id="genres-multiselect-{Math.floor(Math.random() * 1000)}" 				labelText="Genres" 				items={[ 					{ id: "0", text: "Metal" }, 					{ id: "1", text: "Rock" }, 					{ id: "2", text: "Acoustic" }, 					{ id: "3", text: "Pop" } 				]} 			/> 		</Stack> 	</Form> </Modal> ```  NPM Packages ``` ├── @sveltejs/adapter-a
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting.  Fixed in [v0.108.1](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.108.1).

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

### Incident Patch 1: `0a81cc4a` (2026-09-26)
**Commit Message**: fix(dropdown): name the combobox with `aria-label`

A consumer's `aria-label` was spread with the rest props onto the
wrapper div, which has no role, so the combobox button never got it
and was left unnamed without `labelText`. Route it to the button and
keep it off the wrapper; other rest props still land there.

**File**: `src/Dropdown/Dropdown.svelte` (modified, +6/-1)
```diff
@@ -4,6 +4,7 @@
    */
 
   /**
+   * @restProps {div}
    * @typedef {object} DropdownItem<Id=any>
    * @property {Id} id
    * @property {string} text
@@ -304,6 +305,9 @@
     portalMenu === undefined ? !!insideModal : portalMenu;
 
   $: menuAriaLabel = $$props["aria-label"] ?? (labelText || "Choose an item");
+  // `aria-label` names the combobox button. On the role-less wrapper, where
+  // the rest props land, it is prohibited and never reaches assistive tech.
+  $: ({ "aria-label": fieldAriaLabel, ...wrapperProps } = $$restProps);
 
   let highlightedIndex = -1;
   let highlightOrigin = /** @type {"keyboard" | "pointer" | null} */ (null);
@@ -675,7 +679,7 @@
   class:bx--list-box__wrapper--fluid--readonly={isFluid && readonly}
   class:bx--list-box__wrapper--fluid--condensed={isFluid && condensed}
   use:dismiss={{ enabled: open, type: "click", handler: handleOutsideClick }}
-  {...$$restProps}
+  {...wrapperProps}
 >
   {#if labelText || $$slots.labelChildren}
     <label
@@ -725,6 +729,7 @@
         class:bx--list-box__field={true}
         class:bx--list-box__field--clearable={clearable && selectedId !== undefined}
         tabindex="0"
+        aria-label={fieldAriaLabel}
         aria-expanded={open}
         aria-readonly={readonly || undefined}
         aria-haspopup="listbox"
```

**File**: `tests/Dropdown/Dropdown.test.ts` (modified, +18/-0)
```diff
@@ -94,6 +94,24 @@ describe("Dropdown", () => {
     expect(screen.getByRole("listbox")).toHaveAttribute("aria-label", "");
   });
 
+  it("names the combobox with aria-label instead of the wrapper", () => {
+    const { container } = render(Dropdown, {
+      props: {
+        items: [{ id: "1", text: "Email" }],
+        "aria-label": "Contact method",
+        "data-testid": "contact-dropdown",
+      },
+    });
+
+    expect(
+      screen.getByRole("combobox", { name: "Contact method" }),
+    ).toBeInTheDocument();
+    const wrapper = container.querySelector(".bx--dropdown__wrapper");
+    expect(wrapper).not.toHaveAttribute("aria-label");
+    // Other rest props still land on the wrapper.
+    expect(wrapper).toHaveAttribute("data-testid", "contact-dropdown");
+  });
+
   it("should handle hidden label", () => {
     render(Dropdown, {
       props: {
```

---

### Incident Patch 2: `2ad02ff7` (2026-09-26)
**Commit Message**: fix(list-box): drop aria-label from the role-less wrapper

ComboBox, Dropdown, and MultiSelect passed their accessible name to
the `ListBox` wrapper, a div with no role, where `aria-label` is
prohibited and axe flags a non-filterable MultiSelect. The combobox
and listbox already carry the name, so stop setting it on the wrapper.

**File**: `e2e/combobox.test.ts` (modified, +2/-3)
```diff
@@ -12,9 +12,8 @@ test.describe("ComboBox", () => {
   test("can be located by getByLabel when labelText is set", async ({
     page,
   }) => {
-    // With labelText="Contact", the combobox is findable via its associated label.
-    // The label's for attribute points to the input; use locator to get the input.
-    const combobox = page.getByLabel("Contact").locator("input");
+    // With labelText="Contact", the label's for attribute names the input.
+    const combobox = page.getByRole("combobox", { name: "Contact" });
     await expect(combobox).toBeVisible();
     await combobox.fill("Email");
     await expect(combobox).toHaveValue("Email");
```

**File**: `e2e/fixtures/MultiSelectFixture.svelte` (modified, +10/-0)
```diff
@@ -42,6 +42,16 @@
   <p data-testid="selected-count">Selected: {selectedIds.length}</p>
 {/if}
 
+<MultiSelect
+  data-testid="multiselect-contact"
+  labelText="Contact"
+  label="Choose contact methods"
+  items={[
+    { id: "email", text: "Email" },
+    { id: "slack", text: "Slack" },
+  ]}
+/>
+
 <MultiSelect
   data-testid="multiselect-roles"
   labelText="Roles"
```

**File**: `src/ComboBox/ComboBox.svelte` (modified, +0/-1)
```diff
@@ -893,7 +893,6 @@
   <ListBox
     class={comboBoxListBoxClass}
     id={comboId}
-    aria-label={ariaLabel}
     {disabled}
     invalid={showInvalid}
     {open}
```

**File**: `src/Dropdown/Dropdown.svelte` (modified, +0/-1)
```diff
@@ -694,7 +694,6 @@
   <ListBox
     {type}
     {size}
-    aria-label={$$props["aria-label"]}
     class={dropdownListBoxClass}
     on:click={(event) => {
       if (disabled || readonly) return;
```

**File**: `src/MultiSelect/MultiSelect.svelte` (modified, +0/-1)
```diff
@@ -1326,7 +1326,6 @@
   {/if}
   <ListBox
     id={comboId}
-    aria-label={ariaLabel}
     {disabled}
     invalid={showInvalid}
     invalidText={isFluid ? "" : invalidText}
```

---

### Incident Patch 3: `6bb5ca60` (2026-09-26)
**Commit Message**: fix(box): let axis spacing override a custom all-sides value

With padding="1rem" paddingX={3}, the inline padding: 1rem beat the
.bx--box-px-3 class, so the axis prop had no effect. Once an axis or
side prop is set, inline padding and margin now resolve per side.

**File**: `src/Box/Box.svelte` (modified, +32/-23)
```diff
@@ -33,6 +33,17 @@
     return scaleStyle(value, 1);
   }
 
+  /**
+   * Resolve one side's inline spacing from the first of `values` that is set.
+   * Only used once an axis or side prop is set, since an inline shorthand
+   * would beat that prop's scale class.
+   * @param {boolean} split @param {Array<SpacingValue | undefined>} values
+   */
+  function sideStyle(split, ...values) {
+    if (!split) return undefined;
+    return spacingStyle(values.find((value) => value != null));
+  }
+
   /**
    * Resolve `border-{side}-width` for the one side `borderSide` targets;
    * the other three sides are zeroed by the `bx--box-border-side-{side}` class.
@@ -430,31 +441,29 @@
     borderSide,
     borderWidth,
   );
-  $: resolvedPadding = spacingStyle(padding);
-  $: resolvedPaddingX = spacingStyle(paddingX);
-  $: resolvedPaddingY = spacingStyle(paddingY);
-  // An inline `margin` or `margin-inline` would beat a side's scale class, so
-  // once any side is set, every inline margin resolves per side instead.
+  $: paddingSplit = paddingX != null || paddingY != null;
+  $: resolvedPadding = paddingSplit ? undefined : spacingStyle(padding);
+  $: resolvedPaddingTop = sideStyle(paddingSplit, paddingY, padding);
+  $: resolvedPaddingRight = sideStyle(paddingSplit, paddingX, padding);
+  $: resolvedPaddingBottom = sideStyle(paddingSplit, paddingY, padding);
+  $: resolvedPaddingLeft = sideStyle(paddingSplit, paddingX, padding);
   $: marginSplit =
+    marginX != null ||
+    marginY != null ||
     marginTop != null ||
     marginRight != null ||
     marginBottom != null ||
     marginLeft != null;
   $: resolvedMargin = marginSplit ? undefined : spacingStyle(margin);
-  $: resolvedMarginX = marginSplit ? undefined : spacingStyle(marginX);
-  $: resolvedMarginY = marginSplit ? undefined : spacingStyle(marginY);
-  $: resolvedMarginTop = marginSplit
-    ? spacingStyle(marginTop ?? marginY ?? margin)
-    : undefined;
-  $: resolvedMarginRight = marginSplit
-    ? spacingStyle(marginRight ?? marginX ?? margin)
-    : undefined;
-  $: resolvedMarginBottom = marginSplit
-    ? spacingStyle(marginBottom ?? marginY ?? margin)
-    : undefined;
-  $: resolvedMarginLeft = marginSplit
-    ? spacingStyle(marginLeft ?? marginX ?? margin)
-    : undefined;
+  $: resolvedMarginTop = sideStyle(marginSplit, marginTop, marginY, margin);
+  $: resolvedMarginRight = sideStyle(marginSplit, marginRight, marginX, margin);
+  $: resolvedMarginBottom = sideStyle(
+    marginSplit,
+    marginBottom,
+    marginY,
+    margin,
+  );
+  $: resolvedMarginLeft = sideStyle(marginSplit, marginLeft, marginX, margin);
   $: resolvedHeight = viewportStyle(height);
   $: resolvedMinHeight = viewportStyle(minHeight);
   $: resolvedMaxHeight = spacingStyle(maxHeight);
@@ -479,11 +488,11 @@
   style:border-bottom-width={resolvedBorderBottomWidth}
   style:border-left-width={resolvedBorderLeftWidth}
   style:padding={resolvedPadding}
-  style:padding-inline={resolvedPaddingX}
-  style:padding-block={resolvedPaddingY}
+  style:padding-top={resolvedPaddingTop}
+  style:padding-right={resolvedPaddingRight}
+  style:padding-bottom={resolvedPaddingBottom}
+  style:padding-left={resolvedPaddingLeft}
   style:margin={resolvedMargin}
-  style:margin-inline={resolvedMarginX}
-  style:margin-block={resolvedMarginY}
   style:margin-top={resolvedMarginTop}
   style:margin-right={resolvedMarginRight}
   style:margin-bottom={resolvedMarginBottom}
```

**File**: `tests/Box/Box.test.svelte` (modified, +6/-0)
```diff
@@ -45,6 +45,12 @@
 <Box padding={5}>Padding scale</Box>
 <Box padding="1.5rem">Custom padding</Box>
 <Box paddingX={3} paddingY={5}>Axis padding</Box>
+<Box padding="1rem" paddingX={3} data-testid="padding-axis-over-custom"
+  >Padding axis over custom</Box
+>
+<Box margin="1rem" marginY={3} data-testid="margin-axis-over-custom"
+  >Margin axis over custom</Box
+>
 <Box margin={4}>Margin scale</Box>
 <Box marginY={7} marginTop={3} data-testid="margin-top-scale"
   >Margin top scale</Box
```

**File**: `tests/Box/Box.test.ts` (modified, +12/-0)
```diff
@@ -125,6 +125,18 @@ describe("Box", () => {
     expect(screen.getByText("Margin scale")).toHaveClass("bx--box-m-4");
   });
 
+  it("lets an axis scale step override a custom all-sides value", () => {
+    render(Box);
+
+    const padding = screen.getByTestId("padding-axis-over-custom");
+    expect(padding).toHaveClass("bx--box-px-3");
+    expectInlineStyle(padding, { paddingLeft: "", paddingTop: "1rem" });
+
+    const margin = screen.getByTestId("margin-axis-over-custom");
+    expect(margin).toHaveClass("bx--box-my-3");
+    expectInlineStyle(margin, { marginTop: "", marginLeft: "1rem" });
+  });
+
   it("applies custom padding via inline style", () => {
     render(Box);
 
```

---

### Incident Patch 4: `017bb487` (2026-09-26)
**Commit Message**: fix(tree-view): set node label type to match v11

Labels inherited the surrounding font size; v11 sets body-compact-01.

**File**: `css/vendor/carbon-components/scss/components/treeview/_treeview.scss` (modified, +3/-0)
```diff
@@ -51,6 +51,9 @@
     }
 
     .#{$prefix}--tree-node__label {
+      // ccs: match v11, which sets `body-compact-01` instead of inheriting.
+      @include type-style('body-short-01');
+
       display: flex;
       min-height: to-rem(32px);
       flex: 1;
```

---

### Incident Patch 5: `44db65e7` (2026-09-26)
**Commit Message**: fix(inline-loading): use 14px text to match v11

v11 sets the text in label-02 (14px) instead of label-01 (12px);
body-short-01 has the same values.

**File**: `css/vendor/carbon-components/scss/components/inline-loading/_inline-loading.scss` (modified, +2/-1)
```diff
@@ -24,7 +24,8 @@
   }
 
   .#{$prefix}--inline-loading__text {
-    @include type-style('label-01');
+    // ccs: match v11 `label-02` (14px), which has the same values as `body-short-01`.
+    @include type-style('body-short-01');
 
     color: $text-02;
   }
```

---

### Incident Patch 6: `81a3eff6` (2026-09-26)
**Commit Message**: fix(pin-code-input): use sans for fields

IBM Plex Sans figures are already tabular, so mono is not needed to
align the segments and made the fields inconsistent with TextInput.

**File**: `css/_pin-code-input.scss` (modified, +0/-1)
```diff
@@ -34,7 +34,6 @@
     height: to-rem(40px);
     padding: 0;
     text-align: center;
-    font-family: carbon--font-family("mono");
   }
 
   .#{$prefix}--pin-code-input__field--uppercase {
```

---

### Incident Patch 7: `f2ab60a8` (2026-09-26)
**Commit Message**: fix(tooltip): use body-short-01 for portal tooltip content

The base portal content hand-set 14px/400 with no line-height or
letter-spacing, unlike the icon and definition variants.

**File**: `css/_tooltip.scss` (modified, +2/-2)
```diff
@@ -111,6 +111,8 @@
   }
 
   .#{$prefix}--tooltip-portal__content {
+    @include type-style("body-short-01");
+
     display: flex;
     align-items: center;
     width: max-content;
@@ -120,8 +122,6 @@
     border-radius: to-rem(2px);
     background-color: $inverse-02;
     color: $inverse-01;
-    font-size: to-rem(14px);
-    font-weight: 400;
     text-align: center;
   }
 
```

---

### Incident Patch 8: `350e0098` (2026-09-26)
**Commit Message**: fix(slider): use sans for range labels to match v11

Range labels used v10's mono code-02; v11 uses body-compact-01.

**File**: `css/vendor/carbon-components/scss/components/slider/_slider.scss` (modified, +2/-1)
```diff
@@ -34,7 +34,8 @@
   }
 
   .#{$prefix}--slider__range-label {
-    @include type-style('code-02');
+    // ccs: match v11 (`body-compact-01`) instead of v10's mono `code-02`.
+    @include type-style('body-short-01');
 
     color: $text-01;
     white-space: nowrap;
```

---

### Incident Patch 9: `b44839b6` (2026-09-26)
**Commit Message**: fix(number-input): use sans 400 type to match v11

Render the value in body-short-01 (v11 body-compact-01) instead of v10's
code-01 mono at weight 300, and switch the bare input[type=number] rule
from mono to sans as v11 does.

**File**: `css/vendor/carbon-components/scss/components/form/_form.scss` (modified, +2/-1)
```diff
@@ -72,8 +72,9 @@
     height: to-rem(14px);
   }
 
+  // ccs: match v11 (sans) instead of v10's mono.
   input[type='number'] {
-    font-family: carbon--font-family('mono');
+    font-family: carbon--font-family('sans');
   }
 
   input[data-invalid]:not(:focus),
```

**File**: `css/vendor/carbon-components/scss/components/number-input/_number-input.scss` (modified, +3/-3)
```diff
@@ -30,7 +30,8 @@
 
   .#{$prefix}--number input[type='number'],
   .#{$prefix}--number input[type='text'] {
-    @include type-style('code-01', $omit: (font-family, font-weight));
+    // ccs: match v11 (`body-compact-01`, sans, 400) instead of v10's mono 300.
+    @include type-style('body-short-01');
     @include focus-outline('reset');
 
     display: inline-flex;
@@ -49,8 +50,7 @@
     background-color: $field-01;
     border-radius: 0;
     color: $text-01;
-    font-family: carbon--font-family('mono');
-    font-weight: 300;
+    font-family: carbon--font-family('sans');
     transition: background-color $duration--fast-01 motion(standard, productive);
 
     &:focus {
```

---

### Incident Patch 10: `231b711e` (2026-09-26)
**Commit Message**: fix(ui-shell): mark a SideNavMenu with a slotted icon as icon'd

The `bx--side-nav__item--icon` class only checked the `icon` prop, so a
trigger icon passed through the `icon` slot rendered without it and its
child links lost Carbon's icon-aligned indentation.

**File**: `src/UIShell/SideNavMenu.svelte` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@
 
 <li
   class:bx--side-nav__item={true}
-  class:bx--side-nav__item--icon={icon}
+  class:bx--side-nav__item--icon={icon || $$slots.icon}
   class:bx--side-nav__item--large={large}
 >
   <button
```

**File**: `tests/UIShell/SideNavMenuIcon.test.svelte` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+<script lang="ts">
+  import SideNavMenu from "carbon-components-svelte/UIShell/SideNavMenu.svelte";
+  import Home from "carbon-icons-svelte/lib/Home.svelte";
+</script>
+
+<SideNavMenu text="Prop icon" icon={Home} />
+<SideNavMenu text="Slot icon">
+  <Home slot="icon" />
+</SideNavMenu>
+<SideNavMenu text="No icon" />
```

**File**: `tests/UIShell/SideNavMenuIcon.test.ts` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import { render, screen } from "@testing-library/svelte";
+import SideNavMenuIcon from "./SideNavMenuIcon.test.svelte";
+
+describe("SideNavMenu icon", () => {
+  it.each([
+    ["Prop icon", true],
+    ["Slot icon", true],
+    ["No icon", false],
+  ])("%s sets the icon item class: %s", (text, iconClass) => {
+    render(SideNavMenuIcon);
+
+    const item = screen.getByRole("button", { name: text }).parentElement;
+    assert(item);
+    expect(item.classList.contains("bx--side-nav__item--icon")).toBe(iconClass);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #4140** (2026-09-29): feat(breadcrumb): add `orientation` prop to pin the layout (@metonym)
- **PR #4134** (2026-09-26): docs(virtual-list): use Box rows and match status to InlineLoading (@metonym)
- **PR #4133** (2026-09-26): chore(deps-dev): bump sveld to 0.38.0 (@metonym)
- **PR #4132** (2026-09-26): feat(box): add single-side padding props (@metonym)
- **PR #4131** (2026-09-26): chore(deps-dev): bump sveld to 0.37.9 (@metonym)
- **PR #4130** (2026-09-26): chore(deps-dev): upgrade ostia to 0.2.7 (@metonym)
- **PR #4129** (2026-09-26): fix(number-input): use sans 400 type to match v11 (@metonym)
- **PR #4125** (2026-09-26): feat(ui-shell): indent nested SideNavMenu by depth (@metonym)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
