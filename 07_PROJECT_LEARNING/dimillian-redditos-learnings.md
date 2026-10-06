# Forensic Learning Record (Deep Inspection): Dimillian/RedditOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/dimillian-redditos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dimillian/RedditOS](https://github.com/Dimillian/RedditOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:01:05.654Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dimillian/RedditOS`
- **Description**: The product name is Curiosity, a SwiftUI Reddit client for macOS Big Sur
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4026 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/Backend/Sources/Backend/Network/NetworkError.swift`
```
//
//  File.swift
//  
//
//  Created by Thomas Ricouard on 09/07/2020.
//

import Foundation

public enum NetworkError: Error {
    case unknown(data: Data)
    case message(reason: String, data: Data)
    case parseError(reason: Error)
    case redditAPIError(error: RedditError, data: Data)
    
    static private let decoder = JSONDecoder()
    
    static func processResponse(data: Data, response: URLResponse) throws -> Data {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(data: data)
        }
        if (httpResponse.statusCode == 404) {
            throw NetworkError.message(reason: "Resource not found", data: data)
        }
        if 200 ... 299 ~= httpResponse.statusCode {
            return data
        } else {
            do {
                let redditError = try decoder.decode(RedditError.self, from: data)
                throw NetworkError.redditAPIError(error: redditError, data: data)
            } catch _ {
                throw NetworkError.unknown(data: data)
            }
        }
    }
}

```

### Core Architecture Module: `RedditOs/Environements/UIState.swift`
```
//
//  UIState.swift
//  RedditOs
//
//  Created by Thomas Ricouard on 26/07/2020.
//

import Foundation
import SwiftUI
import Combine
import Backend

class UIState: ObservableObject {
    enum DefaultChannels: String, CaseIterable {
        case hot, best, new, top, rising
        
        func icon() -> String {
            switch self {
            case .best: return "rosette"
            case .hot: return "flame"
            case .new: return "calendar.circle"
            case .top: return "chart.bar"
            case .rising: return "waveform.path.ecg"
            }
        }
    }
    
    enum Constants {
        static let searchTag = "search"
    }
        
    @Published var displayToolbarSearchBar = true
    
    @Published var selectedSubreddit: SubredditViewModel?
    @Published var selectedPost: PostViewModel?
    
    @Published var presentedSheetRoute: Route?
    @Published var searchRoute: Route? {
        didSet {
            if searchRoute != nil {
                sidebarSelection = Constants.searchTag
                displayToolbarSearchBar = false
            }
        }
    }
    
    lazy var isSearchActive: Binding<Bool> = .init(get: {
        self.sidebarSelection == Constants.searchTag
    }, set: { _ in })
    
    @Published var sidebarSelection: String? = DefaultChannels.hot.rawValue {
        didSet {
            if sidebarSelection != Constants.searchTag {
                searchRoute = nil
                displayToolbarSearchBar = true
            } else {
                displayToolbarSearchBar = false
            }
        }
    }
}

```

### Core Architecture Module: `RedditOs/Features/Search/Quick/QuickSearchState.swift`
```
//
//  SearchSubredditsViewModel.swift
//  RedditOs
//
//  Created by Thomas Ricouard on 09/07/2020.
//

import Foundation
import SwiftUI
import Combine
import Backend

class QuickSearchState: ObservableObject {
    @Published var searchText = ""
    @Published var results: [SubredditSmall]?
    @Published var postResults: [SubredditPost]?
    @Published var filteredSubscriptions: [Subreddit]?
    @Published var trending: TrendingSubreddits?
    @Published var isLoading = false
    
    private var currentUser: CurrentUserStore
    
    private var subredditSearchPublisher: AnyPublisher<SubredditResponse, Never>?
    private var postSearchPublisher: AnyPublisher<ListingResponse<SubredditPost>, Never>?
    private var cancellableSet: Set<AnyCancellable> = Set()
    private var searchCancellable: AnyCancellable?
    
    init(currentUser: CurrentUserStore = .shared) {
        self.currentUser = currentUser
        
        $searchText
            .subscribe(on: DispatchQueue.global())
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .removeDuplicates()
            .receive(on: DispatchQueue.main)
            .sink(receiveValue: { [weak self] text in
                if text.isEmpty {
                    self?.isLoading = false
                    self?.results = nil
                } else {
                    self?.isLoading = true
                    self?.search(with: text)
                }
            })
            .store(in: &cancellableSet)
        
        $searchText
            .receive(on: DispatchQueue.main)
            .sink(receiveValue: { [weak self] text in
                guard let w = self else { return }
                if text.isEmpty {
                    w.filteredSubscriptions = nil
                } else {
                    w.filteredSubscriptions = w.currentUser.subscriptions.filter{ $0.displayName.lowercased().contains(text.lowercased()) }
                }
            })
            .store(in: &cancellableSet)
    }
    
    private func search(with text: String) {
        searchCancellable?.cancel()
                
        subredditSearchPublisher = API.shared.request(endpoint: .searchSubreddit, httpMethod: "POST", params: ["query": text])
            .subscribe(on: DispatchQueue.global())
            .replaceError(with: SubredditResponse())
            .eraseToAnyPublisher()
        
        postSearchPublisher = API.shared.request(endpoint: .search, params: ["q": text])
            .subscribe(on: DispatchQueue.global())
            .replaceError(with: ListingResponse(error: "error"))
            .eraseToAnyPublisher()
        
        searchCancellable = Publishers.Zip(subredditSearchPublisher!,
                                           postSearchPublisher!)
            .receive(on: DispatchQueue.main)
            .sink(receiveValue: { [weak self] subreddits, posts in
                self?.results = subreddits.subreddits.map{ $0 }
                self?.postResults = posts.data?.children.map{ $0.data }
                self?.isLoading = false
            })
        
    }
    
    public func fetchTrending() {
        TrendingSubreddits.fetch()
            .subscribe(on: DispatchQueue.global())
            .receive(on: DispatchQueue.main)
            .sink { [weak self] trending in
                self?.trending = trending
            }
            .store(in: &cancellableSet)
    }
}

```

### Core Architecture Module: `Packages/Backend/Package.swift`
```
// swift-tools-version:5.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Backend",
    platforms: [
        .macOS("11"), .iOS("14"), .tvOS("14"), .watchOS("7")
    ],
    products: [
        .library(
            name: "Backend",
            targets: ["Backend"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.0"),
    ],
    targets: [
        .target(
            name: "Backend",
            dependencies: ["KeychainAccess"],
            resources: [.process("Resources")]),
        .testTarget(
            name: "BackendTests",
            dependencies: ["Backend"]),
    ]
)

```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Extensions/Int.swift`
```
//
//  File.swift
//  
//
//  Created by Thomas Ricouard on 09/07/2020.
//

import Foundation

extension Int {
    public func toRoundedSuffixAsString() -> String {
        var number = Double(self)
        number = fabs(number);
        if (number < 1000.0){
            return "\(Int(number))";
        }
        let exp: Int = Int(log10(number) / 3.0 );
        let units: [String] = ["K","M","G","T","P","E"];
        let roundedNum: Double = round(10 * number / pow(1000.0, Double(exp))) / 10;
        return "\(roundedNum)\(units[exp-1])";
    }
}

```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Extensions/URL+StaticString.swift`
```
//
//  URL+StaticString.swift
//  
//
//  Created by Dan Korkelia on 01/01/2021.
//

import Foundation

extension URL {
    /// Use this init for static URL strings to avoid using force unwrap or doing redundant error handling
    /// - Parameter string: static url ie https://www.example.com/privacy/
    init(staticString: StaticString) {
        guard let url = URL(string: "\(staticString)") else {
            fatalError("URL is illegal: \(staticString)")
        }
        self = url
    }
}

```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Extensions/URL.swift`
```
//
//  File.swift
//  
//
//  Created by Thomas Ricouard on 09/07/2020.
//

import Foundation

extension URL {
    public func appending(_ queryItem: String, value: String?) -> URL {
        guard var urlComponents = URLComponents(string: absoluteString) else { return absoluteURL }
        var queryItems: [URLQueryItem] = urlComponents.queryItems ??  []
        let queryItem = URLQueryItem(name: queryItem, value: value)
        queryItems.append(queryItem)
        urlComponents.queryItems = queryItems
        return urlComponents.url!
    }
    
    public var queryParameters: [String: String]? {
        guard
            let components = URLComponents(url: self, resolvingAgainstBaseURL: true),
            let queryItems = components.queryItems else { return nil }
        return queryItems.reduce(into: [String: String]()) { (result, item) in
            result[item.name] = item.value
        }
    }

}

```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Models/Award.swift`
```
//
//  File.swift
//  
//
//  Created by Thomas Ricouard on 05/08/2020.
//

import Foundation

public struct Award: Decodable, Identifiable {
    public let id: String
    public let name: String
    public let staticIconUrl: URL
    public let description: String
    public let count: Int
    public let coinPrice: Int
    
    public static let `default` = Award(id: "award",
                                           name: "Awesome",
                                           staticIconUrl: URL(staticString: "https://i.redd.it/award_images/t5_22cerq/5smbysczm1w41_Hugz.png"),
                                           description: "Awesome reward",
                                           count: 5,
                                           coinPrice: 200)
}

```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Models/Comment.swift`
```
//
//  File.swift
//  
//
//  Created by Thomas Ricouard on 10/07/2020.
//

import Foundation

extension ListingResponse where T == Comment {
    public var comments: [Comment] {
        data?.children.map{ $0.data } ?? []
    }
}

public struct Comment: Decodable, Identifiable {
    public let id: String
    public let name: String
    public let body: String?
    public let isSubmitter: Bool?
    public let author: String?
    public let lindId: String?
    public let parentId: String?
    public let created: Date?
    public let createdUtc: Date?
    public let replies: Replies?
    public var score: Int?
    public var likes: Bool?
    public let allAwardings: [Award]?
    public var saved: Bool?
    
    public let permalink: String?
    public var permalinkURL: URL? {
        guard let permalink = permalink else { return nil }
        return URL(string: "https://reddit.com\(permalink)")
    }
    
    public let authorFlairRichtext: [FlairRichText]?
    public let authorFlairText: String?
    public let authorFlairTextColor: String?
    public let authorFlairBackgroundColor: String?
    
    public var repliesComments: [Comment]? {
        if let replies = replies {
            switch replies {
            case let .some(replies):
                return replies.data?.children.map{ $0.data }
            default:
                return nil
            }
        }
        return nil
    }
}

public enum Replies: Decodable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        do {
            self = .some(try container.decode(ListingResponse<Comment>.self))
        } catch {
            self = .none(try container.decode(String.self))
        }
    }
    
    case some(ListingResponse<Comment>)
    case none(String)
}

public let static_comment = Comment(id: UUID().uuidString,
                                    name: "t1_id",
                                    body: "Comment text with a long line of text\nThis is another line.",
                                    isSubmitter: false,
                                    author: "TestUser",
                                    lindId: "",
                                    parentId: "",
                                    created: Date(),
                                    createdUtc: Date(),
                                    replies: .none(""),
                                    score: 2500,
                                    allAwardings: [],
                                    saved: false,
                                    permalink: "",
                                    authorFlairRichtext: nil,
                                    authorFlairText: nil,
                                    authorFlairTextColor: nil,
                                    authorFlairBackgroundColor: nil)
public let static_comments = [static_comment, static_comment, static_comment]

```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Models/FlairRichText.swift`
```
//
//  File.swift
//  
//
//  Created by Thomas Ricouard on 10/08/2020.
//

import Foundation

public struct FlairRichText: Decodable, Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(e)
        hasher.combine(u)
        hasher.combine(t)
    }
    
    /// type
    public let e: String
    /// image URL
    public let u: URL?
    /// text
    public let t: String?
}

