> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/shubham0812-swiftui-animations-learnings.md`  
> **Source**: github ([https://github.com/Shubham0812/SwiftUI-Animations](https://github.com/Shubham0812/SwiftUI-Animations))  
> **Source Version**: `494a3635`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T21:02:23.878Z  
> **Learning ID**: `learn-github-shubham0812-swiftui-animations`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Shubham0812/SwiftUI-Animations

> **Canonical Artifact**: `07_PROJECT_LEARNING/shubham0812-swiftui-animations-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Shubham0812/SwiftUI-Animations](https://github.com/Shubham0812/SwiftUI-Animations))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T21:02:23.647Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Shubham0812/SwiftUI-Animations`
- **Description**: A repository containing a variety of animations and Animated components created in SwiftUI that you can use in your own projects.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3581 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/DownloadButton/DownloadStateView.swift`
```
//
//  DownloadStateView.swift
//  SwiftUI-Animations
//
//  Created by Shubham on 09/04/21.
//  Copyright © 2021 Shubham Singh. All rights reserved.
//

import SwiftUI

/// A single visual panel representing one `DownloadState` inside `DownloadButton`.
///
/// Three instances of this view are stacked in `DownloadButton` — one per state —
/// and shown/hidden by animating their Y offsets (the slot-machine effect).
/// Each panel is responsible only for rendering its own state's appearance;
/// `DownloadButton` owns all the transition logic.
///
/// The optional progress bar at the bottom edge is only shown when
/// `needsProgress = true` (i.e. the `.downloading` panel).
struct DownloadStateView: View {

    // MARK: - Variables

    /// The `DownloadState` this panel represents.
    var state: DownloadState = .downloaded

    /// When `true`, renders a progress capsule along the bottom edge of the panel.
    var needsProgress: Bool = true

    /// When `true`, renders the label in white (for use on dark/colored backgrounds).
    var isLight: Bool = false

    /// Shared download state owner — used to check whether this panel is currently
    /// the active state, which controls label visibility and text offset.
    @Environment(Downloader.self) var downloader

    /// Download progress value from 0.0 to 1.0, bound from `DownloadButton`.
    @Binding var progress: CGFloat

    // MARK: - Views

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 0)
                .foregroundStyle(state.getBackground())

            Text(state.getStateName())
                .foregroundStyle(isLight ? .white : Color.background)
                .font(.system(size: 26, weight: .bold))
                .shadow(color: Color.white.opacity(0.3), radius: 5, y: 2)
                .opacity(downloader.currentState != state ? 0 : 1)
                .offset(x: downloader.currentState.offsetForText() + 26)
                .animation(.easeOut(duration: ButtonDimension.animationDuration / 2.25), value: downloader.currentState)
                .frame(alignment: .leading)

            if needsProgress {
                Capsule(style: .circular)
                    .trim(from: 0, to: progress / 2)
                    .stroke(lineWidth: 8)
                    .rotationEffect(.degrees(180))
                    .foregroundStyle(Color(hex: "25D366"))
                    .frame(width: ButtonDimension.width, height: 12)
                    .offset(y: ButtonDimension.height / 2 + 4.5)
                    .mask(
                        RoundedRectangle(cornerRadius: ButtonDimension.cornerRadius)
                            .frame(width: 320, height: 84)
                    )
                    .opacity(downloader.currentState != state ? 0 : 1)
                    .animation(.default, value: downloader.currentState)
            }
        }
        .frame(width: ButtonDimension.width, height: ButtonDimension.height)
    }
}

#Preview {
    DownloadStateView(progress: .constant(0))
        .environment(Downloader())
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/DownloadButton/Support/DownloadStateView.swift`
```
//
//  DownloadStateView.swift
//  SwiftUI-Animations
//
//  Created by Shubham on 09/04/21.
//  Copyright © 2021 Shubham Singh. All rights reserved.
//

import SwiftUI

/// A single visual panel representing one `DownloadState` inside `DownloadButton`.
///
/// Three instances are stacked and shown/hidden by animating their Y offsets (slot-machine effect).
/// Each panel renders only its own state's background and label; `DownloadButton` owns transitions.
/// The optional progress capsule at the bottom edge is only shown when `needsProgress = true`.
struct DownloadStateView: View {

    // MARK: - Variables

    /// The `DownloadState` this panel represents — drives background color and label text.
    var state: DownloadState = .downloaded
    /// When `true`, renders a progress capsule along the bottom edge (`.downloading` panel only).
    var needsProgress: Bool = true
    /// When `true`, renders the label in white; when `false`, uses `Color.background`.
    var isLight: Bool = false

    /// Shared download state — used to hide this panel's label when it is not the active state.
    @Environment(Downloader.self) var downloader
    /// Download progress 0→1 from `DownloadButton`.
    @Binding var progress: CGFloat

    // MARK: - Views

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 0)
                .foregroundStyle(state.getBackground())
            Text(state.getStateName())
                .foregroundStyle(isLight ? .white : Color.background)
                .font(.system(size: 26, weight: .bold))
                .shadow(color: Color.white.opacity(0.3), radius: 5, y: 2)
                .opacity(downloader.currentState != state ? 0 : 1)
                .offset(x: downloader.currentState.offsetForText() + 26)
                .animation(.easeOut(duration: ButtonDimension.animationDuration / 2.25), value: downloader.currentState)
                .frame(alignment: .leading)

            if needsProgress {
                Capsule(style: .circular)
                    .trim(from: 0, to: progress / 2)
                    .stroke(lineWidth: 8)
                    .rotationEffect(.degrees(180))
                    .foregroundStyle(Color(hex: "25D366"))
                    .frame(width: ButtonDimension.width, height: 12)
                    .offset(y: ButtonDimension.height / 2 + 4.5)
                    .mask(
                        RoundedRectangle(cornerRadius: ButtonDimension.cornerRadius)
                            .frame(width: 320, height: 84)
                    )
                    .opacity(downloader.currentState != state ? 0 : 1)
                    .animation(.default, value: downloader.currentState)
            }
        }
        .frame(width: ButtonDimension.width, height: ButtonDimension.height)
    }
}

#Preview {
    DownloadStateView(progress: .constant(0))
        .environment(Downloader())
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/Light Bulb/Support Shapes/FilamentLoopShape.swift`
```
//
//  FilamentLoopShape.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 11/12/25.
//  Copyright © 2025 Shubham Singh. All rights reserved.
//

import SwiftUI

/// The filament inside the bulb: two vertical posts joined at the bottom by a small looping
/// curve, echoing the "curly" filament of the vector artwork.
struct FilamentLoopShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        let lx = w * 0.38   // Left post X.
        let rx = w * 0.62   // Right post X.
        let bottomY = h * 0.75

        // Left post dropping down.
        path.move(to: CGPoint(x: lx, y: 0))
        path.addLine(to: CGPoint(x: lx, y: bottomY))

        // The loop: dip below the posts and curl toward the center...
        path.addCurve(to: CGPoint(x: w * 0.5, y: bottomY - 10),
                      control1: CGPoint(x: lx, y: bottomY + 25),
                      control2: CGPoint(x: w * 0.45, y: bottomY + 25))

        // ...then loop back out to meet the right post.
        path.addCurve(to: CGPoint(x: rx, y: bottomY),
                      control1: CGPoint(x: w * 0.55, y: bottomY - 35),
                      control2: CGPoint(x: rx, y: bottomY + 25))

        // Right post back up to the top.
        path.addLine(to: CGPoint(x: rx, y: 0))

        return path
    }
}

#Preview {
    FilamentLoopShape()
        .stroke(lineWidth: 4)
        .padding()
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/Loader/LoaderState.swift`
```
//
//  LoaderState.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 18/08/20.
//  Copyright © 2020 Shubham Singh. All rights reserved.
//

import SwiftUI

/// Represents the four directional phases of the capsule loader animation.
///
/// Each case defines the capsule's travel direction and provides layout values
/// (alignment, size, and position offsets) for both the "stretching" (`increment_before`)
/// and "contracting" (`increment_after`) halves of the movement.
enum LoaderState: CaseIterable {
    case right
    case down
    case left
    case up

    /// The alignment anchor for the capsule's frame during this phase.
    var alignment: Alignment {
        switch self {
        case .right, .down:
            return .topLeading
        case .left:
            return .topTrailing
        case .up:
            return .bottomLeading
        }
    }
    
