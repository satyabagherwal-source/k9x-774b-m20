# Forensic Learning Record (Deep Inspection): rechsteiner/Parchment

> **Canonical Artifact**: `07_PROJECT_LEARNING/rechsteiner-parchment-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rechsteiner/Parchment](https://github.com/rechsteiner/Parchment))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:30:38.709Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rechsteiner/Parchment`
- **Description**: A paging view with a highly customizable menu ✨
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3464 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ExampleSwiftUI/LifecycleView.swift`
```
import Parchment
import SwiftUI
import UIKit

struct LifecycleView: View {
    var body: some View {
        PageView {
            Page("Title 1") {
                Text("Page 1")
                    .font(.largeTitle)
                    .foregroundColor(.gray)
            }

            Page("Title 2") {
                Text("Page 2")
                    .font(.largeTitle)
                    .foregroundColor(.gray)
            }

            Page("Title 3") {
                Text("Page 3")
                    .font(.largeTitle)
                    .foregroundColor(.gray)
            }
        }
        .willScroll { item in
            print("will scroll: ", item)
        }
        .didScroll { item in
            print("did scroll: ", item)
        }
        .didSelect { item in
            print("did select: ", item)
        }
    }
}

```

### Core Architecture Module: `Parchment/Enums/InvalidationState.swift`
```
import UIKit

/// Used to represent what to invalidate in a collection view
/// layout. We need to be able to invalidate the layout multiple times
/// with different invalidation contexts before `invalidateLayout` is
/// called and we can use we can use this to determine exactly how
/// much we need to invalidate by adding together the states each
/// time a new context is invalidated.
@MainActor
public enum InvalidationState {
    case nothing
    case everything
    case sizes

    public init(_ invalidationContext: UICollectionViewLayoutInvalidationContext) {
        if invalidationContext.invalidateEverything {
            self = .everything
        } else if invalidationContext.invalidateDataSourceCounts {
            self = .everything
        } else if let context = invalidationContext as? PagingInvalidationContext {
            if context.invalidateSizes {
                self = .sizes
            } else {
                self = .nothing
            }
        } else {
            self = .nothing
        }
    }

    public static func + (lhs: InvalidationState, rhs: InvalidationState) -> InvalidationState {
        switch (lhs, rhs) {
        case (.everything, _), (_, .everything):
            return .everything
        case (.sizes, _), (_, .sizes):
            return .sizes
        case (.nothing, _), (_, .nothing):
            return .nothing
        default:
            return .everything
        }
    }
}

```

### Core Architecture Module: `Parchment/Enums/PageViewState.swift`
```
import Foundation

enum PageViewState {
    case empty
    case single
    case first
    case center
    case last

    var count: Int {
        switch self {
        case .empty:
            return 0
        case .single:
            return 1
        case .first, .last:
            return 2
        case .center:
            return 3
        }
    }
}

```

### Core Architecture Module: `Parchment/Enums/PagingState.swift`
```
import Foundation
import UIKit

/// The current state of the menu items. Indicates whether an item
/// is currently selected or is scrolling to another item. Can be
/// used to get the distance and progress of any ongoing transition.
public enum PagingState: Equatable {
    case empty
    case selected(pagingItem: PagingItem)
    case scrolling(
        pagingItem: PagingItem,
        upcomingPagingItem: PagingItem?,
        progress: CGFloat,
        initialContentOffset: CGPoint,
        distance: CGFloat
    )
}

public extension PagingState {
    var currentPagingItem: PagingItem? {
        switch self {
        case .empty:
            return nil
        case let .scrolling(pagingItem, _, _, _, _):
            return pagingItem
        case let .selected(pagingItem):
            return pagingItem
        }
    }

    var upcomingPagingItem: PagingItem? {
        switch self {
        case .empty:
            return nil
        case let .scrolling(_, upcomingPagingItem, _, _, _):
            return upcomingPagingItem
        case .selected:
            return nil
        }
    }

    var progress: CGFloat {
        switch self {
        case let .scrolling(_, _, progress, _, _):
            return progress
        case .selected, .empty:
            return 0
        }
    }

    var distance: CGFloat {
        switch self {
        case let .scrolling(_, _, _, _, distance):
            return distance
        case .selected, .empty:
            return 0
        }
    }

    var visuallySelectedPagingItem: PagingItem? {
        if abs(progress) > 0.5 {
            return upcomingPagingItem ?? currentPagingItem
        } else {
            return currentPagingItem
        }
    }
}

public func == (lhs: PagingState, rhs: PagingState) -> Bool {
    switch (lhs, rhs) {
    case
        (let .scrolling(lhsCurrent, lhsUpcoming, lhsProgress, lhsOffset, lhsDistance),
         let .scrolling(rhsCurrent, rhsUpcoming, rhsProgress, rhsOffset, rhsDistance)):
        if lhsCurrent.isEqual(to: rhsCurrent),
            lhsProgress == rhsProgress,
            lhsOffset == rhsOffset,
            lhsDistance == rhsDistance {
            if let lhsUpcoming = lhsUpcoming, let rhsUpcoming = rhsUpcoming, lhsUpcoming.isEqual(to: rhsUpcoming) {
                return true
            } else if lhsUpcoming == nil, rhsUpcoming == nil {
                return true
            }
        }
        return false
    case let (.selected(a), .selected(b)) where a.isEqual(to: b):
        return true
    case (.empty, .empty):
        return true
    default:
        return false
    }
}

```

### Core Architecture Module: `Parchment/Structs/PageState.swift`
```
import Foundation

/// Represents the current state of a page. This will be passed into
/// the `Page` struct while scrolling, and can be used to update the
/// appearance of the corresponding menu item to reflect the current
/// progress and selection state.
public struct PageState {
    public let progress: CGFloat
    public let isSelected: Bool
}

```

### Core Architecture Module: `Example/AppDelegate.swift`
```
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
}

```

### Core Architecture Module: `Example/Examples/Basic/BasicViewController.swift`
```
import Parchment
import UIKit

// This is the simplest use case of using Parchment. We just create a
// bunch of view controllers, and pass them into our paging view
// controller. FixedPagingViewController is a subclass of
// PagingViewController that makes it much easier to get started with
// Parchment when you only have a fixed array of view controllers. It
// will create a data source for us and set up the paging items to
// display the view controllers title.
class BasicViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        let viewControllers = [
            ContentViewController(index: 0),
            ContentViewController(index: 1),
            ContentViewController(index: 2),
            ContentViewController(index: 3),
        ]

        let pagingViewController = PagingViewController(viewControllers: viewControllers)

        // Make sure you add the PagingViewController as a child view
        // controller and constrain it to the edges of the view.
        addChild(pagingViewController)
        view.addSubview(pagingViewController.view)
        view.constrainToEdges(pagingViewController.view)
        pagingViewController.didMove(toParent: self)
    }
}

```

### Core Architecture Module: `Example/Examples/Calendar/CalendarPagingCell.swift`
```
import Parchment
import UIKit

class CalendarPagingCell: PagingCell {
    private var options: PagingOptions?

    lazy var dateLabel: UILabel = {
        let dateLabel = UILabel(frame: .zero)
        dateLabel.font = UIFont.systemFont(ofSize: 20)
        return dateLabel
    }()

    lazy var weekdayLabel: UILabel = {
        let weekdayLabel = UILabel(frame: .zero)
        weekdayLabel.font = UIFont.systemFont(ofSize: 12)
        return weekdayLabel
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        configure()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configure()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let insets = UIEdgeInsets(top: 10, left: 0, bottom: 5, right: 0)

        dateLabel.frame = CGRect(
            x: 0,
            y: insets.top,
            width: contentView.bounds.width,
            height: contentView.bounds.midY - insets.top
        )

        weekdayLabel.frame = CGRect(
            x: 0,
            y: contentView.bounds.midY,
            width: contentView.bounds.width,
            height: contentView.bounds.midY - insets.bottom
        )
    }

    fileprivate func configure() {
        weekdayLabel.backgroundColor = .white
        weekdayLabel.textAlignment = .center
        dateLabel.backgroundColor = .white
        dateLabel.textAlignment = .center

        addSubview(weekdayLabel)
        addSubview(dateLabel)
    }

    fileprivate func updateSelectedState(selected: Bool) {
        guard let options = options else { return }
        if selected {
            dateLabel.textColor = options.selectedTextColor
            weekdayLabel.textColor = options.selectedTextColor
        } else {
            dateLabel.textColor = options.textColor
            weekdayLabel.textColor = options.textColor
        }
    }

