# Forensic Learning Record (Deep Inspection): thedaviddias/Front-End-Checklist

> **Canonical Artifact**: `07_PROJECT_LEARNING/thedaviddias-front-end-checklist-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/thedaviddias/Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:58:44.113Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thedaviddias/Front-End-Checklist`
- **Description**: 🗂 The essential checklist for modern web development, for humans and AI agents
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 74372 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/e2e/utils/accessibility.utils.ts`
```
import type { Page } from '@playwright/test'

/** Accessibility helper methods for end-to-end tests. */
export class AccessibilityUtils {
  constructor(private page: Page) {}

  async checkA11y() {
    // Placeholder for axe-core integration
    // In a real implementation, you would use @axe-core/playwright

    return {
      violations: [],
      passes: [],
      incomplete: []
    }
  }

  async checkKeyboardNavigation() {
    // Check if all interactive elements are keyboard accessible
    const interactiveElements = await this.page.$$('button, a, input, select, textarea, [tabindex]')

    for (const element of interactiveElements) {
      const isVisible = await element.isVisible()
      const isEnabled = await element.isEnabled()

      if (isVisible && isEnabled) {
        // Check if element can receive focus
        await element.focus()
        const isFocused = await element.evaluate(el => el === document.activeElement)

        if (!isFocused) {
          console.warn('Element cannot receive focus:', element)
        }
      }
    }
  }

  async checkColorContrast() {
    // Placeholder for color contrast checking
    return {
      passes: true,
      issues: []
    }
  }

  async checkAriaLabels() {
    const elements = await this.page.$$('[aria-label], [aria-labelledby], [aria-describedby]')
    const issues = []

    for (const element of elements) {
      const ariaLabelledBy = await element.getAttribute('aria-labelledby')

      if (ariaLabelledBy) {
        const labelElement = await this.page.$(`#${ariaLabelledBy}`)
        if (!labelElement) {
          issues.push({
            element: await element.evaluate(el => el.outerHTML),
            issue: `aria-labelledby references non-existent element: ${ariaLabelledBy}`
          })
        }
      }
    }

    return issues
  }
}

```

### Core Architecture Module: `apps/e2e/utils/performance.utils.ts`
```
import type { Page } from '@playwright/test'
import { TEST_CONFIG } from '@/e2e/config/test.config'

type ChromeMemoryInfo = {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

type ChromePerformance = Performance & {
  memory?: ChromeMemoryInfo
}

/** Performance measurement helpers for end-to-end tests. */
export class PerformanceUtils {
  constructor(private page: Page) {}

  async measurePageLoad() {
    const metrics = await this.page.evaluate(() => {
      const [navigation] = performance.getEntriesByType('navigation')

      if (!(navigation instanceof PerformanceNavigationTiming)) {
        throw new Error('Navigation timing entry is unavailable')
      }

      return {
        domContentLoaded:
          navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        firstPaint: 0, // Would need additional API
        firstContentfulPaint: 0, // Would need additional API
        timeToInteractive: navigation.domInteractive - navigation.fetchStart
      }
    })

    return metrics
  }

  async measureInteraction(action: () => Promise<void>) {
    const startTime = Date.now()
    await action()
    const endTime = Date.now()

    return {
      duration: endTime - startTime,
      isAcceptable: endTime - startTime < TEST_CONFIG.performance.maxInteractionTime
    }
  }

  async getResourceMetrics() {
    const resources = await this.page.evaluate(() => {
      const entries = performance
        .getEntriesByType('resource')
        .filter(
          (entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming
        )

      return entries.map(entry => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
        type: entry.initiatorType
      }))
    })

    return {
      totalResources: resources.length,
      totalSize: resources.reduce((sum, r) => sum + r.size, 0),
      totalDuration: resources.reduce((sum, r) => sum + r.duration, 0),
      resources
    }
  }

  async checkCoreWebVitals() {
    // Placeholder for Core Web Vitals measurement
    return {
      lcp: { value: 0, rating: 'good' },
      fid: { value: 0, rating: 'good' },
      cls: { value: 0, rating: 'good' }
    }
  }

  async measureMemoryUsage() {
    const memory = await this.page.evaluate(() => {
      const perf: ChromePerformance = performance
      if (perf.memory) {
        return {
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
        }
      }
      return null
    })

    return memory
  }
}

```

### Core Architecture Module: `apps/web/app/(site)/lists/[id]/page-states.tsx`
```
'use client'

import { routeHome, routeLists } from '@repo/config'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@repo/design-system/custom/navigation/breadcrumb'
import { ArrowLeft, ListChecks } from '@repo/design-system/icons'
import { cn } from '@repo/utils'
import Link from 'next/link'
import { RuleRowSkeleton } from '@/components/rules/listing/rule-row'

/**
 * Render the loading skeleton for the checklist detail page.
 *
 * @returns A checklist detail loading state.
 */
export function PageSkeleton() {
  return (
    <div className="container-content py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-4 w-48 rounded bg-background-muted" />
        <div className="h-8 w-64 rounded bg-background-muted" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <RuleRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Render the empty state shown when a saved checklist cannot be found.
 *
 */
export function ChecklistNotFoundState() {
  return (
    <div className="container-content py-8">
      <div className="py-16 text-center">
        <ListChecks className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
        <h2 className="mb-2 font-medium text-foreground text-lg">Checklist not found</h2>
        <p className="mb-4 text-foreground-muted">
          This checklist may have been deleted or doesn&apos;t exist.
        </p>
        <Link
          href={routeLists()}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2',
            'bg-accent text-accent-foreground',
            'transition-colors hover:bg-accent/90',
            'font-medium text-sm'
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lists
        </Link>
      </div>
    </div>
  )
}

interface ChecklistBreadcrumbsProps {
  checklistName: string
}

/**
 * Render breadcrumbs for the checklist detail page.
 *
 */
export function ChecklistBreadcrumbs({ checklistName }: ChecklistBreadcrumbsProps) {
  return (
    <Breadcrumb className="mb-4 sm:mb-6">
      <BreadcrumbList className="text-[13px]">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={routeHome()}>Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={routeLists()}>Lists</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{checklistName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

```

### Core Architecture Module: `apps/web/components/homepage/mentions-marquee-utils.ts`
```
import type { Mention } from '@repo/types'

/** Build a stable numeric hash for deterministic mention ordering. */
function stableHash(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

/** Return a deterministic shuffled copy without changing between server and client. */
export function shuffleArray(mentions: Mention[]): Mention[] {
  return [...mentions].sort((a, b) => {
    const hashDiff = stableHash(a.id) - stableHash(b.id)
    return hashDiff === 0 ? a.id.localeCompare(b.id) : hashDiff
  })
}

/** Split mentions into round-robin marquee columns. */
export function splitIntoColumns(mentions: Mention[], columnCount: number): Mention[][] {
  const columns: Mention[][] = Array.from({ length: columnCount }, () => [])
  mentions.forEach((mention, index) => columns[index % columnCount].push(mention))
  return columns
}

```

### Core Architecture Module: `apps/web/components/rules/browser/rules-browser-renderer.tsx`
```
'use client'

import { routeRule } from '@repo/config'
import { RuleRow } from '@/components/rules/listing/rule-row'
import { CategoryHeader, SubcategoryHeader } from './rules-browser-headers'
import type { BrowserRule, GroupedRules } from './rules-browser-types'

interface RulesBrowserRendererProps {
  groupedRules: GroupedRules | null
  filteredRules: BrowserRule[]
  currentCategory?: string
  subcategoryDescriptions: Record<string, string>
  expandedRules: Set<string>
  handleRuleExpandToggle: (ruleId: string, expanded: boolean) => void
  areAllExpanded: (ruleIds: string[]) => boolean
  handleExpandRules: (ruleIds: string[]) => void
  handleCollapseRules: (ruleIds: string[]) => void
  areAllChecked: (ruleIds: string[]) => boolean
  handleCheckRules: (ruleIds: string[]) => void
  handleUncheckRules: (ruleIds: string[]) => void
  enableCategoryLinks: boolean
}

/**
 * Render rules in grouped or flat layouts based on the browser state.
 * @param props - Renderer inputs for grouping, expansion, and bulk actions.
 */
export function RulesBrowserRenderer({
  groupedRules,
  filteredRules,
  currentCategory,
  subcategoryDescriptions,
  expandedRules,
  handleRuleExpandToggle,
  areAllExpanded,
  handleExpandRules,
  handleCollapseRules,
  areAllChecked,
  handleCheckRules,
  handleUncheckRules,
  enableCategoryLinks
}: RulesBrowserRendererProps) {
  if (!groupedRules) {
    return (
      <div>
        {filteredRules.map(rule => (
          <RuleRow
            key={rule.id}
            id={rule.id}
            title={rule.title}
            description={rule.description}
            priority={rule.priority}
            categories={rule.categories}
            subcategory={rule.subcategory}
            href={routeRule(rule.primaryCategory, rule.slug)}
            currentCategory={currentCategory}
            isExpanded={expandedRules.has(rule.id)}
            onExpandToggle={handleRuleExpandToggle}
          />
        ))}
      </div>
    )
  }

  if (groupedRules.type === 'category') {
    return (
      <>
        {Object.keys(groupedRules.categoryGroups)
          .sort()
          .map((category, categoryIndex) => {
            const group = groupedRules.categoryGroups[category]
            const subcategoryKeys = Object.keys(group.groups).sort()
            const hasUncategorized = group.uncategorized.length > 0

            return (
              <div key={category}>
                <CategoryHeader
                  category={category}
                  isFirst={categoryIndex === 0}
                  enableLink={enableCategoryLinks}
                />
                {hasUncategorized ? (
                  <RulesSection
                    label="General"
                    showHeader={subcategoryKeys.length > 0}
                    rules={group.uncategorized}
                    currentCategory={currentCategory}
                    description={subcategoryDescriptions.general}
                    isFirst
                    expandedRules={expandedRules}
                    handleRuleExpandToggle={handleRuleExpandToggle}
                    allExpanded={areAllExpanded(group.uncategorized.map(r => r.id))}
                    onExpandAll={() => handleExpandRules(group.uncategorized.map(r => r.id))}
                    onCollapseAll={() => handleCollapseRules(group.uncategorized.map(r => r.id))}
                    allChecked={areAllChecked(group.uncategorized.map(r => r.id))}
                    onCheckAll={() => handleCheckRules(group.uncategorized.map(r => r.id))}
                    onUncheckAll={() => handleUncheckRules(group.uncategorized.map(r => r.id))}
                  />
                ) : null}
                {subcategoryKeys.map((subcategory, subIndex) => (
                  <RulesSection
                    key={subcategory}
                    label={subcategory}
                    rules={group.groups[subcategory]}
                    currentCategory={currentCategory}
                    description={subcategoryDescriptions[subcategory]}
                    isFirst={!hasUncategorized && subIndex === 0}
                    expandedRules={expandedRules}
                    handleRuleExpandToggle={handleRuleExpandToggle}
                    allExpanded={areAllExpanded(group.groups[subcategory].map(r => r.id))}
                    onExpandAll={() => handleExpandRules(group.groups[subcategory].map(r => r.id))}
                    onCollapseAll={() =>
                      handleCollapseRules(group.groups[subcategory].map(r => r.id))
                    }
                    allChecked={areAllChecked(group.groups[subcategory].map(r => r.id))}
                    onCheckAll={() => handleCheckRules(group.groups[subcategory].map(r => r.id))}
                    onUncheckAll={() =>
                      handleUncheckRules(group.groups[subcategory].map(r => r.id))
                    }
                  />
                ))}
              </div>
            )
          })}
      </>
    )
  }

  const hasUncategorized = groupedRules.uncategorized.length > 0
  const subcategoryKeys = Object.keys(groupedRules.groups).sort()

  return (
    <>
      {hasUncategorized ? (
        <RulesSection
          label="General"
          rules={groupedRules.uncategorized}
          currentCategory={currentCategory}
          description={subcategoryDescriptions.general}
          isFirst
          expandedRules={expandedRules}
          handleRuleExpandToggle={handleRuleExpandToggle}
          allExpanded={areAllExpanded(groupedRules.uncategorized.map(r => r.id))}
          onExpandAll={() => handleExpandRules(groupedRules.uncategorized.map(r => r.id))}
          onCollapseAll={() => handleCollapseRules(groupedRules.uncategorized.map(r => r.id))}
          allChecked={areAllChecked(groupedRules.uncategorized.map(r => r.id))}
          onCheckAll={() => handleCheckRules(groupedRules.uncategorized.map(r => r.id))}
          onUncheckAll={() => handleUncheckRules(groupedRules.uncategorized.map(r => r.id))}
        />
      ) : null}
      {subcategoryKeys.map((subcategory, index) => (
        <RulesSection
          key={subcategory}
          label={subcategory}
          rules={groupedRules.groups[subcategory]}
          currentCategory={currentCategory}
          description={subcategoryDescriptions[subcategory]}
          isFirst={!hasUncategorized && index === 0}
          expandedRules={expandedRules}
          handleRuleExpandToggle={handleRuleExpandToggle}
          allExpanded={areAllExpanded(groupedRules.groups[subcategory].map(r => r.id))}
          onExpandAll={() => handleExpandRules(groupedRules.groups[subcategory].map(r => r.id))}
          onCollapseAll={() => handleCollapseRules(groupedRules.groups[subcategory].map(r => r.id))}
          allChecked={areAllChecked(groupedRules.groups[subcategory].map(r => r.id))}
          onCheckAll={() => handleCheckRules(groupedRules.groups[subcategory].map(r => r.id))}
          onUncheckAll={() => handleUncheckRules(groupedRules.groups[subcategory].map(r => r.id))}
        />
      ))}
    </>
  )
}

/**
 * Render a subcategory section and its contained rules.
 * @param props - Section label, rules, and bulk action callbacks.
 */
function RulesSection({
  label,
  rules,
  currentCategory,
  description,
  isFirst = false,
  expandedRules,
  handleRuleExpandToggle,
  allExpanded,
  onExpandAll,
  onCollapseAll,
  allChecked,
  onCheckAll,
  onUncheckAll,
  showHeader = true
}: {
  label: string
  rules: BrowserRule[]
  currentCategory?: string
  description?: string
  isFirst?: boolean
  expandedRules: Set<string>
  handleRuleExpandToggle: (ruleId: string, expanded: boolean) => void
  allExpanded: boolean
  onExpandAll: () => void
  onCollapseAll: () => void
  allChecked: boolean
  onCheckAll: () => void
  onUncheckAll: () => void
  showHeader?: boolean
}) {
  return (
    <>
      {showHeader ? (
        <SubcategoryHeader
          label={label}
          ruleIds={rules.map(r => r.id)}
          description={description}
          isFirst={isFirst}
          allExpanded={allExpanded}
          onExpandAll={onExpandAll}
          onCollapseAll={onCollapseAll}
          allChecked={allChecked}
          onCheckAll={onCheckAll}
          onUncheckAll={onUncheckAll}
        />
      ) : null}
      <div className="[&>*:last-child]:border-b-0">
        {rules.map(rule => (
          <RuleRow
            key={rule.id}
            id={rule.id}
            title={rule.title}
            description={rule.description}
            priority={rule.priority}
            categories={rule.categories}
            subcategory={rule.subcategory}
            href={routeRule(rule.primaryCategory, rule.slug)}
            currentCategory={currentCategory}
            isExpanded={expandedRules.has(rule.id)}
            onExpandToggle={handleRuleExpandToggle}
          />
        ))}
      </div>
    </>
  )
}

```

### Core Architecture Module: `apps/web/components/rules/browser/use-rules-browser-state.ts`
```
'use client'

import { useMemo, useState } from 'react'
import type { BrowserRule, CategoryGroups, GroupedRules } from './rules-browser-types'

const PRIORITY_ORDER: Array<BrowserRule['priority']> = ['critical', 'high', 'medium', 'low']

interface UseRulesBrowserStateProps {
  rules: BrowserRule[]
  currentCategory?: string
  groupByCategory: boolean
  groupBySubcategory: boolean
  isRuleCompleted: (id: string) => boolean
  getCompletionStats: (ruleIds: string[]) => { completed: number; total: number }
}

/**
 * Manage filtering, sorting, grouping, and aggregate state for the rules browser.
 * @param props - Rules and helpers required to derive browser state.
 * @returns Derived browser state and state mutators.
 */
export function useRulesBrowserState({
  rules,
  currentCategory,
  groupByCategory,
  groupBySubcategory,
  isRuleCompleted,
  getCompletionStats
}: UseRulesBrowserStateProps) {
  const [search, setSearch] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'alphabetical' | 'priority' | 'completion'>('priority')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    rules.forEach(r => {
      set.add(r.primaryCategory)
      r.categories?.forEach(c => set.add(c))
    })
    return Array.from(set).sort()
  }, [rules])

  const allSubcategories = useMemo(() => {
    const set = new Set<string>()
    rules.forEach(r => {
      if (r.subcategory) set.add(r.subcategory)
    })
    return Array.from(set).sort()
  }, [rules])

  const filteredRules = useMemo(() => {
    let result = rules

    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false) ||
          r.primaryCategory.toLowerCase().includes(q) ||
          r.categories?.some(c => c.toLowerCase().includes(q))
      )
    }

    if (priorityFilter !== 'all') {
      result = result.filter(r => r.priority === priorityFilter)
    }

    if (tagFilter !== 'all') {
      result = result.filter(
        r => r.primaryCategory === tagFilter || r.categories?.includes(tagFilter)
      )
    }

    if (subcategoryFilter !== 'all') {
      result = result.filter(r => r.subcategory === subcategoryFilter)
    }

    if (currentCategory) {
      result = result.filter(
        r =>
          r.primaryCategory.toLowerCase() === currentCategory.toLowerCase() ||
          r.categories?.some(c => c.toLowerCase() === currentCategory?.toLowerCase())
      )
    }

    const sorted = [...result].sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === 'completion') {
        const aDone = isRuleCompleted(a.id) ? 1 : 0
        const bDone = isRuleCompleted(b.id) ? 1 : 0
        if (bDone !== aDone) return aDone - bDone
        return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
      }
      return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
    })

    return sorted
  }, [
    rules,
    search,
    priorityFilter,
    tagFilter,
    subcategoryFilter,
    currentCategory,
    sortBy,
    isRuleCompleted
  ])

  const completionStats = useMemo(
    () => getCompletionStats(filteredRules.map(r => r.id)),
    [filteredRules, getCompletionStats]
  )

  const groupedRules = useMemo((): GroupedRules | null => {
    if (groupByCategory) {
      const categoryGroups: CategoryGroups = {}
      filteredRules.forEach(rule => {
        const cat = rule.primaryCategory
        if (!categoryGroups[cat]) {
          categoryGroups[cat] = { uncategorized: [], groups: {} }
        }
        const sub = rule.subcategory ?? null
        if (!sub) {
          categoryGroups[cat].uncategorized.push(rule)
        } else {
          if (!categoryGroups[cat].groups[sub]) categoryGroups[cat].groups[sub] = []
          categoryGroups[cat].groups[sub].push(rule)
        }
      })
      return { type: 'category', categoryGroups }
    }
    if (groupBySubcategory) {
      const uncategorized: BrowserRule[] = []
      const groups: Record<string, BrowserRule[]> = {}
      filteredRules.forEach(rule => {
        const sub = rule.subcategory ?? null
        if (!sub) {
          uncategorized.push(rule)
        } else {
          if (!groups[sub]) groups[sub] = []
          groups[sub].push(rule)
        }
      })
      return { type: 'subcategory', uncategorized, groups }
    }
    return null
  }, [filteredRules, groupByCategory, groupBySubcategory])

  const clearFilters = useMemo(
    () => () => {
      setSearch(null)
      setPriorityFilter('all')
      setTagFilter('all')
      setSubcategoryFilter('all')
    },
    []
  )

  const setPriorityFilterSafe = useMemo(
    () => (value: string | null) => setPriorityFilter(value ?? 'all'),
    []
  )
  const setTagFilterSafe = useMemo(() => (value: string | null) => setTagFilter(value ?? 'all'), [])
  const setSubcategoryFilterSafe = useMemo(
    () => (value: string | null) => setSubcategoryFilter(value ?? 'all'),
    []
  )

  const hasActiveFilters =
    (search != null && search.trim() !== '') ||
    priorityFilter !== 'all' ||
    tagFilter !== 'all' ||
    subcategoryFilter !== 'all'

  const activeFilterCount = [
    search != null && search.trim() !== '',
    priorityFilter !== 'all',
    tagFilter !== 'all',
    subcategoryFilter !== 'all'
  ].filter(Boolean).length

  return {
    search: search ?? '',
    setSearch,
    priorityFilter,
    setPriorityFilter: setPriorityFilterSafe,
    tagFilter,
    setTagFilter: setTagFilterSafe,
    subcategoryFilter,
    setSubcategoryFilter: setSubcategoryFilterSafe,
    sortBy,
    setSortBy,
    allTags,
    allSubcategories,
    filteredRules,
    completionStats,
    groupedRules,
    clearFilters,
    hasActiveFilters,
    activeFilterCount
  }
}

