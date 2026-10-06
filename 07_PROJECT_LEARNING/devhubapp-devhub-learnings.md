# Forensic Learning Record (Deep Inspection): devhubapp/devhub

> **Canonical Artifact**: `07_PROJECT_LEARNING/devhubapp-devhub-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/devhubapp/devhub](https://github.com/devhubapp/devhub))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:53:13.410Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `devhubapp/devhub`
- **Description**: TweetDeck for GitHub - Filter Issues, Activities & Notifications - Web, Mobile & Desktop with 99% code sharing between them
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10135 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `landing/src/hooks/use-dynamic-ref.ts`
```
import { useMemo, useRef } from 'react'

export function useDynamicRef<T>(value: T, deps?: any[]) {
  const ref = useRef(value)

  useMemo(() => {
    ref.current = value
  }, deps || [value])

  return ref
}

```

### Core Architecture Module: `landing/src/hooks/use-force-rerender.ts`
```
import { useState } from 'react'

export function useForceRerender() {
  const [, setValue] = useState(0)

  return () => setValue((value) => value + 1)
}

```

### Core Architecture Module: `landing/src/hooks/use-is-mounted-ref.ts`
```
import { useEffect, useRef } from 'react'

export function useIsMountedRef<T>() {
  const ref = useRef(true)

  useEffect(() => {
    ref.current = true

    return () => {
      ref.current = false
    }
  }, [])

  return ref
}

```

### Core Architecture Module: `landing/src/hooks/use-localized-plan-details.ts`
```
import { Plan } from '@devhub/core'

import { usePaddleLoader } from '../context/PaddleLoaderContext'

export function useLocalizedPlanDetails<P extends Plan | undefined>(
  plan: P | undefined,
  { quantity = 1 }: { quantity?: number } = {},
): P | undefined {
  const { getProductPrice } = usePaddleLoader()

  if (plan && plan.paddleProductId) {
    const paddlePrice = getProductPrice(plan.paddleProductId, quantity)

    if (paddlePrice && paddlePrice.gross) {
      const centsSeparator = paddlePrice.gross.match(/([.,])\d{2}$/)?.[1]

      return {
        ...plan,
        amount: Math.floor(
          parseFloat(paddlePrice.gross.replace(/[^0-9]+/g, '')) *
            (centsSeparator ? 1 : 100),
        ),
        currency: paddlePrice.gross.match(/[^0-9]+/)![0],
        // interval: undefined, // TODO
        // intervalCount: 1, // TODO,
        type: plan.type,
      }
    }
  }

  return plan
}

```

### Core Architecture Module: `landing/src/hooks/use-oauth.ts`
```
import { useCallback, useState } from 'react'

import { constants, GitHubAppType, tryParseOAuthParams } from '@devhub/core'
import { useAuth } from '../context/AuthContext'
import { getPlatform } from '../helpers'
import { useWindowEvent } from './use-window-event'

export function useOAuth() {
  const [popupWindow, setPopupWindow] = useState<Window | null>(null)
  const [isExecutingOAuth, setIsExecutingOAuth] = useState(false)

  const { login } = useAuth()

  function startOAuth(
    gitHubAppType: GitHubAppType | 'both',
    options: { appToken?: string; scope?: string[] | undefined } = {},
  ) {
    if (isExecutingOAuth) return

    setIsExecutingOAuth(true)

    const { appToken, scope = ['user:email'] } = options

    const platform = getPlatform()

    const scopeStr = (scope || []).join(' ').trim()
    const querystring = Object.entries({
      app_token: appToken,
      github_app_type: gitHubAppType,
      is_electron: false,
      platform,
      redirect_uri: '',
      scope: scopeStr,
    })
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    const popup = createPopupWindow(
      `${constants.API_BASE_URL}/github/oauth?${querystring}`,
    )

    setPopupWindow(popup)
  }

  useWindowEvent(
    'message',
    useCallback(
      (ev: MessageEvent) => {
        try {
          const params = tryParseOAuthParams(ev.data)
          if (!(params && params.appToken)) return

          login(params.appToken)
        } catch (error) {
          // noop
        }
      },
      [login],
    ),
  )

  useWindowEvent(
    'unload',
    useCallback(() => {
      setIsExecutingOAuth(false)
    }, []),
    popupWindow,
  )

  useWindowEvent(
    'close',
    useCallback(() => {
      setIsExecutingOAuth(false)
    }, []),
    popupWindow,
  )

  return { isExecutingOAuth, startOAuth }
}

function createPopupWindow(uri: string, w = 500, h = 600) {
  const left = (window.screen.width - w) / 2
  const top = (window.screen.height - h) / 2

  return window.open(
    uri,
    '_blank',
    `resizable=yes, width=${w}, height=${h}, top=${top}, left=${left}`,
  )
}

```

### Core Architecture Module: `landing/src/hooks/use-system.ts`
```
import { useLayoutEffect, useState } from 'react'

import { OS, PlatformCategory } from '@devhub/core'
import { getOSName, getPlatformCategory } from '../helpers'

interface System {
  category: PlatformCategory | undefined
  os: OS | undefined
}

export function useSystem(): System {
  const [system, setSystem] = useState<System>({
    category: undefined,
    os: undefined,
  })

  // this is required because of the value mismatch between server ssr and client
  useLayoutEffect(() => {
    setSystem({ category: getPlatformCategory(), os: getOSName() })
  }, [])

  return system
}

```

### Core Architecture Module: `landing/src/hooks/use-window-event.ts`
```
import { useEffect } from 'react'

export function useWindowEvent<K extends keyof WindowEventMap>(
  event: K,
  cb: (this: Window, ev: WindowEventMap[K]) => any,
  win?: Window | null | undefined,
) {
  const _window =
    win === null
      ? null
      : win || (typeof window === 'undefined' ? undefined : window)

  useEffect(() => {
    if (
      typeof _window === 'undefined' ||
      !(_window && _window.addEventListener)
    )
      return
    _window.addEventListener(event, cb)

    return () => {
      try {
        if (
          typeof _window === 'undefined' ||
          !(_window && _window.removeEventListener)
        )
          return
        _window.removeEventListener(event, cb)
      } catch (error) {
        //
      }
    }
  }, [event, cb, _window])
}

```

### Core Architecture Module: `packages/components/src/components/columns/ColumnFiltersRenderer.tsx`
```
import { constants } from '@devhub/core'
import React, { useCallback, useState } from 'react'
import { StyleSheet } from 'react-native'

import { useTransition } from '@react-spring/native'
import { useEmitter } from '../../hooks/use-emitter'
import { useForceRerender } from '../../hooks/use-force-rerender'
import { emitter } from '../../libs/emitter'
import { Platform } from '../../libs/platform'
import { sharedStyles } from '../../styles/shared'
import { contentPadding } from '../../styles/variables'
import { getDefaultReactSpringAnimationConfig } from '../../utils/helpers/animations'
import { SpringAnimatedView } from '../animated/spring/SpringAnimatedView'
import { AccordionView } from '../common/AccordionView'
import { ConditionalWrap } from '../common/ConditionalWrap'
import { useColumnFilters } from '../context/ColumnFiltersContext'
import { getCurrentFocusedColumnId } from '../context/ColumnFocusContext'
import { ThemedTouchableOpacity } from '../themed/ThemedTouchableOpacity'
import { ColumnFilters } from './ColumnFilters'
import { ColumnHeader } from './ColumnHeader'
import { ColumnSeparator } from './ColumnSeparator'

export interface ColumnFiltersRendererProps {
  columnId: string | 'focused'
  fixedPosition?: 'left' | 'right'
  forceOpenAll?: boolean
  header?: 'header' | 'spacing' | 'none'
  startWithFiltersExpanded?: boolean
  type: 'shared' | 'local'
}

export const ColumnFiltersRenderer = React.memo(
  (props: ColumnFiltersRendererProps) => {
    const {
      columnId: _columnIdOrFocused,
      fixedPosition,
      forceOpenAll,
      header,
      startWithFiltersExpanded,
      type,
    } = props

    const columnId =
      _columnIdOrFocused === 'focused'
        ? getCurrentFocusedColumnId()
        : _columnIdOrFocused

    const forceRerender = useForceRerender()

    const [_isLocalFiltersOpened, setIsLocalFiltersOpened] = useState(false)

    const {
      enableSharedFiltersView,
      fixedWidth,
      inlineMode,
      isSharedFiltersOpened: _isSharedFiltersOpened,
    } = useColumnFilters()

    const isOpen = enableSharedFiltersView
      ? _isSharedFiltersOpened
      : _isLocalFiltersOpened
    const renderFilter = !!(
      (type === 'shared' && enableSharedFiltersView) ||
      (type === 'local' && !enableSharedFiltersView && !inlineMode)
    )

    function focusColumn() {
      if (_columnIdOrFocused === 'focused') return

      if (!columnId) return

      emitter.emit('FOCUS_ON_COLUMN', {
        columnId,
        highlight: false,
        scrollTo: false,
      })
    }

    const close = useCallback(() => {
      focusColumn()

      if (!columnId) return
      emitter.emit('TOGGLE_COLUMN_FILTERS', { columnId, isOpen: false })
    }, [columnId])

    useEmitter(
      'FOCUS_ON_COLUMN',
      (payload) => {
        if (_columnIdOrFocused === 'focused' && columnId !== payload.columnId)
          forceRerender()
      },
      [_columnIdOrFocused, _isLocalFiltersOpened, columnId, close],
    )

    useEmitter(
      'TOGGLE_COLUMN_FILTERS',
      (payload) => {
        if (enableSharedFiltersView) return
        setIsLocalFiltersOpened(
          payload.columnId !== columnId
            ? false
            : typeof payload.isOpen === 'boolean'
            ? payload.isOpen
            : (v) => !v,
        )
      },
      [columnId, enableSharedFiltersView],
    )

    const immediate = constants.DISABLE_ANIMATIONS
    const overlayTransition = useTransition(isOpen, {
      config: getDefaultReactSpringAnimationConfig({ precision: 0.01 }),
      immediate,
      unique: true,
      from: { opacity: 0 },
      enter: { opacity: 0.75 },
      update: { opacity: isOpen ? 0.75 : 0 },
      leave: { opacity: 0 },
    })

    const enableAbsolutePositionAnimation = !!(
      !inlineMode &&
      fixedPosition &&
      fixedWidth
    )

    const absolutePositionTransitionKey = [
      `column-options-renderer-${type === 'shared' ? 'shared' : columnId}`,
    ]
    const absolutePositionTransition = useTransition(true, {
      config: getDefaultReactSpringAnimationConfig({ precision: 1 }),
      immediate: constants.DISABLE_ANIMATIONS,
      unique: true,
      from: { left: 0, right: 0 },
      leave: { left: 0, right: 0 },
      enter: { left: 0, right: 0 },
      update: { left: 0, right: 0 },
      ...(!!(
        enableAbsolutePositionAnimation &&
        !inlineMode &&
        fixedPosition &&
        fixedWidth
      ) &&
        ({
          from: {
            [fixedPosition]: -fixedWidth,
          },
          leave: {
            [fixedPosition]: -fixedWidth,
          },
          enter: {
            [fixedPosition]: isOpen ? 0 : -fixedWidth,
          },
          update: {
            [fixedPosition]: isOpen ? 0 : -fixedWidth,
          },
        } as {})),
    })

    if (!renderFilter) return null
    if (!columnId) return null

    return absolutePositionTransition(
      ({ left, right }, _item, absolutePositionT) => {
        const fixedPositionSpringValue =
          fixedPosition === 'left'
            ? left
            : fixedPosition === 'right'
            ? right
            : undefined

        return (
          <SpringAnimatedView
            key={absolutePositionT.key}
            style={[
              !inlineMode && sharedStyles.fullWidth,
              sharedStyles.fullHeight,

              !inlineMode && StyleSheet.absoluteFill,
              !inlineMode && {
                opacity:
                  enableAbsolutePositionAnimation &&
                  fixedPositionSpringValue &&
                  fixedWidth
                    ? fixedPositionSpringValue.to((value) =>
                        fixedWidth + value <= 0 ? 0 : 1,
                      )
                    : 1,
                visibility:
                  enableAbsolutePositionAnimation &&
                  fixedPositionSpringValue &&
                  fixedWidth
                    ? fixedPositionSpringValue.to((value) =>
                        fixedWidth + value <= 0 ? 'hidden' : 'visible',
                      )
                    : 'visible',
                zIndex: 200,
              },
            ]}
            pointerEvents={
              // prevent clicking on filters even when they are hidden behind column
              // (only enabled for web desktop because this is causing bugs on ios safari)
              Platform.OS === 'web' &&
              Platform.realOS !== 'ios' &&
              enableAbsolutePositionAnimation &&
              fixedPositionSpringValue &&
              fixedWidth
                ? fixedPositionSpringValue.to((value) =>
                    value < 0 ? 'none' : 'box-none',
                  )
                : 'box-none'
            }
          >
            {!inlineMode &&
              !!close &&
              overlayTransition(({ opacity }, overlayItem) => {
                if (!overlayItem) return null

                return (
                  <SpringAnimatedView
                    key={`${absolutePositionTransitionKey}-overlay-container`}
                    collapsable={false}
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        zIndex: 200,
                        opacity: opacity.to((opacity) =>
                          Math.max(
                            0,
                            Math.min(Number(opacity.toFixed(2)), 0.75),
                          ),
                        ),
                      },
                    ]}
                    pointerEvents="box-none"
                  >
                    <ThemedTouchableOpacity
                      activeOpacity={1}
                      backgroundColor="backgroundColorMore1"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          zIndex: 200,
                          ...Platform.select({
                            web: { cursor: 'default' } as any,
                          }),
                        },
                      ]}
                      onPress={close && (() => close())}
                      tabIndex={-1}
                    />
                  </SpringAnimatedView>
                )
              })}

            <SpringAnimatedView
              collapsable={false}
              style={[
                !inlineMode && StyleSheet.absoluteFill,
                fixedPosition &&
                  fixedPositionSpringValue && {
                    [fixedPosition]: fixedPositionSpringValue.to((value) =>
                      Math.floor(value),
                    ),
                  },
                !!fixedWidth &&
                  fixedPosition === 'left' && { right: undefined },
                !!fixedWidth &&
                  fixedPosition === 'right' && { left: undefined },
                !!fixedWidth && { width: fixedWidth },
                {
                  zIndex: 200,
                },
              ]}
            >
              {header === 'header' ? (
                <ColumnHeader
                  icon={{ family: 'octicon', name: 'filter' }}
                  title="Filters"
                  right={
                    !inlineMode &&
                    !!close && (
                      <ColumnHeader.Button
                        key="column-flters-close-button"
                        family="octicon"
                        name="x"
                        onPress={() => close()}
                        tooltip="Close"
                      />
                    )
                  }
                  style={{ paddingRight: contentPadding / 2 }}
                />
              ) : header === 'spacing' ? (
                <ColumnHeader
                  avatar={undefined as any}
                  title=""
                  icon={undefined}
                />
              ) : null}

              <ConditionalWrap
                condition={!enableAbsolutePositionAnimation}
      
