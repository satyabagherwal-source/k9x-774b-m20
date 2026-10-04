# Forensic Learning Record (Deep Inspection): oliviertassinari/react-swipeable-views

> **Canonical Artifact**: `07_PROJECT_LEARNING/oliviertassinari-react-swipeable-views-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oliviertassinari/react-swipeable-views](https://github.com/oliviertassinari/react-swipeable-views))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:11:37.099Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oliviertassinari/react-swipeable-views`
- **Description**: A React component for swipeable views. :snowflake:
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4469 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/react-swipeable-views-core/src/checkIndexBounds.js`
```
import React from 'react';
import warning from 'warning';

const checkIndexBounds = props => {
  const { index, children } = props;

  const childrenCount = React.Children.count(children);

  warning(
    index >= 0 && index <= childrenCount,
    `react-swipeable-view: the new index: ${index} is out of bounds: [0-${childrenCount}].`,
  );
};

export default checkIndexBounds;

```

### Core Architecture Module: `packages/react-swipeable-views-core/src/computeIndex.js`
```
import React from 'react';
import constant from './constant';

export default function computeIndex(params) {
  const { children, startIndex, startX, pageX, viewLength, resistance } = params;

  const indexMax = React.Children.count(children) - 1;
  let index = startIndex + (startX - pageX) / viewLength;
  let newStartX;

  if (!resistance) {
    // Reset the starting point
    if (index < 0) {
      index = 0;
      newStartX = (index - startIndex) * viewLength + pageX;
    } else if (index > indexMax) {
      index = indexMax;
      newStartX = (index - startIndex) * viewLength + pageX;
    }
  } else if (index < 0) {
    index = Math.exp(index * constant.RESISTANCE_COEF) - 1;
  } else if (index > indexMax) {
    index = indexMax + 1 - Math.exp((indexMax - index) * constant.RESISTANCE_COEF);
  }

  return {
    index,
    startX: newStartX,
  };
}

```

### Core Architecture Module: `packages/react-swipeable-views-core/src/constant.js`
```
export default {
  RESISTANCE_COEF: 0.6,

  // This value is closed to what browsers are using internally to
  // trigger a native scroll.
  UNCERTAINTY_THRESHOLD: 3, // px
};

```

### Core Architecture Module: `packages/react-swipeable-views-core/src/getDisplaySameSlide.js`
```
import React from 'react';

const getDisplaySameSlide = (props, nextProps) => {
  let displaySameSlide = false;
  const getChildrenKey = child => (child ? child.key : 'empty');

  if (props.children.length && nextProps.children.length) {
    const oldKeys = React.Children.map(props.children, getChildrenKey);
    const oldKey = oldKeys[props.index];

    if (oldKey !== null && oldKey !== undefined) {
      const newKeys = React.Children.map(nextProps.children, getChildrenKey);
      const newKey = newKeys[nextProps.index];

      if (oldKey === newKey) {
        displaySameSlide = true;
      }
    }
  }

  return displaySameSlide;
};

export default getDisplaySameSlide;

```

### Core Architecture Module: `packages/react-swipeable-views-core/src/index.js`
```
export { default as checkIndexBounds } from './checkIndexBounds';
export { default as computeIndex } from './computeIndex';
export { default as constant } from './constant';
export { default as getDisplaySameSlide } from './getDisplaySameSlide';
export { default as mod } from './mod';

```

### Core Architecture Module: `packages/react-swipeable-views-core/src/mod.js`
```
// Extended version of % with negative integer support.
function mod(n, m) {
  const q = n % m;
  return q < 0 ? q + m : q;
}

export default mod;

```

### Core Architecture Module: `packages/react-swipeable-views-utils/src/autoPlay.js`
```
import React from 'react';
import PropTypes from 'prop-types';
import { shallowEqualObjects } from 'shallow-equal';
import EventListener from 'react-event-listener';
import { mod } from 'react-swipeable-views-core';

export default function autoPlay(MyComponent) {
  class AutoPlay extends React.Component {
    timer = null;

    constructor(props) {
      super(props);

      this.state.index = props.index || 0;
    }

    state = {};

    componentDidMount() {
      this.startInterval();
    }

    // eslint-disable-next-line camelcase,react/sort-comp
    UNSAFE_componentWillReceiveProps(nextProps) {
      const { index } = nextProps;

      if (typeof index === 'number' && index !== this.props.index) {
        this.setState({
          index,
        });
      }
    }

    componentDidUpdate(prevProps) {
      const shouldResetInterval = !shallowEqualObjects(
        {
          index: prevProps.index,
          interval: prevProps.interval,
          autoplay: prevProps.autoplay,
        },
        {
          index: this.props.index,
          interval: this.props.interval,
          autoplay: this.props.autoplay,
        },
      );

      if (shouldResetInterval) {
        this.startInterval();
      }
    }

    componentWillUnmount() {
      clearInterval(this.timer);
    }

    handleInterval = () => {
      const { children, direction, onChangeIndex, slideCount } = this.props;

      const indexLatest = this.state.index;
      let indexNew = indexLatest;

      if (direction === 'incremental') {
        indexNew += 1;
      } else {
        indexNew -= 1;
      }

      if (slideCount || children) {
        indexNew = mod(indexNew, slideCount || React.Children.count(children));
      }

      // Is uncontrolled
      if (this.props.index === undefined) {
        this.setState({
          index: indexNew,
        });
      }

      if (onChangeIndex) {
        onChangeIndex(indexNew, indexLatest);
      }
    };

    handleChangeIndex = (index, indexLatest, meta) => {
      // Is uncontrolled
      if (this.props.index === undefined) {
        this.setState({
          index,
        });
      }

      if (this.props.onChangeIndex) {
        this.props.onChangeIndex(index, indexLatest, meta);
      }
    };

    handleSwitching = (index, type) => {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      } else if (type === 'end') {
        this.startInterval();
      }

      if (this.props.onSwitching) {
        this.props.onSwitching(index, type);
      }
    };

    handleVisibilityChange = e => {
      if (e.target.hidden) {
        clearInterval(this.timer);
      } else {
        this.startInterval();
      }
    };

    startInterval() {
      const { autoplay, interval } = this.props;

      clearInterval(this.timer);

      if (autoplay) {
        this.timer = setInterval(this.handleInterval, interval);
      }
    }

    render() {
      const {
        autoplay,
        direction,
        index: indexProp,
        interval,
        onChangeIndex,
        ...other
      } = this.props;

      const { index } = this.state;

      if (!autoplay) {
        return <MyComponent index={index} onChangeIndex={onChangeIndex} {...other} />;
      }

      return (
        <EventListener target="document" onVisibilityChange={this.handleVisibilityChange}>
          <MyComponent
            index={index}
            onChangeIndex={this.handleChangeIndex}
            onSwitching={this.handleSwitching}
            {...other}
          />
        </EventListener>
      );
    }
  }

  AutoPlay.propTypes = {
    /**
     * If `false`, the auto play behavior is disabled.
     */
    autoplay: PropTypes.bool,
    /**
     * @ignore
     */
    children: PropTypes.node,
    /**
     * This is the auto play direction.
     */
    direction: PropTypes.oneOf(['incremental', 'decremental']),
    /**
     * @ignore
     */
    index: PropTypes.number,
    /**
     * Delay between auto play transitions (in ms).
     */
    interval: PropTypes.number,
    /**
     * @ignore
     */
    onChangeIndex: PropTypes.func,
    /**
     * @ignore
     */
    onSwitching: PropTypes.func,
    /**
     * @ignore
     */
    slideCount: PropTypes.number,
  };

  AutoPlay.defaultProps = {
    autoplay: true,
    direction: 'incremental',
    interval: 3000,
  };

  return AutoPlay;
}

```

### Core Architecture Module: `packages/react-swipeable-views-utils/src/bindKeyboard.js`
```
import React from 'react';
import PropTypes from 'prop-types';
import keycode from 'keycode';
import EventListener from 'react-event-listener';
import { mod } from 'react-swipeable-views-core';

