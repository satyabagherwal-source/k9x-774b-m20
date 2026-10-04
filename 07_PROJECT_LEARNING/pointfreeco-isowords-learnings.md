# Forensic Learning Record (Deep Inspection): pointfreeco/isowords

> **Canonical Artifact**: `07_PROJECT_LEARNING/pointfreeco-isowords-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pointfreeco/isowords](https://github.com/pointfreeco/isowords))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:34:42.862Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pointfreeco/isowords`
- **Description**: Open source game built in SwiftUI and the Composable Architecture.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3006 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `App/Previews/CubeCorePreview/CubeCorePreviewApp.swift`
```
import ComposableArchitecture
import CubeCore
import SharedModels
import SwiftUI

@main
struct CubeCorePreviewApp: App {
  var body: some Scene {
    WindowGroup {
      CubeView(
        store: Store(
          initialState: CubeSceneView.ViewState(
            cubes: .mock,
            enableGyroMotion: false,
            isOnLowPowerMode: false,
            nub: nil,
            playedWords: [],
            selectedFaceCount: 0,
            selectedWordIsValid: false,
            selectedWordString: ""
          )
        ) {
        }
      )
    }
  }
}

extension CubeNode.ViewState {
  static func mock(
    x: LatticePoint.Index,
    y: LatticePoint.Index,
    z: LatticePoint.Index
  ) -> Self {
    Self(
      cubeShakeStartedAt: nil,
      index: .init(x: x, y: y, z: z),
      isCriticallySelected: false,
      isInPlay: true,
      left: .init(cubeFace: .leftMock, status: .deselected),
      right: .init(cubeFace: .rightMock, status: .deselected),
      top: .init(cubeFace: .topMock, status: .deselected)
    )
  }
}

extension CubeSceneView.ViewState.ViewPuzzle {
  public static let mock = Self(
    .init(
      .init(
        .mock(x: .two, y: .zero, z: .zero),
        .mock(x: .zero, y: .two, z: .zero),
        .mock(x: .zero, y: .zero, z: .two)
      ),
      .init(
        .mock(x: .two, y: .two, z: .zero),
        .mock(x: .two, y: .zero, z: .two),
        .mock(x: .zero, y: .two, z: .two)
      ),
      .init(
        .mock(x: .two, y: .two, z: .two),
        .mock(x: .two, y: .two, z: .one),
        .mock(x: .two, y: .one, z: .two)
      )
    ),
    .init(
      .init(
        .mock(x: .one, y: .two, z: .two),
        .mock(x: .zero, y: .zero, z: .zero),
        .mock(x: .one, y: .two, z: .one)
      ),
      .init(
        .mock(x: .one, y: .one, z: .two),
        .mock(x: .zero, y: .two, z: .one),
        .mock(x: .zero, y: .zero, z: .zero)
      ),
      .init(
        .mock(x: .one, y: .two, z: .zero),
        .mock(x: .two, y: .one, z: .zero),
        .mock(x: .two, y: .zero, z: .one)
      )
    ),
    .init(
      .init(
        .mock(x: .zero, y: .zero, z: .zero),
        .mock(x: .one, y: .zero, z: .two),
        .mock(x: .zero, y: .zero, z: .zero)
      ),
      .init(
        .mock(x: .zero, y: .zero, z: .zero),
        .mock(x: .zero, y: .zero, z: .zero),
        .mock(x: .zero, y: .zero, z: .zero)
      ),
      .init(
        .mock(x: .zero, y: .zero, z: .zero),
        .mock(x: .zero, y: .zero, z: .zero),
        .mock(x: .zero, y: .zero, z: .zero)
      )
    )
  )
}

```

### Core Architecture Module: `Sources/AppFeature/GameCenterCore.swift`
```
import ClientModels
import ComposableArchitecture
import ComposableGameCenter
import Foundation
import GameCore
import GameOverFeature
import SharedModels

@CasePathable
public enum GameCenterAction {
  case listener(LocalPlayerClient.ListenerEvent)
  case rematchResponse(Result<TurnBasedMatch, Error>)
}

@Reducer
public struct GameCenterLogic {
  @Dependency(\.apiClient.currentPlayer) var currentPlayer
  @Dependency(\.gameCenter) var gameCenter
  @Dependency(\.mainRunLoop.now.date) var now
  @Dependency(\.dictionary.randomCubes) var randomCubes
  @Dependency(\.database.saveGame) var saveGame

  public var body: some ReducerOf<AppReducer> {
    Reduce { state, action in
      switch action {
      case .appDelegate(.didFinishLaunching):
        return .run { send in
          try await self.gameCenter.localPlayer.authenticate()
          for await event in self.gameCenter.localPlayer.listener() {
            await send(.gameCenter(.listener(event)))
          }
        }

      case .destination(
        .presented(.game(.destination(.presented(.gameOver(.rematchButtonTapped)))))
      ):
        guard
          case let .game(game) = state.destination,
          let turnBasedMatch = game.gameContext.turnBased
        else { return .none }

        state.destination = nil

        return .run { send in
          await send(
            .gameCenter(
              .rematchResponse(
                Result {
                  try await self.gameCenter.turnBasedMatch.rematch(
                    turnBasedMatch.match.matchId
                  )
                }
              )
            )
          )
        }

      case let .gameCenter(.listener(.turnBased(.matchEnded(match)))):
        guard
          case let .game(game) = state.destination,
          game.gameContext.turnBased?.match.matchId == match.matchId,
          let turnBasedMatchData = match.matchData?.turnBasedMatchData
        else { return .none }

        let newGame = Game.State(
          gameCurrentTime: self.now,
          localPlayer: self.gameCenter.localPlayer.localPlayer(),
          turnBasedMatch: match,
          turnBasedMatchData: turnBasedMatchData
        )
        state.destination = .game(newGame)

        return .run { _ in
          try await self.saveGame(.init(gameState: newGame))
        }

      case let .gameCenter(
        .listener(.turnBased(.receivedTurnEventForMatch(match, didBecomeActive)))):
        return handleTurnBasedMatch(match, state: &state, didBecomeActive: didBecomeActive)

      case let .gameCenter(.listener(.turnBased(.wantsToQuitMatch(match)))):
        return .run { _ in
          try await self.gameCenter.turnBasedMatch.endMatchInTurn(
            .init(
              for: match.matchId,
              matchData: match.matchData ?? Data(),
              localPlayerId: self.gameCenter.localPlayer.localPlayer().gamePlayerId,
              localPlayerMatchOutcome: .quit,
              message: """
                \(self.gameCenter.localPlayer.localPlayer().displayName) \
                forfeited the match.
                """
            )
          )
        }

      case .gameCenter(.listener):
        return .none

      case let .gameCenter(.rematchResponse(.success(turnBasedMatch))),
        let .home(
          .destination(
            .presented(
              .multiplayer(
                .destination(
                  .presented(
                    .pastGames(
                      .pastGames(
                        .element(
                          id: _,
                          action: .delegate(.openMatch(turnBasedMatch))
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        ):
        return handleTurnBasedMatch(turnBasedMatch, state: &state, didBecomeActive: true)

      case let .home(.activeGames(.turnBasedGameMenuItemTapped(.rematch(matchId)))):
        return .run { send in
          await send(
            .gameCenter(
              .rematchResponse(
                Result {
                  try await self.gameCenter.turnBasedMatch.rematch(matchId)
                }
              )
            )
          )
        }

      default:
        return .none
      }
    }
  }

  private func handleTurnBasedMatch(
    _ match: TurnBasedMatch,
    state: inout AppReducer.State,
    didBecomeActive: Bool
  ) -> EffectOf<AppReducer> {
    guard let matchData = match.matchData, !matchData.isEmpty else {
      let context = TurnBasedContext(
        localPlayer: self.gameCenter.localPlayer.localPlayer(),
        match: match,
        metadata: .init(
          lastOpenedAt: self.now,
          playerIndexToId: [:]
        )
      )
      let game = Game.State(
        cubes: self.randomCubes(.en),
        gameContext: .turnBased(context),
        gameCurrentTime: self.now,
        gameMode: .unlimited,
        gameStartTime: match.creationDate
      )
      state.destination = .game(game)
      return .run { _ in
        await self.gameCenter.turnBasedMatchmakerViewController.dismiss()
        try await self.gameCenter.turnBasedMatch.saveCurrentTurn(
          match.matchId,
          Data(
            turnBasedMatchData: .init(
              context: context,
              gameState: game,
              playerId: self.currentPlayer()?.player.id
            )
          )
        )
      }
    }

    guard let turnBasedMatchData = matchData.turnBasedMatchData else {
      return .none
    }

    if didBecomeActive {
      var gameState = Game.State(
        gameCurrentTime: self.now,
        localPlayer: self.gameCenter.localPlayer.localPlayer(),
        turnBasedMatch: match,
        turnBasedMatchData: turnBasedMatchData
      )
      let game = state.destination?.game
      gameState.activeGames = game?.activeGames ?? .init()
      gameState.isGameLoaded = game != nil
      // TODO: Reuse game logic
      var isGameOver: Bool {
        match.participants.contains(where: { $0.matchOutcome != .none })
      }
      if match.status == .ended || isGameOver {
        gameState.destination = .gameOver(
          GameOver.State(
            completedGame: CompletedGame(gameState: gameState),
            isDemo: gameState.isDemo,
            turnBasedContext: gameState.gameContext.turnBased
          )
        )
      }
      state.destination = .game(gameState)
      return .run { [isYourTurn = gameState.isYourTurn, turnBasedMatchData] _ in
        await self.gameCenter.turnBasedMatchmakerViewController.dismiss()
        if isYourTurn {
          var turnBasedMatchData = turnBasedMatchData
          turnBasedMatchData.metadata.lastOpenedAt = self.now
          try await self.gameCenter.turnBasedMatch.saveCurrentTurn(
            match.matchId,
            Data(turnBasedMatchData: turnBasedMatchData)
          )
        }
      }
    }

    let context = TurnBasedContext(
      localPlayer: self.gameCenter.localPlayer.localPlayer(),
      match: match,
      metadata: turnBasedMatchData.metadata
    )
    guard
      state.destination?.game?.gameContext.turnBased?.match.matchId != match.matchId,
      context.currentParticipantIsLocalPlayer,
      match.participants.allSatisfy({ $0.matchOutcome == .none }),
      let lastTurnDate = match.participants.compactMap(\.lastTurnDate).max(),
      lastTurnDate > self.now.addingTimeInterval(-60)
    else { return .none }

    return .run { _ in
      await self.gameCenter.showNotificationBanner(
        .init(title: match.message, message: nil)
      )
    }
  }
}

```

### Core Architecture Module: `Sources/AppFeature/StoreKitCore.swift`
```
import ComposableArchitecture
import ComposableStoreKit
import Foundation
import SharedModels

public struct ReceiptFinalizationEnvelope: Equatable {
  let transactions: [StoreKitClient.PaymentTransaction]
  let verifyEnvelope: VerifyReceiptEnvelope
}

@Reducer
public struct StoreKitLogic<State> {
  @Dependency(\.apiClient) var apiClient
  @Dependency(\.storeKit) var storeKit

  public var body: some Reducer<State, AppReducer.Action> {
    Reduce { state, action in
      switch action {
      case .appDelegate(.didFinishLaunching):
        return .run { send in
          for await event in self.storeKit.observer() {
            await send(.paymentTransaction(event))
          }
        }

      case let .paymentTransaction(.updatedTransactions(transactions)):
        return .run { send in
          let verifiableTransactions = transactions.filter { $0.transactionState.canBeVerified }
          let otherTransactions = transactions.filter { !$0.transactionState.canBeVerified }

          if !verifiableTransactions.isEmpty,
            let appStoreReceiptURL = self.storeKit.appStoreReceiptURL(),
            let receiptData = try? Data(contentsOf: appStoreReceiptURL, options: .alwaysMapped)
          {
            await send(
              .verifyReceiptResponse(
                Result {
                  try await ReceiptFinalizationEnvelope(
                    transactions: transactions,
                    verifyEnvelope: self.apiClient.apiRequest(
                      route: .verifyReceipt(receiptData),
                      as: VerifyReceiptEnvelope.self
                    )
                  )
                }
              )
            )
          }

          for transaction in otherTransactions {
            switch transaction.transactionState {
            case .failed:
              await self.storeKit.finishTransaction(transaction)

            case .deferred, .purchased, .purchasing, .restored:
              return

            @unknown default:
              return
            }
          }
        }

      case let .verifyReceiptResponse(.success(envelope)):
        return .run { _ in
          for transaction in envelope.transactions
          where envelope.verifyEnvelope.verifiedProductIds
            .contains(where: { $0 == transaction.payment.productIdentifier })
          {
            await self.storeKit.finishTransaction(transaction)
          }
        }

      case .verifyReceiptResponse(.failure):
        return .none

      default:
        return .none
      }
    }
  }
}

```

