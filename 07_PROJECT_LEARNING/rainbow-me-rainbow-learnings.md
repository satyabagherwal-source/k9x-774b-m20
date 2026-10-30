> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rainbow-me-rainbow-learnings.md`  
> **Source**: github ([https://github.com/rainbow-me/rainbow](https://github.com/rainbow-me/rainbow))  
> **Source Version**: `11a07420`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T04:00:37.811Z  
> **Learning ID**: `learn-github-rainbow-me-rainbow`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rainbow-me/rainbow

---

## 1. Executive Forensic Architecture & System Mechanics

`rainbow-me/rainbow` is an Ethereum and EVM-compatible non-custodial mobile wallet engine (iOS/Android via React Native) integrated with on-chain decentralized exchange (DEX) aggregators, cross-chain bridging primitives, perps protocols, decentralized identity resolvers (ENS), and real-time market data providers (Codex, CoinGecko).

```
                                  +------------------------------------+
                                  |     React Native Shell (Hermes)    |
                                  +-----------------+------------------+
                                                    |
                   +--------------------------------+--------------------------------+
                   |                                                                 |
                   v                                                                 v
+-------------------------------------+                            +-------------------------------------+
|        UI & Gestures Subsystem       |                            |         State & Query Layer         |
|  - Reanimated 3 Worklets            |                            |  - @storesjs/stores (Derived/Query) |
|  - Gesture Handler Pan/Springs      |                            |  - TanStack React Query Cache       |
|  - Font-Trimmed Geometric Layouts   |                            |  - MMKV & Async Storage Persisters  |
+------------------+------------------+                            +------------------+------------------+
                   |                                                                  |
                   +--------------------------------+---------------------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |     Cross-Boundary Data Engines    |
                                  |  - safeMath (div/mul/toFixed)      |
                                  |  - Codex GraphQL Financial Ingest  |
                                  |  - Native JSON-RPC / Viem Hooks    |
                                  +-----------------+------------------+
                                                    |
                   +--------------------------------+--------------------------------+
                   |                                                                 |
                   v                                                                 v
