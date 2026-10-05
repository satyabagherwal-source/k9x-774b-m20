# Forensic Learning Record (Deep Inspection): alibaba-fusion/next

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-fusion-next-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba-fusion/next](https://github.com/alibaba-fusion/next))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:46:32.979Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba-fusion/next`
- **Description**: 🦍 A configurable component library for web built on React. 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4680 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `components/affix/index.tsx`
```
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import ResizeObserver from 'resize-observer-polyfill';
import { polyfill } from 'react-lifecycles-compat';

import type { AffixProps, AffixState, AffixMode } from './types';
import { obj, events, func } from '../util';
import ConfigProvider from '../config-provider';
import { getScroll, getRect, getNodeHeight } from './util';

/** Affix */
class Affix extends Component<AffixProps, AffixState> {
    static propTypes = {
        prefix: PropTypes.string,
        container: PropTypes.func,
        offsetTop: PropTypes.number,
        offsetBottom: PropTypes.number,
        onAffix: PropTypes.func,
        useAbsolute: PropTypes.bool,
        className: PropTypes.string,
        style: PropTypes.object,
        children: PropTypes.any,
    };

    static defaultProps = {
        prefix: 'next-',
        container: () => window,
        onAffix: func.noop,
    };

    static _getAffixMode(nextProps: AffixProps): AffixMode {
        const affixMode: AffixMode = {
            top: false,
            bottom: false,
            offset: 0,
        };
        if (!nextProps) {
            return affixMode;
        }
        const { offsetTop, offsetBottom } = nextProps;

        if (typeof offsetTop !== 'number' && typeof offsetBottom !== 'number') {
            // set default
            affixMode.top = true;
        } else if (typeof offsetTop === 'number') {
            affixMode.top = true;
            affixMode.bottom = false;
            affixMode.offset = offsetTop;
        } else if (typeof offsetBottom === 'number') {
            affixMode.bottom = true;
            affixMode.top = false;
            affixMode.offset = offsetBottom;
        }

        return affixMode;
    }

    constructor(props: AffixProps, context?: unknown) {
        super(props, context);
        this.state = {
            style: null,
            containerStyle: null,
            positionStyle: null,
            affixMode: Affix._getAffixMode(props),
        };
        this.resizeObserver = new ResizeObserver(this._updateNodePosition);
    }

    static getDerivedStateFromProps(nextProps: AffixProps) {
        if ('offsetTop' in nextProps || 'offsetBottom' in nextProps) {
            return {
                affixMode: Affix._getAffixMode(nextProps),
            };
        }
        return null;
    }

    componentDidMount() {
        const { container } = this.props;
        // wait for parent rendered
        this.timeout = setTimeout(() => {
            this._updateNodePosition();
            this._setEventHandlerForContainer(container!);
        });
    }

    componentDidUpdate(prevProps: AffixProps) {
        if (prevProps.container!() !== this.props.container!()) {
            this._clearContainerEvent();

            this.timeout = setTimeout(() => {
                this._setEventHandlerForContainer(this.props.container!);
            });
        }

        setTimeout(this._updateNodePosition);
    }

    componentWillUnmount() {
        this._clearContainerEvent();
    }

    resizeObserver: ResizeObserver;
    timeout: ReturnType<typeof setTimeout> | null;
    affixNode: HTMLDivElement;
    affixChildNode: HTMLDivElement;

    _clearContainerEvent = () => {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        const { container } = this.props;
        this._removeEventHandlerForContainer(container!);
    };

    _setEventHandlerForContainer(getContainer: NonNullable<AffixProps['container']>) {
        const container = getContainer();
        if (!container) {
            return;
        }
        events.on(container, 'scroll', this._updateNodePosition, false);
        this.resizeObserver.observe(this.affixNode);
    }

    _removeEventHandlerForContainer(getContainer: NonNullable<AffixProps['container']>) {
        const container = getContainer();
        if (container) {
            events.off(container, 'scroll', this._updateNodePosition);
            this.resizeObserver.disconnect();
        }
    }

    updatePosition = () => {
        this._updateNodePosition();
    };

    _updateNodePosition = () => {
        const { affixMode } = this.state;
        const { container, useAbsolute } = this.props;
        const affixContainer = container!();

        if (!affixContainer || !this.affixNode) {
            return false;
        }
        const containerScrollTop = getScroll(affixContainer, true); // 容器在垂直位置上的滚动 offset
        const affixOffset = this._getOffset(this.affixNode, affixContainer); // 目标节点当前相对于容器的 offset
        const containerHeight = getNodeHeight(affixContainer); // 容器的高度
        const affixHeight = this.affixNode.offsetHeight;
        const containerRect = getRect(affixContainer);

        const affixChildHeight = this.affixChildNode.offsetHeight;

        const affixStyle: AffixState['style'] = {
            width: affixOffset.width,
        };
        const containerStyle: AffixState['containerStyle'] = {
            width: affixOffset.width,
            height: affixChildHeight,
        };
        let positionStyle: AffixState['positionStyle'] = null;
        if (affixMode.top && containerScrollTop > affixOffset.top - affixMode.offset) {
            // affix top
            if (useAbsolute) {
                affixStyle.position = 'absolute';
                affixStyle.top = containerScrollTop - (affixOffset.top - affixMode.offset);
                positionStyle = 'relative';
            } else {
                affixStyle.position = 'fixed';
                affixStyle.top = affixMode.offset + containerRect.top;
            }
            this._setAffixStyle(affixStyle, true);
            this._setContainerStyle(containerStyle);
        } else if (
            affixMode.bottom &&
            containerScrollTop < affixOffset.top + affixHeight + affixMode.offset - containerHeight
        ) {
            // affix bottom
            affixStyle.height = affixHeight;
            if (useAbsolute) {
                affixStyle.position = 'absolute';
                affixStyle.top =
                    containerScrollTop -
                    (affixOffset.top + affixHeight + affixMode.offset - containerHeight);
                positionStyle = 'relative';
            } else {
                affixStyle.position = 'fixed';
                affixStyle.bottom = affixMode.offset;
            }
            this._setAffixStyle(affixStyle, true);
            this._setContainerStyle(containerStyle);
        } else {
            this._setAffixStyle(null);
            this._setContainerStyle(null);
        }

        if (this.state.positionStyle !== positionStyle) {
            this.setState({ positionStyle });
        }
    };

    _setAffixStyle(affixStyle: AffixState['style'], affixed = false) {
        if (obj.shallowEqual(affixStyle, this.state.style)) {
            return;
        }

        this.setState({
            style: affixStyle,
        });

        const { onAffix } = this.props;

        if (affixed) {
            setTimeout(() => onAffix!(true));
        } else if (!affixStyle) {
            setTimeout(() => onAffix!(false));
        }
    }

    _setContainerStyle(containerStyle: AffixState['containerStyle']) {
        if (obj.shallowEqual(containerStyle, this.state.containerStyle)) {
            return;
        }
        this.setState({ containerStyle });
    }

    _getOffset(affixNode: HTMLDivElement, affixContainer: Element | Window) {
        const affixRect = affixNode.getBoundingClientRect(); // affix 元素 相对浏览器窗口的位置
        const containerRect = getRect(affixContainer); // affix 容器 相对浏览器窗口的位置
        const containerScrollTop = getScroll(affixContainer, true);
        const containerScrollLeft = getScroll(affixContainer, false);

        return {
            top: affixRect.top - containerRect.top + containerScrollTop,
            left: affixRect.left - containerRect
```

### Core Architecture Module: `components/affix/mobile/index.ts`
```
// @ts-expect-error meet-react does not export Affix
import { Affix as MeetAffix } from '@alifd/meet-react';
import NextAffix from '../index';

const Affix = MeetAffix ? MeetAffix : NextAffix;

export default Affix;

```

### Core Architecture Module: `components/affix/style.ts`
```
import './main.scss';

```

### Core Architecture Module: `components/affix/types.ts`
```
import React from 'react';
import { CommonProps } from '../util';

export interface AffixMode {
    top: boolean;
    bottom: boolean;
    offset: number;
}

export interface AffixState {
    style: React.CSSProperties | null;
    containerStyle: React.CSSProperties | null;
    positionStyle: React.CSSProperties['position'] | null;
    affixMode: AffixMode;
}

export interface GetContainer {
    (): Element;
}

/**
 * @api Affix
 */
export interface AffixProps extends CommonProps {
    /**
     * 设置 Affix 需要监听滚动事件的容器元素
     * @en The container for listening scroll events
     * @returns 目标容器元素
     * @defaultValue () =\> window
     */
    container?: () => Element | Window;

    /**
     * 距离窗口顶部达到指定偏移量后触发
     * @en Offset from top when event triggers
     */
    offsetTop?: number;

    /**
     * 距离窗口底部达到指定偏移量后触发
     * @en Offset from bottom when event triggers
     */
    offsetBottom?: number;

    /**
     * 当元素的样式发生固钉样式变化时触发的回调函数
     * @en Callback when affix event triggers
     * @param affixed - 是否固定 - if element is affixed
     */
    onAffix?: (affixed: boolean) => void;

    /**
     * 是否启用绝对布局实现 affix
     * @en Enable absolute position
     */
    useAbsolute?: boolean;

    /**
     * 包裹 children 容器的类名
     */
    className?: string;

    /**
     * 最外层容器的 style 样式
     */
    style?: React.CSSProperties;
}

```

### Core Architecture Module: `components/affix/util.ts`
```
export function getScroll(node: Window | Element, isVertical?: boolean) {
    if (typeof window === 'undefined') {
        return 0;
    }
    const windowProp = isVertical ? 'pageYOffset' : 'pageXOffset';
    const elementProp = isVertical ? 'scrollTop' : 'scrollLeft';
    return node === window ? node[windowProp] : (node as Element)[elementProp];
}

export function getRect(node: Window | Element) {
    return node !== window
        ? (node as Element).getBoundingClientRect()
        : { top: 0, left: 0, bottom: 0 };
}

export function getNodeHeight(node: Window | Element) {
    if (!node) {
        return 0;
    }
    if (node === window) {
        return window.innerHeight;
    }
    return (node as Element).clientHeight;
}

```

### Core Architecture Module: `components/animate/animate.tsx`
```
import React, { Component, Children, type ReactNode, ReactElement } from 'react';
import PropTypes from 'prop-types';
import { TransitionGroup } from 'react-transition-group';
import AnimateChild from './child';
import type { AnimateProps } from './types';

const noop = () => {};
const FirstChild = (props: { children: ReactNode }) => {
    const childrenArray = React.Children.toArray(props.children);
    return childrenArray[0] || null;
};

/**
 * Animate
 */
class Animate extends Component<AnimateProps> {
    static displayName = 'Animate';
    static propTypes = {
        animation: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        animationAppear: PropTypes.bool,
        component: PropTypes.any,
        singleMode: PropTypes.bool,
        children: PropTypes.oneOfType([PropTypes.element, PropTypes.arrayOf(PropTypes.element)]),
        beforeAppear: PropTypes.func,
        onAppear: PropTypes.func,
        afterAppear: PropTypes.func,
        beforeEnter: PropTypes.func,
        onEnter: PropTypes.func,
        afterEnter: PropTypes.func,
        beforeLeave: PropTypes.func,
        onLeave: PropTypes.func,
        afterLeave: PropTypes.func,
    };

    static defaultProps = {
        animationAppear: true,
        component: 'div',
        singleMode: true,
        beforeAppear: noop,
        onAppear: noop,
        afterAppear: noop,
        beforeEnter: noop,
        onEnter: noop,
        afterEnter: noop,
        beforeLeave: noop,
        onLeave: noop,
        afterLeave: noop,
    };

    normalizeNames(names: AnimateProps['animation']) {
        if (typeof names === 'string') {
            return {
                appear: `${names}-appear`,
                appearActive: `${names}-appear-active`,
                enter: `${names}-enter`,
                enterActive: `${names}-enter-active`,
                leave: `${names}-leave`,
                leaveActive: `${names}-leave-active`,
            };
        }
        if (typeof names === 'object') {
            return {
                appear: names.appear,
                appearActive: `${names.appear}-active`,
                enter: `${names.enter}`,
                enterActive: `${names.enter}-active`,
                leave: `${names.leave}`,
                leaveActive: `${names.leave}-active`,
            };
        }
    }

    render() {
        const {
            animation,
            children,
            animationAppear,
            singleMode,
            component,
            beforeAppear,
            onAppear,
            afterAppear,
            beforeEnter,
            onEnter,
            afterEnter,
            beforeLeave,
            onLeave,
            afterLeave,
            ...others
        } = this.props;

        const animateChildren = Children.map(children, child => {
            return (
                <AnimateChild
                    key={(child as ReactElement)?.key}
                    names={this.normalizeNames(animation)!}
                    onAppear={beforeAppear}
                    onAppearing={onAppear}
                    onAppeared={afterAppear}
                    onEnter={beforeEnter}
                    onEntering={onEnter}
                    onEntered={afterEnter}
                    onExit={beforeLeave}
                    onExiting={onLeave}
                    onExited={afterLeave}
                >
                    {child}
                </AnimateChild>
            );
        });

        return (
            <TransitionGroup
                appear={animationAppear}
                component={singleMode ? FirstChild : component}
                {...others}
            >
                {animateChildren!}
            </TransitionGroup>
        );
    }
}

export default Animate;

```

### Core Architecture Module: `components/animate/child.tsx`
```
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Transition } from 'react-transition-group';
import { func, support, events, dom, guid } from '../util';
import type { AnimateChildProps } from './types';

const noop = () => {};
const { on, off } = events;
const { addClass, removeClass } = dom;
const prefixes = ['-webkit-', '-moz-', '-o-', 'ms-', ''];

function getStyleProperty(node: HTMLElement, name: string) {
    const style = window.getComputedStyle(node);
    let ret = '';
    for (let i = 0; i < prefixes.length; i++) {
        ret = style.getPropertyValue(prefixes[i] + name);
        if (ret) {
            break;
        }
    }
    return ret;
}

export default class AnimateChild extends Component<AnimateChildProps> {
    static displayName = 'AnimateChild';
    static propTypes = {
        names: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        onAppear: PropTypes.func,
        onAppearing: PropTypes.func,
        onAppeared: PropTypes.func,
        onEnter: PropTypes.func,
        onEntering: PropTypes.func,
        onEntered: PropTypes.func,
        onExit: PropTypes.func,
        onExiting: PropTypes.func,
        onExited: PropTypes.func,
    };

    static defaultProps = {
        onAppear: noop,
        onAppearing: noop,
        onAppeared: noop,
        onEnter: noop,
        onEntering: noop,
        onEntered: noop,
        onExit: noop,
        onExiting: noop,
        onExited: noop,
    };
    endListeners: Record<string, Array<(e: UIEvent) => void>>;
    timeoutMap: Record<string, number>;
    node: HTMLElement;
    transitionOff: () => void;
    animationOff: () => void;

    constructor(props: AnimateChildProps) {
        super(props);
        func.bindCtx(this, [
            'handleEnter',
            'handleEntering',
            'handleEntered',
            'handleExit',
            'handleExiting',
            'handleExited',
            'addEndListener',
        ]);
        this.endListeners = {
            transitionend: [],
            animationend: [],
        };
        this.timeoutMap = {};
    }

    componentWillUnmount() {
        Object.keys(this.endListeners).forEach(eventName => {
            this.endListeners[eventName].forEach(listener => {
                off(this.node, eventName, listener);
            });
        });
        this.endListeners = {
            transitionend: [],
            animationend: [],
        };
    }

    generateEndListener(node: HTMLElement, done: () => void, eventName: string, id: string) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const _this = this;
        return function endListener(e: UIEvent) {
            if (e && e.target === node) {
                if (_this.timeoutMap[id]) {
                    clearTimeout(_this.timeoutMap[id]);
                    delete _this.timeoutMap[id];
                }

                done();
                off(node, eventName, endListener);
                const listeners = _this.endListeners[eventName];
                const index = listeners.indexOf(endListener);
                index > -1 && listeners.splice(index, 1);
            }
        };
    }

    addEndListener(node: HTMLElement, done: () => void) {
        if (support.transition || support.animation) {
            const id = guid();

            this.node = node;
            if (support.transition) {
                const transitionEndListener = this.generateEndListener(
                    node,
                    done,
                    'transitionend',
                    id
                );
                on(node, 'transitionend', transitionEndListener);
                this.endListeners.transitionend.push(transitionEndListener);
            }
            if (support.animation) {
                const animationEndListener = this.generateEndListener(
                    node,
                    done,
                    'animationend',
                    id
                );
                on(node, 'animationend', animationEndListener);
                this.endListeners.animationend.push(animationEndListener);
            }

            setTimeout(() => {
                const transitionDelay = parseFloat(getStyleProperty(node, 'transition-delay')) || 0;
                const transitionDuration =
                    parseFloat(getStyleProperty(node, 'transition-duration')) || 0;
                const animationDelay = parseFloat(getStyleProperty(node, 'animation-delay')) || 0;
                const animationDuration =
                    parseFloat(getStyleProperty(node, 'animation-duration')) || 0;
                const time = Math.max(
                    transitionDuration + transitionDelay,
                    animationDuration + animationDelay
                );
                if (time) {
                    this.timeoutMap[id] = window.setTimeout(
                        () => {
                            done();
                        },
                        time * 1000 + 200
                    );
                }
            }, 15);
        } else {
            done();
        }
    }

    removeEndtListener() {
        this.transitionOff && this.transitionOff();
        this.animationOff && this.animationOff();
    }

    removeClassNames(node: HTMLElement, names: NonNullable<AnimateChildProps['names']>) {
        Object.keys(names).forEach((key: keyof typeof names) => {
            removeClass(node, names[key]!);
        });
    }

    handleEnter(node: HTMLElement, isAppearing: boolean) {
        const { names } = this.props;
        if (names) {
            this.removeClassNames(node, names);
            const className = isAppearing ? 'appear' : 'enter';
            addClass(node, names[className]!);
        }

        const hook = isAppearing ? this.props.onAppear : this.props.onEnter;
        hook!(node);
    }

    handleEntering(node: HTMLElement, isAppearing: boolean) {
        setTimeout(() => {
            const { names } = this.props;
            if (names) {
                const className = isAppearing ? 'appearActive' : 'enterActive';
                addClass(node, names[className]!);
            }

            const hook = isAppearing ? this.props.onAppearing : this.props.onEntering;
            hook!(node);
        }, 10);
    }

    handleEntered(node: HTMLElement, isAppearing: boolean) {
        const { names } = this.props;
        if (names) {
            const classNames = isAppearing
                ? [names.appear, names.appearActive]
                : [names.enter, names.enterActive];
            classNames.forEach(className => {
                removeClass(node, className!);
            });
        }

        const hook = isAppearing ? this.props.onAppeared : this.props.onEntered;
        hook!(node);
    }

    handleExit(node: HTMLElement) {
        const { names } = this.props;
        if (names) {
            this.removeClassNames(node, names);
            addClass(node, names.leave!);
        }

        this.props.onExit!(node);
    }

    handleExiting(node: HTMLElement) {
        setTimeout(() => {
            const { names } = this.props;
            if (names) {
                addClass(node, names.leaveActive!);
            }
            this.props.onExiting!(node);
        }, 10);
    }

    handleExited(node: HTMLElement) {
        const { names } = this.props;
        if (names) {
            [names.leave, names.leaveActive].forEach(className => {
                removeClass(node, className!);
            });
        }

        this.props.onExited!(node);
    }

    render() {
        const {
            names,
            onAppear,
            onAppeared,
            onAppearing,
            onEnter,
            onEntering,
            onEntered,
            onExit,
            onExiting,
            onExited,
            ...others
        } = this.props;
        return (
            <Transition
                {...others}
```

### Core Architecture Module: `components/animate/expand.tsx`
```
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { func, dom } from '../util';
import Animate from './animate';
import type { ExpandProps } from './types';

const noop = () => {};
const { getStyle } = dom;

export default class Expand extends Component<ExpandProps> {
    static displayName = 'Expand';
    static propTypes = {
        animation: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        beforeEnter: PropTypes.func,
        onEnter: PropTypes.func,
        afterEnter: PropTypes.func,
        beforeLeave: PropTypes.func,
        onLeave: PropTypes.func,
        afterLeave: PropTypes.func,
    };

    static defaultProps = {
        beforeEnter: noop,
        onEnter: noop,
        afterEnter: noop,
        beforeLeave: noop,
        onLeave: noop,
        afterLeave: noop,
    };
    leaving: boolean;
    styleBorderTopWidth: string;
    stylePaddingTop: string;
    styleHeight: string;
    stylePaddingBottom: string;
    styleBorderBottomWidth: string;
    borderTopWidth: string | number;
    paddingTop: string | number;
    height: number;
    paddingBottom: string | number;
    borderBottomWidth: string | number;

    constructor(props: ExpandProps) {
        super(props);
        func.bindCtx(this, [
            'beforeEnter',
            'onEnter',
            'afterEnter',
            'beforeLeave',
            'onLeave',
            'afterLeave',
        ]);
    }

    beforeEnter(node: HTMLElement) {
        if (this.leaving) {
            this.afterLeave(node);
        }

        this.cacheCurrentStyle(node);
        this.cacheComputedStyle(node);
        this.setCurrentStyleToZero(node);

        this.props.beforeEnter!(node);
    }

    onEnter(node: HTMLElement) {
        this.setCurrentStyleToComputedStyle(node);

        this.props.onEnter!(node);
    }

    afterEnter(node: HTMLElement) {
        this.restoreCurrentStyle(node);

        this.props.afterEnter!(node);
    }

    beforeLeave(node: HTMLElement) {
        this.leaving = true;

        this.cacheCurrentStyle(node);
        this.cacheComputedStyle(node);
        this.setCurrentStyleToComputedStyle(node);

        this.props.beforeLeave!(node);
    }

    onLeave(node: HTMLElement) {
        this.setCurrentStyleToZero(node);

        this.props.onLeave!(node);
    }

    afterLeave(node: HTMLElement) {
        this.leaving = false;

        this.restoreCurrentStyle(node);

        this.props.afterLeave!(node);
    }

    cacheCurrentStyle(node: HTMLElement) {
        this.styleBorderTopWidth = node.style.borderTopWidth;
        this.stylePaddingTop = node.style.paddingTop;
        this.styleHeight = node.style.height;
        this.stylePaddingBottom = node.style.paddingBottom;
        this.styleBorderBottomWidth = node.style.borderBottomWidth;
    }

    cacheComputedStyle(node: HTMLElement) {
        this.borderTopWidth = getStyle(node, 'borderTopWidth');
        this.paddingTop = getStyle(node, 'paddingTop');
        this.height = node.offsetHeight;
        this.paddingBottom = getStyle(node, 'paddingBottom');
        this.borderBottomWidth = getStyle(node, 'borderBottomWidth');
    }

    setCurrentStyleToZero(node: HTMLElement) {
        node.style.borderTopWidth = '0px';
        node.style.paddingTop = '0px';
        node.style.height = '0px';
        node.style.paddingBottom = '0px';
        node.style.borderBottomWidth = '0px';
    }

    setCurrentStyleToComputedStyle(node: HTMLElement) {
        node.style.borderTopWidth = `${this.borderTopWidth}px`;
        node.style.paddingTop = `${this.paddingTop}px`;
        node.style.height = `${this.height}px`;
        node.style.paddingBottom = `${this.paddingBottom}px`;
        node.style.borderBottomWidth = `${this.borderBottomWidth}px`;
    }

    restoreCurrentStyle(node: HTMLElement) {
        node.style.borderTopWidth = this.styleBorderTopWidth;
        node.style.paddingTop = this.stylePaddingTop;
        node.style.height = this.styleHeight;
        node.style.paddingBottom = this.stylePaddingBottom;
        node.style.borderBottomWidth = this.styleBorderBottomWidth;
    }

    render() {
        const { animation, ...others } = this.props;
        const newAnimation = animation || 'expand';

        return (
            <Animate
                {...others}
                animation={newAnimation}
                beforeEnter={this.beforeEnter}
                onEnter={this.onEnter}
                afterEnter={this.afterEnter}
                beforeLeave={this.beforeLeave}
                onLeave={this.onLeave}
                afterLeave={this.afterLeave}
            />
        );
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5109** (2026-09-13): **chore(deps-dev): bump postcss from 7.0.39 to 8.5.23**
  *Symptoms*: Bumps [postcss](https://github.com/postcss/postcss) from 7.0.39 to 8.5.23. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/postcss/postcss/releases">postcss's releases</a>.</em></p> <blockquote> <h2>8.5.23</h2> <ul> <li>Do not load source map without <code>opts.from</code> for security reasons.</li> </ul> <h2>8.5.22</h2> <ul> <li>Fixed custom property losing semicolon before a comment (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> </ul> <h2>8.5.21</h2> <ul> <li>Fixed childless at-rule losing semicolon before comment (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed docs (by <a href="https://github.com/isker"><code>@​isker</code></a>).</li> </ul> <h2>8.5.20</h2> <ul> <li>Fixed missing space if <code>AtRule#params</code> is set after (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed mixing AST error on warnings (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> </ul> <h2>8.5.19</h2> <ul> <li>Fixed cleaning <code>before</code> for new nodes inserted to <code>Root</code> (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> </ul> <h2>8.5.18</h2> <ul> <li>Restricted loading previous source maps file to the <code>opts.from</code> folder for security reasons (use <code>unsafeMap: true</code> to disable the check).</li> </ul> <h2>8.5.17</
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5108** (2026-09-11): **chore(deps): bump socket.io-parser and karma**
  *Symptoms*: Bumps [socket.io-parser](https://github.com/socketio/socket.io) to 4.2.7 and updates ancestor dependency [karma](https://github.com/karma-runner/karma). These dependencies need to be updated together.  Updates `socket.io-parser` from 3.2.0 to 4.2.7 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/socketio/socket.io/releases">socket.io-parser's releases</a>.</em></p> <blockquote> <h2>socket.io-parser@4.2.7</h2> <h3>Bug Fixes</h3> <ul> <li>honor toJSON() when deconstructing a binary packet (<a href="https://redirect.github.com/socketio/socket.io/issues/5518">#5518</a>) (<a href="https://github.com/socketio/socket.io/commit/57f111439513809c633f2554be2f3104e4ad432c">57f1114</a>)</li> <li>reject binary packets with zero attachments (<a href="https://github.com/socketio/socket.io/commit/7c6ef571a00656718e9e05e3b948fd1758b2a7b4">7c6ef57</a>)</li> </ul> <h2>New Contributors</h2> <ul> <li><a href="https://github.com/spokodev"><code>@​spokodev</code></a> made their first contribution in <a href="https://redirect.github.com/socketio/socket.io/pull/5518">socketio/socket.io#5518</a></li> </ul> <h2>socket.io-parser@3.4.4</h2> <p>This release includes a fix for <a href="https://github.com/socketio/socket.io/security/advisories/GHSA-677m-j7p3-52f9">CVE-2026-33151</a>. Please upgrade as soon as possible.</p> <h3>Bug Fixes</h3> <ul> <li>add a limit to the number of binary attachments (<a href="https://github.com/socketio/socket.io/commit/719f9ebab0772f
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5107** (2026-08-07): **chore(deps-dev): bump postcss from 7.0.39 to 8.5.18**
  *Symptoms*: Bumps [postcss](https://github.com/postcss/postcss) from 7.0.39 to 8.5.18. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/postcss/postcss/releases">postcss's releases</a>.</em></p> <blockquote> <h2>8.5.18</h2> <ul> <li>Restricted loading previous source maps file to the <code>opts.from</code> folder for security reasons (use <code>unsafeMap: true</code> to disable the check).</li> </ul> <h2>8.5.17</h2> <ul> <li>Fixed <code>Maximum call stack size exceeded</code> error.</li> <li>Fixed Prototype hijacking for <code>postcss.fromJSON()</code>.</li> <li>Fixed <code>Input#origin()</code> for unmapped end position (by <a href="https://github.com/chatman-media"><code>@​chatman-media</code></a>).</li> </ul> <h2>8.5.16</h2> <ul> <li>Fixed <code>Input#origin()</code> position (by <a href="https://github.com/mizdra"><code>@​mizdra</code></a>).</li> <li>Fixed <code>raws</code> after rehydrating a JSON AST (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed putting parent-less node in <code>nodes</code> of new node (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> <li>Fixed computing <code>offset</code> in <code>positionBy()</code> (by <a href="https://github.com/greymoth-jp"><code>@​greymoth-jp</code></a>).</li> <li>Fixed <code>rangeBy()</code> on <code>index: 0</code> (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> </ul> 
  **Post-Mortem & Fix Analysis**:
  > Superseded by #5109.

- **Issue #5106** (2026-08-31): **chore(deps): bump shell-quote and react-dev-utils**
  *Symptoms*: Bumps [shell-quote](https://github.com/ljharb/shell-quote) to 1.10.0 and updates ancestor dependency [react-dev-utils](https://github.com/facebook/create-react-app/tree/HEAD/packages/react-dev-utils). These dependencies need to be updated together.  Updates `shell-quote` from 1.6.1 to 1.10.0 <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/ljharb/shell-quote/blob/main/CHANGELOG.md">shell-quote's changelog</a>.</em></p> <blockquote> <h2><a href="https://github.com/ljharb/shell-quote/compare/v1.9.0...v1.10.0">v1.10.0</a> - 2026-07-10</h2> <h3>Merged</h3> <ul> <li>[New] <code>parse</code>: add opt-in <code>splitUnquoted</code> option for shell field-splitting of unquoted expansions <a href="https://redirect.github.com/ljharb/shell-quote/pull/1"><code>[#1](https://github.com/ljharb/shell-quote/issues/1)</code></a></li> </ul> <h3>Commits</h3> <ul> <li>[Fix] <code>parse</code>: match nested <code>${...}</code> braces so nested parameter expansion is consumed as one substitution <a href="https://github.com/ljharb/shell-quote/commit/c0842c8a7a034066da2496a75e91cbe500ff736c"><code>c0842c8</code></a></li> <li>[Tests] <code>parse</code>: pin single-quote literalness and unmatched-quote handling <a href="https://github.com/ljharb/shell-quote/commit/a0d03e35c8ede24016502c4433b8f5d6b3100a62"><code>a0d03e3</code></a></li> <li>[readme] remove the space in js code fences so evalmd evaluates them <a href="https://github.com/ljharb/shell-quote/commit/2116fa
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5105** (2026-08-30): **chore(deps): bump linkify-it and markdown-it**
  *Symptoms*: Bumps [linkify-it](https://github.com/markdown-it/linkify-it) to 5.0.2 and updates ancestor dependency [markdown-it](https://github.com/markdown-it/markdown-it). These dependencies need to be updated together.  Updates `linkify-it` from 2.2.0 to 5.0.2 <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/markdown-it/linkify-it/blob/master/CHANGELOG.md">linkify-it's changelog</a>.</em></p> <blockquote> <h2>5.0.2 / 2026-07-02</h2> <ul> <li>Fixed DoS in <code>mailto:</code> links (restrict user name to 64 chars).</li> <li>Restricted user/pass part length in links.</li> </ul> <h2>5.0.1 / 2026-05-23</h2> <ul> <li>Fixed DoS in fuzzy links/emails search.</li> <li>Reworked search logic - check each pattern separate, use <code>g</code> regexes instead of slice.</li> <li>Removed internal cache - useless overcomplication.</li> </ul> <h2>5.0.0 / 2023-12-01</h2> <ul> <li>Rewrite to ESM.</li> </ul> <h2>4.0.1 / 2022-05-02</h2> <ul> <li>Fix <code>http://</code> incorrectly returned as a link by matchStart.</li> </ul> <h2>4.0.0 / 2022-04-22</h2> <ul> <li>Add <code>matchAtStart</code> method to match full URLs at the start of the string.</li> <li>Fixed paired symbols (<code>()</code>, <code>{}</code>, <code>&quot;&quot;</code>, etc.) after punctuation.</li> <li><code>---</code> option now affects parsing of emails  (e.g. <code>user@example.com---</code>)</li> </ul> <h2>3.0.3 / 2021-10-01</h2> <ul> <li>Fixed <a href="https://redirect.github.com/markdown-it/linki
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5104** (2026-08-30): **chore(deps): bump immutable from 4.3.4 to 4.3.9**
  *Symptoms*: Bumps [immutable](https://github.com/immutable-js/immutable-js) from 4.3.4 to 4.3.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/immutable-js/immutable-js/releases">immutable's releases</a>.</em></p> <blockquote> <h2>v4.3.9</h2> <h1>What's changed</h1> <ul> <li>fix(List): guard oversized bounds in setListBounds. Fixes CVE <a href="https://github.com/immutable-js/immutable-js/security/advisories/GHSA-v56q-mh7h-f735">https://github.com/immutable-js/immutable-js/security/advisories/GHSA-v56q-mh7h-f735</a></li> <li>perf(Map): index large hash-collision buckets for faster lookups. Fixes CVE <a href="https://github.com/immutable-js/immutable-js/security/advisories/GHSA-xvcm-6775-5m9r">https://github.com/immutable-js/immutable-js/security/advisories/GHSA-xvcm-6775-5m9r</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/immutable-js/immutable-js/compare/v4.3.8...v4.3.9">https://github.com/immutable-js/immutable-js/compare/v4.3.8...v4.3.9</a></p> <h2>v4.3.8</h2> <p>Fix Improperly Controlled Modification of Object Prototype Attributes ('Prototype Pollution') in immutable</p> <h2>v4.3.7</h2> <h2>What's Changed</h2> <ul> <li>Fix issue with slice negative of filtered sequence by <a href="https://github.com/jdeniau"><code>@​jdeniau</code></a> in <a href="https://redirect.github.com/immutable-js/immutable-js/pull/2006">immutable-js/immutable-js#2006</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5103** (2026-08-29): **定义了主题变量发布成功后装新的依赖，包里找不到**
  *Symptoms*: ### Reproduction link  [https://fusion.design/32495/design/style/color?type=theme&themeid=25469](https://fusion.design/32495/design/style/color?type=theme&themeid=25469)  ### Steps to reproduce 定义了主题变量发布成功装新的依赖包里找不到  <!-- generated by alibaba-fusion-issue-helper. DO NOT REMOVE --> <!-- platform: main -->
  **Post-Mortem & Fix Analysis**:
  > 这是您为 Fusion/Next 提的第一个 issue，感谢您对 Fusion 的信任和支持，我们会尽快进行处理。
  > 你好，该 issue 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 issue 将被自动关闭

- **Issue #5102** (2026-08-22): **chore(deps): bump websocket-driver from 0.7.4 to 0.7.5**
  *Symptoms*: Bumps [websocket-driver](https://github.com/faye/websocket-driver-node) from 0.7.4 to 0.7.5. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/faye/websocket-driver-node/blob/main/CHANGELOG.md">websocket-driver's changelog</a>.</em></p> <blockquote> <h3>0.7.5 / 2026-06-04</h3> <ul> <li>Close a draft-75/76 connection if a length header grows to exceed the configured max length</li> <li>Fail the connection if a message is larger than the configured max length after extension processing</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/faye/websocket-driver-node/commit/5d6a9aaf5f019007d917bd9ddc7eeb775c86cc1f"><code>5d6a9aa</code></a> Bump version to 0.7.5</li> <li><a href="https://github.com/faye/websocket-driver-node/commit/c55679a5b18251dd0a55d18a0cc6a4fd8822b92f"><code>c55679a</code></a> Fail the connection if a message is larger than the configured max length aft...</li> <li><a href="https://github.com/faye/websocket-driver-node/commit/5b197ca874dab58e96cacad8a3c256797d804680"><code>5b197ca</code></a> Close a draft-75/76 connection if a length header grows to exceed the configu...</li> <li><a href="https://github.com/faye/websocket-driver-node/commit/fc93a48f879d0fd4a77c687a4a19c4328613df65"><code>fc93a48</code></a> Test on Node v22, v24, and v26</li> <li><a href="https://github.com/faye/websocket-driver-node/commit/2e82d3464d294bdd11202657208636e667212335"><code>2e82d34</code><
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

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

### Incident Patch 1: `b40dfa77` (2026-03-31)
**Commit Message**: test(DatePicker): update keyboard input tests to use fixed date for consistent expected values

**File**: `components/date-picker/__tests__/index-spec.tsx` (modified, +50/-20)
```diff
@@ -266,28 +266,40 @@ describe('DatePicker', () => {
         });
 
         it('should keyboard date input', () => {
-            cy.mount(<DatePicker defaultVisible />);
+            const fixedDate = moment('2026-02-15');
+            const expectedDate = fixedDate.clone().add(1, 'day');
+            cy.mount(<DatePicker defaultVisible defaultValue={fixedDate} />);
             cy.get('.next-date-picker-panel-input input').eq(0).as('input');
+            cy.get('@input').type('{downArrow}'); // 因为第一次默认不会触发变动
             cy.get('@input').type('{downArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{leftArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{alt}{downArrow}');
             cy.get('@input').type('{shift}{downArrow}');
             cy.get('@input').type('{ctrl}{downArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{downArrow}');
-            cy.get('@input').should('have.value', moment().add(1, 'day').format('YYYY-MM-DD'));
+            cy.get('@input').should(
+                'have.value',
+                expectedDate.clone().add(1, 'day').format('YYYY-MM-DD')
+            );
             cy.get('@input').type('{upArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{pageDown}');
-            cy.get('@input').should('have.value', moment().add(1, 'month').format('YYYY-MM-DD'));
+            cy.get('@input').should(
+                'have.value',
+                expectedDate.clone().add(1, 'month').format('YYYY-MM-DD')
+            );
             cy.get('@input').type('{pageUp}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{alt}{pageDown}');
-            cy.get('@input').should('have.value', moment().add(1, 'year').format('YYYY-MM-DD'));
+            cy.get('@input').should(
+                'have.value',
+                expectedDate.clone().add(1, 'year').format('YYYY-MM-DD')
+            );
             cy.get('@input').type('{alt}{pageUp}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
         });
 
         it('should keyboard date time input', () => {
@@ -1508,28 +1520,46 @@ describe('RangePicker', () => {
         });
 
         it('should keyboard date input', () => {
-            cy.mount(<RangePicker defaultVisible popupProps={{ animation: false }} />);
+            const fixedDate = moment('2026-02-15');
+            const expectedDate = fixedDate.clone().add(1, 'day');
+            cy.mount(
+                <RangePicker
+                    defaultVisible
+                    defaultValue={[fixedDate, fixedDate]}
+                    popupProps={{ animation: false }}
+                />
+            );
             cy.get('.next-range-picker-panel-input-start-date input').eq(0).as('input');
             cy.get('@input').type('{downArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').type('{downArrow}');
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{leftArrow}');
-    
```

---

### Incident Patch 2: `65ecdf57` (2026-03-31)
**Commit Message**: fix(Select): fix the issue where the group key conflicts with the item value in the grouped dataSource scenario

**File**: `components/select/__tests__/index-spec.tsx` (modified, +84/-0)
```diff
@@ -835,6 +835,90 @@ describe('Select', () => {
     });
 });
 
+describe('Select Group Key Collision', () => {
+    it('should render both group and item when group index collides with item value', () => {
+        const dataSource = [
+            {
+                label: 'Group A',
+                children: [
+                    { label: 'Child 1', value: 'c1' },
+                    { label: 'Child 2', value: 'c2' },
+                ],
+            },
+            { label: 'Item 0', value: 0 },
+            { label: 'Item 1', value: 1 },
+        ];
+        cy.mount(<Select dataSource={dataSource} visible />);
+        cy.get('.next-menu-group-label').should('have.length', 1);
+        cy.get('.next-select-menu-item').should('have.length', 4);
+    });
+
+    it('should render correctly when item value is a numeric string matching group index', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [{ label: 'Child A', value: 'ca' }],
+            },
+            { label: 'Item "0"', value: '0' },
+        ];
+        cy.mount(<Select dataSource={dataSource} visible />);
+        cy.get('.next-menu-group-label').should('have.length', 1);
+        cy.get('.next-select-menu-item').should('have.length', 2);
+    });
+
+    it('should support selection when group index collides with item value', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [
+                    { label: 'Child 1', value: 'c1' },
+                    { label: 'Child 2', value: 'c2' },
+                ],
+            },
+            { label: 'Item 0', value: 0 },
+        ];
+        const onChange = cy.spy().as('onChange');
+        cy.mount(<Select dataSource={dataSource} visible onChange={onChange} />);
+        cy.get('.next-select-menu-item').last().click();
+        cy.get('@onChange').should('be.calledWith', 0);
+        cy.get('.next-select em').should('have.text', 'Item 0');
+    });
+
+    it('should support multiple selection with group key collision', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [{ label: 'Child 1', value: 'c1' }],
+            },
+            { label: 'Item 0', value: 0 },
+            { label: 'Item 1', value: 1 },
+        ];
+        const onChange = cy.spy().as('onChange');
+        cy.mount(<Select dataSource={dataSource} visible mode="multiple" onChange={onChange} />);
+        cy.get('.next-select-menu-item').eq(0).click();
+        cy.get('@onChange').should('be.calledWith', ['c1']);
+        cy.get('.next-select-menu-item').eq(1).click();
+        cy.get<SinonSpy>('@onChange').then($spy => {
+            const [v] = $spy.args[1] as Parameters<NonNullable<SelectProps['onChange']>>;
+            cy.wrap(v).should('deep.equal', ['c1', 0]);
+        });
+    });
+
+    it('should render correctly when no key collision exists', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [{ label: 'Child 1', value: 'c1' }],
+            },
+            { label: 'Item A', value: 'a' },
+            { label: 'Item B', value: 'b' },
+        ];
+        cy.mount(<Select dataSource={dataSource} visible />);
+        cy.get('.next-menu-group-label').should('have.length', 1);
+        cy.get('.next-select-menu-item').should('have.length', 3);
+    });
+});
+
 describe('Select Controlled', () => {
     beforeEach(() => {
         cy.mount(
```

**File**: `components/select/base.tsx` (modified, +17/-2)
```diff
@@ -16,7 +16,14 @@ import Input from '../input';
 import zhCN from '../locale/zh-cn';
 import DataStore from './data-store';
 import VirtualList from '../virtual-list';
-import { isSingle, filter, isNull, valueToSelectKey, getValueDataSource } from './util';
+import {
+    isSingle,
+    filter,
+    isNull,
+    valueToSelectKey,
+    getValueDataSource,
+    generateGroupKey,
+} from './util';
 import type {
     BaseProps,
     DataSourceItem,
@@ -519,13 +526,21 @@ export default class Base<
             searchKey = this.state.searchValue;
         }
 
+        const itemValueSet = new Set<string>();
+        for (const item of dataSource) {
+            if (item && !(Array.isArray(item.children) && showDataSourceChildren)) {
+                itemValueSet.add(`${item.value}`);
+            }
+        }
+
         return dataSource.map((item, index) => {
             if (!item) {
                 return null;
             }
             if (Array.isArray(item.children) && showDataSourceChildren) {
+                const groupKey = generateGroupKey(index, itemValueSet);
                 return (
-                    <MenuGroup key={index} label={item.label}>
+                    <MenuGroup key={groupKey} label={item.label}>
                         {this.renderMenuItem(item.children)}
                     </MenuGroup>
                 );
```

**File**: `components/select/util.ts` (modified, +20/-0)
```diff
@@ -347,3 +347,23 @@ export function valueToSelectKey(value: DataSourceItem): ObjectItem['value'] {
     }
     return `${val}`;
 }
+
+/**
+ * Generate group key
+ * @param index - index
+ * @param itemValueSet - item value set
+ * @returns group key
+ */
+export function generateGroupKey(index: number, itemValueSet: Set<string>) {
+    const targetKey = `select-group-${index}`;
+    if (!itemValueSet.has(targetKey)) {
+        return targetKey;
+    }
+    let suffix = 0;
+    let key = `${targetKey}-repeat-${suffix}`;
+    while (itemValueSet.has(key)) {
+        suffix++;
+        key = `${targetKey}-repeat-${suffix}`;
+    }
+    return key;
+}
```

---

### Incident Patch 3: `a1b986ff` (2025-12-11)
**Commit Message**: fix(TreeSelect): fix options collapse after select when treeCheckable,treeDefaultExpandAll and showSearch is true

**File**: `components/tree-select/__tests__/index-spec.tsx` (modified, +19/-0)
```diff
@@ -951,6 +951,25 @@ describe('TreeSelect', () => {
         cy.get('.next-tree-node').should('have.length', 6);
     });
 
+    it('should expandedAll when select by searchValue is empty and treeDefaultExpandAll is true and showSearch is true', () => {
+        const handleSearch = cy.spy();
+        cy.mount(
+            <TreeSelect
+                defaultVisible
+                treeDefaultExpandAll
+                treeCheckable
+                dataSource={dataSource}
+                showSearch
+                onSearch={debounce(handleSearch, 20)} // Debounce for simulate Cypress action type below
+            />
+        );
+        cy.get('.next-tree-node[value="4"]').click();
+        cy.get('.next-tree-node').then($el => {
+            const list = $el.filter('[style!="display: none;"]');
+            cy.wrap(list).should('have.length', 6);
+        });
+    });
+
     describe('should support useDetailValue', () => {
         it('Support dataSource mode', () => {
             const handleChange = cy.spy();
```

**File**: `components/tree-select/tree-select.tsx` (modified, +4/-1)
```diff
@@ -776,7 +776,10 @@ class TreeSelect extends Component<TreeSelectProps, TreeSelectState> {
         } else {
             // 如过 filterLocal 并且 showSearch 但是没有 searchedValue 的时候，也需要设置 expandedKeys
             if (filterLocal && showSearch) {
-                treeProps.expandedKeys = expandedKeys;
+                // 当 expandedKeys 有值的时候再设置，否则报纸原状，否则会导致选择后展开的节点丢失
+                if (Array.isArray(expandedKeys) && expandedKeys.length) {
+                    treeProps.expandedKeys = expandedKeys;
+                }
                 treeProps.autoExpandParent = autoExpandParent;
                 treeProps.onExpand = this.handleExpand;
             }
```

---

### Incident Patch 4: `872eaf1c` (2025-05-12)
**Commit Message**: fix(TreeSelect): fix expandedKeys bug when search by searchValue is empty and treeDefaultExpandAll is true

**File**: `components/tree-select/__tests__/index-spec.tsx` (modified, +22/-0)
```diff
@@ -929,6 +929,28 @@ describe('TreeSelect', () => {
         cy.contains('.next-select-values', '服装/男装');
     });
 
+    it('should expandedAll when search by searchValue is empty and treeDefaultExpandAll is true', () => {
+        const searchedValue = '外套';
+        const handleSearch = cy.spy();
+
+        cy.mount(
+            <TreeSelect
+                defaultVisible
+                treeDefaultExpandAll
+                dataSource={dataSource}
+                showSearch
+                onSearch={debounce(handleSearch, 20)} // Debounce for simulate Cypress action type below
+            />
+        );
+        cy.get('.next-select-trigger-search input').type(searchedValue);
+        cy.get('.next-tree-node').then($el => {
+            const list = $el.filter('[style!="display: none;"]');
+            cy.wrap(list).should('have.length', 3);
+        });
+        cy.get('.next-select-trigger-search input').clear();
+        cy.get('.next-tree-node').should('have.length', 6);
+    });
+
     describe('should support useDetailValue', () => {
         it('Support dataSource mode', () => {
             const handleChange = cy.spy();
```

**File**: `components/tree-select/tree-select.tsx` (modified, +6/-0)
```diff
@@ -774,6 +774,12 @@ class TreeSelect extends Component<TreeSelectProps, TreeSelectState> {
                 notFound = true;
             }
         } else {
+            // 如过 filterLocal 并且 showSearch 但是没有 searchedValue 的时候，也需要设置 expandedKeys
+            if (filterLocal && showSearch) {
+                treeProps.expandedKeys = expandedKeys;
+                treeProps.autoExpandParent = autoExpandParent;
+                treeProps.onExpand = this.handleExpand;
+            }
             // eslint-disable-next-line
             if (dataSource) {
                 if (dataSource.length) {
```

---

### Incident Patch 5: `ae24d96f` (2025-11-12)
**Commit Message**: fix(Drawer): ensure correct padding-right is applied to body when Drawer is opened with scroll

**File**: `components/drawer/__tests__/index-v2-spec.tsx` (modified, +42/-0)
```diff
@@ -105,4 +105,46 @@ describe('Drawer v2', () => {
             hide();
         });
     });
+    it('should add paddingRight to body when body is scroll on open Drawer', () => {
+        let tallDiv: HTMLDivElement;
+
+        // 创建一个高元素使 body 产生滚动条
+        cy.document().then(doc => {
+            tallDiv = doc.createElement('div');
+            tallDiv.style.height = '110vh';
+            tallDiv.setAttribute('data-test-element', 'scroll-trigger'); // 添加标识方便查找
+            doc.body.appendChild(tallDiv);
+        });
+
+        // 设置初始 padding-right
+        cy.get('body').invoke('css', 'padding-right', '10px');
+        cy.get('body').invoke('css', 'overflow', 'auto');
+
+        cy.mount(
+            <Drawer v2 visible title="test" closeMode={[]}>
+                body
+            </Drawer>
+        );
+
+        cy.then(() => {
+            const scrollDiv = document.createElement('div');
+            scrollDiv.className = 'just-to-get-scrollbar-size';
+            scrollDiv.style.width = '100px';
+            scrollDiv.style.height = '100px';
+            scrollDiv.style.overflow = 'scroll';
+            scrollDiv.style.position = 'absolute';
+            scrollDiv.style.top = '-9999px';
+            document.body.appendChild(scrollDiv);
+            const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
+            document.body.removeChild(scrollDiv);
+            cy.get('body').should('have.css', 'padding-right', `${10 + scrollbarWidth}px`);
+        });
+
+        // 清理添加的元素
+        cy.then(() => {
+            if (tallDiv && tallDiv.parentNode) {
+                tallDiv.parentNode.removeChild(tallDiv);
+            }
+        });
+    });
 });
```

**File**: `components/drawer/drawer-v2.tsx` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ const Drawer = (props: DrawerV2Props) => {
                 const scrollWidth = dom.scrollbar().width;
                 if (scrollWidth) {
                     style.paddingRight = `${
-                        dom.getStyle(document.body, 'paddingRight').toString() +
+                        (dom.getStyle(document.body, 'paddingRight') as number) +
                         dom.scrollbar().width
                     }px`;
                 }
```

---

### Incident Patch 6: `86b98cfc` (2025-03-10)
**Commit Message**: fix(*): fix the type inference error on the consumer side (#5030)

**File**: `components/breadcrumb/index.tsx` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ interface Child {
     };
 }
 
-interface BreadcrumbState {
+export interface BreadcrumbState {
     maxNode: number;
     prevMaxNode?: BreadcrumbProps['maxNode'];
 }
```

**File**: `components/split-button/index.tsx` (modified, +2/-2)
```diff
@@ -85,8 +85,8 @@ class SplitButton extends React.Component<SplitButtonProps> {
         visible: this.props.defaultVisible,
     };
 
-    private wrapper: HTMLDivElement | null = null;
-    private menu: HTMLUListElement | null = null;
+    wrapper: HTMLDivElement | null = null;
+    menu: HTMLUListElement | null = null;
 
     componentDidMount() {
         // 由于定位目标是 wrapper，如果弹层默认展开，wrapper 还未渲染，didMount 后强制再渲染一次，弹层重新定位
```

---

### Incident Patch 7: `bb46a4d9` (2025-01-21)
**Commit Message**: fix(Nav): the icon is not centered when the width of Nav in iconOnly mode is less than the default width

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -90,3 +90,4 @@ src/core-temp
 
 # tests snapshots diff
 components/**/__tests__/snapshots/__diff__/**
+cypress/screenshots/**
```

**File**: `components/nav/__docs__/demo/auto-width/index.css` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+.demo-ctl {
+    background-color: #f1f1f1;
+    border-left: 4px solid #0d599a;
+    color: #0a7ac3;
+    margin-bottom: 20px;
+    padding: 5px;
+}
+.demo-ctl .next-radio-group {
+    margin: 5px;
+}
```

**File**: `components/nav/__docs__/demo/auto-width/index.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# zh-CN order=2
+
+# 只显示图标-宽度自适应
+
+Nav 可设置 iconOnly 属性，只显示图标，以减少占用空间。通过设定 iconOnlyWidth 为 100%，可以实现 iconOnly 场景下 icon 自适应居中展示，需要注意的是这种情况下需要 Nav 外部容器有具体宽度。
+
+# en-US order=2
+
+# Only show icon - width adaptive
+
+The Nav component can be configured with the iconOnly property to display only icons, minimizing occupied space‌12. By setting iconOnlyWidth to 100%, the icons will auto-center adaptively in iconOnly mode‌2. Note that this requires the external container of Nav to have a specific width‌.
```

**File**: `components/nav/__docs__/demo/auto-width/index.tsx` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+import React from 'react';
+import ReactDOM from 'react-dom';
+import { Nav, Radio } from '@alifd/next';
+import type { NavProps } from '@alifd/next/types/nav';
+
+type AppState = Pick<
+    NavProps,
+    'iconOnly' | 'hasTooltip' | 'hasArrow' | 'iconOnlyWidth' | 'iconTextOnly'
+> & {
+    width?: number;
+};
+
+const { Item, SubNav } = Nav;
+
+class App extends React.Component {
+    state: AppState = {
+        iconOnly: false,
+        hasTooltip: true,
+        hasArrow: true,
+        iconOnlyWidth: '100%',
+        iconTextOnly: false,
+        width: 200,
+    };
+
+    setValue(name: keyof AppState, value: string) {
+        this.setState({
+            [name]: value === 'true',
+        });
+    }
+
+    iconfontChange(value: string) {
+        const props: AppState = {};
+        props.iconOnly = value === 'true';
+        if (props.iconOnly) {
+            props.width = 40;
+        } else {
+            props.width = 200;
+        }
+        this.setState(props);
+    }
+
+    render() {
+        const { iconOnly, hasTooltip, hasArrow, iconTextOnly } = this.state;
+        return (
+            <div>
+                <div className="demo-ctl">
+                    <Radio.Group
+                        shape="button"
+                        size="medium"
+                        value={iconOnly && iconTextOnly ? 'trueText' : iconOnly ? 'true' : 'false'}
+                        onChange={this.iconfontChange.bind(this)}
+                    >
+                        <Radio value="true">iconOnly=true</Radio>
+                        <Radio value="false">iconOnly=false</Radio>
+                    </Radio.Group>
+                </div>
+                <div style={{ width: this.state.width }}>
+                    <Nav
+                        iconOnlyWidth={this.state.iconOnlyWidth}
+                        iconOnly={iconOnly}
+                        iconTextOnly={iconTextOnly}
+                        hasArrow={hasArrow}
+                        hasTooltip={hasTooltip}
+                        hozInLine
+                    >
+                        <Item icon="account">三个字</Item>
+                        <Item icon="account">四个字的</Item>
+                        <Item icon="account">五个字导航</Item>
+                        <Item icon={'atm'}>六个字的导航</Item>
+                        <Item icon={<span>QAQ</span>}>七个字的长导航</Item>
+                        <SubNav icon="account" label="Sub Nav">
+                            <Item icon="account">Item 1</Item>
+                            <Item icon="account">Item 2</Item>
+                            <Item icon="account">Item 3</Item>
+                            <Item icon="account">Item 4</Item>
+                        </SubNav>
+                    </Nav>
+                </div>
+            </div>
+        );
+    }
+}
+
+ReactDOM.render(<App />, mountNode);
```

**File**: `components/nav/__tests__/index-spec.tsx` (modified, +30/-0)
```diff
@@ -442,6 +442,36 @@ describe('Nav', () => {
             cy.get('#icononly-switch-item-2').should('have.css', 'padding-left', '40px');
         });
 
+        it('should align center when iconOnly and width < 58', () => {
+            cy.mount(
+                <div style={{ width: 40 }}>
+                    <Nav iconOnlyWidth="100%" iconOnly hasArrow hasTooltip>
+                        <Item icon="account">三个字</Item>
+                        <Item icon="account">四个字的</Item>
+                        <Item icon="account">五个字导航</Item>
+                        <Item icon={'atm'}>六个字的导航</Item>
+                        <Item icon={<span>QAQ</span>}>七个字的长导航</Item>
+                        <SubNav icon="account" label="Sub Nav">
+                            <Item icon="account">Item 1</Item>
+                            <Item icon="account">Item 2</Item>
+                            <Item icon="account">Item 3</Item>
+                            <Item icon="account">Item 4</Item>
+                        </SubNav>
+                    </Nav>
+                </div>
+            );
+            cy.get('.next-nav').then($el => {
+                const { width: navWidth, left: navLeft } = $el[0].getBoundingClientRect();
+                const { width, left } = document
+                    .querySelector('.next-menu-item.next-nav-item')!
+                    .getBoundingClientRect();
+                const target = Math.round(Math.abs(left - navLeft));
+                const expected = (navWidth - width) >> 1;
+                expect(width).not.equal(0);
+                expect(target).equal(expected);
+            });
+        });
+
         it('should support fixed', () => {
             cy.mount(
                 <Nav
```

---

### Incident Patch 8: `3f402b63` (2025-03-03)
**Commit Message**: fix(Field): fix use setError on uninitialized field caused incorrect values configuration

**File**: `components/field/__tests__/index-spec.tsx` (modified, +29/-0)
```diff
@@ -476,6 +476,35 @@ describe('field', () => {
             assert.deepEqual(field.init('list').value, [{ text: '2' }]);
             assert.equal(field.init('list[0].text').value, '2');
         });
+        it('Ensure data accuracy when using setError before init', () => {
+            const field = new Field(
+                {},
+                {
+                    values: {
+                        embed: {
+                            a: [],
+                            b: [],
+                        },
+                    },
+                    parseName: true,
+                }
+            );
+            assert.deepEqual(field.getValues(), {
+                embed: {
+                    a: [],
+                    b: [],
+                },
+            });
+            field.setValue('embed.b', [1, 2, 3]);
+            field.setError('embed.b', undefined);
+            field.init('embed.b');
+            assert.deepEqual(field.getValues(), {
+                embed: {
+                    a: [],
+                    b: [1, 2, 3],
+                },
+            });
+        });
     });
 
     describe('behaviour', () => {
```

**File**: `package-lock.json` (modified, +40/-8)
```diff
@@ -9,7 +9,7 @@
       "version": "1.27.31",
       "license": "MIT",
       "dependencies": {
-        "@alifd/field": "~2.0.3",
+        "@alifd/field": "^2.0.4",
         "@alifd/overlay": "^0.3.3",
         "@alifd/validate": "~2.0.3",
         "@types/react-transition-group": "^4.4.6",
@@ -341,9 +341,9 @@
       }
     },
     "node_modules/@alifd/field": {
-      "version": "2.0.3",
-      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.3.tgz",
-      "integrity": "sha512-Bq7lPT6lyjO+2A/9iZLt09Ix6IJruqmd/KYiJW1fbPecIokLQ0cgwCoU4fTxGBS2trR9n/o3kIhWt731PDERdg==",
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.4.tgz",
+      "integrity": "sha512-CE+WsMmxuCYgJ6dlRnNexQA7pl172OF6SyaHXTs+cO3ITM3UgmFvl+G8urRjWFxCFGigzLv0IpPu8KeP07VZAA==",
       "dependencies": {
         "@alifd/validate": "^2.0.2",
         "tslib": "^2.6.2"
@@ -400,6 +400,22 @@
         "react-dom": "^16.13.1"
       }
     },
+    "node_modules/@alifd/meet-react/node_modules/@alifd/field": {
+      "version": "1.7.0",
+      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-1.7.0.tgz",
+      "integrity": "sha512-rXqtuJudWaSl+1EOjUqr1OHUh8PWnzvyMmm6sKev9uTbctrt+pHEkRh3fbXebJhtEXgZbqhh/UM2afqy1nIIeA==",
+      "dev": true,
+      "dependencies": {
+        "@alifd/validate": "^1.2.0",
+        "prop-types": "^15.5.8"
+      }
+    },
+    "node_modules/@alifd/meet-react/node_modules/@alifd/validate": {
+      "version": "1.4.0",
+      "resolved": "https://registry.npmjs.org/@alifd/validate/-/validate-1.4.0.tgz",
+      "integrity": "sha512-RNayg1HVrJBhP5wOmjRq9x0xCC/2H1isDy038V69ggPyAP0k+3JAzIZKNkDoCLJlF4dWPCcsSwXaJafr0A60Wg==",
+      "dev": true
+    },
     "node_modules/@alifd/meet-react/node_modules/classnames": {
       "version": "2.2.6",
       "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.2.6.tgz",
@@ -36443,9 +36459,9 @@
       "dev": true
     },
     "@alifd/field": {
-      "version": "2.0.3",
-      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.3.tgz",
-      "integrity": "sha512-Bq7lPT6lyjO+2A/9iZLt09Ix6IJruqmd/KYiJW1fbPecIokLQ0cgwCoU4fTxGBS2trR9n/o3kIhWt731PDERdg==",
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.4.tgz",
+      "integrity": "sha512-CE+WsMmxuCYgJ6dlRnNexQA7pl172OF6SyaHXTs+cO3ITM3UgmFvl+G8urRjWFxCFGigzLv0IpPu8KeP07VZAA==",
       "requires": {
         "@alifd/validate": "^2.0.2",
         "tslib": "^2.6.2"
@@ -36457,7 +36473,7 @@
       "integrity": "sha512-rGzn1rXbMRhEEcs9Le6ZCYK6PPWtdmbMfIFx2M4P2JwH8erIfV95i7x24djHrMD4FxI45SO8aCxcVUrZoN/1SQ==",
       "dev": true,
       "requires": {
-        "@alifd/field": "~2.0.3",
+        "@alifd/field": "^1.4.3",
         "@alifd/meet-react-component-one": "^1.3.0",
         "@uni/clipboard": "^1.0.6",
         "@uni/env": "^1.0.7",
@@ -36476,6 +36492,22 @@
         "universal-element": "^0.0.6"
       },
       "dependencies": {
+        "@alifd/field": {
+          "version": "1.7.0",
+          "resolved": "https://registry.npmjs.org/@alifd/field/-/field-1.7.0.tgz",
+          "integrity": "sha512-rXqtuJudWaSl+1EOjUqr1OHUh8PWnzvyMmm6sKev9uTbctrt+pHEkRh3fbXebJhtEXgZbqhh/UM2afqy1nIIeA==",
+          "dev": true,
+          "requires": {
+            "@alifd/validate": "^1.2.0",
+            "prop-types": "^15.5.8"
+          }
+        },
+        "@alifd/validate": {
+          "version": "1.4.0",
+          "resolved": "https://registry.npmjs.org/@alifd/validate/-/validate-1.4.0.tgz",
+          "integrity": "sha512-RNayg1HVrJBhP5wOmjRq9x0xCC/2H1isDy038V69ggPyAP0k+3JAzIZKNkDoCLJlF4dWPCcsSwXaJafr0A60Wg==",
+          "dev": true
+        },
         "classnames": {
           "version": "2.2.6",
           "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.2.6.tgz",
```

**File**: `package.json` (modified, +3/-3)
```diff
@@ -104,7 +104,7 @@
     ]
   },
   "dependencies": {
-    "@alifd/field": "~2.0.3",
+    "@alifd/field": "~2.0.4",
     "@alifd/overlay": "^0.3.3",
     "@alifd/validate": "~2.0.3",
     "@types/react-transition-group": "^4.4.6",
@@ -309,11 +309,11 @@
     "registry": "https://registry.npmjs.org"
   },
   "overrides": {
-    "@alifd/field": "~2.0.3",
+    "@alifd/field": "~2.0.4",
     "cheerio": "1.0.0-rc.3"
   },
   "resolutions": {
-    "@alifd/field": "~2.0.3",
+    "@alifd/field": "~2.0.4",
     "cheerio": "1.0.0-rc.3"
   }
 }
```

---

### Incident Patch 9: `a5e1284c` (2025-03-03)
**Commit Message**: fix(TimePicker2):  support set locale by ConfigProvider

**File**: `components/time-picker2/__tests__/index-spec.tsx` (modified, +12/-0)
```diff
@@ -1,6 +1,8 @@
 import React from 'react';
 import dayjs, { type Dayjs } from 'dayjs';
 import TimePicker2, { type TimePickerProps } from '../index';
+import ConfigProvider from '../../config-provider';
+import enUS from '../../locale/en-us';
 import '../../time-picker/style';
 
 const defaultValue = dayjs('11:12:13', 'HH:mm:ss', true);
@@ -283,6 +285,16 @@ describe('TimePicker2', () => {
             cy.get(timeInput).type('{ctrl+downarrow}', { force: true });
             cy.get(timeInput).should('have.value', '00:00:00');
         });
+
+        it('should can set locale by ConfigProvider', () => {
+            cy.mount(
+                <ConfigProvider locale={enUS}>
+                    <TimePicker2 />
+                </ConfigProvider>
+            );
+            const timeInput = '.next-time-picker2-input input';
+            cy.get(timeInput).should('have.attr', 'placeholder', enUS.TimePicker.placeholder);
+        });
     });
 
     describe('range', () => {
```

**File**: `components/time-picker2/index.tsx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import type { TimePickerProps, ValueType, RangePickerProps, PresetType } from '.
 
 const ConfigTimePicker = ConfigProvider.config(TimePicker);
 
-const TimePickerWithSub = assignSubComponent(TimePicker, {
+const TimePickerWithSub = assignSubComponent(ConfigTimePicker, {
     RangePicker: React.forwardRef(
         (props: TimePickerProps, ref: LegacyRef<ComponentRef<typeof ConfigTimePicker>>) => (
             <ConfigTimePicker ref={ref} {...props} type="range" />
```

---

### Incident Patch 10: `7758e221` (2025-01-06)
**Commit Message**: chore(Tools): fix some tools error

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@alifd/next",
-  "version": "1.27.29",
+  "version": "1.27.30",
   "lockfileVersion": 2,
   "requires": true,
   "packages": {
     "": {
       "name": "@alifd/next",
-      "version": "1.27.29",
+      "version": "1.27.30",
       "license": "MIT",
       "dependencies": {
         "@alifd/field": "~2.0.3",
```

**File**: `tools/build/dist.ts` (modified, +3/-3)
```diff
@@ -15,11 +15,11 @@ const distPath = resolve(CWD, 'dist');
 
 export function registryDist(file = __filename) {
     return registryTask(file, 'dist', async function () {
-        registryTask(file, 'dist:clean', () => {
+        await registryTask(file, 'dist:clean', () => {
             removeSync(distPath);
         });
-        registryTask(file, 'dist:next', pack);
-        registryTask(file, 'dist:next:minify', pack.bind(undefined, true));
+        await registryTask(file, 'dist:next', pack);
+        await registryTask(file, 'dist:next:minify', pack.bind(undefined, true));
         await registryTask(file, 'dist:adaptor', packAdaptor.run, packAdaptor.rollback);
     });
 }
```

**File**: `tsconfig.json` (modified, +1/-1)
```diff
@@ -23,5 +23,5 @@
             "@alifd/next/types/*": ["./components/*"]
         }
     },
-    "include": ["global.d.ts", "cypress/**/*.ts", "./components/**/*.ts", "./components/**/*.tsx", "tools"]
+    "include": ["*.ts", "cypress/**/*.ts", "./components/**/*.ts", "./components/**/*.tsx", "tools"]
 }
```

#### Recent Merged Pull Requests:
- **PR #5109** (closed): chore(deps-dev): bump postcss from 7.0.39 to 8.5.23 (@dependabot[bot])
- **PR #5108** (closed): chore(deps): bump socket.io-parser and karma (@dependabot[bot])
- **PR #5107** (closed): chore(deps-dev): bump postcss from 7.0.39 to 8.5.18 (@dependabot[bot])
- **PR #5106** (closed): chore(deps): bump shell-quote and react-dev-utils (@dependabot[bot])
- **PR #5105** (closed): chore(deps): bump linkify-it and markdown-it (@dependabot[bot])
- **PR #5104** (closed): chore(deps): bump immutable from 4.3.4 to 4.3.9 (@dependabot[bot])
- **PR #5102** (closed): chore(deps): bump websocket-driver from 0.7.4 to 0.7.5 (@dependabot[bot])
- **PR #5100** (closed): chore(deps-dev): bump vite and @vitejs/plugin-react (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
