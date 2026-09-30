# Forensic Learning Record (Deep Inspection): Flipkart/recyclerlistview

> **Canonical Artifact**: `07_PROJECT_LEARNING/flipkart-recyclerlistview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Flipkart/recyclerlistview](https://github.com/Flipkart/recyclerlistview))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:24:18.329Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Flipkart/recyclerlistview`
- **Description**: High performance listview for React Native and web!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5433 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/core/ItemAnimator.ts`
```
export default interface ItemAnimator {
    //Web uses tranforms for moving items while react native uses left, top
    //IMPORTANT: In case of native itemRef will be a View and in web/RNW div element so, override accordingly.

    //Just an external trigger, no itemRef available, you can return initial style overrides here i.e, let's say if you want to
    //set initial opacity to 0 you can do: return { opacity: 0 };
    animateWillMount: (atX: number, atY: number, itemIndex: number) => object | undefined;

    //Called after mount, item may already be visible when this is called. Handle accordingly
    animateDidMount: (atX: number, atY: number, itemRef: object, itemIndex: number) => void;

    //Will be called if RLV cell is going to re-render, note that in case of non deterministic rendering width changes from layout
    //provider do not force re-render while they do so in deterministic. A re-render will apply the new layout which may cause a
    //jitter if you're in the middle of an animation. You need to handle those scenarios
    animateWillUpdate: (fromX: number, fromY: number, toX: number, toY: number, itemRef: object, itemIndex: number) => void;

    //If handled return true, RLV may appropriately skip the render cycle to avoid UI jitters. This callback indicates that there
    //is no update in the cell other than its position
    animateShift: (fromX: number, fromY: number, toX: number, toY: number, itemRef: object, itemIndex: number) => boolean;

    //Called before unmount
    animateWillUnmount: (atX: number, atY: number, itemRef: object, itemIndex: number) => void;
}

export class BaseItemAnimator implements ItemAnimator {
    public static USE_NATIVE_DRIVER = false;
    public animateWillMount(atX: number, atY: number, itemIndex: number): object | undefined {
        return undefined;
    }
    public animateDidMount(atX: number, atY: number, itemRef: object, itemIndex: number): void {
        //no need
    }

    public animateWillUpdate(fromX: number, fromY: number, toX: number, toY: number, itemRef: object, itemIndex: number): void {
        //no need
    }

    public animateShift(fromX: number, fromY: number, toX: number, toY: number, itemRef: object, itemIndex: number): boolean {
        return false;
    }

    public animateWillUnmount(atX: number, atY: number, itemRef: object, itemIndex: number): void {
        //no need
    }
}

```

### Core Architecture Module: `src/core/ProgressiveListView.tsx`
```
import RecyclerListView, { RecyclerListViewProps, RecyclerListViewState } from "./RecyclerListView";
export interface ProgressiveListViewProps extends RecyclerListViewProps {
    maxRenderAhead?: number;
    renderAheadStep?: number;

    /**
     * A smaller final value can help in building up recycler pool in advance. This is only used if there is a valid updated cycle.
     * e.g, if maxRenderAhead is 0 then there will be no cycle and final value will be unused
     */
    finalRenderAheadOffset?: number;
}
/**
 * This will incrementally update renderAhead distance and render the page progressively.
 * renderAheadOffset = initial value which will be incremented
 * renderAheadStep = amount of increment made on each frame
 * maxRenderAhead = maximum value for render ahead at the end of update cycle
 * finalRenderAheadOffset = value to set after whole update cycle is completed. If undefined, final offset value will be equal to maxRenderAhead
 */
export default class ProgressiveListView extends RecyclerListView<ProgressiveListViewProps, RecyclerListViewState> {
    public static defaultProps = {
        ...RecyclerListView.defaultProps,
        maxRenderAhead: Number.MAX_VALUE,
        renderAheadStep: 300,
        renderAheadOffset: 0,
    };
    private renderAheadUpdateCallbackId?: number;
    private isFirstLayoutComplete: boolean = false;

    public componentDidMount(): void {
        super.componentDidMount();
        if (!this.props.forceNonDeterministicRendering) {
            this.updateRenderAheadProgressively(this.getCurrentRenderAheadOffset());
        }
    }

    public componentWillUnmount(): void {
        this.cancelRenderAheadUpdate();
        super.componentWillUnmount();
    }

    protected onItemLayout(index: number): void {
        if (!this.isFirstLayoutComplete) {
            this.isFirstLayoutComplete = true;
            if (this.props.forceNonDeterministicRendering) {
                this.updateRenderAheadProgressively(this.getCurrentRenderAheadOffset());
            }
        }
        super.onItemLayout(index);
    }

    private updateRenderAheadProgressively(newVal: number): void {
        this.cancelRenderAheadUpdate(); // Cancel any pending callback.
        this.renderAheadUpdateCallbackId = requestAnimationFrame(() => {
            if (!this.updateRenderAheadOffset(newVal)) {
                this.updateRenderAheadProgressively(newVal);
            } else {
                this.incrementRenderAhead();
            }
        });
    }

    private incrementRenderAhead(): void {
        if (this.props.maxRenderAhead && this.props.renderAheadStep) {
            const layoutManager = this.getVirtualRenderer().getLayoutManager();
            const currentRenderAheadOffset = this.getCurrentRenderAheadOffset();
            if (layoutManager) {
                const contentDimension = layoutManager.getContentDimension();
                const maxContentSize = this.props.isHorizontal ? contentDimension.width : contentDimension.height;
                if (currentRenderAheadOffset < maxContentSize && currentRenderAheadOffset < this.props.maxRenderAhead) {
                    const newRenderAheadOffset = currentRenderAheadOffset + this.props.renderAheadStep;
                    this.updateRenderAheadProgressively(newRenderAheadOffset);
                } else {
                    this.performFinalUpdate();
                }
            }
        }
    }

    private performFinalUpdate(): void {
        this.cancelRenderAheadUpdate(); // Cancel any pending callback.
        this.renderAheadUpdateCallbackId = requestAnimationFrame(() => {
        if (this.props.finalRenderAheadOffset !== undefined) {
                this.updateRenderAheadOffset(this.props.finalRenderAheadOffset);
            }
        });
    }

    private cancelRenderAheadUpdate(): void {
        if (this.renderAheadUpdateCallbackId !== undefined) {
            cancelAnimationFrame(this.renderAheadUpdateCallbackId);
        }
    }
}

```

### Core Architecture Module: `src/core/RecyclerListView.tsx`
```
/***
 * DONE: Reduce layout processing on data insert
 * DONE: Add notify data set changed and notify data insert option in data source
 * DONE: Add on end reached callback
 * DONE: Make another class for render stack generator
 * DONE: Simplify rendering a loading footer
 * DONE: Anchor first visible index on any insert/delete data wise
 * DONE: Build Scroll to index
 * DONE: Give viewability callbacks
 * DONE: Add full render logic in cases like change of dimensions
 * DONE: Fix all proptypes
 * DONE: Add Initial render Index support
 * DONE: Add animated scroll to web scrollviewer
 * DONE: Animate list view transition, including add/remove
 * DONE: Implement sticky headers and footers
 * TODO: Destroy less frequently used items in recycle pool, this will help in case of too many types.
 * TODO: Make viewability callbacks configurable
 * TODO: Observe size changes on web to optimize for reflowability
 * TODO: Solve //TSI
 */
import debounce = require("lodash.debounce");
import * as PropTypes from "prop-types";
import * as React from "react";
import { ObjectUtil, Default } from "ts-object-utils";
import ContextProvider from "./dependencies/ContextProvider";
import { BaseDataProvider } from "./dependencies/DataProvider";
import { Dimension, BaseLayoutProvider } from "./dependencies/LayoutProvider";
import CustomError from "./exceptions/CustomError";
import RecyclerListViewExceptions from "./exceptions/RecyclerListViewExceptions";
import { Point, Layout, LayoutManager } from "./layoutmanager/LayoutManager";
import { Constants } from "./constants/Constants";
import { Messages } from "./constants/Messages";
import BaseScrollComponent from "./scrollcomponent/BaseScrollComponent";
import BaseScrollView, { ScrollEvent, ScrollViewDefaultProps } from "./scrollcomponent/BaseScrollView";
import { TOnItemStatusChanged, WindowCorrection } from "./ViewabilityTracker";
import VirtualRenderer, { RenderStack, RenderStackItem, RenderStackParams } from "./VirtualRenderer";
import ItemAnimator, { BaseItemAnimator } from "./ItemAnimator";
import { DebugHandlers } from "..";
import { ComponentCompat } from "../utils/ComponentCompat";
//#if [REACT-NATIVE]
import ScrollComponent from "../platform/reactnative/scrollcomponent/ScrollComponent";
import ViewRenderer from "../platform/reactnative/viewrenderer/ViewRenderer";
import { DefaultJSItemAnimator as DefaultItemAnimator } from "../platform/reactnative/itemanimators/defaultjsanimator/DefaultJSItemAnimator";
import { Platform, ScrollView } from "react-native";
const IS_WEB = !Platform || Platform.OS === "web";
//#endif

/***
 * To use on web, start importing from recyclerlistview/web. To make it even easier specify an alias in you builder of choice.
 */

//#if [WEB]
//import ScrollComponent from "../platform/web/scrollcomponent/ScrollComponent";
//import ViewRenderer from "../platform/web/viewrenderer/ViewRenderer";
//import { DefaultWebItemAnimator as DefaultItemAnimator } from "../platform/web/itemanimators/DefaultWebItemAnimator";
//const IS_WEB = true;
//type ScrollView = unknown;
//#endif

