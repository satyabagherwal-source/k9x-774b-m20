# Forensic Learning Record (Deep Inspection): React95/React95

> **Canonical Artifact**: `07_PROJECT_LEARNING/react95-react95-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/React95/React95](https://github.com/React95/React95))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:14:55.657Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `React95/React95`
- **Description**: A React components library with Win95 UI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3831 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `config/setup/core.setup.js`
```
import { beforeAll, vi } from 'vitest';
import fileMock from '../mocks/fileMock';

vi.mock('icojs', () => ({
  isICO: vi.fn(() => true),
  parse: vi.fn(() =>
    Promise.resolve([
      {
        width: 16,
        buffer: 'buffer-16-4-1',
        bpp: 4,
        variant: 1,
      },
      {
        width: 32,
        buffer: 'buffer-32-4-1',
        bpp: 4,
        variant: 1,
      },
      {
        width: 32,
        buffer: 'buffer-32-4-2',
        bpp: 4,
        variant: 2,
      },
    ]),
  ),
}));

vi.mock('@react95/icons', async () => {
  const actual = await vi.importActual('@react95/icons');

  const entries = Object.keys(actual).map(name => {
    return [name, `svg ${fileMock}`];
  });

  return Object.fromEntries(entries);
});

beforeAll(() => {
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      arrayBuffer: vi.fn(() => ({})),
    }),
  );
  global.Blob = class Blob {
    constructor(buff) {
      this.buffer = buff;
    }

    toString() {
      return this.buffer.toString();
    }
  };

  global.URL.createObjectURL = vi.fn(data => data.toString());
});

```

### Core Architecture Module: `packages/core/.storybook/arg-types-enhancers.js`
```
// Props that take React elements, components or functions (e.g. `icon`,
// `titleBarOptions`, `onChange`) can't be edited in the Controls panel: they
// would get a JSON editor that can't represent them. This turns their control
// off and says so in their description, shown in Controls and in the docs
// props table.

// Types that hold elements or callbacks inside them, which their names don't
// tell: buttons have `onClick`, menu items a `list` element, tree nodes icons
const typesWithElements = ['ModalButtons', 'ModalMenu', 'NodeProps'];

const takesElements = argType => {
  const summary = argType.table?.type?.summary ?? '';

  return (
    argType.type?.name === 'function' ||
    /ReactElement|ReactNode|JSX\.Element|ComponentType|=>/.test(summary) ||
    typesWithElements.some(type => summary.includes(type))
  );
};

const note =
  "Can't be edited in the Controls panel, as it takes React elements or " +
  "functions. See the story's code for an example.";

export const markNonConfigurableProps = ({ argTypes }) =>
  Object.fromEntries(
    Object.entries(argTypes).map(([name, argType]) => {
      // a control set on purpose stays, e.g. text for a `children: ReactNode`
      const hasChosenControl =
        argType.control &&
        !['object', undefined].includes(argType.control.type);

      if (!takesElements(argType) || hasChosenControl) {
        return [name, argType];
      }

      return [
        name,
        {
          ...argType,
          control: false,
          description: [argType.description, note].filter(Boolean).join('\n\n'),
        },
      ];
    }),
  );

```

### Core Architecture Module: `packages/core/.storybook/decorators/Frame.tsx`
```
import React from 'react';
import type { Decorator } from '@storybook/react-vite';
import { setElementVars } from '@vanilla-extract/dynamic';
import '../../components/GlobalStyle/GlobalStyle.css';
import { contract } from '../../components/themes/contract.css';
import * as tokens from '../../components/themes/tokens';

type ThemeName = keyof typeof tokens;

const Frame: Decorator = (Story, { globals }) => {
  const selectedTheme = globals.selectedTheme as ThemeName;

  React.useEffect(() => {
    // theme tokens are applied as inline CSS variables on `<html>`, so they
    // win over any `:root` theme stylesheet a story may import
    setElementVars(
      document.documentElement,
      contract,
      tokens[selectedTheme] ?? tokens.win95,
    );
  }, [selectedTheme]);

  return (
    <div style={{ padding: 10 }}>
      <Story />
    </div>
  );
};

export default Frame;

