# Forensic Learning Record (Deep Inspection): Shubham0812/SwiftUI-Animations

> **Canonical Artifact**: `07_PROJECT_LEARNING/shubham0812-swiftui-animations-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Shubham0812/SwiftUI-Animations](https://github.com/Shubham0812/SwiftUI-Animations))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:30:25.406Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Shubham0812/SwiftUI-Animations`
- **Description**: A repository containing a variety of animations and Animated components created in SwiftUI that you can use in your own projects.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3561 stars

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

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/3dLoader/Support Shapes/FlickeringView.swift`
```
//
//  FlickeringView.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 17/10/20.
//  Copyright © 2020 Shubham Singh. All rights reserved.
//

import SwiftUI

/// A single rectangle that slides from an initial position/size to a final position/size,
/// then fades through a multi-step opacity sequence — used to simulate a lens-flare or
/// light-glint effect during cube face transitions in `RotatingLoaderView`.
///
/// **Opacity sequence (all easeOut):**
/// ```
/// t = 0.1 s   → 0.8  (slide-in + quick brighten)
/// t = 0.75 s  → 0.1  (dim)
/// t = 1.3 s   → 0.7  (brief re-brighten flicker)
/// t = fadeDuration   → 0  (fade out completely)
/// ```
struct FlickeringView: View {

    // MARK: - Variables

    /// Background color of the flickering rectangle (typically matching the face color).
    let backgroundColor: Color
    /// Starting (x, y) offset before the animation fires.
    let initialOffset: CGSize
    /// Starting (width, height) of the rectangle — often a wide, short bar.
    let initialSize: CGSize

    /// Target (width, height) the rectangle morphs to when `isAnimating` becomes `true`.
    let finalSize: CGSize
    /// Target (x, y) offset the rectangle slides to when `isAnimating` becomes `true`.
    let finalOffset: CGSize

    /// Delay before the final fade-to-zero opacity animation fires.
    /// Longer values keep the flicker visible for more of the cube transition.
    let fadeDuration: TimeInterval
    /// Base duration shared by all intermediate opacity animations.
    let animationDuration: TimeInterval = 0.75

    /// Drives the opacity sequence — see struct doc for the full timeline.
    @State var rectangleOpacity: Double = 1
    /// When `true`, the rectangle adopts `finalSize` and `finalOffset`.
    @State var isAnimating: Bool = false

    // MARK: - Views

    var body: some View {
        Rectangle()
            .foregroundStyle(backgroundColor)
            .offset(isAnimating ? finalOffset : initialOffset)
            .frame(
                width: isAnimating ? finalSize.width : initialSize.width,
                height: isAnimating ? finalSize.height : initialSize.height
            )
            .opacity(rectangleOpacity)
            .onAppear {
                Timer.scheduledTimer(withTimeInterval: 0.1, repeats: false) { _ in
                    withAnimation(.easeOut(duration: 0.25)) {
                        isAnimating.toggle()
                    }
                    withAnimation(.easeOut(duration: animationDuration)) {
                        rectangleOpacity = 0.8
                    }
                    withAnimation(.easeOut(duration: animationDuration).delay(animationDuration * 1.5)) {
                        rectangleOpacity = 0.1
                    }
                    withAnimation(.easeOut(duration: animationDuration).delay(animationDuration * 1.75)) {
                        rectangleOpacity = 0.7
                    }
                    withAnimation(.easeOut(duration: animationDuration).delay(fadeDuration)) {
                        rectangleOpacity = 0
                    }
                }
            }
    }
}

#Preview {
    FlickeringView(
        backgroundColor: .black,
        initialOffset: CGSize(width: 50, height: -200),
        initialSize: CGSize(width: 200, height: 40),
        finalSize: CGSize(width: 40, height: 40),
        finalOffset: CGSize(width: -100, height: -200),
        fadeDuration: 4
    )
}

```

### Core Architecture Module: `SwiftUI-Animations/Code/Common/Animations/3dLoader/Support Shapes/RectangleLoaderView.swift`
```
//
//  RectangleLoaderView.swift
//  SwiftUI-Animations
//
//  Created by Shubham Singh on 17/10/20.
//  Copyright © 2020 Shubham Singh. All rights reserved.
//

import SwiftUI

/// Four thin white bars that pulse up and down in a staggered "equalizer" pattern.
///
/// Displayed on the dark face of the 3D cube loader (`RotatingLoaderView`).
/// Each bar has a fixed width (12 pt) and a height that alternates between 25% and 10%
/// of the container width, with delays of 0, 0.2, 0.4, and 0.6 s so they cascade.
///
/// The height is set from `GeometryProxy` on appear so it scales with any container size.
struct RectangleLoaderView: View {

    // MARK: - Variables

    /// Current height of all four bars, driven by `animateRectangles(in:)`.
    @State var rectangleHeight: CGFloat = 12

    // MARK: - Views

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.materialBlack
                    .ignoresSafeArea()
                HStack(alignment: .center, spacing: 8) {
                    Rectangle()
                        .foregroundStyle(.white)
                        .frame(width: 12, height: rectangleHeight)
                        .animation(.easeOut.delay(0), value: rectangleHeight)
                    Rectangle()
                        .foregroundStyle(.white)
                        .frame(width: 12, height: rectangleHeight)
                        .animation(.easeOut.delay(0.2), value: rectangleHeight)
                    Rectangle()
                        .foregroundStyle(.white)
                        .frame(width: 12, height: rectangleHeight)
                        .animation(.easeOut.delay(0.4), value: rectangleHeight)
                    Rectangle()
                        .foregroundStyle(.white)
                        .frame(width: 12, height: rectangleHeight)
                        .animation(.easeOut.delay(0.6), value: rectangleHeight)
                }
                .onAppear {
                    rectangleHeight = geometry.size.width * 0.25
                    animateRectangles(in: geometry)
                    Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { _ in
                        animateRectangles(in: geometry)
                    }
                }
            }
        }
    }

    // MARK: - Functions

    /// Pulses bar heights: expands to 25% of container width, then collapses to 10% after 0.5 s.
    /// Called on appear and repeats every 1.5 s so the animation loops continuously.
    func animateRectangles(in geometry: GeometryProxy) {
        rectangleHeight = geometry.size.width * 0.25
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { _ in
            rectangleHeight = geometry.size.width * 0.1
        }
    }
}

#Preview {
    RectangleLoaderView()
        .frame(width: 200, height: 200)
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

### Incident Patch 1: `030bd1c7` (2026-08-11)
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

---

### Incident Patch 2: `e708de3c` (2026-08-11)
**Commit Message**: Add Fluid Grain shader with color-picker toolbar menu

- Port the FluidGrain shader (animated smoky wave + film grain over black)
  as a new Shaders entry, registered in ShaderItem + ShaderView.
- Add a nav-bar color swatch that opens a custom pop-up menu of preset tints,
  recoloring the shader's glow live (routes haptics through HapticManager).
- Rename the Metal grain helper to fluidGrainRandom to avoid duplicate symbols.
- Add demo GIF and surface it (newest-first) in the README gallery; keep the
  NEW tag on the three most recent additions.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +37/-20)
```diff
@@ -61,6 +61,15 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 <tr>
 <td width="33%" align="center">
 
+**Fluid Grain** 🆕
+
+<img src="SwiftUI-Animations/GIFs/fluid-grain.gif" width="220"/>
+
+[View Code](SwiftUI-Animations/Code/Common/Shaders/FluidGrain)
+
+</td>
+<td width="33%" align="center">
+
 **3-D Graph** 🆕
 
 <img src="SwiftUI-Animations/GIFs/3-d-graph.gif" width="220"/>
@@ -77,17 +86,17 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Cards%20Shuffle)
 
 </td>
-<td width="33%" align="center">
+</tr>
+<tr>
+<td align="center">
 
-**Light Bulb** 🆕
+**Light Bulb**
 
 <img src="SwiftUI-Animations/GIFs/light-bulb.gif" width="220"/>
 
 [View Code](SwiftUI-Animations/Code/Common/Animations/Light%20Bulb)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Circular Download**
@@ -106,6 +115,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Auto%20Scroller)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Text Bouncing**
@@ -115,8 +126,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Text%20Bouncing)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Scratch to Reveal**
@@ -135,6 +144,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Cards%20Swap)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Text Swirl**
@@ -144,8 +155,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/TextSwirl)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Yin-Yang Toggle**
@@ -164,6 +173,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Cart)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Chat Bar**
@@ -173,8 +184,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/ChatBar)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Wi-Fi Signal**
@@ -193,6 +202,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Loader)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Add Item**
@@ -202,8 +213,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/AddView)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Circle Loader**
@@ -222,6 +231,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/PillLoader)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Like Button**
@@ -231,8 +242,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Like)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Submit Button**
@@ -251,6 +260,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/GithubLoader)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **3D Rotating Loader**
@@ -260,8 +271,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/3dLoader)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Animated Login**
@@ -280,6 +289,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/BookLoader)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Card Viewer**
@@ -289,8 +300,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/Bank%20Card)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Infinity Loader**
@@ -309,6 +318,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/LightSwitch)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Spinning Loader**
@@ -318,8 +329,6 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/SpinningLoader)
 
 </td>
-</tr>
-<tr>
 <td align="center">
 
 **Download Button**
@@ -338,6 +347,8 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 [View Code](SwiftUI-Animations/Code/Common/Animations/TriangleLoader)
 
 </td>
+</tr>
+<tr>
 <td align="center">
 
 **Octocat Wink**
@@ -346,6 +357,12 @@ Select a simulator and hit **Run** - each animation is accessible from the home
 
 [View Code](SwiftUI-Animations/Code/Common/Animations/Octo
```

