# Forensic Learning Record (Deep Inspection): SwiftKickMobile/SwiftMessages

> **Canonical Artifact**: `07_PROJECT_LEARNING/swiftkickmobile-swiftmessages-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SwiftKickMobile/SwiftMessages](https://github.com/SwiftKickMobile/SwiftMessages))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:26:52.091Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SwiftKickMobile/SwiftMessages`
- **Description**: A very flexible message bar for UIKit and SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7548 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Demo/Demo/Utils.swift`
```
//
//  Utils.swift
//  Demo
//
//  Created by Timothy Moose on 8/25/17.
//  Copyright © 2017 SwiftKick Mobile. All rights reserved.
//

import UIKit

extension UILabel {

    func configureBodyTextStyle() {
        let bodyStyle = NSMutableParagraphStyle()
        bodyStyle.lineSpacing = 5.0
        attributedText = NSAttributedString(string: text ?? "", attributes: [NSAttributedString.Key.paragraphStyle : bodyStyle])
    }

    func configureCodeStyle(on substring: String?) {
        var attributes: [NSAttributedString.Key : Any] = [:]
        let codeFont = UIFont(name: "CourierNewPSMT", size: font.pointSize)!
        attributes[NSAttributedString.Key.font] = codeFont
        attributes[NSAttributedString.Key.backgroundColor] = UIColor(white: 0.96, alpha: 1)
        attributedText = attributedText?.setAttributes(attributes: attributes, onSubstring: substring)
    }
}

extension NSAttributedString {

    public func setAttributes(attributes: [NSAttributedString.Key : Any], onSubstring substring: String?) -> NSAttributedString {
        let mutableSelf = NSMutableAttributedString(attributedString: self)
        if let substring = substring {
            var range = NSRange()
            repeat {
                let length = mutableSelf.length
                let start = range.location + range.length
                let remainingLength = length - start
                let remainingRange = NSRange(location: start, length: remainingLength)
                range = (mutableSelf.string as NSString).range(of: substring, options: .caseInsensitive, range: remainingRange)
                NSAttributedString.set(attributes: attributes, in: range, of: mutableSelf)
            } while range.length > 0
        } else {
            let range = NSRange(location: 0, length: mutableSelf.length)
            NSAttributedString.set(attributes: attributes, in: range, of: mutableSelf)
        }
        return mutableSelf
    }

    private static func set(attributes newAttributes: [NSAttributedString.Key : Any], in range: NSRange, of mutableString: NSMutableAttributedString) {
        if range.length > 0 {
            var attributes = mutableString.attributes(at: range.location, effectiveRange: nil)
            for (key, value) in newAttributes {
                attributes.updateValue(value, forKey: key)
            }
            mutableString.setAttributes(attributes, range: range)
        }
    }
}

```

### Core Architecture Module: `Demo/Demo/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  Demo
//
//  Created by Tim Moose on 8/11/16.
//  Copyright © 2016 SwiftKick Mobile. All rights reserved.
//

import UIKit

let brandColor = UIColor(red: 42/255.0, green: 168/255.0, blue: 250/255.0, alpha: 1)

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        window?.tintColor = brandColor
        UISwitch.appearance().onTintColor = brandColor
        return true
    }
}


```

### Core Architecture Module: `Demo/Demo/CountedMessageView.swift`
```
//
//  CountedMessageView.swift
//  Demo
//
//  Created by Timothy Moose on 8/25/17.
//  Copyright © 2017 SwiftKick Mobile. All rights reserved.
//

import UIKit
import SwiftMessages

class CountedMessageView: UIView, Identifiable {

    @IBOutlet weak var countLabel: UILabel!

    var id: String {
        return "counted"
    }
}

```

### Core Architecture Module: `Demo/Demo/CountedViewController.swift`
```
//
//  CountedViewController.swift
//  Demo
//
//  Created by Timothy Moose on 8/25/17.
//  Copyright © 2017 SwiftKick Mobile. All rights reserved.
//

import UIKit
import SwiftMessages

class CountedViewController: UIViewController {

    @IBOutlet weak var descriptionLabel: UILabel!
    @IBOutlet var messageView: CountedMessageView!
    @IBOutlet weak var messageContainer: UIView!

    override func viewDidLoad() {
        super.viewDidLoad()
        descriptionLabel.configureBodyTextStyle()
        descriptionLabel.configureCodeStyle(on: "show()")
        descriptionLabel.configureCodeStyle(on: "hideCounted(id:)")
    }

    @IBAction func show() {
        var config = SwiftMessages.defaultConfig
        config.presentationStyle = .center
        config.duration = .forever
        config.presentationContext = .view(messageContainer)
        SwiftMessages.show(config: config, view: messageView)
        updateCountLabel()
    }

    @IBAction func hide() {
        SwiftMessages.hideCounted(id: messageView.id)
        updateCountLabel()
    }

    private func updateCountLabel() {
        let count = SwiftMessages.count(id: messageView.id)
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .spellOut
        messageView.countLabel.text = numberFormatter.string(from: NSNumber(value: count))?.uppercased()
    }
}

```

### Core Architecture Module: `Demo/Demo/ExploreViewController.swift`
```
//
//  ExploreViewController.swift
//  Demo
//
//  Created by Tim Moose on 8/13/16.
//  Copyright © 2016 SwiftKick Mobile. All rights reserved.
//

import UIKit
import SwiftMessages

class ExploreViewController: UITableViewController, UITextFieldDelegate {

    @IBAction func show(_ sender: AnyObject) {
        
        // View setup
        
        let view: MessageView
        switch layout.selectedSegmentIndex {
        case 1:
            view = MessageView.viewFromNib(layout: .cardView)
        case 2:
            view = MessageView.viewFromNib(layout: .tabView)
        case 3:
            view = MessageView.viewFromNib(layout: .statusLine)
        default:
            view = try! SwiftMessages.viewFromNib()
        }
        
        view.configureContent(title: titleText.text, body: bodyText.text, iconImage: nil, iconText: nil, buttonImage: nil, buttonTitle: "Hide", buttonTapHandler: { _ in SwiftMessages.hide() })

        let iconStyle: IconStyle
        switch self.iconStyle.selectedSegmentIndex {
        case 1:
            iconStyle = .light
        case 2:
            iconStyle = .subtle
        default:
            iconStyle = .default
        }
        
        switch theme.selectedSegmentIndex {
        case 0:
            view.configureTheme(.info, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
            view.accessibilityPrefix = "info"
        case 1:
            view.configureTheme(.success, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
            view.accessibilityPrefix = "success"
        case 2:
            view.configureTheme(.warning, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
            view.accessibilityPrefix = "warning"
        case 3:
            view.configureTheme(.error, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
            view.accessibilityPrefix = "error"
        default:
            let iconText = ["🐸", "🐷", "🐬", "🐠", "🐍", "🐹", "🐼"].randomElement()
            view.configureTheme(backgroundColor: UIColor.purple, foregroundColor: UIColor.white, iconImage: nil, iconText: iconText)
            view.button?.setImage(Icon.errorSubtle.image, for: .normal)
            view.button?.setTitle(nil, for: .normal)
            view.button?.backgroundColor = UIColor.clear
            view.button?.tintColor = UIColor.green.withAlphaComponent(0.7)
        }
        
        if dropShadow.isOn {
            view.configureDropShadow()
        }
        
        if !showButton.isOn {
            view.button?.isHidden = true
        }
        
        if !showIcon.isOn {
            view.iconImageView?.isHidden = true
            view.iconLabel?.isHidden = true
        }
        
        if !showTitle.isOn {
            view.titleLabel?.isHidden = true
        }
        
        if !showBody.isOn {
            view.bodyLabel?.isHidden = true
        }
        
        // Config setup
        
        var config = SwiftMessages.defaultConfig
        
        switch presentationStyle.selectedSegmentIndex {
        case 1:
            config.presentationStyle = .bottom
        case 2:
            config.presentationStyle = .center
        default:
            break
        }
        
        switch presentationContext.selectedSegmentIndex {
        case 1:
            config.presentationContext = .window(windowLevel: UIWindow.Level.normal)
        case 2:
            config.presentationContext = .window(windowLevel: UIWindow.Level.statusBar)
        default:
            break
        }
        
        switch duration.selectedSegmentIndex {
        case 1:
            config.duration = .forever
        case 2:
            config.duration = .seconds(seconds: 1)
        case 3:
            config.duration = .seconds(seconds: 5)
        default:
            break
        }
        
        switch dimMode.selectedSegmentIndex {
        case 1:
            config.dimMode = .gray(interactive: true)
        case 2:
            config.dimMode = .color(color: #colorLiteral(red: 0.1019607857, green: 0.2784313858, blue: 0.400000006, alpha: 0.7477525685), interactive: true)
        case 3:
            config.dimMode = .blur(style: .dark, alpha: 1.0, interactive: true)
        default:
            break
        }

        config.shouldAutorotate = self.autoRotate.isOn
        
        config.interactiveHide = interactiveHide.isOn
        
        // Set status bar style unless using card view (since it doesn't
        // go behind the status bar).
        if case .top = config.presentationStyle, layout.selectedSegmentIndex != 1 {
            switch theme.selectedSegmentIndex {
            case 1...4:
                config.preferredStatusBarStyle = .lightContent
            default:
                break
            }
        }

        if view.defaultHaptic == nil && hapticFeedback.isOn {
            config.haptic = .success
        }

        // Show
        SwiftMessages.show(config: config, view: view)
    }
    
    @IBAction func hide(_ sender: AnyObject) {
        SwiftMessages.hide()
    }

    @IBOutlet weak var presentationStyle: UISegmentedControl!
    @IBOutlet weak var presentationContext: UISegmentedControl!
    @IBOutlet weak var duration: UISegmentedControl!
    @IBOutlet weak var dimMode: UISegmentedControl!
    @IBOutlet weak var interactiveHide: UISwitch!
    @IBOutlet weak var hapticFeedback: UISwitch!
    @IBOutlet weak var layout: UISegmentedControl!
    @IBOutlet weak var theme: UISegmentedControl!
    @IBOutlet weak var iconStyle: UISegmentedControl!
    @IBOutlet weak var autoRotate: UISwitch!
    @IBOutlet weak var dropShadow: UISwitch!
    @IBOutlet weak var titleText: UITextField!
    @IBOutlet weak var bodyText: UITextField!
    @IBOutlet weak var showButton: UISwitch!
    @IBOutlet weak var showIcon: UISwitch!
    @IBOutlet weak var showTitle: UISwitch!
    @IBOutlet weak var showBody: UISwitch!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        titleText.delegate = self
        bodyText.delegate = self
    }
    
    /*
     MARK: - UITextFieldDelegate
     */
    
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
    
    func textFieldShouldEndEditing(_ textField: UITextField) -> Bool {
        return true
    }
}

```

### Core Architecture Module: `Demo/Demo/TacoDialogView.swift`
```
//
//  TacoDialogView.swift
//  Demo
//
//  Created by Tim Moose on 8/12/16.
//  Copyright © 2016 SwiftKick Mobile. All rights reserved.
//

import UIKit
import SwiftMessages

class TacoDialogView: MessageView {

    fileprivate static var tacoTitles = [
        1 : "Just one, Please",
        2 : "Make it two!",
        3 : "Three!!!",
        4 : "Cuatro!!!!",
    ]

    var getTacosAction: ((_ count: Int) -> Void)?
    var cancelAction: (() -> Void)?
    
    fileprivate var count = 1 {
        didSet {
            iconLabel?.text = String(repeating: "🌮", count: count)//String(count: count, repeatedValue: )
            bodyLabel?.text = TacoDialogView.tacoTitles[count] ?? "\(count)" + String(repeating: "!", count: count)
        }
    }
    
    @IBAction func getTacos() {
        getTacosAction?(Int(tacoSlider.value))
    }

    @IBAction func cancel() {
        cancelAction?()
    }
    
    @IBOutlet weak var tacoSlider: UISlider!
    
    @IBAction func tacoSliderSlid(_ slider: UISlider) {
        count = Int(slider.value)
    }
    
    @IBAction func tacoSliderFinished(_ slider: UISlider) {
        slider.setValue(Float(count), animated: true)
    }
}

```

### Core Architecture Module: `Demo/Demo/ViewController.swift`
```
//
//  ViewController.swift
//  Demo
//
//  Created by Tim Moose on 8/11/16.
//  Copyright © 2016 SwiftKick Mobile. All rights reserved.
//

import UIKit
import SwiftMessages

class ViewController: UITableViewController {

    var items: [Item] = [
        .titleBody(title: "MESSAGE VIEW", body: "SwiftMessages provides a standard message view along with a number of layouts, themes and presentation options.", function: ViewController.demoBasics),
        .titleBody(title: "ANY VIEW", body: "Any view, no matter how cute, can be displayed as a message.", function: ViewController.demoAnyView),
        .titleBody(title: "CUSTOMIZE", body: "Easily customize by copying one of the SwiftMessages nib files into your project as a starting point. Then order some tacos.", function: ViewController.demoCustomNib),
        .explore,
        .titleBody(title: "CENTERED", body: "Show cenetered messages with a fun, physics-based dismissal gesture.", function: ViewController.demoCentered),
        .viewController,
        //.counted,
    ]

    /*
     MARK: - UITableViewDataSource
     */
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return items.count
    }
    
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let item = items[(indexPath as NSIndexPath).row]
        return item.dequeueCell(tableView)
    }
    
    /*
     MARK: - UITableViewDelegate
     */

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let item = items[(indexPath as NSIndexPath).row]
        item.performDemo()
    }
    
    override func tableView(_ tableView: UITableView, estimatedHeightForRowAt indexPath: IndexPath) -> CGFloat {
        return 50.0
    }
    
    override func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return UITableView.automaticDimension
    }
    
    /*
     MARK: - Demos
     */

    static func demoBasics() -> Void {
        
        let error = MessageView.viewFromNib(layout: .tabView)
        error.configureTheme(.error)
        error.configureContent(title: "Error", body: "Something is horribly wrong!")
        error.button?.setTitle("Stop", for: .normal)
        
        let warning = MessageView.viewFromNib(layout: .cardView)
        warning.configureTheme(.warning)
        warning.configureDropShadow()
        
        let iconText = ["🤔", "😳", "🙄", "😶"].randomElement()!
        warning.configureContent(title: "Warning", body: "Consider yourself warned.", iconText: iconText)
        warning.button?.isHidden = true
        var warningConfig = SwiftMessages.defaultConfig
        warningConfig.presentationContext = .window(windowLevel: UIWindow.Level.statusBar)

        let success = MessageView.viewFromNib(layout: .cardView)
        success.configureTheme(.success)
        success.configureDropShadow()
        success.configureContent(title: "Success", body: "Something good happened!")
        success.button?.isHidden = true
        var successConfig = SwiftMessages.defaultConfig
        successConfig.presentationStyle = .center
        successConfig.presentationContext = .window(windowLevel: UIWindow.Level.normal)

        let info = MessageView.viewFromNib(layout: .messageView)
        info.configureTheme(.info)
        info.button?.isHidden = true
        info.configureContent(title: "Info", body: "This is a very lengthy and informative info message that wraps across multiple lines and grows in height as needed.")
        var infoConfig = SwiftMessages.defaultConfig
        infoConfig.presentationStyle = .bottom
        infoConfig.duration = .seconds(seconds: 0.25)

        let status = MessageView.viewFromNib(layout: .statusLine)
        status.backgroundView.backgroundColor = UIColor.purple
        status.bodyLabel?.textColor = UIColor.white
        status.configureContent(body: "A tiny line of text covering the status bar.")
        var statusConfig = SwiftMessages.defaultConfig
        statusConfig.presentationContext = .window(windowLevel: UIWindow.Level.statusBar)

        let status2 = MessageView.viewFromNib(layout: .statusLine)
        status2.backgroundView.backgroundColor = UIColor.orange
        status2.bodyLabel?.textColor = UIColor.white
        status2.configureContent(body: "Switched to light status bar!")
        var status2Config = SwiftMessages.defaultConfig
        status2Config.presentationContext = .window(windowLevel: UIWindow.Level.normal)
        status2Config.preferredStatusBarStyle = .lightContent

        SwiftMessages.show(view: error)
        SwiftMessages.show(config: warningConfig, view: warning)
        SwiftMessages.show(config: successConfig, view: success)
        SwiftMessages.show(config: infoConfig, view: info)
        SwiftMessages.show(config: statusConfig, view: status)
        SwiftMessages.show(config: status2Config, view: status2)
    }
    
