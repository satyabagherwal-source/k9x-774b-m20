# Forensic Learning Record (Deep Inspection): siteline/swiftui-introspect

> **Canonical Artifact**: `07_PROJECT_LEARNING/siteline-swiftui-introspect-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/siteline/swiftui-introspect](https://github.com/siteline/swiftui-introspect))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:39.137Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `siteline/swiftui-introspect`
- **Description**: Introspect underlying UIKit/AppKit components from SwiftUI
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6560 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/Utils.swift`
```
postfix operator ~

postfix func ~ <T>(lhs: some Any) -> T {
	lhs as! T
}

postfix func ~ <T>(lhs: (some Any)?) -> T? {
	lhs as? T
}

func recursiveSequence<S: Sequence>(_ sequence: S, children: @escaping (S.Element) -> S) -> AnySequence<S.Element> {
	AnySequence {
		var mainIterator = sequence.makeIterator()
		// Current iterator, or `nil` if all sequences are exhausted:
		var iterator: AnyIterator<S.Element>?

		return AnyIterator {
			guard let iterator, let element = iterator.next() else {
				if let element = mainIterator.next() {
					iterator = recursiveSequence(children(element), children: children).makeIterator()
					return element
				}
				return nil
			}
			return element
		}
	}
}

```

### Core Architecture Module: `Examples/Package.swift`
```
// swift-tools-version:6.2

import PackageDescription

let package = Package(
	name: "Examples",
	products: [],
	targets: [],
)

```

### Core Architecture Module: `Examples/Showcase/Showcase/App.swift`
```
import SwiftUI

@main
struct App: SwiftUI.App {
	var body: some Scene {
		WindowGroup {
			AppView()
		}
	}
}

#Preview {
	AppView()
}

```

### Core Architecture Module: `Examples/Showcase/Showcase/AppView.swift`
```
import SwiftUI
import SwiftUIIntrospect

struct AppView: View {
	var body: some View {
		ContentView()
			#if os(iOS) || os(tvOS) || os(visionOS)
			.introspect(
				.window,
				on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
				.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
				.visionOS(.v1, .v2, .v26, .v27),
			) { window in
				window.backgroundColor = .brown
			}
			#elseif os(macOS)
			.introspect(.window, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { window in
				window.backgroundColor = .lightGray
			}
			#endif
	}
}

struct ContentView: View {
	@State var selection = 0

	var body: some View {
		TabView(selection: $selection) {
			ListShowcase()
				.tabItem { Label("List", systemImage: "1.circle") }
				.tag(0)
			ScrollViewShowcase()
				.tabItem { Label("ScrollView", systemImage: "2.circle") }
				.tag(1)
			#if !os(macOS)
			NavigationShowcase()
				.tabItem { Label("Navigation", systemImage: "3.circle") }
				.tag(2)
			PresentationShowcase()
				.tabItem { Label("Presentation", systemImage: "4.circle") }
				.tag(3)
			#endif
			ControlsShowcase()
				.tabItem { Label("Controls", systemImage: "5.circle") }
				.tag(4)
			UIViewRepresentableShowcase()
				.tabItem { Label("UIViewRepresentable", systemImage: "6.circle") }
				.tag(5)
		}
		#if os(iOS) || os(tvOS)
		.introspect(
			.tabView,
			on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
		) { tabBarController in
			if #available(iOS 26, macOS 26, tvOS 26, *) {
				tabBarController.tabBar.backgroundColor = .green
			} else {
				let appearance = UITabBarAppearance()
				appearance.configureWithOpaqueBackground()
				appearance.backgroundColor = .green
				tabBarController.tabBar.standardAppearance = appearance
				tabBarController.tabBar.scrollEdgeAppearance = appearance
			}
		}
		#elseif os(macOS)
		.introspect(.tabView, on: .macOS(.v12, .v13, .v14)) { splitView in
			splitView.subviews.first?.layer?.backgroundColor = NSColor.green.cgColor
		}
		#endif
	}
}

#Preview {
	AppView()
}

```

### Core Architecture Module: `Examples/Showcase/Showcase/Controls.swift`
```
import SwiftUI
import SwiftUIIntrospect

struct ControlsShowcase: View {
	@State private var textFieldValue = ""
	@State private var toggleValue = false
	@State private var sliderValue = 0.0
	@State private var datePickerValue = Date()
	@State private var segmentedControlValue = 0

	var body: some View {
		VStack {
			HStack {
				TextField("Text Field Red", text: $textFieldValue)
					#if os(iOS) || os(tvOS) || os(visionOS)
					.introspect(
						.textField,
						on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.visionOS(.v1, .v2, .v26, .v27),
					) { textField in
						textField.backgroundColor = .red
					}
					#elseif os(macOS)
					.introspect(.textField, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { textField in
						textField.backgroundColor = .red
					}
					#endif

				TextField("Text Field Green", text: $textFieldValue)
					.cornerRadius(8)
					#if os(iOS) || os(tvOS) || os(visionOS)
					.introspect(
						.textField,
						on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.visionOS(.v1, .v2, .v26, .v27),
					) { textField in
						textField.backgroundColor = .green
					}
					#elseif os(macOS)
					.introspect(.textField, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { textField in
						textField.backgroundColor = .green
					}
					#endif
			}

			#if !os(tvOS)
			#if !os(visionOS)
			HStack {
				Toggle("Toggle Red", isOn: $toggleValue)
					#if os(iOS)
					.introspect(
						.toggle,
						on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
					) { toggle in
						toggle.backgroundColor = .red
					}
					#elseif os(macOS)
					.introspect(.toggle, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { toggle in
						toggle.layer?.backgroundColor = NSColor.red.cgColor
					}
					#endif

				Toggle("Toggle Green", isOn: $toggleValue)
					#if os(iOS)
					.introspect(
						.toggle,
						on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
					) { toggle in
						toggle.backgroundColor = .green
					}
					#elseif os(macOS)
					.introspect(.toggle, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { toggle in
						toggle.layer?.backgroundColor = NSColor.green.cgColor
					}
					#endif
			}

			#if !targetEnvironment(macCatalyst)
			HStack {
				Slider(value: $sliderValue, in: 0...100)
					#if os(iOS)
					.introspect(.slider, on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27)) { slider in
						slider.backgroundColor = .red
					}
					#elseif os(macOS)
					.introspect(.slider, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { slider in
						slider.layer?.backgroundColor = NSColor.red.cgColor
					}
					#endif

				Slider(value: $sliderValue, in: 0...100)
					#if os(iOS)
					.introspect(.slider, on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27)) { slider in
						slider.backgroundColor = .green
					}
					#elseif os(macOS)
					.introspect(.slider, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { slider in
						slider.layer?.backgroundColor = NSColor.green.cgColor
					}
					#endif
			}
			#endif

			HStack {
				Stepper(onIncrement: {}, onDecrement: {}) {
					Text("Stepper Red")
				}
				#if os(iOS)
				.introspect(.stepper, on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27)) { stepper in
					stepper.backgroundColor = .red
				}
				#elseif os(macOS)
				.introspect(.stepper, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { stepper in
					stepper.layer?.backgroundColor = NSColor.red.cgColor
				}
				#endif

				Stepper(onIncrement: {}, onDecrement: {}) {
					Text("Stepper Green")
				}
				#if os(iOS)
				.introspect(.stepper, on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27)) { stepper in
					stepper.backgroundColor = .green
				}
				#elseif os(macOS)
				.introspect(.stepper, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { stepper in
					stepper.layer?.backgroundColor = NSColor.green.cgColor
				}
				#endif
			}
			#endif

			HStack {
				DatePicker(selection: $datePickerValue) {
					Text("DatePicker Red")
				}
				#if os(iOS) || os(visionOS)
				.introspect(
					.datePicker,
					on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
					.visionOS(.v1, .v2, .v26, .v27),
				) { datePicker in
					datePicker.backgroundColor = .red
				}
				#elseif os(macOS)
				.introspect(.datePicker, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { datePicker in
					datePicker.layer?.backgroundColor = NSColor.red.cgColor
				}
				#endif
			}
			#endif

			HStack {
				Picker(selection: $segmentedControlValue, label: Text("Segmented control")) {
					Text("Option 1").tag(0)
					Text("Option 2").tag(1)
					Text("Option 3").tag(2)
				}
				.pickerStyle(SegmentedPickerStyle())
				#if os(iOS) || os(tvOS) || os(visionOS)
				.introspect(
					.picker(style: .segmented),
					on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
					.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
					.visionOS(.v1, .v2, .v26, .v27),
				) { datePicker in
					datePicker.backgroundColor = .red
				}
				#elseif os(macOS)
				.introspect(.picker(style: .segmented), on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { datePicker in
					datePicker.layer?.backgroundColor = NSColor.red.cgColor
				}
				#endif
			}
		}
	}
}

```

### Core Architecture Module: `Examples/Showcase/Showcase/Helpers.swift`
```
import SwiftUI

extension View {
	/// Modify a view with a `ViewBuilder` closure.
	///
	/// This represents a streamlining of the
	/// [`modifier`](https://developer.apple.com/documentation/swiftui/view/modifier(_:)) +
	/// [`ViewModifier`](https://developer.apple.com/documentation/swiftui/viewmodifier) pattern.
	///
	/// - Note: Useful only when you don't need to reuse the closure.
	/// If you do, turn the closure into a proper modifier.
	public func modifier<ModifiedContent: View>(
		@ViewBuilder _ modifier: (Self) -> ModifiedContent,
	) -> ModifiedContent {
		modifier(self)
	}
}

```

### Core Architecture Module: `Examples/Showcase/Showcase/List.swift`
```
import SwiftUI
import SwiftUIIntrospect

struct ListShowcase: View {
	@State var receiverListFound: Bool = false
	@State var ancestorListFound: Bool = false

	var body: some View {
		VStack(spacing: 40) {
			VStack {
				Text("Default")
					.lineLimit(1)
					.minimumScaleFactor(0.5)
					.padding(.horizontal, 12)
				List {
					Text("Item 1")
					Text("Item 2")
				}
			}

			VStack {
				Text(".introspect(.list, ...)")
					.lineLimit(1)
					.minimumScaleFactor(0.5)
					.padding(.horizontal, 12)
					.font(.system(.subheadline, design: .monospaced))
				List {
					Text("Item 1")
					Text("Item 2")
				}
				.modifier { list in
					if #available(iOS 16, macOS 13, *) {
						list.background {
							if receiverListFound {
								Color(.cyan)
							}
						}
						#if !os(tvOS)
						.scrollContentBackground(.hidden)
						#endif
					} else {
						list
					}
				}
				#if os(iOS) || os(tvOS) || os(visionOS)
				.introspect(.list, on: .iOS(.v15), .tvOS(.v15, .v16, .v17, .v18, .v26, .v27)) { tableView in
					tableView.backgroundView = UIView()
					tableView.backgroundColor = .cyan
				}
				.introspect(.list, on: .iOS(.v16, .v17, .v18, .v26, .v27), .visionOS(.v1, .v2, .v26, .v27)) { collectionView in
					DispatchQueue.main.async {
						receiverListFound = true
					}
				}
				#elseif os(macOS)
				.introspect(.list, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { tableView in
					DispatchQueue.main.async {
						receiverListFound = true
					}
				}
				#endif
			}

			VStack {
				Text(".introspect(.list, ..., scope: .ancestor)")
					.lineLimit(1)
					.minimumScaleFactor(0.5)
					.padding(.horizontal, 12)
					.font(.system(.subheadline, design: .monospaced))
				List {
					Text("Item 1")
					Text("Item 2")
						#if os(iOS) || os(tvOS) || os(visionOS)
						.introspect(
							.list,
							on: .iOS(.v15),
							.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
							scope: .ancestor,
						) { tableView in
							tableView.backgroundView = UIView()
							tableView.backgroundColor = .cyan
						}
						.introspect(
							.list,
							on: .iOS(.v16, .v17, .v18, .v26, .v27),
							.visionOS(.v1, .v2, .v26, .v27),
							scope: .ancestor,
						) { collectionView in
							DispatchQueue.main.async {
								ancestorListFound = true
							}
						}
						#elseif os(macOS)
						.introspect(.list, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27), scope: .ancestor) { tableView in
							DispatchQueue.main.async {
								ancestorListFound = true
							}
						}
						#endif
				}
				.modifier { list in
					if #available(iOS 16, macOS 13, *) {
						list.background {
							if ancestorListFound {
								Color(.cyan)
							}
						}
						#if !os(tvOS)
						.scrollContentBackground(.hidden)
						#endif
					} else {
						list
					}
				}
			}
		}
	}
}

```

### Core Architecture Module: `Examples/Showcase/Showcase/Navigation.swift`
```
import SwiftUI
import SwiftUIIntrospect

struct NavigationShowcase: View {
	var body: some View {
		NavigationView {
			Text("Content")
				.searchable(text: .constant(""))
				#if os(iOS) || os(visionOS)
				.navigationBarTitle(Text("Customized"), displayMode: .inline)
				#elseif os(macOS)
				.navigationTitle(Text("Navigation"))
				#endif
		}
		#if os(iOS) || os(tvOS) || os(visionOS)
		.introspect(
			.navigationView(style: .stack),
			on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.visionOS(.v1, .v2, .v26, .v27),
		) { navigationController in
			navigationController.navigationBar.backgroundColor = .cyan
		}
		.introspect(
			.navigationView(style: .columns),
			on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.visionOS(.v1, .v2, .v26, .v27),
		) { splitViewController in
			splitViewController.preferredDisplayMode = .oneBesideSecondary
		}
		.introspect(
			.navigationView(style: .columns),
			on: .tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
		) { navigationController in
			navigationController.navigationBar.backgroundColor = .cyan
		}
		.introspect(
			.searchField,
			on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.visionOS(.v1, .v2, .v26, .v27),
		) { searchBar in
			searchBar.backgroundColor = .red
			#if os(iOS)
			searchBar.searchTextField.backgroundColor = .purple
			#endif
		}
		#endif
	}
}

```

