# Forensic Learning Record (Deep Inspection): boardgameio/boardgame.io

> **Canonical Artifact**: `07_PROJECT_LEARNING/boardgameio-boardgame.io-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:26:54.673Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `boardgameio/boardgame.io`
- **Description**: State Management and Multiplayer Networking for Turn-Based Games
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12449 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.empty_module.js`
```
/*
 * Copyright 2017 The boardgame.io Authors.
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import React from 'react';

const Null = () => null;

export default Null;

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        modules: false,
        exclude: ['transform-regenerator', 'transform-async-to-generator'],
      },
    ],
    '@babel/preset-react',
    '@babel/typescript',
  ],
  env: {
    test: {
      plugins: [
        '@babel/plugin-transform-modules-commonjs',
        '@babel/plugin-transform-dynamic-import',
      ],
    },
  },
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          'boardgame.io': './packages',
        },
      },
    ],
    '@babel/plugin-proposal-class-properties',
    '@babel/proposal-object-rest-spread',
  ],
};

```

### Core Architecture Module: `benchmark/index.js`
```
/*
 * Copyright 2019 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import Benchmark from 'benchmark';
import { Client } from '../dist/esm/client';
import { InitializeGame } from '../src/core/initialize';
import { CreateGameReducer } from '../src/core/reducer';
import { makeMove, gameEvent } from '../src/core/action-creators';

const game = {
  moves: {
    A: ({ G }) => G,
  },
  endIf: () => false,
};

const reducer = CreateGameReducer({ game });
const state = InitializeGame({ game });
const client = Client({ game });

new Benchmark.Suite()
  .add('reducer::makeMove', function () {
    reducer(state, makeMove('A'));
  })
  .add('reducer::endTurn', function () {
    reducer(state, gameEvent('endTurn'));
  })
  .add('client::move', function () {
    client.moves.A();
  })
  .add('client::endTurn', function () {
    client.events.endTurn();
  })
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: true });

```

### Core Architecture Module: `eslint.config.js`
```
'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const jest = require('eslint-plugin-jest');
const unicorn = require('eslint-plugin-unicorn');
const react = require('eslint-plugin-react');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
  // Formerly .eslintignore.
  {
    ignores: [
      'examples/',
      'dist/',
      'node_modules/',
      'coverage/',
      'npm/',
      'docs/',
      'integration/',
      // The .eslintrc setup ignored dotfiles by default; flat config does not,
      // so keep this jsdom stub module out of linting as before.
      '.empty_module.js',
    ],
  },

  // Flat config only lints .js/.mjs/.cjs by default; the .eslintrc setup also
  // linted .ts and .tsx, so register those extensions too.
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
  },

  // Formerly the `extends` list, in the same order.
  js.configs.recommended,
  jest.configs['flat/recommended'],
  unicorn.configs['flat/recommended'],
  react.configs.flat.recommended,
  ...typescriptEslint.configs['flat/recommended'],
  prettierRecommended,

  {
    // Preserve the .eslintrc/CLI default: flat config now defaults
    // `reportUnusedDisableDirectives` to "warn", so pin it back to keep the
    // set of reported problems unchanged by this migration.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },

    // Formerly `env: { node, browser, es6 }`.
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
      },
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      // eslint
      'no-console': 'off',
      'prefer-const': ['error', { destructuring: 'all' }],

      // plugin:unicorn
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-fn-reference-in-iterator': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-reduce': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-code-point': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-structured-clone': 'off',
      'unicorn/prefer-event-target': 'off',
      'unicorn/throw-new-error': 'off',

      // plugin:@typescript-eslint
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'after-used', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unnecessary-type-constraint': 'off',
    },
  },
];

```

### Core Architecture Module: `examples/react-native/App.js`
```
/*
 * Copyright 2018 The boardgame.io Authors.
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Client } from 'boardgame.io/react-native';
import logo from './logo.png';

import TicTacToe from './game';
import Board from './board';

const App = Client({
  game: TicTacToe,
  board: Board,
});

const Singleplayer = () => (
  <View style={styles.container}>
    <Image source={logo} style={styles.logo} />
    <App matchID="single" />
  </View>
);

export default Singleplayer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 300,
    height: 90,
    marginBottom: 24,
  },
});

```

### Core Architecture Module: `examples/react-native/board.js`
```
/*
 * Copyright 2018 The boardgame.io Authors.
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import React from 'react';
import { StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import PropTypes from 'prop-types';

class Board extends React.Component {
  static propTypes = {
    G: PropTypes.any.isRequired,
    ctx: PropTypes.any.isRequired,
    moves: PropTypes.any.isRequired,
    playerID: PropTypes.string,
    isActive: PropTypes.bool,
    isMultiplayer: PropTypes.bool,
    isConnected: PropTypes.bool,
  };

  onClick = (id) => {
    if (this.isActive(id)) {
      this.props.moves.clickCell(id);
    }
  };

  isActive(id) {
    if (!this.props.isActive) return false;
    if (this.props.G.cells[id] !== null) return false;
    return true;
  }

  render() {
    const tbody = [];
    const marker = {
      0: 'X',
      1: 'O',
    };
    for (let i = 0; i < 3; i++) {
      const cells = [];
      for (let j = 0; j < 3; j++) {
        const id = 3 * i + j;
        cells.push(
          <TouchableHighlight
            key={id}
            onPress={() => this.onClick(id)}
            style={[styles.cell, styles[`cell${id}`]]}
            underlayColor="transparent"
          >
            <Text style={styles.value}>{marker[this.props.G.cells[id]]}</Text>
          </TouchableHighlight>
        );
      }
      tbody.push(
        <View key={i} style={styles.row}>
          {cells}
        </View>
      );
    }

    let disconnected = null;
    if (this.props.isMultiplayer && !this.props.isConnected) {
      disconnected = (
        <Text id="disconnected" style={styles.infoText}>
          Disconnected!
        </Text>
      );
    }

    let winner = null;
    if (this.props.ctx.gameover !== undefined) {
      winner = (
        <Text id="winner" style={styles.infoText}>
          Winner: {marker[this.props.ctx.gameover]}
        </Text>
      );
    }

    let player = null;
    if (this.props.playerID !== null) {
      player = (
        <Text id="player" style={styles.infoText}>
          Player: {this.props.playerID}
        </Text>
      );
    }

    return (
      <View>
        <View id="board">{tbody}</View>
        <View style={styles.info}>
          {player}
          {winner}
          {disconnected}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
    borderWidth: 4,
    borderColor: '#666',
    borderStyle: 'solid',
  },
  value: {
    fontSize: 48,
    fontWeight: '700',
    color: '#373748',
  },
  cell0: {
    borderLeftColor: 'transparent',
    borderTopColor: 'transparent',
  },
  cell1: {
    borderTopColor: 'transparent',
  },
  cell2: {
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  cell3: {
    borderLeftColor: 'transparent',
  },
  cell5: {
    borderRightColor: 'transparent',
  },
  cell6: {
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  cell7: {
    borderBottomColor: 'transparent',
  },
  cell8: {
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderStyle: 'solid',
  },
  info: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    marginTop: 24,
  },
  infoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#373748',
  },
});

export default Board;

```