```

### Core Architecture Module: `packages/components/src/components/columns/ColumnRenderer.tsx`
```
import {
  Column as ColumnT,
  columnHasAnyFilter,
  constants,
  EnhancedGitHubEvent,
  EnhancedGitHubIssueOrPullRequest,
  EnhancedGitHubNotification,
  EnhancedItem,
  formatPriceAndInterval,
  getDateSmallText,
  getDefaultPaginationPerPage,
  getItemNodeIdOrId,
  isEventPrivate,
  isItemRead,
  isItemSaved,
  isNotificationPrivate,
  isPlanStatusValid,
  ThemeColors,
} from '@devhub/core'
import React, { useCallback, useRef } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { useDispatch, useStore } from 'react-redux'

import { useAppViewMode } from '../../hooks/use-app-view-mode'
import { useColumnData } from '../../hooks/use-column-data'
import { useReduxState } from '../../hooks/use-redux-state'
import { AutoSizer } from '../../libs/auto-sizer'
import { emitter } from '../../libs/emitter'
import { IconProp } from '../../libs/vector-icons'
import * as actions from '../../redux/actions'
import * as selectors from '../../redux/selectors'
import { sharedStyles } from '../../styles/shared'
import { contentPadding } from '../../styles/variables'
import {
  FreeTrialHeaderMessage,
  FreeTrialHeaderMessageProps,
} from '../common/FreeTrialHeaderMessage'
import { HeaderMessage } from '../common/HeaderMessage'
import { useColumnWidth } from '../context/ColumnWidthContext'
import { useAppLayout } from '../context/LayoutContext'
import { useLoginHelpers } from '../context/LoginHelpersContext'
import { usePlans } from '../context/PlansContext'
import { Column } from './Column'
import { ColumnFiltersRenderer } from './ColumnFiltersRenderer'
import { ColumnHeader } from './ColumnHeader'
import { ColumnOptionsAccordion } from './ColumnOptionsAccordion'

export function getColumnCardThemeColors({ isDark }: { isDark: boolean }): {
  column: keyof ThemeColors
  card: keyof ThemeColors
  card__hover: keyof ThemeColors
  card__muted: keyof ThemeColors
  card__muted_hover: keyof ThemeColors
} {
  return {
    card: 'backgroundColorLighther1',
    card__hover: isDark ? 'backgroundColorLighther2' : 'backgroundColorDarker1',
    card__muted: isDark ? 'backgroundColor' : 'backgroundColorDarker1',
    card__muted_hover: isDark
      ? 'backgroundColorLighther1'
      : 'backgroundColorDarker2',
    column: 'backgroundColor',
  }
}

export function getCardBackgroundThemeColor({
  isDark,
  isMuted,
  isHovered,
}: {
  isDark: boolean
  isMuted: boolean
  isHovered?: boolean
}) {
  const backgroundThemeColors = getColumnCardThemeColors({ isDark })

  const _backgroundThemeColor =
    (isMuted &&
      (isHovered
        ? backgroundThemeColors.card__muted_hover
        : backgroundThemeColors.card__muted)) ||
    (isHovered ? backgroundThemeColors.card__hover : backgroundThemeColors.card)

  return _backgroundThemeColor
}

export interface ColumnRendererProps {
  avatarImageURL?: string
  avatarLinkURL?: string
  children: React.ReactNode
  columnId: string
  columnIndex: number
  columnType: ColumnT['type']
  icon: IconProp
  owner: string | undefined
  pagingEnabled?: boolean
  repo: string | undefined
  repoIsKnown: boolean
  subtitle: string | undefined
  title: string
}

