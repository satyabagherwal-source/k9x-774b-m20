# Forensic Learning Record (Deep Inspection): carbon-design-system/carbon

> **Canonical Artifact**: `07_PROJECT_LEARNING/carbon-design-system-carbon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/carbon-design-system/carbon](https://github.com/carbon-design-system/carbon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:32:58.542Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `carbon-design-system/carbon`
- **Description**: A design system built by IBM
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9529 stars

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

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/hooks/useRowSelection.js`
```
import { useCallback } from 'react';
import doesRowMatchSearchString from '../misc/doesRowMatchSearchString';

/**
 * @param {object[]} rows The table rows.
 * @param {string} searchString The search string.
 * @param {Function} setRows The setter for the table rows.
 * @returns {Array} The setter for the table row selection.
 */
const useRowSelection = (rows, searchString, setRows) => {
  const setRowSelection = useCallback(
    (rowId, selected) => {
      setRows(
        rows.map((row) => {
          const doChange = rowId
            ? rowId === row.id
            : !searchString || doesRowMatchSearchString(row, searchString);
          return !doChange ? row : { ...row, selected };
        })
      );
    },
    [rows, searchString, setRows]
  );
  return [setRowSelection];
};

export default useRowSelection;

```

### Core Architecture Module: `packages/react/examples/custom-data-table-state-manager-vite/src/hooks/useSortInfo.js`
```
import { useCallback, useState } from 'react';
import {
  TABLE_SORT_CYCLE,
  TABLE_SORT_CYCLES,
  TABLE_SORT_DIRECTION,
} from '../misc';

/**
 * @param options The options.
 * @param [options.sortCycle=tri-states-from-ascending] The sorting cycle.
 * @param options.oldDirection The old sort direction.
 * @returns The next sort direction.
 */
const getNextSort = ({
  sortCycle = TABLE_SORT_CYCLE.TRI_STATES_FROM_ASCENDING,
  oldDirection,
}) => {
  if (!oldDirection) {
    throw new TypeError(
      'Table sort direction is not defined. ' +
        'Likely that `getNextSort()` is called with non-sorted table column, which should not happen in regular condition.'
    );
  }
  const directions = TABLE_SORT_CYCLES[sortCycle];
  const index = directions.indexOf(oldDirection);
  if (index < 0) {
    if (oldDirection === TABLE_SORT_DIRECTION.NONE) {
      // If the current sort direction is `none` in bi-state sort cycle,
      // returns the first one in the cycle
      return directions[0];
    }
    throw new RangeError(
      `The given sort state (${oldDirection}) is not found in the given table sort cycle: ${sortCycle}`
    );
  }
  return directions[(index + 1) % directions.length];
};

/**
 * @param {object} initialSortInfo The initial table sort info.
 * @returns {Array} The current table sort info and the setter for the table
 * sort info.
 */
const useSortInfo = (initialSortInfo) => {
  const [sortInfo, setSortInfo] = useState(initialSortInfo);
  const invokeSetSortInfo = useCallback(
    ({ columnId, sortCycle, oldDirection }) => {
      const direction = getNextSort({ sortCycle, oldDirection });
      if (direction === TABLE_SORT_DIRECTION.NONE && columnId !== 'name') {
        // Resets the sorting, given non-primary sorting column has got in
        //  non-sorting state
        setSortInfo(initialSortInfo);
      } else {
        // Sets the sorting as user desires
        setSortInfo({
          columnId,
          direction,
        });
      }
    },
    [initialSortInfo, setSortInfo]
  );
  return [sortInfo, invokeSetSortInfo];
};

export default useSortInfo;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23667** (2026-10-07): **chore(release): v11.118.0**
  *Symptoms*: Automated release PR for v11.118.0  **Checklist**  - [ ] Verify package version bumps are accurate - [ ] Verify CI passes as expected
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-web-components* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 69f01f4171d50184f1fc362fb666ffb38edbfec6 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-web-components/deploys/6ac63edcee64350008e454cc | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23667--v12-carbon-web-components.netlify.app](https://deploy-preview-23667--v12-carbon-web-components.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjY3LS12MTItY2FyYm9uLXdlYi1jb21wb25lbnRzLm5ldGxpZnkuYXBwIn0.ZEQjn0t3PpdTmN-3-V58CW52Y-MjHiC7vuShdR7jooc)<br /><br />_Use your smartphone camera to open QR code link._</details> | |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 69f01f4171d50184f1fc362fb666ffb38edbfec6 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-react/deploys/6ac63edc205f9c0009828c22 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23667--v12-carbon-react.netlify.app](https://deploy-preview-23667--v12-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjY3LS12MTItY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.ZV_MP44Mp0Bgko0ill8xYRd6Xz-uAc5Takt28GEyu8o)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v11-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 69f01f4171d50184f1fc362fb666ffb38edbfec6 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v11-carbon-react/deploys/6ac63edcc361730007a3380b | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23667--v11-carbon-react.netlify.app](https://deploy-preview-23667--v11-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjY3LS12MTEtY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.rgoLad07bJ1bWNzXH16keuRQY2uhO5G7Kzy1l1qVRDU)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 

- **Issue #23664** (2026-10-07): **[Filterable multiselect] v12 design intent 2.0 - Spec**
  *Symptoms*: ## Acceptance criteria  This task should show the final spec based on the system wide decisions that have arrived from [design intent 2.0](https://github.com/carbon-design-system/carbon/issues/23131).  **To-do** - [x] Create the final spec - [x] Get it reviewed by @alina-jacob  - [x] Add Figma link - [x] Add spec image - [ ] Document any follow on thoughts as a comment (optional)  ---  - [Figma link](https://www.figma.com/design/v3NXAKzn9dYIUDd753xR6T/Inset-vs.-Flush-Buttons?node-id=735-36457&t=cVHvumhsee6peoYn-4)  <img width="1990" height="9180" alt="Image" src="https://github.com/user-attachments/assets/0ff9312f-d564-43ad-bb64-a845a4cc5b31" />

- **Issue #23658** (2026-10-07): **fix(ci): build missing CDN dependencies**
  *Symptoms*: Closes N/A  While doing the RC, I noticed that the Web Components CDN workflow has been failing since [`v11.114.0-rc.0`](https://github.com/carbon-design-system/carbon/actions/runs/31415528235). I traced the missing build steps to two changes:  - [#22743](https://github.com/carbon-design-system/carbon/pull/22743) moved `motion` tokens to generated files that require a build. - [#22728](https://github.com/carbon-design-system/carbon/pull/22728) updated `utilities`, so Yarn now uses the local workspace instead of the already-built npm package.  The [CI log](https://github.com/carbon-design-system/carbon/actions/runs/37355017602/job/111915241048) points to missing generated motion tokens:  ```text Error: Can't find stylesheet to import. 11 │ @use './scss/generated/tokens' as tokens;  @carbon/index.scss 11:1 ../../node_modules/@carbon/styles/scss/_motion.scss 8:1 ```  `_motion.scss` forwards `@carbon/motion`, whose [index.scss](https://github.com/carbon-design-system/carbon/blob/v11.118.0-rc.0/packages/motion/index.scss#L11) imports these generated tokens. The workflow does not build motion, so the file is missing.  The utilities error is not shown in this log, but it appeared when reproducing the build locally after building motion, so building both packages allowed `build:cdn` to complete successfully locally.  ### Changelog  **New**  - ~None.~  **Changed**  - Build `@carbon/motion` and `@carbon/utilities` before building the CDN bundles.  **Remov
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-web-components* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 891e9163b1e8a107d8c37f0f9fb391e48c5c4a44 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-web-components/deploys/6ac6059a4335240008234b90 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23658--v12-carbon-web-components.netlify.app](https://deploy-preview-23658--v12-carbon-web-components.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjU4LS12MTItY2FyYm9uLXdlYi1jb21wb25lbnRzLm5ldGxpZnkuYXBwIn0.DufiEd87ZP8YQERyWzkKQaxsUcGHqbYG7fwknA1CI_U)<br /><br />_Use your smartphone camera to open QR code link._</details> | |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 891e9163b1e8a107d8c37f0f9fb391e48c5c4a44 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-react/deploys/6ac6059af12784000817c352 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23658--v12-carbon-react.netlify.app](https://deploy-preview-23658--v12-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjU4LS12MTItY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.zJv4TTvfiPANAPQ0tedtJvCmiFg7rQV7XEIx94U4Q08)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v11-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 891e9163b1e8a107d8c37f0f9fb391e48c5c4a44 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v11-carbon-react/deploys/6ac6059a1feff800088f50ce | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23658--v11-carbon-react.netlify.app](https://deploy-preview-23658--v11-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjU4LS12MTEtY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.BmIIJsjV7KrgQNk_ifUbq0o-mm9jrt3bvDGSD2sWw5I)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 

- **Issue #23655** (2026-10-07): **chore(next): update automerge workflow**
  *Symptoms*: Refs #23395   Updates the automerge workflow from `main` to `next`. Syncs from `main` must land on `next` as merge commits, pushed directly so that individual commits from `main` keep their SHAs and authors. Merge queues on `next` squash, so the sync (automerge) job should never go through it. `next` branch protections have been updated to allow the Carbon Automation app to bypass and merge directly, which the classic branch protections did not allow.  ### Changelog  **Changed**  - `automerge.yml` now uses Carbon Automation app token - `automerge.yml`'s `GITHUB_TOKEN` changed to read-only - when merge conflicts exist, PRs now open as draft to prevent adding the PR to the queue and squash merging; also updated PR description on manually syncing `main` > `next`  #### Testing / Reviewing  Can only be tested on next sync of `main` to `next`.  ## PR Checklist  <!--    Do not remove checklist items.   If some are incomplete, create a draft pull request using the create button dropdown.   If some do not apply, ~strike through the item text with tildes~. -->  As the author of this PR, before marking ready for review, confirm you:  - [x] Reviewed every line of the diff - [x] Updated documentation and storybook examples - [ ] ~Followed the       [required v12 migration documentation](https://github.com/carbon-design-system/carbon/blob/main/docs/working-with-v12.md#required-v12-migration-documentation)       for any code change that affects v12, or struck t
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-web-components* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | e7625489797a4158412960bbb55bee1bf4603846 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-web-components/deploys/6ac55f8e5e361100080cf6e4 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23655--v12-carbon-web-components.netlify.app](https://deploy-preview-23655--v12-carbon-web-components.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjU1LS12MTItY2FyYm9uLXdlYi1jb21wb25lbnRzLm5ldGxpZnkuYXBwIn0.iwhW2-R1I1U8PhD6AJ0u2Odu__E4lj_0tAJhFx-gm4g)<br /><br />_Use your smartphone camera to open QR code link._</details> | |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | e7625489797a4158412960bbb55bee1bf4603846 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-react/deploys/6ac56a9cca645b5aaea91d03 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23655--v12-carbon-react.netlify.app](https://deploy-preview-23655--v12-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjU1LS12MTItY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.IHb1bNfj20Q6sB1GhlZhu1fpzIVhX90TNj4N00UqwtM)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v11-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | e7625489797a4158412960bbb55bee1bf4603846 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v11-carbon-react/deploys/6ac55f8e0acb7f0008d5b7be | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23655--v11-carbon-react.netlify.app](https://deploy-preview-23655--v11-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjU1LS12MTEtY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.TgonNnjRcH6SzJ9e84Mgg4UUSPOzfw1vZtEn9dikFFk)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 

- **Issue #23653** (2026-10-07): **chore(examples): remove example app lockfiles from source control**
  *Symptoms*: Follow-up of #23264  This removes example application lockfiles from source control entirely and adds them to `.gitignore`. Each example app has its own lockfile that pins their respective transitive dependencies. These stale pins are the source of constant Dependabot alerts in the repo.  The change is to have example apps resolve fresh dependencies on build.   ### Changelog  **New**  - `installExample()` helper in `tasks/examples.js` that creates sentinel lockfile and installs with `--no-immutable`, replacing 4 duplicated install blocks  **Changed**  - update Next and Vite versions in example apps  **Removed**  - all example app lockfiles  #### Testing / Reviewing  The number of reported issues in `Security and quality` should decrease significantly shortly after this merges. All CI/CD workflows should complete as expected.  ## PR Checklist  <!--    Do not remove checklist items.   If some are incomplete, create a draft pull request using the create button dropdown.   If some do not apply, ~strike through the item text with tildes~. -->  As the author of this PR, before marking ready for review, confirm you:  - [x] Reviewed every line of the diff - [x] Updated documentation and storybook examples - [ ] ~Followed the       [required v12 migration documentation](https://github.com/carbon-design-system/carbon/blob/main/docs/working-with-v12.md#required-v12-migration-documentation)       for any code change that affects v12, or struck throug
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-web-components* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 047a4fd86cfd38dcb420472dd033bad993c9e8f7 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-web-components/deploys/6ac589e7eb47920008d02059 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23653--v12-carbon-web-components.netlify.app](https://deploy-preview-23653--v12-carbon-web-components.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjUzLS12MTItY2FyYm9uLXdlYi1jb21wb25lbnRzLm5ldGxpZnkuYXBwIn0.XM_k4ja8xtHBm-rzXVsr-YCWo5hdfV4PHgStop9espw)<br /><br />_Use your smartphone camera to open QR code link._</details> | |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v11-carbon-web-components* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 047a4fd86cfd38dcb420472dd033bad993c9e8f7 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v11-carbon-web-components/deploys/6ac589e72678c20008ca8cb5 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23653--v11-carbon-web-components.netlify.app](https://deploy-preview-23653--v11-carbon-web-components.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjUzLS12MTEtY2FyYm9uLXdlYi1jb21wb25lbnRzLm5ldGxpZnkuYXBwIn0.5skM-WsoyyCgc5Z8LuYeP8HRBLYj-8UeH-vEU7l2M04)<br /><br />_Use your smartphone camera to open QR code link._</details> | |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *carbon-elements* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 047a4fd86cfd38dcb420472dd033bad993c9e8f7 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/carbon-elements/deploys/6ac589e72d47e6000848d740 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23653--carbon-elements.netlify.app](https://deploy-preview-23653--carbon-elements.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjUzLS1jYXJib24tZWxlbWVudHMubmV0bGlmeS5hcHAifQ.sItyLdFDPMsq-FXg8R5Dv8WruKg5FSRqspNj3N5JJiU)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Ru

- **Issue #23650** (2026-10-06): **[Footer actions for Side panel, Modal, Tearsheet] v12 design exploration**
  *Symptoms*: ## Acceptance criteria  **Background**: We are moving away from flush buttons in dialog components. The v12 exploration needs to define how inset buttons look and behave across all dialogs (side panel, tearsheet, modal, interstitial etc). Explorations should consider button placement, sizing, spacing, combinations, breakpoints, and edge cases to inform the final spec.  ## Tasks  - [x] Explore 3:1 and left-aligned button layouts in context - [x] Explore what button sizes work in each component - [x] Explore what spacing works between and around buttons - [x] Explore all button combinations - [x] Explore how buttons respond to breakpoints for all sizes across - [x] Explore edge cases with real button text  
  **Post-Mortem & Fix Analysis**:
  > [Footer explorations](https://www.figma.com/design/i6hMBNVKrD3VOrCZRUYeIZ/v12-explorations---Bridget?node-id=542-24319&t=FWTG0N76JG9xNvh1-1) shared during crit - Oct 6  - 3:1 buttons used when the button group takes up less than 80% of the available footer space. - Width of all the buttons is determined by the longest button label. - Horizontally aligned fluid buttons used when the button group is wider than 80% of available footer width (buttons should fill the available footer width).  - xs and small side panels will always have stacked fluid buttons by default. - medium side panels with 3+ buttons will always have stacked fluid buttons

- **Issue #23649** (2026-10-06): **chore(ci): add all issues to Design System project, remove Roadmap project workflow**
  *Symptoms*: Updates the `add-to-project` workflow so that all new issues are added to the Design System project (#39), and removes the job that was adding enhancement issues to the Roadmap project (#51).  ### Changelog  **Changed**  - All new issues are now added to the Design System project (#39) regardless of label  **Removed**  - `add-to-proposals-project` job that added `type: enhancement 💡` issues to the Roadmap project (#51) - `PROPOSALS_PROJECT_URL` and `LABEL_ENHANCEMENT` env vars (no longer referenced) - `label-operator: NOT` filter that was previously excluding enhancement issues from the Design System project  #### Testing / Reviewing  The workflow changes can be verified by confirming: 1. A new issue opened with `type: enhancement 💡` label is added to the Design System project (#39) 2. No issues are added to the Roadmap project (#51) by this workflow  ## PR Checklist  - [x] Reviewed every line of the diff - ~Updated documentation and storybook examples~ - ~Followed the required v12 migration documentation~ - ~Wrote passing tests that cover this change~ - ~Addressed any impact on accessibility (a11y)~ - ~Tested for cross-browser consistency~ - [x] Validated that this code is ready for review and status checks should pass
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 4d7e2d0d85ea8973bb3cc0b758a391169c99e931 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-react/deploys/6ac50ee37454260008890d8d | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23649--v12-carbon-react.netlify.app](https://deploy-preview-23649--v12-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjQ5LS12MTItY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.GYQ-z9_T8qfJXZMuvMZXqD8dXBiLrV74GK_76v2bphg)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-web-components* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 4d7e2d0d85ea8973bb3cc0b758a391169c99e931 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-web-components/deploys/6ac50ee3d92b46000872fd51 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23649--v12-carbon-web-components.netlify.app](https://deploy-preview-23649--v12-carbon-web-components.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjQ5LS12MTItY2FyYm9uLXdlYi1jb21wb25lbnRzLm5ldGxpZnkuYXBwIn0.Jynz8qk5lGtL4MxX8J0bYelu0mYnmbM_2s4_b64gvzI)<br /><br />_Use your smartphone camera to open QR code link._</details> | |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v11-carbon-react* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 4d7e2d0d85ea8973bb3cc0b758a391169c99e931 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v11-carbon-react/deploys/6ac50ee32c44300008b4b4e1 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23649--v11-carbon-react.netlify.app](https://deploy-preview-23649--v11-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjQ5LS12MTEtY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.QfzJWeJ-rMj_v5DvzwA9CLI1w88Ec

- **Issue #23647** (2026-10-07): **chore(code-connect): migrate to template files (M - N)**
  *Symptoms*: Closes #23483 Part of #22816  Migrates Code Connect files for `Menu`, `MenuButton`, `MultiSelect`, and `Notification` to Figma's Template API for React and Web Components.  ### Changelog  **New**  - Added Template API files for the migrated components.  **Changed**  - Migrated framework-specific parser connections to template files. - Added missing Menu `open` and accessible labels. - Aligned Web Components MenuButton `Open` handling with React. - Corrected MultiSelect example props and missing items. - Corrected unsupported Web Components menu attributes.  **Removed**  - Removed legacy parser files replaced by the new templates.  #### Testing / Reviewing Review the migrated components in Figma for both React and Web Components: https://www.figma.com/design/NwXsMCCoMg1po4KK2oUK3o/Code-connect-demo---Carbon-Design-System?node-id=219-15053&p=f&t=3F3YO86OZrv7FR3U-0  - [ ] Menu - [ ] Menu Button - [ ] Multi Select - [ ] Notification  ## PR Checklist  <!--    Do not remove checklist items.   If some are incomplete, create a draft pull request using the create button dropdown.   If some do not apply, ~strike through the item text with tildes~. -->  As the author of this PR, before marking ready for review, confirm you:  - [x] Reviewed every line of the diff - ~[ ] Updated documentation and storybook examples~ - ~[ ] Followed the       [required v12 migration documentation](https://github.com/carbon-design-system/carbon/blob/main/docs/work
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | ca2a5382a067d8ad9fd35cb38ff4c68be600c819 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-react/deploys/6ac6304036809900080c3447 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23647--v12-carbon-react.netlify.app](https://deploy-preview-23647--v12-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjQ3LS12MTItY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.bI4pMPFAFYrWtNFMS4F9n45lKuz8ks73oV3xOkE5HlA)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v12-carbon-web-components* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | ca2a5382a067d8ad9fd35cb38ff4c68be600c819 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v12-carbon-web-components/deploys/6ac630401787c3000871ea85 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23647--v12-carbon-web-components.netlify.app](https://deploy-preview-23647--v12-carbon-web-components.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjQ3LS12MTItY2FyYm9uLXdlYi1jb21wb25lbnRzLm5ldGxpZnkuYXBwIn0.vaZ3gKNMvJeDGLWZonb8ssjCbI6zb3h4sjtKGBhQCOA)<br /><br />_Use your smartphone camera to open QR code link._</details> | |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *v11-carbon-react* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | ca2a5382a067d8ad9fd35cb38ff4c68be600c819 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/v11-carbon-react/deploys/6ac6303fe117930008840888 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-23647--v11-carbon-react.netlify.app](https://deploy-preview-23647--v11-carbon-react.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTIzNjQ3LS12MTEtY2FyYm9uLXJlYWN0Lm5ldGxpZnkuYXBwIn0.4oKrFLQmIDE4aZNolWltc5PHrgPuUFgySZ9-X8o6qd0)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes 

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

### Incident Patch 1: `9d2b5f8a` (2026-10-07)
**Commit Message**: fix(ci): build missing CDN dependencies (#23658)

**File**: `.github/workflows/publish-web-components-cdn.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
       - name: Install dependencies
         run: |
           yarn install
-          yarn lerna run build --scope '@carbon/feature-flags' --scope '@carbon/layout' --scope '@carbon/themes' --scope '@carbon/icons' --stream
+          yarn lerna run build --scope '@carbon/feature-flags' --scope '@carbon/layout' --scope '@carbon/themes' --scope '@carbon/icons' --scope '@carbon/motion' --scope '@carbon/utilities' --stream
           yarn --cwd packages/web-components build:cdn
       - name: Check release type
         if: contains(github.ref_name, '-rc.')
```

---

### Incident Patch 2: `383d2b31` (2026-10-07)
**Commit Message**: fix(Slider): add Storybook controls (#22983)

* fix(Slider): add Storybook controls

* chore(sb): remove unused arg

---------

Co-authored-by: Kenny Lam <[REDACTED_EMAIL]>

**File**: `packages/react/src/components/Slider/Slider.stories.js` (modified, +260/-175)
```diff
@@ -1,11 +1,11 @@
 /**
- * Copyright IBM Corp. 2016, 2025
+ * Copyright IBM Corp. 2016, 2026
  *
  * This source code is licensed under the Apache-2.0 license found in the
  * LICENSE file in the root directory of this source tree.
  */
 
-import React, { useState } from 'react';
+import React, { useEffect, useState } from 'react';
 
 import { WithLayer } from '../../../.storybook/templates/WithLayer';
 
@@ -25,249 +25,334 @@ export default {
   },
 };
 
-export const Default = (args) => {
-  return (
-    <Slider
-      {...args}
-      labelText={`Slider (must be an increment of ${args.step})`}
-    />
-  );
+const sharedArgs = {
+  ariaLabelInput: 'Slider value',
+  disabled: false,
+  hideLabel: false,
+  hideTextInput: false,
+  inputType: 'number',
+  invalid: false,
+  invalidText: 'Enter a value within the allowed range',
+  labelText: 'Storage allocation',
+  max: 100,
+  maxLabel: ' GB',
+  min: 0,
+  minLabel: ' GB',
+  name: 'storage-allocation',
+  noValidate: false,
+  readOnly: false,
+  required: false,
+  step: 1,
+  stepMultiplier: 10,
+  value: 50,
+  warn: false,
+  warnText: 'Storage allocation is approaching the recommended limit',
 };
 
-Default.parameters = {
-  controls: {
-    exclude: ['light', 'formatLabel', 'labelText'],
-  },
+const twoHandleArgs = {
+  ...sharedArgs,
+  ariaLabelInput: 'Minimum storage allocation',
+  labelText: 'Storage allocation range',
+  name: 'minimum-storage-allocation',
+  unstable_ariaLabelInputUpper: 'Maximum storage allocation',
+  unstable_nameUpper: 'maximum-storage-allocation',
+  unstable_valueUpper: 90,
+  value: 10,
 };
 
-Default.argTypes = {
+const sharedArgTypes = {
   ariaLabelInput: {
-    control: { type: 'text' },
-  },
-  unstable_ariaLabelInputUpper: {
-    control: { type: 'text' },
+    control: 'text',
   },
   disabled: {
-    control: {
-      control: {
-        type: 'boolean',
-      },
-    },
+    control: 'boolean',
+  },
+  hideLabel: {
+    control: 'boolean',
   },
   hideTextInput: {
-    control: {
-      type: 'boolean',
-    },
+    control: 'boolean',
+  },
+  inputType: {
+    control: 'text',
   },
   invalid: {
-    control: {
-      type: 'boolean',
-    },
+    control: 'boolean',
   },
   invalidText: {
-    control: {
-      type: 'text',
-    },
+    control: 'text',
   },
-  min: {
-    control: { type: 'number' },
+  labelText: {
+    control: 'text',
   },
   max: {
-    control: { type: 'number' },
+    control: 'number',
+  },
+  maxLabel: {
+    control: 'text',
+  },
+  min: {
+    control: 'number',
+  },
+  minLabel: {
+    control: 'text',
   },
   name: {
-    control: { type: 'text' },
+    control: 'text',
   },
-  unstable_nameUpper: {
-    control: { type: 'text' },
+  noValidate: {
+    control: 'boolean',
+  },
+  onBlur: {
+    action: 'onBlur',
+  },
+  onChange: {
+    action: 'onChange',
+  },
+  onInputKeyUp: {
+    action: 'onInputKeyUp',
+  },
+  onRelease: {
+    action: 'onRelease',
   },
   readOnly: {
-    control: {
-      type: 'boolean',
-    },
+    control: 'boolean',
   },
   required: {
-    control: {
-      type: 'boolean',
-    },
+    control: 'boolean',
   },
   step: {
-    control: { type: 'number' },
+    control: 'number',
   },
   stepMultiplier: {
-    control: { type: 'number' },
+    control: 'number',
   },
-  value: {
-    control: { type: 'number' },
+  unstable_ariaLabelInputUpper: {
+    control: 'text',
+  },
+  unstable_nameUpper: {
+    control: 'text',
   },
   unstable_valueUpper: {
-    control: { type: 'number' },
+    control: 'number',
+  },
+  value: {
+    control: 'number',
   },
   warn: {
-    control: {
-      type: 'boolean',
-    },
+    control: 'boolean',
   },
   warnText: {
-    control: {
-      type: 'text',
+    control: 'text',
+  },
+};
+
+const singleHandleControls = Object.keys(sharedArgs);
+const twoHandleControls = Object.keys(twoHandleArgs);
+
+const singleHandleParameters = {
+  controls: {
+    include: singleHandleControls,
+  },
+};
+
+const twoHandleParameters = {
+  controls: {
+    include: twoHandleControls,
+  },
+};
+
+const hiddenInputArgTypes = {
+  ...sharedArgTypes,
+  hideTextInput: {
+    ...sharedArgTypes.hideTextInput,
+    table: {
+      readonly: true,
     },
   },
 };
 
-Default.args = {
-  ariaLabelInput: 'Lower bound',
-  unstable_ariaLabelInputUpper: 'Upper bound',
-  disabled: false,
-  hideTextInput: false,
-  invalid: false,
-  invalidText: 'Invalid message goes here',
-  min: 0,
-  max: 100,
-  readOnly: false,
-  required: false,
-  step: 5,
-  stepMultiplier: 5,
-  value: 50,
-  unstable_valueUpper: undefined,
-  warn: false,
-  warnText: 'Warning message goes here',
+const randomValue = ({ max, min, step }) => {
+  const range = max - min;
+  if (range <= 0 || step <= 0) {
+    return min;
+  }
+
+  return Math.min(max, min + Math.round((Math.random() * range) / step) * step);
 };
 
-export const SliderWithHiddenInputs = () => {
-  return (
-    <Slider
-      labelText="Slider label"
-      v
```

**File**: `packages/web-components/src/components/slider/slider.stories.ts` (modified, +286/-544)
```diff
@@ -13,45 +13,40 @@ import '../layer';
 import { prefix } from '../../globals/settings';
 import { withLayers } from '../../../.storybook/decorators/with-layers';
 
-const args = {
-  ariaLabelInput: 'Lower bound',
+const sharedArgs = {
+  ariaLabelInput: 'Slider value',
   disabled: false,
   hideLabel: false,
   hideTextInput: false,
-  labelText: 'Slider (must be an increment of 5)',
+  inputType: 'number',
   invalid: false,
-  invalidText: 'Invalid message goes here',
+  invalidText: 'Enter a value within the allowed range',
+  labelText: 'Storage allocation',
   max: 100,
+  maxLabel: ' GB',
   min: 0,
+  minLabel: ' GB',
+  name: 'storage-allocation',
   readOnly: false,
-  required: false,
-  step: 5,
-  stepMultiplier: 5,
-  warn: false,
-  warnText: 'Warning message goes here',
-  value: 50,
-};
-const argsTwohandle = {
-  ariaLabelInput: 'Lower bound',
-  disabled: false,
-  labelText: 'Slider label',
-  invalid: false,
-  invalidText: 'Invalid message goes here',
-  max: 100,
-  min: 0,
-  readOnly: false,
-  required: false,
   step: 1,
-  stepMultiplier: 1,
+  stepMultiplier: 10,
+  value: 50,
   warn: false,
-  warnText: 'Warning message goes here',
-  value: 10,
+  warnText: 'Storage allocation is approaching the recommended limit',
+};
+
+const twoHandleArgs = {
+  ...sharedArgs,
+  ariaLabelInput: 'Minimum storage allocation',
+  labelText: 'Storage allocation range',
+  name: 'minimum-storage-allocation',
+  unstable_ariaLabelInputUpper: 'Maximum storage allocation',
+  unstable_nameUpper: 'maximum-storage-allocation',
   unstable_valueUpper: 90,
-  unstable_ariaLabelInputUpper: 'Upper bound',
-  unstable_nameUpper: '',
+  value: 10,
 };
 
-const argTypes = {
+const sharedArgTypes = {
   ariaLabelInput: {
     control: 'text',
     description:
@@ -68,16 +63,12 @@ const argTypes = {
   },
   hideLabel: {
     control: 'boolean',
-    description: 'Hide label (hide-label)',
+    description: 'Hide the visible slider label.',
   },
   hideTextInput: {
     control: 'boolean',
     description: '<code>true</code> to hide the number input box.',
   },
-  labelText: {
-    control: 'text',
-    description: 'Provide the text for the slider label.',
-  },
   inputType: {
     control: 'text',
     description: 'The type attribute of the <code>&lt;input&gt;</code>.',
@@ -91,34 +82,37 @@ const argTypes = {
     description:
       'Provide the text that is displayed when the Slider is in an invalid state.',
   },
-  name: {
+  labelText: {
     control: 'text',
-    description: 'The name attribute of the <code>&lt;input&gt;</code>.',
+    description: 'Provide the text for the slider label.',
   },
   max: {
     control: 'number',
     description: 'The maximum value.',
   },
-  min: {
-    control: 'number',
-    description: 'The minimum value.',
-  },
   maxLabel: {
     control: 'text',
     description: 'The label associated with the maximum value.',
   },
+  min: {
+    control: 'number',
+    description: 'The minimum value.',
+  },
   minLabel: {
     control: 'text',
     description: 'The label associated with the minimum value.',
   },
+  name: {
+    control: 'text',
+    description: 'The name attribute of the <code>&lt;input&gt;</code>.',
+  },
+  onChange: {
+    action: `${prefix}-slider-changed`,
+  },
   readOnly: {
     control: 'boolean',
     description: 'Whether the slider should be read-only.',
   },
-  required: {
-    control: 'boolean',
-    description: '<code>true</code> to specify if the control is required.',
-  },
   step: {
     control: 'number',
     description:
@@ -129,571 +123,319 @@ const argTypes = {
     description:
       'A value determining how much the value should increase/decrease by Shift+arrow keys, which will be <code>(max - min) / stepMultiplier</code>.',
   },
-  warn: {
-    control: 'boolean',
-    description: 'Specify whether the control is currently in warning state.',
-  },
-  warnText: {
-    control: 'text',
-    description:
-      'Provide the text that is displayed when the control is in warning state.',
-  },
-  value: {
-    control: 'number',
-    description:
-      'The value of the slider. When there are two handles, value is the lower bound.',
-  },
   unstable_ariaLabelInputUpper: {
     control: 'text',
     description:
-      'The `ariaLabel` for the upper bound `<input>` and handle when there are two handles.',
+      'The <code>ariaLabel</code> for the upper bound <code>&lt;input&gt;</code> and handle when there are two handles.',
   },
   unstable_nameUpper: {
     control: 'text',
     description:
-      'The `name` attribute of the upper bound `<input>` when there are two handles.',
+      'The name attribute of the upper bound <code>&lt;input&gt;</code> when there are two handles.',
   },
   unstable_valueUpper: {
     control: 'number',
     description: 'The upper bound when there are two handles.',
   },
-  onAfterChange: {
-    action: `${prefix}-slider-changed`,
-  },
-};
-const argTypesSkelton = {
-  ariaLab
```

---

### Incident Patch 3: `2ee9b9a2` (2026-10-06)
**Commit Message**: fix(Popover): enhance Storybook controls (#22967)

* fix(Popover): enhance Storybook controls

* chore(sb): show alignment axis control with autoalign only

---------

Co-authored-by: Kenny Lam <[REDACTED_EMAIL]>

**File**: `packages/react/src/components/Popover/Popover.featureflag.stories.js` (modified, +87/-39)
```diff
@@ -5,18 +5,81 @@
  * LICENSE file in the root directory of this source tree.
  */
 
-import React, { useState } from 'react';
+import React, { useEffect, useState } from 'react';
 import { Popover, PopoverContent } from '../Popover';
 import { WithFeatureFlags } from '../../../.storybook/templates/WithFeatureFlags';
 import { Checkbox as CheckboxIcon } from '@carbon/icons-react';
 
 import './story.scss';
 
+const args = {
+  align: 'bottom',
+  alignmentAxisOffset: 0,
+  backgroundToken: 'layer',
+  border: false,
+  caret: true,
+  dropShadow: true,
+  highContrast: false,
+  open: true,
+};
+
+const argTypes = {
+  align: {
+    options: [
+      'top',
+      'top-start',
+      'top-end',
+      'bottom',
+      'bottom-start',
+      'bottom-end',
+      'left',
+      'left-end',
+      'left-start',
+      'right',
+      'right-end',
+      'right-start',
+    ],
+    control: { type: 'select' },
+  },
+  alignmentAxisOffset: {
+    control: { type: 'number' },
+  },
+  backgroundToken: {
+    options: ['layer', 'background'],
+    control: { type: 'select' },
+  },
+  border: {
+    control: { type: 'boolean' },
+  },
+  caret: {
+    control: { type: 'boolean' },
+  },
+  dropShadow: {
+    control: { type: 'boolean' },
+  },
+  highContrast: {
+    control: { type: 'boolean' },
+  },
+  onRequestClose: {
+    action: 'onRequestClose',
+  },
+  open: {
+    control: { type: 'boolean' },
+  },
+};
+
 // eslint-disable-next-line storybook/csf-component
 export default {
   title: 'Components/Popover/Feature Flag',
   component: Popover,
   tags: ['!autodocs'],
+  args,
+  argTypes,
+  parameters: {
+    controls: {
+      include: Object.keys(argTypes),
+    },
+  },
   decorators: [
     (Story) => (
       <WithFeatureFlags
@@ -30,7 +93,12 @@ export default {
 };
 
 export const FloatingStyles = (args) => {
-  const [open, setOpen] = useState(true);
+  const { onRequestClose, open: openArg, ...popoverProps } = args;
+  const [open, setOpen] = useState(openArg);
+
+  useEffect(() => {
+    setOpen(openArg);
+  }, [openArg]);
 
   return (
     <div
@@ -39,14 +107,23 @@ export const FloatingStyles = (args) => {
         display: 'flex',
         justifyContent: 'center',
       }}>
-      <Popover open={open} align={args.align}>
-        <div className="playground-trigger">
-          <CheckboxIcon
-            onClick={() => {
-              setOpen(!open);
-            }}
-          />
-        </div>
+      <Popover
+        {...popoverProps}
+        open={open}
+        onRequestClose={() => {
+          onRequestClose?.();
+          setOpen(false);
+        }}>
+        <button
+          className="playground-trigger"
+          aria-label="Checkbox"
+          aria-expanded={open}
+          type="button"
+          onClick={() => {
+            setOpen(!open);
+          }}>
+          <CheckboxIcon />
+        </button>
         <PopoverContent className="p-3">
           <div>
             <p className="popover-title">This popover uses autoAlign</p>
@@ -62,32 +139,3 @@ export const FloatingStyles = (args) => {
     </div>
   );
 };
-
-FloatingStyles.args = {
-  align: 'bottom',
-};
-
-FloatingStyles.argTypes = {
-  align: {
-    options: [
-      'top',
-      'top-start',
-      'top-end',
-
-      'bottom',
-      'bottom-start',
-      'bottom-end',
-
-      'left',
-      'left-end',
-      'left-start',
-
-      'right',
-      'right-end',
-      'right-start',
-    ],
-    control: {
-      type: 'select',
-    },
-  },
-};
```

**File**: `packages/react/src/components/Popover/Popover.stories.js` (modified, +176/-127)
```diff
@@ -17,36 +17,129 @@ import { Settings } from '@carbon/icons-react';
 
 const prefix = 'cds';
 
+const alignments = [
+  'top',
+  'top-start',
+  'top-end',
+  'bottom',
+  'bottom-start',
+  'bottom-end',
+  'left',
+  'left-end',
+  'left-start',
+  'right',
+  'right-end',
+  'right-start',
+];
+
+const argTypes = {
+  align: {
+    options: alignments,
+    control: { type: 'select' },
+  },
+  alignmentAxisOffset: {
+    control: { type: 'number' },
+    if: { arg: 'autoAlign' },
+  },
+  autoAlign: {
+    control: { type: 'boolean' },
+  },
+  backgroundToken: {
+    options: ['layer', 'background'],
+    control: { type: 'select' },
+  },
+  border: {
+    control: { type: 'boolean' },
+  },
+  caret: {
+    control: { type: 'boolean' },
+  },
+  dropShadow: {
+    control: { type: 'boolean' },
+  },
+  highContrast: {
+    control: { type: 'boolean' },
+  },
+  onRequestClose: {
+    action: 'onRequestClose',
+  },
+  open: {
+    control: { type: 'boolean' },
+  },
+};
+
+const defaultArgs = {
+  align: 'bottom',
+  alignmentAxisOffset: 0,
+  autoAlign: false,
+  backgroundToken: 'layer',
+  border: false,
+  caret: true,
+  dropShadow: true,
+  highContrast: false,
+  open: true,
+};
+
+const autoAlignArgs = {
+  ...defaultArgs,
+  align: 'top',
+  autoAlign: true,
+};
+
+const defaultControls = Object.keys(argTypes);
+const autoAlignControls = defaultControls.filter(
+  (control) => control !== 'autoAlign'
+);
+const tabTipControls = [
+  'backgroundToken',
+  'border',
+  'dropShadow',
+  'onRequestClose',
+  'open',
+];
+
+const useOpenState = (open) => {
+  const [isOpen, setIsOpen] = useState(open);
+
+  useEffect(() => {
+    setIsOpen(open);
+  }, [open]);
+
+  return [isOpen, setIsOpen];
+};
+
 export default {
   title: 'Components/Popover',
   component: Popover,
   subcomponents: {
     PopoverContent,
   },
+  argTypes,
   parameters: {
     controls: {
       hideNoControlsWarning: true,
-      exclude: ['relative'],
+      include: defaultControls,
     },
     docs: {
       page: mdx,
     },
   },
 };
 
-const DefaultStory = (props) => {
-  const { align, caret, dropShadow, highContrast, open } = props;
-  const [isOpen, setIsOpen] = useState(open);
+export const Default = (args) => {
+  const { onRequestClose, open, ...popoverProps } = args;
+  const [isOpen, setIsOpen] = useOpenState(open);
+
+  const handleRequestClose = () => {
+    onRequestClose?.();
+    setIsOpen(false);
+  };
 
   return (
     <Popover
-      {...props}
-      align={align}
-      caret={caret}
-      dropShadow={dropShadow}
-      highContrast={highContrast}
+      {...popoverProps}
       open={isOpen}
-      onRequestClose={() => setIsOpen(false)}>
+      onRequestClose={handleRequestClose}>
       <button
         className="playground-trigger"
         aria-label="Checkbox"
@@ -68,18 +161,25 @@ const DefaultStory = (props) => {
 };
 
 export const TabTip = (args) => {
-  const [open, setOpen] = useState(true);
+  const { onRequestClose, open: openArg, ...popoverProps } = args;
+  const [open, setOpen] = useOpenState(openArg);
   const [openTwo, setOpenTwo] = useState(false);
   const align = document?.dir === 'rtl' ? 'bottom-right' : 'bottom-left';
   const alignTwo = document?.dir === 'rtl' ? 'bottom-left' : 'bottom-right';
+
+  const handleRequestClose = (setOpenState) => {
+    onRequestClose?.();
+    setOpenState(false);
+  };
+
   return (
     <div className="popover-tabtip-story" style={{ display: 'flex' }}>
       <Popover
+        {...popoverProps}
         align={align}
         open={open}
         isTabTip
-        onRequestClose={() => setOpen(false)}
-        {...args}>
+        onRequestClose={() => handleRequestClose(setOpen)}>
         <button
           aria-label="Settings"
           type="button"
@@ -113,15 +213,15 @@ export const TabTip = (args) => {
       </Popover>
 
       <Popover
+        {...popoverProps}
         open={openTwo}
         isTabTip
         align={alignTwo}
-        onRequestClose={() => setOpenTwo(false)}
-        {...args}>
+        onRequestClose={() => handleRequestClose(setOpenTwo)}>
         <button
           aria-label="Settings"
           type="button"
-          aria-expanded={open}
+          aria-expanded={openTwo}
           onClick={() => {
             setOpenTwo(!openTwo);
           }}>
@@ -155,71 +255,20 @@ export const TabTip = (args) => {
 
 TabTip.parameters = {
   controls: {
-    exclude: ['align', 'autoAlign', 'caret', 'highContrast'],
+    include: tabTipControls,
   },
 };
-
-export const Default = DefaultStory.bind({});
-
-Default.args = {
-  caret: true,
+TabTip.args = {
+  backgroundToken: 'layer',
+  border: false,
   dropShadow: true,
-  highContrast: false,
   open: true,
 };
+
+Default.args = defaultArgs;
 Default.parameters = {
   controls: {
-    exclude: ['isTabTip'],
-  },
-};
-
-Default.argTypes = {
-  align: {
-    options: [
-      'top',
-      'top-start',
-      'top-end',
-
-      'bottom',
-      'bottom-star
```

**File**: `packages/web-components/src/components/popover/popover.stories.ts` (modified, +143/-93)
```diff
@@ -18,28 +18,58 @@ import { iconLoader } from '../../globals/internal/icon-loader';
 
 import styles from './popover-story.scss?lit';
 
+const alignments = [
+  POPOVER_ALIGNMENT.TOP,
+  POPOVER_ALIGNMENT.TOP_START,
+  POPOVER_ALIGNMENT.TOP_END,
+  POPOVER_ALIGNMENT.BOTTOM,
+  POPOVER_ALIGNMENT.BOTTOM_START,
+  POPOVER_ALIGNMENT.BOTTOM_END,
+  POPOVER_ALIGNMENT.LEFT,
+  POPOVER_ALIGNMENT.LEFT_END,
+  POPOVER_ALIGNMENT.LEFT_START,
+  POPOVER_ALIGNMENT.RIGHT,
+  POPOVER_ALIGNMENT.RIGHT_END,
+  POPOVER_ALIGNMENT.RIGHT_START,
+];
+
+const togglePopover = (event: Event) => {
+  const trigger = event.currentTarget as HTMLElement;
+  const popover = trigger.closest(`${prefix}-popover`);
+
+  if (popover) {
+    popover.toggleAttribute('open');
+    trigger.setAttribute('aria-expanded', String(popover.hasAttribute('open')));
+  }
+};
+
+const handlePopoverClose = (event: Event, onClose?: (event: Event) => void) => {
+  const popover = event.currentTarget as HTMLElement;
+  const trigger = popover.querySelector<HTMLElement>(':scope > button');
+
+  trigger?.setAttribute('aria-expanded', 'false');
+  onClose?.(event);
+};
+
 const autoAlignStoryContainerStyle =
   'display: grid; place-items: center; width: 200vw; min-width: 1200px; height: 200vh; min-height: 1200px;';
 
+const alignmentAxisOffsetArgType = {
+  control: 'number',
+  description:
+    'Provide an offset value for the alignment axis when auto-align is enabled',
+};
+
 const sharedArgTypes = {
   align: {
     control: 'select',
-    options: [
-      POPOVER_ALIGNMENT.TOP,
-      POPOVER_ALIGNMENT.TOP_START,
-      POPOVER_ALIGNMENT.TOP_END,
-      POPOVER_ALIGNMENT.BOTTOM,
-      POPOVER_ALIGNMENT.BOTTOM_START,
-      POPOVER_ALIGNMENT.BOTTOM_END,
-      POPOVER_ALIGNMENT.LEFT,
-      POPOVER_ALIGNMENT.LEFT_END,
-      POPOVER_ALIGNMENT.LEFT_START,
-      POPOVER_ALIGNMENT.RIGHT,
-      POPOVER_ALIGNMENT.RIGHT_END,
-      POPOVER_ALIGNMENT.RIGHT_START,
-    ],
+    options: alignments,
     description: `Specify how the popover should align with the trigger element`,
   },
+  alignmentAxisOffset: {
+    ...alignmentAxisOffsetArgType,
+    if: { arg: 'autoAlign' },
+  },
   autoAlign: {
     control: 'boolean',
     description:
@@ -74,9 +104,17 @@ const sharedArgTypes = {
     control: 'boolean',
     description: 'Specify whether the component is currently open or closed',
   },
+  onBeforeClose: {
+    action: 'cds-popover-beingclosed',
+  },
+  onClose: {
+    action: 'cds-popover-closed',
+  },
 };
 
 const sharedAutoAlignArgTypes = {
+  align: sharedArgTypes.align,
+  alignmentAxisOffset: alignmentAxisOffsetArgType,
   caret: {
     control: 'boolean',
     description: `Specify whether a caret should be rendered`,
@@ -106,6 +144,8 @@ const sharedAutoAlignArgTypes = {
     control: 'boolean',
     description: 'Specify whether the component is currently open or closed',
   },
+  onBeforeClose: sharedArgTypes.onBeforeClose,
+  onClose: sharedArgTypes.onClose,
 };
 
 export const Default = {
@@ -115,7 +155,9 @@ export const Default = {
     border: false,
     highContrast: false,
     align: POPOVER_ALIGNMENT.BOTTOM,
+    alignmentAxisOffset: 0,
     autoAlign: false,
+    backgroundToken: POPOVER_BACKGROUND_TOKEN.LAYER,
     dropShadow: true,
     open: true,
   },
@@ -124,36 +166,29 @@ export const Default = {
     (story) => html`<div class="mt-10 flex justify-center">${story()}</div>`,
   ],
   render: (args) => {
-    const handleClick = () => {
-      const popover = document.querySelector(`${prefix}-popover`);
-      const open = popover?.hasAttribute('open');
-      if (open) {
-        popover?.removeAttribute('open');
-      } else {
-        popover?.setAttribute('open', '');
-      }
-    };
-
     return html`
       <style>
         ${styles}
       </style>
       <cds-popover
         ?open=${args.open}
+        alignment-axis-offset=${args.alignmentAxisOffset}
         ?caret=${args.caret}
         ?border=${args.border}
         ?highContrast=${args.highContrast}
         ?autoalign=${args.autoAlign}
         align=${args.align}
-        ?tabTip=${args.tabTip}
         ?dropShadow=${args.dropShadow}
-        backgroundToken=${args.backgroundToken}>
+        backgroundToken=${args.backgroundToken}
+        @cds-popover-beingclosed=${args.onBeforeClose}
+        @cds-popover-closed=${(event: Event) =>
+          handlePopoverClose(event, args.onClose)}>
         <button
           class="playground-trigger"
           aria-label="Checkbox"
           type="button"
-          aria-expanded=${open}
-          @click="${() => handleClick()}">
+          aria-expanded=${args.open}
+          @click=${togglePopover}>
           ${iconLoader(Checkbox16)}
         </button>
         <cds-popover-content>
@@ -177,23 +212,15 @@ export const ExperimentalAutoAlign = {
     dropShadow: true,
     open: true,
     border: false,
-    backgroundToken: 'layer',
+    align: POPOVER_ALIGNMENT.TOP,
+    alignmentAxisOffset: 0,
+    backgroundToken:
```

---

### Incident Patch 4: `b1dae828` (2026-10-06)
**Commit Message**: chore(deps): bump postcss-selector-parser from 7.1.5 to 7.1.6 (#23633)

Bumps [postcss-selector-parser](https://github.com/postcss/postcss-selector-parser) from 7.1.5 to 7.1.6.
- [Release notes](https://github.com/postcss/postcss-selector-parser/releases)
- [Changelog](https://github.com/postcss/postcss-selector-parser/blob/main/CHANGELOG.md)
- [Commits](https://github.com/postcss/postcss-selector-parser/compare/7.1.5...7.1.6)

---
updated-dependencies:
- dependency-name: postcss-selector-parser
  dependency-version: 7.1.6
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -20235,12 +20235,12 @@ __metadata:
   linkType: hard
 
 "postcss-selector-parser@npm:^7.0.0, postcss-selector-parser@npm:^7.1.1, postcss-selector-parser@npm:^7.1.5":
-  version: 7.1.5
-  resolution: "postcss-selector-parser@npm:7.1.5"
+  version: 7.1.6
+  resolution: "postcss-selector-parser@npm:7.1.6"
   dependencies:
     cssesc: "npm:^3.0.0"
     util-deprecate: "npm:^1.0.2"
-  checksum: 10/ae66bbcb5d370a3f4b4660e23a208352a885c651f1b420f7b998faaa1034832b870066f49e295f73ee3da6a6c6312c56fea1b2039969f8d803438fa48232b307
+  checksum: 10/8b00b63c8ae9eab8567bebf2710971dcd832a7a20a9cae7059d92aee3df38fbcd13ce454bdc09c54e777dbddd0df38966227000091c88002741b8575f3878f05
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 5: `1457b614` (2026-10-06)
**Commit Message**: fix(dropdown): remove unexpected border-block-start on selected item (#23560)

Fixes #20774

When a dropdown item is selected (has  class) and keyboard
navigation causes focus to leave it, a top border (border-block-start)
remained visible on the selected item's option element. This is because

only reset  but did not set .

The ComboBox and the web-components dropdown already handled this
correctly — this change brings the React Dropdown (and all components
that use list-box) into alignment with the expected behaviour described
in the design spec.

Fixes: https://github.com/carbon-design-system/carbon/issues/20774

Signed-off-by: lakshmip03 <[REDACTED_EMAIL]>
Co-authored-by: lakshmip03 <[REDACTED_EMAIL]>

**File**: `packages/styles/scss/components/list-box/_list-box.scss` (modified, +1/-0)
```diff
@@ -864,6 +864,7 @@ $list-box-menu-width: convert.to-rem(300px);
 
   .#{$prefix}--list-box__menu-item--active
     .#{$prefix}--list-box__menu-item__option {
+    border-block-start-color: transparent;
     color: $text-primary;
   }
 
```

---

### Incident Patch 6: `f3dfa98f` (2026-10-06)
**Commit Message**: fix(css-grid): set box-sizing to border-box (#23555)

**File**: `packages/grid/scss/_css-grid.scss` (modified, +1/-0)
```diff
@@ -94,6 +94,7 @@
     --cds-grid-column-hang: calc(var(--cds-grid-gutter) / 2);
 
     display: grid;
+    box-sizing: border-box;
     grid-template-columns: repeat(var(--cds-grid-columns), minmax(0, 1fr));
     inline-size: 100%;
     margin-inline: auto;
```

---

### Incident Patch 7: `db276c94` (2026-10-06)
**Commit Message**: fix(text-area): prevent overflow at minimum height (#23533)

* fix(text-area): prevent overflow at minimum height

* refactor(text-area): use spacing token for minimum height

* chore(text-area): address review feedback

* Update packages/styles/scss/components/text-area/_text-area.scss

---------

Co-authored-by: Heloise Lui <[REDACTED_EMAIL]>

**File**: `e2e/components/TextArea/TextArea-test.e2e.js` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/**
+ * Copyright IBM Corp. 2026
+ *
+ * This source code is licensed under the Apache-2.0 license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+'use strict';
+
+const { expect, test } = require('@playwright/test');
+const { visitStory } = require('../../test-utils/storybook');
+
+async function resizeToMinimumHeight(textarea) {
+  await textarea.evaluate((element) => {
+    element.style.height = '40px';
+  });
+}
+
+test.describe('TextArea', () => {
+  test.beforeEach(async ({ page }) => {
+    await visitStory(page, {
+      component: 'TextArea',
+      id: 'components-textarea--default',
+      globals: {
+        theme: 'white',
+      },
+    });
+  });
+
+  test('does not overflow with one line at its minimum height', async ({
+    page,
+  }) => {
+    const textarea = page.getByRole('textbox');
+
+    await textarea.fill('hello');
+    await resizeToMinimumHeight(textarea);
+
+    const dimensions = await textarea.evaluate((element) => ({
+      clientHeight: element.clientHeight,
+      offsetHeight: element.offsetHeight,
+      scrollHeight: element.scrollHeight,
+    }));
+
+    expect(dimensions.offsetHeight).toBe(40);
+    expect(dimensions.scrollHeight).toBeLessThanOrEqual(
+      dimensions.clientHeight
+    );
+  });
+
+  test('allows multiline content to overflow at its minimum height', async ({
+    page,
+  }) => {
+    const textarea = page.getByRole('textbox');
+
+    await textarea.fill('hello\nworld');
+    await resizeToMinimumHeight(textarea);
+
+    const dimensions = await textarea.evaluate((element) => ({
+      clientHeight: element.clientHeight,
+      offsetHeight: element.offsetHeight,
+      scrollHeight: element.scrollHeight,
+    }));
+
+    expect(dimensions.offsetHeight).toBe(40);
+    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
+  });
+});
```

**File**: `packages/styles/scss/components/text-area/_text-area.scss` (modified, +3/-2)
```diff
@@ -1,5 +1,5 @@
 //
-// Copyright IBM Corp. 2016, 2025
+// Copyright IBM Corp. 2016, 2026
 //
 // This source code is licensed under the Apache-2.0 license found in the
 // LICENSE file in the root directory of this source tree.
@@ -31,7 +31,6 @@
     @include type-style('body-01');
     @include focus-outline('reset');
 
-    padding: convert.to-rem(11px) layout.density('padding-inline');
     border: none;
     background-color: $field;
     block-size: 100%;
@@ -41,6 +40,8 @@
     min-block-size: convert.to-rem(40px);
 
     min-inline-size: 10rem;
+    padding-block: convert.to-rem(11px) $spacing-03;
+    padding-inline: layout.density('padding-inline');
     resize: vertical;
     transition:
       background-color $duration-fast-01 motion(standard, productive),
```

---

### Incident Patch 8: `d6ac1052` (2026-10-06)
**Commit Message**: fix(button-set): prevent setState-during-commit crash in React 19 (#23146)

* fix(button-set): prevent setState-during-commit crash in React 19

* Update packages/react/src/components/ButtonSet/ButtonSet.tsx

* Update packages/react/src/components/ButtonSet/ButtonSet-test.js

* fix(ButtonSet): use useEffect to fix React 19 act() compatibility

---------

Co-authored-by: Heloise Lui <[REDACTED_EMAIL]>
Co-authored-by: kennylam <[REDACTED_EMAIL]>
Co-authored-by: Mahmoud <[REDACTED_EMAIL]>

**File**: `packages/react/src/components/ButtonSet/ButtonSet-test.js` (modified, +92/-63)
```diff
@@ -1,99 +1,127 @@
 /**
- * Copyright IBM Corp. 2016, 2025 *
+ * Copyright IBM Corp. 2016, 2026
  * This source code is licensed under the Apache-2.0 license found in the
  * LICENSE file in the root directory of this source tree.
  */
 
-import { render, screen } from '@testing-library/react';
+import { render, screen, act } from '@testing-library/react';
 import React from 'react';
 import ButtonSet from '../ButtonSet';
 
 describe('ButtonSet', () => {
-  it('should support rendering elements through the `children` prop', () => {
-    render(
-      <ButtonSet data-testid="test">
-        <span data-testid="child">child</span>
-      </ButtonSet>
-    );
+  it('should support rendering elements through the `children` prop', async () => {
+    await act(async () => {
+      render(
+        <ButtonSet data-testid="test">
+          <span data-testid="child">child</span>
+        </ButtonSet>
+      );
+    });
     expect(screen.getByTestId('test')).toContainElement(
       screen.getByTestId('child')
     );
   });
 
-  it('should support a custom className on the outermost element', () => {
-    const { container } = render(<ButtonSet className="test" />);
+  it('should support a custom className on the outermost element', async () => {
+    let container;
+    await act(async () => {
+      ({ container } = render(<ButtonSet className="test" />));
+    });
     expect(container.firstChild).toHaveClass('test');
   });
 
-  it('should spread props onto the outermost element', () => {
-    const { container } = render(<ButtonSet data-testid="test" />);
+  it('should spread props onto the outermost element', async () => {
+    let container;
+    await act(async () => {
+      ({ container } = render(<ButtonSet data-testid="test" />));
+    });
     expect(container.firstChild).toHaveAttribute('data-testid', 'test');
   });
 
-  it('should support a `ref` that is placed on the outermost element', () => {
+  it('should support a `ref` that is placed on the outermost element', async () => {
     const ref = jest.fn();
-    const { container } = render(<ButtonSet ref={ref} />);
+    let container;
+    await act(async () => {
+      ({ container } = render(<ButtonSet ref={ref} />));
+    });
     expect(ref).toHaveBeenCalledWith(container.firstChild);
   });
 
   describe('stacked', () => {
-    it('should set the stacked class when stacked is provided', () => {
-      render(<ButtonSet data-testid="test" stacked />);
+    it('should set the stacked class when stacked is provided', async () => {
+      await act(async () => {
+        render(<ButtonSet data-testid="test" stacked />);
+      });
       expect(screen.getByTestId('test')).toHaveClass('cds--btn-set--stacked');
     });
   });
 
   describe('fluid', () => {
-    it('should apply fluid class when fluid prop is true', () => {
-      render(<ButtonSet data-testid="test" fluid />);
+    it('should apply fluid class when fluid prop is true', async () => {
+      await act(async () => {
+        render(<ButtonSet data-testid="test" fluid />);
+      });
       expect(screen.getByTestId('test')).toHaveClass('cds--btn-set--fluid');
     });
 
-    it('should not apply fluid class when fluid prop is false', () => {
-      render(<ButtonSet data-testid="test" fluid={false} />);
+    it('should not apply fluid class when fluid prop is false', async () => {
+      await act(async () => {
+        render(<ButtonSet data-testid="test" fluid={false} />);
+      });
       expect(screen.getByTestId('test')).not.toHaveClass('cds--btn-set--fluid');
     });
 
-    it('should override stacked prop when fluid is true', () => {
-      render(<ButtonSet data-testid="test" fluid stacked />);
+    it('should override stacked prop when fluid is true', async () => {
+      await act(async () => {
+        render(<ButtonSet data-testid="test" fluid stacked />);
+      });
       expect(screen.getByTestId('test')).toHaveClass('cds--btn-set--fluid');
       // Fluid should take precedence, so stacked class may not be applied initially
     });
 
-    it('should render fluid inner wrapper when fluid is true', () => {
-      const { container } = render(
-        <ButtonSet data-testid="test" fluid>
-          <button>Button 1</button>
-        </ButtonSet>
-      );
+    it('should render fluid inner wrapper when fluid is true', async () => {
+      let container;
+      await act(async () => {
+        ({ container } = render(
+          <ButtonSet data-testid="test" fluid>
+            <button>Button 1</button>
+          </ButtonSet>
+        ));
+      });
       const fluidInner = container.querySelector('.cds--btn-set__fluid-inner');
       expect(fluidInner).toBeInTheDocument();
     });
 
-    it('should not render fluid inner wrapper when fluid is false', () => {
-      const { container } = render(
-        <ButtonSet data-testid="test">
-          <button>Button 1</button>
-        </ButtonSet>
-      );
+    it('should not render fluid inner wrapper when fluid is fa
```

**File**: `packages/react/src/components/ButtonSet/ButtonSet.tsx` (modified, +10/-5)
```diff
@@ -1,5 +1,5 @@
 /**
- * Copyright IBM Corp. 2016, 2025
+ * Copyright IBM Corp. 2016, 2026
  *
  * This source code is licensed under the Apache-2.0 license found in the
  * LICENSE file in the root directory of this source tree.
@@ -9,7 +9,6 @@ import React, { forwardRef, useEffect, useRef, useState } from 'react';
 import PropTypes from 'prop-types';
 import classNames from 'classnames';
 import { usePrefix } from '../../internal/usePrefix';
-import useIsomorphicEffect from '../../internal/useIsomorphicEffect';
 import { ButtonKind } from '../Button/Button';
 
 export interface ButtonSetProps extends React.HTMLAttributes<HTMLDivElement> {
@@ -56,9 +55,14 @@ const ButtonSet = forwardRef<HTMLDivElement, ButtonSetProps>((props, ref) => {
   );
 
   /**
-   * Used to determine if the buttons are currently stacked
+   * Used to determine if the buttons are currently stacked.
+   * useEffect (not useLayoutEffect) is intentional: calling setState inside
+   * useLayoutEffect triggers a "setState during commit" warning in React 19,
+   * and queueMicrotask workarounds break act() in tests. useEffect fires after
+   * paint so there is a brief flash-of-unsorted-order risk, but it is
+   * act()-compatible and avoids the React 19 commit-phase constraint.
    */
-  useIsomorphicEffect(() => {
+  useEffect(() => {
     const checkStacking = () => {
       let newIsStacked = stacked || false;
 
@@ -71,7 +75,6 @@ const ButtonSet = forwardRef<HTMLDivElement, ButtonSetProps>((props, ref) => {
       return newIsStacked;
     };
 
-    /* initial value not dependant on observer */
     setIsStacked(checkStacking());
 
     if (!fluidInnerRef.current) {
@@ -95,6 +98,8 @@ const ButtonSet = forwardRef<HTMLDivElement, ButtonSetProps>((props, ref) => {
         (isStacked ? -1 : 1)
       );
     });
+    // useEffect already runs after the commit phase, so setState here is safe
+    // in React 19 and is fully compatible with act() in tests.
     setSortedChildren(newSortedChildren);
 
     // adding sortedChildren to deps causes an infinite loop
```

---

### Incident Patch 9: `ab149049` (2026-10-06)
**Commit Message**: chore(deps): update dependency joi to v18.2.9 [security] (#23636)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -16273,8 +16273,8 @@ __metadata:
   linkType: hard
 
 "joi@npm:^18.0.0":
-  version: 18.2.8
-  resolution: "joi@npm:18.2.8"
+  version: 18.2.9
+  resolution: "joi@npm:18.2.9"
   dependencies:
     "@hapi/address": "npm:^5.1.1"
     "@hapi/formula": "npm:^3.0.2"
@@ -16283,7 +16283,7 @@ __metadata:
     "@hapi/tlds": "npm:^1.1.1"
     "@hapi/topo": "npm:^6.0.2"
     "@standard-schema/spec": "npm:^1.1.0"
-  checksum: 10/430a89ff14936854c99461eba9d10e65f59f9372331d15065ffadf7832d3627e6bf5ea46b246deee320122d23f6ec6a983fa64dbb1f948242d943fe4a9f0bf25
+  checksum: 10/321836e1bded18c23f5bd10c85715cda778849cddf9285704c39b8df290ad50f9d977f4ebf522cc741feba31aa65fe760dc84e9f218decc777ed15412a33bf77
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 10: `19e390e7` (2026-10-06)
**Commit Message**: fix(deps): update dependency chalk to v6.0.1 (#23566)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `packages/carbon-components-react/package.json` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@
     "@carbon/react": "^1.118.0-rc.0",
     "@carbon/styles": "^1.117.0-rc.0",
     "@ibm/telemetry-js": "^1.5.0",
-    "chalk": "6.0.0"
+    "chalk": "6.0.1"
   },
   "devDependencies": {
     "@babel/core": "^8.0.0",
```

**File**: `packages/carbon-components/package.json` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@
   "dependencies": {
     "@carbon/styles": "^1.117.0-rc.0",
     "@ibm/telemetry-js": "^1.5.0",
-    "chalk": "6.0.0"
+    "chalk": "6.0.1"
   },
   "devDependencies": {
     "@carbon/test-utils": "^10.42.0-rc.0",
```

**File**: `yarn.lock` (modified, +6/-6)
```diff
@@ -10214,7 +10214,7 @@ __metadata:
     babel-plugin-dev-expression: "npm:^0.2.3"
     babel-preset-carbon: "npm:^0.9.0"
     browserslist-config-carbon: "npm:^11.2.0"
-    chalk: "npm:6.0.0"
+    chalk: "npm:6.0.1"
     fs-extra: "npm:^11.0.0"
     react: "npm:^19.2.3"
     react-dom: "npm:^19.2.3"
@@ -10234,7 +10234,7 @@ __metadata:
     "@carbon/styles": "npm:^1.117.0-rc.0"
     "@carbon/test-utils": "npm:^10.42.0-rc.0"
     "@ibm/telemetry-js": "npm:^1.5.0"
-    chalk: "npm:6.0.0"
+    chalk: "npm:6.0.1"
     fs-extra: "npm:^11.0.0"
     rimraf: "npm:^6.0.1"
     sass: "npm:^1.93.2"
@@ -10355,10 +10355,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"chalk@npm:6.0.0, chalk@npm:^6.0.0":
-  version: 6.0.0
-  resolution: "chalk@npm:6.0.0"
-  checksum: 10/bdcb895b9c848ddbce38f38df5a10a3e272d6c04d759161789c4a2fa5a1fa78bf9eecf4eef73433a2a3be7324d6da96c3c9baf5c80862f37683cc0b890597831
+"chalk@npm:6.0.1, chalk@npm:^6.0.0":
+  version: 6.0.1
+  resolution: "chalk@npm:6.0.1"
+  checksum: 10/1457692e6327f299da7d7cd6a7774fe1de25bda6c0e33791901d6762a6c0f2409bd3d92bf7695519825c2fbb405c104a0a73fd489e4e9f88af3ef2a1d97455c9
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 11: `c3feb5af` (2026-10-06)
**Commit Message**: feat(dtcg): update READMEs, add layout-explorer, fix CVEs in examples (#23384)

* feat(dtcg): update READMEs, add layout-explorer, fix CVEs in examples

- Update @carbon/themes README: replace stale interactive01/interactive02
  exports, add component tokens section, modifying token values section
- Update @carbon/layout README: add modifying token values section pointing
  to src/dtcg/layout.json
- Update @carbon/motion README: replace deprecated @import/carbon--motion
  Sass API with @use/motion(), document surfaces and duration tokens
- Add packages/layout/examples/layout-explorer: new Next.js token explorer
  matching motion/themes example structure and style
- Fix Next.js CVE (< 16.3.3) in theme-tokens-dtcg and colors-explorer
- Fix nanoid CVE (< 3.3.18) in colors-explorer and motion-tokens-dtcg
  via resolutions override
- Bump next to ^16.3.3 in layout/examples/preview

* Update packages/themes/README.md

Co-authored-by: Nandan Devadula <[REDACTED_EMAIL]>

* chore: format

---------

Co-authored-by: Nandan Devadula <[REDACTED_EMAIL]>
Co-authored-by: Anna Wen <[REDACTED_EMAIL]>

**File**: `packages/colors/examples/colors-explorer/package.json` (modified, +4/-1)
```diff
@@ -8,9 +8,12 @@
   "dependencies": {
     "@carbon/colors": "link:../../",
     "@carbon/themes": "link:../../../themes",
-    "next": "^16.2.6",
+    "next": "^16.3.3",
     "react": "^19.2.5",
     "react-dom": "^19.2.5",
     "sass": "^1.36.0"
+  },
+  "resolutions": {
+    "nanoid": "^3.3.18"
   }
 }
```

**File**: `packages/colors/examples/colors-explorer/yarn.lock` (modified, +174/-174)
```diff
@@ -17,7 +17,7 @@ __metadata:
   languageName: node
   linkType: soft
 
-"@emnapi/runtime@npm:^1.11.1":
+"@emnapi/runtime@npm:^1.11.3":
   version: 1.11.3
   resolution: "@emnapi/runtime@npm:1.11.3"
   dependencies:
@@ -33,240 +33,240 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@img/sharp-darwin-arm64@npm:0.35.3":
-  version: 0.35.3
-  resolution: "@img/sharp-darwin-arm64@npm:0.35.3"
+"@img/sharp-darwin-arm64@npm:0.35.4":
+  version: 0.35.4
+  resolution: "@img/sharp-darwin-arm64@npm:0.35.4"
   dependencies:
-    "@img/sharp-libvips-darwin-arm64": "npm:1.3.2"
+    "@img/sharp-libvips-darwin-arm64": "npm:1.3.3"
   dependenciesMeta:
     "@img/sharp-libvips-darwin-arm64":
       optional: true
   conditions: os=darwin & cpu=arm64
   languageName: node
   linkType: hard
 
-"@img/sharp-darwin-x64@npm:0.35.3":
-  version: 0.35.3
-  resolution: "@img/sharp-darwin-x64@npm:0.35.3"
+"@img/sharp-darwin-x64@npm:0.35.4":
+  version: 0.35.4
+  resolution: "@img/sharp-darwin-x64@npm:0.35.4"
   dependencies:
-    "@img/sharp-libvips-darwin-x64": "npm:1.3.2"
+    "@img/sharp-libvips-darwin-x64": "npm:1.3.3"
   dependenciesMeta:
     "@img/sharp-libvips-darwin-x64":
       optional: true
   conditions: os=darwin & cpu=x64
   languageName: node
   linkType: hard
 
-"@img/sharp-freebsd-wasm32@npm:0.35.3":
-  version: 0.35.3
-  resolution: "@img/sharp-freebsd-wasm32@npm:0.35.3"
+"@img/sharp-freebsd-wasm32@npm:0.35.4":
+  version: 0.35.4
+  resolution: "@img/sharp-freebsd-wasm32@npm:0.35.4"
   dependencies:
-    "@img/sharp-wasm32": "npm:0.35.3"
+    "@img/sharp-wasm32": "npm:0.35.4"
   conditions: os=freebsd
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-darwin-arm64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-darwin-arm64@npm:1.3.2"
+"@img/sharp-libvips-darwin-arm64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-darwin-arm64@npm:1.3.3"
   conditions: os=darwin & cpu=arm64
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-darwin-x64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-darwin-x64@npm:1.3.2"
+"@img/sharp-libvips-darwin-x64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-darwin-x64@npm:1.3.3"
   conditions: os=darwin & cpu=x64
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linux-arm64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linux-arm64@npm:1.3.2"
+"@img/sharp-libvips-linux-arm64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linux-arm64@npm:1.3.3"
   conditions: os=linux & cpu=arm64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linux-arm@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linux-arm@npm:1.3.2"
+"@img/sharp-libvips-linux-arm@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linux-arm@npm:1.3.3"
   conditions: os=linux & cpu=arm & libc=glibc
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linux-ppc64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linux-ppc64@npm:1.3.2"
+"@img/sharp-libvips-linux-ppc64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linux-ppc64@npm:1.3.3"
   conditions: os=linux & cpu=ppc64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linux-riscv64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linux-riscv64@npm:1.3.2"
+"@img/sharp-libvips-linux-riscv64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linux-riscv64@npm:1.3.3"
   conditions: os=linux & cpu=riscv64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linux-s390x@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linux-s390x@npm:1.3.2"
+"@img/sharp-libvips-linux-s390x@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linux-s390x@npm:1.3.3"
   conditions: os=linux & cpu=s390x & libc=glibc
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linux-x64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linux-x64@npm:1.3.2"
+"@img/sharp-libvips-linux-x64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linux-x64@npm:1.3.3"
   conditions: os=linux & cpu=x64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linuxmusl-arm64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linuxmusl-arm64@npm:1.3.2"
+"@img/sharp-libvips-linuxmusl-arm64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linuxmusl-arm64@npm:1.3.3"
   conditions: os=linux & cpu=arm64 & libc=musl
   languageName: node
   linkType: hard
 
-"@img/sharp-libvips-linuxmusl-x64@npm:1.3.2":
-  version: 1.3.2
-  resolution: "@img/sharp-libvips-linuxmusl-x64@npm:1.3.2"
+"@img/sharp-libvips-linuxmusl-x64@npm:1.3.3":
+  version: 1.3.3
+  resolution: "@img/sharp-libvips-linuxmusl-x64@npm:1.3.3"
   conditions: os=linux & cpu=x64 & libc=musl
   languageName: node
   linkType: hard
 
-"@img/sharp-
```

**File**: `packages/layout/README.md` (modified, +23/-0)
```diff
@@ -41,6 +41,29 @@ check out the [`@carbon/grid`](../grid) package.
 you're looking for support in a different language, feel free to file an issue
 proposing the new addition!
 
+### Modifying token values
+
+Token values are defined in [`src/dtcg/layout.json`](./src/dtcg/layout.json)
+using the [DTCG token format](https://tr.designtokens.org/format/). This is the
+single source of truth for the package — **do not edit generated files
+directly**.
+
+The following files are generated at build time and should not be hand-edited:
+
+- `js/generated/layout-tokens.js` / `js/generated/layout-tokens.d.ts` — JS
+  exports
+- `scss/generated/` — Sass variables and maps, one file per token group
+
+To add or update a token:
+
+1. Edit `src/dtcg/layout.json`
+2. Run `yarn build` in this package to regenerate all outputs
+3. Run `yarn test --testPathPatterns=packages/layout` from the repo root to
+   confirm nothing regressed
+
+For a detailed guide to the token format, converters, and how to add a new token
+category, see [`src/dtcg/README.md`](./src/dtcg/README.md).
+
 ## 🙌 Contributing
 
 We're always looking for contributors to help us fix bugs, build new features,
```

**File**: `packages/layout/examples/layout-explorer/next.config.js` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+/**
+ * Copyright IBM Corp. 2026
+ *
+ * This source code is licensed under the Apache-2.0 license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+'use strict';
+
+const { PHASE_PRODUCTION_BUILD } = require('next/constants');
+const path = require('path');
+
+const nextConfig = {
+  turbopack: {
+    root: path.resolve(__dirname, '../../../..'),
+  },
+};
+
+module.exports = (phase, { defaultConfig }) => {
+  if (phase === PHASE_PRODUCTION_BUILD) {
+    return {
+      ...nextConfig,
+      basePath: '/layout/examples/layout-explorer',
+      output: 'export',
+      distDir: 'build',
+    };
+  }
+
+  return {
+    ...defaultConfig,
+    ...nextConfig,
+  };
+};
```

**File**: `packages/layout/examples/layout-explorer/package.json` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+{
+  "name": "layout-explorer",
+  "private": true,
+  "scripts": {
+    "develop": "next",
+    "build": "next build"
+  },
+  "dependencies": {
+    "@carbon/layout": "link:../../",
+    "next": "^16.3.3",
+    "react": "^19.2.5",
+    "react-dom": "^19.2.5",
+    "sass": "^1.36.0"
+  }
+}
```

**File**: `packages/layout/examples/layout-explorer/src/pages/_app.js` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+/**
+ * Copyright IBM Corp. 2026
+ *
+ * This source code is licensed under the Apache-2.0 license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+import '../scss/styles.scss';
+
+export default function App({ Component, pageProps }) {
+  return <Component {...pageProps} />;
+}
```

**File**: `packages/layout/examples/layout-explorer/src/pages/index.js` (added, +213/-0)
```diff
@@ -0,0 +1,213 @@
+/**
+ * Copyright IBM Corp. 2026
+ *
+ * This source code is licensed under the Apache-2.0 license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+import React from 'react';
+import layoutJson from '../../../../src/dtcg/layout.json';
+
+// ── Resolve token values from layout.json ─────────────────────────────────────
+
+const MINI_UNIT = 8;
+const BASE_FONT_SIZE = 16;
+// Max rem value across all tokens — used to scale dimension bars
+const MAX_REM = 10;
+
+function resolveValue(value, extensions) {
+  const converter = extensions?.['carbon.layout']?.converter;
+  if (converter === 'miniUnits') {
+    return `${(Number(value) * MINI_UNIT) / BASE_FONT_SIZE}rem`;
+  }
+  if (converter === 'rem') {
+    return `${Number(value) / BASE_FONT_SIZE}rem`;
+  }
+  return String(value);
+}
+
+// ── Flatten layout.json into groups ──────────────────────────────────────────
+
+function buildGroups(json) {
+  const groups = [];
+  for (const [groupKey, groupVal] of Object.entries(json)) {
+    if (groupKey.startsWith('$')) continue;
+    const tokens = [];
+    for (const [tokenKey, tokenVal] of Object.entries(groupVal)) {
+      if (tokenKey.startsWith('$')) continue;
+      const resolved = resolveValue(tokenVal.$value, tokenVal.$extensions);
+      const deprecated =
+        tokenVal.$extensions?.['carbon.layout']?.deprecated === true;
+      tokens.push({
+        name: tokenKey,
+        value: resolved,
+        description: tokenVal.$description ?? '',
+        deprecated,
+      });
+    }
+    groups.push({
+      key: groupKey,
+      description: groupVal.$description ?? '',
+      tokens,
+    });
+  }
+  return groups;
+}
+
+const ALL_GROUPS = buildGroups(layoutJson);
+const GROUP_OPTIONS = ['All', ...ALL_GROUPS.map((g) => g.key)];
+
+// ── Dimension bar (proportional to rem value, capped at MAX_REM) ──────────────
+
+function DimensionBar({ value }) {
+  if (!value || !value.endsWith('rem')) return null;
+  const rem = parseFloat(value);
+  if (isNaN(rem) || rem <= 0) return null;
+  const pct = Math.min((rem / MAX_REM) * 100, 100);
+  return (
+    <div className="dimension-preview">
+      <div className="dimension-bar-wrap">
+        <div className="dimension-bar" style={{ width: `${pct}%` }} />
+      </div>
+      <span className="dimension-value">{value}</span>
+    </div>
+  );
+}
+
+// ── Main page ─────────────────────────────────────────────────────────────────
+
+export default function IndexPage({ lastBuiltOn }) {
+  const [activeGroup, setActiveGroup] = React.useState('All');
+  const [search, setSearch] = React.useState('');
+  const [showDeprecated, setShowDeprecated] = React.useState(false);
+
+  const query = search.trim().toLowerCase();
+  const hasFilters = activeGroup !== 'All' || query || showDeprecated;
+
+  const visibleGroups = ALL_GROUPS.filter(
+    (g) => activeGroup === 'All' || g.key === activeGroup
+  ).map((g) => ({
+    ...g,
+    tokens: g.tokens.filter((t) => {
+      if (!showDeprecated && t.deprecated) return false;
+      if (!query) return true;
+      return (
+        t.name.toLowerCase().includes(query) ||
+        t.value.toLowerCase().includes(query) ||
+        t.description.toLowerCase().includes(query)
+      );
+    }),
+  })).filter((g) => g.tokens.length > 0);
+
+  const totalVisible = visibleGroups.reduce((n, g) => n + g.tokens.length, 0);
+
+  return (
+    <main>
+      <section>
+        <header className="header">
+          <div className="header-title">
+            <h1>Layout tokens ({totalVisible})</h1>
+            <p>Last built on {lastBuiltOn}</p>
+          </div>
+          <div className="controls">
+            {hasFilters && (
+              <button
+                className="reset-btn"
+                onClick={() => {
+                  setActiveGroup('All');
+                  setSearch('');
+                  setShowDeprecated(false);
+                }}>
+                Reset
+              </button>
+            )}
+            <div className="control-group">
+              <label htmlFor="search">Search</label>
+              <input
+                id="search"
+                type="search"
+                placeholder="token name or value…"
+                value={search}
+                onChange={(e) => setSearch(e.target.value)}
+              />
+            </div>
+            <div className="control-group">
+              <label htmlFor="group-select">Group</label>
+              <select
+                id="group-select"
+                value={activeGroup}
+                onChange={(e) => setActiveGroup(e.target.value)}>
+                {GROUP_OPTIONS.map((name) => (
+                  <option key={name}>{name}</option>
+                ))}
+              </select>
+            </div>
+            <div className="control-group control-group--checkbox">
+              <input
+                id="show-deprecated"
+                type="checkbox"
+                checked={
```

**File**: `packages/layout/examples/layout-explorer/src/scss/styles.scss` (added, +286/-0)
```diff
@@ -0,0 +1,286 @@
+//
+// Copyright IBM Corp. 2026
+//
+// This source code is licensed under the Apache-2.0 license found in the
+// LICENSE file in the root directory of this source tree.
+//
+
+html {
+  box-sizing: border-box;
+}
+
+*,
+*::before,
+*::after {
+  box-sizing: inherit;
+}
+
+html,
+body,
+#__next {
+  width: 100%;
+  min-height: 100%;
+}
+
+body {
+  margin: 0;
+  padding: 1rem;
+  font-family: 'IBM Plex Mono', monospace;
+  background: #fff;
+  color: #161616;
+}
+
+h1 {
+  margin: 0;
+  font-size: 1.25rem;
+  font-weight: 600;
+}
+
+ul {
+  padding: 0;
+}
+
+li {
+  list-style: none;
+}
+
+table {
+  text-align: left;
+  vertical-align: middle;
+  width: 100%;
+  border-collapse: collapse;
+}
+
+table,
+tr,
+td,
+th {
+  border: 1px solid #e0e0e0;
+}
+
+td,
+th {
+  padding: 0.75rem 1rem;
+  vertical-align: middle;
+}
+
+th {
+  position: sticky;
+  top: var(--header-height);
+  background: #f4f4f4;
+  font-weight: 600;
+  z-index: 10;
+}
+
+[id] {
+  scroll-margin-top: calc(var(--header-height) + 4rem);
+}
+
+:root {
+  --header-height: 5.5rem;
+}
+
+// ── Header ───────────────────────────────────────────────────────────────────
+
+.header {
+  position: fixed;
+  top: 0;
+  left: 0;
+  right: 0;
+  background: #fff;
+  border-bottom: 1px solid #e0e0e0;
+  padding: 0 1.5rem;
+  height: var(--header-height);
+  z-index: 100;
+  display: flex;
+  align-items: center;
+  justify-content: space-between;
+  gap: 1rem;
+}
+
+.header-title {
+  display: flex;
+  flex-direction: column;
+  gap: 0.125rem;
+  white-space: nowrap;
+}
+
+.header-title p {
+  margin: 0;
+  font-size: 0.75rem;
+  color: #6f6f6f;
+}
+
+.controls {
+  display: flex;
+  align-items: flex-end;
+  gap: 1rem;
+  flex-wrap: wrap;
+}
+
+.control-group {
+  display: flex;
+  flex-direction: column;
+  gap: 0.25rem;
+  min-width: 160px;
+}
+
+.control-group label {
+  font-size: 0.6875rem;
+  font-weight: 600;
+  text-transform: uppercase;
+  letter-spacing: 0.04em;
+  color: #525252;
+}
+
+.control-group input[type='search'],
+.control-group select {
+  font-family: inherit;
+  font-size: 0.875rem;
+  padding: 0.35rem 0.5rem;
+  border: 1px solid #8d8d8d;
+  background: #fff;
+  color: #161616;
+  cursor: pointer;
+  min-width: 140px;
+}
+
+.control-group input[type='search']:focus,
+.control-group select:focus {
+  outline: 2px solid #0f62fe;
+  outline-offset: -2px;
+}
+
+.control-group--checkbox {
+  flex-direction: row;
+  align-items: center;
+  gap: 0.5rem;
+  min-width: unset;
+}
+
+.control-group--checkbox label {
+  font-size: 0.8125rem;
+  text-transform: none;
+  letter-spacing: normal;
+  color: #161616;
+  cursor: pointer;
+}
+
+.reset-btn {
+  font-family: inherit;
+  font-size: 0.8125rem;
+  padding: 0.35rem 0.75rem;
+  border: 1px solid #da1e28;
+  background: transparent;
+  color: #da1e28;
+  cursor: pointer;
+  align-self: flex-end;
+}
+
+.reset-btn:hover {
+  background: #da1e28;
+  color: #fff;
+}
+
+// ── Content ──────────────────────────────────────────────────────────────────
+
+.content {
+  padding-top: calc(var(--header-height) + 1rem);
+  padding-bottom: 2rem;
+}
+
+// ── Group heading ─────────────────────────────────────────────────────────────
+
+.group-heading {
+  margin: 2rem 0 0.25rem;
+  font-size: 1rem;
+  font-weight: 600;
+  text-transform: capitalize;
+  color: #161616;
+}
+
+.group-description {
+  margin: 0 0 0.75rem;
+  font-size: 0.8125rem;
+  color: #525252;
+}
+
+// ── Token name ────────────────────────────────────────────────────────────────
+
+.token-name a {
+  color: #0f62fe;
+  text-decoration: none;
+  font-size: 0.875rem;
+}
+
+.token-name a:hover {
+  text-decoration: underline;
+}
+
+// ── Dimension bar preview ─────────────────────────────────────────────────────
+
+.dimension-preview {
+  display: flex;
+  align-items: center;
+  gap: 0.75rem;
+}
+
+.dimension-bar-wrap {
+  flex-shrink: 0;
+  width: 10rem;
+  height: 0.375rem;
+  background: #e0e0e0;
+  position: relative;
+  border-radius: 2px;
+  overflow: hidden;
+}
+
+.dimension-bar {
+  position: absolute;
+  left: 0;
+  top: 0;
+  height: 100%;
+  background: #0f62fe;
+  border-radius: 2px;
+  min-width: 2px;
+}
+
+.dimension-value {
+  font-size: 0.875rem;
+  color: #161616;
+  font-weight: 600;
+}
+
+// ── Deprecated badge ──────────────────────────────────────────────────────────
+
+.deprecated-badge {
+  display: inline-block;
+  margin-left: 0.375rem;
+  font-size: 0.6875rem;
+  font-weight: 600;
+  background: #ffd6ae;
+  color: #8a3800;
+  border-radius: 2px;
+  padding: 1px 5px;
+}
+
+tr.deprecated-row {
+  opacity: 0.55;
+}
+
+// ── Description ───────────────────────────────────────────────────────────────
+
+.description-cell {
+  font-size: 0.8125rem;
+  color: #525252;
+  max-width: 320px;
+}
+
+// ── No results ────────────────────────────────────────────────────────────────
+
+.no-results {
+  padding: 2rem;
+  text-align: center;
+  color: #6f6f6f;
+  font-size: 0.875rem;
+}
```

---

### Incident Patch 12: `02fa0607` (2026-10-06)
**Commit Message**: fix(react): expose notification status icon descriptions (#23587)

* fix(react): expose notification status icon descriptions

* test(react): simplify notification icon coverage

**File**: `packages/react/src/components/Notification/Notification.tsx` (modified, +1/-0)
```diff
@@ -291,6 +291,7 @@ function NotificationIcon({
   return (
     <IconForKind
       className={`${prefix}--${notificationType}-notification__icon`}
+      aria-label={iconDescription}
       size={20}>
       <title>{iconDescription}</title>
     </IconForKind>
```

**File**: `packages/react/src/components/Notification/__tests__/Notification-test.js` (modified, +23/-0)
```diff
@@ -496,3 +496,26 @@ describe('Callout', () => {
     spy.mockRestore();
   });
 });
+
+describe('notification status icon', () => {
+  it('exposes the default warning description', () => {
+    render(<InlineNotification kind="warning" />);
+    expect(screen.getByRole('img', { name: 'warning icon' })).toBeVisible();
+  });
+
+  it.each([
+    InlineNotification,
+    ToastNotification,
+    ActionableNotification,
+    Callout,
+  ])('exposes the custom status description for %p', (Component) => {
+    render(
+      <Component
+        kind="warning"
+        title="Check your changes"
+        statusIconDescription="Unsaved changes"
+      />
+    );
+    expect(screen.getByRole('img', { name: 'Unsaved changes' })).toBeVisible();
+  });
+});
```

**File**: `packages/react/src/components/Notification/__tests__/__snapshots__/Notification-test.js.snap` (modified, +6/-3)
```diff
@@ -21,12 +21,13 @@ exports[`ActionableNotification should render 1`] = `
         class="cds--actionable-notification__details"
       >
         <svg
-          aria-hidden="true"
+          aria-label="error icon"
           class="cds--toast-notification__icon"
           fill="currentColor"
           focusable="false"
           height="20"
           preserveAspectRatio="xMidYMid meet"
+          role="img"
           viewBox="0 0 20 20"
           width="20"
           xmlns="http://www.w3.org/2000/svg"
@@ -105,12 +106,13 @@ exports[`InlineNotification should render 1`] = `
       class="cds--inline-notification__details"
     >
       <svg
-        aria-hidden="true"
+        aria-label="error icon"
         class="cds--inline-notification__icon"
         fill="currentColor"
         focusable="false"
         height="20"
         preserveAspectRatio="xMidYMid meet"
+        role="img"
         viewBox="0 0 20 20"
         width="20"
         xmlns="http://www.w3.org/2000/svg"
@@ -171,12 +173,13 @@ exports[`ToastNotification should render 1`] = `
     role="status"
   >
     <svg
-      aria-hidden="true"
+      aria-label="error icon"
       class="cds--toast-notification__icon"
       fill="currentColor"
       focusable="false"
       height="20"
       preserveAspectRatio="xMidYMid meet"
+      role="img"
       viewBox="0 0 20 20"
       width="20"
       xmlns="http://www.w3.org/2000/svg"
```

---

### Incident Patch 13: `5aa372df` (2026-10-05)
**Commit Message**: chore(deps): bump chromaui/action from 18.9.5 to 18.10.2 (#23594)

Bumps [chromaui/action](https://github.com/chromaui/action) from 18.9.5 to 18.10.2.
- [Release notes](https://github.com/chromaui/action/releases)
- [Changelog](https://github.com/chromaui/action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/chromaui/action/compare/6b3c2820222d23bad770d57a4ad5e2d1c91f92e9...a18e9f57b71eb05f941848c0b927aab2ee644e3e)

---
updated-dependencies:
- dependency-name: chromaui/action
  dependency-version: 18.10.2
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -460,7 +460,7 @@ jobs:
         run: yarn build
       - id: chromatic
         name: Run Chromatic
-        uses: chromaui/action@6b3c2820222d23bad770d57a4ad5e2d1c91f92e9 # v18.9.5
+        uses: chromaui/action@a18e9f57b71eb05f941848c0b927aab2ee644e3e # v18.10.2
         with:
           # 👇 Token is intentionally plaintext
           # https://www.chromatic.com/docs/github-actions/#run-chromatic-on-external-forks-of-open-source-projects
```

---

### Incident Patch 14: `6e5ec7f7` (2026-10-05)
**Commit Message**: fix(ui-shell): restore selector for side-nav hover (#23622)

**File**: `packages/styles/scss/components/ui-shell/side-nav/_side-nav.scss` (modified, +2/-2)
```diff
@@ -155,8 +155,8 @@
   }
 
   @media (any-hover: hover) {
-    .#{$prefix}--side-nav__item:not(.#{$prefix}--side-nav__item--active):hover,
-    .#{$prefix}--side-nav__item:not(.#{$prefix}--side-nav__item--active)
+    .#{$prefix}--side-nav__item:not(.#{$prefix}--side-nav__item--active):hover
+      .#{$prefix}--side-nav__item:not(.#{$prefix}--side-nav__item--active)
       > .#{$prefix}--side-nav__submenu:hover,
     .#{$prefix}--side-nav__item:not(.#{$prefix}--side-nav__item--active)
       > .#{$prefix}--side-nav__link:hover,
```

---

### Incident Patch 15: `ab7a96b9` (2026-10-02)
**Commit Message**: fix(FluidMultiSelect): add Storybook controls (#22842)

* fix(FluidMultiSelect): add Storybook controls

* Update packages/react/src/components/FluidMultiSelect/FluidMultiSelect.stories.js

Co-authored-by: kennylam <[REDACTED_EMAIL]>

* fix(FluidMultiSelect): scope story controls

* fix(FluidMultiSelect): use auto-align storybook control

* fix(FluidMultiSelect): use autoalign storybook control

* fix(FluidMultiSelect): remove defaultWidth story controls

* fix(FluidMultiSelect): constrain story width

* fix(FluidMultiSelect): remove size control; fix initial selection

---------

Co-authored-by: kennylam <[REDACTED_EMAIL]>

**File**: `packages/react/src/components/FluidMultiSelect/FluidMultiSelect.stories.js` (modified, +159/-83)
```diff
@@ -21,6 +21,13 @@ import mdx from './FluidMultiSelect.mdx';
 export default {
   title: 'Components/Fluid Components/FluidMultiSelect',
   component: FluidMultiSelect,
+  decorators: [
+    (Story) => (
+      <div style={{ width: 400 }}>
+        <Story />
+      </div>
+    ),
+  ],
   parameters: {
     docs: {
       page: mdx,
@@ -60,43 +67,36 @@ const items = [
 ];
 
 export const Default = (args) => {
-  const { defaultWidth, ...multiSelectArgs } = args;
   return (
-    <div style={{ width: defaultWidth }}>
-      <FluidMultiSelect
-        onChange={() => {}}
-        id="default"
-        titleText="Label"
-        label="Choose an option"
-        items={items}
-        itemToString={(item) => (item ? item.text : '')}
-        {...multiSelectArgs}
-      />
-    </div>
+    <FluidMultiSelect
+      id="default"
+      titleText="Label"
+      label="Choose an option"
+      items={items}
+      itemToString={(item) => (item ? item.text : '')}
+      {...args}
+    />
   );
 };
 
 const sharedArgTypes = {
+  autoAlign: {
+    control: { type: 'boolean' },
+  },
   className: {
     control: {
       type: 'text',
     },
   },
-  isCondensed: {
-    control: {
-      type: 'boolean',
-    },
-  },
-  isFilterable: {
-    control: {
-      type: 'boolean',
-    },
-  },
   disabled: {
     control: {
       type: 'boolean',
     },
   },
+  direction: {
+    control: { type: 'select' },
+    options: ['top', 'bottom'],
+  },
   invalid: {
     control: {
       type: 'boolean',
@@ -112,6 +112,22 @@ const sharedArgTypes = {
       type: 'text',
     },
   },
+  locale: {
+    control: { type: 'text' },
+  },
+  onChange: {
+    action: 'onChange',
+  },
+  onMenuChange: {
+    action: 'onMenuChange',
+  },
+  readOnly: {
+    control: { type: 'boolean' },
+  },
+  selectionFeedback: {
+    control: { type: 'select' },
+    options: ['top', 'fixed', 'top-after-reopen'],
+  },
   titleText: {
     control: {
       type: 'text',
@@ -127,83 +143,146 @@ const sharedArgTypes = {
       type: 'text',
     },
   },
+  clearSelectionDescription: {
+    control: { type: 'text' },
+  },
+  clearSelectionText: {
+    control: { type: 'text' },
+  },
+  useTitleInItem: {
+    control: { type: 'boolean' },
+  },
 };
 
-Default.args = {
-  defaultWidth: 400,
+const sharedArgs = {
+  autoAlign: false,
   className: 'test-class',
-  isCondensed: false,
-  isFilterable: false,
+  clearSelectionDescription: 'Total items selected: ',
+  clearSelectionText: 'To clear selection, press Delete or Backspace.',
+  direction: 'bottom',
   disabled: false,
   invalid: false,
   invalidText:
     'Error message that is really long can wrap to more lines but should not be excessively long.',
   label: 'Choose an option',
+  locale: 'en',
+  readOnly: false,
+  selectionFeedback: 'top-after-reopen',
   titleText: 'Label',
+  useTitleInItem: false,
   warn: false,
   warnText:
     'Warning message that is really long can wrap to more lines but should not be excessively long.',
 };
 
-Default.argTypes = {
+const filterableArgTypes = {
   ...sharedArgTypes,
-  defaultWidth: {
-    control: { type: 'range', min: 300, max: 800, step: 50 },
+  isFilterable: {
+    control: { type: 'boolean' },
+    table: { readonly: true },
+  },
+  onInputValueChange: {
+    action: 'onInputValueChange',
+  },
+};
+const condensedArgTypes = {
+  ...sharedArgTypes,
+  isCondensed: {
+    control: { type: 'boolean' },
+    table: { readonly: true },
   },
 };
+Default.args = {
+  ...sharedArgs,
+};
 
-export const Filterable = () => {
+Default.argTypes = {
+  ...sharedArgTypes,
+};
+
+export const Filterable = (args) => {
   return (
-    <div style={{ width: '400px' }}>
-      <FluidMultiSelect
-        isFilterable
-        onChange={() => {}}
-        initialSelectedItem={items[2]}
-        id="default"
-        titleText="Label"
-        label="Choose an option"
-        items={items}
-        itemToString={(item) => (item ? item.text : '')}
-      />
-    </div>
+    <FluidMultiSelect
+      initialSelectedItems={[items[2]]}
+      id="default"
+      titleText="Label"
+      label="Choose an option"
+      items={items}
+      itemToString={(item) => (item ? item.text : '')}
+      {...args}
+    />
   );
 };
 
-export const _FilterableWithLayer = () => {
+Filterable.args = {
+  ...sharedArgs,
+  isFilterable: true,
+};
+
+Filterable.argTypes = {
+  ...filterableArgTypes,
+};
+
+Filterable.parameters = {
+  controls: {
+    include: Object.keys(filterableArgTypes),
+  },
+};
+
+export const _FilterableWithLayer = (args) => {
   return (
     <WithLayer>
       {(layer) => (
-        <div style={{ width: 300 }}>
-          <FluidMultiSelect
-            isFilterable
-            id={`carbon-multiselect-example-${layer}`}
-            titleText="Multiselect title"
-            items={items}
-            itemToString={(item) => (item ? item.text : '')}
-            selectionFeedback="top-after-reopen"
-          />
-        </div>
+        <Fluid
```

**File**: `packages/web-components/src/components/fluid-multi-select/fluid-multi-select.stories.ts` (modified, +201/-176)
```diff
@@ -69,7 +69,8 @@ const selectionFeedbackOptions = {
 };
 
 const args = {
-  defaultWidth: 400,
+  autoalign: false,
+  clearSelectionLabel: 'Clear all selected items',
   clearSelectionDescription: 'Total items selected: ',
   clearSelectionText: 'To clear selection, press Delete or Backspace.',
   disabled: false,
@@ -86,29 +87,27 @@ const args = {
   warn: false,
   warnText:
     'Warning message that is really long can wrap to more lines but should not be excessively long.',
+  value: '',
 };
 
 const filterableArgs = {
-  defaultWidth: 400,
-  clearSelectionDescription: 'Total items selected: ',
-  clearSelectionText: 'To clear selection, press Delete or Backspace.',
-  disabled: false,
-  direction: DROPDOWN_DIRECTION.BOTTOM,
-  locale: 'en',
-  invalid: false,
-  invalidText:
-    'Error message that is really long can wrap to more lines but should not be excessively long.',
-  titleText: 'Label',
+  ...args,
   label: '',
-  selectionFeedback: SELECTION_FEEDBACK_OPTION.TOP_AFTER_REOPEN,
-  readOnly: false,
-  isCondensed: false,
-  warn: false,
-  warnText:
-    'Warning message that is really long can wrap to more lines but should not be excessively long.',
 };
 
+const renderFluidMultiSelectStory = (story: unknown) =>
+  html`<div style="width: 400px">${story}</div>`;
+
 const argTypes = {
+  autoalign: {
+    control: 'boolean',
+    description:
+      'Will auto-align the multi-select to avoid viewport collisions.',
+  },
+  clearSelectionLabel: {
+    control: 'text',
+    description: 'Specify the label for the button that clears selection.',
+  },
   clearSelectionDescription: {
     control: 'text',
     description:
@@ -171,23 +170,26 @@ const argTypes = {
     description:
       'Provide the text that is displayed when the control is in warning state.',
   },
-  defaultWidth: {
-    control: { type: 'range', min: 300, max: 800, step: 50 },
-  },
   isCondensed: {
     control: 'boolean',
     description:
       'Specify if the multiselect should render its menu items in condensed mode.',
   },
+  value: {
+    control: 'text',
+    description: 'The value of the selected items.',
+  },
 };
 
 export const Default = {
   args,
   argTypes,
   render: (args) => {
     const {
+      autoalign,
       clearSelectionLabel,
-      defaultWidth,
+      clearSelectionDescription,
+      clearSelectionText,
       direction,
       disabled,
       locale,
@@ -197,46 +199,45 @@ export const Default = {
       readOnly,
       titleText,
       selectionFeedback,
-      size,
       label,
       value,
       warn,
       warnText,
     } = args ?? {};
-    return html`
-      <div style="width:${defaultWidth}px">
-        <cds-fluid-multi-select
-          direction=${ifDefined(direction)}
-          ?disabled=${disabled}
-          ?invalid=${invalid}
-          ?is-condensed=${isCondensed}
-          invalid-text=${ifDefined(invalidText)}
-          clear-selection-label=${ifDefined(clearSelectionLabel)}
-          locale=${ifDefined(locale)}
-          ?read-only=${readOnly}
-          title-text=${ifDefined(titleText)}
-          selection-feedback=${ifDefined(selectionFeedback)}
-          size=${ifDefined(size)}
-          ?warn=${warn}
-          warn-text=${ifDefined(warnText)}
-          label=${ifDefined(label)}
-          value="${ifDefined(value)}">
-          <cds-multi-select-item value="example"
-            >An example option that is really long to show what should be done
-            to handle long text</cds-multi-select-item
-          >
-          <cds-multi-select-item value="all">Option 1</cds-multi-select-item>
-          <cds-multi-select-item value="cloudFoundry"
-            >Option 2</cds-multi-select-item
-          >
-          <cds-multi-select-item disabled value="staging"
-            >Option 3 - a disabled item</cds-multi-select-item
-          >
-          <cds-multi-select-item value="dea">Option 4</cds-multi-select-item>
-          <cds-multi-select-item value="router">Option 5</cds-multi-select-item>
-        </cds-fluid-multi-select>
-      </div>
-    `;
+    return renderFluidMultiSelectStory(html`
+      <cds-fluid-multi-select
+        ?autoalign=${autoalign}
+        direction=${ifDefined(direction)}
+        ?disabled=${disabled}
+        ?invalid=${invalid}
+        ?is-condensed=${isCondensed}
+        invalid-text=${ifDefined(invalidText)}
+        clear-selection-label=${ifDefined(clearSelectionLabel)}
+        clear-selection-description=${ifDefined(clearSelectionDescription)}
+        clear-selection-text=${ifDefined(clearSelectionText)}
+        locale=${ifDefined(locale)}
+        ?read-only=${readOnly}
+        title-text=${ifDefined(titleText)}
+        selection-feedback=${ifDefined(selectionFeedback)}
+        ?warn=${warn}
+        warn-text=${ifDefined(warnText)}
+        label=${ifDefined(label)}
+        value="${ifDefined(value)}">
+        <cds-multi-select-item value="example"
+          >An example option that is really long to 
```

#### Recent Merged Pull Requests:
- **PR #23667** (2026-10-07): chore(release): v11.118.0 (@carbon-automation[bot])
- **PR #23658** (2026-10-07): fix(ci): build missing CDN dependencies (@heloiselui)
- **PR #23655** (2026-10-07): chore(next): update automerge workflow (@kennylam)
- **PR #23653** (2026-10-07): chore(examples): remove example app lockfiles from source control (@kennylam)
- **PR #23649** (closed): chore(ci): add all issues to Design System project, remove Roadmap project workflow (@sstrubberg)
- **PR #23647** (2026-10-07): chore(code-connect): migrate to template files (M - N) (@heloiselui)
- **PR #23639** (2026-10-06): chore(deps): bump next from 16.3.5 to 16.3.6 in /packages/layout/examples/layout-explorer (@dependabot[bot])
- **PR #23636** (2026-10-06): chore(deps): update dependency joi to v18.2.9 [security] (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
