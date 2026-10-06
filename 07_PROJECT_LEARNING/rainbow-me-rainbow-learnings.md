# Forensic Learning Record (Deep Inspection): rainbow-me/rainbow

> **Canonical Artifact**: `07_PROJECT_LEARNING/rainbow-me-rainbow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rainbow-me/rainbow](https://github.com/rainbow-me/rainbow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:03:11.417Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rainbow-me/rainbow`
- **Description**: 🌈‒ the Ethereum wallet that lives in your pocket 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4394 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/utils/coordinates.js`
```
/**
 * Tab bar coordinates for Maestro E2E tests
 *
 * Why this exists:
 * - Our tab bar can't be interacted with in Maestro tests
 * - Maestro needs percentage-based coordinates to tap on tab bar items
 * - Tab bars don't have unique IDs, so we use position-based tapping
 * - Centralizing coordinates here makes tests more maintainable
 *
 * Usage in Maestro tests:
 * 1. Load: - runScript: { file: e2e/utils/coordinates.js }
 * 2. Tap:  - tapOn: { point: ${output.tabCoordinates.discoverTab} }
 */

const tabCoordinates = {
  homeTab: '20%,92%', // Wallet tab
  discoverTab: '35%,92%', // Discover tab
  browserTab: '50%,92%', // Browser tab
  activityTab: '65%,92%', // Activity tab
  rewardsTab: '80%,92%', // Rnbw Rewards tab
};

// Export to Maestro's output object
// eslint-disable-next-line no-undef
output.tabCoordinates = tabCoordinates;

```

### Core Architecture Module: `e2e/utils/isLoggedIn.js`
```
/* eslint-disable no-undef */

output.isLoggedIn = true;

```

### Core Architecture Module: `e2e/utils/parseBalance.js`
```
/**
 * Parse a currency string to a number for balance comparisons
 *
 * Examples:
 *   "$1,234.56" → 1234.56
 *   "~$1,234.56" → 1234.56
 *   "<$0.01" → 0.01
 *
 * Usage in Maestro tests:
 * 1. Load: - runScript: { file: ../../utils/parseBalance.js }
 * 2. Use:  - evalScript: ${output.beforeValueNum = output.parseBalance(output.beforeValue)}
 */

// eslint-disable-next-line no-undef
output.parseBalance = str => parseFloat((str || '').replace(/[^0-9.]/g, '')) || 0;

```

### Core Architecture Module: `ios/PriceWidget/Utils/Constants.swift`
```
//
//  Constants.swift
//  Rainbow
//
//  Created by Ben Goldberg on 11/20/21.
//  Copyright © 2021 Rainbow. All rights reserved.
//

import Foundation
import UIKit

@available(iOS 14.0, *)
struct Constants {
  static let eth = TokenDetails(name: "Ethereum", coinGeckoId: "ethereum", symbol: "ETH", color: "#282C2C", address: "eth")
  
  static let topTokenAddresses = ["0xd7c49cee7e9188cca6ad8ff264c1da2e69d4cf3b": 48, "0xe1be5d3f34e89de342ee97e6e90d405884da6c67": 10, "0x45804880de22913dafe09f4980848ece6ecbaf78": 101, "0x3103df8f05c4d8af16fd22ae63e406b97fec6938": 47, "0x514910771af9ca656af840dff83e8264ecf986ca": 4, "0x85eee30c52b0b379b046fb0f85f4f3dc3009afec": 96, "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2": 33, "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": 16, "0xff56cc6b1e6ded347aa0b7676c85ab0b3d08b0fa": 100, "0xe41d2489571d322189246dafa5ebde1f4699f498": 55, "0xf34960d9d60be18cc1d5afc1a6f012a723a28811": 43, "0xaea46a60368a7bd060eec7df8cba43b7ef41ad85": 76, "0x7dd9c5cba05e151c895fde1cf355c9a1d5da6429": 81, "0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3": 29, "0x8dae6cb04688c62d939ed9b68d32bc62e49970b1": 46, "0x8400d94a5cb0fa0d041a3788e395285d61c9ee5e": 98, "0xcca0c9c383076649604ee31b20248bc04fdf61ca": 97, "0xc00e94cb662c3520282e6f5717214004a7f26888": 36, "0x3883f5e181fccaf8410fa61e12b59bad963fb645": 13, "0xeb4c2781e4eba804ce9a9803c67d0893436bb27d": 53, "0x8207c1ffc5b6804f6024322ccf34f29c3541ae26": 91, "0x6c6ee5e31d828de241282b9606c8e98ea48526e2": 31, "0x0fd10b9899882a6f2fcb5c371e17e70fdee00c38": 86, "0x4575f41308ec1483f3d399aa9a2826d74da13deb": 93, "0x6f259637dcd74c767781e37bc6133cd6a68aa161": 44, "0x92d6c1e31e14520e676a687f0a93788b716beff5": 57, "0x16631e53c20fd2670027c6d53efe2642929b285c": 34, "0xe83cccfabd4ed148903bf36d4283ee7c8b3494d1": 30, "0x6fb3e0a217407efff7ca062d46c26e5d60a14d69": 41, "0x43dfc4159d86f3a37a5a4b3d4580b888ad7d4ddd": 90, "0x8a2279d4a90b6fe1c4b30fa660cc9f926797baa2": 74, "0xd850942ef8811f2a866692a623011bde52a462c1": 7, "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f": 39, "0x467bccd9d29f223bce8043b84e8c8b282827790f": 49, "0xe452e6ea2ddeb012e20db73bf5d3863a3ac8d77a": 37, "0xfa1a856cfa3409cfa145fa4e20eb270df3eb21ab": 64, "0xc944e90c64b2c07662a292be6244bdf05cda44a7": 17, "0xb8c77482e45f1f44de1745f52c74426c631bdd52": 2, "0x23b608675a2b2fb1890d3abbd85c5775c51691d5": 80, "0xd26114cd6ee289accf82350c8d8487fedb8a0c07": 32, "0x6810e776880c02933d47db1b9fc05908e5386b96": 72, "0x853d955acef822db058eb8505911ed77f175b99e": 65, "0xc7283b66eb1eb5fb86327f08e1b5816b0720212b": 79, "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": 5, "0x55296f69f40ea6d20e478533c15a6b08b654e758": 68, "0x111111111117dc0aa78b770fa6a738034120c302": 69, "0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206": 40, "0x3506424f91fd33084466f402d5d97f05f8e3b4af": 27, "0x967da4048cd07ab37855c090aaf366e4ce1b9f48": 92, "0x58b6a8a3302369daec383334672404ee733ab239": 42, "0x767fe9edc9e0df98e07454847909b5e959d7ca0e": 71, "0x744d70fdbe2ba4cf95131626614a1763df805b9e": 94, "0x39bb259f66e1c59d5abef88375979b4d20d98022": 60, "0xe28b3b32b6c345a34ff64674606124dd5aceca30": 82, "0xfc82bb4ba86045af6f327323a46e80412b91b27d": 103, "0x761d38e5ddf6ccf6cf7c55759d5210750b5d60f3": 62, "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": 6, "0x9992ec3cf6a55b00978cddf2b27bc6882d88d1ec": 78, "0xba11d00c5f74255f56a5e366f4f77f5a186d7f55": 95, "0x4a220e6096b25eadb88358cb44068a3248254675": 19, "0x8c15ef5b4b21951d50e53e4fbda8298ffad25057": 85, "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72": 56, "0x2af5d2ad76741191d15dfe7bf6ac92d4bd912ca3": 20, "0x75231f58b43240c9718dd58b4967c5114342a86c": 9, "0x04fa0d235c4abf4bcf4787af4cf447de572ef828": 59, "0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b": 8, "0xbbbbca6a901c926f240b89eacb641d8aec7aeafd": 18, "0x3597bfd533a99c9aa083587b074434e61eb0a258": 77, "0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c": 54, "0xfd09cf7cfffa9932e33668311c4777cb9db3c9be": 22, "0x6e1a19f235be7ed8e3369ef73b196c07257494de": 11, "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2": 25, "0xa1faa113cbe53436df28ff0aee54275c13b40975": 84, "0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d": 38, "0x0f2d719407fdbeff09d87557abb7232601fd9f29": 89, "0x3845badade8e6dff049820680d1f14bd3903a5d0": 35, "0xff20817765cb7f73d4bde2e66e067e58d11095c2": 24, "0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f": 66, "0xba9d4199fab4f26efe3551d490e3821486f135ba": 75, "0x0d8775f648430679a709e98d2b0cb6250d2887ef": 45, "0x0316eb71485b0ab14103307bf65a021042c6d380": 26, "0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9": 88, "0x05f4a42e251f2d52b8ed15e9fedaacfcef1fad27": 50, "0x4691937a7508860f876c9c0a2a617e7d9e945d4b": 67, "0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0": 63, "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": 3, "0x799a4202c12ca952cb311598a024c80ed371a41e": 23, "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": 15, "0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c": 28, eth.address: 1, "0x69af81e73a73b40adf4f3d4223cd9b1ece623074": 83, "0xfd1e80508f243e64ce234ea88a5fd2827c71d4b7": 73, "0x41ab1b6fcbb2fa9dced81acbdec13ea6315f2bf2": 52, "0x4f9254c83eb525f9fcf346490bbb3ed28a81c667": 70, "0x4e15361fd6b4bb609fa63c81a2be19d873717870": 14, "0xb4efd85c19999d84251304bda99e90b92300bd93": 61, "0x476c5e26a75bd202a9683ffd34359c0cc15be0ff": 58, "0x607f4c5bb672230e8672085532f7e901544a7375": 102, "0xf16e81dce15b08f326220742020379b855b87df9": 99, "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e": 51, "0xd291e7a03283640fdc51b121ac401383a46cc623": 87]
  
  struct Currencies {
    static let eth = CurrencyDetails(identifier: "eth", display: "Ethereum", symbol: "Ξ", rank: 1)
    static let usd = CurrencyDetails(identifier: "usd", display: "United States Dollar", symbol: "$", rank: 2)
    static let eur = CurrencyDetails(identifier: "eur", display: "Euro", symbol: "€", rank: 3)
    static let gbp = CurrencyDetails(identifier: "gbp", display: "British Pound", symbol: "£", rank: 4)
    static let aud = CurrencyDetails(identifier: "aud", display: "Australian Dollar", symbol: "A$", rank: 5)
    static let cny = CurrencyDetails(identifier: "cny", display: "Chinese Yuan", symbol: "¥", rank: 6)
    static let krw = CurrencyDetails(identifier: "krw", display: "South Korean Won", symbol: "₩", rank: 7)
    static let rub = CurrencyDetails(identifier: "rub", display: "Russian Ruble", symbol: "₽", rank: 8)
    static let inr = CurrencyDetails(identifier: "inr", display: "Indian Rupee", symbol: "₹", rank: 9)
    static let jpy = CurrencyDetails(identifier: "jpy", display: "Japanese Yen", symbol: "¥", rank: 10)
    static let `try` = CurrencyDetails(identifier: "try", display: "Turkish Lira", symbol: "₺", rank: 11)
    static let cad = CurrencyDetails(identifier: "cad", display: "Canadian Dollar", symbol: "CA$", rank: 12)
    static let nzd = CurrencyDetails(identifier: "nzd", display: "New Zealand Dollar", symbol: "NZ$", rank: 13)
    static let zar = CurrencyDetails(identifier: "zar", display: "South African Rand", symbol: "R", rank: 14)
  }
   
  static let currencyDict = [Currencies.eth.identifier: Currencies.eth,
                             Currencies.usd.identifier: Currencies.usd,
                             Currencies.eur.identifier: Currencies.eur,
                             Currencies.gbp.identifier: Currencies.gbp,
                             Currencies.aud.identifier: Currencies.aud,
                             Currencies.cny.identifier: Currencies.cny,
                             Currencies.krw.identifier: Currencies.krw,
                             Currencies.rub.identifier: Currencies.rub,
                             Currencies.inr.identifier: Currencies.inr,
                             Currencies.jpy.identifier: Currencies.jpy,
                             Currencies.try.identifier: Currencies.try,
                             Currencies.cad.identifier: Currencies.cad,
                             Currencies.nzd.identifier: Currencies.nzd,
                             Currencies.zar.identifier: Currencies.zar]
}

```

### Core Architecture Module: `ios/PriceWidget/Utils/UIColor.swift`
```
//
//  UIColor.swift
//  Rainbow
//
//  Created by Ben Goldberg on 11/16/21.
//
import Foundation
import UIKit

@available(iOS 14.0, *)
extension UIColor {

    static func contrastRatio(between color1: UIColor, and color2: UIColor) -> CGFloat {
        let luminance1 = color1.luminance()
        let luminance2 = color2.luminance()

        let luminanceDarker = min(luminance1, luminance2)
        let luminanceLighter = max(luminance1, luminance2)

        return (luminanceLighter + 0.05) / (luminanceDarker + 0.05)
    }

    func contrastRatio(with color: UIColor) -> CGFloat {
        return UIColor.contrastRatio(between: self, and: color)
    }

    func luminance() -> CGFloat {let ciColor = CIColor(color: self)

        func adjust(colorComponent: CGFloat) -> CGFloat {
            return (colorComponent < 0.04045) ? (colorComponent / 12.92) : pow((colorComponent + 0.055) / 1.055, 2.4)
        }

        return 0.2126 * adjust(colorComponent: ciColor.red) + 0.7152 * adjust(colorComponent: ciColor.green) + 0.0722 * adjust(colorComponent: ciColor.blue)
    }
}

```

### Core Architecture Module: `ios/PriceWidget/Utils/UIImage.swift`
```
//
//  UIImage.swift
//  Rainbow
//
//  Created by Ben Goldberg on 10/29/21.
//

import Foundation
import UIKit

@available(iOS 14.0, *)
extension UIImage {
  func resizeImageTo(size: CGSize) -> UIImage {
    UIGraphicsBeginImageContextWithOptions(size, false, 0.0)
    self.draw(in: CGRect(origin: CGPoint.zero, size: size))
    let resizedImage = UIGraphicsGetImageFromCurrentImageContext()!
    UIGraphicsEndImageContext()
    return resizedImage
  }
}

```

### Core Architecture Module: `src/__swaps__/screens/Swap/hooks/analyticsTrackQuoteFailed.ts`
```
import { runOnJS } from 'react-native-reanimated';

import { type ExtendedAnimatedAssetWithColors } from '@/__swaps__/types/assets';
import { analytics } from '@/analytics';
import { type EventProperties } from '@/analytics/event';
import { type QuoteError } from '@rainbow-me/swaps';

const analyticsTrack: typeof analytics.track = (...args) => analytics.track(...args);
let lastParams: EventProperties[typeof analytics.event.swapsQuoteFailed];
export function analyticsTrackQuoteFailed(
  quote: QuoteError | null,
  {
    inputAsset,
    outputAsset,
    inputAmount,
    outputAmount,
  }: {
    inputAsset: ExtendedAnimatedAssetWithColors | null;
    outputAsset: ExtendedAnimatedAssetWithColors | null;
    inputAmount: number | undefined;
    outputAmount: number | undefined;
  }
) {
  'worklet';
  // we are tracking 'Insufficient funds' 'Out of gas' 'No routes found' and 'No quotes found'
  if (!quote || !inputAsset || !outputAsset || !inputAmount) return;

  if (
    lastParams &&
    quote.error_code === lastParams.error_code &&
    inputAmount === lastParams.inputAmount &&
    outputAmount === lastParams.outputAmount &&
    inputAsset.address === lastParams.inputAsset.address &&
    outputAsset.address === lastParams.outputAsset.address
  )
    return;

  const params = {
    error_code: quote.error_code,
    reason: quote.message,
    inputAsset: { address: inputAsset.address, chainId: inputAsset.chainId, symbol: inputAsset.symbol },
    outputAsset: { address: outputAsset.address, chainId: outputAsset.chainId, symbol: outputAsset.symbol },
    inputAmount,
    outputAmount,
  };
  lastParams = params;
  runOnJS(analyticsTrack)(analytics.event.swapsQuoteFailed, params);
}

```

### Core Architecture Module: `src/__swaps__/screens/Swap/hooks/useAnimatedSwapStyles.ts`
```
import { Platform } from 'react-native';

import {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  BASE_INPUT_HEIGHT,
  BOTTOM_ACTION_BAR_HEIGHT,
  EXPANDED_INPUT_HEIGHT,
  REVIEW_SHEET_HEIGHT,
  REVIEW_SHEET_ROW_GAP,
  REVIEW_SHEET_ROW_HEIGHT,
  REVIEW_SHEET_SPONSORED_GAS_OFFSET,
  SETTINGS_SHEET_HEIGHT,
  SETTINGS_SHEET_ROW_GAP,
} from '@/__swaps__/screens/Swap/constants';
import { NavigationSteps } from '@/__swaps__/screens/Swap/hooks/useSwapNavigation';
import { SwapWarningType, type useSwapWarning } from '@/__swaps__/screens/Swap/hooks/useSwapWarning';
import { type ExtendedAnimatedAssetWithColors } from '@/__swaps__/types/assets';
import { getColorValueForThemeWorklet } from '@/__swaps__/utils/swaps';
import { spinnerExitConfig } from '@/components/animations/AnimatedSpinner';
import { SPRING_CONFIGS, TIMING_CONFIGS } from '@/components/animations/animationConfigs';
import { TOKEN_SEARCH_FOCUSED_INPUT_HEIGHT } from '@/components/token-search/constants';
import { getTokenSearchButtonWrapperStyle } from '@/components/token-search/styles';
import { useColorMode } from '@/design-system';
import { foregroundColors } from '@/design-system/color/palettes';
import { opacity } from '@/design-system/utils/opacity';
import { useStoreSharedValue } from '@/state/internal/hooks/useStoreSharedValue';
import { useIsSponsoredSwap } from '@/state/swaps/sponsoredSwapStore';
import { THICK_BORDER_WIDTH } from '@/styles/constants';
import safeAreaInsetValues from '@/utils/safeAreaInsetValues';

const INSET_BOTTOM = safeAreaInsetValues.bottom + 16;

