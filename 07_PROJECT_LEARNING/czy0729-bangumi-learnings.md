# Forensic Learning Record (Deep Inspection): czy0729/Bangumi

> **Canonical Artifact**: `07_PROJECT_LEARNING/czy0729-bangumi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/czy0729/Bangumi](https://github.com/czy0729/Bangumi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:51:36.055Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `czy0729/Bangumi`
- **Description**: :electron: An unofficial https://bgm.tv ui first app client for Android and iOS, built with React Native. 一个无广告、以爱好为驱动、不以盈利为目的、专门做 ACG 的类似豆瓣的追番记录，bgm.tv 第三方客户端。为移动端重新设计，内置大量加强的网页端难以实现的功能，且提供了相当的自定义选项。 目前已适配 iOS / Android。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 6020 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.storybook/utils.js`
```
/*
 * @Author: czy0729
 * @Date: 2023-11-02 15:05:50
 * @Last Modified by: czy0729
 * @Last Modified time: 2024-01-13 22:06:46
 */
export function parseUrlParams() {
  const params = new URLSearchParams(window.location.search)
  const result = {}

  for (const [key, value] of params) {
    result[key] = value
  }
  return result
}

```

### Core Architecture Module: `eslint-rules/utils.js`
```
/*
 * @Description: ESLint 规则共享工具，定义所有 "computed" theme 值和函数的白名单
 *
 * COMPUTED_PROPS: _. 上随主题变化的属性（如 _.colorBg, _.wind, _.isDark）
 * COMPUTED_FNS:   _. 上返回动态值的函数（如 _.select(), _.portrait()）
 *
 * 这些值/函数被 forbid-computed-in-create 和 require-computed-in-memo-styles 两个规则共享，
 * 用于判断样式是否依赖主题状态。
 */

const COMPUTED_PROPS = new Set([
  '_colorBg',
  '_colorDarkModeLevel1',
  '_colorDarkModeLevel1Hex',
  '_colorDarkModeLevel1Raw',
  '_colorDarkModeLevel2',
  '_colorPlain',
  '_colorPlainHex',
  '_colorPlainRaw',
  '_colorWait',
  'autoColorScheme',
  'baseFontStyle',
  'colorAsk',
  'colorAvatar',
  'colorBg',
  'colorBgRaw',
  'colorBid',
  'colorBorder',
  'colorDanger',
  'colorDarkModeLevel1',
  'colorDarkModeLevel1Hex',
  'colorDarkModeLevel1Raw',
  'colorDarkModeLevel2',
  'colorDarkModeLevel2Raw',
  'colorDepthAsk',
  'colorDepthBid',
  'colorDesc',
  'colorDisabled',
  'colorHighLight',
  'colorIcon',
  'colorMain',
  'colorMainLight',
  'colorPlain',
  'colorPlainHex',
  'colorPlainRaw',
  'colorPrimary',
  'colorSub',
  'colorSuccess',
  'colorTinygrailActive',
  'colorTinygrailBg',
  'colorTinygrailBorder',
  'colorTinygrailContainer',
  'colorTinygrailContainerHex',
  'colorTinygrailIcon',
  'colorTinygrailPlain',
  'colorTinygrailPrimary',
  'colorTinygrailText',
  'colorTitle',
  'colorTitleRaw',
  'colorWait',
  'colorWarning',
  'colorYellow',
  'container',
  'customFontFamily',
  'deepDark',
  'fontBoldFamily',
  'fontBoldStyle',
  'fontFamily',
  'fontSize10',
  'fontSize11',
  'fontSize12',
  'fontSize13',
  'fontSize14',
  'fontSize15',
  'fontSize16',
  'fontSize17',
  'fontSize18',
  'fontSize19',
  'fontSize20',
  'fontSize21',
  'fontSize22',
  'fontSize23',
  'fontSize24',
  'fontSize25',
  'fontSize26',
  'fontSize27',
  'fontSize28',
  'fontSize29',
  'fontSize30',
  'fontSize31',
  'fontSize32',
  'fontSize33',
  'fontSize34',
  'fontSize35',
  'fontSize36',
  'fontSize37',
  'fontSize38',
  'fontSize39',
  'fontSize40',
  'fontSize41',
  'fontSize42',
  'fontSize43',
  'fontSize44',
  'fontSize45',
  'fontSize46',
  'fontSize47',
  'fontSize48',
  'fontSize49',
  'fontSize50',
  'fontSize51',
  'fontSize52',
  'fontSize53',
  'fontSize54',
  'fontSize6',
  'fontSize64',
  'fontSize7',
  'fontSize72',
  'fontSize8',
  'fontSize80',
  'fontSize9',
  'fontSize96',
  'fontSizeAdjust',
  'fontStyle',
  'isDark',
  'isGreen',
  'isLandscape',
  'isMobileLanscape',
  'isTinygrailDark',
  'isWeb',
  'landscapeWind',
  'landscapeWindSm',
  'landscapeWindow',
  'landscapeWindowSm',
  'letterSpacing',
  'mode',
  'orientation',
  'parallaxImageHeight',
  'tinygrailMode',
  'tinygrailThemeMode',
  'wind',
  'windSm',
  'window',
  'windowSm',
  'wsaLayoutChanged'
])

const COMPUTED_FNS = new Set(['deep', 'grid', 'num', 'portrait', 'select'])

module.exports = { COMPUTED_PROPS, COMPUTED_FNS }

```

### Core Architecture Module: `jest/mocks/expo-modules-core.js`
```
/*
 * @Author: czy0729
 * @Date: 2026-09-06 18:27:36
 * @Last Modified by:   czy0729
 * @Last Modified time: 2026-09-06 18:27:36
 */
module.exports = {
  requireNativeModule: jest.fn(() => ({})),
  requireOptionalNativeModule: jest.fn(() => ({}))
}

```

### Core Architecture Module: `src/components/@/react-native-render-html/index.js`
```
/*
 * https://github.com/archriss/react-native-render-html/blob/v4.1.1/index.js
 * @Author: czy0729
 * @Date: 2019-08-14 16:25:17
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-01-24 06:27:35
 */
import RNRenderHTML from './src/HTML'
import { a as rendererA } from './src/HTMLRenderers'

export { RNRenderHTML, rendererA }

export default RNRenderHTML

```