**File**: `SwiftUI-Animations/Code/Common/Shaders/FluidGrain/FluidGrain.metal` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+//
+//  FluidGrain.metal
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 09/08/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+#include <metal_stdlib>
+#include <SwiftUI/SwiftUI_Metal.h>
+using namespace metal;
+
+// Pseudo-random noise used for the film grain. Named uniquely so it doesn't
+// collide with helpers of the same purpose in other shaders' Metal files.
+float fluidGrainRandom(float2 p) {
+    return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453123);
+}
+
+/// A slow, smoky vertical wave of `glowColor` over black, with a film-grain overlay.
+/// - `time` drives the motion; - `glowColor` tints the glowing wave.
+[[ stitchable ]] half4 fluidGrain(float2 position, half4 currentColor, float time, half4 glowColor) {
+
+    // Normalize coordinates (~0.0 to 0.5 on X, ~0.0 to 1.1 on Y for standard phones)
+    float2 uv = position / 800.0;
+
+    // Keep the speed slow and elegant
+    float t = time * 0.3;
+
+    float2 warpedUV = uv;
+
+    // 1. Fold the Y Space
+    // We distort the Y axis based on X. This causes the wave to compress and stretch
+    // vertically, which gives it that distinctly "smoky" folded look.
+    warpedUV.y += sin(uv.x * 5.0 - t) * 0.15;
+
+    // 2. Create the Snaking Wave
+    // We heavily warp the X axis using multiple sine waves.
+    // The maximum this math can swing is mathematically capped at ±0.20.
+    warpedUV.x += sin(warpedUV.y * 4.0 + t * 1.2) * 0.12 + cos(warpedUV.y * 2.5 - t * 0.9) * 0.08;
+
+    // 3. The Anchor Path
+    // We draw a straight line at X = 0.55 in this deeply warped space.
+    // Because the space itself is snaking back and forth, the straight line becomes a fluid wave.
+    float path = 0.55;
+    float distanceToCurve = abs(warpedUV.x - path);
+
+    // 4. Glow Falloff
+    // A distance of 0.3 guarantees the glow reaches the left side of the screen
+    // but smoothly fades out before consuming the pure black corner.
+    float glow = 1.0 - smoothstep(0.0, 0.3, distanceToCurve);
+
+    // 5. Internal Smoky Texture
+    // Adds faint dark wisps inside the color so it isn't a solid, flat fill.
+    glow *= (sin(warpedUV.y * 12.0 - t * 2.0) * 0.1 + 0.9);
+    glow = clamp(glow, 0.0, 1.0);
+
+    // 6. Colors and Grain
+    half4 bgColor = half4(0.0, 0.0, 0.0, 1.0);
+    half4 finalColor = mix(bgColor, glowColor, half(glow));
+
+    float noise = fluidGrainRandom(position + float2(time * 50.0, -time * 50.0));
+    finalColor.rgb += half3(noise * 0.12);
+
+    return finalColor;
+}
```

**File**: `SwiftUI-Animations/Code/Common/Shaders/FluidGrain/FluidGrainView.swift` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+//
+//  FluidGrainView.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 09/08/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK: - FluidGrainView
+
+/// A full-screen, animated shader background: a slow "smoky" wave of a tint color drifting
+/// over black, dusted with film grain (`FluidGrain.metal`).
+///
+/// A small color swatch in the navigation bar opens a custom pop-up menu of preset tints,
+/// letting the viewer recolor the glow live.
+struct FluidGrainView: View {
+
+    // MARK: - variables
+
+    /// The glow color fed into the shader. Changing it recolors the wave in real time.
+    @State private var themeColor: Color = .blue
+
+    /// Whether the custom color menu is showing.
+    @State private var showColorMenu = false
+
+    /// Anchor for driving the shader's time uniform.
+    private let startDate = Date()
+
+    /// Preset tints offered in the color menu.
+    private let palette: [Color] = [
+        .blue, .purple, .pink, .red,
+        .orange, .yellow, .green, .teal,
+    ]
+
+    // MARK: - views
+    var body: some View {
+        TimelineView(.animation) { timeline in
+            let elapsedTime = timeline.date.timeIntervalSince(startDate)
+
+            Rectangle()
+                .colorEffect(
+                    ShaderLibrary.fluidGrain(
+                        .float(elapsedTime),
+                        .color(themeColor)
+                    )
+                )
+        }
+        .ignoresSafeArea()
+        .navigationBarTitleDisplayMode(.inline)
+        .toolbar {
+            ToolbarItem(placement: .topBarTrailing) {
+                colorPickerButton
+            }
+        }
+    }
+
+    // MARK: - views (private)
+
+    /// The navigation-bar swatch showing the current tint. Tapping it opens the color menu.
+    private var colorPickerButton: some View {
+        Button {
+            HapticManager().makeImpactFeedback(mode: .light)
+            showColorMenu.toggle()
+        } label: {
+            Circle()
+                .fill(themeColor)
+                .frame(width: 24, height: 24)
+                .overlay(Circle().stroke(.white.opacity(0.7), lineWidth: 1.5))
+                .shadow(color: themeColor.opacity(0.6), radius: 4)
+        }
+        .popover(isPresented: $showColorMenu) {
+            colorMenu
+                .presentationCompactAdaptation(.popover)
+        }
+    }
+
+    /// The custom pop-up menu: a compact grid of tappable color swatches.
+    private var colorMenu: some View {
+        let columns = Array(repeating: GridItem(.fixed(40), spacing: 14), count: 4)
+
+        return VStack(alignment: .leading, spacing: 12) {
+            Text("Glow Color")
+                .font(.system(size: 13, weight: .semibold))
+                .foregroundStyle(.secondary)
+
+            LazyVGrid(columns: columns, spacing: 14) {
+                ForEach(Array(palette.enumerated()), id: \.offset) { _, color in
+                    let isSelected = color == themeColor
+
+                    Circle()
+                        .fill(color)
+                        .frame(width: 40, height: 40)
+                        .overlay {
+                            // Ring the currently selected swatch.
+                            Circle()
+                                .stroke(Color.primary, lineWidth: isSelected ? 3 : 0)
+                                .padding(-3)
+                        }
+                        .overlay {
+                            if isSelected {
+                                Image(systemName: "checkmark")
+                                    .font(.system(size: 15, weight: .bold))
+                                    .foregroundStyle(.white)
+                            }
+                        }
+                        .contentShape(Circle())
+                        .onTapGesture {
+                            HapticManager().makeSelectionFeedback()
+                            withAnimation(.snappy(duration: 0.2)) {
+                                themeColor = color
+                            }
+                            showColorMenu = false
+                        }
+                }
+            }
+        }
+        .padding(16)
+        .frame(width: 232)
+    }
+}
+
+#Preview {
+    NavigationStack {
+        FluidGrainView()
+    }
+}
```

**File**: `SwiftUI-Animations/Code/Features/Models/ShaderItem.swift` (modified, +2/-0)
```diff
@@ -26,6 +26,7 @@ enum ShaderDestination: Hashable {
     case chromaticAberration
     case halftone
     case glitchEffect
+    case fluidGrain
 }
 
 // MARK: - ShaderItem
@@ -45,5 +46,6 @@ struct ShaderItem: Identifiable {
         ShaderItem(title: "Ember Reveal",         systemIcon: "sparkles",                    iconColor: Color(r: 255, g: 140, b: 0),   destination: .emberReveal,         category: .effect),
         ShaderItem(title: "Wave Ripple",          systemIcon: "water.waves",                 iconColor: .cyan,                         destination: .rippleEffect,        category: .effect),
         ShaderItem(title: "Glitch",               systemIcon: "bolt.fill",                   iconColor: Color(r: 57,  g: 255, b: 20),  destination: .glitchEffect,        category: .effect),
+        ShaderItem(title: "Fluid Grain",          systemIcon: "drop.fill",                   iconColor: .blue,                         destination: .fluidGrain,          category: .effect),
     ]
 }
```

**File**: `SwiftUI-Animations/Code/Features/ShaderView.swift` (modified, +3/-0)
```diff
@@ -144,6 +144,9 @@ struct ShaderView: View {
 
         case .glitchEffect:
             GlitchEffectView()
+
+        case .fluidGrain:
+            FluidGrainView()
         }
     }
 }
```

---

### Incident Patch 3: `2f5b377a` (2026-07-14)
**Commit Message**: Fix CardsShuffleView

**File**: `SwiftUI-Animations/Code/Common/Animations/Cards Shuffle/CardsShuffleView.swift` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ struct CardsShuffleView: View {
         ShuffleCard(color: Color(white: 0.9)),      // Light gray (back)
         ShuffleCard(color: .blue),                  // Blue
         ShuffleCard(color: .red),                   // Red
-        ShuffleCard(color: Color(hex: "CCB333"))    // Yellow (front)
+        ShuffleCard(color: Color.yellow)    // Yellow (front)
     ]
 
     /// Live translation of the front card while a drag is in progress.
