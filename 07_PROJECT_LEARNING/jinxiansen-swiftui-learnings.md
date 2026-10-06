# Forensic Learning Record (Deep Inspection): Jinxiansen/SwiftUI

> **Canonical Artifact**: `07_PROJECT_LEARNING/jinxiansen-swiftui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Jinxiansen/SwiftUI](https://github.com/Jinxiansen/SwiftUI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:54:52.222Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Jinxiansen/SwiftUI`
- **Description**: `SwiftUI` Framework  Learning and Usage Guide. 🚀 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5443 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Example/Example/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  Example
//
//  Created by 晋先森 on 2019/6/7.
//  Copyright © 2019 晋先森. All rights reserved.
//

import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {



    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Called when a new scene session is being created.
        // Use this method to select a configuration to create the new scene with.
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // Called when the user discards a scene session.
        // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
        // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
    }


}


```

### Core Architecture Module: `Example/Example/ContentView.swift`
```
//
//  ContentView.swift
//  Example
//
//  Created by 晋先森 on 2019/6/7.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

struct ContentView : View {
    
    var body: some View {
        NavigationView {
            List {
                Section(header: Text("Animation")) {
                    NavigationLink(destination: LotteryView()) {
                        PageRow(title: "LotteryView", subTitle: "Rotation Lottery")
                    }
                }
                Section(header: Text("特殊视图")) {
                    NavigationLink(destination: WebViewPage()) {
                        PageRow(title: "WebView", subTitle: "用于展示一个打开的网页")
                    }
                    NavigationLink(destination: ControllerPage<UIKitController>()) {
                        PageRow(title: "UIViewController", subTitle: "打开 UIViewController")
                    }
                    NavigationLink(destination: SpacerPage()) {
                        PageRow(title: "Spacer", subTitle: "一个空白占用视图,为了方便展示,已用黄色标出")
                    }
                }
                Section(header: Text("基础控件")) {
                    NavigationLink(destination: TextPage()) {
                        PageRow(title: "Text",subTitle: "显示一行或多行只读文本")
                    }
                    NavigationLink(destination: TextFieldPage()) {
                        PageRow(title: "TextField", subTitle: "显示可编辑文本界面的输入控件")
                    }
                    NavigationLink(destination: TextFieldPage()) {
                        PageRow(title: "SecureField", subTitle: "安全输入私密文本的输入控件")
                    }
                    NavigationLink(destination: ImagePage()) {
                        PageRow(title: "Image",subTitle: "用以展示本地图片")
                    }
                    NavigationLink(destination: WebImagePage()) {
                        PageRow(title: "WebImage",subTitle: "下载网络图片并展示")
                    }
                }
                Section(header: Text("按钮")) {
                    NavigationLink(destination: ButtonPage()) {
                        PageRow(title: "Button",subTitle: "触发时执行操作的按钮")
                    }
                    NavigationLink(destination: NavigationButtonPage()) {
                        PageRow(title: "NavigationButton",subTitle: "按下时触发导航跳转的按钮")
                    }
                    NavigationLink(destination: Text("I'm Text")) {
                        PageRow(title: "PresentationButton",subTitle: "触发时显示内容的按钮控件")
                    }
                    NavigationLink(destination: EditButtonPage()) {
                        PageRow(title: "EditButton",subTitle: "用于切换当前编辑模式的按钮")
                    }
                }
                
                Section(header: Text("选择器")) {
                    NavigationLink(destination: PickerPage()) {
                        PageRow(title: "Picker",subTitle: "可自定义数据源的 Picker 选择器")
                    }
                    NavigationLink(destination: DatePickerPage()) {
                        PageRow(title: "DatePicker",subTitle: "日期展示与选择")
                    }
                    NavigationLink(destination: TogglePage()) {
                        PageRow(title: "Toggle",subTitle: "开关状态切换")
                    }
                    NavigationLink(destination: SliderPage()) {
                        PageRow(title: "Slider",subTitle: "用以设置指定范围内的值")
                    }
                    NavigationLink(destination: StepperPage()) {
                        PageRow(title: "Stepper",subTitle: "用以增加或减少数值")
                    }

                }
                
                Section(header: Text("布局")) {
                    NavigationLink(destination: HStackPage()) {
                        PageRow(title: "HStack",subTitle: "将子视图排列在水平线上的视图")
                    }
                    NavigationLink(destination: VStackPage()) {
                        PageRow(title: "VStack",subTitle: "将子视图排列在垂直线上的视图")
                    }
                    NavigationLink(destination: ZStackPage()) {
                        PageRow(title: "ZStack",subTitle: "覆盖子视图，在两轴上对齐")
                    }
                    NavigationLink(destination: ListPage()) {
                        PageRow(title: "List",subTitle: "列表容器，用以显示一列数据")
                    }
                    NavigationLink(destination: ScrollViewPage()) {
                        PageRow(title: "ScrollView",subTitle: "滚动视图")
                    }
                    NavigationLink(destination: ForEachPage()) {
                        PageRow(title: "ForEach",subTitle: "用于根据已有数据的集合展示视图")
                    }
                    NavigationLink(destination: GroupPage()) {
                        PageRow(title: "Group",subTitle: "用于集合多个视图，对 Group 设置的属性，将作用于每个子视图")
                    }.frame(height: 80)
                    NavigationLink(destination: SectionPage()) {
                        PageRow(title: "Section",subTitle: "用于创建带头/尾部的视图内容，一般结合 `List` 组件使用")
                    }.frame(height: 80)
                    NavigationLink(destination: FormPage(firstName: "", lastName: "")) {
                           PageRow(title: "Form",subTitle: "表单视图")
                    }
                }
                Section(header: Text("导航视图")) {
                    NavigationLink(destination: NavigationViewPage()) {
                        PageRow(title: "NavigationView",subTitle: "用于创建包含顶部导航栏的视图容器")
                    }
                    NavigationLink(destination: TableViewPage()) {
                        PageRow(title: "TabBar",subTitle: "用于创建包含底部 TabBar 的视图容器")
                    }
                }
                Section(header: Text("Alert 弹框视图")) {
                    NavigationLink(destination: AlertPage()) {
                        PageRow(title: "Alert",subTitle: "展示一个弹框提醒")
                    }
                    NavigationLink(destination: ActionSheetPage()) {
                        PageRow(title: "ActionSheet",subTitle: "弹出一个选择框")
                    }
                    NavigationLink(destination: ModalPage()) {
                        PageRow(title: "Modal",subTitle: "Modal 弹出一个视图")
                    }
                    NavigationLink(destination: PopoverPage()) {
                        PageRow(title: "Popover",subTitle: "Pop 弹出一个视图")
                    }
                }
            }
            .listStyle(GroupedListStyle())
            .navigationBarTitle(Text("Example"), displayMode: .large)
            .navigationBarItems(trailing: Button(action: {
                print("Tap")
            }, label: {
                Text("Right").foregroundColor(.orange)
            }))

        }
    }
    
}


#if DEBUG
struct ContentView_Previews : PreviewProvider {
    static var previews: some View {
        ContentView().colorScheme(.dark)
    }
}
#endif