### Core Architecture Module: `Examples/Showcase/Showcase/Presentation.swift`
```
import SwiftUI
import SwiftUIIntrospect

#if !os(macOS)
struct PresentationShowcase: View {
	@State var isSheetPresented = false
	@State var isFullScreenPresented = false
	@State var isPopoverPresented = false

	var body: some View {
		VStack(spacing: 20) {
			Button("Sheet", action: { isSheetPresented = true })
				.sheet(isPresented: $isSheetPresented) {
					Button("Dismiss", action: { isSheetPresented = false })
						#if os(iOS) || os(tvOS)
						.introspect(
							.sheet,
							on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
							.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
						) { presentationController in
							presentationController.containerView?.backgroundColor = .red.withAlphaComponent(0.75)
						}
						#elseif os(visionOS)
						.introspect(.sheet, on: .visionOS(.v1, .v2, .v26, .v27)) { sheetPresentationController in
							sheetPresentationController.containerView?.backgroundColor = .red.withAlphaComponent(0.75)
						}
						#endif
				}

			Button("Full Screen Cover", action: { isFullScreenPresented = true })
				.fullScreenCover(isPresented: $isFullScreenPresented) {
					Button("Dismiss", action: { isFullScreenPresented = false })
						#if os(iOS) || os(tvOS) || os(visionOS)
						.introspect(
							.fullScreenCover,
							on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
							.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
							.visionOS(.v1, .v2, .v26, .v27),
						) { presentationController in
							presentationController.containerView?.backgroundColor = .red.withAlphaComponent(0.75)
						}
						#endif
				}

			#if os(iOS) || os(visionOS)
			Button("Popover", action: { isPopoverPresented = true })
				.popover(isPresented: $isPopoverPresented) {
					Button("Dismiss", action: { isPopoverPresented = false })
						.padding()
						.introspect(
							.popover,
							on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
							.visionOS(.v1, .v2, .v26, .v27),
						) { presentationController in
							presentationController.containerView?.backgroundColor = .red.withAlphaComponent(0.75)
						}
				}
			#endif
		}
	}
}
#endif

```

### Core Architecture Module: `Examples/Showcase/Showcase/ScrollView.swift`
```
import SwiftUI
import SwiftUIIntrospect

struct ScrollViewShowcase: View {
	@State var receiverScrollViewFound: Bool = false
	@State var ancestorScrollViewFound: Bool = false

	var body: some View {
		VStack(spacing: 40) {
			ScrollView {
				Text("Default")
					.frame(maxWidth: .infinity)
					.lineLimit(1)
					.minimumScaleFactor(0.5)
					.padding(.horizontal, 12)
			}

			ScrollView {
				Text(".introspect(.scrollView, ...)")
					.frame(maxWidth: .infinity)
					.lineLimit(1)
					.minimumScaleFactor(0.5)
					.padding(.horizontal, 12)
					.font(.system(.subheadline, design: .monospaced))
			}
			.background {
				if receiverScrollViewFound {
					Color(.cyan)
				}
			}
			#if os(iOS) || os(tvOS) || os(visionOS)
			.introspect(
				.scrollView,
				on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
				.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
				.visionOS(.v1, .v2, .v26, .v27),
			) { _ in
				DispatchQueue.main.async {
					receiverScrollViewFound = true
				}
			}
			#elseif os(macOS)
			.introspect(.scrollView, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { scrollView in
				DispatchQueue.main.async {
					receiverScrollViewFound = true
				}
			}
			#endif

			ScrollView {
				Text(".introspect(.scrollView, ..., scope: .ancestor)")
					.frame(maxWidth: .infinity)
					.lineLimit(1)
					.minimumScaleFactor(0.5)
					.padding(.horizontal, 12)
					.font(.system(.subheadline, design: .monospaced))
					#if os(iOS) || os(tvOS) || os(visionOS)
					.introspect(
						.scrollView,
						on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.visionOS(.v1, .v2, .v26, .v27),
						scope: .ancestor,
					) { _ in
						DispatchQueue.main.async {
							ancestorScrollViewFound = true
						}
					}
					#elseif os(macOS)
					.introspect(.scrollView, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27), scope: .ancestor) { scrollView in
						DispatchQueue.main.async {
							ancestorScrollViewFound = true
						}
					}
					#endif
			}
			.background {
				if ancestorScrollViewFound {
					Color(.cyan)
				}
			}
		}
	}
}

```