@@ -56,7 +56,7 @@ struct CardsShuffleView: View {
     // MARK: - Views
     var body: some View {
         ZStack {
-            Color.black
+            Color.background
                 .ignoresSafeArea()
 
             ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
```

---

### Incident Patch 4: `5e96f494` (2026-07-14)
**Commit Message**: Fix EmberReveal shader for full-size view

Feed the shader the real rendered size via GeometryReader instead of a
hardcoded 350x500, so `uv = position / size` normalizes correctly and the
center-out burn covers the whole view. Frame the image to the proxy size and
clip it so the effect's coordinate space matches the size passed in.

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `SwiftUI-Animations/Code/Common/Shaders/EmberReveal/EmberReveal.swift` (modified, +33/-27)
```diff
@@ -16,39 +16,45 @@ struct EmberRevealView: View {
 
     // MARK: - views
     var body: some View {
-        ZStack {
-            Color.background
-                .ignoresSafeArea()
+        // GeometryReader gives us the real rendered size so the shader can normalize
+        // coordinates correctly. The `emberReveal` shader computes `uv = position / size`,
+        // so `size` must match the view's actual bounds — passing a hardcoded size breaks
+        // the center-out reveal whenever the image isn't exactly that size.
+        GeometryReader { proxy in
+            ZStack {
+                Color.black
+                    .ignoresSafeArea()
 
-            Image(.charmeleon)
-                .resizable()
-                .scaledToFill()
-                .frame(width: 350, height: 400)
-                .clipped()
-                .layerEffect(
-                    ShaderLibrary.emberReveal(
-                        .float(progress),
-                        .float2(CGSize(width: 350, height: 300))
-                    ),
-                    maxSampleOffset: .zero
-                )
-                .background {
-                    RoundedRectangle(cornerRadius: 12)
-                        .foregroundStyle(.gray.opacity(0.1))
-                }
-                .cornerRadius(12)
-                .offset(y: -40)
-                .onTapGesture {
-                    progress = 0.0
-                    withAnimation(.interpolatingSpring(stiffness: 5, damping: 12)) {
-                        progress = 1.0
+                Image(.landing1)
+                    .resizable()
+                    .scaledToFill()
+                    .frame(width: proxy.size.width, height: proxy.size.height)
+                    .clipped()
+                    .layerEffect(
+                        ShaderLibrary.emberReveal(
+                            .float(progress),
+                            .float2(proxy.size)
+                        ),
+                        maxSampleOffset: .zero
+                    )
+                    .background {
+                        RoundedRectangle(cornerRadius: 12)
+                            .foregroundStyle(.gray.opacity(0.1))
                     }
-                }
+                    .onTapGesture {
+                        progress = 0.0
+                        withAnimation(.smooth(duration: 5)) {
+                            progress = 1.0
+                        }
+                    }
+            }
+            .frame(width: proxy.size.width, height: proxy.size.height)
         }
+        .ignoresSafeArea()
         .overlay(alignment: .top) {
             Text("Tap to reveal")
                 .font(.system(size: 17, weight: .medium))
-                .foregroundStyle(Color.label)
+                .foregroundStyle(Color.background)
                 .padding(.top, 24)
         }
         .navigationBarTitleDisplayMode(.inline)
```

---

### Incident Patch 5: `d3750af2` (2026-07-05)
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

### Incident Patch 6: `8e44dda8` (2026-06-18)
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

### Incident Patch 7: `3b725d02` (2026-03-21)
**Commit Message**: Fix Tree Structure

**File**: `.claude/worktrees/wonderful-rubin` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 176d3ac356041609df44ff9f9029448fb98e717e
+Subproject commit d43ecbd4251d736659664c9e3eb67c183e26faa6
```

**File**: `SwiftUI-Animations.xcodeproj/project.pbxproj` (modified, +14/-14)
```diff
@@ -7,9 +7,9 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
-		512788882F6DC3C1004FEFB2 /* AppCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788842F6DC3C1004FEFB2 /* AppCoordinator.swift */; };
-		512788892F6DC3C1004FEFB2 /* RootView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788862F6DC3C1004FEFB2 /* RootView.swift */; };
-		5127888A2F6DC3C1004FEFB2 /* AppTab.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788852F6DC3C1004FEFB2 /* AppTab.swift */; };
+		51278DE72F6DE6C1004FEFB2 /* AppTab.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51278DE42F6DE6C1004FEFB2 /* AppTab.swift */; };
+		51278DE82F6DE6C1004FEFB2 /* RootView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51278DE52F6DE6C1004FEFB2 /* RootView.swift */; };
+		51278DE92F6DE6C1004FEFB2 /* AppCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51278DE32F6DE6C1004FEFB2 /* AppCoordinator.swift */; };
 		51370C4324EBD59A00103512 /* LoaderState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51370C4224EBD59A00103512 /* LoaderState.swift */; };
 		51390968250D1FAE000CE14A /* LikeView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51390967250D1FAE000CE14A /* LikeView.swift */; };
 		51464370250BCB830046D835 /* WaveFill.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5146436F250BCB830046D835 /* WaveFill.swift */; };
@@ -109,9 +109,9 @@
 
 /* Begin PBXFileReference section */
 		13DB8C183AB5B4355AA33084 /* Router.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = Router.swift; path = Navigation/Router.swift; sourceTree = "<group>"; };
-		512788842F6DC3C1004FEFB2 /* AppCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppCoordinator.swift; sourceTree = "<group>"; };
-		512788852F6DC3C1004FEFB2 /* AppTab.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppTab.swift; sourceTree = "<group>"; };
-		512788862F6DC3C1004FEFB2 /* RootView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RootView.swift; sourceTree = "<group>"; };
+		51278DE32F6DE6C1004FEFB2 /* AppCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppCoordinator.swift; sourceTree = "<group>"; };
+		51278DE42F6DE6C1004FEFB2 /* AppTab.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppTab.swift; sourceTree = "<group>"; };
+		51278DE52F6DE6C1004FEFB2 /* RootView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RootView.swift; sourceTree = "<group>"; };
 		51370C4224EBD59A00103512 /* LoaderState.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LoaderState.swift; sourceTree = "<group>"; };
 		51390967250D1FAE000CE14A /* LikeView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LikeView.swift; sourceTree = "<group>"; };
 		5146436F250BCB830046D835 /* WaveFill.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WaveFill.swift; sourceTree = "<group>"; };
@@ -221,12 +221,12 @@
 /* End PBXFrameworksBuildPhase section */
 
 /* Begin PBXGroup section */
-		512788872F6DC3C1004FEFB2 /* App */ = {
+		51278DE62F6DE6C1004FEFB2 /* App */ = {
 			isa = PBXGroup;
 			children = (
-				512788842F6DC3C1004FEFB2 /* AppCoordinator.swift */,
-				512788852F6DC3C1004FEFB2 /* AppTab.swift */,
-				512788862F6DC3C1004FEFB2 /* RootView.swift */,
+				51278DE32F6DE6C1004FEFB2 /* AppCoordinator.swift */,
+				51278DE42F6DE6C1004FEFB2 /* AppTab.swift */,
+				51278DE52F6DE6C1004FEFB2 /* RootView.swift */,
 			);
 			path = App;
 			sourceTree = "<group>";
@@ -682,7 +682,7 @@
 			children = (
 				F3DA13CD2535B976005E384E /* Home */,
 				C30857784914BCE8CAE99041 /* Shaders */,
-				512788872F6DC3C1004FEFB2 /* App */,
+				51278DE62F6DE6C1004FEFB2 /* App */,
 			);
 			path = Modules;
 			sourceTree = "<group>";
@@ -869,6 +869,9 @@
 			buildActionMask = 2147483647;
 			files = (
 				F34DDAC22573E859009BAF83 /* CardPatternOneView.swift in Sources */,
+				51278DE72F6DE6C1004FEFB2 /* AppTab.swift in Sources */,
+				51278DE82F6DE6C1004FEFB2 /* RootView.swift in Sources */,
+				51278DE92F6DE6C1004FEFB2 /* AppCoordinator.swift in Sources */,
 				F3DAEDF4253B23960067F963 /* FlickeringView.swift in Sources */,
 				518E823124DAA665002CB679 /* AppDelegate.swift in Sources */,
 				51464374250BD8840046D835 /* FillShapes.swift in Sources */,
@@ -948,9 +951,6 @@
 				51C8BB2024E4514B00DCE354 /* LoaderView.swift in Sources */,
 				51CBD281250B69550005D9C2 /* Pill.swift in Sources */,
 				51AFB36524DB00AD006840D3 /* CartView.swift in Sources */,
-				512788882F6DC3C1004FEFB2 /* AppCoordinator.swift in Sources */,
-				512788892F6DC3C1004FEFB2 /* RootView.swift in Sources */,
-				5127888A2F6DC3C1004FEFB2 /* AppTab.swift in Sources */,
 				F34DDAC82573E9C5009BAF83 /* CardBackView.swift in Sources */,
 			
```

**File**: `SwiftUI-Animations/Code/Modules/App/AppCoordinator.swift` (renamed, +2/-2)
```diff
@@ -26,8 +26,8 @@ final class AppCoordinator: ObservableObject {
     // MARK:- variables
     @Published var selectedTab: AppTab = .home
 
-    let homeRouter    = Router<AnimationDestination>()
-    let shadersRouter = Router<ShaderDestination>()
+    var homeRouter    = Router<AnimationDestination>()
+    var shadersRouter = Router<ShaderDestination>()
 
     // MARK:- functions
     /// Selects a tab. If the tab is already active, pops its navigation stack to root —
```

---

### Incident Patch 8: `d43ecbd4` (2026-03-21)
**Commit Message**: Add Shaders tab: ShaderItem model, BurnEffect shader, and grid UI

Model layer (mirrors AnimationItem pattern):
- ShaderCategory enum: effect, filter, transition
- ShaderDestination enum: .burnEffect (moved out of ShaderView)
- ShaderItem struct with static `all` list; Burn Effect is first entry

View layer (mirrors HomeView/AnimationCardView pattern):
- ShaderCardView — card component typed to ShaderItem
- ShaderView — full LazyVGrid with chip-based category filter,
  searchable toolbar (iOS 17 + iOS 26 paths), and navigationDestination
- BurnEffectView — interactive demo: tap to burn (progress 1→0
  over 7s), tap again to restore; uses ClashGrotesk font and haptics

Shader layer:
- BurnEffect.metal — Metal layer-effect shader (SwiftUI_Metal.h),
  FBM noise field perturbs burn threshold for organic fire edge,
  charcoal → deep-red → orange → yellow gradient at burn line
- BurnEffect.swift — BurnEffectModifier (TimelineView for elapsed
  time) + BurnLayoutWrapper (visualEffect for geometry-aware size)
  + `View.burnEffect(progress:)` convenience extension

Register all 5 new files in Xcode project (xcodeproj group + compile sources).

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EM

**File**: `SwiftUI-Animations.xcodeproj/project.pbxproj` (modified, +20/-0)
```diff
@@ -7,6 +7,8 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		13C4EF4072EA95FE5712AB9F /* ShaderCardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = C984C1BB5A22CDC75B79AF84 /* ShaderCardView.swift */; };
+		33D1AA061FE48DB9A7AEA4B4 /* BurnEffect.metal in Sources */ = {isa = PBXBuildFile; fileRef = CF1365C17E3EE017173AEF3C /* BurnEffect.metal */; };
 		512788882F6DC3C1004FEFB2 /* AppCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788842F6DC3C1004FEFB2 /* AppCoordinator.swift */; };
 		512788892F6DC3C1004FEFB2 /* RootView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788862F6DC3C1004FEFB2 /* RootView.swift */; };
 		5127888A2F6DC3C1004FEFB2 /* AppTab.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788852F6DC3C1004FEFB2 /* AppTab.swift */; };
@@ -57,11 +59,13 @@
 		51D6273A24E19F2A00BCE1C8 /* WifiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51D6273924E19F2A00BCE1C8 /* WifiView.swift */; };
 		51DAC7B3250E07E800ECA895 /* ShrinkingCapsule.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51DAC7B2250E07E800ECA895 /* ShrinkingCapsule.swift */; };
 		51F6B07F24E81E0300EF840F /* Loader.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51F6B07E24E81E0300EF840F /* Loader.swift */; };
+		57C8CFECFA2B6A61BFF95769 /* BurnEffect.swift in Sources */ = {isa = PBXBuildFile; fileRef = DD88173E5456A175B31881EE /* BurnEffect.swift */; };
 		88CFFAAD54008A8AC63D9F0B /* Router.swift in Sources */ = {isa = PBXBuildFile; fileRef = 13DB8C183AB5B4355AA33084 /* Router.swift */; };
 		A141DA849790664EA6C96AA6 /* ShaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = CCAB44CCA0F93E933A6470DE /* ShaderView.swift */; };
 		AA0001012603180100000001 /* AnimationItem.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001002603180100000001 /* AnimationItem.swift */; };
 		AA0001032603180100000002 /* AnimationCardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001022603180100000002 /* AnimationCardView.swift */; };
 		AA0001052603180100000003 /* HomeView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001042603180100000003 /* HomeView.swift */; };
+		B05671FDF36C7F2AA06BC2E2 /* BurnEffectView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5377E70B90901D0CFB5AC756 /* BurnEffectView.swift */; };
 		CF0001AB2603180100000001 /* FontManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = CF0001AA2603180100000001 /* FontManager.swift */; };
 		CF0001DB2603180100000001 /* ClashGrotesk-Bold.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001DA2603180100000001 /* ClashGrotesk-Bold.otf */; };
 		CF0001EB2603180100000001 /* ClashGrotesk-Extralight.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001EA2603180100000001 /* ClashGrotesk-Extralight.otf */; };
@@ -70,6 +74,7 @@
 		CF0002BB2603180100000001 /* ClashGrotesk-Regular.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002BA2603180100000001 /* ClashGrotesk-Regular.otf */; };
 		CF0002CB2603180100000001 /* ClashGrotesk-Semibold.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002CA2603180100000001 /* ClashGrotesk-Semibold.otf */; };
 		DAF98EFF25F0D07F0052EDB8 /* SpinningView.swift in Sources */ = {isa = PBXBuildFile; fileRef = DAF98EFE25F0D07F0052EDB8 /* SpinningView.swift */; };
+		F2F8DEF7A88949A448785480 /* ShaderItem.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3C192F14E3BD6F4373E5B5CA /* ShaderItem.swift */; };
 		F30BA967254418B300DC8367 /* LoginView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F30BA966254418B300DC8367 /* LoginView.swift */; };
 		F30BA96C25441BED00DC8367 /* Plus.swift in Sources */ = {isa = PBXBuildFile; fileRef = F30BA96B25441BED00DC8367 /* Plus.swift */; };
 		F30BA97025441E3200DC8367 /* ShrinkingPlus.swift in Sources */ = {isa = PBXBuildFile; fileRef = F30BA96F25441E3200DC8367 /* ShrinkingPlus.swift */; };
@@ -109,6 +114,7 @@
 
 /* Begin PBXFileReference section */
 		13DB8C183AB5B4355AA33084 /* Router.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = Router.swift; path = Navigation/Router.swift; sourceTree = "<group>"; };
+		3C192F14E3BD6F4373E5B5CA /* ShaderItem.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = ShaderItem.swift; path = Shaders/ShaderItem.swift; sourceTree = "<group>"; };
 		512788842F6DC3C1004FEFB2 /* AppCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppCoordinator.swift; sourceTree = "<group>"; };
 		512788852F6DC3C1004FEFB2 /* AppTab.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppTab.swift; sourceTree = "<group>"; };
 		512788862F6DC3C1004FEFB2 /* RootView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RootView.swift; sourceTree = "<group>"; };
@@ -161,9 +167,11 @@
 		51D6273924E19F2A00BCE1C8 /* WifiView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; p
```

**File**: `SwiftUI-Animations/Code/Modules/Shaders/BurnEffect.metal` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+//
+//  BurnEffect.metal
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 21/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+#include <metal_stdlib>
+#include <SwiftUI/SwiftUI_Metal.h>
+
+using namespace metal;
+
+// MARK: - Noise Utilities
+
+/// Gradient-hash for two dimensions.
+static float2 hash2(float2 p) {
+    p = float2(dot(p, float2(127.1, 311.7)),
+               dot(p, float2(269.5, 183.3)));
+    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
+}
+
+/// Smooth gradient noise in [-1, 1].
+static float gradientNoise(float2 p) {
+    float2 i = floor(p);
+    float2 f = fract(p);
+    float2 u = f * f * (3.0 - 2.0 * f);   // smoothstep
+    return mix(
+        mix(dot(hash2(i + float2(0, 0)), f - float2(0, 0)),
+            dot(hash2(i + float2(1, 0)), f - float2(1, 0)), u.x),
+        mix(dot(hash2(i + float2(0, 1)), f - float2(0, 1)),
+            dot(hash2(i + float2(1, 1)), f - float2(1, 1)), u.x),
+        u.y);
+}
+
+/// Fractal Brownian Motion — sums several octaves of gradient noise.
+static float fbm(float2 p) {
+    float value     = 0.0;
+    float amplitude = 0.5;
+    for (int i = 0; i < 5; i++) {
+        value     += amplitude * gradientNoise(p);
+        p         *= 2.1;
+        amplitude *= 0.5;
+    }
+    return value;
+}
+
+// MARK: - Burn Effect Shader
+
+/// SwiftUI layer-effect shader that renders an animated burn / fire dissolve.
+///
+/// Parameters (passed via `ShaderLibrary.burnEffect(...)`):
+///   - size     : view size in points (float2)
+///   - progress : 1.0 = intact, 0.0 = fully burned (float)
+///   - time     : elapsed seconds, drives fire animation (float)
+///
+/// The burn sweeps from **top → bottom** as `progress` decreases.
+/// An FBM noise field perturbs the burn threshold, producing an organic,
+/// flickering fire edge with a charcoal → deep-red → orange → yellow gradient.
+[[stitchable]] half4 burnEffect(float2 position,
+                                SwiftUI::Layer layer,
+                                float2 size,
+                                float  progress,
+                                float  time) {
+    float2 uv = position / size;
+
+    // --- Animated noise displaces the horizontal burn edge ---
+    float2 noiseCoord = float2(uv.x * 5.0 + time * 0.15,
+                               uv.y * 5.0 + time * 0.10);
+    float noiseVal = fbm(noiseCoord) * 0.14;
+
+    // progress 1→0 maps burn threshold across the view top→bottom
+    float threshold = (1.0 - progress) + noiseVal;
+    float edgeWidth = 0.045;
+
+    // --- Fully burned: transparent ---
+    if (uv.y < threshold - edgeWidth) {
+        return half4(0.0);
+    }
+
+    // --- Fire edge: charcoal → deep-red → orange → yellow ---
+    if (uv.y < threshold) {
+        float t = clamp((uv.y - (threshold - edgeWidth)) / edgeWidth, 0.0, 1.0);
+
+        half3 charcoal = half3(0.05, 0.02, 0.00);
+        half3 deepRed  = half3(0.80, 0.10, 0.00);
+        half3 orange   = half3(1.00, 0.50, 0.00);
+        half3 yellow   = half3(1.00, 0.95, 0.30);
+
+        half3 col;
+        if (t < 0.33) {
+            col = mix(charcoal, deepRed, half(t / 0.33));
+        } else if (t < 0.66) {
+            col = mix(deepRed, orange, half((t - 0.33) / 0.33));
+        } else {
+            col = mix(orange,  yellow, half((t - 0.66) / 0.34));
+        }
+
+        float alpha = mix(0.0, 1.0, t);
+        return half4(col * half(alpha), half(alpha));
+    }
+
+    // --- Unburned: sample original texture ---
+    return layer.sample(position);
+}
```

**File**: `SwiftUI-Animations/Code/Modules/Shaders/BurnEffect.swift` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+//
+//  BurnEffect.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 21/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK: - BurnEffectModifier
+/// A `ViewModifier` that applies an animated burn/fire dissolve effect via a Metal layer shader.
+///
+/// The shader sweeps from top to bottom as `progress` moves from `1.0` (fully intact)
+/// to `0.0` (fully burned away). An organic noise layer gives the burn edge its
+/// flickering, fire-like shape, driven by the elapsed animation time.
+///
+/// Usage:
+/// ```swift
+/// myView.burnEffect(progress: progress)
+/// ```
+struct BurnEffectModifier: ViewModifier {
+
+    // MARK: - variables
+    var progress: Double
+    @State private var startDate = Date()
+
+    // MARK: - views
+    func body(content: Content) -> some View {
+        TimelineView(.animation) { timeline in
+            let elapsedTime = timeline.date.timeIntervalSince(startDate)
+            content
+                .modifier(BurnLayoutWrapper(progress: progress, time: elapsedTime))
+        }
+    }
+}
+
+// MARK: - BurnLayoutWrapper
+/// Bridges geometry-aware data (view size) to the Metal shader via `visualEffect`.
+struct BurnLayoutWrapper: ViewModifier {
+
+    // MARK: - variables
+    var progress: Double
+    var time: Double
+
+    // MARK: - views
+    func body(content: Content) -> some View {
+        content
+            .visualEffect { content, geometryProxy in
+                content.layerEffect(
+                    ShaderLibrary.burnEffect(
+                        .float2(geometryProxy.size.width, geometryProxy.size.height),
+                        .float(progress),
+                        .float(time)
+                    ),
+                    maxSampleOffset: .zero
+                )
+            }
+    }
+}
+
+// MARK: - View Extension
+extension View {
+    /// Applies an animated burn/fire dissolve shader to this view.
+    ///
+    /// - Parameter progress: `1.0` = fully intact, `0.0` = fully burned away.
+    func burnEffect(progress: Double) -> some View {
+        self.modifier(BurnEffectModifier(progress: progress))
+    }
+}
```

**File**: `SwiftUI-Animations/Code/Modules/Shaders/BurnEffectView.swift` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+//
+//  BurnEffectView.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 21/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK: - BurnEffectView
+struct BurnEffectView: View {
+
+    // MARK: - variables
+    @State private var progress: Double = 1.0
+    @State private var hasBurned: Bool  = false
+
+    // MARK: - views
+    var body: some View {
+        ZStack {
+            Color.background
+                .ignoresSafeArea()
+
+            VStack {
+                ZStack {
+                    RoundedRectangle(cornerRadius: 24)
+                        .foregroundStyle(
+                            LinearGradient(
+                                colors: [.blue, .cyan],
+                                startPoint: .top,
+                                endPoint: .bottom
+                            )
+                        )
+                        .burnEffect(progress: progress)
+                        .clipShape(RoundedRectangle(cornerRadius: 24))
+
+                    RoundedRectangle(cornerRadius: 24)
+                        .stroke(lineWidth: 4)
+                        .foregroundStyle(Color.label)
+                }
+                .rotationEffect(.degrees(180))
+                .frame(width: 340, height: 500)
+            }
+            .onTapGesture {
+                HapticManager().makeImpactFeedback(mode: .medium)
+                if hasBurned {
+                    progress   = 1.0
+                    hasBurned  = false
+                } else {
+                    withAnimation(.snappy(duration: 7)) {
+                        progress = 0.0
+                    }
+                    hasBurned = true
+                }
+            }
+        }
+        .overlay(alignment: .top) {
+            Text(hasBurned ? "Tap to restore" : "Tap to ignite the burn")
+                .font(ClashGrotestk.medium.font(size: 17))
+                .foregroundStyle(Color.label)
+                .padding(.top, 24)
+                .animation(.smooth, value: hasBurned)
+        }
+        .navigationTitle("Burn Effect")
+        .navigationBarTitleDisplayMode(.inline)
+    }
+}
+
+#Preview {
+    NavigationStack {
+        BurnEffectView()
+    }
+}
```

**File**: `SwiftUI-Animations/Code/Modules/Shaders/ShaderCardView.swift` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+//
+//  ShaderCardView.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 21/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+struct ShaderCardView: View {
+
+    // MARK: - variables
+    let item: ShaderItem
+
+    // MARK: - views
+    var body: some View {
+        VStack(spacing: 12) {
+            Image(systemName: item.systemIcon)
+                .font(.system(size: 32, weight: .semibold))
+                .foregroundStyle(Color.label)
+                .frame(width: 60, height: 60)
+                .padding(6)
+                .background {
+                    Circle()
+                        .fill(item.iconColor.gradient)
+                        .opacity(0.2)
+                }
+
+            Text(item.title)
+                .font(ClashGrotestk.semibold.font(size: 14))
+                .tracking(0.1)
+                .foregroundStyle(Color.label)
+                .multilineTextAlignment(.center)
+                .lineLimit(2)
+                .minimumScaleFactor(0.8)
+        }
+        .frame(maxWidth: .infinity)
+    }
+}
+
+#Preview {
+    ShaderCardView(item: ShaderItem.all[0])
+        .padding()
+}
```

**File**: `SwiftUI-Animations/Code/Modules/Shaders/ShaderItem.swift` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+//
+//  ShaderItem.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 21/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK: - ShaderCategory
+enum ShaderCategory: String, CaseIterable, Hashable {
+    case effect
+    case filter
+    case transition
+}
+
+// MARK: - ShaderDestination
+/// Navigation destinations for the Shaders tab.
+/// Add a new case here when a new shader demo is introduced.
+enum ShaderDestination: Hashable {
+    case burnEffect
+}
+
+// MARK: - ShaderItem
+struct ShaderItem: Identifiable {
+
+    let id = UUID()
+    let title: String
+    let systemIcon: String
+    let iconColor: Color
+    let destination: ShaderDestination
+    let category: ShaderCategory
+
+    // MARK: - All Shaders
+    static let all: [ShaderItem] = [
+        ShaderItem(title: "Burn Effect", systemIcon: "flame.fill", iconColor: Color(r: 255, g: 69, b: 0), destination: .burnEffect, category: .transition),
+    ]
+}
```

**File**: `SwiftUI-Animations/Code/Modules/Shaders/ShaderView.swift` (modified, +111/-26)
```diff
@@ -8,41 +8,126 @@
 
 import SwiftUI
 
-// MARK:- ShaderDestination
-/// Placeholder destination enum for the Shaders tab.
-/// Add cases here as shader demos are added to the project.
-enum ShaderDestination: Hashable {
-    // future: case metalBlur, case distortion, case colorShift, etc.
-}
-
-// MARK:- ShaderView
+// MARK: - ShaderView
 struct ShaderView: View {
 
-    // MARK:- views
+    // MARK: - variables
+    @State private var selectedCategory: ShaderCategory? = nil
+    @State private var searchText: String = ""
+
+    private let columns = [
+        GridItem(.flexible(), spacing: 16),
+        GridItem(.flexible(), spacing: 16),
+        GridItem(.flexible(), spacing: 16),
+    ]
+
+    private let animationDuration: TimeInterval = 0.325
+
+    private var filteredItems: [ShaderItem] {
+        let baseItems: [ShaderItem]
+
+        if let selected = selectedCategory {
+            baseItems = ShaderItem.all.filter { $0.category == selected }
+        } else {
+            baseItems = ShaderItem.all
+        }
+
+        guard !searchText.isEmpty else { return baseItems }
+
+        let query = searchText.lowercased()
+        return baseItems.filter { $0.title.lowercased().contains(query) }
+    }
+
+    // MARK: - views
     var body: some View {
-        ZStack {
-            VStack(spacing: 24) {
-                Image(systemName: "sparkles")
-                    .font(.system(size: 56, weight: .semibold))
-                    .foregroundStyle(
-                        LinearGradient(
-                            colors: [Color.submitColor, Color.circleRoundStart],
-                            startPoint: .topLeading,
-                            endPoint: .bottomTrailing
-                        )
-                    )
-
-                VStack(spacing: 8) {
+        ScrollView(showsIndicators: false) {
+            filterChips
+                .safeAreaPadding(.trailing, 12)
+                .safeAreaPadding(.leading, 24)
+                .padding(.horizontal, -24)
+                .padding(.top, 12)
+
+            LazyVGrid(columns: columns, spacing: 32) {
+                ForEach(filteredItems) { item in
+                    NavigationLink(value: item.destination) {
+                        ShaderCardView(item: item)
+                    }
+                    .buttonStyle(.plain)
+                }
+            }
+            .padding(16)
+            .padding(.top, 12)
+            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: selectedCategory)
+            .animation(.smooth(duration: animationDuration), value: filteredItems.count)
+        }
+        .background(Color(UIColor.systemGroupedBackground))
+        .searchable(text: $searchText, prompt: Text("Search for an effect"))
+        .toolbar {
+            if #available(iOS 26.0, *) {
+                ToolbarItem(placement: .topBarLeading) {
                     Text("Shaders")
                         .font(ClashGrotestk.bold.font(size: 32))
+                        .frame(width: 120)
+                        .padding(.leading, 10)
+                }
+                .sharedBackgroundVisibility(.hidden)
 
-                    Text("Coming Soon")
-                        .font(ClashGrotestk.medium.font(size: 17))
+                DefaultToolbarItem(kind: .search, placement: .automatic)
+
+            } else {
+                ToolbarItem(placement: .topBarLeading) {
+                    Text("Shaders")
+                        .font(ClashGrotestk.bold.font(size: 24))
+                        .frame(width: 120)
+                        .padding(.leading, 16)
+                }
+            }
+        }
+        .navigationDestination(for: ShaderDestination.self) { destination in
+            destinationView(for: destination)
+        }
+    }
+
+    // MARK: - views (private)
+    private var filterChips: some View {
+        ScrollView(.horizontal, showsIndicators: false) {
+            HStack(spacing: 14) {
+                chipButton(title: "All", category: nil)
+                ForEach(ShaderCategory.allCases, id: \.self) { category in
+                    chipButton(title: category.rawValue.capitalized, category: category)
                 }
             }
+            .safeAreaPadding(.leading, 16)
+        }
+    }
+
+    private func chipButton(title: String, category: ShaderCategory?) -> some View {
+        let isSelected = selectedCategory == category
+        return Button {
+            HapticManager().makeSelectionFeedback()
+            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
+                selectedCategory = isSelected ? nil : category
+            }
+        } label: {
+            Text(title)
+                .font(isSelected ? ClashGrotestk.semibold.font(size: 14) : ClashGrotestk.medium.font(size: 14))
+                .padding(.horizontal, 16)
+                .padding(.vertical, 10)
+                .background(isSelected ? Color.accentColor.opacity(0.2) : Color(.s
```

---

### Incident Patch 9: `b3ef95cb` (2026-03-20)
**Commit Message**: Merge branch 'master' of https://github.com/Shubham0812/SwiftUI-Animations

**File**: `SwiftUI-Animations.xcodeproj/project.pbxproj` (modified, +79/-35)
```diff
@@ -7,6 +7,9 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		512788882F6DC3C1004FEFB2 /* AppCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788842F6DC3C1004FEFB2 /* AppCoordinator.swift */; };
+		512788892F6DC3C1004FEFB2 /* RootView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788862F6DC3C1004FEFB2 /* RootView.swift */; };
+		5127888A2F6DC3C1004FEFB2 /* AppTab.swift in Sources */ = {isa = PBXBuildFile; fileRef = 512788852F6DC3C1004FEFB2 /* AppTab.swift */; };
 		51370C4324EBD59A00103512 /* LoaderState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51370C4224EBD59A00103512 /* LoaderState.swift */; };
 		51390968250D1FAE000CE14A /* LikeView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51390967250D1FAE000CE14A /* LikeView.swift */; };
 		51464370250BCB830046D835 /* WaveFill.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5146436F250BCB830046D835 /* WaveFill.swift */; };
@@ -54,9 +57,18 @@
 		51D6273A24E19F2A00BCE1C8 /* WifiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51D6273924E19F2A00BCE1C8 /* WifiView.swift */; };
 		51DAC7B3250E07E800ECA895 /* ShrinkingCapsule.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51DAC7B2250E07E800ECA895 /* ShrinkingCapsule.swift */; };
 		51F6B07F24E81E0300EF840F /* Loader.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51F6B07E24E81E0300EF840F /* Loader.swift */; };
+		88CFFAAD54008A8AC63D9F0B /* Router.swift in Sources */ = {isa = PBXBuildFile; fileRef = 13DB8C183AB5B4355AA33084 /* Router.swift */; };
+		A141DA849790664EA6C96AA6 /* ShaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = CCAB44CCA0F93E933A6470DE /* ShaderView.swift */; };
 		AA0001012603180100000001 /* AnimationItem.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001002603180100000001 /* AnimationItem.swift */; };
 		AA0001032603180100000002 /* AnimationCardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001022603180100000002 /* AnimationCardView.swift */; };
 		AA0001052603180100000003 /* HomeView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001042603180100000003 /* HomeView.swift */; };
+		CF0001AB2603180100000001 /* FontManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = CF0001AA2603180100000001 /* FontManager.swift */; };
+		CF0001DB2603180100000001 /* ClashGrotesk-Bold.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001DA2603180100000001 /* ClashGrotesk-Bold.otf */; };
+		CF0001EB2603180100000001 /* ClashGrotesk-Extralight.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001EA2603180100000001 /* ClashGrotesk-Extralight.otf */; };
+		CF0001FB2603180100000001 /* ClashGrotesk-Light.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001FA2603180100000001 /* ClashGrotesk-Light.otf */; };
+		CF0002AB2603180100000001 /* ClashGrotesk-Medium.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002AA2603180100000001 /* ClashGrotesk-Medium.otf */; };
+		CF0002BB2603180100000001 /* ClashGrotesk-Regular.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002BA2603180100000001 /* ClashGrotesk-Regular.otf */; };
+		CF0002CB2603180100000001 /* ClashGrotesk-Semibold.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002CA2603180100000001 /* ClashGrotesk-Semibold.otf */; };
 		DAF98EFF25F0D07F0052EDB8 /* SpinningView.swift in Sources */ = {isa = PBXBuildFile; fileRef = DAF98EFE25F0D07F0052EDB8 /* SpinningView.swift */; };
 		F30BA967254418B300DC8367 /* LoginView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F30BA966254418B300DC8367 /* LoginView.swift */; };
 		F30BA96C25441BED00DC8367 /* Plus.swift in Sources */ = {isa = PBXBuildFile; fileRef = F30BA96B25441BED00DC8367 /* Plus.swift */; };
@@ -93,16 +105,13 @@
 		F3DAEDED253B0F220067F963 /* DashedLoaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDEC253B0F220067F963 /* DashedLoaderView.swift */; };
 		F3DAEDF1253B18500067F963 /* DotsLoaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDF0253B184F0067F963 /* DotsLoaderView.swift */; };
 		F3DAEDF4253B23960067F963 /* FlickeringView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDF3253B23950067F963 /* FlickeringView.swift */; };
-		CF0001AB2603180100000001 /* FontManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = CF0001AA2603180100000001 /* FontManager.swift */; };
-		CF0001DB2603180100000001 /* ClashGrotesk-Bold.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001DA2603180100000001 /* ClashGrotesk-Bold.otf */; };
-		CF0001EB2603180100000001 /* ClashGrotesk-Extralight.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001EA2603180100000001 /* ClashGrotesk-Extralight.otf */; };
-		CF0001FB2603180100000001 /* ClashGrotesk-Light.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001FA2603180100000001 /* ClashGrotesk-Light.otf */; };
-		CF0002AB2603180100000001 /* ClashGrotesk-Medium.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002AA2603180100000001 /* ClashGrotesk-Medium.otf */; };

```

**File**: `SwiftUI-Animations/Code/App/AppCoordinator.swift` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+//
+//  AppCoordinator.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 20/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK:- AppCoordinator
+/// Global coordinator that owns tab selection and all per-tab routers.
+///
+/// `RootView` holds this as a `@StateObject` and injects it via `.environmentObject`.
+/// Child views should depend only on the specific `Router` for their tab, not on
+/// the coordinator itself — this keeps inter-tab coupling at zero.
+///
+/// To add a new tab:
+/// 1. Add a case to `AppTab`.
+/// 2. Add a `let newTabRouter = Router<NewTabDestination>()` property here.
+/// 3. Add a `case .newTab: newTabRouter.popToRoot()` branch in `selectTab(_:)`.
+/// 4. Add the `NavigationStack` + `.tabItem` entry in `RootView`.
+@MainActor
+final class AppCoordinator: ObservableObject {
+
+    // MARK:- variables
+    @Published var selectedTab: AppTab = .home
+
+    let homeRouter    = Router<AnimationDestination>()
+    let shadersRouter = Router<ShaderDestination>()
+
+    // MARK:- functions
+    /// Selects a tab. If the tab is already active, pops its navigation stack to root —
+    /// matching the standard iOS behavior when tapping the current tab bar item.
+    func selectTab(_ tab: AppTab) {
+        if selectedTab == tab {
+            switch tab {
+            case .home:    homeRouter.popToRoot()
+            case .shaders: shadersRouter.popToRoot()
+            }
+        } else {
+            selectedTab = tab
+        }
+    }
+}
```

**File**: `SwiftUI-Animations/Code/App/AppTab.swift` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+//
+//  AppTab.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 20/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+// MARK:- AppTab
+/// Enum representing the top-level tabs in the app.
+/// Named `AppTab` (not `Tab`) to avoid collision with SwiftUI's iOS 18 `Tab` type.
+/// To add a new tab: add a case here, a router in `AppCoordinator`, and a
+/// `NavigationStack` entry in `RootView`.
+enum AppTab: Hashable, CaseIterable {
+    case home
+    case shaders
+
+    // MARK:- variables
+    var title: String {
+        switch self {
+        case .home:    return "Home"
+        case .shaders: return "Shaders"
+        }
+    }
+
+    var systemIcon: String {
+        switch self {
+        case .home:    return "square.grid.2x2.fill"
+        case .shaders: return "sparkles"
+        }
+    }
+}
```

**File**: `SwiftUI-Animations/Code/App/RootView.swift` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+//
+//  RootView.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 20/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK:- RootView
+/// The top-level view that owns the `TabView` and per-tab `NavigationStack`s.
+///
+/// Each tab's `NavigationStack` is bound to the corresponding router's `path` on
+/// `AppCoordinator`. Because `coordinator` is a `@StateObject`, both tab selection
+/// and navigation stacks survive tab switches — each tab maintains its own independent
+/// navigation state.
+struct RootView: View {
+
+    // MARK:- variables
+    @StateObject private var coordinator = AppCoordinator()
+
+    // MARK:- views
+    var body: some View {
+        TabView(selection: $coordinator.selectedTab) {
+            NavigationStack(path: $coordinator.homeRouter.path) {
+                HomeView()
+            }
+            .tabItem { Label(AppTab.home.title, systemImage: AppTab.home.systemIcon) }
+            .tag(AppTab.home)
+
+            NavigationStack(path: $coordinator.shadersRouter.path) {
+                ShaderView()
+            }
+            .tabItem { Label(AppTab.shaders.title, systemImage: AppTab.shaders.systemIcon) }
+            .tag(AppTab.shaders)
+        }
+        .environmentObject(coordinator)
+    }
+}
+
+#Preview {
+    RootView()
+}
```

**File**: `SwiftUI-Animations/Code/Modules/Home/HomeView.swift` (modified, +6/-7)
```diff
@@ -46,11 +46,10 @@ struct HomeView: View {
 
     // MARK: - Views
     var body: some View {
-        NavigationStack {
-            ScrollView(showsIndicators: false) {
+        ScrollView(showsIndicators: false) {
                 filterChips
                     .safeAreaPadding(.trailing, 12)
-                    .safeAreaPadding(.leading, 42)
+                    .safeAreaPadding(.leading, 24)
                     .padding(.horizontal, -24)
                     .padding(.top, 12)
                 
@@ -93,7 +92,7 @@ struct HomeView: View {
                     }
                     .sharedBackgroundVisibility(.hidden)
                     
-                    DefaultToolbarItem(kind: .search, placement: .bottomBar)
+                    DefaultToolbarItem(kind: .search, placement: .automatic)
                     
                 } else {
                     ToolbarItem(placement: .topBarLeading) {
@@ -107,7 +106,6 @@ struct HomeView: View {
             .navigationDestination(for: AnimationDestination.self) { destination in
                 destinationView(for: destination)
             }
-        }
     }
 
     private var filterChips: some View {
@@ -216,6 +214,7 @@ struct HomeView: View {
 }
 
 #Preview {
-    HomeView()
-
+    NavigationStack {
+        HomeView()
+    }
 }
```

**File**: `SwiftUI-Animations/Code/Modules/Shaders/ShaderView.swift` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+//
+//  ShaderView.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 20/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK:- ShaderDestination
+/// Placeholder destination enum for the Shaders tab.
+/// Add cases here as shader demos are added to the project.
+enum ShaderDestination: Hashable {
+    // future: case metalBlur, case distortion, case colorShift, etc.
+}
+
+// MARK:- ShaderView
+struct ShaderView: View {
+
+    // MARK:- views
+    var body: some View {
+        ZStack {
+            VStack(spacing: 24) {
+                Image(systemName: "sparkles")
+                    .font(.system(size: 56, weight: .semibold))
+                    .foregroundStyle(
+                        LinearGradient(
+                            colors: [Color.submitColor, Color.circleRoundStart],
+                            startPoint: .topLeading,
+                            endPoint: .bottomTrailing
+                        )
+                    )
+
+                VStack(spacing: 8) {
+                    Text("Shaders")
+                        .font(ClashGrotestk.bold.font(size: 32))
+
+                    Text("Coming Soon")
+                        .font(ClashGrotestk.medium.font(size: 17))
+                }
+            }
+        }
+        .navigationBarTitleDisplayMode(.inline)
+        .navigationDestination(for: ShaderDestination.self) { _ in EmptyView() }
+    }
+}
+
+#Preview {
+    NavigationStack {
+        ShaderView()
+    }
+}
```

**File**: `SwiftUI-Animations/Code/Navigation/Router.swift` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+//
+//  Router.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 20/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+// MARK:- Router
+/// A generic, per-tab navigation manager that owns a `NavigationPath`.
+///
+/// Each tab gets its own typed router instance — e.g. `Router<AnimationDestination>` for Home.
+/// Views push destinations by calling `push(_:)` rather than constructing `NavigationLink` values
+/// directly, keeping navigation logic out of view bodies.
+///
+/// Usage:
+/// ```swift
+/// // In RootView — bind the path to a NavigationStack:
+/// NavigationStack(path: $coordinator.homeRouter.path) { HomeView() }
+///
+/// // In any child view — push a destination:
+/// @EnvironmentObject var router: Router<AnimationDestination>
+/// router.push(.circleLoader)
+/// ```
+@MainActor
+final class Router<Destination: Hashable>: ObservableObject {
+
+    // MARK:- variables
+    @Published var path = NavigationPath()
+
+    // MARK:- functions
+    func push(_ destination: Destination) {
+        path.append(destination)
+    }
+
+    func pop() {
+        guard !path.isEmpty else { return }
+        path.removeLast()
+    }
+
+    func popToRoot() {
+        path = NavigationPath()
+    }
+}
```

**File**: `SwiftUI-Animations/SceneDelegate.swift` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ class SceneDelegate: UIResponder, UIWindowSceneDelegate {
         // This delegate does not imply the connecting scene or session are new (see `application:configurationForConnectingSceneSession` instead).
 
         // Create the SwiftUI view that provides the window contents.
-        let contentView = HomeView()
+        let contentView = RootView()
 
         // Use a UIHostingController as window root view controller.
         if let windowScene = scene as? UIWindowScene {
```

---

### Incident Patch 10: `f0565427` (2026-03-20)
**Commit Message**: Fix

**File**: `.claude/worktrees/distracted-mendel` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-Subproject commit 36840e429bb661a82eea88c9215d6f3258de887a
```

**File**: `.claude/worktrees/wonderful-rubin` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Subproject commit 176d3ac356041609df44ff9f9029448fb98e717e
```

---

### Incident Patch 11: `47746767` (2026-03-20)
**Commit Message**: Merge branch 'master' of https://github.com/Shubham0812/SwiftUI-Animations

**File**: `SwiftUI-Animations.xcodeproj/project.pbxproj` (modified, +44/-0)
```diff
@@ -93,6 +93,13 @@
 		F3DAEDED253B0F220067F963 /* DashedLoaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDEC253B0F220067F963 /* DashedLoaderView.swift */; };
 		F3DAEDF1253B18500067F963 /* DotsLoaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDF0253B184F0067F963 /* DotsLoaderView.swift */; };
 		F3DAEDF4253B23960067F963 /* FlickeringView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDF3253B23950067F963 /* FlickeringView.swift */; };
+		CF0001AB2603180100000001 /* FontManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = CF0001AA2603180100000001 /* FontManager.swift */; };
+		CF0001DB2603180100000001 /* ClashGrotesk-Bold.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001DA2603180100000001 /* ClashGrotesk-Bold.otf */; };
+		CF0001EB2603180100000001 /* ClashGrotesk-Extralight.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001EA2603180100000001 /* ClashGrotesk-Extralight.otf */; };
+		CF0001FB2603180100000001 /* ClashGrotesk-Light.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0001FA2603180100000001 /* ClashGrotesk-Light.otf */; };
+		CF0002AB2603180100000001 /* ClashGrotesk-Medium.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002AA2603180100000001 /* ClashGrotesk-Medium.otf */; };
+		CF0002BB2603180100000001 /* ClashGrotesk-Regular.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002BA2603180100000001 /* ClashGrotesk-Regular.otf */; };
+		CF0002CB2603180100000001 /* ClashGrotesk-Semibold.otf in Resources */ = {isa = PBXBuildFile; fileRef = CF0002CA2603180100000001 /* ClashGrotesk-Semibold.otf */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXFileReference section */
@@ -184,6 +191,13 @@
 		F3DAEDEC253B0F220067F963 /* DashedLoaderView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DashedLoaderView.swift; sourceTree = "<group>"; };
 		F3DAEDF0253B184F0067F963 /* DotsLoaderView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DotsLoaderView.swift; sourceTree = "<group>"; };
 		F3DAEDF3253B23950067F963 /* FlickeringView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FlickeringView.swift; sourceTree = "<group>"; };
+		CF0001AA2603180100000001 /* FontManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FontManager.swift; sourceTree = "<group>"; };
+		CF0001DA2603180100000001 /* ClashGrotesk-Bold.otf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "ClashGrotesk-Bold.otf"; sourceTree = "<group>"; };
+		CF0001EA2603180100000001 /* ClashGrotesk-Extralight.otf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "ClashGrotesk-Extralight.otf"; sourceTree = "<group>"; };
+		CF0001FA2603180100000001 /* ClashGrotesk-Light.otf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "ClashGrotesk-Light.otf"; sourceTree = "<group>"; };
+		CF0002AA2603180100000001 /* ClashGrotesk-Medium.otf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "ClashGrotesk-Medium.otf"; sourceTree = "<group>"; };
+		CF0002BA2603180100000001 /* ClashGrotesk-Regular.otf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "ClashGrotesk-Regular.otf"; sourceTree = "<group>"; };
+		CF0002CA2603180100000001 /* ClashGrotesk-Semibold.otf */ = {isa = PBXFileReference; lastKnownFileType = file; path = "ClashGrotesk-Semibold.otf"; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -248,10 +262,32 @@
 			isa = PBXGroup;
 			children = (
 				515557EB24DEAC350001E523 /* Colors.swift */,
+				CF0001AA2603180100000001 /* FontManager.swift */,
 			);
 			path = Utils;
 			sourceTree = "<group>";
 		};
+		CF0001BA2603180100000001 /* Fonts */ = {
+			isa = PBXGroup;
+			children = (
+				CF0001CA2603180100000001 /* ClashGrotesk */,
+			);
+			path = Fonts;
+			sourceTree = "<group>";
+		};
+		CF0001CA2603180100000001 /* ClashGrotesk */ = {
+			isa = PBXGroup;
+			children = (
+				CF0001DA2603180100000001 /* ClashGrotesk-Bold.otf */,
+				CF0001EA2603180100000001 /* ClashGrotesk-Extralight.otf */,
+				CF0001FA2603180100000001 /* ClashGrotesk-Light.otf */,
+				CF0002AA2603180100000001 /* ClashGrotesk-Medium.otf */,
+				CF0002BA2603180100000001 /* ClashGrotesk-Regular.otf */,
+				CF0002CA2603180100000001 /* ClashGrotesk-Semibold.otf */,
+			);
+			path = ClashGrotesk;
+			sourceTree = "<group>";
+		};
 		517BFA5C24DC45B200D4F78A /* SupportShapes */ = {
 			isa = PBXGroup;
 			children = (
@@ -658,6 +694,7 @@
 				518E823624DAA667002CB679 /* Assets.xcassets */,
 				518E823B24DAA667002CB679 /* LaunchScreen.storyboard */,
 				518E823824DAA667002CB679 /* Preview Content */,
+				CF0001BA2603180100000001 /* Fonts */,
 			);
 			path = Assets;
 			sourceTree = "<group>";
@@ -776,6 +813,12 @@
 				518E823D24DAA667002CB679 /* LaunchScreen.storyboard in Resources */,
 				518E823A24DAA667002CB679 /* Preview Assets.xcasse
```

**File**: `SwiftUI-Animations/Code/Animations/Loader/LoaderView.swift` (modified, +4/-4)
```diff
@@ -24,15 +24,15 @@ struct LoaderView: View {
     // MARK: - Views
     var body: some View {
         ZStack {
-            Color.black
-                .ignoresSafeArea()
             ZStack {
                 // Three capsules offset by ~0.7s each so they're evenly spaced around the path
                 Loader(loaderState: .down, timerDuration: 0.35, startAnimating: $animateLoaders)
                 Loader(loaderState: .right, timerDuration: 1.05, startAnimating: $animateLoaders)
                 Loader(loaderState: .up, timerDuration: 1.75, startAnimating: $animateLoaders)
-            }.offset(x: -40, y: -40)
-        }.onAppear {
+            }
+            .offset(x: -40, y: -40)
+        }
+        .onAppear {
             animateLoaders.toggle()
         }
     }
```

**File**: `SwiftUI-Animations/Code/Animations/PillLoader/PillLoader.swift` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ struct PillLoader: View {
     /// Number of full rotations per cycle. Total rotation = `trackerRotation × 360°`.
     let trackerRotation: Double = 1.5
     /// Base duration driving both the rotation spring and the fill animation.
-    let animationDuration: Double = 3
+    let animationDuration: Double = 0.3
     /// Cool blue-to-purple gradient background for the full screen.
     let backgroundColor: LinearGradient = LinearGradient(gradient: Gradient(colors: [Color.blue.opacity(0.4), Color.purple.opacity(0.3)]), startPoint: .topLeading, endPoint: .bottom)
 
```

**File**: `SwiftUI-Animations/Code/Animations/Wifi/WifiView.swift` (modified, +71/-58)
```diff
@@ -21,14 +21,14 @@ import SwiftUI
 /// ```
 /// Three overlapping repeating timers drive the arc oscillation during the searching phase.
 struct WifiView: View {
-
+    
     // MARK: - Variables
-
+    
     /// `true` while the arcs are oscillating in the scanning phase.
     @State var isAnimating: Bool = false
     /// `true` for a brief window after connection to trigger the `CircleEmitter` particle burst.
     @State var isConnected: Bool = false
-
+    
     /// Vertical offset of the central dot — bounces between –25 and +20 pt during scanning.
     @State var circleOffset: CGFloat = 20
     /// Vertical offset of the small (innermost) arc.
@@ -37,86 +37,98 @@ struct WifiView: View {
     @State var mediumArcOffset: CGFloat = 14.5
     /// Vertical offset of the large (outermost) arc — oscillates on a 3× timer period.
     @State var largeArcOffset: CGFloat = 14
-
+    
     /// Fill color of all arcs — white during scanning, green (`wifiConnected`) on connection.
     @State var arcColor: Color = Color.white
     /// Shadow color for all arcs — blue during scanning, white on connection.
     @State var shadowColor: Color = Color.blue
     /// Label shown below the arcs — "Wi-Fi" → "Searching" → "Connected".
     @State var wifiHeaderLabel: String = "Wi-Fi"
-
+    
+    @State private var textOpacity: Double = 1.0
     /// Static flag indicating whether the animation is currently moving upward.
     /// Shared across all three arc timers to synchronise direction changes.
     static var animationMovingUpwards: Bool = true
     /// Static flag used by the 3× timer to alternate the small arc direction.
     static var moveArc: Bool = true
-
+    
     /// Base timer interval; all arc oscillation periods are multiples of this.
     var animationDuration: Double = 0.35
-
+    
     var body: some View {
         ZStack {
             Color.wifiBackground
                 .ignoresSafeArea()
+            
             CircleEmitter(isAnimating: $isConnected)
+            
             ZStack {
                 Circle()
                     .fill(arcColor)
                     .scaleEffect(0.075)
                     .shadow(color: Color.blue, radius: 5)
                     .offset(y: circleOffset)
                     .animation(.easeOut(duration: animationDuration), value: circleOffset)
-                ZStack {
-                    ArcView(radius: 12, fillColor: $arcColor, shadowColor: $shadowColor)
-                        .rotationEffect(getRotation(arcBoolean: Self.moveArc))
-                        .offset(y: smallArcOffset)
-                        .animation(.easeOut(duration: animationDuration), value: smallArcOffset)
-
-                    ArcView(radius: 24, fillColor: $arcColor, shadowColor: $shadowColor)
-                        .rotationEffect(getRotation(arcBoolean: Self.moveArc))
-                        .offset(y: mediumArcOffset)
-                        .animation(.easeOut(duration: animationDuration).delay(animationDuration), value: mediumArcOffset)
-
-                    ArcView(radius: 36, fillColor: $arcColor, shadowColor: $shadowColor)
-                        .rotationEffect(getRotation(arcBoolean: Self.moveArc))
-                        .offset(y: largeArcOffset)
-                        .animation(.easeOut(duration: animationDuration).delay(animationDuration * 1.9), value: largeArcOffset)
-                    Circle().stroke(style: StrokeStyle(lineWidth: 2.5))
-                        .foregroundStyle(.white)
-                        .opacity(0.8)
-                    Circle().fill(Color.blue.opacity(0.1))
-                    Circle().fill(Color.blue.opacity(0.025))
-                        .scaleEffect(isAnimating ? 5 : 0)
-                        .animation(isAnimating ? .easeIn(duration: animationDuration * 2.5).repeatForever(autoreverses: false) : .linear(duration: 0), value: isAnimating)
-                }
-            }.frame(height: 120)
-            .onTapGesture {
-                resetValues()
-                animate()
-
-                Timer.scheduledTimer(withTimeInterval: animationDuration * 12, repeats: false) { _ in
-                    restoreAnimation()
-                    arcColor = Color.wifiConnected
-                    shadowColor = Color.white.opacity(0.5)
-                    wifiHeaderLabel = "Connected"
-                    isConnected.toggle()
-
-                    Timer.scheduledTimer(withTimeInterval: animationDuration + 0.05, repeats: false) { _ in
-                        isConnected.toggle()
+                    .overlay {
+                        ArcView(radius: 12, fillColor: $arcColor, shadowColor: $shadowColor)
+                            .rotationEffect(getRotation(arcBoolean: Self.moveArc))
+                            .offset(y: smallArcOffset)
+                            .animation(.easeOut(duration: animationDuration), value: smallArcOffset)
+                        
+                        ArcView(radius: 24, fillColor: $arcCol
```

**File**: `SwiftUI-Animations/Code/Modules/Home/AnimationCardView.swift` (modified, +3/-2)
```diff
@@ -24,11 +24,12 @@ struct AnimationCardView: View {
                 .background {
                     Circle()
                         .fill(item.iconColor.gradient)
-                        .opacity(0.25)
+                        .opacity(0.2)
                 }
 
             Text(item.title)
-                .font(.system(size: 14, weight: .semibold))
+                .font(ClashGrotestk.semibold.font(size: 14))
+                .tracking(0.1)
                 .foregroundStyle(Color.label)
                 .multilineTextAlignment(.center)
                 .lineLimit(2)
```

**File**: `SwiftUI-Animations/Code/Modules/Home/HomeView.swift` (modified, +90/-8)
```diff
@@ -12,42 +12,93 @@ struct HomeView: View {
 
     // MARK: - Variables
     @State private var chatMessage: String = ""
-
+    @State private var selectedCategory: AnimationCategory? = nil
+    @State private var isFilterPinned: Bool = false
+    @State private var scrollViewTopY: CGFloat = 0
+    
+    @State var searchText: String = ""
+    
     private let columns = [
         GridItem(.flexible(), spacing: 16),
         GridItem(.flexible(), spacing: 16),
         GridItem(.flexible(), spacing: 16),
     ]
+    
+    private let animationDuration: TimeInterval = 0.325
+
+    private var filteredItems: [AnimationItem] {
+        let baseItems: [AnimationItem]
+        
+        if let selected = selectedCategory {
+            baseItems = AnimationItem.all.filter { $0.category == selected }
+        } else {
+            baseItems = AnimationItem.all
+        }
+        
+        guard !searchText.isEmpty else { return baseItems }
+        
+        let query = searchText.lowercased()
+        
+        return baseItems.filter {
+            $0.title.lowercased().contains(query)
+        }
+    }
 
     // MARK: - Views
     var body: some View {
         NavigationStack {
-            ScrollView {
+            ScrollView(showsIndicators: false) {
+                filterChips
+                    .safeAreaPadding(.trailing, 12)
+                    .safeAreaPadding(.leading, 42)
+                    .padding(.horizontal, -24)
+                    .padding(.top, 12)
+                
                 LazyVGrid(columns: columns, spacing: 32) {
-                    ForEach(AnimationItem.all) { item in
+                    ForEach(filteredItems) { item in
                         NavigationLink(value: item.destination) {
                             AnimationCardView(item: item)
                         }
                         .buttonStyle(.plain)
                     }
                 }
                 .padding(16)
-                .padding(.top, 18)
+                .padding(.top, 12)
+                .animation(.spring(response: 0.35, dampingFraction: 0.8), value: selectedCategory)
+                .animation(.smooth(duration: animationDuration), value: filteredItems.count)
+            }
+            .background(GeometryReader { geo in
+                Color.clear.onAppear {
+                    scrollViewTopY = geo.frame(in: .global).minY
+                }
+            })
+
+            .overlay(alignment: .top) {
+                if isFilterPinned {
+                    filterChips
+                        .padding(.vertical, 10)
+                        .background(Color(UIColor.systemGroupedBackground))
+                        .transition(.move(edge: .top).combined(with: .opacity))
+                }
             }
             .background(Color(UIColor.systemGroupedBackground))
+            .searchable(text: $searchText, prompt: Text("Search for a work"))
             .toolbar {
                 if #available(iOS 26.0, *) {
                     ToolbarItem(placement: .topBarLeading) {
                         Text("SwiftUI")
-                            .font(.system(size: 32, weight: .bold, design: .rounded))
+                            .font(ClashGrotestk.bold.font(size: 32))
                             .frame(width: 120)
-                            .padding(.leading, 16)
+                            .padding(.leading, 10)
                     }
                     .sharedBackgroundVisibility(.hidden)
+                    
+                    DefaultToolbarItem(kind: .search, placement: .bottomBar)
+                    
                 } else {
                     ToolbarItem(placement: .topBarLeading) {
                         Text("SwiftUI")
-                            .font(.system(size: 24, weight: .bold, design: .rounded))
+                            .font(ClashGrotestk.bold.font(size: 24))
                             .frame(width: 120)
                             .padding(.leading, 16)
                     }
@@ -59,6 +110,37 @@ struct HomeView: View {
         }
     }
 
+    private var filterChips: some View {
+        ScrollView(.horizontal, showsIndicators: false) {
+            HStack(spacing: 14) {
+                chipButton(title: "All", category: nil)
+                ForEach(AnimationCategory.allCases, id: \.self) { category in
+                    chipButton(title: category.rawValue.capitalized, category: category)
+                }
+            }
+            .safeAreaPadding(.leading, 16)
+        }
+    }
+
+    private func chipButton(title: String, category: AnimationCategory?) -> some View {
+        let isSelected = selectedCategory == category
+        return Button {
+            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
+                selectedCategory = isSelected ? nil : category
+            }
+        } label: {
+            Text(title)
+                .font(isSelected ? ClashGrotestk.semibold.font(size: 14) : ClashGrotestk
```

**File**: `SwiftUI-Animations/Code/Utils/FontManager.swift` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+//
+//  FontManager.swift
+//  SwiftUI-Animations
+//
+//  Created by Shubham Singh on 19/03/26.
+//  Copyright © 2026 Shubham Singh. All rights reserved.
+//
+
+import SwiftUI
+
+enum ClashGrotestk {
+    case extralight
+    case light
+    case regular
+    case medium
+    case semibold
+    case bold
+
+    // MARK: - Functions
+    func font(size: CGFloat) -> Font {
+        switch self {
+        case .extralight:
+            return .custom("ClashGrotesk-Extralight", size: size)
+        case .light:
+            return .custom("ClashGrotesk-Light", size: size)
+        case .regular:
+            return .custom("ClashGrotesk-Regular", size: size)
+        case .medium:
+            return .custom("ClashGrotesk-Medium", size: size)
+        case .semibold:
+            return .custom("ClashGrotesk-Semibold", size: size)
+        case .bold:
+            return .custom("ClashGrotesk-Bold", size: size)
+        }
+    }
+}
```

**File**: `SwiftUI-Animations/Info.plist` (modified, +9/-0)
```diff
@@ -37,6 +37,15 @@
 			</array>
 		</dict>
 	</dict>
+	<key>UIAppFonts</key>
+	<array>
+		<string>ClashGrotesk-Bold.otf</string>
+		<string>ClashGrotesk-Extralight.otf</string>
+		<string>ClashGrotesk-Light.otf</string>
+		<string>ClashGrotesk-Medium.otf</string>
+		<string>ClashGrotesk-Regular.otf</string>
+		<string>ClashGrotesk-Semibold.otf</string>
+	</array>
 	<key>UILaunchStoryboardName</key>
 	<string>LaunchScreen</string>
 	<key>UIRequiredDeviceCapabilities</key>
```

---

### Incident Patch 12: `fb14f8bf` (2026-03-20)
**Commit Message**: Fix inifinity view

**File**: `.claude/worktrees/distracted-mendel` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Subproject commit 36840e429bb661a82eea88c9215d6f3258de887a
```

**File**: `.claude/worktrees/quizzical-bose` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Subproject commit 8dc309add9c83b04e65ccd90561b18637f11371b
```

**File**: `SwiftUI-Animations.xcodeproj/project.pbxproj` (modified, +0/-8)
```diff
@@ -690,19 +690,11 @@
 		F3DAEDC1253629E90067F963 /* GithubLoader */ = {
 			isa = PBXGroup;
 			children = (
-				F3DAEDC6253629FE0067F963 /* Support Shapes */,
 				F3DAEDC2253629F80067F963 /* GithubLoader.swift */,
 			);
 			path = GithubLoader;
 			sourceTree = "<group>";
 		};
-		F3DAEDC6253629FE0067F963 /* Support Shapes */ = {
-			isa = PBXGroup;
-			children = (
-			);
-			path = "Support Shapes";
-			sourceTree = "<group>";
-		};
 		F3DAEDE1253ABBBD0067F963 /* 3dLoader */ = {
 			isa = PBXGroup;
 			children = (
```

**File**: `SwiftUI-Animations/Code/Animations/InfinityLoader/InfinityView.swift` (modified, +26/-44)
```diff
@@ -22,61 +22,43 @@ import SwiftUI
 /// - A slow timer fires every `animationDuration × 3` (0.6 s) and grows `additionalLength` by 0.015,
 ///   gradually lengthening the visible white tail until the next reset.
 struct InfinityView: View {
-
-    // MARK: - Variables
-
-    /// Interval for the fast advance timer. Each tick moves `strokeEnd` forward by 0.05.
-    let animationDuration: TimeInterval = 0.2
-    /// Stroke width of both the white glow and the dark eraser overlay.
     let strokeWidth: CGFloat = 20
-    /// Reset threshold for `strokeEnd`. Slightly above 1.0 ensures the arc cleanly exits
-    /// the path endpoint before wrapping — avoids a visible seam at the ∞ crossover.
-    let animationCap: CGFloat = 1.205
-
-    /// Leading edge of the dark eraser arc (moves forward each tick).
-    @State var strokeStart: CGFloat = 0
-    /// Trailing edge of the dark eraser arc — always `strokeEnd - (0.05 + additionalLength)`.
-    @State var strokeEnd: CGFloat = 0
-    /// Grows over time via the slow timer, elongating the visible white tail segment.
-    @State var additionalLength: CGFloat = 0
-
-    // MARK: - Views
+    let duration: Double = 2.0
+    
+    @State private var phase: CGFloat = 0
 
     var body: some View {
         ZStack {
-            Color.black
-                .ignoresSafeArea()
+            Color.black.ignoresSafeArea()
             InfinityShape()
                 .stroke(style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round, lineJoin: .round))
-                .foregroundStyle(.white)
-                .shadow(color: .white, radius: 4)
-                .overlay(
-                    InfinityShape()
-                        .trim(from: strokeStart, to: strokeEnd)
-                        .stroke(style: StrokeStyle(lineWidth: strokeWidth - 0.5, lineCap: .round, lineJoin: .round))
-                        .foregroundStyle(Color.materialBlack)
-                        .shadow(color: .white, radius: 5)
-                )
+                .foregroundStyle(.gray)
+                .opacity(0.4)
+            
+            // Layer 1: The Main Stroke
+            renderStroke(from: phase - 0.1, to: phase)
+            
+            // Layer 2: The "Wrap-Around" Stroke
+            // When phase is 0.1, this draws from -0.1 to 0.1
+            // When phase is 0.9, this draws from 0.7 to 0.9
+            // By adding/subtracting 1.0, we catch the "overflow"
+            renderStroke(from: phase - 1.2, to: phase - 1.0)
+            renderStroke(from: phase + 0.9, to: phase + 1.0)
         }
         .onAppear {
-            Timer.scheduledTimer(withTimeInterval: animationDuration, repeats: true) { _ in
-                withAnimation(.linear(duration: animationDuration)) {
-                    strokeEnd += 0.05
-                    strokeStart = strokeEnd - (0.05 + additionalLength)
-                }
-
-                if strokeEnd >= animationCap {
-                    strokeEnd = 0
-                    additionalLength = 0
-                    strokeStart = 0
-                }
-            }
-
-            Timer.scheduledTimer(withTimeInterval: animationDuration * 3, repeats: true) { _ in
-                additionalLength += 0.015
+            withAnimation(.linear(duration: duration).repeatForever(autoreverses: false)) {
+                phase = 1.0
             }
         }
     }
+
+    @ViewBuilder
+    private func renderStroke(from: CGFloat, to: CGFloat) -> some View {
+        InfinityShape()
+            .trim(from: from, to: to)
+            .stroke(style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round, lineJoin: .round))
+            .foregroundStyle(.white)
+    }
 }
 
 #Preview {
```

---

### Incident Patch 13: `8dc309ad` (2026-03-19)
**Commit Message**: Merge branch 'master' of https://github.com/Shubham0812/SwiftUI-Animations

**File**: `README.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 
 ![Swift](https://img.shields.io/badge/Swift-5.0+-FA7343?style=for-the-badge&logo=swift&logoColor=white)
 ![SwiftUI](https://img.shields.io/badge/SwiftUI-blue?style=for-the-badge&logo=swift&logoColor=white)
-![Platform](https://img.shields.io/badge/Platform-iOS%2014+-lightgrey?style=for-the-badge&logo=apple&logoColor=white)
+![Platform](https://img.shields.io/badge/Platform-iOS%2017.0+-lightgrey?style=for-the-badge&logo=apple&logoColor=white)
 ![License](https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge)
 [![Build](https://github.com/Shubham0812/SwiftUI-Animations/actions/workflows/build.yml/badge.svg)](https://github.com/Shubham0812/SwiftUI-Animations/actions/workflows/build.yml)
 
```

---

### Incident Patch 14: `63ddccc1` (2026-03-19)
**Commit Message**: Apply linter fixes to OctocatView and YinYangAnimationView

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `SwiftUI-Animations.xcodeproj/project.pbxproj` (modified, +14/-10)
```diff
@@ -54,6 +54,9 @@
 		51D6273A24E19F2A00BCE1C8 /* WifiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51D6273924E19F2A00BCE1C8 /* WifiView.swift */; };
 		51DAC7B3250E07E800ECA895 /* ShrinkingCapsule.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51DAC7B2250E07E800ECA895 /* ShrinkingCapsule.swift */; };
 		51F6B07F24E81E0300EF840F /* Loader.swift in Sources */ = {isa = PBXBuildFile; fileRef = 51F6B07E24E81E0300EF840F /* Loader.swift */; };
+		AA0001012603180100000001 /* AnimationItem.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001002603180100000001 /* AnimationItem.swift */; };
+		AA0001032603180100000002 /* AnimationCardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001022603180100000002 /* AnimationCardView.swift */; };
+		AA0001052603180100000003 /* HomeView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001042603180100000003 /* HomeView.swift */; };
 		DAF98EFF25F0D07F0052EDB8 /* SpinningView.swift in Sources */ = {isa = PBXBuildFile; fileRef = DAF98EFE25F0D07F0052EDB8 /* SpinningView.swift */; };
 		F30BA967254418B300DC8367 /* LoginView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F30BA966254418B300DC8367 /* LoginView.swift */; };
 		F30BA96C25441BED00DC8367 /* Plus.swift in Sources */ = {isa = PBXBuildFile; fileRef = F30BA96B25441BED00DC8367 /* Plus.swift */; };
@@ -81,14 +84,10 @@
 		F39D62DF251CF07900BB25D2 /* CapusuleGroupView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F39D62DE251CF07900BB25D2 /* CapusuleGroupView.swift */; };
 		F39D62E2251CF2CA00BB25D2 /* LowerCapsuleView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F39D62E1251CF2CA00BB25D2 /* LowerCapsuleView.swift */; };
 		F3DA13D12535B9CB005E384E /* IntroView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DA13D02535B9CB005E384E /* IntroView.swift */; };
-		AA0001012603180100000001 /* AnimationItem.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001002603180100000001 /* AnimationItem.swift */; };
-		AA0001032603180100000002 /* AnimationCardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001022603180100000002 /* AnimationCardView.swift */; };
-		AA0001052603180100000003 /* HomeView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001042603180100000003 /* HomeView.swift */; };
 		F3DA13D62535BA02005E384E /* HapticManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DA13D52535BA02005E384E /* HapticManager.swift */; };
 		F3DA9AAD252DB1DE00CF2516 /* SubmitView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DA9AAC252DB1DE00CF2516 /* SubmitView.swift */; };
 		F3DA9AB2252DB4C100CF2516 /* RotatingCircle.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DA9AB1252DB4C100CF2516 /* RotatingCircle.swift */; };
 		F3DAEDC3253629F80067F963 /* GithubLoader.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDC2253629F80067F963 /* GithubLoader.swift */; };
-		F3DAEDC825362A0B0067F963 /* Octocat.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDC725362A0B0067F963 /* Octocat.swift */; };
 		F3DAEDE3253ABBD70067F963 /* RotatingLoaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDE2253ABBD60067F963 /* RotatingLoaderView.swift */; };
 		F3DAEDE7253B073A0067F963 /* RectangleLoaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDE6253B07390067F963 /* RectangleLoaderView.swift */; };
 		F3DAEDED253B0F220067F963 /* DashedLoaderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3DAEDEC253B0F220067F963 /* DashedLoaderView.swift */; };
@@ -146,6 +145,9 @@
 		51D6273924E19F2A00BCE1C8 /* WifiView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WifiView.swift; sourceTree = "<group>"; };
 		51DAC7B2250E07E800ECA895 /* ShrinkingCapsule.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ShrinkingCapsule.swift; sourceTree = "<group>"; };
 		51F6B07E24E81E0300EF840F /* Loader.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Loader.swift; sourceTree = "<group>"; };
+		AA0001002603180100000001 /* AnimationItem.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnimationItem.swift; sourceTree = "<group>"; };
+		AA0001022603180100000002 /* AnimationCardView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnimationCardView.swift; sourceTree = "<group>"; };
+		AA0001042603180100000003 /* HomeView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HomeView.swift; sourceTree = "<group>"; };
 		DAF98EFE25F0D07F0052EDB8 /* SpinningView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SpinningView.swift; sourceTree = "<group>"; };
 		F30BA966254418B300DC8367 /* LoginView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LoginView.swift; sourceTree = "<group>"; };
 		F30BA96B25441BED00DC8367 /* Plus.swift */ = {isa = PBXFileReference; lastKnownFileType = sou
```

**File**: `SwiftUI-Animations/Code/Animations/GithubLoader/Support Shapes/Octocat.swift` (removed, +0/-109)
```diff
@@ -1,109 +0,0 @@
-//
-//  OctocatShape.swift
-//  SwiftUI-Animations
-//
-//  Created by Shubham Singh on 14/10/20.
-//  Copyright © 2020 Shubham Singh. All rights reserved.
-//
-
-import SwiftUI
-
-/// A SwiftUI `Shape` that draws the GitHub Octocat silhouette using absolute coordinates.
-///
-/// > Note from the author: "phew, had to do a lot of hit and trials for this xD"
-///
-/// Unlike a centered shape, this version uses **fixed absolute coordinates** — meaning it's sized for
-/// one specific frame and won't scale or reposition automatically if the frame changes.
-/// Use a fixed `.frame()` matching the original coordinate space, or wrap it in a
-/// `GeometryReader` and apply a scale transform if you need it to resize.
-///
-/// The path is drawn in four named sections:
-/// **right side → center crown → left side → tail**
-///
-/// Designed for `.stroke()` use — the tail is a separate open sub-path
-/// and won't close cleanly as a filled shape.
-struct OctocatShape: Shape {
-
-    func path(in rect: CGRect) -> Path {
-        var path = Path()
-
-        // ── Entry point ───────────────────────────────────────────────────────
-        path.move(to: CGPoint(x: 243.77, y: 483.38))
-
-        // ── Right side ────────────────────────────────────────────────────────
-        path.addLine(to: CGPoint(x: 243.77, y: 441.77))
-        path.addLine(to: CGPoint(x: 243.79, y: 441.46))
-
-        path.addCurve(to: CGPoint(x: 233.25, y: 413.32),
-                      control1: CGPoint(x: 244.53, y: 431),
-                      control2: CGPoint(x: 240.68, y: 420.73))
-
-        path.addCurve(to: CGPoint(x: 303, y: 338.47),
-                      control1: CGPoint(x: 267.46, y: 409.95),
-                      control2: CGPoint(x: 303, y: 397.16))
-        path.addLine(to: CGPoint(x: 303, y: 338.48))
-
-        path.addCurve(to: CGPoint(x: 286.56, y: 297.86),
-                      control1: CGPoint(x: 303, y: 323.32),
-                      control2: CGPoint(x: 297.11, y: 308.76))
-        path.addLine(to: CGPoint(x: 287, y: 297.74))
-
-        path.addCurve(to: CGPoint(x: 285.57, y: 256.94),
-                      control1: CGPoint(x: 291.84, y: 284.47),
-                      control2: CGPoint(x: 291.33, y: 269.84))
-
-        path.addCurve(to: CGPoint(x: 243.77, y: 273.54),
-                      control1: CGPoint(x: 285.88, y: 257.63),
-                      control2: CGPoint(x: 273.17, y: 253.87))
-
-        // ── Center crown ──────────────────────────────────────────────────────
-        path.addLine(to: CGPoint(x: 243.37, y: 273.43))
-        path.addCurve(to: CGPoint(x: 168.78, y: 273.43),
-                      control1: CGPoint(x: 218.94, y: 266.9),
-                      control2: CGPoint(x: 193.21, y: 266.9))
-
-        // ── Left side ─────────────────────────────────────────────────────────
-        path.addCurve(to: CGPoint(x: 126.28, y: 257.63),
-                      control1: CGPoint(x: 138.98, y: 253.87),
-                      control2: CGPoint(x: 126.28, y: 257.63))
-        path.addLine(to: CGPoint(x: 126.2, y: 257.81))
-
-        path.addCurve(to: CGPoint(x: 125.49, y: 298.63),
-                      control1: CGPoint(x: 120.67, y: 270.81),
-                      control2: CGPoint(x: 120.42, y: 285.45))
-        path.addLine(to: CGPoint(x: 125.6, y: 297.86))
-
-        path.addCurve(to: CGPoint(x: 109.15, y: 338.48),
-                      control1: CGPoint(x: 115.05, y: 308.76),
-                      control2: CGPoint(x: 109.15, y: 323.33))
-
-        path.addCurve(to: CGPoint(x: 178.51, y: 414.04),
-                      control1: CGPoint(x: 109.15, y: 397.06),
-                      control2: CGPoint(x: 144.69, y: 409.85))
-        path.addLine(to: CGPoint(x: 178.48, y: 414.07))
-
-        path.addCurve(to: CGPoint(x: 168.38, y: 441.76),
-                      control1: CGPoint(x: 171.34, y: 421.45),
-                      control2: CGPoint(x: 167.67, y: 431.52))
-
-        path.addLine(to: CGPoint(x: 168.38, y: 483.38))
-
-        // ── Tail ──────────────────────────────────────────────────────────────
-        path.move(to: CGPoint(x: 168.38, y: 451.13))
-        path.addCurve(to: CGPoint(x: 93, y: 418.88),
-                      control1: CGPoint(x: 114.54, y: 467.25),
-                      control2: CGPoint(x: 114.54, y: 424.25))
-
-        return path
-    }
-}
-
-#Preview {
-    ZStack {
-        Color.black
-            .ignoresSafeArea()
-        OctocatShape()
-            .stroke(style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round, miterLimit: 8))
-            .foregroundStyle(.white)
-    }
-}
```

**File**: `SwiftUI-Animations/Code/Animations/Octocat-Wink/OctocatView.swift` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ struct OctocatView: View {
                         .trim(from: 0, to: 1)
                         .stroke(style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round, miterLimit: 8))
                         .scaleEffect(1.35)
-                        .foregroundStyle(.label.opacity(0.1))
+                        .foregroundStyle(Color.label.opacity(0.1))
                         .shadow(color: Color.white.opacity(0.075), radius: 5, y: 2)
                     OctocatShape()
                         .trim(from: strokeStart, to: strokeEnd)
```

**File**: `SwiftUI-Animations/Code/Animations/YinYang-Toggle/Views/YinYangAnimationView.swift` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ struct YinYangAnimationView: View {
         ZStack {
             // Upper decorative line
             Rectangle()
-                .foregroundStyle(.label)
+                .foregroundStyle(Color.label)
                 .opacity(yinYangViewModel.themeToggled ? 0.25 : 0.02)
                 .frame(height: 3)
                 .scaleEffect(3)         // Stretched horizontally to bleed past screen edges
```

---

### Incident Patch 15: `94495a2f` (2026-03-19)
**Commit Message**: Merge branch 'master' of https://github.com/Shubham0812/SwiftUI-Animations

**File**: `README.md` (modified, +2/-2)
```diff
@@ -38,8 +38,8 @@ This repository contains **20+ custom SwiftUI animations** — from loaders and
 
 | Dependency | Version |
 |------------|---------|
-| iOS        | 14.0+   |
-| Xcode      | 12.0+   |
+| iOS        | 17.0+   |
+| Xcode      | 16.0+   |
 | Swift      | 5.0+    |
 
 ## Getting Started
```

#### Recent Merged Pull Requests:
- **PR #30** (2026-06-19): Add Auto Scroller & Text Bouncing, modernize Like, fix Yin Yang (@Shubham0812)
- **PR #29** (2026-06-19): Force light theme for YinYangAnimationView (@12ya)
- **PR #26** (2026-06-19): resolves #25 (@12ya)
- **PR #22** (2026-03-24): Add 4 high-quality Metal shaders to the Shaders tab (@Shubham0812)
- **PR #21** (2026-03-21): Add EmberReveal shader effect to Shaders tab (@Shubham0812)
- **PR #20** (2026-03-21): Improve README with updated project structure and Shaders (@Shubham0812)
- **PR #19** (2026-03-21): Hide tab bar when navigating into detail views (@Shubham0812)
- **PR #18** (2026-03-21): Add Shaders tab: ShaderItem model, BurnEffect Metal shader, and grid UI (@Shubham0812)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
