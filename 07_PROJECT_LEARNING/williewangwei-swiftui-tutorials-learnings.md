# Forensic Learning Record (Deep Inspection): WillieWangWei/SwiftUI-Tutorials

> **Canonical Artifact**: `07_PROJECT_LEARNING/williewangwei-swiftui-tutorials-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/WillieWangWei/SwiftUI-Tutorials](https://github.com/WillieWangWei/SwiftUI-Tutorials))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:45:54.221Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `WillieWangWei/SwiftUI-Tutorials`
- **Description**: A code example and translation project of SwiftUI. / 一个 SwiftUI 的示例、翻译的教程项目。
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2451 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `App-Design-and-Layout/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  App-Design-and-Layout
//
//  Created by Willie on 2019/6/9.
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

### Core Architecture Module: `App-Design-and-Layout/CategoryRow.swift`
```
//
//  CategoryRow.swift
//  App-Design-and-Layout
//
//  Created by Willie on 2019/6/9.
//

import SwiftUI

struct CategoryRow: View {
    var categoryName: String
    var items: [Landmark]
    
    var body: some View {
        VStack(alignment: .leading) {
            Text(self.categoryName)
                .font(.headline)
                .padding(.leading, 15)
                .padding(.top, 5)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(self.items) { landmark in
                        NavigationLink(
                            destination: LandmarkDetail(
                                landmark: landmark
                            )
                        ) {
                            CategoryItem(landmark: landmark)
                        }
                    }
                }
            }
            .frame(height: 185)
        }
    }
}

struct CategoryItem: View {
    var landmark: Landmark
    var body: some View {
        VStack(alignment: .leading) {
            landmark.image
                .renderingMode(.original)
                .resizable()
                .frame(width: 155, height: 155)
                .cornerRadius(5)
            Text(landmark.name)
                .foregroundColor(.primary)
                .font(.caption)
        }
        .padding(.leading, 15)
    }
}

struct CategoryRow_Previews: PreviewProvider {
    static var previews: some View {
        CategoryRow(
            categoryName: landmarkData[0].category.rawValue,
            items: Array(landmarkData.prefix(4))
        )
        .environmentObject(UserData())
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/HexagonParameters.swift`
```
/*
See LICENSE folder for this sample’s licensing information.

Abstract:
Size, position, and other information used to draw a badge.
*/

import SwiftUI

struct HexagonParameters {
    struct Segment {
        let useWidth: (CGFloat, CGFloat, CGFloat)
        let xFactors: (CGFloat, CGFloat, CGFloat)
        let useHeight: (CGFloat, CGFloat, CGFloat)
        let yFactors: (CGFloat, CGFloat, CGFloat)
    }
    
    static let adjustment: CGFloat = 0.085
    static let points = [
        Segment(
            useWidth:  (1.00, 1.00, 1.00),
            xFactors:  (0.60, 0.40, 0.50),
            useHeight: (1.00, 1.00, 0.00),
            yFactors:  (0.05, 0.05, 0.00)
        ),
        Segment(
            useWidth:  (1.00, 1.00, 0.00),
            xFactors:  (0.05, 0.00, 0.00),
            useHeight: (1.00, 1.00, 1.00),
            yFactors:  (0.20 + adjustment, 0.30 + adjustment, 0.25 + adjustment)
        ),
        Segment(
            useWidth:  (1.00, 1.00, 0.00),
            xFactors:  (0.00, 0.05, 0.00),
            useHeight: (1.00, 1.00, 1.00),
            yFactors:  (0.70 - adjustment, 0.80 - adjustment, 0.75 - adjustment)
        ),
        Segment(
            useWidth:  (1.00, 1.00, 1.00),
            xFactors:  (0.40, 0.60, 0.50),
            useHeight: (1.00, 1.00, 1.00),
            yFactors:  (0.95, 0.95, 1.00)
        ),
        Segment(
            useWidth:  (1.00, 1.00, 1.00),
            xFactors:  (0.95, 1.00, 1.00),
            useHeight: (1.00, 1.00, 1.00),
            yFactors:  (0.80 - adjustment, 0.70 - adjustment, 0.75 - adjustment)
        ),
        Segment(
            useWidth:  (1.00, 1.00, 1.00),
            xFactors:  (1.00, 0.95, 1.00),
            useHeight: (1.00, 1.00, 1.00),
            yFactors:  (0.30 + adjustment, 0.20 + adjustment, 0.25 + adjustment)
        )
    ]
}

```