### Core Architecture Module: `Examples/Showcase/Showcase/UIViewRepresentable.swift`
```
import SwiftUI
@_spi(Internals) import SwiftUIIntrospect

struct UIViewRepresentableShowcase: View {
	let colors: [Color] = [.red, .green, .blue]

	var body: some View {
		VStack(spacing: 10) {
			ForEach(colors, id: \.self) { color in
				GenericViewRepresentable()
					#if os(iOS) || os(tvOS) || os(visionOS)
					.introspect(
						.view,
						on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
						.visionOS(.v1, .v2, .v26, .v27),
					) { view in
						view.backgroundColor = UIColor(color)
					}
					#elseif os(macOS)
					.introspect(.view, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { view in
						view.layer?.backgroundColor = NSColor(color).cgColor
					}
					#endif
			}
		}
		.padding()
		#if os(iOS) || os(tvOS) || os(visionOS)
		.introspect(
			.view,
			on: .iOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.tvOS(.v15, .v16, .v17, .v18, .v26, .v27),
			.visionOS(.v1, .v2, .v26, .v27),
		) { view in
			view.backgroundColor = .red
		}
		#elseif os(macOS)
		.introspect(.view, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { view in
			view.layer?.backgroundColor = NSColor.red.cgColor
		}
		#endif
	}
}

@MainActor
struct GenericViewRepresentable: PlatformViewControllerRepresentable {
	#if canImport(UIKit)
	typealias UIViewControllerType = PlatformViewController
	#elseif canImport(AppKit)
	typealias NSViewControllerType = PlatformViewController
	#endif

	func makePlatformViewController(context: Context) -> PlatformViewController {
		let controller = PlatformViewController(nibName: nil, bundle: nil)
		controller.view.translatesAutoresizingMaskIntoConstraints = false

		let widthConstraint = controller.view.widthAnchor.constraint(greaterThanOrEqualToConstant: .greatestFiniteMagnitude)
		widthConstraint.priority = .defaultLow

		let heightConstraint = controller.view
			.heightAnchor
			.constraint(greaterThanOrEqualToConstant: .greatestFiniteMagnitude)
		heightConstraint.priority = .defaultLow

		NSLayoutConstraint.activate([widthConstraint, heightConstraint])

		return controller
	}

	func updatePlatformViewController(_ controller: PlatformViewController, context: Context) {
		// NO-OP
	}

	static func dismantlePlatformViewController(_ controller: PlatformViewController, coordinator: Coordinator) {
		// NO-OP
	}
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:6.2

import PackageDescription

let package = Package(
	name: "swiftui-introspect",
	platforms: [
		.iOS(.v13),
		.macCatalyst(.v13),
		.macOS(.v12),
		.tvOS(.v13),
		.visionOS(.v1),
	],
	products: [
		.library(name: "SwiftUIIntrospect", targets: ["SwiftUIIntrospect"]),
	],
	targets: [
		.target(
			name: "SwiftUIIntrospect",
			path: "Sources",
		),
	],
)

for target in package.targets {
	target.swiftSettings = target.swiftSettings ?? []
	target.swiftSettings? += [
		.enableUpcomingFeature("ExistentialAny"),
		.enableUpcomingFeature("ImmutableWeakCaptures"),
		.enableUpcomingFeature("InferIsolatedConformances"),
		.enableUpcomingFeature("InternalImportsByDefault"),
		.enableUpcomingFeature("MemberImportVisibility"),
		.enableUpcomingFeature("NonisolatedNonsendingByDefault"),
	]
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #500** (2025-10-23): **Support for iOS 26?**
  *Symptoms*: ### Description  Hi! I'm using `swiftui-introspect` for my project. Amazing package by the way!  My project now supports iOS 26, but the package doesn't seem to have been update it to support it (breaking some of my app's UI).  Can I know when iOS 26 support will be added please? From the README, it looks like it should be out already, but that doesn't seem to be the case.  Thanks so much in advance!  ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Steps to reproduce  _No response_  ### Version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Have you updated the dependency to 26.0.0?  ```swift .package(url: "https://github.com/siteline/swiftui-introspect", from: "26.0.0"), ```

- **Issue #498** (2026-03-16): **View introspection gives zero height on Xcode 26 for any iOS version on v26.0.0 release**
  *Symptoms*: ### Description  Introspecting any view with the .view IntrospectableViewType returns zero height on Xcode 26 with any iOS version when using v26.0.0 release. By using Xcode 16.4 instead it returns a valid value.  ``` .introspect(.view, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) { view in     debugPrint("HEIGHT: \(view.bounds.height)") // <-- here I got 0 on Xcode 26 } ```  ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  It should return a non zero value.  ``` .introspect(.view, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) { view in     debugPrint("HEIGHT: \(view.bounds.height)") // <-- here I should get a positive value } ```  ### Actual behavior  On Xcode 26 I get zero for view height, while on Xcode 16.4 I get a valid non zero value  ``` .introspect(.view, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) { view in     debugPrint("HEIGHT: \(view.bounds.height)") // <-- here I got 0 on Xcode 26 and a positive value on Xcode 16.4 } ```  ### Steps to reproduce  Attach this code to a SwiftUI view and run it with Xcode 26 by choosing any iOS simulator, it will return zero for the view height.  ``` .introspect(.view, on: .iOS(.v13, .v14, .v15, .v
  **Post-Mortem & Fix Analysis**:
  > As [documented](https://swiftpackageindex.com/siteline/swiftui-introspect/main/documentation/swiftuiintrospect/viewtype):  > prior to iOS 26, primitive views like Text, Image, Button, and layout stacks were drawn inside a subclass of UIView called _UIGraphicsView which was introspectable via .introspect(.view), however starting iOS 26 this is no longer the case and all SwiftUI primitives seem to somehow be drawn without an underlying UIView vessel.
  > So the .introspect(.view) is essentially no more useful on OS 26, is that correct? Which is the better way to get the underlying element height now?
  > > So the .introspect(.view) is essentially no more useful on OS 26, is that correct?  In my estimation, it's only useful in obtaining the underlying element of a UIViewRepresentable.  > Which is the better way to get the underlying element height now?  `GeometryReader`.

- **Issue #490** (2025-09-16): **The CocoaPods Version 26.0.0 unavailable**
  *Symptoms*: ### Description  Hi can you please fix the latest 26.0.0 version. Looks like there are two issues.   ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  - The podspec version has incorrect format. - Use command `pod trunk push SwiftUIIntrospect.podspec `  ### Actual behavior  - The podspec version has incorrect which results in the following error   - The `SwiftUIIntrospect` pod failed to validate due to 1 error:     - ERROR | version: A version is required. - The actual pod has to be "published". Right now the CocoaPods doesn't see the latest 26.0.0 version.  ### Steps to reproduce  _No response_  ### Version information  26.0.0  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > So sorry, I tagged the release late last night and forgot to push to CocoaPods because I was exhausted. I've just pushed it out 👍 

- **Issue #465** (2025-08-11): **Introspect scrollView on v26 not called consistently**
  *Symptoms*: ### Description  Let me know if a example project would be helpful:  ```             .introspect(.scrollView, on: .macOS(.v26), customize: { scrollView in                 // TODO: This seem to be called only sometimes, starting with v26             }) ```  on macOS Beta 26.0 (Beta 1)  ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Steps to reproduce  _No response_  ### Version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Fix incoming #468.
  > Fix is merged, will be available as part of 1.4.0-beta.3.
  > Sorry, still seeing the same issue (confirmed on macOS 26 Beta 3).  I promise I'll put a example project together this week. The scenario where this happening is very weird and difficult to extract, but i'll try.

- **Issue #456** (2025-09-16): **iOS 26 should be compatible**
  *Symptoms*: ### Description  Hello, can you release a version that is compatible with the previous system? This way, I don't have to update this library every time I update a new system.  ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Steps to reproduce  _No response_  ### Version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Working on it.
  > Wouldn't mind having an param for allowing all future updates as well, like `on: .iOS(.all)` or something similar
  > @liamcharger that is already possible: https://github.com/siteline/swiftui-introspect#introspect-on-future-platform-versions

- **Issue #452** (2025-05-12): **fullScreenCover has UISheetPresentationController?**
  *Symptoms*: ### Description  Sheet has UISheetPresentationController, but FullScreenCover doesn't have UISheetPresentationController.  Can FullScreenCover have UISheetPresentationController.  ```swift .introspect(.sheet, on: .iOS(.v18)) { (sheet: UISheetPresentationController) in   print(type(of: sheet)) } ```  ```swift .introspect(.fullScreenCover, on: .iOS(.v18)) { (sheet: UISheetPresentationController) in   print(type(of: sheet)) } ```  ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Steps to reproduce  _No response_  ### Version information  1.3.0  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > According to the documentation you can get UIPresentationController only. ```swift .introspect(.fullScreenCover, on: .iOS(.v14, .v15, .v16, .v17, .v18)) {     print(type(of: $0)) // UIPresentationController } ```
  > I want to custom UISheetPresentationController in fullScreenCover, if fullScreenCover has it. I don't know how to investigate fullScreenCover has it in SwiftUI(UIKit). 
  > You can try cast ``` .introspect(.fullScreenCover, on: .iOS(.v18)) { sheet in     if let controller = sheet as? UISheetPresentationController {         print(type(of: controller))     } else {         // fallback     } } ```

- **Issue #451** (2025-07-09): **Migrate old UIKIt Introspect from Cocoapods to Swift package manager**
  *Symptoms*: ### Description  Hi,   I am using UIKIt Introspect in my iOS project via cocoapods. I am trying migrate to Swift Package Manager (SPM).   I added SwiftUIIntrospect package via SPM, but SwiftUIIntrospect does not have old methods which was present in  old UIKIt 'Introspect'.   In my code I am using old UIKIt methods like `Introspect.findAncestor(ofType: UITableView.self, from: view)` and tried to `import Introspect` , but Introspect is not found.   Is old UIKit Introspect is unavailable? Is there any way I can use UIKit Introspect vis SPM?   ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  UIKit Introspect should be available as Swift Package, But only available in cocoa-pods.   ### Actual behavior  UIKit Introspect is not available as Swift package  ### Steps to reproduce  _No response_  ### Version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Unfortunately, there is no migration documentation.  Try to use `import SwiftUIIntrospect` and start with [examples](https://github.com/siteline/swiftui-introspect?tab=readme-ov-file#examples).  

- **Issue #448** (2026-03-17): **Symbol not found: _$s17SwiftUIIntrospect32NavigationViewWithStackStyleTypeV0G0O5stackyA2EmFWC**
  *Symptoms*: ### Description  Hello,  I am building an xcframework with a Pod dependency on swiftui-introspect. As soon as I add my xcframework to an iOS app and add Pod dependency on swiftui-introspect to the app itself, this crashes at runtime with the following error:  dyld[34810]: Symbol not found: _$s17SwiftUIIntrospect32NavigationViewWithStackStyleTypeV0G0O5stackyA2EmFWC  What's wrong with NavigationViewWithStackStyleType?  ### Checklist  - [x] I have read the [README](https://github.com/siteline/swiftui-introspect#swiftui-introspect) before submitting this report. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/siteline/swiftui-introspect/issues) or [discussion](https://github.com/siteline/swiftui-introspect/discussions).  ### Expected behavior  I expect the app to run without crashing  ### Actual behavior  App crashes at runtime with the following error:  dyld[34810]: Symbol not found: _$s17SwiftUIIntrospect32NavigationViewWithStackStyleTypeV0G0O5stackyA2EmFWC  ### Steps to reproduce  1. Create a Pod with swiftui-introspect as dependency (spec.dependency "SwiftUIIntrospect", "1.3.0") 2. Build an xcframework of that Pod 3. Include the xcframework in an iOS app and add Pod dependency of swiftui-introspect to the app itself 4. Run the app 5. Crash!  ### Version information  1.3.0  ### Destination operating system  iOS 18  ### Xcode version information  16.2 (16C5032a)  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > This may be related to #417 from the suspicious coincidence of `NavigationViewWithStackStyleType` causing the crash, AND XCFramework involvement. I'll look into this as soon as I have some free time.
  > Hello, any update on this issue?
  > Was never able to reproduce. If you're able to provide a reproducible project either as a zip or a GitHub repo I'll be happy to look into it.

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

### Incident Patch 1: `2fd59a7a` (2026-09-15)
**Commit Message**: revert(ci): stop running on release branch pushes

Revert commit 55be6f4c19c30edd79f72a12a584be58b01b7326.

**File**: `.github/workflows/ci.yml` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ on:
   push:
     branches:
       - main
-      - "release/**"
   pull_request:
     branches:
       - "**"
```

---

### Incident Patch 2: `79d97dbb` (2026-09-14)
**Commit Message**: fix(macos): mark unsupported controls unavailable on macOS 27

Mark menu picker, slider, default toggle, and checkbox toggle introspection unavailable for macOS 27 because their expected AppKit controls are absent.

Keep tests active on supported macOS versions and align the documentation and showcase with the supported version ranges.

**File**: `Examples/Showcase/Showcase/Controls.swift` (modified, +4/-4)
```diff
@@ -57,7 +57,7 @@ struct ControlsShowcase: View {
 						toggle.backgroundColor = .red
 					}
 					#elseif os(macOS)
-					.introspect(.toggle, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { toggle in
+					.introspect(.toggle, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { toggle in
 						toggle.layer?.backgroundColor = NSColor.red.cgColor
 					}
 					#endif
@@ -71,7 +71,7 @@ struct ControlsShowcase: View {
 						toggle.backgroundColor = .green
 					}
 					#elseif os(macOS)
-					.introspect(.toggle, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { toggle in
+					.introspect(.toggle, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { toggle in
 						toggle.layer?.backgroundColor = NSColor.green.cgColor
 					}
 					#endif
@@ -85,7 +85,7 @@ struct ControlsShowcase: View {
 						slider.backgroundColor = .red
 					}
 					#elseif os(macOS)
-					.introspect(.slider, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { slider in
+					.introspect(.slider, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { slider in
 						slider.layer?.backgroundColor = NSColor.red.cgColor
 					}
 					#endif
@@ -96,7 +96,7 @@ struct ControlsShowcase: View {
 						slider.backgroundColor = .green
 					}
 					#elseif os(macOS)
-					.introspect(.slider, on: .macOS(.v12, .v13, .v14, .v15, .v26, .v27)) { slider in
+					.introspect(.slider, on: .macOS(.v12, .v13, .v14, .v15, .v26)) { slider in
 						slider.layer?.backgroundColor = NSColor.green.cgColor
 					}
 					#endif
```

**File**: `Sources/ViewTypes/PickerWithMenuStyle.swift` (modified, +6/-3)
```diff
@@ -8,7 +8,9 @@
 ///
 /// Not available.
 ///
-/// ### macOS
+/// ### macOS 11 - 26
+///
+/// On macOS 27, pickers with menu style are not backed by `NSPopUpButton`, so introspection is not possible.
 ///
 /// ```swift
 /// struct ContentView: View {
@@ -21,7 +23,7 @@
 ///             Text("3").tag("3")
 ///         }
 ///         .pickerStyle(.menu)
-///         .introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26, .v27)) {
+///         .introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26)) {
 ///             print(type(of: $0)) // NSPopUpButton
 ///         }
 ///     }
@@ -54,7 +56,8 @@ extension macOSViewVersion<PickerWithMenuStyleType, NSPopUpButton> {
 	public static let v14 = Self(for: .v14)
 	public static let v15 = Self(for: .v15)
 	public static let v26 = Self(for: .v26)
-	public static let v27 = Self(for: .v27)
+	@available(*, unavailable, message: "Picker with menu style isn't backed by NSPopUpButton on macOS 27")
+	public static let v27 = Self.unavailable
 }
 #endif
 #endif
```

**File**: `Sources/ViewTypes/Slider.swift` (modified, +6/-3)
```diff
@@ -19,15 +19,17 @@
 ///
 /// Not available.
 ///
-/// ### macOS
+/// ### macOS 10.15 - 26
+///
+/// On macOS 27, sliders are not backed by `NSSlider`, so introspection is not possible.
 ///
 /// ```swift
 /// struct ContentView: View {
 ///     @State var selection = 0.5
 ///
 ///     var body: some View {
 ///         Slider(value: $selection, in: 0...1)
-///             .introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27)) {
+///             .introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26)) {
 ///                 print(type(of: $0)) // NSSlider
 ///             }
 ///     }
@@ -68,7 +70,8 @@ extension macOSViewVersion<SliderType, NSSlider> {
 	public static let v14 = Self(for: .v14)
 	public static let v15 = Self(for: .v15)
 	public static let v26 = Self(for: .v26)
-	public static let v27 = Self(for: .v27)
+	@available(*, unavailable, message: "Slider isn't backed by NSSlider on macOS 27")
+	public static let v27 = Self.unavailable
 }
 #endif
 #endif
```

**File**: `Sources/ViewTypes/Toggle.swift` (modified, +6/-3)
```diff
@@ -19,15 +19,17 @@
 ///
 /// Not available.
 ///
-/// ### macOS
+/// ### macOS 10.15 - 26
+///
+/// On macOS 27, toggles with the default style are not backed by `NSButton`, so introspection is not possible.
 ///
 /// ```swift
 /// struct ContentView: View {
 ///     @State var isOn = false
 ///
 ///     var body: some View {
 ///         Toggle("Toggle", isOn: $isOn)
-///             .introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27)) {
+///             .introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26)) {
 ///                 print(type(of: $0)) // NSButton
 ///             }
 ///     }
@@ -68,7 +70,8 @@ extension macOSViewVersion<ToggleType, NSButton> {
 	public static let v14 = Self(for: .v14)
 	public static let v15 = Self(for: .v15)
 	public static let v26 = Self(for: .v26)
-	public static let v27 = Self(for: .v27)
+	@available(*, unavailable, message: "Toggle with default style isn't backed by NSButton on macOS 27")
+	public static let v27 = Self.unavailable
 }
 #endif
 #endif
```

**File**: `Sources/ViewTypes/ToggleWithCheckboxStyle.swift` (modified, +6/-3)
```diff
@@ -8,7 +8,9 @@
 ///
 /// Not available.
 ///
-/// ### macOS
+/// ### macOS 10.15 - 26
+///
+/// On macOS 27, toggles with checkbox style are not backed by `NSButton`, so introspection is not possible.
 ///
 /// ```swift
 /// struct ContentView: View {
@@ -17,7 +19,7 @@
 ///     var body: some View {
 ///         Toggle("Checkbox", isOn: $isOn)
 ///             .toggleStyle(.checkbox)
-///             .introspect(.toggle(style: .checkbox), on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27)) {
+///             .introspect(.toggle(style: .checkbox), on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26)) {
 ///                 print(type(of: $0)) // NSButton
 ///             }
 ///     }
@@ -49,7 +51,8 @@ extension macOSViewVersion<ToggleWithCheckboxStyleType, NSButton> {
 	public static let v14 = Self(for: .v14)
 	public static let v15 = Self(for: .v15)
 	public static let v26 = Self(for: .v26)
-	public static let v27 = Self(for: .v27)
+	@available(*, unavailable, message: "Toggle with checkbox style isn't backed by NSButton on macOS 27")
+	public static let v27 = Self.unavailable
 }
 #endif
 #endif
```

**File**: `Tests/Tests/ViewTypes/PickerWithMenuStyleTests.swift` (modified, +4/-3)
```diff
@@ -7,6 +7,7 @@ import Testing
 struct PickerWithMenuStyleTests {
 	typealias PlatformPickerWithMenuStyle = NSPopUpButton
 
+	@available(macOS, introduced: 11, obsoleted: 27)
 	@Test func introspect() async throws {
 		let (
 			entity1,
@@ -18,15 +19,15 @@ struct PickerWithMenuStyleTests {
 					Text("1").tag("1")
 				}
 				.pickerStyle(.menu)
-				.introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy1)
+				.introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26), customize: spy1)
 				.cornerRadius(8)
 
 				Picker("Pick", selection: .constant("1")) {
 					Text("1").tag("1")
 					Text("2").tag("2")
 				}
 				.pickerStyle(.menu)
-				.introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy2)
+				.introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26), customize: spy2)
 				.cornerRadius(8)
 
 				Picker("Pick", selection: .constant("1")) {
@@ -35,7 +36,7 @@ struct PickerWithMenuStyleTests {
 					Text("3").tag("3")
 				}
 				.pickerStyle(.menu)
-				.introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy3)
+				.introspect(.picker(style: .menu), on: .macOS(.v11, .v12, .v13, .v14, .v15, .v26), customize: spy3)
 			}
 		}
 		#expect(entity1.numberOfItems == 1)
```

**File**: `Tests/Tests/ViewTypes/SliderTests.swift` (modified, +4/-3)
```diff
@@ -11,30 +11,31 @@ struct SliderTests {
 	typealias PlatformSlider = NSSlider
 	#endif
 
+	@available(macOS, introduced: 10.15, obsoleted: 27)
 	@Test func introspect() async throws {
 		let (entity1, entity2, entity3) = try await introspection(of: PlatformSlider.self) { spy1, spy2, spy3 in
 			VStack {
 				Slider(value: .constant(0.2), in: 0...1)
 					#if os(iOS)
 					.introspect(.slider, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26, .v27), customize: spy1)
 					#elseif os(macOS)
-					.introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy1)
+					.introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26), customize: spy1)
 					#endif
 					.cornerRadius(8)
 
 				Slider(value: .constant(0.5), in: 0...1)
 					#if os(iOS)
 					.introspect(.slider, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26, .v27), customize: spy2)
 					#elseif os(macOS)
-					.introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy2)
+					.introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26), customize: spy2)
 					#endif
 					.cornerRadius(8)
 
 				Slider(value: .constant(0.8), in: 0...1)
 					#if os(iOS)
 					.introspect(.slider, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26, .v27), customize: spy3)
 					#elseif os(macOS)
-					.introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy3)
+					.introspect(.slider, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26), customize: spy3)
 					#endif
 			}
 		}
```

**File**: `Tests/Tests/ViewTypes/ToggleTests.swift` (modified, +4/-3)
```diff
@@ -11,28 +11,29 @@ struct ToggleTests {
 	typealias PlatformToggle = NSButton
 	#endif
 
+	@available(macOS, introduced: 10.15, obsoleted: 27)
 	@Test func introspect() async throws {
 		let (entity1, entity2, entity3) = try await introspection(of: PlatformToggle.self) { spy1, spy2, spy3 in
 			VStack {
 				Toggle("", isOn: .constant(true))
 					#if os(iOS)
 					.introspect(.toggle, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26, .v27), customize: spy1)
 					#elseif os(macOS)
-					.introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy1)
+					.introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26), customize: spy1)
 					#endif
 
 				Toggle("", isOn: .constant(false))
 					#if os(iOS)
 					.introspect(.toggle, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26, .v27), customize: spy2)
 					#elseif os(macOS)
-					.introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy2)
+					.introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26), customize: spy2)
 					#endif
 
 				Toggle("", isOn: .constant(true))
 					#if os(iOS)
 					.introspect(.toggle, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26, .v27), customize: spy3)
 					#elseif os(macOS)
-					.introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26, .v27), customize: spy3)
+					.introspect(.toggle, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26), customize: spy3)
 					#endif
 			}
 		}
```

---

### Incident Patch 3: `0bad75f9` (2026-07-01)
**Commit Message**: CI: fix 26.2 runtime checks (#518)

**File**: `.github/workflows/ci.yml` (modified, +4/-2)
```diff
@@ -65,8 +65,10 @@ jobs:
           max_attempts: 3
           command: |
             RUNTIME="${{ matrix.runtime }}"
-            if ! xcodes runtimes 2>/dev/null | grep -qF "$RUNTIME (Installed)"; then
-              sudo xcodes runtimes install "$RUNTIME" --aria2 $(which aria2c)
+            if xcrun simctl list runtimes -j | jq -e --arg name "$RUNTIME" '.runtimes[] | select(.isAvailable) | select(.name == $name)' >/dev/null; then
+              echo "Runtime '$RUNTIME' is already installed."
+            else
+              sudo xcodes runtimes install "$RUNTIME" --aria2 "$(which aria2c)"
             fi
 
       - name: Create Simulator
```

---

### Incident Patch 4: `c3db5696` (2026-05-19)
**Commit Message**: CI: bump retry timeout to 15 minutes

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ jobs:
         if: matrix.runtime
         uses: nick-fields/retry@v3
         with:
-          timeout_minutes: 10
+          timeout_minutes: 15
           max_attempts: 3
           command: |
             RUNTIME="${{ matrix.runtime }}"
```

---

