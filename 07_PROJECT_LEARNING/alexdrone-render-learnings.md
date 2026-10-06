# Forensic Learning Record (Deep Inspection): alexdrone/Render

> **Canonical Artifact**: `07_PROJECT_LEARNING/alexdrone-render-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alexdrone/Render](https://github.com/alexdrone/Render))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:29:49.411Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alexdrone/Render`
- **Description**: UIKit a-là SwiftUI.framework [min deployment target iOS10]
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2148 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Demo/CoreRenderDemo/AppDelegate.swift`
```
import UIKit
import SwiftUI

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    // Called when a new scene session is being created.
    // Use this method to select a configuration to create the new scene with.
    return UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role)
  }

  func application(
    _ application: UIApplication,
    didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    // Called when the user discards a scene session.
    // If any sessions were discarded while the application was not running, this will be called
    // shortly after application:didFinishLaunchingWithOptions.
    // Use this method to release any resources that were specific to the discarded scenes,
    //as they will not return.
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

  var useSwiftUI = false
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions) {
    
    if (useSwiftUI) {
      let contentView = SwiftUIView()
      // Use a UIHostingCoordinator as window root view coordinator.
      if let windowScene = scene as? UIWindowScene {
          let window = UIWindow(windowScene: windowScene)
          window.rootViewController = UIHostingController(rootView: contentView)
          self.window = window
          window.makeKeyAndVisible()
      }
    } else {
      // Use a normal ViewCoordinator as window root view coordinator.
      if let windowScene = scene as? UIWindowScene {
          let window = UIWindow(windowScene: windowScene)
          window.rootViewController = ViewCoordinator()
          self.window = window
          window.makeKeyAndVisible()
      }
    }
  }

  func sceneDidDisconnect(_ scene: UIScene) {
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
  }

  func sceneWillResignActive(_ scene: UIScene) {
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
  }
}




```

### Core Architecture Module: `Demo/CoreRenderDemo/DemoWidget.swift`
```
import Foundation
import CoreRender
import Render

// MARK: - Coordinator

class DemoWidgetCoordinator: Coordinator {
  // Props.
  var propCountStartValue: UInt = 0
  // State.
  private(set) var count: UInt = 0
  private(set) var isRotated: Bool = false
  // Synthesized.
  var totalCount: UInt { propCountStartValue + count }

  func increase() {
    count += 1
    setNeedsReconcile()
  }

  override func onLayout() {
    // Override this to manually override the layout of some of the views in the view hierarchy.
    // e.g.
    // view(withKey: Const.increaseButtonKey)?.frame = ...
  }

  override func onTouchUp(inside sender: UIView) {
    self.increase()
  }
}

// MARK: - Body

func makeDemoWidget(context: Context, coordinator: DemoWidgetCoordinator) -> OpaqueNodeBuilder {
  VStackNode {
    LabelNode(text: "\(coordinator.totalCount)")
      .font(UIFont.systemFont(ofSize: 24, weight: .black))
      .textAlignment(.center)
      .textColor(.darkText)
      .background(.secondarySystemBackground)
      .width(Const.size + 8 * CGFloat(coordinator.totalCount))
      .height(Const.size)
      .margin(Const.margin)
      .cornerRadius(Const.cornerRadius)
    LabelNode(text: ">> TAP HERE TO SPIN THE BUTTON >>")
      .font(UIFont.systemFont(ofSize: 12, weight: .bold))
      .textAlignment(.center)
      .textColor(.systemRed)
      .height(Const.size)
      .margin(Const.margin)
    HStackNode {
      ButtonNode(reuseIdentifier: Const.increaseButtonKey, target: coordinator)
        .text("TAP HERE TO INCREASE THE COUNTER")
        .font(UIFont.systemFont(ofSize: 12, weight: .bold))
        .background(.systemIndigo)
        .padding(Const.margin * 2)
        .cornerRadius(Const.cornerRadius)
      EmptyNode()
    }
  }
  .alignItems(.center)
  .matchHostingViewWidth(withMargin: 0)
}

// MARK: - Constants

private struct Const {
  static let increaseButtonKey = "button_increase"
  static let size: CGFloat = 48.0
  static let cornerRadius: CGFloat = 8.0
  static let margin: CGFloat = 4.0
}

```

### Core Architecture Module: `Demo/CoreRenderDemo/SwiftUIView.swift`
```
import SwiftUI
import CoreRender
import Render

struct SwiftUIView: View {
  var body: some View {
    VStack {
      CoreRenderBridgeView { _ in
        LabelNode(text: "Hi from Render")
          .font(UIFont.systemFont(ofSize: 12))
          .padding(12)
      }
    }
  }
}

struct SwiftUIView_Previews: PreviewProvider {
  static var previews: some View {
    SwiftUIView()
  }
}

```

### Core Architecture Module: `Demo/CoreRenderDemo/ViewController.swift`
```
import UIKit
import CoreRender
import Render

class ViewCoordinator: UIViewController {
  var hostingView: HostingView!
  let context = Context()

  override func loadView() {
    hostingView = HostingView(context: context, with: [.useSafeAreaInsets]) { context in
      Component<DemoWidgetCoordinator>(context: context) { context, coordinator in
        makeDemoWidget(context: context, coordinator: coordinator)
      }.builder()
    }
    self.view = hostingView
  }
  
  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    hostingView.setNeedsLayout()
  }
}

```

### Core Architecture Module: `Sources/CoreRender/CRContext.h`
```
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@class CRCoordinator;
@class CRNode;
@class CRContext;
;
@class CRContextReconciliationInfo;

NS_SWIFT_NAME(CoordinatorDescriptor)
@interface CRCoordinatorDescriptor : NSObject
/// The coordinator type.
@property(nonatomic, readonly) Class type;
/// The coordinator unique key.
@property(nonatomic, readonly) NSString *key;

- (instancetype)init NS_UNAVAILABLE;
/// Constructs a new coordinator descriptor.
- (instancetype)initWithType:(Class)type key:(NSString *)key;
@end

NS_SWIFT_NAME(ContextDelegate)
@protocol CRContextDelegate <NSObject>
/// One of the coordinator is about to invoke @c setNeedReconciliate on the root node.
- (void)context:(CRContext *)context willReconciliateHieararchy:(CRContextReconciliationInfo *)info;
/// Node/View hierarchy reconciliation has just occurred.
- (void)context:(CRContext *)context didReconciliateHieararchy:(CRContextReconciliationInfo *)info;
@end

NS_SWIFT_NAME(Context)
@interface CRContext : NSObject
/// Layout animator for the nodes registered to this context.
@property(nonatomic, nullable) UIViewPropertyAnimator *layoutAnimator;

/// Returns the coordinator (or instantiate a new one) of type @c type for the unique identifier
/// passed as argument.
/// @note: Returns @c nil if @c type is not a subclass of @c CRCoordinator (or if it's a statelss
/// coordinator).
- (__kindof CRCoordinator *)coordinator:(CRCoordinatorDescriptor *)descriptor;

/// Add the object as delegate for this context.
- (void)addDelegate:(id<CRContextDelegate>)delegate;

/// Remove the object as delegate (if necessary).
- (void)removeDelegate:(id<CRContextDelegate>)delegate;
/// Make a new context-aware coordinator key.
- (NSString *)makeCoordinatorKey:(NSString *)key;
/// Tell the context that we're in the scope of the given coordinator.
/// @note: This ensure that two different coordinators with the same key in two diferent
/// locations in the hierarchy could exist.
- (void)pushCoordinatorContext:(NSString *)key;
/// Pop the current coordinato context.
- (void)popCoordinatorContext;

@end

NS_SWIFT_NAME(ContextReconciliationInfo)
@interface CRContextReconciliationInfo : NSObject
/// Explictly inform the delegate that if the nodes are wrapped inside a @c UITableView or
/// a @c UICollectionView, this must be invalidated and its data reloaded.
@property(nonatomic, readonly) BOOL mustInvalidateLayout;
/// The keys of all of the nodes that have had a rect change during the last reconciliation.
@property(nonatomic, readonly) NSArray<NSString *> *keysForNodesWithMutatedSize;
/// Layout animator that is going to be used for the upcoming reconciliation.
@property(nonatomic, readonly, nullable) UIViewPropertyAnimator *layoutAnimator;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Sources/CoreRender/CRCoordinator+Private.h`
```
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "CRCoordinator.h"

NS_ASSUME_NONNULL_BEGIN

@class CRNode;
@class CRContext;

@interface CRCoordinator ()
// Private setter modifiers
@property(nonatomic, readwrite) NSString *key;
@property(nonatomic, readwrite, nullable, weak) CRContext *context;
@property(nonatomic, readwrite, nullable, weak) CRNode *node;

/// @note: Never call the init method manually - coordinators are dynamically constructed,
/// disposed and reused by @c CRContext.
- (instancetype)initWithKey:(NSString *)key;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Sources/CoreRender/CRCoordinator.h`
```
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@class CRContext;
@class CRNode;
@class CRNodeHierarchy;
@class CRCoordinatorDescriptor;
@protocol CRNodeDelegate;

NS_SWIFT_NAME(Coordinator)
@interface CRCoordinator : NSObject
/// The context associated with this coordinator.
@property(nonatomic, readonly, nullable, weak) CRContext *context;
/// The key for this coordinator.
/// If this coordinator is @c transient the value of this property is @c CRCoordinatorStatelessKey.
@property(nonatomic, readonly) NSString *key;
/// The UI node assigned to this coordinator.
@property(nonatomic, readonly, nullable, weak) CRNodeHierarchy *body;
/// The UI node assigned to this coordinator.
@property(nonatomic, readonly, nullable, weak) CRNode *node;
/// Returns the coordinator descriptor.
@property(nonatomic, readonly) CRCoordinatorDescriptor *prototype;

/// Coordinators are instantiated from @c CRContext.
- (instancetype)init;

/// Constructs a new node hierarchy and reconciles it against the currently mounted view hierarchy.
- (void)setNeedsReconcile;

/// Tells the already mounted hierarchy must be re-layout.
/// @note This is preferable to @c setNeedsReconcile whenever there's going to be no changes in
/// the view hierarchy,
- (void)setNeedsLayout;

/// Overrides this method to manually configure the view hierarchy after it has been layed out.
- (void)onLayout;

/// Convenience method used as default target-action for buttons.
- (void)onTouchUpInside:(__kindof UIView *)sender;

/// Returns the view in the subtree of this node with the given @c key.
- (nullable UIView *)viewWithKey:(NSString *)key;

/// Returns all the views that have been registered with the given @c reuseIdentifier.
- (NSArray<UIView *> *)viewsWithReuseIdentifier:(NSString *)reuseIdentifier;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Sources/CoreRender/CRHostingView.h`
```
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "CRNode.h"

NS_ASSUME_NONNULL_BEGIN

@class CRContext;
@class CRNodeHierarchy;
@class CROpaqueNodeBuilder;

NS_SWIFT_NAME(HostingView)
@interface CRHostingView : UIView
/// The exposed node hierarchy.
@property(nonatomic, readonly) CRNodeHierarchy *body;

- (instancetype)init NS_UNAVAILABLE;
- (instancetype)initWithFrame:(CGRect)frame NS_UNAVAILABLE;
- (instancetype)initWithCoder:(NSCoder *)coder NS_UNAVAILABLE;

/// Construct a new hosting view with the given reference context.
- (instancetype)initWithContext:(CRContext *)context
                    withOptions:(CRNodeLayoutOptions)options
                           body:(CROpaqueNodeBuilder * (^)(CRContext *))buildBody
    NS_DESIGNATED_INITIALIZER;

/// Tells the node that the node/view hierarchy must be reconciled.
- (void)setNeedsReconcile;

/// Tells the node that the node/view hierarchy must be re-layout.
/// @note This is preferable to @c setNeedsReconcile whenever there's going to be no changes in
/// the view hierarchy,
- (void)setNeedsLayout;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Sources/CoreRender/CRMacros.h`
```
#ifndef CRInternalMacros_h
#define CRInternalMacros_h

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#pragma mark - Type inference and dynamic casts

// Type inference for local variables.
#if defined(__cplusplus)
#else
#define auto __auto_type
#endif

// Equivalent to swift nil coalescing operator '??'.
#if defined(__cplusplus)
template <typename T>
static inline T *_Nonnull CRNilCoalescing(T *_Nullable value, T *_Nonnull defaultValue) {
  return value != nil ? value : defaultValue;
}
#define CR_NIL_COALESCING(VALUE, DEFAULT) CRNilCoalescing(VALUE, DEFAULT)
#else
#define CR_NIL_COALESCING(VALUE, DEFAULT) (VALUE != nil ? VALUE : DEFAULT)
#endif

/// Mirrors Swift's 'as?' operator.
#if defined(__cplusplus)
template <typename T>
static inline T *_Nullable CRDynamicCast(__unsafe_unretained id _Nullable obj,
                                         bool assert = false) {
  if ([(id)obj isKindOfClass:[T class]]) {
    return obj;
  }
  return nil;
}
template <typename T>
static inline T *_Nonnull CRDynamicCastOrAssert(__unsafe_unretained id _Nullable obj) {
  return (T * _Nonnull) CRDynamicCast<T>(obj, true);
}
#define CR_DYNAMIC_CAST(TYPE, VALUE) CRDynamicCast<TYPE>(VALUE)
#define CR_DYNAMIC_CAST_OR_ASSERT(TYPE, VALUE) CRDynamicCastOrAssert<TYPE>(VALUE)
#else
static inline id CRDynamicCast(__unsafe_unretained id obj, Class type, BOOL assert) {
  if ([(id)obj isKindOfClass:type]) {
    return obj;
  }
  if (assert) {
    NSCAssert(NO, @"failed to cast %@ to %@", obj, type);
  }
  return nil;
}
#define CR_DYNAMIC_CAST(TYPE, VALUE) ((TYPE * _Nullable) CRDynamicCast(VALUE, TYPE.class, NO))
#define CR_DYNAMIC_CAST_OR_ASSERT(TYPE, VALUE) \
  ((TYPE * _Nonnull) CRDynamicCast(VALUE, TYPE.class, true))
#endif

#pragma mark - Weakify

#define CR_WEAKNAME_(VAR) VAR##_weak_

#define CR_WEAKIFY(VAR) __weak __typeof__(VAR) CR_WEAKNAME_(VAR) = (VAR)

#define CR_STRONGIFY(VAR)                                                           \
  _Pragma("clang diagnostic push") _Pragma("clang diagnostic ignored \"-Wshadow\"") \
      __strong __typeof__(VAR) VAR = CR_WEAKNAME_(VAR);                             \
  _Pragma("clang diagnostic pop")

#define CR_STRONGIFY_AND_RETURN_IF_NIL(VAR) \
  CR_STRONGIFY(VAR);                        \
  if (!(VAR)) {                             \
    return;                                 \
  }

// Safe keypath litterals.
#define CR_UNSAFE_KEYPATH(p) @ #p

#if DEBUG
#define CR_KEYPATH(o, p) ((void)(NO && ((void)o.p, NO)), @ #p)
#else
#define CR_KEYPATH(o, p) @ #p
#endif

#pragma mark - Misc

// Equivalent to Swift's @noescape.
#define CR_NOESCAPE __attribute__((noescape))

// Ensure the caller method is being invoked on the main thread.
#define CR_ASSERT_ON_MAIN_THREAD() NSAssert(NSThread.isMainThread, @"called off the main thread.")

#pragma mark - Geometry

#define CR_CLAMP(x, low, high)                           \
  ({                                                     \
    __typeof__(x) __x = (x);                             \
    __typeof__(low) __low = (low);                       \
    __typeof__(high) __high = (high);                    \
    __x > __high ? __high : (__x < __low ? __low : __x); \
  })

#define CR_CGFLOAT_MAX 32768
#define CR_CGFLOAT_UNDEFINED YGUndefined
#define CR_CGFLOAT_FLEXIBLE CR_CGFLOAT_MAX
#define CR_NORMALIZE(value) (value >= 0.0 && value <= CR_CGFLOAT_MAX ? value : 0.0)

#pragma mark - Boxable structs

// Ensure the struct can be boxed in a NSValue by using the @ symbol.
#define CR_OBJC_BOXABLE __attribute__((objc_boxable))

typedef struct CR_OBJC_BOXABLE CGPoint CGPoint;
typedef struct CR_OBJC_BOXABLE CGSize CGSize;
typedef struct CR_OBJC_BOXABLE CGRect CGRect;
typedef struct CR_OBJC_BOXABLE CGVector CGVector;
typedef struct CR_OBJC_BOXABLE UIEdgeInsets UIEdgeInsets;
typedef struct CR_OBJC_BOXABLE _NSRange NSRange;
typedef struct CR_OBJC_BOXABLE CGAffineTransform CGAffineTransform;

#pragma mark - Generics

NS_ASSUME_NONNULL_BEGIN

@protocol CRFastEnumeration <NSFastEnumeration>
- (id)CR_enumeratedType;
@end

// Usage: CR_FOREACH (s, strings) { ... }
// For each loops using type inference.
#define CR_FOREACH(element, collection) \
  for (typeof((collection).CR_enumeratedType) element in (collection))

@interface NSArray <ElementType>(CRFastEnumeration) <CRFastEnumeration>
- (ElementType)CR_enumeratedType;
@end

@interface NSSet <ElementType>(CRFastEnumeration) <CRFastEnumeration>
- (ElementType)CR_enumeratedType;
@end

@interface NSDictionary <KeyType, ValueType>(CRFastEnumeration) <CRFastEnumeration>
- (KeyType)CR_enumeratedType;
@end

/// This overrides the NSObject declaration of copy with specialized ones that retain
// the generic type.
// This is pure compiler sugar and will create additional warnings for type mismatches.
// @note id-casted objects will create a warning when copy is called on them as there are multiple
// declarations available. Either cast to specific type or to NSObject to work around this.
@interface NSArray <ElementType>(CRSafeCopy)
// Same as `copy` but retains the generic type.
- (NSArray<ElementType> *)copy;
// Same as `mutableCopy` but retains the generic type.
- (NSMutableArray<ElementType> *)mutableCopy;
@end

@interface NSSet <ElementType>(CRSafeCopy)
// Same as `copy` but retains the generic type.
- (NSSet<ElementType> *)copy;
// Same as `mutableCopy` but retains the generic type.
- (NSMutableSet<ElementType> *)mutableCopy;
@end

@interface NSDictionary <KeyType, ValueType>(CRSafeCopy)
// Same as `copy` but retains the generic type.
- (NSDictionary<KeyType, ValueType> *)copy;
// Same as `mutableCopy` but retains the generic type.
- (NSMutableDictionary<KeyType, ValueType> *)mutableCopy;
@end

@interface NSOrderedSet <ElementType>(CRSafeCopy)
// Same as `copy` but retains the generic type.
- (NSOrderedSet<ElementType> *)copy;
// Same as `mutableCopy` but retains the generic type.
- (NSMutableOrderedSet<ElementType> *)mutableCopy;
@end

@interface NSHashTable <ElementType>(CRSafeCopy)
// Same as `copy` but retains the generic type.
- (NSHashTable<ElementType> *)copy;
@end

@interface NSMapTable <KeyType, ValueType>(CRSafeCopy)
// Same as `copy` but retains the generic type.
- (NSMapTable<KeyType, ValueType> *)copy;
@end

NS_ASSUME_NONNULL_END

#pragma mark - NSArray to std::vector and viceversa

#if defined(__cplusplus)
#include <vector>

NS_ASSUME_NONNULL_BEGIN

template <typename T>
static inline NSArray *CRArrayWithVector(const std::vector<T> &vector,
                                         id (^block)(const T &value)) {
  NSMutableArray *result = [NSMutableArray arrayWithCapacity:vector.size()];
  for (const T &value : vector) {
    [result addObject:block(value)];
  }

  return result;
}

template <typename T>
static inline std::vector<T> CRVectorWithElements(id<NSFastEnumeration> array,
                                                  T (^_Nullable block)(id value)) {
  std::vector<T> result;
  for (id value in array) {
    result.push_back(block(value));
  }
  return result;
}

NS_ASSUME_NONNULL_END

#endif

#pragma mark - Logging

#define CR_NOT_REACHED() CR_LOG(@"Unexpected exec @ %s:%s ", __FILE__, __LINE__)

#define CR_LOG_ENABLED 1

#ifdef CR_LOG_ENABLED
#define CR_LOG(fmt, ...) NSLog([NSString stringWithFormat:@"(client) %@", fmt], ##__VA_ARGS__)
#else
#define CR_LOG(...)
#endif

#endif /* CRMaCRos_h */

```

### Core Architecture Module: `Sources/CoreRender/CRNode.h`
```
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

NS_SWIFT_NAME(AnyNode)
@interface CRAnyNode : NSObject
@end

NS_SWIFT_NAME(NodeLayoutOptions)
typedef NS_OPTIONS(NSUInteger, CRNodeLayoutOptions) {
  CRNodeLayoutOptionsNone = 1 << 0,
  CRNodeLayoutOptionsSizeContainerViewToFit = 1 << 1,
  CRNodeLayoutOptionsUseSafeAreaInsets = 1 << 2
};

@class CRNode;
@class CRNodeHierarchy;
@class CRContext;
@class CRCoordinator;
@class CRCoordinatorDescriptor;
@class CRNodeLayoutSpec<__covariant V : UIView *>;

NS_SWIFT_NAME(NodeDelegate)
@protocol CRNodeDelegate <NSObject>
@optional
/// The root node for this hierarchy is being configured and layed out.
/// Additional custom manual layout can be defined here.
/// @note: Use @viewWithKey or @viewsWithReuseIdentifier to query the desired views in the
/// installed view hierarchy.
- (void)rootNodeDidLayout:(CRNode *)node;
/// The node @renderedView just got inserted in the view hierarchy.
- (void)rootNodeDidMount:(CRNode *)node;
@end

