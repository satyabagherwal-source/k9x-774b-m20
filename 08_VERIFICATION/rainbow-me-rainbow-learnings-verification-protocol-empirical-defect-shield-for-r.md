# Verification Protocol: Verification Protocol: Empirical Defect Shield for rainbow-me-rainbow-learnings

<!-- PROVENANCE_START
{
  "source_repository": "rainbow-me-rainbow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:43:42.309Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-rainbow-me-rainbow-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rainbow-me-rainbow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:43:42.309Z`  
> **Learning ID**: `LEARN-REEXTRACT-rainbow-me-rainbow-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `rainbow-me-rainbow-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rainbow-me-rainbow-learnings.md`  
> **Source**: github ([https://github.com/rainbow-me/rainbow](https://github.com/rainbow-me/rainbow))  
> **Source Version**: `898ea993`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T14:23:44.334Z  
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
> **Harvest Timestamp**: 2026-11-12T14:23:44.325Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rainbow-me/rainbow`
- **Description**: 🌈‒ the Ethereum wallet that lives in your pocket 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4401 stars

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
- **Issue #7940** (2026-11-11): **fix(assets): handle user assets without a networks map**
  *Symptoms*: Fixes https://linear.app/rainbow/issue/APP-4188/typeerror-cannot-convert-undefined-value-to-object  ## Description  The platform assets API (`GetAssetUpdates`) omits empty map fields from its JSON. You can see this in `bridging.networks`, which is missing from most assets in a real response. When an asset has no `networks` entries, the field is missing too, and building the user asset list crashed with `Cannot convert undefined value to object` at `asset.networks[ChainId.mainnet]`.  The crash happens inside `setUserAssets`, so it throws away the whole asset update. Sentry shows about 1.8k affected users and about 370k events. Most come from the post-transaction balance poll, which keeps retrying and failing.  `Asset.networks` is now optional, which matches what the API sends. The transform restores the omitted field as an empty map. Downstream `ParsedSearchAsset` consumers still always get a `networks` object, and `mainnetAddress` stays undefined for these assets, as it already was for any asset without a mainnet entry.  ## What to test  - Make a send or swap and check that the wallet balances update once it confirms. 

- **Issue #7939** (2026-11-11): **chore(ios): commit Info.plists in the format pod install writes**
  *Symptoms*: ## What  Commits the three iOS `Info.plist` files exactly as `pod install` writes them, so running `pod install` no longer leaves them modified.  ## Why  React Native's post-install hook, `set_RCTNewArchEnabled_in_info_plist` (`react-native/scripts/cocoapods/new_architecture.rb`), is meant to skip plists that already have the right `RCTNewArchEnabled` value. Its check is `info_plist["RCTNewArchEnabled"] and info_plist["RCTNewArchEnabled"] == new_arch_enabled`. With the new architecture off, the value is `false`, so the check always fails and every `Info.plist` under `ios/` is rewritten on every install. The rewrite sorts dictionary keys, indents with tabs, and adds the key where it is missing.  Our committed files were not in that format:  - `ShareWithRainbow` and `OpenInRainbow` used 2-space indentation and had no `RCTNewArchEnabled` key. The key is set to `false` here; the extensions don't run React Native, so it has no effect. - `Rainbow/Info.plist` had alternate app icons (baggy, chonks, mog, rnbw) and the AppsFlyer SKAdNetwork keys out of alphabetical order. They are only reordered; no value changes.  The rewrite is idempotent: running it again on these files produces identical bytes.
  **Post-Mortem & Fix Analysis**:
  > @cubic-dev-ai review
  > > @cubic-dev-ai review  @i1skn I have started the AI code review. It will take a few minutes to complete.

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

### Incident Patch 1: `3d5c29d4` (2026-11-11)
**Commit Message**: fix(navigation): support native iOS interruptible sheet navigation and polish scroll tracking (#7920)

## What changed (plus any additional context for devs)

- Allows iOS sheets to open or reopen during dismissal, removing the JS
dismissal queue. Native presentation acknowledgement replaces the 200 ms
guard against repeated navigation.
- Updates PanModal and keeps outgoing screens mounted in
`react-native-cool-modals` until dismissal completes. Route keys and
presentation requests prevent stale callbacks from popping a reopened
sheet; removing a route no longer recreates the sheet above it.
- Updates sheet callers and content that relied on serialized
transitions or a fresh mount:
- Replaces delayed dismiss-then-open sequences with `replace` or
immediate navigation
- Refreshes token candles, Polymarket charts, and NFT media when the
asset or event changes within a mounted screen
- Uses the added `useRouteCleanup` in Add Cash and Cash setup so an
outgoing instance cannot reset the reopened sheet’s shared state.
Cleanup runs on unmount only when no other instance of the same route
remains.
- Derives QR scanner activity from focus and app state, removing the
`beforeRemove` veto that 

**File**: `ios/Podfile` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ target 'Rainbow' do
   pod 'Permission-Camera', :path => "#{permissions_path}/Camera"
   pod 'Permission-FaceID', :path => "#{permissions_path}/FaceID"
   pod 'Permission-Notifications', :path => "#{permissions_path}/Notifications"
-  pod "PanModal", :git => 'https://github.com/rainbow-me/PanModal', :commit => 'ab97d74279ba28c2891b47a5dc767ed4dd7cf994'
+  pod "PanModal", :git => 'https://github.com/rainbow-me/PanModal', :commit => 'ee4b8b65cbcfbee1448b6eb3330ed07e92d8c9a3'
   pod 'Shimmer'
   pod 'SRSRadialGradient', :path => '../node_modules/react-native-radial-gradient/ios'
   pod 'react-native-palette-full', :path => '../node_modules/react-native-palette-full'
```

**File**: `ios/Podfile.lock` (modified, +5/-5)
```diff
@@ -4966,7 +4966,7 @@ DEPENDENCIES:
   - nanopb
   - NitroMmkv (from `../node_modules/react-native-mmkv`)
   - NitroModules (from `../node_modules/react-native-nitro-modules`)
-  - PanModal (from `https://github.com/rainbow-me/PanModal`, commit `ab97d74279ba28c2891b47a5dc767ed4dd7cf994`)
+  - PanModal (from `https://github.com/rainbow-me/PanModal`, commit `ee4b8b65cbcfbee1448b6eb3330ed07e92d8c9a3`)
   - Permission-Camera (from `../node_modules/react-native-permissions/ios/Camera`)
   - Permission-FaceID (from `../node_modules/react-native-permissions/ios/FaceID`)
   - Permission-Notifications (from `../node_modules/react-native-permissions/ios/Notifications`)
@@ -5204,7 +5204,7 @@ EXTERNAL SOURCES:
   NitroModules:
     :path: "../node_modules/react-native-nitro-modules"
   PanModal:
-    :commit: ab97d74279ba28c2891b47a5dc767ed4dd7cf994
+    :commit: ee4b8b65cbcfbee1448b6eb3330ed07e92d8c9a3
     :git: https://github.com/rainbow-me/PanModal
   Permission-Camera:
     :path: "../node_modules/react-native-permissions/ios/Camera"
@@ -5479,7 +5479,7 @@ EXTERNAL SOURCES:
 
 CHECKOUT OPTIONS:
   PanModal:
-    :commit: ab97d74279ba28c2891b47a5dc767ed4dd7cf994
+    :commit: ee4b8b65cbcfbee1448b6eb3330ed07e92d8c9a3
     :git: https://github.com/rainbow-me/PanModal
 
 SPEC CHECKSUMS:
@@ -5540,7 +5540,7 @@ SPEC CHECKSUMS:
   nanopb: fad817b59e0457d11a5dfbde799381cd727c1275
   NitroMmkv: 88922f1b56c9e785c87ec57aeec8149999e5fcea
   NitroModules: 7cc0b0ac6a04460182d6fe0bf859381a06862087
-  PanModal: 421fe72d4af5b7e9016aaa3b4db94a2fb71756d3
+  PanModal: 01aab752499421df00faea07230bcc60ea43ae86
   Permission-Camera: cf14fb2d76432ee0f36546249ee608ef6037a23e
   Permission-FaceID: 57f30c981224753654df9350828dfbfc75dc5e83
   Permission-Notifications: e254bc5abf9c33a6ac6b9f68f4c406d5bf7ab46e
@@ -5685,6 +5685,6 @@ SPEC CHECKSUMS:
   VisionCamera: b51af005669c6642dd1b4fca434eda4c1778de87
   Yoga: 3196a843cc5f4bc433f1a41cf17cdf804a01a529
 
-PODFILE CHECKSUM: 3f08f6fceded05dc4f4dda9eb79d6f9bb063e13b
+PODFILE CHECKSUM: c8780568071f082da2f22eba56979d217e50cbfd
 
 COCOAPODS: 1.16.2
```

**File**: `patches/@react-navigation+routers+6.1.9.patch` (removed, +0/-38)
```diff
@@ -1,38 +0,0 @@
-diff --git a/node_modules/@react-navigation/routers/src/StackRouter.tsx b/node_modules/@react-navigation/routers/src/StackRouter.tsx
-index eaa43a0..7efff5e 100644
---- a/node_modules/@react-navigation/routers/src/StackRouter.tsx
-+++ b/node_modules/@react-navigation/routers/src/StackRouter.tsx
-@@ -483,6 +483,33 @@ export default function StackRouter(options: StackRouterOptions) {
- 
-           return null;
- 
-+        // @ts-ignore
-+        case '@RAINBOW/REMOVE_NEXT_TO_LAST': {
-+          if (state.routes.length < 3) {
-+            return state;
-+          }
-+
-+          return {
-+            ...state,
-+            index: state.index - 1,
-+            routes: [
-+              ...state.routes.slice(0, -2),
-+              state.routes[state.routes.length - 1],
-+            ],
-+          };
-+        }
-+
-+        // @ts-ignore
-+        case '@RAINBOW/REMOVE_FIRST': {
-+          return {
-+            ...state,
-+            index: state.index - 1,
-+            routes: [
-+              ...state.routes.slice(1),
-+            ],
-+          };
-+        }
-+
-         default:
-           return BaseRouter.getStateForAction(state, action);
-       }
```

**File**: `patches/react-native-gesture-handler+2.31.1+002+native-scroll-simultaneity.patch` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+# PATCH CONTEXT
+# On iOS, RNGH can block a native gesture that is allowed to recognize alongside
+# a scroll view's pan. RNGH attaches a RNDummyGestureRecognizer to React Native's
+# scroll wrapper and copies the underlying UIScrollView pan's state. UIKit treats
+# the dummy as a separate recognizer. RNGH permits the dummy and its own pan to
+# recognize together, but does not preserve the pan's compatibility with other
+# native recognizers. The dummy can therefore prevent an otherwise compatible
+# gesture if it activates first.
+#
+# Extend the existing scroll compatibility check to honor permission from either
+# native delegate for the scroll pan and a recognizer outside RNGH to recognize
+# together. This keeps the dummy consistent with the pan it represents while
+# preserving explicit RNGH relationships. Exclude macOS, where the dummy begins
+# on mouse-down instead of mirroring the scroll pan.
+#
+# Remove when RNGH's scroll proxy honors simultaneous recognition granted
+# to the underlying native scroll pan.
+diff --git a/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm b/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm
+--- a/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm
++++ b/node_modules/react-native-gesture-handler/apple/RNGestureHandler.mm
+@@ -594,13 +594,36 @@
+ - (BOOL)areScrollViewRecognizersCompatible:(UIGestureRecognizer *)gestureRecognizer
+                            otherRecognizer:(UIGestureRecognizer *)otherGestureRecognizer
+ {
+-  if ([self isUIScrollViewPanGestureRecognizer:otherGestureRecognizer] &&
+-      [gestureRecognizer isKindOfClass:[RNDummyGestureRecognizer class]]) {
+-    RNGHUIScrollView *scrollView = [self retrieveScrollView:gestureRecognizer.view];
+-    if (scrollView && scrollView == otherGestureRecognizer.view) {
++  if (![gestureRecognizer isKindOfClass:[RNDummyGestureRecognizer class]]) {
++    return NO;
++  }
++
++  RNGHUIScrollView *scrollView = [self retrieveScrollView:gestureRecognizer.view];
++  if (scrollView == nil) {
++    return NO;
++  }
++
++  if ([self isUIScrollViewPanGestureRecognizer:otherGestureRecognizer] && scrollView == otherGestureRecognizer.view) {
++    return YES;
++  }
++
++#if !TARGET_OS_OSX
++  // Preserve explicit RNGH relationships. For external recognizers, the native
++  // scroll proxy must honor simultaneity granted to the pan it represents.
++  if ([RNGestureHandler findGestureHandlerByRecognizer:otherGestureRecognizer] == nil) {
++    UIPanGestureRecognizer *pan = scrollView.panGestureRecognizer;
++    SEL simultaneous = @selector(gestureRecognizer:shouldRecognizeSimultaneouslyWithGestureRecognizer:);
++    if ([pan.delegate respondsToSelector:simultaneous] &&
++        [pan.delegate gestureRecognizer:pan shouldRecognizeSimultaneouslyWithGestureRecognizer:otherGestureRecognizer]) {
+       return YES;
+     }
+-  }
++    if ([otherGestureRecognizer.delegate respondsToSelector:simultaneous] &&
++        [otherGestureRecognizer.delegate gestureRecognizer:otherGestureRecognizer
++            shouldRecognizeSimultaneouslyWithGestureRecognizer:pan]) {
++      return YES;
++    }
++  }
++#endif
+ 
+   return NO;
+ }
```

**File**: `src/__swaps__/screens/Swap/Swap.tsx` (modified, +26/-25)
```diff
@@ -1,4 +1,4 @@
-import React, { useCallback, useEffect, useRef, useState } from 'react';
+import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
 import { Platform, StyleSheet } from 'react-native';
 
 import Animated from 'react-native-reanimated';
@@ -17,7 +17,6 @@ import { parseAssetAndExtend } from '@/__swaps__/utils/swaps';
 import { AbsolutePortalRoot } from '@/components/AbsolutePortal';
 import { Page } from '@/components/layout';
 import { navbarHeight } from '@/components/navbar/Navbar';
-import { DecoyScrollView } from '@/components/sheet/DecoyScrollView';
 import { Box } from '@/design-system';
 import { clearCustomGasSettings } from '@/features/gas/hooks/useCustomGas';
 import { ChainId } from '@/features/network/types/backendNetworks';
@@ -28,8 +27,8 @@ import { useSponsoredSwapStore } from '@/state/swaps/sponsoredSwapStore';
 import { useSwapsStore } from '@/state/swaps/swapsStore';
 import safeAreaInsetValues from '@/utils/safeAreaInsetValues';
 
-import { NavigateToSwapSettingsTrigger } from './components/NavigateToSwapSettingsTrigger';
 import { ReviewButton } from './components/ReviewButton';
+import { SwapRouteParamsObserver } from './components/SwapRouteParamsObserver';
 import { SwapWarning } from './components/SwapWarning';
 import { SwapProvider, useSwapContext } from './providers/swap-provider';
 import { SyncSwapStateAndSharedValues } from './providers/SyncSwapStateAndSharedValues';
@@ -72,29 +71,31 @@ import { useSwapsSearchStore } from './resources/search/searchV2';
  * tldr, ⚡️ it's fast ⚡️
  */
 
-export function SwapScreen() {
-  useCleanupOnUnmount();
-  return (
-    <SwapProvider>
-      <Box as={Page} style={styles.rootViewBackground} testID="swap-screen" width="full">
-        <SwapBackground />
-        <Box alignItems="center" height="full" paddingTop={{ custom: safeAreaInsetValues.top + (navbarHeight - 12) + 29 }} width="full">
-          <SwapInputAsset />
-          <FlipButton />
-          <SwapOutputAsset />
-          <SliderAndKeyboardAndBottomControls />
-          <ExchangeRateBubbleAndWarning />
+export const SwapScreen = memo(
+  function SwapScreen() {
+    useCleanupOnUnmount();
+    return (
+      <SwapProvider>
+        <Box as={Page} style={styles.rootViewBackground} testID="swap-screen" width="full">
+          <SwapBackground />
+          <Box alignItems="center" height="full" paddingTop={{ custom: safeAreaInsetValues.top + (navbarHeight - 12) + 29 }} width="full">
+            <SwapInputAsset />
+            <FlipButton />
+            <SwapOutputAsset />
+            <SliderAndKeyboardAndBottomControls />
+            <ExchangeRateBubbleAndWarning />
+          </Box>
+          <SwapNavbar />
         </Box>
-        <SwapNavbar />
-      </Box>
-      <DecoyScrollView />
-      <AbsolutePortalRoot />
-      <NavigateToSwapSettingsTrigger />
-      <WalletAddressObserver />
-      <SyncSwapStateAndSharedValues />
-    </SwapProvider>
-  );
-}
+        <AbsolutePortalRoot />
+        <SwapRouteParamsObserver />
+        <WalletAddressObserver />
+        <SyncSwapStateAndSharedValues />
+      </SwapProvider>
+    );
+  },
+  () => true
+);
 
 const useCleanupOnUnmount = () => {
   useEffect(() => {
```

**File**: `src/__swaps__/screens/Swap/components/NavigateToSwapSettingsTrigger.tsx` (removed, +0/-32)
```diff
@@ -1,32 +0,0 @@
-import { useRoute, type RouteProp } from '@react-navigation/native';
-import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
-
-import { useNavigation } from '@/navigation/Navigation';
-import type Routes from '@/navigation/routesNames';
-import { type RootStackParamList } from '@/navigation/types';
-
-import { useSwapContext } from '../providers/swap-provider';
-
-export const NavigateToSwapSettingsTrigger = () => {
-  const route = useRoute<RouteProp<RootStackParamList, typeof Routes.SWAP>>();
-  const { setParams } = useNavigation<typeof Routes.SWAP>();
-  const { SwapNavigation } = useSwapContext();
-
-  useAnimatedReaction(
-    () => route.params,
-    (current, previous) => {
-      if (!current || current === previous) return;
-
-      if (current.action === 'open_swap_settings') {
-        SwapNavigation.handleShowSettings();
-        runOnJS(setParams)({
-          ...route.params,
-          action: undefined,
-        });
-      }
-    },
-    [route.params?.action, setParams]
-  );
-
-  return null;
-};
```

**File**: `src/__swaps__/screens/Swap/components/SwapRouteParamsObserver.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
+
+import { SwapAssetType } from '@/__swaps__/types/swap';
+import { useOnChange } from '@/hooks/useOnChange';
+import { useNavigation } from '@/navigation/Navigation';
+import { useRoute } from '@/navigation/RouteContext';
+import type Routes from '@/navigation/routesNames';
+
+import { useSwapContext } from '../providers/swap-provider';
+
+export const SwapRouteParamsObserver = () => {
+  const route = useRoute<typeof Routes.SWAP>();
+  const { setParams } = useNavigation<typeof Routes.SWAP>();
+  const { setAsset, SwapNavigation } = useSwapContext();
+
+  useOnChange(() => {
+    setAsset(
+      { asset: route.params.inputAsset, percentageToSell: route.params.percentageToSell, type: SwapAssetType.inputAsset },
+      route.params.outputAsset
+    );
+  }, [route.params.inputAsset, route.params.outputAsset, route.params.percentageToSell]);
+
+  useAnimatedReaction(
+    () => route.params,
+    (current, previous) => {
+      if (!current || current === previous) return;
+
+      if (current.action === 'open_swap_settings') {
+        SwapNavigation.handleShowSettings();
+        runOnJS(setParams)({ ...route.params, action: undefined });
+      }
+    },
+    [route.params?.action, setParams]
+  );
+
+  return null;
+};
```

**File**: `src/__swaps__/screens/Swap/navigateToSwaps.ts` (modified, +16/-8)
```diff
@@ -40,6 +40,12 @@ export function navigateToSwaps(params: NavigateToSwapsParams = {}): void {
   const chainId = params.inputAsset?.chainId || params.outputAsset?.chainId || store.getState().settings.chainId;
   if (params.gasSpeed && chainId) setSelectedGasSpeed(chainId, params.gasSpeed);
 
+  const isAlreadyOpen = Navigation.getActiveRouteName() === Routes.SWAP;
+  if (isAlreadyOpen && params.inputAsset === undefined && params.outputAsset === undefined) {
+    Navigation.handleAction(Routes.SWAP, getSwapsNavigationParams());
+    return;
+  }
+
   const inputAsset = getInputAsset(params.inputAsset);
   const outputAsset = getOutputAsset(params.outputAsset);
   const inputMethod = getInputMethod({ ...params, inputAsset, outputAsset });
@@ -52,14 +58,16 @@ export function navigateToSwaps(params: NavigateToSwapsParams = {}): void {
       ? slippageInBipsToString(+params.slippage)
       : getDefaultSlippage(inputChainId, getRemoteConfig().default_slippage_bips_chainId);
 
-  useSwapsStore.setState(state => ({
-    inputAsset,
-    isSwapsOpen: true,
-    outputAsset,
-    percentageToSell: inputAmounts.percentageToSell,
-    selectedOutputChainId: inputAsset?.chainId ?? state.preferredNetwork ?? state.selectedOutputChainId ?? ChainId.mainnet,
-    slippage,
-  }));
+  if (!isAlreadyOpen) {
+    useSwapsStore.setState(state => ({
+      inputAsset,
+      isSwapsOpen: true,
+      outputAsset,
+      percentageToSell: inputAmounts.percentageToSell,
+      selectedOutputChainId: inputAsset?.chainId ?? state.preferredNetwork ?? state.selectedOutputChainId ?? ChainId.mainnet,
+      slippage,
+    }));
+  }
 
   Navigation.handleAction(Routes.SWAP, {
     ...inputAmounts,
```

---

### Incident Patch 2: `eb3b3e86` (2026-11-11)
**Commit Message**: fix(assets): handle user assets without a networks map (#7940)

Fixes
https://linear.app/rainbow/issue/APP-4188/typeerror-cannot-convert-undefined-value-to-object

## Description

The platform assets API (`GetAssetUpdates`) omits empty map fields from
its JSON. You can see this in `bridging.networks`, which is missing from
most assets in a real response. When an asset has no `networks` entries,
the field is missing too, and building the user asset list crashed with
`Cannot convert undefined value to object` at
`asset.networks[ChainId.mainnet]`.

The crash happens inside `setUserAssets`, so it throws away the whole
asset update. Sentry shows about 1.8k affected users and about 370k
events. Most come from the post-transaction balance poll, which keeps
retrying and failing.

`Asset.networks` is now optional, which matches what the API sends. The
transform restores the omitted field as an empty map. Downstream
`ParsedSearchAsset` consumers still always get a `networks` object, and
`mainnetAddress` stays undefined for these assets, as it already was for
any asset without a mainnet entry.

## What to test

- Make a send or swap and check that the wallet balances update once it
confirms.

**File**: `src/state/assets/types.ts` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ export type Asset = {
     changedAt: number;
     relativeChange24h: number;
   };
-  networks: Record<
+  networks?: Record<
     string,
     {
       address: string;
```

**File**: `src/state/assets/utils.test.ts` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import { describe, expect, it } from 'vitest';
+
+import { ChainId } from '@/features/network/types/backendNetworks';
+
+import { type UserAsset, type UserAssetsState } from './types';
+import { setUserAssets } from './utils';
+
+const ADDRESS = '0x0000000000000000000000000000000000000001';
+
+describe('setUserAssets', () => {
+  it('accepts an asset whose networks map the API omitted', () => {
+    const userAsset = {
+      asset: {
+        address: '0x00000000000000000000000000000000000000aa',
+        chainId: ChainId.base,
+        name: 'Token',
+        symbol: 'TKN',
+        decimals: 18,
+        type: 'erc20',
+        network: 'base',
+        verified: false,
+        transferable: true,
+        colors: { primary: '#000000' },
+        price: { value: 1, changedAt: 0, relativeChange24h: 0 },
+        bridging: { bridgeable: false, networks: {} },
+      },
+      quantity: '1000000000000000000',
+      value: '1',
+      smallBalance: false,
+      updatedAt: '0',
+    } as UserAsset;
+    const state = { address: ADDRESS, userAssets: new Map(), hiddenAssets: new Set() } as unknown as UserAssetsState;
+
+    const next = setUserAssets({ address: ADDRESS, state, userAssets: [userAsset], positionTokenAddresses: new Set() });
+
+    const parsed = [...next.userAssets.values()][0];
+    expect(parsed.networks).toEqual({});
+    expect(parsed.mainnetAddress).toBeUndefined();
+  });
+});
```

**File**: `src/state/assets/utils.ts` (modified, +4/-2)
```diff
@@ -246,6 +246,8 @@ function transformUserAssetToParsedSearchAsset(userAsset: UserAsset): ParsedSear
   const { asset } = userAsset;
   const uniqueId = getUniqueId(asset.address, asset.chainId);
   const { decimals, symbol, price } = asset;
+  // The API omits empty maps from its JSON.
+  const networks = (asset.networks ?? {}) as Record<ChainId, { address: Address; decimals: number }>;
   const amount = convertRawAmountToDecimalFormat(userAsset.quantity, decimals);
   const nativeBalance = convertAmountAndPriceToNativeDisplay(1, userAsset.value, currency);
 
@@ -259,9 +261,9 @@ function transformUserAssetToParsedSearchAsset(userAsset: UserAsset): ParsedSear
     icon_url: asset.iconUrl,
     isNativeAsset: isNativeAsset(asset.address, asset.chainId),
     isVerified: asset.verified,
-    mainnetAddress: asset.networks[ChainId.mainnet]?.address as AddressOrEth,
+    mainnetAddress: networks[ChainId.mainnet]?.address as AddressOrEth,
     name: asset.name,
-    networks: asset.networks as Record<ChainId, { address: Address; decimals: number }>,
+    networks,
     symbol: asset.symbol,
     price: {
       changed_at: asset.price.changedAt,
```

---

### Incident Patch 3: `c09af00b` (2026-11-11)
**Commit Message**: refactor(ios): use UIKit child containment for sheet screens (#7921)

## What changed (plus any additional context for devs)

- Makes sheet screens UIKit children of `PanModalViewController`, giving
UIKit the parent relationship needed to propagate appearance callbacks
and layout. Removes the borrowed root view, `_parentVC` backreference,
and presentation accessor overrides.
- Keeps the child attached across canceled dismissals. A completed
dismissal detaches it before notifying the stack, which can immediately
re-present the same screen.
- Removes the zero-length `bottomLayoutGuide` fallback. Connected Dapps
and Select ENS can now inherit the presenting sheet’s bottom inset.
- Adds UIKit coverage for dismissal cancellation, immediate reuse, and
React invalidation while a sheet is presented

## Screen recordings / screenshots

## What to test

**File**: `src/react-native-cool-modals/ios/README.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# Native sheet ownership
+
+`RNCMScreen` owns the React screen view. `PanModalViewController` contains that
+controller for one modal presentation, with a separate transparent root view.
+PanModal animates its outer `PanContainerView`.
+
+The container sizes the screen to its bounds. React cannot write that screen's
+frame while it has a native container; `RNCMScreen.viewDidLayoutSubviews` sends
+actual size changes to Yoga so React can lay out the screen's content. Moving
+the outer sheet does not require republishing an unchanged content size.
+
+The wrapper owns modal appearance and dismissal notifications. Covering it,
+hiding it beneath a surviving sheet, and canceling dismissal retain its child.
+Terminal disappearance detaches the child before notifying the screen stack,
+which can immediately present that same screen again. React invalidation and
+UIKit presentation lifetime are separate: invalidating the React view releases
+its controller reference, while containment retains the child until teardown.
+
+Context menus use the screen's `PanModalViewController` parent as their
+presentation host.
+
+## Bottom insets
+
+PanModal sets the tracked scroll view's bottom content inset to zero when
+`ignoreBottomOffset` is true. Otherwise it uses the presenting controller's
+bottom layout guide.
+
+The shared sheet configuration sets `ignoreBottomOffset: true`. These route-specific
+configurations in [Routes.ios.tsx](../../navigation/Routes.ios.tsx) use the default
+value of `false`:
+
+| Route | Content | Follow-up |
+| --- | --- | --- |
+| `CONNECTED_DAPPS` | `ScrollableItems` scroll view in `ConnectedDappsSheet` | Check the last row and bottom spacing when opened over another sheet; choose the inset policy explicitly if the content already supplies the required spacing. |
+| `SELECT_ENS_SHEET` | FlatList with 50 points of bottom content padding | Check interaction between native inset, existing padding, and the surrounding bottom bleed when stacked. |
+| `SPEED_UP_AND_CANCEL_SHEET` | Outer `SlackSheet` has scrolling disabled | No tracked outer-scroll inset is expected; review the configuration if scrollable interior content is added or enabled. |
+
+## Focused validation
+
+[The native adapter suite](../../../tools/cool-modals-native-tests) compiles the
+production adapter against UIKit without building Rainbow. Its React boundary
+spies check calls into the bridge; they do not exercise Yoga, the real React
+touch handler, or the production screen-stack reconciler. Full app interaction
+and physical high-refresh presentation remain separate acceptance surfaces.
```

**File**: `src/react-native-cool-modals/ios/RNCMScreen.h` (modified, +7/-7)
```diff
@@ -3,6 +3,8 @@
 #import <React/RCTComponent.h>
 
 @class RNCMScreenStackView;
+@class RNCMScreenView;
+@class PanModalViewController;
 
 typedef NS_ENUM(NSInteger, RNSScreenStackPresentation) {
   RNSScreenStackPresentationPush,
@@ -31,8 +33,9 @@ typedef NS_ENUM(NSInteger, RNSScreenStackAnimation) {
 @interface RNCMScreen : UIViewController
 
 @property (nonatomic, strong) id<UIViewControllerTransitioningDelegate> transDelegate;
-- (instancetype)initWithView:(UIView *)view;
-- (UIViewController*) parentVC;
+@property (nonatomic, readonly, nonnull) RNCMScreenView *screenView;
+@property (nonatomic, readonly, nullable) PanModalViewController *panModalController;
+- (instancetype)initWithView:(RNCMScreenView * _Nonnull)view;
 
 @end
 
@@ -47,7 +50,7 @@ typedef NS_ENUM(NSInteger, RNSScreenStackAnimation) {
 @property (nonatomic, copy) RCTDirectEventBlock onWillDismiss;
 @property (nonatomic, copy) RCTDirectEventBlock onTouchTop;
 @property (weak, nonatomic) UIView *reactSuperview;
-@property (nonatomic, retain) UIViewController *controller;
+@property (nonatomic, readonly, strong, nullable) RNCMScreen *controller;
 @property (nonatomic, readonly) BOOL dismissed;
 @property (nonatomic) NSInteger presentationRequest;
 @property (nonatomic) BOOL inStack;
@@ -81,10 +84,7 @@ typedef NS_ENUM(NSInteger, RNSScreenStackAnimation) {
 - (void)willDismiss;
 - (void)notifyDismissed;
 - (void)notifyAppear;
+- (void)notifyTouchTop:(BOOL)dismissing;
 - (void)applyConfiguration;
 - (void)cancelTouchesWithCompletion:(void (^)(void))completion;
 @end
-
-@interface UIView (RNSScreen)
-- (UIViewController *)parentViewController;
-@end
```

**File**: `src/react-native-cool-modals/ios/RNCMScreen.m` (modified, +21/-35)
```diff
@@ -107,7 +107,7 @@ - (void)didSetProps:(NSArray<NSString *> *)changedProps {
 }
 
 - (void)applyConfiguration {
-  PanModalViewController *presenter = (PanModalViewController *)[_controller parentVC];
+  PanModalViewController *presenter = _controller.panModalController;
   BOOL restore = _presentationChanged && _inStack;
   if (_presentationChanged) {
     _dismissed = NO;
@@ -127,30 +127,27 @@ - (void)applyConfiguration {
       }];
     }
   } else if (_inStack && !_skipsOnReturn && !presenter.dismissing && !presenter.hiding) {
-    if (_layoutChanged) [presenter panModalSetNeedsLayoutUpdateWrapper];
+    if (_layoutChanged) [presenter setNeedsPanModalLayoutUpdate];
   }
   _presentationChanged = NO;
   _layoutChanged = NO;
 }
 
-- (void)onTouchTopWrapper:(NSNumber*)dismissing {
+- (void)notifyTouchTop:(BOOL)dismissing {
   if (_onTouchTop) {
-    _onTouchTop(@{ @"dismissing": dismissing });
+    _onTouchTop(@{ @"dismissing": @(dismissing) });
   }
 }
 
 - (void)reactSetFrame:(CGRect)frame
 {
-  if (![self.reactViewController.parentViewController
-        isKindOfClass:[UINavigationController class]]) {
+  UIViewController *parent = _controller.parentViewController;
+  if (![parent isKindOfClass:[UINavigationController class]] &&
+      ![parent isKindOfClass:[PanModalViewController class]]) {
     [super reactSetFrame:frame];
   }
-  // when screen is mounted under UINavigationController it's size is controller
-  // by the navigation controller itself. That is, it is set to fill space of
-  // the controller. In that case we ignore react layout system from managing
-  // the screen dimentions and we wait for the screen VC to update and then we
-  // pass the dimentions to ui view manager to take into account when laying out
-  // subviews
+  // Native containers own the screen frame. The screen controller publishes
+  // its resulting bounds to Yoga so React can lay out the content inside it.
 }
 
 - (UIViewController *)reactViewController
@@ -438,10 +435,9 @@ - (void)reset
 
 @implementation RNCMScreen {
   CGSize _lastViewSize;
-  UIViewController *_parentVC;
 }
 
-- (instancetype)initWithView:(UIView *)view
+- (instancetype)initWithView:(RNCMScreenView *)view
 {
   if (self = [super init]) {
     self.view = view;
@@ -454,10 +450,6 @@ - (instancetype)initWithView:(UIView *)view
   return self;
 }
 
-- (void)presentModally:(UIViewController *)viewControllerToPresent animated:(BOOL)flag completion:(void (^)(void))completion  slackStack:(BOOL)slackStack {
-  return [_parentVC presentModally:viewControllerToPresent animated:flag completion:completion slackStack:slackStack];
-}
-
 - (void)dismissViewControllerAnimated:(BOOL)flag completion:(void (^)(void))completion {
   if (self.parentViewController) {
     [self.parentViewController dismissViewControllerAnimated:flag completion:completion];
@@ -466,29 +458,23 @@ - (void)dismissViewControllerAnimated:(BOOL)flag completion:(void (^)(void))comp
   }
 }
 
-- (UIViewController *)presentedViewController {
-  return [_parentVC presentedViewController];
-}
-
-- (UIViewController *)presentingViewController {
-  return [_parentVC presentingViewController];
-}
-
 - (void)viewDidLayoutSubviews
 {
   [super viewDidLayoutSubviews];
   
   if (!CGSizeEqualToSize(_lastViewSize, self.view.bounds.size)) {
     _lastViewSize = self.view.bounds.size;
-    [((RNCMScreenView *)self.viewIfLoaded) updateBounds];
+    [self.screenView updateBounds];
   }
 }
 
 - (void)presentViewController:(UIViewController *)viewControllerToPresent animated:(BOOL)flag completion:(void (^)(void))completion {
   BOOL isContextMenu = [viewControllerToPresent isKindOfClass:NSClassFromString(@"_UIContextMenuActionsOnlyViewController")];
   
-  if (isContextMenu) {
-    [_parentVC presentViewController:viewControllerToPresent animated:flag completion:completion];
+  // Route iOS 18 context menus through the sheet's presentation host.
+  PanModalViewController *presenter = self.panModalController;
+  if (isContextMenu && presenter != nil) {
+    [presenter presentViewController:viewControllerToPresent animated:flag completion:completion];
   } else {
     [super presentViewController:viewControllerToPresent animated:flag completion:completion];
   }
@@ -497,20 +483,20 @@ - (void)presentViewController:(UIViewController *)viewControllerToPresent animat
 - (void)viewDidDisappear:(BOOL)animated
 {
   [super viewDidDisappear:animated];
-  RNCMScreenView *screen = (RNCMScreenView *)self.view;
+  RNCMScreenView *screen = self.screenView;
   if (screen.stackPresentation == RNSScreenStackPresentationPush &&
       self.parentViewController == nil && self.presentingViewController == nil) {
     [screen notifyDismissed];
   }
 }
 
-- (void)viewDidAppear:(BOOL)animated
-{
-  [super viewDidAppear:animated];
+- (RNCMScreenView *)screenView {
+  return (RNCMScreenView *)self.view;
 }
 
-- (PanModalViewController*) parentVC {
-  return (PanModalViewController*) _parentVC;
+- (PanModalViewController *)panModalContr
```

**File**: `src/react-native-cool-modals/ios/RNCMScreenStack.m` (modified, +5/-5)
```diff
@@ -213,7 +213,7 @@ - (void)dismissScreen:(RNCMScreenView *)screen
 {
   UIViewController *controller = screen.controller;
   if ([_dismissingModals containsObject:controller]) return;
-  PanModalViewController *presenter = (PanModalViewController *)[(RNCMScreen *)controller parentVC];
+  PanModalViewController *presenter = screen.controller.panModalController;
   if (presenter == nil || presenter.presentingViewController == nil) return;
 
   [_dismissingModals addObject:controller];
@@ -268,7 +268,7 @@ - (void)setModalViewControllers:(NSArray<UIViewController *> *)controllers
   for (NSInteger i = presented.count - 1; i >= 0; i--) {
     RNCMScreen *controller = (RNCMScreen *)presented[i];
     RNCMScreenView *screen = (RNCMScreenView *)controller.view;
-    PanModalViewController *presenter = (PanModalViewController *)[controller parentVC];
+    PanModalViewController *presenter = controller.panModalController;
     BOOL rebuild = rebuildFrom != NSNotFound && (NSUInteger)i >= rebuildFrom;
     BOOL wanted = [desired containsObject:controller] && !rebuild;
     screen.userInteractionEnabled = wanted && !screen.skipsOnReturn;
@@ -294,15 +294,15 @@ - (void)setModalViewControllers:(NSArray<UIViewController *> *)controllers
   }
 
   for (RNCMScreen *controller in _presentedModals) {
-    PanModalViewController *modal = (PanModalViewController *)[controller parentVC];
+    PanModalViewController *modal = controller.panModalController;
     if (modal.dismissing || modal.isBeingDismissed || modal.isBeingPresented) return;
     presenter = modal;
   }
 
   if (desiredIndex >= desired.count || presenter == nil ||
       (presenter.parentViewController == nil && presenter.presentingViewController == nil)) return;
 
-  UIViewController *next = desired[desiredIndex];
+  RNCMScreen *next = (RNCMScreen *)desired[desiredIndex];
   _presentingModal = next;
   [_presentedModals addObject:next];
   __weak RNCMScreenStackView *weakSelf = self;
@@ -438,7 +438,7 @@ - (void)invalidate
   [_dismissingModals removeAllObjects];
   _presentingModal = nil;
   for (RNCMScreen *controller in presented) {
-    [[controller parentVC] dismissViewControllerAnimated:NO completion:nil];
+    [controller.panModalController dismissViewControllerAnimated:NO completion:nil];
   }
   [_controller.view removeFromSuperview];
   [_controller willMoveToParentViewController:nil];
```

**File**: `src/react-native-cool-modals/ios/UIViewController+slack.swift` (modified, +66/-87)
```diff
@@ -1,28 +1,37 @@
-
 import PanModal
 import UIKit
 
+final class PanModalViewController: UIViewController, PanModalPresentable {
+  private var screen: RNCMScreen?
+  private var config: RNCMScreenView? { screen?.screenView }
+  private var state: PanModalPresentationController.PresentationState
+  private var forceDisableShortForm = false
+  private var isShortFormEnabledInternal = 2
+  private weak var selectedScrollView: UIScrollView?
 
-class PanModalViewController: UIViewController, PanModalPresentable, UILayoutSupport {
-  @objc var config : RNCMScreenView?
-  var length: CGFloat = 0
-  var topAnchor: NSLayoutYAxisAnchor = NSLayoutYAxisAnchor.init()
-  var bottomAnchor: NSLayoutYAxisAnchor = NSLayoutYAxisAnchor.init()
-  var heightAnchor: NSLayoutDimension = NSLayoutDimension.init()
-  var state: PanModalPresentationController.PresentationState? = nil;
   @objc private(set) var hiding = false
   @objc var dismissing: Bool { (presentationController as? PanModalPresentationController)?.isDismissing ?? isBeingDismissed }
 
-  weak var viewController: UIViewController?
-  private weak var selectedScrollView: UIScrollView?
+  init(screen: RNCMScreen) {
+    self.screen = screen
+    state = screen.screenView.startFromShortForm ? .shortForm : .longForm
+    super.init(nibName: nil, bundle: nil)
 
-  convenience init(_ viewControllerToPresent: UIViewController) {
-    self.init(nibName: nil, bundle: nil)
+    let content = screen.screenView
+    let root = UIView(frame: content.bounds)
+    root.backgroundColor = .clear
+    root.isOpaque = false
+    view = root
+    addChild(screen)
+    content.frame = root.bounds
+    content.autoresizingMask = [.flexibleWidth, .flexibleHeight]
+    root.addSubview(content)
+    screen.didMove(toParent: self)
+  }
 
-    viewControllerToPresent.setValue(self, forKey: "_parentVC")
-    viewController = viewControllerToPresent
-    config = (viewControllerToPresent.view as! RNCMScreenView)
-    state = (config?.startFromShortForm ?? false) ? PanModalPresentationController.PresentationState.shortForm : PanModalPresentationController.PresentationState.longForm;
+  @available(*, unavailable)
+  required init?(coder: NSCoder) {
+    fatalError("init(coder:) is unavailable")
   }
 
   @objc func hide() {
@@ -39,51 +48,38 @@ class PanModalViewController: UIViewController, PanModalPresentable, UILayoutSup
     guard presentationController is PanModalPresentationController else { return }
     panModalSetNeedsLayoutUpdate(transitionTo: {
       hiding = false
-      return state == .hidden ? (config?.startFromShortForm == true ? .shortForm : .longForm) : state ?? .longForm
+      return state == .hidden ? (config?.startFromShortForm == true ? .shortForm : .longForm) : state
     })
   }
 
-  @objc func panModalSetNeedsLayoutUpdateWrapper() {
+  @objc func setNeedsPanModalLayoutUpdate() {
     panModalSetNeedsLayoutUpdate()
   }
-  
-  var forceDisableShortForm = false
-  
+
   func willTransition(to state: PanModalPresentationController.PresentationState) {
     if state == .longForm, !forceDisableShortForm, config?.disableShortFormAfterTransitionToLongForm == true {
       forceDisableShortForm = true
-      self.panModalSetNeedsLayoutUpdate()
+      panModalSetNeedsLayoutUpdate()
     }
-    self.state = state;
+    self.state = state
   }
 
-
   func onTouchTop(_ dismissing: Bool) {
-    let selector = NSSelectorFromString("onTouchTopWrapper:")
-    config?.perform(selector, with: NSNumber.init(value: dismissing))
-  }
-
-  override var bottomLayoutGuide: UILayoutSupport {
-    get {
-      if self.isViewLoaded {
-        return super.bottomLayoutGuide
-      }
-      return self
-    }
+    config?.notifyTouchTop(dismissing)
   }
 
   var cornerRadius: CGFloat {
-    if (self.config?.cornerRadius == 0.666) {
+    if config?.cornerRadius == 0.666 {
       return UIScreen.main.displayCornerRadius
     }
-    return CGFloat(truncating: self.config?.cornerRadius ?? 0)
+    return CGFloat(truncating: config?.cornerRadius ?? 0)
   }
 
   var ignoreBottomOffset: Bool {
-    return self.config!.ignoreBottomOffset;
+    return config?.ignoreBottomOffset ?? false
   }
 
-  var isHapticFeedbackEnabled: Bool = false
+  let isHapticFeedbackEnabled = false
 
   func willReceivePanTouch(_ touch: UITouch) {
     guard config?.interactWithScrollView == true else {
@@ -135,18 +131,6 @@ class PanModalViewController: UIViewController, PanModalPresentable, UILayoutSup
     return false
   }
 
-  override var view: UIView! {
-    get {
-      if (viewController == nil) {
-        return UIView()
-      }
-      return viewController!.view
-    }
-    set {
-
-    }
-  }
-
   func panModalWillDismiss() {
     config?.willDismiss()
   }
@@ -158,20 +142,20 @@ class PanModalViewController: UIViewController, PanModalPresentable, UILayoutSup
   }
 
   var allowsDragToDismiss: Bool {
-    return self.config?.allowsDragToDismiss ?? false
+    return config?.allowsDragToDismiss ?? false
   }
 
   var allow
```

**File**: `tools/cool-modals-native-tests/README.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# Cool-modals native checks
+
+Run on an explicitly selected, booted simulator:
+
+```sh
+python3 tools/cool-modals-native-tests/run.py \
+  --artifacts /tmp/cool-modals-native-tests \
+  --panmodal /path/to/PanModal \
+  --device YOUR_SIMULATOR_UDID
+```
+
+The PanModal checkout must match the commit selected by `ios/Podfile`. The runner
+compiles the actual screen and adapter with UIKit, syntax-checks the actual native
+stack against the generated Swift header, and installs a small diagnostic app.
+Builds, source snapshots, callback traces, and results stay under `--artifacts`.
+A failed candidate assertion exits nonzero.
+
+Add `--baseline REVISION` to run the shorter containment contract against a prior
+revision. Baseline mode requires a containment failure with setup and control checks
+passing; it records each assertion and does not count those failures as candidate
+acceptance.
+
+The React bridge and stack notification boundary are recording substitutes. This
+suite covers native containment, sizing, callback order, cancellation, reuse, and
+invalidation. It does not exercise React Native Paper reconciliation, native-stack
+policy, JS delivery of dismissal events, real touch input, or physical frame
+cadence. It preserves the production PanModal source and motion law.
```

**File**: `tools/cool-modals-native-tests/ReactBoundary.h` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+#ifndef COOL_MODALS_REACT_BOUNDARY_H
+#define COOL_MODALS_REACT_BOUNDARY_H
+#import <UIKit/UIKit.h>
+
+// Only the React bridge boundary is replaced. UIKit controllers, layout,
+// presentation, gestures and the production screen adapter remain real.
+typedef void (^RCTDirectEventBlock)(NSDictionary *body);
+typedef NS_ENUM(NSInteger, RCTPointerEvents) { RCTPointerEventsUnspecified };
+@protocol RCTBridgeModule <NSObject>
+@end
+@protocol RCTInvalidating <NSObject>
+- (void)invalidate;
+@end
+@interface RCTUIManager : NSObject
+@property (nonatomic, readonly) NSArray<NSValue *> *publishedSizes;
+- (void)setSize:(CGSize)size forView:(UIView *)view;
+@end
+@interface RCTBridge : NSObject
+@property (nonatomic, strong) RCTUIManager *uiManager;
+@end
+@interface UIView (ReactBoundary)
+- (UIView *)reactSuperview;
+- (UIViewController *)reactViewController;
+- (void)didSetProps:(NSArray<NSString *> *)props;
+- (void)reactSetFrame:(CGRect)frame;
+@end
+@interface RCTView : UIView
+@property (nonatomic) RCTPointerEvents pointerEvents;
+@end
+@interface RCTRootView : RCTView
+@end
+@interface RCTViewManager : NSObject <RCTBridgeModule>
+@property (nonatomic, strong) RCTBridge *bridge;
+@end
+@interface RCTConvert : NSObject
+@end
+@interface RCTTouchHandler : UIGestureRecognizer
+- (instancetype)initWithBridge:(RCTBridge *)bridge;
+- (void)attachToView:(UIView *)view;
+- (void)detachFromView:(UIView *)view;
+- (void)cancel;
+@end
+// Declaration needed by the actual stack syntax check.
+@interface RCTRootContentView : UIView
+@property (nonatomic, strong) RCTTouchHandler *touchHandler;
+@end
+@interface UIScreen (UnusedCornerBoundary)
+@property (nonatomic, readonly) CGFloat displayCornerRadius;
+@end
+#define RCT_EXPORT_MODULE(...)
+#define RCT_EXPORT_VIEW_PROPERTY(...)
+#define RCT_ENUM_CONVERTER(...)
+#define RCTLogError(...) NSLog(__VA_ARGS__)
+
+#endif
```

**File**: `tools/cool-modals-native-tests/ReactBoundary.m` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+#import "ReactBoundary.h"
+#import "RNCMScreen.h"
+#import "RNCMScreenStack.h"
+
+@implementation RCTUIManager {
+  NSMutableArray<NSValue *> *_sizes;
+}
+- (instancetype)init { if (self = [super init]) _sizes = [NSMutableArray new]; return self; }
+- (NSArray<NSValue *> *)publishedSizes { return [_sizes copy]; }
+- (void)setSize:(CGSize)size forView:(UIView *)view { [_sizes addObject:[NSValue valueWithCGSize:size]]; }
+@end
+@implementation RCTBridge
+- (instancetype)init { if (self = [super init]) _uiManager = [RCTUIManager new]; return self; }
+@end
+@implementation UIView (ReactBoundary)
+- (UIView *)reactSuperview { return self.superview; }
+- (UIViewController *)reactViewController { return nil; }
+- (void)didSetProps:(NSArray<NSString *> *)props {}
+- (void)reactSetFrame:(CGRect)frame { self.frame = frame; }
+@end
+@implementation RCTView
+@end
+@implementation RCTRootView
+@end
+@implementation RCTViewManager
+@end
+@implementation RCTConvert
+@end
+@implementation RCTTouchHandler
+- (instancetype)initWithBridge:(RCTBridge *)bridge { return [super initWithTarget:nil action:nil]; }
+- (void)attachToView:(UIView *)view { if (self.view != view) [view addGestureRecognizer:self]; }
+- (void)detachFromView:(UIView *)view { [view removeGestureRecognizer:self]; }
+- (void)cancel { self.enabled = NO; self.enabled = YES; }
+@end
+@implementation UIScreen (UnusedCornerBoundary)
+- (CGFloat)displayCornerRadius { [NSException raise:@"UnexercisedBoundary" format:@"The suite uses an explicit corner radius"]; return 0; }
+@end
+// The suite records adapter notifications at this boundary; it does not
+// substitute a model of the production native stack's reconciliation policy.
+@implementation RNCMScreenStackView
+- (void)updateContainer {}
+- (void)setNeedsContainerUpdate {}
+- (void)screenDidDisappear:(RNCMScreenView *)screen {}
+- (void)cancelTouchesBelowScreen:(RNCMScreenView *)screen completion:(void (^)(void))completion { completion(); }
+- (void)invalidate {}
+@end
```

#### Recent Merged Pull Requests:
- **PR #7940** (2026-11-11): fix(assets): handle user assets without a networks map (@i1skn)
- **PR #7939** (2026-11-11): chore(ios): commit Info.plists in the format pod install writes (@i1skn)
- **PR #7937** (2026-11-09): feat(polymarket): restore builder attribution (@christianbaroni)
- **PR #7936** (2026-11-11): Bump iOS and Android to v2.0.49 (@jinchung)
- **PR #7935** (2026-11-07): fix: stale currency conversion for perps and Polymarket balances (@christianbaroni)
- **PR #7934** (2026-11-07): chore: bump SDK to 0.4.2 for Elysium (@jinchung)

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

## X. navigation): support native iOS interruptible sheet navigation and polish scroll

**RULE**:
When implementing operations in `ios/Podfile`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rainbow-me/rainbow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3d5c29d4`: navigation): support native iOS interruptible sheet navigation and polish scroll tracking (#7920). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `ios/Podfile`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  pod "PanModal", :git => 'https://github.com/rainbow-me/PanModal', :commit => 'ee4b8b65cbcfbee1448b6eb3330ed07e92d8c9a3'
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  pod "PanModal", :git => 'https://github.com/rainbow-me/PanModal', :commit => 'ab97d74279ba28c2891b47a5dc767ed4dd7cf994'
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3d5c29d4` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
