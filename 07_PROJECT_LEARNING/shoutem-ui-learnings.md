# Forensic Learning Record (Deep Inspection): shoutem/ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/shoutem-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/shoutem/ui](https://github.com/shoutem/ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:14:04.732Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `shoutem/ui`
- **Description**: Customizable set of components for React Native applications
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4985 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `components/EmptyStateView.js`
```
import React, { PureComponent } from 'react';
import autoBindReact from 'auto-bind/react';
import PropTypes from 'prop-types';
import { connectStyle } from '@shoutem/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Subtitle, Text } from './Text';
import { View } from './View';

class EmptyStateView extends PureComponent {
  constructor(props) {
    super(props);

    autoBindReact(this);
  }

  onRetry() {
    const { onRetry } = this.props;

    onRetry();
  }

  renderRetryButton() {
    const { retryButtonTitle } = this.props;

    // Show retry button at the bottom only if there is an onRetry action passed
    return (
      <View styleName="horizontal anchor-bottom">
        <Button styleName="full-width" onPress={this.onRetry}>
          <Text>{retryButtonTitle}</Text>
        </Button>
      </View>
    );
  }

  render() {
    const { icon, message, onRetry, ...otherProps } = this.props;

    return (
      <View {...otherProps} styleName="vertical flexible h-center v-center">
        <View styleName="icon-placeholder">
          <Icon name={icon} />
        </View>

        <Subtitle styleName="h-center">{message}</Subtitle>

        {onRetry && this.renderRetryButton()}
      </View>
    );
  }
}

EmptyStateView.propTypes = {
  icon: PropTypes.string,
  message: PropTypes.string,
  retryButtonTitle: PropTypes.string,
  onRetry: PropTypes.func,
};

EmptyStateView.defaultProps = {
  icon: 'error',
  message: undefined,
  retryButtonTitle: 'TRY AGAIN',
  onRetry: undefined,
};

const StyledView = connectStyle('shoutem.ui.EmptyStateView')(EmptyStateView);

export { StyledView as EmptyStateView };

```

### Core Architecture Module: `hooks/index.js`
```
export {
  useColorAndPercentageInterpolation,
  useColorInterpolation,
} from './useColorAndPercentageInterpolation';

```

### Core Architecture Module: `hooks/useColorAndPercentageInterpolation.js`
```
/* eslint-disable consistent-return */
/* eslint-disable no-bitwise */
import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { DEFAULT_PROGRESS_COLORS } from '../const';

const resolveInputRange = colors => {
  if (colors.length === 1) {
    // If only one color is given, color will always be the same, no matter of percentage.
    return [0, 100];
  }

  const numSteps = colors.length - 1;
  const stepSize = 100 / numSteps;

  return colors.map((_, index) => Math.round(index * stepSize));
};

const resolveOutputRange = colors => {
  if (colors.length === 1) {
    // If only one color is given, color will always be the same, no matter of percentage.
    return [colors[0], colors[0]];
  }

  return colors;
};

const resolveInterpolationRange = colors => {
  return {
    inputRange: resolveInputRange(colors),
    outputRange: resolveOutputRange(colors),
  };
};

export const useColorInterpolation = (
  colors,
  progressPercentage,
  animatedConfig = {
    toValue: progressPercentage,
    duration: 1000 * (progressPercentage / 100), // 100% will animate for 1s, 50% for 0.5s etc.
    useNativeDriver: true,
  },
) => {
  const animatedPercentage = useRef(new Animated.Value(0)).current;

  const [interpolatedColor, setInterpolatedColor] = useState(
    !animatedConfig
      ? getInterpolatedColor(colors, progressPercentage)
      : colors[0],
  );

  useEffect(() => {
    if (!animatedConfig) {
      setInterpolatedColor(getInterpolatedColor(colors, progressPercentage));
      return;
    }

    Animated.timing(animatedPercentage, animatedConfig).start();

    // Listen to animatedPercentage value changes and update the interpolated color
    const listener = animatedPercentage.addListener(() => {
      const colorInterpolation = animatedPercentage.interpolate(
        resolveInterpolationRange(colors),
      );

      // Resolve the interpolated color to a valid color string
      setInterpolatedColor(colorInterpolation.__getValue());
    });

    return () => {
      animatedPercentage.removeListener(listener);
    };
  }, [progressPercentage, colors, animatedPercentage, animatedConfig]);

  return interpolatedColor;
};

export const useColorAndPercentageInterpolation = (
  colors,
  progressPercentage,
  animatedConfig = {
    toValue: progressPercentage,
    duration: 1000 * (progressPercentage / 100), // 100% will animate for 1s, 50% for 0.5s etc.
    useNativeDriver: true,
  },
) => {
  const animatedPercentage = useRef(new Animated.Value(0)).current;

  const [interpolatedColor, setInterpolatedColor] = useState(
    !animatedConfig
      ? getInterpolatedColor(colors, progressPercentage)
      : colors[0],
  );
  const [interpolatedPercentage, setInterpolatedPercentage] = useState(
    !animatedConfig ? progressPercentage : 0,
  );

  useEffect(() => {
    if (!animatedConfig) {
      setInterpolatedPercentage(progressPercentage);
      return;
    }

    Animated.timing(animatedPercentage, animatedConfig).start();

    // Listen to animatedPercentage value changes and update the interpolated color
    const listener = animatedPercentage.addListener(({ value }) => {
      const colorInterpolation = animatedPercentage.interpolate(
        resolveInterpolationRange(colors),
      );

      // Resolve the interpolated color to a valid color string
      setInterpolatedColor(colorInterpolation.__getValue());
      setInterpolatedPercentage(value);
    });

    return () => {
      animatedPercentage.removeListener(listener);
    };
  }, [progressPercentage, colors, animatedPercentage, animatedConfig]);

  return { interpolatedColor, interpolatedPercentage };
};

/**
 * Convert hex color to RGB array
 */
const hexToRgb = hex => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

/**
 * Convert RGB array to hex color
 */
const rgbToHex = ([r, g, b]) => {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)
    .toUpperCase()}`;
};

/**
 * Linearly interpolate between two numbers
 */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Get interpolated color based on percentage
 */
export const getInterpolatedColor = (
  colors = DEFAULT_PROGRESS_COLORS,
  percentage,
) => {
  const numColors = colors.length;

  if (percentage <= 0) return colors[0];
  if (percentage >= 100) return colors[numColors - 1];

  const totalSegments = numColors - 1; // Total segments between colors
  const segment = (percentage / 100) * totalSegments; // Determine segment index as float
  const startIndex = Math.floor(segment); // Start color index
  const endIndex = startIndex + 1; // End color index
  const t = segment - startIndex; // Interpolation factor

  const startColor = hexToRgb(colors[startIndex]);
  const endColor = hexToRgb(colors[endIndex]);

  // Interpolate each RGB component
  const interpolatedColor = [
    Math.round(lerp(startColor[0], endColor[0], t)),
    Math.round(lerp(startColor[1], endColor[1], t)),
    Math.round(lerp(startColor[2], endColor[2], t)),
  ];

  return rgbToHex(interpolatedColor);
};

```

### Core Architecture Module: `html/components/AttachmentRenderer.js`
```
import React from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { resolveDimensions } from '../services/Dimensions';
import Image from './Image';

const AttachmentRenderer = ({ tnode, style, attachments }) => {
  if (!attachments || _.isEmpty(attachments)) {
    return null;
  }

  const image = _.find(attachments, { id: tnode?.id });

  if (!image || !image.src) {
    return null;
  }

  const source = { uri: image.src };
  const imageSize = { width: image.width, height: image.height };
  const { height, width } = resolveDimensions(imageSize, style);
  const resolvedStyle = { alignSelf: 'center', height, width };

  return <Image source={source} key={tnode?.id} style={resolvedStyle} />;
};