    static func demoAnyView() -> Void {
        let imageView = UIImageView()
        imageView.image = UIImage(named: "puppies")
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        let messageView = BaseView(frame: .zero)
        messageView.layoutMargins = .zero
        messageView.backgroundHeight = 120.0
        do {
            let backgroundView = CornerRoundingView()
            backgroundView.cornerRadius = 15
            backgroundView.layer.masksToBounds = true
            messageView.installBackgroundView(backgroundView)
            messageView.installContentView(imageView)
            messageView.layoutMarginAdditions = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        }
        messageView.configureDropShadow()
        var config = SwiftMessages.defaultConfig
        config.presentationContext = .window(windowLevel: UIWindow.Level.statusBar)
        SwiftMessages.show(config: config, view: messageView)
    }

    static func demoCustomNib() {
        let view: TacoDialogView = try! SwiftMessages.viewFromNib()
        view.configureDropShadow()
        view.getTacosAction = { _ in SwiftMessages.hide() }
        view.cancelAction = { SwiftMessages.hide() }
        var config = SwiftMessages.defaultConfig
        config.presentationContext = .window(windowLevel: UIWindow.Level.statusBar)
        config.duration = .forever
        config.presentationStyle = .bottom
        config.dimMode = .gray(interactive: true)
        SwiftMessages.show(config: config, view: view)
    }

    static func demoCentered() {
        let messageView: MessageView = MessageView.viewFromNib(layout: .centeredView)
        messageView.configureBackgroundView(width: 250)
        messageView.configureContent(title: "Hey There!", body: "Please try swiping to dismiss this message.", iconImage: nil, iconText: "🦄", buttonImage: nil, buttonTitle: "No Thanks") { _ in
            SwiftMessages.hide()
        }
        messageView.backgroundView.backgroundColor = UIColor.init(white: 0.97, alpha: 1)
        messageView.backgroundView.layer.cornerRadius = 10
        var config = SwiftMessages.defaultConfig
        config.presentationStyle = .center
        config.duration = .forever
        config.dimMode = .blur(style: .dark, alpha: 1, interactive: true)
        config.presentationContext  = .window(windowLevel: UIWindow.Level.statusBar)
        SwiftMessages.show(config: config, view: messageView)
    }
}

typealias Function = () -> Void

enum Item {
    
    case titleBody(title: String, body: String, function: Function)
    case explore
    case counted
    case viewController

    func dequeueCell(_ tableView: UITableView) -> UITableViewCell {
        switch self {
        case .titleBody(let title, let body, _):
            let cell = tableView.dequeueReusableCell(withIdentifier: "TitleBody") as! TitleBodyCell
            cell.titleLabel.text = title
            cell.bodyLabel.text = body
            cell.configureBodyTextStyle()
            return cell
        case .explore:
            let cell = tableView.dequeueReusableCell(withIdentifier: "Explore") as! TitleBodyCell
            cell.configureBodyTextStyle()
            return cell
        case .counted:
            let cell = tableView.dequeueReusableCell(withIdentifier: "Counted") as! TitleBodyCell
            cell.configureBodyTextStyle()
            cell.bodyLabel.configureCodeStyle(on: "show()")
            cell.bodyLabel.configureCodeStyle(on: "hideCounted(id:)")
            return cell
        case .viewController:
            let cell = tableView.dequeueReusableCell(withIdentifier: "ViewController") as! TitleBodyCell
            cell.configureBodyTextStyle()
            return cell
        }
    }
    
    func performDemo() {
        switch self {
        case .titleBody(_, _, let function):
            function()
        default:
            break
        }
    }
}

class TitleBodyCell: UITableViewCell {
    @IBOutlet var titleLabel: UILabel!
    @IBOutlet var bodyLabel: UILabel!
    
    func configureBodyTextStyle() {
        let bodyStyle = NSMutableParagraphStyle()
        bodyStyle.lineSpacing = 5.0
        bodyLabel.configureBodyTextStyle()
    }
}

```

### Core Architecture Module: `Demo/Demo/ViewControllersViewController.swift`
```
//
//  ViewControllersViewController.swift
//  Demo
//
//  Created by Timothy Moose on 7/28/18.
//  Copyright © 2018 SwiftKick Mobile. All rights reserved.
//

import UIKit
import SwiftMessages

class ViewControllersViewController: UIViewController {
    @objc @IBAction private func dismissPresented(segue: UIStoryboardSegue) {
        dismiss(animated: true, completion: nil)
    }
}

class SwiftMessagesTopSegue: SwiftMessagesSegue {
    override public  init(identifier: String?, source: UIViewController, destination: UIViewController) {
        super.init(identifier: identifier, source: source, destination: destination)
        configure(layout: .topMessage)
    }
}

class SwiftMessagesTopCardSegue: SwiftMessagesSegue {
    override public  init(identifier: String?, source: UIViewController, destination: UIViewController) {
        super.init(identifier: identifier, source: source, destination: destination)
        configure(layout: .topCard)
    }
}

class SwiftMessagesTopTabSegue: SwiftMessagesSegue {
    override public  init(identifier: String?, source: UIViewController, destination: UIViewController) {
        super.init(identifier: identifier, source: source, destination: destination)
        configure(layout: .topTab)
    }
}

class SwiftMessagesBottomSegue: SwiftMessagesSegue {
    override public  init(identifier: String?, source: UIViewController, destination: UIViewController) {
        super.init(identifier: identifier, source: source, destination: destination)
        configure(layout: .bottomMessage)
    }
}

class SwiftMessagesBottomCardSegue: SwiftMessagesSegue {
    override public  init(identifier: String?, source: UIViewController, destination: UIViewController) {
        super.init(identifier: identifier, source: source, destination: destination)
        configure(layout: .bottomCard)
    }
}

class SwiftMessagesBottomTabSegue: SwiftMessagesSegue {
    override public  init(identifier: String?, source: UIViewController, destination: UIViewController) {
        super.init(identifier: identifier, source: source, destination: destination)
        configure(layout: .bottomTab)
    }
}

class SwiftMessagesCenteredSegue: SwiftMessagesSegue {
    override public  init(identifier: String?, source: UIViewController, destination: UIViewController) {
        super.init(identifier: identifier, source: source, destination: destination)
        configure(layout: .centered)
    }
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "SwiftMessages",
    platforms: [
        .iOS("13.0")
    ],
    products: [
        .library(name: "SwiftMessages", targets: ["SwiftMessages"]),
        .library(name: "SwiftMessages-Dynamic", type: .dynamic, targets: ["SwiftMessages"])
    ],
    targets: [
        .target(
            name: "SwiftMessages",
            path: "SwiftMessages",
            exclude: [
                "Info.plist",
            ],
            resources: [.process("Resources")]
        )
    ]
)

```

### Core Architecture Module: `SwiftMessages/AccessibleMessage.swift`
```
//
//  AccessibleMessage.swift
//  SwiftMessages
//
//  Created by Timothy Moose on 3/11/17.
//  Copyright © 2017 SwiftKick Mobile. All rights reserved.
//

import Foundation

/**
 Message views that conform to `AccessibleMessage` will have proper accessibility behavior when displaying messages.
 `MessageView` implements this protocol.
 */
public protocol AccessibleMessage {
    var accessibilityMessage: String? { get }
    var accessibilityElement: NSObject? { get }
    var additionalAccessibilityElements: [NSObject]? { get }
}

```

### Core Architecture Module: `SwiftMessages/Animator.swift`
```
//
//  Animator.swift
//  SwiftMessages
//
//  Created by Timothy Moose on 6/4/17.
//  Copyright © 2017 SwiftKick Mobile. All rights reserved.
//

import UIKit

public typealias AnimationCompletion = (_ completed: Bool) -> Void

@MainActor
public protocol AnimationDelegate: AnyObject {
    func hide(animator: Animator)
    func panStarted(animator: Animator)
    func panEnded(animator: Animator)
}

/**
 An option set representing the known types of safe area conflicts
 that could require margin adjustments on the message view in order to
 get the layouts to look right.
 */
public struct SafeZoneConflicts: OptionSet {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    /// Message view behind status bar
    public static let statusBar = SafeZoneConflicts(rawValue: 1 << 0)

    /// Message view behind the sensor notch on iPhone X
    public static let sensorNotch = SafeZoneConflicts(rawValue: 1 << 1)

    /// Message view behind home indicator on iPhone X
    public static let homeIndicator = SafeZoneConflicts(rawValue: 1 << 2)

    /// Message view is over the status bar on an iPhone 8 or lower. This is a special
    /// case because we logically expect the top safe area to be zero, but it is reported as 20
    /// (which seems like an iOS bug). We use the `overStatusBar` to indicate this special case.
    public static let overStatusBar = SafeZoneConflicts(rawValue: 1 << 3)
}

public class AnimationContext {

    public let messageView: UIView
    public let containerView: UIView
    public let safeZoneConflicts: SafeZoneConflicts
    public let interactiveHide: Bool

    init(messageView: UIView, containerView: UIView, safeZoneConflicts: SafeZoneConflicts, interactiveHide: Bool) {
        self.messageView = messageView
        self.containerView = containerView
        self.safeZoneConflicts = safeZoneConflicts
        self.interactiveHide = interactiveHide
    }
}

@MainActor
public protocol Animator: AnyObject {

    /// Adopting classes should declare as `weak`.
    var delegate: AnimationDelegate? { get set }

    func show(context: AnimationContext, completion: @escaping AnimationCompletion)

    func hide(context: AnimationContext, completion: @escaping AnimationCompletion)

    /// The show animation duration. If the animation duration is unknown, such as if using `UIDynamicAnimator`,
    /// then provide an estimate. This value is used by `SwiftMessagesSegue`.
    var showDuration: TimeInterval { get }

    /// The hide animation duration. If the animation duration is unknown, such as if using `UIDynamicAnimator`,
    /// then provide an estimate. This value is used by `SwiftMessagesSegue`.
    var hideDuration: TimeInterval { get }
}


```

### Core Architecture Module: `SwiftMessages/BackgroundViewable.swift`
```
//
//  BackgroundViewable.swift
//  SwiftMessages
//
//  Created by Timothy Moose on 8/15/16.
//  Copyright © 2016 SwiftKick Mobile LLC. All rights reserved.
//

import UIKit

/**
 Message views that implement the `BackgroundViewable` protocol will have the
 pan-to-hide gesture recognizer installed in the `backgroundView`. Message views
 always span the full width of the containing view. Typically, the `backgroundView`
 property defines the message view's visible region, allowing for card-style views
 where the message view background is transparent and the background view is inset
 from by some amount. See CardView.nib, for example.
 
 This protocol is optional. Message views that don't implement `BackgroundViewable`
 will have the pan-to-hide gesture installed in the message view itself.
 */
