# Forensic Learning Record (Deep Inspection): yannickl/DynamicColor

> **Canonical Artifact**: `07_PROJECT_LEARNING/yannickl-dynamiccolor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yannickl/DynamicColor](https://github.com/yannickl/DynamicColor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:14:32.450Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yannickl/DynamicColor`
- **Description**: Yet another extension to manipulate colors easily in Swift and SwiftUI
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3080 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/Core/Array.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

import Foundation

/**
 Convenient extension for color array to work as a DynamicGradient.
 */
public extension Array where Element: DynamicColor {
  /**
   Gradient representation of the array.
   */
  var gradient: DynamicGradient {
    return DynamicGradient(colors: self)
  }
}

```

### Core Architecture Module: `Sources/Core/ContrastDisplayContext.swift`
```
//
//  ContrastDisplayContext.swift
//  DynamicColorExample
//
//  Created by Yannick LORIOT on 26/11/2016.
//  Copyright © 2016 Yannick LORIOT. All rights reserved.
//

import Foundation

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

extension DynamicColor {
  /**
   Used to describe the context of display of 2 colors.

   Based on WCAG: https://www.w3.org/TR/2008/REC-WCAG20-20081211/#visual-audio-contrast-contrast
   */
  public enum ContrastDisplayContext {
    /**
     A standard text in a normal context.
     */
    case standard
    /**
     A large text in a normal context.
     You can look here for the definition of "large text":
     https://www.w3.org/TR/2008/REC-WCAG20-20081211/#larger-scaledef
     */
    case standardLargeText
    /**
     A standard text in an enhanced context.
     Enhanced means that you want to be accessible (and AAA compliant in WCAG)
     */
    case enhanced
    /**
     A large text in an enhanced context.
     Enhanced means that you want to be accessible (and AAA compliant in WCAG)
     You can look here for the definition of "large text":
     https://www.w3.org/TR/2008/REC-WCAG20-20081211/#larger-scaledef
     */
    case enhancedLargeText

    var minimumContrastRatio: CGFloat {
      switch self {
      case .standard:
        return 4.5
      case .standardLargeText:
        return 3.0
      case .enhanced:
        return 7.0
      case .enhancedLargeText:
        return 4.5
      }
    }
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicColor+Deriving.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

// MARK: Deriving Colors

public extension DynamicColor {
  /**
   Creates and returns a color object with the hue rotated along the color wheel by the given amount.

   - parameter amount: A float representing the number of degrees as ratio (usually between -360.0 degree and 360.0 degree).
   - returns: A DynamicColor object with the hue changed.
   */
  final func adjustedHue(amount: CGFloat) -> DynamicColor {
    return HSL(color: self).adjustedHue(amount: amount).toDynamicColor()
  }

  /**
   Creates and returns the complement of the color object.

   This is identical to adjustedHue(180).

   - returns: The complement DynamicColor.
   - seealso: adjustedHueColor:
   */
  final func complemented() -> DynamicColor {
    return adjustedHue(amount: 180.0)
  }

  /**
   Creates and returns a color object with the lightness increased by the given amount.

   - parameter amount: CGFloat between 0.0 and 1.0. Default value is 0.2.
   - returns: A lighter DynamicColor.
   */
  final func lighter(amount: CGFloat = 0.2) -> DynamicColor {
    return HSL(color: self).lighter(amount: amount).toDynamicColor()
  }

  /**
   Creates and returns a color object with the lightness decreased by the given amount.

   - parameter amount: Float between 0.0 and 1.0. Default value is 0.2.
   - returns: A darker DynamicColor.
   */
  final func darkened(amount: CGFloat = 0.2) -> DynamicColor {
    return HSL(color: self).darkened(amount: amount).toDynamicColor()
  }

  /**
   Creates and returns a color object with the saturation increased by the given amount.

   - parameter amount: CGFloat between 0.0 and 1.0. Default value is 0.2.

   - returns: A DynamicColor more saturated.
   */
  final func saturated(amount: CGFloat = 0.2) -> DynamicColor {
    return HSL(color: self).saturated(amount: amount).toDynamicColor()
  }

  /**
   Creates and returns a color object with the saturation decreased by the given amount.

   - parameter amount: CGFloat between 0.0 and 1.0. Default value is 0.2.
   - returns: A DynamicColor less saturated.
   */
  final func desaturated(amount: CGFloat = 0.2) -> DynamicColor {
    return HSL(color: self).desaturated(amount: amount).toDynamicColor()
  }

  /**
   Creates and returns a color object converted to grayscale.

   - returns: A grayscale DynamicColor.
   - seealso: desaturated:
   */
  final func grayscaled(mode: GrayscalingMode = .lightness) -> DynamicColor {
    let (r, g, b, a) = self.toRGBAComponents()

    let l: CGFloat
    switch mode {
    case .luminance:
      l = (0.299 * r) + (0.587 * g) + (0.114 * b)
    case .lightness:
      l = 0.5 * (max(r, g, b) + min(r, g, b))
    case .average:
      l = (1.0 / 3.0) * (r + g + b)
    case .value:
      l = max(r, g, b)
    }

    return HSL(hue: 0.0, saturation: 0.0, lightness: l, alpha: a).toDynamicColor()
  }

  /**
   Creates and return a color object where the red, green, and blue values are inverted, while the alpha channel is left alone.

   - returns: An inverse (negative) of the original color.
   */
  final func inverted() -> DynamicColor {
    let rgba = toRGBAComponents()

    let invertedRed   = 1.0 - rgba.r
    let invertedGreen = 1.0 - rgba.g
    let invertedBlue  = 1.0 - rgba.b

    return DynamicColor(red: invertedRed, green: invertedGreen, blue: invertedBlue, alpha: rgba.a)
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicColor+HSB.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

// MARK: HSB Color Space

extension DynamicColor {
  // MARK: - Getting the HSB Components

  /**
   Returns the HSB (hue, saturation, brightness) components.

   - returns: The HSB components as a tuple (h, s, b).
   */
  public final func toHSBComponents() -> (h: CGFloat, s: CGFloat, b: CGFloat) {
    var h: CGFloat = 0.0
    var s: CGFloat = 0.0
    var b: CGFloat = 0.0

    #if os(iOS) || os(tvOS) || os(watchOS)
      getHue(&h, saturation: &s, brightness: &b, alpha: nil)

      return (h: h, s: s, b: b)
    #elseif os(OSX)
      if isEqual(DynamicColor.black) {
        return (0.0, 0.0, 0.0)
      }
      else if isEqual(DynamicColor.white) {
        return (0.0, 0.0, 1.0)
      }

      getHue(&h, saturation: &s, brightness: &b, alpha: nil)

      return (h: h, s: s, b: b)
    #endif
  }

  #if os(iOS) || os(tvOS) || os(watchOS)
    /**
     The hue component as CGFloat between 0.0 to 1.0.
     */
    public final var hueComponent: CGFloat {
      return toHSBComponents().h
    }

    /**
     The saturation component as CGFloat between 0.0 to 1.0.
     */
    public final var saturationComponent: CGFloat {
      return toHSBComponents().s
    }

    /**
     The brightness component as CGFloat between 0.0 to 1.0.
     */
    public final var brightnessComponent: CGFloat {
      return toHSBComponents().b
    }
  #endif
}

```

### Core Architecture Module: `Sources/Core/DynamicColor+HSL.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

// MARK: HSL Color Space

extension DynamicColor {
  /**
   Initializes and returns a color object using the specified opacity and HSL component values.

   - parameter hue: The hue component of the color object, specified as a value from 0.0 to 360.0 degree.
   - parameter saturation: The saturation component of the color object, specified as a value from 0.0 to 1.0.
   - parameter lightness: The lightness component of the color object, specified as a value from 0.0 to 1.0.
   - parameter alpha: The opacity value of the color object, specified as a value from 0.0 to 1.0. Default to 1.0.
   */
  public convenience init(hue: CGFloat, saturation: CGFloat, lightness: CGFloat, alpha: CGFloat = 1) {
    let color      = HSL(hue: hue, saturation: saturation, lightness: lightness, alpha: alpha).toDynamicColor()
    let components = color.toRGBAComponents()

    self.init(red: components.r, green: components.g, blue: components.b, alpha: components.a)
  }

  // MARK: - Getting the HSL Components

  /**
   Returns the HSL (hue, saturation, lightness) components.

   Notes that the hue value is between 0.0 and 360.0 degree.

   - returns: The HSL components as a tuple (h, s, l).
   */
  public final func toHSLComponents() -> (h: CGFloat, s: CGFloat, l: CGFloat) {
    let hsl = HSL(color: self)

    return (hsl.h * 360.0, hsl.s, hsl.l)
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicColor+Lab.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

// MARK: CIE L*a*b* Color Space

public extension DynamicColor {
  /**
   Initializes and returns a color object using CIE XYZ color space component values with an observer at 2° and a D65 illuminant.

   Notes that values out of range are clipped.

   - parameter L: The lightness, specified as a value from 0 to 100.0.
   - parameter a: The red-green axis, specified as a value from -128.0 to 127.0.
   - parameter b: The yellow-blue axis, specified as a value from -128.0 to 127.0.
   - parameter alpha: The opacity value of the color object, specified as a value from 0.0 to 1.0. Default to 1.0.
   */
  convenience init(L: CGFloat, a: CGFloat, b: CGFloat, alpha: CGFloat = 1) {
    let clippedL = clip(L, 0.0, 100.0)
    let clippedA = clip(a, -128.0, 127.0)
    let clippedB = clip(b, -128.0, 127.0)

    let normalized = { (c: CGFloat) -> CGFloat in
      pow(c, 3) > 0.008856 ? pow(c, 3) : (c - (16 / 116)) / 7.787
    }

    let preY = (clippedL + 16.0) / 116.0
    let preX = (clippedA / 500.0) + preY
    let preZ = preY - (clippedB / 200.0)

    let X = 95.05 * normalized(preX)
    let Y = 100.0 * normalized(preY)
    let Z = 108.9 * normalized(preZ)

    self.init(X: X, Y: Y, Z: Z, alpha: alpha)
  }

  // MARK: - Getting the L*a*b* Components

  /**
   Returns the Lab (lightness, red-green axis, yellow-blue axis) components. 
   It is based on the CIE XYZ color space with an observer at 2° and a D65 illuminant.

   Notes that L values are between 0 to 100.0, a values are between -128 to 127.0 and b values are between -128 to 127.0.

   - returns: The L*a*b* components as a tuple (L, a, b).
   */
  final func toLabComponents() -> (L: CGFloat, a: CGFloat, b: CGFloat) {
    let normalized = { (c: CGFloat) -> CGFloat in
      c > 0.008856 ? pow(c, 1.0 / 3.0) : (7.787 * c) + (16.0 / 116.0)
    }

    let xyz         = toXYZComponents()
    let normalizedX = normalized(xyz.X / 95.05)
    let normalizedY = normalized(xyz.Y / 100.0)
    let normalizedZ = normalized(xyz.Z / 108.9)

    let L = roundDecimal((116.0 * normalizedY) - 16.0, precision: 1000)
    let a = roundDecimal(500.0 * (normalizedX - normalizedY), precision: 1000)
    let b = roundDecimal(200.0 * (normalizedY - normalizedZ), precision: 1000)

    return (L: L, a: a, b: b)
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicColor+Mixing.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

// MARK: Mixing Colors

public extension DynamicColor {
  /**
   Mixes the given color object with the receiver.

   Specifically, takes the average of each of the RGB components, optionally weighted by the given percentage. 

   - Parameter color: A color object to mix with the receiver.
   - Parameter weight: The weight specifies the amount of the given color object (between 0 and 1). 
       The default value is 0.5, which means that half the given color and half the receiver color object should be used. 
       0.25 means that a quarter of the given color object and three quarters of the receiver color object should be used.
   - Parameter colorspace: The color space used to mix the colors. By default it uses the RBG color space.
   - Returns: A color object corresponding to the two colors object mixed together.
   */
  final func mixed(withColor color: DynamicColor, weight: CGFloat = 0.5, inColorSpace colorspace: DynamicColorSpace = .rgb) -> DynamicColor {
    let normalizedWeight = clip(weight, 0.0, 1.0)

    switch colorspace {
    case .lab:
      return mixedLab(withColor: color, weight: normalizedWeight)
    case .hsl:
      return mixedHSL(withColor: color, weight: normalizedWeight)
    case .hsb:
      return mixedHSB(withColor: color, weight: normalizedWeight)
    case .rgb:
      return mixedRGB(withColor: color, weight: normalizedWeight)
    }
  }

  /**
   Creates and returns a color object corresponding to the mix of the receiver and an amount of white color, which increases lightness.

   - Parameter amount: Float between 0.0 and 1.0. The default amount is equal to 0.2.
   - Returns: A lighter DynamicColor.
   */
  final func tinted(amount: CGFloat = 0.2) -> DynamicColor {
    return mixed(withColor: .white, weight: amount)
  }

  /**
   Creates and returns a color object corresponding to the mix of the receiver and an amount of black color, which reduces lightness.

   - Parameter amount: Float between 0.0 and 1.0. The default amount is equal to 0.2.
   - Returns: A darker DynamicColor.
   */
  final func shaded(amount: CGFloat = 0.2) -> DynamicColor {
    return mixed(withColor: DynamicColor(red: 0, green: 0, blue: 0, alpha: 1), weight: amount)
  }

  // MARK: - Convenient Internal Methods

  func mixedLab(withColor color: DynamicColor, weight: CGFloat) -> DynamicColor {
    let c1 = toLabComponents()
    let c2 = color.toLabComponents()

    let L     = c1.L + (weight * (c2.L - c1.L))
    let a     = c1.a + (weight * (c2.a - c1.a))
    let b     = c1.b + (weight * (c2.b - c1.b))
    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))

    return DynamicColor(L: L, a: a, b: b, alpha: alpha)
  }

  func mixedHSL(withColor color: DynamicColor, weight: CGFloat) -> DynamicColor {
    let c1 = toHSLComponents()
    let c2 = color.toHSLComponents()

    let h     = c1.h + (weight * mixedHue(source: c1.h, target: c2.h))
    let s     = c1.s + (weight * (c2.s - c1.s))
    let l     = c1.l + (weight * (c2.l - c1.l))
    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))

    return DynamicColor(hue: h, saturation: s, lightness: l, alpha: alpha)
  }

  func mixedHSB(withColor color: DynamicColor, weight: CGFloat) -> DynamicColor {
    let c1 = toHSBComponents()
    let c2 = color.toHSBComponents()

    let h     = c1.h + (weight * mixedHue(source: c1.h, target: c2.h))
    let s     = c1.s + (weight * (c2.s - c1.s))
    let b     = c1.b + (weight * (c2.b - c1.b))
    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))

    return DynamicColor(hue: h, saturation: s, brightness: b, alpha: alpha)
  }