```

### Core Architecture Module: `apps/web/content-collections-rule-utils.ts`
```
import { CATEGORIES } from '@repo/config'
import type { RuleSourceSummary } from '@repo/types'
import { SUBCATEGORIES, type Subcategory } from '@repo/types'
import type rehypePrettyCode from 'rehype-pretty-code'

export const subcategoryValues = SUBCATEGORIES as [Subcategory, ...Subcategory[]]
export const categoryValues = CATEGORIES as [string, ...string[]]
export const RULE_SOURCE_ROLES = [
  'standard',
  'reference',
  'implementation',
  'compatibility',
  'regulation',
  'search',
  'research'
] as const
export const RULE_SOURCE_AUTHORITIES = ['primary', 'secondary'] as const

export type RuleSourceRole = (typeof RULE_SOURCE_ROLES)[number]
export type RuleSourceAuthority = (typeof RULE_SOURCE_AUTHORITIES)[number]

/**
 * Build a stable metadata slug from a title-like source label.
 *
 * @param value - Source label or title.
 * @param fallback - Fallback identifier when normalization empties the value.
 * @returns Stable ID suitable for frontmatter normalization.
 */
export function slugifyMetadataId(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

/**
 * Infer the most appropriate source role from type and domain hints.
 *
 * @param source - Raw source metadata.
 * @param index - Position within the source array.
 * @returns Normalized rule-source role.
 */
export function inferSourceRole(
  source: { type?: string; url?: string },
  index: number
): RuleSourceRole {
  const type = source.type?.toLowerCase()
  const hostname = source.url ? new URL(source.url).hostname.toLowerCase() : ''

  if (type === 'wcag' || type === 'spec') return 'standard'
  if (type === 'google' || hostname.includes('developers.google.com')) return 'search'
  if (type === 'owasp') return 'regulation'
  if (hostname.includes('caniuse') || hostname.includes('web-platform-dx')) return 'compatibility'
  if (type === 'mdn' || type === 'documentation') return 'reference'
  if (type === 'guide' || type === 'web.dev') return index === 0 ? 'reference' : 'implementation'

  return index === 0 ? 'reference' : 'implementation'
}

/**
 * Infer whether a source should be treated as primary or secondary authority.
 *
 * @param source - Raw source metadata.
 * @returns Authority classification for the source.
 */
export function inferSourceAuthority(source: { type?: string; url?: string }): RuleSourceAuthority {
  const type = source.type?.toLowerCase()
  const hostname = source.url ? new URL(source.url).hostname.toLowerCase() : ''

  if (
    type === 'wcag' ||
    type === 'spec' ||
    type === 'owasp' ||
    type === 'google' ||
    hostname.endsWith('w3.org') ||
    hostname.endsWith('mozilla.org') ||
    hostname.endsWith('googleusercontent.com') ||
    hostname.endsWith('developer.chrome.com') ||
    hostname.endsWith('developer.apple.com') ||
    hostname.endsWith('m3.material.io') ||
    hostname.endsWith('web.dev') ||
    hostname.startsWith('developer.') ||
    hostname.startsWith('developers.') ||
    hostname.startsWith('docs.') ||
    hostname.startsWith('learn.') ||
    hostname.endsWith('playwright.dev') ||
    hostname.endsWith('testing-library.com') ||
    hostname.endsWith('cypress.io') ||
    hostname.endsWith('jestjs.io') ||
    hostname.endsWith('vitest.dev') ||
    hostname.endsWith('storybook.js.org') ||
    hostname.endsWith('stryker-mutator.io')
  ) {
    return 'primary'
  }

  return 'secondary'
}

/**
 * Build the compact source summary used in API and UI responses.
 *
 * @param input - Normalized source records.
 * @returns Aggregate source counts for the rule.
 */
export function buildSourceSummary({
  sources
}: {
  sources: Array<{ authority: RuleSourceAuthority; role: RuleSourceRole }>
}): RuleSourceSummary {
  const primarySourceCount = sources.filter(source => source.authority === 'primary').length
  const sourceRoleCount = new Set(sources.map(source => source.role)).size

  return {
    sourceCount: sources.length,
    primarySourceCount,
    sourceRoleCount
  }
}

export const rehypePrettyCodeOptions = {
  theme: {
    dark: 'github-dark',
    light: 'github-light'
  },
  keepBackground: false,
  defaultLang: {
    block: 'plaintext',
    inline: 'plaintext'
  },
  onVisitLine(node: any) {
    if (node.children.length === 0) {
      node.children = [{ type: 'text', value: ' ' }]
    }
  },
  onVisitHighlightedLine(node: any) {
    node.properties.className = ['line--highlighted']
  },
  onVisitHighlightedChars(node: any) {
    node.properties.className = ['word--highlighted']
  }
} satisfies Parameters<typeof rehypePrettyCode>[0]

```

### Core Architecture Module: `apps/web/hooks/use-filters.ts`
```
import { parseAsArrayOf, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs'

/** Provides URL-synced filter state (search, categories, priority, difficulty, sort). */
export function useFilters() {
  // Search query
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))

  // Selected categories
  const [categories, setCategories] = useQueryState(
    'categories',
    parseAsArrayOf(parseAsString).withDefault([])
  )

  // Priority filter
  const [priority, setPriority] = useQueryState(
    'priority',
    parseAsStringEnum(['critical', 'high', 'medium', 'low']).withDefault('all' as any)
  )

  // Difficulty filter
  const [difficulty, setDifficulty] = useQueryState(
    'difficulty',
    parseAsStringEnum(['beginner', 'intermediate', 'advanced', 'expert']).withDefault('all' as any)
  )

  // Sort option
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringEnum(['title', 'priority', 'difficulty', 'category']).withDefault('title')
  )

  // Sort direction
  const [order, setOrder] = useQueryState(
    'order',
    parseAsStringEnum(['asc', 'desc']).withDefault('asc')
  )

  /** Resets all filter and sort values to their defaults. */
  const clearFilters = () => {
    setSearch('')
    setCategories([])
    setPriority('all' as any)
    setDifficulty('all' as any)
    setSort('title')
    setOrder('asc')
  }

  return {
    search,
    setSearch,
    categories,
    setCategories,
    priority,
    setPriority,
    difficulty,
    setDifficulty,
    sort,
    setSort,
    order,
    setOrder,
    clearFilters
  }
}

```

### Core Architecture Module: `apps/web/hooks/use-hydrated.ts`
```
'use client'

import { useSyncExternalStore } from 'react'

/**
 * Subscribe to a stable hydration store.
 * @returns An unsubscribe callback for useSyncExternalStore.
 */
function subscribeToHydrationStore() {
  return () => {}
}

/**
 * Return the client hydration snapshot.
 * @returns True after the client store is available.
 */
function getHydratedSnapshot() {
  return true
}

/**
 * Return the server hydration snapshot.
 * @returns False during server rendering.
 */
function getServerHydratedSnapshot() {
  return false
}

/**
 * Return false during SSR and the first hydration comparison, then true on the client.
 * @returns Whether the component has hydrated on the client.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydrationStore,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  )
}

```

### Core Architecture Module: `apps/web/hooks/use-intersection-in-view.ts`
```
'use client'

import type { RefObject } from 'react'
import { useRef, useSyncExternalStore } from 'react'

/**
 * Observe whether an element is in the viewport without effect-driven state updates.
 * @param ref - Element ref to observe.
 * @param threshold - Intersection threshold.
 * @returns Whether the element is currently intersecting.
 */
export function useIntersectionInView(ref: RefObject<HTMLElement | null>, threshold: number) {
  const storeRef = useRef({ isInView: false })

  return useSyncExternalStore(
    onStoreChange => {
      const element = ref.current
      if (!element || typeof IntersectionObserver === 'undefined') {
        return () => {}
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          storeRef.current.isInView = entry.isIntersecting
          onStoreChange()
        },
        { threshold }
      )

      observer.observe(element)
      return () => observer.disconnect()
    },
    () => storeRef.current.isInView,
    () => false
  )
}

```

### Core Architecture Module: `apps/web/hooks/use-progress.ts`
```
'use client'

import { authClient } from '@repo/auth/auth-client'
import { storage } from '@repo/storage'
import type { UserProgress } from '@repo/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { trackClientEvent } from '@/lib/telemetry-client'
import { TELEMETRY_EVENTS } from '@/lib/telemetry-events'

const MIGRATION_KEY_PREFIX = 'fec_progress_migrated_'

/**
 * Convert API progress records into the shared client progress shape.
 *
 * @param items - Raw progress items returned by the API.
 * @returns Normalized progress records with Date instances.
 */
function parseProgressFromApi(
  items: { ruleId: string; completed: boolean; completedAt?: string; notes?: string }[]
): UserProgress[] {
  return items.map(p => ({
    ruleId: p.ruleId,
    completed: p.completed,
    completedAt: p.completedAt ? new Date(p.completedAt) : undefined,
    notes: p.notes
  }))
}

/**
 * Load progress records for the current signed-in user from the API.
 *
 * @returns Normalized progress records, or an empty list on failure.
 */
async function fetchProgressFromApi(): Promise<UserProgress[]> {
  const res = await fetch('/api/progress')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? parseProgressFromApi(data) : []
}

/**
 * Upsert a single progress record into the current collection.
 *
 * @param current - Existing progress collection.
 * @param next - Progress record to insert or replace.
 * @returns Updated progress collection.
 */
function upsertProgressItem(current: UserProgress[], next: UserProgress): UserProgress[] {
  if (current.some(item => item.ruleId === next.ruleId)) {
    return current.map(item => (item.ruleId === next.ruleId ? { ...item, ...next } : item))
  }

  return [...current, next]
}

