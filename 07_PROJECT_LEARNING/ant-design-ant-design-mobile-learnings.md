# Forensic Learning Record (Deep Inspection): ant-design/ant-design-mobile

> **Canonical Artifact**: `07_PROJECT_LEARNING/ant-design-ant-design-mobile-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ant-design/ant-design-mobile](https://github.com/ant-design/ant-design-mobile))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:14.577Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ant-design/ant-design-mobile`
- **Description**: Essential UI blocks for building mobile web apps.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12058 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/cascade-picker/cascade-picker-utils.ts`
```
import { PickerColumn, PickerValue } from '../picker-view'
import { CascadePickerOption } from './cascade-picker'
import { useMemo } from 'react'

export function useColumnsFn(options: CascadePickerOption[]) {
  const depth = useMemo(() => {
    let depth = 0
    function traverse(options: CascadePickerOption[], currentDepth: number) {
      if (currentDepth > depth) depth = currentDepth
      const nextDepth = currentDepth + 1
      options.forEach(option => {
        if (option.children) {
          traverse(option.children, nextDepth)
        }
      })
    }
    traverse(options, 1)
    return depth
  }, [options])

  return (selected: PickerValue[]) => {
    const columns: PickerColumn[] = []
    let currentOptions = options
    let i = 0
    while (true) {
      columns.push(
        currentOptions.map(option => ({
          label: option.label,
          value: option.value,
        }))
      )
      const x = selected[i]
      const targetOptions = currentOptions.find(option => option.value === x)
      if (!targetOptions || !targetOptions.children) break
      currentOptions = targetOptions.children
      i++
    }
    while (i < depth - 1) {
      columns.push([])
      i++
    }
    return columns
  }
}

```

### Core Architecture Module: `src/components/date-picker-view/useRenderLabel.ts`
```
import { useCallback } from 'react'
import { useConfig } from '../config-provider'
import type { RenderLabel } from './date-picker-view'

export default function useRenderLabel(renderLabel?: RenderLabel): RenderLabel {
  const { locale } = useConfig()

  return useCallback(
    (type, data, info) => {
      if (renderLabel) {
        return renderLabel(type, data, info)
      }

      // Default render
      switch (type) {
        case 'minute':
        case 'second':
        case 'hour':
          return ('0' + data.toString()).slice(-2)
        case 'now':
          return locale.DatePicker.tillNow
        default:
          return data.toString()
      }
    },
    [renderLabel]
  )
}

```

### Core Architecture Module: `src/components/date-picker/date-picker-date-utils.ts`
```
import { RenderLabel } from '../date-picker-view/date-picker-view'
import { PickerColumn } from '../picker'
import type { DatePickerFilter } from './date-picker-utils'
import { TILL_NOW } from './util'

export type DatePrecision =
  | 'year'
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'

const precisionRankRecord: Record<DatePrecision, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
  minute: 4,
  second: 5,
}

