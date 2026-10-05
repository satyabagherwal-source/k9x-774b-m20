# Forensic Learning Record (Deep Inspection): vuetifyjs/vuetify

> **Canonical Artifact**: `07_PROJECT_LEARNING/vuetifyjs-vuetify-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vuetifyjs/vuetify](https://github.com/vuetifyjs/vuetify))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:09:41.124Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vuetifyjs/vuetify`
- **Description**: 🐉 Vue Component Framework
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 41036 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/api-generator/src/utils.ts`
```
import { execSync } from 'node:child_process'
import stringifyObject from 'stringify-object'
import prettier from 'prettier'
import * as typescriptParser from 'prettier/plugins/typescript'
import type { Definition, DirectiveData } from './types.ts'

function parseFunctionParams (func: string) {
  const [, regular] = /function\s\((.*)\)\s\{.*/i.exec(func) || []
  const [, arrow] = /\((.*)\)\s=>\s\{.*/i.exec(func) || []
  const args = regular || arrow

  return args ? `(${args}) => {}` : undefined
}

function getPropType (type: any | any[]): string | string[] {
  if (Array.isArray(type)) {
    return type.flatMap(t => getPropType(t))
  }

  if (!type) return 'any'

  return type.name.toLowerCase()
}

function getPropDefault (definition: any, type: string | string[]) {
  const def = definition?.default

  if (typeof def === 'function' && type !== 'function') {
    return def.call({}, {})
  }

  if (typeof def === 'string') {
    return def ? `'${def}'` : def
  }

  if (type === 'function') {
    return parseFunctionParams(def)
  }

  if ((!definition || !('default' in definition)) && (
    type === 'boolean' ||
    (Array.isArray(type) && type.includes('boolean'))
  )) {
    return false
  }

  return def
}

type ComponentData = {
  description?: Record<string, string>
  props?: Record<string, Definition>
  slots?: Record<string, Definition>
  events?: Record<string, Definition>
  exposed?: Record<string, Definition>
}

export function addPropData (
  name: string,
  componentData: ComponentData,
  componentProps: any
) {
  const sources = new Set<string>()
  for (const [propName, propObj] of Object.entries(componentData.props ?? {})) {
    const instancePropObj = componentProps[propName]

    ;(propObj as any).default = instancePropObj?.default
    ;(propObj as any).source = instancePropObj?.source

    sources.add(instancePropObj?.source ?? name)
  }

  return [...sources.values()]
}

export function stringifyProps (props: any) {
  return Object.fromEntries(
    Object.entries<any>(props).map(([key, prop]) => {
      let def = typeof prop === 'object'
        ? getPropDefault(prop, getPropType(prop?.type))
        : getPropDefault(undefined, getPropType(prop))

      if (typeof def === 'object') {
        def = stringifyObject(def, {
          indent: '  ',
          inlineCharacterLimit: 60,
          filter (obj, property) {
            if (typeof obj === 'object' && !Array.isArray(obj) && obj != null && 'name' in obj && 'props' in obj && 'setup' in obj) {
              return property === 'name'
            }
            return true
          },
        })
      }

      return [key, {
        source: prop?.source,
        default: def,
      }]
    })
  )
}

const localeCache = new Map<string, object>()
async function loadLocale (componentName: string, locale: string): Promise<Record<string, string | Record<string, string>>> {
  const cacheKey = `${locale}/${componentName}`
  if (localeCache.has(cacheKey)) {
    return localeCache.get(cacheKey) as any
  }
  try {
    const data = await import(`../src/locale/${cacheKey}.json`, {
      with: { type: 'json' },
    })
    localeCache.set(cacheKey, data.default)
    return data.default
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`\x1b[35mMissing locale for ${cacheKey}\x1b[0m`)
      localeCache.set(cacheKey, {})
    } else {
      console.error('\x1b[31m', err.message, '\x1b[0m')
    }
    return {}
  }
}

const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim()

type MissingDescription = {
  name: string
  section: string
  key: string
  locale: string
  color?: keyof typeof ansiColors
}

const missingDescriptions: MissingDescription[] = []

const ansiColors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}
const reset = '\x1b[0m'

export function reportMissingDescriptions () {
  if (!missingDescriptions.length) return

  console.warn(`\n${ansiColors.red}Missing API Descriptions:${reset}`)
  missingDescriptions.forEach(({ name, section, key, locale, color }) => {
    const c = ansiColors[color ?? 'red']
    console.warn(`${c}- ${name} (${locale}): [${section}] ${key}${reset}`)
  })

  // Clear missing descriptions in case of multiple runs
  missingDescriptions.length = 0
}

async function getSources (name: string, locale: string, sources: string[]) {
  const arr = await Promise.all([
    loadLocale(name, locale),
    ...sources.map(source => loadLocale(source, locale)),
    loadLocale('generic', locale),
  ])
  const sourcesMap = [name, ...sources, 'generic']

  return {
    find (section: string, key?: string, ogSource = name) {
      for (let i = 0; i < arr.length; i++) {
        const source = arr[i] as any
        const found: string | undefined = ['argument', 'value'].includes(section)
          ? source?.[section]
          : source?.[section]?.[key!]
        if (found) {
          return { text: found, source: sourcesMap[i] }
        }
      }

      // Collect missing descriptions
      missingDescriptions.push({
        name,
        section,
        key: key || '',
        locale,
      })

      const githubUrl = `https://github.com/vuetifyjs/vuetify/tree/${currentBranch}/packages/api-generator/src/locale/${locale}/${ogSource}.json`
      return { text: `MISSING DESCRIPTION ([edit in github](${githubUrl}))`, source: name }
    },
  }
}

export async function addDescriptions (name: string, componentData: ComponentData, locales: string[], sources: string[] = []) {
  for (const locale of locales) {
    const localeData = await loadLocale(name, locale)
    componentData.description ??= {}
    const desc = localeData.description as string
    componentData.description[locale] = desc ?? ''
    if (!desc) {
      missingDescriptions.push({ name, section: 'description', key: '', locale, color: 'yellow' })
    }

    const descriptions = await getSources(name, locale, sources)

    for (const section of ['props', 'slots', 'events', 'exposed'] as const) {
      for (const [propName, propObj] of Object.entries(componentData[section] ?? {})) {
        propObj.description = propObj.description ?? {}
        propObj.descriptionSource = propObj.descriptionSource ?? {}

        const found = descriptions.find(section, propName, propObj.source)
        propObj.description![locale] = found.text
        propObj.descriptionSource![locale] = found.source
      }
    }
  }
}

export async function addDirectiveDescriptions (
  name: string,
  componentData: DirectiveData,
  locales: string[],
  sources: string[] = [],
) {
  for (const locale of locales) {
    const descriptions = await getSources(name, locale, sources)

    if (componentData.value) {
      componentData.value.description = componentData.value.description ?? {}
      componentData.value.description[locale] = descriptions.find('value')?.text
    }

    if (componentData.argument) {
      componentData.argument.description = componentData.argument.description ?? {}
      componentData.argument.description[locale] = descriptions.find('argument')?.text
    }

    if (componentData.modifiers) {
      for (const [name, modifier] of Object.entries(componentData.modifiers)) {
        modifier.description = modifier.description ?? {}
        modifier.description[locale] = descriptions.find('modifiers', name)?.text
      }
    }
  }
}

export function sortByKey (data: Record<string, any>) {
  return Object.keys(data)
    .sort()
    .reduce((obj: Record<string, any>, key: string) => {
      obj[key] = data[key]
      return obj
    }, {})
}

export function stripLinks (str: string): [string, Record<string, string>] {
  let out = str.slice()
  const obj: Record<string, string> = {}
  const regexp = /<a .+?>(.+?)<\/a>/g

  let matches = regexp.exec(str)

  while (matches !== null) {
    obj[matches[1]] = matches[0]
    out = out.replace(matches[0], matches[1])

    matches = regexp.exec(str)
  }

  return [out, obj]
}

export function insertLinks (str: string, stripped: Record<string, string>) {
  for (const [key, value] of Object.entries(stripped)) {
    str = str.replaceAll(new RegExp(`(^|\\W)(${key})(\\W|$)`, 'g'), `$1${value}$3`)
  }
  return str
}

export async function prettifyType (name: string, item: Definition) {
  const prefix = 'type Type = '
  const [str, stripped] = stripLinks(item.formatted)
  let formatted
  try {
    formatted = await prettier.format(prefix + str, {
      parser: 'typescript',
      plugins: [typescriptParser],
      bracketSpacing: true,
      semi: false,
      singleQuote: true,
      trailingComma: 'all',
    })
  } catch (err: any) {
    console.error('\x1b[31m', `${name}:`, err.message, '\x1b[0m')
    return item
  }

  return {
    ...item,
    formatted: insertLinks(formatted, stripped).replace(/type\sType\s=\s+?/m, ''),
  }
}

```

### Core Architecture Module: `packages/api-generator/src/worker.ts`
```
import { generateComponentDataFromTypes } from './types.ts'

const reset = '\x1b[0m'
const red = '\x1b[31m'
const blue = '\x1b[34m'

export default async (componentName: string) => {
  console.log(blue, componentName, reset)

  try {
    return await generateComponentDataFromTypes(componentName)
  } catch (err: any) {
    console.error(red, `${componentName}: ${err}`, err.stack, reset)
    return null
  }
}

```

### Core Architecture Module: `packages/vuetify/src/components/VCalendar/util/dateTimeUtils.ts`
```
export function isLeapYear (year: number): boolean {
  return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0)
}

```

### Core Architecture Module: `packages/vuetify/src/components/VCalendar/util/events.ts`
```
import {
  copyTimestamp,
  getDayIdentifier,
  getTimestampIdentifier,
  isTimedless,
  nextMinutes,
  parseTimestamp,
  updateHasTime,
} from './timestamp'

// Types
import type { CalendarEvent, CalendarEventParsed, CalendarTimestamp } from '../types'

export function parseEvent (
  input: CalendarEvent,
  index: number,
  startProperty: string,
  endProperty: string,
  timed = false,
  category: string | false = false,
): CalendarEventParsed {
  const startInput = input[startProperty]
  const endInput = input[endProperty]
  const startParsed: CalendarTimestamp = parseTimestamp(startInput, true)
  const endParsed: CalendarTimestamp = (endInput ? parseTimestamp(endInput, true) : startParsed)
  const start: CalendarTimestamp = isTimedless(startInput)
    ? updateHasTime(startParsed, timed)
    : startParsed
  const end: CalendarTimestamp = isTimedless(endInput)
    ? updateHasTime(endParsed, timed)
    : endParsed
  const startIdentifier: number = getDayIdentifier(start)
  const startTimestampIdentifier: number = getTimestampIdentifier(start)
  const endIdentifier: number = getDayIdentifier(end)
  const endOffset: number = start.hasTime ? 0 : 2359
  const endTimestampIdentifier: number = getTimestampIdentifier(end) + endOffset
  const allDay = !start.hasTime

  return { input, start, startIdentifier, startTimestampIdentifier, end, endIdentifier, endTimestampIdentifier, allDay, index, category }
}

export function isEventOn (event: CalendarEventParsed, dayIdentifier: number): boolean {
  return dayIdentifier >= event.startIdentifier && dayIdentifier <= event.endIdentifier
}

export function isEventOnDay (
  event: CalendarEventParsed,
  day: CalendarTimestamp,
  inRange?: [number, number]
): boolean {
  if (inRange) {
    const dayStart = nextMinutes(copyTimestamp(day), inRange[0])
    const dayEnd = nextMinutes(copyTimestamp(day), inRange[1])

    const starts = event.startTimestampIdentifier < getTimestampIdentifier(dayEnd)
    const ends = event.endTimestampIdentifier > getTimestampIdentifier(dayStart)

    return starts && ends
  }

  return isEventOn(event, getDayIdentifier(day))
}

export function isEventHiddenOn (event: CalendarEventParsed, day: CalendarTimestamp): boolean {
  return event.end.time === '00:00' && event.end.date === day.date && event.start.date !== day.date
}

export function isEventStart (
  event: CalendarEventParsed,
  day: CalendarTimestamp,
  dayIdentifier: number,
  firstWeekday: number
): boolean {
  return dayIdentifier === event.startIdentifier || (firstWeekday === day.weekday && isEventOn(event, dayIdentifier))
}

export function isEventOverlapping (
  event: CalendarEventParsed,
  startIdentifier: number,
  endIdentifier: number
): boolean {
  return startIdentifier <= event.endIdentifier && endIdentifier >= event.startIdentifier
}

```

### Core Architecture Module: `packages/vuetify/src/components/VCalendar/util/parser.ts`
```
// Utilities
import { isFunction, isObject, isString } from '@/util'

// Types
import type { CalendarCategory, CalendarCategoryTextFunction } from '../types'

export function parsedCategoryText (
  category: CalendarCategory,
  categoryText: string | CalendarCategoryTextFunction | undefined
): string {
  return isFunction(categoryText) ? categoryText(category)
    : isString(categoryText) && isObject(category) ? category[categoryText]
    : isString(category) ? category
    : ''
}

export function getParsedCategories (
  categories: CalendarCategory | CalendarCategory[],
  categoryText: string | CalendarCategoryTextFunction | undefined
): CalendarCategory[] {
  if (isString(categories)) return categories.split(/\s*,\s/)
  if (Array.isArray(categories)) {
    return categories.map((category: CalendarCategory) => {
      if (isString(category)) return category

      const categoryName = isString(category.categoryName)
        ? category.categoryName
        : parsedCategoryText(category, categoryText)
      return { ...category, categoryName }
    })
  }
  return []
}

```

### Core Architecture Module: `packages/vuetify/src/components/VCalendar/util/timestamp.ts`
```
import { isLeapYear } from './dateTimeUtils'

// Utilities
import { isNumber, isObject, isString } from '@/util'

// Types
import type { CalendarFormatter, CalendarTimestamp } from '../types'

export const PARSE_REGEX = /^(\d{4})-(\d{1,2})(-(\d{1,2}))?([^\d]+(\d{1,2}))?(:(\d{1,2}))?(:(\d{1,2}))?$/
export const PARSE_TIME = /(\d\d?)(:(\d\d?)|)(:(\d\d?)|)/

export const DAYS_IN_MONTH: number[] = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export const DAYS_IN_MONTH_LEAP: number[] = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export const DAYS_IN_MONTH_MIN = 28
export const DAYS_IN_MONTH_MAX = 31
export const MONTH_MAX = 12
export const MONTH_MIN = 1
export const DAY_MIN = 1
export const DAYS_IN_WEEK = 7
export const MINUTES_IN_HOUR = 60
export const MINUTE_MAX = 59
export const MINUTES_IN_DAY = 24 * 60
export const HOURS_IN_DAY = 24
export const HOUR_MAX = 23
export const FIRST_HOUR = 0
export const OFFSET_YEAR = 10000
export const OFFSET_MONTH = 100
export const OFFSET_HOUR = 100
export const OFFSET_TIME = 10000

type CalendarTimestampFormatOptions = (timestamp: CalendarTimestamp, short: boolean) => Intl.DateTimeFormatOptions
type CalendarTimestampOperation = (timestamp: CalendarTimestamp) => CalendarTimestamp
export type VTime = number | string | {
  hour: number
  minute: number
}

export type VTimestampInput = number | string | Date;

export function getStartOfWeek (timestamp: CalendarTimestamp, weekdays: number[], today?: CalendarTimestamp): CalendarTimestamp {
  const start = copyTimestamp(timestamp)
  findWeekday(start, weekdays[0], prevDay)
  updateFormatted(start)
  if (today) {
    updateRelative(start, today, start.hasTime)
  }

  return start
}