```

### Core Architecture Module: `packages/core/.storybook/decorators/withClippy.tsx`
```
/// <reference types="vite/client" />
/**
 * Clippy in Storybook
 *
 * A random agent from `@react95/clippy` lives in the preview while you browse
 * the stories.
 *
 * Setup
 * - One `ClippyProvider` is mounted once, in its own React root, outside the
 *   stories. Each story (and each story on a docs page) renders in a separate
 *   root, and every provider owns an agent, so this keeps a single agent that
 *   survives story changes.
 * - clippyjs styles the balloon inline, so the project font (MS Sans Serif) is
 *   applied to it once the agent is ready.
 *
 * When Clippy talks
 * - On load: waves and says a general phrase (`talks`).
 * - When clicked: says a phrase from the current story or from `talks`.
 * - On story change (a docs page counts as a single change):
 *   - stories with `parameters.clippy.phrases` always get one of them, right
 *     away, queued after any open balloon (the first story too, after the
 *     greeting);
 *   - other stories get, at most every 30s and only if no balloon is open, the
 *     Figma tip when they have `parameters.design`, or a general phrase.
 * - When idle: a phrase 60–90s after the last one, only while the tab is
 *   visible and no balloon is open.
 * - Never the same phrase twice in a row.
 *
 * Using it in a story
 * - Story phrases: `parameters: { clippy: { phrases: ['...'] } }`, at the story
 *   or component (meta) level.
 * - Talking from a story: the render function receives `speak` in its context,
 *   e.g. `render: (_, { speak }) => ...` and `speak('Copied to clipboard!')`.
 *   It is safe to call while the agent is still loading, and is always queued.
 *
 * Clippy is left out of the story tests (`vitest.config.mjs`).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Decorator } from '@storybook/react-vite';
import { AGENTS, ClippyProvider, useClippy } from '@react95/clippy';
import { MSSansSerif } from '../../components/shared/font-names';

type ClippyAgent = NonNullable<ReturnType<typeof useClippy>['clippy']>;

const talks = [
  'New to our project? Let me show you around!',
  'What brings you here today? Need help with something?',
  "We're always improving! Check out our latest updates.",
  'Want to get involved? We love contributions from our community!',
  "Stuck on something? Don't worry, we've got resources to help!",
  "Thanks for checking out our project! We're glad you're here.",
  "We're passionate about building something amazing. Want to join us?",
  "What do you think of our project so far? We'd love to hear your feedback!",
  "Ready to dig in? We've got plenty of resources to get you started.",
  "We're always learning and growing. Stay tuned for exciting updates!",
  "It looks like you're browsing a component library. Would you like help?",
  'Did you know? You can switch themes in the Themes panel below.',
  'Click any icon on the Icon page to copy its code to your clipboard.',
  'Looking for a component? Try the search at the top of the sidebar.',
  'Found a bug? Open an issue on GitHub and we will take a look!',
  'Every component here is built with React and a lot of nostalgia.',
  "Don't forget to save your work. Ctrl+S is your friend!",
  'Remember when 16MB of RAM felt like a lot?',
  'It is now safe to turn off your computer. Just kidding, keep exploring!',
];

// only said on stories that have a Figma design attached
const designTip = 'Psst! The Design tab shows the Figma file for this one.';

// automatic speech (on story change or when idle) is spaced out, so Clippy
// comments on things without talking over every click
const STORY_CHANGE_COOLDOWN = 30_000;
const IDLE_DELAY_MIN = 60_000;
const IDLE_DELAY_MAX = 90_000;
const IDLE_CHECK_INTERVAL = 5_000;

const random = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const randomIdleDelay = () =>
  IDLE_DELAY_MIN + Math.random() * (IDLE_DELAY_MAX - IDLE_DELAY_MIN);

let lastSpokeAt = 0;
let lastPhrase: string | undefined;
let lastStoryKey: string | undefined;
// phrases about the story being viewed, from `parameters.clippy.phrases`
let storyPhrases: string[] = [];

// avoids saying the same phrase twice in a row
const pick = (phrases: string[]) =>
  random(phrases.length > 1 ? phrases.filter(p => p !== lastPhrase) : phrases);

const say = (agent: ClippyAgent, message: string) => {
  lastSpokeAt = Date.now();
  lastPhrase = message;
  agent.speak(message, false);
};

// automatic speech is dropped, not queued, while a balloon is open
const sayIfQuiet = (agent: ClippyAgent, message: string) => {
  if (agent._balloon._hidden) {
    say(agent, message);
  }
};

let resolveAgent: (agent: ClippyAgent) => void;
const agentReady = new Promise<ClippyAgent>(resolve => {
  resolveAgent = resolve;
});

const Greeter = () => {
  const { clippy } = useClippy();

  React.useEffect(() => {
    if (!clippy) {
      return;
    }

    // clippyjs styles the balloon inline (with "Microsoft Sans"), so the
    // project font is applied straight to its content element
    Object.assign(clippy._balloon._content.style, {
      fontFamily: `'${MSSansSerif}', sans-serif`,
      fontSize: '12px',
    });

    // clippyjs sizes the balloon with offsetWidth/offsetHeight, which round
    // down. With MS Sans Serif a line can be a fraction of a pixel wider (e.g.
    // 195.44px), so once the width is fixed its last word wraps to a line that
    // wasn't measured and spills out of the balloon. This measures it again,
    // rounding up.
    const balloon = clippy._balloon;
    const sizeBalloon = balloon.speak.bind(balloon);

    balloon.speak = (complete: () => void, text: string, hold: boolean) => {
      sizeBalloon(complete, text, hold);

      const content = balloon._content;
      const typed = content.textContent;

      content.style.width = 'auto';
      content.style.height = 'auto';
      content.textContent = text;

      const { width, height } = content.getBoundingClientRect();

      content.style.width = `${Math.ceil(width)}px`;
      content.style.height = `${Math.ceil(height)}px`;
      content.textContent = typed;
      balloon.reposition();
    };

    clippy.play('Wave');
    say(clippy, pick(talks));

    const onClick = () => {
      say(clippy, pick([...storyPhrases, ...talks]));
      clippy.animate();
    };

    let idleDelay = randomIdleDelay();
    const idleCheck = setInterval(() => {
      if (
        document.visibilityState !== 'visible' ||
        Date.now() - lastSpokeAt < idleDelay
      ) {
        return;
      }

      sayIfQuiet(clippy, pick([...storyPhrases, ...talks]));
      idleDelay = randomIdleDelay();
    }, IDLE_CHECK_INTERVAL);

    clippy._el.addEventListener('click', onClick);
    resolveAgent(clippy);

    return () => {
      clearInterval(idleCheck);
      clippy._el.removeEventListener('click', onClick);
    };
  }, [clippy]);

  return null;
};

let mounted = false;

// Each story (and each story on a docs page) renders in its own React root, and
// every `ClippyProvider` owns an agent. So a single provider is mounted once,
// outside the stories, and the agent is shared across all of them.
const mountClippy = () => {
  if (mounted) {
    return;
  }

  mounted = true;

  const container = document.createElement('div');
  document.body.appendChild(container);

  createRoot(container).render(
    <ClippyProvider agentName={random(Object.values(AGENTS))}>
      <Greeter />
    </ClippyProvider>,
  );
};

type StoryPhrases = {
  // from `parameters.clippy.phrases`
  configured: string[];
  // derived from the story, like the Figma tip
  contextual: string[];
};

const onStoryChange = (
  storyKey: string,
  { configured, contextual }: StoryPhrases,
) => {
  if (storyKey === lastStoryKey) {
    return;
  }

  const isFirstStory = lastStoryKey === undefined;

  lastStoryKey = storyKey;
  storyPhrases = [...configured, ...contextual];

  agentReady.then(agent => {
    // a story with its own phrases always gets one, right away (queued after
    // any open balloon, including the greeting on the first story)
    if (configured.length > 0) {
      say(agent, pick(configured));

      return;
    }

    // otherwise the greeting covers the first story, and later changes are
    // spaced out
    if (!isFirstStory && Date.now() - lastSpokeAt >= STORY_CHANGE_COOLDOWN) {
      sayIfQuiet(agent, pick(contextual.length > 0 ? contextual : talks));
    }
  });
};

const StoryChange = ({
  storyKey,
  phrases,
}: {
  storyKey: string;
  phrases: StoryPhrases;
}) => {
  React.useEffect(() => {
    // mounting the provider's own root during a story render makes React warn
    // about nested updates from render, so it happens after the story commits
    mountClippy();
    onStoryChange(storyKey, phrases);
  }, [storyKey]);

  return null;
};

// waits for the agent, so it is safe to call while it is still loading
const speak = (message: string) => {
  agentReady.then(agent => say(agent, message));
};

export const withClippy: Decorator = (Story, context) => {
  // story tests (Vitest runs in `test` mode) don't need a random agent with
  // timers and network requests
  if (import.meta.env.MODE === 'test') {
    return Story({ ...context, speak: () => {} });
  }

  const { clippy, design } = context.parameters;
  const phrases: StoryPhrases = {
    configured: (clippy as { phrases?: string[] } | undefined)?.phrases ?? [],
    contextual: design ? [designTip] : [],
  };

  // a docs page renders every story of a component, so it counts as a single
  // change instead of one per story
  const storyKey = context.viewMode === 'docs' ? context.title : context.id;

  return (
    <>
      <StoryChange storyKey={storyKey} phrases={phrases} />
      {Story({ ...context, speak })}
    </>
  );
};

```

### Core Architecture Module: `packages/core/.storybook/frame-arg-types.js`
```
// Frame's style props (~150, from sprinkles) are its API, so they show up on
// Frame's Controls and docs props table (see the propFilter in main.js), but
// grouped by category, with controls that work for them.

import { Frame } from '../components/Frame/Frame';
import { sprinkles } from '../components/Frame/Frame.css';
import * as styleGroups from '../components/Frame/props';
import { contract } from '../components/themes/contract.css';

// one table category per group of `components/Frame/props.ts`
const categories = {
  positioning: 'Position',
  zIndices: 'Position',
  displayAndBoxModel: 'Layout and spacing',
  colors: 'Color',
  background: 'Background',
  borders: 'Border',
  borderRadius: 'Border',
  outline: 'Outline',
  shadows: 'Shadow',
  font: 'Typography',
  text: 'Typography',
};

// Mirrors the `shorthands` in `components/Frame/Frame.css.ts`, which sprinkles
// doesn't expose at runtime. A mismatch is reported below.
const shorthands = {
  size: ['height', 'width'],
  h: ['height'],
  w: ['width'],
  minH: ['minHeight'],
  minW: ['minWidth'],
  m: ['margin'],
  mr: ['marginRight'],
  ml: ['marginLeft'],
  mt: ['marginTop'],
  mb: ['marginBottom'],
  marginX: ['marginLeft', 'marginRight'],
  marginY: ['marginTop', 'marginBottom'],
  mx: ['marginLeft', 'marginRight'],
  my: ['marginTop', 'marginBottom'],
  p: ['padding'],
  pr: ['paddingRight'],
  pl: ['paddingLeft'],
  pt: ['paddingTop'],
  pb: ['paddingBottom'],
  paddingX: ['paddingLeft', 'paddingRight'],
  paddingY: ['paddingTop', 'paddingBottom'],
  px: ['paddingLeft', 'paddingRight'],
  py: ['paddingTop', 'paddingBottom'],
  bgColor: ['backgroundColor'],
  bg: ['background'],
};

// property -> { group, tokens }, e.g. width -> { displayAndBoxModel, space }.
// `color` is in both `colors` and `text` (same tokens); it stays in `colors`.
const styleProps = new Map();

for (const [group, props] of Object.entries(styleGroups)) {
  for (const [name, tokens] of Object.entries(props)) {
    if (!styleProps.has(name) || group === 'colors') {
      styleProps.set(name, { group, tokens });
    }
  }
}

const known = new Set([...styleProps.keys(), ...Object.keys(shorthands)]);
const unknown = [...sprinkles.properties].filter(name => !known.has(name));
const stale = [...known].filter(name => !sprinkles.properties.has(name));

if (unknown.length || stale.length) {
  console.warn(
    '[storybook] Frame style props are out of sync with Frame.css.ts. ' +
      `Not mapped: ${unknown.join(', ') || '-'}. ` +
      `No longer exist: ${stale.join(', ') || '-'}.`,
  );
}

const responsiveNote =
  'Also takes responsive values like `{ mobile, tablet, desktop }`, which ' +
  "can't be edited here.";

const codeNote = 'In code, it also takes any CSS value.';

const describe = (...parts) => parts.filter(Boolean).join('\n\n');

// sizes (width, minHeight, ...) also use the space tokens, but those only go
// up to `$22` (22px), so sizes keep a free text control
const isSize = name => /^(width|height|min|max)/.test(name);

// `name` is the CSS property, the shorthand's target for shorthands
const styleArgType = (argType, name) => {
  const { group, tokens } = styleProps.get(name);
  const table = { ...argType.table, category: categories[group] };
  const responsive = group === 'displayAndBoxModel' ? responsiveNote : '';

  if (tokens === contract.space && isSize(name)) {
    return {
      ...argType,
      table,
      control: { type: 'text' },
      description: describe(
        argType.description,
        'A space token (e.g. `$4`) or any CSS value.',
        responsive,
      ),
    };
  }

  // spacing, colors, shadows and z-indices: pick one of the theme tokens
  if (typeof tokens === 'object') {
    return {
      ...argType,
      table,
      control: { type: 'select' },
      options: Object.keys(tokens).map(token => `$${token}`),
      description: describe(argType.description, codeNote, responsive),
    };
  }

  return {
    ...argType,
    table,
    control: argType.type?.name === 'enum' ? argType.control : { type: 'text' },
    description: describe(argType.description, responsive),
  };
};

export const organizeFrameStyleProps = ({ argTypes, component }) => {
  if (component !== Frame) {
    return argTypes;
  }

  return Object.fromEntries(
    Object.entries(argTypes).map(([name, argType]) => {
      if (styleProps.has(name)) {
        return [name, styleArgType(argType, name)];
      }

      if (shorthands[name]) {
        const targets = shorthands[name];
        const target = styleArgType(argType, targets[0]);
        const names = targets.map(t => `\`${t}\``).join(' and ');

        return [
          name,
          {
            ...target,
            description: describe(
              `Shorthand for ${names}.`,
              target.description,
            ),
          },
        ];
      }

      return [name, argType];
    }),
  );
};

```

### Core Architecture Module: `packages/core/.storybook/main.js`
```
import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { cssTsSideEffects } from './vite-plugin-css-ts-side-effects.js';

function getAbsolutePath(value) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

// Which props show up in Controls and in the docs props table: the ones our
// components declare. Most components also spread ~300 React DOM attributes;
// the few that matter for a component (e.g. `placeholder` on Input) come from
// its stories' `args`, which get a control inferred from their value.
const propFilter = (prop, component) => {
  const files = [prop.parent, ...(prop.declarations ?? [])]
    .filter(Boolean)
    .map(({ fileName }) => fileName);

  // the Frame style props (~150, from sprinkles) come from a generated type
  // with no source file. They are the same on every component built on Frame,
  // so they only show up on Frame itself (see frame-arg-types.js)
  if (files.length === 0) {
    return component.name === 'Frame';
  }

  // declared by one of our components, even through Omit/Pick (`ref`, the
  // polymorphic `as` and `style` have no useful control)
  if (files.some(file => !file.includes('node_modules'))) {
    return !['ref', 'as', 'style'].includes(prop.name);
  }

  return prop.name === 'children';
};

export default {
  staticDirs: ['../components/GlobalStyle'],
  stories: [
    '../stories/all.stories.tsx',
    ...readdirSync(join(import.meta.dirname, '../stories'))
      .filter(file => file !== 'all.stories.tsx')
      .filter(file => file.endsWith('.stories.tsx'))
      .map(file => `../stories/${file}`),
  ],
  logLevel: 'debug',
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-designs'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-vitest'),
    join(import.meta.dirname, 'src', 'theme-changer'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  typescript: {
    // react-docgen (the default) can't resolve imported types, so components
    // whose props come from React or Frame types showed no props at all
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter,
      // only our components need docgen. Otherwise it also goes through every
      // .tsx Vite loads (~975 icons from @react95/icons, Clippy, decorators)
      // and warns that each one is outside the TypeScript project
      include: [join(import.meta.dirname, '../components/**/*.tsx')],
    },
  },
  features: {
    actions: false,
  },
  viteFinal: config => ({
    ...config,
    plugins: [...(config.plugins ?? []), cssTsSideEffects()],
  }),
};

