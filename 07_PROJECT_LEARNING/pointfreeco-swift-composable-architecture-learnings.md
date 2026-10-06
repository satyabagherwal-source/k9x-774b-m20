# Forensic Learning Record (Deep Inspection): pointfreeco/swift-composable-architecture

> **Canonical Artifact**: `07_PROJECT_LEARNING/pointfreeco-swift-composable-architecture-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pointfreeco/swift-composable-architecture](https://github.com/pointfreeco/swift-composable-architecture))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:06:24.577Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pointfreeco/swift-composable-architecture`
- **Description**: A library for building applications in a consistent and understandable way, with composition, testing, and ergonomics in mind.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 14951 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Examples/CaseStudies/SwiftUICaseStudies/01-GettingStarted-FocusState.swift`
```
import ComposableArchitecture
import SwiftUI

private let readMe = """
  This demonstrates how to make use of SwiftUI's `@FocusState` in the Composable Architecture with \
  the library's `bind` view modifier. If you tap the "Sign in" button while a field is empty, the \
  focus will be changed to the first empty field.
  """

@Reducer
struct FocusDemo {
  @ObservableState
  struct State: Equatable {
    var focusedField: Field?
    var password: String = ""
    var username: String = ""

    enum Field: String, Hashable {
      case username, password
    }
  }

  enum Action: BindableAction {
    case binding(BindingAction<State>)
    case signInButtonTapped
  }

  var body: some Reducer<State, Action> {
    BindingReducer()
    Reduce { state, action in
      switch action {
      case .binding:
        return .none

      case .signInButtonTapped:
        if state.username.isEmpty {
          state.focusedField = .username
        } else if state.password.isEmpty {
          state.focusedField = .password
        }
        return .none
      }
    }
  }
}

struct FocusDemoView: View {
  @Bindable var store: StoreOf<FocusDemo>
  @FocusState var focusedField: FocusDemo.State.Field?

  var body: some View {
    Form {
      AboutView(readMe: readMe)

      VStack {
        TextField("Username", text: $store.username)
          .focused($focusedField, equals: .username)
        SecureField("Password", text: $store.password)
          .focused($focusedField, equals: .password)
        Button("Sign In") {
          store.send(.signInButtonTapped)
        }
        .buttonStyle(.borderedProminent)
      }
      .textFieldStyle(.roundedBorder)
    }
    // Synchronize store focus state and local focus state.
    .bind($store.focusedField, to: $focusedField)
    .navigationTitle("Focus demo")
  }
}

#Preview {
  NavigationStack {
    FocusDemoView(
      store: Store(initialState: FocusDemo.State()) {
        FocusDemo()
      }
    )
  }
}

```

### Core Architecture Module: `Examples/CaseStudies/SwiftUICaseStudies/01-GettingStarted-OptionalState.swift`
```
import ComposableArchitecture
import SwiftUI

private let readMe = """
  This screen demonstrates how to show and hide views based on the presence of some optional child \
  state.

  The parent state holds a `Counter.State?` value. When it is `nil` we will default to a plain \
  text view. But when it is non-`nil` we will show a view fragment for a counter that operates on \
  the non-optional counter state.

  Tapping "Toggle counter state" will flip between the `nil` and non-`nil` counter states.
  """

@Reducer
struct OptionalBasics {
  @ObservableState
  struct State: Equatable {
    var optionalCounter: Counter.State?
  }

  enum Action {
    case optionalCounter(Counter.Action)
    case toggleCounterButtonTapped
  }

  var body: some Reducer<State, Action> {
    Reduce { state, action in
      switch action {
      case .toggleCounterButtonTapped:
        state.optionalCounter =
          state.optionalCounter == nil
          ? Counter.State()
          : nil
        return .none
      case .optionalCounter:
        return .none
      }
    }
    .ifLet(\.optionalCounter, action: \.optionalCounter) {
      Counter()
    }
  }
}

struct OptionalBasicsView: View {
  let store: StoreOf<OptionalBasics>

  var body: some View {
    Form {
      Section {
        AboutView(readMe: readMe)
      }

      Button("Toggle counter state") {
        store.send(.toggleCounterButtonTapped)
      }

      if let store = store.scope(\.optionalCounter, action: \.optionalCounter) {
        Text(template: "`Counter.State` is non-`nil`")
        CounterView(store: store)
          .buttonStyle(.borderless)
          .frame(maxWidth: .infinity)
      } else {
        Text(template: "`Counter.State` is `nil`")
      }
    }
    .navigationTitle("Optional state")
  }
}

#Preview {
  NavigationStack {
    OptionalBasicsView(
      store: Store(initialState: OptionalBasics.State()) {
        OptionalBasics()
      }
    )
  }
}

#Preview("Deep-linked") {
  NavigationStack {
    OptionalBasicsView(
      store: Store(
        initialState: OptionalBasics.State(
          optionalCounter: Counter.State(
            count: 42
          )
        )
      ) {
        OptionalBasics()
      }
    )
  }
}

```

### Core Architecture Module: `Examples/CaseStudies/SwiftUICaseStudies/02-SharedState-FileStorage.swift`
```
import ComposableArchitecture
import SwiftUI

private let readMe = """
  This screen demonstrates how multiple independent screens can share state in the Composable \
  Architecture through file storage. Each tab manages its own state, and \
  could be in separate modules, but changes in one tab are immediately reflected in the other, and \
  all changes are persisted to disk.

  This tab has its own state, consisting of a count value that can be incremented and decremented, \
  as well as an alert value that is set when asking if the current count is prime.

  Internally, it is also keeping track of various stats, such as min and max counts and total \
  number of count events that occurred. Those states are viewable in the other tab, and the stats \
  can be reset from the other tab.
  """

@Reducer
struct SharedStateFileStorage {
  enum Tab { case counter, profile }

  @ObservableState
  struct State: Equatable {
    var currentTab = Tab.counter
    var counter = CounterTab.State()
    var profile = ProfileTab.State()
  }

  enum Action {
    case counter(CounterTab.Action)
    case profile(ProfileTab.Action)
    case selectTab(Tab)
  }

  var body: some Reducer<State, Action> {
    Scope(\.counter, action: \.counter) {
      CounterTab()
    }

    Scope(\.profile, action: \.profile) {
      ProfileTab()
    }

    Reduce { state, action in
      switch action {
      case .counter, .profile:
        return .none
      case .selectTab(let tab):
        state.currentTab = tab
        return .none
      }
    }
  }
}

struct SharedStateFileStorageView: View {
  @Bindable var store: StoreOf<SharedStateFileStorage>

  var body: some View {
    TabView(selection: $store.currentTab.sending(\.selectTab)) {
      CounterTabView(
        store: store.scope(\.counter, action: \.counter)
      )
      .tag(SharedStateFileStorage.Tab.counter)
      .tabItem { Text("Counter") }

      ProfileTabView(
        store: store.scope(\.profile, action: \.profile)
      )
      .tag(SharedStateFileStorage.Tab.profile)
      .tabItem { Text("Profile") }
    }
    .navigationTitle("Shared State Demo")
  }
}

extension SharedStateFileStorage {
  @Reducer
  struct CounterTab {
    @ObservableState
    struct State: Equatable {
      @Presents var alert: AlertState<Action.Alert>?
      @Shared(.stats) var stats = Stats()
    }

    enum Action {
      case alert(PresentationAction<Alert>)
      case decrementButtonTapped
      case incrementButtonTapped
      case isPrimeButtonTapped

      enum Alert: Equatable {}
    }

    var body: some Reducer<State, Action> {
      Reduce { state, action in
        switch action {
        case .alert:
          return .none

        case .decrementButtonTapped:
          state.$stats.withLock { $0.decrement() }
          return .none

        case .incrementButtonTapped:
          state.$stats.withLock { $0.increment() }
          return .none

        case .isPrimeButtonTapped:
          state.alert = AlertState {
            TextState(
              isPrime(state.stats.count)
                ? "👍 The number \(state.stats.count) is prime!"
                : "👎 The number \(state.stats.count) is not prime :("
            )
          }
          return .none
        }
      }
      .ifLet(\.$alert, action: \.alert)
    }
  }

  @Reducer
  struct ProfileTab {
    @ObservableState
    struct State: Equatable {
      @Shared(.stats) var stats = Stats()
    }

    enum Action {
      case resetStatsButtonTapped
    }

    var body: some Reducer<State, Action> {
      Reduce { state, action in
        switch action {
        case .resetStatsButtonTapped:
          state.$stats.withLock { $0 = Stats() }
          return .none
        }
      }
    }
  }
}

private struct CounterTabView: View {
  @Bindable var store: StoreOf<SharedStateFileStorage.CounterTab>

  var body: some View {
    Form {
      Text(template: readMe, .caption)

      VStack(spacing: 16) {
        HStack {
          Button {
            store.send(.decrementButtonTapped)
          } label: {
            Image(systemName: "minus")
          }

          Text("\(store.stats.count)")
            .monospacedDigit()

          Button {
            store.send(.incrementButtonTapped)
          } label: {
            Image(systemName: "plus")
          }
        }

        Button("Is this prime?") { store.send(.isPrimeButtonTapped) }
      }
    }
    .buttonStyle(.borderless)
    .alert($store.scope(\.alert, action: \.alert))
  }
}

private struct ProfileTabView: View {
  let store: StoreOf<SharedStateFileStorage.ProfileTab>

  var body: some View {
    Form {
      Text(
        template: """
          This tab shows state from the previous tab, and it is capable of resetting all of the \
          state back to 0.

          This shows that it is possible for each screen to model its state in the way that makes \
          the most sense for it, while still allowing the state and mutations to be shared \
          across independent screens.
          """,
        .caption
      )

      VStack(spacing: 16) {
        Text("Current count: \(store.stats.count)")
        Text("Max count: \(store.stats.maxCount)")
        Text("Min count: \(store.stats.minCount)")
        Text("Total number of count events: \(store.stats.numberOfCounts)")
        Button("Reset") { store.send(.resetStatsButtonTapped) }
      }
    }
    .buttonStyle(.borderless)
  }
}

struct Stats: Codable, Equatable {
  private(set) var count = 0
  private(set) var maxCount = 0
  private(set) var minCount = 0
  private(set) var numberOfCounts = 0
  mutating func increment() {
    count += 1
    numberOfCounts += 1
    maxCount = max(maxCount, count)
  }
  mutating func decrement() {
    count -= 1
    numberOfCounts += 1
    minCount = min(minCount, count)
  }
}

extension SharedKey where Self == FileStorageKey<Stats> {
  fileprivate static var stats: Self {
    fileStorage(.documentsDirectory.appending(component: "stats.json"))
  }
}

/// Checks if a number is prime or not.
private func isPrime(_ p: Int) -> Bool {
  if p <= 1 { return false }
  if p <= 3 { return true }
  for i in 2...Int(sqrtf(Float(p))) {
    if p % i == 0 { return false }
  }
  return true
}

#Preview {
  SharedStateFileStorageView(
    store: Store(initialState: SharedStateFileStorage.State()) {
      SharedStateFileStorage()
    }
  )
}

```

### Core Architecture Module: `Examples/CaseStudies/SwiftUICaseStudies/02-SharedState-InMemory.swift`
```
import ComposableArchitecture
import SwiftUI

