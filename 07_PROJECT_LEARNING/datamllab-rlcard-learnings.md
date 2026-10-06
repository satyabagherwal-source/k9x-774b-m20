# Forensic Learning Record (Deep Inspection): datamllab/rlcard

> **Canonical Artifact**: `07_PROJECT_LEARNING/datamllab-rlcard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/datamllab/rlcard](https://github.com/datamllab/rlcard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:04:38.351Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `datamllab/rlcard`
- **Description**: Reinforcement Learning / AI Bots in Card (Poker) Games - Blackjack, Leduc, Texas, DouDizhu, Mahjong, UNO.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3571 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `rlcard/agents/dmc_agent/pettingzoo_utils.py`
```
import traceback

import numpy as np
import torch

from .utils import log
from rlcard.utils import run_game_pettingzoo

def create_buffers_pettingzoo(
    T,
    num_buffers,
    env,
    device_iterator,
):
    buffers = {}
    for device in device_iterator:
        buffers[device] = []
        for agent_name in env.agents:
            state_shape = env.observation_space(agent_name)["observation"].shape
            specs = dict(
                done=dict(size=(T,), dtype=torch.bool),
                episode_return=dict(size=(T,), dtype=torch.float32),
                target=dict(size=(T,), dtype=torch.float32),
                state=dict(size=(T,)+tuple(state_shape), dtype=torch.int8),
                action=dict(size=(T,)+(env.action_space(agent_name).n,), dtype=torch.int8),
            )
            _buffers = {key: [] for key in specs}
            for _ in range(num_buffers):
                for key in _buffers:
                    if device == "cpu":
                        _buffer = torch.empty(**specs[key]).to('cpu').share_memory_()
                    else:
                        _buffer = torch.empty(**specs[key]).to('cuda:'+str(device)).share_memory_()
                    _buffers[key].append(_buffer)
            buffers[device].append(_buffers)
    return buffers

def _get_action_feature(action, action_space):
    out = np.zeros(action_space)
    out[action] = 1
    return out

def act_pettingzoo(
    i,
    device,
    T,
    free_queue,
    full_queue,
    model,
    buffers,
    env
):
    log.info('Device %s Actor %i started.', str(device), i)
    try:
        done_buf = [[] for _ in range(env.num_agents)]
        episode_return_buf = [[] for _ in range(env.num_agents)]
        target_buf = [[] for _ in range(env.num_agents)]
        state_buf = [[] for _ in range(env.num_agents)]
        action_buf = [[] for _ in range(env.num_agents)]
        size = [0 for _ in range(env.num_agents)]

        while True:
            trajectories = run_game_pettingzoo(env, model.agents, is_training=True)
            for agent_id, agent_name in enumerate(env.possible_agents):
                traj_size = len(trajectories[agent_name]) // 2
                if traj_size > 0:
                    size[agent_id] += traj_size
                    target_return = trajectories[agent_name][-2][1]
                    target_buf[agent_id].extend([target_return for _ in range(traj_size)])
                    for i in range(0, len(trajectories[agent_name]), 2):
                        state = trajectories[agent_name][i][0]['observation']
                        action = _get_action_feature(
                            trajectories[agent_name][i+1], model.agents[agent_name].action_shape
                        )
                        episode_return = trajectories[agent_name][i][1]
                        done = trajectories[agent_name][i][2]
                        state_buf[agent_id].append(torch.from_numpy(state))
                        action_buf[agent_id].append(torch.from_numpy(action))
                        episode_return_buf[agent_id].append(episode_return)
                        done_buf[agent_id].append(done)

                while size[agent_id] > T:
                    index = free_queue[agent_id].get()
                    if index is None:
                        print("index is None")
                        break
                    for t in range(T):
                        temp_done = done_buf[agent_id][t]
                        buffers[agent_id]['done'][index][t, ...] = temp_done
                        buffers[agent_id]['episode_return'][index][t, ...] = episode_return_buf[agent_id][t]
                        buffers[agent_id]['target'][index][t, ...] = target_buf[agent_id][t]
                        buffers[agent_id]['state'][index][t, ...] = state_buf[agent_id][t]
                        buffers[agent_id]['action'][index][t, ...] = action_buf[agent_id][t]
                    full_queue[agent_id].put(index)
                    done_buf[agent_id] = done_buf[agent_id][T:]
                    episode_return_buf[agent_id] = episode_return_buf[agent_id][T:]
                    target_buf[agent_id] = target_buf[agent_id][T:]
                    state_buf[agent_id] = state_buf[agent_id][T:]
                    action_buf[agent_id] = action_buf[agent_id][T:]
                    size[agent_id] -= T

    except KeyboardInterrupt:
        pass
    except Exception as e:
        log.error('Exception in worker process %i', i)
        traceback.print_exc()
        raise e

```

### Core Architecture Module: `rlcard/agents/dmc_agent/utils.py`
```
# Copyright 2021 RLCard Team of Texas A&M University
# Copyright 2021 DouZero Team of Kwai
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#    http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import logging
import traceback

import numpy as np
import torch

shandle = logging.StreamHandler()
shandle.setFormatter(
    logging.Formatter(
        '[%(levelname)s:%(process)d %(module)s:%(lineno)d %(asctime)s] '
        '%(message)s'))
log = logging.getLogger('doudzero')
log.propagate = False
log.addHandler(shandle)
log.setLevel(logging.INFO)

def get_batch(
    free_queue,
    full_queue,
    buffers,
    batch_size,
    lock
):
    with lock:
        indices = [full_queue.get() for _ in range(batch_size)]
    batch = {
        key: torch.stack([buffers[key][m] for m in indices], dim=1)
        for key in buffers
    }
    for m in indices:
        free_queue.put(m)
    return batch

def create_buffers(
    T,
    num_buffers,
    state_shape,
    action_shape,
    device_iterator,
):
    buffers = {}
    for device in device_iterator:
        buffers[device] = []
        for player_id in range(len(state_shape)):
            specs = dict(
                done=dict(size=(T,), dtype=torch.bool),
                episode_return=dict(size=(T,), dtype=torch.float32),
                target=dict(size=(T,), dtype=torch.float32),
                state=dict(size=(T,)+tuple(state_shape[player_id]), dtype=torch.int8),
                action=dict(size=(T,)+tuple(action_shape[player_id]), dtype=torch.int8),
            )
            _buffers = {key: [] for key in specs}
            for _ in range(num_buffers):
                for key in _buffers:
                    if device == "cpu":
                        _buffer = torch.empty(**specs[key]).to('cpu').share_memory_()
                    else:
                        _buffer = torch.empty(**specs[key]).to('cuda:'+str(device)).share_memory_()
                    _buffers[key].append(_buffer)
            buffers[device].append(_buffers)
    return buffers

def create_optimizers(
    num_players,
    learning_rate,
    momentum,
    epsilon,
    alpha,
    learner_model
):
    optimizers = []
    for player_id in range(num_players):
        optimizer = torch.optim.RMSprop(
            learner_model.parameters(player_id),
            lr=learning_rate,
            momentum=momentum,
            eps=epsilon,
            alpha=alpha)
        optimizers.append(optimizer)
    return optimizers

