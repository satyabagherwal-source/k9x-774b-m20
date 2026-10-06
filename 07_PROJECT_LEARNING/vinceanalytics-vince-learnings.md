# Forensic Learning Record (Deep Inspection): vinceanalytics/vince

> **Canonical Artifact**: `07_PROJECT_LEARNING/vinceanalytics-vince-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vinceanalytics/vince](https://github.com/vinceanalytics/vince))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:45:21.673Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vinceanalytics/vince`
- **Description**: Self Hosted Alternative To Google Analytics
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2014 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `assets/js/dashboard/custom-hooks.js`
```
import { useEffect, useRef, useCallback } from 'react';

// A custom hook that behaves like `useEffect`, but
// the function does not run on the initial render.
export function useMountedEffect(fn, deps) {
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) {
      fn()
    } else {
      mounted.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

const DEBOUNCE_DELAY = 300

export function useDebounce(fn, delay = DEBOUNCE_DELAY) {
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current) }
    }
  }, [])

  return useCallback((...args) => {
    clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      fn(...args)
    }, delay)
  }, [fn, delay])
}
```

### Core Architecture Module: `assets/js/dashboard/hooks/api-client.js`
```
import { useEffect } from "react"
import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import * as api from "../api"

const LIMIT = 100

/**
 * A wrapper for the React Query library. Constructs the necessary options
 * (including pagination config) to pass into the `useInfiniteQuery` hook.
 *
 * ### Required props
 *
 * @param {Array} key - The key under which the global "query" instance will live.
 *   Should be passed as a list of two elements - `[endpoint, { query }]`. The object
 *   can also contain additional values (such as `search`) to be used by:
 *   1) React Query, to determine the uniqueness of the query instance
 *   2) the `getRequestParams` function to build the request params.
 *
 * @param {Function} getRequestParams - A function that takes the `key` prop as an
 *   argument, and returns `[query, params]` which will be used by `queryFn` that
 *   actually calls the API.
 *
 * ### Optional props
 *
 * @param {Function} [afterFetchData] - A function to call after data has been fetched.
 *   Receives the API response as an argument.
 *
 * @param {Function} [afterFetchNextPage] - A function to call after the next page has
 *   been fetched. Receives the API response as an argument.
 */

export function useAPIClient(props) {
  const {key, getRequestParams, afterFetchData, afterFetchNextPage} = props
  const [endpoint] = key
  const queryClient = useQueryClient()

  const queryFn = async ({ pageParam, queryKey }) => {
    const [query, params] = getRequestParams(queryKey)
    params.limit = LIMIT
    params.page = pageParam

    const response = await api.get(endpoint, query, params)
    
    if (pageParam === 1 && typeof afterFetchData === 'function') {
      afterFetchData(response)
    }

    if (pageParam > 1 && typeof afterFetchNextPage === 'function') {
      afterFetchNextPage(response)
    }

    return response.results
  }

  // During the cleanup phase, make sure only the first page of results
  // is cached under any `queryKey` containing this endpoint.
  useEffect(() => {
    const key = [endpoint]
    return () => {
      queryClient.setQueriesData(key, (data) => {
        if (data?.pages?.length) {
          return {
            pages: data.pages.slice(0, 1),
            pageParams: data.pageParams.slice(0, 1),
          }  
        }
      })  
    }
  }, [queryClient, endpoint])

  const getNextPageParam = (lastPageResults, _, lastPageIndex) => {
    return lastPageResults.length === LIMIT ? lastPageIndex + 1 : null
  }
  const defaultInitialPageParam = 1
  const initialPageParam = props.initialPageParam === undefined ? defaultInitialPageParam : props.initialPageParam

  return useInfiniteQuery({
    queryKey: key,
    queryFn,
    getNextPageParam,
    initialPageParam
  })
}
```

### Core Architecture Module: `assets/js/dashboard/stats/graph/graph-util.js`
```
import numberFormatter, {durationFormatter} from '../../util/number-formatter'
import { getFiltersByKeyPrefix, hasGoalFilter } from '../../util/filters'
import { revenueAvailable } from '../../query'

export function getGraphableMetrics(query, site) {
  const isRealtime = query.period === 'realtime'
  const isGoalFilter = hasGoalFilter(query)
  const isPageFilter = getFiltersByKeyPrefix(query, "page").length > 0

  if (isRealtime && isGoalFilter) {
    return ["visitors"]
  } else if (isRealtime) {
    return ["visitors", "pageviews"]
  } else if (isGoalFilter && revenueAvailable(query, site)) {
    return ["visitors", "events", "average_revenue", "total_revenue", "conversion_rate"]
  } else if (isGoalFilter) {
    return ["visitors", "events", "conversion_rate"]
  } else if (isPageFilter) {
    return ["visitors", "visits", "pageviews", "bounce_rate", "time_on_page"]
  } else {
    return ["visitors", "visits", "pageviews", "views_per_visit", "bounce_rate", "visit_duration"]
  }
}

export const METRIC_LABELS = {
  'visitors': 'Visitors',
  'pageviews': 'Pageviews',
  'events': 'Total Conversions',
  'views_per_visit': 'Views per Visit',
  'visits': 'Visits',
  'bounce_rate': 'Bounce Rate',
  'visit_duration': 'Visit Duration',
  'conversions': 'Converted Visitors',
  'conversion_rate': 'Conversion Rate',
  'average_revenue': 'Average Revenue',
  'total_revenue': 'Total Revenue',
}

export const METRIC_FORMATTER = {
  'visitors': numberFormatter,
  'pageviews': numberFormatter,
  'events': numberFormatter,
  'visits': numberFormatter,
  'views_per_visit': (number) => (number),
  'bounce_rate': (number) => (`${number}%`),
  'visit_duration': durationFormatter,
  'conversions': numberFormatter,
  'conversion_rate': (number) => (`${number}%`),
  'total_revenue': numberFormatter,
  'average_revenue': numberFormatter,
}

const buildComparisonDataset = function(comparisonPlot) {
  if (!comparisonPlot) return []

  return [{
    data: comparisonPlot,
    borderColor: 'rgba(60,70,110,0.2)',
    pointBackgroundColor: 'rgba(60,70,110,0.2)',
    pointHoverBackgroundColor: 'rgba(60, 70, 110)',
    yAxisID: 'yComparison',
  }]
}

const buildDashedDataset = function(plot, presentIndex) {
  if (!presentIndex) return []

  const dashedPart = plot.slice(presentIndex - 1, presentIndex + 1);
  const dashedPlot = (new Array(presentIndex - 1)).concat(dashedPart)

  return [{
    data: dashedPlot,
    borderDash: [3, 3],
    borderColor: 'rgba(101,116,205)',
    pointHoverBackgroundColor: 'rgba(71, 87, 193)',
    yAxisID: 'y',
  }]
}

const buildMainPlotDataset = function(plot, presentIndex) {
  const data = presentIndex ? plot.slice(0, presentIndex) : plot

  return [{
    data: data,
    borderColor: 'rgba(101,116,205)',
    pointBackgroundColor: 'rgba(101,116,205)',
    pointHoverBackgroundColor: 'rgba(71, 87, 193)',
    yAxisID: 'y',
  }]
}

export const buildDataSet = (plot, comparisonPlot, present_index, ctx, label) => {
  var gradient = ctx.createLinearGradient(0, 0, 0, 300);
  var prev_gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(101,116,205, 0.2)');
  gradient.addColorStop(1, 'rgba(101,116,205, 0)');
  prev_gradient.addColorStop(0, 'rgba(101,116,205, 0.075)');
  prev_gradient.addColorStop(1, 'rgba(101,116,205, 0)');

  const defaultOptions = { label, borderWidth: 3, pointBorderColor: "transparent", pointHoverRadius: 4, backgroundColor: gradient, fill: true }

  const dataset = [
    ...buildMainPlotDataset(plot, present_index),
    ...buildDashedDataset(plot, present_index),
    ...buildComparisonDataset(comparisonPlot)
  ]

  return dataset.map((item) => Object.assign(item, defaultOptions))
}

```

### Core Architecture Module: `assets/js/dashboard/util/date.js`
```
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc)

// https://stackoverflow.com/a/50130338
export function formatISO(date) {
  return date.format('YYYY-MM-DD')
}

export function shiftMonths(date, months) {
  return date.add(months, 'months')
}

export function shiftDays(date, days) {
  return date.add(days, 'days')
}

export function formatMonthYYYY(date) {
  return date.format('MMMM YYYY')
}

export function formatYear(date) {
  return `Year of ${date.year()}`;
}

export function formatYearShort(date) {
   return date.getUTCFullYear().toString().substring(2)
}

export function formatDay(date) {
  if (date.year() !== dayjs().year()) {
    return date.format('ddd, DD MMM YYYY')
  } else {
    return date.format('ddd, DD MMM')
  }
}

export function formatDayShort(date, includeYear = false) {
  if (includeYear) {
    return date.format('D MMM YY')
  } else {
    return date.format('D MMM')
  }
}

export function formatDateRange(site, from, to) {
  if (!from || !to) return
  if (typeof from === 'string') from = parseUTCDate(from)
  if (typeof to === 'string') to = parseUTCDate(to)

  if (from.isSame(to)) {
    return formatDay(from)
  } else if (from.isSame(to, 'year')) {
    const includeYear = !isThisYear(site, from)
    return `${formatDayShort(from, false)} - ${formatDayShort(to, includeYear)}`
  } else {
    return `${formatDayShort(from, true)} - ${formatDayShort(to, true)}`
  }
}

export function parseUTCDate(dateString) {
  return dayjs.utc(dateString)
}

export function parseNaiveDate(dateString) {
  return dayjs(dateString)
}

export function nowForSite(site) {
  return dayjs.utc().utcOffset(site.offset / 60)
}

export function yesterday(site) {
  return nowForSite(site).subtract(1, 'day')
}

export function lastMonth(site) {
  return shiftMonths(nowForSite(site), -1)
}

export function isSameDate(date1, date2) {
  return formatISO(date1) === formatISO(date2)
}

export function isSameMonth(date1, date2) {
  return formatMonthYYYY(date1) === formatMonthYYYY(date2)
}

export function isToday(site, date) {
  return isSameDate(date, nowForSite(site))
}

export function isThisMonth(site, date) {
  return formatMonthYYYY(date) === formatMonthYYYY(nowForSite(site))
}

export function isThisYear(site, date) {
  return date.year() === nowForSite(site).year()
}

export function isBefore(date1, date2, period) {
  /* assumes 'day' and 'month' are the only valid periods */
  if (date1.year() !== date2.year()) {
    return date1.year() < date2.year();
  }
  if (period === "year") {
    return false;
  }
  if (date1.month() !== date2.month()) {
    return date1.month() < date2.month();
  }
  if (period === "month") {
    return false;
  }
  return date1.date() < date2.date()
}

export function isAfter(date1, date2, period) {
  /* assumes 'day' and 'month' are the only valid periods */
  if (date1.year() !== date2.year()) {
    return date1.year() > date2.year();
  }
  if (period === "year") {
    return false;
  }
  if (date1.month() !== date2.month()) {
    return date1.month() > date2.month();
  }
  if (period === "month") {
    return false;
  }
  return date1.date() > date2.date()
}

```