export function useAnimatedSwapStyles({
  SwapWarning,
  configProgress,
  degenMode,
  gasPanelHeight,
  inputProgress,
  internalSelectedInputAsset,
  internalSelectedOutputAsset,
  isFetching,
  outputProgress,
  swapInfo,
}: {
  SwapWarning: ReturnType<typeof useSwapWarning>;
  configProgress: SharedValue<NavigationSteps>;
  degenMode: SharedValue<boolean>;
  gasPanelHeight: SharedValue<number>;
  inputProgress: SharedValue<number>;
  internalSelectedInputAsset: SharedValue<ExtendedAnimatedAssetWithColors | null>;
  internalSelectedOutputAsset: SharedValue<ExtendedAnimatedAssetWithColors | null>;
  isFetching: SharedValue<boolean>;
  outputProgress: SharedValue<number>;
  swapInfo: DerivedValue<{ areAllInputsZero: boolean; areBothAssetsSet: boolean; isBridging: boolean }>;
}) {
  const { isDarkMode } = useColorMode();
  const isSponsoredSwap = useStoreSharedValue(useIsSponsoredSwap, s => s);

  const flipButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(
            interpolate(inputProgress.value, [0, 1, 2], [0, 0, EXPANDED_INPUT_HEIGHT - TOKEN_SEARCH_FOCUSED_INPUT_HEIGHT], 'clamp'),
            SPRING_CONFIGS.springConfig
          ),
        },
      ],
    };
  });

  const focusedSearchStyle = useAnimatedStyle(() => {
    return {
      opacity:
        inputProgress.value === 2 || outputProgress.value === 2
          ? withTiming(0, TIMING_CONFIGS.fadeConfig)
          : withTiming(1, TIMING_CONFIGS.fadeConfig),
      pointerEvents: inputProgress.value === 2 || outputProgress.value === 2 ? 'none' : 'auto',
    };
  });

  const removeWhenNoPriceImpact = useAnimatedStyle(() => {
    return {
      display: SwapWarning.swapWarning.value.type === SwapWarningType.none ? 'none' : 'flex',
    };
  });

  const removeWhenPriceImpact = useAnimatedStyle(() => {
    return {
      display: SwapWarning.swapWarning.value.type !== SwapWarningType.none ? 'none' : 'flex',
    };
  });

  const hideWhenInputsExpandedOrNoPriceImpact = useAnimatedStyle(() => {
    return {
      opacity:
        SwapWarning.swapWarning.value.type === SwapWarningType.none || inputProgress.value > 0 || outputProgress.value > 0
          ? withTiming(0, TIMING_CONFIGS.fadeConfig)
          : withTiming(1, TIMING_CONFIGS.fadeConfig),
      pointerEvents:
        SwapWarning.swapWarning.value.type === SwapWarningType.none || inputProgress.value > 0 || outputProgress.value > 0
          ? 'none'
          : 'auto',
    };
  });

  const hideWhenInputsExpanded = useAnimatedStyle(() => {
    return {
      opacity:
        inputProgress.value > 0 || outputProgress.value > 0
          ? withTiming(0, TIMING_CONFIGS.fadeConfig)
          : withTiming(1, TIMING_CONFIGS.fadeConfig),
      pointerEvents: inputProgress.value > 0 || outputProgress.value > 0 ? 'none' : 'auto',
    };
  });

  const hideWhenInputsExpandedOrPriceImpact = useAnimatedStyle(() => {
    return {
      opacity:
        SwapWarning.swapWarning.value.type !== SwapWarningType.none || inputProgress.value > 0 || outputProgress.value > 0
          ? withTiming(0, TIMING_CONFIGS.fadeConfig)
          : withTiming(1, TIMING_CONFIGS.fadeConfig),
      pointerEvents:
        SwapWarning.swapWarning.value.type !== SwapWarningType.none || inputProgress.value > 0 || outputProgress.value > 0
          ? 'none'
          : 'auto',
    };
  });

  const inputStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(interpolate(inputProgress.value, [0, 1], [1, 0], 'clamp'), TIMING_CONFIGS.fadeConfig),
      pointerEvents: inputProgress.value === 0 ? 'auto' : 'none',
    };
  });

  const inputTokenListStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(interpolate(inputProgress.value, [0, 1], [0, 1], 'clamp'), TIMING_CONFIGS.fadeConfig),
      pointerEvents: inputProgress.value === 0 ? 'none' : 'auto',
    };
  });

  const keyboardStyle = useAnimatedStyle(() => {
    const progress = Math.min(inputProgress.value + outputProgress.value, 1);

    return {
      pointerEvents: progress === 0 ? 'auto' : 'none',
      opacity: withTiming(1 - progress, TIMING_CONFIGS.fadeConfig),
      transform: [
        {
          translateY: withSpring(progress * (EXPANDED_INPUT_HEIGHT - BASE_INPUT_HEIGHT), SPRING_CONFIGS.springConfig),
        },
        { scale: withSpring(0.925 + (1 - progress) * 0.075, SPRING_CONFIGS.springConfig) },
      ],
    };
  });

  const outputStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(interpolate(outputProgress.value, [0, 1], [1, 0], 'clamp'), TIMING_CONFIGS.fadeConfig),
      pointerEvents: outputProgress.value === 0 ? 'auto' : 'none',
    };
  });

  const outputTokenListStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(interpolate(outputProgress.value, [0, 1], [0, 1], 'clamp'), TIMING_CONFIGS.fadeConfig),
      pointerEvents: outputProgress.value === 0 ? 'none' : 'auto',
    };
  });

  const outputAssetColor = useDerivedValue(() => {
    return getColorValueForThemeWorklet(internalSelectedOutputAsset.value?.highContrastColor, isDarkMode);
  });

  const swapActionWrapperStyle = useAnimatedStyle(() => {
    const isReviewing = configProgress.value === NavigationSteps.SHOW_REVIEW;
    const isSettingsOpen = configProgress.value === NavigationSteps.SHOW_SETTINGS;
    const isBottomSheetOpen = isReviewing || isSettingsOpen || configProgress.value === NavigationSteps.SHOW_GAS;

    let heightForCurrentSheet: number;
    switch (configProgress.value) {
      case NavigationSteps.SHOW_GAS:
        heightForCurrentSheet = gasPanelHeight.value + INSET_BOTTOM;
        break;
      case NavigationSteps.SHOW_REVIEW:
        heightForCurrentSheet = REVIEW_SHEET_HEIGHT;
        break;
      case NavigationSteps.SHOW_SETTINGS:
        heightForCurrentSheet = SETTINGS_SHEET_HEIGHT;
        break;
      default:
        heightForCurrentSheet = BOTTOM_ACTION_BAR_HEIGHT;
    }

    if (isReviewing) {
      heightForCurrentSheet -= REVIEW_SHEET_ROW_HEIGHT + REVIEW_SHEET_ROW_GAP;
      if (isSponsoredSwap.value) heightForCurrentSheet -= REVIEW_SHEET_SPONSORED_GAS_OFFSET;
    } else if (degenMode.value && isSettingsOpen && swapInfo.value.areBothAssetsSet) {
      heightForCurrentSheet += REVIEW_SHEET_ROW_HEIGHT + SETTINGS_SHEET_ROW_GAP * 2 + THICK_BORDER_WIDTH;
    }

    return {
      backgroundColor: opacity(outputAssetColor.value, 0.06),
      borderColor: withSpring(
        configProgress.value === NavigationSteps.SHOW_REVIEW ||
          configProgress.value === NavigationSteps.SHOW_GAS ||
          configProgress.value === NavigationSteps.SHOW_SETTINGS
          ? opacity(outputAssetColor.value, 0.2)
          : opacity(outputAssetColor.value, 0.06),
        SPRING_CONFIGS.springConfig
      ),
      borderRadius: withSpring(isBottomSheetOpen ? 40 : 0, SPRING_CONFIGS.springConfig),
      bottom: withSpring(isBottomSheetOpen ? Math.max(safeAreaInsetValues.bottom, 28) : -2, SPRING_CONFIGS.springConfig),
      height: withSpring(heightForCurrentSheet, SPRING_CONFIGS.springConfig),
      left: withSpring(isBottomSheetOpen ? 12 : -2, SPRING_CONFIGS.springConfig),
      right: withSpring(isBottomSheetOpen ? 12 : -2, SPRING_CONFIGS.springConfig),
      paddingHorizontal: withSpring((isBottomSheetOpen ? 16 : 18) - THICK_BORDER_WIDTH, SPRING_CONFIGS.springConfig),
      paddingTop: withSpring((isBottomSheetOpen ? 28 : 16) - THICK_BORDER_WIDTH, SPRING_CONFIGS.springConfig),
    };
  });

  const assetToSellIconStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: getColorValueForThemeWorklet(internalSelectedInputAsset.value?.color, isDarkMode),
    };
  });

  const assetToBuyIconStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: getColorValueForThemeWorklet(internalSelectedOutputAsset.value?.color, isDarkMode),
    };
  });

  const flipButtonFetchingStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'android') return { borderWidth: 0 };
    return {
      borderWidth: isFetching.value ? withTiming(2, { duration: 300 }) : withTiming(THICK_BORDER_WIDTH, spinnerExitConfig),
    };
  });

  const searchInputAssetButtonStyle = useAnimatedStyle(() => {
    return {
      color: getColorValueForThemeWorklet(internalSelectedInputAsset.value?.highContrastColor, isDarkM
```

### Core Architecture Module: `src/__swaps__/screens/Swap/hooks/useBottomPanelGestureHandler.ts`
```
import { Gesture } from 'react-native-gesture-handler';
import { interpolate, useSharedValue, withSpring } from 'react-native-reanimated';

import { NavigationSteps } from '@/__swaps__/screens/Swap/hooks/useSwapNavigation';
import { useSwapContext } from '@/__swaps__/screens/Swap/providers/swap-provider';
import { SPRING_CONFIGS } from '@/components/animations/animationConfigs';

export const useBottomPanelGestureHandler = () => {
  const gestureY = useSharedValue(0);
  const startY = useSharedValue<number | null>(null);
  const { SwapNavigation, configProgress } = useSwapContext();

  const swipeToDismissGesture = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      startY.value = null;
    })
    .onUpdate(e => {
      if (
        configProgress.value !== NavigationSteps.SHOW_REVIEW &&
        configProgress.value !== NavigationSteps.SHOW_GAS &&
        configProgress.value !== NavigationSteps.SHOW_SETTINGS
      ) {
        return;
      }

      if (startY.value === null) {
        startY.value = e.absoluteY;
      }

      const yDelta = e.absoluteY - (startY.value ?? 0);

      const downwardMovement = yDelta > 0 ? yDelta : 0;
      const upwardMovement = interpolate(yDelta, [-200, 0], [-200, 0], 'clamp');
      const friction = interpolate(yDelta, [-200, 0], [10, 1], 'clamp');

      gestureY.value = downwardMovement + upwardMovement / friction;
    })
    .onEnd(e => {
      const yDelta = e.absoluteY - (startY.value ?? 0);
      const yVelocity = e.velocityY;

      const isBeyondDismissThreshold = (yVelocity >= 0 && yDelta > 80) || yVelocity > 500;
      if (isBeyondDismissThreshold) {
        if (configProgress.value === NavigationSteps.SHOW_REVIEW) {
          SwapNavigation.handleDismissReview();
        } else if (configProgress.value === NavigationSteps.SHOW_GAS) {
          SwapNavigation.handleDismissGas();
        } else if (configProgress.value === NavigationSteps.SHOW_SETTINGS) {
          SwapNavigation.handleDismissSettings();
        }
      }
      gestureY.value = withSpring(0, SPRING_CONFIGS.springConfig);
    });

  return {
    swipeToDismissGesture,
    gestureY,
  };
};

```

### Core Architecture Module: `src/__swaps__/screens/Swap/hooks/useEstimatedGasFee.ts`
```
import { type GasSettings } from '@/features/gas/hooks/useCustomGas';
import { useEstimatedGasFee } from '@/features/gas/hooks/useEstimatedGasFee';
import { useSelectedGas } from '@/features/gas/hooks/useSelectedGas';
import { ChainId } from '@/features/network/types/backendNetworks';
import { useSwapsStore } from '@/state/swaps/swapsStore';

import { useSyncedSwapQuoteStore } from '../providers/SyncSwapStateAndSharedValues';
import { useSwapFeeEstimateGasLimit } from './useSwapEstimatedGasLimit';

export function useSwapEstimatedGasFee(overrideGasSettings?: GasSettings) {
  const preferredNetwork = useSwapsStore(s => s.preferredNetwork);
  const { assetToSell, quote, chainId = preferredNetwork || ChainId.mainnet } = useSyncedSwapQuoteStore();
  const gasSettings = useSelectedGas(chainId);

  const estimatedGasLimit = useSwapFeeEstimateGasLimit({ chainId, assetToSell, quote });
  const estimatedFee = useEstimatedGasFee({ chainId, gasLimit: estimatedGasLimit, gasSettings: overrideGasSettings || gasSettings });

  return estimatedFee;
}

```

### Core Architecture Module: `src/__swaps__/screens/Swap/hooks/useSearchCurrencyLists.ts`
```
import { useEffect, useMemo, useRef } from 'react';

import { isAddress } from '@ethersproject/address';
import { rankings } from 'match-sorter';
import { useDeepCompareMemo } from 'use-deep-compare';
import { type Address } from 'viem';

import {
  ADDRESS_SEARCH_KEY,
  NAME_SYMBOL_SEARCH_KEYS,
  useSwapsSearchStore,
  useTokenSearchStore,
  useUnverifiedTokenSearchStore,
} from '@/__swaps__/screens/Swap/resources/search/searchV2';
import { type AddressOrEth, type AssetType, type ExtendedAnimatedAssetWithColors, type ParsedSearchAsset } from '@/__swaps__/types/assets';
import { type AssetToBuySectionId, type FavoritedAsset, type SearchAsset, type TokenToBuyListItem } from '@/__swaps__/types/search';
import { type RecentSwap } from '@/__swaps__/types/swap';
import { analytics } from '@/analytics';
import { getUniqueId } from '@/entities/assetId';
import { ChainId } from '@/features/network/types/backendNetworks';
import { time } from '@/framework/core/utils/time';
import { isNativeAsset } from '@/handlers/assets';
import { addHexPrefix } from '@/handlers/web3';
import { useFavorites } from '@/resources/favorites';
import { useSwapsStore } from '@/state/swaps/swapsStore';
import isLowerCaseMatch from '@/utils/isLowerCaseMatch';
import { filterList } from '@/utils/search';

import { usePopularTokensStore } from '../resources/search/discovery';

const ANALYTICS_LOG_THROTTLE_MS = time.seconds(5);
const MAX_POPULAR_RESULTS = 3;

export function useSearchCurrencyLists() {
  const lastTrackedTimeRef = useRef<number | null>(null);
  const verifiedAssets = useTokenSearchStore(state => state.getData());
  const unverifiedAssets = useUnverifiedTokenSearchStore(state => state.getData());
  const popularAssets = usePopularTokensStore(state => state.getData());
  const { favoritesMetadata: favorites } = useFavorites();

  const bridgedInputAsset = useSwapsStore(
    state => getBridgedAsset(state.inputAsset, state.selectedOutputChainId ?? ChainId.mainnet),
    isUniqueIdEqual
  );
  const query = useSwapsSearchStore(state => state.searchQuery.trim().toLowerCase());
  const toChainId = useSwapsStore(state => state.selectedOutputChainId ?? ChainId.mainnet);

  const getRecentSwapsByChain = useSwapsStore(state => state.getRecentSwapsByChain);
  const recentSwaps = useMemo(() => getRecentSwapsByChain(toChainId), [getRecentSwapsByChain, toChainId]);

  const [isContractSearch, keys] = useMemo(() => {
    const isContract = isAddress(query);
    return [isContract, isContract ? ADDRESS_SEARCH_KEY : NAME_SYMBOL_SEARCH_KEYS];
  }, [query]);

  const unfilteredFavorites = useMemo(() => {
    const filtered = Object.values(favorites)
      .filter(token => token.networks[toChainId]?.address)
      .map<FavoritedAsset>(favToken => {
        const networks: SearchAsset['networks'] = favToken.networks;
        const network = networks[toChainId];
        const address = (network?.address || favToken.address) as AddressOrEth;
        return {
          ...favToken,
          address,
          chainId: toChainId,
          favorite: true,
          highLiquidity: favToken?.highLiquidity ?? false,
          isNativeAsset: isNativeAsset(address, toChainId),
          isRainbowCurated: favToken.isRainbowCurated ?? false,
          isVerified: favToken.isVerified ?? false,
          mainnetAddress: (networks?.[ChainId.mainnet]?.address || favToken.mainnet_address || '') as AddressOrEth,
          networks,
          type: favToken.type ? (favToken.type as AssetType) : undefined,
          uniqueId: getUniqueId(address, toChainId),
        };
      });
    return filtered.length ? filtered : undefined;
  }, [favorites, toChainId]);

  const filteredBridgeAsset = useMemo(() => {
    if (!bridgedInputAsset) return null;
    return filterBridgeAsset({ asset: bridgedInputAsset, filter: query, isAddress: isContractSearch })
      ? {
          ...bridgedInputAsset,
          favorite: !!unfilteredFavorites?.some(fav => fav.networks?.[toChainId]?.address === bridgedInputAsset.address),
        }
      : null;
  }, [bridgedInputAsset, isContractSearch, query, toChainId, unfilteredFavorites]);

  const favoritesList = useMemo(() => {
    if (query === '') return unfilteredFavorites;
    else {
      const filtered = filterList(unfilteredFavorites || [], isContractSearch ? addHexPrefix(query).toLowerCase() : query, keys, {
        threshold: isContractSearch ? rankings.CASE_SENSITIVE_EQUAL : rankings.CONTAINS,
      });
      return filtered.length ? filtered : undefined;
    }
  }, [isContractSearch, keys, query, unfilteredFavorites]);

  const recentsForChain = useMemo(() => {
    const filtered = filterList(recentSwaps, query, keys, {
      threshold: isContractSearch ? rankings.CASE_SENSITIVE_EQUAL : rankings.CONTAINS,
      sorter: matchItems => matchItems.sort((a, b) => b.item.swappedAt - a.item.swappedAt),
    });
    return filtered.length ? filtered : undefined;
  }, [query, isContractSearch, keys, recentSwaps]);

  const popularAssetsForChain = useMemo(() => {
    if (!popularAssets) return undefined;
    if (!query) return popularAssets;
    const filtered = filterList(popularAssets, query, keys, {
      threshold: isContractSearch ? rankings.CASE_SENSITIVE_EQUAL : rankings.CONTAINS,
    });
    return filtered.length ? filtered : undefined;
  }, [isContractSearch, keys, popularAssets, query]);

  const data = useDeepCompareMemo(() => {
    return {
      isLoading: false,
      results: buildListSectionsData({
        combinedData: {
          bridgeAsset: filteredBridgeAsset,
          crosschainExactMatches: verifiedAssets?.crosschainResults,
          popularAssets: popularAssetsForChain,
          recentSwaps: recentsForChain,
          unverifiedAssets: unverifiedAssets,
          verifiedAssets: verifiedAssets?.results,
        },
        favoritesList,
        filteredBridgeAssetAddress: filteredBridgeAsset?.address,
      }),
    };
  }, [
    favoritesList,
    filteredBridgeAsset,
    popularAssetsForChain,
    recentsForChain,
    unverifiedAssets,
    verifiedAssets?.crosschainResults,
    verifiedAssets?.results,
  ]);

  useEffect(() => {
    const query = useSwapsSearchStore.getState().searchQuery.trim();
    const now = Date.now();
    if (
      query.length <= 2 ||
      (lastTrackedTimeRef.current && now - lastTrackedTimeRef.current < ANALYTICS_LOG_THROTTLE_MS) ||
      useTokenSearchStore.getState().status !== 'success'
    ) {
      return;
    }
    lastTrackedTimeRef.current = now;
    const params = { screen: 'swap' as const, total_tokens: 0, no_icon: 0, query };
    for (const assetOrHeader of data.results) {
      if (assetOrHeader.listItemType === 'header') continue;
      if (!assetOrHeader.icon_url) params.no_icon += 1;
      params.total_tokens += 1;
    }
    analytics.track(analytics.event.tokenList, params);
  }, [data.results]);

  return data;
}

function getBridgedAsset(inputAsset: ExtendedAnimatedAssetWithColors | ParsedSearchAsset | null, toChainId: ChainId): SearchAsset | null {
  const isCrosschainSearch = inputAsset ? inputAsset.chainId !== toChainId : false;
  if (!inputAsset || !isCrosschainSearch || !inputAsset.bridging?.networks?.[toChainId]?.bridgeable) return null;

  const network = inputAsset?.networks?.[toChainId];
  if (!network?.address) return null;

  return {
    ...inputAsset,
    address: network.address,
    chainId: toChainId,
    decimals: network.decimals,
    isNativeAsset: isNativeAsset(network.address, toChainId),
    isVerified: !!inputAsset.bridging?.isBridgeable, // isVerified is always undefined for user assets, so we use isBridgeable as a proxy
    mainnetAddress: inputAsset.networks[ChainId.mainnet]?.address ?? (toChainId === ChainId.mainnet ? network.address : ('' as Address)),
    uniqueId: getUniqueId(network.address, toChainId),
  };
}

const mergeAssetsFavoriteStatus = ({
  assets,
  favoritesList,
}: {
  assets: SearchAsset[] | undefined;
  favoritesList: FavoritedAsset[] | undefined;
}): FavoritedAsset[] =>
  assets?.map(asset => ({ ...asset, favorite: favoritesList?.some(fav => fav.address === asset.address) ?? false })) || [];

const filterAssetsFromBridge = ({
  assets,
  filteredBridgeAssetAddress,
}: {
  assets: SearchAsset[] | undefined;
  filteredBridgeAssetAddress: string | undefined;
}): SearchAsset[] => assets?.filter(curatedAsset => !isLowerCaseMatch(curatedAsset?.address, filteredBridgeAssetAddress)) || [];

const filterAssetsFromRecentSwaps = ({
  assets,
  recentSwaps,
}: {
  assets: SearchAsset[] | undefined;
  recentSwaps: RecentSwap[] | undefined;
}): SearchAsset[] => (assets || []).filter(asset => !recentSwaps?.some(recent => recent.address === asset.address));

const filterAssetsFromPopularAssets = ({
  assets,
  popularAssets,
}: {
  assets: SearchAsset[] | undefined;
  popularAssets: SearchAsset[] | undefined;
}): SearchAsset[] => (assets || []).filter(asset => !popularAssets?.some(popular => popular.address === asset.address));

const filterAssetsFromBridgeAndRecent = ({
  assets,
  recentSwaps,
  filteredBridgeAssetAddress,
}: {
  assets: SearchAsset[] | undefined;
  recentSwaps: RecentSwap[] | undefined;
  filteredBridgeAssetAddress: string | undefined;
}): SearchAsset[] =>
  filterAssetsFromRecentSwaps({
    assets: filterAssetsFromBridge({ assets, filteredBridgeAssetAddress }),
    recentSwaps: recentSwaps,
  });

const filterAssetsFromBridgeAndRecentAndPopular = ({
  assets,
  recentSwaps,
  popularAssets,
  filteredBridgeAssetAddress,
}: {
  assets: SearchAsset[] | undefined;
  recentSwaps: RecentSwap[] | undefined;
  popularAssets: SearchAsset[] | undefined;
  filteredBridgeAssetAddress: string | undefined;
}): SearchAsset[] =>
  filterAssetsFromPopularAssets({
    assets: filterAssetsFromRecentSwaps({
      assets: filterAssetsFromBridge({ assets, filteredBridgeAssetAddress }),
      recentSwaps: recentSwaps,
    }),
    popularAssets,
  });

const filterAssetsFromFavoritesAndBridgeAndRecentAndPopular = ({
  assets,
  favoritesList,

```

### Core Architecture Module: `src/__swaps__/screens/Swap/hooks/useSwapEstimatedGasLimit.ts`
```
import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { type ParsedSearchAsset } from '@/__swaps__/types/assets';
import { isCrosschainQuote } from '@/__swaps__/utils/quotes';
import { useBackendNetworksStore } from '@/features/network/stores/backendNetworksStore';
import { type ChainId } from '@/features/network/types/backendNetworks';
import { estimateUnlockAndCrosschainSwap } from '@/raps/actions/crosschainSwap';
import { estimateUnlockAndSwapGasLimits } from '@/raps/actions/swap';
import { createQueryKey, type QueryConfigWithSelect, type QueryFunctionArgs, type QueryFunctionResult } from '@/react-query';
import { type CrosschainQuote, type Quote, type QuoteError } from '@rainbow-me/swaps';

// ///////////////////////////////////////////////
// Query Types

type EstimateSwapGasLimitArgs = {
  chainId?: ChainId;
  quote?: Quote | CrosschainQuote | QuoteError | null;
  assetToSell?: ParsedSearchAsset | null;
  usePlaceholderData?: boolean;
};

// ///////////////////////////////////////////////
// Query Key

const estimateSwapGasLimitQueryKey = ({ chainId, quote, assetToSell }: EstimateSwapGasLimitArgs) =>
  createQueryKey('estimateSwapGasLimit', { chainId, quote, assetToSell });

type EstimateSwapGasLimitQueryKey = ReturnType<typeof estimateSwapGasLimitQueryKey>;

function getDefaultSwapGasLimit(chainId: ChainId): string {
  return useBackendNetworksStore.getState().getChainGasUnits(chainId).basic.swap;
}

// ///////////////////////////////////////////////
// Query Function

async function estimateSwapGasLimitQueryFunction({
  queryKey: [{ chainId, quote, assetToSell }],
}: QueryFunctionArgs<typeof estimateSwapGasLimitQueryKey>) {
  if (!chainId) throw 'chainId is required';

  if (!quote || 'error' in quote || !assetToSell) {
    const gasLimit = getDefaultSwapGasLimit(chainId);
    return {
      transactionGasLimit: gasLimit,
      feeEstimateGasLimit: gasLimit,
      chainId,
    };
  }

  let gasLimitEstimate;
  if (isCrosschainQuote(quote)) {
    const gasLimit = await estimateUnlockAndCrosschainSwap({
      chainId,
      quote,
    });
    gasLimitEstimate = { transactionGasLimit: gasLimit, feeEstimateGasLimit: gasLimit };
  } else {
    gasLimitEstimate = await estimateUnlockAndSwapGasLimits({
      chainId,
      quote,
    });
  }

  if (!gasLimitEstimate.transactionGasLimit || !gasLimitEstimate.feeEstimateGasLimit) {
    const gasLimit = getDefaultSwapGasLimit(chainId);
    return {
      transactionGasLimit: gasLimit,
      feeEstimateGasLimit: gasLimit,
      chainId,
    };
  }
  return { ...gasLimitEstimate, chainId };
}

type EstimateSwapGasLimitResult = QueryFunctionResult<typeof estimateSwapGasLimitQueryFunction>;

// ///////////////////////////////////////////////
// Query Hook

function useSwapGasLimits(
  { chainId, quote, assetToSell, usePlaceholderData = true }: EstimateSwapGasLimitArgs,
  config: QueryConfigWithSelect<EstimateSwapGasLimitResult, Error, EstimateSwapGasLimitResult, EstimateSwapGasLimitQueryKey> = {}
) {
  const defaultGasLimit = chainId && usePlaceholderData ? getDefaultSwapGasLimit(chainId) : undefined;
  const placeholderData = useMemo(
    () =>
      chainId && usePlaceholderData && defaultGasLimit
        ? { chainId, transactionGasLimit: defaultGasLimit, feeEstimateGasLimit: defaultGasLimit }
        : undefined,
    [chainId, defaultGasLimit, usePlaceholderData]
  );

  const { data } = useQuery(
    estimateSwapGasLimitQueryKey({
      chainId,
      quote,
      assetToSell,
    }),
    estimateSwapGasLimitQueryFunction,
    {
      staleTime: 30 * 1000, // 30s
      cacheTime: 60 * 1000, // 1min
      notifyOnChangeProps: ['data'],
      keepPreviousData: true,
      enabled: !!chainId && !!quote && !!assetToSell && assetToSell.chainId === chainId,
      placeholderData,
      ...config,
    }
  );

  // Keep the previous estimate while refetching on one chain, but not after the selected chain changes.
  return data && data.chainId === chainId ? data : placeholderData;
}

export function useSwapEstimatedGasLimit(
  parameters: EstimateSwapGasLimitArgs,
  config: QueryConfigWithSelect<EstimateSwapGasLimitResult, Error, EstimateSwapGasLimitResult, EstimateSwapGasLimitQueryKey> = {}
): string | undefined {
  return useSwapGasLimits(parameters, config)?.transactionGasLimit;
}

export function useSwapFeeEstimateGasLimit(
  parameters: EstimateSwapGasLimitArgs,
  config: QueryConfigWithSelect<EstimateSwapGasLimitResult, Error, EstimateSwapGasLimitResult, EstimateSwapGasLimitQueryKey> = {}
): string | undefined {
  return useSwapGasLimits(parameters, config)?.feeEstimateGasLimit;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7865** (2026-10-05): **Set up feature flags for Solana**
  *Symptoms*: Solana feature flags
  **Post-Mortem & Fix Analysis**:
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@jin/solana-feature-flag/9088baa423f56a993a18ca47a3e862b413d0e1f8.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@jin/solana-feature-flag/9088baa423f56a993a18ca47a3e862b413d0e1f8.ipa&platform=ios&destination=device) for 9088baa423f56a993a18ca47a3e862b413d0e1f8

- **Issue #7864** (2026-10-05): **refactor(tests): migrate from Jest to Vitest**
  *Symptoms*: ## What changed (plus any additional context for devs)  - Migrates unit test infrastructure from Jest to Vitest v5.0.3 and updates associated commands, CI, and linting   - Runs around 3-4x faster locally. `yarn test` dropped from ~`16.5s` to ~`4.8s` on my machine.   - Local runs default to `maxWorkers: '50%'`   - CI uses `--maxWorkers=100%` - Adds shared test setup for native dependencies and store storage - Replaces repeated positions-store mocks with real stores and reusable fixtures - Removes unnecessary UI imports from network and gas utilities - Stops `logger.test.ts` from printing expected errors during test runs - Deletes unused mocks  ## Screen recordings / screenshots  ## What to test 
  **Post-Mortem & Fix Analysis**:
  > **Review the following changes in direct dependencies.** Learn more about [Socket for GitHub](https://socket.dev?utm_medium=gh).  <table> <thead> <tr> <th>Diff</th> <th width="200px">Package</th> <th align="center" width="100px">Supply Chain<br/>Security</th> <th align="center" width="100px">Vulnerability</th> <th align="center" width="100px">Quality</th> <th align="center" width="100px">Maintenance</th> <th align="center" width="100px">License</th> </tr> </thead> <tbody> <tr><td align="center"><a href="https://socket.dev/dashboard/org/rainbow-me/diff-scan/4afe190c-2083-4427-9efc-8619bb19a4ba?tab=dependencies&dependency_item_key=101955198442"><img src="https://github-app-statics.socket.dev/diff-added.svg" title="Added" alt="Added" width="20" height="20"></a></td><td><a href="https://socket.dev/dashboard/org/rainbow-me/diff-scan/4afe190c-2083-4427-9efc-8619bb19a4ba?tab=dependencies&dependency_item_key=101955198442">npm/​vitest@​5.0.3</a></td><td align="center"><a href="https://socket.de
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/migrate-to-vitest/98fd39ce469f18aeaa8ab7dd4152cb2687d0cdc6.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/migrate-to-vitest/98fd39ce469f18aeaa8ab7dd4152cb2687d0cdc6.ipa&platform=ios&destination=device) for 98fd39ce469f18aeaa8ab7dd4152cb2687d0cdc6
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/migrate-to-vitest/988aadb516adb8f83bb85b869491760de01fbb11.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/migrate-to-vitest/988aadb516adb8f83bb85b869491760de01fbb11.ipa&platform=ios&destination=device) for 988aadb516adb8f83bb85b869491760de01fbb11

- **Issue #7863** (2026-10-02): **fix(cash): e2e failures and input bugs**
  *Symptoms*: ## What changed (plus any additional context for devs)  - Fixes the failing Cash `SetupRecovery` test   - The recovery fixture uses an existing account with a passkey. Since #7822, submitting it opens a choice between signing in and recovering the account. The old test still expected OTP immediately. - Fixes phone number formatting and jank in controlled Cash inputs   - Previously, typing an extra digit after `(123) 456-7890` changed the number to `2345678905`. The input now distinguishes country-code prefixes from the area code and rejects edits containing unsupported characters, another country code, or too many digits, leaving the existing number unchanged.   - RN 0.81.6 fails to account for UIKit’s default paragraph style when comparing text in controlled inputs, which breaks the `[newText isEqualToAttributedString:oldText]` equality check in `RCTBaseTextInputView` and causes RN to rewrite unchanged text, producing erratic cursor shifts and allowing typed characters to be misplaced. Explicitly setting `textAlign` corrects that internal discrepancy and prevents the rewrites along with the bugs and input jank they create.     - While this applies broadly to controlled inputs, this immediate fix is scoped to the Cash inputs  ## Screen recordings / screenshots  ## What to test 
  **Post-Mortem & Fix Analysis**:
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/fix-cash-e2e/afac2bd3ef3e0910778cac5d8f44fa2facc076c7.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/fix-cash-e2e/afac2bd3ef3e0910778cac5d8f44fa2facc076c7.ipa&platform=ios&destination=device) for afac2bd3ef3e0910778cac5d8f44fa2facc076c7

- **Issue #7847** (2026-09-30): **bump: `react-native-blur-view`**
  *Symptoms*: ## What changed (plus any additional context for devs)  - Updates `react-native-blur-view` to the latest commit   - Fixes erratic variable blur brightness spikes in the main tab bar that started occurring in iOS 26   - Improves general `BlurView` performance - Removes the existing `react-native-blur-view` patch as the original problem was addressed in the library  ## Screen recordings / screenshots  Before:  https://github.com/user-attachments/assets/cc106f5c-1947-4300-982a-09d4ad754caa  After:  https://github.com/user-attachments/assets/b61444ee-98eb-444d-bbef-cc3f948d56fa  ## What to test 
  **Post-Mortem & Fix Analysis**:
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/update-react-native-blur-view/e947ba4c4bf8e727e96b52b1341631c691c673e0.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/@christian/update-react-native-blur-view/e947ba4c4bf8e727e96b52b1341631c691c673e0.ipa&platform=ios&destination=device) for e947ba4c4bf8e727e96b52b1341631c691c673e0

- **Issue #7846** (2026-10-01): **feat(CASH): show unavailable notice to blocked users**
  *Symptoms*: Fixes APP-4131  ## Why?  Backend can block a Cash account for suspicious activity. The app needs to recognize that and tell the user only "Sorry, this feature is unavailable at the moment", without revealing the block, when they try to sign in, continue setup, or transact.  Blocked-account responses now show a generic **Unavailable** half-sheet instead of each flow's generic error. Dismissing it returns the flow to its resting state with input preserved. Copy and visuals are placeholders until DES-178 lands.  The notice is triggered by:  - UserService body code `1340` (`USER_ACCESS_BLOCKED`) on any endpoint. Matching ignores HTTP status while backend moves these from 400 to 403 (BACK-3309). - `GetUserStatus` returning `access.status = ACCESS_STATUS_BLOCKED`. - Ramp HTTP 403 with code `403` (`GENERAL_FORBIDDEN`), which Ramp returns for any account that is not active.  `FinishRecovery` keeps its existing "Account recovery is locked" sheet for `1340`, because backend also uses that code for the too-many-attempts recovery lockout.  ## Approach  - The VPN network-policy notice from #7832 (unreleased) is generalized into one access-refusal mechanism with two reasons, `networkPolicy` and `unavailable`. Every flow that already treated the VPN warning as handled treats a block the same way, and one app-level host renders both sheets. - The persisted buy-order step `networkPolicy` is renamed `accessRefused`. A stale persisted value is reset on the next Add Cash open.
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/rainbow/issue/APP-4131">APP-4131</a></p>
  > @cubic-dev-ai review
  > > @cubic-dev-ai review  @i1skn I have started the AI code review. It will take a few minutes to complete.

- **Issue #7845** (2026-10-01): **APP-4130: Add remote flag to pause Cash sign-ups**
  *Symptoms*: Fixes APP-4130  ## What changed (plus any additional context for devs)  At launch we need a way to stop new Cash sign-ups if volume gets too high, without turning Cash off for people who already have an account.  A new Firebase flag, `cash_signup_enabled`, defaults to `true`, so nothing changes until someone flips it. When it's `false`, a user without a Cash account who taps Add Cash still sees the Cash Deposits intro, but its main button is **Sign In** (the existing passkey sign-in) instead of Set Up Account, and the note under it explains that new sign-ups are paused. The Sign In link in the top corner is hidden, since the main button now does the same thing. **Other Deposit Methods** still opens the legacy on-ramp providers. No new sign-ups can start.  - Account holders are unaffected. Add Cash still takes them straight to the Add Cash sheet. - Someone who already verified their phone in the current app session still goes back into Setup. That's the existing in-memory resume path; they already have a backend sign-up and are not a new sign-up. - The copy is Jin's from the APP-4130 ticket.  <!-- ship-visuals:start --> ## Screen recordings / screenshots  <!-- ship-visuals:source head=43528dd80e105fa98469982ca75dfb54131c1250+working-tree platform=ios flow=manual-argent -->  **iOS: sign-ups paused, user without a Cash account taps Add Cash**  ![Sign-ups paused intro](https://github.com/user-attachments/assets/bce028d1-0b77-4c1d-94be-6ed9e1dd1a06) <!-- ship-visuals:end -->  ## W
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/rainbow/issue/APP-4130">APP-4130</a></p>
  > @cubic-dev-ai review
  > > @cubic-dev-ai review  @i1skn I have started the AI code review. It will take a few minutes to complete.

- **Issue #7843** (2026-09-29): **fix(CASH): use backend unsupported state metadata**
  *Symptoms*: Previously, the error for unsupported state was hardcoded to NY. This adds more flexible support with a new backend endpoint update that returns state details.  There is generic fallback copy if no state information is provided.  Backend not released yet - screenshots are from mocking backend response as per https://github.com/rainbow-me/protobuf-registry/pull/170   <img width="1206" height="2622" alt="Simulator Screenshot - Rainbow New York Preview - 2026-09-28 at 13 11 30" src="https://github.com/user-attachments/assets/d7482c05-063c-4e89-86f8-bd0c94c792c9" />  <img width="1206" height="2622" alt="Simulator Screenshot - Rainbow California Preview - 2026-09-28 at 12 22 25" src="https://github.com/user-attachments/assets/be294202-13f7-427d-8929-be32c03da000" /> <img width="1206" height="2622" alt="Simulator Screenshot - Rainbow Generic State Preview - 2026-09-28 at 13 15 38" src="https://github.com/user-attachments/assets/a24b3283-e83b-4bbf-a79e-07514ce932e0" />   
  **Post-Mortem & Fix Analysis**:
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/cash-unsupported-location/f36c40369a0e040aaf7be2fc1d77778cef33b19c.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/cash-unsupported-location/f36c40369a0e040aaf7be2fc1d77778cef33b19c.ipa&platform=ios&destination=device) for f36c40369a0e040aaf7be2fc1d77778cef33b19c
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/cash-unsupported-location/53da451e87e0f13545a843d1df19703f91ec175a.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/cash-unsupported-location/53da451e87e0f13545a843d1df19703f91ec175a.ipa&platform=ios&destination=device) for 53da451e87e0f13545a843d1df19703f91ec175a
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/cash-unsupported-location/12a72354157165a419e8d3af97e97ea987358425.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/cash-unsupported-location/12a72354157165a419e8d3af97e97ea987358425.ipa&platform=ios&destination=device) for 12a72354157165a419e8d3af97e97ea987358425