private let readMe = """
  This screen demonstrates how multiple independent screens can share state in the Composable \
  Architecture through an in-memory reference. Each tab manages its own state, and \
  could be in separate modules, but changes in one tab are immediately reflected in the other.

  This tab has its own state, consisting of a count value that can be incremented and decremented, \
  as well as an alert value that is set when asking if the current count is prime.

  Internally, it is also keeping track of various stats, such as min and max counts and total \
  number of count events that occurred. Those states are viewable in the other tab, and the stats \
  can be reset from the other tab.
  """

@Reducer
struct SharedStateInMemory {
  enum Tab { case counter, profile }

  @ObservableState
  struct State: Equatable {
    var currentTab = Tab.counter
    var counter = CounterTab.State()
    var profile = ProfileTab.State()
  }

  enum Action {
    case counter(CounterTab.Action)
    case profile(ProfileTab.Action)
    case selectTab(Tab)
  }

  var body: some Reducer<State, Action> {
    Scope(\.counter, action: \.counter) {
      CounterTab()
    }

    Scope(\.profile, action: \.profile) {
      ProfileTab()
    }

    Reduce { state, action in
      switch action {
      case .counter, .profile:
        return .none
      case .selectTab(let tab):
        state.currentTab = tab
        return .none
      }
    }
  }
}

struct SharedStateInMemoryView: View {
  @Bindable var store: StoreOf<SharedStateInMemory>

  var body: some View {
    TabView(selection: $store.currentTab.sending(\.selectTab)) {
      CounterTabView(
        store: store.scope(\.counter, action: \.counter)
      )
      .tag(SharedStateInMemory.Tab.counter)
      .tabItem { Text("Counter") }

      ProfileTabView(
        store: store.scope(\.profile, action: \.profile)
      )
      .tag(SharedStateInMemory.Tab.profile)
      .tabItem { Text("Profile") }
    }
    .navigationTitle("Shared State Demo")
  }
}

extension SharedStateInMemory {
  @Reducer
  struct CounterTab {
    @ObservableState
    struct State: Equatable {
      @Presents var alert: AlertState<Action.Alert>?
      @Shared(.stats) var stats = Stats()
    }

    enum Action {
      case alert(PresentationAction<Alert>)
      case decrementButtonTapped
      case incrementButtonTapped
      case isPrimeButtonTapped

      enum Alert: Equatable {}
    }

    var body: some Reducer<State, Action> {
      Reduce { state, action in
        switch action {
        case .alert:
          return .none

        case .decrementButtonTapped:
          state.$stats.withLock { $0.decrement() }
          return .none

        case .incrementButtonTapped:
          state.$stats.withLock { $0.increment() }
          return .none

        case .isPrimeButtonTapped:
          state.alert = AlertState {
            TextState(
              isPrime(state.stats.count)
                ? "👍 The number \(state.stats.count) is prime!"
                : "👎 The number \(state.stats.count) is not prime :("
            )
          }
          return .none
        }
      }
      .ifLet(\.$alert, action: \.alert)
    }
  }

  @Reducer
  struct ProfileTab {
    @ObservableState
    struct State: Equatable {
      @Shared(.stats) var stats = Stats()
    }

    enum Action {
      case resetStatsButtonTapped
    }

    var body: some Reducer<State, Action> {
      Reduce { state, action in
        switch action {
        case .resetStatsButtonTapped:
          state.$stats.withLock { $0 = Stats() }
          return .none
        }
      }
    }
  }
}

private struct CounterTabView: View {
  @Bindable var store: StoreOf<SharedStateInMemory.CounterTab>

  var body: some View {
    Form {
      Text(template: readMe, .caption)

      VStack(spacing: 16) {
        HStack {
          Button {
            store.send(.decrementButtonTapped)
          } label: {
            Image(systemName: "minus")
          }

          Text("\(store.stats.count)")
            .monospacedDigit()

          Button {
            store.send(.incrementButtonTapped)
          } label: {
            Image(systemName: "plus")
          }
        }

        Button("Is this prime?") { store.send(.isPrimeButtonTapped) }
      }
    }
    .buttonStyle(.borderless)
    .alert($store.scope(\.alert, action: \.alert))
  }
}

private struct ProfileTabView: View {
  let store: StoreOf<SharedStateInMemory.ProfileTab>

  var body: some View {
    Form {
      Text(
        template: """
          This tab shows state from the previous tab, and it is capable of resetting all of the \
          state back to 0.

          This shows that it is possible for each screen to model its state in the way that makes \
          the most sense for it, while still allowing the state and mutations to be shared \
          across independent screens.
          """,
        .caption
      )

      VStack(spacing: 16) {
        Text("Current count: \(store.stats.count)")
        Text("Max count: \(store.stats.maxCount)")
        Text("Min count: \(store.stats.minCount)")
        Text("Total number of count events: \(store.stats.numberOfCounts)")
        Button("Reset") { store.send(.resetStatsButtonTapped) }
      }
    }
    .buttonStyle(.borderless)
  }
}

#Preview {
  SharedStateInMemoryView(
    store: Store(initialState: SharedStateInMemory.State()) { SharedStateInMemory() }
  )
}

extension SharedKey where Self == InMemoryKey<Stats> {
  fileprivate static var stats: Self {
    inMemory("stats")
  }
}

/// Checks if a number is prime or not.
private func isPrime(_ p: Int) -> Bool {
  if p <= 1 { return false }
  if p <= 3 { return true }
  for i in 2...Int(sqrtf(Float(p))) {
    if p % i == 0 { return false }
  }
  return true
}

```

### Core Architecture Module: `Examples/CaseStudies/SwiftUICaseStudies/02-SharedState-Onboarding.swift`
```
import ComposableArchitecture
import SwiftUI

private let readMe = """
  This case study demonstrates how to use shared data in order to implement a complex sign up flow.

  The sign up flow consists of 3 steps, each of which can mutate a bit of shared data, and a final \
  summary screen. The summary screen also allows the user to make any last minute edits to any of \
  the data in the previous steps.
  """

struct SignUpData: Equatable {
  var email = ""
  var firstName = ""
  var lastName = ""
  var password = ""
  var passwordConfirmation = ""
  var phoneNumber = ""
  var topics: Set<Topic> = []

  enum Topic: String, Identifiable, CaseIterable {
    case advancedSwift = "Advanced Swift"
    case composableArchitecture = "Composable Architecture"
    case concurrency = "Concurrency"
    case modernSwiftUI = "Modern SwiftUI"
    case swiftUI = "SwiftUI"
    case testing = "Testing"
    var id: Self { self }
  }
}

@Reducer
private struct SignUpFeature {
  @Reducer
  enum Path {
    case basics(BasicsFeature)
    case personalInfo(PersonalInfoFeature)
    case summary(SummaryFeature)
    case topics(TopicsFeature)
  }
  @ObservableState
  struct State {
    var path = StackState<Path.State>()
    @Shared var signUpData: SignUpData
  }
  enum Action {
    case path(StackActionOf<Path>)
  }
  var body: some ReducerOf<Self> {
    Reduce { state, action in
      switch action {
      case .path(.element(id: _, action: .topics(.delegate(.stepFinished)))):
        state.path.append(.summary(SummaryFeature.State(signUpData: state.$signUpData)))
        return .none

      case .path:
        return .none
      }
    }
    .forEach(\.path, action: \.path)
  }
}

struct SignUpFlow: View {
  @Bindable private var store = Store(
    initialState: SignUpFeature.State(signUpData: Shared(value: SignUpData()))
  ) {
    SignUpFeature()
  }

  var body: some View {
    NavigationStack(path: $store.scope(\.path, action: \.path)) {
      Form {
        Section {
          Text(readMe)
        }
        Section {
          NavigationLink(
            "Sign up",
            state: SignUpFeature.Path.State.basics(
              BasicsFeature.State(signUpData: store.$signUpData)
            )
          )
        }
      }
      .navigationTitle("Sign up")
    } destination: { store in
      switch store.case {
      case .basics(let store):
        BasicsStep(store: store)
      case .personalInfo(let store):
        PersonalInfoStep(store: store)
      case .summary(let store):
        SummaryStep(store: store)
      case .topics(let store):
        TopicsStep(store: store)
      }
    }
  }
}

@Reducer
private struct BasicsFeature {
  @ObservableState
  struct State {
    var isEditingFromSummary = false
    @Shared var signUpData: SignUpData
  }
  enum Action: BindableAction {
    case binding(BindingAction<State>)
  }
  var body: some ReducerOf<Self> {
    BindingReducer()
  }
}

private struct BasicsStep: View {
  @Environment(\.dismiss) private var dismiss
  @Bindable var store: StoreOf<BasicsFeature>

  var body: some View {
    @Binding(store.$signUpData) var signUpData
    Form {
      Section {
        TextField("Email", text: $signUpData.email)
      }
      Section {
        SecureField("Password", text: $signUpData.password)
        SecureField("Password confirmation", text: $signUpData.passwordConfirmation)
      }
    }
    .navigationTitle("Basics")
    .toolbar {
      ToolbarItem {
        if store.isEditingFromSummary {
          Button("Done") {
            dismiss()
          }
        } else {
          NavigationLink(
            state: SignUpFeature.Path.State.personalInfo(
              PersonalInfoFeature.State(signUpData: store.$signUpData)
            )
          ) {
            Text("Next")
          }
        }
      }
    }
  }
}

@Reducer
private struct PersonalInfoFeature {
  @ObservableState
  struct State {
    var isEditingFromSummary = false
    @Shared var signUpData: SignUpData
  }
  enum Action: BindableAction {
    case binding(BindingAction<State>)
  }
  @Dependency(\.dismiss) var dismiss
  var body: some ReducerOf<Self> {
    BindingReducer()
  }
}

private struct PersonalInfoStep: View {
  @Environment(\.dismiss) private var dismiss
  @Bindable var store: StoreOf<PersonalInfoFeature>

  var body: some View {
    @Binding(store.$signUpData) var signUpData
    Form {
      Section {
        TextField("First name", text: $signUpData.firstName)
        TextField("Last name", text: $signUpData.lastName)
        TextField("Phone number", text: $signUpData.phoneNumber)
      }
    }
    .navigationTitle("Personal info")
    .toolbar {
      ToolbarItem {
        if store.isEditingFromSummary {
          Button("Done") {
            dismiss()
          }
        } else {
          NavigationLink(
            "Next",
            state: SignUpFeature.Path.State.topics(
              TopicsFeature.State(topics: store.$signUpData.topics)
            )
          )
        }
      }
    }
  }
}

@Reducer
private struct TopicsFeature {
  @ObservableState
  struct State {
    @Presents var alert: AlertState<Never>?
    var isEditingFromSummary = false
    @Shared var topics: Set<SignUpData.Topic>
  }
  enum Action: BindableAction {
    case alert(PresentationAction<Never>)
    case binding(BindingAction<State>)
    case delegate(Delegate)
    case doneButtonTapped
    case nextButtonTapped
    enum Delegate {
      case stepFinished
    }
  }
  @Dependency(\.dismiss) var dismiss
  var body: some ReducerOf<Self> {
    BindingReducer()
    Reduce { state, action in
      switch action {
      case .alert:
        return .none
      case .binding:
        return .none
      case .delegate:
        return .none
      case .doneButtonTapped:
        if state.topics.isEmpty {
          state.alert = AlertState {
            TextState("Please choose at least one topic.")
          }
          return .none
        } else {
          return .run { _ in await dismiss() }
        }
      case .nextButtonTapped:
        if state.topics.isEmpty {
          state.alert = AlertState {
            TextState("Please choose at least one topic.")
          }
          return .none
        } else {
          return .send(.delegate(.stepFinished))
        }
      }
    }
    .ifLet(\.alert, action: \.alert)
  }
}