export function getEndOfWeek (timestamp: CalendarTimestamp, weekdays: number[], today?: CalendarTimestamp): CalendarTimestamp {
  const end = copyTimestamp(timestamp)
  findWeekday(end, weekdays[weekdays.length - 1])
  updateFormatted(end)
  if (today) {
    updateRelative(end, today, end.hasTime)
  }

  return end
}

export function getStartOfMonth (timestamp: CalendarTimestamp): CalendarTimestamp {
  const start = copyTimestamp(timestamp)
  start.day = DAY_MIN
  updateWeekday(start)
  updateFormatted(start)

  return start
}

export function getEndOfMonth (timestamp: CalendarTimestamp): CalendarTimestamp {
  const end = copyTimestamp(timestamp)
  end.day = daysInMonth(end.year, end.month)
  updateWeekday(end)
  updateFormatted(end)

  return end
}

export function validateNumber (input: any): boolean {
  return isFinite(parseInt(input))
}

export function validateTime (input: any): input is VTime {
  return (isNumber(input) && isFinite(input)) ||
    (!!PARSE_TIME.exec(input)) ||
    (isObject(input) && isFinite(input.hour) && isFinite(input.minute))
}

export function parseTime (input: any): number | false {
  if (isNumber(input)) {
    // when a number is given, it's minutes since 12:00am
    return input
  } else if (isString(input)) {
    // when a string is given, it's a hh:mm:ss format where seconds are optional
    const parts = PARSE_TIME.exec(input)
    if (!parts) {
      return false
    }

    return parseInt(parts[1]) * 60 + parseInt(parts[3] || 0)
  } else if (isObject(input)) {
    // when an object is given, it must have hour and minute
    if (!isNumber(input.hour) || !isNumber(input.minute)) {
      return false
    }

    return input.hour * 60 + input.minute
  } else {
    // unsupported type
    return false
  }
}

export function validateTimestamp (input: any): input is VTimestampInput {
  return (isNumber(input) && isFinite(input)) ||
    (isString(input) && !!PARSE_REGEX.exec(input)) ||
    (input instanceof Date)
}

export function parseTimestamp (input: VTimestampInput | null, required?: false, now?: CalendarTimestamp | null): CalendarTimestamp | null
export function parseTimestamp (input: VTimestampInput, required: true, now?: CalendarTimestamp): CalendarTimestamp
export function parseTimestamp (input: VTimestampInput | null, required = false, now?: CalendarTimestamp | null): CalendarTimestamp | null {
  if (isNumber(input) && isFinite(input)) {
    input = new Date(input)
  }

  if (input instanceof Date) {
    const date: CalendarTimestamp = parseDate(input)

    if (now) {
      updateRelative(date, now, date.hasTime)
    }

    return date
  }

  if (!isString(input)) {
    if (required) {
      throw new Error(`${input} is not a valid timestamp. It must be a Date, number of milliseconds since Epoch, or a string in the format of YYYY-MM-DD or YYYY-MM-DD hh:mm. Zero-padding is optional and seconds are ignored.`)
    }
    return null
  }

  // YYYY-MM-DD hh:mm:ss
  const parts = PARSE_REGEX.exec(input)

  if (!parts) {
    if (required) {
      throw new Error(`${input} is not a valid timestamp. It must be a Date, number of milliseconds since Epoch, or a string in the format of YYYY-MM-DD or YYYY-MM-DD hh:mm. Zero-padding is optional and seconds are ignored.`)
    }

    return null
  }

  const timestamp: CalendarTimestamp = {
    date: input,
    time: '',
    year: parseInt(parts[1]),
    month: parseInt(parts[2]),
    day: parseInt(parts[4]) || 1,
    hour: parseInt(parts[6]) || 0,
    minute: parseInt(parts[8]) || 0,
    weekday: 0,
    hasDay: !!parts[4],
    hasTime: !!(parts[6] && parts[8]),
    past: false,
    present: false,
    future: false,
  }

  updateWeekday(timestamp)
  updateFormatted(timestamp)

  if (now) {
    updateRelative(timestamp, now, timestamp.hasTime)
  }

  return timestamp
}

export function parseDate (date: Date): CalendarTimestamp {
  return updateFormatted({
    date: '',
    time: '',
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: date.getDay(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    hasDay: true,
    hasTime: true,
    past: false,
    present: true,
    future: false,
  })
}

export function getDayIdentifier (timestamp: { year: number, month: number, day: number }): number {
  return timestamp.year * OFFSET_YEAR + timestamp.month * OFFSET_MONTH + timestamp.day
}

export function getTimeIdentifier (timestamp: { hour: number, minute: number }): number {
  return timestamp.hour * OFFSET_HOUR + timestamp.minute
}

export function getTimestampIdentifier (timestamp: CalendarTimestamp): number {
  return getDayIdentifier(timestamp) * OFFSET_TIME + getTimeIdentifier(timestamp)
}

export function updateRelative (timestamp: CalendarTimestamp, now: CalendarTimestamp, time = false): CalendarTimestamp {
  let a = getDayIdentifier(now)
  let b = getDayIdentifier(timestamp)
  let present = a === b

  if (timestamp.hasTime && time && present) {
    a = getTimeIdentifier(now)
    b = getTimeIdentifier(timestamp)
    present = a === b
  }

  timestamp.past = b < a
  timestamp.present = present
  timestamp.future = b > a

  return timestamp
}

export function isTimedless (input: VTimestampInput): input is (Date | number) {
  return (input instanceof Date) || (isNumber(input) && isFinite(input))
}

export function updateHasTime (timestamp: CalendarTimestamp, hasTime: boolean, now?: CalendarTimestamp): CalendarTimestamp {
  if (timestamp.hasTime !== hasTime) {
    timestamp.hasTime = hasTime
    if (!hasTime) {
      timestamp.hour = HOUR_MAX
      timestamp.minute = MINUTE_MAX
      timestamp.time = getTime(timestamp)
    }
    if (now) {
      updateRelative(timestamp, now, timestamp.hasTime)
    }
  }

  return timestamp
}

export function updateMinutes (timestamp: CalendarTimestamp, minutes: number, now?: CalendarTimestamp): CalendarTimestamp {
  timestamp.hasTime = true
  timestamp.hour = 0
  timestamp.minute = 0
  nextMinutes(timestamp, minutes)
  updateFormatted(timestamp)
  if (now) {
    updateRelative(timestamp, now, true)
  }

  return timestamp
}

export function updateWeekday (timestamp: CalendarTimestamp): CalendarTimestamp {
  timestamp.weekday = getWeekday(timestamp)

  return timestamp
}

export function updateFormatted (timestamp: CalendarTimestamp): CalendarTimestamp {
  timestamp.time = getTime(timestamp)
  timestamp.date = getDate(timestamp)

  return timestamp
}

export function getWeekday (timestamp: CalendarTimestamp): number {
  if (timestamp.hasDay) {
    const _ = Math.floor
    const k = timestamp.day
    const m = ((timestamp.month + 9) % MONTH_MAX) + 1
    const C = _(timestamp.year / 100)
    const Y = (timestamp.year % 100) - (timestamp.month <= 2 ? 1 : 0)

    return (((k + _(2.6 * m - 0.2) - 2 * C + Y + _(Y / 4) + _(C / 4)) % 7) + 7) % 7
  }

  return timestamp.weekday
}

export function daysInMonth (year: number, month: number) {
  return isLeapYear(year) ? DAYS_IN_MONTH_LEAP[month] : DAYS_IN_MONTH[month]
}

export function copyTimestamp (timestamp: null): null
export function copyTimestamp (timestamp: CalendarTimestamp): CalendarTimestamp
export function copyTimestamp (timestamp: CalendarTimestamp | null): CalendarTimestamp | null {
  if (timestamp == null) return null

  const { date, time, year, month, day, weekday, hour, minute, hasDay, hasTime, past, present, future } = timestamp

  return { date, time, year, month, day, weekday, hour, minute, hasDay, hasTime, past, present, future }
}

export function padNumber (x: number, length: number): string {
  let padded = String(x)
  while (padded.length < length) {
    padded = '0' + padded
  }

  return padded
}

export function getDate (timestamp: CalendarTimestamp): string {
  let str = `${padNumber(timestamp.year, 4)}-${padNumber(timestamp.month, 2)}`

  if (timestamp.hasDay) str += `-${padNumber(timestamp.day, 2)}`

  return str
}

export function getTime (timestamp: CalendarTimestamp): string {
  if (!timestamp.hasTime) {
    return ''
  }

  return `${padNumber(timestamp.hour, 2)}:${padNumber(timestamp.minute, 2)}`
}

export function nextMinutes (timestamp: CalendarTimestamp, minutes: number): CalendarTimestamp {
  timestamp.minute += minutes
  while (timestamp.minute >= MINUTES_IN_HOUR) {
    timestamp.minute -= MINUTES_IN_HOUR
 
```

### Core Architecture Module: `packages/vuetify/src/components/VColorPicker/util/index.ts`
```
// Utilities
import { isObject } from '@/util'
import {
  HexToHSV,
  HSLtoHSV,
  HSVtoHex,
  HSVtoHSL,
  HSVtoRGB,
  RGBtoHSV,
} from '@/util/colorUtils'
import { has } from '@/util/helpers'
import { isNumber, isString } from '@/util/v0'

// Types
import type { HSL, HSV, RGB } from '@/util/colorUtils'

function stripAlpha (color: any, stripAlpha: boolean) {
  if (stripAlpha) {
    const { a, ...rest } = color

    return rest
  }

  return color
}

export function extractColor (color: HSV, input: any) {
  if (input == null || isString(input)) {
    const hasA = isNumber(color.a) && color.a < 1
    if (input?.startsWith('rgb(')) {
      const { r, g, b, a } = HSVtoRGB(color)
      return `rgb(${r} ${g} ${b}` + (hasA ? ` / ${a})` : ')')
    } else if (input?.startsWith('hsl(')) {
      const { h, s, l, a } = HSVtoHSL(color)
      return `hsl(${h} ${Math.round(s * 100)} ${Math.round(l * 100)}` + (hasA ? ` / ${a})` : ')')
    }

    const hex = HSVtoHex(color)

    if (color.a === 1) return hex.slice(0, 7)
    else return hex
  }

  if (isObject(input)) {
    let converted

    if (has(input, ['r', 'g', 'b'])) converted = HSVtoRGB(color)
    else if (has(input, ['h', 's', 'l'])) converted = HSVtoHSL(color)
    else if (has(input, ['h', 's', 'v'])) converted = color

    return stripAlpha(converted, !has(input, ['a']) && color.a === 1)
  }

  return color
}

export function hasAlpha (color: any) {
  if (!color) return false

  if (isString(color)) {
    return color.length > 7
  }

  if (isObject(color)) {
    return has(color, ['a']) || has(color, ['alpha'])
  }

  return false
}

export const nullColor = { h: 0, s: 0, v: 0, a: 1 }

export type ColorPickerMode = {
  inputProps: Record<string, unknown>
  inputs: {
    [key: string]: any
    label: string
    getValue: (color: any) => number | string
    getColor: (color: any, v: string) => any
  }[]
  from: (color: any) => HSV
  to: (color: HSV) => any
}

const rgba: ColorPickerMode = {
  inputProps: {
    type: 'number',
    min: 0,
  },
  inputs: [
    {
      label: 'R',
      max: 255,
      step: 1,
      getValue: (c: RGB) => Math.round(c.r),
      getColor: (c: RGB, v: string): RGB => ({ ...c, r: Number(v) }),
      localeKey: 'redInput',
    },
    {
      label: 'G',
      max: 255,
      step: 1,
      getValue: (c: RGB) => Math.round(c.g),
      getColor: (c: RGB, v: string): RGB => ({ ...c, g: Number(v) }),
      localeKey: 'greenInput',
    },
    {
      label: 'B',
      max: 255,
      step: 1,
      getValue: (c: RGB) => Math.round(c.b),
      getColor: (c: RGB, v: string): RGB => ({ ...c, b: Number(v) }),
      localeKey: 'blueInput',
    },
    {
      label: 'A',
      max: 1,
      step: 0.01,
      getValue: ({ a }: RGB) => a != null ? Math.round(a * 100) / 100 : 1,
      getColor: (c: RGB, v: string): RGB => ({ ...c, a: Number(v) }),
      localeKey: 'alphaInput',
    },
  ],
  to: HSVtoRGB,
  from: RGBtoHSV,
}

const rgb = {
  ...rgba,
  inputs: rgba.inputs?.slice(0, 3),
}

const hsla: ColorPickerMode = {
  inputProps: {
    type: 'number',
    min: 0,
  },
  inputs: [
    {
      label: 'H',
      max: 360,
      step: 1,
      getValue: (c: HSL) => Math.round(c.h),
      getColor: (c: HSL, v: string): HSL => ({ ...c, h: Number(v) }),
      localeKey: 'hueInput',
    },
    {
      label: 'S',
      max: 1,
      step: 0.01,
      getValue: (c: HSL) => Math.round(c.s * 100) / 100,
      getColor: (c: HSL, v: string): HSL => ({ ...c, s: Number(v) }),
      localeKey: 'saturationInput',
    },
    {
      label: 'L',
      max: 1,
      step: 0.01,
      getValue: (c: HSL) => Math.round(c.l * 100) / 100,
      getColor: (c: HSL, v: string): HSL => ({ ...c, l: Number(v) }),
      localeKey: 'lightnessInput',
    },
    {
      label: 'A',
      max: 1,
      step: 0.01,
      getValue: ({ a }: HSL) => a != null ? Math.round(a * 100) / 100 : 1,
      getColor: (c: HSL, v: string): HSL => ({ ...c, a: Number(v) }),
      localeKey: 'alphaInput',
    },
  ],
  to: HSVtoHSL,
  from: HSLtoHSV,
}

const hsl = {
  ...hsla,
  inputs: hsla.inputs.slice(0, 3),
}

const hexa: ColorPickerMode = {
  inputProps: {
    type: 'text',
  },
  inputs: [
    {
      label: 'HEXA',
      getValue: (c: string) => c,
      getColor: (c: string, v: string) => v,
      localeKey: 'hexaInput',
    },
  ],
  to: HSVtoHex,
  from: HexToHSV,
}

const hex = {
  ...hexa,
  inputs: [
    {
      label: 'HEX',
      getValue: (c: string) => c.slice(0, 7),
      getColor: (c: string, v: string) => v,
      localeKey: 'hexInput',
    },
  ],
}

export const modes = {
  rgb,
  rgba,
  hsl,
  hsla,
  hex,
  hexa,
} satisfies Record<string, ColorPickerMode>

```

### Core Architecture Module: `packages/vuetify/src/components/VEmptyState/VEmptyState.tsx`
```
// Styles
import './VEmptyState.sass'

// Components
import { VBtn } from '@/components/VBtn'
import { VDefaultsProvider } from '@/components/VDefaultsProvider'
import { VIcon } from '@/components/VIcon'
import { VImg } from '@/components/VImg'

// Composables
import { useBackgroundColor } from '@/composables/color'
import { makeComponentProps } from '@/composables/component'
import { makeDimensionProps, useDimension } from '@/composables/dimensions'
import { useDisplay } from '@/composables/display'
import { IconValue } from '@/composables/icons'
import { makeSizeProps } from '@/composables/size'
import { makeThemeProps, provideTheme } from '@/composables/theme'

// Utilities
import { convertToUnit, genericComponent, propsFactory, useRender } from '@/util'

// Types
import type { PropType } from 'vue'

// Types

export type VEmptyStateSlots = {
  actions: {
    props: {
      onClick: (e: Event) => void
    }
  }
  default: never
  headline: never
  title: never
  media: never
  text: never
}

export const makeVEmptyStateProps = propsFactory({
  actionText: String,
  bgColor: String,
  color: String,
  icon: IconValue,
  image: String,
  justify: {
    type: String as PropType<'start' | 'center' | 'end'>,
    default: 'center',
  },
  headline: String,
  title: String,
  text: String,
  textWidth: {
    type: [Number, String],
    default: 500,
  },
  href: String,
  to: String,

  ...makeComponentProps(),
  ...makeDimensionProps(),
  ...makeSizeProps({ size: undefined }),
  ...makeThemeProps(),
}, 'VEmptyState')

export const VEmptyState = genericComponent<VEmptyStateSlots>()({
  name: 'VEmptyState',

  props: makeVEmptyStateProps(),

  emits: {
    'click:action': (e: Event) => true,
  },

  setup (props, { emit, slots }) {
    const { themeClasses } = provideTheme(props)
    const { backgroundColorClasses, backgroundColorStyles } = useBackgroundColor(() => props.bgColor)
    const { dimensionStyles } = useDimension(props)
    const { displayClasses } = useDisplay()

    function onClickAction (e: Event) {
      emit('click:action', e)
    }

    useRender(() => {
      const hasActions = !!(slots.actions || props.actionText)
      const hasHeadline = !!(slots.headline || props.headline)
      const hasTitle = !!(slots.title || props.title)
      const hasText = !!(slots.text || props.text)
      const hasMedia = !!(slots.media || props.image || props.icon)
      const size = props.size || (props.image ? 200 : 96)

      return (
        <div
          class={[
            'v-empty-state',
            {
              [`v-empty-state--${props.justify}`]: true,
            },
            themeClasses.value,
            backgroundColorClasses.value,
            displayClasses.value,
            props.class,
          ]}
          style={[
            backgroundColorStyles.value,
            dimensionStyles.value,
            props.style,
          ]}
        >
          { hasMedia && (
            <div key="media" class="v-empty-state__media">
              { !slots.media ? (
                <>
                  { props.image ? (
                    <VImg
                      key="image"
                      src={ props.image }
                      height={ size }
                    />
                  ) : props.icon ? (
                    <VIcon
                      key="icon"
                      color={ props.color }
                      size={ size }
                      icon={ props.icon }
                    />
                  ) : undefined }
                </>
              ) : (
                <VDefaultsProvider
                  key="media-defaults"
                  defaults={{
                    VImg: {
                      src: props.image,
                      height: size,
                    },
                    VIcon: {
                      size,
                      icon: props.icon,
                    },
                  }}
                >
                  { slots.media() }
                </VDefaultsProvider>
              )}
            </div>
          )}

          { hasHeadline && (
            <div key="headline" class="v-empty-state__headline">
              { slots.headline?.() ?? props.headline }
            </div>
          )}

          { hasTitle && (
            <div key="title" class="v-empty-state__title">
              { slots.title?.() ?? props.title }
            </div>
          )}

          { hasText && (
            <div
              key="text"
              class="v-empty-state__text"
              style={{
                maxWidth: convertToUnit(props.textWidth),
              }}
            >
              { slots.text?.() ?? props.text }
            </div>
          )}

          { slots.default && (
            <div key="content" class="v-empty-state__content">
              { slots.default() }
            </div>
          )}

          { hasActions && (
            <div key="actions" class="v-empty-state__actions">
              <VDefaultsProvider
                defaults={{
                  VBtn: {
                    class: 'v-empty-state__action-btn',
                    color: props.color ?? 'surface-variant',
                    href: props.href,
                    text: props.actionText,
                    to: props.to,
                  },
                }}
              >
                {
                  slots.actions?.({ props: { onClick: onClickAction } }) ?? (
                    <VBtn onClick={ onClickAction } />
                  )
                }
              </VDefaultsProvider>
            </div>
          )}
        </div>
      )
    })

    return {}
  },
})

export type VEmptyState = InstanceType<typeof VEmptyState>

```

### Core Architecture Module: `packages/vuetify/src/components/VEmptyState/index.ts`
```
export { VEmptyState } from './VEmptyState'

```

### Core Architecture Module: `packages/vuetify/src/components/VOverlay/util/point.ts`
```
// Types
import type { ParsedAnchor } from '@/util'
import type { Box } from '@/util/box'

type Point = { x: number, y: number }
declare class As<T extends string> {
  private as: T
}
type ElementPoint = Point & As<'element'>
type ViewportPoint = Point & As<'viewport'>
type Offset = Point & As<'offset'>

/** Convert a point in local space to viewport space */
export function elementToViewport (point: ElementPoint, offset: Offset | Box) {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y,
  } as ViewportPoint
}

/** Convert a point in viewport space to local space */
export function viewportToElement (point: ViewportPoint, offset: Offset | Box) {
  return {
    x: point.x - offset.x,
    y: point.y - offset.y,
  } as ElementPoint
}

/** Get the difference between two points */
export function getOffset<T extends Point> (a: T, b: T) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  } as Offset
}