### Incident Patch 5: `b789ee16` (2026-04-07)
**Commit Message**: Gitignore .build/ at any depth

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 .DS_Store
-/.build
+.build/
 /.swiftpm
 /Packages
 /*.xcodeproj
```

---

### Incident Patch 6: `9731abed` (2026-04-07)
**Commit Message**: CI: update iPadOS to 26.2, fix NavigationSplitView test sidebar visibility (#513)

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ jobs:
           - { name: "iPadOS 16.4",      runtime: "iOS 16.4",       device: "iPad Pro (11-inch) (4th generation)" }
           - { name: "iPadOS 17.5",      runtime: "iOS 17.5",       device: "iPad Pro 11-inch (M4)" }
           - { name: "iPadOS 18.5",      runtime: "iOS 18.5",       device: "iPad Pro 11-inch (M4)",        runner: macos-15 }
-          - { name: "iPadOS 26.0",      runtime: "iOS 26.0",       device: "iPad Pro 11-inch (M4)" }
+          - { name: "iPadOS 26.2",      runtime: "iOS 26.2",       device: "iPad Pro 11-inch (M4)" }
           # macOS / macCatalyst
           - { name: "macCatalyst 15",  destination: "platform=macOS,variant=Mac Catalyst",  runner: macos-15 }
           - { name: "macCatalyst 26",  destination: "platform=macOS,variant=Mac Catalyst" }
```

**File**: `Examples/Showcase/Showcase/Navigation.swift` (modified, +0/-4)
```diff
@@ -23,11 +23,7 @@ struct NavigationShowcase: View {
 			.navigationView(style: .columns),
 			on: .iOS(.v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26)
 		) { splitViewController in
-			#if os(visionOS)
 			splitViewController.preferredDisplayMode = .oneBesideSecondary
-			#else
-			splitViewController.preferredDisplayMode = .oneOverSecondary
-			#endif
 		}
 		.introspect(.navigationView(style: .columns), on: .tvOS(.v15, .v16, .v17, .v18, .v26)) { navigationController in
 			navigationController.navigationBar.backgroundColor = .cyan
```

**File**: `Tests/Tests/ViewTypes/NavigationViewWithColumnsStyleTests.swift` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ struct NavigationViewWithColumnsStyleTests {
 			#if os(iOS)
 			// NB: this is necessary for ancestor introspection to work, because initially on iPad the "Customized" text isn't shown as it's hidden in the sidebar. This is why ancestor introspection is discouraged for most situations and it's opt-in.
 			.introspect(.navigationView(style: .columns), on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) {
-				$0.preferredDisplayMode = .oneOverSecondary
+				$0.preferredDisplayMode = .oneBesideSecondary
 			}
 			#endif
 		}
```

**File**: `Tests/Tests/ViewTypes/SearchFieldTests.swift` (modified, +4/-4)
```diff
@@ -75,7 +75,7 @@ struct SearchFieldTests {
 			#if os(iOS)
 			// NB: this is necessary for introspection to work, because on iPad the search field is in the sidebar, which is initially hidden.
 			.introspect(.navigationView(style: .columns), on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) {
-				$0.preferredDisplayMode = .oneOverSecondary
+				$0.preferredDisplayMode = .oneBesideSecondary
 			}
 			#endif
 		}
@@ -94,7 +94,7 @@ struct SearchFieldTests {
 				#if os(iOS)
 				// NB: this is necessary for introspection to work, because on iPad the search field is in the sidebar, which is initially hidden.
 				.introspect(.navigationView(style: .columns), on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) {
-					$0.preferredDisplayMode = .oneOverSecondary
+					$0.preferredDisplayMode = .oneBesideSecondary
 				}
 				#endif
 			}
@@ -114,7 +114,7 @@ struct SearchFieldTests {
 			#if os(iOS)
 			// NB: this is necessary for introspection to work, because on iPad the search field is in the sidebar, which is initially hidden.
 			.introspect(.navigationView(style: .columns), on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) {
-				$0.preferredDisplayMode = .oneOverSecondary
+				$0.preferredDisplayMode = .oneBesideSecondary
 			}
 			#endif
 		}
@@ -133,7 +133,7 @@ struct SearchFieldTests {
 				#if os(iOS)
 				// NB: this is necessary for introspection to work, because on iPad the search field is in the sidebar, which is initially hidden.
 				.introspect(.navigationView(style: .columns), on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) {
-					$0.preferredDisplayMode = .oneOverSecondary
+					$0.preferredDisplayMode = .oneBesideSecondary
 				}
 				#endif
 			}
```

---

### Incident Patch 7: `26986a57` (2026-03-17)
**Commit Message**: Fix memory leak in IntrospectionStore and dangling pointer in introspectionController (#512)

**File**: `Sources/IntrospectionView.swift` (modified, +3/-2)
```diff
@@ -132,6 +132,7 @@ struct IntrospectionView<Target: PlatformEntity>: PlatformViewControllerRepresen
 
 	static func dismantlePlatformViewController(_ controller: IntrospectionPlatformViewController, coordinator: Coordinator) {
 		controller.handler = nil
+		IntrospectionStore.shared.removeValue(forKey: controller.id)
 	}
 }
 
@@ -211,11 +212,11 @@ extension PlatformView {
 	fileprivate var introspectionController: IntrospectionPlatformViewController? {
 		get {
 			let key = unsafeBitCast(Selector(#function), to: UnsafeRawPointer.self)
-			return objc_getAssociatedObject(self, key) as? IntrospectionPlatformViewController
+			return (objc_getAssociatedObject(self, key) as? Weak<IntrospectionPlatformViewController>)?.wrappedValue
 		}
 		set {
 			let key = unsafeBitCast(Selector(#function), to: UnsafeRawPointer.self)
-			objc_setAssociatedObject(self, key, newValue, .OBJC_ASSOCIATION_ASSIGN)
+			objc_setAssociatedObject(self, key, Weak(wrappedValue: newValue), .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
 		}
 	}
 }
```

---

### Incident Patch 8: `c36fd4d3` (2025-09-24)
**Commit Message**: CI: fix macCatalyst Showcase and tests (#496)

**File**: `.github/workflows/ci.yml` (modified, +26/-19)
```diff
@@ -61,24 +61,24 @@ jobs:
           - [iPadOS, 18, 6]
           - [iPadOS, 26, 0]
 
+          - [macCatalyst, 15, 0]
+          - [macOS, 15, 0]
+
           - [tvOS, 15, 4]
           - [tvOS, 16, 4]
           - [tvOS, 17, 5]
           - [tvOS, 18, 5]
           - [tvOS, 26, 0]
 
+          - [visionOS, 1, 2]
+          - [visionOS, 2, 5]
+          - [visionOS, 26, 0]
+
           - [watchOS, 8, 5]
           - [watchOS, 9, 4]
           - [watchOS, 10, 5]
           - [watchOS, 11, 5]
           - [watchOS, 26, 0]
-
-          - [macOS, 15, 0]
-          # - [macOS, 26, 0]
-
-          - [visionOS, 1, 2]
-          - [visionOS, 2, 5]
-          - [visionOS, 26, 0]
     steps:
       - name: Git Checkout
         uses: actions/checkout@v5
@@ -97,13 +97,20 @@ jobs:
           else
             case "$PLATFORM" in
               iOS) SCRIPT_PLATFORM=ios ;;
+              macOS) SCRIPT_PLATFORM=macos ;;
+              macCatalyst) SCRIPT_PLATFORM=mac-catalyst ;;
               tvOS) SCRIPT_PLATFORM=tvos ;;
-              watchOS) SCRIPT_PLATFORM=watchos ;;
               visionOS) SCRIPT_PLATFORM=visionos ;;
-              macOS) SCRIPT_PLATFORM=macos ;;
+              watchOS) SCRIPT_PLATFORM=watchos ;;
             esac
           fi
 
+          if [ "$PLATFORM" = "macCatalyst" ]; then
+            XCB_PLATFORM="mac-catalyst"
+          else
+            XCB_PLATFORM="$PLATFORM"
+          fi
+
           RUNTIME="$PLATFORM $MAJOR.$MINOR"
 
           echo "PLATFORM=$PLATFORM" >> $GITHUB_ENV
@@ -112,7 +119,7 @@ jobs:
           echo "RUNTIME=$RUNTIME" >> $GITHUB_ENV
           echo "SCRIPT_PLATFORM=$SCRIPT_PLATFORM" >> $GITHUB_ENV
 
-      - if: ${{ env.PLATFORM != 'macOS' }}
+      - if: ${{ env.PLATFORM != 'macCatalyst' && env.PLATFORM != 'macOS' }}
         name: Check for ${{ env.RUNTIME }} runtime
         run: |
           if xcrun simctl list runtimes | grep -q "$RUNTIME"; then
@@ -140,7 +147,7 @@ jobs:
           max_attempts: 3
           command: sudo xcodes runtimes install "$RUNTIME"
 
-      - if: ${{ env.PLATFORM != 'macOS' }}
+      - if: ${{ env.PLATFORM != 'macCatalyst' && env.PLATFORM != 'macOS' }}
         name: Create Required Simulators
         run: |
           set -eo pipefail
@@ -162,7 +169,7 @@ jobs:
         uses: davdroman/xcodebuild@destination
         with:
           xcode: ~26.0
-          platform: ${{ env.PLATFORM }}
+          platform: ${{ env.XCB_PLATFORM }}
           platform-version: ~${{ env.MAJOR }}.${{ env.MINOR }}
           destination: ${{ env.SIM_UDID }}
           action: build
@@ -175,7 +182,7 @@ jobs:
         uses: davdroman/xcodebuild@destination
         with:
           xcode: ~26.0
-          platform: ${{ env.PLATFORM }}
+          platform: ${{ env.XCB_PLATFORM }}
           platform-version: ~${{ env.MAJOR }}.${{ env.MINOR }}
           destination: ${{ env.SIM_UDID }}
           action: build
@@ -188,7 +195,7 @@ jobs:
         uses: davdroman/xcodebuild@destination
         with:
           xcode: ~26.0
-          platform: ${{ env.PLATFORM }}
+          platform: ${{ env.XCB_PLATFORM }}
           platform-version: ~${{ env.MAJOR }}.${{ env.MINOR }}
           destination: ${{ env.SIM_UDID }}
           action: test
@@ -203,20 +210,20 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        platform: [iOS, macOS, tvOS, watchOS, visionOS, macCatalyst]
+        platform: [iOS, macCatalyst, macOS, tvOS, visionOS, watchOS]
         include:
           - platform: iOS
             destination: "generic/platform=iOS"
+          - platform: macCatalyst
+            destination: "platform=macOS,variant=Mac Catalyst"
           - platform: macOS
             destination: "generic/platform=macOS"
           - platform: tvOS
             destination: "generic/platform=tvOS"
-          - platform: watchOS
-            destination: "generic/platform=watchOS"
           - platform: visionOS
             destination: "generic/platform=visionOS"
-          - platform: macCatalyst
-            destination: "platform=macOS,variant=Mac Catalyst"
+          - platform: watchOS
+            destination: "generic/platform=watchOS"
     steps:
       - name: Git Checkout
         uses: actions/checkout@v5
```

**File**: `Examples/Showcase/Showcase/Controls.swift` (modified, +2/-0)
```diff
@@ -74,6 +74,7 @@ struct ControlsShowcase: View {
 					#endif
 			}
 
+			#if !targetEnvironment(macCatalyst)
 			HStack {
 				Slider(value: $sliderValue, in: 0...100)
 					#if os(iOS)
@@ -97,6 +98,7 @@ struct ControlsShowcase: View {
 					}
 					#endif
 			}
+			#endif
 
 			HStack {
 				Stepper(onIncrement: {}, onDecrement: {}) {
```

**File**: `SwiftUIIntrospect.xcworkspace/xcshareddata/xcschemes/SwiftUIIntrospect.xcscheme` (modified, +5/-5)
```diff
@@ -1,10 +1,11 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
    LastUpgradeVersion = "2600"
-   version = "1.3">
+   version = "1.7">
    <BuildAction
       parallelizeBuildables = "YES"
-      buildImplicitDependencies = "YES">
+      buildImplicitDependencies = "YES"
+      buildArchitectures = "Automatic">
       <BuildActionEntries>
          <BuildActionEntry
             buildForTesting = "YES"
@@ -26,9 +27,8 @@
       buildConfiguration = "Debug"
       selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
       selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      shouldUseLaunchSchemeArgsEnv = "YES">
-      <Testables>
-      </Testables>
+      shouldUseLaunchSchemeArgsEnv = "YES"
+      shouldAutocreateTestPlan = "YES">
    </TestAction>
    <LaunchAction
       buildConfiguration = "Debug"
```

**File**: `Tests/Package.swift` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-// swift-tools-version:5.5
-
-import PackageDescription
-
-let package = Package(
-    name: "Tests",
-    products: [],
-    targets: []
-)
```

**File**: `Tests/TestFramework/TestFramework.swift` (modified, +12/-8)
```diff
@@ -1,9 +1,13 @@
-//
-//  TestFramework.swift
-//  TestFramework
-//
-//  Created by David Roman on 30/07/2025.
-//
-
-import Foundation
+internal import SwiftUI
+internal import SwiftUIIntrospect
 
+struct TestView: View {
+	var body: some View {
+		Text("Hello, World!")
+			#if os(iOS) || os(tvOS) || os(visionOS)
+			.introspect(.view, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26), .tvOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26), customize: { _ in })
+			#elseif os(macOS)
+			.introspect(.view, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26), customize: { _ in })
+			#endif
+	}
+}
```

**File**: `Tests/Tests.xcodeproj/project.pbxproj` (modified, +247/-493)
```diff
@@ -3,273 +3,100 @@
 	archiveVersion = 1;
 	classes = {
 	};
-	objectVersion = 70;
+	objectVersion = 77;
 	objects = {
 
 /* Begin PBXBuildFile section */
