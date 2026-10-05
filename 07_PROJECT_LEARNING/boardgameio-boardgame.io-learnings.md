# Forensic Learning Record (Deep Inspection): boardgameio/boardgame.io

> **Canonical Artifact**: `07_PROJECT_LEARNING/boardgameio-boardgame.io-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:20:56.275Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `boardgameio/boardgame.io`
- **Description**: State Management and Multiplayer Networking for Turn-Based Games
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12452 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/react-web/src/secret-state/board.js`
```
/*
 * Copyright 2017 The boardgame.io Authors.
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import React from 'react';
import PropTypes from 'prop-types';
import './board.css';

const Board = ({ G, ctx, moves, playerID }) => (
  <div className="secret-state">
    <section>
      <pre>{JSON.stringify(G, null, 2)}</pre>
    </section>
  </div>
);

Board.propTypes = {
  G: PropTypes.any.isRequired,
  ctx: PropTypes.any.isRequired,
  moves: PropTypes.any.isRequired,
  playerID: PropTypes.any,
};

export default Board;

```

### Core Architecture Module: `examples/react-web/src/secret-state/game.js`
```
/*
 * Copyright 2018 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { PlayerView } from 'boardgame.io/core';

const SecretState = {
  name: 'secret-state',

  setup: () => ({
    other: {},
    players: {
      0: 'player 0 state',
      1: 'player 1 state',
      2: 'player 2 state',
    },
  }),

  playerView: PlayerView.STRIP_SECRETS,
};

export default SecretState;

```

### Core Architecture Module: `examples/react-web/src/secret-state/index.js`
```
/*
 * Copyright 2018 The boardgame.io Authors.
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import Multiview from './multiview';

const routes = [
  {
    path: '/liars-dice',
    text: 'Examples',
    component: Multiview,
  },
];

export default { routes };

```

### Core Architecture Module: `examples/react-web/src/secret-state/multiview.js`
```
/*
 * Copyright 2018 The boardgame.io Authors.
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import React from 'react';
import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';
import Game from './game';
import Board from './board';

const App = Client({
  game: Game,
  numPlayers: 3,
  board: Board,
  debug: false,
  multiplayer: Local(),
});

const Multiview = () => (
  <div style={{ padding: 50 }}>
    <h1>Secret Info</h1>
    <div className="runner">
      <div className="run">
        <App matchID="secret-state" playerID="0" />
        &lt;App playerID=&quot;0&quot;/&gt;
      </div>
      <div className="run">
        <App matchID="secret-state" playerID="1" />
        &lt;App playerID=&quot;1&quot;/&gt;
      </div>
      <div className="run">
        <App matchID="secret-state" playerID="2" />
        &lt;App playerID=&quot;2&quot;/&gt;
      </div>
      <div className="run">
        <App matchID="secret-state" />
        &lt;App/&gt;
      </div>
    </div>
  </div>
);

export default Multiview;

```

### Core Architecture Module: `packages/core.ts`
```
/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

export { INVALID_MOVE } from '../src/core/constants';
export { ActivePlayers, TurnOrder, Stage } from '../src/core/turn-order';
export { GameMethod } from '../src/core/game-methods';

export { PlayerView } from '../src/core/player-view';

```

### Core Architecture Module: `src/client/debug/utils/shortcuts.js`
```
/*
 * Copyright 2018 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

export function AssignShortcuts(moveNames, blacklist) {
  let shortcuts = {};

  const taken = {};
  for (const c of blacklist) {
    taken[c] = true;
  }

  // Try assigning the first char of each move as the shortcut.
  let t = taken;
  let canUseFirstChar = true;
  for (const name in moveNames) {
    const shortcut = name[0];
    if (t[shortcut]) {
      canUseFirstChar = false;
      break;
    }

    t[shortcut] = true;
    shortcuts[name] = shortcut;
  }
  if (canUseFirstChar) {
    return shortcuts;
  }

  // If those aren't unique, use a-z.
  t = taken;
  let next = 97;
  shortcuts = {};
  for (const name in moveNames) {
    let shortcut = String.fromCharCode(next);

    while (t[shortcut]) {
      next++;
      shortcut = String.fromCharCode(next);
    }

    t[shortcut] = true;
    shortcuts[name] = shortcut;
  }
  return shortcuts;
}

```

### Core Architecture Module: `src/core/action-creators.ts`
```
/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import * as Actions from './action-types';
import type { SyncInfo, State, LogEntry } from '../types';
import type { Operation } from 'rfc6902';

/**
 * Generate a move to be dispatched to the game move reducer.
 *
 * @param {string} type - The move type.
 * @param {Array}  args - Additional arguments.
 * @param {string}  playerID - The ID of the player making this action.
 * @param {string}  credentials - (optional) The credentials for the player making this action.
 */
export const makeMove = (
  type: string,
  args?: any,
  playerID?: string | null,
  credentials?: string,
) => ({
  type: Actions.MAKE_MOVE as typeof Actions.MAKE_MOVE,
  payload: { type, args, playerID, credentials },
});

/**
 * Generate a game event to be dispatched to the flow reducer.
 *
 * @param {string} type - The event type.
 * @param {Array}  args - Additional arguments.
 * @param {string}  playerID - The ID of the player making this action.
 * @param {string}  credentials - (optional) The credentials for the player making this action.
 */
export const gameEvent = (
  type: string,
  args?: any,
  playerID?: string | null,
  credentials?: string,
) => ({
  type: Actions.GAME_EVENT as typeof Actions.GAME_EVENT,
  payload: { type, args, playerID, credentials },
});

/**
 * Generate an automatic game event that is a side-effect of a move.
 * @param {string} type - The event type.
 * @param {Array}  args - Additional arguments.
 * @param {string}  playerID - The ID of the player making this action.
 * @param {string}  credentials - (optional) The credentials for the player making this action.
 */
export const automaticGameEvent = (
  type: string,
  args: any,
  playerID?: string | null,
  credentials?: string,
) => ({
  type: Actions.GAME_EVENT as typeof Actions.GAME_EVENT,
  payload: { type, args, playerID, credentials },
  automatic: true,
});

export const sync = (info: SyncInfo) => ({
  type: Actions.SYNC as typeof Actions.SYNC,
  state: info.state,
  log: info.log,
  initialState: info.initialState,
  clientOnly: true as const,
});

/**
 * Used to update the Redux store's state with patch in response to
 * an action coming from another player.
 * @param prevStateID previous stateID
 * @param stateID stateID after this patch
 * @param {Operation[]} patch - The patch to apply.
 * @param {LogEntry[]} deltalog - A log delta.
 */
export const patch = (
  prevStateID: number,
  stateID: number,
  patch: Operation[],
  deltalog: LogEntry[],
) => ({
  type: Actions.PATCH as typeof Actions.PATCH,
  prevStateID,
  stateID,
  patch,
  deltalog,
  clientOnly: true as const,
});

/**
 * Used to update the Redux store's state in response to
 * an action coming from another player.
 * @param {object} state - The state to restore.
 * @param {Array} deltalog - A log delta.
 */
export const update = (state: State, deltalog: LogEntry[]) => ({
  type: Actions.UPDATE as typeof Actions.UPDATE,
  state,
  deltalog,
  clientOnly: true as const,
});

/**
 * Used to reset the game state.
 * @param {object} state - The initial state.
 */
export const reset = (state: State) => ({
  type: Actions.RESET as typeof Actions.RESET,
  state,
  clientOnly: true as const,
});

/**
 * Used to undo the last move.
 * @param {string}  playerID - The ID of the player making this action.
 * @param {string}  credentials - (optional) The credentials for the player making this action.
 */
export const undo = (playerID?: string | null, credentials?: string) => ({
  type: Actions.UNDO as typeof Actions.UNDO,
  payload: { type: null, args: null, playerID, credentials },
});

/**
 * Used to redo the last undone move.
 * @param {string}  playerID - The ID of the player making this action.
 * @param {string}  credentials - (optional) The credentials for the player making this action.
 */
export const redo = (playerID?: string | null, credentials?: string) => ({
  type: Actions.REDO as typeof Actions.REDO,
  payload: { type: null, args: null, playerID, credentials },
});

/**
 * Allows plugins to define their own actions and intercept them.
 */
export const plugin = (
  type: string,
  args?: any,
  playerID?: string | null,
  credentials?: string,
) => ({
  type: Actions.PLUGIN as typeof Actions.PLUGIN,
  payload: { type, args, playerID, credentials },
});

export const playerLeave = (playerID: string) => ({
  type: Actions.PLAYER_LEAVE as typeof Actions.PLAYER_LEAVE,
  payload: { playerID },
});

/**
 * Private action used to strip transient metadata (e.g. errors) from the game
 * state.
 */
export const stripTransients = () => ({
  type: Actions.STRIP_TRANSIENTS as typeof Actions.STRIP_TRANSIENTS,
});

```