public protocol BackgroundViewable {
    var backgroundView: UIView! { get }
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #567** (2025-08-11): **Crash on iPadOS 18.0+ using presentationstyle = .bottom**
  *Symptoms*: Due to the changes made to UITabbar in ipadOS 18.0+, SwiftMessages is crashing when trying to set the constraints for the bottom view. I believe this is an issue specifically with the function `bottomLayoutConstraint(view:, containerView:, viewController:)` in Presenter.swift. The specific crash is because we are trying to attach an anchor to the top of the tabBar which no longer exists on ipadOS 18+. I think it should check if there is a tabBar top constraint before trying to attach the view. ![image](https://github.com/user-attachments/assets/5acbc512-b451-480c-b57f-a85dbe91e846) 
  **Post-Mortem & Fix Analysis**:
  > See the same issue at my end. In the interim what could potentially solve the issue is setting the context to `window`.   When the context is`Automatic` or `ViewController` and the `presentationStyle` is set to `.bottom`,I feel it tries to locate a `TabBar` to attach to and since one does exist, it tries to use the bottom constraint, which would traditionally work but probably doesn't exist in iPadOS 18 as it floats at the top which causes the crash.  So this temporarily seems to solve it for me:  ``` var config = SwiftMessages.Config() config.presentationContext = .window(windowLevel: .normal) ```
  > 10.0.2  Sorry for not formally releasing this sooner.

- **Issue #467** (2021-06-29): **Lower or equal level window's views disappear upon hide **
  *Symptoms*: Hello!  First of all, my team and I are really overwhelmed by your library and would like to give a sincere word of appreciation. However, we have come across a bizarre situation as mentioned in the title of the issue.  To give a more concise and sufficient context, I will provide an example below.  Assuming we have two different instances of the SwiftMessages class  let a = SwiftMessages() let b = SwiftMessages()  the reproduced cases are as follows  1. (a) shows a view with a presentationContext of .window(.normal) and (b) also shows a view with a presentationContext of .window(.normal). When (a) is hidden via a.hide(), both (a) AND (b) disappear. (Possible Error?)  2. (a) shows a view with a presentationContext of .window(.statusBar) and (b) shows a view with a presentationContext of .window(.normal). When (a) is hidden via a.hide(), both (a) AND (b) disappear. (Also a possible error?)  3. (a) shows a view with a presentationContext of .window(.normal) and (b) shows a view with a presentationContext of .window(.statusBar). When (a) is hidden via a.hide(), only (a) disappears. (This case seems to be the expected behavior however the cases 1 and 2 do not seems to behave this way.)  Also, when (b) disappears upon (a)'s hide, (b)'s didHide is not called. Furthermore, when trying to show a new view via using (b)'s show() function, the view seems to be enqueued and not shown visually.  This phenomenon is only occuring in iOS 14 and above.  Could I be missi
  **Post-Mortem & Fix Analysis**:
  > Sorry to hear you're having trouble. I attempted to reproduce your issue, but didn't have any luck. Maybe you could take a look at the sample project I attached and help me figure out how to reproduce?  The code looks like this and does scenario (1) when you tap the "Test" button. The project is on 9.0.2.  ````swift class ViewController: UIViewController {      let a = SwiftMessages()     let b = SwiftMessages()      @IBAction func testTapped() {         let aMessage = MessageView.viewFromNib(layout: .cardView)         let bMessage = MessageView.viewFromNib(layout: .cardView)         aMessage.configureContent(title: "A Message", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit")         bMessage.configureContent(title: "B Message", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit")         var aConfig = a.defaultConfig         var bConfig = b.defaultConfig         aConfig.presentationContext = .window(windowLevel: .normal)         bConfig.p
  > Hi Tim! (If it's alright to call you that..? ) Thank you for such a fast response. I forgot to mention that I am using SwiftMessages 9.0.1! If it's fine with you I would like to suggest steps to reproduce the bug. Could you remove the asyncAfter function and hide the shown message via any userInteractions? Such as swiping to dismiss or tapping outside the view area? The error (1) mentioned in my former comment can be seen when done so! Thank you! Look forward to hearing from you
  > >Hi Tim! (If it's alright to call you that..? )  Yep.  > I forgot to mention that I am using SwiftMessages 9.0.1!  The specific problem you're describing was fixed in 9.0.2 

- **Issue #466** (2021-06-29): **Alert not shown after Biometry check (only from v. 9.0.1)**
  *Symptoms*: From version 9.0.1 my app can't display alert after Biometry check. This issue doesn't occur with older versions. If I try to show the alert after 1 sec (or more) using `DispatchQueue.main.asynAfter` the alert appears correctly.  Here the code that doesn't work:  ``` let context = LAContext() var error: NSError? if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {     context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) {         success, authenticationError in             if success {                 // Show an alert                 ...                 SwiftMessages.show(config: config, view: view)             }             else { ... }       } }  else {  ... } ```
  **Post-Mortem & Fix Analysis**:
  > Is that callback on the main queue?
  > Also, have you tried 9.0.2?
  > @wtmoose I've tried both 9.0.1 and 9.0.2. The callback doesn't need to be on a different thread, anyway if I include it on another thread the alert is not shown.

- **Issue #465** (2021-06-29): **SwiftMessages.hide() removing all messages in queue from versions 8.0.4 to 9.0.0 for iPad, But not for iPhone**
  *Symptoms*: Hi,  I am using SwiftMessages in our Project. I am showing two type of Toast messages, one is with a text and other one is with a text and having a button to dismiss the toast. Previously I were using 7.0.1 and recently I upgraded to 9.0.0  From there onwards, If I click on the Dismiss button (which will call SwiftMessages.hide()), I am not getting any messages that are in the queue, for iPad, But on iPhone, everything is working fine. The same code has been used for iPhone and iPad.  Even though if I remove the toast messages with a swipe towards the bottom of the screen, I am not getting next toast messages which are added to the queue.  If I did not remove the toast messages (waiting for 4 seconds for every toast message) with dismiss button or with swipe to bottom (default SwiftMessages feature) then I am getting all the messages that are added to the queue.  ````swift public func Toast (text: String?, delay: TimeInterval? = 0.0, duration: TimeInterval? = 4.0, height: CGFloat = 0, shouldAddButton: Bool = false, buttonTitle: String? = nil) {          DispatchQueue.main.async {             let messageView = MessageView.viewFromNib(layout: .cardView)             messageView.configureTheme(.success)             messageView.button?.isHidden = !shouldAddButton             messageView.iconImageView?.isHidden = true             messageView.titleLabel?.isHidden = true             messageView.configureContent(body: text?.trimmingCharacters(in: .whitespacesAndNewl
  **Post-Mortem & Fix Analysis**:
  > It sounds a lot like #458, which was fixed in 9.0.1. The problem was that if you interact with the toast view, the key window changes and iOS doesn't automatically restore the key window when you dismiss the toast. 9.0.1 added logic to restore the key window to the previous value.  In the past, folks have reported problems and it turned out that they just needed to clean their workspace. Can you try cleaning and verify if it still doesn't work for you?
  > @wtmoose  Thanks for the immediate response,  As I informed, I am not seeing any Toast message View in versions 9.0.1 and 9.0.2  I am using Carthage to use SwiftMessages and my cart file is having the below line.  github "SwiftKickMobile/SwiftMessages" == 9.0.2  I use to delete derived data every day and I use to clean build folder every day (cmd+shft+option+k).   I have deleted the build folder in my carthage folder of my project, so that it will build freshly. But I did not tested yet because of some personal work.   I will delete my existing carthage folder and do a carthage update tomorrow morning and will update you after testing. If I need to do any other changes to clean my workspace, please let me know. I will update you tomorrow morning which is after 10 hours from now. 
  > @wtmoose   I have deleted my Carthage folder and derived data, Still, I am not getting any Toast messages in 9.0.2  Could you please check each and every line above and let me know what else I missed for the new version  I have added the below code as well which is not there in the above code  ````swift messageConfig.presentationContext = .window(windowLevel: .statusBar) // (tried with automatic and other window levels) messageConfig.preferredStatusBarStyle = .lightContent messageConfig.interactiveHide = false ````  Even I tried all the theme modes like warning, error, success and info for messageView.configureTheme.  Still I am not seeing any Toast messages in 9.0.2 version  Could you please help me, how can I fix my issue

- **Issue #429** (2020-12-16): **Missing copy/paste menu in UITextField/UIWebView**
  *Symptoms*: ### Description - When using custom `SwiftMessages.Config` with `dimMode != .none`. The method `makeKeyAndVisible` is being called inside `WindowViewController`. - The clipboard (copy/paste) options when select text in TextField/Webview can not be displayed.  I'm not quite sure the reason why clipboard could not display, maybe another UIWindow make Key and Visible, then dismissed. So the OS confused and doesn't know which Window the clipboard should show.  ### Screenshot ![clipboard](https://user-images.githubusercontent.com/7752679/97255202-b3e57680-1842-11eb-967d-1c1d355aae37.gif) ### References https://stackoverflow.com/questions/6414540/missing-copy-paste-menu-in-uitextfield-uiwebview/7576544 ### Solution & PR  https://github.com/SwiftKickMobile/SwiftMessages/pull/430 ### Demo - Branch having issue: https://github.com/canhth/SwiftMessages/tree/demo/multiple-windows - Fixed version: https://github.com/canhth/SwiftMessages/tree/demo/multiple-windows-fixed
  **Post-Mortem & Fix Analysis**:
  > Where is the text field?
  > Hi @wtmoose ,  I've updated the Description. Including demo, video, and solution. How to reproduce it (Please check out my demo fork): ``` - Add rootViewController programmatically (don't forget to call `window.makeKeyAndVisible`). - Use another third party that also active another UIWindow. (_I'm using DoraemonKit for example _) - Show SwiftMessage view with `dimMode != .none`. - Now, there is no more clipboard options (copy/paste) for your selected text. ``` Please consider the PR that I made. That's just for enabling users can force disable `becomeKeyWindow` in SwiftMessages.Config.  Thanks
  > Thanks for clarifying. The change in the PR is fine, but it seems like more of a workaround than a solution. The case where the message’s window should become the key window, for example if the message has a text field, would still have the issue wouldn’t it?

- **Issue #188** (2018-05-23): **Physics animation visual glitch**
  *Symptoms*: The physics animation has a visual glitch in iOS 11 when transitioning out of interactive pan to dismiss animation.

- **Issue #185** (2018-05-18): **Incorrect margin adjustments in landscape**
  *Symptoms*: Hello guys,   I was testing the cool library. and I don't know if its a bug. when using **layout** as **statusLine** with no tab bar controller, in landscape mode the message is under the home bar of iPhone X  as shown in the image below   ![simulator screen shot - iphone x - 2018-05-15 at 22 01 54](https://user-images.githubusercontent.com/17508663/40070848-dd64af30-588c-11e8-9142-39660c07a59f.png)   Here is the code I used   ``` Swift         let view = MessageView.viewFromNib(layout: .statusLine)         view.configureTheme(backgroundColor: UIColor.blue, foregroundColor: .white)          view.configureContent(body: "Hello Lohen Yumnam")                           var config = SwiftMessages.Config()         config.presentationStyle = .bottom // Slide up from the bottom.         config.shouldAutorotate = true         config.interactiveHide = true         config.duration = .forever         config.presentationContext = .window(windowLevel: UIWindowLevelStatusBar)                  // Show the message.         SwiftMessages.show(config: config, view: view)  ```   
  **Post-Mortem & Fix Analysis**:
  > Thanks for bringing this to my attention. It definitely shouldn't do that. I'll take a look.
  > @lohenyumnam Forgot to mention that the fix for this is on the head of master. Will release soon (looking at a couple of other things).
  > This fix is available in 4.1.3

- **Issue #131** (2017-11-15): **Presentation of message fails if application is in background state**
  *Symptoms*: I present message from the bottom, so `TopBottomAnimation` animator and the method `func showAnimation(completion: @escaping AnimationCompletion)` are used. And as expected the completion closure is called with `completed` value of `false`, because `UIView.animate` does the same thing. So, does anyone have any thoughts about how we can improve that and do not break anything else? )
  **Post-Mortem & Fix Analysis**:
  > Fixed in 4.1.0 release. I added a check for application not active.

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

### Incident Patch 1: `6010bc72` (2025-09-02)
**Commit Message**: Refactor `MessageHostingView` Hit Testing to Improve SwiftUI Touch Handling (#582)

* Refactor `MessageHostingView` hit testing to improve SwiftUI touch handling on iOS 18+ through layer-based detection.

* Moved doc comments to top of hitTest function

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +20/-11)
```diff
@@ -51,21 +51,30 @@ public class MessageHostingView<Content>: UIView, Identifiable where Content: Vi
         fatalError("init(coder:) has not been implemented")
     }
 
+    /// Override hit testing so that only SwiftUI-rendered content inside `MessageHostingView` can receive touches.
+    ///
+    /// Background:
+    /// - `MessageHostingView` does not tightly wrap its SwiftUI content, potentially leaving surrounding regions that should not be tappable. There have
+    ///   been some complications with detecting touches on the SwiftUI content over the years that have led to the current approach:
+    /// - On iOS 18, UIKit performs a second hit test that resolves to the `UIHostingController`'s view instead of the actual SwiftUI element.
+    /// - On iOS 26, the `UIHostingController`'s view no longer contains any subviews, but its `CALayer` *layer* hierarchy still reflects the SwiftUI content.
+    ///
+    /// All of these issues can be solved by hit testing the layer hierarchy instead of the view hierarchy:
+    /// - Call `super.hitTest(point, with: event)` to obtain a candidate view `view`. If our heuristic determines that SwiftUI content was tapped,
+    ///   then we return `view` to accept the touch. Otherwise, return `nil` to pass the touch through.
+    /// - If the candidate is `MessageHostingView` return `nil`.
+    /// - If the candidate is directly parented to `MessageHostingView`, this is the `UIHostingController` view containing the SwiftUI content.
+    ///   To determine if SwiftUI content was touched, we iterate over hosting controller's sublayers and return the candidate if the touch intersects a sublayer.
+    ///   Otherwise, return `nil`.
+    /// - For any other case, we return the candidate because we don't know what's going on.
     public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
         guard let view = super.hitTest(point, with: event) else { return nil }
-        // Touches should pass through unless they land on a view that is rendering a SwiftUI element.
         if view == self { return nil }
-        // In iOS 18 beta, the hit testing behavior changed in a weird way: when a SwiftUI element is tapped,
-        // the first hit test returns the view that renders the SwiftUI element. However, a second identical hit
-        // test is performed(!) and on the second test, the `UIHostingController`'s view is returned. We want touches
-        // to pass through that view. In iOS 17, we would just return `nil` in that case. However, in iOS 18, the
-        // second hit test is actuall essential to touches being delivered to the SwiftUI elements. The new approach
-        // is to iterate overall all of the subviews, which are all presumably rendering SwiftUI elements, and
-        // only return `nil` if the point is not inside any of these subviews.
+        
         if view.superview == self {
-            for subview in view.subviews {
-                let subviewPoint = self.convert(point, to: subview)
-                if subview.point(inside: subviewPoint, with: event) {
+            for sublayer in view.layer.sublayers ?? [] {
+                let sublayerPoint = self.layer.convert(point, to: sublayer)
+                if sublayer.contains(sublayerPoint) {
                     return view
                 }
             }
```

---

### Incident Patch 2: `213fedca` (2025-08-11)
**Commit Message**: Fix the bottom constraint issue on iPadOS 18+ when the tab bar has no superview or frame is empty (#578)

**File**: `SwiftMessages/Presenter.swift` (modified, +1/-1)
```diff
@@ -339,7 +339,7 @@ class Presenter: NSObject {
         }
 
         func bottomLayoutConstraint(view: UIView, containerView: UIView, viewController: UIViewController?) -> NSLayoutConstraint {
-            if case .bottom = config.presentationStyle.topBottomStyle, let tab = viewController as? UITabBarController, tab.sm_isVisible(view: tab.tabBar) {
+            if case .bottom = config.presentationStyle.topBottomStyle, let tab = viewController as? UITabBarController, tab.sm_isVisible(view: tab.tabBar), tab.tabBar.superview != nil, !tab.tabBar.frame.isEmpty {
                 return NSLayoutConstraint(item: view, attribute: .bottom, relatedBy: .equal, toItem: tab.tabBar, attribute: .top, multiplier: 1.00, constant: 0.0)
             }
             return NSLayoutConstraint(item: view, attribute: .bottom, relatedBy: .equal, toItem: containerView, attribute: .bottom, multiplier: 1.00, constant: 0.0)
```

---

### Incident Patch 3: `007f4cc6` (2025-06-09)
**Commit Message**: Introduce SwiftMessagesHideAction and Environment Key for SwiftUI (#574)

* Introduced SwiftMessagesHide Environment Key

* Use Hide Action struct to resemble built-in Dismiss Action

* Minor changes post-feedback, use single hide(animated:) function

* Used more apt comments and documentation

**File**: `SwiftMessages.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -88,6 +88,7 @@
 		86BBA9061D5E040C00FE8F16 /* Identifiable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 864495551D4F7C390056EB2A /* Identifiable.swift */; };
 		86BBA9071D5E040C00FE8F16 /* MarginAdjustable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 86AAF81D1D5549680031EE32 /* MarginAdjustable.swift */; };
 		86BBA9081D5E040C00FE8F16 /* Error.swift in Sources */ = {isa = PBXBuildFile; fileRef = 86AAF82A1D580DD70031EE32 /* Error.swift */; };
+		B0E55A662DD110EA003D97B1 /* SwiftMessagesHideAction.swift in Sources */ = {isa = PBXBuildFile; fileRef = B0E55A652DD110DB003D97B1 /* SwiftMessagesHideAction.swift */; };
 		E6E49F911D70A344006CB883 /* MessageView.xib in Resources */ = {isa = PBXBuildFile; fileRef = 862C0CDA1D5A397F00D06168 /* MessageView.xib */; };
 		E6E49F921D70A349006CB883 /* StatusLine.xib in Resources */ = {isa = PBXBuildFile; fileRef = 862C0CDB1D5A397F00D06168 /* StatusLine.xib */; };
 /* End PBXBuildFile section */
@@ -191,6 +192,7 @@
 		86B48AFA1D5A41C900063E2B /* SwiftMessagesTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SwiftMessagesTests.swift; sourceTree = "<group>"; };
 		86B48AFC1D5A41C900063E2B /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
 		86BBA8F81D5E01FC00FE8F16 /* CardView.xib */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = file.xib; name = CardView.xib; path = Resources/CardView.xib; sourceTree = "<group>"; };
+		B0E55A652DD110DB003D97B1 /* SwiftMessagesHideAction.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SwiftMessagesHideAction.swift; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -255,6 +257,7 @@
 		228F7DDA2ACF7029006C9644 /* SwiftUI */ = {
 			isa = PBXGroup;
 			children = (
+				B0E55A652DD110DB003D97B1 /* SwiftMessagesHideAction.swift */,
 				223DE69C2C29E50B000161E5 /* MessageGeometryProxy.swift */,
 				228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */,
 				228F7DDD2ACF703A006C9644 /* MessageViewConvertible.swift */,
@@ -589,6 +592,7 @@
 				220D386E2597AA5B00BB2B88 /* SwiftMessages.Config+Extensions.swift in Sources */,
 				2270044B1FAFA6DD0045DDC3 /* PhysicsAnimation.swift in Sources */,
 				224C3C902C28A2F900B50B18 /* TopBottomPresentable.swift in Sources */,
+				B0E55A662DD110EA003D97B1 /* SwiftMessagesHideAction.swift in Sources */,
 				86BBA9041D5E040600FE8F16 /* NSBundle+Extensions.swift in Sources */,
 				86BBA8FD1D5E03F800FE8F16 /* SwiftMessages.swift in Sources */,
 				86BBA9021D5E040600FE8F16 /* WindowViewController.swift in Sources */,
```

**File**: `SwiftMessages/SwiftMessagesHideAction.swift` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+//
+//  SwiftMessagesHideKey.swift
+//  SwiftMessages
+//
+//  Created by Mofe Ejegi on 11/05/2025.
+//  Copyright © 2025 SwiftKick Mobile. All rights reserved.
+//
+
+import SwiftUI
+
+/// A SwiftUI-style action for dismissing the current SwiftMessage.
+public struct SwiftMessagesHideAction {
+    public init() {}
+    
+    /// Dismiss with option to disable animation.
+    @MainActor
+    public func callAsFunction(animated: Bool) {
+        SwiftMessages.hide(animated: animated)
+    }
+}
+
+public extension EnvironmentValues {
+    /// Inject `@Environment(\.swiftMessagesHide)` into your views to
+    /// access the SwiftUI-style action for dismissing the current SwiftMessage.
+    ///
+    /// Usage:
+    /// ```swift
+    /// @Environment(\.swiftMessagesHide) private var hide
+    /// ```
+    ///
+    /// Then you can call it like this:
+    /// ```swift
+    /// hide(animated: true)
+    /// ```
+    var swiftMessagesHide: SwiftMessagesHideAction {
+        get { self[SwiftMessagesHideKey.self] }
+        set { self[SwiftMessagesHideKey.self] = newValue }
+    }
+}
+
+private struct SwiftMessagesHideKey: EnvironmentKey {
+    /// Default to our action struct, which itself defaults to animated.
+    static let defaultValue: SwiftMessagesHideAction = SwiftMessagesHideAction()
+}
```

**File**: `SwiftUIDemo/SwiftUIDemo/DemoView.swift` (modified, +5/-2)
```diff
@@ -9,6 +9,9 @@ import SwiftUI
 import SwiftMessages
 
 struct DemoView: View {
+    
+    /// Use this to manually hide the swift message
+    @Environment(\.swiftMessagesHide) private var hide
 
     /// Demonstrates purely data-driven message presentation.
     @State var message: DemoMessage?
@@ -51,8 +54,8 @@ struct DemoView: View {
         .swiftMessage(message: $message)
         .swiftMessage(message: $messageWithButton) { message in
             DemoMessageWithButtonView(message: message, style: .card) {
-                Button("Tap Me") {
-                    print("Tap")
+                Button("Hide") {
+                    hide(animated: true)
                 }
                 .buttonStyle(.bordered)
             }
```

---

### Incident Patch 4: `438a2740` (2024-08-12)
**Commit Message**: SwiftUI layout improvement (#560)

**File**: `SwiftMessages.xcodeproj/project.pbxproj` (modified, +6/-2)
```diff
@@ -10,6 +10,7 @@
 		0797E40E26EE12B400691606 /* WindowScene.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0797E40D26EE12B400691606 /* WindowScene.swift */; };
 		220655121FAF82B600F4E00F /* MarginAdjustable+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 220655111FAF82B600F4E00F /* MarginAdjustable+Extensions.swift */; };
 		220D386E2597AA5B00BB2B88 /* SwiftMessages.Config+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 220D386D2597AA5B00BB2B88 /* SwiftMessages.Config+Extensions.swift */; };
+		223DE69D2C29E50C000161E5 /* MessageGeometryProxy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 223DE69C2C29E50B000161E5 /* MessageGeometryProxy.swift */; };
 		224C3C902C28A2F900B50B18 /* TopBottomPresentable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 224C3C8F2C28A2F900B50B18 /* TopBottomPresentable.swift */; };
 		224C3C932C28BC4900B50B18 /* TopBottomAnimationStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 224C3C922C28BC4400B50B18 /* TopBottomAnimationStyle.swift */; };
 		224FB69921153B440081D4DE /* CALayer+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 224FB69821153B440081D4DE /* CALayer+Extensions.swift */; };
@@ -105,6 +106,7 @@
 		0797E40D26EE12B400691606 /* WindowScene.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = WindowScene.swift; sourceTree = "<group>"; };
 		220655111FAF82B600F4E00F /* MarginAdjustable+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "MarginAdjustable+Extensions.swift"; sourceTree = "<group>"; };
 		220D386D2597AA5B00BB2B88 /* SwiftMessages.Config+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "SwiftMessages.Config+Extensions.swift"; sourceTree = "<group>"; };
+		223DE69C2C29E50B000161E5 /* MessageGeometryProxy.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MessageGeometryProxy.swift; sourceTree = "<group>"; };
 		224C3C8F2C28A2F900B50B18 /* TopBottomPresentable.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TopBottomPresentable.swift; sourceTree = "<group>"; };
 		224C3C922C28BC4400B50B18 /* TopBottomAnimationStyle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TopBottomAnimationStyle.swift; sourceTree = "<group>"; };
 		224FB69821153B440081D4DE /* CALayer+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "CALayer+Extensions.swift"; sourceTree = "<group>"; };
@@ -253,8 +255,10 @@
 		228F7DDA2ACF7029006C9644 /* SwiftUI */ = {
 			isa = PBXGroup;
 			children = (
-				228F7DDC2ACF703A006C9644 /* SwiftMessageModifier.swift */,
+				223DE69C2C29E50B000161E5 /* MessageGeometryProxy.swift */,
+				228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */,
 				228F7DDD2ACF703A006C9644 /* MessageViewConvertible.swift */,
+				228F7DDC2ACF703A006C9644 /* SwiftMessageModifier.swift */,
 			);
 			name = SwiftUI;
 			sourceTree = "<group>";
@@ -366,7 +370,6 @@
 				86AAF8171D54F0650031EE32 /* PassthroughView.swift */,
 				22E01F631E74EC8B00ACE19A /* MaskingView.swift */,
 				86AAF8191D54F0850031EE32 /* PassthroughWindow.swift */,
-				228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */,
 				220D38672597A94C00BB2B88 /* Extensions */,
 			);
 			name = Internal;
@@ -597,6 +600,7 @@
 				86589D471D64B6E40041676C /* BaseView.swift in Sources */,
 				0797E40E26EE12B400691606 /* WindowScene.swift in Sources */,
 				225304622290C76E00A03ACF /* NSLayoutConstraint+Extensions.swift in Sources */,
+				223DE69D2C29E50C000161E5 /* MessageGeometryProxy.swift in Sources */,
 				86BBA9071D5E040C00FE8F16 /* MarginAdjustable.swift in Sources */,
 				867BED211D622793005212E3 /* BackgroundViewable.swift in Sources */,
 			);
```

**File**: `SwiftMessages/MessageGeometryProxy.swift` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+//
+//  MessageGeometryProxy.swift
+//  SwiftMessages
+//
+//  Created by Timothy Moose on 6/24/24.
+//  Copyright © 2024 SwiftKick Mobile. All rights reserved.
+//
+
+import SwiftUI
+
+/// A  data type that mimicks `GeomtryProxy` and is used with `swiftMessage()` modifier when the geomtry metrics of the container view
+/// are needed, particularly because `GeometryReader` doesn't work inside the view builder due to the way the message view is being
+/// displayed from UIKit.
+public struct MessageGeometryProxy {
+    public var size: CGSize
+    public var safeAreaInsets: EdgeInsets
+}
```

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +38/-5)
```diff
@@ -17,13 +17,20 @@ public class MessageHostingView<Content>: UIView, Identifiable where Content: Vi
     public let id: String
 
     public init(id: String, content: Content) {
-        hostVC = UIHostingController(rootView: content)
         self.id = id
+        self.content = { _ in content }
+        super.init(frame: .zero)
+        backgroundColor = .clear
+    }
+
+    public init<Message>(
+        message: Message,
+        @ViewBuilder content: @escaping (Message, MessageGeometryProxy) -> Content
+    ) where Message: Identifiable {
+        self.id = message.id
+        self.content = { geom in content(message, geom) }
         super.init(frame: .zero)
-        hostVC.loadViewIfNeeded()
-        installContentView(hostVC.view)
         backgroundColor = .clear
-        hostVC.view.backgroundColor = .clear
     }
 
     convenience public init<Message>(message: Message) where Message: MessageViewConvertible, Message.Content == Content {
@@ -34,7 +41,8 @@ public class MessageHostingView<Content>: UIView, Identifiable where Content: Vi
 
     // MARK: - Variables
 
-    private let hostVC: UIHostingController<Content>
+    private var hostVC: UIHostingController<Content>?
+    private let content: (MessageGeometryProxy) -> Content
 
     // MARK: - Lifecycle
 
@@ -66,6 +74,31 @@ public class MessageHostingView<Content>: UIView, Identifiable where Content: Vi
         return view
     }
 
+    public override func didMoveToSuperview() {
+        guard let superview = self.superview else { return }
+        let size = superview.bounds.size
+        let insets = superview.safeAreaInsets
+        let ltr = superview.effectiveUserInterfaceLayoutDirection == .leftToRight
+        let proxy = MessageGeometryProxy(
+            size: CGSize(
+                width: size.width - insets.left - insets.right,
+                height: size.height - insets.top - insets.bottom
+            ),
+            safeAreaInsets: EdgeInsets(
+                top: insets.top,
+                leading: ltr ? insets.left : insets.right,
+                bottom: insets.bottom,
+                trailing: ltr ? insets.right : insets.left
+            )
+        )
+        let hostVC = UIHostingController(rootView: content(proxy))
+        self.hostVC = hostVC
+        hostVC.loadViewIfNeeded()
+        installContentView(hostVC.view)
+        hostVC.view.backgroundColor = .clear
+
+    }
+
     // MARK: - Configuration
 
     private func installContentView(_ contentView: UIView) {
```

**File**: `SwiftMessages/PhysicsAnimation.swift` (modified, +46/-12)
```diff
@@ -37,7 +37,12 @@ public class PhysicsAnimation: NSObject, Animator {
     }
 
     public func show(context: AnimationContext, completion: @escaping AnimationCompletion) {
-        NotificationCenter.default.addObserver(self, selector: #selector(adjustMargins), name: UIDevice.orientationDidChangeNotification, object: nil)
+        NotificationCenter.default.addObserver(
+            self,
+            selector: #selector(adjustMargins),
+            name: UIDevice.orientationDidChangeNotification,
+            object: nil
+        )
         install(context: context)
         showAnimation(context: context, completion: completion)
     }
@@ -56,12 +61,24 @@ public class PhysicsAnimation: NSObject, Animator {
             view.transform = CGAffineTransform.identity
             completion(true)
         }
-        UIView.animate(withDuration: hideDuration, delay: 0, options: [.beginFromCurrentState, .curveEaseIn, .allowUserInteraction], animations: {
-            view.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
-        }, completion: nil)
-        UIView.animate(withDuration: hideDuration, delay: 0, options: [.beginFromCurrentState, .curveEaseIn, .allowUserInteraction], animations: {
-            view.alpha = 0
-        }, completion: nil)
+        UIView.animate(
+            withDuration: hideDuration,
+            delay: 0,
+            options: [.beginFromCurrentState, .curveEaseIn, .allowUserInteraction], 
+            animations: {
+                view.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
+            }, 
+            completion: nil
+        )
+        UIView.animate(
+            withDuration: hideDuration,
+            delay: 0,
+            options: [.beginFromCurrentState, .curveEaseIn, .allowUserInteraction],
+            animations: {
+                view.alpha = 0
+            },
+            completion: nil
+        )
         CATransaction.commit()
     }
 
@@ -75,14 +92,31 @@ public class PhysicsAnimation: NSObject, Animator {
         container.addSubview(view)
         switch placement {
         case .center:
-            view.centerYAnchor.constraint(equalTo: container.centerYAnchor).with(priority: UILayoutPriority(200)).isActive = true
+            view.centerYAnchor.constraint(
+                equalTo: container.centerYAnchor
+            )
+            .with(priority: UILayoutPriority(200))
+            .isActive = true
         case .top:
-            view.topAnchor.constraint(equalTo: container.topAnchor).with(priority: UILayoutPriority(200)).isActive = true
+            view.topAnchor.constraint(
+                equalTo: container.topAnchor
+            )
+            .with(priority: UILayoutPriority(200))
+            .isActive = true
         case .bottom:
-            view.bottomAnchor.constraint(equalTo: container.bottomAnchor).with(priority: UILayoutPriority(200)).isActive = true
+            view.bottomAnchor.constraint(
+                equalTo: container.bottomAnchor
+            )
+            .with(priority: UILayoutPriority(200))
+            .isActive = true
         }
-        NSLayoutConstraint(item: view, attribute: .leading, relatedBy: .equal, toItem: container, attribute: .leading, multiplier: 1, constant: 0).isActive = true
-        NSLayoutConstraint(item: view, attribute: .trailing, relatedBy: .equal, toItem: container, attribute: .trailing, multiplier: 1, constant: 0).isActive = true
+        NSLayoutConstraint.activate([
+            view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
+            view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
+            // Don't allow the message to spill outside of the top or bottom of the container.
+            view.topAnchor.constraint(greaterThanOrEqualTo: container.topAnchor),
+            view.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor),
+        ])
         // Important to layout now in order to get the right safe area insets
         container.layoutIfNeeded()
         adjustMargins()
```

**File**: `SwiftMessages/SwiftMessageModifier.swift` (modified, +43/-6)
```diff
@@ -9,15 +9,36 @@ import SwiftUI
 
 @available(iOS 14.0, *)
 public extension View {
-    /// A state-based modifier for displaying a message when `Message` does not conform to `MessageViewConvertible`. This variant is more flexible and
-    /// should be used if the message view can't be represented as pure data, such as if it requires a delegate, has callbacks, etc.
+    /// A view modifier for displaying a message using similar semantics to the `.sheet()` modifier.
     func swiftMessage<Message, MessageContent>(
         message: Binding<Message?>,
         config: SwiftMessages.Config? = nil,
         swiftMessages: SwiftMessages? = nil,
         @ViewBuilder messageContent: @escaping (Message) -> MessageContent
     ) -> some View where Message: Equatable & Identifiable, MessageContent: View {
-        modifier(SwiftMessageModifier(message: message, config: config, swiftMessages: swiftMessages, messageContent: messageContent))
+        swiftMessage(message: message, config: config, swiftMessages: swiftMessages) { message, _ in
+            messageContent(message)
+        }
+    }
+
+    /// A view modifier for displaying a message using similar semantics to the `.sheet()` modifier. This variant provides a
+    /// `SwiftMessageGeometryProxy`. The proxy is useful when one needs to know the geometry metrics of the container view,
+    /// particularly because `GeometryReader` doesn't work inside the view builder due to the way the message view is being
+    /// displayed from UIKit.
+    func swiftMessage<Message, MessageContent>(
+        message: Binding<Message?>,
+        config: SwiftMessages.Config? = nil,
+        swiftMessages: SwiftMessages? = nil,
+        @ViewBuilder messageContent: @escaping (Message, MessageGeometryProxy) -> MessageContent
+    ) -> some View where Message: Equatable & Identifiable, MessageContent: View {
+        modifier(
+            SwiftMessageModifier(
+                message: message,
+                config: config,
+                swiftMessages: swiftMessages,
+                messageContent: messageContent
+            )
+        )
     }
 
     /// A state-based modifier for displaying a message when `Message` conforms to `MessageViewConvertible`. This variant should be used if the message
@@ -43,6 +64,20 @@ private struct SwiftMessageModifier<Message, MessageContent>: ViewModifier where
         config: SwiftMessages.Config? = nil,
         swiftMessages: SwiftMessages? = nil,
         @ViewBuilder messageContent: @escaping (Message) -> MessageContent
+    ) {
+        _message = message
+        self.config = config
+        self.swiftMessages = swiftMessages
+        self.messageContent = { message, _ in
+            messageContent(message)
+        }
+    }
+
+    fileprivate init(
+        message: Binding<Message?>,
+        config: SwiftMessages.Config? = nil,
+        swiftMessages: SwiftMessages? = nil,
+        @ViewBuilder messageContent: @escaping (Message, MessageGeometryProxy) -> MessageContent
     ) {
         _message = message
         self.config = config
@@ -58,7 +93,9 @@ private struct SwiftMessageModifier<Message, MessageContent>: ViewModifier where
         _message = message
         self.config = config
         self.swiftMessages = swiftMessages
-        self.messageContent = { $0.asMessageView() }
+        self.messageContent = { message, _ in
+            message.asMessageView()
+        }
     }
 
     // MARK: - Constants
@@ -68,7 +105,7 @@ private struct SwiftMessageModifier<Message, MessageContent>: ViewModifier where
     @Binding private var message: Message?
     private let config: SwiftMessages.Config?
     private let swiftMessages: SwiftMessages?
-    @ViewBuilder private let messageContent: (Message) -> MessageContent
+    @ViewBuilder private let messageContent: (Message, MessageGeometryProxy) -> MessageContent
 
     // MARK: - Body
 
@@ -79,7 +116,7 @@ private struct SwiftMessageModifier<Message, MessageContent>: ViewModifier where
                 let hideAll: @MainActor () -> Void = swiftMessages?.hideAll ?? SwiftMessages.hideAll
                 switch message {
                 case let message?:
-                    let view = MessageHostingView(id: message.id, content: messageContent(message))
+                    let view = MessageHostingView(message: message, content: messageContent)
                     var config = config ?? swiftMessages?.defaultConfig ?? SwiftMessages.defaultConfig
                     config.eventListeners.append { event in
                         if case .didHide = event, event.id == self.message?.id {
```

**File**: `iMessageDemo/Podfile.lock` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 PODS:
-  - SwiftMessages/AppExtension (9.0.3)
+  - SwiftMessages/AppExtension (10.0.1)
 
 DEPENDENCIES:
   - SwiftMessages/AppExtension (from `../`)
@@ -9,8 +9,8 @@ EXTERNAL SOURCES:
     :path: "../"
 
 SPEC CHECKSUMS:
-  SwiftMessages: 077f19126c24033fe24042237ecc20261adb46e4
+  SwiftMessages: 759b4a0bf5c3a116a0d7e8a34b098ba83c458625
 
 PODFILE CHECKSUM: 2eb9a33592d0c52131c37a9dd169a8c4604ffd7b
 
-COCOAPODS: 1.10.1
+COCOAPODS: 1.15.2
```

**File**: `iMessageDemo/Pods/Local Podspecs/SwiftMessages.podspec.json` (modified, +4/-4)
```diff
@@ -1,20 +1,20 @@
 {
   "name": "SwiftMessages",
-  "version": "9.0.3",
+  "version": "10.0.1",
   "license": {
     "type": "MIT"
   },
   "homepage": "https://github.com/SwiftKickMobile/SwiftMessages",
   "authors": {
-    "Timothy Moose": "tim@swiftkick.it"
+    "Timothy Moose": "tim@swiftkickmobile.com"
   },
   "summary": "A very flexible message bar for iOS written in Swift.",
   "source": {
     "git": "https://github.com/SwiftKickMobile/SwiftMessages.git",
-    "tag": "9.0.3"
+    "tag": "10.0.1"
   },
   "platforms": {
-    "ios": "9.0"
+    "ios": "13.0"
   },
   "swift_versions": "5.0",
   "frameworks": "UIKit",
```

**File**: `iMessageDemo/Pods/Manifest.lock` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 PODS:
-  - SwiftMessages/AppExtension (9.0.3)
+  - SwiftMessages/AppExtension (10.0.1)
 
 DEPENDENCIES:
   - SwiftMessages/AppExtension (from `../`)
@@ -9,8 +9,8 @@ EXTERNAL SOURCES:
     :path: "../"
 
 SPEC CHECKSUMS:
-  SwiftMessages: 077f19126c24033fe24042237ecc20261adb46e4
+  SwiftMessages: 759b4a0bf5c3a116a0d7e8a34b098ba83c458625
 
 PODFILE CHECKSUM: 2eb9a33592d0c52131c37a9dd169a8c4604ffd7b
 
-COCOAPODS: 1.10.1
+COCOAPODS: 1.15.2
```

---

### Incident Patch 5: `b3bccca8` (2024-08-02)
**Commit Message**: Fix broken SwiftUI touch handling in iOS 18

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +19/-4)
```diff
@@ -44,10 +44,25 @@ public class MessageHostingView<Content>: UIView, Identifiable where Content: Vi
     }
 
     public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
-        let view = super.hitTest(point, with: event)
-        // The rendered SwiftUI view isn't a direct child of this hosting view. SwiftUI
-        // inserts another intermediate view that should also ignore touches.
-        if view == self || view?.superview == self { return nil }
+        guard let view = super.hitTest(point, with: event) else { return nil }
+        // Touches should pass through unless they land on a view that is rendering a SwiftUI element.
+        if view == self { return nil }
+        // In iOS 18 beta, the hit testing behavior changed in a weird way: when a SwiftUI element is tapped,
+        // the first hit test returns the view that renders the SwiftUI element. However, a second identical hit
+        // test is performed(!) and on the second test, the `UIHostingController`'s view is returned. We want touches
+        // to pass through that view. In iOS 17, we would just return `nil` in that case. However, in iOS 18, the
+        // second hit test is actuall essential to touches being delivered to the SwiftUI elements. The new approach
+        // is to iterate overall all of the subviews, which are all presumably rendering SwiftUI elements, and
+        // only return `nil` if the point is not inside any of these subviews.
+        if view.superview == self {
+            for subview in view.subviews {
+                let subviewPoint = self.convert(point, to: subview)
+                if subview.point(inside: subviewPoint, with: event) {
+                    return view
+                }
+            }
+            return nil
+        }
         return view
     }
 
```

---

### Incident Patch 6: `fa5f863e` (2024-01-23)
**Commit Message**: Fixes #207 (#484)

**File**: `Demo/Demo.xcodeproj/project.pbxproj` (modified, +4/-5)
```diff
@@ -200,7 +200,6 @@
 				TargetAttributes = {
 					86AEDCE11D5D1DB70030232E = {
 						CreatedOnToolsVersion = 7.3.1;
-						DevelopmentTeam = 38R82CD868;
 						LastSwiftMigration = 1020;
 					};
 				};
@@ -427,11 +426,11 @@
 				ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_IDENTITY = "iPhone Developer";
-				DEVELOPMENT_TEAM = 38R82CD868;
+				DEVELOPMENT_TEAM = "";
 				INFOPLIST_FILE = Demo/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 14.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
-				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.Demo;
+				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.SwiftMessages.Demo;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
@@ -444,11 +443,11 @@
 				ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_IDENTITY = "iPhone Developer";
-				DEVELOPMENT_TEAM = 38R82CD868;
+				DEVELOPMENT_TEAM = "";
 				INFOPLIST_FILE = Demo/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 14.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
-				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.Demo;
+				PRODUCT_BUNDLE_IDENTIFIER = it.swiftkick.SwiftMessages.Demo;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
```

**File**: `Demo/Demo.xcodeproj/xcshareddata/xcschemes/Demo.xcscheme` (modified, +0/-7)
```diff
@@ -50,13 +50,6 @@
             ReferencedContainer = "container:Demo.xcodeproj">
          </BuildableReference>
       </BuildableProductRunnable>
-      <AdditionalOptions>
-         <AdditionalOption
-            key = "MallocStackLogging"
-            value = ""
-            isEnabled = "YES">
-         </AdditionalOption>
-      </AdditionalOptions>
    </LaunchAction>
    <ProfileAction
       buildConfiguration = "Release"
```

**File**: `Demo/Demo/Base.lproj/LaunchScreen.storyboard` (modified, +5/-8)
```diff
@@ -1,12 +1,9 @@
 <?xml version="1.0" encoding="UTF-8"?>
-<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="14109" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
-    <device id="retina4_7" orientation="portrait">
-        <adaptation id="fullscreen"/>
-    </device>
+<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="22505" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
+    <device id="retina4_7" orientation="portrait" appearance="light"/>
     <dependencies>
         <deployment identifier="iOS"/>
-        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="14088"/>
-        <capability name="Constraints to layout margins" minToolsVersion="6.0"/>
+        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="22504"/>
         <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
     </dependencies>
     <scenes>
@@ -22,14 +19,14 @@
                         <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                         <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                         <subviews>
-                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="© 2018 SWIFTKICK MOBILE LLC" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="sBz-Dk-SSO">
+                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="© 2024 SWIFTKICK MOBILE LLC" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="sBz-Dk-SSO">
                                 <rect key="frame" x="46" y="643" width="283" height="16"/>
                                 <fontDescription key="fontDescription" type="system" pointSize="13"/>
                                 <color key="textColor" red="0.47391887630000001" green="0.47391887630000001" blue="0.47391887630000001" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                                 <nil key="highlightedColor"/>
                             </label>
                             <imageView userInteractionEnabled="NO" contentMode="scaleAspectFit" horizontalHuggingPriority="251" verticalHuggingPriority="251" image="splashBanner" translatesAutoresizingMaskIntoConstraints="NO" id="236-Ta-JzA">
-                                <rect key="frame" x="16" y="196" width="342" height="274"/>
+                                <rect key="frame" x="16" y="196.5" width="343" height="274"/>
                             </imageView>
                         </subviews>
                         <color key="backgroundColor" red="1" green="1" blue="1" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
```

**File**: `Demo/Demo/Base.lproj/Main.storyboard` (modified, +169/-128)
```diff
@@ -1,8 +1,10 @@
 <?xml version="1.0" encoding="UTF-8"?>
-<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="15504" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="JQZ-C5-7mw">
+<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="22505" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="JQZ-C5-7mw">
     <device id="retina4_7" orientation="portrait" appearance="light"/>
     <dependencies>
-        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="15508"/>
+        <deployment identifier="iOS"/>
+        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="22504"/>
+        <capability name="System colors in document resources" minToolsVersion="11.0"/>
         <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
     </dependencies>
     <scenes>
@@ -30,10 +32,10 @@
                     <tableView key="view" clipsSubviews="YES" contentMode="scaleToFill" alwaysBounceVertical="YES" dataMode="prototypes" style="plain" separatorStyle="default" rowHeight="44" sectionHeaderHeight="28" sectionFooterHeight="28" id="j4a-wU-637">
                         <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                         <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
-                        <color key="backgroundColor" systemColor="systemBackgroundColor" cocoaTouchSystemColor="whiteColor"/>
+                        <color key="backgroundColor" systemColor="systemBackgroundColor"/>
                         <prototypes>
                             <tableViewCell clipsSubviews="YES" contentMode="scaleToFill" selectionStyle="default" indentationWidth="10" reuseIdentifier="TitleBody" rowHeight="80" id="2n5-7h-3B5" userLabel="TitleBody Cell" customClass="TitleBodyCell" customModule="Demo" customModuleProvider="target">
-                                <rect key="frame" x="0.0" y="28" width="375" height="80"/>
+                                <rect key="frame" x="0.0" y="50" width="375" height="80"/>
                                 <autoresizingMask key="autoresizingMask"/>
                                 <tableViewCellContentView key="contentView" opaque="NO" clipsSubviews="YES" multipleTouchEnabled="YES" contentMode="center" tableViewCell="2n5-7h-3B5" id="Q5r-8D-38q">
                                     <rect key="frame" x="0.0" y="0.0" width="375" height="80"/>
@@ -47,7 +49,7 @@
                                         <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="Body" textAlignment="natural" lineBreakMode="tailTruncation" numberOfLines="0" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="Gpd-DA-5jT">
                                             <rect key="frame" x="26" y="45" width="323" height="14"/>
                                             <fontDescription key="fontDescription" type="system" pointSize="16"/>
-                                            <color key="textColor" systemColor="secondaryLabelColor" red="0.23529411759999999" green="0.23529411759999999" blue="0.26274509800000001" alpha="0.59999999999999998" colorSpace="custom" customColorSpace="sRGB"/>
+                                            <color key="textColor" systemColor="secondaryLabelColor"/>
                                             <nil key="highlightedColor"/>
                                         </label>
                                     </subviews>
@@ -67,21 +69,21 @@
                                 </connections>
                             </tableViewCell>
                             <tableViewCell clipsSubviews="YES" contentMode="scaleToFill" selectionStyle="default" accessoryType="disclosureIndicator" indentationWidth="10" reuseIdentifier="Explore" rowHeight="80" id="4Pm-kC-YGr" userLabel="Explore Cell" customClass="TitleBodyCell" customModule="Demo" customModuleProvider="target">
-                                <rect key="frame" x="0.0" y="108" width="375" height="80"/>
+                                <rect key="frame" x="0.0" y="130" width="375" height="80"/>
                                 <autoresizingMask key="autoresizingMask"/>
                                 <tableViewCellContentView key="contentView" opaque="NO" clipsSubviews="YES" multipleTouchEnabled="YES" contentMode="center" tableViewCell="4Pm-kC-YGr" id="LmG-UL-Bu8">
-                                    <rect key="frame" x="0.0" y="0.0" width="348" height="80"/>
+                                    <rect key="frame" x="0.0" y="0.0" width="348.5" height="80"/>
                          
```

**File**: `Demo/Demo/ExploreViewController.swift` (modified, +10/-5)
```diff
@@ -41,16 +41,16 @@ class ExploreViewController: UITableViewController, UITextFieldDelegate {
         
         switch theme.selectedSegmentIndex {
         case 0:
-            view.configureTheme(.info, iconStyle: iconStyle)
+            view.configureTheme(.info, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "info"
         case 1:
-            view.configureTheme(.success, iconStyle: iconStyle)
+            view.configureTheme(.success, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "success"
         case 2:
-            view.configureTheme(.warning, iconStyle: iconStyle)
+            view.configureTheme(.warning, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "warning"
         case 3:
-            view.configureTheme(.error, iconStyle: iconStyle)
+            view.configureTheme(.error, iconStyle: iconStyle, includeHaptic: hapticFeedback.isOn)
             view.accessibilityPrefix = "error"
         default:
             let iconText = ["🐸", "🐷", "🐬", "🐠", "🐍", "🐹", "🐼"].randomElement()
@@ -140,7 +140,11 @@ class ExploreViewController: UITableViewController, UITextFieldDelegate {
                 break
             }
         }
-        
+
+        if view.defaultHaptic == nil && hapticFeedback.isOn {
+            config.haptic = .success
+        }
+
         // Show
         SwiftMessages.show(config: config, view: view)
     }
@@ -154,6 +158,7 @@ class ExploreViewController: UITableViewController, UITextFieldDelegate {
     @IBOutlet weak var duration: UISegmentedControl!
     @IBOutlet weak var dimMode: UISegmentedControl!
     @IBOutlet weak var interactiveHide: UISwitch!
+    @IBOutlet weak var hapticFeedback: UISwitch!
     @IBOutlet weak var layout: UISegmentedControl!
     @IBOutlet weak var theme: UISegmentedControl!
     @IBOutlet weak var iconStyle: UISegmentedControl!
```

**File**: `README.md` (modified, +4/-1)
```diff
@@ -133,6 +133,9 @@ config.dimMode = .gray(interactive: true)
 // Disable the interactive pan-to-hide gesture.
 config.interactiveHide = false
 
+// Specify haptic feedback (see also MessageView/configureTheme)
+config.haptic = .success
+
 // Specify a status bar style to if the message is displayed directly under the status bar.
 config.preferredStatusBarStyle = .lightContent
 
@@ -407,7 +410,7 @@ A common mistake is attempting to remove an element by setting the corresponding
 `MessageView` provides numerous methods that follow the `configure*` naming convention:
 
 ````swift
-view.configureTheme(.warning)
+view.configureTheme(.warning, includeHaptic: true)
 view.configureContent(title: "Warning", body: "Consider yourself warned.", iconText: "🤔")
 ````
 
```

**File**: `SwiftMessages.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -55,6 +55,7 @@
 		228F7DDE2ACF703A006C9644 /* MessageHostingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */; };
 		228F7DDF2ACF703A006C9644 /* SwiftMessageModifier.swift in Sources */ = {isa = PBXBuildFile; fileRef = 228F7DDC2ACF703A006C9644 /* SwiftMessageModifier.swift */; };
 		228F7DE02ACF703A006C9644 /* MessageViewConvertible.swift in Sources */ = {isa = PBXBuildFile; fileRef = 228F7DDD2ACF703A006C9644 /* MessageViewConvertible.swift */; };
+		22982C172B6030B000852311 /* HapticMessage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 22982C162B6030B000852311 /* HapticMessage.swift */; };
 		2298C2051EE47DC900E2DDC1 /* Weak.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2298C2041EE47DC900E2DDC1 /* Weak.swift */; };
 		2298C2071EE480D000E2DDC1 /* Animator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2298C2061EE480D000E2DDC1 /* Animator.swift */; };
 		2298C2091EE486E300E2DDC1 /* TopBottomAnimation.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2298C2081EE486E300E2DDC1 /* TopBottomAnimation.swift */; };
@@ -147,6 +148,7 @@
 		228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = MessageHostingView.swift; sourceTree = "<group>"; };
 		228F7DDC2ACF703A006C9644 /* SwiftMessageModifier.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = SwiftMessageModifier.swift; sourceTree = "<group>"; };
 		228F7DDD2ACF703A006C9644 /* MessageViewConvertible.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = MessageViewConvertible.swift; sourceTree = "<group>"; };
+		22982C162B6030B000852311 /* HapticMessage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HapticMessage.swift; sourceTree = "<group>"; };
 		2298C2041EE47DC900E2DDC1 /* Weak.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Weak.swift; sourceTree = "<group>"; };
 		2298C2061EE480D000E2DDC1 /* Animator.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Animator.swift; sourceTree = "<group>"; };
 		2298C2081EE486E300E2DDC1 /* TopBottomAnimation.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = TopBottomAnimation.swift; sourceTree = "<group>"; };
@@ -319,6 +321,7 @@
 				864495551D4F7C390056EB2A /* Identifiable.swift */,
 				86AAF81D1D5549680031EE32 /* MarginAdjustable.swift */,
 				22E307FE1E74C5B100E35893 /* AccessibleMessage.swift */,
+				22982C162B6030B000852311 /* HapticMessage.swift */,
 				86AAF82A1D580DD70031EE32 /* Error.swift */,
 				2298C2061EE480D000E2DDC1 /* Animator.swift */,
 				2298C2041EE47DC900E2DDC1 /* Weak.swift */,
@@ -560,6 +563,7 @@
 				86BBA9011D5E040600FE8F16 /* PassthroughWindow.swift in Sources */,
 				2298C2071EE480D000E2DDC1 /* Animator.swift in Sources */,
 				22D3B4562B1CEF76002D8665 /* Task+Extensions.swift in Sources */,
+				22982C172B6030B000852311 /* HapticMessage.swift in Sources */,
 				86BBA9031D5E040600FE8F16 /* UIViewController+Extensions.swift in Sources */,
 				228F7DDF2ACF703A006C9644 /* SwiftMessageModifier.swift in Sources */,
 				224FB69921153B440081D4DE /* CALayer+Extensions.swift in Sources */,
```

**File**: `SwiftMessages/AccessibleMessage.swift` (modified, +1/-2)
```diff
@@ -9,8 +9,7 @@
 import Foundation
 
 /**
- Message views that `AccessibleMessage`, as `MessageView` does will
- have proper accessibility behavior when displaying messages.
+ Message views that conform to `AccessibleMessage` will have proper accessibility behavior when displaying messages.
  `MessageView` implements this protocol.
  */
 public protocol AccessibleMessage {
```

---

### Incident Patch 7: `e2b1254a` (2024-01-23)
**Commit Message**: Fix SwiftUI handling of the message binding

**File**: `SwiftMessages/SwiftMessageModifier.swift` (modified, +7/-2)
```diff
@@ -75,16 +75,21 @@ private struct SwiftMessageModifier<Message, MessageContent>: ViewModifier where
     func body(content: Content) -> some View {
         content
             .onChange(of: message) { message in
-                if let message {
-                    let show: @MainActor (SwiftMessages.Config, UIView) -> Void = swiftMessages?.show(config:view:) ?? SwiftMessages.show(config:view:)
+                let show: @MainActor (SwiftMessages.Config, UIView) -> Void = swiftMessages?.show(config:view:) ?? SwiftMessages.show(config:view:)
+                let hideAll: @MainActor () -> Void = swiftMessages?.hideAll ?? SwiftMessages.hideAll
+                switch message {
+                case let message?:
                     let view = MessageHostingView(id: message.id, content: messageContent(message))
                     var config = config ?? swiftMessages?.defaultConfig ?? SwiftMessages.defaultConfig
                     config.eventListeners.append { event in
                         if case .didHide = event, event.id == self.message?.id {
                             self.message = nil
                         }
                     }
+                    hideAll()
                     show(config, view)
+                case .none:
+                    hideAll()
                 }
             }
     }
```

---

### Incident Patch 8: `eb9591af` (2024-01-22)
**Commit Message**: Fix SwiftUI hang

**File**: `SwiftMessages/KeyboardTrackingView.swift` (modified, +6/-11)
```diff
@@ -128,20 +128,15 @@ open class KeyboardTrackingView: UIView {
     }
 
     private func animateKeyboardChange(change: Change, height: CGFloat, userInfo: [AnyHashable: Any]) {
-        self.heightConstraint.constant = height
-        if let durationNumber = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber,
-            let curveNumber = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber {
-            CATransaction.begin()
-            CATransaction.setCompletionBlock {
-                self.didChange(change: change, userInfo: userInfo)
-                self.delegate?.keyboardTrackingViewDidChange(change: change, userInfo: userInfo)
-            }
-            let curve = UIView.AnimationCurve(rawValue: curveNumber.intValue) ?? .easeInOut
-            let animation = UIViewPropertyAnimator(duration: durationNumber.doubleValue, curve: curve) {
+        if let durationNumber = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber {
+            UIView.animate(withDuration: durationNumber.doubleValue, delay: 0, options: .curveEaseInOut, animations: {
+                self.heightConstraint.constant = height
                 self.updateConstraintsIfNeeded()
                 self.superview?.layoutIfNeeded()
+            }) { completed in
+                self.didChange(change: change, userInfo: userInfo)
+                self.delegate?.keyboardTrackingViewDidChange(change: change, userInfo: userInfo)
             }
-            animation.startAnimation()
         }
     }
 
```

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +14/-1)
```diff
@@ -10,7 +10,7 @@ import UIKit
 
 /// A rudimentary hosting view for SwiftUI messages.
 @available(iOS 14.0, *)
-public class MessageHostingView<Content>: BaseView, Identifiable where Content: View {
+public class MessageHostingView<Content>: UIView, Identifiable where Content: View {
 
     // MARK: - API
 
@@ -50,4 +50,17 @@ public class MessageHostingView<Content>: BaseView, Identifiable where Content:
         if view == self || view?.superview == self { return nil }
         return view
     }
+
+    // MARK: - Configuration
+
+    private func installContentView(_ contentView: UIView) {
+        contentView.translatesAutoresizingMaskIntoConstraints = false
+        addSubview(contentView)
+        NSLayoutConstraint.activate([
+            contentView.topAnchor.constraint(equalTo: topAnchor),
+            contentView.bottomAnchor.constraint(equalTo: bottomAnchor),
+            contentView.leftAnchor.constraint(equalTo: leftAnchor),
+            contentView.rightAnchor.constraint(equalTo: rightAnchor),
+        ])
+    }
 }
```

---

### Incident Patch 9: `f3555f04` (2023-12-03)
**Commit Message**: Fix typo

**File**: `SwiftMessages/SwiftMessages.swift` (modified, +2/-2)
```diff
@@ -651,7 +651,7 @@ open class SwiftMessages {
         }
     }
 
-    fileprivate weak var autohideToken: AnyObject?
+    fileprivate weak var autohideToken: Presenter?
 
     fileprivate func queueAutoHide() {
         guard let current = _current else { return }
@@ -660,7 +660,7 @@ open class SwiftMessages {
             Task { [weak self] in
                 try? await Task.sleep(seconds: pauseDuration)
                 // Make sure we've still got a green light to auto-hide.
-                guard let self, self.autohideToken !== current else { return }
+                guard let self, self.autohideToken == current else { return }
                 self.internalHide(presenter: current)
             }
         }
```

---

### Incident Patch 10: `95f65d57` (2023-12-03)
**Commit Message**: #534 Fix warnings?

**File**: `SwiftMessages/BaseView.swift` (modified, +5/-5)
```diff
@@ -280,6 +280,11 @@ open class BaseView: UIView, BackgroundViewable, MarginAdjustable {
 
     private var layoutConstraints: [NSLayoutConstraint] = []
     private var regularWidthLayoutConstraints: [NSLayoutConstraint] = []
+
+    open override func layoutSubviews() {
+        super.layoutSubviews()
+        updateShadowPath()
+    }
 }
 
 /*
@@ -334,11 +339,6 @@ extension BaseView {
             // Update the layer's `shadowPath` without animation
             layer.shadowPath = shadowPath        }
     }
-
-    open override func layoutSubviews() {
-        super.layoutSubviews()
-        updateShadowPath()
-    }
 }
 
 /*
```

**File**: `SwiftMessages/MarginAdjustable+Extensions.swift` (modified, +2/-19)
```diff
@@ -13,25 +13,8 @@ extension MarginAdjustable where Self: UIView {
         var layoutMargins: UIEdgeInsets = layoutMarginAdditions
         var safeAreaInsets: UIEdgeInsets = {
             guard respectSafeArea else { return .zero }
-            if #available(iOS 11, *) {
-                insetsLayoutMarginsFromSafeArea = false
-                return self.safeAreaInsets
-            } else {
-                #if SWIFTMESSAGES_APP_EXTENSIONS
-                let application: UIApplication? = nil
-                #else
-                let application: UIApplication? = UIApplication.shared
-                #endif
-                if !context.safeZoneConflicts.isDisjoint(with: [.statusBar]),
-                   let app = application,
-                   app.statusBarOrientation == .portrait || app.statusBarOrientation == .portraitUpsideDown {
-                    let frameInWindow = convert(bounds, to: window)
-                    let top = max(0, 20 - frameInWindow.minY)
-                    return UIEdgeInsets(top: top, left: 0, bottom: 0, right: 0)
-                } else {
-                    return .zero
-                }
-            }
+            insetsLayoutMarginsFromSafeArea = false
+            return self.safeAreaInsets
         }()
         if !context.safeZoneConflicts.isDisjoint(with: .overStatusBar) {
             safeAreaInsets.top = 0
```

**File**: `SwiftMessages/PhysicsAnimation.swift` (modified, +1/-3)
```diff
@@ -93,9 +93,7 @@ public class PhysicsAnimation: NSObject, Animator {
         guard let adjustable = messageView as? MarginAdjustable & UIView,
             let context = context else { return }
         adjustable.preservesSuperviewLayoutMargins = false
-        if #available(iOS 11, *) {
-            adjustable.insetsLayoutMarginsFromSafeArea = false
-        }
+        adjustable.insetsLayoutMarginsFromSafeArea = false
         adjustable.layoutMargins = adjustable.defaultMarginAdjustment(context: context)
     }
 
```

**File**: `SwiftMessages/Presenter.swift` (modified, +26/-39)
```diff
@@ -236,7 +236,7 @@ class Presenter: NSObject {
     }
 
     private func safeZoneConflicts() -> SafeZoneConflicts {
-        guard let window = maskingView.window else { return [] }
+        guard let _ = maskingView.window else { return [] }
         let windowLevel: UIWindow.Level = {
             if let vc = presentationContext.viewControllerValue() as? WindowViewController {
                 return vc.config.windowLevel ?? .normal
@@ -253,47 +253,34 @@ class Presenter: NSObject {
             if let vc = presentationContext.viewControllerValue() as? UITabBarController { return vc.sm_isVisible(view: vc.tabBar) }
             return false
         }()
-        if #available(iOS 11, *) {
-            if windowLevel > .normal {
-                // TODO seeing `maskingView.safeAreaInsets.top` value of 20 on
-                // iPhone 8 with status bar window level. This seems like an iOS bug since
-                // the message view's window is above the status bar. Applying a special rule
-                // to allow the animator to revove this amount from the layout margins if needed.
-                // This may need to be reworked if any future device has a legitimate 20pt top safe area,
-                // such as with a potentially smaller notch.
-                if maskingView.safeAreaInsets.top == 20 {
-                    return [.overStatusBar]
-                } else {
-                    var conflicts: SafeZoneConflicts = []
-                    if maskingView.safeAreaInsets.top > 0 {
-                        conflicts.formUnion(.sensorNotch)
-                    }
-                    if maskingView.safeAreaInsets.bottom > 0 {
-                        conflicts.formUnion(.homeIndicator)
-                    }
-                    return conflicts
+        if windowLevel > .normal {
+            // TODO seeing `maskingView.safeAreaInsets.top` value of 20 on
+            // iPhone 8 with status bar window level. This seems like an iOS bug since
+            // the message view's window is above the status bar. Applying a special rule
+            // to allow the animator to revove this amount from the layout margins if needed.
+            // This may need to be reworked if any future device has a legitimate 20pt top safe area,
+            // such as with a potentially smaller notch.
+            if maskingView.safeAreaInsets.top == 20 {
+                return [.overStatusBar]
+            } else {
+                var conflicts: SafeZoneConflicts = []
+                if maskingView.safeAreaInsets.top > 0 {
+                    conflicts.formUnion(.sensorNotch)
                 }
+                if maskingView.safeAreaInsets.bottom > 0 {
+                    conflicts.formUnion(.homeIndicator)
+                }
+                return conflicts
             }
-            var conflicts: SafeZoneConflicts = []
-            if !underNavigationBar {
-                conflicts.formUnion(.sensorNotch)
-            }
-            if !underTabBar {
-                conflicts.formUnion(.homeIndicator)
-            }
-            return conflicts
-        } else {
-            #if SWIFTMESSAGES_APP_EXTENSIONS
-            return []
-            #else
-            if UIApplication.shared.isStatusBarHidden { return [] }
-            if (windowLevel > UIWindow.Level.normal) || underNavigationBar { return [] }
-            let statusBarFrame = UIApplication.shared.statusBarFrame
-            let statusBarWindowFrame = window.convert(statusBarFrame, from: nil)
-            let statusBarViewFrame = maskingView.convert(statusBarWindowFrame, from: nil)
-            return statusBarViewFrame.intersects(maskingView.bounds) ? SafeZoneConflicts.statusBar : []
-            #endif
         }
+        var conflicts: SafeZoneConflicts = []
+        if !underNavigationBar {
+            conflicts.formUnion(.sensorNotch)
+        }
+        if !underTabBar {
+            conflicts.formUnion(.homeIndicator)
+        }
+        return conflicts
     }
 
     private func getPresentationContext() throws -> PresentationContext {
```

**File**: `SwiftMessages/TopBottomAnimation.swift` (modified, +1/-3)
```diff
@@ -130,9 +130,7 @@ public class TopBottomAnimation: NSObject, Animator {
         guard let adjustable = messageView as? MarginAdjustable & UIView,
             let context = context else { return }
         adjustable.preservesSuperviewLayoutMargins = false
-        if #available(iOS 11, *) {
-            adjustable.insetsLayoutMarginsFromSafeArea = false
-        }
+        adjustable.insetsLayoutMarginsFromSafeArea = false
         var layoutMargins = adjustable.defaultMarginAdjustment(context: context)
         switch style {
         case .top:
```

---

### Incident Patch 11: `62e12e13` (2023-11-01)
**Commit Message**: Couple of fixes

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -1,6 +1,13 @@
 # Change Log
 All notable changes to this project will be documented in this file.
 
+## 9.0.9
+
+### Fixes
+
+* Fix hit testing on SwiftUI views to allow touches around the view's margins to pass through to the underlying view.
+* Update `KeyboardTrackingView` to continue tracking the keyboard even when not installed in the view hierarchy.
+
 ## 9.0.8
 
 ### Changes
```

**File**: `README.md` (modified, +5/-5)
```diff
@@ -206,14 +206,14 @@ struct DemoMessageView: View {
         }
         .multilineTextAlignment(.leading)
         .padding(30)
+        // This makes the message width greedy
         .frame(maxWidth: .infinity)
         .background(.gray)
-        // This makes a tab-style view where the bottom corners are rounded and the view's background
-        // extends to the top edge.
+        // This makes a tab-style view where the bottom corners are rounded and
+        // the view's background extends to the top edge.
         .mask(
-            UnevenRoundedRectangle(
-                cornerRadii: .init(bottomLeading: 15, bottomTrailing: 15)
-            )
+	        UnevenRoundedRectangle(bottomLeadingRadius: 15, bottomTrailingRadius: 15)
+            // This causes the background to extend into the safe area to the screen edge.
             .edgesIgnoringSafeArea(.top)
         )
     }
```

**File**: `SwiftMessages.podspec` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 Pod::Spec.new do |spec|
     spec.name             = 'SwiftMessages'
-    spec.version          = '9.0.8'
+    spec.version          = '9.0.9'
     spec.license          = { :type => 'MIT' }
     spec.homepage         = 'https://github.com/SwiftKickMobile/SwiftMessages'
     spec.authors          = { 'Timothy Moose' => 'tim@swiftkickmobile.com' }
```

**File**: `SwiftMessages/KeyboardTrackingView.swift` (modified, +14/-3)
```diff
@@ -72,6 +72,7 @@ open class KeyboardTrackingView: UIView {
 
     private var isAutomaticallyPaused = false
     private var heightConstraint: NSLayoutConstraint!
+    private var lastObservedKeyboardRect: CGRect?
 
     private func postInit() {
         translatesAutoresizingMaskIntoConstraints = false
@@ -109,15 +110,19 @@ open class KeyboardTrackingView: UIView {
         isAutomaticallyPaused = false
     }
 
+    open override func layoutSubviews() {
+        super.layoutSubviews()
+        heightConstraint.constant = calculateHeightConstant()
+    }
+
     private func show(change: Change, _ notification: Notification) {
         guard !(isPaused || isAutomaticallyPaused),
             let userInfo = (notification as NSNotification).userInfo,
             let value = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else { return }
         willChange(change: change, userInfo: userInfo)
         delegate?.keyboardTrackingViewWillChange(change: change, userInfo: userInfo)
-        let keyboardRect = value.cgRectValue
-        let thisRect = convert(bounds, to: nil)
-        let newHeight = max(0, thisRect.maxY - keyboardRect.minY) + topMargin
+        lastObservedKeyboardRect = value.cgRectValue
+        let newHeight = calculateHeightConstant()
         guard heightConstraint.constant != newHeight else { return }
         animateKeyboardChange(change: change, height: newHeight, userInfo: userInfo)
     }
@@ -140,4 +145,10 @@ open class KeyboardTrackingView: UIView {
             CATransaction.commit()
         }
     }
+
+    private func calculateHeightConstant() -> CGFloat {
+        guard let keyboardRect = lastObservedKeyboardRect else { return 0 }
+        let thisRect = convert(bounds, to: nil)
+        return max(0, thisRect.maxY - keyboardRect.minY) + topMargin
+    }
 }
```

**File**: `SwiftMessages/MessageHostingView.swift` (modified, +8/-0)
```diff
@@ -39,4 +39,12 @@ public class MessageHostingView<Content>: BaseView, Identifiable where Content:
     required init?(coder _: NSCoder) {
         fatalError("init(coder:) has not been implemented")
     }
+
+    public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
+        let view = super.hitTest(point, with: event)
+        // The rendered SwiftUI view isn't a direct child of this hosting view. SwiftUI
+        // inserts another intermediate view that should also ignore touches.
+        if view == self || view?.superview == self { return nil }
+        return view
+    }
 }
```

**File**: `SwiftUIDemo/SwiftUIDemo/DemoMessage.swift` (modified, +2/-1)
```diff
@@ -11,12 +11,13 @@ import SwiftMessages
 struct DemoMessage: Identifiable {
     let title: String
     let body: String
+    let style: DemoMessageView.Style
 
     var id: String { title + body }
 }
 
 extension DemoMessage: MessageViewConvertible {
     func asMessageView() -> DemoMessageView {
-        DemoMessageView(message: self)
+        DemoMessageView(message: self, style: style)
     }
 }
```

**File**: `SwiftUIDemo/SwiftUIDemo/DemoMessageView.swift` (modified, +38/-8)
```diff
@@ -7,11 +7,20 @@
 
 import SwiftUI
 
+// A card-style message view
 struct DemoMessageView: View {
 
     // MARK: - API
 
+    enum Style {
+        case standard
+        case card
+        case tab
+    }
+
     let message: DemoMessage
+    let style: Style
+
 
     // MARK: - Variables
 
@@ -20,21 +29,42 @@ struct DemoMessageView: View {
     // MARK: - Body
 
     var body: some View {
+        switch style {
+        case .standard:
+            content()
+                // Mask the content and extend background into the safe area.
+                .mask {
+                    Rectangle()
+                        .edgesIgnoringSafeArea(.top)
+                }
+        case .card:
+            content()
+                // Mask the content with a rounded rectangle
+                .mask {
+                    RoundedRectangle(cornerRadius: 15)
+                }
+                // External padding around the card
+                .padding(10)
+        case .tab:
+            content()
+                // Mask the content with rounded bottom edge and extend background into the safe area.
+                .mask {
+                    UnevenRoundedRectangle(bottomLeadingRadius: 15, bottomTrailingRadius: 15)
+                        .edgesIgnoringSafeArea(.top)
+                }
+        }
+    }
+
+    @ViewBuilder private func content() -> some View {
         VStack(alignment: .leading) {
             Text(message.title).font(.system(size: 20, weight: .bold))
             Text(message.body)
         }
         .multilineTextAlignment(.leading)
+        // Internal padding of the card
         .padding(30)
+        // Greedy width
         .frame(maxWidth: .infinity)
         .background(.demoMessageBackground)
-        // This makes a tab-style view where the bottom corners are rounded and the view's background
-        // extends to the top edge.
-        .mask(
-            UnevenRoundedRectangle(
-                cornerRadii: .init(bottomLeading: 15, bottomTrailing: 15)
-            )
-            .edgesIgnoringSafeArea(.top)
-        )
     }
 }
```

**File**: `SwiftUIDemo/SwiftUIDemo/DemoView.swift` (modified, +23/-3)
```diff
@@ -13,10 +13,30 @@ struct DemoView: View {
     @State var message: DemoMessage?
 
     var body: some View {
-        Button("Show message") {
-            message = DemoMessage(title: "Demo", body: "This is a sample SwiftUI message! This content should be long enough to wrap.")
+        VStack {
+            Button("Show standard message") {
+                message = DemoMessage(
+                    title: "Demo",
+                    body: "This is a sample SwiftUI card-style message! This content should be long enough to wrap.",
+                    style: .standard
+                )
+            }
+            Button("Show card message") {
+                message = DemoMessage(
+                    title: "Demo",
+                    body: "This is a sample SwiftUI card-style message! This content should be long enough to wrap.",
+                    style: .card
+                )
+            }
+            Button("Show tab message") {
+                message = DemoMessage(
+                    title: "Demo",
+                    body: "This is a sample SwiftUI card-style message! This content should be long enough to wrap.",
+                    style: .tab
+                )
+            }
         }
-        .buttonBorderShape(.roundedRectangle(radius: 15))
+        .buttonStyle(.bordered)
         .swiftMessage(message: $message)
     }
 }
```

---

### Incident Patch 12: `188705b8` (2023-10-06)
**Commit Message**: Fix email address

**File**: `SwiftMessages.podspec` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Pod::Spec.new do |spec|
     spec.version          = '9.0.7'
     spec.license          = { :type => 'MIT' }
     spec.homepage         = 'https://github.com/SwiftKickMobile/SwiftMessages'
-    spec.authors          = { 'Timothy Moose' => 'tim@swiftkick.it' }
+    spec.authors          = { 'Timothy Moose' => 'tim@swiftkickmobile.com' }
     spec.summary          = 'A very flexible message bar for iOS written in Swift.'
     spec.source           = {:git => 'https://github.com/SwiftKickMobile/SwiftMessages.git', :tag => spec.version}
     spec.platform         = :ios, '12.0'
```

---

### Incident Patch 13: `947c4e06` (2023-10-06)
**Commit Message**: Update SwiftUI comments in README.md

**File**: `README.md` (modified, +5/-12)
```diff
@@ -12,29 +12,22 @@
 
 ## Overview
 
-SwiftMessages is a very flexible view and view controller presentation library for iOS.
+🔥🔥🔥 **NEW** SwiftUI support added!
 
-Message views and view controllers can be displayed at the top, bottom, or center of the screen, or behind navigation bars and tab bars. There are interactive dismiss gestures including a fun, physics-based one. Multiple background dimming modes. And a lot more!
+SwiftMessages is a very flexible view and view controller presentation library for UIKit and SwiftUI.
 
-🔥 Now supports displaying SwiftUI message views 🔥
+Message views and view controllers can be displayed at the top, bottom, or center of the screen, or behind navigation bars and tab bars. There are interactive dismiss gestures including a fun, physics-based one. Multiple background dimming modes. And a lot more!
 
 In addition to the numerous configuration options, SwiftMessages provides several good-looking layouts and themes. But SwiftMessages is also designer-friendly, which means you can fully and easily customize the view:
 
 * Copy one of the included nib files into your project and change it.
 * Subclass `MessageView` and add elements, etc.
-* Or just supply an arbitrary instance of `UIView`.
-
-Try exploring [the demo app via appetize.io](http://goo.gl/KXw4nD) to get a feel for the extensive configurability of SwiftMessages.
+* Or just supply an arbitrary instance of `View` or `UIView`.
 
 <p align="center">
   <img src="./Demo/demo.png" />
 </p>
 
-<p align="center">
-	<a href="http://goo.gl/KXw4nD"><img src="./Demo/appetize.png" /></a>
-</p>
-
-
 ## Installation
 
 ### Swift Package Manager
@@ -185,7 +178,7 @@ And check out our blog post [Elegant Custom UIViewController Transitioning](http
 
 Any of the built-in SwiftMessages views can be displayed by calling the SwiftMessages APIs from within observable object, a button action closure, etc. However, SwiftMessages can also display your custom SwiftUI views.
 
-First, define a type that conforms to `MessageViewConvertible`. This will typically be a struct containing the message data:
+The first step is to define a type that conforms to `MessageViewConvertible`. This would typically be a struct containing the message data to display:
 
 
 ````swift
```

---

### Incident Patch 14: `6c16e58c` (2023-10-06)
**Commit Message**: Add basic support for SwiftUI (#528)

**File**: `README.md` (modified, +90/-13)
```diff
@@ -16,6 +16,8 @@ SwiftMessages is a very flexible view and view controller presentation library f
 
 Message views and view controllers can be displayed at the top, bottom, or center of the screen, or behind navigation bars and tab bars. There are interactive dismiss gestures including a fun, physics-based one. Multiple background dimming modes. And a lot more!
 
+🔥 Now supports displaying SwiftUI message views 🔥
+
 In addition to the numerous configuration options, SwiftMessages provides several good-looking layouts and themes. But SwiftMessages is also designer-friendly, which means you can fully and easily customize the view:
 
 * Copy one of the included nib files into your project and change it.
@@ -32,19 +34,6 @@ Try exploring [the demo app via appetize.io](http://goo.gl/KXw4nD) to get a feel
 	<a href="http://goo.gl/KXw4nD"><img src="./Demo/appetize.png" /></a>
 </p>
 
-## View Controllers
-
-SwiftMessages can present view controllers using the `SwiftMessagesSegue` custom modal segue!
-
-<p align="center">
-  <img src="./Design/SwiftMessagesSegue.gif" />
-</p>
-
-[`SwiftMessagesSegue`](./SwiftMessages/SwiftMessagesSegue.swift) is a subclass of `UIStoryboardSegue` that integrates directly into Interface Builder as a custom modal segue, enabling view controllers to take advantage of SwiftMessages layouts, animations and more. `SwiftMessagesSegue` works with any UIKIt project — storyboards are not required. Refer to the View Controllers readme below for more information.
-
-#### [View Controllers Readme](./ViewControllers.md)
-
-And check out our blog post [Elegant Custom UIViewController Transitioning](http://www.swiftkickmobile.com/elegant-custom-uiviewcontroller-transitioning-uiviewcontrollertransitioningdelegate-uiviewcontrolleranimatedtransitioning/) to learn a great technique you can use to build your own custom segues that utilize `UIViewControllerTransitioningDelegate` and `UIViewControllerAnimatedTransitioning`.
 
 ## Installation
 
@@ -178,6 +167,94 @@ config.duration = .forever
 SwiftMessages.show(config: config, view: view)
 ````
 
+### View Controllers
+
+SwiftMessages can present view controllers using the `SwiftMessagesSegue` custom modal segue!
+
+<p align="center">
+  <img src="./Design/SwiftMessagesSegue.gif" />
+</p>
+
+[`SwiftMessagesSegue`](./SwiftMessages/SwiftMessagesSegue.swift) is a subclass of `UIStoryboardSegue` that integrates directly into Interface Builder as a custom modal segue, enabling view controllers to take advantage of SwiftMessages layouts, animations and more. `SwiftMessagesSegue` works with any UIKIt project — storyboards are not required. Refer to the View Controllers readme below for more information.
+
+#### [View Controllers Readme](./ViewControllers.md)
+
+And check out our blog post [Elegant Custom UIViewController Transitioning](http://www.swiftkickmobile.com/elegant-custom-uiviewcontroller-transitioning-uiviewcontrollertransitioningdelegate-uiviewcontrolleranimatedtransitioning/) to learn a great technique you can use to build your own custom segues that utilize `UIViewControllerTransitioningDelegate` and `UIViewControllerAnimatedTransitioning`.
+
+### SwiftUI
+
+Any of the built-in SwiftMessages views can be displayed by calling the SwiftMessages APIs from within observable object, a button action closure, etc. However, SwiftMessages can also display your custom SwiftUI views.
+
+First, define a type that conforms to `MessageViewConvertible`. This will typically be a struct containing the message data:
+
+
+````swift
+struct DemoMessage: Identifiable {
+    let title: String
+    let body: String
+
+    var id: String { title + body }
+}
+
+extension DemoMessage: MessageViewConvertible {
+    func asMessageView() -> DemoMessageView {
+        DemoMessageView(message: self)
+    }
+}
+
+struct DemoMessageView: View {
+
+    let message: DemoMessage
+
+    var body: some View {
+        VStack(alignment: .leading) {
+            Text(message.title).font(.system(size: 20, weight: .bold))
+            Text(message.body)
+        }
+        .multilineTextAlignment(.leading)
+        .padding(30)
+        .frame(maxWidth: .infinity)
+        .background(.gray)
+        .cornerRadius(15)
+        .padding(15)
+    }
+}
+````
+
+The SwiftUI message view can be displayed just like any other UIKit message by using `MessageHostingView`:
+
+````swift
+struct DemoView: View {
+    var body: some View {
+        Button("Show message") {
+            let message = DemoMessage(title: "Demo", body: "SwiftUI forever!")
+            let messageView = MessageHostingView(message: message)
+            SwiftMessages.show(view: messageView)
+        }
+    }
+}
+````
+
+But you may also use a state-based approach using the `swiftMessage()` view modifier:
+
+````swift
+struct DemoView: View {
+
+    @State var message: DemoMessage?
+
+    var body: some View {
+        Button("Show message") {
+            message = DemoMessage(title: "Demo", body: "SwiftUI forever!")
+     
```

**File**: `SwiftMessages.podspec` (modified, +3/-3)
```diff
@@ -1,14 +1,14 @@
 Pod::Spec.new do |spec|
     spec.name             = 'SwiftMessages'
-    spec.version          = '9.0.6'
+    spec.version          = '9.0.7'
     spec.license          = { :type => 'MIT' }
     spec.homepage         = 'https://github.com/SwiftKickMobile/SwiftMessages'
     spec.authors          = { 'Timothy Moose' => 'tim@swiftkick.it' }
     spec.summary          = 'A very flexible message bar for iOS written in Swift.'
     spec.source           = {:git => 'https://github.com/SwiftKickMobile/SwiftMessages.git', :tag => spec.version}
-    spec.platform         = :ios, '9.0'
+    spec.platform         = :ios, '12.0'
     spec.swift_version    = '5.0'
-    spec.ios.deployment_target = '9.0'
+    spec.ios.deployment_target = '12.0'
     spec.framework        = 'UIKit'
     spec.requires_arc     = true
     spec.default_subspec  = 'App'
```

**File**: `SwiftMessages.xcodeproj/project.pbxproj` (modified, +59/-13)
```diff
@@ -3,7 +3,7 @@
 	archiveVersion = 1;
 	classes = {
 	};
-	objectVersion = 46;
+	objectVersion = 54;
 	objects = {
 
 /* Begin PBXBuildFile section */
@@ -52,6 +52,9 @@
 		228DF5681FAD0806004F8A39 /* infoIconSubtle.png in Resources */ = {isa = PBXBuildFile; fileRef = 228DF5471FAD0805004F8A39 /* infoIconSubtle.png */; };
 		228DF5691FAD0806004F8A39 /* successIconLight.png in Resources */ = {isa = PBXBuildFile; fileRef = 228DF5481FAD0805004F8A39 /* successIconLight.png */; };
 		228DF56A1FAD0806004F8A39 /* infoIconSubtle@3x.png in Resources */ = {isa = PBXBuildFile; fileRef = 228DF5491FAD0805004F8A39 /* infoIconSubtle@3x.png */; };
+		228F7DDE2ACF703A006C9644 /* MessageHostingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */; };
+		228F7DDF2ACF703A006C9644 /* SwiftMessageModifier.swift in Sources */ = {isa = PBXBuildFile; fileRef = 228F7DDC2ACF703A006C9644 /* SwiftMessageModifier.swift */; };
+		228F7DE02ACF703A006C9644 /* MessageViewConvertible.swift in Sources */ = {isa = PBXBuildFile; fileRef = 228F7DDD2ACF703A006C9644 /* MessageViewConvertible.swift */; };
 		2298C2051EE47DC900E2DDC1 /* Weak.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2298C2041EE47DC900E2DDC1 /* Weak.swift */; };
 		2298C2071EE480D000E2DDC1 /* Animator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2298C2061EE480D000E2DDC1 /* Animator.swift */; };
 		2298C2091EE486E300E2DDC1 /* TopBottomAnimation.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2298C2081EE486E300E2DDC1 /* TopBottomAnimation.swift */; };
@@ -140,6 +143,9 @@
 		228DF5471FAD0805004F8A39 /* infoIconSubtle.png */ = {isa = PBXFileReference; lastKnownFileType = image.png; name = infoIconSubtle.png; path = Resources/infoIconSubtle.png; sourceTree = "<group>"; };
 		228DF5481FAD0805004F8A39 /* successIconLight.png */ = {isa = PBXFileReference; lastKnownFileType = image.png; name = successIconLight.png; path = Resources/successIconLight.png; sourceTree = "<group>"; };
 		228DF5491FAD0805004F8A39 /* infoIconSubtle@3x.png */ = {isa = PBXFileReference; lastKnownFileType = image.png; name = "infoIconSubtle@3x.png"; path = "Resources/infoIconSubtle@3x.png"; sourceTree = "<group>"; };
+		228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = MessageHostingView.swift; sourceTree = "<group>"; };
+		228F7DDC2ACF703A006C9644 /* SwiftMessageModifier.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = SwiftMessageModifier.swift; sourceTree = "<group>"; };
+		228F7DDD2ACF703A006C9644 /* MessageViewConvertible.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = MessageViewConvertible.swift; sourceTree = "<group>"; };
 		2298C2041EE47DC900E2DDC1 /* Weak.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Weak.swift; sourceTree = "<group>"; };
 		2298C2061EE480D000E2DDC1 /* Animator.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Animator.swift; sourceTree = "<group>"; };
 		2298C2081EE486E300E2DDC1 /* TopBottomAnimation.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = TopBottomAnimation.swift; sourceTree = "<group>"; };
@@ -235,6 +241,15 @@
 			name = Frameworks;
 			sourceTree = "<group>";
 		};
+		228F7DDA2ACF7029006C9644 /* SwiftUI */ = {
+			isa = PBXGroup;
+			children = (
+				228F7DDC2ACF703A006C9644 /* SwiftMessageModifier.swift */,
+				228F7DDD2ACF703A006C9644 /* MessageViewConvertible.swift */,
+			);
+			name = SwiftUI;
+			sourceTree = "<group>";
+		};
 		22D4779B20BF1C54005D0D71 /* View Controllers */ = {
 			isa = PBXGroup;
 			children = (
@@ -339,6 +354,7 @@
 				86AAF8171D54F0650031EE32 /* PassthroughView.swift */,
 				22E01F631E74EC8B00ACE19A /* MaskingView.swift */,
 				86AAF8191D54F0850031EE32 /* PassthroughWindow.swift */,
+				228F7DDB2ACF7039006C9644 /* MessageHostingView.swift */,
 				220D38672597A94C00BB2B88 /* Extensions */,
 			);
 			name = Internal;
@@ -352,6 +368,7 @@
 				862C0CD81D5A396900D06168 /* Resources */,
 				2244656C1EF1D62700C50413 /* Animations */,
 				22D4779B20BF1C54005D0D71 /* View Controllers */,
+				228F7DDA2ACF7029006C9644 /* SwiftUI */,
 				864495571D4F7C490056EB2A /* Base */,
 				220D38682597A9FD00BB2B88 /* Extensions */,
 				867E218E1D4D3DFD00594A41 /* Internal */,
@@ -434,8 +451,9 @@
 		867E21471D4D01D500594A41 /* Project object */ = {
 			isa = PBXProject;
 			attributes = {
+				BuildIndependentTargetsInParallel = YES;
 				LastSwiftUpdateCheck = 0730;
-				LastUpgradeCheck = 1200;
+				LastUpgradeCheck = 1500;
 				ORGANIZATIONNAME = "SwiftKick Mobile";
 				TargetAttributes = {
 					86B48AEB1D5A41C900063E2B = {
@@ -539,13 +557,16 @@
 				86BBA9011D5E040600FE8F16 /* PassthroughWindow.swift in Sources */,
 				2298C2071EE480
```

**File**: `SwiftMessages.xcodeproj/xcshareddata/xcschemes/SwiftMessages.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "1200"
+   LastUpgradeVersion = "1500"
    version = "1.3">
    <BuildAction
       parallelizeBuildables = "YES"
```

**File**: `SwiftMessages/BaseView.swift` (modified, +2/-2)
```diff
@@ -293,7 +293,7 @@ extension BaseView {
     /// because the background view may be masked. So, when modifying the drop shadow,
     /// be sure to set the shadow properties of this view's layer. The shadow path is
     /// updated for you automatically.
-    open func configureDropShadow() {
+    public func configureDropShadow() {
         layer.shadowColor = UIColor.black.cgColor
         layer.shadowOffset = CGSize(width: 0.0, height: 2.0)
         layer.shadowRadius = 6.0
@@ -303,7 +303,7 @@ extension BaseView {
     }
 
     /// A convenience function to turn off drop shadow
-    open func configureNoDropShadow() {
+    public func configureNoDropShadow() {
         layer.shadowOpacity = 0
     }
 
```

**File**: `SwiftMessages/Identifiable.swift` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ import Foundation
  This protocol is optional. Message views that don't adopt `Identifiable` will not
  have duplicates removed.
  */
+
 public protocol Identifiable {
     var id: String { get }
 }
```

**File**: `SwiftMessages/MessageHostingView.swift` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+//
+//  MessageHostingView.swift
+//  SwiftMessages
+//
+//  Created by Timothy Moose on 10/5/23.
+//
+
+import SwiftUI
+import UIKit
+
+/// A rudimentary hosting view for SwiftUI messages.
+@available(iOS 14.0, *)
+public class MessageHostingView<Content>: BaseView, Identifiable where Content: View {
+
+    // MARK: - API
+
+    public let id: String
+
+    public init<Message>(message: Message) where Message: MessageViewConvertible, Message.Content == Content {
+        let messageView: Content = message.asMessageView()
+        hostVC = UIHostingController(rootView: messageView)
+        id = message.id
+        super.init(frame: .zero)
+        hostVC.loadViewIfNeeded()
+        installContentView(hostVC.view)
+        backgroundColor = .clear
+        hostVC.view.backgroundColor = .clear
+    }
+
+    // MARK: - Constants
+
+    // MARK: - Variables
+
+    private let hostVC: UIHostingController<Content>
+
+    // MARK: - Lifecycle
+
+    @available(*, unavailable)
+    required init?(coder _: NSCoder) {
+        fatalError("init(coder:) has not been implemented")
+    }
+}
```

**File**: `SwiftMessages/MessageViewConvertible.swift` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+//
+//  MessageViewConvertible.swift
+//  SwiftUIDemo
+//
+//  Created by Timothy Moose on 10/5/23.
+//
+
+import SwiftUI
+
+@available(iOS 14.0, *)
+/// A protocol used to display a SwiftUI message view using the `swiftMessage()` modifier.
+public protocol MessageViewConvertible: Equatable, Identifiable {
+    associatedtype Content: View
+    func asMessageView() -> Content
+}
+
```

---

### Incident Patch 15: `349fec76` (2021-06-29)
**Commit Message**: Fix warning

**File**: `SwiftMessages/KeyboardTrackingView.swift` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 import UIKit
 
-public protocol KeyboardTrackingViewDelegate: class {
+public protocol KeyboardTrackingViewDelegate: AnyObject {
     func keyboardTrackingViewWillChange(change: KeyboardTrackingView.Change, userInfo: [AnyHashable : Any])
     func keyboardTrackingViewDidChange(change: KeyboardTrackingView.Change, userInfo: [AnyHashable : Any])
 }
```

#### Recent Merged Pull Requests:
- **PR #582** (2025-09-02): Refactor `MessageHostingView` Hit Testing to Improve SwiftUI Touch Handling (@mofeejegi)
- **PR #578** (2025-08-11): Fix crash on iPadOS 18+ when presenting bottom SwiftMessage above UITabBarController (@mofeejegi)
- **PR #577** (2025-06-10): Hide Background Elements from Modal SwiftMessage in VoiceOver mode (@mofeejegi)
- **PR #574** (2025-06-09): Introduce SwiftMessagesHideAction and Environment Key for SwiftUI (@mofeejegi)
- **PR #571** (2025-01-26): PhysicsPanHandler.swift make configure public (@teameh)
- **PR #560** (2024-08-12): SwiftUI layout improvement (@wtmoose)
- **PR #559** (closed): feat: add SwiftUI static APIs (@MojtabaHs)
- **PR #558** (closed): Enhance developer experience (@MojtabaHs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