  func mixedRGB(withColor color: DynamicColor, weight: CGFloat) -> DynamicColor {
    let c1 = toRGBAComponents()
    let c2 = color.toRGBAComponents()

    let red   = c1.r + (weight * (c2.r - c1.r))
    let green = c1.g + (weight * (c2.g - c1.g))
    let blue  = c1.b + (weight * (c2.b - c1.b))
    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))

    return DynamicColor(red: red, green: green, blue: blue, alpha: alpha)
  }

  func mixedHue(source: CGFloat, target: CGFloat) -> CGFloat {
    if target > source && target - source > 180.0 {
      return target - source + 360.0
    }
    else if target < source && source - target > 180.0 {
      return target + 360.0 - source
    }

    return target - source
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicColor+RGBA.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

// MARK: RGBA Color Space

public extension DynamicColor {
  /**
   Initializes and returns a color object using the specified opacity and RGB component values.

   Notes that values out of range are clipped.

   - Parameter r: The red component of the color object, specified as a value from 0.0 to 255.0.
   - Parameter g: The green component of the color object, specified as a value from 0.0 to 255.0.
   - Parameter b: The blue component of the color object, specified as a value from 0.0 to 255.0.
   - Parameter a: The opacity value of the color object, specified as a value from 0.0 to 255.0. The default value is 255.
   */
  convenience init(r: CGFloat, g: CGFloat, b: CGFloat, a: CGFloat = 255) {
    self.init(red: clip(r, 0, 255) / 255, green: clip(g, 0, 255) / 255, blue: clip(b, 0, 255) / 255, alpha: clip(a, 0, 255) / 255)
  }

  // MARK: - Getting the RGBA Components

  /**
   Returns the RGBA (red, green, blue, alpha) components.

   - returns: The RGBA components as a tuple (r, g, b, a).
   */
  final func toRGBAComponents() -> (r: CGFloat, g: CGFloat, b: CGFloat, a: CGFloat) {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0

    #if os(iOS) || os(tvOS) || os(watchOS)
      getRed(&r, green: &g, blue: &b, alpha: &a)

      return (r, g, b, a)
    #elseif os(OSX)
      guard let rgbaColor = self.usingColorSpace(.deviceRGB) else {
        fatalError("Could not convert color to RGBA.")
      }

      rgbaColor.getRed(&r, green: &g, blue: &b, alpha: &a)

      return (r, g, b, a)
    #endif
  }

  #if os(iOS) || os(tvOS) || os(watchOS)
  /**
   The red component as CGFloat between 0.0 to 1.0.
   */
  final var redComponent: CGFloat {
    return toRGBAComponents().r
  }

  /**
   The green component as CGFloat between 0.0 to 1.0.
   */
  final var greenComponent: CGFloat {
    return toRGBAComponents().g
  }

  /**
   The blue component as CGFloat between 0.0 to 1.0.
   */
  final var blueComponent: CGFloat {
    return toRGBAComponents().b
  }

  /**
   The alpha component as CGFloat between 0.0 to 1.0.
   */
  final var alphaComponent: CGFloat {
    return toRGBAComponents().a
  }
  #endif

  // MARK: - Setting the RGBA Components

  /**
   Creates and returns a color object with the alpha increased by the given amount.

   - parameter amount: CGFloat between 0.0 and 1.0.
   - returns: A color object with its alpha channel modified.
   */
  final func adjustedAlpha(amount: CGFloat) -> DynamicColor {
    let components      = toRGBAComponents()
    let normalizedAlpha = clip(components.a + amount, 0.0, 1.0)

    return DynamicColor(red: components.r, green: components.g, blue: components.b, alpha: normalizedAlpha)
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicColor+XYZ.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

// MARK: CIE XYZ Color Space

public extension DynamicColor {
  /**
   Initializes and returns a color object using CIE XYZ color space component values with an observer at 2° and a D65 illuminant.
   
   Notes that values out of range are clipped.

   - parameter X: The mix of cone response curves, specified as a value from 0 to 95.05.
   - parameter Y: The luminance, specified as a value from 0 to 100.0.
   - parameter Z: The quasi-equal to blue stimulation, specified as a value from 0 to 108.9.
   - parameter alpha: The opacity value of the color object, specified as a value from 0.0 to 1.0. Default to 1.0.
   */
  convenience init(X: CGFloat, Y: CGFloat, Z: CGFloat, alpha: CGFloat = 1) {
    let clippedX = clip(X, 0.0, 95.05) / 100.0
    let clippedY = clip(Y, 0.0, 100) / 100.0
    let clippedZ = clip(Z, 0.0, 108.9) / 100.0

    let toRGB = { (c: CGFloat) -> CGFloat in
      let rgb = c > 0.0031308 ? 1.055 * pow(c, 1.0 / 2.4) - 0.055 : c * 12.92

      return abs(roundDecimal(rgb, precision: 1000.0))
    }

    let red   = toRGB((clippedX * 3.2406) + (clippedY * -1.5372) + (clippedZ * -0.4986))
    let green = toRGB((clippedX * -0.9689) + (clippedY * 1.8758) + (clippedZ * 0.0415))
    let blue  = toRGB((clippedX * 0.0557) + (clippedY * -0.2040) + (clippedZ * 1.0570))

    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }

  // MARK: - Getting the XYZ Components

  /**
   Returns the XYZ (mix of cone response curves, luminance, quasi-equal to blue stimulation) components with an observer at 2° and a D65 illuminant.

   Notes that X values are between 0 to 95.05, Y values are between 0 to 100.0 and Z values are between 0 to 108.9.

   - returns: The XYZ components as a tuple (X, Y, Z).
   */
  final func toXYZComponents() -> (X: CGFloat, Y: CGFloat, Z: CGFloat) {
    let toSRGB = { (c: CGFloat) -> CGFloat in
      c > 0.04045 ? pow((c + 0.055) / 1.055, 2.4) : c / 12.92
    }

    let rgba  = toRGBAComponents()
    let red   = toSRGB(rgba.r)
    let green = toSRGB(rgba.g)
    let blue  = toSRGB(rgba.b)

    let X = roundDecimal(((red * 0.4124) + (green * 0.3576) + (blue * 0.1805)) * 100.0, precision: 1000.0)
    let Y = roundDecimal(((red * 0.2126) + (green * 0.7152) + (blue * 0.0722)) * 100.0, precision: 1000.0)
    let Z = roundDecimal(((red * 0.0193) + (green * 0.1192) + (blue * 0.9505)) * 100.0, precision: 1000.0)

    return (X: X, Y: Y, Z: Z)
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicColor.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit

  /**
   Extension to manipulate colours easily.

   It allows you to work hexadecimal strings and value, HSV and RGB components, derivating colours, and many more...
   */
  public typealias DynamicColor = UIColor
#elseif os(OSX)
  import AppKit

  /**
   Extension to manipulate colours easily.

   It allows you to work hexadecimal strings and value, HSV and RGB components, derivating colours, and many more...
   */
  public typealias DynamicColor = NSColor
#endif

public extension DynamicColor {
  // MARK: - Manipulating Hexa-decimal Values and Strings

  /**
   Creates a color from an hex string (e.g. "#3498db"). The RGBA string are also supported (e.g. "#3498dbff").

   If the given hex string is invalid the initialiser will create a black color.

   - parameter hexString: A hexa-decimal color string representation.
   */
  convenience init(hexString: String) {
    let hexString                 = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    let scanner                   = Scanner(string: hexString)
    scanner.charactersToBeSkipped = CharacterSet(charactersIn: "#")

    var color: UInt64 = 0

    if scanner.scanHexInt64(&color) {
      self.init(hex: color, useAlpha: hexString.count > 7)
    }
    else {
      self.init(hex: 0x000000)
    }
  }

  /**
   Creates a color from an hex integer (e.g. 0x3498db).

   - parameter hex: A hexa-decimal UInt64 that represents a color.
   - parameter alphaChannel: If true the given hex-decimal UInt64 includes the alpha channel (e.g. 0xFF0000FF).
   */
  convenience init(hex: UInt64, useAlpha alphaChannel: Bool = false) {
    let mask      = UInt64(0xFF)
    let cappedHex = !alphaChannel && hex > 0xffffff ? 0xffffff : hex

    let r = cappedHex >> (alphaChannel ? 24 : 16) & mask
    let g = cappedHex >> (alphaChannel ? 16 : 8) & mask
    let b = cappedHex >> (alphaChannel ? 8 : 0) & mask
    let a = alphaChannel ? cappedHex & mask : 255

    let red   = CGFloat(r) / 255.0
    let green = CGFloat(g) / 255.0
    let blue  = CGFloat(b) / 255.0
    let alpha = CGFloat(a) / 255.0

    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }

  /**
   Returns the color representation as hexadecimal string.

   - returns: A string similar to this pattern "#f4003b".
   */
  final func toHexString() -> String {
    return String(format: "#%06x", toHex())
  }

  /**
   Returns the color representation as an integer (without the alpha channel).

   - returns: A UInt32 that represents the hexa-decimal color.
   */
  final func toHex() -> UInt32 {
    let rgba = toRGBAComponents()
    
    return roundToHex(rgba.r) << 16 | roundToHex(rgba.g) << 8 | roundToHex(rgba.b)
  }
  
  /**
   Returns the RGBA color representation.
   
   - returns: A UInt32 that represents the color as an RGBA value.
   */
  func toRGBA() -> UInt32 {
    let rgba = toRGBAComponents()
    
    return roundToHex(rgba.r) << 24 | roundToHex(rgba.g) << 16 | roundToHex(rgba.b) << 8 | roundToHex(rgba.a)
  }
  
  /**
   Returns the AGBR color representation.
   
   - returns: A UInt32 that represents the color as an AGBR value.
   */
  func toAGBR() -> UInt32 {
    let rgba = toRGBAComponents()
    
    return roundToHex(rgba.a) << 24 | roundToHex(rgba.b) << 16 | roundToHex(rgba.g) << 8 | roundToHex(rgba.r)
  }

  // MARK: - Identifying and Comparing Colors

  /**
   Returns a boolean value that indicates whether the receiver is equal to the given hexa-decimal string.

   - parameter hexString: A hexa-decimal color number representation to be compared to the receiver.
   - returns: true if the receiver and the string are equals, otherwise false.
   */
  func isEqual(toHexString hexString: String) -> Bool {
    return self.toHexString() == hexString
  }

  /**
   Returns a boolean value that indicates whether the receiver is equal to the given hexa-decimal integer.

   - parameter hex: A UInt32 that represents the hexa-decimal color.
   - returns: true if the receiver and the integer are equals, otherwise false.
   */
  func isEqual(toHex hex: UInt32) -> Bool {
    return self.toHex() == hex
  }

  // MARK: - Querying Colors

  /**
   Determines if the color object is dark or light.

   It is useful when you need to know whether you should display the text in black or white.

   - returns: A boolean value to know whether the color is light. If true the color is light, dark otherwise.
   */
  func isLight() -> Bool {
    let components = toRGBAComponents()
    let brightness = ((components.r * 299.0) + (components.g * 587.0) + (components.b * 114.0)) / 1000.0

    return brightness >= 0.5
  }

  /**
   A float value representing the luminance of the current color. May vary from 0 to 1.0.
   
   We use the formula described by W3C in WCAG 2.0. You can read more here: https://www.w3.org/TR/WCAG20/#relativeluminancedef.
  */
  var luminance: CGFloat {
    let components = toRGBAComponents()

    let componentsArray = [components.r, components.g, components.b].map { (val) -> CGFloat in
      guard val <= 0.03928 else { return pow((val + 0.055) / 1.055, 2.4) }

      return val / 12.92
    }

    return (0.2126 * componentsArray[0]) + (0.7152 * componentsArray[1]) + (0.0722 * componentsArray[2])
  }

  /**
     Returns a float value representing the contrast ratio between 2 colors. 
     
     We use the formula described by W3C in WCAG 2.0. You can read more here: https://www.w3.org/TR/WCAG20-TECHS/G18.html
     NB: the contrast ratio is a relative value. So the contrast between Color1 and Color2 is exactly the same between Color2 and Color1.
     
     - returns: A CGFloat representing contrast value.
     */
  func contrastRatio(with otherColor: DynamicColor) -> CGFloat {
    let otherLuminance = otherColor.luminance

    let l1 = max(luminance, otherLuminance)
    let l2 = min(luminance, otherLuminance)

    return (l1 + 0.05) / (l2 + 0.05)
  }

  /**
   Indicates if two colors are contrasting, regarding W3C's WCAG 2.0 recommendations.
   
   You can read it here: https://www.w3.org/TR/2008/REC-WCAG20-20081211/#visual-audio-contrast-contrast
   
   The acceptable contrast ratio depends on the context of display. Most of the time, the default context (.Standard) is enough.
   
   You can look at ContrastDisplayContext for more options.
   
   - parameter otherColor: The other color to compare with.
   - parameter context: An optional context to determine the minimum acceptable contrast ratio. Default value is .Standard.
   
   - returns: true is the contrast ratio between 2 colors exceed the minimum acceptable ratio.
   */
  func isContrasting(with otherColor: DynamicColor, inContext context: ContrastDisplayContext = .standard) -> Bool {
    return self.contrastRatio(with: otherColor) > context.minimumContrastRatio
  }
}

```

### Core Architecture Module: `Sources/Core/DynamicGradient.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

/**
 Object representing a gradient object. It allows you to manipulate colors inside different gradients and color spaces.
 */
final public class DynamicGradient {
  let colors: [DynamicColor]

  /**
   Initializes and creates a gradient from a color array.

   - Parameter colors: An array of colors.
   */
  public init(colors: [DynamicColor]) {
    self.colors = colors
  }

  /**
   Returns the color palette of `amount` elements by grabbing equidistant colors.

   - Parameter amount: An amount of colors to return. 2 by default.
   - Parameter colorspace: The color space used to mix the colors. By default it uses the RBG color space.
   - Returns: An array of DynamicColor objects with equi-distant space in the gradient.
   */
  public func colorPalette(amount: UInt = 2, inColorSpace colorspace: DynamicColorSpace = .rgb) -> [DynamicColor] {
    guard amount > 0 && colors.count > 0 else {
      return []
    }

    guard colors.count > 1 else {
      return (0 ..< amount).map { _ in colors[0] }
    }

    let increment = 1.0 / CGFloat(amount - 1)

    return (0 ..< amount).map { pickColorAt(scale: CGFloat($0) * increment, inColorSpace: colorspace) }
  }

  /**
   Picks up and returns the color at the given scale by interpolating the colors.

   For example, given this color array `[red, green, blue]` and a scale of `0.25` you will get a kaki color.

   - Parameter scale: A float value between 0.0 and 1.0.
   - Parameter colorspace: The color space used to mix the colors. By default it uses the RBG color space.
   - Returns: A DynamicColor object corresponding to the color at the given scale.
   */
  public func pickColorAt(scale: CGFloat, inColorSpace colorspace: DynamicColorSpace = .rgb) -> DynamicColor {
    guard colors.count > 1 else {
      return colors.first ?? .black
    }

    let clippedScale = clip(scale, 0.0, 1.0)
    let positions    = (0 ..< colors.count).map { CGFloat($0) / CGFloat(colors.count - 1) }

    var color: DynamicColor = .black

    for (index, position) in positions.enumerated() {
      guard clippedScale <= position else { continue }

      guard clippedScale != 0.0 && clippedScale != 1.0 else {
        return colors[index]
      }

      let previousPosition = positions[index - 1]
      let weight           = (clippedScale - previousPosition) / (position - previousPosition)

      color = colors[index - 1].mixed(withColor: colors[index], weight: weight, inColorSpace: colorspace)

      break
    }

    return color
  }
}

```

### Core Architecture Module: `Sources/Shared/Utils.swift`
```
/*
 * DynamicColor
 *
 * Copyright 2015-present Yannick Loriot.
 * http://yannickloriot.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#if os(iOS) || os(tvOS) || os(watchOS)
  import UIKit
#elseif os(OSX)
  import AppKit
#endif

/**
 Clips the values in an interval.

 Given an interval, values outside the interval are clipped to the interval
 edges. For example, if an interval of [0, 1] is specified, values smaller than
 0 become 0, and values larger than 1 become 1.

 - Parameter v: The value to clipped.
 - Parameter minimum: The minimum edge value.
 - Parameter maximum: The maximum edgevalue.
 */
internal func clip<T: Comparable>(_ v: T, _ minimum: T, _ maximum: T) -> T {
  return max(min(v, maximum), minimum)
}

/**
 Returns the absolute value of the modulo operation.

 - Parameter x: The value to compute.
 - Parameter m: The modulo.
 */
internal func moda(_ x: CGFloat, m: CGFloat) -> CGFloat {
  return (x.truncatingRemainder(dividingBy: m) + m).truncatingRemainder(dividingBy: m)
}

/**
 Rounds the given float to a given decimal precision.
 
 - Parameter x: The value to round.
 - Parameter m: The precision. Default to 10000.
 */
internal func roundDecimal(_ x: CGFloat, precision: CGFloat = 10000.0) -> CGFloat {
  return CGFloat(Int(round(x * precision))) / precision
}

internal func roundToHex(_ x: CGFloat) -> UInt32 {
  guard x > 0 else { return 0 }
  let rounded: CGFloat = round(x * 255.0)
  
  return UInt32(rounded)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #71** (2023-11-30): **feat: support Prefix "0x"**
  *Symptoms*: 

- **Issue #65** (2020-11-27): **No such module 'DynamicColor'**
  *Symptoms*: **Describe the bug** Suddenly I get error "No such module 'DynamicColor'" when building for macOS (Catalyst). Xcode 12.0.1.  **To Reproduce** Build for macOS Catalyst.  **Expected behavior** Should build for macOS Catalyst.  **Additional context** I didn'y have this issue before, I have no idea. All I did I added new Target for AppClip (but AppClip is only for iOS) 
  **Post-Mortem & Fix Analysis**:
  > Ok the issue was because of AppClip target. After re-enablig only for "iOS", everything was ok!

- **Issue #64** (2020-06-14): **Carthage: Can not build iOS**
  *Symptoms*: first  `carthage update --platform iOS`  with .. in cartfile  `github "yannickl/DynamicColor" >= 5.0.0`

- **Issue #63** (2020-06-28): **Second attempt at fixing release mode build problems**
  *Symptoms*: Updating Swift .package file as well as CocoaPods Podspec to limit iOS deployment target to >=11.0
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/yannickl/DynamicColor/pull/63?src=pr&el=h1) Report > Merging [#63](https://codecov.io/gh/yannickl/DynamicColor/pull/63?src=pr&el=desc) into [master](https://codecov.io/gh/yannickl/DynamicColor/commit/31383de322259d56dde30afdbbb6b1d551ef45b1&el=desc) will **increase** coverage by `0.06%`. > The diff coverage is `n/a`.  [![Impacted file tree graph](https://codecov.io/gh/yannickl/DynamicColor/pull/63/graphs/tree.svg?width=650&height=150&src=pr&token=3RTyA1t7hT)](https://codecov.io/gh/yannickl/DynamicColor/pull/63?src=pr&el=tree)  ```diff @@            Coverage Diff             @@ ##           master      #63      +/-   ## ========================================== + Coverage   93.24%   93.31%   +0.06%      ==========================================   Files          14       14                 Lines         385      314      -71      ========================================== - Hits          359      293      -66      + Misses         26       21       -5 
  > @richardgroves thank you very much for your help here! I have been really busy for a while and I have not taken enough time to maintain my libs. :(  Your help is more than welcome!

- **Issue #62** (2020-05-18): **Fixing a problem building in release modes**
  *Symptoms*: The version 5.0.0 wont build in release mode  -see https://github.com/yannickl/DynamicColor/issues/59 - this PR fixes that by updating some iOS deployment versions: from 8.0 to 11.0.
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/yannickl/DynamicColor/pull/62?src=pr&el=h1) Report > Merging [#62](https://codecov.io/gh/yannickl/DynamicColor/pull/62?src=pr&el=desc) into [master](https://codecov.io/gh/yannickl/DynamicColor/commit/31383de322259d56dde30afdbbb6b1d551ef45b1&el=desc) will **increase** coverage by `0.06%`. > The diff coverage is `n/a`.  [![Impacted file tree graph](https://codecov.io/gh/yannickl/DynamicColor/pull/62/graphs/tree.svg?width=650&height=150&src=pr&token=3RTyA1t7hT)](https://codecov.io/gh/yannickl/DynamicColor/pull/62?src=pr&el=tree)  ```diff @@            Coverage Diff             @@ ##           master      #62      +/-   ## ========================================== + Coverage   93.24%   93.31%   +0.06%      ==========================================   Files          14       14                 Lines         385      314      -71      ========================================== - Hits          359      293      -66      + Misses         26       21       -5 
  > Not fully working.

- **Issue #61** (2020-07-13): **Update to swift 5.0 / 5.1 **
  *Symptoms*: Hello,  Is that planned to update this lib to swift 5 ?  Thanks you
  **Post-Mortem & Fix Analysis**:
  > The latest version (5.0+) is compatible with Swift 5.

- **Issue #56** (2020-01-22): **Fix `final func toRGBAComponents()` on macOS for non-RGB colors**
  *Symptoms*: Handle all colors from compatible non-RGBA colorspaces, instead of just `white` and `black`.  Especially since line 72 causes a crash with a non-RGBA color space, otherwise.
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/yannickl/DynamicColor/pull/56?src=pr&el=h1) Report > Merging [#56](https://codecov.io/gh/yannickl/DynamicColor/pull/56?src=pr&el=desc) into [master](https://codecov.io/gh/yannickl/DynamicColor/commit/1e85f9461f44bbf8c3ffba9101b8d202f864cdc6?src=pr&el=desc) will **decrease** coverage by `0.03%`. > The diff coverage is `100%`.  [![Impacted file tree graph](https://codecov.io/gh/yannickl/DynamicColor/pull/56/graphs/tree.svg?width=650&token=3RTyA1t7hT&height=150&src=pr)](https://codecov.io/gh/yannickl/DynamicColor/pull/56?src=pr&el=tree)  ```diff @@            Coverage Diff             @@ ##           master      #56      +/-   ## ========================================== - Coverage   93.04%   93.01%   -0.04%      ==========================================   Files          14       14                 Lines         374      372       -2      ========================================== - Hits          348      346       -2        Misses         26       26 `

- **Issue #55** (2020-01-25): **Add support for grayscale modes**
  *Symptoms*: The current implementation of `final func grayscaled() -> DynamicColor` uses the HSL lightness as as measurement of lightness.  While this is computationally convenient it does not provide a good match for the [human perception of lightness](https://en.wikipedia.org/wiki/Lightness#Lightness_and_human_perception).  Relative luminance (the `Y` in `XYZ`) provides a much more accurate measure.  This PR adds support for specifying which color space (i.e. xyz, hsl, rgb, hsv) to be used for grayscaling, defaulting to `.lightness` (aka HSL) for the sake of not introducing a breaking-change.  ⚠️ Depends on https://github.com/yannickl/DynamicColor/pull/56
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/yannickl/DynamicColor/pull/55?src=pr&el=h1) Report > Merging [#55](https://codecov.io/gh/yannickl/DynamicColor/pull/55?src=pr&el=desc) into [master](https://codecov.io/gh/yannickl/DynamicColor/commit/1e85f9461f44bbf8c3ffba9101b8d202f864cdc6?src=pr&el=desc) will **increase** coverage by `0.19%`. > The diff coverage is `100%`.  [![Impacted file tree graph](https://codecov.io/gh/yannickl/DynamicColor/pull/55/graphs/tree.svg?width=650&token=3RTyA1t7hT&height=150&src=pr)](https://codecov.io/gh/yannickl/DynamicColor/pull/55?src=pr&el=tree)  ```diff @@            Coverage Diff             @@ ##           master      #55      +/-   ## ========================================== + Coverage   93.04%   93.24%   +0.19%      ==========================================   Files          14       14                 Lines         374      385      +11      ========================================== + Hits          348      359      +11        Misses         26       26 `
  > Looks good to me, thanks!

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

### Incident Patch 1: `d9beca13` (2020-06-28)
**Commit Message**: Fix version numbers

**File**: `DynamicColor.podspec` (modified, +3/-3)
```diff
@@ -11,9 +11,9 @@ Pod::Spec.new do |s|
   s.screenshot       = 'http://yannickloriot.com/resources/dynamiccolor-sample-screenshot.png'
 
   s.ios.deployment_target     = '11.0'
-  s.osx.deployment_target     = '10.9'
-  s.tvos.deployment_target    = '9.0'
-  s.watchos.deployment_target = '2.0'
+  s.osx.deployment_target     = '10.11'
+  s.tvos.deployment_target    = '11.0'
+  s.watchos.deployment_target = '4.0'
 
   s.ios.framework     = 'UIKit'
   s.osx.framework     = 'AppKit'
```

**File**: `Examples/DynamicColorExample.xcodeproj/project.pbxproj` (modified, +78/-28)
```diff
@@ -3,7 +3,7 @@
 	archiveVersion = 1;
 	classes = {
 	};
-	objectVersion = 48;
+	objectVersion = 51;
 	objects = {
 
 /* Begin PBXBuildFile section */
@@ -630,7 +630,7 @@
 				};
 			};
 			buildConfigurationList = CEFBDAD61B1CE38D000E6F30 /* Build configuration list for PBXProject "DynamicColorExample" */;
-			compatibilityVersion = "Xcode 8.0";
+			compatibilityVersion = "Xcode 10.0";
 			developmentRegion = en;
 			hasScannedForEncodings = 0;
 			knownRegions = (
@@ -915,8 +915,12 @@
 				FRAMEWORK_VERSION = A;
 				INFOPLIST_FILE = DynamicColorMacOS/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/../Frameworks @loader_path/Frameworks";
-				MACOSX_DEPLOYMENT_TARGET = 10.9;
+				LD_RUNPATH_SEARCH_PATHS = (
+					"$(inherited)",
+					"@executable_path/../Frameworks",
+					"@loader_path/Frameworks",
+				);
+				MACOSX_DEPLOYMENT_TARGET = 10.11;
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.DynamicColorMacOS;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -945,14 +949,19 @@
 				FRAMEWORK_VERSION = A;
 				INFOPLIST_FILE = DynamicColorMacOS/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/../Frameworks @loader_path/Frameworks";
-				MACOSX_DEPLOYMENT_TARGET = 10.9;
+				LD_RUNPATH_SEARCH_PATHS = (
+					"$(inherited)",
+					"@executable_path/../Frameworks",
+					"@loader_path/Frameworks",
+				);
+				MACOSX_DEPLOYMENT_TARGET = 10.11;
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.DynamicColorMacOS;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = macosx;
 				SKIP_INSTALL = YES;
-				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
+				SWIFT_COMPILATION_MODE = wholemodule;
+				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SWIFT_VERSION = 5.0;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
@@ -974,7 +983,11 @@
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				INFOPLIST_FILE = DynamicColorTvOs/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
+				LD_RUNPATH_SEARCH_PATHS = (
+					"$(inherited)",
+					"@executable_path/Frameworks",
+					"@loader_path/Frameworks",
+				);
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.DynamicColorTvOs;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -983,7 +996,7 @@
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 3;
-				TVOS_DEPLOYMENT_TARGET = 9.0;
+				TVOS_DEPLOYMENT_TARGET = 11.0;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
 			};
@@ -1003,16 +1016,21 @@
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				INFOPLIST_FILE = DynamicColorTvOs/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
+				LD_RUNPATH_SEARCH_PATHS = (
+					"$(inherited)",
+					"@executable_path/Frameworks",
+					"@loader_path/Frameworks",
+				);
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.DynamicColorTvOs;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = appletvos;
 				SKIP_INSTALL = YES;
-				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
+				SWIFT_COMPILATION_MODE = wholemodule;
+				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 3;
-				TVOS_DEPLOYMENT_TARGET = 9.0;
+				TVOS_DEPLOYMENT_TARGET = 11.0;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
 			};
@@ -1034,7 +1052,11 @@
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				INFOPLIST_FILE = DynamicColorWatchOs/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
+				LD_RUNPATH_SEARCH_PATHS = (
+					"$(inherited)",
+					"@executable_path/Frameworks",
+					"@loader_path/Frameworks",
+				);
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.DynamicColorWatchOs;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -1045,7 +1067,7 @@
 				TARGETED_DEVICE_FAMILY = 4;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
-				WATCHOS_DEPLOYMENT_TARGET = 2.0;
+				WATCHOS_DEPLOYMENT_TARGET = 4.0;
 			};
 			name = Debug;
 		};
@@ -1064,18 +1086,23 @@
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				INFOPLIST_FILE = DynamicColorWatchOs/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
+				LD_RUNPATH_SEARCH_PATHS = (
+					"$(inherited)",
+					"@executable_path/Frameworks",
+					"@loader_path/Frameworks",
+				);
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.Dynami
```

**File**: `Examples/WatchOSExample.xcodeproj/project.pbxproj` (modified, +12/-10)
```diff
@@ -555,13 +555,13 @@
 			buildSettings = {
 				INFOPLIST_FILE = "WatchOSExample WatchKit Extension/Info.plist";
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks";
-				MARKETING_VERSION = 4.2.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.WatchOSExample.watchkitapp.watchkitextension;
 				PRODUCT_NAME = "${TARGET_NAME}";
 				SDKROOT = watchos;
 				SKIP_INSTALL = YES;
 				TARGETED_DEVICE_FAMILY = 4;
-				WATCHOS_DEPLOYMENT_TARGET = 2.0;
+				WATCHOS_DEPLOYMENT_TARGET = 4.0;
 			};
 			name = Debug;
 		};
@@ -570,14 +570,14 @@
 			buildSettings = {
 				INFOPLIST_FILE = "WatchOSExample WatchKit Extension/Info.plist";
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks";
-				MARKETING_VERSION = 4.2.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.WatchOSExample.watchkitapp.watchkitextension;
 				PRODUCT_NAME = "${TARGET_NAME}";
 				SDKROOT = watchos;
 				SKIP_INSTALL = YES;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
 				TARGETED_DEVICE_FAMILY = 4;
-				WATCHOS_DEPLOYMENT_TARGET = 2.0;
+				WATCHOS_DEPLOYMENT_TARGET = 4.0;
 			};
 			name = Release;
 		};
@@ -588,13 +588,13 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				IBSC_MODULE = WatchOSExample_WatchKit_Extension;
 				INFOPLIST_FILE = "WatchOSExample WatchKit App/Info.plist";
-				MARKETING_VERSION = 4.2.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.WatchOSExample.watchkitapp;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = watchos;
 				SKIP_INSTALL = YES;
 				TARGETED_DEVICE_FAMILY = 4;
-				WATCHOS_DEPLOYMENT_TARGET = 2.0;
+				WATCHOS_DEPLOYMENT_TARGET = 4.0;
 			};
 			name = Debug;
 		};
@@ -605,13 +605,13 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				IBSC_MODULE = WatchOSExample_WatchKit_Extension;
 				INFOPLIST_FILE = "WatchOSExample WatchKit App/Info.plist";
-				MARKETING_VERSION = 4.2.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.WatchOSExample.watchkitapp;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = watchos;
 				SKIP_INSTALL = YES;
 				TARGETED_DEVICE_FAMILY = 4;
-				WATCHOS_DEPLOYMENT_TARGET = 2.0;
+				WATCHOS_DEPLOYMENT_TARGET = 4.0;
 			};
 			name = Release;
 		};
@@ -620,8 +620,9 @@
 			buildSettings = {
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				INFOPLIST_FILE = WatchOSExample/Info.plist;
+				IPHONEOS_DEPLOYMENT_TARGET = 11.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
-				MARKETING_VERSION = 4.2.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.WatchOSExample;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 			};
@@ -632,8 +633,9 @@
 			buildSettings = {
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				INFOPLIST_FILE = WatchOSExample/Info.plist;
+				IPHONEOS_DEPLOYMENT_TARGET = 11.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
-				MARKETING_VERSION = 4.2.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.WatchOSExample;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
```

**File**: `Package.swift` (modified, +5/-3)
```diff
@@ -5,19 +5,21 @@ let package = Package(
   name: "DynamicColor",
   platforms: [
 	.iOS(SupportedPlatform.IOSVersion.v11)
-	],
+  ],
   products: [
     .library(name: "DynamicColor", targets: ["DynamicColor"]),
   ],
   targets: [
     .target(
       name: "DynamicColor",
       dependencies: [],
-      path: "Sources"),
+      path: "Sources"
+    ),
     .testTarget(
       name: "DynamicColorTests",
       dependencies: ["DynamicColor"],
-      path: "Tests"),
+      path: "Tests"
+    ),
   ]
 )
 
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@
   <a href="https://github.com/Carthage/Carthage"><img alt="Carthage compatible" src="https://img.shields.io/badge/Carthage-%E2%9C%93-brightgreen.svg?style=flat"/></a>
   <a href="https://github.com/apple/swift-package-manager"><img alt="Swift Package Manager compatible" src="https://img.shields.io/badge/SPM-%E2%9C%93-brightgreen.svg?style=flat"/></a>
   <a href="https://travis-ci.org/yannickl/DynamicColor"><img alt="Build status" src="https://travis-ci.org/yannickl/DynamicColor.svg?branch=master"/></a>
-  <a href="http://codecov.io/github/yannickl/DynamicColor"><img alt="Code coverage status" src="http://codecov.io/github/yannickl/DynamicColor/coverage.svg?branch=master"/></a>
+  <a href="https://codecov.io/gh/yannickl/DynamicColor"><img src="https://codecov.io/gh/yannickl/DynamicColor/branch/master/graph/badge.svg" /></a>
 </p>
 
 **DynamicColor** provides powerful methods to manipulate colors in an easy way in Swift and SwiftUI.
@@ -24,7 +24,7 @@
 
 ## Requirements
 
-- iOS 8.0+ / Mac OS X 10.9+ / tvOS 9.0+ / watchOS 2.0+
+- iOS 11.0+ / Mac OS X 10.11+ / tvOS 11.0+ / watchOS 4.0+
 - Xcode 10.2+
 - Swift 5.0+
 
@@ -296,7 +296,7 @@ let package = Package(
     name: "YOUR_PROJECT_NAME",
     targets: [],
     dependencies: [
-        .package(url: "https://github.com/yannickl/DynamicColor.git", from: "5.0.0")    
+        .package(url: "https://github.com/yannickl/DynamicColor.git", from: "5.0.0")
     ]
 )
 ```
```

---

### Incident Patch 2: `5b32807b` (2020-05-13)
**Commit Message**: Update version number and iOS deployment target to fix build issues in release modes

**File**: `DynamicColor.podspec` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 Pod::Spec.new do |s|
   s.name             = 'DynamicColor'
-  s.version          = '5.0.0'
+  s.version          = '5.0.1'
   s.license          = 'MIT'
   s.swift_version    = ['5.0', '5.1']
   s.summary          = 'Yet another extension to manipulate colors easily in Swift (UIColor, NSColor and SwiftUI)'
@@ -10,7 +10,7 @@ Pod::Spec.new do |s|
   s.source           = { :git => 'https://github.com/yannickl/DynamicColor.git', :tag => s.version }
   s.screenshot       = 'http://yannickloriot.com/resources/dynamiccolor-sample-screenshot.png'
 
-  s.ios.deployment_target     = '8.0'
+  s.ios.deployment_target     = '11.0'
   s.osx.deployment_target     = '10.9'
   s.tvos.deployment_target    = '9.0'
   s.watchos.deployment_target = '2.0'
```

---

### Incident Patch 3: `80a26b37` (2020-05-13)
**Commit Message**: Updating Deployment target to 11.0 so it builds in release modes

**File**: `Examples/DynamicColorExample.xcodeproj/project.pbxproj` (modified, +8/-6)
```diff
@@ -1095,9 +1095,9 @@
 				);
 				INFOPLIST_FILE = DynamicColor/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				IPHONEOS_DEPLOYMENT_TARGET = 8.0;
+				IPHONEOS_DEPLOYMENT_TARGET = 11.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
-				MARKETING_VERSION = 5.0.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = "com.yannickloriot.$(PRODUCT_NAME:rfc1034identifier)";
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SKIP_INSTALL = YES;
@@ -1119,9 +1119,9 @@
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				INFOPLIST_FILE = DynamicColor/Info.plist;
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
-				IPHONEOS_DEPLOYMENT_TARGET = 8.0;
+				IPHONEOS_DEPLOYMENT_TARGET = 11.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
-				MARKETING_VERSION = 5.0.0;
+				MARKETING_VERSION = 5.0.1;
 				PRODUCT_BUNDLE_IDENTIFIER = "com.yannickloriot.$(PRODUCT_NAME:rfc1034identifier)";
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SKIP_INSTALL = YES;
@@ -1285,8 +1285,9 @@
 			buildSettings = {
 				ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
-				DEVELOPMENT_TEAM = "";
+				DEVELOPMENT_TEAM = J87V2D9N4D;
 				INFOPLIST_FILE = "$(SRCROOT)/iOSExample/Info.plist";
+				IPHONEOS_DEPLOYMENT_TARGET = 11.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = "com.yannickloriot.$(PRODUCT_NAME:rfc1034identifier)";
@@ -1300,8 +1301,9 @@
 			buildSettings = {
 				ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
-				DEVELOPMENT_TEAM = "";
+				DEVELOPMENT_TEAM = J87V2D9N4D;
 				INFOPLIST_FILE = "$(SRCROOT)/iOSExample/Info.plist";
+				IPHONEOS_DEPLOYMENT_TARGET = 11.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
 				MARKETING_VERSION = 5.0.0;
 				PRODUCT_BUNDLE_IDENTIFIER = "com.yannickloriot.$(PRODUCT_NAME:rfc1034identifier)";
```

---

### Incident Patch 4: `ea8c4b22` (2020-01-22)
**Commit Message**: Merge pull request #56 from regexident/fix-to-rgba-components

Fix `final func toRGBAComponents()` on macOS for non-RGB colors

**File**: `Sources/DynamicColor+RGBA.swift` (modified, +3/-6)
```diff
@@ -62,14 +62,11 @@ public extension DynamicColor {
 
       return (r, g, b, a)
     #elseif os(OSX)
-      if isEqual(DynamicColor.black) {
-        return (0, 0, 0, 0)
-      }
-      else if isEqual(DynamicColor.white) {
-        return (1, 1, 1, 1)
+      guard let rgbaColor = self.usingColorSpace(.deviceRGB) else {
+        fatalError("Could not convert color to RGBA.")
       }
 
-      getRed(&r, green: &g, blue: &b, alpha: &a)
+      rgbaColor.getRed(&r, green: &g, blue: &b, alpha: &a)
 
       return (r, g, b, a)
     #endif
```

**File**: `Tests/DynamicColor+RGBATests.swift` (modified, +13/-7)
```diff
@@ -36,13 +36,19 @@ class DynamicColorRGBATests: XCTestCase {
   }
 
   func testToRGBAComponents() {
-    let customColor = DynamicColor(red: 0.23, green: 0.46, blue: 0.32, alpha: 1)
-
-    let rgba = customColor.toRGBAComponents()
-    XCTAssert(rgba.r == 0.23, "Color red component should be equal to 0.23")
-    XCTAssert(rgba.g == 0.46, "Color green component should be equal to 0.46")
-    XCTAssert(rgba.b == 0.32, "Color blue component should be equal to 0.32")
-    XCTAssert(rgba.a == 1, "Color alpha component should be equal to 1")
+    let rgbaColor = DynamicColor(red: 0.23, green: 0.46, blue: 0.32, alpha: 1)
+    let rgba1 = rgbaColor.toRGBAComponents()
+    XCTAssertEqual(rgba1.r, 0.23)
+    XCTAssertEqual(rgba1.g, 0.46)
+    XCTAssertEqual(rgba1.b, 0.32)
+    XCTAssertEqual(rgba1.a, 1.00)
+
+    let grayscaleColor = DynamicColor(white: 0.42, alpha: 1)
+    let rgba2 = grayscaleColor.toRGBAComponents()
+    XCTAssertEqual(rgba2.r, 0.42, accuracy: 0.001)
+    XCTAssertEqual(rgba2.g, 0.42, accuracy: 0.001)
+    XCTAssertEqual(rgba2.b, 0.42, accuracy: 0.001)
+    XCTAssertEqual(rgba2.a, 1.00, accuracy: 0.001)
   }
 
   func testRedComponent() {
```

---

### Incident Patch 5: `d5612253` (2020-01-20)
**Commit Message**: Merge pull request #54 from regexident/fix-typo

Fix typo ("mininimum" -> "minimum")

**File**: `Sources/HSL.swift` (modified, +5/-5)
```diff
@@ -67,20 +67,20 @@ internal struct HSL {
     let rgba = color.toRGBAComponents()
 
     let maximum   = max(rgba.r, max(rgba.g, rgba.b))
-    let mininimum = min(rgba.r, min(rgba.g, rgba.b))
+    let minimum = min(rgba.r, min(rgba.g, rgba.b))
 
-    let delta = maximum - mininimum
+    let delta = maximum - minimum
 
     h = 0.0
     s = 0.0
-    l = (maximum + mininimum) / 2.0
+    l = (maximum + minimum) / 2.0
 
     if delta != 0.0 {
       if l < 0.5 {
-        s = delta / (maximum + mininimum)
+        s = delta / (maximum + minimum)
       }
       else {
-        s = delta / (2.0 - maximum - mininimum)
+        s = delta / (2.0 - maximum - minimum)
       }
 
       if rgba.r == maximum {
```

---

### Incident Patch 6: `04f7891d` (2020-01-13)
**Commit Message**: Fix `final func toRGBAComponents()` on macOS for non-RGB colors

**File**: `Sources/DynamicColor+RGBA.swift` (modified, +3/-6)
```diff
@@ -62,14 +62,11 @@ public extension DynamicColor {
 
       return (r, g, b, a)
     #elseif os(OSX)
-      if isEqual(DynamicColor.black) {
-        return (0, 0, 0, 0)
-      }
-      else if isEqual(DynamicColor.white) {
-        return (1, 1, 1, 1)
+      guard let rgbaColor = self.usingColorSpace(.deviceRGB) else {
+        fatalError("Could not convert color to RGBA.")
       }
 
-      getRed(&r, green: &g, blue: &b, alpha: &a)
+      rgbaColor.getRed(&r, green: &g, blue: &b, alpha: &a)
 
       return (r, g, b, a)
     #endif
```

---

### Incident Patch 7: `1d3c3d4b` (2020-01-13)
**Commit Message**: Fix typo ("mininimum" -> "minimum")

**File**: `Sources/HSL.swift` (modified, +5/-5)
```diff
@@ -67,20 +67,20 @@ internal struct HSL {
     let rgba = color.toRGBAComponents()
 
     let maximum   = max(rgba.r, max(rgba.g, rgba.b))
-    let mininimum = min(rgba.r, min(rgba.g, rgba.b))
+    let minimum = min(rgba.r, min(rgba.g, rgba.b))
 
-    let delta = maximum - mininimum
+    let delta = maximum - minimum
 
     h = 0.0
     s = 0.0
-    l = (maximum + mininimum) / 2.0
+    l = (maximum + minimum) / 2.0
 
     if delta != 0.0 {
       if l < 0.5 {
-        s = delta / (maximum + mininimum)
+        s = delta / (maximum + minimum)
       }
       else {
-        s = delta / (2.0 - maximum - mininimum)
+        s = delta / (2.0 - maximum - minimum)
       }
 
       if rgba.r == maximum {
```

---

### Incident Patch 8: `5b74f7d2` (2019-12-24)
**Commit Message**: Fix the access modifier

**File**: `Sources/SwiftUIColor.swift` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
 import SwiftUI
 
 @available(iOS 13.0, tvOS 13.0, watchOS 6.0, macOS 10.15, *)
-extension Color {
+public extension Color {
   // MARK: - Manipulating Hexa-decimal Values and Strings
 
   /**
```

---

### Incident Patch 9: `b310ab1d` (2019-12-24)
**Commit Message**: Add basic SwiftUI color support

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 # Change log
 
+## [Version 5.0.0](https://github.com/yannickl/DynamicColor/releases/tag/5.0.0)
+*Released on 2019-12-24.*
+
+- [ADD] Basic SwiftUI color support
+
 ## [Version 4.1.1](https://github.com/yannickl/DynamicColor/releases/tag/4.2.0)
 *Released on 2019-09-15.*
 
```

**File**: `Examples/DynamicColorExample.xcodeproj/project.pbxproj` (modified, +14/-0)
```diff
@@ -112,6 +112,12 @@
 		CEFBDAE81B1CE38D000E6F30 /* Images.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = CEFBDAE71B1CE38D000E6F30 /* Images.xcassets */; };
 		CEFBDAEB1B1CE38D000E6F30 /* LaunchScreen.xib in Resources */ = {isa = PBXBuildFile; fileRef = CEFBDAE91B1CE38D000E6F30 /* LaunchScreen.xib */; };
 		CEFBDB191B1DE220000E6F30 /* ColorCellView.swift in Sources */ = {isa = PBXBuildFile; fileRef = CEFBDB181B1DE220000E6F30 /* ColorCellView.swift */; };
+		F401F80023B242B7008FB683 /* SwiftUIColor.swift in Sources */ = {isa = PBXBuildFile; fileRef = F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */; };
+		F401F80123B242B7008FB683 /* SwiftUIColor.swift in Sources */ = {isa = PBXBuildFile; fileRef = F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */; };
+		F401F80223B242B7008FB683 /* SwiftUIColor.swift in Sources */ = {isa = PBXBuildFile; fileRef = F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */; };
+		F401F80323B242B7008FB683 /* SwiftUIColor.swift in Sources */ = {isa = PBXBuildFile; fileRef = F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */; };
+		F401F80423B242B7008FB683 /* SwiftUIColor.swift in Sources */ = {isa = PBXBuildFile; fileRef = F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */; };
+		F401F80523B242B7008FB683 /* SwiftUIColor.swift in Sources */ = {isa = PBXBuildFile; fileRef = F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -211,6 +217,7 @@
 		CEFBDAE71B1CE38D000E6F30 /* Images.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Images.xcassets; sourceTree = "<group>"; };
 		CEFBDAEA1B1CE38D000E6F30 /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.xib; name = Base; path = Base.lproj/LaunchScreen.xib; sourceTree = "<group>"; };
 		CEFBDB181B1DE220000E6F30 /* ColorCellView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ColorCellView.swift; sourceTree = "<group>"; };
+		F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SwiftUIColor.swift; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -373,6 +380,7 @@
 				CE4E1EFB1D818AB100D2AC35 /* DynamicGradient.swift */,
 				CEF85A241C84EA5B00DD1A49 /* HSL.swift */,
 				CE5D647A1D35074B005DEE4E /* Utils.swift */,
+				F401F7FF23B242B7008FB683 /* SwiftUIColor.swift */,
 			);
 			name = Sources;
 			path = ../Sources;
@@ -726,6 +734,7 @@
 				CE86889A1E2C165D00207CAC /* DynamicColorSpace.swift in Sources */,
 				CE8688921E2C165D00207CAC /* DynamicColor.swift in Sources */,
 				CE86889C1E2C165D00207CAC /* HSL.swift in Sources */,
+				F401F80123B242B7008FB683 /* SwiftUIColor.swift in Sources */,
 				CE8688981E2C165D00207CAC /* DynamicColor+RGBA.swift in Sources */,
 				CE8688961E2C165D00207CAC /* DynamicColor+Lab.swift in Sources */,
 				CE8688901E2C165D00207CAC /* Array.swift in Sources */,
@@ -747,6 +756,7 @@
 				CE8688BA1E2C1AF700207CAC /* DynamicColorSpace.swift in Sources */,
 				CE8688B21E2C1AF700207CAC /* DynamicColor.swift in Sources */,
 				CE8688BC1E2C1AF700207CAC /* HSL.swift in Sources */,
+				F401F80223B242B7008FB683 /* SwiftUIColor.swift in Sources */,
 				CE8688B81E2C1AF700207CAC /* DynamicColor+RGBA.swift in Sources */,
 				CE8688B61E2C1AF700207CAC /* DynamicColor+Lab.swift in Sources */,
 				CE8688B01E2C1AF700207CAC /* Array.swift in Sources */,
@@ -768,6 +778,7 @@
 				CE8688D51E2C1B4800207CAC /* DynamicColorSpace.swift in Sources */,
 				CE8688CD1E2C1B4800207CAC /* DynamicColor.swift in Sources */,
 				CE8688D71E2C1B4800207CAC /* HSL.swift in Sources */,
+				F401F80323B242B7008FB683 /* SwiftUIColor.swift in Sources */,
 				CE8688D31E2C1B4800207CAC /* DynamicColor+RGBA.swift in Sources */,
 				CE8688D11E2C1B4800207CAC /* DynamicColor+Lab.swift in Sources */,
 				CE8688CB1E2C1B4800207CAC /* Array.swift in Sources */,
@@ -789,6 +800,7 @@
 				CE4E1F051D819AEC00D2AC35 /* DynamicColorSpace.swift in Sources */,
 				CE5D647B1D35074B005DEE4E /* Utils.swift in Sources */,
 				CE8B86551D2991F000C5A670 /* DynamicColor+XYZ.swift in Sources */,
+				F401F80023B242B7008FB683 /* SwiftUIColor.swift in Sources */,
 				CEAF67871CA2D22E008DC3A2 /* DynamicColor+Deriving.swift in Sources */,
 				CEF85A261C84EA5B00DD1A49 /* HSL.swift in Sources */,
 				CE1BD0811DEA01E500E11D77 /* ContrastDisplayContext.swift in Sources */,
@@ -807,6 +819,7 @@
 				CE5D64831D35230E005DEE4E /* DynamicColor+Lab.swift in Sources */,
 				CEEB28E01BE27401001A74E8 /* ColorCellView.swift in Sources */,
 				CEBD6FEE1D81CD9D00D75349 /* HeaderView.swift in Sources */,
+				F401F80523B242B7008FB683 /* SwiftUIColor.swift in Sources */,
 				CE4E1F071D819AEC00D2AC35 /* DynamicColorSpace.swift in Sources */,
 				CE5D647D1D35074B005DEE4E /* Utils.swift in Sources */,
 				CEAF67891CA2D22E008DC3A2 /* DynamicColor+Deriving.swift in Sources *
```

**File**: `Sources/DynamicColor.swift` (modified, +9/-12)
```diff
@@ -55,16 +55,13 @@ public extension DynamicColor {
    - parameter hexString: A hexa-decimal color string representation.
    */
   convenience init(hexString: String) {
-    let hexString = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
-    let scanner   = Scanner(string: hexString)
+    let hexString                 = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
+    let scanner                   = Scanner(string: hexString)
+    scanner.charactersToBeSkipped = CharacterSet(charactersIn: "#")
 
-    if hexString.hasPrefix("#") {
-      scanner.scanLocation = 1
-    }
-
-    var color: UInt32 = 0
+    var color: UInt64 = 0
 
-    if scanner.scanHexInt32(&color) {
+    if scanner.scanHexInt64(&color) {
       self.init(hex: color, useAlpha: hexString.count > 7)
     }
     else {
@@ -75,11 +72,11 @@ public extension DynamicColor {
   /**
    Creates a color from an hex integer (e.g. 0x3498db).
 
-   - parameter hex: A hexa-decimal UInt32 that represents a color.
-   - parameter alphaChannel: If true the given hex-decimal UInt32 includes the alpha channel (e.g. 0xFF0000FF).
+   - parameter hex: A hexa-decimal UInt64 that represents a color.
+   - parameter alphaChannel: If true the given hex-decimal UInt64 includes the alpha channel (e.g. 0xFF0000FF).
    */
-  convenience init(hex: UInt32, useAlpha alphaChannel: Bool = false) {
-    let mask      = UInt32(0xFF)
+  convenience init(hex: UInt64, useAlpha alphaChannel: Bool = false) {
+    let mask      = UInt64(0xFF)
     let cappedHex = !alphaChannel && hex > 0xffffff ? 0xffffff : hex
 
     let r = cappedHex >> (alphaChannel ? 24 : 16) & mask
```

**File**: `Sources/SwiftUIColor.swift` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+/*
+ * DynamicColor
+ *
+ * Copyright 2015-present Yannick Loriot.
+ * http://yannickloriot.com
+ *
+ * Permission is hereby granted, free of charge, to any person obtaining a copy
+ * of this software and associated documentation files (the "Software"), to deal
+ * in the Software without restriction, including without limitation the rights
+ * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+ * copies of the Software, and to permit persons to whom the Software is
+ * furnished to do so, subject to the following conditions:
+ *
+ * The above copyright notice and this permission notice shall be included in
+ * all copies or substantial portions of the Software.
+ *
+ * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+ * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+ * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+ * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+ * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+ * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
+ * THE SOFTWARE.
+ *
+ */
+
+import SwiftUI
+
+@available(iOS 13.0, tvOS 13.0, watchOS 6.0, macOS 10.15, *)
+extension Color {
+  // MARK: - Manipulating Hexa-decimal Values and Strings
+
+  /**
+   Creates a color from an hex string (e.g. "#3498db"). The RGBA string are also supported (e.g. "#3498dbff").
+
+   If the given hex string is invalid the initialiser will create a black color.
+
+   - parameter hexString: A hexa-decimal color string representation.
+   */
+  init(hexString: String) {
+    let hexString                 = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
+    let scanner                   = Scanner(string: hexString)
+    scanner.charactersToBeSkipped = CharacterSet(charactersIn: "#")
+
+    var color: UInt64 = 0
+
+    if scanner.scanHexInt64(&color) {
+      self.init(hex: color, useOpacity: hexString.count > 7)
+    }
+    else {
+      self.init(hex: 0x000000)
+    }
+  }
+
+  /**
+   Creates a color from an hex integer (e.g. 0x3498db).
+
+   - parameter hex: A hexa-decimal UInt64 that represents a color.
+   - parameter opacityChannel: If true the given hex-decimal UInt64 includes the opacity channel (e.g. 0xFF0000FF).
+   */
+  init(hex: UInt64, useOpacity opacityChannel: Bool = false) {
+    let mask      = UInt64(0xFF)
+    let cappedHex = !opacityChannel && hex > 0xffffff ? 0xffffff : hex
+
+    let r = cappedHex >> (opacityChannel ? 24 : 16) & mask
+    let g = cappedHex >> (opacityChannel ? 16 : 8) & mask
+    let b = cappedHex >> (opacityChannel ? 8 : 0) & mask
+    let o = opacityChannel ? cappedHex & mask : 255
+
+    let red     = Double(r) / 255.0
+    let green   = Double(g) / 255.0
+    let blue    = Double(b) / 255.0
+    let opacity = Double(o) / 255.0
+
+    self.init(red: red, green: green, blue: blue, opacity: opacity)
+  }
+}
```

---

### Incident Patch 10: `c6fcc172` (2019-10-05)
**Commit Message**: Fix typo in README.md

**File**: `README.md` (modified, +1/-1)
```diff
@@ -165,7 +165,7 @@ let mixedColor = originalColor.mixed(withColor: .blue)
 
 #### Gradients
 
-**DynamicColor** provides an useful object to work with gradients: **DynamicGradient**. It'll allow you to pick color from gradients, or to build to build a palette using different color spaces (.e.g.: *RGB*, *HSL*, *HSB*, *Cie L\*a\*b\**).
+**DynamicColor** provides an useful object to work with gradients: **DynamicGradient**. It'll allow you to pick color from gradients, or to build a palette using different color spaces (.e.g.: *RGB*, *HSL*, *HSB*, *Cie L\*a\*b\**).
 
 Let's define our reference colors and the gradient object:
 ```swift
```

---

### Incident Patch 11: `68fe9c6f` (2019-09-15)
**Commit Message**: Fix dependency manager configs

**File**: `.swift-version` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-5
\ No newline at end of file
```

**File**: `.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Workspace
+   version = "1.0">
+   <FileRef
+      location = "self:">
+   </FileRef>
+</Workspace>
```

**File**: `.swiftpm/xcode/package.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>IDEDidComputeMac32BitWarning</key>
+	<true/>
+</dict>
+</plist>
```

**File**: `DynamicColor.podspec` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@ Pod::Spec.new do |s|
   s.name             = 'DynamicColor'
   s.version          = '4.2.0'
   s.license          = 'MIT'
+  s.swift_version    = ['5.0', '5.1']
   s.summary          = 'Yet another extension to manipulate colors easily in Swift (UIColor and NSColor)'
   s.homepage         = 'https://github.com/yannickl/DynamicColor.git'
   s.social_media_url = 'https://twitter.com/yannickloriot'
```

**File**: `Package.swift` (modified, +15/-26)
```diff
@@ -1,31 +1,20 @@
-//
-// DynamicColor
-//
-// Copyright 2015-present Yannick Loriot.
-// http://yannickloriot.com
-//
-// Permission is hereby granted, free of charge, to any person obtaining a copy
-// of this software and associated documentation files (the "Software"), to deal
-// in the Software without restriction, including without limitation the rights
-// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
-// copies of the Software, and to permit persons to whom the Software is
-// furnished to do so, subject to the following conditions:
-//
-// The above copyright notice and this permission notice shall be included in
-// all copies or substantial portions of the Software.
-//
-// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
-// THE SOFTWARE.
-//
-
+// swift-tools-version:5.0
 import PackageDescription
 
 let package = Package(
-  name: "DynamicColor"
+  name: "DynamicColor",
+  products: [
+    .library(name: "DynamicColor", targets: ["DynamicColor"]),
+  ],
+  targets: [
+    .target(
+      name: "DynamicColor",
+      dependencies: [],
+      path: "Sources"),
+    .testTarget(
+      name: "DynamicColorTests",
+      dependencies: ["DynamicColor"],
+      path: "Tests"),
+  ]
 )
 
```

---

### Incident Patch 12: `79048e2f` (2019-09-14)
**Commit Message**: Fix the mathematical operator precedence overload #51

**File**: `Sources/DynamicColor+Lab.swift` (modified, +5/-5)
```diff
@@ -49,12 +49,12 @@ public extension DynamicColor {
     let clippedB = clip(b, -128, 127)
 
     let normalized = { (c: CGFloat) -> CGFloat in
-      pow(c, 3) > 0.008856 ? pow(c, 3) : (c - 16 / 116) / 7.787
+      pow(c, 3) > 0.008856 ? pow(c, 3) : (c - (16 / 116)) / 7.787
     }
 
     let preY = (clippedL + 16) / 116
-    let preX = clippedA / 500 + preY
-    let preZ = preY - clippedB / 200
+    let preX = (clippedA / 500) + preY
+    let preZ = preY - (clippedB / 200)
 
     let X = 95.05 * normalized(preX)
     let Y = 100 * normalized(preY)
@@ -75,15 +75,15 @@ public extension DynamicColor {
    */
   final func toLabComponents() -> (L: CGFloat, a: CGFloat, b: CGFloat) {
     let normalized = { (c: CGFloat) -> CGFloat in
-      c > 0.008856 ? pow(c, 1.0 / 3) : 7.787 * c + 16.0 / 116
+      c > 0.008856 ? pow(c, 1.0 / 3) : (7.787 * c) + (16.0 / 116)
     }
 
     let xyz         = toXYZComponents()
     let normalizedX = normalized(xyz.X / 95.05)
     let normalizedY = normalized(xyz.Y / 100)
     let normalizedZ = normalized(xyz.Z / 108.9)
 
-    let L = roundDecimal(116 * normalizedY - 16, precision: 1000)
+    let L = roundDecimal((116 * normalizedY) - 16, precision: 1000)
     let a = roundDecimal(500 * (normalizedX - normalizedY), precision: 1000)
     let b = roundDecimal(200 * (normalizedY - normalizedZ), precision: 1000)
 
```

**File**: `Sources/DynamicColor+Mixing.swift` (modified, +16/-16)
```diff
@@ -86,10 +86,10 @@ public extension DynamicColor {
     let c1 = toLabComponents()
     let c2 = color.toLabComponents()
 
-    let L     = c1.L + weight * (c2.L - c1.L)
-    let a     = c1.a + weight * (c2.a - c1.a)
-    let b     = c1.b + weight * (c2.b - c1.b)
-    let alpha = alphaComponent + weight * (color.alphaComponent - alphaComponent)
+    let L     = c1.L + (weight * (c2.L - c1.L))
+    let a     = c1.a + (weight * (c2.a - c1.a))
+    let b     = c1.b + (weight * (c2.b - c1.b))
+    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))
 
     return DynamicColor(L: L, a: a, b: b, alpha: alpha)
   }
@@ -98,10 +98,10 @@ public extension DynamicColor {
     let c1 = toHSLComponents()
     let c2 = color.toHSLComponents()
 
-    let h     = c1.h + weight * mixedHue(source: c1.h, target: c2.h)
-    let s     = c1.s + weight * (c2.s - c1.s)
-    let l     = c1.l + weight * (c2.l - c1.l)
-    let alpha = alphaComponent + weight * (color.alphaComponent - alphaComponent)
+    let h     = c1.h + (weight * mixedHue(source: c1.h, target: c2.h))
+    let s     = c1.s + (weight * (c2.s - c1.s))
+    let l     = c1.l + (weight * (c2.l - c1.l))
+    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))
 
     return DynamicColor(hue: h, saturation: s, lightness: l, alpha: alpha)
   }
@@ -110,10 +110,10 @@ public extension DynamicColor {
     let c1 = toHSBComponents()
     let c2 = color.toHSBComponents()
 
-    let h     = c1.h + weight * mixedHue(source: c1.h, target: c2.h)
-    let s     = c1.s + weight * (c2.s - c1.s)
-    let b     = c1.b + weight * (c2.b - c1.b)
-    let alpha = alphaComponent + weight * (color.alphaComponent - alphaComponent)
+    let h     = c1.h + (weight * mixedHue(source: c1.h, target: c2.h))
+    let s     = c1.s + (weight * (c2.s - c1.s))
+    let b     = c1.b + (weight * (c2.b - c1.b))
+    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))
 
     return DynamicColor(hue: h, saturation: s, brightness: b, alpha: alpha)
   }
@@ -122,10 +122,10 @@ public extension DynamicColor {
     let c1 = toRGBAComponents()
     let c2 = color.toRGBAComponents()
 
-    let red   = c1.r + weight * (c2.r - c1.r)
-    let green = c1.g + weight * (c2.g - c1.g)
-    let blue  = c1.b + weight * (c2.b - c1.b)
-    let alpha = alphaComponent + weight * (color.alphaComponent - alphaComponent)
+    let red   = c1.r + (weight * (c2.r - c1.r))
+    let green = c1.g + (weight * (c2.g - c1.g))
+    let blue  = c1.b + (weight * (c2.b - c1.b))
+    let alpha = alphaComponent + (weight * (color.alphaComponent - alphaComponent))
 
     return DynamicColor(red: red, green: green, blue: blue, alpha: alpha)
   }
```

**File**: `Sources/DynamicColor+XYZ.swift` (modified, +6/-6)
```diff
@@ -54,9 +54,9 @@ public extension DynamicColor {
       return abs(roundDecimal(rgb, precision: 1000))
     }
 
-    let red   = toRGB(clippedX * 3.2406 + clippedY * -1.5372 + clippedZ * -0.4986)
-    let green = toRGB(clippedX * -0.9689 + clippedY * 1.8758 + clippedZ * 0.0415)
-    let blue  = toRGB(clippedX * 0.0557 + clippedY * -0.2040 + clippedZ * 1.0570)
+    let red   = toRGB((clippedX * 3.2406) + (clippedY * -1.5372) + (clippedZ * -0.4986))
+    let green = toRGB((clippedX * -0.9689) + (clippedY * 1.8758) + (clippedZ * 0.0415))
+    let blue  = toRGB((clippedX * 0.0557) + (clippedY * -0.2040) + (clippedZ * 1.0570))
 
     self.init(red: red, green: green, blue: blue, alpha: alpha)
   }
@@ -80,9 +80,9 @@ public extension DynamicColor {
     let green = toSRGB(rgba.g)
     let blue  = toSRGB(rgba.b)
 
-    let X = roundDecimal((red * 0.4124 + green * 0.3576 + blue * 0.1805) * 100, precision: 1000)
-    let Y = roundDecimal((red * 0.2126 + green * 0.7152 + blue * 0.0722) * 100, precision: 1000)
-    let Z = roundDecimal((red * 0.0193 + green * 0.1192 + blue * 0.9505) * 100, precision: 1000)
+    let X = roundDecimal(((red * 0.4124) + (green * 0.3576) + (blue * 0.1805)) * 100, precision: 1000)
+    let Y = roundDecimal(((red * 0.2126) + (green * 0.7152) + (blue * 0.0722)) * 100, precision: 1000)
+    let Z = roundDecimal(((red * 0.0193) + (green * 0.1192) + (blue * 0.9505)) * 100, precision: 1000)
 
     return (X: X, Y: Y, Z: Z)
   }
```

**File**: `Sources/HSL.swift` (modified, +8/-8)
```diff
@@ -84,13 +84,13 @@ internal struct HSL {
       }
 
       if rgba.r == maximum {
-        h = (rgba.g - rgba.b) / delta + (rgba.g < rgba.b ? 6 : 0)
+        h = ((rgba.g - rgba.b) / delta) + (rgba.g < rgba.b ? 6 : 0)
       }
       else if rgba.g == maximum {
-        h = (rgba.b - rgba.r) / delta + 2
+        h = ((rgba.b - rgba.r) / delta) + 2
       }
       else if rgba.b == maximum {
-        h = (rgba.r - rgba.g) / delta + 4
+        h = ((rgba.r - rgba.g) / delta) + 4
       }
     }
 
@@ -109,9 +109,9 @@ internal struct HSL {
     let m2 = l <= 0.5 ? l * (s + 1) : (l + s) - (l * s)
     let m1 = (l * 2) - m2
 
-    let r = hueToRGB(m1: m1, m2: m2, h: h + 1 / 3)
+    let r = hueToRGB(m1: m1, m2: m2, h: h + (1 / 3))
     let g = hueToRGB(m1: m1, m2: m2, h: h)
-    let b = hueToRGB(m1: m1, m2: m2, h: h - 1 / 3)
+    let b = hueToRGB(m1: m1, m2: m2, h: h - (1 / 3))
 
     return DynamicColor(red: r, green: g, blue: b, alpha: CGFloat(a))
   }
@@ -121,13 +121,13 @@ internal struct HSL {
     let hue = moda(h, m: 1)
 
     if hue * 6 < 1 {
-      return m1 + (m2 - m1) * hue * 6
+      return m1 + ((m2 - m1) * hue * 6)
     }
     else if hue * 2 < 1 {
       return CGFloat(m2)
     }
     else if hue * 3 < 1.9999 {
-      return m1 + (m2 - m1) * (2 / 3 - hue) * 6
+      return m1 + ((m2 - m1) * (2 / 3 - hue) * 6)
     }
 
     return CGFloat(m1)
@@ -142,7 +142,7 @@ internal struct HSL {
   - returns: A HSL color with the hue changed.
   */
   func adjustedHue(amount: CGFloat) -> HSL {
-    return HSL(hue: h * 360 + amount, saturation: s, lightness: l, alpha: a)
+    return HSL(hue: (h * 360) + amount, saturation: s, lightness: l, alpha: a)
   }
 
   /**
```

---

### Incident Patch 13: `9070b3a7` (2019-05-27)
**Commit Message**: Fix Xcode 10.2 warnings

**File**: `.swift-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-4.2
+5
\ No newline at end of file
```

**File**: `.travis.yml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 language: objective-c
-osx_image: xcode9
+osx_image: xcode10.2
 script:
   - brew install swiftlint || brew upgrade swiftlint
   - swiftlint lint --path Sources/ --config ../.swiftlint.yml
```

**File**: `Examples/DynamicColorExample.xcodeproj/project.pbxproj` (modified, +19/-19)
```diff
@@ -702,7 +702,7 @@
 						CreatedOnToolsVersion = 6.3.2;
 						DevelopmentTeam = 5SJ773RP6R;
 						DevelopmentTeamName = "Work And Play";
-						LastSwiftMigration = 1000;
+						LastSwiftMigration = 1020;
 					};
 					CEE753C91BF105E3001FF6ED = {
 						CreatedOnToolsVersion = 7.1;
@@ -714,13 +714,13 @@
 					CEFBDADA1B1CE38D000E6F30 = {
 						CreatedOnToolsVersion = 6.3.2;
 						DevelopmentTeamName = "Work And Play";
-						LastSwiftMigration = 1000;
+						LastSwiftMigration = 1020;
 					};
 				};
 			};
 			buildConfigurationList = CEFBDAD61B1CE38D000E6F30 /* Build configuration list for PBXProject "DynamicColorExample" */;
 			compatibilityVersion = "Xcode 8.0";
-			developmentRegion = English;
+			developmentRegion = en;
 			hasScannedForEncodings = 0;
 			knownRegions = (
 				en,
@@ -1079,7 +1079,7 @@
 				SDKROOT = macosx;
 				SKIP_INSTALL = YES;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
 			};
@@ -1108,7 +1108,7 @@
 				SDKROOT = macosx;
 				SKIP_INSTALL = YES;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
 			};
@@ -1135,7 +1135,7 @@
 				SDKROOT = appletvos;
 				SKIP_INSTALL = YES;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 3;
 				TVOS_DEPLOYMENT_TARGET = 9.0;
 				VERSIONING_SYSTEM = "apple-generic";
@@ -1163,7 +1163,7 @@
 				SDKROOT = appletvos;
 				SKIP_INSTALL = YES;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 3;
 				TVOS_DEPLOYMENT_TARGET = 9.0;
 				VERSIONING_SYSTEM = "apple-generic";
@@ -1193,7 +1193,7 @@
 				SDKROOT = watchos;
 				SKIP_INSTALL = YES;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 4;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
@@ -1222,7 +1222,7 @@
 				SDKROOT = watchos;
 				SKIP_INSTALL = YES;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 4;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
@@ -1246,7 +1246,7 @@
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
 				SWIFT_SWIFT3_OBJC_INFERENCE = On;
-				SWIFT_VERSION = 4.2;
+				SWIFT_VERSION = 5.0;
 			};
 			name = Debug;
 		};
@@ -1265,7 +1265,7 @@
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
 				SWIFT_SWIFT3_OBJC_INFERENCE = On;
-				SWIFT_VERSION = 4.2;
+				SWIFT_VERSION = 5.0;
 			};
 			name = Release;
 		};
@@ -1290,7 +1290,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = "com.yannickloriot.$(PRODUCT_NAME:rfc1034identifier)";
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SKIP_INSTALL = YES;
-				SWIFT_VERSION = 4.2;
+				SWIFT_VERSION = 5.0;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
 			};
@@ -1314,7 +1314,7 @@
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SKIP_INSTALL = YES;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
-				SWIFT_VERSION = 4.2;
+				SWIFT_VERSION = 5.0;
 				VERSIONING_SYSTEM = "apple-generic";
 				VERSION_INFO_PREFIX = "";
 			};
@@ -1334,7 +1334,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.OSXTests;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = macosx;
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 			};
 			name = Debug;
 		};
@@ -1352,7 +1352,7 @@
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = macosx;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 			};
 			name = Release;
 		};
@@ -1368,7 +1368,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = com.yannickloriot.TVExample;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = appletvos;
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 3;
 				TVOS_DEPLOYMENT_TARGET = 9.0;
 			};
@@ -1386,7 +1386,7 @@
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SDKROOT = appletvos;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
-				SWIFT_VERSION = 3.0;
+				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = 3;
 				TVOS_DEPLOYMENT_TARGET = 9.0;
 			};