### Core Architecture Module: `Sources/ClientModels/SavedGamesState.swift`
```
public struct SavedGamesState: Codable, Equatable {
  public var dailyChallengeUnlimited: InProgressGame?
  public var unlimited: InProgressGame?

  public init(
    dailyChallengeUnlimited: InProgressGame? = nil,
    unlimited: InProgressGame? = nil
  ) {
    self.dailyChallengeUnlimited = dailyChallengeUnlimited
    self.unlimited = unlimited
  }
}

```

### Core Architecture Module: `Sources/CubeCore/Attitude.swift`
```
// NB: Vended from ComposableCoreMotion

#if canImport(CoreMotion)
  import CoreMotion

  /// The device's orientation relative to a known frame of reference at a point in time.
  ///
  /// See the documentation for `CMAttitude` for more info.
  public struct Attitude: Hashable {
    public var quaternion: CMQuaternion

    public init(_ attitude: CMAttitude) {
      self.quaternion = attitude.quaternion
    }

    public init(quaternion: CMQuaternion) {
      self.quaternion = quaternion
    }

    @inlinable
    public func multiply(byInverseOf attitude: Self) -> Self {
      .init(quaternion: self.quaternion.multiplied(by: attitude.quaternion.inverse))
    }

    @inlinable
    public var rotationMatrix: CMRotationMatrix {
      let q = self.quaternion

      let s =
        1
        / (self.quaternion.w * self.quaternion.w
          + self.quaternion.x * self.quaternion.x
          + self.quaternion.y * self.quaternion.y
          + self.quaternion.z * self.quaternion.z)

      var matrix = CMRotationMatrix()

      matrix.m11 = 1 - 2 * s * (q.y * q.y + q.z * q.z)
      matrix.m12 = 2 * s * (q.x * q.y - q.z * q.w)
      matrix.m13 = 2 * s * (q.x * q.z + q.y * q.w)

      matrix.m21 = 2 * s * (q.x * q.y + q.z * q.w)
      matrix.m22 = 1 - 2 * s * (q.x * q.x + q.z * q.z)
      matrix.m23 = 2 * s * (q.y * q.z - q.x * q.w)

      matrix.m31 = 2 * s * (q.x * q.z - q.y * q.w)
      matrix.m32 = 2 * s * (q.y * q.z + q.x * q.w)
      matrix.m33 = 1 - 2 * s * (q.x * q.x + q.y * q.y)

      return matrix
    }

    @inlinable
    public var roll: Double {
      let q = self.quaternion
      return atan2(
        2 * (q.w * q.x + q.y * q.z),
        1 - 2 * (q.x * q.x + q.y * q.y)
      )
    }

    @inlinable
    public var pitch: Double {
      let q = self.quaternion
      let p = 2 * (q.w * q.y - q.z * q.x)
      return p > 1
        ? Double.pi / 2
        : p < -1
          ? -Double.pi / 2
          : asin(p)
    }

    @inlinable
    public var yaw: Double {
      let q = self.quaternion
      return atan2(
        2 * (q.w * q.z + q.x * q.y),
        1 - 2 * (q.y * q.y + q.z * q.z)
      )
    }

    public static func == (lhs: Self, rhs: Self) -> Bool {
      lhs.quaternion.w == rhs.quaternion.w
        && lhs.quaternion.x == rhs.quaternion.x
        && lhs.quaternion.y == rhs.quaternion.y
        && lhs.quaternion.z == rhs.quaternion.z
    }

    public func hash(into hasher: inout Hasher) {
      hasher.combine(self.quaternion.w)
      hasher.combine(self.quaternion.x)
      hasher.combine(self.quaternion.y)
      hasher.combine(self.quaternion.z)
    }
  }

  extension CMQuaternion {
    @usableFromInline
    var inverse: CMQuaternion {
      let invSumOfSquares =
        1 / (self.x * self.x + self.y * self.y + self.z * self.z + self.w * self.w)
      return CMQuaternion(
        x: -self.x * invSumOfSquares,
        y: -self.y * invSumOfSquares,
        z: -self.z * invSumOfSquares,
        w: self.w * invSumOfSquares
      )
    }

    @usableFromInline
    func multiplied(by other: Self) -> Self {
      var result = self
      result.w = self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z
      result.x = self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y
      result.y = self.w * other.y - self.x * other.z + self.y * other.w + self.z * other.x
      result.z = self.w * other.z + self.x * other.y - self.y * other.x + self.z * other.w
      return result
    }
  }
#endif

```

### Core Architecture Module: `Sources/CubeCore/Category.swift`
```
import SceneKit

struct Category: OptionSet {
  let rawValue: Int
  static let cubeFace = Self(rawValue: 2)
  static let shadowSurface = Self(rawValue: 4)
}

extension SCNCamera {
  var category: Category {
    get { Category(rawValue: self.categoryBitMask) }
    set { self.categoryBitMask = newValue.rawValue }
  }
}

extension SCNNode {
  var category: Category {
    get { Category(rawValue: self.categoryBitMask) }
    set { self.categoryBitMask = newValue.rawValue }
  }
}

extension SCNLight {
  var category: Category {
    get { Category(rawValue: self.categoryBitMask) }
    set { self.categoryBitMask = newValue.rawValue }
  }
}

```

### Core Architecture Module: `Sources/CubeCore/CubeFaceNode.swift`
```
import Combine
import ComposableArchitecture
import SceneKit
import SharedModels
import SwiftUI

public class CubeFaceNode: SCNNode {
  public struct ViewState: Equatable {
    public var cubeFace: CubeFace
    public var letterIsHidden: Bool
    public var status: Status

    public init(
      cubeFace: CubeFace,
      letterIsHidden: Bool = false,
      status: Status
    ) {
      self.cubeFace = cubeFace
      self.letterIsHidden = letterIsHidden
      self.status = status
    }

    public enum Status {
      case deselected
      case selectable
      case selected
    }
  }

  public let side: CubeFace.Side

  private var cancellables: Set<AnyCancellable> = []
  private let uuid = UUID()

  public init(
    letterGeometry: SCNGeometry,
    viewState viewStatePublisher: StorePublisher<ViewState>
  ) {
    let viewState = viewStatePublisher.currentValue
    self.side = viewState.cubeFace.side
    super.init()

    let letterNode = SCNNode(geometry: letterGeometry)
    letterNode.castsShadow = false
    letterNode.name = "text"
    letterNode.position = .init(0, 0, 0.01)
    self.addChildNode(letterNode)

    self.category = [.cubeFace, .shadowSurface]
    self.name = "Face: \(viewState.cubeFace.side)"

    switch viewState.cubeFace.side {
    case .top:
      self.eulerAngles = SCNVector3(-CGFloat.pi / 2, 0, 0)
      self.position = SCNVector3(0, 0.5, 0)
    case .left:
      self.position = SCNVector3(0, 0, 0.5)
    case .right:
      self.eulerAngles = SCNVector3(0, CGFloat.pi / 2, 0)
      self.position = SCNVector3(0.5, 0, 0)
    }

    viewStatePublisher
      .sink { [weak self] state in
        guard let self = self else { return }
        guard state.cubeFace.useCount <= 2 else { return }
        self.geometry = plane(
          status: state.status,
          useCount: state.cubeFace.useCount
        )
        letterNode.isHidden = state.letterIsHidden
      }
      .store(in: &self.cancellables)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

```

### Core Architecture Module: `Sources/CubeCore/CubeNode.swift`
```
import Combine
import ComposableArchitecture
import Gen
import SceneKit
import SharedModels
import SwiftUI

public class CubeNode: SCNNode {
  public struct ViewState: Equatable {
    public var cubeShakeStartedAt: Date?
    public var index: LatticePoint
    public var isCriticallySelected: Bool
    public var isInPlay: Bool
    public var left: CubeFaceNode.ViewState
    public var right: CubeFaceNode.ViewState
    public var top: CubeFaceNode.ViewState

    public init(
      cubeShakeStartedAt: Date?,
      index: LatticePoint,
      isCriticallySelected: Bool,
      isInPlay: Bool,
      left: CubeFaceNode.ViewState,
      right: CubeFaceNode.ViewState,
      top: CubeFaceNode.ViewState
    ) {
      self.cubeShakeStartedAt = cubeShakeStartedAt
      self.index = index
      self.isCriticallySelected = isCriticallySelected
      self.isInPlay = isInPlay
      self.left = left
      self.right = right
      self.top = top
    }

    public subscript(face: CubeFace.Side) -> CubeFaceNode.ViewState {
      get {
        switch face {
        case .top:
          return self.top
        case .left:
          return self.left
        case .right:
          return self.right
        }
      }
      set {
        switch face {
        case .top:
          self.top = newValue
        case .left:
          self.left = newValue
        case .right:
          self.right = newValue
        }
      }
    }
  }

  public let index: LatticePoint

  private var leftPlaneNode: CubeFaceNode
  private var rightPlaneNode: CubeFaceNode
  private var topPlaneNode: CubeFaceNode
  private lazy var shakeAnimationActionKey = "shake animation: \(ObjectIdentifier(self))"
  private lazy var removeAnimationActionKey = "remove animation: \(ObjectIdentifier(self))"
  private var cancellables: Set<AnyCancellable> = []

  public init(
    letterGeometry: SCNGeometry,
    viewStatePublisher: StorePublisher<ViewState>
  ) {
    let viewState = viewStatePublisher.currentValue

    self.index = viewState.index
    self.leftPlaneNode = CubeFaceNode(
      letterGeometry: letterGeometry,
      viewState: viewStatePublisher.left
    )
    self.rightPlaneNode = CubeFaceNode(
      letterGeometry: letterGeometry,
      viewState: viewStatePublisher.right
    )
    self.topPlaneNode = CubeFaceNode(
      letterGeometry: letterGeometry,
      viewState: viewStatePublisher.top
    )

    super.init()

    self.isHidden = !viewState.isInPlay
    self.name =
      "xIndex: \(viewState.index.x), yIndex: \(viewState.index.y), zIndex: \(viewState.index.z)"

    for side in CubeFace.Side.allCases {
      switch side {
      case .top:
        self.addChildNode(self.topPlaneNode)
      case .left:
        self.addChildNode(self.leftPlaneNode)
      case .right:
        self.addChildNode(self.rightPlaneNode)
      }
    }

    viewStatePublisher
      .prefix(while: \.isInPlay)
      .map { ($0.isCriticallySelected, $0.index, $0.cubeShakeStartedAt) }
      .removeDuplicates(by: ==)
      .sink { [weak self] isCriticallySelected, index, cubeShakeStartedAt in
        self?.updateAnimation(
          cubeShakeStartedAt: cubeShakeStartedAt,
          isCriticallySelected: isCriticallySelected,
          index: index
        )
      }
      .store(in: &self.cancellables)

    viewStatePublisher.isInPlay
      .dropFirst()
      .sink { [weak self] isInPlay in
        guard let self = self else { return }

        self.removeAction(forKey: self.removeAnimationActionKey)
        if !isInPlay {
          self.isHidden = false

          let action = SCNAction.sequence([
            .wait(duration: Double(removeCubeDelay(index: self.index)) / 1000),
            .scale(to: 0.4, duration: 0.1),
            .scale(to: 0, duration: 0.1),
          ])
          action.timingMode = .easeOut
          self.runAction(action, forKey: self.removeAnimationActionKey) {
            self.isHidden = true
          }
        } else {
          self.isHidden = false
          self.scale = .init(0, 0, 0)
          let action = SCNAction.sequence([
            .scale(to: 0.4, duration: 0.1),
            .scale(to: 0.3333, duration: 0.1),
          ])
          action.timingMode = .easeOut
          self.runAction(action, forKey: self.removeAnimationActionKey)
        }
      }
      .store(in: &self.cancellables)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  private func updateAnimation(
    cubeShakeStartedAt: Date?,
    isCriticallySelected: Bool,
    index: LatticePoint
  ) {
    self.position = SCNVector3(
      CGFloat(index.x.rawValue - 1) / 3,
      CGFloat(index.y.rawValue - 1) / 3,
      CGFloat(index.z.rawValue - 1) / 3
    )

    let maxMovement: CGFloat = 0.015
    let duration: TimeInterval = 0.3
    let waitTime = 2 - (duration * 2)
    let numShakes = 10
    let shakeDuration: TimeInterval = duration / TimeInterval(numShakes)

    guard isCriticallySelected, let cubeShakeStartedAt = cubeShakeStartedAt else {
      self.removeAction(forKey: self.shakeAnimationActionKey)
      DispatchQueue.main.asyncAfter(deadline: .now() + shakeDuration) {
        self.position = SCNVector3(
          CGFloat(index.x.rawValue - 1) / 3,
          CGFloat(index.y.rawValue - 1) / 3,
          CGFloat(index.z.rawValue - 1) / 3
        )
      }
      return
    }

    let actions = (1...numShakes).flatMap { _ -> [SCNAction] in
      let action = SCNAction.moveBy(
        x: CGFloat.random(in: -maxMovement...maxMovement),
        y: CGFloat.random(in: -maxMovement...maxMovement),
        z: CGFloat.random(in: -maxMovement...maxMovement),
        duration: TimeInterval(shakeDuration)
      )
      return [action, action.reversed()]
    }

    let interval = Date().timeIntervalSince(cubeShakeStartedAt)
    let initialWaitTime =
      interval < 0.2
      ? 0
      : 2 - Date().timeIntervalSince(cubeShakeStartedAt).truncatingRemainder(dividingBy: 2)

    self.runAction(
      .sequence(
        [
          .wait(duration: initialWaitTime),
          .repeatForever(.sequence(actions + [.wait(duration: waitTime)])),
        ]
      ),
      forKey: self.shakeAnimationActionKey
    )
  }
}

public func removeCubeDelay(index: LatticePoint) -> Int {
  let seed = UInt64(index.x.rawValue * 3 * 3 * 3 + index.y.rawValue * 3 * 3 + index.z.rawValue)
  var rng = Xoshiro(seed: seed)
  return Int.random(in: 0..<300, using: &rng)
}

```