- **Issue #7842** (2026-09-28): **refactor(analytics): send events directly to PostHog**
  *Symptoms*: Fixes APP-4111  - Update analytics to use Posthog instead of Rudderstack - AppsFlyer integration was partially automatic (via the AppsFlyer SDK) and partially hooked up via Rudderstack. Separate hookup work is needed for the "via Rudderstack" part to hook it up via Posthog instead. (outside of the scope of this PR) - a few gotchas are noted inline via comments on this PR  Ran locally from simulator with envs and confirmed events showing up in Posthog now
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/rainbow/issue/APP-4111">APP-4111</a></p>
  > **Review the following changes in direct dependencies.** Learn more about [Socket for GitHub](https://socket.dev?utm_medium=gh).  <table> <thead> <tr> <th>Diff</th> <th width="200px">Package</th> <th align="center" width="100px">Supply Chain<br/>Security</th> <th align="center" width="100px">Vulnerability</th> <th align="center" width="100px">Quality</th> <th align="center" width="100px">Maintenance</th> <th align="center" width="100px">License</th> </tr> </thead> <tbody> <tr><td align="center"><a href="https://socket.dev/dashboard/org/rainbow-me/diff-scan/3e5782f5-5f56-45b2-89fd-892f81f08834?tab=dependencies&dependency_item_key=101951735748"><img src="https://github-app-statics.socket.dev/diff-added.svg" title="Added" alt="Added" width="20" height="20"></a></td><td><a href="https://socket.dev/dashboard/org/rainbow-me/diff-scan/3e5782f5-5f56-45b2-89fd-892f81f08834?tab=dependencies&dependency_item_key=101951735748">npm/​posthog-react-native@​4.77.0</a></td><td align="center"><a href="ht
  > Launch in [simulator](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/direct-posthog-analytics/789aaa08130a9d5f0d044ba86c801e9cdb2ae039.app.zip&platform=ios&destination=simulator) or [device](http://localhost:29070/install/http?url=https://app-team.p.rainbow.me/jin/direct-posthog-analytics/789aaa08130a9d5f0d044ba86c801e9cdb2ae039.ipa&platform=ios&destination=device) for 789aaa08130a9d5f0d044ba86c801e9cdb2ae039

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

### Incident Patch 1: `9d718934` (2026-10-02)
**Commit Message**: fix(cash): e2e failures and input bugs (#7863)

## What changed (plus any additional context for devs)

- Fixes the failing Cash `SetupRecovery` test
- The recovery fixture uses an existing account with a passkey. Since
#7822, submitting it opens a choice between signing in and recovering
the account. The old test still expected OTP immediately.
- Fixes phone number formatting and jank in controlled Cash inputs
- Previously, typing an extra digit after `(123) 456-7890` changed the
number to `2345678905`. The input now distinguishes country-code
prefixes from the area code and rejects edits containing unsupported
characters, another country code, or too many digits, leaving the
existing number unchanged.
- RN 0.81.6 fails to account for UIKit’s default paragraph style when
comparing text in controlled inputs, which breaks the `[newText
isEqualToAttributedString:oldText]` equality check in
`RCTBaseTextInputView` and causes RN to rewrite unchanged text,
producing erratic cursor shifts and allowing typed characters to be
misplaced. Explicitly setting `textAlign` corrects that internal
discrepancy and prevents the rewrites along with the bugs and input jank
they create.
- While this app

**File**: `e2e/flows/cash/SetupRecovery.yaml` (modified, +8/-1)
```diff
@@ -23,12 +23,19 @@ tags:
     id: cash-deposit-intro-set-up-account
 - assertVisible:
     text: 'Connect your phone number'
-# Mock 5550001303 starts account recovery instead of the already-registered dead end.
+# Mock 5550001303 belongs to an existing account with a passkey.
 - tapOn:
     id: cash-setup-phone-input
 - inputText: '5550001303'
 - tapOn:
     id: cash-setup-next
+- extendedWaitUntil:
+    visible:
+      id: cash-setup-existing-account-recover
+    timeout: 10000
+- waitForAnimationToEnd
+- tapOn:
+    id: cash-setup-existing-account-recover
 - extendedWaitUntil:
     visible:
       text: 'Confirm your phone'
```

**File**: `src/features/cash/components/useSetupInputTextStyle.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ export function useSetupInputTextStyle(): TextStyle {
       letterSpacing: 0.37,
       paddingLeft: 14,
       paddingRight: 16,
+      textAlign: 'left',
       // Fixed height + zero vertical padding lets Android gravity center the text; a snug
       // padding-derived height positions it baseline-from-top, which sits high with this font.
       ...(Platform.OS === 'android'
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/useSubmitPhoneFlow.test.ts` (modified, +23/-1)
```diff
@@ -75,13 +75,35 @@ describe('useSubmitPhoneFlowStore.setDigits', () => {
     { input: '+1 (415) 555-0100', expected: '4155550100' },
     { input: '14155550100', expected: '4155550100' },
     { input: '1234567890', expected: '1234567890' },
-    { input: '(415) 555-01004', expected: '4155550100' },
   ];
 
   it.each(cases)('normalizes $input to $expected', ({ input, expected }) => {
     flow().setDigits(input);
     expect(flow().digits).toBe(expected);
   });
+
+  it.each(['(415) 555-01004', '(415) 555-00100', '+44 20 7946 0958'])(
+    'preserves the current phone and session when rejecting %s',
+    input => {
+      flow().setDigits(DIGITS);
+      useCashSetupSessionStore.getState().setPhoneAlreadyRegistered(DIGITS);
+      const previousFlow = flow();
+      const previousSession = session();
+
+      flow().setDigits(input);
+
+      expect(flow()).toBe(previousFlow);
+      expect(session()).toBe(previousSession);
+    }
+  );
+
+  it('allows clearing an existing number', () => {
+    flow().setDigits(DIGITS);
+
+    flow().setDigits('');
+
+    expect(flow().digits).toBe('');
+  });
 });
 
 describe('useSubmitPhoneFlowStore.reset', () => {
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/useSubmitPhoneFlow.ts` (modified, +5/-1)
```diff
@@ -86,8 +86,12 @@ export const useSubmitPhoneFlowStore = createBaseStore<SubmitPhoneFlowStore>((se
   setDigits: text => {
     const { state } = get();
     if (state === 'submitting' || state === 'signingIn') return;
+
+    const digits = extractNationalDigits(text);
+    if (digits === null) return;
+
     clearPhoneAlreadyRegistered();
-    set({ digits: extractNationalDigits(text), state: 'entry' });
+    set({ digits, state: 'entry' });
   },
 
   submit: async () => {
```

**File**: `src/features/cash/screens/cash-sign-in/CashSignInScreen.tsx` (modified, +4/-1)
```diff
@@ -27,7 +27,10 @@ export const CashSignInScreen = memo(function CashSignInScreen() {
   const inputTextStyle = useSetupInputTextStyle();
 
   const setDigits = useCallback((text: string) => {
-    setRawDigits(extractNationalDigits(text));
+    const digits = extractNationalDigits(text);
+    if (digits === null) return;
+
+    setRawDigits(digits);
     setState(s => (s === 'submitting' ? s : 'entry'));
   }, []);
 
```

**File**: `src/features/cash/utils/phoneNumber.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { extractNationalDigits } from './phoneNumber';
+
+describe('extractNationalDigits', () => {
+  it.each([
+    ['', ''],
+    ['1', '1'],
+    ['(212) 5', '2125'],
+    ['(1) 555-0100', '15550100'],
+    ['(212) 555-0100', '2125550100'],
+    ['+1 212', '212'],
+  ])('preserves national digits in %s', (text, expected) => {
+    expect(extractNationalDigits(text)).toBe(expected);
+  });
+
+  it.each(['+1 (212) 555-0100', '+ 1 (212) 555-0100', '1 (212) 555-0100', '(1) 212-555-0100', '(+1) 212-555-0100', '12125550100'])(
+    'removes the country calling code from %s',
+    text => {
+      expect(extractNationalDigits(text)).toBe('2125550100');
+    }
+  );
+
+  it.each(['(123) 456-78905', '(212) 555-00100', '212555010099', '+1 212555010099', '+44 20 7946 0958', '(212) 555-0100 ext. 99'])(
+    'rejects %s without truncating it',
+    text => {
+      expect(extractNationalDigits(text)).toBeNull();
+    }
+  );
+});
```

**File**: `src/features/cash/utils/phoneNumber.ts` (modified, +17/-6)
```diff
@@ -2,13 +2,24 @@ export const US_COUNTRY_CALLING_CODE = '1';
 
 export const NATIONAL_NUMBER_LENGTH = 10;
 
-// Pasted or AutoFilled values may carry the +1 country code on top of the 10 national digits.
-export function extractNationalDigits(text: string): string {
-  let digits = text.replace(/\D/g, '');
-  if (digits.length > NATIONAL_NUMBER_LENGTH && digits.startsWith(US_COUNTRY_CALLING_CODE)) {
-    digits = digits.slice(US_COUNTRY_CALLING_CODE.length);
+const PHONE_FORMATTING = /[\s().-]/g;
+const COUNTRY_CODE_PREFIX = /^\s*(?:1|\(\s*1\s*\))/;
+const DIGITS_ONLY = /^\d*$/;
+
+/**
+ * Normalizes edits for the +1 phone field, preserving incomplete numbers.
+ * Returns null for unsupported input or excess national digits.
+ */
+export function extractNationalDigits(text: string): string | null {
+  let input = text.replace(PHONE_FORMATTING, '');
+
+  if (input.startsWith('+1')) {
+    input = input.slice(2);
+  } else if (input.length === NATIONAL_NUMBER_LENGTH + 1 && COUNTRY_CODE_PREFIX.test(text)) {
+    input = input.slice(1);
   }
-  return digits.slice(0, NATIONAL_NUMBER_LENGTH);
+
+  return input.length <= NATIONAL_NUMBER_LENGTH && DIGITS_ONLY.test(input) ? input : null;
 }
 
 export function formatNationalNumber(digits: string): string {
```

---

### Incident Patch 2: `055c1158` (2026-09-29)
**Commit Message**: fix(CASH): use backend unsupported state metadata (#7843)

Previously, the error for unsupported state was hardcoded to NY. This
adds more flexible support with a new backend endpoint update that
returns state details.

There is generic fallback copy if no state information is provided.

Backend not released yet - screenshots are from mocking backend response
as per https://github.com/rainbow-me/protobuf-registry/pull/170


<img width="1206" height="2622" alt="Simulator Screenshot - Rainbow New
York Preview - 2026-09-28 at 13 11 30"
src="https://github.com/user-attachments/assets/d7482c05-063c-4e89-86f8-bd0c94c792c9"
/>

<img width="1206" height="2622" alt="Simulator Screenshot - Rainbow
California Preview - 2026-09-28 at 12 22 25"
src="https://github.com/user-attachments/assets/be294202-13f7-427d-8929-be32c03da000"
/>
<img width="1206" height="2622" alt="Simulator Screenshot - Rainbow
Generic State Preview - 2026-09-28 at 13 15 38"
src="https://github.com/user-attachments/assets/a24b3283-e83b-4bbf-a79e-07514ce932e0"
/>

**File**: `src/features/cash/screens/cash-deposit-setup/components/KycOutcomeSheet.test.tsx` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { isValidElement } from 'react';
+
+import { KycRejectionReasonCode, type UnsupportedLocation } from '../../../services/userClient';
+import { KycOutcomeSheet } from './KycOutcomeSheet';
+
+jest.mock('react', () => ({
+  ...jest.requireActual('react'),
+  memo: (component: unknown) => component,
+}));
+
+jest.mock('@/features/cash/components/CashStatusHalfSheet', () => ({ CashStatusHalfSheet: () => null }));
+jest.mock('@/navigation/Navigation', () => ({ goBack: jest.fn(), navigate: jest.fn() }));
+jest.mock('@/utils/openInBrowser', () => ({ openInBrowser: jest.fn() }));
+
+it.each<{ location?: UnsupportedLocation; name: string; code: string }>([
+  { location: { countryCode: 'US', regionName: 'New York', regionCode: 'NY' }, name: 'New York', code: 'NY' },
+  { location: { countryCode: 'US', regionName: 'California', regionCode: 'CA' }, name: 'California', code: 'CA' },
+  { location: { regionCode: 'CA' }, name: '', code: 'CA' },
+  { location: { regionName: 'California' }, name: 'California', code: 'your state' },
+  { location: { regionName: '', regionCode: '' }, name: '', code: 'your state' },
+  { location: {}, name: '', code: 'your state' },
+  { name: '', code: 'your state' },
+])('shows the backend location or generic copy for $location', ({ location, name, code }) => {
+  const sheet = KycOutcomeSheet({
+    outcome: 'unsupportedState',
+    onContinue: jest.fn(),
+    kycRejectionReason: { code: KycRejectionReasonCode.StateNotSupported, unsupportedLocation: location },
+  });
+  if (!isValidElement<{ title: string; description: string }>(sheet)) throw new Error('Expected a KYC outcome sheet');
+
+  expect(sheet.props.title).toBe(name ? `${name} support coming soon` : 'Support coming soon');
+  expect(sheet.props.description).toBe(
+    `Sorry, instant cash deposits are not available in ${code} yet.\n\nWe’ll let you know as soon as your state is supported.`
+  );
+});
```

**File**: `src/features/cash/screens/cash-deposit-setup/components/KycOutcomeSheet.tsx` (modified, +18/-5)
```diff
@@ -7,7 +7,7 @@ import Routes from '@/navigation/routesNames';
 import { RAINBOW_SUPPORT_URL } from '@/references/constants';
 import { openInBrowser } from '@/utils/openInBrowser';
 
-import { type KycOutcome } from '../../../services/userClient';
+import { type KycOutcome, type KycRejectionReason } from '../../../services/userClient';
 
 const l = i18n.l.cash.deposit_setup.kyc;
 const IDENTITY_VERIFIED_ICON = '􀯧';
@@ -21,7 +21,15 @@ function otherDepositMethods() {
   navigate(Routes.FIAT_ON_RAMP_SHEET);
 }
 
-export const KycOutcomeSheet = memo(function KycOutcomeSheet({ onContinue, outcome }: { onContinue: () => void; outcome: KycOutcome }) {
+export const KycOutcomeSheet = memo(function KycOutcomeSheet({
+  onContinue,
+  outcome,
+  kycRejectionReason,
+}: {
+  onContinue: () => void;
+  outcome: KycOutcome;
+  kycRejectionReason?: KycRejectionReason;
+}) {
   // Never `cancel()`: its warning sheet claims the user loses all progress, which
   // is untrue once the submission is with the provider.
   switch (outcome) {
@@ -57,10 +65,14 @@ export const KycOutcomeSheet = memo(function KycOutcomeSheet({ onContinue, outco
           title={i18n.t(l.rejected_title)}
         />
       );
-    case 'unsupportedState':
+    case 'unsupportedState': {
+      const regionName = kycRejectionReason?.unsupportedLocation?.regionName;
+      const regionCode = kycRejectionReason?.unsupportedLocation?.regionCode;
       return (
         <CashStatusHalfSheet
-          description={i18n.t(l.state_not_supported_description)}
+          description={
+            regionCode ? i18n.t(l.state_not_supported_description, { regionCode }) : i18n.t(l.state_not_supported_description_fallback)
+          }
           primaryAction={{
             label: i18n.t(i18n.l.cash.deposit_intro.other_deposit_methods),
             onPress: otherDepositMethods,
@@ -75,8 +87,9 @@ export const KycOutcomeSheet = memo(function KycOutcomeSheet({ onContinue, outco
           }}
           status="info"
           testID="cash-setup-kyc-state-not-supported"
-          title={i18n.t(l.state_not_supported_title)}
+          title={regionName ? i18n.t(l.state_not_supported_title, { regionName }) : i18n.t(l.state_not_supported_title_fallback)}
         />
       );
+    }
   }
 });
```

**File**: `src/features/cash/screens/cash-deposit-setup/components/KycReturnCheck.tsx` (modified, +4/-1)
```diff
@@ -19,6 +19,7 @@ export const KycReturnCheck = memo(function KycReturnCheck({ children }: { child
   const check = useRef<Promise<KycReturnResult> | null>(null);
   const active = useRef(false);
   const state = useKycReturnFlowStore(store => store.state);
+  const kycRejectionReason = useKycReturnFlowStore(store => store.kycRejectionReason);
 
   useLayoutEffect(() => {
     if (!isChecking) return;
@@ -46,7 +47,9 @@ export const KycReturnCheck = memo(function KycReturnCheck({ children }: { child
   return (
     <>
       {children}
-      {state !== 'idle' && state !== 'checking' ? <KycOutcomeSheet onContinue={continueAfterKyc} outcome={state} /> : null}
+      {state !== 'idle' && state !== 'checking' ? (
+        <KycOutcomeSheet onContinue={continueAfterKyc} outcome={state} kycRejectionReason={kycRejectionReason} />
+      ) : null}
     </>
   );
 });
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/ConfirmPhoneStep.tsx` (modified, +3/-2)
```diff
@@ -14,7 +14,8 @@ import { useVerifyPhoneFlow } from './useVerifyPhoneFlow';
 const l = i18n.l.cash.deposit_setup.confirm_phone;
 
 export const ConfirmPhoneStep = memo(function ConfirmPhoneStep() {
-  const { state, code, kycOutcome, continueAfterKyc, setCode, submit, resend, resending, resendCooldownSeconds } = useVerifyPhoneFlow();
+  const { state, code, kycOutcome, kycRejectionReason, continueAfterKyc, setCode, submit, resend, resending, resendCooldownSeconds } =
+    useVerifyPhoneFlow();
   // Keep the retained OTP input disabled after advancing.
   const submitted = state === 'verifying' || state === 'submitted';
   const inputRef = useSetupInputRef();
@@ -48,7 +49,7 @@ export const ConfirmPhoneStep = memo(function ConfirmPhoneStep() {
         </Box>
       </SetupStepLayout>
 
-      {kycOutcome && <KycOutcomeSheet onContinue={continueAfterKyc} outcome={kycOutcome} />}
+      {kycOutcome && <KycOutcomeSheet onContinue={continueAfterKyc} outcome={kycOutcome} kycRejectionReason={kycRejectionReason} />}
     </>
   );
 });
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/ReviewStep.tsx` (modified, +2/-1)
```diff
@@ -84,6 +84,7 @@ export const ReviewStep = memo(function ReviewStep() {
   const identity = useCashSetupSessionStore(state => state.getIdentity(), shallowEqual);
   const governmentId = useCashSetupSessionStore(state => state.getGovernmentId(), shallowEqual);
   const state = useSubmitReviewFlowStore(store => store.state);
+  const kycRejectionReason = useSubmitReviewFlowStore(store => store.kycRejectionReason);
   const kycSubmitted = useSubmitReviewFlowStore(store => store.kycSubmitted);
   const submitting = state === 'submitting';
 
@@ -166,7 +167,7 @@ export const ReviewStep = memo(function ReviewStep() {
           title={i18n.t(l.submission_error_title)}
         />
       ) : state === 'entry' ? null : (
-        <KycOutcomeSheet onContinue={continueAfterVerification} outcome={state} />
+        <KycOutcomeSheet onContinue={continueAfterVerification} outcome={state} kycRejectionReason={kycRejectionReason} />
       )}
     </>
   );
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/useSubmitReviewFlow.test.ts` (modified, +36/-13)
```diff
@@ -6,7 +6,7 @@ import { delay } from '@/utils/delay';
 
 import { createUsSsnLast4GovernmentId, isValidUsSsnLast4 } from '../../../services/cashSetupIdentityService';
 import { CashUserServiceNetworkPolicyError } from '../../../services/cashUserServiceNetworkPolicy';
-import { getUserStatus, KycRejectionReason, KycStatus, submitOnboarding } from '../../../services/userClient';
+import { getUserStatus, KycRejectionReasonCode, KycStatus, submitOnboarding } from '../../../services/userClient';
 import { useCashSetupSessionStore } from '../../../stores/cashSetupSessionStore';
 import { KYC_POLL_INTERVAL_MS, useSubmitReviewFlowStore, type SubmitReviewState } from './useSubmitReviewFlow';
 
@@ -178,14 +178,30 @@ describe('useSubmitReviewFlowStore.submit onboarding', () => {
     expect(flow().state).toBe('rejected');
   });
 
-  it('reports unsupportedState when rejected for an unsupported state', async () => {
-    mockSubmitOnboarding.mockResolvedValue({ kycStatus: KycStatus.Rejected, kycRejectionReason: KycRejectionReason.StateNotSupported });
-
-    await expect(flow().submit()).resolves.toBe('unsupportedState');
-
-    expect(mockGetUserStatus).not.toHaveBeenCalled();
-    expect(track).toHaveBeenCalledWith('cash.kyc_failed', { reason: 'state_not_supported' });
-    expect(flow().state).toBe('unsupportedState');
+  describe.each(['submit', 'poll', 'retry'] as const)('unsupported location from %s', source => {
+    it.each([
+      { countryCode: 'US', regionCode: 'NY', regionName: 'New York' },
+      { countryCode: 'US', regionCode: 'CA', regionName: 'California' },
+      undefined,
+    ])('retains %j for the sheet and clears it on reset', async unsupportedLocation => {
+      const result = {
+        kycStatus: KycStatus.Rejected,
+        kycRejectionReason: { code: KycRejectionReasonCode.StateNotSupported, unsupportedLocation },
+      };
+      mockSubmitOnboarding.mockResolvedValue(source === 'submit' ? result : { kycStatus: KycStatus.Pending });
+      mockGetUserStatus.mockResolvedValue(result);
+      if (source === 'retry') useSubmitReviewFlowStore.setState({ kycSubmitted: true });
+
+      await expect(flow().submit()).resolves.toBe('unsupportedState');
+
+      expect(flow().kycRejectionReason).toEqual({ code: KycRejectionReasonCode.StateNotSupported, unsupportedLocation });
+      expect(track).toHaveBeenCalledWith('cash.kyc_failed', { reason: 'state_not_supported' });
+      expect(flow().state).toBe('unsupportedState');
+      expect(mockGetUserStatus).toHaveBeenCalledTimes(source === 'submit' ? 0 : 1);
+      expect(mockSubmitOnboarding).toHaveBeenCalledTimes(source === 'retry' ? 0 : 1);
+      flow().reset();
+      expect(flow().kycRejectionReason).toBeUndefined();
+    });
   });
 
   it.each([KycStatus.Unspecified, KycStatus.Review])('keeps polling on %s instead of failing', async kycStatus => {
@@ -228,7 +244,7 @@ describe('useSubmitReviewFlowStore.submit onboarding', () => {
   });
 
   it('ignores an active status poll after the flow is reset', async () => {
-    const poll = Promise.withResolvers<{ kycStatus: KycStatus; kycRejectionReason?: KycRejectionReason }>();
+    const poll = Promise.withResolvers<Awaited<ReturnType<typeof getUserStatus>>>();
     const pollStarted = Promise.withResolvers<void>();
     mockSubmitOnboarding.mockResolvedValue({ kycStatus: KycStatus.Pending });
     mockGetUserStatus.mockImplementationOnce(() => {
@@ -239,14 +255,21 @@ describe('useSubmitReviewFlowStore.submit onboarding', () => {
     const submission = flow().submit();
     await pollStarted.promise;
     flow().reset();
-    poll.resolve({ kycStatus: KycStatus.Approved });
+    poll.resolve({
+      kycStatus: KycStatus.Rejected,
+      kycRejectionReason: {
+        code: KycRejectionReasonCode.StateNotSupported,
+        unsupportedLocation: { regionCode: 'CA', regionName: 'California' },
+      },
+    });
 
     await expect(submission).resolves.toBe('cancelled');
 
     expect(mockGetUserStatus).toHaveBeenCalledTimes(1);
     expect(flow().state).toBe('entry');
+    expect(flow().kycRejectionReason).toBeUndefined();
     expect(session().session).toMatchObject({ status: 'phoneVerified', kycSubmission: 'submitted' });
-    expect(track).not.toHaveBeenCalledWith('cash.kyc_approved');
+    expect(track).not.toHaveBeenCalledWith('cash.kyc_failed', expect.anything());
   });
 
   it('fails and reports the failure when the submission throws', async () => {
@@ -261,7 +284,7 @@ describe('useSubmitReviewFlowStore.submit onboarding', () => {
   });
 
   it('skips a second submit while one is in flight', async () => {
-    const submit = Promise.withResolvers<{ kycStatus: KycStatus; kycRejectionReason?: KycRejectionReason }>();
+    const submit = Promise.withResolvers<Awaited<ReturnType<typeof submitOnboarding>>>();
     mockSubmitOnboarding.mockReturnValue(submit.promise);
 
     const first = flow().submit();
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/useSubmitReviewFlow.ts` (modified, +5/-3)
```diff
@@ -41,6 +41,7 @@ type SubmitReviewResult =
 type SubmitReviewFlowStore = {
   state: SubmitReviewState;
   kycSubmitted: boolean;
+  kycRejectionReason: KycRejectionReason | undefined;
   // Identifies one submission so an abandoned request or poll cannot write
   // into a later one. This module-level store outlives the setup screen.
   run: object | null;
@@ -51,9 +52,10 @@ type SubmitReviewFlowStore = {
 export const useSubmitReviewFlowStore = createBaseStore<SubmitReviewFlowStore>((set, get) => ({
   state: 'entry',
   kycSubmitted: false,
+  kycRejectionReason: undefined,
   run: null,
 
-  reset: () => set({ kycSubmitted: false, run: null, state: 'entry' }),
+  reset: () => set({ kycSubmitted: false, run: null, state: 'entry', kycRejectionReason: undefined }),
 
   submit: async () => {
     const { kycSubmitted, state } = get();
@@ -67,7 +69,7 @@ export const useSubmitReviewFlowStore = createBaseStore<SubmitReviewFlowStore>((
     if (!identity || !governmentId) return 'skipped';
 
     const run = {};
-    set({ run, state: 'submitting' });
+    set({ run, state: 'submitting', kycRejectionReason: undefined });
 
     if (session.status === 'recovery') {
       const code = useVerifyPhoneFlowStore.getState().code;
@@ -227,7 +229,7 @@ export const useSubmitReviewFlowStore = createBaseStore<SubmitReviewFlowStore>((
         return kycOutcome;
       case 'unsupportedState':
         analytics.track(analytics.event.cashKycFailed, { reason: 'state_not_supported' });
-        set({ state: kycOutcome });
+        set({ state: kycOutcome, kycRejectionReason });
         return kycOutcome;
       default:
         analytics.track(analytics.event.cashKycFailed, { reason: 'rejected' });
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/useVerifyPhoneFlow.ts` (modified, +4/-1)
```diff
@@ -5,7 +5,7 @@ import { createStoreActions } from '@storesjs/stores';
 import { time } from '@/framework/core/utils/time';
 import Routes from '@/navigation/routesNames';
 
-import { type KycOutcome } from '../../../services/userClient';
+import { type KycOutcome, type KycRejectionReason } from '../../../services/userClient';
 import { selectResendAfter, useCashSetupSessionStore } from '../../../stores/cashSetupSessionStore';
 import { useVerifyPhoneFlowStore, type VerifyPhoneState } from '../../../stores/verifyPhoneFlowStore';
 import { CashDepositSetupNavigation } from '../cashDepositSetupNavigator';
@@ -17,6 +17,7 @@ export function useVerifyPhoneFlow(): {
   state: VerifyPhoneState;
   code: string;
   kycOutcome: KycOutcome | null;
+  kycRejectionReason: KycRejectionReason | undefined;
   continueAfterKyc: () => void;
   setCode: (code: string) => void;
   submit: () => Promise<void>;
@@ -27,6 +28,7 @@ export function useVerifyPhoneFlow(): {
   const state = useVerifyPhoneFlowStore(s => s.state);
   const code = useVerifyPhoneFlowStore(s => s.code);
   const kycOutcome = useVerifyPhoneFlowStore(s => s.kycOutcome);
+  const kycRejectionReason = useVerifyPhoneFlowStore(s => s.kycRejectionReason);
   const resending = useVerifyPhoneFlowStore(s => s.resending !== null);
   const resendAfter = useCashSetupSessionStore(selectResendAfter);
   const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
@@ -56,6 +58,7 @@ export function useVerifyPhoneFlow(): {
     state,
     code,
     kycOutcome,
+    kycRejectionReason,
     continueAfterKyc,
     setCode: verifyPhoneFlowActions.setCode,
     submit: submitPhoneCode,
```

---

### Incident Patch 3: `f4c82d93` (2026-09-22)
**Commit Message**: Fix stuck Cash passkey sign-ins (#7831)

Fixes APP-4117

## What changed (plus any additional context for devs)

Cash sign-in now bounds the native passkey assertion at two minutes. If
iOS never completes the request, Rainbow cancels and releases the
passkey module's retained native context before clearing the shared
sign-in promise, so concurrent callers fail through the existing error
path, analytics records `reason: timeout`, and a later request can start
a fresh ceremony.

The dependency patch also gives native callbacks request identity,
preventing a late callback from an abandoned authorization controller
from settling a newer request.

Limitation: Apple exposes controller cancellation only on iOS 16+.
Rainbow still targets iOS 15.1, where timeout recovery releases the
library's retained slot and detaches callbacks but cannot guarantee
dismissal of a system-retained authorization prompt. Per product
decision, iOS 15 remains best-effort rather than gating Cash or raising
Rainbow's deployment target.

## Screen recordings / screenshots

Not applicable; this changes sign-in recovery behavior without visual
changes.

## What to test

- Cash reauthentication still completes and pr

**File**: `patches/react-native-passkeys+0.4.1.patch` (modified, +328/-12)
```diff
@@ -1,29 +1,345 @@
 # PATCH CONTEXT
-# Why: Rainbow's default React Native Babel profile compiles the package's
-#   native-module spread to Object.assign. Hermes does not expose the lazy JSI
-#   host methods as enumerable to Object.assign, so nothing from the spread
-#   survives: `this.isSupported` is undefined and create() throws before
-#   reaching native code, and `get` is missing from the default export
-#   entirely. Check support on the native module directly and re-declare
-#   get() as an explicit delegate.
+# Why:
+#   - Rainbow's Babel profile compiles the native-module spread to Object.assign,
+#     but Hermes does not expose lazy JSI host methods as enumerable properties.
+#     Explicit get()/cancel() delegates and a direct support check preserve access.
+#   - The iOS module can retain a request after its JS caller times out. Expose
+#     cancellation and identify callbacks so a timed-out request releases the
+#     native slot without settling a newer request. Android implements the shared
+#     bridge method as a no-op because Cash only invokes cancellation on iOS.
 # Upstream Issue: https://github.com/peterferguson/react-native-passkeys/issues/13
-#   (same symptom; the issue does not establish the root cause).
-# Linear Issue: none.
-# Remove when: react-native-passkeys stops reading its own methods off the
-#   spread default export.
+#   (same missing-method symptom; the issue does not establish the root cause).
+# Linear Issue: APP-4117.
+# Remove when: react-native-passkeys exposes cancellation and no longer reads its
+#   own methods off the spread default export.
 
+diff --git a/node_modules/react-native-passkeys/android/src/main/java/expo/modules/passkeys/ReactNativePasskeysModule.kt b/node_modules/react-native-passkeys/android/src/main/java/expo/modules/passkeys/ReactNativePasskeysModule.kt
+index 42f67d0..2601d4b 100644
+--- a/node_modules/react-native-passkeys/android/src/main/java/expo/modules/passkeys/ReactNativePasskeysModule.kt
++++ b/node_modules/react-native-passkeys/android/src/main/java/expo/modules/passkeys/ReactNativePasskeysModule.kt
+@@ -48,6 +48,8 @@ class ReactNativePasskeysModule : Module() {
+             false
+         }
+ 
++        AsyncFunction("cancel") {}
++
+         AsyncFunction("create") { request: PublicKeyCredentialCreationOptions, promise: Promise ->
+             val credentialManager =
+                 CredentialManager.create(appContext.reactContext?.applicationContext!!)
 diff --git a/node_modules/react-native-passkeys/build/ReactNativePasskeysModule.js b/node_modules/react-native-passkeys/build/ReactNativePasskeysModule.js
+index 4e8d2d1..cb784a4 100644
 --- a/node_modules/react-native-passkeys/build/ReactNativePasskeysModule.js
 +++ b/node_modules/react-native-passkeys/build/ReactNativePasskeysModule.js
-@@ -6,7 +6,10 @@ const passkeys = requireNativeModule("ReactNativePasskeys");
+@@ -5,8 +5,14 @@ import { NotSupportedError } from "./errors";
+ const passkeys = requireNativeModule("ReactNativePasskeys");
  export default {
      ...passkeys,
 +    async get(request) {
 +        return await passkeys.get(request);
++    },
++    async cancel() {
++        await passkeys.cancel();
 +    },
      async create(request) {
 -        if (!this.isSupported)
 +        if (!passkeys.isSupported())
              throw new NotSupportedError();
          const credential = await passkeys.create(request);
          return {
+@@ -20,4 +26,4 @@ export default {
+         };
+     },
+ };
+-//# sourceMappingURL=ReactNativePasskeysModule.js.map
+\ No newline at end of file
++//# sourceMappingURL=ReactNativePasskeysModule.js.map
+diff --git a/node_modules/react-native-passkeys/build/index.d.ts b/node_modules/react-native-passkeys/build/index.d.ts
+index 4541ef7..944ed03 100644
+--- a/node_modules/react-native-passkeys/build/index.d.ts
++++ b/node_modules/react-native-passkeys/build/index.d.ts
+@@ -1,6 +1,7 @@
+ import type { AuthenticationExtensionsLargeBlobInputs, AuthenticationExtensionsPRFInputs, AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, CreationResponse } from "./ReactNativePasskeys.types";
+ export declare function isSupported(): boolean;
+ export declare function isAutoFillAvalilable(): boolean;
++export declare function cancel(): Promise<void>;
+ export declare function create(request: Omit<PublicKeyCredentialCreationOptionsJSON, "extensions"> & {
+     extensions?: {
+         largeBlob?: AuthenticationExtensionsLargeBlobInputs;
+@@ -14,4 +15,4 @@ export declare function get(request: Omit<PublicKeyCredentialRequestOptionsJSON,
+         prf?: AuthenticationExtensionsPRFInputs;
+     };
+ }): Promise<AuthenticationResponseJSON | null>;
+-//# sourceMappingURL=index.d.ts.map
+\ No newline at end of file
++//# sourceMappingURL=index.d.ts.map
+diff --git a/node_modules/react-native-passkeys/build/index.js b/node_modules/react-native-passkeys/build/index.js
+index ee3ef5f..c5c94e8 100644

```

**File**: `src/analytics/event.ts` (modified, +1/-1)
```diff
@@ -612,7 +612,7 @@ export type EventProperties = {
   };
   [event.cashSignInFailed]: {
     trigger: CashSignInTrigger;
-    reason: TelemetryErrorReason;
+    reason: TelemetryErrorReason | 'timeout';
   };
   [event.cashSignInCancelled]: {
     trigger: CashSignInTrigger;
```

**File**: `src/features/cash/services/cashPasskeyService.ts` (modified, +8/-1)
```diff
@@ -1,6 +1,8 @@
+import { Platform } from 'react-native';
+
 import DeviceInfo from 'react-native-device-info';
 import { IS_TESTING } from 'react-native-dotenv';
-import { create, get } from 'react-native-passkeys';
+import { cancel, create, get } from 'react-native-passkeys';
 
 import { time } from '@/framework/core/utils/time';
 import { delay } from '@/utils/delay';
@@ -51,6 +53,11 @@ export async function getPasskeyAssertion(publicKeyOptionsJson: string): Promise
   return JSON.stringify(assertion);
 }
 
+export async function cancelPasskeyRequest(): Promise<void> {
+  if (Platform.OS !== 'ios') return;
+  await cancel();
+}
+
 export function isPasskeyCancellation(error: unknown): boolean {
   if (!(error instanceof Error)) return false;
   const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
```

**File**: `src/features/cash/services/cashSignInService.test.ts` (modified, +78/-1)
```diff
@@ -2,7 +2,7 @@ import { analytics } from '@/analytics';
 
 import { useCashAccountStore } from '../stores/cashAccountStore';
 import { useCashAuthTokenStore } from '../stores/cashAuthTokenStore';
-import { getPasskeyAssertion } from './cashPasskeyService';
+import { cancelPasskeyRequest, getPasskeyAssertion } from './cashPasskeyService';
 import { ensureAccessToken, signInWithPhone } from './cashSignInService';
 import { finalizeAuth, finishLogin, startLogin } from './userClient';
 
@@ -25,13 +25,15 @@ jest.mock('./userClient', () => ({
 }));
 
 jest.mock('./cashPasskeyService', () => ({
+  cancelPasskeyRequest: jest.fn(),
   getPasskeyAssertion: jest.fn(),
   isPasskeyCancellation: jest.fn((error: unknown) => error instanceof Error && error.message === 'UserCancelled'),
 }));
 
 const mockStartLogin = startLogin as jest.Mock;
 const mockFinishLogin = finishLogin as jest.Mock;
 const mockFinalizeAuth = finalizeAuth as jest.Mock;
+const mockCancelPasskeyRequest = cancelPasskeyRequest as jest.Mock;
 const mockGetPasskeyAssertion = getPasskeyAssertion as jest.Mock;
 const track = analytics.track as jest.Mock;
 
@@ -46,11 +48,16 @@ beforeEach(() => {
   useCashAccountStore.getState().setUserId(USER_ID);
   tokenStore().clearToken();
   mockStartLogin.mockResolvedValue({ sessionId: 'sess-1', sessionToken: 'tok-1', publicKeyOptionsJson: OPTIONS_JSON });
+  mockCancelPasskeyRequest.mockResolvedValue(undefined);
   mockGetPasskeyAssertion.mockResolvedValue(ASSERTION_JSON);
   mockFinishLogin.mockResolvedValue({ sessionId: 'sess-2', sessionToken: 'tok-2', userId: 'user-2' });
   mockFinalizeAuth.mockResolvedValue({ accessToken: 'jwt-1', expiresAt: Date.now() + 3_600_000 });
 });
 
+afterEach(() => {
+  jest.useRealTimers();
+});
+
 describe('ensureAccessToken', () => {
   it('runs the ceremony in order, threads the session pair, stores the token, and tracks the funnel', async () => {
     await expect(ensureAccessToken('cardLink')).resolves.toBe('jwt-1');
@@ -104,6 +111,7 @@ describe('ensureAccessToken', () => {
 
     await expect(ensureAccessToken('cardLink')).rejects.toThrow('UserCancelled');
     expect(mockFinishLogin).not.toHaveBeenCalled();
+    expect(mockCancelPasskeyRequest).not.toHaveBeenCalled();
     expect(tokenStore().token).toBeNull();
     expect(track.mock.calls).toEqual([
       ['cash.sign_in_submitted', { trigger: 'cardLink' }],
@@ -130,6 +138,75 @@ describe('ensureAccessToken', () => {
     expect(mockStartLogin).toHaveBeenCalledTimes(2);
   });
 
+  it('times out a stuck passkey assertion and allows a fresh shared ceremony', async () => {
+    jest.useFakeTimers();
+    let resolveStuckAssertion: (assertion: string) => void;
+    let releaseNativeCancellation: () => void = () => {
+      throw new Error('Native cancellation did not start');
+    };
+    mockGetPasskeyAssertion.mockImplementationOnce(
+      () =>
+        new Promise(resolve => {
+          resolveStuckAssertion = resolve;
+        })
+    );
+    mockCancelPasskeyRequest.mockImplementationOnce(
+      () =>
+        new Promise<void>(resolve => {
+          releaseNativeCancellation = resolve;
+        })
+    );
+
+    const first = ensureAccessToken('cardLink');
+    const concurrent = ensureAccessToken('cardLink');
+    await Promise.resolve();
+
+    await jest.advanceTimersByTimeAsync(120_000);
+    expect(mockCancelPasskeyRequest).toHaveBeenCalledTimes(1);
+
+    const joinedDuringCancellation = ensureAccessToken('cardLink');
+    await Promise.resolve();
+    expect(mockStartLogin).toHaveBeenCalledTimes(1);
+
+    const results = Promise.allSettled([first, concurrent, joinedDuringCancellation]);
+    releaseNativeCancellation();
+    await expect(results).resolves.toEqual([
+      { status: 'rejected', reason: expect.objectContaining({ message: 'Cash passkey assertion timed out' }) },
+      { status: 'rejected', reason: expect.objectContaining({ message: 'Cash passkey assertion timed out' }) },
+      { status: 'rejected', reason: expect.objectContaining({ message: 'Cash passkey assertion timed out' }) },
+    ]);
+
+    expect(track.mock.calls).toEqual([
+      ['cash.sign_in_submitted', { trigger: 'cardLink' }],
+      ['cash.sign_in_failed', { trigger: 'cardLink', reason: 'timeout' }],
+    ]);
+
+    resolveStuckAssertion!(ASSERTION_JSON);
+    await Promise.resolve();
+    expect(mockFinishLogin).not.toHaveBeenCalled();
+
+    await expect(ensureAccessToken('cardLink')).resolves.toBe('jwt-1');
+    expect(mockStartLogin).toHaveBeenCalledTimes(2);
+  });
+
+  it('reports the original timeout when native cleanup fails', async () => {
+    jest.useFakeTimers();
+    mockGetPasskeyAssertion.mockReturnValue(new Promise(() => undefined));
+    mockCancelPasskeyRequest.mockRejectedValue(new Error('cleanup failed'));
+
+    const result = Promise.allSettled([ensureAccessToken('cardLink')]);
+    await jest.advanceTimersByTimeAsync(120_000);
+    expect(mockCancelPasskeyRequest).toHaveBeenCalledTimes(1);
+    await expec
```

**File**: `src/features/cash/services/cashSignInService.ts` (modified, +17/-3)
```diff
@@ -1,16 +1,19 @@
 import { analytics } from '@/analytics';
 import { time } from '@/framework/core/utils/time';
+import { withTimeout } from '@/utils/promise';
 
 import { useCashAccountStore } from '../stores/cashAccountStore';
 import { useCashAuthTokenStore } from '../stores/cashAuthTokenStore';
 import { getTelemetryErrorReason } from '../utils/getTelemetryErrorReason';
 import { US_COUNTRY_CALLING_CODE } from '../utils/phoneNumber';
-import { getPasskeyAssertion, isPasskeyCancellation } from './cashPasskeyService';
+import { cancelPasskeyRequest, getPasskeyAssertion, isPasskeyCancellation } from './cashPasskeyService';
 import { finalizeAuth, finishLogin, startLogin, type StartLoginParams } from './userClient';
 
 export type CashSignInTrigger = 'cardLink' | 'addCash' | 'signInScreen';
 
 const TOKEN_EXPIRY_MARGIN = time.seconds(30);
+const PASSKEY_ASSERTION_TIMEOUT = time.minutes(2);
+const PASSKEY_ASSERTION_TIMEOUT_MESSAGE = 'Cash passkey assertion timed out';
 
 let pendingSignIn: Promise<string> | null = null;
 
@@ -43,7 +46,11 @@ async function runLoginCeremony(trigger: CashSignInTrigger, resolveIdentifier: (
   analytics.track(analytics.event.cashSignInSubmitted, { trigger });
   try {
     const start = await startLogin(resolveIdentifier());
-    const credentialAssertionJson = await getPasskeyAssertion(start.publicKeyOptionsJson);
+    const credentialAssertionJson = await withTimeout(
+      getPasskeyAssertion(start.publicKeyOptionsJson),
+      PASSKEY_ASSERTION_TIMEOUT,
+      PASSKEY_ASSERTION_TIMEOUT_MESSAGE
+    );
     const finish = await finishLogin({ sessionId: start.sessionId, sessionToken: start.sessionToken, credentialAssertionJson });
 
     // setUserId drops account-scoped state when the record changes, so it must precede setToken.
@@ -54,10 +61,17 @@ async function runLoginCeremony(trigger: CashSignInTrigger, resolveIdentifier: (
     analytics.track(analytics.event.cashSignInSucceeded, { trigger });
     return token.accessToken;
   } catch (error) {
+    const isPasskeyAssertionTimeout = error instanceof Error && error.message === PASSKEY_ASSERTION_TIMEOUT_MESSAGE;
+    if (isPasskeyAssertionTimeout) {
+      await cancelPasskeyRequest().catch(() => undefined);
+    }
     if (isPasskeyCancellation(error)) {
       analytics.track(analytics.event.cashSignInCancelled, { trigger });
     } else {
-      analytics.track(analytics.event.cashSignInFailed, { trigger, reason: getTelemetryErrorReason(error) });
+      analytics.track(analytics.event.cashSignInFailed, {
+        trigger,
+        reason: isPasskeyAssertionTimeout ? 'timeout' : getTelemetryErrorReason(error),
+      });
     }
     throw error;
   }
```

---

### Incident Patch 4: `ce3d904a` (2026-09-18)
**Commit Message**: fix(cash): correct Android `SkiaAnimatedNumber` width style (#7833)

**File**: `src/components/animated-number/SkiaAnimatedNumber.tsx` (modified, +5/-4)
```diff
@@ -875,7 +875,8 @@ export const SkiaAnimatedNumber = memo(function SkiaAnimatedNumber({
     [align, buildParagraph, fitToWidth, height, paddingHorizontal, size, tabularNumbers, weight, width]
   );
 
-  const widthStyle = useAnimatedStyle(() => ({ width: width === 'auto' ? textWidth.value + horizontalBleed * 2 : width }));
+  const canvasStyle = useAnimatedStyle(() => ({ width: canvasWidth.value }));
+  const wrapperStyle = useAnimatedStyle(() => ({ width: width === 'auto' ? textWidth.value + horizontalBleed * 2 : width }));
 
   const updateLayout = useCallback(
     (manager: AnimatedNumberManager) => {
@@ -914,10 +915,10 @@ export const SkiaAnimatedNumber = memo(function SkiaAnimatedNumber({
         initialize={initialize}
         onUpdate={updateLayout}
         renderer={renderer}
-        style={{ alignSelf: width === 'auto' ? 'flex-start' : undefined, height, width: canvasWidth }}
+        style={[{ alignSelf: width === 'auto' ? 'flex-start' : undefined, height }, canvasStyle]}
       />
     );
-  }, [canvasWidth, config, currentColor, currentValue, height, layout, renderer, updateLayout, width]);
+  }, [canvasStyle, config, currentColor, currentValue, height, layout, renderer, updateLayout, width]);
 
   return (
     <AnimatedNumberWrapper
@@ -930,7 +931,7 @@ export const SkiaAnimatedNumber = memo(function SkiaAnimatedNumber({
       size={size}
       testID={testID}
       verticalBleed={verticalBleed}
-      widthStyle={widthStyle}
+      widthStyle={wrapperStyle}
     >
       {skiaPictureView}
     </AnimatedNumberWrapper>
```

---

### Incident Patch 5: `95f68037` (2026-09-16)
**Commit Message**: fix(ios): correct unequal continuous corners and animated text rendering (#7820)

## What changed (plus any additional context for devs)

- Modifies the existing continuous corners RN patch to add iOS 26
support for continuous corner rounding on views with unequal corner
radii (used in `AddCashSheet` in #7817)
- Fixes the recurring `react-native-animateable-text` rendering bug on
iOS that allowed text content and width to visibly update separately.
Typically this is compensated for with a fixed text width, which the
layout of `AddCashSheet` doesn't allow for, so this addresses the
lower-level issue.

## Screen recordings / screenshots

## What to test

**File**: `patches/react-native+0.81.6.patch` (modified, +171/-16)
```diff
@@ -1,27 +1,182 @@
 # PATCH CONTEXT
-# Why: Forces continuous (squircle) corners on RCTView via
-#   `layer.cornerCurve = kCACornerCurveContinuous` so legacy-arch
-#   views match iOS-system rounded-rectangle styling. Default RN
-#   renderer on the legacy ObjC path draws circular-arc corners.
-# Upstream Issue: none filed yet — requires upstreaming a
-#   `borderCurve` style prop on the legacy renderer (Fabric
-#   already exposes it).
+# Why: Preserves Paper's existing scalar continuous corners and uses UIKit 26
+#   native geometry when unequal radii require it. A persistent childless UIView
+#   draws the native border with the same corner configuration as the host.
+#   Its lifetime follows UIKit's irreversible per-corner backend, keeping geometry
+#   synchronized across hidden borders and raster fallback without a separate flag.
+#   A plain foreground layer keeps it out of UIKit's subview bookkeeping. Bounds
+#   follow the host, including native activation during additive resize animations.
+#   UIKit/React retain their layout timing. No Swift dependency, bitmap renderer,
+#   or approximated corner geometry is added; earlier iOS retains the scalar path.
+# Upstream Issue: none filed yet. Paper's unequal-radius raster paths use circular
+#   arcs; UIKit 26 native inner-border coverage differs with rendered subviews.
 # Linear Issue: FEPLAT-97
-# Remove when: RN exposes `borderCurve` on the legacy renderer, or
-#   we migrate to the new architecture (Fabric).
+# Remove when: upstream Paper supports continuous unequal corners, or
+#   on migration to Fabric after verifying the equivalent rendering paths.
 
 diff --git a/node_modules/react-native/React/Views/RCTView.m b/node_modules/react-native/React/Views/RCTView.m
-index 0a2fa36..21a5099 100644
 --- a/node_modules/react-native/React/Views/RCTView.m
 +++ b/node_modules/react-native/React/Views/RCTView.m
-@@ -829,6 +829,10 @@
-   // correctly clip the subviews.
- 
-   UIColor *backgroundColor = [_backgroundColor resolvedColorWithTraitCollection:self.traitCollection];
+@@ -111,6 +111,7 @@
+
+ @implementation RCTView {
+   UIColor *_backgroundColor;
++  UIView *_nativeBorderView;
+   NSMutableDictionary<NSString *, NSDictionary *> *accessibilityActionsNameMap;
+   NSMutableDictionary<NSString *, NSDictionary *> *accessibilityActionsLabelMap;
+ }
+@@ -788,6 +789,18 @@
+   };
+ }
+
++- (void)setFrame:(CGRect)frame
++{
++  [super setFrame:frame];
++  _nativeBorderView.frame = self.bounds;
++}
 +
++- (void)setBounds:(CGRect)bounds
++{
++  [super setBounds:bounds];
++  _nativeBorderView.frame = self.bounds;
++}
++
+ - (void)reactSetFrame:(CGRect)frame
+ {
+   // If frame is zero, or below the threshold where the border radii can
+@@ -800,6 +813,50 @@
+   }
+ }
+
++- (void)updateNativeCornerRadii:(RCTCornerRadii)cornerRadii
++{
++#if defined(__IPHONE_OS_VERSION_MAX_ALLOWED) && __IPHONE_OS_VERSION_MAX_ALLOWED >= 260000
++  if (@available(iOS 26.0, *)) {
++    // UIKit cannot return to scalar corners after cornerConfiguration is set.
++    if (_nativeBorderView || !RCTCornerRadiiAreEqualAndSymmetrical(cornerRadii)) {
++      if (!_nativeBorderView) {
++        _nativeBorderView = [UIView new];
++        // A fixed origin lets its size animations match the parent's.
++        _nativeBorderView.layer.anchorPoint = CGPointZero;
++        // A plain layer keeps the border out of UIKit's subview bookkeeping.
++        CALayer *borderContainer = [CALayer layer];
++        borderContainer.zPosition = CGFLOAT_MAX;
++        [borderContainer addSublayer:_nativeBorderView.layer];
++        [self.layer addSublayer:borderContainer];
++        _nativeBorderView.frame = self.bounds;
++        // Join a resize already in progress, including additive retargets.
++        for (NSString *key in self.layer.animationKeys) {
++          CAAnimation *animation = [self.layer animationForKey:key];
++          if ([animation isKindOfClass:[CAPropertyAnimation class]] &&
++              [((CAPropertyAnimation *)animation).keyPath isEqualToString:@"bounds.size"]) {
++            CAAnimation *sizeAnimation = [animation copy];
++            // UIKit's completion delegate belongs to the original animation.
++            sizeAnimation.delegate = nil;
++            [_nativeBorderView.layer addAnimation:sizeAnimation forKey:key];
++          }
++        }
++      }
++      self.cornerConfiguration = [UICornerConfiguration
++          configurationWithTopLeftRadius:[UICornerRadius fixedRadius:cornerRadii.topLeftHorizontal]
++                          topRightRadius:[UICornerRadius fixedRadius:cornerRadii.topRightHorizontal]
++                        bottomLeftRadius:[UICornerRadius fixedRadius:cornerRadii.bottomLeftHorizontal]
++                       bottomRightRadius:[UICornerRadius fixedRadius:cornerRadii.bottomRightHorizontal]];
++      _nativeBorderView.frame = self.bounds;
++      _nativeBorderView.contentScaleFactor = self.contentScaleFactor;
++      _nativeBorderView.cornerConfiguratio
```

**File**: `patches/react-native-animateable-text+0.17.1.patch` (modified, +24/-0)
```diff
@@ -1,4 +1,14 @@
 # PATCH CONTEXT
+# Native repair (iOS Paper): Reanimated's synchronous layout pass suppresses
+#   mounting observers. JBAnimatedTextManager normally queues text storage from
+#   an observer, allowing new layout frames to mount before the new glyphs.
+#   Queue the inherited guarded text update after shadow layout instead, so
+#   text and frames share the same mount. Keep the observer for other updates;
+#   its existing guard prevents duplicate text installation.
+#   Fabric and Android are unchanged. Remove this native hunk when upstream
+#   provides atomic text/layout mounting on Paper.
+# Upstream issue for native repair: not filed.
+#
 # Why: react-native-animateable-text@0.17.1 fixed `AnimateableTextProps`
 #   in src/TextProps.tsx (drops `Omit<…, "children">`) but the published
 #   .d.ts files in lib/typescript/ were not regenerated and still carry
@@ -49,3 +59,17 @@ index 0000000..0000001 100644
      forwardedRef?: import("react").Ref<import("react-native").Text>;
      text?: string;
      onStartShouldSetResponder?: () => boolean;
+diff --git a/node_modules/react-native-animateable-text/ios/JBTextShadowView.mm b/node_modules/react-native-animateable-text/ios/JBTextShadowView.mm
+--- a/node_modules/react-native-animateable-text/ios/JBTextShadowView.mm
++++ b/node_modules/react-native-animateable-text/ios/JBTextShadowView.mm
+@@ -37,1 +37,10 @@
++- (void)layoutSubviewsWithContext:(RCTLayoutContext)layoutContext
++{
++  [super layoutSubviewsWithContext:layoutContext];
++
++  // Reanimated's synchronous layout pass suppresses mounting observers.
++  // Queue text in this batch so its glyphs and measured frame mount together.
++  [self uiManagerWillPerformMounting];
++}
++
+ - (NSAttributedString *)attributedTextWithMeasuredAttachmentsThatFitSize:(CGSize)size
```

---

### Incident Patch 6: `3f588a06` (2026-09-15)
**Commit Message**: fix(ci): map jinchung GitHub handle to Slack user in E2E failure alerts (#7825)

**File**: `.github/slack-handles.json` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
   "i1skn": "U0A5DS0EV6Y",
   "ibrahimtaveras00": "U02HJ9M6KQT",
   "janicduplessis": "U098WAS6GAH",
+  "jinchung": "UGV627AFL",
   "maxbbb": "U08057CKBPD",
   "olerass": "U0A589TR5C6"
 }
```

---

### Incident Patch 7: `b7f7c9b9` (2026-09-15)
**Commit Message**: fix(swaps): stop calling arc's Popular in Rainbow endpoint (#7821)

Fixes APP-3946 

## Summary
- Arc no longer serves Popular in Rainbow tokens (see APP-3872) — the
backend already returns an empty array and the ingestion cron has been
disabled.
- Disable `usePopularTokensStore`'s fetcher (`enabled: false`) so the
mobile app stops hitting the now-dead `/v3/trending/swaps/{chainId}`
endpoint.
- Deliberately minimal: the rest of the Popular in Rainbow code path
(store, UI section, types) is left in place in case it's revisited with
a different backend source later.

Resolves APP-3946.

## Test plan
- [x] `yarn tsc --noEmit` — no new errors introduced
- [x] `yarn eslint` on the changed file — clean
- [ ] Manual: confirm the "Popular in Rainbow" section no longer appears
in the Swap token-search sheet and no request to `/v3/trending/swaps/*`
is made

**File**: `src/__swaps__/screens/Swap/resources/search/discovery.ts` (modified, +3/-1)
```diff
@@ -39,9 +39,11 @@ async function popularTokensQueryFunction({ chainId }: PopularTokensParams, abor
 
 export const usePopularTokensStore = createQueryStore<SearchAsset[], PopularTokensParams>(
   {
+    // Popular in Rainbow is disabled server-side (arc no longer serves this endpoint), so fetching is
+    // disabled here too to avoid calling it needlessly. Left in place in case it's revisited later.
+    enabled: false,
     fetcher: popularTokensQueryFunction,
     cacheTime: time.days(1),
-    keepPreviousData: true,
     params: { chainId: $ => $(useSwapsStore).selectedOutputChainId },
     staleTime: time.minutes(15),
   },
```

---

### Incident Patch 8: `025ba0c0` (2026-09-14)
**Commit Message**: fix(CASH): update Add Cash intro availability copy for NY and CA (#7814)

Fixes APP-4104
Update Cash Deposits intro sheet availability line + "Cash transactions
are instant and seamless" row
Added further comments:
https://linear.app/rainbow/issue/APP-4104/update-add-cash-intro-screen-with-availability-copy-re-ny-and-ca#comment-8357f2ae

Fixes APP-4104

## Screen recordings / screenshots
<img width="1206" height="2622" alt="Simulator Screenshot - iPhone 17
Pro - 2026-09-11 at 11 34 26"
src="https://github.com/user-attachments/assets/93756400-b4e5-4b22-8fea-e6749df523af"
/>

**File**: `src/features/cash/screens/cash-deposit-intro-panel/CashDepositIntroPanel.tsx` (modified, +31/-32)
```diff
@@ -7,7 +7,7 @@ import { LinearGradient } from 'expo-linear-gradient';
 import { analytics } from '@/analytics';
 import { ButtonPressAnimation } from '@/components/animations/ButtonPressAnimation';
 import { PanelSheet } from '@/components/PanelSheet/PanelSheet';
-import { Box, Stack, Text, TextShadow, useColorMode, useForegroundColor } from '@/design-system';
+import { Box, Separator, Stack, Text, TextShadow, useColorMode, useForegroundColor } from '@/design-system';
 import { opacity } from '@/design-system/utils/opacity';
 import * as i18n from '@/languages';
 import { replace, useNavigation } from '@/navigation/Navigation';
@@ -18,16 +18,6 @@ import { CashDepositIntroFeatureRow } from '../../components/CashDepositIntroFea
 
 const HERO_DOLLAR_COLOR = '#0086FF';
 
-function VisaBadge({ color }: { color: string }) {
-  return (
-    <Box alignItems="center" justifyContent="center" paddingLeft="2px" style={[styles.visaBadge, { borderColor: color }]}>
-      <Text color="blue" size="11pt" weight="heavy">
-        {'VISA'}
-      </Text>
-    </Box>
-  );
-}
-
 export const CashDepositIntroPanel = memo(function CashDepositIntroPanel() {
   const { navigate } = useNavigation();
   const { isDarkMode } = useColorMode();
@@ -113,24 +103,39 @@ export const CashDepositIntroPanel = memo(function CashDepositIntroPanel() {
               }
               text={i18n.t(i18n.l.cash.deposit_intro.encrypted_feature)}
             />
-            <CashDepositIntroFeatureRow icon={<VisaBadge color={blue} />} text={i18n.t(i18n.l.cash.deposit_intro.visa_feature)} />
+            <CashDepositIntroFeatureRow
+              icon={
+                <Text align="center" color="blue" size="30pt" weight="medium">
+                  {'􀋦'}
+                </Text>
+              }
+              text={i18n.t(i18n.l.cash.deposit_intro.instant_feature)}
+            />
           </Stack>
         </Box>
 
-        <Box gap={32} paddingBottom="32px" paddingHorizontal="20px" paddingTop="44px">
-          <ButtonPressAnimation onPress={handleSetUpAccount} scaleTo={0.96} testID="cash-deposit-intro-set-up-account">
-            <Box
-              alignItems="center"
-              borderRadius={52}
-              height={{ custom: 48 }}
-              justifyContent="center"
-              style={[styles.cta, { backgroundColor: blue, shadowColor: blue }]}
-            >
-              <Text align="center" color="white" size="22pt" weight="heavy">
-                {i18n.t(i18n.l.cash.deposit_intro.set_up_account)}
-              </Text>
-            </Box>
-          </ButtonPressAnimation>
+        <Box gap={24} paddingBottom="32px" paddingHorizontal="20px" paddingTop="44px">
+          <Box gap={16}>
+            <ButtonPressAnimation onPress={handleSetUpAccount} scaleTo={0.96} testID="cash-deposit-intro-set-up-account">
+              <Box
+                alignItems="center"
+                borderRadius={52}
+                height={{ custom: 48 }}
+                justifyContent="center"
+                style={[styles.cta, { backgroundColor: blue, shadowColor: blue }]}
+              >
+                <Text align="center" color="white" size="22pt" weight="heavy">
+                  {i18n.t(i18n.l.cash.deposit_intro.set_up_account)}
+                </Text>
+              </Box>
+            </ButtonPressAnimation>
+            <Text align="center" color="labelTertiary" size="15pt" weight="semibold">
+              {i18n.t(i18n.l.cash.deposit_intro.availability_disclaimer)}
+            </Text>
+          </Box>
+          <Box marginHorizontal="-20px">
+            <Separator color="separator" thickness={1} />
+          </Box>
           <ButtonPressAnimation onPress={handleOtherDepositMethods} scaleTo={0.96} testID="cash-deposit-intro-other-deposit-methods">
             <Text align="center" color="blue" size="17pt" weight="heavy">
               {i18n.t(i18n.l.cash.deposit_intro.other_deposit_methods)}
@@ -185,10 +190,4 @@ const styles = StyleSheet.create({
     fontSize: 41,
     lineHeight: 45,
   },
-  visaBadge: {
-    borderRadius: 8,
-    borderWidth: 2,
-    height: 25,
-    width: 40,
-  },
 });
```

**File**: `src/languages/en_US.json` (modified, +2/-1)
```diff
@@ -1539,7 +1539,8 @@
         "introducing": "Introducing",
         "title": "Cash Deposits",
         "encrypted_feature": "Your information is encrypted and protected.",
-        "visa_feature": "Available for US-based customers using a Visa card.",
+        "instant_feature": "Cash transactions are instant and seamless.",
+        "availability_disclaimer": "Available for US-based customers except New York and California, using a Visa card.",
         "set_up_account": "Set Up Account",
         "other_deposit_methods": "Other Deposit Methods",
         "sign_in": "Sign In"
```

---

### Incident Patch 9: `69773cd9` (2026-09-08)
**Commit Message**: fix(swaps): improve accuracy of displayed gas estimates (#7809)

Fixes APP-4088

## What changed (plus any additional context for devs)

- Swap gas fees now use the current EIP-1559 base fee instead of the
maximum base fee
- Balance checks and max amount calculations still use the max possible
fee
- When approve + swap simulation is unavailable, the displayed fee uses
the backend-configured chain fallback while the transaction keeps the
quote-provided gas limit
- Adds test coverage for fee calculations and swap gas limit fallbacks

## Screen recordings / screenshots

## What to test

**File**: `src/__swaps__/screens/Swap/hooks/useEstimatedGasFee.ts` (modified, +2/-2)
```diff
@@ -5,14 +5,14 @@ import { ChainId } from '@/features/network/types/backendNetworks';
 import { useSwapsStore } from '@/state/swaps/swapsStore';
 
 import { useSyncedSwapQuoteStore } from '../providers/SyncSwapStateAndSharedValues';
-import { useSwapEstimatedGasLimit } from './useSwapEstimatedGasLimit';
+import { useSwapFeeEstimateGasLimit } from './useSwapEstimatedGasLimit';
 
 export function useSwapEstimatedGasFee(overrideGasSettings?: GasSettings) {
   const preferredNetwork = useSwapsStore(s => s.preferredNetwork);
   const { assetToSell, quote, chainId = preferredNetwork || ChainId.mainnet } = useSyncedSwapQuoteStore();
   const gasSettings = useSelectedGas(chainId);
 
-  const estimatedGasLimit = useSwapEstimatedGasLimit({ chainId, assetToSell, quote });
+  const estimatedGasLimit = useSwapFeeEstimateGasLimit({ chainId, assetToSell, quote });
   const estimatedFee = useEstimatedGasFee({ chainId, gasLimit: estimatedGasLimit, gasSettings: overrideGasSettings || gasSettings });
 
   return estimatedFee;
```

**File**: `src/__swaps__/screens/Swap/hooks/useSwapEstimatedGasLimit.ts` (modified, +59/-23)
```diff
@@ -1,12 +1,15 @@
+import { useMemo } from 'react';
+
 import { useQuery } from '@tanstack/react-query';
 
 import { type ParsedSearchAsset } from '@/__swaps__/types/assets';
-import { gasUnits } from '@/features/gas/utils/gasUnits';
+import { isCrosschainQuote } from '@/__swaps__/utils/quotes';
+import { useBackendNetworksStore } from '@/features/network/stores/backendNetworksStore';
 import { type ChainId } from '@/features/network/types/backendNetworks';
 import { estimateUnlockAndCrosschainSwap } from '@/raps/actions/crosschainSwap';
-import { estimateUnlockAndSwap } from '@/raps/actions/swap';
+import { estimateUnlockAndSwapGasLimits } from '@/raps/actions/swap';
 import { createQueryKey, type QueryConfigWithSelect, type QueryFunctionArgs, type QueryFunctionResult } from '@/react-query';
-import { SwapType, type CrosschainQuote, type Quote, type QuoteError } from '@rainbow-me/swaps';
+import { type CrosschainQuote, type Quote, type QuoteError } from '@rainbow-me/swaps';
 
 // ///////////////////////////////////////////////
 // Query Types
@@ -26,49 +29,70 @@ const estimateSwapGasLimitQueryKey = ({ chainId, quote, assetToSell }: EstimateS
 
 type EstimateSwapGasLimitQueryKey = ReturnType<typeof estimateSwapGasLimitQueryKey>;
 
+function getDefaultSwapGasLimit(chainId: ChainId): string {
+  return useBackendNetworksStore.getState().getChainGasUnits(chainId).basic.swap;
+}
+
 // ///////////////////////////////////////////////
 // Query Function
 
 async function estimateSwapGasLimitQueryFunction({
   queryKey: [{ chainId, quote, assetToSell }],
 }: QueryFunctionArgs<typeof estimateSwapGasLimitQueryKey>) {
   if (!chainId) throw 'chainId is required';
+
   if (!quote || 'error' in quote || !assetToSell) {
+    const gasLimit = getDefaultSwapGasLimit(chainId);
     return {
-      gasLimit: gasUnits.basic_swap[chainId],
+      transactionGasLimit: gasLimit,
+      feeEstimateGasLimit: gasLimit,
       chainId,
     };
   }
 
-  const gasLimit = await (quote.swapType === SwapType.crossChain
-    ? estimateUnlockAndCrosschainSwap({
-        chainId,
-        quote: quote as CrosschainQuote,
-      })
-    : estimateUnlockAndSwap({
-        chainId,
-        quote,
-      }));
-
-  if (!gasLimit) {
+  let gasLimitEstimate;
+  if (isCrosschainQuote(quote)) {
+    const gasLimit = await estimateUnlockAndCrosschainSwap({
+      chainId,
+      quote,
+    });
+    gasLimitEstimate = { transactionGasLimit: gasLimit, feeEstimateGasLimit: gasLimit };
+  } else {
+    gasLimitEstimate = await estimateUnlockAndSwapGasLimits({
+      chainId,
+      quote,
+    });
+  }
+
+  if (!gasLimitEstimate.transactionGasLimit || !gasLimitEstimate.feeEstimateGasLimit) {
+    const gasLimit = getDefaultSwapGasLimit(chainId);
     return {
-      gasLimit: gasUnits.basic_swap[chainId],
+      transactionGasLimit: gasLimit,
+      feeEstimateGasLimit: gasLimit,
       chainId,
     };
   }
-  return { gasLimit, chainId };
+  return { ...gasLimitEstimate, chainId };
 }
 
 type EstimateSwapGasLimitResult = QueryFunctionResult<typeof estimateSwapGasLimitQueryFunction>;
 
 // ///////////////////////////////////////////////
 // Query Hook
 
-export function useSwapEstimatedGasLimit(
+function useSwapGasLimits(
   { chainId, quote, assetToSell, usePlaceholderData = true }: EstimateSwapGasLimitArgs,
   config: QueryConfigWithSelect<EstimateSwapGasLimitResult, Error, EstimateSwapGasLimitResult, EstimateSwapGasLimitQueryKey> = {}
 ) {
-  const placeholderData = chainId && usePlaceholderData ? { chainId, gasLimit: gasUnits.basic_swap[chainId] } : undefined;
+  const defaultGasLimit = chainId && usePlaceholderData ? getDefaultSwapGasLimit(chainId) : undefined;
+  const placeholderData = useMemo(
+    () =>
+      chainId && usePlaceholderData && defaultGasLimit
+        ? { chainId, transactionGasLimit: defaultGasLimit, feeEstimateGasLimit: defaultGasLimit }
+        : undefined,
+    [chainId, defaultGasLimit, usePlaceholderData]
+  );
+
   const { data } = useQuery(
     estimateSwapGasLimitQueryKey({
       chainId,
@@ -87,8 +111,20 @@ export function useSwapEstimatedGasLimit(
     }
   );
 
-  // we keepPreviousData so we can return the previous gasLimit while fetching
-  // which is great when refetching for the same chainId, but we don't want to keep the previous data
-  // when fetching for a different chainId
-  return data && data.chainId === chainId ? data.gasLimit : placeholderData?.gasLimit;
+  // Keep the previous estimate while refetching on one chain, but not after the selected chain changes.
+  return data && data.chainId === chainId ? data : placeholderData;
+}
+
+export function useSwapEstimatedGasLimit(
+  parameters: EstimateSwapGasLimitArgs,
+  config: QueryConfigWithSelect<EstimateSwapGasLimitResult, Error, EstimateSwapGasLimitResult, EstimateSwapGasLimitQueryKey> = {}
+): string | undefined {
+  return useSwapGasLimits(parameters, config)?.transactionGasLimit;
+}
+
+export function useSwapFeeEstimateGasLimit(
+  paramete
```

**File**: `src/__swaps__/screens/Swap/providers/SyncSwapStateAndSharedValues.tsx` (modified, +2/-21)
```diff
@@ -8,8 +8,8 @@ import { create } from 'zustand';
 import { type ExtendedAnimatedAssetWithColors } from '@/__swaps__/types/assets';
 import { analytics } from '@/analytics';
 import { getUniqueId } from '@/entities/assetId';
-import { type GasSettings } from '@/features/gas/hooks/useCustomGas';
 import { useSelectedGas } from '@/features/gas/hooks/useSelectedGas';
+import { calculateMaxGasFeeWorklet } from '@/features/gas/utils/calculateGasFee';
 import { useBackendNetworksStore } from '@/features/network/stores/backendNetworksStore';
 import { ChainId } from '@/features/network/types/backendNetworks';
 import {
@@ -93,25 +93,6 @@ const SyncQuoteSharedValuesToState = () => {
   return null;
 };
 
-const isFeeNaNWorklet = (value: string | undefined) => {
-  'worklet';
-
-  return isNaN(Number(value)) || typeof value === 'undefined';
-};
-
-export function calculateGasFeeWorklet(gasSettings: GasSettings, gasLimit: string) {
-  'worklet';
-
-  if (gasSettings.isEIP1559) {
-    const maxBaseFee = isFeeNaNWorklet(gasSettings.maxBaseFee) ? '0' : gasSettings.maxBaseFee;
-    const maxPriorityFee = isFeeNaNWorklet(gasSettings.maxPriorityFee) ? '0' : gasSettings.maxPriorityFee;
-    return mulWorklet(gasLimit, sumWorklet(maxBaseFee, maxPriorityFee));
-  }
-
-  const gasPrice = isFeeNaNWorklet(gasSettings.gasPrice) ? '0' : gasSettings.gasPrice;
-  return mulWorklet(gasLimit, gasPrice);
-}
-
 export function formatUnitsWorklet(value: string, decimals: number) {
   'worklet';
   let display = value;
@@ -265,7 +246,7 @@ function SyncGasStateToSharedValues() {
     )
       return undefined;
 
-    const gasFee = calculateGasFeeWorklet(gasSettings, estimatedGasLimit);
+    const gasFee = calculateMaxGasFeeWorklet(gasSettings, estimatedGasLimit);
     return isNaN(Number(gasFee)) ? undefined : gasFee;
   }, [estimatedGasLimit, gasSettings]);
 
```

**File**: `src/features/gas/hooks/useEstimatedGasFee.ts` (modified, +5/-3)
```diff
@@ -2,13 +2,14 @@ import { useMemo } from 'react';
 
 import { formatUnits } from 'viem';
 
-import { calculateGasFeeWorklet } from '@/__swaps__/screens/Swap/providers/SyncSwapStateAndSharedValues';
 import { convertAmountToNativeDisplayWorklet } from '@/features/currency/utils/nativeDisplay';
 import { type ChainId } from '@/features/network/types/backendNetworks';
 import { formatNumber, multiply } from '@/helpers/utilities';
 import { userAssetsStoreManager } from '@/state/assets/userAssetsStoreManager';
 import { useNativeAsset } from '@/utils/ethereumUtils';
 
+import { calculateEstimatedGasFeeWorklet } from '../utils/calculateGasFee';
+import { useBaseFee } from '../utils/meteorology';
 import { weiToGwei } from '../utils/parseGas';
 import { type GasSettings } from './useCustomGas';
 
@@ -31,11 +32,12 @@ export function useEstimatedGasFee({
 }) {
   const nativeNetworkAsset = useNativeAsset({ chainId });
   const nativeCurrency = userAssetsStoreManager(state => state.currency);
+  const { data: currentBaseFee } = useBaseFee({ chainId });
 
   return useMemo(() => {
     if (!gasLimit || !gasSettings || !nativeNetworkAsset?.price) return;
 
-    const gasFee = calculateGasFeeWorklet(gasSettings, gasLimit);
+    const gasFee = calculateEstimatedGasFeeWorklet(gasSettings, gasLimit, currentBaseFee);
     if (isNaN(Number(gasFee))) {
       return;
     }
@@ -47,5 +49,5 @@ export function useEstimatedGasFee({
     const feeInUserCurrency = multiply(networkAssetPrice, feeFormatted);
 
     return convertAmountToNativeDisplayWorklet(feeInUserCurrency, nativeCurrency, true);
-  }, [gasLimit, gasSettings, nativeCurrency, nativeNetworkAsset?.decimals, nativeNetworkAsset?.price]);
+  }, [currentBaseFee, gasLimit, gasSettings, nativeCurrency, nativeNetworkAsset?.decimals, nativeNetworkAsset?.price]);
 }
```

**File**: `src/features/gas/utils/calculateGasFee.test.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import { calculateEstimatedGasFeeWorklet, calculateMaxGasFeeWorklet } from './calculateGasFee';
+
+describe('gas fee calculations', () => {
+  const eip1559GasSettings = {
+    isEIP1559: true,
+    maxBaseFee: '10',
+    maxPriorityFee: '2',
+  } as const;
+
+  it('keeps the fee cap calculation for affordability checks', () => {
+    expect(calculateMaxGasFeeWorklet(eip1559GasSettings, '100')).toBe('1200');
+  });
+
+  it('uses the current base fee for an expected EIP-1559 fee', () => {
+    expect(calculateEstimatedGasFeeWorklet(eip1559GasSettings, '100', '4')).toBe('600');
+  });
+
+  it('does not estimate above the selected fee cap', () => {
+    expect(calculateEstimatedGasFeeWorklet(eip1559GasSettings, '100', '20')).toBe('1200');
+  });
+
+  it('falls back to the fee cap when the current base fee is unavailable', () => {
+    expect(calculateEstimatedGasFeeWorklet(eip1559GasSettings, '100', undefined)).toBe('1200');
+  });
+
+  it.each(['', ' ', 'Infinity'])('falls back to the fee cap when the current base fee is %p', currentBaseFee => {
+    expect(calculateEstimatedGasFeeWorklet(eip1559GasSettings, '100', currentBaseFee)).toBe('1200');
+  });
+
+  it.each(['', ' ', 'Infinity'])('treats an invalid selected fee value %p as zero', maxBaseFee => {
+    expect(calculateMaxGasFeeWorklet({ ...eip1559GasSettings, maxBaseFee }, '100')).toBe('200');
+  });
+
+  it('uses the selected gas price for legacy transactions', () => {
+    expect(calculateEstimatedGasFeeWorklet({ isEIP1559: false, gasPrice: '5' }, '100', '4')).toBe('500');
+  });
+});
```

**File**: `src/features/gas/utils/calculateGasFee.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import { type GasSettings } from '@/features/gas/types/gas';
+import { isNumberStringWorklet, lessThanWorklet, mulWorklet, sumWorklet } from '@/framework/core/safeMath';
+
+function safeFeeWorklet(value: string | undefined): string {
+  'worklet';
+  return typeof value === 'string' && isNumberStringWorklet(value) ? value : '0';
+}
+
+function calculateEIP1559GasFeeWorklet(gasLimit: string, baseFee: string, priorityFee: string): string {
+  'worklet';
+  return mulWorklet(gasLimit, sumWorklet(baseFee, priorityFee));
+}
+
+export function calculateMaxGasFeeWorklet(gasSettings: GasSettings, gasLimit: string): string {
+  'worklet';
+  if (gasSettings.isEIP1559) {
+    return calculateEIP1559GasFeeWorklet(gasLimit, safeFeeWorklet(gasSettings.maxBaseFee), safeFeeWorklet(gasSettings.maxPriorityFee));
+  }
+
+  return mulWorklet(gasLimit, safeFeeWorklet(gasSettings.gasPrice));
+}
+
+export function calculateEstimatedGasFeeWorklet(gasSettings: GasSettings, gasLimit: string, currentBaseFee: string | undefined): string {
+  'worklet';
+  if (!gasSettings.isEIP1559 || !currentBaseFee || !isNumberStringWorklet(currentBaseFee)) {
+    return calculateMaxGasFeeWorklet(gasSettings, gasLimit);
+  }
+
+  const maxBaseFee = safeFeeWorklet(gasSettings.maxBaseFee);
+  const estimatedBaseFee = lessThanWorklet(currentBaseFee, maxBaseFee) ? currentBaseFee : maxBaseFee;
+  return calculateEIP1559GasFeeWorklet(gasLimit, estimatedBaseFee, safeFeeWorklet(gasSettings.maxPriorityFee));
+}
```

**File**: `src/raps/actions/crosschainSwap.ts` (modified, +2/-11)
```diff
@@ -2,7 +2,6 @@ import { type Signer } from '@ethersproject/abstract-signer';
 
 import { TransactionDirection, TransactionStatus, type NewTransaction } from '@/entities/transactions';
 import { type TransactionGasParams, type TransactionLegacyGasParams } from '@/features/gas/types/gasSpeed';
-import { gasUnits } from '@/features/gas/utils/gasUnits';
 import { useBackendNetworksStore } from '@/features/network/stores/backendNetworksStore';
 import { type ChainId } from '@/features/network/types/backendNetworks';
 import { estimateGasWithPadding, getProvider, toHex } from '@/handlers/web3';
@@ -80,19 +79,11 @@ export const estimateCrosschainSwapGasLimit = async ({
   quote: CrosschainQuote;
 }): Promise<string> => {
   const provider = getProvider({ chainId });
-  if (!provider || !quote) {
-    return gasUnits.basic_swap[chainId];
-  }
   try {
     if (requiresApprove) {
       if (CHAIN_IDS_WITH_TRACE_SUPPORT.includes(chainId)) {
-        try {
-          const gasLimitWithFakeApproval = await estimateSwapGasLimitWithFakeApproval(chainId, provider, quote);
-          return gasLimitWithFakeApproval;
-        } catch (e) {
-          const routeGasLimit = getCrosschainSwapDefaultGasLimit(quote);
-          if (routeGasLimit) return routeGasLimit;
-        }
+        const gasLimitWithFakeApproval = await estimateSwapGasLimitWithFakeApproval(provider, quote);
+        return gasLimitWithFakeApproval || getCrosschainSwapDefaultGasLimit(quote) || getDefaultGasLimitForTrade(quote, chainId);
       }
 
       return getCrosschainSwapDefaultGasLimit(quote) || getDefaultGasLimitForTrade(quote, chainId);
```

**File**: `src/raps/actions/swap.ts` (modified, +68/-47)
```diff
@@ -9,8 +9,9 @@ import { type TransactionGasParams, type TransactionLegacyGasParams } from '@/fe
 import { gasUnits } from '@/features/gas/utils/gasUnits';
 import { useBackendNetworksStore } from '@/features/network/stores/backendNetworksStore';
 import { type ChainId } from '@/features/network/types/backendNetworks';
+import { isNumberStringWorklet } from '@/framework/core/safeMath';
 import { estimateGasWithPadding, getProvider, toHex } from '@/handlers/web3';
-import { add } from '@/helpers/utilities';
+import { add, greaterThan } from '@/helpers/utilities';
 import { ensureError, logger, RainbowError } from '@/logger';
 import { REFERRER } from '@/references/constants';
 import { addNewTransaction } from '@/state/pendingTransactions/addNewTransaction';
@@ -38,6 +39,7 @@ import {
   estimateSwapGasLimitWithFakeApproval,
   estimateTransactionsGasLimit,
   getDefaultGasLimitForTrade,
+  getFallbackGasLimitForTrade,
   overrideWithFastSpeedIfNeeded,
   populateSwap,
   SWAP_GAS_PADDING,
@@ -50,16 +52,38 @@ const WRAPPED_NATIVE_ASSET_INTERFACE = new Interface(['function deposit() payabl
 
 type SwapExecutionResult = ReplayableExecution;
 
-export const estimateUnlockAndSwap = async ({
+type GasLimitEstimate = {
+  transactionGasLimit: string;
+  feeEstimateGasLimit: string;
+};
+
+type EstimateSwapGasLimitParameters = {
+  chainId: ChainId;
+  requiresApprove?: boolean;
+  quote: Quote;
+};
+
+function getFallbackGasLimitEstimate(quote: Quote, chainId: ChainId): GasLimitEstimate {
+  return createGasLimitEstimate(getDefaultGasLimitForTrade(quote, chainId), getFallbackGasLimitForTrade(chainId));
+}
+
+function createGasLimitEstimate(transactionGasLimit: string, feeEstimateGasLimit = transactionGasLimit): GasLimitEstimate {
+  return {
+    transactionGasLimit,
+    feeEstimateGasLimit: greaterThan(feeEstimateGasLimit, transactionGasLimit) ? transactionGasLimit : feeEstimateGasLimit,
+  };
+}
+
+export const estimateUnlockAndSwapGasLimits = async ({
   quote,
   chainId,
   requiresApprove: requiresApproveInput,
-}: Pick<RapSwapActionParameters<'swap'>, 'quote' | 'chainId' | 'requiresApprove'>) => {
+}: Pick<RapSwapActionParameters<'swap'>, 'quote' | 'chainId' | 'requiresApprove'>): Promise<GasLimitEstimate> => {
   const { from: accountAddress, sellTokenAddress, allowanceNeeded } = quote;
   const requiresApprove = requiresApproveInput ?? allowanceNeeded;
   const allowanceTargetAddress = requiresApprove ? getQuoteAllowanceTargetAddress(quote) : null;
 
-  let gasLimits: (string | number)[] = [];
+  let unlockGasLimit = '0';
 
   if (requiresApprove && allowanceTargetAddress) {
     // Try simulation-based estimation first
@@ -104,58 +128,58 @@ export const estimateUnlockAndSwap = async ({
           },
         ],
       });
-      if (gasLimitFromSimulation) {
-        return gasLimitFromSimulation;
+      if (gasLimitFromSimulation && isNumberStringWorklet(gasLimitFromSimulation)) {
+        return createGasLimitEstimate(gasLimitFromSimulation);
       }
     }
 
-    const unlockGasLimit = await estimateApprove({
+    unlockGasLimit = await estimateApprove({
       owner: accountAddress,
       tokenAddress: sellTokenAddress,
       spender: allowanceTargetAddress,
       chainId,
     });
-    gasLimits = gasLimits.concat(unlockGasLimit);
   }
 
-  const swapGasLimit = await estimateSwapGasLimit({
+  const swapGasLimitEstimate = await estimateSwapGasLimits({
     chainId,
     requiresApprove,
     quote,
   });
 
-  if (swapGasLimit === null || swapGasLimit === undefined || isNaN(Number(swapGasLimit))) {
-    return getDefaultGasLimitForTrade(quote, chainId);
+  if (
+    !isNumberStringWorklet(swapGasLimitEstimate.transactionGasLimit) ||
+    !isNumberStringWorklet(swapGasLimitEstimate.feeEstimateGasLimit)
+  ) {
+    return getFallbackGasLimitEstimate(quote, chainId);
   }
 
-  const gasLimit = gasLimits.concat(swapGasLimit).reduce((acc, limit) => add(acc, limit), '0');
-  if (isNaN(Number(gasLimit))) {
-    return getDefaultGasLimitForTrade(quote, chainId);
+  const transactionGasLimit = add(unlockGasLimit, swapGasLimitEstimate.transactionGasLimit);
+  const feeEstimateGasLimit = add(unlockGasLimit, swapGasLimitEstimate.feeEstimateGasLimit);
+
+  if (!isNumberStringWorklet(transactionGasLimit) || !isNumberStringWorklet(feeEstimateGasLimit)) {
+    return getFallbackGasLimitEstimate(quote, chainId);
   }
 
-  return gasLimit.toString();
+  return createGasLimitEstimate(transactionGasLimit.toString(), feeEstimateGasLimit.toString());
 };
 
-export const estimateSwapGasLimit = async ({
-  chainId,
-  requiresApprove,
-  quote,
-}: {
-  chainId: ChainId;
-  requiresApprove?: boolean;
-  quote: Quote;
-}): Promise<string> => {
+export const estimateUnlockAndSwap = async (
+  parameters: Pick<RapSwapActionParameters<'swap'>, 'quote' | 'chainId' | 'requiresApprove'>
+): Promise<string> => (await estimateUnlockAndSwapGasLimits(parameters)).transactionGasLimit;
+
+const estimateSwapGasLimits = async ({ chai
```

---

### Incident Patch 10: `d3c5c742` (2026-09-02)
**Commit Message**: chore(dep-cruiser): disallow src/vendor importing app code (#7803)

`src/vendor` contains vendored code meant to be isolated from our
codebase and easy to sync with upstream. After the recent cleanup
decoupling this dir from our app, it is now 100% isolated as it should
be.

This change encodes the dependency rule that `src/vendor` cannot import
anything outside its own dir except npm packages and itself so we keep
it this way going forward.

Ref APP-4084.

**File**: `.dependency-cruiser.cjs` (modified, +8/-0)
```diff
@@ -120,6 +120,14 @@ const sourceRules = [
     from: { path: '^src/features/([^/]+)/' },
     to: { path: '^src/features/[^/]+/screens/', pathNot: '^src/features/$1/screens/' },
   },
+  {
+    name: 'vendor-imports-nothing-first-party',
+    severity: 'error',
+    comment:
+      'A vendored library imports only npm packages and itself: never app code, and never another vendored library. Vendored code is a fork we intend to keep diffable against upstream; a first-party import couples the fork to our internals and makes the next upstream sync a merge instead of a diff. Anything a vendored library needs from the app comes in through its public options.',
+    from: { path: '^src/vendor/([^/]+)/' },
+    to: { path: '^src/', pathNot: '^src/vendor/$1/' },
+  },
   {
     name: 'layer-core-is-a-leaf',
     severity: 'error',
```

**File**: `tools/deps-check/config.test.ts` (modified, +28/-0)
```diff
@@ -102,6 +102,34 @@ describe('.dependency-cruiser.cjs', () => {
       expect(configs.source.options.enhancedResolveOptions?.extensions).toContain('.d.ts');
     });
 
+    describe('vendor-imports-nothing-first-party', () => {
+      const { from, to, toPathNot } = rule('source', 'vendor-imports-nothing-first-party');
+
+      it('applies to files inside a vendored library', () => {
+        expect('src/vendor/ens-avatar/src/specs/erc721.ts').toMatch(from);
+      });
+
+      it('does not apply to first-party code', () => {
+        expect('src/features/ens/utils/fetchENSImage.ts').not.toMatch(from);
+      });
+
+      it('forbids importing app code', () => {
+        const appFile = 'src/components/images/index.ts';
+        expect(appFile).toMatch(to);
+        expect(appFile).not.toMatch(toPathNot('src/vendor/ens-avatar/src/specs/erc721.ts'));
+      });
+
+      it('forbids importing another vendored library', () => {
+        const otherLib = 'src/vendor/react-native-shadow-stack/index.js';
+        expect(otherLib).toMatch(to);
+        expect(otherLib).not.toMatch(toPathNot('src/vendor/ens-avatar/src/specs/erc721.ts'));
+      });
+
+      it('allows a library to import itself', () => {
+        expect('src/vendor/ens-avatar/src/index.ts').toMatch(toPathNot('src/vendor/ens-avatar/src/specs/erc721.ts'));
+      });
+    });
+
     describe('layer-core-is-a-leaf', () => {
       const { from, to } = rule('source', 'layer-core-is-a-leaf');
 
```

---

### Incident Patch 11: `5a34b1e6` (2026-09-02)
**Commit Message**: fix(CASH): variable order polling and validate ramp responses (#7750)

Fixed: APP-4010

## Why?

Two findings from the CASH front-end audit affect the deposit path. The
flow is not production-reachable yet, but both issues are live in the
code.

Unresolved orders must remain active so the client never assumes it is
safe to charge the user again. Polling every two seconds forever,
however, wastes network and battery, while repeatedly retrying
deterministic failures at that cadence creates noisy error reporting
without improving recovery.

Ramp responses also crossed into persisted and user-visible state
without runtime validation. Malformed order details could create an
invalid Activity entry, and one malformed card or wallet could make
every valid row in the same response unavailable.

## Approach

Orders are checked immediately and polled every two seconds for the
first five minutes, then every fifteen seconds until the backend returns
a terminal status. Failed polls use the existing failure backoff and log
once per failure streak. The active order remains persisted and
continues blocking duplicate submissions throughout.

Ramp responses are normalized at the HTTP boundary. Order 

**File**: `src/features/cash/constants.ts` (modified, +4/-2)
```diff
@@ -8,7 +8,9 @@ export const USDC_NAME = 'USD Coin';
 export const USDC_SYMBOL = 'USDC';
 export const USDC_DECIMALS = 6;
 
-export const ORDER_POLL_INTERVAL_MS = time.seconds(2);
+export const ORDER_FAST_POLL_INTERVAL_MS = time.seconds(2);
+export const ORDER_FAST_POLL_DURATION_MS = time.minutes(5);
+export const ORDER_SLOW_POLL_INTERVAL_MS = time.seconds(15);
 
 /** Each platform admits exactly one destination: production `usdc/base`, staging `usdc/arbitrum_testnet`. */
 export const CASH_BUY_DESTINATION_ASSET: RampAsset = {
@@ -23,7 +25,7 @@ export const CASH_BUY_DESTINATION_ASSET: RampAsset = {
  * (POLYGON_USDC_ADDRESS) own theirs. Chain ids are pinned here rather than resolved
  * through the backend networks store, which never returns testnets.
  */
-export const CASH_USDC_BY_NETWORK: Partial<Record<RampNetwork, { chainId: ChainId; chainName: ChainName; address: string }>> = {
+export const CASH_USDC_BY_NETWORK: Record<RampAsset['network'], { chainId: ChainId; chainName: ChainName; address: string }> = {
   [RampNetwork.ArbitrumTestnet]: {
     chainId: ChainId.arbitrumSepolia,
     chainName: ChainName.arbitrumSepolia,
```

**File**: `src/features/cash/screens/add-cash-sheet/AddCashSheet.tsx` (modified, +8/-17)
```diff
@@ -12,14 +12,15 @@ import { HoldToActivateButton } from '@/components/hold-to-activate-button/HoldT
 import { NumberPad } from '@/components/number-pad/NumberPad';
 import { DEFAULT_HANDLE_COLOR_DARK, DEFAULT_HANDLE_COLOR_LIGHT, PanelSheet } from '@/components/PanelSheet/PanelSheet';
 import { Box, Inline, Text, useColorMode, useForegroundColor } from '@/design-system';
-import { ORDER_POLL_INTERVAL_MS } from '@/features/cash/constants';
+import { ORDER_FAST_POLL_DURATION_MS, ORDER_FAST_POLL_INTERVAL_MS, ORDER_SLOW_POLL_INTERVAL_MS } from '@/features/cash/constants';
 import { isPasskeyCancellation } from '@/features/cash/services/cashPasskeyService';
 import { checkWalletLink } from '@/features/cash/services/walletLinkService';
 import { cashBuyOrderActions, selectCashBuyPhase, useCashBuyOrderStore, useCashBuyPhase } from '@/features/cash/stores/cashBuyOrderStore';
 import { useCashLinkedCard, type LinkedCard } from '@/features/cash/stores/cashPaymentMethodStore';
 import { getTelemetryErrorReason } from '@/features/cash/utils/getTelemetryErrorReason';
 import { useRemoteConfig } from '@/features/config/stores/remoteConfig';
 import { ChainId } from '@/features/network/types/backendNetworks';
+import { useTimestampReached } from '@/framework/ui/hooks/useTimestampReached';
 import { useWatcher } from '@/framework/ui/hooks/useWatcher';
 import { opacity } from '@/framework/ui/utils/opacity';
 import { WrappedAlert as Alert } from '@/helpers/alert';
@@ -350,21 +351,7 @@ export const AddCashSheet = memo(function AddCashSheet() {
   // The pending view takes over only once the order has been in flight longer than the configured
   // delay; until then the hold-to-add button's processing state is the only affordance.
   const pendingViewAt = submittedAt !== null ? submittedAt + pendingViewDelayMs : null;
-  const [showPendingView, setShowPendingView] = useState(() => pendingViewAt !== null && Date.now() >= pendingViewAt);
-
-  useEffect(() => {
-    if (pendingViewAt === null) {
-      setShowPendingView(false);
-      return;
-    }
-    const remaining = pendingViewAt - Date.now();
-    if (remaining <= 0) {
-      setShowPendingView(true);
-      return;
-    }
-    const timeoutId = setTimeout(() => setShowPendingView(true), remaining);
-    return () => clearTimeout(timeoutId);
-  }, [pendingViewAt]);
+  const showPendingView = useTimestampReached(pendingViewAt);
 
   useEffect(() => {
     return () => {
@@ -382,9 +369,13 @@ export const AddCashSheet = memo(function AddCashSheet() {
     }
   }, []);
 
+  // A fresh order is most likely to settle inside the fast window; polling backs off past it.
+  const slowPollAt = submittedAt !== null ? submittedAt + ORDER_FAST_POLL_DURATION_MS : null;
+  const isSlowPolling = useTimestampReached(slowPollAt);
+
   useWatcher({
     enabled: isPolling,
-    interval: ORDER_POLL_INTERVAL_MS,
+    interval: isSlowPolling ? ORDER_SLOW_POLL_INTERVAL_MS : ORDER_FAST_POLL_INTERVAL_MS,
     watchFunction: cashBuyOrderActions.syncActiveOrder,
   });
 
```

**File**: `src/features/cash/services/rampClient.test.ts` (modified, +249/-12)
```diff
@@ -1,4 +1,6 @@
+import { ResponseParseError } from '@/framework/data/http/parseResponse';
 import { RainbowFetchError } from '@/framework/data/http/rainbowFetch';
+import { logger } from '@/logger';
 
 import { useCashAuthTokenStore } from '../stores/cashAuthTokenStore';
 import { getCashPlatformClient } from './cashPlatformClient';
@@ -8,13 +10,18 @@ import {
   completeCardLinkSession,
   createBuyOrder,
   getOrder,
+  linkWallet,
+  listCards,
+  listWallets,
+  OrderFailureReason,
   OrderStatus,
   RampCryptoAsset,
   RampNetwork,
   startCardLinkSession,
+  WalletSignatureMethod,
   type BuyOrder,
   type CreateBuyOrderParams,
-  type CreatedBuyOrder,
+  type WalletSignature,
 } from './rampClient';
 
 jest.mock('./cashPlatformClient', () => ({
@@ -26,29 +33,60 @@ jest.mock('./cashSignInService', () => ({
   ensureAccessToken: jest.fn(),
 }));
 
+jest.mock('@/logger', () => ({
+  logger: { warn: jest.fn() },
+}));
+
 const get = jest.fn();
 const post = jest.fn();
 const mockEnsureAccessToken = ensureAccessToken as jest.Mock;
 
+// `tokenExpiresTime` rides along on the wire but nothing reads it, so the parsed session drops it.
 const SESSION = { linkUrl: 'https://link', token: 'vault-token', tokenExpiresTime: '2026-07-24T00:00:00Z' };
+const PARSED_SESSION = { linkUrl: SESSION.linkUrl, token: SESSION.token };
+const WALLET_SIGNATURE: WalletSignature = {
+  hexSignature: '0xsig',
+  method: WalletSignatureMethod.EthPersonalSign,
+  timestamp: '1750789885',
+};
 const CREATE_BUY_ORDER_PARAMS: CreateBuyOrderParams = {
   id: '997b3d75-9f76-4038-a173-73c7ff37992f',
   walletAddress: '0x4d957c58d081c1c8c8aafe1e08de047fff19eb88',
   cryptoAsset: { asset: RampCryptoAsset.USDC, network: RampNetwork.ArbitrumTestnet },
   depositAmount: '0.10',
   cardId: '4a2dab9c-3bb6-4c32-8aea-e5fd4ad4c771',
 };
-const CREATED_BUY_ORDER: CreatedBuyOrder = {
+const CREATED_TIME = '2026-07-29T16:07:57.965076Z';
+const COMPLETED_TIME = '2026-07-29T16:08:20.000Z';
+const PENDING_BUY_ORDER: Extract<BuyOrder, { status: OrderStatus.Pending }> = {
   id: CREATE_BUY_ORDER_PARAMS.id,
   status: OrderStatus.Pending,
-  createdTime: '2026-07-29T16:07:57.965076Z',
 };
-const BUY_ORDER: BuyOrder = {
-  ...CREATED_BUY_ORDER,
+const PROCESSING_BUY_ORDER: Extract<BuyOrder, { status: OrderStatus.Processing }> = {
+  id: CREATE_BUY_ORDER_PARAMS.id,
+  status: OrderStatus.Processing,
+};
+const COMPLETED_ORDER_BODY = {
+  id: CREATE_BUY_ORDER_PARAMS.id,
+  status: OrderStatus.Completed as const,
   cryptoAmount: { amount: '0.10', asset: CREATE_BUY_ORDER_PARAMS.cryptoAsset },
   fiatAmount: { amount: '0.10', currency: 'USD' },
-  status: OrderStatus.Pending,
+  createdTime: CREATED_TIME,
   walletAddress: CREATE_BUY_ORDER_PARAMS.walletAddress,
+  transactionHash: '0xtx',
+  completedTime: COMPLETED_TIME,
+};
+// Timestamps arrive as ISO strings and land as epoch ms; `asset` keeps only the network, the one part anything reads.
+const COMPLETED_BUY_ORDER = {
+  ...COMPLETED_ORDER_BODY,
+  cryptoAmount: { amount: '0.10', asset: { network: CREATE_BUY_ORDER_PARAMS.cryptoAsset.network } },
+  createdTime: new Date(CREATED_TIME).getTime(),
+  completedTime: new Date(COMPLETED_TIME).getTime(),
+} satisfies Extract<BuyOrder, { status: OrderStatus.Completed }>;
+const FAILED_BUY_ORDER: Extract<BuyOrder, { status: OrderStatus.Failed }> = {
+  id: CREATE_BUY_ORDER_PARAMS.id,
+  status: OrderStatus.Failed,
+  failureReason: OrderFailureReason.PaymentRejected,
 };
 
 function fetchError(status: number, message: string) {
@@ -65,7 +103,7 @@ beforeEach(() => {
 
 describe('startCardLinkSession', () => {
   it('sends the user JWT as the bearer', async () => {
-    await expect(startCardLinkSession()).resolves.toEqual(SESSION);
+    await expect(startCardLinkSession()).resolves.toEqual(PARSED_SESSION);
 
     expect(mockEnsureAccessToken).toHaveBeenCalledWith('cardLink');
     expect(post).toHaveBeenCalledWith(
@@ -79,7 +117,7 @@ describe('startCardLinkSession', () => {
     post.mockRejectedValueOnce(fetchError(401, 'unauthorized'));
     mockEnsureAccessToken.mockResolvedValueOnce('jwt-stale').mockResolvedValueOnce('jwt-fresh');
 
-    await expect(startCardLinkSession()).resolves.toEqual(SESSION);
+    await expect(startCardLinkSession()).resolves.toEqual(PARSED_SESSION);
 
     expect(useCashAuthTokenStore.getState().token).toBeNull();
     expect(mockEnsureAccessToken).toHaveBeenCalledTimes(2);
@@ -122,9 +160,9 @@ describe('completeCardLinkSession', () => {
 
 describe('buy orders', () => {
   it('creates a buy order with the authenticated ramp endpoint', async () => {
-    post.mockResolvedValue({ data: CREATED_BUY_ORDER });
+    post.mockResolvedValue({ data: { id: CREATE_BUY_ORDER_PARAMS.id, status: 'ORDER_STATUS_NEW', createdTime: CREATED_TIME } });
 
-    await expect(createBuyOrder(CREATE_BUY_ORDER_PARAMS)).resolves.toEqual(CREATED_BUY_ORDER);
+    await expect(createBuyOrder(CREATE_BUY_ORDER_PARAMS)).resolves.toBeUndefined();
 
     expect(mockEnsur
```

**File**: `src/features/cash/services/rampClient.ts` (modified, +144/-90)
```diff
@@ -1,6 +1,10 @@
 import { IS_TESTING } from 'react-native-dotenv';
+import { z } from 'zod';
 
+import { parseResponse } from '@/framework/data/http/parseResponse';
 import { RainbowFetchError } from '@/framework/data/http/rainbowFetch';
+import { greaterThan } from '@/helpers/utilities';
+import { logger } from '@/logger';
 
 import { useCashAuthTokenStore } from '../stores/cashAuthTokenStore';
 import type { LinkedCard } from '../stores/cashPaymentMethodStore';
@@ -48,9 +52,12 @@ export enum WalletSignatureMethod {
 
 // ---- Request / response shapes ---------------------------------------------
 
-export type RampAsset = { asset: RampCryptoAsset; network: RampNetwork };
-export type CryptoAmount = { amount: string; asset: RampAsset };
-export type FiatAmount = { amount: string; currency: string };
+const cashRampNetworkSchema = z.union([z.literal(RampNetwork.ArbitrumTestnet), z.literal(RampNetwork.Base)]);
+
+export type RampAsset = {
+  asset: RampCryptoAsset.USDC;
+  network: z.infer<typeof cashRampNetworkSchema>;
+};
 
 export type BuyOrderSpec = {
   cardId: string;
@@ -65,26 +72,74 @@ export type CreateBuyOrderParams = BuyOrderSpec & {
   cryptoAsset: RampAsset;
 };
 
-export type CreatedBuyOrder = {
-  id: string;
-  status: OrderStatus;
-  createdTime: string;
-};
+/** The wire carries ISO 8601; nothing displays these, so they land as epoch ms for the one reader that differences them. */
+const epochMsSchema = z
+  .string()
+  .transform(value => new Date(value).getTime())
+  .refine(Number.isFinite);
 
-type BuyOrderCommon = {
-  id: string;
-  cryptoAmount: CryptoAmount;
-  fiatAmount: FiatAmount;
-  /** ISO 8601 timestamp of when the order was created. */
-  createdTime: string;
-  walletAddress: string;
-};
+type RampContractIssue = { code: string; path: string };
 
-export type BuyOrder =
-  | (BuyOrderCommon & { status: OrderStatus.Pending })
-  | (BuyOrderCommon & { status: OrderStatus.Processing })
-  | (BuyOrderCommon & { status: OrderStatus.Completed; transactionHash: string; completedTime: string })
-  | (BuyOrderCommon & { status: OrderStatus.Failed; failureReason: OrderFailureReason });
+function toRampContractIssues(issues: z.ZodIssue[], prefix: (string | number)[] = []): RampContractIssue[] {
+  return issues.map(issue => ({ code: issue.code, path: [...prefix, ...issue.path].join('.') || '<root>' }));
+}
+
+function reportRampContractViolation(source: string, issues: RampContractIssue[], metadata?: Record<string, unknown>): void {
+  logger.warn(`[rampClient] normalized malformed response from ${source}`, { issues, ...metadata });
+}
+
+/** A value the client cannot use degrades to `undefined`, so a readable status is never lost to a field the order can do without. */
+const lenient = <S extends z.ZodTypeAny>(source: string, schema: S) =>
+  schema.optional().catch(ctx => {
+    reportRampContractViolation(source, toRampContractIssues(ctx.error.issues));
+    return undefined;
+  });
+
+const validRowsSchema = <S extends z.ZodTypeAny>(source: string, schema: S) =>
+  z
+    .array(z.unknown())
+    .default([])
+    .transform(rows => {
+      const valid: z.infer<S>[] = [];
+      const issues: RampContractIssue[] = [];
+
+      for (const [index, row] of rows.entries()) {
+        const result = schema.safeParse(row);
+        if (result.success) valid.push(result.data);
+        else issues.push(...toRampContractIssues(result.error.issues, [index]));
+      }
+
+      if (issues.length) reportRampContractViolation(source, issues, { totalRows: rows.length });
+      return valid;
+    });
+
+const buyOrderSchema = z.discriminatedUnion('status', [
+  z.object({ status: z.literal(OrderStatus.Pending) }),
+  z.object({ status: z.literal(OrderStatus.Processing) }),
+  z.object({
+    status: z.literal(OrderStatus.Completed),
+    completedTime: lenient('getOrder', epochMsSchema),
+    createdTime: lenient('getOrder', epochMsSchema),
+    cryptoAmount: lenient(
+      'getOrder',
+      z.object({
+        amount: z.string().refine(value => greaterThan(value, 0)),
+        asset: z
+          .object({ asset: z.literal(RampCryptoAsset.USDC), network: cashRampNetworkSchema })
+          .transform(({ network }) => ({ network })),
+      })
+    ),
+    fiatAmount: lenient('getOrder', z.object({ amount: z.string(), currency: z.string() })),
+    transactionHash: lenient('getOrder', z.string()),
+    walletAddress: lenient('getOrder', z.string()),
+  }),
+  z.object({
+    status: z.literal(OrderStatus.Failed),
+    failureReason: z.nativeEnum(OrderFailureReason).catch(OrderFailureReason.Unspecified),
+  }),
+]);
+
+export type BuyOrder = z.infer<typeof buyOrderSchema> & { id: string };
 
 export type TerminalBuyOrder = Extract<BuyOrder, { status: OrderStatus.Completed | OrderStatus.Failed }>;
 
@@ -101,19 +156,22 @@ export class RampError extends Error {
 
 // ---- Card link session -----------------------------------------------------
 
-type StartCardLinkSessionResponse = { linkUrl:
```

**File**: `src/features/cash/stores/cashBuyOrderStore.test.ts` (modified, +83/-45)
```diff
@@ -8,12 +8,10 @@ import {
   OrderFailureReason,
   OrderStatus,
   createBuyOrder as rampCreateBuyOrder,
-  RampCryptoAsset,
   getOrder as rampGetOrder,
   RampNetwork,
   type BuyOrder,
   type BuyOrderSpec,
-  type CreatedBuyOrder,
   type TerminalBuyOrder,
 } from '../services/rampClient';
 import { buildCashPurchaseTransaction } from '../utils/buildCashPurchaseTransaction';
@@ -24,9 +22,9 @@ jest.mock('@/analytics', () => ({
   analytics: {
     track: jest.fn(),
     event: {
-      cashBuyOrderSubmitted: 'cash.buy_submitted',
       cashBuyOrderCompleted: 'cash.buy_completed',
       cashBuyOrderFailed: 'cash.buy_failed',
+      cashBuyOrderSubmitted: 'cash.buy_submitted',
     },
   },
 }));
@@ -35,7 +33,11 @@ jest.mock('@/features/local-auth/legacyKeychain', () => ({}));
 
 jest.mock('@/logger', () => ({
   logger: { debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
-  RainbowError: class RainbowError extends Error {},
+  RainbowError: class RainbowError extends Error {
+    constructor(message: string, cause?: unknown) {
+      super(message, { cause });
+    }
+  },
 }));
 
 jest.mock('../services/rampClient', () => ({
@@ -77,30 +79,21 @@ const RAMP_WALLET_ADDRESS = WALLET_ADDRESS.toLowerCase();
 
 const SPEC: BuyOrderSpec = { cardId: 'card-1', depositAmount: '50', id: 'order-1', walletAddress: WALLET_ADDRESS };
 const SUBMITTED_AT = 1750789885000;
-const CREATED_PENDING_ORDER: CreatedBuyOrder = {
-  id: SPEC.id,
-  status: OrderStatus.Pending,
-  createdTime: '2026-06-24T18:31:25.000Z',
-};
-const CREATED_COMPLETED_ORDER: CreatedBuyOrder = { ...CREATED_PENDING_ORDER, status: OrderStatus.Completed };
 
-const ORDER_COMMON = {
+const PENDING_ORDER: Exclude<BuyOrder, TerminalBuyOrder> = { id: 'order-1', status: OrderStatus.Pending };
+const PROCESSING_ORDER: Exclude<BuyOrder, TerminalBuyOrder> = { id: 'order-1', status: OrderStatus.Processing };
+const COMPLETED_ORDER = {
   id: 'order-1',
-  cryptoAmount: { amount: '50', asset: { asset: RampCryptoAsset.USDC, network: RampNetwork.Base } },
+  status: OrderStatus.Completed,
+  cryptoAmount: { amount: '50', asset: { network: RampNetwork.Base } },
   fiatAmount: { amount: '50', currency: 'USD' },
-  createdTime: '2026-06-24T18:31:25.000Z',
+  createdTime: new Date('2026-06-24T18:31:25.000Z').getTime(),
   walletAddress: RAMP_WALLET_ADDRESS,
-};
-const PENDING_ORDER: Exclude<BuyOrder, TerminalBuyOrder> = { ...ORDER_COMMON, status: OrderStatus.Pending };
-const PROCESSING_ORDER: Exclude<BuyOrder, TerminalBuyOrder> = { ...ORDER_COMMON, status: OrderStatus.Processing };
-const COMPLETED_ORDER: Extract<BuyOrder, { status: OrderStatus.Completed }> = {
-  ...ORDER_COMMON,
-  status: OrderStatus.Completed,
   transactionHash: '0xtx',
-  completedTime: '2026-06-24T18:31:31.000Z',
-};
+  completedTime: new Date('2026-06-24T18:31:31.000Z').getTime(),
+} satisfies Extract<BuyOrder, { status: OrderStatus.Completed }>;
 const FAILED_PAYMENT_ORDER: Extract<BuyOrder, { status: OrderStatus.Failed }> = {
-  ...ORDER_COMMON,
+  id: 'order-1',
   status: OrderStatus.Failed,
   failureReason: OrderFailureReason.PaymentRejected,
 };
@@ -128,15 +121,15 @@ beforeEach(() => {
 
 describe('submitBuyOrder', () => {
   it('rounds the amount before tracking a submitted order', async () => {
-    createBuyOrder.mockResolvedValue(CREATED_PENDING_ORDER);
+    createBuyOrder.mockResolvedValue(undefined);
 
     await getState().submitBuyOrder({ ...SUBMIT_INPUT, depositAmount: '123.456789' });
 
     expect(track).toHaveBeenCalledWith(analytics.event.cashBuyOrderSubmitted, { amount: 123 });
   });
 
   it('builds a spec, creates the order, and surfaces the created order id as pending', async () => {
-    createBuyOrder.mockResolvedValue(CREATED_PENDING_ORDER);
+    createBuyOrder.mockResolvedValue(undefined);
 
     await getState().submitBuyOrder(SUBMIT_INPUT);
 
@@ -145,8 +138,8 @@ describe('submitBuyOrder', () => {
     expect(phase()).toBe('pending');
   });
 
-  it('fetches full details before applying a terminal status returned by an idempotent create replay', async () => {
-    createBuyOrder.mockResolvedValue(CREATED_COMPLETED_ORDER);
+  it('fetches full details before applying a terminal order', async () => {
+    createBuyOrder.mockResolvedValue(undefined);
     getOrder.mockResolvedValue(COMPLETED_ORDER);
 
     await getState().submitBuyOrder(SUBMIT_INPUT);
@@ -156,7 +149,7 @@ describe('submitBuyOrder', () => {
 
     await getState().syncActiveOrder();
 
-    expect(getOrder).toHaveBeenCalledWith(CREATED_COMPLETED_ORDER.id, expect.any(AbortController));
+    expect(getOrder).toHaveBeenCalledWith(SPEC.id, expect.any(AbortController));
     expect(addPendingTransaction).toHaveBeenCalled();
     expect(phase()).toBe('success');
   });
@@ -180,7 +173,7 @@ describe('submitBuyOrder', () => {
     { label: 'a 429', failure: fetchError(429) },
     { label: 'a 500', failure: fetchError(500) },
   ])('replays the same order id when retrying after $label', async ({ failure }
```

**File**: `src/features/cash/stores/cashBuyOrderStore.ts` (modified, +14/-14)
```diff
@@ -84,23 +84,24 @@ export const useCashBuyOrderStore = createBaseStore<CashBuyOrderState>(
   (set, get) => {
     function applyTerminalOrder(order: TerminalBuyOrder): void {
       if (order.status === OrderStatus.Completed) {
-        analytics.track(analytics.event.cashBuyOrderCompleted, {
-          fiatAmount: toAnalyticsAmount(order.fiatAmount.amount),
-          fiatCurrency: order.fiatAmount.currency,
-          cryptoAmount: toAnalyticsAmount(order.cryptoAmount.amount),
-          network: order.cryptoAmount.asset.network,
-          timeToUsdcMs: new Date(order.completedTime).getTime() - new Date(order.createdTime).getTime(),
-        });
+        const { completedTime, createdTime, cryptoAmount, fiatAmount } = order;
+        if (cryptoAmount && fiatAmount && createdTime !== undefined && completedTime !== undefined) {
+          analytics.track(analytics.event.cashBuyOrderCompleted, {
+            fiatAmount: toAnalyticsAmount(fiatAmount.amount),
+            fiatCurrency: fiatAmount.currency,
+            cryptoAmount: toAnalyticsAmount(cryptoAmount.amount),
+            network: cryptoAmount.asset.network,
+            timeToUsdcMs: completedTime - createdTime,
+          });
+        }
         try {
-          // The ramp echoes the address lowercased, while every reader of the pending-transaction store
-          // keys off the app's checksummed account address.
           const walletAddress = requireAddress(order.walletAddress, '[cashBuyOrderStore] ramp returned an invalid wallet address');
           pendingTransactionsActions.addPendingTransaction({
             address: walletAddress,
             pendingTransaction: buildCashPurchaseTransaction({ order, walletAddress }),
           });
         } catch (error) {
-          logger.error(new RainbowError('[cashBuyOrderStore] failed to enqueue purchase transaction', { error }), {
+          logger.error(new RainbowError('[cashBuyOrderStore] failed to enqueue purchase transaction', error), {
             orderId: order.id,
             transactionHash: order.transactionHash,
           });
@@ -123,9 +124,9 @@ export const useCashBuyOrderStore = createBaseStore<CashBuyOrderState>(
 
     async function submitBuyOrderSpec({ spec, submittedAt }: { spec: BuyOrderSpec; submittedAt: number }): Promise<void> {
       try {
-        const created = await createBuyOrder({ ...spec, cryptoAsset: CASH_BUY_DESTINATION_ASSET });
+        await createBuyOrder({ ...spec, cryptoAsset: CASH_BUY_DESTINATION_ASSET });
         if (!isCurrentSubmission(spec)) return;
-        set({ status: { step: 'polling', orderId: created.id, order: null, submittedAt } });
+        set({ status: { step: 'polling', orderId: spec.id, order: null, submittedAt } });
       } catch (error) {
         if (!isCurrentSubmission(spec)) return;
         logger.error(new RainbowError('[cashBuyOrderStore] createBuyOrder failed', error));
@@ -189,8 +190,7 @@ export const useCashBuyOrderStore = createBaseStore<CashBuyOrderState>(
           }
         } catch (error) {
           if (abortController?.signal.aborted) return;
-          // Transient poll failure; retry on the watcher's next tick.
-          logger.error(new RainbowError('[cashBuyOrderStore] getOrder failed', error));
+          throw error;
         } finally {
           abortController?.signal.removeEventListener('abort', propagateAbort);
         }
```

**File**: `src/features/cash/utils/buildCashPurchaseTransaction.test.ts` (modified, +44/-25)
```diff
@@ -1,28 +1,47 @@
-import { OrderStatus, RampCryptoAsset, RampNetwork, type BuyOrder } from '../services/rampClient';
+import { OrderStatus, RampError, RampNetwork, type BuyOrder } from '../services/rampClient';
 import { buildCashPurchaseTransaction } from './buildCashPurchaseTransaction';
 
-jest.mock('@/utils/getUrlForTrustIconFallback', () => jest.fn(() => undefined));
-
-jest.mock('../services/rampClient', () => ({
-  OrderStatus: { Completed: 'ORDER_STATUS_COMPLETED' },
-  RampCryptoAsset: { USDC: 'CRYPTO_ASSET_USDC' },
-  RampError: class RampError extends Error {},
-  RampNetwork: { ArbitrumTestnet: 'NETWORK_ARBITRUM_TESTNET', Base: 'NETWORK_BASE' },
-}));
-
-it('normalizes the transaction hash for Activity deduplication', () => {
-  const order: Extract<BuyOrder, { status: OrderStatus.Completed }> = {
-    id: 'order-1',
-    status: OrderStatus.Completed,
-    cryptoAmount: { amount: '50', asset: { asset: RampCryptoAsset.USDC, network: RampNetwork.Base } },
-    fiatAmount: { amount: '50', currency: 'USD' },
-    createdTime: '2026-06-24T18:31:25.000Z',
-    completedTime: '2026-06-24T18:31:31.000Z',
-    transactionHash: '0xAbCdEf123456',
-    walletAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
-  };
-
-  const transaction = buildCashPurchaseTransaction({ order, walletAddress: order.walletAddress });
-
-  expect(transaction.hash).toBe('0xabcdef123456');
+jest.mock('@/utils/ethereumUtils', () => ({ getUniqueId: jest.fn(() => 'usdc-base') }));
+jest.mock('@/utils/getUrlForTrustIconFallback', () => jest.fn(() => null));
+
+type CompletedBuyOrder = Extract<BuyOrder, { status: OrderStatus.Completed }>;
+
+const WALLET_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
+const ORDER = {
+  id: 'order-1',
+  status: OrderStatus.Completed,
+  cryptoAmount: { amount: '50', asset: { network: RampNetwork.Base } },
+  fiatAmount: { amount: '50', currency: 'USD' },
+  transactionHash: '0xtx',
+} satisfies CompletedBuyOrder;
+
+describe('buildCashPurchaseTransaction', () => {
+  // The amount's format and the network are settled at the ramp boundary; what can still be absent here
+  // is a field the backend simply did not populate.
+  const invalidOrders: { label: string; order: CompletedBuyOrder }[] = [
+    { label: 'no crypto amount', order: { ...ORDER, cryptoAmount: undefined } },
+    { label: 'no transaction hash', order: { ...ORDER, transactionHash: undefined } },
+    { label: 'an empty transaction hash', order: { ...ORDER, transactionHash: '' } },
+  ];
+
+  it.each(invalidOrders)('rejects $label before building an Activity entry', ({ order }) => {
+    expect(() => buildCashPurchaseTransaction({ order, walletAddress: WALLET_ADDRESS })).toThrow(RampError);
+  });
+
+  it('passes the amount through untouched and omits the description when there is no fiat amount', () => {
+    const order = { ...ORDER, cryptoAmount: { ...ORDER.cryptoAmount, amount: '1e-3' }, fiatAmount: undefined };
+
+    const transaction = buildCashPurchaseTransaction({ order, walletAddress: WALLET_ADDRESS });
+
+    expect(transaction.amount).toBe('1e-3');
+    expect(transaction.description).toBeUndefined();
+  });
+
+  it('normalizes the transaction hash for Activity deduplication', () => {
+    const order = { ...ORDER, transactionHash: '0xAbCdEf123456' };
+
+    const transaction = buildCashPurchaseTransaction({ order, walletAddress: WALLET_ADDRESS });
+
+    expect(transaction.hash).toBe('0xabcdef123456');
+  });
 });
```

**File**: `src/features/cash/utils/buildCashPurchaseTransaction.ts` (modified, +10/-11)
```diff
@@ -16,15 +16,12 @@ export function buildCashPurchaseTransaction({
   order: CompletedBuyOrder;
   walletAddress: string;
 }): RainbowTransaction {
-  const status = TransactionStatus.pending;
-
-  const { network: rampNetwork } = order.cryptoAmount.asset;
-  const usdc = CASH_USDC_BY_NETWORK[rampNetwork];
-  if (!usdc) throw new RampError(`Unsupported ramp network: ${rampNetwork}`);
+  const { cryptoAmount, fiatAmount, transactionHash } = order;
+  if (!cryptoAmount || !transactionHash) throw new RampError('Completed order carries no usable purchase details');
 
-  const { address, chainId, chainName: network } = usdc;
-  const fiatSymbol = supportedCurrencies[order.fiatAmount.currency as keyof typeof supportedCurrencies]?.symbol ?? '';
-  const rawCryptoAmount = convertAmountToRawAmount(order.cryptoAmount.amount, USDC_DECIMALS);
+  const status = TransactionStatus.pending;
+  const { address, chainId, chainName: network } = CASH_USDC_BY_NETWORK[cryptoAmount.asset.network];
+  const rawCryptoAmount = convertAmountToRawAmount(cryptoAmount.amount, USDC_DECIMALS);
   const asset = {
     address,
     balance: convertRawAmountToBalance(rawCryptoAmount, { decimals: USDC_DECIMALS, symbol: USDC_SYMBOL }),
@@ -41,7 +38,7 @@ export function buildCashPurchaseTransaction({
   };
 
   return {
-    amount: order.cryptoAmount.amount,
+    amount: cryptoAmount.amount,
     asset,
     chainId,
     changes: [
@@ -53,10 +50,12 @@ export function buildCashPurchaseTransaction({
         value: rawCryptoAmount,
       },
     ],
-    description: `${fiatSymbol}${order.fiatAmount.amount}`,
+    description: fiatAmount
+      ? `${supportedCurrencies[fiatAmount.currency as keyof typeof supportedCurrencies]?.symbol ?? ''}${fiatAmount.amount}`
+      : undefined,
     direction: TransactionDirection.IN,
     from: null,
-    hash: order.transactionHash.toLowerCase(),
+    hash: transactionHash.toLowerCase(),
     network,
     nonce: null,
     status,
```

---

### Incident Patch 12: `8599568c` (2026-09-01)
**Commit Message**: fix(swaps): ensure swap polling and quote updates stop after unmount (#7808)

Fixes APP-3731

## What changed (plus any additional context for devs)
- In rare cases, particularly when rapidly entering and exiting the swap
flow, an old quote could continue writing quotes into the swap store
- Adds a guard in the swap quote fetcher and hardens the timer primitive
to prevent post-unmount results from applying and polling from
continuing
- Adds a test reproducing the issue (most of the diff)

## Screen recordings / screenshots

## What to test

**File**: `src/__swaps__/screens/Swap/hooks/useSwapInputsController.lifecycle.test.ts` (added, +411/-0)
```diff
@@ -0,0 +1,411 @@
+import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
+
+import { useSwapInputsController } from './useSwapInputsController';
+
+type Effect = () => void | (() => void);
+
+type MutableValue<T> = {
+  value: T;
+  modify: (update: (value: T) => T) => void;
+};
+
+type MockSharedValue = MutableValue<unknown> & {
+  animationActive: boolean;
+};
+
+type TestAsset = {
+  address: string;
+  chainId: number;
+  decimals: number;
+  maxSwappableAmount: string;
+  networks: Record<number, { decimals: number }>;
+  price: { value: number };
+  uniqueId: string;
+};
+
+type TestQuote = {
+  buyAmountMinusFees: string;
+  buyTokenAsset: { price: { value: number } };
+  sellAmount: string;
+  sellTokenAsset: { price: { value: number } };
+};
+
+const mockEffectCleanups: Array<() => void> = [];
+const mockGetQuote = jest.fn<(...args: unknown[]) => Promise<TestQuote>>();
+const mockSharedValues: MockSharedValue[] = [];
+const mockTrack = jest.fn();
+const mockUIWorkQueue: Array<() => void> = [];
+const mockSwapState: { quote: TestQuote | null; slippage: string; source: string } = {
+  quote: null,
+  slippage: '0.5',
+  source: 'auto',
+};
+let mockDelayUIWork = false;
+let mockIsOnUI = false;
+
+function mockMutable<T>(value: T): MutableValue<T> {
+  return {
+    value,
+    modify(update) {
+      this.value = update(this.value);
+    },
+  };
+}
+
+function mockRegisterEffect(effect: Effect): void {
+  const cleanup = effect();
+  if (cleanup) mockEffectCleanups.push(cleanup);
+}
+
+function mockScheduleUI(work: () => void): void {
+  const runWorklet = () => {
+    const wasOnUI = mockIsOnUI;
+    mockIsOnUI = true;
+    try {
+      work();
+    } finally {
+      mockIsOnUI = wasOnUI;
+    }
+  };
+
+  if (mockDelayUIWork) {
+    mockUIWorkQueue.push(runWorklet);
+  } else {
+    runWorklet();
+  }
+}
+
+jest.mock('react', () => ({
+  useCallback: (callback: unknown) => callback,
+  useEffect: (effect: Effect) => mockRegisterEffect(effect),
+  useRef: <T>(initialValue: T) => ({ current: initialValue }),
+}));
+
+jest.mock('react-native-reanimated', () => ({
+  Easing: { linear: 'linear' },
+  runOnJS: (callback: unknown) => callback,
+  runOnUI:
+    (callback: (...args: unknown[]) => void) =>
+    (...args: unknown[]) =>
+      mockScheduleUI(() => callback(...args)),
+  useAnimatedReaction: jest.fn(),
+  useDerivedValue: (derive: () => unknown) => ({
+    get value() {
+      return derive();
+    },
+  }),
+  useSharedValue: (initialValue: unknown) => {
+    let currentValue = initialValue;
+    const setValue = (value: unknown) => {
+      currentValue = value;
+      sharedValue.animationActive = mockIsAnimation(value);
+    };
+    const sharedValue: MockSharedValue = {
+      animationActive: false,
+      get value() {
+        return currentValue;
+      },
+      set value(value: unknown) {
+        if (mockIsOnUI) setValue(value);
+        else mockScheduleUI(() => setValue(value));
+      },
+      modify(update) {
+        const applyUpdate = () => setValue(update(currentValue));
+        if (mockIsOnUI) applyUpdate();
+        else mockScheduleUI(applyUpdate);
+      },
+    };
+    mockRegisterEffect(() => () => {
+      mockScheduleUI(() => {
+        sharedValue.animationActive = false;
+      });
+    });
+    mockSharedValues.push(sharedValue);
+    return sharedValue;
+  },
+  withRepeat: (animation: unknown) => ({ __animation: 'repeat', animation }),
+  withSequence: (...animations: unknown[]) => ({ __animation: 'sequence', animations }),
+  withSpring: (value: unknown) => value,
+  withTiming: (value: unknown) => ({ __animation: 'timing', value }),
+}));
+
+jest.mock('react-native-turbo-haptics', () => ({ triggerHaptics: jest.fn() }));
+
+jest.mock('use-debounce', () => ({
+  useDebouncedCallback: (callback: unknown) => callback,
+}));
+
+jest.mock('@/__swaps__/screens/Swap/constants', () => ({
+  SCRUBBER_WIDTH: 100,
+  SLIDER_COLLAPSED_HEIGHT: 1,
+  SLIDER_HEIGHT: 1,
+  SLIDER_ROUND_THRESHOLD_END: 0.99,
+  SLIDER_ROUND_THRESHOLD_START: 0.01,
+  SLIDER_WIDTH: 100,
+  snappySpringConfig: {},
+}));
+
+jest.mock('@/__swaps__/utils/decimalFormatter', () => ({
+  valueBasedDecimalFormatter: ({ amount }: { amount: unknown }) => String(amount),
+}));
+
+jest.mock('@/__swaps__/utils/flipAssets', () => ({
+  getInputValuesForSliderPositionWorklet: () => ({
+    inputAmount: 0,
+    inputNativeValue: 0,
+    outputAmount: 0,
+    outputNativeValue: 0,
+  }),
+}));
+
+jest.mock('@/__swaps__/utils/swaps', () => ({
+  buildQuoteParams: (params: unknown) => ({ params }),
+  clamp: (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum),
+  getQuotePrice: () => 1,
+  trimTrailingZeros: (value: unknown) => String(value),
+}));
+
+jest.mock('@/analytics', () => ({
+  analytics: {
+    event: { swapsReceivedQuote: 'swaps.received_quote' },
+    track: (...args: unknown[]) => mockTrack(...args),
+  },
+}));
+
+jest.mock(
```

**File**: `src/__swaps__/screens/Swap/hooks/useSwapInputsController.ts` (modified, +13/-1)
```diff
@@ -1,4 +1,4 @@
-import { useCallback } from 'react';
+import { useCallback, useEffect, useRef } from 'react';
 
 import {
   runOnJS,
@@ -104,6 +104,14 @@ export function useSwapInputsController({
 }) {
   const inputValues = useSharedValue<InputValues>(applyInitialInputValues(initialValues));
   const inputMethod = useSharedValue<InputMethods>(initialValues.inputMethod || 'slider');
+  const isMounted = useRef(true);
+
+  useEffect(() => {
+    isMounted.current = true;
+    return () => {
+      isMounted.current = false;
+    };
+  }, []);
 
   const percentageToSwap = useDerivedValue(() => {
     return Math.round(clamp((sliderXPosition.value - SCRUBBER_WIDTH / SLIDER_WIDTH) / SLIDER_WIDTH, 0, 1) * 100) / 100;
@@ -224,6 +232,7 @@ export function useSwapInputsController({
   });
 
   const updateQuoteStore = useCallback((data: Quote | CrosschainQuote | QuoteError | null) => {
+    if (!isMounted.current) return;
     swapsStore.setState({ quote: data });
   }, []);
 
@@ -378,6 +387,7 @@ export function useSwapInputsController({
   );
 
   const fetchAndUpdateQuote = async ({ inputAmount, lastTypedInput: lastTypedInputParam, outputAmount }: RequestNewQuoteParams) => {
+    if (!isMounted.current) return;
     const originalInputAssetUniqueId = internalSelectedInputAsset.value?.uniqueId;
     const originalOutputAssetUniqueId = internalSelectedOutputAsset.value?.uniqueId;
 
@@ -420,6 +430,7 @@ export function useSwapInputsController({
 
     try {
       const quoteResponse = await (isCrosschainSwap ? getCrosschainQuote(params) : getQuote(params));
+      if (!isMounted.current) return;
 
       const inputAsset = internalSelectedInputAsset.value;
       const outputAsset = internalSelectedOutputAsset.value;
@@ -478,6 +489,7 @@ export function useSwapInputsController({
         });
       })();
     } catch {
+      if (!isMounted.current) return;
       runOnUI(resetFetchingStatus)({ fromError: true, quoteFetchingInterval });
     }
   };
```

**File**: `src/hooks/reanimated/useAnimatedTime.test.ts` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+import { beforeEach, describe, expect, it, jest } from '@jest/globals';
+
+import { useAnimatedTime } from './useAnimatedTime';
+
+type Effect = () => void | (() => void);
+type AnimationCallback = (finished?: boolean) => void;
+
+type MockAnimationState = { active: boolean };
+
+const mockEffects: Effect[] = [];
+const mockTimingCallbacks: AnimationCallback[] = [];
+const mockUIWorkQueue: Array<() => void> = [];
+let mockAnimationStates = new WeakMap<object, MockAnimationState>();
+
+jest.mock('react', () => ({
+  useCallback: (callback: unknown) => callback,
+  useEffect: (effect: Effect) => mockEffects.push(effect),
+}));
+
+jest.mock('react-native-reanimated', () => ({
+  Easing: { linear: 'linear' },
+  runOnUI: (worklet: () => void) => () => mockUIWorkQueue.push(worklet),
+  useSharedValue: (initialValue: unknown) => {
+    let currentValue = initialValue;
+    const animationState: MockAnimationState = { active: false };
+    const sharedValue = {
+      get value() {
+        return currentValue;
+      },
+      set value(value: unknown) {
+        currentValue = value;
+        animationState.active = mockIsAnimation(value);
+      },
+    };
+
+    // Reanimated's useSharedValue owns cancellation of its current animation on unmount.
+    mockEffects.push(() => () => {
+      animationState.active = false;
+    });
+    mockAnimationStates.set(sharedValue, animationState);
+    return sharedValue;
+  },
+  withRepeat: (animation: unknown) => ({ __animation: 'repeat', animation }),
+  withSequence: (...animations: unknown[]) => ({ __animation: 'sequence', animations }),
+  withTiming: (value: unknown, config: unknown, callback?: AnimationCallback) => {
+    void config;
+    if (callback) mockTimingCallbacks.push(callback);
+    return { __animation: 'timing', value };
+  },
+}));
+
+describe('useAnimatedTime lifecycle', () => {
+  beforeEach(() => {
+    mockAnimationStates = new WeakMap();
+    mockEffects.length = 0;
+    mockTimingCallbacks.length = 0;
+    mockUIWorkQueue.length = 0;
+  });
+
+  it('preserves start, stop, restart, and completion behavior while mounted', () => {
+    const onEndWorklet = jest.fn();
+    const onStartWorklet = jest.fn();
+    const timer = useAnimatedTime({ onEndWorklet, onStartWorklet });
+    const cleanups = setupEffects();
+    const timerClock = timer.timeInSeconds;
+
+    timer.start();
+    expect(getAnimationState(timerClock).active).toBe(true);
+    expect(onStartWorklet).toHaveBeenCalledTimes(1);
+
+    mockTimingCallbacks[0]?.(true);
+    expect(onEndWorklet).toHaveBeenCalledTimes(1);
+
+    timer.stop();
+    expect(getAnimationState(timerClock).active).toBe(false);
+
+    timer.restart();
+    expect(getAnimationState(timerClock).active).toBe(true);
+    expect(onStartWorklet).toHaveBeenCalledTimes(2);
+
+    runCleanups(cleanups);
+  });
+
+  it("does not revive Reanimated's canceled timer after unmount", () => {
+    const onEndWorklet = jest.fn();
+    const onStartWorklet = jest.fn();
+    const timer = useAnimatedTime({ onEndWorklet, onStartWorklet });
+    const cleanups = setupEffects();
+    const timerClock = timer.timeInSeconds;
+
+    timer.start();
+    const finish = mockTimingCallbacks[0];
+    runCleanups(cleanups);
+
+    expect(getAnimationState(timerClock).active).toBe(false);
+
+    timer.start();
+    timer.restart();
+    finish?.(true);
+
+    expect(getAnimationState(timerClock).active).toBe(false);
+    expect(onStartWorklet).toHaveBeenCalledTimes(1);
+    expect(onEndWorklet).not.toHaveBeenCalled();
+  });
+
+  it('starts once after React Strict Mode effect replay', async () => {
+    const onStartWorklet = jest.fn();
+    const timer = useAnimatedTime({ autoStart: true, onStartWorklet });
+    const timerClock = timer.timeInSeconds;
+
+    const firstCleanups = setupEffects();
+    runCleanups(firstCleanups);
+    const replayCleanups = setupEffects();
+
+    await flushMicrotasks();
+    flushUIWork();
+
+    expect(getAnimationState(timerClock).active).toBe(true);
+    expect(onStartWorklet).toHaveBeenCalledTimes(1);
+
+    runCleanups(replayCleanups);
+    timer.restart();
+    expect(getAnimationState(timerClock).active).toBe(false);
+  });
+});
+
+function getAnimationState(sharedValue: object): MockAnimationState {
+  const animationState = mockAnimationStates.get(sharedValue);
+  if (!animationState) throw new Error('Expected a mocked shared value');
+  return animationState;
+}
+
+function flushUIWork(): void {
+  while (mockUIWorkQueue.length) mockUIWorkQueue.shift()?.();
+}
+
+async function flushMicrotasks(): Promise<void> {
+  await Promise.resolve();
+}
+
+function mockIsAnimation(value: unknown): boolean {
+  return typeof value === 'object' && value !== null && '__animation' in value;
+}
+
+function setupEffects(): Array<() => void> {
+  return mockEffects.map(effect => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
+}
+
+function runCleanups(cleanups: 
```

**File**: `src/hooks/reanimated/useAnimatedTime.ts` (modified, +37/-21)
```diff
@@ -1,21 +1,21 @@
 import { useCallback, useEffect } from 'react';
 
-import { Easing, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
+import { Easing, runOnUI, useSharedValue, withRepeat, withSequence, withTiming, type DerivedValue } from 'react-native-reanimated';
 
-interface TimerConfig {
+type TimerConfig = {
   /** Whether the timer should start automatically. @default false */
   autoStart?: boolean;
   /** The duration of the timer in milliseconds. @default 1000 */
   durationMs?: number;
   /** A worklet function to be called when the timer ends. */
   onEndWorklet?: () => void;
   /** A worklet function to be called when the timer starts. */
-  onStartWorklet?: (currentTime: SharedValue<number>) => void;
+  onStartWorklet?: (currentTime: DerivedValue<number>) => void;
   /** Whether the timer should repeat after completion. @default false */
   shouldRepeat?: boolean;
-}
+};
 
-interface TimerResult {
+type TimerResult = {
   /** A worklet function that pauses the timer. */
   pause: () => void;
   /** A worklet function that restarts the timer. */
@@ -24,9 +24,9 @@ interface TimerResult {
   start: () => void;
   /** A worklet function that stops the timer. */
   stop: () => void;
-  /** A shared value representing the timer clock in seconds. */
-  timeInSeconds: SharedValue<number>;
-}
+  /** A read-only shared value representing the timer clock in seconds. */
+  timeInSeconds: DerivedValue<number>;
+};
 
 /**
  * ### useAnimatedTime
@@ -62,22 +62,27 @@ interface TimerResult {
  *   shouldRepeat: true,
  * });
  */
-export function useAnimatedTime(config: TimerConfig = {}): TimerResult {
-  const { autoStart = false, durationMs = 1000, onEndWorklet, onStartWorklet, shouldRepeat = false } = config;
-
+export function useAnimatedTime({
+  autoStart = false,
+  durationMs = 1000,
+  onEndWorklet,
+  onStartWorklet,
+  shouldRepeat = false,
+}: TimerConfig = {}): TimerResult {
+  const isDisposed = useSharedValue(false);
   const pausedAt = useSharedValue(0);
   const timeInSeconds = useSharedValue(0);
 
   const start = useCallback(() => {
     'worklet';
+    if (isDisposed.value) return;
 
     if (onStartWorklet) onStartWorklet(timeInSeconds);
 
     const repeatingTimer = withRepeat(
       withTiming(durationMs / 1000, { duration: durationMs, easing: Easing.linear }, finished => {
-        if (finished && onEndWorklet) {
-          onEndWorklet();
-        }
+        if (!finished || isDisposed.value) return;
+        if (onEndWorklet) onEndWorklet();
       }),
       shouldRepeat ? -1 : 1,
       false
@@ -95,9 +100,8 @@ export function useAnimatedTime(config: TimerConfig = {}): TimerResult {
             easing: Easing.linear,
           },
           finished => {
-            if (finished && onEndWorklet) {
-              onEndWorklet();
-            }
+            if (!finished || isDisposed.value) return;
+            if (onEndWorklet) onEndWorklet();
           }
         ),
         repeatingTimer
@@ -108,20 +112,24 @@ export function useAnimatedTime(config: TimerConfig = {}): TimerResult {
       }
       timeInSeconds.value = repeatingTimer;
     }
-  }, [durationMs, onEndWorklet, onStartWorklet, pausedAt, shouldRepeat, timeInSeconds]);
+  }, [durationMs, isDisposed, onEndWorklet, onStartWorklet, pausedAt, shouldRepeat, timeInSeconds]);
 
   const stop = useCallback(() => {
     'worklet';
+    if (isDisposed.value) return;
+
     pausedAt.value = 0;
     timeInSeconds.value = 0;
-  }, [pausedAt, timeInSeconds]);
+  }, [isDisposed, pausedAt, timeInSeconds]);
 
   const pause = useCallback(() => {
     'worklet';
+    if (isDisposed.value) return;
+
     const currentTime = timeInSeconds.value;
     pausedAt.value = currentTime;
     timeInSeconds.value = currentTime;
-  }, [pausedAt, timeInSeconds]);
+  }, [isDisposed, pausedAt, timeInSeconds]);
 
   const restart = useCallback(() => {
     'worklet';
@@ -130,9 +138,17 @@ export function useAnimatedTime(config: TimerConfig = {}): TimerResult {
   }, [start, stop]);
 
   useEffect(() => {
+    let isCurrentEffect = true;
+    isDisposed.value = false;
     if (autoStart) {
-      start();
+      queueMicrotask(() => {
+        if (isCurrentEffect) runOnUI(start)();
+      });
     }
+    return () => {
+      isCurrentEffect = false;
+      isDisposed.value = true;
+    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
 
```

---

### Incident Patch 13: `b3799d6f` (2026-09-01)
**Commit Message**: fix(CASH): normalize purchase transaction hashes (#7798)

Part of APP-4090

## Description

Activity deduplication compares transaction hashes case-sensitively,
while network hash casing can vary. Cash purchase hashes are now
normalized before creating the pending Activity row, preventing
duplicate display of the same transfer.

**File**: `src/features/cash/utils/buildCashPurchaseTransaction.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { OrderStatus, RampCryptoAsset, RampNetwork, type BuyOrder } from '../services/rampClient';
+import { buildCashPurchaseTransaction } from './buildCashPurchaseTransaction';
+
+jest.mock('@/utils/getUrlForTrustIconFallback', () => jest.fn(() => undefined));
+
+jest.mock('../services/rampClient', () => ({
+  OrderStatus: { Completed: 'ORDER_STATUS_COMPLETED' },
+  RampCryptoAsset: { USDC: 'CRYPTO_ASSET_USDC' },
+  RampError: class RampError extends Error {},
+  RampNetwork: { ArbitrumTestnet: 'NETWORK_ARBITRUM_TESTNET', Base: 'NETWORK_BASE' },
+}));
+
+it('normalizes the transaction hash for Activity deduplication', () => {
+  const order: Extract<BuyOrder, { status: OrderStatus.Completed }> = {
+    id: 'order-1',
+    status: OrderStatus.Completed,
+    cryptoAmount: { amount: '50', asset: { asset: RampCryptoAsset.USDC, network: RampNetwork.Base } },
+    fiatAmount: { amount: '50', currency: 'USD' },
+    createdTime: '2026-06-24T18:31:25.000Z',
+    completedTime: '2026-06-24T18:31:31.000Z',
+    transactionHash: '0xAbCdEf123456',
+    walletAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
+  };
+
+  const transaction = buildCashPurchaseTransaction({ order, walletAddress: order.walletAddress });
+
+  expect(transaction.hash).toBe('0xabcdef123456');
+});
```

**File**: `src/features/cash/utils/buildCashPurchaseTransaction.ts` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ export function buildCashPurchaseTransaction({
     description: `${fiatSymbol}${order.fiatAmount.amount}`,
     direction: TransactionDirection.IN,
     from: null,
-    hash: order.transactionHash,
+    hash: order.transactionHash.toLowerCase(),
     network,
     nonce: null,
     status,
```

---

### Incident Patch 14: `29a5278e` (2026-09-01)
**Commit Message**: fix(logger): a throwing transport silences the transports after it (#7775)

Log transports run in sequence with nothing between them. If one throws,
the transports after it never run, so the console line for that log is
lost, and the exception escapes into the caller that was only trying to
log. A failed report thus becomes a crash at an unrelated site.

This change contains each transport call such that a throwing transport
is reported to the console and the remaining transports still run.
Logging can no longer fail the code that called it.

Closes APP-4053.

**File**: `src/logger/index.ts` (modified, +7/-2)
```diff
@@ -283,8 +283,13 @@ export class Logger {
 
     const resolvedMetadata = metadata || EMPTY_METADATA;
     for (const transport of this.transports) {
-      // metadata fallback accounts for JS usage
-      transport(level, message, resolvedMetadata);
+      try {
+        // metadata fallback accounts for JS usage
+        transport(level, message, resolvedMetadata);
+      } catch (e) {
+        // A transport that throws must not take the remaining transports or the caller down with it.
+        console.error('[logger]: transport threw', e);
+      }
     }
   }
 }
```

**File**: `src/logger/logger.test.ts` (modified, +14/-10)
```diff
@@ -60,7 +60,7 @@ describe('general functionality', () => {
 
     const mockTransport = jest.fn();
 
-    const remove = logger.addTransport(mockTransport);
+    logger.addTransport(mockTransport);
 
     // @ts-expect-error testing the JS case
     logger.warn('a', null);
@@ -73,15 +73,6 @@ describe('general functionality', () => {
     // @ts-expect-error testing the JS case
     logger.warn('c', 0);
     expect(mockTransport).toHaveBeenCalledWith(LogLevel.Warn, 'c', {});
-
-    remove();
-
-    logger.addTransport((level, message, metadata) => {
-      expect(typeof metadata).toEqual('object');
-    });
-
-    // @ts-expect-error testing the JS case
-    logger.warn('message', null);
   });
 
   test('logger.error keeps a non-RainbowError as the cause', () => {
@@ -98,6 +89,19 @@ describe('general functionality', () => {
     expect(reported.cause).toBe(original);
   });
 
+  test('a throwing transport does not stop the others or escape to the caller', () => {
+    const logger = new Logger();
+    const throwing = jest.fn(() => {
+      throw new Error('transport exploded');
+    });
+    const next = jest.fn();
+    logger.addTransport(throwing);
+    logger.addTransport(next);
+
+    expect(() => logger.error(new RainbowError('x'))).not.toThrow();
+    expect(next).toHaveBeenCalledTimes(1);
+  });
+
   test('createServiceLogger debug honors context filtering and prefixes messages', () => {
     const logger = new Logger({
       debug: 'delegation',
```

---

### Incident Patch 15: `c06c7664` (2026-08-31)
**Commit Message**: fix(CASH): treat 408 and 429 as ambiguous (#7799)

Part of APP-4090

## Description

HTTP 408 and 429 do not prove that a write was rejected. Treating them
as definitive can create a second buy order or skip card-removal
reconciliation, so these responses now follow the existing
ambiguous-outcome paths.

**File**: `src/features/cash/services/rampClient.ts` (modified, +2/-2)
```diff
@@ -135,10 +135,10 @@ export function isNotFoundError(error: unknown): boolean {
   return error instanceof RainbowFetchError && error.response?.status === 404;
 }
 
-/** The backend answered and refused, so the request definitively took no effect. Transport failures and 5xx stay ambiguous. */
+/** The backend answered and refused, so the request definitively took no effect. Timeouts, rate limits, transport failures, and 5xx stay ambiguous. */
 export function isDefinitiveRejection(error: unknown): boolean {
   const status = error instanceof RainbowFetchError ? error.response?.status : undefined;
-  return status !== undefined && status >= 400 && status < 500;
+  return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
 }
 
 // The user JWT replaces the shared app key on these calls. On 401 the cached
```

**File**: `src/features/cash/stores/cardRemovalFlowStore.test.ts` (modified, +7/-2)
```diff
@@ -106,8 +106,13 @@ describe('cardRemovalFlowStore', () => {
     expect(mockListCards).not.toHaveBeenCalled();
   });
 
-  it('clears the card when reconciliation confirms an ambiguous delete succeeded', async () => {
-    mockDeleteCard.mockRejectedValue(new Error('connection lost'));
+  it.each([
+    { label: 'a transport error', failure: new Error('connection lost') },
+    { label: 'a 408', failure: fetchError(408) },
+    { label: 'a 429', failure: fetchError(429) },
+    { label: 'a 500', failure: fetchError(500) },
+  ])('clears the card when reconciliation confirms $label was an ambiguous delete that succeeded', async ({ failure }) => {
+    mockDeleteCard.mockRejectedValue(failure);
     mockListCards.mockResolvedValue([]);
 
     expect(await flow().remove(CARD)).toBe('removed');
```

**File**: `src/features/cash/stores/cashBuyOrderStore.test.ts` (modified, +8/-3)
```diff
@@ -171,11 +171,16 @@ describe('submitBuyOrder', () => {
     expect(phase()).toBe('error');
   });
 
-  // An ambiguous failure (transport error, 5xx) leaves it unknown whether the order was created, so
+  // An ambiguous failure (transport error, 408, 429, 5xx) leaves it unknown whether the order was created, so
   // a retry with the same inputs must replay the same id — the backend then returns the existing
   // order instead of creating a second one.
-  it('replays the same order id when retrying after an ambiguous failure', async () => {
-    createBuyOrder.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(CREATED_PENDING_ORDER);
+  it.each([
+    { label: 'a transport error', failure: new Error('network down') },
+    { label: 'a 408', failure: fetchError(408) },
+    { label: 'a 429', failure: fetchError(429) },
+    { label: 'a 500', failure: fetchError(500) },
+  ])('replays the same order id when retrying after $label', async ({ failure }) => {
+    createBuyOrder.mockRejectedValueOnce(failure).mockResolvedValueOnce(CREATED_PENDING_ORDER);
 
     await getState().submitBuyOrder(SUBMIT_INPUT);
     await getState().submitBuyOrder(SUBMIT_INPUT);
```

#### Recent Merged Pull Requests:
- **PR #7865** (2026-10-05): Set up feature flags for Solana (@jinchung)
- **PR #7864** (2026-10-05): refactor(tests): migrate from Jest to Vitest (@christianbaroni)
- **PR #7863** (2026-10-02): fix(cash): e2e failures and input bugs (@christianbaroni)
- **PR #7847** (2026-09-30): bump: `react-native-blur-view` (@christianbaroni)
- **PR #7846** (2026-10-01): feat(CASH): show unavailable notice to blocked users (@i1skn)
- **PR #7845** (2026-10-01): APP-4130: Add remote flag to pause Cash sign-ups (@i1skn)
- **PR #7843** (2026-09-29): fix(CASH): use backend unsupported state metadata (@jinchung)
- **PR #7842** (2026-09-28): refactor(analytics): send events directly to PostHog (@jinchung)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