### Core Architecture Module: `assets/js/dashboard/util/filters.js`
```
import { useMemo } from "react"
import * as api from '../api'
import { useQueryContext } from '../query-context'

export const FILTER_MODAL_TO_FILTER_GROUP = {
  'page': ['page', 'entry_page', 'exit_page'],
  'source': ['source', 'referrer'],
  'location': ['country', 'region', 'city'],
  'screen': ['screen'],
  'browser': ['browser', 'browser_version'],
  'os': ['os', 'os_version'],
  'utm': ['utm_medium', 'utm_source', 'utm_campaign', 'utm_term', 'utm_content'],
  'goal': ['goal'],
  'props': ['props'],
  'hostname': ['hostname']
}

export const FILTER_GROUP_TO_MODAL_TYPE = Object.fromEntries(
  Object.entries(FILTER_MODAL_TO_FILTER_GROUP)
    .flatMap(([modalName, filterGroups]) => filterGroups.map((filterGroup) => [filterGroup, modalName]))
)

export const NO_CONTAINS_OPERATOR = new Set(['goal', 'screen'].concat(FILTER_MODAL_TO_FILTER_GROUP['location']))

export const EVENT_PROPS_PREFIX = "props:"

export const FILTER_OPERATIONS = {
  is: 'is',
  isNot: 'is_not',
  contains: 'contains',
  does_not_contain: 'does_not_contain'
};

export const FILTER_OPERATIONS_DISPLAY_NAMES = {
  [FILTER_OPERATIONS.is]: 'is',
  [FILTER_OPERATIONS.isNot]: 'is not',
  [FILTER_OPERATIONS.contains]: 'contains',
  [FILTER_OPERATIONS.does_not_contain]: 'does not contain'
}

const OPERATION_PREFIX = {
  [FILTER_OPERATIONS.isNot]: '!',
  [FILTER_OPERATIONS.contains]: '~',
  [FILTER_OPERATIONS.is]: ''
};


export function supportsIsNot(filterName) {
  return !['goal', 'prop_key'].includes(filterName)
}

export function isFreeChoiceFilter(filterName) {
  return !NO_CONTAINS_OPERATOR.has(filterName)
}

// As of March 2023, Safari does not support negative lookbehind regexes. In case it throws an error, falls back to plain | matching. This means
// escaping pipe characters in filters does not currently work in Safari
let NON_ESCAPED_PIPE_REGEX;
try {
  NON_ESCAPED_PIPE_REGEX = new RegExp("(?<!\\\\)\\|", "g")
} catch (_e) {
  NON_ESCAPED_PIPE_REGEX = '|'
}

const ESCAPED_PIPE = '\\|'

export function getLabel(labels, filterKey, value) {
  if (['country', 'region', 'city'].includes(filterKey)) {
    return labels[value]
  } else {
    return value
  }
}

export function getPropertyKeyFromFilterKey(filterKey) {
  return filterKey.slice(EVENT_PROPS_PREFIX.length)
}

export function getFiltersByKeyPrefix(query, prefix) {
  return query.filters.filter(([_operation, filterKey, _clauses]) => filterKey.startsWith(prefix))
}

function omitFiltersByKeyPrefix(query, prefix) {
  return query.filters.filter(([_operation, filterKey, _clauses]) => !filterKey.startsWith(prefix))
}

export function replaceFilterByPrefix(query, prefix, filter) {
  return omitFiltersByKeyPrefix(query, prefix).concat([filter])
}

export function isFilteringOnFixedValue(query, filterKey, expectedValue) {
  const filters = query.filters.filter(([_operation, key]) => filterKey == key)
  if (filters.length == 1) {
    const [operation, _filterKey, clauses] = filters[0]
    return operation === FILTER_OPERATIONS.is && clauses.length === 1 && (!expectedValue || clauses[0] == expectedValue)
  }
  return false
}

export function hasGoalFilter(query) {
  return getFiltersByKeyPrefix(query, "goal").length > 0
}

export function useHasGoalFilter() {
  const { query: { filters } } = useQueryContext();
  return useMemo(() => getFiltersByKeyPrefix({ filters }, "goal").length > 0, [filters]);
}

export function isRealTimeDashboard(query) {
  return query?.period === 'realtime'
}

export function useIsRealtimeDashboard() {
  const { query: { period } } = useQueryContext();
  return useMemo(() => isRealTimeDashboard({ period }), [period]);
}


// Note: Currently only a single goal filter can be applied at a time.
export function getGoalFilter(query) {
  return getFiltersByKeyPrefix(query, "goal")[0] || null
}

export function formatFilterGroup(filterGroup) {
  if (filterGroup === 'utm') {
    return 'UTM tags'
  } else if (filterGroup === 'location') {
    return 'Location'
  } else if (filterGroup === 'props') {
    return 'Property'
  } else {
    return formattedFilters[filterGroup]
  }
}

export function cleanLabels(filters, labels, mergedFilterKey, mergedLabels) {
  const filteredBy = Object.fromEntries(
    filters
      .flatMap(([_operation, filterKey, clauses]) => ['country', 'region', 'city'].includes(filterKey) ? clauses : [])
      .map((value) => [value, true])
  )
  let result = { ...labels }
  for (const value in labels) {
    if (!filteredBy[value]) {
      delete result[value]
    }
  }

  if (mergedFilterKey && ['country', 'region', 'city'].includes(mergedFilterKey)) {
    result = {
      ...result,
      ...mergedLabels
    }
  }

  return result
}

const EVENT_FILTER_KEYS = new Set(["name", "page", "goal", "hostname"])

export function serializeApiFilters(filters) {
  const apiFilters = filters.map(([operation, filterKey, clauses]) => {
    let apiFilterKey = `visit:${filterKey}`
    if (filterKey.startsWith(EVENT_PROPS_PREFIX) || EVENT_FILTER_KEYS.has(filterKey)) {
      apiFilterKey = `event:${filterKey}`
    }
    return [operation, apiFilterKey, clauses]
  })

  return JSON.stringify(apiFilters)
}

export function fetchSuggestions(apiPath, query, input, additionalFilter) {
  const updatedQuery = queryForSuggestions(query, additionalFilter)
  return api.get(apiPath, updatedQuery, { q: input.trim() })
}

function queryForSuggestions(query, additionalFilter) {
  let filters = query.filters
  if (additionalFilter) {
    const [_operation, filterKey, clauses] = additionalFilter

    // For suggestions, we remove already-applied filter with same key from query and add new filter (if feasible)
    if (clauses.length > 0) {
      filters = replaceFilterByPrefix(query, filterKey, additionalFilter)
    } else {
      filters = omitFiltersByKeyPrefix(query, filterKey)
    }
  }
  return { ...query, filters }
}

export function getFilterGroup([_operation, filterKey, _clauses]) {
  return filterKey.startsWith(EVENT_PROPS_PREFIX) ? 'props' : filterKey
}


export const formattedFilters = {
  'goal': 'Goal',
  'props': 'Property',
  'prop_key': 'Property',
  'prop_value': 'Value',
  'source': 'Source',
  'utm_medium': 'UTM Medium',
  'utm_source': 'UTM Source',
  'utm_campaign': 'UTM Campaign',
  'utm_content': 'UTM Content',
  'utm_term': 'UTM Term',
  'referrer': 'Referrer URL',
  'screen': 'Screen size',
  'browser': 'Browser',
  'browser_version': 'Browser Version',
  'os': 'Operating System',
  'os_version': 'Operating System Version',
  'country': 'Country',
  'region': 'Region',
  'city': 'City',
  'page': 'Page',
  'hostname': 'Hostname',
  'entry_page': 'Entry Page',
  'exit_page': 'Exit Page',
}


export function parseLegacyFilter(filterKey, rawValue) {
  const operation = Object.keys(OPERATION_PREFIX)
    .find(operation => OPERATION_PREFIX[operation] === rawValue[0]) || FILTER_OPERATIONS.is;

  const value = operation === FILTER_OPERATIONS.is ? rawValue : rawValue.substring(1)

  const clauses = value
    .split(NON_ESCAPED_PIPE_REGEX)
    .filter((clause) => !!clause)
    .map((val) => val.replaceAll(ESCAPED_PIPE, '|'))

  return [operation, filterKey, clauses]
}

export function parseLegacyPropsFilter(rawValue) {
  return Object.entries(JSON.parse(rawValue)).map(([key, propVal]) => {
    return parseLegacyFilter(`${EVENT_PROPS_PREFIX}${key}`, propVal)
  })
}

```

### Core Architecture Module: `assets/js/dashboard/util/number-formatter.js`
```
const THOUSAND = 1000
const HUNDRED_THOUSAND = 100000
const MILLION = 1000000
const HUNDRED_MILLION = 100000000
const BILLION = 1000000000
const HUNDRED_BILLION = 100000000000
const TRILLION = 1000000000000

export default function numberFormatter(num) {
  if (num >= THOUSAND && num < MILLION) {
    const thousands = num / THOUSAND
    if (thousands === Math.floor(thousands) || num >= HUNDRED_THOUSAND) {
      return Math.floor(thousands) + 'k'
    } else {
      return (Math.floor(thousands * 10) / 10) + 'k'
    }
  } else if (num >= MILLION && num < BILLION) {
    const millions = num / MILLION
    if (millions === Math.floor(millions) || num >= HUNDRED_MILLION) {
      return Math.floor(millions) + 'M'
    } else {
      return (Math.floor(millions * 10) / 10) + 'M'
    }
  } else if (num >= BILLION && num < TRILLION) {
    const billions = num / BILLION
    if (billions === Math.floor(billions) || num >= HUNDRED_BILLION) {
      return Math.floor(billions) + 'B'
    } else {
      return (Math.floor(billions * 10) / 10) + 'B'
    }
  } else {
    return num
  }
}

function pad(num, size) {
  return ('000' + num).slice(size * -1);
}

export function durationFormatter(duration) {
  const hours = Math.floor(duration / 60 / 60)
  const minutes = Math.floor(duration / 60) % 60
  const seconds = Math.floor(duration - (minutes * 60) - (hours * 60 * 60))
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${pad(seconds, 2)}s`
  } else {
    return `${seconds}s`
  }
}