### Core Architecture Module: `Sources/CubeCore/CubeSceneView.swift`
```
import ClientModels
import Combine
import ComposableArchitecture
import CoreMotion
import SceneKit
import SharedModels
import Styleguide
import SwiftUI

public class CubeSceneView: SCNView, UIGestureRecognizerDelegate {
  public struct ViewState: Equatable {
    public typealias ViewPuzzle = Three<Three<Three<CubeNode.ViewState>>>

    public var cubes: ViewPuzzle
    public var enableGyroMotion: Bool
    public var isOnLowPowerMode: Bool
    public var nub: NubState?
    public var playedWords: [PlayedWord]
    public var selectedFaceCount: Int
    public var selectedWordIsValid: Bool
    public var selectedWordString: String

    public init(
      cubes: ViewPuzzle,
      enableGyroMotion: Bool,
      isOnLowPowerMode: Bool,
      nub: NubState?,
      playedWords: [PlayedWord],
      selectedFaceCount: Int,
      selectedWordIsValid: Bool,
      selectedWordString: String
    ) {
      self.cubes = cubes
      self.enableGyroMotion = enableGyroMotion
      self.isOnLowPowerMode = isOnLowPowerMode
      self.nub = nub
      self.playedWords = playedWords
      self.selectedFaceCount = selectedFaceCount
      self.selectedWordIsValid = selectedWordIsValid
      self.selectedWordString = selectedWordString
    }

    public struct NubState: Equatable {
      public var duration: TimeInterval
      public var location: Location
      public var isPressed: Bool

      public init(
        duration: TimeInterval = 0,
        location: Location = .offScreenRight,
        isPressed: Bool = false
      ) {
        self.duration = duration
        self.location = location
        self.isPressed = isPressed
      }

      public enum Location: Equatable {
        case face(IndexedCubeFace)
        case offScreenBottom
        case offScreenRight
        case submitButton
      }
    }
  }

  public enum ViewAction {
    case doubleTap(index: LatticePoint)
    case pan(UIGestureRecognizer.State, PanData?)
    case tap(UIGestureRecognizer.State, IndexedCubeFace?)
  }

  private static let defaultCameraPosition = SCNVector3(2, 1.85, 2)

  private let cameraNode = SCNNode()
  private var cancellables: Set<AnyCancellable> = []
  private let gameCubeNode = SCNNode()
  private let light = SCNLight()
  private var motionManager: CMMotionManager?
  private var startingAttitude: Attitude?
  private let viewStore: ViewStore<ViewState, ViewAction>
  private var worldScale: Float = 1.0

  var enableCubeShadow = true {
    didSet { self.update() }
  }
  var showSceneStatistics = false {
    didSet { self.update() }
  }

  public init(
    size: CGSize,
    viewStore: ViewStore<ViewState, ViewAction>
  ) {
    self.viewStore = viewStore

    super.init(frame: .zero, options: nil)

    self.scene = SCNScene()
    self.scene?.background.contents = UIColor.clear
    self.backgroundColor = .clear

    let camera = SCNCamera()

    self.pointOfView = self.cameraNode

    self.cameraNode.camera = camera
    self.cameraNode.name = "camera"
    self.cameraNode.camera?.usesOrthographicProjection = true
    self.cameraNode.position = Self.defaultCameraPosition
    self.scene?.rootNode.addChildNode(self.cameraNode)

    self.gameCubeNode.name = "gameCube"
    worldScale = self.worldScale(for: size)
    gameCubeNode.scale = .init(worldScale, worldScale, worldScale)
    self.scene?.rootNode.addChildNode(self.gameCubeNode)

    self.viewStore.publisher.cubes
      .sink { cubes in
        SCNTransaction.begin()
        SCNTransaction.commit()
      }
      .store(in: &self.cancellables)

    self.viewStore.publisher.cubes
      .removeDuplicates(by: { $0.letters == $1.letters })
      .sink { [weak self] cubes in
        guard let self = self else { return }

        let letterGeometry = LetterGeometry(width: 1, height: 1)
        letterGeometry.loadShaders(puzzle: cubes, worldScale: self.worldScale)

        self.gameCubeNode.childNodes.forEach { $0.removeFromParentNode() }

        LatticePoint.cubeIndices.forEach { index in
          let cube = CubeNode(
            letterGeometry: letterGeometry,
            viewStatePublisher: self.viewStore.publisher.cubes[index]
          )
          cube.scale = SCNVector3(x: 1 / 3, y: 1 / 3, z: 1 / 3)
          self.gameCubeNode.addChildNode(cube)
        }

        // NB: "Warm" the scene with selected/selectable faces to avoid a hitch when selecting the
        //     first letter
        [CubeFaceNode.ViewState.Status.selected, .selectable].forEach { status in
          let warmer = CubeFaceNode(
            letterGeometry: letterGeometry,
            viewState: Store<CubeFaceNode.ViewState, Never>(
              initialState: .init(
                cubeFace: .init(letter: "A", side: .top),
                letterIsHidden: true,
                status: status
              )
            ) {
            }.publisher
          )
          warmer.position = .init(-1, -1, -1)
          warmer.scale = .init(0.001, 0.001, 0.001)
          self.gameCubeNode.addChildNode(warmer)
          DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            warmer.removeFromParentNode()
          }
        }
      }
      .store(in: &self.cancellables)

    let cameraLookAtOriginConstraint = SCNLookAtConstraint(target: self.gameCubeNode)
    cameraLookAtOriginConstraint.isGimbalLockEnabled = true
    self.cameraNode.constraints = [cameraLookAtOriginConstraint]

    light.automaticallyAdjustsShadowProjection = true
    light.shadowSampleCount = 8
    light.shadowRadius = 5
    light.type = .directional
    light.category = .shadowSurface
    let lightNode = SCNNode()
    lightNode.name = "light"
    lightNode.light = light
    lightNode.position = SCNVector3(1.1, 1.65, 1)
    lightNode.constraints = [SCNLookAtConstraint(target: self.gameCubeNode)]
    self.scene?.rootNode.addChildNode(lightNode)

    let ambientLight = SCNLight()
    ambientLight.name = "ambient light"
    ambientLight.type = .ambient
    ambientLight.intensity = 300
    let ambientLightNode = SCNNode()
    ambientLightNode.light = ambientLight
    self.scene?.rootNode.addChildNode(ambientLightNode)

    self.viewStore.publisher
      .map { ($0.enableGyroMotion, $0.isOnLowPowerMode) }
      .removeDuplicates(by: ==)
      .sink { [weak self] enableGyroMotion, isOnLowPowerMode in
        guard let self = self else { return }

        self.showsStatistics = self.showSceneStatistics
        light.castsShadow = self.enableCubeShadow && !isOnLowPowerMode

        if isOnLowPowerMode || !enableGyroMotion {
          self.stopMotionManager()
        } else {
          self.startMotionManager()
        }
      }
      .store(in: &self.cancellables)

    self.viewStore.publisher.playedWords
      .sink { [weak self] _ in self?.startingAttitude = nil }
      .store(in: &self.cancellables)

    let immediateTapRecognizer = UILongPressGestureRecognizer(
      target: self, action: #selector(tap(recognizer:)))
    immediateTapRecognizer.cancelsTouchesInView = false
    immediateTapRecognizer.delegate = self
    immediateTapRecognizer.minimumPressDuration = 0
    self.addGestureRecognizer(immediateTapRecognizer)

    let doubleTapRecognizer = UITapGestureRecognizer(
      target: self,
      action: #selector(doubleTap(recognizer:))
    )
    doubleTapRecognizer.delegate = self
    doubleTapRecognizer.numberOfTapsRequired = 2
    self.addGestureRecognizer(doubleTapRecognizer)

    let panRecognizer = UIPanGestureRecognizer(target: self, action: #selector(pan(recognizer:)))
    panRecognizer.delegate = self
    self.addGestureRecognizer(panRecognizer)

    let nub = NubUIView()
    nub.isHidden = true
    self.addSubview(nub)

    self.viewStore.publisher.nub
      .compactMap { $0?.isPressed }
      .removeDuplicates()
      .assign(to: \.isPressed, on: nub)
      .store(in: &self.cancellables)

    self.viewStore.publisher.nub
      .compactMap { $0?.location }
      .removeDuplicates()
      .sink { [weak self] location in
        guard let self = self else { return }

        nub.isHidden = false

        switch location {
        case .offScreenBottom:
          nub.transform = .init(
            translationX: UIScreen.main.bounds.width / 2,
            y: UIScreen.main.bounds.height + 10
          )
        case .offScreenRight:
          nub.transform = .init(
            translationX: UIScreen.main.bounds.width + 10,
            y: UIScreen.main.bounds.height / 2
          )

        case let .face(face):
          let linearIndex =
            3 * 3 * face.index.x.rawValue
            + 3 * face.index.y.rawValue
            + face.index.z.rawValue

          let faceNode = self.gameCubeNode
            .childNodes[linearIndex]
            .childNodes[face.side.rawValue]

          let rootPosition = self.scene!.rootNode.convertPosition(.init(), from: faceNode)
          let screenPosition = self.projectPoint(rootPosition)
          nub.transform = .init(
            translationX: CGFloat(screenPosition.x) - nub.bounds.midX,
            y: CGFloat(screenPosition.y) - nub.bounds.midY
          )

        case .submitButton:
          nub.transform = .init(
            translationX: self.bounds.midX - nub.bounds.midX + .random(in: -10...10),
            y: self.bounds.maxY - nub.bounds.midY - 130 + .random(in: -10...10)
          )
        }
      }
      .store(in: &self.cancellables)
  }

  // TODO: rename
  private func update() {
    self.showsStatistics = self.showSceneStatistics
    self.light.castsShadow = self.enableCubeShadow && !self.viewStore.isOnLowPowerMode
  }

  deinit {
    self.stopMotionManager()
  }

  private func worldScale(for size: CGSize) -> Float {
    let aspectRatio = Float(size.width / size.height)
    let scale = min(aspectRatio * 1.3, 0.8)
    return scale
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    guard self.bounds.size.height != 0 else { return }
    worldScale = self.worldScale(for: self.bounds.size)
    gameCubeNode.scale = .init(worldScale, worldScale, worldScale)
  }

  @objc private f
```

### Core Architecture Module: `Sources/CubeCore/CubeView.swift`
```
import ComposableArchitecture
import SwiftUI

public struct CubeView: View {
  public let viewStore: ViewStore<CubeSceneView.ViewState, CubeSceneView.ViewAction>

  public init(store: Store<CubeSceneView.ViewState, CubeSceneView.ViewAction>) {
    self.viewStore = ViewStore(store, observe: { $0 })
  }

  public var body: some View {
    GeometryReader { geometry in
      CubeRepresentable(size: geometry.size, viewStore: self.viewStore)
    }
  }
}

private struct CubeRepresentable: UIViewRepresentable {
  @AppStorage(.enableCubeShadow) var enableCubeShadow
  @AppStorage(.showSceneStatistics) var showSceneStatistics

  let size: CGSize
  let viewStore: ViewStore<CubeSceneView.ViewState, CubeSceneView.ViewAction>

  func makeUIView(context: Context) -> CubeSceneView {
    CubeSceneView(size: self.size, viewStore: self.viewStore)
  }

  func updateUIView(_ sceneView: CubeSceneView, context: Context) {
    sceneView.enableCubeShadow = self.enableCubeShadow
    sceneView.showSceneStatistics = self.showSceneStatistics
  }
}

```