```

### Core Architecture Module: `Example/Example/Extension/Color+Ext.swift`
```
//
//  Extension.swift
//  Example
//
//  Created by 晋先森 on 2019/6/10.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

extension Color {
    var gradient: AngularGradient {
        return AngularGradient(gradient: Gradient(colors: [self]),center: .center)
    }
}


```

### Core Architecture Module: `Example/Example/Extension/View+Ext.swift`
```
//
//  View+Ext.swift
//  Example
//
//  Created by 晋先森 on 2019/6/10.
//  Copyright © 2019 晋先森. All rights reserved.
//

import Foundation
import SwiftUI

extension View {
    static var name: String {
        return String(describing: self)
    }
}

```

### Core Architecture Module: `Example/Example/Extension/Window+Ext.swift`
```
//
//  Window+Ext.swift
//  Example
//
//  Created by spectatorNan on 2019/8/28.
//  Copyright © 2019 Spectator. All rights reserved.
//

import UIKit

struct MainApp {
    
    
    /// keyWindow
    // 'keyWindow' was deprecated in iOS 13.0: Should not be used for applications that support multiple scenes as it returns a key window across all connected scenes
    //  https://stackoverflow.com/questions/57134259/how-to-resolve-keywindow-was-deprecated-in-ios-13-0
    public static var keyWindow: UIWindow? {
        return UIApplication.shared.connectedScenes
            .filter({$0.activationState == .foregroundActive})
            .map({$0 as? UIWindowScene})
            .compactMap({$0})
            .first?.windows
            .filter({$0.isKeyWindow}).first ?? nil
    }
}

```

### Core Architecture Module: `Example/Example/Page/Alert/ActionSheetPage.swift`
```
//
//  ActionSheetPage.swift
//  Example
//
//  Created by 晋先森 on 2019/6/15.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

struct ActionSheetPage : View {
    
    @State var showSheet = false
    var body: some View {
        VStack {
            Button(action: {
                self.showSheet = true
            }) {
                Text("ActionSheet")
                    .bold()
                    .font(.system(.largeTitle,
                                  design: .rounded))
            }
            .actionSheet(isPresented: $showSheet, content: {sheet})
        }

    }
    
    private var sheet: ActionSheet {

        let action = ActionSheet(title: Text("Title"),
                                 message: Text("Message"),
                                 buttons:
            [.default(Text("Default"), action: {
                print("Default")
                self.showSheet = false
            }),.destructive(Text("destructive"), action: {
                print("destructive")
                self.showSheet = false
            }),.cancel({
                print("Cancel")
                self.showSheet = false
            })])
        
        return action
    }
}

#if DEBUG
struct ActionSheetPage_Previews : PreviewProvider {
    static var previews: some View {
        ActionSheetPage()
    }
}
#endif

```

### Core Architecture Module: `Example/Example/Page/Alert/AlertPage.swift`
```
//
//  AlertPage.swift
//  Example
//
//  Created by 晋先森 on 2019/6/8.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

struct AlertPage : View {
    
    @State var showAlert = false
    
    var body: some View {
        Button(action: {
            self.showAlert = true
            print("Tap")
        }) {
            Text("Click")
                .font(.system(size: 40,
                              design: .rounded))
        }
        .alert(isPresented: $showAlert, content: {
            Alert(title: Text("确定要支付这100000美元吗？"),
                  message: Text("请谨慎操作\n一旦确认，钱款将立即转入对方账户"),
                  primaryButton: .destructive(Text("确认")) { print("已转出") },
                  secondaryButton: .cancel())
        }).navigationBarTitle(Text("Alert"))
        
    }
}

#if DEBUG
struct AlertPage_Previews : PreviewProvider {
    static var previews: some View {
        AlertPage()
    }
}
#endif

```

### Core Architecture Module: `Example/Example/Page/Alert/ModalPage.swift`
```
//
//  ModalPage.swift
//  Example
//
//  Created by 晋先森 on 2019/6/15.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

struct ModalPage : View {
    
    @State var showModal = false
    
    var body: some View {
        VStack {
            Button(action: {
                self.showModal = true
            }) {
                Text("Modal View")
                    .bold()
                    .font(.system(.largeTitle,
                                  design: .serif))
            }//.presentation(showModal ? modal:nil)
            //            .sheet(isPresented: $showModal, content: PickerPage())
        }
    }
}

#if DEBUG
struct ModalPage_Previews : PreviewProvider {
    static var previews: some View {
        ModalPage()
    }
}
#endif

```

### Core Architecture Module: `Example/Example/Page/Alert/PopoverPage.swift`
```
//
//  PopoverPage.swift
//  Example
//
//  Created by 晋先森 on 2019/6/15.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

struct PopoverPage : View {
    
    @State var showPop = false
    
    var body: some View {
        VStack {
            Button(action: {
                self.showPop = true
                print(self.showPop)
            }) {
                Text("Popover").bold().font(.system(.largeTitle, design: .monospaced))
            }
            .popover(isPresented: $showPop, content: {
                ImagePage()
            })
        }
    }
}

#if DEBUG
struct PopoverPage_Previews : PreviewProvider {
    static var previews: some View {
        PopoverPage()
    }
}
#endif

```

### Core Architecture Module: `Example/Example/Page/Button/ButtonPage.swift`
```
//
//  Button.swift
//  Example
//
//  Created by 晋先森 on 2019/6/7.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

struct ButtonPage : View {
    
    var body: some View {
        Button(action: {
            print("Tap")
        }) {
            Text("I'm a Button").bold()
                .font(.system(size: 40,design: .rounded))
                .shadow(radius: 1)
        }.navigationBarTitle(Text("Button"))
    }
}

#if DEBUG
struct ButtonPage_Previews : PreviewProvider {
    static var previews: some View {
        ButtonPage()
    }
}
#endif

```

### Core Architecture Module: `Example/Example/Page/Button/EditButtonPage.swift`
```
//
//  EditButtonPage.swift
//  Example
//
//  Created by 晋先森 on 2019/6/8.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI
import Combine

struct EditButtonPage : View {
    
    @ObservedObject private var source = dataSource()
    
    var body: some View {
        List {
            
            ForEach(source.items, id: \.self) { idx in
                PageRow(title: "\(idx)")
                }
                .onDelete(perform: deletePlace)
                .onMove(perform: movePlace)
            }
            .navigationBarTitle(Text("Edit Row"), displayMode: .large)
            .navigationBarItems(trailing: EditButton())
    }
    
    func deletePlace(at offset: IndexSet) {
        if let last = offset.last {
            source.items.remove(at: last)
            print(source.items.count)
        }
    }
    
    func movePlace(from source: IndexSet, to destination: Int) {
        print(source,destination)
    }
    
}

class dataSource: ObservableObject {
    
    public var didChange = PassthroughSubject<Void, Never>()

    public var items: [Int] {
        didSet {
            didChange.send(())
        }
    }
    
    init() {
        self.items = (0..<10).map { $0 }
    }
}