### Core Architecture Module: `App-Design-and-Layout/HikeBadge.swift`
```
//
//  HikeBadge.swift
//  App-Design-and-Layout
//
//  Created by Willie on 2019/6/9.
//

import SwiftUI

struct HikeBadge: View {
    var name: String
    var body: some View {
        VStack(alignment: .center) {
            Badge()
                .frame(width: 300, height: 300)
                .scaleEffect(1.0 / 3.0)
                .frame(width: 100, height: 100)
            Text(name)
                .font(.caption)
                .accessibility(label: Text("Badge for \(name)."))
        }
    }
}

struct HikeBadge_Previews: PreviewProvider {
    static var previews: some View {
        HikeBadge(name: "Preview Testing")
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/HikeDetail.swift`
```
/*
See LICENSE folder for this sample’s licensing information.

Abstract:
A view showing the details for a hike.
*/

import SwiftUI

struct HikeDetail: View {
    let hike: Hike
    @State var dataToShow = \Hike.Observation.elevation
    
    var buttons = [
        ("Elevation", \Hike.Observation.elevation),
        ("Heart Rate", \Hike.Observation.heartRate),
        ("Pace", \Hike.Observation.pace),
    ]
    
    var body: some View {
        return VStack {
            HikeGraph(hike: hike, path: dataToShow)
                .frame(height: 200, alignment: .center)
            
            HStack(spacing: 25) {
                ForEach(buttons, id: \.0) { value in
                    Button(action: {
                        self.dataToShow = value.1
                    }) {
                        Text(verbatim: value.0)
                            .font(.system(size: 15))
                            .foregroundColor(value.1 == self.dataToShow
                                ? Color.gray
                                : Color.accentColor)
                            .animation(nil)
                    }
                }
            }
        }
    }
}

struct HikeDetail_Previews: PreviewProvider {
    static var previews: some View {
        HikeDetail(hike: hikeData[0])
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/HikeView.swift`
```
/*
See LICENSE folder for this sample’s licensing information.

Abstract:
A view displaying inforamtion about a hike, including an elevation graph.
*/

import SwiftUI

struct HikeView: View {
    var hike: Hike
    @State private var showDetail = false
    
    var transition: AnyTransition {
        let insertion = AnyTransition.move(edge: .trailing)
            .combined(with: .opacity)
        let removal = AnyTransition.scale
            .combined(with: .opacity)
        return .asymmetric(insertion: insertion, removal: removal)
    }
    
    var body: some View {
        VStack {
            HStack {
                HikeGraph(hike: hike, path: \.elevation)
                    .frame(width: 50, height: 30)
                    .animation(nil)
                
                VStack(alignment: .leading) {
                    Text(verbatim: hike.name)
                        .font(.headline)
                    Text(verbatim: hike.distanceText)
                }
                
                Spacer()

                Button(action: {
                    withAnimation {
                        self.showDetail.toggle()
                    }
                }) {
                    Image(systemName: "chevron.right.circle")
                        .imageScale(.large)
                        .rotationEffect(.degrees(showDetail ? 90 : 0))
                        .scaleEffect(showDetail ? 1.5 : 1)
                        .padding()
                }
            }

            if showDetail {
                HikeDetail(hike: hike)
                    .transition(transition)
            }
        }
    }
}

struct HikeView_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            HikeView(hike: hikeData[0])
                .padding()
            Spacer()
        }
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/Home.swift`
```
//
//  Home.swift
//  App-Design-and-Layout
//
//  Created by Willie on 2019/6/9.
//

import SwiftUI

struct CategoryHome: View {
    var categories: [String: [Landmark]] {
        Dictionary(
            grouping: landmarkData,
            by: { $0.category.rawValue }
        )
    }
    
    var featured: [Landmark] {
        landmarkData.filter { $0.isFeatured }
    }
    
    @State var showingProfile = false
    @EnvironmentObject var userData: UserData
    
    var profileButton: some View {
        Button(action: { self.showingProfile.toggle() }) {
            Image(systemName: "person.crop.circle")
                .imageScale(.large)
                .accessibility(label: Text("User Profile"))
                .padding()
        }
    }

    var body: some View {
        NavigationView {
            List {
                FeaturedLandmarks(landmarks: featured)
                    .scaledToFill()
                    .frame(height: 200)
                    .clipped()
                    .listRowInsets(EdgeInsets())
                
                ForEach(categories.keys.sorted(), id: \.self) { key in
                    CategoryRow(categoryName: key, items: self.categories[key]!)
                }
                .listRowInsets(EdgeInsets())
                
                NavigationLink(destination: LandmarkList()) {
                    Text("See All")
                }
            }
            .navigationBarTitle(Text("Featured"))
            .navigationBarItems(trailing: profileButton)
            .sheet(isPresented: $showingProfile) {
                ProfileHost()
                    .environmentObject(self.userData)
            }
        }
    }
}

struct FeaturedLandmarks: View {
    var landmarks: [Landmark]
    var body: some View {
        landmarks[0].image.resizable()
    }
}

struct CategoryHome_Previews: PreviewProvider {
    static var previews: some View {
        CategoryHome()
            .environmentObject(UserData())
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/LandmarkDetail.swift`
```
/*
See LICENSE folder for this sample’s licensing information.

Abstract:
A view showing the details for a landmark.
*/

import SwiftUI

struct LandmarkDetail: View {
    @EnvironmentObject var userData: UserData
    var landmark: Landmark
    
    var landmarkIndex: Int {
        userData.landmarks.firstIndex(where: { $0.id == landmark.id })!
    }
    
    var body: some View {
        VStack {
            MapView(coordinate: landmark.locationCoordinate)
                .edgesIgnoringSafeArea(.top)
                .frame(height: 300)
            
            CircleImage(image: landmark.image)
                .offset(x: 0, y: -130)
                .padding(.bottom, -130)
            
            VStack(alignment: .leading) {
                HStack {
                    Text(verbatim: landmark.name)
                        .font(.title)
                    
                    Button(action: {
                        self.userData.landmarks[self.landmarkIndex]
                            .isFavorite.toggle()
                    }) {
                        if self.userData.landmarks[self.landmarkIndex]
                            .isFavorite {
                            Image(systemName: "star.fill")
                                .foregroundColor(Color.yellow)
                        } else {
                            Image(systemName: "star")
                                .foregroundColor(Color.gray)
                        }
                    }
                }
                
                HStack(alignment: .top) {
                    Text(verbatim: landmark.park)
                        .font(.subheadline)
                    Spacer()
                    Text(verbatim: landmark.state)
                        .font(.subheadline)
                }
            }
            .padding()
            
            Spacer()
        }
    }
}

struct LandmarkDetail_Preview: PreviewProvider {
    static var previews: some View {
        let userData = UserData()
        return LandmarkDetail(landmark: userData.landmarks[0])
            .environmentObject(userData)
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/LandmarkList.swift`
```
/*
See LICENSE folder for this sample’s licensing information.

Abstract:
A view showing a list of landmarks.
*/

import SwiftUI

struct LandmarkList: View {
    @EnvironmentObject private var userData: UserData
    
    var body: some View {
        List {
            Toggle(isOn: $userData.showFavoritesOnly) {
                Text("Show Favorites Only")
            }
            
            ForEach(userData.landmarks) { landmark in
                if !self.userData.showFavoritesOnly || landmark.isFavorite {
                    NavigationLink(
                        destination: LandmarkDetail(landmark: landmark)
                            .environmentObject(self.userData)
                    ) {
                        LandmarkRow(landmark: landmark)
                    }
                }
            }
        }
        .navigationBarTitle(Text("Landmarks"))
    }
}

struct LandmarksList_Previews: PreviewProvider {
    static var previews: some View {
        ForEach(["iPhone SE", "iPhone XS Max"], id: \.self) { deviceName in
            NavigationView {
                LandmarkList()
            }
            .previewDevice(PreviewDevice(rawValue: deviceName))
            .previewDisplayName(deviceName)
        }
        .environmentObject(UserData())
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/LandmarkRow.swift`
```
//
//  LandmarkRow.swift
//  App-Design-and-Layout
//
//  Created by 王炜 on 2019/10/12.
//

import SwiftUI

struct LandmarkRow: View {
    var landmark: Landmark

    var body: some View {
        HStack {
            landmark.image
                .resizable()
                .frame(width: 50, height: 50)
            Text(verbatim: landmark.name)
            Spacer()

            if landmark.isFavorite {
                Image(systemName: "star.fill")
                    .imageScale(.medium)
                    .foregroundColor(.yellow)
            }
        }
    }
}

struct LandmarkRow_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            LandmarkRow(landmark: landmarkData[0])
            LandmarkRow(landmark: landmarkData[1])
        }
        .previewLayout(.fixed(width: 300, height: 70))
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/Models/Data.swift`
```
/*
See LICENSE folder for this sample’s licensing information.

Abstract:
Helpers for loading images and data.
*/

import Foundation
import CoreLocation
import UIKit
import SwiftUI

let landmarkData: [Landmark] = load("landmarkData.json")
let hikeData: [Hike] = load("hikeData.json")

func load<T: Decodable>(_ filename: String, as type: T.Type = T.self) -> T {
    let data: Data
    
    guard let file = Bundle.main.url(forResource: filename, withExtension: nil)
    else {
        fatalError("Couldn't find \(filename) in main bundle.")
    }
    
    do {
        data = try Data(contentsOf: file)
    } catch {
        fatalError("Couldn't load \(filename) from main bundle:\n\(error)")
    }
    
    do {
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    } catch {
        fatalError("Couldn't parse \(filename) as \(T.self):\n\(error)")
    }
}

final class ImageStore {
    typealias _ImageDictionary = [String: CGImage]
    fileprivate var images: _ImageDictionary = [:]

    fileprivate static var scale = 2
    
    static var shared = ImageStore()
    
    func image(name: String) -> Image {
        let index = _guaranteeImage(name: name)
        
        return Image(images.values[index], scale: CGFloat(ImageStore.scale), label: Text(verbatim: name))
    }

    static func loadImage(name: String) -> CGImage {
        guard
            let url = Bundle.main.url(forResource: name, withExtension: "jpg"),
            let imageSource = CGImageSourceCreateWithURL(url as NSURL, nil),
            let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
        else {
            fatalError("Couldn't load image \(name).jpg from main bundle.")
        }
        return image
    }
    
    fileprivate func _guaranteeImage(name: String) -> _ImageDictionary.Index {
        if let index = images.index(forKey: name) { return index }
        
        images[name] = ImageStore.loadImage(name: name)
        return images.index(forKey: name)!
    }
}

```