+-------------------------------------+                            +-------------------------------------+
|         Native iOS Extensions       |                            |      E2E Verification (Maestro)      |
|  - Swift WidgetKit Extensions       |                            |  - Coordinate Percentage Fallbacks  |
|  - CIColor Relative Luminance/WCAG  |                            |  - Sanitized Currency Parsers       |
|  - CoreGraphics Zero-Copy Resizing  |                            |  - Non-ID Deterministic Assertions  |
+-------------------------------------+                            +-------------------------------------+
```

### Architectural Subsystem Boundaries
1. **The State and Cache Ingestion Mesh (`@storesjs/stores` + TanStack React Query)**:
   - Rainbow bypasses global Redux monoliths for high-frequency trading data in favor of granular reactive stores using `@storesjs/stores` (`createQueryStore`, `createDerivedStore`, `createBaseStore`).
   - Derived stores implement shallow equality comparisons (`equalityFn: shallowEqual`) and dependency locking (`lockDependencies: true`) to decouple UI subscription lifecycles from network query lifecycles.
   - Network payload reuse: Downstream domain queries (such as Spot P&L or Top Holders) do not emit independent metadata queries; they hook into existing cached query keys (`externalTokenQueryKey`) maintained by the chart sheet to prevent network exhaustion and client throttling.

2. **The Worklet/UI Boundary (React Native Reanimated & Safe Math)**:
   - High-throughput layout calculations, gesture tracking, and number animations operate on Hermes UI worklet threads (`'worklet'`).
   - Standard JavaScript floating-point arithmetic is strictly banned for token balances and financial computations due to 64-bit IEEE-754 precision loss. Rainbow routes math through string-based BigNumber worklet wrappers (`divWorklet`, `mulWorklet`, `greaterThanOrEqualToWorklet`, `toFixedWorklet`).
   - Cross-thread analytics deduplication: UI-thread gesture and quote hooks dispatch non-blocking analytical telemetry back to the JS thread through `runOnJS`, guarding against event flood loops via strict state hashing (`lastParams` memoization).

3. **Multi-Platform Native Bridges & Extensions**:
   - iOS WidgetKit integration executes out-of-process Swift code (`PriceWidget`) operating on isolated memory constraints. It computes WCAG 2.1 relative luminance algorithms directly on sRGB color components:
     $$L = 0.2126 \times R + 0.7152 \times G + 0.0722 \times B$$
     ensuring asset branding badges meet contrast invariants before rendering to CoreGraphics frames.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Unified Currency Tiering and Anti-Double-Rounding Invariant
**RULE**:
Financial number formatters that scale across varying magnitudes (sub-cent, whole units, compact suffix notation) MUST determine threshold tier eligibility using the intermediate value rounded for that specific tier, BUT MUST evaluate the formatted digits exactly once against the unrounded raw float/BigInt magnitude. Display systems MUST NOT evaluate tier boundary thresholds on unrounded floats while simultaneously rendering rounded numbers, and MUST NOT format percentages or token values with non-deterministic variable trailing zeros adjacent to fixed-precision fields.

**WHY**:
Evaluating magnitude tiers on raw values causes catastrophic UI off-by-one boundary glitching. For example, `$99,999.60` evaluated raw against a `$100K` threshold would select whole-dollar formatting and round up to `$100,000`, while `$100,000.40` would select compact formatting and display as `$100.0K`. Furthermore, double-rounding (rounding to 2 decimal places, then scaling, then rounding to 1 decimal place) causes drift: `$999,949.50` would double-round to `$1,000.0K` (`$1.0M`) instead of staying strictly at `$999.9K`.

**WHEN TO APPLY**:
Apply to any frontend display system, financial dashboard, P&L calculator, or analytics interface converting high-precision arbitrary numbers into compact localized strings (`K`, `M`, `B`, `T`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import {
  divWorklet,
  greaterThanOrEqualToWorklet,
  lessThanWorklet,
  toFixedWorklet,
  equalWorklet,
} from '@/framework/core/safeMath';
import { addCommasToNumber } from '@/framework/ui/utils/addCommasToNumber';

const SUFFIXES = [
  { suffix: 'K', value: 1e3 },
  { suffix: 'M', value: 1e6 },
  { suffix: 'B', value: 1e9 },
  { suffix: 'T', value: 1e12 },
] as const;

const COMPACT_AMOUNT_FROM = 100_000;
const COMPACT_PERCENTAGE_FROM = 1_000;

/**
 * Abbreviates an arbitrary precision magnitude string into fixed 1-decimal compact notation.
 * Preserves trailing zeros (e.g., "184.0K") and increments tier dynamically if rounding pushes >= 1000.
 */
export function abbreviate(magnitude: string): string {
  'worklet';
  let tier = 0;
  let scaled = toFixedWorklet(divWorklet(magnitude, SUFFIXES[tier].value), 1);
  
  // Loop guard: advance tier if rounding rolls value over to 1000.0
  while (tier < SUFFIXES.length - 1 && greaterThanOrEqualToWorklet(scaled, 1000)) {
    tier += 1;
    scaled = toFixedWorklet(divWorklet(magnitude, SUFFIXES[tier].value), 1);
  }
  return `${addCommasToNumber(scaled)}${SUFFIXES[tier].suffix}`;
}

export function formatPnlPercentage(percentage: string): string {
  'worklet';
  const magnitude = percentage.replace('-', '');
  if (equalWorklet(magnitude, 0)) return '0%';
  
  // Strict rule: <1% decided strictly on raw magnitude before any rounding
  if (lessThanWorklet(magnitude, 1)) return '<1%';
  
  // Evaluate tier boundary against whole units
  const whole = toFixedWorklet(magnitude, 0);
  return `${lessThanWorklet(whole, COMPACT_PERCENTAGE_FROM) ? whole : abbreviate(magnitude)}%`;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Selecting compact notation using unrounded raw value,
// and trimming trailing zeros inconsistently via standard parseFloat/toFixed.
export function badFormat(amount: number): string {
  // Bug 1: 99999.6 is < 100000, so it outputs "$100000" instead of jumping to "$100.0K"
  if (amount < 100000) {
    return `$${Math.round(amount)}`;
  }
  // Bug 2: 999950 / 1e6 = 0.99995 -> toFixed(1) = "1.0", but parseFloat drops the zero -> "1M"
  // resulting in misaligned tables where "$184K" sits next to "$166.5K"
  const scaled = amount / 1000;
  return `$${parseFloat(scaled.toFixed(1))}K`;
}
```

