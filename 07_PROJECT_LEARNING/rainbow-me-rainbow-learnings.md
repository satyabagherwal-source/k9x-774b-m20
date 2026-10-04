> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rainbow-me-rainbow-learnings.md`  
> **Source**: GitHub ([https://github.com/rainbow-me/rainbow](https://github.com/rainbow-me/rainbow))  
> **License**: GPL-3.0  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-10-04T20:17:07.830Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rainbow-me/rainbow

---

## 1. Executive Forensic Architecture & System Mechanics

The `rainbow-me/rainbow` repository is a high-performance, multi-chain Ethereum wallet built on React Native. Architecturally, it bridges the deterministic, low-latency requirements of decentralized finance (DeFi) with the asynchronous, native-heavy environment of mobile operating systems (iOS and Android). 

```
                                  [ React Native JS Thread ]
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
             [ Zustand Stores ]       [ React Query ]         [ Reanimated Worklets ]
                     │                        │                        │
                     ▼                        ▼                        ▼
             [ State Management ]     [ Network Boundary ]    [ Skia / UI Thread ]
                     │                        │                        │
  ───────────────────┼────────────────────────┼────────────────────────┼───────────────────
                     │ (Bridge / JSI)         │ (HTTP / JSON)          │ (Native UI)
                     ▼                        ▼                        ▼
             [ Passkey Module ]       [ Ramp / Node APIs ]    [ RCTView / UIKit ]
                     │                        │                        │
                     ▼                        ▼                        ▼
             [ iOS Secure Enclave ]   [ Blockchain Nodes ]    [ Core Animation ]
                                  [ Native OS / Hardware ]