```

### Core Architecture Module: `packages/core/.storybook/manager.js`
```
import { addons } from 'storybook/manager-api';
import theme from './theme';

addons.setConfig({
  theme,
});

```

### Core Architecture Module: `packages/core/.storybook/preview.js`
```
import Frame from './decorators/Frame';

import './preview.css';
import { markNonConfigurableProps } from './arg-types-enhancers';
import { organizeFrameStyleProps } from './frame-arg-types';
import { withClippy } from './decorators/withClippy';

export const globalTypes = {
  selectedTheme: {
    name: 'Theme',
    description: 'Global theme for components',
  },
};

export const initialGlobals = {
  selectedTheme: 'win95',
};

export const parameters = {
  docs: {
    // replaces @storybook/addon-storysource, removed in Storybook 9
    codePanel: true,
  },
  a11y: {
    // violations show up as warnings in the story tests and the Accessibility
    // panel, without failing them. Switch to 'error' once they are fixed
    test: 'todo',
  },
};

export const decorators = [Frame, withClippy];

export const argTypesEnhancers = [
  organizeFrameStyleProps,
  markNonConfigurableProps,
];

```

### Core Architecture Module: `packages/core/.storybook/src/theme-changer/manager.js`
```
import React from 'react';
import { addons, types } from 'storybook/manager-api';
import { AddonPanel } from 'storybook/internal/components';
import { ThemePanel } from './src/Panel';