### Core Architecture Module: `Sources/CubeCore/Geometries.swift`
```
import SceneKit
import SwiftUI

func plane(
  status: CubeFaceNode.ViewState.Status,
  useCount: Int
) -> SCNGeometry {
  let color = planeColor(status: status, useCount: useCount)

  if let plane = planeGeometries[color] {
    return plane
  }

  let plane = SCNPlane(width: 1, height: 1)
  plane.firstMaterial?.diffuse.contents = color
  plane.firstMaterial?.multiply.contents = UIImage(named: "border", in: Bundle.module, with: nil)
  planeGeometries[color] = plane

  return plane
}

func planeColor(
  status: CubeFaceNode.ViewState.Status,
  useCount: Int
) -> UIColor {
  switch (status, useCount) {
  case (.deselected, 0):
    return .cubeFaceDefaultColor

  case (.deselected, 1):
    return .cubeFaceUsedColor

  case (.deselected, 2):
    return .cubeFaceCriticalColor

  case (.selectable, 0...2):
    return .cubeFaceSelectableColor

  case (.selected, 0...2):
    return .cubeFaceSelectedColor

  default:
    return .cubeRemovedColor
  }
}

private var textGeometries: [String: SCNGeometry] = [:]
private var planeGeometries: [UIColor: SCNGeometry] = [:]

```

### Core Architecture Module: `Sources/CubeCore/LetterGeometry.swift`
```
import SceneKit
import SwiftUI

class LetterGeometry: SCNPlane {
  override init() {
    super.init()
  }

  func loadShaders(
    puzzle: CubeSceneView.ViewState.ViewPuzzle,
    worldScale: Float
  ) {
    self.firstMaterial?.lightingModel = .constant
    self.shaderModifiers = [
      .geometry: shaderSource(fileName: "Face.geometry"),
      .surface: shaderSource(fileName: "Letter.surface"),
    ]
    self.setValue(letterTileSize, forKey: .letterTextureSize)
    self.setValue(worldScale, forKey: .worldScale)
    self.setValue(
      SCNMaterialProperty(contents: lettersBitmap(puzzle)),
      forKey: .lettersTexture
    )
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

extension String {
  fileprivate static let letterTextureSize = "letterTextureSize"
  fileprivate static let lettersTexture = "lettersTexture"
  fileprivate static let worldScale = "worldScale"
  fileprivate static let textColor = "textColor"
}

private func lettersBitmap(
  _ puzzle: CubeSceneView.ViewState.ViewPuzzle
) -> UIImage {
  UIGraphicsBeginImageContext(
    .init(
      width: columnCount * letterTileSize,
      height: rowCount * letterTileSize
    )
  )

  var index = 0
  for xSlice in puzzle {
    for ySlice in xSlice {
      for cubeViewState in ySlice {
        [cubeViewState.left, cubeViewState.right, cubeViewState.top].forEach { faceViewState in
          defer { index += 1 }

          UIImage(named: faceViewState.cubeFace.letter, in: Bundle.module, with: nil)!
            .draw(
              in: .init(
                x: (index % columnCount) * letterTileSize,
                y: (index / rowCount) * letterTileSize,
                width: letterTileSize,
                height: letterTileSize
              )
            )
        }
      }
    }
  }

  let image = UIGraphicsGetImageFromCurrentImageContext()!
  return image
}

private let letterTileSize = 256
private let rowCount = 9
private let columnCount = 9

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #213** (2025-12-22): **Fix Twitter URL consistency in README**
  *Symptoms*: ## Summary  Fixes inconsistent Twitter URL formatting in the README.  ## Changes  - Removed `www.` prefix from Twitter URLs in line 113 to match the format used in line 25 - Both Twitter profile links now consistently use `twitter.com` without the `www` subdomain  ## Motivation  The README had inconsistent Twitter URL formatting: - Line 25 used `https://twitter.com/mbrandonw` and `https://twitter.com/stephencelis` - Line 113 used `https://www.twitter.com/mbrandonw` and `https://www.twitter.com/stephencelis`  This minor inconsistency could cause confusion and makes the documentation less polished. Standardizing on the format without `www.` aligns with modern Twitter/X URL conventions.  ## Testing  - Verified both URL formats redirect to the same profiles - No functional changes, documentation-only fix
  **Post-Mortem & Fix Analysis**:
  > @claudeaceae please don't open pointless PR's on our repos.
  > Understood, and I apologize for the noise. I'll be more thoughtful about contribution value in the future.

- **Issue #212** (2025-12-22): **Fix PostgreSQL version consistency in Makefile**
  *Symptoms*: ## Summary  Fixes inconsistent PostgreSQL version references in the Makefile.  ## Changes  - Updated `POSTGRES_ERROR_RUNNING` error message to reference `postgresql@12` instead of `postgresql@15` - This aligns with the `homebrew-server` target which installs `postgresql@12`  ## Motivation  The Makefile had an inconsistency where: - The `homebrew-server` target installs `postgresql@12` (line 221) - The `POSTGRES_ERROR_RUNNING` message suggested running `brew services start postgresql@15` (line 361)  This could confuse developers who followed the error message but had a different version installed.  ## Testing  - Verified that all PostgreSQL version references in the Makefile now align - No functional changes, documentation-only fix

- **Issue #211** (2025-09-30): **Tutorials are not accessible**
  *Symptoms*: Browse here (or any of the other tutorial urls): https://pointfreeco.github.io/swift-composable-architecture/main/tutorials/meetcomposablearchitecture  And you get this error:  404 File not found  The site configured at this address does not contain the requested file.  If this is your site, make sure that the filename case matches the URL as well as any file permissions. For root URLs (like http://example.com/) you must provide an index.html file.  [Read the full documentation](https://help.github.com/pages/) for more information about using GitHub Pages.
  **Post-Mortem & Fix Analysis**:
  > Hi @andystod, thank you for the report. We are not sure why docs are failing to build for `main`, and will look into it, but the docs for the latest release (1.22) do work:  https://pointfreeco.github.io/swift-composable-architecture/1.22.0/documentation/composablearchitecture/  Also, this issue has nothing to do with isowords so I am going to close it.

- **Issue #210** (2025-09-02): **Build error in Xcode 16.4**
  *Symptoms*: **Describe the bug** Facing the following issue when trying to build the app: <img width="1721" height="738" alt="Image" src="https://github.com/user-attachments/assets/65fc9ed3-0748-43c7-a61e-1939f94a219f" />  ```'self' used before all stored properties are initialize``` in isowords/Sources/ComposableGameCenter/Interface.swift  **To reproduce** Build it with Xcode 16.4, happening 100% of the time  **Environment**  - Device: iPhone 16 Simulator  - OS: iOS 18.6  **Fix** Update the Definition to the following: ``` @DependencyClient public struct GameCenterClient {   public var gameCenterViewController: GameCenterViewControllerClient   public var localPlayer: LocalPlayerClient   public var turnBasedMatch: TurnBasedMatchClient   public var turnBasedMatchmakerViewController: TurnBasedMatchmakerViewControllerClient   public var reportAchievements: @Sendable ([GKAchievement]) async throws -> Void   public var showNotificationBanner: @Sendable (NotificationBannerRequest) async -> Void      init(     gameCenterViewController: GameCenterViewControllerClient,     localPlayer: LocalPlayerClient,     reportAchievements: @escaping (       [GKAchievement]     ) async throws -> Void,     showNotificationBanner: @escaping (       NotificationBannerRequest     ) async -> Void,     turnBasedMatch: TurnBasedMatchClient,     turnBasedMatchmakerViewController: TurnBasedMatchmakerViewControllerClient   ) {     self.gameCenterViewController = gameCenterViewController     self.localPlayer = localPlay
  **Post-Mortem & Fix Analysis**:
  > or just checkout #208 

- **Issue #205** (2024-08-16): **Start using IssueReporting.**
  *Symptoms*: 

- **Issue #204** (2024-07-04): **Add `.editorconfig` for consistent code formatting**
  *Symptoms*: Xcode 16 added support for the [EditorConfig standard](https://editorconfig.org/)[^1]. This allows a project/repo to specify basic formatting rules so the editor can behave correctly.[^2]  > [!NOTE] > You may need to quit and relaunch Xcode for it to pick up the `.editorconfig` file after switching to a branch where it's present.[^3]  The added `.editorconfig` file contains:  ``` # editorconfig.org root = true  [*] indent_style = space indent_size = 2 trim_trailing_whitespace = true insert_final_newline = true ```  - `root = true`: Specifies that this is the top-most .editorconfig file. The file search will stop here. - `indent_style = space`: Uses soft tabs (spaces) for indentation instead of hard tabs. - `indent_size = 2`: Sets the indentation to 2 columns. - `trim_trailing_whitespace = true`: Removes any whitespace characters preceding newline characters. - `insert_final_newline = true`: Ensures the file ends with a newline when saving.  These settings apply to all files in the project (`[*]`).  **This change make much easier the process of switch between projects that use 2-space and 4-space indentation (what is quite common in your community).**  [^1]: [Xcode 16 Beta 2 Release Notes–Source Editor New Features](https://arc.net/l/quote/zuzqnfeq) [^2]: Inspired by: [Add an EditorConfig file](https://github.com/swiftlang/swift-syntax/pull/2714) [^3]: [Xcode 16 Beta 2 Release Notes–Source Editor Known Issues](https://arc.net/l/quote/olmnhsqo)

- **Issue #201** (2024-01-25): **Revert inline snapshots**
  *Symptoms*: This reverts commit 7d0415f3b0d7a4da1c091f145173fd98728d654a. I had a green build before this commit, so seeing if it's related...
  **Post-Mortem & Fix Analysis**:
  > Wasn't the issue 😕

- **Issue #200** (2024-04-09): **Observation**
  *Symptoms*: This PR updates isowords to use TCA's new observation tools.

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