### Core Architecture Module: `App-Design-and-Layout/Models/Hike.swift`
```
/*
See LICENSE folder for this sample’s licensing information.

Abstract:
The model for a hike.
*/

import SwiftUI

struct Hike: Codable, Hashable, Identifiable {
    var name: String
    var id: Int
    var distance: Double
    var difficulty: Int
    var observations: [Observation]

    static var formatter = LengthFormatter()
    
    var distanceText: String {
        return Hike.formatter
            .string(fromValue: distance, unit: .kilometer)
    }

    struct Observation: Codable, Hashable {
        var distanceFromStart: Double
        
        var elevation: Range<Double>
        var pace: Range<Double>
        var heartRate: Range<Double>
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7** (2020-07-09): **Building Lists and Navigation 中 MapView 无法传递 coordinate**
  *Symptoms*: 您好 `let coordinate = CLLocationCoordinate2D(latitude: 29.554987, longitude: 115.984963)` 在注释掉上行代码后添加  `var coordinate: CLLocationCoordinate2D`  并在 PreviewProvider 中给 MapView() 添加  `MapView(coordinate: landmarkData[0].locationCoordinate)`  预览视图就报错了，求解，感谢🙏  代码  <img width="662" alt="image" src="https://user-images.githubusercontent.com/49800659/86997313-58827080-c1e0-11ea-94dd-9f1e83ab69e4.png"> 错误信息 <img width="559" alt="image" src="https://user-images.githubusercontent.com/49800659/86997397-8798e200-c1e0-11ea-8e78-082d6bb62184.png">  
  **Post-Mortem & Fix Analysis**:
  > 查看你的 `landmarkData` 数据是否正确，以及项目 `Resources` 目录下的文件是否和示例一致。
  > 感谢，我数据中经纬度写反了。。错误太低级了 😂

- **Issue #6** (2020-01-14): **文章错误**
  *Symptoms*: 构建列表那篇，cell里漏了一句Spacer,不然cell是居中的
  **Post-Mortem & Fix Analysis**:
  > 谢谢反馈，已修复。

- **Issue #5** (2019-11-23): **构建列表与导航 章节 编译报错**
  *Symptoms*: Landmark.swift 这个文件中 ‘ ImageStore’  报 ‘Use of unresolved identifier 'ImageStore'’
  **Post-Mortem & Fix Analysis**:
  > 1.  查看 `../SwiftUI-Tutorials-master/SwiftUI-Essentials/Models/Data.swift` 文件是否存在并且引入到了工程中。  2.  查看 `Data.swift` 文件中 `ImageStore` 相关的代码是否正常，即：  ```swift final class ImageStore {     typealias _ImageDictionary = [String: CGImage]     fileprivate var images: _ImageDictionary = [:]      fileprivate static var scale = 2          static var shared = ImageStore()          func image(name: String) -> Image {         let index = _guaranteeImage(name: name)                  return Image(images.values[index], scale: CGFloat(ImageStore.scale), label: Text(verbatim: name))     }      static func loadImage(name: String) -> CGImage {         guard             let url = Bundle.main.url(forResource: name, withExtension: "jpg"),             let imageSource = CGImageSourceCreateWithURL(url as NSURL, nil),             let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)         else {             fatalError("Couldn't load image \(name).jpg from main bundle.")         

- **Issue #4** (2019-10-14): **更新了之后 不能编译了哦**
  *Symptoms*: 升级完成 想要跑一下，很多编译错误，希望作者能修改一下。谢谢
  **Post-Mortem & Fix Analysis**:
  > 我也编译不过！咋办
  > 这周会修复错误并更新文档，请持续关注
  > 已修复相关问题，请查看 v1.0.2

- **Issue #3** (2019-09-03): **部分代码需要更新了，一些api已经修改了呢**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 谢谢，你看到哪部分的API或代码变更了呢？我抽时间更新一下

- **Issue #2** (2019-07-31): **I can't build successfully, too many errors.**
  *Symptoms*: After I downloaded from github, I want to run it. But there are too many swift compiler errors. "Missing flies", or "Unable to infer complex closure return type; add explicit type to disambiguate"  etc.
  **Post-Mortem & Fix Analysis**:
  > I have no problem here. Can you try to list some specific error messages or screenshots?
  > ![image](https://user-images.githubusercontent.com/8113409/61940780-b9fa0100-afc8-11e9-98c2-b6e5b311cb9b.png) 
  > 1. Make sure you are using macOS 10.15 Beta and Xcode 11 beta. 2. Create a new SwiftUI project and build it. 3. Build with the official sample code: https://developer.apple.com/tutorials/swiftui/creating-and-combining-views

- **Issue #1** (2019-06-18): **我装了xc11，启动的第一个sample时候预览不了，报Keyword '_' cannot be used as an identifier here**
  *Symptoms*: 我装了xc11，启动的第一个sample时候预览不了，报Keyword '_' cannot be used as an identifier here。发现是在_xctest.swift这个文件里有报错，   import XCTest @testable import _  class _Tests: XCTestCase {  请问如何解决啊
  **Post-Mortem & Fix Analysis**:
  > 1. 确保你的 macOS 是最新的 beta 版本。 2. 尝试新建一个新的 SwiftUI 空项目，看是否能 Run。 3. 如果新项目也不能 Run，说明是 SwiftUI 自身的 bug，目前 bug 还相当多。如果新项目能 Run 而此仓库代码不行，可以在教程页下载官方的初始代码再次尝试。

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

### Incident Patch 1: `a16efce9` (2019-10-11)
**Commit Message**: Upgrade "SwiftUI Essentials"

**File**: `App-Design-and-Layout/AppDelegate.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  AppDelegate.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import UIKit
```

**File**: `App-Design-and-Layout/CategoryRow.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  CategoryRow.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import SwiftUI
```

**File**: `App-Design-and-Layout/ContentView.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  ContentView.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import SwiftUI
```

**File**: `App-Design-and-Layout/HikeBadge.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  HikeBadge.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import SwiftUI
```

**File**: `App-Design-and-Layout/Home.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  Home.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import SwiftUI
```

**File**: `App-Design-and-Layout/Profile/ProfileEditor.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  ProfileEditor.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import SwiftUI
```

**File**: `App-Design-and-Layout/Profile/ProfileHost.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  ProfileHost.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import SwiftUI
```

**File**: `App-Design-and-Layout/Profile/ProfileSummary.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 //  ProfileSummary.swift
 //  App-Design-and-Layout
 //
-//  Created by 王炜 on 2019/6/9.
+//  Created by Willie on 2019/6/9.
 //
 
 import SwiftUI
```

---

### Incident Patch 2: `f5cdf3e7` (2019-06-09)
**Commit Message**: Add "Framework Integration" > "Interfacing with UIKit"

**File**: `Framework-Integration/AppDelegate.swift` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+//
+//  AppDelegate.swift
+//  Framework-Integration
+//
+//  Created by 王炜 on 2019/6/9.
+//
+
+import UIKit
+
+@UIApplicationMain
+class AppDelegate: UIResponder, UIApplicationDelegate {
+
+
+
+    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
+        // Override point for customization after application launch.
+        return true
+    }
+
+    func applicationWillTerminate(_ application: UIApplication) {
+        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
+    }
+
+    // MARK: UISceneSession Lifecycle
+
+    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
+        // Called when a new scene session is being created.
+        // Use this method to select a configuration to create the new scene with.
+        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
+    }
+
+    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
+        // Called when the user discards a scene session.
+        // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
+        // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
+    }
+
+
+}
+
```

**File**: `Framework-Integration/Assets.xcassets/AppIcon.appiconset/Contents.json` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+{
+  "images" : [
+    {
+      "size" : "20x20",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_40x40.png",
+      "scale" : "2x"
+    },
+    {
+      "idiom" : "iphone",
+      "size" : "20x20",
+      "scale" : "3x"
+    },
+    {
+      "size" : "29x29",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_58x58.png",
+      "scale" : "2x"
+    },
+    {
+      "size" : "29x29",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_87x87.png",
+      "scale" : "3x"
+    },
+    {
+      "size" : "40x40",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_80x80.png",
+      "scale" : "2x"
+    },
+    {
+      "size" : "40x40",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_120x120.png",
+      "scale" : "3x"
+    },
+    {
+      "idiom" : "iphone",
+      "size" : "60x60",
+      "scale" : "2x"
+    },
+    {
+      "idiom" : "iphone",
+      "size" : "60x60",
+      "scale" : "3x"
+    },
+    {
+      "idiom" : "ipad",
+      "size" : "20x20",
+      "scale" : "1x"
+    },
+    {
+      "size" : "20x20",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_40x40-1.png",
+      "scale" : "2x"
+    },
+    {
+      "idiom" : "ipad",
+      "size" : "29x29",
+      "scale" : "1x"
+    },
+    {
+      "size" : "29x29",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_58x58-1.png",
+      "scale" : "2x"
+    },
+    {
+      "size" : "40x40",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_40x40-2.png",
+      "scale" : "1x"
+    },
+    {
+      "size" : "40x40",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_80x80-1.png",
+      "scale" : "2x"
+    },
+    {
+      "size" : "76x76",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_76x76.png",
+      "scale" : "1x"
+    },
+    {
+      "size" : "76x76",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_152x152.png",
+      "scale" : "2x"
+    },
+    {
+      "size" : "83.5x83.5",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_167x167.png",
+      "scale" : "2x"
+    },
+    {
+      "size" : "1024x1024",
+      "idiom" : "ios-marketing",
+      "filename" : "landmark_app_icon_1024x1024.png",
+      "scale" : "1x"
+    }
+  ],
+  "info" : {
+    "version" : 1,
+    "author" : "xcode"
+  }
+}
\ No newline at end of file
```

**File**: `Framework-Integration/Assets.xcassets/Contents.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "info" : {
+    "version" : 1,
+    "author" : "xcode"
+  }
+}
\ No newline at end of file
```

**File**: `Framework-Integration/Assets.xcassets/turtlerock.imageset/Contents.json` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+{
+  "images" : [
+    {
+      "idiom" : "universal",
+      "filename" : "turtlerock.jpg",
+      "scale" : "1x"
+    },
+    {
+      "idiom" : "universal",
+      "scale" : "2x"
+    },
+    {
+      "idiom" : "universal",
+      "scale" : "3x"
+    }
+  ],
+  "info" : {
+    "version" : 1,
+    "author" : "xcode"
+  }
+}
\ No newline at end of file
```

**File**: `Framework-Integration/Base.lproj/LaunchScreen.storyboard` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+<?xml version="1.0" encoding="UTF-8" standalone="no"?>
+<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="13122.16" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
+    <dependencies>
+        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="13104.12"/>
+        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
+        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
+    </dependencies>
+    <scenes>
+        <!--View Controller-->
+        <scene sceneID="EHf-IW-A2E">
+            <objects>
+                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
+                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
+                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
+                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
+                        <color key="backgroundColor" xcode11CocoaTouchSystemColor="systemBackgroundColor" cocoaTouchSystemColor="whiteColor"/>
+                        <viewLayoutGuide key="safeArea" id="6Tk-OE-BBY"/>
+                    </view>
+                </viewController>
+                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
+            </objects>
+            <point key="canvasLocation" x="53" y="375"/>
+        </scene>
+    </scenes>
+</document>
```

**File**: `Framework-Integration/ContentView.swift` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+//
+//  ContentView.swift
+//  Framework-Integration
+//
+//  Created by 王炜 on 2019/6/9.
+//
+
+import SwiftUI
+
+struct ContentView : View {
+    var body: some View {
+        Text("Hello World")
+    }
+}
+
+#if DEBUG
+struct ContentView_Previews : PreviewProvider {
+    static var previews: some View {
+        ContentView()
+    }
+}
+#endif
```

**File**: `Framework-Integration/HexagonParameters.swift` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+/*
+See LICENSE folder for this sample’s licensing information.
+
+Abstract:
+Size, position, and other information used to draw a badge.
+*/
+
+import SwiftUI
+
+struct HexagonParameters {
+    struct Segment {
+        let useWidth: (CGFloat, CGFloat, CGFloat)
+        let xFactors: (CGFloat, CGFloat, CGFloat)
+        let useHeight: (CGFloat, CGFloat, CGFloat)
+        let yFactors: (CGFloat, CGFloat, CGFloat)
+    }
+    
+    static let adjustment: CGFloat = 0.085
+    static let points = [
+        Segment(
+            useWidth:  (1.00, 1.00, 1.00),
+            xFactors:  (0.60, 0.40, 0.50),
+            useHeight: (1.00, 1.00, 0.00),
+            yFactors:  (0.05, 0.05, 0.00)
+        ),
+        Segment(
+            useWidth:  (1.00, 1.00, 0.00),
+            xFactors:  (0.05, 0.00, 0.00),
+            useHeight: (1.00, 1.00, 1.00),
+            yFactors:  (0.20 + adjustment, 0.30 + adjustment, 0.25 + adjustment)
+        ),
+        Segment(
+            useWidth:  (1.00, 1.00, 0.00),
+            xFactors:  (0.00, 0.05, 0.00),
+            useHeight: (1.00, 1.00, 1.00),
+            yFactors:  (0.70 - adjustment, 0.80 - adjustment, 0.75 - adjustment)
+        ),
+        Segment(
+            useWidth:  (1.00, 1.00, 1.00),
+            xFactors:  (0.40, 0.60, 0.50),
+            useHeight: (1.00, 1.00, 1.00),
+            yFactors:  (0.95, 0.95, 1.00)
+        ),
+        Segment(
+            useWidth:  (1.00, 1.00, 1.00),
+            xFactors:  (0.95, 1.00, 1.00),
+            useHeight: (1.00, 1.00, 1.00),
+            yFactors:  (0.80 - adjustment, 0.70 - adjustment, 0.75 - adjustment)
+        ),
+        Segment(
+            useWidth:  (1.00, 1.00, 1.00),
+            xFactors:  (1.00, 0.95, 1.00),
+            useHeight: (1.00, 1.00, 1.00),
+            yFactors:  (0.30 + adjustment, 0.20 + adjustment, 0.25 + adjustment)
+        )
+    ]
+}
```

**File**: `Framework-Integration/Info.plist` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>CFBundleDevelopmentRegion</key>
+	<string>$(DEVELOPMENT_LANGUAGE)</string>
+	<key>CFBundleExecutable</key>
+	<string>$(EXECUTABLE_NAME)</string>
+	<key>CFBundleIdentifier</key>
+	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
+	<key>CFBundleInfoDictionaryVersion</key>
+	<string>6.0</string>
+	<key>CFBundleName</key>
+	<string>$(PRODUCT_NAME)</string>
+	<key>CFBundlePackageType</key>
+	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
+	<key>CFBundleShortVersionString</key>
+	<string>1.0</string>
+	<key>CFBundleVersion</key>
+	<string>1</string>
+	<key>LSRequiresIPhoneOS</key>
+	<true/>
+	<key>UIApplicationSceneManifest</key>
+	<dict>
+		<key>UIApplicationSupportsMultipleScenes</key>
+		<false/>
+		<key>UISceneConfigurations</key>
+		<dict>
+			<key>UIWindowSceneSessionRoleApplication</key>
+			<array>
+				<dict>
+					<key>UILaunchStoryboardName</key>
+					<string>LaunchScreen</string>
+					<key>UISceneConfigurationName</key>
+					<string>Default Configuration</string>
+					<key>UISceneDelegateClassName</key>
+					<string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
+				</dict>
+			</array>
+		</dict>
+	</dict>
+	<key>UILaunchStoryboardName</key>
+	<string>LaunchScreen</string>
+	<key>UIRequiredDeviceCapabilities</key>
+	<array>
+		<string>armv7</string>
+	</array>
+	<key>UISupportedInterfaceOrientations</key>
+	<array>
+		<string>UIInterfaceOrientationPortrait</string>
+		<string>UIInterfaceOrientationLandscapeLeft</string>
+		<string>UIInterfaceOrientationLandscapeRight</string>
+	</array>
+	<key>UISupportedInterfaceOrientations~ipad</key>
+	<array>
+		<string>UIInterfaceOrientationPortrait</string>
+		<string>UIInterfaceOrientationPortraitUpsideDown</string>
+		<string>UIInterfaceOrientationLandscapeLeft</string>
+		<string>UIInterfaceOrientationLandscapeRight</string>
+	</array>
+</dict>
+</plist>
```

---

### Incident Patch 3: `8790e779` (2019-06-09)
**Commit Message**: Add "App Design and Layout" > "Working with UI Controls"

**File**: `App-Design-and-Layout/HikeBadge.swift` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+//
+//  HikeBadge.swift
+//  App-Design-and-Layout
+//
+//  Created by 王炜 on 2019/6/9.
+//
+
+import SwiftUI
+
+struct HikeBadge: View {
+    var name: String
+    var body: some View {
+        VStack(alignment: .center) {
+            Badge()
+                .frame(width: 300, height: 300)
+                .scaleEffect(1.0 / 3.0)
+                .frame(width: 100, height: 100)
+            Text(name)
+                .font(.caption)
+                .accessibility(label: Text("Badge for \(name)."))
+        }
+    }
+}
+
+#if DEBUG
+struct HikeBadge_Previews : PreviewProvider {
+    static var previews: some View {
+        HikeBadge(name: "Preview Testing")
+    }
+}
+#endif
```

**File**: `App-Design-and-Layout/HikeDetail.swift` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+/*
+See LICENSE folder for this sample’s licensing information.
+
+Abstract:
+A view showing the details for a hike.
+*/
+
+import SwiftUI
+
+struct HikeDetail: View {
+    let hike: Hike
+    @State var dataToShow = \Hike.Observation.elevation
+    
+    var buttons = [
+        ("Elevation", \Hike.Observation.elevation),
+        ("Heart Rate", \Hike.Observation.heartRate),
+        ("Pace", \Hike.Observation.pace),
+    ]
+    
+    var body: some View {
+        return VStack {
+            HikeGraph(hike: hike, path: dataToShow)
+                .frame(height: 200, alignment: .center)
+            
+            HStack(spacing: 25) {
+                ForEach(buttons.identified(by: \.0)) { value in
+                    Button(action: {
+                        self.dataToShow = value.1
+                    }) {
+                        Text(verbatim: value.0)
+                            .font(.system(size: 15))
+                            .color(value.1 == self.dataToShow
+                                ? Color.gray
+                                : Color.accentColor)
+                            .animation(nil)
+                    }
+                }
+            }
+        }
+    }
+}
+
+#if DEBUG
+struct HikeDetail_Previews: PreviewProvider {
+    static var previews: some View {
+        HikeDetail(hike: hikeData[0])
+    }
+}
+#endif
```

**File**: `App-Design-and-Layout/HikeView.swift` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+/*
+See LICENSE folder for this sample’s licensing information.
+
+Abstract:
+A view displaying inforamtion about a hike, including an elevation graph.
+*/
+
+import SwiftUI
+
+struct HikeView: View {
+    var hike: Hike
+    @State private var showDetail = false
+    
+    var transition: AnyTransition {
+        let insertion = AnyTransition.move(edge: .trailing)
+            .combined(with: .opacity)
+        let removal = AnyTransition.scale()
+            .combined(with: .opacity)
+        return .asymmetric(insertion: insertion, removal: removal)
+    }
+    
+    var body: some View {
+        VStack {
+            HStack {
+                HikeGraph(hike: hike, path: \.elevation)
+                    .frame(width: 50, height: 30)
+                    .animation(nil)
+                
+                VStack(alignment: .leading) {
+                    Text(verbatim: hike.name)
+                        .font(.headline)
+                    Text(verbatim: hike.distanceText)
+                }
+                
+                Spacer()
+
+                Button(action: {
+                    withAnimation {
+                    	self.showDetail.toggle()
+                    }
+                }) {
+                    Image(systemName: "chevron.right.circle")
+                        .imageScale(.large)
+                        .rotationEffect(.degrees(showDetail ? 90 : 0))
+                        .scaleEffect(showDetail ? 1.5 : 1)
+                        .padding()
+                }
+            }
+
+            if showDetail {
+                HikeDetail(hike: hike)
+                	.transition(transition)
+            }
+        }
+    }
+}
+
+#if DEBUG
+struct HikeView_Previews: PreviewProvider {
+    static var previews: some View {
+        VStack {
+            HikeView(hike: hikeData[0])
+                .padding()
+            Spacer()
+        }
+    }
+}
+#endif
```

**File**: `App-Design-and-Layout/Home.swift` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ struct CategoryHome: View {
                             .imageScale(.large)
                             .accessibility(label: Text("User Profile"))
                             .padding(),
-                        destination: Text("User Profile")
+                        destination: ProfileHost()
                     )
             )
         }