-		D503B2AC2A49BFE300027F5F /* VideoPlayerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D503B2AB2A49BFE300027F5F /* VideoPlayerTests.swift */; };
-		D50556532E3A6F5A00312263 /* SwiftUIIntrospect in Frameworks */ = {isa = PBXBuildFile; productRef = D50556522E3A6F5A00312263 /* SwiftUIIntrospect */; };
-		D50FFE8E2A17E2A400C32641 /* ScrollViewTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D50FFE8D2A17E2A400C32641 /* ScrollViewTests.swift */; };
-		D534D4DC2A4A596200218BFB /* WindowTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D534D4DB2A4A596200218BFB /* WindowTests.swift */; };
-		D55BAD142DFF2B050038443E /* WebViewTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D55BAD132DFF2B050038443E /* WebViewTests.swift */; };
-		D55F448D2A1FF209003381E4 /* ListTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D55F448C2A1FF209003381E4 /* ListTests.swift */; };
-		D57506782A27BBBD00A628E4 /* PickerWithSegmentedStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506772A27BBBD00A628E4 /* PickerWithSegmentedStyleTests.swift */; };
-		D575067A2A27BF6C00A628E4 /* PickerWithMenuStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506792A27BF6C00A628E4 /* PickerWithMenuStyleTests.swift */; };
-		D575067C2A27C24600A628E4 /* ListWithPlainStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575067B2A27C24600A628E4 /* ListWithPlainStyleTests.swift */; };
-		D575067E2A27C43400A628E4 /* ListWithGroupedStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575067D2A27C43400A628E4 /* ListWithGroupedStyleTests.swift */; };
-		D57506802A27C55600A628E4 /* ListWithInsetStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575067F2A27C55600A628E4 /* ListWithInsetStyleTests.swift */; };
-		D57506822A27C74600A628E4 /* ListWithInsetGroupedStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506812A27C74600A628E4 /* ListWithInsetGroupedStyleTests.swift */; };
-		D57506842A27C8D400A628E4 /* ListWithSidebarStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506832A27C8D400A628E4 /* ListWithSidebarStyleTests.swift */; };
-		D57506862A27CA4100A628E4 /* ListWithBorderedStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506852A27CA4100A628E4 /* ListWithBorderedStyleTests.swift */; };
-		D57506882A27CB9800A628E4 /* FormTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506872A27CB9800A628E4 /* FormTests.swift */; };
-		D575068A2A27CE7900A628E4 /* FormWithGroupedStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506892A27CE7900A628E4 /* FormWithGroupedStyleTests.swift */; };
-		D575068C2A27D40500A628E4 /* ToggleWithSwitchStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575068B2A27D40500A628E4 /* ToggleWithSwitchStyleTests.swift */; };
-		D575068E2A27D4DC00A628E4 /* ToggleWithButtonStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575068D2A27D4DC00A628E4 /* ToggleWithButtonStyleTests.swift */; };
-		D57506902A27D69600A628E4 /* ToggleWithCheckboxStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575068F2A27D69600A628E4 /* ToggleWithCheckboxStyleTests.swift */; };
-		D57506922A27EE4700A628E4 /* DatePickerWithWheelStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506912A27EE4700A628E4 /* DatePickerWithWheelStyleTests.swift */; };
-		D57506942A27EED200A628E4 /* DatePickerWithStepperFieldStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506932A27EED200A628E4 /* DatePickerWithStepperFieldStyleTests.swift */; };
-		D57506962A27F0E200A628E4 /* DatePickerWithCompactFieldStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506952A27F0E200A628E4 /* DatePickerWithCompactFieldStyleTests.swift */; };
-		D57506982A27F32800A628E4 /* DatePickerWithGraphicalStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506972A27F32800A628E4 /* DatePickerWithGraphicalStyleTests.swift */; };
-		D575069A2A27F48D00A628E4 /* DatePickerWithFieldStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506992A27F48D00A628E4 /* DatePickerWithFieldStyleTests.swift */; };
-		D575069C2A27F68700A628E4 /* ProgressViewWithCircularStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575069B2A27F68700A628E4 /* ProgressViewWithCircularStyleTests.swift */; };
-		D575069E2A27F80E00A628E4 /* ProgressViewWithLinearStyleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575069D2A27F80E00A628E4 /* ProgressViewWithLinearStyleTests.swift */; };
-		D57506A02A27FC0400A628E4 /* TableTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D575069F2A27FC0400A628E4 /* TableTests.swift */; };
-		D57506A22A281B9C00A628E4 /* SearchFieldTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57506A12A281B9C00A628E4 /* SearchFieldTests.
```

**File**: `Tests/Tests.xcodeproj/project.xcworkspace/contents.xcworkspacedata` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-<?xml version="1.0" encoding="UTF-8"?>
-<Workspace
-   version = "1.0">
-   <FileRef
-      location = "self:">
-   </FileRef>
-</Workspace>
```

**File**: `Tests/Tests.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-<?xml version="1.0" encoding="UTF-8"?>
-<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
-<plist version="1.0">
-<dict>
-	<key>IDEDidComputeMac32BitWarning</key>
-	<true/>
-</dict>
-</plist>
```

---

### Incident Patch 9: `be44e32b` (2025-09-23)
**Commit Message**: CI: use mxcl/xcodebuild instead of fastlane (#492)

**File**: `.github/workflows/ci.yml` (modified, +112/-112)
```diff
@@ -43,158 +43,158 @@ jobs:
 
   ci:
     if: github.event_name != 'pull_request' || !contains(github.event.pull_request.title, '[skip ci]')
-    name: ${{ matrix.platform[0] }} ${{ matrix.platform[1] }}
-    runs-on: ${{ matrix.os }}
+    name: ${{ matrix.runtime[0] }} ${{ matrix.runtime[1] }}
+    runs-on: macos-15
     strategy:
       fail-fast: false
       matrix:
-        include:
-          - platform: [iOS, 15]
-            runtime: iOS 15.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [iOS, 16]
-            runtime: iOS 16.4
-            os: macos-15
-            xcode: 26.0
-          - platform: [iOS, 17]
-            runtime: iOS 17.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [iOS, 18]
-            runtime: iOS 18.6
-            os: macos-15
-            xcode: 26.0
-          - platform: [iOS, 26]
-            runtime: iOS 26.0
-            os: macos-15
-            xcode: 26.0
-
-          - platform: [tvOS, 15]
-            runtime: tvOS 15.4
-            os: macos-15
-            xcode: 26.0
-          - platform: [tvOS, 16]
-            runtime: tvOS 16.4
-            os: macos-15
-            xcode: 26.0
-          - platform: [tvOS, 17]
-            runtime: tvOS 17.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [tvOS, 18]
-            runtime: tvOS 18.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [tvOS, 26]
-            runtime: tvOS 26.0
-            os: macos-15
-            xcode: 26.0
-
-          - platform: [watchOS, 8]
-            runtime: watchOS 8.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [watchOS, 9]
-            runtime: watchOS 9.4
-            os: macos-15
-            xcode: 26.0
-          - platform: [watchOS, 10]
-            runtime: watchOS 10.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [watchOS, 11]
-            runtime: watchOS 11.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [watchOS, 26]
-            runtime: watchOS 26.0
-            os: macos-15
-            xcode: 26.0
-
-          - platform: [macOS, 15]
-            runtime: macOS 15
-            os: macos-15
-            xcode: 26.0
-          # - platform: [macOS, 26]
-          #   runtime: macOS 26.0
-          #   os: macos-26
-          #   xcode: 26.0
-
-          - platform: [visionOS, 1]
-            runtime: visionOS 1.2
-            os: macos-15
-            xcode: 26.0
-          - platform: [visionOS, 2]
-            runtime: visionOS 2.5
-            os: macos-15
-            xcode: 26.0
-          - platform: [visionOS, 26]
-            runtime: visionOS 26.0
-            os: macos-15
-            xcode: 26.0
+        runtime:
+          - [iOS, 15, 5]
+          - [iOS, 16, 4]
+          - [iOS, 17, 5]
+          - [iOS, 18, 6]
+          - [iOS, 26, 0]
+
+          - [iPadOS, 15, 5]
+          - [iPadOS, 16, 4]
+          - [iPadOS, 17, 5]
+          - [iPadOS, 18, 6]
+          - [iPadOS, 26, 0]
+
+          - [tvOS, 15, 4]
+          - [tvOS, 16, 4]
+          - [tvOS, 17, 5]
+          - [tvOS, 18, 5]
+          - [tvOS, 26, 0]
+
+          - [watchOS, 8, 5]
+          - [watchOS, 9, 4]
+          - [watchOS, 10, 5]
+          - [watchOS, 11, 5]
+          - [watchOS, 26, 0]
+
+          - [macOS, 15, 0]
+          # - [macOS, 26, 0]
+
+          - [visionOS, 1, 2]
+          - [visionOS, 2, 5]
+          - [visionOS, 26, 0]
     steps:
       - name: Git Checkout
-        uses: actions/checkout@v4
+        uses: actions/checkout@v5
+
+      - name: Set Environment Variables
+        run: |
+          set -euo pipefail
+
+          PLATFORM="${{ matrix.runtime[0] }}"
+          MAJOR="${{ matrix.runtime[1] }}"
+          MINOR="${{ matrix.runtime[2] }}"
+
+          if [ "$PLATFORM" = "iPadOS" ]; then
+            PLATFORM=iOS
+            FASTLANE_PLATFORM=ipados
+          else
+            case "$PLATFORM" in
+              iOS) FASTLANE_PLATFORM=ios ;;
+              tvOS) FASTLANE_PLATFORM=tvos ;;
+              watchOS) FASTLANE_PLATFORM=watchos ;;
+              visionOS) FASTLANE_PLATFORM=visionos ;;
+              macOS) FASTLANE_PLATFORM=macos ;;
+            esac
+          fi
 
-      - name: Set environment variables
-        run: echo "SKIP_SLOW_FASTLANE_WARNING=1" >> $GITHUB_ENV
+          RUNTIME="$PLATFORM $MAJOR.$MINOR"
 
-      - if: ${{ matrix.platform[0] != 'macOS' }}
-        name: Check for ${{ matrix.runtime }} runtime
+          echo "PLATFORM=$PLATFORM" >> $GITHUB_ENV
+          echo "MAJOR=$MAJOR" >> $GITHUB_ENV
+          echo "MINOR=$MINOR" >> $GITHUB_ENV
+          echo "RUNTIME=$RUNTIME" >> $GITHUB_ENV
+          echo "FASTLANE_PLATFORM=$FASTLANE_PLATFORM" >> $GITHUB_ENV
+
+      - if: ${{ env.PLATFORM != 'macOS' }}
+        name: Check for ${{ env.RUNTIME }} runtime
         run: |
-          if xcrun simctl list runtimes | grep -q "${{ matrix.r
```

**File**: `fastlane/Fastfile` (modified, +28/-100)
```diff
@@ -2,45 +2,48 @@ skip_docs
 
 devices = {
 	"ios" => {
-		15 => ["iPhone 13 Pro (15.5)", "iPad Pro (11-inch) (3rd generation) (15.5)",],
-		16 => ["iPhone 14 Pro (16.4)", "iPad Pro (11-inch) (4th generation) (16.4)"],
-		17 => ["iPhone 15 Pro (17.5)", "iPad Pro 11-inch (M4) (17.5)"],
-		18 => ["iPhone 16 Pro (18.6)", "iPad Pro 11-inch (M4) (18.6)"],
-		26 => ["iPhone 17 Pro (26.0)", "iPad Pro 11-inch (M4) (26.0)"],
+		15 => "iPhone 13 Pro (15.5)",
+		16 => "iPhone 14 Pro (16.4)",
+		17 => "iPhone 15 Pro (17.5)",
+		18 => "iPhone 16 Pro (18.6)",
+		26 => "iPhone 17 Pro (26.0)",
+	},
+	"ipados" => {
+		15 => "iPad Pro (11-inch) (3rd generation) (15.5)",
+		16 => "iPad Pro (11-inch) (4th generation) (16.4)",
+		17 => "iPad Pro 11-inch (M4) (17.5)",
+		18 => "iPad Pro 11-inch (M4) (18.6)",
+		26 => "iPad Pro 11-inch (M4) (26.0)",
 	},
 	"tvos" => {
-		15 => ["Apple TV (15.4)"],
-		16 => ["Apple TV (16.4)"],
-		17 => ["Apple TV (17.5)"],
-		18 => ["Apple TV (18.5)"],
-		26 => ["Apple TV (26.0)"],
+		15 => "Apple TV (15.4)",
+		16 => "Apple TV (16.4)",
+		17 => "Apple TV (17.5)",
+		18 => "Apple TV (18.5)",
+		26 => "Apple TV (26.0)",
 	},
 	"watchos" => {
-		8 => ["Apple Watch Series 7 (45mm) (8.5)"],
-		9 => ["Apple Watch Series 8 (45mm) (9.4)"],
-		10 => ["Apple Watch Series 9 (45mm) (10.5)"],
-		11 => ["Apple Watch Series 10 (42mm) (11.5)"],
-		26 => ["Apple Watch Series 11 (42mm) (26.0)"],
+		8 => "Apple Watch Series 7 (45mm) (8.5)",
+		9 => "Apple Watch Series 8 (45mm) (9.4)",
+		10 => "Apple Watch Series 9 (45mm) (10.5)",
+		11 => "Apple Watch Series 10 (42mm) (11.5)",
+		26 => "Apple Watch Series 11 (42mm) (26.0)",
 	},
 	"visionos" => {
-		1 => ["Apple Vision Pro (at 2732x2048) (1.2)"],
-		2 => ["Apple Vision Pro (at 2732x2048) (2.5)"],
-		26 => ["Apple Vision Pro (26.0)"],
+		1 => "Apple Vision Pro (at 2732x2048) (1.2)",
+		2 => "Apple Vision Pro (at 2732x2048) (2.5)",
+		26 => "Apple Vision Pro (26.0)",
 	},
 }
 
-before_all do |lane, options|
-	next if lane == :create_simulators
-	create_simulators(platform: options[:platform], version: options[:version])
-end
-
 lane :create_simulators do |options|
 	require 'json'
 	require 'set'
 
 	# map Fastfile platform keys to display names used by CoreSimulator runtimes
 	platforms_to_os = {
 		"ios" => "iOS",
+		"ipados" => "iOS",
 		"tvos" => "tvOS",
 		"watchos" => "watchOS",
 		"visionos" => "visionOS",
@@ -110,11 +113,8 @@ lane :create_simulators do |options|
 		os_name = platforms_to_os[platform]
 		next if os_name.nil?
 
-		versions.values.flatten.each do |descriptor|
-			# descriptor examples:
-			#   "iPhone 14 Pro (16.4)"
-			#   "iPad Pro (11-inch) (4th generation) (16.4)"
-			#   "Apple Vision Pro (2.5)"
+		versions.values.each do |descriptor|
+			# descriptor is a single string like "iPhone 14 Pro (16.4)" or "iPad Pro 11-inch (M4) (18.6)"
 			begin
 				# Parse trailing "(x.y)" and derive device name
 				if descriptor =~ /\s*\(([^()]+)\)\s*\z/
@@ -147,75 +147,3 @@ lane :create_simulators do |options|
 		end
 	end
 end
-
-lane :build do |options|
-	platform = options[:platform].to_s.downcase
-	version = options[:version].to_i
-	scheme = options[:scheme].to_s
-
-	unless scheme == "Showcase" || scheme == "SwiftUIIntrospect"
-		raise "Unsupported scheme: #{scheme}"
-		next
-	end
-
-	if platform == "macos"
-		for destination in ["platform=macOS", "platform=macOS,variant=Mac Catalyst"]
-			build_app(
-				scheme: scheme,
-				destination: destination,
-				skip_archive: true,
-				skip_codesigning: true,
-				skip_package_ipa: true,
-				skip_profile_detection: true,
-			)
-		end
-	else
-		run_tests(
-			configuration: "Debug",
-			build_for_testing: true,
-			scheme: scheme,
-			devices: devices[platform][version],
-			prelaunch_simulator: false,
-			ensure_devices_found: true,
-			force_quit_simulator: true,
-			disable_concurrent_testing: true,
-		)
-	end
-end
-
-lane :test do |options|
-	configuration = (options[:configuration] || "Debug").to_s
-	platform = options[:platform].to_s.downcase
-	version = options[:version].to_i
-	scheme = options[:scheme].to_s
-
-	if platform == "macos"
-		run_tests(
-			configuration: configuration,
-			scheme: scheme,
-			destination: "platform=macOS",
-			catalyst_platform: "macos",
-			disable_slide_to_type: false,
-			prelaunch_simulator: false,
-			ensure_devices_found: true,
-			force_quit_simulator: false,
-			disable_concurrent_testing: true,
-		)
-	else
-		unless ["SwiftUIIntrospectTests"].include?(scheme)
-			raise "Unsupported scheme: #{scheme}"
-		end
-		run_tests(
-			configuration: configuration,
-			scheme: scheme,
-			devices: devices[platform][version],
-			prelaunch_simulator: false,
-			ensure_devices_found: true,
-			force_quit_simulator: true,
-			reset_simulator: false,
-			disable_concurrent_testing: true,
-			result_bundle: true,
-			output_directory: Dir.pwd + "/test_output",
-		)
-	end
-end
```

---

### Incident Patch 10: `83c10a05` (2025-09-13)
**Commit Message**: CI: fix `create_simulators` dedup logic (#483)

**File**: `fastlane/Fastfile` (modified, +17/-9)
```diff
@@ -2,7 +2,7 @@ skip_docs
 
 devices = {
     "ios" => {
-        15 => ["iPhone SE (3rd generation) (15.5)", "iPad Air (5th generation) (15.5)",],
+        15 => ["iPhone 13 Pro (15.5)", "iPad Pro (11-inch) (3rd generation) (15.5)",],
         16 => ["iPhone 14 Pro (16.4)", "iPad Pro (11-inch) (4th generation) (16.4)"],
         17 => ["iPhone 15 Pro (17.5)", "iPad Pro 11-inch (M4) (17.5)"],
         18 => ["iPhone 16 Pro (18.6)", "iPad Pro 11-inch (M4) (18.6)"],
@@ -48,20 +48,27 @@ lane :create_simulators do |options|
 
     # Build lookup tables from CoreSimulator for robust name→identifier mapping
     begin
+        # Build a set of existing simulator name+runtime pairs to prevent duplicates across OS versions
+        devices_json = sh("xcrun simctl list -j devices", log: false)
+        devices_list = JSON.parse(devices_json)
+        existing_pairs = Set.new
+        (devices_list["devices"] || {}).each do |runtime_key, arr|
+            Array(arr).each do |d|
+                name = d["name"]
+                next unless name && runtime_key
+                existing_pairs.add("#{name}||#{runtime_key}")
+            end
+        end
+
         list_json = sh("xcrun simctl list -j", log: false)
         list = JSON.parse(list_json)
         devtypes = list["devicetypes"] || []
         runtimes = list["runtimes"] || []
-
-        # Build a set of existing simulator names to prevent duplicates
-        devices_json = sh("xcrun simctl list -j devices", log: false)
-        devices_list = JSON.parse(devices_json)
-        existing_names = (devices_list["devices"] || {}).values.flatten.map { |d| d["name"] }.compact.to_set
     rescue => e
         UI.message("Failed to read simctl lists: #{e}")
         devtypes = []
         runtimes = []
-        existing_names = Set.new
+        existing_pairs = Set.new
     end
 
     device_name_to_id = devtypes.each_with_object({}) do |dt, h|
@@ -126,13 +133,14 @@ lane :create_simulators do |options|
                 # Use the device name without the version suffix as the simulator name
                 sim_name = device_name
 
-                if existing_names.include?(sim_name)
+                pair_key = "#{sim_name}||#{runtime_id}"
+                if existing_pairs.include?(pair_key)
                     UI.message("Already exists: #{sim_name} (#{runtime_version}), skipping")
                     next
                 end
 
                 sh(%(xcrun simctl create "#{sim_name}" "#{device_type_id}" "#{runtime_id}" || true))
-                existing_names.add(sim_name)
+                existing_pairs.add(pair_key)
             rescue => e
                 UI.message("Skipping #{descriptor}: #{e}")
             end
```

---

### Incident Patch 11: `aa15494b` (2025-09-12)
**Commit Message**: CI: ensure required simulators exist (#482)

**File**: `.github/workflows/ci.yml` (modified, +8/-1)
```diff
@@ -170,7 +170,14 @@ jobs:
           max_attempts: 3
           command: sudo xcodes runtimes install '${{ matrix.runtime }}'
 
-      - name: "List Available Runtimes, Simulators, and Destinations"
+      - if: ${{ matrix.platform[0] != 'macOS' }}
+        name: Create Required Simulators
+        run: |
+          set -eo pipefail
+          xcrun simctl delete all
+          fastlane create_simulators platform:${{ matrix.platform[0] }} version:${{ matrix.platform[1] }}
+
+      - name: List Available Runtimes, Simulators, and Destinations
         run: |
           xcrun simctl list
           xcodebuild -scheme "SwiftUIIntrospect" -showdestinations
```

**File**: `Examples/Showcase/Showcase.xcodeproj/project.pbxproj` (modified, +2/-0)
```diff
@@ -239,6 +239,7 @@
 				SWIFT_STRICT_CONCURRENCY = complete;
 				SWIFT_VERSION = 6.0;
 				TVOS_DEPLOYMENT_TARGET = 15.0;
+				WATCHOS_DEPLOYMENT_TARGET = 8.0;
 				XROS_DEPLOYMENT_TARGET = 1.0;
 			};
 			name = Debug;
@@ -304,6 +305,7 @@
 				SWIFT_VERSION = 6.0;
 				TVOS_DEPLOYMENT_TARGET = 15.0;
 				VALIDATE_PRODUCT = YES;
+				WATCHOS_DEPLOYMENT_TARGET = 8.0;
 				XROS_DEPLOYMENT_TARGET = 1.0;
 			};
 			name = Release;
```

**File**: `Sources/ViewTypes/View.swift` (modified, +8/-0)
```diff
@@ -60,6 +60,14 @@
 /// ```
 public struct ViewType: IntrospectableViewType {}
 
+// TODO: I think if Swift ever gets parameterized extensions we could introduce subtypes like:
+//
+// public struct ViewType<PlatformViewType: PlatformView>: IntrospectableViewType {}
+//
+// extension <V: PlatformView> IntrospectableViewType where Self == ViewType<V> {
+//     public static func view<V>(ofType: V.Type) -> Self { ... }
+// }
+
 extension IntrospectableViewType where Self == ViewType {
     public static var view: Self { .init() }
 }
```

**File**: `fastlane/Fastfile` (modified, +112/-1)
```diff
@@ -24,11 +24,122 @@ devices = {
     },
     "visionos" => {
         1 => ["Apple Vision Pro (at 2732x2048) (1.2)"],
-        2 => ["Apple Vision Pro (2.5)"],
+        2 => ["Apple Vision Pro (at 2732x2048) (2.5)"],
         26 => ["Apple Vision Pro (26.0)"],
     },
 }
 
+before_all do |lane, options|
+    next if lane == :create_simulators
+    create_simulators(platform: options[:platform], version: options[:version])
+end
+
+lane :create_simulators do |options|
+    require 'json'
+    require 'set'
+
+    # map Fastfile platform keys to display names used by CoreSimulator runtimes
+    platforms_to_os = {
+        "ios" => "iOS",
+        "tvos" => "tvOS",
+        "watchos" => "watchOS",
+        "visionos" => "visionOS",
+    }
+
+    # Build lookup tables from CoreSimulator for robust name→identifier mapping
+    begin
+        list_json = sh("xcrun simctl list -j", log: false)
+        list = JSON.parse(list_json)
+        devtypes = list["devicetypes"] || []
+        runtimes = list["runtimes"] || []
+
+        # Build a set of existing simulator names to prevent duplicates
+        devices_json = sh("xcrun simctl list -j devices", log: false)
+        devices_list = JSON.parse(devices_json)
+        existing_names = (devices_list["devices"] || {}).values.flatten.map { |d| d["name"] }.compact.to_set
+    rescue => e
+        UI.message("Failed to read simctl lists: #{e}")
+        devtypes = []
+        runtimes = []
+        existing_names = Set.new
+    end
+
+    device_name_to_id = devtypes.each_with_object({}) do |dt, h|
+        name = dt["name"]; id = dt["identifier"]
+        h[name] = id if name && id
+    end
+
+    runtime_name_to_id = runtimes.each_with_object({}) do |rt, h|
+        next unless rt["isAvailable"]
+        name = rt["name"]; id = rt["identifier"]
+        h[name] = id if name && id
+    end
+
+    # Fallback builders when exact matches are not present in the lookup tables
+    build_device_type_id = proc do |device_name|
+        s = device_name.gsub(/[()]/, '').gsub(/\s+/, '-').gsub(/[^A-Za-z0-9-]/, '')
+        "com.apple.CoreSimulator.SimDeviceType.#{s}"
+    end
+
+    build_runtime_id = proc do |os_name, version|
+        "com.apple.CoreSimulator.SimRuntime.#{os_name}-#{version.tr('.', '-')}"
+    end
+
+    platform_opt = options && options[:platform] ? options[:platform].to_s.downcase : nil
+    version_opt  = options && options[:version] ? options[:version].to_i : nil
+
+    local_devices = if platform_opt && devices.key?(platform_opt)
+        subset_versions = devices[platform_opt]
+        if version_opt && subset_versions.key?(version_opt)
+            { platform_opt => { version_opt => subset_versions[version_opt] } }
+        else
+            { platform_opt => subset_versions }
+        end
+    else
+        devices
+    end
+
+    local_devices.each do |platform, versions|
+        os_name = platforms_to_os[platform]
+        next if os_name.nil?
+
+        versions.values.flatten.each do |descriptor|
+            # descriptor examples:
+            #   "iPhone 14 Pro (16.4)"
+            #   "iPad Pro (11-inch) (4th generation) (16.4)"
+            #   "Apple Vision Pro (2.5)"
+            begin
+                # Parse trailing "(x.y)" and derive device name
+                if descriptor =~ /\s*\(([^()]+)\)\s*\z/
+                    runtime_version = $1
+                    device_name = descriptor.sub(/\s*\([^()]+\)\s*\z/, '')
+                else
+                    UI.message("Could not parse runtime version from '#{descriptor}', skipping")
+                    next
+                end
+
+                runtime_name = "#{os_name} #{runtime_version}"
+
+                device_type_id = device_name_to_id[device_name] || build_device_type_id.call(device_name)
+                runtime_id = runtime_name_to_id[runtime_name] || build_runtime_id.call(os_name, runtime_version)
+
+                # Use the device name without the version suffix as the simulator name
+                sim_name = device_name
+
+                if existing_names.include?(sim_name)
+                    UI.message("Already exists: #{sim_name} (#{runtime_version}), skipping")
+                    next
+                end
+
+                sh(%(xcrun simctl create "#{sim_name}" "#{device_type_id}" "#{runtime_id}" || true))
+                existing_names.add(sim_name)
+            rescue => e
+                UI.message("Skipping #{descriptor}: #{e}")
+            end
+        end
+    end
+end
+
 lane :build do |options|
     platform = options[:platform].to_s.downcase
     version = options[:version].to_i
```

---

### Incident Patch 12: `e7568326` (2025-09-11)
**Commit Message**: Fix macOS Showcase (#480)

**File**: `Examples/Showcase/Showcase/AppView.swift` (modified, +6/-0)
```diff
@@ -26,18 +26,24 @@ struct ContentView: View {
         TabView(selection: $selection) {
             ListShowcase()
                 .tabItem { Label("List", systemImage: "1.circle") }
+                .tag(0)
             ScrollViewShowcase()
                 .tabItem { Label("ScrollView", systemImage: "2.circle") }
+                .tag(1)
             #if !os(macOS)
             NavigationShowcase()
                 .tabItem { Label("Navigation", systemImage: "3.circle") }
+                .tag(2)
             PresentationShowcase()
                 .tabItem { Label("Presentation", systemImage: "4.circle") }
+                .tag(3)
             #endif
             ControlsShowcase()
                 .tabItem { Label("Controls", systemImage: "5.circle") }
+                .tag(4)
             UIViewRepresentableShowcase()
                 .tabItem { Label("UIViewRepresentable", systemImage: "6.circle") }
+                .tag(5)
         }
         #if os(iOS) || os(tvOS)
         .introspect(.tabView, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26), .tvOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) { tabBarController in
```

**File**: `Examples/Showcase/Showcase/UIViewRepresentable.swift` (modified, +17/-13)
```diff
@@ -2,21 +2,25 @@ import SwiftUI
 @_spi(Internals) import SwiftUIIntrospect
 
 struct UIViewRepresentableShowcase: View {
+    let colors: [Color] = [.red, .green, .blue]
+
     var body: some View {
         VStack(spacing: 10) {
-            GenericViewRepresentable()
-                #if os(iOS) || os(tvOS) || os(visionOS)
-                .introspect(
-                    .view,
-                    on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26), .tvOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26)
-                ) { view in
-                    view.backgroundColor = .cyan
-                }
-                #elseif os(macOS)
-                .introspect(.view, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26)) { view in
-                    view.layer?.backgroundColor = NSColor.cyan.cgColor
-                }
-                #endif
+            ForEach(colors, id: \.self) { color in
+                GenericViewRepresentable()
+                    #if os(iOS) || os(tvOS) || os(visionOS)
+                    .introspect(
+                        .view,
+                        on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26), .tvOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26)
+                    ) { view in
+                        view.backgroundColor = UIColor(color)
+                    }
+                    #elseif os(macOS)
+                    .introspect(.view, on: .macOS(.v10_15, .v11, .v12, .v13, .v14, .v15, .v26)) { view in
+                        view.layer?.backgroundColor = NSColor(color).cgColor
+                    }
+                    #endif
+            }
         }
         .padding()
         #if os(iOS) || os(tvOS) || os(visionOS)
```

---

### Incident Patch 13: `b65c4ee1` (2025-09-10)
**Commit Message**: Fix Xcode RC 1 issues (#478)

**File**: `.github/workflows/ci.yml` (modified, +36/-17)
```diff
@@ -27,6 +27,13 @@ jobs:
       - name: Select Xcode version
         run: sudo xcodes select 16.4
 
+      - name: Install Runtimes
+        uses: nick-fields/retry@v3
+        with:
+          timeout_minutes: 15
+          max_attempts: 3
+          command: xcodebuild -downloadAllPlatforms
+
       - name: Lint Podspec
         run: |
           set -eo pipefail
@@ -43,22 +50,23 @@ jobs:
           - platform: [iOS, 15]
             runtime: iOS 15.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [iOS, 16]
             runtime: iOS 16.4
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [iOS, 17]
             runtime: iOS 17.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [iOS, 18]
-            runtime: iOS 18.5
+            runtime: iOS 18.6
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
+            install: false
           # - platform: [iOS, 26]
           #   runtime: iOS 26.0
           #   os: macos-15
@@ -67,22 +75,23 @@ jobs:
           - platform: [tvOS, 15]
             runtime: tvOS 15.4
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [tvOS, 16]
             runtime: tvOS 16.4
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [tvOS, 17]
             runtime: tvOS 17.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [tvOS, 18]
             runtime: tvOS 18.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
+            install: false
           # - platform: [tvOS, 26]
           #   runtime: tvOS 26.0
           #   os: macos-15
@@ -91,22 +100,23 @@ jobs:
           - platform: [watchOS, 8]
             runtime: watchOS 8.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [watchOS, 9]
             runtime: watchOS 9.4
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [watchOS, 10]
             runtime: watchOS 10.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [watchOS, 11]
             runtime: watchOS 11.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
+            install: false
           # - platform: [watchOS, 26]
           #   runtime: watchOS 26.0
           #   os: macos-15
@@ -115,7 +125,7 @@ jobs:
           - platform: [macOS, 15]
             runtime: macOS 15
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
           # - platform: [macOS, 26]
           #   runtime: macOS 26.0
           #   os: macos-15
@@ -124,12 +134,13 @@ jobs:
           - platform: [visionOS, 1]
             runtime: visionOS 1.2
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
             install: true
           - platform: [visionOS, 2]
             runtime: visionOS 2.5
             os: macos-15
-            xcode: 16.4
+            xcode: 26.0
+            install: false
           # - platform: [visionOS, 26]
           #   runtime: visionOS 26.0
           #   os: macos-15
@@ -141,9 +152,17 @@ jobs:
       - name: Set environment variables
         run: echo "SKIP_SLOW_FASTLANE_WARNING=1" >> $GITHUB_ENV
 
-      - name: Select Xcode version
+      - name: Select Xcode ${{ matrix.xcode }}
         run: sudo xcodes select ${{ matrix.xcode }}
 
+      - if: ${{ matrix.xcode == '26.0' && matrix.platform[0] != 'macOS' }}
+        name: Install 2026 Runtime
+        uses: nick-fields/retry@v3
+        with:
+          timeout_minutes: 15
+          max_attempts: 3
+          command: xcodebuild -downloadPlatform ${{ matrix.platform[0] }}
+
       - if: ${{ matrix.install }}
         name: "[Debug] List Available Installable Runtimes"
         run: xcodes runtimes --include-betas
```

**File**: `Sources/Introspect.swift` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ struct IntrospectModifier<SwiftUIViewType: IntrospectableViewType, PlatformSpeci
 }
 
 @MainActor
-public protocol PlatformEntity: AnyObject, Sendable {
+public protocol PlatformEntity: AnyObject {
     associatedtype Base: PlatformEntity
 
     @_spi(Internals)
```

**File**: `Sources/ViewTypes/SearchField.swift` (modified, +35/-2)
```diff
@@ -1,7 +1,7 @@
 #if !os(watchOS)
 /// An abstract representation of the search field displayed via the `.searchable` modifier in SwiftUI.
 ///
-/// ### iOS
+/// ### iOS 15 - 18
 ///
 /// ```swift
 /// struct ContentView: View {
@@ -13,7 +13,40 @@
 ///                 .searchable(text: $searchTerm)
 ///         }
 ///         .navigationViewStyle(.stack)
-///         .introspect(.searchField, on: .iOS(.v15, .v16, .v17, .v18, .v26)) {
+///         .introspect(.searchField, on: .iOS(.v15, .v16, .v17, .v18)) {
+///             print(type(of: $0)) // UISearchBar
+///         }
+///     }
+/// }
+/// ```
+///
+/// ### iOS 26+
+///
+/// From iOS 26 onward, search bar is only backed by UIKit when `.searchable` is used within a
+/// `NavigationView` or `NavigationStack` contained inside a `TabView`.
+///
+/// If `.searchable` is used outside of these containers, it is backed by SwiftUI's own implementation,
+/// and there is no UIKit view to introspect.
+///
+/// The only exception to this is on iPad, where double column `NavigationView` and `NavigationSplitView`
+/// still use `UISearchBar` even outside of a `TabView` (for now...).
+///
+/// ```swift
+/// struct ContentView: View {
+///     @State var searchTerm = ""
+///
+///     var body: some View {
+///         TabView {
+///             NavigationView {
+///                 Text("Root")
+///                     .searchable(text: $searchTerm)
+///             }
+///             .navigationViewStyle(.stack)
+///             .tabItem {
+///                 Label("Home", systemImage: "house")
+///             }
+///         }
+///         .introspect(.searchField, on: .iOS(.v26)) {
 ///             print(type(of: $0)) // UISearchBar
 ///         }
 ///     }
```

**File**: `Sources/ViewTypes/TabView.swift` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
 /// }
 /// ```
 ///
-/// ### macOS
+/// ### macOS 10.15 - 14
 ///
 /// ```swift
 /// struct ContentView: View {
```

**File**: `Tests/Tests/TestUtils.swift` (modified, +39/-21)
```diff
@@ -46,12 +46,14 @@ enum TestUtils {
 @discardableResult
 func introspection<Entity: AnyObject & Sendable>(
     of type: Entity.Type,
+    timeout: TimeInterval = 3,
+    sourceLocation: SourceLocation = #_sourceLocation,
     @ViewBuilder view: (
         _ spy1: @escaping (Entity) -> Void
     ) -> some View
 ) async throws -> Entity {
     var entity1: Entity?
-    return try await confirmation(expectedCount: 1...) { confirmation1 in
+    return try await confirmation(expectedCount: 1..., sourceLocation: sourceLocation) { confirmation1 in
         let view = view(
             {
                 confirmation1()
@@ -61,27 +63,33 @@ func introspection<Entity: AnyObject & Sendable>(
 
         TestUtils.present(view: view)
 
-        while entity1 == nil {
+        let startInstant = Date()
+        while
+            Date().timeIntervalSince(startInstant) < timeout,
+            entity1 == nil
+        {
             await Task.yield()
         }
 
-        return try #require(entity1)
+        return try #require(entity1, sourceLocation: sourceLocation)
     }
 }
 
 @MainActor
 @discardableResult
 func introspection<Entity: AnyObject & Sendable>(
     of type: Entity.Type,
+    timeout: TimeInterval = 3,
+    sourceLocation: SourceLocation = #_sourceLocation,
     @ViewBuilder view: (
         _ spy1: @escaping (Entity) -> Void,
         _ spy2: @escaping (Entity) -> Void
     ) -> some View
 ) async throws -> (Entity, Entity) {
     var entity1: Entity?
     var entity2: Entity?
-    return try await confirmation(expectedCount: 1...) { confirmation1 in
-        try await confirmation(expectedCount: 1...) { confirmation2 in
+    return try await confirmation(expectedCount: 1..., sourceLocation: sourceLocation) { confirmation1 in
+        try await confirmation(expectedCount: 1..., sourceLocation: sourceLocation) { confirmation2 in
             let view = view(
                 {
                     confirmation1()
@@ -95,16 +103,18 @@ func introspection<Entity: AnyObject & Sendable>(
 
             TestUtils.present(view: view)
 
+            let startInstant = Date()
             while
+                Date().timeIntervalSince(startInstant) < timeout,
                 entity1 == nil ||
                 entity2 == nil
             {
                 await Task.yield()
             }
 
             return try (
-                #require(entity1),
-                #require(entity2),
+                #require(entity1, sourceLocation: sourceLocation),
+                #require(entity2, sourceLocation: sourceLocation),
             )
         }
     }
@@ -114,6 +124,8 @@ func introspection<Entity: AnyObject & Sendable>(
 @discardableResult
 func introspection<Entity: AnyObject & Sendable>(
     of type: Entity.Type,
+    timeout: TimeInterval = 3,
+    sourceLocation: SourceLocation = #_sourceLocation,
     @ViewBuilder view: (
         _ spy1: @escaping (Entity) -> Void,
         _ spy2: @escaping (Entity) -> Void,
@@ -123,9 +135,9 @@ func introspection<Entity: AnyObject & Sendable>(
     var entity1: Entity?
     var entity2: Entity?
     var entity3: Entity?
-    return try await confirmation(expectedCount: 1...) { confirmation1 in
-        try await confirmation(expectedCount: 1...) { confirmation2 in
-            try await confirmation(expectedCount: 1...) { confirmation3 in
+    return try await confirmation(expectedCount: 1..., sourceLocation: sourceLocation) { confirmation1 in
+        try await confirmation(expectedCount: 1..., sourceLocation: sourceLocation) { confirmation2 in
+            try await confirmation(expectedCount: 1..., sourceLocation: sourceLocation) { confirmation3 in
                 let view = view(
                     {
                         confirmation1()
@@ -143,7 +155,9 @@ func introspection<Entity: AnyObject & Sendable>(
 
                 TestUtils.present(view: view)
 
+                let startInstant = Date()
                 while
+                    Date().timeIntervalSince(startInstant) < timeout,
                     entity1 == nil ||
                     entity2 == nil ||
                     entity3 == nil
@@ -152,9 +166,9 @@ func introspection<Entity: AnyObject & Sendable>(
                 }
 
                 return try (
-                    #require(entity1),
-                    #require(entity2),
-                    #require(entity3),
+                    #require(entity1, sourceLocation: sourceLocation),
+                    #require(entity2, sourceLocation: sourceLocation),
+                    #require(entity3, sourceLocation: sourceLocation),
                 )
             }
         }
@@ -165,6 +179,8 @@ func introspection<Entity: AnyObject & Sendable>(
 @discardableResult
 func introspection<Entity: AnyObject & Sendable>(
     of type: Entity.Type,
+    timeout: TimeInterval = 3,
+    sourceLocation: SourceLocation = #_sourceLocation,
     @ViewBuilder view: (
         _ spy1: @escaping (Entity) -> Void,
         _ spy2: @escaping (Entity) -> Voi
```

**File**: `Tests/Tests/ViewTypes/SearchFieldTests.swift` (modified, +97/-6)
```diff
@@ -11,7 +11,8 @@ struct SearchFieldTests {
     #endif
 
     @available(iOS 15, tvOS 15, *)
-    @Test func introspectInNavigationStack() async throws {
+    @Test(.`disabled on iOS 26+ except for iPad`())
+    func introspectInNavigationStack() async throws {
         try await introspection(of: PlatformSearchField.self) { spy in
             NavigationView {
                 Text("Customized")
@@ -24,8 +25,25 @@ struct SearchFieldTests {
         }
     }
 
+    @available(iOS 26, tvOS 15, *)
+    @Test func introspectInNavigationStackInTabView() async throws {
+        try await introspection(of: PlatformSearchField.self) { spy in
+            TabView {
+                NavigationView {
+                    Text("Customized")
+                        .searchable(text: .constant(""))
+                }
+                .navigationViewStyle(.stack)
+            }
+            #if os(iOS) || os(tvOS) || os(visionOS)
+            .introspect(.searchField, on: .iOS(.v15, .v16, .v17, .v18, .v26), .tvOS(.v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26), customize: spy)
+            #endif
+        }
+    }
+
     @available(iOS 15, tvOS 15, *)
-    @Test func introspectInNavigationStackAsAncestor() async throws {
+    @Test(.`disabled on iOS 26+ except for iPad`())
+    func introspectInNavigationStackAsAncestor() async throws {
         try await introspection(of: PlatformSearchField.self) { spy in
             NavigationView {
                 Text("Customized")
@@ -38,17 +56,33 @@ struct SearchFieldTests {
         }
     }
 
+    @available(iOS 26, tvOS 15, *)
+    @Test func introspectInNavigationStackInTabViewAsAncestor() async throws {
+        try await introspection(of: PlatformSearchField.self) { spy in
+            TabView {
+                NavigationView {
+                    Text("Customized")
+                        .searchable(text: .constant(""))
+                        #if os(iOS) || os(tvOS) || os(visionOS)
+                        .introspect(.searchField, on: .iOS(.v15, .v16, .v17, .v18, .v26), .tvOS(.v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26), scope: .ancestor, customize: spy)
+                        #endif
+                }
+                .navigationViewStyle(.stack)
+            }
+        }
+    }
+
     @available(iOS 15, tvOS 15, *)
-    @available(visionOS, introduced: 1, obsoleted: 26)
-    @Test func introspectInNavigationSplitView() async throws {
+    @Test(.`disabled on iOS 26+ except for iPad`())
+    func introspectInNavigationSplitView() async throws {
         try await introspection(of: PlatformSearchField.self) { spy in
             NavigationView {
                 Text("Customized")
                     .searchable(text: .constant(""))
             }
             .navigationViewStyle(DoubleColumnNavigationViewStyle())
             #if os(iOS) || os(tvOS) || os(visionOS)
-            .introspect(.searchField, on: .iOS(.v15, .v16, .v17, .v18, .v26), .tvOS(.v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2), customize: spy)
+            .introspect(.searchField, on: .iOS(.v15, .v16, .v17, .v18, .v26), .tvOS(.v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26), customize: spy)
             #endif
             #if os(iOS)
             // NB: this is necessary for introspection to work, because on iPad the search field is in the sidebar, which is initially hidden.
@@ -59,8 +93,31 @@ struct SearchFieldTests {
         }
     }
 
+    @available(iOS 26, tvOS 15, *)
+    @Test func introspectInNavigationSplitViewInTabView() async throws {
+        try await introspection(of: PlatformSearchField.self) { spy in
+            TabView {
+                NavigationView {
+                    Text("Customized")
+                        .searchable(text: .constant(""))
+                }
+                .navigationViewStyle(DoubleColumnNavigationViewStyle())
+                #if os(iOS) || os(tvOS) || os(visionOS)
+                .introspect(.searchField, on: .iOS(.v15, .v16, .v17, .v18, .v26), .tvOS(.v15, .v16, .v17, .v18, .v26), .visionOS(.v1, .v2, .v26), customize: spy)
+                #endif
+                #if os(iOS)
+                // NB: this is necessary for introspection to work, because on iPad the search field is in the sidebar, which is initially hidden.
+                .introspect(.navigationView(style: .columns), on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18, .v26)) {
+                    $0.preferredDisplayMode = .oneOverSecondary
+                }
+                #endif
+            }
+        }
+    }
+
     @available(iOS 15, tvOS 15, *)
-    @Test func introspectInNavigationSplitViewAsAncestor() async throws {
+    @Test(.`disabled on iOS 26+ except for iPad`())
+    func introspectInNavigationSplitViewAsAncestor() async throws {
         try await introspection(of: PlatformSearchField.self) { spy in
             NavigationView {
                 Text("Customized")
@@ -78,5 +135,39 @@ struct SearchFieldTests {
             #endif

```

**File**: `fastlane/Fastfile` (modified, +4/-4)
```diff
@@ -5,22 +5,22 @@ devices = {
         15 => ["iPhone SE (3rd generation) (15.5)", "iPad Air (5th generation) (15.5)",],
         16 => ["iPhone 14 (16.4)", "iPad Pro (11-inch) (4th generation) (16.4)"],
         17 => ["iPhone 15 (17.5)", "iPad Pro 11-inch (M4) (17.5)"],
-        18 => ["iPhone 16 (18.2)", "iPad Pro 11-inch (M4) (18.2)"],
+        18 => ["iPhone 16 (18.6)", "iPad Pro 11-inch (M4) (18.6)"],
     },
     "tvos" => {
         15 => ["Apple TV (15.4)"],
         16 => ["Apple TV (16.4)"],
         17 => ["Apple TV (17.5)"],
-        18 => ["Apple TV (18.2)"],
+        18 => ["Apple TV (18.5)"],
     },
     "watchos" => {
         8 => ["Apple Watch Series 7 (45mm) (8.5)"],
         9 => ["Apple Watch Series 8 (45mm) (9.4)"],
         10 => ["Apple Watch Series 9 (45mm) (10.5)"],
-        11 => ["Apple Watch Series 10 (42mm) (11.2)"],
+        11 => ["Apple Watch Series 10 (42mm) (11.5)"],
     },
     "visionos" => {
-        1 => ["Apple Vision Pro (1.2)"],
+        1 => ["Apple Vision Pro (at 2732x2048) (1.2)"],
         2 => ["Apple Vision Pro (2.5)"],
     },
 }
```

---

### Incident Patch 14: `359c2cbc` (2025-07-30)
**Commit Message**: Fix archiving error for XCFrameworks linking this library (#476)

**File**: `.github/workflows/ci.yml` (modified, +36/-0)
```diff
@@ -172,3 +172,39 @@ jobs:
       - if: ${{ matrix.platform[0] != 'watchOS' }}
         name: Run Tests
         run: fastlane test platform:${{ matrix.platform[0] }} version:${{ matrix.platform[1] }} scheme:SwiftUIIntrospectTests configuration:Debug
+
+  framework-archiving:
+    name: Archive Framework (${{ matrix.platform }})
+    runs-on: macos-15
+    strategy:
+      fail-fast: false
+      matrix:
+        platform: [iOS, macOS, tvOS, watchOS, visionOS, macCatalyst]
+        include:
+          - platform: iOS
+            destination: "generic/platform=iOS"
+          - platform: macOS
+            destination: "generic/platform=macOS"
+          - platform: tvOS
+            destination: "generic/platform=tvOS"
+          - platform: watchOS
+            destination: "generic/platform=watchOS"
+          - platform: visionOS
+            destination: "generic/platform=visionOS"
+          - platform: macCatalyst
+            destination: "platform=macOS,variant=Mac Catalyst"
+    steps:
+      - name: Git Checkout
+        uses: actions/checkout@v4
+
+      - name: Select Xcode version
+        run: sudo xcodes select 16.4
+
+      - name: Archive Framework
+        run: |
+          xcodebuild archive \
+            -scheme "SwiftUIIntrospectTestFramework" \
+            -destination "${{ matrix.destination }}" \
+            -archivePath .build/archiving/${{ matrix.platform }} \
+            SKIP_INSTALL=NO \
+            BUILD_LIBRARY_FOR_DISTRIBUTION=YES
```

**File**: `Sources/IntrospectionSelector.swift` (modified, +6/-1)
```diff
@@ -1,6 +1,11 @@
 #if !os(watchOS)
-@_spi(Advanced)
+#if os(iOS) || os(tvOS) || os(visionOS)
+public import UIKit
+#elseif os(macOS)
+public import AppKit
+#endif
 
+@_spi(Advanced)
 @MainActor
 public struct IntrospectionSelector<Target: PlatformEntity> {
     @_spi(Advanced)
```

**File**: `Tests/TestFramework/TestFramework.swift` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+//
+//  TestFramework.swift
+//  TestFramework
+//
+//  Created by David Roman on 30/07/2025.
+//
+
+import Foundation
+
```

**File**: `Tests/Tests.xcodeproj/project.pbxproj` (modified, +231/-2)
```diff
@@ -3,11 +3,12 @@
 	archiveVersion = 1;
 	classes = {
 	};
-	objectVersion = 55;
+	objectVersion = 70;
 	objects = {
 
 /* Begin PBXBuildFile section */
 		D503B2AC2A49BFE300027F5F /* VideoPlayerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D503B2AB2A49BFE300027F5F /* VideoPlayerTests.swift */; };