### Core Architecture Module: `src/core/action-types.ts`
```
/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

export const MAKE_MOVE = 'MAKE_MOVE';
export const GAME_EVENT = 'GAME_EVENT';
export const REDO = 'REDO';
export const RESET = 'RESET';
export const SYNC = 'SYNC';
export const UNDO = 'UNDO';
export const UPDATE = 'UPDATE';
export const PATCH = 'PATCH';
export const PLUGIN = 'PLUGIN';
export const PLAYER_LEAVE = 'PLAYER_LEAVE';
export const STRIP_TRANSIENTS = 'STRIP_TRANSIENTS';

```

### Core Architecture Module: `src/core/backwards-compatibility.ts`
```
type MoveLimitOptions = {
  minMoves?: number;
  maxMoves?: number;
  moveLimit?: number;
};

/**
 * Adjust the given options to use the new minMoves/maxMoves if a legacy moveLimit was given
 * @param options The options object to apply backwards compatibility to
 * @param enforceMinMoves Use moveLimit to set both minMoves and maxMoves
 */
export function supportDeprecatedMoveLimit(
  options: MoveLimitOptions,
  enforceMinMoves = false,
) {
  if (options.moveLimit) {
    if (enforceMinMoves) {
      options.minMoves = options.moveLimit;
    }
    options.maxMoves = options.moveLimit;
    delete options.moveLimit;
  }
}

```

### Core Architecture Module: `src/core/constants.ts`
```
/**
 * Moves can return this when they want to indicate
 * that the combination of arguments is illegal and
 * the move ought to be discarded.
 */
export const INVALID_MOVE = 'INVALID_MOVE';

```

### Core Architecture Module: `src/core/errors.ts`
```
/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

export enum UpdateErrorType {
  // The action’s credentials were missing or invalid
  UnauthorizedAction = 'update/unauthorized_action',
  // The action’s matchID was not found
  MatchNotFound = 'update/match_not_found',
  // Could not apply Patch operation (rfc6902).
  PatchFailed = 'update/patch_failed',
}

export enum ActionErrorType {
  // The action contained a stale state ID
  StaleStateId = 'action/stale_state_id',
  // The requested move is unknown or not currently available
  UnavailableMove = 'action/unavailable_move',
  // The move declared it was invalid (INVALID_MOVE constant)
  InvalidMove = 'action/invalid_move',
  // The player making the action is not currently active
  InactivePlayer = 'action/inactive_player',
  // The game has finished
  GameOver = 'action/gameover',
  // The requested action is disabled (e.g. undo/redo, events)
  ActionDisabled = 'action/action_disabled',
  // The requested action is not currently possible
  ActionInvalid = 'action/action_invalid',
  // The requested action was declared invalid by a plugin
  PluginActionInvalid = 'action/plugin_invalid',
}

```

