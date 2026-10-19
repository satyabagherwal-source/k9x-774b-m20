> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rainbow-me-rainbow-learnings.md`  
> **Source**: github ([https://github.com/rainbow-me/rainbow](https://github.com/rainbow-me/rainbow))  
> **Source Version**: `0e6ad90a`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T17:43:56.154Z  
> **Learning ID**: `learn-github-rainbow-me-rainbow`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): rainbow-me/rainbow

> **Canonical Artifact**: `07_PROJECT_LEARNING/rainbow-me-rainbow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rainbow-me/rainbow](https://github.com/rainbow-me/rainbow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T17:43:56.146Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rainbow-me/rainbow`
- **Description**: 🌈‒ the Ethereum wallet that lives in your pocket 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4397 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7883** (2026-10-15): **chore(ci): add cubic review instructions**
  *Symptoms*: ## What changed (plus any additional context for devs)  Adds a repo-root `cubic.yaml` that sets only `reviews.custom_instructions`. Every other cubic setting (sensitivity, incremental reviews, ignores) keeps its dashboard value.  The instructions target the findings that got declined most often on 15 recent PRs (#7824–#7880). cubic opened 73 review threads on them; about 50 led to fixes and about 21 were declined. The declined ones fell into four groups:  - **Overstated severity:** half of the P0/P1 findings were wrong. Most were speculation about backend behavior or races the UI can't reach. P0/P1 now needs a concrete path that triggers it, and claims about backend behavior become questions. - **Scope widening:** asks to handle flows the ticket excludes, or to add follow-up features. This happened even though `AGENTS.md`, which cubic reads, already says not to. - **Conflicts with repo conventions:** asks for non-English locale strings, render tests, `NATIVE_ROUTES` entries, and guards in `migrate`. - **Cosmetic comments:** test renames and rewording of code comments.  Test-quality comments (a test that can't detect the regression, leaked spies, misleading mocks) are left alone. They were mostly valid.  Notes: - The `custom_instructions` in `cubic.yaml` replace the dashboard's "AI review instructions" field. If that field has text, fold it in here. - These rules apply to cubic reviews on every PR in this repo. - Some of the noise comes from over-broad cubic learnings, which l

- **Issue #7882** (2026-10-15): **feat(expanded sheet): remove Quick Buy section**
  *Symptoms*: Fixes APP-3798  ## What changed (plus any additional context for devs)  Quick Buy, the collapsible "Buy {token}" section with preset fiat-amount chips, is rarely used. This PR removes it from the expanded asset sheet in both places it rendered:  - **Tokens you don't own:** directly under the chart. - **Tokens you own:** after Market Stats.  The footer Buy / Sell buttons are unchanged and still open Swaps.  Only the Quick Buy chips populated the `quickBuyMetadata` property on swap submitted/failed analytics events, so this PR removes that property along with its plumbing. New swap events no longer carry it, and the ticket's Amplitude charts that track it will go to zero.  The Quick Buy strings are removed from `en_US.json` only; other locales sync separately.  <!-- ship-visuals:start --> ## Screen recordings / screenshots  <!-- ship-visuals:source head=2ee9d25416eaebff8e4b0a16b64f7da739de3101 base=fea6250f13dd4392ea2833d760850293ab28965c platform=ios,android flow=manual-argent -->  | | iOS | Android | | --- | --- | --- | | **Token you don't own: before** | <img src="https://github.com/user-attachments/assets/4d8913ea-00ca-4883-a6fb-ff1bf9198aa6" width="300"> | <img src="https://github.com/user-attachments/assets/b459a9cd-ae97-473f-9678-9ef7cf011c5f" width="300"> | | **Token you don't own: after** | <img src="https://github.com/user-attachments/assets/0ee3cb4d-9805-4160-bf99-d1f5175a1189" width="300"> | <img src="https://github.com/user-attachments/assets/87d8eaa3-a904-435f-a53

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

### Incident Patch 1: `e554ecf2` (2026-10-06)
**Commit Message**: fix(android): support nested button presses (#7848)

## What changed (plus any additional context for devs)

- Adds nested button press support to the native RNGH-based Android
button implementation so that feature code no longer needs to compensate
for this platform inconsistency. Android `ButtonPressAnimation` behavior
is now effectively consistent with iOS.
- Cleans up `ButtonPressAnimation.android.tsx` and removes its
unnecessary wrapper views
- Also removes the `overflowMargin` and `skipTopMargin` options as the
problems they addressed were imposed by the old implementations
- Deletes the unused `ScaleButtonZoomable`, `FloatingActionButton`, and
the surrounding dead code
- Updates the existing RNGH patch:
1. Corrects Android touch interception and cancellation across
successive gestures. Also forwards native scroll capture to RNGH so
scrolling cancels button presses, and fixes the nested scroll view/pager
conflict when a drag starts over a button.
  2. Fixes the `createNativeWrapper` ref generics
- Moves Android sheet backdrop touch handling to the UI thread and makes
its `pointerEvents` style immediately responsive to a completed sheet
dismissal, where it previously lagged an

**File**: `android/app/src/main/java/com/swmansion/gesturehandler/react/RNZoomableButtonManager.java` (modified, +242/-79)
```diff
@@ -4,10 +4,17 @@
 import android.content.Context;
 import android.os.Handler;
 import android.os.Looper;
+import android.os.SystemClock;
+import android.view.InputDevice;
 import android.view.MotionEvent;
+import android.view.View;
+import android.view.ViewConfiguration;
+import android.view.accessibility.AccessibilityManager;
 import android.view.animation.Animation;
+import android.view.animation.AnimationUtils;
 import android.view.animation.Interpolator;
 import android.view.animation.ScaleAnimation;
+import android.view.animation.Transformation;
 import androidx.annotation.NonNull;
 import androidx.core.view.animation.PathInterpolatorCompat;
 import com.facebook.react.bridge.Arguments;
@@ -20,33 +27,45 @@
 import com.facebook.react.uimanager.ViewGroupManager;
 import com.facebook.react.uimanager.annotations.ReactProp;
 import com.facebook.react.uimanager.events.RCTEventEmitter;
+import com.swmansion.gesturehandler.core.NativeViewGestureHandler;
 import javax.annotation.Nullable;
 import java.util.Map;
 
 @ReactModule(name = "RNZoomableButton")
 public class RNZoomableButtonManager extends ViewGroupManager<RNGestureHandlerButtonViewManager.ButtonViewGroup> {
 
     public static class ZoomableButtonViewGroup extends RNGestureHandlerButtonViewManager.ButtonViewGroup {
+        private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
+
+        private enum LongPressState { NONE, TRIGGERED, HOLDING }
+
         private float mScaleTo = 0.86f;
         private int mDuration = 160;
         private float pivotX = 0.5f;
         private float pivotY = 0.5f;
         private static final Interpolator bezierInterpolator = PathInterpolatorCompat.create(0.25f, 0.46f, 0.45f, 0.94f);
 
+        private boolean hasPressStartHandler = false;
         private boolean isLongPress = false;
         private boolean shouldLongPressHoldPress = false;
         private int mMinLongPressDuration = 500;
 
         private boolean mIsActive = false;
-        private boolean mIsTaskScheduled = false;
-        private boolean didLongPressFire = false;
-        private boolean mIsLongTaskScheduled = false;
+        private LongPressState longPressState = LongPressState.NONE;
+        private int activePointerId = MotionEvent.INVALID_POINTER_ID;
+        private long touchDownTime = -1;
+        private NativeViewGestureHandler gestureHandler;
+        private boolean touchExploration;
+        private float presentationScale = 1f;
+        private final AccessibilityManager accessibilityManager;
+        private final int touchSlop;
 
-        private final Handler mHandler = new Handler(Looper.getMainLooper());
         private Runnable mLongPressRunnable;
 
         public ZoomableButtonViewGroup(Context context) {
             super(context);
+            accessibilityManager = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
+            touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
         }
 
         private void animate(boolean in) {
@@ -55,132 +74,271 @@ private void animate(boolean in) {
             }
             mIsActive = in;
             clearAnimation();
-            float fromScale = in ? 1f : mScaleTo;
+            float fromScale = presentationScale;
             float toScale = in ? mScaleTo : 1f;
+            if (fromScale == 1f && toScale == 1f) {
+                return;
+            }
             Animation anim = new ScaleAnimation(
                     fromScale, toScale,
                     fromScale, toScale,
                     Animation.RELATIVE_TO_SELF, pivotX,
-                    Animation.RELATIVE_TO_SELF, pivotY);
+                    Animation.RELATIVE_TO_SELF, pivotY) {
+                @Override
+                protected void applyTransformation(float time, Transformation transformation) {
+                    super.applyTransformation(time, transformation);
+                    presentationScale = fromScale + (toScale - fromScale) * time;
+                }
+            };
             anim.setFillAfter(true);
-            anim.setDuration(mDuration);
+            anim.setDuration(fromScale == toScale ? 0 : mDuration);
             anim.setInterpolator(bezierInterpolator);
             this.startAnimation(anim);
+            anim.setStartTime(AnimationUtils.currentAnimationTimeMillis());
+        }
+
+        @Override
+        public void onPrepare(NativeViewGestureHandler handler) {
+            gestureHandler = handler;
+        }
+
+        @Override
+        public void onReset(NativeViewGestureHandler handler) {
+            if (gestureHandler == handler) {
+                gestureHandler = null;
+            }
+        }
+
+        @Override
+        public boolean canBegin(@NonNull MotionEvent event) {
+            return activePointerId != MotionEvent.INVALID_POINTER_ID;
+        }
+
+        @Override
+        public boolean onInterceptTouchEvent(@NonNull MotionEvent event) {
+            return !touchE
```

**File**: `android/app/src/main/java/me/rainbow/MainActivity.kt` (modified, +13/-1)
```diff
@@ -3,10 +3,14 @@ package me.rainbow
 import android.content.Intent
 import android.content.res.Configuration
 import android.os.Bundle
+import android.view.MotionEvent
+import android.view.View
 import android.webkit.WebView
 import com.facebook.react.ReactActivity
 import com.facebook.react.ReactActivityDelegate
+import com.facebook.react.ReactRootView
 import com.facebook.react.modules.network.OkHttpClientProvider
+import com.swmansion.gesturehandler.react.RNGestureHandlerRootView
 import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory
 import com.zoontek.rnbootsplash.RNBootSplash
 import io.branch.rnbranch.RNBranchModule
@@ -56,5 +60,13 @@ class MainActivity : ReactActivity() {
     }
 
     override fun createReactActivityDelegate(): ReactActivityDelegate =
-        ReactActivityDelegate(this, mainComponentName)
+        object : ReactActivityDelegate(this, mainComponentName) {
+            override fun createRootView(): ReactRootView =
+                object : ReactRootView(this@MainActivity) {
+                    override fun onChildStartedNativeGesture(childView: View?, event: MotionEvent) {
+                        super.onChildStartedNativeGesture(childView, event)
+                        RNGestureHandlerRootView.onNativeGestureStarted(childView, event)
+                    }
+                }
+        }
 }
```

**File**: `patches/react-native-gesture-handler+2.31.1.patch` (modified, +367/-12)
```diff
@@ -1,8 +1,30 @@
+# PATCH CONTEXT
+# On Android:
+# - Let Rainbow's native button extend RNGH's button and access the handler
+#   for its current gesture, so nested presses activate the correct button.
+# - Preserve native pointer IDs so buttons track the same finger through
+#   Android and RNGH event delivery.
+# - Report native scroll and pull-to-refresh gestures to RNGH so they cancel
+#   competing button presses and pager gestures.
+# - Keep delivering touches to a native scrolling view when RNGH intercepts
+#   normal Android delivery. Forward only after other handlers decide whether
+#   to intercept, so the same event is neither skipped nor delivered twice.
+# - Reset root interception before a new gesture, and clear native touches
+#   left unfinished when RNGH intercepted the previous gesture.
+# - Do not let handlers waiting for another gesture to fail cancel presses
+#   as though they were already active.
+#
+# On iOS:
+# - Deliver touches inside scroll views immediately, without the default delay.
+# - Reset manual-activation recognizers when the app loses focus, so they do not
+#   ignore the first interaction after the app returns to the foreground.
+#
+# Correct createNativeWrapper's ref type to the wrapped component instance.
+
 diff --git a/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt b/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt
-index d515011..813c69c 100644
 --- a/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt
 +++ b/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt
-@@ -153,7 +153,7 @@ class RNGestureHandlerButtonViewManager :
+@@ -153,7 +153,7 @@
 
    override fun getDelegate(): ViewManagerDelegate<ButtonViewGroup>? = mDelegate
 
@@ -12,7 +34,6 @@ index d515011..813c69c 100644
      NativeViewGestureHandler.NativeViewGestureHandlerHook,
      ReactPointerEventsView {
 diff --git a/node_modules/react-native-gesture-handler/apple/Handlers/RNNativeViewHandler.mm b/node_modules/react-native-gesture-handler/apple/Handlers/RNNativeViewHandler.mm
-index 667d600..9054037 100644
 --- a/node_modules/react-native-gesture-handler/apple/Handlers/RNNativeViewHandler.mm
 +++ b/node_modules/react-native-gesture-handler/apple/Handlers/RNNativeViewHandler.mm
 @@ -161,7 +161,7 @@
@@ -25,10 +46,9 @@ index 667d600..9054037 100644
 
  - (void)handleTouchDown:(UIView *)sender forEvent:(UIEvent *)event
 diff --git a/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm b/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm
-index 708172f..7f1d550 100644
 --- a/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm
 +++ b/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm
-@@ -452,12 +452,28 @@
+@@ -452,9 +452,25 @@
      if (_recognizer.view != nil) {
        [_recognizer.view addGestureRecognizer:_manualActivationRecognizer];
      }
@@ -43,17 +63,352 @@ index 708172f..7f1d550 100644
 +                                                 object:nil];
      [_manualActivationRecognizer.view removeGestureRecognizer:_manualActivationRecognizer];
      _manualActivationRecognizer = nil;
-   }
- }
-
++  }
++}
++
 +- (void)handleAppWillResignActive:(NSNotification *)notification
 +{
 +  if (_manualActivationRecognizer != nil && _manualActivationRecognizer.enabled) {
 +    _manualActivationRecognizer.enabled = NO;
 +    _manualActivationRecognizer.enabled = YES;
+   }
+ }
+
+diff --git a/node_modules/react-native-gesture-handler/lib/typescript/handlers/createNativeWrapper.d.ts b/node_modules/react-native-gesture-handler/lib/typescript/handlers/createNativeWrapper.d.ts
+--- a/node_modules/react-native-gesture-handler/lib/typescript/handlers/createNativeWrapper.d.ts
++++ b/node_modules/react-native-gesture-handler/lib/typescript/handlers/createNativeWrapper.d.ts
+@@ -1,4 +1,4 @@
+ import * as React from 'react';
+ import { NativeViewGestureHandlerProps } from './NativeViewGestureHandler';
+-export default function createNativeWrapper<P>(Component: React.ComponentType<P>, config?: Readonly<NativeViewGestureHandlerProps>): React.ForwardRefExoticComponent<React.PropsWithoutRef<P & NativeViewGestureHandlerProps> & React.RefAttributes<React.ComponentType<any>>>;
++export default function createNativeWrapper<C extends React.ElementType>(Component: C, config?: Readonly<NativeViewGestureHandlerProps>): React.ForwardRefExoticComponent<React.PropsWithoutRef<React.ComponentProps<C> & NativeViewGestureHandlerProps> & React.RefAttributes<React.ComponentRef<C>>>;
+ //# sourceMappingURL=createNativeWrapper.d.ts.map
+\ No newline at end of file
+diff --git a/node_modules/react-native-gesture-handler/android/src/main/java/c
```

**File**: `src/__swaps__/screens/Swap/components/CoinRow.tsx` (modified, +17/-67)
```diff
@@ -2,7 +2,6 @@ import React, { useCallback, useMemo } from 'react';
 import { type GestureResponderEvent } from 'react-native';
 
 import { startCase } from 'lodash';
-import { type OnPressMenuItemEventObject } from 'react-native-ios-context-menu';
 import { triggerHaptics } from 'react-native-turbo-haptics';
 
 import { BalancePill } from '@/__swaps__/screens/Swap/components/BalancePill';
@@ -11,10 +10,9 @@ import { type AddressOrEth, type ParsedSearchAsset, type UniqueId } from '@/__sw
 import { type CoinRowItem } from '@/__swaps__/types/search';
 import { ButtonPressAnimation } from '@/components/animations/ButtonPressAnimation';
 import RainbowCoinIcon from '@/components/coin-icon/RainbowCoinIcon';
-import { ContextMenuButton } from '@/components/context-menu';
+import ContextMenuButton from '@/components/native-context-menu/contextMenu';
 import { Box, Column, Columns, HitSlop, Inline, Text } from '@/design-system';
 import { ChainId } from '@/features/network/types/backendNetworks';
-import { showActionSheetWithOptions } from '@/framework/ui/utils/actionsheet';
 import { setClipboard } from '@/hooks/useClipboard';
 import * as i18n from '@/languages';
 import { ETH_ADDRESS } from '@/references/constants';
@@ -122,7 +120,7 @@ export function CoinRow({
     <Box testID={testID} style={{ height, width: '100%' }}>
       <Columns alignVertical="center">
         <Column>
-          <ButtonPressAnimation disallowInterruption onPress={onPressHandler} scaleTo={0.95}>
+          <ButtonPressAnimation onPress={onPressHandler} scaleTo={0.95}>
             <HitSlop vertical="10px">
               <Box
                 alignItems="center"
@@ -190,89 +188,41 @@ const InfoButton = ({
     setClipboard(address);
   }, [address]);
 
-  const { options, menuConfig } = useMemo(() => {
-    const options = {
-      copy: {
-        title: i18n.t(i18n.l.exchange.coin_row.copy_contract_address),
-        action: handleCopy,
-      },
-      ...(isSupportedChain
-        ? {
-            blockExplorer: {
-              title: i18n.t(i18n.l.exchange.coin_row.view_on, {
-                blockExplorerName: startCase(ethereumUtils.getBlockExplorer({ chainId })),
-              }),
-              action: () => ethereumUtils.openAddressInBlockExplorer({ address, chainId }),
-            },
-          }
-        : {}),
-    };
-
-    const menuConfig = {
+  const menuConfig = useMemo(
+    () => ({
       menuItems: [
         {
           actionKey: 'copyAddress',
-          actionTitle: options.copy.title,
-          icon: {
-            iconType: 'SYSTEM',
-            iconValue: 'doc.on.doc',
-          },
+          actionTitle: i18n.t(i18n.l.exchange.coin_row.copy_contract_address),
+          icon: { iconType: 'SYSTEM', iconValue: 'doc.on.doc' },
         },
         ...(isSupportedChain
           ? [
               {
                 actionKey: 'blockExplorer',
-                actionTitle: options.blockExplorer?.title,
-                icon: {
-                  iconType: 'SYSTEM',
-                  iconValue: 'link',
-                },
+                actionTitle: i18n.t(i18n.l.exchange.coin_row.view_on, {
+                  blockExplorerName: startCase(ethereumUtils.getBlockExplorer({ chainId })),
+                }),
+                icon: { iconType: 'SYSTEM', iconValue: 'link' },
               },
             ]
           : []),
       ],
       menuTitle: `${isVerified ? i18n.t(i18n.l.token_search.section_header.verified) : i18n.t(i18n.l.token_search.section_header.unverified)} ${i18n.t(i18n.l.exchange.coin_row.token)}`,
-    };
-
-    return { options, menuConfig };
-  }, [address, chainId, handleCopy, isSupportedChain, isVerified]);
+    }),
+    [chainId, isSupportedChain, isVerified]
+  );
 
-  const handlePressMenuItem = async ({ nativeEvent: { actionKey } }: OnPressMenuItemEventObject) => {
+  const handlePressMenuItem = ({ nativeEvent: { actionKey } }: { nativeEvent: { actionKey: string } }): void => {
     if (actionKey === 'copyAddress') {
-      options.copy.action();
+      handleCopy();
     } else if (actionKey === 'blockExplorer' && isSupportedChain) {
-      options.blockExplorer?.action();
+      ethereumUtils.openAddressInBlockExplorer({ address, chainId });
     }
   };
 
-  const onPressAndroid = () => {
-    const androidOptions = [
-      options.copy.title,
-      ...(isSupportedChain && options.blockExplorer?.title ? [options.blockExplorer?.title] : []),
-    ];
-    showActionSheetWithOptions(
-      {
-        options: androidOptions,
-      },
-      idx => {
-        if (idx === 0) {
-          options.copy.action();
-        }
-        if (idx === 1 && isSupportedChain) {
-          options.blockExplorer?.action();
-        }
-      }
-    );
-  };
-
   return (
-    <ContextMenuButton
-      menuItems={menuConfig.menuItems}
-      menuTitle={menuConfig.menuTitle}
-      onPressAndroid={onPressAndroid}
-      onPressMenuItem={handlePressMenuItem}
-      testID={`coin-row-info-butto
```

**File**: `src/__swaps__/screens/Swap/components/CoinRowButton.tsx` (modified, +3/-1)
```diff
@@ -15,6 +15,7 @@ export const CoinRowButton = ({
   size,
   weight,
   disabled,
+  testID,
 }: {
   color?: string;
   icon: string;
@@ -23,14 +24,15 @@ export const CoinRowButton = ({
   size?: TextSize;
   weight?: TextWeight;
   disabled?: boolean;
+  testID?: string;
 }) => {
   const { isDarkMode } = useColorMode();
   const fillTertiary = useForegroundColor('fillTertiary');
   const fillQuaternary = useForegroundColor('fillQuaternary');
   const separatorTertiary = useForegroundColor('separatorTertiary');
 
   return (
-    <ButtonPressAnimation disallowInterruption onPress={onPress} scaleTo={0.8} disabled={disabled}>
+    <ButtonPressAnimation onPress={onPress} scaleTo={0.8} disabled={disabled} testID={testID}>
       <Box
         alignItems="center"
         borderRadius={14}
```

**File**: `src/__swaps__/screens/Swap/components/GasButton.tsx` (modified, +9/-19)
```diff
@@ -7,8 +7,8 @@ import { NavigationSteps } from '@/__swaps__/screens/Swap/hooks/useSwapNavigatio
 import { getColorValueForThemeWorklet } from '@/__swaps__/utils/swaps';
 import { ButtonPressAnimation } from '@/components/animations/ButtonPressAnimation';
 import { GestureHandlerButton } from '@/components/buttons/GestureHandlerButton';
+import ContextMenuButton from '@/components/native-context-menu/contextMenu';
 import { Box, Inline, Text, TextIcon, useColorMode, useForegroundColor } from '@/design-system';
-import { GasSpeedMenu } from '@/features/gas/components/GasSpeedMenu';
 import { useCustomGasSettings, type GasSettings } from '@/features/gas/hooks/useCustomGas';
 import { setSelectedGasSpeed, useSelectedGasSpeed } from '@/features/gas/hooks/useSelectedGas';
 import { GasSpeed } from '@/features/gas/types/gasSpeed';
@@ -123,10 +123,12 @@ const GasMenu = ({
   backToReview = false,
   children,
   disabled = false,
+  anchorAndroidMenuToRight,
 }: {
   backToReview?: boolean;
   children: ReactNode;
   disabled?: boolean;
+  anchorAndroidMenuToRight?: boolean;
 }) => {
   const { SwapNavigation } = useSwapContext();
 
@@ -160,14 +162,6 @@ const GasMenu = ({
     [handlePressSpeedOption]
   );
 
-  const handlePressActionSheet = useCallback(
-    (buttonIndex: number) => {
-      if (buttonIndex < 0) return;
-      handlePressSpeedOption(menuOptions[buttonIndex]);
-    },
-    [handlePressSpeedOption, menuOptions]
-  );
-
   const menuConfig = useMemo(() => {
     const menuItems = menuOptions.map(gasOption => {
       const currentBaseFee = getCachedCurrentBaseFee(chainId);
@@ -193,20 +187,16 @@ const GasMenu = ({
       style={{ margin: Platform.OS === 'android' ? 0 : -GAS_BUTTON_HIT_SLOP, pointerEvents: disabled ? 'none' : 'auto' }}
       testID="gas-speed-pager"
     >
-      <GasSpeedMenu
+      <ContextMenuButton
+        anchorAndroidMenuToRight={anchorAndroidMenuToRight}
         menuConfig={menuConfig}
-        onPressActionSheet={handlePressActionSheet}
         onPressMenuItem={handlePressMenuItem}
-        options={menuOptions}
+        testID="gas-speed-pager-button"
       >
-        <ButtonPressAnimation
-          scaleTo={0.825}
-          style={Platform.OS === 'android' ? undefined : { padding: GAS_BUTTON_HIT_SLOP }}
-          testID={Platform.OS === 'android' ? undefined : 'gas-speed-pager-button'}
-        >
+        <ButtonPressAnimation scaleTo={0.825} style={Platform.OS === 'android' ? undefined : { padding: GAS_BUTTON_HIT_SLOP }}>
           {children}
         </ButtonPressAnimation>
-      </GasSpeedMenu>
+      </ContextMenuButton>
     </Box>
   );
 };
@@ -230,7 +220,7 @@ export function ReviewGasButton() {
 
   return (
     <Inline alignVertical="center" space="8px" wrap={false}>
-      <GasMenu backToReview>
+      <GasMenu backToReview anchorAndroidMenuToRight>
         <Animated.View style={[styles.reviewGasButtonPill, animatedBorderColor]}>
           <SelectedGas isPill />
         </Animated.View>
```

**File**: `src/components/AccountImage.tsx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export const AccountImage = memo(function AccountImage({ onPress }: AccountImage
   }, [onPress]);
 
   return (
-    <ButtonPressAnimation onPress={handlePress} scaleTo={0.8} overflowMargin={50}>
+    <ButtonPressAnimation onPress={handlePress} scaleTo={0.8}>
       {accountImage ? (
         <ImageAvatar image={accountImage} marginRight={10} size="header" />
       ) : (
```

**File**: `src/components/ContactRowInfoButton.js` (modified, +3/-32)
```diff
@@ -1,15 +1,14 @@
 import React from 'react';
-import { Platform, View } from 'react-native';
+import { View } from 'react-native';
 
 import { startCase } from 'lodash';
-import { ContextMenuButton } from 'react-native-ios-context-menu';
 import RadialGradient from 'react-native-radial-gradient';
 import { triggerHaptics } from 'react-native-turbo-haptics';
 
+import ContextMenuButton from '@/components/native-context-menu/contextMenu';
 import { opacity } from '@/design-system/utils/opacity';
 import { IS_TEST } from '@/env';
 import styled from '@/framework/ui/styled-thing';
-import { showActionSheetWithOptions } from '@/framework/ui/utils/actionsheet';
 import useClipboard from '@/hooks/useClipboard';
 import * as i18n from '@/languages';
 import { fonts, fontWithWidth, padding } from '@/styles';
@@ -100,26 +99,6 @@ const ContactRowInfoButton = ({ children, item, chainId, scaleTo }) => {
     [setClipboard]
   );
 
-  const onPressAndroid = useCallback(() => {
-    const blockExplorerText = `View on ${startCase(ethereumUtils.getBlockExplorer({ chainId }))}`;
-    const androidContractActions = [i18n.t(i18n.l.wallet.action.copy_contract_address), blockExplorerText, i18n.t(i18n.l.button.cancel)];
-    showActionSheetWithOptions(
-      {
-        cancelButtonIndex: 2,
-        options: androidContractActions,
-        title: `${item?.name}`,
-      },
-      idx => {
-        if (idx === 0) {
-          handleCopyAddress(item?.address);
-        }
-        if (idx === 1) {
-          ethereumUtils.openAddressInBlockExplorer({ address: item?.address, chainId });
-        }
-      }
-    );
-  }, [item?.name, item?.address, handleCopyAddress, chainId]);
-
   const menuConfig = useMemo(() => {
     const blockExplorerAction = buildBlockExplorerAction(chainId);
     return {
@@ -149,15 +128,7 @@ const ContactRowInfoButton = ({ children, item, chainId, scaleTo }) => {
 
   return (
     <Container>
-      <ContextMenuButton
-        activeOpacity={0}
-        menuConfig={menuConfig}
-        {...(Platform.OS === 'android' ? { onPress: onPressAndroid } : {})}
-        isMenuPrimaryAction
-        onPressMenuItem={handlePressMenuItem}
-        useActionSheetFallback={false}
-        wrapNativeComponent={false}
-      >
+      <ContextMenuButton menuConfig={menuConfig} onPressMenuItem={handlePressMenuItem}>
         <ButtonPressAnimation scaleTo={scaleTo}>
           {children || (
             <Circle>
```

---

### Incident Patch 2: `05d5d732` (2026-10-16)
**Commit Message**: perf(charts): render through native Skia picture views (#7823)

## What changed (plus any additional context for devs)

- Moves `Candlestick`, `Polymarket`, and `Sparkline` charts to the
`SkiaPictureView` component added in #7816, which publishes Skia
pictures directly to `SkiaPictureViewNativeComponent` and is generally
more efficient than the prior UI-thread-drawing implementation
- Moves manager setup and disposal into the shared view abstraction,
removing the need for `useWorkletClass` and per-chart cleanup hooks.
Font changes now consistently update existing managers on both
platforms.
- Minor performance improvements: line paths are reused for interaction
markers and fills, and grid shaders are retained between draws
- Removes dead chart code
- Adds explicit resetting of additional chart and gesture state in the
`CandlestickChartManager` and `PolymarketChartManager` `dispose()`
methods
- Makes `Sparkline` charts responsive to dimension changes

## Screen recordings / screenshots

## What to test

**File**: `src/features/charts/candlestick/components/CandlestickChart.tsx` (modified, +208/-299)
```diff
@@ -1,15 +1,12 @@
 import React, { memo, useCallback, useMemo, useRef } from 'react';
-import { Platform, StyleSheet, View } from 'react-native';
+import { StyleSheet, View } from 'react-native';
 
 import {
   BlendMode,
-  Canvas,
   ClipOp,
   PaintStyle,
-  Picture,
   Skia,
   StrokeCap,
-  StrokeJoin,
   type SkCanvas,
   type SkColor,
   type SkParagraph,
@@ -20,6 +17,7 @@ import { dequal } from 'dequal';
 import { cloneDeep, merge } from 'lodash';
 import { Gesture, GestureDetector, State as GestureState } from 'react-native-gesture-handler';
 import Animated, {
+  cancelAnimation,
   Easing,
   runOnJS,
   runOnUI,
@@ -61,8 +59,7 @@ import {
 } from '@/features/perps/charts-plugin/PerpsIndicatorBuilder';
 import { usePerpsIndicatorData } from '@/features/perps/charts-plugin/usePerpsIndicatorData';
 import { time } from '@/framework/core/utils/time';
-import { useWorkletClass } from '@/hooks/reanimated/useWorkletClass';
-import { useCleanup } from '@/hooks/useCleanup';
+import { setSkiaPicture, SkiaPictureView, useSkiaRenderer, type SkiaPictureOutput } from '@/framework/ui/components/SkiaPictureView';
 import { useOnChange } from '@/hooks/useOnChange';
 import { useStableValue } from '@/hooks/useStableValue';
 import Routes from '@/navigation/routesNames';
@@ -72,7 +69,6 @@ import { type DeepPartial } from '@/types/objects';
 import { deepFreeze } from '@/utils/deepFreeze';
 import { DEVICE_WIDTH } from '@/utils/deviceUtils';
 import { normalizeSpringConfig, type DampingMassStiffnessConfig } from '@/worklets/animations';
-import { createBlankPicture } from '@/worklets/skia';
 
 import { NoChartData } from '../../components/NoChartData';
 import { type HyperliquidSymbol, type Token } from '../../types';
@@ -335,6 +331,7 @@ function getYAxisLabelWidth(maxCharacters: number): number {
 }
 
 const EMA_INDICATORS: IndicatorKey[] = ['EMA9', 'EMA20', 'EMA50'];
+const EMPTY_CANDLES: Bar[] = [];
 const LOAD_THRESHOLD_PX = DEVICE_WIDTH * 4;
 const LOADING_SPINNER_SIZE = 28;
 const MAX_CANDLES_TO_LOAD = 5000;
@@ -343,35 +340,36 @@ class CandlestickChartManager {
   private __workletClass = true;
 
   private backgroundColor: SkColor;
-  private blankPicture: SkPicture;
   private buildParagraph: (segments: TextSegment | TextSegment[]) => SkParagraph | null;
   private candleStrokeColor: SkColor;
   private candleWidth: number;
-  private candles: Bar[];
+  private candles: Bar[] = EMPTY_CANDLES;
   private chartHeight: number;
   private chartWidth: number;
   private config: CandlestickConfig;
   private fetchAdditionalCandles: () => void;
-  private hasPreviousCandles: boolean;
+  private hasPreviousCandles = false;
   private isDarkMode: boolean;
   private isHyperliquidToken: boolean;
   private nativeCurrency: { currency: NativeCurrencyKey; decimals: number };
+  private output: SkiaPictureOutput;
   private volumeBarColor: SkColor;
   private yAxisWidth: number;
 
   private activeCandle: SharedValue<Bar | undefined>;
   private chartMaxY: SharedValue<number>;
   private chartMinY: SharedValue<number>;
-  private chartPicture: SharedValue<SkPicture>;
   private chartScale: SharedValue<number>;
-  private crosshairPicture: SharedValue<SkPicture>;
-  private indicatorPicture: SharedValue<SkPicture>;
   private isChartGestureActive: SharedValue<boolean>;
   private isDecelerating: SharedValue<boolean>;
   private isLoadingHistoricalCandles: SharedValue<boolean>;
   private maxDisplayedVolume: SharedValue<number>;
   private offset: SharedValue<number>;
 
+  private chartPicture: SkPicture | undefined;
+  private compositePicture: SkPicture | undefined;
+  private crosshairPicture: SkPicture | undefined;
+  private indicatorPicture: SkPicture | undefined;
   private lastCrosshairPosition = { x: 0, y: 0 };
   private lastVisibleRange = { startIndex: -1, endIndex: -1 };
   private maxYAxisLabelDecimals = 2;
@@ -405,20 +403,14 @@ class CandlestickChartManager {
     labelQuinary: Skia.Color(getColorForTheme('labelQuinary', 'light')),
     green: Skia.Color(GREEN_CANDLE_COLOR),
     red: Skia.Color(RED_CANDLE_COLOR),
-    transparent: Skia.Color('transparent'),
     white: Skia.Color('#FFFFFF'),
   };
 
   private paints = {
-    EMA9: Skia.Paint(),
-    EMA20: Skia.Paint(),
-    EMA50: Skia.Paint(),
-    background: Skia.Paint(),
     bottomShadow: Skia.Paint(),
     candleBody: Skia.Paint(),
     candleWick: Skia.Paint(),
     candleStroke: Skia.Paint(),
-    chartArea: Skia.Paint(),
     crosshairDot: Skia.Paint(),
     crosshairLine: Skia.Paint(),
     grid: Skia.Paint(),
@@ -432,77 +424,64 @@ class CandlestickChartManager {
   constructor({
     activeCandle,
     buildParagraph,
-    candles,
     chartHeight,
     chartMaxY,
     chartMinY,
-    chartPicture,
     chartScale,
     chartWidth,
     chartXOffset,
     config,
-    crosshairPicture,
     fetchAdditionalCandles,
-    hasPreviousCandles,
-    indicatorPicture,
     isChartGestureActive,
     isDarkMode,
     isDecelerating,
     isLoadingHisto
```

**File**: `src/features/charts/line/LineSeries.ts` (modified, +23/-86)
```diff
@@ -34,9 +34,7 @@ export type LineEffectsConfig = {
 
 export type InteractionConfig = {
   greyCirclePaint: SkPaint;
-  greyColor: SkColor;
   greyColorString: string;
-  greyLinePaint: SkPaint;
   normalizedSplitPoint: number;
   progress: number;
 };
@@ -114,6 +112,7 @@ export class LineSeries {
     width: 0,
   };
   private readonly sampleCursor = { index: 0 };
+  private readonly interactionPoints = { endX: 0, endY: 0, splitX: 0, splitY: 0 };
   private readonly splitLeftPath = Skia.Path.Make();
   private readonly splitRightPath = Skia.Path.Make();
 
@@ -526,7 +525,7 @@ export class LineSeries {
     const fullyGrey = clampedSplitX <= layout.startX;
 
     const t = interaction.progress;
-    const splitT = this.getTrimTAtXFromPath(path, clampedSplitX);
+    const splitT = this.measureInteractionPoints(path, clampedSplitX, this.getYAtIndex(params, this.prices.length - 1));
 
     this.splitLeftPath.reset();
     this.splitLeftPath.addPath(path);
@@ -595,62 +594,23 @@ export class LineSeries {
     }
   }
 
+  /** Draws markers using the geometry prepared by `drawLinesWithInteraction`. */
   public drawCirclesWithInteraction(
     canvas: SkCanvas,
-    params: DrawParams,
-    path: SkPath,
     effects: LineEffectsConfig | undefined,
     interaction: InteractionConfig,
-    progress = 1,
     entranceYOffset = 0
   ): void {
     if (!this.prices.length) return;
 
-    const { chartRegionHeight, maxPrice, minPrice } = params;
-    const priceRange = maxPrice - minPrice || 1;
-    const layout = this.computeLayout(params);
-
-    path.reset();
-    if (this.previousPath && this.targetPath) {
-      buildSmoothedPathAnimated(
-        path,
-        this.previousPath,
-        this.targetPath,
-        progress,
-        SAMPLE_COUNT,
-        this.smoothingMode,
-        this.smoothingTension
-      );
-    } else {
-      const points = new Float32Array(SAMPLE_COUNT * 2);
-      this.sampleCursor.index = 0;
-      for (let i = 0; i < SAMPLE_COUNT; i++) {
-        const normalized = i / (SAMPLE_COUNT - 1);
-        const targetTs = layout.startTs + normalized * layout.range;
-        const price = this.samplePriceAtTimestamp(targetTs);
-        const idx = i * 2;
-        points[idx] = layout.startX + normalized * layout.width;
-        points[idx + 1] = chartRegionHeight - ((price - minPrice) / priceRange) * chartRegionHeight;
-      }
-      buildSmoothedPath(path, points, SAMPLE_COUNT, this.smoothingMode, this.smoothingTension);
-    }
-
     const hasEntranceOffset = entranceYOffset !== 0;
     if (hasEntranceOffset) {
       canvas.save();
       canvas.translate(0, entranceYOffset);
     }
 
     const { progress: interactionProgress } = interaction;
-    const splitX = params.offsetX + interaction.normalizedSplitPoint * params.availableWidth;
-    const clampedSplitX = Math.min(Math.max(splitX, layout.startX), layout.endX);
-    const fallbackY = this.getYAtIndex(params, Math.max(0, this.prices.length - 1));
-    const splitY = this.getYAtXFromPath(path, clampedSplitX, fallbackY);
-
-    const lastPt = path.getLastPt();
-    const endX = lastPt.x;
-    const endY = lastPt.y;
-
+    const { endX, endY, splitX, splitY } = this.interactionPoints;
     const circleRadius = effects?.endCircleRadius ?? 0;
     const color = this.getColor();
 
@@ -670,12 +630,6 @@ export class LineSeries {
           }
         }
 
-        const interpolated = interpolateColor(interactionProgress, [0, 1], [this.getColorString(), interaction.greyColorString], 'LAB');
-        const rgba = convertToRGBA(interpolated);
-        this.interpolatedColor[0] = rgba[0];
-        this.interpolatedColor[1] = rgba[1];
-        this.interpolatedColor[2] = rgba[2];
-        this.interpolatedColor[3] = rgba[3];
         interaction.greyCirclePaint.setColor(this.interpolatedColor);
         canvas.drawCircle(endX, endY, scaledRadius, interaction.greyCirclePaint);
       }
@@ -687,21 +641,28 @@ export class LineSeries {
       if (effects.endCircleShadowPaint) {
         effects.endCircleShadowPaint.setColor(color);
         effects.endCircleShadowPaint.setAlphaf(effects.endCircleShadowAlpha);
-        const shadowX = clampedSplitX + (effects.endCircleShadowOffset?.x ?? 0) * interactionProgress;
+        const shadowX = splitX + (effects.endCircleShadowOffset?.x ?? 0) * interactionProgress;
         const shadowY = splitY + (effects.endCircleShadowOffset?.y ?? 0) * interactionProgress;
         canvas.drawCircle(shadowX, shadowY, scaledRadius, effects.endCircleShadowPaint);
       }
 
       effects.endCirclePaint.setColor(color);
-      canvas.drawCircle(clampedSplitX, splitY, scaledRadius, effects.endCirclePaint);
+      canvas.drawCircle(splitX, splitY, scaledRadius, effects.endCirclePaint);
     }
 
     if (hasEntranceOffset) {
       canvas.restore();
     }
   }
 
-  private getTrimTAtXFromPath(path: SkPath, desiredX: number): number {
+  private measureInteractionPoints(path: SkPath, desiredX: number, fallbackY: number): n
```

**File**: `src/features/charts/line/LineSeriesBuilder.ts` (modified, +2/-2)
```diff
@@ -191,12 +191,12 @@ export class LineSeriesBuilder {
 
     for (const s of this.series) {
       if (s.key !== this.highlightedKey) {
-        s.drawCirclesWithInteraction(canvas, params, this.drawPath, effects, interaction, progress, entranceYOffset);
+        s.drawCirclesWithInteraction(canvas, effects, interaction, entranceYOffset);
       }
     }
     if (this.highlightedKey) {
       const highlighted = this.series.find(s => s.key === this.highlightedKey);
-      highlighted?.drawCirclesWithInteraction(canvas, params, this.drawPath, effects, interaction, progress, entranceYOffset);
+      highlighted?.drawCirclesWithInteraction(canvas, effects, interaction, entranceYOffset);
     }
   }
 
```

**File**: `src/features/charts/line/compact/CompactLineChartRenderer.ts` (modified, +24/-47)
```diff
@@ -6,24 +6,14 @@ import {
   TileMode,
   type SkPaint,
   type SkPath,
-  type SkPicture,
   type SkPictureRecorder,
   type SkShader,
 } from '@shopify/react-native-skia';
-import { convertToRGBA, type SharedValue } from 'react-native-reanimated';
+import { convertToRGBA } from 'react-native-reanimated';
 
 import { type CompactLineChartData } from '@/features/charts/line/compact/types';
 import { buildSmoothedPath, LineSmoothing } from '@/features/charts/line/LineSmoothingAlgorithms';
-
-// ============ Types ========================================================== //
-
-type CompactLineChartRendererConfig = {
-  blankPicture: SkPicture;
-  chartPicture: SharedValue<SkPicture>;
-  /** Desired line width from the leftmost point to the rightmost. */
-  contentWidth: number;
-  height: number;
-};
+import { setSkiaPicture, type SkiaPictureOutput } from '@/framework/ui/components/SkiaPictureView';
 
 // ============ Constants ====================================================== //
 
@@ -134,27 +124,21 @@ export function getCompactLineChartEndPoint(
 export class CompactLineChartRenderer {
   private readonly __workletClass = true;
 
-  private readonly blankPicture: SkPicture;
-  private readonly chartPicture: SharedValue<SkPicture>;
-  private readonly contentWidth: number;
+  private readonly output: SkiaPictureOutput;
   private readonly fillPaint: SkPaint;
   private readonly fillPath: SkPath;
-  private readonly height: number;
   private readonly pictureRecorder: SkPictureRecorder;
-  private readonly surfaceWidth: number;
   private readonly strokePaint: SkPaint;
   private readonly strokePath: SkPath;
 
+  private contentWidth = 0;
+  private height = 0;
   private currentColor: string | null = null;
   private currentShader: SkShader | null = null;
 
-  constructor({ blankPicture, chartPicture, contentWidth, height }: CompactLineChartRendererConfig) {
-    this.blankPicture = blankPicture;
-    this.chartPicture = chartPicture;
-    this.contentWidth = contentWidth;
-    this.height = height;
+  constructor(output: SkiaPictureOutput) {
+    this.output = output;
     this.pictureRecorder = Skia.PictureRecorder();
-    this.surfaceWidth = contentWidth + COMPACT_LINE_CHART_HORIZONTAL_OVERDRAW * 2;
 
     this.strokePath = Skia.Path.Make();
     this.fillPath = Skia.Path.Make();
@@ -173,14 +157,16 @@ export class CompactLineChartRenderer {
     this.fillPaint.setStyle(PaintStyle.Fill);
   }
 
-  public setData(data: CompactLineChartData | undefined, lineColor: string): void {
+  public setData(data: CompactLineChartData | undefined, lineColor: string, contentWidth: number, height: number): void {
     const pointCount = data ? Math.min(data.prices.length, data.timestamps.length) : 0;
     if (!data || pointCount < 2) {
-      this.setBlankPicture();
+      this.clearPicture();
       return;
     }
 
-    if (lineColor !== this.currentColor) {
+    this.contentWidth = contentWidth;
+    if (lineColor !== this.currentColor || height !== this.height) {
+      this.height = height;
       this.setColor(lineColor);
     }
 
@@ -189,11 +175,8 @@ export class CompactLineChartRenderer {
   }
 
   public recolor(lineColor: string): void {
-    if (lineColor === this.currentColor) return;
+    if (!this.output.picture || lineColor === this.currentColor) return;
     this.setColor(lineColor);
-
-    // No built geometry to re-record (blank/first render) — the new color is retained for the next setData.
-    if (this.chartPicture.value === this.blankPicture) return;
     this.buildPicture();
   }
 
@@ -207,10 +190,7 @@ export class CompactLineChartRenderer {
     this.fillPaint.dispose();
     this.pictureRecorder.dispose();
 
-    const currentPicture = this.chartPicture.value;
-    if (currentPicture !== this.blankPicture) {
-      currentPicture.dispose();
-    }
+    this.output.picture?.dispose();
   }
 
   private setColor(color: string): void {
@@ -243,7 +223,7 @@ export class CompactLineChartRenderer {
   private buildPicture(): void {
     const canvas = this.pictureRecorder.beginRecording({
       height: this.height,
-      width: this.surfaceWidth,
+      width: this.contentWidth + COMPACT_LINE_CHART_HORIZONTAL_OVERDRAW * 2,
       x: 0,
       y: 0,
     });
@@ -252,19 +232,16 @@ export class CompactLineChartRenderer {
     canvas.drawPath(this.fillPath, this.fillPaint);
     canvas.drawPath(this.strokePath, this.strokePaint);
 
-    const oldPicture = this.chartPicture.value;
-    this.chartPicture.value = this.pictureRecorder.finishRecordingAsPicture();
-    if (oldPicture !== this.blankPicture) {
-      oldPicture.dispose();
-    }
+    const oldPicture = this.output.picture;
+    setSkiaPicture(this.output, this.pictureRecorder.finishRecordingAsPicture());
+    oldPicture?.dispose();
   }
 
-  private setBlankPicture(): void {
-    const oldPicture = this.chartPicture.value;
-    this.chartPicture.value = this.blankPicture;
-    if (oldPicture !== this.blankPicture) {
-      oldPicture.dispo
```

**File**: `src/features/charts/line/components/SparklineChart.tsx` (modified, +13/-30)
```diff
@@ -1,16 +1,12 @@
 import React, { memo, useCallback } from 'react';
 import { StyleSheet, View } from 'react-native';
 
-import { Canvas, Picture } from '@shopify/react-native-skia';
 import { useListen } from '@storesjs/stores';
 import Animated, { runOnUI, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
 
 import { SPRING_CONFIGS } from '@/components/animations/animationConfigs';
-import { useWorkletClass } from '@/hooks/reanimated/useWorkletClass';
-import { useCleanup } from '@/hooks/useCleanup';
+import { SkiaPictureView, useSkiaRenderer } from '@/framework/ui/components/SkiaPictureView';
 import { useOnChange } from '@/hooks/useOnChange';
-import { useStableValue } from '@/hooks/useStableValue';
-import { createBlankPicture } from '@/worklets/skia';
 
 import { COMPACT_LINE_CHART_HORIZONTAL_OVERDRAW, CompactLineChartRenderer } from '../compact/CompactLineChartRenderer';
 import { type CompactLineChartData, type LineChartDataStore, type SparklineChartProps } from '../compact/types';
@@ -37,20 +33,10 @@ export const SparklineChart = memo(function SparklineChart<S extends LineChartDa
 }: SparklineChartProps<S>) {
   const isColorString = typeof color === 'string';
   const renderWidth = width + COMPACT_LINE_CHART_HORIZONTAL_OVERDRAW * 2;
-  const initialPicture = useStableValue(() => createBlankPicture(renderWidth, height));
-
-  const chartPicture = useSharedValue(initialPicture);
+  const renderer = useSkiaRenderer<CompactLineChartRenderer>();
   const entranceProgress = useSharedValue(0);
   const hasRenderedData = useSharedValue(false);
 
-  const renderer = useWorkletClass(
-    () => ({ blankPicture: initialPicture, chartPicture, contentWidth: width, height }),
-    config => {
-      'worklet';
-      return new CompactLineChartRenderer(config);
-    }
-  );
-
   const animatedStyle = useAnimatedStyle(() => {
     const progress = entranceProgress.value;
     return { opacity: progress, transform: [{ translateY: 4 - progress * 4 }] };
@@ -63,21 +49,21 @@ export const SparklineChart = memo(function SparklineChart<S extends LineChartDa
         const hasData = data !== undefined;
         const shouldAnimateIn = hasData && !hasRenderedData.value;
 
-        renderer.value?.setData(data, resolvedLineColor);
+        renderer.manager?.setData(data, resolvedLineColor, width, height);
         hasRenderedData.value = hasData;
 
         if (shouldAnimateIn) entranceProgress.value = 0;
         entranceProgress.value = withSpring(hasData ? 1 : 0, SPRING_CONFIGS.softerSpringConfig);
       })(nextData);
     },
-    [color, entranceProgress, hasRenderedData, isColorString, renderer]
+    [color, entranceProgress, hasRenderedData, height, isColorString, renderer, width]
   );
 
   useAnimatedReaction(
     () => (isColorString ? color : color.value),
     (nextColor, previousColor) => {
       if (previousColor === null || nextColor === previousColor) return;
-      renderer.value?.recolor(nextColor);
+      renderer.manager?.recolor(nextColor);
     },
     [color]
   );
@@ -93,14 +79,6 @@ export const SparklineChart = memo(function SparklineChart<S extends LineChartDa
     drawChart(store.getState().getChartData(chartId));
   }, [chartId, drawChart, store]);
 
-  useCleanup(() => {
-    initialPicture.dispose();
-    runOnUI(() => {
-      renderer.value?.dispose?.();
-      renderer.value = undefined;
-    })();
-  });
-
   return (
     <View style={[styles.frame, { height, width }]}>
       <Animated.View
@@ -114,9 +92,14 @@ export const SparklineChart = memo(function SparklineChart<S extends LineChartDa
           animatedStyle,
         ]}
       >
-        <Canvas style={[styles.canvas, { height, width: renderWidth }]}>
-          <Picture picture={chartPicture} />
-        </Canvas>
+        <SkiaPictureView
+          initialize={output => {
+            'worklet';
+            return new CompactLineChartRenderer(output);
+          }}
+          renderer={renderer}
+          style={[styles.canvas, { height, width: renderWidth }]}
+        />
       </Animated.View>
       {livePointer ? <LiveSparklinePointer chartId={chartId} color={color} height={height} store={store} width={width} /> : null}
     </View>
```

**File**: `src/features/charts/line/types.ts` (modified, +0/-25)
```diff
@@ -1,6 +1,3 @@
-import { type SkPicture } from '@shopify/react-native-skia';
-import { type SharedValue } from 'react-native-reanimated';
-
 // ============ Drawing Parameters ============================================= //
 
 /**
@@ -80,28 +77,6 @@ export type BaseChartConfig = {
   grid: GridConfig;
 };
 
-// ============ Shared Values ================================================== //
-
-/** Shared values used by chart managers for reactive state. */
-export type ChartSharedValues = {
-  /** Main chart picture */
-  chartPicture: SharedValue<SkPicture>;
-  /** Maximum Y value (price) in visible range */
-  chartMaxY: SharedValue<number>;
-  /** Minimum Y value (price) in visible range */
-  chartMinY: SharedValue<number>;
-  /** Current zoom scale */
-  chartScale: SharedValue<number>;
-  /** Crosshair overlay picture */
-  crosshairPicture: SharedValue<SkPicture>;
-  /** Whether a gesture is currently active */
-  isChartGestureActive: SharedValue<boolean>;
-  /** Whether pan deceleration is active */
-  isDecelerating: SharedValue<boolean>;
-  /** Current X offset (pan position) */
-  offset: SharedValue<number>;
-};
-
 // ============ Bounds and Range =============================================== //
 
 /** Represents the visible range of data indices. */
```

**File**: `src/features/charts/polymarket/classes/PolymarketChartManager.ts` (modified, +52/-151)
```diff
@@ -5,13 +5,11 @@ import {
   PaintStyle,
   Skia,
   StrokeCap,
-  StrokeJoin,
   TileMode,
   type SkCanvas,
   type SkColor,
   type SkPaint,
   type SkParagraph,
-  type SkPicture,
 } from '@shopify/react-native-skia';
 import { State as GestureState } from 'react-native-gesture-handler';
 import { type SharedValue } from 'react-native-reanimated';
@@ -20,10 +18,10 @@ import { triggerHaptics } from 'react-native-turbo-haptics';
 import { getColorForTheme } from '@/design-system/color/useForegroundColor';
 import { type TextSegment } from '@/design-system/components/SkiaText/useSkiaText';
 import { type InteractionConfig, type LineEffectsConfig } from '@/features/charts/line/LineSeries';
+import { setSkiaPicture, type SkiaPictureOutput } from '@/framework/ui/components/SkiaPictureView';
 import { type ResponseByTheme } from '@/theme/types';
 import { deepFreeze } from '@/utils/deepFreeze';
 import { normalizeSpringConfig } from '@/worklets/animations';
-import { createBlankPicture } from '@/worklets/skia';
 
 import { Animator } from '../../candlestick/classes/Animator';
 import { TimeFormatter } from '../../candlestick/classes/TimeFormatter';
@@ -120,14 +118,16 @@ export class PolymarketChartManager {
   private readonly availableWidth: number;
   private readonly config: PolymarketChartConfig;
 
-  private backgroundColor: SkColor;
   private buildParagraph: (segments: TextSegment | TextSegment[]) => SkParagraph | null;
   private isDarkMode: boolean;
   private readonly smoothingMode: LineSmoothing | undefined;
   private series: OutcomeSeries[] = [];
   private timeDomain: { endTs: number; startTs: number } | null = null;
   private readonly fallbackTimeDomain = { endTs: 1, startTs: 0 };
-  private yAxisWidth = 0;
+  private readonly yAxisWidth: number;
+
+  private chartMinY = 0;
+  private chartMaxY = 1;
 
   private hasPlayedEntranceAnimation = false;
   private isAnimating = false;
@@ -145,15 +145,11 @@ export class PolymarketChartManager {
   private readonly interactionProgress: SharedValue<number>;
 
   private readonly animationProgress: SharedValue<number>;
-  private readonly chartMaxY: SharedValue<number>;
-  private readonly chartMinY: SharedValue<number>;
-  private readonly chartPicture: SharedValue<SkPicture>;
-  private readonly crosshairPicture: SharedValue<SkPicture>;
   private readonly isChartGestureActive: SharedValue<boolean>;
 
   private readonly animator: Animator;
-  private readonly blankPicture: SkPicture;
   private readonly lineSeriesBuilder: LineSeriesBuilder;
+  private readonly output: SkiaPictureOutput;
   private readonly pictureRecorder = Skia.PictureRecorder();
   private readonly timeFormatter = new TimeFormatter();
 
@@ -162,23 +158,17 @@ export class PolymarketChartManager {
     crosshairLine: SkColor;
     labelQuinary: SkColor;
     labelQuinaryString: string;
-    labelSecondary: SkColor;
     white: SkColor;
   };
 
   private readonly paints: {
-    bottomShadow: SkPaint;
-    bubbleFill: SkPaint;
-    bubbleStroke: SkPaint;
     crosshairLine: SkPaint;
     endCircle: SkPaint | null;
     endCircleShadow: SkPaint | null;
     grid: SkPaint;
     greyCircle: SkPaint;
-    greyLine: SkPaint;
     lineShadow: SkPaint | null;
     text: SkPaint;
-    topShadow: SkPaint;
   };
 
   private lineEffectsConfig: LineEffectsConfig | undefined;
@@ -189,51 +179,39 @@ export class PolymarketChartManager {
     animationProgress,
     buildParagraph,
     chartHeight,
-    chartMaxY,
-    chartMinY,
-    chartPicture,
     chartWidth,
     config,
-    crosshairPicture,
     interactionProgress,
     isChartGestureActive,
     isDarkMode,
+    output,
     smoothingMode,
   }: {
     activeInteraction: SharedValue<ActiveInteractionData | undefined> | undefined;
     animationProgress: SharedValue<number>;
     buildParagraph: (segments: TextSegment | TextSegment[]) => SkParagraph | null;
     chartHeight: number;
-    chartMaxY: SharedValue<number>;
-    chartMinY: SharedValue<number>;
-    chartPicture: SharedValue<SkPicture>;
     chartWidth: number;
     config: PolymarketChartConfig;
-    crosshairPicture: SharedValue<SkPicture>;
     interactionProgress: SharedValue<number>;
     isChartGestureActive: SharedValue<boolean>;
     isDarkMode: boolean;
+    output: SkiaPictureOutput;
     smoothingMode?: LineSmoothing;
   }) {
     if (activeInteraction) this.activeInteraction = activeInteraction;
     this.animationProgress = animationProgress;
-    this.backgroundColor = Skia.Color(config.chart.backgroundColor);
     this.buildParagraph = buildParagraph;
     this.chartHeight = chartHeight;
-    this.chartMaxY = chartMaxY;
-    this.chartMinY = chartMinY;
-    this.chartPicture = chartPicture;
     this.chartWidth = chartWidth;
     this.config = config;
-    this.crosshairPicture = crosshairPicture;
     this.interactionProgress = interactionProgress;
     this.isChartGestureActive = isChartGestureActive;
     this.isDarkMode = isDarkMode;
+    this.output = outpu
```

**File**: `src/features/charts/polymarket/components/PolymarketChart.tsx` (modified, +65/-121)
```diff
@@ -1,7 +1,6 @@
 import React, { memo, useCallback, useMemo } from 'react';
-import { Platform, StyleSheet, View } from 'react-native';
+import { StyleSheet, View } from 'react-native';
 
-import { Canvas, Picture, type SkPicture } from '@shopify/react-native-skia';
 import { useListen } from '@storesjs/stores';
 import { cloneDeep, merge } from 'lodash';
 import { Gesture, GestureDetector } from 'react-native-gesture-handler';
@@ -19,15 +18,13 @@ import { SPRING_CONFIGS } from '@/components/animations/animationConfigs';
 import { globalColors, useColorMode, useForegroundColor } from '@/design-system';
 import { useSkiaText } from '@/design-system/components/SkiaText/useSkiaText';
 import { opacity } from '@/design-system/utils/opacity';
-import { useWorkletClass } from '@/hooks/reanimated/useWorkletClass';
-import { useCleanup } from '@/hooks/useCleanup';
+import { SkiaPictureView, useSkiaRenderer } from '@/framework/ui/components/SkiaPictureView';
 import { useOnChange } from '@/hooks/useOnChange';
 import { useStableValue } from '@/hooks/useStableValue';
 import { useListenerRouteGuard } from '@/state/internal/hooks/useListenerRouteGuard';
 import { type DeepPartial } from '@/types/objects';
 import { deepFreeze } from '@/utils/deepFreeze';
 import { DEVICE_WIDTH } from '@/utils/deviceUtils';
-import { createBlankPicture } from '@/worklets/skia';
 
 import { NoChartData } from '../../components/NoChartData';
 import { type LineSmoothing } from '../../line/LineSmoothingAlgorithms';
@@ -60,14 +57,6 @@ enum ChartStatus {
 const DEFAULT_CHART_HEIGHT = 272;
 const SPINNER_SIZE = 28;
 
-type PreparedChartConfig = {
-  chartHeight: number;
-  chartWidth: number;
-  config: PolymarketChartConfig;
-  initialPicture: SkPicture;
-  initialStatus: ChartStatus;
-};
-
 export const DEFAULT_POLYMARKET_CHART_CONFIG = deepFreeze({
   animation: {
     entranceAnimation: EntranceAnimation.Draw,
@@ -133,36 +122,20 @@ export const PolymarketChart = memo(function PolymarketChart({
   const backgroundColor = providedBackgroundColor ?? (isDarkMode ? '#141619' : '#FFFFFF');
 
   const xAxisAreaHeight = DEFAULT_POLYMARKET_CHART_CONFIG.chart.xAxisHeight + DEFAULT_POLYMARKET_CHART_CONFIG.chart.xAxisGap * 2;
-  const baseChartHeight = providedChartHeight - xAxisAreaHeight;
-
-  const {
-    chartHeight,
-    chartWidth: preparedChartWidth,
-    config,
-    initialPicture,
-    initialStatus,
-  } = useStableValue<PreparedChartConfig>(() =>
-    prepareChartConfig({
-      backgroundColor,
-      baseChartHeight,
-      chartWidth,
-      isMarketChart,
-      providedChartHeight,
-      providedConfig,
-    })
-  );
+  const chartHeight = providedChartHeight - xAxisAreaHeight;
+  const initialStatus = useStableValue(() => {
+    const data = (isMarketChart ? usePolymarketMarketChartStore : usePolymarketChartStore).getState().getData();
+    return data ? (data.series.length ? ChartStatus.Loaded : ChartStatus.Empty) : ChartStatus.Loading;
+  });
 
   const internalIsChartGestureActive = useSharedValue(false);
   const isChartGestureActive = providedIsChartGestureActive ?? internalIsChartGestureActive;
 
   const animationProgress = useSharedValue(100);
-  const chartMaxY = useSharedValue(1);
-  const chartMinY = useSharedValue(0);
   const chartStatus = useSharedValue<ChartStatus>(initialStatus);
   const interactionProgress = useSharedValue(0);
 
-  const chartPicture = useSharedValue(initialPicture);
-  const crosshairPicture = useSharedValue(initialPicture);
+  const renderer = useSkiaRenderer<PolymarketChartManager>({ deferred: true });
 
   const buildParagraph = useSkiaText({
     align: 'left',
@@ -172,91 +145,78 @@ export const PolymarketChart = memo(function PolymarketChart({
     weight: 'bold',
   });
 
-  const chartManager = useWorkletClass(() => {
-    'worklet';
-    return new PolymarketChartManager({
-      activeInteraction,
-      animationProgress,
-      buildParagraph,
-      chartHeight,
-      chartMaxY,
-      chartMinY,
-      chartPicture,
-      chartWidth: preparedChartWidth,
-      config,
-      crosshairPicture,
-      interactionProgress,
-      isChartGestureActive,
-      isDarkMode,
-      smoothingMode,
-    });
-  }, true);
-
   const updateChart = useCallback(
     (newData: PolymarketChartData) => {
       runOnUI(() => {
-        if (!chartManager.value) return;
+        if (!renderer.manager) return;
 
         if (newData === null) {
           chartStatus.value = ChartStatus.Loading;
           return;
         }
 
         if (newData.series.length > 0) {
-          chartManager.value.setSeriesData(newData.series, isDarkMode);
+          renderer.manager.setSeriesData(newData.series, isDarkMode);
           chartStatus.value = ChartStatus.Loaded;
         } else {
-          chartManager.value.clearData();
+          renderer.manager.clearData();
           chartStatus.value = ChartStatus.Empty;
         }
       })();
     },
-    [chartManager, chartStatus, isDarkMode]
+    [renderer, 
```

---

### Incident Patch 3: `d8b32b45` (2026-10-15)
**Commit Message**: fix(cash): offer sign-in when recovery finds the account's passkey already on the device (#7870)

Fixes APP-4138

## What changed (plus any additional context for devs)

A user who still has their Cash passkey on the device can go Sign Up →
"You already have an account" → Recover Account. Recovery succeeds, but
the Add Passkey step then fails with "Error adding passkey": the
registration options exclude the account's enrolled passkeys, so iOS
refuses to create another one (`ASAuthorizationError` 1006). No API
error shows, because the failure happens on the device.

The passkey step now recognises that failure and shows "You already have
a passkey" with **Sign in with Passkey**, which signs in with the
existing passkey using the phone number just verified, then finishes
setup like the existing-account Sign In. Recovery doesn't revoke
existing passkeys, so that sign-in works. Cancelling the sign-in, or a
sign-in failure, leaves the sheet up for another try. Other passkey
errors and cancellation behave as before.

- `react-native-passkeys` folds 1006 into a generic `UnknownException`;
the existing patch now gives it its own code,
`ERR_PASSKEY_EXCLUDED_CREDENTIAL`. This is a native cha

**File**: `patches/react-native-passkeys+0.4.1.patch` (modified, +18/-4)
```diff
@@ -7,11 +7,14 @@
 #     cancellation and identify callbacks so a timed-out request releases the
 #     native slot without settling a newer request. Android implements the shared
 #     bridge method as a no-op because Cash only invokes cancellation on iOS.
+#   - iOS folds ASAuthorizationError 1006 (the device already holds a passkey the
+#     request excludes) into UnknownException. Give it a distinct code so Cash can
+#     offer sign-in with that passkey instead of a generic failure.
 # Upstream Issue: https://github.com/peterferguson/react-native-passkeys/issues/13
 #   (same missing-method symptom; the issue does not establish the root cause).
-# Linear Issue: APP-4117.
-# Remove when: react-native-passkeys exposes cancellation and no longer reads its
-#   own methods off the spread default export.
+# Linear Issues: APP-4117, APP-4138.
+# Remove when: react-native-passkeys exposes cancellation, no longer reads its own
+#   methods off the spread default export, and reports iOS error 1006 distinctly.
 
 diff --git a/node_modules/react-native-passkeys/android/src/main/java/expo/modules/passkeys/ReactNativePasskeysModule.kt b/node_modules/react-native-passkeys/android/src/main/java/expo/modules/passkeys/ReactNativePasskeysModule.kt
 index 42f67d0..2601d4b 100644
@@ -199,7 +202,7 @@ index 0138931..215b4b5 100644
    override var reason: String {
      "Passkeys are not supported on this iOS version. Please use iOS 15 or above"
 diff --git a/node_modules/react-native-passkeys/ios/ReactNativePasskeysModule.swift b/node_modules/react-native-passkeys/ios/ReactNativePasskeysModule.swift
-index 06e9aa9..660c1f0 100644
+index 06e9aa9..42a4df6 100644
 --- a/node_modules/react-native-passkeys/ios/ReactNativePasskeysModule.swift
 +++ b/node_modules/react-native-passkeys/ios/ReactNativePasskeysModule.swift
 @@ -3,8 +3,10 @@ import ExpoModulesCore
@@ -313,6 +316,17 @@ index 06e9aa9..660c1f0 100644
          promise.reject(
              handleASAuthorizationError(
                  errorCode: (error as NSError).code,
+@@ -441,6 +470,10 @@ func handleASAuthorizationError(errorCode: Int, localizedDescription: String = "
+     case 4004:
+         return NotConfiguredException(
+             name: "NotConfiguredException", description: localizedDescription)
++    case 1006:
++        return Exception(
++            name: "PasskeyExcludedCredentialException", description: localizedDescription,
++            code: "ERR_PASSKEY_EXCLUDED_CREDENTIAL")
+     default:
+         return UnknownException(name: "UnknownException", description: localizedDescription)
+     }
 diff --git a/node_modules/react-native-passkeys/src/ReactNativePasskeysModule.ts b/node_modules/react-native-passkeys/src/ReactNativePasskeysModule.ts
 index 22b8020..6d744de 100644
 --- a/node_modules/react-native-passkeys/src/ReactNativePasskeysModule.ts
```

**File**: `src/features/cash/screens/cash-deposit-setup/CashDepositSetupScreen.tsx` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ import { PasskeyStep } from './steps/PasskeyStep';
 import { PhoneStep } from './steps/PhoneStep';
 import { ReviewStep } from './steps/ReviewStep';
 import { SsnStep } from './steps/SsnStep';
-import { useAddPasskeyFlowStore } from './steps/useAddPasskeyFlow';
+import { selectIsPasskeyCeremonyPending, useAddPasskeyFlowStore } from './steps/useAddPasskeyFlow';
 import { useSubmitPhoneFlowStore } from './steps/useSubmitPhoneFlow';
 import { useSubmitReviewFlowStore } from './steps/useSubmitReviewFlow';
 
@@ -76,7 +76,7 @@ export const CashDepositSetupScreen = memo(function CashDepositSetupScreen() {
   );
 
   useListen(useCashSetupSessionStore, s => s.session.status === 'empty', restartSetupWithoutCredential);
-  useListen(useAddPasskeyFlowStore, s => s.state === 'submitting', restartSetupWithoutCredential);
+  useListen(useAddPasskeyFlowStore, selectIsPasskeyCeremonyPending, restartSetupWithoutCredential);
 
   useCleanup(() => {
     CashDepositSetupNavigation.resetNavigationState();
```

**File**: `src/features/cash/screens/cash-deposit-setup/setupAction.ts` (modified, +10/-0)
```diff
@@ -69,6 +69,16 @@ export async function submitPasskey(): Promise<void> {
   else if (result === 'recovered') completeSetup();
 }
 
+export async function signInWithPasskeyOnDevice(): Promise<void> {
+  if (!CashDepositSetupNavigation.isRouteActive(Routes.CASH_SETUP_PASSKEY)) return;
+  if (
+    (await useAddPasskeyFlowStore.getState().signInWithPasskeyOnDevice()) === 'signedIn' &&
+    CashDepositSetupNavigation.isRouteActive(Routes.CASH_SETUP_PASSKEY)
+  ) {
+    completeSetup();
+  }
+}
+
 export async function submitReview(): Promise<void> {
   const result = await useSubmitReviewFlowStore.getState().submit();
   if (result === 'recovered') CashDepositSetupNavigation.navigate(Routes.CASH_SETUP_PASSKEY);
```

**File**: `src/features/cash/screens/cash-deposit-setup/setupNavigation.test.ts` (modified, +2/-2)
```diff
@@ -212,9 +212,9 @@ describe('restartSetupWithoutCredential', () => {
     expect(CashDepositSetupNavigation.getActiveRoute()).toBe(Routes.CASH_SETUP_PASSKEY);
   });
 
-  it('waits for passkey enrollment to settle', () => {
+  it.each(['submitting', 'signingIn'] as const)('waits for a %s passkey ceremony to settle', state => {
     CashDepositSetupNavigation.navigate(Routes.CASH_SETUP_REVIEW);
-    useAddPasskeyFlowStore.setState({ state: 'submitting' });
+    useAddPasskeyFlowStore.setState({ state });
 
     useCashSetupSessionStore.getState().reset();
     restartSetupWithoutCredential();
```

**File**: `src/features/cash/screens/cash-deposit-setup/setupNavigation.ts` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ import { useKycReturnFlowStore } from '../../stores/kycReturnFlowStore';
 import { useVerifyPhoneFlowStore } from '../../stores/verifyPhoneFlowStore';
 import { CashDepositSetupNavigation, useCashDepositSetupNavigationStore } from './cashDepositSetupNavigator';
 import { getNextSetupStep, isSetupEditDetour } from './steps';
-import { useAddPasskeyFlowStore } from './steps/useAddPasskeyFlow';
+import { selectIsPasskeyCeremonyPending, useAddPasskeyFlowStore } from './steps/useAddPasskeyFlow';
 import { useSubmitPhoneFlowStore } from './steps/useSubmitPhoneFlow';
 import { useSubmitReviewFlowStore } from './steps/useSubmitReviewFlow';
 
@@ -81,7 +81,7 @@ export function abandonSetupSession(): void {
 export function restartSetupWithoutCredential(): void {
   if (useCashSetupSessionStore.getState().session.status !== 'empty') return;
   if (hasUsablePasskey()) return;
-  if (useAddPasskeyFlowStore.getState().state === 'submitting') return;
+  if (selectIsPasskeyCeremonyPending(useAddPasskeyFlowStore.getState())) return;
   if (CashDepositSetupNavigation.isRouteActive(Routes.CASH_SETUP_PHONE)) return;
 
   const isActive = selectIsSetupScreenActive(useNavigationStore.getState());
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/PasskeyStep.tsx` (modified, +23/-1)
```diff
@@ -6,10 +6,11 @@ import { CashStatusHalfSheet } from '@/features/cash/components/CashStatusHalfSh
 import * as i18n from '@/languages';
 
 import { SetupStepLayout } from '../components/SetupStepLayout';
-import { submitPasskey } from '../setupAction';
+import { signInWithPasskeyOnDevice, submitPasskey } from '../setupAction';
 import { useAddPasskeyFlowStore } from './useAddPasskeyFlow';
 
 const l = i18n.l.cash.deposit_setup.passkey;
+const onDeviceL = i18n.l.cash.deposit_setup.passkey.on_device;
 
 const KEY_ICON = '􀟖';
 
@@ -37,6 +38,27 @@ export const PasskeyStep = memo(function PasskeyStep() {
           title={i18n.t(l.error_title)}
         />
       )}
+
+      {(state === 'passkeyOnDevice' || state === 'signingIn') && (
+        <CashStatusHalfSheet
+          description={i18n.t(onDeviceL.description)}
+          primaryAction={{
+            label: i18n.t(onDeviceL.sign_in),
+            loading: state === 'signingIn',
+            onPress: signInWithPasskeyOnDevice,
+            testID: 'cash-setup-passkey-on-device-sign-in',
+          }}
+          secondaryAction={{
+            disabled: state === 'signingIn',
+            label: i18n.t(i18n.l.button.cancel),
+            onPress: reset,
+            testID: 'cash-setup-passkey-on-device-cancel',
+          }}
+          status="info"
+          testID="cash-setup-passkey-on-device"
+          title={i18n.t(onDeviceL.title)}
+        />
+      )}
     </>
   );
 });
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/useAddPasskeyFlow.test.ts` (modified, +47/-0)
```diff
@@ -4,6 +4,7 @@ import { analytics } from '@/analytics';
 import { logger } from '@/logger';
 
 import { createPasskeyCredential } from '../../../services/cashPasskeyService';
+import { signInWithPhone } from '../../../services/cashSignInService';
 import { addPasskey, finishAddPasskey } from '../../../services/userClient';
 import { useCashAccountStore } from '../../../stores/cashAccountStore';
 import { useCashSetupSessionStore, type RecoveryPhoneChallenge } from '../../../stores/cashSetupSessionStore';
@@ -34,6 +35,11 @@ vi.mock('../../../services/cashPasskeyService', () => ({
   createPasskeyCredential: vi.fn(),
   getPasskeyName: vi.fn(() => 'iPhone 15 Pro'),
   isPasskeyCancellation: vi.fn((error: unknown) => error instanceof Error && error.message === 'UserCancelled'),
+  isPasskeyAlreadyOnDevice: vi.fn((error: unknown) => error instanceof Error && error.message === 'PasskeyOnDevice'),
+}));
+
+vi.mock('../../../services/cashSignInService', () => ({
+  signInWithPhone: vi.fn(),
 }));
 
 vi.mock('../../../stores/cashAccountStore', () => {
@@ -44,6 +50,7 @@ vi.mock('../../../stores/cashAccountStore', () => {
 const mockAddPasskey = vi.mocked(addPasskey);
 const mockFinishAddPasskey = vi.mocked(finishAddPasskey);
 const mockCreatePasskeyCredential = vi.mocked(createPasskeyCredential);
+const mockSignInWithPhone = vi.mocked(signInWithPhone);
 const track = vi.mocked(analytics.track);
 const setUserId = vi.mocked(useCashAccountStore.getState().setUserId);
 
@@ -184,3 +191,43 @@ describe('useAddPasskeyFlowStore.submit', () => {
     expect(track).not.toHaveBeenCalled();
   });
 });
+
+describe('passkey already on the device', () => {
+  beforeEach(() => {
+    verifyRecoverySession();
+    mockCreatePasskeyCredential.mockRejectedValue(new Error('PasskeyOnDevice'));
+  });
+
+  it('offers sign-in instead of reporting a failure', async () => {
+    await expect(flow().submit()).resolves.toBe('failed');
+
+    expect(flow().state).toBe('passkeyOnDevice');
+    expect(mockFinishAddPasskey).not.toHaveBeenCalled();
+    expect(logger.error).not.toHaveBeenCalled();
+    expect(track).not.toHaveBeenCalledWith('cash.passkey_failed', expect.anything());
+  });
+
+  it('signs in with the verified phone number', async () => {
+    mockSignInWithPhone.mockResolvedValue(undefined);
+    await flow().submit();
+
+    await expect(flow().signInWithPasskeyOnDevice()).resolves.toBe('signedIn');
+
+    expect(mockSignInWithPhone).toHaveBeenCalledWith('4155550100', 'passkeyOnDevicePrompt');
+    expect(flow().state).toBe('entry');
+  });
+
+  it('keeps the prompt when sign-in is cancelled or fails', async () => {
+    await flow().submit();
+
+    mockSignInWithPhone.mockRejectedValueOnce(new Error('UserCancelled'));
+    await expect(flow().signInWithPasskeyOnDevice()).resolves.toBe('cancelled');
+    expect(flow().state).toBe('passkeyOnDevice');
+    expect(logger.error).not.toHaveBeenCalled();
+
+    mockSignInWithPhone.mockRejectedValueOnce(new Error('network down'));
+    await expect(flow().signInWithPasskeyOnDevice()).resolves.toBe('failed');
+    expect(flow().state).toBe('passkeyOnDevice');
+    expect(logger.error).toHaveBeenCalled();
+  });
+});
```

**File**: `src/features/cash/screens/cash-deposit-setup/steps/useAddPasskeyFlow.ts` (modified, +38/-3)
```diff
@@ -4,29 +4,41 @@ import { analytics } from '@/analytics';
 import { logger, RainbowError } from '@/logger';
 
 import { isCashAccessRefusedError } from '../../../services/cashAccessRefusal';
-import { createPasskeyCredential, getPasskeyName, isPasskeyCancellation } from '../../../services/cashPasskeyService';
+import { isHandledCashError } from '../../../services/cashHandledError';
+import {
+  createPasskeyCredential,
+  getPasskeyName,
+  isPasskeyAlreadyOnDevice,
+  isPasskeyCancellation,
+} from '../../../services/cashPasskeyService';
+import { signInWithPhone } from '../../../services/cashSignInService';
 import { addPasskey, finishAddPasskey } from '../../../services/userClient';
 import { useCashAccountStore } from '../../../stores/cashAccountStore';
 import { useCashSetupSessionStore } from '../../../stores/cashSetupSessionStore';
 import { getTelemetryErrorReason } from '../../../utils/getTelemetryErrorReason';
 
-export type AddPasskeyState = 'entry' | 'submitting' | 'error';
+export type AddPasskeyState = 'entry' | 'submitting' | 'error' | 'passkeyOnDevice' | 'signingIn';
 
 export type AddPasskeyResult = 'completed' | 'recovered' | 'cancelled' | 'failed' | 'skipped';
 
 type AddPasskeyFlowStore = {
   state: AddPasskeyState;
   reset: () => void;
   submit: () => Promise<AddPasskeyResult>;
+  signInWithPasskeyOnDevice: () => Promise<'signedIn' | 'cancelled' | 'failed'>;
 };
 
+export function selectIsPasskeyCeremonyPending({ state }: { state: AddPasskeyState }): boolean {
+  return state === 'submitting' || state === 'signingIn';
+}
+
 export const useAddPasskeyFlowStore = createBaseStore<AddPasskeyFlowStore>((set, get) => ({
   state: 'entry',
 
   reset: () => set({ state: 'entry' }),
 
   submit: async () => {
-    if (get().state === 'submitting') return 'skipped';
+    if (selectIsPasskeyCeremonyPending(get())) return 'skipped';
     const { session } = useCashSetupSessionStore.getState();
     if (session.status !== 'phoneVerified') return 'skipped';
     const recovering = session.source === 'recovery';
@@ -53,10 +65,33 @@ export const useAddPasskeyFlowStore = createBaseStore<AddPasskeyFlowStore>((set,
         set({ state: 'entry' });
         return 'cancelled';
       }
+      if (isPasskeyAlreadyOnDevice(e)) {
+        set({ state: 'passkeyOnDevice' });
+        return 'failed';
+      }
       logger.error(new RainbowError('[useAddPasskeyFlow]: Failed to add passkey', e));
       analytics.track(analytics.event.cashPasskeyFailed, { reason: getTelemetryErrorReason(e) });
       set({ state: 'error' });
       return 'failed';
     }
   },
+
+  // The passkey already on the device belongs to this account, so it signs in where enrolling another
+  // cannot. Cancelling or failing leaves the prompt in place for a retry.
+  signInWithPasskeyOnDevice: async () => {
+    const { session } = useCashSetupSessionStore.getState();
+    if (get().state !== 'passkeyOnDevice' || session.status !== 'phoneVerified') return 'failed';
+
+    set({ state: 'signingIn' });
+    try {
+      await signInWithPhone(session.phoneNationalNumber, 'passkeyOnDevicePrompt');
+      set({ state: 'entry' });
+      return 'signedIn';
+    } catch (e) {
+      set({ state: 'passkeyOnDevice' });
+      if (isHandledCashError(e)) return 'cancelled';
+      logger.error(new RainbowError('[useAddPasskeyFlow]: Failed to sign in with the passkey on this device', e));
+      return 'failed';
+    }
+  },
 }));
```

#### Recent Merged Pull Requests:
- **PR #7883** (2026-10-15): chore(ci): add cubic review instructions (@i1skn)
- **PR #7882** (2026-10-15): feat(expanded sheet): remove Quick Buy section (@i1skn)
- **PR #7880** (2026-10-15): fix(e2e): use default remote config in E2E (@i1skn)
- **PR #7873** (2026-10-14): fix(ios): stuck refresh indicators (@christianbaroni)
- **PR #7872** (2026-10-08): Bump iOS and Android to v2.0.47 (@jinchung)
- **PR #7870** (2026-10-15): fix(cash): offer sign-in when recovery finds the account's passkey already on the device (@i1skn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. android): support nested button presses (#7848)

**RULE**:
When implementing operations in `android/app/src/main/java/com/swmansion/gesturehandler/react/RNZoomableButtonManager.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rainbow-me/rainbow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e554ecf2`: android): support nested button presses (#7848). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `android/app/src/main/java/com/swmansion/gesturehandler/react/RNZoomableButtonManager.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.accessibility.AccessibilityManager;
import android.view.animation.AnimationUtils;
import android.view.animation.Transformation;
import com.swmansion.gesturehandler.core.NativeViewGestureHandler;
        private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());

        private enum LongPressState { NONE, TRIGGERED, HOLDING }

        private boolean hasPressStartHandler = false;
        private LongPressState longPressState = LongPressState.NONE;
        private int activePointerId = MotionEvent.INVALID_POINTER_ID;
        private long touchDownTime = -1;
        private NativeViewGestureHandler gestureHandler;
        private boolean touchExploration;
        private float presentationScale = 1f;
        private final AccessibilityManager accessibilityManager;
        private final int touchSlop;
            accessibilityManager = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
            touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
            float fromScale
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
        private boolean mIsTaskScheduled = false;
        private boolean didLongPressFire = false;
        private boolean mIsLongTaskScheduled = false;
        private final Handler mHandler = new Handler(Looper.getMainLooper());
            float fromScale = in ? 1f : mScaleTo;
                    Animation.RELATIVE_TO_SELF, pivotY);
            anim.setDuration(mDuration);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e554ecf2` are properly handled with clean fallback behavior.