/***
 * This is the main component, please refer to samples to understand how to use.
 * For advanced usage check out prop descriptions below.
 * You also get common methods such as: scrollToIndex, scrollToItem, scrollToTop, scrollToEnd, scrollToOffset, getCurrentScrollOffset,
 * findApproxFirstVisibleIndex.
 * You'll need a ref to Recycler in order to call these
 * Needs to have bounded size in all cases other than window scrolling (web).
 *
 * NOTE: React Native implementation uses ScrollView internally which means you get all ScrollView features as well such as Pull To Refresh, paging enabled
 *       You can easily create a recycling image flip view using one paging enabled flag. Read about ScrollView features in official
 *       react native documentation.
 * NOTE: If you see blank space look at the renderAheadOffset prop and make sure your data provider has a good enough rowHasChanged method.
 *       Blanks are totally avoidable with this listview.
 * NOTE: Also works on web (experimental)
 * NOTE: For reflowability set canChangeSize to true (experimental)
 */
export interface OnRecreateParams {
    lastOffset?: number;
}

export interface RecyclerListViewProps {
    layoutProvider: BaseLayoutProvider;
    dataProvider: BaseDataProvider;
    rowRenderer: (type: string | number, data: any, index: number, extendedState?: object) => JSX.Element | JSX.Element[] | null;
    contextProvider?: ContextProvider;
    renderAheadOffset?: number;
    isHorizontal?: boolean;
    onScroll?: (rawEvent: ScrollEvent, offsetX: number, offsetY: number) => void;
    onRecreate?: (params: OnRecreateParams) => void;
    onEndReached?: () => void;
    onEndReachedThreshold?: number;
    onEndReachedThresholdRelative?: number;
    onVisibleIndexesChanged?: TOnItemStatusChanged;
    onVisibleIndicesChanged?: TOnItemStatusChanged;
    renderFooter?: () => JSX.Element | JSX.Element[] | null;
    externalScrollView?: { new(props: ScrollViewDefaultProps): BaseScrollView };
    layoutSize?: Dimension;
    initialOffset?: number;
    initialRenderIndex?: number;
    scrollThrottle?: number;
    canChangeSize?: boolean;
    useWindowScroll?: boolean;
    disableRecycling?: boolean;
    forceNonDeterministicRendering?: boolean;
    extendedState?: object;
    itemAnimator?: ItemAnimator;
    optimizeForInsertDeleteAnimations?: boolean;
    style?: object | number;
    debugHandlers?: DebugHandlers;
    renderContentContainer?: (props?: object, children?: React.ReactNode) => React.ReactNode | null;
    renderItemContainer?: (props: object, parentProps: object, children?: React.ReactNode) => React.ReactNode;
    //For all props that need to be proxied to inner/external scrollview. Put them in an object and they'll be spread
    //and passed down. For better typescript support.
    scrollViewProps?: object;
    applyWindowCorrection?: (offsetX: number, offsetY: number, windowCorrection: WindowCorrection) => void;
    onItemLayout?: (index: number) => void;
    windowCorrectionConfig?: { value?: WindowCorrection, applyToInitialOffset?: boolean, applyToItemScroll?: boolean };

    //This can lead to inconsistent behavior. Use with caution.
    //If set to true, recyclerlistview will not measure itself if scrollview mounts with zero height or width.
    //If there are no following events with right dimensions nothing will be rendered.
    suppressBoundedSizeException?: boolean;
}

export interface RecyclerListViewState {
    renderStack: RenderStack;
    internalSnapshot: Record<string, object>;
}

export interface WindowCorrectionConfig {
    value: WindowCorrection;
    applyToInitialOffset: boolean;
    applyToItemScroll: boolean;
}

export default class RecyclerListView<P extends RecyclerListViewProps, S extends RecyclerListViewState> extends ComponentCompat<P, S> {
    public static defaultProps = {
        canChangeSize: false,
        disableRecycling: false,
        initialOffset: 0,
        initialRenderIndex: 0,
        isHorizontal: false,
        onEndReachedThreshold: 0,
        onEndReachedThresholdRelative: 0,
        renderAheadOffset: IS_WEB ? 1000 : 250,
    };

    public static propTypes = {};

    private refreshRequestDebouncer = debounce((executable: () => void) => {
        executable();
    });

    private _virtualRenderer: VirtualRenderer;
    private _onEndReachedCalled = false;
    private _initComplete = false;
    private _isMounted = true;
    private _relayoutReqIndex: number = -1;
    private _params: RenderStackParams = {
        initialOffset: 0,
        initialRenderIndex: 0,
        isHorizontal: false,
        itemCount: 0,
        renderAheadOffset: 250,
    };
    private _layout: Dimension = { height: 0, width: 0 };
    private _pendingScrollToOffset: Point | null = null;
    private _pendingRenderStack?: RenderStack;
    private _tempDim: Dimension = { height: 0, width: 0 };
    private _initialOffset = 0;
    private _
```

### Core Architecture Module: `src/core/StickyContainer.tsx`
```
/**
 * Created by ananya.chandra on 14/09/18.
 */

import * as React from "react";
import * as PropTypes from "prop-types";
import { StyleProp, View, ViewStyle } from "react-native";
import RecyclerListView, { RecyclerListViewState, RecyclerListViewProps } from "./RecyclerListView";
import { ScrollEvent } from "./scrollcomponent/BaseScrollView";
import StickyObject, { StickyObjectProps } from "./sticky/StickyObject";
import StickyHeader from "./sticky/StickyHeader";
import StickyFooter from "./sticky/StickyFooter";
import CustomError from "./exceptions/CustomError";
import RecyclerListViewExceptions from "./exceptions/RecyclerListViewExceptions";
import { Layout } from "./layoutmanager/LayoutManager";
import { BaseLayoutProvider, Dimension } from "./dependencies/LayoutProvider";
import { BaseDataProvider } from "./dependencies/DataProvider";
import { ReactElement } from "react";
import { ComponentCompat } from "../utils/ComponentCompat";
import { WindowCorrection } from "./ViewabilityTracker";

// Constant to check if React version is 19 or higher
const isReact19OrHigher: boolean = (() => {
    // Check React version by examining React.version if available
    if (React.version) {
        const majorVersion = parseInt(React.version.split(".")[0], 10);
        return majorVersion >= 19;
    }
    return false;
})();

export interface StickyContainerProps {
    children: RecyclerChild;
    stickyHeaderIndices?: number[];
    stickyFooterIndices?: number[];
    overrideRowRenderer?: (type: string | number | undefined, data: any, index: number, extendedState?: object) => JSX.Element | JSX.Element[] | null;
    applyWindowCorrection?: (offsetX: number, offsetY: number, winowCorrection: WindowCorrection) => void;
    renderStickyContainer?: (stickyContent: JSX.Element, index: number, extendedState?: object) => JSX.Element | null;
    style?: StyleProp<ViewStyle>;
    alwaysStickyFooter?: boolean;
}
export interface RecyclerChild extends React.ReactElement<RecyclerListViewProps> {
    ref: (recyclerRef: any) => {};
    props: RecyclerListViewProps;
}
export default class StickyContainer<P extends StickyContainerProps> extends ComponentCompat<P> {
    public static propTypes = {};
    private _recyclerRef: RecyclerListView<RecyclerListViewProps, RecyclerListViewState> | undefined = undefined;
    private _dataProvider: BaseDataProvider;
    private _layoutProvider: BaseLayoutProvider;
    private _extendedState: object | undefined;
    private _rowRenderer: ((type: string | number, data: any, index: number, extendedState?: object) => JSX.Element | JSX.Element[] | null);
    private _stickyHeaderRef: StickyHeader<StickyObjectProps> | null = null;
    private _stickyFooterRef: StickyFooter<StickyObjectProps> | null = null;
    private _visibleIndicesAll: number[] = [];
    private _windowCorrection: WindowCorrection = {
        startCorrection: 0, endCorrection: 0, windowShift: 0,
    };

    constructor(props: P, context?: any) {
        super(props, context);
        this._assertChildType();
        const childProps: RecyclerListViewProps = props.children.props;
        this._dataProvider = childProps.dataProvider;
        this._layoutProvider = childProps.layoutProvider;
        this._extendedState = childProps.extendedState;
        this._rowRenderer = childProps.rowRenderer;
        this._getWindowCorrection(0, 0, props);
    }

    public componentWillReceivePropsCompat(newProps: P): void {
        this._initParams(newProps);
    }

    public renderCompat(): JSX.Element {
        this._assertChildType();
        const recycler: ReactElement<RecyclerListViewProps> = React.cloneElement(this.props.children, {
            ...this.props.children.props,
            ref: this._getRecyclerRef,
            onVisibleIndicesChanged: this._onVisibleIndicesChanged,
            onScroll: this._onScroll,
            applyWindowCorrection: this._applyWindowCorrection,
            rowRenderer: this._rlvRowRenderer,
        });
        return (
            <View style={this.props.style ? this.props.style : { flex: 1 }}>
                {recycler}
                {this.props.stickyHeaderIndices ? (
                    <StickyHeader ref={(stickyHeaderRef: any) => this._getStickyHeaderRef(stickyHeaderRef)}
                        stickyIndices={this.props.stickyHeaderIndices}
                        getLayoutForIndex={this._getLayoutForIndex}
                        getDataForIndex={this._getDataForIndex}
                        getLayoutTypeForIndex={this._getLayoutTypeForIndex}
                        getExtendedState={this._getExtendedState}
                        getRLVRenderedSize={this._getRLVRenderedSize}
                        getContentDimension={this._getContentDimension}
                        getRowRenderer={this._getRowRenderer}
                        overrideRowRenderer={this.props.overrideRowRenderer}
                        renderContainer={this.props.renderStickyContainer}
                        getWindowCorrection={this._getCurrentWindowCorrection} />
                ) : null}
                {this.props.stickyFooterIndices ? (
                    <StickyFooter ref={(stickyFooterRef: any) => this._getStickyFooterRef(stickyFooterRef)}
                        stickyIndices={this.props.stickyFooterIndices}
                        getLayoutForIndex={this._getLayoutForIndex}
                        getDataForIndex={this._getDataForIndex}
                        getLayoutTypeForIndex={this._getLayoutTypeForIndex}
                        getExtendedState={this._getExtendedState}
                        getRLVRenderedSize={this._getRLVRenderedSize}
                        getContentDimension={this._getContentDimension}
                        getRowRenderer={this._getRowRenderer}
                        overrideRowRenderer={this.props.overrideRowRenderer}
                        renderContainer={this.props.renderStickyContainer}
                        getWindowCorrection={this._getCurrentWindowCorrection}
                        alwaysStickBottom = {this.props.alwaysStickyFooter} />
                ) : null}
            </View>
        );
    }