### Core Architecture Module: `src/core/flow.ts`
```
/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import {
  SetActivePlayers,
  UpdateActivePlayersOnceEmpty,
  InitTurnOrderState,
  UpdateTurnOrderState,
  RemovePlayer,
  Stage,
  TurnOrder,
} from './turn-order';
import { gameEvent } from './action-creators';
import * as plugin from '../plugins/main';
import * as logging from './logger';
import type {
  ActionPayload,
  ActionShape,
  ActivePlayersArg,
  State,
  Ctx,
  FnContext,
  LogEntry,
  Game,
  MoveInfo,
  PhaseConfig,
  PlayerID,
  Move,
} from '../types';
import { GameMethod } from './game-methods';
import { supportDeprecatedMoveLimit } from './backwards-compatibility';

/**
 * Flow
 *
 * Creates a reducer that updates ctx (analogous to how moves update G).
 */
export function Flow({
  moves,
  phases,
  endIf,
  onEnd,
  turn,
  events,
  plugins,
  disableLog,
}: Game) {
  // Attach defaults.
  if (moves === undefined) {
    moves = {};
  }
  if (events === undefined) {
    events = {};
  }
  if (plugins === undefined) {
    plugins = [];
  }
  if (phases === undefined) {
    phases = {};
  }

  if (!endIf) endIf = () => undefined;
  if (!onEnd) onEnd = ({ G }) => G;
  if (!turn) turn = {};

  const phaseMap = { ...phases };

  if ('' in phaseMap) {
    logging.error('cannot specify phase with empty name');
  }

  phaseMap[''] = {};

  const moveMap = {};
  const moveNames = new Set();
  let startingPhase = null;

  Object.keys(moves).forEach((name) => moveNames.add(name));

  const HookWrapper = (
    hook: (context: FnContext) => any,
    hookType: GameMethod,
  ) => {
    const withPlugins = plugin.FnWrap(hook, hookType, plugins);
    return (state: State & { playerID?: PlayerID; move?: MoveInfo }) => {
      const pluginAPIs = plugin.GetAPIs(state);
      return withPlugins({
        ...pluginAPIs,
        G: state.G,
        ctx: state.ctx,
        playerID: state.playerID,
        ...(state.move !== undefined && { move: state.move }),
      });
    };
  };

  const TriggerWrapper = (trigger: (context: FnContext) => any) => {
    return (state: State) => {
      const pluginAPIs = plugin.GetAPIs(state);
      return trigger({
        ...pluginAPIs,
        G: state.G,
        ctx: state.ctx,
      });
    };
  };

  const appendLogEntry = (state: State, logEntry: LogEntry): LogEntry[] =>
    disableLog ? state.deltalog || [] : [...(state.deltalog || []), logEntry];

  const wrapped = {
    onEnd: HookWrapper(onEnd, GameMethod.GAME_ON_END),
    endIf: TriggerWrapper(endIf),
  };

  for (const phase in phaseMap) {
    const phaseConfig = phaseMap[phase];

    if (phaseConfig.start === true) {
      startingPhase = phase;
    }

    if (phaseConfig.moves !== undefined) {
      for (const move of Object.keys(phaseConfig.moves)) {
        moveMap[phase + '.' + move] = phaseConfig.moves[move];
        moveNames.add(move);
      }
    }

    if (phaseConfig.endIf === undefined) {
      phaseConfig.endIf = () => undefined;
    }
    if (phaseConfig.onBegin === undefined) {
      phaseConfig.onBegin = ({ G }) => G;
    }
    if (phaseConfig.onEnd === undefined) {
      phaseConfig.onEnd = ({ G }) => G;
    }
    if (phaseConfig.turn === undefined) {
      phaseConfig.turn = turn;
    }
    if (phaseConfig.turn.order === undefined) {
      phaseConfig.turn.order = TurnOrder.DEFAULT;
    }
    if (phaseConfig.turn.onBegin === undefined) {
      phaseConfig.turn.onBegin = ({ G }) => G;
    }
    if (phaseConfig.turn.onEnd === undefined) {
      phaseConfig.turn.onEnd = ({ G }) => G;
    }
    if (phaseConfig.turn.endIf === undefined) {
      phaseConfig.turn.endIf = () => false;
    }
    if (phaseConfig.turn.onMove === undefined) {
      phaseConfig.turn.onMove = ({ G }) => G;
    }
    if (phaseConfig.turn.stages === undefined) {
      phaseConfig.turn.stages = {};
    }

    // turns previously treated moveLimit as both minMoves and maxMoves, this behaviour is kept intentionally
    supportDeprecatedMoveLimit(phaseConfig.turn, true);

    for (const stage in phaseConfig.turn.stages) {
      const stageConfig = phaseConfig.turn.stages[stage];
      const moves = stageConfig.moves || {};
      for (const move of Object.keys(moves)) {
        const key = phase + '.' + stage + '.' + move;
        moveMap[key] = moves[move];
        moveNames.add(move);
      }
    }

    phaseConfig.wrapped = {
      onBegin: HookWrapper(phaseConfig.onBegin, GameMethod.PHASE_ON_BEGIN),
      onEnd: HookWrapper(phaseConfig.onEnd, GameMethod.PHASE_ON_END),
      endIf: TriggerWrapper(phaseConfig.endIf),
    };

    phaseConfig.turn.wrapped = {
      onMove: HookWrapper(phaseConfig.turn.onMove, GameMethod.TURN_ON_MOVE),
      onBegin: HookWrapper(phaseConfig.turn.onBegin, GameMethod.TURN_ON_BEGIN),
      onEnd: HookWrapper(phaseConfig.turn.onEnd, GameMethod.TURN_ON_END),
      endIf: TriggerWrapper(phaseConfig.turn.endIf),
    };

    if (typeof phaseConfig.next !== 'function') {
      const { next } = phaseConfig;
      phaseConfig.next = () => next || null;
    }
    phaseConfig.wrapped.next = TriggerWrapper(phaseConfig.next);
  }

  function GetPhase(ctx: { phase: string }): PhaseConfig {
    return ctx.phase ? phaseMap[ctx.phase] : phaseMap[''];
  }

  function OnMove(state: State) {
    return state;
  }

  function Process(
    state: State,
    events: {
      fn: (state: State, opts: any) => State;
      arg?: any;
      turn?: Ctx['turn'];
      phase?: Ctx['phase'];
      automatic?: boolean;
      playerID?: PlayerID;
      force?: boolean;
    }[],
  ): State {
    const phasesEnded = new Set();
    const turnsEnded = new Set();

    for (let i = 0; i < events.length; i++) {
      const { fn, arg, ...rest } = events[i];

      // Detect a loop of EndPhase calls.
      // This could potentially even be an infinite loop
      // if the endIf condition of each phase blindly
      // returns true. The moment we detect a single
      // loop, we just bail out of all phases.
      if (fn === EndPhase) {
        turnsEnded.clear();
        const phase = state.ctx.phase;
        if (phasesEnded.has(phase)) {
          const ctx = { ...state.ctx, phase: null };
          return { ...state, ctx };
        }
        phasesEnded.add(phase);
      }

      // Process event.
      const next = [];
      state = fn(state, {
        ...rest,
        arg,
        next,
      });

      if (fn === EndGame) {
        break;
      }

      // Check if we should end the game.
      const shouldEndGame = ShouldEndGame(state);
      if (shouldEndGame) {
        events.push({
          fn: EndGame,
          arg: shouldEndGame,
          turn: state.ctx.turn,
          phase: state.ctx.phase,
          automatic: true,
        });
        continue;
      }

      // Check if we should end the phase.
      const shouldEndPhase = ShouldEndPhase(state);
      if (shouldEndPhase) {
        events.push({
          fn: EndPhase,
          arg: shouldEndPhase,
          turn: state.ctx.turn,
          phase: state.ctx.phase,
          automatic: true,
        });
        continue;
      }

      // Check if we should end the turn.
      if ([OnMove, UpdateStage, UpdateActivePlayers].includes(fn)) {
        const shouldEndTurn = ShouldEndTurn(state);
        if (shouldEndTurn) {
          events.push({
            fn: EndTurn,
            arg: shouldEndTurn,
            turn: state.ctx.turn,
            phase: state.ctx.phase,
            automatic: true,
          });
          continue;
        }
      }

      events.push(...next);
    }

    return state;
  }

  ///////////
  // Start //
  ///////////

  function StartGame(state: State, { next }): State {
    next.push({ fn: StartPhase });
    return state;
  }

  function StartPhase(state: State, { next }): State {
    let { G, ctx } = state;
    const phaseConfig = GetPhase(ctx);

    // Run any phase setup code provided by the user.
    G = phaseConfig.wrapped.onBegin(state);

    next.push({ fn: StartTurn });

    return { ...state, G, ctx };
  }

  function StartTurn(state: State, { currentPlayer }): State {
    let { ctx } = state;
    const phaseConfig = GetPhase(ctx);

    // Initialize the turn order state.
    if (currentPlayer) {
      ctx = { ...ctx, currentPlayer };
      if (phaseConfig.turn.activePlayers) {
        ctx = SetActivePlayers(ctx, phaseConfig.turn.activePlayers);
      }
    } else {
      // This is only called at the beginning of the phase
      // when there is no currentPlayer yet.
      ctx = InitTurnOrderState(state, phaseConfig.turn);
    }

    const turn = ctx.turn + 1;
    ctx = { ...ctx, turn, numMoves: 0, _prevActivePlayers: [] };

    const G = phaseConfig.turn.wrapped.onBegin({ ...state, ctx });

    return { ...state, G, ctx, _undo: [], _redo: [] } as State;
  }

  ////////////
  // Update //
  ////////////

  function UpdatePhase(state: State, { arg, next, phase }): State {
    const phaseConfig = GetPhase({ phase });
    let { ctx } = state;

    if (arg && arg.next) {
      if (arg.next in phaseMap) {
        ctx = { ...ctx, phase: arg.next };
      } else {
        logging.error('invalid phase: ' + arg.next);
        return state;
      }
    } else {
      ctx = { ...ctx, phase: phaseConfig.wrapped.next(state) || null };
    }

    state = { ...state, ctx };

    // Start the new phase.
    next.push({ fn: StartPhase });

    return state;
  }

  function UpdateTurn(state: State, { arg, currentPlayer, next }): State {
    let { G, ctx } = state;
    const phaseConfig = GetPhase(ctx);

    // Update turn order state.
    const { endPhase, ctx: newCtx } = UpdateTurnOrderState(
      state,
      currentPlayer,
      phaseConfig.turn,
      arg,
    );
    ctx = newCtx;

    state = { ...state, G, ctx };

    if (endPhase) {
      next.push({ fn: EndPhase, turn: ctx.turn, phase: ctx.phase });
    } else {
      next.push({ fn: StartTurn, curr
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

### Incident Patch 1: `0d3f3fc4` (2026-08-02)
**Commit Message**: build(integration): stop test:integration modifying tracked files (#1315)

* build(integration): keep the integration install out of the root workspace

`pnpm add` of the local tarball walks up to the repo root, registers
integration/ as a workspace importer and writes the tarball into the root
pnpm-lock.yaml — a change that must never be committed but sits in the
working tree after every run. `pnpm install` alone does not do this; only
the tarball add does. --ignore-workspace pins both commands to the scaffold,
which is what they meant all along: it has its own gitignored lockfile.

* build(integration): restore the scaffold manifest after installing the tarball

`pnpm add` always saves to the manifest and pnpm 10 has no --no-save, so
every run left `boardgame.io: file:boardgame.io-<version>.tgz` in
integration/package.json — a tracked file, and a line that pins a version
that only exists on the machine that built it.

Snapshotting and writing the manifest back straight after the install means
a failing check further down cannot leave it dirty either. The checks
resolve the package through node_modules, which is already populated by
then.

---------

Co-authored-by: Rupesh Pandey 

**File**: `scripts/integration.js` (modified, +15/-2)
```diff
@@ -24,11 +24,24 @@ shell.rm('-rf', 'node_modules');
 // the CLI flag wins. This sealed scaffold uses pinned deps, so the cooldown
 // adds no protection here. Also sidesteps pnpm 10.16's ERR_PNPM_MISSING_TIME
 // on packages whose abbreviated registry metadata lacks the time field.