export function percentageFormatter(number) {
  if (typeof (number) === 'number') {
    return number + '%'
  } else {
    return '-'
  }
}

```

### Core Architecture Module: `assets/js/dashboard/util/realtime-update-timer.js`
```
const THIRTY_SECONDS = 30000
const tickEvent = new Event('tick')

export function start() {
    setInterval(() => {
        document.dispatchEvent(tickEvent)
    }, THIRTY_SECONDS)
}

```

### Core Architecture Module: `assets/js/dashboard/util/seconds-since-last-load.js`
```
import { useState, useEffect } from "react";

// A function component that renders an integer value of how many
// seconds have passed from the last data load on the dashboard.
// Updates the value every second when the component is visible.
export function SecondsSinceLastLoad({ lastLoadTimestamp }) {
  const [timeNow, setTimeNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTimeNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, []);

  return Math.round(Math.abs(lastLoadTimestamp - timeNow) / 1000)
}

```

### Core Architecture Module: `assets/js/dashboard/util/storage.js`
```
// This module checks if localStorage is available and uses it for persistent frontend storage
// if possible. Localstorage can be blocked by browsers when people block third-party cookies and
// the dashboard is running in embedded mode. In those cases, store stuff in a regular object instead.

const memStore = {}

// https://stackoverflow.com/a/16427747
function testLocalStorageAvailability(){
  try {
    const testItem = 'test';
    localStorage.setItem(testItem, testItem);
    localStorage.removeItem(testItem);
    return true;
  } catch(e) {
    return false;
  }
}

const isLocalStorageAvailable = testLocalStorageAvailability()

export function setItem(key, value) {
  if (isLocalStorageAvailable) {
    window.localStorage.setItem(key, value)
  } else {
    memStore[key] = value
  }
}

export function getItem(key) {
  if (isLocalStorageAvailable) {
    return window.localStorage.getItem(key)
  } else {
    return memStore[key]
  }
}

export const getDomainScopedStorageKey = (key, domain) => `${key}__${domain}`

```

### Core Architecture Module: `assets/js/dashboard/util/tooltip.js`
```
import React, { useState } from "react";
import { usePopper } from 'react-popper';
import classNames from 'classnames'

export function Tooltip({ children, info, className, onClick, boundary }) {
  const [visible, setVisible] = useState(false);
  const [referenceElement, setReferenceElement] = useState(null);
  const [popperElement, setPopperElement] = useState(null);
  const [arrowElement, setArrowElement] = useState(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'top',
    modifiers: [
      { name: 'arrow', options: { element: arrowElement } },
      {
        name: 'offset',
        options: {
          offset: [0, 4],
        },
      },
      boundary && {
        name: 'preventOverflow',
        options: {
          boundary: boundary,
        },
      },
    ],
  });

  return (
    <div className={classNames('relative', className)}>
      <div ref={setReferenceElement} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} onClick={onClick}>
        {children}

      </div>
      {info && visible && <div ref={setPopperElement} style={styles.popper} {...attributes.popper} className="z-50 p-2 rounded text-sm text-gray-100 font-bold popper-tooltip" role="tooltip">
        {info}
        <div ref={setArrowElement} style={styles.arrow} className="tooltip-arrow"></div>
      </div>
      }
    </div>
  )
}

```

### Core Architecture Module: `assets/js/dashboard/util/url.js`
```
import JsonURL from '@jsonurl/jsonurl'
import { parseSearchWith } from '@tanstack/react-router';

export function apiPath(site, path = '') {
  return `/api/stats/${encodeURIComponent(site.domain)}${path}/`
}

export function externalLinkForPage(domain, page) {
  const domainURL = new URL(`https://${domain}`)
  return `https://${domainURL.host}${page}`
}

export function isValidHttpUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}


export function trimURL(url, maxLength) {
  if (url.length <= maxLength) {
    return url;
  }

  const ellipsis = "...";

  if (isValidHttpUrl(url)) {
    const [protocol, restURL] = url.split('://');
    const parts = restURL.split('/');

    const host = parts.shift();
    if (host.length > maxLength - 5) {
      return `${protocol}://${host.substr(0, maxLength - 5)}${ellipsis}${restURL.slice(-maxLength + 5)}`;
    }

    let remainingLength = maxLength - host.length - 5;
    let trimmedURL = `${protocol}://${host}`;

    for (const part of parts) {
      if (part.length <= remainingLength) {
        trimmedURL += '/' + part;
        remainingLength -= part.length + 1;
      } else {
        const startTrim = Math.floor((remainingLength - 3) / 2);
        const endTrim = Math.ceil((remainingLength - 3) / 2);
        trimmedURL += `/${part.substr(0, startTrim)}...${part.slice(-endTrim)}`;
        break;
      }
    }

    return trimmedURL;
  } else {
    const leftSideLength = Math.floor(maxLength / 2);
    const rightSideLength = maxLength - leftSideLength;

    const leftSide = url.slice(0, leftSideLength);
    const rightSide = url.slice(-rightSideLength);

    return leftSide + ellipsis + rightSide;
  }
}

/** 
 * @param {String} input - value to encode for URI
 * @returns {String} value encoded for URI
 */
export function encodeURIComponentPermissive(input) {
  return encodeURIComponent(input)
  .replaceAll("%2C", ",")
  .replaceAll("%3A", ":")
  .replaceAll("%2F", "/")
}

export function encodeSearchParamEntries([k, v]) {
  return `${encodeURIComponentPermissive(k)}=${encodeURIComponentPermissive(v)}`
}

export function isSearchEntryDefined([_key, value]) {
  return value !== undefined
}

export function stringifySearch(searchRecord) {
    const definedSearchEntries = Object.entries(searchRecord || {}).map(stringifySearchEntry).filter(isSearchEntryDefined)

    const encodedSearchEntries = definedSearchEntries.map(encodeSearchParamEntries)
    
    return encodedSearchEntries.length ? `?${encodedSearchEntries.join('&')}` : ''
}

export function stringifySearchEntry([key, value]) {
  const isEmptyObjectOrArray = typeof value === 'object' && value !== null && Object.entries(value).length === 0;
  if (  value === undefined ||
    value === null ||
    isEmptyObjectOrArray
  ) {
    return [key, undefined]
  }
  
  return [key, JsonURL.stringify(value)]
}

export function parseSearchFragment(searchStringFragment) {
  const fragmentWithEncodedEquals = searchStringFragment.replaceAll('=','%3D');
  return JsonURL.parse(fragmentWithEncodedEquals)
}

export const parseSearch = parseSearchWith(parseSearchFragment)
```

### Core Architecture Module: `gen/go/vince/v1/util.pb.go`
```
// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.35.2
// 	protoc        (unknown)
// source: vince/v1/util.proto

package v1

import (
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type Location struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Names    []string `protobuf:"bytes,1,rep,name=names,proto3" json:"names,omitempty"`
	City     []byte   `protobuf:"bytes,2,opt,name=city,proto3" json:"city,omitempty"`
	CityCode []byte   `protobuf:"bytes,3,opt,name=city_code,json=cityCode,proto3" json:"city_code,omitempty"`
}

func (x *Location) Reset() {
	*x = Location{}
	mi := &file_vince_v1_util_proto_msgTypes[0]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *Location) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*Location) ProtoMessage() {}

