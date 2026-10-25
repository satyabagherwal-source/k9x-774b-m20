> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rainbow-me-rainbow-learnings.md`  
> **Source**: github ([https://github.com/rainbow-me/rainbow](https://github.com/rainbow-me/rainbow))  
> **Source Version**: `9997c6ed`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T22:31:50.508Z  
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
> **Harvest Timestamp**: 2026-10-25T22:31:49.933Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rainbow-me/rainbow`
- **Description**: 🌈‒ the Ethereum wallet that lives in your pocket 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4399 stars

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
- **Issue #7891** (2026-10-23): **fix(sports): coordinate scrolling and pager gestures**
  *Symptoms*: ## What changed (plus any additional context for devs)  - Prevents horizontal scrolling in Sports carousels and category tabs from changing pages in Predictions - Exposes `SmoothPager`’s swipe gesture refs to child scroll views and fixes RNGH’s `blocksHandlers` support, which previously passed refs to native code where handler IDs were required  ## Screen recordings / screenshots  ## What to test 

- **Issue #7888** (2026-10-20): **feat(spot-pnl): realized P&L on the pill once every purchased token is sold**
  *Symptoms*: > **Folded into #7878** as a commit on top of its branch (GitHub therefore shows this PR as merged into that branch). The description below is kept for reference; #7878's description now covers this change.  Fixes APP-4114  ## What changed (plus any additional context for devs)  The fully realized P&L sheet from #7878 had no way in for users. Now, once a wallet no longer holds any token it bought, the P&L pill on the expanded sheet switches to realized P&L. It reads **Realized Profit** or **Realized Loss**, shows the realized amount and %, and opens the fully realized sheet. This is the entry point agreed in DES-180.  It shows in two cases: - **Token not owned** (everything was sold): there's no balance card, so the pill sits in its place under the chart, as in the design. - **Token owned only through transfers**: the wallet bought some, sold all of those, and still holds tokens it received. The balance card shows. Before this change the pill was hidden here, because nothing bought is still held. Alex confirmed in [Slack](https://rainbowhaus.slack.com/archives/C0468CDBE75/p1792511360379339?thread_ts=1792415875.345899&cid=C0468CDBE75) that it should show the realized pill. Codex reports `purchasedTokenBalance: 0` for this case. Example: grunt.eth's AERO, where 12.9 were bought and sold, and 200 are held from transfers.  While bought tokens are still held, the pill is unchanged: unrealized **Profit/Loss**. With nothing bought held and no sale in the last 12 months, there's no p

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