@@ -1512,7 +1512,7 @@
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
 				PRODUCT_BUNDLE_IDENTIFIER = "com.yannickloriot.$(PRODUCT_NAME:rfc1034identifier)";
 				PRODUCT_NAME = DynamicColorExample;
-				SWIFT_VERSION = 4.2;
+				SWIFT_VERSION = 5.0;
 			};
 			name = Debug;
 		};
@@ -1527,7 +1527,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = "com.yannickloriot.$(PRODUCT_NAME:rfc1034identifier)";
 				PRODUCT_NAME = DynamicColorExample;
 				SWIFT_OPTIMIZATION_LEVEL = "-Owholemodule";
-				SWIFT_VERSION = 4.2;
+				SWIFT_
```

**File**: `Examples/tvOSExample/AppDelegate.swift` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ import UIKit
 class AppDelegate: UIResponder, UIApplicationDelegate {
   var window: UIWindow?
 
-  func application(_ application: UIApplication, willFinishLaunchingWithOptions launchOptions: [UIApplicationLaunchOptionsKey : Any]? = nil) -> Bool {
+  func application(_ application: UIApplication, willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
     // Override point for customization after application launch.
     return true
   }
```

**File**: `Sources/Array.swift` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ public extension Array where Element: DynamicColor {
   /**
    Gradient representation of the array.
    */
-  public var gradient: DynamicGradient {
+  var gradient: DynamicGradient {
     return DynamicGradient(colors: self)
   }
 }
```

**File**: `Sources/DynamicColor+Deriving.swift` (modified, +8/-8)
```diff
@@ -39,7 +39,7 @@ public extension DynamicColor {
    - parameter amount: A float representing the number of degrees as ratio (usually between -360.0 degree and 360.0 degree).
    - returns: A DynamicColor object with the hue changed.
    */
-  public final func adjustedHue(amount: CGFloat) -> DynamicColor {
+  final func adjustedHue(amount: CGFloat) -> DynamicColor {
     return HSL(color: self).adjustedHue(amount: amount).toDynamicColor()
   }
 
@@ -51,7 +51,7 @@ public extension DynamicColor {
    - returns: The complement DynamicColor.
    - seealso: adjustedHueColor:
    */
-  public final func complemented() -> DynamicColor {
+  final func complemented() -> DynamicColor {
     return adjustedHue(amount: 180)
   }
 
@@ -61,7 +61,7 @@ public extension DynamicColor {
    - parameter amount: CGFloat between 0.0 and 1.0. Default value is 0.2.
    - returns: A lighter DynamicColor.
    */
-  public final func lighter(amount: CGFloat = 0.2) -> DynamicColor {
+  final func lighter(amount: CGFloat = 0.2) -> DynamicColor {
     return HSL(color: self).lighter(amount: amount).toDynamicColor()
   }
 
@@ -71,7 +71,7 @@ public extension DynamicColor {
    - parameter amount: Float between 0.0 and 1.0. Default value is 0.2.
    - returns: A darker DynamicColor.
    */
-  public final func darkened(amount: CGFloat = 0.2) -> DynamicColor {
+  final func darkened(amount: CGFloat = 0.2) -> DynamicColor {
     return HSL(color: self).darkened(amount: amount).toDynamicColor()
   }
 
@@ -82,7 +82,7 @@ public extension DynamicColor {
 
    - returns: A DynamicColor more saturated.
    */
-  public final func saturated(amount: CGFloat = 0.2) -> DynamicColor {
+  final func saturated(amount: CGFloat = 0.2) -> DynamicColor {
     return HSL(color: self).saturated(amount: amount).toDynamicColor()
   }
 
@@ -92,7 +92,7 @@ public extension DynamicColor {
    - parameter amount: CGFloat between 0.0 and 1.0. Default value is 0.2.
    - returns: A DynamicColor less saturated.
    */
-  public final func desaturated(amount: CGFloat = 0.2) -> DynamicColor {
+  final func desaturated(amount: CGFloat = 0.2) -> DynamicColor {
     return HSL(color: self).desaturated(amount: amount).toDynamicColor()
   }
 
@@ -104,7 +104,7 @@ public extension DynamicColor {
    - returns: A grayscale DynamicColor.
    - seealso: desaturateColor:
    */
-  public final func grayscaled() -> DynamicColor {
+  final func grayscaled() -> DynamicColor {
     return desaturated(amount: 1)
   }
 
@@ -113,7 +113,7 @@ public extension DynamicColor {
 
    - returns: An inverse (negative) of the original color.
    */
-  public final func inverted() -> DynamicColor {
+  final func inverted() -> DynamicColor {
     let rgba = toRGBAComponents()
 
     let invertedRed   = 1 - rgba.r
```

**File**: `Sources/DynamicColor+Lab.swift` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ public extension DynamicColor {
    - parameter b: The yellow-blue axis, specified as a value from -128.0 to 127.0.
    - parameter alpha: The opacity value of the color object, specified as a value from 0.0 to 1.0. Default to 1.0.
    */
-  public convenience init(L: CGFloat, a: CGFloat, b: CGFloat, alpha: CGFloat = 1) {
+  convenience init(L: CGFloat, a: CGFloat, b: CGFloat, alpha: CGFloat = 1) {
     let clippedL = clip(L, 0, 100)
     let clippedA = clip(a, -128, 127)
     let clippedB = clip(b, -128, 127)
@@ -73,7 +73,7 @@ public extension DynamicColor {
 
    - returns: The L*a*b* components as a tuple (L, a, b).
    */
-  public final func toLabComponents() -> (L: CGFloat, a: CGFloat, b: CGFloat) {
+  final func toLabComponents() -> (L: CGFloat, a: CGFloat, b: CGFloat) {
     let normalized = { (c: CGFloat) -> CGFloat in
       c > 0.008856 ? pow(c, 1.0 / 3) : 7.787 * c + 16.0 / 116
     }
```

**File**: `Sources/DynamicColor+Mixing.swift` (modified, +3/-3)
```diff
@@ -45,7 +45,7 @@ public extension DynamicColor {
    - Parameter colorspace: The color space used to mix the colors. By default it uses the RBG color space.
    - Returns: A color object corresponding to the two colors object mixed together.
    */
-  public final func mixed(withColor color: DynamicColor, weight: CGFloat = 0.5, inColorSpace colorspace: DynamicColorSpace = .rgb) -> DynamicColor {
+  final func mixed(withColor color: DynamicColor, weight: CGFloat = 0.5, inColorSpace colorspace: DynamicColorSpace = .rgb) -> DynamicColor {
     let normalizedWeight = clip(weight, 0, 1)
 
     switch colorspace {
@@ -66,7 +66,7 @@ public extension DynamicColor {
    - Parameter amount: Float between 0.0 and 1.0. The default amount is equal to 0.2.
    - Returns: A lighter DynamicColor.
    */
-  public final func tinted(amount: CGFloat = 0.2) -> DynamicColor {
+  final func tinted(amount: CGFloat = 0.2) -> DynamicColor {
     return mixed(withColor: .white, weight: amount)
   }
 
@@ -76,7 +76,7 @@ public extension DynamicColor {
    - Parameter amount: Float between 0.0 and 1.0. The default amount is equal to 0.2.
    - Returns: A darker DynamicColor.
    */
-  public final func shaded(amount: CGFloat = 0.2) -> DynamicColor {
+  final func shaded(amount: CGFloat = 0.2) -> DynamicColor {
     return mixed(withColor: DynamicColor(red: 0, green: 0, blue: 0, alpha: 1), weight: amount)
   }
 
```

---

### Incident Patch 14: `cf9478bb` (2017-12-05)
**Commit Message**: Fixes crash on iPhone 5

**File**: `Sources/DynamicColor.swift` (modified, +5/-5)
```diff
@@ -79,12 +79,12 @@ public extension DynamicColor {
    - parameter alphaChannel: If true the given hex-decimal UInt32 includes the alpha channel (e.g. 0xFF0000FF).
    */
   public convenience init(hex: UInt32, useAlpha alphaChannel: Bool = false) {
-    let mask = 0xFF
+    let mask = UInt32(0xFF)
 
-    let r = Int(hex >> (alphaChannel ? 24 : 16)) & mask
-    let g = Int(hex >> (alphaChannel ? 16 : 8)) & mask
-    let b = Int(hex >> (alphaChannel ? 8 : 0)) & mask
-    let a = alphaChannel ? Int(hex) & mask : 255
+    let r = hex >> (alphaChannel ? 24 : 16) & mask
+    let g = hex >> (alphaChannel ? 16 : 8) & mask
+    let b = hex >> (alphaChannel ? 8 : 0) & mask
+    let a = alphaChannel ? hex & mask : 255
 
     let red   = CGFloat(r) / 255
     let green = CGFloat(g) / 255
```

---

### Incident Patch 15: `9fed645d` (2017-11-16)
**Commit Message**: Fixes a crash when UIColor returns a color component with negative value

**File**: `Sources/DynamicColor.swift` (modified, +4/-0)
```diff
@@ -110,6 +110,10 @@ public extension DynamicColor {
    */
   public final func toHex() -> UInt32 {
     func roundToHex(_ x: CGFloat) -> UInt32 {
+      if x < 0 {
+        return UInt32(0)
+      }
+
       let rounded: CGFloat = round(x * 255)
 
       return UInt32(rounded)
```

#### Recent Merged Pull Requests:
- **PR #71** (closed): feat: support Prefix "0x" (@jimmy54)
- **PR #63** (2020-06-28): Second attempt at fixing release mode build problems (@richardgroves)
- **PR #62** (closed): Fixing a problem building in release modes (@richardgroves)
- **PR #56** (2020-01-22): Fix `final func toRGBAComponents()` on macOS for non-RGB colors (@regexident)
- **PR #55** (2020-01-25): Add support for grayscale modes (@regexident)
- **PR #54** (2020-01-20): Fix typo ("mininimum" -> "minimum") (@regexident)
- **PR #53** (2019-10-06): Fix typo in README.md (@dfrishbuter)
- **PR #52** (2019-10-06): Update SPM syntax with 4.2.1 (@landtanin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