/** Convert an anchor object to a point in local space */
export function anchorToPoint (anchor: ParsedAnchor, box: Box): ViewportPoint {
  if (anchor.side === 'top' || anchor.side === 'bottom') {
    const { side, align } = anchor

    const x: number =
      align === 'left' ? 0
      : align === 'center' ? box.width / 2
      : align === 'right' ? box.width
      : align
    const y: number =
      side === 'top' ? 0
      : side === 'bottom' ? box.height
      : side

    return elementToViewport({ x, y } as ElementPoint, box)
  } else if (anchor.side === 'left' || anchor.side === 'right') {
    const { side, align } = anchor

    const x: number =
      side === 'left' ? 0
      : side === 'right' ? box.width
      : side
    const y: number =
      align === 'top' ? 0
      : align === 'center' ? box.height / 2
      : align === 'bottom' ? box.height
      : align

    return elementToViewport({ x, y } as ElementPoint, box)
  }

  return elementToViewport({
    x: box.width / 2,
    y: box.height / 2,
  } as ElementPoint, box)
}

```

### Core Architecture Module: `packages/vuetify/src/components/VSnackbarQueue/VSnackbarQueue.tsx`
```
// Components
import { VBtn } from '@/components/VBtn'
import { VDefaultsProvider } from '@/components/VDefaultsProvider'
import { makeVSnackbarProps, VSnackbar } from '@/components/VSnackbar/VSnackbar'

// Composables
import { useSnackbarQueue } from './queue'
import { useDelay } from '@/composables/delay'
import { useDocumentVisibility } from '@/composables/documentVisibility'
import { useLocale } from '@/composables/locale'

// Utilities
import { computed, mergeProps, ref, shallowRef, toRef, triggerRef, watch } from 'vue'
import { genericComponent, isString, omit, propsFactory, useRender } from '@/util'

// Types
import type { PropType, VNodeProps } from 'vue'
import type { GenericProps } from '@/util'

export type VSnackbarQueueSlots<T extends string | SnackbarMessage> = {
  header: { item: T }
  item: { item: T }
  text: { item: T }
  actions: {
    item: T
    props: {
      onClick: () => void
    }
  }
}

export type SnackbarMessageDismissType =
  | 'dismissed'
  | 'cleared'
  | 'overflow'
  | 'auto'

type SingleSnackbarProps = Omit<
  VSnackbar['$props'],
  | 'modelValue'
  | 'onUpdate:modelValue'
  | 'activator'
  | 'activatorProps'
  | 'closeDelay'
  | 'openDelay'
  | 'openOnClick'
  | 'openOnFocus'
  | 'openOnHover'
  | 'collapsed'
  | 'style'
  | '$children'
  | 'v-slots'
  | `v-slot:${string}`
  | keyof VNodeProps
> & {
  style?: any
}

export type SnackbarMessage =
  | string
  | (SingleSnackbarProps & {
    collapsed?: { width: number, height: number }
    promise?: Promise<unknown>
    success?: (val?: unknown) => SingleSnackbarProps
    error?: (val?: Error) => SingleSnackbarProps
    onDismiss?: (reason: SnackbarMessageDismissType) => void
  })

export type SnackbarQueueItem = {
  id: number
  item: Exclude<SnackbarMessage, string>
  active: boolean
  onDismiss?: (reason: SnackbarMessageDismissType) => void
}

export const makeVSnackbarQueueProps = propsFactory({
  // TODO: Port this to Snackbar on dev
  closable: [Boolean, String],
  closeText: {
    type: String,
    default: '$vuetify.dismiss',
  },
  collapsed: Boolean,
  displayStrategy: {
    type: String as PropType<'overflow' | 'hold'>,
    default: 'hold',
  },
  modelValue: {
    type: Array as PropType<readonly SnackbarMessage[]>,
    default: () => [],
  },
  totalVisible: {
    type: [Number, String],
    default: 1,
  },
  gap: {
    type: [Number, String],
    default: 8,
  },
  ...omit(makeVSnackbarProps(), ['modelValue', 'collapsed', 'queueIndex', 'queueGap']),
}, 'VSnackbarQueue')

export const VSnackbarQueue = genericComponent<new <T extends readonly SnackbarMessage[]> (
  props: {
    modelValue?: T
    'onUpdate:modelValue'?: (val: T) => void
  },
  slots: VSnackbarQueueSlots<T[number]>,
) => GenericProps<typeof props, typeof slots>>()({
  name: 'VSnackbarQueue',

  inheritAttrs: false,

  props: makeVSnackbarQueueProps(),

  emits: {
    'update:modelValue': (val: SnackbarMessage[]) => true,
  },

  setup (props, { attrs, emit, slots }) {
    const { t } = useLocale()
    const documentVisibility = useDocumentVisibility()
    const queue = useSnackbarQueue(props)

    const isHovered = shallowRef(false)
    const { runOpenDelay, runCloseDelay } = useDelay(
      { openDelay: 0, closeDelay: 500 },
      val => {
        isHovered.value = val
        updateDynamicProps()
      }
    )

    let _lastId = 0
    const visibleItems = ref<SnackbarQueueItem[]>([])
    const limit = toRef(() => Number(props.totalVisible))

    watch(() => props.modelValue.length, showNext)

    function removeItem (id: number) {
      visibleItems.value = visibleItems.value.filter(x => x.id !== id)
      if (visibleItems.value.length === 0) {
        isHovered.value = false
      }
      showNext()
    }

    function showNext () {
      if (!props.modelValue.length) return

      const activeCount = visibleItems.value.filter(x => x.active).length
      if (activeCount >= limit.value) {
        if (props.displayStrategy !== 'overflow') return

        // Dismiss oldest active items to make room
        visibleItems.value
          .filter(x => x.active)
          .slice(limit.value - 1)
          .forEach(item => {
            item.active = false
            item.onDismiss?.('overflow')
          })
      }

      const [next, ...rest] = props.modelValue
      emit('update:modelValue', rest)

      const item = isString(next) ? { text: next } : next
      const { promise, success, error, onDismiss, ...itemProps } = item

      const newItem: SnackbarQueueItem = {
        id: _lastId++,
        item: {
          ...promise ? { timeout: -1, loading: true } : {},
          ...itemProps,
        },
        active: true,
        onDismiss,
      }
      visibleItems.value.unshift(newItem)
      updateDynamicProps()

      promise?.then(
        (data: any) => {
          if (!newItem.active) return
          newItem.item = success?.(data) ?? { ...newItem.item, timeout: 1 }
          updateDynamicProps()
          triggerRef(visibleItems)
        },
        (data: any) => {
          if (!newItem.active) return
          newItem.item = error?.(data) ?? { ...newItem.item, timeout: 1 }
          updateDynamicProps()
          triggerRef(visibleItems)
        }
      )
    }

    function dismiss (id: number, reason: SnackbarMessageDismissType) {
      const item = visibleItems.value.find(x => x.id === id)
      if (!item) return
      item.active = false
      item.onDismiss?.(reason)
      updateDynamicProps()
    }

    function clear () {
      emit('update:modelValue', [])
      visibleItems.value
        .toReversed()
        .forEach((item, i) => setTimeout(() => {
          item.active = false
          item.onDismiss?.('cleared')
        }, 100 * i))
    }

    const btnProps = computed(() => ({
      color: isString(props.closable) ? props.closable : undefined,
      text: t(props.closeText),
    }))

    function updateDynamicProps () {
      let activeIndex = 0
      visibleItems.value.forEach(({ item, active }) => {
        item.queueIndex = activeIndex
        if (active) activeIndex++
      })

      if (!props.collapsed || isHovered.value) {
        visibleItems.value.forEach(({ item }) => item.collapsed = undefined)
        return
      }

      for (const { item } of visibleItems.value) {
        item.collapsed = item.queueIndex! > 0 ? {
          width: queue.lastItemSize.value.width,
          height: queue.lastItemSize.value.height,
        } : undefined
      }
    }

    watch(queue.lastItemSize, updateDynamicProps)
    watch(() => props.collapsed, updateDynamicProps)

    useRender(() => {
      const hasActions = !!(props.closable || slots.actions)
      const snackbarProps = omit(VSnackbar.filterProps(props as any), ['modelValue', 'collapsed'])
      const pauseAll = documentVisibility.value === 'hidden' || (props.collapsed && isHovered.value)

      return (
        <>
          { visibleItems.value.map(({ id, item, active }) => (
            slots.item
              ? (
                <VDefaultsProvider defaults={{ VSnackbar: item }}>
                  { slots.item({ item }) }
                </VDefaultsProvider>
              ) : (
                <VSnackbar
                  key={ id }
                  { ...attrs }
                  { ...snackbarProps }
                  { ...item }
                  { ...(pauseAll ? { timeout: -1 } : {}) }
                  queueGap={ Number(props.gap) }
                  contentProps={ mergeProps(snackbarProps.contentProps, {
                    onMouseenter: runOpenDelay,
                    onMouseleave: () => runCloseDelay(),
                  })}
                  modelValue={ active }
                  onUpdate:modelValue={ () => dismiss(id, 'auto') }
                  onAfterLeave={ () => removeItem(id) }
                >
                  {{
                    header: slots.header ? () => slots.header?.({ item }) : undefined,
                    text: slots.text ? () => slots.text?.({ item }) : undefined,
                    actions: hasActions ? () => (
                      <>
                        { !slots.actions ? (
                          <VBtn
                            { ...btnProps.value }
                            onClick={ () => dismiss(id, 'dismissed') }
                          />
                        ) : (
                          <VDefaultsProvider defaults={{ VBtn: btnProps.value }}>
                            { slots.actions({
                              item,
                              props: { onClick: () => dismiss(id, 'dismissed') },
                            })}
                          </VDefaultsProvider>
                        )}
                      </>
                    ) : undefined,
                  }}
                </VSnackbar>
              )
          ))}
        </>
      )
    })

    return {
      clear,
    }
  },
})

export type VSnackbarQueue = InstanceType<typeof VSnackbarQueue>