    override func setPagingItem(_ pagingItem: PagingItem, selected: Bool, options: PagingOptions) {
        self.options = options
        let calendarItem = pagingItem as! CalendarItem
        dateLabel.text = calendarItem.dateText
        weekdayLabel.text = calendarItem.weekdayText

        updateSelectedState(selected: selected)
    }

    override func apply(_ layoutAttributes: UICollectionViewLayoutAttributes) {
        super.apply(layoutAttributes)
        guard let options = options else { return }

        if let attributes = layoutAttributes as? PagingCellLayoutAttributes {
            dateLabel.textColor = UIColor.interpolate(
                from: options.textColor,
                to: options.selectedTextColor,
                with: attributes.progress
            )

            weekdayLabel.textColor = UIColor.interpolate(
                from: options.textColor,
                to: options.selectedTextColor,
                with: attributes.progress
            )
        }
    }
}

```

### Core Architecture Module: `Example/Examples/Calendar/CalendarViewController.swift`
```
import Parchment
import UIKit

// First thing we need to do is create our own PagingItem that will
// hold our date. We need to make sure it conforms to Hashable and
// Comparable, as that is required by PagingViewController. We also
// cache the formatted date strings for performance.
struct CalendarItem: PagingItem, Hashable, Comparable {
    let date: Date
    let dateText: String
    let weekdayText: String

    init(date: Date) {
        self.date = date
        dateText = DateFormatters.dateFormatter.string(from: date)
        weekdayText = DateFormatters.weekdayFormatter.string(from: date)
    }

    static func < (lhs: CalendarItem, rhs: CalendarItem) -> Bool {
        return lhs.date < rhs.date
    }
}

class CalendarViewController: UIViewController {
    private let calendar: Calendar = .current
    private let pagingViewController = PagingViewController()

    override func viewDidLoad() {
        super.viewDidLoad()

        pagingViewController.register(CalendarPagingCell.self, for: CalendarItem.self)
        pagingViewController.menuItemSize = .fixed(width: 48, height: 58)
        pagingViewController.textColor = UIColor.gray

        // Add the paging view controller as a child view
        // controller and constrain it to all edges
        addChild(pagingViewController)
        view.addSubview(pagingViewController.view)
        view.constrainToEdges(pagingViewController.view)
        pagingViewController.didMove(toParent: self)

        // Set our custom data source
        pagingViewController.infiniteDataSource = self

        // Set the current date as the selected paging item.
        let today = calendar.startOfDay(for: Date())
        pagingViewController.select(pagingItem: CalendarItem(date: today))

        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Today",
            style: .plain,
            target: self,
            action: #selector(selectToday))
    }

    @objc private func selectToday() {
        let date = calendar.startOfDay(for: Date())
        pagingViewController.select(pagingItem: CalendarItem(date: date), animated: true)
    }
}

// We need to conform to PagingViewControllerDataSource in order to
// implement our custom data source. We set the initial item to be the
// current date, and every time pagingItemBeforePagingItem: or
// pagingItemAfterPagingItem: is called, we either subtract or append
// the time interval equal to one day. This means our paging view
// controller will show one menu item for each day.
extension CalendarViewController: PagingViewControllerInfiniteDataSource {
    func pagingViewController(_: PagingViewController, itemAfter pagingItem: PagingItem) -> PagingItem? {
        let calendarItem = pagingItem as! CalendarItem
        let nextDate = calendar.date(byAdding: .day, value: 1, to: calendarItem.date)!
        return CalendarItem(date: nextDate)
    }

    func pagingViewController(_: PagingViewController, itemBefore pagingItem: PagingItem) -> PagingItem? {
        let calendarItem = pagingItem as! CalendarItem
        let previousDate = calendar.date(byAdding: .day, value: -1, to: calendarItem.date)!
        return CalendarItem(date: previousDate)
    }

    func pagingViewController(_: PagingViewController, viewControllerFor pagingItem: PagingItem) -> UIViewController {
        let calendarItem = pagingItem as! CalendarItem
        let formattedDate = DateFormatters.shortDateFormatter.string(from: calendarItem.date)
        return ContentViewController(title: formattedDate)
    }
}

```

### Core Architecture Module: `Example/Examples/Calendar/DateFormatters.swift`
```
import Foundation

struct DateFormatters {
    static let shortDateFormatter: DateFormatter = {
        let dateFormatter = DateFormatter()
        dateFormatter.timeStyle = .none
        dateFormatter.dateStyle = .short
        return dateFormatter
    }()

    static let dateFormatter: DateFormatter = {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "d"
        return dateFormatter
    }()

    static let weekdayFormatter: DateFormatter = {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "EEE"
        return dateFormatter
    }()
}

```

### Core Architecture Module: `Example/Examples/Header/HeaderViewController.swift`
```
import Parchment
import UIKit

// This first thing we need to do is to create our own custom paging
// view and override the layout constraints. The default
// implementation positions the menu view above the page view
// controller, but we want to include a header view above the menu. We
// also create a layout constraint property that allows us to update
// the height of the header.
class HeaderPagingView: PagingView {
    static let HeaderHeight: CGFloat = 200

    var headerHeightConstraint: NSLayoutConstraint!

    private(set) lazy var headerView: UIImageView = {
        let view = UIImageView(image: UIImage(named: "Header"))
        view.contentMode = .scaleAspectFill
        view.clipsToBounds = true
        return view
    }()

    override func setupConstraints() {
        addSubview(headerView)

        pageView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        headerView.translatesAutoresizingMaskIntoConstraints = false

        headerHeightConstraint = headerView.heightAnchor.constraint(
            equalToConstant: HeaderPagingView.HeaderHeight
        )
        headerHeightConstraint.isActive = true
        headerHeightConstraint.priority = .defaultLow

        let bottomConstraint = headerView.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor)
        bottomConstraint.isActive = true
        bottomConstraint.priority = .defaultHigh

        NSLayoutConstraint.activate([
            collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
            collectionView.heightAnchor.constraint(equalToConstant: options.menuHeight),
            collectionView.topAnchor.constraint(equalTo: headerView.bottomAnchor),

            headerView.topAnchor.constraint(equalTo: topAnchor),
            headerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: trailingAnchor),

            pageView.leadingAnchor.constraint(equalTo: leadingAnchor),
            pageView.trailingAnchor.constraint(equalTo: trailingAnchor),
            pageView.bottomAnchor.constraint(equalTo: bottomAnchor),
            pageView.topAnchor.constraint(equalTo: topAnchor),
        ])
    }
}

// Create a custom paging view controller and override the view with
// our own custom subclass.
class HeaderPagingViewController: PagingViewController {
    override func loadView() {
        view = HeaderPagingView(
            options: options,
            collectionView: collectionView,
            pageView: pageViewController.view
        )
    }
}

class HeaderViewController: UIViewController {
    /// Cache the view controllers in an array to avoid re-creating them
    /// while swiping between pages. Since we only have three view
    /// controllers it's fine to keep them all in memory.
    private let viewControllers = [
        TableViewController(),
        TableViewController(),
        TableViewController(),
    ]

    private let pagingViewController = HeaderPagingViewController()

    private var pagingView: HeaderPagingView {
        return pagingViewController.view as! HeaderPagingView
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // Add the paging view controller as a child view controller.
        addChild(pagingViewController)
        view.addSubview(pagingViewController.view)
        pagingViewController.didMove(toParent: self)

        // Customize the menu styling.
        pagingViewController.selectedTextColor = .black
        pagingViewController.indicatorColor = .black
        pagingViewController.indicatorOptions = .visible(
            height: 1,
            zIndex: Int.max,
            spacing: .zero,
            insets: .zero
        )

        // Constrain the paging view to all edges.
        pagingViewController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            pagingViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            pagingViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            pagingViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pagingViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        // Set the data source for our view controllers
        pagingViewController.dataSource = self

        // Set our delegate so we get notified when the user swipes
        // between pages. We will use these delegates to move the
        // UIScrollViewDelegate and update the content offset.
        pagingViewController.delegate = self

        // Set the UIScrollViewDelegate on the initial view controller
        // so we can update the header view while scrolling.
        viewControllers.first?.tableView.delegate = self
    }
}