**VERIFICATION METHOD**:
Verify using table-driven property unit tests covering critical rounding thresholds ($99,999.495 vs $99,999.500, $999,949.50 vs $999,950.00, and $0.9949 vs $0.9950):
```typescript
it.each([
  { amount: '99999.495', expected: '$99,999' },
  { amount: '99999.5', expected: '$100.0K' },
  { amount: '999949.5', expected: '$999.9K' },
  { amount: '999950', expected: '$1.0M' },
  { amount: '0.9949', expected: '$0.99' },
  { amount: '0.995', expected: '$1' },
])('formats $amount strictly to $expected without boundary inversion', ({ amount, expected }) => {
  expect(formatNativeAmount(amount, 'USD')).toBe(expected);
});
```

---

### 2. Multi-Store Reactive Derivation Synchronization & Cache Piggybacking
**RULE**:
When an entity's domain eligibility (e.g., P&L tracking, Holder rankings) depends on dynamic asynchronous metadata (e.g., asset classification), that eligibility state MUST be derived inside a centralized, singleton reactive store with locked dependencies (`lockDependencies: true`) and strict equality guarantees (`shallowEqual`). Downstream UI components and data queries MUST NOT independently execute metadata requests or maintain bespoke boolean gates. Furthermore, metadata fetches MUST read directly from existing parent cache entries (`queryClient.getQueryData`) before invoking network fallbacks.

**WHY**:
Distributing eligibility checks across multiple UI components creates race conditions where a fast UI transition (e.g., switching the active token) causes an downstream store to pair the newly selected token's address with the *previous* token's cached classification type. This emits invalid API queries (e.g., sending Codex requests for stablecoins or native gas assets), creates flickering UI states, wastes mobile bandwidth, and risks downstream backend rate-limiting.

**WHEN TO APPLY**:
Applies to any state architecture where multiple distinct visualizations or query engines rely on a secondary asynchronous attribute of a primary selected domain entity.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { createDerivedStore, createQueryStore, shallowEqual } from '@storesjs/stores';
import { queryClient } from '@/react-query/queryClient';

// 1. Parameterized store with decoupled shallow caching
const useViewedTokenTypeStore = createQueryStore<string | null, ViewedTokenTypeParams>({
  fetcher: fetchViewedTokenType,
  params: {
    token: $ => $(useChartsStore, ({ token }) => 
      token && !isNativeAsset(token.address, token.chainId)
        ? { address: token.address, chainId: token.chainId }
        : null, 
      shallowEqual
    ),
    currency: $ => $(userAssetsStoreManager, state => state.currency),
  },
  staleTime: 3600000,
});

async function fetchViewedTokenType({ token, currency }: ViewedTokenTypeParams): Promise<string | null> {
  if (!token) return null;
  const queryKey = externalTokenQueryKey({ address: token.address, chainId: token.chainId, currency });
  
  // Cache piggybacking: Never fetch if chart parent has already fetched or cached the entity
  const cached = queryClient.getQueryData<ExternalTokenResult>(queryKey);
  if (cached) return cached.type ?? null;
  
  const fresh = await queryClient.fetchQuery(queryKey, externalTokenQueryFunction, {
    staleTime: 3600000,
  });
  return fresh?.type ?? null;
}