private struct TopicsStep: View {
  @Bindable var store: StoreOf<TopicsFeature>

  var body: some View {
    @Binding(store.$topics) var topics
    Form {
      Section {
        Text("Please choose all the topics you are interested in.")
      }
      Section {
        ForEach(SignUpData.Topic.allCases) { topic in
          Toggle(isOn: $topics[contains: topic]) {
            Text(topic.rawValue)
          }
        }
      }
    }
    .navigationTitle("Topics")
    .alert($store.scope(\.alert, action: \.alert))
    .toolbar {
      ToolbarItem {
        if store.isEditingFromSummary {
          Button("Done") {
            store.send(.doneButtonTapped)
          }
        } else {
          Button("Next") {
            store.send(.nextButtonTapped)
          }
        }
      }
    }
    .interactiveDismissDisabled()
  }
}

@Reducer
private struct SummaryFeature {
  @Reducer
  enum Destination {
    case alert(AlertState<Never>)
    case basics(BasicsFeature)
    case personalInfo(PersonalInfoFeature)
    case topics(TopicsFeature)
  }
  @ObservableState
  struct State {
    @Presents var destination: Destination.State?
    @Shared var signUpData: SignUpData
  }
  enum Action {
    case destination(PresentationAction<Destination.Action>)
    case editFavoriteTopicsButtonTapped
    case editPersonalInfoButtonTapped
    case editRequiredInfoButtonTapped
    case submitButtonTapped
  }
  var body: some ReducerOf<Self> {
    Reduce { state, action in
      switch action {
      case .destination:
        return .none
      case .editFavoriteTopicsButtonTapped:
        state.destination = .topics(
          TopicsFeature.State(
            isEditingFromSummary: true,
            topics: state.$signUpData.topics
          )
        )
        return .none
      case .editPersonalInfoButtonTapped:
        state.destination = .personalInfo(
          PersonalInfoFeature.State(
            isEditingFromSummary: true,
            signUpData: state.$signUpData
          )
        )
        return .none
      case .editRequiredInfoButtonTapped:
        state.destination = .basics(
          BasicsFeature.State(
            isEditingFromSummary: true,
            signUpData: state.$signUpData
          )
        )
        return .none
      case .submitButtonTapped:
        state.destination = .alert(
          AlertState {
            TextState("Thank you for signing up!")
          }
        )
        return .none
      }
    }
    .ifLet(\.$destination, action: \.destination)
  }
}

private struct SummaryStep: View {
  @Bindable var store: StoreOf<SummaryFeature>

  var body: some View {
    Form {
      Section {
        Text(store.signUpData.email)
        Text(String(repeating: "•", count: store.signUpData.password.count))
      } header: {
        HStack {
          Text("Required info")
          Spacer()
          Button("Edit") {
            store.send(.editRequiredInfoButtonTapped)
          }
          .font(.caption)
        }
      }

      Section {
        Text(store.signUpData.firstName)
        Text(store.signUpData.lastName)
        Text(store.signUpData.phoneNumber)
      } header: {
        HStack {
          Text("Personal info")
          Spacer()
          Button("Edit") {
            store.send(.editPersonalInfoButtonTapped)
          }
          .font(.caption)
        }
      }

      Section {
        ForEach(store.signUpData.topics.sorted(by: { $0.rawValue < $1.rawValue })) { topic in
          Text(topic.rawValue)
        }
      } header: {
        HStack {
          Text("Favorite topics")
          Spacer()
          Button("Edit") {
            store.send(.editFavoriteTopicsButtonTapped)
 
```

### Core Architecture Module: `Examples/CaseStudies/SwiftUICaseStudies/02-SharedState-UserDefaults.swift`
```
import ComposableArchitecture
import SwiftUI

private let readMe = """
  This screen demonstrates how multiple independent screens can share state in the Composable \
  Architecture through user defaults (i.e. "app storage"). Each tab manages its own state, and \
  could be in separate modules, but changes in one tab are immediately reflected in the other, and \
  all changes are persisted to use defaults.

  This tab has its own state, consisting of a count value that can be incremented and decremented, \
  as well as an alert value that is set when asking if the current count is prime.
  """

@Reducer
struct SharedStateUserDefaults {
  enum Tab { case counter, profile }

  @ObservableState
  struct State: Equatable {
    var currentTab = Tab.counter
    var counter = CounterTab.State()
    var profile = ProfileTab.State()
  }

  enum Action {
    case counter(CounterTab.Action)
    case profile(ProfileTab.Action)
    case selectTab(Tab)
  }

  var body: some Reducer<State, Action> {
    Scope(\.counter, action: \.counter) {
      CounterTab()
    }

    Scope(\.profile, action: \.profile) {
      ProfileTab()
    }

    Reduce { state, action in
      switch action {
      case .counter, .profile:
        return .none
      case .selectTab(let tab):
        state.currentTab = tab
        return .none
      }
    }
  }
}

struct SharedStateUserDefaultsView: View {
  @Bindable var store: StoreOf<SharedStateUserDefaults>

  var body: some View {
    TabView(selection: $store.currentTab.sending(\.selectTab)) {
      CounterTabView(
        store: store.scope(\.counter, action: \.counter)
      )
      .tag(SharedStateUserDefaults.Tab.counter)
      .tabItem { Text("Counter") }

      ProfileTabView(
        store: store.scope(\.profile, action: \.profile)
      )
      .tag(SharedStateUserDefaults.Tab.profile)
      .tabItem { Text("Profile") }
    }
    .navigationTitle("Shared State Demo")
  }
}

extension SharedStateUserDefaults {
  @Reducer
  struct CounterTab {
    @ObservableState
    struct State: Equatable {
      @Presents var alert: AlertState<Action.Alert>?
      @Shared(.count) var count = 0
    }

    enum Action {
      case alert(PresentationAction<Alert>)
      case decrementButtonTapped
      case incrementButtonTapped
      case isPrimeButtonTapped

      enum Alert: Equatable {}
    }

    var body: some Reducer<State, Action> {
      Reduce { state, action in
        switch action {
        case .alert:
          return .none

        case .decrementButtonTapped:
          state.$count.withLock { $0 -= 1 }
          return .none

        case .incrementButtonTapped:
          state.$count.withLock { $0 += 1 }
          return .none

        case .isPrimeButtonTapped:
          state.alert = AlertState {
            TextState(
              isPrime(state.count)
                ? "👍 The number \(state.count) is prime!"
                : "👎 The number \(state.count) is not prime :("
            )
          }
          return .none
        }
      }
      .ifLet(\.$alert, action: \.alert)
    }
  }

  @Reducer
  struct ProfileTab {
    @ObservableState
    struct State: Equatable {
      @Shared(.count) var count = 0
    }

    enum Action {
      case resetStatsButtonTapped
    }

    var body: some Reducer<State, Action> {
      Reduce { state, action in
        switch action {
        case .resetStatsButtonTapped:
          state.$count.withLock { $0 = 0 }
          return .none
        }
      }
    }
  }
}

private struct CounterTabView: View {
  @Bindable var store: StoreOf<SharedStateUserDefaults.CounterTab>

  var body: some View {
    Form {
      Text(template: readMe, .caption)

      VStack(spacing: 16) {
        HStack {
          Button {
            store.send(.decrementButtonTapped)
          } label: {
            Image(systemName: "minus")
          }

          Text("\(store.count)")
            .monospacedDigit()

          Button {
            store.send(.incrementButtonTapped)
          } label: {
            Image(systemName: "plus")
          }
        }

        Button("Is this prime?") { store.send(.isPrimeButtonTapped) }
      }
    }
    .buttonStyle(.borderless)
    .alert($store.scope(\.alert, action: \.alert))
  }
}

private struct ProfileTabView: View {
  let store: StoreOf<SharedStateUserDefaults.ProfileTab>

  var body: some View {
    Form {
      Text(
        template: """
          This tab shows the count from the previous tab, and it is capable of resetting the count \
          back to 0.

          This shows that it is possible for each screen to model its state in the way that makes \
          the most sense for it, while still allowing the state and mutations to be shared \
          across independent screens.
          """,
        .caption
      )

      VStack(spacing: 16) {
        Text("Current count: \(store.count)")
        Button("Reset") { store.send(.resetStatsButtonTapped) }
      }
    }
    .buttonStyle(.borderless)
  }
}

extension SharedKey where Self == AppStorageKey<Int> {
  fileprivate static var count: Self {
    appStorage("sharedStateDemoCount")
  }
}

#Preview {
  SharedStateUserDefaultsView(
    store: Store(initialState: SharedStateUserDefaults.State()) { SharedStateUserDefaults() }
  )
}

/// Checks if a number is prime or not.
private func isPrime(_ p: Int) -> Bool {
  if p <= 1 { return false }
  if p <= 3 { return true }
  for i in 2...Int(sqrtf(Float(p))) {
    if p % i == 0 { return false }
  }
  return true
}

```

### Core Architecture Module: `Examples/CaseStudies/UIKitCaseStudies/ListsOfState.swift`
```
import ComposableArchitecture
import UIKit

@Reducer
struct CounterList {
  @ObservableState
  struct State: Equatable {
    var counters: IdentifiedArrayOf<Counter.State> = []
  }

  enum Action {
    case counters(IdentifiedActionOf<Counter>)
  }

  var body: some Reducer<State, Action> {
    EmptyReducer()
      .forEach(\.counters, action: \.counters) {
        Counter()
      }
  }
}

let cellIdentifier = "Cell"

final class CountersTableViewController: UITableViewController {
  private let store: StoreOf<CounterList>

  var observations: [IndexPath: ObserveToken] = [:]

  init(store: StoreOf<CounterList>) {
    self.store = store
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()

    title = "Lists"

    tableView.register(UITableViewCell.self, forCellReuseIdentifier: cellIdentifier)
  }

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    store.counters.count
  }

  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath)
    -> UITableViewCell
  {
    let cell = tableView.dequeueReusableCell(withIdentifier: cellIdentifier, for: indexPath)
    cell.accessoryType = .disclosureIndicator
    observations[indexPath]?.cancel()
    observations[indexPath] = observe { [weak self] in
      guard let self else { return }
      cell.textLabel?.text = "\(store.counters[indexPath.row].count)"
    }
    return cell
  }

  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let id = store.counters[indexPath.row].id
    if let store = store.scope(\.counters[id: id], action: \.counters[id: id]) {
      navigationController?.pushViewController(CounterViewController(store: store), animated: true)
    }
  }
}

#Preview {
  UINavigationController(
    rootViewController: CountersTableViewController(
      store: Store(
        initialState: CounterList.State(
          counters: [
            Counter.State(),
            Counter.State(),
            Counter.State(),
          ]
        )
      ) {
        CounterList()
      }
    )
  )
}

```

### Core Architecture Module: `Examples/CaseStudies/tvOSCaseStudies/Core.swift`
```
import ComposableArchitecture

@Reducer
struct Root {
  struct State {
    var focus = Focus.State()
  }

  enum Action {
    case focus(Focus.Action)
  }

  var body: some Reducer<State, Action> {
    Scope(\.focus, action: \.focus) {
      Focus()
    }
  }
}

```

### Core Architecture Module: `Examples/TicTacToe/tic-tac-toe/Sources/AppCore/AppCore.swift`
```
import ComposableArchitecture
import LoginCore
import NewGameCore

@Reducer
public enum TicTacToe {
  case login(Login)
  case newGame(NewGame)