```

**File**: `App-Design-and-Layout/Models/Profile.swift` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+/*
+See LICENSE folder for this sample’s licensing information.
+
+Abstract:
+A model object that stores user profile data.
+*/
+
+import Foundation
+
+struct Profile {
+    var username: String
+    var prefersNotifications: Bool
+    var seasonalPhoto: Season
+    var goalDate: Date
+    
+    static let `default` = Self(username: "g_kumar", prefersNotifications: true, seasonalPhoto: .winter)
+    
+    init(username: String, prefersNotifications: Bool = true, seasonalPhoto: Season = .winter) {
+        self.username = username
+        self.prefersNotifications = prefersNotifications
+        self.seasonalPhoto = seasonalPhoto
+        self.goalDate = Date()
+    }
+    
+    enum Season: String, CaseIterable {
+        case spring = "🌷"
+        case summer = "🌞"
+        case autumn = "🍂"
+        case winter = "☃️"
+    }
+}
```

**File**: `App-Design-and-Layout/Profile/ProfileEditor.swift` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+//
+//  ProfileEditor.swift
+//  App-Design-and-Layout
+//
+//  Created by 王炜 on 2019/6/9.
+//
+
+import SwiftUI
+
+struct ProfileEditor: View {
+    @Binding var profile: Profile
+    
+    var body: some View {
+        List {
+            HStack {
+                Text("Username").bold()
+                Divider()
+                TextField($profile.username)
+            }
+            
+            Toggle(isOn: $profile.prefersNotifications) {
+                Text("Enable Notifications")
+            }
+            
+            VStack(alignment: .leading, spacing: 20) {
+                Text("Seasonal Photo").bold()
+                
+                SegmentedControl(selection: $profile.seasonalPhoto) {
+                    ForEach(Profile.Season.allCases.identified(by: \.self)) { season in
+                        Text(season.rawValue).tag(season)
+                    }
+                }
+                }
+                .padding(.top)
+            
+            VStack(alignment: .leading, spacing: 20) {
+                Text("Goal Date").bold()
+                DatePicker(
+                    $profile.goalDate,
+                    minimumDate: Calendar.current.date(byAdding: .year, value: -1, to: profile.goalDate),
+                    maximumDate: Calendar.current.date(byAdding: .year, value: 1, to: profile.goalDate),
+                    displayedComponents: .date
+                )
+                }
+                .padding(.top)
+        }
+    }
+}
+
+#if DEBUG
+struct ProfileEditor_Previews: PreviewProvider {
+    static var previews: some View {
+        ProfileEditor(profile: .constant(.default))
+    }
+}
+#endif
```

**File**: `App-Design-and-Layout/Profile/ProfileHost.swift` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+//
+//  ProfileHost.swift
+//  App-Design-and-Layout
+//
+//  Created by 王炜 on 2019/6/9.
+//
+
+import SwiftUI
+
+struct ProfileHost: View {
+    @Environment(\.editMode) var mode
+    @State var profile = Profile.default
+    @State var draftProfile = Profile.default
+    
+    var body: some View {
+        VStack(alignment: .leading, spacing: 20) {
+            HStack {
+                if self.mode?.value == .active {
+                    Button(action: {
+                        self.profile = self.draftProfile
+                        self.mode?.animation().value = .inactive
+                    }) {
+                        Text("Done")
+                    }
+                }
+                
+                Spacer()
+                
+                EditButton()
+            }
+            if self.mode?.value == .inactive {
+                ProfileSummary(profile: profile)
+            } else {
+                ProfileEditor(profile: $draftProfile)
+                    .onDisappear {
+                        self.draftProfile = self.profile
+                }
+            }
+            }
+            .padding()
+    }
+}
+
+#if DEBUG
+struct ProfileHost_Previews: PreviewProvider {
+    static var previews: some View {
+        ProfileHost()
+    }
+}
+#endif
```