    /// Base size of the capsule when it is at rest (square: 40×40).
    var capsuleDimension: CGFloat {
        return 40
    }
    /// Extra length added when the capsule stretches in its travel direction.
    var increasingOffset: CGFloat {
        return 72
    }

    /// Returns (x offset, y offset, width, height) for the first half of the animation —
    /// the capsule stretches from its current corner toward the next corner.
    var increment_before: (CGFloat, CGFloat, CGFloat, CGFloat) {
        switch self {
        case .right:
            return (0, 0, capsuleDimension + increasingOffset, capsuleDimension)
        case .down:
            return (increasingOffset, 0, capsuleDimension, capsuleDimension + increasingOffset)
        case .left:
            return (increasingOffset, increasingOffset, capsuleDimension + increasingOffset, capsuleDimension)
        case .up:
            return (0, capsuleDimension + increasingOffset, capsuleDimension, capsuleDimension + increasingOffset)
        }
    }
    
    /// Returns (x offset, y offset, width, height) for the second half —
    /// the trailing edge catches up, contracting the capsule at the new corner.
    var increment_after: (CGFloat, CGFloat, CGFloat, CGFloat) {
        switch self {
        case .right:
            return (increasingOffset, 0, capsuleDimension, capsuleDimension)
        case .down:
            return (increasingOffset, increasingOffset, capsuleDimension, capsuleDimension)
        case .left:
            return (0, increasingOffset, capsuleDimension, capsuleDimension)
        default:
            return (0, capsuleDimension, capsuleDimension, capsuleDimension)
        }
    }
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Utils/Colors.swift`
```
//
//  Colors.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 08/08/20.
//  Copyright © 2020 Shubham Singh. All rights reserved.
//

import SwiftUI

/// Convenience color definitions used throughout the animation demos.
///
/// Provides a semantic color palette (e.g., `background`, `chatBackground`) and
/// an RGB convenience initializer so colors can be expressed as 0-255 values.
extension Color {

    /// Adaptive system background color, light or dark depending on the user's appearance setting.
    static let background: Color = Color(UIColor.systemBackground)
    /// Adaptive label color that automatically adjusts for light/dark mode.
    static let label: Color = Color(UIColor.label)

    /// Primary blue used in the chat bubble animation.
    static let chatBackground: Color = Color(r: 41, g: 121, b: 255.0)
    /// Light blue used for button backgrounds in the chat animation.
    static let buttonBackground: Color = Color(r: 144.0, g: 202.0, b: 249.0)

    /// Dark navy background for the Wi-Fi loader animation.
    static let wifiBackground: Color = Color(r: 5, g: 23, b: 46)
    /// Shadow color for the Wi-Fi loader rings.
    static let wifiShadow: Color = Color(r: 13, g: 50, b: 125)

    /// Green tint shown when the Wi-Fi loader reaches the connected state.
    static let wifiConnected: Color = Color(r: 170, g: 255, b: 197)

    /// Teal background for the expanding view animation.
    static let expandingBackground: Color = Color(r: 3, g: 247, b: 235)
    /// Accent magenta for the expanding view animation.
    static let expandingAccent: Color = Color(r: 186, g: 38, b: 75)

    /// Gradient start color for the circular progress track.
    static let circleTrackStart: Color = Color(r: 237, g: 242, b: 255)
    /// Gradient end color for the circular progress track.
    static let circleTrackEnd: Color = Color(r: 235, g: 248, b: 255)

    /// Gradient start color for the circular progress indicator.
    static let circleRoundStart: Color = Color(r: 71, g: 198, b: 255)
    /// Gradient end color for the circular progress indicator.
    static let circleRoundEnd: Color = Color(r: 90, g: 131, b: 255)

    /// Pink color used in the pill-shaped toggle animation.
    static let pillColor: Color = Color(r: 242, g: 53, b: 174)

    /// Deep purple background for the like button animation.
    static let likeBackground: Color = Color(r: 49, g: 28, b: 78)
    /// Slightly lighter purple overlay for the like button animation.
    static let likeOverlay: Color = Color(r: 64, g: 49, b: 82)

    /// Warm orange used for the like button heart icon.
    static let likeColor: Color = Color(r: 254, g: 140, b: 100)

    /// Vivid purple used for the submit button animation.
    static let submitColor: Color = Color(r: 110, g: 80, b: 249)

    /// Near-black color used as a material-style dark background.
    static let materialBlack: Color = Color(r: 18, g: 18, b: 18)
    /// Soft off-white used for text and shapes on dark backgrounds.
    static let offWhite: Color = Color(r: 225, g: 225, b: 235)

    /// Creates a color from 0-255 RGB values, converting them to the 0-1 range that SwiftUI expects.
    /// - Parameters:
    ///   - r: Red component (0-255).
    ///   - g: Green component (0-255).
    ///   - b: Blue component (0-255).
    init(r: Double, g: Double, b: Double) {
        self.init(red: r / 255.0, green: g / 255.0, blue: b / 255.0)
    }
}

/// Adds a hex-string color initializer to `Color` by delegating to the `UIColor` hex initializer.
extension Color {

    /// Creates a SwiftUI `Color` from a hex string (e.g., `"#FF5733"` or `"FF5733"`).
    /// - Parameter hex: A 6- or 8-character hex string, with or without a leading `#`.
    init(hex: String) {
        self.init(UIColor(hex: hex))
    }
}

/// Adds hex-string color parsing to `UIColor`.
extension UIColor {
    /// Creates a `UIColor` from a hex string, supporting 6-character (RGB) and 8-character (RGBA) formats.
    /// - Parameter hex: A hex string such as `"#FF5733"` or `"FF573380"`. The `#` prefix is optional.
    convenience init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0

        var r: CGFloat = 0.0
        var g: CGFloat = 0.0
        var b: CGFloat = 0.0
        var a: CGFloat = 1.0

        let length = hexSanitized.count
        Scanner(string: hexSanitized).scanHexInt64(&rgb)

        if length == 6 {
            r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
            g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
            b = CGFloat(rgb & 0x0000FF) / 255.0

        } else if length == 8 {
            r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
            g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
            b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
            a = CGFloat(rgb & 0x000000FF) / 255.0
        }
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}


// Foundation
/// Adds number-formatting helpers to `Double`.
extension Double {

    /// Formats the double as a string, omitting the decimal part when the value is whole.
    /// - Parameter places: The number of decimal places to show for non-whole values.
    /// - Returns: A formatted string representation (e.g., `"3"` or `"3.14"`).
    func clean(places: Int) -> String {
        return self.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", self) : String(format: "%.\(places)f", self)
    }
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Utils/FontManager.swift`
```
//
//  FontManager.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 19/03/26.
//  Copyright © 2026 Shubham Singh. All rights reserved.
//

import SwiftUI

enum ClashGrotestk {
    case extralight
    case light
    case regular
    case medium
    case semibold
    case bold