  public static var body: some ReducerOf<Self> {
    Reduce { state, action in
      switch action {
      case .login(.twoFactor(.presented(.twoFactorResponse(.success)))):
        state = .newGame(NewGame.State())
        return .none

      case .login(.loginResponse(.success(let response))) where !response.twoFactorRequired:
        state = .newGame(NewGame.State())
        return .none

      case .login:
        return .none

      case .newGame(.logoutButtonTapped):
        state = .login(Login.State())
        return .none

      case .newGame:
        return .none
      }
    }
    .ifCaseLet(\.login, action: \.login) {
      Login()
    }
    .ifCaseLet(\.newGame, action: \.newGame) {
      NewGame()
    }
  }
}
extension TicTacToe.State: Equatable {}

```

### Core Architecture Module: `Examples/TicTacToe/tic-tac-toe/Sources/GameCore/GameCore.swift`
```
import ComposableArchitecture
import SwiftUI

@Reducer
public struct Game: Sendable {
  @ObservableState
  public struct State: Equatable {
    public var board: Three<Three<Player?>> = .empty
    public var currentPlayer: Player = .x
    public let oPlayerName: String
    public let xPlayerName: String

    public init(oPlayerName: String, xPlayerName: String) {
      self.oPlayerName = oPlayerName
      self.xPlayerName = xPlayerName
    }

    public var currentPlayerName: String {
      switch self.currentPlayer {
      case .o: return self.oPlayerName
      case .x: return self.xPlayerName
      }
    }
  }

  public enum Action: Sendable {
    case cellTapped(row: Int, column: Int)
    case playAgainButtonTapped
    case quitButtonTapped
  }

  @Dependency(\.dismiss) var dismiss

  public init() {}

  public var body: some Reducer<State, Action> {
    Reduce { state, action in
      switch action {
      case .cellTapped(let row, let column):
        guard
          state.board[row][column] == nil,
          !state.board.hasWinner
        else { return .none }

        state.board[row][column] = state.currentPlayer

        if !state.board.hasWinner {
          state.currentPlayer.toggle()
        }

        return .none

      case .playAgainButtonTapped:
        state = Game.State(oPlayerName: state.oPlayerName, xPlayerName: state.xPlayerName)
        return .none

      case .quitButtonTapped:
        return .run { _ in
          await self.dismiss()
        }
      }
    }
  }
}

public enum Player: Equatable, Sendable {
  case o
  case x

  public mutating func toggle() {
    switch self {
    case .o: self = .x
    case .x: self = .o
    }
  }

  public var label: String {
    switch self {
    case .o: return "⭕️"
    case .x: return "❌"
    }
  }
}

extension Three<Three<Player?>> {
  public static let empty = Self(
    .init(nil, nil, nil),
    .init(nil, nil, nil),
    .init(nil, nil, nil)
  )

  public var isFilled: Bool {
    self.allSatisfy { $0.allSatisfy { $0 != nil } }
  }

  func hasWin(_ player: Player) -> Bool {
    let winConditions = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [6, 4, 2],
    ]

    for condition in winConditions {
      let matches =
        condition
        .map { self[$0 % 3][$0 / 3] }
      let matchCount =
        matches
        .filter { $0 == player }
        .count

      if matchCount == 3 {
        return true
      }
    }
    return false
  }

  public var hasWinner: Bool {
    hasWin(.x) || hasWin(.o)
  }
}

```

### Core Architecture Module: `Examples/TicTacToe/tic-tac-toe/Sources/GameCore/Three.swift`
```
/// A collection of three elements.
public struct Three<Element> {
  public var first: Element
  public var second: Element
  public var third: Element

  public init(_ first: Element, _ second: Element, _ third: Element) {
    self.first = first
    self.second = second
    self.third = third
  }

  public func map<T>(_ transform: (Element) -> T) -> Three<T> {
    .init(transform(self.first), transform(self.second), transform(self.third))
  }
}

extension Three: MutableCollection {
  public subscript(offset: Int) -> Element {
    _read {
      switch offset {
      case 0: yield self.first
      case 1: yield self.second
      case 2: yield self.third
      default: fatalError()
      }
    }
    _modify {
      switch offset {
      case 0: yield &self.first
      case 1: yield &self.second
      case 2: yield &self.third
      default: fatalError()
      }
    }
  }

  public var startIndex: Int { 0 }
  public var endIndex: Int { 3 }
  public func index(after i: Int) -> Int { i + 1 }
}

extension Three: RandomAccessCollection {}

extension Three: Equatable where Element: Equatable {}
extension Three: Hashable where Element: Hashable {}
extension Three: Sendable where Element: Sendable {}

```

### Core Architecture Module: `Examples/TicTacToe/tic-tac-toe/Sources/LoginCore/LoginCore.swift`
```
import AuthenticationClient
import ComposableArchitecture
import Dispatch
import TwoFactorCore

@Reducer
public struct Login: Sendable {
  @ObservableState
  public struct State: Equatable {
    @Presents public var alert: AlertState<Action.Alert>?
    public var email = ""
    public var isFormValid = false
    public var isLoginRequestInFlight = false
    public var password = ""
    @Presents public var twoFactor: TwoFactor.State?

    public init() {}
  }

  public enum Action: Sendable, ViewAction {
    case alert(PresentationAction<Alert>)
    case loginResponse(Result<AuthenticationResponse, any Error>)
    case twoFactor(PresentationAction<TwoFactor.Action>)
    case view(View)

    public enum Alert: Equatable, Sendable {}

    @CasePathable
    public enum View: BindableAction, Sendable {
      case binding(BindingAction<State>)
      case loginButtonTapped
    }
  }

  @Dependency(\.authenticationClient) var authenticationClient

  public init() {}