-shell.exec('pnpm install --config.minimum-release-age=0');
+// --ignore-workspace stops pnpm walking up to the repo root. Without it,
+// `pnpm add` of a local tarball registers integration/ as an importer of the
+// root workspace and writes the tarball into the root pnpm-lock.yaml.
+shell.exec('pnpm install --ignore-workspace --config.minimum-release-age=0');
 // `./` prefix is required so pnpm treats the filename as a local tarball
 // rather than a registry package name (npm install <name>.tgz is forgiving;
 // pnpm add is not).
-shell.exec(`pnpm add --config.minimum-release-age=0 ./${packed}`);
+//
+// pnpm add always saves to the manifest and has no --no-save, so snapshot it
+// and put it back. The tarball name carries the version and must never be
+// committed. Restoring here rather than at the end means a failing check
+// below cannot leave the file dirty either; the checks resolve the package
+// through node_modules, which is already populated.
+const manifest = shell.cat('package.json').toString();
+shell.exec(
+  `pnpm add --ignore-workspace --config.minimum-release-age=0 ./${packed}`,
+);
+shell.ShellString(manifest).to('package.json');
 
 shell.set('-e');
 
```

---

### Incident Patch 2: `66011f3a` (2026-08-02)
**Commit Message**: build(integration): bump vite and vitest, and put the directory in Dependabot's scope (#1311)

* build(integration): bump vite to 8 and vitest to 4

Closes four Dependabot alerts against the integration scaffold: the vitest
UI arbitrary file read/execute (critical), the vite `server.fs.deny` bypass
on Windows, the optimized-deps `.map` path traversal, and the launch-editor
NTLMv2 hash disclosure.

@vitejs/plugin-react comes along because v6 is the first release that peers
with vite 8. Going straight to current rather than to the minimum patched
versions keeps Dependabot from opening a stack of major-version PRs the
moment this directory comes into scope.

* ci(dependabot): scan the integration scaffold too

integration/package.json was outside every update entry, so its
dependencies drifted five majors behind and four security alerts sat there
with no PR to fix them. It keeps its own group so its updates stay separate
from the library's.

---------

Co-authored-by: Rupesh Pandey <[REDACTED_EMAIL]>

**File**: `.github/dependabot.yml` (modified, +14/-0)
```diff
@@ -13,6 +13,20 @@ updates:
           - minor
           - patch
 
+  # The integration scaffold has its own manifest and no lockfile, so the
+  # root entry above never sees it.
+  - package-ecosystem: npm
+    directory: /integration
+    schedule:
+      interval: weekly
+    cooldown:
+      default-days: 7
+    groups:
+      integration-minor-patch:
+        update-types:
+          - minor
+          - patch
+
   - package-ecosystem: github-actions
     directory: /
     schedule:
```

**File**: `integration/package.json` (modified, +3/-3)
```diff
@@ -9,11 +9,11 @@
   },
   "devDependencies": {
     "@testing-library/react": "^16.0.1",
-    "@vitejs/plugin-react": "^4.3.4",
+    "@vitejs/plugin-react": "^6.0.5",
     "jsdom": "^25.0.1",
     "typescript": "^5.9.3",
-    "vite": "^5.4.10",
-    "vitest": "^2.1.4"
+    "vite": "^8.2.0",
+    "vitest": "^4.1.10"
   },
   "scripts": {
     "start": "vite",
```

---

### Incident Patch 3: `8655a2d1` (2026-08-01)
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

### Incident Patch 4: `febf9a81` (2026-07-26)
**Commit Message**: build(integration): pin publint and attw as devDependencies (#1293)

publint was fetched with `pnpm dlx publint@latest` on every run, an unpinned
network dependency that caused the #1285 flake. attw was pinned inline at
0.18.2 and had drifted five patch releases behind.

Both now resolve from the lockfile, so Dependabot keeps them current.


Claude-Session: https://claude.ai/code/session_01XadLkkyYJi67L2iEvbrrFL

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Co-authored-by: Rupesh Pandey <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +2/-0)
```diff
@@ -158,6 +158,7 @@
     }
   ],
   "devDependencies": {
+    "@arethetypeswrong/cli": "^0.18.5",
     "@babel/cli": "^7.28.6",
     "@babel/core": "^7.29.0",
     "@babel/node": "^7.29.0",
@@ -206,6 +207,7 @@
     "nodemon": "^3.1.14",
     "npm-run-all": "^4.1.5",
     "prettier": "^3.8.3",
+    "publint": "^0.3.22",
     "raf": "^3.4.1",
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
```

**File**: `pnpm-lock.yaml` (modified, +327/-0)
```diff
@@ -84,6 +84,9 @@ importers:
         specifier: ^9.6.0
         version: 9.6.0
     devDependencies:
+      '@arethetypeswrong/cli':
+        specifier: ^0.18.5
+        version: 0.18.5
       '@babel/cli':
         specifier: ^7.28.6
         version: 7.29.7(@babel/core@7.29.7)
@@ -228,6 +231,9 @@ importers:
       prettier:
         specifier: ^3.8.3
         version: 3.9.5
+      publint:
+        specifier: ^0.3.22
+        version: 0.3.22
       raf:
         specifier: ^3.4.1
         version: 3.4.1
@@ -270,6 +276,18 @@ packages:
   '@adobe/css-tools@4.5.0':
     resolution: {integrity: sha512-6OzddxPio9UiWTCemp4N8cYLV2ZN1ncRnV1cVGtve7dhPOtRkleRyx32GQCYSwDYgaHU3USMm84tNsvKzRCa1Q==}
 
+  '@andrewbranch/untar.js@1.0.3':
+    resolution: {integrity: sha512-Jh15/qVmrLGhkKJBdXlK1+9tY4lZruYjsgkDFj08ZmDiWVBLJcqkok7Z0/R0In+i1rScBpJlSvrTS2Lm41Pbnw==}
+
+  '@arethetypeswrong/cli@0.18.5':
+    resolution: {integrity: sha512-gM+8vRsQOD/Uc7EnBedUhkG5OCsDWE4uoak5QvomGpMpaky0Eh41p04nIMgrWb8EOmqZUJGc6zz9hsP6E56R7g==}
+    engines: {node: '>=20'}
+    hasBin: true
+
+  '@arethetypeswrong/core@0.18.5':
+    resolution: {integrity: sha512-9ytjzGwxjm9Uz7I9avfbt5vlQt6uk9uRRESzJjqrznl6WKvI6dwYTo+vJ3U02Wrq/mR3iql/PzhvHhKdJIAjDQ==}
+    engines: {node: '>=20'}
+
   '@asamuzakjp/css-color@3.2.0':
     resolution: {integrity: sha512-K1A6z8tS3XsmCMM86xoWdn7Fkdn9m6RSVtocUrJYIwZnFVkng/PvkEoWtOWmP+Scc6saYWHWZYbndEEXxl24jw==}
 
@@ -938,6 +956,13 @@ packages:
   '@bcoe/v8-coverage@0.2.3':
     resolution: {integrity: sha512-0hYQ8SB4Db5zvZB4axdMHGwEaQjkZzFjQiN9LVYvIFB2nSUHW9tYpxWriPrWDASIxiaXax83REcLxuSdnGPZtw==}
 
+  '@braidai/lang@1.1.2':
+    resolution: {integrity: sha512-qBcknbBufNHlui137Hft8xauQMTZDKdophmLFv05r2eNmdIv/MlPuP4TdUknHG68UdWLgVZwgxVe735HzJNIwA==}
+
+  '@colors/colors@1.5.0':
+    resolution: {integrity: sha512-ooWCrlZP11i8GImSjTHYHLkvFDP48nS4+204nGb1RiX/WXYHmJA2III9/e2DWVabCESdW7hBAEzHRqUn9OUVvQ==}
+    engines: {node: '>=0.1.90'}
+
   '@csstools/color-helpers@5.1.0':
     resolution: {integrity: sha512-S11EXWJyy0Mz5SYvRmY8nJYTFFd1LCNV+7cXyAgQtOOuzb4EsgfqDufL+9esx72/eLhsRdGZwaldu/h+E4t4BA==}
     engines: {node: '>=18'}
@@ -1157,6 +1182,9 @@ packages:
     peerDependencies:
       koa: ^2.0.0 || ^3.0.0
 
+  '@loaderkit/resolve@1.0.6':
+    resolution: {integrity: sha512-G8FdIoF5CypfwmD9rl8BXod5HDn8JqB0CCNBXDTaRZ+yRYhARrrSToX1zg1zy9jX3zLqigsELwhT4gNtkdQAUg==}
+
   '@napi-rs/wasm-runtime@1.1.6':
     resolution: {integrity: sha512-ZLv/JdUfkvOy9eCnnBaGfiO+XimbjebAeO+MRQqD/B+FR1tnRN0tpKSJHRbE8sFfS6aqsXZ67TQjfwfsxULVbg==}
     peerDependencies:
@@ -1193,6 +1221,10 @@ packages:
     resolution: {integrity: sha512-SEeaJLb3qBNF/OaXnaR1NmmBbFYk1zC0ZH/52fATcRPLFg/p791YrcyFFy44Bo9sLaGuSuLp5Q6axbb/O+v/RA==}
     engines: {node: ^14.18.0 || >=16.0.0}
 
+  '@publint/pack@0.1.6':
+    resolution: {integrity: sha512-3uVNyGcVplhPZSLVyeIpL7+cIRn1YCSNHLG/rUIlBQMVH8YuN9++YF+5+UDIIO9RW98dujiUoTltO7RDB5bFJA==}
+    engines: {node: '>=18'}
+
   '@rollup/plugin-babel@6.1.0':
     resolution: {integrity: sha512-dFZNuFD2YRcoomP4oYf+DvQNSUA9ih+A3vUqopQx5EdtPGo3WBnQcI/S8pwpz91UsGfL0HsMSOlaMld8HrbubA==}
     engines: {node: '>=14.0.0'}
@@ -1400,6 +1432,10 @@ packages:
     resolution: {integrity: sha512-9NET910DNaIPngYnLLPeg+Ogzqsi9uM4mSboU5y6p8S5DzMTVEsJZrawi+BoDNUVBa2DhJqQYUFvMDfgU062LQ==}
     engines: {node: '>=6'}
 
+  '@sindresorhus/is@4.6.0':
+    resolution: {integrity: sha512-t09vSN3MdfsyCHoFcTRCH/iUtG7OJ0CsjzB8cjAmKc/va/kIgeDI/TxsigdncE/4be734m0cvIYwNaV4i2XqAw==}
+    engines: {node: '>=10'}
+
   '@sinonjs/commons@3.0.1':
     resolution: {integrity: sha512-K3mCHKQ9sVh8o1C9cxkwxaOmXoAMlDxC1mYyHrjqOWEcBjYr76t96zL2zlj5dUGZ3HSw240X1qgH3Mjf1yJWpQ==}
 
@@ -1870,6 +1906,10 @@ packages:
     resolution: {integrity: sha512-gKXj5ALrKWQLsYG9jlTRmR/xKluxHV+Z9QEwNIgCfM1/uwPMCuzVVnh5mwTd+OuBZcwSIMbqssNWRm1lE51QaQ==}
     engines: {node: '>=8'}
 
+  ansi-escapes@7.3.0:
+    resolution: {integrity: sha512-BvU8nYgGQBxcmMuEeUEmNTvrMVjJNSH7RgW24vXexN4Ven6qCvy4TntnvlnwnMLTVlcRQQdbRY8NKnaIoeWDNg==}
+    engines: {node: '>=18'}
+
   ansi-regex@2.1.1:
     resolution: {integrity: sha512-TIGnTpdo+E3+pCyAluZvtED5p5wCqLdezCyhPZzKPcxvFplEt4i+W7OONCKgeZFT3+y5NZZfOOS/Bdcanm1MYA==}
     engines: {node: '>=0.10.0'}
@@ -1902,6 +1942,9 @@ packages:
     resolution: {integrity: sha512-4Dj6M28JB+oAH8kFkTLUo+a2jwOFkuqb3yucU0CANcRRUbxS0cP0nZYCGjcc3BNXwRIsUVmDGgzawme7zvJHvg==}
     engines: {node: '>=12'}
 
+  any-promise@1.3.0:
+    resolution: {integrity: sha512-7UvmKalWRt1wgjL1RrGxoSJW/0QZFIegpeGvZG9kjp8vrRu55XTHbwnqq2GpXm9uLbcuhxm3IqX9OB4MZR1b2A==}
+
   anymatch@3.1.3:
     resolution: {integrity: sha512-KMReFUr0B4t+D+OBkjR3KYqvocp2XaSzO55UcB6mgQMd3KbcE+mWTyvVV7D/zsdEbNnV6acZUutkiHQXvTr1Rw==}
     engines: {node: '>= 8'}
@@ -2131,6 +2174,10 @@ packages:
     resolution: {integrity: sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==}
     engines: {node: '>=10'}
 
+  chalk@5.6.2:
+    resolution: {integrity: sha512-7NzBL0r
```

**File**: `scripts/integration.js` (modified, +9/-2)
```diff
@@ -1,6 +1,13 @@
+const path = require('node:path');
 const shell = require('shelljs');
 const pkg = require('../package.json');
 
+// Resolved before the cd below, because these binaries live in the root
+// install while the checks themselves run inside integration/.
+const binDir = path.resolve(__dirname, '..', 'node_modules', '.bin');
+const publint = path.join(binDir, 'publint');
+const attw = path.join(binDir, 'attw');
+
 shell.rm('-rf', 'dist');
 const packResult = shell.exec('npm pack --silent', { silent: true });
 if (packResult.code !== 0) shell.exit(packResult.code);
@@ -31,10 +38,10 @@ shell.exec('pnpm test');
 shell.exec('pnpm run build');
 shell.exec('node node-smoke/esm-test.mjs');
 shell.exec('node node-smoke/cjs-test.cjs');
-shell.exec('pnpm dlx publint@latest', { cwd: 'node_modules/boardgame.io' });
+shell.exec(publint, { cwd: 'node_modules/boardgame.io' });
 
 shell.set('+e');
-shell.exec(`pnpm dlx @arethetypeswrong/cli@0.18.2 ./${packed} --format table`);
+shell.exec(`${attw} ./${packed} --format table`);
 shell.set('-e');
 
 shell.rm(packed);
```

---

### Incident Patch 5: `b196d617` (2026-07-26)
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

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>
Co-authored-by: Rupesh Pandey <[REDACTED_EMAIL]>

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

### Incident Patch 6: `b0ebe466` (2026-07-26)
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

### Incident Patch 7: `107604ec` (2026-07-26)
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

Co-authored-by: Rupesh Pandey <[REDACTED_EMAIL]>

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
+        const oldState = (state = { ...state, deltalog: [] });
 
         // Process game events only on the server.
         // These events like `endTurn` typically
@@ -335,13 +441,18 @@ export function CreateGameReducer({
 
         // Process event.
         let newState = game.flow.processEvent(state, action);
+        newState = addLogMetadata(newState, action, oldState, game);
 
         // Execute plugins.
         let stateWithError: TransientState | undefined;
-        [newState, stateWithError] = flushAndValidatePlugins(newState, state, {
-          game,
-          isClient: false,
-        });
+        [newState, stateWithError] = flushAndValidatePlugins(
+          newState,
+          oldState,
+          {
+            game,
+            isClient: false,
+          },
+        );
         if (stateWithError) return stateWithError;
 
         // Update undo / redo state.
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
+          entry.action.type === 'GAME_EVENT' &&
+          entry.action.payload.type === 'endGame',
+      );
+
+    expect(endGame).toBeDefined();
+    expect(endGame.metadata).toBeUndefined();
+  });
+
+  test('It does not log events when the log is disabled', () => {
+    const game: Game = {
+      disableLog: true,
+      onEnd: ({ log }) => {
+        log.setMetadata({ message: 'game ended' });
+      },
+    };
+    const client = Client({ game });
+
+    client.events.endGame('winner');
+
+    expect(client.getState().ctx.gameover).toBe('winner');
+    expect(client.getState().log).toEqual([]);
+  });
+
+  test('It does not log an event that the flow refused', () => {
+    const game: Game = {
+      moves: {
+        A: () => {},
+      },
+      turn: {
+        minMoves: 2,
+        maxMoves: 5,
+      },
+    };
+    const client = Client({ game });
+
+    client.events.endTurn();
+
+    expect(client.getState().ctx.turn).toBe(1);
+    expect(client.getState().log).toEqual([]);
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

### Incident Patch 8: `2dbc3b1c` (2026-07-26)
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

### Incident Patch 9: `7c89bd82` (2026-07-25)
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

### Incident Patch 10: `e789ea66` (2026-07-25)
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
+                  { id: 1, name: 'bob' },
+                ],
+              ],
+            });
+          });
         });
 
         describe('when the playerID does not exist', () => {
@@ -1172,11 +1223,13 @@ describe('.configureRouter', () => {
                   };
                 },
               });
-              const app = createApiServer({ db, auth, games });
+              const { transport, transportAPI } = createMatchTransport();
+              const app = createApiServer({ db, auth, games, transport });
               response = await apiCall(app)
                 .post('/games/foo/1/leave')
                 .send('playerID=0&credentials=SECRET1');
               expect(db.mocks.wipe).toHaveBeenCalledWith('1');
+              expect(transportAPI.sendAll).not.toHaveBeenCalled();
             });
           });
         });
@@ -1274,7 +1327,8 @@ describe('.configureRouter', () => {
           db = new AsyncStorage({
             fetch: async () => ({ metadata: createLeaveMet
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

### Incident Patch 11: `65ca73be` (2026-07-21)
**Commit Message**: fix(server): accept games with custom plugin APIs (#1269)

* fix(server): accept games with custom plugin APIs

* test(server): add strict custom plugin consumer guard

---------

Co-authored-by: Rupesh Pandey <[REDACTED_EMAIL]>

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

**File**: `src/server/index.ts` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ export const getPortFromServer = (
 };
 
 interface ServerOpts {
-  games: Game[];
+  games: Game<any, any, any>[];
   origins?: CorsOptions['origin'];
   apiOrigins?: CorsOptions['origin'];
   db?: StorageAPI.Async | StorageAPI.Sync;
```

**File**: `tsconfig.json` (modified, +2/-1)
```diff
@@ -9,5 +9,6 @@
     "esModuleInterop": true,
     "jsx": "react",
     "skipLibCheck": true
-  }
+  },
+  "exclude": ["dist", "integration/type-tests"]
 }
```

---

### Incident Patch 12: `3dc2af0b` (2026-07-20)
**Commit Message**: docs(tutorial): fix parcel package name (#1129)

Co-authored-by: Rupesh Pandey <[REDACTED_EMAIL]>

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

### Incident Patch 13: `55200a6a` (2026-07-20)
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

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01KNK7XYPXjxHpKJUCL52kVt

* chore(test): remove leftover jest.setTimeout in the lobby API tests

A 2,000,000,000 ms timeout parked in the suite is debuggin

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

---

### Incident Patch 14: `f3ff893a` (2026-07-18)
**Commit Message**: fix(server): PQueue constructor crash in the ESM server build (#1275)

p-queue@6 is CommonJS with `exports.default`; imported from the native ESM
server build (added in #1263) the default import binds to the exports
object, so every socket connection died with "PQueue is not a constructor"
in getMatchQueue. Unwrap the module so both the CJS and ESM builds get the
class.

**File**: `src/server/transport/socketio.ts` (modified, +11/-2)
```diff
@@ -12,7 +12,16 @@ import https from 'node:https';
 import { Server as IOServer } from 'socket.io';
 import type IOTypes from 'socket.io';
 import type { ServerOptions as HttpsOptions } from 'node:https';
-import PQueue from 'p-queue';
+import PQueueModule from 'p-queue';
+import type PQueue from 'p-queue';
+
+// p-queue@6 ships CommonJS with `exports.default`. When this file is
+// bundled to CJS the default import interops cleanly, but in the native
+// ESM server build it binds to the CJS exports object itself, making
+// `new PQueue()` throw "PQueue is not a constructor". Unwrap so both
+// builds get the class.
+const PQueueCtor = ((PQueueModule as unknown as { default?: typeof PQueue })
+  .default ?? PQueueModule) as typeof PQueue;
 import { Master } from '../../master/master';
 import type {
   TransportAPI as MasterTransport,
@@ -276,7 +285,7 @@ export class SocketIO {
   getMatchQueue(matchID: string): PQueue {
     if (!this.perMatchQueue.has(matchID)) {
       // PQueue should process only one action at a time.
-      this.perMatchQueue.set(matchID, new PQueue({ concurrency: 1 }));
+      this.perMatchQueue.set(matchID, new PQueueCtor({ concurrency: 1 }));
     }
     return this.perMatchQueue.get(matchID);
   }
```

---

### Incident Patch 15: `d99d5a4d` (2026-07-12)
**Commit Message**: feat(packaging): add exports map and ESM server build (#1263)

boardgame.io predates Node's exports-map resolution: subpath imports
work only through generated proxy directories, which bundlers and the
CJS resolver understand but the Node ESM resolver does not. Any
"type": "module" project — the default for Vite-era tooling — fails
on import { Server } from 'boardgame.io/server' (#902, #1136, #1152),
and the docs still recommended the long-dead esm require hook (#844).

Changes:
- exports map covering the root, all 11 subpackages, ./server and
  ./package.json, with types/import/require conditions per entry.
  Legacy main/module/types fields and proxy dirs are kept for older
  resolvers, so existing consumers are unaffected.
- the server entry is now also built as ESM (its dependencies all
  ship ESM entry points or import cleanly from ESM).
- packages/main.js joins the dual-format build so the root export
  has format-correct files; dist/esm and dist/cjs gain package.json
  format markers, without which Node would parse them by the root
  package's implicit CJS type.
- integration test now smoke-tests Node ESM import and CJS require
  of the packed tarball, and runs publint (stric

**File**: `docs/documentation/deployment.md` (modified, +2/-2)
```diff
@@ -83,10 +83,10 @@ production build in `/build`, which you can host just about anywhere.
 [Heroku](https://heroku.com) uses 2 different ways to determine the run command of a node application. It is possible to either:
 
 - Add a Procfile to the project root directory with the following line  
-  `web: node -r esm server.js`
+  `web: node server.js`
 
 - Update the start script in the package.json to  
-  `"start": "node -r esm server.js"`
+  `"start": "node server.js"`
 
 On Heroku, a regular heroku/nodejs buildpack is necessary to build your app which is usually selected by default for node applications.  
 
```

**File**: `docs/documentation/multiplayer.md` (modified, +2/-9)
```diff
@@ -232,20 +232,13 @@ server.run(8000);
 ?> See [the Server reference page](api/Server.md) for more detail on
    the various configuration options.
 
-Because `Game.js` is an ES module, we will use [esm](https://github.com/standard-things/esm)
-which enables us to use `import` statements in a Node environment:
-
-```
-npm install esm
-```
-
-We can then add a new script to our `package.json` to simplify
+Add a new script to our `package.json` to simplify
 running the server:
 
 ```json
 {
   "scripts": {
-    "serve": "node -r esm src/server.js"
+    "serve": "node src/server.js"
   }
 }
 ```
```

**File**: `integration/node-smoke/cjs-test.cjs` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+const assert = require('node:assert/strict');
+
+const { Client } = require('boardgame.io/client');
+const { INVALID_MOVE } = require('boardgame.io/core');
+const { Origins, Server } = require('boardgame.io/server');
+
+assert.equal(typeof Server, 'function');
+assert.equal(typeof Client, 'function');
+assert.ok(INVALID_MOVE);
+
+const server = Server({
+  games: [{ name: 'smoke', setup: () => ({}), moves: {} }],
+  origins: [Origins.LOCALHOST],
+});
+
+assert.ok(server.app);
+assert.ok(server.run);
+
+console.log('CJS smoke OK');
```

**File**: `integration/node-smoke/esm-test.mjs` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import assert from 'node:assert/strict';
+
+import { Client } from 'boardgame.io/client';
+import { INVALID_MOVE } from 'boardgame.io/core';
+import { Origins, Server } from 'boardgame.io/server';
+
+assert.equal(typeof Server, 'function');
+assert.equal(typeof Client, 'function');
+assert.ok(INVALID_MOVE);
+
+const server = Server({
+  games: [{ name: 'smoke', setup: () => ({}), moves: {} }],
+  origins: [Origins.LOCALHOST],
+});
+
+assert.ok(server.app);
+assert.ok(server.run);
+
+console.log('ESM smoke OK');
```

**File**: `package.json` (modified, +72/-1)
```diff
@@ -16,7 +16,10 @@
     }
   },
   "description": "library for turn-based games",
-  "repository": "https://github.com/boardgameio/boardgame.io",
+  "repository": {
+    "type": "git",
+    "url": "git+https://github.com/boardgameio/boardgame.io.git"
+  },
   "scripts": {
     "prestart": "run-p examples:install build",
     "start": "run-p dev:server dev:client",
@@ -54,6 +57,74 @@
   "unpkg": "dist/boardgameio.min.js",
   "module": "dist/boardgameio.es.js",
   "types": "dist/types/src/types.d.ts",
+  "exports": {
+    ".": {
+      "types": "./dist/types/src/types.d.ts",
+      "import": "./dist/esm/main.js",
+      "require": "./dist/cjs/main.js"
+    },
+    "./client": {
+      "types": "./dist/types/packages/client.d.ts",
+      "import": "./dist/esm/client.js",
+      "require": "./dist/cjs/client.js"
+    },
+    "./core": {
+      "types": "./dist/types/packages/core.d.ts",
+      "import": "./dist/esm/core.js",
+      "require": "./dist/cjs/core.js"
+    },
+    "./debug": {
+      "types": "./dist/types/packages/debug.d.ts",
+      "import": "./dist/esm/debug.js",
+      "require": "./dist/cjs/debug.js"
+    },
+    "./react": {
+      "types": "./dist/types/packages/react.d.ts",
+      "import": "./dist/esm/react.js",
+      "require": "./dist/cjs/react.js"
+    },
+    "./react-native": {
+      "types": "./dist/types/packages/react-native.d.ts",
+      "import": "./dist/esm/react-native.js",
+      "require": "./dist/cjs/react-native.js"
+    },
+    "./ai": {
+      "types": "./dist/types/packages/ai.d.ts",
+      "import": "./dist/esm/ai.js",
+      "require": "./dist/cjs/ai.js"
+    },
+    "./plugins": {
+      "types": "./dist/types/packages/plugins.d.ts",
+      "import": "./dist/esm/plugins.js",
+      "require": "./dist/cjs/plugins.js"
+    },
+    "./master": {
+      "types": "./dist/types/packages/master.d.ts",
+      "import": "./dist/esm/master.js",
+      "require": "./dist/cjs/master.js"
+    },
+    "./multiplayer": {
+      "types": "./dist/types/packages/multiplayer.d.ts",
+      "import": "./dist/esm/multiplayer.js",
+      "require": "./dist/cjs/multiplayer.js"
+    },
+    "./internal": {
+      "types": "./dist/types/packages/internal.d.ts",
+      "import": "./dist/esm/internal.js",
+      "require": "./dist/cjs/internal.js"
+    },
+    "./testing": {
+      "types": "./dist/types/packages/testing.d.ts",
+      "import": "./dist/esm/testing.js",
+      "require": "./dist/cjs/testing.js"
+    },
+    "./server": {
+      "types": "./dist/types/packages/server.d.ts",
+      "import": "./dist/esm/server.js",
+      "require": "./dist/cjs/server.js"
+    },
+    "./package.json": "./package.json"
+  },
   "files": [
     "src",
     "!src/**/*.test.ts",
```

**File**: `rollup.config.js` (modified, +11/-5)
```diff
@@ -71,10 +71,13 @@ const minifiedPlugins = [
 export default [
   // Subpackages.
   {
-    input: subpackages.reduce((obj, name) => {
-      obj[name] = `packages/${name}.ts`;
-      return obj;
-    }, {}),
+    input: subpackages.reduce(
+      (obj, name) => {
+        obj[name] = `packages/${name}.ts`;
+        return obj;
+      },
+      { main: 'packages/main.js' },
+    ),
     external,
     plugins,
     output: [
@@ -92,7 +95,10 @@ export default [
   // Server.
   {
     input: 'packages/server.ts',
-    output: { dir: 'dist/cjs', format: 'cjs', interop: 'auto' },
+    output: [
+      { dir: 'dist/cjs', format: 'cjs', interop: 'auto' },
+      { dir: 'dist/esm', format: 'esm' },
+    ],
     external,
     plugins: serverPlugins,
   },
```

**File**: `scripts/integration.js` (modified, +14/-2)
```diff
@@ -1,8 +1,12 @@
 const shell = require('shelljs');
+const pkg = require('../package.json');
 
 shell.rm('-rf', 'dist');
 const packResult = shell.exec('npm pack --silent', { silent: true });
-const packed = packResult.stdout.trim().split('\n').pop();
+if (packResult.code !== 0) shell.exit(packResult.code);
+const packed =
+  packResult.stdout.trim().split('\n').pop() ||
+  `${pkg.name}-${pkg.version}.tgz`;
 
 shell.mv(packed, 'integration');
 shell.cd('integration');
@@ -18,10 +22,18 @@ shell.exec('pnpm install --config.minimum-release-age=0');
 // rather than a registry package name (npm install <name>.tgz is forgiving;
 // pnpm add is not).
 shell.exec(`pnpm add --config.minimum-release-age=0 ./${packed}`);
-shell.rm(packed);
 
 shell.set('-e');
 
 // Test
 shell.exec('pnpm test');
 shell.exec('pnpm run build');
+shell.exec('node node-smoke/esm-test.mjs');
+shell.exec('node node-smoke/cjs-test.cjs');
+shell.exec('pnpm dlx publint@latest', { cwd: 'node_modules/boardgame.io' });
+
+shell.set('+e');
+shell.exec(`pnpm dlx @arethetypeswrong/cli@0.18.2 ./${packed} --format table`);
+shell.set('-e');
+
+shell.rm(packed);
```

**File**: `scripts/proxy-dirs.js` (modified, +9/-0)
```diff
@@ -35,3 +35,12 @@ subpackages.forEach((name) => {
 });
 
 makeSubpackage('server', { mainDir: 'cjs' });
+
+writeFileSync(
+  path.resolve(__dirname, '../dist/esm/package.json'),
+  JSON.stringify({ type: 'module', sideEffects: false }, null, 2) + '\n',
+);
+writeFileSync(
+  path.resolve(__dirname, '../dist/cjs/package.json'),
+  JSON.stringify({ type: 'commonjs', sideEffects: false }, null, 2) + '\n',
+);
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