#if DEBUG
struct EditButtonPage_Previews : PreviewProvider {
    static var previews: some View {
        EditButtonPage()
    }
}
#endif

```

### Core Architecture Module: `Example/Example/Page/Button/NavigationButtonPage.swift`
```
//
//  NavigationButton.swift
//  Example
//
//  Created by 晋先森 on 2019/6/8.
//  Copyright © 2019 晋先森. All rights reserved.
//

import SwiftUI

struct NavigationButtonPage : View {
    var body: some View {
        NavigationLink(destination: NavigationButtonPage()) {
            Text("NavigationButton").bold()
                .foregroundColor(.orange)
                .font(.largeTitle)
            }
    .navigationBarTitle(Text("Page"))
    }
}

#if DEBUG
struct NavigationButtonPage_Previews : PreviewProvider {
    static var previews: some View {
        NavigationButtonPage()
    }
}
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #43** (2024-02-17): **Revert "Menus"**
  *Symptoms*: Reverts Jinxiansen/SwiftUI#38

- **Issue #38** (2023-06-06): **Menus**
  *Symptoms*: -Updated iOS version to support up to 16.2 -Added an example implementation of Menus (introduced in iOS 14)
  **Post-Mortem & Fix Analysis**:
  > Due to this issue, this PR has been will be reverted first.  https://github.com/Jinxiansen/SwiftUI/issues/42 <img width="1400" alt="image" src="https://github.com/Jinxiansen/SwiftUI/assets/16829428/b2a441b7-a570-4882-8099-0e715958fe89"> 

- **Issue #37** (2023-03-09): **SwiftUI issue**
  *Symptoms*: ## Version macOS version:  Xcode version:   ## Description  Describe your problem:

- **Issue #36** (2022-11-26): **[Add] spacer to Special Views**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contribution!

- **Issue #35** (2022-08-17): **Update README.md**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @Jinxiansen no worries, thanks for the detailed readme. I came across with your repo through some examples and links :D And noticed the typo.

- **Issue #34** (2022-02-12): **Update README.md**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Thank you so much!

- **Issue #33** (2022-02-17): **Update README_CN.md**
  *Symptoms*: 

- **Issue #32** (2022-02-17): **SwiftUI issue**
  *Symptoms*: ## Version macOS version:  Xcode version:   ## Description  Describe your problem:

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

### Incident Patch 1: `d8192c12` (2024-02-17)
**Commit Message**: Merge pull request #43 from Jinxiansen/revert-38-master

Revert "Menus"

**File**: `Example/Example/ContentView.swift` (modified, +0/-3)
```diff
@@ -108,9 +108,6 @@ struct ContentView : View {
                     NavigationLink(destination: FormPage(firstName: "", lastName: "")) {
                            PageRow(title: "Form",subTitle: "表单视图")
                     }
-                    NavigationLink(destination: MenuPage()) {
-                           PageRow(title: "Menu",subTitle: "Menu Page")
-                    }
                 }
                 Section(header: Text("导航视图")) {
                     NavigationLink(destination: NavigationViewPage()) {
```

**File**: `Example/Example/Page/Container/MenuPage.swift` (removed, +0/-68)
```diff
@@ -1,68 +0,0 @@
-//
-//  MenuPage.swift
-//  Menu Example
-//
-//  Created by alexp141 on 4/28/23.
-//  Copyright © 2023 晋先森. All rights reserved.
-//
-
-import SwiftUI
-
-//showing of Menus introduced in iOS 14
-struct MenuPage: View {
-    @State private var message: String = "Click the menu button"
-    @State private var image: Image?
-    @State private var messageColor: Color = .black
-    
-    var body: some View {
-        VStack {
-            Text(message).foregroundColor(messageColor)
-            if let image = image {
-                image.resizable().frame(width: 200, height: 200)
-            }
-            Menu {
-                Button("Display Text") {
-                    self.message = "You have clicked the text button"
-                }
-                
-                Button("Show Image") {
-                    self.image = Image("icon")
-                    
-                }
-                //Menus can appear inside other Menus
-                Menu {
-                    Button("Red") {
-                        self.messageColor = .red
-                    }
-                    Button("Green") {
-                        self.messageColor = .green
-                    }
-                    Button("Blue") {
-                        self.messageColor = .blue
-                    }
-                    Button("Black") {
-                        self.messageColor = .black
-                    }
-                } label: {
-                    Button("Text Color") {
-                        //button clicked
-                    }
-                }
-            } label: {
-                Button("Menu") {
-                    //button clicked
-                }.frame(width: 150, height: 35)
-                    .foregroundColor(.white)
-                    .background(.blue)
-                    .cornerRadius(10.0)
-            }
-        }
-        
-    }
-}
-
-struct MenuPage_Previews: PreviewProvider {
-    static var previews: some View {
-        MenuPage()
-    }
-}
```

---

### Incident Patch 2: `fc3f9c32` (2024-02-17)
**Commit Message**: Revert "Menus"

**File**: `Example/Example/ContentView.swift` (modified, +0/-3)
```diff
@@ -108,9 +108,6 @@ struct ContentView : View {
                     NavigationLink(destination: FormPage(firstName: "", lastName: "")) {
                            PageRow(title: "Form",subTitle: "表单视图")
                     }
-                    NavigationLink(destination: MenuPage()) {
-                           PageRow(title: "Menu",subTitle: "Menu Page")
-                    }
                 }
                 Section(header: Text("导航视图")) {
                     NavigationLink(destination: NavigationViewPage()) {
```

**File**: `Example/Example/Page/Container/MenuPage.swift` (removed, +0/-68)
```diff
@@ -1,68 +0,0 @@
-//
-//  MenuPage.swift
-//  Menu Example
-//
-//  Created by alexp141 on 4/28/23.
-//  Copyright © 2023 晋先森. All rights reserved.
-//
-
-import SwiftUI
-
-//showing of Menus introduced in iOS 14
-struct MenuPage: View {
-    @State private var message: String = "Click the menu button"
-    @State private var image: Image?
-    @State private var messageColor: Color = .black
-    
-    var body: some View {
-        VStack {
-            Text(message).foregroundColor(messageColor)
-            if let image = image {
-                image.resizable().frame(width: 200, height: 200)
-            }
-            Menu {
-                Button("Display Text") {
-                    self.message = "You have clicked the text button"
-                }
-                
-                Button("Show Image") {
-                    self.image = Image("icon")
-                    
-                }
-                //Menus can appear inside other Menus
-                Menu {
-                    Button("Red") {
-                        self.messageColor = .red
-                    }
-                    Button("Green") {
-                        self.messageColor = .green
-                    }
-                    Button("Blue") {
-                        self.messageColor = .blue
-                    }
-                    Button("Black") {
-                        self.messageColor = .black
-                    }
-                } label: {
-                    Button("Text Color") {
-                        //button clicked
-                    }
-                }
-            } label: {
-                Button("Menu") {
-                    //button clicked
-                }.frame(width: 150, height: 35)
-                    .foregroundColor(.white)
-                    .background(.blue)
-                    .cornerRadius(10.0)
-            }
-        }
-        
-    }
-}
-
-struct MenuPage_Previews: PreviewProvider {
-    static var previews: some View {
-        MenuPage()
-    }
-}
```