### Core Architecture Module: `examples/react-native/game.js`
```
/*
 * Copyright 2018 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

function IsVictory(cells) {
  const positions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let pos of positions) {
    const symbol = cells[pos[0]];
    let winner = symbol;
    for (let i of pos) {
      if (cells[i] != symbol) {
        winner = null;
        break;
      }
    }
    if (winner != null) return true;
  }

  return false;
}

const TicTacToe = {
  name: 'tic-tac-toe',

  setup: () => ({
    cells: new Array(9).fill(null),
  }),

  moves: {
    clickCell({ G, playerID }, id) {
      const cells = [...G.cells];

      if (cells[id] === null) {
        cells[id] = playerID;
      }

      return { ...G, cells };
    },
  },

  turn: { minMoves: 1, maxMoves: 1 },

  endIf: ({ G, ctx }) => {
    if (IsVictory(G.cells)) {
      return ctx.currentPlayer;
    }
  },
};

export default TicTacToe;

```

### Core Architecture Module: `examples/react-native/rn-cli.config.js`
```
const path = require('path');

module.exports = {
  getProjectRoots() {
    return [path.join(__dirname, '..', '..', 'packages'), __dirname];
  },
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1100** (2026-07-04): **Infinite loading screen with simultaneous match joins**
  *Symptoms*: Hi ! i have a custom lobby mechanism on my project which implement basic matchmaking between players. When sufficient players have joined the lobby i create the match from my api and send an event to all the players to redirect them to the match page. When the match page load, an http call occurs to log the user to the game server.  It seems that the boardgame implementation cannot handle simultaneous connection changes properly. When someone logs into the match (https://github.com/boardgameio/boardgame.io/blob/main/src/master/master.ts#L400) the match metadata is fetched from my database, modified to include the new metadata, sent to all clients and then saved to the database.  When 2 players joins the match simultaneously, this logic is called 4 times simultaneously and it looks like that some players are overriding the metadata changes of previous users.  For example:  Player 1 is redirected to match page Player 2 is redirected to match page  Player 1 onConnectionChange method start and fetch metadata Player 2 onConnectionChange method start and fetch metadata  Player 1 onConnectionChange method modify metadata and save it to the database Player 2 onConnectionChange method modify metadata and save it to the database  as Player 2 fetched the metadata before Player 1 finished modifying and saving it to the database, when Player 2 modify and save the metadata into the database, the data is outdated and does not contain Player 1 isConnected and credentials
  **Post-Mortem & Fix Analysis**:
  > Yep, this is a known issue: https://github.com/boardgameio/boardgame.io/issues/429 our lobby lacks transactions and concurrency controls. Any contribution to help with that would be appreciated.
  > Basically, you need to serialize the requests in your client to avoid this isue
  > @vdfdev what do you mean by "serializing the requests in your client" ?

- **Issue #1096** (2022-10-26): **BUG [v0.49.12] React Client: broken reactivity for React 18 (works fine with React 17)**
  *Symptoms*: package.json ```     "boardgame.io": "~0.49.12",     "react": "~18.2.0",     "react-dom": "~18.2.0",     "@types/react": "~18.0.20",     "@types/react-dom": "~18.0.6",     "typescript": "~4.8.3",  ``` It modifies redux state, BUT do not rerender react component. Works fine with React 17.0.2  Code: ``` import type { Game } from "boardgame.io"; import { Client, BoardProps } from 'boardgame.io/react';  // game state interface MyGameState {   someValue: number; }  const MyGame: Game<MyGameState> = {   setup: () => {     return { someValue: 1 };   },    moves: {     someMove: (G, ctx) => {       G.someValue += 1;     },   }, };  // board component interface MyGameProps extends BoardProps<MyGameState> { }  function MyGameBoard(props: MyGameProps) {   const { G, moves } = props;   console.log('RERENDER:', props);    return (     <div>       <p>Val: {G.someValue}</p>       <button onClick={() => moves.someMove()}>Test</button>     </div>   ); }  // game client const App = Client({   game: MyGame,   board: MyGameBoard, });  // React 18: app bootstrap import React from 'react'; import ReactDOM from 'react-dom/client';  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(   <React.StrictMode>     <App />   </React.StrictMode> );   ```
  **Post-Mortem & Fix Analysis**:
  > I've been trying to figure out why my board wasn't re-rendering. Reverting to React 17 fixed it.
  > > I've been trying to figure out why my board wasn't re-rendering. Reverting to React 17 fixed it.  Yes it works with React 17. Still its a bug in React 18. 
  > Right, I meant that only as a confirming anecdote.

- **Issue #1094** (2022-10-12): **Type mismatch, PlayerID being optional within LongFormMove and Move types.**
  *Symptoms*: If it is never possible for `LongFormMove` or `Move` functions to be called with an `undefined` `PlayerID`, does it make sense to reflect that in the types?  This issue comes up when using the flag `"strictNullChecks": true` in `tsconfig.json`
  **Post-Mortem & Fix Analysis**:
  > That's a good point, the library was initially developed without types and this might be some legacy code. Feel free to open a PR to fix this.
  > Has this been addressed by https://github.com/boardgameio/boardgame.io/pull/891?
  > I'm not sure

- **Issue #1079** (2026-07-25): **Problem with the leave game**
  *Symptoms*: ### Hello guys, i have a problem with a game. When i win, my opponent   leaves   from the game, then if he wants come back and join to the last game, matchData return only  *id* and *isConnected*  for the second player ```javascripts [{"id": 0, "isConnected": true, "name": "FirstPlayer"}, {"id": 1, "isConnected": true}] ``` #### but actually show  ```javascripts [{"id": 0, "isConnected": false, "name": "FirstPlayer"}, {"id": 1, "isConnected": true,"name": "SecondPlayer"}] ``` #### After that  the game is unplayable, a lot of bugs come out **Q1:**  How to add *name* to the matchData when its return? **Q2** Is there another way to solve the problem?
  **Post-Mortem & Fix Analysis**:
  > It shows  > `[{"id": 0, "isConnected": true, "name": "FirstPlayer"}, {"id": 1, "isConnected": true}]`  After player leaves and the second JSON is the desired, right? I think i'm with the same problem here https://gitter.im/boardgame-io/General?at=632a39fd9994996293749a33 