  public var body: some Reducer<State, Action> {
    BindingReducer(action: \.view)
    Reduce { state, action in
      switch action {
      case .alert:
        return .none

      case .loginResponse(.success(let response)):
        state.isLoginRequestInFlight = false
        if response.twoFactorRequired {
          state.twoFactor = TwoFactor.State(token: response.token)
        }
        return .none

      case .loginResponse(.failure(let error)):
        state.alert = AlertState { TextState(error.localizedDescription) }
        state.isLoginRequestInFlight = false
        return .none

      case .twoFactor:
        return .none

      case .view(.binding):
        state.isFormValid = !state.email.isEmpty && !state.password.isEmpty
        return .none

      case .view(.loginButtonTapped):
        state.isLoginRequestInFlight = true
        return .run { [email = state.email, password = state.password] send in
          await send(
            .loginResponse(
              Result {
                try await self.authenticationClient.login(email: email, password: password)
              }
            )
          )
        }
      }
    }
    .ifLet(\.$alert, action: \.alert)
    .ifLet(\.$twoFactor, action: \.twoFactor) {
      TwoFactor()
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3950** (2026-09-18): **Backport Xcode 27 support to TCA 1.23**
  *Symptoms*: ### Description  Unfortunately my team still needs to support iOS 15, so we've been stuck on TCA 1.23 for months.  It was fine until Xcode 27 beta 1. I was hoping that it could be an Xcode regression but we're at beta 3 now and the error persists.  I checked on my machine and cherry-picking #3931 fixes the compilation error. Could that be backported to 1.23?  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  Being able to compile a version of the project that supports iOS 15 using Xcode 27.  ### Actual behavior  The compiler fails with this error:  ``` Sources/ComposableArchitecture/Observation/NavigationStack+Observation.swift:167:17 Cannot form key path to main actor-isolated subscript 'subscript(fileID:filePath:line:column:)' ```  ### Reproducing project  No extra project necessary, simply try to compile TCA tag 1.23.2 on Xcode 27.  ### The Composable Architecture version information  1.23.2  ### Destination operating system  iOS 15  ### Xcode version information  Version 27.0 beta 3 (27A5218g)  ### Swift Compiler version information  ```shell swift-driver version: 1.168.4 Apple Swift
  **Post-Mortem & Fix Analysis**:
  > Hi @igorcamilo, thanks for brining this up. We have published a [1.23.3 release](https://github.com/pointfreeco/swift-composable-architecture/releases/tag/1.23.3).

- **Issue #3947** (2026-07-08): **Extra argument 'isolation' in call**
  *Symptoms*: ### Description  Description Hi!  swift-composable-architecture dependency is not built  ``` TestStore. private func _withIssueContext<R>( fileID: StaticString,  filePath: StaticString,  line: Uint, column: Uint, isolation: isolated (any Actor)? = #isolation,  operation: () async throws -> R) async rethrows -> R {      let result = try await withIssueContext(  fileID: fileID,  filePath: filePath,  line: line,  column: column,  isolation: isolation,  operation: operation  )     awaitTask.yield()     return result } ```  Extra argument 'isolation' in call  The Composable Architecture version information '1.26.0'  Destination operating system 'iOS 26'  Xcode version information Version 26.6 (17F113)  Swift Compiler version information Target: iOS26.5  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproducing project  _No response_  ### The Composable Architecture version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  `
  **Post-Mortem & Fix Analysis**:
  > Hi @RubeksLS, please make sure you are using the newest xctest-dynamic-overlay. You should be able to right click it in Xcode and click "Update", and that should update it to 1.10.1. Sometimes Xcode can be finicky in updating dependencies so you may need to close/re-open Xcode, or even reset package caches.
  > Yes, I tried to do that(change version, clean build fodler, delete derived data, terminate xcode, reload system).  In xctest-dynamic-overlay there is a method:  ``` public func withIssueContext<R>(   fileID: StaticString,   filePath: StaticString,   line: UInt,   column: UInt,   operation: () async throws -> R ) async rethrows -> R {   try await IssueContext.$current.withValue(     IssueContext(fileID: fileID, filePath: filePath, line: line, column: column),     operation: operation   ) } ``` which does not have isolation in the method signature.  In swift-composable-architecture, however, the _withIssueContext method passes an isolation parameter. ``` let result = try await withIssueContext(     fileID: fileID,     filePath: filePath,     line: line,     column: column,     isolation: isolation,  <------- here     operation: operation   ) ```  My swift-composable-architecture version is 1.26.0. My xctest-dynamic-overlay version is 1.10.1  <img width="310" height="243" alt="Image" src=
  > > In xctest-dynamic-overlay there is a method: >  > ``` > public func withIssueContext<R>( >   fileID: StaticString, >   filePath: StaticString, >   line: UInt, >   column: UInt, >   operation: () async throws -> R > ) async rethrows -> R { >   try await IssueContext.$current.withValue( >     IssueContext(fileID: fileID, filePath: filePath, line: line, column: column), >     operation: operation >   ) > } > ``` >  > which does not have isolation in the method signature.  You still seem to be on an old version of xctest-dynamic-overlay, because that is not what the code looks like on 1.10.1:  https://github.com/pointfreeco/swift-issue-reporting/blob/401bf70d95bfe8db2a1dc619f9e175a85c089321/Sources/IssueReporting/WithIssueContext.swift#L38-L51  The `isolation` parameter is only missing when compiling with Swift <6.0, which shouldn't be the case for building in Xcode 26.6.  If you can provide a minimal project that reproduces the problem I can take a look at it. But I am certain that ther

- **Issue #3938** (2026-06-18): **Error with new `store.scope` syntax and `fullScreenCover`**
  *Symptoms*: ### Description  There is a compiler error => `Type 'Void' cannot conform to 'Identifiable'` with` fullScreenCover` It happens when using the new syntax for `store.scope` and with enum without reducer.   nested enum Reducer: ``` @Reducer     enum Destination {         case child(ChildFeature)         case other     } ``` view: ``` Text("Hello, World!")             .fullScreenCover( // => OK                 item: $store.scope(state: \.$destination, action: \.destination).child,                 content: { _ in                     Text("Ok")                 }             )             .fullScreenCover( // => OK                 item: $store.scope(state: \.destination?.other, action: \.destination.other),                 content: { _ in                     Text("Ok")                 }             )             .fullScreenCover( // => Type 'Void' cannot conform to 'Identifiable'                 item: $store.scope(state: \.$destination, action: \.destination).other,                 content: { _ in                     Text("Ok")                 }             ) ```  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ###

- **Issue #3933** (2026-06-09): **Documentation: Outdated Store.scope symbol reference in Performance article**
  *Symptoms*: ### Description  `Performance.md` contains a DocC symbol reference to the older `Store/scope(state:action:)` API:  ``Store/scope(state:action:)-90255``  The surrounding references in the same article already use the newer `Store/scope(_:action:)` symbol spelling introduced in #3923.  Location:  `Sources/ComposableArchitecture/Documentation.docc/Articles/Performance.md`  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  The article should reference the current `Store/scope(_:action:)` symbol.  ### Actual behavior  The article still references the older `Store/scope(state:action:)-90255` symbol.  ### Reproducing project  N/A. Documentation issue.  ### The Composable Architecture version information  main  ### Destination operating system  N/A. Documentation issue.  ### Xcode version information  N/A. Documentation issue.  ### Swift Compiler version information  ```shell N/A. Documentation issue. ```

- **Issue #3930** (2026-06-04): **'subscript(dynamicMember:)' is unavailable in iOS**
  *Symptoms*: ### Description  I get compile error saying that 'subscript(dynamicMember:)' was obsoleted in iOS 17  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  replace 'subscript(dynamicMember:)' was obsoleted in iOS 17  ### Actual behavior  _No response_  ### Reproducing project  _No response_  ### The Composable Architecture version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  swift-driver version: 1.148.6 Apple Swift version 6.3.2 (swiftlang-6.3.2.1.108 clang-2100.1.1.101) ```
  **Post-Mortem & Fix Analysis**:
  > @DosZlmnv Closing for the same reason as #3929. We're happy to receive legit bug reports, but this isn't it. Please take the time to provide an issue that is actionable.

- **Issue #3929** (2026-06-04): **TestStore,_withIssueContext: Extra argument 'isolation' in call**
  *Symptoms*: ### Description  Project does not compile because of this issue  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  rm extra argument in withIssueContext method call  ### Actual behavior  _No response_  ### Reproducing project  _No response_  ### The Composable Architecture version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > <img width="296" height="261" alt="Image" src="https://github.com/user-attachments/assets/69d8d3d7-8199-4596-adf5-0937e27acedd" />  @DosZlmnv We're happy to investigate issues, but you haven't provided any information for reproducing. I'm going to close this, but I'd suggest you make sure you're on the latest Xcode, and are pointing to the latest package versions of everything involved.  If you continue to have an issue, feel free to reopen this, or open another issue, with as much detail as possible (for example filling out all of the <em>No response</em>s above).
  > In case anyone else comes across this issue: xctest-dynamic-overlay was outdated.  The isolation parameter was added in 1.5.2, but TCA’s Package.swift specifies a min version of 1.3.0.

- **Issue #3921** (2026-05-06): **SyncUps: Main actor-isolated conformance of 'SyncUp' to 'Equatable' cannot satisfy conformance requirement for a 'Sendable' type parameter**
  *Symptoms*: ### Description  Proceeding with Building SyncUps tutorial results in error diagnostics on Sync-up form, Section 1, Step 9  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  No error diagnostic occur when copying/writing code from tutorial.  ### Actual behavior  Step 9 of Section 1 of Sync-up Form tutorial generates errors: `Main actor-isolated conformance of 'SyncUp' to 'Equatable' cannot satisfy conformance requirement for a 'Sendable' type parameter ` on every usage of binding `$store.syncup`  ### Reproducing project  [syncups.zip](https://github.com/user-attachments/files/27302201/syncups.zip)  ### The Composable Architecture version information  1.25.5  ### Destination operating system  26.4.1  ### Xcode version information  26.4.1  ### Swift Compiler version information  ```shell Apple Swift version 6.3.1 (swiftlang-6.3.1.1.2 clang-2100.0.123.102) Target: arm64-apple-macosx26.0 ```
  **Post-Mortem & Fix Analysis**:
  > Hi @svmkr-dev, if you want to use default main actor isolation then you just need to mark the domain types (`SyncUp`, `Attendee` and `Meeting`) as `nonisolated`.  Since this isn't an issue with the library I am going to convert it to a discussion. Please feel free to continue the conversation over there!

- **Issue #3918** (2026-06-02): **Error when archiving via xcodebuild archive**
  *Symptoms*: ### Description  I have a Swift Package module that uses TCA. I want to be able to distribute this as an .xcframework. To achieve this I am using `xcodebuild archive (...)`. When doing so I get an error:  ```  /SourcePackages/checkouts/swift-composable-architecture/Sources/ComposableArchitecture/Internal/Logger.swift:8:4: 'Published' aliases 'Combine.Published' and cannot be used as property wrapper here because 'Combine' was not imported by this file   @Published public var logs: [String] = []    ^ ```  I set up a minimal project where the issue is reproducible: https://github.com/joaomvfsantos/TCACompileIssue  The repo contains a README with detailed command instructions.  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  I would expect `xcodebuild archive` to finish without errors.  ### Actual behavior  The error `'Published' aliases 'Combine.Published' and cannot be used as property wrapper here because 'Combine' was not imported by this file` is thrown  ### Reproducing project  https://github.com/joaomvfsantos/TCACompileIssue  ### The Composable Architecture version information  1.2
  **Post-Mortem & Fix Analysis**:
  > @joaomvfsantos We unfortunately don't have the infrastructure in place to support build systems beyond the basics, but the error above is at least straightforward enough that if you opened a PR we would be happy to merge. Can you `import Combine` in that file, test it with your setup, and if all issues are addressed and your XCFramework build is clean, open a PR?  We would also be open to continuous integration improvements to catch errors like these, with the caveat that if that CI becomes fragile we may have to disable it in the future.
  > @stephencelis Makes sense. Will create a PR in the next days.
  > @stephencelis I created a PR. There is more explanation on the root cause. I have the feeling it seems more of a bandaid to overcome xcodebuild bugs than anything else, but at least it unblocks me.

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

### Incident Patch 1: `ead11e04` (2026-07-21)
**Commit Message**: Fix errors in stack navigation documentation examples (#3955)

* docs: Fix path mutation in stack navigation example

* docs: Fix reducer in stack navigation test examples

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/StackBasedNavigation.md` (modified, +3/-3)
```diff
@@ -266,7 +266,7 @@ methods, such as ``StackState/popLast()``, ``StackState/pop(from:)`` and more:
 
 ```swift
 case .closeButtonTapped:
-  state.popLast()
+  state.path.popLast()
   return .none
 ```
 
@@ -430,7 +430,7 @@ func dismissal() {
       ])
     )
   ) {
-    CounterFeature()
+    Feature()
   }
 }
 ```
@@ -553,7 +553,7 @@ func dismissal() {
       ])
     )
   ) {
-    CounterFeature()
+    Feature()
   }
   store.exhaustivity = .off
 
```

---

### Incident Patch 2: `e6f89adb` (2026-07-21)
**Commit Message**: docs: Fix reducer in tree-based navigation test examples (#3954)

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/TreeBasedNavigation.md` (modified, +2/-2)
```diff
@@ -586,7 +586,7 @@ func dismissal() {
       counter: CounterFeature.State(count: 3)
     )
   ) {
-    CounterFeature()
+    Feature()
   }
 }
 ```
@@ -642,7 +642,7 @@ func dismissal() {
       counter: CounterFeature.State(count: 3)
     )
   ) {
-    CounterFeature()
+    Feature()
   }
   store.exhaustivity = .off
 
```

---