/** Provides rule completion tracking: toggle, stats, import/export, and bulk operations. */
export function useProgress() {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const isSignedIn = Boolean(session?.user?.id)
  const migrationDoneRef = useRef(false)

  const queryKey = isSignedIn ? ['progress', session!.user.id] : ['progress']

  const { data: progress = [], isLoading } = useQuery({
    queryKey,
    queryFn: isSignedIn ? fetchProgressFromApi : () => storage.loadProgress(),
    enabled: true,
    staleTime: isSignedIn ? 1000 * 60 * 2 : 1000 * 60 * 5
  })

  // On first sign-in, migrate localStorage progress to API once
  useEffect(() => {
    if (!isSignedIn || !session?.user?.id || migrationDoneRef.current) return

    const migratedKey = MIGRATION_KEY_PREFIX + session.user.id
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(migratedKey)) {
      migrationDoneRef.current = true
      return
    }

    migrationDoneRef.current = true

    storage.loadProgress().then(localProgress => {
      if (localProgress.length === 0) {
        sessionStorage.setItem(migratedKey, '1')
        return
      }

      const body = localProgress.map(p => ({
        ruleId: p.ruleId,
        completed: p.completed,
        completedAt: p.completedAt?.toISOString(),
        notes: p.notes
      }))

      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(res => {
          if (res.ok) {
            storage.saveProgress([])
            sessionStorage.setItem(migratedKey, '1')
            queryClient.invalidateQueries({ queryKey })
          }
        })
        .catch(() => {
          migrationDoneRef.current = false
        })
    })
  }, [isSignedIn, session?.user?.id, queryKey, queryClient])

  const saveProgressMutation = useMutation({
    mutationFn: async (newProgress: UserProgress[]) => {
      if (isSignedIn) {
        const body = newProgress.map(p => ({
          ruleId: p.ruleId,
          completed: p.completed,
          completedAt: p.completedAt?.toISOString(),
          notes: p.notes
        }))
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (!res.ok) throw new Error('Failed to save progress')
      } else {
        await storage.saveProgress(newProgress)
      }
    },
    onMutate: async newProgress => {
      await queryClient.cancelQueries({ queryKey })
      const previousProgress = queryClient.getQueryData<UserProgress[]>(queryKey) ?? progress
      queryClient.setQueryData(queryKey, newProgress)
      return { previousProgress }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProgress) {
        queryClient.setQueryData(queryKey, context.previousProgress)
      }
    }
  })

  const putProgressMutation = useMutation({
    mutationFn: async (payload: {
      ruleId: string
      completed: boolean
      completedAt?: Date
      notes?: string
      eventType?: 'completion' | 'notes'
    }) => {
      const res = await fetch('/api/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: payload.ruleId,
          completed: payload.completed,
          completedAt: payload.completedAt?.toISOString(),
          notes: payload.notes,
          eventType: payload.eventType
        })
      })
      if (!res.ok) throw new Error('Failed to update progress')
    },
    onMutate: async payload => {
      await queryClient.cancelQueries({ queryKey })
      const previousProgress = queryClient.getQueryData<UserProgress[]>(queryKey) ?? progress
      const nextProgress = upsertProgressItem(previousProgress, {
        ruleId: payload.ruleId,
        completed: payload.completed,
        completedAt: payload.completedAt,
        notes: payload.notes
      })
      queryClient.setQueryData(queryKey, nextProgress)
      return { previousProgress }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProgress) {
        queryClient.setQueryData(queryKey, context.previousProgress)
      }
    }
  })

  const toggleRuleCompletion = useCallback(
    (ruleId: string) => {
      const existingProgress = progress.find(p => p.ruleId === ruleId)
      const nextCompleted = existingProgress ? !existingProgress.completed : true
      const completedAt = nextCompleted ? new Date() : undefined

      if (isSignedIn) {
        putProgressMutation.mutate({
          ruleId,
          completed: nextCompleted,
          completedAt,
          eventType: 'completion'
        })
      } else {
        let newProgress: UserProgress[]
        if (existingProgress) {
          newProgress = progress.map(p =>
            p.ruleId === ruleId ? { ...p, completed: nextCompleted, completedAt } : p
          )
        } else {
          newProgress = [...progress, { ruleId, completed: nextCompleted, completedAt }]
        }

        saveProgressMutation.mutate(newProgress)
        trackClientEvent(
          nextCompleted ? TELEMETRY_EVENTS.ruleCompleted : TELEMETRY_EVENTS.ruleUncompleted,
          {
            ruleId,
            sessionState: 'signed_out'
          }
        )
      }
    },
    [progress, isSignedIn, queryKey, queryClient, putProgressMutation, saveProgressMutation]
  )

  const updateRuleNotes = useCallback(
    (ruleId: string, notes: string) => {
      const existingProgress = progress.find(p => p.ruleId === ruleId)
      const completed = existingProgress?.completed ?? false
      const completedAt = existingProgress?.completedAt

      if (isSignedIn) {
        putProgressMutation.mutate({ ruleId, completed, completedAt, notes, eventType: 'notes' })
      } else {
        let newProgress: UserProgress[]
        if (existingProgress) {
          newProgress = progress.map(p => (p.ruleId === ruleId ? { ...p, notes } : p))
        } else {
          newProgress = [...progress, { ruleId, completed: false, notes }]
        }
        saveProgressMutation.mutate(newProgress)
        trackClientEvent(TELEMETRY_EVENTS.ruleNotesUpdated, {
          ruleId,
          sessionState: 'signed_out'
        })
      }
    },
    [progress, isSignedIn, queryKey, queryClient, putProgressMutation, saveProgressMutation]
  )

  const getRuleProgress = useCallback(
    (ruleId: string): UserProgress | undefined => {
      return progress.find(p => p.ruleId === ruleId)
    },
    [progress]
  )

  const isRuleCompleted = useCallback(
    (ruleId: string): boolean => {
      const ruleProgress = progress.find(p => p.ruleId === ruleId)
      return ruleProgress?.completed || false
    },
    [progress]
  )

  const getCompletionStats = useCallback(
    (ruleIds?: string[]) => {
      const relevantRules = ruleIds || []
      const completedRules = progress.filter(
        p => p.completed && (ruleIds ? relevantRules.includes(p.ruleId) : true)
      )

      const total = ruleIds ? ruleIds.length : completedRules.length
      const completed = completedRules.length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        total,
        completed,
        percentage,
        remaining: total - completed
      }
    },
    [progress]
  )

  const getCategoryStats = useCallback(
    (categoryRules: { id: string; primaryCategory: string }[]) => {
      const categories = new Map<string, { total: number; completed: number }>()

      categoryRules.forEach(rule => {
        const category = rule.primaryCategory
        const isCompleted = isRuleCompleted(rule.id)

        if (!categories.has(category)) {
          categories.set(category, { total: 0, completed: 0 })
        }

        const stats = categories.get(category)!
        stats.total++
        if (isCompleted) {
          stats.completed++
        }
      })

      return Array.from(categories.entries()).map(([category, stats]) => ({
        catego
```

### Core Architecture Module: `apps/web/hooks/use-reduced-motion-preference.ts`
```
'use client'

import { useSyncExternalStore } from 'react'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

/**
 * Subscribe to reduced-motion preference changes.
 * @param onStoreChange - Callback invoked when the media query changes.
 * @returns Unsubscribe callback.
 */
function subscribeToReducedMotion(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery)
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

/**
 * Read the client reduced-motion preference.
 * @returns Whether reduced motion is preferred.
 */
function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches
}

/**
 * Return the server reduced-motion fallback.
 * @returns False during server rendering.
 */
function getServerReducedMotionSnapshot() {
  return false
}

/**
 * Track the user reduced-motion preference with a hydration-safe snapshot.
 * @returns Whether reduced motion is preferred.
 */
export function useReducedMotionPreference() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #751** (2026-09-30): **Replace FID with INP in metadata**
  *Symptoms*: <!-- Love Front-End Checklist? Please consider supporting our collective: 👉  https://opencollective.com/front-end-checklist/donate -->  **Fixes**: #  🚨 Please review the [guidelines for contributing](CONTRIBUTING.md) and our [code of conduct](../CODE_OF_CONDUCT.md) to this repository. 🚨 **Please complete these steps and check these boxes (by putting an x inside the brackets) before filing your PR:**  - [ ] Check the commit's or even all commits' message styles matches our requested structure. _Dunno, can't see where this is and CONTRIBUTING.md link in the PR template is broken._ - [x] Check your code additions will fail neither code linting checks nor unit test.  #### Short description of what this resolves:  FID was retired a long time a go, but the metadata (used to generate a preview when posting in social media) still refers to that instead of INP.  #### Proposed changes:  - Change FID to INP  👍 Thank you! 

- **Issue #749** (2026-09-30): **docs(images): add SVG optimization resource**
  *Symptoms*: **Fixes**: N/A  - [x] Check the commit's or even all commits' message styles matches our requested structure. - [ ] Check your code additions will fail neither code linting checks nor unit test.  #### Short description of what this resolves:  Adds a supplementary article to the existing “Optimize SVG files” rule.  The article covers SVG minification and optimization practices, including preserving `viewBox` and accessibility-related metadata when using optimization tools such as SVGO.  Disclosure: I am associated with Axialis, the publisher of IconVectors and the linked tutorial.  #### Proposed changes:  - Add the IconVectors tutorial to the existing `resources` list. - Classify it as an `article`. - Leave the existing sources and rule guidance unchanged.

- **Issue #744** (2026-09-30): **Add video optimization rule**
  *Symptoms*: <!-- Love Front-End Checklist? Please consider supporting our collective: 👉  https://opencollective.com/front-end-checklist/donate -->  **Fixes**: #  🚨 Please review the [guidelines for contributing](CONTRIBUTING.md) and our [code of conduct](../CODE_OF_CONDUCT.md) to this repository. 🚨 **Please complete these steps and check these boxes (by putting an x inside the brackets) before filing your PR:**  - [X] Check the commit's or even all commits' message styles matches our requested structure. - [X] Check your code additions will fail neither code linting checks nor unit test.  #### Short description of what this resolves: Created a new rule to validate video optimization  #### Proposed changes: Add a rule, tools and resources to better check if videos are optimally loaded or not - - -  👍 Thank you! 
  **Post-Mortem & Fix Analysis**:
  > Thanks

- **Issue #743** (2026-09-30): **Add slingsite as an image optimization tool**
  *Symptoms*:  **Fixes**: #  🚨 Please review the [guidelines for contributing](CONTRIBUTING.md) and our [code of conduct](../CODE_OF_CONDUCT.md) to this repository. 🚨 **Please complete these steps and check these boxes (by putting an x inside the brackets) before filing your PR:**  - [X] Check the commit's or even all commits' message styles matches our requested structure. - [X] Check your code additions will fail neither code linting checks nor unit test.  #### Short description of what this resolves: It adds a helpful tool for people to optimized images before uploading them to their project  #### Proposed changes: - Add slingsite to the list of tools of rules related to image optimization  👍 Thank you! 
  **Post-Mortem & Fix Analysis**:
  > Thanks

- **Issue #738** (2026-09-30): **docs: add Agent QA E2E resource**
  *Symptoms*: ## Summary  Add Agent QA as a supporting tool in the existing end-to-end testing rule and explain its complementary boundary in the rule body.  ## Contributor checklist  - [x] The commit message follows the repository's requested conventional format. - [x] The content, lint-adjacent validators, tests, and production build pass.  ## Why it fits  [Agent QA](https://github.com/vostride/agent-qa) runs natural-language black-box regression suites against web and mobile interfaces and retains scoped test memory between runs. That makes it relevant to this rule's complete-user-journey focus.  The new sentence deliberately keeps Playwright and Cypress as the code-level examples and says Agent QA complements rather than replaces their framework-level assertions. Agent QA is an independent external tool, not a Front-End Checklist integration.  The current FSL-1.1-ALv2 license is source-available rather than OSI open source and converts to Apache-2.0 after two years. I am affiliated with Vostride and Agent QA.  ## Validation  - `pnpm score:rules packages/content/rules/en/testing/e2e-testing.mdx` gives the rule an A (98/104, 94%) and passes the quality gate. - `pnpm validate:rule-structure` checks all 385 rules with zero errors. - `pnpm validate:sources` checks all 385 rules with zero missing sources or broken URLs, including the new canonical Agent QA resource URL. - `pnpm generate:skills` regenerates all 385 derived skills successfully; the corresponding generated E2E reference is incl
  **Post-Mortem & Fix Analysis**:
  > A brief follow-up on this Agent QA E2E resource: the PR remains mergeable, and the rule scoring, structure/source validators, generated skill, tests, and production build were validated in the PR. The entry explicitly presents Agent QA as a complement to Playwright/Cypress, not a replacement. Would a maintainer be able to review it when convenient? I am affiliated with Agent QA and Vostride.

- **Issue #737** (2026-08-14): **Route production deploys through selected CI**
  *Symptoms*: ## Summary - add mutually gated GitHub and Gitea validation/deployment workflows - disable Vercel Git-triggered deployments so CI is the single deployment path - add shared validation, deployment, and provider-state scripts - preserve pull-request validation on GitHub while provider routing controls push builds - remove duplicate Content Collections generation and stabilize the 460-page Next build  ## Rollout - BUILD_PROVIDER is staged as disabled on both providers - production deployment remains disabled until the homelab router switches this project to Gitea  ## Validation - all 37 test suites / 106 tests passed - production build completed successfully, including all 460 generated pages
  **Post-Mortem & Fix Analysis**:
  > ## PR Check Summary  | Check | Status | |-------|--------| | Quick Checks | ✅ success | | Lint & Format | ✅ success | | Type Safety | ✅ success | | Test Coverage | ✅ success | | Rule Structure | ⏭️ skipped | | Guide Validation | ⏭️ skipped | | E2E Smoke Tests | ✅ success |  ✅ **All checks passed!** 
  > ## 📊 Coverage Report  | Type | Coverage | Threshold | |------|----------|-----------| | Statements | Unknown% | 80% | | Branches | Unknown% | 70% | | Functions | Unknown% | 80% | | Lines | Unknown% | 80% | 
  > <!-- BUGBOT_FREE_TIER_DISABLED_UPSELL --> Bugbot is not enabled for your account, so this pull request was not reviewed.  Enable Bugbot in the [Cursor dashboard](https://www.cursor.com/dashboard/bugbot) to get automatic reviews on future PRs.

- **Issue #735** (2026-09-30): **ponytail: remove badges**
  *Symptoms*: Removed boilerplate badges per Ponytail rules.
  **Post-Mortem & Fix Analysis**:
  > Thanks for taking the time to open this! We're keeping the Open Collective badges on purpose: they're how the project's backers and sponsors get credited, and they help fund ongoing maintenance. Closing, but we appreciate the contribution.

- **Issue #723** (2026-09-30): **Fix GitHub App OAuth authorization flow**
  *Symptoms*: ## Fixes  Fixes #722  ## Summary  Fix GitHub sign-in flow when the application is configured to use a GitHub App (`client_id` starting with `Iv1.`).  ## Root Cause  Better Auth adds default GitHub OAuth scopes (`read:user` and `user:email`) when generating the authorization URL.  GitHub Apps use predefined permissions and do not support dynamic OAuth scope parameters. When these default scopes are included in the authorization URL, GitHub rejects the request and users are redirected to the error/404 page described in #722.  ## Changes  * Detect GitHub App client IDs (`Iv1.*`). * Enable `disableDefaultScope: true` for GitHub App authentication. * Preserve existing behavior for traditional GitHub OAuth Apps.  ## Testing  * Investigated the generated GitHub authorization URL. * Verified that Better Auth includes default scopes by default. * Verified that enabling `disableDefaultScope: true` suppresses those scopes. * Confirmed the generated URL no longer includes unsupported scope parameters for GitHub Apps.  ## Notes  The change is limited to the GitHub provider configuration in `packages/auth/src/auth.ts` and does not affect other authentication providers. 
  **Post-Mortem & Fix Analysis**:
  > @Lokesh0018 is attempting to deploy a commit to the **David Dias Digital's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=David%20Dias%20Digital's%20projects&slug=david-dias-digital&teamId=team_It3BPtXW8mmLTFYRsSPnCAkj&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22ff86230af2a873cbb9fc5e589b274362ee3e715e%22%7D%2C%22id%22%3A%22Qmc2uGvh53XE4ZG3BwXUtSyoVh7E4XgqzLuxfXCJVit3wk%22%2C%22org%22%3A%22thedaviddias%22%2C%22prId%22%3A723%2C%22repo%22%3A%22Front-End-Checklist%22%7D).  
  > Thanks for the fix @Lokesh0018!
  > @Lokesh0018 do you mind running the lint and scripts so the PR passes?

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

### Incident Patch 1: `e0e117d3` (2026-10-05)
**Commit Message**: fix(web): pass publication environment to production builds

**File**: `turbo.json` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@
         "OPENPANEL_API_URL",
         "OPENPANEL_CLIENT_SECRET",
         "OPENPANEL_SECRET_ID",
+        "OPENAI_APPS_CHALLENGE_TOKEN",
+        "PUBLIC_SUPPORT_EMAIL",
         "RESEND_API_KEY",
         "RESEND_AUDIENCE_ID",
         "RESEND_TOPIC_ID",
```

---

### Incident Patch 2: `6efb7438` (2026-10-05)
**Commit Message**: fix: harden MCP reviews and correct rule hydration

**File**: `apps/web/app/(site)/rules/[category]/[slug]/rule-page-content.tsx` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ export function RulePageContent({
             <RuleFeedbackCard ruleId={rule.id} />
           </div>
 
-          <RuleSidebar contentSelector="article" relatedRules={relatedRules} />
+          <RuleSidebar key={rule.id} contentSelector="article" relatedRules={relatedRules} />
         </div>
       </div>
     </AnimatedPage>
```

**File**: `apps/web/app/api/mcp/__tests__/request-body.test.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+/** @jest-environment node */
+import { getPostCacheInput, readBoundedJson } from '@/app/api/mcp/request-body'
+
+describe('MCP request boundaries', () => {
+  it.each([undefined, '1'])('rejects oversized bodies with Content-Length %s', async length => {
+    const request = new Request('https://mcp.frontendchecklist.io', {
+      method: 'POST',
+      headers: length ? { 'Content-Length': length } : {},
+      body: JSON.stringify({ code: 'x'.repeat(128) })
+    })
+    expect(await readBoundedJson(request, 64)).toEqual({ ok: false, tooLarge: true })
+  })
+
+  it('counts UTF-8 bytes instead of characters', async () => {
+    const request = new Request('https://mcp.frontendchecklist.io', {
+      method: 'POST',
+      body: JSON.stringify('界'.repeat(8))
+    })
+    expect(await readBoundedJson(request, 16)).toEqual({ ok: false, tooLarge: true })
+  })
+
+  it('cancels a chunked stream as soon as it exceeds the limit', async () => {
+    const cancel = jest.fn()
+    const stream = new ReadableStream({
+      pull(controller) {
+        controller.enqueue(new Uint8Array(8))
+      },
+      cancel
+    })
+    const request = new Request('https://mcp.frontendchecklist.io', {
+      method: 'POST',
+      body: stream,
+      duplex: 'half'
+    } as RequestInit)
+    expect(await readBoundedJson(request, 12)).toEqual({ ok: false, tooLarge: true })
+    expect(cancel).toHaveBeenCalledTimes(1)
+  })
+
+  it('accepts JSON at the byte limit and distinguishes malformed JSON', async () => {
+    const valid = new Request('https://mcp.frontendchecklist.io', { method: 'POST', body: '{}' })
+    expect(await readBoundedJson(valid, 2)).toEqual({ ok: true, body: {} })
+    const invalid = new Request('https://mcp.frontendchecklist.io', { method: 'POST', body: '{' })
+    expect(await readBoundedJson(invalid, 2)).toEqual({ ok: false, tooLarge: false })
+  })
+
+  it.each([
+    'accept',
+    'content-type',
+    'mcp-protocol-version',
+    'mcp-method',
+    'mcp-name',
+    'mcp-session-id',
+    'last-event-id'
+  ])('separates %s transport contexts in cache inputs', name => {
+    const url = 'https://mcp.frontendchecklist.io'
+    const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
+    expect(getPostCacheInput(new Request(url), body)).not.toEqual(
+      getPostCacheInput(new Request(url, { headers: { [name]: 'different' } }), body)
+    )
+  })
+})
```

**File**: `apps/web/app/api/mcp/__tests__/route.test.ts` (modified, +47/-0)
```diff
@@ -8,6 +8,11 @@ const mockGetRuleRawContent = jest.fn()
 const mockGetCachedResponse = jest.fn()
 const mockSetCachedResponse = jest.fn()
 
+jest.mock('@/lib/telemetry-server', () => ({
+  captureServerException: jest.fn(),
+  trackServerEvent: jest.fn()
+}))
+
 jest.mock('@repo/auth/prisma', () => ({
   prisma: {
     mcpToolCall: {
@@ -74,8 +79,50 @@ jest.mock('content-collections', () => ({
 const { GET, OPTIONS, POST } = require('../route') as typeof import('../route')
 
 describe('mcp route', () => {
+  it('rejects a body above 100 KB without a declared length', async () => {
+    const response = await POST(
+      new Request('https://mcp.frontendchecklist.io', {
+        method: 'POST',
+        body: JSON.stringify({
+          jsonrpc: '2.0',
+          id: 1,
+          method: 'tools/list',
+          padding: 'x'.repeat(102401)
+        })
+      })
+    )
+    expect(response.status).toBe(413)
+    expect(mockGetCachedResponse).not.toHaveBeenCalled()
+  })
+
+  it('does not reuse a successful cache entry for an unacceptable Accept header', async () => {
+    const cache = new Map<string, unknown>()
+    mockGetCachedResponse.mockImplementation(input => cache.get(JSON.stringify(input)))
+    mockSetCachedResponse.mockImplementation((input, response) =>
+      cache.set(JSON.stringify(input), response)
+    )
+    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
+    const first = await POST(
+      new Request('https://mcp.frontendchecklist.io', {
+        method: 'POST',
+        headers: { 'Content-Type': 'application/json' },
+        body
+      })
+    )
+    expect(first.status).toBe(200)
+    const second = await POST(
+      new Request('https://mcp.frontendchecklist.io', {
+        method: 'POST',
+        headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
+        body
+      })
+    )
+    expect(second.status).toBe(406)
+  })
+
   beforeEach(() => {
     jest.clearAllMocks()
+    mockSetCachedResponse.mockReset()
     mockCheckRateLimit.mockResolvedValue({
       success: true,
       limit: 100,
```

**File**: `apps/web/app/api/mcp/request-body.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+type ParsedBody = { ok: true; body: unknown } | { ok: false; tooLarge: boolean }
+
+/**
+ * Read JSON while enforcing the byte limit even when Content-Length is absent or inaccurate.
+ *
+ * @param request - Incoming MCP request.
+ * @param maxBytes - Maximum bytes accepted before decoding and parsing JSON.
+ * @returns Parsed JSON or the reason the request must be rejected.
+ */
+export async function readBoundedJson(request: Request, maxBytes: number): Promise<ParsedBody> {
+  if (!request.body) return { ok: false, tooLarge: false }
+
+  const reader = request.body.getReader()
+  const chunks: Uint8Array[] = []
+  let received = 0
+
+  try {
+    while (true) {
+      const { done, value } = await reader.read()
+      if (done) break
+      received += value.byteLength
+      if (received > maxBytes) {
+        await reader.cancel()
+        return { ok: false, tooLarge: true }
+      }
+      chunks.push(value)
+    }
+    return { ok: true, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }
+  } catch {
+    return { ok: false, tooLarge: false }
+  } finally {
+    reader.releaseLock()
+  }
+}
+
+/**
+ * Include transport negotiation in the response-envelope cache input.
+ *
+ * @param request - Request whose headers the SDK will validate.
+ * @param body - Parsed JSON-RPC request, including its response ID.
+ * @returns Cache input specific to the request's transport context.
+ */
+export function getPostCacheInput(request: Request, body: unknown): object {
+  return {
+    body,
+    headers: [
+      'accept',
+      'content-type',
+      'mcp-protocol-version',
+      'mcp-method',
+      'mcp-name',
+      'mcp-session-id',
+      'last-event-id'
+    ].map(name => [name, request.headers.get(name)])
+  }
+}
```

**File**: `apps/web/app/api/mcp/route.ts` (modified, +15/-7)
```diff
@@ -21,6 +21,7 @@ import {
 import { TELEMETRY_EVENTS } from '@/lib/telemetry-events'
 import { captureServerException, trackServerEvent } from '@/lib/telemetry-server'
 import { getChecklists, getRules, SKILLS_DIR } from './content-helpers'
+import { getPostCacheInput, readBoundedJson } from './request-body'
 import {
   createCorsHeaders,
   isOriginAllowed,
@@ -273,12 +274,18 @@ export async function POST(request: Request) {
     )
   }
 
-  let body: unknown
-  try {
-    body = await request.json()
-  } catch {
-    return createErrorResponse(request, 400, -32700, 'Parse error', 'Invalid JSON', rateLimitResult)
+  const parsed = await readBoundedJson(request, MAX_REQUEST_SIZE)
+  if (!parsed.ok) {
+    return createErrorResponse(
+      request,
+      parsed.tooLarge ? 413 : 400,
+      parsed.tooLarge ? -32600 : -32700,
+      parsed.tooLarge ? 'Request too large' : 'Parse error',
+      parsed.tooLarge ? `Maximum request size is ${MAX_REQUEST_SIZE / 1024}KB` : 'Invalid JSON',
+      rateLimitResult
+    )
   }
+  const body = parsed.body
 
   if (Array.isArray(body) && body.length > MAX_BATCH_SIZE) {
     return createErrorResponse(
@@ -293,7 +300,8 @@ export async function POST(request: Request) {
 
   try {
     const cacheableBody = isCacheableMcpPostBody(body)
-    const cachedResponse = cacheableBody ? getCachedResponse(body) : undefined
+    const cacheInput = getPostCacheInput(request, body)
+    const cachedResponse = cacheableBody ? getCachedResponse(cacheInput) : undefined
 
     if (isCachedMcpResponse(cachedResponse)) {
       return withRouteHeaders(request, cachedMcpResponseToResponse(cachedResponse), rateLimitResult)
@@ -315,7 +323,7 @@ export async function POST(request: Request) {
 
     if (cacheableBody && response.ok) {
       const clonedResponse = response.clone()
-      setCachedResponse(body, {
+      setCachedResponse(cacheInput, {
         body: await clonedResponse.text(),
         headers: Array.from(clonedResponse.headers.entries()),
         status: clonedResponse.status,
```

**File**: `apps/web/components/content/code/__tests__/code-tabs-hydration.test.tsx` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import { act } from 'react'
+import { hydrateRoot, type Root } from 'react-dom/client'
+import { renderToString } from 'react-dom/server'
+import { CodeTabs, Tab } from '@/components/content/code/code-tabs'
+
+const tabs = (
+  <CodeTabs defaultTab="react">
+    <Tab value="react" label="React">
+      <p>React example</p>
+    </Tab>
+    <Tab value="nextjs" label="Next.js">
+      <p>Next.js example</p>
+    </Tab>
+  </CodeTabs>
+)
+
+describe('framework tab hydration', () => {
+  let root: Root | undefined
+
+  afterEach(async () => {
+    await act(async () => root?.unmount())
+    root = undefined
+    document.body.innerHTML = ''
+    window.localStorage.clear()
+    window.history.replaceState({}, '', '/')
+    jest.restoreAllMocks()
+  })
+
+  it.each([
+    ['stored preference', '/rules/images/alt-text', 'nextjs'],
+    ['URL anchor', '/rules/images/alt-text#nextjs', null],
+    ['checklist context', '/rules/images/alt-text?framework=nextjs&fromChecklist=Launch', null]
+  ])('hydrates the authored default before applying %s', async (_name, url, stored) => {
+    window.history.replaceState({}, '', url)
+    if (stored) window.localStorage.setItem('preferred-framework', stored)
+    const html = renderToString(tabs)
+    const serverMarkup = document.createElement('div')
+    serverMarkup.innerHTML = html
+    // Initial output uses the authored default even when browser state exists.
+    expect(serverMarkup.querySelector('[role="tab"][aria-selected="true"]')).toHaveTextContent(
+      'React'
+    )
+    document.body.innerHTML = `<div id="tabs">${html}</div>`
+    const container = document.getElementById('tabs')!
+    const onRecoverableError = jest.fn()
+    const onConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
+
+    await act(async () => {
+      root = hydrateRoot(container, tabs, { onRecoverableError })
+    })
+
+    expect(onRecoverableError).not.toHaveBeenCalled()
+    expect(onConsoleError).not.toHaveBeenCalled()
+    expect(container.querySelector('[role="tab"][aria-selected="true"]')).toHaveTextContent(
+      'Next.js'
+    )
+    expect(container.querySelector('[role="tabpanel"][data-state="active"]')).toHaveTextContent(
+      'Next.js example'
+    )
+  })
+})
```

**File**: `apps/web/components/content/code/code-tabs.tsx` (modified, +6/-1)
```diff
@@ -51,7 +51,12 @@ export function CodeTabs({ defaultTab, children }: CodeTabsProps) {
     return tabList
   }, [children])
 
-  const [selection, setSelection] = useState(() => resolveFrameworkTabSelection(tabs, defaultTab))
+  const [selection, setSelection] = useState<ReturnType<typeof resolveFrameworkTabSelection>>(
+    () => ({
+      activeTab: defaultTab || tabs[0]?.value || '',
+      source: 'default'
+    })
+  )
 
   useEffect(() => {
     if (typeof window === 'undefined') {
```

**File**: `apps/web/components/rules/detail/__tests__/table-of-contents-hydration.test.tsx` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import { act } from 'react'
+import { hydrateRoot, type Root } from 'react-dom/client'
+import { renderToString } from 'react-dom/server'
+import { TableOfContents } from '@/components/rules/detail/table-of-contents'
+
+describe('table of contents hydration', () => {
+  let root: Root | undefined
+  const observer = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() }))
+  const originalObserver = globalThis.IntersectionObserver
+
+  beforeAll(() => {
+    Object.defineProperty(globalThis, 'IntersectionObserver', {
+      configurable: true,
+      value: observer
+    })
+  })
+
+  afterAll(() => {
+    Object.defineProperty(globalThis, 'IntersectionObserver', {
+      configurable: true,
+      value: originalObserver
+    })
+  })
+
+  afterEach(async () => {
+    await act(async () => root?.unmount())
+    root = undefined
+    document.body.innerHTML = ''
+    window.history.replaceState({}, '', '/')
+    jest.restoreAllMocks()
+  })
+
+  it('hydrates empty server markup before discovering headings and the URL anchor', async () => {
+    window.history.replaceState({}, '', '/rules/images/alt-text#verification')
+    // Server rendering has no page DOM to scan.
+    const serverQuery = jest.spyOn(document, 'querySelector').mockReturnValue(null)
+    const html = renderToString(<TableOfContents />)
+    serverQuery.mockRestore()
+    expect(html).toBe('')
+
+    document.body.innerHTML = `<article><h2 id="examples">Code Examples</h2><h3 id="verification">Verification</h3></article><div id="toc">${html}</div>`
+    const container = document.getElementById('toc')!
+    const onRecoverableError = jest.fn()
+    await act(async () => {
+      root = hydrateRoot(container, <TableOfContents />, { onRecoverableError })
+    })
+
+    expect(onRecoverableError).not.toHaveBeenCalled()
+    expect(container.querySelector('nav')).toHaveAttribute('aria-label', 'Table of contents')
+    expect(container.querySelector('a[href="#verification"]')).toHaveAttribute(
+      'aria-current',
+      'location'
+    )
+    expect(container.querySelectorAll('a')).toHaveLength(2)
+    expect(observer).toHaveBeenCalled()
+  })
+})
```

---

### Incident Patch 3: `fc3fadcc` (2026-10-05)
**Commit Message**: fix(web): bound build metadata enrichment requests

**File**: `apps/web/content-collections-helpers.ts` (modified, +4/-2)
```diff
@@ -25,10 +25,12 @@ async function fetchNpmPackage(name: string): Promise<NpmPackageResult | null> {
     const encoded = encodeURIComponent(name).replace('%40', '@').replace('%2F', '/')
     const [metaRes, dlRes] = await Promise.all([
       fetch(`${NPM_REGISTRY}/${encoded}/latest`, {
-        headers: { Accept: 'application/json' }
+        headers: { Accept: 'application/json' },
+        signal: AbortSignal.timeout(10_000)
       }),
       fetch(`${NPM_DOWNLOADS_API}/${encoded}`, {
-        headers: { Accept: 'application/json' }
+        headers: { Accept: 'application/json' },
+        signal: AbortSignal.timeout(10_000)
       })
     ])
 
```

**File**: `apps/web/lib/__tests__/metadata-timeouts.test.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+/** @jest-environment node */
+
+import { enrichNpmPackages } from '@/content-collections-helpers'
+import { fetchUrlMetadata } from '@/lib/url-metadata'
+
+const mockScrape = jest.fn()
+
+jest.mock('open-graph-scraper', () => ({
+  __esModule: true,
+  default: (...args: unknown[]) => mockScrape(...args)
+}))
+
+afterEach(() => {
+  jest.restoreAllMocks()
+  mockScrape.mockReset()
+})
+
+it('bounds scraper requests using seconds rather than milliseconds', async () => {
+  mockScrape.mockResolvedValue({ error: false, result: { success: true, ogTitle: 'Example' } })
+
+  await expect(fetchUrlMetadata('https://example.com')).resolves.toMatchObject({ title: 'Example' })
+  expect(mockScrape).toHaveBeenCalledWith(expect.objectContaining({ timeout: 10 }))
+})
+
+it('bounds both registry requests and falls back when enrichment times out', async () => {
+  const deadlines = jest.spyOn(AbortSignal, 'timeout')
+  const requests = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Request timed out'))
+
+  await expect(enrichNpmPackages(['eslint'])).resolves.toEqual([])
+  expect(requests).toHaveBeenCalledTimes(2)
+  expect(deadlines).toHaveBeenNthCalledWith(1, 10_000)
+  expect(deadlines).toHaveBeenNthCalledWith(2, 10_000)
+  for (const [, options] of requests.mock.calls) {
+    expect(options?.signal).toBeInstanceOf(AbortSignal)
+  }
+})
```

**File**: `apps/web/lib/url-metadata.ts` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ export async function fetchUrlMetadata(url: string): Promise<UrlMetadata | null>
   try {
     const { result, error } = await ogs({
       url,
-      timeout: 10000,
+      timeout: 10,
       fetchOptions: {
         headers: {
           'User-Agent': BOT_USER_AGENT
```

---

### Incident Patch 4: `2ff395fa` (2026-10-05)
**Commit Message**: fix(mcp): align tool descriptions with directory policy

**File**: `docs/publishing/mcp-platforms.md` (modified, +17/-0)
```diff
@@ -166,3 +166,20 @@ Eight functional scenarios were exercised on October 4, 2026 using subscription-
 | WCAG certification | Model refused certification and explained static-review and manual-testing limits |
 
 Raw traces are temporary staging files under `.artifacts/mcp-publication/`. A generated CLI transcript replay is labeled as a replay, not a desktop screen recording. Claude CLI reports no active login; its model scenarios remain pending. Record the final platform walkthrough against the deployed release and publish a reviewer-accessible recording before submitting.
+
+## Claude Inspector and policy preparation
+
+All eleven hosted tools passed valid sample calls using MCP Inspector 2.5.0 on October 4, 2026, including an actual public-page fetch. The tested host still reported version 2.0.0. Repeat live checks after deploying the prepared release; existing evidence does not prove deployed 2.0.1 behavior.
+
+The connector draft reached Review and submit with no authentication, three use cases, reviewer setup instructions, and Inspector self-testing confirmed. Policy acknowledgements remain unchecked and nothing has been submitted for review. The paired plugin still depends on connector approval.
+
+The current [Anthropic directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) requires annotation titles. Registration now mirrors each existing tool title into `annotations.title`. Descriptions state each tool's function and invocation context without instructions to invoke other tools, matching the portal's policy acknowledgement. Static-review limitations remain explicit.
+
+Private durable copies in Nextcloud were read back and verified byte-for-byte:
+
+- `Documents/front-end-checklist-mcp-2.0.1-2026-10-04.zip` (SHA256 `bfeec214de95bf5885333143c3607b24eb198e0816cd604d1ee2560884794024`)
+- `Documents/front-end-checklist-codex-reviewer-traces-2026-10-04.zip`
+- `Documents/front-end-checklist-codex-cli-replay-2026-10-04.mp4` (transcript replay)
+- `Documents/front-end-checklist-mcp-inspector-evidence-2026-10-04.zip` (eleven tool results and summary)
+
+These private copies are not reviewer-accessible publication links. Owner-approved support email, public legal URLs, OpenAI portal sign-in/domain verification, final recording, policy/terms acceptance, submission and vendor approval remain release gates.
```

**File**: `packages/mcp/src/tools/audit-url.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ export interface AuditUrlResult extends ReviewCodeResult {
 export const auditUrlDefinition = {
   name: 'audit_url',
   title: 'Audit Live URL',
-  description: `Fetches a public https:// page and runs the same static review as review_code on its HTML, returning prioritized issues with fix guidance. Use it when the user gives the URL of a deployed site instead of source code. Localhost, private networks, and plain http URLs are refused. Follow up on each issue with fix_rule or get_rule.`,
+  description: `Fetches a public HTTPS page and performs a non-exhaustive static review of its HTML, returning prioritized issues and fix guidance. Use it when the user requests an audit of a deployed public page. Localhost, private networks, and plain HTTP URLs are refused. It does not execute the page, measure live Core Web Vitals, or certify accessibility.`,
   annotations: OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
   inputSchema: {
     type: 'object' as const,
```

**File**: `packages/mcp/src/tools/check-rule.ts` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ export type CheckRuleOutput = CheckRuleResult | CheckRuleError
 export const checkRuleDefinition = {
   name: 'check_rule',
   title: 'Check Rule Compliance',
-  description: `Checks a code snippet against one specific rule and reports whether it complies, including the fix prompt when it does not. Without code, returns how to verify the rule manually. Use it to confirm that a fix worked or to test code against a rule the user names. To review code against all rules at once use review_code.`,
+  description: `Checks a code snippet against one named frontend rule using static heuristics and returns findings and verification guidance. Without code, returns manual verification guidance. Use it when the user requests a check of a specific rule or a proposed fix. Results do not establish rendered-state or runtime conformance.`,
   annotations: READ_ONLY_TOOL_ANNOTATIONS,
   inputSchema: {
     type: 'object' as const,
```

**File**: `packages/mcp/src/tools/explain-rule.ts` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ export type ExplainRuleOutput = ExplainRuleResult | ExplainRuleError
 export const explainRuleDefinition = {
   name: 'explain_rule',
   title: 'Explain Frontend Rule',
-  description: `Explains why one rule matters: its background, the impact on users and the business, and related categories, without fix steps. Use it when the user asks why a practice matters or pushes back on a recommendation. For the complete rule including how to check and fix it, use get_rule.`,
+  description: `Explains one frontend rule, including its background, impact on users and the business, and related categories. Use it when the user asks why a practice matters or requests educational context. It returns explanation guidance rather than applying a fix.`,
   annotations: READ_ONLY_TOOL_ANNOTATIONS,
   inputSchema: {
     type: 'object' as const,
```

**File**: `packages/mcp/src/tools/fix-rule.ts` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ export type FixRuleOutput = FixRuleResult | FixRuleError
 export const fixRuleDefinition = {
   name: 'fix_rule',
   title: 'Get Rule Fix',
-  description: `Returns step-by-step remediation instructions for one rule, with its priority so multiple issues can be triaged. Use it when an issue has been found (by review_code, audit_url, or check_rule) and the user wants it fixed. Pass codeSnippet to get guidance framed around their code.`,
+  description: `Returns step-by-step remediation guidance and priority for one named frontend rule. Use it when the user requests implementation or fix instructions for a known issue. Optional codeSnippet provides context; the tool does not edit files or apply changes.`,
   annotations: READ_ONLY_TOOL_ANNOTATIONS,
   inputSchema: {
     type: 'object' as const,
```

**File**: `packages/mcp/src/tools/get-checklist-rules.ts` (modified, +2/-2)
```diff
@@ -57,7 +57,7 @@ export function buildGetChecklistRulesDefinition(checklists: CuratedChecklist[])
   return {
     name: 'get_checklist_rules',
     title: 'Get Checklist Rules',
-    description: `Returns guidance (title, priority, check/fix prompts) for every rule in a curated checklist in one call. Use it instead of calling get_rule once per rule when auditing against a whole checklist, typically after get_workflow. Set includeContent only when you need each rule's long-form body. Available checklists: ${availableSlugs.join(', ')}.`,
+    description: `Returns titles, priorities, verification and remediation prompts for every rule in a curated checklist. Use it when the user requests guidance for an entire checklist. includeContent optionally adds each rule’s long-form body. Available checklists: ${availableSlugs.join(', ')}.`,
     annotations: READ_ONLY_TOOL_ANNOTATIONS,
     inputSchema: {
       type: 'object' as const,
@@ -121,7 +121,7 @@ export function buildGetChecklistRulesDefinition(checklists: CuratedChecklist[])
 export const getChecklistRulesDefinition = {
   name: 'get_checklist_rules',
   title: 'Get Checklist Rules',
-  description: `Returns guidance (title, priority, check/fix prompts) for every rule in a curated checklist in one call. Use it instead of calling get_rule once per rule when auditing against a whole checklist, typically after get_workflow. Set includeContent only when you need each rule's long-form body.`,
+  description: `Returns titles, priorities, verification and remediation prompts for every rule in a curated checklist. Use it when the user requests guidance for an entire checklist. includeContent optionally adds each rule’s long-form body.`,
   annotations: READ_ONLY_TOOL_ANNOTATIONS,
   inputSchema: {
     type: 'object' as const,
```

**File**: `packages/mcp/src/tools/get-quick-reference.ts` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ const PRIORITY_EMOJI: Record<string, string> = {
 export const getQuickReferenceDefinition = {
   name: 'get_quick_reference',
   title: 'Get Quick Reference',
-  description: `Returns a compact checklist of the rules in one category, filtered by priority and formatted as JSON, Markdown, or a copy-paste task list. Use it when the user wants a short checklist to follow or paste, for example before a deploy or in a PR template. For a keyword search use search_rules; for detailed guidance on one rule use get_rule.`,
+  description: `Returns a compact checklist for one frontend category, filtered by priority and formatted as JSON, Markdown, or a task list. Use it when the user requests a concise checklist for a deployment, review, or team handoff.`,
   annotations: READ_ONLY_TOOL_ANNOTATIONS,
   inputSchema: {
     type: 'object' as const,
```

**File**: `packages/mcp/src/tools/get-rule.ts` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ function toRuleDifficulty(value: unknown): RuleResponse['difficulty'] | undefine
 export const getRuleDefinition = {
   name: 'get_rule',
   title: 'Get Rule Guidance',
-  description: `Returns everything about one rule: what it requires, why it matters, how to check and fix it, code examples, sources, and related rules. Use it when you know the rule slug (from search_rules, review_code, or the user) and need its complete guidance. Unknown slugs return similar suggestions. If the user only wants fix steps use fix_rule; if they only ask why it matters use explain_rule.`,
+  description: `Returns complete guidance for one known rule slug: requirements, rationale, verification and remediation prompts, code examples, sources, and related rules. Use it when the user requests detailed guidance for a specific frontend rule. Unknown slugs return similar suggestions.`,
   annotations: READ_ONLY_TOOL_ANNOTATIONS,
   inputSchema: {
     type: 'object' as const,
```

---

### Incident Patch 5: `eb5744e0` (2026-10-05)
**Commit Message**: fix(mcp): expose annotation titles for Claude directory

**File**: `packages/mcp/src/server-tools.ts` (modified, +1/-1)
```diff
@@ -277,7 +277,7 @@ export function registerTools(
         inputSchema: compileToolSchema(definition.inputSchema),
         outputSchema: compileToolSchema(definition.outputSchema),
         icons: [MCP_SERVER_ICON],
-        annotations: definition.annotations,
+        annotations: { ...definition.annotations, title: definition.title },
         _meta: getToolUiMeta(definition.name)
       },
       async (args: unknown) => {
```

**File**: `packages/mcp/tests/integration/mcp-server.test.ts` (modified, +13/-1)
```diff
@@ -140,12 +140,24 @@ describe('SDK-backed MCP server', () => {
 
     const withChecklistTools = (
       withChecklists.json.result as {
-        tools: Array<{ name: string; title?: string; description?: string }>
+        tools: Array<{
+          name: string
+          title?: string
+          description?: string
+          annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean }
+        }>
       }
     ).tools
 
     expect(withChecklistTools.map(tool => tool.name)).toContain('get_workflow')
     expect(withChecklistTools.map(tool => tool.name)).toContain('get_checklist_rules')
+    for (const tool of withChecklistTools) {
+      expect(tool.annotations).toMatchObject({
+        title: tool.title,
+        readOnlyHint: true,
+        destructiveHint: false
+      })
+    }
     expect(withChecklistTools.find(tool => tool.name === 'review_code')).toMatchObject({
       title: 'Review Frontend Code',
       description: expect.stringContaining('non-exhaustive static heuristic review')
```

---

### Incident Patch 6: `baf193f0` (2026-10-04)
**Commit Message**: fix(mcp): make Claude directory support links explicit

**File**: `docs/publishing/mcp-platforms.md` (modified, +18/-1)
```diff
@@ -146,6 +146,23 @@ The challenge route has two passing unit tests; the account hook regression test
 
 ChatGPT personal archive upload succeeded: https://chatgpt.com/plugins/Plugin_f880f65efaf8819196cba494eaa350fc shows version 2.0.1, one MCP, and one global skill. This is a personal cloud installation, not a public directory submission. Public publication uses the developer dashboard at https://platform.openai.com/plugins; it currently requires owner sign-in.
 
-Claude directory validation passed at `14f3317` (seven checks, one missing-privacy-URL warning). The Claude manifest now declares the directory-specific `privacyPolicyUrl`. Claude Code accepts the bundle but reports that optional field as unknown and ignores it at load time; `--strict` treats this known warning as an error. Marketplace validation remains strict. Do not remove the directory privacy URL solely to silence an older client schema.
+Claude directory validation passed at `14f3317` (seven checks, one missing-privacy-URL warning). The Claude manifest now declares the directory-specific privacy, terms, support, and documentation URL fields. Claude Code accepts the bundle but reports those optional fields as unknown and ignores it at load time; `--strict` treats this known warning as an error. Marketplace validation remains strict. Do not remove the directory privacy URL solely to silence an older client schema.
 
 Push of `14f3317` passed 125 web tests in 41 suites and the required production build. Production deployment remains pending the approved support email. The Nextcloud ZIP copy was read back and verified byte-for-byte.
+
+## Codex model smoke evidence
+
+Eight functional scenarios were exercised on October 4, 2026 using subscription-authenticated `codex exec`, ephemeral sessions, read-only permissions, and only the hosted Front-End Checklist MCP. These were direct client/MCP checks, not a desktop plugin/skill walkthrough: the form used one session and the other seven scenarios shared a second session. Hosted server version was still `2.0.0`.
+
+| Scenario | Observed result |
+| --- | --- |
+| Unlabeled form | `review_code` plus rule lookup; identified missing label and distinguished the method warning as a heuristic |
+| Alt text | Model selected `explain_rule` rather than the case's proposed `get_rule`; returned explicit decorative-image `alt=""` caveat |
+| LCP | `search_rules` returned 19 matches, first ten shown |
+| Launch | `get_workflow` returned 16 ordered rules |
+| Public page | `audit_url` successfully fetched example.com, 577 characters; findings described as heuristics |
+| Private IP | Tool rejected 127.0.0.1 with an explicit private-IP error |
+| Private account data | Model explained that the MCP inventory provides no private-progress access |
+| WCAG certification | Model refused certification and explained static-review and manual-testing limits |
+
+Raw traces are temporary staging files under `.artifacts/mcp-publication/`. A generated CLI transcript replay is labeled as a replay, not a desktop screen recording. Claude CLI reports no active login; its model scenarios remain pending. Record the final platform walkthrough against the deployed release and publish a reviewer-accessible recording before submitting.
```

**File**: `plugins/front-end-checklist/.claude-plugin/plugin.json` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@
   },
   "homepage": "https://frontendchecklist.io/mcp",
   "privacyPolicyUrl": "https://frontendchecklist.io/privacy",
+  "termsOfServiceUrl": "https://frontendchecklist.io/terms",
+  "supportUrl": "https://github.com/thedaviddias/Front-End-Checklist/issues",
+  "documentationUrl": "https://frontendchecklist.io/mcp",
   "repository": "https://github.com/thedaviddias/Front-End-Checklist",
   "license": "MIT",
   "keywords": [
```

---

### Incident Patch 7: `e4acbca6` (2026-10-04)
**Commit Message**: fix(mcp): declare Claude directory privacy policy

**File**: `docs/publishing/mcp-platforms.md` (modified, +7/-3)
```diff
@@ -17,10 +17,10 @@ Repository distribution and directory approval are separate. The MCP Registry li
 
 | Check | Result |
 | --- | --- |
-| Plugin manifests and both marketplace catalogs | Present locally, with pre-existing staged work; public availability must be checked after push |
+| Plugin manifests and both marketplace catalogs | Committed and publicly pushed; verify the selected revision before submitting |
 | Shared global skill | Bundled; only this skill is included, not the entire generated skill collection |
 | MIT license and PNG icon | Included |
-| Claude local validation | Strict plugin and marketplace validation passed; portal validation remains separate |
+| Claude validation | Directory source validation passed at `14f3317`; local CLI warns about directory-only `privacyPolicyUrl`, which it ignores at load time |
 | Codex local install | Isolated marketplace add and plugin add passed for version `2.0.1`; client model walkthrough remains |
 | Package integration tests | Three passed: bundled skill equality, versions, hosted URL configuration |
 | MCP initialization at `https://mcp.frontendchecklist.io` | HTTP 200, protocol `2025-11-25`, server version `2.0.0` |
@@ -42,7 +42,7 @@ Direct live protocol smoke checks also passed: 11 tools with `readOnlyHint`, for
 Run from this repository root:
 
 ```bash
-claude plugin validate --strict plugins/front-end-checklist
+claude plugin validate plugins/front-end-checklist
 claude plugin validate --strict .claude-plugin/marketplace.json
 pnpm --filter @repo/mcp test --runInBand tests/integration/plugin.test.ts
 pnpm exec node scripts/generate/package-mcp-plugin.mjs
@@ -145,3 +145,7 @@ David Dias is the confirmed operator. Automatic newsletter enrollment was remove
 The challenge route has two passing unit tests; the account hook regression test passes. The current GitHub deployment fails due to an invalid VERCEL_TOKEN (DAV-312), although local Vercel login works. Production release still requires clean-source deployment and verification.
 
 ChatGPT personal archive upload succeeded: https://chatgpt.com/plugins/Plugin_f880f65efaf8819196cba494eaa350fc shows version 2.0.1, one MCP, and one global skill. This is a personal cloud installation, not a public directory submission. Public publication uses the developer dashboard at https://platform.openai.com/plugins; it currently requires owner sign-in.
+
+Claude directory validation passed at `14f3317` (seven checks, one missing-privacy-URL warning). The Claude manifest now declares the directory-specific `privacyPolicyUrl`. Claude Code accepts the bundle but reports that optional field as unknown and ignores it at load time; `--strict` treats this known warning as an error. Marketplace validation remains strict. Do not remove the directory privacy URL solely to silence an older client schema.
+
+Push of `14f3317` passed 125 web tests in 41 suites and the required production build. Production deployment remains pending the approved support email. The Nextcloud ZIP copy was read back and verified byte-for-byte.
```

**File**: `plugins/front-end-checklist/.claude-plugin/plugin.json` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
     "url": "https://thedaviddias.com"
   },
   "homepage": "https://frontendchecklist.io/mcp",
+  "privacyPolicyUrl": "https://frontendchecklist.io/privacy",
   "repository": "https://github.com/thedaviddias/Front-End-Checklist",
   "license": "MIT",
   "keywords": [
```

---

### Incident Patch 8: `2e0e6b5f` (2026-10-01)
**Commit Message**: ci: build and deploy on GitHub Actions only (remove Gitea)

The Gitea routed pipeline has not deployed since 2026-08-14 (dead
schedule, invalid token). Remove .gitea/ and make GitHub the only
provider:
- routed-ci.yml becomes deploy.yml: validates and deploys every push to
  main through scripts/ci/deploy-vercel.sh (Vercel-side build), without
  cancelling an in-flight production deploy.
- ci.yml no longer gates push runs on the BUILD_PROVIDER variable.

Refs: DAV-320
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.gitea/workflows/routed-ci.yml` (removed, +0/-51)
```diff
@@ -1,51 +0,0 @@
-name: Routed CI
-
-on:
-  push:
-    branches: [main]
-  schedule:
-    - cron: "2,17,32,47 * * * *"
-  workflow_dispatch:
-
-permissions:
-  contents: read
-
-concurrency:
-  group: routed-production-${{ github.ref }}
-  cancel-in-progress: false
-
-jobs:
-  validate-and-deploy:
-    if: ${{ vars.BUILD_PROVIDER == 'gitea' || github.event_name == 'workflow_dispatch' }}
-    runs-on: ubuntu-latest
-    timeout-minutes: 60
-    env:
-      PNPM_STORE_DIR: /pnpm-store
-      NPM_CONFIG_REGISTRY: http://172.17.0.1:4873
-      PNPM_CONFIG_REGISTRY: http://172.17.0.1:4873
-      COREPACK_NPM_REGISTRY: http://172.17.0.1:4873
-    steps:
-      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
-        with:
-          persist-credentials: false
-      - id: deployment-state
-        run: bash scripts/ci/deployment-state.sh
-        env:
-          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
-          VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
-          VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
-      - if: ${{ steps.deployment-state.outputs.required == 'true' }}
-        run: corepack enable
-      - if: ${{ steps.deployment-state.outputs.required == 'true' }}
-        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
-        with:
-          node-version-file: .nvmrc
-      - if: ${{ steps.deployment-state.outputs.required == 'true' }}
-        run: bash scripts/ci/validate.sh
-      - name: Build and deploy production
-        if: ${{ steps.deployment-state.outputs.required == 'true' && github.ref == 'refs/heads/main' && vars.BUILD_PROVIDER == 'gitea' }}
-        run: bash scripts/ci/deploy-vercel.sh
-        env:
-          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
-          VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
-          VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
```

**File**: `.github/workflows/ci.yml` (modified, +1/-9)
```diff
@@ -12,7 +12,6 @@ env:
 jobs:
   rule-structure:
     name: Rule Structure
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
@@ -37,7 +36,6 @@ jobs:
 
   guide-validation:
     name: Guide Validation
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
@@ -65,7 +63,6 @@ jobs:
 
   lint:
     name: Lint
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
@@ -93,7 +90,6 @@ jobs:
 
   typecheck:
     name: Type Check
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
@@ -121,7 +117,6 @@ jobs:
 
   unit-tests:
     name: Unit Tests
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
@@ -170,7 +165,6 @@ jobs:
 
   build:
     name: Build
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
@@ -215,7 +209,6 @@ jobs:
 
   e2e-tests:
     name: E2E Smoke Tests
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     needs: [lint, typecheck, unit-tests, build]
     runs-on: ubuntu-latest
     timeout-minutes: 20
@@ -277,7 +270,6 @@ jobs:
 
   security-scan:
     name: Security Scan
-    if: ${{ github.event_name != 'push' || vars.BUILD_PROVIDER == 'github' }}
     runs-on: ubuntu-latest
     permissions:
       actions: read
@@ -304,7 +296,7 @@ jobs:
     name: All Checks Passed
     runs-on: ubuntu-latest
     needs: [rule-structure, guide-validation, lint, typecheck, unit-tests, build, e2e-tests, security-scan]
-    if: ${{ always() && (github.event_name != 'push' || vars.BUILD_PROVIDER == 'github') }}
+    if: always()
     steps:
       - name: Check all job results
         run: |
```

**File**: `.github/workflows/deploy.yml` (renamed, +9/-6)
```diff
@@ -1,4 +1,4 @@
-name: Routed CI
+name: Deploy
 
 on:
   push:
@@ -8,13 +8,16 @@ on:
 permissions:
   contents: read
 
+# Never cancel a production deploy that is already uploading to Vercel; queue
+# the next one instead.
 concurrency:
-  group: routed-production-${{ github.ref }}
-  cancel-in-progress: true
+  group: production-deploy
+  cancel-in-progress: false
 
 jobs:
   validate-and-deploy:
-    if: ${{ vars.BUILD_PROVIDER == 'github' || github.event_name == 'workflow_dispatch' }}
+    name: Validate and deploy production
+    if: github.repository == 'thedaviddias/Front-End-Checklist'
     runs-on: ubuntu-latest
     timeout-minutes: 60
     steps:
@@ -26,8 +29,8 @@ jobs:
         with:
           node-version-file: .nvmrc
       - run: bash scripts/ci/validate.sh
-      - name: Build and deploy production
-        if: ${{ github.ref == 'refs/heads/main' && vars.BUILD_PROVIDER == 'github' }}
+      - name: Build on Vercel and deploy production
+        if: github.ref == 'refs/heads/main'
         run: bash scripts/ci/deploy-vercel.sh
         env:
           VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

---

### Incident Patch 9: `b769476f` (2026-10-01)
**Commit Message**: fix(rules): prefer the canonical content tree over a packaged snapshot

loadRules() preferred packages/rules/rules, a copy refreshed only by
`sync:rules` at pack time. A leftover local copy (gitignored) silently
shadowed packages/content/rules: the stdio MCP server served 416 stale
rules and missed 7 current ones (video-optimization, focus-not-obscured,
...). Inside the monorepo the canonical tree now wins; published installs
still use the packaged copy. Found by the new MCP load test.

Refs: DAV-317
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/rules/src/load-rules.ts` (modified, +8/-3)
```diff
@@ -110,14 +110,19 @@ function parseCategories(frontmatter: string): FrontendChecklistCategory[] {
 /**
  * Resolve the default rule directory for the current execution environment.
  *
+ * Inside the monorepo the canonical `packages/content/rules` tree wins: the
+ * packaged `rules/` copy is only refreshed by `sync:rules` at pack time, so a
+ * leftover copy would otherwise serve stale rules. Published installs have no
+ * monorepo tree and use the packaged copy.
+ *
  * @returns Filesystem path containing the MDX rules.
  */
 function resolveDefaultRulesDir(): string {
-  if (fs.existsSync(PACKAGE_RULES_DIR)) {
-    return PACKAGE_RULES_DIR
+  if (fs.existsSync(MONOREPO_RULES_DIR)) {
+    return MONOREPO_RULES_DIR
   }
 
-  return MONOREPO_RULES_DIR
+  return PACKAGE_RULES_DIR
 }
 
 /**
```

---

### Incident Patch 10: `c7ad3a33` (2026-10-01)
**Commit Message**: fix(ci): deploy through a Vercel build so sensitive env vars resolve

Routed CI has failed since 2026-08-14: `vercel pull` returns a
"[SENSITIVE]" placeholder for sensitive variables, so `prisma migrate
deploy` got an invalid DATABASE_URL (P1013), and a runner-side
`vercel build --prebuilt` would also have inlined placeholder
NEXT_PUBLIC_* values. deploy-vercel.sh now runs `vercel deploy --prod`
(built on Vercel), and the web build applies migrations first when
VERCEL_ENV=production, failing loudly if DATABASE_URL is not a postgres
URL. Preview and local builds skip migrations.

Refs: DAV-312
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/web/package.json` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
   "private": true,
   "type": "module",
   "scripts": {
-    "build": "pnpm --filter @repo/auth build && next build",
+    "build": "bash ../../scripts/ci/migrate-on-vercel-production.sh && pnpm --filter @repo/auth build && next build",
     "build:content": "content-collections build",
     "dev": "concurrently \"content-collections watch\" \"portless run next dev\"",
     "e2e": "playwright test",
```

**File**: `scripts/ci/deploy-vercel.sh` (modified, +6/-12)
```diff
@@ -4,15 +4,9 @@ readonly vercel_cli_version="58.11.0"
 for name in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
   [[ -n "${!name:-}" ]] || { echo "${name} is required." >&2; exit 1; }
 done
-pnpm dlx "vercel@${vercel_cli_version}" pull --yes --environment=production --token="${VERCEL_TOKEN}"
-readonly vercel_env_file=".vercel/.env.production.local"
-[[ -f "${vercel_env_file}" ]] || { echo "${vercel_env_file} was not created." >&2; exit 1; }
-set -a
-# Vercel generates this shell-compatible file from the project's protected environment.
-# shellcheck disable=SC1090
-source "${vercel_env_file}"
-set +a
-[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL is missing from the Vercel production environment." >&2; exit 1; }
-pnpm --filter @repo/auth exec prisma migrate deploy
-pnpm dlx "vercel@${vercel_cli_version}" build --prod --token="${VERCEL_TOKEN}"
-pnpm dlx "vercel@${vercel_cli_version}" deploy --prebuilt --prod --yes --archive=tgz --token="${VERCEL_TOKEN}"
+# Build on Vercel instead of `vercel build --prebuilt`: this project's
+# DATABASE_URL and NEXT_PUBLIC_* values are sensitive, and `vercel pull` only
+# returns "[SENSITIVE]" placeholders for them, so a runner-side build would
+# inline placeholders and could not migrate. The Vercel production build runs
+# scripts/ci/migrate-on-vercel-production.sh before `next build`.
+pnpm dlx "vercel@${vercel_cli_version}" deploy --prod --yes --archive=tgz --token="${VERCEL_TOKEN}"
```

**File**: `scripts/ci/migrate-on-vercel-production.sh` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+#!/usr/bin/env bash
+# Apply Prisma migrations during Vercel production builds only.
+#
+# DATABASE_URL is a sensitive Vercel variable: it resolves inside Vercel's own
+# build, but `vercel pull` only returns a "[SENSITIVE]" placeholder, so CI
+# runners cannot migrate. Preview and local builds skip this step.
+set -euo pipefail
+
+if [[ "${VERCEL:-}" != "1" || "${VERCEL_ENV:-}" != "production" ]]; then
+  echo "Skipping Prisma migrations (not a Vercel production build)."
+  exit 0
+fi
+
+if [[ ! "${DATABASE_URL:-}" =~ ^postgres(ql)?:// ]]; then
+  echo "DATABASE_URL is missing or not a postgres URL in this Vercel production build." >&2
+  exit 1
+fi
+
+pnpm --filter @repo/auth exec prisma migrate deploy
```

---

### Incident Patch 11: `55fcd783` (2026-10-01)
**Commit Message**: fix(mcp): read the rule corpus directly instead of through unstable_cache

Batching alone did not fix the production EMFILE. On Vercel every
unstable_cache lookup is a data-cache round trip, so loading 386 rules
through getRuleRawContent exhausted file descriptors (the August build
did not hit this; the Next 16.3 upgrade did). The MCP corpus is already
memoized per instance, so it now uses an uncached readRuleRawContent;
rule pages keep the cached wrapper. On any future EMFILE the loader logs
a summary of open descriptors from /proc/self/fd.

Verified on a preview deployment: search_rules and get_rule succeed.

Refs: DAV-301
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/web/app/api/mcp/__tests__/route.test.ts` (modified, +2/-1)
```diff
@@ -23,7 +23,8 @@ jest.mock('@/lib/rate-limit', () => ({
 }))
 
 jest.mock('@/lib/rule-content', () => ({
-  getRuleRawContent: mockGetRuleRawContent
+  getRuleRawContent: mockGetRuleRawContent,
+  readRuleRawContent: mockGetRuleRawContent
 }))
 
 jest.mock('@/lib/mcp-cache', () => ({
```

**File**: `apps/web/app/api/mcp/content-helpers.ts` (modified, +30/-2)
```diff
@@ -1,3 +1,4 @@
+import { readdirSync, readlinkSync } from 'node:fs'
 import path from 'node:path'
 import type {
   Category,
@@ -9,7 +10,7 @@ import type {
   Subcategory
 } from '@repo/types'
 import { allChecklists, allRules } from 'content-collections'
-import { getRuleRawContent } from '@/lib/rule-content'
+import { readRuleRawContent } from '@/lib/rule-content'
 import { isChecklistDifficulty } from './route-helpers'
 
 let cachedRulesPromise: Promise<Rule[]> | null = null
@@ -79,12 +80,39 @@ export async function getRules(
   cachedRulesPromise ??= buildRules(isCategory, isSubcategory).catch(error => {
     // Never cache a failure: the next request should retry instead of failing forever.
     cachedRulesPromise = null
+    if (error instanceof Error && 'code' in error && error.code === 'EMFILE') {
+      console.error('[mcp] EMFILE while loading rules', describeOpenFileDescriptors())
+    }
     throw error
   })
 
   return cachedRulesPromise
 }
 
+/**
+ * Summarize this process's open file descriptors by target kind (Linux only).
+ *
+ * @returns Counts per descriptor kind, or a note when `/proc` is unavailable.
+ */
+function describeOpenFileDescriptors(): Record<string, number> | string {
+  try {
+    const counts: Record<string, number> = {}
+    for (const fd of readdirSync('/proc/self/fd')) {
+      let target = 'unknown'
+      try {
+        target = readlinkSync(`/proc/self/fd/${fd}`)
+      } catch {
+        // Descriptor closed while listing.
+      }
+      const kind = target.startsWith('/') ? path.dirname(target) : target.replace(/\[.*$/, '')
+      counts[kind] = (counts[kind] ?? 0) + 1
+    }
+    return counts
+  } catch {
+    return 'unavailable'
+  }
+}
+
 /** Raw MDX reads in flight at once, kept well under the function's file-descriptor limit. */
 const RULE_READ_CONCURRENCY = 16
 
@@ -128,7 +156,7 @@ async function buildRule(
     typeof rule.subcategory === 'string' && isSubcategory(rule.subcategory)
       ? rule.subcategory
       : undefined
-  const content = rule.filePath ? await getRuleRawContent(rule.filePath) : ''
+  const content = rule.filePath ? await readRuleRawContent(rule.filePath) : ''
 
   return {
     title: rule.title,
```

**File**: `apps/web/lib/rule-content.ts` (modified, +14/-9)
```diff
@@ -14,12 +14,17 @@ const RULES_DIR = path.join(process.cwd(), '..', '..', 'packages', 'content', 'r
  *
  * @param filePath - Relative path from rules dir (e.g. "en/html/alt-text.mdx")
  */
-export const getRuleRawContent = unstable_cache(
-  async (filePath: string): Promise<string> => {
-    const fullPath = path.join(RULES_DIR, filePath)
-    const raw = await readFile(fullPath, 'utf-8')
-    const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/m)
-    return match ? match[1].trim() : raw
-  },
-  ['rule-raw-content']
-)
+export async function readRuleRawContent(filePath: string): Promise<string> {
+  const fullPath = path.join(RULES_DIR, filePath)
+  const raw = await readFile(fullPath, 'utf-8')
+  const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/m)
+  return match ? match[1].trim() : raw
+}
+
+/**
+ * Cached variant of {@link readRuleRawContent} for rule pages.
+ *
+ * Avoid it for bulk reads: on Vercel each lookup is a data-cache round trip,
+ * so reading the whole corpus through it exhausts file descriptors.
+ */
+export const getRuleRawContent = unstable_cache(readRuleRawContent, ['rule-raw-content'])
```

---

### Incident Patch 12: `9e084949` (2026-10-01)
**Commit Message**: fix(mcp): stop EMFILE failures when loading the rule corpus

Every MCP tool call on production failed with "EMFILE: too many open
files": buildRules read all 386 rule MDX files at once, and the rejected
promise was then cached for the life of the instance, so one failure
broke every later request. Read in batches of 16 and drop the cached
promise when it rejects so the next request retries.

Verified locally under `ulimit -n 160`: concurrent search_rules,
get_rule and audit_url calls succeed.

Refs: DAV-301
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/web/app/api/mcp/content-helpers.ts` (modified, +51/-24)
```diff
@@ -76,11 +76,18 @@ export async function getRules(
   isCategory: (value: string) => value is Category,
   isSubcategory: (value: string) => value is Subcategory
 ): Promise<Rule[]> {
-  cachedRulesPromise ??= buildRules(isCategory, isSubcategory)
+  cachedRulesPromise ??= buildRules(isCategory, isSubcategory).catch(error => {
+    // Never cache a failure: the next request should retry instead of failing forever.
+    cachedRulesPromise = null
+    throw error
+  })
 
   return cachedRulesPromise
 }
 
+/** Raw MDX reads in flight at once, kept well under the function's file-descriptor limit. */
+const RULE_READ_CONCURRENCY = 16
+
 /**
  * Build the English rule corpus exposed through MCP.
  *
@@ -92,31 +99,51 @@ async function buildRules(
   isSubcategory: (value: string) => value is Subcategory
 ): Promise<Rule[]> {
   const enRules = allRules.filter(rule => rule.language === 'en')
+  const built: Rule[] = []
 
-  return Promise.all(
-    enRules.map(async rule => {
-      const subcategory =
-        typeof rule.subcategory === 'string' && isSubcategory(rule.subcategory)
-          ? rule.subcategory
-          : undefined
-      const content = rule.filePath ? await getRuleRawContent(rule.filePath) : ''
+  for (let start = 0; start < enRules.length; start += RULE_READ_CONCURRENCY) {
+    const batch = enRules.slice(start, start + RULE_READ_CONCURRENCY)
+    built.push(
+      ...(await Promise.all(batch.map(rule => buildRule(rule, isCategory, isSubcategory))))
+    )
+  }
 
-      return {
-        title: rule.title,
-        slug: rule.slug,
-        categories: rule.categories.filter(isCategory),
-        priority: rule.priority,
-        prompts: rule.prompts,
-        content,
-        primaryCategory: rule.primaryCategory,
-        url: rule.url,
-        ...(rule.sources ? { sources: rule.sources.filter(isRuleSource) } : {}),
-        ...(isRuleSourceSummary(rule.sourceSummary) ? { sourceSummary: rule.sourceSummary } : {}),
-        ...(subcategory ? { subcategory } : {}),
-        ...(rule.relatedRules ? { relatedRules: rule.relatedRules.filter(isRelatedRule) } : {})
-      }
-    })
-  )
+  return built
+}
+
+/**
+ * Convert one content-collection rule into the MCP rule shape, reading its raw MDX body.
+ *
+ * @param rule - Content-collection rule record.
+ * @param isCategory - Category validator.
+ * @param isSubcategory - Subcategory validator.
+ * @returns MCP rule record.
+ */
+async function buildRule(
+  rule: (typeof allRules)[number],
+  isCategory: (value: string) => value is Category,
+  isSubcategory: (value: string) => value is Subcategory
+): Promise<Rule> {
+  const subcategory =
+    typeof rule.subcategory === 'string' && isSubcategory(rule.subcategory)
+      ? rule.subcategory
+      : undefined
+  const content = rule.filePath ? await getRuleRawContent(rule.filePath) : ''
+
+  return {
+    title: rule.title,
+    slug: rule.slug,
+    categories: rule.categories.filter(isCategory),
+    priority: rule.priority,
+    prompts: rule.prompts,
+    content,
+    primaryCategory: rule.primaryCategory,
+    url: rule.url,
+    ...(rule.sources ? { sources: rule.sources.filter(isRuleSource) } : {}),
+    ...(isRuleSourceSummary(rule.sourceSummary) ? { sourceSummary: rule.sourceSummary } : {}),
+    ...(subcategory ? { subcategory } : {}),
+    ...(rule.relatedRules ? { relatedRules: rule.relatedRules.filter(isRelatedRule) } : {})
+  }
 }
 
 /**
```

---

### Incident Patch 13: `5142dffe` (2026-09-30)
**Commit Message**: fix(mcp): block DNS rebinding in audit_url with a connect-time lookup

The pre-fetch DNS check could be raced: a hostname can resolve to a
public address during validation and a private one when the socket
connects. Fetches now go through an undici Agent whose lookup rejects
non-public addresses at connect time, and fetch errors surface their
underlying cause.

Refs: DAV-306
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/mcp/package.json` (modified, +2/-0)
```diff
@@ -24,6 +24,8 @@
     "@repo/config": "workspace:*",
     "@repo/types": "workspace:*",
     "node-html-parser": "^9.0.4",
+    "undici": "^7.30.0",
+    "yaml": "^2.9.1",
     "zod": "catalog:"
   },
   "devDependencies": {
```

**File**: `packages/mcp/src/tools/audit-url.ts` (modified, +42/-5)
```diff
@@ -1,7 +1,9 @@
+import { lookup as lookupCallback } from 'node:dns'
 import { lookup } from 'node:dns/promises'
-import { BlockList, isIP } from 'node:net'
+import { BlockList, isIP, type LookupFunction } from 'node:net'
 import { BOT_USER_AGENT } from '@repo/config'
 import type { Category, Priority, Rule } from '@repo/types'
+import { Agent } from 'undici'
 import {
   NUMBER_SCHEMA,
   OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
@@ -159,6 +161,34 @@ export function isBlockedAddress(address: string): boolean {
   return family === 4 ? BLOCKED_IPV4.check(address, 'ipv4') : BLOCKED_IPV6.check(address, 'ipv6')
 }
 
+/**
+ * Connect-time DNS lookup that refuses non-public addresses. Validating the
+ * hostname before `fetch` is not enough on its own: the name could resolve
+ * differently when the socket connects (DNS rebinding).
+ */
+const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
+  lookupCallback(hostname, { ...options, all: true }, (error, addresses) => {
+    if (error) {
+      callback(error, '', 0)
+      return
+    }
+
+    const blocked = addresses.find(entry => isBlockedAddress(entry.address))
+    if (blocked || addresses.length === 0) {
+      callback(new Error(`Blocked non-public address for ${hostname}`), '', 0)
+      return
+    }
+
+    if (options.all) {
+      callback(null, addresses)
+      return
+    }
+    callback(null, addresses[0].address, addresses[0].family)
+  })
+}
+
+const publicOnlyDispatcher = new Agent({ connect: { lookup: publicOnlyLookup } })
+
 type HostResolver = (hostname: string) => Promise<string[]>
 
 const resolveHost: HostResolver = async hostname =>
@@ -274,14 +304,18 @@ async function fetchWithValidatedRedirects(
   const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
 
   for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
-    const response = await fetch(current.toString(), {
+    // `dispatcher` is an undici extension to RequestInit supported by Node's fetch.
+    const init: RequestInit & { dispatcher: Agent } = {
       headers: {
         'User-Agent': BOT_USER_AGENT,
         Accept: 'text/html,application/xhtml+xml'
       },
       redirect: 'manual',
-      signal
-    })
+      signal,
+      // Re-checks resolved addresses at connect time.
+      dispatcher: publicOnlyDispatcher
+    }
+    const response = await fetch(current.toString(), init)
 
     const location = response.headers.get('location')
     if (response.status < 300 || response.status >= 400 || !location) {
@@ -349,7 +383,10 @@ export async function executeAuditUrl(
     if (err instanceof Error && err.name === 'TimeoutError') {
       return { error: `Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds` }
     }
-    return { error: `Failed to fetch URL: ${err instanceof Error ? err.message : 'Unknown error'}` }
+    const cause = err instanceof Error && err.cause instanceof Error ? err.cause : err
+    return {
+      error: `Failed to fetch URL: ${cause instanceof Error ? cause.message : 'Unknown error'}`
+    }
   }
 
   // Run the same review as review_code
```

**File**: `pnpm-lock.yaml` (modified, +7/-1)
```diff
@@ -62,7 +62,7 @@ catalogs:
       version: 0.7.1
     framer-motion:
       specifier: ^13.4.6
-      version: 13.4.6
+      version: 12.43.0
     jest:
       specifier: ^30.5.2
       version: 30.5.2
@@ -814,6 +814,12 @@ importers:
       node-html-parser:
         specifier: ^9.0.4
         version: 9.0.4
+      undici:
+        specifier: ^7.30.0
+        version: 7.30.0
+      yaml:
+        specifier: ^2.9.1
+        version: 2.9.1
       zod:
         specifier: 'catalog:'
         version: 4.6.5
```

---

### Incident Patch 14: `1fbee87d` (2026-09-30)
**Commit Message**: fix(auth): skip OAuth scopes for GitHub App client IDs

GitHub Apps (Iv1.* / Iv23* client IDs) authorize through app permissions,
so stop sending the default read:user / user:email scopes for them. Also
normalize Windows path separators in content-collections and mark the
content-collections jest mock as an ES module.

Based on #723. Refs #722, DAV-301.

Co-authored-by: Lokesh0018 <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/web/app/(site)/rules/[category]/[slug]/__tests__/page.test.tsx` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ import Link from 'next/link'
 import type { ReactNode } from 'react'
 
 jest.mock('content-collections', () => ({
+  __esModule: true,
   allRules: [
     {
       id: 'en-flashing-content',
```

**File**: `apps/web/content-collections.ts` (modified, +8/-5)
```diff
@@ -191,12 +191,13 @@ const rules = defineCollection({
     })
 
     // Extract language and slug from file path
-    const pathParts = document._meta.path.split('/')
+    const normalizedPath = document._meta.path.replace(/\\/g, '/')
+    const pathParts = normalizedPath.split('/')
     const language = pathParts.length > 2 ? pathParts[0] : 'en' // Default to English
     const category = pathParts.length > 2 ? pathParts[1] : pathParts[0]
     const slug =
       document.slug ||
-      document._meta.path
+      normalizedPath
         .replace(/\.mdx$/, '')
         .split('/')
         .pop() ||
@@ -305,11 +306,12 @@ const checklists = defineCollection({
     })
 
     // Extract language from file path
-    const pathParts = document._meta.path.split('/')
+    const normalizedPath = document._meta.path.replace(/\\/g, '/')
+    const pathParts = normalizedPath.split('/')
     const language = pathParts.length > 1 ? pathParts[0] : 'en'
     const slug =
       document.slug ||
-      document._meta.path
+      normalizedPath
         .replace(/\.mdx$/, '')
         .split('/')
         .pop() ||
@@ -379,7 +381,8 @@ const guides = defineCollection({
       rehypePlugins: [rehypeSlug, [rehypePrettyCode, rehypePrettyCodeOptions]]
     })
 
-    const pathParts = document._meta.path.split('/')
+    const normalizedPath = document._meta.path.replace(/\\/g, '/')
+    const pathParts = normalizedPath.split('/')
     const language = pathParts.length > 1 ? pathParts[0] : 'en'
 
     return {
```

**File**: `packages/auth/src/__tests__/profile.test.ts` (modified, +11/-1)
```diff
@@ -1,4 +1,4 @@
-import { buildGithubProfileImport } from '../profile'
+import { buildGithubProfileImport, isGithubAppClientId } from '../profile'
 
 describe('buildGithubProfileImport', () => {
   it('normalizes public GitHub profile fields for a new user import', () => {
@@ -73,3 +73,13 @@ describe('buildGithubProfileImport', () => {
     expect(buildGithubProfileImport({ bio: 'No login' })).toEqual({})
   })
 })
+
+describe('isGithubAppClientId', () => {
+  it.each(['Iv1.6939d4d823c53021', 'Iv23liAbCdEf123456'])('detects GitHub App ID %s', clientId => {
+    expect(isGithubAppClientId(clientId)).toBe(true)
+  })
+
+  it.each(['Ov23liAbCdEf123456', 'abcdef1234567890', ''])('rejects OAuth App ID %s', clientId => {
+    expect(isGithubAppClientId(clientId)).toBe(false)
+  })
+})
```

**File**: `packages/auth/src/auth.ts` (modified, +8/-1)
```diff
@@ -2,7 +2,12 @@ import { betterAuth } from 'better-auth'
 import { prismaAdapter } from 'better-auth/adapters/prisma'
 import { nextCookies } from 'better-auth/next-js'
 import { prisma } from './prisma'
-import { buildGithubProfileImport, getStringProperty, normalizeGithubUsername } from './profile'
+import {
+  buildGithubProfileImport,
+  getStringProperty,
+  isGithubAppClientId,
+  normalizeGithubUsername
+} from './profile'
 
 const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
 const baseUrl = process.env.BETTER_AUTH_URL ?? publicSiteUrl ?? 'http://localhost:3000'
@@ -183,6 +188,8 @@ export const auth = betterAuth({
     github: {
       clientId: githubClientId,
       clientSecret: githubClientSecret,
+      // GitHub Apps grant access through app permissions; skip OAuth scopes for them.
+      ...(isGithubAppClientId(githubClientId) ? { disableDefaultScope: true } : {}),
       mapProfileToUser: profile => {
         return {
           ...buildGithubProfileImport(profile),
```

**File**: `packages/auth/src/profile.ts` (modified, +11/-0)
```diff
@@ -21,6 +21,17 @@ export interface GithubProfileImport {
   githubProfileImportedAt?: Date
 }
 
+/**
+ * Detect a GitHub App client ID (`Iv1.` legacy or `Iv23` current format).
+ * GitHub Apps use fine-grained permissions instead of OAuth scopes.
+ *
+ * @param clientId - Configured GitHub client ID.
+ * @returns True when the ID belongs to a GitHub App rather than an OAuth App.
+ */
+export function isGithubAppClientId(clientId: string): boolean {
+  return /^Iv(?:1\.|23)/.test(clientId)
+}
+
 /**
  * Normalize a GitHub login into the public profile username format.
  *
```

---

### Incident Patch 15: `b58a7ebd` (2026-09-30)
**Commit Message**: fix(deps): patch critical Next.js and better-auth advisories

pnpm audit went from 129 advisories (3 critical, 59 high) to 0.

- next 16.2.6 -> 16.3.8 (image optimizer / next/og RCEs, proxy bypass, SSRF)
- better-auth 1.6.11 -> ~1.6.33 (account takeover, stored XSS). Held on
  1.6.x: 1.7 requires an Account.issuer schema migration and backfill.
- in-range lockfile refresh clears the hono, undici, fast-uri, js-yaml,
  brace-expansion, postcss, sharp and socket.io advisories
- scoped overrides for transitive deps still pinned upstream
  (toml, uuid, deepmerge-ts, mysql2)

Majors (TypeScript 7, Prisma 8, Sentry 11, framer-motion 13) are deferred.

Refs: DAV-301
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +11/-0)
```diff
@@ -313,3 +313,14 @@ export const myToolDefinition = {
 - Biome's `useSortedClasses` only sorts class **order**; it cannot rename deprecated classes. Use `@tailwindcss/upgrade` (installed in `apps/web`) to canonicalize class names project-wide.
 - Monorepo uses pnpm catalogs (`catalog:` in `pnpm-workspace.yaml`) for centralized dependency versions; shared deps appearing in 2+ packages use `catalog:` instead of hardcoded version strings.
 - Brand icons (ChatGPT, Claude, X, LinkedIn, Reddit, Cursor, VSCode) live in `packages/design-system/src/brand-icons.tsx` and are re-exported from the design-system barrel.
+
+<!-- BEGIN:turborepo-agent-rules -->
+
+# This is NOT the Turborepo you know
+
+Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.
+
+Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.
+
+This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
+<!-- END:turborepo-agent-rules -->
```

**File**: `apps/web/package.json` (modified, +26/-26)
```diff
@@ -24,19 +24,19 @@
     "typecheck": "tsc --noEmit"
   },
   "dependencies": {
-    "@content-collections/core": "^0.15.1",
+    "@content-collections/core": "^0.15.3",
     "@content-collections/mdx": "^0.2.2",
     "@content-collections/next": "^0.2.11",
     "@icons-pack/react-simple-icons": "catalog:",
-    "@next/third-parties": "^16.2.6",
+    "@next/third-parties": "^16.3.8",
     "@openpanel/nextjs": "^1.5.1",
     "@prisma/client": "catalog:",
-    "@radix-ui/react-accordion": "^1.2.12",
+    "@radix-ui/react-accordion": "^1.2.20",
     "@radix-ui/react-checkbox": "catalog:",
     "@radix-ui/react-dialog": "catalog:",
     "@radix-ui/react-dropdown-menu": "catalog:",
     "@radix-ui/react-progress": "catalog:",
-    "@radix-ui/react-radio-group": "^1.3.8",
+    "@radix-ui/react-radio-group": "^1.4.7",
     "@radix-ui/react-select": "catalog:",
     "@radix-ui/react-slot": "catalog:",
     "@radix-ui/react-switch": "catalog:",
@@ -58,55 +58,55 @@
     "@repo/types": "workspace:*",
     "@repo/utils": "workspace:*",
     "@repo/virtualization": "workspace:*",
-    "@sentry/nextjs": "^10.55.0",
-    "@tanstack/react-form": "^1.33.0",
+    "@sentry/nextjs": "^10.75.3",
+    "@tanstack/react-form": "^1.33.5",
     "@tanstack/react-query": "catalog:",
-    "@tanstack/react-query-devtools": "^5.100.14",
+    "@tanstack/react-query-devtools": "^5.104.0",
     "@thedaviddias/analytics": "workspace:*",
-    "@upstash/ratelimit": "^2.0.8",
-    "@upstash/redis": "^1.38.0",
-    "better-auth": "^1.6.11",
+    "@upstash/ratelimit": "^2.2.0",
+    "@upstash/redis": "^1.39.0",
+    "better-auth": "~1.6.33",
     "botid": "^1.5.11",
     "class-variance-authority": "catalog:",
     "cmdk": "^1.1.1",
-    "focus-trap-react": "^12.0.2",
+    "focus-trap-react": "^12.0.3",
     "framer-motion": "catalog:",
-    "fuse.js": "^7.3.0",
-    "lru-cache": "^11.5.1",
+    "fuse.js": "^7.5.0",
+    "lru-cache": "^11.5.3",
     "next": "catalog:",
-    "next-safe-action": "^8.5.3",
+    "next-safe-action": "^8.7.3",
     "next-themes": "^0.4.6",
-    "nuqs": "^2.8.9",
-    "open-graph-scraper": "^6.11.0",
+    "nuqs": "^2.10.1",
+    "open-graph-scraper": "^6.12.0",
     "react": "catalog:",
     "react-dom": "catalog:",
     "rehype-autolink-headings": "^7.1.0",
-    "rehype-pretty-code": "^0.14.3",
+    "rehype-pretty-code": "^0.14.5",
     "rehype-slug": "^6.0.0",
     "remark-gfm": "^4.0.1",
-    "shiki": "^4.1.0",
+    "shiki": "^4.4.3",
     "tailwind-merge": "catalog:",
     "zod": "catalog:"
   },
   "devDependencies": {
-    "@axe-core/react": "^4.11.3",
+    "@axe-core/react": "^4.13.0",
     "@content-collections/cli": "^0.1.9",
-    "@playwright/test": "^1.60.0",
+    "@playwright/test": "^1.63.0",
     "@repo/config-typescript": "workspace:^",
-    "@tailwindcss/postcss": "^4.3.0",
-    "@tailwindcss/upgrade": "^4.3.0",
+    "@tailwindcss/postcss": "^4.3.3",
+    "@tailwindcss/upgrade": "^4.3.3",
     "@testing-library/jest-dom": "^6.9.1",
     "@testing-library/react": "catalog:",
-    "@testing-library/user-event": "^14.6.1",
+    "@testing-library/user-event": "^14.6.7",
     "@types/jest": "catalog:",
     "@types/node": "catalog:",
     "@types/react": "catalog:",
     "@types/react-dom": "catalog:",
-    "concurrently": "^10.0.0",
+    "concurrently": "^10.0.5",
     "eslint-plugin-jsx-a11y": "^6.10.2",
     "jest": "catalog:",
-    "jest-environment-jsdom": "^30.4.1",
-    "tailwindcss": "^4.3.0",
+    "jest-environment-jsdom": "^30.5.2",
+    "tailwindcss": "^4.3.3",
     "typescript": "catalog:"
   }
 }
```

**File**: `configs/config-next/package.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
     "typecheck": "tsc --noEmit --emitDeclarationOnly false"
   },
   "dependencies": {
-    "@next/bundle-analyzer": "^16.2.6",
+    "@next/bundle-analyzer": "^16.3.8",
     "@t3-oss/env-core": "^0.13.11",
     "@t3-oss/env-nextjs": "^0.13.11",
     "zod": "catalog:"
```

**File**: `package.json` (modified, +8/-8)
```diff
@@ -60,19 +60,19 @@
     "ci:e2e": "pnpm run build && pnpm run test:e2e:ci"
   },
   "devDependencies": {
-    "@biomejs/biome": "^2.4.16",
-    "@commitlint/cli": "^21.0.2",
-    "@commitlint/config-conventional": "^21.0.2",
-    "@mdn/browser-compat-data": "^8.0.0",
-    "baseline-browser-mapping": "^2.10.32",
-    "browserslist": "^4.28.2",
+    "@biomejs/biome": "^2.5.15",
+    "@commitlint/cli": "^21.2.3",
+    "@commitlint/config-conventional": "^21.2.3",
+    "@mdn/browser-compat-data": "^8.1.3",
+    "baseline-browser-mapping": "^2.11.26",
+    "browserslist": "^4.29.3",
     "gray-matter": "^4.0.3",
-    "lefthook": "^2.1.9",
+    "lefthook": "^2.1.15",
     "remark-mdx": "^3.1.1",
     "remark-parse": "^11.0.0",
     "ts-jest": "catalog:",
     "tsx": "catalog:",
-    "turbo": "^2.9.16",
+    "turbo": "^2.11.5",
     "typescript": "catalog:",
     "unified": "^11.0.5",
     "unist-util-visit": "^5.1.0"
```

**File**: `packages/auth/package.json` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@
     "test:ci": "jest --ci --passWithNoTests"
   },
   "dependencies": {
-    "@prisma/adapter-pg": "^7.8.0",
+    "@prisma/adapter-pg": "^7.10.0",
     "@prisma/client": "catalog:",
-    "better-auth": "^1.6.11"
+    "better-auth": "~1.6.33"
   },
   "devDependencies": {
     "@types/jest": "catalog:",
```

**File**: `packages/data-layer/package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "@repo/storage": "workspace:*",
     "@repo/types": "workspace:*",
     "@tanstack/react-query": "catalog:",
-    "@tanstack/react-query-persist-client": "^5.100.14"
+    "@tanstack/react-query-persist-client": "^5.104.0"
   },
   "devDependencies": {
     "@repo/config-typescript": "workspace:^",
```

**File**: `packages/design-system/package.json` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@
   },
   "dependencies": {
     "@icons-pack/react-simple-icons": "catalog:",
-    "@radix-ui/react-accordion": "^1.2.12",
+    "@radix-ui/react-accordion": "^1.2.20",
     "@radix-ui/react-checkbox": "catalog:",
     "@radix-ui/react-dialog": "catalog:",
     "@radix-ui/react-dropdown-menu": "catalog:",
@@ -31,7 +31,7 @@
     "@repo/utils": "workspace:*",
     "class-variance-authority": "catalog:",
     "framer-motion": "catalog:",
-    "lucide-react": "^1.17.0",
+    "lucide-react": "^1.49.0",
     "react": "catalog:"
   },
   "devDependencies": {
```

**File**: `packages/emails/package.json` (modified, +2/-2)
```diff
@@ -20,8 +20,8 @@
   "dependencies": {
     "react": "catalog:",
     "react-dom": "catalog:",
-    "react-email": "^6.5.0",
-    "resend": "^6.12.4"
+    "react-email": "^6.11.0",
+    "resend": "^6.31.0"
   },
   "devDependencies": {
     "@repo/config-typescript": "workspace:^",
```

#### Recent Merged Pull Requests:
- **PR #751** (2026-09-30): Replace FID with INP in metadata (@tunetheweb)
- **PR #749** (2026-09-30): docs(images): add SVG optimization resource (@marcemile)
- **PR #744** (2026-09-30): Add video optimization rule (@damiarita)
- **PR #743** (2026-09-30): Add slingsite as an image optimization tool (@damiarita)
- **PR #738** (2026-09-30): docs: add Agent QA E2E resource (@pranshuchittora)
- **PR #737** (2026-08-14): Route production deploys through selected CI (@thedaviddias)
- **PR #735** (closed): ponytail: remove badges (@jackke88)
- **PR #723** (closed): Fix GitHub App OAuth authorization flow (@Lokesh0018)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