---

### Incident Patch 3: `ba0b3336` (2021-09-14)
**Commit Message**: Revert "# Update README.md"

This reverts commit d69be3252740fcf2b76d4497e472b0f29877eb80.

**File**: `README.md` (modified, +0/-15)
```diff
@@ -15,21 +15,6 @@ When learning and using `SwiftUI`, if you have any questions, you can join the S
 
 [中文版🇨🇳](README_CN.md)
 
-<div class="warning" style='padding:0.1em;border-radius: 4px; background-color:#FFCC0040; color:#666666'>
-<span>
-
-<p style='margin-top:1em; text-align:center'>
-<a href="https://github.com/Jinxiansen/Windows11"><p style="text-align:center; font-weight: bold;">Windows 11 in SwiftUI</p></a>
-
-<p style='margin-left:1em;'>
-This is the GUI desktop of the Windows 11 operating system completed with <b> SwiftUI </b>.
-You can preview the current degree of completion here and download the SwiftUI source code for viewing.
-
-<p style='margin-bottom:1em; margin-right:1em; text-align:right;'><i><b> Recommend to the loyal fans of SwiftUI</b></i>
-</p>
-</span>
-</div>
-
 ### ⭐️ Stargazers over time
 
 [![Stargazers over time](https://starchart.cc/Jinxiansen/SwiftUI.svg)](https://starchart.cc/Jinxiansen/SwiftUI)
```

**File**: `README_CN.md` (modified, +0/-15)
```diff
@@ -15,21 +15,6 @@
 
 [English 📔](README.md)
 
-<div class="warning" style='padding:0.1em;border-radius: 4px; background-color:#FFCC0040; color:#666666'>
-<span>
-
-<p style='margin-top:1em; text-align:center'>
-<a href="https://github.com/Jinxiansen/Windows11"><p style="text-align:center; font-weight: bold;">Windows 11 in SwiftUI</p></a>
-
-<p style='margin-left:1em;'>
-这是使用 <b> SwiftUI </b> 完成的 Windows 11 操作系统的 GUI 桌面。
-你可以在这里预览当前的完成度并下载 SwiftUI 源码进行查看。
-
-<p style='margin-bottom:1em; margin-right:1em; text-align:right;'><i><b> 推荐给 SwiftUI 的忠实粉丝。</b></i>
-</p>
-</span>
-</div>
-
 ### [Whats New in SwiftUI?](https://developer.apple.com/xcode/swiftui/)
 
 
```

---

### Incident Patch 4: `89432f76` (2019-12-03)
**Commit Message**: Fix naming TableView => TabView

**File**: `README.md` (modified, +4/-4)
```diff
@@ -79,7 +79,7 @@ When learning and using `SwiftUI`, if you have any questions, you can join the S
 
 * <span id="Architectural_D">Architectural Views</span>
 	- [NavigationView](#NavigationView)
-	- [TableView](#TableView)
+	- [TabView](#TabView)
 	- [HSplitView](#HSplitView)
 	- [VSplitView](#VSplitView)
 
@@ -712,9 +712,9 @@ NavigationView {
 
 [🔝](#Layout_D)
 
-<h4 id="TableView"> TableView </h4>
+<h4 id="TabView"> TabView </h4>
 
-`TableView` is used to create a view container that contains the bottom ** TabBar**.
+`TabView` is used to create a view container that contains the bottom ** TabBar**.
 
 Example:
 
@@ -733,7 +733,7 @@ TabView(selection: $index) {
 
 <details close>
   <summary>View running results</summary>
-<img width="80%" src="images/example/TableView.png"/>
+<img width="80%" src="images/example/TabView.png"/>
 </details>
 
 [🔝](#Layout_D)
```

**File**: `README_CN.md` (modified, +4/-4)
```diff
@@ -83,7 +83,7 @@
 
 * <span id="Architectural_D">Architectural Views 导航、切换、排列</span>
 	- [NavigationView](#NavigationView)
-	- [TableView](#TableView)
+	- [TabView](#TabView)
 	- [HSplitView](#HSplitView)
 	- [VSplitView](#VSplitView)
 
@@ -718,9 +718,9 @@ NavigationView {
 
 [🔝](#Layout_D)
 
-<h4 id="TableView"> TableView </h4>
+<h4 id="TabView"> TabView </h4>
 
-`TableView` 用于创建包含底部 ** TabBar** 的视图容器。
+`TabView` 用于创建包含底部 ** TabBar** 的视图容器。
 
 示例:
 
@@ -739,7 +739,7 @@ TabView(selection: $index) {
 
 <details close>
   <summary>查看运行效果</summary>
-<img width="80%" src="images/example/TableView.png"/>
+<img width="80%" src="images/example/TabView.png"/>
 </details>
 
 [🔝](#Layout_D)
```

---

### Incident Patch 5: `6037232c` (2019-09-06)
**Commit Message**: fix run is black

**File**: `Example/Example/SceneDelegate.swift` (modified, +3/-2)
```diff
@@ -15,11 +15,12 @@ class SceneDelegate: UIResponder, UIWindowSceneDelegate {
 
 
     func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
-
-        let window = UIWindow(frame: UIScreen.main.bounds)
+        if let windowScene = scene as? UIWindowScene {
+        let window = UIWindow(windowScene: windowScene)
         window.rootViewController = UIHostingController(rootView: ContentView())
         self.window = window
         window.makeKeyAndVisible()
+        }
     }
 
     func sceneDidDisconnect(_ scene: UIScene) {
```

---

### Incident Patch 6: `1b1db4a6` (2019-08-28)
**Commit Message**: fix warning and error in xcode 11 beta 7 (11M392r)

**File**: `Example/Example.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -46,6 +46,7 @@
 		41FE99E722AAD08A008135A0 /* NavigationButtonPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 41FE99E622AAD08A008135A0 /* NavigationButtonPage.swift */; };
 		41FE99E922AAD7B0008135A0 /* EditButtonPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 41FE99E822AAD7B0008135A0 /* EditButtonPage.swift */; };
 		41FE99F022AADF9F008135A0 /* DatePickerPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 41FE99EF22AADF9F008135A0 /* DatePickerPage.swift */; };
+		D74985BC231634DA00C4D46D /* Window+Ext.swift in Sources */ = {isa = PBXBuildFile; fileRef = D74985BB231634DA00C4D46D /* Window+Ext.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXFileReference section */
@@ -90,6 +91,7 @@
 		41FE99E622AAD08A008135A0 /* NavigationButtonPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NavigationButtonPage.swift; sourceTree = "<group>"; };
 		41FE99E822AAD7B0008135A0 /* EditButtonPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = EditButtonPage.swift; sourceTree = "<group>"; };
 		41FE99EF22AADF9F008135A0 /* DatePickerPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DatePickerPage.swift; sourceTree = "<group>"; };
+		D74985BB231634DA00C4D46D /* Window+Ext.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Window+Ext.swift"; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -117,6 +119,7 @@
 			children = (
 				4132A46222AD709300A8DBBE /* Color+Ext.swift */,
 				4132A46522AD70D400A8DBBE /* View+Ext.swift */,
+				D74985BB231634DA00C4D46D /* Window+Ext.swift */,
 			);
 			path = Extension;
 			sourceTree = "<group>";
@@ -347,6 +350,7 @@
 				41977FF522ACA74600FD47FE /* WebImagePage.swift in Sources */,
 				4196ABE722AA268A008B8FD2 /* TextFieldPage.swift in Sources */,
 				4161B32722AB68F600CD5A1B /* HStackPage.swift in Sources */,
+				D74985BC231634DA00C4D46D /* Window+Ext.swift in Sources */,
 				4164489D22AA6D6500A93AF2 /* ImagePage.swift in Sources */,
 				4161B32922AB695A00CD5A1B /* VStackPage.swift in Sources */,
 				415F044B22AB9A96003E59FC /* AlertPage.swift in Sources */,
```