// 2. Atomic, centralized eligibility derivation with locked dependency transitions
export const usePnlEligibleToken = createDerivedStore(
  $ => {
    const token = $(useChartsStore, state => state.token);
    const type = $(useViewedTokenTypeStore, state => state.getData());

    // Deterministic atomic exclusion: prevents tearing or race pairing
    if (!token || !type || type === 'stablecoin' || type === 'native') {
      return null;
    }
    return {
      address: token.address,
      chainId: token.chainId,
      codexTokenId: `${token.address}:${token.chainId}`,
    };
  },
  { equalityFn: shallowEqual, lockDependencies: true }
);
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Prop-drilling tokenType and gating network fetches in UI components
export function BadTokenPill({ token, tokenType }: { token: Token; tokenType?: string }) {
  // Race condition: token updates before tokenType resolves, firing an illegal query
  // with token=USDC and tokenType=undefined or previous token's type!
  const trades = useQuery(['trades', token.address], () => fetchTrades(token.address), {
    enabled: tokenType !== 'stablecoin', // FAILS: fires while tokenType is still resolving
  });
  
  if (tokenType === 'stablecoin') return null;
  return <Text>{trades.data?.pnl}</Text>;
}
```

**VERIFICATION METHOD**:
Construct an asynchronous sequence test proving that swapping the primary selected entity does not emit an intermediate state where the old type is paired with the new entity:
```typescript
it("never pairs a newly viewed token with the previous token's type", async () => {
  const transitions: unknown[] = [];
  const unsubscribe = usePnlEligibleToken.subscribe(state => transitions.push(state));
  
  await viewToken({ address: '0xordinary', chainId: 1 }); // resolves type: 'none'
  expect(usePnlEligibleToken.getState()?.address).toBe('0xordinary');

  const deferredType = createDeferredPromise<string>();
  mockTypeResolver('0xstable', deferredType.promise);
  
  // Switch token
  viewToken({ address: '0xstable', chainId: 1 });
  deferredType.resolve('stablecoin');
  await flushMicrotasks();

  // Assert that 0xstable was NEVER emitted as eligible during the resolution window
  expect(transitions).not.toContainEqual(expect.objectContaining({ address: '0xstable' }));
  expect(usePnlEligibleToken.getState()).toBeNull();
  unsubscribe();
});
```

---

### 3. Font Metrics-Compensated Spacing Invariant for Native Typography
**RULE**:
When implementing design system specifications where typography has been configured with cap-height and baseline font trimming (`includeFontPadding: false` on Android, or explicit line-box leading removal), UI layouts MUST NOT apply raw Figma layout gaps directly. Engineers MUST adjust container margins and layout gaps by adding the delta of the stripped top/bottom font leadings ($$\Delta = \text{Leading}_{\text{untrimmed}} - \text{Leading}_{\text{trimmed}}$$) to reproduce the exact visual rhythm intended by the design spec.

**WHY**:
Design tools like Figma measure vertical auto-layout padding between untrimmed typographic bounding boxes (including font ascender/descender margins). When a production mobile design system strips these paddings to achieve precise geometric alignment with icons and borders, using Figma's nominal values will draw elements noticeably closer together than intended.

**WHEN TO APPLY**:
Applies to React Native, Android Compose, or iOS Swift layout containers holding mixed iconography and text elements where `leading` or `fontPadding` has been programmatically altered.

**VERIFIED IMPLEMENTATION PATTERN**:
```tsx
// Figma Spec: Gap = 24pt between Icon (26pt) and Explanation Text (17pt / line-height 135%)
// Font Box Analysis: Untrimmed leading = 12pt total (6pt ascender pad + 6pt descender pad)
// Compensation Formula: Effective Gap = Nominal Gap (24) + Font Padding Compensation (12) = 36pt

