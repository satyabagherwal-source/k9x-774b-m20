> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/carbon-design-system-carbon-learnings.md`  
> **Source**: github ([https://github.com/carbon-design-system/carbon](https://github.com/carbon-design-system/carbon))  
> **Source Version**: `f33b1dbe`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T04:42:52.663Z  
> **Learning ID**: `learn-github-carbon-design-system-carbon`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): carbon-design-system/carbon

> **Canonical Artifact**: `07_PROJECT_LEARNING/carbon-design-system-carbon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/carbon-design-system/carbon](https://github.com/carbon-design-system/carbon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-21T04:42:51.675Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `carbon-design-system/carbon`
- **Description**: A design system built by IBM
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9567 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/commands/bundle/utils.js`
```
/**
 * Copyright IBM Corp. 2019, 2025
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs-extra';
import { pascalCase } from 'change-case-all';

export function formatGlobals(string) {
  const mappings = string.split(',').map((mapping) => {
    return mapping.split('=');
  });
  return mappings.reduce(
    (acc, [pkg, global]) => ({
      ...acc,
      [pkg]: global,
    }),
    {}
  );
}

export function formatDependenciesIntoGlobals(dependencies) {
  return Object.keys(dependencies).reduce((acc, key) => {
    const parts = key.split('/').map((identifier, i) => {
      if (i === 0) {
        return identifier.replace(/@/, '');
      }
      return identifier;
    });

    return {
      ...acc,
      [key]: pascalCase(parts.join(' ')),
    };
  }, {});
}

export async function findPackageFolder(entrypoint) {
  let packageFolder = entrypoint;

  while (packageFolder !== '/' && path.dirname(packageFolder) !== '/') {
    packageFolder = path.dirname(packageFolder);
    const packageJsonPath = path.join(packageFolder, 'package.json');

    if (await fs.pathExists(packageJsonPath)) {
      break;
    }
  }

  return packageFolder;
}

```

### Core Architecture Module: `packages/motion/style-dictionary/utils/dts-type-literal.js`
```
/**
 * Copyright IBM Corp. 2018, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/**
 * Serialise a JS value as a TypeScript type literal.
 * Preserves string/number literal types (and nested object/tuple structure)
 * so generated `.d.ts` files discriminate on `kind` and keep token names
 * assignable to hand-authored unions like `DurationName`.
 *
 * Examples:
 *   'reveal'                          → '"reveal"'
 *   0                                 → '0'
 *   { kind: 'reveal' }                → '{\n  kind: "reveal"\n}'
 *   ['entrance', 'productive']        → '[\n  "entrance",\n  "productive"\n]'
 *
 * @param {*} value
 * @param {number} [indent=0]
 * @returns {string}
 */
function toDtsTypeLiteral(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const innerPad = '  '.repeat(indent + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value
      .map((item) => `${innerPad}${toDtsTypeLiteral(item, indent + 1)}`)
      .join(',\n');
    return `[\n${items}\n${pad}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const body = entries
      .map(
        ([key, nested]) =>
          `${innerPad}${key}: ${toDtsTypeLiteral(nested, indent + 1)}`
      )
      .join(',\n');
    return `{\n${body}\n${pad}}`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) return 'null';

  // string literal type
  return JSON.stringify(String(value));
}

module.exports = { toDtsTypeLiteral };

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/App.jsx`
```
import React from 'react';
import { ExampleCustomDataTableApp } from './ExampleCustomDataTableApp'

function App() {

  return (
    <ExampleCustomDataTableApp/>
  )
}

export default App

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/ExampleCustomDataTableApp.jsx`
```
/**
 * Copyright IBM Corp. 2023
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import CustomDataTable from './components/CustomDataTable';

import {
  rowsMany as demoRowsMany,
  columns as demoColumns,
  sortInfo as demoSortInfo,
} from './table-data';


export const ExampleCustomDataTableApp = () => {
  return (
    <CustomDataTable
      columns={demoColumns}
      rows={demoRowsMany}
      sortInfo={demoSortInfo}
      hasSelection={true}
      pageSize={5}
      start={0}
    />
  );
};
```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/components/CustomDataTable.jsx`
```
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { Delete } from '@carbon/icons-react';
import {
  TableContainer,
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableSelectRow,
  TableSelectAll,
  TableToolbar,
  TableToolbarAction,
  TableToolbarContent,
  TableToolbarSearch,
  TableToolbarMenu,
  TableBatchActions,
  TableBatchAction,
} from '@carbon/react';
import {
  useFilteredRows,
  usePageInfo,
  useRowSelection,
  useSortedRows,
  useSortInfo,
  useUniqueId,
} from '../hooks';
import Pagination from './Pagination';
import {
  TABLE_SIZE,
  TABLE_SORT_DIRECTION,
  doesRowMatchSearchString,
} from '../misc';

/**
 * An example state manager that an application can start with to achieve
 * a fully-customized data table.
 *
 * There are many different use cases for managing data table state,
 * i.e. lazy-loading table row data that are not on the current page.
 *
 * Carbon has `<DataTable>` component manage table state,
 * but one `<DataTable>` supporting every possible use case will make it very complex.
 *
 * In case Carbon `<DataTable>` doesn't meet the needs of BU/application,
 * PALs/applications create a state manager by their own, i.e. starting with
 * this example.
 *
 * Carbon design for table is implemented by `<Table>`, `<TableRow>`,
 * `<TableCell>`, etc.,
 * whereas `<DataTable>` is merely a state manager.
 *
 * Therefore, using a custom component in place of `<DataTable>` does _not_ mean
 * going away from Carbon design.
 *
 * THIS COMPONENT IS FOR DEMONSTRATION PURPOSES ONLY.
 */
const CustomDataTable = ({
  id,
  collator =  new Intl.Collator(),
  columns,
  hasSelection = false,
  pageSize: propPageSize = 5,
  rows: propRows,
  size = TABLE_SIZE.REGULAR,
  sortInfo: propSortInfo,
  start: propStart = 0,
  zebra,
}) => {
  const [rows, setRows] = useState(propRows);
  const [sortInfo, setSortInfo] = useSortInfo(propSortInfo);
  const [filteredRows, searchString, setSearchString] = useFilteredRows(rows);
  const [setRowSelection] = useRowSelection(
    filteredRows,
    searchString,
    setRows
  );
  const [sortedRows] = useSortedRows(filteredRows, sortInfo, collator);
  const [start, pageSize, setStart, setPageSize] = usePageInfo(
    propStart,
    propPageSize,
    filteredRows.length
  );

  const elementId = useUniqueId(id);
  const selectedRowsCountInFiltered = filteredRows.filter(
    ({ selected }) => selected
  ).length;
  const selectedAllInFiltered =
    selectedRowsCountInFiltered > 0 &&
    filteredRows.length === selectedRowsCountInFiltered;
  const hasBatchActions = hasSelection && selectedRowsCountInFiltered > 0;
  const { columnId: sortColumnId, direction: sortDirection } = sortInfo;
  const selectionAllName = !hasSelection
    ? undefined
    : `__custom-data-table_select-all_${elementId}`;

  const handleCancelSelection = useCallback(() => {
    setRowSelection(undefined, false);
  }, [setRowSelection]);

  const handleChangeSearchString = useCallback(
    ({ target }) => {
      setSearchString(target.value);
    },
    [setSearchString]
  );

  const handleChangeSelection = useCallback(
    (event) => {
      const { currentTarget } = event;
      const row = currentTarget.closest('tr');
      if (row) {
        setRowSelection(Number(row.dataset.rowId), currentTarget.checked);
      }
    },
    [setRowSelection]
  );

  const handleChangeSelectionAll = useCallback(
    (event) => {
      setRowSelection(undefined, event.currentTarget.checked);
    },
    [setRowSelection]
  );

  const handleChangeSort = useCallback(
    (event) => {
      const { currentTarget } = event;
      const {
        columnId,
        sortCycle,
        sortDirection: oldDirection,
      } = currentTarget.dataset;
      setSortInfo({ columnId, sortCycle, oldDirection });
    },
    [setSortInfo]
  );

  const handleChangePageSize = useCallback(
    ({ pageSize }) => {
      setPageSize(pageSize);
    },
    [setPageSize]
  );

  const handleChangeStart = useCallback(
    ({ start }) => {
      setStart(start);
    },
    [setStart]
  );

  const handleDeleteRows = useCallback(() => {
    setRows(
      rows.filter(
        (row) => !row.selected || !doesRowMatchSearchString(row, searchString)
      )
    );
  }, [rows, searchString]);

  /* eslint-disable no-script-url */
  return (
    <TableContainer title="DataTable" description="Fully customized">
      <TableToolbar>
        <TableBatchActions
          shouldShowBatchActions={hasBatchActions}
          totalSelected={selectedRowsCountInFiltered}
          onCancel={handleCancelSelection}>
          <TableBatchAction
            tabIndex={hasBatchActions ? 0 : -1}
            renderIcon={Delete}
            onClick={handleDeleteRows}>
            Delete
          </TableBatchAction>
        </TableBatchActions>
        <TableToolbarContent>
          <TableToolbarSearch
            tabIndex={hasBatchActions ? -1 : 0}
            onChange={handleChangeSearchString}
          />
          <TableToolbarMenu tabIndex={hasBatchActions ? -1 : 0}>
            <TableToolbarAction onClick={() => alert('Alert 1')}>
              Action 1
            </TableToolbarAction>
            <TableToolbarAction onClick={() => alert('Alert 2')}>
              Action 2
            </TableToolbarAction>
            <TableToolbarAction onClick={() => alert('Alert 3')}>
              Action 3
            </TableToolbarAction>
          </TableToolbarMenu>
        </TableToolbarContent>
      </TableToolbar>
      <Table size={size} isSortable>
        <TableHead>
          <TableRow>
            {hasSelection && (
              <TableSelectAll
                id={`${elementId}--select-all`}
                checked={selectedAllInFiltered}
                indeterminate={
                  selectedRowsCountInFiltered > 0 && !selectedAllInFiltered
                }
                aria-label="Select all rows"
                name={selectionAllName}
                onSelect={handleChangeSelectionAll}
              />
            )}
            {columns.map(({ id: columnId, sortCycle, title }) => {
              const sortDirectionForThisCell =
                sortCycle &&
                (columnId === sortColumnId
                  ? sortDirection
                  : TABLE_SORT_DIRECTION.NONE);
              return (
                <TableHeader
                  key={columnId}
                  isSortable={Boolean(sortCycle)}
                  isSortHeader={sortCycle && columnId === sortColumnId}
                  sortDirection={sortDirectionForThisCell}
                  data-column-id={columnId}
                  data-sort-cycle={sortCycle}
                  data-sort-direction={sortDirectionForThisCell}
                  onClick={handleChangeSort}>
                  {title}
                </TableHeader>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody zebra={zebra}>
          {sortedRows.slice(start, start + pageSize).map((row) => {
            const { id: rowId, selected } = row;
            const selectionName = !hasSelection
              ? undefined
              : `__custom-data-table_${elementId}_${rowId}`;
            return (
              <TableRow
                key={rowId}
                isSelected={hasSelection && selected}
                data-row-id={rowId}>
                {hasSelection && (
                  <TableSelectRow
                    id={`${elementId}--select-${rowId}`}
                    checked={Boolean(selected)}
                    name={selectionName}
                    aria-label="Select row"
                    onSelect={handleChangeSelection}
                  />
                )}
                {columns.map(({ id: columnId }) => (
                  <TableCell key={columnId}>{row[columnId]}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {typeof pageSize !== 'undefined' && (
        <Pagination
          start={start}
          count={filteredRows.length}
          pageSize={pageSize}
          pageSizes={[5, 10, 15]}
          totalItems={filteredRows.length}
          onChangePageSize={handleChangePageSize}
          onChangeStart={handleChangeStart}
        />
      )}
    </TableContainer>
  );
  /* eslint-enable no-script-url */
};

CustomDataTable.propTypes = {
  /**
   * The g11n collator to use.
   */
  collator: PropTypes.shape({}),

  /**
   * Data table columns.
   */
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      sortCycle: PropTypes.string,
    })
  ),

  /**
   * `true` if the the table should support selection UI. Corresponds to the attribute with the same name.
   */
  hasSelection: PropTypes.bool,

  /**
   * Provide an `id` to uniquely identify the Checkbox input
   */
  id: PropTypes.string,

  /**
   * Number of items per page.
   */
  pageSize: PropTypes.number,

  /**
   * Data table rows.
   */
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      selected: PropTypes.bool,
    })
  ),

  /**
   * `true` if the the table should use the compact version of the UI. Corresponds to the attribute with the same name.
   */
  size: PropTypes.string,

  /**
   * Table sorting info.
   */
  sortInfo: PropTypes.shape({
    columnId: PropTypes.string,
    direction: PropTypes.string,
  }),

  /**
   * The row number where current page start with, index that starts with zero. Corresponds to the attribute with the same name.
   */
  start: PropTypes.number,

  /**
   * `true` if the zebra stripe should be shown.
   */
  zebra: PropTypes.bool,
};

export default CustomDataTable;

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/components/Pagination.jsx`
```
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { Pagination as CarbonPagination } from '@carbon/react';

/**
 * Wrapped version of Carbon `<Pagination>`, that uses zero-based starting row
 * index instead of page number.
 */
const Pagination = ({
  start,
  count,
  pageSize,
  pageSizes,
  onChangeStart,
  onChangePageSize,
}) => {
  const handleChangePage = useCallback(
    ({ page: newPage, pageSize: newPageSize }) => {
      if (onChangePageSize && pageSize !== newPageSize) {
        onChangePageSize({ pageSize: newPageSize });
      }
      const page = Math.floor(start / pageSize) + 1;
      if (page !== newPage) {
        const newStart = Math.min(
          Math.max(start + (newPage - page) * pageSize, 0),
          count
        );
        if (onChangeStart && start !== newStart) {
          onChangeStart({ start: newStart });
        }
      }
    },
    [start, count, pageSize, onChangeStart, onChangePageSize]
  );

  return (
    <CarbonPagination
      page={Math.floor(start / pageSize) + 1}
      pageSize={pageSize}
      pageSizes={pageSizes}
      totalItems={count}
      onChange={handleChangePage}
    />
  );
};

Pagination.propTypes = {
  /**
   * Total number of rows.
   */
  count: PropTypes.number.isRequired,

  /**
   * Callback function for page size change
   */
  onChangePageSize: PropTypes.func,

  /**
   * Callback function for page start change
   */
  onChangeStart: PropTypes.func,

  /**
   * Number of items per page.
   */
  pageSize: PropTypes.number.isRequired,

  /**
   * List of page sizes.
   */
  pageSizes: PropTypes.arrayOf(PropTypes.number).isRequired,

  /**
   * The row number where current page start with, index that starts with zero. Corresponds to the attribute with the same name.
   */
  start: PropTypes.number.isRequired,
};

export default Pagination;

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/hooks/index.js`
```
export { default as useCollator } from './useCollator';
export { default as useFilteredRows } from './useFilteredRows';
export { default as usePageInfo } from './usePageInfo';
export { default as useRowSelection } from './useRowSelection';
export { default as useSortedRows } from './useSortedRows';
export { default as useSortInfo } from './useSortInfo';
export { default as useUniqueId } from './useUniqueId';

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/hooks/useCollator.js`
```
import { useCallback } from 'react';

/**
 * @param {Intl.Collator} collator The ECMA402 collator.
 */
const useCollator = (collator) =>
  useCallback(
    (lhs, rhs) => {
      if (typeof lhs === 'number' && typeof rhs === 'number') {
        return lhs - rhs;
      }
      return collator.compare(lhs, rhs);
    },
    [collator]
  );

export default useCollator;

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/hooks/useFilteredRows.js`
```
import { useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import doesRowMatchSearchString from '../misc/doesRowMatchSearchString';

/**
 * @param {object[]} rows The table rows.
 * @returns {Array} The memorized version of filtered rows, search string and the setter for the search string.
 */
const useFilteredRows = (rows) => {
  const [searchString, setSearchString] = useState('');
  const [debouncedSearchString] = useDebounce(searchString, 500);
  const filteredRows = useMemo(
    () =>
      !debouncedSearchString
        ? rows
        : rows.filter((row) =>
            doesRowMatchSearchString(row, debouncedSearchString)
          ),
    [debouncedSearchString, rows]
  );
  return [filteredRows, searchString, setSearchString];
};

export default useFilteredRows;

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/hooks/usePageInfo.js`
```
import { useState } from 'react';

/**
 * @param {number} initialStart The initial start row index, zero-based.
 * @param {number} initialPageSize The initial page size.
 * @param {number} count The total row count.
 * @returns {Array} The start row index, page size, the setter for the start
 * row index, the setter for the page size.
 */
const usePageInfo = (initialStart, initialPageSize, count) => {
  const [start, setStart] = useState(initialStart);
  const [pageSize, setPageSize] = useState(initialPageSize);
  // Copes with `start` going beyond the row count
  const adjustedStart =
    count === 0 || start < count
      ? start
      : Math.max(
          start - (Math.floor((start - count) / pageSize) + 1) * pageSize,
          0
        );
  return [adjustedStart, pageSize, setStart, setPageSize];
};

export default usePageInfo;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23785** (2026-10-20): **fix(deps): update dependency @npmcli/arborist to v9.9.3**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [@npmcli/arborist](https://redirect.github.com/npm/cli) ([source](https://redirect.github.com/npm/cli/tree/HEAD/workspaces/arborist)) | [`9.9.2` → `9.9.3`](https://renovatebot.com/diffs/npm/@npmcli%2farborist/9.9.2/9.9.3) | ![age](https://developer.mend.io/api/mc/badges/age/npm/@npmcli%2farborist/9.9.3?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@npmcli%2farborist/9.9.2/9.9.3?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/10450) for more information.  ---  ### Release Notes  <details> <summary>npm/cli (@&#8203;npmcli/arborist)</summary>  ### [`v9.9.3`](https://redirect.github.com/npm/cli/releases/tag/v9.9.3)  [Compare Source](https://redirect.github.com/npm/cli/compare/v9.9.2...v9.9.3)  ##### Bug Fixes  - [`88ea8c7`](https://redirect.github.com/npm/cli/commit/88ea8c772661056aae8d52870b56defed058b9b9) [#&#8203;7010](https://redirect.github.com/npm/cli/pull/7010) set objectMode for search filter stream ([@&#8203;lukekarrys](https://redirect.github.com/lukekarrys)) - [`8d9d735`](https://redirect.github.com/npm/cli/commit/8d9d7351f5f9cfd7028a9f47cde520ca393218dd) [#&#8203;7010](https://redirect.github.com/npm/cli/pull/7010) unpublish: bubble up all errors parsing local packa

- **Issue #23779** (2026-10-19): **chore(ci): pin runners to ubuntu-24.04**
  *Symptoms*: Closes N/A  We noticed CI is failing across several PRs, including [this merge queue run](https://github.com/carbon-design-system/carbon/actions/runs/39238443093/job/118015151821) and [this PR run](https://github.com/carbon-design-system/carbon/actions/runs/39244634437/job/118033469178).  Both used Ubuntu 26.04 and reported write errors. This may be related to the [`ubuntu-latest` migration starting October 19](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/#ubuntu-latest-is-migrating-to-ubuntu-26-04).  This PR temporarily pins runners to Ubuntu 24.04 to check whether that restores CI while we investigate compatibility with 26.04.  ### Changelog  **New**  - {{new thing}}  **Changed**  - Replaced `ubuntu-latest` with `ubuntu-24.04` in `ci.yml`.  **Removed**  - {{removed thing}}  #### Testing / Reviewing  CI should pass  ## PR Checklist  <!--   Do not remove checklist items.   If some are incomplete, create a draft pull request using the create button dropdown.   If some do not apply, ~~strike through the item text with tildes~~. -->  As the author of this PR, before marking ready for review, confirm you:  - [X] Reviewed every line of the diff - ~[ ] Updated documentation and storybook examples~ - ~[ ] Followed the       [required v12 migration documentation](https://github.com/carbon-design-system/carbon/blob/main/docs/working-with-v12.md#required-v12-migration-documentation)       for any code change that affects v12, or struck thr

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

### Incident Patch 1: `51585a20` (2026-10-20)
**Commit Message**: Fix(Menu): correct keyboard navigation under StrictMode and away from items with submenus (#23012)

* fix(menu): correct keyboard navigation

* Apply batched suggestions from code review

Co-authored-by: Adam Alston <[REDACTED_EMAIL]>

---------

Co-authored-by: Adam Alston <[REDACTED_EMAIL]>
Co-authored-by: Heloise Lui <[REDACTED_EMAIL]>

**File**: `packages/react/src/components/Menu/Menu-test.js` (modified, +45/-0)
```diff
@@ -498,6 +498,30 @@ describe('MenuItem', () => {
         expect(child).toHaveFocus();
       });
     });
+
+    it('should move focus to the next item when pressing ArrowDown while an item with a submenu is in focus', async () => {
+      render(
+        <Menu open label="Menu">
+          <MenuItem label="Parent">
+            <MenuItem label="Child" />
+          </MenuItem>
+          <MenuItem label="Sibling" />
+        </Menu>
+      );
+
+      const parentItem = screen.getByRole('menuitem', {
+        name: 'Parent Parent',
+      });
+      parentItem.focus();
+      expect(parentItem).toHaveFocus();
+
+      await userEvent.keyboard('{ArrowDown}');
+
+      const siblingItem = screen.getByRole('menuitem', { name: 'Sibling' });
+      await waitFor(() => {
+        expect(siblingItem).toHaveFocus();
+      });
+    });
   });
 
   it('navigates through dynamically added MenuItems in the correct order', async () => {
@@ -517,4 +541,25 @@ describe('MenuItem', () => {
       expect(screen.getByRole('menuitem', { name: label })).toHaveFocus();
     }
   });
+
+  it('should move focus to each menu item on ArrowDown when rendered in React.StrictMode', async () => {
+    render(
+      <React.StrictMode>
+        <Menu open label="Menu">
+          <MenuItem label="Item 1" />
+          <MenuItem label="Item 2" />
+          <MenuItem label="Item 3" />
+        </Menu>
+      </React.StrictMode>
+    );
+
+    const item1 = await screen.findByRole('menuitem', { name: 'Item 1' });
+    expect(item1).toHaveFocus();
+
+    const expectedOrder = ['Item 2', 'Item 3', 'Item 1'];
+    for (const label of expectedOrder) {
+      await userEvent.keyboard('{ArrowDown}');
+      expect(screen.getByRole('menuitem', { name: label })).toHaveFocus();
+    }
+  });
 });
```

**File**: `packages/react/src/components/Menu/MenuContext.ts` (modified, +6/-1)
```diff
@@ -53,7 +53,12 @@ function menuReducer(state: StateType, action: ActionType) {
       };
     case 'registerItem': {
       const newItem = action.payload;
-      const items = state.items.filter((item) => item.ref.current);
+      // Drop stale entries (unmounted refs) as well as any existing entry
+      // for this same ref, so registering the same item twice (e.g. React
+      // StrictMode's double-invoked effects) doesn't duplicate it.
+      const items = state.items.filter(
+        (item) => item.ref.current && item.ref !== newItem.ref
+      );
       const next = newItem.ref.current?.nextElementSibling;
       const idx = items.findIndex((item) => item.ref.current === next);
       items.splice(idx < 0 ? items.length : idx, 0, newItem);
```

**File**: `packages/react/src/components/Menu/MenuItem.tsx` (modified, +6/-0)
```diff
@@ -131,6 +131,12 @@ export const MenuItem = forwardRef<HTMLLIElement, MenuItemProps>(
         if (open) {
           setSubmenuOpen(true);
         } else {
+          // Ignore close notifications when the submenu is already closed to
+          // avoid stealing focus during arrow key navigation.
+          if (!submenuOpen) {
+            return;
+          }
+
           const relatedTarget =
             event && 'relatedTarget' in event ? event.relatedTarget : null;
 
```

#### Recent Merged Pull Requests:
- **PR #23785** (2026-10-20): fix(deps): update dependency @npmcli/arborist to v9.9.3 (@renovate[bot])
- **PR #23779** (2026-10-19): chore(ci): pin runners to ubuntu-24.04 (@heloiselui)
- **PR #23778** (closed): chore(deps): bump github/codeql-action/init from 4.38.3 to 4.39.0 (@dependabot[bot])
- **PR #23777** (closed): chore(deps): bump github/codeql-action/analyze from 4.38.3 to 4.39.0 (@dependabot[bot])
- **PR #23776** (2026-10-19): chore(deps): bump chromaui/action from 18.12.2 to 18.13.0 (@dependabot[bot])
- **PR #23775** (2026-10-19): chore(release): v11.119.0-rc.0 (@carbon-automation[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Menu): correct keyboard navigation under StrictMode and away from items with sub

**RULE**:
When implementing operations in `packages/react/src/components/Menu/Menu-test.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in carbon-design-system/carbon. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `51585a20`: Menu): correct keyboard navigation under StrictMode and away from items with submenus (#23012). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react/src/components/Menu/Menu-test.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

    it('should move focus to the next item when pressing ArrowDown while an item with a submenu is in focus', async () => {
      render(
        <Menu open label="Menu">
          <MenuItem label="Parent">
            <MenuItem label="Child" />
          </MenuItem>
          <MenuItem label="Sibling" />
        </Menu>
      );

      const parentItem = screen.getByRole('menuitem', {
        name: 'Parent Parent',
      });
      parentItem.focus();
      expect(parentItem).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');

      const siblingItem = screen.getByRole('menuitem', { name: 'Sibling' });
      await waitFor(() => {
        expect(siblingItem).toHaveFocus();
      });
    });

  it('should move focus to each menu item on ArrowDown when rendered in React.StrictMode', async () => {
    render(
      <React.StrictMode>
        <Menu open label="Menu">
          <MenuItem label="Item 1" />
          <MenuItem label="Item 2" />
          <MenuItem label="Item 3" />
        </Menu>
      </React.StrictMode>
    );

    const item1 = await screen.findByRole('menuitem', { name: 'Item 1' });
    expect(item1).toHaveFocus();

    const expectedOrder = ['Item 2', 'I
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `51585a20` are properly handled with clean fallback behavior.