```

### Core Architecture Module: `packages/vuetify/src/components/VSnackbarQueue/index.ts`
```
export { VSnackbarQueue } from './VSnackbarQueue'

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23239** (2026-10-02): **Automatically inject layer ordering into index.html**
  *Symptoms*: This is in relation to https://github.com/vuetifyjs/vuetify/issues/23135  While I like that the documentation is fixed, I do not exactly want to re-define the layers in every project, especially since it will potentially cause issues when vuetify adds a layer or changes the default ordering for some reason. My suggestion would be to extend the vite-plugin-vuetify to either copy the internal _layer.css into public and add it as a link to the index.html, or to just inline the default layer ordering into index.html as a style tag.   Most setups would work fine with this, but in order to allow for the most configurability I would suggest making a config parameter for this, and I would argue for it being active out of the box, and then adding to the documentation of css layers that this needs to be turned off when manually specifying the layer order.  For some more context, here is the link to the conversation I had with the very helpful discord ai (seriously, that one saved me so many headaches already): https://discord.com/channels/1513968811047522396/1555573738655715443 
  **Post-Mortem & Fix Analysis**:
  > I think it asks for regular entry point. Follow up to [f00902ce](https://github.com/vuetifyjs/vuetify/commit/f00902ce6aa800bc480eed722c111bcdf3518834)

- **Issue #23237** (2026-10-02): **feat(VWindow): add opt-in wheel prop for mouse wheel/trackpad navigation**
  *Symptoms*: Fixes #22893  Adds a disabled-by-default `wheel` boolean prop to VWindow (automatically available on VCarousel via `makeVWindowProps`). When enabled, wheel/trackpad input on the dominant scroll axis for the window `direction` moves to the next/previous item. Respects `continuous` at the edges, `disabled`, and RTL; `preventDefault` is only called when a navigation actually happens, so page scroll is never hijacked.  Verified: new browser tests in VWindow.spec.browser.tsx (wheel navigates when enabled, ignored by default, respects non-continuous edges) — 13/13 VWindow + 2/2 VCarousel tests green locally, eslint clean.
  **Post-Mortem & Fix Analysis**:
  > - allowing vertical scroll to work against carousel moving oriented horizontally should probably require additional configuration. By default it should require holding Shift key. Without Shift key, the page scroll is hijacked. RTL handling might have a bug here too - should ignore scroll when there is only 1 item within - needs testing against trackpad - needs verification with nested scroll area (should not bubble up unless reached the end and has no `cycle`) and/or something that scrolls within each slide - missing throttle when scrolling against window items with `:transition="false" :reverse-transition="false"` or if user prefers "reduced motion" - missing entry in `new-in.json` - PR should target `dev` - API page already shows default value, so description with "disabled by default" is redundant  ---  What makes this PR worth keeping over #22906?  I don't mean to scare you away. If you can follow-up on these points and transform PoC into solid PR, and stick around for

- **Issue #23236** (2026-10-02): **chore: update dependency markdown-it to v14.3.1 [security]**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Adoption](https://docs.renovatebot.com/merge-confidence/) | [Passing](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---|---|---| | [markdown-it](https://redirect.github.com/markdown-it/markdown-it) | [`14.1.1` → `14.3.1`](https://renovatebot.com/diffs/npm/markdown-it/14.1.1/14.3.1) | ![age](https://developer.mend.io/api/mc/badges/age/npm/markdown-it/14.3.1?slim=true) | ![adoption](https://developer.mend.io/api/mc/badges/adoption/npm/markdown-it/14.3.1?slim=true) | ![passing](https://developer.mend.io/api/mc/badges/compatibility/npm/markdown-it/14.1.1/14.3.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/markdown-it/14.1.1/14.3.1?slim=true) |  ---  ### markdown-it is has a Regular Expression Denial of Service (ReDoS) [CVE-2026-2327](https://nvd.nist.gov/vuln/detail/CVE-2026-2327) / [GHSA-38c4-r59v-3vqw](https://redirect.github.com/advisories/GHSA-38c4-r59v-3vqw)  <details> <summary>More information</summary>  #### Details Versions of the package markdown-it from 13.0.0 and before 14.1.1 are vulnerable to Regular Expression Denial of Service (ReDoS) due to the use of the regex /\*+$/ in the linkify function. An attacker can supply a long sequence of * characters followed by a non-matching character, which triggers excessive backtracking and may lea
  **Post-Mortem & Fix Analysis**:
  > ### Renovate Ignore Notification  Because you closed this PR without merging, Renovate will ignore this update (`^14.1.1`). You will get a PR once a newer version is released. To ignore this dependency forever, add it to the `ignoreDeps` array of your Renovate config.  If you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.

- **Issue #23235** (2026-10-01): **chore: update dependency moment to v2.31.0 [security]**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Adoption](https://docs.renovatebot.com/merge-confidence/) | [Passing](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---|---|---| | [moment](https://momentjs.com) | [`2.30.1` → `2.31.0`](https://renovatebot.com/diffs/npm/moment/2.30.1/2.31.0) | ![age](https://developer.mend.io/api/mc/badges/age/npm/moment/2.31.0?slim=true) | ![adoption](https://developer.mend.io/api/mc/badges/adoption/npm/moment/2.31.0?slim=true) | ![passing](https://developer.mend.io/api/mc/badges/compatibility/npm/moment/2.30.1/2.31.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/moment/2.30.1/2.31.0?slim=true) |  ---  ### moment vulnerable to Path Traversal via crafted non-string locale name [CVE-2026-17495](https://nvd.nist.gov/vuln/detail/CVE-2026-17495) / [GHSA-4p3w-j4w9-5jqw](https://redirect.github.com/advisories/GHSA-4p3w-j4w9-5jqw)  <details> <summary>More information</summary>  #### Details ##### Impact  moment before 2.31.0 is vulnerable to path traversal in `moment.locale()`. When an application passes a non-string, attacker-influenced value to `moment.locale()`, a specially crafted object can bypass the locale name validation and cause moment to load a file from an attacker-controlled path. This is a further bypass of the validation added in 2.29.2 for [CVE-2022-247
  **Post-Mortem & Fix Analysis**:
  > ### Renovate Ignore Notification  Because you closed this PR without merging, Renovate will ignore this update (`^2.30.1`). You will get a PR once a newer version is released. To ignore this dependency forever, add it to the `ignoreDeps` array of your Renovate config.  If you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.

- **Issue #23229** (2026-09-29): **[Bug Report][4.1.0-beta.0] VExpansionPanels no longer rounded by default since 4.1.0-beta.0**
  *Symptoms*: ### Environment **Vuetify Version:** 4.1.0-beta.0 **Vue Version:** 3.5.43 **OS:** Linux undefined (current)  ### Steps to reproduce 1. Open the reproduction link with Vuetify 4.0.9: the panels are rounded. 2. Switch the playground to 4.1.0-beta.0 (or 4.2.2): the panels have square corners. 3. Inspect the .v-expansion-panels element: it has the rounded-0 class.  ### Expected Behavior Without the `rounded` prop, the panels are rounded (border-radius: 4px from the component CSS), as in Vuetify 3 and up to 4.0.9  ### Actual Behavior Without the `rounded` prop, the root element gets the `rounded-0` class and the panels have square corners.  ### Reproduction Link [https://play.vuetifyjs.com/#...](https://play.vuetifyjs.com/#eNqlVU1vGzcQ/Svs5rAUIHEd20FQwUpdBClaoIegCXrx+rDWzkpMueSWpBQLhv57Hz/0ZbuBgxyIXb4ZvnkzJIc3D4XsB2P9pG8G8cUZXUyLh1ozVmeDq4spi0jA1isK87pYej+4aVXNW41lLSm5tkKTr/TQV9dwq+xKe9nTpDX99YV4Iy4vqlY6f4wLcv3kzpqvjixY6mJ8FKcCuCY7saRbsmRfGvfRspPYj2zfjO9lt3lBzOx5fSnOxXmKkqGJau5cCBGpA/O21ttiXCip/3GPij13sdA3OwE/FDOSBabbFNDZefXrMAg4IeKVp35Qjad3weVqPWmGIf7Gydxo30hNNkMRpPuh0U4aPcGXlNvbnrMyL72iWV18jLPXdcE83XsA78FN2keo+h6O86ccATpwXFX/KzKYTpMKSMr5qjqqRS5UD0fhHQqVLgB7YHNLcEEF2ZZ11vSsRCXLWu8dcvX3ZrHbj4NTWL0z5r04GIE58qsBSK0h1nkGgWx2iMwxRrUGKmDv5EKQtcb+3uhWkYUnsdk7FpYaRcnGCQvSkpUjnhXtsd7gIvLyFf5LgDn7KCOlb6k3a/rkN4o+NwsOn4/QLx2JRil+o0zT/oa68tGYhf8/QnA+uo0BupWee2wFOyVhfJR6ScrRA5mx1sxXPbZU/Lsiu/lEiuYe6stXuzPtl4R+4QKHWxL5IJcx2TH+ExhGiOFXFkFZIBRDg+vtPyisAWeK/34pVcuDMy7Eib6gPKqLzIwvLXVZY6Jlmr6ynDjn
  **Post-Mortem & Fix Analysis**:
  > fixed by [17c9f8d](https://github.com/vuetifyjs/vuetify/commit/17c9f8d)

- **Issue #23228** (2026-09-29): **fix(VTimeline): isolate styles from nested timelines**
  *Symptoms*: ## Description  - avoid leaking styles to nested v-timeline's  fixes #21426  ## Markup:  ```vue <template>   <v-app>     <v-main>       <v-container>         <div class="d-flex flex-column ga-8">           <code>issue repro: nested, both align="start"</code>           <v-row align="start">             <v-col cols="6">               <v-timeline                 align="start"                 density="compact"                 line-inset="12"                 side="end"                 truncate-line="both"               >                 <v-timeline-item v-for="i in 2" :key="i" dot-color="primary" width="100%">                   <div>Outer {{ i }}</div>                   <v-timeline                     align="start"                     density="compact"                     line-inset="12"                     side="end"                     truncate-line="both"                   >                     <v-timeline-item v-for="j in 2" :key="j" dot-color="info" size="small">                       <div>Inner {{ i }}-{{ j }}</div>                       <div class="text-medium-emphasis">Second line</div>                     </v-timeline-item>                   </v-timeline>                 </v-timeline-item>               </v-timeline>             </v-col>             <v-col cols="6">               <code>expected (fixed)</code>               <v-timeline                 align="start"                 density="compact"                 line-inset="1
  **Post-Mortem & Fix Analysis**:
  > we could cover 2 more cases:  <details> <summary>Details</summary>  ```vue <template>   <v-app>     <v-main>       <v-container>         <div class="d-flex flex-column ga-8">           <code>issue repro: nested, both align="start"</code>           <v-row align="start">             <v-col cols="6">               <v-timeline                 align="start"                 density="compact"                 line-inset="12"                 side="end"                 truncate-line="both"               >                 <v-timeline-item v-for="i in 2" :key="i" dot-color="primary" width="100%">                   <div>Outer {{ i }}</div>                   <v-timeline                     align="start"                     density="compact"                     line-inset="12"                     side="end"                     truncate-line="both"                   >                     <v-timeline-item v-for="j in 2" :key="j" dot-color="info" size="small">             
  > @J-Sek Thank you for suggesting the additional cases.  I updated the styles to scope direction, alignment, side, and density rules to the items directly owned by each `VTimeline`. I verified all three cases from your playground:  - nested timelines with `align="start"` - outer `align="start"` with inner `align="center"` - outer vertical timeline with an inner horizontal timeline  The nested timelines now match the standalone expected layouts in all three cases. The existing VTimeline browser tests also pass (6/6). 

- **Issue #23226** (2026-10-05): **fix(styles): normalize zero breakpoint units**
  *Symptoms*: ## Description  A unit-bearing zero breakpoint such as `xs: 0px` was treated as a responsive breakpoint by `breakpoint-min()`. This caused utility CSS to use `-xs` selectors and omit base selectors such as `.d-flex`.  Treat numeric zero values as the base breakpoint regardless of unit. The Sass regression test compiles the utility styles with both `xs: 0` and `xs: 0px`.  Reproduction setting:  ```scss @use "vuetify/settings" with ($grid-breakpoints: ("xs": 0px)); ```  Close #23150  ## Markup:  ```vue <template>   <v-app>     <v-container>       <div class="d-flex">         <div>First item</div>         <div>Second item</div>       </div>     </v-container>   </v-app> </template>  <script>   export default {     name: 'Playground',   } </script> ``` 

- **Issue #23224** (2026-09-28): **docs(transitions): correct prop descriptions for `disabled` and `origin`**
  *Symptoms*: ## Description  The `disabled` and `origin` props for transition components currently fall back to unrelated descriptions from `generic.json`.  - `disabled` is described as removing the ability to click or target the component, but it disables the transition CSS and hooks. - `origin` is described in terms of overlay anchors, but it sets the CSS `transform-origin` on the transitioning element.  This adds transition-specific descriptions so API pages such as `VFabTransition` and `VScaleTransition` describe the implemented behavior.  ## Testing  - `pnpm --filter @vuetify/api-generator lint` - `pnpm build vuetify` - `pnpm build api` - Verified the rendered `VFabTransition` API page locally 

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

### Incident Patch 1: `2dc67cf4` (2026-10-05)
**Commit Message**: fix(styles): normalize zero breakpoint units (#23226)

**File**: `packages/vuetify/src/styles/__tests__/utilities.spec.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import * as sass from 'sass'
+import { resolve } from 'node:path'
+
+const stylesPath = resolve(process.cwd(), 'src/styles')
+
+describe('styles utilities', () => {
+  it.each(['0', '0px'])('should generate base display utilities when xs is %s', breakpoint => {
+    const { css } = sass.compileString(
+      `@use "settings" with ($grid-breakpoints: ("xs": ${breakpoint}));\n@use "utilities";`,
+      { loadPaths: [stylesPath] },
+    )
+    const hasBaseDisplayUtility = css.includes('.d-flex {')
+    const hasResponsiveDisplayUtility = css.includes('.d-xs-flex {')
+
+    expect(hasBaseDisplayUtility).toBe(true)
+    expect(hasResponsiveDisplayUtility).toBe(false)
+  })
+})
```

**File**: `packages/vuetify/src/styles/tools/_functions.sass` (modified, +3/-3)
```diff
@@ -45,11 +45,11 @@
 
 @function breakpoint-min($name, $breakpoints)
   $min: map.get($breakpoints, $name)
-  @if $min != 0
-    @return $min
-  @else
+  @if meta.type-of($min) == "number" and math.div($min, $min * 0 + 1) == 0
     @return null
 
+  @return $min
+
 @function breakpoint-infix($name, $breakpoints)
   @if breakpoint-min($name, $breakpoints) == null
     @return ''
```

---

### Incident Patch 2: `d6ab69bf` (2026-10-02)
**Commit Message**: fix(VWindow): transition-duration should work with CSS layers

**File**: `packages/api-generator/src/locale/en/VWindow.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     "reverse": "Reverse the normal transition direction.",
     "showArrows": "Display the \"next\" and \"prev\" buttons.",
     "touch": "Provide a custom **left** and **right** function when swiped left or right.",
-    "transitionDuration": "Overrides transition duration. Does not work in firefox, safari <18, or with `prefers-reduced-motion: reduce`.",
+    "transitionDuration": "Overrides transition duration. Ignored with `prefers-reduced-motion: reduce`.",
     "verticalArrows": "Displays the navigation arrows vertically instead of horizontally."
   },
   "slots": {
```

**File**: `packages/vuetify/src/components/VWindow/VWindow.sass` (modified, +0/-4)
```diff
@@ -79,10 +79,6 @@
       > .v-window-item
         mix-blend-mode: $window-crossfade-blend-mode
 
-@include tools.layer('overrides')
-  .v-window-item
-    transition-duration: var(--v-window-transition-duration, revert-layer)
-
 @include tools.layer('transitions')
   .v-window
     &-x-transition,
```

**File**: `packages/vuetify/src/components/VWindow/VWindow.tsx` (modified, +3/-8)
```diff
@@ -37,6 +37,7 @@ type WindowProvide = {
   transition: ComputedRef<undefined | string>
   transitionCount: Ref<number>
   transitionHeight: Ref<undefined | string>
+  transitionDuration: Readonly<Ref<undefined | string>>
   isReversed: Ref<boolean>
   rootRef: Ref<HTMLElement | undefined>
 }
@@ -192,6 +193,7 @@ export const VWindow = genericComponent<new <T>(
       isReversed,
       transitionCount,
       transitionHeight,
+      transitionDuration: toRef(() => PREFERS_REDUCED_MOTION() ? undefined : convertToUnit(props.transitionDuration, 'ms')),
       rootRef,
     })
 
@@ -305,14 +307,7 @@ export const VWindow = genericComponent<new <T>(
           themeClasses.value,
           props.class,
         ]}