+		D50556532E3A6F5A00312263 /* SwiftUIIntrospect in Frameworks */ = {isa = PBXBuildFile; productRef = D50556522E3A6F5A00312263 /* SwiftUIIntrospect */; };
 		D50FFE8E2A17E2A400C32641 /* ScrollViewTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D50FFE8D2A17E2A400C32641 /* ScrollViewTests.swift */; };
 		D534D4DC2A4A596200218BFB /* WindowTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D534D4DB2A4A596200218BFB /* WindowTests.swift */; };
 		D55BAD142DFF2B050038443E /* WebViewTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = D55BAD132DFF2B050038443E /* WebViewTests.swift */; };
@@ -78,6 +79,7 @@
 
 /* Begin PBXFileReference section */
 		D503B2AB2A49BFE300027F5F /* VideoPlayerTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VideoPlayerTests.swift; sourceTree = "<group>"; };
+		D505564B2E3A6F2700312263 /* TestFramework.framework */ = {isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; path = TestFramework.framework; sourceTree = BUILT_PRODUCTS_DIR; };
 		D50FFE8D2A17E2A400C32641 /* ScrollViewTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScrollViewTests.swift; sourceTree = "<group>"; };
 		D534D4DB2A4A596200218BFB /* WindowTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WindowTests.swift; sourceTree = "<group>"; };
 		D55BAD132DFF2B050038443E /* WebViewTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WebViewTests.swift; sourceTree = "<group>"; };
@@ -137,7 +139,19 @@
 		D5F8D5EE2A1E87950054E9AB /* NavigationViewWithColumnsStyleTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NavigationViewWithColumnsStyleTests.swift; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
+/* Begin PBXFileSystemSynchronizedRootGroup section */
+		D505564C2E3A6F2700312263 /* TestFramework */ = {isa = PBXFileSystemSynchronizedRootGroup; explicitFileTypes = {}; explicitFolders = (); path = TestFramework; sourceTree = "<group>"; };
+/* End PBXFileSystemSynchronizedRootGroup section */
+
 /* Begin PBXFrameworksBuildPhase section */