export const ColumnRenderer = React.memo((props: ColumnRendererProps) => {
  const {
    avatarImageURL,
    avatarLinkURL,
    children,
    columnId,
    columnIndex,
    columnType,
    icon,
    owner,
    pagingEnabled,
    repo,
    repoIsKnown,
    subtitle,
    title,
  } = props

  const columnOptionsRef = useRef<ColumnOptionsAccordion>(null)
  const appLayout = useAppLayout()
  const { appOrientation } = appLayout
  const appViewModeresult = useAppViewMode()
  const { appViewMode } = appViewModeresult
  const columnWidth = useColumnWidth()
  const columnData = useColumnData(columnId, {
    mergeSimilar: false,
  })
  const { hasCrossedColumnsLimit, filteredItems } = columnData

  const dispatch = useDispatch()
  const store = useStore()

  const hasItemsToMarkAsDone = !!(filteredItems as any[]).some(
    (
      item:
        | EnhancedGitHubEvent
        | EnhancedGitHubNotification
        | EnhancedGitHubIssueOrPullRequest,
    ) => {
      return !!(item && !isItemSaved(item)) /* && isItemRead(item) */
    },
  )

  const refresh = useCallback(() => {
    dispatch(
      actions.fetchColumnSubscriptionRequest({
        columnId,
        params: { page: 1, perPage: getDefaultPaginationPerPage(columnType) },
        replaceAllItems: false,
      }),
    )
  }, [columnId])

  function focusColumn() {
    emitter.emit('FOCUS_ON_COLUMN', {
      columnId,
      highlight: false,
      scrollTo: false,
    })
  }

  const toggleOptions = () => {
    if (!columnOptionsRef.current) return

    focusColumn()
    columnOptionsRef.current.toggle()
  }

  const hasOneUnreadItem = (filteredItems as any[]).some(
    (
      item:
        | EnhancedGitHubNotification
        | EnhancedGitHubEvent
        | EnhancedGitHubIssueOrPullRequest,
    ) => !isItemRead(item),
  )

  const renderLeftSeparator =
    appViewMode === 'multi-column' &&
    !(columnIndex === 0 && appOrientation === 'landscape')

  const renderRightSeparator = appViewMode === 'multi-column'

  return (
    <Column
      key={`column-renderer-${columnId}-inner-container`}
      backgroundColor={getColumnCardThemeColors({ isDark: false }).column}
      columnId={columnId}
      pagingEnabled={pagingEnabled}
      renderLeftSeparator={renderLeftSeparator}
      renderRightSeparator={renderRightSeparator}
    >
      <ColumnHeader
        key={`column-renderer-${columnId}-header`}
        columnId={columnId}
        title={title}
        subtitle={subtitle}
        style={{ paddingRight: contentPadding / 2 }}
        {...(avatarImageURL
          ? { avatar: { imageURL: avatarImageURL, linkURL: avatarLinkURL! } }
          : { icon })}
        right={
          <>
            <ColumnHeader.Button
              key="column-options-button-clear-column"
              analyticsLabel={
                hasItemsToMarkAsDone ? 'clear_column' : 'unclear_column'
              }
              disabled={hasCrossedColumnsLimit || !hasItemsToMarkAsDone}
              family="octicon"
              name="check"
              onPress={() => {
                dispatch(
                  actions.setColumnClearedAtFilter({
                    columnId,
                    clearedAt: hasItemsToMarkAsDone
                      ? new Date().toISOString()
                      : null,
                  }),
                )

                focusColumn()

                if (!hasItemsToMarkAsDone) refresh()
              }}
              tooltip="Done"
            />

            <ColumnHeader.Button
              key="column-options-button-toggle-mark-as-read"
              analyticsLabel={
                !hasOneUnreadItem ? 'mark_as_unread' : 'mark_as_read'
              }
              disabled={hasCrossedColumnsLimit || !filteredItems.length}
              family="octicon"
              name={!hasOneUnreadItem ? 'eye-closed' : 'eye'}
              onPress={() => {
                const unread = !hasOneUnreadItem

                const visibleItemNodeIdOrIds = (filteredItems as any[])
                  .map((item: EnhancedItem) => getItemNodeIdOrId(item))
                  .filter(Boolean) as string[]

                const column = selectors.columnSelector(
                  store.getState(),
                  columnId,
                )

                const hasAnyFilter = columnHasAnyFilter(columnType, {
                  ...(column && column.filters),
                  clearedAt: undefined,
                })

                // column doesnt have any filter,
                // so lets mark ALL notifications on github as read at once,
                // instead of marking only the visible items one by one
                if (
                  columnType === 'notifications' &&
                  !hasAnyFilter &&
                  !unread
                ) {
                  if (repoIsKnown) {
                    if (owner && repo) {
                      dispatch(
                        actions.markRepoNotificationsAsReadOrUnread({
                          owner,
                          repo,
                          unread,
                        }),
                      )

                      return
                    }
                  } else {
                    dispatch(
                      actions.markAllNotificationsAsReadOrUnread({ unread }),
                    )
                    return
                  }
                }

                // mark only the visible items as read/unread one by one
                dispatch(
                  actions.markItemsAsReadOrUnread({
                    type: columnType,
                    itemNodeIdOrIds: visibleItemNodeIdOrIds,
                    unread,
                  }),
                )

                focusColumn()
              }}
              tooltip={
                !hasOneUnreadItem ? 'Mark all as unread' : 'Mark all as read'
              }
            />

            <ColumnHeader.Button
              key="column-options-toggle-button"
              analyticsAction="toggle"
              analyticsLabel="column_options"
              family="octicon"
              name="settings"
              onPress={toggleOptions}
              tooltip="Options"
            />
          </>
        }
      />

      <View
        style={[
          sharedStyles.flex,
          sharedStyles.fullWidth,
          sharedStyles.fullHeight,
        ]}
      >
        <AutoSizer
          defaultWidth={columnWidth}
          defaultHeight={Dimensions.get('window').height}
          style={[
            sharedStyles.relative,
            sharedStyles.flex,
            sharedStyles.fullWidth,
            sharedStyles.fullHeight,
          ]}
        >
          {({ width, height }) => (
            <View style={StyleSheet.absoluteFill}>
              <ColumnOptionsAccordion
                ref={columnOptionsRef}
   
```

### Core Architecture Module: `packages/components/src/components/columns/ColumnsRenderer.tsx`
```
import React, { useMemo } from 'react'
import { View } from 'react-native'

import { useAppViewMode } from '../../hooks/use-app-view-mode'
import { useReduxState } from '../../hooks/use-redux-state'
import * as selectors from '../../redux/selectors'
import { sharedStyles } from '../../styles/shared'
import { useColumnFilters } from '../context/ColumnFiltersContext'
import { ColumnFiltersRenderer } from './ColumnFiltersRenderer'
import { Columns } from './Columns'

export interface ColumnsRendererProps {}

export function ColumnsRenderer() {
  const { appViewMode } = useAppViewMode()

  const { enableSharedFiltersView, inlineMode } = useColumnFilters()

  const hasColumns = useReduxState(
    (state) => !!selectors.columnIdsSelector(state).length,
  )

  // if (appViewMode === 'single-column' && !focusedColumnId && columnIds.length) {
  //   return <NoFocusedColumn />
  // }

  const ColumnsComponent = useMemo(() => <Columns key="columns" />, [])

  const FiltersComponent = useMemo(
    () =>
      appViewMode === 'single-column' &&
      !!enableSharedFiltersView &&
      !!hasColumns && (
        <ColumnFiltersRenderer
          key="column-options-renderer"
          columnId="focused"
          fixedPosition="right"
          forceOpenAll={inlineMode}
          header="header"
          type="shared"
        />
      ),
    [
      appViewMode === 'single-column' &&
        !!enableSharedFiltersView &&
        !!hasColumns,
    ],
  )

  return (
    <View style={[sharedStyles.flex, sharedStyles.horizontal]}>
      {FiltersComponent}
      {ColumnsComponent}
    </View>
  )
}

```

### Core Architecture Module: `packages/components/src/components/modals/ModalRenderer.tsx`
```
import { constants, ModalPayloadWithIndex } from '@devhub/core'
import React, { useEffect } from 'react'
import { BackHandler, Dimensions, StyleSheet, View } from 'react-native'
import { useTransition } from '@react-spring/native'

import { SettingsModal } from '../../components/modals/SettingsModal'
import { usePrevious } from '../../hooks/use-previous'
import { useReduxAction } from '../../hooks/use-redux-action'
import { useReduxState } from '../../hooks/use-redux-state'
import { analytics } from '../../libs/analytics'
import { Platform } from '../../libs/platform'
import * as actions from '../../redux/actions'
import * as selectors from '../../redux/selectors'
import { sharedStyles } from '../../styles/shared'
import { getDefaultReactSpringAnimationConfig } from '../../utils/helpers/animations'
import { SpringAnimatedView } from '../animated/spring/SpringAnimatedView'
import { ColumnSeparator } from '../columns/ColumnSeparator'
import { separatorThickSize } from '../common/Separator'
import { useColumnWidth } from '../context/ColumnWidthContext'
import { DialogProvider } from '../context/DialogContext'
import { useAppLayout } from '../context/LayoutContext'
import { ThemedTouchableOpacity } from '../themed/ThemedTouchableOpacity'
import { AddColumnDetailsModal } from './AddColumnDetailsModal'
import { AddColumnModal } from './AddColumnModal'
import { AdvancedSettingsModal } from './AdvancedSettingsModal'
import { EnterpriseSetupModal } from './EnterpriseSetupModal'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { PricingModal } from './PricingModal'
import { SubscribedModal } from './SubscribedModal'
import { SubscribeModal } from './SubscribeModal'

function renderModal(modal: ModalPayloadWithIndex) {
  if (!modal) return null

  switch (modal.name) {
    case 'ADD_COLUMN':
      return (
        <AddColumnModal showBackButton={modal.index >= 1} {...modal.params} />
      )

    case 'ADD_COLUMN_DETAILS':
      return (
        <AddColumnDetailsModal
          showBackButton={modal.index >= 1}
          {...modal.params}
        />
      )

    case 'ADVANCED_SETTINGS':
      return (
        <AdvancedSettingsModal
          showBackButton={modal.index >= 1}
          {...modal.params}
        />
      )

    case 'KEYBOARD_SHORTCUTS':
      return (
        <KeyboardShortcutsModal
          showBackButton={modal.index >= 1}
          {...modal.params}
        />
      )

    case 'PRICING':
      return (
        <PricingModal showBackButton={modal.index >= 1} {...modal.params} />
      )

    case 'SETTINGS':
      return (
        <SettingsModal showBackButton={modal.index >= 1} {...modal.params} />
      )

    case 'SETUP_GITHUB_ENTERPRISE':
      return (
        <EnterpriseSetupModal
          showBackButton={modal.index >= 1}
          {...modal.params}
        />
      )

    case 'SUBSCRIBE':
      return (
        <SubscribeModal showBackButton={modal.index >= 1} {...modal.params} />
      )

    case 'SUBSCRIBED':
      return (
        <SubscribedModal showBackButton={modal.index >= 1} {...modal.params} />
      )

    default:
      return null
  }
}

export interface ModalRendererProps {
  renderSeparator?: boolean
}

export function ModalRenderer(props: ModalRendererProps) {
  const { renderSeparator } = props

  const { appOrientation, sizename } = useAppLayout()
  const columnWidth = useColumnWidth()

  const columnIds = useReduxState(selectors.columnIdsSelector)
  const modalStack = useReduxState(selectors.modalStack)
  const previousModalStack = usePrevious(modalStack)
  const currentOpenedModal = useReduxState(selectors.currentOpenedModal)
  const previouslyOpenedModal = usePrevious(currentOpenedModal)

  const isSettings = !!modalStack.find((m) => m && m.name === 'SETTINGS')
  const wasSettings = usePrevious(isSettings)

  const closeAllModals = useReduxAction(actions.closeAllModals)
  const popModal = useReduxAction(actions.popModal)

  useEffect(() => {
    if (currentOpenedModal && currentOpenedModal.name)
      analytics.trackModalView(currentOpenedModal.name)
  }, [currentOpenedModal && currentOpenedModal.name])

  useEffect(() => {
    if (!(BackHandler && BackHandler.addEventListener)) return

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!!currentOpenedModal) {
          popModal()
          return true
        }
      },
    )

    return () => {
      backHandler.remove()
    }
  }, [!!currentOpenedModal])

  const immediate =
    constants.DISABLE_ANIMATIONS ||
    (sizename <= '2-medium' &&
    ((isSettings && !wasSettings && modalStack.length === 1) ||
      (!currentOpenedModal && wasSettings)) &&
    columnIds.length > 0
      ? true
      : false)

  const size = columnWidth + (renderSeparator ? separatorThickSize : 0)

  const overlayTransition = useTransition(currentOpenedModal, {
    immediate: immediate || sizename <= '2-medium',
    config: getDefaultReactSpringAnimationConfig({ precision: 0.01 }),
    from: { opacity: 0 },
    enter: { opacity: 0.75 },
    leave: { opacity: 0 },
  })

  const modalTransition = useTransition(modalStack, {
    config: getDefaultReactSpringAnimationConfig({ precision: 1 }),
    immediate,
    unique: true,
    keys: (item: ModalPayloadWithIndex | undefined) =>
      `modal-stack-${item?.name}`,
    ...(appOrientation === 'portrait'
      ? {
          from: (item) =>
            (item?.index === 0 && modalStack.length) ||
            (item?.index && !modalStack.length)
              ? {
                  top: immediate ? 0 : Dimensions.get('window').height,
                  left: 0,
                }
              : { top: 0, left: size },
          enter: { top: 0, left: 0 },
          update: (item) =>
            modalStack.length > 1 && item?.index !== modalStack.length - 1
              ? { top: 0, left: -50 }
              : { top: 0, left: 0 },
          leave: (item) =>
            item?.index === 0 || !modalStack.length
              ? { top: Dimensions.get('window').height, left: 0 }
              : { top: 0, left: size },
        }
      : {
          from: (item) =>
            (item?.index === 0 &&
              modalStack.length &&
              !previouslyOpenedModal) ||
            (item?.index && !modalStack.length)
              ? { left: -size }
              : { left: size },
          enter: { left: 0 },
          update: (item) =>
            item?.index !== modalStack.length - 1
              ? { left: -size / 3 }
              : { left: 0 },

          leave: (item) =>
            (item?.index ?? -1) >= modalStack.length &&
            modalStack.length &&
            previouslyOpenedModal &&
            previouslyOpenedModal.name === item?.name &&
            previousModalStack &&
            previousModalStack[0] &&
            previousModalStack[0].name === (modalStack[0] && modalStack[0].name)
              ? { left: size }
              : { left: -size },
        }),
  })

  const separatorTransition = useTransition(
    renderSeparator && sizename !== '2-medium' && modalStack.length
      ? [modalStack[0]?.name]
      : [],
    {
      keys: (name: ModalPayloadWithIndex['name'] | undefined) =>
        `modal-separator-${name}`,
      config: getDefaultReactSpringAnimationConfig({ precision: 1 }),
      immediate,
      unique: true,
      from: { right: size },
      enter: { right: 0 },
      update: { right: 0 },
      leave: { right: size + separatorThickSize },
    },
  )

  return (
    <>
      {overlayTransition(
        ({ opacity }, overlayItem) =>
          !!overlayItem && (
            <SpringAnimatedView
              collapsable={false}
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity,
                  zIndex: 500,
                },
              ]}
            >
              <ThemedTouchableOpacity
                activeOpacity={1}
                backgroundColor="backgroundColorMore1"
                style={[
                  sharedStyles.fullWidth,
                  sharedStyles.fullHeight,
                  Platform.select({ web: { cursor: 'default' } as any }),
                ]}
                onPress={() => closeAllModals()}
                tabIndex={-1}
              />
            </SpringAnimatedView>
          ),
      )}

      {modalTransition(
        (modalAnimatedStyle, modalItem, modalT) =>
          !!modalItem && (
            <View
              key={modalT.key}
              collapsable={false}
              style={[
                sharedStyles.absolute,
                sharedStyles.overflowHidden,
                {
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: size,
                  zIndex: 900,
                },
              ]}
            >
              <View
                collapsable={false}
                style={[
                  sharedStyles.flex,
                  sharedStyles.fullHeight,
                  sharedStyles.overflowHidden,
                  {
                    width: columnWidth,
                    zIndex: 900,
                  },
                ]}
              >
                <SpringAnimatedView
                  collapsable={false}
                  style={[
                    sharedStyles.absolute,
                    sharedStyles.horizontal,
                    sharedStyles.overflowHidden,
                    {
                      top: 0,
                      bottom: 0,
                      ...modalAnimatedStyle,
                      zIndex: 900 + modalItem.index,
                    },
                  ]}
                >
                  <DialogProvider>{renderModal(modalItem)}</DialogProvider>
                </SpringAnimatedView>
              </View>

              {separatorTransition(
                (separatorAnimatedStyle, separatorItem, separatorT) =>
                  !!separatorItem && (
         
```

### Core Architecture Module: `packages/components/src/hooks/use-app-view-mode.ts`
```
import { AppViewMode } from '@devhub/core'
import { useMemo } from 'react'

import { useAppLayout } from '../components/context/LayoutContext'

export function useAppViewMode(): { appViewMode: AppViewMode } {
  const { sizename } = useAppLayout()

  const appViewMode = sizename <= '2-medium' ? 'single-column' : 'multi-column'

  return useMemo(() => ({ appViewMode }), [appViewMode])
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #222** (2020-10-24): **App no MacOS não funciona**
  *Symptoms*: Estou apenas com uma tela preta.  ![Captura de Tela 2020-10-16 às 16 12 11](https://user-images.githubusercontent.com/43140758/96299416-6bb88f80-0fca-11eb-8a36-8b8637abf8fc.png) 
  **Post-Mortem & Fix Analysis**:
  > primeira vez que vejo isso; mac ta com espaco livre suficiente? ja tentou reinstalar o app?
  > @renanmav a [v0.102](https://github.com/devhubapp/devhub/releases/tag/v0.102.0) funciona?
  > @brunolemos Estou usando no Windows agr

- **Issue #198** (2019-10-27): **[Windows] save button on app tries to open a native link**
  *Symptoms*: The newly added save button on the windows app tries to open an app (system-url) which windows does not know the filetype and shows the selection to download one from the store. The shortcut executed with `s` does not have this behavior so I assume it's a native link which needs to get removed?  Edit: I forgot to notice, that the opening is executed in addition to saving the notification.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, it seems this was happening only on Windows.  I have re-uploaded the [.exe](https://github.com/devhubapp/devhub/releases/download/v0.98.0/DevHub-Setup-0.98.0.exe) file on [v0.98.0](https://github.com/devhubapp/devhub/releases/tag/v0.98.0) with the fix. You can re-install it to get the fix now or wait for the `v0.98.1`+ release which may take a few days.
  > Can confirm that this works. Looks like you've misspelled the file, beforehand it was called `DevHub-Setup-0.98.0.exe` now it's called `DevHub.Setup.0.98.0.exe` that why your reference on [devhubapp.com](https://devhubapp.com/download) does not work.
  > Fixed, thanks! Not sure but I think that when I re-uploded manually GitHub replaced the spaces with “.”, and when electron-builder uploads automatically it replaces the spaces with a “-“.

- **Issue #193** (2019-10-27): **Unable to locate attached view in the native tree**
  *Symptoms*: exports@index.android.bundle:25:287 value@index.android.bundle:242:2469 value@index.android.bundle:242:1530 value@index.android.bundle:255:2217 value@index.android.bundle:255:2297 Ln@index.android.bundle:91:32405 di@index.android.bundle:91:50450 Ml@index.android.bundle:91:70036 Ul@index.android.bundle:91:67144 Ul@[native code] Pl@index.android.bundle:91:65839 Pl@[native code] index.android.bundle:91:25495 unstable_runWithPriority@index.android.bundle:170:3915 sn@index.android.bundle:91:25442 cn@index.android.bundle:91:25377 _e@index.android.bundle:91:88686 Ne@index.android.bundle:91:13582 notify@index.android.bundle:624:871 notifyNestedSubs@index.android.bundle:624:443 handleChangeWrapper@index.android.bundle:624:518 [native code] j@index.android.bundle:633:5905 index.android.bundle:1276:312 index.android.bundle:1268:9884 index.android.bundle:1275:371 index.android.bundle:1268:2798 h@index.android.bundle:1268:288 T@index.android.bundle:1268:477 E@index.android.bundle:1268:337 index.android.bundle:1268:2754 index.android.bundle:1268:7318 T@index.android.bundle:1268:8303 A@index.android.bundle:1268:7819 v@index.android.bundle:1268:8080 f@index.android.bundle:108:155 index.android.bundle:108:882 y@index.android.bundle:114:661 C@index.android.bundle:114:1025 callImmediates@index.android.bundle:114:3100 callImmediates@[native code] value@index.android.bundle:38:3247 index.android.bundle:38:1283 value@index.android.bundle:38:2939 value@in
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, I checked bugsnag and it seems this only affected 2 users. It seems to be an edge case and you'll likely not face this again.  The related error on bugsnag seems to be `scrollToIndex out of range: requested index 5 but maximum is 4` so maybe some item or column got removed and some race condition happened.  If it keeps happening let me know that I'll investigate more.

- **Issue #191** (2019-10-27): **[Windows] Menubar mode wrong behavior**
  *Symptoms*: It would be really nice if we could minimize DevHub to the system tray and see a feedback in the icon when a new notification arrive.
  **Post-Mortem & Fix Analysis**:
  > Hi, DevHub already have both of these features.  Have you tried the "Menubar" mode?
  > Hi, Good point I didn't try ! Now that I've tried I'm not sure it's working as expected. Here is gif file showing how it behaves on my computer. ![r8JP7L9E2y](https://user-images.githubusercontent.com/3799294/66778458-0835e680-eecc-11e9-90eb-f8cf57e818cf.gif)    
  > Weird, I just tried on Windows 10 and I'm not able to reproduce these problems. The `Open` button worked correctly and the app showed at the right like it should. Not sure what could it be.  Instead of clicking `Open` try clicking `Menubar mode` again, does that work?

- **Issue #190** (2019-10-27): **menubar on windows not working**
  *Symptoms*: I tried to switch into menubar mode and the app is displayed once on the top left of the screen. If I click once anywhere else on the screen the menubar version of devhub closes and after that I'm unable to open it again. Every click on the icon within the taskbar opens the settings/context menu. Even selecting the 'open' option from within the context menu does not appear to have any effect.  If you need more information, let me know.
  **Post-Mortem & Fix Analysis**:
  > Let me know if [v0.98.0](https://github.com/devhubapp/devhub/releases/tag/v0.98.0) fixes it!
  > Works like a charme, thanks for the fix! 
  > @tobiaskohlbau thanks for purchasing the yearly plan! 💚

- **Issue #188** (2019-10-08): **Can't find variable: Intl**
  *Symptoms*: formatPrice@index.android.bundle:500:1534 PricingPlanBlock@index.android.bundle:1237:2050 Or@index.android.bundle:91:41719 Vl@index.android.bundle:91:80200 Ml@index.android.bundle:91:70036 Ul@index.android.bundle:91:67144 Ul@[native code] Pl@index.android.bundle:91:65839 Pl@[native code] index.android.bundle:91:25495 unstable_runWithPriority@index.android.bundle:170:3915 sn@index.android.bundle:91:25442 cn@index.android.bundle:91:25377 _e@index.android.bundle:91:88686 Ne@index.android.bundle:91:13582 Ue@index.android.bundle:91:13755 receiveTouches@index.android.bundle:91:14547 value@index.android.bundle:38:3685 index.android.bundle:38:841 value@index.android.bundle:38:2939 value@index.android.bundle:38:813 value@[native code]
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, I shipped this code by mistake.  Published the fix to the store and it should be available in a few hours.  _Note: It will still say `0.97.1`_ 

- **Issue #186** (2019-10-08): **App rotates even with device orientation lock on**
  *Symptoms*: Version: 0.95  Device: Google Pixel 3
  **Post-Mortem & Fix Analysis**:
  > Could you send a pull request please? 
  > Fixed on [v0.97.1](https://play.google.com/store/apps/details?id=com.devhubapp&hl=en_US).

- **Issue #178** (2019-10-07): **Desktop auto update is buggy**
  *Symptoms*: - Sometimes clicking at the update notification doesn't restart the app - Sometimes it render an empty screen after an update, and you need to restart again  - Sometimes it shows wrong icons due to some cache issue with react-native-vector-icons

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

### Incident Patch 1: `b177899a` (2021-06-23)
**Commit Message**: [iOS] Bump deployment target to 12.1 (from 10.0) due to Flipper requirement

**File**: `packages/mobile/ios/Podfile` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ load 'remove_unsupported_libraries.rb'
 require_relative '../../../node_modules/react-native/scripts/react_native_pods'
 require_relative '../../../node_modules/@react-native-community/cli-platform-ios/native_modules'
 
-platform :ios, '10.0'
+platform :ios, '12.1'
 
 target 'devhub' do
   config = use_native_modules!
```

**File**: `packages/mobile/ios/devhub.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -411,7 +411,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				IPHONEOS_DEPLOYMENT_TARGET = 10.0;
+				IPHONEOS_DEPLOYMENT_TARGET = 12.1;
 				LD_RUNPATH_SEARCH_PATHS = (
 					/usr/lib/swift,
 					"$(inherited)",
@@ -468,7 +468,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				IPHONEOS_DEPLOYMENT_TARGET = 10.0;
+				IPHONEOS_DEPLOYMENT_TARGET = 12.1;
 				LD_RUNPATH_SEARCH_PATHS = (
 					/usr/lib/swift,
 					"$(inherited)",
```

---

### Incident Patch 2: `2435eb2a` (2021-06-23)
**Commit Message**: Use typed-redux-saga to fix type checking after typescript upgrade

https://github.com/redux-saga/redux-saga/issues/884

**File**: `.eslintrc.js` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ module.exports = {
     },
   },
   rules: {
-    '@typescript-eslint/ban-ts-comment': 'off',
     '@typescript-eslint/ban-types': 'warn',
     '@typescript-eslint/explicit-module-boundary-types': 'off',
     '@typescript-eslint/no-empty-interface': 'warn',
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ Support this project by becoming a sponsor. Your logo will show up here with a l
 - [React Native Web](https://github.com/necolas/react-native-web)
 - [Redux](https://github.com/reduxjs/react-redux)
 - [Redux Persist](https://github.com/rt2zz/redux-persist)
-- [Redux Saga](https://github.com/redux-saga/redux-saga/)
+- [Redux Saga](https://github.com/redux-saga/redux-saga/) ([typed-redux-saga](https://github.com/agiledigital/typed-redux-saga))
 - [Reselect](https://github.com/reduxjs/reselect)
 - [GraphQL](https://github.com/facebook/graphql)
 - [Electron](https://github.com/electron/electron)
```

**File**: `packages/components/package.json` (modified, +3/-2)
```diff
@@ -40,6 +40,7 @@
     "redux-persist": "6.0.0",
     "redux-saga": "1.1.3",
     "reselect": "4.0.0",
+    "typed-redux-saga": "1.3.1",
     "yup": "0.27.0"
   },
   "devDependencies": {
@@ -62,7 +63,7 @@
     "babel-jest": "26.6.3",
     "jest": "26.6.3",
     "postinstall-postinstall": "2.0.0",
-    "prettier": "2.2.1",
+    "prettier": "2.3.1",
     "react-native-typescript-transformer": "1.2.13",
     "redux-flipper": "1.4.2",
     "reselect-tools": "0.0.7",
@@ -73,4 +74,4 @@
   "peerDependencies": {
     "eslint": "*"
   }
-}
+}
\ No newline at end of file
```

**File**: `packages/components/src/redux/sagas/api.ts` (modified, +12/-14)
```diff
@@ -1,8 +1,6 @@
-// @ts-nocheck
-
 import axios, { AxiosResponse } from 'axios'
 import _ from 'lodash'
-import { all, fork, put, select, take, takeLatest } from 'redux-saga/effects'
+import { all, fork, put, select, take, takeLatest } from 'typed-redux-saga'
 
 import {
   constants,
@@ -29,7 +27,7 @@ function* init() {
   while (true) {
     yield take('*')
 
-    const state: RootState = yield select()
+    const state: RootState = yield* select()
 
     const appToken = selectors.appTokenSelector(state)
     if (!appToken) continue
@@ -59,12 +57,12 @@ function* init() {
 // Note: Lodash debounce was not working as expected with generators
 // so we now use normal async/await in the sync functions
 function* onSyncUp() {
-  const state: RootState = yield select()
+  const state: RootState = yield* select()
   void debounceSyncUp(state)
 }
 
 function* onSyncDown() {
-  let state: RootState = yield select()
+  let state: RootState = yield* select()
 
   const appToken = selectors.appTokenSelector(state)
   if (!appToken) return
@@ -152,7 +150,7 @@ function* onSyncDown() {
       },
     )
 
-    state = yield select()
+    state = yield* select()
 
     const { data, errors } = response.data
 
@@ -279,7 +277,7 @@ const debounceSyncUp = _.debounce(syncUp, 5000, {
 function* onLoginSuccess(
   action: ExtractActionFromActionCreator<typeof actions.loginSuccess>,
 ) {
-  const state: RootState = yield select()
+  const state: RootState = yield* select()
 
   const { columns, subscriptions } = action.payload.user
   const username = action.payload.user.github.user.login
@@ -335,7 +333,7 @@ function* onLoginSuccess(
       yield put(actions.syncUp())
     }
   } else {
-    const hasCreatedColumn = yield select(selectors.hasCreatedColumnSelector)
+    const hasCreatedColumn = yield* select(selectors.hasCreatedColumnSelector)
     if (!hasCreatedColumn) {
       yield put(
         actions.replaceColumnsAndSubscriptions(getDefaultColumns(username)),
@@ -347,10 +345,10 @@ function* onLoginSuccess(
 }
 
 export function* apiSagas() {
-  yield all([
-    yield fork(init),
-    yield takeLatest('LOGIN_SUCCESS', onLoginSuccess),
-    yield takeLatest('SYNC_DOWN', onSyncDown),
-    yield takeLatest('SYNC_UP', onSyncUp),
+  yield* all([
+    yield* fork(init),
+    yield* takeLatest('LOGIN_SUCCESS', onLoginSuccess),
+    yield* takeLatest('SYNC_DOWN', onSyncDown),
+    yield* takeLatest('SYNC_UP', onSyncUp),
   ])
 }
```

**File**: `packages/components/src/redux/sagas/auth.ts` (modified, +17/-19)
```diff
@@ -1,5 +1,3 @@
-// @ts-nocheck
-
 import { constants, User } from '@devhub/core'
 import axios, { AxiosResponse } from 'axios'
 import * as StoreReview from 'react-native-store-review'
@@ -12,7 +10,7 @@ import {
   select,
   take,
   takeLatest,
-} from 'redux-saga/effects'
+} from 'typed-redux-saga'
 
 import { Alert } from 'react-native'
 import { analytics } from '../../libs/analytics'
@@ -29,7 +27,7 @@ function* init() {
   yield take('LOGIN_SUCCESS')
 
   while (true) {
-    const state = yield select()
+    const state = yield* select()
 
     const appToken = selectors.appTokenSelector(state)
     const isLogged = selectors.isLoggedSelector(state)
@@ -84,7 +82,7 @@ function* init() {
 }
 
 function* onRehydrate() {
-  const appToken = yield select(selectors.appTokenSelector)
+  const appToken = yield* select(selectors.appTokenSelector)
   if (!appToken) return
 
   yield put(actions.loginRequest({ appToken }))
@@ -280,7 +278,7 @@ function* onLoginSuccess(
   clearOAuthQueryParams()
 
   if (StoreReview.isAvailable && !__DEV__) {
-    const state = yield select()
+    const state = yield* select()
     const { loginSuccess: loginCount } = selectors.countersSelector(state)
 
     if (loginCount >= 5 && loginCount % 5 === 0) {
@@ -292,7 +290,7 @@ function* onLoginSuccess(
 }
 
 function* updateLoggedUserOnTools() {
-  const state = yield select()
+  const state = yield* select()
 
   const preferredDarkThemePair = selectors.preferredDarkThemePairSelector(state)
   const preferredLightThemePair = selectors.preferredLightThemePairSelector(
@@ -343,7 +341,7 @@ function onLogout() {
 }
 
 function* onDeleteAccountRequest() {
-  const appToken = yield select(selectors.appTokenSelector)
+  const appToken = yield* select(selectors.appTokenSelector)
 
   try {
     const response: AxiosResponse<{
@@ -412,19 +410,19 @@ function* onDeleteAccountSuccess() {
 }
 
 export function* authSagas() {
-  yield all([
-    yield fork(init),
-    yield takeLatest(REHYDRATE, onRehydrate),
-    yield takeLatest(
+  yield* all([
+    yield* fork(init),
+    yield* takeLatest(REHYDRATE, onRehydrate),
+    yield* takeLatest(
       [REHYDRATE, 'LOGIN_SUCCESS', 'LOGOUT', 'UPDATE_USER_DATA'],
       updateLoggedUserOnTools,
     ),
-    yield takeLatest('LOGIN_REQUEST', onLoginRequest),
-    yield takeLatest('LOGIN_FAILURE', onLoginFailure),
-    yield takeLatest('LOGIN_SUCCESS', onLoginSuccess),
-    yield takeLatest('DELETE_ACCOUNT_REQUEST', onDeleteAccountRequest),
-    yield takeLatest('DELETE_ACCOUNT_FAILURE', onDeleteAccountFailure),
-    yield takeLatest('DELETE_ACCOUNT_SUCCESS', onDeleteAccountSuccess),
-    yield takeLatest('LOGOUT', onLogout),
+    yield* takeLatest('LOGIN_REQUEST', onLoginRequest),
+    yield* takeLatest('LOGIN_FAILURE', onLoginFailure),
+    yield* takeLatest('LOGIN_SUCCESS', onLoginSuccess),
+    yield* takeLatest('DELETE_ACCOUNT_REQUEST', onDeleteAccountRequest),
+    yield* takeLatest('DELETE_ACCOUNT_FAILURE', onDeleteAccountFailure),
+    yield* takeLatest('DELETE_ACCOUNT_SUCCESS', onDeleteAccountSuccess),
+    yield* takeLatest('LOGOUT', onLogout),
   ])
 }
```

**File**: `packages/components/src/redux/sagas/columns.ts` (modified, +14/-23)
```diff
@@ -1,14 +1,5 @@
-// @ts-nocheck
-
 import { AppState, InteractionManager } from 'react-native'
-import {
-  all,
-  call,
-  put,
-  select,
-  takeEvery,
-  takeLatest,
-} from 'redux-saga/effects'
+import { all, call, put, select, takeEvery, takeLatest } from 'typed-redux-saga'
 
 import {
   ActivityColumnSubscriptionCreation,
@@ -170,7 +161,7 @@ function* onAddColumn(
   const columnId = action.payload.column.id
 
   if (AppState.currentState === 'active')
-    yield call(InteractionManager.runAfterInteractions)
+    yield* call(InteractionManager.runAfterInteractions)
 
   emitter.emit('FOCUS_ON_COLUMN', {
     animated: true,
@@ -183,7 +174,7 @@ function* onAddColumn(
 function* onMoveColumn(
   action: ExtractActionFromActionCreator<typeof actions.moveColumn>,
 ) {
-  const ids: string[] = yield select(selectors.columnIdsSelector)
+  const ids: string[] = yield* select(selectors.columnIdsSelector)
   if (!(ids && ids.length)) return
 
   const columnIndex = Math.max(
@@ -207,7 +198,7 @@ function* onMoveColumn(
 function* onDeleteColumn(
   action: ExtractActionFromActionCreator<typeof actions.deleteColumn>,
 ) {
-  const ids: string[] = yield select(selectors.columnIdsSelector)
+  const ids: string[] = yield* select(selectors.columnIdsSelector)
   if (!(ids && ids.length)) return
 
   // Fixes blank screen on Android after removing the last column.
@@ -253,19 +244,19 @@ function* onColumnSubscriptionFilterChange(
 ) {
   if (!action.payload.columnId) return
 
-  const column: Column = yield select(
+  const column = yield* select(
     selectors.columnSelector,
     action.payload.columnId,
   )
   if (!(column && column.id)) return
 
-  const subscriptions: ColumnSubscription[] = yield select(
+  const subscriptions: ColumnSubscription[] = yield* select(
     selectors.createColumnSubscriptionsSelector(),
     column.id,
   )
   if (!(subscriptions && subscriptions.length)) return
 
-  yield all(
+  yield* all(
     subscriptions.map(function* (subscription: ColumnSubscription) {
       if (!(subscription && subscription.id)) return
 
@@ -406,21 +397,21 @@ function* onColumnSubscriptionFilterChange(
         ),
       )
 
-      return yield all(result)
+      return yield* all(result)
     }),
   )
 }
 
 export function* columnsSagas() {
-  yield all([
-    yield takeEvery('ADD_COLUMN_AND_SUBSCRIPTIONS', onAddColumn),
-    yield takeEvery('MOVE_COLUMN', onMoveColumn),
-    yield takeEvery('DELETE_COLUMN', onDeleteColumn),
-    yield takeLatest(
+  yield* all([
+    yield* takeEvery('ADD_COLUMN_AND_SUBSCRIPTIONS', onAddColumn),
+    yield* takeEvery('MOVE_COLUMN', onMoveColumn),
+    yield* takeEvery('DELETE_COLUMN', onDeleteColumn),
+    yield* takeLatest(
       ['SET_COLUMN_CLEARED_AT_FILTER', 'CLEAR_ALL_COLUMNS'],
       onClearColumnOrColumns,
     ),
-    yield takeLatest(
+    yield* takeLatest(
       [
         'CLEAR_COLUMN_FILTERS',
         'REPLACE_COLUMN_FILTERS',
```

**File**: `packages/components/src/redux/sagas/config.ts` (modified, +5/-7)
```diff
@@ -1,6 +1,4 @@
-// @ts-nocheck
-
-import { all, delay, fork, put, select, takeLatest } from 'redux-saga/effects'
+import { all, delay, fork, put, select, takeLatest } from 'typed-redux-saga'
 
 import { isNight } from '@devhub/core'
 import { analytics } from '../../libs/analytics'
@@ -21,7 +19,7 @@ function* init() {
 }
 
 function* onThemeChange() {
-  const state = yield select()
+  const state = yield* select()
 
   const preferredDarkThemePair = selectors.preferredDarkThemePairSelector(state)
   const preferredLightThemePair = selectors.preferredLightThemePairSelector(
@@ -37,8 +35,8 @@ function* onThemeChange() {
 }
 
 export function* configSagas() {
-  yield all([
-    yield fork(init),
-    yield takeLatest(['SET_THEME', 'SET_PREFERRABLE_THEME'], onThemeChange),
+  yield* all([
+    yield* fork(init),
+    yield* takeLatest(['SET_THEME', 'SET_PREFERRABLE_THEME'], onThemeChange),
   ])
 }
```

**File**: `packages/components/src/redux/sagas/index.ts` (modified, +8/-10)
```diff
@@ -1,6 +1,4 @@
-// @ts-nocheck
-
-import { all, fork } from 'redux-saga/effects'
+import { all, fork } from 'typed-redux-saga'
 
 import { apiSagas } from './api'
 import { authSagas } from './auth'
@@ -10,12 +8,12 @@ import { installationSagas } from './installations'
 import { subscriptionsSagas } from './subscriptions'
 
 export function* rootSaga() {
-  yield all([
-    yield fork(apiSagas),
-    yield fork(authSagas),
-    yield fork(columnsSagas),
-    yield fork(configSagas),
-    yield fork(installationSagas),
-    yield fork(subscriptionsSagas),
+  yield* all([
+    yield* fork(apiSagas),
+    yield* fork(authSagas),
+    yield* fork(columnsSagas),
+    yield* fork(configSagas),
+    yield* fork(installationSagas),
+    yield* fork(subscriptionsSagas),
   ])
 }
```

---

### Incident Patch 3: `9e116f9e` (2021-06-23)
**Commit Message**: Possibly fix .avatar_url null error

Fix https://github.com/devhubapp/devhub/issues/230

**File**: `packages/core/src/helpers/github/shared.ts` (modified, +1/-0)
```diff
@@ -311,6 +311,7 @@ export function getUserAvatarFromObject(
   { size }: { size?: number } = {},
   getPixelSizeForLayoutSizeFn: ((size: number) => number) | undefined,
 ) {
+  if (!user) return undefined
   if (!(user.avatar_url || user.id || user.login)) return undefined
 
   const baseURL =
```

---

### Incident Patch 4: `1db8fce2` (2020-12-11)
**Commit Message**: [Mobile] Fix TypeError: undefined is not an object (evaluating 'o.remove')

**File**: `packages/components/src/libs/appearence/index.native.tsx` (modified, +7/-1)
```diff
@@ -12,10 +12,16 @@ export const AppearanceProvider = Fragment
 
 export const Appearance: Appearence = {
   addChangeListener(listener) {
-    return AppearanceOriginal.addChangeListener((preferences) => {
+    AppearanceOriginal.addChangeListener((preferences) => {
       const _colorScheme = preferences && preferences.colorScheme
       listener({ colorScheme: normalizeColorScheme(_colorScheme) })
     })
+
+    return {
+      remove: () => {
+        AppearanceOriginal.removeChangeListener(listener as any)
+      },
+    }
   },
   getColorScheme() {
     return normalizeColorScheme(AppearanceOriginal.getColorScheme())
```

---

### Incident Patch 5: `9f4a5d9c` (2020-12-08)
**Commit Message**: [Mobile] Fix iOS release build

Invalid platform "ios" selected. and main.jsbundle does not exist

https://github.com/react-native-community/cli/issues/656\#issuecomment-532235648

**File**: `package.json` (modified, +3/-0)
```diff
@@ -34,6 +34,9 @@
     "studio": "yarn workspace @devhub/mobile studio",
     "xcode": "yarn workspace @devhub/mobile xcode"
   },
+  "dependencies": {
+    "react-native": "*"
+  },
   "devDependencies": {
     "@primer/octicons-v2": "canary",
     "@typescript-eslint/eslint-plugin": "4.9.0",
```

**File**: `packages/mobile/ios/devhub.xcodeproj/project.pbxproj` (modified, +4/-3)
```diff
@@ -151,7 +151,7 @@
 					};
 				};
 			};
-			buildConfigurationList = 83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "DevHub" */;
+			buildConfigurationList = 83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "devhub" */;
 			compatibilityVersion = "Xcode 12.0";
 			developmentRegion = en;
 			hasScannedForEncodings = 0;
@@ -196,7 +196,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "set -e\n\nexport NODE_BINARY=node\n../../../node_modules/react-native/scripts/react-native-xcode.sh\n";
+			shellScript = "set -e\n\nexport NODE_BINARY=node\nexport ENTRY_FILE=packages/mobile/index.js\n../../../node_modules/react-native/scripts/react-native-xcode.sh\n";
 		};
 		30B724DD75C10DC4C299DD76 /* [CP] Copy Pods Resources */ = {
 			isa = PBXShellScriptBuildPhase;
@@ -328,6 +328,7 @@
 					"$(inherited)",
 					"@executable_path/Frameworks",
 				);
+				ONLY_ACTIVE_ARCH = YES;
 				OTHER_LDFLAGS = (
 					"$(inherited)",
 					"-ObjC",
@@ -477,7 +478,7 @@
 			defaultConfigurationIsVisible = 0;
 			defaultConfigurationName = Release;
 		};
-		83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "DevHub" */ = {
+		83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "devhub" */ = {
 			isa = XCConfigurationList;
 			buildConfigurations = (
 				83CBBA201A601CBA00E9B192 /* Debug */,
```

---

### Incident Patch 6: `8d3623b8` (2020-12-08)
**Commit Message**: [Landing] Fix build error (SyntaxError: Unexpected token '.')

**File**: `landing/next.config.js` (modified, +14/-8)
```diff
@@ -1,11 +1,17 @@
 const withCSS = require('@zeit/next-css')
 
-module.exports = withCSS({
-  env: {
-    STRIPE_PUBLIC_KEY:
-      process.env.NODE_ENV === 'production'
-        ? 'pk_live_SRFXNC2vJzVcCNwE7fXVmCM900PLxWhQ6D'
-        : 'pk_test_PvG6Vvwe8z0SdsxY7fWtvAPW00X0ooU3XF',
-    PADDLE_VENDOR_ID: 33705,
-  },
+const withTM = require('next-transpile-modules')(['@devhub/core'], {
+  resolveSymlinks: true,
 })
+
+module.exports = withCSS(
+  withTM({
+    env: {
+      STRIPE_PUBLIC_KEY:
+        process.env.NODE_ENV === 'production'
+          ? 'pk_live_SRFXNC2vJzVcCNwE7fXVmCM900PLxWhQ6D'
+          : 'pk_test_PvG6Vvwe8z0SdsxY7fWtvAPW00X0ooU3XF',
+      PADDLE_VENDOR_ID: 33705,
+    },
+  }),
+)
```

**File**: `landing/package.json` (modified, +12/-12)
```diff
@@ -17,42 +17,42 @@
     "start": "next -p 3001"
   },
   "dependencies": {
-    "@devhub/core": "npm:@brunolemos/devhub-core@0.102.0",
+    "@devhub/core": "npm:@brunolemos/devhub-core@0.102.1-rc.0",
     "@zeit/next-css": "1.0.1",
     "autoprefixer": "9.6.4",
     "classnames": "2.2.6",
-    "isomorphic-unfetch": "3.0.0",
+    "isomorphic-unfetch": "3.1.0",
     "lodash": "4.17.20",
-    "next": "10.0.1",
-    "next-transpile-modules": "4.1.0",
+    "next": "10.0.3",
+    "next-transpile-modules": "6.0.0",
     "qs": "6.9.1",
     "react": "17.0.1",
     "react-dom": "17.0.1",
     "react-stripe-elements": "5.0.1",
     "tailwindcss": "1.1.2"
   },
   "devDependencies": {
-    "@types/classnames": "2.2.9",
+    "@types/classnames": "2.2.11",
     "@types/lodash": "4.14.165",
-    "@types/node": "14.0.5",
-    "@types/qs": "6.9.0",
+    "@types/node": "14.14.11",
+    "@types/qs": "6.9.5",
     "@types/react": "17.0.0",
     "@types/react-dom": "17.0.0",
     "@types/react-stripe-elements": "1.3.5",
     "@types/stripe-v3": "3.1.9",
     "@types/styled-jsx": "2.2.8",
-    "@typescript-eslint/eslint-plugin": "4.9.0",
-    "@typescript-eslint/parser": "4.9.0",
+    "@typescript-eslint/eslint-plugin": "4.9.1",
+    "@typescript-eslint/parser": "4.9.1",
     "eslint": "7.15.0",
     "eslint-config-nextjs": "1.0.6",
     "eslint-config-prettier": "7.0.0",
     "eslint-plugin-prettier": "3.2.0",
-    "mkdirp": "0.5.1",
-    "node-fetch": "2.6.0",
+    "mkdirp": "1.0.4",
+    "node-fetch": "2.6.1",
     "now": "21.0.1",
     "prettier": "2.2.1",
     "shx": "0.3.3",
-    "ts-node": "8.6.2",
+    "ts-node": "9.1.1",
     "typescript": "4.1.2"
   },
   "engines": {
```

**File**: `landing/src/components/common/CheckLabels.tsx` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { CheckLabelProps } from './CheckLabel'
 export interface CheckLabelsProps {
   center?: boolean
   className?: string
-  children: (ReactElement<CheckLabelProps> | false)[]
+  children: (ReactElement<CheckLabelProps> | boolean)[]
 }
 
 export function CheckLabels(props: CheckLabelsProps) {
```

**File**: `landing/tsconfig.json` (modified, +3/-11)
```diff
@@ -3,11 +3,7 @@
     "target": "esnext",
     "module": "esnext",
     "moduleResolution": "node",
-    "lib": [
-      "esnext",
-      "dom",
-      "dom.iterable"
-    ],
+    "lib": ["esnext", "dom", "dom.iterable"],
     "allowJs": false,
     "allowSyntheticDefaultImports": true,
     "esModuleInterop": true,
@@ -21,10 +17,6 @@
     "sourceMap": true,
     "strict": true
   },
-  "include": [
-    "src", "pages"
-  ],
-  "exclude": [
-    "node_modules"
-  ]
+  "include": ["src", "pages", "next.config.js"],
+  "exclude": ["node_modules"]
 }
```

**File**: `packages/mobile/package.json` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
     "xcode": "open ios/devhub.xcworkspace"
   },
   "dependencies": {
+    "@devhub/core": "0.102.0",
     "@devhub/components": "0.102.0",
     "@react-native-firebase/analytics": "10.1.1",
     "@react-native-firebase/app": "10.1.0",
```

**File**: `tsconfig.base.json` (modified, +2/-6)
```diff
@@ -1,13 +1,9 @@
 {
   "compilerOptions": {
-    "target": "esnext",
+    "target": "ES2019",
     "module": "commonjs",
     "moduleResolution": "node",
-    "lib": [
-      "esnext",
-      "dom",
-      "dom.iterable"
-    ],
+    "lib": ["esnext", "dom", "dom.iterable"],
     "allowJs": false,
     "allowSyntheticDefaultImports": true,
     "esModuleInterop": true,
```

**File**: `tsconfig.json` (modified, +4/-16)
```diff
@@ -1,21 +1,9 @@
 {
   "extends": "./tsconfig.base.json",
   "compilerOptions": {
-    "target": "es5",
-    "lib": [
-      "dom",
-      "dom.iterable",
-      "esnext"
-    ],
+    "lib": ["dom", "dom.iterable", "esnext"],
     "module": "esnext"
   },
-  "exclude": [
-    "node_modules"
-  ],
-  "include": [
-    "@types",
-    "landing/next-env.d.ts",
-    "landing/src",
-    "packages"
-  ]
-}
\ No newline at end of file
+  "exclude": ["node_modules"],
+  "include": ["@types", "landing", "packages"]
+}
```

---

### Incident Patch 7: `cf5148c3` (2020-12-08)
**Commit Message**: [Desktop] Fix menubar mode on Linux and Windows

**File**: `packages/components/src/components/ElectronTitleBar.web.tsx` (modified, +17/-8)
```diff
@@ -1,8 +1,6 @@
 import React, { useEffect, useState } from 'react'
-import { Dimensions } from 'react-native'
 
 import { useDesktopOptions } from '../hooks/use-desktop-options'
-import { useDimensions } from '../hooks/use-dimensions'
 import { Platform } from '../libs/platform'
 import { useTheme } from './context/ThemeContext'
 import { getThemeColorOrItself } from './themed/helpers'
@@ -11,21 +9,32 @@ export function ElectronTitleBar() {
   const theme = useTheme()
 
   const [isFullScreen, setIsFullScreen] = useState(false)
+  const [isMaximized, setIsMaximized] = useState(() =>
+    window.ipc.sendSync('get-is-maximized'),
+  )
   const { isMenuBarMode } = useDesktopOptions()
-  const windowDimensions = useDimensions()
-
-  const isMaximized = windowDimensions.width === Dimensions.get('screen').width
 
   useEffect(() => {
     const handler = (_e: any, value: boolean | unknown) => {
       setIsFullScreen(value === true)
     }
 
-    // TODO: Fix. Not working.
-    window.ipc.addListener('fullscreenchange', handler)
+    window.ipc.addListener('fullscreen-change', handler)
+
+    return () => {
+      window.ipc.removeListener('fullscreen-change', handler)
+    }
+  }, [])
+
+  useEffect(() => {
+    const handler = (_e: any, value: boolean | unknown) => {
+      setIsMaximized(value === true)
+    }
+
+    window.ipc.addListener('is-maximized-change', handler)
 
     return () => {
-      window.ipc.removeListener('fullscreenchange', handler)
+      window.ipc.removeListener('is-maximized-change', handler)
     }
   }, [])
 
```

**File**: `packages/desktop/src/helpers.ts` (modified, +3/-1)
```diff
@@ -48,7 +48,9 @@ export function showWindow(win: BrowserWindow) {
   win.show()
 }
 
-export function getCenterPosition(obj: BrowserWindow | Tray) {
+export function getCenterPosition(
+  obj: Pick<BrowserWindow | Tray, 'getBounds'>,
+) {
   const bounds = obj.getBounds()
 
   const x = Math.round(bounds.x + bounds.width / 2)
```

**File**: `packages/desktop/src/ipc.ts` (modified, +77/-79)
```diff
@@ -56,27 +56,30 @@ export function register() {
     mainWindow.setFullScreen(false)
   })
 
+  ipcMain.removeAllListeners('minimize')
+  ipcMain.addListener('minimize', () => {
+    const mainWindow = window.getMainWindow()
+    if (!mainWindow) return
+    mainWindow.minimize()
+  })
+
+  ipcMain.removeAllListeners('get-is-maximized')
+  ipcMain.addListener('get-is-maximized', (e: any) => {
+    if (!e) return
+
+    e.returnValue = window.getMainWindow()?.isMaximized()
+  })
+
   ipcMain.removeAllListeners('toggle-maximize')
   ipcMain.addListener('toggle-maximize', () => {
     const mainWindow = window.getMainWindow()
     if (!mainWindow) return
 
     if (mainWindow.isMaximized()) {
-      const { width, height } = mainWindow.getBounds()
-      const lockOnCenter = config.store.get('lockOnCenter')
-
-      config.store.set('lockOnCenter', true)
-      mainWindow.setSize(
-        Math.round(width * 0.9),
-        Math.round(height * 0.9),
-        true,
-      )
-      config.store.set('lockOnCenter', lockOnCenter)
-
-      return
+      mainWindow.unmaximize()
+    } else {
+      mainWindow.maximize()
     }
-
-    mainWindow.maximize()
   })
 
   ipcMain.removeAllListeners('unread-counter')
@@ -86,13 +89,6 @@ export function register() {
     if (dock) dock.setBadge(unreadCount > 0 ? `${unreadCount}` : '')
   })
 
-  ipcMain.removeAllListeners('minimize')
-  ipcMain.addListener('minimize', () => {
-    const mainWindow = window.getMainWindow()
-    if (!mainWindow) return
-    mainWindow.minimize()
-  })
-
   ipcMain.removeAllListeners('get-all-settings')
   ipcMain.addListener('get-all-settings', (e: any) => {
     if (!e) return
@@ -109,81 +105,78 @@ export function register() {
   })
 
   ipcMain.removeAllListeners('update-settings')
-  ipcMain.addListener(
-    'update-settings',
-    (_e: any, payload: Parameters<typeof emit>[1]) => {
-      const settings = payload && payload.settings
-      const value = payload && payload.value
-
-      const mainWindow = window.getMainWindow()
-
-      switch (settings) {
-        case 'enablePushNotifications': {
-          config.store.set('enablePushNotifications', value)
-          if (value && config.store.get('enablePushNotificationsSound'))
-            helpers.playNotificationSound()
-          break
-        }
+  ipcMain.addListener('update-settings', (_e: any, payload) => {
+    const settings = payload && payload.settings
+    const value = payload && payload.value
 
-        case 'enablePushNotificationsSound': {
-          config.store.set('enablePushNotificationsSound', value)
+    const mainWindow = window.getMainWindow()
 
-          if (value) helpers.playNotificationSound()
+    switch (settings) {
+      case 'enablePushNotifications': {
+        config.store.set('enablePushNotifications', value)
+        if (value && config.store.get('enablePushNotificationsSound'))
+          helpers.playNotificationSound()
+        break
+      }
 
-          break
-        }
+      case 'enablePushNotificationsSound': {
+        config.store.set('enablePushNotificationsSound', value)
 
-        case 'isMenuBarMode': {
-          config.store.set('isMenuBarMode', !!value)
-          config.store.set('isMenuBarModeChangedAt', Date.now())
+        if (value) helpers.playNotificationSound()
 
-          if (mainWindow && mainWindow.isFullScreen()) {
-            mainWindow.setFullScreen(false)
-            setTimeout(window.updateOrRecreateWindow, 1000)
-          } else {
-            window.updateOrRecreateWindow()
-          }
-          break
+        break
+      }
+
+      case 'isMenuBarMode': {
+        config.store.set('isMenuBarMode', !!value)
+        config.store.set('isMenuBarModeChangedAt', Date.now())
+
+        if (mainWindow && mainWindow.isFullScreen()) {
+          mainWindow.setFullScreen(false)
+          setTimeout(window.updateOrRecreateWindow, 1000)
+        } else {
+          window.updateOrRecreateWindow()
         }
+        break
+      }
 
-        case 'lockOnCenter': {
-          config.store.set('lockOnCenter', value)
+      case 'lockOnCenter': {
+        config.store.set('lockOnCenter', value)
 
-          if (!mainWindow) return
+        if (!mainWindow) return
 
-          if (value) {
-            if (!config.store.get('isMenuBarMode')) {
-              mainWindow.setMovable(false)
-            }
+        if (value) {
+          if (!config.store.get('isMenuBarMode')) {
+            mainWindow.setMovable(false)
+          }
 
-            window.center(mainWindow)
-          } else {
-            if (!config.store.get('isMenuBarMode')) {
-              mainWindow.setMovable(
-                window.getBrowserWindowOptions().movable !== false,
-              )
-            }
+          window.center(mainWindow)
+        } else {
+          if (!config.store.get('isMenuBarMode')) {
+            mainWindow.setMovable(
+              window.getBrowserWindowOptions().movable !== false,
+            )
           }
-     
```

**File**: `packages/desktop/src/menu.ts` (modified, +0/-6)
```diff
@@ -190,12 +190,6 @@ export function getRestartMenuItem() {
 
 export function getModeMenuItems() {
   const _mainWindow = window.getMainWindow()
-  const _tray = tray.getTray()
-  if (
-    !(_tray && _tray.getBounds().width && _tray.getBounds().height) &&
-    !config.store.get('isMenuBarMode')
-  )
-    return []
 
   const isCurrentWindow =
     _mainWindow && _mainWindow.isVisible() && !_mainWindow.isMinimized()
```

**File**: `packages/desktop/src/tray.ts` (modified, +18/-11)
```diff
@@ -87,18 +87,26 @@ export function showTrayContextPopup() {
 export function alignWindowWithTray(win: BrowserWindow) {
   if (!(tray && !tray.isDestroyed())) return
 
-  const trayBounds = tray.getBounds()
+  const xSpacing = 10
+  const ySpacing = 0
+
+  const workArea = screen.getDisplayFromCursor().workArea
+  const screenSize = screen.getDisplayFromCursor().size
+
+  let trayBounds = tray.getBounds()
   if (
     !(trayBounds.width && trayBounds.height && (trayBounds.x || trayBounds.y))
   ) {
-    window.center(win)
-    return
+    trayBounds = {
+      x: trayBounds.x || screenSize.width - xSpacing,
+      y: trayBounds.y || 0,
+      width: trayBounds.width || 0,
+      height: trayBounds.height || 0,
+    }
   }
 
-  const screenSize = screen.getDisplayFromCursor().size
-  const workArea = screen.getDisplayFromCursor().workArea
   const windowBounds = win.getBounds()
-  const trayCenter = helpers.getCenterPosition(tray)
+  const trayCenter = helpers.getCenterPosition({ getBounds: () => trayBounds })
 
   const top = trayBounds.y < screenSize.height / 3
   const bottom = screenSize.height - trayBounds.y < screenSize.height / 3
@@ -107,7 +115,6 @@ export function alignWindowWithTray(win: BrowserWindow) {
 
   let x: number
   let y: number
-  const spacing = 0
 
   if (top) {
     y = Math.round(trayCenter.y)
@@ -126,12 +133,12 @@ export function alignWindowWithTray(win: BrowserWindow) {
   }
 
   const fixedX = Math.max(
-    workArea.x + spacing,
-    Math.min(x, workArea.x + workArea.width - windowBounds.width - spacing),
+    workArea.x + xSpacing,
+    Math.min(x, workArea.x + workArea.width - windowBounds.width - xSpacing),
   )
   const fixedY = Math.max(
-    workArea.y + spacing,
-    Math.min(y, workArea.y + workArea.height - windowBounds.height - spacing),
+    workArea.y + ySpacing,
+    Math.min(y, workArea.y + workArea.height - windowBounds.height - ySpacing),
   )
 
   win.setPosition(fixedX, fixedY)
```

**File**: `packages/desktop/src/window.ts` (modified, +25/-23)
```diff
@@ -1,16 +1,12 @@
-import {
-  app,
-  BrowserWindow,
-  BrowserWindowConstructorOptions,
-  ipcMain,
-} from 'electron'
+import { app, BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
 import path from 'path'
 
 import { forceQuit } from '.'
 import * as config from './config'
 import * as constants from './constants'
 import * as dock from './dock'
 import * as helpers from './helpers'
+import * as ipc from './ipc'
 import { __DEV__ } from './libs/electron-is-dev'
 import { WindowState, windowStateKeeper } from './libs/electron-window-state'
 import * as menu from './menu'
@@ -125,14 +121,22 @@ export function createWindow() {
     }, 200)
   })
 
+  win.on('maximize', () => {
+    ipc.emit('is-maximized-change', true)
+  })
+
+  win.on('unmaximize', () => {
+    ipc.emit('is-maximized-change', false)
+  })
+
   win.on('enter-full-screen', () => {
-    ipcMain.emit('fullscreenchange', null, true)
+    ipc.emit('fullscreen-change', true)
     const _dock = dock.getDock()
     if (_dock) _dock.show()
   })
 
   win.on('leave-full-screen', () => {
-    ipcMain.emit('fullscreenchange', null, false)
+    ipc.emit('fullscreen-change', false)
     if (!(mainWindow && mainWindow.isFocused())) return
     update()
   })
@@ -215,19 +219,27 @@ export function updateOrRecreateWindow() {
   helpers.showWindow(mainWindow)
 }
 
+let isFirstTime = true
 function updateBrowserWindowOptions() {
   if (!mainWindow) return
 
   const options = getBrowserWindowOptions()
 
+  if (config.store.get('isMenuBarMode')) {
+    mainWindowState.unmanage()
+    menubarWindowState.manage(mainWindow)
+  } else {
+    menubarWindowState.unmanage()
+    mainWindowState.manage(mainWindow)
+  }
+
   if (mainWindow.setWindowButtonVisibility)
     mainWindow.setWindowButtonVisibility(options.titleBarStyle === 'hidden')
 
   const maximize =
     !config.store.get('isMenuBarMode') &&
-    (mainWindow.isMaximized() ||
-      mainWindowState.isMaximized ||
-      config.store.get('launchCount') === 1)
+    (mainWindow.isMaximized() || (isFirstTime && mainWindowState.isMaximized))
+  isFirstTime = false
 
   mainWindow.setAlwaysOnTop(options.alwaysOnTop === true)
 
@@ -266,6 +278,8 @@ function updateBrowserWindowOptions() {
       )
     }
   } else {
+    if (mainWindow.isMaximized() || config.store.get('isMenuBarMode'))
+      mainWindow.unmaximize()
     mainWindow.setSize(options.width || 500, options.height || 500, false)
   }
 
@@ -278,24 +292,12 @@ function updateBrowserWindowOptions() {
     }
   }
 
-  mainWindowState.unmanage()
-  menubarWindowState.unmanage()
-  if (config.store.get('isMenuBarMode')) {
-    menubarWindowState.manage(mainWindow)
-  } else {
-    mainWindowState.manage(mainWindow)
-  }
-
   if (config.store.get('isMenuBarMode')) {
     tray.alignWindowWithTray(mainWindow)
   } else {
     if (config.store.get('lockOnCenter')) {
       center(mainWindow)
     }
-
-    if (maximize) {
-      mainWindow.maximize()
-    }
   }
 }
 
```

---

### Incident Patch 8: `86724e1e` (2020-12-08)
**Commit Message**: Prettier fixes

**File**: `.gitignore` (modified, +2/-1)
```diff
@@ -1,11 +1,12 @@
 *.jsbundle
 *.tsbuildinfo
 .DS_Store
+.eslintcache
 .history
 .jest
+.now
 .vscode
 Pods
 node_modules/
 npm-debug.log
 yarn-error.log
-.now
\ No newline at end of file
```

**File**: `.prettierrc.js` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 module.exports = {
-  parser: 'typescript',
   semi: false,
   singleQuote: true,
   trailingComma: 'all',
```

**File**: `landing/package.json` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
     "compile": "cd .",
     "deploy": "yarn compile && yarn now",
     "export": "yarn run-scripts && next build && next export",
-    "format": "prettier --write '{.,src/**,pages/**}/*.{js,jsx,ts,tsx}'",
+    "format": "prettier --write '{.,src,pages}/**/*.{js,jsx,ts,tsx,json}'",
     "lint": "eslint src",
     "now": "now",
     "postinstall": "yarn run-scripts",
@@ -58,4 +58,4 @@
   "engines": {
     "node": ">=12"
   }
-}
\ No newline at end of file
+}
```

**File**: `package.json` (modified, +5/-3)
```diff
@@ -62,9 +62,11 @@
     }
   },
   "lint-staged": {
-    "*.{ts,tsx}": [
-      "eslint --fix --quiet",
+    "*.{js,jsx,ts,tsx}": [
+      "eslint --fix --quiet"
+    ],
+    "*.{js,jsx,ts,tsx,json}": [
       "prettier --write"
     ]
   }
-}
\ No newline at end of file
+}
```

**File**: `packages/components/package.json` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@
   "scripts": {
     "compile": "tsc -b --incremental",
     "clean": "shx rm -f *.tsbuildinfo && shx rm -rf dist/*",
-    "format": "prettier --write '{.,src}/**.{js,jsx,ts,tsx}'",
+    "format": "prettier --write '{.,src}/**/*.{js,jsx,ts,tsx,json}'",
     "lint": "eslint src",
     "prepare": "cd .. && yarn patch-package"
   },
@@ -72,4 +72,4 @@
   "peerDependencies": {
     "eslint": "*"
   }
-}
\ No newline at end of file
+}
```

**File**: `packages/components/src/components/modals/AddColumnDetailsModal.tsx` (modified, +87/-87)
```diff
@@ -825,24 +825,24 @@ function getNewColumnAndSubscriptions(
       switch (subtype) {
         case 'REPO_NOTIFICATIONS':
         default: {
-          newSubscription = createSubscriptionObjectWithId<
-            NotificationColumnSubscriptionCreation
-          >({
-            params: {
-              ...(defaultParams as any),
-              all: true,
-              participating: formValues.inbox === 'participating',
-              ...(!!(repoOwnerAndRepo.owner && repoOwnerAndRepo.repo) && {
-                owner: repoOwnerAndRepo.owner,
-                repo: repoOwnerAndRepo.repo,
-              }),
+          newSubscription = createSubscriptionObjectWithId<NotificationColumnSubscriptionCreation>(
+            {
+              params: {
+                ...(defaultParams as any),
+                all: true,
+                participating: formValues.inbox === 'participating',
+                ...(!!(repoOwnerAndRepo.owner && repoOwnerAndRepo.repo) && {
+                  owner: repoOwnerAndRepo.owner,
+                  repo: repoOwnerAndRepo.repo,
+                }),
+              },
+              type,
+              subtype:
+                repoOwnerAndRepo.owner && repoOwnerAndRepo.repo
+                  ? 'REPO_NOTIFICATIONS'
+                  : undefined,
             },
-            type,
-            subtype:
-              repoOwnerAndRepo.owner && repoOwnerAndRepo.repo
-                ? 'REPO_NOTIFICATIONS'
-                : undefined,
-          })
+          )
           _newColumnFilters.notifications =
             _newColumnFilters.notifications || {}
           _newColumnFilters.notifications.participating =
@@ -865,44 +865,44 @@ function getNewColumnAndSubscriptions(
         case 'ISSUES':
         case 'PULLS':
         default: {
-          newSubscription = createSubscriptionObjectWithId<
-            IssueOrPullRequestColumnSubscriptionCreation
-          >({
-            params: {
-              ...(defaultParams as any),
-              owners: {
-                ...(!!formValues.owner && {
-                  [formValues.owner]: {
-                    value: true,
-                    repos: {},
-                  },
-                }),
-
-                ...(!!repoOwnerAndRepo.owner &&
-                  !!repoOwnerAndRepo.repo && {
-                    [repoOwnerAndRepo.owner]: {
+          newSubscription = createSubscriptionObjectWithId<IssueOrPullRequestColumnSubscriptionCreation>(
+            {
+              params: {
+                ...(defaultParams as any),
+                owners: {
+                  ...(!!formValues.owner && {
+                    [formValues.owner]: {
                       value: true,
-                      repos: {
-                        [repoOwnerAndRepo.repo]: true,
-                      },
+                      repos: {},
                     },
                   }),
-              },
-              involves: formValues.user
-                ? {
-                    [formValues.user]: true,
-                  }
-                : undefined,
-              subjectType:
-                subtype === 'ISSUES'
-                  ? 'Issue'
-                  : subtype === 'PULLS'
-                  ? 'PullRequest'
+
+                  ...(!!repoOwnerAndRepo.owner &&
+                    !!repoOwnerAndRepo.repo && {
+                      [repoOwnerAndRepo.owner]: {
+                        value: true,
+                        repos: {
+                          [repoOwnerAndRepo.repo]: true,
+                        },
+                      },
+                    }),
+                },
+                involves: formValues.user
+                  ? {
+                      [formValues.user]: true,
+                    }
                   : undefined,
+                subjectType:
+                  subtype === 'ISSUES'
+                    ? 'Issue'
+                    : subtype === 'PULLS'
+                    ? 'PullRequest'
+                    : undefined,
+              },
+              type,
+              subtype,
             },
-            type,
-            subtype,
-          })
+          )
 
           _newColumnFilters.involves = newSubscription.params.involves
           _newColumnFilters.subjectTypes = newSubscription.params.subjectType
@@ -936,32 +936,32 @@ function getNewColumnAndSubscriptions(
       switch (subtype) {
         case 'ORG_PUBLIC_EVENTS':
         case 'USER_ORG_EVENTS': {
-          newSubscription = createSubscriptionObjectWithId<
-            ActivityColumnSubscriptionCreation
-          >({
-            params: {
-              ...(defaultParams as any),
-              org: formValues.org,
-              username: subtype === 'USER_ORG_EVENTS' ? loggedUsername : '',
+          newSubscription = createSubscriptionObjectWithId<ActivityColumnSubscriptionCreation>(
+            {
+              params: {
+                ...(defaultParams as any),
+                org: formValues.org,
```

**File**: `packages/components/src/libs/swipeable/AppleSwipeableRow.tsx` (modified, +1/-3)
```diff
@@ -23,9 +23,7 @@ export interface AppleSwipeableRowAction extends BaseSwipeableRowAction {
   label: string
 }
 
-export type AppleSwipeableRowProps = BaseSwipeableRowProps<
-  AppleSwipeableRowAction
->
+export type AppleSwipeableRowProps = BaseSwipeableRowProps<AppleSwipeableRowAction>
 
 export class AppleSwipeableRow extends BaseSwipeableRow<
   AppleSwipeableRowProps,
```

**File**: `packages/components/src/libs/swipeable/GoogleSwipeableRow.tsx` (modified, +1/-3)
```diff
@@ -20,9 +20,7 @@ export type GoogleSwipeableRowAction = BaseSwipeableRowAction & {
   icon: IconProp
 }
 
-export type GoogleSwipeableRowProps = BaseSwipeableRowProps<
-  GoogleSwipeableRowAction
->
+export type GoogleSwipeableRowProps = BaseSwipeableRowProps<GoogleSwipeableRowAction>
 
 const AnimatedOcticons = Animated.createAnimatedComponent(Octicons)
 const AnimatedMaterialIcons = Animated.createAnimatedComponent(MaterialIcons)
```

---

### Incident Patch 9: `9c950fdd` (2020-12-08)
**Commit Message**: Patch react-spring production bug

https://github.com/pmndrs/react-spring/issues/1078\#issuecomment-663635523

**File**: `patches/@react-spring+shared+9.0.0-rc.3.patch` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+diff --git a/node_modules/@react-spring/shared/package.json b/node_modules/@react-spring/shared/package.json
+index 93be66f..0ef7fd7 100644
+--- a/node_modules/@react-spring/shared/package.json
++++ b/node_modules/@react-spring/shared/package.json
+@@ -11,7 +11,7 @@
+   "contributors": [
+     "Alec Larson (https://github.com/aleclarson)"
+   ],
+-  "sideEffects": false,
++  "sideEffects": true,
+   "main": "cjs/index.js",
+   "module": "esm/index.js",
+   "dependencies": {
```

---

### Incident Patch 10: `5b1d7a0a` (2020-12-08)
**Commit Message**: [Mobile] Fix Dialog colors due to order of providers

**File**: `packages/components/src/components/AppProviders.tsx` (modified, +23/-23)
```diff
@@ -28,30 +28,30 @@ export function AppProviders(props: AppProvidersProps) {
     <HelmetProvider>
       <ReduxProvider store={store as any}>
         <PersistGate loading={null} persistor={persistor}>
-          <DialogProvider>
-            <DeepLinkProvider>
-              <LoginHelpersProvider>
-                {/* <PlansProvider> */}
-                <AppLayoutProvider>
-                  <ColumnFocusProvider>
-                    <ColumnWidthProvider>
-                      <ColumnFiltersProvider>
-                        <AppearanceProvider>
-                          <ThemeProvider>
-                            <SafeAreaProvider>
+          <AppearanceProvider>
+            <ThemeProvider>
+              <SafeAreaProvider>
+                <DialogProvider>
+                  <DeepLinkProvider>
+                    {/* <PlansProvider> */}
+                    <AppLayoutProvider>
+                      <ColumnFocusProvider>
+                        <ColumnWidthProvider>
+                          <ColumnFiltersProvider>
+                            <LoginHelpersProvider>
                               {props.children}
-                              <OverrideSystemDialog />
-                            </SafeAreaProvider>
-                          </ThemeProvider>
-                        </AppearanceProvider>
-                      </ColumnFiltersProvider>
-                    </ColumnWidthProvider>
-                  </ColumnFocusProvider>
-                </AppLayoutProvider>
-                {/* </PlansProvider> */}
-              </LoginHelpersProvider>
-            </DeepLinkProvider>
-          </DialogProvider>
+                            </LoginHelpersProvider>
+                            <OverrideSystemDialog />
+                          </ColumnFiltersProvider>
+                        </ColumnWidthProvider>
+                      </ColumnFocusProvider>
+                    </AppLayoutProvider>
+                    {/* </PlansProvider> */}
+                  </DeepLinkProvider>
+                </DialogProvider>
+              </SafeAreaProvider>
+            </ThemeProvider>
+          </AppearanceProvider>
         </PersistGate>
       </ReduxProvider>
     </HelmetProvider>
```

---

### Incident Patch 11: `ea8921b4` (2020-12-08)
**Commit Message**: Fix some bad credential errors caused by using unsupported token type

**File**: `packages/components/src/redux/sagas/subscriptions.ts` (modified, +5/-10)
```diff
@@ -331,7 +331,7 @@ function* onFetchRequest(
 
   const owner = getSubscriptionOwnerOrOrg(subscription)
 
-  const privateToken = selectors.getPrivateTokenByOwnerSelector(state, owner)
+  const privateTokenDetails = selectors.githubPrivateTokenDetailsSelector(state)
   const installationToken = selectors.installationTokenByOwnerSelector(
     state,
     owner,
@@ -340,16 +340,11 @@ function* onFetchRequest(
   const githubAppTokenDetails = selectors.githubAppTokenDetailsSelector(state)
   const loggedUsername = selectors.currentGitHubUsernameSelector(state)!
 
-  const githubToken =
-    (subscription &&
-      (subscription.type === 'activity' ||
-        subscription.type === 'issue_or_pr') &&
-      (subscription.subtype === 'USER_ORG_EVENTS' &&
-      privateToken === installationToken
-        ? undefined
-        : privateToken)) ||
+  const githubToken: string =
+    privateTokenDetails?.token ||
     githubOAuthOrPersonalToken ||
-    (githubAppTokenDetails && githubAppTokenDetails.token)
+    (subscription?.type === 'issue_or_pr' && githubAppTokenDetails?.token) ||
+    ''
 
   const appTokenType: GitHubAppTokenType =
     (githubToken === installationToken && 'app-installation') ||
```

**File**: `packages/components/src/redux/selectors/github/auth.ts` (modified, +20/-3)
```diff
@@ -47,13 +47,30 @@ export const githubTokenCreatedAtSelector = (state: RootState) => {
   return (tokenDetails && tokenDetails.tokenCreatedAt) || undefined
 }
 
+export const githubPrivateTokenDetailsSelector = (state: RootState) => {
+  const githubPersonalTokenDetails = githubPersonalTokenDetailsSelector(state)
+  if (
+    githubPersonalTokenDetails?.token &&
+    githubPersonalTokenDetails.scope?.includes('repo')
+  )
+    return githubPersonalTokenDetails
+
+  const githubOAuthTokenDetails = githubOAuthTokenDetailsSelector(state)
+  if (
+    githubOAuthTokenDetails?.token &&
+    githubOAuthTokenDetails.scope?.includes('repo')
+  )
+    return githubOAuthTokenDetails
+
+  return undefined
+}
+
 export const getPrivateTokenByOwnerSelector = (
   state: RootState,
   ownerName: string | undefined,
 ) => {
-  const tokenDetails = githubTokenDetailsSelector(state)
-  if (tokenDetails?.token && tokenDetails.scope?.includes('repo'))
-    return tokenDetails.token
+  const privateTokenDetails = githubPrivateTokenDetailsSelector(state)
+  if (privateTokenDetails?.token) return privateTokenDetails.token
 
   const installationToken = installationTokenByOwnerSelector(state, ownerName)
   return installationToken || undefined
```

---

### Incident Patch 12: `574b73bf` (2020-12-08)
**Commit Message**: Fix Dialog not calling cancel callback when clicking outside

**File**: `packages/components/src/components/context/DialogContext.tsx` (modified, +3/-0)
```diff
@@ -190,6 +190,9 @@ const DialogView = React.memo(
                 options && options.cancelable === false
                   ? undefined
                   : () => {
+                      buttons
+                        ?.find((button) => button?.style === 'cancel')
+                        ?.onPress?.('')
                       hide()
                     }
               }
```

---

### Incident Patch 13: `4431f07b` (2020-12-08)
**Commit Message**: Fix when to show text about code access

**File**: `packages/components/src/containers/EventCardsContainer.tsx` (modified, +6/-1)
```diff
@@ -8,6 +8,8 @@ import React, { useCallback } from 'react'
 import { View } from 'react-native'
 import { useDispatch } from 'react-redux'
 
+import { constants } from '@devhub/core'
+
 import { CardsSearchHeader } from '../components/cards/CardsSearchHeader'
 import { EmptyCards } from '../components/cards/EmptyCards'
 import { EventCards, EventCardsProps } from '../components/cards/EventCards'
@@ -249,7 +251,10 @@ export const EventCardsContainer = React.memo(
                     ['USER_ORG_EVENTS'].includes(s.subtype || ''),
                   )
                     ? 'Create a token with this permission:'
-                    : 'Install the GitHub App to unlock private access. No code permission required.'
+                    : 'Install the GitHub App to unlock private access.' +
+                      (!constants.GITHUB_APP_HAS_CODE_ACCESS
+                        ? ' No code permission required.'
+                        : '')
                 }
                 title="Private repository?"
               />
```

**File**: `packages/components/src/containers/IssueOrPullRequestCardsContainer.tsx` (modified, +8/-1)
```diff
@@ -8,6 +8,8 @@ import React, { useCallback } from 'react'
 import { View } from 'react-native'
 import { useDispatch } from 'react-redux'
 
+import { constants } from '@devhub/core'
+
 import { CardsSearchHeader } from '../components/cards/CardsSearchHeader'
 import { EmptyCards } from '../components/cards/EmptyCards'
 import { GenericMessageWithButtonView } from '../components/cards/GenericMessageWithButtonView'
@@ -223,7 +225,12 @@ export const IssueOrPullRequestCardsContainer = React.memo(
                   </>
                 }
                 emoji="lock"
-                subtitle="Install the GitHub App to unlock private access. No code permission required."
+                subtitle={
+                  'Install the GitHub App to unlock private access.' +
+                  (!constants.GITHUB_APP_HAS_CODE_ACCESS
+                    ? ' No code permission required.'
+                    : '')
+                }
                 title="Private repository?"
               />
             </View>
```

---

### Incident Patch 14: `3786ba0a` (2020-12-07)
**Commit Message**: [Mobile] Fix error: No command found "focus"

**File**: `packages/components/src/components/context/DialogContext.tsx` (modified, +4/-1)
```diff
@@ -339,7 +339,10 @@ const DialogView = React.memo(
                             >
                               <Button
                                 autoFocus={
-                                  buttonType === 'primary' && !disabled
+                                  Platform.OS === 'web' &&
+                                  !(renderInput && options) &&
+                                  buttonType === 'primary' &&
+                                  !disabled
                                 }
                                 disabled={disabled}
                                 onPress={() => {
```

---

### Incident Patch 15: `2f1f5c83` (2020-12-07)
**Commit Message**: Fix local http cache when using a different github token

**File**: `packages/components/src/libs/github/index.ts` (modified, +12/-4)
```diff
@@ -46,7 +46,12 @@ export async function getNotifications(
     useCache?: boolean
   },
 ) {
-  const cacheKey = JSON.stringify(['NOTIFICATIONS', params, subscriptionId])
+  const cacheKey = JSON.stringify([
+    'NOTIFICATIONS',
+    params,
+    subscriptionId,
+    githubToken,
+  ])
   const cacheValue = cache[cacheKey]
 
   const _params = cleanupObject(params)
@@ -111,13 +116,14 @@ export async function getActivity<T extends GitHubActivityType>(
     useCache?: boolean
   },
 ) {
-  const cacheKey = JSON.stringify([type, params, subscriptionId])
+  const cacheKey = JSON.stringify([type, params, subscriptionId, githubToken])
   const cacheValue = cache[cacheKey]
 
   const _params = cleanupObject(params)
   _params.headers = _params.headers || {}
   _params.headers['If-None-Match'] = ''
-  _params.headers.Accept = 'application/vnd.github.shadow-cat-preview'
+  _params.headers.Accept =
+    'application/vnd.github.shadow-cat-preview,application/vnd.github.v3+json'
 
   if (useCache) {
     if (_params.since) {
@@ -204,14 +210,16 @@ export async function getIssuesOrPullRequests<
     type,
     { subscriptionParams, requestParams },
     subscriptionId,
+    githubToken,
   ])
   const cacheValue = cache[cacheKey]
 
   const _params = cleanupObject(requestParams)
   _params.headers = {
     ..._params.headers,
     'If-None-Match': '',
-    Accept: 'application/vnd.github.shadow-cat-preview',
+    Accept:
+      'application/vnd.github.shadow-cat-preview,application/vnd.github.v3+json',
   }
 
   if (useCache) {
```

#### Recent Merged Pull Requests:
- **PR #367** (closed): Create SECURITY.md (@Chewypewy)
- **PR #358** (closed): Update use-oauth.ts (@Wasifz9)
- **PR #325** (closed): Create Funlox.news (@AxerynYT)
- **PR #312** (closed): Create devcontainer.json (@patriciakid)
- **PR #311** (closed): Create Nee (@patriciakid)
- **PR #310** (closed): Update README.md (@JustALilDumb)
- **PR #306** (closed): Add new feature (@ghost)
- **PR #304** (closed): Create dev.fork (@SZzoe)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
