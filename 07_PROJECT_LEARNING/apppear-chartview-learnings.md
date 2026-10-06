# Forensic Learning Record (Deep Inspection): AppPear/ChartView

> **Canonical Artifact**: `07_PROJECT_LEARNING/apppear-chartview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AppPear/ChartView](https://github.com/AppPear/ChartView))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:31:52.842Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AppPear/ChartView`
- **Description**: ChartView made in SwiftUI
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5646 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Examples/SwiftUIChartsShowcase/SwiftUIChartsShowcaseApp/AppDelegate.swift`
```
import UIKit

@UIApplicationMain
final class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}

```

### Core Architecture Module: `Examples/SwiftUIChartsShowcase/SwiftUIChartsShowcaseApp/SceneDelegate.swift`
```
import SwiftUI
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else {
            return
        }

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UIHostingController(rootView: ShowcaseTabContainerView())
        self.window = window
        window.makeKeyAndVisible()
    }
}

```

### Core Architecture Module: `Examples/SwiftUIChartsShowcase/SwiftUIChartsShowcaseApp/ShowcaseDynamicLabView.swift`
```
import SwiftUI
import SwiftUICharts
import UIKit

struct ShowcaseDynamicLabView: View {
    @ObservedObject private var stream = ChartStreamingDataSource(initialValues: [28, 31, 30, 35, 33, 36, 34, 37],
                                                                  windowSize: 8,
                                                                  autoScroll: true)
    @State private var timer: Timer?
    @State private var callbackText = "Touch bars to receive callback events."

    private var pageBackgroundColor: Color { Color(UIColor.systemGroupedBackground) }
    private var cardBackgroundColor: Color { Color(UIColor.secondarySystemGroupedBackground) }
    private var chartSurfaceColor: Color { Color(UIColor.secondarySystemBackground) }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    liveStreamSection
                    callbackSection
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationBarTitle("Dynamic Data Lab", displayMode: .inline)
            .background(pageBackgroundColor)
        }
        .onAppear(perform: startFeed)
        .onDisappear(perform: stopFeed)
    }

    private var liveStreamSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Streaming Feed (Mock Dynamic)")
                .font(.headline)
            Text("A timer appends points continuously to emulate live network updates.")
                .font(.caption)
                .foregroundColor(.secondary)

            AxisLabels {
                ChartGrid {
                    LineChart()
                        .chartData(stream)
                        .chartYRange(stream.suggestedYRange)
                        .chartStyle(ChartStyle(backgroundColor: chartSurfaceColor,
                                               foregroundColor: ColorGradient(.green, .blue)))
                        .chartLineMarks(true, color: ColorGradient(.green, .blue))
                }
                .chartGridLines(horizontal: 5, vertical: max(2, stream.values.count))
            }
            .chartXAxisLabels(stream.xLabels)
            .chartYAxisAutoTicks(5, format: .number)
            .chartAxisFont(.caption)
            .chartAxisColor(.secondary)
            .frame(height: 240)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(cardBackgroundColor))
        }
    }

    private var callbackSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Selection Callback Output")
                .font(.headline)
            Text(callbackText)
                .font(.caption.monospacedDigit())
                .foregroundColor(.secondary)

            AxisLabels {
                ChartGrid {
                    BarChart()
                        .chartData(stream.values)
                        .chartStyle(ChartStyle(backgroundColor: chartSurfaceColor,
                                               foregroundColor: [
                                                   ColorGradient(.orange, .red),
                                                   ColorGradient(.blue, .purple),
                                                   ColorGradient(.green, .yellow)
                                               ]))
                }
                .chartGridLines(horizontal: 4, vertical: 0)
            }
            .chartXAxisLabels(stream.xLabels)
            .chartYAxisAutoTicks(4, format: .number)
            .chartAxisFont(.caption)
            .chartAxisColor(.secondary)
            .chartSelectionHandler { event in
                guard event.isActive,
                      let value = event.value,
                      let index = event.index else {
                    callbackText = "No active selection"
                    return
                }

                callbackText = "Slot \(index + 1): \(String(format: "%.2f", value))"
            }
            .frame(height: 230)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(cardBackgroundColor))
        }
    }

    private func startFeed() {
        guard timer == nil else { return }

        let next = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { _ in
            let drift = Double.random(in: -2.0...2.0)
            let value = min(45, max(20, stream.latestValue + drift))
            stream.append(value)
        }
        next.tolerance = 0.25
        timer = next
    }

    private func stopFeed() {
        timer?.invalidate()
        timer = nil
    }
}

struct ShowcaseDynamicLabView_Previews: PreviewProvider {
    static var previews: some View {
        ShowcaseDynamicLabView()
    }
}

```

### Core Architecture Module: `Examples/SwiftUIChartsShowcase/SwiftUIChartsShowcaseApp/ShowcaseHomeView.swift`
```
import SwiftUI
import SwiftUICharts
import UIKit

struct ShowcaseHomeView: View {
    private let sharedBarValue = ChartValue()
    private let lineSelectionValue = ChartValue()
    @ObservedObject private var streamingSource = ChartStreamingDataSource(initialValues: [18, 23, 20, 27, 29, 24, 28, 31],
                                                                           windowSize: 8,
                                                                           autoScroll: true)
    @State private var hiddenSeries: Set<String> = []
    @State private var streamTimer: Timer?
    @State private var highContrastEnabled = false
    @State private var performanceModeEnabled = true
    @State private var callbackSelectionText = "Drag bars to receive callback events"
    private let denseSeries: [(Double, Double)] = ShowcaseHomeView.makeDenseSeries()
    private var pageBackgroundColor: Color { Color(UIColor.systemGroupedBackground) }
    private var cardBackgroundColor: Color { Color(UIColor.secondarySystemGroupedBackground) }
    private var chartSurfaceColor: Color { Color(UIColor.secondarySystemBackground) }
    private var axisColor: Color { .secondary }
    private var ringsBackgroundGradient: ColorGradient {
        ColorGradient(chartSurfaceColor, Color(UIColor.tertiarySystemBackground))
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headline
                    lineInteractionSection
                    dynamicDataSection
                    lineChartSection
                    accessibilitySection
                    axisEngineSection
                    performanceSection
                    selectionCallbackSection
                    overlayLineSection
                    legendControlSection
                    mixedChartSection
                    interactiveBarCard
                    pieAndRingsSection
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationBarTitle("SwiftUICharts Showcase", displayMode: .inline)
            .background(pageBackgroundColor)
        }
        .onAppear(perform: startStreamingSimulation)
        .onDisappear(perform: stopStreamingSimulation)
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Composable chart examples")
                .font(.title)
                .bold()
            Text("Demonstrates line, bar, pie, and rings charts with modifier-based data, style, axis, grid, and interaction APIs.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    private var lineChartSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Line Chart + Grid + Axis + Marks + Range")
                .font(.headline)