-        style={[
-          props.style,
-          {
-            '--v-window-transition-duration': !PREFERS_REDUCED_MOTION()
-              ? convertToUnit(props.transitionDuration, 'ms')
-              : null,
-          },
-        ]}
+        style={ props.style }
         v-touch={ touchOptions.value }
       >
         <div
```

**File**: `packages/vuetify/src/components/VWindow/VWindowItem.tsx` (modified, +1/-1)
```diff
@@ -135,7 +135,7 @@ export const VWindowItem = genericComponent()({
             groupItem.selectedClass.value,
             props.class,
           ]}
-          style={ props.style }
+          style={[{ transitionDuration: window.transitionDuration.value }, props.style]}
           v-show={ groupItem.isSelected.value }
         >
           { hasContent.value && slots.default?.() }
```

---

### Incident Patch 3: `e19e47c0` (2026-10-02)
**Commit Message**: fix(VCarousel,VWindow): correctly handle left/right arrows with RTL

**File**: `packages/vuetify/src/components/VCarousel/VCarousel.tsx` (modified, +6/-3)
```diff
@@ -10,7 +10,7 @@ import { makeVWindowProps, VWindow } from '@/components/VWindow/VWindow'
 // Composables
 import { injectNestedDefaults } from '@/composables/defaults'
 import { IconValue } from '@/composables/icons'
-import { useLocale } from '@/composables/locale'
+import { useLocale, useRtl } from '@/composables/locale'
 import { useProxiedModel } from '@/composables/proxiedModel'
 
 // Utilities