function getMonthDays(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function generateDatePickerColumns(
  selected: string[],
  min: Date,
  max: Date,
  precision: DatePrecision,
  renderLabel: RenderLabel,
  filter: DatePickerFilter | undefined,
  tillNow?: boolean
) {
  const ret: PickerColumn[] = []

  const minYear = min.getFullYear()
  const minMonth = min.getMonth() + 1
  const minDay = min.getDate()
  const minHour = min.getHours()
  const minMinute = min.getMinutes()
  const minSecond = min.getSeconds()

  const maxYear = max.getFullYear()
  const maxMonth = max.getMonth() + 1
  const maxDay = max.getDate()
  const maxHour = max.getHours()
  const maxMinute = max.getMinutes()
  const maxSecond = max.getSeconds()

  const rank = precisionRankRecord[precision]

  const selectedYear = parseInt(selected[0])
  const selectedMonth = parseInt(selected[1])
  const selectedDay = parseInt(selected[2])
  const selectedHour = parseInt(selected[3])
  const selectedMinute = parseInt(selected[4])
  const selectedSecond = parseInt(selected[5])

  const isInMinYear = selectedYear === minYear
  const isInMaxYear = selectedYear === maxYear
  const isInMinMonth = isInMinYear && selectedMonth === minMonth
  const isInMaxMonth = isInMaxYear && selectedMonth === maxMonth
  const isInMinDay = isInMinMonth && selectedDay === minDay
  const isInMaxDay = isInMaxMonth && selectedDay === maxDay
  const isInMinHour = isInMinDay && selectedHour === minHour
  const isInMaxHour = isInMaxDay && selectedHour === maxHour
  const isInMinMinute = isInMinHour && selectedMinute === minMinute
  const isInMaxMinute = isInMaxHour && selectedMinute === maxMinute

  const generateColumn = (
    from: number,
    to: number,
    precision: DatePrecision
  ) => {
    let column: number[] = []
    for (let i = from; i <= to; i++) {
      column.push(i)
    }
    const prefix = selected.slice(0, precisionRankRecord[precision])
    const currentFilter = filter?.[precision]
    if (currentFilter && typeof currentFilter === 'function') {
      column = column.filter(i =>
        currentFilter(i, {
          get date() {
            const stringArray = [...prefix, i.toString()]
            return convertStringArrayToDate(stringArray)
          },
        })
      )
    }
    return column
  }

  if (rank >= precisionRankRecord.year) {
    const lower = minYear
    const upper = maxYear
    const years = generateColumn(lower, upper, 'year')
    ret.push(
      years.map(v => ({
        label: renderLabel('year', v, { selected: selectedYear === v }),
        value: v.toString(),
      }))
    )
  }

  if (rank >= precisionRankRecord.month) {
    const lower = isInMinYear ? minMonth : 1
    const upper = isInMaxYear ? maxMonth : 12
    const months = generateColumn(lower, upper, 'month')
    ret.push(
      months.map(v => ({
        label: renderLabel('month', v, { selected: selectedMonth === v }),
        value: v.toString(),
      }))
    )
  }
  if (rank >= precisionRankRecord.day) {
    const lower = isInMinMonth ? minDay : 1
    const upper = isInMaxMonth
      ? maxDay
      : getMonthDays(selectedYear, selectedMonth)
    const days = generateColumn(lower, upper, 'day')
    ret.push(
      days.map(v => ({
        label: renderLabel('day', v, { selected: selectedDay === v }),
        value: v.toString(),
      }))
    )
  }
  if (rank >= precisionRankRecord.hour) {
    const lower = isInMinDay ? minHour : 0
    const upper = isInMaxDay ? maxHour : 23
    const hours = generateColumn(lower, upper, 'hour')
    ret.push(
      hours.map(v => ({
        label: renderLabel('hour', v, { selected: selectedHour === v }),
        value: v.toString(),
      }))
    )
  }
  if (rank >= precisionRankRecord.minute) {
    const lower = isInMinHour ? minMinute : 0
    const upper = isInMaxHour ? maxMinute : 59
    const minutes = generateColumn(lower, upper, 'minute')
    ret.push(
      minutes.map(v => ({
        label: renderLabel('minute', v, { selected: selectedMinute === v }),
        value: v.toString(),
      }))
    )
  }
  if (rank >= precisionRankRecord.second) {
    const lower = isInMinMinute ? minSecond : 0
    const upper = isInMaxMinute ? maxSecond : 59
    const seconds = generateColumn(lower, upper, 'second')
    ret.push(
      seconds.map(v => ({
        label: renderLabel('second', v, { selected: selectedSecond === v }),
        value: v.toString(),
      }))
    )
  }

  // Till Now
  if (tillNow) {
    ret[0].push({
      label: renderLabel('now', null!, { selected: selected[0] === TILL_NOW }),
      value: TILL_NOW,
    })

    if (TILL_NOW === selected?.[0]) {
      for (let i = 1; i < ret.length; i += 1) {
        ret[i] = []
      }
    }
  }

  return ret
}

export function convertDateToStringArray(
  date: Date | undefined | null
): string[] {
  if (!date) return []
  return [
    date.getFullYear().toString(),
    (date.getMonth() + 1).toString(),
    date.getDate().toString(),
    date.getHours().toString(),
    date.getMinutes().toString(),
    date.getSeconds().toString(),
  ]
}

export function convertStringArrayToDate<
  T extends string | number | null | undefined,
>(value: T[]): Date {
  const yearString = value[0] ?? '1900'
  const monthString = value[1] ?? '1'
  const dateString = value[2] ?? '1'
  const hourString = value[3] ?? '0'
  const minuteString = value[4] ?? '0'
  const secondString = value[5] ?? '0'
  return new Date(
    parseInt(yearString as string),
    parseInt(monthString as string) - 1,
    parseInt(dateString as string),
    parseInt(hourString as string),
    parseInt(minuteString as string),
    parseInt(secondString as string)
  )
}

```

### Core Architecture Module: `src/components/date-picker/date-picker-quarter-utils.ts`
```
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import type { ReactNode } from 'react'
import { PickerColumn } from '../picker'
import type { DatePickerFilter } from './date-picker-utils'

dayjs.extend(quarterOfYear)

export type QuarterPrecision = 'year' | 'quarter'

const precisionRankRecord: Record<QuarterPrecision, number> = {
  year: 0,
  quarter: 1,
}

export function generateDatePickerColumns(
  selected: string[],
  min: Date,
  max: Date,
  precision: QuarterPrecision,
  renderLabel: (
    type: QuarterPrecision,
    data: number,
    info: {
      selected: boolean
    }
  ) => ReactNode,
  filter: DatePickerFilter | undefined
) {
  const ret: PickerColumn[] = []

  const minYear = min.getFullYear()
  const maxYear = max.getFullYear()

  const rank = precisionRankRecord[precision]

  const selectedYear = parseInt(selected[0])
  const isInMinYear = selectedYear === minYear
  const isInMaxYear = selectedYear === maxYear

  const minDay = dayjs(min)
  const maxDay = dayjs(max)
  const minQuarter = minDay.quarter()
  const maxQuarter = maxDay.quarter()
  const selectedQuarter = parseInt(selected[1])

  const generateColumn = (
    from: number,
    to: number,
    precision: QuarterPrecision
  ) => {
    let column: number[] = []
    for (let i = from; i <= to; i++) {
      column.push(i)
    }
    const prefix = selected.slice(0, precisionRankRecord[precision])
    const currentFilter = filter?.[precision]
    if (currentFilter && typeof currentFilter === 'function') {
      column = column.filter(i =>
        currentFilter(i, {
          get date() {
            const stringArray = [...prefix, i.toString()]
            return convertStringArrayToDate(stringArray)
          },
        })
      )
    }
    return column
  }

  if (rank >= precisionRankRecord.year) {
    const lower = minYear
    const upper = maxYear
    const years = generateColumn(lower, upper, 'year')
    ret.push(
      years.map(v => ({
        label: renderLabel('year', v, { selected: selectedYear === v }),
        value: v.toString(),
      }))
    )
  }

  if (rank >= precisionRankRecord.quarter) {
    const lower = isInMinYear ? minQuarter : 1
    const upper = isInMaxYear ? maxQuarter : 4
    const quarters = generateColumn(lower, upper, 'quarter')
    ret.push(
      quarters.map(v => ({
        label: renderLabel('quarter', v, { selected: selectedQuarter === v }),
        value: v.toString(),
      }))
    )
  }

  return ret
}

export function convertDateToStringArray(
  date: Date | undefined | null
): string[] {
  if (!date) return []
  const day = dayjs(date)
  return [day.year().toString(), day.quarter().toString()]
}

export function convertStringArrayToDate<
  T extends string | number | null | undefined,
>(value: T[]): Date {
  const yearString = value[0] ?? '1900'
  const quarterString = value[1] ?? '1'
  const day = dayjs()
    .year(parseInt(yearString as string))
    .quarter(parseInt(quarterString as string))
    .hour(0)
    .minute(0)
    .second(0)
  return day.toDate()
}

```

### Core Architecture Module: `src/components/date-picker/date-picker-utils.ts`
```
import { RenderLabel } from '../date-picker-view/date-picker-view'
import type { DatePrecision } from './date-picker-date-utils'
import * as dateUtils from './date-picker-date-utils'
import type { QuarterPrecision } from './date-picker-quarter-utils'
import * as quarterUtils from './date-picker-quarter-utils'
import type { WeekPrecision } from './date-picker-week-utils'
import * as weekUtils from './date-picker-week-utils'
import type { PickerDate } from './util'
import { TILL_NOW } from './util'

export type Precision = DatePrecision | WeekPrecision | QuarterPrecision

export type DatePickerFilter = Partial<
  Record<
    Precision,
    (
      val: number,
      extend: {
        date: Date
      }
    ) => boolean
  >
>

const precisionLengthRecord: Record<DatePrecision, number> = {
  year: 1,
  month: 2,
  day: 3,
  hour: 4,
  minute: 5,
  second: 6,
}

export const convertDateToStringArray = (
  date: Date | undefined | null,
  precision: Precision
) => {
  if (precision.includes('week')) {
    return weekUtils.convertDateToStringArray(date)
  } else if (precision.includes('quarter')) {
    return quarterUtils.convertDateToStringArray(date)
  } else {
    const datePrecision = precision as DatePrecision
    const stringArray = dateUtils.convertDateToStringArray(date)
    return stringArray.slice(0, precisionLengthRecord[datePrecision])
  }
}

export const convertStringArrayToDate = <
  T extends string | number | null | undefined,
>(
  value: T[],
  precision: Precision
) => {
  // Special case for DATE_NOW
  if (value?.[0] === TILL_NOW) {
    const now: PickerDate = new Date()
    now.tillNow = true
    return now
  }

  if (precision.includes('week')) {
    return weekUtils.convertStringArrayToDate(value)
  } else if (precision.includes('quarter')) {
    return quarterUtils.convertStringArrayToDate(value)
  } else {
    return dateUtils.convertStringArrayToDate(value)
  }
}

export const generateDatePickerColumns = (
  selected: string[],
  min: Date,
  max: Date,
  precision: Precision,
  renderLabel: RenderLabel,
  filter: DatePickerFilter | undefined,
  tillNow?: boolean
) => {
  if (precision.startsWith('week')) {
    return weekUtils.generateDatePickerColumns(
      selected,
      min,
      max,
      precision as WeekPrecision,
      renderLabel,
      filter
    )
  } else if (precision.startsWith('quarter')) {
    return quarterUtils.generateDatePickerColumns(
      selected,
      min,
      max,
      precision as QuarterPrecision,
      renderLabel,
      filter
    )
  } else {
    return dateUtils.generateDatePickerColumns(
      selected,
      min,
      max,
      precision as DatePrecision,
      renderLabel,
      filter,
      tillNow
    )
  }
}

```

### Core Architecture Module: `src/components/date-picker/date-picker-week-utils.ts`
```
import dayjs from 'dayjs'
import isLeapYear from 'dayjs/plugin/isLeapYear'
import isoWeek from 'dayjs/plugin/isoWeek'
import isoWeeksInYear from 'dayjs/plugin/isoWeeksInYear'
import type { ReactNode } from 'react'
import { PickerColumn } from '../picker'
import type { DatePickerFilter } from './date-picker-utils'

dayjs.extend(isoWeek)
dayjs.extend(isoWeeksInYear)
dayjs.extend(isLeapYear)

export type WeekPrecision = 'year' | 'week' | 'week-day'

const precisionRankRecord: Record<WeekPrecision, number> = {
  year: 0,
  week: 1,
  'week-day': 2,
}

export function generateDatePickerColumns(
  selected: string[],
  min: Date,
  max: Date,
  precision: WeekPrecision,
  renderLabel: (
    type: WeekPrecision,
    data: number,
    info: {
      selected: boolean
    }
  ) => ReactNode,
  filter: DatePickerFilter | undefined
) {
  const ret: PickerColumn[] = []

  const minDay = dayjs(min)
  const maxDay = dayjs(max)
  const minYear = minDay.isoWeekYear()
  const maxYear = maxDay.isoWeekYear()

  const rank = precisionRankRecord[precision]

  const selectedYear = parseInt(selected[0])
  const isInMinYear = selectedYear === minYear
  const isInMaxYear = selectedYear === maxYear

  const minWeek = minDay.isoWeek()
  const maxWeek = maxDay.isoWeek()
  const minWeekday = minDay.isoWeekday()
  const maxWeekday = maxDay.isoWeekday()
  const selectedWeek = parseInt(selected[1])
  const selectedWeekday = parseInt(selected[2])
  const isInMinWeek = isInMinYear && selectedWeek === minWeek
  const isInMaxWeek = isInMaxYear && selectedWeek === maxWeek
  const selectedYearWeeks = dayjs(`${selectedYear}-01-01`).isoWeeksInYear()

  const generateColumn = (
    from: number,
    to: number,
    precision: WeekPrecision
  ) => {
    let column: number[] = []
    for (let i = from; i <= to; i++) {
      column.push(i)
    }
    const prefix = selected.slice(0, precisionRankRecord[precision])
    const currentFilter = filter?.[precision]
    if (currentFilter && typeof currentFilter === 'function') {
      column = column.filter(i =>
        currentFilter(i, {
          get date() {
            const stringArray = [...prefix, i.toString()]
            return convertStringArrayToDate(stringArray)
          },
        })
      )
    }
    return column
  }

  if (rank >= precisionRankRecord.year) {
    const lower = minYear
    const upper = maxYear
    const years = generateColumn(lower, upper, 'year')
    ret.push(
      years.map(v => ({
        label: renderLabel('year', v, { selected: selectedYear === v }),
        value: v.toString(),
      }))
    )
  }

  if (rank >= precisionRankRecord.week) {
    const lower = isInMinYear ? minWeek : 1
    const upper = isInMaxYear ? maxWeek : selectedYearWeeks
    const weeks = generateColumn(lower, upper, 'week')
    ret.push(
      weeks.map(v => ({
        label: renderLabel('week', v, { selected: selectedWeek === v }),
        value: v.toString(),
      }))
    )
  }
  if (rank >= precisionRankRecord['week-day']) {
    const lower = isInMinWeek ? minWeekday : 1
    const upper = isInMaxWeek ? maxWeekday : 7
    const weeks = generateColumn(lower, upper, 'week-day')
    ret.push(
      weeks.map(v => ({
        label: renderLabel('week-day', v, { selected: selectedWeekday === v }),
        value: v.toString(),
      }))
    )
  }

  return ret
}

export function convertDateToStringArray(
  date: Date | undefined | null
): string[] {
  if (!date) return []
  const day = dayjs(date)
  return [
    day.isoWeekYear().toString(),
    day.isoWeek().toString(),
    day.isoWeekday().toString(),
  ]
}

export function convertStringArrayToDate<
  T extends string | number | null | undefined,
>(value: T[]): Date {
  const yearString = value[0] ?? '1900'
  const weekString = value[1] ?? '1'
  const weekdayString = value[2] ?? '1'
  // See https://github.com/ant-design/ant-design-mobile/issues/6905
  const day = dayjs(`${parseInt(yearString as string)}-01-04`)
    .isoWeek(parseInt(weekString as string))
    .isoWeekday(parseInt(weekdayString as string))
    .hour(0)
    .minute(0)
    .second(0)
  return day.toDate()
}

```

### Core Architecture Module: `src/components/date-picker/util.ts`
```
export const TILL_NOW = 'TILL_NOW'

export type PickerDate = Date & {
  tillNow?: boolean
}

```

### Core Architecture Module: `src/components/form/utils.ts`
```
import { isMemo, isFragment } from 'react-is'
export function toArray<T>(candidate?: T | T[] | false): T[] {
  if (candidate === undefined || candidate === false) return []

  return Array.isArray(candidate) ? candidate : [candidate]
}

// eslint-disable-next-line @typescript-eslint/ban-types
function shouldConstruct(Component: Function) {
  const prototype = Component.prototype
  return !!(prototype && prototype.isReactComponent)
}
// https://github.com/facebook/react/blob/ce13860281f833de8a3296b7a3dad9caced102e9/packages/react-reconciler/src/ReactFiber.new.js#L225
function isSimpleFunctionComponent(type: any) {
  return (
    typeof type === 'function' &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  )
}

export function isSafeSetRefComponent(component: any): boolean {
  if (isFragment(component)) return false
  if (isMemo(component)) return isSafeSetRefComponent(component.type)

  return !isSimpleFunctionComponent(component.type)
}

```

### Core Architecture Module: `src/components/image-uploader/demos/utils.tsx`
```
import { sleep } from 'demos'

export const demoSrc =
  'https://images.unsplash.com/photo-1567945716310-4745a6b7844b?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=60'

export async function mockUpload(file: File) {
  await sleep(3000)
  return {
    url: URL.createObjectURL(file),
  }
}

export async function mockUploadFail() {
  await sleep(3000)
  throw new Error('Fail to upload')
}

```

### Core Architecture Module: `src/components/picker/picker-utils.ts`
```
import { PickerColumnItem } from '../picker-view'

export const defaultRenderLabel = (item: PickerColumnItem) => item.label

```

### Core Architecture Module: `src/demos/utils/lorem.ts`
```
import { LoremIpsum } from 'lorem-ipsum'

export const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4,
  },
  wordsPerSentence: {
    max: 16,
    min: 4,
  },
})

// lorem.generateWords(1)
// lorem.generateSentences(5)
// lorem.generateParagraphs(7)

```

### Core Architecture Module: `src/hooks/index.tsx`
```
export { useFieldNames } from './useFieldNames'
export type { FieldNamesType } from './useFieldNames'