**File**: `App-Design-and-Layout/Profile/ProfileSummary.swift` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+//
+//  ProfileSummary.swift
+//  App-Design-and-Layout
+//
+//  Created by 王炜 on 2019/6/9.
+//
+
+import SwiftUI
+
+struct ProfileSummary: View {
+    var profile: Profile
+    
+    static var goalFormat: DateFormatter {
+        let formatter = DateFormatter()
+        formatter.dateFormat = "MMMM d, yyyy"
+        return formatter
+    }
+    
+    var body: some View {
+        List {
+            Text(profile.username)
+                .bold()
+                .font(.title)
+            
+            Text("Notifications: \(self.profile.prefersNotifications ? "On": "Off" )")
+            
+            Text("Seasonal Photos: \(self.profile.seasonalPhoto.rawValue)")
+            
+            Text("Goal Date: \(self.profile.goalDate, formatter: Self.goalFormat)")
+            
+            VStack(alignment: .leading) {
+                Text("Completed Badges")
+                    .font(.headline)
+                ScrollView {
+                    HStack {
+                        HikeBadge(name: "First Hike")
+                        
+                        HikeBadge(name: "Earth Day")
+                            .hueRotation(Angle(degrees: 90))
+                        
+                        
+                        HikeBadge(name: "Tenth Hike")
+                            .grayscale(0.5)
+                            .hueRotation(Angle(degrees: 45))
+                    }
+                    }
+                    .frame(height: 140)
+            }
+            
+            VStack(alignment: .leading) {
+                Text("Recent Hikes")
+                    .font(.headline)
+                
+                HikeView(hike: hikeData[0])
+            }
+        }
+    }
+}
+
+#if DEBUG
+struct ProfileSummary_Previews: PreviewProvider {
+    static var previews: some View {
+        ProfileSummary(profile: Profile.default)
+    }
+}
+#endif
```

---

### Incident Patch 4: `c604254e` (2019-06-07)
**Commit Message**: Add "SwiftUI Essentials" > "Handling User Input"

**File**: `SwiftUI-Tutorials.xcodeproj/project.pbxproj` (modified, +56/-52)
```diff
@@ -7,6 +7,20 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		36A89B9622AACB3B0096F89A /* UserData.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36A89B9522AACB3B0096F89A /* UserData.swift */; };
+		36A89BA422AACDE40096F89A /* lakemcdonald.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9722AACDE30096F89A /* lakemcdonald.jpg */; };
+		36A89BA522AACDE40096F89A /* chincoteague.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9822AACDE30096F89A /* chincoteague.jpg */; };
+		36A89BA622AACDE40096F89A /* chilkoottrail.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9922AACDE30096F89A /* chilkoottrail.jpg */; };
+		36A89BA722AACDE40096F89A /* landmarkData.json in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9A22AACDE30096F89A /* landmarkData.json */; };
+		36A89BA822AACDE40096F89A /* icybay.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9B22AACDE30096F89A /* icybay.jpg */; };
+		36A89BA922AACDE40096F89A /* turtlerock.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9C22AACDE30096F89A /* turtlerock.jpg */; };
+		36A89BAA22AACDE40096F89A /* rainbowlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9D22AACDE30096F89A /* rainbowlake.jpg */; };
+		36A89BAB22AACDE40096F89A /* charleyrivers.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9E22AACDE30096F89A /* charleyrivers.jpg */; };
+		36A89BAC22AACDE40096F89A /* twinlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89B9F22AACDE30096F89A /* twinlake.jpg */; };
+		36A89BAD22AACDE40096F89A /* stmarylake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89BA022AACDE40096F89A /* stmarylake.jpg */; };
+		36A89BAE22AACDE40096F89A /* umbagog.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89BA122AACDE40096F89A /* umbagog.jpg */; };
+		36A89BAF22AACDE40096F89A /* silversalmoncreek.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89BA222AACDE40096F89A /* silversalmoncreek.jpg */; };
+		36A89BB022AACDE40096F89A /* hiddenlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36A89BA322AACDE40096F89A /* hiddenlake.jpg */; };
 		36C193F722A8F28C00966915 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36C193F622A8F28C00966915 /* AppDelegate.swift */; };
 		36C193F922A8F28C00966915 /* SceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36C193F822A8F28C00966915 /* SceneDelegate.swift */; };
 		36C193FD22A8F29100966915 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 36C193FC22A8F29100966915 /* Assets.xcassets */; };
@@ -16,25 +30,26 @@
 		36C1941122A8F30800966915 /* CircleImage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36C1940E22A8F30800966915 /* CircleImage.swift */; };
 		36E2C6C522AA5B990037499F /* Data.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36E2C6C322AA5B990037499F /* Data.swift */; };
 		36E2C6C622AA5B990037499F /* Landmark.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36E2C6C422AA5B990037499F /* Landmark.swift */; };