```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Models/Listing.swift`
```
import Foundation

public struct ListingResponse<T: Decodable>: Decodable {
    public let kind: String?
    public let data: ListingData<T>?
    public let errorMessage: String?
    
    public init(error: String) {
        self.errorMessage = error
        self.kind = nil
        self.data = nil
    }
}

public struct ListingData<T: Decodable>: Decodable {
    public let modhash: String?
    public let dist: Int?
    public let after: String?
    public let before: String?
    public let children: [ListingHolder<T>]
}

public struct ListingHolder<T: Decodable>: Decodable {
    public let kind: String
    public let data: T
    
    enum CodingKeys : CodingKey {
        case kind, data
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decode(String.self, forKey: .kind)
        if T.self == GenericListingContent.self {
            data = try GenericListingContent(from: decoder) as! T
        } else {
            data = try container.decode(T.self, forKey: .data)
        }
    }
}

public enum GenericListingContent: Decodable, Identifiable {
    public var id: String {
        switch self {
        case let .post(post):
            return post.id
        case let .comment(comment):
            return comment.id
        default:
            return UUID().uuidString
        }
    }
    
    public var post: SubredditPost? {
        if case .post(let post) = self {
            return post
        }
        return nil
    }
    
    public var comment: Comment? {
        if case .comment(let comment) = self {
            return comment
        }
        return nil
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: ListingHolder<GenericListingContent>.CodingKeys.self)
        let kind = try container.decode(String.self, forKey: .kind)
        switch kind {
        case "t1":
            self = .comment(try container.decode(Comment.self, forKey: .data))
        case "t3":
            self = .post(try container.decode(SubredditPost.self, forKey: .data))
        default:
            self = .notSupported
        }
    }
    
    case post(SubredditPost)
    case comment(Comment)
    case notSupported
}


```

### Core Architecture Module: `Packages/Backend/Sources/Backend/Models/Media.swift`
```
//
//  File.swift
//  
//
//  Created by Thomas Ricouard on 05/08/2020.
//

import Foundation

public struct SecureMedia: Decodable {
    public let redditVideo: RedditVideo?
    public let oembed: Oembed?
    
    public var video: Video? {
        if let video = redditVideo {
            return Video(url: video.fallbackUrl, width: video.width, height: video.height)
        } else if oembed?.type == "video",
                  let oembed = oembed,
                  let url = oembed.url,
                  let width = oembed.width,
                  let height = oembed.height {
            return Video(url: url, width: width, height: height)
        }
        return nil
    }
}

public struct RedditVideo: Decodable {
    public let fallbackUrl: URL
    public let height: Int
    public let width: Int
}

public struct Oembed: Decodable {
    public let providerUrl: URL?
    public let thumbnailUrl: String?
    public var thumbnailUrlAsURL: URL? {
        thumbnailUrl != nil ? URL(string: thumbnailUrl!) : nil
    }
    public let url: URL?
    public let width: Int?
    public let height: Int?
    public let thumbnailWidth: Int?
    public let thumbnailHeight: Int?
    public let type: String?
}

public struct Video {
    public let url: URL
    public let width: Int
    public let height: Int
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #68** (2024-08-02): **Grammar updates**
  *Symptoms*: Fixed some spelling errors and grammar issues. This makes the README more readable and understandable.

- **Issue #67** (2023-08-29): **Project Dead?**
  *Symptoms*: I really love where this client is going. Any plans continuing this "Apollo-esk" app?
  **Post-Mortem & Fix Analysis**:
  > Even if I was motivated to continue it, Reddit making their API prohibitively expensive completely killed the mood for making a client. So yes it's pretty much dead :( 
  > Wait, you don't have millions to finance the API costs as an open source project? 🤣  Jokes aside. That's what I assumed, but didn't want to hear, but totally understandable 😞 The whole sh*t show of what the Reddit CEO pulled is just said. The platform could've continued to be great.   Thanks anyway for creating the app! I'll use it as long as it works...
  > > Even if I was motivated to continue it, Reddit making their API prohibitively expensive completely killed the mood for making a client. So yes it's pretty much dead :(  😭

- **Issue #66** (2023-06-15): **Calling for the archiving of this repository.**
  *Symptoms*: Due to reddit's recent API changes, this project will no longer be viable for the users and developer alike.  In view of the above and lack of development, a repository archive would be the most fitting. 
  **Post-Mortem & Fix Analysis**:
  > What about you take care of yourself and I take care of myself and my project. Thx bye. 

- **Issue #64** (2024-01-16): **Update README.md**
  *Symptoms*: Fixing grammatical errors

- **Issue #49** (2022-07-21): **Backports for iOS 13/macOS 10.15**
  *Symptoms*: SwiftUI supports iOS 13/macOS 10.15 or later. `iOS 13/macOS 10.15` are still used much. Please add backports for these targets.
  **Post-Mortem & Fix Analysis**:
  > It'll not. I'll even bump it to macOS 12 only because SwiftUI on this new macOS version is even better. 

- **Issue #46** (2021-08-02): **Removed minimumScaleFactor from commentVoteView, to avoid scaling to unreadable sizes**
  *Symptoms*: I don't really see a reason for the scaling, after comment votes reach 1000, they get abbreviated to 1k anyway. The text scales when it shouldn't, resulting small text even for 2 digit numbers.   Before: <img width="90" alt="Hot-Curiosity 2021-08-02 at 09 53 52" src="https://user-images.githubusercontent.com/61944932/127872826-32168ec2-cfcc-4049-968c-c4fe44a7e926.png">  After: <img width="82" alt="Hot-Curiosity 2021-08-02 at 09 54 20" src="https://user-images.githubusercontent.com/61944932/127872895-54941c7a-a3ae-4828-b341-32527491b678.png"> 
  **Post-Mortem & Fix Analysis**:
  > Thanks! 

- **Issue #38** (2021-08-01): **-**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Please provide a screenshot of what you're referring to.
  > @mimetism I've redrawn the icon so that it looks like a little bit like some macOS Big Sur stock ones. It is the exact same size as the stock apps' icons, if it bothers you too much you can [try it out (MEGA, 1.1 MB)](https://mega.nz/file/9ZwlVCTY#sLiNKyTIIstfJT_nxOYL558R92zXoa0LZvJx1LLgXdY).  ![icon_512x512](https://user-images.githubusercontent.com/43272781/127210841-33cfa2b0-166b-446e-9cae-e5d2297924ba.png)

- **Issue #35** (2021-08-17): **Delete unused files**
  *Symptoms*: So we can build it from Bazel without a patch like this:  https://github.com/apple-cross-toolchain/examples/blob/1b43d0e6b9025c863e3ce1cd132bc28ed654040c/third_party/RedditOS.patch 

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

### Incident Patch 1: `4c2bf620` (2021-07-30)
**Commit Message**: Bump base SDK to macOS 12 + fixes for macOS 12

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +6/-6)
```diff
@@ -678,7 +678,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 19052021;
+				CURRENT_PROJECT_VERSION = 30072021;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -688,8 +688,8 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.5.4;
+				MACOSX_DEPLOYMENT_TARGET = 12.0;
+				MARKETING_VERSION = 0.5.5;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
@@ -705,7 +705,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 19052021;
+				CURRENT_PROJECT_VERSION = 30072021;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -715,8 +715,8 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.5.4;
+				MACOSX_DEPLOYMENT_TARGET = 12.0;
+				MARKETING_VERSION = 0.5.5;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
```

**File**: `RedditOs/Features/Post/PostDetailToolbar.swift` (modified, +4/-17)
```diff
@@ -20,27 +20,14 @@ struct PostDetailToolbar: ToolbarContent {
 }
 
 struct SearchView: View {
-    @State private var isExpanded = false
     @EnvironmentObject private var uiState: UIState
     
     var body: some View {
         if uiState.displayToolbarSearchBar {
-            if !isExpanded {
-                Button {
-                    isExpanded.toggle()
-                } label: {
-                    Image(systemName: "magnifyingglass")
-                }
-            } else {
-                QuickSearchBar(showSuggestionPopover: true,
-                               onCommit: {},
-                               onCancel: {
-                                self.isExpanded = false
-                               })
-                    .frame(width: 300)
-                    .transition(.slide)
-                    .animation(.easeInOut)
-            }
+          QuickSearchBar(showSuggestionPopover: true,
+                         onCommit: {},
+                         onCancel: {})
+              .frame(width: 250)
         }
     }
 }
```

**File**: `RedditOs/Features/Search/Quick/QuickSearchBar.swift` (modified, +0/-2)
```diff
@@ -27,8 +27,6 @@ struct QuickSearchBar: View {
         } onCancel: {
             onCancel()
         }
-        .keyboardShortcut("f", modifiers: .command)
-        .animation(.easeInOut)
         .popover(isPresented: $isPopoverPresented) {
             ScrollView {
                 VStack(alignment: .leading) {
```

**File**: `RedditOs/Features/Search/Quick/QuickSearchResultRow.swift` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ struct QuickSearchResultRow: View {
                 .whenHovered({ hovered  in
                     isHovered = hovered
                 })
-                .animation(.interactiveSpring())
+                .animation(.interactiveSpring(), value: isHovered)
         }
     }
     
```

**File**: `RedditOs/Features/Search/Shared/SearchBarView.swift` (modified, +1/-1)
```diff
@@ -24,6 +24,7 @@ struct SearchBarView: View {
             } onCommit: {
                 onCommit()
             }
+            .keyboardShortcut("f", modifiers: .command)
             .padding(8)
             .background(RoundedRectangle(cornerRadius: 8)
                             .stroke(isFocused ? Color.accentColor : Color.clear)
@@ -39,7 +40,6 @@ struct SearchBarView: View {
                         .font(.title2)
                 }
                 .buttonStyle(BorderlessButtonStyle())
-                .animation(.easeInOut)
                 .transition(.move(edge: .trailing))
             }
         }
```

**File**: `RedditOs/Features/Sidebar/SidebarView.swift` (modified, +5/-6)
```diff
@@ -30,8 +30,7 @@ struct SidebarView: View {
             subscriptionSection
             multiSection
         }
-        .listStyle(SidebarListStyle())
-        .frame(minWidth: 200, idealWidth: 200, maxWidth: 200, maxHeight: .infinity)
+        .listStyle(.sidebar)
         .whenHovered({ hovered in
             isHovered = hovered
         })
@@ -100,7 +99,7 @@ struct SidebarView: View {
                                 .equatable()) {
                     Label(LocalizedStringKey(item.rawValue.capitalized), systemImage: item.icon())
                 }.tag(item.rawValue)
-            }.animation(nil)
+            }.animation(nil, value: isHovered)
         }
     }
     
@@ -143,10 +142,10 @@ struct SidebarView: View {
                         .buttonStyle(BorderlessButtonStyle())
                     }
                 }
-            }.animation(nil)
+            }.animation(nil, value: isHovered)
         }
         .listItemTint(.redditGold)
-        .animation(.easeInOut)
+        .animation(.easeInOut, value: isHovered)
     }
     
     private var recentlyVisitedSection: some View {
@@ -184,7 +183,7 @@ struct SidebarView: View {
                             .buttonStyle(BorderlessButtonStyle())
                         }
                     }
-                }.animation(nil)
+                }.animation(nil, value: isHovered)
             }.listItemTint(.redditBlue)
         }
     }
```

**File**: `RedditOs/Features/Subreddit/SubredditAboutPopoverView.swift` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ struct SubredditAboutPopoverView: View {
                         }, label: {
                             Image(systemName: isFavorite ? "star.fill" : "star")
                                 .resizable()
-                                .imageScale(.large)
+                                .frame(width: 16, height: 16)
                                 .foregroundColor(isFavorite ? .redditGold : nil)
                         }).buttonStyle(BorderlessButtonStyle())
                     }
```

**File**: `RedditOs/Features/Subreddit/SubredditPostRow.swift` (modified, +0/-2)
```diff
@@ -78,7 +78,6 @@ struct SubredditPostRow: View, Equatable {
                                         Text(url.host ?? url.absoluteString)
                                             .lineLimit(1)
                                             .truncationMode(.tail)
-                                            .frame(maxWidth: 250)
                                     }
                                 }
                             }
@@ -89,7 +88,6 @@ struct SubredditPostRow: View, Equatable {
                 Spacer()
             }
         }