@@ -80,6 +80,7 @@ export const VCarousel = genericComponent<new <T>(
   setup (props, { slots }) {
     const model = useProxiedModel(props, 'modelValue')
     const { t } = useLocale()
+    const { isRtl } = useRtl()
     const windowRef = ref<VWindow>()
     const delimiterDefaults = injectNestedDefaults<VBtn['$props']>('VBtn')
 
@@ -108,8 +109,10 @@ export const VCarousel = genericComponent<new <T>(
     }
 
     function onDelimiterKeyDown (e: KeyboardEvent, group: GroupProvide) {
+      const [backKey, forwardKey] = isRtl.value ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight']
+
       if (
-        (props.direction === 'horizontal' && e.key === 'ArrowLeft') ||
+        (props.direction === 'horizontal' && e.key === backKey) ||
         (props.direction === 'vertical' && e.key === 'ArrowUp')
       ) {
         e.preventDefault()
@@ -118,7 +121,7 @@ export const VCarousel = genericComponent<new <T>(
       }
 
       if (
-        (props.direction === 'horizontal' && e.key === 'ArrowRight') ||
+        (props.direction === 'horizontal' && e.key === forwardKey) ||
         (props.direction === 'vertical' && e.key === 'ArrowDown')
       ) {
         e.preventDefault()
```

**File**: `packages/vuetify/src/components/VWindow/VWindow.tsx` (modified, +4/-2)
```diff
@@ -262,8 +262,10 @@ export const VWindow = genericComponent<new <T>(
     })
 
     function onKeyDown (e: KeyboardEvent) {
+      const [backKey, forwardKey] = isRtl.value ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight']
+
       if (
-        (props.direction === 'horizontal' && e.key === 'ArrowLeft') ||
+        (props.direction === 'horizontal' && e.key === backKey) ||
         (props.direction === 'vertical' && e.key === 'ArrowUp')
       ) {
         e.preventDefault()
@@ -272,7 +274,7 @@ export const VWindow = genericComponent<new <T>(
       }
 
       if (
-        (props.direction === 'horizontal' && e.key === 'ArrowRight') ||
+        (props.direction === 'horizontal' && e.key === forwardKey) ||
         (props.direction === 'vertical' && e.key === 'ArrowDown')
       ) {
         e.preventDefault()
```

---

### Incident Patch 4: `bc18060d` (2026-10-02)
**Commit Message**: fix(VCarousel): do not swap order for RTL and vertical

**File**: `packages/vuetify/src/components/VWindow/VWindow.sass` (modified, +6/-0)
```diff
@@ -59,9 +59,15 @@
         &--left
           align-items: start
 
+          @include tools.rtl()
+            align-items: end
+
         &--right
           align-items: end
 
+          @include tools.rtl()
+            align-items: start
+
         .v-window__left,
         .v-window__right
           .v-icon
```

**File**: `packages/vuetify/src/components/VWindow/VWindow.tsx` (modified, +4/-3)
```diff
@@ -128,7 +128,8 @@ export const VWindow = genericComponent<new <T>(
       }
 
       const axis = props.direction === 'vertical' ? 'y' : 'x'
-      const reverse = isRtlReverse.value ? !isReversed.value : isReversed.value
+      const isAxisReversed = props.direction === 'vertical' ? props.reverse : isRtlReverse.value
+      const reverse = isAxisReversed ? !isReversed.value : isReversed.value
       const direction = reverse ? '-reverse' : ''
 
       return `v-window-${axis}${direction}-transition`
@@ -209,7 +210,7 @@ export const VWindow = genericComponent<new <T>(
       const arrows = []
 
       const prevProps = {
-        icon: isRtl.value ? props.nextIcon : props.prevIcon,
+        icon: isRtl.value && !props.verticalArrows ? props.nextIcon : props.prevIcon,
         class: `v-window__${isRtlReverse.value ? 'right' : 'left'}`,
         onClick: group.prev,
         'aria-label': t('$vuetify.carousel.prev'),
@@ -223,7 +224,7 @@ export const VWindow = genericComponent<new <T>(
       )
 
       const nextProps = {
-        icon: isRtl.value ? props.prevIcon : props.nextIcon,
+        icon: isRtl.value && !props.verticalArrows ? props.prevIcon : props.nextIcon,
         class: `v-window__${isRtlReverse.value ? 'left' : 'right'}`,
         onClick: group.next,
         'aria-label': t('$vuetify.carousel.next'),
```

---

### Incident Patch 5: `fc19d63f` (2026-10-01)
**Commit Message**: fix(VOverlay): avoid memory leak when unmounting immediately

fixes #23176

**File**: `packages/vuetify/src/composables/router.tsx` (modified, +4/-0)
```diff
@@ -127,11 +127,14 @@ export const makeRouterProps = propsFactory({
 let inTransition = false
 export function useBackButton (router: Router | undefined, cb: () => NavigationGuardReturn) {
   let popped = false
+  let disposed = false
   let removeBefore: (() => void) | undefined
   let removeAfter: (() => void) | undefined
 
   if (IN_BROWSER && router?.beforeEach) {
     nextTick(() => {
+      if (disposed) return
+
       window.addEventListener('popstate', onPopstate)
       removeBefore = router.beforeEach(() => {
         if (!inTransition) {
@@ -147,6 +150,7 @@ export function useBackButton (router: Router | undefined, cb: () => NavigationG
       })
     })
     onScopeDispose(() => {
+      disposed = true
       window.removeEventListener('popstate', onPopstate)
       removeBefore?.()
       removeAfter?.()
```

---

### Incident Patch 6: `af799666` (2026-09-30)
**Commit Message**: fix(VProgressLinear): split buffer bar when value is at 0

**File**: `packages/vuetify/src/components/VProgressLinear/chunks.ts` (modified, +14/-8)
```diff
@@ -78,24 +78,30 @@ export function useChunks (
     const position = toValue(reversed) ? 'right' : 'left'
 
     const val = toValue(value)
-    if (val <= 0 || val >= 100) return undefined
+    if (val >= 100) return undefined
 
     const buffer = toValue(bufferValue)
-    const split = convertToUnit(val, '%')
+    const hasBar = val > 0
     const hasBuffer = buffer > val && buffer < 100
+    if (!hasBar && !hasBuffer) return undefined
+
+    const split = convertToUnit(val, '%')
     const bufferSplit = convertToUnit(buffer, '%')
+    const edge = hasBuffer ? bufferSplit : split
 
     return {
-      bar: {
+      bar: hasBar ? {
         width: `calc(${split} - ${halfGap})`,
-      },
+      } : undefined,
       buffer: hasBuffer ? {
-        [position]: `calc(${split} + ${halfGap})`,
-        width: `calc(${bufferSplit} - ${split} - ${convertToUnit(chunkGap.value)})`,
+        [position]: hasBar ? `calc(${split} + ${halfGap})` : 0,
+        width: hasBar
+          ? `calc(${bufferSplit} - ${split} - ${convertToUnit(chunkGap.value)})`
+          : `calc(${bufferSplit} - ${halfGap})`,
       } : undefined,
       background: {
-        [position]: `calc(${hasBuffer ? bufferSplit : split} + ${halfGap})`,
-        width: `calc(100% - ${hasBuffer ? bufferSplit : split} - ${halfGap})`,
+        [position]: `calc(${edge} + ${halfGap})`,
+        width: `calc(100% - ${edge} - ${halfGap})`,
       },
     }
   })
```

---

### Incident Patch 7: `4b1919e5` (2026-09-29)
**Commit Message**: fix(VTimeline): isolate styles from nested timelines (#23228)

fixes #21426

**File**: `packages/vuetify/src/components/VTimeline/VTimeline.sass` (modified, +178/-154)
```diff
@@ -29,37 +29,37 @@
     grid-auto-flow: dense
     position: relative
 
-    @include horizontal(true)
+    @include horizontal
       grid-column-gap: $timeline-item-padding
       width: 100%
 
       .v-timeline--side-end > .v-timeline-item,
       &:not(.v-timeline--side-start) > .v-timeline-item--side-end,
       &:not(.v-timeline--side-start) > .v-timeline-item:nth-child(2n+1):not(.v-timeline-item--side-start)
-        .v-timeline-item__body
+        > .v-timeline-item__body
           grid-row: 3
           align-self: flex-start
           padding-block-start: $timeline-item-padding
 
-        .v-timeline-item__opposite
+        > .v-timeline-item__opposite
           grid-row: 1
           align-self: flex-end
           padding-block-end: $timeline-item-padding
 
       .v-timeline--side-start > .v-timeline-item,
       &:not(.v-timeline--side-end) > .v-timeline-item--side-start,
       &:not(.v-timeline--side-end) > .v-timeline-item:nth-child(2n):not(.v-timeline-item--side-end)
-        .v-timeline-item__body
+        > .v-timeline-item__body
           grid-row: 1
           align-self: flex-end
           padding-block-end: $timeline-item-padding
 
-        .v-timeline-item__opposite
+        > .v-timeline-item__opposite
           grid-row: 3
           align-self: flex-start
           padding-block-start: $timeline-item-padding
 
-    @include vertical(true)
+    @include vertical
       row-gap: $timeline-item-padding
       height: 100%
 
@@ -72,25 +72,25 @@
       .v-timeline--side-start > .v-timeline-item,
       &:not(.v-timeline--side-end) > .v-timeline-item--side-start,
       &:not(.v-timeline--side-end) > .v-timeline-item:nth-child(2n):not(.v-timeline-item--side-end)
-        .v-timeline-item__body
+        > .v-timeline-item__body
           grid-column: 1
           justify-self: flex-end
           padding-inline-end: $timeline-item-padding
 
-        .v-timeline-item__opposite
+        > .v-timeline-item__opposite
           grid-column: 3
           justify-self: flex-start
           padding-inline-start: $timeline-item-padding
 
       .v-timeline--side-end > .v-timeline-item,
       &:not(.v-timeline--side-start) > .v-timeline-item--side-end,
       &:not(.v-timeline--side-start) > .v-timeline-item:nth-child(2n+1):not(.v-timeline-item--side-start)
-        .v-timeline-item__body
+        > .v-timeline-item__body
           grid-column: 3
           justify-self: flex-start
           padding-inline-start: $timeline-item-padding
 
-        .v-timeline-item__opposite
+        > .v-timeline-item__opposite
           grid-column: 1
           justify-self: flex-end
           padding-inline-end: $timeline-item-padding
@@ -105,15 +105,19 @@
     display: flex
     align-items: center
 
-    @include horizontal
-      flex-direction: row
-      grid-row: 2
-      width: 100%
+  .v-timeline--horizontal
+    > :where(.v-timeline-item)
+      > .v-timeline-divider
+        flex-direction: row
+        grid-row: 2
+        width: 100%
 
-    @include vertical
-      height: 100%
-      flex-direction: column
-      grid-column: 2
+  .v-timeline--vertical
+    > :where(.v-timeline-item)
+      > .v-timeline-divider
+        height: 100%
+        flex-direction: column
+        grid-column: 2
 
   $timeline-line-size: calc(var(--v-timeline-line-size-base) + #{math.div($timeline-item-padding, 2)} - var(--v-timeline-line-inset))
   $timeline-line-start: math.div(-$timeline-item-padding, 2)
@@ -123,80 +127,90 @@
     background: $timeline-divider-line-background
     position: absolute
 
-    @include horizontal
-      height: $timeline-divider-line-thickness
-      width: $timeline-line-size
-      inset-inline-start: $timeline-line-start
-      inset-inline-end: initial
-
-    @include vertical
-      height: $timeline-line-size
-      width: $timeline-divider-line-thickness
-      top: $timeline-line-start
-
     @media (forced-colors: active)
       background: canvastext
 
   .v-timeline-divider__after
     background: $timeline-divider-line-background
     position: absolute
 
-    @include horizontal
-      height: $timeline-divider-line-thickness
-      width: $timeline-line-size
-      inset-inline-end: $timeline-line-start
-      inset-inline-start: initial
-
-    @include vertical
-      height: $timeline-line-size
-      width: $timeline-divider-line-thickness
-      bottom: $timeline-line-start
-
     @media (forced-colors: active)
       background: canvastext
 
-  .v-timeline-item:first-child
-    .v-timeline-divider__before
-      @include vertical
-        height: $timeline-line-size
-        top: 0
-
-      @include horizontal
-        width: $timeline-line-size
-        inset-inline-start: 0
-        inset-inline-end: initial
-
-    .v-timeline-divider__after
-      @include vertical
-        height: $timeline-line-size-first-last
-
-      @include horizontal
-        width: $timeline-line-size-first-last
-        inset-inline-end: $timeline-line-start
-        inset-in
```

**File**: `packages/vuetify/src/components/VTimeline/_mixins.sass` (modified, +8/-18)
```diff
@@ -1,27 +1,17 @@
-@mixin vertical($immediate: false)
-  $selector: '.v-timeline--vertical'
-  @if $immediate
-    $selector: '#{$selector}#{&}'
-  @else
-    $selector: '#{$selector} #{&}'
-  @at-root #{$selector}
+@mixin vertical()
+  @at-root .v-timeline--vertical#{&}
     @content
 
-@mixin horizontal($immediate: false)
-  $selector: '.v-timeline--horizontal'
-  @if $immediate
-    $selector: '#{$selector}#{&}'
-  @else
-    $selector: '#{$selector} #{&}'
-  @at-root #{$selector}
+@mixin horizontal()
+  @at-root .v-timeline--horizontal#{&}
     @content
 
 @mixin timeline-first-item()
-  .v-timeline-item:first-child
-    .v-timeline-divider, .v-timeline-item__body, .v-timeline-item__opposite
+  > .v-timeline-item:first-child
+    > .v-timeline-divider, > .v-timeline-item__body, > .v-timeline-item__opposite
       @content
 
 @mixin timeline-last-item()
-  .v-timeline-item:last-child
-    .v-timeline-divider, .v-timeline-item__body, .v-timeline-item__opposite
+  > .v-timeline-item:last-child
+    > .v-timeline-divider, > .v-timeline-item__body, > .v-timeline-item__opposite
       @content
```

---

### Incident Patch 8: `17c9f8da` (2026-09-29)
**Commit Message**: fix(VExpansionPanels): don't apply rounded-0 when rounded is not set

**File**: `packages/vuetify/src/components/VExpansionPanel/VExpansionPanels.tsx` (modified, +4/-1)
```diff
@@ -38,7 +38,10 @@ export const makeVExpansionPanelsProps = propsFactory({
   flat: Boolean,
   gap: [String, Number],
   noDivider: Boolean,
-  rounded: [Boolean, Number, String, Array] as PropType<boolean | number | string | (number | string)[]>,
+  rounded: {
+    type: [Boolean, Number, String, Array] as PropType<boolean | number | string | (number | string)[]>,
+    default: undefined,
+  },
 
   ...makeGroupProps(),
   ...pick(makeVExpansionPanelProps(), [
```

---

### Incident Patch 9: `61719f9d` (2026-09-27)
**Commit Message**: fix(VOtpInput): keep caret and active slot in sync during composition

Track the selection during non-IME composition, write it to the input
only once the composition ends.

Some mobile keyboards send latin letters with a composition. Accepting the letters mid-composition used to restart the composition and the
caret position was back at 0, so typing "abcd" results in "dcba"

fixes #23221

**File**: `packages/vuetify/src/components/VOtpInput/VOtpInput.tsx` (modified, +2/-1)
```diff
@@ -151,7 +151,7 @@ export const VOtpInput = genericComponent<VOtpInputSlots>()({
         // Slot count, not `input.maxLength` (code units).
         maxLength: length.value,
       })
-      if (!result) return
+      if (!result || otp.isComposing.value) return
       if (input.selectionStart !== result.start || input.selectionEnd !== result.end) {
         input.setSelectionRange(result.start, result.end, result.direction)
       }
@@ -183,6 +183,7 @@ export const VOtpInput = genericComponent<VOtpInputSlots>()({
     function onCompositionend (e: CompositionEvent) {
       otp.endComposition()
       onInput(e)
+      onSelectionChange()
     }
 
     function onFocus () {
```

**File**: `packages/vuetify/src/components/VOtpInput/__tests__/VOtpInput.spec.browser.tsx` (modified, +24/-0)
```diff
@@ -451,6 +451,30 @@ describe('VOtpInput', () => {
     expect(getActiveSlotIndex()).toBe(5)
   })
 
+  it('advances while a latin word stays in composition', async () => {
+    render(() => (<VOtpInput type="text" />))
+    const input = getInput()
+
+    await focusInput()
+    input.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
+    for (const word of ['a', 'ab', 'abc', 'abcd']) {
+      input.dispatchEvent(new CompositionEvent('compositionupdate', { data: word }))
+      input.value = word
+      input.setSelectionRange(word.length, word.length)
+      input.dispatchEvent(new InputEvent('input', { data: word, inputType: 'insertCompositionText', isComposing: true }))
+      input.dispatchEvent(new Event('selectionchange'))
+      await waitAnimationFrame()
+
+      expect(input.selectionStart).toBe(word.length)
+      expect(getActiveSlotIndex()).toBe(word.length)
+    }
+    input.dispatchEvent(new CompositionEvent('compositionend', { data: 'abcd' }))
+    await waitAnimationFrame()
+
+    expect(input.value).toBe('abcd')
+    expect(getActiveSlotIndex()).toBe(4)
+  })
+
   it('selects correct slot when clicking a filled slot', async () => {
     render(() => (<VOtpInput />))
     const input = getInput()
```

**File**: `packages/vuetify/src/components/VOtpInput/useOtpInput.ts` (modified, +1/-1)
```diff
@@ -359,7 +359,7 @@ export function useOtpInput (options: OtpInputOptions): OtpInputContext {
   // Force the rendered selection to always cover at least one slot, so a slot
   // stays "active" when a caret would otherwise be between two.
   function syncSelection (raw: OtpSelectionInput): OtpSelection | null {
-    if (isComposing.value) return selection.value
+    if (composition.value) return selection.value
 
     const { value: inputValue, selectionStart, selectionEnd, selectionDirection, maxLength } = raw
 
```

---

### Incident Patch 10: `29335230` (2026-09-24)
**Commit Message**: fix(VDataTable/VDataIterator): emit `update:options` once when searching

**File**: `packages/vuetify/src/components/VDataTable/__tests__/VDataTableServer.spec.browser.tsx` (modified, +1/-2)
```diff
@@ -235,7 +235,7 @@ describe('VDataTableServer', () => {
     ])
   })
 
-  it.skip('should only trigger update event once when search changes', async () => {
+  it('should only trigger update event once when search changes', async () => {
     const optionsEmits: any[] = []
     const items = ref<any[]>([])
     const search = ref('')
@@ -279,7 +279,6 @@ describe('VDataTableServer', () => {
     expect(optionsEmits).toEqual([
       { page: 1, itemsPerPage: 2, sortBy: [], groupBy: [], search: '' },
       { page: 2, itemsPerPage: 2, sortBy: [], groupBy: [], search: '' },
-      // { page: 2, itemsPerPage: 2, sortBy: [], groupBy: [], search: 'frozen' },
       { page: 1, itemsPerPage: 2, sortBy: [], groupBy: [], search: 'frozen' },
     ])
   })
```

**File**: `packages/vuetify/src/components/VDataTable/composables/options.ts` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ export function useOptions ({
     // Reset page when searching
     if (oldOptions && oldOptions.search !== value.search) {
       page.value = 1
+      value.page = 1
     }
 
     vm.emit('update:options', value)
```

---

### Incident Patch 11: `3d26868c` (2026-09-24)
**Commit Message**: fix(VIcon/VBadge/VBottomNavigation): respect theme prop

fixes #23211

**File**: `packages/vuetify/src/components/VBadge/VBadge.tsx` (modified, +14/-7)
```diff
@@ -3,6 +3,7 @@ import './VBadge.sass'
 
 // Components
 import { VIcon } from '@/components/VIcon'
+import { VThemeProvider } from '@/components/VThemeProvider'
 
 // Composables
 import { useBackgroundColor, useTextColor } from '@/composables/color'
@@ -17,6 +18,7 @@ import { makeThemeProps, useTheme } from '@/composables/theme'
 import { makeTransitionProps, MaybeTransition } from '@/composables/transition'
 
 // Utilities
+import { toRef } from 'vue'
 import { convertToUnit, genericComponent, pickWithRest, propsFactory, useRender } from '@/util'
 
 export type VBadgeSlots = {
@@ -67,7 +69,10 @@ export const VBadge = genericComponent<VBadgeSlots>()({
     const { roundedClasses, roundedStyles } = useRounded(props)
     const { t } = useLocale()
     const { textColorClasses, textColorStyles } = useTextColor(() => props.textColor)
-    const { themeClasses } = useTheme()
+
+    const theme = useTheme()
+    // use props.theme and fallback to inherited
+    const themeClasses = toRef(() => theme.isDisabled ? undefined : `${theme.prefix}theme--${props.theme ?? theme.name.value}`)
 
     const { locationStyles } = useLocation(props, true, side => {
       const base = props.floating
@@ -142,12 +147,14 @@ export const VBadge = genericComponent<VBadgeSlots>()({
                 role="status"
                 { ...badgeAttrs }
               >
-                {
-                  props.dot ? undefined
-                  : ctx.slots.badge ? ctx.slots.badge?.()
-                  : props.icon ? <VIcon icon={ props.icon } />
-                  : content
-                }
+                <VThemeProvider theme={ props.theme }>
+                  {
+                    props.dot ? undefined
+                    : ctx.slots.badge ? ctx.slots.badge?.()
+                    : props.icon ? <VIcon icon={ props.icon } />
+                    : content
+                  }
+                </VThemeProvider>
               </span>
             </MaybeTransition>
           </div>
```

**File**: `packages/vuetify/src/components/VBottomNavigation/VBottomNavigation.tsx` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ import { useProxiedModel } from '@/composables/proxiedModel'
 import { makeRoundedProps, useRounded } from '@/composables/rounded'
 import { useSsrBoot } from '@/composables/ssrBoot'
 import { makeTagProps } from '@/composables/tag'
-import { makeThemeProps, useTheme } from '@/composables/theme'
+import { makeThemeProps, provideTheme } from '@/composables/theme'
 
 // Utilities
 import { computed, toRef } from 'vue'
@@ -72,7 +72,7 @@ export const VBottomNavigation = genericComponent<new <T>(
   },
 
   setup (props, { slots }) {
-    const { themeClasses } = useTheme()
+    const { themeClasses } = provideTheme(props)
     const { borderClasses } = useBorder(props)
     const { backgroundColorClasses, backgroundColorStyles } = useBackgroundColor(() => props.bgColor)
     const { densityClasses } = useDensity(props)
```

**File**: `packages/vuetify/src/components/VIcon/VIcon.tsx` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ import { makeComponentProps } from '@/composables/component'
 import { IconValue, useIcon } from '@/composables/icons'
 import { makeSizeProps, useSize } from '@/composables/size'
 import { makeTagProps } from '@/composables/tag'
-import { makeThemeProps, useTheme } from '@/composables/theme'
+import { makeThemeProps, provideTheme } from '@/composables/theme'
 
 // Utilities
 import { shallowRef, Text } from 'vue'
@@ -35,7 +35,7 @@ export const VIcon = genericComponent()({
   setup (props, { attrs, slots }) {
     const slotIcon = shallowRef<string>()
 
-    const { themeClasses } = useTheme()
+    const { themeClasses } = provideTheme(props)
     const { iconData } = useIcon(() => slotIcon.value || props.icon)
     const { sizeClasses } = useSize(props)
     const { textColorClasses, textColorStyles } = useTextColor(() => props.color)
```

---

### Incident Patch 12: `8bba814f` (2026-09-23)
**Commit Message**: docs(styles): recommend layers.css linked in <head> to force the expected order (#23205)

fixes #23135

**File**: `packages/docs/src/pages/en/features/css-utilities/overview.md` (modified, +13/-7)
```diff
@@ -83,11 +83,12 @@ vite-tailwindcss/
 │   │   ├── index.ts
 │   │   └── vuetify.ts              # Vuetify configuration entrypoint
 │   ├── styles/
-│   │   ├── layers.css              # cascade layer order
 │   │   ├── settings.scss           # disables Vuetify's built-in utilities
 │   │   └── tailwind.css            # breakpoints, dark/light variants
 │   ├── App.vue
 │   └── main.ts                     # loads Tailwind stylesheet
+├── public/
+│   └── layers.css                  # cascade layer order, linked first
 ├── index.html
 ├── package.json
 └── vite.config.mts                 # registers Tailwind CSS Vite plugin
@@ -101,10 +102,11 @@ vite-unocss-vuetify/
 │   ├── plugins/
 │   │   └── vuetify.ts              # Vuetify configuration entrypoint
 │   ├── styles/
-│   │   ├── layers.css              # cascade layer order
 │   │   └── settings.scss           # disables Vuetify's built-in utilities
 │   ├── App.vue
 │   └── main.ts                     # loads UnoCSS generated styles
+├── public/
+│   └── layers.css                  # cascade layer order, linked first
 ├── index.html
 ├── package.json
 ├── uno.config.ts                   # Vuetify preset and layer mapping
@@ -119,12 +121,13 @@ vite-unocss-wind4/
 │   ├── plugins/
 │   │   └── vuetify.ts              # Vuetify configuration entrypoint
 │   ├── styles/
-│   │   ├── layers.css              # cascade layer order
 │   │   └── settings.scss           # disables Vuetify's built-in utilities
 │   ├── theme/
 │   │   └── breakpoints.ts          # shared breakpoints for Vuetify and UnoCSS
 │   ├── App.vue
 │   └── main.ts                     # loads UnoCSS generated styles
+├── public/
+│   └── layers.css                  # cascade layer order, linked first
 ├── index.html
 ├── package.json
 ├── uno.config.ts                   # Wind4 preset, dark mode, breakpoints
@@ -136,15 +139,16 @@ nuxt-tailwindcss/
 ├── app/
 │   ├── assets/
 │   │   └── styles/
-│   │       ├── layers.css          # cascade layer order
 │   │       ├── settings.scss       # disables Vuetify's built-in utilities
 │   │       └── tailwind.css        # breakpoints, dark/light variants
 │   ├── components/
 │   │   └── HelloWorld.vue
 │   ├── pages/
 │   │   └── index.vue
 │   └── app.vue
-├── nuxt.config.ts                  # modules and style load order
+├── public/
+│   └── layers.css                  # cascade layer order, linked first
+├── nuxt.config.ts                  # modules and layers.css link
 └── package.json
 ```
 
@@ -153,13 +157,14 @@ nuxt-unocss-vuetify/
 ├── app/
 │   ├── assets/
 │   │   └── styles/
-│   │       ├── layers.css          # cascade layer order
 │   │       └── settings.scss       # disables Vuetify's built-in utilities
 │   ├── components/
 │   │   └── HelloWorld.vue
 │   ├── pages/
 │   │   └── index.vue
 │   └── app.vue
+├── public/
+│   └── layers.css                  # cascade layer order, linked first
 ├── nuxt.config.ts                  # modules, style order, Vuetify preset
 └── package.json
 ```
@@ -169,7 +174,6 @@ nuxt-unocss-wind4/
 ├── app/
 │   ├── assets/
 │   │   └── styles/
-│   │       ├── layers.css          # cascade layer order
 │   │       └── settings.scss       # disables Vuetify's built-in utilities
 │   ├── components/
 │   │   └── HelloWorld.vue
@@ -178,6 +182,8 @@ nuxt-unocss-wind4/
 │   ├── theme/
 │   │   └── breakpoints.ts          # shared breakpoints for Vuetify and UnoCSS
 │   └── app.vue
+├── public/
+│   └── layers.css                  # cascade layer order, linked first
 ├── nuxt.config.ts                  # modules, style order, Wind4 preset
 └── package.json
 ```
```

**File**: `packages/docs/src/pages/en/features/css-utilities/tailwindcss.md` (modified, +13/-10)
```diff
@@ -62,18 +62,16 @@ Create a `layers.css` file that declares the cascade layers in order. `tailwind`
 @layer vuetify-final;
 ```
 
-This file must be loaded **before** any other styles. In a **Vite** project, save it as `src/styles/layers.css` and import it at the top of `src/plugins/vuetify.ts`, before `vuetify/styles`. You can find the exact configuration snippets in the sections for Vite and Nuxt below.
+Save it as `public/layers.css` and link it instead of importing it (see [Custom layer order](/styles/layers/#custom-layer-order)).
 
 ## Setup dependencies
 
 ### Vite
 
-Import the layers file at the top of `src/plugins/vuetify.ts`, before `vuetify/styles`:
+Link the layers file in `index.html`, before any other stylesheet:
 
-```ts { resource="src/plugins/vuetify.ts" }
-import '../styles/layers.css'
-import 'vuetify/styles'
-// ...
+```html { resource="index.html" }
+<link rel="stylesheet" href="/layers.css">
 ```
 
 Install TailwindCSS and the Vite plugin:
@@ -139,7 +137,7 @@ bun add -D tailwindcss @tailwindcss/postcss
 
 :::
 
-Register `@tailwindcss/postcss` as a PostCSS plugin in `nuxt.config.ts`. The `css` array controls load order — `layers.css` must come first, followed by `vuetify/styles`, then `tailwind.css`. Set `disableVuetifyStyles: true` — otherwise the module injects styles automatically and the order above is ignored:
+Register `@tailwindcss/postcss` as a PostCSS plugin in `nuxt.config.ts`. Link the layers file in `app.head` and add `tailwind.css` to the `css` array:
 
 ```ts { resource="nuxt.config.ts" }
 export default defineNuxtConfig({
@@ -148,9 +146,15 @@ export default defineNuxtConfig({
     // ...
   ],
 
+  app: {
+    head: {
+      link: [
+        { rel: 'stylesheet', href: '/layers.css' },
+      ],
+    },
+  },
+
   css: [
-    'assets/styles/layers.css',
-    'vuetify/styles',
     'assets/styles/tailwind.css',
   ],
 
@@ -162,7 +166,6 @@ export default defineNuxtConfig({
 
   vuetify: {
     moduleOptions: {
-      disableVuetifyStyles: true,
       styles: { configFile: 'assets/styles/settings.scss' },
     },
   },
```

**File**: `packages/docs/src/pages/en/features/css-utilities/unocss-tailwind-preset.md` (modified, +12/-12)
```diff
@@ -65,18 +65,16 @@ Create a `layers.css` file that declares the cascade layers in order. `uno` goes
 @layer vuetify-final;
 ```
 
-This file must be loaded **before** any other styles. In a **Vite** project, save it as `src/styles/layers.css` and import it at the top of `src/plugins/vuetify.ts`, before `vuetify/styles`.
+Save it as `public/layers.css` and link it instead of importing it (see [Custom layer order](/styles/layers/#custom-layer-order)).
 
 ## Setup dependencies
 
 ### Vite
 
-Import the layers file at the top of `src/plugins/vuetify.ts`, before `vuetify/styles`:
+Link the layers file in `index.html`, before any other stylesheet:
 
-```ts { resource="src/plugins/vuetify.ts" }
-import '../styles/layers.css'
-import 'vuetify/styles'
-// ...
+```html { resource="index.html" }
+<link rel="stylesheet" href="/layers.css">
 ```
 
 Install UnoCSS and the Wind4 preset:
@@ -158,7 +156,7 @@ bun add -D unocss @unocss/preset-wind4 @unocss/nuxt
 
 :::
 
-Register the module in `nuxt.config.ts`. The `css` array controls load order — `layers.css` must come first, followed by `vuetify/styles`. Set `disableVuetifyStyles: true` — otherwise the module injects styles automatically and the order above is ignored:
+Register the module in `nuxt.config.ts` and link the layers file in `app.head`:
 
 ```ts { resource="nuxt.config.ts" }
 import presetWind4 from '@unocss/preset-wind4'
@@ -170,14 +168,16 @@ export default defineNuxtConfig({
     // ...
   ],
 
-  css: [
-    'assets/styles/layers.css',
-    'vuetify/styles',
-  ],
+  app: {
+    head: {
+      link: [
+        { rel: 'stylesheet', href: '/layers.css' },
+      ],
+    },
+  },
 
   vuetify: {
     moduleOptions: {
-      disableVuetifyStyles: true,
       styles: { configFile: 'assets/styles/settings.scss' },
     },
   },
```

**File**: `packages/docs/src/pages/en/features/css-utilities/unocss-vuetify-preset.md` (modified, +12/-12)
```diff
@@ -59,18 +59,16 @@ Create a `layers.css` file that declares the cascade layers in order. `uno` goes
 @layer vuetify-final;
 ```
 
-This file must be loaded **before** any other styles. In a **Vite** project, save it as `src/styles/layers.css` and import it at the top of `src/plugins/vuetify.ts`, before `vuetify/styles`.
+Save it as `public/layers.css` and link it instead of importing it (see [Custom layer order](/styles/layers/#custom-layer-order)).
 
 ## Setup dependencies
 
 ### Vite
 
-Import the layers file at the top of `src/plugins/vuetify.ts`, before `vuetify/styles`:
+Link the layers file in `index.html`, before any other stylesheet:
 
-```ts { resource="src/plugins/vuetify.ts" }
-import '../styles/layers.css'
-import 'vuetify/styles'
-// ...
+```html { resource="index.html" }
+<link rel="stylesheet" href="/layers.css">
 ```
 
 Install UnoCSS and the Vuetify preset:
@@ -157,7 +155,7 @@ bun add -D unocss unocss-preset-vuetify @unocss/nuxt
 
 :::
 
-Register the module in `nuxt.config.ts`. The `css` array controls load order — `layers.css` must come first, followed by `vuetify/styles`. Set `disableVuetifyStyles: true` — otherwise the module injects styles automatically and the order above is ignored:
+Register the module in `nuxt.config.ts` and link the layers file in `app.head`:
 
 ```ts { resource="nuxt.config.ts" }
 import { presetVuetify } from 'unocss-preset-vuetify'
@@ -169,14 +167,16 @@ export default defineNuxtConfig({
     // ...
   ],
 
-  css: [
-    'assets/styles/layers.css',
-    'vuetify/styles',
-  ],
+  app: {
+    head: {
+      link: [
+        { rel: 'stylesheet', href: '/layers.css' },
+      ],
+    },
+  },
 
   vuetify: {
     moduleOptions: {
-      disableVuetifyStyles: true,
       styles: { configFile: 'assets/styles/settings.scss' },
     },
     vuetifyOptions: {
```

**File**: `packages/docs/src/pages/en/features/sass-variables.md` (modified, +0/-31)
```diff
@@ -254,37 +254,6 @@ Color packs are handy for quickly applying a color to a component but mostly unu
 );
 ```
 
-## Enabling CSS cascade layers
-
-[Cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) are a modern CSS feature that makes it easier to write custom styles without having to deal with specificity issues and `!important`. This will be included by default in Vuetify 4 but can optionally be used now:
-
-```scss { resource="src/styles/settings.scss" }
-@forward 'vuetify/settings' with (
-  $layers: true,
-);
-```
-
-```ts { resource="src/plugins/vuetify.ts" }
-export default createVuetify({
-  theme: {
-    layers: true,
-  },
-})
-```
-
-Import order of stylesheets becomes much more important with layers enabled, `import 'vuetify/styles'` or a file containing `@use 'vuetify'` **must** be loaded *before* any components or the CSS reset will take precedence over component styles and break everything.
-
-- If you have separate plugin files make sure to import vuetify's before `App.vue`.
-- Imports generated by `import.meta.glob(..., { eager: true })` are hoisted, if you use this for components or files that import components it should be in another file separate from any style imports to ensure `vuetify/styles` is always first.
-
-Your own styles will always<sup>*</sup> override vuetify's if you don't use `@layer` yourself, or you can specify an order for custom layers in a stylesheet loaded before vuetify.
-
-```css { resource="src/styles/layers.css" }
-@layer base, vuetify, overrides;
-```
-
-\* Layers invert `!important`, so anything trying to override an important vuetify style must also be in a layer. { class="text-body-small" }
-
 ## Caveats
 
 When using sass variables, there are a few considerations to be aware of.
```

**File**: `packages/docs/src/pages/en/getting-started/upgrade-guide.md` (modified, +9/-14)
```diff
@@ -157,22 +157,11 @@ If you were already using `$layers: true` in Vuetify 3, there are now five top-l
 
 If you had any usages of `@layer vuetify.*` in your styles they should be replaced with your own layer name with an appropriate declaration order.
 
-#### Layer order declaration must come first
-
-The layer order `@layer` statement must be imported **before any layered CSS is parsed** — including Vuetify's own styles. The browser assigns layer priority the first time a layer name appears, so if Vuetify's styles load first, the browser will establish the order from those, not from your declaration.
-
-Import your layer order statement at the very top of your app entrypoint:
-
-```js { resource="src/main.ts" }
-// @layer declaration comes first
-import './styles/layers.css'
-import 'vuetify/styles'
-import { createApp } from 'vue'
-```
+#### Custom layer order
 
 If you intend to migrate large application, it is recommended to define and adopt your own layers, so that developers can drop `!important` and gain more control over the stylesheets.
 
-```css { resource="src/styles/layers.css" }
+```css { resource="public/layers.css" }
 @layer vuetify-core;
 @layer vuetify-components;
 @layer vuetify-overrides;
@@ -187,9 +176,15 @@ If you intend to migrate large application, it is recommended to define and adop
 @layer vuetify-final;
 ```
 
+Link it from `index.html` instead of importing it, as described in [CSS Layers](/styles/layers/#custom-layer-order):
+
+```html { resource="index.html" }
+<link rel="stylesheet" href="/layers.css">
+```
+
 ::: warning
 
-If this import is missing or appears after Vuetify styles, reset styles or earlier-declared layers may unexpectedly override component styles. Symptoms vary per app depending on build output order, making it difficult to diagnose. This is often caused by Vite v8.x and/or `vue-router` v5.x.
+If `layers.css` is missing or bundled, your layers may end up ordered after `vuetify-final` or between the wrong Vuetify layers. Symptoms vary per app depending on build output order, making them difficult to diagnose.
 
 **Note**: using `@vuetify/cli` with `init` command to generate a working project for comparison is usually the fastest way to effectively troubleshoot the problems.
 
```

**File**: `packages/docs/src/pages/en/styles/entry-points.md` (modified, +1/-5)
```diff
@@ -37,10 +37,6 @@ If you are strictly managing bundle size or using a manual build process, you ca
 
 Contains the CSS reset, typography fundamentals, and basic application structure.
 
-::: info
-**Note:** This **must be first** in your import order to ensure the CSS layers have not already been declared elsewhere.
-:::
-
 #### `vuetify/styles/colors`
 
 Includes the Material Design color palette utility classes (e.g., `text-red`, `bg-blue-darken-1`). If you are defining your own theme colors and do not use the standard Material palette classes, you may omit this.
@@ -52,7 +48,7 @@ Contains helper classes for layout and spacing (e.g., `d-flex`, `mt-4`, `pa-2`).
 **Example of modular import:**
 
 ```js { resource="src/plugins/vuetify.js" }
-import 'vuetify/styles/core'      // Reset and structure (Required first)
+import 'vuetify/styles/core'      // Reset and structure (Required)
 import 'vuetify/styles/colors'    // Optional: standard color classes
 import 'vuetify/styles/utilities' // Optional: helper classes
 ```
```

**File**: `packages/docs/src/pages/en/styles/layers.md` (modified, +52/-7)
```diff
@@ -15,8 +15,6 @@ This feature was introduced in [v3.6.0 (Nebula)](/getting-started/release-notes/
 
 [Cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) are a modern CSS feature that makes it easier to write custom styles without having to deal with specificity issues and `!important`.
 
-Import order of stylesheets becomes much more important with layers, therefore `import 'vuetify/styles'` or a file containing `@use 'vuetify'` **must** be loaded *before* any components or the CSS reset will take precedence over component styles and break everything. If you have separate plugin files make sure to import the vuetify plugin before `App.vue` or any other components.
-
 Vuetify defines five layers containing all the framework styles:
 
 ```css
@@ -29,19 +27,66 @@ Vuetify defines five layers containing all the framework styles:
 - utilities: Theme and helper classes such as `.bg-primary` and `.pa-4`.
 - final: Transitions, and rules that must always take priority like `forced-colors`.
 
-Your own styles will always override vuetify's if you don't use `@layer` yourself, or you can specify an order for custom layers in a stylesheet loaded before vuetify. Vuetify's layers must remain in the same order for everything to display correctly, but you can add your own between or around them.
+Your own styles will always override vuetify's if you don't use `@layer` yourself.
+
+## Custom layer order
+
+Vuetify's layers must remain in the same order for everything to display correctly, but you can add your own layers before, between or at the end:
 
-```css { resource="src/styles/layers.css" }
-@layer base,
+```css { resource="public/layers.css" }
+@layer my-base,
   vuetify-core,
   vuetify-components,
-  components,
+  my-components,
   vuetify-overrides,
-  overrides,
+  my-overrides,
   vuetify-utilities,
   vuetify-final;
 ```
 
+Place it in `public/` and link it before any other stylesheet, so the browser reads it before any Vuetify styles:
+
+```html { resource="index.html" }
+<head>
+  <link rel="stylesheet" href="/layers.css">
+  <!-- ... -->
+</head>
+```
+
+In Nuxt, add the link in `nuxt.config.ts`:
+
+```ts { resource="nuxt.config.ts" }
+export default defineNuxtConfig({
+  app: {
+    head: {
+      link: [
+        { rel: 'stylesheet', href: '/layers.css' },
+      ],
+    },
+  },
+})
+```
+
+::: warning
+Avoid plain import of `layers.css` from JavaScript or `@import` from another stylesheet. Bundling process usually does not guarantee the same order of stylesheets shipped in production.
+:::
+
+Vuetify's stylesheets can also load in any order, so declare its nested layers in `layers.css` as well:
+
+```css { resource="public/layers.css" }
+@layer vuetify-core {
+  @layer reset, base;
+}
+@layer vuetify-components;
+@layer vuetify-overrides;
+@layer vuetify-utilities {
+  @layer theme-base, typography, helpers, theme-background, theme-foreground;
+}
+@layer vuetify-final {
+  @layer transitions, trumps;
+}
+```
+
 ## Utilities group
 
 The `vuetify-utilities` layer itself contains nested sublayers to control the order of utility styles:
```

---

### Incident Patch 13: `c8b9d6a1` (2026-09-23)
**Commit Message**: fix(VAutocomplete/VCombobox): prevent menu icon from toggling twice (#23200)

fixes #23197

**File**: `packages/vuetify/src/components/VAutocomplete/VAutocomplete.tsx` (modified, +1/-1)
```diff
@@ -267,8 +267,8 @@ export const VAutocomplete = genericComponent<new <
       if (isFocused.value) {
         e.preventDefault()
         e.stopPropagation()
+        menu.value = !menu.value
       }
-      menu.value = !menu.value
     }
     function onMenuKeydown (e: KeyboardEvent) {
       if (e.key === 'Tab') {
```

**File**: `packages/vuetify/src/components/VCombobox/VCombobox.tsx` (modified, +1/-1)
```diff
@@ -328,8 +328,8 @@ export const VCombobox = genericComponent<new <
       if (isFocused.value) {
         e.preventDefault()
         e.stopPropagation()
+        menu.value = !menu.value
       }
-      menu.value = !menu.value
     }
     function onMenuKeydown (e: KeyboardEvent) {
       if (e.key === 'Tab') {
```

---

### Incident Patch 14: `b6c9f5c9` (2026-09-23)
**Commit Message**: fix(VSelect): match autofill against item values (#23063)

Co-authored-by: J-Sek <[REDACTED_EMAIL]>

fixes #20560

**File**: `packages/vuetify/src/components/VAutocomplete/VAutocomplete.tsx` (modified, +7/-8)
```diff
@@ -18,6 +18,7 @@ import { VVirtualScroll } from '@/components/VVirtualScroll'
 import { VHighlight } from '@/labs/VHighlight'
 
 // Composables
+import { useAutofill } from '../VSelect/useAutofill'
 import { useFocusRepair } from '../VSelect/useFocusRepair'
 import { useScrolling } from '../VSelect/useScrolling'
 import { useSelectionMenu } from '../VSelect/useSelectionMenu'
@@ -43,10 +44,10 @@ import {
   genericComponent,
   getActiveElement,
   IN_BROWSER,
+  isAutofill,
   isComposingIgnoreKey,
   isFunction,
   isNumber,
-  matchesSelector,
   noop,
   omit,
   propsFactory,
@@ -150,6 +151,7 @@ export const VAutocomplete = genericComponent<new <
     const selectionIndex = shallowRef(-1)
     const _searchLock = shallowRef<string | null>(null)
     const { items, transformIn, transformOut } = useItems(props)
+    const { autofill, resetAutofill } = useAutofill(items, item => select(item))
     const { textColorClasses, textColorStyles } = useTextColor(() => vTextFieldRef.value?.color)
     const { InputIcon } = useInputIcon(props)
     const search = useProxiedModel(props, 'search', '')
@@ -375,12 +377,7 @@ export const VAutocomplete = genericComponent<new <
     }
 
     function onChange (e: Event) {
-      if (matchesSelector(vTextFieldRef.value, ':autofill') || matchesSelector(vTextFieldRef.value, ':-webkit-autofill')) {
-        const item = items.value.find(item => item.title === (e.target as HTMLInputElement).value)
-        if (item) {
-          select(item)
-        }
-      }
+      if (isAutofill(e)) autofill((e.target as HTMLInputElement).value)
     }
 
     function getSelectedIndex () {
@@ -499,6 +496,7 @@ export const VAutocomplete = genericComponent<new <
       if (val === oldVal) return
 
       if (val) {
+        resetAutofill()
         isPristine.value = true
       } else {
         if (!props.multiple && search.value == null) {
@@ -576,7 +574,8 @@ export const VAutocomplete = genericComponent<new <
         <VTextField
           ref={ vTextFieldRef }
           { ...textFieldProps }
-          form=""
+          form={ props.autocomplete === 'suppress' ? '' : undefined }
+          name={ props.autocomplete === 'suppress' ? props.name : undefined }
           v-model={ search.value }
           onUpdate:modelValue={ onUpdateModelValue }
           v-model:focused={ isFocused.value }
```

**File**: `packages/vuetify/src/components/VAutocomplete/__tests__/VAutocomplete.spec.browser.tsx` (modified, +24/-0)
```diff
@@ -46,6 +46,30 @@ const stories = Object.fromEntries(Object.entries({
 )]))
 
 describe('VAutocomplete', () => {
+  it.each([
+    [':autofill', 'CA'],
+    [':autofill', 'California'],
+    [':-webkit-autofill', 'CA'],
+    [':-webkit-autofill', 'California'],
+  ])('should match %s text %s against item titles or values', async (selector, value) => {
+    const model = ref()
+
+    render(() => (
+      <VAutocomplete
+        v-model={ model.value }
+        items={[{ title: 'California', value: 'CA' }]}
+      />
+    ))
+
+    const input = screen.getByCSS('input')
+    vi.spyOn(input, 'matches').mockImplementation(candidate => candidate === selector)
+
+    await userEvent.fill(input, value)
+    input.dispatchEvent(new Event('change', { bubbles: true }))
+
+    expect(model.value).toBe('CA')
+  })
+
   it.each([
     ['{Tab}', 'after'],
     ['{Shift>}{Tab}{/Shift}', 'before'],
```

**File**: `packages/vuetify/src/components/VCombobox/VCombobox.tsx` (modified, +2/-1)
```diff
@@ -651,7 +651,8 @@ export const VCombobox = genericComponent<new <
         <VTextField
           ref={ vTextFieldRef }
           { ...textFieldProps }
-          form=""
+          form={ props.autocomplete === 'suppress' ? '' : undefined }
+          name={ props.autocomplete === 'suppress' ? props.name : undefined }
           v-model={ search.value }
           v-model:focused={ isFocused.value }
           validationValue={ model.externalValue }
```

**File**: `packages/vuetify/src/components/VSelect/VSelect.tsx` (modified, +12/-6)
```diff
@@ -18,6 +18,7 @@ import { VVirtualScroll } from '@/components/VVirtualScroll'
 import { VHighlight } from '@/labs/VHighlight'
 
 // Composables
+import { useAutofill } from './useAutofill'
 import { useFocusRepair } from './useFocusRepair'
 import { useScrolling } from './useScrolling'
 import { useSelectionMenu } from './useSelectionMenu'
@@ -44,9 +45,9 @@ import {
   genericComponent,
   getActiveElement,
   IN_BROWSER,
+  isAutofill,
   isFunction,
   isNumber,
-  matchesSelector,
   omit,
   propsFactory,
   useRender,
@@ -174,6 +175,7 @@ export const VSelect = genericComponent<new <
     const vVirtualScrollRef = ref<VVirtualScroll>()
 
     const { items, transformIn, transformOut } = useItems(props)
+    const { autofill, resetAutofill } = useAutofill(items, item => select(item))
     const search = useProxiedModel(props, 'search', '')
     const { filteredItems, getMatches } = useFilter(props, items, () => search.value)
     const model = useProxiedModel(
@@ -489,20 +491,23 @@ export const VSelect = genericComponent<new <
         isFocused.value = false
       }
     }
+    let isAutofilling = false
+    function onInputCapture (e: Event) {
+      isAutofilling = isAutofill(e)
+    }
     function onModelUpdate (v: any) {
       if (v == null) {
         for (const item of model.value) emit('item:removed', item)
         model.value = []
-      } else if (matchesSelector(vTextFieldRef.value, ':autofill') || matchesSelector(vTextFieldRef.value, ':-webkit-autofill')) {
-        const item = items.value.find(item => item.title === v)
-        if (item) {
-          select(item)
-        }
+      } else if (isAutofilling) {
+        autofill(v)
       } else if (vTextFieldRef.value) {
         vTextFieldRef.value.value = ''
       }
     }
 
+    watch(isFocused, val => val && resetAutofill())
+
     watch(menu, val => {
       if (!val) {
         openedByKeyboard = false
@@ -576,6 +581,7 @@ export const VSelect = genericComponent<new <
           onMousedown:control={ onMousedownControl }
           onBlur={ onBlur }
           onKeydown={ onKeydown }
+          onInputCapture={ onInputCapture }
           aria-expanded={ ariaExpanded.value }
           aria-controls={ ariaControls.value }
         >
```

**File**: `packages/vuetify/src/components/VSelect/__tests__/VSelect.spec.browser.tsx` (modified, +23/-0)
```diff
@@ -49,6 +49,29 @@ const stories = Object.fromEntries(Object.entries({
 )]))
 
 describe('VSelect', () => {
+  it.each([
+    [':autofill', 'CA'],
+    [':autofill', 'California'],
+    [':-webkit-autofill', 'CA'],
+    [':-webkit-autofill', 'California'],
+  ])('should match %s text %s against item titles or values', async (selector, value) => {
+    const model = ref()
+
+    render(() => (
+      <VSelect
+        v-model={ model.value }
+        items={[{ title: 'California', value: 'CA' }]}
+      />
+    ))
+
+    const input = screen.getByCSS('input')
+    vi.spyOn(input, 'matches').mockImplementation(candidate => candidate === selector)
+
+    await userEvent.fill(input, value)
+
+    expect(model.value).toBe('CA')
+  })
+
   describe('open-on-focus', () => {
     it('should open the menu when the input is focused', async () => {
       render(() => (
```

**File**: `packages/vuetify/src/components/VSelect/useAutofill.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+// Utilities
+import { toValue, watch } from 'vue'
+
+// Types
+import type { MaybeRefOrGetter } from 'vue'
+import type { ListItem } from '@/composables/list-items'
+
+const AUTOFILL_PENDING_MS = 1000
+
+export function useAutofill (
+  items: MaybeRefOrGetter<readonly ListItem[]>,
+  select: (item: ListItem) => void,
+) {
+  let pending: string | null = null
+  let pendingTimeout = -1
+
+  function findItem (text: string) {
+    return toValue(items).find(item => item.title === text || item.value === text)
+  }
+
+  watch(() => toValue(items), () => {
+    if (!pending) return
+    const item = findItem(pending)
+    if (!item) return
+    pending = null
+    select(item)
+  })
+
+  function autofill (text: string) {
+    const item = findItem(text)
+    if (item) return select(item)
+
+    resetAutofill()
+    pending = text
+    pendingTimeout = window.setTimeout(resetAutofill, AUTOFILL_PENDING_MS)
+  }
+
+  function resetAutofill () {
+    pending = null
+    clearTimeout(pendingTimeout)
+  }
+
+  return { autofill, resetAutofill }
+}
```

**File**: `packages/vuetify/src/util/helpers.ts` (modified, +6/-0)
```diff
@@ -732,6 +732,12 @@ export function matchesSelector (el: Element | undefined, selector: string): boo
   }
 }
 
+export function isAutofill (e: Event) {
+  return !e.isTrusted ||
+    !!matchesSelector(e.target as Element, ':autofill') ||
+    !!matchesSelector(e.target as Element, ':-webkit-autofill')
+}
+
 export function ensureValidVNode (vnodes: VNodeArrayChildren): VNodeArrayChildren | null {
   return vnodes.some(child => {
     if (!isVNode(child)) return true
```

---

### Incident Patch 15: `8d1d985e` (2026-09-22)
**Commit Message**: fix(VSelect/VAutocomplete/VCombobox): apply `menu-elevation` to the content div (#23193)

fixes #23192

**File**: `packages/vuetify/src/components/VAutocomplete/VAutocomplete.tsx` (modified, +3/-2)
```diff
@@ -23,6 +23,7 @@ import { useScrolling } from '../VSelect/useScrolling'
 import { useSelectionMenu } from '../VSelect/useSelectionMenu'
 import { useTextColor } from '@/composables/color'
 import { injectNestedDefaults } from '@/composables/defaults'
+import { useElevation } from '@/composables/elevation'
 import { makeFilterProps, useFilter } from '@/composables/filter'
 import { useFocusGroups } from '@/composables/focusGroups'
 import { useForm } from '@/composables/form'
@@ -134,6 +135,7 @@ export const VAutocomplete = genericComponent<new <
 
   setup (props, { emit, slots }) {
     const { t } = useLocale()
+    const { elevationClasses } = useElevation(toRef(() => props.menuElevation))
 
     const vTextFieldRef = ref<VTextField>()
     const vMenuRef = ref<VMenu>()
@@ -633,10 +635,9 @@ export const VAutocomplete = genericComponent<new <
                   onAfterEnter={ onAfterEnter }
                   onAfterLeave={ onAfterLeave }
                   { ...props.menuProps }
-                  contentClass={['v-autocomplete__content', props.menuProps?.contentClass]}
+                  contentClass={['v-autocomplete__content', elevationClasses.value, props.menuProps?.contentClass]}
                 >
                   <VSheet
-                    elevation={ props.menuElevation }
                     onFocusin={ onFocusin }
                     onKeydown={ onMenuKeydown }
                     onMousedown={ onMousedownContent }
```

**File**: `packages/vuetify/src/components/VCombobox/VCombobox.tsx` (modified, +3/-2)
```diff
@@ -24,6 +24,7 @@ import { useScrolling } from '../VSelect/useScrolling'
 import { useSelectionMenu } from '../VSelect/useSelectionMenu'
 import { useTextColor } from '@/composables/color'
 import { injectNestedDefaults } from '@/composables/defaults'
+import { useElevation } from '@/composables/elevation'
 import { makeFilterProps, useFilter } from '@/composables/filter'
 import { useFocusGroups } from '@/composables/focusGroups'
 import { useForm } from '@/composables/form'
@@ -141,6 +142,7 @@ export const VCombobox = genericComponent<new <
 
   setup (props, { emit, slots }) {
     const { t } = useLocale()
+    const { elevationClasses } = useElevation(toRef(() => props.menuElevation))
 
     const vTextFieldRef = ref<VTextField>()
     const vMenuRef = ref<VMenu>()
@@ -707,10 +709,9 @@ export const VCombobox = genericComponent<new <
                   onAfterEnter={ onAfterEnter }
                   onAfterLeave={ onAfterLeave }
                   { ...props.menuProps }
-                  contentClass={['v-combobox__content', props.menuProps?.contentClass]}
+                  contentClass={['v-combobox__content', elevationClasses.value, props.menuProps?.contentClass]}
                 >
                   <VSheet
-                    elevation={ props.menuElevation }
                     onFocusin={ onFocusin }
                     onKeydown={ onMenuKeydown }
                     onMousedown={ onMousedownContent }
```

**File**: `packages/vuetify/src/components/VSelect/VSelect.tsx` (modified, +3/-2)
```diff
@@ -23,6 +23,7 @@ import { useScrolling } from './useScrolling'
 import { useSelectionMenu } from './useSelectionMenu'
 import { useFocusGroups } from '../../composables/focusGroups'
 import { injectNestedDefaults } from '@/composables/defaults'
+import { useElevation } from '@/composables/elevation'
 import { makeFilterProps, useFilter } from '@/composables/filter'
 import { useForm } from '@/composables/form'
 import { forwardRefs } from '@/composables/forwardRefs'
@@ -162,6 +163,7 @@ export const VSelect = genericComponent<new <
 
   setup (props, { emit, slots }) {
     const { t } = useLocale()
+    const { elevationClasses } = useElevation(toRef(() => props.menuElevation))
 
     const vTextFieldRef = ref<VTextField>()
     const vMenuRef = ref<VMenu>()
@@ -607,10 +609,9 @@ export const VSelect = genericComponent<new <
                   onAfterEnter={ onAfterEnter }
                   onAfterLeave={ onAfterLeave }
                   { ...computedMenuProps.value }
-                  contentClass={['v-select__content', computedMenuProps.value.contentClass]}
+                  contentClass={['v-select__content', elevationClasses.value, computedMenuProps.value.contentClass]}
                 >
                   <VSheet
-                    elevation={ props.menuElevation }
                     onFocusin={ onFocusin }
                     onFocusout={ onFocusout }
                     onKeydown={ onMenuKeydown }
```

#### Recent Merged Pull Requests:
- **PR #23237** (closed): feat(VWindow): add opt-in wheel prop for mouse wheel/trackpad navigation (@DangTAnh)
- **PR #23236** (closed): chore: update dependency markdown-it to v14.3.1 [security] (@renovate[bot])
- **PR #23235** (closed): chore: update dependency moment to v2.31.0 [security] (@renovate[bot])
- **PR #23228** (2026-09-29): fix(VTimeline): isolate styles from nested timelines (@morimorimokenpi)
- **PR #23226** (2026-10-05): fix(styles): normalize zero breakpoint units (@rafaself)
- **PR #23224** (2026-09-28): docs(transitions): correct prop descriptions for `disabled` and `origin` (@morimorimokenpi)
- **PR #23223** (closed): fix(useBackButton): don't register the router guard after scope disposal (v3) (@neelrocketbots)
- **PR #23222** (closed): fix(useBackButton): don't register the router guard after scope disposal (@neelrocketbots)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