export default function bindKeyboard(MyComponent) {
  class BindKeyboard extends React.Component {
    static propTypes = {
      /**
       * @ignore
       */
      axis: PropTypes.oneOf(['x', 'x-reverse', 'y', 'y-reverse']),
      /**
       * @ignore
       */
      children: PropTypes.node,
      /**
       * @ignore
       */
      index: PropTypes.number,
      /**
       * @ignore
       */
      onChangeIndex: PropTypes.func,
      /**
       * @ignore
       */
      slideCount: PropTypes.number,
    };

    state = {};

    // eslint-disable-next-line camelcase,react/sort-comp
    UNSAFE_componentWillMount() {
      this.setState({
        index: this.props.index || 0,
      });
    }

    // eslint-disable-next-line camelcase,react/sort-comp
    UNSAFE_componentWillReceiveProps(nextProps) {
      const { index } = nextProps;

      if (typeof index === 'number' && index !== this.props.index) {
        this.setState({
          index,
        });
      }
    }

    handleKeyDown = event => {
      let action;
      const { axis = 'x', children, onChangeIndex, slideCount } = this.props;

      switch (keycode(event)) {
        case 'page down':
        case 'down':
          if (axis === 'y') {
            action = 'decrease';
          } else if (axis === 'y-reverse') {
            action = 'increase';
          }
          break;

        case 'left':
          if (axis === 'x') {
            action = 'decrease';
          } else if (axis === 'x-reverse') {
            action = 'increase';
          }
          break;

        case 'page up':
        case 'up':
          if (axis === 'y') {
            action = 'increase';
          } else if (axis === 'y-reverse') {
            action = 'decrease';
          }
          break;

        case 'right':
          if (axis === 'x') {
            action = 'increase';
          } else if (axis === 'x-reverse') {
            action = 'decrease';
          }
          break;

        default:
          break;
      }

      if (action) {
        const indexLatest = this.state.index;
        let indexNew = indexLatest;

        if (action === 'increase') {
          indexNew += 1;
        } else {
          indexNew -= 1;
        }

        if (slideCount || children) {
          indexNew = mod(indexNew, slideCount || React.Children.count(children));
        }

        // Is uncontrolled
        if (this.props.index === undefined) {
          this.setState({
            index: indexNew,
          });
        }

        if (onChangeIndex) {
          onChangeIndex(indexNew, indexLatest);
        }
      }
    };

    handleChangeIndex = (index, indexLatest, meta) => {
      // Is uncontrolled
      if (this.props.index === undefined) {
        this.setState({
          index,
        });
      }

      if (this.props.onChangeIndex) {
        this.props.onChangeIndex(index, indexLatest, meta);
      }
    };

    render() {
      const { index: indexProp, onChangeIndex, ...other } = this.props;

      const { index } = this.state;

      return (
        <EventListener target="window" onKeyDown={this.handleKeyDown}>
          <MyComponent index={index} onChangeIndex={this.handleChangeIndex} {...other} />
        </EventListener>
      );
    }
  }

  return BindKeyboard;
}

```

### Core Architecture Module: `packages/react-swipeable-views-utils/src/index.js`
```
export { default as autoPlay } from './autoPlay';
export { default as bindKeyboard } from './bindKeyboard';
export { default as virtualize } from './virtualize';

```

### Core Architecture Module: `packages/react-swipeable-views-utils/src/virtualize.js`
```
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { mod } from 'react-swipeable-views-core';

export default function virtualize(MyComponent) {
  class Virtualize extends PureComponent {
    timer = null;

    constructor(props) {
      super(props);
      this.state.index = props.index || 0;
    }

    /**
     *
     *           index          indexStop
     *             |              |
     * indexStart  |       indexContainer
     *   |         |         |    |
     * ------------|-------------------------->
     *  -2    -1   0    1    2    3    4    5
     */
    state = {};

    // eslint-disable-next-line camelcase,react/sort-comp
    UNSAFE_componentWillMount() {
      this.setWindow(this.state.index);
    }

    // eslint-disable-next-line camelcase,react/sort-comp
    UNSAFE_componentWillReceiveProps(nextProps) {
      const { index } = nextProps;

      if (typeof index === 'number' && index !== this.props.index) {
        const indexDiff = index - this.props.index;
        this.setIndex(index, this.state.indexContainer + indexDiff, indexDiff);
      }
    }

    componentWillUnmount() {
      clearInterval(this.timer);
    }

    setIndex(index, indexContainer, indexDiff) {
      const nextState = {
        index,
        indexContainer,
        indexStart: this.state.indexStart,
        indexStop: this.state.indexStop,
      };

      // We are going forward, let's render one more slide ahead.
      if (
        indexDiff > 0 &&
        (!this.props.slideCount || nextState.indexStop < this.props.slideCount - 1)
      ) {
        nextState.indexStop += 1;
      }

      // Extend the bounds if needed.
      if (index > nextState.indexStop) {
        nextState.indexStop = index;
      }

      const beforeAhead = nextState.indexStart - index;

      // Extend the bounds if needed.
      if (beforeAhead > 0) {
        nextState.indexContainer += beforeAhead;
        nextState.indexStart -= beforeAhead;
      }

      this.setState(nextState);
    }

    setWindow(index = this.state.index) {
      const { slideCount } = this.props;

      let beforeAhead = this.props.overscanSlideBefore;
      let afterAhead = this.props.overscanSlideAfter;

      if (slideCount) {
        if (beforeAhead > index) {
          beforeAhead = index;
        }

        if (afterAhead + index > slideCount - 1) {
          afterAhead = slideCount - index - 1;
        }
      }

      this.setState({
        indexContainer: beforeAhead,
        indexStart: index - beforeAhead,
        indexStop: index + afterAhead,
      });
    }

    handleChangeIndex = (indexContainer, indexLatest, meta) => {
      const { slideCount, onChangeIndex } = this.props;

      const indexDiff = indexContainer - indexLatest;
      let index = this.state.index + indexDiff;

      if (slideCount) {
        index = mod(index, slideCount);
      }

      // Is uncontrolled
      if (this.props.index === undefined) {
        this.setIndex(index, indexContainer, indexDiff);
      }

      if (onChangeIndex) {
        onChangeIndex(index, this.state.index, meta);
      }
    };

    handleSwitching = (indexContainer, type) => {
      const { slideCount, onSwitching } = this.props;
      const { indexStart } = this.state;

      let index = indexContainer + indexStart;

      if (slideCount) {
        index = mod(index, slideCount);
      }

      if (onSwitching) {
        onSwitching(index, type);
      }
    };

    handleTransitionEnd = () => {
      // Delay the update of the window to fix an issue with react-motion.
      this.timer = setTimeout(() => {
        this.setWindow();
      }, 0);

      if (this.props.onTransitionEnd) {
        this.props.onTransitionEnd();
      }
    };

    render() {
      const {
        children,
        index: indexProp,
        onChangeIndex,
        onSwitching,
        onTransitionEnd,
        overscanSlideAfter,
        overscanSlideBefore,
        slideCount,
        slideRenderer,
        ...other
      } = this.props;

      const { indexContainer, indexStart, indexStop } = this.state;

      const slides = [];

      for (let slideIndex = indexStart; slideIndex <= indexStop; slideIndex += 1) {
        slides.push(
          slideRenderer({
            index: slideIndex,
            key: slideIndex,
          }),
        );
      }

      return (
        <MyComponent
          index={indexContainer}
          onChangeIndex={this.handleChangeIndex}
          onSwitching={this.handleSwitching}
          onTransitionEnd={this.handleTransitionEnd}
          {...other}
        >
          {slides}
        </MyComponent>
      );
    }
  }

  Virtualize.propTypes = {
    /**
     * @ignore
     */
    children: (props, propName) => {
      if (props[propName] !== undefined) {
        return new Error("The children property isn't supported.");
      }

      return null;
    },
    /**
     * @ignore
     */
    index: PropTypes.number,
    /**
     * @ignore
     */
    onChangeIndex: PropTypes.func,
    /**
     * @ignore
     */
    onTransitionEnd: PropTypes.func,
    /**
     * Number of slide to render after the visible slide.
     */
    overscanSlideAfter: PropTypes.number,
    /**
     * Number of slide to render before the visible slide.
     */
    overscanSlideBefore: PropTypes.number,
    /**
     * When set, it's adding a limit to the number of slide: [0, slideCount].
     */
    slideCount: PropTypes.number,
    /**
     * Responsible for rendering a slide given an index.
     * ({ index: number }): node.
     */
    slideRenderer: PropTypes.func.isRequired,
  };

  Virtualize.defaultProps = {
    overscanSlideAfter: 2,
    // Render one more slide for going backward as it's more difficult to
    // keep the window up to date.
    overscanSlideBefore: 3,
  };

  return Virtualize;
}