def act(
    i,
    device,
    T,
    free_queue,
    full_queue,
    model,
    buffers,
    env
):
    try:
        log.info('Device %s Actor %i started.', str(device), i)

        # Configure environment
        env.seed(i)
        env.set_agents(model.get_agents())

        done_buf = [[] for _ in range(env.num_players)]
        episode_return_buf = [[] for _ in range(env.num_players)]
        target_buf = [[] for _ in range(env.num_players)]
        state_buf = [[] for _ in range(env.num_players)]
        action_buf = [[] for _ in range(env.num_players)]
        size = [0 for _ in range(env.num_players)]

        while True:
            trajectories, payoffs = env.run(is_training=True)
            for p in range(env.num_players):
                size[p] += len(trajectories[p][:-1]) // 2
                diff = size[p] - len(target_buf[p])
                if diff > 0:
                    done_buf[p].extend([False for _ in range(diff-1)])
                    done_buf[p].append(True)
                    episode_return_buf[p].extend([0.0 for _ in range(diff-1)])
                    episode_return_buf[p].append(float(payoffs[p]))
                    target_buf[p].extend([float(payoffs[p]) for _ in range(diff)])
                    # State and action
                    for i in range(0, len(trajectories[p])-2, 2):
                        state = trajectories[p][i]['obs']
                        action = env.get_action_feature(trajectories[p][i+1])
                        state_buf[p].append(torch.from_numpy(state))
                        action_buf[p].append(torch.from_numpy(action))
                
                while size[p] > T:
                    index = free_queue[p].get()
                    if index is None:
                        break
                    for t in range(T):
                        buffers[p]['done'][index][t, ...] = done_buf[p][t]
                        buffers[p]['episode_return'][index][t, ...] = episode_return_buf[p][t]
                        buffers[p]['target'][index][t, ...] = target_buf[p][t]
                        buffers[p]['state'][index][t, ...] = state_buf[p][t]
                        buffers[p]['action'][index][t, ...] = action_buf[p][t]
                    full_queue[p].put(index)
                    done_buf[p] = done_buf[p][T:]
                    episode_return_buf[p] = episode_return_buf[p][T:]
                    target_buf[p] = target_buf[p][T:]
                    state_buf[p] = state_buf[p][T:]
                    action_buf[p] = action_buf[p][T:]
                    size[p] -= T

    except KeyboardInterrupt:
        pass
    except Exception as e:
        log.error('Exception in worker process %i', i)
        traceback.print_exc()
        print()
        raise e

```

### Core Architecture Module: `rlcard/agents/human_agents/gin_rummy_human_agent/gui_gin_rummy/utils.py`
```
'''
    Project: Gui Gin Rummy
    File name: utils.py
    Author: William Hale
    Date created: 3/14/2020
'''

# from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .game_canvas import GameCanvas

from typing import List

import tkinter as tk

import rlcard.games.gin_rummy.utils.utils as gin_rummy_utils

from rlcard.games.gin_rummy.utils.gin_rummy_error import GinRummyProgramError

from .canvas_item import CardItem, CanvasItem
from .player_type import PlayerType

from .configurations import SCORE_PLAYER_0_ACTION_ID, SCORE_PLAYER_1_ACTION_ID
from .configurations import DRAW_CARD_ACTION_ID, PICK_UP_DISCARD_ACTION_ID
from .configurations import DECLARE_DEAD_HAND_ACTION_ID
from .configurations import DISCARD_ACTION_ID, KNOCK_ACTION_ID

from . import configurations


def is_debug() -> bool:
    result = __debug__ and configurations.IS_DEBUG
    return result