    private _rlvRowRenderer = (type: string | number, data: any, index: number, extendedState?: object): JSX.Element | JSX.Element[] | null => {
        if (this.props.alwaysStickyFooter) {
            const rlvDimension: Dimension | undefined = this._getRLVRenderedSize();
            const contentDimension: Dimension | undefined = this._getContentDimension();
            let isScrollable = false;
            if (rlvDimension && contentDimension) {
                isScrollable = contentDimension.height > rlvDimension.height;
            }
            if (!isScrollable && this.props.stickyFooterIndices
                && index === this.props.stickyFooterIndices[0]) {
                return null;
            }
        }
        return this._rowRenderer(type, data, index, extendedState);
    }

    private _getRecyclerRef = (recycler: any) => {
        this._recyclerRef = recycler as (RecyclerListView<RecyclerListViewProps, RecyclerListViewState> | undefined);
        const childRef = isReact19OrHigher ? this.props.children.props.ref : this.props.children.ref;
        if (childRef) {
            if (typeof childRef === "function") {
                childRef(recycler);
            } else {
                throw new CustomError(RecyclerListViewExceptions.refNotAsFunctionException);
            }
        }
    }

    private _getCurrentWindowCorrection = (): WindowCorrection => {
        return this._windowCorrection;
    }

    private _getStickyHeaderRef = (stickyHeaderRef: any) => {
        if (this._stickyHeaderRef !== stickyHeaderRef) {
            this._stickyHeaderRef = stickyHeaderRef as (StickyHeader<StickyObjectProps> | null);
            // TODO: Resetting state once ref is initialized. Can look for better solution.
            this._callStickyObjectsOnVisibleIndicesChanged(this._visibleIndicesAll);
        }

```

### Core Architecture Module: `src/core/ViewabilityTracker.ts`
```
import BinarySearch from "../utils/BinarySearch";
import { Dimension } from "./dependencies/LayoutProvider";
import { Layout } from "./layoutmanager/LayoutManager";
/***
 * Given an offset this utility can compute visible items. Also tracks previously visible items to compute items which get hidden or visible
 * Virtual renderer uses callbacks from this utility to main recycle pool and the render stack.
 * The utility optimizes finding visible indexes by using the last visible items. However, that can be slow if scrollToOffset is explicitly called.
 * We use binary search to optimize in most cases like while finding first visible item or initial offset. In future we'll also be using BS to speed up
 * scroll to offset.
 */
export interface Range {
    start: number;
    end: number;
}

export interface WindowCorrection {
    windowShift: number;
    startCorrection: number;
    endCorrection: number;
}

export type TOnItemStatusChanged = ((all: number[], now: number[], notNow: number[]) => void);

export default class ViewabilityTracker {
    public onVisibleRowsChanged: TOnItemStatusChanged | null;
    public onEngagedRowsChanged: TOnItemStatusChanged | null;

    private _currentOffset: number;
    private _maxOffset: number;
    private _renderAheadOffset: number;
    private _visibleWindow: Range;
    private _engagedWindow: Range;
    private _relevantDim: Range;
    private _isHorizontal: boolean;
    private _windowBound: number;
    private _visibleIndexes: number[];
    private _engagedIndexes: number[];
    private _layouts: Layout[] = [];
    private _actualOffset: number;
    private _defaultCorrection: WindowCorrection;

    constructor(renderAheadOffset: number, initialOffset: number) {
        this._currentOffset = Math.max(0, initialOffset);
        this._maxOffset = 0;
        this._actualOffset = 0;
        this._renderAheadOffset = renderAheadOffset;
        this._visibleWindow = { start: 0, end: 0 };
        this._engagedWindow = { start: 0, end: 0 };

        this._isHorizontal = false;
        this._windowBound = 0;

        this._visibleIndexes = [];  //needs to be sorted
        this._engagedIndexes = [];  //needs to be sorted

        this.onVisibleRowsChanged = null;
        this.onEngagedRowsChanged = null;

        this._relevantDim = { start: 0, end: 0 };
        this._defaultCorrection = { startCorrection: 0, endCorrection: 0, windowShift: 0 };
    }

    public init(windowCorrection: WindowCorrection): void {
        this._doInitialFit(this._currentOffset, windowCorrection);
    }

    public setLayouts(layouts: Layout[], maxOffset: number): void {
        this._layouts = layouts;
        this._maxOffset = maxOffset;
    }

    public setDimensions(dimension: Dimension, isHorizontal: boolean): void {
        this._isHorizontal = isHorizontal;
        this._windowBound = isHorizontal ? dimension.width : dimension.height;
    }

    public forceRefresh(): boolean {
        const shouldForceScroll = this._actualOffset >= 0 && this._currentOffset >= (this._maxOffset - this._windowBound);
        this.forceRefreshWithOffset(this._currentOffset);
        return shouldForceScroll;
    }

    public forceRefreshWithOffset(offset: number): void {
        this._currentOffset = -1;
        this.updateOffset(offset, false, this._defaultCorrection);
    }

    public updateOffset(offset: number, isActual: boolean, windowCorrection: WindowCorrection): void {
        let correctedOffset = offset;
        if (isActual) {
            this._actualOffset = offset;
            correctedOffset = Math.min(this._maxOffset, Math.max(0,
                offset + (windowCorrection.windowShift + windowCorrection.startCorrection)));
        }

        if (this._currentOffset !== correctedOffset) {
            this._currentOffset = correctedOffset;
            this._updateTrackingWindows(offset, windowCorrection);
            let startIndex = 0;
            if (this._visibleIndexes.length > 0) {
                startIndex = this._visibleIndexes[0];
            }
            this._fitAndUpdate(startIndex);
        }
    }

    public getLastOffset(): number {
        return this._currentOffset;
    }

    public getLastActualOffset(): number {
        return this._actualOffset;
    }

    public getEngagedIndexes(): number[] {
        return this._engagedIndexes;
    }

    public findFirstLogicallyVisibleIndex(): number {
        const relevantIndex = this._findFirstVisibleIndexUsingBS(0.001);
        let result = relevantIndex;
        for (let i = relevantIndex - 1; i >= 0; i--) {
            if (this._isHorizontal) {
                if (this._layouts[relevantIndex].x !== this._layouts[i].x) {
                    break;
                } else {
                    result = i;
                }
            } else {
                if (this._layouts[relevantIndex].y !== this._layouts[i].y) {
                    break;
                } else {
                    result = i;
                }
            }
        }
        return result;
    }

    public updateRenderAheadOffset(renderAheadOffset: number): void {
        this._renderAheadOffset = Math.max(0, renderAheadOffset);
        this.forceRefreshWithOffset(this._currentOffset);
    }

    public getCurrentRenderAheadOffset(): number {
        return this._renderAheadOffset;
    }
    public setActualOffset(actualOffset: number): void {
       this._actualOffset = actualOffset;
    }

    private _findFirstVisibleIndexOptimally(): number {
        let firstVisibleIndex = 0;

        //TODO: Talha calculate this value smartly
        if (this._currentOffset > 5000) {
            firstVisibleIndex = this._findFirstVisibleIndexUsingBS();
        } else if (this._currentOffset > 0) {
            firstVisibleIndex = this._findFirstVisibleIndexLinearly();
        }
        return firstVisibleIndex;
    }

    private _fitAndUpdate(startIndex: number): void {
        const newVisibleItems: number[] = [];
        const newEngagedItems: number[] = [];
        this._fitIndexes(newVisibleItems, newEngagedItems, startIndex, true);
        this._fitIndexes(newVisibleItems, newEngagedItems, startIndex + 1, false);
        this._diffUpdateOriginalIndexesAndRaiseEvents(newVisibleItems, newEngagedItems);
    }

    private _doInitialFit(offset: number, windowCorrection: WindowCorrection): void {
        offset = Math.min(this._maxOffset, Math.max(0, offset));
        this._updateTrackingWindows(offset, windowCorrection);
        const firstVisibleIndex = this._findFirstVisibleIndexOptimally();
        this._fitAndUpdate(firstVisibleIndex);
    }

    //TODO:Talha switch to binary search and remove atleast once logic in _fitIndexes
    private _findFirstVisibleIndexLinearly(): number {
        const count = this._layouts.length;
        let itemRect = null;
        const relevantDim = { start: 0, end: 0 };

        for (let i = 0; i < count; i++) {
            itemRect = this._layouts[i];
            this._setRelevantBounds(itemRect, relevantDim);
            if (this._itemIntersectsVisibleWindow(relevantDim.start, relevantDim.end)) {
                return i;
            }
        }
        return 0;
    }

    private _findFirstVisibleIndexUsingBS(bias = 0): number {
        const count = this._layouts.length;
        return BinarySearch.findClosestHigherValueIndex(count, this._visibleWindow.start + bias, this._valueExtractorForBinarySearch);
    }

    private _valueExtractorForBinarySearch = (index: number): number => {
        const itemRect = this._layouts[index];
        this._setRelevantBounds(itemRect, this._relevantDim);
        return this._relevantDim.end;
    }

    //TODO:Talha Optimize further in later revisions, alteast once logic can be replace with a BS lookup
    private _fitIndexes(newVisibleIndexes: number[], newEngagedIndexes: number[], startIndex: number, isReverse: boolean): void {
        const count = this._layouts.length;
        const relevantDim: Range = { start: 0, end: 0 };
     
```

### Core Architecture Module: `src/core/VirtualRenderer.ts`
```
import RecycleItemPool from "../utils/RecycleItemPool";
import { Dimension, BaseLayoutProvider } from "./dependencies/LayoutProvider";
import CustomError from "./exceptions/CustomError";
import RecyclerListViewExceptions from "./exceptions/RecyclerListViewExceptions";
import { Point, LayoutManager } from "./layoutmanager/LayoutManager";
import ViewabilityTracker, { TOnItemStatusChanged, WindowCorrection } from "./ViewabilityTracker";
import { ObjectUtil, Default } from "ts-object-utils";
import TSCast from "../utils/TSCast";
import { BaseDataProvider } from "./dependencies/DataProvider";

/***
 * Renderer which keeps track of recyclable items and the currently rendered items. Notifies list view to re render if something changes, like scroll offset
 */
export interface RenderStackItem {
    dataIndex?: number;
}
export interface StableIdMapItem {
    key: string;
    type: string | number;
}
export interface RenderStack { [key: string]: RenderStackItem; }

export interface RenderStackParams {
    isHorizontal?: boolean;
    itemCount: number;
    initialOffset?: number;
    initialRenderIndex?: number;
    renderAheadOffset?: number;
}

export type StableIdProvider = (index: number) => string;

export default class VirtualRenderer {

    private onVisibleItemsChanged: TOnItemStatusChanged | null;

    private _scrollOnNextUpdate: (point: Point) => void;
    private _stableIdToRenderKeyMap: { [key: string]: StableIdMapItem | undefined };
    private _engagedIndexes: { [key: number]: number | undefined };
    private _renderStack: RenderStack;
    private _renderStackChanged: (renderStack: RenderStack) => void;
    private _fetchStableId: StableIdProvider;
    private _isRecyclingEnabled: boolean;
    private _isViewTrackerRunning: boolean;
    private _markDirty: boolean;
    private _startKey: number;
    private _layoutProvider: BaseLayoutProvider = TSCast.cast<BaseLayoutProvider>(null); //TSI
    private _recyclePool: RecycleItemPool = TSCast.cast<RecycleItemPool>(null); //TSI

    private _params: RenderStackParams | null;
    private _layoutManager: LayoutManager | null = null;
    private _viewabilityTracker: ViewabilityTracker | null = null;
    private _dimensions: Dimension | null;
    private _optimizeForAnimations: boolean = false;

    constructor(renderStackChanged: (renderStack: RenderStack) => void,
                scrollOnNextUpdate: (point: Point) => void,
                fetchStableId: StableIdProvider,
                isRecyclingEnabled: boolean) {
        //Keeps track of items that need to be rendered in the next render cycle
        this._renderStack = {};

        this._fetchStableId = fetchStableId;

        //Keeps track of keys of all the currently rendered indexes, can eventually replace renderStack as well if no new use cases come up
        this._stableIdToRenderKeyMap = {};
        this._engagedIndexes = {};
        this._renderStackChanged = renderStackChanged;
        this._scrollOnNextUpdate = scrollOnNextUpdate;
        this._dimensions = null;
        this._params = null;
        this._isRecyclingEnabled = isRecyclingEnabled;

        this._isViewTrackerRunning = false;
        this._markDirty = false;

        //Would be surprised if someone exceeds this
        this._startKey = 0;

        this.onVisibleItemsChanged = null;
    }

    public getLayoutDimension(): Dimension {
        if (this._layoutManager) {
            return this._layoutManager.getContentDimension();
        }
        return { height: 0, width: 0 };
    }

    public setOptimizeForAnimations(shouldOptimize: boolean): void {
        this._optimizeForAnimations = shouldOptimize;
    }

    public hasPendingAnimationOptimization(): boolean {
        return this._optimizeForAnimations;
    }

    public updateOffset(offsetX: number, offsetY: number, isActual: boolean, correction: WindowCorrection): void {
        if (this._viewabilityTracker) {
            const offset = this._params && this._params.isHorizontal ? offsetX : offsetY;
            if (!this._isViewTrackerRunning) {
                if (isActual) {
                    this._viewabilityTracker.setActualOffset(offset);
                }
                this.startViewabilityTracker(correction);
            }
            this._viewabilityTracker.updateOffset(offset, isActual, correction);
        }
    }

    public attachVisibleItemsListener(callback: TOnItemStatusChanged): void {
        this.onVisibleItemsChanged = callback;
    }

    public removeVisibleItemsListener(): void {
        this.onVisibleItemsChanged = null;

        if (this._viewabilityTracker) {
            this._viewabilityTracker.onVisibleRowsChanged = null;
        }
    }

    public getLayoutManager(): LayoutManager | null {
        return this._layoutManager;
    }

    public setParamsAndDimensions(params: RenderStackParams, dim: Dimension): void {
        this._params = params;
        this._dimensions = dim;
    }

    public setLayoutManager(layoutManager: LayoutManager): void {
        this._layoutManager = layoutManager;
        if (this._params) {
            this._layoutManager.relayoutFromIndex(0, this._params.itemCount);
        }
    }

    public setLayoutProvider(layoutProvider: BaseLayoutProvider): void {
        this._layoutProvider = layoutProvider;
    }

    public getViewabilityTracker(): ViewabilityTracker | null {
        return this._viewabilityTracker;
    }

    public refreshWithAnchor(): void {
        if (this._viewabilityTracker) {
            let firstVisibleIndex = this._viewabilityTracker.findFirstLogicallyVisibleIndex();
            this._prepareViewabilityTracker();
            let offset = 0;
            if (this._layoutManager && this._params) {
                firstVisibleIndex = Math.min(this._params.itemCount - 1, firstVisibleIndex);
                const point = this._layoutManager.getOffsetForIndex(firstVisibleIndex);
                this._scrollOnNextUpdate(point);
                offset = this._params.isHorizontal ? point.x : point.y;
            }
            this._viewabilityTracker.forceRefreshWithOffset(offset);
        }
    }

    public refresh(): void {
        if (this._viewabilityTracker) {
            this._prepareViewabilityTracker();
            this._viewabilityTracker.forceRefresh();
        }
    }

    public getInitialOffset(): Point {
        let offset = { x: 0, y: 0 };
        if (this._params) {
            const initialRenderIndex = Default.value<number>(this._params.initialRenderIndex, 0);
            if (initialRenderIndex > 0 && this._layoutManager) {
                offset = this._layoutManager.getOffsetForIndex(initialRenderIndex);
                this._params.initialOffset = this._params.isHorizontal ? offset.x : offset.y;
            } else {
                if (this._params.isHorizontal) {
                    offset.x = Default.value<number>(this._params.initialOffset, 0);
                    offset.y = 0;
                } else {
                    offset.y = Default.value<number>(this._params.initialOffset, 0);
                    offset.x = 0;
                }
            }
        }
        return offset;
    }

    public init(): void {
        this.getInitialOffset();
        this._recyclePool = new RecycleItemPool();
        if (this._params) {
            this._viewabilityTracker = new ViewabilityTracker(
                Default.value<number>(this._params.renderAheadOffset, 0),
                Default.value<number>(this._params.initialOffset, 0));
        } else {
            this._viewabilityTracker = new ViewabilityTracker(0, 0);
        }
        this._prepareViewabilityTracker();
    }

    public startViewabilityTracker(windowCorrection: WindowCorrection): void {
        if (this._viewabilityTracker) {
            this._isViewTrackerRunning = true;
            this._viewabilityTracker.init(windowCorrection);
        }
    }

    public syncAndGetKey(index: number, overrideStableIdProvider?: StableIdProvider,
                     
```

### Core Architecture Module: `src/core/constants/Constants.ts`
```
export const Constants = {
    CONTEXT_PROVIDER_OFFSET_KEY_SUFFIX : "_offset",
    CONTEXT_PROVIDER_LAYOUT_KEY_SUFFIX: "_layouts",
};

```

### Core Architecture Module: `src/core/constants/Messages.ts`
```
export const Messages = {
    ERROR_LISTVIEW_VALIDATION : "missing datasource or layout provider, cannot proceed without it",
    WARN_SCROLL_TO_INDEX: "scrollTo was called before RecyclerListView was measured, please wait for the mount to finish",
    VISIBLE_INDEXES_CHANGED_DEPRECATED: "onVisibleIndexesChanged deprecated. Please use onVisibleIndicesChanged instead.",
    ANIMATION_ON_PAGINATION: "Looks like you're trying to use RecyclerListView's layout animation render while doing pagination. " +
                             "This operation will be ignored to avoid creation of too many items due to developer error.",
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #178** (2019-10-24): **initialRenderIndex broke rendering elements when height is enough to show all of them**
  *Symptoms*: ### How to reproduce:  1.  Generate small list of elements (here in repo 3 items) 2.  Open the browser window with enough heigh to display all items 3.  Set up any initialRenderIndex different than 0 (1,2)  ### Expected results:  All items displayed.  ### Actual results:  No one element rendered  ### Screenshots  https://monosnap.com/file/rLQjgBXDla3I67yYVIHNOWX0LCZAND - normal page, height not enough https://monosnap.com/file/IooCvMWVxPyaHgm5ouTOSMadNYV1KP - blank page, when height is enough  ---  [Demo repo](https://github.com/maxfarseer/recyclerlistview-initialRenderIndex-bug)  [Codesandbox](https://codesandbox.io/s/p3x3w4n45x)
  **Post-Mortem & Fix Analysis**:
  > Can you provide a sample on codesandbox.io for me to check? That will help me look into this ASAP.
  > @naqvitalha issue updated with link to codesandbox.
  > Ah! Indeed it's bug :( RLV expects a scroll event to trigger render in case of explicit offset. Which won't happen here. Can you avoid giving an explicit index when items are few? I will try to fix this ASAP.

- **Issue #83** (2018-01-09): **onVisibleIndexesChanged misbehaves when a ViewType is taller than the window's height**
  *Symptoms*: I'm getting wrong values from onVisibleIndexesChanged. It's returning an empty array sometimes.  I reproduced it in a snack. https://snack.expo.io/@abdallamohamed/recyclerlistview-onvisibleindexeschanged-bug  You can see the bug when you're scrolling through the list.  ![nov-29-2017 15-48-11](https://user-images.githubusercontent.com/10912145/33380920-de7ea252-d51c-11e7-903c-02a7d2c50006.gif) 
  **Post-Mortem & Fix Analysis**:
  > I looked at your expo sample, I actually noticed something strange. The bottom `<Text/>` is inside a `<ScrollView/>` and when the page renders the listview is mounted with a much smaller height and then it resizes. I guess it has something to do with how ScrollView's layout happens. If I change that to a `<View/>` it works fine. Link: https://snack.expo.io/rkPNZu2ez  For RecyclerListView to handle height changes `canChangeSize` needs to be set to `true`.  But the title of this issue is the right one, `ViewabilityTracker` will mess up visibility callbacks if  item size is larger than the window. I'll mark this as a bug, nice catch!
  > My bad, I was going to have the bottom scrollview as a log where I keep adding more lines for every time the onVisibleIndexesChanged callback is fired, but then I just decided to replace the text instead of appending to it.  For now, I made sure that none of my view types have a height larger than the window height. As a workaround until the bug is fixed.   And by the way, I'm considering supporting both screen orientations in my app soon. Does that mean I need to set canChangeSize to true for the RecyclerListView so that it handles screen height changes? 
  > @AbdallaMohamed Yes you'll have to set `canChangeSize={true}`. The best part about orientation changes with RecyclerListView is that your firstVisibleIndex will get preserved automatically!

- **Issue #73** (2017-11-16): **onVisibleIndexesChanged returns wrong values when initialRenderIndex is provided**
  *Symptoms*: I've been trying to utilize both the `onVisibleIndexesChanged` and `initialRenderIndex` props at the same time, but I'm facing a weird behaviour that I'm not sure if it's intended to be that way.  When I provide an `initialRenderIndex` value of 10, `onVisibleIndexesChanged` is fired first with the values `[0, 1, 2, 3, ...]` and then it's fired again with the correct values `[9, 10, 11, 12, 13, ...]`  I've reproduced in this snack https://snack.expo.io/ByBPIAtyM  Has it been implemented that way on purpose? And if so, what workaround would you guys suggest? 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting the issue. Definitely not what was intended. This is regression bug :( I've fixed this in 1.2.0-beta.6. Will close once it is released.
  > Just switched to `1.2.0-beta.6` and it's fixed! 👍 

- **Issue #62** (2017-11-20): **Cannot read property 'getLayoutDimension' of undefined**
  *Symptoms*: If I initially load a page before having data, returning an empty page(null/<Text>No Data</Text>) then fetch data from server after component mounted and set the data for data provider to my new data this error is produced at VirtualRenderer.getLayoutDimension.   On IOS it imediatly displays the "'getLayoutDimension' of undefined" error while on android the red screen displays 'Node has not been attached to a view' and the getLayoutDimension goes as a warning in background and on Debug console.  Commenting out the onEndReached property makes the problem stop.  I have tried to reproduce the error on snack/expo, but it does not reproduce the same error. On snack/expo it sometimes just work and other times expo just crashes.  Link to example:  https://snack.expo.io/ryy4QxFRZ
  **Post-Mortem & Fix Analysis**:
  > after moving all the components out of node_modules and putting some console logs in I found that this._layoutManager in VirtualRenderer is in fact undefined at this point   Adjusting the _processOnEndReached() in RecyclerListView to   if (this.props.onEndReached && this._virtualRenderer && this._virtualRenderer.getLayoutManager()) from   if (this.props.onEndReached && this._virtualRenderer) solved the problem. If this solution suites you could you please adjust it in the next update?
  > Hey,  We are aware of the Null Pointer Exception here. We will be fixing it in a release soon. In the meanwhile, can you please make sure you mount the view after you have the data? That will help avoid the NPE while we roll out a fix in a few days.  Let us know if this helps. Thanks for the feedback :)
  > +1

- **Issue #58** (2017-11-20): **Portrait/Landscape rotation - resize issue**
  *Symptoms*: When I rotate the device the cells are upgraded their size only when I scroll, and not on rotation. I've set the canChangeSize={true} props, the _layoutProvider is called once the device is rotated with the right new sizes, but the cell width is expanded or reduced only after some scrolling.
  **Post-Mortem & Fix Analysis**:
  > I just looked at the code, looks like it's a regression. Inside `VirtualRenderer` we now check if `renderStackHasChanged` or not. In this case it doesn't change so the refresh doesn't occur.  We'll try to fix it in the next release. For now you can manually refresh. Wrap recycler in a view to detect orientation change and when it is detected call _refreshViewability on ref of RecyclerListView. That will do it. Code:  ```js  _onLayout = e => {         let orientation = null;         if (e.nativeEvent.layout.width > e.nativeEvent.layout.height) {             orientation = "L";         } else {             orientation = "P";         }         if (this.orientation != orientation) {             this.orientation = orientation;             if (this.recyclerRef) {                 //Making sure all compute is done before using setTimeout                 setTimeout(() => this.recyclerRef._refreshViewability(), 0);             }         }     };      render() {         retur
  > Thank you very much with this fix it works! Thank you!
  > Great! Glad that it worked out. Anyways, the release after the next one will have this fix in core code itself. I'll close this once that is done.

- **Issue #34** (2018-01-12): **scrollToIndex leads to inconsistent onVisibleIndexes changed callback**
  *Symptoms*: If scrollToIndex is called on the ListView with let's say 5, the subsequent onVisibleIndexesChanged callback also has the value 4 in the all parameter. This might lead to problems in some cases like a calender etc.
  **Post-Mortem & Fix Analysis**:
  > Fixed in `v1.2.6`

- **Issue #3** (2017-11-20): **On iOS changing orientation or dimensions sometimes renders blank items**
  *Symptoms*: Everything gets fixed on doing even a minor scroll.
  **Post-Mortem & Fix Analysis**:
  > Fixed in v1.2.0

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

### Incident Patch 1: `281b3c43` (2025-03-13)
**Commit Message**: Fix: Update ref handling in StickyContainer for React 19 compatibility (#791)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "recyclerlistview",
-  "version": "4.2.1",
+  "version": "4.2.2",
   "description": "The listview that you need and deserve. It was built for performance, uses cell recycling to achieve smooth scrolling.",
   "main": "dist/reactnative/index.js",
   "types": "dist/reactnative/index.d.ts",
```

**File**: `src/core/StickyContainer.tsx` (modified, +4/-3)
```diff
@@ -126,9 +126,10 @@ export default class StickyContainer<P extends StickyContainerProps> extends Com
 
     private _getRecyclerRef = (recycler: any) => {
         this._recyclerRef = recycler as (RecyclerListView<RecyclerListViewProps, RecyclerListViewState> | undefined);
-        if (this.props.children.ref) {
-            if (typeof this.props.children.ref === "function") {
-                (this.props.children).ref(recycler);
+        const childRef = this.props.children.props.ref || this.props.children.ref;
+        if (childRef) {
+            if (typeof childRef === "function") {
+                childRef(recycler);
             } else {
                 throw new CustomError(RecyclerListViewExceptions.refNotAsFunctionException);
             }
```

---

### Incident Patch 2: `f2bdac46` (2024-06-10)
**Commit Message**: Bugfix(layoutSize) fix item not render after initial data size is empty (#781)

* Bugfix(layoutSize) fix item not render after initial data size is empty

if layoutSize is provided, items doesn't render if the initial data size is empty.

add new function to componentCompact to allow extended component to had access to the _hasRenderOnce

only assign the state is the component never get render before

* bugfix(layout):fix layout issue where layout manager keep previous total hight

**File**: `package.json` (modified, +4/-4)
```diff
@@ -43,13 +43,13 @@
     "react-native": ">= 0.30.0"
   },
   "devDependencies": {
-    "@types/lodash.debounce": "4.0.3",
+    "@types/lodash.debounce": "4.0.8",
     "@types/prop-types": "15.5.2",
-    "@types/react-native": "0.49.5",
     "@types/react": "16.4.7",
-    "@types/resize-observer-browser": "^0.1.7",
+    "@types/react-native": "0.49.5",
+    "@types/resize-observer-browser": "0.1.7",
     "file-directives": "1.4.6",
     "tslint": "5.11.0",
-    "typescript": "3.3.1"
+    "typescript": "4.9.5"
   }
 }
```

**File**: `src/core/RecyclerListView.tsx` (modified, +7/-1)
```diff
@@ -589,7 +589,13 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
     }
 
     private _initStateIfRequired(stack?: RenderStack): boolean {
-        if (!this.state) {
+        /**
+         * this is to ensure that if the component does not has state and not render before
+         * we still initialize the state like how we do in constructor.
+         * else return false to let the caller to call setState
+         * so the component can re-render to the correct stack
+         */
+        if (!this.state && !this.getHasRenderedOnce()) {
             this.state = {
                 internalSnapshot: {},
                 renderStack: stack,
```

**File**: `src/core/layoutmanager/LayoutManager.ts` (modified, +12/-0)
```diff
@@ -74,6 +74,18 @@ export class WrapGridLayoutManager extends LayoutManager {
     public getContentDimension(): Dimension {
         return { height: this._totalHeight, width: this._totalWidth };
     }
+    /**
+     * when remove layout is called, it will remove the layout from the layouts array
+     * and if the layouts array is empty, it will reset the total height and total width to 0
+     * @param index
+     */
+     public removeLayout(index: number): void {
+        super.removeLayout(index);
+        if (this._layouts.length === 0) {
+            this._totalHeight = 0;
+            this._totalWidth = 0;
+        }
+    }
 
     public getLayouts(): Layout[] {
         return this._layouts;
```

**File**: `src/utils/ComponentCompat.ts` (modified, +8/-0)
```diff
@@ -16,6 +16,14 @@ export abstract class ComponentCompat<T1 = {}, T2 = {}, SS = any> extends React.
         return true;
     }
 
+    /**
+     * allow the extended component to access _hasRenderedOnce flag
+     * to ensure that the component has rendered at least once
+     * @returns _hasRenderedOnce
+     */
+    public getHasRenderedOnce(): boolean {
+        return this._hasRenderedOnce;
+    }
     //setState inside will not update the existing cycle, not a true replacement for componentWillReceiveProps
     public componentWillReceivePropsCompat(newProps: T1): void {
         //no op
```

---

### Incident Patch 3: `0d182f92` (2022-09-17)
**Commit Message**: Fix stable id extra compute and proptypes (#743)

**File**: `src/core/RecyclerListView.tsx` (modified, +1/-1)
```diff
@@ -821,7 +821,7 @@ RecyclerListView.propTypes = {
     //Provide your own ScrollView Component. The contract for the scroll event should match the native scroll event contract, i.e.
     // scrollEvent = { nativeEvent: { contentOffset: { x: offset, y: offset } } }
     //Note: Please extend BaseScrollView to achieve expected behaviour
-    externalScrollView: PropTypes.func,
+    externalScrollView: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
 
     //Callback given when user scrolls to the end of the list or footer just becomes visible, useful in incremental loading scenarios
     onEndReached: PropTypes.func,
```

**File**: `src/core/dependencies/DataProvider.ts` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ export abstract class BaseDataProvider {
     //No need to override this one
     //If you already know the first row where rowHasChanged will be false pass it upfront to avoid loop
     public cloneWithRows(newData: any[], firstModifiedIndex?: number): DataProvider {
-        const dp = this.newInstance(this.rowHasChanged, this.getStableId);
+        const dp = this.newInstance(this.rowHasChanged, this._hasStableIds ? this.getStableId : undefined);
         const newSize = newData.length;
         const iterCount = Math.min(this._size, newSize);
         if (ObjectUtil.isNullOrUndefined(firstModifiedIndex)) {
```

---

### Incident Patch 4: `3a3ac027` (2022-08-02)
**Commit Message**: Fix NPE

**File**: `src/core/RecyclerListView.tsx` (modified, +5/-3)
```diff
@@ -739,9 +739,11 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
 
     private _generateRenderStack(): Array<JSX.Element | null> {
         const renderedItems = [];
-        for (const key in this.state.renderStack) {
-            if (this.state.renderStack.hasOwnProperty(key)) {
-                renderedItems.push(this._renderRowUsingMeta(this.state.renderStack[key]));
+        if (this.state) {
+            for (const key in this.state.renderStack) {
+                if (this.state.renderStack.hasOwnProperty(key)) {
+                    renderedItems.push(this._renderRowUsingMeta(this.state.renderStack[key]));
+                }
             }
         }
         return renderedItems;
```

---

### Incident Patch 5: `b844c0ba` (2022-07-12)
**Commit Message**: Fix arbitrary stop calls on JS item animator (#728)

* fix arbitrary stop calls on animator

* Update publish-local.sh

**File**: `scripts/publish-local.sh` (modified, +1/-1)
```diff
@@ -10,4 +10,4 @@ echo "copying to $TARGET.."
 rm -rf "$TARGET"
 cp -r dist "$TARGET"
 
-echo "copy complete."
\ No newline at end of file
+echo "copy complete."
```

**File**: `src/core/ItemAnimator.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export default interface ItemAnimator {
 }
 
 export class BaseItemAnimator implements ItemAnimator {
-    public static USE_NATIVE_DRIVER = true;
+    public static USE_NATIVE_DRIVER = false;
     public animateWillMount(atX: number, atY: number, itemIndex: number): object | undefined {
         return undefined;
     }
```

**File**: `src/platform/reactnative/itemanimators/defaultjsanimator/DefaultJSItemAnimator.ts` (modified, +10/-12)
```diff
@@ -25,16 +25,24 @@ export class DefaultJSItemAnimator extends BaseItemAnimator {
     }
 
     public animateWillUpdate(fromX: number, fromY: number, toX: number, toY: number, itemRef: object, itemIndex: number): void {
-        this._hasAnimatedOnce = true;
+        //no need
     }
 
     public animateShift(fromX: number, fromY: number, toX: number, toY: number, itemRef: object, itemIndex: number): boolean {
+        if (!this._isTimerOn) {
+            this._isTimerOn = true;
+            if (!this._hasAnimatedOnce) {
+                setTimeout(() => {
+                    this._hasAnimatedOnce = true;
+                }, 700);
+            }
+        }
         if (fromX !== toX || fromY !== toY) {
             if (!this.shouldAnimateOnce || this.shouldAnimateOnce && !this._hasAnimatedOnce) {
                 const viewRef = itemRef as UnmountAwareView;
                 const animXY = new Animated.ValueXY({ x: fromX, y: fromY });
                 animXY.addListener((value) => {
-                    if (viewRef._isUnmountedForRecyclerListView || (this.shouldAnimateOnce && this._hasAnimatedOnce)) {
+                    if (viewRef._isUnmountedForRecyclerListView) {
                         animXY.stopAnimation();
                         return;
                     }
@@ -51,19 +59,9 @@ export class DefaultJSItemAnimator extends BaseItemAnimator {
                     useNativeDriver: BaseItemAnimator.USE_NATIVE_DRIVER,
                 }).start(() => {
                     viewRef._lastAnimVal = null;
-                    this._hasAnimatedOnce = true;
                 });
                 return true;
             }
-        } else {
-            if (!this._isTimerOn) {
-                this._isTimerOn = true;
-                if (!this._hasAnimatedOnce) {
-                    setTimeout(() => {
-                        this._hasAnimatedOnce = true;
-                    }, 1000);
-                }
-            }
         }
         return false;
     }
```

---

### Incident Patch 6: `37d992cc` (2022-07-04)
**Commit Message**: fix: optional chaining for clearAll (#725)

* fix: optional chaining for clearAll

* Update VirtualRenderer.ts

* Update VirtualRenderer.ts

**File**: `src/core/VirtualRenderer.ts` (modified, +2/-2)
```diff
@@ -263,9 +263,9 @@ export default class VirtualRenderer {
         const newRenderStack: RenderStack = {};
         const keyToStableIdMap: { [key: string]: string } = {};
 
-        // Do not use recycle pool so that elements don't fly top to bottom or vice version
+        // Do not use recycle pool so that elements don't fly top to bottom or vice versa
         // Doing this is expensive and can draw extra items
-        if (this._optimizeForAnimations) {
+        if (this._optimizeForAnimations && this._recyclePool) {
             this._recyclePool.clearAll();
         }
 
```

---

### Incident Patch 7: `90457e02` (2022-04-05)
**Commit Message**: Fix no op set state (#706)

Co-authored-by: Talha Naqvi <talha.naqvi@shopify.com>

**File**: `src/core/ProgressiveListView.tsx` (modified, +17/-11)
```diff
@@ -10,7 +10,7 @@ export interface ProgressiveListViewProps extends RecyclerListViewProps {
     finalRenderAheadOffset?: number;
 }
 /**
- * This will incremently update renderAhread distance and render the page progressively.
+ * This will incrementally update renderAhead distance and render the page progressively.
  * renderAheadOffset = initial value which will be incremented
  * renderAheadStep = amount of increment made on each frame
  * maxRenderAhead = maximum value for render ahead at the end of update cycle
@@ -23,31 +23,36 @@ export default class ProgressiveListView extends RecyclerListView<ProgressiveLis
         renderAheadStep: 300,
         renderAheadOffset: 0,
     };
-    private renderAheadUdpateCallbackId?: number;
+    private renderAheadUpdateCallbackId?: number;
     private isFirstLayoutComplete: boolean = false;
 
     public componentDidMount(): void {
         super.componentDidMount();
         if (!this.props.forceNonDeterministicRendering) {
-            this.updateRenderAheadProgessively(this.getCurrentRenderAheadOffset());
+            this.updateRenderAheadProgressively(this.getCurrentRenderAheadOffset());
         }
     }
 
+    public componentWillUnmount(): void {
+        this.cancelRenderAheadUpdate();
+        super.componentWillUnmount();
+    }
+
     protected onItemLayout(index: number): void {
         if (!this.isFirstLayoutComplete) {
             this.isFirstLayoutComplete = true;
             if (this.props.forceNonDeterministicRendering) {
-                this.updateRenderAheadProgessively(this.getCurrentRenderAheadOffset());
+                this.updateRenderAheadProgressively(this.getCurrentRenderAheadOffset());
             }
         }
         super.onItemLayout(index);
     }
 
-    private updateRenderAheadProgessively(newVal: number): void {
+    private updateRenderAheadProgressively(newVal: number): void {
         this.cancelRenderAheadUpdate(); // Cancel any pending callback.
-        this.renderAheadUdpateCallbackId = requestAnimationFrame(() => {
+        this.renderAheadUpdateCallbackId = requestAnimationFrame(() => {
             if (!this.updateRenderAheadOffset(newVal)) {
-                this.updateRenderAheadProgessively(newVal);
+                this.updateRenderAheadProgressively(newVal);
             } else {
                 this.incrementRenderAhead();
             }
@@ -63,7 +68,7 @@ export default class ProgressiveListView extends RecyclerListView<ProgressiveLis
                 const maxContentSize = this.props.isHorizontal ? contentDimension.width : contentDimension.height;
                 if (currentRenderAheadOffset < maxContentSize && currentRenderAheadOffset < this.props.maxRenderAhead) {
                     const newRenderAheadOffset = currentRenderAheadOffset + this.props.renderAheadStep;
-                    this.updateRenderAheadProgessively(newRenderAheadOffset);
+                    this.updateRenderAheadProgressively(newRenderAheadOffset);
                 } else {
                     this.performFinalUpdate();
                 }
@@ -72,16 +77,17 @@ export default class ProgressiveListView extends RecyclerListView<ProgressiveLis
     }
 
     private performFinalUpdate(): void {
-        requestAnimationFrame(() => {
+        this.cancelRenderAheadUpdate(); // Cancel any pending callback.
+        this.renderAheadUpdateCallbackId = requestAnimationFrame(() => {
         if (this.props.finalRenderAheadOffset !== undefined) {
                 this.updateRenderAheadOffset(this.props.finalRenderAheadOffset);
             }
         });
     }
 
     private cancelRenderAheadUpdate(): void {
-        if (this.renderAheadUdpateCallbackId) {
-            cancelAnimationFrame(this.renderAheadUdpateCallbackId);
+        if (this.renderAheadUpdateCallbackId !== undefined) {
+            cancelAnimationFrame(this.renderAheadUpdateCallbackId);
         }
     }
 }
```

---

### Incident Patch 8: `9f1c9e9e` (2022-03-21)
**Commit Message**: Fix offset when applyWindowCorrection is used (#699)

* Accounting for correcting in scroll requests

* clearing stable id map to avoid collisions

* Fixes stable id and introduces new API for layout animations

* modifying existing method instead of a new one

* Added warning if animations render is requested on pagination

* updated docs

* adding correction config

* handled item scroll

* exported types

* fix bring to focus

Co-authored-by: Talha Naqvi <talha.naqvi@shopify.com>

**File**: `README.md` (modified, +1/-0)
```diff
@@ -108,6 +108,7 @@ In case you cannot determine heights of items in advance just set `forceNonDeter
 | scrollViewProps | No | object | For all props that need to be proxied to inner/external scrollview. Put them in an object and they'll be spread and passed down. |
 | layoutSize | No | Dimension | Will prevent the initial empty render required to compute the size of the listview and use these dimensions to render list items in the first render itself. This is useful for cases such as server side rendering. The prop canChangeSize has to be set to true if the size can be changed after rendering. Note that this is not the scroll view size and is used solely for layouting. |
 | onItemLayout | No | number | A callback function that is executed when an item of the recyclerListView (at an index) has been layout. This can also be used as a proxy to itemsRendered kind of callbacks. |
+| windowCorrectionConfig | No | object | Used to specify is window correction config and whether it should be applied to some scroll events |
 
 For full feature set have a look at prop definitions of [RecyclerListView](https://github.com/Flipkart/recyclerlistview/blob/21049cc89ad606ec9fe8ea045dc73732ff29eac9/src/core/RecyclerListView.tsx#L540-L634)
 (bottom of the file). All `ScrollView` features like `RefreshControl` also work out of the box.
```

**File**: `src/core/RecyclerListView.tsx` (modified, +41/-10)
```diff
@@ -112,13 +112,20 @@ export interface RecyclerListViewProps {
     scrollViewProps?: object;
     applyWindowCorrection?: (offsetX: number, offsetY: number, windowCorrection: WindowCorrection) => void;
     onItemLayout?: (index: number) => void;
+    windowCorrectionConfig?: { value?: WindowCorrection, applyToInitialOffset?: boolean, applyToItemScroll?: boolean };
 }
 
 export interface RecyclerListViewState {
     renderStack: RenderStack;
     internalSnapshot: Record<string, object>;
 }
 
+export interface WindowCorrectionConfig {
+    value: WindowCorrection;
+    applyToInitialOffset: boolean;
+    applyToItemScroll: boolean;
+}
+
 export default class RecyclerListView<P extends RecyclerListViewProps, S extends RecyclerListViewState> extends ComponentCompat<P, S> {
     public static defaultProps = {
         canChangeSize: false,
@@ -155,7 +162,7 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
     private _initialOffset = 0;
     private _cachedLayouts?: Layout[];
     private _scrollComponent: BaseScrollComponent | null = null;
-    private _windowCorrection: WindowCorrection;
+    private _windowCorrectionConfig: WindowCorrectionConfig;
 
     //If the native content container is used, then positions of the list items are changed on the native side. The animated library used
     //by the default item animator also changes the same positions which could lead to inconsistency. Hence, the base item animator which
@@ -170,9 +177,25 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
             return this.props.dataProvider.getStableId(index);
         }, !props.disableRecycling);
 
-        this._windowCorrection = {
-            startCorrection: 0, endCorrection: 0, windowShift: 0,
-        };
+        if (this.props.windowCorrectionConfig) {
+            let windowCorrection;
+            if (this.props.windowCorrectionConfig.value) {
+                windowCorrection = this.props.windowCorrectionConfig.value;
+            } else {
+                windowCorrection = {  startCorrection: 0, endCorrection: 0, windowShift: 0  };
+            }
+            this._windowCorrectionConfig = {
+                applyToItemScroll: !!this.props.windowCorrectionConfig.applyToItemScroll,
+                applyToInitialOffset: !!this.props.windowCorrectionConfig.applyToInitialOffset,
+                value: windowCorrection,
+             };
+        } else {
+            this._windowCorrectionConfig = {
+                applyToItemScroll: false,
+                applyToInitialOffset: false,
+                value: { startCorrection: 0, endCorrection: 0, windowShift: 0 },
+             };
+        }
         this._getContextFromContextProvider(props);
         if (props.layoutSize) {
             this._layout.height = props.layoutSize.height;
@@ -241,7 +264,7 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
         const layoutManager = this._virtualRenderer.getLayoutManager();
         if (layoutManager) {
             const offsets = layoutManager.getOffsetForIndex(index);
-            this.scrollToOffset(offsets.x, offsets.y, animate);
+            this.scrollToOffset(offsets.x, offsets.y, animate, this._windowCorrectionConfig.applyToItemScroll);
         } else {
             console.warn(Messages.WARN_SCROLL_TO_INDEX); //tslint:disable-line
         }
@@ -255,7 +278,7 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
     public bringToFocus(index: number, animate?: boolean): void {
         const listSize = this.getRenderedSize();
         const itemLayout = this.getLayout(index);
-        const currentScrollOffset = this.getCurrentScrollOffset();
+        const currentScrollOffset = this.getCurrentScrollOffset() + this._windowCorrectionConfig.value.windowShift;
         const {isHorizontal} = this.props;
         if (itemLayout) {
             const mainAxisLayoutDimen = isHorizontal ?
```

**File**: `src/index.ts` (modified, +4/-1)
```diff
@@ -2,7 +2,7 @@ import ContextProvider from "./core/dependencies/ContextProvider";
 import DataProvider, { BaseDataProvider } from "./core/dependencies/DataProvider";
 import { BaseLayoutProvider, Dimension, LayoutProvider } from "./core/dependencies/LayoutProvider";
 import { GridLayoutProvider } from "./core/dependencies/GridLayoutProvider";
-import RecyclerListView, { OnRecreateParams, RecyclerListViewProps } from "./core/RecyclerListView";
+import RecyclerListView, { OnRecreateParams, RecyclerListViewProps, WindowCorrectionConfig } from "./core/RecyclerListView";
 import BaseScrollView from "./core/scrollcomponent/BaseScrollView";
 import { BaseItemAnimator } from "./core/ItemAnimator";
 import { AutoScroll } from "./utils/AutoScroll";
@@ -11,6 +11,7 @@ import { GridLayoutManager } from "./core/layoutmanager/GridLayoutManager";
 import ProgressiveListView from "./core/ProgressiveListView";
 import { DebugHandlers } from "./core/devutils/debughandlers/DebugHandlers";
 import { ComponentCompat } from "./utils/ComponentCompat";
+import { WindowCorrection } from "./core/ViewabilityTracker";
 
 export {
     ContextProvider,
@@ -34,4 +35,6 @@ export {
     DebugHandlers,
     BaseDataProvider,
     ComponentCompat,
+    WindowCorrection,
+    WindowCorrectionConfig,
 };
```

---

### Incident Patch 9: `3f9a4f44` (2022-03-21)
**Commit Message**: Fix stable id collisions and provide alternate for optimiseForInsertDeleteAnimations (#696)

* clearing stable id map to avoid collisions

* Fixes stable id and introduces new API for layout animations

* Added warning if animations render is requested on pagination

* updated docs

Co-authored-by: Talha Naqvi <talha.naqvi@shopify.com>

**File**: `README.md` (modified, +0/-1)
```diff
@@ -104,7 +104,6 @@ In case you cannot determine heights of items in advance just set `forceNonDeter
 | forceNonDeterministicRendering | No | boolean | Default is false; if enabled dimensions provided in layout provider will not be strictly enforced. Use this if item dimensions cannot be accurately determined |
 | extendedState | No | object | In some cases the data passed at row level may not contain all the info that the item depends upon, you can keep all other info outside and pass it down via this prop. Changing this object will cause everything to re-render. Make sure you don't change it often to ensure performance. Re-renders are heavy. |
 | itemAnimator | No | ItemAnimator | Enables animating RecyclerListView item cells (shift, add, remove, etc) |
-| optimizeForInsertDeleteAnimations | No | boolean | Enables you to utilize layout animations better by unmounting removed items |
 | style | No | object | To pass down style to inner ScrollView |
 | scrollViewProps | No | object | For all props that need to be proxied to inner/external scrollview. Put them in an object and they'll be spread and passed down. |
 | layoutSize | No | Dimension | Will prevent the initial empty render required to compute the size of the listview and use these dimensions to render list items in the first render itself. This is useful for cases such as server side rendering. The prop canChangeSize has to be set to true if the size can be changed after rendering. Note that this is not the scroll view size and is used solely for layouting. |
```

**File**: `src/core/RecyclerListView.tsx` (modified, +16/-4)
```diff
@@ -208,6 +208,7 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
         if (this.props.dataProvider.getSize() === 0) {
             console.warn(Messages.WARN_NO_DATA); //tslint:disable-line
         }
+        this._virtualRenderer.setOptimizeForAnimations(false);
     }
 
     public componentDidMount(): void {
@@ -397,6 +398,14 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
         );
     }
 
+    // Disables recycling for the next frame so that layout animations run well.
+    // WARNING: Avoid this when making large changes to the data as the list might draw too much to run animations. Single item insertions/deletions
+    // should be good. With recycling paused the list cannot do much optimization.
+    // The next render will run as normal and reuse items.
+    public prepareForLayoutAnimationRender(): void {
+        this._virtualRenderer.setOptimizeForAnimations(true);
+    }
+
     protected getVirtualRenderer(): VirtualRenderer {
         return this._virtualRenderer;
     }
@@ -459,8 +468,12 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
         this._params.itemCount = newProps.dataProvider.getSize();
         this._virtualRenderer.setParamsAndDimensions(this._params, this._layout);
         this._virtualRenderer.setLayoutProvider(newProps.layoutProvider);
-        if (newProps.dataProvider.hasStableIds() && this.props.dataProvider !== newProps.dataProvider && newProps.dataProvider.requiresDataChangeHandling()) {
-            this._virtualRenderer.handleDataSetChange(newProps.dataProvider, this.props.optimizeForInsertDeleteAnimations);
+        if (newProps.dataProvider.hasStableIds() && this.props.dataProvider !== newProps.dataProvider) {
+            if (newProps.dataProvider.requiresDataChangeHandling()) {
+                this._virtualRenderer.handleDataSetChange(newProps.dataProvider);
+            } else if (this._virtualRenderer.hasPendingAnimationOptimization()) {
+                console.warn(Messages.ANIMATION_ON_PAGINATION); //tslint:disable-line
+            }
         }
         if (this.props.layoutProvider !== newProps.layoutProvider || this.props.isHorizontal !== newProps.isHorizontal) {
             //TODO:Talha use old layout manager
@@ -835,8 +848,7 @@ RecyclerListView.propTypes = {
     //This container is for wrapping individual cells that are being rendered by recyclerlistview unlike contentContainer which wraps all of them.
     renderItemContainer: PropTypes.func,
 
-    //Enables you to utilize layout animations better by unmounting removed items. Please note, this might increase unmounts
-    //on large data changes.
+    //Deprecated in favour of `prepareForLayoutAnimationRender` method
     optimizeForInsertDeleteAnimations: PropTypes.bool,
 
     //To pass down style to inner ScrollView
```

**File**: `src/core/VirtualRenderer.ts` (modified, +62/-25)
```diff
@@ -51,6 +51,7 @@ export default class VirtualRenderer {
     private _layoutManager: LayoutManager | null = null;
     private _viewabilityTracker: ViewabilityTracker | null = null;
     private _dimensions: Dimension | null;
+    private _optimizeForAnimations: boolean = false;
 
     constructor(renderStackChanged: (renderStack: RenderStack) => void,
                 scrollOnNextUpdate: (point: Point) => void,
@@ -86,6 +87,14 @@ export default class VirtualRenderer {
         return { height: 0, width: 0 };
     }
 
+    public setOptimizeForAnimations(shouldOptimize: boolean): void {
+        this._optimizeForAnimations = shouldOptimize;
+    }
+
+    public hasPendingAnimationOptimization(): boolean {
+        return this._optimizeForAnimations;
+    }
+
     public updateOffset(offsetX: number, offsetY: number, isActual: boolean, correction: WindowCorrection): void {
         if (this._viewabilityTracker) {
             const offset = this._params && this._params.isHorizontal ? offsetX : offsetY;
@@ -203,7 +212,9 @@ export default class VirtualRenderer {
         }
     }
 
-    public syncAndGetKey(index: number, overrideStableIdProvider?: StableIdProvider, newRenderStack?: RenderStack): string {
+    public syncAndGetKey(index: number, overrideStableIdProvider?: StableIdProvider,
+                         newRenderStack?: RenderStack,
+                         keyToStableIdMap?: { [key: string]: string } ): string {
         const getStableId = overrideStableIdProvider ? overrideStableIdProvider : this._fetchStableId;
         const renderStack = newRenderStack ? newRenderStack : this._renderStack;
         const stableIdItem = this._stableIdToRenderKeyMap[getStableId(index)];
@@ -222,6 +233,9 @@ export default class VirtualRenderer {
                     }
                 } else {
                     renderStack[key] = { dataIndex: index };
+                    if (keyToStableIdMap && keyToStableIdMap[key]) {
+                        delete this._stableIdToRenderKeyMap[keyToStableIdMap[key]];
+                    }
                 }
             } else {
                 key = getStableId(index);
@@ -248,11 +262,18 @@ export default class VirtualRenderer {
     }
 
     //Further optimize in later revision, pretty fast for now considering this is a low frequency event
-    public handleDataSetChange(newDataProvider: BaseDataProvider, shouldOptimizeForAnimations?: boolean): void {
+    public handleDataSetChange(newDataProvider: BaseDataProvider): void {
         const getStableId = newDataProvider.getStableId;
         const maxIndex = newDataProvider.getSize() - 1;
         const activeStableIds: { [key: string]: number } = {};
         const newRenderStack: RenderStack = {};
+        const keyToStableIdMap: { [key: string]: string } = {};
+
+        // Do not use recycle pool so that elements don't fly top to bottom or vice version
+        // Doing this is expensive and can draw extra items
+        if (this._optimizeForAnimations) {
+            this._recyclePool.clearAll();
+        }
 
         //Compute active stable ids and stale active keys and resync render stack
         for (const key in this._renderStack) {
@@ -272,38 +293,54 @@ export default class VirtualRenderer {
         const oldActiveStableIdsCount = oldActiveStableIds.length;
         for (let i = 0; i < oldActiveStableIdsCount; i++) {
             const key = oldActiveStableIds[i];
-            if (!activeStableIds[key]) {
-                if (!shouldOptimizeForAnimations && this._isRecyclingEnabled) {
-                    const stableIdItem = this._stableIdToRenderKeyMap[key];
-                    if (stableIdItem) {
+            const stableIdItem = this._stableIdToRenderKeyMap[key];
+            if (stableIdItem) {
+                if (!activeStableIds[key]) {
+                    if (!this._optimizeForAnimations && this._isRecyclingEnabled) {
                         this._recyclePool.putRecycledObject(stableIdItem.type, stableIdItem.key);
```

**File**: `src/core/constants/Messages.ts` (modified, +2/-0)
```diff
@@ -4,4 +4,6 @@ export const Messages: {[key: string]: string} = {
     WARN_NO_DATA: "You have mounted RecyclerListView with an empty data provider (Size in 0). Please mount only if there is atleast one item " +
                   "to ensure optimal performance and to avoid unexpected behavior",
     VISIBLE_INDEXES_CHANGED_DEPRECATED: "onVisibleIndexesChanged deprecated. Please use onVisibleIndicesChanged instead.",
+    ANIMATION_ON_PAGINATION: "Looks like you're trying to use RecyclerListView's layout animation render while doing pagination. " +
+                             "This operation will be ignored to avoid creation of too many items due to developer error.",
 };
```

**File**: `src/core/layoutmanager/LayoutManager.ts` (modified, +13/-0)
```diff
@@ -23,6 +23,19 @@ export abstract class LayoutManager {
         return undefined;
     }
 
+    //Removes item at the specified index
+    public removeLayout(index: number): void {
+        const layouts = this.getLayouts();
+        if (index < layouts.length) {
+            layouts.splice(index, 1);
+        }
+        if (index === 0 && layouts.length > 0) {
+            const firstLayout = layouts[0];
+            firstLayout.x = 0;
+            firstLayout.y = 0;
+        }
+    }
+
     //Return the dimension of entire content inside the list
     public abstract getContentDimension(): Dimension;
 
```

---

### Incident Patch 10: `449cd4e2` (2021-01-04)
**Commit Message**: Fixed the incorrect reference to this.props on updating VisibleIndicesChanged (#579)

* Fixed the incorrect reference to this.props

* version bump

Co-authored-by: naqvitalha <talha.naqvi@flipkart.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "recyclerlistview",
-  "version": "3.0.4",
+  "version": "3.0.5-beta.1",
   "description": "The listview that you need and deserve. It was built for performance, uses cell recycling to achieve smooth scrolling.",
   "main": "dist/reactnative/index.js",
   "types": "dist/reactnative/index.d.ts",
```

**File**: `src/core/RecyclerListView.tsx` (modified, +4/-4)
```diff
@@ -186,14 +186,14 @@ export default class RecyclerListView<P extends RecyclerListViewProps, S extends
     public componentWillReceivePropsCompat(newProps: RecyclerListViewProps): void {
         this._assertDependencyPresence(newProps);
         this._checkAndChangeLayouts(newProps);
-        if (!this.props.onVisibleIndicesChanged) {
+        if (!newProps.onVisibleIndicesChanged) {
             this._virtualRenderer.removeVisibleItemsListener();
         }
-        if (this.props.onVisibleIndexesChanged) {
+        if (newProps.onVisibleIndexesChanged) {
             throw new CustomError(RecyclerListViewExceptions.usingOldVisibleIndexesChangedParam);
         }
-        if (this.props.onVisibleIndicesChanged) {
-            this._virtualRenderer.attachVisibleItemsListener(this.props.onVisibleIndicesChanged!);
+        if (newProps.onVisibleIndicesChanged) {
+            this._virtualRenderer.attachVisibleItemsListener(newProps.onVisibleIndicesChanged!);
         }
     }
 
```

#### Recent Merged Pull Requests:
- **PR #800** (closed): feat: Add visibility percentage tracking and RTL support for horizontal scrolling (@sh-bnsl)
- **PR #793** (2025-03-15): Version bump (@naqvitalha)
- **PR #792** (2025-03-15): Check react version to solve ref problem (@naqvitalha)
- **PR #791** (2025-03-13): Fix: Update ref handling in StickyContainer for React 19 compatibility (@naqvitalha)
- **PR #781** (2024-06-10): Bugfix(layoutSize) fix item not render after initial data size is empty (@shawnchendev)
- **PR #776** (2024-06-17): Implement `getNativeScrollRef` (@j-piasecki)
- **PR #761** (closed): MVC changes for RLV (@iamashish121)
- **PR #744** (2022-10-12): Increase tolerance inside layout manager (@naqvitalha)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