-		36E2C6D522AA5BAE0037499F /* turtlerock.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6C822AA5BAE0037499F /* turtlerock.jpg */; };
-		36E2C6D622AA5BAE0037499F /* silversalmoncreek.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6C922AA5BAE0037499F /* silversalmoncreek.jpg */; };
-		36E2C6D722AA5BAE0037499F /* icybay.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CA22AA5BAE0037499F /* icybay.jpg */; };
-		36E2C6D822AA5BAE0037499F /* lakemcdonald.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CB22AA5BAE0037499F /* lakemcdonald.jpg */; };
-		36E2C6D922AA5BAE0037499F /* hiddenlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CC22AA5BAE0037499F /* hiddenlake.jpg */; };
-		36E2C6DA22AA5BAE0037499F /* twinlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CD22AA5BAE0037499F /* twinlake.jpg */; };
-		36E2C6DB22AA5BAE0037499F /* umbagog.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CE22AA5BAE0037499F /* umbagog.jpg */; };
-		36E2C6DC22AA5BAE0037499F /* landmarkData.json in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CF22AA5BAE0037499F /* landmarkData.json */; };
-		36E2C6DD22AA5BAE0037499F /* chincoteague.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D022AA5BAE0037499F /* chincoteague.jpg */; };
-		36E2C6DE22AA5BAE0037499F /* yukon_charleyrivers.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D122AA5BAE0037499F /* yukon_charleyrivers.jpg */; };
-		36E2C6DF22AA5BAE0037499F /* stmarylake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D222AA5BAE0037499F /* stmarylake.jpg */; };
-		36E2C6E022AA5BAE0037499F /* chilkoottrail.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D322AA5BAE0037499F /* chilkoottrail.jpg */; };
-		36E2C6E122AA5BAE0037499F /* rainbowlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D422AA5BAE0037499F /* rainbowlake.jpg */; };
 		36E2C6E822AA5C530037499F /* LandmarkDetail.swift in Sources *
```

**File**: `SwiftUI-Tutorials/LandmarkDetail.swift` (modified, +32/-8)
```diff
@@ -9,41 +9,65 @@
 import SwiftUI
 
 struct LandmarkDetail: View {
+    @EnvironmentObject var userData: UserData
     var landmark: Landmark
     
+    var landmarkIndex: Int {
+        userData.landmarks.firstIndex(where: { $0.id == landmark.id })!
+    }
+    
     var body: some View {
         VStack {
             MapView(coordinate: landmark.locationCoordinate)
+                .edgesIgnoringSafeArea(.top)
                 .frame(height: 300)
             
             CircleImage(image: landmark.image(forSize: 250))
-                .offset(y: -130)
+                .offset(x: 0, y: -130)
                 .padding(.bottom, -130)
             
             VStack(alignment: .leading) {
-                Text(landmark.name)
-                    .font(.title)
+                HStack {
+                    Text(verbatim: landmark.name)
+                        .font(.title)
+                    
+                    Button(action: {
+                        self.userData.landmarks[self.landmarkIndex]
+                            .isFavorite.toggle()
+                    }) {
+                        if self.userData.landmarks[self.landmarkIndex]
+                            .isFavorite {
+                            Image(systemName: "star.fill")
+                                .foregroundColor(Color.yellow)
+                        } else {
+                            Image(systemName: "star")
+                                .foregroundColor(Color.gray)
+                        }
+                    }
+                }
                 
                 HStack(alignment: .top) {
-                    Text(landmark.park)
+                    Text(verbatim: landmark.park)
                         .font(.subheadline)
                     Spacer()
-                    Text(landmark.state)
+                    Text(verbatim: landmark.state)
                         .font(.subheadline)
                 }
                 }
                 .padding()
             
             Spacer()
         }
-        .navigationBarTitle(Text(landmark.name), displayMode: .inline)
     }
 }
 
 #if DEBUG
-struct LandmarkDetail_Previews : PreviewProvider {
+struct LandmarkDetail_Preview: PreviewProvider {
     static var previews: some View {
-        LandmarkDetail(landmark: landmarkData[0])
+        let userData = UserData()
+        return LandmarkDetail(landmark: userData.landmarks[0])
+            .environmentObject(userData)
     }
 }
 #endif
+
```

**File**: `SwiftUI-Tutorials/LandmarkList.swift` (modified, +19/-7)
```diff
@@ -8,27 +8,39 @@
 
 import SwiftUI
 
-struct LandmarkList : View {
+struct LandmarkList: View {
+    @EnvironmentObject private var userData: UserData
+    
     var body: some View {
         NavigationView {
-            List(landmarkData) { landmark in
-                NavigationButton(destination: LandmarkDetail(landmark: landmark)) {
-                    LandmarkRow(landmark: landmark)
+            List {
+                Toggle(isOn: $userData.showFavoritesOnly) {
+                    Text("Show Favorites Only")
                 }
+                
+                ForEach(userData.landmarks) { landmark in
+                    if !self.userData.showFavoritesOnly || landmark.isFavorite {
+                        NavigationButton(
+                        destination: LandmarkDetail(landmark: landmark)) {
+                            LandmarkRow(landmark: landmark)
+                        }
+                    }
                 }
-                .navigationBarTitle(Text("Landmarks"))
+                }
+                .navigationBarTitle(Text("Landmarks"), displayMode: .large)
         }
     }
 }
 
 #if DEBUG
-struct LandmarkList_Previews : PreviewProvider {
+struct LandmarksList_Previews: PreviewProvider {
     static var previews: some View {
         ForEach(["iPhone SE", "iPhone XS Max"].identified(by: \.self)) { deviceName in
             LandmarkList()
                 .previewDevice(PreviewDevice(rawValue: deviceName))
                 .previewDisplayName(deviceName)
-        }
+            }
+            .environmentObject(UserData())
     }
 }
 #endif
```

**File**: `SwiftUI-Tutorials/LandmarkRow.swift` (modified, +11/-4)
```diff
@@ -14,19 +14,26 @@ struct LandmarkRow: View {
     var body: some View {
         HStack {
             landmark.image(forSize: 50)
-            Text(landmark.name)
+            Text(verbatim: landmark.name)
+            Spacer()
+            
+            if landmark.isFavorite {
+                Image(systemName: "star.fill")
+                    .imageScale(.medium)
+                    .foregroundColor(.yellow)
+            }
         }
     }
 }
 
 #if DEBUG
-struct LandmarkRow_Previews : PreviewProvider {
+struct LandmarkRow_Previews: PreviewProvider {
     static var previews: some View {
         Group {
             LandmarkRow(landmark: landmarkData[0])
             LandmarkRow(landmark: landmarkData[1])
-        }
-        .previewLayout(.fixed(width: 300, height: 70))
+            }
+            .previewLayout(.fixed(width: 300, height: 70))
     }
 }
 #endif
```

**File**: `SwiftUI-Tutorials/Models/Data.swift` (modified, +5/-5)
```diff
@@ -1,9 +1,9 @@
 /*
-See LICENSE folder for this sample’s licensing information.
-
-Abstract:
-Helpers for loading images and data.
-*/
+ See LICENSE folder for this sample’s licensing information.
+ 
+ Abstract:
+ Helpers for loading images and data.
+ */
 
 import UIKit
 import SwiftUI
```

**File**: `SwiftUI-Tutorials/Models/Landmark.swift` (modified, +10/-8)
```diff
@@ -1,9 +1,9 @@
 /*
-See LICENSE folder for this sample’s licensing information.
-
-Abstract:
-The model for an individual landmark.
-*/
+ See LICENSE folder for this sample’s licensing information.
+ 
+ Abstract:
+ The model for an individual landmark.
+ */
 
 import SwiftUI
 import CoreLocation
@@ -16,21 +16,23 @@ struct Landmark: Hashable, Codable, Identifiable {
     var state: String
     var park: String
     var category: Category
-
+    var isFavorite: Bool
+    
     var locationCoordinate: CLLocationCoordinate2D {
         CLLocationCoordinate2D(
             latitude: coordinates.latitude,
             longitude: coordinates.longitude)
     }
-
+    
     func image(forSize size: Int) -> Image {
         ImageStore.shared.image(name: imageName, size: size)
     }
-
+    
     enum Category: String, CaseIterable, Codable, Hashable {
         case featured = "Featured"
         case lakes = "Lakes"
         case rivers = "Rivers"
+        case mountains = "Mountains"
     }
 }
 
```

**File**: `SwiftUI-Tutorials/Models/UserData.swift` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+/*
+ See LICENSE folder for this sample’s licensing information.
+ 
+ Abstract:
+ A model object that stores app data.
+ */
+
+import Combine
+import SwiftUI
+
+final class UserData: BindableObject {
+    let didChange = PassthroughSubject<UserData, Never>()
+    
+    var showFavoritesOnly = false {
+        didSet {
+            didChange.send(self)
+        }
+    }
+    
+    var landmarks = landmarkData {
+        didSet {
+            didChange.send(self)
+        }
+    }
+}
```