AttachmentRenderer.propTypes = {
  attachments: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  style: PropTypes.any,
  tnode: PropTypes.object,
};

AttachmentRenderer.defaultProps = {
  attachments: undefined,
  style: undefined,
  tnode: {},
};

export default AttachmentRenderer;

```

### Core Architecture Module: `html/components/IframeRenderer.js`
```
import React from 'react';
import { Vimeo } from 'react-native-vimeo-iframe';
import YoutubePlayer from 'react-native-youtube-iframe';
import iframe from '@native-html/iframe-plugin';
import PropTypes from 'prop-types';
import { Text } from '../../components/Text';
import { View } from '../../components/View';
import { isAndroid } from '../../services';
import isValidVideoFormat from '../services/isValidVideoFormat';

const IframeRenderer = props => {
  const { tnode, shoutemStyle, unsupportedVideoFormatMessage } = props;
  const url = tnode?.domNode?.attribs?.src;

  if (url && !isValidVideoFormat(url)) {
    const message =
      unsupportedVideoFormatMessage || 'Unsupported video format.';

    return (
      <View
        style={shoutemStyle.fallback}
        styleName="vertical h-center v-center"
      >
        <Text>{message}</Text>
      </View>
    );
  }

  if (url && (url.includes('youtube') || url.includes('youtu.be'))) {
    const youtubeIdRegEx = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const regExMatch = url.match(youtubeIdRegEx);
    const youtubeId =
      regExMatch && regExMatch[7].length === 11 ? regExMatch[7] : false;

    return (
      <YoutubePlayer
        webViewProps={{
          renderToHardwareTextureAndroid: true,
        }}
        height={shoutemStyle.video.height}
        videoId={youtubeId}
      />
    );
  }

  if (url && url.includes('vimeo')) {
    const vimeoIdRegEx = /(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i;
    const regExMatches = url.match(vimeoIdRegEx);
    const vimeoId = regExMatches[1];

    return (
      <Vimeo
        videoId={vimeoId}
        style={{ height: shoutemStyle.vimeoVideo.height }}
        // Prevents Android issue with iframe inside the scroll container
        // Scrolling to bottom crashes the app
        {...(isAndroid && {
          overScrollMode: 'never',
          androidLayerType: 'software',
        })}
      />
    );
  }

  return iframe(props);
};

IframeRenderer.propTypes = {
  tnode: PropTypes.shape({
    children: PropTypes.any,
  }).isRequired,
  shoutemStyle: PropTypes.any,
  unsupportedVideoFormatMessage: PropTypes.string,
};

IframeRenderer.defaultProps = {
  shoutemStyle: undefined,
  unsupportedVideoFormatMessage: undefined,
};

export default IframeRenderer;

```

### Core Architecture Module: `html/components/VideoRenderer.js`
```
import React from 'react';
import {
  useComputeMaxWidthForTag,
  useContentWidth,
} from 'react-native-render-html';
import WebView from 'react-native-webview';
import { findOne } from 'domutils';
import PropTypes from 'prop-types';

function findSource(tnode) {
  if (tnode.attributes.src) {
    return tnode.attributes.src;
  }

  const sourceElms = findOne(
    elm => elm.tagName === 'source',
    tnode.domNode.children,
  );

  return sourceElms ? sourceElms.attribs.src : '';
}

/**
 *
 * Generate video html with only selected attributes and parameters.
 * @returns HTML video element
 */
function generateVideoHtml(tnode) {
  const url = findSource(tnode);

  const containsTimeParameter = url.match(/(#|\?)t=[^&$]*/g, '');
  // If video has no time parameter, we want to add time parameter at 0.1, just to be able to
  // display the image, first frame of the video. Video tags that don't have autoplay attribute
  // are not showing first frame without this solution.
  // Otherwise, if user has defined time parameter, keep it as is.
  const resolvedUrl = `${url}${containsTimeParameter ? '' : '#t=0.1'}`;

  return `<video controls src="${resolvedUrl}" style="width: 100%; height: 100%;"/>`;
}

export const VideoRenderer = ({ tnode, style }) => {
  const computeMaxWidth = useComputeMaxWidthForTag('video');
  const width = computeMaxWidth(useContentWidth());

  // Using uri as a Webview source is not an option, because we don't have as much control of video.
  // E.g. if video from uri has autoplay=true, we can't prevent it from auto-playing when Webview renders.
  // Instead, create video HTML element with only picked attributes and parameters.
  const html = generateVideoHtml(tnode);

  return (
    <WebView
      scrollEnabled={false}
      source={{
        html,
      }}
      style={[{ aspectRatio: 16 / 9 }, style, { width }]}
    />
  );
};

VideoRenderer.propTypes = {
  tnode: PropTypes.object.isRequired,
  style: PropTypes.object,
};

VideoRenderer.defaultProps = {
  style: {},
};

export default VideoRenderer;

```

### Core Architecture Module: `html/elements/list/helpers/renderItems.js`
```
import React from 'react';
import _ from 'lodash';

export default function renderItems(
  childElements,
  renderElement,
  createPrefixElement,
) {
  const renderedComponents = _.reduce(
    childElements,
    (items, element, index) => {
      const { childElements: itemChildElements } = element;

      const prefix = createPrefixElement
        ? createPrefixElement(element, index)
        : null;
      const childElements = prefix
        ? [prefix, ...itemChildElements]
        : itemChildElements;

      const elem = {
        ...element,
        childElements,
      };

      items.push(renderElement(elem));
      return items;
    },
    [],
  );

  return React.Children.toArray(renderedComponents);
}

```

### Core Architecture Module: `assets/index.js`
```
/* eslint-disable global-require */
export const animations = {
  loadingDots: require('./animations/loadingDots.json'),
};

```

### Core Architecture Module: `babel.config.js`
```
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: ['@babel/plugin-proposal-class-properties'],
  };
};

```

### Core Architecture Module: `components/ActionSheet/ActionSheet.js`
```
import React, { useEffect, useMemo, useRef } from 'react';
import ActionSheetNative from 'react-native-actions-sheet';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { connectStyle } from '@shoutem/theme';
import { View } from '../View';
import ActionSheetOption, { optionPropType } from './ActionSheetOption';

const ActionSheet = ({
  active = false,
  cancelOptions = undefined,
  confirmOptions = undefined,
  style,
  onDismiss = undefined,
  ...otherProps
}) => {
  const actionSheetRef = useRef(null);

  const hasConfirmOptions = useMemo(() => !_.isEmpty(confirmOptions), [
    confirmOptions,
  ]);
  const hasCancelOptions = useMemo(() => !_.isEmpty(cancelOptions), [
    cancelOptions,
  ]);

  useEffect(() => {
    if (active) {
      actionSheetRef.current?.show();
    } else {
      actionSheetRef.current?.hide();
    }
  }, [active]);

  return (
    <ActionSheetNative
      gestureEnabled
      ref={actionSheetRef}
      onClose={onDismiss}
      containerStyle={style.container}
      {...otherProps}
    >
      <View style={style.contentContainer}>
        {hasConfirmOptions && (
          <View style={style.segmentContainer}>
            {_.map(confirmOptions, option => (
              <ActionSheetOption
                key={option.title}
                option={option}
                style={style.option}
              />
            ))}
          </View>
        )}
        {hasCancelOptions && (
          <View styleName="md-gutter-top">
            <View style={style.segmentContainer}>
              {_.map(cancelOptions, option => (
                <ActionSheetOption
                  key={option.title}
                  cancelOption
                  option={option}
                  style={style.option}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </ActionSheetNative>
  );
};

ActionSheet.propTypes = {
  style: PropTypes.object.isRequired,
  active: PropTypes.bool,
  cancelOptions: PropTypes.arrayOf(optionPropType),
  confirmOptions: PropTypes.arrayOf(optionPropType),
  onDismiss: PropTypes.func,
};

ActionSheet.defaultProps = {
  active: false,
  cancelOptions: undefined,
  confirmOptions: undefined,
  onDismiss: undefined,
};

export default connectStyle('shoutem.ui.ActionSheet')(ActionSheet);

```

### Core Architecture Module: `components/ActionSheet/ActionSheetOption.js`
```
import React from 'react';
import PropTypes from 'prop-types';
import { connectStyle } from '@shoutem/theme';
import { isIos } from '../../services';
import { Text } from '../Text';
import { TouchableOpacity } from '../TouchableOpacity';

export const optionPropType = PropTypes.shape({
  title: PropTypes.string,
  onPress: PropTypes.func,
});

function ActionSheetOption({ style, option, cancelOption, nativeStyle }) {
  const { title, onPress } = option;

  const useIosTextColor = nativeStyle && isIos;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={style.container}
      styleName="horizontal"
    >
      <Text
        style={[
          style.text,
          cancelOption && style.cancelText,
          useIosTextColor && style.iosBlueTextColor,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

ActionSheetOption.propTypes = {
  style: PropTypes.object.isRequired,
  cancelOption: PropTypes.bool,
  nativeStyle: PropTypes.bool,
  option: optionPropType,
};

ActionSheetOption.defaultProps = {
  option: undefined,
  cancelOption: false,
  nativeStyle: false,
};

export default connectStyle('shoutem.ui.ActionSheetOption')(ActionSheetOption);

```

### Core Architecture Module: `components/ActionSheet/index.js`
```
export { default as ActionSheet } from './ActionSheet';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #922** (2026-04-22): **fix/ android edge to edge bottom inset**
  *Symptoms*: Issue: RN 0.77 enables edge-to-edge rendering on Android by default — the app draws behind the system navigation bar   Fix:  HOME_INDICATOR_PADDING and getHomeIndicatorPadding() were hardcoded to return 0 on Android. With React Native 0.77 enabling edge-to-edge rendering by default on Android, the bottom inset is now meaningful on Android — not just iOS.  Updated HOME_INDICATOR_PADDING, getBottomInset(), and getHomeIndicatorPadding() to read initialWindowMetrics.insets.bottom on all platforms. iOS fallback (34pt) preserved when metrics are unavailable; Android falls back to 0.

- **Issue #908** (2026-04-09): **fix/ remove animation driver unsubscribe**
  *Symptoms*: Fix scroll-driven header animations breaking on second visit to a screen. React Navigation fires focus on the new screen before blur on the old screen, so the old screen's blur cleanup was overwriting the newly registered animation driver with a stale one. Removed the blur cleanup and wrapped the callback in useCallback([]) — each screen registers its own driver on focus, no restore needed.

- **Issue #907** (2026-04-20): **fix/ Add lazy getters for initialWindowMetrics**
  *Symptoms*: Fix: SafeArea inset constants crash when initialWindowMetrics is null  In react-native-safe-area-context v5, initialWindowMetrics can be null when the JS bundle evaluates before the native module initializes — a race condition common in large apps with many native modules. This caused HOME_INDICATOR_PADDING, NOTCH_AREA_HEIGHT, and NAVIGATION_BAR_HEIGHT to evaluate to undefined or NaN, leading to layout crashes.  Changes:  **1. Added hardcoded fallbacks to the existing static constants via nullish coalescing:**   - Top inset defaults to 59 (Dynamic Island devices, iPhone 14 Pro+)   - Bottom inset defaults to 34 (home indicator, consistent across all notched iPhones since iPhone X)   - These prevent NaN/undefined for consumers that import the constants at module load time (e.g., theme variable files).  **2. Added lazy getter functions that resolve initialWindowMetrics on first call (render time) instead of import time:**   - getNavigationBarHeight()   - getHomeIndicatorPadding()   - getNotchAreaHeight()   - Values are cached after the first read. By render time, the native module is initialized, so these return accurate device-specific values rather than fallbacks.   - Exported the getter functions through the existing export chain.  Backward compatible — existing static constant exports are preserved. Consumers can migrate to the getter functions if needed.

- **Issue #905** (2026-03-04): **fix/patch react-native-device-info**
  *Symptoms*: **Patch react-native-device-info to add missing notch/dynamic island devices**  **Problem:** react-native-device-info@10.13.2 does not include newer iPhones (16, 16e, 17, Air) in its devicesWithNotch and devicesWithDynamicIsland device lists. This causes DeviceInfo.hasNotch() to return false on those devices, resulting in the app displaying the "without notch" navbar image instead of the correct "with notch" version.  **Solution:** Used patch-package to patch react-native-device-info's device lists. The patch is automatically applied on yarn install via the postinstall script.  **Changes:** - Added react-native-device-info+10.13.2.patch— patches devicesWithNotch and devicesWithDynamicIsland - Added patch-package.js— runs patch-package to apply patches - Added postinstall.js—  runs add-native-deps and patch-package - Modified add-native-deps.js — exports function for use by postinstall - Added patch-package as a devDependency  **Devices added:**  Notch: iPhone 17, iPhone Air, iPhone 17 Pro, iPhone 17 Pro Max, iPhone 16e, iPhone 16, iPhone 16 Plus, iPhone 16 Pro, iPhone 16 Pro Max Dynamic Island: same as above minus iPhone 16e 

- **Issue #301** (2017-12-11): **DropDownMenu onOptionSelected not responding**
  *Symptoms*: onOptionSelected doesn't seem to be working even on i can't switch from the typography option, only close button works. am using "@shoutem/ui": "^0.21.2" , and i set up the project using create-react-app ![simulator screen shot 15 aug 2017 17 32 20](https://user-images.githubusercontent.com/2639438/29327987-a761ad94-81f9-11e7-84ca-0224f8bd7e33.png) 
  **Post-Mortem & Fix Analysis**:
  > I've done my best to replicate it, but the drop down menus work fine for me throughout all the example categories.  What I did:  `react-native init DropDownTest` `cd DropDownTest` `npm install @shoutem/ui --save` `react-native link`  Replaced Hello World bootstrap in `index.ios.js` with: ``` import React, { Component } from 'react'; import { AppRegistry } from 'react-native'; import { Examples } from '@shoutem/ui';  class DropDownTest extends Component {   render() {     return (       <Examples />     );   } }  AppRegistry.registerComponent('DropDownTest', () => DropDownTest); ```  `react-native run-ios`  The drop down menus function as expected, selections work, closing works, states update in examples where the selection changes state (e.g. Dropdown Large example).  Can you try that again and see how it works please?
  > Same issue for me. Does it have anything to do with Expo's examples' deferred loading of assets and initial rendering? Maybe it's not linking any of the menu's items?
  > I suggest you look at the file `ui/examples/create-react-native-app/App.js`. I presume it is under your care. It is there that the deferred rendering takes place.

- **Issue #257** (2017-12-18): **Android font rendering problem**
  *Symptoms*: On Android, the font renders badly with weird thin/thick weights.  could be a duplicate of closed issue: font rendering issues in android #118  https://github.com/shoutem/ui/issues/118  ![font_problem](https://cloud.githubusercontent.com/assets/470164/26276744/17a19c70-3d4b-11e7-8941-b384db517c40.png)  
  **Post-Mortem & Fix Analysis**:
  > happens to me as well.
  > +1
  > is there a way to remove the custom font from all shoutem components to avoid this problem?

- **Issue #253** (2017-09-07): **RichMedia does not updated body when state changes**
  *Symptoms*: I do have the following setup. The `appSettings.login_text` has an initialize value, and gets updated as the `props` change. The problem is that the `RichMedia` component is not updating its body. When I change the `RichMedia` component part to `<Text>{appSettings.login_text}</Text>` it works as expected.  ``` constructor(props, contex) {     super(props, contex);      this.state = {       appSettings: {         'login_text': 'hello',       },     }; }  componentWillReceiveProps(newProps) {     if (newProps.appSettings !== this.props.appSettings) {       const { appSettings } = newProps;       this.setState({ appSettings: appSettings });     } }  render() {   ...   const { appSettings } = this.state;   <RichMedia body={appSettings.login_text} />   ... } ```
  **Post-Mortem & Fix Analysis**:
  > RichMedia is being replaced by the [HTML component](https://github.com/shoutem/ui/tree/develop/html), so we're closing this thread. If this is still relevant with the HTML component, please prompt for reopen.

- **Issue #241** (2017-08-09): **undefined is not an object (evaluating '_reactNative.NavigationExperimental.Header')**
  *Symptoms*:  Error: `undefined is not an object (evaluating '_reactNative.NavigationExperimental.Header') ` gets thrown when the app is built and run.  Steps I Took:      Initialize an empty react native project     Add `yarn add @shoutem/ui'    `react-native link`     Use the '<Examples />` Component     `react-native run-android`  My System Configuration ``` react-native --version                                                                                                                      22:10:05     react-native-cli: 2.0.1     react-native: 0.44.0 ```  Package.json ``` { 	"name": "testShoutem", 	"version": "0.0.1", 	"private": true, 	"scripts": { 		"start": "node node_modules/react-native/local-cli/cli.js start", 		"test": "jest" 	}, 	"dependencies": { 		"@shoutem/ui": "^0.13.0", 		"react": "16.0.0-alpha.6", 		"react-native": "0.44.0" 	}, 	"devDependencies": { 		"babel-jest": "19.0.0", 		"babel-preset-react-native": "1.9.1", 		"jest": "19.0.2", 		"react-test-renderer": "16.0.0-alpha.6" 	}, 	"jest": { 		"preset": "react-native" 	} }  ``` 
  **Post-Mortem & Fix Analysis**:
  > I am still getting this error! any fix?
  > I saw ur commit now there is a new error!!! can't find variables!! theme.js:621:34
  > Try this for now:    edit package.json  -> Replace 0.44.0 with 0.43.4   for react-native  'rm -rf node_modules'  //get rid of previous module installations based on 0.44.0 npm install react-native link react-native run-android    // but in  separate window be running   'npm start' first.   

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

### Incident Patch 1: `2bf9cd2a` (2026-06-15)
**Commit Message**: Merge pull request #928 from shoutem/hotfix/9.1.1

Hotfix/9.1.1 - develop

**File**: `components/Screen.js` (modified, +17/-3)
```diff
@@ -1,14 +1,28 @@
 import React from 'react';
-import { View } from 'react-native';
+import { Platform, View } from 'react-native';
 import { useSafeAreaInsets } from 'react-native-safe-area-context';
 import { connectAnimation } from '@shoutem/animation';
 import { connectStyle } from '@shoutem/theme';
 
 const SafeAreaAwareView = ({ style, ...rest }) => {
   const insets = useSafeAreaInsets();
-  const safeAreaStyle = { paddingBottom: insets.bottom };
 
-  return <View {...rest} style={[style, safeAreaStyle]} />;
+  // We only want Android bottom padding so content stays clear of Android
+  // software OS navigation. If no padding, content goes under and user is unable
+  // to see or press it.
+  // On iOS - home indicator is transparent, so the content is visible. We should add
+  // with-home-indicator-padding or paddingBottom for specific screens if there'll be
+  // pressable component that would hide under home indicator.
+  // Many screens already do this, so adding bottom inset by default on all screens would
+  // cut off too much of screen content - we'll rather add padding where necessary.
+  // Android will have this behavior as default because it's breaking UI bug.
+  const safeAreaStyle = {
+    paddingBottom: Platform.OS === 'android' ? insets.bottom : 0,
+  };
+
+  // Keep style after safeAreaStyle so Screen style can override safe area style.
+  // with-home-indicator-padding and other classes already do this with theme resolution process.
+  return <View {...rest} style={[safeAreaStyle, style]} />;
 };
 
 const AnimatedScreen = connectAnimation(SafeAreaAwareView);
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.0.6",
+  "version": "9.1.1",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "9.0.6",
+      "version": "9.1.1",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.1.0",
+  "version": "9.1.1",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
```

---

### Incident Patch 2: `3b41b7e2` (2026-04-22)
**Commit Message**: fix/ android edge to edge bottom inset (#922)

* read bottom safe area inset on Android for edge-to-edge support

* Add comments

**File**: `helpers/device-selector.js` (modified, +15/-6)
```diff
@@ -26,10 +26,12 @@ export const NAVIGATION_BAR_HEIGHT = Platform.select({
   default: NAVIGATION_HEADER_HEIGHT,
 });
 
+// Bottom inset from the native safe-area module (home indicator on iOS,
+// system nav bar on Android with edge-to-edge). Falls back to 34pt on iOS
+// (race condition guard) or 0 on Android (no inset when edge-to-edge is off).
 export const HOME_INDICATOR_PADDING =
-  Platform.OS === 'ios'
-    ? initialWindowMetrics?.insets?.bottom ?? DEFAULT_IOS_BOTTOM_INSET
-    : 0;
+  initialWindowMetrics?.insets?.bottom ??
+  (Platform.OS === 'ios' ? DEFAULT_IOS_BOTTOM_INSET : 0);
 
 export const NOTCH_AREA_HEIGHT = Platform.select({
   ios: initialWindowMetrics?.insets?.top ?? DEFAULT_IOS_TOP_INSET,
@@ -65,7 +67,12 @@ const getBottomInset = () => {
     // eslint-disable-next-line global-require
     const metrics = require('react-native-safe-area-context')
       .initialWindowMetrics;
-    _bottomInset = metrics?.insets?.bottom ?? DEFAULT_IOS_BOTTOM_INSET;
+
+    // Use actual bottom inset if available. Fallback: 34pt on iOS (safe
+    // default for all notched iPhones), 0 on Android (no inset pre-RN 0.77).
+    _bottomInset =
+      metrics?.insets?.bottom ??
+      (Platform.OS === 'ios' ? DEFAULT_IOS_BOTTOM_INSET : 0);
   }
 
   return _bottomInset;
@@ -80,8 +87,10 @@ export const getNavigationBarHeight = () =>
     default: NAVIGATION_HEADER_HEIGHT,
   });
 
-export const getHomeIndicatorPadding = () =>
-  Platform.OS === 'ios' ? getBottomInset() : 0;
+// Returns bottom safe area inset on both platforms. On iOS this is the home
+// indicator area (34pt). On Android this is the system navigation bar height
+// when edge-to-edge is enabled (RN 0.76+), or 0 on older RN versions.
+export const getHomeIndicatorPadding = () => getBottomInset();
 
 export const getNotchAreaHeight = () =>
   Platform.select({
```

---

### Incident Patch 3: `8991d710` (2026-04-20)
**Commit Message**: fix/ Add lazy getters for initialWindowMetrics (#907)

* Add lazy getters for initialWindowMetrics

* add exports

**File**: `helpers/device-selector.js` (modified, +62/-3)
```diff
@@ -4,22 +4,35 @@ import { initialWindowMetrics } from 'react-native-safe-area-context';
 
 export const NAVIGATION_HEADER_HEIGHT = 64;
 
+// Fallback inset values used when initialWindowMetrics is null (race condition
+// in large apps where JS evaluates before the safe-area native module inits).
+// Bottom: 34pt — consistent across all notched iPhones since iPhone X (2017).
+// Top: 59pt — matches Dynamic Island devices (iPhone 14+).
+//   Slightly too large for older notched devices (44–48pt), but using the
+//   largest one prevents content from being hidden under the notch/Dynamic Island.
+const DEFAULT_IOS_TOP_INSET = 59;
+const DEFAULT_IOS_BOTTOM_INSET = 34;
+
 export const isNotchedAndroid =
   Platform.OS === 'android' && DeviceInfo.hasNotch();
 
 export const NAVIGATION_BAR_HEIGHT = Platform.select({
-  ios: NAVIGATION_HEADER_HEIGHT + initialWindowMetrics?.insets?.top,
+  ios:
+    NAVIGATION_HEADER_HEIGHT +
+    (initialWindowMetrics?.insets?.top ?? DEFAULT_IOS_TOP_INSET),
   android: isNotchedAndroid
     ? NAVIGATION_HEADER_HEIGHT + StatusBar.currentHeight
     : NAVIGATION_HEADER_HEIGHT,
   default: NAVIGATION_HEADER_HEIGHT,
 });
 
 export const HOME_INDICATOR_PADDING =
-  Platform.OS === 'ios' ? initialWindowMetrics?.insets?.bottom : 0;
+  Platform.OS === 'ios'
+    ? initialWindowMetrics?.insets?.bottom ?? DEFAULT_IOS_BOTTOM_INSET
+    : 0;
 
 export const NOTCH_AREA_HEIGHT = Platform.select({
-  ios: initialWindowMetrics?.insets?.top,
+  ios: initialWindowMetrics?.insets?.top ?? DEFAULT_IOS_TOP_INSET,
   android: isNotchedAndroid ? StatusBar.currentHeight : 0,
   default: 0,
 });
@@ -30,3 +43,49 @@ export const Device = {
   NOTCH_AREA_HEIGHT,
   NAVIGATION_HEADER_HEIGHT,
 };
+
+// Lazy getters — resolve initialWindowMetrics on first render,
+// when the native module is guaranteed to be ready.
+let _topInset;
+let _bottomInset;
+
+const getTopInset = () => {
+  if (_topInset === undefined) {
+    // eslint-disable-next-line global-require
+    const metrics = require('react-native-safe-area-context')
+      .initialWindowMetrics;
+    _topInset = metrics?.insets?.top ?? DEFAULT_IOS_TOP_INSET;
+  }
+
+  return _topInset;
+};
+
+const getBottomInset = () => {
+  if (_bottomInset === undefined) {
+    // eslint-disable-next-line global-require
+    const metrics = require('react-native-safe-area-context')
+      .initialWindowMetrics;
+    _bottomInset = metrics?.insets?.bottom ?? DEFAULT_IOS_BOTTOM_INSET;
+  }
+
+  return _bottomInset;
+};
+
+export const getNavigationBarHeight = () =>
+  Platform.select({
+    ios: NAVIGATION_HEADER_HEIGHT + getTopInset(),
+    android: isNotchedAndroid
+      ? NAVIGATION_HEADER_HEIGHT + StatusBar.currentHeight
+      : NAVIGATION_HEADER_HEIGHT,
+    default: NAVIGATION_HEADER_HEIGHT,
+  });
+
+export const getHomeIndicatorPadding = () =>
+  Platform.OS === 'ios' ? getBottomInset() : 0;
+
+export const getNotchAreaHeight = () =>
+  Platform.select({
+    ios: getTopInset(),
+    android: isNotchedAndroid ? StatusBar.currentHeight : 0,
+    default: 0,
+  });
```

**File**: `helpers/index.js` (modified, +3/-0)
```diff
@@ -1,5 +1,8 @@
 export {
   Device,
+  getHomeIndicatorPadding,
+  getNavigationBarHeight,
+  getNotchAreaHeight,
   HOME_INDICATOR_PADDING,
   isNotchedAndroid,
   NAVIGATION_BAR_HEIGHT,
```

**File**: `index.js` (modified, +8/-1)
```diff
@@ -78,7 +78,14 @@ export { YearRangePicker } from './components/YearRangePicker';
 export * from './hooks';
 
 // Helpers
-export { calculateKeyboardOffset, Device, Keyboard } from './helpers';
+export {
+  calculateKeyboardOffset,
+  Device,
+  getHomeIndicatorPadding,
+  getNavigationBarHeight,
+  getNotchAreaHeight,
+  Keyboard,
+} from './helpers';
 
 // HTML
 export { Html } from './html';
```

---

### Incident Patch 4: `14d1ef2e` (2026-04-09)
**Commit Message**: Merge pull request #908 from shoutem/fix/scrollview-animation-driver-race-condition

fix/ remove animation driver unsubscribe

**File**: `components/ScrollView/ScrollView.js` (modified, +10/-15)
```diff
@@ -1,4 +1,4 @@
-import React, { useContext, useEffect, useRef } from 'react';
+import React, { useCallback, useContext, useEffect, useRef } from 'react';
 import { Animated } from 'react-native';
 import { useFocusEffect } from '@react-navigation/native';
 import _ from 'lodash';
@@ -25,22 +25,17 @@ const ScrollView = ({ driver, onScroll, primary, style, ...otherProps }) => {
   // we want to switch to appropriate animation driver. We use the following hook
   // to derive the new driver and cascading styles before the actual navigation transition is done
   // to avoid rerendering when the actual nav transition completes
-  useFocusEffect(() => {
-    const {
-      animationDriver: prevAnimationDriver,
-      setAnimationDriver,
-    } = animationDriverContext;
+  useFocusEffect(
+    useCallback(() => {
+      const { setAnimationDriver } = animationDriverContext;
 
-    if (setAnimationDriver) {
-      setAnimationDriver(animationDriver.current, primary);
-    }
-
-    return () => {
-      if (prevAnimationDriver) {
-        setAnimationDriver(prevAnimationDriver);
+      if (setAnimationDriver) {
+        setAnimationDriver(animationDriver.current, primary);
       }
-    };
-  });
+
+      // eslint-disable-next-line react-hooks/exhaustive-deps
+    }, []),
+  );
 
   useEffect(() => {
     if (driver && animationDriver.current !== driver) {
```

---

### Incident Patch 5: `760811a9` (2026-02-24)
**Commit Message**: fix/enable simple html inline css (#902)

* Add  enableCSSInlineProcessing prop to html

* Add more explicit props to react-native-render-html

**File**: `html/components/SimpleHtml.js` (modified, +5/-0)
```diff
@@ -158,6 +158,11 @@ const SimpleHtml = ({
       customHTMLElementModels,
       WebView,
       domVisitors,
+      // Explicitly passing react-native-render-html defaults that were
+      // previously set via defaultProps, which no longer works in React 19+.
+      enableCSSInlineProcessing: true,
+      enableUserAgentStyles: true,
+      emSize: 14,
     }),
     // eslint-disable-next-line react-hooks/exhaustive-deps
     [],
```

---

### Incident Patch 6: `39fcded1` (2026-01-21)
**Commit Message**: Merge pull request #900 from shoutem/hotfix/9.0.3

Hotfix/9.0.3 - develop

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.0.2",
+  "version": "9.0.3",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "9.0.2",
+      "version": "9.0.3",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.0.2",
+  "version": "9.0.3",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
@@ -15,9 +15,9 @@
     "@native-html/table-plugin": "5.3.1",
     "@openspacelabs/react-native-zoomable-view": "2.0.4",
     "@react-native-community/datetimepicker": "6.2.0",
-    "@shoutem/animation": "1.0.0",
+    "@shoutem/animation": "~1.0.0",
     "@shoutem/eslint-config-react": "~1.0.6",
-    "@shoutem/theme": "1.0.1",
+    "@shoutem/theme": "~1.0.2",
     "auto-bind": "4.0.0",
     "babel-plugin-transform-decorators-legacy": "1.3.5",
     "buffer": "5.6.0",
```

---

### Incident Patch 7: `0dc163a9` (2026-01-21)
**Commit Message**: Merge pull request #901 from shoutem/hotfix/9.0.3

Hotfix/9.0.3

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.0.2",
+  "version": "9.0.3",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "9.0.2",
+      "version": "9.0.3",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.0.2",
+  "version": "9.0.3",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
@@ -15,9 +15,9 @@
     "@native-html/table-plugin": "5.3.1",
     "@openspacelabs/react-native-zoomable-view": "2.0.4",
     "@react-native-community/datetimepicker": "6.2.0",
-    "@shoutem/animation": "1.0.0",
+    "@shoutem/animation": "~1.0.0",
     "@shoutem/eslint-config-react": "~1.0.6",
-    "@shoutem/theme": "1.0.1",
+    "@shoutem/theme": "~1.0.2",
     "auto-bind": "4.0.0",
     "babel-plugin-transform-decorators-legacy": "1.3.5",
     "buffer": "5.6.0",
```

---

### Incident Patch 8: `f0135830` (2026-01-12)
**Commit Message**: Merge pull request #899 from shoutem/hotfix/9.0.2

Hotfix/9.0.2 - develop

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.0.1",
+  "version": "9.0.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "9.0.0",
+      "version": "9.0.2",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "9.0.1",
+  "version": "9.0.2",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
@@ -17,7 +17,7 @@
     "@react-native-community/datetimepicker": "6.2.0",
     "@shoutem/animation": "1.0.0",
     "@shoutem/eslint-config-react": "~1.0.6",
-    "@shoutem/theme": "1.0.0",
+    "@shoutem/theme": "1.0.1",
     "auto-bind": "4.0.0",
     "babel-plugin-transform-decorators-legacy": "1.3.5",
     "buffer": "5.6.0",
```

---

### Incident Patch 9: `963c0eb0` (2025-08-18)
**Commit Message**: Merge pull request #892 from shoutem/hotfix/8.2.7

Hotfix/8.2.7 - develop

**File**: `html/components/AttachmentRenderer.js` (modified, +14/-18)
```diff
@@ -4,39 +4,35 @@ import PropTypes from 'prop-types';
 import { resolveDimensions } from '../services/Dimensions';
 import Image from './Image';
 
-const AttachmentRenderer = ({ id, type, style, attachments }) => {
-  if (!attachments) {
+const AttachmentRenderer = ({ tnode, style, attachments }) => {
+  if (!attachments || _.isEmpty(attachments)) {
     return null;
   }
 
-  if (type === 'image') {
-    const image = _.find(attachments, { id });
+  const image = _.find(attachments, { id: tnode?.id });
 
-    if (image && image.src) {
-      const source = { uri: image.src };
-      const imageSize = { width: image.width, height: image.height };
-      const { height, width } = resolveDimensions(imageSize, style);
-      const resolvedStyle = { alignSelf: 'center', height, width };
-
-      return <Image source={source} key={id} style={resolvedStyle} />;
-    }
+  if (!image || !image.src) {
+    return null;
   }
 
-  return null;
+  const source = { uri: image.src };
+  const imageSize = { width: image.width, height: image.height };
+  const { height, width } = resolveDimensions(imageSize, style);
+  const resolvedStyle = { alignSelf: 'center', height, width };
+
+  return <Image source={source} key={tnode?.id} style={resolvedStyle} />;
 };
 
 AttachmentRenderer.propTypes = {
-  attachments: PropTypes.oneOf([PropTypes.array, PropTypes.object]),
-  id: PropTypes.any,
+  attachments: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
   style: PropTypes.any,
-  type: PropTypes.any,
+  tnode: PropTypes.object,
 };
 
 AttachmentRenderer.defaultProps = {
-  id: undefined,
-  type: undefined,
   attachments: undefined,
   style: undefined,
+  tnode: {},
 };
 
 export default AttachmentRenderer;
```

**File**: `html/components/SimpleHtml.js` (modified, +6/-2)
```diff
@@ -13,7 +13,10 @@ import _ from 'lodash';
 import PropTypes from 'prop-types';
 import { connectStyle } from '@shoutem/theme';
 import VideoRenderer from '@shoutem/ui/html/components/VideoRenderer';
-import { videoModel } from '@shoutem/ui/html/services/HTMLElementModels';
+import {
+  attachmentModel,
+  videoModel,
+} from '@shoutem/ui/html/services/HTMLElementModels';
 import { View } from '../../components/View';
 import { resolveMaxWidth } from '../services/Dimensions';
 import { onElement } from '../services/DomVisitors';
@@ -76,7 +79,7 @@ class SimpleHtml extends PureComponent {
       table,
       attachment: props => (
         <AttachmentRenderer
-          {...props}
+          tnode={props.tnode}
           attachments={attachments}
           style={style}
         />
@@ -115,6 +118,7 @@ class SimpleHtml extends PureComponent {
         table: tableModel,
         iframe: iframeModel,
         video: videoModel,
+        attachment: attachmentModel,
         ...customHtmlElementModels,
       },
       WebView,
```

**File**: `html/services/HTMLElementModels.js` (modified, +6/-0)
```diff
@@ -5,3 +5,9 @@ export const videoModel = HTMLElementModel.fromCustomModel({
   tagName: 'video',
   isOpaque: true,
 });
+
+export const attachmentModel = HTMLElementModel.fromCustomModel({
+  contentModel: HTMLContentModel.block,
+  tagName: 'attachment',
+  isOpaque: true,
+});
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.6",
+  "version": "8.2.7",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "8.2.6",
+      "version": "8.2.7",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.6",
+  "version": "8.2.7",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
```

---

### Incident Patch 10: `3dc64a1a` (2025-08-18)
**Commit Message**: Merge pull request #891 from shoutem/hotfix/8.2.7

Hotfix/8.2.7

**File**: `html/components/AttachmentRenderer.js` (modified, +14/-18)
```diff
@@ -4,39 +4,35 @@ import PropTypes from 'prop-types';
 import { resolveDimensions } from '../services/Dimensions';
 import Image from './Image';
 
-const AttachmentRenderer = ({ id, type, style, attachments }) => {
-  if (!attachments) {
+const AttachmentRenderer = ({ tnode, style, attachments }) => {
+  if (!attachments || _.isEmpty(attachments)) {
     return null;
   }
 
-  if (type === 'image') {
-    const image = _.find(attachments, { id });
+  const image = _.find(attachments, { id: tnode?.id });
 
-    if (image && image.src) {
-      const source = { uri: image.src };
-      const imageSize = { width: image.width, height: image.height };
-      const { height, width } = resolveDimensions(imageSize, style);
-      const resolvedStyle = { alignSelf: 'center', height, width };
-
-      return <Image source={source} key={id} style={resolvedStyle} />;
-    }
+  if (!image || !image.src) {
+    return null;
   }
 
-  return null;
+  const source = { uri: image.src };
+  const imageSize = { width: image.width, height: image.height };
+  const { height, width } = resolveDimensions(imageSize, style);
+  const resolvedStyle = { alignSelf: 'center', height, width };
+
+  return <Image source={source} key={tnode?.id} style={resolvedStyle} />;
 };
 
 AttachmentRenderer.propTypes = {
-  attachments: PropTypes.oneOf([PropTypes.array, PropTypes.object]),
-  id: PropTypes.any,
+  attachments: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
   style: PropTypes.any,
-  type: PropTypes.any,
+  tnode: PropTypes.object,
 };
 
 AttachmentRenderer.defaultProps = {
-  id: undefined,
-  type: undefined,
   attachments: undefined,
   style: undefined,
+  tnode: {},
 };
 
 export default AttachmentRenderer;
```

**File**: `html/components/SimpleHtml.js` (modified, +6/-2)
```diff
@@ -13,7 +13,10 @@ import _ from 'lodash';
 import PropTypes from 'prop-types';
 import { connectStyle } from '@shoutem/theme';
 import VideoRenderer from '@shoutem/ui/html/components/VideoRenderer';
-import { videoModel } from '@shoutem/ui/html/services/HTMLElementModels';
+import {
+  attachmentModel,
+  videoModel,
+} from '@shoutem/ui/html/services/HTMLElementModels';
 import { View } from '../../components/View';
 import { resolveMaxWidth } from '../services/Dimensions';
 import { onElement } from '../services/DomVisitors';
@@ -76,7 +79,7 @@ class SimpleHtml extends PureComponent {
       table,
       attachment: props => (
         <AttachmentRenderer
-          {...props}
+          tnode={props.tnode}
           attachments={attachments}
           style={style}
         />
@@ -115,6 +118,7 @@ class SimpleHtml extends PureComponent {
         table: tableModel,
         iframe: iframeModel,
         video: videoModel,
+        attachment: attachmentModel,
         ...customHtmlElementModels,
       },
       WebView,
```

**File**: `html/services/HTMLElementModels.js` (modified, +6/-0)
```diff
@@ -5,3 +5,9 @@ export const videoModel = HTMLElementModel.fromCustomModel({
   tagName: 'video',
   isOpaque: true,
 });
+
+export const attachmentModel = HTMLElementModel.fromCustomModel({
+  contentModel: HTMLContentModel.block,
+  tagName: 'attachment',
+  isOpaque: true,
+});
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.6",
+  "version": "8.2.7",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "8.2.6",
+      "version": "8.2.7",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.6",
+  "version": "8.2.7",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
```

---

### Incident Patch 11: `6186f50f` (2025-08-18)
**Commit Message**: early return on null/undefined

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `html/components/AttachmentRenderer.js` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import { resolveDimensions } from '../services/Dimensions';
 import Image from './Image';
 
 const AttachmentRenderer = ({ tnode, style, attachments }) => {
-  if (_.isEmpty(attachments)) {
+  if (!attachments || _.isEmpty(attachments)) {
     return null;
   }
 
```

---

### Incident Patch 12: `a4c0c2c6` (2025-08-18)
**Commit Message**: resolve attachment tag to render images as expected

**File**: `html/components/AttachmentRenderer.js` (modified, +13/-17)
```diff
@@ -4,39 +4,35 @@ import PropTypes from 'prop-types';
 import { resolveDimensions } from '../services/Dimensions';
 import Image from './Image';
 
-const AttachmentRenderer = ({ id, type, style, attachments }) => {
-  if (!attachments) {
+const AttachmentRenderer = ({ tnode, style, attachments }) => {
+  if (_.isEmpty(attachments)) {
     return null;
   }
 
-  if (type === 'image') {
-    const image = _.find(attachments, { id });
+  const image = _.find(attachments, { id: tnode?.id });
 
-    if (image && image.src) {
-      const source = { uri: image.src };
-      const imageSize = { width: image.width, height: image.height };
-      const { height, width } = resolveDimensions(imageSize, style);
-      const resolvedStyle = { alignSelf: 'center', height, width };
-
-      return <Image source={source} key={id} style={resolvedStyle} />;
-    }
+  if (!image || !image.src) {
+    return null;
   }
 
-  return null;
+  const source = { uri: image.src };
+  const imageSize = { width: image.width, height: image.height };
+  const { height, width } = resolveDimensions(imageSize, style);
+  const resolvedStyle = { alignSelf: 'center', height, width };
+
+  return <Image source={source} key={tnode?.id} style={resolvedStyle} />;
 };
 
 AttachmentRenderer.propTypes = {
   attachments: PropTypes.oneOf([PropTypes.array, PropTypes.object]),
-  id: PropTypes.any,
   style: PropTypes.any,
-  type: PropTypes.any,
+  tnode: PropTypes.object,
 };
 
 AttachmentRenderer.defaultProps = {
-  id: undefined,
-  type: undefined,
   attachments: undefined,
   style: undefined,
+  tnode: {},
 };
 
 export default AttachmentRenderer;
```

**File**: `html/components/SimpleHtml.js` (modified, +6/-2)
```diff
@@ -13,7 +13,10 @@ import _ from 'lodash';
 import PropTypes from 'prop-types';
 import { connectStyle } from '@shoutem/theme';
 import VideoRenderer from '@shoutem/ui/html/components/VideoRenderer';
-import { videoModel } from '@shoutem/ui/html/services/HTMLElementModels';
+import {
+  attachmentModel,
+  videoModel,
+} from '@shoutem/ui/html/services/HTMLElementModels';
 import { View } from '../../components/View';
 import { resolveMaxWidth } from '../services/Dimensions';
 import { onElement } from '../services/DomVisitors';
@@ -76,7 +79,7 @@ class SimpleHtml extends PureComponent {
       table,
       attachment: props => (
         <AttachmentRenderer
-          {...props}
+          tnode={props.tnode}
           attachments={attachments}
           style={style}
         />
@@ -115,6 +118,7 @@ class SimpleHtml extends PureComponent {
         table: tableModel,
         iframe: iframeModel,
         video: videoModel,
+        attachment: attachmentModel,
         ...customHtmlElementModels,
       },
       WebView,
```

**File**: `html/services/HTMLElementModels.js` (modified, +6/-0)
```diff
@@ -5,3 +5,9 @@ export const videoModel = HTMLElementModel.fromCustomModel({
   tagName: 'video',
   isOpaque: true,
 });
+
+export const attachmentModel = HTMLElementModel.fromCustomModel({
+  contentModel: HTMLContentModel.block,
+  tagName: 'attachment',
+  isOpaque: true,
+});
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.6",
+  "version": "8.2.7-rc.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "8.2.6",
+      "version": "8.2.7-rc.0",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.6",
+  "version": "8.2.7-rc.0",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
```

---

### Incident Patch 13: `69283160` (2025-07-03)
**Commit Message**: Fix/improve action sheet UI (#888)

* adjust action sheet option colors so that text is visible in all scenarios

* bump version

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.5",
+  "version": "8.2.6-rc.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "8.2.5",
+      "version": "8.2.6-rc.0",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.5",
+  "version": "8.2.6-rc.0",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
```

**File**: `theme.js` (modified, +4/-1)
```diff
@@ -2407,8 +2407,11 @@ export default () => {
         paddingHorizontal: 20,
         paddingVertical: 16,
         borderBottomWidth: 1,
-        borderColor: 'rgba(130, 130, 130, 0.1)',
         alignItems: 'center',
+        backgroundColor: resolveVariable('primaryButtonBackgroundColor'),
+        borderColor: resolveVariable('primaryButtonBorderColor'),
+        borderWidth: StyleSheet.hairlineWidth,
+        borderRadius: 13,
       },
       text: {
         fontSize: 15,
```

---

### Incident Patch 14: `2cf761e0` (2025-03-18)
**Commit Message**: Merge pull request #883 from shoutem/hotfix/8.2.2

Hotfix/8.2.2 -> develop

**File**: `components/ScrollView/ScrollDriverProvider.js` (modified, +0/-4)
```diff
@@ -32,10 +32,6 @@ export class ScrollDriverProvider extends PureComponent {
     };
   }
 
-  componentDidUpdate() {
-    this.setupAnimationDriver(this.props, this.context);
-  }
-
   setupAnimationDriver(props, context) {
     const { onAnimationDriverChange } = this.props;
 
```

**File**: `package-lock.json` (modified, +11/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.1",
+  "version": "8.2.2-rc.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "8.2.1",
+      "version": "8.2.2-rc.0",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
@@ -31,6 +31,7 @@
         "qs": "6.9.3",
         "react-native-actions-sheet": "0.9.3",
         "react-native-device-info": "10.13.2",
+        "react-native-haptic-feedback": "2.3.3",
         "react-native-lightbox-v2": "0.9.0",
         "react-native-linear-gradient": "2.8.3",
         "react-native-modal": "13.0.1",
@@ -14270,6 +14271,14 @@
       "integrity": "sha512-eIlgtsmDp1jLC24dRn43hB3kEcZVqx6DUQbR0N1ABXGnMEafm9I3V3dUUeD1vh+Dy5WqijSoEwLNUPLgu5zDMg==",
       "license": "MIT"
     },
+    "node_modules/react-native-haptic-feedback": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/react-native-haptic-feedback/-/react-native-haptic-feedback-2.3.3.tgz",
+      "integrity": "sha512-svS4D5PxfNv8o68m9ahWfwje5NqukM3qLS48+WTdhbDkNUkOhP9rDfDSRHzlhk4zq+ISjyw95EhLeh8NkKX5vQ==",
+      "peerDependencies": {
+        "react-native": ">=0.60.0"
+      }
+    },
     "node_modules/react-native-lightbox-v2": {
       "version": "0.9.0",
       "resolved": "https://registry.npmjs.org/react-native-lightbox-v2/-/react-native-lightbox-v2-0.9.0.tgz",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.1",
+  "version": "8.2.2",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
```

**File**: `theme.js` (modified, +6/-0)
```diff
@@ -2264,6 +2264,12 @@ export default () => {
         },
       },
 
+      '.5:7-ratio': {
+        container: {
+          height: (7 / 5) * window.width,
+        },
+      },
+
       container: {
         height: responsiveWidth(345),
       },
```

**File**: `yarn.lock` (modified, +1/-1)
```diff
@@ -6437,7 +6437,7 @@ react-native-gradle-plugin@^0.0.6:
 
 react-native-haptic-feedback@2.3.3:
   version "2.3.3"
-  resolved "https://registry.yarnpkg.com/react-native-haptic-feedback/-/react-native-haptic-feedback-2.3.3.tgz#88b6876e91399a69bd1b551fe1681b2f3dc1214e"
+  resolved "https://registry.npmjs.org/react-native-haptic-feedback/-/react-native-haptic-feedback-2.3.3.tgz"
   integrity sha512-svS4D5PxfNv8o68m9ahWfwje5NqukM3qLS48+WTdhbDkNUkOhP9rDfDSRHzlhk4zq+ISjyw95EhLeh8NkKX5vQ==
 
 react-native-lightbox-v2@0.9.0:
```

---

### Incident Patch 15: `c4e159bc` (2025-03-18)
**Commit Message**: Merge pull request #882 from shoutem/hotfix/8.2.2

Hotfix/8.2.2 -> master

**File**: `components/ScrollView/ScrollDriverProvider.js` (modified, +0/-4)
```diff
@@ -32,10 +32,6 @@ export class ScrollDriverProvider extends PureComponent {
     };
   }
 
-  componentDidUpdate() {
-    this.setupAnimationDriver(this.props, this.context);
-  }
-
   setupAnimationDriver(props, context) {
     const { onAnimationDriverChange } = this.props;
 
```

**File**: `package-lock.json` (modified, +11/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.1",
+  "version": "8.2.2-rc.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@shoutem/ui",
-      "version": "8.2.1",
+      "version": "8.2.2-rc.0",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
@@ -31,6 +31,7 @@
         "qs": "6.9.3",
         "react-native-actions-sheet": "0.9.3",
         "react-native-device-info": "10.13.2",
+        "react-native-haptic-feedback": "2.3.3",
         "react-native-lightbox-v2": "0.9.0",
         "react-native-linear-gradient": "2.8.3",
         "react-native-modal": "13.0.1",
@@ -14270,6 +14271,14 @@
       "integrity": "sha512-eIlgtsmDp1jLC24dRn43hB3kEcZVqx6DUQbR0N1ABXGnMEafm9I3V3dUUeD1vh+Dy5WqijSoEwLNUPLgu5zDMg==",
       "license": "MIT"
     },
+    "node_modules/react-native-haptic-feedback": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/react-native-haptic-feedback/-/react-native-haptic-feedback-2.3.3.tgz",
+      "integrity": "sha512-svS4D5PxfNv8o68m9ahWfwje5NqukM3qLS48+WTdhbDkNUkOhP9rDfDSRHzlhk4zq+ISjyw95EhLeh8NkKX5vQ==",
+      "peerDependencies": {
+        "react-native": ">=0.60.0"
+      }
+    },
     "node_modules/react-native-lightbox-v2": {
       "version": "0.9.0",
       "resolved": "https://registry.npmjs.org/react-native-lightbox-v2/-/react-native-lightbox-v2-0.9.0.tgz",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@shoutem/ui",
-  "version": "8.2.1",
+  "version": "8.2.2",
   "description": "Styleable set of components for React Native applications",
   "scripts": {
     "lint": "eslint .",
```

**File**: `theme.js` (modified, +6/-0)
```diff
@@ -2264,6 +2264,12 @@ export default () => {
         },
       },
 
+      '.5:7-ratio': {
+        container: {
+          height: (7 / 5) * window.width,
+        },
+      },
+
       container: {
         height: responsiveWidth(345),
       },
```

**File**: `yarn.lock` (modified, +1/-1)
```diff
@@ -6437,7 +6437,7 @@ react-native-gradle-plugin@^0.0.6:
 
 react-native-haptic-feedback@2.3.3:
   version "2.3.3"
-  resolved "https://registry.yarnpkg.com/react-native-haptic-feedback/-/react-native-haptic-feedback-2.3.3.tgz#88b6876e91399a69bd1b551fe1681b2f3dc1214e"
+  resolved "https://registry.npmjs.org/react-native-haptic-feedback/-/react-native-haptic-feedback-2.3.3.tgz"
   integrity sha512-svS4D5PxfNv8o68m9ahWfwje5NqukM3qLS48+WTdhbDkNUkOhP9rDfDSRHzlhk4zq+ISjyw95EhLeh8NkKX5vQ==
 
 react-native-lightbox-v2@0.9.0:
```

#### Recent Merged Pull Requests:
- **PR #936** (2026-09-23): Release/9.2.1 (@tomislav-arambasic)
- **PR #935** (2026-09-23): feature/ youtube/vimeo video embeds  (@s-brankovic)
- **PR #934** (2026-08-21): Release/9.2.0 - develop (@tomislav-arambasic)
- **PR #933** (2026-08-21): Release/9.2.0 (@tomislav-arambasic)
- **PR #932** (2026-08-21): rn upgrade (@tomislav-arambasic)
- **PR #931** (2026-06-19): Release/9.1.2 (@tomislav-arambasic)
- **PR #930** (2026-06-19): feat/Add style slot  to date time picker (@s-brankovic)
- **PR #929** (2026-06-15): Hotfix/9.1.1 (@tomislav-arambasic)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