+		D50556482E3A6F2700312263 /* Frameworks */ = {
+			isa = PBXFrameworksBuildPhase;
+			buildActionMask = 2147483647;
+			files = (
+				D50556532E3A6F5A00312263 /* SwiftUIIntrospect in Frameworks */,
+			);
+			runOnlyForDeploymentPostprocessing = 0;
+		};
 		D5F0BE4629C0DBE800AD95AB /* Frameworks */ = {
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
@@ -220,6 +234,7 @@
 			children = (
 				D5F0BE4B29C0DBE800AD95AB /* TestsHostApp */,
 				D5F0BE5E29C0DC0000AD95AB /* Tests */,
+				D505564C2E3A6F2700312263 /* TestFramework */,
 				D5F0BE4A29C0DBE800AD95AB /* Products */,
 				D5F0BE7029C0E12300AD95AB /* Frameworks */,
 			);
@@ -230,6 +245,7 @@
 			children = (
 				D5F0BE4929C0DBE800AD95AB /* TestsHostApp.app */,
 				D5F0BE5D29C0DC0000AD95AB /* Tests.xctest */,
+				D505564B2E3A6F2700312263 /* TestFramework.framework */,
 			);
 			name = Products;
 			sourceTree = "<group>";
@@ -262,7 +278,41 @@
 		};
 /* End PBXGroup section */
 