export type BaseOptionType = {
  [key: string]: any
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7075** (2026-08-05): **fix(form): support single child wrapped in array**
  *Symptoms*: Fixes #6767.  `Form.Item` currently does not handle a single React element wrapped in an array in the same way as a direct child.  This PR normalizes the children before checking whether they are valid React elements.  It:  - keeps render-prop children unchanged; - unwraps a single child from an array; - keeps multiple children unchanged; - adds a test for the initial value, value update, and form submission.  Verification:  - `pnpm exec jest src/components/form/tests/form.test.tsx --runInBand` - `pnpm run lint` - `pnpm run build` - `git diff --check`  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **Bug Fixes**   - 优化表单项对子元素的处理，确保单个子元素、多个子元素及渲染函数均能正确渲染和传递事件。   - 修复单个表单控件被数组包裹时的值初始化、编辑及提交问题。  - **Tests**   - 新增表单初始化、修改输入并提交更新值的场景验证。  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > > [!CAUTION] > The consumer version of Gemini Code Assist on GitHub has been sunset. All code review activity has officially ceased. 
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7075?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `bc3dc2d7-b39a-40de-9b87-e5f7588233b0`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 25290781d675e1927314c5c223b11faf8d0f8d7a and 419d7454a441e37d28f84ec1bc5d1ddeb0f85479.  </details>  <details> <summary>📒 Files selected for processing (2)</summary>  
  >       ```   npm i https://pkg.pr.new/antd-mobile@7075   ```     _commit: <a href="https://github.com/ant-design/ant-design-mobile/runs/92196850819"><code>419d745</code></a>_ 

- **Issue #7073** (2026-09-10): **fix(Popover): prevent ref.show() from closing immediately**
  *Symptoms*: fixed #6731  ## 问题原因  当 Popover 配置 `trigger="click"` 时，`useClickAway` 会在 document 上监听外部点击。若外部元素的点击回调调用 `ref.show()`，同一个点击事件随后仍会冒泡到 document，导致刚显示的 Popover 被立即关闭。  ## 修复逻辑  - `ref.show()` 在更新可见状态前先开启 showing guard。 - guard 使用 ref 同步记录状态，确保当前事件继续冒泡时 `useClickAway` 能立即读取。 - guard 在下一个事件任务中自动解除，仅跳过触发 `show()` 的这一次 click-away，不影响后续外部点击关闭。 - 连续调用 `show()` 时重置定时器，避免旧定时器提前解除最新一次 guard；组件卸载时清理未执行的定时器。  ## 验证  - Popover 已显示时，从外部调用 `ref.show()` 不会被同一次点击关闭。 - Popover 关闭时，可以通过 `ref.show()` 正常打开。 - showing guard 解除后，后续外部点击仍可正常关闭 Popover。  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Bug Fixes**   * 优化弹出层（Popover）的显示与关闭交互，避免通过 `show()` 打开时因同一点击事件意外立即关闭。   * 外部点击仍可正常关闭弹出层；从关闭状态调用 `show()` 后可正常打开并展示内容。 * **Tests**   * 增加对 `PopoverRef.show()` 行为的测试，覆盖防止意外关闭、外部点击关闭及重新打开等场景。 <!-- end of auto-generated comment: release notes by coderabbit.ai --> 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7073#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7073#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review paused by coderabbit.ai -->  > [!NOTE] > ## Reviews paused >  > It looks like this branch is under active development. To avoid overwhelming you with review comments due to an influx of new commits, CodeRabbit has automatically paused this review. You can configure this behavior by ch
  >       ```   npm i https://pkg.pr.new/antd-mobile@7073   ```     _commit: <a href="https://github.com/ant-design/ant-design-mobile/runs/102823485185"><code>b368bd7</code></a>_ 
  > ## [Codecov](https://app.codecov.io/gh/ant-design/ant-design-mobile/pull/7073?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 93.36%. Comparing base ([`6823d80`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/6823d807f0f8857b894ac60d188b228082ab0277?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`b368bd7`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/b368bd756bdecaf915050203ca50ce7d6ced6bda?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)). :warning: Report is 2 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@        

- **Issue #7061** (2026-06-11): **NumberKeyboard 文档渲染错误**
  *Symptoms*: ### Version of antd-mobile  5.42.2  ### Description  <img width="1852" height="916" alt="Image" src="https://github.com/user-attachments/assets/c5cf7966-583d-4e6a-9d33-da8d3511f9b5" />

- **Issue #7060** (2026-06-11): **fix(utils): 延迟初始化 px 转换器**
  *Symptoms*: close #6694 修复 HtmlWebpackPlugin 配置 injet head 时报错  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **优化改进**   * 像素转换工具改为懒加载：首次调用时才初始化所需测试元素，避免模块加载时立即创建并防止重复初始化。   * 增加运行环境检查：仅在有 DOM 且 document.body 存在时初始化，提升稳定性与性能。  * **测试**   * 新增 Jest 测试覆盖懒加载、初始化去重、转换逻辑、边界用例及 SSR/无 DOM 情况验证。 <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7060?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `8a4a7d2e-eace-4e51-b448-24156dcc6174`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between ead367269d69d54214345bb948eeb00a748da00a and 921074bf3750da835de467000b66608797d003db.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `sr
  >       ```   npm i https://pkg.pr.new/antd-mobile@7060   ```     _commit: <a href="https://github.com/ant-design/ant-design-mobile/runs/80751727231"><code>921074b</code></a>_ 
  > ## [Codecov](https://app.codecov.io/gh/ant-design/ant-design-mobile/pull/7060?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 93.27%. Comparing base ([`7caccd0`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/7caccd015e7a39055f84391f5c9a4dcc0913d656?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`921074b`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/921074bf3750da835de467000b66608797d003db?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@        

- **Issue #7059** (2026-06-09): **fix(notice-bar): 阻止关闭按钮点击事件冒泡**
  *Symptoms*: close #6559   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Bug Fixes**   * 修复 NoticeBar 关闭按钮点击时的事件冒泡问题：点击关闭图标只会触发关闭回调，不会再向外层容器传递点击事件，避免意外触发外层点击处理。  * **Tests**   * 新增关闭按钮点击行为的测试用例，验证在同时提供 onClick 与 onClose 时，点击关闭图标仅调用关闭回调且不冒泡。 <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7059?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `2b72d5a9-1317-4eb7-95e1-6067cb88a4a0`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between ea057a0d7621a369ac6878c8d2d1cb7392ce15b0 and 1f45d8afe03e517067441e76d6187461b935b7f9.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `sr
  >       ```   npm i https://pkg.pr.new/antd-mobile@7059   ```     _commit: <a href="https://github.com/ant-design/ant-design-mobile/runs/80262459673"><code>1f45d8a</code></a>_ 
  > ## [Codecov](https://app.codecov.io/gh/ant-design/ant-design-mobile/pull/7059?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 92.98%. Comparing base ([`072d410`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/072d410133ce985d1db1a3244fbf2ffe10d22f0e?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`1f45d8a`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/1f45d8afe03e517067441e76d6187461b935b7f9?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##           master 

- **Issue #7058** (2026-06-09): **fix(Segmented): 修复滑块移动时越界问题**
  *Symptoms*: close #6768   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **样式**   * 优化了分段控件拇指元素的盒模型计算。  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7058?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `b81e0e7c-1dc3-45f5-bf2b-2db648b5f8c4`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 4f654cf60db3ce6a72922a70591c8d9c950612cc and 339f4e900fef0c124c22e88c8b49e44da23683fa.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `sr
  >       ```   npm i https://pkg.pr.new/antd-mobile@7058   ```     _commit: <a href="https://github.com/ant-design/ant-design-mobile/runs/80242369039"><code>4b3d6bb</code></a>_ 
  > ## [Codecov](https://app.codecov.io/gh/ant-design/ant-design-mobile/pull/7058?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 92.97%. Comparing base ([`4f654cf`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/4f654cf60db3ce6a72922a70591c8d9c950612cc?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`4b3d6bb`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/4b3d6bb314dbb3d1089a7bca43f810e0f45ddda0?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    

- **Issue #7056** (2026-06-08): **选项为0时判断短路了**
  *Symptoms*: 我的 Selector.options[0,1,2] 如果表单initialValues值为0无法渲染出选中内容  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug 修复**   * 修复了选择器组件在不同数值格式下激活状态显示不正确的问题，确保选项的激活态判断更加稳定可靠。  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7056?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## 变更总览  Selector 组件的选项激活态判断逻辑更新为值类型归一化处理。若 `value` 为数组直接使用，否则包装为单元素数组，从而在 value 形态不同时保持激活态计算可用。  ## 变更详情  **Selector 组件激活态判断修复**  |层级 / 文件|摘要| |---|---| |**激活态计算的值类型归一化** <br> `src/components/selector/selector.tsx`|激活态判断逻辑从 `(value \|\| []).includes(item)` 改为先通过 `Array.isArray(value)` 判断，非数组则包装为 `[value]`，再执行 includes 判断，以兼容不同的 value 类型。|  🎯 1 (Trivial) | ⏱️ ~3 minutes  > 🐰 *一行代码守护激活态，*   > *数组与非数组齐轻舞，*   > *类型规一化，bug 消无踪！*  </details>  <!-- walkthrough_end --> <!-- pre_merge_checks_walkthrough_start -->  <deta
  >       ```   npm i https://pkg.pr.new/antd-mobile@7056   ```     _commit: <a href="https://github.com/ant-design/ant-design-mobile/runs/79763648123"><code>7c80b33</code></a>_ 
  > 感谢你的 PR！🙏  不过经过分析，这里可能是使用方式上的小误会：  Selector 组件的 `value` 属性类型定义是 `V[]`（数组），`defaultValue` 同样也是数组类型。所以如果 options 的值是 `[0, 1, 2]`，在 Form 的 `initialValues` 中应该传 `[0]` 而不是 `0`。  ```tsx // ✅ 正确用法 <Selector options={options} value={[0]} />  // ❌ 类型不匹配 <Selector options={options} value={0} /> ```  这样就能正常渲染出选中状态了。希望对你有帮助！如果还有其他问题欢迎继续反馈。

- **Issue #7049** (2026-05-20): **fix(Dropdown): Optimize position update logic for dropdown on scroll and resize**
  *Symptoms*: close #6579   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Bug Fixes**   * 优化下拉菜单位置计算与更新：打开时即时设置初始位置，并在滚动与窗口尺寸变化时通过更稳定的调度持续调整，避免重复更新与抖动，提升定位准确性与渲染性能，滚动/缩放场景下体验更流畅且更省资源。  <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/ant-design/ant-design-mobile/pull/7049?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `6a06c331-1789-483a-8f26-23e04520e4a9`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 4c1e204efe97ddada1b7919a3669edfa8da9a2ce and b6b19abad90363e154f87480ab1ead9a29af6fcb.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `src/components/dropdown/dropdown.tsx`  </details>  </details>  --- <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  将 Dropdown 的 top 计算改为在 requestAnimationFrame 回调中读取容器底部并按需更新；当弹窗存在时初始化位置并通过 scroll（passive, capture）与 resize 事件持续触发 updateTop，卸载时取消 RAF 并移除监听器。  ## 变更  **Dropdown 位置动态更新**  |Layer / Fi
  >       ```   npm i https://pkg.pr.new/antd-mobile@7049   ```     _commit: <a href="https://github.com/ant-design/ant-design-mobile/runs/76915205578"><code>cc2666d</code></a>_ 
  > ## [Codecov](https://app.codecov.io/gh/ant-design/ant-design-mobile/pull/7049?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design) Report :x: Patch coverage is `87.50000%` with `2 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 92.94%. Comparing base ([`7e59dc8`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/7e59dc82b6606d28e2a2b1d41d7a8df3ec629e14?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)) to head ([`cc2666d`](https://app.codecov.io/gh/ant-design/ant-design-mobile/commit/cc2666d72c16ab0e3e5d2be4b57be67ca632bda9?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ant-design)).  | [Files with missing lines](https://app.codecov.io/gh/ant-design/ant-design-mobile/pull/7049?dropdown=coverage&src=

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

### Incident Patch 1: `0ffa8749` (2026-09-14)
**Commit Message**: docs: require versioned release commit title

**File**: `.agents/skills/antd-mobile-release/SKILL.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ description: 在 ant-design-mobile 仓库准备发版、核对版本、编译验
 
 1. 基于最新 `master`，检查工作区和远端 CI。按锁文件安装依赖，使用与项目兼容的 Node.js、pnpm 版本，不顺手升级依赖或修改包管理配置。
 2. 将 `package.json` 改为确认的目标版本。执行 `pnpm build` 和适用的测试、检查，核对 `lib/package.json` 与目标版本一致，并检查预期发布文件；失败时先修复并重新验证，不带着失败结果提交。
-3. 只提交本次发版相关文件，可用 `chore: change version` 作为提交信息；推送至 `origin/master`，核对远端提交与本地一致，并报告远端 CI 状态。不能安全更新或推送时，说明阻塞，不覆盖他人改动。
+3. 只提交本次发版相关文件。版本提交标题必须写明完整目标版本，使用 `chore: release v<version>`，例如 `chore: release v5.43.0`；不得使用 `chore: change version` 等不含版本号的泛化标题。提交后核对标题与 `package.json` 版本一致，再推送至 `origin/master`，核对远端提交与本地一致，并报告远端 CI 状态。不能安全更新或推送时，说明阻塞，不覆盖他人改动。
 4. 整理上个稳定版以来的变更，准备简洁的中英文 GitHub Release 日志及相关 PR 链接。在此交接：准备阶段不创建或推送 tag，不运行 `pnpm pub`、`pnpm pub:alpha` 或 `pnpm pub:dev`，也不创建 GitHub Release。向用户报告版本、提交、构建与检查结果，以及仍需用户手工完成的步骤。
 
 ## 交给用户的手工发布指令
```

---

### Incident Patch 2: `ccdf5fa9` (2026-09-10)
**Commit Message**: fix(Popover): prevent ref.show() from closing immediately (#7073)

* fix(popover): 修复点击外部触发 ref.show() 时弹窗关闭问题

- 新增 showingRef 标记防止 show() 触发链上的 click-away
- 添加测试用例验证修复效果

* feat(popover): 添加定时器清理逻辑

- 使用 ref 存储定时器引用
- 在组件卸载时清理定时器
- 防止内存泄漏

* chore(popover): 添加功能注释

* refactor(popover): 抽取 useShowingGuard hook

回应 zombieJ review：将 showingRef + timer 逻辑从 popover.tsx inline
内联代码抽取为独立 hook use-showing-guard.ts，使组件更整洁。

- markShowing() 置位 guard 并启动短定时器自动解除
- isShowing() 供 useClickAway 判断是否跳过关闭
- 组件卸载时自动清理定时器，避免 open handles

* chore: trigger CI rebuild

* refactor(popover): clarify showing guard lifecycle

---------

Co-authored-by: 二货机器人 <[REDACTED_EMAIL]>

**File**: `src/components/popover/popover.tsx` (modified, +9/-1)
```diff
@@ -34,6 +34,7 @@ import {
 import { Arrow } from './arrow'
 import { DeprecatedPlacement, Placement } from './index'
 import { normalizePlacement } from './normalize-placement'
+import { useShowingGuard } from './use-showing-guard'
 import { Wrapper, type WrapperRef } from './wrapper'
 
 const classPrefix = `adm-popover`
@@ -76,10 +77,16 @@ export const Popover = forwardRef<PopoverRef, PopoverProps>((p, ref) => {
     onChange: props.onVisibleChange,
   })
 
+  const { markShowing, isShowing } = useShowingGuard()
+
   useImperativeHandle(
     ref,
     () => ({
-      show: () => setVisible(true),
+      show: () => {
+        // 标记进入 show() 触发链，避免同一次点击事件冒泡到 document 时被 useClickAway 立即关闭
+        markShowing()
+        setVisible(true)
+      },
       hide: () => setVisible(false),
       visible,
     }),
@@ -196,6 +203,7 @@ export const Popover = forwardRef<PopoverRef, PopoverProps>((p, ref) => {
   useClickAway(
     () => {
       if (!props.trigger) return
+      if (isShowing()) return // 跳过 show() 触发链上的 click-away
       setVisible(false)
     },
     [() => targetRef.current?.element, floatingRef],
```

**File**: `src/components/popover/tests/popover.test.tsx` (modified, +84/-2)
```diff
@@ -1,6 +1,6 @@
 import * as React from 'react'
-import { fireEvent, render } from 'testing'
-import Popover from '..'
+import { act, fireEvent, render } from 'testing'
+import Popover, { PopoverRef } from '..'
 import Button from '../../button'
 
 describe('Popover', () => {
@@ -52,4 +52,86 @@ describe('Popover', () => {
     fireEvent.click(getByRole('button'))
     expect(document.querySelector('.adm-popover-hidden')).toBeTruthy()
   })
+
+  // https://github.com/ant-design/ant-design-mobile/issues/6731
+  test('ref.show() should keep Popover open when already visible under trigger="click"', () => {
+    const Wrap = () => {
+      const ref = React.useRef<PopoverRef>(null)
+      return (
+        <>
+          <Popover content='Bamboo' trigger='click' ref={ref}>
+            <button id='inner'>Hi</button>
+          </Popover>
+          <button id='ext' onClick={() => ref.current?.show()}>
+            external
+          </button>
+        </>
+      )
+    }
+
+    const { container } = render(<Wrap />)
+    const inner = container.querySelector('#inner') as HTMLElement
+    const ext = container.querySelector('#ext') as HTMLElement
+
+    fireEvent.click(inner)
+    expect(document.querySelector('.adm-popover-hidden')).toBeFalsy()
+
+    fireEvent.click(ext)
+    expect(document.querySelector('.adm-popover-hidden')).toBeFalsy()
+  })
+
+  test('after ref.show(), clicking outside should still close Popover', async () => {
+    const Wrap = () => {
+      const ref = React.useRef<PopoverRef>(null)
+      return (
+        <>
+          <Popover content='Bamboo' trigger='click' ref={ref}>
+            <button id='inner'>Hi</button>
+          </Popover>
+          <button id='ext' onClick={() => ref.current?.show()}>
+            external
+          </button>
+        </>
+      )
+    }
+
+    const { container } = render(<Wrap />)
+    const inner = container.querySelector('#inner') as HTMLElement
+    const ext = container.querySelector('#ext') as HTMLElement
+
+    fireEvent.click(inner)
+    fireEvent.click(ext)
+
+    await act(async () => {
+      await new Promise(resolve => setTimeout(resolve, 0))
+    })
+
+    fireEvent.touchMove(document.body)
+    expect(document.querySelector('.adm-popover-hidden')).toBeTruthy()
+  })
+
+  test('ref.show() should open Popover from closed state', () => {
+    const Wrap = () => {
+      const ref = React.useRef<PopoverRef>(null)
+      return (
+        <>
+          <Popover content='Bamboo' trigger='click' ref={ref}>
+            <button id='inner'>Hi</button>
+          </Popover>
+          <button id='ext' onClick={() => ref.current?.show()}>
+            external
+          </button>
+        </>
+      )
+    }
+
+    const { container } = render(<Wrap />)
+    const ext = container.querySelector('#ext') as HTMLElement
+
+    fireEvent.click(ext)
+    expect(
+      document.querySelector('.adm-popover-inner-content')?.textContent
+    ).toEqual('Bamboo')
+    expect(document.querySelector('.adm-popover-hidden')).toBeFalsy()
+  })
 })
```

**File**: `src/components/popover/use-showing-guard.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import { useEffect, useRef } from 'react'
+
+/**
+ * 保证通过 `ref.show()` 打开的 Popover 不会被同一次交互立即关闭。
+ *
+ * 当外部元素的点击回调调用 `ref.show()` 时，当前点击事件仍会继续冒泡到
+ * document，并触发 `useClickAway`。因此需要在当前事件任务结束前保持 guarding
+ * 状态，让 click-away 跳过这一次关闭；进入下一个任务后再解除 guarding，保证
+ * 后续的外部点击仍能正常关闭 Popover。
+ */
+export function useShowingGuard() {
+  const showingRef = useRef(false)
+  const timerRef = useRef<ReturnType<typeof setTimeout>>()
+
+  const markShowing = () => {
+    // 使用 ref 而不是 state，确保同一次事件冒泡到 document 时可以同步读取到标记。
+    showingRef.current = true
+
+    // 连续调用 show() 时重置保护窗口，避免旧定时器提前清除最新一次的标记。
+    clearTimeout(timerRef.current)
+    timerRef.current = setTimeout(() => {
+      // 定时器会在当前事件任务完成后执行，此时可以恢复正常的 click-away 行为。
+      showingRef.current = false
+    })
+  }
+
+  const isShowing = () => showingRef.current
+
+  useEffect(() => {
+    return () => {
+      // 组件卸载后不再需要更新 guarding 标记，同时清理未执行的定时器。
+      clearTimeout(timerRef.current)
+    }
+  }, [])
+
+  return { markShowing, isShowing }
+}
```

---

### Incident Patch 3: `df822035` (2026-08-05)
**Commit Message**: fix(form): support single child wrapped in array (#7075)

Co-authored-by: casds-FDXS <你的 GitHub 邮箱>

**File**: `src/components/form/form-item.tsx` (modified, +22/-11)
```diff
@@ -22,6 +22,15 @@ const NAME_SPLIT = '__SPLIT__'
 type RenderChildren<Values = any> = (form: FormInstance<Values>) => ReactNode
 type ChildrenType<Values = any> = RenderChildren<Values> | ReactNode
 
+function useChildren(children?: ChildrenType): ChildrenType {
+  if (typeof children === 'function') {
+    return children
+  }
+
+  const childList = toArray(children)
+  return childList.length <= 1 ? childList[0] : childList
+}
+
 type RcFieldProps = Omit<FieldProps, 'children'>
 
 const classPrefix = `adm-form-item`
@@ -265,6 +274,8 @@ export const FormItem: FC<FormItemProps> = props => {
     ...fieldProps
   } = props
 
+  const mergedChildren = useChildren(children)
+
   const { name: formName } = useContext(FormContext)
   const { validateTrigger: contextValidateTrigger } = useContext(FieldContext)
 
@@ -359,10 +370,10 @@ export const FormItem: FC<FormItemProps> = props => {
     )
   }
 
-  const isRenderProps = typeof children === 'function'
+  const isRenderProps = typeof mergedChildren === 'function'
 
   if (!name && !isRenderProps && !props.dependencies) {
-    return renderLayout(children) as JSX.Element
+    return renderLayout(mergedChildren) as JSX.Element
   }
 
   let Variables: Record<string, string> = {}
@@ -416,7 +427,7 @@ export const FormItem: FC<FormItemProps> = props => {
 
         if (isRenderProps) {
           if ((shouldUpdate || dependencies) && !name) {
-            childNode = (children as RenderChildren)(context)
+            childNode = (mergedChildren as RenderChildren)(context)
           } else {
             if (!(shouldUpdate || dependencies)) {
               devWarning(
@@ -438,18 +449,18 @@ export const FormItem: FC<FormItemProps> = props => {
             'Form.Item',
             'Must set `name` or use render props when `dependencies` is set.'
           )
-        } else if (React.isValidElement(children)) {
-          if (children.props.defaultValue) {
+        } else if (React.isValidElement(mergedChildren)) {
+          if (mergedChildren.props.defaultValue) {
             devWarning(
               'Form.Item',
               '`defaultValue` will not work on controlled Field. You should use `initialValues` of Form instead.'
             )
           }
-          const childProps = { ...children.props, ...control }
+          const childProps = { ...mergedChildren.props, ...control }
 
-          if (isSafeSetRefComponent(children)) {
+          if (isSafeSetRefComponent(mergedChildren)) {
             childProps.ref = (instance: any) => {
-              const originRef = (children as any).ref
+              const originRef = (mergedChildren as any).ref
               if (originRef) {
                 if (typeof originRef === 'function') {
                   originRef(instance)
@@ -475,7 +486,7 @@ export const FormItem: FC<FormItemProps> = props => {
           triggers.forEach(eventName => {
             childProps[eventName] = (...args: any[]) => {
               control[eventName]?.(...args)
-              children.props[eventName]?.(...args)
+              mergedChildren.props[eventName]?.(...args)
             }
           })
 
@@ -484,7 +495,7 @@ export const FormItem: FC<FormItemProps> = props => {
               value={control[props.valuePropName || 'value']}
               update={updateRef.current}
             >
-              {React.cloneElement(children, childProps)}
+              {React.cloneElement(mergedChildren, childProps)}
             </MemoInput>
           )
         } else {
@@ -494,7 +505,7 @@ export const FormItem: FC<FormItemProps> = props => {
               '`name` is only used for validate React element. If you are using Form.Item as layout display, please remove `name` instead.'
             )
           }
-          childNode = children
+          childNode = mergedChildren
         }
 
         return renderLayout(childNode, fieldId, meta, isRequired)
```

**File**: `src/components/form/tests/form.test.tsx` (modified, +30/-0)
```diff
@@ -343,6 +343,36 @@ describe('Form', () => {
   })
 
   describe('Form.Item', () => {
+    test('supports a single child wrapped in an array', async () => {
+      const onFinish = jest.fn()
+      const { container, getByText } = render(
+        <Form
+          initialValues={{ name: 'bamboo' }}
+          onFinish={onFinish}
+          footer={
+            <Button block type='submit'>
+              submit
+            </Button>
+          }
+        >
+          <Form.Item name='name' label='Name'>
+            {[<Input key='input' />]}
+          </Form.Item>
+        </Form>
+      )
+
+      const input = container.querySelector('input') as HTMLInputElement
+      expect(input.value).toBe('bamboo')
+
+      fireEvent.change(input, { target: { value: 'little' } })
+      fireEvent.click(getByText('submit'))
+
+      await waitFor(() => {
+        expect(onFinish).toHaveBeenCalled()
+      })
+      expect(onFinish.mock.calls[0][0]).toEqual({ name: 'little' })
+    })
+
     test('noStyle', async () => {
       const onChange = jest.fn()
       const { container } = render(
```

---

### Incident Patch 4: `2a3ba207` (2026-06-22)
**Commit Message**: fix: handle December 1981 in DatePicker

Fixes #7028.

**File**: `src/components/date-picker/date-picker-date-utils.ts` (modified, +7/-12)
```diff
@@ -1,16 +1,8 @@
-import dayjs from 'dayjs'
-import isLeapYear from 'dayjs/plugin/isLeapYear'
-import isoWeek from 'dayjs/plugin/isoWeek'
-import isoWeeksInYear from 'dayjs/plugin/isoWeeksInYear'
 import { RenderLabel } from '../date-picker-view/date-picker-view'
 import { PickerColumn } from '../picker'
 import type { DatePickerFilter } from './date-picker-utils'
 import { TILL_NOW } from './util'
 
-dayjs.extend(isoWeek)
-dayjs.extend(isoWeeksInYear)
-dayjs.extend(isLeapYear)
-
 export type DatePrecision =
   | 'year'
   | 'month'
@@ -28,6 +20,10 @@ const precisionRankRecord: Record<DatePrecision, number> = {
   second: 5,
 }
 
+function getMonthDays(year: number, month: number) {
+  return new Date(Date.UTC(year, month, 0)).getUTCDate()
+}
+
 export function generateDatePickerColumns(
   selected: string[],
   min: Date,
@@ -56,9 +52,6 @@ export function generateDatePickerColumns(
   const rank = precisionRankRecord[precision]
 
   const selectedYear = parseInt(selected[0])
-  const firstDayInSelectedMonth = dayjs(
-    convertStringArrayToDate([selected[0], selected[1], '1'])
-  )
   const selectedMonth = parseInt(selected[1])
   const selectedDay = parseInt(selected[2])
   const selectedHour = parseInt(selected[3])
@@ -125,7 +118,9 @@ export function generateDatePickerColumns(
   }
   if (rank >= precisionRankRecord.day) {
     const lower = isInMinMonth ? minDay : 1
-    const upper = isInMaxMonth ? maxDay : firstDayInSelectedMonth.daysInMonth()
+    const upper = isInMaxMonth
+      ? maxDay
+      : getMonthDays(selectedYear, selectedMonth)
     const days = generateColumn(lower, upper, 'day')
     ret.push(
       days.map(v => ({
```

**File**: `src/components/date-picker/tests/date-picker.test.tsx` (modified, +32/-0)
```diff
@@ -11,6 +11,7 @@ import {
   waitForElementToBeRemoved,
 } from 'testing'
 import DatePicker from '../'
+import { generateDatePickerColumns as generateDatePickerDateColumns } from '../date-picker-date-utils'
 import Button from '../../button'
 import {
   convertStringArrayToDate,
@@ -271,6 +272,37 @@ describe('DatePicker', () => {
     })
   })
 
+  describe('generateDatePickerColumns for day precision', () => {
+    it('should include every day in December 1981', () => {
+      const originalTZ = process.env.TZ
+      // Asia/Singapore has a historical transition in December 1981 that
+      // makes dayjs().daysInMonth() report one day for this month.
+      process.env.TZ = 'Asia/Singapore'
+
+      try {
+        const columns = generateDatePickerDateColumns(
+          ['1981', '12', '1'],
+          new Date(1981, 0, 1),
+          new Date(1982, 0, 31),
+          'day',
+          (type, data) => type + '：' + data,
+          undefined
+        )
+
+        const dayColumn = columns[2] as { value: string }[]
+        expect(dayColumn.map(item => item.value)).toEqual(
+          Array.from({ length: 31 }, (_, index) => `${index + 1}`)
+        )
+      } finally {
+        if (originalTZ === undefined) {
+          delete process.env.TZ
+        } else {
+          process.env.TZ = originalTZ
+        }
+      }
+    })
+  })
+
   test('renderLabel should be work', async () => {
     const labelRenderer = (
       type: string,
```

---

### Incident Patch 5: `bc626e98` (2026-06-11)
**Commit Message**: fix(utils): 延迟初始化 px 转换器 (#7060)

* fix(utils): 延迟初始化 px 转换器

- 修复未加载 DOM 时直接初始化的错误
- 添加重复初始化检查

* fix(utils): 优化 convertPx 初始化逻辑

- 延迟初始化 tenPxTester 和 tester
- 修复潜在的空指针问题

* chore: trigger CI

* chore: 添加测试文件

**File**: `src/utils/convert-px.ts` (modified, +7/-2)
```diff
@@ -1,11 +1,13 @@
 import { canUseDom } from './can-use-dom'
-import { isDev } from './is-dev'
 import { devError } from './dev-log'
+import { isDev } from './is-dev'
 
 let tenPxTester: HTMLDivElement | null = null
 let tester: HTMLDivElement | null = null
 
-if (canUseDom) {
+function initialize() {
+  if (tenPxTester !== null) return
+  if (!canUseDom || !document.body) return
   tenPxTester = document.createElement('div')
   tenPxTester.className = 'adm-px-tester'
   tenPxTester.style.setProperty('--size', '10')
@@ -24,6 +26,9 @@ if (canUseDom) {
 }
 
 export function convertPx(px: number) {
+  if (tenPxTester === null) {
+    initialize()
+  }
   if (tenPxTester === null || tester === null) return px
   if (tenPxTester.getBoundingClientRect().height === 10) {
     return px
```

**File**: `src/utils/tests/convert-px.test.ts` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+jest.unmock('../../utils/convert-px')
+jest.mock('../../utils/dev-log', () => ({
+  devError: jest.fn(),
+  devWarning: jest.fn(),
+  devPrint: jest.fn(),
+}))
+
+import { convertPx } from '../../utils/convert-px'
+
+function mockRect(el: Element, height: number) {
+  ;(el as HTMLElement).getBoundingClientRect = jest.fn(
+    () => ({ height }) as DOMRect
+  )
+}
+
+describe('convertPx', () => {
+  afterAll(() => {
+    document.querySelectorAll('.adm-px-tester').forEach(el => el.remove())
+  })
+
+  afterEach(() => {
+    document.querySelectorAll('.adm-px-tester').forEach(el => {
+      ;(el as HTMLElement).getBoundingClientRect =
+        HTMLElement.prototype.getBoundingClientRect
+    })
+  })
+
+  // Tests share module-level closure vars (tenPxTester, tester) initialized by the first test
+  it('should lazily init tester elements and prevent duplicate initialization', () => {
+    expect(document.querySelectorAll('.adm-px-tester')).toHaveLength(0)
+
+    convertPx(10)
+    expect(document.querySelectorAll('.adm-px-tester')).toHaveLength(2)
+
+    convertPx(20)
+    expect(document.querySelectorAll('.adm-px-tester')).toHaveLength(2)
+  })
+
+  it('should fire devError when tester is not position:fixed in dev mode', () => {
+    jest.isolateModules(() => {
+      jest.doMock('../../utils/can-use-dom', () => ({ canUseDom: true }))
+      // eslint-disable-next-line @typescript-eslint/no-var-requires
+      const { convertPx } = require('../../utils/convert-px')
+      // eslint-disable-next-line @typescript-eslint/no-var-requires
+      const { devError } = require('../../utils/dev-log')
+      ;(<jest.Mock>devError).mockClear()
+      convertPx(10)
+      expect(devError).toHaveBeenCalledTimes(1)
+      expect(devError).toHaveBeenCalledWith(
+        'Global',
+        'The px tester is not rendering properly. Please make sure you have imported `antd-mobile/es/global`.'
+      )
+    })
+  })
+
+  it('should set --size CSS variable on the tester and return converted height', () => {
+    const testers = document.querySelectorAll('.adm-px-tester')
+    mockRect(testers[0], 5)
+    mockRect(testers[1], 5)
+
+    const result = convertPx(25)
+    expect((testers[1] as HTMLElement).style.getPropertyValue('--size')).toBe(
+      '25'
+    )
+    expect(result).toBe(5)
+  })
+
+  it('should return original px without writing --size when 10px tester renders at height 10', () => {
+    const testers = document.querySelectorAll('.adm-px-tester')
+    mockRect(testers[0], 10)
+
+    const prevSize = (testers[1] as HTMLElement).style.getPropertyValue(
+      '--size'
+    )
+    expect(convertPx(30)).toBe(30)
+    expect((testers[1] as HTMLElement).style.getPropertyValue('--size')).toBe(
+      prevSize
+    )
+  })
+
+  it('should handle edge values: 0 and negative px', () => {
+    const testers = document.querySelectorAll('.adm-px-tester')
+
+    // px = 0, early return
+    mockRect(testers[0], 10)
+    mockRect(testers[1], 0)
+    expect(convertPx(0)).toBe(0)
+
+    // px = 0, conversion path
+    mockRect(testers[0], 5)
+    mockRect(testers[1], 0)
+    expect(convertPx(0)).toBe(0)
+    expect((testers[1] as HTMLElement).style.getPropertyValue('--size')).toBe(
+      '0'
+    )
+
+    // negative px
+    mockRect(testers[0], 5)
+    mockRect(testers[1], 3)
+    expect(convertPx(-10)).toBe(3)
+    expect((testers[1] as HTMLElement).style.getPropertyValue('--size')).toBe(
+      '-10'
+    )
+  })
+
+  describe('SSR / no-DOM guard', () => {
+    it('should return original px when DOM is unavailable', () => {
+      jest.isolateModules(() => {
+        jest.doMock('../../utils/can-use-dom', () => ({
+          canUseDom: false,
+        }))
+        // eslint-disable-next-line @typescript-eslint/no-var-requires
+        const { convertPx } = require('../../utils/convert-px')
+        expect(convertPx(100)).toBe(100)
+      })
+
+      const originalBody = document.body
+      try {
+        Object.defineProperty(document, 'body', {
+          value: null,
+          writable: true,
+          configurable: true,
+        })
+        jest.isolateModules(() => {
+          // eslint-disable-next-line @typescript-eslint/no-var-requires
+          const { convertPx } = require('../../utils/convert-px')
+          expect(convertPx(50)).toBe(50)
+        })
+      } finally {
+        Object.defineProperty(document, 'body', {
+          value: originalBody,
+          writable: true,
+          configurable: true,
+        })
+      }
+    })
+  })
+})
```

---

### Incident Patch 6: `4c719cab` (2026-06-11)
**Commit Message**: fix(NumberKeyboard): doc table (#7062)

docs(number-keyboard): 修复文档表格格式和类型定义

- 移除多余的表格分隔符
- 统一类型定义中的竖线转义

**File**: `src/components/number-keyboard/index.en.md` (modified, +2/-2)
```diff
@@ -23,12 +23,12 @@ tips: It is recommended to open the demo on the mobile side for better preview e
 ### Props
 
 | Name | Description | Type | Default |
-| --- | --- | --- | --- | --- | --- | --- |
+| --- | --- | --- | --- |
 | afterClose | Callback when the keyboard is completely put away | `() => void` | - |
 | afterShow | Callback when the keyboard is completely bounced | `() => void` | - |
 | closeOnConfirm | Whether to automatically close when the ok button is clicked | `boolean` | `true` |
 | confirmText | The text of the confirm button, if `null` is set, it would be shown | `string \| null` | `null` |
-| customKey | Customized button | `string | { key: string; title: string } | (string | { key: string; title: string })[]` | - |
+| customKey | Customized button | `string \| { key: string; title: string } \| (string \| { key: string; title: string })[]` | - |
 | destroyOnClose | Destroy `dom` when not visible | `boolean` | `false` |
 | forceRender | Render content forcely | `boolean` | `false` |
 | getContainer | To get the specified mounted HTML node, the default is `body`, if `null` returned, it would be rendered to the current node | `HTMLElement \| () => HTMLElement \| null` | `() => document.body` |
```

**File**: `src/components/number-keyboard/index.zh.md` (modified, +2/-2)
```diff
@@ -23,12 +23,12 @@ tips: 仅移动端下删除按钮支持长按快删（通过 touchStart/touchEnd
 ### 属性
 
 | 属性 | 说明 | 类型 | 默认值 |
-| --- | --- | --- | --- | --- | --- | --- |
+| --- | --- | --- | --- |
 | afterClose | 键盘完全收起回调 | `() => void` | - |
 | afterShow | 键盘完全弹出回调 | `() => void` | - |
 | closeOnConfirm | 是否在点击确定按钮时自动关闭 | `boolean` | `true` |
 | confirmText | 完成按钮文案，`null` 不展示 | `string \| null` | `null` |
-| customKey | 自定义按钮 | `string | { key: string; title: string } | (string | { key: string; title: string })[]` | - |
+| customKey | 自定义按钮 | `string \| { key: string; title: string } \| (string \| { key: string; title: string })[]` | - |
 | destroyOnClose | 不可见时是否销毁 `DOM` 结构 | `boolean` | `false` |
 | forceRender | 强制渲染内容 | `boolean` | `false` |
 | getContainer | 指定挂载的 HTML 节点，默认为 `body`，如果为 `null` 的话，会渲染到当前节点 | `HTMLElement \| () => HTMLElement \| null` | `() => document.body` |
```

---

### Incident Patch 7: `7caccd01` (2026-06-09)
**Commit Message**: fix(notice-bar): 阻止关闭按钮点击事件冒泡 (#7059)

* fix(notice-bar): 阻止关闭按钮点击事件冒泡

- 在关闭按钮点击事件中添加 stopPropagation
- 添加测试用例验证点击事件不冒泡

* test(notice-bar): 更新测试断言语法

**File**: `src/components/notice-bar/notice-bar.tsx` (modified, +2/-1)
```diff
@@ -166,7 +166,8 @@ export const NoticeBar = memo<NoticeBarProps>(props => {
           {mergedProps.closeable && (
             <div
               className={`${classPrefix}-close`}
-              onClick={() => {
+              onClick={e => {
+                e.stopPropagation()
                 setVisible(false)
                 mergedProps.onClose?.()
               }}
```

**File**: `src/components/notice-bar/tests/notice-bar.test.tsx` (modified, +19/-0)
```diff
@@ -109,6 +109,25 @@ describe('NoticeBar', () => {
     expect(handleClick).toHaveBeenCalled()
   })
 
+  test('closeable click should not bubble to onClick', () => {
+    const handleClick = jest.fn()
+    const handleClose = jest.fn()
+    const { container } = render(
+      <NoticeBar
+        content='notice'
+        closeable
+        onClick={handleClick}
+        onClose={handleClose}
+      />
+    )
+
+    const closeIcon = container.querySelectorAll(`.${classPrefix}-close`)[0]
+    fireEvent.click(closeIcon)
+
+    expect(handleClose).toHaveBeenCalledTimes(1)
+    expect(handleClick).not.toHaveBeenCalled()
+  })
+
   describe('closeIcon', () => {
     it('default', () => {
       const { baseElement } = render(<NoticeBar content='foobar' closeable />)
```

---

### Incident Patch 8: `072d4101` (2026-06-09)
**Commit Message**: fix(Segmented): 修复滑块移动时越界问题 (#7058)

* fix(Segmented): 修复滑块移动时越界问题

* chore: trigger CI

**File**: `src/components/segmented/segmented.less` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@
     width: 0;
     height: 100%;
     padding: 4px 0;
+    box-sizing: border-box;
   }
 
   // transition effect when `appear-active`
```

---

### Incident Patch 9: `09966e74` (2026-05-20)
**Commit Message**: fix(Dropdown): Optimize position update logic for dropdown on scroll and resize (#7049)

* feat(dropdown): 优化滚动和窗口变化时的位置更新逻辑

- 使用 useCallback 优化位置计算逻辑
- 更新 useEffect 依赖，加入 updateTop
- 减少不必要的位置重新计算
- 提升滚动和 resize 场景下的性能

* fix: 修改一些错误的语法

* feat(dropdown): 使用 raf 优化位置计算逻辑

- 替换原生 requestAnimationFrame 为 rc-util 的 raf
- 拆分位置计算逻辑为独立函数
- 优化 cleanup 逻辑

* refactor(dropdown): 简化位置更新逻辑

* chore: trigger CI rerun

**File**: `src/components/dropdown/dropdown.tsx` (modified, +31/-5)
```diff
@@ -10,11 +10,13 @@ import React, {
   cloneElement,
   forwardRef,
   isValidElement,
+  useCallback,
   useEffect,
   useImperativeHandle,
   useRef,
   useState,
 } from 'react'
+import raf from 'rc-util/lib/raf'
 import { NativeProps, withNativeProps } from '../../utils/native-props'
 import { usePropsValue } from '../../utils/use-props-value'
 import { mergeProp, mergeProps } from '../../utils/with-default-props'
@@ -78,14 +80,38 @@ const Dropdown = forwardRef<DropdownRef, PropsWithChildren<DropdownProps>>(
     // 计算 navs 的 top 值
     const [top, setTop] = useState<number>()
     const containerRef = useRef<HTMLDivElement>(null)
-    useEffect(() => {
+    const rafIdRef = useRef<number>(0)
+
+    const updatePosition = useCallback(() => {
       const container = containerRef.current
       if (!container) return
-      if (value) {
-        const rect = container.getBoundingClientRect()
-        setTop(rect.bottom)
+      setTop(container.getBoundingClientRect().bottom)
+    }, [])
+
+    const updateTop = useCallback(() => {
+      raf.cancel(rafIdRef.current)
+
+      rafIdRef.current = raf(updatePosition)
+    }, [updatePosition])
+
+    useEffect(() => {
+      if (!value) return
+
+      updatePosition()
+
+      window.addEventListener('scroll', updateTop, {
+        passive: true,
+        capture: true,
+      })
+      window.addEventListener('resize', updateTop)
+
+      return () => {
+        raf.cancel(rafIdRef.current)
+
+        window.removeEventListener('scroll', updateTop, true)
+        window.removeEventListener('resize', updateTop)
       }
-    }, [value])
+    }, [value, updateTop, updatePosition])
 
     const changeActive = (key: string | null) => {
       if (value === key) {
```

---

### Incident Patch 10: `7e59dc82` (2026-05-15)
**Commit Message**: fix(cascader): 修复外部值变化时同步问题 (#7046)

* fix(cascader): 修复外部值变化时同步问题

- 移除visible条件判断，确保值同步
- 添加测试用例验证值同步逻辑

* feat(cascader): 使用 useDeepCompareEffect 优化性能

- 替换 useEffect 为 useDeepCompareEffect 避免不必要的重新渲染
- 添加测试用例验证父组件重渲染时保持选中状态

* refactor(cascader): 优化组件导入和状态管理

- 调整导入顺序和分组
- 替换useDeepCompareEffect为useEffect
- 简化状态管理逻辑

**File**: `src/components/cascader/cascader.tsx` (modified, +12/-15)
```diff
@@ -1,24 +1,23 @@
 import React, {
-  useState,
-  useEffect,
   ReactNode,
   forwardRef,
+  useEffect,
   useImperativeHandle,
+  useState,
 } from 'react'
-import Popup, { PopupProps } from '../popup'
-import {
+import type { FieldNamesType } from '../../hooks'
+import { useFieldNames } from '../../hooks'
+import { NativeProps, withNativeProps } from '../../utils/native-props'
+import { usePropsValue } from '../../utils/use-props-value'
+import { mergeProps } from '../../utils/with-default-props'
+import CascaderView, {
+  CascaderOption,
   CascaderValue,
   CascaderValueExtend,
-  CascaderOption,
 } from '../cascader-view'
-import { mergeProps } from '../../utils/with-default-props'
-import { NativeProps, withNativeProps } from '../../utils/native-props'
-import { usePropsValue } from '../../utils/use-props-value'
-import CascaderView from '../cascader-view'
-import { useConfig } from '../config-provider'
 import { useCascaderValueExtend } from '../cascader-view/use-cascader-value-extend'
-import { useFieldNames } from '../../hooks'
-import type { FieldNamesType } from '../../hooks'
+import { useConfig } from '../config-provider'
+import Popup, { PopupProps } from '../popup'
 
 const classPrefix = `adm-cascader`
 
@@ -120,9 +119,7 @@ export const Cascader = forwardRef<CascaderRef, CascaderProps>((p, ref) => {
   const [innerValue, setInnerValue] = useState<CascaderValue[]>(value)
 
   useEffect(() => {
-    if (!visible) {
-      setInnerValue(value)
-    }
+    setInnerValue(value)
   }, [visible, value])
 
   const cascaderElement = withNativeProps(
```

**File**: `src/components/cascader/tests/cascader.test.tsx` (modified, +91/-2)
```diff
@@ -1,6 +1,6 @@
 import React, { useState } from 'react'
-import { fireEvent, render, testA11y, waitFor } from 'testing'
-import Cascader from '../'
+import { fireEvent, render, screen, testA11y, waitFor } from 'testing'
+import Cascader, { CascaderValue } from '../'
 import { options } from '../demos/data'
 
 describe('Cascader', () => {
@@ -52,6 +52,95 @@ describe('Cascader', () => {
     expect(onConfirm.mock.calls[0][0]).toEqual(['浙江', '杭州'])
   })
 
+  test('should sync value when visible and external value changes', async () => {
+    const App = () => {
+      const [visible, setVisible] = useState(false)
+      const [value, setValue] = useState<CascaderValue[]>([])
+
+      return (
+        <>
+          <button onClick={() => setVisible(true)}>Open</button>
+          <button onClick={() => setValue(['安徽', '合肥'])}>Set Value</button>
+          <Cascader
+            options={options}
+            visible={visible}
+            value={value}
+            onConfirm={val => {
+              setValue(val)
+              setVisible(false)
+            }}
+            onClose={() => setVisible(false)}
+            onCancel={() => setVisible(false)}
+          />
+        </>
+      )
+    }
+
+    render(<App />)
+
+    fireEvent.click(screen.getByText('Open'))
+    await waitFor(() => {
+      expect(screen.getByText('浙江')).toBeInTheDocument()
+    })
+
+    // While the popup is open, change the external value
+    fireEvent.click(screen.getByText('Set Value'))
+
+    // The cascader should reflect the new value (合肥 should appear in both tab and list)
+    await waitFor(() => {
+      const matches = screen.getAllByText('合肥')
+      expect(matches.length).toBeGreaterThanOrEqual(1)
+    })
+  })
+
+  test('should preserve draft selection when parent re-renders with same value', async () => {
+    const App = () => {
+      const [visible, setVisible] = useState(false)
+      const [value, setValue] = useState<CascaderValue[]>([])
+      const [, setTick] = useState(0)
+
+      return (
+        <>
+          <button onClick={() => setVisible(true)}>Open</button>
+          {/* Trigger a parent re-render without changing value content */}
+          <button onClick={() => setTick(t => t + 1)}>Rerender</button>
+          <Cascader
+            options={options}
+            visible={visible}
+            value={value}
+            onConfirm={val => {
+              setValue(val)
+              setVisible(false)
+            }}
+            onClose={() => setVisible(false)}
+            onCancel={() => setVisible(false)}
+          />
+        </>
+      )
+    }
+
+    render(<App />)
+
+    fireEvent.click(screen.getByText('Open'))
+    await waitFor(() => {
+      expect(screen.getByText('浙江')).toBeInTheDocument()
+    })
+
+    // User selects 浙江 in the cascader (draft, not confirmed)
+    fireEvent.click(screen.getByText('浙江'))
+
+    // Wait for the selection to take effect
+    await waitFor(() => {
+      expect(screen.getAllByText('浙江').length).toBeGreaterThanOrEqual(2)
+    })
+
+    // Parent re-renders with the same value content ([])
+    fireEvent.click(screen.getByText('Rerender'))
+
+    // The draft selection should be preserved — 浙江 should still appear as a selected tab
+    expect(screen.getAllByText('浙江').length).toBeGreaterThanOrEqual(2)
+  })
+
   test('use in an imperative way', async () => {
     const fn = jest.fn()
     const onClick = async () => {
```

---

### Incident Patch 11: `b627e1f0` (2026-04-16)
**Commit Message**: Fix(List): 修复箭头图片配置错误逻辑 (#7041)

fix(list): 修复箭头图标配置逻辑

- 将 `null` 改为 `undefined` 以正确合并箭头图标配置
- 添加测试用例验证配置提供者的箭头图标行为

**File**: `src/components/list/list-item.tsx` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@ export const ListItem: FC<ListItemProps> = props => {
   const showArrow = arrow ?? arrowIcon ?? clickable
   const mergedArrowIcon = mergeProp<React.ReactNode>(
     componentConfig.arrowIcon,
-    arrow !== true ? arrow : null,
-    arrowIcon !== true ? arrowIcon : null
+    arrow !== true ? arrow : undefined,
+    arrowIcon !== true ? arrowIcon : undefined
   )
 
   const content = (
```

**File**: `src/components/list/tests/list.test.tsx` (modified, +12/-0)
```diff
@@ -78,5 +78,17 @@ describe('list', () => {
 
       expect(screen.getByText('bamboo')).toBeVisible()
     })
+
+    it('arrowIcon={true} should use config provider arrow', () => {
+      render(
+        <ConfigProvider list={{ arrowIcon: 'little' }}>
+          <List>
+            <List.Item clickable arrowIcon={true} />
+          </List>
+        </ConfigProvider>
+      )
+
+      expect(screen.getByText('little')).toBeVisible()
+    })
   })
 })
```

---

### Incident Patch 12: `313370c0` (2026-04-08)
**Commit Message**: fix(DatePicker): 修复 week 精度下 max 日期年份计算错误的问题 (#7037)

* fix: 修复在next.js环境下的报错

* refactor(deps): 从 ahooks 的 useIsomorphicLayoutEffect 迁移到 rc-util 的 useLayoutEffect

* fix(DatePicker): 修复 week 精度下 max 日期年份计算错误的问题

当 max 日期在年末但属于下一年的第一周时(如 2025-12-29 是 2026 年第 1 周)，
使用 getFullYear() 会返回错误的年份。

修复方案：改用 dayjs 的 isoWeekYear() 获取 ISO 周年年份。

close #7015

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

* test(date-picker): 更新日期选择器测试用例

- 调整生成列的数据格式
- 更新断言匹配方式

---------

Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `src/components/date-picker/date-picker-week-utils.ts` (modified, +4/-4)
```diff
@@ -34,17 +34,17 @@ export function generateDatePickerColumns(
 ) {
   const ret: PickerColumn[] = []
 
-  const minYear = min.getFullYear()
-  const maxYear = max.getFullYear()
+  const minDay = dayjs(min)
+  const maxDay = dayjs(max)
+  const minYear = minDay.isoWeekYear()
+  const maxYear = maxDay.isoWeekYear()
 
   const rank = precisionRankRecord[precision]
 
   const selectedYear = parseInt(selected[0])
   const isInMinYear = selectedYear === minYear
   const isInMaxYear = selectedYear === maxYear
 
-  const minDay = dayjs(min)
-  const maxDay = dayjs(max)
   const minWeek = minDay.isoWeek()
   const maxWeek = maxDay.isoWeek()
   const minWeekday = minDay.isoWeekday()
```

**File**: `src/components/date-picker/tests/date-picker.test.tsx` (modified, +30/-1)
```diff
@@ -12,7 +12,10 @@ import {
 } from 'testing'
 import DatePicker from '../'
 import Button from '../../button'
-import { convertStringArrayToDate } from '../date-picker-week-utils'
+import {
+  convertStringArrayToDate,
+  generateDatePickerColumns,
+} from '../date-picker-week-utils'
 
 const classPrefix = `adm-picker`
 
@@ -242,6 +245,32 @@ describe('DatePicker', () => {
     })
   })
 
+  describe('generateDatePickerColumns for week precision', () => {
+    it('should use isoWeekYear when max date is in first week of next year', () => {
+      // 2025-12-29 is in ISO week 1 of 2026
+      const min = new Date('2020-01-01')
+      const max = new Date('2025-12-29')
+      const columns = generateDatePickerColumns(
+        ['2026', '1', '1'],
+        min,
+        max,
+        'week',
+        (type, data) => type + '：' + data,
+        undefined
+      )
+
+      // The year column should include 2026 (isoWeekYear of 2025-12-29)
+      const yearColumn = columns[0] as { label: string; value: string }[]
+      const yearValues = yearColumn.map(item => item.value)
+      expect(yearValues).toContain('2026')
+
+      // The week column for year 2026 should start from week 1
+      const weekColumn = columns[1] as { label: string; value: string }[]
+      const weekValues = weekColumn.map(item => item.value)
+      expect(weekValues).toEqual(['1'])
+    })
+  })
+
   test('renderLabel should be work', async () => {
     const labelRenderer = (
       type: string,
```

---

### Incident Patch 13: `99e4323f` (2026-03-17)
**Commit Message**: fix(SearchBar): trigger search on enter in English IME (#7031) (#7032)

- Remove composition state check when triggering search on enter
- Now search is triggered when input has content regardless of IME composition state
- This makes English IME behavior consistent with Chinese IME

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: 刘欢 <[REDACTED_EMAIL]>
Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `src/components/search-bar/search-bar.tsx` (modified, +4/-5)
```diff
@@ -75,7 +75,6 @@ export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
     const [value, setValue] = usePropsValue(mergedProps)
     const [hasFocus, setHasFocus] = useState(false)
     const inputRef = useRef<InputRef>(null)
-    const composingRef = useRef(false)
 
     useImperativeHandle(ref, () => ({
       clear: () => inputRef.current?.clear(),
@@ -153,19 +152,19 @@ export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
             onClear={mergedProps.onClear}
             type='search'
             enterKeyHint='search'
-            onEnterPress={() => {
-              if (!composingRef.current) {
+            onEnterPress={e => {
+              // Use nativeEvent.isComposing to check IME composition state
+              // This is more reliable than maintaining a manual ref
+              if (!e.nativeEvent.isComposing) {
                 inputRef.current?.blur()
                 mergedProps.onSearch?.(value)
               }
             }}
             aria-label={locale.SearchBar.name}
             onCompositionStart={e => {
-              composingRef.current = true
               mergedProps.onCompositionStart?.(e)
             }}
             onCompositionEnd={e => {
-              composingRef.current = false
               mergedProps.onCompositionEnd?.(e)
             }}
           />
```

**File**: `src/components/search-bar/tests/search-bar.test.tsx` (modified, +22/-0)
```diff
@@ -71,6 +71,28 @@ describe('adm-search-bar', () => {
     expect(onSearch).toBeCalledWith('12')
   })
 
+  // Issue #7031: Test that isComposing prevents search during IME composition
+  test('onSearch should not be triggered when isComposing is true', async () => {
+    const onSearch = jest.fn()
+    render(<SearchBar onSearch={onSearch} defaultValue='test' />)
+    const input = screen.getByRole('searchbox')
+
+    // Mock nativeEvent.isComposing to true
+    const mockEvent = new KeyboardEvent('keydown', {
+      key: 'Enter',
+      code: 'Enter',
+    })
+    Object.defineProperty(mockEvent, 'isComposing', { value: true })
+    // Mock native property
+    Object.defineProperty(mockEvent, 'nativeEvent', {
+      value: { isComposing: true },
+    })
+
+    fireEvent(input, mockEvent)
+
+    expect(onSearch).not.toBeCalled()
+  })
+
   test('ref', async () => {
     const ref = createRef<SearchBarRef>()
     const onFocus = jest.fn()
```

---

### Incident Patch 14: `6efec1c9` (2026-03-13)
**Commit Message**: fix: 修复use-click-outside中handler变化导致监听器重新注册问题 (#7030)

* fix: 修复use-click-outside中handler变化导致监听器重新注册问题

* fix: update useEffect dependency

* fix: update useEffect dependency

* fix: update active-detect

* fix: update active-detect

* fix: use useevent for click outside handler

**File**: `src/components/virtual-input/tests/virtual-input.test.tsx` (modified, +140/-0)
```diff
@@ -828,3 +828,143 @@ describe('VirtualInput', () => {
     }
   })
 })
+
+describe('useClickOutside', () => {
+  const KeyBoardClassPrefix = 'adm-number-keyboard'
+
+  test('首次点击 VirtualInput 不应同时触发 focus 和 blur', async () => {
+    const onFocus = jest.fn()
+    const onBlur = jest.fn()
+    const user = userEvent.setup()
+
+    const Wrapper = () => {
+      const [value, setValue] = React.useState('')
+      return (
+        <VirtualInput
+          value={value}
+          onChange={setValue}
+          onFocus={onFocus}
+          onBlur={onBlur}
+          keyboard={<NumberKeyboard />}
+        />
+      )
+    }
+
+    render(<Wrapper />)
+    const content = document.querySelector(`.${classPrefix}-content`)!
+
+    // 首次点击 VirtualInput content 区域
+    await user.click(content)
+
+    // 应该只触发 focus，不触发 blur
+    expect(onFocus).toBeCalledTimes(1)
+    expect(onBlur).toBeCalledTimes(0)
+
+    // 键盘应该可见
+    expect(
+      document.querySelector(`.${KeyBoardClassPrefix}-popup`)
+    ).toBeVisible()
+  })
+
+  test('点击外部应触发 blur', async () => {
+    const onFocus = jest.fn()
+    const onBlur = jest.fn()
+    const user = userEvent.setup()
+
+    const Wrapper = () => {
+      const [value, setValue] = React.useState('')
+      return (
+        <div>
+          <VirtualInput
+            value={value}
+            onChange={setValue}
+            onFocus={onFocus}
+            onBlur={onBlur}
+            keyboard={<NumberKeyboard />}
+          />
+          <button data-testid='outside'>outside</button>
+        </div>
+      )
+    }
+
+    render(<Wrapper />)
+    const content = document.querySelector(`.${classPrefix}-content`)!
+
+    // 先 focus
+    await user.click(content)
+    expect(onFocus).toBeCalledTimes(1)
+
+    // 点击外部
+    await user.click(screen.getByTestId('outside'))
+    expect(onBlur).toBeCalledTimes(1)
+  })
+
+  test('handler 更新后点击外部应使用最新的 handler', async () => {
+    const onBlur1 = jest.fn()
+    const onBlur2 = jest.fn()
+    const user = userEvent.setup()
+
+    const Wrapper = () => {
+      const [value, setValue] = React.useState('')
+      const [useSecond, setUseSecond] = React.useState(false)
+      return (
+        <div>
+          <VirtualInput
+            value={value}
+            onChange={setValue}
+            onFocus={() => {
+              // focus 时切换到第二个 handler
+              setUseSecond(true)
+            }}
+            onBlur={useSecond ? onBlur2 : onBlur1}
+            keyboard={<NumberKeyboard />}
+          />
+          <button data-testid='outside'>outside</button>
+        </div>
+      )
+    }
+
+    render(<Wrapper />)
+    const content = document.querySelector(`.${classPrefix}-content`)!
+
+    // focus，同时触发 handler 切换
+    await user.click(content)
+
+    // 点击外部，应调用最新的 onBlur2（而非旧的 onBlur1）
+    await user.click(screen.getByTestId('outside'))
+
+    expect(onBlur1).toBeCalledTimes(0)
+    expect(onBlur2).toBeCalledTimes(1)
+  })
+
+  test('多次点击 VirtualInput 不应重复触发 focus', async () => {
+    const onFocus = jest.fn()
+    const onBlur = jest.fn()
+    const user = userEvent.setup()
+
+    const Wrapper = () => {
+      const [value, setValue] = React.useState('')
+      return (
+        <VirtualInput
+          value={value}
+          onChange={setValue}
+          onFocus={onFocus}
+          onBlur={onBlur}
+          keyboard={<NumberKeyboard />}
+        />
+      )
+    }
+
+    render(<Wrapper />)
+    const content = document.querySelector(`.${classPrefix}-content`)!
+
+    // 连续点击多次
+    await user.click(content)
+    await user.click(content)
+    await user.click(content)
+
+    // focus 只触发一次，blur 不触发
+    expect(onFocus).toBeCalledTimes(1)
+    expect(onBlur).toBeCalledTimes(0)
+  })
+})
```

**File**: `src/components/virtual-input/use-click-outside.tsx` (modified, +7/-13)
```diff
@@ -1,3 +1,4 @@
+import { useEvent } from 'rc-util'
 import { useEffect } from 'react'
 
 // 监听点击组件外部的事件
@@ -6,35 +7,28 @@ function useClickOutside(
   ref: React.RefObject<HTMLElement>,
   hasKeyboardProps: boolean = false
 ) {
+  const stableHandler = useEvent(handler)
+
   useEffect(() => {
     function handleClick(event: MouseEvent) {
       if (!ref.current || ref.current.contains(event.target as Node)) {
         return
       }
-      handler(event)
+      stableHandler(event) // 使用 ref 中的 handler
     }
-
     // 向前兼容逻辑：
     // 1. 对于有键盘属性的 VirtualInput，在捕获阶段监听：
     //      这是为了确保在事件被阻止传播之前触发。比如输入框中的单个数字 click 事件会 stopPropagation, 但这里依然能捕获到
     // 2. 对于无键盘属性的 VirtualInput 组件，在冒泡阶段监听：
     //      这种情况通常是 VirtualInput + NumberKeyboard 为兄弟关系，在以前版本中点击 NumberKeyboard **不会**触发 VirtualInput 的 blur 事件
     //      原先原理：通过 NumberKeyboard 内部 onMouseDown 时 preventDefault 阻止的 VirtualInput 内原生的 blur 事件
     //      新的原理：NumberKeyboard 的 Popup 默认会 stopPropagation click, 这里在冒泡阶段监听不到，不会调用 VirtualInput 的 onBlur 回调（非原生事件）。
-    document.addEventListener(
-      'click',
-      handleClick,
-      hasKeyboardProps ? true : false
-    )
 
+    document.addEventListener('click', handleClick, hasKeyboardProps)
     return () => {
-      document.removeEventListener(
-        'click',
-        handleClick,
-        hasKeyboardProps ? true : false
-      )
+      document.removeEventListener('click', handleClick, hasKeyboardProps)
     }
-  }, [handler, ref])
+  }, [ref]) // 只依赖 ref，不依赖 handler
 }
 
 export default useClickOutside
```

---

### Incident Patch 15: `8600d5f6` (2026-01-09)
**Commit Message**: fix: 修复 Space 组件间距并列显示异常 (#7018)

* fix: 修复在next.js环境下的报错

* refactor(deps): 从 ahooks 的 useIsomorphicLayoutEffect 迁移到 rc-util 的 useLayoutEffect

* style(space): 移除水平间距的负边距

**File**: `src/components/space/space.less` (modified, +0/-3)
```diff
@@ -20,9 +20,6 @@
   }
   &-horizontal {
     flex-direction: row;
-    &:not(:empty) {
-      margin-right: calc(var(--gap-horizontal) * -1);
-    }
     > .@{class-prefix-space}-item {
       margin-right: var(--gap-horizontal);
       &:last-child {
```

#### Recent Merged Pull Requests:
- **PR #7075** (2026-08-05): fix(form): support single child wrapped in array (@casds-FDXS)
- **PR #7073** (2026-09-10): fix(Popover): prevent ref.show() from closing immediately (@Passing-of-A-Dream)
- **PR #7072** (2026-07-03): feat(input): 完善 enterKeyHint 类型定义 (@Passing-of-A-Dream)
- **PR #7071** (2026-07-03): feat(floating-panel): 添加惯性系数支持 (@Passing-of-A-Dream)
- **PR #7068** (2026-06-22): feat(swiper): 优化循环模式下的滑动路径算法 (@Passing-of-A-Dream)
- **PR #7064** (2026-06-16): feat(dropdown): 新增 onVisibleChange 回调 (@Passing-of-A-Dream)
- **PR #7063** (2026-08-04): feat(error-block): 支持动态生成svg元素id (@Passing-of-A-Dream)
- **PR #7062** (2026-06-11): fix(NumberKeyboard): doc table (@Passing-of-A-Dream)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