func (x *Location) ProtoReflect() protoreflect.Message {
	mi := &file_vince_v1_util_proto_msgTypes[0]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use Location.ProtoReflect.Descriptor instead.
func (*Location) Descriptor() ([]byte, []int) {
	return file_vince_v1_util_proto_rawDescGZIP(), []int{0}
}

func (x *Location) GetNames() []string {
	if x != nil {
		return x.Names
	}
	return nil
}

func (x *Location) GetCity() []byte {
	if x != nil {
		return x.City
	}
	return nil
}

func (x *Location) GetCityCode() []byte {
	if x != nil {
		return x.CityCode
	}
	return nil
}

var File_vince_v1_util_proto protoreflect.FileDescriptor

var file_vince_v1_util_proto_rawDesc = []byte{
	0x0a, 0x13, 0x76, 0x69, 0x6e, 0x63, 0x65, 0x2f, 0x76, 0x31, 0x2f, 0x75, 0x74, 0x69, 0x6c, 0x2e,
	0x70, 0x72, 0x6f, 0x74, 0x6f, 0x12, 0x02, 0x76, 0x31, 0x22, 0x51, 0x0a, 0x08, 0x4c, 0x6f, 0x63,
	0x61, 0x74, 0x69, 0x6f, 0x6e, 0x12, 0x14, 0x0a, 0x05, 0x6e, 0x61, 0x6d, 0x65, 0x73, 0x18, 0x01,
	0x20, 0x03, 0x28, 0x09, 0x52, 0x05, 0x6e, 0x61, 0x6d, 0x65, 0x73, 0x12, 0x12, 0x0a, 0x04, 0x63,
	0x69, 0x74, 0x79, 0x18, 0x02, 0x20, 0x01, 0x28, 0x0c, 0x52, 0x04, 0x63, 0x69, 0x74, 0x79, 0x12,
	0x1b, 0x0a, 0x09, 0x63, 0x69, 0x74, 0x79, 0x5f, 0x63, 0x6f, 0x64, 0x65, 0x18, 0x03, 0x20, 0x01,
	0x28, 0x0c, 0x52, 0x08, 0x63, 0x69, 0x74, 0x79, 0x43, 0x6f, 0x64, 0x65, 0x42, 0x6c, 0x0a, 0x06,
	0x63, 0x6f, 0x6d, 0x2e, 0x76, 0x31, 0x42, 0x09, 0x55, 0x74, 0x69, 0x6c, 0x50, 0x72, 0x6f, 0x74,
	0x6f, 0x50, 0x01, 0x5a, 0x2f, 0x67, 0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f,
	0x76, 0x69, 0x6e, 0x63, 0x65, 0x61, 0x6e, 0x61, 0x6c, 0x79, 0x74, 0x69, 0x63, 0x73, 0x2f, 0x76,
	0x69, 0x6e, 0x63, 0x65, 0x2f, 0x67, 0x65, 0x6e, 0x2f, 0x67, 0x6f, 0x2f, 0x76, 0x69, 0x6e, 0x63,
	0x65, 0x2f, 0x76, 0x31, 0xa2, 0x02, 0x03, 0x56, 0x58, 0x58, 0xaa, 0x02, 0x02, 0x56, 0x31, 0xca,
	0x02, 0x02, 0x56, 0x31, 0xe2, 0x02, 0x0e, 0x56, 0x31, 0x5c, 0x47, 0x50, 0x42, 0x4d, 0x65, 0x74,
	0x61, 0x64, 0x61, 0x74, 0x61, 0xea, 0x02, 0x02, 0x56, 0x31, 0x62, 0x06, 0x70, 0x72, 0x6f, 0x74,
	0x6f, 0x33,
}

var (
	file_vince_v1_util_proto_rawDescOnce sync.Once
	file_vince_v1_util_proto_rawDescData = file_vince_v1_util_proto_rawDesc
)

func file_vince_v1_util_proto_rawDescGZIP() []byte {
	file_vince_v1_util_proto_rawDescOnce.Do(func() {
		file_vince_v1_util_proto_rawDescData = protoimpl.X.CompressGZIP(file_vince_v1_util_proto_rawDescData)
	})
	return file_vince_v1_util_proto_rawDescData
}

var file_vince_v1_util_proto_msgTypes = make([]protoimpl.MessageInfo, 1)
var file_vince_v1_util_proto_goTypes = []any{
	(*Location)(nil), // 0: v1.Location
}
var file_vince_v1_util_proto_depIdxs = []int32{
	0, // [0:0] is the sub-list for method output_type
	0, // [0:0] is the sub-list for method input_type
	0, // [0:0] is the sub-list for extension type_name
	0, // [0:0] is the sub-list for extension extendee
	0, // [0:0] is the sub-list for field type_name
}

func init() { file_vince_v1_util_proto_init() }
func file_vince_v1_util_proto_init() {
	if File_vince_v1_util_proto != nil {
		return
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_vince_v1_util_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   1,
			NumExtensions: 0,
			NumServices:   0,
		},
		GoTypes:           file_vince_v1_util_proto_goTypes,
		DependencyIndexes: file_vince_v1_util_proto_depIdxs,
		MessageInfos:      file_vince_v1_util_proto_msgTypes,
	}.Build()
	File_vince_v1_util_proto = out.File
	file_vince_v1_util_proto_rawDesc = nil
	file_vince_v1_util_proto_goTypes = nil
	file_vince_v1_util_proto_depIdxs = nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #92** (2025-11-10): **feat: add dark mode toggle and project labels**
  *Symptoms*: This commit addresses multiple UX improvements:  1. Dark Mode Toggle    - Add dark/light mode toggle button in header    - Persist theme preference in localStorage    - Auto-detect system dark mode preference    - Toggle icons (sun/moon) with smooth transitions  2. Project Labels    - Add optional label field to Site model (protobuf)    - Display custom labels instead of domains on homepage    - Show domain as subtitle when label differs    - Add settings UI to edit site display names    - Backend endpoint to save labels    - Fallback to domain when no label is set  3. Code Quality    - Rebuild CSS and JavaScript bundles    - Update Go protobuf generated code  Note: The home page visitor count issue (showing all-time instead of 24h) was already fixed in commit b65181d. Users need to rebuild/restart the server to see the fix.  Files Changed: - assets/js/app.js: Dark mode logic - internal/web/templates/layout/header.html: Dark mode toggle button - proto/vince/v1/config.proto: Add label field - gen/go/vince/v1/config.pb.go: Generated protobuf code - internal/web/site.go: Label handling in backend - internal/cmd/run.go: Route for updating labels - internal/web/templates/site/index.html: Display labels - internal/web/templates/site/settings.html: Label edit form
  **Post-Mortem & Fix Analysis**:
  > AI generated work is not welcome here.
  > > AI generated work is not welcome here.  Why?

- **Issue #88** (2025-09-15): **New**
  *Symptoms*: 

- **Issue #86** (2025-09-01): **fix: custom range query**
  *Symptoms*: Found another issue with custom range querying. The URL params are `from` and `to` but the functions in `query.go` were expecting a `date` param.

- **Issue #85** (2025-08-31): **fix: stats**
  *Symptoms*: This PR addresses several issues with how statistics were computed and displayed.  - The `endOfYear` function in `period.go` had a typo - The visitors count on the homepage was the all-time count instead of the last 24 hours - The database was missing a view for `encoding.Month`, which means most charts with a month resolution don't work (and will remain broken for existing data). For future data, this should be fixed. - To have a better user experience, the "weeks" granularity is now the default for periods like "last 12 months" or "year to date", so that the chart can display something even if the monthly view is missing. - The "All time" query was extremely inefficient because it started at year 0001. A better starting point (year 2000) was chosen, which effectively fixes this time range.  Additionally, I had to update the `cockroachdb/swiss` dependency for the project to build.  Closes https://github.com/vinceanalytics/vince/issues/78 (probably)  Maybe we can consider changing the `12mo` and `year` intervals back to "Month" in a year from now, when it won't affect existing installs anymore. Alternatively, we could imagine to back-fill the database I guess? I'm not willing to implement it but I guess it would also solve the missing data problem.
  **Post-Mortem & Fix Analysis**:
  > @gernest I restored the month interval wherever it was changed.

- **Issue #83** (2025-07-21): **Fails in GCP**
  *Symptoms*: ``` ❯ vince serve 2025/07/20 10:55:35 [JOB 1] WAL 000007 stopped reading at offset: (vince-data/ops/000007.log: 102); replayed 1 keys in 1 batches 2025/07/20 10:55:35 [JOB 1] WAL 000002 stopped reading at offset: (data/000002.log: 0); replayed 0 keys in 0 batches 2025/07/20 10:55:35 INFO loading translation data 2025/07/20 10:55:35 INFO complete loading translation elapsed=87.636µs keys=0 2025/07/20 10:55:35 INFO starting event processing loop 2025/07/20 10:55:35 INFO starting server addr=:8080 2025/07/20 10:55:35 INFO exiting event processing loop 2025/07/20 10:55:35 INFO Shutting down ```  Any ideas?
  **Post-Mortem & Fix Analysis**:
  > does the binary have permission to bind on port `:8080` ?
  > Yes, that was the reason, that port was taken. But it failed without any helpful errors! It worked now and I really love it!

- **Issue #80** (2025-07-07): **Possible reasons we keep getting 202 / x-plausible-dropped: 1**
  *Symptoms*: Hi team, Geofrey: Vince looks fantastic and exactly what we'd need - lightweight, great choice of underlying stack, and straightforward API. Thanks for putting in all the hard work!  Unfortunately ... we for the love of it can't get it to work? Dedicated Hetzner server, running it via `systemd` as  `ExecStart=vince serve --listen :443 --data /opt/foo/analyticsdata --autoTLS --acmeEmail accounts@foo.place --acmeDomain vince.foo.cloud --url https://vince.foo.cloud --domains www.foo.cloud --adminName foo --adminPassword ...`  Backend works, domain show as such, requests to API go through (and are even properly validate, eg triggering `pageview` to `https://www.foo.cloud` complain about missing path, but we're still stuck with a dreaded 'Waiting for first pageview on www.foo.cloud`. Requests are responded to with a body of OK, but status 202 and x-plausible-dropped: 1, same as if we trigger with `plausible('pageview', {u: 'https://www.somedifferentdomain.cloud/bar/'});`  What we tried so far:  - Ton of different combinations of scripts and their placement (`head`, outside, bottom etc). - Different domains even (with and without `www`, even tried configuring with `https://www...`) - Running it directly without systemd.  Absolutely no luck - any idea what it could be? Probably something extremely obvious, or very sneaky...  Any pointers or hints much appreciated!
  **Post-Mortem & Fix Analysis**:
  > And it was actually something obvious, when we tried different domain variations, the deploy script didn't reload `systemd` properly and we actually didn't test the correct settings which for us are:  - Starting with `--domains foo.cloud` (**without** the www). - Using `data-domain="www.foo.cloud"` in the `script` tag. - Sending pageviews/events with `https://www.foo.cloud/...` in js.  Everything works extremely well now, really recommend and appreciate!

- **Issue #79** (2025-07-10): **Large PebbleDB files in path 'internal/location/data' - was this intended to be committed?**
  *Symptoms*: Hi team,  I noticed that the PebbleDB files located in the internal/location/data directory are quite large.  Just wanted to check if these files were intentionally committed to the repository? Large binary files like PebbleDB data can often bloat the repo size and slow down cloning/pushing operations.  If they're not needed in the repo (e.g., they're generated runtime data or local cache), it might be worth adding them to .gitignore instead. Let me know your thoughts!  Thanks
  **Post-Mortem & Fix Analysis**:
  > They are intended.   We use free geoip database which does not contain country and region information. To derive country and region data we need to use geoname  database  forllwhich is massive. and not indexed.  So we fully index data for all countries and regions into pebble. Then export the resulting sstables.  Initially I used git lfs for the sstables, but when the project started to get traction I maxed out the allocated budget. T o work around this I had to improvise and commit the files in chunked state .  In short, I can't afford git lfs,  and we need the index to compute correct country and region information from geoip.

- **Issue #78** (2025-08-31): **Stats are wrong**
  *Symptoms*: There are some inconsistencies with the displayed number of visitors which makes it impossible to trust the data.  See here on the homepage (224 visitors in 24h)  ![Image](https://github.com/user-attachments/assets/4b52a3f4-dbd0-4e05-9d62-9045339afb32)  Default view (month to date: 58 unique visitors, 66 total visits)  ![Image](https://github.com/user-attachments/assets/1adf2dc4-53f1-449e-93e6-7267558155c7)  Custom range (1 May - 24 June: 2 unique visitors, 2 total visits)  ![Image](https://github.com/user-attachments/assets/f35e300e-5d2e-465b-8861-af3ff30f9425)  Even the demo instance shows the same behavior:  ![Image](https://github.com/user-attachments/assets/898c16a9-9002-4589-91ff-bf6367451db4)  Something is seriously broken, and this is not isolated to this instance. I have the same issue on a separate instance for another website.
  **Post-Mortem & Fix Analysis**:
  > Hey @gernest , is there any information about the status of this project? Is it still maintained?
  > > Hey [@gernest](https://github.com/gernest) , is there any information about the status of this project? Is it still maintained?  @beeb I use vince in production for my use case.   I'm pretty stretched at the moment and only prioritise issues directly impacting my use case.   The project is free and open source, all contributions are welcome. You can work on the  issue and I will gladly help review your PR.   
  > Are you affected by the bug I described? 

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

### Incident Patch 1: `c7b11e2d` (2025-09-01)
**Commit Message**: fix: custom range query (#86)

**File**: `internal/web/query/query.go` (modified, +12/-1)
```diff
@@ -25,7 +25,18 @@ func New(u url.Values) *Query {
 	var fs Filters
 	json.Unmarshal([]byte(u.Get("filters")), &fs)
 
-	period := period(u.Get("period"), u.Get("date"))
+	// normalize date range format
+	var dateParam string
+	if u.Get("period") == "custom" {
+		from := u.Get("from")
+		to := u.Get("to")
+		if from != "" && to != "" {
+			dateParam = from + "," + to
+		}
+	} else {
+		dateParam = u.Get("date")
+	}
+	period := period(u.Get("period"), dateParam)
 	if i := u.Get("interval"); i != "" {
 		switch i {
 		case "minute":
```

---

### Incident Patch 2: `b65181dc` (2025-08-31)
**Commit Message**: fix: stats (#85)

* fix: endOfYear helper

* chore: add multi-stage dockerfile for testing

* chore: update dependency

* fix: visitors count in homepage

* fix: store month timestamp view

* fix: set default chart granularity to "weeks" to avoid empty chart

* fix: better period start for "all" filter

* chore: delete test dockerfile

* revert: "fix: set default chart granularity to "weeks" to avoid empty chart"

This reverts commit 78b786a6a4f04b1f5fe6e6b12af6bbeaf464bc7f.

* revert: restore month interval for 6mo, 12mo and year periods

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ go 1.23.2
 require (
 	filippo.io/age v1.2.0
 	github.com/cockroachdb/pebble v0.0.0-20241105214940-2da617a0a886
-	github.com/cockroachdb/swiss v0.0.0-20240612210725-f4de07ae6964
+	github.com/cockroachdb/swiss v0.0.0-20250624142022-d6e517c1d961
 	github.com/dlclark/regexp2 v1.11.4
 	github.com/gernest/roaring v0.23.0
 	github.com/google/flatbuffers v24.3.25+incompatible
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -78,6 +78,8 @@ github.com/cockroachdb/redact v1.1.5 h1:u1PMllDkdFfPWaNGMyLD1+so+aq3uUItthCFqzwP
 github.com/cockroachdb/redact v1.1.5/go.mod h1:BVNblN9mBWFyMyqK1k3AAiSxhvhfK2oOZZ2lK+dpvRg=
 github.com/cockroachdb/swiss v0.0.0-20240612210725-f4de07ae6964 h1:Ew0znI2JatzKy52N1iS5muUsHkf2UJuhocH7uFW7jjs=
 github.com/cockroachdb/swiss v0.0.0-20240612210725-f4de07ae6964/go.mod h1:yBRu/cnL4ks9bgy4vAASdjIW+/xMlFwuHKqtmh3GZQg=
+github.com/cockroachdb/swiss v0.0.0-20250624142022-d6e517c1d961 h1:Nua446ru3juLHLZd4AwKNzClZgL1co3pUPGv3o8FlcA=
+github.com/cockroachdb/swiss v0.0.0-20250624142022-d6e517c1d961/go.mod h1:yBRu/cnL4ks9bgy4vAASdjIW+/xMlFwuHKqtmh3GZQg=
 github.com/cockroachdb/tokenbucket v0.0.0-20230807174530-cc333fc44b06 h1:zuQyyAKVxetITBuuhv3BI9cMrmStnpT18zmgmTxunpo=
 github.com/cockroachdb/tokenbucket v0.0.0-20230807174530-cc333fc44b06/go.mod h1:7nc4anLGjupUW/PeY5qiNYsdNXj7zopG+eqsS7To5IQ=
 github.com/creack/pty v1.1.9/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ33E=
```

**File**: `internal/api/visitors/visitors.go` (modified, +2/-1)
```diff
@@ -18,6 +18,7 @@ func Current(ctx context.Context, ts *timeseries.Timeseries, domain string) (vis
 
 func Visitors(ctx context.Context, ts *timeseries.Timeseries, domain string) (visitors uint64, err error) {
 	end := xtime.Now()
-	visitors = ts.Visitors(time.Time{}, end, encoding.Global, domain)
+	start := end.Add(-24 * time.Hour)
+	visitors = ts.Visitors(start, end, encoding.Hour, domain)
 	return
 }
```

**File**: `internal/timeseries/timeseries_batch.go` (modified, +2/-1)
```diff
@@ -67,8 +67,9 @@ func (b *batch) setTs(timestamp int64) {
 	ts := xtime.UnixMilli(timestamp)
 	b.views[encoding.Minute] = uint64(compute.Minute(ts).UnixMilli())
 	b.views[encoding.Hour] = uint64(compute.Hour(ts).UnixMilli())
-	b.views[encoding.Week] = uint64(compute.Week(ts).UnixMilli())
 	b.views[encoding.Day] = uint64(compute.Date(ts).UnixMilli())
+	b.views[encoding.Week] = uint64(compute.Week(ts).UnixMilli())
+	b.views[encoding.Month] = uint64(compute.Month(ts).UnixMilli())
 }
 
 func (b *batch) setDomain(m *models.Model) {
```

**File**: `internal/web/query/period.go` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ func period(str, date string) Period {
 		first := beginOfYear(last)
 		return Period{Start: first, End: last, Interval: Month}
 	case "all":
-		return Period{End: last, Interval: Date}
+		return Period{Start: time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), End: last, Interval: Date}
 	default:
 		base.Interval = Hour
 		return Period{Start: beginOfDay(base.Start), End: last, Interval: Hour}
@@ -92,5 +92,5 @@ func endOfMonth(ts time.Time) time.Time {
 }
 
 func endOfYear(ts time.Time) time.Time {
-	return beginOfMonth(ts).AddDate(1, 0, 0).Add(-time.Nanosecond)
+	return beginOfYear(ts).AddDate(1, 0, 0).Add(-time.Nanosecond)
 }
```

**File**: `internal/web/query/period_test.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+package query
+
+import (
+	"testing"
+	"time"
+)
+
+func TestEndOfYear(t *testing.T) {
+	endOf2024 := time.Date(2024, time.December, 31, 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC)
+	tests := []struct {
+		name     string
+		input    time.Time
+		expected time.Time
+	}{
+		{
+			name:     "from August",
+			input:    time.Date(2024, time.August, 15, 12, 30, 45, 0, time.UTC),
+			expected: endOf2024,
+		},
+		{
+			name:     "from January",
+			input:    time.Date(2024, time.January, 1, 0, 0, 0, 0, time.UTC),
+			expected: endOf2024,
+		},
+		{
+			name:     "from December",
+			input:    time.Date(2024, time.December, 15, 18, 20, 30, 0, time.UTC),
+			expected: endOf2024,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			result := endOfYear(tt.input)
+			if !result.Equal(tt.expected) {
+				t.Errorf("endOfYear(%v) = %v, expected %v",
+					tt.input.Format("2006-01-02 15:04:05"),
+					result.Format("2006-01-02 15:04:05"),
+					tt.expected.Format("2006-01-02 15:04:05"))
+			}
+		})
+	}
+}
```

---

### Incident Patch 3: `24ca92b0` (2025-01-25)
**Commit Message**: fix: reloading dashboard rendering 404

**File**: `internal/cmd/run.go` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ func run(ctx context.Context, c *cli.Command) error {
 		plug.Browser().Then(web.Home),
 	))
 
-	mux.HandleFunc("GET /{domain}", db.Wrap("query.Stats")(
+	mux.Handle("GET /{domain}/{$}", db.Wrap("query.Stats")(
 		plug.Browser().
 			With(web.RequireSiteAccess).
 			Then(web.Stats),
```

---

### Incident Patch 4: `f37f3a42` (2025-01-22)
**Commit Message**: Merge pull request #41 from ldidry/fix-domain-settings-link

🩹 — Fix domain settings link in site-switcher

**File**: `assets/js/dashboard/site-switcher.js` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ export default class SiteSwitcher extends React.Component {
             <a
               href={`/${encodeURIComponent(
                 this.props.site.domain
-              )}/settings/general`}
+              )}/settings`}
               className="group flex items-center px-4 py-2 md:text-sm leading-5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-900 focus:text-gray-900 dark:focus:text-gray-100"
               role="menuitem"
             >
```

---

### Incident Patch 5: `628fd3ca` (2025-01-22)
**Commit Message**: 🩹 — Fix domain settings link in site-switcher

**File**: `assets/js/dashboard/site-switcher.js` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ export default class SiteSwitcher extends React.Component {
             <a
               href={`/${encodeURIComponent(
                 this.props.site.domain
-              )}/settings/general`}
+              )}/settings`}
               className="group flex items-center px-4 py-2 md:text-sm leading-5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-900 focus:text-gray-900 dark:focus:text-gray-100"
               role="menuitem"
             >
```

---

### Incident Patch 6: `31d81658` (2025-01-18)
**Commit Message**: fix(k8s): remove wrong label in secret template

**File**: `k8s/templates/secret.yaml` (modified, +2/-3)
```diff
@@ -4,8 +4,7 @@ kind: Secret
 metadata:
   name: {{ include "vince.fullname" . }}
   labels:
-    app: plausible
-  {{- include "vince.labels" . | nindent 4 }}
+    {{- include "vince.labels" . | nindent 4 }}
 type: Opaque
 data:
   VINCE_ADMIN_NAME: {{ .Values.secret.adminName | toString | b64enc }}
@@ -14,4 +13,4 @@ data:
   VINCE_ACME_EMAIL: {{ .Values.acme.email | toString | b64enc }}
   VINCE_ACME_DOMAIN: {{ .Values.acme.domain | toString | b64enc }}
   {{- end }}
-{{- end }}
\ No newline at end of file
+{{- end }}
```

---

### Incident Patch 7: `89efbde4` (2025-01-16)
**Commit Message**: Fix typo in run.go

**File**: `internal/cmd/run.go` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ var serve = &cli.Command{
 	Flags: []cli.Flag{
 		&cli.StringFlag{
 			Name:        "listen",
-			Usage:       "host:port to dind the servser",
+			Usage:       "host:port to bind the server",
 			Value:       ":8080",
 			Sources:     cli.EnvVars("VINCE_LISTEN"),
 			Destination: &oracle.Listen,
```

---

### Incident Patch 8: `8b9b9c71` (2025-01-01)
**Commit Message**: fix links on the dashboard

**File**: `internal/web/templates/stats/stats.html` (modified, +2/-2)
```diff
@@ -39,15 +39,15 @@ <h2 class="text-3xl font-extrabold tracking-tight text-gray-900 leading-9 sm:tex
         <div class="flex mt-8 lg:flex-shrink-0 lg:mt-0">
           <div class="inline-flex shadow rounded-md">
             <a
-              href="https://www.vinceanalytics.com/guides/deployment/local/"
+              href="https://www.vinceanalytics.com/blog/deploy-local/"
               class="inline-flex items-center justify-center px-5 py-3 text-base font-medium  bg-rose-300 border border-transparent leading-6 rounded-md hover:bg-rose-400 focus:outline-none focus:ring transition duration-150 ease-in-out"
             >
               Get started
             </a>
           </div>
           <div class="inline-flex ml-3 shadow rounded-md">
             <a
-              href="https://vinceanalytics.com"
+              href="https://www.vinceanalytics.com/categories/guides/"
               class="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-rose-600 bg-white border border-transparent leading-6 rounded-md   hover:text-rose-500  focus:outline-none focus:ring transition duration-150 ease-in-out"
             >
               Learn more
```

---

### Incident Patch 9: `938f081f` (2024-12-06)
**Commit Message**: fix admin account creation

We had moved to shard per database api but admin command assummed we were
still using a single database for all shards.

This commit uses same api we use to start serve command to gain acces to
ops database on which we crate the new admin.

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 dev:
 	go build -o bin/vince
-	./bin/vince serve  --adminName acme --adminPassword 1234 --domains vinceanalytics.com --profile
+	./bin/vince serve  --adminName yolo --adminPassword 1234 --domains vinceanalytics.com --profile
 
 docker:
 	docker run --rm  -p 8080:8080 -v ./vince-data:/vince-data ghcr.io/vinceanalytics/vince:v1.7.1 serve  --adminName acme --adminPassword 1234 --domains vinceanalytics.com --profile
```

**File**: `gen/go/vince/v1/config.pb.go` (modified, +85/-85)
```diff
@@ -1,6 +1,6 @@
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.34.2
+// 	protoc-gen-go v1.35.2
 // 	protoc        (unknown)
 // source: vince/v1/config.proto
 
@@ -35,11 +35,9 @@ type Site struct {
 
 func (x *Site) Reset() {
 	*x = Site{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[0]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Site) String() string {
@@ -50,7 +48,7 @@ func (*Site) ProtoMessage() {}
 
 func (x *Site) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -118,11 +116,9 @@ type Goal struct {
 
 func (x *Goal) Reset() {
 	*x = Goal{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[1]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[1]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Goal) String() string {
@@ -133,7 +129,7 @@ func (*Goal) ProtoMessage() {}
 
 func (x *Goal) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[1]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -174,11 +170,9 @@ type Share struct {
 
 func (x *Share) Reset() {
 	*x = Share{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[2]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[2]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Share) String() string {
@@ -189,7 +183,7 @@ func (*Share) ProtoMessage() {}
 
 func (x *Share) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[2]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -236,11 +230,9 @@ type System struct {
 
 func (x *System) Reset() {
 	*x = System{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[3]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[3]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *System) String() string {
@@ -251,7 +243,7 @@ func (*System) ProtoMessage() {}
 
 func (x *System) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[3]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -280,6 +272,59 @@ func (x *System) GetEmail() string {
 	return ""
 }
 
+type Admin struct {
+	state         protoimpl.MessageState
+	sizeCache     protoimpl.SizeCache
+	unknownFields protoimpl.UnknownFields
+
+	Name           string `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
+	HashedPassword []byte `protobuf:"bytes,2,opt,name=hashed_password,json=hashedPassword,proto3" json:"hashed_password,omitempty"`
+}
+
+func (x *Admin) Reset() {
+	*x = Admin{}
+	mi := &file_vince_v1_config_proto_msgTypes[4]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
+}
+
+func (x *Admin) String() string {
+	return protoimpl.X.MessageStringOf(x)
+}
+
+func (*Admin) ProtoMessage() {}
+
+func (x *Admin) ProtoReflect() protoreflect.Message {
+	mi := &file_vince_v1_config_proto_msgTypes[4]
+	if x != nil {
+		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+		if ms.LoadMessageInfo() == nil {
+			ms.StoreMessageInfo(mi)
+		}
+		return ms
+	}
+	return mi.MessageOf(x)
+}
+
+// Deprecated: Use Admin.ProtoReflect.Descriptor instead.
+func (*Admin) Descriptor() ([]byte, []int) {
+	return file_vince_v1_config_proto_rawDescGZIP(), []int{4}
+}
+
+func (x *Admin) GetName() string {
+	if x != nil {
+		return x.Name
+	}
+	return ""
+}
+
+func (x *Admin) GetHashedPassword() []byte {
+	if x != nil {
+		return x.HashedPassword
+	}
+	return nil
+}
+
 var File_vince_v1_config_proto protoreflect.FileDescriptor
 
 var file_vince_v1_config_proto_rawDesc = []byte{
@@ -306,14 +351,18 @@ var file_vince_v1_config_proto_rawDesc = []byte{
 	0x65, 0x6d, 0x12, 0x16, 0x0a, 0x06, 0x65, 0x78, 0x70, 0x69, 0x72, 0x79, 0x18, 0x01, 0x20, 0x01,
 	0x28, 0x04, 0x52, 0x06, 0x65, 0x78, 0x70, 0x69, 0x72, 0x79, 0x12, 0x14, 0x0a, 0x05,
```

**File**: `gen/go/vince/v1/license.pb.go` (removed, +0/-157)
```diff
@@ -1,157 +0,0 @@
-// Code generated by protoc-gen-go. DO NOT EDIT.
-// versions:
-// 	protoc-gen-go v1.34.2
-// 	protoc        (unknown)
-// source: vince/v1/license.proto
-
-package v1
-
-import (
-	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
-	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
-	reflect "reflect"
-	sync "sync"
-)
-
-const (
-	// Verify that this generated code is sufficiently up-to-date.
-	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
-	// Verify that runtime/protoimpl is sufficiently up-to-date.
-	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
-)
-
-type License struct {
-	state         protoimpl.MessageState
-	sizeCache     protoimpl.SizeCache
-	unknownFields protoimpl.UnknownFields
-
-	Expiry uint64 `protobuf:"varint,4,opt,name=expiry,proto3" json:"expiry,omitempty"`
-	Email  string `protobuf:"bytes,5,opt,name=email,proto3" json:"email,omitempty"`
-}
-
-func (x *License) Reset() {
-	*x = License{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_license_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
-}
-
-func (x *License) String() string {
-	return protoimpl.X.MessageStringOf(x)
-}
-
-func (*License) ProtoMessage() {}
-
-func (x *License) ProtoReflect() protoreflect.Message {
-	mi := &file_vince_v1_license_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		if ms.LoadMessageInfo() == nil {
-			ms.StoreMessageInfo(mi)
-		}
-		return ms
-	}
-	return mi.MessageOf(x)
-}
-
-// Deprecated: Use License.ProtoReflect.Descriptor instead.
-func (*License) Descriptor() ([]byte, []int) {
-	return file_vince_v1_license_proto_rawDescGZIP(), []int{0}
-}
-
-func (x *License) GetExpiry() uint64 {
-	if x != nil {
-		return x.Expiry
-	}
-	return 0
-}
-
-func (x *License) GetEmail() string {
-	if x != nil {
-		return x.Email
-	}
-	return ""
-}
-
-var File_vince_v1_license_proto protoreflect.FileDescriptor
-
-var file_vince_v1_license_proto_rawDesc = []byte{
-	0x0a, 0x16, 0x76, 0x69, 0x6e, 0x63, 0x65, 0x2f, 0x76, 0x31, 0x2f, 0x6c, 0x69, 0x63, 0x65, 0x6e,
-	0x73, 0x65, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x12, 0x02, 0x76, 0x31, 0x22, 0x37, 0x0a, 0x07,
-	0x4c, 0x69, 0x63, 0x65, 0x6e, 0x73, 0x65, 0x12, 0x16, 0x0a, 0x06, 0x65, 0x78, 0x70, 0x69, 0x72,
-	0x79, 0x18, 0x04, 0x20, 0x01, 0x28, 0x04, 0x52, 0x06, 0x65, 0x78, 0x70, 0x69, 0x72, 0x79, 0x12,
-	0x14, 0x0a, 0x05, 0x65, 0x6d, 0x61, 0x69, 0x6c, 0x18, 0x05, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05,
-	0x65, 0x6d, 0x61, 0x69, 0x6c, 0x42, 0x6f, 0x0a, 0x06, 0x63, 0x6f, 0x6d, 0x2e, 0x76, 0x31, 0x42,
-	0x0c, 0x4c, 0x69, 0x63, 0x65, 0x6e, 0x73, 0x65, 0x50, 0x72, 0x6f, 0x74, 0x6f, 0x50, 0x01, 0x5a,
-	0x2f, 0x67, 0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x76, 0x69, 0x6e, 0x63,
-	0x65, 0x61, 0x6e, 0x61, 0x6c, 0x79, 0x74, 0x69, 0x63, 0x73, 0x2f, 0x76, 0x69, 0x6e, 0x63, 0x65,
-	0x2f, 0x67, 0x65, 0x6e, 0x2f, 0x67, 0x6f, 0x2f, 0x76, 0x69, 0x6e, 0x63, 0x65, 0x2f, 0x76, 0x31,
-	0xa2, 0x02, 0x03, 0x56, 0x58, 0x58, 0xaa, 0x02, 0x02, 0x56, 0x31, 0xca, 0x02, 0x02, 0x56, 0x31,
-	0xe2, 0x02, 0x0e, 0x56, 0x31, 0x5c, 0x47, 0x50, 0x42, 0x4d, 0x65, 0x74, 0x61, 0x64, 0x61, 0x74,
-	0x61, 0xea, 0x02, 0x02, 0x56, 0x31, 0x62, 0x06, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x33,
-}
-
-var (
-	file_vince_v1_license_proto_rawDescOnce sync.Once
-	file_vince_v1_license_proto_rawDescData = file_vince_v1_license_proto_rawDesc
-)
-
-func file_vince_v1_license_proto_rawDescGZIP() []byte {
-	file_vince_v1_license_proto_rawDescOnce.Do(func() {
-		file_vince_v1_license_proto_rawDescData = protoimpl.X.CompressGZIP(file_vince_v1_license_proto_rawDescData)
-	})
-	return file_vince_v1_license_proto_rawDescData
-}
-
-var file_vince_v1_license_proto_msgTypes = make([]protoimpl.MessageInfo, 1)
-var file_vince_v1_license_proto_goTypes = []any{
-	(*License)(nil), // 0: v1.License
-}
-var file_vince_v1_license_proto_depIdxs = []int32{
-	0, // [0:0] is the sub-list for method output_type
-	0, // [0:0] is the sub-list for method input_type
-	0, // [0:0] is the sub-list for extension type_name
-	0, // [0:0] is the sub-list for extension extendee
-	0, // [0:0] is the sub-list for field type_name
-}
-
-func init() { file_vince_v1_license_proto_init() }
-func file_vince_v1_license_proto_init() {
-	if File_vince_v1_license_proto != nil {
-		return
-	}
-	if !protoimpl.UnsafeEnabled {
-		file_vince_v1_license_proto_msgTypes[0].Exporter = func(v any, i int) any {
-			switch v := v.(*License); i {
-			case 0:
-				return &v.state
-			case 1:
-				return &v.sizeCache
-			case 2:
-				return &v.unknownFields
-			default:
-				return nil
-			}
-		}
-	}
-	type x struct{}
-	out := protoimpl.TypeBuilder{
-		File: protoimpl.DescBuilder{
-			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
-			RawDescriptor: file_vince_v1_license_proto_rawDesc,
-			NumEnums:      0,
-			NumMessages:   1,
-			NumExtensions: 0,
-			NumServices:   0,
-		},
-		GoTypes:      
```

**File**: `gen/go/vince/v1/util.pb.go` (modified, +5/-21)
```diff
@@ -1,6 +1,6 @@
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.34.2
+// 	protoc-gen-go v1.35.2
 // 	protoc        (unknown)
 // source: vince/v1/util.proto
 
@@ -32,11 +32,9 @@ type Location struct {
 
 func (x *Location) Reset() {
 	*x = Location{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_util_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_util_proto_msgTypes[0]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Location) String() string {
@@ -47,7 +45,7 @@ func (*Location) ProtoMessage() {}
 
 func (x *Location) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_util_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -132,20 +130,6 @@ func file_vince_v1_util_proto_init() {
 	if File_vince_v1_util_proto != nil {
 		return
 	}
-	if !protoimpl.UnsafeEnabled {
-		file_vince_v1_util_proto_msgTypes[0].Exporter = func(v any, i int) any {
-			switch v := v.(*Location); i {
-			case 0:
-				return &v.state
-			case 1:
-				return &v.sizeCache
-			case 2:
-				return &v.unknownFields
-			default:
-				return nil
-			}
-		}
-	}
 	type x struct{}
 	out := protoimpl.TypeBuilder{
 		File: protoimpl.DescBuilder{
```

**File**: `gen/go/vince/v1/vince.pb.go` (modified, +5/-21)
```diff
@@ -1,6 +1,6 @@
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.34.2
+// 	protoc-gen-go v1.35.2
 // 	protoc        (unknown)
 // source: vince/v1/vince.proto
 
@@ -32,11 +32,9 @@ type APIKey struct {
 
 func (x *APIKey) Reset() {
 	*x = APIKey{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_vince_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_vince_proto_msgTypes[0]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *APIKey) String() string {
@@ -47,7 +45,7 @@ func (*APIKey) ProtoMessage() {}
 
 func (x *APIKey) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_vince_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -131,20 +129,6 @@ func file_vince_v1_vince_proto_init() {
 	if File_vince_v1_vince_proto != nil {
 		return
 	}
-	if !protoimpl.UnsafeEnabled {
-		file_vince_v1_vince_proto_msgTypes[0].Exporter = func(v any, i int) any {
-			switch v := v.(*APIKey); i {
-			case 0:
-				return &v.state
-			case 1:
-				return &v.sizeCache
-			case 2:
-				return &v.unknownFields
-			default:
-				return nil
-			}
-		}
-	}
 	type x struct{}
 	out := protoimpl.TypeBuilder{
 		File: protoimpl.DescBuilder{
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -12,7 +12,6 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/matoous/go-nanoid/v2 v2.1.0
 	github.com/oschwald/maxminddb-golang v1.13.1
-	github.com/pkg/errors v0.9.1
 	github.com/stretchr/testify v1.9.0
 	github.com/urfave/cli/v3 v3.0.0-alpha9
 	golang.org/x/crypto v0.27.0
@@ -42,6 +41,7 @@ require (
 	github.com/kr/text v0.2.0 // indirect
 	github.com/matttproud/golang_protobuf_extensions v1.0.2-0.20181231171920-c182affec369 // indirect
 	github.com/molecula/apophenia v0.0.0-20190827192002-68b7a14a478b // indirect
+	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
 	github.com/prometheus/client_golang v1.12.0 // indirect
 	github.com/prometheus/client_model v0.2.1-0.20210607210712-147c58e9608a // indirect
```

**File**: `internal/cmd/admin.go` (modified, +15/-3)
```diff
@@ -2,10 +2,11 @@ package cmd
 
 import (
 	"context"
+	"log/slog"
 
 	"github.com/urfave/cli/v3"
 	"github.com/vinceanalytics/vince/internal/ops"
-	"github.com/vinceanalytics/vince/internal/util/data"
+	"github.com/vinceanalytics/vince/internal/shards"
 )
 
 var admin = &cli.Command{
@@ -32,11 +33,22 @@ var admin = &cli.Command{
 		},
 	},
 	Action: func(ctx context.Context, c *cli.Command) error {
-		db, err := data.Open(c.String("data"), nil)
+		dataPath := c.String("data")
+		db, err := shards.New(dataPath)
 		if err != nil {
 			return err
 		}
 		defer db.Close()
-		return ops.CreateAdmin(db, c.String("name"), c.String("password"))
+
+		err = ops.CreateAdmin(db.Get(), c.String("name"), c.String("password"))
+		if err != nil {
+			return err
+		}
+		a, err := ops.LoadAdmin(db.Get())
+		if err != nil {
+			return err
+		}
+		slog.Info("successfully created admin account", "name", a.Name)
+		return nil
 	},
 }
```

**File**: `internal/ops/system_operations.go` (modified, +14/-11)
```diff
@@ -1,7 +1,6 @@
 package ops
 
 import (
-	"bytes"
 	"cmp"
 	"crypto/sha512"
 	"errors"
@@ -46,10 +45,10 @@ type Ops struct {
 
 func New(db *pebble.DB, tr translation.Translator, sites ...string) *Ops {
 	o := &Ops{db: db, tr: tr}
-	name, passwd, err := loadAdmin(db)
+	admin, err := LoadAdmin(db)
 	assert.Nil(err, "checking admin")
-	o.admin.name = name
-	o.admin.password = passwd
+	o.admin.name = admin.Name
+	o.admin.password = admin.HashedPassword
 	o.sites.domains = make(map[string]*v1.Site)
 	err = data.Prefix(db, keys.SitePrefix, func(key, value []byte) error {
 		var s v1.Site
@@ -221,7 +220,9 @@ func CreateAdmin(db *pebble.DB, name string, password string) error {
 	if err != nil {
 		return fmt.Errorf("hashing admin password %w", err)
 	}
-	err = db.Set(keys.AdminPrefix, hashed, nil)
+	admin := &v1.Admin{Name: name, HashedPassword: hashed}
+	data, _ := proto.Marshal(admin)
+	err = db.Set(keys.AdminPrefix, data, nil)
 	if err != nil {
 		return fmt.Errorf("saving admin %w", err)
 	}
@@ -237,14 +238,16 @@ func (db *Ops) Admin() (name string) {
 	return db.admin.name
 }
 
-func loadAdmin(db *pebble.DB) (name string, password []byte, err error) {
+func LoadAdmin(db *pebble.DB) (a *v1.Admin, err error) {
+	a = &v1.Admin{}
 	err = data.Get(db, keys.AdminPrefix, func(val []byte) error {
-		name = "acme"
-		password = bytes.Clone(val)
-		return nil
+		return proto.Unmarshal(val, a)
 	})
-	if errors.Is(err, pebble.ErrNotFound) {
-		err = errors.New("admin account not found")
+	if err != nil {
+		if errors.Is(err, pebble.ErrNotFound) {
+			err = errors.New("admin account not found")
+		}
+		return
 	}
 	return
 }
```

---

### Incident Patch 10: `c34ef351` (2024-11-27)
**Commit Message**: fix acme key prefix

**File**: `internal/encoding/encoding.go` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ func APIKeyHash(hash []byte) []byte {
 
 func ACME(key []byte) []byte {
 	o := make([]byte, 2+len(key))
-	copy(o, keys.APIKeyHashPrefix)
+	copy(o, keys.AcmePrefix)
 	copy(o[2:], key)
 	return o
 }
```

**File**: `internal/encoding/encoding_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+package encoding
+
+import (
+	"bytes"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	"github.com/vinceanalytics/vince/internal/keys"
+	"github.com/vinceanalytics/vince/internal/models"
+)
+
+func TestPrefix(t *testing.T) {
+	type T struct {
+		name   string
+		prefix []byte
+		key    func() []byte
+	}
+
+	samples := []T{
+		{
+			"bitmap data",
+			keys.DataPrefix,
+			func() []byte {
+				var k Key
+				k.WriteData(Global, models.Field_domain, 0, 0, 0)
+				return k.Bytes()
+			},
+		},
+		{
+			"bitmap existence",
+			keys.DataExistsPrefix,
+			func() []byte {
+				var k Key
+				k.WriteExistence(Global, models.Field_domain, 0, 0, 0)
+				return k.Bytes()
+			},
+		},
+		{
+			"site",
+			keys.SitePrefix,
+			func() []byte {
+				return Site([]byte("test"))
+			},
+		},
+		{
+			"api key name",
+			keys.APIKeyNamePrefix,
+			func() []byte {
+				return APIKeyName([]byte("test"))
+			},
+		},
+		{
+			"api key hash",
+			keys.APIKeyHashPrefix,
+			func() []byte {
+				return APIKeyHash([]byte("test"))
+			},
+		},
+		{
+			"acme",
+			keys.AcmePrefix,
+			func() []byte {
+				return ACME([]byte("test"))
+			},
+		},
+		{
+			"translate Key",
+			keys.TranslateKeyPrefix,
+			func() []byte {
+				return TranslateKey(models.Field_domain, []byte("test"))
+			},
+		},
+		{
+			"translate id",
+			keys.TranslateIDPrefix,
+			func() []byte {
+				return TranslateID(models.Field_domain, 0)
+			},
+		},
+	}
+
+	for _, s := range samples {
+		t.Run(s.name, func(t *testing.T) {
+			require.True(t, bytes.HasPrefix(s.key(), s.prefix))
+		})
+	}
+}
```

**File**: `internal/encoding/translate.go` (modified, +0/-7)
```diff
@@ -22,10 +22,3 @@ func TranslateID(field models.Field, id uint64) []byte {
 	binary.BigEndian.PutUint64(o[3:], id)
 	return o
 }
-
-func TranslateSeq(field models.Field, o []byte) []byte {
-	_ = o[2]
-	copy(o, keys.TranslateSeqPrefix)
-	o[2] = byte(field)
-	return o
-}
```

**File**: `internal/util/acme/acme_cache_test.go` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+package acme
+
+import (
+	"testing"
+
+	"github.com/cockroachdb/pebble"
+	"github.com/stretchr/testify/require"
+	"golang.org/x/crypto/acme/autocert"
+)
+
+func TestCache(t *testing.T) {
+	db, err := pebble.Open(t.TempDir(), nil)
+	require.NoError(t, err)
+	defer db.Close()
+
+	ca := New(db)
+
+	key := "test"
+
+	_, err = ca.Get(nil, key)
+	require.Equal(t, autocert.ErrCacheMiss, err)
+
+	require.NoError(t, ca.Put(nil, key, []byte(key)))
+
+	value, err := ca.Get(nil, key)
+	require.NoError(t, err)
+	require.Equal(t, key, string(value))
+}
```

---

### Incident Patch 11: `b8f1d234` (2024-11-26)
**Commit Message**: fix acme pebble acme_cache

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 dev:
 	go build -o bin/vince
-	./bin/vince serve  --adminName acme --adminPassword 1234 --domains vinceanalytics.com --profile
+	./bin/vince serve  --adminName acme --adminPassword 1234 --domains vinceanalytics.com --profile --listen :443
 
 docker:
 	docker run --rm  -p 8080:8080 -v ./vince-data:/vince-data ghcr.io/vinceanalytics/vince:v1.7.1 serve  --adminName acme --adminPassword 1234 --domains vinceanalytics.com --profile
```

**File**: `internal/util/acme/acme_cache.go` (modified, +4/-0)
```diff
@@ -3,6 +3,7 @@ package acme
 import (
 	"bytes"
 	"context"
+	"errors"
 
 	"github.com/cockroachdb/pebble"
 	"github.com/vinceanalytics/vince/internal/encoding"
@@ -25,6 +26,9 @@ func (a *Cache) Get(_ context.Context, key string) (rs []byte, err error) {
 		rs = bytes.Clone(val)
 		return nil
 	})
+	if errors.Is(err, pebble.ErrNotFound) {
+		return nil, autocert.ErrCacheMiss
+	}
 	return
 }
 
```

---

### Incident Patch 12: `0a3eaa4d` (2024-11-20)
**Commit Message**: fix batch saves

Remove truncated time tracking. Rely on consistent 1 second flushes. We only
occation deviate when changing shards.

**File**: `internal/timeseries/timeseries_batch.go` (modified, +4/-25)
```diff
@@ -3,15 +3,13 @@ package timeseries
 import (
 	"errors"
 	"fmt"
-	"time"
 
 	"github.com/cockroachdb/pebble"
 	"github.com/vinceanalytics/vince/internal/encoding"
 	"github.com/vinceanalytics/vince/internal/models"
 	"github.com/vinceanalytics/vince/internal/ro2"
 	"github.com/vinceanalytics/vince/internal/shards"
 	"github.com/vinceanalytics/vince/internal/util/oracle"
-	"github.com/vinceanalytics/vince/internal/util/xtime"
 )
 
 const ShardWidth = 1 << 20
@@ -26,7 +24,6 @@ type batch struct {
 	events         uint64
 	id             uint64
 	shard          uint64
-	time           uint64
 	key            encoding.Key
 }
 
@@ -154,14 +151,6 @@ func (b *batch) add(m *models.Model) error {
 		// Skip events without timestamp, id
 		return nil
 	}
-	ts := uint64(xtime.UnixMilli(m.Timestamp).Truncate(time.Minute).UnixMilli())
-	if ts != b.time {
-		err := b.save()
-		if err != nil {
-			return err
-		}
-		b.time = ts
-	}
 	shard := (b.id + 1) / ShardWidth
 	if shard != b.shard {
 		err := b.save()
@@ -173,10 +162,10 @@ func (b *batch) add(m *models.Model) error {
 	b.events++
 	b.id = b.translate.Next()
 	id := b.id
-	ro2.WriteBSI(b.getBSI(models.Field_timestamp), id, m.Timestamp)
-	ro2.WriteBSI(b.getBSI(models.Field_id), id, int64(m.Id))
+	ro2.WriteBSI(b.bsi[models.Field_timestamp.BSI()], id, m.Timestamp)
+	ro2.WriteBSI(b.bsi[models.Field_id.BSI()], id, int64(m.Id))
 	if m.Bounce != 0 {
-		ro2.WriteBool(b.getBSI(models.Field_bounce), id, m.Bounce == 1)
+		ro2.WriteBool(b.bsi[models.Field_bounce.BSI()], id, m.Bounce == 1)
 	}
 	if m.Session {
 		ro2.WriteBool(b.mutex[models.Field_session.Mutex()], id, true)
@@ -185,7 +174,7 @@ func (b *batch) add(m *models.Model) error {
 		ro2.WriteBool(b.mutex[models.Field_view.Mutex()], id, true)
 	}
 	if m.Duration > 0 {
-		ro2.WriteBSI(b.getBSI(models.Field_duration), id, m.Duration)
+		ro2.WriteBSI(b.bsi[models.Field_duration.BSI()], id, m.Duration)
 	}
 	if m.City != 0 {
 		ro2.WriteMutex(b.mutex[models.Field_city.Mutex()], id, uint64(m.City))
@@ -223,16 +212,6 @@ func (b *batch) set(field models.Field, id uint64, value []byte) {
 	b.mutexExistence[idx].DirectAdd(id % ShardWidth)
 }
 
-func (b *batch) getBSI(field models.Field) *ro2.Bitmap {
-	idx := field.BSI()
-	bs := b.bsi[idx]
-	if bs != nil {
-		return bs
-	}
-	b.bsi[idx] = ro2.NewBitmap()
-	return b.bsi[idx]
-}
-
 func (b *batch) tr(field models.Field, value []byte) uint64 {
 	return b.translate.Assign(field, value)
 }
```

---

### Incident Patch 13: `6b6a6b48` (2024-11-20)
**Commit Message**: fix existence bits in batch

**File**: `internal/timeseries/timeseries_batch.go` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ func (b *batch) mergeData(ba *pebble.Batch, field models.Field, bm *ro2.Bitmap)
 }
 
 func (b *batch) mergeExists(ba *pebble.Batch, field models.Field, bm *ro2.Bitmap) error {
-	return b.merge(ba, field, bm, b.data)
+	return b.merge(ba, field, bm, b.exists)
 }
 
 func (b *batch) merge(ba *pebble.Batch, field models.Field, bm *ro2.Bitmap, enc func(field models.Field, co uint64) []byte) error {
```

---

### Incident Patch 14: `7c531ad9` (2024-11-20)
**Commit Message**: fix debian package

**File**: `.goreleaser.yaml` (modified, +6/-0)
```diff
@@ -31,6 +31,12 @@ nfpms:
         src: vince.service
       - dst: /etc/vince/vince.conf
         src: vince.conf
+      - dst: /var/lib/vince-data
+        type: dir
+        file_info:
+          mode: 0755
+          owner: vince
+          group: vince
     scripts:
       preinstall: vince.pre.sh
       postinstall: vince.post.sh
```

**File**: `vince.pre.sh` (modified, +1/-4)
```diff
@@ -1,4 +1 @@
-getent passwd otelcol-otlp >/dev/null || useradd --system --user-group --no-create-home --shell /sbin/nologin vince
-
-mkdir -p /var/lib/vince-data
-chown -R vince:vince /var/lib/vince-data
+getent passwd vince >/dev/null || useradd --system --user-group --no-create-home --shell /sbin/nologin vince
```

---

### Incident Patch 15: `ca87e353` (2024-11-20)
**Commit Message**: chore: fix typo

**File**: `.goreleaser.yaml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ nfpms:
     scripts:
       preinstall: vince.pre.sh
       postinstall: vince.post.sh
-      preremove: vvince.remove.sh
+      preremove: vince.remove.sh
     id: vince 
     builds:
       - vince 
```

#### Recent Merged Pull Requests:
- **PR #92** (closed): feat: add dark mode toggle and project labels (@jikkuatwork)
- **PR #88** (closed): New (@jicanghaixb)
- **PR #86** (2025-09-01): fix: custom range query (@beeb)
- **PR #85** (2025-08-31): fix: stats (@beeb)
- **PR #75** (closed): Fix: Password-protected shared links were accessible without a password (@AmeerDlshad)
- **PR #59** (closed): add new  storage (@gernest)
- **PR #57** (2025-03-16): store resolution in columns (@gernest)
- **PR #54** (2025-03-15): remove domain id in key space (@gernest)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