NS_SWIFT_NAME(ConcreteNode)
@interface CRNode<__covariant V : UIView *> : CRAnyNode
/// The context associated with this node hierarchy.
@property(nonatomic, readonly, nullable, weak) CRContext *context;
/// The node hierarchy this node belongs to (if applicable).
@property(nonatomic, nullable, weak) CRNodeHierarchy *nodeHierarchy;
/// The reuse identifier for this node is its hierarchy.
/// Identifiers help Render understand which items have changed.
/// A custom *reuseIdentifier* is mandatory if the node has a custom creation closure.
@property(nonatomic, readonly) NSString *reuseIdentifier;
/// A unique key for the component/node (necessary if the associated coordinator is stateful).
@property(nonatomic, readonly, nullable) NSString *coordinatorKey;
/// This component is the n-th children.
@property(nonatomic, readonly) NSUInteger index;
/// The subnodes of this node.
@property(nonatomic, readonly) NSArray<CRNode *> *children;
/// The parent node (if this is not the root node in the hierarchy).
@property(nonatomic, readonly, nullable, weak) CRNode *parent;
/// Returns the root node for this node hierarchy.
@property(nonatomic, readonly) CRNode *root;
/// The type of the associated backing view.
@property(nonatomic, readonly) Class viewType;
/// Backing view for this node.
@property(nonatomic, readonly, nullable) V renderedView;
/// The layout delegate for this node.
@property(nonatomic, nullable, weak) id<CRNodeDelegate> delegate;
/// Whether this node is a @c CRNullNode or not.
@property(nonatomic, readonly) BOOL isNullNode;
/// Returns the associated coordinator.
/// @note: @c nil if this node hierarchy is not registered to any @c CRContext, or if
/// @c coordinatorType is @c nil.
@property(nonatomic, nullable, readonly) __kindof CRCoordinator *coordinator;
/// The type of the associated coordinator.
@property(nonatomic, nullable, readonly) CRCoordinatorDescriptor *coordinatorDescriptor;

#pragma mark Constructors

- (instancetype)initWithType:(Class)type
             reuseIdentifier:(nullable NSString *)reuseIdentifier
                         key:(nullable NSString *)key
                    viewInit:(UIView * (^_Nullable)(void))viewInit
                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;

+ (instancetype)nodeWithType:(Class)type
             reuseIdentifier:(nullable NSString *)reuseIdentifier
                         key:(nullable NSString *)key
                    viewInit:(UIView * (^_Nullable)(void))viewInit
                  layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec;

+ (instancetype)nodeWithType:(Class)type layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;

#pragma mark Setup

/// Adds the nodes as children of this node.
- (instancetype)appendChildren:(NSArray<CRNode *> *)children;

/// Bind this node to the @c CRCoordinator class passed as argument.
- (instancetype)bindCoordinator:(CRCoordinatorDescriptor *)descriptor;

/// Register the context for the root node of this node hierarchy.
- (void)registerNodeHierarchyInContext:(CRContext *)context;

#pragma mark Render

/// Reconcile the view hierarchy with the one in the container view passed as argument.
/// @note: This method also performs layout and configuration.
- (void)reconcileInView:(nullable UIView *)view
      constrainedToSize:(CGSize)size
            withOptions:(CRNodeLayoutOptions)options;

/// Layout and configure the views.
- (void)layoutConstrainedToSize:(CGSize)size withOptions:(CRNodeLayoutOptions)options;

/// Re-configure the node's backed view.
/// @note This won't invalidate the layout.
- (void)setNeedsConfigure;

#pragma mark Querying

/// Returns the view in the subtree of this node with the given @c key.
- (nullable UIView *)viewWithKey:(NSString *)key;

/// Returns all the views that have been registered with the given @c reuseIdentifier.
- (NSArray<UIView *> *)viewsWithReuseIdentifier:(NSString *)reuseIdentifier;

@end

NS_SWIFT_NAME(NullNode)
@interface CRNullNode : CRNode

/// The default nil node instance.
@property(class, readonly) CRNullNode *nullNode;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Sources/CoreRender/CRNodeBridge.h`
```
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@class CRNode;
@class CRCoordinatorDescriptor;

NS_SWIFT_NAME(NodeBridge)
@interface CRNodeBridge : NSObject
/// Whether the view has been created at the last render pass.
@property(nonatomic) BOOL isNewlyCreated;
/// The node associated to this view.
@property(nonatomic, nullable) CRNode *node;
/// The bridged view.
@property(nonatomic, nullable, weak) UIView *view;
/// Layout animator for this subtree.
@property(nonatomic, nullable) UIViewPropertyAnimator *layoutAnimator;

- (instancetype)initWithView:(UIView *)view;

/// Stores the current (now considered old in the current run-loop) geometry for the associated
/// view and all of its subviews recursively.
- (void)storeViewSubTreeOldGeometry;

/// Applies the stored old geometry to this view subtree.
- (void)applyViewSubTreeOldGeometry;

/// Stores the geometry for the associated view after the node has rendered at the end of the
/// current run-loop.
- (void)storeViewSubTreeNewGeometry;

/// Applies the stored new geometry to this view subtree.
- (void)applyViewSubTreeNewGeometry;

/// Transition in all of the newly created view in the view hierarchy.
- (void)fadeInNewlyCreatedViewsInViewSubTreeWithDelay:(NSTimeInterval)delay;

/// Set the property at the given keyPath.nil
- (void)setPropertyWithKeyPath:(NSString *)keyPath
                         value:(id)value
                      animator:(nullable UIViewPropertyAnimator *)animator;

/// Restore the view to its initial state.
- (void)restore;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Sources/CoreRender/CRNodeHierarchy.h`
```
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "CRNode.h"
@class CROpaqueNodeBuilder;

NS_ASSUME_NONNULL_BEGIN

@class CRContext;

NS_SWIFT_NAME(NodeHierarchy)
@interface CRNodeHierarchy : NSObject
/// The current root node.
@property(nonatomic, readonly) CRNode *root;

- (instancetype)init NS_UNAVAILABLE;

/// Instantiate a new node hierarchy.
- (instancetype)initWithContext:(CRContext *)context
           nodeHierarchyBuilder:(CROpaqueNodeBuilder * (^)(CRContext *))buildNodeHierarchy;

#pragma mark Render

/// Constructs a new node hierarchy by invoking the @c buildNodeHierarchy block and reconciles it
/// against the view passed as argument.
- (void)buildHierarchyInView:(UIView *)view
           constrainedToSize:(CGSize)size
                 withOptions:(CRNodeLayoutOptions)options;

/// See @c CRNode.reconcileInView:constrainedToSize:withOptions:.
- (void)reconcileInView:(nullable UIView *)view
      constrainedToSize:(CGSize)size
            withOptions:(CRNodeLayoutOptions)options;

/// See @c CRNode.slayoutConstrainedToSize:withOptions:.
- (void)layoutConstrainedToSize:(CGSize)size withOptions:(CRNodeLayoutOptions)options;

/// Constructs a new node hierarchy by invoking the @c buildNodeHierarchy block and reconciles it
/// against the currently mounted view hierarchy.
- (void)setNeedsReconcile;

/// Tells the node that the node/view hierarchy must be re-layout.
/// @note This is preferable to @c setNeedsReconcile whenever there's going to be no changes in
/// the view hierarchy,
- (void)setNeedsLayout;

@end

NS_ASSUME_NONNULL_END

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #115** (2019-11-27): **Typo fix docs: 'sepc' --> 'spec'**
  *Symptoms*: 

- **Issue #114** (2019-11-27): **REQUEST: Simple Example of how to use CollectionViews with Render Neutrino?**
  *Symptoms*: Hello,   Totally enjoying using your new Render Neutrino. Now I'm at a point where I need to build a UICollectionViewController. Any chance we can get a simple example of how to do that using the new Render Neutrino? 

- **Issue #113** (2018-10-24): **Adds hashValue as a keypath stringification fallback**
  *Symptoms*: 