    // MARK: - Functions
    func font(size: CGFloat) -> Font {
        switch self {
        case .extralight:
            return .custom("ClashGrotesk-Extralight", size: size)
        case .light:
            return .custom("ClashGrotesk-Light", size: size)
        case .regular:
            return .custom("ClashGrotesk-Regular", size: size)
        case .medium:
            return .custom("ClashGrotesk-Medium", size: size)
        case .semibold:
            return .custom("ClashGrotesk-Semibold", size: size)
        case .bold:
            return .custom("ClashGrotesk-Bold", size: size)
        }
    }
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/3D Graph/ThreeDGraphView.swift`
```
//
//  ThreeDGraphView.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 19/07/24.
//  Copyright © 2024 Shubham Singh. All rights reserved.
//

import SwiftUI

// MARK: - Model

/// One bar in the 3-D graph: a label, a 0...1 value that scales its height, and a fill color.
struct SkillBar: Identifiable {
    let id = UUID()
    let name: String
    /// Height of the bar relative to the tallest, in the range 0...1. Mutable so a drag can resize it.
    var value: CGFloat
    /// Fill color; resolves automatically to a lighter pastel in dark mode and a deeper,
    /// more saturated tone in light mode so the bars stay legible on either background.
    let color: Color
}

/// A `Color` that resolves to `dark` in dark mode and `light` in light mode, both hex strings.
private extension Color {
    init(light: String, dark: String) {
        self = Color(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

// MARK: - Main View

/// An interactive isometric 3-D bar graph. The bars grow in on appear, and each bar can be
/// dragged up or down to change its own height in real time.
///
/// Each bar is drawn as three shaded faces (top, left, right) so it reads as a solid
/// isometric block. The bars are arranged with a negative `HStack` spacing and a per-bar
/// vertical offset so they recede up-and-to-the-right like a row of dominoes, and each grows
/// from zero height with a staggered delay when `animate` flips true.
struct ThreeDGraphView: View {

    // MARK: - Variables

    /// Drives the initial grow-in animation. Set true on appear.
    @State private var animate = false

    /// The bars, sorted shortest-first so the tallest sits at the back-right of the stack.
    /// Mutable state so each bar's `value` can be updated live while dragging.
    @State private var bars: [SkillBar] = [
        SkillBar(name: "SwiftUI",    value: 1.0,  color: Color(light: "4E92CE", dark: "C6DEF1")),
        SkillBar(name: "UIKit",      value: 0.9,  color: Color(light: "8E6FD0", dark: "DBCDF0")),
        SkillBar(name: "MVVM",       value: 0.8,  color: Color(light: "4FA98D", dark: "C9E4DE")),
        SkillBar(name: "Networking", value: 0.75, color: Color(light: "E0925A", dark: "F7D9C4")),
        SkillBar(name: "CoreData",   value: 0.6,  color: Color(light: "D9B441", dark: "FAEDCB")),
        SkillBar(name: "Combine",    value: 0.45, color: Color(light: "4FAAA4", dark: "CDE8E6")),
    ].sorted { $0.value < $1.value }

    /// Fixed footprint of a single bar (width of the block, max height).
    private let barSize = CGSize(width: 40, height: 212)

    // MARK: - Views
    var body: some View {
        GeometryReader { proxy in
            // Spacing/offset unit derived from the available width, matching the original layout.
            let unit = (proxy.size.width / 1.5) / CGFloat(bars.count)

            ZStack {
                Color.background
                    .ignoresSafeArea()

                // Negative spacing overlaps the bars; the per-bar Y offset staggers them upward.
                HStack(alignment: .bottom, spacing: -unit / 2) {
                    ForEach(Array(bars.enumerated()), id: \.element.id) { index, bar in
                        GraphBarView(
                            barSize: barSize,
                            progress: bar.value,
                            animate: animate,
                            delay: TimeInterval(Double(index) * 0.1)
                        )
                        .zIndex(CGFloat(bars.count - index) * 0.1)   // Front bars draw over those behind.
                        .foregroundStyle(bar.color)
                        .frame(width: 65)
                        .gesture(
                            // Drag a bar vertically to change its height: up grows it, down shrinks it.
                            // Hit-testing falls on the filled faces, so each bar only grabs its own drag
                            // even though the columns overlap.
                            DragGesture()
                                .onChanged { value in
                                    let delta = value.translation.height * -0.0002
                                    bars[index].value = min(max(bars[index].value + delta, 0), 1)
                                }
                        )
                        .overlay(alignment: .bottom) {
                            // Vertical skill label riding along the bar's left edge.
                            Text(bar.name)
                                .font(.system(size: 10.5, weight: .medium))
                                .tracking(1.05)
                                .foregroundStyle(Color.label)
                                .fixedSize()   // Don't let the rotated label truncate (e.g. "Networking").
                                .offset(x: -50 + Double(index * 2), y: 4)
                                .rotationEffect(.degrees(-90))
                        }
                        .offset(y: unit / 3.5 * -CGFloat(index))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear { animate = true }
    }
}

// MARK: - Single Bar

/// A single isometric bar built from three shaded faces. The faces inherit the bar's color
/// via `foregroundStyle`; `brightness` on each face fakes directional lighting so the block
/// looks three-dimensional. The bar grows from zero to its target height when `animate` is true.
struct GraphBarView: View {

    /// The bar's footprint: `width` is the block width, `height` the fully-grown height.
    let barSize: CGSize

    /// The bar's value in 0...1, controlling how tall it grows.
    let progress: CGFloat

    /// When true the bar animates up to its target height; when false it collapses to zero.
    let animate: Bool

    /// Stagger applied so bars grow in one after another.
    var delay: TimeInterval = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            TopFace().brightness(0)       // Lit top.
            LeftFace().brightness(-0.05)  // Shaded left.
            RightFace().brightness(0.1)   // Highlighted right.
        }
        // Grow from 0 up to a base (barSize.width) plus a share of the remaining height.
        .frame(width: barSize.width,
               height: animate ? barSize.width + (barSize.height - barSize.width) * progress : 0)
        .frame(height: 0, alignment: .bottom)
        .animation(.smooth.delay(delay), value: animate)
    }

    // The three isometric faces. Coordinates are fractions of the shape's rect so the block
    // keeps its proportions at any height. `width / 2.1` is the front vertical edge; `width / 4`
    // is the depth of the top face.
    struct LeftFace: Shape {
        func path(in rect: CGRect) -> Path {
            var path = Path()
            let start = CGPoint(x: 0, y: rect.width / 4)
            path.move(to: start)
            path.addLine(to: CGPoint(x: rect.width / 2.1, y: rect.width / 2.1))
            path.addLine(to: CGPoint(x: rect.width / 2.1, y: rect.height))
            path.addLine(to: CGPoint(x: 0, y: rect.height - (rect.width / 4)))
            path.addLine(to: start)
            path.closeSubpath()
            return path
        }
    }

    struct RightFace: Shape {
        func path(in rect: CGRect) -> Path {
            var path = Path()
            let start = CGPoint(x: rect.width / 2.1, y: rect.width / 2.1)
            path.move(to: start)
            path.addLine(to: CGPoint(x: rect.width, y: rect.width / 4))
            path.addLine(to: CGPoint(x: rect.width, y: rect.height - (rect.width / 4)))
            path.addLine(to: CGPoint(x: rect.width / 2.1, y: rect.height))
            path.addLine(to: start)
            path.closeSubpath()
            return path
        }
    }

    struct TopFace: Shape {
        func path(in rect: CGRect) -> Path {
            var path = Path()
            let start = CGPoint(x: 0, y: rect.width / 4)
            path.move(to: start)
            path.addLine(to: CGPoint(x: rect.width - (rect.width / 2.1), y: rect.width / 25))
            path.addLine(to: CGPoint(x: rect.width, y: rect.width / 4))
            path.addLine(to: CGPoint(x: rect.width / 2.1, y: rect.width / 2.1))
            path.addLine(to: start)
            path.closeSubpath()
            return path
        }
    }
}

#Preview {
    ThreeDGraphView()
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/3dLoader/RotatingLoaderView.swift`
```
//
//  3dLoader.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 17/10/20.
//  Copyright © 2020 Shubham Singh. All rights reserved.
//

import SwiftUI

/// The four states of a 3D cube face flip in `RotatingLoaderView`.
///
/// Each state provides a `(degree, offset, anchor, yAxis)` tuple used as arguments to
/// `rotation3DEffect`. The `offset` physically moves the face so the rotation pivot
/// appears to be at the cube's edge (perspective hinge) rather than its center.
enum RotationState: CaseIterable {
    case initialLeading
    case finalLeading
    case initialTrailing
    case finalTrailing

    /// Returns `(rotationDegrees, xOffset, anchorPoint, yAxisDirection)`.
    /// - `rotationDegrees`: 0 = face-on, 90 = folded flat/hidden.
    /// - `xOffset`: horizontal translation so the face swings from the correct edge.
    /// - `anchorPoint`: `.leading` or `.trailing` — the hinge edge.
    /// - `yAxisDirection`: 1 (leading hinge rotates inward) or –1 (trailing hinge).
    // Degree, Offset, Anchor, Axis
    var rotationValues: (Double, CGFloat, UnitPoint, CGFloat) {
        switch self {
        case .initialLeading:
            return (90, 260, UnitPoint.leading, 1)
        case .finalLeading:
            return (0, 0, UnitPoint.leading, 1)
        case .initialTrailing:
            return (0, 0, UnitPoint.trailing, -1)
        case .finalTrailing:
            return (90, -260, UnitPoint.trailing, -1)
        }
    }
}

/// A two-faced 3D cube loader that alternates between a white face (`DashedLoaderView`)
/// and a dark face (`RectangleLoaderView` or `DotsLoaderView`) using `rotation3DEffect`.
///
/// Each "flip" animates both faces simultaneously — one swings in from the leading edge
/// while the other swings out from the trailing edge — creating the illusion of a rotating cube.
/// After the first two flips, the dark face switches from `RectangleLoaderView` to `DotsLoaderView`.
struct RotatingLoaderView: View {

    // MARK: - Variables

    // ── First face (dark, initially trailing/visible) ─────────────────────────
    /// 3D rotation degree for the dark face (0 = visible, 90 = hidden/folded).
    @State var firstViewDegree: Double = RotationState.initialTrailing.rotationValues.0
    /// Horizontal offset for the dark face, moves it to the correct hinge edge.
    @State var firstViewOffset: CGFloat = RotationState.initialTrailing.rotationValues.1
    /// Anchor point (hinge) for the dark face's `rotation3DEffect`.
    @State var firstViewAnchor: UnitPoint = RotationState.initialTrailing.rotationValues.2
    /// Y-axis direction for the dark face (–1 = trailing hinge, rotates left).
    @State var firstViewYAxis: CGFloat = RotationState.initialTrailing.rotationValues.3

    // ── Second face (white, initially leading/hidden) ──────────────────────────
    /// 3D rotation degree for the white (`DashedLoaderView`) face.
    @State var secondViewDegree: Double = RotationState.initialLeading.rotationValues.0
    /// Horizontal offset for the white face.
    @State var secondViewOffset: CGFloat = RotationState.initialLeading.rotationValues.1
    /// Anchor point for the white face's `rotation3DEffect`.
    @State var secondViewAnchor: UnitPoint = RotationState.initialLeading.rotationValues.2
    /// Y-axis direction for the white face (1 = leading hinge, rotates right).
    @State var secondViewYAxis: CGFloat = RotationState.initialLeading.rotationValues.3

    /// Total duration of one pause (face fully visible) before the next flip begins.
    let timerDuration: TimeInterval = 3.5
    /// Duration of the easeOut flip animation (face swings in/out).
    let animationDuration: TimeInterval = 1
    /// Alternates the leading/trailing direction of each flip.
    @State var animateTrail: Bool = false

    /// Counts completed flips; selects `DotsLoaderView` when `counter >= 2`.
    @State var counter = 0

    // MARK: - Views

    var body: some View {
        ZStack {
            Color.background
                .ignoresSafeArea()
            ZStack {
                ZStack {
                    Rectangle()
                        .foregroundStyle(.white)
                        .frame(width: 260, height: 260)
                    
                    DashedLoaderView()
                        .frame(width: 140, height: 140)
                }
                .rotation3DEffect(.degrees(secondViewDegree), axis: (x: 0, y: secondViewYAxis, z: 0), anchor: secondViewAnchor, anchorZ: 0, perspective: 0.1)
                .offset(x: secondViewOffset)

                ZStack {
                    Rectangle()
                        .foregroundStyle(Color.materialBlack)
                        .frame(width: 260, height: 260)
                    if counter == 0 || counter == 1 {
                        RectangleLoaderView()
                            .frame(width: 140, height: 140)
                    } else {
                        DotsLoaderView()
                            .frame(width: 140, height: 140)
                    }
                }
                .rotation3DEffect(.degrees(firstViewDegree), axis: (x: 0, y: firstViewYAxis, z: 0), anchor: firstViewAnchor, anchorZ: 0, perspective: 0.1)
                .offset(x: firstViewOffset)
            }
            .clipShape(.rect(cornerRadius: 12))
        }
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: timerDuration, repeats: false) { _ in
                withAnimation(Animation.smooth(duration: animationDuration)) {
                    self.setValuesOnState(rotation1: .finalTrailing, rotation2: .finalLeading)
                    counter += 1
                    rotateCube()
                }
            }
        }
    }

    // MARK: - Functions

    /// Applies the rotation values for two `RotationState` cases to the first and second faces.
    /// Called both without animation (to snap to initial position) and within `withAnimation` blocks.
    func setValuesOnState(rotation1: RotationState, rotation2: RotationState) {
        firstViewDegree = rotation1.rotationValues.0
        firstViewOffset = rotation1.rotationValues.1
        firstViewAnchor = rotation1.rotationValues.2
        firstViewYAxis = rotation1.rotationValues.3

        secondViewDegree = rotation2.rotationValues.0
        secondViewOffset = rotation2.rotationValues.1
        secondViewAnchor = rotation2.rotationValues.2
        secondViewYAxis = rotation2.rotationValues.3
    }

    /// Starts a repeating timer that alternates the cube flip direction each `timerDuration`.
    ///
    /// Each tick: snaps both faces to their new initial positions (no animation),
    /// then immediately animates them to the opposite final positions via `easeOut`.
    /// `animateTrail` toggles each time so the cube flips left and right alternately.
    func rotateCube() {
        Timer.scheduledTimer(withTimeInterval: timerDuration, repeats: true) { _ in
            if animateTrail {
                self.setValuesOnState(rotation1: .initialTrailing, rotation2: .initialLeading)
            } else {
                self.setValuesOnState(rotation1: .initialLeading, rotation2: .initialTrailing)
            }
            withAnimation(Animation.easeOut(duration: animationDuration)) {
                if animateTrail {
                    self.setValuesOnState(rotation1: .finalTrailing, rotation2: .finalLeading)
                } else {
                    self.setValuesOnState(rotation1: .finalLeading, rotation2: .finalTrailing)
                }
            }
            self.animateTrail.toggle()
        }
    }
}

#Preview {
    RotatingLoaderView()
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/3dLoader/Support Shapes/DashedLoaderView.swift`
```
//
//  DashedLoader.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 17/10/20.
//  Copyright © 2020 Shubham Singh. All rights reserved.
//

import SwiftUI

/// The white face of the 3D cube loader, showing a dashed ring with two orbiting dots.
///
/// Displayed when the cube is flipped to its white side in `RotatingLoaderView`.
/// The dashed circle rotates continuously (5 s linear loop), while two satellite dots
/// orbit at 75% of that speed (3.75 s), creating an independent layered spin effect.
struct DashedLoaderView: View {

    // MARK: - Variables

    /// Drives all three `repeatForever` rotation animations — toggled once on appear.
    @State var isAnimating: Bool = false

    /// Duration for one full rotation of the dashed ring.
    /// The two satellite dots use `animationDuration × 0.75` so they orbit faster.
    let animationDuration: TimeInterval = 5

    // MARK: - Views

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.background
                    .brightness(-0.1)
                    .ignoresSafeArea()
                ZStack {
                    Circle()
                        .stroke(style: StrokeStyle(lineWidth: 2, lineCap: .round, miterLimit: 2, dash: [10, 40, 20], dashPhase: 6))
                        .frame(width: geometry.size.width / 2, height: geometry.size.height / 2)
                        .rotationEffect(isAnimating ? .degrees(360) : .degrees(0))
                        .shadow(color: Color.black.opacity(0.2), radius: 10)
                        .animation(.linear(duration: animationDuration).repeatForever(autoreverses: false), value: isAnimating)
                    Circle()
                        .frame(width: geometry.size.width * 0.06, height: geometry.size.width * 0.1)
                        .offset(x: -geometry.size.width / 4)
                        .foregroundStyle(.black)
                        .rotationEffect(isAnimating ? .degrees(360) : .degrees(0))
                        .shadow(color: Color.black.opacity(0.2), radius: 10)
                        .animation(.linear(duration: animationDuration * 0.75).repeatForever(autoreverses: false), value: isAnimating)
                    Circle()
                        .frame(width: geometry.size.width * 0.06, height: geometry.size.width * 0.1)
                        .offset(x: geometry.size.width / 4)
                        .foregroundStyle(.black)
                        .rotationEffect(isAnimating ? .degrees(360) : .degrees(0))
                        .shadow(color: Color.black.opacity(0.2), radius: 10)
                        .animation(.linear(duration: animationDuration * 0.75).repeatForever(autoreverses: false), value: isAnimating)
                }
            }
            .scaleEffect(2)
        }
        .onAppear {
            isAnimating.toggle()
        }
    }
}

#Preview {
    DashedLoaderView()
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/3dLoader/Support Shapes/DotsLoaderView.swift`
```
//
//  DotsLoaderView.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 17/10/20.
//  Copyright © 2020 Shubham Singh. All rights reserved.
//

import SwiftUI

/// Three white dots that slide left and right in a staggered "typing indicator" pattern.
///
/// All three dots share the same `leftOffset` so they always move to the same target,
/// but each has a different `easeInOut` delay (0, 0.2, 0.4 s) that fans them apart
/// into a wave-like chasing motion.
///
/// The offsets swap every `animationDuration × 1.5` via `swap(&leftOffset, &rightOffset)`,
/// so the direction reverses each cycle without any conditional branching.
struct DotsLoaderView: View {