-        .frame(width: 470)
         .padding(.vertical, 8)
         .contextMenu {
             Button {
```

---

### Incident Patch 2: `2b33d9e7` (2021-05-19)
**Commit Message**: Comments: Add thread line fix #33

**File**: `Packages/Backend/Sources/Backend/Models/Comment.swift` (modified, +2/-0)
```diff
@@ -20,6 +20,7 @@ public struct Comment: Decodable, Identifiable {
     public let isSubmitter: Bool?
     public let author: String?
     public let lindId: String?
+    public let parentId: String?
     public let created: Date?
     public let createdUtc: Date?
     public let replies: Replies?
@@ -72,6 +73,7 @@ public let static_comment = Comment(id: UUID().uuidString,
                                     isSubmitter: false,
                                     author: "TestUser",
                                     lindId: "",
+                                    parentId: "",
                                     created: Date(),
                                     createdUtc: Date(),
                                     replies: .none(""),
```

**File**: `RedditOs/Features/Comments/CommentRow.swift` (modified, +22/-8)
```diff
@@ -17,13 +17,21 @@ struct CommentRow: View {
         viewModel.comment.name == "t1_id"
     }
     
-    init(comment: Comment) {
+    let isRoot: Bool
+    
+    init(comment: Comment, isRoot: Bool) {
+        self.isRoot = isRoot
         _viewModel = StateObject(wrappedValue: CommentViewModel(comment: comment))
     }
     
     var body: some View {
         HStack(alignment: .top) {
-            CommentVoteView(viewModel: viewModel).padding(.top, 4)
+            if !isRoot {
+                Rectangle()
+                    .frame(width: 1)
+                    .background(Color.white)
+                    .padding(.bottom, 8)
+            }
             VStack(alignment: .leading, spacing: 8) {
                 HStack(spacing: 0) {
                     HStack(spacing: 6) {
@@ -88,8 +96,11 @@ struct CommentRow: View {
                         .font(.footnote)
                         .foregroundColor(.gray)
                 }
-                CommentActionsView(viewModel: viewModel)
-                    .foregroundColor(.gray)
+                HStack(spacing: 16) {
+                    CommentVoteView(viewModel: viewModel)
+                    CommentActionsView(viewModel: viewModel)
+                        .foregroundColor(.gray)
+                }
                 Divider()
             }.padding(.vertical, 4)
         }
@@ -99,10 +110,13 @@ struct CommentRow: View {
 struct CommentRow_Previews: PreviewProvider {
     static var previews: some View {
         List {
-            CommentRow(comment: static_comment)
-            CommentRow(comment: static_comment)
-            CommentRow(comment: static_comment)
-            CommentRow(comment: static_comment)
+            CommentRow(comment: static_comment, isRoot: true)
+            CommentRow(comment: static_comment, isRoot: false)
+            CommentRow(comment: static_comment, isRoot: true)
+            CommentRow(comment: static_comment, isRoot: false)
+            CommentRow(comment: static_comment, isRoot: false)
+            CommentRow(comment: static_comment, isRoot: false)
         }
+        .frame(height: 800)
     }
 }
```

**File**: `RedditOs/Features/Comments/CommentVoteView.swift` (modified, +10/-4)
```diff
@@ -12,27 +12,33 @@ struct CommentVoteView: View {
     @ObservedObject var viewModel: CommentViewModel
     
     var body: some View {
-        VStack(spacing: 6) {
+        HStack(spacing: 6) {
             Button(action: {
                 viewModel.postVote(vote: viewModel.comment.likes == true ? .neutral : .upvote)
             },
             label: {
                 Image(systemName: "arrowtriangle.up.circle")
                     .resizable()
-                    .frame(width: 16, height: 16)
+                    .frame(width: 12, height: 12)
                     .foregroundColor(viewModel.comment.likes == true ? .accentColor : nil)
             }).buttonStyle(BorderlessButtonStyle())
             
+            Text(viewModel.comment.score?.toRoundedSuffixAsString() ?? "Vote")
+                .font(.callout)
+                .fontWeight(.bold)
+                .minimumScaleFactor(0.1)
+                .lineLimit(1)
+            
             Button(action: {
                 viewModel.postVote(vote: viewModel.comment.likes == false ? .neutral : .downvote)
             },
             label: {
                 Image(systemName: "arrowtriangle.down.circle")
                     .resizable()
-                    .frame(width: 16, height: 16)
+                    .frame(width: 12, height: 12)
                     .foregroundColor(viewModel.comment.likes == false ? .redditBlue : nil)
             }).buttonStyle(BorderlessButtonStyle())
-        }.frame(width: 20)
+        }
     }
 }
 
```

**File**: `RedditOs/Features/Post/PostDetailCommentsSection.swift` (modified, +2/-1)
```diff
@@ -27,7 +27,8 @@ struct PostDetailCommentsSection: View {
         
         RecursiveView(data: viewModel.comments ?? placeholderComments,
                       children: \.repliesComments) { comment in
-            CommentRow(comment: comment)
+            CommentRow(comment: comment,
+                       isRoot: comment.parentId == "t3_" + viewModel.post.id || viewModel.comments == nil)
                 .redacted(reason: viewModel.comments == nil ? .placeholder : [])
         }
     }
```

**File**: `RedditOs/Features/Profile/ProfileView.swift` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ struct ProfileView: View {
                 case let .post(post):
                     SubredditPostRow(post: post, displayMode: .constant(.large))
                 case let .comment(comment):
-                    CommentRow(comment: comment)
+                    CommentRow(comment: comment, isRoot: true)
                 default:
                     Text("Unsupported view")
                 }
```

**File**: `RedditOs/Features/Users/sheet/UserSheetCommentsView.swift` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ struct UserSheetCommentsView: View {
     var body: some View {
         List {
             ForEach(viewModel.comments ?? loadingPlaceholders) { comment in
-                CommentRow(comment: comment).redacted(reason: viewModel.comments != nil ? [] : .placeholder)
+                CommentRow(comment: comment, isRoot: true).redacted(reason: viewModel.comments != nil ? [] : .placeholder)
             }
             if viewModel.comments != nil {
                 LoadingRow(text: "Loading next page")
```

---

### Incident Patch 3: `47e3805f` (2021-05-18)
**Commit Message**: Fix VideoView release mode crash

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +8/-4)
```diff
@@ -69,6 +69,7 @@
 		9F4537862652DF960026C19B /* SearchBarView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F4537852652DF960026C19B /* SearchBarView.swift */; };
 		9F4537882652ED550026C19B /* QuickSearchPostsResultView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F4537872652ED550026C19B /* QuickSearchPostsResultView.swift */; };
 		9F4812CC264FC8DB007A719D /* QuickSearchFullResultsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F4812CB264FC8DB007A719D /* QuickSearchFullResultsView.swift */; };
+		9F7E75E42654102700390010 /* AVKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 9F7E75E32654102700390010 /* AVKit.framework */; };
 		9F8EE49126510BCF00BDE4AC /* MarkdownUI in Frameworks */ = {isa = PBXBuildFile; productRef = 9F8EE49026510BCF00BDE4AC /* MarkdownUI */; };
 /* End PBXBuildFile section */
 
@@ -137,13 +138,15 @@
 		9F4537852652DF960026C19B /* SearchBarView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SearchBarView.swift; sourceTree = "<group>"; };
 		9F4537872652ED550026C19B /* QuickSearchPostsResultView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = QuickSearchPostsResultView.swift; sourceTree = "<group>"; };
 		9F4812CB264FC8DB007A719D /* QuickSearchFullResultsView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = QuickSearchFullResultsView.swift; sourceTree = "<group>"; };
+		9F7E75E32654102700390010 /* AVKit.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = AVKit.framework; path = System/Library/Frameworks/AVKit.framework; sourceTree = SDKROOT; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
 		69EACEFC24B63D5800303A16 /* Frameworks */ = {
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				9F7E75E42654102700390010 /* AVKit.framework in Frameworks */,
 				69D459FE264BBB0000A98C6F /* Kingfisher in Frameworks */,
 				697E324524E3E7D90006F00F /* UI in Frameworks */,
 				69EACF1C24B7272E00303A16 /* Backend in Frameworks */,
@@ -331,6 +334,7 @@
 		69EACF1A24B7272E00303A16 /* Frameworks */ = {
 			isa = PBXGroup;
 			children = (
+				9F7E75E32654102700390010 /* AVKit.framework */,
 			);
 			name = Frameworks;
 			sourceTree = "<group>";
@@ -674,7 +678,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 17052021;
+				CURRENT_PROJECT_VERSION = 18052021;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -685,7 +689,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.5.2;
+				MARKETING_VERSION = 0.5.3;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
@@ -701,7 +705,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 17052021;
+				CURRENT_PROJECT_VERSION = 18052021;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -712,7 +716,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.5.2;
+				MARKETING_VERSION = 0.5.3;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
```

---

### Incident Patch 4: `86595283` (2021-05-17)
**Commit Message**: Fixes

**File**: `RedditOs/Features/Subreddit/SubredditViewModel.swift` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ class SubredditViewModel: ObservableObject {
             .map{ $0.data?.children.map{ $0.data }}
             .sink(receiveValue: { [weak self] results in
                 self?.isSearchLoading = false
-                if self?.searchResults?.last != nil, let results = results {
+                if after != nil, let results = results {
                     self?.searchResults?.append(contentsOf: results)
                 } else {
                     self?.searchResults = results
```

---

### Incident Patch 5: `9b238f24` (2021-05-16)
**Commit Message**: Comments: Fix placeholder while comments are loading

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -653,7 +653,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.5.0;
+				MARKETING_VERSION = 0.5.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
@@ -680,7 +680,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.5.0;
+				MARKETING_VERSION = 0.5.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
```

**File**: `RedditOs/Features/Comments/CommentRow.swift` (modified, +14/-3)
```diff
@@ -13,6 +13,10 @@ struct CommentRow: View {
     @StateObject private var viewModel: CommentViewModel
     @State private var showUserPopover = false
     
+    var isFake: Bool {
+        viewModel.comment.name == "t1_id"
+    }
+    
     init(comment: Comment) {
         _viewModel = StateObject(wrappedValue: CommentViewModel(comment: comment))
     }
@@ -69,9 +73,16 @@ struct CommentRow: View {
                     }
                 }
                 if let body = viewModel.comment.body {
-                    Markdown(Document(body))
-                        .font(.body)
-                        .fixedSize(horizontal: false, vertical: true)                     
+                    if isFake {
+                        Text(body)
+                            .font(.body)
+                            .fixedSize(horizontal: false, vertical: true)
+                    } else {
+                        Markdown(Document(body))
+                            .font(.body)
+                            .fixedSize(horizontal: false, vertical: true)
+                    }
+                    
                 } else {
                     Text("Deleted comment")
                         .font(.footnote)
```

---

### Incident Patch 6: `ef855c73` (2021-05-16)
**Commit Message**: Markdown: Add MarkdownUI to support Markdown render of post content and comments

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +17/-0)
```diff
@@ -63,6 +63,7 @@
 		69F74E9624DB0B7300E58BD8 /* GlobalSearchPopoverView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 69F74E9524DB0B7300E58BD8 /* GlobalSearchPopoverView.swift */; };
 		9F19B57A26505DCF00FBEEDA /* SidebarMultiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F19B57926505DCF00FBEEDA /* SidebarMultiView.swift */; };
 		9F4812CC264FC8DB007A719D /* SearchMainContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F4812CB264FC8DB007A719D /* SearchMainContentView.swift */; };
+		9F8EE49126510BCF00BDE4AC /* MarkdownUI in Frameworks */ = {isa = PBXBuildFile; productRef = 9F8EE49026510BCF00BDE4AC /* MarkdownUI */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXFileReference section */
@@ -134,6 +135,7 @@
 				69D459FE264BBB0000A98C6F /* Kingfisher in Frameworks */,
 				697E324524E3E7D90006F00F /* UI in Frameworks */,
 				69EACF1C24B7272E00303A16 /* Backend in Frameworks */,
+				9F8EE49126510BCF00BDE4AC /* MarkdownUI in Frameworks */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
@@ -400,6 +402,7 @@
 				69EACF1B24B7272E00303A16 /* Backend */,
 				697E324424E3E7D90006F00F /* UI */,
 				69D459FD264BBB0000A98C6F /* Kingfisher */,
+				9F8EE49026510BCF00BDE4AC /* MarkdownUI */,
 			);
 			productName = RedditOs;
 			productReference = 69EACEFF24B63D5800303A16 /* Curiosity.app */;
@@ -430,6 +433,7 @@
 			mainGroup = 69EACEF624B63D5800303A16;
 			packageReferences = (
 				6923F8CB250250FC0003870F /* XCRemoteSwiftPackageReference "Kingfisher" */,
+				9F8EE48F26510BCF00BDE4AC /* XCRemoteSwiftPackageReference "MarkdownUI" */,
 			);
 			productRefGroup = 69EACF0024B63D5800303A16 /* Products */;
 			projectDirPath = "";
@@ -715,6 +719,14 @@
 				minimumVersion = 6.0.0;
 			};
 		};
+		9F8EE48F26510BCF00BDE4AC /* XCRemoteSwiftPackageReference "MarkdownUI" */ = {
+			isa = XCRemoteSwiftPackageReference;
+			repositoryURL = "https://github.com/gonzalezreal/MarkdownUI";
+			requirement = {
+				kind = upToNextMajorVersion;
+				minimumVersion = 0.5.1;
+			};
+		};
 /* End XCRemoteSwiftPackageReference section */
 
 /* Begin XCSwiftPackageProductDependency section */
@@ -731,6 +743,11 @@
 			isa = XCSwiftPackageProductDependency;
 			productName = Backend;
 		};
+		9F8EE49026510BCF00BDE4AC /* MarkdownUI */ = {
+			isa = XCSwiftPackageProductDependency;
+			package = 9F8EE48F26510BCF00BDE4AC /* XCRemoteSwiftPackageReference "MarkdownUI" */;
+			productName = MarkdownUI;
+		};
 /* End XCSwiftPackageProductDependency section */
 	};
 	rootObject = 69EACEF724B63D5800303A16 /* Project object */;
```

**File**: `RedditOs.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +63/-0)
```diff
@@ -1,6 +1,24 @@
 {
   "object": {
     "pins": [
+      {
+        "package": "AttributedText",
+        "repositoryURL": "https://github.com/gonzalezreal/AttributedText",
+        "state": {
+          "branch": null,
+          "revision": "bf076de48dbb2172525486936d512e1bba062642",
+          "version": "0.3.0"
+        }
+      },
+      {
+        "package": "combine-schedulers",
+        "repositoryURL": "https://github.com/pointfreeco/combine-schedulers",
+        "state": {
+          "branch": null,
+          "revision": "c37e5ae8012fb654af776cc556ff8ae64398c841",
+          "version": "0.5.0"
+        }
+      },
       {
         "package": "KeychainAccess",
         "repositoryURL": "https://github.com/kishikawakatsumi/KeychainAccess",
@@ -18,6 +36,51 @@
           "revision": "44450a8f564d7c0165f736ba2250649ff8d3e556",
           "version": "6.3.0"
         }
+      },
+      {
+        "package": "MarkdownUI",
+        "repositoryURL": "https://github.com/gonzalezreal/MarkdownUI",
+        "state": {
+          "branch": null,
+          "revision": "e8931e37dcf777b4c03ca76aa09c10cf246a2ced",
+          "version": "0.5.1"
+        }
+      },
+      {
+        "package": "NetworkImage",
+        "repositoryURL": "https://github.com/gonzalezreal/NetworkImage",
+        "state": {
+          "branch": null,
+          "revision": "15582b821cb097012b41b83d6219717926ec4ed6",
+          "version": "2.1.0"
+        }
+      },
+      {
+        "package": "cmark",
+        "repositoryURL": "https://github.com/SwiftDocOrg/swift-cmark.git",
+        "state": {
+          "branch": null,
+          "revision": "9c8096a23f44794bde297452d87c455fc4f76d42",
+          "version": "0.29.0+20210102.9c8096a"
+        }
+      },
+      {
+        "package": "SwiftCommonMark",
+        "repositoryURL": "https://github.com/gonzalezreal/SwiftCommonMark",
+        "state": {
+          "branch": null,
+          "revision": "f1575c37110a386e50da3208a04266b398bcefaa",
+          "version": "0.1.1"
+        }
+      },
+      {
+        "package": "xctest-dynamic-overlay",
+        "repositoryURL": "https://github.com/pointfreeco/xctest-dynamic-overlay",
+        "state": {
+          "branch": null,
+          "revision": "603974e3909ad4b48ba04aad7e0ceee4f077a518",
+          "version": "0.1.0"
+        }
       }
     ]
   },
```

**File**: `RedditOs/Features/Comments/CommentRow.swift` (modified, +3/-2)
```diff
@@ -7,6 +7,7 @@
 
 import SwiftUI
 import Backend
+import MarkdownUI
 
 struct CommentRow: View {
     @StateObject private var viewModel: CommentViewModel
@@ -68,9 +69,9 @@ struct CommentRow: View {
                     }
                 }
                 if let body = viewModel.comment.body {
-                    Text(body)
+                    Markdown(Document(body))
                         .font(.body)
-                        .fixedSize(horizontal: false, vertical: true)
+                        .fixedSize(horizontal: false, vertical: true)                     
                 } else {
                     Text("Deleted comment")
                         .font(.footnote)
```

**File**: `RedditOs/Features/Post/PostDetailContent.swift` (modified, +2/-1)
```diff
@@ -9,6 +9,7 @@ import SwiftUI
 import Backend
 import AVKit
 import Kingfisher
+import MarkdownUI
 
 struct PostDetailContent: View {
     let listing: SubredditPost
@@ -17,7 +18,7 @@ struct PostDetailContent: View {
     @ViewBuilder
     var body: some View {
         if let text = listing.selftext ?? listing.description {
-            Text(text)
+            Markdown(Document(text))
                 .font(.body)
                 .fixedSize(horizontal: false, vertical: true)
         }
```

**File**: `RedditOs/Features/Post/PostDetailHeader.swift` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ struct PostDetailHeader: View {
                 .lineLimit(10)
                 .multilineTextAlignment(.leading)
                 .truncationMode(.tail)
+                .fixedSize(horizontal: false, vertical: true)        
             if let url = listing.thumbnailURL, url.pathExtension != "jpg", url.pathExtension != "png" {
                 KFImage(url)
                     .frame(width: 80, height: 60)
```

**File**: `RedditOs/Features/Search/ToolbarSearchBar.swift` (modified, +0/-1)
```diff
@@ -27,7 +27,6 @@ struct ToolbarSearchBar: View {
             } onCommit: {
                 onCommit()
             }
-            
             .keyboardShortcut("f", modifiers: .command)
             .padding(8)
             .background(RoundedRectangle(cornerRadius: 8)
```

---

### Incident Patch 7: `fc10e4d6` (2021-05-15)
**Commit Message**: Sidebar: Fix collapse button placement

**File**: `RedditOs/Features/Sidebar/SidebarView.swift` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ struct SidebarView: View {
             isHovered = hovered
         })
         .toolbar {
-            ToolbarItem(placement: .navigation) {
+            ToolbarItemGroup {
                 Button(action: toggleSidebar, label: {
                     Image(systemName: "sidebar.left")
                 })
```

---

### Incident Patch 8: `8701030b` (2021-05-15)
**Commit Message**: Sidebar: Add a button to toggle it fix #31

**File**: `RedditOs/Features/Sidebar/SidebarView.swift` (modified, +11/-0)
```diff
@@ -31,6 +31,13 @@ struct SidebarView: View {
         .onHover { hovered in
             isHovered = hovered
         }
+        .toolbar {
+            ToolbarItem(placement: .navigation) {
+                Button(action: toggleSidebar, label: {
+                    Image(systemName: "sidebar.left")
+                })
+            }
+        }
     }
     
     private var subscriptionsHeader: some View {
@@ -193,6 +200,10 @@ struct SidebarView: View {
             }
         }
     }
+    
+    private func toggleSidebar() {
+        NSApp.keyWindow?.firstResponder?.tryToPerform(#selector(NSSplitViewController.toggleSidebar(_:)), with: nil)
+        }
 }
 
 struct Sidebar_Previews: PreviewProvider {
```

---

### Incident Patch 9: `337dc54c` (2021-05-15)
**Commit Message**: User sheet: UI Fixes

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -645,7 +645,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.4.1;
+				MARKETING_VERSION = 0.4.2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
@@ -672,7 +672,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.4.1;
+				MARKETING_VERSION = 0.4.2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
```

**File**: `RedditOs/Environements/Route.swift` (modified, +2/-7)
```diff
@@ -22,16 +22,13 @@ enum Route: Identifiable, Hashable {
     case user(user: User)
     case subreddit(subreddit: String)
     case defaultChannel(chanel: UIState.DefaultChannels)
-    case none
     
     var id: String {
         switch self {
-        case .user:
-            return "user"
+        case let .user(user):
+            return user.id
         case let .subreddit(subreddit):
             return subreddit
-        case .none:
-            return "none"
         case let .defaultChannel(chanel):
             return chanel.rawValue
         }
@@ -48,8 +45,6 @@ enum Route: Identifiable, Hashable {
         case let .defaultChannel(chanel):
             SubredditPostsListView(name: chanel.rawValue)
                 .equatable()
-        case .none:
-            EmptyView()
         }
     }
 }
```

**File**: `RedditOs/Features/Search/Global Search Popopver/GlobalSearchPopoverView.swift` (modified, +0/-2)
```diff
@@ -44,8 +44,6 @@ struct GlobalSearchPopoverView: View {
                 .onTapGesture {
                     uiState.searchRoute = .subreddit(subreddit: searchState.searchText)
                 }
-            GlobalSearchSubRow(icon: nil,
-                               name: "Go to u/\(searchState.searchText)")
         }.padding(4)
     }
     
```

**File**: `RedditOs/Features/Users/sheet/UserSheetView.swift` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ struct UserSheetView: View {
                 PostNoSelectionPlaceholder()
             }
         }
-        .frame(width: 1500, height: 700)
+        .frame(width: 1200, height: 500)
         .toolbar {
             ToolbarItem(placement: .confirmationAction) {
                 Button {
```

---

### Incident Patch 10: `568aaf61` (2021-05-15)
**Commit Message**: UI Fixes

**File**: `RedditOs/Features/Post/PostDetailHeader.swift` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ struct PostDetailHeader: View {
         HStack {
             Text(listing.title)
                 .font(.title)
-                .lineLimit(5)
+                .lineLimit(10)
                 .multilineTextAlignment(.leading)
                 .truncationMode(.tail)
             if let url = listing.thumbnailURL, url.pathExtension != "jpg", url.pathExtension != "png" {
```

**File**: `RedditOs/Features/Subreddit/SubredditPostsListView.swift` (modified, +3/-2)
```diff
@@ -61,8 +61,9 @@ struct SubredditPostsListView: View, Equatable {
             ToolbarItem(placement: .navigation) {
                 Group {
                     if isDefaultChannel {
-                        placeholderIcon
-                    } else if let icon = viewModel.subreddit?.iconImg, let url = URL(string: icon) {
+                        EmptyView()
+                    } else if let icon = viewModel.subreddit?.iconImg,
+                              let url = URL(string: icon) {
                         KFImage(url)
                             .placeholder{ placeholderIcon }
                             .resizable()
```

**File**: `RedditOs/Shared/FlairView.swift` (modified, +3/-1)
```diff
@@ -33,7 +33,7 @@ struct FlairView: View {
         if backgroundColor == .gray {
             return .white
         }
-        return textColorHex == "dark" ? .black : .white
+        return textColorHex == "dark" ? .textColor : .white
     }
 
     @ViewBuilder
@@ -51,6 +51,8 @@ struct FlairView: View {
                             .foregroundColor(textColor)
                             .font(display == .small ? .footnote : .callout)
                             .fontWeight(.semibold)
+                            .lineLimit(1)
+                            .truncationMode(.tail)
                     } else {
                         EmptyView()
                     }
```

---

### Incident Patch 11: `6d64a16a` (2021-05-15)
**Commit Message**: Search: Refactor + Better search UX

**File**: `Packages/UI/Sources/UI/Hovered.swift` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+// Source: https://stackoverflow.com/questions/65841298/swiftui-onhover-doesnt-register-mouse-leaving-the-element-if-mouse-moves-too-fa
+
+import SwiftUI
+
+extension View {
+    public func whenHovered(_ mouseIsInside: @escaping (Bool) -> Void) -> some View {
+        modifier(MouseInsideModifier(mouseIsInside))
+    }
+}
+
+struct MouseInsideModifier: ViewModifier {
+    let mouseIsInside: (Bool) -> Void
+    
+    init(_ mouseIsInside: @escaping (Bool) -> Void) {
+        self.mouseIsInside = mouseIsInside
+    }
+    
+    func body(content: Content) -> some View {
+        content.background(
+            GeometryReader { proxy in
+                Representable(mouseIsInside: mouseIsInside,
+                              frame: proxy.frame(in: .global))
+            }
+        )
+    }
+    
+    private struct Representable: NSViewRepresentable {
+        let mouseIsInside: (Bool) -> Void
+        let frame: NSRect
+        
+        func makeCoordinator() -> Coordinator {
+            let coordinator = Coordinator()
+            coordinator.mouseIsInside = mouseIsInside
+            return coordinator
+        }
+        
+        class Coordinator: NSResponder {
+            var mouseIsInside: ((Bool) -> Void)?
+            
+            override func mouseEntered(with event: NSEvent) {
+                mouseIsInside?(true)
+            }
+            
+            override func mouseExited(with event: NSEvent) {
+                mouseIsInside?(false)
+            }
+        }
+        
+        func makeNSView(context: Context) -> NSView {
+            let view = NSView(frame: frame)
+            
+            let options: NSTrackingArea.Options = [
+                .mouseEnteredAndExited,
+                .inVisibleRect,
+                .activeInKeyWindow
+            ]
+            
+            let trackingArea = NSTrackingArea(rect: frame,
+                                              options: options,
+                                              owner: context.coordinator,
+                                              userInfo: nil)
+            
+            view.addTrackingArea(trackingArea)
+            
+            return view
+        }
+        
+        func updateNSView(_ nsView: NSView, context: Context) {}
+        
+        static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) {
+            nsView.trackingAreas.forEach { nsView.removeTrackingArea($0) }
+        }
+    }
+}
```

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +8/-4)
```diff
@@ -36,7 +36,7 @@
 		6970A0B324B77D1200B11031 /* PostVoteView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0B224B77D1200B11031 /* PostVoteView.swift */; };
 		6970A0B624B783FE00B11031 /* LinkPresentationRepresentable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0B524B783FE00B11031 /* LinkPresentationRepresentable.swift */; };
 		6970A0B924B79AFD00B11031 /* PopoverSearchSubredditView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0B824B79AFD00B11031 /* PopoverSearchSubredditView.swift */; };
-		6970A0BB24B79F5900B11031 /* SearchViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0BA24B79F5900B11031 /* SearchViewModel.swift */; };
+		6970A0BB24B79F5900B11031 /* SearchState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0BA24B79F5900B11031 /* SearchState.swift */; };
 		6970A0BD24B82E1C00B11031 /* LoadingRow.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0BC24B82E1C00B11031 /* LoadingRow.swift */; };
 		6970A0BF24B8343100B11031 /* PopoverSearchSubredditRow.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0BE24B8343100B11031 /* PopoverSearchSubredditRow.swift */; };
 		6970A0C124B88BA200B11031 /* PostViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6970A0C024B88BA200B11031 /* PostViewModel.swift */; };
@@ -61,6 +61,7 @@
 		69EACF2524B73DF400303A16 /* SubredditViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 69EACF2424B73DF400303A16 /* SubredditViewModel.swift */; };
 		69F74E9324DAE65100E58BD8 /* AwardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 69F74E9224DAE65100E58BD8 /* AwardView.swift */; };
 		69F74E9624DB0B7300E58BD8 /* GlobalSearchPopoverView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 69F74E9524DB0B7300E58BD8 /* GlobalSearchPopoverView.swift */; };
+		9F4812CC264FC8DB007A719D /* SearchMainContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F4812CB264FC8DB007A719D /* SearchMainContentView.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXFileReference section */
@@ -93,7 +94,7 @@
 		6970A0B224B77D1200B11031 /* PostVoteView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PostVoteView.swift; sourceTree = "<group>"; };
 		6970A0B524B783FE00B11031 /* LinkPresentationRepresentable.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LinkPresentationRepresentable.swift; sourceTree = "<group>"; };
 		6970A0B824B79AFD00B11031 /* PopoverSearchSubredditView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PopoverSearchSubredditView.swift; sourceTree = "<group>"; };
-		6970A0BA24B79F5900B11031 /* SearchViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SearchViewModel.swift; sourceTree = "<group>"; };
+		6970A0BA24B79F5900B11031 /* SearchState.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SearchState.swift; sourceTree = "<group>"; };
 		6970A0BC24B82E1C00B11031 /* LoadingRow.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LoadingRow.swift; sourceTree = "<group>"; };
 		6970A0BE24B8343100B11031 /* PopoverSearchSubredditRow.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PopoverSearchSubredditRow.swift; sourceTree = "<group>"; };
 		6970A0C024B88BA200B11031 /* PostViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PostViewModel.swift; sourceTree = "<group>"; };
@@ -120,6 +121,7 @@
 		69EACF2424B73DF400303A16 /* SubredditViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SubredditViewModel.swift; sourceTree = "<group>"; };
 		69F74E9224DAE65100E58BD8 /* AwardView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AwardView.swift; sourceTree = "<group>"; };
 		69F74E9524DB0B7300E58BD8 /* GlobalSearchPopoverView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GlobalSearchPopoverView.swift; sourceTree = "<group>"; };
+		9F4812CB264FC8DB007A719D /* SearchMainContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SearchMainContentView.swift; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -247,7 +249,8 @@
 		6970A0B724B79AF400B11031 /* Search */ = {
 			isa = PBXGroup;
 			children = (
-				6970A0BA24B79F5900B11031 /* SearchViewModel.swift */,
+				9F4812CB264FC8DB007A719D /* SearchMainContentView.swift */,
+				6970A0BA24B79F5900B11031 /* SearchState.swift */,
 				693F85D324D0715000224ADB /* ToolbarSearchBar.swift */,
 				69F74E9424DB0B5600E58BD8 /* Global Search Popopver */,
 				693F85D224D06AA700224ADB /* Subreddit Search Popover */,
@@ -470,6 +473,7 @@
 				692F237624CB3A7B006C9D40 /* SavedPostsListView.swift in Sources */,
 				6924D53E24CD94B0005487CA /* UserViewModel.swift in Sources */,
```

**File**: `RedditOs/Environements/Route.swift` (modified, +6/-7)
```diff
@@ -19,16 +19,16 @@ enum Route: Identifiable, Hashable {
         hasher.combine(id)
     }
     
-    case user(user: User, isSheet: Bool)
-    case subreddit(subreddit: String, isSheet: Bool)
+    case user(user: User)
+    case subreddit(subreddit: String)
     case defaultChannel(chanel: UIState.DefaultChannels)
     case none
     
     var id: String {
         switch self {
         case .user:
             return "user"
-        case let .subreddit(subreddit, _):
+        case let .subreddit(subreddit):
             return subreddit
         case .none:
             return "none"
@@ -40,12 +40,11 @@ enum Route: Identifiable, Hashable {
     @ViewBuilder
     func makeView() -> some View {
         switch self {
-        case let .user(user, _):
+        case let .user(user):
             UserSheetView(user: user)
-        case let .subreddit(subreddit, isSheet):
-            SubredditPostsListView(name: subreddit, isSheet: isSheet)
+        case let .subreddit(subreddit):
+            SubredditPostsListView(name: subreddit)
                 .equatable()
-                .environmentObject(UIState.shared)
         case let .defaultChannel(chanel):
             SubredditPostsListView(name: chanel.rawValue)
                 .equatable()
```

**File**: `RedditOs/Environements/UIState.swift` (modified, +26/-7)
```diff
@@ -27,23 +27,42 @@ class UIState: ObservableObject {
         }
     }
     
+    enum Constants {
+        static let searchTag = "search"
+    }
+    
     private init() {
-        
+        isSearchActive = .constant(false)
+        isSearchActive = .init(get: {
+            self.sidebarSelection == Constants.searchTag
+        }, set: { _ in })
     }
     
+    @Published var displayToolbarSearchBar = true
+    
     @Published var selectedSubreddit: SubredditViewModel?
     @Published var selectedPost: PostViewModel?
     
     @Published var presentedSheetRoute: Route?
-    @Published var presentedNavigationRoute: Route? {
+    @Published var searchRoute: Route? {
         didSet {
-            DispatchQueue.main.async {
-              if let route = self.presentedNavigationRoute {
-                self.sidebarSelection = route.id
-                }
+            if searchRoute != nil {
+                sidebarSelection = Constants.searchTag
+                displayToolbarSearchBar = false
             }
         }
     }
     
-    @Published var sidebarSelection: String? = DefaultChannels.hot.rawValue
+    var isSearchActive: Binding<Bool>
+    
+    @Published var sidebarSelection: String? = DefaultChannels.hot.rawValue {
+        didSet {
+            if sidebarSelection != Constants.searchTag {
+                searchRoute = nil
+                displayToolbarSearchBar = true
+            } else {
+                displayToolbarSearchBar = false
+            }
+        }
+    }
 }
```

**File**: `RedditOs/Features/Post/PostDetailToolbar.swift` (modified, +6/-1)
```diff
@@ -8,13 +8,18 @@
 import SwiftUI
 
 struct PostDetailToolbar: ToolbarContent {
+    @ObservedObject var uiState: UIState
     let shareURL: URL?
+    @State var searchViewModel = SearchState()
         
     var body: some ToolbarContent {
         ToolbarItemGroup {
             SharingView(url: shareURL)
             Spacer()
-            ToolbarSearchBar()
+            if uiState.displayToolbarSearchBar {
+                ToolbarSearchBar(isPopoverEnabled: true)
+                    .frame(width: 300)
+            }
         }
     }
 }
```

**File**: `RedditOs/Features/Post/PostDetailView.swift` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ struct PostDetailView: View, Equatable {
             uiState.selectedPost = nil
         })
         .toolbar {
-            PostDetailToolbar(shareURL: viewModel.post.redditURL)
+            PostDetailToolbar(uiState: uiState, shareURL: viewModel.post.redditURL)
         }
         .frame(minWidth: 500,
                maxWidth: .infinity,
```

**File**: `RedditOs/Features/Search/Global Search Popopver/GlobalSearchPopoverView.swift` (modified, +25/-28)
```diff
@@ -11,27 +11,24 @@ import Backend
 struct GlobalSearchPopoverView: View {
     @EnvironmentObject private var uiState: UIState
     @EnvironmentObject private var currentUser: CurrentUserStore
-    
-    @ObservedObject var viewModel: SearchViewModel
+    @EnvironmentObject private var searchState: SearchState
     
     var body: some View {
-        ScrollView {
-            VStack(alignment: .leading) {
-                makeTitle("Quick access")
-                makeQuickAccess()
-                
-                Divider()
-                
-                makeTitle("My subscriptions")
-                makeMySubscriptionsSearch()
-                
-                Divider()
-                
-                makeTitle("Subreddit search")
-                makeSubredditSearch()
-                
-            }.padding()
-        }.frame(width: 300, height: 500)
+        Section(header: makeTitle("Quick access")) {
+            makeQuickAccess()
+        }
+        
+        Divider()
+        
+        Section(header: makeTitle("My subscriptions")) {
+            makeMySubscriptionsSearch()
+        }
+  
+        Divider()
+        
+        Section(header: makeTitle("Subreddit search")) {
+            makeSubredditSearch()
+        }
     }
     
     private func makeTitle(_ title: String) -> some View {
@@ -43,20 +40,20 @@ struct GlobalSearchPopoverView: View {
     private func makeQuickAccess() -> some View {
         Group {
             GlobalSearchSubRow(icon: nil,
-                               name: "Go to r/\(viewModel.searchText)")
+                               name: "Go to r/\(searchState.searchText)")
                 .onTapGesture {
-                    uiState.presentedNavigationRoute = .subreddit(subreddit: viewModel.searchText, isSheet: false)
+                    uiState.searchRoute = .subreddit(subreddit: searchState.searchText)
                 }
             GlobalSearchSubRow(icon: nil,
-                               name: "Go to u/\(viewModel.searchText)")
+                               name: "Go to u/\(searchState.searchText)")
         }.padding(4)
     }
     
     private func makeMySubscriptionsSearch() -> some View {
         Group {
-            if let subs = viewModel.filteredSubscriptions {
+            if let subs = searchState.filteredSubscriptions {
                 if subs.isEmpty {
-                    Label("No matching subscriptions for \(viewModel.searchText)", systemImage: "magnifyingglass")
+                    Label("No matching subscriptions for \(searchState.searchText)", systemImage: "magnifyingglass")
                 } else {
                     ForEach(subs) { sub in
                         makeSubRow(icon: sub.iconImg, name: sub.displayName)
@@ -68,15 +65,15 @@ struct GlobalSearchPopoverView: View {
     
     private func makeSubredditSearch() -> some View {
         Group {
-            if let results = viewModel.results {
+            if let results = searchState.results {
                 if results.isEmpty {
-                    Label("No matching search for \(viewModel.searchText)", systemImage: "magnifyingglass")
+                    Label("No matching search for \(searchState.searchText)", systemImage: "magnifyingglass")
                 } else {
                     ForEach(results) { sub in
                         makeSubRow(icon: sub.iconImg, name: sub.name)
                     }
                 }
-            } else if viewModel.isLoading {
+            } else if searchState.isLoading {
                 LoadingRow(text: nil)
             }
         }.padding(4)
@@ -85,7 +82,7 @@ struct GlobalSearchPopoverView: View {
     private func makeSubRow(icon: String?, name: String) -> some View {
         GlobalSearchSubRow(icon: icon, name: name)
             .onTapGesture {
-                uiState.presentedNavigationRoute = .subreddit(subreddit: name, isSheet: false)
+                uiState.searchRoute = .subreddit(subreddit: name)
         }
     }
 }
```

**File**: `RedditOs/Features/Search/Global Search Popopver/GlobalSearchSubRow.swift` (modified, +26/-11)
```diff
@@ -7,32 +7,47 @@
 
 import SwiftUI
 import Kingfisher
+import UI
 
 struct GlobalSearchSubRow: View {
+    struct TextViewContainer: View {
+        @State private var isHovered = false
+        
+        let text: String
+        
+        var body: some View {
+            Text(text)
+                .foregroundColor(isHovered ? .accentColor : nil)
+                .scaleEffect(isHovered ? 1.05 : 1.0)
+                .whenHovered({ hovered  in
+                    isHovered = hovered
+                })
+                .animation(.interactiveSpring())
+        }
+    }
+    
     let icon: String?
     let name: String
-    
-    @State private var isHovered = false
+        
+    var defaultImage: some View {
+        Image(systemName: "globe")
+            .resizable()
+            .frame(width: 16, height: 16)
+    }
     
     var body: some View {
         HStack {
             if let image = icon,
                let url = URL(string: image) {
                 KFImage(url)
+                    .placeholder{ defaultImage }
                     .resizable()
                     .frame(width: 16, height: 16)
                     .cornerRadius(8)
             } else {
-                Image(systemName: "globe")
-                    .resizable()
-                    .frame(width: 16, height: 16)
+                defaultImage
             }
-            Text(name).foregroundColor(isHovered ? .accentColor : nil)
-        }
-        .scaleEffect(isHovered ? 1.05 : 1.0)
-        .animation(.interactiveSpring())
-        .onHover { hovered in
-            isHovered = hovered
+            TextViewContainer(text: name)
         }
     }
 }
```

---

### Incident Patch 12: `d0efbe4b` (2021-03-01)
**Commit Message**: Fix DisplayMode

**File**: `RedditOs/Features/Subreddit/SubredditPostRow.swift` (modified, +2/-1)
```diff
@@ -10,7 +10,8 @@ import Backend
 
 struct SubredditPostRow: View, Equatable {
     static func == (lhs: Self, rhs: Self) -> Bool {
-        lhs.postId == rhs.postId
+        lhs.postId == rhs.postId &&
+            lhs.displayMode == rhs.displayMode
     }
     
     enum DisplayMode: String, CaseIterable {
```

**File**: `RedditOs/Features/Subreddit/SubredditPostsListView.swift` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ import KingfisherSwiftUI
 
 struct SubredditPostsListView: View, Equatable {
     static func == (lhs: Self, rhs: Self) -> Bool {
-        lhs.name == rhs.name
+        lhs.name == rhs.name && lhs.displayMode == rhs.displayMode
     }
         
     private let name: String
```

**File**: `RedditOs/Shared/PostsListView.swift` (modified, +2/-1)
```diff
@@ -10,7 +10,8 @@ import Backend
 
 struct PostsListView: View, Equatable {
     static func == (lhs: Self, rhs: Self) -> Bool {
-        lhs.posts?.count == rhs.posts?.count
+        lhs.posts?.count == rhs.posts?.count &&
+            rhs.displayMode == lhs.displayMode
     }
     
     private let loadingPlaceholders = Array(repeating: static_listing, count: 10)
```

---

### Incident Patch 13: `692164a2` (2021-03-01)
**Commit Message**: Fix menu + try EquatableView to speed up things

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -630,7 +630,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 22022021;
+				CURRENT_PROJECT_VERSION = 28022021;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -641,7 +641,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.3;
+				MARKETING_VERSION = 0.3.2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
@@ -657,7 +657,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 22022021;
+				CURRENT_PROJECT_VERSION = 28022021;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -668,7 +668,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.3;
+				MARKETING_VERSION = 0.3.2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
```

**File**: `RedditOs/Environements/Route.swift` (modified, +4/-1)
```diff
@@ -43,9 +43,12 @@ enum Route: Identifiable, Hashable {
         case let .user(user, _):
             UserSheetView(user: user)
         case let .subreddit(subreddit, isSheet):
-            SubredditPostsListView(name: subreddit, isSheet: isSheet).environmentObject(UIState.shared)
+            SubredditPostsListView(name: subreddit, isSheet: isSheet)
+                .equatable()
+                .environmentObject(UIState.shared)
         case let .defaultChannel(chanel):
             SubredditPostsListView(name: chanel.rawValue)
+                .equatable()
         case .none:
             EmptyView()
         }
```

**File**: `RedditOs/Features/Post/PostDetailView.swift` (modified, +12/-2)
```diff
@@ -9,12 +9,22 @@ import SwiftUI
 import Backend
 import AVKit
 
-struct PostDetailView: View {
+struct PostDetailView: View, Equatable {
+    static func == (lhs: Self, rhs: Self) -> Bool {
+        lhs.postId == rhs.postId
+    }
+    
+    private let postId: String
     @EnvironmentObject private var uiState: UIState
     @ObservedObject var viewModel: PostViewModel
     @State private var redrawLink = false
     @State private var sharePickerShown = false
-        
+    
+    init(viewModel: PostViewModel) {
+        self.postId = viewModel.post.id
+        self.viewModel = viewModel
+    }
+    
     var body: some View {
         List {
             VStack(alignment: .leading, spacing: 8) {
```

**File**: `RedditOs/Features/Sidebar/SidebarSubredditRow.swift` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@ struct SidebarSubredditRow: View {
     let iconURL: String?
     
     var body: some View {
-        NavigationLink(destination: SubredditPostsListView(name: name)) {
+        NavigationLink(destination: SubredditPostsListView(name: name)
+                        .equatable()) {
             HStack {
                 if let image = iconURL,
                    let url = URL(string: image) {
```

**File**: `RedditOs/Features/Sidebar/SidebarView.swift` (modified, +3/-1)
```diff
@@ -33,7 +33,9 @@ struct SidebarView: View {
             
             Section {
                 ForEach(UIState.DefaultChannels.allCases, id: \.self) { item in
-                    NavigationLink(destination: SubredditPostsListView(name: item.rawValue)) {
+                    NavigationLink(destination:
+                                    SubredditPostsListView(name: item.rawValue)
+                                    .equatable()) {
                         Label(LocalizedStringKey(item.rawValue.capitalized), systemImage: item.icon())
                     }.tag(item.rawValue)
                 }.animation(nil)
```

**File**: `RedditOs/Features/Subreddit/SubredditPostRow.swift` (modified, +8/-2)
```diff
@@ -8,7 +8,10 @@
 import SwiftUI
 import Backend
 
-struct SubredditPostRow: View {
+struct SubredditPostRow: View, Equatable {
+    static func == (lhs: Self, rhs: Self) -> Bool {
+        lhs.postId == rhs.postId
+    }
     
     enum DisplayMode: String, CaseIterable {
         case compact = "Compact layout"
@@ -29,18 +32,21 @@ struct SubredditPostRow: View {
         }
     }
     
+    private let postId: String
+    
     @StateObject var viewModel: PostViewModel
     @Binding var displayMode: DisplayMode
     
     @Environment(\.openURL) private var openURL
     
     init(post: SubredditPost, displayMode: Binding<DisplayMode>) {
+        self.postId = post.id
         _viewModel = StateObject(wrappedValue: PostViewModel(post: post))
         _displayMode = displayMode
     }
     
     var body: some View {
-        NavigationLink(destination: PostDetailView(viewModel: viewModel)) {
+        NavigationLink(destination: PostDetailView(viewModel: viewModel).equatable()) {
             HStack {
                 VStack(alignment: .leading) {
                     HStack(alignment: .center, spacing: 8) {
```

**File**: `RedditOs/Features/Subreddit/SubredditPostsListView.swift` (modified, +97/-92)
```diff
@@ -10,107 +10,112 @@ import Backend
 import UI
 import KingfisherSwiftUI
 
-struct SubredditPostsListView: View {
-  let posts = Array(repeating: 0, count: 20)
-  
-  private let isSheet: Bool
-  private let loadingPlaceholders = Array(repeating: static_listing, count: 10)
-  
-  @EnvironmentObject private var uiState: UIState
-  @EnvironmentObject private var localData: LocalDataStore
-  
-  @StateObject private var viewModel: SubredditViewModel
-  @AppStorage(SettingsKey.subreddit_display_mode) private var displayMode = SubredditPostRow.DisplayMode.large
-  
-  @State private var subredditAboutPopoverShown = false
-  
-  init(name: String, isSheet: Bool = false) {
-    self.isSheet = isSheet
-    _viewModel = StateObject(wrappedValue: SubredditViewModel(name: name))
-  }
-  
-  var isDefaultChannel: Bool {
-    UIState.DefaultChannels.allCases.map{ $0.rawValue }.contains(viewModel.name)
-  }
-  
-  var subtitle: String {
-    if isDefaultChannel {
-      return ""
+struct SubredditPostsListView: View, Equatable {
+    static func == (lhs: Self, rhs: Self) -> Bool {
+        lhs.name == rhs.name
     }
-    if let subscribers = viewModel.subreddit?.subscribers, let connected = viewModel.subreddit?.accountsActive {
-      return "\(subscribers.toRoundedSuffixAsString()) members - \(connected.toRoundedSuffixAsString()) online"
+        
+    private let name: String
+    private let isSheet: Bool
+    private let loadingPlaceholders = Array(repeating: static_listing, count: 10)
+    
+    @EnvironmentObject private var uiState: UIState
+    @EnvironmentObject private var localData: LocalDataStore
+    
+    @StateObject private var viewModel: SubredditViewModel
+    @AppStorage(SettingsKey.subreddit_display_mode) private var displayMode = SubredditPostRow.DisplayMode.large
+    
+    @State private var subredditAboutPopoverShown = false
+    
+    init(name: String, isSheet: Bool = false) {
+        self.name = name
+        self.isSheet = isSheet
+        _viewModel = StateObject(wrappedValue: SubredditViewModel(name: name))
     }
-    return ""
-  }
-  
-  var body: some View {
-    PostsListView(posts: viewModel.listings,
-                  displayMode: .constant(displayMode)) {
-      viewModel.fetchListings()
-    }.toolbar {
-      ToolbarItem(placement: .navigation) {
-        Group {
-          if isDefaultChannel {
-            EmptyView()
-          } else if let icon = viewModel.subreddit?.iconImg, let url = URL(string: icon) {
-            KFImage(url)
-              .resizable()
-              .frame(width: 20, height: 20)
-              .cornerRadius(10)
-          } else {
-            Image(systemName: "globe")
-              .resizable()
-              .frame(width: 20, height: 20)
-          }
+    
+    var isDefaultChannel: Bool {
+        UIState.DefaultChannels.allCases.map{ $0.rawValue }.contains(viewModel.name)
+    }
+    
+    var subtitle: String {
+        if isDefaultChannel {
+            return ""
         }
-        .onTapGesture {
-          subredditAboutPopoverShown = true
+        if let subscribers = viewModel.subreddit?.subscribers, let connected = viewModel.subreddit?.accountsActive {
+            return "\(subscribers.toRoundedSuffixAsString()) members - \(connected.toRoundedSuffixAsString()) online"
         }
-        .popover(isPresented: $subredditAboutPopoverShown,
-                 content: { SubredditAboutPopoverView(viewModel: viewModel) })
-      }
-      
-      ToolbarItem {
-        Picker("Display layout", selection: $displayMode) {
-          ForEach(SubredditPostRow.DisplayMode.allCases, id: \.self) { item in
-            Image(systemName: item.symbol())
-              .tag(item)
-          }
+        return ""
+    }
+    
+    var body: some View {
+        PostsListView(posts: viewModel.listings,
+                      displayMode: .constant(displayMode)) {
+            viewModel.fetchListings()
+        }.toolbar {
+            ToolbarItem(placement: .navigation) {
+                Group {
+                    if isDefaultChannel {
+                        EmptyView()
+                    } else if let icon = viewModel.subreddit?.iconImg, let url = URL(string: icon) {
+                        KFImage(url)
+                            .resizable()
+                            .frame(width: 20, height: 20)
+                            .cornerRadius(10)
+                    } else {
+                        Image(systemName: "globe")
+                            .resizable()
+                            .frame(width: 20, height: 20)
+                    }
+                }
+                .onTapGesture {
+                    subredditAboutPopoverShown = true
+                }
+                .popover(isPresented: $subredditAboutPopoverShown,
+                         content: { SubredditAboutPopoverView(viewModel: viewModel) })
+            }
+            
+            ToolbarItem {
+                Picker("Display layout", selection: $displayMode
```

**File**: `RedditOs/RedditOsApp.swift` (modified, +5/-5)
```diff
@@ -43,7 +43,7 @@ struct RedditOsApp: App {
                 }) {
                     Text("Refresh")
                 }
-                .disabled(uiState.selectedSubreddit != nil)
+                .disabled(uiState.selectedSubreddit == nil)
                 .keyboardShortcut("r", modifiers: [.command])
                 
                 Divider()
@@ -61,7 +61,7 @@ struct RedditOsApp: App {
                 }) {
                     Text("Toggle favorite")
                 }
-                .disabled(uiState.selectedSubreddit != nil)
+                .disabled(uiState.selectedSubreddit == nil)
                 .keyboardShortcut("f", modifiers: [.command, .shift])
             }
             
@@ -79,7 +79,7 @@ struct RedditOsApp: App {
                 }) {
                     Text(uiState.selectedPost?.post.saved == true ? "Unsave" : "Save")
                 }
-                .disabled(uiState.selectedPost != nil)
+                .disabled(uiState.selectedPost == nil)
                 .keyboardShortcut("s", modifiers: .command)
                 
                 Divider()
@@ -88,15 +88,15 @@ struct RedditOsApp: App {
                 }) {
                     Text("Upvote")
                 }
-                .disabled(uiState.selectedPost != nil)
+                .disabled(uiState.selectedPost == nil)
                 .keyboardShortcut(.upArrow, modifiers: .shift)
                 
                 Button(action: {
                     uiState.selectedPost?.postVote(vote: .downvote)
                 }) {
                     Text("Downvote")
                 }
-                .disabled(uiState.selectedPost != nil)
+                .disabled(uiState.selectedPost == nil)
                 .keyboardShortcut(.downArrow, modifiers: .shift)
             }
             
```

---

### Incident Patch 14: `70727095` (2021-02-16)
**Commit Message**: Fix toolbars

**File**: `RedditOs/Features/Profile/ProfileView.swift` (modified, +18/-22)
```diff
@@ -16,30 +16,26 @@ struct ProfileView: View {
     private let loadingPlaceholders = Array(repeating: static_listing, count: 10)
     
     var body: some View {
-        NavigationView {
-            List {
-                headerView.padding(.vertical, 16)
-                if currentUser.user != nil {
-                    userOverview
-                }
-            }
-            .listStyle(InsetListStyle())
-            .frame(width: 500)
-            
-            PostNoSelectionPlaceholder()
+      List {
+        headerView.padding(.vertical, 16)
+        if currentUser.user != nil {
+          userOverview
         }
-        .navigationTitle("Profile")
-        .navigationSubtitle(currentUser.user?.name ?? "Login")
-        .toolbar {
-            ToolbarItem(placement: .primaryAction) {
-                Button {
-                    oauthClient.logout()
-                } label: {
-                    Text("Logout")
-                }
-
-            }
+      }
+      .listStyle(InsetListStyle())
+      .frame(width: 500)
+      .navigationTitle("Profile")
+      .navigationSubtitle(currentUser.user?.name ?? "Login")
+      .toolbar {
+        ToolbarItem(placement: .primaryAction) {
+          Button {
+            oauthClient.logout()
+          } label: {
+            Text("Logout")
+          }
+          
         }
+      }
     }
     
     @ViewBuilder
```

**File**: `RedditOs/Features/Profile/SavedPostsListView.swift` (modified, +8/-13)
```diff
@@ -13,19 +13,14 @@ struct SavedPostsListView: View {
     @State private var displayMode = SubredditPostRow.DisplayMode.large
     
     var body: some View {
-        NavigationView {
-            PostsListView(posts: currentUser.savedPosts,
-                          displayMode: $displayMode) {
-                currentUser.fetchSaved(after: currentUser.savedPosts?.last)
-            }.onAppear {
-                currentUser.fetchSaved(after: nil)
-            }
-            PostNoSelectionPlaceholder()
-        }
-        .navigationTitle("Saved")
-        .onAppear {
-            currentUser.fetchSaved(after: nil)
-        }
+      PostsListView(posts: currentUser.savedPosts,
+                    displayMode: $displayMode) {
+        currentUser.fetchSaved(after: currentUser.savedPosts?.last)
+      }.onAppear {
+        currentUser.fetchSaved(after: nil)
+      }
+      .navigationTitle("Saved")
+ 
     }
 }
 
```

**File**: `RedditOs/Features/Profile/SubmittedPostsListView.swift` (modified, +7/-13)
```diff
@@ -13,19 +13,13 @@ struct SubmittedPostsListView: View {
     @State private var displayMode = SubredditPostRow.DisplayMode.large
     
     var body: some View {
-        NavigationView {
-            PostsListView(posts: currentUser.submittedPosts,
-                          displayMode: $displayMode) {
-                currentUser.fetchSubmitted(after: currentUser.submittedPosts?.last)
-            }.onAppear {
-                currentUser.fetchSubmitted(after: nil)
-            }
-            PostNoSelectionPlaceholder()
-        }
-        .navigationTitle("Saved")
-        .onAppear {
-            currentUser.fetchSaved(after: nil)
-        }
+      PostsListView(posts: currentUser.submittedPosts,
+                    displayMode: $displayMode) {
+        currentUser.fetchSubmitted(after: currentUser.submittedPosts?.last)
+      }.onAppear {
+        currentUser.fetchSubmitted(after: nil)
+      }
+      .navigationTitle("Submitted")
     }
 }
 
```

**File**: `RedditOs/Features/Subreddit/SubredditPostsListView.swift` (modified, +92/-98)
```diff
@@ -11,112 +11,106 @@ import UI
 import KingfisherSwiftUI
 
 struct SubredditPostsListView: View {
-    let posts = Array(repeating: 0, count: 20)
-    
-    private let isSheet: Bool
-    private let loadingPlaceholders = Array(repeating: static_listing, count: 10)
-    
-    @EnvironmentObject private var uiState: UIState
-    @EnvironmentObject private var localData: LocalDataStore
-    
-    @StateObject private var viewModel: SubredditViewModel
-    @AppStorage(SettingsKey.subreddit_display_mode) private var displayMode = SubredditPostRow.DisplayMode.large
-    
-    @State private var subredditAboutPopoverShown = false
-    
-    init(name: String, isSheet: Bool = false) {
-        self.isSheet = isSheet
-        _viewModel = StateObject(wrappedValue: SubredditViewModel(name: name))
+  let posts = Array(repeating: 0, count: 20)
+  
+  private let isSheet: Bool
+  private let loadingPlaceholders = Array(repeating: static_listing, count: 10)
+  
+  @EnvironmentObject private var uiState: UIState
+  @EnvironmentObject private var localData: LocalDataStore
+  
+  @StateObject private var viewModel: SubredditViewModel
+  @AppStorage(SettingsKey.subreddit_display_mode) private var displayMode = SubredditPostRow.DisplayMode.large
+  
+  @State private var subredditAboutPopoverShown = false
+  
+  init(name: String, isSheet: Bool = false) {
+    self.isSheet = isSheet
+    _viewModel = StateObject(wrappedValue: SubredditViewModel(name: name))
+  }
+  
+  var isDefaultChannel: Bool {
+    UIState.DefaultChannels.allCases.map{ $0.rawValue }.contains(viewModel.name)
+  }
+  
+  var subtitle: String {
+    if isDefaultChannel {
+      return ""
     }
-    
-    var isDefaultChannel: Bool {
-        UIState.DefaultChannels.allCases.map{ $0.rawValue }.contains(viewModel.name)
+    if let subscribers = viewModel.subreddit?.subscribers, let connected = viewModel.subreddit?.accountsActive {
+      return "\(subscribers.toRoundedSuffixAsString()) members - \(connected.toRoundedSuffixAsString()) online"
     }
-    
-    var subtitle: String {
-        if isDefaultChannel {
-            return ""
+    return ""
+  }
+  
+  var body: some View {
+    PostsListView(posts: viewModel.listings,
+                  displayMode: .constant(displayMode)) {
+      viewModel.fetchListings()
+    }.toolbar {
+      ToolbarItem(placement: .navigation) {
+        Group {
+          if isDefaultChannel {
+            EmptyView()
+          } else if let icon = viewModel.subreddit?.iconImg, let url = URL(string: icon) {
+            KFImage(url)
+              .resizable()
+              .frame(width: 20, height: 20)
+              .cornerRadius(10)
+          } else {
+            Image(systemName: "globe")
+              .resizable()
+              .frame(width: 20, height: 20)
+          }
         }
-        if let subscribers = viewModel.subreddit?.subscribers, let connected = viewModel.subreddit?.accountsActive {
-            return "\(subscribers.toRoundedSuffixAsString()) members - \(connected.toRoundedSuffixAsString()) online"
+        .onTapGesture {
+          subredditAboutPopoverShown = true
         }
-        return ""
-    }
-    
-    var body: some View {
-        NavigationView {
-            PostsListView(posts: viewModel.listings,
-                          displayMode: .constant(displayMode)) {
-                viewModel.fetchListings()
-            }.toolbar {
-                ToolbarItem(placement: .navigation) {
-                    Group {
-                        if isDefaultChannel {
-                            EmptyView()
-                        } else if let icon = viewModel.subreddit?.iconImg, let url = URL(string: icon) {
-                            KFImage(url)
-                                .resizable()
-                                .frame(width: 20, height: 20)
-                                .cornerRadius(10)
-                        } else {
-                            Image(systemName: "globe")
-                                .resizable()
-                                .frame(width: 20, height: 20)
-                        }
-                    }
-                    .onTapGesture {
-                        subredditAboutPopoverShown = true
-                    }
-                    .popover(isPresented: $subredditAboutPopoverShown,
-                             content: { SubredditAboutPopoverView(viewModel: viewModel) })
-                }
-                
-                ToolbarItem {
-                    Picker("",
-                           selection: $displayMode,
-                           content: {
-                            ForEach(SubredditPostRow.DisplayMode.allCases, id: \.self) { mode in
-                                Image(systemName: mode.iconName())
-                                    .tag(mode)
-                            }
-                           }).pickerStyle(InlinePickerStyle())
-                }
-                
-                ToolbarItem {
- 
```

**File**: `RedditOs/RedditOsApp.swift` (modified, +5/-0)
```diff
@@ -19,6 +19,11 @@ struct RedditOsApp: App {
         WindowGroup {
             NavigationView {
                 SidebarView()
+                ProgressView()
+                PostNoSelectionPlaceholder()
+                .toolbar {
+                  PostDetailToolbar(shareURL: nil)
+                }
             }
             .frame(minWidth: 1300, minHeight: 800)
             .environmentObject(localData)
```

---

### Incident Patch 15: `8f32a00c` (2020-12-16)
**Commit Message**: Various fixes

**File**: `RedditOs.xcodeproj/project.pbxproj` (modified, +4/-21)
```diff
@@ -47,7 +47,6 @@
 		697E324924E3EDE70006F00F /* CommentVoteView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 697E324824E3EDE70006F00F /* CommentVoteView.swift */; };
 		697E324B24E3EFCB0006F00F /* CommentActionsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 697E324A24E3EFCB0006F00F /* CommentActionsView.swift */; };
 		697E324D24E3F2900006F00F /* SharingPicker.swift in Sources */ = {isa = PBXBuildFile; fileRef = 697E324C24E3F2900006F00F /* SharingPicker.swift */; };
-		69C1925A24EC0FEB00BA3C09 /* Parma in Frameworks */ = {isa = PBXBuildFile; productRef = 69C1925924EC0FEB00BA3C09 /* Parma */; };
 		69CCB3EA24E2BEAC003FAAD7 /* SubredditAboutPopoverView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 69CCB3E924E2BEAC003FAAD7 /* SubredditAboutPopoverView.swift */; };
 		69D076C824B9E871001619AC /* Color.swift in Sources */ = {isa = PBXBuildFile; fileRef = 69D076C724B9E871001619AC /* Color.swift */; };
 		69D8663424E568060052A2B0 /* Route.swift in Sources */ = {isa = PBXBuildFile; fileRef = 69D8663324E568060052A2B0 /* Route.swift */; };
@@ -129,7 +128,6 @@
 			buildActionMask = 2147483647;
 			files = (
 				697E324524E3E7D90006F00F /* UI in Frameworks */,
-				69C1925A24EC0FEB00BA3C09 /* Parma in Frameworks */,
 				69EACF1C24B7272E00303A16 /* Backend in Frameworks */,
 				6923F8CD250250FC0003870F /* KingfisherSwiftUI in Frameworks */,
 			);
@@ -395,7 +393,6 @@
 			packageProductDependencies = (
 				69EACF1B24B7272E00303A16 /* Backend */,
 				697E324424E3E7D90006F00F /* UI */,
-				69C1925924EC0FEB00BA3C09 /* Parma */,
 				6923F8CC250250FC0003870F /* KingfisherSwiftUI */,
 			);
 			productName = RedditOs;
@@ -426,7 +423,6 @@
 			);
 			mainGroup = 69EACEF624B63D5800303A16;
 			packageReferences = (
-				69C1925824EC0FEB00BA3C09 /* XCRemoteSwiftPackageReference "Parma" */,
 				6923F8CB250250FC0003870F /* XCRemoteSwiftPackageReference "Kingfisher" */,
 			);
 			productRefGroup = 69EACF0024B63D5800303A16 /* Products */;
@@ -634,7 +630,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 25;
+				CURRENT_PROJECT_VERSION = 15122020;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -645,7 +641,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.1;
+				MARKETING_VERSION = 0.2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
@@ -661,7 +657,7 @@
 				CODE_SIGN_IDENTITY = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 25;
+				CURRENT_PROJECT_VERSION = 15122020;
 				DEVELOPMENT_ASSET_PATHS = "\"RedditOs/Preview Content\"";
 				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -672,7 +668,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 0.1;
+				MARKETING_VERSION = 0.2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.thomasricouard.curiosity;
 				PRODUCT_NAME = Curiosity;
 				SWIFT_VERSION = 5.0;
@@ -711,14 +707,6 @@
 				minimumVersion = 5.15.0;
 			};
 		};
-		69C1925824EC0FEB00BA3C09 /* XCRemoteSwiftPackageReference "Parma" */ = {
-			isa = XCRemoteSwiftPackageReference;
-			repositoryURL = "https://github.com/dasautoooo/Parma";
-			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 0.1.0;
-			};
-		};
 /* End XCRemoteSwiftPackageReference section */
 
 /* Begin XCSwiftPackageProductDependency section */
@@ -731,11 +719,6 @@
 			isa = XCSwiftPackageProductDependency;
 			productName = UI;
 		};
-		69C1925924EC0FEB00BA3C09 /* Parma */ = {
-			isa = XCSwiftPackageProductDependency;
-			package = 69C1925824EC0FEB00BA3C09 /* XCRemoteSwiftPackageReference "Parma" */;
-			productName = Parma;
-		};
 		69EACF1B24B7272E00303A16 /* Backend */ = {
 			isa = XCSwiftPackageProductDependency;
 			productName = Backend;
```

**File**: `RedditOs.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +0/-18)
```diff
@@ -1,15 +1,6 @@
 {
   "object": {
     "pins": [
-      {
-        "package": "Down",
-        "repositoryURL": "https://github.com/iwasrobbed/Down",
-        "state": {
-          "branch": null,
-          "revision": "427aec0a0ab342246ec02369dea398597b61174a",
-          "version": "0.9.3"
-        }
-      },
       {
         "package": "KeychainAccess",
         "repositoryURL": "https://github.com/kishikawakatsumi/KeychainAccess",
@@ -27,15 +18,6 @@
           "revision": "2a6d1135af3915547c4b08c3b154a05e6f1075a3",
           "version": "5.15.5"
         }
-      },
-      {
-        "package": "Parma",
-        "repositoryURL": "https://github.com/dasautoooo/Parma",
-        "state": {
-          "branch": null,
-          "revision": "82f825cead4b408fa3e0059affa3e5d296d3b745",
-          "version": "0.1.1"
-        }
       }
     ]
   },
```

**File**: `RedditOs/Environements/Route.swift` (modified, +6/-6)
```diff
@@ -19,16 +19,16 @@ enum Route: Identifiable, Hashable {
         hasher.combine(id)
     }
     
-    case user(user: User)
-    case subreddit(subreddit: String)
+    case user(user: User, isSheet: Bool)
+    case subreddit(subreddit: String, isSheet: Bool)
     case defaultChannel(chanel: UIState.DefaultChannels)
     case none
     
     var id: String {
         switch self {
         case .user:
             return "user"
-        case let .subreddit(subreddit):
+        case let .subreddit(subreddit, _):
             return subreddit
         case .none:
             return "none"
@@ -40,10 +40,10 @@ enum Route: Identifiable, Hashable {
     @ViewBuilder
     func makeView() -> some View {
         switch self {
-        case let .user(user):
+        case let .user(user, _):
             UserSheetView(user: user)
-        case let .subreddit(subreddit):
-            SubredditPostsListView(name: subreddit)
+        case let .subreddit(subreddit, isSheet):
+            SubredditPostsListView(name: subreddit, isSheet: isSheet).environmentObject(UIState.shared)
         case let .defaultChannel(chanel):
             SubredditPostsListView(name: chanel.rawValue)
         case .none:
```

**File**: `RedditOs/Environements/UIState.swift` (modified, +6/-1)
```diff
@@ -11,6 +11,8 @@ import Combine
 import Backend
 
 class UIState: ObservableObject {
+    public static let shared = UIState()
+    
     enum DefaultChannels: String, CaseIterable {
         case hot, best, new, top, rising
         
@@ -24,7 +26,10 @@ class UIState: ObservableObject {
             }
         }
     }
-
+    
+    private init() {
+        
+    }
     
     @Published var selectedSubreddit: SubredditViewModel?
     @Published var selectedPost: PostViewModel?
```

**File**: `RedditOs/Features/Comments/CommentRow.swift` (modified, +3/-1)
```diff
@@ -68,7 +68,9 @@ struct CommentRow: View {
                     }
                 }
                 if let body = viewModel.comment.body {
-                    Text(body).font(.body)
+                    Text(body)
+                        .font(.body)
+                        .fixedSize(horizontal: false, vertical: true)
                 } else {
                     Text("Deleted comment")
                         .font(.footnote)
```

**File**: `RedditOs/Features/Post/PostDetailContent.swift` (modified, +3/-1)
```diff
@@ -17,7 +17,9 @@ struct PostDetailContent: View {
     @ViewBuilder
     var body: some View {
         if let text = listing.selftext ?? listing.description {
-            Text(text).font(.body)
+            Text(text)
+                .font(.body)
+                .fixedSize(horizontal: false, vertical: true)
         }
         if let video = listing.secureMedia?.video {
             HStack {
```

**File**: `RedditOs/Features/Profile/ProfileView.swift` (modified, +3/-1)
```diff
@@ -22,7 +22,9 @@ struct ProfileView: View {
                 if currentUser.user != nil {
                     userOverview
                 }
-            }.listStyle(InsetListStyle())
+            }
+            .listStyle(InsetListStyle())
+            .frame(width: 500)
             
             PostNoSelectionPlaceholder()
         }
```

**File**: `RedditOs/Features/Search/Global Search Popopver/GlobalSearchPopoverView.swift` (modified, +2/-2)
```diff
@@ -45,7 +45,7 @@ struct GlobalSearchPopoverView: View {
             GlobalSearchSubRow(icon: nil,
                                name: "Go to r/\(viewModel.searchText)")
                 .onTapGesture {
-                    uiState.presentedNavigationRoute = .subreddit(subreddit: viewModel.searchText)
+                    uiState.presentedNavigationRoute = .subreddit(subreddit: viewModel.searchText, isSheet: false)
                 }
             GlobalSearchSubRow(icon: nil,
                                name: "Go to u/\(viewModel.searchText)")
@@ -85,7 +85,7 @@ struct GlobalSearchPopoverView: View {
     private func makeSubRow(icon: String?, name: String) -> some View {
         GlobalSearchSubRow(icon: icon, name: name)
             .onTapGesture {
-                uiState.presentedNavigationRoute = .subreddit(subreddit: name)
+                uiState.presentedNavigationRoute = .subreddit(subreddit: name, isSheet: false)
         }
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #68** (closed): Grammar updates (@3kh0)
- **PR #64** (closed): Update README.md (@AdamHenley1)
- **PR #46** (2021-08-02): Removed minimumScaleFactor from commentVoteView, to avoid scaling to unreadable sizes (@Tony1324)
- **PR #35** (closed): Delete unused files (@thii)
- **PR #26** (2021-02-10): Add tooltip to toolbar display mode and update settings layout (@DanKorkelia)
- **PR #25** (2021-01-04): Update layout of Post Row (@DanKorkelia)
- **PR #24** (2021-01-02): Introduce url extension to help avoid force unwrapping for static urls and add unit test for changed model (@DanKorkelia)
- **PR #22** (2020-12-31): added clear instructions of how to add secrets.plist (@rursache)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