```

### Subsystem Boundaries & Decoupling
The codebase enforces strict boundaries between first-party application logic, third-party integrations, and vendored code. 
*   **The Vendor Boundary (`src/vendor`)**: Vendored libraries (e.g., `ens-avatar`) are isolated from the application. They are treated as static, diffable forks. Imports from the application into `src/vendor` are strictly prohibited by static analysis rules (`dependency-cruiser`) to prevent coupling that would break upstream synchronization.
*   **The State Ownership Model**: State is divided into transient UI state (managed via React Native Reanimated Shared Values), persistent application state (managed via Zustand with custom storage persisters), and server-synchronized state (managed via React Query).

### Critical Subsystem Abstractions
1.  **The Cash Subsystem**: Orchestrates fiat-to-crypto onboarding. It abstracts phone verification, KYC (Know Your Customer) processing, and card/wallet linking. It relies on passkey-based authentication to secure sessions.
2.  **The Swaps Subsystem**: Manages token discovery, quote aggregation, and transaction execution. It abstracts gas estimation by separating the *maximum transaction fee cap* (used for balance and affordability checks) from the *estimated gas fee* (used for user-facing display).
3.  **The Native Bridge Layer**: Custom patches applied directly to React Native (`react-native+0.81.6.patch`), `react-native-passkeys`, and `react-native-animateable-text` to resolve deep rendering, layout, and threading discrepancies between the JavaScript runtime and native platform APIs.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Controlled Input Cursor Shifts & Text Rewriting (BUG-CASH-01)
*   **Context**: Controlled text inputs within the Cash onboarding flow (`src/features/cash/components/useSetupInputTextStyle.ts`).
*   **What Was Expected**: Users typing phone numbers should experience smooth, real-time formatting (e.g., `(123) 456-7890`) without cursor jumps or character misplacement.
*   **What Actually Happened**: In React Native 0.81.6 on iOS, typing an extra digit after a fully formatted number caused the input to rewrite the text erratically (e.g., changing `(123) 456-7890` to `2345678905`). The cursor shifted unpredictably, misplacing newly typed characters.
*   **Evidence in Repo**: Commit `9d718934`, `src/features/cash/components/useSetupInputTextStyle.ts`.
*   **Root Cause**: React Native's `RCTBaseTextInputView` compares the incoming JavaScript controlled text with the native iOS text using `[newText isEqualToAttributedString:oldText]`. Under React Native 0.81.6, this check fails to account for UIKit's default paragraph style. Because of this style discrepancy, the equality check evaluated to `false` even when the text content was identical. This forced React Native to rewrite the unchanged text, resetting the cursor position and causing input jank.
*   **Remediation Code Diff**:
```typescript
// src/features/cash/components/useSetupInputTextStyle.ts
export function useSetupInputTextStyle(): TextStyle {
  return {
    letterSpacing: 0.37,
    paddingLeft: 14,
    paddingRight: 16,
+   textAlign: 'left', // Explicitly setting alignment corrects UIKit's internal paragraph style discrepancy
    ...(Platform.OS === 'android' ? ... : {})
  };
}
```
*   **Lesson**: Controlled inputs in React Native must explicitly define text alignment properties (`textAlign`) to prevent native text-comparison checks from failing due to default OS paragraph style mismatches.

---

### Incident 2: Stuck Passkey Sign-ins & Native Context Leaks (BUG-AUTH-02)
*   **Context**: Passkey-based authentication service (`src/features/cash/services/cashSignInService.ts`).
*   **What Was Expected**: If a passkey assertion request failed or timed out, the application should reject the promise, release native resources, and allow the user to retry the ceremony.
*   **What Actually Happened**: When the native iOS passkey authorization controller hung or was left open indefinitely by the OS, the JavaScript promise remained unresolved. Subsequent sign-in attempts joined the same unresolved promise, locking the user out of the application.
*   **Evidence in Repo**: Commit `f4c82d93`, `src/features/cash/services/cashSignInService.ts`, and `patches/react-native-passkeys+0.4.1.patch`.
*   **Root Cause**: The underlying `react-native-passkeys` library lacked a cancellation mechanism and did not assign unique identifiers to native callbacks. If a JS-side timeout occurred, the native iOS authorization controller remained active in memory. A late callback from this abandoned controller could resolve or reject a *new* JS-side request, corrupting the authentication state.
*   **Remediation Code Diff**:
```typescript
// src/features/cash/services/cashSignInService.ts
- const credentialAssertionJson = await getPasskeyAssertion(start.publicKeyOptionsJson);
+ const credentialAssertionJson = await withTimeout(
+   getPasskeyAssertion(start.publicKeyOptionsJson),
+   PASSKEY_ASSERTION_TIMEOUT,
+   PASSKEY_ASSERTION_TIMEOUT_MESSAGE
+ );
...
  } catch (error) {
+   const isPasskeyAssertionTimeout = error instanceof Error && error.message === PASSKEY_ASSERTION_TIMEOUT_MESSAGE;
+   if (isPasskeyAssertionTimeout) {
+     await cancelPasskeyRequest().catch(() => undefined); // Releases the native slot
+   }
```
*   **Lesson**: Native modal ceremonies (Passkeys, Biometrics) must be bounded by strict JavaScript-side timeouts that explicitly trigger native cancellation routines to release hardware-retained contexts.

---

### Incident 3: Silent Logger Failures & Transport Starvation (BUG-LOG-03)
*   **Context**: Application-wide logging utility (`src/logger/index.ts`).
*   **What Was Expected**: The logger should execute all registered transports (e.g., console, Sentry, local file) sequentially for every log event.
*   **What Actually Happened**: If a single log transport threw an error (e.g., due to network loss or rate-limiting), all subsequent transports in the execution chain were skipped. This silenced critical console logs and telemetry, and allowed the transport exception to escape, crashing the calling function.
*   **Evidence in Repo**: Commit `29a5278e`, `src/logger/index.ts`.
*   **Root Cause**: The logger iterated over its transport array and executed each callback synchronously without error isolation. An unhandled exception in any transport aborted the loop.
*   **Remediation Code Diff**:
```typescript
// src/logger/index.ts
    const resolvedMetadata = metadata || EMPTY_METADATA;
    for (const transport of this.transports) {
-     transport(level, message, resolvedMetadata);
+     try {
+       transport(level, message, resolvedMetadata);
+     } catch (e) {
+       // Prevent transport failures from crashing the application or silencing other transports
+       console.error('[logger]: transport threw', e);
+     }
    }
```
*   **Lesson**: Telemetry and logging pipelines must isolate transport executions within individual try-catch blocks to guarantee that a failure in one reporting channel does not silence others or crash the host application.

---

### Incident 4: Post-Unmount Reanimated Timer Resurrection (BUG-UI-04)
*   **Context**: Shared-value animation timer hook (`src/hooks/reanimated/useAnimatedTime.ts`).
*   **What Was Expected**: When a component using `useAnimatedTime` unmounted, all associated Reanimated animations and callbacks should terminate permanently.
*   **What Actually Happened**: In React Strict Mode or during rapid screen transitions, unmounted timers revived. The Reanimated UI thread continued executing the `onEndWorklet` and `onStartWorklet` callbacks, writing to unmounted state stores and causing memory leaks and crashes.
*   **Evidence in Repo**: Commit `8599568c`, `src/hooks/reanimated/useAnimatedTime.ts`.
*   **Root Cause**: Reanimated's `useSharedValue` does not automatically cancel active animations on unmount if they are wrapped in complex sequences or repeat blocks. When the component unmounted, the JS thread cleared its references, but the UI thread's animation loop remained active, eventually firing callbacks back to the JS thread.
*   **Remediation Code Diff**:
```typescript
// src/hooks/reanimated/useAnimatedTime.ts
export function useAnimatedTime({ ... }: TimerConfig = {}): TimerResult {
+ const isDisposed = useSharedValue(false);
  const pausedAt = useSharedValue(0);
  const timeInSeconds = useSharedValue(0);

  const start = useCallback(() => {
    'worklet';
+   if (isDisposed.value) return;
    if (onStartWorklet) onStartWorklet(timeInSeconds);

    const repeatingTimer = withRepeat(
      withTiming(durationMs / 1000, { duration: durationMs, easing: Easing.linear }, finished => {
-       if (finished && onEndWorklet) {
-         onEndWorklet();
-       }
+       if (!finished || isDisposed.value) return;
+       if (onEndWorklet) onEndWorklet();
      }),
      ...
    );
  }, [...]);

  useEffect(() => {
+   let isCurrentEffect = true;
+   isDisposed.value = false;
    if (autoStart) {
-     start();
+     queueMicrotask(() => {
+       if (isCurrentEffect) runOnUI(start)();
+     });
    }
+   return () => {
+     isCurrentEffect = false;
+     isDisposed.value = true;
+   };
  }, []);
```
*   **Lesson**: Reanimated worklets that trigger JavaScript callbacks must check a shared disposal flag (`isDisposed`) on the UI thread before executing to prevent post-unmount execution.

---

### Incident 5: Ambiguous Write Failures & Double-Spend Risks (BUG-CASH-05)
*   **Context**: On-ramp order creation client (`src/features/cash/services/rampClient.ts`).
*   **What Was Expected**: The client should only retry order creation if the previous attempt was definitively rejected by the server (e.g., validation error). If the failure was ambiguous, it should reuse the existing order ID to prevent duplicate charges.
*   **What Actually Happened**: The client treated HTTP `408` (Request Timeout) and `429` (Too Many Requests) as definitive rejections. When retrying, it generated a new order ID, which led to duplicate buy orders and multiple credit card charges for a single user transaction.
*   **Evidence in Repo**: Commit `c06c7664`, `src/features/cash/services/rampClient.ts`.
*   **Root Cause**: The helper function `isDefinitiveRejection` assumed that any HTTP status code in the `4xx` range (except `404`) meant the request took no effect on the server. However, `408` and `429` are transient; the server may have already processed the write before returning these statuses.
*   **Remediation Code Diff**:
```typescript
// src/features/cash/services/rampClient.ts
/** The backend answered and refused, so the request definitively took no effect. Timeouts, rate limits, transport failures, and 5xx stay ambiguous. */
export function isDefinitiveRejection(error: unknown): boolean {
  const status = error instanceof RainbowFetchError ? error.response?.status : undefined;
- return status !== undefined && status >= 400 && status < 500;
+ return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
}
```
*   **Lesson**: HTTP `408` and `429` must be treated as *ambiguous* write failures. Systems must preserve and replay the original idempotent request identifier rather than generating a new one.

---

### Incident 6: Malformed Ramp Responses & State Corruption (BUG-CASH-06)
*   **Context**: On-ramp order polling and response normalization (`src/features/cash/services/rampClient.ts`).
*   **What Was Expected**: A single malformed card or order in a list response should not crash the entire UI list view or corrupt the transaction history.
*   **What Actually Happened**: The application parsed raw HTTP responses directly into persistent state. If the backend returned a single order with a missing `transactionHash` or an unexpected status string, the entire parsing step failed, rendering the user's transaction history blank.
*   **Evidence in Repo**: Commit `5a34b1e6`, `src/features/cash/services/rampClient.ts`.
*   **Root Cause**: Lack of runtime validation and schema-based normalization at the network boundary. The application assumed the backend would always adhere strictly to the TypeScript interface.
*   **Remediation Code Diff**:
```typescript
// src/features/cash/services/rampClient.ts
+ import { z } from 'zod';
+
+ /** A value the client cannot use degrades to `undefined`, so a readable status is never lost to a field the order can do without. */
+ const lenient = <S extends z.ZodTypeAny>(source: string, schema: S) =>
+   schema.optional().catch(ctx => {
+     reportRampContractViolation(source, toRampContractIssues(ctx.error.issues));
+     return undefined;
+   });
+
+ const buyOrderSchema = z.discriminatedUnion('status', [
+   z.object({ status: z.literal(OrderStatus.Pending) }),
+   z.object({ status: z.literal(OrderStatus.Processing) }),
+   z.object({
+     status: z.literal(OrderStatus.Completed),
+     completedTime: lenient('getOrder', epochMsSchema),
+     createdTime: lenient('getOrder', epochMsSchema),
+     cryptoAmount: lenient(
+       'getOrder',
+       z.object({
+         amount: z.string().refine(value => greaterThan(value, 0)),
+         asset: z.object({ asset: z.literal(RampCryptoAsset.USDC), network: cashRampNetworkSchema })
+                .transform(({ network }) => ({ network })),
+       })
+     ),
+     fiatAmount: lenient('getOrder', z.object({ amount: z.string(), currency: z.string() })),
+     transactionHash: lenient('getOrder', z.string()),
+     walletAddress: lenient('getOrder', z.string()),
+   }),
+   z.object({
+     status: z.literal(OrderStatus.Failed),
+     failureReason: z.nativeEnum(OrderFailureReason).catch(OrderFailureReason.Unspecified),
+   }),
+ ]);
```
*   **Lesson**: External API payloads must be validated at the network boundary using schemas that degrade malformed fields gracefully (`lenient` parsing) instead of failing the entire payload.

---

## 3. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
*   **Case-Insensitive Hash Comparisons**: Transaction hashes on EVM networks are hex strings. Network providers and APIs return them with varying casing (e.g., `0xAbCd` vs `0xabcd`). Direct equality checks (`hashA === hashB`) fail, leading to duplicate activity entries.
    *   *Invariant*: All transaction hashes must be normalized to lowercase before storage, comparison, or deduplication.
    ```typescript
    // Invariant Enforcement
    const normalizedHash = rawHash.toLowerCase();
    ```
*   **Falsy Numeric Conversions**: In gas and fee calculations, empty strings, spaces, or `Infinity` values can bypass basic falsy checks (`if (!value)`), leading to `NaN` propagation in mathematical operations.
    *   *Invariant*: Use explicit numeric string validation worklets that run safely on both JS and UI threads.
    ```typescript
    // Safe Math Invariant
    export function isNumberStringWorklet(value: string | undefined): boolean {
      'worklet';
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      return trimmed !== '' && isFinite(Number(trimmed));
    }
    ```

### 2. Infinite Loop & Recursion Guards
*   **Reanimated UI-to-JS Thread Flooding**: Triggering synchronous state updates on the JS thread from a Reanimated UI thread listener (e.g., `useAnimatedReaction`) can cause infinite re-render loops if the JS state update subsequently alters the layout properties driving the animation.
    *   *Invariant*: Always decouple UI-thread animation values from JS-thread state updates using debounced callbacks or explicit user-interaction guards.
*   **Timer Resurrection Prevention**: When using Reanimated-driven timers, the animation loop must be bound to a shared disposal flag that is set synchronously during the React unmount phase.
    ```typescript
    // Invariant: The termination proof
    if (isDisposed.value) return;
    ```

### 3. UI & UX Micro-Mechanics
*   **Controlled Input Layout Alignment**: To prevent erratic cursor jumps in React Native controlled inputs on iOS, the text alignment must be explicitly declared. This ensures that UIKit's internal text-measuring engine matches the layout properties passed down by React Native's shadow thread.
    *   *Rule*: Every controlled text input must have an explicit `textAlign` property (e.g., `textAlign: 'left'`).
*   **Atomic Text and Frame Mounting**: When animating text content and layout dimensions simultaneously, the text shadow view must queue its updates in the same mounting batch as the layout frame. This prevents the text content and container width from updating in separate frames, which causes visible layout flickering.
    ```objc
    // Objective-C Invariant (JBTextShadowView.mm)
    - (void)layoutSubviewsWithContext:(RCTLayoutContext)layoutContext {
      [super layoutSubviewsWithContext:layoutContext];
      // Queue text in this batch so its glyphs and measured frame mount together
      [self uiManagerWillPerformMounting];
    }
    ```

### 4. Backend Concurrency & Memory Safety
*   **Idempotency Key Preservation**: When a write operation (e.g., creating an order) fails with an ambiguous status (such as a network timeout or rate limit), the client must retain and reuse the original request identifier. Generating a new identifier on retry violates idempotency and can cause duplicate transactions on the backend.
*   **Logger Transport Isolation**: A failure in a single logging transport must never propagate to the caller or prevent other transports from executing.
    ```typescript
    // Invariant: Safe transport execution
    this.transports.forEach(transport => {
      try { transport(level, message, meta); } catch (e) { console.error(e); }
    });
    ```

### 5. Defect & Error Prevention ("Galti Pakadna")
*   **Lenient Array Parsing**: When parsing lists of objects from external APIs, a single malformed item must not cause the entire parse operation to fail. The parser should log the validation error, discard or degrade the invalid item, and return the remaining valid items.
    ```typescript
    // Invariant: Lenient array parsing
    const validRowsSchema = <S extends z.ZodTypeAny>(schema: S) =>
      z.array(z.unknown()).transform(rows => {
        return rows.reduce((acc, row) => {
          const result = schema.safeParse(row);
          if (result.success) acc.push(result.data);
          return acc;
        }, [] as z.infer<S>[]);
      });
    ```

---

## 4. The 9 Deep Learning Dimensions

### 1. Architecture
The repository uses a unidirectional data flow where UI interactions trigger actions in Zustand stores or execute React Query mutations. 

```
┌────────────────────────────────────────────────────────┐
│                       UI Layer                         │
│  (React Components / Skia Canvas / Reanimated Views)   │
└───────────────────────────┬────────────────────────────┘
                            │ Triggers Actions
                            ▼
┌────────────────────────────────────────────────────────┐
│