**File**: `Example/Example/ContentView.swift` (modified, +44/-39)
```diff
@@ -14,123 +14,128 @@ struct ContentView : View {
         NavigationView {
             List {
                 Section(header: Text("特殊视图")) {
-                    NavigationButton(destination: WebViewPage()) {
-                        PageRow(title: "WebView",subTitle: "用于展示一个打开的网页")
+                    NavigationLink(destination: WebViewPage()) {
+                        PageRow(title: "WebView", subTitle: "用于展示一个打开的网页")
                     }
-                    NavigationButton(destination: ControllerPage<UIKitController>()) {
-                        PageRow(title: "UIViewController",subTitle: "打开 UIViewController")
+                    NavigationLink(destination: ControllerPage<UIKitController>()) {
+                        PageRow(title: "UIViewController", subTitle: "打开 UIViewController")
                     }
                 }
                 Section(header: Text("基础控件")) {
-                    NavigationButton(destination: TextPage()) {
+                    NavigationLink(destination: TextPage()) {
                         PageRow(title: "Text",subTitle: "显示一行或多行只读文本")
                     }
-                    NavigationButton(destination: TextFieldPage()) {
+                    NavigationLink(destination: TextFieldPage()) {
                         PageRow(title: "TextField", subTitle: "显示可编辑文本界面的输入控件")
                     }
-                    NavigationButton(destination: TextFieldPage()) {
+                    NavigationLink(destination: TextFieldPage()) {
                         PageRow(title: "SecureField", subTitle: "安全输入私密文本的输入控件")
                     }
-                    NavigationButton(destination: ImagePage()) {
+                    NavigationLink(destination: ImagePage()) {
                         PageRow(title: "Image",subTitle: "用以展示本地图片")
                     }
-                    NavigationButton(destination: WebImagePage()) {
+                    NavigationLink(destination: WebImagePage()) {
                         PageRow(title: "WebImage",subTitle: "下载网络图片并展示")
                     }
                 }
                 Section(header: Text("按钮")) {
-                    NavigationButton(destination: ButtonPage()) {
+                    NavigationLink(destination: ButtonPage()) {
                         PageRow(title: "Button",subTitle: "触发时执行操作的按钮")
                     }
-                    NavigationButton(destination: NavigationButtonPage()) {
+                    NavigationLink(destination: NavigationButtonPage()) {
                         PageRow(title: "NavigationButton",subTitle: "按下时触发导航跳转的按钮")
                     }
-                    PresentationButton(PageRow(title: "PresentationButton", subTitle: "触发时显示内容的按钮控件"),
-                                       destination: Text("I'm Text")) {
-                                        print("Present 🦄")
+                    NavigationLink(destination: Text("I'm Text")) {
+                        PageRow(title: "PresentationButton",subTitle: "触发时显示内容的按钮控件")
                     }
-                    NavigationButton(destination: EditButtonPage()) {
+//                    NavigationLink(PageRow(title: "PresentationButton", subTitle: "触发时显示内容的按钮控件"),
+//                                       destination: Text("I'm Text")) {
+//                                        print("Present 🦄")
+//                    }
+                    NavigationLink(destination: EditButtonPage()) {
                         PageRow(title: "EditButton",subTitle: "用于切换当前编辑模式的按钮")
                     }
                 }
                 
                 Section(header: Text("选择器")) {
-                    NavigationButton(destination: PickerPage()) {
+                    NavigationLink(destination: PickerPage()) {
                         PageRow(title: "Picker",subTitle: "可自定义数据源的 Picker 选择器")
                     }
-                    NavigationButton(destination: DatePickerPage()) {
+                    NavigationLink(destination: DatePickerPage()) {
                         PageRow(title: "DatePicker",subTitle: "日期展示与选择")
                     }
-                    NavigationButton(destination: TogglePage()) {
+                    NavigationLink(destination: TogglePage()) {
                         PageRow(title: "Toggle",subTitle: "开关状态切换")
                     }
-                    NavigationButton(destination: SliderPage()) {
+                    NavigationLink(destination: SliderPage()) {
                         PageRow(title: "Slider",subTitle: "用以设置指定范围内的值")
                     }
-                    NavigationButton(destination: StepperPage()) {
+                    NavigationLink(destination: StepperPage()) {
                         PageRow(title: "Stepper",subTitle: "用以增加或减少数值")
                     }
-                    NavigationButton(destination: SegmentedControlPage()) {
-                        PageRow(title: "SegmentedControl", subTitle: "用以从一组选项中进行选择")
-                    }
+                    // de
```

**File**: `Example/Example/Extension/Window+Ext.swift` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+//
+//  Window+Ext.swift
+//  Example
+//
+//  Created by spectatorNan on 2019/8/28.
+//  Copyright © 2019 Spectator. All rights reserved.
+//
+
+import UIKit
+
+struct MainApp {
+    
+    
+    /// keyWindow
+    // 'keyWindow' was deprecated in iOS 13.0: Should not be used for applications that support multiple scenes as it returns a key window across all connected scenes
+    //  https://stackoverflow.com/questions/57134259/how-to-resolve-keywindow-was-deprecated-in-ios-13-0
+    public static var keyWindow: UIWindow? {
+        return UIApplication.shared.connectedScenes
+        .filter({$0.activationState == .foregroundActive})
+        .map({$0 as? UIWindowScene})
+        .compactMap({$0})
+        .first?.windows
+            .filter({$0.isKeyWindow}).first ?? nil
+    }
+}
```

**File**: `Example/Example/Page/Alert/ActionSheetPage.swift` (modified, +22/-5)
```diff
@@ -20,27 +20,44 @@ struct ActionSheetPage : View {
                     .bold()
                     .font(.system(.largeTitle,
                                   design: .rounded))
-                }.presentation(sheet)
+            }//.sheet(isPresented: $showSheet, onDismiss: nil, content: <#T##() -> View#>)
+            //.presentation(sheet)
+            .actionSheet(isPresented: $showSheet, content: {sheet})
         }