```

### Core Architecture Module: `.eslintrc.js`
```
const path = require('path');

module.exports = {
  // So parent files don't get applied
  root: true,
  globals: {
    preval: false,
  },
  env: {
    es6: true,
    browser: true,
    node: true,
    mocha: true,
  },
  extends: ['plugin:import/recommended', 'airbnb'],
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 7,
    sourceType: 'module',
  },
  plugins: ['babel', 'import', 'jsx-a11y', 'mocha', 'prettier'],
  settings: {
    'import/resolver': {
      webpack: {
        config: path.join(__dirname, './docs/webpackBaseConfig.js'),
      },
    },
  },
  rules: {
    'linebreak-style': 'off', // Don't play nicely with Windows
    'arrow-body-style': 'off', // Incompatible with prettier
    'arrow-parens': 'off', // Incompatible with prettier
    'object-curly-newline': 'off', // Incompatible with prettier
    'function-paren-newline': 'off', // Incompatible with prettier
    indent: 'off', // Incompatible with prettier
    'implicit-arrow-linebreak': 'off', // Incompatible with prettier
    'space-before-function-paren': 'off', // Incompatible with prettier
    'no-confusing-arrow': 'off', // Incompatible with prettier
    'no-mixed-operators': 'off', // Incompatible with prettier
    'consistent-this': ['error', 'self'],
    'max-len': [
      'error',
      100,
      2,
      {
        ignoreUrls: true,
      },
    ], // airbnb is allowing some edge cases
    'no-console': 'error', // airbnb is using warn
    'prefer-destructuring': 'off', // airbnb is using error. destructuring harm grep potential.
    'no-alert': 'error', // airbnb is using warn
    'no-param-reassign': 'off', // airbnb use error
    'no-prototype-builtins': 'off', // airbnb use error
    'operator-linebreak': 'off', // airbnb use error

    // It would be better to enable this rule, but it might slow us down.
    'import/no-extraneous-dependencies': 'off',
    'import/namespace': ['error', { allowComputed: true }],
    'import/order': [
      'error',
      {
        groups: [['index', 'sibling', 'parent', 'internal', 'external', 'builtin']],
        'newlines-between': 'never',
      },
    ],
    'import/no-unresolved': 'off', // To fix at some point

    'react/jsx-indent': 'off', // Incompatible with prettier
    'react/jsx-closing-bracket-location': 'off', // Incompatible with prettier
    'react/jsx-wrap-multilines': 'off', // Incompatible with prettier
    'react/jsx-indent-props': 'off', // Incompatible with prettier
    'react/jsx-one-expression-per-line': 'off', // Incompatible with prettier
    'react/jsx-handler-names': [
      'error',
      {
        // airbnb is disabling this rule
        eventHandlerPrefix: 'handle',
        eventHandlerPropPrefix: 'on',
      },
    ],
    'react/jsx-curly-brace-presence': 'off', // airbnb use error, it's buggy
    'react/forbid-prop-types': 'off', // airbnb use error
    'react/require-default-props': 'off', // airbnb use error, it's buggy
    'react/destructuring-assignment': 'off', // airbnb use error
    'react/jsx-filename-extension': ['error', { extensions: ['.js'] }], // airbnb is using .jsx
    'react/no-danger': 'error', // airbnb is using warn
    'react/no-direct-mutation-state': 'error', // airbnb is using off
    'react/no-find-dom-node': 'off', // airbnb use error
    'react/sort-prop-types': 'error', // airbnb use off

    'mocha/handle-done-callback': 'error',
    'mocha/no-exclusive-tests': 'error',
    'mocha/no-global-tests': 'error',
    'mocha/no-pending-tests': 'error',
    'mocha/no-skipped-tests': 'error',

    'jsx-a11y/label-has-associated-control': 'off',
    'jsx-a11y/label-has-for': 'off',
    'jsx-a11y/no-autofocus': 'off', // We are a library, people do what they want.

    'prettier/prettier': ['error'],
  },
};

```

### Core Architecture Module: `babel.config.js`
```
let defaultPresets;

// We release a ES version of Material-UI.
// It's something that matches the latest official supported features of JavaScript.
// Nothing more (stage-1, etc), nothing less (require, etc).
if (process.env.BABEL_ENV === 'es') {
  defaultPresets = [];
} else {
  defaultPresets = [
    [
      '@babel/preset-env',
      {
        targets: {
          ie: 10,
          edge: 14,
          firefox: 28,
          chrome: 29,
          safari: 9,
          node: '6.11',
        },
        modules: ['modules', 'production-umd'].includes(process.env.BABEL_ENV) ? false : 'commonjs',
      },
    ],
  ];
}