### Core Architecture Module: `src/components/@/react-native-render-html/src/HTML.jsx`
```
/*
 * @Author: czy0729
 * @Date: 2019-08-14 16:25:55
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-09-04 00:49:57
 *
 * https://github.com/archriss/react-native-render-html/pull/268/commits/8a61abcd0d900bbc58141f5cf7491fb0f09fbfe4
 */
import React, { PureComponent } from 'react'
import { View, Text, Dimensions, StyleSheet } from 'react-native'
import {
  cssStringToRNStyle,
  _getElementClassStyles,
  cssStringToObject,
  cssObjectToString,
  computeTextStyles
} from 'react-native-render-html/src/HTMLStyles'
import {
  BLOCK_TAGS,
  TEXT_TAGS,
  MIXED_TAGS,
  IGNORED_TAGS,
  TEXT_TAGS_IGNORING_ASSOCIATION,
  STYLESETS,
  TextOnlyPropTypes,
  PREFORMATTED_TAGS
} from 'react-native-render-html/src/HTMLUtils'
import {
  generateDefaultBlockStyles,
  generateDefaultTextStyles
} from 'react-native-render-html/src/HTMLDefaultStyles'
import htmlparser2 from 'htmlparser2'
import { stl } from '@utils/utils'
import { IOS } from '@constants/env'
import { _ } from '@stores'
import { androidTextFixedStyle } from '@styles'
import * as HTMLRenderers from './HTMLRenderers'
import { optimizeComputeTextStyles, formatSpacing } from './utils'

const flexStyle = { flex: 1, alignItems: 'center' }

const k = 0

export default class HTML extends PureComponent {
  // static propTypes = {
  //   renderers: PropTypes.object.isRequired,
  //   ignoredTags: PropTypes.array.isRequired,
  //   ignoredStyles: PropTypes.array.isRequired,
  //   allowedStyles: PropTypes.array,
  //   decodeEntities: PropTypes.bool.isRequired,
  //   debug: PropTypes.bool.isRequired,
  //   listsPrefixesRenderers: PropTypes.object,
  //   ignoreNodesFunction: PropTypes.func,
  //   alterData: PropTypes.func,
  //   alterChildren: PropTypes.func,
  //   alterNode: PropTypes.func,
  //   html: PropTypes.string,
  //   uri: PropTypes.string,
  //   tagsStyles: PropTypes.object,
  //   classesStyles: PropTypes.object,
  //   containerStyle: ViewPropTypes ? ViewPropTypes.style : View.propTypes.style,
  //   customWrapper: PropTypes.func,
  //   onLinkPress: PropTypes.func,
  //   onParsed: PropTypes.func,
  //   imagesMaxWidth: PropTypes.number,
  //   staticContentMaxWidth: PropTypes.number,
  //   imagesInitialDimensions: PropTypes.shape({
  //     width: PropTypes.number,
  //     height: PropTypes.number
  //   }),
  //   emSize: PropTypes.number.isRequired,
  //   ptSize: PropTypes.number.isRequired,
  //   baseFontStyle: PropTypes.object.isRequired,
  //   textSelectable: PropTypes.bool,
  //   renderersProps: PropTypes.object,
  //   allowFontScaling: PropTypes.bool
  // }

  static defaultProps = {
    renderers: HTMLRenderers,
    debug: false,
    decodeEntities: true,
    emSize: 14,
    ptSize: 1.3,
    staticContentMaxWidth: Dimensions.get('window').width,
    imagesMaxWidth: Dimensions.get('window').width,
    ignoredTags: IGNORED_TAGS,
    ignoredStyles: [],
    baseFontStyle: { fontSize: 14 },
    tagsStyles: {},
    classesStyles: {},
    textSelectable: false,
    allowFontScaling: true
  }

  constructor(props) {
    super(props)
    this.state = {}
    this.renderers = {
      ...HTMLRenderers,
      ...(this.props.renderers || {})
    }
  }

  UNSAFE_componentWillMount() {
    this.generateDefaultStyles()
  }

  componentDidMount() {
    this.registerDOM()
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { html, uri, renderers } = this.props

    this.generateDefaultStyles(nextProps.baseFontStyle)
    if (renderers !== nextProps.renderers) {
      this.renderers = { ...HTMLRenderers, ...(nextProps.renderers || {}) }
    }
    if (html !== nextProps.html || uri !== nextProps.uri) {
      // If the source changed, register the new HTML and parse it
      this.registerDOM(nextProps)
    } else {
      // If it didn't, let's just parse the current DOM and re-render the nodes
      // to compute potential style changes
      this.parseDOM(this.state.dom, nextProps)
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.dom !== prevState.dom) {
      this.parseDOM(this.state.dom)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async registerDOM(props = this.props, cb) {
    const { html, uri } = props
    if (html) {
      this.setState({
        dom: html,
        loadingRemoteURL: false,
        errorLoadingRemoteURL: false
      })
    } else if (props.uri) {
      try {
        // WIP : This should render a loader and html prop should not be set in state
        // Error handling would be nice, too.
        try {
          this.setState({
            loadingRemoteURL: true,
            errorLoadingRemoteURL: false
          })
          const response = await fetch(uri)
          this.setState({ dom: response._bodyText, loadingRemoteURL: false })
        } catch (err) {
          console.warn(err)
          this.setState({
            errorLoadingRemoteURL: true,
            loadingRemoteURL: false
          })
        }
      } catch (err) {
        console.warn('react-native-render-html', `Couldn't fetch remote HTML from uri : ${uri}`)
        return false
      }
    } else {
      console.warn('react-native-render-html', 'Please provide the html or uri prop.')
    }
  }

  parseDOM(dom, props = this.props) {
    const { decodeEntities, debug, onParsed } = this.props
    const parser = new htmlparser2.Parser(
      new htmlparser2.DomHandler((_err, dom) => {
        let RNElements = this.mapDOMNodesTORNElements(dom, false, props)
        if (onParsed) {
          const alteredRNElements = onParsed(dom, RNElements)
          if (alteredRNElements) {
            RNElements = alteredRNElements
          }
        }
        this.setState({
          RNNodes: this.renderRNElements(RNElements, 'root', 0, props)
        })
        if (debug) {
          console.log('DOMNodes from htmlparser2', dom)
          console.log('RNElements from render-html', RNElements)
        }
      }),
      { decodeEntities: decodeEntities }
    )
    parser.write(dom)
    parser.done()
  }

  generateDefaultStyles(baseFontStyle = this.props.baseFontStyle) {
    this.defaultBlockStyles = generateDefaultBlockStyles(baseFontStyle.fontSize || 14)
    this.defaultTextStyles = generateDefaultTextStyles(baseFontStyle.fontSize || 14)
  }

  /**
   * Loop on children and return whether if their parent needs to be a <View>
   * @param {any} children
   * @returns {boolean}
   * @memberof HTML
   */
  childrenNeedAView(children) {
    for (let i = 0; i < children.length; i++) {
      if (children[i].wrapper === 'View') {
        // If we find at least one View, it has to be nested in one
        return true
      }
    }
    // We didn't find a single view, it can be wrapped in a Text
    return false
  }

  wrapperHasTextChild(children) {
    for (let i = 0; i < children.length; i++) {
      if (children[i].wrapper === 'Text') {
        return true
      }
    }
    return false
  }

  /**
   * Loops on children an find texts that need to be wrapped so we don't render line breaks
   * The wrapper can either be a <p> when it should be a paragraph, or a custom tag named
   * "textwrapper", which renders a plain <Text> component.
   * @param {any} children
   * @returns {array}
   * @memberof HTML
   */
  associateRawTexts(children) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (
        child.wrapper === 'Text' &&
        TEXT_TAGS_IGNORING_ASSOCIATION.indexOf(child.tagName) === -1 &&
        children.length > 1 &&
        (!child.parent || TEXT_TAGS_IGNORING_ASSOCIATION.indexOf(child.parent.name) === -1)
      ) {
        // Texts outside <p> or not <p> themselves (with siblings)
        const wrappedTexts = []
        for (let j = i; j < children.length; j++) {
          // Loop on its next siblings and store them in an array
          // until we encounter a block or a <p>
          const nextSibling = children[j]
          if (
            nextSibling.wrapper !== 'Text' ||
            TEXT_TAGS_IGNORING_ASSOCIATION.indexOf(nextSibling.tagName) !== -1
          ) {
            break
          }
          wrappedTexts.push(nextSibling)
          // Remove the child that has been nested
          children[j] = false
        }
        // Replace the raw text with a <p> that has wrappedTexts as its children
        if (wrappedTexts.length) {
          children[i] = {
            attribs: {},
            children: wrappedTexts,
            nodeIndex: i,
            parent: child.parent,
            parentTag: child.parentTag,
            tagName: 'textwrapper',
            wrapper: 'Text'
          }
        }
      }
    }
    return children.filter(parsedNode => parsedNode !== false && parsedNode !== undefined)
  }

  /**
   * Maps the DOM nodes parsed by htmlparser2 into a simple structure that will be easy to render with
   * native components. It removes ignored tags, chooses the right wrapper for each set of children
   * to ensure we're not wrapping views inside texts and improves the structure recursively
   * to prevent erratic rendering.
   * @param {array} DOMNodes
   * @param {boolean} [parentTag=false]
   * @returns
   * @memberof HTML
   */
  mapDOMNodesTORNElements(DOMNodes, parentTag = false, props = this.props) {
    const {
      ignoreNodesFunction,
      ignoredTags,
      alterNode,
      alterData,
      alterChildren,
      tagsStyles,
      classesStyles
    } = props
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const RNElements = DOMNodes.map((node, nodeIndex) => {
      let { children, data } = node
      if (ignoreNodesFunction && ignoreNodesFunction(node, parentTag) === true) {
        return false
      }
      if (
        ignoredTags.map(tag => tag.toLowerCase()).indexOf(node.name && node.name.toLowerCase()) !==
        -1
      ) {
        return false
      }

      if (alterNode) {
        const alteredNode = alterNode(node)
        node = alteredNode || node
      }
      const { type, attribs, name, pare
```

### Core Architecture Module: `src/components/@/react-native-render-html/src/HTMLRenderers.tsx`
```
/*
 * @Author: czy0729
 * @Date: 2019-08-14 16:28:40
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-03-29 00:40:33
 */
import React from 'react'
import { Platform, Text, TouchableOpacity, View } from 'react-native'
import HTMLImage from 'react-native-render-html/src/HTMLImage'
import { _constructStyles, _getElementClassStyles } from 'react-native-render-html/src/HTMLStyles'
import { WebView } from 'react-native-webview'
import { stl } from '@utils/utils'
import { IOS } from '@constants/env'
import { androidTextFixedStyle } from '@styles'

export function a(htmlAttribs, children, _convertedCSSStyles, passProps) {
  const style = _constructStyles({
    tagName: 'a',
    htmlAttribs,
    passProps,
    styleSet: passProps.parentWrapper === 'Text' ? 'TEXT' : 'VIEW'
  })

  // !! This deconstruction needs to happen after the styles construction since
  // the passed props might be altered by it !!
  const { parentWrapper, onLinkPress, key, data } = passProps
  const handlePress = evt =>
    onLinkPress && htmlAttribs && htmlAttribs.href
      ? onLinkPress(evt, htmlAttribs.href, htmlAttribs)
      : undefined

  if (parentWrapper === 'Text') {
    return (
      <>
        <Text
          {...passProps}
          key={key}
          style={stl(!IOS && androidTextFixedStyle, style)}
          textBreakStrategy='simple'
          numberOfLines={0}
          onPress={handlePress}
        >
          {children || data}
        </Text>
        {(!!handlePress || htmlAttribs?.class?.includes('tag')) && (
          <Text key={`${key}-padding`} textBreakStrategy='simple' numberOfLines={0}>
            {' '}
          </Text>
        )}
      </>
    )
  }

  return (
    <TouchableOpacity key={key} onPress={handlePress}>
      {children || data}
    </TouchableOpacity>
  )
}

export function img(htmlAttribs, _children, _convertedCSSStyles, passProps = {}) {
  if (!htmlAttribs.src) {
    return false
  }

  const style = _constructStyles({
    tagName: 'img',
    htmlAttribs,
    passProps,
    styleSet: 'IMAGE'
  })
  const { src, alt, width, height } = htmlAttribs
  return (
    <HTMLImage
      source={{ uri: src }}
      alt={alt}
      width={width}
      height={height}
      style={style}
      {...passProps}
    />
  )
}

export function ul(htmlAttribs, children, convertedCSSStyles, passProps: any = {}) {
  const style = _constructStyles({
    tagName: 'ul',
    htmlAttribs,
    passProps,
    styleSet: 'VIEW'
  })
  const { allowFontScaling, rawChildren, nodeIndex, key, baseFontStyle, listsPrefixesRenderers } =
    passProps
  const baseFontSize = baseFontStyle.fontSize || 14

  children =
    children &&
    children.map((child, index) => {
      const rawChild = rawChildren[index]
      let prefix = false
      const rendererArgs = [
        htmlAttribs,
        children,
        convertedCSSStyles,
        {
          ...passProps,
          index
        }
      ]

      if (rawChild) {
        if (rawChild.parentTag === 'ul' && rawChild.tagName === 'li') {
          prefix =
            listsPrefixesRenderers && listsPrefixesRenderers.ul ? (
              listsPrefixesRenderers.ul(...rendererArgs)
            ) : (
              <View
                style={{
                  marginRight: 10,
                  width: baseFontSize / 2.8,
                  height: baseFontSize / 2.8,
                  marginTop: baseFontSize / 2,
                  borderRadius: baseFontSize / 2.8,
                  backgroundColor: 'black'
                }}
              />
            )
        } else if (rawChild.parentTag === 'ol' && rawChild.tagName === 'li') {
          prefix =
            listsPrefixesRenderers && listsPrefixesRenderers.ol ? (
              listsPrefixesRenderers.ol(...rendererArgs)
            ) : (
              <Text
                allowFontScaling={allowFontScaling}
                style={stl(!IOS && androidTextFixedStyle, {
                  marginRight: 5,
                  fontSize: baseFontSize
                })}
                textBreakStrategy='simple'
                numberOfLines={0}
              >
                {index + 1})
              </Text>
            )
        }
      }
      return (
        <View
          key={`list-${nodeIndex}-${index}-${key}`}
          style={{ flexDirection: 'row', marginBottom: 10 }}
        >
          {prefix}
          <View style={{ flex: 1 }}>{child}</View>
        </View>
      )
    })
  return (
    <View style={style} key={key}>
      {children}
    </View>
  )
}
export const ol = ul

export function iframe(htmlAttribs, _children, _convertedCSSStyles, passProps) {
  const { staticContentMaxWidth, tagsStyles, classesStyles } = passProps

  const tagStyleHeight = tagsStyles.iframe && tagsStyles.iframe.height
  const tagStyleWidth = tagsStyles.iframe && tagsStyles.iframe.width

  const classStyles = _getElementClassStyles(htmlAttribs, classesStyles)
  const classStyleWidth = classStyles.width
  const classStyleHeight = classStyles.height

  const attrHeight = htmlAttribs.height ? parseInt(htmlAttribs.height) : false
  const attrWidth = htmlAttribs.width ? parseInt(htmlAttribs.width) : false

  const height = attrHeight || classStyleHeight || tagStyleHeight || 200
  const width = attrWidth || classStyleWidth || tagStyleWidth || staticContentMaxWidth

  const style = _constructStyles({
    tagName: 'iframe',
    htmlAttribs,
    passProps,
    styleSet: 'VIEW',
    additionalStyles: [{ height, width }]
  })

  const source = htmlAttribs.srcdoc ? { html: htmlAttribs.srcdoc } : { uri: htmlAttribs.src }

  return <WebView key={passProps.key} source={source} style={style} />
}

export function pre(_htlmAttribs, children, _convertedCSSStyles, passProps) {
  return (
    <Text
      key={passProps.key}
      style={stl(!IOS && androidTextFixedStyle, {
        fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo'
      })}
      textBreakStrategy='simple'
      numberOfLines={0}
    >
      {children}
    </Text>
  )
}

export function br(_htlmAttribs, _children, _convertedCSSStyles, passProps) {
  return (
    <Text
      key={passProps.key}
      allowFontScaling={passProps.allowFontScaling}
      style={stl(!IOS && androidTextFixedStyle, {
        height: 1.2 * passProps.emSize,
        flex: 1
      })}
      textBreakStrategy='simple'
      numberOfLines={0}
    >
      {'\n'}
    </Text>
  )
}

export function textwrapper(
  _htmlAttribs,
  children,
  convertedCSSStyles,
  { allowFontScaling, key, selectable }
) {
  return (
    <Text
      key={key}
      selectable={selectable}
      allowFontScaling={allowFontScaling}
      style={stl(!IOS && androidTextFixedStyle, convertedCSSStyles)}
      textBreakStrategy='simple'
      numberOfLines={0}
    >
      {children}
    </Text>
  )
}

```

### Core Architecture Module: `src/components/@/react-native-render-html/src/utils.ts`
```
/*
 * @Author: czy0729
 * @Date: 2023-04-20 11:12:28
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-09-01 03:00:01
 */
import { syncSpacing } from '@utils/async'

import type { ReactElement } from 'react'
import type { TextStyle } from 'react-native'

/** 递归的文本子节点结构 */
type SpacingChild = ReactElement | string | number | boolean | null | undefined | SpacingChild[]

/** 避免字号和行号一样导致显示挤压 */
export function optimizeComputeTextStyles(styles: TextStyle) {
  if (styles?.fontSize && styles?.lineHeight && styles.fontSize >= styles.lineHeight) {
    styles.lineHeight = Math.floor(styles.fontSize * 1.5)
  }
  return styles
}

/** 文字递归盘古文案排版转换 */
export function formatSpacing(
  children: SpacingChild | SpacingChild[]
): SpacingChild | SpacingChild[] {
  if (typeof children === 'string') return syncSpacing(children)

  if (Array.isArray(children)) return children.map(formatSpacing)

  return children
}

```

### Core Architecture Module: `src/components/accordion/hooks.ts`
```
/*
 * @Author: czy0729
 * @Date: 2026-08-17 10:00:00
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-09-10 12:00:00
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from '@utils'
import {
  getExpandTarget,
  getHiddenTranslateY,
  getMeasuredHeight,
  INITIAL_HIDDEN_TRANSLATE_Y,
  shouldUpdateHeight
} from './utils'
import { DURATION } from './ds'

import type { LayoutChangeEvent } from 'react-native'
import type { AccordionAnimationOptions } from './types'

/** 首屏展开态 (共享值初值, 仅首帧使用, 提到模块级避免每次渲染重复构建) */
const INITIAL_EXPANDED = getExpandTarget(true, INITIAL_HIDDEN_TRANSLATE_Y)

/** 首屏收起态 (高度未知, 用兜底位移) */
const INITIAL_HIDDEN = getExpandTarget(false, INITIAL_HIDDEN_TRANSLATE_Y)

/**
 * 折叠/展开进出场动画 hook
 *
 * 展开/收起均为淡入淡出 + 位移 + 缩放, 动画对称;
 * 收起完成通过 scheduleOnRN 桥接 setShow 与 onAnimationEnd 到 JS 线程
 */
export const useAccordionAnimation = ({
  expand,
  lazy = true,
  onAnimationEnd,
  bottom
}: AccordionAnimationOptions) => {
  const [show, setShow] = useState(lazy ? expand : true)

  const heightRef = useRef(0)
  const unmountedRef = useRef(false)
  const expandRef = useRef(expand)

  /** 挂载首轮不回调 onAnimationEnd: 那轮动画没有用户可见过程 */
  const firstRunRef = useRef(true)

  /**
   * 用 ref 持有最新回调, 让下面的动画 effect 不随父组件重渲染而重跑
   * - 否则每次重渲染都会以完整时长从当前位置重播动画, 且结束时重复回调
   * - 写法对齐 useRefreshState
   */
  const onAnimationEndRef = useRef(onAnimationEnd)
  onAnimationEndRef.current = onAnimationEnd

  const initial = expand ? INITIAL_EXPANDED : INITIAL_HIDDEN
  const translateY = useSharedValue(initial.translateY)
  const scale = useSharedValue(initial.scale)
  const opacity = useSharedValue(initial.opacity)

  /** 稳定函数引用, 供动画 worklet 通过 scheduleOnRN 回调 */
  const handleAnimationEnd = useCallback(() => {
    if (unmountedRef.current) return
    onAnimationEndRef.current?.()
  }, [])

  /** 收起完成: 仅在仍处于收起态时销毁子内容, 避免展开竞态误销毁 */
  const finishHide = useCallback(() => {
    if (unmountedRef.current || expandRef.current) return
    setShow(false)
  }, [])

  const handleLayout = useCallback((evt: LayoutChangeEvent) => {
    // 防御: 非法布局数据直接丢弃, 避免 NaN 被当成高度写入并流向 withTiming
    const raw = evt?.nativeEvent?.layout?.height
    if (!Number.isFinite(raw)) return

    const newHeight = getMeasuredHeight(raw)
    if (!shouldUpdateHeight(heightRef.current, newHeight)) return // 忽略微小抖动

    heightRef.current = newHeight
  }, [])

  useEffect(() => {
    const target = getExpandTarget(expand, getHiddenTranslateY(heightRef.current, bottom))
    expandRef.current = expand
    if (expand) setShow(true)

    const isFirstRun = firstRunRef.current
    firstRunRef.current = false

    translateY.value = withTiming(target.translateY, { duration: DURATION }, finished => {
      if (!finished) return
      if (!expand && lazy) scheduleOnRN(finishHide)
      if (!isFirstRun) scheduleOnRN(handleAnimationEnd)
    })
    scale.value = withTiming(target.scale, { duration: DURATION })
    opacity.value = withTiming(target.opacity, { duration: DURATION })
  }, [expand, lazy, bottom, finishHide, handleAnimationEnd, translateY, scale, opacity])

  useEffect(() => {
    // 挂载时复位: 否则卸载清理跑过一次后标志位永久为 true, 收起不销毁子内容且回调不触发
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  /** 只保留逐帧变化的属性, 静态属性 (如 overflow) 交给组件层的静态样式 */
  const animatedStyles = useAnimatedStyle(
    () =>
      ({
        transform: [{ translateY: translateY.value }, { scale: scale.value }],
        opacity: opacity.value
      } as const),
    []
  )

  return {
    /** 是否渲染子内容（展开态为 true） */
    show,

    /** 内容容器的进出场动画样式 */
    animatedStyles,

    /** 内容布局回调，测量高度 */
    handleLayout
  }
}

```

### Core Architecture Module: `src/components/accordion/utils.ts`
```
/*
 * @Author: czy0729
 * @Date: 2026-08-17 10:00:00
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-09-10 12:00:00
 */
import { MIN_HEIGHT } from './ds'

/** 隐藏态缩放, 与展开态 1 对称 */
export const HIDDEN_SCALE = 0.9

/** 首屏展开前隐藏态的位移兜底值 (高度未知, 取足够大的值) */
export const INITIAL_HIDDEN_TRANSLATE_Y = 1000

/**
 * 高度测量值收敛
 * - 下限收敛到 MIN_HEIGHT
 * - 非有限值 (NaN / Infinity / undefined) 兜底为 MIN_HEIGHT, 明确契约避免非法值流向动画
 */
export function getMeasuredHeight(height: number): number {
  return Number.isFinite(height) ? Math.max(height, MIN_HEIGHT) : MIN_HEIGHT
}

/** 微小抖动 (< 1px) 是否忽略 */
export function shouldUpdateHeight(prev: number, next: number): boolean {
  return Math.abs(prev - next) >= 1
}

/**
 * 收起时向下位移 = 自身高度 + 底部安全区
 * 非有限值按 0 处理: 位移会直接进入 withTiming, NaN 写到原生视图的 transform 上是崩溃级隐患
 */
export function getHiddenTranslateY(height: number, bottom: number): number {
  const h = Number.isFinite(height) ? Math.max(height, 0) : 0
  const b = Number.isFinite(bottom) ? Math.max(bottom, 0) : 0
  return h + b
}

/** 对称进出场目标值, 展开/收起动画共用同一来源 */
export function getExpandTarget(expand: boolean, hiddenTranslateY: number) {
  return {
    translateY: expand ? 0 : hiddenTranslateY,
    scale: expand ? 1 : HIDDEN_SCALE,
    opacity: expand ? 1 : 0
  } as const
}

```

### Core Architecture Module: `src/components/action-sheet/hooks.ts`
```
/*
 * @Author: czy0729
 * @Date: 2026-08-12 06:40:00
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-09-10 12:00:00
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { NavigationContext } from '@react-navigation/native'
import { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { _ } from '@stores'
import { scheduleOnRN } from '@utils'
import { useBackHandler } from '@utils/hooks'

/** 动画时长 (ms) */
const DURATION = 240

/** 动作面板显示/收起动画状态 */
export const useActionSheet = (
  show: boolean,
  onClose?: () => void,
  height = 480,

  /** 面板背景色, 收进 animated style 由 Reanimated 管理, 避免动画中 re-render 时静态背景被丢帧 */
  contentBg?: string
) => {
  const progress = useSharedValue(show ? 1 : 0)
  const [showValue, setShow] = useState(show)
  const closingRef = useRef(false)

  const navigation = useContext(NavigationContext)

  const calcHeight = Math.min(
    Math.floor(height * _.device(1, 1.4)) || Math.floor(_.window.height * 0.5),
    Math.floor(_.window.height * _.web(0.92, 0.88))
  )

  const animateTo = useCallback((toValue: number, callback?: () => void) => {
    progress.value = withTiming(
      toValue,
      {
        duration: DURATION
      },
      finished => {
        if (finished && callback) scheduleOnRN(callback)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleShow = useCallback(() => {
    // 收起动画进行中又要展开: 中断收起并回到展开态
    // (withTiming 被打断后 finished 为 false, 收起完成回调不会执行, 因此不会误调 onClose 也不会闪一下再展开)
    if (closingRef.current) {
      closingRef.current = false
      animateTo(1)
      return
    }

    if (showValue) return

    // 仅当残留展开态 (收起归零动画被丢弃, progress 停在 ≈1) 时才归零;
    // 无条件归零会在 showValue 更新前的二次触发/竞态下把进行中的动画拽回 0 重播
    if (progress.value > 0.99) progress.value = 0

    setShow(true)
    requestAnimationFrame(() => animateTo(1))
  }, [animateTo, progress, showValue])

  const handleClose = useCallback(() => {
    if (!showValue || closingRef.current) return

    closingRef.current = true
    animateTo(0, () => {
      // 收起途中被重新展开 (handleShow 已清掉标志) 时不再执行收起收尾, 避免刚展开又被卸载并误调 onClose
      if (!closingRef.current) return

      closingRef.current = false
      setShow(false)
      onClose?.()
    })
  }, [animateTo, onClose, showValue])

  useEffect(() => {
    if (show) {
      handleShow()
      return
    }

    handleClose()
  }, [show, handleShow, handleClose])

  /**
   * 用 ref 持有最新返回键逻辑, 交给 useBackHandler 一个稳定引用
   * - useBackHandler 依赖 handler 身份决定是否重订阅, 内联箭头会让每次渲染都先 remove 再 add
   * - RN 的 BackHandler 是「最后注册的最先调用」, 重订阅会让本面板插队抢在其他浮层之前
   */
  const backHandlerRef = useRef<() => boolean>(() => false)
  backHandlerRef.current = () => {
    // Android 的 hardwareBackPress 是全局广播, 被覆盖屏也会收到,
    // 只在所属 screen 聚焦时响应, 避免在新页面按返回时误关本页面板
    if (!showValue || !navigation?.isFocused()) return false

    // 收起动画进行中不吞返回键, 放行让页面正常返回
    if (closingRef.current) return false

    handleClose()
    return true
  }
  const handleBack = useCallback(() => backHandlerRef.current(), [])

  useBackHandler(handleBack)

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [calcHeight, 0])
      }
    ],
    backgroundColor: contentBg
  }))

  const maskStyle = useAnimatedStyle(() => ({
    opacity: progress.value
  }))

  return {
    /** 是否处于展示态 */
    showValue,

    /** 关闭并处理收起动画 */
    handleClose,

    /** 计算内容高度（用于进出场位移） */
    calcHeight,

    /** 内容容器进出场动画样式 */
    contentStyle,

    /** 遮罩进出场动画样式 */
    maskStyle
  }
}

```

### Core Architecture Module: `src/components/action-sheet/utils.ts`
```
/*
 * @Author: czy0729
 * @Date: 2026-08-12 07:00:00
 * @Last Modified by:   czy0729
 * @Last Modified time: 2026-08-12 07:00:00
 */
/** 下拉时是否显示"松手收起"提示: 从顶部开始且向下拖超过阈值 */
export function shouldShowDragHint(dragStartY: number, dragDistance: number, threshold: number): boolean {
  return dragStartY <= 0 && dragDistance < 0 && -dragDistance > threshold
}

/** 结束拖动时是否触发收起: 仍处于顶部且下拉超过阈值 */
export function shouldCloseOnDragEnd(scrollY: number, dragDistance: number, threshold: number): boolean {
  return scrollY <= 0 && dragDistance < -threshold
}

```

### Core Architecture Module: `src/components/avatar/hooks.ts`
```
/*
 * @Author: czy0729
 * @Date: 2023-12-11 15:45:32
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-08-18 11:00:00
 */
import { useCallback, useState } from 'react'
import { systemStore, tinygrailStore } from '@stores'
import { navigationReference } from '@utils'
import { cacheManager } from '@utils/cache'
import { useMount } from '@utils/hooks'
import { API_V0 } from '@constants'
import { getOnPress, head } from './utils'

import type { ImageSourcePropType } from 'react-native'
import type { Props } from './types'

/**
 * 部分头像地址使用了官方用户头像 API，而 API 是直接跳转后返回图片。
 * 这样部分平台下很难缓存，而且可能会导致大量慢请求，阻塞整个 APP。
 * 所以使用了一些逻辑来消化 API 得到跳转后的具体地址，然后再正常渲染图片。
 */
export function useAvatar(src: Props['src'], userId: Props['userId']) {
  const key = `avatar|${userId}`

  const [url, setUrl] = useState(() => {
    let initUrl: string | ImageSourcePropType
    if (typeof src === 'string' && src.includes(API_V0)) {
      initUrl = cacheManager.get(key) || src
    } else {
      initUrl = src
    }
    if (typeof src === 'string' && src.indexOf('//') === 0) initUrl = `https:${initUrl}`

    return initUrl
  })
  const isFromApi = typeof url === 'string' && url.includes(API_V0)

  useMount(() => {
    if (!isFromApi) return

    if (cacheManager.has(key)) {
      setUrl(cacheManager.get(key))
      return
    }

    setTimeout(() => {
      ;(async () => {
        let responseURL = await head(url)
        if (typeof responseURL !== 'string') responseURL = url

        setUrl(cacheManager.set(key, responseURL))
      })()
    }, 0)
  })

  return url
}

/**
 * 头像点击逻辑
 * 没有 onPress 且无法跳转到用户空间时, canPress 为 false
 */
export function useAvatarPress({
  onPress,
  navigation,
  userId,
  event,
  src,
  name,
  params
}: Pick<Props, 'onPress' | 'navigation' | 'userId' | 'event' | 'name' | 'params'> & {
  src?: Props['src']
}) {
  const navigationRef = navigation || navigationReference()
  const canPress = !!onPress || (!!navigationRef && !!userId)

  const handlePress = useCallback(() => {
    getOnPress(onPress, {
      navigation,
      userId,
      event,
      src,
      name,
      params: params as Record<string, unknown>
    })?.()
  }, [onPress, navigation, userId, event, src, name, params])

  return {
    canPress,
    handlePress
  }
}

/**
 * 头像长按逻辑
 * 无 onLongPress 且未开启 tinygrail 资产提醒时返回 undefined
 */
export function useAvatarLongPress(
  onLongPress: Props['onLongPress'],
  userId: Props['userId'],
  name: Props['name']
) {
  const canLongPress =
    !!onLongPress ||
    (!!userId && systemStore.setting.tinygrail && systemStore.setting.avatarAlertTinygrailAssets)

  const handleLongPress = useCallback(() => {
    if (userId && systemStore.setting.tinygrail && systemStore.setting.avatarAlertTinygrailAssets) {
      tinygrailStore.alertUserAssets(userId, name)
    }
  }, [userId, name])

  return onLongPress || (canLongPress ? handleLongPress : undefined)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #415** (2026-09-14): **下沉逻辑修改**
  *Symptoms*:  版本号：8.39.4 目前选了“app排序”和“条目自动下沉”，可以看到10月未播番剧排在9月在播番剧之上，个人认为不太符合逻辑，希望未播番剧下沉到在播番剧下面 ![Screenshot_2026-09-11-07-36-39-215_com.czy0729.bangumi.jpg](https://github.com/user-attachments/assets/7d3891f3-5299-48dc-8647-220a3fb0c4fa)  
  **Post-Mortem & Fix Analysis**:
  > 我思考了一下，现在还是2026夏，2026秋的番还没开始放送，是10月1日（前后几日）后，如果是这样，可以下沉到2026年整个大分组的最下方，这样也不会完全找不到新番

- **Issue #414** (2026-09-05): **新版8.39.2的bug**
  *Symptoms*: 点好友评分的那里会稳定触发致命错误 ![Screenshot_20260905_221338.jpg](https://github.com/user-attachments/assets/eca531df-b14c-427f-982c-189c3d506740)  ![Screenshot_20260905_221901.jpg](https://github.com/user-attachments/assets/29509799-0a48-45b5-a770-c358d2253a72)  

- **Issue #413** (2026-09-01): **已收录至Awesome Zhuiju Free追剧资源指南**
  *Symptoms*: **GitHub仓库**：https://github.com/laoma2053/awesome-zhuiju-free  - 免费无广告的追剧资源指南，人工精选资源、每天检测资源有效性。  - 收录在线影视、影视APP、网盘搜索、磁力BT、字幕、TVBox / 影视仓空壳软件/配置地址、IPTV直播源、会员拼团、影视相关开源项目。  - 开源，社区共同维护。  <img width="1153" height="879" alt="Image" src="https://github.com/user-attachments/assets/446ed3ce-4abb-4e3d-bea8-f3e371667fc4" />

- **Issue #412** (2026-08-27): **feat: 将 unsigned IPA workflow 升级到 Expo 54**
  *Symptoms*: ## 背景  当前 `packages/ipa` 仍是 Expo 52 / React Native 0.76。8.39.0 引入 `react-native-worklets` 后，IPA 只能回退到 Reanimated，无法使用主分支已经采用的 Expo 54 原生依赖。  主分支根依赖本身已经是 Expo 54 / RN 0.81，所以这里直接让 IPA 构建复用主 iOS 依赖并重新 prebuild，避免再维护一个 Expo 53 中间环境。  ## 修改  - 不再执行 `node packages/env.js ipa` - 使用根部 Expo 54 依赖和 `packages/ios/patches` - 每次构建运行 `expo prebuild --platform ios --clean` - 开启 RN 新架构并链接 RNWorklets - 将 `@react-native-community/blur` 临时升级至 4.4.1，修复旧 Podspec 锁定 RCT-Folly - 保留原 Info.plist 的 ATS、方向、深浅色、推送 entitlement，以及 AppDelegate 图片磁盘缓存 - iOS Worklets 入口恢复为原生 `react-native-worklets` - workflow 增加 Expo 54 / RN 0.81 / 新架构 / RNWorklets 校验  ## 验证  在 Xcode 27 + Node 20.20.2 下完成 clean prebuild、Pod install 和 unsigned Release 全量构建。  最终 IPA：  - Expo 54.0.22 - React Native 0.81.4 - Reanimated 4.1.2 - RNWorklets 0.5.1 - New Architecture enabled - `CFBundleShortVersionString = 8.39.0` - `unzip -t` 通过 - `codesign` 确认为未签名  测试 IPA（不会覆盖旧 Expo 52 资产）： https://github.com/AvalonUltra/Bangumi/releases/download/upstream-8.39.0/Bangumi-8.39.0-expo54-unsigned.ipa  SHA-256： `3026acd9b7ca9abc1e0c6c15bd6c34c33bbd879f46f13e98d9d53892e5794ba6`
  **Post-Mortem & Fix Analysis**:
  > 有点问题，再修一修
  > 我晕了，手机上面被强制升到 expo@57 了😭，其实这东西不难升，难是难在 react-native-reanimated 上面
  > > 我晕了，手机上面被强制升到 expo@57 了😭，其实这东西不难升，难是难在 react-native-reanimated 上面  其实主要是升级收益不是很大，所以之前一直没高兴升级，这一版有个主题跟随系统没适配好所以关了，现在应该是搞定了，马上再提个pr

- **Issue #411** (2026-08-27): **fix: 修复 IPA workflow 的 worklets 打包失败**
  *Symptoms*: ## 问题  8.39.0 之后，IPA workflow 在 `Build Release app` 阶段打包 Metro bundle 时失败：  ```text Unable to resolve module react-native-worklets from src/utils/worklets/index.ts ```  `packages/ipa` 仍使用 Expo 52 / Reanimated 3，未安装 `react-native-worklets`。虽然 IPA 运行时会走 Reanimated fallback，但 Metro 会静态解析条件分支里的 `require('react-native-worklets')`，因此构建提前失败。  ## 修改  在 IPA Prepare 阶段将 `scheduleOnRN` 和 `scheduleOnUI` 的 worklets 引用替换为现有 Reanimated fallback，只影响下载到 runner 的 IPA 构建源码，不改应用源码或其他平台。  ## 验证  - YAML 解析及 Node 脚本语法检查通过 - 本地 `expo export --platform ios` 成功，7163 modules 完成 bundle - fork 的 8.39.0 unsigned IPA workflow 完整通过，包括依赖、Pods、xcodebuild、IPA 校验与 Release 上传 - 成功 run：https://github.com/AvalonUltra/Bangumi/actions/runs/33000129695 - 产物：https://github.com/AvalonUltra/Bangumi/releases/tag/upstream-8.39.0
  **Post-Mortem & Fix Analysis**:
  > 感觉我上一个提交等于白写了，虽然我也就是试试行不行，打包出错其实我也没管他。 看来还是得花时间去处理掉 IPA 环境升到 Expo@53 的问题。

- **Issue #409** (2026-08-25): **有适配纯血鸿蒙计划吗**
  *Symptoms*: 希望能够适配纯血鸿蒙
  **Post-Mortem & Fix Analysis**:
  > 且不说你站，个人做鸿蒙基本都不太可能 而且你站什么性质还没弄清楚吗，还能活着就已经很好了╮(╯▽╰)╭
  > > 且不说你站，个人做鸿蒙基本都不太可能 而且你站什么性质还没弄清楚吗，还能活着就已经很好了╮(╯▽╰)╭  鸿蒙有侧载方案

- **Issue #408** (2026-08-22): **镜像站bangumi.pro无法在App中使用**
  *Symptoms*: bangumi.pro是之前bangumi.lol被gfw识别后新换的镜像站，加入了cf识别。经测试无法在App中访问，但可在Chrome中通过cf识别。  <img width="1440" height="3168" alt="Image" src="https://github.com/user-attachments/assets/74d9bda1-442e-4e8c-8fca-e5989e355585" />
  **Post-Mortem & Fix Analysis**:
  > 无法处理，能处理就不叫cf了。 可以尝试使用ECH。

- **Issue #406** (2026-08-27): **[Bug] 动态表情栏无法划到底**
  *Symptoms*: ## 环境版本  - 系统版本：MagicOS 10.0.0.170 - 应用版本：8.38.2  ## 问题描述  动态表情栏超出屏幕范围时无法划到底，会差一点点没有显示完全。  ## 视频示例  https://github.com/user-attachments/assets/da439c95-b77a-49b2-8f3b-1b4c4711bc2e 

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

### Incident Patch 1: `706ae6f8` (2026-10-01)
**Commit Message**: - fixed bugs

**File**: `.github/workflows/build-ipa.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
   build:
     name: Build unsigned IPA
     # 已停用: 需要打包时删掉这一行 (并补回 push 触发器)
-    if: false
+    if: true
     runs-on: macos-26
     timeout-minutes: 180
 
```

**File**: `app.json` (modified, +3/-3)
```diff
@@ -1,9 +1,9 @@
 {
   "expo": {
     "description": "A React Native App for https://bgm.tv, tinygrail plugin 260101",
-    "version": "8.41.0",
+    "version": "8.41.1",
     "android": {
-      "versionCode": 904100,
+      "versionCode": 904110,
       "package": "com.czy0729.bangumi",
       "adaptiveIcon": {
         "foregroundImage": "./src/assets/images/foreground.png",
@@ -87,4 +87,4 @@
     "githubUrl": "https://github.com/czy0729/Bangumi",
     "runtimeVersion": "1.0.0"
   }
-}
+}
\ No newline at end of file
```

**File**: `ios/Bangumi/Info.plist` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
 	<key>CFBundlePackageType</key>
 	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
 	<key>CFBundleShortVersionString</key>
-	<string>8.41.0</string>
+	<string>8.41.1</string>
 	<key>CFBundleSignature</key>
 	<string>????</string>
 	<key>CFBundleURLTypes</key>
```

**File**: `src/screens/user/setting/component/cdn/index.tsx` (modified, +3/-3)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2022-01-19 10:32:18
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-09-23 12:00:00
+ * @Last Modified time: 2026-10-02 01:17:48
  */
 import { observer } from 'mobx-react'
 import { ActionSheet } from '@components'
@@ -52,8 +52,8 @@ function CDN({ filter }: WithFilterProps) {
         {shows.avatarRound && <AvatarRound filter={filter} />}
         {!WEB && (
           <>
-            shows.cover && <CDNCover filter={filter} setFalse={setFalse} />
-            shows.test && <CDNTest filter={filter} />
+            {shows.cover && <CDNCover filter={filter} setFalse={setFalse} />}
+            {shows.test && <CDNTest filter={filter} />}
           </>
         )}
         {shows.imageSkeleton && <ImageSkeleton filter={filter} />}
```

---

### Incident Patch 2: `0e9b3886` (2026-09-25)
**Commit Message**: - [自定义源头] 页面类型收敛与 UI 优化

**File**: `.claude/docs/code-style.md` (modified, +53/-1)
```diff
@@ -74,8 +74,60 @@
   }, [])
   ```
 
-# 模块级缓存规范
+- **页面底色是 `colorPlain`（浅色为纯白），不是 `colorBg`**：`Page` 在 iOS 用 `_.container.plain`，浅色页面即白底。因此浅色下卡内分隔靠「描边 + 白底」，不要在白底上挖 `colorBg` 大灰井或叠白卡片 + 阴影（两者都不可见）；暗色相反，靠「level1 卡片 + `colorBg` 深井」分层，阴影无效可省略
+- **覆盖组件默认样式必须用同名具体键，不要用简写**：RN 样式数组按下标合并，`padding` 简写与组件内部的 `paddingHorizontal` / `paddingVertical` 是不同 key，且 Yoga 中具体边优先于简写——`padding: 0` 压不住自带的 `paddingHorizontal: _.wind`。要覆盖就写同名键（如 `paddingHorizontal: 0`）
+- **样式对象内属性按「布局 → 尺寸 → 间距 → 文字 → 填充 → 修饰」从上到下书写**，即先写决定盒子如何被放置与占位的属性，再写内容（文字），然后是容器的视觉填充，最后写裁切阴影等修饰，一组内固定先后：
+
+  1. 布局参与：`flex` / `alignItems` / `justifyContent`
+  2. 定位：`position` → `zIndex` → `top` / `right` / `bottom` / `left`（偏移仅 absolute 时出现，紧跟定位）
+  3. 尺寸：`width` → `height`
+  4. 间距：`padding`（全 → 轴向 → 单边）→ `margin`（全 → 轴向 → 单边）
+  5. 文字排版：`fontFamily` → `fontSize` → `lineHeight` → `color` → `textAlign`（内容在前，容器 paint 在后）
+  6. 背景：`backgroundColor`
+  7. 边框与圆角：`borderWidth` → `borderColor` → `borderStyle` → `borderRadius`
+  8. 修饰收尾：`overflow` → `transform` → `..._.shadow`
 
+  ```typescript
+  export const memoStyles = _.memoStyles(() => ({
+    dot: {
+      position: 'absolute',   // 定位
+      zIndex: 1,
+      top: 6,
+      right: 6,
+      width: 6,               // 尺寸
+      height: 6,
+      backgroundColor: _.colorSuccess,  // 填充
+      borderRadius: 6,        // 圆角
+      overflow: 'hidden'      // 修饰收尾
+    },
+    form: {
+      paddingVertical: 16,    // 间距: 先 padding 后 margin
+      paddingRight: 8,
+      paddingLeft: 16,
+      marginBottom: _.sm,
+      backgroundColor: _.colorBg,
+      borderWidth: 1,
+      borderColor: _.colorBorder,
+      borderRadius: _.radiusSm,
+      overflow: 'hidden'
+    },
+    input: {
+      width: '100%',          // 尺寸
+      paddingVertical: 8,     // 间距
+      paddingHorizontal: 12,
+      fontFamily: _.fontBoldFamily,  // 文字在背景前
+      color: _.colorDesc,
+      ..._.fontSize14,
+      backgroundColor: _.select(_.colorPlain, _._colorDarkModeLevel2),  // 背景
+      borderWidth: _.select(1, 0),
+      borderColor: _.colorBorder,
+      borderRadius: _.radiusXs,
+      overflow: 'hidden'
+    }
+  }))
+  ```
+
+# 模块级缓存规范
 - **Map / Set 缓存需要上限时，统一使用 `@utils/cache` 的 `ensureCacheLimit(cache, maxSize)`**，在每次 `set` / `add` 之后调用即可（FIFO 淘汰最早条目，单次只淘汰 1 条）；禁止自建「超过上限就删除」的私有工具函数或 LRU 类
 - **数组缓存需要上限时，统一使用 `@utils/cache` 的 `ensureArrayLimit(list, maxLength)`**，原地 `splice` 从尾部裁剪并返回同一引用；MobX observable 数组需在 `runInAction` 内调用
 - decode / 映射 / 去重等纯函数级缓存优先做成「模块级 Map + `ensureCacheLimit`」，缓存 key 要包含会影响结果的全部输入（如屏蔽词列表需加入内容指纹，修改后缓存自动失效）
```

**File**: `.claude/docs/screen.md` (modified, +21/-0)
```diff
@@ -35,6 +35,8 @@ screen-name/
 
 ## types.ts
 
+页面内跨文件复用的类型（数据模型、定位参数、编辑表单项等）统一放页面 `types.ts`，store 与组件从各自目录 `import type` 引用，不要内联在 `store/action.ts` 等使用处。
+
 ```ts
 import { GetRouteParams, WithNavigation } from '@types'
 import Store from './store'
@@ -166,6 +168,25 @@ export type Props = Pick<ListProps, 'title'> & {
 }
 ```
 
+上级没有独立 Props 类型时，最常见的场景是**接收上级展平的数据模型条目**（List 里 `{...item}` 透传），此时从共享数据模型 `Omit` / `Pick` 派生，不手写一份字段相同的镜像类型；回调签名优先复用组件库已有的 prop 类型：
+
+```ts
+// item/types.ts —— 上级 List 直接展开 OriginItem 条目
+import type { InputProps } from '@components'
+import type { Keys, OriginItem } from '../../types'
+
+export type Props = Omit<OriginItem, 'desc'> & {
+  /** 源头类型 */
+  type?: Keys
+
+  /** 输入框聚焦时滚动到可视区 */
+  onScrollIntoViewIfNeeded?: InputProps['onScrollIntoViewIfNeeded']
+}
+```
+
+- 数据模型缺失实际数据携带的字段时（如 `iconSquare`），把字段补进数据模型，而不是在子组件 Props 里凭空手写
+- 上级自身没有可 Pick 的类型（页面无 props、上级 Props 只有一个回调字段）时，才按第 2 条手写
+
 ### 2. 不能 Pick 则保留手写，key 必须有字段注释
 
 父级为可选字段 / 子级要求必传、或子级接收展平标量等无法 Pick 时，保留手写类型；每个自写 key 都要有 `/** */` 字段注释。**不要**写「为何不 Pick」之类的类型级说明注释：
```

**File**: `src/screens/timeline/v2/store/action.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,6 @@
  * @Last Modified by: czy0729
  * @Last Modified time: 2026-06-27 00:00:00
  */
-import type { ScrollToIndex } from '@components'
 import { timelineStore, uiStore } from '@stores'
 import { feedback, updateVisibleBottom } from '@utils'
 import { logger } from '@utils/dev'
@@ -14,6 +13,7 @@ import { TABS } from '../ds'
 import Fetch from './fetch'
 import { HIDDEN_DAYS, NAMESPACE } from './ds'
 
+import type { ScrollToIndex } from '@components'
 import type { TimeLineScope, UserId } from '@types'
 
 export default class Action extends Fetch {
```

**File**: `src/screens/user/origin-setting/component/cloud/index.tsx` (modified, +15/-5)
```diff
@@ -4,7 +4,6 @@
  * @Last Modified by: czy0729
  * @Last Modified time: 2026-03-23 19:36:56
  */
-import React from 'react'
 import { observer } from 'mobx-react'
 import { Divider, SwitchPro } from '@components'
 import { ItemSetting, ItemSettingBlock } from '@_'
@@ -16,11 +15,15 @@ import i18n from '@constants/i18n'
 import { getYuqueThumbs } from '../../utils'
 import { useCloud } from './hooks'
 import { COMPONENT } from './ds'
-import { styles } from './styles'
+import { memoStyles } from './styles'
 
-function Cloud({ isLogin, active, onToggle, onDownloaded }) {
+import type { Props } from './types'
+
+function Cloud({ isLogin, active, onToggle, onDownloaded }: Props) {
   r(COMPONENT)
 
+  const styles = memoStyles()
+
   const text = useCloud()
 
   const { focusOrigin, showLegalSource } = systemStore.setting
@@ -107,7 +110,7 @@ function Cloud({ isLogin, active, onToggle, onDownloaded }) {
         ])}
       />
 
-      {/** 显示正版播放源 */}
+      {/* 显示正版播放源 */}
       <ItemSetting
         style={styles.item}
         contentStyle={styles.content}
@@ -134,7 +137,14 @@ function Cloud({ isLogin, active, onToggle, onDownloaded }) {
         style={styles.item}
         contentStyle={styles.content}
         hd='显示所有项'
-        ft={<SwitchPro key={active} style={styles.switch} value={active} onSyncPress={onToggle} />}
+        ft={
+          <SwitchPro
+            key={String(active)}
+            style={styles.switch}
+            value={active}
+            onSyncPress={onToggle}
+          />
+        }
       />
       <Divider />
     </>
```

**File**: `src/screens/user/origin-setting/component/cloud/styles.ts` (modified, +8/-5)
```diff
@@ -2,14 +2,17 @@
  * @Author: czy0729
  * @Date: 2022-08-19 07:15:39
  * @Last Modified by: czy0729
- * @Last Modified time: 2024-01-12 16:06:22
+ * @Last Modified time: 2024-01-12 16:06:24
  */
 import { _ } from '@stores'
 
-export const styles = _.create({
+export const memoStyles = _.memoStyles(() => ({
   container: {
-    paddingHorizontal: 0,
-    marginBottom: _.md
+    paddingHorizontal: _.select(0, _.md),
+    paddingVertical: _.select(0, _.md),
+    marginBottom: _.md,
+    backgroundColor: _.select('transparent', _.colorDarkModeLevel1),
+    borderRadius: _.radiusMd
   },
   item: {
     paddingLeft: 0
@@ -25,4 +28,4 @@ export const styles = _.create({
       }
     ]
   }
-})
+}))
```

**File**: `src/screens/user/origin-setting/component/cloud/types.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+/*
+ * @Author: czy0729
+ * @Date: 2026-09-25 20:30:00
+ * @Last Modified by: czy0729
+ * @Last Modified time: 2026-09-25 20:30:00
+ */
+export type Props = {
+  /** 是否已登录 */
+  isLogin: boolean
+
+  /** 是否显示所有项 */
+  active: boolean
+
+  /** 切换显示所有项 */
+  onToggle: () => void
+
+  /** 云端下载成功后回调, 重新初始化页面数据 */
+  onDownloaded: () => void
+}
```

**File**: `src/screens/user/origin-setting/component/create/index.tsx` (modified, +21/-24)
```diff
@@ -4,54 +4,51 @@
  * @Last Modified by: czy0729
  * @Last Modified time: 2026-03-23 19:39:56
  */
-import React from 'react'
+import { View } from 'react-native'
 import { observer } from 'mobx-react'
-import { Button, Text } from '@components'
+import { Flex, Iconfont, Text, Touchable } from '@components'
 import { _, useStore } from '@stores'
 import Form from '../form'
 import { COMPONENT } from './ds'
-import { styles } from './styles'
+import { memoStyles } from './styles'
 
 import type { Ctx } from '../../types'
+import type { Props } from './types'
 
-function Create({ type, name, onScrollIntoViewIfNeeded }) {
+function Create({ type, name, onScrollIntoViewIfNeeded }: Props) {
   const { $ } = useStore<Ctx>(COMPONENT)
 
+  const styles = memoStyles()
+
   const { edit } = $.state
   const isCreate = edit.type === type && edit.item.id === '' && edit.item.uuid === ''
   if (isCreate) {
     return (
-      <>
-        <Text style={_.mt.md} size={15} bold>
+      <View style={styles.form}>
+        <Text size={15} bold>
           添加{name}源头
         </Text>
         <Form
-          style={_.mt.md}
+          style={_.mt.sm}
           name={edit.item.name}
           url={edit.item.url}
           onScrollIntoViewIfNeeded={onScrollIntoViewIfNeeded}
         />
-      </>
+      </View>
     )
   }
 
   return (
-    <Button
-      style={styles.btn}
-      type={_.select('ghostPlain', 'plain')}
-      onPress={() =>
-        $.openEdit(type, {
-          id: '',
-          uuid: '',
-          name: '',
-          url: '',
-          sort: 0,
-          active: 1
-        })
-      }
-    >
-      添加{name}源头
-    </Button>
+    <View style={styles.container}>
+      <Touchable style={styles.btn} onPress={() => $.openCreate(type)}>
+        <Flex style={styles.inner} direction='column' justify='center'>
+          <Iconfont name='md-add' size={20} color={_.colorSub} />
+          <Text style={_.mt.xs} type='sub' size={11} bold>
+            添加源头
+          </Text>
+        </Flex>
+      </Touchable>
+    </View>
   )
 }
 
```

**File**: `src/screens/user/origin-setting/component/create/styles.ts` (modified, +22/-4)
```diff
@@ -1,13 +1,31 @@
 /*
  * @Author: czy0729
  * @Date: 2022-08-19 07:25:26
- * @Last Modified by:   czy0729
+ * @Last Modified by: czy0729
  * @Last Modified time: 2022-08-19 07:25:26
  */
 import { _ } from '@stores'
 
-export const styles = _.create({
+export const memoStyles = _.memoStyles(() => ({
+  container: {
+    width: '29%',
+    height: 88,
+    marginBottom: _.md,
+    marginHorizontal: '2.1%'
+  },
   btn: {
-    marginVertical: _.md
+    height: '100%',
+    backgroundColor: _.select(_.colorPlain, _.colorBg),
+    borderWidth: 1,
+    borderColor: _.colorIcon,
+    borderStyle: 'dashed',
+    borderRadius: _.radiusSm
+  },
+  inner: {
+    height: '100%'
+  },
+  form: {
+    width: '100%',
+    marginTop: _.sm
   }
-})
+}))
```

---

### Incident Patch 3: `cc7c9748` (2026-09-15)
**Commit Message**: - [修复] 修复 hook 写在提前 return 之后导致首屏 Rendered more hooks 报错, 新增 lint:hooks 检查

**File**: `scripts/lint-hooks.cjs` (added, +260/-0)
```diff
@@ -0,0 +1,260 @@
+/*
+ * @Author: czy0729
+ * @Date: 2026-09-16 04:16:18
+ * @Last Modified by:   czy0729
+ * @Last Modified time: 2026-09-16 04:16:18
+ *
+ * lint:hooks —— 排查 hook 出现在 "可能提前 return 的分支" 之后
+ *
+ * React 要求同一次渲染中 hook 的调用顺序完全一致。
+ * 一旦某个 hook 写在 `if (...) return` 这类提前 return 之后:
+ *
+ *   function Item() {
+ *     const styles = memoStyles()
+ *     if (!id) return <Loading />      // 数据未就绪时从这里出去, 只调用了 1 个 hook
+ *     const style = useMemo(...)       // 数据回来后才会走到这里 -> hook 数变多
+ *   }
+ *
+ * 首次渲染会跳过它, 后续渲染再调用就会报
+ * "Rendered more hooks than during the previous render"。
+ *
+ * 这类问题只在 "首屏数据未就绪" 的那一次渲染出现, 页面重挂载后就不复现,
+ * 而 eslint-plugin-react-hooks@4 只检查 hook 是否在条件分支/循环/嵌套函数里,
+ * 不覆盖提前 return 之后的顶层 hook, 所以单独扫一遍。
+ *
+ * 用法: npm run lint:hooks
+ * 退出码: 发现问题 => 1, 否则 => 0
+ */
+const fs = require('fs')
+const path = require('path')
+const parser = require('@babel/parser')
+const traverse = require('@babel/traverse').default
+
+const ROOT = path.join(__dirname, '..', 'src')
+const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', '.codebuddy'])
+
+function walk(dir, out = []) {
+  let names = []
+  try {
+    names = fs.readdirSync(dir)
+  } catch (e) {
+    return out
+  }
+
+  for (const name of names) {
+    const p = path.join(dir, name)
+    let st
+    try {
+      st = fs.statSync(p)
+    } catch (e) {
+      continue
+    }
+
+    if (st.isDirectory()) {
+      if (!SKIP_DIRS.has(name)) walk(p, out)
+    } else if (/\.(tsx|ts)$/.test(name) && !/\.d\.ts$/.test(name)) {
+      out.push(p)
+    }
+  }
+
+  return out
+}
+
+const isHookName = n => typeof n === 'string' && /^use[A-Z0-9]/.test(n)
+
+function hookNameOf(node) {
+  const c = node.callee
+  if (!c) return null
+  if (c.type === 'Identifier' && isHookName(c.name)) return c.name
+  if (
+    c.type === 'MemberExpression' &&
+    c.property &&
+    c.property.type === 'Identifier' &&
+    isHookName(c.property.name)
+  ) {
+    return c.property.name
+  }
+  return null
+}
+
+function isFunctionNode(n) {
+  if (!n) return false
+  return (
+    n.type === 'FunctionDeclaration' ||
+    n.type === 'FunctionExpression' ||
+    n.type === 'ArrowFunctionExpression' ||
+    n.type === 'ObjectMethod' ||
+    n.type === 'ClassMethod' ||
+    n.type === 'ClassPrivateMethod'
+  )
+}
+
+const SKIP_KEY = k => k === 'loc' || k === 'start' || k === 'end' || k.endsWith('Comments')
+
+/** 收集子树中的 hook 调用 (不进入嵌套函数体, 那属于回调自己的 hook) */
+function collectHooks(node, out) {
+  if (!node || typeof node.type !== 'string') return
+  if (isFunctionNode(node)) return
+
+  if (node.type === 'CallExpression') {
+    const name = hookNameOf(node)
+    if (name) out.push({ name, line: node.loc.start.line, col: node.loc.start.column + 1 })
+  }
+
+  for (const k of Object.keys(node)) {
+    if (SKIP_KEY(k)) continue
+    const v = node[k]
+    if (Array.isArray(v)) {
+      for (const x of v) if (x && typeof x.type === 'string') collectHooks(x, out)
+    } else if (v && typeof v.type === 'string') {
+      collectHooks(v, out)
+    }
+  }
+}
+
+/** 子树中是否存在 return (不把嵌套函数里的 return 算进来) */
+function containsReturn(node) {
+  if (!node || typeof node.type !== 'string') return false
+  if (node.type === 'ReturnStatement') return true
+  if (isFunctionNode(node)) return false
+
+  for (const k of Object.keys(node)) {
+    if (SKIP_KEY(k)) continue
+    const v = node[k]
+    if (Array.isArray(v)) {
+      for (const x of v) if (x && typeof x.type === 'string' && containsReturn(x)) return true
+    } else if (v && typeof v.type === 'string' && containsReturn(v)) return true
+  }
+  return false
+}
+
+/** 该顶层语句是否可能提前 return, 返回 return 所在行 */
+function earlyReturnLine(stmt) {
+  if (stmt.type === 'IfStatement') {
+    if (containsReturn(stmt.consequent)) return stmt.consequent.loc.start.line
+    if (stmt.alternate && containsReturn(stmt.alternate)) return stmt.alternate.loc.start.line
+    return null
+  }
+
+  if (stmt.type === 'SwitchStatement') {
+    for (const c of stmt.cases) {
+      for (const s of c.consequent) if (containsReturn(s)) return stmt.loc.start.line
+    }
+    return null
+  }
+
+  if (stmt.type === 'TryStatement') {
+    if (stmt.block && containsReturn(stmt.block)) return stmt.loc.start.line
+    if (stmt.handler && stmt.handler.body && containsReturn(stmt.handler.body)) {
+      return stmt.loc.start.line
+    }
+    return null
+  }
+
+  return null
+}
+
+function functionName(p) {
+  const n = p.node
+  if (n.id && n.id.name) return n.id.name
+
+  const parent = p.parent
+  if (parent) {
+    if (parent.type === 'VariableDeclarator' && parent.id) return parent.id.name || '(anonymous)'
+    if (parent.type === 'ObjectProperty' && parent.key) return parent.key.name || '(anonymous)'
+    if (parent.type === 'ClassMethod' && parent.key) return parent.key.name || '(anonymous)'
+  }
+
+  return '(anonymous)'
+}
+
+const files = walk(ROOT)
+const report = []
+const parseErrors = []
+let scanned = 0
+
+for (const file of files) {
+  let code
+  
```

**File**: `src/screens/discovery/adv/component/item-list/index.tsx` (modified, +16/-10)
```diff
@@ -45,7 +45,7 @@ function Item({ index, pickIndex }: Props) {
 
   const subjectId = otaStore.advSubjectId(pickIndex)
   const adv = otaStore.adv(subjectId)
-  const { id } = adv
+  const { id, title, cover, date, score, rank, total, length, dev, time, cn } = adv
 
   const handlePress = useCallback(() => {
     const { title, cover } = adv
@@ -76,6 +76,21 @@ function Item({ index, pickIndex }: Props) {
     )
   }, [adv, id])
 
+  /**
+   * 下面两个 useMemo 必须在 `if (!id)` 之前
+   *  - 数据未就绪时 otaStore.adv() 返回的是 {}, id 为 undefined, 会走 loading 分支
+   *  - 若把它们写在提前 return 之后, 首次渲染会少调用这两个 hook,
+   *    数据回来后再渲染就会报 Rendered more hooks than during the previous render
+   * */
+  const thumbs = useMemo(() => (id ? getThumbs(id, length) : []), [id, length])
+  const thumbsData = useMemo(() => thumbs.slice(0, 3).map((image, id) => ({ id, image })), [thumbs])
+
+  /** 稳定 style 引用, 避免每次渲染生成新数组击穿子组件 memo */
+  const itemStyle = useMemo(
+    () => stl(flexStyle({ align: 'start' }), styles.container, styles.wrap),
+    [styles]
+  )
+
   if (!id) {
     return (
       <Flex style={styles.loading} justify='center'>
@@ -84,20 +99,11 @@ function Item({ index, pickIndex }: Props) {
     )
   }
 
-  const { title, cover, date, score, rank, total, length, dev, time, cn } = adv
   const titleText = HTMLDecode(title)
   const size = titleText.length >= 20 ? 13 : titleText.length >= 14 ? 14 : 15
   const image = cover ? `${HOST_BGM_STATIC}/pic/cover/m/${cover}.jpg` : IMG_DEFAULT
-  const thumbs = getThumbs(id, length)
   const thumbs2 = getThumbs(id, length, false)
 
-  /** 稳定 style 引用, 避免每次渲染生成新数组击穿子组件 memo */
-  const itemStyle = useMemo(
-    () => stl(flexStyle({ align: 'start' }), styles.container, styles.wrap),
-    [styles]
-  )
-  const thumbsData = useMemo(() => thumbs.slice(0, 3).map((image, id) => ({ id, image })), [thumbs])
-
   const tipStr = [date, dev, formatPlaytime(time), cn ? '汉化' : '']
     .filter(item => !!item)
     .join(' / ')
```

**File**: `src/screens/discovery/anime/component/item-list/index.tsx` (modified, +7/-10)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2019-05-15 16:26:34
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-09-12 03:22:48
+ * @Last Modified time: 2026-09-16 04:08:55
  */
 import { useCallback, useMemo } from 'react'
 import { observer } from 'mobx-react'
@@ -31,11 +31,9 @@ function ItemList({ index, pickIndex }: Props) {
 
   const styles = memoStyles()
 
-  // --- Data Logic ---
   const subjectId = otaStore.animeSubjectId(pickIndex)
   const anime = otaStore.anime(subjectId)
 
-  // --- Handlers ---
   const handlePress = useCallback(() => {
     if (!anime) return
 
@@ -68,7 +66,12 @@ function ItemList({ index, pickIndex }: Props) {
     )
   }, [anime])
 
-  // --- Render ---
+  /** 稳定 style 引用, 避免每次渲染生成新数组击穿子组件 memo */
+  const itemStyle = useMemo(
+    () => stl(flexStyle({ align: 'start' }), styles.container, styles.wrap),
+    [styles]
+  )
+
   if (!anime?.id) {
     return (
       <Flex style={styles.loading} justify='center'>
@@ -113,12 +116,6 @@ function ItemList({ index, pickIndex }: Props) {
 
   const collection = collectionStore.collect(id)
 
-  /** 稳定 style 引用, 避免每次渲染生成新数组击穿子组件 memo */
-  const itemStyle = useMemo(
-    () => stl(flexStyle({ align: 'start' }), styles.container, styles.wrap),
-    [styles]
-  )
-
   return (
     <>
       <Touchable style={itemStyle} onPress={handlePress}>
```

**File**: `src/screens/discovery/nsfw/component/item-list/index.tsx` (modified, +11/-6)
```diff
@@ -33,6 +33,17 @@ function ItemList({ pickIndex }: Props) {
   const subjectId = otaStore.nsfwSubjectId(pickIndex)
   const anime = otaStore.nsfw(subjectId)
 
+  /**
+   * 必须放在 `if (!anime?.id)` 之前
+   *  - 数据未就绪时首次渲染会走 loading 分支, 若把 hook 写在提前 return 之后,
+   *    后续渲染就会报 Rendered more hooks than during the previous render
+   * */
+  /** 稳定 style 引用, 避免每次渲染生成新数组击穿子组件 memo */
+  const itemStyle = useMemo(
+    () => stl(flexStyle({ align: 'start' }), styles.container, styles.wrap),
+    [styles]
+  )
+
   if (!anime?.id) {
     return (
       <Flex style={styles.loading} justify='center'>
@@ -72,12 +83,6 @@ function ItemList({ pickIndex }: Props) {
     )
   }
 
-  /** 稳定 style 引用, 避免每次渲染生成新数组击穿子组件 memo */
-  const itemStyle = useMemo(
-    () => stl(flexStyle({ align: 'start' }), styles.container, styles.wrap),
-    [styles]
-  )
-
   return (
     <Touchable style={itemStyle} onPress={handlePress}>
       <Cover
```

**File**: `src/screens/timeline/say/component/item/index.tsx` (modified, +11/-5)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2023-06-17 11:17:30
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-09-09 13:25:03
+ * @Last Modified time: 2026-09-16 04:34:22
  */
 import { useCallback } from 'react'
 import { observer } from 'mobx-react'
@@ -21,11 +21,12 @@ function Item({ item, index }: Props) {
   const { $ } = useStore<Ctx>(COMPONENT)
 
   const { id, name } = item
-  if (!id) return null
-
-  const { list } = $.say
-  const prevItem: Partial<SayItem> = list[index - 1] || {}
 
+  /**
+   * 必须放在 `if (!id) return null` 之前
+   *  - 否则首次渲染会跳过 useCallback, 后续渲染再调用就会报
+   *    Rendered more hooks than during the previous render
+   * */
   const showTinygrailAt =
     systemStore.setting.tinygrail && systemStore.setting.avatarAlertTinygrailAssets
   const handleLongPress = useCallback(() => {
@@ -43,6 +44,11 @@ function Item({ item, index }: Props) {
     }
   }, [$, id, name, showTinygrailAt])
 
+  if (!id) return null
+
+  const { list } = $.say
+  const prevItem: Partial<SayItem> = list[index - 1] || {}
+
   return (
     <>
       <ItemSay
```

---

### Incident Patch 4: `a2663553` (2026-09-15)
**Commit Message**: - [组件] 图片圆角统一改由 Squircle 承担, 平滑圆角设置得以覆盖各页面封面

**File**: `src/components/cover/text-only/index.tsx` (modified, +30/-24)
```diff
@@ -2,45 +2,51 @@
  * @Author: czy0729
  * @Date: 2023-06-20 10:03:28
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-09-01 03:00:16
+ * @Last Modified time: 2026-09-16 02:10:00
  */
-import React from 'react'
 import { observer } from 'mobx-react'
 import { stl } from '@utils'
 import { Component } from '../../component'
 import { Flex } from '../../flex'
+import { Squircle } from '../../squircle'
 import { Text } from '../../text'
 import { memoStyles } from './styles'
 
 import type { Props } from './types'
 
+/**
+ * 纯文字封面
+ *  - 有圆角时包一层 Squircle, 形状与其它封面分支 (cover-image) 保持一致
+ *  - 这里是 Cover 里唯一不走 Image 的分支, 早前用硬编码 4px 圆角代替,
+ *    开启平滑圆角后形状会与其它封面不一致, 故改为与 cover-image 同一套处理
+ * */
 function TextOnly({ width, height, radius, onPress }: Props) {
   const styles = memoStyles()
 
+  const elContent = (
+    <Flex style={stl(styles.textOnly, { width, height })} justify='center'>
+      <Text
+        type='sub'
+        size={10}
+        bold
+        onPress={() => {
+          onPress?.()
+        }}
+      >
+        {/* text-only */}
+      </Text>
+    </Flex>
+  )
+
   return (
     <Component id='component-cover' data-type='text-only'>
-      <Flex
-        style={stl(
-          styles.textOnly,
-          {
-            width,
-            height
-          },
-          radius && styles.radius
-        )}
-        justify='center'
-      >
-        <Text
-          type='sub'
-          size={10}
-          bold
-          onPress={() => {
-            onPress?.()
-          }}
-        >
-          {/* text-only */}
-        </Text>
-      </Flex>
+      {radius && width && height ? (
+        <Squircle width={width} height={height} radius={radius}>
+          {elContent}
+        </Squircle>
+      ) : (
+        elContent
+      )}
     </Component>
   )
 }
```

**File**: `src/components/cover/text-only/styles.ts` (modified, +1/-5)
```diff
@@ -2,16 +2,12 @@
  * @Author: czy0729
  * @Date: 2023-06-20 10:05:39
  * @Last Modified by: czy0729
- * @Last Modified time: 2023-06-20 10:07:32
+ * @Last Modified time: 2026-09-16 02:10:00
  */
 import { _ } from '@stores'
 
 export const memoStyles = _.memoStyles(() => ({
   textOnly: {
     backgroundColor: _.select(_.colorBorder, _._colorDarkModeLevel1)
-  },
-  radius: {
-    borderRadius: 4,
-    overflow: 'hidden'
   }
 }))
```

**File**: `src/components/render-html/toggle-image/index.tsx` (modified, +6/-1)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2019-08-14 10:15:24
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-03-19 03:05:44
+ * @Last Modified time: 2026-09-16 01:41:13
  */
 import { useCallback, useEffect, useMemo, useState } from 'react'
 import { View } from 'react-native'
@@ -200,6 +200,11 @@ function ToggleImage(props: Props) {
 
         {show && (
           <View style={styles.remote}>
+            {/**
+             * 这里刻意不接 Squircle: autoSize 模式下高度由图片加载完成后运行时测量,
+             * 渲染期拿不到确定尺寸, 而 iOS 的 Squircle 要按尺寸算遮罩轨迹, 传错高度会把曲线拉变形
+             * (安卓走原生 outline 裁剪、取视图实际尺寸, 不受影响)
+             */}
             <Image
               {...props}
               autoSize={autoSize}
```

**File**: `src/screens/_/item/voice/index.tsx` (modified, +9/-8)
```diff
@@ -2,12 +2,11 @@
  * @Author: czy0729
  * @Date: 2020-04-28 12:02:22
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-05-09 22:35:22
+ * @Last Modified time: 2026-09-16 01:41:39
  */
-import React from 'react'
 import { View } from 'react-native'
 import { observer } from 'mobx-react'
-import { Component, Cover, Expand, Flex, Image, Text, Touchable } from '@components'
+import { Component, Cover, Expand, Flex, Image, Squircle, Text, Touchable } from '@components'
 import { getCoverSrc } from '@components/cover/utils'
 import { _, collectionStore } from '@stores'
 import { cnjp, getMonoCoverSmall, x18 } from '@utils'
@@ -171,11 +170,13 @@ export const ItemVoice = observer(
             >
               <Flex align='start'>
                 <InView style={styles.inViewAvatar} y={y}>
-                  <Image
-                    size={AVATAR_SIZE}
-                    src={getMonoCoverSmall(cover) || IMG_INFO_ONLY}
-                    radius={_.radiusSm}
-                  />
+                  <Squircle width={AVATAR_SIZE} height={AVATAR_SIZE} radius={_.radiusSm}>
+                    <Image
+                      size={AVATAR_SIZE}
+                      src={getMonoCoverSmall(cover) || IMG_INFO_ONLY}
+                      radius={0}
+                    />
+                  </Squircle>
                 </InView>
                 <Flex.Item style={_.ml.sm}>
                   <Text style={_.mt.xxs} size={12} bold>
```

**File**: `src/screens/discovery/adv/component/item-list/index.tsx` (modified, +20/-16)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2020-09-03 10:47:08
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-09-12 03:22:41
+ * @Last Modified time: 2026-09-16 04:02:42
  */
 import { useCallback, useMemo } from 'react'
 import { View } from 'react-native'
@@ -14,6 +14,7 @@ import {
   HorizontalList,
   Image,
   Loading,
+  Squircle,
   Text,
   Touchable
 } from '@components'
@@ -105,10 +106,7 @@ function Item({ index, pickIndex }: Props) {
   const y = InView.y(index, IMG_HEIGHT_LG, _.window.height * 0.4)
 
   return (
-    <Touchable
-      style={itemStyle}
-      onPress={handlePress}
-    >
+    <Touchable style={itemStyle} onPress={handlePress}>
       <InView style={styles.inView} y={y}>
         <Cover
           src={image}
@@ -153,21 +151,27 @@ function Item({ index, pickIndex }: Props) {
             <HorizontalList
               data={thumbsData}
               renderItem={(item, idx) => (
-                <Image
+                <Squircle
                   key={item.id}
                   style={stl(!!idx && _.ml.sm, idx === thumbsData.length - 1 && _.mr.md)}
-                  src={item.image}
-                  size={THUMB_WIDTH}
+                  width={THUMB_WIDTH}
                   height={THUMB_HEIGHT}
                   radius={_.radiusSm}
-                  errorToHide
-                  onPress={() => {
-                    showImageViewer(
-                      thumbs2.map(t => ({ url: t })),
-                      idx
-                    )
-                  }}
-                />
+                >
+                  <Image
+                    src={item.image}
+                    size={THUMB_WIDTH}
+                    height={THUMB_HEIGHT}
+                    radius={0}
+                    errorToHide
+                    onPress={() => {
+                      showImageViewer(
+                        thumbs2.map(t => ({ url: t })),
+                        idx
+                      )
+                    }}
+                  />
+                </Squircle>
               )}
               renderNums={
                 thumbs2.length > 3 &&
```

**File**: `src/screens/discovery/anitama/component/list/index.tsx` (modified, +16/-13)
```diff
@@ -2,14 +2,14 @@
  * @Author: czy0729
  * @Date: 2022-01-10 11:19:10
  * @Last Modified by: czy0729
- * @Last Modified time: 2025-12-23 06:11:22
+ * @Last Modified time: 2026-09-16 04:09:29
  */
-import React, { useCallback } from 'react'
+import { useCallback } from 'react'
 import { View } from 'react-native'
 import { observer } from 'mobx-react'
-import { Heatmap, Image, ScrollView, Text, Touchable } from '@components'
+import { Heatmap, Image, ScrollView, Squircle, Text, Touchable } from '@components'
 import { InView } from '@_'
-import { _, useStore } from '@stores'
+import { _, systemStore, useStore } from '@stores'
 import { open } from '@utils'
 import { hm, t } from '@utils/fetch'
 import { TITLE } from '../../ds'
@@ -24,10 +24,8 @@ function List() {
 
   const styles = memoStyles()
 
-  // --- Data Logic ---
   const { useWebView } = $.state
 
-  // --- Handlers ---
   const handlePress = useCallback(
     (item: NewsItem) => {
       if (useWebView) {
@@ -49,7 +47,6 @@ function List() {
     [navigation, useWebView]
   )
 
-  // --- Render ---
   return (
     <ScrollView keyboardDismissMode='on-drag' onScroll={$.onScroll}>
       {$.state.show && (
@@ -59,14 +56,20 @@ function List() {
               <Text align='right'>© {[item.author, item.origin].filter(i => !!i).join(' / ')}</Text>
 
               <InView style={_.mt.md} y={InView.y(index, 280)}>
-                <Image
-                  src={item.cover.url}
-                  headers={item.cover.headers}
+                <Squircle
                   width={styles.cover.width}
                   height={styles.cover.height}
-                  radius
-                  errorToHide
-                />
+                  radius={systemStore.coverRadius}
+                >
+                  <Image
+                    src={item.cover.url}
+                    headers={item.cover.headers}
+                    width={styles.cover.width}
+                    height={styles.cover.height}
+                    radius={0}
+                    errorToHide
+                  />
+                </Squircle>
               </InView>
 
               <View style={styles.info}>
```

**File**: `src/screens/discovery/bi-weekly/component/item/index.tsx` (modified, +7/-6)
```diff
@@ -2,11 +2,11 @@
  * @Author: czy0729
  * @Date: 2024-05-14 05:00:44
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-04-30 04:40:16
+ * @Last Modified time: 2026-09-16 04:11:10
  */
-import React, { useCallback } from 'react'
+import { useCallback } from 'react'
 import { observer } from 'mobx-react'
-import { Flex, Image, Text, Touchable } from '@components'
+import { Flex, Image, Squircle, Text, Touchable } from '@components'
 import { InView } from '@_'
 import { _ } from '@stores'
 import { t } from '@utils/fetch'
@@ -47,13 +47,14 @@ function Item({ item, index }: RenderItem<DataItem>) {
     <Touchable style={styles.item} withoutFeedback onPress={handlePress}>
       <Flex justify='center'>
         <InView y={InView.y(index - 1, height + styles.item.marginBottom + descSize + titleSize)}>
-          <Image
+          <Squircle
             style={styles.cover}
             width={width}
             height={height}
-            src={item.cover}
             radius={isCatalog ? _.radiusMd : 0}
-          />
+          >
+            <Image width={width} height={height} src={item.cover} radius={0} />
+          </Squircle>
         </InView>
       </Flex>
 
```

**File**: `src/screens/discovery/catalog-detail/header/index.tsx` (modified, +13/-8)
```diff
@@ -2,12 +2,20 @@
  * @Author: czy0729
  * @Date: 2022-03-11 23:02:42
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-08-29 06:42:16
+ * @Last Modified time: 2026-09-16 04:11:57
  */
 import { useCallback, useMemo } from 'react'
 import { View } from 'react-native'
 import { observer } from 'mobx-react'
-import { Flex, HeaderV2 as HeaderComp, HeaderV2Popover, Image, Text, UserStatus } from '@components'
+import {
+  Flex,
+  HeaderV2 as HeaderComp,
+  HeaderV2Popover,
+  Image,
+  Squircle,
+  Text,
+  UserStatus
+} from '@components'
 import { _, useStore } from '@stores'
 import { getCoverLarge, getSPAParams, getVisualLength, open } from '@utils'
 import { t } from '@utils/fetch'
@@ -31,12 +39,9 @@ function Header() {
         {!!avatar && (
           <View style={_.mr.sm}>
             <UserStatus userId={userId} mini>
-              <Image
-                src={getCoverLarge(avatar)}
-                size={28}
-                radius={_.radiusXs}
-                placeholder={false}
-              />
+              <Squircle width={28} height={28} radius={_.radiusXs}>
+                <Image src={getCoverLarge(avatar)} size={28} radius={0} placeholder={false} />
+              </Squircle>
             </UserStatus>
           </View>
         )}
```

---

### Incident Patch 5: `088ffc72` (2026-09-14)
**Commit Message**: - [进度] 优化下沉逻辑，现在若一个季度还没开始，若分组没有放送的下沉到年分组的底部 (fixed #415)

**File**: `src/screens/home/v2/store/__test__/computed.test.ts` (modified, +75/-6)
```diff
@@ -16,6 +16,7 @@ import {
   calcSortWeightOnair,
   getSeasonKey,
   getTopMap,
+  hasAiredEp,
   hasNewEp,
   isOnairNextDay,
   isOnairToday,
@@ -90,6 +91,61 @@ describe('calcSortWeightClient', () => {
     })
     expect(result).toBe(1_100_000)
   })
+
+  it('完全未播放 (未来季 + 无已放送章节) 季键值降为所属年份底部', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+
+    // 2026 秋 (8108) => 2026 组底部 8104.5; 当前季 2026 夏 (8107)
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: false,
+        seasonKey: getSeasonKey('2026-10'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_045_000_000 + 1 - 100001)
+  })
+
+  it('未来季但有已放送章节 (提前放送) 时不下沉', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+
+    // 保持 2026 秋 原季键 8108, 未被降级
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: true,
+        hasNewEp: true,
+        air: 1,
+        seasonKey: getSeasonKey('2026-10'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_080_000_000 + 500_000 + 50_000)
+  })
+
+  it('未开启下沉时不降级未来季', () => {
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: false,
+        seasonKey: getSeasonKey('2026-10'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_080_000_000 + 1)
+  })
+
+  it('当季无已放送章节不做年份下沉 (仍只走既有下沉惩罚)', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+
+    // seasonKey === currentSeasonKey (2026 夏), 不满足「未来季」条件
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: false,
+        seasonKey: getSeasonKey('2026-07'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_070_000_000 + 1 - 100001)
+  })
 })
 
 // ==================== sortByWeightAndTop ====================
@@ -320,16 +376,21 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
 
   const topMap = getTopMap(topList)
 
+  // 固定为快照同期 (2026-07 与 2026-09 同属 2026 夏季), 避免依赖真实系统时间
+  const currentSeasonKey = getSeasonKey('2026-09')
+
   function loadSnapshot(name: string) {
     return require(`${snapDir}/${name}.json`) as { name: string; _comment: string }[]
   }
 
   function getWatchInfo(item: UserCollectionItem) {
     const id = item.subject_id
     const up = (upJson[id] || {}) as UserProgress
+    const eps = epsJson[id] || []
     const watchedCount = Object.values(up).filter(v => v === '看过').length
-    const hasNewEpResult = hasNewEp(epsJson[id] || [], up)
-    return { watchedCount, hasNewEp: hasNewEpResult }
+    const hasNewEpResult = hasNewEp(eps, up)
+    const hasAiredEpResult = hasAiredEp(eps)
+    return { watchedCount, hasNewEp: hasNewEpResult, hasAiredEp: hasAiredEpResult }
   }
 
   function buildRealClientWeightMap(sink: boolean) {
@@ -338,7 +399,11 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
     items.forEach(item => {
       const id = item.subject_id
       const onAir = getOnAir(onAirJson[id] || {}, {})
-      const { watchedCount, hasNewEp: hasNewEpResult } = getWatchInfo(item)
+      const {
+        watchedCount,
+        hasNewEp: hasNewEpResult,
+        hasAiredEp: hasAiredEpResult
+      } = getWatchInfo(item)
       const { air = 0 } = onAirJson[id] || {}
       const epsCount = item.subject?.eps_count
 
@@ -353,7 +418,9 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
         watchedCount,
         hasNewEp: hasNewEpResult,
         seasonKey: getSeasonKey(item.subject?.air_date),
-        epsCount
+        epsCount,
+        hasAiredEp: hasAiredEpResult,
+        currentSeasonKey
       })
     })
     return weightMap
@@ -365,7 +432,7 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
     items.forEach(item => {
       const id = item.subject_id
       const onAir = getOnAir(onAirJson[id] || {}, {})
-      const { hasNewEp: hasNewEpResult } = getWatchInfo(item)
+      const { hasNewEp: hasNewEpResult, hasAiredEp: hasAiredEpResult } = getWatchInfo(item)
       const { air = 0 } = onAirJson[id] || {}
       const epsCount = item.subject?.eps_count
       const wd = onAir.weekDay
@@ -380,7 +447,9 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
         hasNewEp: hasNewEpResult,
         seasonKey: getSeasonKey(item.subject?.air_date),
         air: air || undefined,
-        epsCount
+        epsCount,
+        hasAiredEp: hasAiredEpResult,
+        currentSeasonKey
       })
     })
     return weightMap
```

**File**: `src/screens/home/v2/store/__test__/sort-list.test.ts` (modified, +57/-2)
```diff
@@ -2,9 +2,9 @@
  * @Author: czy0729
  * @Date: 2026-08-08 12:00:00
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-08-10 07:43:12
+ * @Last Modified time: 2026-09-15 00:46:26
  */
-import { getTopMap, sortByIds } from '../utils'
+import { getSeasonKey, getTopMap, sortByIds } from '../utils'
 
 import type { SubjectId } from '@types'
 import type { UserCollectionItem } from '@utils/fetch.v0/types'
@@ -35,6 +35,7 @@ type CtxEntry = {
   air?: number
   onAirCustom?: { weekDay: number; isOnair: boolean }
   hasNewEp?: boolean
+  hasAiredEp?: boolean
   isToday?: boolean
   isNextDay?: boolean
   watchedCount?: number
@@ -50,6 +51,8 @@ function ctxByMap(map: Record<SubjectId, CtxEntry>) {
     getAir: (id: SubjectId) => get(id, 'air', 0) as number,
     onAirCustom: (id: SubjectId) => get(id, 'onAirCustom', { weekDay: 0, isOnair: false }),
     hasNewEp: (id: SubjectId) => get(id, 'hasNewEp', false) as boolean,
+    // 默认视为已有已放送章节, 即不参与「完全未播放」的年份下沉
+    hasAiredEp: (id: SubjectId) => get(id, 'hasAiredEp', true) as boolean,
     isToday: (id: SubjectId) => get(id, 'isToday', false) as boolean,
     isNextDay: (id: SubjectId) => get(id, 'isNextDay', false) as boolean,
     watchedCount: (id: SubjectId) => get(id, 'watchedCount', 0) as number
@@ -181,6 +184,58 @@ describe('sortByIds: 客户端顺序 (默认)', () => {
     })
     expect(result.map(item => item.subject_id)).toEqual([502, 501])
   })
+
+  it('完全未播放: 沉到在播番之后, 但仍高于上一年', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+    const items = [
+      makeItem(701, { air_date: '2026-10', eps_count: 12 }), // 未来季, 一集都没放
+      makeItem(702, { air_date: '2026-07', eps_count: 12 }), // 在播
+      makeItem(703, { air_date: '2025-10', eps_count: 12 }) // 往年
+    ]
+    const result = sortByIds(items, {
+      ...ctxByMap({
+        701: { hasAiredEp: false },
+        702: { hasNewEp: true, air: 3, watchedCount: 1 },
+        703: { hasNewEp: true, air: 8, watchedCount: 2 }
+      }),
+      currentSeasonKey: getSeasonKey('2026-09')
+    })
+    expect(result.map(item => item.subject_id)).toEqual([702, 701, 703])
+  })
+
+  it('[回归] 未来季但有已放送章节 (提前放送) 不下沉, 保持季度优先', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+    const items = [
+      makeItem(801, { air_date: '2026-10', eps_count: 12 }), // 未来季, 但已有 ep 提前放送
+      makeItem(802, { air_date: '2026-07', eps_count: 12 }) // 在播
+    ]
+    const result = sortByIds(items, {
+      ...ctxByMap({
+        801: { hasAiredEp: true, hasNewEp: true, air: 1, watchedCount: 0 },
+        802: { hasAiredEp: true, hasNewEp: true, air: 3, watchedCount: 1 }
+      }),
+      currentSeasonKey: getSeasonKey('2026-09')
+    })
+    expect(result.map(item => item.subject_id)).toEqual([801, 802])
+  })
+
+  it('[回归] 跨年: 未开播的 2027 冬沉到 2027 组底部, 年份仍优先于 2026 全年', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+    const items = [
+      makeItem(901, { air_date: '2027-01', eps_count: 12 }), // 未开播
+      makeItem(902, { air_date: '2026-10', eps_count: 12 }), // 未开播
+      makeItem(903, { air_date: '2026-07', eps_count: 12 }) // 在播
+    ]
+    const result = sortByIds(items, {
+      ...ctxByMap({
+        901: { hasAiredEp: false },
+        902: { hasAiredEp: false },
+        903: { hasNewEp: true, air: 3, watchedCount: 1 }
+      }),
+      currentSeasonKey: getSeasonKey('2026-09')
+    })
+    expect(result.map(item => item.subject_id)).toEqual([901, 903, 902])
+  })
 })
 
 // ==================== 兜底 ====================
```

**File**: `src/screens/home/v2/store/computed/air.ts` (modified, +4/-0)
```diff
@@ -13,6 +13,7 @@ import {
   getLastWatchedSort,
   getOnlineOrigins,
   getWatchedCount,
+  hasAiredEp as checkHasAiredEp,
   hasNewEp as checkHasNewEp,
   isOnairNextDay,
   isOnairToday
@@ -76,6 +77,9 @@ export default class Air extends Subject {
     checkHasNewEp(this.epsNoSp(subjectId), this.userProgress(subjectId))
   )
 
+  /** 是否已有已放送的章节 (只看章节状态, 与用户进度无关) */
+  hasAiredEp = computedFn((subjectId: SubjectId) => checkHasAiredEp(this.epsNoSp(subjectId)))
+
   /** 猜测条目当前看到的集数 */
   countFixed = computedFn((subjectId: SubjectId, epStatus: number | string) => {
     // 直接获取第一个看过章节的 sort
```

**File**: `src/screens/home/v2/store/computed/list.ts` (modified, +1/-0)
```diff
@@ -99,6 +99,7 @@ export default class List extends Air {
       sortOnAir: this.sortOnAir,
       getAir: subjectId => calendarStore.onAir[subjectId]?.air || 0,
       onAirCustom: subjectId => this.onAirCustom(subjectId),
+      hasAiredEp: subjectId => this.hasAiredEp(subjectId),
       hasNewEp: subjectId => this.hasNewEp(subjectId),
       isToday: subjectId => this.isToday(subjectId),
       isNextDay: subjectId => this.isNextDay(subjectId),
```

**File**: `src/screens/home/v2/store/index.ts` (modified, +5/-3)
```diff
@@ -2,14 +2,15 @@
  * @Author: czy0729
  * @Date: 2023-02-27 20:26:27
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-08-27 03:49:57
+ * @Last Modified time: 2026-09-15 00:08:16
  */
 import * as Device from 'expo-device'
 import { _, systemStore, userStore } from '@stores'
 import { date, feedback, getTimestamp, info, pick, postTask, sortObject } from '@utils'
 import { logger } from '@utils/dev'
 import { t } from '@utils/fetch'
 import { update } from '@utils/kv'
+import { getProxyStrategy } from '@utils/proxy'
 import { get } from '@utils/thirdParty/protobuf'
 import {
   D,
@@ -144,7 +145,7 @@ export default class ScreenHomeV2 extends Action {
     return false
   }
 
-  /** 注册设备名 */
+  /** 注册设备名，构建监测报错信息的环境变量 */
   initUser = () => {
     if (inited) return
 
@@ -172,7 +173,8 @@ export default class ScreenHomeV2 extends Action {
           direct: setting.workerProxyDirect,
           secret: setting.workerSecret.length,
           lainSecret: setting.workerLainSecret.length,
-          ech: setting.echProxyEnabled
+          ech: setting.echProxyEnabled,
+          supporter: getProxyStrategy().supporter
         },
         l: {
           statusBar: STATUS_BAR_HEIGHT,
```

**File**: `src/screens/home/v2/store/utils/eps.ts` (modified, +5/-0)
```diff
@@ -85,6 +85,11 @@ export function hasNewEp(eps: readonly Ep[], userProgress: UserProgress) {
   )
 }
 
+/** 检查是否存在已放送的章节 (只看章节状态, 与用户进度无关) */
+export function hasAiredEp(eps: readonly Ep[]) {
+  return eps.some(item => item.status === 'Air' || item.status === 'Today')
+}
+
 /** 获取可见的章节范围 */
 export function getVisibleEps(eps: Ep[], userProgress: UserProgress, maxLength: number) {
   const { length } = eps
```

**File**: `src/screens/home/v2/store/utils/sort.ts` (modified, +75/-9)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2026-08-27 02:30:00
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-08-27 03:54:01
+ * @Last Modified time: 2026-09-15 00:46:12
  */
 import { systemStore } from '@stores'
 import { desc, freeze } from '@utils'
@@ -29,6 +29,35 @@ export function getSeasonKey(airDate: string | undefined): number {
   return year * 4 + quarter
 }
 
+/** 获取当前季度的连续键值（与 getSeasonKey 同口径） */
+export function getCurrentSeasonKey(): number {
+  const now = new Date()
+  const month = `${now.getMonth() + 1}`.padStart(2, '0')
+  return getSeasonKey(`${now.getFullYear()}-${month}`)
+}
+
+/** 所属年份分组的底部键值（年*4+0.5，落在该年最后季度与下一年第一季度之间） */
+export function toYearBottomSeasonKey(seasonKey: number): number {
+  // seasonKey = year*4 + quarter (quarter 为 1-4), 故年份需用 (seasonKey-1)/4 取整
+  return Math.floor((seasonKey - 1) / 4) * 4 + 0.5
+}
+
+/**
+ * 计算参与 seasonBoost 的季度键值
+ * - 完全未播放 (没有任何已放送章节) 且所属季度尚未开始时, 沉到所属年份分组底部
+ * - 其余情况沿用原键值
+ */
+function resolveSeasonKey(
+  seasonKey: number,
+  hasAiredEp: boolean,
+  currentSeasonKey?: number
+): number {
+  if (!systemStore.setting.homeSortSink || hasAiredEp) return seasonKey
+  if (seasonKey <= (currentSeasonKey ?? getCurrentSeasonKey())) return seasonKey
+
+  return toYearBottomSeasonKey(seasonKey)
+}
+
 /** 计算排序权重（放送顺序模式）
  *
  *  层级: 放送中(巨量boost) >>> 非放送中(seasonKey > 未看 > 默认) */
@@ -40,10 +69,22 @@ export function calcSortWeightOnair(options: {
   seasonKey?: number
   air?: number
   epsCount?: number
+  hasAiredEp?: boolean
+  currentSeasonKey?: number
 }) {
-  const { weekDay, isOnair, hasNewEp, seasonKey = 0, air, epsCount } = options
+  const {
+    weekDay,
+    isOnair,
+    hasNewEp,
+    seasonKey = 0,
+    air,
+    epsCount,
+    hasAiredEp = true,
+    currentSeasonKey
+  } = options
 
   // 看完下沉优先: 已沉底的条目不参与放送中排序, 走 APP 逻辑落到同季最下方
+  // (其中完全未播放的条目会进一步沉到所属年份分组最下方)
   if (systemStore.setting.homeSortSink && !hasNewEp)
     return calcSortWeightClient({
       isToday: false,
@@ -52,7 +93,9 @@ export function calcSortWeightOnair(options: {
       watchedCount: 0,
       hasNewEp,
       seasonKey,
-      epsCount
+      epsCount,
+      hasAiredEp,
+      currentSeasonKey
     })
 
   if (isOnair) {
@@ -68,7 +111,7 @@ export function calcSortWeightOnair(options: {
   }
 
   // 非放送中: APP 默认 + 细节
-  const seasonBoost = seasonKey * 10_000_000
+  const seasonBoost = resolveSeasonKey(seasonKey, hasAiredEp, currentSeasonKey) * 10_000_000
   const tierBoost = hasNewEp ? 500_000 : 0
   let cdnWeight = 1
   if (air && (!epsCount || air < epsCount) && hasNewEp) {
@@ -80,7 +123,8 @@ export function calcSortWeightOnair(options: {
 
 /** 计算排序权重（客户端顺序模式）
  *
- *  层级: seasonKey (越近越大) >>> tierBoost (放送中 > 未看 > 默认) > cdnWeight (细节) */
+ *  层级: seasonKey (越近越大) >>> tierBoost (放送中 > 未看 > 默认) > cdnWeight (细节)
+ *  完全未播放的条目季键值降为所属年份分组底部 (见 resolveSeasonKey) */
 export function calcSortWeightClient(options: {
   isToday: boolean
   isNextDay: boolean
@@ -89,10 +133,22 @@ export function calcSortWeightClient(options: {
   hasNewEp: boolean
   seasonKey?: number
   epsCount?: number
+  hasAiredEp?: boolean
+  currentSeasonKey?: number
 }) {
-  const { isToday, isNextDay, air, watchedCount, hasNewEp, seasonKey = 0, epsCount } = options
+  const {
+    isToday,
+    isNextDay,
+    air,
+    watchedCount,
+    hasNewEp,
+    seasonKey = 0,
+    epsCount,
+    hasAiredEp = true,
+    currentSeasonKey
+  } = options
 
-  const seasonBoost = seasonKey * 10_000_000
+  const seasonBoost = resolveSeasonKey(seasonKey, hasAiredEp, currentSeasonKey) * 10_000_000
 
   let tierBoost = 0
   if (isToday && hasNewEp) {
@@ -154,9 +210,11 @@ export function sortByIds(
     getAir: (subjectId: SubjectId) => number
     onAirCustom: (subjectId: SubjectId) => { weekDay: string | number; isOnair: boolean }
     hasNewEp: (subjectId: SubjectId) => boolean
+    hasAiredEp: (subjectId: SubjectId) => boolean
     isToday: (subjectId: SubjectId) => boolean
     isNextDay: (subjectId: SubjectId) => boolean
     watchedCount: (subjectId: SubjectId) => number
+    currentSeasonKey?: number
   }
 ): UserCollectionItem[] {
   const {
@@ -166,11 +224,15 @@ export function sortByIds(
     getAir,
     onAirCustom,
     hasNewEp,
+    hasAiredEp,
     isToday,
     isNextDay,
     watchedCount
   } = options
 
+  // 只计算一次当前季键值, 避免逐条目取时间
+  const currentSeasonKey = options.currentSeasonKey ?? getCurrentSeasonKey()
+
   if (!list?.length) return freeze([]) as UserCollectionItem[]
 
   // 网页顺序: 不需要处理
@@ -202,7 +264,9 @@ export function sortByIds(
           hasNewEp: hasNewEp(subjectId),
           seasonKey: getSeasonKey(item.subject?.air_date),
           air,
-          epsCount: item.subject?.eps_count
+          epsCount: item.subject?.eps_count,
+          hasAiredEp: hasAiredEp(subjectId),
+          currentSeasonKey
         })
       })
       return freeze(sortByWeightAndTop(list, weightMap, topMap)) as UserCollectionItem[]
@@ -219,7 +283,9 @@ export function sortByIds(
 
```

**File**: `src/screens/user/setting/component/home/ds.ts` (modified, +2/-1)
```diff
@@ -90,7 +90,8 @@ export const TEXTS = {
   },
   homeSortSink: {
     hd: '条目自动下沉',
-    information: '当条目没有未观看的已放送章节时，自动下沉到分组底部'
+    information:
+      '当条目没有未观看的已放送章节时，自动下沉到分组底部\n完全未播放（一集都没有已放送章节）的条目会沉到所属年份分组最下方'
   },
   showGame: {
     hd: '游戏标签页',
```

---

### Incident Patch 6: `2b694e8b` (2026-09-05)
**Commit Message**: - [修复] 原生头部 headerLeft/headerRight 渲染在 StoreContext 之外拿不到页面状态机, 新增 useStoreContextBridge 桥接, HeaderV1/HeaderV2 统一包裹 Provider (fixed #414)

**File**: `src/components/header-v2/hooks.ts` (modified, +14/-4)
```diff
@@ -5,7 +5,7 @@
  * @Last Modified time: 2026-08-19 18:11:59
  */
 import { useEffect, useMemo } from 'react'
-import { _ } from '@stores'
+import { _, useStoreContextBridge } from '@stores'
 import { useNavigation } from '@utils/hooks'
 import { getHeaderTitleAlign, getHeaderTitleStyle } from './utils'
 import { COMPONENT } from './ds'
@@ -19,15 +19,25 @@ export function useHeaderV2({
   headerTitleStyle
 }: UseHeaderV2Options): UseHeaderV2Result {
   const navigation = useNavigation(COMPONENT)
+  const bridge = useStoreContextBridge()
+
+  /**
+   * 原生头部渲染 headerRight 时位于 StoreContext.Provider 之外,
+   * 需要包一层 Provider, 否则内部的 useStore 拿不到页面状态机
+   */
+  const bridgedHeaderRight = useMemo(() => {
+    if (!headerRight) return headerRight
+    return bridge(headerRight)
+  }, [headerRight, bridge])
 
   useEffect(() => {
     navigation.setOptions({
       headerShown: false,
       headerTransparent: false,
       headerShadowVisible: false,
-      headerRight
+      headerRight: bridgedHeaderRight
     })
-  }, [navigation, headerRight])
+  }, [navigation, bridgedHeaderRight])
 
   const headerTitleAlignValue = getHeaderTitleAlign(headerTitleAlign, _.isPad)
 
@@ -37,5 +47,5 @@ export function useHeaderV2({
     [headerTitleStyle, _.isPad]
   )
 
-  return { headerTitleAlignValue, headerTitleStyleValue }
+  return { bridgedHeaderRight, headerTitleAlignValue, headerTitleStyleValue }
 }
```

**File**: `src/components/header-v2/index.tsx` (modified, +2/-2)
```diff
@@ -33,7 +33,7 @@ export const HeaderV2 = observer(
     headerTitleTextStyle,
     headerRight
   }: HeaderV2Props) => {
-    const { headerTitleAlignValue, headerTitleStyleValue } = useHeaderV2({
+    const { bridgedHeaderRight, headerTitleAlignValue, headerTitleStyleValue } = useHeaderV2({
       headerRight,
       headerTitleAlign,
       headerTitleStyle
@@ -51,7 +51,7 @@ export const HeaderV2 = observer(
           headerTitleSize={headerTitleSize}
           headerTitleAppend={headerTitleAppend}
           headerTitleTextStyle={headerTitleTextStyle}
-          headerRight={headerRight}
+          headerRight={bridgedHeaderRight}
         />
         <Track title={title} domTitle={domTitle} hm={hm} alias={alias} />
       </Component>
```

**File**: `src/components/header-v2/types.ts` (modified, +3/-0)
```diff
@@ -63,6 +63,9 @@ export type UseHeaderV2Options = Pick<Props, 'headerRight' | 'headerTitleAlign'
 
 /** HeaderV2 头部逻辑返回值 */
 export type UseHeaderV2Result = {
+  /** 包裹 StoreContext.Provider 后的右侧渲染函数, 用于原生头部和自绘头部 */
+  bridgedHeaderRight?: Props['headerRight']
+
   /** 按设备适配的标题对齐 */
   headerTitleAlignValue: 'center' | 'left'
 
```

**File**: `src/components/header/index.tsx` (modified, +10/-2)
```diff
@@ -4,9 +4,9 @@
  * @Last Modified by: czy0729
  * @Last Modified time: 2026-05-16 02:10:13
  */
-import React, { useEffect } from 'react'
+import React, { useContext, useEffect } from 'react'
 import { observer } from 'mobx-react'
-import { _ } from '@stores'
+import { _, StoreContext } from '@stores'
 import { r } from '@utils/dev'
 import { useNavigation } from '@utils/hooks'
 import { WEB } from '@constants'
@@ -44,9 +44,16 @@ const Header = observer(
 
     const navigation = useNavigation()
 
+    /**
+     * 原生头部渲染 headerLeft / headerRight 时位于 StoreContext.Provider 之外,
+     * 需要把当前页面的上下文 id 传给 updateHeader, 在 options JSX 外包一层 Provider
+     */
+    const storeContextId = useContext(StoreContext)
+
     useEffect(() => {
       updateHeader({
         navigation,
+        storeContextId,
         mode,
         fixed,
         title,
@@ -59,6 +66,7 @@ const Header = observer(
       })
     }, [
       navigation,
+      storeContextId,
       mode,
       fixed,
       title,
```

**File**: `src/components/header/types.ts` (modified, +3/-0)
```diff
@@ -75,6 +75,9 @@ export type UpdateHeaderProps = Expand<
       | 'fixed'
       | 'statusBarEventsType'
     > & {
+      /** 页面 Store 上下文 id, 用于 headerLeft / headerRight 桥接 StoreContext */
+      storeContextId?: string
+
       onBackPress?: () => void
     }
   >
```

**File**: `src/components/header/utils.tsx` (modified, +7/-4)
```diff
@@ -6,7 +6,7 @@
  */
 import React, { useCallback, useRef, useState } from 'react'
 import { View } from 'react-native'
-import { _, systemStore } from '@stores'
+import { _, StoreContext, systemStore } from '@stores'
 import { s2t } from '@utils/thirdParty/open-cc'
 import { IOS } from '@constants'
 import { IOS_IPA } from '@src/config'
@@ -21,6 +21,7 @@ export const HEADER_TRANSITION_HEIGHT = 32
 export const updateHeader = ({
   // 必要
   navigation,
+  storeContextId,
   title = '',
   headerTitleAlign,
   headerTitleStyle,
@@ -74,12 +75,12 @@ export const updateHeader = ({
       paddingLeft: 5
     },
     headerLeft: () => (
-      <>
+      <StoreContext.Provider value={storeContextId}>
         <View style={styles.headerLeftContainerStyle}>
           <Back navigation={navigation} color={tintColor} onPress={onBackPress} />
         </View>
         {headerLeft}
-      </>
+      </StoreContext.Provider>
     ),
 
     /** ==================== headerTitle ==================== */
@@ -98,7 +99,9 @@ export const updateHeader = ({
       paddingRight: 6
     }
     options.headerRight = () => (
-      <View style={styles.headerRightContainerStyle}>{headerRight()}</View>
+      <StoreContext.Provider value={storeContextId}>
+        <View style={styles.headerRightContainerStyle}>{headerRight()}</View>
+      </StoreContext.Provider>
     )
   }
 
```

**File**: `src/stores/bridge.tsx` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/*
+ * @Author: czy0729
+ * @Date: 2026-09-05 23:11:54
+ * @Last Modified by:   czy0729
+ * @Last Modified time: 2026-09-05 23:11:54
+ */
+import React, { useContext, useMemo } from 'react'
+import { StoreContext } from './utils'
+
+/**
+ * 页面 Store 上下文桥接
+ *
+ * 注册进 react-navigation 原生头部的 headerRight / headerLeft 等渲染函数,
+ * 会在屏幕组件树 (StoreContext.Provider 之内) 以外的位置被调用, 导致其内部的
+ * useStore 拿不到页面状态机。此 hook 需在树内调用, 捕获当前页面的上下文 id,
+ * 返回一个包装函数, 把 render 的返回元素包上 StoreContext.Provider,
+ * 使其在任意位置渲染时都能取到页面 Store。
+ */
+export function useStoreContextBridge() {
+  const id = useContext(StoreContext)
+
+  return useMemo(() => {
+    return <T extends Function>(render: T): T => {
+      if (!id || typeof render !== 'function') return render
+
+      const wrapped = (...args: any[]) => (
+        <StoreContext.Provider value={id}>{render(...args)}</StoreContext.Provider>
+      )
+      return wrapped as unknown as T
+    }
+  }, [id])
+}
```

**File**: `src/stores/index.ts` (modified, +2/-1)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2019-03-02 06:14:49
  * @Last Modified by: czy0729
- * @Last Modified time: 2024-11-14 06:19:42
+ * @Last Modified time: 2026-09-05 23:12:11
  */
 import calendarStore from './calendar'
 import collectionStore from './collection'
@@ -24,6 +24,7 @@ import userStore from './user'
 import usersStore from './users'
 
 export { StoreContext, useInitStore, useStore } from './utils'
+export { useStoreContextBridge } from './bridge'
 
 const _ = themeStore
 
```

#### Recent Merged Pull Requests:
- **PR #412** (closed): feat: 将 unsigned IPA workflow 升级到 Expo 54 (@AvalonUltra)
- **PR #411** (2026-08-27): fix: 修复 IPA workflow 的 worklets 打包失败 (@AvalonUltra)
- **PR #398** (2026-07-27): 改正`buildVersion`类型，更新`alt_store.json`版本 (@BrandenXia)
- **PR #397** (2026-07-26): Update alt_store.json to 8.37.3 (@BrandenXia)
- **PR #395** (closed): [iOS] 使用系统原生底栏适配 Liquid Glass (@Souitou-iop)
- **PR #394** (closed): [iOS] 使用原生底栏适配 Liquid Glass (@Souitou-iop)
- **PR #392** (2026-07-08): 添加AltStore源相关说明 (@BrandenXia)
- **PR #390** (2026-07-07): 自动生成 `alt_store.json` 用于 altstore source (@BrandenXia)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