+        
+//        NavigationView {
+//
+//                Button(action: {
+//                    self.showSheet = true
+//                }) {
+//                    Text("ActionSheet")
+//                        .bold()
+//                        .font(.system(.largeTitle,
+//                                      design: .rounded))
+//                    }
+//        }.sheet(isPresented: $showSheet, content: sheet)
+        
+//        ActionSheet.Button.default(<#T##label: Text##Text#>, action: <#T##(() -> Void)?##(() -> Void)?##() -> Void#>)
     }
     
-    private var sheet: ActionSheet? {
+    private var sheet: ActionSheet {
 
        let action = ActionSheet(title: Text("Title"),
                                 message: Text("Message"),
                                 buttons:
-        [.default(Text("Default"), onTrigger: {
+        [.default(Text("Default"), action: {
             print("Default")
             self.showSheet = false
-        }),.destructive(Text("destructive"), onTrigger: {
+        }),.destructive(Text("destructive"), action: {
             print("destructive")
             self.showSheet = false
         }),.cancel({
             print("Cancel")
             self.showSheet = false
         })])
         
-        return self.showSheet ? action:nil
+//        return self.showSheet ? action:nil
+        return action
     }
 }
 
```

**File**: `Example/Example/Page/Alert/AlertPage.swift` (modified, +8/-6)
```diff
@@ -20,12 +20,14 @@ struct AlertPage : View {
             Text("Click")
                 .font(.system(size: 40,
                               design: .rounded))
-            }.presentation($showAlert, alert: {
-                Alert(title: Text("确定要支付这100000000美元吗？"),
-                      message: Text("请谨慎操作\n一旦确认，钱款将立即转入对方账户"),
-                      primaryButton: .destructive(Text("确认")) { print("转出中...") },
-                      secondaryButton: .cancel())
-            }).navigationBarTitle(Text("Alert"))
+            }
+        .alert(isPresented: $showAlert, content: {
+            Alert(title: Text("确定要支付这100000000美元吗？"),
+                  message: Text("请谨慎操作\n一旦确认，钱款将立即转入对方账户"),
+                  primaryButton: .destructive(Text("确认")) { print("转出中...") },
+                  secondaryButton: .cancel())
+        }).navigationBarTitle(Text("Alert"))
+        
     }
 }
 
```

**File**: `Example/Example/Page/Alert/ModalPage.swift` (modified, +10/-7)
```diff
@@ -12,12 +12,14 @@ struct ModalPage : View {
     
     @State var showModal = false
     
-    var modal: Modal {
-        return Modal(PickerPage(),onDismiss: {
-            print("View Dismiss !")
-            self.showModal = false
-        })
-    }
+//    var modal: Modal {
+//        return Modal(PickerPage(),onDismiss: {
+//            print("View Dismiss !")
+//            self.showModal = false
+//        })
+//    }
+
+
     
     var body: some View {
         VStack {
@@ -28,7 +30,8 @@ struct ModalPage : View {
                     .bold()
                     .font(.system(.largeTitle,
                                   design: .serif))
-            }.presentation(showModal ? modal:nil)
+            }//.presentation(showModal ? modal:nil)
+//            .sheet(isPresented: $showModal, content: PickerPage())
         }
     }
 }
```

**File**: `Example/Example/Page/Alert/PopoverPage.swift` (modified, +7/-3)
```diff
@@ -19,11 +19,14 @@ struct PopoverPage : View {
                 print(self.showPop)
             }) {
                 Text("Popover").bold().font(.system(.largeTitle, design: .monospaced))
-            }.presentation(popView)
+            }//.presentation(popView)
+            .popover(isPresented: $showPop, content: {
+                ImagePage()
+            })
         }
     }
-    
-    private var popView: Popover? {
+    /*
+    private var popView: PopImagePageover? {
         
         // 以下 Dismiss 回调，按照官方文档说明是： Action which informs the caller when the popover has been dismissed.
         // 但实际上在pop消失后，下面 dismiss 回调始终无法触发，导致无法再次show，也许是个bug。
@@ -33,6 +36,7 @@ struct PopoverPage : View {
         }
         return self.showPop ? pop:nil
     }
+    */
 }
 
 #if DEBUG
```

**File**: `Example/Example/Page/Button/EditButtonPage.swift` (modified, +7/-5)
```diff
@@ -11,11 +11,12 @@ import Combine
 
 struct EditButtonPage : View {
     
-    @ObjectBinding private var source = dataSource()
+    @ObservedObject private var source = dataSource()
     
     var body: some View {
         List {
-            ForEach(source.items) { idx in
+            
+            ForEach(source.items, id: \.self) { idx in
                 PageRow(title: "\(idx)")
                 }
                 .onDelete(perform: deletePlace)
@@ -26,7 +27,7 @@ struct EditButtonPage : View {
     }
     
     func deletePlace(at offset: IndexSet) {
-        if let last = offset.last?.id {
+        if let last = offset.last {
             source.items.remove(at: last)
             print(source.items.count)
         }
@@ -35,10 +36,11 @@ struct EditButtonPage : View {
     func movePlace(from source: IndexSet, to destination: Int) {
         print(source,destination)
     }
+    
+    
 }
 
-
-class dataSource: BindableObject {
+class dataSource: ObservableObject {
     
     public var didChange = PassthroughSubject<Void, Never>()
 
```

---

### Incident Patch 7: `208d1a07` (2019-06-28)
**Commit Message**: Update swiftui-issue.md

**File**: `.github/ISSUE_TEMPLATE/swiftui-issue.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ assignees: ''
 ## Version
 macOS version:
 
-xCode version: 
+Xcode version: 
 
 ## Description
 
```

---

### Incident Patch 8: `bb03ce4f` (2019-06-28)
**Commit Message**: Update swiftui-issue.md

**File**: `.github/ISSUE_TEMPLATE/swiftui-issue.md` (modified, +3/-1)
```diff
@@ -8,8 +8,10 @@ assignees: ''
 ---
 
 ## Version
-macOS version: ..
+macOS version:
+
 xCode version: 
 
 ## Description
+
 Describe your problem:
```

---

### Incident Patch 9: `3084613f` (2019-06-13)
**Commit Message**: # Add an example of a `UIViewController` and `swiftUI` calling each other.

**File**: `Example/Example.xcodeproj/project.pbxproj` (modified, +18/-2)
```diff
@@ -16,6 +16,8 @@
 		415F044922AB8801003E59FC /* SegmentedControlPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 415F044822AB8801003E59FC /* SegmentedControlPage.swift */; };
 		415F044B22AB9A96003E59FC /* AlertPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 415F044A22AB9A95003E59FC /* AlertPage.swift */; };
 		415F044F22ABA1E3003E59FC /* TogglePage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 415F044E22ABA1E3003E59FC /* TogglePage.swift */; };
+		4160444C22B291000052CAFC /* UIKitController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4160444B22B291000052CAFC /* UIKitController.swift */; };
+		4160445122B2987A0052CAFC /* ControllerPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4160445022B2987A0052CAFC /* ControllerPage.swift */; };
 		4161B32722AB68F600CD5A1B /* HStackPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4161B32622AB68F600CD5A1B /* HStackPage.swift */; };
 		4161B32922AB695A00CD5A1B /* VStackPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4161B32822AB695A00CD5A1B /* VStackPage.swift */; };
 		4161B32B22AB696300CD5A1B /* ZStackPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4161B32A22AB696300CD5A1B /* ZStackPage.swift */; };