def gin_rummy_sort_order_id(card_id: int) -> int:
    return 4 * (card_id % 13) + (3 - card_id // 13)  # would have been better if card_id was specified in order wanted


def move_to(item_id: int, x: int, y: int, parent: tk.Canvas):
    parent.coords(item_id, x, y)


def translated_by(dx: float, dy: float, location):
    if not len(location) == 2:
        raise GinRummyProgramError("location={} must have length of 2.".format(location))
    return [location[0] + dx, location[1] + dy]


def player_name(player_id: int) -> str:
    return "North" if player_id == 0 else "South" if player_id == 1 else "X"


def player_short_name(player_id: int) -> str:
    return "N" if player_id == 0 else "S" if player_id == 1 else "X"


def get_action_type(action: int) -> int:
    if action == DRAW_CARD_ACTION_ID:
        result = action
    elif action == PICK_UP_DISCARD_ACTION_ID:
        result = action
    elif action == DECLARE_DEAD_HAND_ACTION_ID:
        result = action
    elif DISCARD_ACTION_ID <= action < DISCARD_ACTION_ID + 52:
        result = DISCARD_ACTION_ID
    elif KNOCK_ACTION_ID <= action < KNOCK_ACTION_ID + 52:
        result = KNOCK_ACTION_ID
    elif action == SCORE_PLAYER_0_ACTION_ID:
        result = action
    elif action == SCORE_PLAYER_1_ACTION_ID:
        result = action
    else:
        raise GinRummyProgramError("No action type for {}.".format(action))
    return result


def get_action_card_id(action: int) -> int or None:
    result = None
    action_type = get_action_type(action)
    if action_type == DISCARD_ACTION_ID:
        result = action - DISCARD_ACTION_ID
    elif action_type == KNOCK_ACTION_ID:
        result = action - KNOCK_ACTION_ID
    return result


#   =========================================
#   Transformations (i.e. complex setter)
#   =========================================

def set_card_id_face_up(card_id: int, face_up: bool, game_canvas: 'GameCanvas'):
    card = gin_rummy_utils.card_from_card_id(card_id=card_id)
    card_image = game_canvas.card_images[card.rank, card.suit]
    if card_image.face_up != face_up:
        card_item_id = game_canvas.card_item_ids[card_id]
        target_image = card_image if face_up else game_canvas.card_back_image
        game_canvas.itemconfig(card_item_id, image=target_image)
        card_image.face_up = face_up


def flip_card_id(card_id: int, game_canvas: 'GameCanvas'):
    card = gin_rummy_utils.card_from_card_id(card_id=card_id)
    card_image = game_canvas.card_images[card.rank, card.suit]
    card_item_id = game_canvas.card_item_ids[card_id]
    card_image.face_up = not card_image.face_up
    target_image = card_image if card_image.face_up else game_canvas.card_back_image
    game_canvas.itemconfig(card_item_id, image=target_image)


def jog_card_id(card_id: int, dx: float, dy: float, game_canvas: 'GameCanvas'):
    # jog card if held by human player (allows computer to not reveal location of selected cards in hand)
    # TODO: configuration option to highlight card rather than jogging it
    card_item_id = game_canvas.card_item_ids[card_id]
    card_item_id_tags = game_canvas.getter.get_tags(item_id=card_item_id)
    player_id = 0 if configurations.NORTH_HELD_PILE_TAG in card_item_id_tags else 1
    if game_canvas.player_types[player_id] is PlayerType.human_player:
        game_canvas.move(card_item_id, dx, dy)


def drop_item_ids(item_ids: List[int], on_item_id: int, player_id: int, game_canvas: 'GameCanvas'):
    # on_item_id must be in held_pile_item_ids of player_id
    # item_ids are inserted into held_pile of player_id after on_item_id
    held_pile_item_ids = game_canvas.getter.get_held_pile_item_ids(player_id)
    held_pile_ghost_card_item = game_canvas.held_pile_ghost_card_items[player_id]
    if not (on_item_id == held_pile_ghost_card_item or on_item_id in held_pile_item_ids):
        raise GinRummyProgramError("on_item_id={} is invalid drop location.".format(on_item_id))
    held_pile_item_ids_count = len(held_pile_item_ids)
    held_pile_tag = game_canvas.held_pile_tags[player_id]
    on_item_index = -1 if on_item_id == held_pile_ghost_card_item else held_pile_item_ids.index(on_item_id)
    after_item_ids = []
    for i in range(on_item_index + 1, held_pile_item_ids_count):
        after_item_id = held_pile_item_ids[i]
        if after_item_id not in item_ids:
            after_item_ids.append(after_item_id)
    drop_canvas_items = [game_canvas.canvas_item_by_item_id[item_id] for item_id in item_ids]
    drop_card_items = [x for x in drop_canvas_items if isinstance(x, CardItem)]
    sorted_drop_card_items = sorted(drop_card_items, reverse=True,
                                    key=lambda card_item: gin_rummy_sort_order_id(card_item.card_id))
    sorted_item_ids = [x.item_id for x in sorted_drop_card_items]
    for item_id in sorted_item_ids:
        item_tags = game_canvas.getter.get_tags(item_id)
        if configurations.SELECTED_TAG in item_tags:
            game_canvas.dtag(item_id, configurations.SELECTED_TAG)
            game_canvas.dtag(item_id, configurations.JOGGED_TAG)
        if configurations.DRAWN_TAG in item_tags:
            game_canvas.dtag(item_id, configurations.DRAWN_TAG)
            if configurations.DISCARD_PILE_TAG in item_tags:
                game_canvas.dtag(item_id, configurations.DISCARD_PILE_TAG)
            elif configurations.STOCK_PILE_TAG in item_tags:
                game_canvas.dtag(item_id, configurations.STOCK_PILE_TAG)
            if held_pile_tag in item_tags:
                raise GinRummyProgramError("item_tags should not contain held_pile_tag.")
            game_canvas.addtag_withtag(held_pile_tag, item_id)
        game_canvas.tag_raise(item_id)
    for after_item_id in after_item_ids:
        game_canvas.tag_raise(after_item_id)
    fan_held_pile(player_id, game_canvas=game_canvas)


def fan_held_pile(player_id: int, game_canvas: 'GameCanvas'):
    held_pile_tab = game_canvas.held_pile_tab
    held_pile_anchor = game_canvas.player_held_pile_anchors[player_id]
    held_pile_item_ids = game_canvas.getter.get_held_pile_item_ids(player_id=player_id)
    # right justify hand when melding
    dx = 0
    count = len(held_pile_item_ids)
    if count < 10:
        dx = (10 - count) * game_canvas.held_pile_tab
    x = held_pile_anchor[0] + dx
    y = held_pile_anchor[1]
    for held_pile_item_id in held_pile_item_ids:
        move_to(held_pile_item_id, x, y, parent=game_canvas)
        game_canvas.tag_raise(held_pile_item_id)
        x += held_pile_tab


def held_pile_insert(card_item_id: int, above_hit_item_id: int or None, player_id: int, game_canvas: 'GameCanvas'):
    held_pile_item_ids = game_canvas.getter.get_held_pile_item_ids(player_id=player_id)
    held_pile_item_ids_count = len(held_pile_item_ids)
    if above_hit_item_id is None or above_hit_item_id == game_canvas.held_pile_ghost_card_items[player_id]:
        insertion_index = 0
    else:
        insertion_index = held_pile_item_ids.index(above_hit_item_id) + 1
    held_pile_tab = game_canvas.held_pile_tab
    if not card_item_id == held_pile_item_ids[-1]:  # Note: card_item_id is last and already positioned and raised
        raise GinRummyProgramError("card_item_id={} must be last card of hand.".format(card_item_id))
    for i in range(insertion_index, held_pile_item_ids_count - 1):
        held_pile_item_id = held_pile_item_ids[i]
        game_canvas.move(held_pile_item_id, held_pile_tab, 0)
        game_canvas.tag_raise(held_pile_item_id)


def set_card_item_id_face_up(card_item_id: int, face_up: bool, game_canvas: 'GameCanvas'):
    card_id = game_canvas.card_item_ids.index(card_item_id)
    set_card_id_face_up(card_id=card_id, face_up=face_up, game_canvas=game_canvas)


def toggle_discard_pile_item_selected(game_canvas: 'GameCanvas'):
    current_player_id = game_canvas.current_player_id
    top_discard_pile_item_id = game_canvas.getter.get_top_discard_pile_item_id()
    item_tags = game_canvas.getter.get_tags(top_discard_pile_item_id)
    is_drawn = configurations.DRAWN_TAG in item_tags
    card_id = game_canvas.card_item_ids.index(top_discard_pile_item_id)
    dx = -20 * game_canvas.scale_factor
    dy = 20 * game_canvas.scale_factor
    if current_player_id == 0:
        dy = -dy
    if is_drawn:
        dx = -dx
        dy = -dy
    jog_card_id(card_id=card_id, dx=dx, dy=dy, game_canvas=game_canvas)
    if is_drawn:
        game_canvas.dtag(top_discard_pile_item_id, configurations.DRAWN_TAG)
    else:
        game_canvas.addtag_withtag(configurations.DRAWN_TAG, top_discard_pile_item_id)


def toggle_held_pile_item_selected(item: CanvasItem, game_canvas: 'GameCanvas'):
    if isinstance(item, CardItem):  # don't mess with ghost card
        item_tags = item.get_tags()
        is_selected = configurations.SELECTED_TAG in item_tags
        card_id = item.card_id
        dx = 20 * game_canvas.scale_factor
        dy = -20 * game_canvas.scale_factor
        if is_selected:
            dx = -dx
            dy = -dy
        jog_card_id(card_id=card_id, dx=dx, dy=dy, game_canvas=game_canvas)
        if is_selected:
            
```

### Core Architecture Module: `rlcard/agents/human_agents/gin_rummy_human_agent/gui_gin_rummy/utils_extra.py`
```
'''
    Project: Gui Gin Rummy
    File name: utils_extra.py
    Author: William Hale
    Date created: 3/14/2020
'''

from PIL import Image, ImageDraw, ImageFilter


def rounded_rectangle(self: ImageDraw, xy, corner_radius, fill=None, outline=None):  # FIXME: not used
    upper_left_point = xy[0]
    bottom_right_point = xy[1]
    self.rectangle(
        [
            (upper_left_point[0], upper_left_point[1] + corner_radius),
            (bottom_right_point[0], bottom_right_point[1] - corner_radius)
        ],
        fill=fill,
        outline=outline
    )
    self.rectangle(
        [
            (upper_left_point[0] + corner_radius, upper_left_point[1]),
            (bottom_right_point[0] - corner_radius, bottom_right_point[1])
        ],
        fill=fill,
        outline=outline
    )
    self.pieslice(
        [upper_left_point, (upper_left_point[0] + corner_radius * 2, upper_left_point[1] + corner_radius * 2)],
        180,
        270,
        fill=fill,
        outline=outline
        )
    self.pieslice(
        [(bottom_right_point[0] - corner_radius * 2, bottom_right_point[1] - corner_radius * 2), bottom_right_point],
        0,
        90,
        fill=fill,
        outline=outline
        )
    self.pieslice([(upper_left_point[0], bottom_right_point[1] - corner_radius * 2),
                   (upper_left_point[0] + corner_radius * 2, bottom_right_point[1])],
                  90,
                  180,
                  fill=fill,
                  outline=outline
                  )
    self.pieslice([(bottom_right_point[0] - corner_radius * 2, upper_left_point[1]),
                   (bottom_right_point[0], upper_left_point[1] + corner_radius * 2)],
                  270,
                  360,
                  fill=fill,
                  outline=outline
                  )


ImageDraw.rounded_rectangle = rounded_rectangle  # FIXME: not used


def mask_rounded_rectangle_transparent(pil_img, corner_radius=8):  # FIXME: not used
    blur_radius = 0  # FIXME: what is this for ??? wch
    mask = Image.new("L", pil_img.size, 0)
    draw = ImageDraw.Draw(mask)
    rounded_rectangle(draw, xy=((0, 0), (pil_img.size[0], pil_img.size[1])), corner_radius=corner_radius, fill=255)

    mask = mask.filter(ImageFilter.GaussianBlur(blur_radius))
    result = pil_img.copy()
    result.putalpha(mask)
    return result

```

### Core Architecture Module: `rlcard/games/bridge/utils/action_event.py`
```
'''
    File name: bridge/utils/action_event.py
    Author: William Hale
    Date created: 11/25/2021
'''

from .bridge_card import BridgeCard

# ====================================
# Action_ids:
#       0 -> no_bid_action_id
#       1 to 35 -> bid_action_id (bid amount by suit or NT)
#       36 -> pass_action_id
#       37 -> dbl_action_id
#       38 -> rdbl_action_id
#       39 to 90 -> play_card_action_id
# ====================================


class ActionEvent(object):  # Interface

    no_bid_action_id = 0
    first_bid_action_id = 1
    pass_action_id = 36
    dbl_action_id = 37
    rdbl_action_id = 38
    first_play_card_action_id = 39

    def __init__(self, action_id: int):
        self.action_id = action_id

    def __eq__(self, other):
        result = False
        if isinstance(other, ActionEvent):
            result = self.action_id == other.action_id
        return result

    @staticmethod
    def from_action_id(action_id: int):
        if action_id == ActionEvent.pass_action_id:
            return PassAction()
        elif ActionEvent.first_bid_action_id <= action_id <= 35:
            bid_amount = 1 + (action_id - ActionEvent.first_bid_action_id) // 5
            bid_suit_id = (action_id - ActionEvent.first_bid_action_id) % 5
            bid_suit = BridgeCard.suits[bid_suit_id] if bid_suit_id < 4 else None
            return BidAction(bid_amount, bid_suit)
        elif action_id == ActionEvent.dbl_action_id:
            return DblAction()
        elif action_id == ActionEvent.rdbl_action_id:
            return RdblAction()
        elif ActionEvent.first_play_card_action_id <= action_id < ActionEvent.first_play_card_action_id + 52:
            card_id = action_id - ActionEvent.first_play_card_action_id
            card = BridgeCard.card(card_id=card_id)
            return PlayCardAction(card=card)
        else:
            raise Exception(f'ActionEvent from_action_id: invalid action_id={action_id}')

    @staticmethod
    def get_num_actions():
        ''' Return the number of possible actions in the game
        '''
        return 1 + 35 + 3 + 52  # no_bid, 35 bids, pass, dbl, rdl, 52 play_card


class CallActionEvent(ActionEvent):  # Interface
    pass


class PassAction(CallActionEvent):

    def __init__(self):
        super().__init__(action_id=ActionEvent.pass_action_id)

    def __str__(self):
        return "pass"

    def __repr__(self):
        return "pass"


class BidAction(CallActionEvent):

    def __init__(self, bid_amount: int, bid_suit: str or None):
        suits = BridgeCard.suits
        if bid_suit and bid_suit not in suits:
            raise Exception(f'BidAction has invalid suit: {bid_suit}')
        if bid_suit in suits:
            bid_suit_id = suits.index(bid_suit)
        else:
            bid_suit_id = 4
        bid_action_id = bid_suit_id + 5 * (bid_amount - 1) + ActionEvent.first_bid_action_id
        super().__init__(action_id=bid_action_id)
        self.bid_amount = bid_amount
        self.bid_suit = bid_suit

    def __str__(self):
        bid_suit = self.bid_suit
        if not bid_suit:
            bid_suit = 'NT'
        return f'{self.bid_amount}{bid_suit}'

    def __repr__(self):
        return self.__str__()


class DblAction(CallActionEvent):

    def __init__(self):
        super().__init__(action_id=ActionEvent.dbl_action_id)

    def __str__(self):
        return "dbl"

    def __repr__(self):
        return "dbl"


class RdblAction(CallActionEvent):

    def __init__(self):
        super().__init__(action_id=ActionEvent.rdbl_action_id)

    def __str__(self):
        return "rdbl"

    def __repr__(self):
        return "rdbl"


class PlayCardAction(ActionEvent):

    def __init__(self, card: BridgeCard):
        play_card_action_id = ActionEvent.first_play_card_action_id + card.card_id
        super().__init__(action_id=play_card_action_id)
        self.card: BridgeCard = card

    def __str__(self):
        return f"{self.card}"

    def __repr__(self):
        return f"{self.card}"

```

### Core Architecture Module: `rlcard/games/bridge/utils/bridge_card.py`
```
'''
    File name: bridge/utils/bridge_card.py
    Author: William Hale
    Date created: 11/25/2021
'''

from rlcard.games.base import Card


class BridgeCard(Card):

    suits = ['C', 'D', 'H', 'S']
    ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']

    @staticmethod
    def card(card_id: int):
        return _deck[card_id]

    @staticmethod
    def get_deck() -> [Card]:
        return _deck.copy()

    def __init__(self, suit: str, rank: str):
        super().__init__(suit=suit, rank=rank)
        suit_index = BridgeCard.suits.index(self.suit)
        rank_index = BridgeCard.ranks.index(self.rank)
        self.card_id = 13 * suit_index + rank_index

    def __str__(self):
        return f'{self.rank}{self.suit}'

    def __repr__(self):
        return f'{self.rank}{self.suit}'


# deck is always in order from 2C, ... KC, AC, 2D, ... KD, AD, 2H, ... KH, AH, 2S, ... KS, AS
_deck = [BridgeCard(suit=suit, rank=rank) for suit in BridgeCard.suits for rank in BridgeCard.ranks]  # want this to be read-only

```

### Core Architecture Module: `rlcard/games/bridge/utils/move.py`
```
'''
    File name: bridge/utils/move.py
    Author: William Hale
    Date created: 11/25/2021
'''

#
#   These classes are used to keep a move_sheet history of the moves in a round.
#

from .action_event import ActionEvent, BidAction, PassAction, DblAction, RdblAction, PlayCardAction
from .bridge_card import BridgeCard

from ..player import BridgePlayer


class BridgeMove(object):  # Interface
    pass


class PlayerMove(BridgeMove):  # Interface

    def __init__(self, player: BridgePlayer, action: ActionEvent):
        super().__init__()
        self.player = player
        self.action = action


class CallMove(PlayerMove):  # Interface

    def __init__(self, player: BridgePlayer, action: ActionEvent):
        super().__init__(player=player, action=action)


class DealHandMove(BridgeMove):

    def __init__(self, dealer: BridgePlayer, shuffled_deck: [BridgeCard]):
        super().__init__()
        self.dealer = dealer
        self.shuffled_deck = shuffled_deck

    def __str__(self):
        shuffled_deck_text = " ".join([str(card) for card in self.shuffled_deck])
        return f'{self.dealer} deal shuffled_deck=[{shuffled_deck_text}]'


class MakePassMove(CallMove):

    def __init__(self, player: BridgePlayer):
        super().__init__(player=player, action=PassAction())

    def __str__(self):
        return f'{self.player} {self.action}'


class MakeDblMove(CallMove):

    def __init__(self, player: BridgePlayer):
        super().__init__(player=player, action=DblAction())

    def __str__(self):
        return f'{self.player} {self.action}'


class MakeRdblMove(CallMove):

    def __init__(self, player: BridgePlayer):
        super().__init__(player=player, action=RdblAction())

    def __str__(self):
        return f'{self.player} {self.action}'


class MakeBidMove(CallMove):

    def __init__(self, player: BridgePlayer, bid_action: BidAction):
        super().__init__(player=player, action=bid_action)
        self.action = bid_action  # Note: keep type as BidAction rather than ActionEvent

    def __str__(self):
        return f'{self.player} bids {self.action}'


class PlayCardMove(PlayerMove):

    def __init__(self, player: BridgePlayer, action: PlayCardAction):
        super().__init__(player=player, action=action)
        self.action = action  # Note: keep type as PlayCardAction rather than ActionEvent

    @property
    def card(self):
        return self.action.card

    def __str__(self):
        return f'{self.player} plays {self.action}'

```

### Core Architecture Module: `rlcard/games/bridge/utils/tray.py`
```
'''
    File name: bridge/utils/tray.py
    Author: William Hale
    Date created: 11/28/2021
'''


class Tray(object):

    def __init__(self, board_id: int):
        if board_id <= 0:
            raise Exception(f'Tray: invalid board_id={board_id}')
        self.board_id = board_id

    @property
    def dealer_id(self):
        return (self.board_id - 1) % 4

    @property
    def vul(self):
        vul_none = [0, 0, 0, 0]
        vul_n_s = [1, 0, 1, 0]
        vul_e_w = [0, 1, 0, 1]
        vul_all = [1, 1, 1, 1]
        basic_vuls = [vul_none, vul_n_s, vul_e_w, vul_all]
        offset = (self.board_id - 1) // 4
        return basic_vuls[(self.board_id - 1 + offset) % 4]

    def __str__(self):
        return f'{self.board_id}: dealer_id={self.dealer_id} vul={self.vul}'

```

### Core Architecture Module: `rlcard/games/bridge/utils/utils.py`
```
'''
    File name: bridge/utils/utils.py
    Author: William Hale
    Date created: 11/26/2021
'''

from typing import List

import numpy as np

from .bridge_card import BridgeCard


def encode_cards(cards: List[BridgeCard]) -> np.ndarray:  # Note: not used ??
    plane = np.zeros(52, dtype=int)
    for card in cards:
        plane[card.card_id] = 1
    return plane

```

### Core Architecture Module: `rlcard/games/doudizhu/utils.py`
```
''' Doudizhu utils
'''
import os
import json
from collections import OrderedDict
import threading
import collections

import rlcard

# Read required docs
ROOT_PATH = rlcard.__path__[0]

if not os.path.isfile(os.path.join(ROOT_PATH, 'games/doudizhu/jsondata/action_space.txt')) \
        or not os.path.isfile(os.path.join(ROOT_PATH, 'games/doudizhu/jsondata/card_type.json')) \
        or not os.path.isfile(os.path.join(ROOT_PATH, 'games/doudizhu/jsondata/type_card.json')):
    import zipfile
    with zipfile.ZipFile(os.path.join(ROOT_PATH, 'games/doudizhu/jsondata.zip'),"r") as zip_ref:
        zip_ref.extractall(os.path.join(ROOT_PATH, 'games/doudizhu/'))

# Action space
action_space_path = os.path.join(ROOT_PATH, 'games/doudizhu/jsondata/action_space.txt')
with open(action_space_path, 'r') as f:
    ID_2_ACTION = f.readline().strip().split()
    ACTION_2_ID = {}
    for i, action in enumerate(ID_2_ACTION):
        ACTION_2_ID[action] = i

# a map of card to its type. Also return both dict and list to accelerate
card_type_path = os.path.join(ROOT_PATH, 'games/doudizhu/jsondata/card_type.json')
with open(card_type_path, 'r') as f:
    data = json.load(f, object_pairs_hook=OrderedDict)
    CARD_TYPE = (data, list(data), set(data))

# a map of type to its cards
type_card_path = os.path.join(ROOT_PATH, 'games/doudizhu/jsondata/type_card.json')
with open(type_card_path, 'r') as f:
    TYPE_CARD = json.load(f, object_pairs_hook=OrderedDict)

# rank list of solo character of cards
CARD_RANK_STR = ['3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K',
                 'A', '2', 'B', 'R']
CARD_RANK_STR_INDEX = {'3': 0, '4': 1, '5': 2, '6': 3, '7': 4,
            '8': 5, '9': 6, 'T': 7, 'J': 8, 'Q': 9,
            'K': 10, 'A': 11, '2': 12, 'B': 13, 'R': 14}
# rank list
CARD_RANK = ['3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K',
             'A', '2', 'BJ', 'RJ']

INDEX = {'3': 0, '4': 1, '5': 2, '6': 3, '7': 4,
         '8': 5, '9': 6, 'T': 7, 'J': 8, 'Q': 9,
         'K': 10, 'A': 11, '2': 12, 'B': 13, 'R': 14}
INDEX = OrderedDict(sorted(INDEX.items(), key=lambda t: t[1]))


def doudizhu_sort_str(card_1, card_2):
    ''' Compare the rank of two cards of str representation

    Args:
        card_1 (str): str representation of solo card
        card_2 (str): str representation of solo card

    Returns:
        int: 1(card_1 > card_2) / 0(card_1 = card2) / -1(card_1 < card_2)
    '''
    key_1 = CARD_RANK_STR.index(card_1)
    key_2 = CARD_RANK_STR.index(card_2)
    if key_1 > key_2:
        return 1
    if key_1 < key_2:
        return -1
    return 0


def doudizhu_sort_card(card_1, card_2):
    ''' Compare the rank of two cards of Card object

    Args:
        card_1 (object): object of Card
        card_2 (object): object of card
    '''
    key = []
    for card in [card_1, card_2]:
        if card.rank == '':
            key.append(CARD_RANK.index(card.suit))
        else:
            key.append(CARD_RANK.index(card.rank))
    if key[0] > key[1]:
        return 1
    if key[0] < key[1]:
        return -1
    return 0


def get_landlord_score(current_hand):
    ''' Roughly judge the quality of the hand, and provide a score as basis to
    bid landlord.

    Args:
        current_hand (str): string of cards. Eg: '56888TTQKKKAA222R'

    Returns:
        int: score
    '''
    score_map = {'A': 1, '2': 2, 'B': 3, 'R': 4}
    score = 0
    # rocket
    if current_hand[-2:] == 'BR':
        score += 8
        current_hand = current_hand[:-2]
    length = len(current_hand)
    i = 0
    while i < length:
        # bomb
        if i <= (length - 4) and current_hand[i] == current_hand[i+3]:
            score += 6
            i += 4
            continue
        # 2, Black Joker, Red Joker
        if current_hand[i] in score_map:
            score += score_map[current_hand[i]]
        i += 1
    return score

def cards2str_with_suit(cards):
    ''' Get the corresponding string representation of cards with suit

    Args:
        cards (list): list of Card objects

    Returns:
        string: string representation of cards
    '''
    return ' '.join([card.suit+card.rank for card in cards])

def cards2str(cards):
    ''' Get the corresponding string representation of cards

    Args:
        cards (list): list of Card objects

    Returns:
        string: string representation of cards
    '''
    response = ''
    for card in cards:
        if card.rank == '':
            response += card.suit[0]
        else:
            response += card.rank
    return response

class LocalObjs(threading.local):
    def __init__(self):
        self.cached_candidate_cards = None
_local_objs = LocalObjs()

def contains_cards(candidate, target):
    ''' Check if cards of candidate contains cards of target.

    Args:
        candidate (string): A string representing the cards of candidate
        target (string): A string representing the number of cards of target

    Returns:
        boolean
    '''
    # In normal cases, most continuous calls of this function
    #   will test different targets against the same candidate.
    # So the cached counts of each card in candidate can speed up
    #   the comparison for following tests if candidate keeps the same.
    if not _local_objs.cached_candidate_cards or _local_objs.cached_candidate_cards != candidate:
        _local_objs.cached_candidate_cards = candidate
        cards_dict = collections.defaultdict(int)
        for card in candidate:
            cards_dict[card] += 1
        _local_objs.cached_candidate_cards_dict = cards_dict
    cards_dict = _local_objs.cached_candidate_cards_dict
    if (target == ''):
        return True
    curr_card = target[0]
    curr_count = 1
    for card in target[1:]:
        if (card != curr_card):
            if (cards_dict[curr_card] < curr_count):
                return False
            curr_card = card
            curr_count = 1
        else:
            curr_count += 1
    if (cards_dict[curr_card] < curr_count):
        return False
    return True

def encode_cards(plane, cards):
    ''' Encode cards and represerve it into plane.

    Args:
        cards (list or str): list or str of cards, every entry is a
    character of solo representation of card
    '''
    if not cards:
        return None
    layer = 1
    if len(cards) == 1:
        rank = CARD_RANK_STR.index(cards[0])
        plane[layer][rank] = 1
        plane[0][rank] = 0
    else:
        for index, card in enumerate(cards):
            if index == 0:
                continue
            if card == cards[index-1]:
                layer += 1
            else:
                rank = CARD_RANK_STR.index(cards[index-1])
                plane[layer][rank] = 1
                layer = 1
                plane[0][rank] = 0
        rank = CARD_RANK_STR.index(cards[-1])
        plane[layer][rank] = 1
        plane[0][rank] = 0


def get_gt_cards(player, greater_player):
    ''' Provide player's cards which are greater than the ones played by
    previous player in one round

    Args:
        player (DoudizhuPlayer object): the player waiting to play cards
        greater_player (DoudizhuPlayer object): the player who played current biggest cards.

    Returns:
        list: list of string of greater cards

    Note:
        1. return value contains 'pass'
    '''
    # add 'pass' to legal actions
    gt_cards = ['pass']
    current_hand = cards2str(player.current_hand)
    target_cards = greater_player.played_cards
    target_types = CARD_TYPE[0][target_cards]
    type_dict = {}
    for card_type, weight in target_types:
        if card_type not in type_dict:
            type_dict[card_type] = weight
    if 'rocket' in type_dict:
        return gt_cards
    type_dict['rocket'] = -1
    if 'bomb' not in type_dict:
        type_dict['bomb'] = -1
    for card_type, weight in type_dict.items():
        candidate = TYPE_CARD[card_type]
        for can_weight, cards_list in candidate.items():
            if int(can_weight) > int(weight):
                for cards in cards_list:
                    # TODO: improve efficiency
                    if cards not in gt_cards and contains_cards(current_hand, cards):
                        # if self.contains_cards(current_hand, cards):
                        gt_cards.append(cards)
    return gt_cards

```

### Core Architecture Module: `rlcard/games/gin_rummy/utils/__init__.py`
```


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #209** (2021-03-04): **Using/playing against trained DQN model**
  *Symptoms*: I used uno_dqn.py to generate a Q model for Uno. I have looked through the documentation and can't seem to figure out how to utilize the model I created. In my case, I am planning on using the DQN with the uno_human.py, and allow a human to play against a Q network instead of the rule model. At first I tried to add the model to the pretrained folder, and add it to pretrained_models.py as recommended by #112 , but this hasn't been working with a DQN model.
  **Post-Mortem & Fix Analysis**:
  > @Rice-Field-Memes Could you share the specific errors you met?
  > This is the error when I try to run the uno_human when loading the pretrained model `WARNING:tensorflow:From D:\Documents\rlcard_venv\rlcard\models\uno_dqn.py:44: The name tf.train.Saver is deprecated. Please use tf.compat.v1.train.Saver instead.  2021-02-24 08:44:42.249290: W tensorflow/core/framework/op_kernel.cc:1651] OP_REQUIRES failed at save_restore_v2_ops.cc:184 : Not found: Key beta1_power_2 not found in checkpoint Traceback (most recent call last):   File "D:\Documents\rlcard_venv\env\lib\site-packages\tensorflow_core\python\client\session.py", line 1365, in _do_call     return fn(*args)   File "D:\Documents\rlcard_venv\env\lib\site-packages\tensorflow_core\python\client\session.py", line 1350, in _run_fn     target_list, run_metadata)   File "D:\Documents\rlcard_venv\env\lib\site-packages\tensorflow_core\python\client\session.py", line 1443, in _call_tf_sessionrun     run_metadata) tensorflow.python.framework.errors_impl.NotFoundError: Key beta1_power_2 not found i
  > @Rice-Field-Memes Hi, it is still difficult for me to reproduce this error since we do not have a uno DQN model. Could you fork RLCard in your GitHub and upload your code so that I can take a look? Thanks!

- **Issue #140** (2020-05-28): **Multiple agents for Non-limit Holdem (more than 2)**
  *Symptoms*: Hi, I am interested in your project especially Non-limit Holdem. It has been years since I learned ML in college, so I am kind of an infant in this new field.  I have read your code and the NFSP example on nonlimit holdem. From your game interface,  it is possible to add more than 2 players. But how am I going to evaluate it?
  **Post-Mortem & Fix Analysis**:
  > @brucefeynman Hi, thanks for your interest. We currently do not support explicit interfaces for changing the number of players. But you can achieve this by simply changing a configuration of the game in https://github.com/datamllab/rlcard/blob/master/rlcard/games/nolimitholdem/game.py#L37  To evaluate the performance, you may use the function defines in  https://github.com/datamllab/rlcard/blob/master/rlcard/utils/utils.py#L374
  > Thanks for the quick reply.  I have observed the player number as described there https://github.com/datamllab/rlcard/blob/master/rlcard/games/nolimitholdem/game.py#L37 and change it to 6 https://github.com/datamllab/rlcard/blob/0139d0e403b6d844a8f9107237887d73c7e8d752/rlcard/games/nolimitholdem/game.py#L26 When evaluating, I add 5 random players to run with one of the agents. `eval_env.set_agents([agents[0], random_agent,random_agent,random_agent,random_agent,random_agent])`  But when I try your example code https://github.com/datamllab/rlcard/blob/master/examples/nolimit_holdem_nfsp.py An error occurred in https://github.com/datamllab/rlcard/blob/0139d0e403b6d844a8f9107237887d73c7e8d752/rlcard/games/limitholdem/judger.py#L38 as the sum of winners is 0.  So I use debugger to trace the stack and find out that in some situations, compare_hands will produce wrong result. https://github.com/datamllab/rlcard/blob/0139d0e403b6d844a8f9107237887d73c7e8d752/rlcard/games/limitholdem/
  > @brucefeynman Thanks for reporting. It looks like a bug. We have not well tested the situations when player_num>2. We will fix this issue and let you know

- **Issue #27** (2019-12-04): **key error: 34445555**
  *Symptoms*: It seems that '33334444' is legal for four_two_pair type, and '3333444555' is legal for trio_pair_chain_2 type, but '34445555' is illegal for trio_solo_chain_2 type. is it a bug？ 
  **Post-Mortem & Fix Analysis**:
  > Hi, @yueyilia Thank you for the report. We will double-check this issue soon.
  > Hi, @yueyilia  The point of solo cards in this type needs to be different from trio cards. You can see the official rules in the link. http://www.imsa.cn/archives/40177
  > ![1](https://user-images.githubusercontent.com/39787440/68739989-1723cc00-0625-11ea-814f-09058aa56167.png) According to the rule, "33334444": [["four_two_pair", 1] and "555666777888": [["trio_solo_chain_3", 3], ["trio_solo_chain_3", 4]] are illegal.

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

### Incident Patch 1: `a093f512` (2023-06-22)
**Commit Message**: Fix bug of use_raw

**File**: `rlcard/agents/dqn_agent.py` (modified, +1/-0)
```diff
@@ -87,6 +87,7 @@ def __init__(self,
             save_path (str): The path to save the model checkpoints
             save_every (int): Save the model every X training steps
         '''
+        self.use_raw = False
         self.replay_memory_init_size = replay_memory_init_size
         self.update_target_estimator_every = update_target_estimator_every
         self.discount_factor = discount_factor
```

---

### Incident Patch 2: `fdd08653` (2023-06-22)
**Commit Message**: Merge pull request #294 from kingyiusuen/fix-doudizhu-last-action

Fix the calculations of last action in Doudizhu's environment

**File**: `rlcard/envs/doudizhu.py` (modified, +2/-0)
```diff
@@ -60,6 +60,7 @@ def _extract_state(self, state):
             for i, action in reversed(state['trace']):
                 if i == 0:
                     last_landlord_action = action
+                    break
             last_landlord_action = _cards2array(last_landlord_action)
             landlord_num_cards_left = _get_one_hot_array(state['num_cards_left'][0], 20)
 
@@ -69,6 +70,7 @@ def _extract_state(self, state):
             for i, action in reversed(state['trace']):
                 if i == teammate_id:
                     last_teammate_action = action
+                    break
             last_teammate_action = _cards2array(last_teammate_action)
             teammate_num_cards_left = _get_one_hot_array(state['num_cards_left'][teammate_id], 17)
             obs = np.concatenate((current_hand,
```

---

### Incident Patch 3: `e3dd938e` (2023-06-13)
**Commit Message**: Fix last action calculations

**File**: `rlcard/envs/doudizhu.py` (modified, +2/-0)
```diff
@@ -60,6 +60,7 @@ def _extract_state(self, state):
             for i, action in reversed(state['trace']):
                 if i == 0:
                     last_landlord_action = action
+                    break
             last_landlord_action = _cards2array(last_landlord_action)
             landlord_num_cards_left = _get_one_hot_array(state['num_cards_left'][0], 20)
 
@@ -69,6 +70,7 @@ def _extract_state(self, state):
             for i, action in reversed(state['trace']):
                 if i == teammate_id:
                     last_teammate_action = action
+                    break
             last_teammate_action = _cards2array(last_teammate_action)
             teammate_num_cards_left = _get_one_hot_array(state['num_cards_left'][teammate_id], 17)
             obs = np.concatenate((current_hand,
```

---

### Incident Patch 4: `f294b82b` (2023-05-18)
**Commit Message**: Fix missing fields for checkpoint.

**File**: `rlcard/agents/dqn_agent.py` (modified, +17/-10)
```diff
@@ -87,7 +87,6 @@ def __init__(self,
             save_path (str): The path to save the model checkpoints
             save_every (int): Save the model every X training steps
         '''
-        self.use_raw = False
         self.replay_memory_init_size = replay_memory_init_size
         self.update_target_estimator_every = update_target_estimator_every
         self.discount_factor = discount_factor
@@ -268,17 +267,20 @@ def checkpoint_attributes(self):
             'memory': self.memory.checkpoint_attributes(),
             'total_t': self.total_t,
             'train_t': self.train_t,
+            'replay_memory_init_size': self.replay_memory_init_size,
+            'update_target_estimator_every': self.update_target_estimator_every,
+            'discount_factor': self.discount_factor,
             'epsilon_start': self.epsilons.min(),
             'epsilon_end': self.epsilons.max(),
             'epsilon_decay_steps': self.epsilon_decay_steps,
-            'discount_factor': self.discount_factor,
-            'update_target_estimator_every': self.update_target_estimator_every,
             'batch_size': self.batch_size,
             'num_actions': self.num_actions,
             'train_every': self.train_every,
-            'device': self.device
+            'device': self.device,
+            'save_path': self.save_path,
+            'save_every': self.save_every
         }
-        
+
     @classmethod
     def from_checkpoint(cls, checkpoint):
         '''
@@ -291,17 +293,21 @@ def from_checkpoint(cls, checkpoint):
         print("\nINFO - Restoring model from checkpoint...")
         agent_instance = cls(
             replay_memory_size=checkpoint['memory']['memory_size'],
+            replay_memory_init_size=checkpoint['replay_memory_init_size'],
             update_target_estimator_every=checkpoint['update_target_estimator_every'],
             discount_factor=checkpoint['discount_factor'],
             epsilon_start=checkpoint['epsilon_start'],
             epsilon_end=checkpoint['epsilon_end'],
             epsilon_decay_steps=checkpoint['epsilon_decay_steps'],
             batch_size=checkpoint['batch_size'],
             num_actions=checkpoint['num_actions'], 
-            device=checkpoint['device'], 
             state_shape=checkpoint['q_estimator']['state_shape'],
+            train_every=checkpoint['train_every'],
             mlp_layers=checkpoint['q_estimator']['mlp_layers'],
-            train_every=checkpoint['train_every']
+            learning_rate=checkpoint['q_estimator']['learning_rate'],
+            device=checkpoint['device'],
+            save_path=checkpoint['save_path'],
+            save_every=checkpoint['save_every'],
         )
         
         agent_instance.total_t = checkpoint['total_t']
@@ -310,18 +316,19 @@ def from_checkpoint(cls, checkpoint):
         agent_instance.q_estimator = Estimator.from_checkpoint(checkpoint['q_estimator'])
         agent_instance.target_estimator = deepcopy(agent_instance.q_estimator)
         agent_instance.memory = Memory.from_checkpoint(checkpoint['memory'])
-        
-        
+
         return agent_instance
                      
     def save_checkpoint(self, path, filename='checkpoint_dqn.pt'):
         ''' Save the model checkpoint (all attributes)
 
         Args:
             path (str): the path to save the model
+            filename(str): the file name of checkpoint
         '''
         torch.save(self.checkpoint_attributes(), os.path.join(path, filename))
-        
+
+
 class Estimator(object):
     '''
     Approximate clone of rlcard.agents.dqn_agent.Estimator that
```

---

### Incident Patch 5: `c5f1b7c9` (2023-05-18)
**Commit Message**: fix: split pot error when multi side pot

Signed-off-by: Saerdna <[REDACTED_EMAIL]>

**File**: `rlcard/games/limitholdem/judger.py` (modified, +17/-8)
```diff
@@ -21,15 +21,24 @@ def judge_game(self, players, hands):
         """
         # Convert the hands into card indexes
         hands = [[card.get_index() for card in hand] if hand is not None else None for hand in hands]
-
-        winners = compare_hands(hands)
-
+        
         in_chips = [p.in_chips for p in players]
-        each_win = self.split_pots_among_players(in_chips, winners)
-
-        payoffs = []
-        for i, _ in enumerate(players):
-            payoffs.append(each_win[i] - in_chips[i])
+        remaining = sum(in_chips)
+        payoffs = [0] * len(hands)
+        while remaining > 0:
+            winners = compare_hands(hands)
+            each_win = self.split_pots_among_players(in_chips, winners)
+            
+            for i in range(len(players)):
+                if winners[i]:
+                    remaining -= each_win[i]
+                    payoffs[i] += each_win[i] - in_chips[i]
+                    hands[i] = None
+                    in_chips[i] = 0
+                elif in_chips[i] > 0:
+                    payoffs[i] += each_win[i] - in_chips[i]
+                    in_chips[i] = each_win[i]
+                    
         assert sum(payoffs) == 0
         return payoffs
 
```

**File**: `tests/games/test_nolimitholdem_judger.py` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import unittest
+import numpy as np
+from rlcard.games.nolimitholdem.player import NolimitholdemPlayer as Player
+from rlcard.games.base import Card
+from rlcard.games.limitholdem.judger import LimitHoldemJudger as Judger
+from rlcard.games.limitholdem.utils import Hand 
+
+
+rand_state = np.random.RandomState()
+
+class TestNolimitholdemGame(unittest.TestCase):
+
+    def get_players(self, num_players=2):
+        players = []
+        
+        for i in range(num_players):
+            players.append(Player(i, 100 + 100*i, rand_state))
+            players[i].bet(players[i].remained_chips) # All in
+            
+        return players
+    
+    def get_hands(self, player_hands, public_card):
+        hands = []
+        for hand in player_hands:
+            hands.append(hand + public_card)
+        return hands        
+    
+    def test_judge_with_4_players(self):
+
+        '''
+        suit_list = ['S', 'H', 'D', 'C']
+        rank_list = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
+        '''
+        players = self.get_players(4)
+        
+        
+        public_card = [Card('S', 'A'), Card('S', 'K'), Card('S', 'Q'), Card('S', '2'), Card('S', '3')]
+        hands = [[Card('S', 'J'), Card('S', 'T')],
+                 [Card('S', '4'), Card('S', '5')], 
+                 [Card('S', '9'), Card('C', 'T')], 
+                 [Card('H', 'T'), Card('C', 'J')]]
+        
+        payoffs = Judger(rand_state).judge_game(players, self.get_hands(hands, public_card))
+        self.assertEqual(payoffs, [300, 100, -100, -300])
+        
+        public_card = [Card('H', 'A'), Card('H', 'K'), Card('S', 'Q'), Card('S', 'T'), Card('S', '9')]
+        
+        hands = [[Card('S', 'A'), Card('H', '4')], 
+                 [Card('D', 'A'), Card('H', '5')], 
+                 [Card('D', 'K'), Card('H', '6')], 
+                 [Card('S', 'K'), Card('H', '7')]]
+        
+        payoffs = Judger(rand_state).judge_game(players, self.get_hands(hands, public_card))
+        self.assertEqual(payoffs, [100, 300, -200, -200])
+        
+    def test_judge_with_6_players(self):
+        rand_state = np.random.RandomState()
+        
+        public_card = [Card('S', 'A'), Card('S', 'K'), Card('D', 'Q'), Card('D', 'T'), Card('C', '9')]
+        players = self.get_players(6)
+        
+        hands = [[Card('C', 'A'), Card('H', '2')], 
+                 [Card('D', 'A'), Card('H', '3')], 
+                 [Card('C', 'K'), Card('C', '2')], 
+                 [Card('D', 'K'), Card('C', '3')],
+                 [Card('C', 'Q'), Card('S', '2')], 
+                 [Card('D', 'Q'), Card('S', '3')]]
+
+        payoffs = Judger(rand_state).judge_game(players, self.get_hands(hands, public_card))
+        self.assertEqual(payoffs, [200, 600, -100, 100, -400, -400])
+
+
+if __name__ == '__main__':
+    unittest.main()
```

---

### Incident Patch 6: `e1834a9c` (2023-05-13)
**Commit Message**: fix: path error when saving checkpoint

**File**: `rlcard/agents/nfsp_agent.py` (modified, +2/-1)
```diff
@@ -19,6 +19,7 @@
 See the paper https://arxiv.org/abs/1603.01121 for more details.
 '''
 
+import os
 import random
 import collections
 import enum
@@ -370,7 +371,7 @@ def save_checkpoint(self, path, filename='checkpoint_nfsp.pt'):
         Args:
             path (str): the path to save the model
         '''
-        torch.save(self.checkpoint_attributes(), path + '/' + filename)
+        torch.save(self.checkpoint_attributes(), os.path.join(path, filename))
         
 
 class AveragePolicyNetwork(nn.Module):
```

---

### Incident Patch 7: `362fd125` (2023-05-13)
**Commit Message**: fix: path error when saving checkpoint

**File**: `rlcard/agents/dqn_agent.py` (modified, +2/-1)
```diff
@@ -25,6 +25,7 @@
 SOFTWARE.
 '''
 
+import os
 import random
 import numpy as np
 import torch
@@ -319,7 +320,7 @@ def save_checkpoint(self, path, filename='checkpoint_dqn.pt'):
         Args:
             path (str): the path to save the model
         '''
-        torch.save(self.checkpoint_attributes(), path + '/' + filename)
+        torch.save(self.checkpoint_attributes(), os.path.join(path, filename))
         
 class Estimator(object):
     '''
```

---

### Incident Patch 8: `5e6d7154` (2023-04-16)
**Commit Message**: Don't save models by default (fix)

**File**: `rlcard/agents/dqn_agent.py` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ def __init__(self,
                  learning_rate=0.00005,
                  device=None,
                  save_path=None,
-                 save_every=-1):
+                 save_every=float('inf'),):
 
         '''
         Q-Learning algorithm for off-policy TD control using Function Approximation.
```

**File**: `rlcard/agents/nfsp_agent.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ def __init__(self,
                  evaluate_with='average_policy',
                  device=None,
                  save_path=None,
-                 save_every=-1):
+                 save_every=float('inf')):
         ''' Initialize the NFSP agent.
 
         Args:
```

---

### Incident Patch 9: `352bcf5e` (2023-04-13)
**Commit Message**: Merge pull request #278 from kaiks/fix-wild-card-color-assignment

Uno game: fix wild card color assignment; fix typos

**File**: `rlcard/agents/human_agents/blackjack_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['raw_legal_actions'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/leduc_holdem_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/limit_holdem_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/nolimit_holdem_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/uno_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/games/uno/round.py` (modified, +3/-2)
```diff
@@ -52,7 +52,7 @@ def perform_top_card(self, players, top_card):
             self.dealer.deal_cards(player, 2)
 
     def proceed_round(self, players, action):
-        ''' Call other Classes's functions to keep one round running
+        ''' Call other Classes' functions to keep one round running
 
         Args:
             player (object): object of UnoPlayer
@@ -65,11 +65,12 @@ def proceed_round(self, players, action):
         card_info = action.split('-')
         color = card_info[0]
         trait = card_info[1]
-        # remove correspongding card
+        # remove corresponding card
         remove_index = None
         if trait == 'wild' or trait == 'wild_draw_4':
             for index, card in enumerate(player.hand):
                 if trait == card.trait:
+                    card.color = color # update the color of wild card to match the action
                     remove_index = index
                     break
         else:
```

---

### Incident Patch 10: `05f75503` (2023-04-09)
**Commit Message**: Fixed bug for get_last_action

**File**: `rlcard/games/gin_rummy/game.py` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ def get_current_player(self) -> GinRummyPlayer or None:
         return self.round.get_current_player()
 
     def get_last_action(self) -> ActionEvent or None:
-        return None if len(self.actions) == 0 else self.actions[-1]
+        return self.actions[-1] if self.actions and len(self.actions) > 0 else None
 
     def get_state(self, player_id: int):
         ''' Get player's state
```

---

### Incident Patch 11: `499a708c` (2023-03-29)
**Commit Message**: Uno game: fix wild card color assignment; fix typos

**File**: `rlcard/agents/human_agents/blackjack_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['raw_legal_actions'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/leduc_holdem_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/limit_holdem_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/nolimit_holdem_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/agents/human_agents/uno_human_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def step(state):
         _print_state(state['raw_obs'], state['action_record'])
         action = int(input('>> You choose action (integer): '))
         while action < 0 or action >= len(state['legal_actions']):
-            print('Action illegel...')
+            print('Action illegal...')
             action = int(input('>> Re-choose action (integer): '))
         return state['raw_legal_actions'][action]
 
```

**File**: `rlcard/games/uno/round.py` (modified, +3/-2)
```diff
@@ -52,7 +52,7 @@ def perform_top_card(self, players, top_card):
             self.dealer.deal_cards(player, 2)
 
     def proceed_round(self, players, action):
-        ''' Call other Classes's functions to keep one round running
+        ''' Call other Classes' functions to keep one round running
 
         Args:
             player (object): object of UnoPlayer
@@ -65,11 +65,12 @@ def proceed_round(self, players, action):
         card_info = action.split('-')
         color = card_info[0]
         trait = card_info[1]
-        # remove correspongding card
+        # remove corresponding card
         remove_index = None
         if trait == 'wild' or trait == 'wild_draw_4':
             for index, card in enumerate(player.hand):
                 if trait == card.trait:
+                    card.color = color # update the color of wild card to match the action
                     remove_index = index
                     break
         else:
```

---

### Incident Patch 12: `79df2a98` (2023-01-13)
**Commit Message**: Fix numpy array bug with python 3.9

**File**: `rlcard/agents/dqn_agent.py` (modified, +5/-4)
```diff
@@ -34,7 +34,7 @@
 
 from rlcard.utils.utils import remove_illegal
 
-Transition = namedtuple('Transition', ['state', 'action', 'reward', 'next_state', 'legal_actions', 'done'])
+Transition = namedtuple('Transition', ['state', 'action', 'reward', 'next_state', 'done', 'legal_actions'])
 
 
 class DQNAgent(object):
@@ -191,7 +191,7 @@ def train(self):
         Returns:
             loss (float): The loss of the current batch.
         '''
-        state_batch, action_batch, reward_batch, next_state_batch, legal_actions_batch, done_batch = self.memory.sample()
+        state_batch, action_batch, reward_batch, next_state_batch, done_batch, legal_actions_batch = self.memory.sample()
 
         # Calculate best next actions using Q-network (Double DQN)
         q_values_next = self.q_estimator.predict_nograd(next_state_batch)
@@ -399,7 +399,7 @@ def save(self, state, action, reward, next_state, legal_actions, done):
         '''
         if len(self.memory) == self.memory_size:
             self.memory.pop(0)
-        transition = Transition(state, action, reward, next_state, legal_actions, done)
+        transition = Transition(state, action, reward, next_state, done, legal_actions)
         self.memory.append(transition)
 
     def sample(self):
@@ -413,4 +413,5 @@ def sample(self):
             done_batch (list): a batch of dones
         '''
         samples = random.sample(self.memory, self.batch_size)
-        return map(np.array, zip(*samples))
+        samples = tuple(zip(*samples))
+        return tuple(map(np.array, samples[:-1])) + (samples[-1],)
```

**File**: `tests/utils/test_utils.py` (modified, +3/-1)
```diff
@@ -33,7 +33,9 @@ def test_print_cards(self):
 
     def test_reorganize(self):
         trajectories = reorganize([[[1,2],1,[4,5]]], [1])
-        self.assertEqual(np.array(trajectories).shape, (1, 1, 5))
+        self.assertEqual(len(trajectories), 1)
+        self.assertEqual(len(trajectories[0]), 1)
+        self.assertEqual(len(trajectories[0][0]), 5)
 
     def test_tournament(self):
         env = rlcard.make('leduc-holdem')
```

---

### Incident Patch 13: `4112672d` (2022-09-13)
**Commit Message**: fix leduc holdem pre-trained

**File**: `rlcard/models/leducholdem_rule_models.py` (modified, +5/-0)
```diff
@@ -87,6 +87,11 @@ def step(state):
             else:
                 return action
 
+    def eval_step(self, state):
+        ''' Step for evaluation. The same to step
+        '''
+        return self.step(state), []
+
 class LeducHoldemRuleModelV1(Model):
     ''' Leduc holdem Rule Model version 1
     '''
```

---

### Incident Patch 14: `b63b5cde` (2022-05-26)
**Commit Message**: train the cfr agent in the fixed LeducHoldem env



---

### Incident Patch 15: `52b893c4` (2022-05-25)
**Commit Message**: fix the bug of the Leduc Holdem Env's state representation of opp's chips

**File**: `rlcard/envs/leducholdem.py` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ def _extract_state(self, state):
         if public_card:
             obs[self.card2index[public_card]+3] = 1
         obs[state['my_chips']+6] = 1
-        obs[state['all_chips'][1]+20] = 1
+        obs[sum(state['all_chips'])-state['my_chips']+21] = 1
         extracted_state['obs'] = obs
 
         extracted_state['raw_obs'] = state
```

#### Recent Merged Pull Requests:
- **PR #340** (closed): docs: add community health files (CODE_OF_CONDUCT.md, CHANGELOG.md) (@Mukller)
- **PR #337** (closed): 添加够级环境 (@lamb-cn)
- **PR #333** (closed): fix(mahjong): allow chow without pong/gong and relax hu pair (@Shuo-O)
- **PR #327** (closed): Fixednolimitholdem (@qialex)
- **PR #326** (closed): Fixednolimitholdem (@qialex)
- **PR #311** (closed): Made a few changes (@austinperryfrancis)
- **PR #296** (2023-07-11): add GPU support on Mac (@ilisin)
- **PR #294** (2023-06-22): Fix the calculations of last action in Doudizhu's environment (@kingyiusuen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
