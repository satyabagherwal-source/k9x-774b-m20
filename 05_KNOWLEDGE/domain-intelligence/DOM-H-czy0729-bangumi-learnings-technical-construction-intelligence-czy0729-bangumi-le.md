# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: czy0729-bangumi-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "czy0729-bangumi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T02:18:39.819Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-czy0729-bangumi-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [czy0729-bangumi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T02:18:39.819Z`  
> **Learning ID**: `LEARN-EVO-czy0729-bangumi-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence)
- **Confidence Rating**: 64%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from czy0729-bangumi-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/czy0729-bangumi-learnings.md`  
> **Source**: github ([https://github.com/czy0729/Bangumi](https://github.com/czy0729/Bangumi))  
> **Source Version**: `81c1e12a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T02:18:06.884Z  
> **Learning ID**: `learn-github-czy0729-bangumi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): czy0729/Bangumi

> **Canonical Artifact**: `07_PROJECT_LEARNING/czy0729-bangumi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/czy0729/Bangumi](https://github.com/czy0729/Bangumi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T02:18:06.878Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `czy0729/Bangumi`
- **Description**: :electron: An unofficial https://bgm.tv ui first app client for Android and iOS, built with React Native. 一个无广告、以爱好为驱动、不以盈利为目的、专门做 ACG 的类似豆瓣的追番记录，bgm.tv 第三方客户端。为移动端重新设计，内置大量加强的网页端难以实现的功能，且提供了相当的自定义选项。 目前已适配 iOS / Android。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 6270 stars

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
import { mapStringLeaves } from '@utils/utils'
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
  return mapStringLeaves(children, syncSpacing) as SpacingChild | SpacingChild[]
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
 * @Last Modified time: 2026-11-22 00:14:19
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { NavigationContext } from '@react-navigation/native'
import { _ } from '@stores'
import { isAnimationDisabled, scheduleOnRN, timing } from '@utils'
import { useBackHandler } from '@utils/hooks'

import type { ViewStyle } from 'react-native'

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

  /** 收起中 (关闭起点即为 true, 不等动画结束); 与 closingRef 双轨: state 驱动渲染, ref 做同步互斥 */
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)

  const navigation = useContext(NavigationContext)

  const calcHeight = Math.min(
    Math.floor(height * _.device(1, 1.4)) || Math.floor(_.window.height * 0.5),
    Math.floor(_.window.height * _.web(0.92, 0.88))
  )

  const animateTo = useCallback((toValue: number, callback?: () => void) => {
    progress.value = timing(
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
      setClosing(false)
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
    // 关闭起点同步提交触摸禁用: 若关闭动画途中发生 push, freezeOnBlur 会冻结本页 React 树,
    // 动画结束后的 setShow(false) (卸载) 会被推迟到解冻, 全屏遮罩以透明态残留并吃掉整个页面的触摸;
    // pointerEvents 在关闭起点 (尚未冻结时) 已落为 none, 残留遮罩不再拦截触摸 (仅 App 端生效)
    setClosing(true)
    animateTo(0, () => {
      // 收起途中被重新展开 (handleShow 已清掉标志) 时不再执行收起收尾, 避免刚展开又被卸载并误调 onClose
      if (!closingRef.current) return

      closingRef.current = false
      setClosing(false)
      setShow(false)
      onClose?.()
    })
  }, [animateTo, onClose, showValue])

  useEffect(() => {
    if (show) {
      // 兜底: 收起回调未执行时 closing 可能残留, 重新展开前复位, 否则面板会整层不可触摸
      setClosing(false)
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

  /** 系统关闭动画: 由调用方静态渲染, 不经过 reanimated */
  const disabled = isAnimationDisabled()
  const staticContentStyle: ViewStyle = {
    transform: [{ translateY: 0 }],
    backgroundColor: contentBg
  }
  const staticMaskStyle: ViewStyle = { opacity: 1 }

  return {
    /** 是否处于展示态 */
    showValue,

    /** 关闭并处理收起动画 */
    handleClose,

    /** 是否处于收起中 (关闭起点即为 true, 卸载前恒为 true) */
    closing,

    /** 计算内容高度（用于进出场位移） */
    calcHeight,

    /** 内容容器进出场动画样式 */
    contentStyle,

    /** 遮罩进出场动画样式 */
    maskStyle,

    /** 系统是否已关闭动画 */
    disabled,

    /** 关闭动画时的内容与遮罩样式 (静态终值) */
    staticContentStyle,
    staticMaskStyle
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #422** (2026-11-17): **passkey登录全流程文档**
  *Symptoms*: #419  https://github.com/Q16KBreak/Bangumi/tree/docs/passkey-docs/docs/passkey-login
  **Post-Mortem & Fix Analysis**:
  > 可以试试这个教程，看看哪里需要补充的
  > 我猜不行的大概是直接用了没单独授权的，迟点我会搬到语雀，还有给客户端加跳转连接，github 看会太慢

- **Issue #419** (2026-11-11): **- [登录] Passkey支持**
  *Symptoms*: fix #402
  **Post-Mortem & Fix Analysis**:
  > 虽然合并了，但是我手头并不能测，我在ai整理了代码后打包了，可以试试 https://czy0729.lanzoub.com/ij57K4fkiena 
  > > 虽然合并了，但是我手头并不能测，我在ai整理了代码后打包了，可以试试 https://czy0729.lanzoub.com/ij57K4fkiena  UI有点问题，功能没问题 <img width="1080" height="2400" alt="Screenshot_20261113-161003_Bangumi" src="https://github.com/user-attachments/assets/ec946e0b-1d46-49d4-b84a-8cf38f056890" /> 

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

### Incident Patch 1: `713001b7` (2026-11-19)
**Commit Message**: - [UI] 修复 iOS 回复面板与收藏弹窗透过毛玻璃显出灰底的问题，统一各处毛玻璃的明暗表现

**File**: `src/components/@/ds.ts` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-/*
- * @Author: czy0729
- * @Date: 2024-06-28 13:12:00
- * @Last Modified by: czy0729
- * @Last Modified time: 2026-03-17 06:22:29
- */
-import { Platform } from 'react-native'
-import Constants from 'expo-constants'
-
-const IOS = Platform.OS === 'ios'
-
-const IOS_IPA = Platform.OS === 'ios' && Constants.appOwnership !== 'expo'
-
-export const BLURVIEW_TINT_LIGHT = IOS && !IOS_IPA ? 'extraLight' : 'light'
-
-export const BLURVIEW_TINT_DARK = 'dark'
```

**File**: `src/components/blur-view/ds.ts` (modified, +1/-2)
```diff
@@ -6,13 +6,12 @@
  */
 import { rc } from '@utils/dev'
 import { IOS } from '@constants'
-import { IOS_IPA } from '@src/config'
 import { COMPONENT as PARENT } from '../ds'
 
 import type { Props } from './types'
 
 export const COMPONENT = rc(PARENT, 'BlurView')
 
-export const BLURVIEW_TINT_LIGHT = (IOS && !IOS_IPA ? 'extraLight' : 'light') as Props['tint']
+export const BLURVIEW_TINT_LIGHT = (IOS ? 'extraLight' : 'light') as Props['tint']
 
 export const BLURVIEW_TINT_DARK = 'dark' as Props['tint']
```

**File**: `src/components/fixed-textarea/container/index.tsx` (modified, +12/-7)
```diff
@@ -2,8 +2,11 @@
  * @Author: czy0729
  * @Date: 2023-08-01 19:19:14
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-09-10 00:33:48
+ * @Last Modified time: 2026-11-20 00:00:00
+ *
+ * iOS 面板底色由自身提供, 毛玻璃只负责模糊, 不依赖背后画面的明暗
  */
+import { StyleSheet, View } from 'react-native'
 import { observer } from 'mobx-react'
 import { BlurView } from 'expo-blur'
 import { _ } from '@stores'
@@ -19,13 +22,15 @@ function Container({ children }: Props) {
 
   if (IOS || WEB) {
     return (
-      <BlurView
-        style={styles.container}
-        tint={_.select(BLURVIEW_TINT_LIGHT, BLURVIEW_TINT_DARK)}
-        intensity={100}
-      >
+      <View style={[styles.container, styles.base]}>
+        <BlurView
+          style={StyleSheet.absoluteFill}
+          tint={_.select(BLURVIEW_TINT_LIGHT, BLURVIEW_TINT_DARK)}
+          intensity={100}
+          pointerEvents='none'
+        />
         {children}
-      </BlurView>
+      </View>
     )
   }
 
```

**File**: `src/components/fixed-textarea/container/styles.ts` (modified, +4/-1)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2023-08-01 19:19:30
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-03-30 01:26:42
+ * @Last Modified time: 2026-11-20 05:33:08
  */
 import { _ } from '@stores'
 
@@ -21,6 +21,9 @@ export const memoStyles = _.memoStyles(() => ({
     border: 0,
     borderRadius: 0
   },
+  base: {
+    backgroundColor: _.select('rgba(255, 255, 255, 0.64)', 'rgba(255, 255, 255, 0.08)')
+  },
   plain: {
     backgroundColor: _.select(_.colorPlain, _._colorDarkModeLevel1),
     borderTopWidth: _.select(_.hairlineWidth, 0),
```

**File**: `src/components/input/styles.main.ts` (modified, +4/-2)
```diff
@@ -2,21 +2,23 @@
  * @Author: czy0729
  * @Date: 2022-05-04 14:04:00
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-07-08 04:19:55
+ * @Last Modified time: 2026-11-20 05:28:36
  */
 import { _ } from '@stores'
 
 export const memoStyles = _.memoStyles(() => ({
   input: {
     fontFamily: _.fontBoldFamily,
+    borderWidth: _.select(_.hairlineWidth, 0),
+    borderColor: _.colorBorder,
     borderRadius: _.radiusXs
   },
   multiline: {
     width: '100%',
     paddingVertical: 8,
     paddingHorizontal: 12,
     backgroundColor: _.select(_.colorPlain, _._colorDarkModeLevel2),
-    borderWidth: _.select(1, 0),
+    borderWidth: _.select(_.hairlineWidth, 0),
     borderColor: _.colorBorder,
     borderRadius: _.radiusXs,
     overflow: 'hidden'
```

**File**: `src/components/toast/blur-view/ds.ts` (modified, +2/-7)
```diff
@@ -2,11 +2,6 @@
  * @Author: czy0729
  * @Date: 2024-07-09 08:00:36
  * @Last Modified by: czy0729
- * @Last Modified time: 2024-07-09 08:00:36
+ * @Last Modified time: 2026-11-20 05:09:40
  */
-import { IOS } from '@constants/env'
-import { IOS_IPA } from '@src/config'
-
-export const BLURVIEW_TINT_LIGHT = IOS && !IOS_IPA ? 'extraLight' : 'light'
-
-export const BLURVIEW_TINT_DARK = 'dark'
+export { BLURVIEW_TINT_DARK, BLURVIEW_TINT_LIGHT } from '../../blur-view/ds'
```

**File**: `src/screens/_/base/manage-modal/styles.ts` (modified, +3/-2)
```diff
@@ -2,15 +2,16 @@
  * @Author: czy0729
  * @Date: 2022-06-14 15:54:25
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-08-14 22:00:55
+ * @Last Modified time: 2026-11-20 05:29:51
  */
 import { _ } from '@stores'
 
 export const memoStyles = _.memoStyles(() => ({
   modal: {
     width: _.r(_.window.width - 2 * (_.wind - 4)),
     maxWidth: _.device(408, 560),
-    marginTop: _.isSmallDevice ? -24 : 0
+    marginTop: _.isSmallDevice ? -24 : 0,
+    backgroundColor: _.select('rgba(255, 255, 255, 0.64)', 'rgba(255, 255, 255, 0.08)')
   },
   container: {
     minHeight: _.device(380, 448),
```

**File**: `src/screens/_/base/manage-modal/submit/index.tsx` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2024-07-28 05:05:11
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-11-16 10:20:00
+ * @Last Modified time: 2026-11-20 05:24:10
  */
 import { observer } from 'mobx-react'
 import { Button, Flex, Iconfont } from '@components'
@@ -38,7 +38,7 @@ function Submit({
 
       <Button
         style={styles.privacy}
-        type={isPrivate ? 'ghostPlain' : 'ghostMain'}
+        type={isPrivate ? 'plain' : 'ghostMain'}
         extra={
           isPrivate && (
             <Iconfont style={_.ml.xs} name='md-visibility-off' color={_.colorSub} size={16} />
```

---

### Incident Patch 2: `9b049fcb` (2026-11-19)
**Commit Message**: - [UX] 统一登录与授权过期提示，失败时说明原因和下一步，设置说明与停用功能入口一并改成用户会说的词

**File**: `src/screens/_/base/folder-manage-modal/subjects/index.tsx` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ function Subjects({
       renderItem={handleRenderItem}
       footerNoMoreDataComponent={
         <Text style={_.mt.md} type={_.select('sub', 'icon')} size={12} align='center'>
-          - 到底了 -
+          - 到底啦 -
         </Text>
       }
     />
```

**File**: `src/screens/_/base/login-notice/index.tsx` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ export const LoginNotice = observer(() => {
           <Flex.Item>
             <Link style={styles.touch} path='LoginV2'>
               <Text type='sub' size={12} bold>
-                检测到授权信息过期，点击{i18n.login()}，或者下拉刷新试试
+                登录状态已过期，点击{i18n.login()}
               </Text>
             </Link>
           </Flex.Item>
```

**File**: `src/screens/_/base/manage-modal/utils.ts` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ export async function openCollection({
     if (result?.error && result?.error?.includes?.('token')) {
       // 提前告知授权信息失效
       const navigation = navigationReference()
-      const content = `获取收藏信息失败：${result.error}，授权信息可能过期了`
+      const content = '登录状态已过期，请重新登录'
       if (navigation) {
         confirm(
           content,
```

**File**: `src/screens/_/base/recommend-topic/index.tsx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export const RecommendTopic = observer(
     loading,
     data,
     iconSize = 11,
-    footerNoMoreText = '- 到底了 -',
+    footerNoMoreText = '- 到底啦 -',
     openWebBrowser = false,
     onShow,
     onHide,
```

**File**: `src/screens/_/item/post/icon-extra/index.tsx` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@ function IconExtra({
                   t('帖子.绝交')
                 },
                 () => {
-                  info('添加失败，可能授权信息过期')
+                  info('操作失败，或登录状态已过期')
                 }
               )
             }
```

**File**: `src/screens/discovery/catalog/component/list/index.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ function List() {
         <View style={styles.container}>
           {show &&
             (!!isLoaded && !list.length ? (
-              <Empty text='到底了' />
+              <Empty text='到底啦' />
             ) : (
               list
                 .filter(item => {
```

**File**: `src/screens/discovery/like/store/fetch.ts` (modified, +8/-11)
```diff
@@ -2,7 +2,7 @@
  * @Author: czy0729
  * @Date: 2024-11-11 10:06:26
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-10-15 12:00:00
+ * @Last Modified time: 2026-11-19 23:01:57
  *
  * 猜你喜欢数据请求
  */
@@ -31,16 +31,13 @@ export default class Fetch extends Computed {
     const data = await this.fetchCollectionsQueue()
     if (!data.length) {
       setTimeout(() => {
-        confirm(
-          '没有获取到任何该类型的收藏数据，可能是您的授权信息过期了，也有可能是服务崩了，尝试重新自动授权后再次获取？',
-          async () => {
-            await userStore.reOauth()
-
-            setTimeout(() => {
-              this.getList(true)
-            }, 0)
-          }
-        )
+        confirm('没有获取到收藏数据，可能登录状态已过期，是否重新登录后再试？', async () => {
+          await userStore.reOauth()
+
+          setTimeout(() => {
+            this.getList(true)
+          }, 0)
+        })
       }, 0)
       return false
     }
```

**File**: `src/screens/discovery/word-cloud/component/cavans/index.tsx` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ function Cavans() {
     return (
       <Flex style={styles.empty} justify='center'>
         <Text style={styles.transparent} type='__plain__' bold>
-          没有足够的数据，或者授权过期
+          没有足够的数据，或登录状态已过期
         </Text>
       </Flex>
     )
```

---

### Incident Patch 3: `b83ff7e7` (2026-11-19)
**Commit Message**: - [UX] 统一目录编辑与新建的操作体验，并收敛进度、时间胶囊等页面叫法，减少误操作和认知负担

**File**: `src/constants/data/index.ts` (modified, +1/-0)
```diff
@@ -14,5 +14,6 @@ export * from './menu'
 export * from './scroll'
 export * from './size'
 export * from './site'
+export * from './tab'
 export * from './time'
 export * from './timezone'
```

**File**: `src/constants/data/tab.ts` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+/*
+ * @Author: czy0729
+ * @Date: 2026-11-19
+ * @Last Modified by: czy0729
+ * @Last Modified time: 2026-11-19
+ *
+ * 底部 Tab 文案 (config 与 useDomTitle 共用)
+ */
+export const BOTTOM_TAB_LABEL = {
+  Discovery: '发现',
+  Timeline: '时间胶囊',
+  Home: '进度',
+  Rakuen: '超展开',
+  User: '时光机',
+  Tinygrail: '小圣杯'
+} as const
```

**File**: `src/navigations/tab-bar/config.ts` (modified, +10/-8)
```diff
@@ -2,11 +2,13 @@
  * @Author: czy0729
  * @Date: 2022-03-10 02:30:40
  * @Last Modified by: czy0729
- * @Last Modified time: 2025-11-13 12:20:42
+ * @Last Modified time: 2026-11-19 12:00:00
  */
 
+import { BOTTOM_TAB_LABEL } from '@constants/data/tab'
+
 /**
- * 底部 Tab 唯一配置源
+ * 底部 Tab 结构与顺序配置 (文案见 constants/data/tab)
  *  - 顺序即展示顺序 (bottom-tab-navigator 按此派生屏幕挂载)
  *  - fixed: true 不受 homeRenderTabs 设置控制, 恒显示
  */
@@ -15,42 +17,42 @@ export const BOTTOM_TABS = [
     name: 'Discovery',
     icon: 'home',
     size: 19,
-    label: '发现',
+    label: BOTTOM_TAB_LABEL.Discovery,
     fixed: false
   },
   {
     name: 'Timeline',
     icon: 'md-access-time',
     size: 21,
-    label: '时间胶囊',
+    label: BOTTOM_TAB_LABEL.Timeline,
     fixed: false
   },
   {
     name: 'Home',
     icon: 'md-star-outline',
     size: undefined,
-    label: '收藏',
+    label: BOTTOM_TAB_LABEL.Home,
     fixed: true
   },
   {
     name: 'Rakuen',
     icon: 'md-chat-bubble-outline',
     size: 19,
-    label: '超展开',
+    label: BOTTOM_TAB_LABEL.Rakuen,
     fixed: false
   },
   {
     name: 'User',
     icon: 'md-person-outline',
     size: undefined,
-    label: '时光机',
+    label: BOTTOM_TAB_LABEL.User,
     fixed: true
   },
   {
     name: 'Tinygrail',
     icon: 'trophy',
     size: 19,
-    label: '小圣杯',
+    label: BOTTOM_TAB_LABEL.Tinygrail,
     fixed: false
   }
 ] as const
```

**File**: `src/screens/_/base/folder-manage-modal/catalog/edit-form.tsx` (removed, +0/-46)
```diff
@@ -1,46 +0,0 @@
-/*
- * @Author: czy0729
- * @Date: 2026-11-02 14:00:00
- * @Last Modified by: czy0729
- * @Last Modified time: 2026-11-02 14:00:00
- *
- * 目录编辑表单 (标题 / 介绍 / 隐私)
- */
-import { View } from 'react-native'
-import { observer } from 'mobx-react'
-import { Input, Text, TextareaItem } from '@components'
-import { _ } from '@stores'
-import PrivacyRow from '../privacy'
-import { memoStyles } from './styles'
-
-import type { EditFormProps } from './types'
-
-function EditForm({ title, desc, privacy, onChange }: EditFormProps) {
-  const styles = memoStyles()
-
-  return (
-    <View style={_.mb.sm}>
-      <Text bold>编辑目录</Text>
-      <Input
-        style={styles.textarea}
-        defaultValue={title}
-        placeholder='输入标题'
-        showClear
-        onChangeText={text => onChange(text, 'title')}
-      />
-      <TextareaItem
-        style={styles.textarea}
-        defaultValue={desc}
-        placeholder='输入介绍'
-        placeholderTextColor={_.colorDisabled}
-        rows={4}
-        selectionColor={_.colorMain}
-        clear
-        onChange={text => onChange(text, 'desc')}
-      />
-      <PrivacyRow value={privacy} onChange={value => onChange(value, 'privacy')} />
-    </View>
-  )
-}
-
-export default observer(EditForm)
```

**File**: `src/screens/_/base/folder-manage-modal/catalog/index.tsx` (modified, +24/-66)
```diff
@@ -2,72 +2,50 @@
  * @Author: czy0729
  * @Date: 2023-03-07 16:06:36
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-11-02 04:00:00
+ * @Last Modified time: 2026-11-19 20:55:23
  */
-import { View } from 'react-native'
 import { observer } from 'mobx-react'
 import { Flex, Iconfont, Text, Touchable } from '@components'
 import { _ } from '@stores'
 import { CONTROL_DS } from '../ds'
 import { IconTouchable } from '../../../icon'
 import { Popover } from '../../popover'
 import { decodeContent } from '../utils'
-import EditForm from './edit-form'
-import { memoStyles } from './styles'
+import { styles } from './styles'
 
 import type { Props } from './types'
 
-function Catalog({
-  id,
-  expand,
-  create,
-  edit,
-  desc,
-  privacy,
-  item,
-  detail,
-  onChange,
-  onExpand,
-  onToggle,
-  onControl,
-  onCreate,
-  onSubmitCatalog
-}: Props) {
-  const styles = memoStyles()
+function Catalog({ id, expand, edit, item, detail, onExpand, onToggle, onControl }: Props) {
   const isIn = detail?.list?.some(i => i.id == id)
   const date = item.time?.split(' ')[0]?.replace('创建于:', '') || ''
 
   return (
-    <Flex style={styles.catalog}>
+    <Flex style={[styles.catalog, { padding: _.device(_.sm, _.md) }]}>
       <Flex.Item>
-        {create == item.id ? (
-          <EditForm title={item.title} desc={desc} privacy={privacy} onChange={onChange} />
-        ) : (
-          <Touchable onPress={() => onExpand(item)}>
-            <Flex>
-              <Text bold>
-                {item.title}
-                <Text size={11} lineHeight={14} type='sub' bold>
-                  {' '}
-                  ({detail.list.length})
-                </Text>
+        <Touchable onPress={() => onExpand(item)}>
+          <Flex>
+            <Text bold>
+              {item.title}
+              <Text size={11} lineHeight={14} type='sub' bold>
+                {' '}
+                ({detail.list.length})
               </Text>
-              <Iconfont
-                name={expand.includes(item.id) ? 'md-keyboard-arrow-down' : 'md-navigate-next'}
-                size={20}
-                lineHeight={24}
-              />
-            </Flex>
-            <Text style={_.mt.xs} type='sub' size={10} lineHeight={11} bold numberOfLines={2}>
-              {date}
-              {detail.content ? ' · ' : ''}
-              {decodeContent(detail.content)}
             </Text>
-          </Touchable>
-        )}
+            <Iconfont
+              name={expand.includes(item.id) ? 'md-keyboard-arrow-down' : 'md-navigate-next'}
+              size={20}
+              lineHeight={24}
+            />
+          </Flex>
+          <Text style={_.mt.xs} type='sub' size={10} lineHeight={11} bold numberOfLines={2}>
+            {date}
+            {detail.content ? ' · ' : ''}
+            {decodeContent(detail.content)}
+          </Text>
+        </Touchable>
       </Flex.Item>
       <Flex style={styles.control} justify='end'>
-        {!edit && !create && (
+        {!edit && (
           <>
             {!!id && (
               <IconTouchable
@@ -89,26 +67,6 @@ function Catalog({
             </Popover>
           </>
         )}
-        {item.id == create && (
-          <>
-            <View style={styles.cancel}>
-              <IconTouchable
-                name='md-close'
-                size={22}
-                color={_.colorSub}
-                onPress={() => onCreate(false)}
-              />
-            </View>
-            <View style={styles.submit}>
-              <IconTouchable
-                name='md-check'
-                size={22}
-                color={_.colorSub}
-                onPress={onSubmitCatalog}
-              />
-            </View>
-          </>
-        )}
       </Flex>
     </Flex>
   )
```

**File**: `src/screens/_/base/folder-manage-modal/catalog/styles.ts` (modified, +3/-28)
```diff
@@ -2,28 +2,15 @@
  * @Author: czy0729
  * @Date: 2023-03-07 16:11:36
  * @Last Modified by: czy0729
- * @Last Modified time: 2025-03-20 16:04:35
+ * @Last Modified time: 2026-11-19 20:25:43
  */
 import { _ } from '@stores'
 
-export const memoStyles = _.memoStyles(() => ({
+export const styles = _.create({
   catalog: {
-    padding: _.device(_.sm, _.md),
     paddingRight: 0,
     marginBottom: _.sm
   },
-  textarea: {
-    padding: _.sm,
-    marginTop: _.md,
-    marginBottom: -4,
-    color: _.colorDesc,
-    ..._.fontSize10,
-    backgroundColor: _.select(_.colorPlain, _._colorDarkModeLevel1),
-    borderWidth: 1,
-    borderColor: _.select(_.colorIcon, _.colorBorder),
-    borderRadius: _.radiusXs,
-    overflow: 'hidden'
-  },
   control: {
     minWidth: 48,
     height: '100%'
@@ -41,17 +28,5 @@ export const memoStyles = _.memoStyles(() => ({
   touch: {
     width: 38,
     height: 38
-  },
-  cancel: {
-    position: 'absolute',
-    zIndex: 1,
-    top: 0,
-    right: -4
-  },
-  submit: {
-    position: 'absolute',
-    zIndex: 1,
-    right: -4,
-    bottom: -4
   }
-}))
+})
```

**File**: `src/screens/_/base/folder-manage-modal/catalog/types.ts` (modified, +1/-24)
```diff
@@ -2,16 +2,13 @@
  * @Author: czy0729
  * @Date: 2025-03-20 14:36:47
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-03-19 16:48:51
+ * @Last Modified time: 2026-11-19 20:25:48
  */
 import type {
   CatalogDetail,
   CatalogsItem,
-  HandleChange,
   HandleControl,
-  HandleCreate,
   HandleExpand,
-  HandleSubmitCatalog,
   HandleToggle,
   Props as ComponentProps,
   State as ComponentState
@@ -20,30 +17,10 @@ import type {
 export type Props = {
   id: ComponentProps['id']
   expand: ComponentState['expand']
-  create: ComponentState['create']
   edit: ComponentState['edit']
-  desc: ComponentState['desc']
-  privacy: ComponentState['privacy']
   item: CatalogsItem
   detail: CatalogDetail
-  onChange: HandleChange
   onExpand: HandleExpand
   onToggle: HandleToggle
   onControl: HandleControl
-  onCreate: HandleCreate
-  onSubmitCatalog: HandleSubmitCatalog
-}
-
-/** 目录编辑表单参数 */
-export type EditFormProps = {
-  /** 目录标题 */
-  title: string
-
-  /** 目录介绍 */
-  desc: string
-
-  /** 隐私设置 */
-  privacy: ComponentState['privacy']
-
-  onChange: HandleChange
 }
```

**File**: `src/screens/_/base/folder-manage-modal/create/index.tsx` (modified, +26/-17)
```diff
@@ -2,15 +2,15 @@
  * @Author: czy0729
  * @Date: 2023-03-07 16:47:48
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-11-01 16:30:50
+ * @Last Modified time: 2026-11-19 10:00:00
  *
  * 目录表单
  */
 import { View } from 'react-native'
 import { observer } from 'mobx-react'
-import { Input, Text, TextareaItem } from '@components'
+import { Button, Flex, Input, Text, TextareaItem } from '@components'
 import { _ } from '@stores'
-import { IconTouchable } from '../../../icon'
+import { info } from '@utils'
 import PrivacyRow from '../privacy'
 import { memoStyles } from './styles'
 
@@ -28,13 +28,14 @@ function Create({
   onSubmitCatalog
 }: Props) {
   const styles = memoStyles()
+  const canSubmit = !!title && !!desc
 
   return (
     <View style={styles.create}>
       {showTitle && <Text bold>{titleText}</Text>}
       <Input
         style={styles.textarea}
-        defaultValue={title}
+        value={title}
         placeholder='输入标题'
         showClear
         onChangeText={text => onChange(text, 'title')}
@@ -52,19 +53,27 @@ function Create({
       {!!privacy && (
         <PrivacyRow value={privacy} onChange={value => onChange(value, 'privacy')} />
       )}
-      {showCancel && (
-        <View style={styles.cancel}>
-          <IconTouchable
-            name='md-close'
-            size={22}
-            color={_.colorSub}
-            onPress={() => onCreate(false)}
-          />
-        </View>
-      )}
-      <View style={styles.submit}>
-        <IconTouchable name='md-check' size={22} color={_.colorSub} onPress={onSubmitCatalog} />
-      </View>
+      <Flex style={_.mt.md}>
+        {showCancel && (
+          <Flex.Item style={_.mr.sm}>
+            <Button type='ghostPlain' onPress={() => onCreate(false)}>
+              取消
+            </Button>
+          </Flex.Item>
+        )}
+        <Flex.Item>
+          <Button
+            type={canSubmit ? 'main' : 'disabled'}
+            onPress={
+              canSubmit
+                ? onSubmitCatalog
+                : () => info(!title ? '请填写目录标题' : '请填写目录介绍')
+            }
+          >
+            确定
+          </Button>
+        </Flex.Item>
+      </Flex>
     </View>
   )
 }
```

#### Recent Merged Pull Requests:
- **PR #422** (2026-11-17): passkey登录全流程文档 (@Q16KBreak)
- **PR #419** (2026-11-11): - [登录] Passkey支持 (@Q16KBreak)
- **PR #412** (closed): feat: 将 unsigned IPA workflow 升级到 Expo 54 (@AvalonUltra)
- **PR #411** (2026-08-27): fix: 修复 IPA workflow 的 worklets 打包失败 (@AvalonUltra)
- **PR #398** (2026-07-27): 改正`buildVersion`类型，更新`alt_store.json`版本 (@BrandenXia)
- **PR #397** (2026-07-26): Update alt_store.json to 8.37.3 (@BrandenXia)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