export function SpotPnlExcludedTokensSheet() {
  return (
    <PanelSheet borderRadius={38} innerBorderWidth={1}>
      <Box 
        gap={36} // Compensated from Figma 24pt to offset baseline/cap-height trimming
        paddingHorizontal={{ custom: 32 }} 
        paddingTop={{ custom: 36 }} 
        paddingBottom={{ custom: 40 }}
      >
        <Text color="labelSecondary" size="26pt" weight="heavy">
          {'􀅴'}
        </Text>
        <Text color="labelSecondary" size="17pt / 135%" weight="bold">
          {i18n.t(i18n.l.spot_pnl_sheet.excluded_tokens_info)}
        </Text>
      </Box>
    </PanelSheet>
  );
}
```

**NEGATIVE CONSTRAINT**:
```tsx
// ANTI-PATTERN: Blindly transcribing Figma auto-layout gaps onto trimmed Text nodes
<Box gap={24}> {/* RESULTS IN VISUAL REGRESSION: Renders at ~12pt visible spacing */}
  <Text style={{ includeFontPadding: false }}>Header</Text>
  <Text style={{ includeFontPadding: false }}>Body</Text>
</Box>
```

**VERIFICATION METHOD**:
Execute an automated snapshot or visual regression test checking that the pixel distance between the baseline of the icon glyph and the cap-height of the subsequent text node equals the targeted physical distance.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Stablecoin & Native Asset P&L Query Leakage (BUG-PNL-01)
- **Context**: `src/features/spot-pnl/data/pnlEligibleTokenStore.ts`, `src/features/spot-pnl/ui/SpotPnlPill.tsx`
- **What Was Expected**: Non-fungible, non-speculative, or non-P&L-amenable assets (e.g., USDC, USDT, native ETH via `0x000...000` or `'eth'`) must not trigger GraphQL or REST queries to Codex for trades, cost-basis calculations, or top-holder rankings.
- **What Actually Happened**: The `SpotPnlPill` UI component hid itself when `tokenType === 'stablecoin'`, but the underlying `useTokenTradesStore` and `useTopHoldersStore` remained active and continuously fired network queries for every token viewed. This triggered redundant backend indexing workloads and mobile telemetry noise.
- **Evidence in Repo**: Commit `a8d0e4a4`, PR #7898, fixing APP-4164.
- **Root Cause**: Gating logic lived at the presentation tier (`SpotPnlPill`) rather than encapsulating data acquisition. Network hooks subscribed directly to `useChartsStore.token` without evaluating token taxonomy.
- **Remediation Code Diff**:
```diff
--- a/src/features/spot-pnl/data/tokenTradesStore.ts
+++ b/src/features/spot-pnl/data/tokenTradesStore.ts
@@ -89,10 +91,11 @@ export function createTokenTradesStore(config: Pick<QueryStoreConfig<WalletToken
 export const useTokenTradesStore = createTokenTradesStore({
-  enabled: $ => $(useSpotPnlTokenId, Boolean),
+  // Gated on the flags alone: an ineligible token leaves `codexTokenId` null, which fetches nothing
+  enabled: $ => $(useSpotPnlEnabledStore),
   params: {
     walletAddress: $ => $(userAssetsStoreManager).address,
-    codexTokenId: $ => $(useSpotPnlTokenId),
+    codexTokenId: $ => $(usePnlEligibleToken, token => token?.codexTokenId ?? null),
     heldBalance: $ => $(useViewedTokenBalance),
   },
 });
```
- **Lesson**: Network queries must be gated at the parameter level via derived data invariants, never solely via component unmounting.

---

### Incident 2: Inconsistent Multi-Surface Financial Precision & Abbreviation Truncation (BUG-PNL-02)
- **Context**: `src/features/spot-pnl/ui/pnlFormat.ts`, `src/features/spot-pnl/ui/pnlDisplay.tsx`
- **What Was Expected**: Dollar amounts, returns, and percentages across the Spot P&L Pill, P&L Sheet, and Top Holders list must use a unified, predictable scale where precision matches magnitude and trailing zeros are kept for alignment (`$184.0K` next to `$166.5K`).
- **What Actually Happened**: Different views used diverging rounding mechanics. The Top Holders list displayed `$10.1K` directly above `$7,073.81`. Trailing zeros were stripped in abbreviations (`$184K` next to `$166.5K`). Percentages below 1% rendered as fractional decimals (`0.43%`) in some views and rounded to `0%` in others.
- **Evidence in Repo**: Commit `7d249f1f`, PR #7899, resolving APP-4163.
- **Root Cause**: Two separate utilities (`convertAmountToNativeDisplay` and manual regex replaces) were making conflicting decisions about compactness thresholds and decimal stripping.
- **Remediation Code Diff**:
```diff
--- a/src/features/spot-pnl/ui/pnlDisplay.tsx
+++ b/src/features/spot-pnl/ui/pnlFormat.ts
+function abbreviate(magnitude: string): string {
+  let tier = 0;
+  let scaled = toFixedWorklet(divWorklet(magnitude, SUFFIXES[tier].value), 1);
+  while (tier < SUFFIXES.length - 1 && greaterThanOrEqualToWorklet(scaled, 1000)) {
+    tier += 1;
+    scaled = toFixedWorklet(divWorklet(magnitude, SUFFIXES[tier].value), 1);
+  }
+  return `${addCommasToNumber(scaled)}${SUFFIXES[tier].suffix}`;
+}
```
- **Lesson**: Financial formatting must never be distributed among UI view components. Magnitude scaling must be isolated in a shared pure library with explicit regression fixtures across boundary transitions.

---

### Incident 3: Bottom Sheet Layout Snapping & Loading-Height Thrashing (BUG-PNL-03)
- **Context**: `src/features/spot-pnl/ui/SpotPnlSheet.tsx`
- **What Was Expected**: When expanding the Spot P&L sheet, the panel should smoothly open to its expected resting height.
- **What Actually Happened**: The sheet opened as a tiny stub containing only a spinner (~120pt height). When trade queries settled from the network, the sheet snapped instantly to full height, causing severe visual jitter and layout reflow thrashing on lower-end Android devices.
- **Evidence in Repo**: PR #7905, Issue #7905.
- **Root Cause**: The placeholder state (`SpotPnlPlaceholder`) had no fixed structural height constraint matching the expected child view (`SpotPnlBody`), causing the Reanimated bottom sheet to calculate target snap points against an unstable initial child layout.
- **Remediation Code Diff**:
```diff
--- a/src/features/spot-pnl/ui/SpotPnlSheet.tsx
+++ b/src/features/spot-pnl/ui/SpotPnlSheet.tsx
-// Previously defaulted to min-content height resulting in layout jump
-const LOADING_HEIGHT = 120;
+const SHEET_MIN_BODY_HEIGHT = 380; // Pins placeholder directly to Unrealized Position loaded height

function SpotPnlPlaceholder({ isSettled }: { isSettled: boolean }) {
  return (
-   <Box height={LOADING_HEIGHT} justifyContent="center" alignItems="center">
+   <Box minHeight={SHEET_MIN_BODY_HEIGHT} justifyContent="center" alignItems="center">
      <ActivityIndicator size="small" />
    </Box>
  );
}
```
- **Lesson**: Dynamic bottom sheets must reserve the loaded layout's bounding box during asynchronous data ingestion to eliminate snap-point thrashing.

---

### Incident 4: Typographic Leading Stripping vs. Design Auto-Layout Gap Drift (BUG-UI-04)
- **Context**: `src/features/spot-pnl/ui/SpotPnlExcludedTokensSheet.tsx`
- **What Was Expected**: The information sheet explaining excluded tokens must match Figma specifications precisely, providing clear visual separation between the warning glyph (`􀅴`) and descriptive text.
- **What Actually Happened**: The spacing appeared cramped and collapsed. The icon rendered in high-contrast `label` color while the text rendered in muted `labelTertiary`, drawing jarring user attention to the icon.
- **Evidence in Repo**: Commit `099dfe1c`, PR #7902.
- **Root Cause**: The developer copied Figma's `24pt` auto-layout gap directly into React Native. However, the custom `Text` component had font padding and line-box leading stripped to cap height and baseline. Figma’s nominal `24pt` assumed untrimmed bounding boxes, resulting in an effective real spacing deficit of 12pt.
- **Remediation Code Diff**:
```diff
--- a/src/features/spot-pnl/ui/SpotPnlExcludedTokensSheet.tsx
+++ b/src/features/spot-pnl/ui/SpotPnlExcludedTokensSheet.tsx
@@ -7,11 +7,11 @@ export function SpotPnlExcludedTokensSheet() {
    return (
      <PanelSheet borderRadius={38} innerBorderWidth={1}>
-      <Box gap={24} paddingHorizontal={{ custom: 32 }} paddingTop={{ custom: 36 }} paddingBottom={{ custom: 40 }}>
-        <Text color="label" size="26pt" weight="heavy">
+      <Box gap={36} paddingHorizontal={{ custom: 32 }} paddingTop={{ custom: 36 }} paddingBottom={{ custom: 40 }}>
+        <Text color="labelSecondary" size="26pt" weight="heavy">
           {'􀅴'}
         </Text>
-        <Text color="labelTertiary" size="17pt / 135%" weight="bold">
+        <Text color="labelSecondary" size="17pt / 135%" weight="bold">
           {i18n.t(i18n.l.spot_pnl_sheet.excluded_tokens_info)}
         </Text>
       </Box>
```
- **Lesson**: Design token gaps cannot be mechanically ported without accounting for typographic leading trim mechanics.

---

### Incident 5: Redundant Cross-Surface Remote ENS Metadata Lookups (BUG-DATA-05)
- **Context**: `src/features/spot-pnl/ui/SpotPnlSheet.tsx`
- **What Was Expected**: Navigating from the Top Holders list into a holder's individual P&L sheet should instantly render their ENS identity and avatar without triggering duplicate lookups.
- **What Actually Happened**: The P&L sheet ignored the ENS name already resolved in the parent route and triggered another network resolution from the Ethereum JSON-RPC provider.
- **Evidence in Repo**: Commit `a8d0e4a4`, PR #7898.
- **Root Cause**: Parameter passing in `Routes.SPOT_PNL_SHEET` omitted the optional `ensName` route prop, forcing `WalletChip` to rely exclusively on `useAccountProfileInfo` which resolved the address from scratch.
- **Remediation Code Diff**:
```diff
--- a/src/features/spot-pnl/ui/SpotPnlSheet.tsx
+++ b/src/features/spot-pnl/ui/SpotPnlSheet.tsx
@@ -45,19 +46,29 @@ export const SpotPnlSheet = memo(function SpotPnlSheet() {
   const {
-    params: { address, chainId, walletAddress: routeWalletAddress },
+    params: { address, chainId, ensName, walletAddress: routeWalletAddress },
   } = useRoute<typeof Routes.SPOT_PNL_SHEET>();
   const selectedWalletAddress = userAssetsStoreManager(state => state.address);
   const walletAddress = routeWalletAddress ?? selectedWalletAddress;
 
   return (
     <PanelSheet borderRadius={SHEET_BORDER_RADIUS} innerBorderWidth={1}>
-      {walletAddress && <SpotPnlSheetContent tokenAddress={address} chainId={chainId} walletAddress={walletAddress} />}
+      {walletAddress && <SpotPnlSheetContent tokenAddress={address} chainId={chainId} walletAddress={walletAddress} ensName={ensName} />}
     </PanelSheet>
   );
 });
@@ -219,8 +219,10 @@ function WalletChip({ walletAddress, ensName }: { walletAddress: string;