+/* Begin PBXHeadersBuildPhase section */
+		D50556462E3A6F2700312263 /* Headers */ = {
+			isa = PBXHeadersBuildPhase;
+			buildActionMask = 2147483647;
+			files = (
+			);
+			runOnlyForDeploymentPostprocessing = 0;
+		};
+/* End PBXHeadersBuildPhase section */
+
 /* Begin PBXNativeTarget section */
+		D505564A2E3A6F2700312263 /* TestFramework */ = {
+			isa = PBXNativeTarget;
+			buildConfigurationList = D50556512E3A6F2700312263 /* Build configuration list for PBXNativeTarget "TestFramework" */;
+			buildPhases = (
+				D50556462E3A6F2700312263 /* Headers */,
+				D50556472E3A6F2700312263 /* Sources */,
+				D50556482E3A6F2700312263 /* Frameworks */,
+				D50556492E3A6F2700312263 /* Resources */,
+			);
+			buildRules = (
+			);
+			dependencies = (
+			);
+			fileSystemSynchronizedGroups = (
+				D505564C2E3A6F2700312263 /* TestFramework */,
+			);
+			name = TestFramework;
+			packageProductDependencies = (
+				D50556522E3A6F5A00312263 /* SwiftUIIntrospect */,
+			);
+			productName = TestFramework;
+			productReference = D505564B2E3A6F2700312263 /* TestFramework.framework */;
+			productType = "com.apple.product-type.framework";
+		};
 		D5F0BE4829C0DBE800AD95AB /* TestsHostApp */ = {
 			isa = PBXNativeTarget;
 			buildConfigurationList = D5F0BE5829C0DBE900AD95AB /* Build configuration list for PBXNativeTarget "TestsHostApp" */;
@@ -308,9 +358,12 @@
 			isa = PBXProject;
 			attributes = {
 				BuildIndependentTargetsInParallel = 1;
-				LastSwiftUpdateCheck = 1500;
+				LastSwi
```

**File**: `Tests/Tests.xcodeproj/xcshareddata/xcschemes/SwiftUIIntrospectTestFramework.xcscheme` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Scheme
+   LastUpgradeVersion = "2600"
+   version = "1.7">
+   <BuildAction
+      parallelizeBuildables = "YES"
+      buildImplicitDependencies = "YES"
+      buildArchitectures = "Automatic">
+      <BuildActionEntries>
+         <BuildActionEntry
+            buildForTesting = "YES"
+            buildForRunning = "YES"
+            buildForProfiling = "YES"
+            buildForArchiving = "YES"
+            buildForAnalyzing = "YES">
+            <BuildableReference
+               BuildableIdentifier = "primary"
+               BlueprintIdentifier = "D505564A2E3A6F2700312263"
+               BuildableName = "TestFramework.framework"
+               BlueprintName = "TestFramework"
+               ReferencedContainer = "container:Tests.xcodeproj">
+            </BuildableReference>
+         </BuildActionEntry>
+      </BuildActionEntries>
+   </BuildAction>
+   <TestAction
+      buildConfiguration = "Debug"
+      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
+      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
+      shouldUseLaunchSchemeArgsEnv = "YES"
+      shouldAutocreateTestPlan = "YES">
+   </TestAction>
+   <LaunchAction
+      buildConfiguration = "Debug"
+      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
+      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
+      launchStyle = "0"
+      useCustomWorkingDirectory = "NO"
+      ignoresPersistentStateOnLaunch = "NO"
+      debugDocumentVersioning = "YES"
+      debugServiceExtension = "internal"
+      allowLocationSimulation = "YES">
+   </LaunchAction>
+   <ProfileAction
+      buildConfiguration = "Release"
+      shouldUseLaunchSchemeArgsEnv = "YES"
+      savedToolIdentifier = ""
+      useCustomWorkingDirectory = "NO"
+      debugDocumentVersioning = "YES">
+      <MacroExpansion>
+         <BuildableReference
+            BuildableIdentifier = "primary"
+            BlueprintIdentifier = "D505564A2E3A6F2700312263"
+            BuildableName = "TestFramework.framework"
+            BlueprintName = "TestFramework"
+            ReferencedContainer = "container:Tests.xcodeproj">
+         </BuildableReference>
+      </MacroExpansion>
+   </ProfileAction>
+   <AnalyzeAction
+      buildConfiguration = "Debug">
+   </AnalyzeAction>
+   <ArchiveAction
+      buildConfiguration = "Release"
+      revealArchiveInOrganizer = "YES">
+   </ArchiveAction>
+</Scheme>
```

---

### Incident Patch 15: `d2987aff` (2025-07-10)
**Commit Message**: Fix concurrency warnings (#473)

**File**: `Sources/Introspect.swift` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ struct IntrospectModifier<SwiftUIViewType: IntrospectableViewType, PlatformSpeci
 }
 
 @MainActor
-public protocol PlatformEntity: AnyObject {
+public protocol PlatformEntity: AnyObject, Sendable {
     associatedtype Base: PlatformEntity
 
     @_spi(Internals)
```

#### Recent Merged Pull Requests:
- **PR #527** (2026-10-03): feat: add default indeterminate `ProgressView` introspection (@davdroman)
- **PR #525** (2026-09-03): CI: run SwiftFormat through hk (@davdroman)
- **PR #524** (2026-09-03): chore: enforce SwiftFormat configuration (@davdroman)
- **PR #523** (2026-09-02): CI: enable SwiftFormat linting (@davdroman)
- **PR #522** (2026-08-05): Stop hierarchy traversal after the first matching entity (@2dubu)
- **PR #521** (closed): Stop hierarchy traversal after the first match (@2dubu)
- **PR #520** (2026-07-08): CI: install xcodes from upstream tap (@davdroman)
- **PR #519** (2026-07-01): CI: bump Xcode and 26 runtimes (@davdroman)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