**File**: `SwiftUI-Tutorials/Resources/landmarkData.json` (modified, +40/-16)
```diff
@@ -1,10 +1,12 @@
 [
     {
         "name": "Turtle Rock",
-        "category": "Featured",
+        "category": "Rivers",
         "city": "Twentynine Palms",
         "state": "California",
         "id": 1001,
+        "isFeatured": true,
+        "isFavorite": true,
         "park": "Joshua Tree National Park",
         "coordinates": {
             "longitude": -116.166868,
@@ -17,7 +19,9 @@
         "category": "Lakes",
         "city": "Port Alsworth",
         "state": "Alaska",
-        "id": 4,
+        "id": 1002,
+        "isFeatured": false,
+        "isFavorite": false,
         "park": "Lake Clark National Park and Preserve",
         "coordinates": {
             "longitude": -152.665167,
@@ -27,10 +31,12 @@
     },
     {
         "name": "Chilkoot Trail",
-        "category": "Rivers",
+        "category": "Mountains",
         "city": "Skagway",
         "state": "Alaska",
-        "id": 5,
+        "id": 1003,
+        "isFeatured": false,
+        "isFavorite": true,
         "park": "Klondike Gold Rush National Historical Park",
         "coordinates": {
             "longitude": -135.334571,
@@ -43,7 +49,9 @@
         "category": "Lakes",
         "city": "Browning",
         "state": "Montana",
-        "id": 8,
+        "id": 1004,
+        "isFeatured": true,
+        "isFavorite": true,
         "park": "Glacier National Park",
         "coordinates": {
             "longitude": -113.536248,
@@ -56,7 +64,9 @@
         "category": "Lakes",
         "city": "Twin Lakes",
         "state": "Alaska",
-        "id": 11,
+        "id": 1005,
+        "isFeatured": false,
+        "isFavorite": false,
         "park": "Lake Clark National Park and Preserve",
         "coordinates": {
             "longitude": -153.849883,
@@ -66,10 +76,12 @@
     },
     {
         "name": "Lake McDonald",
-        "category": "Lakes",
+        "category": "Mountains",
         "city": "West Glacier",
         "state": "Montana",
-        "id": 6,
+        "id": 1006,
+        "isFeatured": false,
+        "isFavorite": false,
         "park": "Glacier National Park",
         "coordinates": {
             "longitude": -113.934831,
@@ -82,20 +94,24 @@
         "category": "Rivers",
         "city": "Eaking",
         "state": "Alaska",
-        "id": 1,
+        "id": 1007,
+        "isFeatured": true,
+        "isFavorite": false,
         "park": "Charley Rivers National Preserve",
         "coordinates": {
             "longitude": -143.122586,
             "latitude": 65.350021
         },
-        "imageName": "yukon_charleyrivers"
+        "imageName": "charleyrivers",
     },
     {
         "name": "Icy Bay",
-        "category": "Lakes",
+        "category": "Mountains",
         "city": "Icy Bay",
         "state": "Alaska",
-        "id": 2,
+        "id": 1008,
+        "isFeatured": false,
+        "isFavorite": false,
         "park": "Wrangell-St. Elias National Park and Preserve",
         "coordinates": {
             "longitude": -141.518167,
@@ -108,7 +124,9 @@
         "category": "Lakes",
         "city": "Willow",
         "state": "Alaska",
-        "id": 3,
+        "id": 1009,
+        "isFeatured": false,
+        "isFavorite": false,
         "park": "State Recreation Area",
         "coordinates": {
             "longitude": -150.086103,
@@ -121,7 +139,9 @@
         "category": "Lakes",
         "city": "Newhalem",
         "state": "Washington",
-        "id": 7,
+        "id": 1010,
+        "isFeatured": false,
+        "isFavorite": false,
         "park": "North Cascades National Park",
         "coordinates": {
             "longitude": -121.17799,
@@ -134,7 +154,9 @@
         "category": "Rivers",
         "city": "Chincoteague",
         "state": "Virginia",
-        "id": 9,
+        "id": 1011,
+        "isFeatured": false,
+        "isFavorite": false,
         "park": "Chincoteague National Wildlife Refuge",
         "coordinates": {
             "longitude": -75.383212,
@@ -147,7 +169,9 @@
         "category": "Lakes",
         "city": "Errol",
         "state": "New Hampshire",
-        "id": 10,
+        "id": 1012,
+        "isFeatured": true,
+        "isFavorite": false,
         "park": "Umbagog National Wildlife Refuge",
         "coordinates": {
             "longitude": -71.056816,
```

---

### Incident Patch 5: `5de00f2e` (2019-06-07)
**Commit Message**: Add "SwiftUI Essentials" > "Building Lists and Navigation"

**File**: `README.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
 
 ### 图片
 
-为了优化阅读体验，所有图片加上了 `#000000`  `50%`  `10 Blur` 的阴影。
+为了优化阅读体验，部分图片加上了 `#000000`  `50%`  `10 Blur` 的阴影。
 
 ### 视频
 
```

**File**: `SwiftUI-Tutorials.xcodeproj/project.pbxproj` (modified, +99/-7)
```diff
@@ -13,8 +13,25 @@
 		36C1940022A8F29100966915 /* Preview Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 36C193FF22A8F29100966915 /* Preview Assets.xcassets */; };
 		36C1940322A8F29100966915 /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = 36C1940122A8F29100966915 /* LaunchScreen.storyboard */; };
 		36C1940F22A8F30800966915 /* MapView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36C1940C22A8F30800966915 /* MapView.swift */; };
-		36C1941022A8F30800966915 /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36C1940D22A8F30800966915 /* ContentView.swift */; };
 		36C1941122A8F30800966915 /* CircleImage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36C1940E22A8F30800966915 /* CircleImage.swift */; };