const ADDON_ID = 'Themes';
const PANEL_ID = `${ADDON_ID}/panel`;

addons.register(ADDON_ID, api => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Themes',
    render: ({ active }) => {
      return (
        <AddonPanel active={active}>
          <ThemePanel api={api} />
        </AddonPanel>
      );
    },
  });
});

```

### Core Architecture Module: `packages/core/.storybook/src/theme-changer/src/Panel.tsx`
```
/** @jsxRuntime automatic */
import type { API } from 'storybook/manager-api';
import { assignInlineVars } from '@vanilla-extract/dynamic';

import './styles.css';
import { contract } from '../../../../components/themes/contract.css';
import * as tokens from '../../../../components/themes/tokens';

type ThemeName = keyof typeof tokens;

const themes = Object.keys(tokens) as ThemeName[];

const ThemeWindow = ({
  name,
  changeTheme,
}: {
  name: ThemeName;
  changeTheme: API['updateGlobals'];
}) => (
  // each window gets its theme tokens as inline CSS variables, so it renders
  // with that theme's colors
  <div
    className="theme-window"
    style={assignInlineVars(contract, tokens[name])}
  >
    <div className="title-bar">{name}</div>
    <div className="btn-container">
      <button
        className="theme-widow-btn"
        onClick={() => {
          changeTheme({ selectedTheme: name });
        }}
      >
        {name}
      </button>
    </div>
  </div>
);