### Incident Patch 3: `ba184516` (2026-07-16)
**Commit Message**: Fix TestStore initialization in navigation tutorial (#3952)

* Fix: TestStore initialization in navigation tutorial

* Update 02-03-03-code-0002.swift

---------

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

**File**: `Sources/ComposableArchitecture/Documentation.docc/Tutorials/MeetTheComposableArchitecture/02-Navigation/03-TestingPresentation/02-03-03-code-0002.swift` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import Testing
 struct ContactsFeatureTests {
   @Test
   func deleteContact() async {
-    let store = TestStore(initialState: ContactsFeature.State()) {
+    let store = TestStore(
       initialState: ContactsFeature.State(
         contacts: [
           Contact(id: UUID(0), name: "Blob"),
```

---

### Incident Patch 4: `32e3fcab` (2026-06-26)
**Commit Message**: Fix missing await in TestingTCA send examples (#3940)

* fix await in TestStore state examples

* fix await in TestStore exhaustivity examples

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/TestingTCA.md` (modified, +4/-4)
```diff
@@ -119,7 +119,7 @@ on computed properties you might have defined on your state. For example, if `St
 computed property for checking if `count` was prime, we could test it like so:
 
 ```swift
-store.send(.incrementButtonTapped) {
+await store.send(.incrementButtonTapped) {
   $0.count = 3
 }
 XCTAssertTrue(store.state.isPrime)
@@ -131,7 +131,7 @@ prevents you from being able to use an escape hatch to get around needing to act
 state mutation, like so:
 
 ```swift
-store.send(.incrementButtonTapped) {
+await store.send(.incrementButtonTapped) {
   $0 = store.state  // ❌ store.state is the previous, not current, state.
 }
 ```
@@ -535,7 +535,7 @@ let store = TestStore(/* ... */)
 // ℹ️ "on" is the default so technically this is not needed
 store.exhaustivity = .on
 
-store.send(.buttonTapped) {
+await store.send(.buttonTapped) {
   $0  // Represents the state *before* the action was sent
 }
 ```
@@ -550,7 +550,7 @@ trailing closure of `send` represents the state _after_ the action was sent:
 let store = TestStore(/* ... */)
 store.exhaustivity = .off
 
-store.send(.buttonTapped) {
+await store.send(.buttonTapped) {
   $0  // Represents the state *after* the action was sent
 }
 ```
```

---

### Incident Patch 5: `675fbb2c` (2026-06-26)
**Commit Message**: Fix dropped documentation link in FAQ (#3941)

The FAQ's exhaustive-testing answer ended with "See  for more information on
testing in TCA", where the link to the testing article had been dropped,
leaving a double space and no reference. Link it to the already-defined
`[testing-article]` (`<doc:TestingTCA>`).

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/FAQ.md` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ Modeling user actions with an enum rather than methods defined on some object is
   }
   ```
 
-  Again this is only possible thanks to the data type of all actions in the feature. See  for more information on testing in TCA.
+  Again this is only possible thanks to the data type of all actions in the feature. See the [testing article][testing-article] for more information.
 
 <!-- TODO: Navigation tools? -->
 
```

---

### Incident Patch 6: `a28ddfad` (2026-06-11)
**Commit Message**: Fix syntax error and typo in documentation examples (#3939)

- Add missing closing parenthesis to a store.send(.textFieldChanged("Hello")) example in Performance.md, consistent with the surrounding examples.
- Fix "trialing" -> "trailing" typo in TreeBasedNavigation.md.

Co-authored-by: devk4nt <[REDACTED_EMAIL]>

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/Performance.md` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ store.send(.toggleChanged) {
   $0.isEnabled = true
   // Assert on shared logic
 }
-store.send(.textFieldChanged("Hello") {
+store.send(.textFieldChanged("Hello")) {
   $0.description = "Hello"
   // Assert on shared logic
 }
```

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/TreeBasedNavigation.md` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ struct InventoryFeature {
 }
 ```
 
-> Note: It's not necessary to specify `Destination` in a trialing closure of `ifLet` because it can
+> Note: It's not necessary to specify `Destination` in a trailing closure of `ifLet` because it can
 > automatically be inferred due to how the `Destination` enum was defined with the ``Reducer()``
 > macro.
 
```

---

### Incident Patch 7: `f17e2c57` (2026-06-10)
**Commit Message**: Fix outdated Path reducer examples in stack navigation docs (#3937)

* docs: update stack navigation testing example

* docs: wrap stack navigation test state in path case

* Apply suggestion from @mbrandonw

---------

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/StackBasedNavigation.md` (modified, +5/-9)
```diff
@@ -403,19 +403,15 @@ struct Feature {
   }
 
   @Reducer  
-  struct Path {
-    enum State: Equatable { case counter(CounterFeature.State) }
-    enum Action { case counter(CounterFeature.Action) }
-    var body: some ReducerOf<Self> {
-      Scope(\.counter, action: \.counter) { CounterFeature() }
-    }
+  enum Path {
+    case counter(CounterFeature)
   }
 
   var body: some ReducerOf<Self> {
     Reduce { state, action in
       // Logic and behavior for core feature.
     }
-    .forEach(\.path, action: \.path) { Path() }
+    .forEach(\.path, action: \.path) { Path.body }
   }
 }
 ```
@@ -430,7 +426,7 @@ func dismissal() {
   let store = TestStore(
     initialState: Feature.State(
       path: StackState([
-        CounterFeature.State(count: 3)
+        .counter(CounterFeature.State(count: 3))
       ])
     )
   ) {
@@ -553,7 +549,7 @@ func dismissal() {
   let store = TestStore(
     initialState: Feature.State(
       path: StackState([
-        CounterFeature.State(count: 3)
+        .counter(CounterFeature.State(count: 3))
       ])
     )
   ) {
```

---

### Incident Patch 8: `4f4e205b` (2026-06-10)
**Commit Message**: Fix SharingState documentation example syntax (#3936)

* fix: SharingState fileStorage attribute syntax

* fix: SharingState code fence delimiter

* fix: SharingState fileStorage URL delimiter

* fix: SharingState shared state projection

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/SharingState.md` (modified, +5/-5)
```diff
@@ -187,7 +187,7 @@ It works similarly to the in-memory sharing discussed above, but it requires a U
 on disk, as well as a default value that will be used when there is no data in the file system:
 
 ```swift
-@Shared(.fileStorage(URL(/* ... */)) var users: [User] = []
+@Shared(.fileStorage(URL(/* ... */))) var users: [User] = []
 ```
 
 This strategy works by serializing your value to JSON to save to disk, and then deserializing JSON
@@ -653,7 +653,7 @@ section above to use app storage:
 struct State: Equatable {
   @Shared(.appStorage("count")) var count: Int
 }
-````
+```
 
 …then the test for this feature can be written in the same way as before and will still pass.
 
@@ -868,7 +868,7 @@ like this:
 
 ```swift
 extension URL {
-  static let users = URL(/* ... */))
+  static let users = URL(/* ... */)
 }
 
 @Shared(.fileStorage(.users)) var users: [User] = []
@@ -1101,7 +1101,7 @@ await store.send(.tap)
 
 // ❌ Expected state to change, but no change occurred.
 await store.receive(.response) {
-  $0.$shared.withLock { $0 = true }
+  $0.$bool.withLock { $0 = true }
 }
 ```
 
@@ -1111,7 +1111,7 @@ must always assert against shared state mutations in the first action:
 
 ```swift
 await store.send(.tap) {  // ✅
-  $0.$shared.withLock { $0 = true }
+  $0.$bool.withLock { $0 = true }
 }
 
 // ❌ Expected state to change, but no change occurred.
```

---

### Incident Patch 9: `2a5434e2` (2026-06-09)
**Commit Message**: Fix syntax errors in bindings documentation examples (#3935)

* docs: fix binding action case patterns

* docs: fix Toggle binding label

* docs: fix switch syntax in bindings docs

* docs: fix closing delimiter in binding test example

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/Bindings.md` (modified, +9/-9)
```diff
@@ -162,27 +162,27 @@ struct Settings {
   var body: some Reducer<State, Action> {
     Reduce { state, action in
       switch action {
-      case let digestChanged(digest):
+      case let .digestChanged(digest):
         state.digest = digest
         return .none
 
-      case let displayNameChanged(displayName):
+      case let .displayNameChanged(displayName):
         state.displayName = displayName
         return .none
 
-      case let enableNotificationsChanged(isOn):
+      case let .enableNotificationsChanged(isOn):
         state.enableNotifications = isOn
         return .none
 
-      case let protectMyPostsChanged(isOn):
+      case let .protectMyPostsChanged(isOn):
         state.protectMyPosts = isOn
         return .none
 
-      case let sendEmailNotificationsChanged(isOn):
+      case let .sendEmailNotificationsChanged(isOn):
         state.sendEmailNotifications = isOn
         return .none
 
-      case let sendMobileNotificationsChanged(isOn):
+      case let .sendMobileNotificationsChanged(isOn):
         state.sendMobileNotifications = isOn
         return .none
       }
@@ -243,7 +243,7 @@ Then bindings can be derived from the store using familiar `$` syntax:
 
 ```swift
 TextField("Display name", text: $store.displayName)
-Toggle("Notifications", text: $store.enableNotifications)
+Toggle("Notifications", isOn: $store.enableNotifications)
 // ...
 ```
 
@@ -255,7 +255,7 @@ var body: some Reducer<State, Action> {
   BindingReducer()
 
   Reduce { state, action in
-    switch action
+    switch action {
     case .binding(\.displayName):
       // Validate display name
   
@@ -300,5 +300,5 @@ store.send(\.binding.displayName, "Blob") {
 }
 store.send(\.binding.protectMyPosts, true) {
   $0.protectMyPosts = true
-)
+}
 ```
```

---

### Incident Patch 10: `44d83ff9` (2026-06-02)
**Commit Message**: Fix xcodebuild issues (#3919)

**File**: `Sources/ComposableArchitecture/Internal/Deprecations.swift` (modified, +4/-0)
```diff
@@ -2079,6 +2079,8 @@ extension View {
                 if let action {
                   store.send(.presented(fromDestinationAction(action)), animation: animation)
                 }
+              @unknown default:
+                break
               }
             } label: {
               Text(button.label)
@@ -2132,6 +2134,8 @@ extension View {
                 if let action {
                   store.send(.presented(fromDestinationAction(action)), animation: animation)
                 }
+              @unknown default:
+                break
               }
             } label: {
               Text(button.label)
```

**File**: `Sources/ComposableArchitecture/Internal/Logger.swift` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 import OSLog
+import Combine
 
 @_spi(Logging)
 @preconcurrency @MainActor
```

**File**: `Sources/ComposableArchitecture/Observation/Alert+Observation.swift` (modified, +4/-0)
```diff
@@ -22,6 +22,8 @@ extension View {
               if let action {
                 store?.send(action, animation: animation)
               }
+            @unknown default:
+              break
             }
           } label: {
             Text(button.label)
@@ -59,6 +61,8 @@ extension View {
               if let action {
                 store?.send(action, animation: animation)
               }
+            @unknown default:
+              break
             }
           } label: {
             Text(button.label)
```

---

### Incident Patch 11: `99da18d4` (2026-06-02)
**Commit Message**: Fix documentation link (#3927)

**File**: `.github/ISSUE_TEMPLATE/config.yml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ contact_links:
     url: https://github.com/pointfreeco/swift-composable-architecture/discussions
     about: Composable Architecture Q&A, ideas, and more
   - name: Documentation
-    url: https://pointfreeco.github.io/swift-composable-architecture/main/documentation/composablearchitecture/
+    url: https://swiftpackageindex.com/pointfreeco/swift-composable-architecture/main/documentation/composablearchitecture
     about: Read the Composable Architecture's documentation
   - name: Videos
     url: https://www.pointfree.co/collections/composable-architecture
```

---

### Incident Patch 12: `b15c5bda` (2026-04-01)
**Commit Message**: Reducer enum action fixes (#3910)

* Fix enum scoping to alerts

* wip

**File**: `ComposableArchitecture.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +9/-9)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "d6fc4bcdcda6fb96935e1befa26ead8952b7b89a01f8c45c7a8941c908de6ac0",
+  "originHash" : "fb09825238ea5dd67e638d345e75b1687c50d1369c83ed9a8f55fc49b93938c9",
   "pins" : [
     {
       "identity" : "combine-schedulers",
@@ -33,8 +33,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-collections",
       "state" : {
-        "revision" : "8d9834a6189db730f6264db7556a7ffb751e99ee",
-        "version" : "1.4.0"
+        "revision" : "6675bc0ff86e61436e615df6fc5174e043e57924",
+        "version" : "1.4.1"
       }
     },
     {
@@ -96,8 +96,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-macro-testing",
       "state" : {
-        "revision" : "9ab11325daa51c7c5c10fcf16c92bac906717c7e",
-        "version" : "0.6.4"
+        "revision" : "2e494c632d510715c96a694ff25e2a8d4ac3f64b",
+        "version" : "0.6.5"
       }
     },
     {
@@ -114,17 +114,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-perception",
       "state" : {
-        "revision" : "4f47ebafed5f0b0172cf5c661454fa8e28fb2ac4",
-        "version" : "2.0.9"
+        "revision" : "25ac73741c3436605d61eceb5207e896973918e7",
+        "version" : "2.0.10"
       }
     },
     {
       "identity" : "swift-sharing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "3bfc408cc2d0bee2287c174da6b1c76768377818",
-        "version" : "2.7.4"
+        "revision" : "bc27f8322bc30f6ce7d864d137dc77a6de8b57eb",
+        "version" : "2.8.0"
       }
     },
     {
```

**File**: `Examples/SyncUps/SyncUps/SyncUpDetail.swift` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import SwiftUI
 struct SyncUpDetail {
   @Reducer
   enum Destination {
-    case alert(AlertState<Alert>)
+    @ReducerCaseIgnored case alert(AlertState<Alert>)
     case edit(SyncUpForm)
 
     @CasePathable
```

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/MigrationGuides/MigratingTo1.25.md` (modified, +4/-2)
```diff
@@ -60,11 +60,13 @@ bindings to `Bool` bindings:
 ```
 
 Another important difference is that holding non-feature state in a destination enum with an
-associated action (such as the action of an `AlertState<Action>`) requires an explicit `Action` enum
-definition:
+associated action (such as the action of an `AlertState<Action>`) requires an explicit
+`@ReducerCaseIgnored` on the non-feature case, as well as an explicit `Action` enum definition to
+define the corresponding case(s):
 
 ```diff
  @Reducer enum Destination {
++  @ReducerCaseIgnored
    case alert(AlertState<Alert>)
    case settings(Settings)
 
```

**File**: `Sources/ComposableArchitecture/Observation/Store+Observation.swift` (modified, +9/-3)
```diff
@@ -266,7 +266,9 @@ extension SwiftUI.Bindable {
       *,
       deprecated,
       message:
-        "Use '$store.scope(state: \\.$destination, action: \\.destination)' (and optional trailing dot syntax '.sheet') instead"
+        """
+        Use '$store.scope(state: \\.$destination, action: \\.destination)' (and optional trailing dot syntax '.sheet') instead. For alert or confirmation cases, additional work is needed. See the migration guide for more details: https://swiftpackageindex.com/pointfreeco/swift-composable-architecture/1.25.5/documentation/composablearchitecture/migratingto1.25#Enum-scopes
+        """
     )
     @preconcurrency @MainActor
     public func scope<State: ObservableState, Action, Container: _ScopableState, ChildAction>(
@@ -396,7 +398,9 @@ extension Perception.Bindable {
       *,
       deprecated,
       message:
-        "Use '$store.scope(state: \\.$destination, action: \\.destination)' (and optional trailing dot syntax '.sheet') instead"
+        """
+        Use '$store.scope(state: \\.$destination, action: \\.destination)' (and optional trailing dot syntax '.sheet') instead. For alert or confirmation cases, additional work is needed. See the migration guide for more details: https://swiftpackageindex.com/pointfreeco/swift-composable-architecture/1.25.5/documentation/composablearchitecture/migratingto1.25#Enum-scopes
+        """
     )
     @preconcurrency @MainActor
     public func scope<State: ObservableState, Action, Container: _ScopableState, ChildAction>(
@@ -528,7 +532,9 @@ extension UIBindable {
       *,
       deprecated,
       message:
-        "Use '$store.scope(state: \\.$destination, action: \\.destination)' (and optional trailing dot syntax '.sheet') instead"
+        """
+        Use '$store.scope(state: \\.$destination, action: \\.destination)' (and optional trailing dot syntax '.sheet') instead. For alert or confirmation cases, additional work is needed. See the migration guide for more details: https://swiftpackageindex.com/pointfreeco/swift-composable-architecture/1.25.5/documentation/composablearchitecture/migratingto1.25#Enum-scopes
+        """
     )
     @preconcurrency @MainActor
     public func scope<State: ObservableState, Action, Container: _ScopableState, ChildAction>(
```

**File**: `Sources/ComposableArchitectureMacros/ReducerMacro.swift` (modified, +91/-8)
```diff
@@ -252,7 +252,28 @@ extension ReducerMacro: MemberMacro {
       } || hasReduceMethod
     var decls: [DeclSyntax] = []
     if let enumDecl = declaration.as(EnumDeclSyntax.self) {
-      let enumCaseElements = [ReducerCase](members: enumDecl.memberBlock.members)
+      var enumCaseElements = [ReducerCase](members: enumDecl.memberBlock.members)
+      if hasAction {
+        let existingActionCases: [String: EnumCaseElementSyntax] = {
+          guard
+            let actionEnum = enumDecl.memberBlock.members.lazy
+              .compactMap({ $0.decl.as(EnumDeclSyntax.self) })
+              .first(where: { $0.name.text == "Action" })
+          else { return [:] }
+          var cases: [String: EnumCaseElementSyntax] = [:]
+          for member in actionEnum.memberBlock.members {
+            if let caseDecl = member.decl.as(EnumCaseDeclSyntax.self) {
+              for element in caseDecl.elements {
+                cases[element.name.text] = element
+              }
+            }
+          }
+          return cases
+        }()
+        if !existingActionCases.isEmpty {
+          enumCaseElements = enumCaseElements.resolvingExplicitActions(existingActionCases)
+        }
+      }
       var stateCaseDecls: [String] = []
       var actionCaseDecls: [String] = []
       var reducerIfCaseLets: [String] = []
@@ -421,7 +442,7 @@ extension ReducerMacro: MemberMacro {
 }
 
 private enum ReducerCase {
-  case element(EnumCaseElementSyntax, attribute: Attribute? = nil)
+  case element(EnumCaseElementSyntax, attribute: Attribute? = nil, explicitActionType: TypeSyntax? = nil)
   indirect case ifConfig([IfConfig])
 
   enum Attribute {
@@ -455,7 +476,7 @@ private enum ReducerCase {
 
   var stateCaseDecl: String {
     switch self {
-    case .element(let element, let attribute):
+    case .element(let element, let attribute, _):
       if attribute != .ignored,
         let parameterClause = element.parameterClause,
         parameterClause.parameters.count == 1,
@@ -475,7 +496,7 @@ private enum ReducerCase {
 
   var actionCaseDecl: String {
     switch self {
-    case .element(let element, let attribute):
+    case .element(let element, let attribute, _):
       if attribute != .ignored,
         let parameterClause = element.parameterClause,
         parameterClause.parameters.count == 1,
@@ -503,7 +524,7 @@ private enum ReducerCase {
 
   var reducerIfCaseLet: String? {
     switch self {
-    case .element(let element, let attribute):
+    case .element(let element, let attribute, _):
       if attribute == nil,
         let parameterClause = element.parameterClause,
         parameterClause.parameters.count == 1,
@@ -529,7 +550,7 @@ private enum ReducerCase {
   func storeCasePathProperty(access: DeclModifierSyntax?) -> String {
     let accessPrefix = access?.name.text.appending(" ") ?? ""
     switch self {
-    case .element(let element, let attribute):
+    case .element(let element, let attribute, let explicitActionType):
       let name = element.name.text
       if attribute == nil,
         let parameterClause = element.parameterClause,
@@ -546,6 +567,20 @@ private enum ReducerCase {
           )
           }
           """
+      } else if let explicitActionType,
+        let parameterClause = element.parameterClause,
+        parameterClause.parameters.count == 1,
+        let parameter = parameterClause.parameters.first
+      {
+        let stateType = parameter.type
+        return """
+          var \(name): CasePaths.AnyCasePath<CaseScope, ComposableArchitecture.Store<\(stateType.trimmed), \(explicitActionType.trimmed)>> {
+          CasePaths.AnyCasePath(
+          embed: CaseScope.\(name),
+          extract: { guard case let .\(name)(v0) = $0 else { return nil }; return v0 }
+          )
+          }
+          """
       } else if let parameterClause = element.parameterClause,
         parameterClause.parameters.count == 1,
         let parameter = parameterClause.parameters.first
@@ -577,7 +612,7 @@ private enum ReducerCase {
 
   var storeCase: String {
     switch self {
-    case .element(let element, let attribute):
+    case .element(let element, let attribute, let explicitActionType):
       if attribute == nil,
         let parameterClause = element.parameterClause,
         parameterClause.parameters.count == 1,
@@ -587,6 +622,14 @@ private enum ReducerCase {
         let name = element.name.text
         let type = parameter.type
         return "case \(name)(ComposableArchitecture.StoreOf<\(type.trimmed)>)"
+      } else if let explicitActionType,
+        let parameterClause = element.parameterClause,
+        parameterClause.parameters.count == 1,
+        let parameter = parameterClause.parameters.first
+      {
+        let name = element.name.text
+        let stateType = parameter.type
+        return "case \(name)(ComposableArchitecture.Store<\(stateType.trimmed), \(explicitActionType.trimmed)>)"
       } else {
         return "case \(element.trimmedDescription)"
  
```

**File**: `Tests/ComposableArchitectureMacrosTests/ReducerMacroTests.swift` (modified, +96/-0)
```diff
@@ -1048,6 +1048,102 @@
       }
     }
 
+    func testEnum_CaseIgnoredExplicitActions() {
+      assertMacro {
+        """
+        @Reducer
+        enum Destination {
+          @ReducerCaseIgnored case alert(AlertState<Alert>)
+          case settings(Settings)
+
+          enum Action {
+            case alert(Alert)
+            case settings(Settings.Action)
+          }
+        }
+        """
+      } expansion: {
+        #"""
+        enum Destination {
+          @ReducerCaseIgnored
+          @ReducerCaseEphemeral case alert(AlertState<Alert>)
+          case settings(Settings)
+          @CasePathable
+
+          enum Action {
+            case alert(Alert)
+            case settings(Settings.Action)
+          }
+
+          @CasePathable
+          @dynamicMemberLookup
+          @ObservableState
+          enum State: ComposableArchitecture.CaseReducerState {
+            typealias StateReducer = Destination
+            case alert(AlertState<Alert>)
+            case settings(Settings.State)
+          }
+
+          @ComposableArchitecture.ReducerBuilder<Self.State, Self.Action>
+          static var body: Reduce<Self.State, Self.Action> {
+            ComposableArchitecture.Reduce(
+              ComposableArchitecture.EmptyReducer<Self.State, Self.Action>()
+              .ifCaseLet(\Self.State.Cases.settings, action: \Self.Action.Cases.settings) {
+                Settings()
+              }
+            )
+          }
+
+          @dynamicMemberLookup
+          enum CaseScope: ComposableArchitecture._CaseScopeProtocol, CasePaths.CasePathable {
+            case alert(ComposableArchitecture.Store<AlertState<Alert>, Alert>)
+            case settings(ComposableArchitecture.StoreOf<Settings>)
+            struct AllCasePaths {
+              var alert: CasePaths.AnyCasePath<CaseScope, ComposableArchitecture.Store<AlertState<Alert>, Alert>> {
+                CasePaths.AnyCasePath(
+                  embed: CaseScope.alert,
+                  extract: {
+                    guard case let .alert(v0) = $0 else {
+                      return nil
+                    };
+                    return v0
+                  }
+                )
+              }
+              var settings: CasePaths.AnyCasePath<CaseScope, ComposableArchitecture.StoreOf<Settings>> {
+                CasePaths.AnyCasePath(
+                  embed: CaseScope.settings,
+                  extract: {
+                    guard case let .settings(v0) = $0 else {
+                      return nil
+                    };
+                    return v0
+                  }
+                )
+              }
+            }
+            static var allCasePaths: AllCasePaths {
+              AllCasePaths()
+            }
+          }
+
+          @preconcurrency @MainActor
+          static func scope(_ store: ComposableArchitecture.Store<Self.State, Self.Action>) -> CaseScope {
+            switch store.state {
+            case .alert:
+              return .alert(store.scope(state: \.alert, action: \.alert)!)
+            case .settings:
+              return .settings(store.scope(state: \.settings, action: \.settings)!)
+            }
+          }
+        }
+
+        extension Destination: ComposableArchitecture.CaseReducer, ComposableArchitecture.Reducer {
+        }
+        """#
+      }
+    }
+
     func testEnum_Attributes() {
       assertMacro {
         """
```

---

### Incident Patch 13: `ce8ee578` (2026-03-30)
**Commit Message**: Fixed: Reading @Shared state from a Store conforming to BindableAction raises deprecation warning (#3906)

In a `View` context, reading a `@Shared` value from the store's state will raise a deprecation warning when the store's `Action` conforms to `BindableAction`.

```swift
@Reducer
struct Feature {
  @ObservableState
  struct State: Equatable {
    @Shared(.inMemory("value")) var value: Int = 0
  }
  enum Action: BindableAction {
    case binding(BindingAction<State>)
  }
}

struct FeatureView: View {
  let store: StoreOf<Feature>

  var body: some View {
    let _ = store.value
    // 🛑 Setter for 'value' is deprecated: Use '$shared.withLock' to modify a shared value with exclusive access; when constructing a SwiftUI binding, use 'Binding($shared)'
  }
}
```

This is because the dynamicMemberLookup selects an overload that requires a `WritableKeyPath` which is enough to trigger Swift to require a setter for the property which is invalid for a `@Shared` value. Applying `@_disfavoredOverload` will drive the lookup toward an overload requiring a `KeyPath` instead.

Co-authored-by: Sean <[REDACTED_EMAIL]>

**File**: `Sources/ComposableArchitecture/Observation/Binding+Observation.swift` (modified, +2/-0)
```diff
@@ -168,6 +168,7 @@ extension BindableAction where State: ObservableState {
 }
 
 extension Store where State: ObservableState, Action: BindableAction, Action.State == State {
+  @_disfavoredOverload
   public subscript<Value: Equatable & Sendable>(
     dynamicMember keyPath: WritableKeyPath<State, Value>
   ) -> Value {
@@ -212,6 +213,7 @@ where
   Action.ViewAction: BindableAction,
   Action.ViewAction.State == State
 {
+  @_disfavoredOverload
   public subscript<Value: Equatable & Sendable>(
     dynamicMember keyPath: WritableKeyPath<State, Value>
   ) -> Value {
```

---

### Incident Patch 14: `d5d2e025` (2026-03-27)
**Commit Message**: Update 1.25 migration guide for enum alerts (#3904)

Alerts and confirmation dialogs held in `@Reducer enum`s will require a
bit of extra ceremony to be 2.0-compatible, but 2.0 will come with more
flexible tooling around handling prompts.

**File**: `Examples/SyncUps/SyncUps/SyncUpDetail.swift` (modified, +6/-0)
```diff
@@ -8,6 +8,12 @@ struct SyncUpDetail {
     case alert(AlertState<Alert>)
     case edit(SyncUpForm)
 
+    @CasePathable
+    enum Action {
+      case alert(Alert)
+      case edit(SyncUpForm.Action)
+    }
+
     @CasePathable
     enum Alert {
       case confirmDeletion
```

**File**: `Package.resolved` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "88b27ee0a566e74b7aad8d4d178b4e6824113129b455d896eefddb7fd47c5eac",
+  "originHash" : "1259be8d2815c9a7a292b760933ff562898164ae8ba7f180242c39f1152ecbdd",
   "pins" : [
     {
       "identity" : "combine-schedulers",
@@ -123,8 +123,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "3bfc408cc2d0bee2287c174da6b1c76768377818",
-        "version" : "2.7.4"
+        "revision" : "bc27f8322bc30f6ce7d864d137dc77a6de8b57eb",
+        "version" : "2.8.0"
       }
     },
     {
```

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/MigrationGuides/MigratingTo1.25.md` (modified, +22/-3)
```diff
@@ -39,9 +39,6 @@ directly to a specific case of a destination enum, you now scope to the entire d
 chain into the individual case:
 
 ```diff
--.alert($store.scope(state: \.destination?.alert, action: \.destination.alert))
-+.alert($store.scope(state: \.$destination, action: \.destination).alert)
-
 -.sheet(item: $store.scope(state: \.destination?.edit, action: \.destination.edit)) {
 +.sheet(item: $store.scope(state: \.$destination, action: \.destination).edit) {
 ```
@@ -62,6 +59,28 @@ bindings to `Bool` bindings:
 +) {
 ```
 
+Another important difference is that holding non-feature state in a destination enum with an
+associated action (such as the action of an `AlertState<Action>`) requires an explicit `Action` enum
+definition:
+
+```diff
+ @Reducer enum Destination {
+   case alert(AlertState<Alert>)
+   case settings(Settings)
+
++  @CasePathable enum Action {
++    case alert(Alert)
++    case settings(Settings.Action)
++  }
+
+   enum Alert {
+     case .deleteTapped
+   }
+ }
+```
+
+ComposableArchitecture 2.0 will have newer tools for handling prompts.
+
 ### Streamlined `onChange` operator
 
 A new overload of the `onChange` operator has been added that directly returns an effect instead
```

---

### Incident Patch 15: `ac32f69c` (2026-03-27)
**Commit Message**: Fix missing access modifier on CaseScope.AllCasePaths properties (#3898)

When using @Reducer on a public or package enum, the generated computed
properties inside AllCasePaths were missing the access modifier, defaulting
to internal. This made the enum scope API inaccessible across module
boundaries.

Fixes #3893

**File**: `Sources/ComposableArchitectureMacros/ReducerMacro.swift` (modified, +7/-6)
```diff
@@ -268,7 +268,7 @@ extension ReducerMacro: MemberMacro {
         }
         storeCases.append(enumCaseElement.storeCase)
         storeScopes.append(enumCaseElement.storeScope)
-        storeCasePathProperties.append(enumCaseElement.storeCasePathProperty)
+        storeCasePathProperties.append(enumCaseElement.storeCasePathProperty(access: access))
       }
       if !hasState {
         var conformances: [String] = []
@@ -526,7 +526,8 @@ private enum ReducerCase {
     }
   }
 
-  var storeCasePathProperty: String {
+  func storeCasePathProperty(access: DeclModifierSyntax?) -> String {
+    let accessPrefix = access?.name.text.appending(" ") ?? ""
     switch self {
     case .element(let element, let attribute):
       let name = element.name.text
@@ -538,7 +539,7 @@ private enum ReducerCase {
       {
         let type = parameter.type
         return """
-          var \(name): CasePaths.AnyCasePath<CaseScope, ComposableArchitecture.StoreOf<\(type.trimmed)>> {
+          \(accessPrefix)var \(name): CasePaths.AnyCasePath<CaseScope, ComposableArchitecture.StoreOf<\(type.trimmed)>> {
           CasePaths.AnyCasePath(
           embed: CaseScope.\(name),
           extract: { guard case let .\(name)(v0) = $0 else { return nil }; return v0 }
@@ -550,7 +551,7 @@ private enum ReducerCase {
         let parameter = parameterClause.parameters.first
       {
         return """
-          var \(name): CasePaths.AnyCasePath<CaseScope, \(parameter.type.trimmed)> {
+          \(accessPrefix)var \(name): CasePaths.AnyCasePath<CaseScope, \(parameter.type.trimmed)> {
           CasePaths.AnyCasePath(
           embed: CaseScope.\(name),
           extract: { guard case let .\(name)(v0) = $0 else { return nil }; return v0 }
@@ -561,7 +562,7 @@ private enum ReducerCase {
         return ""
       } else {
         return """
-          var \(name): CasePaths.AnyCasePath<CaseScope, Void> {
+          \(accessPrefix)var \(name): CasePaths.AnyCasePath<CaseScope, Void> {
           CasePaths.AnyCasePath(
           embed: { CaseScope.\(name) },
           extract: { guard case .\(name) = $0 else { return nil }; return () }
@@ -570,7 +571,7 @@ private enum ReducerCase {
           """
       }
     case .ifConfig(let configs):
-      return Self.renderedIfConfig(configs) { $0.storeCasePathProperty } ?? ""
+      return Self.renderedIfConfig(configs) { $0.storeCasePathProperty(access: access) } ?? ""
     }
   }
 
```

**File**: `Tests/ComposableArchitectureMacrosTests/ReducerMacroTests.swift` (modified, +101/-0)
```diff
@@ -855,6 +855,107 @@
       }
     }
 
+    func testEnum_TwoCases_AccessControl_Public() {
+      assertMacro {
+        """
+        @Reducer
+        public enum Destination {
+          case activity(Activity)
+          case timeline(Timeline)
+        }
+        """
+      } expansion: {
+        #"""
+        public enum Destination {
+          case activity(Activity)
+          case timeline(Timeline)
+
+          @CasePathable
+          @dynamicMemberLookup
+          @ObservableState
+
+          public enum State: ComposableArchitecture.CaseReducerState {
+
+            public typealias StateReducer = Destination
+            case activity(Activity.State)
+            case timeline(Timeline.State)
+          }
+
+          @CasePathable
+
+          public enum Action {
+            case activity(Activity.Action)
+            case timeline(Timeline.Action)
+          }
+
+          @ComposableArchitecture.ReducerBuilder<Self.State, Self.Action>
+
+          public static var body: Reduce<Self.State, Self.Action> {
+            ComposableArchitecture.Reduce(
+              ComposableArchitecture.EmptyReducer<Self.State, Self.Action>()
+              .ifCaseLet(\Self.State.Cases.activity, action: \Self.Action.Cases.activity) {
+                Activity()
+              }
+              .ifCaseLet(\Self.State.Cases.timeline, action: \Self.Action.Cases.timeline) {
+                Timeline()
+              }
+            )
+          }
+
+          @dynamicMemberLookup
+
+          public enum CaseScope: ComposableArchitecture._CaseScopeProtocol, CasePaths.CasePathable {
+            case activity(ComposableArchitecture.StoreOf<Activity>)
+            case timeline(ComposableArchitecture.StoreOf<Timeline>)
+
+            public struct AllCasePaths {
+              public var activity: CasePaths.AnyCasePath<CaseScope, ComposableArchitecture.StoreOf<Activity>> {
+                CasePaths.AnyCasePath(
+                  embed: CaseScope.activity,
+                  extract: {
+                    guard case let .activity(v0) = $0 else {
+                      return nil
+                    };
+                    return v0
+                  }
+                )
+              }
+              public var timeline: CasePaths.AnyCasePath<CaseScope, ComposableArchitecture.StoreOf<Timeline>> {
+                CasePaths.AnyCasePath(
+                  embed: CaseScope.timeline,
+                  extract: {
+                    guard case let .timeline(v0) = $0 else {
+                      return nil
+                    };
+                    return v0
+                  }
+                )
+              }
+            }
+
+            public static var allCasePaths: AllCasePaths {
+              AllCasePaths()
+            }
+          }
+
+          @preconcurrency @MainActor
+
+          public static func scope(_ store: ComposableArchitecture.Store<Self.State, Self.Action>) -> CaseScope {
+            switch store.state {
+            case .activity:
+              return .activity(store.scope(state: \.activity, action: \.activity)!)
+            case .timeline:
+              return .timeline(store.scope(state: \.timeline, action: \.timeline)!)
+            }
+          }
+        }
+
+        extension Destination: ComposableArchitecture.CaseReducer, ComposableArchitecture.Reducer {
+        }
+        """#
+      }
+    }
+
     func testEnum_CaseIgnored() {
       assertMacro {
         """
```

#### Recent Merged Pull Requests:
- **PR #3960** (closed): Issue 3950 - Backport Xcode 27 support to TCA 1.23 (@aryansk)
- **PR #3956** (2026-07-24): Fix missing @ObservableState annotations in bindings examples (@indextrown)
- **PR #3955** (2026-07-21): Fix errors in stack navigation documentation examples (@indextrown)
- **PR #3954** (2026-07-21): Fix reducer in tree-based navigation test examples (@indextrown)
- **PR #3952** (2026-07-16): Fix TestStore initialization in navigation tutorial (@opficdev)
- **PR #3951** (closed): Fix TestStore initialization in navigation tutorial (@opficdev)
- **PR #3948** (2026-08-28): Bump to IssueReporting 2.0 (@stephencelis)
- **PR #3946** (2026-07-03): Add docs badge to readme (@mbrandonw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