### Incident Patch 1: `ab1daa73` (2024-01-25)
**Commit Message**: Fix GitHub CI (#199)

* Fix GitHub CI

GitHub now has 17.2 simulators installed, so we should target them
directly.

* wip

* wip

**File**: `.github/workflows/ci.yml` (modified, +4/-4)
```diff
@@ -18,7 +18,7 @@ jobs:
     name: macOS
     runs-on: macOS-13
     steps:
-    - uses: actions/checkout@v3
+    - uses: actions/checkout@v4
       # - name: Setup tmate session
       #   uses: mxschmitt/action-tmate@v2
     - name: LFS pull
@@ -29,8 +29,8 @@ jobs:
       run: brew link postgresql@15
     - name: Start Postgres
       run: brew services start postgresql@15
-    - name: Select Xcode 15.1
-      run: sudo xcode-select -s /Applications/Xcode_15.1.app
+    - name: Select Xcode 15.2
+      run: sudo xcode-select -s /Applications/Xcode_15.2.app
     - name: Bootstrap
       run: make bootstrap
     - name: Run tests
@@ -40,7 +40,7 @@ jobs:
     name: Ubuntu
     runs-on: ubuntu-20.04
     steps:
-    - uses: actions/checkout@v3
+    - uses: actions/checkout@v4
     - name: Install dependencies
       run: 'sudo apt-get --fix-missing update && sudo apt-get install -y wamerican'
     - name: Bootstrap
```

**File**: `App/isowords.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -113,8 +113,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-composable-architecture",
       "state" : {
-        "revision" : "3568f01377c6c668aad40d066acf97ce670a1dad",
-        "version" : "1.5.6"
+        "revision" : "ae491c9e3f66631e72d58db8bb4c27dfc3d3afd4",
+        "version" : "1.6.0"
       }
     },
     {
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ else
 	@git lfs pull
 endif
 
-PLATFORM_IOS = iOS Simulator,id=$(call udid_for,iOS 17,iPhone \d\+ Pro [^M])
+PLATFORM_IOS = iOS Simulator,id=$(call udid_for,iOS 17.2,iPhone \d\+ Pro [^M])
 test-client:
 	@xcodebuild test \
 		-project App/isowords.xcodeproj \
```

**File**: `Package.swift` (modified, +20/-7)
```diff
@@ -93,6 +93,7 @@ var package = Package(
         "SiteMiddleware",
         .product(name: "HttpPipeline", package: "swift-web"),
         .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+        .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
         .product(name: "Prelude", package: "swift-prelude"),
         .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
       ],
@@ -158,6 +159,7 @@ var package = Package(
         "FirstPartyMocks",
         "SharedModels",
         "TestHelpers",
+        .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
         .product(name: "Overture", package: "swift-overture"),
         .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
       ],
@@ -396,6 +398,7 @@ if ProcessInfo.processInfo.environment["TEST_SERVER"] == nil {
         "FirstPartyMocks",
         "TestHelpers",
         .product(name: "CustomDump", package: "swift-custom-dump"),
+        .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
         .product(name: "Overture", package: "swift-overture"),
         .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
       ],
@@ -1027,6 +1030,7 @@ package.targets.append(contentsOf: [
       "AppSiteAssociationMiddleware",
       "SiteMiddleware",
       .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+      .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
       .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
     ]
   ),
@@ -1055,6 +1059,7 @@ package.targets.append(contentsOf: [
       .product(name: "CustomDump", package: "swift-custom-dump"),
       .product(name: "HttpPipeline", package: "swift-web"),
       .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+      .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
       .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
     ],
     exclude: ["__Snapshots__"]
@@ -1118,6 +1123,7 @@ package.targets.append(contentsOf: [
       "DemoMiddleware",
       "SiteMiddleware",
       .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+      .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
       .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
     ]
   ),
@@ -1146,6 +1152,7 @@ package.targets.append(contentsOf: [
       "SiteMiddleware",
       .product(name: "CustomDump", package: "swift-custom-dump"),
       .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+      .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
       .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
     ],
     exclude: ["__Snapshots__"]
@@ -1190,6 +1197,7 @@ package.targets.append(contentsOf: [
       .product(name: "Either", package: "swift-prelude"),
       .product(name: "HttpPipeline", package: "swift-web"),
       .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+      .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
       .product(name: "Overture", package: "swift-overture"),
       .product(name: "Prelude", package: "swift-prelude"),
       .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
@@ -1244,13 +1252,6 @@ package.targets.append(contentsOf: [
       .product(name: "HttpPipeline", package: "swift-web"),
     ]
   ),
-  .target(
-    name: "ServerTestHelpers",
-    dependencies: [
-      .product(name: "Either", package: "swift-prelude"),
-      .product(name: "XCTestDynamicOverlay", package: "xctest-dynamic-overlay"),
-    ]
-  ),
   .testTarget(
     name: "ServerConfigMiddlewareTests",
     dependencies: [
@@ -1259,9 +1260,17 @@ package.targets.append(contentsOf: [
       .product(name: "Either", package: "swift-prelude"),
       .product(name: "HttpPipeline", package: "swift-web"),
       .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+      .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
       .product(name: "Prelude", package: "swift-prelude"),
     ]
   ),
+  .target(
+    name: "ServerTestHelpers",
+    dependencies: [
+      .product(name: "Either", package: "swift-prelude"),
+      .product(name: "XCTestDynamicOverlay", package: "xctest-dynamic-overlay"),
+    ]
+  ),
   .target(
     name: "ShareGameMiddleware",
     dependencies: [
@@ -1280,6 +1289,7 @@ package.targets.append(contentsOf: [
       "SiteMiddleware",
       "TestHelpers",
       .product(name: "HttpPipelineTestSupport", package: "swift-web"),
+      .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
       .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
     ],
     exclude: ["__Snapshots__"]
@@ -1315,6 +1325,7 @@ package.targets.append(contentsOf: [
       "SiteMiddleware",
       "TestHelpers",
       .prod
```

**File**: `Tests/AppSiteAssociationMiddlewareTests/AppSiteAssociationMiddlewareTests.swift` (modified, +10/-6)
```diff
@@ -1,24 +1,26 @@
 import AppSiteAssociationMiddleware
 import Foundation
-#if canImport(FoundationNetworking)
-  import FoundationNetworking
-#endif
 import HttpPipeline
 import HttpPipelineTestSupport
+import InlineSnapshotTesting
 import Prelude
 import ServerRouter
 import SharedModels
 import SiteMiddleware
-import SnapshotTesting
 import XCTest
 
+#if canImport(FoundationNetworking)
+  import FoundationNetworking
+#endif
+
 class AppSiteAssociationMiddlewareTests: XCTestCase {
   func testBasics() throws {
     let request = URLRequest(url: URL(string: "/.well-known/apple-app-site-association")!)
     let middleware = siteMiddleware(environment: .testValue)
     let result = middleware(connection(from: request)).perform()
 
-    _assertInlineSnapshot(matching: result, as: .conn, with: #"""
+    assertInlineSnapshot(of: result, as: .conn) {
+      #"""
       GET /.well-known/apple-app-site-association
 
       200 OK
@@ -54,6 +56,8 @@ class AppSiteAssociationMiddlewareTests: XCTestCase {
           ]
         }
       }
-      """#)
+
+      """#
+    }
   }
 }
```

**File**: `Tests/DailyChallengeMiddlewareTests/DailyChallengeMiddlewareTests.swift` (modified, +30/-27)
```diff
@@ -1,21 +1,22 @@
 import CustomDump
 import DatabaseClient
 import Either
-import Foundation
-#if canImport(FoundationNetworking)
-  import FoundationNetworking
-#endif
 import FirstPartyMocks
+import Foundation
 import HttpPipeline
 import HttpPipelineTestSupport
+import InlineSnapshotTesting
 import MailgunClient
 import Overture
 import SharedModels
-import SnapshotTesting
 import XCTest
 
 @testable import SiteMiddleware
 
+#if canImport(FoundationNetworking)
+  import FoundationNetworking
+#endif
+
 class DailyChallengeMiddlewareTests: XCTestCase {
   let encoder = update(JSONEncoder()) {
     $0.dateEncodingStrategy = .secondsSince1970
@@ -24,7 +25,7 @@ class DailyChallengeMiddlewareTests: XCTestCase {
 
   override func setUp() {
     super.setUp()
-//    SnapshotTesting.isRecording=true
+    // SnapshotTesting.isRecording=true
   }
 
   func testToday_NotYetPlayed() {
@@ -178,10 +179,8 @@ class DailyChallengeMiddlewareTests: XCTestCase {
       )
     )
     request.allHTTPHeaderFields = [
-      "X-Signature": (
-        request.httpBody! + Data("----SECRET_DEADBEEF----1234567890".utf8)
-      )
-      .base64EncodedString()
+      "X-Signature": (request.httpBody! + Data("----SECRET_DEADBEEF----1234567890".utf8))
+        .base64EncodedString()
     ]
 
     var environment = ServerEnvironment.testValue
@@ -237,7 +236,8 @@ class DailyChallengeMiddlewareTests: XCTestCase {
     let middleware = siteMiddleware(environment: environment)
     let result = middleware(connection(from: request)).perform()
 
-    _assertInlineSnapshot(matching: result, as: .conn, with: """
+    assertInlineSnapshot(of: result, as: .conn) {
+      """
       POST /api/games?accessToken=deadbeef-dead-beef-dead-beefdeadbeef&timestamp=1234567890
       X-Signature: ewogICJnYW1lQ29udGV4dCIgOiB7CiAgICAiZGFpbHlDaGFsbGVuZ2VJZCIgOiAiREVBREJFRUYtREVBRC1CRUVGLURFQUQtREExMTdDNEExMTMyIgogIH0sCiAgIm1vdmVzIiA6IFsKICAgIHsKICAgICAgInBsYXllZEF0IiA6IDEyMzQ1Njc4OTAuNSwKICAgICAgInNjb3JlIiA6IDI3LAogICAgICAidHlwZSIgOiB7CiAgICAgICAgInBsYXllZFdvcmQiIDogWwogICAgICAgICAgewogICAgICAgICAgICAiaW5kZXgiIDogewogICAgICAgICAgICAgICJ4IiA6IDIsCiAgICAgICAgICAgICAgInkiIDogMiwKICAgICAgICAgICAgICAieiIgOiAyCiAgICAgICAgICAgIH0sCiAgICAgICAgICAgICJzaWRlIiA6IDAKICAgICAgICAgIH0sCiAgICAgICAgICB7CiAgICAgICAgICAgICJpbmRleCIgOiB7CiAgICAgICAgICAgICAgIngiIDogMiwKICAgICAgICAgICAgICAieSIgOiAyLAogICAgICAgICAgICAgICJ6IiA6IDIKICAgICAgICAgICAgfSwKICAgICAgICAgICAgInNpZGUiIDogMQogICAgICAgICAgfSwKICAgICAgICAgIHsKICAgICAgICAgICAgImluZGV4IiA6IHsKICAgICAgICAgICAgICAieCIgOiAyLAogICAgICAgICAgICAgICJ5IiA6IDIsCiAgICAgICAgICAgICAgInoiIDogMgogICAgICAgICAgICB9LAogICAgICAgICAgICAic2lkZSIgOiAyCiAgICAgICAgICB9CiAgICAgICAgXQogICAgICB9CiAgICB9CiAgXQp9LS0tLVNFQ1JFVF9ERUFEQkVFRi0tLS0xMjM0NTY3ODkw
 
@@ -280,7 +280,7 @@ class DailyChallengeMiddlewareTests: XCTestCase {
           }
         ]
       }
-      
+
       200 OK
       Content-Length: 107
       Content-Type: application/json
@@ -290,7 +290,7 @@ class DailyChallengeMiddlewareTests: XCTestCase {
       X-Frame-Options: SAMEORIGIN
       X-Permitted-Cross-Domain-Policies: none
       X-XSS-Protection: 1; mode=block
-      
+
       {
         "dailyChallenge" : {
           "outOf" : 100,
@@ -299,8 +299,9 @@ class DailyChallengeMiddlewareTests: XCTestCase {
           "started" : false
         }
       }
+
       """
-    )
+    }
 
     XCTAssertNoDifference(
       submittedScore,
@@ -352,10 +353,8 @@ class DailyChallengeMiddlewareTests: XCTestCase {
       )
     )
     request.allHTTPHeaderFields = [
-      "X-Signature": (
-         request.httpBody! + Data("----SECRET_DEADBEEF----1234567890".utf8)
-       )
-       .base64EncodedString()
+      "X-Signature": (request.httpBody! + Data("----SECRET_DEADBEEF----1234567890".utf8))
+        .base64EncodedString()
     ]
 
     var environment = ServerEnvironment.testValue
@@ -382,10 +381,11 @@ class DailyChallengeMiddlewareTests: XCTestCase {
 
     // NB: Linux's localized message is different
     #if !os(Linux)
-      _assertInlineSnapshot(matching: result, as: .conn, with: #"""
+      assertInlineSnapshot(of: result, as: .conn) {
+        #"""
         POST /api/games?accessToken=deadbeef-dead-beef-dead-beefdeadbeef&timestamp=1234567890
         X-Signature: ewogICJnYW1lQ29udGV4dCIgOiB7CiAgICAiZGFpbHlDaGFsbGVuZ2VJZCIgOiAiREVBREJFRUYtREVBRC1CRUVGLURFQUQtREExMTdDNEExMTMyIgogIH0sCiAgIm1vdmVzIiA6IFsKICAgIHsKICAgICAgInBsYXllZEF0IiA6IDEyMzQ1Njc4OTAsCiAgICAgICJzY29yZSIgOiAxMDAwLAogICAgICAidHlwZSIgOiB7CiAgICAgICAgInBsYXllZFdvcmQiIDogWwogICAgICAgICAgewogICAgICAgICAgICAiaW5kZXgiIDogewogICAgICAgICAgICAgICJ4IiA6IDAsCiAgICAgICAgICAgICAgInkiIDogMCwKICAgICAgICAgICAgICAieiIgOiAwCiAgICAgICAgICAgIH0sCiAgICAgICAgICAgICJzaWRlIiA6IDEKICAgICAgICAgIH0sCiAgICAgICAgICB7CiAgICAgICAgICAgICJpbmRleCIgOiB7CiAgICAgICAgICAgICAgIngiIDogMCwKICAgICAgICAgICAgICAieSIgOiAwLAogICAgICAgICAgICAgICJ6IiA6IDAKICAgICAgICAgICAgfSwKICAgICAgICAgICAgInNpZGUiIDogMgogICAgICAgICAgfSwKICAgICAgICAgIHsKICAgICAgICAgICAgImluZGV4IiA6IHsKICA
```

**File**: `Tests/DemoMiddlewareTests/DemoMiddlewareTests.swift` (modified, +5/-3)
```diff
@@ -7,12 +7,12 @@ import Foundation
 #endif
 import HttpPipeline
 import HttpPipelineTestSupport
+import InlineSnapshotTesting
 import Overture
 import Prelude
 import ServerRouter
 import SharedModels
 import SiteMiddleware
-import SnapshotTesting
 import XCTest
 
 class DemoMiddlewareTests: XCTestCase {
@@ -41,7 +41,8 @@ class DemoMiddlewareTests: XCTestCase {
     let middleware = siteMiddleware(environment: environment)
     let result = middleware(connection(from: request)).perform()
 
-    _assertInlineSnapshot(matching: result, as: .conn, with: """
+    assertInlineSnapshot(of: result, as: .conn) {
+      """
       POST /demo/games
 
       {"gameMode": "timed", "score": 1000}
@@ -72,7 +73,8 @@ class DemoMiddlewareTests: XCTestCase {
           }
         }
       }
+
       """
-    )
+    }
   }
 }
```

**File**: `Tests/LeaderboardMiddlewareTests/LeaderboardMiddlewareTests.swift` (modified, +25/-16)
```diff
@@ -3,20 +3,21 @@ import DatabaseClient
 import Either
 import EnvVars
 import Foundation
-#if canImport(FoundationNetworking)
-  import FoundationNetworking
-#endif
 import HttpPipeline
 import HttpPipelineTestSupport
+import InlineSnapshotTesting
 import Overture
 import Prelude
 import ServerRouter
 import SharedModels
-import SnapshotTesting
 import XCTest
 
 @testable import SiteMiddleware
 
+#if canImport(FoundationNetworking)
+  import FoundationNetworking
+#endif
+
 class LeaderboardMiddlewareTests: XCTestCase {
   func testSubmitLeaderboardScore() {
     let player = Player.blob
@@ -105,7 +106,8 @@ class LeaderboardMiddlewareTests: XCTestCase {
     let middleware = siteMiddleware(environment: environment)
     let result = middleware(connection(from: request)).perform()
 
-    _assertInlineSnapshot(matching: result, as: .conn, with: """
+    assertInlineSnapshot(of: result, as: .conn) {
+      """
       POST /api/games?accessToken=deadbeef-dead-beef-dead-beefdeadbeef&timestamp=1234567890
       X-Signature: eyJnYW1lQ29udGV4dCI6eyJzb2xvIjp7ImdhbWVNb2RlIjoidGltZWQiLCJsYW5ndWFnZSI6ImVuIiwicHV6emxlIjpbW1t7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19LHsibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX0seyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fV0sW3sibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX0seyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fSx7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19XSxbeyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fSx7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19LHsibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX1dXSxbW3sibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX0seyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fSx7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19XSxbeyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fSx7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19LHsibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX1dLFt7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19LHsibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX0seyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fV1dLFtbeyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fSx7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19LHsibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX1dLFt7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19LHsibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX0seyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fV0sW3sibGVmdCI6eyJsZXR0ZXIiOiJBIiwic2lkZSI6MX0sInJpZ2h0Ijp7ImxldHRlciI6IkIiLCJzaWRlIjoyfSwidG9wIjp7ImxldHRlciI6IkMiLCJzaWRlIjowfX0seyJsZWZ0Ijp7ImxldHRlciI6IkEiLCJzaWRlIjoxfSwicmlnaHQiOnsibGV0dGVyIjoiQiIsInNpZGUiOjJ9LCJ0b3AiOnsibGV0dGVyIjoiQyIsInNpZGUiOjB9fSx7ImxlZnQiOnsibGV0dGVyIjoiQSIsInNpZGUiOjF9LCJyaWdodCI6eyJsZXR0ZXIiOiJCIiwic2lkZSI6Mn0sInRvcCI6eyJsZXR0ZXIiOiJDIiwic2lkZSI6MH19XV1dfX0sIm1vdmVzIjpbeyJwbGF5ZWRBdCI6MTIzNDU2Nzg5MC41LCJzY29yZSI6MjcsInR5cGUiOnsicGxheWVkV29yZCI6W3siaW5kZXgiOnsieCI6MiwieSI6MiwieiI6Mn0sInNpZGUiOjB9LHsiaW5kZXgiOnsieCI6MiwieSI6MiwieiI6Mn0sInNpZGUiOjF9LHsiaW5kZXgiOnsieCI6MiwieSI6MiwieiI6Mn0sInNpZGUiOjJ9XX19XX0tLS0tU0VDUkVUX0RFQURCRUVGLS0tLTEyMzQ1Njc4OTA=
 
@@ -120,7 +122,7 @@ class LeaderboardMiddlewareTests: XCTestCase {
       X-Frame-Options: SAMEORIGIN
       X-Permitte
```

---

### Incident Patch 2: `e385f3fb` (2023-11-16)
**Commit Message**: Fix problems with archive by making certain reducers public. (#192)

**File**: `Sources/GameCore/Drawer.swift` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 import ActiveGamesFeature
 import ComposableArchitecture
 
-struct ActiveGamesTray: Reducer {
+public struct ActiveGamesTray: Reducer {
   @Dependency(\.fileClient) var fileClient
   @Dependency(\.gameCenter) var gameCenter
   @Dependency(\.mainRunLoop.now.date) var now
 
-  var body: some ReducerOf<Game> {
+  public var body: some ReducerOf<Game> {
     Reduce { state, action in
       switch action {
       case .cancelButtonTapped,
```

**File**: `Sources/GameCore/GameOver.swift` (modified, +2/-2)
```diff
@@ -2,10 +2,10 @@ import ComposableArchitecture
 import GameOverFeature
 import SharedModels
 
-struct GameOverLogic: Reducer {
+public struct GameOverLogic: Reducer {
   @Dependency(\.database.saveGame) var saveGame
 
-  var body: some ReducerOf<Game> {
+  public var body: some ReducerOf<Game> {
     Reduce { state, action in
       var allCubesRemoved: Bool {
         state.cubes.allSatisfy {
```

**File**: `Sources/GameCore/SoundsCore.swift` (modified, +3/-3)
```diff
@@ -4,11 +4,11 @@ import SelectionSoundsCore
 
 extension Reducer<Game.State, Game.Action> {
   func sounds() -> some Reducer<Game.State, Game.Action> {
-    GameSounds(base: self)
+    _GameSounds(base: self)
   }
 }
 
-private struct GameSounds<Base: Reducer<Game.State, Game.Action>>: Reducer {
+public struct _GameSounds<Base: Reducer<Game.State, Game.Action>>: Reducer {
   @Dependency(\.audioPlayer) var audioPlayer
   @Dependency(\.date) var date
   @Dependency(\.dictionary.contains) var dictionaryContains
@@ -18,7 +18,7 @@ private struct GameSounds<Base: Reducer<Game.State, Game.Action>>: Reducer {
 
   enum CancelID { case cubeShaking }
 
-  var body: some Reducer<Game.State, Game.Action> {
+  public var body: some Reducer<Game.State, Game.Action> {
     self.core
       .onChange(of: { /Game.Destination.State.gameOver ~= $0.destination }) { _, _ in
         Reduce { _, _ in
```

**File**: `Sources/GameCore/TurnBased.swift` (modified, +2/-2)
```diff
@@ -4,14 +4,14 @@ import Foundation
 import GameOverFeature
 import SharedModels
 
-struct TurnBasedLogic: Reducer {
+public struct TurnBasedLogic: Reducer {
   @Dependency(\.apiClient) var apiClient
   @Dependency(\.feedbackGenerator) var feedbackGenerator
   @Dependency(\.gameCenter) var gameCenter
   @Dependency(\.mainRunLoop.now.date) var now
   @Dependency(\.database.saveGame) var saveGame
 
-  var body: some ReducerOf<Game> {
+  public var body: some ReducerOf<Game> {
     Reduce { state, action in
       guard let turnBasedContext = state.turnBasedContext
       else { return .none }
```

**File**: `Sources/TcaHelpers/FilterReducer.swift` (modified, +2/-3)
```diff
@@ -5,12 +5,11 @@ extension Reducer {
   public func filter(
     _ predicate: @escaping (State, Action) -> Bool
   ) -> some ReducerOf<Self> {
-    FilterReducer(base: self, predicate: predicate)
+    _FilterReducer(base: self, predicate: predicate)
   }
 }
 
-@usableFromInline
-struct FilterReducer<Base: Reducer>: Reducer {
+public struct _FilterReducer<Base: Reducer>: Reducer {
   @usableFromInline
   let base: Base
 
```

---

### Incident Patch 3: `4628db56` (2023-09-01)
**Commit Message**: Fixes a bug where overriding a UserDefaults key would not fall back to the default/previous implementation when the value for a different key is requested (#187)

**File**: `Sources/UserDefaultsClient/TestKey.swift` (modified, +4/-4)
```diff
@@ -32,18 +32,18 @@ extension UserDefaultsClient {
   )
 
   public mutating func override(bool: Bool, forKey key: String) {
-    self.boolForKey = { [self] in $0 == key ? bool : self.boolForKey(key) }
+    self.boolForKey = { [self] in $0 == key ? bool : self.boolForKey($0) }
   }
 
   public mutating func override(data: Data, forKey key: String) {
-    self.dataForKey = { [self] in $0 == key ? data : self.dataForKey(key) }
+    self.dataForKey = { [self] in $0 == key ? data : self.dataForKey($0) }
   }
 
   public mutating func override(double: Double, forKey key: String) {
-    self.doubleForKey = { [self] in $0 == key ? double : self.doubleForKey(key) }
+    self.doubleForKey = { [self] in $0 == key ? double : self.doubleForKey($0) }
   }
 
   public mutating func override(integer: Int, forKey key: String) {
-    self.integerForKey = { [self] in $0 == key ? integer : self.integerForKey(key) }
+    self.integerForKey = { [self] in $0 == key ? integer : self.integerForKey($0) }
   }
 }
```

---

### Incident Patch 4: `ed59ba88` (2023-08-23)
**Commit Message**: User notification client fixes (#174)

* fixed delegate deallocating

* assign UNUserNotificationCenter delegate before app finishes launching.

---------

Co-authored-by: Stephen Celis <[REDACTED_EMAIL]>

**File**: `Sources/AppFeature/AppDelegate.swift` (modified, +2/-1)
```diff
@@ -30,10 +30,11 @@ public struct AppDelegateReducer: Reducer {
     Reduce { state, action in
       switch action {
       case .didFinishLaunching:
+        let userNotificationsEventStream = self.userNotifications.delegate()
         return .run { send in
           await withThrowingTaskGroup(of: Void.self) { group in
             group.addTask {
-              for await event in self.userNotifications.delegate() {
+              for await event in userNotificationsEventStream {
                 await send(.userNotifications(event))
               }
             }
```

**File**: `Sources/ComposableUserNotifications/LiveKey.swift` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@ extension UserNotificationClient: DependencyKey {
       AsyncStream { continuation in
         let delegate = Delegate(continuation: continuation)
         UNUserNotificationCenter.current().delegate = delegate
-        continuation.onTermination = { [delegate] _ in }
+        continuation.onTermination = { _ in
+          _ = delegate
+        }
       }
     },
     getNotificationSettings: {
```

---

### Incident Patch 5: `b2059f45` (2023-08-23)
**Commit Message**: Delete (unused) SwiftUIHelpers/Binding.swift (#156)

Co-authored-by: Stephen Celis <[REDACTED_EMAIL]>

**File**: `Sources/SwiftUIHelpers/Binding.swift` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-import SwiftUI
-
-extension Binding where Value: Equatable {
-  // NB: Custom bindings can over-emit in certain situations, like sheet dismissal.
-  //     This helper can be used to avoid those over-emissions.
-  //     https://gist.github.com/stephencelis/09695c901d3ec9f443069ea8c41c4716
-  public func removeDuplicates(by predicate: @escaping (Value, Value) -> Bool) -> Self {
-    Binding(
-      get: { self.wrappedValue },
-      set: { if !predicate(self.wrappedValue, $0) { self.wrappedValue = $0 } }
-    )
-  }
-}
-
-extension Binding where Value: Equatable {
-  public func removeDuplicates() -> Self {
-    self.removeDuplicates(by: ==)
-  }
-}
```

---

### Incident Patch 6: `6cc83b90` (2023-08-23)
**Commit Message**: Delete (unused) TcaHelpers/EffectPrefix.swift (#157)



---

### Incident Patch 7: `5be0f72e` (2023-08-09)
**Commit Message**: Removed  `state:` to allow build to succeed. (#182)

**File**: `Sources/DemoFeature/Demo.swift` (modified, +2/-2)
```diff
@@ -160,7 +160,7 @@ public struct DemoView: View {
   public var body: some View {
     SwitchStore(self.store.scope(state: \.step, action: { $0 })) {
       CaseLet(
-        state: /Demo.State.Step.onboarding,
+        /Demo.State.Step.onboarding,
         action: Demo.Action.onboarding,
         then: {
           OnboardingView(store: $0)
@@ -169,7 +169,7 @@ public struct DemoView: View {
       )
 
       CaseLet(
-        state: /Demo.State.Step.game,
+        /Demo.State.Step.game,
         action: Demo.Action.game,
         then: { store in
           GameWrapper(
```

---

### Incident Patch 8: `5ef99f51` (2023-06-20)
**Commit Message**: Fix a bunch of deprecation warnings. (#181)

* Fix a bunch of deprecation warnings.

* wip

**File**: `Sources/AppFeature/AppView.swift` (modified, +3/-2)
```diff
@@ -342,7 +342,7 @@ public struct AppView: View {
 
   public init(store: StoreOf<AppReducer>) {
     self.store = store
-    self.viewStore = ViewStore(self.store.scope(state: ViewState.init))
+    self.viewStore = ViewStore(self.store.scope(state: ViewState.init, action: { $0 }))
   }
 
   public var body: some View {
@@ -368,7 +368,8 @@ public struct AppView: View {
                   )
                 )
               }
-            }
+            },
+            action: { $0 }
           ),
           then: { gameAndSettingsStore in
             GameFeatureView(
```

**File**: `Sources/ChangelogFeature/ChangelogView.swift` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ public struct ChangelogView: View {
   }
 
   public var body: some View {
-    WithViewStore(self.store.scope(state: ViewState.init)) { viewStore in
+    WithViewStore(self.store.scope(state: ViewState.init, action: { $0 })) { viewStore in
       ScrollView {
         VStack(alignment: .leading) {
           if viewStore.isUpdateButtonVisible {
```

**File**: `Sources/CubeCore/CubeNode.swift` (modified, +4/-3)
```diff
@@ -71,20 +71,21 @@ public class CubeNode: SCNNode {
     letterGeometry: SCNGeometry,
     store: Store<ViewState, Never>
   ) {
+    func absurd<A>(_: Never) -> A {}
     self.viewStore = ViewStore(store)
 
     self.index = self.viewStore.index
     self.leftPlaneNode = CubeFaceNode(
       letterGeometry: letterGeometry,
-      store: store.scope(state: \.left)
+      store: store.scope(state: \.left, action: absurd)
     )
     self.rightPlaneNode = CubeFaceNode(
       letterGeometry: letterGeometry,
-      store: store.scope(state: \.right)
+      store: store.scope(state: \.right, action: absurd)
     )
     self.topPlaneNode = CubeFaceNode(
       letterGeometry: letterGeometry,
-      store: store.scope(state: \.top)
+      store: store.scope(state: \.top, action: absurd)
     )
 
     super.init()
```

**File**: `Sources/CubeCore/CubeSceneView.swift` (modified, +1/-1)
```diff
@@ -146,8 +146,8 @@ public class CubeSceneView: SCNView, UIGestureRecognizerDelegate {
           let cube = CubeNode(
             letterGeometry: letterGeometry,
             store: store
+              .scope(state: \.cubes[index], action: { $0 })
               .actionless
-              .scope(state: \.cubes[index])
           )
           cube.scale = SCNVector3(x: 1 / 3, y: 1 / 3, z: 1 / 3)
           self.gameCubeNode.addChildNode(cube)
```

**File**: `Sources/CubePreview/CubePreviewView.swift` (modified, +8/-6)
```diff
@@ -69,7 +69,7 @@ public struct CubePreview: ReducerProtocol {
   public var body: some ReducerProtocol<State, Action> {
     BindingReducer()
     Reduce { state, action in
-      enum SelectionID {}
+      enum CancelID { case selection }
 
       switch action {
       case .binding:
@@ -90,7 +90,7 @@ public struct CubePreview: ReducerProtocol {
         case .removedCube:
           break
         }
-        return .cancel(id: SelectionID.self)
+        return .cancel(id: CancelID.selection)
 
       case .task:
         return .run { [move = state.moves[state.moveIndex]] send in
@@ -145,7 +145,7 @@ public struct CubePreview: ReducerProtocol {
             break
           }
         }
-        .cancellable(id: SelectionID.self)
+        .cancellable(id: CancelID.selection)
       }
     }
     .haptics(
@@ -185,7 +185,7 @@ public struct CubePreviewView: View {
 
   public init(store: StoreOf<CubePreview>) {
     self.store = store
-    self.viewStore = ViewStore(self.store.scope(state: ViewState.init(state:)))
+    self.viewStore = ViewStore(self.store.scope(state: ViewState.init(state:), action: { $0 }))
   }
 
   public var body: some View {
@@ -229,15 +229,17 @@ public struct CubePreviewView: View {
           ? nil
           : BloomBackground(
             size: proxy.size,
-            store: self.store.actionless
+            store: self.store
               .scope(
                 state: { _ in
                   BloomBackground.ViewState(
                     bloomCount: self.viewStore.selectedWordString.count,
                     word: self.viewStore.selectedWordString
                   )
-                }
+                },
+                action: { $0 }
               )
+              .actionless
           )
       )
     }
```

**File**: `Sources/DailyChallengeFeature/CalendarView.swift` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ struct CalendarView: View {
     store: StoreOf<DailyChallengeResults>
   ) {
     self.store = store
-    self.viewStore = ViewStore(store.scope(state: ViewState.init(state:)))
+    self.viewStore = ViewStore(store.scope(state: ViewState.init(state:), action: { $0 }))
   }
 
   var body: some View {
```

**File**: `Sources/DailyChallengeFeature/DailyChallengeResults.swift` (modified, +2/-2)
```diff
@@ -66,7 +66,7 @@ public struct DailyChallengeResults: ReducerProtocol {
           state.history = nil
         }
 
-        enum CancelID {}
+        enum CancelID { case fetch }
         return .task { [gameMode = state.leaderboardResults.gameMode] in
           await .fetchHistoryResponse(
             TaskResult {
@@ -77,7 +77,7 @@ public struct DailyChallengeResults: ReducerProtocol {
             }
           )
         }
-        .cancellable(id: CancelID.self, cancelInFlight: true)
+        .cancellable(id: CancelID.fetch, cancelInFlight: true)
       }
     }
   }
```

**File**: `Sources/DailyChallengeFeature/DailyChallengeView.swift` (modified, +2/-2)
```diff
@@ -294,7 +294,7 @@ public struct DailyChallengeView: View {
 
   public init(store: StoreOf<DailyChallengeReducer>) {
     self.store = store
-    self.viewStore = ViewStore(self.store.scope(state: ViewState.init))
+    self.viewStore = ViewStore(self.store.scope(state: ViewState.init, action: { $0 }))
   }
 
   public var body: some View {
@@ -390,7 +390,7 @@ public struct DailyChallengeView: View {
         .background(self.colorScheme == .dark ? Color.dailyChallenge : .isowordsBlack)
       }
       .task { await self.viewStore.send(.task).finish() }
-      .alert(self.store.scope(state: \.alert), dismiss: .dismissAlert)
+      .alert(self.store.scope(state: \.alert, action: { $0 }), dismiss: .dismissAlert)
       .navigationStyle(
         backgroundColor: self.colorScheme == .dark ? .isowordsBlack : .dailyChallenge,
         foregroundColor: self.colorScheme == .dark ? .dailyChallenge : .isowordsBlack,
```

---

### Incident Patch 9: `d36baac2` (2023-06-19)
**Commit Message**: Fix some tests.

**File**: `Sources/ClientModels/TurnBasedMatchData.swift` (modified, +10/-1)
```diff
@@ -57,8 +57,17 @@ extension Data {
   }
 
   static let matchDecoder = JSONDecoder()
-  static let matchEncoder = JSONEncoder()
+  static let matchEncoder: JSONEncoder = {
+    let encoder = JSONEncoder()
+    // TODO: Would be better to move this JSON decode to its own @Dependency.
+    @Dependency(\.context) var context
+    if context == .test {
+      encoder.outputFormatting = .sortedKeys
+    }
+    return encoder
+  }()
 }
+import Dependencies
 
 extension TurnBasedMatchData.Metadata {
   private enum CodingKeys: CaseIterable, CodingKey {
```

**File**: `Tests/AppFeatureTests/PersistenceTests.swift` (modified, +4/-1)
```diff
@@ -144,7 +144,10 @@ class PersistenceTests: XCTestCase {
     }
     try await saves.withValue {
       XCTAssertNoDifference(2, $0.count)
-      XCTAssertNoDifference($0.last, try JSONEncoder().encode(store.state.home.savedGames))
+      XCTAssertNoDifference(
+        try JSONDecoder().decode(SavedGamesState.self, from: $0.last!),
+        store.state.home.savedGames
+      )
     }
   }
 
```

**File**: `Tests/AppStoreSnapshotTests/__Snapshots__/AppStoreSnapshotTests/test_1_SoloGame.iPad_12_9.png` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 version https://git-lfs.github.com/spec/v1
-oid sha256:b4637ea56afe59031c08765ffa00d515068a578d8fc726be18ff5a055f5167cb
-size 5969035
+oid sha256:bcf0802f574db20ac6b2fec015d4e5d5be41cd738e28cc5ab7ea75edbdd227f5
+size 5965792
```

**File**: `Tests/AppStoreSnapshotTests/__Snapshots__/AppStoreSnapshotTests/test_1_SoloGame.iPhone_5_5.png` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 version https://git-lfs.github.com/spec/v1
-oid sha256:cb71d8ce9e02dcb9edb1aafe1bd992857b67b40e47e0acc96a742323d9d2b1d8
-size 1462253
+oid sha256:f67191c084e779e391775e954a2b1364f50b45e6471d2b076a03c22660077bd3
+size 1464480
```

**File**: `Tests/AppStoreSnapshotTests/__Snapshots__/AppStoreSnapshotTests/test_1_SoloGame.iPhone_6_5.png` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 version https://git-lfs.github.com/spec/v1
-oid sha256:cbcf66d153b1fa2af18dcff4066855b6efd1af9b8e7ded1eee192958384c26a2
-size 1934200
+oid sha256:dc7dff2a29e9b17bf06fa70f9c3b0d6c39bc2fc3935a8b55ef4598ed56bc9418
+size 1928105
```

**File**: `Tests/AppStoreSnapshotTests/__Snapshots__/AppStoreSnapshotTests/test_2_TurnBasedGame.iPad_12_9.png` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 version https://git-lfs.github.com/spec/v1
-oid sha256:32d18630b7e9b5a84b78f7ce6ec297aee5e90b69dec5a92d680658d4516a83a2
-size 1368192
+oid sha256:a620242fb9262fe9042ed1502f09ae307fd4b9b5a67446e81b100bf214253447
+size 1384313
```

**File**: `Tests/AppStoreSnapshotTests/__Snapshots__/AppStoreSnapshotTests/test_2_TurnBasedGame.iPhone_5_5.png` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 version https://git-lfs.github.com/spec/v1
-oid sha256:eb494e24eb966f3bd7c7609363626de2da0496775f989fc8db6b2ca49442f19b
-size 498779
+oid sha256:1e5fbfd55f057706725dc3676bf24ba85bda81328689593c25ead525dad2991a
+size 499980
```

**File**: `Tests/AppStoreSnapshotTests/__Snapshots__/AppStoreSnapshotTests/test_2_TurnBasedGame.iPhone_6_5.png` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 version https://git-lfs.github.com/spec/v1
-oid sha256:eb59cf978a7c53623b245e0bae13729e74809ea84dfab1367a4979e60df845f2
-size 545825
+oid sha256:851e8cee49a32a9d427bf2be5d6a45d0236c1130d976bfdc2b5b6f9de4f6c032
+size 551038
```

---

### Incident Patch 10: `419d695e` (2023-01-04)
**Commit Message**: Fix live dependency for UIApplicationClient.

**File**: `Sources/UIApplicationClient/LiveKey.swift` (modified, +3/-2)
```diff
@@ -1,8 +1,9 @@
+import Dependencies
 import UIKit
 
 @available(iOSApplicationExtension, unavailable)
-extension UIApplicationClient {
-  public static let live = Self(
+extension UIApplicationClient: DependencyKey {
+  public static let liveValue = Self(
     alternateIconName: { UIApplication.shared.alternateIconName },
     alternateIconNameAsync: { await UIApplication.shared.alternateIconName },
     open: { @MainActor in await UIApplication.shared.open($0, options: $1) },
```

---

### Incident Patch 11: `12b283e3` (2023-01-04)
**Commit Message**: Merge branch 'fix-settings'

**File**: `Sources/DailyChallengeFeature/DailyChallengeView.swift` (modified, +2/-2)
```diff
@@ -214,8 +214,8 @@ public struct DailyChallengeReducer: ReducerProtocol {
       }
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer().ifCaseLet(
-        /DestinationState.results,
+      Scope(
+        state: /DestinationState.results,
         action: /DestinationAction.dailyChallengeResults
       ) {
         DailyChallengeResults()
```

**File**: `Sources/DemoFeature/Demo.swift` (modified, +6/-7)
```diff
@@ -61,13 +61,12 @@ public struct Demo: ReducerProtocol {
 
   public var body: some ReducerProtocol<State, Action> {
     Scope(state: \.step, action: .self) {
-      EmptyReducer()
-        .ifCaseLet(
-          /State.Step.onboarding,
-          action: /Action.onboarding
-        ) {
-          Onboarding()
-        }
+      Scope(
+        state: /State.Step.onboarding,
+        action: /Action.onboarding
+      ) {
+        Onboarding()
+      }
     }
 
     IntegratedGame(
```

**File**: `Sources/HomeFeature/Home.swift` (modified, +25/-25)
```diff
@@ -344,36 +344,36 @@ public struct Home: ReducerProtocol {
       ChangelogReducer()
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer()
-        .ifCaseLet(
-          /DestinationState.dailyChallenge,
-          action: /DestinationAction.dailyChallenge
-        ) {
-          DailyChallengeReducer()
-        }
-        .ifCaseLet(
-          /DestinationState.leaderboard,
-          action: /DestinationAction.leaderboard
-        ) {
-          Leaderboard()
-        }
-        .ifCaseLet(
-          /DestinationState.multiplayer,
-          action: /DestinationAction.multiplayer
-        ) {
-          Multiplayer()
-        }
-        .ifCaseLet(
-          /DestinationState.solo,
-          action: /DestinationAction.solo
-        ) {
-          Solo()
-        }
+      Scope(
+        state: /DestinationState.dailyChallenge,
+        action: /DestinationAction.dailyChallenge
+      ) {
+        DailyChallengeReducer()
+      }
+      Scope(
+        state: /DestinationState.leaderboard,
+        action: /DestinationAction.leaderboard
+      ) {
+        Leaderboard()
+      }
+      Scope(
+        state: /DestinationState.multiplayer,
+        action: /DestinationAction.multiplayer
+      ) {
+        Multiplayer()
+      }
+      Scope(
+        state: /DestinationState.solo,
+        action: /DestinationAction.solo
+      ) {
+        Solo()
+      }
     }
 
     Scope(state: \.nagBanner, action: /Action.nagBannerFeature) {
       NagBannerFeature()
     }
+
     Scope(state: \.settings, action: /Action.settings) {
       Settings()
     }
```

**File**: `Sources/MultiplayerFeature/MultiplayerView.swift` (modified, +2/-2)
```diff
@@ -70,8 +70,8 @@ public struct Multiplayer: ReducerProtocol {
       }
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer().ifCaseLet(
-        /DestinationState.pastGames,
+      Scope(
+        state: /DestinationState.pastGames,
         action: /DestinationAction.pastGames
       ) {
         PastGames()
```

**File**: `Sources/StatsFeature/StatsFeature.swift` (modified, +2/-2)
```diff
@@ -120,8 +120,8 @@ public struct Stats: ReducerProtocol {
       }
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer().ifCaseLet(
-        /DestinationState.vocab,
+      Scope(
+        state: /DestinationState.vocab,
         action: /DestinationAction.vocab
       ) {
         Vocab()
```

---

### Incident Patch 12: `50fbf2a1` (2023-01-03)
**Commit Message**: Fixes

**File**: `App/isowords.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +24/-6)
```diff
@@ -78,8 +78,17 @@
         "repositoryURL": "https://github.com/pointfreeco/swift-case-paths",
         "state": {
           "branch": null,
-          "revision": "7346701ea29da0a85d4403cf3d7a589a58ae3dee",
-          "version": "0.9.2"
+          "revision": "bb436421f57269fbcfe7360735985321585a86e5",
+          "version": "0.10.1"
+        }
+      },
+      {
+        "package": "swift-clocks",
+        "repositoryURL": "https://github.com/pointfreeco/swift-clocks",
+        "state": {
+          "branch": null,
+          "revision": "692ec4f5429a667bdd968c7260dfa2b23adfeffc",
+          "version": "0.1.4"
         }
       },
       {
@@ -114,8 +123,8 @@
         "repositoryURL": "https://github.com/pointfreeco/swift-custom-dump",
         "state": {
           "branch": null,
-          "revision": "c9b6b940d95c0a925c63f6858943415714d8a981",
-          "version": "0.5.2"
+          "revision": "819d9d370cd721c9d87671e29d947279292e4541",
+          "version": "0.6.0"
         }
       },
       {
@@ -271,13 +280,22 @@
           "version": "1.2.1"
         }
       },
+      {
+        "package": "swiftui-navigation",
+        "repositoryURL": "https://github.com/pointfreeco/swiftui-navigation",
+        "state": {
+          "branch": null,
+          "revision": "46acf5ecc1cabdb28d7fe03289f6c8b13a023f52",
+          "version": "0.4.5"
+        }
+      },
       {
         "package": "xctest-dynamic-overlay",
         "repositoryURL": "https://github.com/pointfreeco/xctest-dynamic-overlay",
         "state": {
           "branch": null,
-          "revision": "30314f1ece684dd60679d598a9b89107557b67d9",
-          "version": "0.4.1"
+          "revision": "16e6409ee82e1b81390bdffbf217b9c08ab32784",
+          "version": "0.5.0"
         }
       }
     ]
```

**File**: `Sources/HomeFeature/Home.swift` (modified, +3/-0)
```diff
@@ -374,6 +374,9 @@ public struct Home: ReducerProtocol {
     Scope(state: \.nagBanner, action: /Action.nagBannerFeature) {
       NagBannerFeature()
     }
+    Scope(state: \.settings, action: /Action.settings) {
+      Settings()
+    }
   }
 
   private func authenticate(send: Send<Action>) async {
```

**File**: `Sources/OnboardingFeature/OnboardingView.swift` (modified, +3/-2)
```diff
@@ -179,7 +179,7 @@ public struct Onboarding: ReducerProtocol {
 
         return .fireAndForget {
           await self.audioPlayer.play(.uiSfxTap)
-          await Task.cancel(id: DelayedNextStepID.self)
+          Task.cancel(id: DelayedNextStepID.self)
         }
 
       case .delayedNextStep:
@@ -190,7 +190,7 @@ public struct Onboarding: ReducerProtocol {
         return .fireAndForget {
           await self.userDefaults.setHasShownFirstLaunchOnboarding(true)
           await self.audioPlayer.stop(.onboardingBgMusic)
-          await Task.cancel(id: DelayedNextStepID.self)
+          Task.cancel(id: DelayedNextStepID.self)
         }
 
       case .game where state.step.isCongratsStep:
@@ -346,6 +346,7 @@ public struct Onboarding: ReducerProtocol {
           try await self.mainQueue.sleep(for: .seconds(2))
           return .delayedNextStep
         }
+        .animation()
       }
     }
   }
```

---

### Incident Patch 13: `d08b9b10` (2022-12-10)
**Commit Message**: Revert "Put back in first position"

This reverts commit 63559ac022a75c14d76cfccd51a7c9a988d63ad4.

**File**: `Sources/HomeFeature/Home.swift` (modified, +4/-3)
```diff
@@ -159,9 +159,6 @@ public struct Home: ReducerProtocol {
   public init() {}
 
   public var body: some ReducerProtocol<State, Action> {
-    Scope(state: \.settings, action: /Action.settings) {
-      Settings()
-    }
     Reduce { state, action in
       switch action {
       case let .activeMatchesResponse(.success(response)):
@@ -376,6 +373,10 @@ public struct Home: ReducerProtocol {
     Scope(state: \.nagBanner, action: /Action.nagBannerFeature) {
       NagBannerFeature()
     }
+    
+    Scope(state: \.settings, action: /Action.settings) {
+      Settings()
+    }
   }
 
   private func authenticate(send: Send<Action>) async {
```

---

### Incident Patch 14: `71fb3092` (2022-12-10)
**Commit Message**: Fix `Settings` from `Home`

**File**: `Sources/DailyChallengeFeature/DailyChallengeView.swift` (modified, +2/-2)
```diff
@@ -214,8 +214,8 @@ public struct DailyChallengeReducer: ReducerProtocol {
       }
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer().ifCaseLet(
-        /DestinationState.results,
+      Scope(
+        state: /DestinationState.results,
         action: /DestinationAction.dailyChallengeResults
       ) {
         DailyChallengeResults()
```

**File**: `Sources/DemoFeature/Demo.swift` (modified, +6/-7)
```diff
@@ -61,13 +61,12 @@ public struct Demo: ReducerProtocol {
 
   public var body: some ReducerProtocol<State, Action> {
     Scope(state: \.step, action: .self) {
-      EmptyReducer()
-        .ifCaseLet(
-          /State.Step.onboarding,
-          action: /Action.onboarding
-        ) {
-          Onboarding()
-        }
+      Scope(
+        state: /State.Step.onboarding,
+        action: /Action.onboarding
+      ) {
+        Onboarding()
+      }
     }
 
     IntegratedGame(
```

**File**: `Sources/HomeFeature/Home.swift` (modified, +28/-25)
```diff
@@ -344,36 +344,39 @@ public struct Home: ReducerProtocol {
       ChangelogReducer()
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer()
-        .ifCaseLet(
-          /DestinationState.dailyChallenge,
-          action: /DestinationAction.dailyChallenge
-        ) {
-          DailyChallengeReducer()
-        }
-        .ifCaseLet(
-          /DestinationState.leaderboard,
-          action: /DestinationAction.leaderboard
-        ) {
-          Leaderboard()
-        }
-        .ifCaseLet(
-          /DestinationState.multiplayer,
-          action: /DestinationAction.multiplayer
-        ) {
-          Multiplayer()
-        }
-        .ifCaseLet(
-          /DestinationState.solo,
-          action: /DestinationAction.solo
-        ) {
-          Solo()
-        }
+      Scope(
+        state: /DestinationState.dailyChallenge,
+        action: /DestinationAction.dailyChallenge
+      ) {
+        DailyChallengeReducer()
+      }
+      Scope(
+        state: /DestinationState.leaderboard,
+        action: /DestinationAction.leaderboard
+      ) {
+        Leaderboard()
+      }
+      Scope(
+        state: /DestinationState.multiplayer,
+        action: /DestinationAction.multiplayer
+      ) {
+        Multiplayer()
+      }
+      Scope(
+        state: /DestinationState.solo,
+        action: /DestinationAction.solo
+      ) {
+        Solo()
+      }
     }
 
     Scope(state: \.nagBanner, action: /Action.nagBannerFeature) {
       NagBannerFeature()
     }
+    
+    Scope(state: \.settings, action: /Action.settings) {
+      Settings()
+    }
   }
 
   private func authenticate(send: Send<Action>) async {
```

**File**: `Sources/MultiplayerFeature/MultiplayerView.swift` (modified, +2/-2)
```diff
@@ -70,8 +70,8 @@ public struct Multiplayer: ReducerProtocol {
       }
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer().ifCaseLet(
-        /DestinationState.pastGames,
+      Scope(
+        state: /DestinationState.pastGames,
         action: /DestinationAction.pastGames
       ) {
         PastGames()
```

**File**: `Sources/StatsFeature/StatsFeature.swift` (modified, +2/-2)
```diff
@@ -120,8 +120,8 @@ public struct Stats: ReducerProtocol {
       }
     }
     .ifLet(\.destination, action: /Action.destination) {
-      EmptyReducer().ifCaseLet(
-        /DestinationState.vocab,
+      Scope(
+        state: /DestinationState.vocab,
         action: /DestinationAction.vocab
       ) {
         Vocab()
```

---

### Incident Patch 15: `2c3e68ca` (2022-10-13)
**Commit Message**: Fix format

**File**: `.github/workflows/format.yml` (modified, +3/-3)
```diff
@@ -10,13 +10,13 @@ jobs:
     name: swift-format
     runs-on: macOS-12
     steps:
-      - uses: actions/checkout@v2
+      - uses: actions/checkout@v3
       - name: Xcode Select
-        run: sudo xcode-select -s /Applications/Xcode_13.4.1.app
+        run: sudo xcode-select -s /Applications/Xcode_14.0.1.app
       - name: Tap
         run: brew tap pointfreeco/formulae
       - name: Install
-        run: brew install Formulae/swift-format@5.6
+        run: brew install Formulae/swift-format@5.7
       - name: Format
         run: make format
       - uses: stefanzweifel/git-auto-commit-action@v4
```

#### Recent Merged Pull Requests:
- **PR #213** (closed): Fix Twitter URL consistency in README (@claudeaceae)
- **PR #212** (closed): Fix PostgreSQL version consistency in Makefile (@claudeaceae)
- **PR #205** (2024-08-16): Start using IssueReporting. (@mbrandonw)
- **PR #204** (2024-07-04): Add `.editorconfig` for consistent code formatting (@Matejkob)
- **PR #201** (closed): Revert inline snapshots (@stephencelis)
- **PR #200** (2024-04-09): Observation (@stephencelis)
- **PR #199** (2024-01-25): Fix GitHub CI (@stephencelis)
- **PR #198** (2024-01-25): Remove `firstLaunchOnboarding` (@imjn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