export const ThemePanel = ({ api }: { api: API }) => (
  <div style={{ padding: '12px' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {themes.map(name => (
        <ThemeWindow key={name} name={name} changeTheme={api.updateGlobals} />
      ))}
    </div>
  </div>
);

```

### Core Architecture Module: `packages/core/.storybook/theme.js`
```
import { create } from 'storybook/theming';

const theme = create({
  base: 'light',
  fontBase: '"MS Sans Serif", sans-serif',
  brandTitle: 'React95',
  brandUrl: 'https://github.com/React95/React95',
  brandImage: 'https://avatars2.githubusercontent.com/u/38158713',
  appBg: 'white',
  appBorderColor: 'grey',
  appBorderRadius: 0,
});

export default theme;

```

### Core Architecture Module: `packages/core/.storybook/vite-plugin-css-ts-side-effects.js`
```
// The core `package.json` `sideEffects` only lists fonts, so a bare
// `import '*.css.ts'` (e.g. GlobalStyle, which has no exports) is tree-shaken
// from the Storybook build. This marks every `.css.ts` module as having side
// effects, for Storybook only: `moduleSideEffects` returned from a transform
// hook overrides the one coming from `package.json`.
export const cssTsSideEffects = () => ({
  name: 'css-ts-side-effects',

  transform(_code, id) {
    if (id.endsWith('.css.ts')) {
      return { moduleSideEffects: true };
    }
  },
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #81** (2019-03-30): **Assets folder isn't builded**
  *Symptoms*: It throws an error when use some component that render an Icon.  To fix  that,  the assets folder need to be present inside dist folder after build process end. 
  **Post-Mortem & Fix Analysis**:
  > Wouldn't this issue be more suited to a solution using Webpack and loaders (style-loader, css-loader, url-loader, file-loader, etc)? There are ways to accomplish this via Babel plugins, but they're more workarounds to avoid Webpack. Babel is a transpiler first and foremost, not a bundler. All these plugins are doing is transforming the imports at build time.  Using Webpack alongside Babel, you could do all the same things you're doing currently with Babel and simply add the transpilation to the the bundling process, avoid these resolution issues, and get the benefit of additional tools at your disposal during build (minifying code, SASS or whatever else for styling, autoprefixing, etc).  I could be missing some key point that makes this a less than optimal solution, but I feel like Webpack is the move here.
  > Hi @Zachari   Me and @ggdaltoso have searched a lot about this when we were thinking about bundling this library.  After all the content that we found about this, we decided that we do not need Webpack, Rollup, Parcel or any bundler tool. We reached the idea that Webpack is more for application than for libraries.  And about using any kind of css loader, how we are not using css files, we do not need it.  We just need to transpile our code, the code minification will be maded by the application that will use React95.  Here's some content that we read about this: https://medium.com/@lawliet29/tree-shaking-in-real-world-what-could-go-wrong-b398c2b2ebbb  But we might be wrong, so we accept PR's and other suggestions!  Thank you for your point of view.
  > That's understandable. I suggested Webpack because it's the one I have the most experience with when it comes to static assets. Admittedly, Webpack doesn't seem to be the best fit for a library. However, I do disagree that bundlers in general are a good fit towards applications only. Rollup, in particular, appears to be perfect for libraries, especially in situations such as this. However, I can't tinker with it until tomorrow so I can't say whether or not it'd be optimal here. I will tomorrow, however.  I don't fault the logic behind the choice, though. If that's the approach, simply including them in a shared folder to avoid resolution issues seems to be the way to go.

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

### Incident Patch 1: `075e7d23` (2026-10-02)
**Commit Message**: ci: run story tests and build storybook on PRs

**File**: `.github/workflows/nx.yml` (modified, +6/-2)
```diff
@@ -13,11 +13,11 @@ jobs:
       number-of-agents: 3
       main-branch-name: master
       init-commands: |
-        yarn nx-cloud start-ci-run --stop-agents-after="lint,test,build"
+        yarn nx-cloud start-ci-run --stop-agents-after="lint,test,build,test-storybook,build-storybook"
       parallel-commands: |
         yarn nx-cloud record -- yarn nx format:check
       parallel-commands-on-agents: |
-        yarn nx affected -t lint,test,build --parallel=3
+        yarn nx affected -t lint,test,build,test-storybook,build-storybook --parallel=3
 
   agents:
     name: Nx Cloud - Agents
@@ -26,3 +26,7 @@ jobs:
       node-version: 24
       yarn-version: 1.22.19
       number-of-agents: 3
+      # test-storybook runs the stories in Chromium (see packages/core/vitest.config.mjs)
+      install-commands: |
+        yarn install --frozen-lockfile
+        npx playwright install --with-deps chromium
```

---

### Incident Patch 2: `f7d9fc5b` (2026-10-01)
**Commit Message**: chore(storybook): fix Clippy's balloon size and its mount warning

- clippyjs sizes the balloon with offsetWidth, which rounds down. With MS
  Sans Serif a line can be a fraction of a pixel wider, so its last word
  wrapped to an unmeasured line and spilled out of the balloon. The
  balloon is measured again, rounding up.
- mounting Clippy's own React root during a story render made React warn
  about nested updates from render; it now happens in an effect.

**File**: `packages/core/.storybook/decorators/withClippy.tsx` (modified, +29/-2)
```diff
@@ -120,6 +120,32 @@ const Greeter = () => {
       fontSize: '12px',
     });
 
+    // clippyjs sizes the balloon with offsetWidth/offsetHeight, which round
+    // down. With MS Sans Serif a line can be a fraction of a pixel wider (e.g.
+    // 195.44px), so once the width is fixed its last word wraps to a line that
+    // wasn't measured and spills out of the balloon. This measures it again,
+    // rounding up.
+    const balloon = clippy._balloon;
+    const sizeBalloon = balloon.speak.bind(balloon);
+
+    balloon.speak = (complete: () => void, text: string, hold: boolean) => {
+      sizeBalloon(complete, text, hold);
+
+      const content = balloon._content;
+      const typed = content.textContent;
+
+      content.style.width = 'auto';
+      content.style.height = 'auto';
+      content.textContent = text;
+
+      const { width, height } = content.getBoundingClientRect();
+
+      content.style.width = `${Math.ceil(width)}px`;
+      content.style.height = `${Math.ceil(height)}px`;
+      content.textContent = typed;
+      balloon.reposition();
+    };
+
     clippy.play('Wave');
     say(clippy, pick(talks));
 
@@ -220,6 +246,9 @@ const StoryChange = ({
   phrases: StoryPhrases;
 }) => {
   React.useEffect(() => {
+    // mounting the provider's own root during a story render makes React warn
+    // about nested updates from render, so it happens after the story commits
+    mountClippy();
     onStoryChange(storyKey, phrases);
   }, [storyKey]);
 
@@ -232,8 +261,6 @@ const speak = (message: string) => {
 };
 
 export const withClippy: Decorator = (Story, context) => {
-  mountClippy();
-
   const { clippy, design } = context.parameters;
   const phrases: StoryPhrases = {
     configured: (clippy as { phrases?: string[] } | undefined)?.phrases ?? [],
```

---

### Incident Patch 3: `740f1520` (2026-10-01)
**Commit Message**: chore(storybook): render the All showcase with composeStories

All rendered other stories by calling their `render` directly, so a story
couldn't drop its custom `render` in favor of args without breaking it.
Portable stories render each one with its args either way. The showcase
renders the same as before (same DOM).

**File**: `packages/core/stories/all.stories.tsx` (modified, +58/-40)
```diff
@@ -1,31 +1,49 @@
-import type { Meta } from '@storybook/react-vite';
+import { composeStories, type Meta } from '@storybook/react-vite';
 import * as React from 'react';
 
 import { Alert, Button, TitleBar } from '../components';
 
-import { Simple as SimpleAvatar } from './avatar.stories';
-import { Simple as SimpleButton } from './button.stories';
-import { All as AllCheckbox } from './checkbox.stories';
-import { Simple as SimpleDropdown } from './dropdown.stories';
-import { Simple as SimpleFieldset } from './fieldset.stories';
-import { Simple as SimpleInput } from './input.stories';
-import { Simple as SimpleList, WithIcons } from './list.stories';
-import { Simple as SimpleProgressBar } from './progressbar.stories';
-import { Simple as SimpleRadioButton } from './radiobutton.stories';
-import { Simple as SimpleRange } from './range.stories';
-import { Simple as SimpleTabs } from './tabs.stories';
-import { Simple as SimpleTextArea } from './textarea.stories';
-import {
-  Complete,
-  Inactive,
-  Simple as SimpleTitleBar,
-} from './titlebar.stories';
-import { Simple as SimpleTooltip } from './tooltip.stories';
-import { Simple as SimpleTree } from './tree.stories';
-import { FromURL } from './video.stories';
+import * as AvatarStories from './avatar.stories';
+import * as ButtonStories from './button.stories';
+import * as CheckboxStories from './checkbox.stories';
+import * as DropdownStories from './dropdown.stories';
+import * as FieldsetStories from './fieldset.stories';
+import * as InputStories from './input.stories';
+import * as ListStories from './list.stories';
+import * as ProgressBarStories from './progressbar.stories';
+import * as RadioButtonStories from './radiobutton.stories';
+import * as RangeStories from './range.stories';
+import * as TabsStories from './tabs.stories';
+import * as TextAreaStories from './textarea.stories';
+import * as TitleBarStories from './titlebar.stories';
+import * as TooltipStories from './tooltip.stories';
+import * as TreeStories from './tree.stories';
+import * as VideoStories from './video.stories';
 
 import * as styles from './all.stories.css';
 
+// each story renders with its args, whether or not it has a custom `render`
+const { Simple: SimpleAvatar } = composeStories(AvatarStories);
+const { Simple: SimpleButton } = composeStories(ButtonStories);
+const { All: AllCheckbox } = composeStories(CheckboxStories);
+const { Simple: SimpleDropdown } = composeStories(DropdownStories);
+const { Simple: SimpleFieldset } = composeStories(FieldsetStories);
+const { Simple: SimpleInput } = composeStories(InputStories);
+const { Simple: SimpleList, WithIcons } = composeStories(ListStories);
+const { Simple: SimpleProgressBar } = composeStories(ProgressBarStories);
+const { Simple: SimpleRadioButton } = composeStories(RadioButtonStories);
+const { Simple: SimpleRange } = composeStories(RangeStories);
+const { Simple: SimpleTabs } = composeStories(TabsStories);
+const { Simple: SimpleTextArea } = composeStories(TextAreaStories);
+const {
+  Simple: SimpleTitleBar,
+  Inactive,
+  Complete,
+} = composeStories(TitleBarStories);
+const { Simple: SimpleTooltip } = composeStories(TooltipStories);
+const { Simple: SimpleTree } = composeStories(TreeStories);
+const { FromURL } = composeStories(VideoStories);
+
 export default {
   title: 'All',
   parameters: {
@@ -63,73 +81,73 @@ const AllDemo = () => {
       <br />
 
       <div>
-        <SimpleButton.render />
+        <SimpleButton />
       </div>
 
       <br />
-      <SimpleAvatar.render {...SimpleAvatar.args} />
+      <SimpleAvatar />
 
       <br />
-      <AllCheckbox.render />
+      <AllCheckbox />
 
       <br />
-      <SimpleDropdown.render />
+      <SimpleDropdown />
 
       <br />
-      <SimpleFieldset.render />
+      <SimpleFieldset />
 
       <br />
       <div>
-        <SimpleInput.render />
+        <SimpleInput />
       </div>
 
       <br />
       <br />
 
       <div>
-        <SimpleTextArea.render />
+        <SimpleTextArea />
       </div>
 
       <br />
       <br />
 
       <div>
-        <WithIcons.render />
+        <WithIcons />
         <br />
-        <SimpleList.render />
+        <SimpleList />
       </div>
 
       <br />
-      <SimpleProgressBar.render {...SimpleProgressBar.args} />
+      <SimpleProgressBar />
 
       <br />
-      <SimpleRadioButton.render />
+      <SimpleRadioButton />
 
       <br />
-      <SimpleRange.render />
+      <SimpleRange />
 
       <br />
       <div className={styles.tabs}>
-        <SimpleTabs.render />
+        <SimpleTabs />
       </div>
 
       <br />
-      <SimpleTree.render />
+      <SimpleTree />
 
       <br />
-      <SimpleTooltip.render {...SimpleTooltip.args} />
+      <SimpleTooltip />
 
       <br />
-      <FromURL.render />
+      <FromURL />
 
       <br />
-      <SimpleTitleBar.render />
+      <SimpleTitleBar />
 
       <br />
-      <Inactive.render />
+      <Inactive />
 
       <br />
-      <Com
```

---

### Incident Patch 4: `7b185d92` (2026-09-30)
**Commit Message**: chore(storybook): build the Clippy decorator on @react95/clippy

The old addon kept the agent in a module variable, but only after it
loaded. Every story rendered while it was loading started its own agent,
so a docs page with seven stories showed up to six agents stacked on top
of each other. Calling `speak` before the agent loaded also threw.

Each story (and each story on a docs page) renders in its own React root,
and every `ClippyProvider` owns an agent. So the decorator mounts a single
provider once, outside the stories, and injects a `speak` that waits for
the agent. This also drops the direct `clippyjs` import from core, which
wasn't declared in its dependencies.

**File**: `packages/core/.storybook/decorators/withClippy.tsx` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import React from 'react';
+import { createRoot } from 'react-dom/client';
+import type { Decorator } from '@storybook/react-vite';
+import { AGENTS, ClippyProvider, useClippy } from '@react95/clippy';
+
+type ClippyAgent = NonNullable<ReturnType<typeof useClippy>['clippy']>;
+
+const talks = [
+  'New to our project? Let me show you around!',
+  'What brings you here today? Need help with something?',
+  "We're always improving! Check out our latest updates.",
+  'Want to get involved? We love contributions from our community!',
+  "Stuck on something? Don't worry, we've got resources to help!",
+  "Thanks for checking out our project! We're glad you're here.",
+  "We're passionate about building something amazing. Want to join us?",
+  "What do you think of our project so far? We'd love to hear your feedback!",
+  "Ready to dig in? We've got plenty of resources to get you started.",
+  "We're always learning and growing. Stay tuned for exciting updates!",
+];
+
+const random = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
+
+let resolveAgent: (agent: ClippyAgent) => void;
+const agentReady = new Promise<ClippyAgent>(resolve => {
+  resolveAgent = resolve;
+});
+
+const Greeter = () => {
+  const { clippy } = useClippy();
+
+  React.useEffect(() => {
+    if (!clippy) {
+      return;
+    }
+
+    clippy.play('Wave');
+    clippy.speak(random(talks), false);
+
+    const onClick = () => {
+      clippy.speak(random(talks), false);
+      clippy.animate();
+    };
+
+    clippy._el.addEventListener('click', onClick);
+    resolveAgent(clippy);
+
+    return () => {
+      clippy._el.removeEventListener('click', onClick);
+    };
+  }, [clippy]);
+
+  return null;
+};
+
+let mounted = false;
+
+// Each story (and each story on a docs page) renders in its own React root, and
+// every `ClippyProvider` owns an agent. So a single provider is mounted once,
+// outside the stories, and the agent is shared across all of them.
+const mountClippy = () => {
+  if (mounted) {
+    return;
+  }
+
+  mounted = true;
+
+  const container = document.createElement('div');
+  document.body.appendChild(container);
+
+  createRoot(container).render(
+    <ClippyProvider agentName={random(Object.values(AGENTS))}>
+      <Greeter />
+    </ClippyProvider>,
+  );
+};
+
+// waits for the agent, so it is safe to call while it is still loading
+const speak = (message: string) => {
+  agentReady.then(agent => agent.speak(message, false));
+};
+
+export const withClippy: Decorator = (Story, context) => {
+  mountClippy();
+
+  return Story({ ...context, speak });
+};
```

**File**: `packages/core/.storybook/main.js` (modified, +0/-1)
```diff
@@ -22,7 +22,6 @@ export default {
     getAbsolutePath('@storybook/addon-docs'),
     getAbsolutePath('@storybook/addon-designs'),
     join(import.meta.dirname, 'src', 'theme-changer'),
-    join(import.meta.dirname, 'src', 'clippy-addon'),
   ],
   framework: {
     name: getAbsolutePath('@storybook/react-vite'),
```

**File**: `packages/core/.storybook/preview.js` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import Frame from './decorators/Frame';
 
 import './preview.css';
-import { withClippy } from './src/clippy-addon/clippy-addon';
+import { withClippy } from './decorators/withClippy';
 
 export const globalTypes = {
   selectedTheme: {
```

**File**: `packages/core/.storybook/src/clippy-addon/Clippy.jsx` (removed, +0/-72)
```diff
@@ -1,72 +0,0 @@
-import React from 'react';
-import { initAgent } from 'clippyjs';
-import * as agentLoaders from 'clippyjs/agents';
-
-let agent;
-const availableAgents = [
-  'Bonzi',
-  'Clippy',
-  'F1',
-  'Genie',
-  'Genius',
-  'Links',
-  'Merlin',
-  'Peedy',
-  'Rocky',
-  'Rover',
-];
-
-const talks = [
-  'New to our project? Let me show you around!',
-  'What brings you here today? Need help with something?',
-  "We're always improving! Check out our latest updates.",
-  'Want to get involved? We love contributions from our community!',
-  "Stuck on something? Don't worry, we've got resources to help!",
-  "Thanks for checking out our project! We're glad you're here.",
-  "We're passionate about building something amazing. Want to join us?",
-  "What do you think of our project so far? We'd love to hear your feedback!",
-  "Ready to dig in? We've got plenty of resources to get you started.",
-  "We're always learning and growing. Stay tuned for exciting updates!",
-];
-
-const ClippyContext = React.createContext({ speak: () => {} });
-
-export const ClippyProvider = ({ children, ...props }) => {
-  React.useEffect(() => {
-    const agentName =
-      availableAgents[Math.floor(Math.random() * availableAgents.length)];
-
-    if (!agent) {
-      const agentLoader = agentLoaders[agentName];
-      initAgent(agentLoader).then(loadedAgent => {
-        agent = loadedAgent;
-
-        agent.show(false);
-        agent.play('Wave');
-
-        const msg = talks[Math.floor(Math.random() * talks.length)];
-        agent.speak(msg);
-
-        agent._el.addEventListener('click', () => {
-          const msg = talks[Math.floor(Math.random() * talks.length)];
-
-          speak(msg, true);
-        });
-      });
-    }
-  }, []);
-
-  const speak = (msg, animate = false) => {
-    agent.speak(msg);
-
-    if (animate) {
-      agent.animate();
-    }
-  };
-
-  return (
-    <ClippyContext.Provider value={{ speak }}>
-      {children({ ...props, ...{ speak } })}
-    </ClippyContext.Provider>
-  );
-};
```

**File**: `packages/core/.storybook/src/clippy-addon/clippy-addon.jsx` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-import React from 'react';
-import { makeDecorator } from 'storybook/preview-api';
-import { ClippyProvider } from './Clippy';
-
-export const withClippy = makeDecorator({
-  name: 'withClippy',
-  parameterName: 'clippy',
-  skipIfNoParametersOrOptions: false,
-  wrapper: (storyFn, context) => {
-    return (
-      <ClippyProvider>
-        {props => {
-          return storyFn({
-            ...context,
-            ...props,
-          });
-        }}
-      </ClippyProvider>
-    );
-  },
-});
```

**File**: `packages/core/.storybook/src/clippy-addon/package.json` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-{
-  "name": "@react95/storybook-clippy-addon",
-  "version": "0.0.1",
-  "description": "React95 storybook Clippy addon",
-  "main": "./preview.js",
-  "author": "ggdaltoso <ggdaltoso@gmail.com>",
-  "license": "MIT"
-}
```

**File**: `packages/core/.storybook/src/clippy-addon/preview.js` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-// noop
```

---

### Incident Patch 5: `f2f6ee1d` (2026-09-02)
**Commit Message**: Merge pull request #545 from React95/fix/svg-data-uri-quoting

fix: restore SVG icons lost to data URI quoting

**File**: `packages/core/components/Checkbox/Checkbox.css.ts` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@ export const label = style({
 });
 
 globalStyle(`${field}:checked + ${icon}`, {
-  backgroundImage: `url('${check}')`,
+  backgroundImage: `url("${check}")`,
 });
 
 globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
@@ -65,7 +65,7 @@ globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
 });
 
 globalStyle(`${field}:checked:disabled + ${icon}`, {
-  backgroundImage: `url('${checkDisabled}')`,
+  backgroundImage: `url("${checkDisabled}")`,
   backgroundSize: '7px 7px, 1.9px 1.9px',
 });
 
```

**File**: `packages/core/components/List/List.css.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ export const listItem = style({
       right: contract.space[8],
       content: "''",
       backgroundColor: contract.colors.materialText,
-      maskImage: `url('${rightcaret}')`,
+      maskImage: `url("${rightcaret}")`,
       maskPosition: 'center center',
       maskSize: `${contract.space[5]} ${contract.space[8]}`,
       maskRepeat: 'no-repeat',
```

---

### Incident Patch 6: `e285a43a` (2026-09-02)
**Commit Message**: Merge branch 'master' into fix/svg-data-uri-quoting

**File**: `.github/workflows/build_and_publish.yml` (modified, +18/-2)
```diff
@@ -30,11 +30,28 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
 
-      - uses: actions/setup-node@v6
+      # Keep this on a Node line that bundles npm >= 11.5.1, which is what trusted
+      # publishing needs. Node 24 has shipped it since 24.5.0 and npm only moves forward
+      # within a major, so tracking 24 satisfies it. Pinning an older Node would not.
+      - uses: actions/setup-node@v7
         with:
           node-version: 24
           registry-url: https://registry.npmjs.org/
 
+      # setup-node's `registry-url` writes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`
+      # into the runner .npmrc, and that one line breaks both things this job needs.
+      #
+      # Installing: v6 hid the missing secret behind a dummy NODE_AUTH_TOKEN export. v7
+      # removed that, so yarn now hits an unresolved placeholder and fails with
+      # "Failed to replace env in config". That is what reverted the last v7 bump.
+      #
+      # Publishing: npm treats any auth line as "already authenticated" and never starts
+      # the OIDC exchange, so trusted publishing dies with ENEEDAUTH.
+      #
+      # Dropping the line before anything runs settles both. The registry stays.
+      - name: Clear placeholder npm auth line
+        run: sed -i '/_authToken/d' "$NPM_CONFIG_USERCONFIG"
+
       - name: Install dependencies
         run: yarn --pure-lockfile --non-interactive
 
@@ -55,7 +72,6 @@ jobs:
           ./scripts/publish
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
       - name: Build storybook
         if: github.ref == 'refs/heads/master'
```

**File**: `.github/workflows/labeler.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ jobs:
       pull-requests: write
 
     steps:
-      - uses: actions/labeler@v6
+      - uses: actions/labeler@v7
         with:
           repo-token: '${{ secrets.GH_TOKEN }}'
           sync-labels: true
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
           persist-credentials: false
 
       - name: Run analysis
-        uses: ossf/scorecard-action@v2.4.3
+        uses: ossf/scorecard-action@v2.4.4
         with:
           results_file: results.sarif
           results_format: sarif
```

**File**: `.nvmrc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-20.16.0
\ No newline at end of file
+24
```

---

### Incident Patch 7: `cdcd9823` (2026-09-02)
**Commit Message**: fix(List): restore missing submenu caret

Same data URI quoting problem as the Checkbox icon: the single-quoted
url() ended early on the SVG's own attribute quotes, so the mask-image
on nested list items was dropped.

**File**: `packages/core/components/List/List.css.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ export const listItem = style({
       right: contract.space[8],
       content: "''",
       backgroundColor: contract.colors.materialText,
-      maskImage: `url('${rightcaret}')`,
+      maskImage: `url("${rightcaret}")`,
       maskPosition: 'center center',
       maskSize: `${contract.space[5]} ${contract.space[8]}`,
       maskRepeat: 'no-repeat',
```

---

### Incident Patch 8: `61886cbb` (2026-09-02)
**Commit Message**: fix(Checkbox): restore missing check icon

Vite inlines small SVGs as raw data URIs and rewrites the attribute
quotes to single quotes. Wrapping that value in single quotes ended the
CSS string at the first attribute quote, so the background-image
declaration was dropped and the check mark never rendered.

Use double quotes as the url() delimiter instead.

**File**: `packages/core/components/Checkbox/Checkbox.css.ts` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@ export const label = style({
 });
 
 globalStyle(`${field}:checked + ${icon}`, {
-  backgroundImage: `url('${check}')`,
+  backgroundImage: `url("${check}")`,
 });
 
 globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
@@ -65,7 +65,7 @@ globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
 });
 
 globalStyle(`${field}:checked:disabled + ${icon}`, {
-  backgroundImage: `url('${checkDisabled}')`,
+  backgroundImage: `url("${checkDisabled}")`,
   backgroundSize: '7px 7px, 1.9px 1.9px',
 });
 
```

---

### Incident Patch 9: `3435b869` (2026-07-17)
**Commit Message**: Merge pull request #542 from React95/revert-541-dependabot/github_actions/github-actions-eefdb6dedd

Revert "chore(deps): bump actions/setup-node from 6 to 7 in the github-actions group"

**File**: `.github/workflows/build_and_publish.yml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
 
-      - uses: actions/setup-node@v7
+      - uses: actions/setup-node@v6
         with:
           node-version: 24
           registry-url: https://registry.npmjs.org/
```

---

### Incident Patch 10: `cf572554` (2026-07-17)
**Commit Message**: Revert "chore(deps): bump actions/setup-node from 6 to 7 in the github-actions group"

**File**: `.github/workflows/build_and_publish.yml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
 
-      - uses: actions/setup-node@v7
+      - uses: actions/setup-node@v6
         with:
           node-version: 24
           registry-url: https://registry.npmjs.org/
```

---

### Incident Patch 11: `c6be8142` (2026-07-08)
**Commit Message**: Merge pull request #540 from React95/fix/nx-release-publish-noop-executor

fix(release): pin the publish executor for dist-published packages

**File**: `packages/clippy/package.json` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/core/package.json` (modified, +1/-0)
```diff
@@ -231,6 +231,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/icons/package.json` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

---

### Incident Patch 12: `2140baf8` (2026-07-08)
**Commit Message**: fix(release): pin the publish executor for dist-published packages

Overriding the nx-release-publish target's options via the package.json
"nx" field (to set packageRoot) replaced the executor inferred by the
release plugin with nx:noop instead of merging with it. As a result,
core, icons, and clippy's nx-release-publish task silently completed
in 0s and reported success without ever calling npm publish, while
cra-template and cra-template-typescript (which don't override this
target) published correctly.

Pin the executor explicitly alongside the packageRoot override so the
real @nx/js:release-publish executor is used.

**File**: `packages/clippy/package.json` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/core/package.json` (modified, +1/-0)
```diff
@@ -231,6 +231,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/icons/package.json` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

---

### Incident Patch 13: `bdd1d44e` (2026-07-08)
**Commit Message**: Merge pull request #539 from React95/fix/clippy-engines-node

fix(clippy): declare minimum supported Node.js version

**File**: `packages/clippy/package.json` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@
   "homepage": "https://react95.github.io/React95",
   "license": "MIT",
   "main": "index.js",
+  "engines": {
+    "node": ">=18"
+  },
   "publishConfig": {
     "access": "public",
     "directory": "dist",
```

---

### Incident Patch 14: `3a75ce9c` (2026-07-08)
**Commit Message**: fix(clippy): declare minimum supported Node.js version

publint flagged the missing engines.node field on the published
package. Declare the same minimum version already implied by the
workspace tooling.

**File**: `packages/clippy/package.json` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@
   "homepage": "https://react95.github.io/React95",
   "license": "MIT",
   "main": "index.js",
+  "engines": {
+    "node": ">=18"
+  },
   "publishConfig": {
     "access": "public",
     "directory": "dist",
```

---

### Incident Patch 15: `8748e751` (2026-07-08)
**Commit Message**: Merge pull request #538 from React95/fix/stale-dist-version-on-release

fix(release): resync dist package.json version before publish

**File**: `nx.json` (modified, +5/-1)
```diff
@@ -24,8 +24,12 @@
       "dependsOn": ["^lint"],
       "cache": true
     },
-    "nx-release-publish": {
+    "sync-dist-version": {
       "dependsOn": ["build"],
+      "cache": false
+    },
+    "nx-release-publish": {
+      "dependsOn": ["sync-dist-version"],
       "options": {
         "registry": "https://registry.npmjs.org/"
       }
```

**File**: `packages/clippy/package.json` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@
     "build:vite": "vite build",
     "build:types": "yarn tsc -b ./tsconfig.types.json",
     "postbuild": "node ../../scripts/prepublish.js --types",
+    "sync-dist-version": "node ../../scripts/prepublish.js --types",
     "lint": "eslint --ext ts,tsx --quiet src tests",
     "test": "vitest run --config=../../config/test/clippy.js"
   },
```

**File**: `packages/core/package.json` (modified, +1/-0)
```diff
@@ -220,6 +220,7 @@
     "postbuild:cjs": "copyfiles ./components/**/*.{svg,png,eot,ttf,woff,woff2,mp3} ./dist/cjs -u 1",
     "postbuild:esm": "copyfiles ./components/**/*.{svg,png,eot,ttf,woff,woff2,mp3} ./dist/esm -u 1",
     "prebuild": "rimraf ./dist",
+    "sync-dist-version": "node ../../scripts/prepublish.js --types",
     "test": "vitest run --config=../../config/test/core.js"
   },
   "publishConfig": {
```

**File**: `packages/icons/package.json` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@
     "build:css": "cp ./icons.css ./dist/icons.css && ts-node-script scripts/fixCss.ts",
     "build:svg": "cp -r src/svg ./dist",
     "postbuild": "cp -r ./png ./dist/png && node ../../scripts/prepublish.js --types && ts-node-script scripts/addExports.ts",
+    "sync-dist-version": "cp -r ./png ./dist/png && node ../../scripts/prepublish.js --types && ts-node-script scripts/addExports.ts",
     "test": "vitest run --config=../../config/test/icons.js"
   },
   "nx": {
```

#### Recent Merged Pull Requests:
- **PR #551** (2026-10-02): chore(storybook): run stories as tests with vitest and a11y checks (@ggdaltoso)
- **PR #550** (2026-10-02): chore(storybook): review addon panels and map component props to controls (@ggdaltoso)
- **PR #549** (2026-10-01): chore(storybook): build the Clippy decorator on @react95/clippy (@ggdaltoso)
- **PR #548** (2026-09-30): chore(storybook): upgrade to Storybook 10 and rework the theme panel (@ggdaltoso)
- **PR #547** (2026-09-02): ci: bump github-actions group and publish to npm via OIDC (@ggdaltoso)
- **PR #546** (closed): ci: publish to npm via OIDC trusted publishing (@ggdaltoso)
- **PR #545** (2026-09-02): fix: restore SVG icons lost to data URI quoting (@ggdaltoso)
- **PR #544** (closed): chore(deps): bump the github-actions group across 1 directory with 3 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