- **Issue #112** (2018-10-29): **Use of _kvcKeyPathString for the identifier in AnyKeyPath extension**
  *Symptoms*: More a question/feedback than a legit bug   The extension for getting the identifier is less than optimal because: - It forces the use of the `@objc` preface for any overrides/subclasses of standard UIView classes which have added properties you'd wish to manipulate via the main `spec.set` pattern. - This may not be possible for some properties, a good example being the `UIEdgeInsets` struct, as Swift structs cannot be `@objc`ified.   The old `hashValue` method seemed to work without (obvious) issues before - would there be a reason to not do the following  ```   public var identifier: String {     guard let path = _kvcKeyPathString else {     // Structs and non objc marked properties end up here      return String(hashValue)     }     return path   } ``` 
  **Post-Mortem & Fix Analysis**:
  > Yes, that would def work. I'm just concerned about hashValue collisions. I reverted that previously because it was broken in iOS 10 beta. Do you wish to make a pull request about it?
  > Pull [here](https://github.com/alexdrone/Render/pull/113)  I wasn't able to get the tests to run on my machine ("The bundle identifier of the application could not be determined.", fiddling with the PList value of the Test target didn't help).   Whats the worst case scenario with a hashValue collision? Would potentially a wrongly typed value be cast badly into a property?   Our prime example for wanting this is the Google Maps lib, which has its own classes we need to wrap for use in Render and makes use of `UIEdgeInsets`. That said if the risk of collisions is significant and the failure when collisions are met is bad then maybe a better solution would be good. 

- **Issue #111** (2018-10-23): **Struct vs Class for UIProps/UIState**
  *Symptoms*: Hey Alex, Is there any science behind the decision of using classes instead of structs for `UIComponent`'s props?  Since props are immutable by design I think `struct` fits better its purpose. 
  **Post-Mortem & Fix Analysis**:
  > For performance reasons (can take some shortcuts by checking obj identity when comparing props), but mostly because the capture semantics in blocks for value types is error prone. 

- **Issue #110** (2018-10-29): **AppKit Support?**
  *Symptoms*: Hey, I was wondering if you have any plans to support AppKit with Render?
  **Post-Mortem & Fix Analysis**:
  > I think we'll just be waiting for marzipan for macOS support!
  > Hi, I really want to use Render in a Mac app. Will AppKit be supported very soon?  > waiting for marzipan  Do you mean this user has a fork to support AppKit? I don't see anything: https://github.com/Marzipan?tab=repositories
  > OK, I see that this is marzipan: https://techbeacon.com/app-dev-testing/ios-apps-macos-what-marzipan-means-dev-teams

- **Issue #109** (2019-11-27): **Carthage support broken since version 5.2**
  *Symptoms*: Render Neutrino can no longer be installed by Carthage since version 5.2 failing with the following error: ``` *** Skipped building Render due to the error: Dependency "Render" has no shared framework schemes for any of the platforms: iOS  If you believe this to be an error, please file an issue with the maintainers at https://github.com/alexdrone/Render/issues/new ```

- **Issue #108** (2019-11-27): **Question: optimisation of the render cycle for stateless components**
  *Symptoms*: BTW - if you would rather questions be asked on StackExchange let me know  Essentially - is there a nice equivalent to the React shouldComponentUpdate function?   We've currently got a pretty solid app running using RenderNeutrino, and are looking at optimising. We deal with observing hardware that continually (several times a second) sends data to our app which define both data and callbacks - meaning equatable and non-equatable data (well, trivially non-equatable).   We aren't using stateful components beyond our root components but we are hitting the issue of how do we update the props, then optimally update the UI. As far as I can see, the setNeedsRender function ties both a props update and a required diff-reconcile-layout cycle together, whereas if we can tell that only a callback has changed we could omit the render cycle (especially as, far as I can see, even a low level component needing to update a trivial change like its colour triggers a change to the entire tree).   What would you recommend? For the approaches I'm looking at now, the best I can see is to go outside the props system, subscribe every component to our stores, and work changes from the leaf->root - not great as we'll have several double renders (but in our case will still optimise a lot of cycles). I've also had a look at UIContext's stores but I get the feeling it will not solve our problem.   If you there's something you'd like to see in there for this situation which you haven't written 
  **Post-Mortem & Fix Analysis**:
  > Hello! Really happy to know that Render works for you guys. I've pushed [799385a](https://github.com/alexdrone/Render/commit/799385a53fca72066b9d910f1b206faf392ef357) today that should mirror React's [shouldUpdateComponent](https://reactjs.org/docs/react-component.html#shouldcomponentupdate).  You should be able to skip the component reconfiguration by simply adding override ` ovveride var shouldUpdate: Bool { return false }` in your `UIComponent` subclass.  **note: The render method is still going to be called per se, but just to keep the vdom in sync, no UIView hierarchy manipulation will take place.** 
  > Just had a read through and a go with the shouldUpdate implementation - the main aspect I can see it lacking against the React equivalent is that it doesn't necessarily catch the props on the way in for a comparison.  What I've done with a couple of components is add a property observer to the props which sets and  stores an Optional of the last props we saw - shouldUpdate then is overridden to return a comparison from the last props vs the current ones. As said - we aren't strictly dealing with equatables in the props so this gives us a chance to do more complex logic to determine whether we should(n't) update.   Given the structure that could be easily added into the Component classes, but I've yet to properly test and see if we are actually saving time and update counts as a result. I'll let you know when I have something.   For consideration too - I've been looking at whether it would be simple to implement a means for a child to update in isolation. I'm thinking of the trivi
  > Just to let you know where we got to with the new shouldUpdate - we were hoping that we'd be able to completely isolate a section of the tree from the _layout_ aspect more than anything - our cycles currently have layout taking ~10x the time of diff/reconcile.   Edited: Urgh no - apologies. My debugger stack pointed me in some odd directions there. I can see a non-root component returning false for shouldUpdate and all the children reporting false, as they should. This should mean that even though _markDirty_ should not be being called for this node and its children, it appears that Yoga still spends time doing the layout on them (as we only see improvements to layout time when the node is completely omitted from the tree).   I might read up on Yoga and how it handles its own updates before asking any more silly questions

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

### Incident Patch 1: `d8c439ba` (2019-12-01)
**Commit Message**: SwiftUI bridge

**File**: `Demo/CoreRenderDemo.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
         "repositoryURL": "https://github.com/alexdrone/Render",
         "state": {
           "branch": "master",
-          "revision": "a610de390578501b5208b06ddef204ece84dd9d2",
+          "revision": "2969d20a67d52efe1a88ff557ca20133383cb301",
           "version": null
         }
       }
```

**File**: `Demo/CoreRenderDemo/AppDelegate.swift` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ class AppDelegate: UIResponder, UIApplicationDelegate {
 
 class SceneDelegate: UIResponder, UIWindowSceneDelegate {
 
-  var useSwiftUI = true
+  var useSwiftUI = false
   var window: UIWindow?
 
   func scene(
```

**File**: `Demo/CoreRenderDemo/ContentView.swift` (modified, +24/-11)
```diff
@@ -3,21 +3,34 @@ import CoreRender
 import Render
 
 struct ContentView: View {
-    var body: some View {
-      VStack {
-        Text("Hello World")
-        CoreRenderBridgeView { context in
-          VStackNode {
-            LabelNode(text: "Hello World")
-            EmptyNode()
-          }
+  var body: some View {
+    VStack {
+      Text("Hello From SwiftUI")
+      CoreRenderBridgeView { context in
+        VStackNode {
+          LabelNode(text: "Hello")
+            .font(UIFont.boldSystemFont(ofSize: 12))
+            .textAlignment(.center)
+            .padding(8)
+          LabelNode(text: "From")
+            .textAlignment(.center)
+            .font(UIFont.boldSystemFont(ofSize: 12))
+            .padding(8)
+          LabelNode(text: "CoreRender")
+            .textAlignment(.center)
+            .font(UIFont.boldSystemFont(ofSize: 14))
+            .padding(8)
         }
+          .alignItems(.center)
+          .background(UIColor.systemGroupedBackground)
+          .matchHostingViewWidth(withMargin: 0)
       }
     }
+  }
 }
 
 struct ContentView_Previews: PreviewProvider {
-    static var previews: some View {
-        ContentView()
-    }
+  static var previews: some View {
+    ContentView()
+  }
 }
```

**File**: `README.md` (modified, +32/-0)
```diff
@@ -116,6 +116,38 @@ func makeFragment(context: Context) {
 
 ```
 
+### Use it with SwiftUI
+
+Render nodes can be nested inside SwiftUI bodies by using `CoreRenderBridgeView`:
+```swift
+
+struct ContentView: View {
+  var body: some View {
+    VStack {
+      Text("Hello From SwiftUI")
+      CoreRenderBridgeView { context in
+        VStackNode {
+          LabelNode(text: "Hello")
+          LabelNode(text: "From")
+          LabelNode(text: "CoreRender")
+        }
+          .alignItems(.center)
+          .background(UIColor.systemGroupedBackground)
+          .matchHostingViewWidth(withMargin: 0)
+      }
+      Text("Back to SwiftUI")
+    }
+  }
+}
+
+struct ContentView_Previews: PreviewProvider {
+  static var previews: some View {
+    ContentView()
+  }
+}
+
+```
+
 # Credits:
 Layout engine:
 
```

---

### Incident Patch 2: `a610de39` (2019-12-01)
**Commit Message**: Merge branch 'master' of github.com:alexdrone/Render

**File**: `README.md` (modified, +5/-0)
```diff
@@ -115,3 +115,8 @@ func makeFragment(context: Context) {
 }
 
 ```
+
+# Credits:
+Layout engine:
+
+* [facebook/yoga](https://github.com/facebook/yoga)
```

---

### Incident Patch 3: `d6712043` (2019-11-30)
**Commit Message**: Merge branch 'master' of github.com:alexdrone/Render

**File**: `.swift-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-4.2
+5.1
```

**File**: `README.md` (modified, +19/-19)
```diff
@@ -19,25 +19,27 @@ The DSL to define the vdom representation is similiar to SwiftUI.
 
 ```swift
 func makeCounterBodyFragment(context: Context, coordinator: CounterCoordinator) -> OpaqueNodeBuilder {
-  VStackNode {
-    LabelNode(text: "\(coordinator.state.count)")
-      .textColor(.darkText)
-      .background(.secondarySystemBackground)
-      .width(Const.size + 8 * CGFloat(coordinator.state.count))
-      .height(Const.size)
-      .margin(Const.margin)
-      .cornerRadius(Const.cornerRadius)
-    HStackNode {
-      ButtonNode()
-        .text("TAP HERE TO INCREASE COUNT")
-        .setTarget(coordinator, action: #selector(CounterCoordinator.increase), for: .touchUpInside)
-        .background(.systemTeal)
-        .padding(Const.margin * 2)
+  Component<CounterCoordinator>(context: context) { context, coordinator in
+    VStackNode {
+      LabelNode(text: "\(coordinator.count)")
+        .textColor(.darkText)
+        .background(.secondarySystemBackground)
+        .width(Const.size + 8 * CGFloat(coordinator.count))
+        .height(Const.size)
+        .margin(Const.margin)
         .cornerRadius(Const.cornerRadius)
+      HStackNode {
+        ButtonNode()
+          .text("TAP HERE TO INCREASE COUNT")
+          .setTarget(coordinator, action: #selector(CounterCoordinator.increase), for: .touchUpInside)
+          .background(.systemTeal)
+          .padding(Const.margin * 2)
+          .cornerRadius(Const.cornerRadius)
+      }
     }
+    .alignItems(.center)
+    .matchHostingViewWidth(withMargin: 0)
   }
-  .alignItems(.center)
-  .matchHostingViewWidth(withMargin: 0)
 }
 ```
 
@@ -83,9 +85,7 @@ class CounterViewCoordinator: UIViewController {
 
   override func loadView() {
     hostingView = HostingView(context: context, with: [.useSafeAreaInsets]) { context in
-      Component<CounterCoordinator>(context: context) { context, coordinator in
-        makeCounterBodyFragment(context: context, coordinator: coordinator)
-      }.builder()
+      makeCounterBodyFragment(context: context, coordinator: coordinator)
     }
     self.view = hostingView
   }
```

---

### Incident Patch 4: `9d81c04e` (2019-11-27)
**Commit Message**: Render is now CoreRender

**File**: `BUCK` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-apple_library(
-  name = 'RenderNeutrino',
-  visibility = ['PUBLIC'],
-  preprocessor_flags = ['-D', 'PRODUCT_NAME=RenderNeutrino'],
-  exported_headers = glob([
-    'render/**/*.h'
-  ]),
-  srcs = glob([
-    'render/**/*',
-  ]),
-)
```

**File**: `DEFS` (removed, +0/-26)
```diff
@@ -1,26 +0,0 @@
-swift_version_from_config = '4'
-
-original_apple_library = apple_library
-def apple_library(
-  name,
-  swift_version = swift_version_from_config,
-  **kwargs
-):
-  original_apple_library(
-    name=name,
-    swift_version=swift_version,
-    **kwargs
-  )
-
-# TODO: Is this really required?
-original_apple_test = apple_test
-def apple_test(
-  name,
-  swift_version = swift_version_from_config,
-  **kwargs
-):
-  original_apple_test(
-    name=name,
-    swift_version=swift_version,
-    **kwargs
-  )
\ No newline at end of file
```

**File**: `Demo/CoreRenderDemo.xcodeproj/project.pbxproj` (added, +386/-0)
```diff
@@ -0,0 +1,386 @@
+// !$*UTF8*$!
+{
+	archiveVersion = 1;
+	classes = {
+	};
+	objectVersion = 52;
+	objects = {
+
+/* Begin PBXBuildFile section */
+		1622F3D223687938007C7E00 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1622F3D123687938007C7E00 /* AppDelegate.swift */; };
+		1622F3D623687938007C7E00 /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1622F3D523687938007C7E00 /* ContentView.swift */; };
+		1622F3D82368793A007C7E00 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 1622F3D72368793A007C7E00 /* Assets.xcassets */; };
+		1622F3DB2368793A007C7E00 /* Preview Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 1622F3DA2368793A007C7E00 /* Preview Assets.xcassets */; };
+		1622F3DE2368793A007C7E00 /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = 1622F3DC2368793A007C7E00 /* LaunchScreen.storyboard */; };
+		1622F3E623687988007C7E00 /* ViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1622F3E523687988007C7E00 /* ViewController.swift */; };
+		16E97B6223687B7E00CEFB67 /* CoreRenderObjC in Frameworks */ = {isa = PBXBuildFile; productRef = 16E97B6123687B7E00CEFB67 /* CoreRenderObjC */; };
+		16E97B6423687B7E00CEFB67 /* CoreRender in Frameworks */ = {isa = PBXBuildFile; productRef = 16E97B6323687B7E00CEFB67 /* CoreRender */; };
+		16E97B6623687C3D00CEFB67 /* DemoWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16E97B6523687C3D00CEFB67 /* DemoWidget.swift */; };
+/* End PBXBuildFile section */
+
+/* Begin PBXFileReference section */
+		1622F3CE23687938007C7E00 /* CoreRenderDemo.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = CoreRenderDemo.app; sourceTree = BUILT_PRODUCTS_DIR; };
+		1622F3D123687938007C7E00 /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
+		1622F3D523687938007C7E00 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
+		1622F3D72368793A007C7E00 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
+		1622F3DA2368793A007C7E00 /* Preview Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = "Preview Assets.xcassets"; sourceTree = "<group>"; };
+		1622F3DD2368793A007C7E00 /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; };
+		1622F3DF2368793A007C7E00 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
+		1622F3E523687988007C7E00 /* ViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ViewController.swift; sourceTree = "<group>"; };
+		16E97B6523687C3D00CEFB67 /* DemoWidget.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DemoWidget.swift; sourceTree = "<group>"; };
+/* End PBXFileReference section */
+
+/* Begin PBXFrameworksBuildPhase section */
+		1622F3CB23687938007C7E00 /* Frameworks */ = {
+			isa = PBXFrameworksBuildPhase;
+			buildActionMask = 2147483647;
+			files = (
+				16E97B6223687B7E00CEFB67 /* CoreRenderObjC in Frameworks */,
+				16E97B6423687B7E00CEFB67 /* CoreRender in Frameworks */,
+			);
+			runOnlyForDeploymentPostprocessing = 0;
+		};
+/* End PBXFrameworksBuildPhase section */
+
+/* Begin PBXGroup section */
+		1622F3C523687938007C7E00 = {
+			isa = PBXGroup;
+			children = (
+				1622F3D023687938007C7E00 /* CoreRenderDemo */,
+				1622F3CF23687938007C7E00 /* Products */,
+			);
+			sourceTree = "<group>";
+		};
+		1622F3CF23687938007C7E00 /* Products */ = {
+			isa = PBXGroup;
+			children = (
+				1622F3CE23687938007C7E00 /* CoreRenderDemo.app */,
+			);
+			name = Products;
+			sourceTree = "<group>";
+		};
+		1622F3D023687938007C7E00 /* CoreRenderDemo */ = {
+			isa = PBXGroup;
+			children = (
+				1622F3D123687938007C7E00 /* AppDelegate.swift */,
+				16E97B6523687C3D00CEFB67 /* DemoWidget.swift */,
+				1622F3D523687938007C7E00 /* ContentView.swift */,
+				1622F3E523687988007C7E00 /* ViewController.swift */,
+				1622F3D72368793A007C7E00 /* Assets.xcassets */,
+				1622F3DC2368793A007C7E00 /* LaunchScreen.storyboard */,
+				1622F3DF2368793A007C7E00 /* Info.plist */,
+				1622F3D92368793A007C7E00 /* Preview Content */,
+			);
+			path = CoreRenderDemo;
+			sourceTree = "<group>";
+		};
+		1622F3D92368793A007C7E00 /* Preview Content */ = {
+			isa = PBXGroup;
+			children = (
+				1622F3DA2368793A007C7E00 /* Preview Assets.xcassets */,
+			);
+			path = "Preview Content";
+			sourceTree = "<group>";
+		};
+/* End PBXGroup section */
+
+/* Begin PBXNativeTarget section */
+		1622F3CD23687938007C7E00 /* CoreRenderDemo */ = {
+			isa = 
```

**File**: `Demo/CoreRenderDemo.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+{
+  "object": {
+    "pins": [
+      {
+        "package": "CoreRender",
+        "repositoryURL": "https://github.com/alexdrone/CoreRender",
+        "state": {
+          "branch": "master",
+          "revision": "f037c40be86d247577a3c7bde3264b5ea2140a20",
+          "version": null
+        }
+      }
+    ]
+  },
+  "version": 1
+}
```

**File**: `Demo/CoreRenderDemo/AppDelegate.swift` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+import UIKit
+import SwiftUI
+
+@UIApplicationMain
+class AppDelegate: UIResponder, UIApplicationDelegate {
+  func application(
+    _ application: UIApplication,
+    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
+    return true
+  }
+
+  func application(
+    _ application: UIApplication,
+    configurationForConnecting connectingSceneSession: UISceneSession,
+    options: UIScene.ConnectionOptions
+  ) -> UISceneConfiguration {
+    // Called when a new scene session is being created.
+    // Use this method to select a configuration to create the new scene with.
+    return UISceneConfiguration(
+      name: "Default Configuration",
+      sessionRole: connectingSceneSession.role)
+  }
+
+  func application(
+    _ application: UIApplication,
+    didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
+    // Called when the user discards a scene session.
+    // If any sessions were discarded while the application was not running, this will be called
+    // shortly after application:didFinishLaunchingWithOptions.
+    // Use this method to release any resources that were specific to the discarded scenes,
+    //as they will not return.
+  }
+}
+
+class SceneDelegate: UIResponder, UIWindowSceneDelegate {
+
+  var useSwiftUI = false
+  var window: UIWindow?
+
+  func scene(
+    _ scene: UIScene,
+    willConnectTo session: UISceneSession,
+    options connectionOptions: UIScene.ConnectionOptions) {
+    
+    if (useSwiftUI) {
+      let contentView = ContentView()
+      // Use a UIHostingCoordinator as window root view coordinator.
+      if let windowScene = scene as? UIWindowScene {
+          let window = UIWindow(windowScene: windowScene)
+          window.rootViewController = UIHostingController(rootView: contentView)
+          self.window = window
+          window.makeKeyAndVisible()
+      }
+    } else {
+      // Use a normal ViewCoordinator as window root view coordinator.
+      if let windowScene = scene as? UIWindowScene {
+          let window = UIWindow(windowScene: windowScene)
+          window.rootViewController = ViewCoordinator()
+          self.window = window
+          window.makeKeyAndVisible()
+      }
+    }
+  }
+
+  func sceneDidDisconnect(_ scene: UIScene) {
+  }
+
+  func sceneDidBecomeActive(_ scene: UIScene) {
+  }
+
+  func sceneWillResignActive(_ scene: UIScene) {
+  }
+
+  func sceneWillEnterForeground(_ scene: UIScene) {
+  }
+
+  func sceneDidEnterBackground(_ scene: UIScene) {
+  }
+}
+
+
+
```

**File**: `Demo/CoreRenderDemo/Base.lproj/LaunchScreen.storyboard` (added, +25/-0)
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

**File**: `Demo/CoreRenderDemo/ContentView.swift` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import SwiftUI
+import CoreRender
+import CoreRenderObjC
+
+struct ContentView: View {
+    var body: some View {
+        Text("Hello World")
+    }
+}
+
+struct ContentView_Previews: PreviewProvider {
+    static var previews: some View {
+        ContentView()
+    }
+}
```

**File**: `Demo/CoreRenderDemo/DemoWidget.swift` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import Foundation
+import CoreRender
+import CoreRenderObjC
+
+// MARK: - Coordinator
+
+class DemoWidgetCoordinator: Coordinator {
+  var count: UInt = 0
+  var isRotated: Bool = false
+
+  @objc dynamic func increase() {
+    count += 1
+    setNeedsReconcile()
+  }
+
+  override func onLayout() {
+    // Override this to manually override the layout of some of the views in the view hierarchy.
+    // e.g.
+    // view(withKey: Const.increaseButtonKey)?.frame = ...
+  }
+}
+
+// MARK: - Body
+
+func makeDemoWidget(context: Context, coordinator: DemoWidgetCoordinator) -> OpaqueNodeBuilder {
+  VStackNode {
+    LabelNode(text: "\(coordinator.count)")
+      .font(UIFont.systemFont(ofSize: 24, weight: .black))
+      .textAlignment(.center)
+      .textColor(.darkText)
+      .background(.secondarySystemBackground)
+      .width(Const.size + 8 * CGFloat(coordinator.count))
+      .height(Const.size)
+      .margin(Const.margin)
+      .cornerRadius(Const.cornerRadius)
+    LabelNode(text: ">> TAP HERE TO SPIN THE BUTTON >>")
+      .font(UIFont.systemFont(ofSize: 12, weight: .bold))
+      .textAlignment(.center)
+      .textColor(.systemOrange)
+      .height(Const.size)
+      .margin(Const.margin)
+      .userInteractionEnabled(true)
+      .onTouchUpInside { _ in
+        coordinator.doSomeFunkyStuff()
+    }
+    HStackNode {
+      ButtonNode(key: Const.increaseButtonKey)
+        .text("TAP HERE TO INCREASE COUNT")
+        .font(UIFont.systemFont(ofSize: 12, weight: .bold))
+        .setTarget(
+          coordinator, action: #selector(DemoWidgetCoordinator.increase), for: .touchUpInside)
+        .background(.systemTeal)
+        .padding(Const.margin * 2)
+        .cornerRadius(Const.cornerRadius)
+      EmptyNode()
+    }
+  }
+  .alignItems(.center)
+  .matchHostingViewWidth(withMargin: 0)
+}
+
+// MARK: - Manual View Manipulation Example
+
+extension DemoWidgetCoordinator {
+  // Example of manual access to the underlying view hierarchy.
+  // Transitions can be performed in the node description as well, this is just an
+  // example of manual view hierarchy manipulation.
+  func doSomeFunkyStuff() {
+    let transform = isRotated
+      ? CGAffineTransform.identity
+      : CGAffineTransform.init(rotationAngle: .pi)
+    isRotated.toggle()
+    UIView.animate(withDuration: 1) {
+      self.view(withKey: Const.increaseButtonKey)?.transform = transform
+    }
+  }
+}
+
+// MARK: - Constants
+
+struct Const {
+  static let increaseButtonKey = "button_increase"
+  static let size: CGFloat = 48.0
+  static let cornerRadius: CGFloat = 8.0
+  static let margin: CGFloat = 4.0
+}
```

---

### Incident Patch 5: `f570205d` (2018-12-04)
**Commit Message**: Merge branch 'master' of github.com:alexdrone/Render

**File**: `README.md` (modified, +6/-1)
```diff
@@ -4,8 +4,13 @@
 
 Render is a declarative library for building efficient UIs on iOS inspired by [React](https://github.com/facebook/react).
 
+### Alternatives
 
-*Render Neutrino* is the new version of Render, re-built from the ground up ([4.*  release here](https://github.com/alexdrone/Render/tree/classic))
+- *Render Neutrino* is the new version of Render, re-built from the ground up ([4.*  release here](https://github.com/alexdrone/Render/tree/classic))
+
+- If you are interested in a more lightweight/low-level ObjC++ (*fully Swift-compatible*) alternative, check out [CoreRender](https://github.com/alexdrone/CoreRender).
+
+### Introduction
 
 * **Declarative:** Render uses a declarative API to define UI components. You simply describe the layout for your UI based on a set of inputs and the framework takes care of the rest (*diff* and *reconciliation* from virtual view hierarchy to the actual one under the hood).
 * **Flexbox layout:** Render includes the robust and battle-tested Facebook's [Yoga](https://facebook.github.io/yoga/) as default layout engine.
```

---

### Incident Patch 6: `b96624cf` (2018-12-04)
**Commit Message**: Moved CoreRender to other repo

**File**: `objc/CoreRender.xcodeproj/project.pbxproj` (removed, +0/-499)
```diff
@@ -1,499 +0,0 @@
-// !$*UTF8*$!
-{
-	archiveVersion = 1;
-	classes = {
-	};
-	objectVersion = 46;
-	objects = {
-
-/* Begin PBXBuildFile section */
-		16900D5B21145C2700B6BF85 /* CRController.h in Headers */ = {isa = PBXBuildFile; fileRef = 16900D5921145C2700B6BF85 /* CRController.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		16900D5C21145C2700B6BF85 /* CRController.mm in Sources */ = {isa = PBXBuildFile; fileRef = 16900D5A21145C2700B6BF85 /* CRController.mm */; };
-		16900D5E211472AA00B6BF85 /* CRController+Private.h in Headers */ = {isa = PBXBuildFile; fileRef = 16900D5D211472AA00B6BF85 /* CRController+Private.h */; settings = {ATTRIBUTES = (Private, ); }; };
-		BF_127239259546 /* CRUmbrellaHeader.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_192531073524 /* CRUmbrellaHeader.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_132083663318 /* Yoga.c in Sources */ = {isa = PBXBuildFile; fileRef = FR_992392398074 /* Yoga.c */; };
-		BF_139404374290 /* CRNode.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_882987497637 /* CRNode.mm */; };
-		BF_183038341856 /* UIView+CRNode.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_439634733832 /* UIView+CRNode.mm */; };
-		BF_253667324706 /* YGLayout.m in Sources */ = {isa = PBXBuildFile; fileRef = "FR_866360935786-1" /* YGLayout.m */; };
-		BF_265977215372 /* CRSwiftBridge.swift in Sources */ = {isa = PBXBuildFile; fileRef = FR_207069855663 /* CRSwiftBridge.swift */; };
-		BF_269367569910 /* CRNodeBridge.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_266875401349 /* CRNodeBridge.mm */; };
-		BF_306064163752 /* CoreRender.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_862926127157 /* CoreRender.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_368834986804 /* CRSwiftInteropTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = FR_787473978420 /* CRSwiftInteropTests.swift */; };
-		BF_405804783477 /* CRContext.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_615238287789 /* CRContext.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_457776453065 /* CRMacros.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_766493304644 /* CRMacros.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_504580378182 /* CRNodeLayoutSpec.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_154129109600 /* CRNodeLayoutSpec.mm */; };
-		BF_570003296635 /* CRNodeBridge.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_229333217053 /* CRNodeBridge.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_653280238411 /* CRNode.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_441077196049 /* CRNode.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_663824824714 /* CRNodeLayoutSpec.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_849819399313 /* CRNodeLayoutSpec.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_672851007961 /* UIView+CRNode.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_103086332183 /* UIView+CRNode.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_698598205330 /* CoreRender.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = FR_764490391420 /* CoreRender.framework */; };
-		BF_771599424629 /* Yoga.h in Headers */ = {isa = PBXBuildFile; fileRef = "FR_992392398074-1" /* Yoga.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_874188233624 /* CRNodeTests.m in Sources */ = {isa = PBXBuildFile; fileRef = FR_633785660067 /* CRNodeTests.m */; };
-		BF_905447759298 /* CRContext.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_431251200163 /* CRContext.mm */; };
-		BF_975951982098 /* YGLayout.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_866360935786 /* YGLayout.h */; settings = {ATTRIBUTES = (Public, ); }; };
-/* End PBXBuildFile section */
-
-/* Begin PBXContainerItemProxy section */
-		CIP_47994500323 /* PBXContainerItemProxy */ = {
-			isa = PBXContainerItemProxy;
-			containerPortal = P_7644903914209 /* Project object */;
-			proxyType = 1;
-			remoteGlobalIDString = NT_764490391420;
-			remoteInfo = CoreRender;
-		};
-/* End PBXContainerItemProxy section */
-
-/* Begin PBXFileReference section */
-		16900D5921145C2700B6BF85 /* CRController.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = CRController.h; sourceTree = "<group>"; };
-		16900D5A21145C2700B6BF85 /* CRController.mm */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.cpp.objcpp; path = CRController.mm; sourceTree = "<group>"; };
-		16900D5D211472AA00B6BF85 /* CRController+Private.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = "CRController+Private.h"; sourceTree = "<group>"; };
-		FR_103086332183 /* UIView+CRNode.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = "UIView+CRNode.h"; sourceTree = "<group>"; };
-		FR_154129109600 /* CRNodeLayoutSpec.mm */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.cpp.objcpp; path = CRNodeLayoutSpec.mm; sourceTree = "<group>"; };
-		FR_192531073524 /* CRUmbrellaHeader.h */ = {isa = PBXFileRef
```

**File**: `objc/CoreRender.xcodeproj/project.xcworkspace/contents.xcworkspacedata` (removed, +0/-7)
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

**File**: `objc/CoreRender.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` (removed, +0/-8)
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

**File**: `objc/CoreRender.xcodeproj/xcshareddata/xcschemes/Test.xcscheme` (removed, +0/-129)
```diff
@@ -1,129 +0,0 @@
-<?xml version="1.0" encoding="UTF-8"?>
-<Scheme
-   LastUpgradeVersion = "0930"
-   version = "1.3">
-   <BuildAction
-      parallelizeBuildables = "YES"
-      buildImplicitDependencies = "YES">
-      <BuildActionEntries>
-         <BuildActionEntry
-            buildForTesting = "YES"
-            buildForRunning = "YES"
-            buildForProfiling = "YES"
-            buildForArchiving = "YES"
-            buildForAnalyzing = "YES">
-            <BuildableReference
-               BuildableIdentifier = "primary"
-               BlueprintIdentifier = "NT_479945003232"
-               BuildableName = "Test.xctest"
-               BlueprintName = "Test"
-               ReferencedContainer = "container:CoreRender.xcodeproj">
-            </BuildableReference>
-         </BuildActionEntry>
-      </BuildActionEntries>
-   </BuildAction>
-   <TestAction
-      buildConfiguration = "Debug"
-      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
-      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      codeCoverageEnabled = "YES"
-      shouldUseLaunchSchemeArgsEnv = "NO">
-      <Testables>
-         <TestableReference
-            skipped = "NO">
-            <BuildableReference
-               BuildableIdentifier = "primary"
-               BlueprintIdentifier = "NT_479945003232"
-               BuildableName = "Test.xctest"
-               BlueprintName = "Test"
-               ReferencedContainer = "container:CoreRender.xcodeproj">
-            </BuildableReference>
-         </TestableReference>
-      </Testables>
-      <MacroExpansion>
-         <BuildableReference
-            BuildableIdentifier = "primary"
-            BlueprintIdentifier = "NT_479945003232"
-            BuildableName = "Test.xctest"
-            BlueprintName = "Test"
-            ReferencedContainer = "container:CoreRender.xcodeproj">
-         </BuildableReference>
-      </MacroExpansion>
-      <CommandLineArguments>
-      </CommandLineArguments>
-      <EnvironmentVariables>
-         <EnvironmentVariable
-            key = "TEST"
-            value = "YES"
-            isEnabled = "YES">
-         </EnvironmentVariable>
-      </EnvironmentVariables>
-      <AdditionalOptions>
-      </AdditionalOptions>
-   </TestAction>
-   <LaunchAction
-      buildConfiguration = "Debug"
-      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
-      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      launchStyle = "0"
-      useCustomWorkingDirectory = "NO"
-      ignoresPersistentStateOnLaunch = "NO"
-      debugDocumentVersioning = "YES"
-      debugServiceExtension = "internal"
-      allowLocationSimulation = "YES">
-      <BuildableProductRunnable
-         runnableDebuggingMode = "0">
-         <BuildableReference
-            BuildableIdentifier = "primary"
-            BlueprintIdentifier = "NT_479945003232"
-            BuildableName = "Test.xctest"
-            BlueprintName = "Test"
-            ReferencedContainer = "container:CoreRender.xcodeproj">
-         </BuildableReference>
-      </BuildableProductRunnable>
-      <CommandLineArguments>
-      </CommandLineArguments>
-      <EnvironmentVariables>
-         <EnvironmentVariable
-            key = "TEST"
-            value = "YES"
-            isEnabled = "YES">
-         </EnvironmentVariable>
-      </EnvironmentVariables>
-      <AdditionalOptions>
-      </AdditionalOptions>
-   </LaunchAction>
-   <ProfileAction
-      buildConfiguration = "Release"
-      shouldUseLaunchSchemeArgsEnv = "NO"
-      savedToolIdentifier = ""
-      useCustomWorkingDirectory = "NO"
-      debugDocumentVersioning = "YES">
-      <BuildableProductRunnable
-         runnableDebuggingMode = "0">
-         <BuildableReference
-            BuildableIdentifier = "primary"
-            BlueprintIdentifier = "NT_479945003232"
-            BuildableName = "Test.xctest"
-            BlueprintName = "Test"
-            ReferencedContainer = "container:CoreRender.xcodeproj">
-         </BuildableReference>
-      </BuildableProductRunnable>
-      <CommandLineArguments>
-      </CommandLineArguments>
-      <EnvironmentVariables>
-         <EnvironmentVariable
-            key = "TEST"
-            value = "YES"
-            isEnabled = "YES">
-         </EnvironmentVariable>
-      </EnvironmentVariables>
-   </ProfileAction>
-   <AnalyzeAction
-      buildConfiguration = "Debug">
-   </AnalyzeAction>
-   <ArchiveAction
-      buildConfiguration = "Release"
-      revealArchiveInOrganizer = "YES">
-   </ArchiveAction>
-</Scheme>
```

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRContext.h` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-#import "CRUmbrellaHeader.h"
-
-NS_ASSUME_NONNULL_BEGIN
-
-@interface CRContext : NSObject
-/// Layout animator for the nodes registered to this context.
-@property (nonatomic, nullable) UIViewPropertyAnimator *layoutAnimator;
-@end
-
-NS_ASSUME_NONNULL_END
```

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRMacros.h` (removed, +0/-70)
```diff
@@ -1,70 +0,0 @@
-#ifndef CRMacros_h
-#define CRMacros_h
-
-#if defined(__cplusplus)
-#else
-#define auto __auto_type
-#endif
-
-#if DEBUG
-#define CR_KEYPATH(o, p) ((void)(NO && ((void)o.p, NO)), @ #p)
-#else
-#define CR_KEYPATH(o, p) @ #p
-#endif
-
-#define CR_WEAKNAME_(VAR) VAR ## _weak_
-
-#define CR_WEAKIFY(VAR) __weak __typeof__(VAR) CR_WEAKNAME_(VAR) = (VAR);
-
-#define CR_STRONGIFY(VAR) \
-_Pragma("clang diagnostic push") \
-_Pragma("clang diagnostic ignored \"-Wshadow\"") \
-__strong __typeof__(VAR) VAR = CR_WEAKNAME_(VAR); \
-_Pragma("clang diagnostic pop")
-
-#define CR_STRONGIFY_AND_RETURN_IF_NIL(VAR) \
-CR_STRONGIFY(VAR); \
-if (!(VAR)) { \
-return; \
-}
-
-#define CR_NIL_COALESCING(VALUE, DEFAULT) VALUE != nil ? VALUE : DEFAULT;
-
-#define CR_DYNAMIC_CAST(TYPE, VALUE) ([VALUE isKindOfClass:TYPE.class] ? (TYPE *)VALUE : nil);
-
-#define CR_ASSERT_ON_MAIN_THREAD NSAssert(NSThread.isMainThread, @"%@ called off the main thread.", NSStringFromSelector(_cmd));;
-
-typedef struct __attribute__((objc_boxable)) CGPoint CGPoint;
-typedef struct __attribute__((objc_boxable)) CGSize CGSize;
-typedef struct __attribute__((objc_boxable)) CGRect CGRect;
-typedef struct __attribute__((objc_boxable)) CGVector CGVector;
-typedef struct __attribute__((objc_boxable)) UIEdgeInsets UIEdgeInsets;
-typedef struct __attribute__((objc_boxable)) _NSRange NSRange;
-
-@protocol CRFastEnumeration <NSFastEnumeration>
-- (id)cr_enumeratedType;
-@end
-
-// Usage: foreach (s, strings) { ... }
-#define foreach(element, collection) for (typeof((collection).cr_enumeratedType) element in (collection))
-
-@interface NSArray <ElementType> (CRFastEnumeration) <CRFastEnumeration>
-- (ElementType)cr_enumeratedType;
-@end
-
-@interface NSSet <ElementType> (CRFastEnumeration) <CRFastEnumeration>
-- (ElementType)cr_enumeratedType;
-@end
-
-@interface NSDictionary <KeyType, ValueType> (CRFastEnumeration) <CRFastEnumeration>
-- (KeyType)cr_enumeratedType;
-@end
-
-// Geometry
-
-#define CR_CGFLOAT_MAX 32768
-#define CR_CGFLOAT_UNDEFINED YGUndefined
-#define CR_CGFLOAT_FLEXIBLE CR_CGFLOAT_MAX
-#define CR_NORMALIZE(value) (value >= 0.0 && value <= CR_CGFLOAT_MAX ? value : 0.0)
-
-#endif /* CRMacros_h */
```

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRNode.h` (removed, +0/-97)
```diff
@@ -1,97 +0,0 @@
-#import "CRUmbrellaHeader.h"
-
-NS_ASSUME_NONNULL_BEGIN
-
-typedef NS_OPTIONS(NSUInteger, CRNodeLayoutOptions) {
-  CRNodeLayoutOptionsNone = 1 << 0,
-  CRNodeLayoutOptionsSizeContainerViewToFit = 1 << 1
-};
-
-@class CRNode;
-@class CRContext;
-@class CRNodeLayoutSpec<__covariant V: UIView *>;
-
-@protocol CRNodeDelegate <NSObject>
-@optional
-/// The root node for this hierarchy is being configured and layed out.
-/// Additional custom manual layout can be defined here.
-/// @note: Use @viewWithKey or @viewsWithReuseIdentifier to query the desired views in the
-/// installed view hierarchy.
-- (void)rootNodeDidLayout:(CRNode *)node;
-/// The node @renderedView just got inserted in the view hierarchy.
-- (void)rootNodeDidMount:(CRNode *)node;
-@end
-
-@interface CRNode<__covariant V: UIView *> : NSObject
-/// The context associated with this node hierarchy.
-@property(nonatomic, readonly, nullable) CRContext *context;
-/// The reuse identifier for this node is its hierarchy.
-/// Identifiers help Render understand which items have changed.
-/// A custom *reuseIdentifier* is mandatory if the node has a custom creation closure.
-@property(nonatomic, readonly) NSString *reuseIdentifier;
-/// A unique key for the component/node (necessary if the associated component is stateful).
-@property(nonatomic, readonly, nullable) NSString *key;
-/// This component is the n-th children.
-@property(nonatomic, readonly) NSUInteger index;
-/// The subnodes of this node.
-@property(nonatomic, readonly) NSArray<CRNode *> *children;
-/// The parent node (if this is not the root node in the hierarchy).
-@property(nonatomic, readonly, nullable, weak) CRNode *parent;
-/// The type of the associated backing view.
-@property(nonatomic, readonly) Class viewType;
-/// Backing view for this node.
-@property(nonatomic, readonly, nullable) V renderedView;
-/// The layout delegate for this node.
-@property(nonatomic, nullable, weak) id<CRNodeDelegate> delegate;
-
-#pragma mark Constructors
-
-- (instancetype)initWithType:(Class)type
-             reuseIdentifier:(nullable NSString *)reuseIdentifier
-                         key:(nullable NSString *)key
-          viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
-                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
-
-+ (instancetype)nodeWithType:(Class)type
-             reuseIdentifier:(NSString *)reuseIdentifier
-                         key:(nullable NSString *)key
-          viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
-                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
-
-+ (instancetype)nodeWithType:(Class)type
-                         key:(nullable NSString *)key
-                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
-
-+ (instancetype)nodeWithType:(Class)type
-                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
-
-#pragma mark Setup
-
-/// Adds the nodes as children of this node.
-- (instancetype)appendChilden:(NSArray<CRNode *> *)children;
-
-/// Register the context for the root node of this node hierarchy.
-- (void)registerInContext:(CRContext *)context;
-
-#pragma mark Render
-
-/// Reconcile the view hierarchy with the one in the container view passed as argument.
-/// @note: This method also performs layout and configuration.
-- (void)reconcileInView:(UIView *)view
-      constrainedToSize:(CGSize)size
-            withOptions:(CRNodeLayoutOptions)options;
-
-/// Layout and configure the views.
-- (void)layoutConstrainedToSize:(CGSize)size withOptions:(CRNodeLayoutOptions)options;
-
-#pragma mark Querying
-
-/// Returns the view in the subtree of this node with the given @c key.
-- (nullable UIView *)viewWithKey:(NSString *)key;
-
-/// Returns all the views that have been registered with the given @c reuseIdentifier.
-- (NSArray<UIView *> *)viewsWithReuseIdentifier:(NSString *)reuseIdentifier;
-
-@end
-
-NS_ASSUME_NONNULL_END
```

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRNodeBridge.h` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-#import "CRUmbrellaHeader.h"
-
-NS_ASSUME_NONNULL_BEGIN
-
-@class CRNode;
-
-@interface CRNodeBridge : NSObject
-/// Whether the view has been created at the last render pass.
-@property (nonatomic) BOOL isNewlyCreated;
-/// The node associated to this view.
-@property (nonatomic, nullable, weak) CRNode *node;
-/// The bridged view.
-@property (nonatomic, nullable, weak) UIView *view;
-/// Layout animator for this subtree.
-@property (nonatomic, nullable) UIViewPropertyAnimator *layoutAnimator;
-
-- (instancetype)initWithView:(UIView*)view;
-
-/// Stores the current (now considered old in the current run-loop) geometry for the associated
-/// view and all of its subviews recursively.
-- (void)storeViewSubTreeOldGeometry;
-/// Applies the stored old geometry to this view subtree.
-- (void)applyViewSubTreeOldGeometry;
-/// Stores the geometry for the associated view after the node has rendered at the end of the
-/// current run-loop.
-- (void)storeViewSubTreeNewGeometry;
-/// Applies the stored new geometry to this view subtree.
-- (void)applyViewSubTreeNewGeometry;
-/// Transition in all of the newly created view in the view hierarchy.
-- (void)fadeInNewlyCreatedViewsInViewSubTreeWithDelay:(NSTimeInterval)delay;
-/// Set the property at the given keyPath.nil
-- (void)setPropertyWithKeyPath:(NSString *)keyPath
-                         value:(id)value
-                      animator:(nullable UIViewPropertyAnimator *)animator;
-/// Restore the view to its initial state.
-- (void)restore;
-
-@end
-
-NS_ASSUME_NONNULL_END
```

---

### Incident Patch 7: `05384eaf` (2018-10-04)
**Commit Message**: Keypath hash is now fixed on iOS 12

**File**: `bin/RenderInspector.framework/Headers/RenderInspector-Swift.h` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// Generated by Apple Swift version 4.2 (swiftlang-1000.0.16.7 clang-1000.10.25.3)
+// Generated by Apple Swift version 4.2 (swiftlang-1000.11.37.1 clang-1000.11.45.1)
 #pragma clang diagnostic push
 #pragma clang diagnostic ignored "-Wgcc-compat"
 
```

**File**: `bin/RenderInspector.framework/_CodeSignature/CodeResources` (modified, +16/-16)
```diff
@@ -6,31 +6,31 @@
 	<dict>
 		<key>Headers/RenderInspector-Swift.h</key>
 		<data>
-		BD18FD/EgETZAMZfdpSC/wwMogk=
+		vpUC3BYUYcLmICAVVNh7OMHiqIY=
 		</data>
 		<key>Headers/RenderInspector.h</key>
 		<data>
 		prAlnqtqtD+oOq+n7Q7DE3ANp9A=
 		</data>
 		<key>Info.plist</key>
 		<data>
-		m2zCVLp16+M4Fo5+Oaca7zLkE3o=
+		cOZAIcub/XC+9E7gKD+iokxjuvA=
 		</data>
 		<key>Modules/RenderInspector.swiftmodule/i386.swiftdoc</key>
 		<data>
-		ihyJARJBYwPiibYtHk0zZsYdedQ=
+		LOgOEoUDylYL3nkM2DI4XDNYrKw=
 		</data>
 		<key>Modules/RenderInspector.swiftmodule/i386.swiftmodule</key>
 		<data>
-		LsUNvc7x4AZ3FVF8E6Wh1HFuIN4=
+		PpIXWFv7+UhXd/f/MXLKMYhwCTs=
 		</data>
 		<key>Modules/RenderInspector.swiftmodule/x86_64.swiftdoc</key>
 		<data>
-		K+3QOlby1NcRryifFqSETXwjvoQ=
+		2/P/3WgKA++VSZGJ01FpZSIVIZI=
 		</data>
 		<key>Modules/RenderInspector.swiftmodule/x86_64.swiftmodule</key>
 		<data>
-		9pTiPYjGTomdMiNnMbG+cehm4aQ=
+		+UiX04uB3rd7ps8zB+QwtUhq3Ak=
 		</data>
 		<key>Modules/module.modulemap</key>
 		<data>
@@ -43,11 +43,11 @@
 		<dict>
 			<key>hash</key>
 			<data>
-			BD18FD/EgETZAMZfdpSC/wwMogk=
+			vpUC3BYUYcLmICAVVNh7OMHiqIY=
 			</data>
 			<key>hash2</key>
 			<data>
-			zI8eUZDymSWMQqRuESpHH3UEzRfGhNTWCu1Fe9HgGYg=
+			KahCELuxZ9ICRL3vvjUnHlOfN4ut80ZIIbYJHK/t4/Q=
 			</data>
 		</dict>
 		<key>Headers/RenderInspector.h</key>
@@ -65,44 +65,44 @@
 		<dict>
 			<key>hash</key>
 			<data>
-			ihyJARJBYwPiibYtHk0zZsYdedQ=
+			LOgOEoUDylYL3nkM2DI4XDNYrKw=
 			</data>
 			<key>hash2</key>
 			<data>
-			8g5P56wQ0/S3+d1fUHEpVZYqxHRSqVZAN+s9BbUkCVs=
+			GNTVt3msWs23xruEb3pbBUchCi89lBDUQU5OGPJceaw=
 			</data>
 		</dict>
 		<key>Modules/RenderInspector.swiftmodule/i386.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			LsUNvc7x4AZ3FVF8E6Wh1HFuIN4=
+			PpIXWFv7+UhXd/f/MXLKMYhwCTs=
 			</data>
 			<key>hash2</key>
 			<data>
-			i7inGz3IwdWiCmIsE6LCjlz5LhQ6E1iOlZHpPAYilMM=
+			jO4OsvoecJaucDZNGOPmS6AG4f9hL/88q3N8fuAdcqM=
 			</data>
 		</dict>
 		<key>Modules/RenderInspector.swiftmodule/x86_64.swiftdoc</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			K+3QOlby1NcRryifFqSETXwjvoQ=
+			2/P/3WgKA++VSZGJ01FpZSIVIZI=
 			</data>
 			<key>hash2</key>
 			<data>
-			lUfZN8oj3Pn5ucv51CDR37iSmY4TveNphu/8c7SipyE=
+			0a1uHmXdscm2rScJRJtL/ZA/EZeVE2+Mz9W8pzQ4bCE=
 			</data>
 		</dict>
 		<key>Modules/RenderInspector.swiftmodule/x86_64.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			9pTiPYjGTomdMiNnMbG+cehm4aQ=
+			+UiX04uB3rd7ps8zB+QwtUhq3Ak=
 			</data>
 			<key>hash2</key>
 			<data>
-			8aVFmLSfmVfy3IR0VeB1Cw+iiK8rid/e8S9d59j+tR8=
+			+vw8VzGkYiVucP7563TpHjXc34oKowDNz07ca7AWqxU=
 			</data>
 		</dict>
 		<key>Modules/module.modulemap</key>
```

**File**: `bin/RenderNeutrino.framework.dSYM/Contents/Info.plist` (modified, +20/-0)
```diff
@@ -0,0 +1,20 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+	<dict>
+		<key>CFBundleDevelopmentRegion</key>
+		<string>English</string>
+		<key>CFBundleIdentifier</key>
+		<string>com.apple.xcode.dsym.io.render.neutrino</string>
+		<key>CFBundleInfoDictionaryVersion</key>
+		<string>6.0</string>
+		<key>CFBundlePackageType</key>
+		<string>dSYM</string>
+		<key>CFBundleSignature</key>
+		<string>????</string>
+		<key>CFBundleShortVersionString</key>
+		<string>1.0</string>
+		<key>CFBundleVersion</key>
+		<string>1</string>
+	</dict>
+</plist>
```

**File**: `bin/RenderNeutrino.framework/Headers/RenderNeutrino-Swift.h` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// Generated by Apple Swift version 4.2 (swiftlang-1000.0.16.7 clang-1000.10.25.3)
+// Generated by Apple Swift version 4.2 (swiftlang-1000.11.37.1 clang-1000.11.45.1)
 #pragma clang diagnostic push
 #pragma clang diagnostic ignored "-Wgcc-compat"
 
```

**File**: `bin/RenderNeutrino.framework/_CodeSignature/CodeResources` (modified, +16/-16)
```diff
@@ -10,7 +10,7 @@
 		</data>
 		<key>Headers/RenderNeutrino-Swift.h</key>
 		<data>
-		pz+R/04pQ/7CZuOHpLJlqx8hifE=
+		0iC/Vlf2BirrFdnJ/H8QF3Y9hmc=
 		</data>
 		<key>Headers/RenderNeutrino.h</key>
 		<data>
@@ -54,23 +54,23 @@
 		</data>
 		<key>Info.plist</key>
 		<data>
-		/IKT3xCA3lBKnsJ4foW2m8nPF/E=
+		cYFIXwT1d7RWw67FWMRmbhlxB7w=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftdoc</key>
 		<data>
-		mgYep88YP0oMn9VPtlwfdPm2998=
+		yYUqmN51VlYjL9eLlDGHJ3FBz+o=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftmodule</key>
 		<data>
-		1TIcIGTK60k95ycAoU6fWAE/GIU=
+		DjLbyTkjA/W49l9f73nOeXUEMZk=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftdoc</key>
 		<data>
-		jluSVUlA5XkRUy7Sl25GqcsUAOQ=
+		Kec6hO+JZDc+egV8RJKDoGkmPV0=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftmodule</key>
 		<data>
-		VqNS0lr6Jk2f8k2s9M+7Cyrsn7E=
+		agZEBMqkACiKJ+I8HdmZoQsFfuQ=
 		</data>
 		<key>Modules/module.modulemap</key>
 		<data>
@@ -94,11 +94,11 @@
 		<dict>
 			<key>hash</key>
 			<data>
-			pz+R/04pQ/7CZuOHpLJlqx8hifE=
+			0iC/Vlf2BirrFdnJ/H8QF3Y9hmc=
 			</data>
 			<key>hash2</key>
 			<data>
-			tVoApLGSZGA0RdOVug1773QN2oanKHt1XCAWluLUntQ=
+			F2u9ynuih2OoPCBVMd7dfIgjA/pRt8SYmR4M7WhZNj8=
 			</data>
 		</dict>
 		<key>Headers/RenderNeutrino.h</key>
@@ -215,44 +215,44 @@
 		<dict>
 			<key>hash</key>
 			<data>
-			mgYep88YP0oMn9VPtlwfdPm2998=
+			yYUqmN51VlYjL9eLlDGHJ3FBz+o=
 			</data>
 			<key>hash2</key>
 			<data>
-			Zx4Hqm1mY9z3yElRxaOCT7+W7cdH/KSiZKnyhBkOMyU=
+			5ykf80c9jwRcXvKZlLgnacQPJQ9xbfoFA0CxM5/Y/wQ=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			1TIcIGTK60k95ycAoU6fWAE/GIU=
+			DjLbyTkjA/W49l9f73nOeXUEMZk=
 			</data>
 			<key>hash2</key>
 			<data>
-			nJS4jVZ1+tQtff19obJ16h7d87SCo3Cbbr7eoEJZFmQ=
+			nSroov0FaCdysxk2y6MKOK2qQviSVxF3cd2Xzwm+CpQ=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftdoc</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			jluSVUlA5XkRUy7Sl25GqcsUAOQ=
+			Kec6hO+JZDc+egV8RJKDoGkmPV0=
 			</data>
 			<key>hash2</key>
 			<data>
-			UFZau96NYqo9bUerO9F8w5m9rCLtqtlSt7zs9GXiyfs=
+			0ATAh8EqvAv1A6I4CVwEdLqtSrKub3Ivvu1gSmiZqXw=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			VqNS0lr6Jk2f8k2s9M+7Cyrsn7E=
+			agZEBMqkACiKJ+I8HdmZoQsFfuQ=
 			</data>
 			<key>hash2</key>
 			<data>
-			7e6qAIpQtUCRsOSxMYhS2YjTuyJQUBTb6kNCIPuMlXE=
+			D65VP0BDEDI20sRUlSmbTKHTKeQzckZxQxPSxQKLjLI=
 			</data>
 		</dict>
 		<key>Modules/module.modulemap</key>
```

**File**: `render/src/KeyPath.swift` (modified, +0/-6)
```diff
@@ -98,13 +98,7 @@ extension AnyKeyPath {
 
   public var hashIdentifier: Int {
     if let path = _kvcKeyPathString { return path.hashValue }
-    // *hashValue* is broken in iOS12
-    // so we rely on the fact the KeyPath objects are unique.
-    #if swift(>=4.2)
-    return Unmanaged.passUnretained(self).toOpaque().hashValue
-    #else
     return hashValue
-    #endif
   }
 }
 
```

---

### Incident Patch 8: `afa7476c` (2018-08-06)
**Commit Message**: objc fixed state propagation

**File**: `objc/demo/CoreRenderDemo.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -14,6 +14,7 @@
 		16405DBA20F36F50006071CC /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = 16405DB820F36F50006071CC /* LaunchScreen.storyboard */; };
 		16405DE020F37035006071CC /* CoreRender.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 16405DDA20F37015006071CC /* CoreRender.framework */; };
 		16405DE120F37035006071CC /* CoreRender.framework in Embed Frameworks */ = {isa = PBXBuildFile; fileRef = 16405DDA20F37015006071CC /* CoreRender.framework */; settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; };
+		1690793A211770A400EE8147 /* CounterExample.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16907939211770A400EE8147 /* CounterExample.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -63,6 +64,7 @@
 		16405DB920F36F50006071CC /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; };
 		16405DBB20F36F50006071CC /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
 		16405DD420F37015006071CC /* CoreRender.xcodeproj */ = {isa = PBXFileReference; lastKnownFileType = "wrapper.pb-project"; name = CoreRender.xcodeproj; path = ../CoreRender.xcodeproj; sourceTree = "<group>"; };
+		16907939211770A400EE8147 /* CounterExample.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CounterExample.swift; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -99,6 +101,7 @@
 			children = (
 				16405DAF20F36F4F006071CC /* AppDelegate.swift */,
 				16405DB120F36F4F006071CC /* ViewController.swift */,
+				16907939211770A400EE8147 /* CounterExample.swift */,
 				16405DB320F36F4F006071CC /* Main.storyboard */,
 				16405DB620F36F50006071CC /* Assets.xcassets */,
 				16405DB820F36F50006071CC /* LaunchScreen.storyboard */,
@@ -213,6 +216,7 @@
 			buildActionMask = 2147483647;
 			files = (
 				16405DB220F36F4F006071CC /* ViewController.swift in Sources */,
+				1690793A211770A400EE8147 /* CounterExample.swift in Sources */,
 				16405DB020F36F4F006071CC /* AppDelegate.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
```

**File**: `objc/demo/CoreRenderDemo/Base.lproj/Main.storyboard` (modified, +7/-4)
```diff
@@ -1,15 +1,18 @@
 <?xml version="1.0" encoding="UTF-8"?>
-<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="13122.16" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="BYZ-38-t0r">
+<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="14269.12" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="BYZ-38-t0r">
+    <device id="retina4_7" orientation="portrait">
+        <adaptation id="fullscreen"/>
+    </device>
     <dependencies>
-        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="13104.12"/>
+        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="14252.5"/>
         <capability name="Safe area layout guides" minToolsVersion="9.0"/>
         <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
     </dependencies>
     <scenes>
-        <!--View Controller-->
+        <!--Counter View Controller-->
         <scene sceneID="tne-QT-ifu">
             <objects>
-                <viewController id="BYZ-38-t0r" customClass="ViewController" customModuleProvider="target" sceneMemberID="viewController">
+                <viewController id="BYZ-38-t0r" customClass="CounterViewController" customModule="CoreRenderDemo" customModuleProvider="target" sceneMemberID="viewController">
                     <view key="view" contentMode="scaleToFill" id="8bC-Xf-vdC">
                         <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                         <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
```

**File**: `objc/demo/CoreRenderDemo/CounterExample.swift` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import UIKit
+import CoreRender
+
+// MARK: - ViewController
+
+class CounterViewController: UIViewController {
+  private var node: ConcreteNode<UIView>?
+  private let context = Context()
+
+  override func viewDidLoad() {
+    super.viewDidLoad()
+    // Do any additional setup after loading the view, typically from a nib.
+    render()
+  }
+
+  func render() {
+    node = counterNode()
+    node?.registerHierarchy(in: context)
+    node?.reconcile(in: view, constrainedTo: view.bounds.size, with: [])
+  }
+
+  override func viewDidLayoutSubviews() {
+    render()
+  }
+}
+
+// MARK: - Node
+
+func counterNode() -> ConcreteNode<UIView> {
+  let node = Node(type: UIView.self, controller: CounterController.self, key: "counter") { spec in
+    set(spec, keyPath: \UIView.yoga.width, value: spec.size.width)
+  }
+  let wrapper = Node(type: UIView.self) { spec in
+    set(spec, keyPath: \UIView.backgroundColor, value: .lightGray)
+    set(spec, keyPath: \UIView.cornerRadius, value: 5)
+    set(spec, keyPath: \UIView.yoga.margin, value: 20)
+    set(spec, keyPath: \UIView.yoga.padding, value: 20)
+  }
+  let label = Node(type: UIButton.self) { spec in
+    guard
+      let state = spec.state as? CounterState,
+      let controller = spec.controller as? CounterController else { return }
+    spec.view?.setTitle("Count: \(state.count)", for: .normal)
+    spec.view?.addTarget(
+      controller,
+      action: #selector(CounterController.incrementCounter),
+      for: .touchUpInside)
+  }
+  node.append(children: [wrapper])
+  wrapper.append(children: [label])
+
+  return node
+}
+
+// MARK: - State
+
+class CounterState: State {
+  var count = 0;
+}
+
+// MARK: - Controller
+
+class CounterController: Controller<NullProps, CounterState> {
+
+
+  @objc dynamic func incrementCounter() {
+    self.state.count += 1
+  }
+
+}
+
+
```

**File**: `objc/src/CRController+Private.h` (modified, +7/-0)
```diff
@@ -14,4 +14,11 @@ NS_ASSUME_NONNULL_BEGIN
 
 @end
 
+//template <typename T, typename S, typename P>
+//inline void CRInjectInitialStateAndProps(CRController<S, P> * _Nullable controller) {
+//  if (!controller) return;
+//  controller.state = CR_NIL_COALESCING(controller.state, [[S alloc] init]);
+//  controller.state = CR_NIL_COALESCING(controller.props, [[P alloc] init]);
+//}
+
 NS_ASSUME_NONNULL_END
```

**File**: `objc/src/CRController.h` (modified, +9/-0)
```diff
@@ -48,9 +48,18 @@ NS_SWIFT_NAME(Controller)
 
 @end
 
+#pragma mark - Stateless Controllers
+
 /// Represents a null empty state - used to model @c CRStatelessController.
 NS_SWIFT_NAME(NullState)
 @interface CRNullState: CRState
+@property(class, nonatomic, readonly) CRNullState *null;
+@end
+
+/// No props object.
+NS_SWIFT_NAME(NullProps)
+@interface CRNullProps: CRProps
+@property(class, nonatomic, readonly) CRNullProps *null;
 @end
 
 NS_SWIFT_NAME(StatelessController)
```

**File**: `objc/src/CRController.mm` (modified, +23/-0)
```diff
@@ -42,6 +42,29 @@ - (void)onMount {
 #pragma mark - StatelessController
 
 @implementation CRNullState
+
++ (CRNullState *)null {
+  static CRNullState *shared;
+  static dispatch_once_t onceToken;
+  dispatch_once(&onceToken, ^(){
+    shared = [[CRNullState alloc] init];
+  });
+  return shared;
+}
+
+@end
+
+@implementation CRNullProps
+
++ (CRNullProps *)null {
+  static CRNullProps  *shared;
+  static dispatch_once_t onceToken;
+  dispatch_once(&onceToken, ^(){
+    shared = [[CRNullProps alloc] init];
+  });
+  return shared;
+}
+
 @end
 
 @implementation CRStatelessController
```

**File**: `objc/src/CRNode.h` (modified, +7/-1)
```diff
@@ -11,6 +11,8 @@ typedef NS_OPTIONS(NSUInteger, CRNodeLayoutOptions) {
 @class CRNode;
 @class CRContext;
 @class CRNodeLayoutSpec<__covariant V: UIView *>;
+@class CRState;
+@class CRProps;
 
 NS_SWIFT_NAME(NodeDelegate)
 @protocol CRNodeDelegate <NSObject>
@@ -54,6 +56,8 @@ NS_SWIFT_NAME(ConcreteNode)
 @property(nonatomic, nullable, readonly) __kindof CRController *controller;
 /// Represents the properties that are externally injected into the controller.
 @property(nonatomic, nullable, readonly) __kindof CRProps *props;
+/// The initial state (if the controller doesn't have one already).
+@property(nonatomic, nullable, readonly) __kindof CRState *initialState;
 
 #pragma mark Constructors
 
@@ -82,7 +86,9 @@ NS_SWIFT_NAME(ConcreteNode)
 - (instancetype)appendChildren:(NSArray<CRNode *> *)children;
 
 /// Bind this node to the @c CRController class passed as argument.
-- (instancetype)bindController:(Class)controllerType withProps:(nullable CRProps *)props;
+- (instancetype)bindController:(Class)controllerType
+                  initialState:(CRState *)state
+                         props:(CRProps *)props;
 
 /// Register the context for the root node of this node hierarchy.
 - (void)registerNodeHierarchyInContext:(CRContext *)context;
```

**File**: `objc/src/CRNode.mm` (modified, +13/-4)
```diff
@@ -3,6 +3,7 @@
 
 @interface CRNode ()
 @property(nonatomic, readwrite) NSUInteger index;
+@property(nonatomic, readwrite, nullable, weak) CRNode *parent;
 @property(nonatomic, readwrite, nullable) __kindof UIView *renderedView;
 /// The view initialization block.
 @property (nonatomic, copy) UIView * (^viewInitialization)(void);
@@ -88,6 +89,7 @@ - (void)registerNodeHierarchyInContext:(CRContext *)context {
 
 - (void)_recursivelyConfigureControllersInNodeHierarchy {
   self.controller.props = self.props;
+  self.controller.state = CR_NIL_COALESCING(self.controller.state, self.initialState);
   self.controller.node = self;
   foreach(child, _mutableChildren) {
     [child _recursivelyConfigureControllersInNodeHierarchy];
@@ -100,10 +102,13 @@ - (CRContext *)context {
 }
 
 - (__kindof CRController *)controller {
-  if (!_controllerType || !_context) return nil;
+  const auto context = self.context;
+  if (!context) return nil;
+  if (!_controllerType)
+    return _parent.controller;
   return _key != nil
-    ? [_context controllerOfType:_controllerType withKey:_key]
-    : [_context controllerOfType:_controllerType];
+    ? [context controllerOfType:_controllerType withKey:_key]
+    : [context controllerOfType:_controllerType];
 }
 
 #pragma mark - Children
@@ -117,14 +122,18 @@ - (instancetype)appendChildren:(NSArray<CRNode *> *)children {
   auto lastIndex = _mutableChildren.lastObject.index;
   foreach(child, children) {
     child.index = lastIndex++;
+    child.parent = self;
     [_mutableChildren addObject:child];
   }
   return self;
 }
 
-- (instancetype)bindController:(Class)controllerType withProps:(CRProps *)props {
+- (instancetype)bindController:(Class)controllerType
+                  initialState:(CRState *)state
+                         props:(CRProps *)props {
   CR_ASSERT_ON_MAIN_THREAD;
   _props = props;
+  _initialState = state;
   if (controllerType) {
     if([controllerType isSubclassOfClass:CRController.class]) {
       if (_key) {
```

---

### Incident Patch 9: `a9bf0c19` (2018-08-03)
**Commit Message**: corerender

**File**: `objc/CoreRender.xcodeproj/project.pbxproj` (modified, +8/-1)
```diff
@@ -57,7 +57,7 @@
 		FR_439634733832 /* UIView+CRNode.mm */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.cpp.objcpp; path = "UIView+CRNode.mm"; sourceTree = "<group>"; };
 		FR_441077196049 /* CRNode.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = CRNode.h; sourceTree = "<group>"; };
 		FR_456968685412 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
-		FR_479945003232 /* Test.xctest */ = {isa = PBXFileReference; includeInIndex = 0; lastKnownFileType = wrapper.cfbundle; path = Test.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
+		FR_479945003232 /* Test.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = Test.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
 		FR_615238287789 /* CRContext.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = CRContext.h; sourceTree = "<group>"; };
 		FR_633785660067 /* CRNodeTests.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = CRNodeTests.m; sourceTree = "<group>"; };
 		FR_764490391420 /* CoreRender.framework */ = {isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; path = CoreRender.framework; sourceTree = BUILT_PRODUCTS_DIR; };
@@ -215,6 +215,11 @@
 			isa = PBXProject;
 			attributes = {
 				LastUpgradeCheck = 0930;
+				TargetAttributes = {
+					NT_479945003232 = {
+						LastSwiftMigration = 1000;
+					};
+				};
 			};
 			buildConfigurationList = CL_764490391420 /* Build configuration list for PBXProject "CoreRender" */;
 			compatibilityVersion = "Xcode 3.2";
@@ -332,6 +337,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
 				SDKROOT = iphoneos;
+				SWIFT_VERSION = 4.2;
 				TARGETED_DEVICE_FAMILY = "1,2";
 			};
 			name = Release;
@@ -401,6 +407,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
 				SDKROOT = iphoneos;
+				SWIFT_VERSION = 4.2;
 				TARGETED_DEVICE_FAMILY = "1,2";
 			};
 			name = Debug;
```

**File**: `objc/src/CRContext.mm` (modified, +3/-2)
```diff
@@ -16,9 +16,10 @@ - (instancetype)init {
 - (__kindof CRController*)controllerOfType:(Class)type withKey:(NSString *)key {
   CR_ASSERT_ON_MAIN_THREAD;
   if (![type isSubclassOfClass:CRController.self]) return nil;
-  const auto container = [self containerForType:type];
+  const auto container = [self _containerForType:type];
   if (const auto controller = container[key]) return controller;
   const auto controller = [[CRController alloc] initWithKey:key];
+  controller.context = self;
   container[key] = controller;
   return controller;
 }
@@ -29,7 +30,7 @@ - (__kindof CRStatelessController *)controllerOfType:(Class)type {
   return [self controllerOfType:type withKey:CRControllerStatelessKey];
 }
 
-- (NSMutableDictionary<NSString*, CRController*> *)containerForType:(Class)type {
+- (NSMutableDictionary<NSString*, CRController*> *)_containerForType:(Class)type {
   const auto str = NSStringFromClass(type);
   if (const auto container = _controllers[str]) return container;
   const auto container = [[NSMutableDictionary<NSString*, CRController*> alloc] init];
```

**File**: `objc/src/CRController+Private.h` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ NS_ASSUME_NONNULL_BEGIN
 @interface CRController <P, S> ()
 // Private setter modifiers
 @property(nonatomic, readwrite) NSString *key;
+@property(nonatomic, readwrite, nullable, weak) CRContext *context;
+
 /// @note: Never call the init method manually - controllers are dynamically constructed,
 /// disposed and reused by @c CRContext.
 - (instancetype)initWithKey:(NSString*)key;
```

**File**: `objc/src/CRController.h` (modified, +3/-3)
```diff
@@ -1,16 +1,14 @@
 #import <Foundation/Foundation.h>
 
 NS_ASSUME_NONNULL_BEGIN
+@class CRContext;
 
 extern NSString *CRControllerStatelessKey;
 
 /// Represents the properties that are externally injected into the controller.
 /// This may contains *arguments*, *model objects*, *delegates* or *injectable services*.
 NS_SWIFT_NAME(Props)
 @interface CRProps : NSObject
-/// The class of the controller associated to this.
-/// @note: Subclasses must override this class property.
-@property(nonatomic, readonly) Class controllerType;
 @end
 
 /// Represents the internal state of a controller.
@@ -22,6 +20,8 @@ NS_SWIFT_NAME(State)
 
 NS_SWIFT_NAME(Controller)
 @interface CRController<__covariant P: CRProps *, __covariant S: CRState *> : NSObject
+/// The context associated with this controller.
+@property(nonatomic, readonly, nullable, weak) CRContext *context;
 /// Whether this controller is stateful or not.
 /// Transient controllers can be reused for several UI nodes at the same time and can be disposed
 /// and rebuilt at any given time.
```

**File**: `objc/src/CRController.mm` (modified, +3/-16)
```diff
@@ -7,22 +7,6 @@
 #pragma mark - Props & State
 
 @implementation CRProps
-- (Class)controllerType {
-  [NSException raise:CRIllegalControllerTypeExceptionName
-              format:@"Subclasses must return the desired CRController subclass."];
-  return nil;
-}
-
-- (instancetype)init {
-  if (self = [super init]) {
-    if (![self.controllerType isSubclassOfClass:CRController.self]) {
-      [NSException raise:CRIllegalControllerTypeExceptionName
-                  format:@"controllerType must be a subclass of CRController."];
-    }
-  }
-  return self;
-}
-
 @end
 
 @implementation CRState
@@ -57,6 +41,9 @@ - (void)onMount {
 
 #pragma mark - StatelessController
 
+@implementation CRNullState
+@end
+
 @implementation CRStatelessController
 
 + (BOOL)isStateless {
```

**File**: `objc/src/CRNode.h` (modified, +4/-9)
```diff
@@ -58,39 +58,34 @@ NS_SWIFT_NAME(ConcreteNode)
 #pragma mark Constructors
 
 - (instancetype)initWithType:(Class)type
-                       props:(nullable CRProps *)props
              reuseIdentifier:(nullable NSString *)reuseIdentifier
                          key:(nullable NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
 + (instancetype)nodeWithType:(Class)type
-                       props:(nullable CRProps *)props
              reuseIdentifier:(NSString *)reuseIdentifier
                          key:(nullable NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
 + (instancetype)nodeWithType:(Class)type
-                       props:(nullable CRProps *)props
                          key:(nullable NSString *)key
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
 + (instancetype)nodeWithType:(Class)type
-                       props:(nullable CRProps *)props
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
-+ (instancetype)nodeWithType:(Class)type
-                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
-
-
 #pragma mark Setup
 
 /// Adds the nodes as children of this node.
 - (instancetype)appendChildren:(NSArray<CRNode *> *)children;
 
+/// Bind this node to the @c CRController class passed as argument.
+- (instancetype)bindController:(Class)controllerType withProps:(nullable CRProps *)props;
+
 /// Register the context for the root node of this node hierarchy.
-- (void)registerInContext:(CRContext *)context;
+- (void)buildNodeHierarchyInContext:(CRContext *)context;
 
 #pragma mark Render
 
```

**File**: `objc/src/CRNode.mm` (modified, +35/-37)
```diff
@@ -26,30 +26,12 @@ @implementation CRNode {
 #pragma mark - Initializer
 
 - (instancetype)initWithType:(Class)type
-                       props:(nullable CRProps *)props
              reuseIdentifier:(NSString *)reuseIdentifier
                          key:(NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   if (self = [super init]) {
     _reuseIdentifier = CR_NIL_COALESCING(reuseIdentifier, NSStringFromClass(type));
-    _props = props;
-    const auto controllerType = [_props controllerType];
-    if (controllerType) {
-      if([controllerType isSubclassOfClass:CRController.class]) {
-        if (key) {
-          if ([controllerType isStateless])
-            CRIllegalControllerTypeException(@"Nodes with key require a statefui controller.");
-          _controllerType = controllerType;
-        } else {
-          if (![controllerType isStateless])
-            CRIllegalControllerTypeException(@"Nodes without key require a stateless controller.");
-          _controllerType = controllerType;
-        }
-      } else {
-        CRIllegalControllerTypeException(@"Must be a subclass of CRController.");
-      }
-    }
     _key = key;
     _viewType = type;
     _mutableChildren = [[NSMutableArray alloc] init];
@@ -62,46 +44,30 @@ - (instancetype)initWithType:(Class)type
 #pragma mark - Convenience Initializer
 
 + (instancetype)nodeWithType:(Class)type
-                       props:(nullable CRProps *)props
              reuseIdentifier:(NSString *)reuseIdentifier
                          key:(nullable NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   return [[CRNode alloc] initWithType:type
-                                props:props
                       reuseIdentifier:reuseIdentifier
                                   key:key
                    viewInitialization:viewInitialization
                            layoutSpec:layoutSpec];
 }
 
 + (instancetype)nodeWithType:(Class)type
-                       props:(nullable CRProps *)props
                          key:(nullable NSString *)key
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   return [[CRNode alloc] initWithType:type
-                                props:props
                       reuseIdentifier:nil
                                   key:key
                    viewInitialization:nil
                            layoutSpec:layoutSpec];
 }
 
 + (instancetype)nodeWithType:(Class)type
-                       props:(nullable CRProps *)props
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   return [[CRNode alloc] initWithType:type
-                                props:props
-                      reuseIdentifier:nil
-                                  key:nil
-                   viewInitialization:nil
-                           layoutSpec:layoutSpec];
-}
-
-+ (instancetype)nodeWithType:(Class)type
-                  layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
-  return [[CRNode alloc] initWithType:type
-                                props:nil
                       reuseIdentifier:nil
                                   key:nil
                    viewInitialization:nil
@@ -110,9 +76,20 @@ + (instancetype)nodeWithType:(Class)type
 
 #pragma mark - Context
 
-- (void)registerInContext:(CRContext *)context {
-  if (!_parent) _context = context;
-  else [_parent registerInContext:context];
+- (void)buildNodeHierarchyInContext:(CRContext *)context {
+  CR_ASSERT_ON_MAIN_THREAD;
+  if (!_parent) {
+    _context = context;
+    [self _recursivelyConfigureControllersInNodeHierarchy];
+  }
+  else [_parent buildNodeHierarchyInContext:context];
+}
+
+- (void)_recursivelyConfigureControllersInNodeHierarchy {
+  self.controller.props = self.props;
+  foreach(child, _mutableChildren) {
+    [child _recursivelyConfigureControllersInNodeHierarchy];
+  }
 }
 
 - (CRContext *)context {
@@ -143,6 +120,27 @@ - (instancetype)appendChildren:(NSArray<CRNode *> *)children {
   return self;
 }
 
+- (instancetype)bindController:(Class)controllerType withProps:(CRProps *)props {
+  CR_ASSERT_ON_MAIN_THREAD;
+  _props = props;
+  if (controllerType) {
+    if([controllerType isSubclassOfClass:CRController.class]) {
+      if (_key) {
+        if ([controllerType isStateless])
+          CRIllegalControllerTypeException(@"Nodes with key require a statefui controller.");
+        _controllerType = controllerType;
+      } else {
+        if (![controllerType isStateless])
+          CRIllegalControllerTypeException(@"Nodes without key require a stateless controller.");
+        _controllerType = controllerType;
+      }
+    } else {
+      CRIllegalControllerTypeException(@"Must be a subclass of CRController.");
+    }

```

**File**: `objc/src/CRNodeLayoutSpec.mm` (modified, +1/-2)
```diff
@@ -23,8 +23,7 @@ - (instancetype)initWithNode:(CRNode*)node constrainedToSize:(CGSize)size {
     _view = node.renderedView;
     _context = node.context;
     _controller = node.controller;
-    _props = _controller.props;
-    NSAssert(_props.controllerType == _controller.class, @"");
+    _props = node.props;
     _state = _controller.state;
     _size = size;
   }
```

---

### Incident Patch 10: `36fbd630` (2018-08-03)
**Commit Message**: corerender

**File**: `objc/src/CRController+Private.h` (modified, +5/-5)
```diff
@@ -1,14 +1,14 @@
-#ifndef CRController_Private_h
-#define CRController_Private_h
+#import <Foundation/Foundation.h>
 
-@interface CRController ()
+NS_ASSUME_NONNULL_BEGIN
+
+@interface CRController <P, S> ()
 // Private setter modifiers
 @property(nonatomic, readwrite) NSString *key;
-
 /// @note: Never call the init method manually - controllers are dynamically constructed,
 /// disposed and reused by @c CRContext.
 - (instancetype)initWithKey:(NSString*)key;
 
 @end
 
-#endif /* CRController_Private_h */
+NS_ASSUME_NONNULL_END
```

**File**: `objc/src/CRController.h` (modified, +8/-4)
```diff
@@ -2,12 +2,15 @@
 
 NS_ASSUME_NONNULL_BEGIN
 
-extern  NSString *CRControllerStatelessKey;
+extern NSString *CRControllerStatelessKey;
 
-/// Represents the properties that are externally injected to a controller.
-/// This may contains controller settings, model objects, delegates or injectable services.
+/// Represents the properties that are externally injected into the controller.
+/// This may contains *arguments*, *model objects*, *delegates* or *injectable services*.
 NS_SWIFT_NAME(Props)
 @interface CRProps : NSObject
+/// The class of the controller associated to this.
+/// @note: Subclasses must override this class property.
+@property(nonatomic, readonly) Class controllerType;
 @end
 
 /// Represents the internal state of a controller.
@@ -31,8 +34,8 @@ NS_SWIFT_NAME(Controller)
 /// The current controller state.
 @property(nonatomic, readwrite) S state;
 
+/// Controllers are instantiated from @c CRContext.
 - (instancetype)init NS_UNAVAILABLE;
-
 /// Called whenever the controller is constructed.
 - (void)onInit;
 /// The UI node  associated to this controller has just been added to the view hierarchy.
@@ -41,6 +44,7 @@ NS_SWIFT_NAME(Controller)
 
 @end
 
+/// Represents a null empty state - used to model @c CRStatelessController.
 NS_SWIFT_NAME(NullState)
 @interface CRNullState: CRState
 @end
```

**File**: `objc/src/CRController.mm` (modified, +25/-2)
```diff
@@ -2,13 +2,34 @@
 #import "CRController+Private.h"
 
 NSString *CRControllerStatelessKey = @"_CRControllerStatelessKey";
+NSString *CRIllegalControllerTypeExceptionName = @"IllegalControllerType";
+
+#pragma mark - Props & State
 
 @implementation CRProps
+- (Class)controllerType {
+  [NSException raise:CRIllegalControllerTypeExceptionName
+              format:@"Subclasses must return the desired CRController subclass."];
+  return nil;
+}
+
+- (instancetype)init {
+  if (self = [super init]) {
+    if (![self.controllerType isSubclassOfClass:CRController.self]) {
+      [NSException raise:CRIllegalControllerTypeExceptionName
+                  format:@"controllerType must be a subclass of CRController."];
+    }
+  }
+  return self;
+}
+
 @end
 
 @implementation CRState
 @end
 
+#pragma mark - Controller
+
 @implementation CRController
 // By default controllers are *stateful*.
 // Override @c CRStatelessController for a *stateless* controller.
@@ -25,15 +46,17 @@ - (instancetype)initWithKey:(NSString *)key {
 }
 
 - (void)onInit {
-
+  // Override in subclasses.
 }
 
 - (void)onMount {
-
+  // Override in subclasses.
 }
 
 @end
 
+#pragma mark - StatelessController
+
 @implementation CRStatelessController
 
 + (BOOL)isStateless {
```

**File**: `objc/src/CRNode.h` (modified, +12/-6)
```diff
@@ -46,32 +46,38 @@ NS_SWIFT_NAME(ConcreteNode)
 @property(nonatomic, readonly, nullable) V renderedView;
 /// The layout delegate for this node.
 @property(nonatomic, nullable, weak) id<CRNodeDelegate> delegate;
-/// The associated controller.
-@property(nonatomic, nullable) Class controllerType;
+/// The type of the associated controller.
+@property(nonatomic, nullable, readonly) Class controllerType;
+/// Returns the associated controller.
+/// @note: @c nil if this node hierarchy is not registered to any @c CRContext, or if
+/// @c controllerType is @c nil.
+@property(nonatomic, nullable, readonly) __kindof CRController *controller;
+/// Represents the properties that are externally injected into the controller.
+@property(nonatomic, nullable, readonly) __kindof CRProps *props;
 
 #pragma mark Constructors
 
 - (instancetype)initWithType:(Class)type
-                  controller:(nullable Class)controllerType
+                       props:(nullable CRProps *)props
              reuseIdentifier:(nullable NSString *)reuseIdentifier
                          key:(nullable NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
 + (instancetype)nodeWithType:(Class)type
-                  controller:(nullable Class)controllerType
+                       props:(nullable CRProps *)props
              reuseIdentifier:(NSString *)reuseIdentifier
                          key:(nullable NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
 + (instancetype)nodeWithType:(Class)type
-                  controller:(nullable Class)controllerType
+                       props:(nullable CRProps *)props
                          key:(nullable NSString *)key
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
 + (instancetype)nodeWithType:(Class)type
-                  controller:(nullable Class)controllerType
+                       props:(nullable CRProps *)props
                   layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
 
 + (instancetype)nodeWithType:(Class)type
```

**File**: `objc/src/CRNode.mm` (modified, +17/-8)
```diff
@@ -26,13 +26,15 @@ @implementation CRNode {
 #pragma mark - Initializer
 
 - (instancetype)initWithType:(Class)type
-                  controller:(Class)controllerType
+                       props:(nullable CRProps *)props
              reuseIdentifier:(NSString *)reuseIdentifier
                          key:(NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   if (self = [super init]) {
     _reuseIdentifier = CR_NIL_COALESCING(reuseIdentifier, NSStringFromClass(type));
+    _props = props;
+    const auto controllerType = [_props controllerType];
     if (controllerType) {
       if([controllerType isSubclassOfClass:CRController.class]) {
         if (key) {
@@ -60,36 +62,36 @@ - (instancetype)initWithType:(Class)type
 #pragma mark - Convenience Initializer
 
 + (instancetype)nodeWithType:(Class)type
-                  controller:(Class)controllerType
+                       props:(nullable CRProps *)props
              reuseIdentifier:(NSString *)reuseIdentifier
                          key:(nullable NSString *)key
           viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   return [[CRNode alloc] initWithType:type
-                           controller:controllerType
+                                props:props
                       reuseIdentifier:reuseIdentifier
                                   key:key
                    viewInitialization:viewInitialization
                            layoutSpec:layoutSpec];
 }
 
 + (instancetype)nodeWithType:(Class)type
-                  controller:(Class)controllerType
+                       props:(nullable CRProps *)props
                          key:(nullable NSString *)key
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   return [[CRNode alloc] initWithType:type
-                           controller:controllerType
+                                props:props
                       reuseIdentifier:nil
                                   key:key
                    viewInitialization:nil
                            layoutSpec:layoutSpec];
 }
 
 + (instancetype)nodeWithType:(Class)type
-                  controller:(Class)controllerType
+                       props:(nullable CRProps *)props
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   return [[CRNode alloc] initWithType:type
-                           controller:controllerType
+                                props:props
                       reuseIdentifier:nil
                                   key:nil
                    viewInitialization:nil
@@ -99,7 +101,7 @@ + (instancetype)nodeWithType:(Class)type
 + (instancetype)nodeWithType:(Class)type
                   layoutSpec:(void (^)(CRNodeLayoutSpec<UIView *> *))layoutSpec {
   return [[CRNode alloc] initWithType:type
-                           controller:nil
+                                props:nil
                       reuseIdentifier:nil
                                   key:nil
                    viewInitialization:nil
@@ -118,6 +120,13 @@ - (CRContext *)context {
   return _parent.context;
 }
 
+- (__kindof CRController *)controller {
+  if (!_controllerType || !_context) return nil;
+  return _key != nil
+    ? [_context controllerOfType:_controllerType withKey:_key]
+    : [_context controllerOfType:_controllerType];
+}
+
 #pragma mark - Children
 
 - (NSArray<CRNode *> *)children {
```

**File**: `objc/src/CRNodeLayoutSpec.h` (modified, +7/-0)
```diff
@@ -10,6 +10,13 @@ NS_SWIFT_NAME(LayoutSpec)
 @property (nonatomic, readonly, nullable, weak) CRNode *node;
 /// The context for this node hierarchy.
 @property (nonatomic, readonly, nullable, weak) CRContext *context;
+/// The controller managing this node subtree.
+@property (nonatomic, readonly, nullable, weak) __kindof CRController *controller;
+/// The props passed down to this node.
+@property (nonatomic, readonly, nullable, weak) __kindof CRProps *props;
+/// The current state of the controller.
+@property (nonatomic, readonly, nullable, weak) __kindof CRState *state;
+
 /// The boundaries of this node.
 @property (nonatomic, readonly) CGSize size;
 
```

**File**: `objc/src/CRNodeLayoutSpec.mm` (modified, +4/-0)
```diff
@@ -22,6 +22,10 @@ - (instancetype)initWithNode:(CRNode*)node constrainedToSize:(CGSize)size {
     _node = node;
     _view = node.renderedView;
     _context = node.context;
+    _controller = node.controller;
+    _props = _controller.props;
+    NSAssert(_props.controllerType == _controller.class, @"");
+    _state = _controller.state;
     _size = size;
   }
   return self;
```

**File**: `objc/src/CRSwiftBridge.swift` (modified, +4/-2)
```diff
@@ -3,9 +3,11 @@ import UIKit
 // Convenience type-erased protocols.
 public protocol NodeProtocol: class { }
 public protocol ControllerProtocol: class {}
+@objc public protocol PropsProtocol: class {}
 
 extension ConcreteNode: NodeProtocol { }
 extension Controller: ControllerProtocol { }
+extension Props: PropsProtocol { }
 
 /// Swift-only extensions.
 public extension NodeProtocol {
@@ -43,15 +45,15 @@ public extension NodeProtocol {
 @inline(__always)
 public func Node<V: UIView> (
   type: V.Type,
-  controller: AnyClass? = nil,
+  props: PropsProtocol? = nil,
   reuseIdentifier: String? = nil,
   key: String? = nil,
   create: (() -> V)? = nil,
   layoutSpec: @escaping (LayoutSpec<V>) -> Void
 ) -> ConcreteNode<V> {
   return ConcreteNode<V>(
     type: V.self,
-    controller: controller,
+    props: props as? Props,
     reuseIdentifier: reuseIdentifier,
     key: key,
     viewInitialization: create,
```

---

### Incident Patch 11: `1a3c090d` (2018-07-26)
**Commit Message**: Google Swift-Style guide adherence (https://google.github.io/swift/)

**File**: `bin/RenderNeutrino.framework/_CodeSignature/CodeResources` (modified, +15/-30)
```diff
@@ -10,7 +10,7 @@
 		</data>
 		<key>Headers/RenderNeutrino-Swift.h</key>
 		<data>
-		RePtVKT9kXuX8DGz6V7sVHjMuA8=
+		pz+R/04pQ/7CZuOHpLJlqx8hifE=
 		</data>
 		<key>Headers/RenderNeutrino.h</key>
 		<data>
@@ -56,25 +56,21 @@
 		<data>
 		/IKT3xCA3lBKnsJ4foW2m8nPF/E=
 		</data>
-		<key>Modules/RenderNeutrino.swiftmodule/.BC.T_Kv6jQ6</key>
-		<data>
-		ac3lsQVfyFlCE3qfwb8wY2ZV5UM=
-		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftdoc</key>
 		<data>
-		z5LgChv3lrg2LouYJdGHAdAbIFY=
+		mgYep88YP0oMn9VPtlwfdPm2998=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftmodule</key>
 		<data>
-		RHb1itq87P0ZUsYTvEbkhucTwXc=
+		1TIcIGTK60k95ycAoU6fWAE/GIU=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftdoc</key>
 		<data>
-		kbb5/yOiTFuv54RM7UUhNqWU0XE=
+		jluSVUlA5XkRUy7Sl25GqcsUAOQ=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftmodule</key>
 		<data>
-		PGUH4EoSTxIWBMDbRf0NHXwhceA=
+		VqNS0lr6Jk2f8k2s9M+7Cyrsn7E=
 		</data>
 		<key>Modules/module.modulemap</key>
 		<data>
@@ -98,11 +94,11 @@
 		<dict>
 			<key>hash</key>
 			<data>
-			RePtVKT9kXuX8DGz6V7sVHjMuA8=
+			pz+R/04pQ/7CZuOHpLJlqx8hifE=
 			</data>
 			<key>hash2</key>
 			<data>
-			Cxc2X+gyGlb+IT6r1DBRpRkKRPJBcEqPGGJTYzpR6RA=
+			tVoApLGSZGA0RdOVug1773QN2oanKHt1XCAWluLUntQ=
 			</data>
 		</dict>
 		<key>Headers/RenderNeutrino.h</key>
@@ -215,59 +211,48 @@
 			OQIF5ergmz2uAw/u900rYcTR0evRWj45TNK4lviOMr8=
 			</data>
 		</dict>
-		<key>Modules/RenderNeutrino.swiftmodule/.BC.T_Kv6jQ6</key>
-		<dict>
-			<key>hash</key>
-			<data>
-			ac3lsQVfyFlCE3qfwb8wY2ZV5UM=
-			</data>
-			<key>hash2</key>
-			<data>
-			Fr66Uy0n17SmzAYX+0J19rOwDCyxPCavvcEcHTGkSjY=
-			</data>
-		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftdoc</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			z5LgChv3lrg2LouYJdGHAdAbIFY=
+			mgYep88YP0oMn9VPtlwfdPm2998=
 			</data>
 			<key>hash2</key>
 			<data>
-			YPaRV2fpI+vmYVaIDJ5YGqJYmf6UDQlBDTsW1Npa3MA=
+			Zx4Hqm1mY9z3yElRxaOCT7+W7cdH/KSiZKnyhBkOMyU=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			RHb1itq87P0ZUsYTvEbkhucTwXc=
+			1TIcIGTK60k95ycAoU6fWAE/GIU=
 			</data>
 			<key>hash2</key>
 			<data>
-			68J26qMxzOsWTUKutgVbl1bugl2lO5yuWA7eXOu5Wqg=
+			nJS4jVZ1+tQtff19obJ16h7d87SCo3Cbbr7eoEJZFmQ=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftdoc</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			kbb5/yOiTFuv54RM7UUhNqWU0XE=
+			jluSVUlA5XkRUy7Sl25GqcsUAOQ=
 			</data>
 			<key>hash2</key>
 			<data>
-			6ZD2KmkXzpCgDlhgOEmqrc/og6SjsJeKpAa/JJ3DsW8=
+			UFZau96NYqo9bUerO9F8w5m9rCLtqtlSt7zs9GXiyfs=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			PGUH4EoSTxIWBMDbRf0NHXwhceA=
+			VqNS0lr6Jk2f8k2s9M+7Cyrsn7E=
 			</data>
 			<key>hash2</key>
 			<data>
-			dVozTwaqhKZO3DeJYCoqaqGFxNKkowTb0plkX1r2nPQ=
+			7e6qAIpQtUCRsOSxMYhS2YjTuyJQUBTb6kNCIPuMlXE=
 			</data>
 		</dict>
 		<key>Modules/module.modulemap</key>
```

**File**: `demo/src/components/AppStoreEntry.swift` (modified, +27/-17)
```diff
@@ -26,19 +26,23 @@ struct AppStoreEntry {
           // Lays out the icon and the title.
           UINode<UIView>(layoutSpec: configureRowContainer).children([
             makePolygon(),
-            makeLabel(text: "\(props.title)#\(state.counter)",
-                      layoutSpec: configureLabel),
+            makeLabel(
+              text: "\(props.title)#\(state.counter)",
+              layoutSpec: configureLabel),
             ]),
           // Entry description (shown when the component is expanded).
           UINode<UIView>(layoutSpec: configureDescriptionContainer).children([
-            makeLabel(text: props.desc,
-                      layoutSpec: configureDescriptionLabel),
-            makeButton(text: "Increase",
-                       onTouchUpInside: { [weak self] in self?.onIncrease() })
+            makeLabel(
+              text: props.desc,
+              layoutSpec: configureDescriptionLabel),
+            makeButton(
+              text: "Increase",
+              onTouchUpInside: { [weak self] in self?.onIncrease() })
             ]),
           // Touch overlay that covers the whole component.
-          makeTapRecognizer(onTouchUpInside: { [weak self] in self?.onToggleExpand() },
-                            layoutSpec: configureTappableView),
+          makeTapRecognizer(
+            onTouchUpInside: { [weak self] in self?.onToggleExpand() },
+            layoutSpec: configureTappableView),
           ])
       ])
     }
@@ -157,8 +161,10 @@ struct AppStoreEntry {
 
 // MARK: - Private
 
-fileprivate func makeLabel(text: String,
-                           layoutSpec: UINode<UILabel>.LayoutSpecClosure?=nil) -> UINode<UILabel> {
+fileprivate func makeLabel(
+  text: String,
+  layoutSpec: UINode<UILabel>.LayoutSpecClosure? = nil
+) -> UINode<UILabel> {
   return UINode<UILabel> { config in
     config.set(\UILabel.text, text)
     config.set(\UILabel.numberOfLines, 0)
@@ -167,10 +173,12 @@ fileprivate func makeLabel(text: String,
   }
 }
 
-fileprivate func makeButton(reuseIdentifier: String = "button",
-                            text: String,
-                            onTouchUpInside: @escaping () -> Void = { },
-                            layoutSpec: UINode<UIButton>.LayoutSpecClosure?=nil) -> UINode<UIButton> {
+fileprivate func makeButton(
+  reuseIdentifier: String = "button",
+  text: String,
+  onTouchUpInside: @escaping () -> Void = { },
+  layoutSpec: UINode<UIButton>.LayoutSpecClosure? = nil
+) -> UINode<UIButton> {
   func makeButton() -> UIButton {
     let view = UIButton()
     view.backgroundColorImage = S.palette.white.color
@@ -187,9 +195,11 @@ fileprivate func makeButton(reuseIdentifier: String = "button",
   }
 }
 
-fileprivate func makeTapRecognizer(reuseIdentifier: String = "tapRecognizer",
-                                   onTouchUpInside: @escaping () -> Void = { },
-                                   layoutSpec: UINode<UIView>.LayoutSpecClosure?=nil)->UINode<UIView> {
+fileprivate func makeTapRecognizer(
+  reuseIdentifier: String = "tapRecognizer",
+  onTouchUpInside: @escaping () -> Void = { },
+  layoutSpec: UINode<UIView>.LayoutSpecClosure? = nil
+)->UINode<UIView> {
   return UINode<UIView>(reuseIdentifier: reuseIdentifier) { config in
     config.view.onTap { _ in onTouchUpInside() }
     layoutSpec?(config)
```

**File**: `demo/src/components/Counter.swift` (modified, +3/-2)
```diff
@@ -14,8 +14,9 @@ struct StylesheetCounter {
       let node =  UINode<UIView>(styles: [S.counterWrapper])
       return node.children([
         UINode<UILabel>(styles: [S.counterLabel], layoutSpec: configureLabel),
-        UINode<UIButton>(styles: [S.counterButton],
-                         layoutSpec: configureButton)
+        UINode<UIButton>(
+          styles: [S.counterButton],
+          layoutSpec: configureButton)
       ])
     }
 
```

**File**: `demo/src/components/FacebookPost.swift` (modified, +19/-13)
```diff
@@ -39,8 +39,9 @@ struct Post {
     /// Builds the node hierarchy for this component.
     override func render(context: UIContextProtocol) -> UINodeProtocol {
       // Styles.
-      return UINode<UIView>(reuseIdentifier: S.postWrapper.id,
-                            styles: [S.postWrapper]).children([
+      return UINode<UIView>(
+        reuseIdentifier: S.postWrapper.id,
+        styles: [S.postWrapper]).children([
         makeHeaderFragment(),
         makeBodyFragment(),
         makeAttachmentFragment(),
@@ -52,8 +53,9 @@ struct Post {
     /// Returns the author avatar and fullname fragment.
     private func makeHeaderFragment() -> UINode<UIView> {
       let props = self.props
-      let header = UINode<UIView>(reuseIdentifier: S.postHeader.id,
-                                  styles: [S.postHeader])
+      let header = UINode<UIView>(
+        reuseIdentifier: S.postHeader.id,
+        styles: [S.postHeader])
       let headerTextWrapper = UINode<UIView>(styles: [S.postHeaderTextWrapper])
       return header.children([
         UINode<UIImageView>(styles: [S.postAvatar]){ $0.set(\UIImageView.image, props.avatar)},
@@ -88,8 +90,9 @@ struct Post {
     // The section with the number of comments and likes for this post.
     private func makeStatsFragment() -> UINodeProtocol {
       let props = self.props
-      let wrapper = UINode<UIView>(reuseIdentifier: S.postStats.id,
-                                   styles: [S.postStats]) {
+      let wrapper = UINode<UIView>(
+        reuseIdentifier: S.postStats.id,
+        styles: [S.postStats]) {
         $0.view.onTap { [weak self] _ in
           guard let `self` = self, props.fetchStatus == .notFetched else { return }
           props.delegate?.fetchComments(component: self, post: props)
@@ -117,12 +120,14 @@ struct Post {
           $0.set(\UILabel.text, "Loading...")
         }
       case .fetched:
-        let wrapper = UINode<UIView>(reuseIdentifier: S.postCommentsWrapper.id,
-                                     styles: [S.postCommentsWrapper])
+        let wrapper = UINode<UIView>(
+          reuseIdentifier: S.postCommentsWrapper.id,
+          styles: [S.postCommentsWrapper])
         wrapper.children(props.comments.map {
-          context.transientComponent(CommentComponent.self,
-                                     props: $0,
-                                     parent: self).asNode()
+          context.transientComponent(
+            CommentComponent.self,
+            props: $0,
+            parent: self).asNode()
         })
         return wrapper
       }
@@ -137,8 +142,9 @@ struct Post {
     /// Builds the node hierarchy for this component.
     override func render(context: UIContextProtocol) -> UINodeProtocol {
       let props = self.props
-      return UINode<UIView>(reuseIdentifier: S.postComment.id,
-                            styles: [S.postComment]).children([
+      return UINode<UIView>(
+        reuseIdentifier: S.postComment.id,
+        styles: [S.postComment]).children([
         UINode<UILabel>(styles: [S.postCommentAuthor]) { $0.set(\UILabel.text, props.author) },
         UINode<UILabel>(styles: [S.postCommentLabel]) { $0.set(\UILabel.text, props.text) }
       ])
```

**File**: `demo/src/components/GettingStarted.swift` (modified, +12/-8)
```diff
@@ -163,10 +163,12 @@ class SimpleCounterComponent4: UIComponent<CounterState, CounterProps> {
 
   /// Builds the node hierarchy for this component.
   override func render(context: UIContextProtocol) -> UINodeProtocol {
-    let container = UINode<UIView>(styles: [Style.specContainer],
-                                   layoutSpec: containerLayoutSpec)
-    let label = UINode<UILabel>(styles: [Style.specLabel],
-                                layoutSpec: labelLayoutSpec)
+    let container = UINode<UIView>(
+      styles: [Style.specContainer],
+      layoutSpec: containerLayoutSpec)
+    let label = UINode<UILabel>(
+      styles: [Style.specLabel],
+      layoutSpec: labelLayoutSpec)
     return container.children([
       label,
     ])
@@ -192,10 +194,12 @@ class SimpleCounterComponent5: UIComponent<CounterState, CounterProps> {
 
   /// Builds the node hierarchy for this component.
   override func render(context: UIContextProtocol) -> UINodeProtocol {
-    let container = UINode<UIView>(styles: [S.simpleContainer],
-                                   layoutSpec: containerLayoutSpec)
-    let label = UINode<UILabel>(styles: [S.simpleLabel],
-                                layoutSpec: labelLayoutSpec)
+    let container = UINode<UIView>(
+      styles: [S.simpleContainer],
+      layoutSpec: containerLayoutSpec)
+    let label = UINode<UILabel>(
+      styles: [S.simpleLabel],
+      layoutSpec: labelLayoutSpec)
     return container.children([
       label,
       ])
```

**File**: `render/mods/inspector/src/Inspector.swift` (modified, +28/-21)
```diff
@@ -100,9 +100,10 @@ extension UINodeProtocol {
 
   public enum KeyCommands {
     private static var __once: () = {
-      exchangeImplementations(class: UIApplication.self,
-                              originalSelector: #selector(getter: UIResponder.keyCommands),
-                              swizzledSelector: #selector(UIApplication.KYC_keyCommands));
+      exchangeImplementations(
+        class: UIApplication.self,
+        originalSelector: #selector(getter: UIResponder.keyCommands),
+        swizzledSelector: #selector(UIApplication.KYC_keyCommands));
     }()
     fileprivate struct Static {
       static var token: Int = 0
@@ -117,10 +118,11 @@ extension UINodeProtocol {
                                 modifierFlags: KeyModifierFlags,
                                 action: @escaping () -> ()) {
       _ = KeyCommands.__once
-      let keyCommand = UIKeyCommand(input: input,
-                                    modifierFlags: modifierFlags,
-                                    action: #selector(UIApplication.KYC_handleKeyCommand(_:)),
-                                    discoverabilityTitle: "")
+      let keyCommand = UIKeyCommand(
+        input: input,
+        modifierFlags: modifierFlags,
+        action: #selector(UIApplication.KYC_handleKeyCommand(_:)),
+        discoverabilityTitle: "")
       let actionableKeyCommand = KeyActionableCommand(keyCommand: keyCommand, actionBlock: action)
       let index = KeyCommandsRegister.sharedInstance.actionableKeyCommands.index(
         where: { return $0 == actionableKeyCommand })
@@ -155,24 +157,28 @@ extension UINodeProtocol {
     }
   }
 
-  func exchangeImplementations(class classs: AnyClass,
-                               originalSelector: Selector,
-                               swizzledSelector: Selector ){
+  func exchangeImplementations(
+    class classs: AnyClass,
+    originalSelector: Selector,
+    swizzledSelector: Selector
+  ) -> Void {
     let originalMethod = class_getInstanceMethod(classs, originalSelector)
     let originalMethodImplementation = method_getImplementation(originalMethod!)
     let originalMethodTypeEncoding = method_getTypeEncoding(originalMethod!)
     let swizzledMethod = class_getInstanceMethod(classs, swizzledSelector)
     let swizzledMethodImplementation = method_getImplementation(swizzledMethod!)
     let swizzledMethodTypeEncoding = method_getTypeEncoding(swizzledMethod!)
-    let didAddMethod = class_addMethod(classs,
-                                       originalSelector,
-                                       swizzledMethodImplementation,
-                                       swizzledMethodTypeEncoding)
+    let didAddMethod = class_addMethod(
+      classs,
+      originalSelector,
+      swizzledMethodImplementation,
+      swizzledMethodTypeEncoding)
     if didAddMethod {
-      class_replaceMethod(classs,
-                          swizzledSelector,
-                          originalMethodImplementation,
-                          originalMethodTypeEncoding)
+      class_replaceMethod(
+        classs,
+        swizzledSelector,
+        originalMethodImplementation,
+        originalMethodTypeEncoding)
     } else {
       method_exchangeImplementations(originalMethod!, swizzledMethod!)
     }
@@ -182,9 +188,10 @@ extension UINodeProtocol {
   public typealias KeyModifierFlags = Int
 
   public enum KeyCommands {
-    public static func register(input: String,
-                                modifierFlags: KeyModifierFlags,
-                                action: () -> ()) {}
+    public static func register(
+      input: String,
+      modifierFlags: KeyModifierFlags,
+      action: () -> ()) {}
     public static func unregister(input: String, modifierFlags: KeyModifierFlags) {}
   }
 #endif
```

**File**: `render/mods/stylesheet/deps/Expression.swift` (modified, +7/-8)
```diff
@@ -1487,7 +1487,7 @@ public struct AnyExpression: CustomStringConvertible {
     constants: [String: Any] = [:],
     symbols: [Symbol: SymbolEvaluator] = [:],
     evaluator: Evaluator? = nil
-    ) {
+  ) {
     self.init(
       Expression.parse(expression),
       options: options,
@@ -1620,13 +1620,12 @@ public struct AnyExpression: CustomStringConvertible {
     description = expression.description
 
     // Build Expression
-    let expression = Expression(expression,
-                                options: options
-                                  .subtracting(.boolSymbols)
-                                  .union(.pureSymbols),
-                                constants: numericConstants,
-                                arrays: arrayConstants,
-                                symbols: pureSymbols) { symbol, args in
+    let expression = Expression(
+      expression,
+      options: options.subtracting(.boolSymbols).union(.pureSymbols),
+      constants: numericConstants,
+      arrays: arrayConstants,
+      symbols: pureSymbols) { symbol, args in
         var stored = false
         let anyArgs: [Any] = args.map {
           if let value = load($0) {
```

**File**: `render/mods/stylesheet/src/Stylesheet.swift` (modified, +4/-2)
```diff
@@ -289,8 +289,10 @@ public class UIStylesheetRule: CustomStringConvertible {
 
   /// Returns the rule value as the desired return type.
   /// - note: The enum type should be backed by an integer store.
-  public func `enum`<T: UIStylesheetRepresentableEnum>(_ type: T.Type,
-                                                       default: T = T.init(rawValue: 0)!) -> T {
+  public func `enum`<T: UIStylesheetRepresentableEnum>(
+    _ type: T.Type,
+    default: T = T.init(rawValue: 0)!
+  ) -> T {
     return T.init(rawValue: integer) ?? `default`
   }
 
```

---

### Incident Patch 12: `922e59dc` (2018-07-09)
**Commit Message**: minor fixes

**File**: `tools/src/inspector/dist/electron-builder-effective-config.yaml` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-directories:
-  output: dist
-  buildResources: build
-appId: io.render.inspector
-mac:
-  category: development
-electronVersion: 2.0.2
```

**File**: `tools/src/inspector/dist/mac/render-inspector.app/Contents/Frameworks/Electron Framework.framework/Electron Framework` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-Versions/Current/Electron Framework
\ No newline at end of file
```

**File**: `tools/src/inspector/dist/mac/render-inspector.app/Contents/Frameworks/Electron Framework.framework/Libraries` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-Versions/Current/Libraries
\ No newline at end of file
```

**File**: `tools/src/inspector/dist/mac/render-inspector.app/Contents/Frameworks/Electron Framework.framework/Resources` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-Versions/Current/Resources
\ No newline at end of file
```

**File**: `tools/src/inspector/dist/mac/render-inspector.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/Info.plist` (removed, +0/-26)
```diff
@@ -1,26 +0,0 @@
-<?xml version="1.0" encoding="UTF-8"?>
-<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
-<plist version="1.0">
-<dict>
-	<key>BuildMachineOSBuild</key>
-	<string>16G1314</string>
-	<key>CFBundleExecutable</key>
-	<string>Electron Framework</string>
-	<key>CFBundleIdentifier</key>
-	<string>com.github.electron.framework</string>
-	<key>CFBundleName</key>
-	<string>Electron Framework</string>
-	<key>CFBundlePackageType</key>
-	<string>FMWK</string>
-	<key>DTSDKBuild</key>
-	<string>14D125</string>
-	<key>DTSDKName</key>
-	<string>macosx10.1010.10</string>
-	<key>DTXcode</key>
-	<string>0833</string>
-	<key>DTXcodeBuild</key>
-	<string>8E3004b</string>
-	<key>NSSupportsAutomaticGraphicsSwitching</key>
-	<true/>
-</dict>
-</plist>
```

**File**: `tools/src/inspector/dist/mac/render-inspector.app/Contents/Frameworks/Electron Framework.framework/Versions/Current` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-A
\ No newline at end of file
```

**File**: `tools/src/inspector/dist/mac/render-inspector.app/Contents/Frameworks/Mantle.framework/Headers` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-Versions/Current/Headers
\ No newline at end of file
```

**File**: `tools/src/inspector/dist/mac/render-inspector.app/Contents/Frameworks/Mantle.framework/Mantle` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-Versions/Current/Mantle
\ No newline at end of file
```

---

### Incident Patch 13: `c94d29f9` (2018-07-09)
**Commit Message**: minor fixes

**File**: `tools/src/inspector/node_modules/.bin/build` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../electron-builder/out/cli/cli.js
\ No newline at end of file
```

**File**: `tools/src/inspector/node_modules/.bin/electron` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../electron/cli.js
\ No newline at end of file
```

**File**: `tools/src/inspector/node_modules/.bin/electron-builder` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../electron-builder/out/cli/cli.js
\ No newline at end of file
```

**File**: `tools/src/inspector/node_modules/.bin/electron-download` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../electron-download/build/cli.js
\ No newline at end of file
```

**File**: `tools/src/inspector/node_modules/.bin/electron-osx-flat` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../electron-osx-sign/bin/electron-osx-flat.js
\ No newline at end of file
```

**File**: `tools/src/inspector/node_modules/.bin/electron-osx-sign` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../electron-osx-sign/bin/electron-osx-sign.js
\ No newline at end of file
```

**File**: `tools/src/inspector/node_modules/.bin/esparse` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../esprima/bin/esparse.js
\ No newline at end of file
```

**File**: `tools/src/inspector/node_modules/.bin/esvalidate` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-../esprima/bin/esvalidate.js
\ No newline at end of file
```

---

### Incident Patch 14: `e0fc6049` (2018-07-09)
**Commit Message**: minor fixes

**File**: `bin/RenderNeutrino.framework/_CodeSignature/CodeResources` (modified, +30/-15)
```diff
@@ -10,7 +10,7 @@
 		</data>
 		<key>Headers/RenderNeutrino-Swift.h</key>
 		<data>
-		pz+R/04pQ/7CZuOHpLJlqx8hifE=
+		RePtVKT9kXuX8DGz6V7sVHjMuA8=
 		</data>
 		<key>Headers/RenderNeutrino.h</key>
 		<data>
@@ -56,21 +56,25 @@
 		<data>
 		/IKT3xCA3lBKnsJ4foW2m8nPF/E=
 		</data>
+		<key>Modules/RenderNeutrino.swiftmodule/.BC.T_Kv6jQ6</key>
+		<data>
+		ac3lsQVfyFlCE3qfwb8wY2ZV5UM=
+		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftdoc</key>
 		<data>
-		bWSlvz2DMuqw3kb38tMFZjVW5lI=
+		z5LgChv3lrg2LouYJdGHAdAbIFY=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftmodule</key>
 		<data>
-		fHSQTREJJwLeb8Ez+FXvX+ZcT2o=
+		RHb1itq87P0ZUsYTvEbkhucTwXc=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftdoc</key>
 		<data>
-		l9fagt+O3BYXR20qRVNonDB7KhM=
+		kbb5/yOiTFuv54RM7UUhNqWU0XE=
 		</data>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftmodule</key>
 		<data>
-		nz0d75oHNUiIV1YscAWfNF+EUrU=
+		PGUH4EoSTxIWBMDbRf0NHXwhceA=
 		</data>
 		<key>Modules/module.modulemap</key>
 		<data>
@@ -94,11 +98,11 @@
 		<dict>
 			<key>hash</key>
 			<data>
-			pz+R/04pQ/7CZuOHpLJlqx8hifE=
+			RePtVKT9kXuX8DGz6V7sVHjMuA8=
 			</data>
 			<key>hash2</key>
 			<data>
-			tVoApLGSZGA0RdOVug1773QN2oanKHt1XCAWluLUntQ=
+			Cxc2X+gyGlb+IT6r1DBRpRkKRPJBcEqPGGJTYzpR6RA=
 			</data>
 		</dict>
 		<key>Headers/RenderNeutrino.h</key>
@@ -211,48 +215,59 @@
 			OQIF5ergmz2uAw/u900rYcTR0evRWj45TNK4lviOMr8=
 			</data>
 		</dict>
+		<key>Modules/RenderNeutrino.swiftmodule/.BC.T_Kv6jQ6</key>
+		<dict>
+			<key>hash</key>
+			<data>
+			ac3lsQVfyFlCE3qfwb8wY2ZV5UM=
+			</data>
+			<key>hash2</key>
+			<data>
+			Fr66Uy0n17SmzAYX+0J19rOwDCyxPCavvcEcHTGkSjY=
+			</data>
+		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftdoc</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			bWSlvz2DMuqw3kb38tMFZjVW5lI=
+			z5LgChv3lrg2LouYJdGHAdAbIFY=
 			</data>
 			<key>hash2</key>
 			<data>
-			nOiwuhwQC4KbDC74uYZ2zC7Ec9WIeziNh1hz7ryg5iU=
+			YPaRV2fpI+vmYVaIDJ5YGqJYmf6UDQlBDTsW1Npa3MA=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/i386.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			fHSQTREJJwLeb8Ez+FXvX+ZcT2o=
+			RHb1itq87P0ZUsYTvEbkhucTwXc=
 			</data>
 			<key>hash2</key>
 			<data>
-			CR5WIhEnVDNuVc3bFPpAYPQ5xxL5HZkk9Z65wQ5EBQM=
+			68J26qMxzOsWTUKutgVbl1bugl2lO5yuWA7eXOu5Wqg=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftdoc</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			l9fagt+O3BYXR20qRVNonDB7KhM=
+			kbb5/yOiTFuv54RM7UUhNqWU0XE=
 			</data>
 			<key>hash2</key>
 			<data>
-			kAvU4Db+29s6aNlXnjnWCYaC/3GhlI/Bjats/qRbS+o=
+			6ZD2KmkXzpCgDlhgOEmqrc/og6SjsJeKpAa/JJ3DsW8=
 			</data>
 		</dict>
 		<key>Modules/RenderNeutrino.swiftmodule/x86_64.swiftmodule</key>
 		<dict>
 			<key>hash</key>
 			<data>
-			nz0d75oHNUiIV1YscAWfNF+EUrU=
+			PGUH4EoSTxIWBMDbRf0NHXwhceA=
 			</data>
 			<key>hash2</key>
 			<data>
-			Sf4Y9cBxHuH2VkfCXn3STXTdo1H94aj7HHyzuq00knc=
+			dVozTwaqhKZO3DeJYCoqaqGFxNKkowTb0plkX1r2nPQ=
 			</data>
 		</dict>
 		<key>Modules/module.modulemap</key>
```

**File**: `bin/SonarKit.framework/Headers/SKMacros.h` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+/*
+ *  Copyright (c) 2004-present, Facebook, Inc.
+ *
+ *  This source code is licensed under the MIT license found in the LICENSE
+ *  file in the root directory of this source tree.
+ *
+ */
+
+ #ifndef SKMACROS_H
+ #define SKMACROS_H
+
+ #import <FBDefines/FBMacros.h>
+
+ #ifdef __cplusplus
+ # define SK_EXTERN_C_BEGIN extern "C" {
+ # define SK_EXTERN_C_END   }
+ # define SK_EXTERN_C extern "C"
+ #else
+ # define SK_EXTERN_C_BEGIN
+ # define SK_EXTERN_C_END
+ # define SK_EXTERN_C extern
+ #endif
+
+ #define SKLog(...) NSLog(__VA_ARGS__)
+ #define SKTrace(...) /*NSLog(__VA_ARGS__)*/
+
+#endif
```

**File**: `bin/SonarKit.framework/Headers/SonarClient.h` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+/*
+ *  Copyright (c) 2018-present, Facebook, Inc.
+ *
+ *  This source code is licensed under the MIT license found in the LICENSE
+ *  file in the root directory of this source tree.
+ *
+ */
+#import <Foundation/Foundation.h>
+
+#import "SonarPlugin.h"
+
+/**
+Represents a connection between the Sonar desktop och client side. Manages the lifecycle of attached
+plugin instances.
+*/
+@interface SonarClient : NSObject
+
+/**
+The shared singleton SonarClient instance. It is an error to call this on non-debug builds to avoid leaking data.
+*/
++ (instancetype)sharedClient;
+
+/**
+Register a plugin with the client.
+*/
+- (void)addPlugin:(NSObject<SonarPlugin> *)plugin;
+
+/**
+Unregister a plugin with the client.
+*/
+- (void)removePlugin:(NSObject<SonarPlugin> *)plugin;
+
+/**
+Retrieve the plugin with a given identifier which was previously registered with this client.
+*/
+- (NSObject<SonarPlugin> *)pluginWithIdentifier:(NSString *)identifier;
+
+/**
+Establish a connection to the Sonar desktop.
+*/
+- (void)start;
+
+/**
+Stop the connection to the Sonar desktop.
+*/
+- (void)stop;
+
+// initializers are disabled. You must use `+[SonarClient sharedClient]` instance.
+- (instancetype)init NS_UNAVAILABLE;
++ (instancetype)new NS_UNAVAILABLE;
+
+@end
```

**File**: `bin/SonarKit.framework/Headers/SonarConnection.h` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+/*
+ *  Copyright (c) 2018-present, Facebook, Inc.
+ *
+ *  This source code is licensed under the MIT license found in the LICENSE
+ *  file in the root directory of this source tree.
+ *
+ */
+#import <Foundation/Foundation.h>
+
+@protocol SonarResponder;
+@protocol SonarWebSocket;
+
+typedef void (^SonarReceiver)(NSDictionary*, id<SonarResponder>);
+
+/**
+Represents a connection between the Desktop and mobile plugins with corresponding identifiers.
+*/
+@protocol SonarConnection
+
+/**
+Invoke a method on the Sonar desktop plugin with with a matching identifier.
+*/
+- (void)send:(NSString *)method withParams:(NSDictionary *)params;
+
+/**
+Register a receiver to be notified of incoming calls of the given method from the Sonar desktop
+plugin with a matching identifier.
+*/
+- (void)receive:(NSString *)method withBlock:(SonarReceiver)receiver;
+
+@end
```

**File**: `bin/SonarKit.framework/Headers/SonarPlugin.h` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/*
+ *  Copyright (c) 2004-present, Facebook, Inc.
+ *
+ *  This source code is licensed under the MIT license found in the LICENSE
+ *  file in the root directory of this source tree.
+ *
+ */
+
+#import <Foundation/Foundation.h>
+#import "SKMacros.h"
+
+SK_EXTERN_C_BEGIN
+void SonarPerformBlockOnMainThread(void(^block)());
+SK_EXTERN_C_END
+
+@protocol SonarConnection;
+
+@protocol SonarPlugin
+
+/**
+The plugin's identifier. This should map to a javascript plugin with the same identifier to ensure
+messages are sent correctly.
+*/
+- (NSString *)identifier;
+
+/**
+Called when a connection has been established between this plugin and the corresponding plugin on
+the Sonar desktop app. The provided connection can be used to register method receivers as well
+as send messages back to the desktop app.
+*/
+- (void)didConnect:(id<SonarConnection>)connection;
+
+/**
+Called when a plugin has been disconnected and the SonarConnection provided in didConnect is no
+longer valid to use.
+*/
+- (void)didDisconnect;
+
+@end
```

**File**: `bin/SonarKit.framework/Headers/SonarResponder.h` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+/*
+ *  Copyright (c) 2018-present, Facebook, Inc.
+ *
+ *  This source code is licensed under the MIT license found in the LICENSE
+ *  file in the root directory of this source tree.
+ *
+ */
+#import <Foundation/Foundation.h>
+
+/**
+Acts as a hook for providing return values to remote called from Sonar desktop plugins.
+*/
+@protocol SonarResponder
+
+/**
+Respond with a successful return value.
+*/
+- (void)success:(NSDictionary *)response;
+
+/**
+Respond with an error.
+*/
+- (void)error:(NSDictionary *)response;
+
+@end
```

**File**: `bin/SonarKit.framework/_CodeSignature/CodeResources` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>files</key>
+	<dict>
+		<key>Info.plist</key>
+		<data>
+		1qThqi8lzhcgwxeEqMC4O2ogRtU=
+		</data>
+	</dict>
+	<key>files2</key>
+	<dict/>
+	<key>rules</key>
+	<dict>
+		<key>^</key>
+		<true/>
+		<key>^.*\.lproj/</key>
+		<dict>
+			<key>optional</key>
+			<true/>
+			<key>weight</key>
+			<real>1000</real>
+		</dict>
+		<key>^.*\.lproj/locversion.plist$</key>
+		<dict>
+			<key>omit</key>
+			<true/>
+			<key>weight</key>
+			<real>1100</real>
+		</dict>
+		<key>^Base\.lproj/</key>
+		<dict>
+			<key>weight</key>
+			<real>1010</real>
+		</dict>
+		<key>^version.plist$</key>
+		<true/>
+	</dict>
+	<key>rules2</key>
+	<dict>
+		<key>.*\.dSYM($|/)</key>
+		<dict>
+			<key>weight</key>
+			<real>11</real>
+		</dict>
+		<key>^</key>
+		<dict>
+			<key>weight</key>
+			<real>20</real>
+		</dict>
+		<key>^(.*/)?\.DS_Store$</key>
+		<dict>
+			<key>omit</key>
+			<true/>
+			<key>weight</key>
+			<real>2000</real>
+		</dict>
+		<key>^(Frameworks|SharedFrameworks|PlugIns|Plug-ins|XPCServices|Helpers|MacOS|Library/(Automator|Spotlight|LoginItems))/</key>
+		<dict>
+			<key>nested</key>
+			<true/>
+			<key>weight</key>
+			<real>10</real>
+		</dict>
+		<key>^.*</key>
+		<true/>
+		<key>^.*\.lproj/</key>
+		<dict>
+			<key>optional</key>
+			<true/>
+			<key>weight</key>
+			<real>1000</real>
+		</dict>
+		<key>^.*\.lproj/locversion.plist$</key>
+		<dict>
+			<key>omit</key>
+			<true/>
+			<key>weight</key>
+			<real>1100</real>
+		</dict>
+		<key>^Base\.lproj/</key>
+		<dict>
+			<key>weight</key>
+			<real>1010</real>
+		</dict>
+		<key>^Info\.plist$</key>
+		<dict>
+			<key>omit</key>
+			<true/>
+			<key>weight</key>
+			<real>20</real>
+		</dict>
+		<key>^PkgInfo$</key>
+		<dict>
+			<key>omit</key>
+			<true/>
+			<key>weight</key>
+			<real>20</real>
+		</dict>
+		<key>^[^/]+$</key>
+		<dict>
+			<key>nested</key>
+			<true/>
+			<key>weight</key>
+			<real>10</real>
+		</dict>
+		<key>^embedded\.provisionprofile$</key>
+		<dict>
+			<key>weight</key>
+			<real>20</real>
+		</dict>
+		<key>^version\.plist$</key>
+		<dict>
+			<key>weight</key>
+			<real>20</real>
+		</dict>
+	</dict>
+</dict>
+</plist>
```

**File**: `objc/CoreRender.xcodeproj/project.pbxproj` (renamed, +93/-104)
```diff
@@ -7,62 +7,64 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
-		161CF40D20E109A200D569B7 /* CRSwiftInteropTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 161CF40A20E1099E00D569B7 /* CRSwiftInteropTests.swift */; };
-		161CF40F20E10B1100D569B7 /* CRSwiftBridge.swift in Sources */ = {isa = PBXBuildFile; fileRef = 161CF40E20E10B1100D569B7 /* CRSwiftBridge.swift */; };
-		BF_129101617351 /* CRUmbrellaHeader.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_192531073524 /* CRUmbrellaHeader.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_160483333546 /* CRMacros.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_766493304644 /* CRMacros.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_408658699193 /* YGLayout.m in Sources */ = {isa = PBXBuildFile; fileRef = "FR_866360935786-1" /* YGLayout.m */; };
-		BF_432321454116 /* CRNodeLayoutSpec.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_849819399313 /* CRNodeLayoutSpec.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_440583613751 /* CRContext.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_431251200163 /* CRContext.mm */; };
-		BF_481467684889 /* CRNodeLayoutSpec.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_154129109600 /* CRNodeLayoutSpec.mm */; };
-		BF_582634011886 /* CRNodeBridge.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_229333217053 /* CRNodeBridge.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_620636750337 /* YGLayout.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_866360935786 /* YGLayout.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_628308163754 /* CoreRenderObjC.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = FR_986821503402 /* CoreRenderObjC.framework */; };
-		BF_659311268650 /* CRContext.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_615238287789 /* CRContext.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_696361087706 /* CRNodeBridge.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_266875401349 /* CRNodeBridge.mm */; };
-		BF_779002885327 /* CRNode.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_882987497637 /* CRNode.mm */; };
-		BF_795644537189 /* UIView+CRNode.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_103086332183 /* UIView+CRNode.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_806929900779 /* CoreRenderObjC.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_821413310904 /* CoreRenderObjC.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_834335704775 /* CRNode.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_441077196049 /* CRNode.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BF_839300474782 /* Yoga.h in Headers */ = {isa = PBXBuildFile; fileRef = "FR_992392398074-1" /* Yoga.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_127239259546 /* CRUmbrellaHeader.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_192531073524 /* CRUmbrellaHeader.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_132083663318 /* Yoga.c in Sources */ = {isa = PBXBuildFile; fileRef = FR_992392398074 /* Yoga.c */; };
+		BF_139404374290 /* CRNode.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_882987497637 /* CRNode.mm */; };
+		BF_183038341856 /* UIView+CRNode.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_439634733832 /* UIView+CRNode.mm */; };
+		BF_253667324706 /* YGLayout.m in Sources */ = {isa = PBXBuildFile; fileRef = "FR_866360935786-1" /* YGLayout.m */; };
+		BF_265977215372 /* CRSwiftBridge.swift in Sources */ = {isa = PBXBuildFile; fileRef = FR_207069855663 /* CRSwiftBridge.swift */; };
+		BF_269367569910 /* CRNodeBridge.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_266875401349 /* CRNodeBridge.mm */; };
+		BF_290816555582 = {isa = PBXBuildFile; fileRef = FR_764490391420 /* CoreRender.framework */; };
+		BF_306064163752 /* CoreRender.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_862926127157 /* CoreRender.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_368834986804 /* CRSwiftInteropTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = FR_787473978420 /* CRSwiftInteropTests.swift */; };
+		BF_405804783477 /* CRContext.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_615238287789 /* CRContext.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_457776453065 /* CRMacros.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_766493304644 /* CRMacros.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_504580378182 /* CRNodeLayoutSpec.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_154129109600 /* CRNodeLayoutSpec.mm */; };
+		BF_570003296635 /* CRNodeBridge.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_229333217053 /* CRNodeBridge.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_579407411024 = {isa = PBXBuildFile; fileRef = FR_479945003232 /* Test.xctest */; };
+		BF_653280238411 /* CRNode.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_441077196049 /* CRNode.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_663824824714 /* CRNodeLayoutSpec.h in He
```

---

### Incident Patch 15: `0197e211` (2018-06-25)
**Commit Message**: CoreRenderObjC

**File**: `objc/CoreRenderObjC.xcodeproj/project.pbxproj` (added, +471/-0)
```diff
@@ -0,0 +1,471 @@
+// !$*UTF8*$!
+{
+	archiveVersion = 1;
+	classes = {
+	};
+	objectVersion = 46;
+	objects = {
+
+/* Begin PBXBuildFile section */
+		BF_129101617351 /* CRUmbrellaHeader.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_192531073524 /* CRUmbrellaHeader.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_160483333546 /* CRMacros.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_766493304644 /* CRMacros.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_352740215136 = {isa = PBXBuildFile; fileRef = FR_986821503402 /* CoreRenderObjC.framework */; };
+		BF_408658699193 /* YGLayout.m in Sources */ = {isa = PBXBuildFile; fileRef = "FR_866360935786-1" /* YGLayout.m */; };
+		BF_432321454116 /* CRNodeLayoutSpec.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_849819399313 /* CRNodeLayoutSpec.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_440583613751 /* CRContext.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_431251200163 /* CRContext.mm */; };
+		BF_481467684889 /* CRNodeLayoutSpec.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_154129109600 /* CRNodeLayoutSpec.mm */; };
+		BF_579407411024 = {isa = PBXBuildFile; fileRef = FR_479945003232 /* Test.xctest */; };
+		BF_582634011886 /* CRNodeBridge.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_229333217053 /* CRNodeBridge.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_620636750337 /* YGLayout.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_866360935786 /* YGLayout.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_628308163754 /* CoreRenderObjC.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = FR_986821503402 /* CoreRenderObjC.framework */; };
+		BF_659311268650 /* CRContext.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_615238287789 /* CRContext.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_696361087706 /* CRNodeBridge.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_266875401349 /* CRNodeBridge.mm */; };
+		BF_779002885327 /* CRNode.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_882987497637 /* CRNode.mm */; };
+		BF_795644537189 /* UIView+CRNode.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_103086332183 /* UIView+CRNode.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_806929900779 /* CoreRenderObjC.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_821413310904 /* CoreRenderObjC.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_834335704775 /* CRNode.h in Headers */ = {isa = PBXBuildFile; fileRef = FR_441077196049 /* CRNode.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_839300474782 /* Yoga.h in Headers */ = {isa = PBXBuildFile; fileRef = "FR_992392398074-1" /* Yoga.h */; settings = {ATTRIBUTES = (Public, ); }; };
+		BF_874188233624 /* CRNodeTests.m in Sources */ = {isa = PBXBuildFile; fileRef = FR_633785660067 /* CRNodeTests.m */; };
+		BF_897300234831 /* Yoga.c in Sources */ = {isa = PBXBuildFile; fileRef = FR_992392398074 /* Yoga.c */; };
+		BF_913015669741 /* UIView+CRNode.mm in Sources */ = {isa = PBXBuildFile; fileRef = FR_439634733832 /* UIView+CRNode.mm */; };
+/* End PBXBuildFile section */
+
+/* Begin PBXContainerItemProxy section */
+		CIP_47994500323 /* PBXContainerItemProxy */ = {
+			isa = PBXContainerItemProxy;
+			containerPortal = P_9868215034022 /* Project object */;
+			proxyType = 1;
+			remoteGlobalIDString = NT_986821503402;
+			remoteInfo = CoreRenderObjC;
+		};
+/* End PBXContainerItemProxy section */
+
+/* Begin PBXFileReference section */
+		FR_103086332183 /* UIView+CRNode.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = "UIView+CRNode.h"; sourceTree = "<group>"; };
+		FR_154129109600 /* CRNodeLayoutSpec.mm */ = {isa = PBXFileReference; path = CRNodeLayoutSpec.mm; sourceTree = "<group>"; };
+		FR_192531073524 /* CRUmbrellaHeader.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = CRUmbrellaHeader.h; sourceTree = "<group>"; };
+		FR_229333217053 /* CRNodeBridge.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = CRNodeBridge.h; sourceTree = "<group>"; };
+		FR_266875401349 /* CRNodeBridge.mm */ = {isa = PBXFileReference; path = CRNodeBridge.mm; sourceTree = "<group>"; };
+		FR_431251200163 /* CRContext.mm */ = {isa = PBXFileReference; path = CRContext.mm; sourceTree = "<group>"; };
+		FR_439634733832 /* UIView+CRNode.mm */ = {isa = PBXFileReference; path = "UIView+CRNode.mm"; sourceTree = "<group>"; };
+		FR_441077196049 /* CRNode.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = CRNode.h; sourceTree = "<group>"; };
+		FR_456968685412 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
+		FR_479945003232 /* Test.xctest */ = {isa = PBXFileReference; includeInIndex = 0; lastKnownFileType = wrapper.cfbundle; path = Test.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
+		FR_615238287789 /* CRContext.h */ = {isa = PBXFileReference; lastKnownFileType =
```

**File**: `objc/CoreRenderObjC.xcodeproj/project.xcworkspace/contents.xcworkspacedata` (added, +7/-0)
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

**File**: `objc/CoreRenderObjC.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` (added, +8/-0)
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

**File**: `objc/CoreRenderObjC.xcodeproj/xcshareddata/xcschemes/Test.xcscheme` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Scheme
+   LastUpgradeVersion = "0930"
+   version = "1.3">
+   <BuildAction
+      parallelizeBuildables = "YES"
+      buildImplicitDependencies = "YES">
+      <BuildActionEntries>
+         <BuildActionEntry
+            buildForTesting = "YES"
+            buildForRunning = "YES"
+            buildForProfiling = "YES"
+            buildForArchiving = "YES"
+            buildForAnalyzing = "YES">
+            <BuildableReference
+               BuildableIdentifier = "primary"
+               BlueprintIdentifier = "NT_479945003232"
+               BuildableName = "Test.xctest"
+               BlueprintName = "Test"
+               ReferencedContainer = "container:CoreRenderObjC.xcodeproj">
+            </BuildableReference>
+         </BuildActionEntry>
+      </BuildActionEntries>
+   </BuildAction>
+   <TestAction
+      buildConfiguration = "Debug"
+      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
+      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
+      codeCoverageEnabled = "YES"
+      shouldUseLaunchSchemeArgsEnv = "NO">
+      <Testables>
+         <TestableReference
+            skipped = "NO">
+            <BuildableReference
+               BuildableIdentifier = "primary"
+               BlueprintIdentifier = "NT_479945003232"
+               BuildableName = "Test.xctest"
+               BlueprintName = "Test"
+               ReferencedContainer = "container:CoreRenderObjC.xcodeproj">
+            </BuildableReference>
+         </TestableReference>
+      </Testables>
+      <MacroExpansion>
+         <BuildableReference
+            BuildableIdentifier = "primary"
+            BlueprintIdentifier = "NT_479945003232"
+            BuildableName = "Test.xctest"
+            BlueprintName = "Test"
+            ReferencedContainer = "container:CoreRenderObjC.xcodeproj">
+         </BuildableReference>
+      </MacroExpansion>
+      <CommandLineArguments>
+      </CommandLineArguments>
+      <EnvironmentVariables>
+         <EnvironmentVariable
+            key = "TEST"
+            value = "YES"
+            isEnabled = "YES">
+         </EnvironmentVariable>
+      </EnvironmentVariables>
+      <AdditionalOptions>
+      </AdditionalOptions>
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
+      <BuildableProductRunnable
+         runnableDebuggingMode = "0">
+         <BuildableReference
+            BuildableIdentifier = "primary"
+            BlueprintIdentifier = "NT_479945003232"
+            BuildableName = "Test.xctest"
+            BlueprintName = "Test"
+            ReferencedContainer = "container:CoreRenderObjC.xcodeproj">
+         </BuildableReference>
+      </BuildableProductRunnable>
+      <CommandLineArguments>
+      </CommandLineArguments>
+      <EnvironmentVariables>
+         <EnvironmentVariable
+            key = "TEST"
+            value = "YES"
+            isEnabled = "YES">
+         </EnvironmentVariable>
+      </EnvironmentVariables>
+      <AdditionalOptions>
+      </AdditionalOptions>
+   </LaunchAction>
+   <ProfileAction
+      buildConfiguration = "Release"
+      shouldUseLaunchSchemeArgsEnv = "NO"
+      savedToolIdentifier = ""
+      useCustomWorkingDirectory = "NO"
+      debugDocumentVersioning = "YES">
+      <BuildableProductRunnable
+         runnableDebuggingMode = "0">
+         <BuildableReference
+            BuildableIdentifier = "primary"
+            BlueprintIdentifier = "NT_479945003232"
+            BuildableName = "Test.xctest"
+            BlueprintName = "Test"
+            ReferencedContainer = "container:CoreRenderObjC.xcodeproj">
+         </BuildableReference>
+      </BuildableProductRunnable>
+      <CommandLineArguments>
+      </CommandLineArguments>
+      <EnvironmentVariables>
+         <EnvironmentVariable
+            key = "TEST"
+            value = "YES"
+            isEnabled = "YES">
+         </EnvironmentVariable>
+      </EnvironmentVariables>
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

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRContext.h` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+#import "CRUmbrellaHeader.h"
+
+NS_ASSUME_NONNULL_BEGIN
+
+@interface CRContext : NSObject
+/// Layout animator for the nodes registered to this context.
+@property (nonatomic, nullable) UIViewPropertyAnimator *layoutAnimator;
+@end
+
+NS_ASSUME_NONNULL_END
```

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRMacros.h` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+#ifndef CRMacros_h
+#define CRMacros_h
+
+#if defined(__cplusplus)
+#else
+#define auto __auto_type
+#endif
+
+#if DEBUG
+#define CR_KEYPATH(o, p) ((void)(NO && ((void)o.p, NO)), @ #p)
+#else
+#define CR_KEYPATH(o, p) @ #p
+#endif
+
+#define CR_WEAKNAME_(VAR) VAR ## _weak_
+
+#define CR_WEAKIFY(VAR) __weak __typeof__(VAR) CR_WEAKNAME_(VAR) = (VAR);
+
+#define CR_STRONGIFY(VAR) \
+_Pragma("clang diagnostic push") \
+_Pragma("clang diagnostic ignored \"-Wshadow\"") \
+__strong __typeof__(VAR) VAR = CR_WEAKNAME_(VAR); \
+_Pragma("clang diagnostic pop")
+
+#define CR_STRONGIFY_AND_RETURN_IF_NIL(VAR) \
+CR_STRONGIFY(VAR); \
+if (!(VAR)) { \
+return; \
+}
+
+#define CR_NIL_COALESCING(VALUE, DEFAULT) VALUE != nil ? VALUE : DEFAULT;
+
+#define CR_DYNAMIC_CAST(TYPE, VALUE) ([VALUE isKindOfClass:TYPE.class] ? (TYPE *)VALUE : nil);
+
+#define CR_ASSERT_ON_MAIN_THREAD NSAssert(NSThread.isMainThread, @"%@ called off the main thread.", NSStringFromSelector(_cmd));;
+
+typedef struct __attribute__((objc_boxable)) CGPoint CGPoint;
+typedef struct __attribute__((objc_boxable)) CGSize CGSize;
+typedef struct __attribute__((objc_boxable)) CGRect CGRect;
+typedef struct __attribute__((objc_boxable)) CGVector CGVector;
+typedef struct __attribute__((objc_boxable)) UIEdgeInsets UIEdgeInsets;
+typedef struct __attribute__((objc_boxable)) _NSRange NSRange;
+
+@protocol CRFastEnumeration <NSFastEnumeration>
+- (id)cr_enumeratedType;
+@end
+
+// Usage: foreach (s, strings) { ... }
+#define foreach(element, collection) for (typeof((collection).cr_enumeratedType) element in (collection))
+
+@interface NSArray <ElementType> (CRFastEnumeration) <CRFastEnumeration>
+- (ElementType)cr_enumeratedType;
+@end
+
+@interface NSSet <ElementType> (CRFastEnumeration) <CRFastEnumeration>
+- (ElementType)cr_enumeratedType;
+@end
+
+@interface NSDictionary <KeyType, ValueType> (CRFastEnumeration) <CRFastEnumeration>
+- (KeyType)cr_enumeratedType;
+@end
+
+// Geometry
+
+#define CR_CGFLOAT_MAX 32768
+#define CR_CGFLOAT_UNDEFINED YGUndefined
+#define CR_CGFLOAT_FLEXIBLE CR_CGFLOAT_MAX
+#define CR_NORMALIZE(value) (value >= 0.0 && value <= CR_CGFLOAT_MAX ? value : 0.0)
+
+#endif /* CRMacros_h */
```

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRNode.h` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+#import "CRUmbrellaHeader.h"
+
+NS_ASSUME_NONNULL_BEGIN
+
+typedef NS_OPTIONS(NSUInteger, CRNodeLayoutOptions) {
+  CRNodeLayoutOptionsNone = 1 << 0,
+  CRNodeLayoutOptionsSizeContainerViewToFit = 1 << 1
+};
+
+@class CRNode;
+@class CRContext;
+@class CRNodeLayoutSpec<__covariant V: UIView *>;
+
+@protocol CRNodeDelegate <NSObject>
+@optional
+/// The root node for this hierarchy is being configured and layed out.
+/// Additional custom manual layout can be defined here.
+/// @note: Use @viewWithKey or @viewsWithReuseIdentifier to query the desired views in the
+/// installed view hierarchy.
+- (void)rootNodeDidLayout:(CRNode *)node;
+/// The node @renderedView just got inserted in the view hierarchy.
+- (void)rootNodeDidMount:(CRNode *)node;
+@end
+
+@interface CRNode<__covariant V: UIView *> : NSObject
+/// The context associated with this node hierarchy.
+@property(nonatomic, readonly, nullable) CRContext *context;
+/// The reuse identifier for this node is its hierarchy.
+/// Identifiers help Render understand which items have changed.
+/// A custom *reuseIdentifier* is mandatory if the node has a custom creation closure.
+@property(nonatomic, readonly) NSString *reuseIdentifier;
+/// A unique key for the component/node (necessary if the associated component is stateful).
+@property(nonatomic, readonly, nullable) NSString *key;
+/// This component is the n-th children.
+@property(nonatomic, readonly) NSUInteger index;
+/// The subnodes of this node.
+@property(nonatomic, readonly) NSArray<CRNode *> *children;
+/// The parent node (if this is not the root node in the hierarchy).
+@property(nonatomic, readonly, nullable, weak) CRNode *parent;
+/// The type of the associated backing view.
+@property(nonatomic, readonly) Class viewType;
+/// Backing view for this node.
+@property(nonatomic, readonly, nullable) V renderedView;
+/// The layout delegate for this node.
+@property(nonatomic, nullable, weak) id<CRNodeDelegate> delegate;
+
+#pragma mark Constructors
+
+- (instancetype)initWithType:(Class)type
+             reuseIdentifier:(nullable NSString *)reuseIdentifier
+                         key:(nullable NSString *)key
+          viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
+                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
+
++ (instancetype)nodeWithType:(Class)type
+             reuseIdentifier:(NSString *)reuseIdentifier
+                         key:(nullable NSString *)key
+          viewInitialization:(UIView *(^_Nullable)(void))viewInitialization
+                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
+
++ (instancetype)nodeWithType:(Class)type
+                         key:(nullable NSString *)key
+                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
+
++ (instancetype)nodeWithType:(Class)type
+                  layoutSpec:(void (^)(CRNodeLayoutSpec<V> *))layoutSpec;
+
+#pragma mark Setup
+
+/// Adds the nodes as children of this node.
+- (instancetype)appendChilden:(NSArray<CRNode *> *)children;
+
+/// Register the context for the root node of this node hierarchy.
+- (void)registerInContext:(CRContext *)context;
+
+#pragma mark Render
+
+/// Reconcile the view hierarchy with the one in the container view passed as argument.
+/// @note: This method also performs layout and configuration.
+- (void)reconcileInView:(UIView *)view
+      constrainedToSize:(CGSize)size
+            withOptions:(CRNodeLayoutOptions)options;
+
+/// Layout and configure the views.
+- (void)layoutConstrainedToSize:(CGSize)size withOptions:(CRNodeLayoutOptions)options;
+
+#pragma mark Querying
+
+/// Returns the view in the subtree of this node with the given @c key.
+- (nullable UIView *)viewWithKey:(NSString *)key;
+
+/// Returns all the views that have been registered with the given @c reuseIdentifier.
+- (NSArray<UIView *> *)viewsWithReuseIdentifier:(NSString *)reuseIdentifier;
+
+@end
+
+NS_ASSUME_NONNULL_END
```

**File**: `objc/bin/CoreRenderObjC.framework/Headers/CRNodeBridge.h` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+#import "CRUmbrellaHeader.h"
+
+NS_ASSUME_NONNULL_BEGIN
+
+@class CRNode;
+
+@interface CRNodeBridge : NSObject
+/// Whether the view has been created at the last render pass.
+@property (nonatomic) BOOL isNewlyCreated;
+/// The node associated to this view.
+@property (nonatomic, nullable, weak) CRNode *node;
+/// The bridged view.
+@property (nonatomic, nullable, weak) UIView *view;
+/// Layout animator for this subtree.
+@property (nonatomic, nullable) UIViewPropertyAnimator *layoutAnimator;
+
+- (instancetype)initWithView:(UIView*)view;
+
+/// Stores the current (now considered old in the current run-loop) geometry for the associated
+/// view and all of its subviews recursively.
+- (void)storeViewSubTreeOldGeometry;
+/// Applies the stored old geometry to this view subtree.
+- (void)applyViewSubTreeOldGeometry;
+/// Stores the geometry for the associated view after the node has rendered at the end of the
+/// current run-loop.
+- (void)storeViewSubTreeNewGeometry;
+/// Applies the stored new geometry to this view subtree.
+- (void)applyViewSubTreeNewGeometry;
+/// Transition in all of the newly created view in the view hierarchy.
+- (void)fadeInNewlyCreatedViewsInViewSubTreeWithDelay:(NSTimeInterval)delay;
+/// Set the property at the given keyPath.nil
+- (void)setPropertyWithKeyPath:(NSString *)keyPath
+                         value:(id)value
+                      animator:(nullable UIViewPropertyAnimator *)animator;
+/// Restore the view to its initial state.
+- (void)restore;
+
+@end
+
+NS_ASSUME_NONNULL_END
```

#### Recent Merged Pull Requests:
- **PR #115** (closed): Typo fix docs: 'sepc' --> 'spec' (@ThomasK33)
- **PR #113** (2018-10-24): Adds hashValue as a keypath stringification fallback (@AndrewLipscomb)
- **PR #100** (closed): Adding link to Dispatch TodoApp to readme (@jondwillis)
- **PR #99** (2018-02-09): Fixup startDebugServer() documentation (@jondwillis)
- **PR #98** (2017-12-29): Update .swift-version (@ooga)
- **PR #93** (closed): s/statelss/stateless/ (@connor)
- **PR #92** (closed): Fix subview index with existing view reconciliation (@zdnk)
- **PR #84** (2017-09-07): fix typo (@byronanderson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