            AxisLabels {
                ChartGrid {
                    LineChart()
                        .chartLineWidth(3)
                        .chartLineBackground(ColorGradient(.blue.opacity(0.2), .clear))
                        .chartLineMarks(true, color: ColorGradient(.blue, .purple))
                        .chartLineStyle(.curved)
                        .chartLineAnimation(true)
                        .chartData([12, 34, 23, 18, 36, 22, 26])
                        .chartYRange(10...40)
                        .chartXRange(0...6)
                        .chartStyle(ChartStyle(backgroundColor: chartSurfaceColor,
                                               foregroundColor: ColorGradient(.blue, .purple)))
                }
                .chartGridLines(horizontal: 5, vertical: 6)
            }
            .chartXAxisLabels([(0, "M"), (1, "T"), (2, "W"), (3, "T"), (4, "F"), (5, "S"), (6, "S")], range: 0...6)
            .chartYAxisLabels([(0, "10"), (1, "20"), (2, "30"), (3, "40")], range: 0...3)
            .chartAxisColor(axisColor)
            .chartAxisFont(.caption)
            .frame(maxWidth: .infinity)
            .frame(height: 220)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(cardBackgroundColor))
        }
    }

    private var axisEngineSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Auto Tick Engine (Date + Collision + Rotation)")
                .font(.headline)

            AxisLabels {
                ChartGrid {
                    LineChart()
                        .chartLineWidth(3)
                        .chartLineMarks(true)
                        .chartData(weekTimeSeries)
                        .chartYRange(10...40)
                        .chartXRange(weekTimeRange)
                        .chartStyle(ChartStyle(backgroundColor: chartSurfaceColor,
                                               foregroundColor: ColorGradient(.green, .blue)))
                }
                .chartGridLines(horizontal: 4, vertical: 6)
            }
            .chartXAxisAutoTicks(6, format: .shortDate)
            .chartYAxisAutoTicks(4, format: .number)
            .chartXAxisLabelRotation(.degrees(-24))
            .chartAxisColor(axisColor)
            .chartAxisFont(.caption)
            .frame(maxWidth: .infinity)
            .frame(height: 230)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(cardBackgroundColor))
        }
    }

    private var performanceSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Large Dataset Performance Mode")
                    .font(.headline)
                Spacer(minLength: 8)
                Toggle("Performance", isOn: $performanceModeEnabled)
                    .labelsHidden()
            }

            Text("2000 points rendered with optional downsampling + simplified line style.")
                .font(.caption)
                .foregroundColor(.secondary)

            AxisLabels {
                ChartGrid {
                    LineChart()
                        .chartData(denseSeries)
                        .chartYRange(-2...2)
                        .chartXRange(0...Double(max(0, denseSeries.count - 1)))
                        .chartStyle(ChartStyle(backgroundColor: chartSurfaceColor,
                                               foregroundColor: ColorGradient(.purple, .blue)))
                        .chartPerformance(performanceModeEnabled
                                          ? .automatic(threshold: 600, maxPoints: 180, simplifyLineStyle: true)
                                          : .none)
                }
                .chartGridLines(horizontal: 4, vertical: 6)
            }
            .chartXAxisAutoTicks(6, format: .number)
            .chartYAxisAutoTicks(5, format: .number)
            .chartAxisColor(axisColor)
            .chartAxisFont(.caption)
            .frame(maxWidth: .infinity)
            .frame(height: 220)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(cardBackgroundColor))
        }
    }

    private var accessibilitySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Accessibility + High Contrast")
                    .font(.headline)
                Spacer(minLength: 8)
                Toggle("High Contrast", isOn: $highContrastEnabled)
                    .labelsHidden()
            }

            Text("VoiceOver labels are available for bars, points, slices, and rings.")
                .font(.caption)
                .foregroundColor(.secondary)

            AxisLabels {
                ChartGrid {
                    BarChart()
                        .chartData([8, 14, 11, 17, 15, 19, 16])
                        .chartStyle(highContrastEnabled ? .highContrast : ChartStyle(backgroundColor: chartSurfaceColor,
                                                                                      foregroundColor: ColorGradient(.orange, .red)))
                }
                .chartGridLines(horizontal: 4, vertical: 0)
            }
            .chartXAxisLabels([(0, "M"), (1, "T"), (2, "W"), (3, "T"), (4, "F"), (5, "S"), (6, "S")], range: 0...6)
            .chartYAxisAutoTicks(4, format: .number)
            .chartAxisColor(axisColor)
            .chartAxisFont(.caption)
            .frame(maxWidth: .infinity)
            .frame(height: 210)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(cardBackgroundColor))
        }
    }

    private var selectionCallbackSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Selection Callback (No ChartValue)")
                .font(.headline)

            Text(callbackSelectionText)
                .font(.caption.monospacedDigit())
                .foregroundColor(.secondary)

            AxisLabels {
                ChartGrid {
                    BarChart()
                        .chartData([11, 17, 15, 20, 16, 14, 19])
                        .chartStyle(ChartStyle(backgroundColor: chartSurfaceColor,
                                               foregroundColor: [
                                                   ColorGradient(.red, .orange),
                                                   ColorGradient(.blue, .purple),
                                                   ColorGradient(.green, .yellow)
                                               ]))
                }
                .chartGridLines(horizontal: 4, vertical: 0)
            }
            .chartXAxisLabels([(0, "M"), (1, "T"), (2, "W"), (3, "T"), (4, "F"), (5, "S"), (6, "S")], range: 0...6)
            .chartYAxisAutoTicks(4, format: .number)
            .chartAxisColor(axisColor)
            .chartAxisFont(.caption)
            .chartSelectionHandler { event in
                guard event.isActive,
                      l
```

### Core Architecture Module: `Examples/SwiftUIChartsShowcase/SwiftUIChartsShowcaseApp/ShowcaseTabContainerView.swift`
```
import SwiftUI

struct ShowcaseTabContainerView: View {
    var body: some View {
        TabView {
            ShowcaseHomeView()
                .tabItem {
                    Image(systemName: "chart.xyaxis.line")
                    Text("Showcase")
                }
                .tag(0)

            ShowcaseDynamicLabView()
                .tabItem {
                    Image(systemName: "waveform.path.ecg")
                    Text("Dynamic")
                }
                .tag(1)
        }
    }
}

struct ShowcaseTabContainerView_Previews: PreviewProvider {
    static var previews: some View {
        ShowcaseTabContainerView()
    }
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "SwiftUICharts",
    platforms: [
        .iOS(.v13), .watchOS(.v6), .macOS(.v10_15)
    ],
    products: [
        // Products define the executables and libraries produced by a package, and make them visible to other packages.
        .library(
            name: "SwiftUICharts",
            targets: ["SwiftUICharts"])
    ],
    dependencies: [
        // Dependencies declare other packages that this package depends on.
        // .package(url: /* package url */, from: "1.0.0"),
    ],
    targets: [
        // Targets are the basic building blocks of a package. A target can define a module or a test suite.
        // Targets can depend on other targets in this package, and on products in packages which this package depends on.
        .target(
            name: "SwiftUICharts",
            dependencies: [],
            resources: [
                .process("PrivacyInfo.xcprivacy")
            ]),
        .testTarget(
            name: "SwiftUIChartsTests",
            dependencies: ["SwiftUICharts"])
    ]
)

```

### Core Architecture Module: `Sources/SwiftUICharts/Base/Axis/AxisLabels.swift`
```
import SwiftUI

public struct AxisLabels<Content: View>: View {
    @Environment(\.chartAxisConfig) private var axisConfig

    @State private var preferredDataPoints: [(Double, Double)] = []
    @State private var preferredXRange: ClosedRange<Double>?
    @State private var preferredYRange: ClosedRange<Double>?
    @State private var preferredXDomainMode: ChartXDomainMode = .numeric

    private let yAxisWidth: CGFloat = 42
    private let xAxisHeight: CGFloat = 24

    let content: () -> Content

    public init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    private var visibleXValues: [Double] {
        preferredDataPoints
            .filter { preferredXRange?.contains($0.0) ?? true }
            .map(\.0)
    }

    private var visibleYValues: [Double] {
        preferredDataPoints
            .filter { preferredXRange?.contains($0.0) ?? true }
            .map(\.1)
    }

    private var xRangeForScale: ClosedRange<Double>? {
        preferredXRange ?? axisConfig.axisXRange
    }

    private var xDomainModeForScale: ChartXDomainMode {
        preferredDataPoints.isEmpty ? axisConfig.axisXDomainMode : preferredXDomainMode
    }

    private var resolvedXAxisLabels: [ChartXAxisLabel] {
        if !axisConfig.axisXLabels.isEmpty {
            return axisConfig.axisXLabels
        }

        guard let autoCount = axisConfig.axisXAutoTickCount else { return [] }
        return autoGeneratedXAxisLabels(count: autoCount)
    }

    private var resolvedYAxisLabels: [String] {
        if !axisConfig.axisYLabels.isEmpty {
            return axisConfig.axisYLabels
        }

        guard let autoCount = axisConfig.axisYAutoTickCount else { return [] }
        return autoGeneratedYAxisLabels(count: autoCount)
    }

    private var hasYLabels: Bool {
        !resolvedYAxisLabels.isEmpty
    }

    private var hasXLabels: Bool {
        !resolvedXAxisLabels.isEmpty
    }

    private var effectiveYAxisWidth: CGFloat {
        hasYLabels ? yAxisWidth : 0
    }

    private var effectiveXAxisHeight: CGFloat {
        hasXLabels ? xAxisHeight : 0
    }

    private var leftAxisGutter: CGFloat {
        axisConfig.axisLabelsYPosition == .leading ? effectiveYAxisWidth : 0
    }

    private var rightAxisGutter: CGFloat {
        axisConfig.axisLabelsYPosition == .trailing ? effectiveYAxisWidth : 0
    }

    private var xScale: ChartXScale {
        let scaleValues = visibleXValues.isEmpty ? resolvedXAxisLabels.map(\.value) : visibleXValues
        return ChartXScale(values: scaleValues,
                           rangeX: xRangeForScale,
                           mode: xDomainModeForScale,
                           slotCountHint: max(scaleValues.count, resolvedXAxisLabels.count))
    }

    var yAxis: some View {
        VStack(spacing: 0) {
            ForEach(Array(resolvedYAxisLabels.reversed().enumerated()), id: \.offset) { index, axisYData in
                Text(axisYData)
                    .font(axisConfig.axisFont)
                    .foregroundColor(axisConfig.axisFontColor)
                    .frame(maxWidth: .infinity,
                           alignment: axisConfig.axisLabelsYPosition == .leading ? .trailing : .leading)

                if index < resolvedYAxisLabels.count - 1 {
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.horizontal, 4)
    }

    var xAxis: some View {
        GeometryReader { geometry in
            let safeSize = geometry.size.sanitized
            let width = safeSize.width
            let labels = visibleXAxisLabels(width: width)

            ZStack(alignment: .topLeading) {
                ForEach(Array(labels.enumerated()), id: \.offset) { _, xLabel in
                    positionedXLabel(xLabel, width: width)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: xAxisHeight, alignment: .top)
    }

    public var body: some View {
        GeometryReader { geometry in
            let safeSize = geometry.size.sanitized
            let axisHeight = effectiveXAxisHeight
            let chartHeight = max(0, safeSize.height - axisHeight)

            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    if leftAxisGutter > 0 {
                        yAxis
                            .frame(width: leftAxisGutter, height: chartHeight, alignment: .trailing)
                    }

                    content()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                    if rightAxisGutter > 0 {
                        yAxis
                            .frame(width: rightAxisGutter, height: chartHeight, alignment: .leading)
                    }
                }
                .frame(height: chartHeight, alignment: .top)

                if axisHeight > 0 {
                    HStack(spacing: 0) {
                        if leftAxisGutter > 0 {
                            Color.clear.frame(width: leftAxisGutter, height: axisHeight)
                        }

                        xAxis
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                        if rightAxisGutter > 0 {
                            Color.clear.frame(width: rightAxisGutter, height: axisHeight)
                        }
                    }
                    .frame(height: axisHeight, alignment: .top)
                }
            }
            .frame(width: safeSize.width, height: safeSize.height, alignment: .topLeading)
        }
        .onPreferenceChange(ChartDataPointsPreferenceKey.self) { snapshot in
            preferredDataPoints = snapshot.points
        }
        .onPreferenceChange(ChartXRangePreferenceKey.self) { range in
            preferredXRange = range
        }
        .onPreferenceChange(ChartYRangePreferenceKey.self) { range in
            preferredYRange = range
        }
        .onPreferenceChange(ChartXDomainModePreferenceKey.self) { mode in
            preferredXDomainMode = mode
        }
    }

    private func visibleXAxisLabels(width: CGFloat) -> [ChartXAxisLabel] {
        let labels = resolvedXAxisLabels.sorted(by: { $0.value < $1.value })
        guard labels.count > 2, width > 0 else { return labels }

        let rotationFactor = abs(axisConfig.axisXLabelRotation.degrees) > 0 ? 1.4 : 1.0
        let minimumSpacing = 28.0 * rotationFactor
        let minNormalizedDistance = minimumSpacing / width
        var filtered: [ChartXAxisLabel] = []
        var lastPlacedX = -Double.greatestFiniteMagnitude

        for (index, label) in labels.enumerated() {
            let x = xScale.normalizedX(for: label.value)
            if index == 0 || index == labels.count - 1 || (x - lastPlacedX) >= minNormalizedDistance {
                filtered.append(label)
                lastPlacedX = x
            }
        }

        return filtered
    }

    @ViewBuilder
    private func positionedXLabel(_ xLabel: ChartXAxisLabel, width: CGFloat) -> some View {
        let normalized = xScale.normalizedX(for: xLabel.value)
        let clamped = min(1.0, max(0.0, normalized))
        let label = axisLabelText(xLabel.title)

        if clamped <= 0.001 {
            label
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else if clamped >= 0.999 {
            label
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        } else {
            label
                .position(x: width * CGFloat(clamped), y: xAxisHeight / 2)
        }
    }

    private func axisLabelText(_ title: String) -> some View {
        Text(title)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .font(axisConfig.axisFont)
            .foregroundColor(axisConfig.axisFontColor)
            .rotationEffect(axisConfig.axisXLabelRotation, anchor: .top)
    }

    private func autoGeneratedXAxisLabels(count: Int) -> [ChartXAxisLabel] {
        guard count > 1 else { return [] }

        switch xDomainModeForScale {
        case .categorical:
            let values: [Double]
            if let range = xRangeForScale {
                let lower = Int(floor(range.lowerBound))
                let upper = Int(ceil(range.upperBound))
                values = Array(lower...upper).map(Double.init)
            } else {
                values = Array(Set(visibleXValues)).sorted()
            }

            guard !values.isEmpty else { return [] }
            return sampled(values, targetCount: count).map {
                ChartXAxisLabel(value: $0, title: formatAxisTick($0, format: axisConfig.axisXTickFormat))
            }

        case .numeric:
            let bounds: ClosedRange<Double>?
            if let range = xRangeForScale {
                bounds = range
            } else if let minValue = visibleXValues.min(), let maxValue = visibleXValues.max(), minValue != maxValue {
                bounds = minValue...maxValue
            } else {
                bounds = nil
            }

            guard let range = bounds else { return [] }
            let span = range.upperBound - range.lowerBound
            guard span.isFinite, span > 0 else { return [] }
            let step = span / Double(count - 1)
            return (0..<count).map { index in
                let value = range.lowerBound + step * Double(index)
                return ChartXAxisLabel(value: value, title: formatAxisTick(value, format: axisConfig.axisXTickFormat))
            }
        }
    }

    private func autoGeneratedYAxisLabels(count: Int) -> [String] {
        guard count > 1 else { return [] }

        let bounds: ClosedRange<Double>?
        if let preferredYRange = preferredYRange {
            bounds = preferredYRange
        } else if let minValue = visibleYValues.min(), let maxValue = visibleYValues.max(), minValue != maxValue {
            b
```

### Core Architecture Module: `Sources/SwiftUICharts/Base/Axis/Model/AxisLabelsPosition.swift`
```
import Foundation

public enum AxisLabelsYPosition {
    case leading
    case trailing
}

public enum AxisLabelsXPosition {
    case top
    case bottom
}

```

### Core Architecture Module: `Sources/SwiftUICharts/Base/Axis/Model/AxisLabelsStyle.swift`
```
import SwiftUI

@available(*, deprecated, message: "Use chartAxis* modifiers and ChartAxisConfig")
public typealias AxisLabelsStyle = ChartAxisConfig

```

### Core Architecture Module: `Sources/SwiftUICharts/Base/Axis/Model/AxisLablesData.swift`
```
import SwiftUI

@available(*, deprecated, message: "Use chartAxis* modifiers and ChartAxisConfig")
public typealias AxisLabelsData = ChartAxisConfig

```

### Core Architecture Module: `Sources/SwiftUICharts/Base/CardView/CardView.swift`
```
import SwiftUI

/// View containing data and chart content.
public struct CardView<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme

    let content: () -> Content

    private var showShadow: Bool

    public init(showShadow: Bool = true, @ViewBuilder content: @escaping () -> Content) {
        self.showShadow = showShadow
        self.content = content
    }

    public var body: some View {
        ZStack {
            if showShadow {
                RoundedRectangle(cornerRadius: 20)
                    .fill(cardBackgroundColor)
                    .shadow(color: shadowColor, radius: 8, x: 0, y: 2)
            }
            VStack(alignment: .leading) {
                content()
            }
            .clipShape(RoundedRectangle(cornerRadius: showShadow ? 20 : 0))
        }
    }

    private var cardBackgroundColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.white
    }

    private var shadowColor: Color {
        colorScheme == .dark ? Color.black.opacity(0.45) : Color.black.opacity(0.12)
    }
}

```

### Core Architecture Module: `Sources/SwiftUICharts/Base/Chart/ChartBase.swift`
```
import SwiftUI

@available(*, deprecated, message: "Use View-based chart modifiers (chartData, chartXRange, chartYRange) with chart views.")
public protocol ChartBase: View {}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #273** (2026-04-21): **Feature/test fork**
  *Symptoms*: qqwqww

- **Issue #271** (2025-01-16): **Is this package dead?**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > https://developer.apple.com/documentation/charts

- **Issue #266** (2023-09-29): **Fixes crash which sometimes happens in PieChartRow**
  *Symptoms*: <!--- Provide a general summary of your changes in the Title above -->  ## Description <!--- Describe your changes in detail --> We experience random crashes sometimes when the PieChartRow data is mutated often (see below screenshot).    ## Motivation and Context <!--- Why is this change required? What problem does it solve? --> <!--- If it fixes an open issue, please link to the issue here. --> This code makes the race condition that was causing the crash not possible.  ## Screenshots (if appropriate): <img width="675" alt="Screenshot 2023-09-29 at 11 31 04" src="https://github.com/AppPear/ChartView/assets/2333536/a86af4bb-4cc2-420f-b93b-a979a43d9709">  ## Types of changes <!--- What types of changes does your code introduce? Put an `x` in all the boxes that apply: --> - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to change) - [ ] Non-functional change (Updating Documentation, CI automation, etc..)  ## Checklist: <!--- Go over all the following points, and put an `x` in all the boxes that apply. --> <!--- If you're unsure about any of these, don't hesitate to ask. We're here to help! --> - [ ] My code follows the code style of this project. - [ ] My change requires a change to the documentation. - [ ] I have updated the documentation accordingly. 

- **Issue #265** (2023-09-29): **Fixes crash which sometimes happens in PieChartRow**
  *Symptoms*: <!--- Provide a general summary of your changes in the Title above -->  ## Description <!--- Describe your changes in detail --> We experience random crashes sometimes when the PieChartRow data is mutated often (see below screenshot).  ## Motivation and Context <!--- Why is this change required? What problem does it solve? --> - This code makes the race condition that was causing the crash not possible.  - It also fixes the compile error i'm getting on Xcode 15  <!--- If it fixes an open issue, please link to the issue here. -->  ## How Has This Been Tested? <!--- Please describe in detail how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  ## Screenshots (if appropriate): Crash when the slices index was out of range because the data was mutated whilst getting it. <img width="675" alt="Screenshot 2023-09-29 at 11 31 04" src="https://github.com/AppPear/ChartView/assets/2333536/f7a12f27-7995-47b1-97bc-204c0e49cacc">   ## Types of changes <!--- What types of changes does your code introduce? Put an `x` in all the boxes that apply: --> - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to change) - [ ] Non-functional change (Updating Documentation, CI automation, etc..)  ## Ch

- **Issue #259** (2025-03-11): **Bar Chart shows columns as full when no data is present**
  *Symptoms*: When there's no data in the bar chart, all the columns show as if they are full. However, as soon as I add a real positive number to any bar, the entire chart shows correctly with 1 bar having data and the rest are empty.  <img width="324" alt="Screenshot 2023-02-24 at 5 45 57 PM" src="https://user-images.githubusercontent.com/55934534/221321959-4a8b041b-758f-4be6-9be7-724b2bf7935f.png">  ## Description Here's the code. There's a chance something might be wrong with the config of the chart? I also tried test data (0's) to confirm it wasn't a problem with the variables, but it shows the same issue. I'm on v2.0.0-beta.2  ``` struct Analytics_Graph1: View {     var viewModel: AnalyticsViewModel         @State private var g1HappyMoods: Double = 0     @State private var g1NeutralMoods: Double = 0     @State private var g1SickMoods: Double = 0     @State private var g1OverateMoods: Double = 0     @State private var g1TotalDataPoints: Int = 0      let multiStyle = ChartStyle(backgroundColor: Color.green.opacity(0.2),                                 foregroundColor:                                     [ColorGradient(.purple, .blue),                                      ColorGradient(.orange, .red),                                      ColorGradient(.green, .yellow),                                      ColorGradient(.red, .purple),                                      ColorGradient(.yellow, .orange),                                     ])          var body:

- **Issue #256** (2022-11-26): **feat: add animation toggle interface**
  *Symptoms*: add animation toggle to LineChart  use `.withAnimation(true)` or  `.withAnimation(false)` 

- **Issue #255** (2022-11-26): **Feat/new protocol and range**
  *Symptoms*: 

- **Issue #253** (2022-10-24): **feat: add new axis interface**
  *Symptoms*: 

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

### Incident Patch 1: `a84f8855` (2026-03-02)
**Commit Message**: Update 2.0.0 docs, migration, and usage guide

**File**: `CHANGELOG.md` (modified, +6/-1)
```diff
@@ -1,6 +1,6 @@
 # Changelog
 
-## 2.0.0-beta.9
+## 2.0.0
 
 ### Added
 
@@ -10,8 +10,13 @@
   - `chartXAxisLabels`, `chartYAxisLabels`, `chartAxisFont`, `chartAxisColor`
   - `chartLineWidth`, `chartLineBackground`, `chartLineMarks`, `chartLineStyle`, `chartLineAnimation`
   - `chartInteractionValue`
+  - `chartSelectionHandler`
+  - `chartPerformance`
 - Immutable chart configuration structs and environment-key-based composition.
 - Updated docs/examples and generated showcase app.
+- Dynamic streaming data source support via `ChartStreamingDataSource`.
+- Unified X-axis alignment strategy shared across chart layers.
+- Apple privacy manifest for SDK distribution (`PrivacyInfo.xcprivacy`).
 
 ### Changed
 
```

**File**: `MIGRATION.md` (modified, +39/-0)
```diff
@@ -1,5 +1,11 @@
 # SwiftUICharts Migration Guide
 
+## Target release
+
+This guide targets `2.0.0`.
+
+`2.0.0` is a major breaking release and phases out the old mutable chain API in favor of composable modifier-based configuration.
+
 ## Version direction
 
 This release moves to a strict SwiftUI-idiomatic modifier API.
@@ -8,6 +14,16 @@ This release moves to a strict SwiftUI-idiomatic modifier API.
 - `ViewModifier` composition
 - Environment keys instead of mutable reference state in view structs
 
+## Migration checklist
+
+1. Replace legacy chart types with `LineChart`, `BarChart`, `PieChart`, `RingsChart`.
+2. Replace old chain methods with `chart...` modifiers.
+3. Migrate interaction:
+   - shared value model: `chartInteractionValue(_:)`
+   - callback model: `chartSelectionHandler(_:)`
+4. Validate axis label/range behavior under the unified X-axis alignment model.
+5. Run `swift test` and build the showcase app to verify rendering parity.
+
 ## Old -> new mapping
 
 ### Previous chart data/range chains
@@ -54,6 +70,7 @@ This release moves to a strict SwiftUI-idiomatic modifier API.
 | --- | --- |
 | `.chartValue(...)` on chart views | `.chartInteractionValue(...)` on any parent container |
 | `@EnvironmentObject ChartValue` requirement | optional environment interaction value |
+| N/A | `.chartSelectionHandler { event in ... }` callback-based selection |
 
 ### Legacy public type replacements
 
@@ -109,3 +126,25 @@ AxisLabels {
 }
 .chartXAxisLabels(["Q1", "Q2", "Q3", "Q4"])
 ```
+
+## Advanced migration examples
+
+### Dynamic streaming data
+
+```swift
+@ObservedObject private var stream = ChartStreamingDataSource(initialValues: [12, 14, 18, 16],
+                                                              windowSize: 8,
+                                                              autoScroll: true)
+
+LineChart()
+    .chartData(stream)
+    .chartYRange(stream.suggestedYRange)
+```
+
+### Performance mode for large datasets
+
+```swift
+LineChart()
+    .chartData(largeSeries)
+    .chartPerformance(.automatic(threshold: 600, maxPoints: 180, simplifyLineStyle: true))
+```
```

**File**: `README.md` (modified, +38/-0)
```diff
@@ -4,6 +4,18 @@ SwiftUICharts is an open-source chart library for SwiftUI with iOS 13 compatibil
 
 This release uses a fully composable, SwiftUI-idiomatic API based on immutable configuration and `ViewModifier` chains.
 
+## 2.0.0 Release
+
+Version `2.0.0` is the new major composable release.
+
+- New modifier-first API (`chartData`, `chartXRange`, `chartYRange`, `chartGridLines`, axis modifiers, line modifiers)
+- Shared X-axis alignment model across chart types
+- Optional interaction model (`chartInteractionValue`) and callback model (`chartSelectionHandler`)
+- Streaming data support (`ChartStreamingDataSource`)
+- Performance mode (`chartPerformance`)
+- Accessibility + high-contrast presets
+- Apple privacy manifest included for SDK distribution (`PrivacyInfo.xcprivacy`)
+
 <p align="center">
 <img src="Resources/linevid2.gif" width="30%"/> <img src="Resources/barvid2.gif" width="30%"/> <img src="Resources/pievid2.gif" width="30%"/>
 </p>
@@ -21,13 +33,34 @@ Use Swift Package Manager in Xcode and add:
 
 `https://github.com/AppPear/ChartView`
 
+For `2.0.0`, depend on the `2.0.0` tag or from `2.0.0` up to next major.
+
 ## Migration
 
 This is a major composable API release.
 
 - Previous chain APIs like `.data`, `.rangeX`, `.rangeY`, `.setAxisXLabels`, `.setNumberOfHorizontalLines`, and line-specific setters were replaced by typed chart modifiers.
 - Full old-to-new mapping: [MIGRATION.md](./MIGRATION.md)
 
+## Migration In 3 Steps
+
+1. Replace legacy view types (`LineChartView`, `BarChartView`, `PieChartView`, `MultiLineChartView`) with composable chart views.
+2. Replace old chain methods with new modifiers.
+3. Move interaction to container-level wiring:
+   - shared state: `.chartInteractionValue(ChartValue())`
+   - callback-driven: `.chartSelectionHandler { event in ... }`
+
+### Common replacements
+
+| Old | New |
+| --- | --- |
+| `.data([Double])` | `.chartData([Double])` |
+| `.rangeX(...)` | `.chartXRange(...)` |
+| `.rangeY(...)` | `.chartYRange(...)` |
+| `.setNumberOfHorizontalLines(h)` | `.chartGridLines(horizontal: h, vertical: ...)` |
+| `.setAxisXLabels(...)` | `.chartXAxisLabels(...)` |
+| `.showChartMarks(...)` | `.chartLineMarks(...)` |
+
 ## Quick Start
 
 **Simple line chart**
@@ -122,3 +155,8 @@ AxisLabels {
 ## Full Examples
 
 See [example.md](./example.md) and [`Examples/SwiftUIChartsShowcase`](./Examples/SwiftUIChartsShowcase) for complete showcase code.
+
+## Release Notes
+
+- Changelog: [CHANGELOG.md](./CHANGELOG.md)
+- Migration details: [MIGRATION.md](./MIGRATION.md)
```

**File**: `example.md` (modified, +7/-0)
```diff
@@ -2,6 +2,13 @@
 
 ### Example codes (modifier-based composable API)
 
+## Notes for 2.0.0 usage
+
+- Use modifier APIs only (`chartData`, `chartXRange`, `chartYRange`, `chartGridLines`, `chartXAxisLabels`, etc.).
+- Use `chartInteractionValue(_:)` when you want shared interaction state.
+- Use `chartSelectionHandler(_:)` when you prefer callback-based interaction events.
+- Use `ChartStreamingDataSource` for dynamic feeds and `chartPerformance(_:)` for large datasets.
+
 <p align="left">
 <img src="Resources/linechartcard.png" width="400px"/>
 </p>
```

---

### Incident Patch 2: `2a157243` (2026-03-02)
**Commit Message**: Add Apple privacy manifest for SwiftUICharts SDK

**File**: `Package.swift` (modified, +5/-2)
```diff
@@ -1,4 +1,4 @@
-// swift-tools-version:5.1
+// swift-tools-version:5.3
 // The swift-tools-version declares the minimum version of Swift required to build this package.
 
 import PackageDescription
@@ -23,7 +23,10 @@ let package = Package(
         // Targets can depend on other targets in this package, and on products in packages which this package depends on.
         .target(
             name: "SwiftUICharts",
-            dependencies: []),
+            dependencies: [],
+            resources: [
+                .process("PrivacyInfo.xcprivacy")
+            ]),
         .testTarget(
             name: "SwiftUIChartsTests",
             dependencies: ["SwiftUICharts"])
```

**File**: `Sources/SwiftUICharts/PrivacyInfo.xcprivacy` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+    <key>NSPrivacyTracking</key>
+    <false/>
+    <key>NSPrivacyTrackingDomains</key>
+    <array/>
+    <key>NSPrivacyCollectedDataTypes</key>
+    <array/>
+    <key>NSPrivacyAccessedAPITypes</key>
+    <array/>
+</dict>
+</plist>
```

---

### Incident Patch 3: `d7e9802d` (2022-09-03)
**Commit Message**: fix: remove UIColors which caused CI build errors (#251)

**File**: `Sources/SwiftUICharts/Base/Label/ChartLabel.swift` (modified, +8/-8)
```diff
@@ -39,13 +39,13 @@ public struct ChartLabel: View {
     private var labelPadding: EdgeInsets {
         switch labelType {
         case .title:
-            return EdgeInsets(top: 16.0, leading: 8.0, bottom: 0.0, trailing: 8.0)
+            return EdgeInsets(top: 16.0, leading: 0, bottom: 0.0, trailing: 8.0)
         case .legend:
-            return EdgeInsets(top: 4.0, leading: 8.0, bottom: 0.0, trailing: 8.0)
+            return EdgeInsets(top: 4.0, leading: 0, bottom: 0.0, trailing: 8.0)
         case .subTitle:
-            return EdgeInsets(top: 8.0, leading: 8.0, bottom: 0.0, trailing: 8.0)
+            return EdgeInsets(top: 8.0, leading: 0, bottom: 0.0, trailing: 8.0)
         case .largeTitle:
-            return EdgeInsets(top: 24.0, leading: 8.0, bottom: 0.0, trailing: 8.0)
+            return EdgeInsets(top: 24.0, leading: 0, bottom: 0.0, trailing: 8.0)
         case .custom(_, let padding, _):
             return padding
         }
@@ -59,13 +59,13 @@ public struct ChartLabel: View {
     private var labelColor: Color {
         switch labelType {
         case .title:
-            return Color(UIColor.label)
+            return Color.primary
         case .legend:
-            return Color(UIColor.secondaryLabel)
+            return Color.secondary
         case .subTitle:
-            return Color(UIColor.label)
+            return Color.primary
         case .largeTitle:
-            return Color(UIColor.label)
+            return Color.primary
         case .custom(_, _, let color):
             return color
         }
```

---

### Incident Patch 4: `bd29afc4` (2022-09-03)
**Commit Message**: fix: BarChartCellShape to handle negative numbers correctly (#250)

**File**: `Sources/SwiftUICharts/Charts/BarChart/BarChartCellShape.swift` (modified, +10/-5)
```diff
@@ -3,6 +3,7 @@ import SwiftUI
 struct BarChartCellShape: Shape, Animatable {
     var value: Double
     var cornerRadius: CGFloat = 6.0
+    
     var animatableData: CGFloat {
         get { CGFloat(value) }
         set { value = Double(newValue) }
@@ -16,14 +17,14 @@ struct BarChartCellShape: Shape, Animatable {
         path.addArc(center: CGPoint(x: cornerRadius, y: adjustedOriginY +  cornerRadius),
                     radius: cornerRadius,
                     startAngle: Angle(radians: Double.pi),
-                    endAngle: Angle(radians: -Double.pi/2),
-                    clockwise: false)
-        path.addLine(to: CGPoint(x: rect.width - cornerRadius, y: adjustedOriginY))
+                    endAngle: Angle(radians: value < 0 ? Double.pi/2 : -Double.pi/2),
+                    clockwise: value < 0 ? true : false)
+        path.addLine(to: CGPoint(x: rect.width - cornerRadius, y: value < 0 ? adjustedOriginY + 2 * cornerRadius : adjustedOriginY))
         path.addArc(center: CGPoint(x: rect.width - cornerRadius, y: adjustedOriginY + cornerRadius),
                     radius: cornerRadius,
-                    startAngle: Angle(radians: -Double.pi/2),
+                    startAngle: Angle(radians: value < 0 ? Double.pi/2 : -Double.pi/2),
                     endAngle: Angle(radians: 0),
-                    clockwise: false)
+                    clockwise: value < 0 ? true : false)
         path.addLine(to: CGPoint(x: rect.width, y: rect.height))
         path.closeSubpath()
 
@@ -39,6 +40,10 @@ struct BarChartCellShape_Previews: PreviewProvider {
 
             BarChartCellShape(value: 0.3)
                 .fill(Color.blue)
+            
+            BarChartCellShape(value: -0.3)
+                .fill(Color.blue)
+                .offset(x: 0, y: -600)
         }
     }
 }
```

---

### Incident Patch 5: `eca6eda1` (2021-03-26)
**Commit Message**: Bugfix: Line height in LineView (#175)

* Make the line reach the top and bottom of the chart.

* Put the Magnifier's bottom edge on the 0 line.

**File**: `Sources/SwiftUICharts/LineChart/LineView.swift` (modified, +2/-2)
```diff
@@ -65,15 +65,15 @@ public struct LineView: View {
                                 .animation(Animation.easeOut(duration: 1).delay(1))
                         }
                         Line(data: self.data,
-                             frame: .constant(CGRect(x: 0, y: 0, width: reader.frame(in: .local).width - 30, height: reader.frame(in: .local).height)),
+                             frame: .constant(CGRect(x: 0, y: 0, width: reader.frame(in: .local).width - 30, height: reader.frame(in: .local).height + 25)),
                              touchLocation: self.$indicatorLocation,
                              showIndicator: self.$hideHorizontalLines,
                              minDataValue: .constant(nil),
                              maxDataValue: .constant(nil),
                              showBackground: false,
                              gradient: self.style.gradientColor
                         )
-                        .offset(x: 30, y: -20)
+                        .offset(x: 30, y: 0)
                         .onAppear(){
                             self.showLegend = true
                         }
```

**File**: `Sources/SwiftUICharts/LineChart/MagnifierRect.swift` (modified, +1/-0)
```diff
@@ -29,5 +29,6 @@ public struct MagnifierRect: View {
                     .blendMode(.multiply)
             }
         }
+        .offset(x: 0, y: -15)
     }
 }
```

---

### Incident Patch 6: `1f4949a7` (2021-03-26)
**Commit Message**: Bugfix: Draw Lines (#173)

Remove .drawingGroup() to draw Lines again.

**File**: `Sources/SwiftUICharts/LineChart/Line.swift` (modified, +0/-1)
```diff
@@ -80,7 +80,6 @@ public struct Line: View {
             .onDisappear {
                 self.showFull = false
             }
-            .drawingGroup()
             if(self.showIndicator) {
                 IndicatorPoint()
                     .position(self.getClosestPointOnPath(touchLocation: self.touchLocation))
```

---

### Incident Patch 7: `5c49a55e` (2021-03-26)
**Commit Message**: fix(LineChartView): fixed linechart shifting down

**File**: `Sources/SwiftUICharts/LineChart/LineChartView.swift` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ public struct LineChartView: View {
                          maxDataValue: .constant(nil)
                     )
                 }
-                .frame(width: frame.width, height: frame.height + 30)
+                .frame(width: frame.width, height: frame.height)
                 .clipShape(RoundedRectangle(cornerRadius: 20))
                 .offset(x: 0, y: 0)
             }.frame(width: self.formSize.width, height: self.formSize.height)
```

---

### Incident Patch 8: `4699847a` (2020-08-01)
**Commit Message**: Fixed missing self in piechartrow

**File**: `.swiftpm/xcode/xcuserdata/samuandris.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 		<key>SwiftUICharts.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>0</integer>
+			<integer>3</integer>
 		</dict>
 	</dict>
 </dict>
```

**File**: `Sources/SwiftUICharts/PieChart/PieChartRow.swift` (modified, +4/-4)
```diff
@@ -43,7 +43,7 @@ public struct PieChartRow : View {
             ZStack{
                 ForEach(0..<self.slices.count){ i in
                     PieChartCell(rect: geometry.frame(in: .local), startDeg: self.slices[i].startDeg, endDeg: self.slices[i].endDeg, index: i, backgroundColor: self.backgroundColor,accentColor: self.accentColor)
-                        .scaleEffect(currentTouchedIndex == i ? 1.1 : 1)
+                        .scaleEffect(self.currentTouchedIndex == i ? 1.1 : 1)
                         .animation(Animation.spring())
                 }
             }
@@ -53,13 +53,13 @@ public struct PieChartRow : View {
                             let isTouchInPie = isPointInCircle(point: value.location, circleRect: rect)
                             if isTouchInPie {
                                 let touchDegree = degree(for: value.location, inCircleRect: rect)
-                                currentTouchedIndex = slices.firstIndex(where: { $0.startDeg < touchDegree && $0.endDeg > touchDegree }) ?? -1
+                                self.currentTouchedIndex = self.slices.firstIndex(where: { $0.startDeg < touchDegree && $0.endDeg > touchDegree }) ?? -1
                             } else {
-                                currentTouchedIndex = -1
+                                self.currentTouchedIndex = -1
                             }
                         })
                         .onEnded({ value in
-                            currentTouchedIndex = -1
+                            self.currentTouchedIndex = -1
                         }))
         }
     }
```

---

### Incident Patch 9: `2ef73c84` (2020-07-31)
**Commit Message**: Dark/Light mode fixes (#148)

Fix for making text work with both Dark/Light mode.

Also solves line chart background to appear white in dark mode

**File**: `Sources/SwiftUICharts/Base/Label/ChartLabel.swift` (modified, +4/-4)
```diff
@@ -49,13 +49,13 @@ public struct ChartLabel: View {
     private var labelColor: Color {
         switch labelType {
         case .title:
-            return .black
+            return Color(UIColor.label)
         case .legend:
-            return .gray
+            return Color(UIColor.secondaryLabel)
         case .subTitle:
-            return .black
+            return Color(UIColor.label)
         case .largeTitle:
-            return .black
+            return Color(UIColor.label)
         case .custom(_, _, let color):
             return color
         }
```

**File**: `Sources/SwiftUICharts/Charts/LineChart/Line.swift` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ extension Line {
             .fill(LinearGradient(gradient: Gradient(colors: [
                                                         style.foregroundColor.first?.startColor ?? .white,
                                                         style.foregroundColor.first?.endColor ?? .white,
-                                                        .white]),
+                                                        .clear]),
                                  startPoint: .bottom,
                                  endPoint: .top))
             .rotationEffect(.degrees(180), anchor: .center)
```

---

### Incident Patch 10: `7fb2a001` (2020-07-29)
**Commit Message**: Fix cornerMasking on card view when no shadow is set

**File**: `Sources/SwiftUICharts/Base/CardView/CardView.swift` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ public struct CardView<Content: View>: View, ChartBase {
             VStack {
                 self.content()
             }
-            .clipShape(RoundedRectangle(cornerRadius: 20))
+            .clipShape(RoundedRectangle(cornerRadius: showShadow ? 20 : 0))
         }
     }
 }
```

---

### Incident Patch 11: `6c612fae` (2020-07-26)
**Commit Message**: Fix typo (#144)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ Join our Slack channel for day to day conversation and more insights:
 
 It requires iOS 13 and Xcode 11!
 
-In Xcode got to `File -> Swift Packages -> Add Package Dependency` and paste inthe repo's url: `https://github.com/AppPear/ChartView`
+In Xcode go to `File -> Swift Packages -> Add Package Dependency` and paste in the repo's url: `https://github.com/AppPear/ChartView`
 
 ### Usage:
 
```

---

### Incident Patch 12: `c6610f56` (2020-07-05)
**Commit Message**: Fixed control flow error

**File**: `Sources/SwiftUICharts/LineChart/MultiLineChartView.swift` (modified, +6/-8)
```diff
@@ -85,15 +85,13 @@ public struct MultiLineChartView: View {
                                 .font(.callout)
                                 .foregroundColor(self.colorScheme == .dark ? self.darkModeStyle.legendTextColor : self.style.legendTextColor)
                         }
-                        if let rateValue = rateValue {
-                            HStack {
-                                if (rateValue >= 0){
-                                    Image(systemName: "arrow.up")
-                                }else{
-                                    Image(systemName: "arrow.down")
-                                }
-                                Text("\(rateValue)%")
+                        HStack {
+                            if (rateValue ?? 0 >= 0){
+                                Image(systemName: "arrow.up")
+                            }else{
+                                Image(systemName: "arrow.down")
                             }
+                            Text("\(rateValue ?? 0)%")
                         }
                     }
                     .transition(.opacity)
```

---

### Incident Patch 13: `47052674` (2020-06-28)
**Commit Message**: Builded with xcode 12

**File**: `.swiftpm/xcode/xcuserdata/samuandris.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 		<key>SwiftUICharts.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>1</integer>
+			<integer>0</integer>
 		</dict>
 	</dict>
 </dict>
```

---

### Incident Patch 14: `7568c5d4` (2020-05-30)
**Commit Message**: Bug Fix - only 0 data (#109)

**File**: `Sources/SwiftUICharts/BarChart/BarChartRow.swift` (modified, +9/-2)
```diff
@@ -12,8 +12,12 @@ public struct BarChartRow : View {
     var data: [Double]
     var accentColor: Color
     var gradient: GradientColor?
+    
     var maxValue: Double {
-        data.max() ?? 0
+        guard let max = data.max() else {
+            return 1
+        }
+        return max != 0 ? max : 1
     }
     @Binding var touchLocation: CGFloat
     public var body: some View {
@@ -44,7 +48,10 @@ public struct BarChartRow : View {
 #if DEBUG
 struct ChartRow_Previews : PreviewProvider {
     static var previews: some View {
-        BarChartRow(data: [8,23,54,32,12,37,7], accentColor: Colors.OrangeStart, touchLocation: .constant(-1))
+        Group {
+            BarChartRow(data: [0], accentColor: Colors.OrangeStart, touchLocation: .constant(-1))
+            BarChartRow(data: [8,23,54,32,12,37,7], accentColor: Colors.OrangeStart, touchLocation: .constant(-1))
+        }
     }
 }
 #endif
```

**File**: `Sources/SwiftUICharts/PieChart/PieChartRow.swift` (modified, +3/-0)
```diff
@@ -39,7 +39,10 @@ public struct PieChartRow : View {
 #if DEBUG
 struct PieChartRow_Previews : PreviewProvider {
     static var previews: some View {
+        Group {
         PieChartRow(data:[8,23,54,32,12,37,7,23,43], backgroundColor: Color(red: 252.0/255.0, green: 236.0/255.0, blue: 234.0/255.0), accentColor: Color(red: 225.0/255.0, green: 97.0/255.0, blue: 76.0/255.0)).frame(width: 100, height: 100)
+        PieChartRow(data:[0], backgroundColor: Color(red: 252.0/255.0, green: 236.0/255.0, blue: 234.0/255.0), accentColor: Color(red: 225.0/255.0, green: 97.0/255.0, blue: 76.0/255.0)).frame(width: 100, height: 100)
+        }
         
     }
 }
```

---

### Incident Patch 15: `d64d0e9d` (2020-05-30)
**Commit Message**: Bug Fix: Bar Chart with [0] crashed (#110)

**File**: `Sources/SwiftUICharts/Charts/BarChart/BarChart.swift` (modified, +3/-0)
```diff
@@ -10,6 +10,9 @@ public struct BarChart: ChartType {
 struct BarChart_Previews: PreviewProvider {
     static var previews: some View {
         Group {
+            BarChart().makeChart(
+            configuration: .init(data: [0]),
+            style: .init(backgroundColor: .white, foregroundColor: ColorGradient.redBlack))
             Group {
                 BarChart().makeChart(
                     configuration: .init(data: [1, 2, 3, 5, 1]),
```

**File**: `Sources/SwiftUICharts/Charts/BarChart/BarChartCell.swift` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ public struct BarChartCell: View {
 struct BarChartCell_Previews: PreviewProvider {
     static var previews: some View {
         Group {
+            BarChartCell(value: 0, width: 50, numberOfDataPoints: 1, gradientColor: ColorGradient.greenRed, touchLocation: .constant(CGFloat()))
             Group {
                 BarChartCell(value: 1, width: 50, numberOfDataPoints: 1, gradientColor: ColorGradient.greenRed, touchLocation: .constant(CGFloat()))
                 BarChartCell(value: 1, width: 50, numberOfDataPoints: 1, gradientColor: ColorGradient.whiteBlack, touchLocation: .constant(CGFloat()))
```

**File**: `Sources/SwiftUICharts/Charts/BarChart/BarChartRow.swift` (modified, +5/-1)
```diff
@@ -11,7 +11,10 @@ public struct BarChartRow: View {
     var style: ChartStyle
     
     var maxValue: Double {
-        data.max() ?? 0
+        guard let max = data.max() else {
+            return 1
+        }
+        return max != 0 ? max : 1
     }
 
     public var body: some View {
@@ -59,6 +62,7 @@ public struct BarChartRow: View {
 struct BarChartRow_Previews: PreviewProvider {
     static var previews: some View {
         Group {
+            BarChartRow(data: [0], style: styleGreenRed)
             Group {
                 BarChartRow(data: [1, 2, 3], style: styleGreenRed)
                 BarChartRow(data: [1, 2, 3], style: styleGreenRedWhiteBlack)
```

**File**: `Sources/SwiftUICharts/Charts/LineChart/LineChart.swift` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@ public struct LineChart: ChartType {
 struct LineChart_Previews: PreviewProvider {
     static var previews: some View {
         Group {
+            LineChart().makeChart(
+            configuration: .init(data: [0]),
+            style: .init(backgroundColor: .white, foregroundColor: ColorGradient(.black)))
             Group {
                 LineChart().makeChart(
                     configuration: .init(data: [1, 2, 3, 5, 1]),
```

**File**: `Sources/SwiftUICharts/Charts/PieChart/PieChart.swift` (modified, +4/-0)
```diff
@@ -17,6 +17,10 @@ public struct PieChart: ChartType {
 struct PieChart_Previews: PreviewProvider {
     static var previews: some View {
         Group {
+            PieChart().makeChart(
+                configuration: .init(data: [0]),
+            style: styleOneColor)
+            
             Group {
                 PieChart().makeChart(
                     configuration: .init(data: [56, 78, 53, 65, 54]),
```

**File**: `Sources/SwiftUICharts/Charts/PieChart/PieChartCell.swift` (modified, +11/-2)
```diff
@@ -12,7 +12,6 @@ struct PieSlice: Identifiable {
     var startDeg: Double
     var endDeg: Double
     var value: Double
-    //var normalizedValue: Double
 }
 
 public struct PieChartCell: View {
@@ -47,7 +46,7 @@ public struct PieChartCell: View {
         Group {
             path
                 .fill(self.accentColor.linearGradient(from: .bottom, to: .top))
-                .overlay(path.stroke(self.backgroundColor, lineWidth: 2))
+                .overlay(path.stroke(self.backgroundColor, lineWidth: (startDeg == 0 && endDeg == 0 ? 0 : 2)))
                 .scaleEffect(self.show ? 1 : 0)
                 .animation(Animation.spring().delay(Double(self.index) * 0.04))
                 .onAppear {
@@ -97,6 +96,16 @@ struct PieChartCell_Previews: PreviewProvider {
                 rect: geometry.frame(in: .local),
                 startDeg: 185.0,
                 endDeg: 290.0,
+                index: 1,
+                backgroundColor: Color.purple,
+                accentColor: ColorGradient(.purple))
+            }.frame(width: 100, height: 100)
+            
+            GeometryReader { geometry in
+            PieChartCell(
+                rect: geometry.frame(in: .local),
+                startDeg: 0,
+                endDeg: 0,
                 index: 0,
                 backgroundColor: Color.purple,
                 accentColor: ColorGradient(.purple))
```

**File**: `Sources/SwiftUICharts/Charts/PieChart/PieChartRow.swift` (modified, +9/-4)
```diff
@@ -15,10 +15,10 @@ public struct PieChartRow: View {
     var slices: [PieSlice] {
         var tempSlices: [PieSlice] = []
         var lastEndDeg: Double = 0
-        let maxValue = data.reduce(0, +)
+        let maxValue: Double = data.reduce(0, +)
         
         for slice in data {
-            let normalized: Double = Double(slice)/Double(maxValue)
+            let normalized: Double = Double(slice) / (maxValue == 0 ? 1 : maxValue)
             let startDeg = lastEndDeg
             let endDeg = lastEndDeg + (normalized * 360)
             lastEndDeg = endDeg
@@ -55,12 +55,17 @@ struct PieChartRow_Previews: PreviewProvider {
             PieChartRow(
                 data: [8, 23, 32, 7, 23, 43],
                 style: defaultMultiColorChartStyle)
-                .frame(width: 100, height: 100)
+            .frame(width: 100, height: 100)
             
             PieChartRow(
                 data: [8, 23, 32, 7, 23, 43],
                 style: multiColorChartStyle)
-            .   frame(width: 100, height: 100)
+            .frame(width: 100, height: 100)
+            
+            PieChartRow(
+                data: [0],
+                style: multiColorChartStyle)
+            .frame(width: 100, height: 100)
             
         }.previewLayout(.fixed(width: 125, height: 125))
         
```

#### Recent Merged Pull Requests:
- **PR #273** (closed): Feature/test fork (@exth)
- **PR #266** (closed): Fixes crash which sometimes happens in PieChartRow (@harryblam)
- **PR #265** (closed): Fixes crash which sometimes happens in PieChartRow (@harryblam)
- **PR #256** (2022-11-26): feat: add animation toggle interface (@AppPear)
- **PR #255** (2022-11-26): Feat/new protocol and range (@AppPear)
- **PR #253** (2022-10-24): feat: add new axis interface (@AppPear)
- **PR #252** (2022-10-24): feat: new protocol for chained functions, and added support for expli… (@AppPear)
- **PR #251** (2022-09-03): fix: remove UIColors which caused CI build errors (@AppPear)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