module.exports = {
  presets: defaultPresets.concat(['@babel/preset-react']),
  plugins: [
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    [
      '@babel/plugin-proposal-object-rest-spread',
      {
        // Workaround for https://github.com/babel/babel/issues/8323
        loose: process.env.BABEL_ENV !== 'es',
      },
    ],
    '@babel/plugin-transform-object-assign',
    '@babel/plugin-transform-runtime',
  ],
  env: {
    coverage: {
      plugins: [
        'babel-plugin-istanbul',
        [
          'babel-plugin-module-resolver',
          {
            root: ['./'],
            alias: {
              pages: './pages',
              'react-swipeable-views': './packages/react-swipeable-views/src',
              'react-swipeable-views-utils': './packages/react-swipeable-views-utils/src',
              'react-swipeable-views-core': './packages/react-swipeable-views-core/src',
              docs: './docs',
            },
          },
        ],
      ],
    },
    development: {},
    'docs-development': {
      plugins: [
        'babel-plugin-preval',
        [
          'babel-plugin-module-resolver',
          {
            alias: {
              'react-swipeable-views': './packages/react-swipeable-views/src',
              'react-swipeable-views-core': './packages/react-swipeable-views-core/src',
              'react-swipeable-views-utils': './packages/react-swipeable-views-utils/src',
              docs: './docs',
              pages: './pages',
            },
          },
        ],
      ],
    },
    'docs-production': {
      plugins: [
        'babel-plugin-preval',
        [
          'babel-plugin-module-resolver',
          {
            alias: {
              'react-swipeable-views': './packages/react-swipeable-views/src',
              'react-swipeable-views-core': './packages/react-swipeable-views-core/src',
              'react-swipeable-views-utils': './packages/react-swipeable-views-utils/src',
              docs: './docs',
              pages: './pages',
            },
          },
        ],
        'transform-react-constant-elements',
        'transform-dev-warning',
        ['react-remove-properties', { properties: ['data-mui-test'] }],
        ['transform-react-remove-prop-types', { mode: 'remove' }],
      ],
    },
    es: {
      plugins: [
        'transform-react-constant-elements',
        'transform-dev-warning',
        ['react-remove-properties', { properties: ['data-mui-test'] }],
        [
          'transform-react-remove-prop-types',
          {
            mode: 'wrap',
          },
        ],
      ],
      // It's most likely a babel bug.
      // We are using this ignore option in the CLI command but that has no effect.
      ignore: ['**/*.test.js'],
    },
    production: {
      plugins: [
        'transform-react-constant-elements',
        'transform-dev-warning',
        ['react-remove-properties', { properties: ['data-mui-test'] }],
        [
          'transform-react-remove-prop-types',
          {
            mode: 'wrap',
          },
        ],
      ],
      // It's most likely a babel bug.
      // We are using this ignore option in the CLI command but that has no effect.
      ignore: ['**/*.test.js'],
    },
    'production-umd': {
      plugins: [
        'transform-react-constant-elements',
        'transform-dev-warning',
        ['react-remove-properties', { properties: ['data-mui-test'] }],
        [
          'transform-react-remove-prop-types',
          {
            mode: 'wrap',
          },
        ],
      ],
    },
    test: {
      sourceMaps: 'both',
      plugins: [
        [
          'babel-plugin-module-resolver',
          {
            root: ['./'],
            alias: {
              'react-swipeable-views': './packages/react-swipeable-views/src',
              'react-swipeable-views-core': './packages/react-swipeable-views-core/src',
              'react-swipeable-views-utils': './packages/react-swipeable-views-utils/src',
              docs: './docs',
              pages: './pages',
            },
          },
        ],
      ],
    },
  },
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #647** (2021-10-27): **fix(virtualize): onSwitching for Virtualize should called with correct index**
  *Symptoms*: fix #646
  **Post-Mortem & Fix Analysis**:
  > > Is there a way we could write a test case?  added
  > who is going to merge approved prs?

- **Issue #618** (2021-02-13): **Fix autoPlay HOC swallowing third parameter of onChangeIndex**
  *Symptoms*: Fixes #553, needs testing.

- **Issue #577** (2020-01-26): **Why are RC tags published under `latest` on npm**
  *Symptoms*:  - [x] I have searched the [issues](https://github.com/oliviertassinari/react-swipeable-views/issues) of this repository and believe that this is not a duplicate.  ## Expected Behavior RC tags should not be under `latest` tag on npm  ## Current Behavior RC tags are under `latest` tag on npm  I see that you publish a lot of RC versions on npm. May be these are for trying out things., is there a reason these are not published under `rc/beta/next` tag and are published under default `latest` tag on npm? Are these versions even usable/stable? 
  **Post-Mortem & Fix Analysis**:
  > Unfortunatly there are some issues publishing from my pc for this project, I can only release using npm publish instead of yarn release. this has been hunting me for weeks now, I dont own a mac pc to fix the yarn release command. I have contacted the owner to request for help.
  > i guess you can still do `npm publish --tag rc`
  > > Unfortunatly there are some issues publishing from my pc for this project, I can only release using npm publish instead of yarn release. > this has been hunting me for weeks now, I dont own a mac pc to fix the yarn release command. > I have contacted the owner to request for help.  Really appreciate the efforts put forth. Much love!

- **Issue #564** (2020-02-03): **Could not find module in path: 'dom-helpers/transition/properties' **
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above -->  <!--     Thank you very much for contributing to react-swipeable-views by creating an issue! ❤️     To avoid duplicate issues we ask you to check off the following list. -->  <!-- Checked checkbox should look like this: [x] --> - [x] I have searched the [issues](https://github.com/oliviertassinari/react-swipeable-views/issues) of this repository and believe that this is not a duplicate.  ## Expected Behavior <!---     If you're describing a bug, tell us what should happen.     If you're suggesting a change/improvement, tell us how it should work. -->  Clean installation of `react-swipeable-views` can be used with the example from the README.  ## Current Behavior <!---     If describing a bug, tell us what happens instead of the expected behavior.     If suggesting a change/improvement, explain the difference from current behavior. -->  ``` ModuleNotFoundError Could not find module in path: 'dom-helpers/transition/properties' relative to '/node_modules/react-swipeable-views/lib/SwipeableViews.js' ```  Seems to have been introduced by https://github.com/oliviertassinari/react-swipeable-views/pull/556  ## Steps to Reproduce (for bugs) <!---     Provide a link to a live example (you can use codesandbox.io) and an unambiguous set of steps to reproduce this bug.     Include code to reproduce, if relevant (which it most likely is).      This codesandbox.io template _may_ be a goo
  **Post-Mortem & Fix Analysis**:
  > Hi,  Thank you for your report, i will try to take a look at this tomorrow morning. We just created a release for version 0.13.4 but have unfortunatly not gotten around to testing it due to personal obstructions.  I will let you know when we fixed the issue
  > @jeanpoelie I've opened a PR which addresses the issue, please take a look when you've got time. Cheers!
  > I have checked and merged the PR, i will need to do a new release but have some issues due to me being on a windows pc and not having the option to use rm which is only available on mac

- **Issue #563** (2020-02-01): **Install issue with 0.13.4-rc.0**
  *Symptoms*: In latest release, I am seeing `Could not install from "node_modules/react-swipeable-views/packages/react-swipeable-views" as it does not contain a package.json file.` when I try to install.  (I am needing a release that includes https://github.com/oliviertassinari/react-swipeable-views/pull/556, because of version conflicts related to the dom-helpers library, which introduced unfortunate breaking changes awhile back)  <!--     Thank you very much for contributing to react-swipeable-views by creating an issue! ❤️     To avoid duplicate issues we ask you to check off the following list. -->  <!-- Checked checkbox should look like this: [x] --> - [x] I have searched the [issues](https://github.com/oliviertassinari/react-swipeable-views/issues) of this repository and believe that this is not a duplicate.  ## Steps to Reproduce (for bugs) Add `"react-swipeable-views": "0.13.4-rc.0",` to package.json and `npm install`  ## Your Environment npm 6.4.1 Mac OS X 10.5.1
  **Post-Mortem & Fix Analysis**:
  > Me too: I try:  yarn add react-swipeable-views ``` yarn add v1.21.1 [1/4] 🔍  Resolving packages... error Package "react-swipeable-views" refers to a non-existing file '".../packages/react-swipeable-views"'. info Visit https://yarnpkg.com/en/docs/cli/add for documentation about this command. Error: Package "react-swipeable-views-core" refers to a non-existing file '".../packages/react-swipeable-views-core"'.     at MessageError.ExtendableBuiltin (/usr/local/lib/node_modules/yarn/lib/cli.js:721:66)     at new MessageError (/usr/local/lib/node_modules/yarn/lib/cli.js:750:123)     at FileResolver.<anonymous> (/usr/local/lib/node_modules/yarn/lib/cli.js:50229:15)     at Generator.next (<anonymous>)     at step (/usr/local/lib/node_modules/yarn/lib/cli.js:310:30)     at /usr/local/lib/node_modules/yarn/lib/cli.js:321:13 Error: Package "react-swipeable-views-utils" refers to a non-existing file '".../packages/react-swipeable-views-utils"'.     at MessageError.ExtendableBuilti
  > Same here, on Ubuntu 18 (WSL). ``` $ yarn add react-swipeable-views yarn add v1.21.1 [1/5] Validating package.json... [2/5] Resolving packages... error Package "react-swipeable-views" refers to a non-existing file '"/mnt/c/Users/.../packages/react-swipeable-views"'. info Visit https://yarnpkg.com/en/docs/cli/add for documentation about this command. Error: Package "react-swipeable-views-core" refers to a non-existing file '"/mnt/c/Users/.../packages/react-swipeable-views-core"'.     at MessageError.ExtendableBuiltin (/usr/share/yarn/lib/cli.js:721:66)     at new MessageError (/usr/share/yarn/lib/cli.js:750:123)     at FileResolver.<anonymous> (/usr/share/yarn/lib/cli.js:50229:15)     at Generator.next (<anonymous>)     at step (/usr/share/yarn/lib/cli.js:310:30)     at /usr/share/yarn/lib/cli.js:321:13 Error: Package "react-swipeable-views-utils" refers to a non-existing file '"/mnt/c/Users/.../packages/react-swipeable-views-utils"'.     at MessageError.ExtendableBuilti
  > npm install --save react-swipeable-views@0.13.3  just install the old version that works fine

- **Issue #557** (2020-08-17): **Height not updating when wrapping an animation component to a tab**
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above -->  <!--     Thank you very much for contributing to react-swipeable-views by creating an issue! ❤️     To avoid duplicate issues we ask you to check off the following list. -->  <!-- Checked checkbox should look like this: [x] --> - [x] I have searched the [issues](https://github.com/oliviertassinari/react-swipeable-views/issues) of this repository and believe that this is not a duplicate.  ## Expected Behavior <!---     If you're describing a bug, tell us what should happen.     If you're suggesting a change/improvement, tell us how it should work. --> the height of each tab should automatically be updated by its content.  ## Current Behavior <!---     If describing a bug, tell us what happens instead of the expected behavior.     If suggesting a change/improvement, explain the difference from current behavior. --> When the slide's content changed, the height of the slide didn't update.  ## Steps to Reproduce (for bugs) <!---     Provide a link to a live example (you can use codesandbox.io) and an unambiguous set of steps to reproduce this bug.     Include code to reproduce, if relevant (which it most likely is).      This codesandbox.io template _may_ be a good starting point:     https://codesandbox.io/s/github/oliviertassinari/react-swipeable-views/tree/master/examples/create-react-app      If YOU DO NOT take time to provide a codesandbox.io reproduction, should the COMMUNITY
  **Post-Mortem & Fix Analysis**:
  > Hi,  This could be the solution for you but someone needs to fix the conflicts, i might have time for this next week.  https://github.com/oliviertassinari/react-swipeable-views/pull/537
  > The example you posted seems to work now. I added `enableMouseEvents` to [test it in browser](https://codesandbox.io/s/material-demo-forked-zunlm?file=/demo.js) and the content expands and collapses as expected. Do you still see this as an issue? 

- **Issue #553** (2021-02-13): **autoPlay HOC eats the meta parameter of onChangeIndex**
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above --> The `meta` parameter of the `onChangeIndex` callback is not present when using the autoPlay HOC. This is because it is not passed from the wrapped component back out to the callback. See [here](https://github.com/oliviertassinari/react-swipeable-views/blob/0066587f5989ff13e7c5fb19c6a553ba3b5c30e8/packages/react-swipeable-views-utils/src/autoPlay.js#L84)  <!--     Thank you very much for contributing to react-swipeable-views by creating an issue! ❤️     To avoid duplicate issues we ask you to check off the following list. -->  <!-- Checked checkbox should look like this: [x] --> - [x] I have searched the [issues](https://github.com/oliviertassinari/react-swipeable-views/issues) of this repository and believe that this is not a duplicate.  ## Expected Behavior <!---     If you're describing a bug, tell us what should happen.     If you're suggesting a change/improvement, tell us how it should work. --> The `meta` parameter should be provided to the `onChangeIndex` callback function when using the `autoPlay` HOC utility.  ## Current Behavior <!---     If describing a bug, tell us what happens instead of the expected behavior.     If suggesting a change/improvement, explain the difference from current behavior. --> The `meta` parameter is not passed to the callback.  ## Steps to Reproduce (for bugs) <!---     Provide a link to a live example (you can use codesandbox.io) and an unambiguo

- **Issue #508** (2019-05-10): **Autoplay is fast forwarding when switching back to browser tab**
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above --> When a swipeable view with autoplay is shown and the user hides that tab and comes back to it later, the swipeable view "fast forwards" and eventually slows down to normal speed.  Maybe this is related to Chrome somehow "batching" `setInterval` calls while a tab is hidden? :thinking:   <!--     Thank you very much for contributing to react-swipeable-views by creating an issue! ❤️     To avoid duplicate issues we ask you to check off the following list. -->  <!-- Checked checkbox should look like this: [x] --> - [x] I have searched the [issues](https://github.com/oliviertassinari/react-swipeable-views/issues) of this repository and believe that this is not a duplicate.  ## Expected Behavior The autoPlay swipeable view switches exactly every interval milliseconds in all cases but _does not_ switch if the tab is not visible or at least it doesn't fast-forward later.  ## Current Behavior When the slides are visible again, they "fast forward" and slow down to normal speed eventually.  ## Steps to Reproduce (for bugs) 1. Open a page in a tab with an autoPlay swipeable view, e.g. https://codesandbox.io/s/6ykr1vqo43 2. Switch to a different tab, grab a :coffee: or wait for about 10 seconds 3. Re-open the tab and see how the slides change very quickly at first (the more slides the more visible this issue becomes).  ## Context See https://github.com/TeamWertarbyte/material-auto-rotating-carouse
  **Post-Mortem & Fix Analysis**:
  > @leMaik Thanks for the bug report. We could pause the interval when the window loses the focus and resume when the focus is restored. We do the same with the Material-UI's snackbar component.
  > @oliviertassinari Allright, I'm preparing a PR. Maybe a better approach would be to use the [Page Visibility API](https://developer.mozilla.org/de/docs/Web/API/Page_Visibility_API) if available, because an unfocused window might still be visible? :thinking:   Edit: Indeed, listening to `blur` stops the animation when unfocusing the browser, which is not what I would expect the component to do.
  > ~The visibility API looks better suited, yes.~ Hum shouldn't we pause the animation when the window is visible but not focused? 🤔 I don't know. I have never played enough with the window focus and visible events.

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

### Incident Patch 1: `7e3951f6` (2026-06-22)
**Commit Message**: Fix build of docs with Node.js 25

**File**: `package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "docs:dev": "rimraf node_modules/.cache/babel-loader && cross-env BABEL_ENV=docs-development next dev -p=8001",
     "docs:build": "cross-env BABEL_ENV=docs-production next build",
     "docs:export": "cross-env NODE_ENV=production BABEL_ENV=docs-production next export -o docs/export",
-    "docs:deploy": "yarn docs:build && yarn docs:export",
+    "docs:deploy": "NODE_OPTIONS=--openssl-legacy-provider yarn docs:build && yarn docs:export",
     "prettier": "find . -name \"*.js\" | grep -v -f .eslintignore | xargs prettier --write --single-quote --trailing-comma all --print-width 100",
     "size": "size-limit",
     "size:why": "size-limit --why packages/react-swipeable-views/lib/index.js",
```

---

### Incident Patch 2: `d6b21e67` (2025-09-20)
**Commit Message**: [internal] Fix package.json format

See https://publint.dev/react-swipeable-views@0.14.0

**File**: `native/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "license": "MIT",
   "repository": {
     "type": "git",
-    "url": "https://github.com/oliviertassinari/react-swipeable-views.git"
+    "url": "git+https://github.com/oliviertassinari/react-swipeable-views.git"
   },
   "main": "node_modules/expo/AppEntry.js",
   "dependencies": {
```

**File**: `native/packages/react-swipeable-views-native/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   },
   "repository": {
     "type": "git",
-    "url": "https://github.com/oliviertassinari/react-swipeable-views.git"
+    "url": "git+https://github.com/oliviertassinari/react-swipeable-views.git"
   },
   "keywords": [
     "react-native",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
   "license": "MIT",
   "repository": {
     "type": "git",
-    "url": "https://github.com/oliviertassinari/react-swipeable-views.git"
+    "url": "git+https://github.com/oliviertassinari/react-swipeable-views.git"
   },
   "devDependencies": {
     "@babel/cli": "7.0.0",
```

**File**: `packages/react-swipeable-views-core/package.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   },
   "repository": {
     "type": "git",
-    "url": "https://github.com/oliviertassinari/react-swipeable-views.git"
+    "url": "git+https://github.com/oliviertassinari/react-swipeable-views.git"
   },
   "author": "https://github.com/oliviertassinari",
   "bugs": {
```

**File**: `packages/react-swipeable-views-utils/package.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   },
   "repository": {
     "type": "git",
-    "url": "https://github.com/oliviertassinari/react-swipeable-views.git"
+    "url": "git+https://github.com/oliviertassinari/react-swipeable-views.git"
   },
   "author": "https://github.com/oliviertassinari",
   "bugs": {
```

**File**: `packages/react-swipeable-views/package.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   },
   "repository": {
     "type": "git",
-    "url": "https://github.com/oliviertassinari/react-swipeable-views.git"
+    "url": "git+https://github.com/oliviertassinari/react-swipeable-views.git"
   },
   "keywords": [
     "react",
```

---

### Incident Patch 3: `be57b7d9` (2022-03-15)
**Commit Message**: fix: `core` and `utils` should include `react` in `peerDependencies` too (#661)

**File**: `packages/react-swipeable-views-core/package.json` (modified, +3/-0)
```diff
@@ -21,6 +21,9 @@
   "devDependencies": {
     "pkgfiles": "^2.3.2"
   },
+  "peerDependencies": {
+    "react": "^15.3.0 || ^16.0.0 || ^17.0.0"
+  },
   "license": "MIT",
   "engines": {
     "node": ">=6.0.0"
```

**File**: `packages/react-swipeable-views-utils/package.json` (modified, +3/-0)
```diff
@@ -25,6 +25,9 @@
   "devDependencies": {
     "pkgfiles": "^2.3.2"
   },
+  "peerDependencies": {
+    "react": "^15.3.0 || ^16.0.0 || ^17.0.0"
+  },
   "license": "MIT",
   "engines": {
     "node": ">=6.0.0"
```

---

### Incident Patch 4: `d5dc45df` (2021-10-27)
**Commit Message**: fix(virtualize): onSwitching for Virtualize should called with correct index (#647)

**File**: `packages/react-swipeable-views-utils/src/virtualize.js` (modified, +17/-0)
```diff
@@ -116,6 +116,21 @@ export default function virtualize(MyComponent) {
       }
     };
 
+    handleSwitching = (indexContainer, type) => {
+      const { slideCount, onSwitching } = this.props;
+      const { indexStart } = this.state;
+
+      let index = indexContainer + indexStart;
+
+      if (slideCount) {
+        index = mod(index, slideCount);
+      }
+
+      if (onSwitching) {
+        onSwitching(index, type);
+      }
+    };
+
     handleTransitionEnd = () => {
       // Delay the update of the window to fix an issue with react-motion.
       this.timer = setTimeout(() => {
@@ -132,6 +147,7 @@ export default function virtualize(MyComponent) {
         children,
         index: indexProp,
         onChangeIndex,
+        onSwitching,
         onTransitionEnd,
         overscanSlideAfter,
         overscanSlideBefore,
@@ -157,6 +173,7 @@ export default function virtualize(MyComponent) {
         <MyComponent
           index={indexContainer}
           onChangeIndex={this.handleChangeIndex}
+          onSwitching={this.handleSwitching}
           onTransitionEnd={this.handleTransitionEnd}
           {...other}
         >
```

**File**: `packages/react-swipeable-views-utils/src/virtualize.test.js` (modified, +16/-0)
```diff
@@ -284,4 +284,20 @@ describe('virtualize', () => {
       assert.strictEqual(wrapper.state().index, 10, 'should not update the state index');
     });
   });
+
+  describe('prop: onSwitching', () => {
+    it('should be called with the right arguments', () => {
+      const handleSwitching = spy();
+      const wrapper = shallow(
+        <VirtualizeSwipeableViews
+          index={10}
+          slideRenderer={slideRenderer}
+          onSwitching={handleSwitching}
+        />,
+      );
+
+      wrapper.find(Empty).simulate('switching', 3.05, 'move');
+      assert.deepEqual(handleSwitching.args, [[10.05, 'move']]);
+    });
+  });
 });
```

---

### Incident Patch 5: `a45e8687` (2021-05-30)
**Commit Message**: revert change in package script

**File**: `package.json` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
     "size:why": "size-limit --why packages/react-swipeable-views/lib/index.js",
     "watch": "lerna exec --concurrency 99 -- babel src --out-dir lib --watch",
     "build": "rm -rf packages/*/lib && cross-env NODE_ENV=production lerna exec -- babel --config-file ../../babel.config.js src --out-dir lib --ignore test.js",
-    "release": "yarn build && yarn lerna exec yarn prepublish && lerna publish --force-publish *",
+    "release": "yarn build && yarn lerna exec yarn prepublish && lerna publish",
     "postrelease": "yarn docs:deploy"
   },
   "author": "Olivier Tassinari <olivier.tassinari@gmail.com> (https://github.com/oliviertassinari)",
```

---

### Incident Patch 6: `241a723b` (2021-02-13)
**Commit Message**: Fix scrollTop is not always be an integer (#614)

**File**: `packages/react-swipeable-views/src/SwipeableViews.js` (modified, +3/-1)
```diff
@@ -179,7 +179,9 @@ export function findNativeHandler(params) {
       goingForward = !goingForward;
     }
 
-    const scrollPosition = shape[axisProperties.scrollPosition[axis]];
+    // scrollTop is not always be an integer.
+    // https://github.com/jquery/api.jquery.com/issues/608
+    const scrollPosition = Math.round(shape[axisProperties.scrollPosition[axis]]);
 
     const areNotAtStart = scrollPosition > 0;
     const areNotAtEnd =
```

---

### Incident Patch 7: `3142140f` (2021-02-13)
**Commit Message**: Fix autoPlay HOC swallowing third parameter of onChangeIndex (#618)

**File**: `packages/react-swipeable-views-utils/src/autoPlay.js` (modified, +2/-2)
```diff
@@ -82,7 +82,7 @@ export default function autoPlay(MyComponent) {
       }
     };
 
-    handleChangeIndex = (index, indexLatest) => {
+    handleChangeIndex = (index, indexLatest, meta) => {
       // Is uncontrolled
       if (this.props.index === undefined) {
         this.setState({
@@ -91,7 +91,7 @@ export default function autoPlay(MyComponent) {
       }
 
       if (this.props.onChangeIndex) {
-        this.props.onChangeIndex(index, indexLatest);
+        this.props.onChangeIndex(index, indexLatest, meta);
       }
     };
 
```

**File**: `packages/react-swipeable-views-utils/src/autoPlay.test.js` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ describe('autoPlay', () => {
           onChangeIndex: handleChangeIndex,
         });
         wrapper.find(Empty).simulate('changeIndex', 1, 0);
-        assert.deepEqual(handleChangeIndex.args, [[1, 0]]);
+        assert.deepEqual(handleChangeIndex.args, [[1, 0, undefined]]);
         assert.strictEqual(wrapper.state().index, 0, 'should not update the state index');
       });
     });
```

**File**: `packages/react-swipeable-views-utils/src/bindKeyboard.js` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ export default function bindKeyboard(MyComponent) {
       }
     };
 
-    handleChangeIndex = (index, indexLatest) => {
+    handleChangeIndex = (index, indexLatest, meta) => {
       // Is uncontrolled
       if (this.props.index === undefined) {
         this.setState({
@@ -128,7 +128,7 @@ export default function bindKeyboard(MyComponent) {
       }
 
       if (this.props.onChangeIndex) {
-        this.props.onChangeIndex(index, indexLatest);
+        this.props.onChangeIndex(index, indexLatest, meta);
       }
     };
 
```

**File**: `packages/react-swipeable-views-utils/src/bindKeyboard.test.js` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ describe('bindKeyboard', () => {
         onChangeIndex: handleChangeIndex,
       });
       wrapper.find(Empty).simulate('changeIndex', 1, 0);
-      assert.deepEqual(handleChangeIndex.args, [[1, 0]]);
+      assert.deepEqual(handleChangeIndex.args, [[1, 0, undefined]]);
       assert.strictEqual(wrapper.state().index, 0, 'should no update the state index');
     });
   });
```

**File**: `packages/react-swipeable-views-utils/src/virtualize.js` (modified, +2/-2)
```diff
@@ -96,7 +96,7 @@ export default function virtualize(MyComponent) {
       });
     }
 
-    handleChangeIndex = (indexContainer, indexLatest) => {
+    handleChangeIndex = (indexContainer, indexLatest, meta) => {
       const { slideCount, onChangeIndex } = this.props;
 
       const indexDiff = indexContainer - indexLatest;
@@ -112,7 +112,7 @@ export default function virtualize(MyComponent) {
       }
 
       if (onChangeIndex) {
-        onChangeIndex(index, this.state.index);
+        onChangeIndex(index, this.state.index, meta);
       }
     };
 
```

**File**: `packages/react-swipeable-views-utils/src/virtualize.test.js` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ describe('virtualize', () => {
       );
 
       wrapper.find(Empty).simulate('changeIndex', 1, 0);
-      assert.deepEqual(handleChangeIndex.args, [[11, 10]]);
+      assert.deepEqual(handleChangeIndex.args, [[11, 10, undefined]]);
       assert.strictEqual(wrapper.state().index, 10, 'should not update the state index');
     });
   });
```

---

### Incident Patch 8: `904d738a` (2021-02-13)
**Commit Message**: Fix throw error when using a portal inside a view (#635)

**File**: `packages/react-swipeable-views/src/SwipeableViews.js` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ function adaptMouse(event) {
 export function getDomTreeShapes(element, rootNode) {
   let domTreeShapes = [];
 
-  while (element && element !== rootNode) {
+  while (element && element !== rootNode && element !== document.body) {
     // We reach a Swipeable View, no need to look higher in the dom tree.
     if (element.hasAttribute('data-swipeable')) {
       break;
```

---

### Incident Patch 9: `6cf8c786` (2020-08-13)
**Commit Message**: Typo fix in demo (#610)

**File**: `docs/src/pages/demos/DemoResistance.js` (renamed, +2/-2)
```diff
@@ -18,7 +18,7 @@ const styles = {
   },
 };
 
-function DemoResitance() {
+function DemoResistance() {
   return (
     <SwipeableViews resistance>
       <div style={Object.assign({}, styles.slide, styles.slide1)}>slide n°1</div>
@@ -28,4 +28,4 @@ function DemoResitance() {
   );
 }
 
-export default DemoResitance;
+export default DemoResistance;
```

**File**: `docs/src/pages/demos/demos.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ The container responds dynamically to its children.
 
 With a resistance bounds effet on the edges.
 
-{{"demo": "pages/demos/DemoResitance.js"}}
+{{"demo": "pages/demos/DemoResistance.js"}}
 
 ## Nested
 
```

**File**: `native/src/Home.tsx` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ import { List, Divider, withTheme } from 'react-native-paper';
 import DemoSimple from './demo/Simple';
 import DemoTabs from './demo/Tabs';
 import DemoScroll from './demo/Scroll';
-import DemoResitance from './demo/Resitance';
+import DemoResistance from './demo/Resistance';
 import DemoAutoPlay from './demo/AutoPlay';
 import DemoVirtualize from './demo/Virtualize';
 import DemoHocs from './demo/Hocs';
@@ -23,7 +23,7 @@ export const demos = {
   simple: DemoSimple,
   tabs: DemoTabs,
   scroll: DemoScroll,
-  resitance: DemoResitance,
+  resistance: DemoResistance,
   autoplay: DemoAutoPlay,
   virtualize: DemoVirtualize,
   hocs: DemoHocs,
```

**File**: `native/src/demo/Resistance.test.tsx` (renamed, +3/-3)
```diff
@@ -1,13 +1,13 @@
 import 'react-native';
 import * as React from 'react';
-import Resitance from './Resitance';
+import Resistance from './Resistance';
 import * as renderer from 'react-test-renderer';
 
-describe('Resitance snapshot', () => {
+describe('Resistance snapshot', () => {
   jest.useFakeTimers();
 
   it('renders the root', async () => {
-    const tree = renderer.create(<Resitance />).toJSON();
+    const tree = renderer.create(<Resistance />).toJSON();
     expect(tree).toMatchSnapshot();
   });
 });
```

**File**: `native/src/demo/Resistance.tsx` (renamed, +3/-3)
```diff
@@ -4,8 +4,8 @@ import SwipeableViews from '../../packages/react-swipeable-views-native/src';
 import { Headline } from 'react-native-paper';
 import styles from '../styles';
 
-class DemoResitance extends React.Component<{}> {
-  static title = "Resitance";
+class DemoResistance extends React.Component<{}> {
+  static title = "Resistance";
   static description = "With a resistance bounds effet on the edges";
 
   render() {
@@ -25,4 +25,4 @@ class DemoResitance extends React.Component<{}> {
   }
 }
 
-export default DemoResitance;
+export default DemoResistance;
```

**File**: `pages/demos/demos.js` (modified, +3/-3)
```diff
@@ -36,11 +36,11 @@ module.exports = require('fs')
   .readFileSync(require.resolve('docs/src/pages/demos/DemoAnimateHeight'), 'utf8')
 `,
         },
-        'pages/demos/DemoResitance.js': {
-          js: require('docs/src/pages/demos/DemoResitance').default,
+        'pages/demos/DemoResistance.js': {
+          js: require('docs/src/pages/demos/DemoResistance').default,
           raw: preval`
 module.exports = require('fs')
-  .readFileSync(require.resolve('docs/src/pages/demos/DemoResitance'), 'utf8')
+  .readFileSync(require.resolve('docs/src/pages/demos/DemoResistance'), 'utf8')
 `,
         },
         'pages/demos/DemoNested.js': {
```

---

### Incident Patch 10: `db32ac84` (2019-01-19)
**Commit Message**: Fix get display same slide (#480)

* change getDisplaySameSlide.js to handle children arrays

Current code of getDisplaySameSlide.js was not handling correctly the situation of having children inside an array (common case for dynamic amount of children).
Updated the code so that we use React.Children that traverses nested children arrays

* Update getDisplaySameSlide.js

* remove parentheses to make linter happy

* Update getDisplaySameSlide.js

* Make linter happy by adding some parentheses

* Update getDisplaySameSlide.js

* fix getDisplaySameSlide

* add test

**File**: `packages/react-swipeable-views-core/src/getDisplaySameSlide.js` (modified, +8/-5)
```diff
@@ -1,13 +1,16 @@
+import React from 'react';
+
 const getDisplaySameSlide = (props, nextProps) => {
   let displaySameSlide = false;
+  const getChildrenKey = child => (child ? child.key : 'empty');
 
   if (props.children.length && nextProps.children.length) {
-    const oldChildren = props.children[props.index];
-    const oldKey = oldChildren ? oldChildren.key : 'empty';
+    const oldKeys = React.Children.map(props.children, getChildrenKey);
+    const oldKey = oldKeys[props.index];
 
-    if (oldKey !== null) {
-      const newChildren = nextProps.children[nextProps.index];
-      const newKey = newChildren ? newChildren.key : 'empty';
+    if (oldKey !== null && oldKey !== undefined) {
+      const newKeys = React.Children.map(nextProps.children, getChildrenKey);
+      const newKey = newKeys[nextProps.index];
 
       if (oldKey === newKey) {
         displaySameSlide = true;
```

**File**: `packages/react-swipeable-views-core/src/getDisplaySameSlide.test.js` (modified, +22/-0)
```diff
@@ -126,4 +126,26 @@ describe('getDisplaySameSlide', () => {
 
     assert.strictEqual(getDisplaySameSlide(oldState.props(), newState.props()), true);
   });
+
+  it('should work with dynamic children in arrays', () => {
+    const oldState = mount(
+      <SwipeableViews index={2}>
+        <div key="1" />
+        {['2', '3', '4'].map(k => (
+          <div key={k} />
+        ))}
+      </SwipeableViews>,
+    );
+
+    const newState = mount(
+      <SwipeableViews index={3}>
+        <div key="1" />
+        {['2', '3', '4'].map(k => (
+          <div key={k} />
+        ))}
+      </SwipeableViews>,
+    );
+
+    assert.strictEqual(getDisplaySameSlide(oldState.props(), newState.props()), false);
+  });
 });
```

---

### Incident Patch 11: `85f17547` (2019-01-19)
**Commit Message**: Fix onChangeIndex is not passed when autoplay is disabled (#487)

**File**: `packages/react-swipeable-views-utils/src/autoPlay.js` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ export default function autoPlay(MyComponent) {
       const { index } = this.state;
 
       if (!autoplay) {
-        return <MyComponent index={index} {...other} />;
+        return <MyComponent index={index} onChangeIndex={onChangeIndex} {...other} />;
       }
 
       return (
```

**File**: `packages/react-swipeable-views-utils/src/autoPlay.test.js` (modified, +20/-0)
```diff
@@ -197,6 +197,26 @@ describe('autoPlay', () => {
           done();
         }, 300);
       });
+
+      it('should pass onChangeIndex also when autoplay is disabled', done => {
+        const handleChangeIndex = spy();
+
+        wrapper = shallow(
+          <AutoPlaySwipeableViews index={0} autoplay={false} onChangeIndex={handleChangeIndex}>
+            <div>{'slide n°1'}</div>
+            <div>{'slide n°2'}</div>
+            <div>{'slide n°3'}</div>
+          </AutoPlaySwipeableViews>,
+        );
+
+        wrapper.find(Empty).simulate('changeIndex', 1, 0);
+        assert.strictEqual(
+          handleChangeIndex.callCount,
+          1,
+          'Should be called the right number of time.',
+        );
+        done();
+      });
     });
   });
 });
```

---

### Incident Patch 12: `7d585c37` (2018-11-06)
**Commit Message**: fix lint error and add changelog

**File**: `native/App.js` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 // app entry
 import { App } from './src/App';
 
-export default App;
\ No newline at end of file
+export default App;
```

**File**: `native/jest.config.js` (modified, +5/-12)
```diff
@@ -1,21 +1,14 @@
-const { defaults: tsjPreset } = require("ts-jest/presets");
+const { defaults: tsjPreset } = require('ts-jest/presets');
 
 module.exports = {
   ...tsjPreset,
-  preset: "react-native",
+  preset: 'react-native',
   transform: {
     ...tsjPreset.transform,
-    "\\.js$": "<rootDir>/node_modules/react-native/jest/preprocessor.js",
+    '\\.js$': '<rootDir>/node_modules/react-native/jest/preprocessor.js',
   },
-  moduleFileExtensions: [
-    "ts",
-    "tsx",
-    "js",
-    "jsx",
-    "json",
-    "node"
-  ],
+  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
   // This is the only part which you can keep
   // from the above linked tutorial"s config:
-  cacheDirectory: ".jest/cache",
+  cacheDirectory: '.jest/cache',
 };
```

**File**: `native/package.json` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
     "expo": "^31.0.2",
     "react": "16.5.0",
     "react-native": "https://github.com/expo/react-native/archive/sdk-31.0.0.tar.gz",
-    "react-native-paper": "2.1.3",
+    "react-native-paper": "2.2.1",
     "react-navigation": "^2.18.2",
     "react-swipeable-views-core": "^0.13.0",
     "react-swipeable-views-utils": "^0.13.0"
```

**File**: `native/packages/react-swipeable-views-native/CHANGELOG.md` (modified, +7/-1)
```diff
@@ -2,4 +2,10 @@
 
 - upgrade React Native to 0.57
 - upgrade other dependencies
-- move to typescript
\ No newline at end of file
+- move to typescript
+
+### 0.13.2
+
+- remove `warning` dependency
+- add snapshot tests
+- move example project to expo
\ No newline at end of file
```

**File**: `native/packages/react-swipeable-views-native/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-swipeable-views-native",
-  "version": "0.13.1",
+  "version": "0.13.2",
   "description": "A React component for swipeable views",
   "main": "lib/index.js",
   "scripts": {
```

**File**: `native/yarn.lock` (modified, +17/-10)
```diff
@@ -635,7 +635,7 @@
     lodash "^4.17.10"
     to-fast-properties "^2.0.0"
 
-"@callstack/react-theme-provider@^1.0.6":
+"@callstack/react-theme-provider@^1.0.7":
   version "1.0.7"
   resolved "https://registry.yarnpkg.com/@callstack/react-theme-provider/-/react-theme-provider-1.0.7.tgz#2d2fd1a1d965f36165eaa2e4da28aed1ade75484"
   integrity sha512-NTjvHadSLja5KruFXThC6rwLrewzbPSZFefgl5hTWXVZ40BsIDn3744AgregeuGTM3249K1cE9uN7UKua87pKQ==
@@ -2125,7 +2125,7 @@ create-react-context@0.2.2:
     fbjs "^0.8.0"
     gud "^1.0.0"
 
-create-react-context@^0.2.1, create-react-context@^0.2.2:
+create-react-context@^0.2.1, create-react-context@^0.2.3:
   version "0.2.3"
   resolved "https://registry.yarnpkg.com/create-react-context/-/create-react-context-0.2.3.tgz#9ec140a6914a22ef04b8b09b7771de89567cb6f3"
   integrity sha512-CQBmD0+QGgTaxDL3OX1IDXYqjkp2It4RIbcb99jS6AEg27Ga+a9G3JtK6SIu0HBwPLZlmwt9F7UwWA4Bn92Rag==
@@ -3343,6 +3343,13 @@ hoist-non-react-statics@^2.2.0, hoist-non-react-statics@^2.3.1, hoist-non-react-
   resolved "https://registry.yarnpkg.com/hoist-non-react-statics/-/hoist-non-react-statics-2.5.5.tgz#c5903cf409c0dfd908f388e619d86b9c1174cb47"
   integrity sha512-rqcy4pJo55FTTLWt+bU8ukscqHeE/e9KWvsOW2b/a3afxQZhwkQdT1rPPCJ0rYXdj4vNcasY8zHTH+jF/qStxw==
 
+hoist-non-react-statics@^3.1.0:
+  version "3.1.0"
+  resolved "https://registry.yarnpkg.com/hoist-non-react-statics/-/hoist-non-react-statics-3.1.0.tgz#42414ccdfff019cd2168168be998c7b3bd5245c0"
+  integrity sha512-MYcYuROh7SBM69xHGqXEwQqDux34s9tz+sCnxJmN18kgWh6JFdTw/5YdZtqsOdZJXddE/wUpCzfEdDrJj8p0Iw==
+  dependencies:
+    react-is "^16.3.2"
+
 home-or-tmp@^2.0.0:
   version "2.0.0"
   resolved "https://registry.yarnpkg.com/home-or-tmp/-/home-or-tmp-2.0.0.tgz#e36c3f2d2cae7d746a857e38d18d5f32a7882db8"
@@ -5643,7 +5650,7 @@ react-event-listener@^0.6.0:
     prop-types "^15.6.0"
     warning "^4.0.1"
 
-react-is@^16.6.0:
+react-is@^16.3.2, react-is@^16.6.0:
   version "16.6.0"
   resolved "https://registry.yarnpkg.com/react-is/-/react-is-16.6.0.tgz#456645144581a6e99f6816ae2bd24ee94bdd0c01"
   integrity sha512-q8U7k0Fi7oxF1HvQgyBjPwDXeMplEsArnKt2iYhuIF86+GBbgLHdAmokL3XUFjTd7Q363OSNG55FOGUdONVn1g==
@@ -5693,15 +5700,15 @@ react-native-maps@expo/react-native-maps#v0.22.0-exp.0:
     babel-plugin-module-resolver "^3.1.0"
     babel-preset-react-native "1.9.0"
 
-react-native-paper@2.1.3:
-  version "2.1.3"
-  resolved "https://registry.yarnpkg.com/react-native-paper/-/react-native-paper-2.1.3.tgz#ae2efce3cf8ba7d8afa6f5d743768b2be110520f"
-  integrity sha512-f9CKazmEd8c38CsX5d5+/qxv2AzD8rI/k8xNPrXk5PHWS81RrQOUSVcHJApcEFyzRMQ+gIGbijtZ3mkn0V2lSg==
+react-native-paper@2.2.1:
+  version "2.2.1"
+  resolved "https://registry.yarnpkg.com/react-native-paper/-/react-native-paper-2.2.1.tgz#f7339a39e2e19d12e07becfa691e18a86e581050"
+  integrity sha512-SYzwRWNisacqZolF+fdNv5Fa7icH+w88LsxGXRTgaNBwZk0zrQ4cSaIzPPKOURWHaz5YJ4gKjcgL4v3hg4/MiQ==
   dependencies:
-    "@callstack/react-theme-provider" "^1.0.6"
+    "@callstack/react-theme-provider" "^1.0.7"
     color "^2.0.1"
-    create-react-context "^0.2.2"
-    hoist-non-react-statics "^2.5.0"
+    create-react-context "^0.2.3"
+    hoist-non-react-statics "^3.1.0"
     react-lifecycles-compat "^3.0.4"
 
 react-native-reanimated@1.0.0-alpha.10:
```

---

### Incident Patch 13: `da751234` (2018-10-28)
**Commit Message**: Merge pull request #482 from oliviertassinari/fix-warning-require

Fix warning require

**File**: `native/packages/react-swipeable-views-native/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-swipeable-views-native",
-  "version": "0.12.9",
+  "version": "0.13.1",
   "description": "A React component for swipeable views",
   "main": "lib/index.js",
   "scripts": {
```

**File**: `native/packages/react-swipeable-views-native/src/SwipeableViews.animated.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import {
   View,
   ViewStyle,
 } from 'react-native';
-import warning from 'warning';
+import * as warning from 'warning';
 import {
   constant,
   checkIndexBounds,
```

**File**: `native/packages/react-swipeable-views-native/src/SwipeableViews.scroll.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 import * as React from 'react';
 import { StyleSheet, View, ScrollView, Dimensions, ViewStyle } from 'react-native';
-import warning from 'warning';
+import * as warning from 'warning';
 import { checkIndexBounds, getDisplaySameSlide } from 'react-swipeable-views-core';
 
 const { width: windowWidth } = Dimensions.get('window');
```

---

### Incident Patch 14: `73b46e64` (2018-10-28)
**Commit Message**: fix eslint

**File**: `native/rn-cli.config.js` (modified, +2/-2)
```diff
@@ -4,5 +4,5 @@ module.exports = {
   },
   getSourceExts() {
     return ['ts', 'tsx'];
-  }
-};
\ No newline at end of file
+  },
+};
```

---

### Incident Patch 15: `dc888972` (2018-10-28)
**Commit Message**: fix eslint

**File**: `native/rn-cli.config.js` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 module.exports = {
   getTransformModulePath() {
-    return require.resolve("react-native-typescript-transformer");
+    return require.resolve('react-native-typescript-transformer');
   },
   getSourceExts() {
-    return ["ts", "tsx"];
+    return ['ts', 'tsx'];
   }
 };
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #689** (2026-06-22): Use caret range for @babel/runtime (@Janpot)
- **PR #686** (closed): Add DevITJobs - as user (@Vrq)
- **PR #680** (closed): update to react 18 (@ellepereira)
- **PR #675** (closed): init react v18 (@ZipingL)
- **PR #670** (closed): merge upstream (@kodai3)
- **PR #668** (closed): for fixing the depencie conflit with react 18 (@ramsesndame237)
- **PR #667** (closed): [FIN]ReactのpeerDeps制限を消した (@sudokzt)
- **PR #662** (closed): fixed UNSAFE_componentWillReceiveProps error (@hkimani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