### Incident Patch 1: `9997c6ed` (2026-10-23)
**Commit Message**: feat(cash): toggle the staging backend from Developer Settings (#7884)

## What changed (plus any additional context for devs)

The cash staging backend is now a toggle in Developer Settings → Cash
Settings ("Use cash staging backend") instead of the `CASH_USE_PROD` env
var, which is removed.

- Defaults to production. The choice is persisted
(`cashPlatformSetting`) and read once at startup.
- Store installs (`IS_STORE_INSTALL`) always use production, regardless
of the persisted value.
- Toggling wipes the cash state (persisted stores `cashAccount`,
`cashBuyOrder`, `cashPaymentMethod`, `cashWallet`, plus the in-memory
access token and Setup session), since accounts, cards and orders belong
to the other platform, then restarts the app.

The "Set cash user id from clipboard" and "Clear cash account" debug
rows are replaced with:

- **Sign out of cash** (shown when an account is on the device): signs
in with the passkey if no access token is cached, calls `POST
/v1/auth/Logout`, then wipes the cash state.
- **Sign out and delete cash account** (red; shown only when the app is
running against staging): same, but calls the staging-only `DELETE
/v1/dev/HardDeleteSelf`.

A cancelled passk

**File**: `globals.d.ts` (modified, +0/-1)
```diff
@@ -63,7 +63,6 @@ declare module 'react-native-dotenv' {
   export const BIVO_ENV: 'sandbox' | 'live';
   export const CASH_PLATFORM_BASE_URL: string;
   export const CASH_PLATFORM_API_KEY: string;
-  export const CASH_USE_PROD: 'true' | 'false';
   export const GELATO_API_KEY: string;
   export const RAINBOW_RELAY_URL: string;
   export const RAINBOW_RELAY_API_KEY: string;
```

**File**: `src/features/cash/services/cashDevSettingsService.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import { useCashAccountStore } from '../stores/cashAccountStore';
+import { useCashAuthTokenStore } from '../stores/cashAuthTokenStore';
+import { useCashBuyOrderStore } from '../stores/cashBuyOrderStore';
+import { useCashPaymentMethodStore } from '../stores/cashPaymentMethodStore';
+import { useCashPlatformSettingStore } from '../stores/cashPlatformSettingStore';
+import { useCashSetupSessionStore } from '../stores/cashSetupSessionStore';
+import { useCashWalletStore } from '../stores/cashWalletStore';
+import { ensureAccessToken } from './cashSignInService';
+import { hardDeleteSelf, logout } from './userClient';
+
+type PersistedStore<S> = {
+  getInitialState: () => S;
+  setState: (state: S, replace: true) => void;
+  persist: { clearStorage: () => void };
+};
+
+function clearPersistedStore<S>(store: PersistedStore<S>): void {
+  // Reset in memory first: a throttled write still pending would otherwise restore the removed entry.
+  store.setState(store.getInitialState(), true);
+  store.persist.clearStorage();
+}
+
+function clearCashState(): void {
+  clearPersistedStore(useCashAccountStore);
+  clearPersistedStore(useCashBuyOrderStore);
+  clearPersistedStore(useCashPaymentMethodStore);
+  clearPersistedStore(useCashWalletStore);
+  useCashAuthTokenStore.getState().clearToken();
+  useCashSetupSessionStore.getState().reset();
+}
+
+/** Persisted cash state belongs to one platform's accounts and orders, so it is wiped on every switch. Restart the app afterwards. */
+export function setCashStagingPlatform(useStagingPlatform: boolean): void {
+  clearCashState();
+  useCashPlatformSettingStore.setState({ useStagingPlatform });
+}
+
+export async function signOutOfCash(): Promise<void> {
+  await logout(await ensureAccessToken('developerSettings'));
+  clearCashState();
+}
+
+export async function deleteCashAccount(): Promise<void> {
+  await hardDeleteSelf(await ensureAccessToken('developerSettings'));
+  clearCashState();
+}
```

**File**: `src/features/cash/services/cashPlatformClient.ts` (modified, +7/-4)
```diff
@@ -1,17 +1,20 @@
-import { CASH_PLATFORM_API_KEY, CASH_PLATFORM_BASE_URL, CASH_USE_PROD } from 'react-native-dotenv';
+import { CASH_PLATFORM_API_KEY, CASH_PLATFORM_BASE_URL } from 'react-native-dotenv';
 
+import { IS_STORE_INSTALL } from '@/env';
 import { RainbowFetchClient } from '@/framework/data/http/rainbowFetch';
 import { getPlatformClient } from '@/resources/platform/client';
 
+import { useCashPlatformSettingStore } from '../stores/cashPlatformSettingStore';
+
 let stagingClient: RainbowFetchClient | undefined;
 
 export function buildAuthenticatedHeader(token: string) {
   return { Authorization: `Bearer ${token}` };
 }
 
-// Production unless CASH_USE_PROD=false in .env, which keeps the staging platform
-// reachable while cash backend changes roll out.
-export const USES_STAGING_PLATFORM = CASH_USE_PROD === 'false';
+// Store installs always use the production platform. Elsewhere a developer setting can switch to the
+// staging platform while cash backend changes roll out.
+export const USES_STAGING_PLATFORM = !IS_STORE_INSTALL && useCashPlatformSettingStore.getState().useStagingPlatform;
 
 export function getCashPlatformClient(): RainbowFetchClient {
   if (!USES_STAGING_PLATFORM) return getPlatformClient();
```

**File**: `src/features/cash/services/cashSignInService.ts` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ import { isCashAccessRefusedError } from './cashAccessRefusal';
 import { cancelPasskeyRequest, getPasskeyAssertion, isPasskeyCancellation } from './cashPasskeyService';
 import { finalizeAuth, finishLogin, startLogin, type StartLoginParams } from './userClient';
 
-export type CashSignInTrigger = 'cardLink' | 'addCash' | 'signInScreen' | 'existingAccountPrompt' | 'passkeyOnDevicePrompt';
+export type CashSignInTrigger =
+  | 'cardLink'
+  | 'addCash'
+  | 'signInScreen'
+  | 'existingAccountPrompt'
+  | 'passkeyOnDevicePrompt'
+  | 'developerSettings';
 
 const TOKEN_EXPIRY_MARGIN = time.seconds(30);
 const PASSKEY_ASSERTION_TIMEOUT = time.minutes(2);
```

**File**: `src/features/cash/services/userClient.ts` (modified, +9/-0)
```diff
@@ -403,6 +403,15 @@ export async function finalizeAuth({
   return parseAccessCredential(data);
 }
 
+export async function logout(accessToken: string): Promise<void> {
+  await userServiceRequest(() => getCashPlatformClient().post('/auth/Logout', {}, { headers: buildAuthenticatedHeader(accessToken) }));
+}
+
+/** Staging only: other platforms reject it. */
+export async function hardDeleteSelf(accessToken: string): Promise<void> {
+  await userServiceRequest(() => getCashPlatformClient().delete('/dev/HardDeleteSelf', { headers: buildAuthenticatedHeader(accessToken) }));
+}
+
 export async function getUserStatus({ bootstrapToken }: GetUserStatusParams): Promise<KycStatusResult> {
   if (IS_TESTING === 'true') {
     await delay(time.seconds(1));
```

**File**: `src/features/cash/stores/cashPlatformSettingStore.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import { createBaseStore } from '@storesjs/stores';
+
+type CashPlatformSettingStore = {
+  useStagingPlatform: boolean;
+};
+
+// Read once at startup, so changing it only takes effect after a restart.
+export const useCashPlatformSettingStore = createBaseStore<CashPlatformSettingStore>(() => ({ useStagingPlatform: false }), {
+  storageKey: 'cashPlatformSetting',
+  // Flush on the next tick so the app restart that follows a change cannot drop it.
+  persistThrottleMs: 0,
+});
```

**File**: `src/features/debug/screens/DevSection.tsx` (modified, +51/-11)
```diff
@@ -10,7 +10,11 @@ import Restart from 'react-native-restart';
 
 import { ImgixImage } from '@/components/images';
 import { IS_STORE_INSTALL } from '@/env';
+import { deleteCashAccount, setCashStagingPlatform, signOutOfCash } from '@/features/cash/services/cashDevSettingsService';
+import { isHandledCashError } from '@/features/cash/services/cashHandledError';
+import { USES_STAGING_PLATFORM } from '@/features/cash/services/cashPlatformClient';
 import { useCashAccountStore } from '@/features/cash/stores/cashAccountStore';
+import { useCashPlatformSettingStore } from '@/features/cash/stores/cashPlatformSettingStore';
 import { defaultConfig, defaultConfigValues, type ExperimentalConfigKey } from '@/features/config/constants/experimental';
 import { useExperimentalConfigStore } from '@/features/config/stores/experimentalConfigStore';
 import { RevokeReason } from '@/features/delegation/types/revokeReason';
@@ -39,16 +43,20 @@ import { useConnectedToAnvilStore } from '@/state/connectedToAnvil';
 import { nonceActions } from '@/state/nonces';
 import { pendingTransactionsActions } from '@/state/pendingTransactions';
 import { clearWalletState, useWalletsStore } from '@/state/wallets/walletsStore';
+import { useTheme } from '@/theme/ThemeContext';
 import { delegation, type DelegationWithChainId } from '@rainbow-me/sdk';
 
 import { analyzeUserAssets } from '../utils/analyzeUserAssets';
 
 export const DevSection = () => {
   const { navigate } = useNavigation();
+  const { colors } = useTheme();
   const config = useExperimentalConfigStore(state => state.config);
   const setConnectedToAnvil = useConnectedToAnvilStore.getState().setConnectedToAnvil;
   const accountAddress = useWalletsStore(state => state.accountAddress);
   const cashUserId = useCashAccountStore(state => state.userId);
+  const cashUsesStagingPlatform = useCashPlatformSettingStore(state => state.useStagingPlatform);
+  const [pendingCashAccountAction, setPendingCashAccountAction] = useState<'signOut' | 'delete' | null>(null);
 
   const [loadingStates, setLoadingStates] = useState({
     clearLocalStorage: false,
@@ -64,6 +72,26 @@ export const DevSection = () => {
     }
   }, []);
 
+  const toggleCashStagingPlatform = useCallback(() => {
+    setCashStagingPlatform(!useCashPlatformSettingStore.getState().useStagingPlatform);
+    Navigation.handleAction(Routes.WALLET_SCREEN);
+    setTimeout(Restart.Restart, 1000);
+  }, []);
+
+  const runCashAccountAction = useCallback(async (kind: 'signOut' | 'delete') => {
+    setPendingCashAccountAction(kind);
+    try {
+      await (kind === 'signOut' ? signOutOfCash() : deleteCashAccount());
+    } catch (error) {
+      if (!isHandledCashError(error)) {
+        logger.error(new RainbowError(`[DevSection] cash ${kind} failed`, error));
+        Alert.alert(i18n.t(i18n.l.developer_settings.cash_account_action_failed));
+      }
+    } finally {
+      setPendingCashAccountAction(null);
+    }
+  }, []);
+
   const connectToAnvil = useCallback(async () => {
     try {
       const connectToAnvil = useConnectedToAnvilStore.getState().connectedToAnvil;
@@ -474,19 +502,31 @@ export const DevSection = () => {
           </Menu>
           <Menu header={i18n.t(i18n.l.developer_settings.headers.cash_settings)}>
             <MenuItem
-              onPress={async () => {
-                const userId = (await Clipboard.getString()).trim();
-                if (userId) useCashAccountStore.getState().setUserId(userId);
-              }}
-              rightComponent={cashUserId != null && <MenuItem.StatusIcon status="selected" />}
-              size={52}
-              titleComponent={<MenuItem.Title text={i18n.t(i18n.l.developer_settings.cash_set_user_id_from_clipboard)} />}
-            />
-            <MenuItem
-              onPress={() => useCashAccountStore.getState().clearUserId()}
+              onPress={toggleCashStagingPlatform}
+              rightComponent={cashUsesStagingPlatform && <MenuItem.StatusIcon status="selected" />}
               size={52}
-              titleComponent={<MenuItem.Title text={i18n.t(i18n.l.developer_settings.cash_clear_account)} />}
+              titleComponent={<MenuItem.Title text={i18n.t(i18n.l.developer_settings.cash_use_staging_platform)} />}
             />
+            {cashUserId != null && (
+              <MenuItem
+                disabled={pendingCashAccountAction != null}
+                onPress={() => runCashAccountAction('signOut')}
+                rightComponent={pendingCashAccountAction === 'signOut' && <SettingsLoadingIndicator />}
+                size={52}
+                titleComponent={<MenuItem.Title text={i18n.t(i18n.l.developer_settings.cash_sign_out)} />}
+              />
+            )}
+            {cashUserId != null && USES_STAGING_PLATFORM && (
+              <MenuItem
+                disabled={pendingCashAccountAction != null}
+                onPress={() => runCashAccountAction('delete')}
+                rightComponent={pendi
```

**File**: `src/languages/en_US.json` (modified, +4/-2)
```diff
@@ -490,8 +490,10 @@
       },
       "restart_app": "Restart App",
       "reset_experimental_config": "Reset Experimental Config",
-      "cash_set_user_id_from_clipboard": "Set cash user id from clipboard",
-      "cash_clear_account": "Clear cash account",
+      "cash_use_staging_platform": "Use cash staging backend",
+      "cash_sign_out": "Sign out of cash",
+      "cash_sign_out_and_delete_account": "Sign out and delete cash account",
+      "cash_account_action_failed": "Cash account action failed",
       "status": "Status",
       "sync_codepush": "Sync CodePush",
       "simulate_device_transfer": "Simulate Device Transfer",
```

#### Recent Merged Pull Requests:
- **PR #7891** (closed): fix(sports): coordinate scrolling and pager gestures (@christianbaroni)
- **PR #7888** (2026-10-20): feat(spot-pnl): realized P&L on the pill once every purchased token is sold (@i1skn)
- **PR #7884** (2026-10-23): feat(cash): toggle the staging backend from Developer Settings (@i1skn)
- **PR #7883** (2026-10-15): chore(ci): add cubic review instructions (@i1skn)
- **PR #7882** (2026-10-15): feat(expanded sheet): remove Quick Buy section (@i1skn)
- **PR #7880** (2026-10-15): fix(e2e): use default remote config in E2E (@i1skn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