    // MARK: - Variables

    /// Current x-offset applied to all three dots. Swaps with `rightOffset` each cycle.
    @State var leftOffset: CGFloat = -75
    /// Counter-offset — holds the "other" end position while `leftOffset` is active.
    @State var rightOffset: CGFloat = 75

    /// Duration for one half-cycle (dots sliding from left to right, or vice versa).
    let animationDuration: TimeInterval = 1

    // MARK: - Views

    var body: some View {
        ZStack {
            Circle()
                .fill(.white)
                .frame(width: 20, height: 20)
                .offset(x: leftOffset)
                .opacity(0.7)
                .animation(.easeInOut(duration: animationDuration), value: leftOffset)
            Circle()
                .fill(.white)
                .frame(width: 20, height: 20)
                .offset(x: leftOffset)
                .opacity(0.7)
                .animation(.easeInOut(duration: animationDuration).delay(0.2), value: leftOffset)
            Circle()
                .fill(.white)
                .frame(width: 20, height: 20)
                .offset(x: leftOffset)
                .opacity(0.7)
                .animation(.easeInOut(duration: animationDuration).delay(0.4), value: leftOffset)
        }
        .onAppear {
            swap(&leftOffset, &rightOffset)
            Timer.scheduledTimer(withTimeInterval: animationDuration * 1.5, repeats: true) { _ in
                swap(&self.leftOffset, &self.rightOffset)
            }
        }
    }
}

#Preview {
    ZStack {
        Color.black
            .ignoresSafeArea()
        DotsLoaderView()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #28** (2026-06-19): **[Bug] YinYang**
  *Symptoms*: ## Description  isn't optimized for dark theme  ## Animation Affected  YinYang  ## Steps to Reproduce  1. Open the app  2. Navigate to YinYang 3. Observe dark theme  ## Expected Behavior  either forced to light theme or optimized for dark theme (i think light theme is enough to showcase the animation sufficiently)  ## Actual Behavior  looks laggy  ## Screenshots / GIFs  https://github.com/user-attachments/assets/926b408e-e7aa-487a-a30d-3b9c6b5d2b5d  ## Environment  - **Xcode version**: - **iOS version**: - **Device / Simulator**: - **macOS version**: 

- **Issue #25** (2026-06-19): **[Bug] Bank Card**
  *Symptoms*: ## Description  navigation overflows and dont allow scroll  ## Animation Affected  Bank Card  ## Steps to Reproduce  1. Open the app 2. Navigate to Bank Card 3. Observe pagination scroll  ## Expected Behavior  to not overflow  ## Actual Behavior  overflows   ## Screenshots / GIFs  https://github.com/user-attachments/assets/9e783adb-4415-4971-ae10-b722dfe4f98e  ## Environment  - **Xcode version**: - **iOS version**: - **Device / Simulator**: - **macOS version**: 

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

### Incident Patch 1: `8e44dda8` (2026-06-18)
**Commit Message**: Add Text Bouncing, modernize Like, fix Yin Yang, surface new items first

- Add Text Bouncing component (drag-to-bounce characters, custom text,
  shuffle), with continuous frame reporting via a PreferenceKey
- Rewrite Like animation to modern standards: programmatic burst, "+1"
  float, reddish hex-based palette, springy pop; reset moved to a
  top-trailing toolbar button (no more tap-to-reset). Remove the legacy
  timer-driven support views and the duplicate LikeButtonView
- Lock Yin Yang switcher to light mode so it renders correctly when
  navigated to from Home (was inheriting dark mode and inverting)
- Home grid now surfaces newly added items first (most recent first)

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `SwiftUI-Animations.xcodeproj/project.pbxproj` (modified, +3/-23)
```diff
@@ -51,7 +51,6 @@
 		51D3E49624F14591004325B5 /* AddView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51D3E49424F14591004325B5 /* AddView.swift */; };
 		51D3E49724F14591004325B5 /* ExpandingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51D3E49524F14591004325B5 /* ExpandingView.swift */; };
 		51D6273A24E19F2A00BCE1C8 /* WifiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51D6273924E19F2A00BCE1C8 /* WifiView.swift */; };
-		51DAC7B3250E07E800ECA895 /* ShrinkingCapsule.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51DAC7B2250E07E800ECA895 /* ShrinkingCapsule.swift */; };
 		51F6B07F24E81E0300EF840F /* Loader.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51F6B07E24E81E0300EF840F /* Loader.swift */; };
 		88CFFAAD54008A8AC63D9F0B /* Router.swift in Sources */ = {isa = PBXBuildFile; fileRef = 13DB8C183AB5B4355AA33084 /* Router.swift */; };
 		AA0001052603180100000003 /* HomeView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001042603180100000003 /* HomeView.swift */; };
@@ -84,10 +83,6 @@
 		F3672DF62563864500967A8A /* BookPagesView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3672DF52563864500967A8A /* BookPagesView.swift */; };
 		F36DF4CA258F4CF200BF9AA5 /* LoaderIIView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F36DF4C9258F4CF200BF9AA5 /* LoaderIIView.swift */; };
 		F36DF4CE258F4D2600BF9AA5 /* MovingCircleView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F36DF4CD258F4D2600BF9AA5 /* MovingCircleView.swift */; };
-		F3714E8E251F528700D627D4 /* FloatingLike.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3714E8D251F528700D627D4 /* FloatingLike.swift */; };
-		F3714E94251F8DEB00D627D4 /* HeartImageView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3714E93251F8DEB00D627D4 /* HeartImageView.swift */; };
-		F39D62DF251CF07900BB25D2 /* CapusuleGroupView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F39D62DE251CF07900BB25D2 /* CapusuleGroupView.swift */; };
-		F39D62E2251CF2CA00BB25D2 /* LowerCapsuleView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F39D62E1251CF2CA00BB25D2 /* LowerCapsuleView.swift */; };
 		F3DA13D62535BA02005E384E /* HapticManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DA13D52535BA02005E384E /* HapticManager.swift */; };
 		F3DA9AAD252DB1DE00CF2516 /* SubmitView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DA9AAC252DB1DE00CF2516 /* SubmitView.swift */; };
 		F3DA9AB2252DB4C100CF2516 /* RotatingCircle.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DA9AB1252DB4C100CF2516 /* RotatingCircle.swift */; };
@@ -147,7 +142,6 @@
 		51D3E49424F14591004325B5 /* AddView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = AddView.swift; sourceTree = "<group>"; };
 		51D3E49524F14591004325B5 /* ExpandingView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ExpandingView.swift; sourceTree = "<group>"; };
 		51D6273924E19F2A00BCE1C8 /* WifiView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WifiView.swift; sourceTree = "<group>"; };
-		51DAC7B2250E07E800ECA895 /* ShrinkingCapsule.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ShrinkingCapsule.swift; sourceTree = "<group>"; };
 		51F6B07E24E81E0300EF840F /* Loader.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Loader.swift; sourceTree = "<group>"; };
 		AA0001042603180100000003 /* HomeView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HomeView.swift; sourceTree = "<group>"; };
 		CF0001AA2603180100000001 /* FontManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FontManager.swift; sourceTree = "<group>"; };
@@ -179,10 +173,6 @@
 		F3672DF52563864500967A8A /* BookPagesView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BookPagesView.swift; sourceTree = "<group>"; };
 		F36DF4C9258F4CF200BF9AA5 /* LoaderIIView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LoaderIIView.swift; sourceTree = "<group>"; };
 		F36DF4CD258F4D2600BF9AA5 /* MovingCircleView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MovingCircleView.swift; sourceTree = "<group>"; };
-		F3714E8D251F528700D627D4 /* FloatingLike.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FloatingLike.swift; sourceTree = "<group>"; };
-		F3714E93251F8DEB00D627D4 /* HeartImageView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HeartImageView.swift; sourceTree = "<group>"; };
-		F39D62DE251CF07900BB25D2 /* CapusuleGroupView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CapusuleGroupView.swift; sourceTree = "<group>"; };
-		F39D62E1251CF2CA00BB25D2 /* LowerCapsuleView.swift */ = {isa = PBXFileReference; lastKnownFi
```

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/LikeButtonView.swift` (removed, +0/-92)
```diff
@@ -1,92 +0,0 @@
-//
-//  LikeButton.swift
-//  SwiftUI-Animations
-//
-//  Created by Shubham Singh on 26/09/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
-//
-
-import SwiftUI
-
-/// Duplicate entry point for `LikeView` — see `LikeView.swift` for full documentation.
-///
-/// Both files define the same `LikeView` struct. This file is kept as an alternate
-/// preview/entry point. Refer to `LikeView.swift` for the complete animation description.
-struct LikeButtonView: View {
-
-    // MARK: - Variables
-
-    /// Base duration for all timed animations in the like sequence.
-    let animationDuration: Double = 0.25
-
-    /// `true` while the like animation is active — drives heart scale and circle color.
-    @State var isAnimating: Bool = false
-    /// Briefly `true` during the initial spring pulse — causes the circle to shrink then snap back.
-    @State var shrinkIcon: Bool = false
-    /// `true` while the liked state is active — shows `CapusuleGroupView` and `FloatingLike`.
-    @State var floatLike: Bool = false
-    /// Toggled after `animationDuration` to scale the capsule burst from 0.8× to 1.25×.
-    @State var showFlare: Bool = false
-
-    // MARK: - Views
-    var body: some View {
-        ZStack {
-            Color.likeBackground
-                .ignoresSafeArea()
-            ZStack {
-                if floatLike {
-                    CapusuleGroupView(isAnimating: $floatLike)
-                        .offset(y: -130)
-                        .scaleEffect(showFlare ? 1.25 : 0.8)
-                        .opacity(floatLike ? 1 : 0)
-                        .animation(.spring().delay(animationDuration / 2), value: showFlare)
-                }
-                Circle()
-                    .foregroundStyle(isAnimating ? Color.likeColor : Color.likeOverlay)
-                    .animation(.easeOut(duration: animationDuration * 2).delay(animationDuration), value: isAnimating)
-                HeartImageView()
-                    .foregroundStyle(.white)
-                    .offset(y: 12)
-                    .scaleEffect(isAnimating ? 1.25 : 1)
-                    .overlay(
-                        Color.likeColor
-                            .mask(
-                                HeartImageView()
-                            )
-                            .offset(y: 12)
-                            .scaleEffect(isAnimating ? 1.35 : 0)
-                            .animation(.easeIn(duration: animationDuration), value: isAnimating)
-                            .opacity(isAnimating ? 0 : 1)
-                            .animation(.easeIn(duration: animationDuration).delay(animationDuration), value: isAnimating)
-                    )
-            }.frame(width: 250, height: 250)
-            .scaleEffect(shrinkIcon ? 0.35 : 1)
-            .animation(.spring(response: animationDuration, dampingFraction: 1, blendDuration: 1), value: shrinkIcon)
-            if floatLike {
-                FloatingLike(isAnimating: $floatLike)
-                    .offset(y: -40)
-            }
-        }.onTapGesture {
-            if !floatLike {
-                HapticManager().makeNotifiationFeedback(mode: .success)
-                floatLike.toggle()
-                isAnimating.toggle()
-                shrinkIcon.toggle()
-                Timer.scheduledTimer(withTimeInterval: animationDuration, repeats: false) { _ in
-                    shrinkIcon.toggle()
-                    showFlare.toggle()
-                }
-            } else {
-                HapticManager().makeImpactFeedback(mode: .light)
-                isAnimating = false
-                shrinkIcon = false
-                showFlare = false
-                floatLike = false
-            }
-        }
-    }
-}
-
-#Preview {
-    LikeButtonView()
-}
```

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/LikeView.swift` (modified, +181/-70)
```diff
@@ -2,98 +2,209 @@
 //  LikeView.swift
 //  SwiftUI-Animations
 //
-//  Created by Shubham Singh on 26/09/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
+//  Created by Shubham Singh on 26/09/25.
+//  Copyright © 2025 Shubham Singh. All rights reserved.
 //
 
 import SwiftUI
 
-/// A full-screen like button with a multi-layered celebration animation.
+/// A heart "like" button with a celebratory burst animation.
 ///
-/// **On first tap (like):**
-/// 1. The circle instantly shrinks (spring) then bounces back, giving a "pulse" feel.
-/// 2. The heart icon scales up and a pink color mask sweeps across it (`easeIn`).
-/// 3. A `CapusuleGroupView` burst of capsule particles appears above the heart.
-/// 4. A `FloatingLike` "+1" bubble floats upward and fades out.
+/// Tap the heart to like it: the symbol swaps to a filled gradient heart with a
+/// springy pop, a ring of capsule particles bursts outward and fades, an expanding
+/// ring pulses out, and a soft glow blooms behind the heart. Use the reset button in
+/// the top-trailing toolbar to return to the unliked state.
 ///
-/// **On second tap (unlike):** all state resets instantly — circle reverts, burst disappears.
+/// The animation is driven entirely by SwiftUI's `withAnimation` (with completion
+/// handlers) and `sensoryFeedback` — no timers or polling.
 struct LikeView: View {
 
-    // MARK: - Variables
+    // MARK: - variables
 
-    /// Base duration for all timed animations in the like sequence.
-    let animationDuration: Double = 0.25
+    /// Whether the heart is currently liked. Drives the symbol, colour, and glow.
+    @State private var isLiked = false
+    /// Springy pop scale applied to the heart on like.
+    @State private var heartScale: CGFloat = 1
+    /// `true` only while a burst is playing, so particles aren't rendered at rest.
+    @State private var isBursting = false
+    /// 0 → 1 progress of the current burst, driving particle radius, fade, and the ring pulse.
+    @State private var burstProgress: CGFloat = 0
+    /// `true` only while the "+1" bubble is floating up.
+    @State private var showPlusOne = false
+    /// 0 → 1 progress of the "+1" float, driving its rise, sway, and fade.
+    @State private var plusOneProgress: CGFloat = 0
 
-    /// `true` while the like animation is active — drives heart scale and circle color.
-    @State var isAnimating: Bool = false
-    /// Briefly `true` during the initial spring pulse — causes the circle to shrink then snap back.
-    @State var shrinkIcon: Bool = false
-    /// `true` while the liked state is active — shows `CapusuleGroupView` and `FloatingLike`.
-    @State var floatLike: Bool = false
-    /// Toggled after `animationDuration` to scale the capsule burst from 0.8× to 1.25×.
-    @State var showFlare: Bool = false
+    /// Number of capsule particles in the radial burst.
+    private let particleCount = 14
+    /// How far the particles travel from the heart's centre.
+    private let burstRadius: CGFloat = 150
 
-    // MARK: - Views
+    /// Reddish heart palette and the matching backdrop.
+    private let heartColor = Color(hex: "#F53342")
+    private let heartColorDeep = Color(hex: "#CC1233")
+    private let backgroundTop = Color(hex: "#29080F")
+    private let backgroundBottom = Color(hex: "#570F1F")
+
+    /// Shared reddish gradient used by the heart fill and the "+1" bubble.
+    private let heartGradient = LinearGradient(
+        colors: [Color(hex: "#F53342"), Color(hex: "#CC1233")],
+        startPoint: .top,
+        endPoint: .bottom
+    )
+
+    /// Colours cycled through the burst particles for a livelier explosion.
+    private let particleColors: [Color] = [
+        Color(hex: "#F53342"),
+        .pink,
+        .orange,
+        Color(hex: "#CC1233")
+    ]
+
+    // MARK: - views
     var body: some View {
         ZStack {
-            Color.likeBackground
-                .ignoresSafeArea()
-            ZStack {
-                if floatLike {
-                    CapusuleGroupView(isAnimating: $floatLike)
-                        .offset(y: -130)
-                        .scaleEffect(showFlare ? 1.25 : 0.8)
-                        .opacity(floatLike ? 1 : 0)
-                        .animation(.spring().delay(animationDuration / 2), value: showFlare)
+            // A dark reddish gradient that matches the heart.
+            LinearGradient(
+                colors: [backgroundTop, backgroundBottom],
+                startPoint: .top,
+                endPoint: .bottom
+            )
+            .ignoresSafeArea()
+
+            // Soft radial bloom that fades in behind the heart once liked.
+            Circle()
+                .fill(
+                    RadialGradient(
+                        colors: [heartColor.opacity(isLiked ? 0.45 : 0), .clear],
+                        center: .center,
+                        startRadius: 0,
+                        endRadius: 170
+                    )
+                )
+  
```

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/Support Shapes/CapusuleGroupView.swift` (removed, +0/-42)
```diff
@@ -1,42 +0,0 @@
-//
-//  UpperCapsuleView.swift
-//  SwiftUI-Animations
-//
-//  Created by Shubham Singh on 26/09/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
-//
-
-import SwiftUI
-
-/// A radial burst of 11 shrinking capsules arranged in a fan, simulating a like confetti explosion.
-///
-/// Five upper `ShrinkingCapsule` instances spread at 0°, ±33°, and ±65° in a top fan.
-/// Six lower `ShrinkingCapsule` instances in `LowerCapsuleView` extend the burst downward.
-/// Together they form the colorful particle ring that appears above the heart on like.
-struct CapusuleGroupView: View {
-
-    // MARK: - Variables
-
-    /// When `true`, all capsules shrink and fade — triggers the burst animation in each child.
-    @Binding var isAnimating: Bool
-
-    // MARK: - Views
-    var body: some View {
-        ZStack {
-            ShrinkingCapsule(rotationAngle: .zero, offset: CGSize(width: 0, height: -15), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(-33), offset: CGSize(width: -80, height: 7.5), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(33), offset: CGSize(width: 80, height: 7.5), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(-65), offset: CGSize(width: -135, height: 70), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(65), offset: CGSize(width: 135, height: 70), isAnimating: $isAnimating)
-            LowerCapsuleView(isAnimating: $isAnimating)
-        }
-        .onTapGesture {
-            HapticManager().makeImpactFeedback(mode: .light)
-            isAnimating.toggle()
-        }
-    }
-}
-
-#Preview {
-    CapusuleGroupView(isAnimating: .constant(false))
-}
```

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/Support Shapes/FloatingLike.swift` (removed, +0/-100)
```diff
@@ -1,100 +0,0 @@
-//
-//  FloatingLike.swift
-//  SwiftUI-Animations
-//
-//  Created by Shubham Singh on 26/09/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
-//
-
-import SwiftUI
-
-/// A "+1" pill that floats upward and fades out when a like is registered.
-///
-/// Waits for `isAnimating` to become `true` (polling every 0.1 s), then runs `floatCapsule()`:
-/// - Rises from 0 → –100 → –200 → –300 pt over three timer phases.
-/// - Sways left then right (rotationAngle: –10° → +10° → 0°) for an organic drift.
-/// - Fades to opacity 0 at `animationDuration × 1.5`.
-struct FloatingLike: View {
-
-    /// Base duration for each phase. Total float duration ≈ `animationDuration × 1.5`.
-    let animationDuration: TimeInterval = 0.45
-    /// Shared spring animation used across all three rise phases.
-    let animation = Animation.spring(response: 0.75).speed(0.75)
-
-    /// Current scale — starts 0.1 (invisible) and grows to 0.75 when `isAnimating` fires.
-    @State var scale: CGFloat = 1.25
-    /// Current (x, y) offset driving the upward float path.
-    @State var offset: CGSize = CGSize(width: 0, height: 0)
-    /// Sway angle — oscillates –10° → +10° → 0° across the three phases.
-    @State var rotationAngle: Angle = .degrees(-4)
-    /// Fades to 0 at `animationDuration × 1.5` to make the bubble disappear.
-    @State var opacity: Double = 1
-
-    /// Bound from the parent `LikeView`; starts the float when `true`.
-    @Binding var isAnimating: Bool
-
-    var body: some View {
-        ZStack {
-            Capsule(style: .circular)
-                .fill(Color.likeColor)
-            HStack {
-                Spacer()
-                Image(systemName: "plus")
-                    .foregroundStyle(.white)
-                    .font(.system(size: 52, weight: .bold, design: .monospaced))
-                Text("1")
-                    .foregroundStyle(.white)
-                    .font(.system(size: 72, weight: .bold, design: .rounded))
-                Spacer()
-            }
-        }.frame(width: 165, height: 130, alignment: .center)
-        .rotationEffect(rotationAngle)
-        .scaleEffect(scale)
-        .offset(offset)
-        .opacity(opacity)
-        .onAppear {
-            scale = 0.1
-            Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { checkingTimer in
-                if isAnimating {
-                    checkingTimer.invalidate()
-                    floatCapsule()
-                }
-            }
-        }
-    }
-
-    // MARK: - Functions
-
-    /// Animates the "+1" bubble through three upward phases with left/right sway,
-    /// then fades it out at the end.
-    func floatCapsule() {
-        withAnimation(animation) {
-            scale = 0.75
-            offset = CGSize(width: 10, height: -100)
-            rotationAngle = .degrees(-10)
-        }
-        Timer.scheduledTimer(withTimeInterval: animationDuration / 2, repeats: false) { _ in
-            withAnimation(animation) {
-                offset = CGSize(width: -10, height: -200)
-            }
-            withAnimation(.spring(response: animationDuration * 1.2).speed(0.75)) {
-                rotationAngle = .degrees(10)
-            }
-        }
-        Timer.scheduledTimer(withTimeInterval: animationDuration, repeats: false) { _ in
-            withAnimation(animation) {
-                offset = CGSize(width: 0, height: -300)
-                rotationAngle = .degrees(0)
-            }
-        }
-        Timer.scheduledTimer(withTimeInterval: animationDuration * 1.5, repeats: false) { _ in
-            withAnimation(animation) {
-                opacity = 0
-            }
-        }
-    }
-}
-
-#Preview {
-    FloatingLike(isAnimating: .constant(true))
-}
```

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/Support Shapes/HeartImageView.swift` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-//
-//  HeartImageView.swift
-//  SwiftUI-Animations
-//
-//  Created by Shubham Singh on 26/09/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
-//
-
-import SwiftUI
-
-/// A large filled heart SF Symbol (160 pt) used as the central icon in `LikeView`.
-///
-/// Extracted into its own view so it can be used twice in `LikeView` — once as the
-/// white base icon and once as a color-masked overlay that sweeps across on like.
-struct HeartImageView: View {
-    var body: some View {
-        Image(systemName: "suit.heart.fill")
-            .font(.system(size: 160, weight: .medium, design: .monospaced))
-    }
-}
-
-#Preview {
-    HeartImageView()
-}
```

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/Support Shapes/LowerCapsuleView.swift` (removed, +0/-39)
```diff
@@ -1,39 +0,0 @@
-//
-//  LowerCapsuleView.swift
-//  SwiftUI-Animations
-//
-//  Created by Shubham Singh on 26/09/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
-//
-
-import SwiftUI
-
-/// The lower six capsule bursts of the like particle animation.
-///
-/// Six `ShrinkingCapsule` instances placed at ±16°, ±48°, and ±82° form a downward fan
-/// that completes the circular burst begun by `CapusuleGroupView`'s upper five capsules.
-/// The entire group is offset 260 pt downward to position the lower fan below the heart.
-struct LowerCapsuleView: View {
-
-    // MARK: - Variables
-
-    /// When `true`, triggers all six capsules to shrink and fade in sequence.
-    @Binding var isAnimating: Bool
-
-    // MARK: - Views
-    var body: some View {
-        ZStack {
-            ShrinkingCapsule(rotationAngle: .degrees(16), offset: CGSize(width: -42.5, height: 10), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(-16), offset: CGSize(width: 42.5, height: 10), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(48), offset: CGSize(width: -107, height: -30), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(-48), offset: CGSize(width: 107, height: -30), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(82), offset: CGSize(width: -142, height: -95), isAnimating: $isAnimating)
-            ShrinkingCapsule(rotationAngle: .degrees(-82), offset: CGSize(width: 142, height: -95), isAnimating: $isAnimating)
-        }
-        .offset(y: 260)
-    }
-}
-
-#Preview {
-    LowerCapsuleView(isAnimating: .constant(false))
-}
```

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/Support Shapes/ShrinkingCapsule.swift` (removed, +0/-60)
```diff
@@ -1,60 +0,0 @@
-//
-//  ShrinkingCapsule.swift
-//  SwiftUI-Animations
-//
-//  Created by Shubham Singh on 26/09/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
-//
-
-import SwiftUI
-
-/// A single colored capsule particle that shrinks and fades as part of the like burst effect.
-///
-/// Each capsule starts tall (65 pt) and collapses to 30 pt when `isAnimating` becomes `true`,
-/// then fades to opacity 0 after `animationDuration`. This simulates a firework spark
-/// shooting outward and vanishing.
-///
-/// Used in both `CapusuleGroupView` and `LowerCapsuleView` at different rotation angles
-/// and offsets to produce the full 360° particle ring.
-struct ShrinkingCapsule: View {
-
-    // MARK: - Variables
-
-    /// Duration of both the height collapse and the fade-out animation.
-    let animationDuration: Double = 0.4
-    /// Angle the capsule is rotated to point outward from the heart center.
-    let rotationAngle: Angle
-    /// (x, y) position of this capsule within the burst group.
-    let offset: CGSize
-
-    /// Triggers the height collapse from 65 → 30 pt when `true`.
-    @Binding var isAnimating: Bool
-    /// Set to `true` after `animationDuration` to fade the capsule to opacity 0.
-    @State var hideCapsule: Bool = false
-
-    var body: some View {
-        ZStack {
-            Capsule(style: .continuous)
-                .fill(Color.likeColor)
-                .frame(width: 15, height: isAnimating ? 30 : 65, alignment: .bottomLeading)
-                .animation(.easeIn(duration: animationDuration), value: isAnimating)
-                .rotationEffect(rotationAngle)
-        }.offset(offset)
-        .opacity(hideCapsule ? 0 : 0.8)
-        .animation(.easeIn(duration: animationDuration), value: hideCapsule)
-        .onAppear {
-            Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
-                if isAnimating {
-                    Timer.scheduledTimer(withTimeInterval: animationDuration, repeats: false) { _ in
-                        hideCapsule.toggle()
-                    }
-                    timer.invalidate()
-                }
-            }
-        }
-    }
-}
-
-#Preview {
-    ShrinkingCapsule(rotationAngle: .degrees(35), offset: CGSize(width: 10, height: 10), isAnimating: .constant(false))
-}
```

---

### Incident Patch 2: `d3750af2` (2026-07-05)
**Commit Message**: Fix compiler type-check timeout in LikeView particle burst

Break up the capsule particle expression into explicitly-typed local
bindings so the Swift type-checker doesn't time out on slower machines.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `SwiftUI-Animations/Code/Common/Animations/Like/LikeView.swift` (modified, +6/-5)
```diff
@@ -96,15 +96,16 @@ struct LikeView: View {
                 if isBursting {
                     ForEach(0..<particleCount, id: \.self) { index in
                         let angle = Angle.degrees(Double(index) / Double(particleCount) * 360)
+                        let travel: CGFloat = burstProgress * burstRadius
+                        let offsetX: CGFloat = cos(angle.radians) * travel
+                        let offsetY: CGFloat = sin(angle.radians) * travel
+                        let particleColor = particleColors[index % particleColors.count]
                         Capsule(style: .continuous)
-                            .fill(particleColors[index % particleColors.count])
+                            .fill(particleColor)
                             .frame(width: 10, height: 26)
                             .scaleEffect(1 - burstProgress * 0.7)
                             .rotationEffect(angle + .degrees(90))
-                            .offset(
-                                x: cos(angle.radians) * burstProgress * burstRadius,
-                                y: sin(angle.radians) * burstProgress * burstRadius
-                            )
+                            .offset(x: offsetX, y: offsetY)
                             .opacity(1 - burstProgress)
                     }
                 }
```

---

### Incident Patch 3: `030bd1c7` (2026-08-11)
**Commit Message**: Mark Fluid Grain as new and surface it first in Shaders

Add an isNew flag to ShaderItem (Fluid Grain = true), render the NEW badge on
ShaderCardView like the animation cards, and order the Shaders grid newest-first
so Fluid Grain leads.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `SwiftUI-Animations/Code/Features/Models/ShaderItem.swift` (modified, +2/-1)
```diff
@@ -38,6 +38,7 @@ struct ShaderItem: Identifiable {
     let iconColor: Color
     let destination: ShaderDestination
     let category: ShaderCategory
+    var isNew: Bool = false
 
     // MARK: - All Shaders
     static let all: [ShaderItem] = [
@@ -46,6 +47,6 @@ struct ShaderItem: Identifiable {
         ShaderItem(title: "Ember Reveal",         systemIcon: "sparkles",                    iconColor: Color(r: 255, g: 140, b: 0),   destination: .emberReveal,         category: .effect),
         ShaderItem(title: "Wave Ripple",          systemIcon: "water.waves",                 iconColor: .cyan,                         destination: .rippleEffect,        category: .effect),
         ShaderItem(title: "Glitch",               systemIcon: "bolt.fill",                   iconColor: Color(r: 57,  g: 255, b: 20),  destination: .glitchEffect,        category: .effect),
-        ShaderItem(title: "Fluid Grain",          systemIcon: "drop.fill",                   iconColor: .blue,                         destination: .fluidGrain,          category: .effect),
+        ShaderItem(title: "Fluid Grain",          systemIcon: "drop.fill",                   iconColor: .blue,                         destination: .fluidGrain,          category: .effect, isNew: true),
     ]
 }
```

**File**: `SwiftUI-Animations/Code/Features/ShaderView.swift` (modified, +8/-4)
```diff
@@ -24,18 +24,22 @@ struct ShaderView: View {
     private let animationDuration: TimeInterval = 0.325
 
     private var filteredItems: [ShaderItem] {
-        let baseItems: [ShaderItem]
+        var baseItems: [ShaderItem]
 
         if let selected = selectedCategory {
             baseItems = ShaderItem.all.filter { $0.category == selected }
         } else {
             baseItems = ShaderItem.all
         }
 
-        guard !searchText.isEmpty else { return baseItems }
+        if !searchText.isEmpty {
+            let query = searchText.lowercased()
+            baseItems = baseItems.filter { $0.title.lowercased().contains(query) }
+        }
 
-        let query = searchText.lowercased()
-        return baseItems.filter { $0.title.lowercased().contains(query) }
+        // Surface newly added shaders first. New items are appended chronologically to
+        // ShaderItem.all, so reverse them to show the most recently added first.
+        return baseItems.filter { $0.isNew }.reversed() + baseItems.filter { !$0.isNew }
     }
 
     // MARK: - views
```

**File**: `SwiftUI-Animations/Code/Features/Support Views/ShaderCardView.swift` (modified, +19/-0)
```diff
@@ -26,6 +26,12 @@ struct ShaderCardView: View {
                         .fill(item.iconColor.gradient)
                         .opacity(0.2)
                 }
+                .overlay(alignment: .topTrailing) {
+                    if item.isNew {
+                        newTag
+                            .offset(x: 4, y: -2)
+                    }
+                }
 
             Text(item.title)
                 .font(ClashGrotestk.semibold.font(size: 14))
@@ -37,6 +43,19 @@ struct ShaderCardView: View {
         }
         .frame(maxWidth: .infinity)
     }
+
+    private var newTag: some View {
+        Text("NEW")
+            .font(ClashGrotestk.semibold.font(size: 8))
+            .tracking(1)
+            .foregroundStyle(Color.white)
+            .padding(.horizontal, 6)
+            .padding(.vertical, 3)
+            .background(
+                Capsule()
+                    .fill(Color.accentColor)
+            )
+    }
 }
 
 #Preview {
```

#### Recent Merged Pull Requests:
- **PR #30** (2026-06-19): Add Auto Scroller & Text Bouncing, modernize Like, fix Yin Yang (@Shubham0812)
- **PR #29** (2026-06-19): Force light theme for YinYangAnimationView (@12ya)
- **PR #26** (2026-06-19): resolves #25 (@12ya)
- **PR #22** (2026-03-24): Add 4 high-quality Metal shaders to the Shaders tab (@Shubham0812)
- **PR #21** (2026-03-21): Add EmberReveal shader effect to Shaders tab (@Shubham0812)
- **PR #20** (2026-03-21): Improve README with updated project structure and Shaders (@Shubham0812)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