extension HeaderViewController: PagingViewControllerDataSource {
    func pagingViewController(_: PagingViewController, viewControllerAt index: Int) -> UIViewController {
        let viewController = viewControllers[index]
        viewController.title = "View \(index)"

        // Inset the table view with the height of the menu height.
        let height = pagingViewController.options.menuHeight + HeaderPagingView.HeaderHeight
        let insets = UIEdgeInsets(top: height, left: 0, bottom: 0, right: 0)
        viewController.tableView.contentInset = insets
        viewController.tableView.scrollIndicatorInsets = UIEdgeInsets(top: height, left: 0, bottom: 0, right: 0)
        viewController.tableView.contentOffset.y = -insets.top

        return viewController
    }

    func pagingViewController(_: PagingViewController, pagingItemAt index: Int) -> PagingItem {
        return PagingIndexItem(index: index, title: "View \(index)")
    }

    func numberOfViewControllers(in _: PagingViewController) -> Int {
        return viewControllers.count
    }
}

extension HeaderViewController: PagingViewControllerDelegate {
    func pagingViewController(_: PagingViewController, didScrollToItem _: PagingItem, startingViewController: UIViewController?, destinationViewController: UIViewController, transitionSuccessful: Bool) {
        guard let startingViewController = startingViewController as? TableViewController else { return }
        guard let destinationViewController = destinationViewController as? TableViewController else { return }

        // Set the delegate on the currently selected view so that we can
        // listen to the scroll view delegate.
        if transitionSuccessful {
            startingViewController.tableView.delegate = nil
            destinationViewController.tableView.delegate = self
        }
    }

    func pagingViewController(_: PagingViewController, isScrollingFromItem currentPagingItem: PagingItem, toItem upcomingPagingItem: PagingItem?, startingViewController: UIViewController, destinationViewController: UIViewController?, progress: CGFloat) {
        guard let destinationViewController = destinationViewController as? TableViewController else { return }

        // Update the content offset based on the height of the header
        // view. This ensures that the content offset is correct if you
        // swipe to a new page while the header view is hidden.
        if let scrollView = destinationViewController.tableView {
            let offset = pagingView.headerView.bounds.height + pagingViewController.options.menuHeight
            scrollView.contentOffset = CGPoint(x: 0, y: -offset)
        }
    }
}

extension HeaderViewController: UITableViewDelegate {
    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard scrollView.contentOffset.y < 0 else {
            // Reset the header constraint in case we scrolled so fast that
            // the height was not set to zero before the content offset
            // became negative.
            if pagingView.headerHeightConstraint.constant > 0 {
                pagingView.headerHeightConstraint.constant = 0
            }
            return
        }

        // Update the height of the header view based on the content
        // offset of the currently selected view controller.
        let height = max(0, abs(scrollView.contentOffset.y) - pagingViewController.options.menuHeight)
        pagingView.headerHeightConstraint.constant = height
    }
}

```

### Core Architecture Module: `Example/Examples/Icons/IconPagingCell.swift`
```
import Parchment
import UIKit

struct IconPagingCellViewModel {
    let image: UIImage?
    let selected: Bool
    let tintColor: UIColor
    let selectedTintColor: UIColor

    init(image: UIImage?, selected: Bool, options: PagingOptions) {
        self.image = image
        self.selected = selected
        tintColor = options.textColor
        selectedTintColor = options.selectedTextColor
    }
}

class IconPagingCell: PagingCell {
    fileprivate var viewModel: IconPagingCellViewModel?

    fileprivate lazy var imageView: UIImageView = {
        let imageView = UIImageView(frame: .zero)
        imageView.contentMode = .scaleAspectFit
        return imageView
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.addSubview(imageView)
        setupConstraints()
    }