@@ -53,6 +55,8 @@
 		415F044822AB8801003E59FC /* SegmentedControlPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SegmentedControlPage.swift; sourceTree = "<group>"; };
 		415F044A22AB9A95003E59FC /* AlertPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AlertPage.swift; sourceTree = "<group>"; };
 		415F044E22ABA1E3003E59FC /* TogglePage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TogglePage.swift; sourceTree = "<group>"; };
+		4160444B22B291000052CAFC /* UIKitController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = UIKitController.swift; sourceTree = "<group>"; };
+		4160445022B2987A0052CAFC /* ControllerPage.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ControllerPage.swift; sourceTree = "<group>"; };
 		4161B32622AB68F600CD5A1B /* HStackPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HStackPage.swift; sourceTree = "<group>"; };
 		4161B32822AB695A00CD5A1B /* VStackPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VStackPage.swift; sourceTree = "<group>"; };
 		4161B32A22AB696300CD5A1B /* ZStackPage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ZStackPage.swift; sourceTree = "<group>"; };
@@ -143,6 +147,17 @@
 			path = List;
 			sourceTree = "<group>";
 		};
+		4160444F22B2985D0052CAFC /* SpecialPage */ = {
+			isa = PBXGroup;
+			children = (
+				415F044A22AB9A95003E59FC /* AlertPage.swift */,
+				41F36F0D22AA8AEC00B9172D /* WebViewPage.swift */,
+				4160445022B2987A0052CAFC /* ControllerPage.swift */,
+				4160444B22B291000052CAFC /* UIKitController.swift */,
+			);
+			path = SpecialPage;
+			sourceTree = "<group>";
+		};
 		4161B32E22AB6D0F00CD5A1B /* Stack */ = {
 			isa = PBXGroup;
 			children = (
@@ -197,13 +212,12 @@
 		4196ABE522AA24B4008B8FD2 /* Page */ = {
 			isa = PBXGroup;
 			children = (
+				4160444F22B2985D0052CAFC /* SpecialPage */,
 				41FE99ED22AADF7C008135A0 /* Text */,
 				41FE99EE22AADF8E008135A0 /* Image */,
 				41FE99EC22AADF6E008135A0 /* Button */,
 				415F044D22ABA051003E59FC /* List */,
 				415F044C22ABA043003E59FC /* Picker */,
-				415F044A22AB9A95003E59FC /* AlertPage.swift */,
-				41F36F0D22AA8AEC00B9172D /* WebViewPage.swift */,
 				4132A46922AEB15A00A8DBBE /* Navigation */,
 				4132A46122AD700F00A8DBBE /* Container */,
 				4161B32E22AB6D0F00CD5A1B /* Stack */,
@@ -321,7 +335,9 @@
 				41F36F1022AA915300B9172D /* ListPage.swift in Sources */,
 				41F36F0A22AA84D600B9172D /* ButtonPage.swift in Sources */,
 				41FE99E722AAD08A008135A0 /* NavigationButtonPage.swift in Sources */,
+				4160444C22B291000052CAFC /* UIKitController.swift in Sources */,
 				4196ABE222AA1B80008B8FD2 /* TextPage.swift in Sources */,
+				4160445122B2987A0052CAFC /* ControllerPage.swift in Sources */,
 				4196ABCA22A97AB1008B8FD2 /* SceneDelegate.swift in Sources */,
 				4161B32B22AB696300CD5A1B /* ZStackPage.swift in Sources */,
 				4161B33022AB6D2900CD5A1B /* ScrollViewPage.swift in Sources */,
```

**File**: `Example/Example/ContentView.swift` (modified, +19/-14)
```diff
@@ -13,6 +13,18 @@ struct ContentView : View {
     var body: some View {
         NavigationView {
             List {
+                Section(header: Text("特殊视图")) {
+                    NavigationButton(destination: WebViewPage()) {
+                        PageRow(title: "WebView",subTitle: "用于展示一个打开的网页")
+                    }
+                    NavigationButton(destination: AlertPage()) {
+                        PageRow(title: "AlertView",subTitle: "用于展示一个弹框提醒")
+                    }
+                    
+                    NavigationButton(destination: ControllerPage<UIKitController>()) {
+                        PageRow(title: "UIViewController",subTitle: "打开 UIViewController")
+                    }
+                }
                 Section(header: Text("基础控件")) {
                     NavigationButton(destination: TextPage()) {
                         PageRow(title: "Text",subTitle: "显示一行或多行只读文本")
@@ -29,15 +41,7 @@ struct ContentView : View {
                     NavigationButton(destination: WebImagePage()) {
                         PageRow(title: "WebImage",subTitle: "下载网络图片并展示")
                     }
-                    NavigationButton(destination: WebViewPage()) {
-                        PageRow(title: "WebView",subTitle: "用于展示一个打开的网页")
-                    }
-                    NavigationButton(destination: AlertPage()) {
-                        PageRow(title: "Alert",subTitle: "用于展示一个弹框提醒")
-                    }
-                    
                 }
-                
                 Section(header: Text("按钮")) {
                     NavigationButton(destination: ButtonPage()) {
                         PageRow(title: "Button",subTitle: "触发时执行操作的按钮")
@@ -56,7 +60,6 @@ struct ContentView : View {
                 }
                 
                 Section(header: Text("选择器")) {
-                    
                     NavigationButton(destination: PickerPage()) {
                         PageRow(title: "Picker",subTitle: "可自定义数据源的 Picker 选择器")
                     }
@@ -99,23 +102,25 @@ struct ContentView : View {
                     NavigationButton(destination: GroupPage()) {
                         PageRow(title: "Group",subTitle: "用于集合多个视图，对 Group 设置的属性，将作用于每个子视图")
                         }.frame(height: 80)
-                    
                     NavigationButton(destination: SectionPage()) {
                         PageRow(title: "Section",subTitle: "用于创建带头/尾部的视图内容，一般结合 `List` 组件使用")
                         }.frame(height: 80)
                 }
-                
                 Section(header: Text("导航视图")) {
                     NavigationButton(destination: NavigationViewPage()) {
                         PageRow(title: "NavigationView",subTitle: "用于创建包含顶部导航栏的视图容器")
                     }
                     NavigationButton(destination: TabBarPage()) {
                         PageRow(title: "TabBar",subTitle: "用于创建包含底部 TabBar 的视图容器")
                     }
-                }
-
-                }.listStyle(.grouped)
+                }}
+                .listStyle(.grouped)
                 .navigationBarTitle(Text("Example"), displayMode: .large)
+                .navigationBarItems(trailing: Button(action: {
+                    print("Tap")
+                }, label: {
+                    Text("Right").color(.orange)
+                }))
         }
     }
     
```

**File**: `Example/Example/Page/Navigation/NavigationViewPage.swift` (modified, +7/-1)
```diff
@@ -13,7 +13,13 @@ struct NavigationViewPage : View {
         NavigationView {
             Text("🧚‍♂️🧚‍♀️🧜‍♂️🧜‍♀️🧞‍♂️🧞‍♀️").blur(radius: 5)
             Text("Swifter Swifter").bold().color(.orange).font(.largeTitle)
-        }.navigationBarTitle(Text("NavigationView"))
+            }.navigationBarTitle(Text("NavigationView"))
+            .navigationBarItems(trailing: Button(action: {
+                print("Tap")
+                
+            }, label: {
+                Text("Right").color(.orange)
+            }))
     }
 }
 
```

**File**: `Example/Example/Page/SpecialPage/ControllerPage.swift` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+//
+//  MakeUIView.swift
+//  Example
+//
+//  Created by 晋先森 on 2019/6/13.
+//  Copyright © 2019 晋先森. All rights reserved.
+//
+
+import Foundation
+import SwiftUI
+import UIKit
+
+struct ControllerPage<T: UIViewController> : UIViewControllerRepresentable {
+    
+    typealias UIViewControllerType = UIViewController
+    
+    func makeUIViewController(context: UIViewControllerRepresentableContext<ControllerPage>) -> UIViewController {
+        return T()
+    }
+    
+    func updateUIViewController(_ uiViewController: UIViewController, context: UIViewControllerRepresentableContext<ControllerPage>) {
+        debugPrint("\(#function)：\(type(of: T.self))")
+    }
+    
+}
+
+
```

**File**: `Example/Example/Page/SpecialPage/UIKitController.swift` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+//
+//  OKController.swift
+//  Example
+//
+//  Created by 晋先森 on 2019/6/13.
+//  Copyright © 2019 晋先森. All rights reserved.
+//
+
+import Foundation
+import UIKit
+import SwiftUI
+
+class UIKitController: UIViewController {
+    
+    override func viewDidLoad() {
+        
+        view.addSubview(button)
+        
+    }
+    
+    lazy var button: UIButton = {
+        let button = UIButton(type: .system)
+        button.setTitle("Open SwiftUI View", for: .normal)
+        button.titleLabel?.font = .boldSystemFont(ofSize: 30)
+        button.setTitleColor(.orange, for: .normal)
+        button.sizeToFit()
+        button.center = view.center
+        button.addTarget(self, action: #selector(openContentView),
+                         for: .touchUpInside)
+        return button
+    }()
+    
+    @objc func openContentView() {
+        
+        let hostVC = UIHostingController(rootView: ContentView())
+        present(hostVC, animated: true, completion: nil)
+    }
+    
+}
```

**File**: `README.md` (modified, +42/-0)
```diff
@@ -56,6 +56,7 @@ When learning and using `SwiftUI`, if you have any questions, you can join the S
 * Other View
 	- [WebView](#WebView)
 	- [Alert](#Alert)
+	- [UIViewController](#UIViewController)
 
 ### Layout
 	
@@ -479,6 +480,47 @@ presentation($showsAlert, alert: {
 </details>
 
 
+<h4 id="UIViewController"> UIViewController </h4>
+
+`UIViewController` is used to display the **UIViewController** that opens **UIKit** in **SwiftUI** and opens the `SwiftUI` View in **UIViewController**.
+
+Example:
+
+First define:
+
+```swift
+struct ControllerPage<T: UIViewController> : UIViewControllerRepresentable {
+    
+    typealias UIViewControllerType = UIViewController
+    
+    func makeUIViewController(context: UIViewControllerRepresentableContext<ControllerPage>) -> UIViewController {
+        return T()
+    }
+    
+    func updateUIViewController(_ uiViewController: UIViewController, context: UIViewControllerRepresentableContext<ControllerPage>) {
+        debugPrint("\(#function)：\(type(of: T.self))")
+    }
+    
+}
+```
+
+Then use this:
+
+```swift
+NavigationButton(destination: ControllerPage<UIKitController>()) {
+    PageRow(title: "UIViewController",subTitle: "Open UIViewController")
+
+}
+```
+
+
+<details close>
+  <summary>View running results</summary>
+<img width="80%" src="images/example/UIViewController.png"/>
+<img width="80%" src="images/example/UIViewController2.png"/>
+</details>
+
+
 ### Layout 
 
 
```

**File**: `README_CN.md` (modified, +42/-0)
```diff
@@ -62,6 +62,7 @@
 * 其他
 	- [WebView](#WebView)
 	- [Alert](#Alert)
+	- [UIViewController](#UIViewController)
 
 ### 布局
 	
@@ -490,6 +491,47 @@ presentation($showsAlert, alert: {
 <img width="80%" src="images/example/Alert.png"/>
 </details>
 
+<h4 id="UIViewController"> UIViewController </h4>
+
+`UIViewController ` 用于展示在 **SwiftUI** 中打开 **UIKit** 的 **UIViewController** ，并且在 **UIViewController** 中打开 `SwiftUI` View。
+
+示例:
+
+先定义：
+
+```swift
+struct ControllerPage<T: UIViewController> : UIViewControllerRepresentable {
+    
+    typealias UIViewControllerType = UIViewController
+    
+    func makeUIViewController(context: UIViewControllerRepresentableContext<ControllerPage>) -> UIViewController {
+        return T()
+    }
+    
+    func updateUIViewController(_ uiViewController: UIViewController, context: UIViewControllerRepresentableContext<ControllerPage>) {
+        debugPrint("\(#function)：\(type(of: T.self))")
+    }
+    
+}
+```
+
+然后调用：
+
+```swift
+NavigationButton(destination: ControllerPage<UIKitController>()) {
+    PageRow(title: "UIViewController",subTitle: "打开 UIViewController")
+
+}
+```
+
+
+<details close>
+  <summary>查看运行效果</summary>
+<img width="80%" src="images/example/UIViewController.png"/>
+<img width="80%" src="images/example/UIViewController2.png"/>
+</details>
+
+
 
 ### 布局 
 
```

---

### Incident Patch 10: `8999c200` (2019-06-11)
**Commit Message**: Merge branch 'master' of https://github.com/Jinxiansen/SwiftUI

**File**: `_config.yml` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+theme: jekyll-theme-slate
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #43** (2024-02-17): Revert "Menus" (@Jinxiansen)
- **PR #38** (2023-06-06): Menus (@alexp141)
- **PR #36** (2022-11-26): [Add] spacer to Special Views (@LikeeCat)
- **PR #35** (2022-08-17): Update README.md (@ozgunemrezor)
- **PR #34** (2022-02-12): Update README.md (@devtofu)
- **PR #33** (2022-02-17): Update README_CN.md (@devtofu)
- **PR #28** (closed): optimzation lottery path code (@SpectatorNan)
- **PR #27** (2020-06-12): remove .DS_Store and prevent it from reappearing (@LucasLarson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