- **Issue #1050** (2026-07-21): **Plugin setup ctx issue when using typescript.**
  *Symptoms*: I am attempting to use a plugin for the 1st time (having seen a recent reference to the [bgio-effects](https://www.npmjs.com/package/bgio-effects) plugin) ... it looks just like something I really want to use.  All was going fine until I got to the point of adding my game to the game server, and then the typescript compiler is throwing an error.  I have reduce this down to a small example:      import { EffectsCtxMixin } from 'bgio-effects';     import { EffectsPlugin } from 'bgio-effects/plugin';     import { Ctx, Game } from 'boardgame.io';     import { Server } from 'boardgame.io/server';      const EffectsConfig = {         effects: {             mediocreCards: {},         },     } as const;      interface GameState {         dummy: number;     }      export const MediocrityGame: Game<         GameState,         Ctx & EffectsCtxMixin<typeof EffectsConfig>     > = {         name: 'Mediocrity',          plugins: [EffectsPlugin(EffectsConfig)],     };      export const server = Server({         games: [MediocrityGame],     });  This causes the following error to be generated on the `games: [MediocrityGame],` line:      Type 'Game<GameState, Ctx & EffectsCtxMixin<{ readonly effects: { readonly mediocreCards: {}; }; }>, any>' is not assignable to type 'Game<any, Ctx, any>'.       Types of property 'setup' are incompatible.         Type '((ctx: Ctx & EffectsCtxMixin<{ readonly effects: { readonly mediocreCards: {}; }; }>, setupData?: any) =
  **Post-Mortem & Fix Analysis**:
  > Thanks for this report. I think your usage is correct, but the typings for the `Server` function need to be updated to handle customised `ctx` types.  A quick workaround may be to use a type assertion when passing the game to the server:  ```js export const server = Server({     games: [MediocrityGame as Game], }); ```  There aren’t really any drawbacks to asserting there I don’t think, but it would still be good to fix the server typing to handle this automatically.  The `PlayerPlugin` does export a type to use like the mixin for `bgio-effects`, albeit one that is named _very_ confusingly:  ```js import { Ctx, Game } from 'boardgame.io'; import { PlayerPlugin, PluginPlayer } from 'boardgame.io/plugins';  interface PlayerState {   score: number; }  const game: Game<G, Ctx & PlayerPlugin<PlayerState>> = {   plugins: [     PluginPlayer<PlayerState>({ /* ... */ })   ], }; ```
  > Thanks for the workaround.  I actually had to do:       export const server = Server({          games: [MediocrityGame as unknown as Game],     }); because the compiler thinks I might be doing something wrong .  Also thanks for  pointing out that the PlayerPlugin does have a equivalent to the Effects Mixin.  I guess a document update with a typescript example for the PlayerPlugin might help others not make the same mistake..  Anyway, great stuff ... now I'm off to work on using the plugins.

- **Issue #1021** (2021-10-20): **chatMessages property missing from client React interface**
  *Symptoms*: The "chatMessages" property is missing in the list of properties exposed to the client in boardgame.io/src/client/react.tsx 
  **Post-Mortem & Fix Analysis**:
  > Well spotted. A PR fixing this would be welcome!

- **Issue #989** (2021-08-26): **PlayerID in Playerview could be null but doesn't mention it in Game interface**
  *Symptoms*: I'm creating a board game in typescript and a `players[playerID]` is undefined error keeps throwing in `playerView` function in the game object. Then I find out `playerID` is null when the client be called without `playerID` in the props, but the playerView method under Game interface didn't mention it. I'm happy to raise a pull request to improve this part of type-safe.  Here's the line missing the null definition in Game interface. `playerID` is in type `PlayerID` in Game interface. https://github.com/boardgameio/boardgame.io/blob/main/src/types.ts#L314  `playerID` is in type `PlayerID | null` in Plugin interface. https://github.com/boardgameio/boardgame.io/blob/main/src/types.ts#L176  error example:  ```jsx import { Game, PlayerID } from 'boardgame.io'; const exampleGame: Game = {   setup: () => {     return {       players: {         0: {           public: 'player 0 state',           secret: 'player 0 secret',         },         1: {           public: 'player 1 state',           secret: 'player 1 secret',         },     };   },   playerView: (G, ctx, playerID) => {     const players = {};     for (let id in G.players) {       players[id] = {         public: G.players[id].public,       };     }     players[playerID].secret = G.players[playerID].secret; // error throws G.players[playerID] is undefined due to playerID is null.      return { ...G, players };   }, }; const BGame = Client({ game: exampleGame });  const App = () => {   r
  **Post-Mortem & Fix Analysis**:
  > Good catch. `playerID` can be `null` for cases where a spectator is connected (allows you to send a customised state minus secret information to clients not representing any `playerID`). We should definitely fix the type and document this.  Would you like to open a PR?
  > @delucis sure things, I can raise a pull request on this bug.
  > Fixed in f18c63a

- **Issue #981** (2021-08-14): **`setStage` in `turn.onBegin` always uses playerID 0**
  *Symptoms*: As [reported on Gitter](https://gitter.im/boardgame-io/General?at=61154f7309a1c2738272d21e), calling `setStage` from `turn.onBegin` always places player `'0'` in the stage, not the player whose turn is starting.  Reproduction: https://codesandbox.io/s/boardgame-io-setstage-bug-reproduction-vcd40?file=/src/Game.ts  Initially I thought this was another bug introduced in the recent work on events, but after testing with a few previous versions, it seems it is a more long-standing bug. The `setActivePlayers` event works as expected.

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

### Incident Patch 1: `8655a2d1` (2026-08-01)
**Commit Message**: fix: pass the game's ai options to Debug Panel and Local bots (#1280)

* fix(debug): pass the game's ai options to Debug Panel bots

* fix(local): pass the game's ai options to Local transport bots

The Debug Panel now builds bots from the whole `game.ai` object, but
`Local({ bots })` still passed only `enumerate`, so `objectives`,
`iterations` and `playoutDepth` were silently dropped once bots actually
played — a bot tuned in the panel behaved differently in the game.

Spread `game.ai` the same way, with `game` and `seed` after it so they
cannot be overridden.

**File**: `src/client/debug/ai/AI.svelte` (modified, +2/-2)
```diff
@@ -44,8 +44,8 @@
   let bot;
   if (client.game.ai) {
     bot = new MCTSBot({
+      ...client.game.ai,
       game: client.game,
-      enumerate: client.game.ai.enumerate,
       iterationCallback,
     });
     bot.setOpt('async', true);
@@ -57,8 +57,8 @@
   function ChangeBot() {
     const botConstructor = bots[selectedBot];
     bot = new botConstructor({
+      ...client.game.ai,
       game: client.game,
-      enumerate: client.game.ai.enumerate,
       iterationCallback,
     });
     bot.setOpt('async', true);
```

**File**: `src/client/debug/tests/debug.test.ts` (modified, +25/-0)
```diff
@@ -39,6 +39,31 @@ test('switching panels', async () => {
   client.stop();
 });
 
+test('AI panel bot uses the game’s ai options', async () => {
+  const client = Client({
+    game: {
+      moves: { clickCell: () => {} },
+      ai: {
+        enumerate: () => [{ move: 'clickCell', args: [0] }],
+        iterations: 42,
+        playoutDepth: 7,
+      },
+    },
+  });
+  client.start();
+
+  await fireEvent.click(screen.getByText('AI'));
+
+  const iterations = screen.getByLabelText('iterations') as HTMLInputElement;
+  const playoutDepth = screen.getByLabelText(
+    'playoutDepth',
+  ) as HTMLInputElement;
+  expect(iterations.value).toBe('42');
+  expect(playoutDepth.value).toBe('7');
+
+  client.stop();
+});
+
 test('visibility toggle', async () => {
   const client = Client({ game: {} });
   client.start();
```

**File**: `src/client/transport/local.test.ts` (modified, +27/-0)
```diff
@@ -47,6 +47,33 @@ describe('bots', () => {
     expect(client.getState().ctx.turn).toBe(3);
   });
 
+  test('bots are constructed with the game’s ai options', () => {
+    const botOptions = [];
+    class SpyBot extends RandomBot {
+      constructor(opts) {
+        super(opts);
+        botOptions.push(opts);
+      }
+    }
+    const objectives = () => ({});
+
+    new LocalMaster({
+      game: ProcessGameConfig({
+        ...game,
+        ai: { ...game.ai, iterations: 42, playoutDepth: 7, objectives },
+      }),
+      bots: { '1': SpyBot },
+    });
+
+    expect(botOptions).toHaveLength(1);
+    expect(botOptions[0]).toMatchObject({
+      enumerate: expect.any(Function),
+      iterations: 42,
+      playoutDepth: 7,
+      objectives,
+    });
+  });
+
   test('no bot move', async () => {
     const client = Client({
       numPlayers: 3,
```

**File**: `src/client/transport/local.ts` (modified, +1/-1)
```diff
@@ -71,8 +71,8 @@ export class LocalMaster extends Master {
       for (const playerID in bots) {
         const bot = bots[playerID];
         initializedBots[playerID] = new bot({
+          ...game.ai,
           game,
-          enumerate: game.ai.enumerate,
           seed: game.seed,
         });
       }
```

**File**: `src/types.ts` (modified, +2/-0)
```diff
@@ -365,6 +365,8 @@ export interface Game<
   plugins?: Array<Plugin<any, any, G>>;
   ai?: {
     enumerate: (G: G, ctx: Ctx, playerID: PlayerID) => AiEnumerate;
+    // bot options forwarded by the Debug Panel, e.g. MCTSBot's iterations/playoutDepth/objectives (#7)
+    [option: string]: unknown;
   };
   processMove?: (
     state: State<G>,
```

---

### Incident Patch 2: `b196d617` (2026-07-26)
**Commit Message**: fix(build): compile dynamic imports in the jest babel env (#1287)

preset-env runs with `modules: false`, and the test env only added
`@babel/plugin-transform-modules-commonjs`, which leaves `import()`
expressions untouched. Jest runs CommonJS, so any dependency using a
dynamic import reached Node's ESM loader and threw "A dynamic import
callback was invoked without --experimental-vm-modules".

This surfaced when @testing-library/svelte 5.4.2 moved its wrapper
scaffold behind a dynamic import, breaking the debug panel tests
(#1286).


Claude-Session: https://claude.ai/code/session_01BRtvKfpVqgRdDrcY4x6zVL

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
Co-authored-by: Rupesh Pandey <pandeyrupesh00@gmail.com>

**File**: `babel.config.js` (modified, +4/-1)
```diff
@@ -12,7 +12,10 @@ module.exports = {
   ],
   env: {
     test: {
-      plugins: ['@babel/plugin-transform-modules-commonjs'],
+      plugins: [
+        '@babel/plugin-transform-modules-commonjs',
+        '@babel/plugin-transform-dynamic-import',
+      ],
     },
   },
   plugins: [
```

**File**: `babel.config.test.js` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+describe('babel config for the jest environment', () => {
+  test('compiles dynamic imports away so jest never reaches the native ESM loader', async () => {
+    const { TurnOrder } = await import('./src/core/turn-order');
+
+    expect(TurnOrder.DEFAULT).toBeDefined();
+  });
+});
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -163,6 +163,7 @@
     "@babel/node": "^7.29.0",
     "@babel/plugin-proposal-class-properties": "^7.18.6",
     "@babel/plugin-proposal-object-rest-spread": "^7.20.7",
+    "@babel/plugin-transform-dynamic-import": "^7.29.7",
     "@babel/plugin-transform-modules-commonjs": "^7.28.6",
     "@babel/preset-env": "^7.29.5",
     "@babel/preset-react": "^7.28.5",
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -99,6 +99,9 @@ importers:
       '@babel/plugin-proposal-object-rest-spread':
         specifier: ^7.20.7
         version: 7.20.7(@babel/core@7.29.7)
+      '@babel/plugin-transform-dynamic-import':
+        specifier: ^7.29.7
+        version: 7.29.7(@babel/core@7.29.7)
       '@babel/plugin-transform-modules-commonjs':
         specifier: ^7.28.6
         version: 7.29.7(@babel/core@7.29.7)
```

---

### Incident Patch 3: `b0ebe466` (2026-07-26)
**Commit Message**: fix(deps): patch transitive brace-expansion DoS alerts (#1288)

Dependabot's security update fails on this repo because it only considers
the `latest` dist-tag (5.0.8) and cannot bridge 1.x -> 5.x in place. The
maintainers backported the fix to both maintenance lines, so range-scoped
overrides patch it without a major jump.

Only minimatch consumes brace-expansion here, and each line needs its own
major: minimatch@3 -> 1.x, minimatch@8/9 -> 2.x, minimatch@10 -> 5.x.
A blanket override to 5.x would break the first three.

- brace-expansion 1.1.15 -> 1.1.16 (GHSA-3jxr-9vmj-r5cp, high)
- brace-expansion 2.1.1 -> 2.1.2 (GHSA-3jxr-9vmj-r5cp, high)

Overrides go in pnpm-workspace.yaml, where this repo keeps its pnpm
settings since #1273.

**File**: `pnpm-lock.yaml` (modified, +11/-9)
```diff
@@ -13,6 +13,8 @@ overrides:
   jest-runner: 30.4.1
   jest-runtime: 30.4.1
   jest-resolve-dependencies: 30.4.1
+  brace-expansion@<1.1.16: '>=1.1.16 <2'
+  brace-expansion@>=2.0.0 <2.1.2: '>=2.1.2 <3'
 
 importers:
 
@@ -2000,11 +2002,11 @@ packages:
     resolution: {integrity: sha512-eB4uT9RGzg2odpER62bBwSLvUeGC+WbRjjyyFhGsKnc8wp/m0+hQsMUvUe3H2V0D5vw0nBdO1hCJoZo5mKeuIQ==}
     engines: {node: '>=8'}
 
-  brace-expansion@1.1.15:
-    resolution: {integrity: sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==}
+  brace-expansion@1.1.16:
+    resolution: {integrity: sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==}
 
-  brace-expansion@2.1.1:
-    resolution: {integrity: sha512-WR1cURNjuvBLMZBMbqM0UoE+WAfdUcEV1ccD8PVBVOI+Z3ND4+SZbN8RsfT2bMuG1qwz5RFvPukSZm5fF2D5eA==}
+  brace-expansion@2.1.2:
+    resolution: {integrity: sha512-w5JZcKgdhDOgOwm8H+KgbosopHMuGcl6qbulwjtz3SM7I7P3yW1eAjzMPLrIE+NQ9vjgANKHWeMHnrT0OXW1oA==}
 
   brace-expansion@5.0.7:
     resolution: {integrity: sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==}
@@ -7143,12 +7145,12 @@ snapshots:
       type-fest: 0.8.1
       widest-line: 3.1.0
 
-  brace-expansion@1.1.15:
+  brace-expansion@1.1.16:
     dependencies:
       balanced-match: 1.0.2
       concat-map: 0.0.1
 
-  brace-expansion@2.1.1:
+  brace-expansion@2.1.2:
     dependencies:
       balanced-match: 1.0.2
 
@@ -9227,15 +9229,15 @@ snapshots:
 
   minimatch@3.1.5:
     dependencies:
-      brace-expansion: 1.1.15
+      brace-expansion: 1.1.16
 
   minimatch@8.0.7:
     dependencies:
-      brace-expansion: 2.1.1
+      brace-expansion: 2.1.2
 
   minimatch@9.0.9:
     dependencies:
-      brace-expansion: 2.1.1
+      brace-expansion: 2.1.2
 
   minimist@1.2.8: {}
 
```

**File**: `pnpm-workspace.yaml` (modified, +2/-0)
```diff
@@ -9,3 +9,5 @@ overrides:
   jest-runner: 30.4.1
   jest-runtime: 30.4.1
   jest-resolve-dependencies: 30.4.1
+  brace-expansion@<1.1.16: '>=1.1.16 <2'
+  brace-expansion@>=2.0.0 <2.1.2: '>=2.1.2 <3'
```

---

### Incident Patch 4: `107604ec` (2026-07-26)
**Commit Message**: fix: preserve log metadata for game events (#1267)

* fix: preserve log metadata for game events

* docs: clarify log metadata scope

* fix: address event log metadata review feedback

* fix: preserve metadata for events without log entries

* fix: log events with no canonical entry regardless of metadata

The fallback entry for a directly dispatched game event was only created when
a hook had set log metadata, so `endGame` and `setPhase` from no active phase
appeared in the log or not depending on what a hook happened to do.

Create the entry whether or not metadata was set, and honour `game.disableLog`,
which the fallback previously bypassed. Restrict the fallback to `endGame` and
`setPhase`, the only events that run hooks without ever producing a log entry
of their own: creating it for every event without a canonical entry would log
`endTurn` and `endStage` events that the flow refused for `minMoves`.

---------

Co-authored-by: Rupesh Pandey <pandeyrupesh00@gmail.com>

**File**: `src/core/reducer.ts` (modified, +118/-7)
```diff
@@ -26,7 +26,7 @@ import type {
   TransientState,
   Undo,
 } from '../types';
-import { stripTransients } from './action-creators';
+import { gameEvent, stripTransients } from './action-creators';
 import { ActionErrorType, UpdateErrorType } from './errors';
 import { applyPatch } from 'rfc6902';
 import { RemovePlayer } from './turn-order';
@@ -172,6 +172,108 @@ function initializeDeltalog(
   };
 }
 
+/**
+ * Get the event type used in the log for a directly dispatched game event.
+ */
+function getLogEventType(eventType: string): string | undefined {
+  switch (eventType) {
+    case 'endTurn':
+    case 'pass': {
+      return 'endTurn';
+    }
+    case 'endPhase':
+    case 'setPhase': {
+      return 'endPhase';
+    }
+    case 'endStage':
+    case 'setStage': {
+      return 'endStage';
+    }
+    case 'endGame': {
+      return 'endGame';
+    }
+  }
+}
+
+/**
+ * Events whose flow implementation never appends a log entry even though their
+ * hooks run: `endGame` is never logged, and `setPhase` starting a phase from
+ * `ctx.phase === null` returns before `EndPhase` reaches its log entry.
+ * Other events either produce a canonical entry or run no hooks at all.
+ */
+const EVENTS_WITHOUT_LOG_ENTRY = new Set(['endGame', 'setPhase']);
+
+/**
+ * Add metadata set by the log plugin to the canonical log entry for an event.
+ * If the event never produces an entry of its own, add one for the dispatched
+ * event, whether or not metadata was set, so the log shape doesn’t depend on
+ * what a hook happened to do.
+ */
+function addLogMetadata(
+  state: State,
+  action: ActionShape.GameEvent,
+  actionState: State,
+  game: Game,
+): State {
+  const metadata = state.plugins.log?.data.metadata;
+  const eventType = getLogEventType(action.payload.type);
+
+  if (game.disableLog || eventType === undefined) {
+    return state;
+  }
+
+  // GAME_EVENT processing initializes deltalog before running the flow.
+  const { deltalog } = state;
+  const eventEntry = deltalog.findIndex(
+    (entry) =>
+      entry.action.type === Actions.GAME_EVENT &&
+      entry.action.payload.type === eventType,
+  );
+
+  if (eventEntry === -1) {
+    if (!EVENTS_WITHOUT_LOG_ENTRY.has(action.payload.type)) return state;
+    // Recreate the action without credentials so they are never persisted.
+    const { type, args, playerID } = action.payload;
+    const logEntry: LogEntry = {
+      action: gameEvent(type, args, playerID),
+      _stateID: actionState._stateID,
+      turn: actionState.ctx.turn,
+      phase: actionState.ctx.phase,
+    };
+    if (metadata !== undefined) logEntry.metadata = metadata;
+    return { ...state, deltalog: [...deltalog, logEntry] };
+  }
+
+  if (metadata === undefined) return state;
+
+  const updatedDeltalog = [...deltalog];
+  updatedDeltalog[eventEntry] = {
+    ...updatedDeltalog[eventEntry],
+    metadata,
+  };
+
+  return { ...state, deltalog: updatedDeltalog };
+}
+
+/**
+ * Remove metadata set during an action that was rejected.
+ */
+function clearLogMetadata(state: State): State {
+  const logPlugin = state.plugins.log;
+  if (logPlugin?.data.metadata === undefined) return state;
+
+  const data = { ...logPlugin.data };
+  delete data.metadata;
+
+  return {
+    ...state,
+    plugins: {
+      ...state.plugins,
+      log: { ...logPlugin, data },
+    },
+  };
+}
+
 /**
  * Update plugin state after move/event & check if plugins consider the action to be valid.
  * @param state Current version of state in the reducer.
@@ -189,7 +291,11 @@ function flushAndValidatePlugins(
   if (!isInvalid) return [newState];
   return [
     newState,
-    WithError(oldState, ActionErrorType.PluginActionInvalid, isInvalid),
+    WithError(
+      clearLogMetadata(oldState),
+      ActionErrorType.PluginActionInvalid,
+      isInvalid,
+    ),
   ];
 }
 
@@ -301,7 +407,7 @@ export function CreateGameReducer({
       }
 
       case Actions.GAME_EVENT: {
-        state = { ...state, deltalog: [] };
+        con
```

**File**: `src/plugins/plugin-log.test.ts` (modified, +241/-0)
```diff
@@ -7,9 +7,12 @@
  */
 
 import { Client } from '../client/client';
+import { TurnOrder } from '../core/turn-order';
 import type { Game } from '../types';
 
 describe('log-metadata', () => {
+  test.todo('preserves metadata from hooks triggered by moves');
+
   test('It sets metadata in a move and then clears the metadata', () => {
     const game: Game = {
       moves: {
@@ -34,4 +37,242 @@ describe('log-metadata', () => {
     expect(client.getState().plugins.log.data).toEqual({});
     expect(client.getState().log[1].metadata).toEqual(undefined);
   });
+
+  test('It sets metadata in a game event and then clears the metadata', () => {
+    const game: Game = {
+      setup: () => ({ shouldLog: true }),
+      turn: {
+        onEnd: ({ G, log }) => {
+          if (G.shouldLog) {
+            log.setMetadata({ message: 'turn ended' });
+            G.shouldLog = false;
+          }
+        },
+      },
+    };
+    const client = Client({ game });
+
+    client.events.endTurn();
+
+    expect(client.getState().plugins.log.data).toEqual({});
+    expect(client.getState().log[0].metadata).toEqual({
+      message: 'turn ended',
+    });
+
+    client.events.endTurn();
+
+    expect(client.getState().log[1].metadata).toEqual(undefined);
+  });
+
+  test('It uses the last metadata set by hooks during a phase event', () => {
+    const game: Game = {
+      phases: {
+        A: {
+          start: true,
+          next: 'B',
+          onEnd: ({ log }) => {
+            log.setMetadata({ message: 'phase A ended' });
+          },
+        },
+        B: {
+          onBegin: ({ log }) => {
+            log.setMetadata({ message: 'phase B began' });
+          },
+        },
+      },
+    };
+    const client = Client({ game });
+
+    client.events.endPhase();
+
+    const log = client.getState().log;
+    expect(log.at(-1).metadata).toEqual({
+      message: 'phase B began',
+    });
+  });
+
+  test('It logs phase metadata when setPhase starts the first phase', () => {
+    const game: Game = {
+      phases: {
+        B: {
+          onBegin: ({ log }) => {
+            log.setMetadata({ message: 'phase B began' });
+          },
+        },
+      },
+    };
+    const client = Client({ game });
+
+    client.events.setPhase('B');
+
+    const log = client.getState().log;
+    const setPhase = log.find(
+      (entry) =>
+        entry.action.type === 'GAME_EVENT' &&
+        entry.action.payload.type === 'setPhase',
+    );
+
+    expect(client.getState().ctx.phase).toBe('B');
+    expect(setPhase.metadata).toEqual({ message: 'phase B began' });
+    expect(log.at(-2).metadata).toBeUndefined();
+  });
+
+  test('It logs metadata set by the game end hook', () => {
+    const game: Game = {
+      onEnd: ({ log }) => {
+        log.setMetadata({ message: 'game ended' });
+      },
+    };
+    const client = Client({ game });
+
+    client.events.endGame('winner');
+
+    const log = client.getState().log;
+    const endGame = log.find(
+      (entry) =>
+        entry.action.type === 'GAME_EVENT' &&
+        entry.action.payload.type === 'endGame',
+    );
+
+    expect(client.getState().ctx.gameover).toBe('winner');
+    expect(endGame.metadata).toEqual({ message: 'game ended' });
+    expect(log).toHaveLength(1);
+  });
+
+  test('It logs events without a canonical entry when no metadata is set', () => {
+    const game: Game = {
+      phases: {
+        B: {},
+      },
+    };
+    const client = Client({ game });
+
+    client.events.setPhase('B');
+
+    const setPhase = client
+      .getState()
+      .log.find(
+        (entry) =>
+          entry.action.type === 'GAME_EVENT' &&
+          entry.action.payload.type === 'setPhase',
+      );
+
+    expect(client.getState().ctx.phase).toBe('B');
+    expect(setPhase).toBeDefined();
+    expect(setPhase.metadata).toBeUndefined();
+
+    client.events.endGame('winner');
+
+    const endGame = client
+      .getState()
+      .log.find(
+        (entry) =>
+      
```

**File**: `src/plugins/plugin-log.ts` (modified, +2/-2)
```diff
@@ -18,8 +18,8 @@ export interface LogAPI {
 
 /**
  * Plugin that makes it possible to add metadata to log entries.
- * During a move, you can set metadata using ctx.log.setMetadata and it will be
- * available on the log entry for that move.
+ * Metadata set during a move, or during hooks triggered by a directly
+ * dispatched game event, is attached to that action's log entry.
  */
 const LogPlugin: Plugin<LogAPI, LogData> = {
   name: 'log',
```

---

### Incident Patch 5: `2dbc3b1c` (2026-07-26)
**Commit Message**: fix(debug): hide state controls in multiplayer (#1268)

* fix(debug): hide state controls in multiplayer

* test(debug): cover multiplayer state controls

**File**: `src/client/debug/main/Controls.svelte` (modified, +4/-0)
```diff
@@ -43,6 +43,9 @@
 </style>
 
 <ul id="debug-controls" class="controls">
+  {#if client.multiplayer}
+  <li>State controls are unavailable in multiplayer games.</li>
+  {:else}
   <li>
     <Hotkey value="1" onPress={client.reset} label="reset" />
   </li>
@@ -52,6 +55,7 @@
   <li>
     <Hotkey value="3" onPress={Restore} label="restore" />
   </li>
+  {/if}
   <li>
     <Hotkey value="." onPress={ToggleVisibility} label="hide" />
   </li>
```

**File**: `src/client/debug/tests/debug.test.ts` (modified, +13/-0)
```diff
@@ -173,6 +173,19 @@ describe('multiple clients', () => {
     expect(client2.playerID).toBe('1');
   });
 
+  test('hides state controls for multiplayer clients', async () => {
+    const select = screen.getByLabelText('Client');
+    await fireEvent.change(select, { target: { value: 1 } });
+
+    expect(
+      screen.getByText('State controls are unavailable in multiplayer games.'),
+    ).toBeInTheDocument();
+    expect(screen.queryByText('reset')).not.toBeInTheDocument();
+    expect(screen.queryByText('save')).not.toBeInTheDocument();
+    expect(screen.queryByText('restore')).not.toBeInTheDocument();
+    expect(screen.getByText('hide')).toBeInTheDocument();
+  });
+
   test('switching to current client', async () => {
     const select = screen.getByLabelText('Client');
     await fireEvent.change(select, { target: { value: 0 } });
```

---

### Incident Patch 6: `7c89bd82` (2026-07-25)
**Commit Message**: test(client): assert debug panel mounts and unmounts on start/stop (#1279)

**File**: `src/client/client.test.ts` (modified, +13/-4)
```diff
@@ -1023,10 +1023,19 @@ describe('start / stop', () => {
   test('mount on custom element', () => {
     const el = document.createElement('div');
     const client = Client({ game: {}, debug: { target: el } });
-    expect(() => {
-      client.start();
-      client.stop();
-    }).not.toThrow();
+
+    client.start();
+    expect(el.childElementCount).toBeGreaterThan(0);
+
+    client.stop();
+    expect(el.childElementCount).toBe(0);
+
+    // Restarting the client mounts the debug panel again.
+    client.start();
+    expect(el.childElementCount).toBeGreaterThan(0);
+
+    client.stop();
+    expect(el.childElementCount).toBe(0);
     expect(error).not.toHaveBeenCalled();
   });
 
```

---

### Incident Patch 7: `e789ea66` (2026-07-25)
**Commit Message**: fix(lobby): broadcast player metadata updates (#1278)

**File**: `src/server/api.test.ts` (modified, +67/-12)
```diff
@@ -99,6 +99,17 @@ describe('.configureRouter', () => {
     return app;
   }
 
+  function createMatchTransport() {
+    const transportAPI = { send: jest.fn(), sendAll: jest.fn() };
+    const transport = {
+      createTransportAPI: jest.fn(() => transportAPI),
+      getMatchQueue: jest.fn(() => ({
+        add: <T>(task: () => PromiseLike<T>) => Promise.resolve(task()),
+      })),
+    };
+    return { transport, transportAPI };
+  }
+
   // A single suite-level server bound explicitly to 127.0.0.1. Letting
   // supertest create a server per request would bind the wildcard address,
   // where the kernel may allocate an ephemeral port that another local
@@ -456,7 +467,7 @@ describe('.configureRouter', () => {
               return {
                 metadata: {
                   players: {
-                    '0': {},
+                    '0': { id: 0 },
                   },
                 },
               };
@@ -465,11 +476,18 @@ describe('.configureRouter', () => {
         });
 
         describe('when the playerID is available', () => {
+          let transportAPI: ReturnType<
+            typeof createMatchTransport
+          >['transportAPI'];
+
           beforeEach(async () => {
+            const matchTransport = createMatchTransport();
+            transportAPI = matchTransport.transportAPI;
             const app = createApiServer({
               db,
               auth: new Auth({ generateCredentials: () => credentials }),
               games,
+              transport: matchTransport.transport,
               uuid: () => 'matchID',
             });
             response = await apiCall(app)
@@ -498,6 +516,13 @@ describe('.configureRouter', () => {
             );
           });
 
+          test('broadcasts public match data', async () => {
+            expect(transportAPI.sendAll).toHaveBeenCalledWith({
+              type: 'matchData',
+              args: ['1', [{ id: 0, name: 'alice' }]],
+            });
+          });
+
           describe('when custom data is provided', () => {
             beforeEach(async () => {
               const app = createApiServer({ db, auth, games });
@@ -816,17 +841,23 @@ describe('.configureRouter', () => {
 
       describe('when the game does exist', () => {
         describe('when the playerID does exist', () => {
+          let transportAPI: ReturnType<
+            typeof createMatchTransport
+          >['transportAPI'];
+
           beforeEach(async () => {
             db = new AsyncStorage({
               fetch: async () => {
                 return {
                   metadata: {
                     players: {
                       '0': {
+                        id: 0,
                         name: 'alice',
                         credentials: 'SECRET1',
                       },
                       '1': {
+                        id: 1,
                         name: 'bob',
                         credentials: 'SECRET2',
                       },
@@ -835,7 +866,14 @@ describe('.configureRouter', () => {
                 };
               },
             });
-            const app = createApiServer({ db, auth, games });
+            const matchTransport = createMatchTransport();
+            transportAPI = matchTransport.transportAPI;
+            const app = createApiServer({
+              db,
+              auth,
+              games,
+              transport: matchTransport.transport,
+            });
             response = await apiCall(app)
               .post('/games/foo/1/update')
               .send('playerID=0&credentials=SECRET1&newName=ali');
@@ -869,6 +907,19 @@ describe('.configureRouter', () => {
               }),
             );
           });
+
+          test('broadcasts updated public match data', async () => {
+            expect(transportAPI.sendAll).toHaveBeenCalledWith({
+              type: 'matchData',
+              args: [
+                '1',
+                [
+                  { id: 0, name: 'ali' },
+     
```

**File**: `src/server/api.ts` (modified, +17/-1)
```diff
@@ -112,6 +112,15 @@ export const configureRouter = ({
     sendAll: () => {},
   };
 
+  const broadcastMatchData = (matchID: string, metadata: Server.MatchData) => {
+    if (!transport) return;
+    const { players } = createClientMatchData(matchID, metadata);
+    transport.createTransportAPI(matchID).sendAll({
+      type: 'matchData',
+      args: [matchID, players],
+    });
+  };
+
   const getLeaveBody = (ctx: Koa.Context) => {
     const playerID = (ctx.request.body as any)?.playerID;
     const credentials = (ctx.request.body as any)?.credentials;
@@ -186,7 +195,12 @@ export const configureRouter = ({
     delete metadata.players[playerID].name;
     delete metadata.players[playerID].credentials;
     const hasPlayers = Object.values(metadata.players).some(({ name }) => name);
-    await (hasPlayers ? db.setMetadata(matchID, metadata) : db.wipe(matchID));
+    if (hasPlayers) {
+      await db.setMetadata(matchID, metadata);
+      broadcastMatchData(matchID, metadata);
+    } else {
+      await db.wipe(matchID);
+    }
   };
 
   const clearPlayerSlotFromRequest = async (ctx: Koa.Context) => {
@@ -387,6 +401,7 @@ export const configureRouter = ({
     metadata.players[playerID].credentials = playerCredentials;
 
     await db.setMetadata(matchID, metadata);
+    broadcastMatchData(matchID, metadata);
 
     const body: LobbyAPI.JoinedMatch = { playerID, playerCredentials };
     ctx.body = body;
@@ -572,6 +587,7 @@ export const configureRouter = ({
       metadata.players[playerID].data = data;
     }
     await db.setMetadata(matchID, metadata);
+    broadcastMatchData(matchID, metadata);
     ctx.body = {};
   };
 
```

---

### Incident Patch 8: `65ca73be` (2026-07-21)
**Commit Message**: fix(server): accept games with custom plugin APIs (#1269)

* fix(server): accept games with custom plugin APIs

* test(server): add strict custom plugin consumer guard

---------

Co-authored-by: Rupesh Pandey <pandeyrupesh00@gmail.com>

**File**: `integration/package.json` (modified, +3/-1)
```diff
@@ -11,12 +11,14 @@
     "@testing-library/react": "^16.0.1",
     "@vitejs/plugin-react": "^4.3.4",
     "jsdom": "^25.0.1",
+    "typescript": "^5.9.3",
     "vite": "^5.4.10",
     "vitest": "^2.1.4"
   },
   "scripts": {
     "start": "vite",
     "build": "vite build",
-    "test": "vitest run"
+    "test": "vitest run",
+    "typecheck": "tsc --project type-tests/tsconfig.json"
   }
 }
```

**File**: `integration/type-tests/server-custom-plugin.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import type { Game, Plugin } from 'boardgame.io';
+import { Server } from 'boardgame.io/server';
+
+interface CustomPluginAPIs extends Record<string, unknown> {
+  custom: { enabled: boolean };
+}
+
+const customPlugin: Plugin<CustomPluginAPIs['custom']> = {
+  name: 'custom',
+  api: () => ({ enabled: true }),
+};
+
+const customGame: Game<{ enabled: boolean }, CustomPluginAPIs> = {
+  name: 'custom-plugin-game',
+  plugins: [customPlugin],
+  setup: ({ custom }) => ({ enabled: custom.enabled }),
+};
+
+Server({
+  games: [customGame, { name: 'standard-game' }],
+});
```

**File**: `integration/type-tests/tsconfig.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "module": "NodeNext",
+    "moduleResolution": "NodeNext",
+    "strict": true,
+    "noEmit": true,
+    "skipLibCheck": true
+  },
+  "include": ["server-custom-plugin.ts"]
+}
```

**File**: `scripts/integration.js` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ shell.exec(`pnpm add --config.minimum-release-age=0 ./${packed}`);
 shell.set('-e');
 
 // Test
+shell.exec('pnpm run typecheck');
 shell.exec('pnpm test');
 shell.exec('pnpm run build');
 shell.exec('node node-smoke/esm-test.mjs');
```

**File**: `src/server/index.test.ts` (modified, +37/-1)
```diff
@@ -15,7 +15,7 @@ import request from 'supertest';
 import { Server, createServerRunConfig, getPortFromServer } from '.';
 import type { KoaServer } from '.';
 import type { SocketIO } from './transport/socketio';
-import type { Game, StorageAPI } from '../types';
+import type { Game, Plugin, StorageAPI } from '../types';
 
 const game: Game = { seed: 0 };
 
@@ -52,6 +52,42 @@ jest.mock('socket.io', () => {
 });
 
 describe('new', () => {
+  test('processes custom-plugin and standard games through transport', () => {
+    interface CustomPluginAPIs extends Record<string, unknown> {
+      custom: { enabled: boolean };
+    }
+
+    const customPlugin: Plugin<CustomPluginAPIs['custom']> = {
+      name: 'custom',
+      api: () => ({ enabled: true }),
+    };
+    const customGame: Game<{ enabled: boolean }, CustomPluginAPIs> = {
+      name: 'custom-plugin-game',
+      plugins: [customPlugin],
+      setup: ({ custom }) => ({ enabled: custom.enabled }),
+    };
+    const init = jest.fn();
+    const transport = { init } as unknown as SocketIO;
+
+    Server({
+      games: [customGame, { name: 'standard-game' }],
+      transport,
+    });
+
+    expect(init).toHaveBeenCalledTimes(1);
+    expect(init.mock.calls[0][1]).toEqual(
+      expect.arrayContaining([
+        expect.objectContaining({
+          name: 'custom-plugin-game',
+          processMove: expect.any(Function),
+        }),
+        expect.objectContaining({
+          name: 'standard-game',
+          processMove: expect.any(Function),
+        }),
+      ]),
+    );
+  });
   test('custom db implementation', () => {
     const game: Game = {};
     const db = {} as StorageAPI.Sync;
```

---

### Incident Patch 9: `3dc2af0b` (2026-07-20)
**Commit Message**: docs(tutorial): fix parcel package name (#1129)

Co-authored-by: Rupesh Pandey <pandeyrupesh00@gmail.com>

**File**: `docs/documentation/tutorial.md` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ We’re going to add boardgame.io and also Parcel to help us build our app:
 
 ```
 npm install boardgame.io
-npm install --save-dev parcel-bundler
+npm install --save-dev parcel
 ```
 
 
```

---

### Incident Patch 10: `55200a6a` (2026-07-20)
**Commit Message**: Fix flaky server tests: bind test servers to 127.0.0.1 (#1276)

* fix(test): stop api tests from racing foreign localhost servers

supertest creates a server per request with host-less listen(0), which
binds the wildcard address. The kernel may hand out an ephemeral
wildcard port that another local process (IntelliJ, Ollama, ...) holds
on 127.0.0.1; the request then dials 127.0.0.1 and lands on that
process, yielding random wrong responses, truncated bodies, and
'Parse Error: Expected HTTP/' (~8% of suite runs on a busy dev machine).

Serve all api tests from one suite-level server bound explicitly to
127.0.0.1 that delegates to the current test's Koa callback. The bind
must be awaited: listen(port, host) resolves the host asynchronously,
and supertest silently re-listens on the wildcard when handed a
non-listening server. Verified with 80 consecutive suite runs (zero
failures) against a pre-fix baseline of ~8 failures per 100 runs.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KNK7XYPXjxHpKJUCL52kVt

* chore(test): remove leftover jest.setTimeout in the lobby API tests

A 2,000,000,000 ms timeout parked in the suite is deb

**File**: `docs/documentation/api/Server.md` (modified, +4/-0)
```diff
@@ -119,6 +119,10 @@ boardgame.io `port`.
 - `apiCallback`: Called when the Koa server is ready. Only applicable if
 `apiPort` is specified.
 
+The run config also accepts a `host` alongside `port`, which binds both the
+game server and the Lobby API server to that host. It defaults to all
+interfaces.
+
 #### With HTTPS
 
 ```js
```

**File**: `src/server/api.test.ts` (modified, +21/-3)
```diff
@@ -10,6 +10,8 @@
  * https://opensource.org/licenses/MIT.
  */
 
+import http from 'node:http';
+import { once } from 'node:events';
 import request from 'supertest';
 import Koa from 'koa';
 import Router from '@koa/router';
@@ -24,8 +26,6 @@ import { InMemory } from './db/inmemory';
 import { Origins } from './cors';
 import type { Game, Server } from '../types';
 
-jest.setTimeout(2_000_000_000);
-
 beforeEach(() => {
   dateMock.clear();
 });
@@ -99,8 +99,26 @@ describe('.configureRouter', () => {
     return app;
   }
 
+  // A single suite-level server bound explicitly to 127.0.0.1. Letting
+  // supertest create a server per request would bind the wildcard address,
+  // where the kernel may allocate an ephemeral port that another local
+  // process holds on 127.0.0.1, silently routing requests to that process.
+  let currentApp: ReturnType<Koa['callback']>;
+  const httpServer = http.createServer((req, res) => currentApp(req, res));
+
+  beforeAll(async () => {
+    httpServer.listen(0, '127.0.0.1');
+    await once(httpServer, 'listening');
+  });
+
+  afterAll(async () => {
+    httpServer.close();
+    await once(httpServer, 'close');
+  });
+
   function apiCall(app: Koa) {
-    const agent = request(app.callback());
+    currentApp = app.callback();
+    const agent = request(httpServer);
     return {
       get: (path: string) => agent.get(path).set('Connection', 'close'),
       post: (path: string) => agent.post(path).set('Connection', 'close'),
```

**File**: `src/server/index.test.ts` (modified, +6/-4)
```diff
@@ -128,8 +128,9 @@ describe('run', () => {
   test('multiple servers running', async () => {
     server = Server({ games: [game] });
     runningServer = await server.run({
-      port: 57_890,
-      lobbyConfig: { apiPort: 57_891 },
+      port: 0,
+      host: '127.0.0.1',
+      lobbyConfig: { apiPort: 0 },
     });
 
     expect(server).not.toBeUndefined();
@@ -148,7 +149,8 @@ describe('run', () => {
     const apiCallback = jest.fn();
     server = Server({ games: [game] });
     runningServer = await server.run({
-      lobbyConfig: { apiPort: 9999, apiCallback },
+      host: '127.0.0.1',
+      lobbyConfig: { apiPort: 0, apiCallback },
     });
     expect(apiCallback).toHaveBeenCalled();
   });
@@ -163,7 +165,7 @@ describe('run', () => {
     server = Server({ games: [game] });
     server.router.use('/games', usedMiddleware);
     server.router.use('/games/unused', unusedMiddleware);
-    runningServer = await server.run(8888);
+    runningServer = await server.run({ port: 0, host: '127.0.0.1' });
 
     await request(runningServer.appServer).get('/games');
     expect(usedMiddleware).toHaveBeenCalled();
```

**File**: `src/server/index.ts` (modified, +7/-5)
```diff
@@ -22,6 +22,8 @@ export type KoaServer = ReturnType<Koa['listen']>;
 
 interface ServerConfig {
   port?: number;
+  /** Host or IP to bind to (both game server and Lobby API). Defaults to all interfaces. */
+  host?: string;
   callback?: () => void;
   lobbyConfig?: {
     apiPort: number;
@@ -154,9 +156,9 @@ export function Server({
       await db.connect();
 
       // Lobby API
-      const lobbyConfig = serverRunConfig.lobbyConfig;
+      const { port, host, lobbyConfig } = serverRunConfig;
       let apiServer: KoaServer | undefined;
-      if (!lobbyConfig || !lobbyConfig.apiPort) {
+      if (!lobbyConfig || lobbyConfig.apiPort == null) {
         configureApp(app, router, apiOrigins);
       } else {
         // Run API in a separate Koa app.
@@ -165,7 +167,7 @@ export function Server({
         api.context.auth = auth;
         configureApp(api, router, apiOrigins);
         await new Promise<void>((resolve) => {
-          apiServer = api.listen(lobbyConfig.apiPort, () => resolve());
+          apiServer = api.listen(lobbyConfig.apiPort, host, () => resolve());
         });
         if (lobbyConfig.apiCallback) lobbyConfig.apiCallback();
         logger.info(`API serving on ${getPortFromServer(apiServer)}...`);
@@ -176,8 +178,8 @@ export function Server({
       const httpServer = transport.server;
       await new Promise<void>((resolve) => {
         appServer = httpServer
-          ? httpServer.listen(serverRunConfig.port, () => resolve())
-          : app.listen(serverRunConfig.port, () => resolve());
+          ? httpServer.listen(port, host, () => resolve())
+          : app.listen(port, host, () => resolve());
       });
       if (serverRunConfig.callback) serverRunConfig.callback();
       logger.info(`App serving on ${getPortFromServer(appServer)}...`);
```

#### Recent Merged Pull Requests:
- **PR #1325** (2026-08-10): Migrate ESLint to flat config so ESLint 9 can land (@devill)
- **PR #1323** (2026-08-03): chore(ci): group every Dependabot update into one weekly pull request (@devill)
- **PR #1322** (2026-08-02): chore(deps-dev): bump eslint-config-prettier from 9.1.2 to 10.1.8 (@dependabot[bot])
- **PR #1321** (2026-08-02): chore(deps-dev): bump eslint-plugin-jest from 28.14.0 to 29.16.0 (@dependabot[bot])
- **PR #1320** (2026-08-02): chore(deps-dev): bump @types/node from 25.9.4 to 26.1.1 (@dependabot[bot])
- **PR #1319** (2026-08-02): chore(deps-dev): bump the npm-minor-patch group across 1 directory with 2 updates (@dependabot[bot])
- **PR #1318** (2026-08-02): chore(deps-dev): bump typescript from 6.0.3 to 7.0.2 in /integration (@dependabot[bot])
- **PR #1317** (2026-08-02): chore(deps-dev): bump jsdom from 26.1.0 to 29.1.1 in /integration (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