    required init?(coder _: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func setPagingItem(_ pagingItem: PagingItem, selected: Bool, options: PagingOptions) {
        if let item = pagingItem as? IconItem {
            let viewModel = IconPagingCellViewModel(
                image: item.image,
                selected: selected,
                options: options
            )

            imageView.image = viewModel.image

            if viewModel.selected {
                imageView.transform = CGAffineTransform(scaleX: 1, y: 1)
                imageView.tintColor = viewModel.selectedTintColor
            } else {
                imageView.transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
                imageView.tintColor = viewModel.tintColor
            }

            self.viewModel = viewModel
        }
    }

    open override func apply(_ layoutAttributes: UICollectionViewLayoutAttributes) {
        guard let viewModel = viewModel else { return }
        if let attributes = layoutAttributes as? PagingCellLayoutAttributes {
            let scale = (0.4 * attributes.progress) + 0.6
            imageView.transform = CGAffineTransform(scaleX: scale, y: scale)
            imageView.tintColor = UIColor.interpolate(
                from: viewModel.tintColor,
                to: viewModel.selectedTintColor,
                with: attributes.progress
            )
        }
    }

    private func setupConstraints() {
        imageView.translatesAutoresizingMaskIntoConstraints = false

        let topConstraint = NSLayoutConstraint(
            item: imageView,
            attribute: .top,
            relatedBy: .equal,
            toItem: contentView,
            attribute: .top,
            multiplier: 1.0,
            constant: 15
        )

        let bottomConstraint = NSLayoutConstraint(
            item: imageView,
            attribute: .bottom,
            relatedBy: .equal,
            toItem: contentView,
            attribute: .bottom,
            multiplier: 1.0,
            constant: -15
        )

        let leadingConstraint = NSLayoutConstraint(
            item: imageView,
            attribute: .leading,
            relatedBy: .equal,
            toItem: contentView,
            attribute: .leading,
            multiplier: 1.0,
            constant: 0
        )

        let trailingConstraint = NSLayoutConstraint(
            item: imageView,
            attribute: .trailing,
            relatedBy: .equal,
            toItem: contentView,
            attribute: .trailing,
            multiplier: 1.0,
            constant: 0
        )

        contentView.addConstraints([
            topConstraint,
            bottomConstraint,
            leadingConstraint,
            trailingConstraint,
        ])
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #740** (2026-02-02): **Crash in PagingCollectionViewLayout.swift:306**
  *Symptoms*: Hello, I'm encountering a crash in PagingCollectionViewLayout.swift in line 306. It's not consistent and I have no way of reproducing it. But it is top crash in our Crashlytics.   The crash Stack Trace say: `Fatal Exception: NSInternalInconsistencyException UICollectionViewLayoutAttributes: -setFrame: requires finite dimensions. Attributes: <Parchment.PagingCellLayoutAttributes: 0x116a82880; index path: (0-0); frame = (0 0; 0 0)>; new frame: {{0, 0}, {inf, 40}}`  Is this a setup problem or should there be some check in the package itself to avoid inf values?
  **Post-Mortem & Fix Analysis**:
  > Turns out it was a setup problem. 

- **Issue #733** (2024-09-29): **Release v4.1.0**
  *Symptoms*: ### Changes  - Enable Swift 6 mode #723

- **Issue #731** (2024-09-17): **Update build server to Xcode 16**
  *Symptoms*: 

- **Issue #725** (2024-08-14): **Fix build error for Swift 6**
  *Symptoms*: Confirmed with Xcode 16 beta 4 and Swift 6.
  **Post-Mortem & Fix Analysis**:
  > Thanks 🙌 I've fixed the same in #725, but I'll merge this and wait with enabling Swift 6 until Xcode 16 is officially oute

- **Issue #724** (2024-08-10): **Fix spellchecking errors**
  *Symptoms*: 

- **Issue #723** (2024-09-16): **Enable Swift 6 mode**
  *Symptoms*: 

- **Issue #722** (2024-08-10): **Fix Swift concurrency**
  *Symptoms*: Added `@MainActor` for Swift 6.
  **Post-Mortem & Fix Analysis**:
  > Thank you for fixing this 🙌

- **Issue #719** (2024-06-13): **for the swiftUI page view, when data changes, the UI can't be changed inside each page**
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

### Incident Patch 1: `dfb23ea5` (2024-09-29)
**Commit Message**: Fix Swift version in podspec

**File**: `Parchment.podspec.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
     "git": "https://github.com/rechsteiner/Parchment.git",
     "tag": "v4.1.0"
   },
-  "swift_version": "5.10",
+  "swift_version": "6.0",
   "platforms": {
     "ios": "12.0"
   },
```

---

### Incident Patch 2: `7799b0f9` (2024-09-17)
**Commit Message**: Update build server to Xcode 16

**File**: `.github/workflows/parchment.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ jobs:
     steps:
       - uses: maxim-lobanov/setup-xcode@v1
         with:
-          xcode-version: '16.0-beta'
+          xcode-version: '16.0'
       - uses: actions/checkout@v3
       - name: Unit Tests
         run: xcodebuild -project Parchment.xcodeproj -scheme "Parchment" -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Pro,OS=18.0' test
```

---

### Incident Patch 3: `71903747` (2024-09-08)
**Commit Message**: Fix isolation errors in UI tests

**File**: `ParchmentUITests/ParchmentUITests.swift` (modified, +8/-5)
```diff
@@ -2,16 +2,15 @@ import XCTest
 
 @MainActor
 final class ParchmentUITests: XCTestCase {
-    var app: XCUIApplication!
-
     override func setUp() {
         continueAfterFailure = false
-        app = XCUIApplication()
-        app.launchArguments = ["--ui-testing"]
-        app.launch()
     }
 
     func testSelect() {
+        let app = XCUIApplication()
+        app.launchArguments = ["--ui-testing"]
+        app.launch()
+
         let cell0 = app.collectionViews.cells["View 0"]
         let cell1 = app.collectionViews.cells["View 1"]
 
@@ -27,6 +26,10 @@ final class ParchmentUITests: XCTestCase {
     }
 
     func testSwipe() {
+        let app = XCUIApplication()
+        app.launchArguments = ["--ui-testing"]
+        app.launch()
+        
         app.scrollViews.firstMatch.swipeLeft()
         let content1 = app.scrollViews.firstMatch.staticTexts["1"]
         XCTAssertTrue(content1.waitForExistence(timeout: 1))
```

---

### Incident Patch 4: `51676858` (2024-08-10)
**Commit Message**: Fix remaining concurrency issues

**File**: `Example/Examples/Calendar/DateFormatters.swift` (modified, +3/-3)
```diff
@@ -1,20 +1,20 @@
 import Foundation
 
 struct DateFormatters {
-    static var shortDateFormatter: DateFormatter = {
+    static let shortDateFormatter: DateFormatter = {
         let dateFormatter = DateFormatter()
         dateFormatter.timeStyle = .none
         dateFormatter.dateStyle = .short
         return dateFormatter
     }()
 
-    static var dateFormatter: DateFormatter = {
+    static let dateFormatter: DateFormatter = {
         let dateFormatter = DateFormatter()
         dateFormatter.dateFormat = "d"
         return dateFormatter
     }()
 
-    static var weekdayFormatter: DateFormatter = {
+    static let weekdayFormatter: DateFormatter = {
         let dateFormatter = DateFormatter()
         dateFormatter.dateFormat = "EEE"
         return dateFormatter
```

**File**: `Example/Examples/Images/ImagesViewController.swift` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 import Parchment
 import UIKit
 
+@MainActor
 protocol ImagesViewControllerDelegate: AnyObject {
     func imagesViewControllerDidScroll(_: ImagesViewController)
 }
```

**File**: `Parchment/Protocols/PagingViewControllerSizeDelegate.swift` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 import UIKit
 
+@MainActor
 public protocol PagingViewControllerSizeDelegate: AnyObject {
     /// Manually control the width for a given `PagingItem`. Parchment
     /// does not support self-sizing cells, so you have to use this if
```

**File**: `ParchmentTests/Mocks/Mock.swift` (modified, +3/-0)
```diff
@@ -7,11 +7,13 @@ enum Action: Equatable {
 }
 
 struct MockCall: Equatable {
+    @MainActor
     static var callCount: Int = 0
 
     let index: Int
     let action: Action
 
+    @MainActor
     init(action: Action) {
         Self.callCount += 1
         self.index = Self.callCount
@@ -25,6 +27,7 @@ extension MockCall: Comparable {
     }
 }
 
+@MainActor
 protocol Mock {
     var calls: [MockCall] { get }
 }
```

**File**: `ParchmentTests/Mocks/MockCollectionView.swift` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 @testable import Parchment
 import UIKit
 
+@MainActor
 final class MockCollectionView: CollectionView, Mock {
     enum Action: Equatable {
         case contentOffset(CGPoint)
```

**File**: `ParchmentTests/Mocks/MockPagingControllerDelegate.swift` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 import Foundation
 @testable import Parchment
 
+@MainActor
 final class MockPagingControllerDelegate: PagingMenuDelegate, Mock {
     enum Action: Equatable {
         case selectContent(pagingItem: Item, direction: PagingDirection, animated: Bool)
```

**File**: `ParchmentTests/PagingIndicatorLayoutAttributesTests.swift` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@ import Foundation
 @testable import Parchment
 import XCTest
 
+@MainActor
 final class PagingIndicatorLayoutAttributesTests: XCTestCase {
     let layoutAttributes = PagingIndicatorLayoutAttributes()
     var options = PagingOptions()
```

**File**: `ParchmentTests/PagingViewControllerDelegateTests.swift` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ import Foundation
 import UIKit
 import XCTest
 
+@MainActor
 final class PagingViewControllerDelegateTests: XCTestCase {
     func testDidSelectItem() {
         let viewController0 = UIViewController()
```

---

### Incident Patch 5: `ebf80b37` (2024-08-10)
**Commit Message**: Replace deprecated @UIApplicationMain with @main

**File**: `Example/AppDelegate.swift` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import UIKit
 
-@UIApplicationMain
+@main
 class AppDelegate: UIResponder, UIApplicationDelegate {
     var window: UIWindow?
 }
```

---

### Incident Patch 6: `aff55024` (2024-08-14)
**Commit Message**: Merge pull request #725 from kitwtnb/fix-build-error-for-swift6

Fix build error for Swift 6

**File**: `Parchment/Protocols/PagingIndicatorStyle.swift` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import Foundation
 import SwiftUI
 
 @available(iOS 14.0, *)
-public protocol PagingIndicatorStyle {
+public protocol PagingIndicatorStyle: Sendable {
     associatedtype Body: View
     typealias Configuration = PagingIndicatorConfiguration
     @ViewBuilder func makeBody(configuration: Configuration) -> Body
@@ -34,7 +34,7 @@ struct DefaultPagingIndicatorStyle: PagingIndicatorStyle {
 
 @available(iOS 14.0, *)
 struct PagingIndicatorStyleKey: EnvironmentKey {
-    static var defaultValue: any PagingIndicatorStyle = DefaultPagingIndicatorStyle()
+    static let defaultValue: any PagingIndicatorStyle = DefaultPagingIndicatorStyle()
 }
 
 @available(iOS 14.0, *)
```

---

### Incident Patch 7: `2fb6324b` (2024-08-12)
**Commit Message**: fix build error for Swift 6

**File**: `Parchment/Protocols/PagingIndicatorStyle.swift` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import Foundation
 import SwiftUI
 
 @available(iOS 14.0, *)
-public protocol PagingIndicatorStyle {
+public protocol PagingIndicatorStyle: Sendable {
     associatedtype Body: View
     typealias Configuration = PagingIndicatorConfiguration
     @ViewBuilder func makeBody(configuration: Configuration) -> Body
@@ -34,7 +34,7 @@ struct DefaultPagingIndicatorStyle: PagingIndicatorStyle {
 
 @available(iOS 14.0, *)
 struct PagingIndicatorStyleKey: EnvironmentKey {
-    static var defaultValue: any PagingIndicatorStyle = DefaultPagingIndicatorStyle()
+    static let defaultValue: any PagingIndicatorStyle = DefaultPagingIndicatorStyle()
 }
 
 @available(iOS 14.0, *)
```

---

### Incident Patch 8: `8532621c` (2024-08-10)
**Commit Message**: Fix spellchecking errors

**File**: `Example/Examples/Header/HeaderViewController.swift` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ class HeaderViewController: UIViewController {
             insets: .zero
         )
 
-        // Contrain the paging view to all edges.
+        // Constrain the paging view to all edges.
         pagingViewController.view.translatesAutoresizingMaskIntoConstraints = false
         NSLayoutConstraint.activate([
             pagingViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
```

**File**: `Example/Examples/Icons/IconPagingCell.swift` (modified, +6/-6)
```diff
@@ -72,7 +72,7 @@ class IconPagingCell: PagingCell {
     private func setupConstraints() {
         imageView.translatesAutoresizingMaskIntoConstraints = false
 
-        let topContraint = NSLayoutConstraint(
+        let topConstraint = NSLayoutConstraint(
             item: imageView,
             attribute: .top,
             relatedBy: .equal,
@@ -92,7 +92,7 @@ class IconPagingCell: PagingCell {
             constant: -15
         )
 
-        let leadingContraint = NSLayoutConstraint(
+        let leadingConstraint = NSLayoutConstraint(
             item: imageView,
             attribute: .leading,
             relatedBy: .equal,
@@ -102,7 +102,7 @@ class IconPagingCell: PagingCell {
             constant: 0
         )
 
-        let trailingContraint = NSLayoutConstraint(
+        let trailingConstraint = NSLayoutConstraint(
             item: imageView,
             attribute: .trailing,
             relatedBy: .equal,
@@ -113,10 +113,10 @@ class IconPagingCell: PagingCell {
         )
 
         contentView.addConstraints([
-            topContraint,
+            topConstraint,
             bottomConstraint,
-            leadingContraint,
-            trailingContraint,
+            leadingConstraint,
+            trailingConstraint,
         ])
     }
 }
```

**File**: `Example/Examples/Images/UnsplashViewController.swift` (modified, +2/-2)
```diff
@@ -163,7 +163,7 @@ class UnsplashViewController: UIViewController {
         )
 
         // Add the paging view controller as a child view controller and
-        // contrain it to all edges.
+        // constrain it to all edges.
         addChild(pagingViewController)
         view.addSubview(pagingViewController.view)
         view.constrainToEdges(pagingViewController.view)
@@ -236,7 +236,7 @@ extension UnsplashViewController: PagingViewControllerDataSource {
 extension UnsplashViewController: ImagesViewControllerDelegate {
     func imagesViewControllerDidScroll(_ imagesViewController: ImagesViewController) {
         // Calculate the menu height based on the content offset of the
-        // currenly selected view controller and update the menu.
+        // currently selected view controller and update the menu.
         let height = calculateMenuHeight(for: imagesViewController.collectionView)
         updateMenu(height: height)
     }
```

**File**: `Example/Examples/LargeTitles/LargeTitlesViewController.swift` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
 import Parchment
 import UIKit
 
-// This example shows how to use Parchment togehter with
+// This example shows how to use Parchment together with
 // "prefersLargeTitles" on UINavigationBar. It works by creating a
 // "hidden" scroll view that is added as a subview to the view
 // controller. Apparently, UIKit will look for a scroll view that is
@@ -116,7 +116,7 @@ class LargeTitlesViewController: UIViewController {
         hiddenScrollView.contentInset = viewController.tableView.contentInset
         hiddenScrollView.contentOffset = viewController.tableView.contentOffset
 
-        // Set the UITableViewDelegate to the currenly visible table view.
+        // Set the UITableViewDelegate to the currently visible table view.
         viewController.tableView.delegate = self
     }
 }
@@ -154,7 +154,7 @@ extension LargeTitlesViewController: PagingViewControllerDelegate {
         guard let destinationViewController = destinationViewController as? TableViewController else { return }
         guard let startingViewController = startingViewController as? TableViewController else { return }
 
-        // Set the UITableViewDelegate back to the currenly selected
+        // Set the UITableViewDelegate back to the currently selected
         // view controller when the page scroll ended.
         if transitionSuccessful {
             destinationViewController.tableView.delegate = self
```

**File**: `Example/Examples/MultipleCells/MultipleCellsViewController.swift` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ class MultipleCellsViewController: UIViewController {
         pagingViewController.select(index: 0)
 
         // Add the paging view controller as a child view controller
-        // and contrain it to all edges.
+        // and constrain it to all edges.
         addChild(pagingViewController)
         view.addSubview(pagingViewController.view)
 
```

**File**: `Example/Examples/SizeDelegate/SizeDelegateViewController.swift` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import Parchment
 import UIKit
 
 final class SizeDelegateViewController: UIViewController {
-    // Let's start by creating an array of citites that we
+    // Let's start by creating an array of cities that we
     // will use to generate some view controllers.
     fileprivate let cities = [
         "Oslo",
@@ -30,7 +30,7 @@ final class SizeDelegateViewController: UIViewController {
         pagingViewController.sizeDelegate = self
 
         // Add the paging view controller as a child view controller and
-        // contrain it to all edges.
+        // constrain it to all edges.
         addChild(pagingViewController)
         view.addSubview(pagingViewController.view)
         view.constrainToEdges(pagingViewController.view)
```

**File**: `Example/Examples/Storyboard/StoryboardViewController.swift` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ class StoryboardViewController: UIViewController {
         ])
 
         // Make sure you add the PagingViewController as a child view
-        // controller and contrain it to the edges of the view.
+        // controller and constrain it to the edges of the view.
         addChild(pagingViewController)
         view.addSubview(pagingViewController.view)
         view.constrainToEdges(pagingViewController.view)
```

**File**: `Example/Resources/UIView+constraints.swift` (modified, +8/-8)
```diff
@@ -4,7 +4,7 @@ extension UIView {
     func constrainCentered(_ subview: UIView) {
         subview.translatesAutoresizingMaskIntoConstraints = false
 
-        let verticalContraint = NSLayoutConstraint(
+        let verticalConstraint = NSLayoutConstraint(
             item: subview,
             attribute: .centerY,
             relatedBy: .equal,
@@ -14,7 +14,7 @@ extension UIView {
             constant: 0
         )
 
-        let horizontalContraint = NSLayoutConstraint(
+        let horizontalConstraint = NSLayoutConstraint(
             item: subview,
             attribute: .centerX,
             relatedBy: .equal,
@@ -24,7 +24,7 @@ extension UIView {
             constant: 0
         )
 
-        let heightContraint = NSLayoutConstraint(
+        let heightConstraint = NSLayoutConstraint(
             item: subview,
             attribute: .height,
             relatedBy: .equal,
@@ -34,7 +34,7 @@ extension UIView {
             constant: subview.frame.height
         )
 
-        let widthContraint = NSLayoutConstraint(
+        let widthConstraint = NSLayoutConstraint(
             item: subview,
             attribute: .width,
             relatedBy: .equal,
@@ -45,10 +45,10 @@ extension UIView {
         )
 
         addConstraints([
-            horizontalContraint,
-            verticalContraint,
-            heightContraint,
-            widthContraint,
+            horizontalConstraint,
+            verticalConstraint,
+            heightConstraint,
+            widthConstraint,
         ])
     }
 
```

---

### Incident Patch 9: `22b92d51` (2024-08-10)
**Commit Message**: Fix Swift concurrency (#722)

* fix actor isolation
* fix tests

**File**: `Parchment/Classes/PageViewCoordinator.swift` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 import UIKit
 
 @available(iOS 14.0, *)
+@MainActor
 final class PageViewCoordinator: PagingViewControllerDataSource, PagingViewControllerDelegate {
     final class WeakReference<T: AnyObject> {
         weak var value: T?
```

**File**: `Parchment/Classes/PageViewManager.swift` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 import UIKit
 
+@MainActor
 final class PageViewManager {
     weak var dataSource: PageViewManagerDataSource?
     weak var delegate: PageViewManagerDelegate?
```

**File**: `Parchment/Classes/PagingController.swift` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 import UIKit
 
 protocol PagingControllerSizeDelegate: AnyObject {
+    @MainActor
     func width(for: PagingItem, isSelected: Bool) -> CGFloat
 }
 
```

**File**: `Parchment/Classes/PagingStaticDataSource.swift` (modified, +2/-1)
```diff
@@ -1,7 +1,8 @@
 import Foundation
 import UIKit
 
-class PagingStaticDataSource: PagingViewControllerInfiniteDataSource {
+@MainActor
+final class PagingStaticDataSource: PagingViewControllerInfiniteDataSource {
     private(set) var items: [PagingItem] = []
     private let viewControllers: [UIViewController]
 
```

**File**: `Parchment/Enums/InvalidationState.swift` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ import UIKit
 /// called and we can use we can use this to determine exactly how
 /// much we need to invalidate by adding together the states each
 /// time a new context is invalidated.
+@MainActor
 public enum InvalidationState {
     case nothing
     case everything
```

**File**: `Parchment/Protocols/CollectionView.swift` (modified, +2/-0)
```diff
@@ -1,5 +1,6 @@
 import UIKit
 
+@MainActor
 protocol CollectionViewLayout: AnyObject {
     var state: PagingState { get set }
     var visibleItems: PagingItems { get set }
@@ -13,6 +14,7 @@ protocol CollectionViewLayout: AnyObject {
 
 extension PagingCollectionViewLayout: CollectionViewLayout {}
 
+@MainActor
 protocol CollectionView: AnyObject {
     var indexPathsForVisibleItems: [IndexPath] { get }
     var isDragging: Bool { get }
```

**File**: `Parchment/Protocols/PageViewControllerDataSource.swift` (modified, +2/-0)
```diff
@@ -8,6 +8,7 @@ public protocol PageViewControllerDataSource: AnyObject {
     /// - Parameters:
     ///   - pageViewController: The `PageViewController` instance.
     ///   - viewController: The current view controller.
+    @MainActor
     func pageViewController(
         _ pageViewController: PageViewController,
         viewControllerBeforeViewController viewController: UIViewController
@@ -18,6 +19,7 @@ public protocol PageViewControllerDataSource: AnyObject {
     /// - Parameters:
     ///   - pageViewController: The `PageViewController` instance.
     ///   - viewController: The current view controller.
+    @MainActor
     func pageViewController(
         _ pageViewController: PageViewController,
         viewControllerAfterViewController viewController: UIViewController
```

**File**: `Parchment/Protocols/PageViewControllerDelegate.swift` (modified, +3/-0)
```diff
@@ -13,6 +13,7 @@ public protocol PageViewControllerDelegate: AnyObject {
     ///   scrolling from.
     ///   - destinationViewController: The view controller the user is
     ///   scrolling towards.
+    @MainActor
     func pageViewController(
         _ pageViewController: PageViewController,
         willStartScrollingFrom startingViewController: UIViewController,
@@ -30,6 +31,7 @@ public protocol PageViewControllerDelegate: AnyObject {
     ///   towards one of the edges.
     ///   - progress: The progress of the scroll transition. Between 0
     ///   and 1.
+    @MainActor
     func pageViewController(
         _ pageViewController: PageViewController,
         isScrollingFrom startingViewController: UIViewController,
@@ -47,6 +49,7 @@ public protocol PageViewControllerDelegate: AnyObject {
     ///   scrolling towards.
     ///   - transitionSuccessful: A boolean indicating whether the
     ///   transition completed, or was cancelled by the user.
+    @MainActor
     func pageViewController(
         _ pageViewController: PageViewController,
         didFinishScrollingFrom startingViewController: UIViewController,
```

---

### Incident Patch 10: `6c96c130` (2024-05-24)
**Commit Message**: Fix concurrency warning in with XCTestCase and @MainActor

Need to apply @MainActor to each individual test case instead:
https://forums.swift.org/t/swift-5-10-concurrency-and-xctest/69929

**File**: `ParchmentTests/PagingControllerTests.swift` (modified, +45/-16)
```diff
@@ -1,8 +1,7 @@
 import Foundation
-@testable import Parchment
 import XCTest
+@testable import Parchment
 
-@MainActor
 final class PagingControllerTests: XCTestCase {
     static let ItemSize: CGFloat = 50
 
@@ -14,6 +13,7 @@ final class PagingControllerTests: XCTestCase {
     var sizeDelegate: MockPagingControllerSizeDelegate?
     var pagingController: PagingController!
 
+    @MainActor
     override func setUp() {
         options = PagingOptions()
         options.selectedScrollPosition = .left
@@ -50,6 +50,7 @@ final class PagingControllerTests: XCTestCase {
 
     // MARK: - Content scrolled
 
+    @MainActor
     func testContentScrolledFromSelectedProgressPositive() {
         // Select the first item.
         pagingController.select(pagingItem: Item(index: 3), animated: false)
@@ -81,10 +82,11 @@ final class PagingControllerTests: XCTestCase {
             )),
             .collectionViewLayout(.invalidateLayoutWithContext(
                 invalidateSizes: false
-      )),
+            )),
         ])
     }
 
+    @MainActor
     func testContentScrolledFromSelectedProgressNegative() {
         // Select the first item.
         pagingController.select(pagingItem: Item(index: 3), animated: false)
@@ -116,10 +118,11 @@ final class PagingControllerTests: XCTestCase {
             )),
             .collectionViewLayout(.invalidateLayoutWithContext(
                 invalidateSizes: false
-      )),
+            )),
         ])
     }
 
+    @MainActor
     func testContentOffsetFromSelectedProgressZero() {
         // Select the first item.
         pagingController.select(pagingItem: Item(index: 3), animated: false)
@@ -136,9 +139,10 @@ final class PagingControllerTests: XCTestCase {
         XCTAssertEqual(collectionViewLayout.calls, [])
         XCTAssertEqual(pagingController.state, PagingState.selected(
             pagingItem: Item(index: 3)
-    ))
+        ))
     }
 
+    @MainActor
     func testContentScrolledNoUpcomingPagingItem() {
         // Prevent the data source from returning an upcoming item.
         dataSource.maxIndexAfter = 3
@@ -158,10 +162,11 @@ final class PagingControllerTests: XCTestCase {
         XCTAssertEqual(actions, [
             .collectionViewLayout(.invalidateLayoutWithContext(
                 invalidateSizes: false
-      )),
+            )),
         ])
     }
 
+    @MainActor
     func testContentScrolledSizeDelegate() {
         // Setup the size delegate.
         sizeDelegate = MockPagingControllerSizeDelegate()
@@ -178,9 +183,10 @@ final class PagingControllerTests: XCTestCase {
         let action = collectionViewLayout.calls.last?.action
         XCTAssertEqual(action, .collectionViewLayout(.invalidateLayoutWithContext(
             invalidateSizes: true
-    )))
+        )))
     }
 
+    @MainActor
     func testContentScrolledNoUpcomingPagingItemAndSizeDelegate() {
         // Prevent the data source from returning an upcoming item.
         dataSource.maxIndexAfter = 3
@@ -205,10 +211,11 @@ final class PagingControllerTests: XCTestCase {
         XCTAssertEqual(actions, [
             .collectionViewLayout(.invalidateLayoutWithContext(
                 invalidateSizes: false
-      )),
+            )),
         ])
     }
 
+    @MainActor
     func testContentScrolledUpcomingItemOutsideVisibleItems() {
         // Select the first item, and scroll to the edge of the
         // collection view a few times to make sure the selected
@@ -260,10 +267,11 @@ final class PagingControllerTests: XCTestCase {
             )),
             .collectionViewLayout(.invalidateLayoutWithContext(
                 invalidateSizes: false
-      )),
+            )),
         ])
     }
 
+    @MainActor
     func testContentScrolledProgressChangedFromPositiveToNegative() {
         // Select an item and enter the scrolling state.
         pagingController.select(pagingItem: Item(index: 1), animated: false)
@@ -281,9 +289,10 @@ final class PagingControllerTests: XCTestCase {
         XCTAssertEqual(collectionViewLayout.calls, [])
         XCTAssertEqual(pagingController.state, PagingState.selected(
             pagingItem: Item(index: 1)
-    ))
+        ))
     }
 
+    @MainActor
     func testContentScrolledProgressChangedFromNegativeToPositive() {
         // Select an item and enter the scrolling state.
         pagingController.select(pagingItem: Item(index: 1), animated: false)
@@ -301,9 +310,10 @@ final class PagingControllerTests: XCTestCase {
         XCTAssertEqual(collectionViewLayout.calls, [])
         XCTAssertEqual(pagingController.state, PagingState.selected(
             pagingItem: Item(index: 1)
-    ))
+        ))
     }
 
+    @MainActor
     func testContentScrolledProgressChangedToZero() {
         // Select an item and enter the scrolling state.
         pagingController.select(pagingItem: Item(index: 1), animated: false)
@@ -321,9 +331,10 @@ final class PagingControllerTests: XCTestCase {
         XCTAssertEqual(collectionViewLayout.call
```

---

### Incident Patch 11: `674914fb` (2024-03-13)
**Commit Message**: Fix version name in documentation

**File**: `README.md` (modified, +3/-3)
```diff
@@ -513,23 +513,23 @@ Parchment will be compatible with the lastest public release of Swift.
 Parchment is available through [CocoaPods](https://cocoapods.org). To install it, add the following to your `Podfile`:
 
 ```
-pod 'Parchment', '~> 3.2'
+pod 'Parchment', '~> 3.3'
 ```
 
 ### Swift Package Manager
 
 Parchment is available through [Swift Package Manager](https://swift.org/package-manager/). Add Parchment as a dependency to your `Package.swift`:
 
 ```Swift
-.package(url: "https://github.com/rechsteiner/Parchment", from: "3.2.0")
+.package(url: "https://github.com/rechsteiner/Parchment", from: "3.3.0")
 ```
 
 ### Carthage
 
 Parchment also supports [Carthage](https://github.com/Carthage/Carthage). To install it, add the following to your `Cartfile`:
 
 ```
-github "rechsteiner/Parchment" ~> 3.2
+github "rechsteiner/Parchment" ~> 3.3
 ```
 
 See [this guide](https://github.com/Carthage/Carthage#adding-frameworks-to-an-application) for more details on using Carthage.
```

---

### Incident Patch 12: `2a278d3f` (2024-02-17)
**Commit Message**: #697: Propagate .options modifier on SwiftUI View update

**File**: `Parchment/Classes/PagingViewController.swift` (modified, +1/-1)
```diff
@@ -266,7 +266,7 @@ open class PagingViewController:
 
     /// An instance that stores all the customization so that it's
     /// easier to share between other classes.
-    public private(set) var options: PagingOptions {
+    public internal(set) var options: PagingOptions {
         didSet {
             if options.menuLayoutClass != oldValue.menuLayoutClass {
                 let layout = createLayout(layout: options.menuLayoutClass.self)
```

**File**: `Parchment/Structs/PagingControllerRepresentableView.swift` (modified, +3/-0)
```diff
@@ -46,6 +46,9 @@ struct PagingControllerRepresentableView: UIViewControllerRepresentable {
         if pagingViewController.dataSource == nil {
             pagingViewController.dataSource = context.coordinator
         }
+        
+        pagingViewController.options = options
+        pagingViewController.indicatorClass = PagingHostingIndicatorView.self
 
         pagingViewController.reloadData()
 
```

---

### Incident Patch 13: `279c9355` (2024-02-17)
**Commit Message**: Fix issues with SwiftUI views being reset when updating

The current implementation calls reloadData on each update, which
re-creates the entire content view and resets any state (like
scrolling). To prevent this, we update the existing
UIHostingController if the current page is the same.

This requires us to have stable identifiers, to know if the current
page is the same as before or a new one. For title-based pages, we
just use the title as the identifier. For pages with custom SwiftUI
headers, we default to using the index of the view as the
identifier. This is the same behaviour that we have today, although it
will only work when having static pages. In order to support dynamic
pages with custom SwiftUI headers, we introduce a new initializer that
allows specifying the identifier.

**File**: `ExampleSwiftUI/ExampleApp.swift` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ struct ExampleApp: App {
                         NavigationLink("Change items", destination: ChangeItemsView())
                         NavigationLink("Dynamic items", destination: DynamicItemsView())
                         NavigationLink("Custom indicator", destination: CustomIndicatorView())
+                        NavigationLink("Scrolling Views", destination: ScrollingView())
                     }
                 }
                 .navigationBarTitleDisplayMode(.inline)
```

**File**: `ExampleSwiftUI/ScrollingView.swift` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import Parchment
+import SwiftUI
+import UIKit
+
+struct ScrollingView: View {
+    var body: some View {
+        PageView {
+            Page("First") {
+                ScrollingContentView()
+            }
+            Page("Second") {
+                ScrollingContentView()
+            }
+            Page("Third") {
+                ScrollingContentView()
+            }
+        }
+    }
+}
+
+struct ScrollingContentView: View {
+    var body: some View {
+        List {
+            ForEach(0...50 , id: \.self) { item in
+                NavigationLink(destination: Text("\(item)")) {
+                    Text("\(item)")
+                }
+            }
+        }
+    }
+}
```

**File**: `Parchment.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -47,6 +47,7 @@
 		952D802F1E37CC09003DCB18 /* PagingTransition.swift in Sources */ = {isa = PBXBuildFile; fileRef = 952D802E1E37CC09003DCB18 /* PagingTransition.swift */; };
 		9530E25329DEC2E5004FC88C /* PageContentConfiguration.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9530E25229DEC2E5004FC88C /* PageContentConfiguration.swift */; };
 		953B8D352416C3DC0047BBA1 /* SelfSizingViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 953B8D342416C3DC0047BBA1 /* SelfSizingViewController.swift */; };
+		95428A562B80F6EA00D61143 /* ScrollingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 95428A552B80F6EA00D61143 /* ScrollingView.swift */; };
 		9546B2AB2A1D2F06000390C6 /* PagingHostingIndicatorView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9546B2AA2A1D2F06000390C6 /* PagingHostingIndicatorView.swift */; };
 		9546B2AD2A1D44EF000390C6 /* CustomIndicatorView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9546B2AC2A1D44EF000390C6 /* CustomIndicatorView.swift */; };
 		9546B2AF2A1D4767000390C6 /* PagingIndicatorStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9546B2AE2A1D4767000390C6 /* PagingIndicatorStyle.swift */; };
@@ -269,6 +270,7 @@
 		952D802E1E37CC09003DCB18 /* PagingTransition.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = PagingTransition.swift; sourceTree = "<group>"; };
 		9530E25229DEC2E5004FC88C /* PageContentConfiguration.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PageContentConfiguration.swift; sourceTree = "<group>"; };
 		953B8D342416C3DC0047BBA1 /* SelfSizingViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SelfSizingViewController.swift; sourceTree = "<group>"; };
+		95428A552B80F6EA00D61143 /* ScrollingView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScrollingView.swift; sourceTree = "<group>"; };
 		9546B2AA2A1D2F06000390C6 /* PagingHostingIndicatorView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PagingHostingIndicatorView.swift; sourceTree = "<group>"; };
 		9546B2AC2A1D44EF000390C6 /* CustomIndicatorView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomIndicatorView.swift; sourceTree = "<group>"; };
 		9546B2AE2A1D4767000390C6 /* PagingIndicatorStyle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PagingIndicatorStyle.swift; sourceTree = "<group>"; };
@@ -776,6 +778,7 @@
 				95D2AE51242BCC9500AC3D46 /* ExampleApp.swift */,
 				95D2AE55242BCC9500AC3D46 /* DefaultView.swift */,
 				956FFFCB29BE1FD100477E94 /* ChangeItemsView.swift */,
+				95428A552B80F6EA00D61143 /* ScrollingView.swift */,
 				956FFFD129BE273B00477E94 /* CustomizedView.swift */,
 				95F83D822623804F003B728F /* DynamicItemsView.swift */,
 				956F000929CCFC6C00477E94 /* InterpolatedView.swift */,
@@ -1194,6 +1197,7 @@
 				956FFFD229BE273B00477E94 /* CustomizedView.swift in Sources */,
 				95D2AE52242BCC9500AC3D46 /* ExampleApp.swift in Sources */,
 				956F000A29CCFC6C00477E94 /* InterpolatedView.swift in Sources */,
+				95428A562B80F6EA00D61143 /* ScrollingView.swift in Sources */,
 				956FFFCC29BE1FD100477E94 /* ChangeItemsView.swift in Sources */,
 				95F83D6426237D2B003B728F /* SelectedIndexView.swift in Sources */,
 				95D2AE56242BCC9500AC3D46 /* DefaultView.swift in Sources */,
```

**File**: `Parchment/Classes/PageViewCoordinator.swift` (modified, +29/-7)
```diff
@@ -2,7 +2,16 @@ import UIKit
 
 @available(iOS 14.0, *)
 final class PageViewCoordinator: PagingViewControllerDataSource, PagingViewControllerDelegate {
+    final class WeakReference<T: AnyObject> {
+        weak var value: T?
+
+        init(value: T) {
+            self.value = value
+        }
+    }
+
     var parent: PagingControllerRepresentableView
+    var controllers: [Int: WeakReference<UIViewController>] = [:]
 
     init(_ pagingController: PagingControllerRepresentableView) {
         parent = pagingController
@@ -17,14 +26,14 @@ final class PageViewCoordinator: PagingViewControllerDataSource, PagingViewContr
         viewControllerAt index: Int
     ) -> UIViewController {
         let item = parent.items[index]
-        var hostingViewController: UIViewController
+        let hostingViewController: UIViewController
 
-        if let item = item as? PageItem {
-            hostingViewController = item.page.content()
-        } else if let content = parent.content {
-            hostingViewController = content(item)
+        if let controller = controllers[item.identifier]?.value {
+            hostingViewController = controller
         } else {
-            hostingViewController = UIViewController()
+            let controller = hostingController(for: item)
+            controllers[item.identifier] = WeakReference(value: controller)
+            hostingViewController = controller
         }
 
         let backgroundColor = parent.options.pagingContentBackgroundColor
@@ -52,7 +61,6 @@ final class PageViewCoordinator: PagingViewControllerDataSource, PagingViewContr
         }
 
         parent.onDidScroll?(pagingItem)
-
     }
 
     func pagingViewController(
@@ -70,4 +78,18 @@ final class PageViewCoordinator: PagingViewControllerDataSource, PagingViewContr
     ) {
         parent.onDidSelect?(pagingItem)
     }
+
+    private func hostingController(for pagingItem: PagingItem) -> UIViewController {
+        var hostingViewController: UIViewController
+        if let item = pagingItem as? PageItem {
+            hostingViewController = item.page.content()
+        } else {
+            assertionFailure("""
+            PageItem is required when using the SwiftUI wrappers.
+            Please report if you somehow ended up here.
+            """)
+            hostingViewController = UIViewController()
+        }
+        return hostingViewController
+    }
 }
```

**File**: `Parchment/Structs/Page.swift` (modified, +73/-0)
```diff
@@ -27,8 +27,10 @@ import SwiftUI
 @available(iOS 14.0, *)
 public struct Page {
     let reuseIdentifier: String
+    let pageIdentifier: String?
     let header: (PagingOptions, PageState) -> UIContentConfiguration
     let content: () -> UIViewController
+    let update: (UIViewController) -> Void
 
     /// Creates a new page with the given header and content views.
     ///
@@ -49,6 +51,61 @@ public struct Page {
         let content = content()
 
         self.reuseIdentifier = "CellIdentifier-\(String(describing: Header.self))"
+        self.pageIdentifier = nil
+
+        self.header = { options, state in
+            if #available(iOS 16.0, *) {
+                return UIHostingConfiguration {
+                    PageCustomView(
+                        content: header(state),
+                        options: options,
+                        state: state
+                    )
+                }
+                .margins(.all, 0)
+            } else {
+                return PageContentConfiguration {
+                    PageCustomView(
+                        content: header(state),
+                        options: options,
+                        state: state
+                    )
+                }
+                .margins(.all, 0)
+            }
+        }
+        self.content = {
+            UIHostingController(rootView: content)
+        }
+        self.update = { viewController in
+            let hostingController = viewController as! UIHostingController<Content>
+            hostingController.rootView = content
+        }
+    }
+
+    /// Creates a new page with the given header and content views.
+    ///
+    /// - Parameters:   
+    ///   - id: A unique identifier for this page.
+    ///   - header: A closure that takes a `PageState` instance as
+    ///     input and returns a `View` that represents the header view
+    ///     for the page. The `PageState` instance will be updated as
+    ///     the page is scrolled, allowing the header view to adjust
+    ///     its appearance accordingly.
+    ///   - content: A closure that returns a `View` that represents
+    ///     the content view for the page.
+    ///
+    ///    - Returns: A new `Page` instance with the given header and content views.
+    public init<Header: View, Content: View, Id: LosslessStringConvertible>(
+        id: Id,
+        @ViewBuilder header: @escaping (PageState) -> Header,
+        @ViewBuilder content: () -> Content
+    ) {
+        let content = content()
+
+        self.reuseIdentifier = "CellIdentifier-\(String(describing: Header.self))"
+        self.pageIdentifier = id.description
+
         self.header = { options, state in
             if #available(iOS 16.0, *) {
                 return UIHostingConfiguration {
@@ -73,6 +130,10 @@ public struct Page {
         self.content = {
             UIHostingController(rootView: content)
         }
+        self.update = { viewController in
+            let hostingController = viewController as! UIHostingController<Content>
+            hostingController.rootView = content
+        }
     }
 
     /// Creates a new page with the given localized title and content views.
@@ -92,6 +153,8 @@ public struct Page {
         let content = content()
 
         self.reuseIdentifier = "CellIdentifier-PageTitleView"
+        self.pageIdentifier = "PageIdentifier-\(titleKey)"
+
         self.header = { options, state in
             if #available(iOS 16.0, *) {
                 return UIHostingConfiguration {
@@ -118,6 +181,10 @@ public struct Page {
         self.content = {
             UIHostingController(rootView: content)
         }
+        self.update = { viewController in
+            let hostingController = viewController as! UIHostingController<Content>
+            hostingController.rootView = content
+        }
     }
 
     /// Creates a new page with the given title and content views.
@@ -137,6 +204,8 @@ public struct Page {
         let content = content()
 
         self.reuseIdentifier = "CellIdentifier-PageTitleView"
+        self.pageIdentifier = "PageIdentifier-\(title)"
+
         self.header = { options, state in
             if #available(iOS 16.0, *) {
                 return UIHostingConfiguration {
@@ -163,6 +232,10 @@ public struct Page {
         self.content = {
             UIHostingController(rootView: content)
         }
+        self.update = { viewController in
+            let hostingController = viewController as! UIHostingController<Content>
+            hostingController.rootView = content
+        }
     }
 }
 
```

**File**: `Parchment/Structs/PageView.swift` (modified, +1/-2)
```diff
@@ -72,9 +72,8 @@ public struct PageView: View {
         self.items = content()
             .enumerated()
             .map { (index, page) in
-                // TODO: What should we use as the identifier?
                 PageItem(
-                    identifier: index,
+                    identifier: page.pageIdentifier?.hashValue ?? index,
                     index: index,
                     page: page
                 )
```

**File**: `Parchment/Structs/PagingControllerRepresentableView.swift` (modified, +25/-1)
```diff
@@ -41,13 +41,37 @@ struct PagingControllerRepresentableView: UIViewControllerRepresentable {
         _ pagingViewController: PagingViewController,
         context: UIViewControllerRepresentableContext<PagingControllerRepresentableView>
     ) {
+        var oldItems: [Int: PagingItem] = [:]
+
+        for oldItem in context.coordinator.parent.items {
+            if let oldItem = oldItem as? PageItem {
+                oldItems[oldItem.identifier] = oldItem
+            }
+        }
+
         context.coordinator.parent = self
 
         if pagingViewController.dataSource == nil {
             pagingViewController.dataSource = context.coordinator
         }
 
-        pagingViewController.reloadData()
+        // We only want to reload the content views when the items have actually
+        // changed. For items that are added, a new view controller instance will
+        // be created by the PageViewCoordinator.
+        if let currentItem = pagingViewController.state.currentPagingItem,
+           let pageItem = currentItem as? PageItem,
+            let oldItem = oldItems[pageItem.identifier] {
+            pagingViewController.reloadMenu()
+            
+            if !oldItem.isEqual(to: currentItem) {
+                if let pageItem = currentItem as? PageItem,
+                   let viewController = context.coordinator.controllers[currentItem.identifier]?.value {
+                    pageItem.page.update(viewController)
+                }
+            }
+        } else {
+            pagingViewController.reloadData()
+        }
 
         // HACK: If the user don't pass a selectedIndex binding, the
         // default parameter is set to .constant(Int.max) which allows
```

---

### Incident Patch 14: `ecbfc1a2` (2024-02-17)
**Commit Message**: Set fixed size modifier on custom header views

**File**: `Parchment/Structs/Page.swift` (modified, +2/-1)
```diff
@@ -174,6 +174,7 @@ struct PageCustomView<Content: View>: View {
 
     var body: some View {
         content
+            .fixedSize(horizontal: true, vertical: false)
             .foregroundColor(Color(UIColor.interpolate(
                 from: options.textColor,
                 to: options.selectedTextColor,
@@ -190,7 +191,7 @@ struct PageTitleView: View {
 
     var body: some View {
         content
-            .fixedSize()
+            .fixedSize(horizontal: true, vertical: false)
             .foregroundColor(Color(UIColor.interpolate(
                 from: options.textColor,
                 to: options.selectedTextColor,
```

---

### Incident Patch 15: `9f0b8671` (2024-02-17)
**Commit Message**: Merge pull request #696 from rono23/fix-readme

Fix README

**File**: `README.md` (modified, +0/-1)
```diff
@@ -46,7 +46,6 @@ Parchment lets you page between view controllers while showing any type of gener
   - [Reloading data](#reloading-data)
   - [Delegate](#delegate)
   - [Size delegate](#size-delegate)
-  - [Selecting items](#selecting-items)
 - [Customization](#customization)
 - [Installation](#installation)
 - [Changelog](#changelog)
```

#### Recent Merged Pull Requests:
- **PR #733** (2024-09-29): Release v4.1.0 (@rechsteiner)
- **PR #731** (2024-09-17): Update build server to Xcode 16 (@rechsteiner)
- **PR #725** (2024-08-14): Fix build error for Swift 6 (@kitwtnb)
- **PR #724** (2024-08-10): Fix spellchecking errors (@rechsteiner)
- **PR #723** (2024-09-16): Enable Swift 6 mode (@rechsteiner)
- **PR #722** (2024-08-10): Fix Swift concurrency (@kitwtnb)
- **PR #715** (2024-05-25): Release v4.0.0 (@rechsteiner)
- **PR #714** (2024-05-24): Fix failing CI pipelines  (@rechsteiner)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