+		36E2C6C522AA5B990037499F /* Data.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36E2C6C322AA5B990037499F /* Data.swift */; };
+		36E2C6C622AA5B990037499F /* Landmark.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36E2C6C422AA5B990037499F /* Landmark.swift */; };
+		36E2C6D522AA5BAE0037499F /* turtlerock.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6C822AA5BAE0037499F /* turtlerock.jpg */; };
+		36E2C6D622AA5BAE0037499F /* silversalmoncreek.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6C922AA5BAE0037499F /* silversalmoncreek.jpg */; };
+		36E2C6D722AA5BAE0037499F /* icybay.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CA22AA5BAE0037499F /* icybay.jpg */; };
+		36E2C6D822AA5BAE0037499F /* lakemcdonald.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CB22AA5BAE0037499F /* lakemcdonald.jpg */; };
+		36E2C6D922AA5BAE0037499F /* hiddenlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CC22AA5BAE0037499F /* hiddenlake.jpg */; };
+		36E2C6DA22AA5BAE0037499F /* twinlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CD22AA5BAE0037499F /* twinlake.jpg */; };
+		36E2C6DB22AA5BAE0037499F /* umbagog.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CE22AA5BAE0037499F /* umbagog.jpg */; };
+		36E2C6DC22AA5BAE0037499F /* landmarkData.json in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6CF22AA5BAE0037499F /* landmarkData.json */; };
+		36E2C6DD22AA5BAE0037499F /* chincoteague.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D022AA5BAE0037499F /* chincoteague.jpg */; };
+		36E2C6DE22AA5BAE0037499F /* yukon_charleyrivers.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D122AA5BAE0037499F /* yukon_charleyrivers.jpg */; };
+		36E2C6DF22AA5BAE0037499F /* stmarylake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D222AA5BAE0037499F /* stmarylake.jpg */; };
+		36E2C6E022AA5BAE0037499F /* chilkoottrail.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D322AA5BAE0037499F /* chilkoottrail.jpg */; };
+		36E2C6E122AA5BAE0037499F /* rainbowlake.jpg in Resources */ = {isa = PBXBuildFile; fileRef = 36E2C6D422AA5BAE0037499F /* rainbowlake.jpg */; };
+		36E2C6E822AA5C530037499F /* LandmarkDetail.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36E2C6E722AA5C530037499F /* LandmarkDetail.swift */; };
+		36E2C6EA22AA5E670037499F /* LandmarkRow.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36E2C6E922AA5E670037499F /* LandmarkRow.swift */; };
+		36E2C6EC22AA60300037499F /* LandmarkList.swift in Sources */ = {isa = PBXBuildFile; fileRef = 36E2C6EB22AA60300037499F /* LandmarkList.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXFileReference section */
@@ -26,8 +43,25 @@
 		36C1940222A8F29100966915 /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; };
 		36C1940422A8F29200966915 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
 		36C1940C22A8F30800966915 /* MapView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = MapView.swift; sourceTree = "<group>"; };
-		36C1940D22A8F30800966915 /* ContentView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
 		36C1940E22A8F30800966915 /* CircleImage.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = CircleImage.swift; sourceTree = "<group>"; };
+		36E2C6C322AA5B990037499F /* Data.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Data.swift; sourceTree = "<group>"; };
+		36E2C6C422AA5B990037499F /* Landmark.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Landmark.swift; sourceTree = "<group>"; };
+		36E2C6C822AA5BAE0037499F /* turtlerock.jpg */ = {isa = PBXFileReference; lastKnownFileType = image.jpeg; path = turtlerock.jpg; sourceTree = "<group>"; };
+		36E2C6C922AA5BAE0037499F /* silversalmoncreek.jpg */ = {is
```

**File**: `SwiftUI-Tutorials/Assets.xcassets/AppIcon.appiconset/Contents.json` (modified, +30/-15)
```diff
@@ -1,8 +1,9 @@
 {
   "images" : [
     {
-      "idiom" : "iphone",
       "size" : "20x20",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_40x40.png",
       "scale" : "2x"
     },
     {
@@ -11,33 +12,39 @@
       "scale" : "3x"
     },
     {
-      "idiom" : "iphone",
       "size" : "29x29",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_58x58.png",
       "scale" : "2x"
     },
     {
-      "idiom" : "iphone",
       "size" : "29x29",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_87x87.png",
       "scale" : "3x"
     },
     {
-      "idiom" : "iphone",
       "size" : "40x40",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_80x80.png",
       "scale" : "2x"
     },
     {
-      "idiom" : "iphone",
       "size" : "40x40",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_120x120.png",
       "scale" : "3x"
     },
     {
-      "idiom" : "iphone",
       "size" : "60x60",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_120x120-1.png",
       "scale" : "2x"
     },
     {
-      "idiom" : "iphone",
       "size" : "60x60",
+      "idiom" : "iphone",
+      "filename" : "landmark_app_icon_180x180.png",
       "scale" : "3x"
     },
     {
@@ -46,8 +53,9 @@
       "scale" : "1x"
     },
     {
-      "idiom" : "ipad",
       "size" : "20x20",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_40x40-1.png",
       "scale" : "2x"
     },
     {
@@ -56,38 +64,45 @@
       "scale" : "1x"
     },
     {
-      "idiom" : "ipad",
       "size" : "29x29",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_58x58-1.png",
       "scale" : "2x"
     },
     {
-      "idiom" : "ipad",
       "size" : "40x40",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_40x40-2.png",
       "scale" : "1x"
     },
     {
-      "idiom" : "ipad",
       "size" : "40x40",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_80x80-1.png",
       "scale" : "2x"
     },
     {
-      "idiom" : "ipad",
       "size" : "76x76",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_76x76.png",
       "scale" : "1x"
     },
     {
-      "idiom" : "ipad",
       "size" : "76x76",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_152x152.png",
       "scale" : "2x"
     },
     {
-      "idiom" : "ipad",
       "size" : "83.5x83.5",
+      "idiom" : "ipad",
+      "filename" : "landmark_app_icon_167x167.png",
       "scale" : "2x"
     },
     {
-      "idiom" : "ios-marketing",
       "size" : "1024x1024",
+      "idiom" : "ios-marketing",
+      "filename" : "landmark_app_icon_1024x1024.png",
       "scale" : "1x"
     }
   ],
```

**File**: `SwiftUI-Tutorials/LandmarkDetail.swift` (renamed, +16/-16)
```diff
@@ -1,5 +1,5 @@
 //
-//  ContentView.swift
+//  LandmarkDetail.swift
 //  SwiftUI-Essentials
 //
 //  Created by 王炜 on 2019/6/4.
@@ -8,42 +8,42 @@
 
 import SwiftUI
 
-struct ContentView : View {
+struct LandmarkDetail: View {
+    var landmark: Landmark
+    
     var body: some View {
-        
         VStack {
-            
-            MapView()
+            MapView(coordinate: landmark.locationCoordinate)
                 .frame(height: 300)
-                .edgesIgnoringSafeArea(.top)
             
-            CircleImage()
+            CircleImage(image: landmark.image(forSize: 250))
                 .offset(y: -130)
                 .padding(.bottom, -130)
             
             VStack(alignment: .leading) {
-                Text("Turtle Rock")
+                Text(landmark.name)
                     .font(.title)
-                HStack {
-                    Text("Joshua Tree National Park")
+                
+                HStack(alignment: .top) {
+                    Text(landmark.park)
                         .font(.subheadline)
                     Spacer()
-                    Text("California")
+                    Text(landmark.state)
                         .font(.subheadline)
                 }
-            }
-                
-            .padding()
+                }
+                .padding()
             
             Spacer()
         }
+        .navigationBarTitle(Text(landmark.name), displayMode: .inline)
     }
 }
 
 #if DEBUG
-struct ContentView_Previews : PreviewProvider {
+struct LandmarkDetail_Previews : PreviewProvider {
     static var previews: some View {
-        ContentView()
+        LandmarkDetail(landmark: landmarkData[0])
     }
 }
 #endif
```

**File**: `SwiftUI-Tutorials/LandmarkList.swift` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+//
+//  LandmarkList.swift
+//  SwiftUI-Tutorials
+//
+//  Created by 王炜 on 2019/6/7.
+//  Copyright © 2019 Willie. All rights reserved.
+//
+
+import SwiftUI
+
+struct LandmarkList : View {
+    var body: some View {
+        NavigationView {
+            List(landmarkData) { landmark in
+                NavigationButton(destination: LandmarkDetail(landmark: landmark)) {
+                    LandmarkRow(landmark: landmark)
+                }
+                }
+                .navigationBarTitle(Text("Landmarks"))
+        }
+    }
+}
+
+#if DEBUG
+struct LandmarkList_Previews : PreviewProvider {
+    static var previews: some View {
+        ForEach(["iPhone SE", "iPhone XS Max"].identified(by: \.self)) { deviceName in
+            LandmarkList()
+                .previewDevice(PreviewDevice(rawValue: deviceName))
+                .previewDisplayName(deviceName)
+        }
+    }
+}
+#endif
```

**File**: `SwiftUI-Tutorials/LandmarkRow.swift` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+//
+//  LandmarkRow.swift
+//  SwiftUI-Tutorials
+//
+//  Created by 王炜 on 2019/6/7.
+//  Copyright © 2019 Willie. All rights reserved.
+//
+
+import SwiftUI
+
+struct LandmarkRow: View {
+    var landmark: Landmark
+    
+    var body: some View {
+        HStack {
+            landmark.image(forSize: 50)
+            Text(landmark.name)
+        }
+    }
+}
+
+#if DEBUG
+struct LandmarkRow_Previews : PreviewProvider {
+    static var previews: some View {
+        Group {
+            LandmarkRow(landmark: landmarkData[0])
+            LandmarkRow(landmark: landmarkData[1])
+        }
+        .previewLayout(.fixed(width: 300, height: 70))
+    }
+}
+#endif
```

**File**: `SwiftUI-Tutorials/Models/Data.swift` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+/*
+See LICENSE folder for this sample’s licensing information.
+
+Abstract:
+Helpers for loading images and data.
+*/
+
+import UIKit
+import SwiftUI
+import CoreLocation
+
+let landmarkData: [Landmark] = load("landmarkData.json")
+
+func load<T: Decodable>(_ filename: String, as type: T.Type = T.self) -> T {
+    let data: Data
+    
+    guard let file = Bundle.main.url(forResource: filename, withExtension: nil)
+        else {
+            fatalError("Couldn't find \(filename) in main bundle.")
+    }
+    
+    do {
+        data = try Data(contentsOf: file)
+    } catch {
+        fatalError("Couldn't load \(filename) from main bundle:\n\(error)")
+    }
+    
+    do {
+        let decoder = JSONDecoder()
+        return try decoder.decode(T.self, from: data)
+    } catch {
+        fatalError("Couldn't parse \(filename) as \(T.self):\n\(error)")
+    }
+}
+
+final class ImageStore {
+    fileprivate typealias _ImageDictionary = [String: [Int: CGImage]]
+    fileprivate var images: _ImageDictionary = [:]
+    
+    fileprivate static var originalSize = 250
+    fileprivate static var scale = 2
+    
+    static var shared = ImageStore()
+    
+    func image(name: String, size: Int) -> Image {
+        let index = _guaranteeInitialImage(name: name)
+        
+        let sizedImage = images.values[index][size]
+            ?? _sizeImage(images.values[index][ImageStore.originalSize]!, to: size * ImageStore.scale)
+        images.values[index][size] = sizedImage
+        
+        return Image(sizedImage, scale: Length(ImageStore.scale), label: Text(verbatim: name))
+    }
+    
+    fileprivate func _guaranteeInitialImage(name: String) -> _ImageDictionary.Index {
+        if let index = images.index(forKey: name) { return index }
+        
+        guard
+            let url = Bundle.main.url(forResource: name, withExtension: "jpg"),
+            let imageSource = CGImageSourceCreateWithURL(url as NSURL, nil),
+            let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
+            else {
+                fatalError("Couldn't load image \(name).jpg from main bundle.")
+        }
+        
+        images[name] = [ImageStore.originalSize: image]
+        return images.index(forKey: name)!
+    }
+    
+    fileprivate func _sizeImage(_ image: CGImage, to size: Int) -> CGImage {
+        guard
+            let colorSpace = image.colorSpace,
+            let context = CGContext(
+                data: nil,
+                width: size, height: size,
+                bitsPerComponent: image.bitsPerComponent,
+                bytesPerRow: image.bytesPerRow,
+                space: colorSpace,
+                bitmapInfo: image.bitmapInfo.rawValue)
+            else {
+                fatalError("Couldn't create graphics context.")
+        }
+        context.interpolationQuality = .high
+        context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
+        
+        if let sizedImage = context.makeImage() {
+            return sizedImage
+        } else {
+            fatalError("Couldn't resize image.")
+        }
+    }
+}
+
```

**File**: `SwiftUI-Tutorials/Models/Landmark.swift` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+/*
+See LICENSE folder for this sample’s licensing information.
+
+Abstract:
+The model for an individual landmark.
+*/
+
+import SwiftUI
+import CoreLocation
+
+struct Landmark: Hashable, Codable, Identifiable {
+    var id: Int
+    var name: String
+    fileprivate var imageName: String
+    fileprivate var coordinates: Coordinates
+    var state: String
+    var park: String
+    var category: Category
+
+    var locationCoordinate: CLLocationCoordinate2D {
+        CLLocationCoordinate2D(
+            latitude: coordinates.latitude,
+            longitude: coordinates.longitude)
+    }
+
+    func image(forSize size: Int) -> Image {
+        ImageStore.shared.image(name: imageName, size: size)
+    }
+
+    enum Category: String, CaseIterable, Codable, Hashable {
+        case featured = "Featured"
+        case lakes = "Lakes"
+        case rivers = "Rivers"
+    }
+}
+
+struct Coordinates: Hashable, Codable {
+    var latitude: Double
+    var longitude: Double
+}
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
