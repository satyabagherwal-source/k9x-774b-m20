# Forensic Learning Record (Deep Inspection): geek-ai/MAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/geek-ai-magent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/geek-ai/MAgent](https://github.com/geek-ai/MAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:25:04.589Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `geek-ai/MAgent`
- **Description**: A Platform for Many-Agent Reinforcement Learning
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1761 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/api_demo.py`
```
"""
First demo, show the usage of API
"""

import magent
# try:
#     from magent.builtin.mx_model import DeepQNetwork
# except ImportError as e:
from magent.builtin.tf_model import DeepQNetwork

if __name__ == "__main__":
    map_size = 100

    # init the game "pursuit"  (config file are stored in python/magent/builtin/config/)
    env = magent.GridWorld("pursuit", map_size=map_size)
    env.set_render_dir("build/render")

    # get group handles
    predator, prey = env.get_handles()

    # init env and agents
    env.reset()
    env.add_walls(method="random", n=map_size * map_size * 0.01)
    env.add_agents(predator, method="random", n=map_size * map_size * 0.02)
    env.add_agents(prey,     method="random", n=map_size * map_size * 0.02)

    # init two models
    model1 = DeepQNetwork(env, predator, "predator")
    model2 = DeepQNetwork(env, prey,     "prey")

    # load trained model
    model1.load("data/pursuit_model")
    model2.load("data/pursuit_model")

    done = False
    step_ct = 0
    print("nums: %d vs %d" % (env.get_num(predator), env.get_num(prey)))
    while not done:
        # take actions for deers
        obs_1 = env.get_observation(predator)
        ids_1 = env.get_agent_id(predator)
        acts_1 = model1.infer_action(obs_1, ids_1)
        env.set_action(predator, acts_1)

        # take actions for tigers
        obs_2  = env.get_observation(prey)
        ids_2  = env.get_agent_id(prey)
        acts_2 = model2.infer_action(obs_2, ids_1)
        env.set_action(prey, acts_2)

        # simulate one step
        done = env.step()

        # render
        env.render()

        # get reward
        reward = [sum(env.get_reward(predator)), sum(env.get_reward(prey))]

        # clear dead agents
        env.clear_dead()

        # print info
        if step_ct % 10 == 0:
            print("step: %d\t predators' reward: %d\t preys' reward: %d" %
                    (step_ct, reward[0], reward[1]))

        step_ct += 1
        if step_ct > 250:
            break


```

### Core Architecture Module: `examples/show_arrange.py`
```
"""
Show arrange, pygame are required.
Type messages and let agents to arrange themselves to form these characters
"""


import os
import sys
import argparse
import magent
from magent.renderer import PyGameRenderer
from magent.renderer.server import ArrangeServer as Server

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", type=int, default=0, help="0: without maze, 1: adding a maze")
    parser.add_argument("--mess", type=str, nargs="+", help="words you wanna print", required=True)
    args = parser.parse_args()

    magent.utility.check_model('arrange')

    PyGameRenderer().start(Server(messages=args.mess, mode=args.mode), grid_size=3.5)

```

### Core Architecture Module: `examples/show_battle_game.py`
```
"""
Interactive game, Pygame are required.
Act like a general and dispatch your solders.
"""

import os

import magent
from magent.renderer import PyGameRenderer
from magent.renderer.server import BattleServer as Server


if __name__ == "__main__":
    magent.utility.check_model('battle-game')
    PyGameRenderer().start(Server())

```

### Core Architecture Module: `examples/train_against.py`
```
"""
Train a model to against existing benchmark
"""

import argparse
import time
import os
import logging as log
import math

import numpy as np

import magent
from magent.builtin.rule_model import RandomActor


def generate_map(env, map_size, handles):
    width = height = map_size
    init_num = map_size * map_size * 0.04

    gap = 3
    leftID, rightID = 0, 1

    # add left square of agents
    n = init_num
    side = int(math.sqrt(n)) * 2
    pos = []
    for x in range(width//2 - gap - side, width//2 - gap - side + side, 2):
        for y in range((height - side)//2, (height - side)//2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[leftID], method="custom", pos=pos)

    # add right square of agents
    n = init_num
    side = int(math.sqrt(n)) * 2
    pos = []
    for x in range(width//2 + gap, width//2 + gap + side, 2):
        for y in range((height - side)//2, (height - side)//2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[rightID], method="custom", pos=pos)


def play_a_round(env, map_size, handles, models, print_every, eps, step_batch_size=None, train=True,
                 train_id=1, render=False):
    """play a round of game"""
    env.reset()
    generate_map(env, map_size, handles)

    step_ct = 0
    done = False

    n = len(handles)
    obs  = [[] for _ in range(n)]
    ids  = [[] for _ in range(n)]
    acts = [[] for _ in range(n)]
    nums = [env.get_num(handle) for handle in handles]
    total_reward = [0 for _ in range(n)]
    n_transition = 0
    pos_reward_num = 0
    total_loss, value = 0, 0

    print("===== sample =====")
    print("eps %s number %s" % (eps, nums))
    start_time = time.time()
    while not done:
        # take actions for every model
        for i in range(n):
            obs[i] = env.get_observation(handles[i])
            ids[i] = env.get_agent_id(handles[i])
            # let models infer action in parallel (non-blocking)
            models[i].infer_action(obs[i], ids[i], 'e_greedy', eps[i], block=False)

        for i in range(n):
            acts[i] = models[i].fetch_action()  # fetch actions (blocking)
            env.set_action(handles[i], acts[i])

        # simulate one step
        done = env.step()

        # sample
        step_reward = []
        for i in range(n):
            rewards = env.get_reward(handles[i])
            if train and i == train_id:
                alives = env.get_alive(handles[train_id])
                # store samples in replay buffer (non-blocking)
                models[train_id].sample_step(rewards, alives, block=False)
                pos_reward_num += len(rewards[rewards > 0])
            s = sum(rewards)
            step_reward.append(s)
            total_reward[i] += s

        # render
        if render:
            env.render()

        # stat info
        nums = [env.get_num(handle) for handle in handles]
        n_transition += nums[train_id]

        # clear dead agents
        env.clear_dead()

        # check return message of previous called non-blocking function sample_step()
        if train:
            models[train_id].check_done()

        if step_ct % print_every == 0:
            print("step %3d,  nums: %s reward: %s,  total_reward: %s, pos_rewards %d" %
                  (step_ct, nums, np.around(step_reward, 2), np.around(total_reward, 2),
                      pos_reward_num))
        step_ct += 1
        if step_ct > args.n_step:
            break

        if step_batch_size and n_transition > step_batch_size and train:
            total_loss, value = models[train_id].train(500)
            n_transition = 0

    sample_time = time.time() - start_time
    print("steps: %d,  total time: %.2f,  step average %.2f" % (step_ct, sample_time, sample_time / step_ct))

    # train
    if train:
        print("===== train =====")
        start_time = time.time()
        total_loss, value = models[train_id].train(500)
        train_time = time.time() - start_time
        print("train_time %.2f" % train_time)

    return magent.round(total_loss), nums, magent.round(total_reward), magent.round(value)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--save_every", type=int, default=5)
    parser.add_argument("--render_every", type=int, default=10)
    parser.add_argument("--n_round", type=int, default=600)
    parser.add_argument("--n_step", type=int, default=550)
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--load_from", type=int)
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--map_size", type=int, default=125)
    parser.add_argument("--greedy", action="store_true")
    parser.add_argument("--name", type=str, default="against")
    parser.add_argument("--eval", action="store_true")
    parser.add_argument("--opponent", type=int, default=0)
    parser.add_argument('--alg', default='dqn', choices=['dqn', 'drqn', 'a2c'])
    args = parser.parse_args()

    # download opponent model
    magent.utility.check_model('against')

    # set logger
    magent.utility.init_logger(args.name)

    # init the game
    env = magent.GridWorld("battle", map_size=args.map_size)
    env.set_render_dir("build/render")

    # two groups of agents
    handles = env.get_handles()

    # sample eval observation set
    if args.eval:
        print("sample eval set...")
        env.reset()
        generate_map(env, args.map_size, handles)
        eval_obs = magent.utility.sample_observation(env, handles, n_obs=2048, step=500)
    else:
        eval_obs = [None, None]

    # init models
    names = [args.name + "-a", "battle"]
    batch_size = 512
    unroll_step = 16
    train_freq = 5

    models = []

    # load opponent
    if args.opponent >= 0:
        from magent.builtin.tf_model import DeepQNetwork
        models.append(magent.ProcessingModel(env, handles[1], names[1], 20000, 0, DeepQNetwork))
        models[0].load("data/battle_model", args.opponent)
    else:
        models.append(magent.ProcessingModel(env, handles[1], names[1], 20000, 0, RandomActor))

    # load our model
    if args.alg == 'dqn':
        from magent.builtin.tf_model import DeepQNetwork
        models.append(magent.ProcessingModel(env, handles[0], names[0], 20001, 1000, DeepQNetwork,
                                   batch_size=batch_size,
                                   learning_rate=3e-4,
                                   memory_size=2 ** 20, train_freq=train_freq, eval_obs=eval_obs[0]))
                                   
        step_batch_size = None
    elif args.alg == 'drqn':
        from magent.builtin.tf_model import DeepRecurrentQNetwork
        models.append(magent.ProcessingModel(env, handles[0], names[0], 20001, 1000, DeepRecurrentQNetwork,
                                   batch_size=batch_size/unroll_step, unroll_step=unroll_step,
                                   learning_rate=3e-4,
                                   memory_size=4 * 625, train_freq=train_freq, eval_obs=eval_obs[0]))
        step_batch_size = None
    elif args.alg == 'a2c':
        from magent.builtin.mx_model import AdvantageActorCritic
        step_batch_size = 10 * args.map_size * args.map_size * 0.04
        models.append(magent.ProcessingModel(env, handles[0], names[0], 20001, 1000, AdvantageActorCritic,
                                             learning_rate=1e-3))

    # load if
    savedir = 'save_model'
    if args.load_from is not None:
        start_from = args.load_from
        print("load ... %d" % start_from)
        models[0].load(savedir, start_from)
    else:
        start_from = 0

    # print debug info
    print(args)
    print("view_size", env.get_view_space(handles[0]))
    print("feature_size", env.get_feature_space(handles[0]))

    # play
    start = time.time()
    for k in range(start_from, start_from + args.n_round):
        tic = time.time()
        start = 1 if args.opponent != -1 else 0.1
        train_eps = m
```

### Core Architecture Module: `examples/train_arrange.py`
```
"""
Train agents to arrange themselves into a specific message
"""

import argparse
import logging as log
import time
import random
import numpy as np

import magent
from magent.builtin.tf_model import DeepQNetwork as RLModel
from magent.utility import FontProvider


def remove_wall(d, cur_pos, wall_set, unit):
    if d == 0:
        for i in range(0, unit):
            for j in range(0, unit):
                temp = (cur_pos[0] + i, cur_pos[1] + unit + j)
                if temp in wall_set:
                    wall_set.remove(temp)
    elif d == 1:
        for i in range(0, unit):
            for j in range(0, unit):
                temp = (cur_pos[0] - unit + i, cur_pos[1] + j)
                if temp in wall_set:
                    wall_set.remove(temp)
    elif d == 2:
        for i in range(0, unit):
            for j in range(0, unit):
                temp = (cur_pos[0] + i, cur_pos[1] - unit + j)
                if temp in wall_set:
                    wall_set.remove(temp)
    elif d == 3:
        for i in range(0, unit):
            for j in range(0, unit):
                temp = (cur_pos[0] + unit + i, cur_pos[1] + j)
                if temp in wall_set:
                    wall_set.remove(temp)


def dfs(x, y, width, height, unit, wall_set):
    pos = set()
    trace = list()
    pos.add((x, y))
    trace.append((x, y))

    max_x = x + width
    max_y = y + height

    d = random.choice(range(4))
    pos_list = []
    flag = 0
    while len(trace) > 0:
        if flag == 4:
            cur_pos = trace[-1]
            trace.pop()
            if random.choice(range(2)) == 0:
                remove_wall(d, cur_pos, wall_set, unit)
            flag = 0
        if len(trace) == 0:
            break
        cur_pos = list(trace[-1])
        if d == 0:
            cur_pos[1] = max(y, cur_pos[1] - 2 * unit)
        elif d == 1:
            cur_pos[0] = min(max_x, cur_pos[0] + 2 * unit)
        elif d == 2:
            cur_pos[1] = min(max_y, cur_pos[1] + 2 * unit)
        elif d == 3:
            cur_pos[0] = max(x, cur_pos[0] - 2 * unit)
        if tuple(cur_pos) in pos:
            d = (d + 1) % 4
            flag += 1
        else:
            remove_wall(d, cur_pos, wall_set, unit)
            trace.append(tuple(cur_pos))
            pos.add(tuple(cur_pos))
            d = random.choice(range(4))


def clean_pos_set_convert_to_list(pos_set, pos_list):
    for v in pos_list:
        if v in pos_set:
            pos_set.remove(v)
    return list(pos_set)


def draw_line(x, y, width, height):
    pos_set = []
    for r in range(height):
        for c in range(width):
            pos_set.append((x + c, y + r))
    return pos_set


def open_the_door(x_s, y_s, w, h, unit):
    pos_list = []
    n_door = 15
    random_horizon_list_x = [x_s + (2 * np.random.choice(w // 2 // unit, n_door) + 1) * unit, x_s + (2 * np.random.choice(w // 2 // unit, n_door) - 1) * unit]
    random_vertical_list_y = [y_s + (2 * np.random.choice(h // 2 // unit, n_door) + 1) * unit, y_s + (2 * np.random.choice(h // 2 // unit, n_door) + 1) * unit]

    y_e = y_s + h - unit
    for v in random_horizon_list_x[0]:
        pos_list.extend([(v, y_s), (v + 1, y_s), (v, y_s + 1), (v + 1, y_s + 1)])
    for v in random_horizon_list_x[1]:
        pos_list.extend([(v, y_e), (v + 1, y_e), (v, y_e + 1), (v + 1, y_e + 1)])

    x_e = x_s + w - unit
    for v in random_vertical_list_y[0]:
        pos_list.extend([(x_s, v), (x_s, v + 1), (x_s + 1, v), (x_s + 1, v + 1)])
    for v in random_vertical_list_y[1]:
        pos_list.extend([(x_e, v), (x_e, v + 1), (x_e + 1, v), (x_e + 1, v + 1)])

    return pos_list


def create_maze(pos, width, height, unit, font_area):
    # draw block: with rect: left(x), top(y), width, height
    pos_set = []
    for i in range(height):
        if i % 2 == 0:
            pos_set.extend(draw_line(pos[0], pos[1] + i * unit, width * unit, unit))
            pos_set.extend(draw_line(pos[0], pos[1] + font_area[1] + i * unit, width * unit, unit))
            pos_set.extend(draw_line(pos[0] + i * unit, pos[1] + height * unit, unit, font_area[1]))
            pos_set.extend(draw_line(pos[0] + font_area[0] + i * unit, pos[1] + height * unit, unit, font_area[1]))

    for i in range(width):
        if i % 2 == 0:
            pos_set.extend(draw_line(pos[0] + i * unit, pos[1], unit, height * unit))
            pos_set.extend(draw_line(pos[0] + i * unit, pos[1] + font_area[1], unit, height * unit))
            pos_set.extend(draw_line(pos[0], pos[1] + i * unit, height * unit, unit))
            pos_set.extend(draw_line(pos[0] + font_area[0], pos[1] + i * unit, height * unit, unit))

    pos_set = set(pos_set)

    dfs(pos[0] + 2, pos[1] + 2, (width - 1) * unit, (height - 1) * unit, unit, pos_set)  # north
    dfs(pos[0] + 2, pos[1] + (height - 2) * unit, (height - 1) * unit, (width + 3) * unit, unit, pos_set)  # west
    dfs(pos[0] + height * unit, pos[1] + font_area[1] - unit, (width - height) * unit, (height - 1) * unit, unit, pos_set)  # south
    dfs(pos[0] + font_area[0] - unit, pos[1] + (height - 2) * unit, (height - 1) * unit, font_area[1] - (height + 1) * unit, unit, pos_set)  # east

    temp = []
    temp.extend(open_the_door(pos[0], pos[1], font_area[0] + height * unit, font_area[1] + height * unit, unit))
    res = clean_pos_set_convert_to_list(pos_set, temp)
    return res


def draw_split_line(x, y, width, height, split=10):
    pos_set = []
    if height > width:
        splits = set(np.random.choice(height // 2, split) * 2)
        for r in range(height):
            if r in splits or (r - 1 in splits):
                continue
            for c in range(width):
                pos_set.append((x + c, y + r))
    else:
        splits = set(np.random.choice(width // 2, split) * 2)
        for r in range(height):
            for c in range(width):
                if c in splits or (c - 1 in splits):
                    continue
                pos_set.append((x + c, y + r))

    return pos_set


def create_naive_maze(pos, width, height, unit, font_area):
    pos_set = []
    for i in range(height):
        if i % 2 == 0:
            pos_set.extend(draw_split_line(pos[0], pos[1] + i * unit, width * unit, unit))
            pos_set.extend(draw_split_line(pos[0], pos[1] + font_area[1] + i * unit, width * unit, unit))
            pos_set.extend(draw_split_line(pos[0] + i * unit, pos[1] + height * unit, unit, font_area[1] - height * unit))
            pos_set.extend(draw_split_line(pos[0] + font_area[0] + i * unit, pos[1] + height * unit, unit, font_area[1] - height * unit))

    return pos_set


def load_config(map_size):
    gw = magent.gridworld
    cfg = gw.Config()

    cfg.set({"map_width": map_size, "map_height": map_size})
    cfg.set({"minimap_mode": True})
    cfg.set({"embedding_size": 12})

    goal = cfg.register_agent_type(
        "goal",
        {'width': 1, 'length': 1,

         'can_absorb': True
         }
    )

    agent = cfg.register_agent_type(
        "agent",
        {'width': 1, 'length': 1, 'hp': 10, 'speed': 2,
         'view_range': gw.CircleRange(6),
         'step_recover': -10.0/400,

         'step_reward': 0,
         })

    g_goal = cfg.add_group(goal)
    g_agent = cfg.add_group(agent)

    g = gw.AgentSymbol(g_goal, 'any')
    a = gw.AgentSymbol(g_agent, 'any')

    cfg.add_reward_rule(gw.Event(a, 'collide', g), receiver=a, value=10)

    return cfg


def generate_map(env, map_size, goal_handle, handles):
    # random message
    font = FontProvider('data/font_8x8/basic.txt')
    n_msg = random.randint(1, 4)
    messages = []
    for i in range(n_msg):
        length = random.randint(2, 9)
        tmp = []
        for j in range(length):
            tmp.append(random.randint(0x20, 0x7E))
        messages.append(tmp)

    center_x, center_y = map_size // 2, map_size // 2

    # create maze: left pos, width, height
    radius = 90
    pos_list = create_maze([center_x - radius, center_y - radius], radius + 1, 15, 2, font_ar
```

### Core Architecture Module: `examples/train_battle.py`
```
"""
Train battle, two models in two processes
"""

import argparse
import time
import logging as log
import math

import numpy as np

import magent

leftID, rightID = 0, 1
def generate_map(env, map_size, handles):
    """ generate a map, which consists of two squares of agents"""
    width = height = map_size
    init_num = map_size * map_size * 0.04
    gap = 3

    global leftID, rightID
    leftID, rightID = rightID, leftID

    # left
    n = init_num
    side = int(math.sqrt(n)) * 2
    pos = []
    for x in range(width//2 - gap - side, width//2 - gap - side + side, 2):
        for y in range((height - side)//2, (height - side)//2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[leftID], method="custom", pos=pos)

    # right
    n = init_num
    side = int(math.sqrt(n)) * 2
    pos = []
    for x in range(width//2 + gap, width//2 + gap + side, 2):
        for y in range((height - side)//2, (height - side)//2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[rightID], method="custom", pos=pos)


def play_a_round(env, map_size, handles, models, print_every, train=True, render=False, eps=None):
    """play a ground and train"""
    env.reset()
    generate_map(env, map_size, handles)

    step_ct = 0
    done = False

    n = len(handles)
    obs  = [[] for _ in range(n)]
    ids  = [[] for _ in range(n)]
    acts = [[] for _ in range(n)]
    nums = [env.get_num(handle) for handle in handles]
    total_reward = [0 for _ in range(n)]

    print("===== sample =====")
    print("eps %.2f number %s" % (eps, nums))
    start_time = time.time()
    while not done:
        # take actions for every model
        for i in range(n):
            obs[i] = env.get_observation(handles[i])
            ids[i] = env.get_agent_id(handles[i])
            # let models infer action in parallel (non-blocking)
            models[i].infer_action(obs[i], ids[i], 'e_greedy', eps, block=False)

        for i in range(n):
            acts[i] = models[i].fetch_action()  # fetch actions (blocking)
            env.set_action(handles[i], acts[i])

        # simulate one step
        done = env.step()

        # sample
        step_reward = []
        for i in range(n):
            rewards = env.get_reward(handles[i])
            if train:
                alives = env.get_alive(handles[i])
                # store samples in replay buffer (non-blocking)
                models[i].sample_step(rewards, alives, block=False)
            s = sum(rewards)
            step_reward.append(s)
            total_reward[i] += s

        # render
        if render:
            env.render()

        # stat info
        nums = [env.get_num(handle) for handle in handles]

        # clear dead agents
        env.clear_dead()

        # check return message of previous called non-blocking function sample_step()
        if args.train:
            for model in models:
                model.check_done()

        if step_ct % print_every == 0:
            print("step %3d,  nums: %s reward: %s,  total_reward: %s " %
                  (step_ct, nums, np.around(step_reward, 2), np.around(total_reward, 2)))

        step_ct += 1
        if step_ct > 550:
            break

    sample_time = time.time() - start_time
    print("steps: %d,  total time: %.2f,  step average %.2f" % (step_ct, sample_time, sample_time / step_ct))

    # train
    total_loss, value = [0 for _ in range(n)], [0 for _ in range(n)]
    if train:
        print("===== train =====")
        start_time = time.time()

        # train models in parallel
        for i in range(n):
            models[i].train(print_every=1000, block=False)
        for i in range(n):
            total_loss[i], value[i] = models[i].fetch_train()

        train_time = time.time() - start_time
        print("train_time %.2f" % train_time)

    def round_list(l): return [round(x, 2) for x in l]
    return round_list(total_loss), nums, round_list(total_reward), round_list(value)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--save_every", type=int, default=5)
    parser.add_argument("--render_every", type=int, default=10)
    parser.add_argument("--n_round", type=int, default=2000)
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--load_from", type=int)
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--map_size", type=int, default=125)
    parser.add_argument("--greedy", action="store_true")
    parser.add_argument("--name", type=str, default="battle")
    parser.add_argument("--eval", action="store_true")
    parser.add_argument('--alg', default='dqn', choices=['dqn', 'drqn', 'a2c'])
    args = parser.parse_args()

    # set logger
    magent.utility.init_logger(args.name)

    # init the game
    env = magent.GridWorld("battle", map_size=args.map_size)
    env.set_render_dir("build/render")

    # two groups of agents
    handles = env.get_handles()

    # sample eval observation set
    eval_obs = [None, None]
    if args.eval:
        print("sample eval set...")
        env.reset()
        generate_map(env, args.map_size, handles)
        for i in range(len(handles)):
            eval_obs[i] = magent.utility.sample_observation(env, handles, 2048, 500)

    # load models
    batch_size = 256
    unroll_step = 8
    target_update = 1200
    train_freq = 5

    if args.alg == 'dqn':
        from magent.builtin.tf_model import DeepQNetwork
        RLModel = DeepQNetwork
        base_args = {'batch_size': batch_size,
                     'memory_size': 2 ** 20, 'learning_rate': 1e-4,
                     'target_update': target_update, 'train_freq': train_freq}
    elif args.alg == 'drqn':
        from magent.builtin.tf_model import DeepRecurrentQNetwork
        RLModel = DeepRecurrentQNetwork
        base_args = {'batch_size': batch_size / unroll_step, 'unroll_step': unroll_step,
                     'memory_size': 8 * 625, 'learning_rate': 1e-4,
                     'target_update': target_update, 'train_freq': train_freq}
    elif args.alg == 'a2c':
        # see train_against.py to know how to use a2c
        raise NotImplementedError

    # init models
    names = [args.name + "-l", args.name + "-r"]
    models = []

    for i in range(len(names)):
        model_args = {'eval_obs': eval_obs[i]}
        model_args.update(base_args)
        models.append(magent.ProcessingModel(env, handles[i], names[i], 20000+i, 1000, RLModel, **model_args))

    # load if
    savedir = 'save_model'
    if args.load_from is not None:
        start_from = args.load_from
        print("load ... %d" % start_from)
        for model in models:
            model.load(savedir, start_from)
    else:
        start_from = 0

    # print state info
    print(args)
    print("view_space", env.get_view_space(handles[0]))
    print("feature_space", env.get_feature_space(handles[0]))

    # play
    start = time.time()
    for k in range(start_from, start_from + args.n_round):
        tic = time.time()
        eps = magent.utility.piecewise_decay(k, [0, 700, 1400], [1, 0.2, 0.05]) if not args.greedy else 0
        loss, num, reward, value = play_a_round(env, args.map_size, handles, models,
                                                train=args.train, print_every=50,
                                                render=args.render or (k+1) % args.render_every == 0,
                                                eps=eps)  # for e-greedy

        log.info("round %d\t loss: %s\t num: %s\t reward: %s\t value: %s" % (k, loss, num, reward, value))
        print("round time %.2f  total time %.2f\n" % (time.time() - tic, time.time() - start))

        # save models
        if (k + 1) % args.save_every == 0 and args.train:
            print("save model... ")
            for model in models:
                model.save(savedir, k)

    # send quit command
    for model in models:
        model.quit()

```

### Core Architecture Module: `examples/train_battle_game.py`
```
"""
Train script of the battle game
"""

import argparse
import time
import logging as log
import math

import numpy as np

import magent
from magent.builtin.tf_model import DeepQNetwork, DeepRecurrentQNetwork


def generate_map(env, map_size, handles):
    width = map_size
    height = map_size

    init_num = 20

    gap = 3
    leftID, rightID = 0, 1

    # left
    pos = []
    for y in range(10, 45):
        pos.append((width / 2 - 5, y))
        pos.append((width / 2 - 4, y))
    for y in range(50, height // 2 + 25):
        pos.append((width / 2 - 5, y))
        pos.append((width / 2 - 4, y))

    for y in range(height // 2 - 25, height - 50):
        pos.append((width / 2 + 5, y))
        pos.append((width / 2 + 4, y))
    for y in range(height - 45, height - 10):
        pos.append((width / 2 + 5, y))
        pos.append((width / 2 + 4, y))
    env.add_walls(pos=pos, method="custom")

    n = init_num
    side = int(math.sqrt(n)) * 2
    pos = []
    for x in range(width//2 - gap - side, width//2 - gap - side + side, 2):
        for y in range((height - side)//2, (height - side)//2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[leftID], method="custom", pos=pos)

    # right
    n = init_num
    side = int(math.sqrt(n)) * 2
    pos = []
    for x in range(width//2 + gap, width//2 + gap + side, 2):
        for y in range((height - side)//2, (height - side)//2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[rightID], method="custom", pos=pos)


def play_a_round(env, map_size, handles, models, print_every, train=True, render=False, eps=None):
    env.reset()
    generate_map(env, map_size, handles)

    step_ct = 0
    done = False

    n = len(handles)
    obs  = [[] for _ in range(n)]
    ids  = [[] for _ in range(n)]
    acts = [[] for _ in range(n)]
    nums = [env.get_num(handle) for handle in handles]
    total_reward = [0 for _ in range(n)]

    print("===== sample =====")
    print("eps %.2f number %s" % (eps, nums))
    start_time = time.time()
    counter = 10
    while not done:
        # take actions for every model
        for i in range(n):
            obs[i] = env.get_observation(handles[i])
            ids[i] = env.get_agent_id(handles[i])
            # let models infer action in parallel (non-blocking)
            models[i].infer_action(obs[i], ids[i], 'e_greedy', eps, block=False)

        for i in range(n):
            acts[i] = models[i].fetch_action()  # fetch actions (blocking)
            env.set_action(handles[i], acts[i])

        # simulate one step
        done = env.step()

        # sample
        step_reward = []
        for i in range(n):
            rewards = env.get_reward(handles[i])
            pos = env.get_pos(handles[i])
            for (x, y) in pos:
                rewards -= ((1.0 * x / map_size - 0.5) ** 2 + (1.0 * y / map_size - 0.5) ** 2) / 100
            if train:
                alives = env.get_alive(handles[i])
                # store samples in replay buffer (non-blocking)
                models[i].sample_step(rewards, alives, block=False)
            s = sum(rewards)
            step_reward.append(s)
            total_reward[i] += s

        # render
        if render:
            env.render()

        # stat info
        nums = [env.get_num(handle) for handle in handles]

        # clear dead agents
        env.clear_dead()

        # check return message of previous called non-blocking function sample_step()
        if args.train:
            for model in models:
                model.check_done()

        if step_ct % print_every == 0:
            print("step %3d,  nums: %s reward: %s,  total_reward: %s " %
                  (step_ct, nums, np.around(step_reward, 2), np.around(total_reward, 2)))

        step_ct += 1
        if step_ct % 50 == 0 and counter >= 0:
            counter -= 1
            g = 1
            pos = []
            x = np.random.randint(0, map_size - 1)
            y = np.random.randint(0, map_size - 1)
            for i in range(-4, 4):
                for j in range(-4, 4):
                    pos.append((x + i, y + j))
            env.add_agents(handles[g ^ 1], method="custom", pos=pos)
            
            pos = []
            x = np.random.randint(0, map_size - 1)
            y = np.random.randint(0, map_size - 1)
            for i in range(-4, 4):
                for j in range(-4, 4):
                    pos.append((x + i, y + j))
            env.add_agents(handles[g], method="custom", pos=pos)
            
            step_ct = 0
        if step_ct > 500:
            break

    sample_time = time.time() - start_time
    print("steps: %d,  total time: %.2f,  step average %.2f" % (step_ct, sample_time, sample_time / step_ct))

    # train
    total_loss, value = [0 for _ in range(n)], [0 for _ in range(n)]
    if train:
        print("===== train =====")
        start_time = time.time()

        # train models in parallel
        for i in range(n):
            models[i].train(print_every=1000, block=False)
        for i in range(n):
            total_loss[i], value[i] = models[i].fetch_train()

        train_time = time.time() - start_time
        print("train_time %.2f" % train_time)

    def round_list(l): return [round(x, 2) for x in l]
    return round_list(total_loss), nums, round_list(total_reward), round_list(value)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--save_every", type=int, default=5)
    parser.add_argument("--render_every", type=int, default=10)
    parser.add_argument("--n_round", type=int, default=1500)
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--load_from", type=int)
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--map_size", type=int, default=125)
    parser.add_argument("--greedy", action="store_true")
    parser.add_argument("--name", type=str, default="battle")
    parser.add_argument("--eval", action="store_true")
    parser.add_argument('--alg', default='dqn', choices=['dqn', 'drqn', 'a2c'])
    args = parser.parse_args()

    # set logger
    magent.utility.init_logger(args.name)

    # init the game
    env = magent.GridWorld("battle", map_size=args.map_size)
    env.set_render_dir("build/render")

    # two groups of agents
    handles = env.get_handles()

    # sample eval observation set
    eval_obs = [None, None]
    if args.eval:
        print("sample eval set...")
        env.reset()
        generate_map(env, args.map_size, handles)
        for i in range(len(handles)):
            eval_obs[i] = magent.utility.sample_observation(env, handles, 2048, 500)

    # load models
    batch_size = 256
    unroll_step = 8
    target_update = 1200
    train_freq = 5

    if args.alg == 'dqn':
        RLModel = DeepQNetwork
        base_args = {'batch_size': batch_size,
                     'memory_size': 2 ** 21, 'learning_rate': 1e-4,
                     'target_update': target_update, 'train_freq': train_freq}
    elif args.alg == 'drqn':
        RLModel = DeepRecurrentQNetwork
        base_args = {'batch_size': batch_size / unroll_step, 'unroll_step': unroll_step,
                     'memory_size': 8 * 625, 'learning_rate': 1e-4,
                     'target_update': target_update, 'train_freq': train_freq}
    elif args.alg == 'a2c':
        raise NotImplementedError
    else:
        raise NotImplementedError

    # init models
    names = [args.name + "-l", args.name + "-r"]
    models = []

    for i in range(len(names)):
        model_args = {'eval_obs': eval_obs[i]}
        model_args.update(base_args)
        models.append(magent.ProcessingModel(env, handles[i], names[i], 20000, 1000, RLModel, **model_args))

    # load if
    savedir = 'save_model'
    if args.load_from is not None:
        start_from = args.load_from
        print("load ... %d" % start_from)
        for model in models:
            model.load(savedir, start_from)
    else:
        s
```

### Core Architecture Module: `examples/train_gather.py`
```
"""
Train agents to gather food
"""

import argparse
import logging as log
import time

import magent
from magent.builtin.mx_model import DeepQNetwork as RLModel
# change this line to magent.builtin.tf_model to use tensorflow


def load_config(size):
    gw = magent.gridworld
    cfg = gw.Config()

    cfg.set({"map_width": size, "map_height": size})
    cfg.set({"minimap_mode": True})

    agent = cfg.register_agent_type(
        name="agent",
        attr={'width': 1, 'length': 1, 'hp': 3, 'speed': 3,
              'view_range': gw.CircleRange(7), 'attack_range': gw.CircleRange(1),
              'damage': 6, 'step_recover': 0,
              'step_reward': -0.01,  'dead_penalty': -1, 'attack_penalty': -0.1,
              'attack_in_group': 1})

    food = cfg.register_agent_type(
        name='food',
        attr={'width': 1, 'length': 1, 'hp': 25, 'speed': 0,
              'view_range': gw.CircleRange(1), 'attack_range': gw.CircleRange(0),
              'kill_reward': 5})

    g_f = cfg.add_group(food)
    g_s = cfg.add_group(agent)

    a = gw.AgentSymbol(g_s, index='any')
    b = gw.AgentSymbol(g_f, index='any')

    cfg.add_reward_rule(gw.Event(a, 'attack', b), receiver=a, value=0.5)
    
    return cfg


def generate_map(env, map_size, food_handle, handles):
    center_x, center_y = map_size // 2, map_size // 2

    def add_square(pos, side, gap):
        side = int(side)
        for x in range(center_x - side//2, center_x + side//2 + 1, gap):
            pos.append([x, center_y - side//2])
            pos.append([x, center_y + side//2])
        for y in range(center_y - side//2, center_y + side//2 + 1, gap):
            pos.append([center_x - side//2, y])
            pos.append([center_x + side//2, y])

    # agent
    pos = []
    add_square(pos, map_size * 0.9, 3)
    add_square(pos, map_size * 0.8, 4)
    add_square(pos, map_size * 0.7, 6)
    env.add_agents(handles[0], method="custom", pos=pos)

    # food
    pos = []
    add_square(pos, map_size * 0.65, 10)
    add_square(pos, map_size * 0.6,  10)
    add_square(pos, map_size * 0.55, 10)
    add_square(pos, map_size * 0.5,  4)
    add_square(pos, map_size * 0.45, 3)
    add_square(pos, map_size * 0.4, 1)
    add_square(pos, map_size * 0.3, 1)
    add_square(pos, map_size * 0.3 - 2, 1)
    add_square(pos, map_size * 0.3 - 4, 1)
    add_square(pos, map_size * 0.3 - 6, 1)
    env.add_agents(food_handle, method="custom", pos=pos)

    # legend
    legend = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
        [1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,],
        [1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,],
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0,],
        [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0,],
        [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0,],
        [1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0,],
        [1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0,],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    ]

    org = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    ]

    def draw(base_x, base_y, scale, data):
        w, h = len(data), len(data[0])
        pos = []
        for i in range(w):
            for j in range(h):
                if data[i][j] == 1:
                    start_x = i * scale + base_x
                    start_y = j * scale + base_y
                    for x in range(start_x, start_x + scale):
                        for y in range(start_y, start_y + scale):
                            pos.append([y, x])

        env.add_agents(food_handle, method="custom", pos=pos)

    scale = 1
    w, h = len(legend), len(legend[0])
    offset = -3
    draw(offset + map_size // 2 - w // 2 * scale, map_size // 2 - h // 2 * scale, scale, legend)
    draw(offset + map_size // 2 - w // 2 * scale + len(legend), map_size // 2 - h // 2 * scale, scale, org)


def play_a_round(env, map_size, food_handle, handles, models, train_id=-1,
                 print_every=10, record=False, render=False, eps=None):
    env.reset()
    generate_map(env, map_size, food_handle, handles)

    step_ct = 0
    total_reward = 0
    done = False

    pos_reward_ct = set()

    n = len(handles)
    obs  = [None for _ in range(n)]
    ids  = [None for _ in range(n)]
    acts = [None for _ in range(n)]
    nums = [env.get_num(handle) for handle in handles]
    sample_buffer = magent.utility.EpisodesBuffer(capacity=5000)

    print("===== sample =====")
    print("eps %s number %s" % (eps, nums))
    start_time = time.time()
    while not done:
        # take actions for every model
        for i in range(n):
            obs[i] = env.get_observation(handles[i])
            ids[i] = env.get_agent_id(handles[i])
            acts[i] = models[i].infer_action(obs[i], ids[i], policy='e_greedy', eps=eps)
            env.set_action(handles[i], acts[i])

        # simulate one step
        done = env.step()

        # sample
        rewards = env.get_reward(handles[train_id])
        step_reward = 0
        if train_id != -1:
            alives  = env.get_alive(handles[train_id])
            total_reward += sum(rewards)
            sample_buffer.record_step(ids[train_id], obs[train_id], acts[train_id], rewards, alives)
            step_reward = sum(rewards)

        # render
        if render:
            env.render()

        for id, r in zip(ids[0], rewards):
            if r > 0.05 and id not in pos_reward_ct:
                pos_reward_ct.add(id)

        # clear dead agents
        env.clear_dead()

        # stats info
        for i in range(n):
            nums[i] = env.get_num(handles[i])
        food_num = env.get_num(food_handle)

        if step_ct % print_every == 0:
            print("step %3d,  train %d,  num %s,  reward %.2f,  total_reward: %.2f, non_zero: %d" %
                  (step_ct, train_id, [food_num]
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #96** (2022-10-22): **Update readme link**
  *Symptoms*: We renamed our maintained fork of MAgent to MAgent2 for better clarity to users; could you please update the link?

- **Issue #92** (2022-04-12): ** Error on Ubuntu 20.04**
  *Symptoms*: I used Ubuntu 20.0 and Python 3.6 to run this project. I downloaded this repository and run these commands:  cd MAgent sudo apt-get install cmake libboost-system-dev libjsoncpp-dev libwebsocketpp-dev bash build.sh export PYTHONPATH=$(pwd)/python:$PYTHONPATH  When I used pycharm to mark the "Python" file in it as the Sources Root，and run the file "api_demo.py",it showed some error massages: Traceback (most recent call last):   File "/home/lwq/PycharmProjects/MAgent/examples/api_demo.py", line 16, in <module>     env.set_render_dir("build/render")   File "/home/lwq/PycharmProjects/MAgent/python/magent/gridworld.py", line 430, in set_render_dir     os.mkdir(name) FileNotFoundError: [Errno 2] No such file or directory: 'build/render'  and when I run the file "train_battle.py", it showed: Traceback (most recent call last):   File "examples/train_battle.py", line 12, in <module>     import magent ModuleNotFoundError: No module named 'magent' 
  **Post-Mortem & Fix Analysis**:
  > Could you check the working directory when you run the `api_demo.py`? By default, PyCharm will just set the working directory to be the folder of the script (in your case it's `/home/lwq/PycharmProjects/MAgent/examples`). However, it's supposed to run all scripts in the root folder of MAgent, which could be fixed by setting the working directory manually to `/home/lwq/PycharmProjects/MAgent`.
  > In the second case, could you also verify the `PYTHONPATH` and the working directory are both set correctly?
  > Thank you very much for your reply. I reset the working directory, but the error still appeared： (ITSC) lwq@lwq-Precision-7920-Tower:~/PycharmProjects/MAgent$ python examples/train_battle.py --train Traceback (most recent call last):   File "examples/train_battle.py", line 14, in <module>     import magent ModuleNotFoundError: No module named 'magent' 

- **Issue #91** (2022-04-04): **Update link to maintained fork**
  *Symptoms*: Awhile ago we renamed the PettingZoo Team org to the Farama Foundation. This old link still works via redirect, but this removes the redirect since it's confused at least two people.

- **Issue #86** (2021-06-01): **Enable attacks between agents of the same group**
  *Symptoms*: I'm trying to configure a group where agents belonging to the same group can attack among themselves and, if killed, gain some HP. The agent type goes like this:  ```python configuration.register_agent_type("agent_type, {'width': 1,    'length': 1,    'hp': 5,     'speed': 1,    'view_range': CircleRange(4),    'attack_range': CircleRange(1),    'damage': 3,    'step_recover': -0.1,     'food_supply': 0,    'kill_supply': 16, # This is the HP gain when the agent is killed.    'step_reward': 1,    'attack_penalty': -0.1}) ```  I've been running a couple of simulations, and it *seems* like the attacks among agents of the same group take no effect: I'm not seeing a decrease on HP. Is this by design? Is there a setting to enable "friendly fire"?
  **Post-Mortem & Fix Analysis**:
  > These lines are related https://github.com/geek-ai/MAgent/blob/b1fce2799bacd1d29f4a14b3196abc56425a6e6b/src/gridworld/Map.cc#L238 https://github.com/geek-ai/MAgent/blob/b1fce2799bacd1d29f4a14b3196abc56425a6e6b/examples/train_multi.py#L29

- **Issue #81** (2020-10-05): **The document says there are 23 actions, but when running the code, it shows there are 36 actions, how many actions are there and what are they?**
  *Symptoms*: The document says there are 23 actions, but when running the code, there are 36 actions, so how many actions are there ? What are the actions ? 
  **Post-Mortem & Fix Analysis**:
  > It seems the number of actions is related to the attributes "speed" and "attack_range", it would be better to give more detials in the document to specify the relationships between them.

- **Issue #80** (2020-06-27): **About minimap**
  *Symptoms*: Thanks for your environment, especially battle. I'm doing my experiment on it. I want to extract some information from original observation but I have no idea about group's minimap. Can you show me some details about it?
  **Post-Mortem & Fix Analysis**:
  > https://github.com/geek-ai/MAgent/blob/master/doc/get_started.md#observation

- **Issue #79** (2020-05-28): **Mention maintained fork in readme**
  *Symptoms*: @merrymercy Can you link to the fork of your project my group is maintaining since you guys no longer are maintaining this?
  **Post-Mortem & Fix Analysis**:
  > @justinkterry  Thanks! It is merged

- **Issue #74** (2020-06-22): **conflicting actions**
  *Symptoms*: Hi, What is the handling of conflicting actions? For example, if there are 2 agents with 1 space between them, what happens if they decide in the same round to walk on this field? Is the action canceled for both of them in this round or is just one of them getting the action? I'm experiencing some kinds of deadlocks, where some agents have the same rewarding option, but instead of doing it, they do nothing and wait until the other agents with this option are gone to do it. Are their actions canceled because of the conflict?
  **Post-Mortem & Fix Analysis**:
  > If there are conflicting actions, one random agent will have the higher priority. Then the action of another agent will be canceled.
  > Is it possible to change thsi behavior, so that the agent with the lowest id always has the highest priority?

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

### Incident Patch 1: `da573449` (2018-09-22)
**Commit Message**: Fixed bugs add update render/frontend

+ [model.py] In class ProcessingModel: add client_proc.join() when quit()

+ [render/frontend] Add and modify some default values
                    Add help info in index.html

+ [train_single.py] Fix bug about useless args.name

+ [Gridworld.cc] Move initialization of NUM_SEP_BUFFER to reset()

**File**: `examples/train_single.py` (modified, +2/-3)
```diff
@@ -138,7 +138,6 @@ def round_list(l): return [round(x, 2) for x in l]
     env.set_render_dir("build/render")
 
     # two groups of agents
-    names = [args.name + "-l", args.name + "-r"]
     handles = env.get_handles()
     
     # sample eval observation set
@@ -158,14 +157,14 @@ def round_list(l): return [round(x, 2) for x in l]
     models = []
     if args.alg == 'dqn':
         from magent.builtin.tf_model import DeepQNetwork
-        models.append(DeepQNetwork(env, handles[0], "battle",
+        models.append(DeepQNetwork(env, handles[0], args.name,
                                    batch_size=batch_size,
                                    learning_rate=3e-4,
                                    memory_size=2 ** 21, target_update=target_update,
                                    train_freq=train_freq, eval_obs=eval_obs))
     elif args.alg == 'drqn':
         from magent.builtin.tf_model import DeepRecurrentQNetwork
-        models.append(DeepRecurrentQNetwork(env, handles[0], "battle",
+        models.append(DeepRecurrentQNetwork(env, handles[0], args.name,
                                    learning_rate=3e-4,
                                    batch_size=batch_size/unroll_step, unroll_step=unroll_step,
                                    memory_size=2 * 8 * 625, target_update=target_update,
```

**File**: `python/magent/model.py` (modified, +9/-0)
```diff
@@ -149,6 +149,7 @@ def __init__(self, env, handle, name, port, sample_buffer_capacity=1000,
             args=(addr, sample_buffer_capacity, RLModel, kwargs),
         )
 
+        self.client_proc = proc
         proc.start()
         listener = multiprocessing.connection.Listener(addr)
         self.conn = listener.accept()
@@ -273,7 +274,15 @@ def check_done(self):
 
     def quit(self):
         """ quit """
+        proc = self.client_proc
+        self.client_proc = None
         self.conn.send(["quit"])
+        proc.join()
+
+    def __del__(self):
+        """ quit in destruction """
+        if self.client_proc is not None:
+            quit()
 
 
 def model_client(addr, sample_buffer_capacity, RLModel, model_args):
```

**File**: `src/gridworld/GridWorld.cc` (modified, +2/-2)
```diff
@@ -29,7 +29,6 @@ GridWorld::GridWorld() {
     random_engine.seed(0);
 
     counter_x = counter_y = nullptr;
-    NUM_SEP_BUFFER = 1;
 }
 
 GridWorld::~GridWorld() {
@@ -82,7 +81,8 @@ void GridWorld::reset() {
         }
         move_buffers = new std::vector<MoveAction>[NUM_SEP_BUFFER];
         turn_buffers = new std::vector<TurnAction>[NUM_SEP_BUFFER];
-    }
+    } else
+        NUM_SEP_BUFFER = 1;
 
     // reset map
     map.reset(width, height, food_mode);
```

**File**: `src/render/frontend/index.html` (modified, +43/-2)
```diff
@@ -32,14 +32,16 @@ <h4 class="modal-title">Files</h4>
                         <label for="magnet-file-form-conf" class="col-sm-2 control-label">Configuration</label>
                         <div class="col-sm-10">
                             <input class="form-control" id="magnet-file-form-conf"
-                                   placeholder="Enter magent configuration file here">
+                                   placeholder="Enter magent configuration file here"
+                                   value="config.json">
                         </div>
                     </div>
                     <div class="form-group">
                         <label for="magnet-file-form-map" class="col-sm-2 control-label">Map File</label>
                         <div class="col-sm-10">
                             <input class="form-control" id="magnet-file-form-map"
-                                   placeholder="Enter magent map file here">
+                                   placeholder="Enter magent map file here"
+                                   value="video_1.txt">
                         </div>
                     </div>
                     <div class="form-group">
@@ -83,6 +85,45 @@ <h4 class="modal-title">Settings</h4>
                 <h4 class="modal-title">Help</h4>
             </div>
             <div class="modal-body">
+                <h4><strong>Shortcuts</strong></h4>
+
+                <table class="Shortcuts table">
+                    <tbody>
+                    <tr><th width="52%">Description</th><th width="24%">Key</th></tr>
+                    <tr>
+                        <td>Move the map</td>
+                        <td>arrows</td>
+                    </tr>
+                    <tr>
+                        <td>Edit config and video file names</td>
+                        <td>e</td>
+                    </tr>
+                    <tr>
+                        <td>Help information</td>
+                        <td>h</td>
+                    </tr>
+                    <tr>
+                        <td>Edit settings</td>
+                        <td>s</td>
+                    </tr>
+                    <tr>
+                        <td>Zoom Out</td>
+                        <td>,</td>
+                    </tr>
+                    <tr>
+                        <td>Zoom In</td>
+                        <td>.</td>
+                    </tr>
+                    <tr>
+                        <td>Pause</td>
+                        <td>p</td>
+                    </tr>
+                    <tr>
+                        <td>&nbsp</td>
+                        <td>&nbsp</td>
+                    </tr>
+                    </tbody>
+                </table>
             </div>
         </div>
     </div>
```

**File**: `src/render/frontend/js/render-handle.js` (modified, +14/-4)
```diff
@@ -97,24 +97,32 @@ function _drawNumbers() {
 function _onkeydown(event) {
     var windowCenterX, windowCenterY;
     if (event.keyCode === 37) {
-        _offsetX = _offsetX - Math.max(1, Math.round(MOVE_SPACING * 10 / gridSize)); // Left
+        // Left
+        _offsetX = _offsetX - Math.max(1, Math.round(MOVE_SPACING * 10 / gridSize));
         _isWindowChanged = true;
     } else if (event.keyCode === 38) {
-        _offsetY = _offsetY - Math.max(1, Math.round(MOVE_SPACING * 10 / gridSize)); // Up
+        // Up
+        _offsetY = _offsetY - Math.max(1, Math.round(MOVE_SPACING * 10 / gridSize));
         _isWindowChanged = true;
     } else if (event.keyCode === 39) {
+        // Right
         _offsetX = _offsetX + Math.max(1, Math.round(MOVE_SPACING * 10 / gridSize));
         _isWindowChanged = true;
     } else if (event.keyCode === 40) {
+        // Down
         _offsetY = _offsetY + Math.max(1, Math.round(MOVE_SPACING * 10 / gridSize));
         _isWindowChanged = true;
     } else if (event.keyCode === 69) {
+        // E: Edit file name
         $("#magnet-file-modal").modal('show');
     } else if (event.keyCode === 72) {
+        // H: Help
         $("#magnet-help-modal").modal('show');
     } else if (event.keyCode === 83) {
+        // S: Settings
         $("#magnet-settings-modal").modal('show');
     } else if (event.keyCode === 188) {
+        // ,<: Zoom Out
         windowCenterX = _gridCTX.canvas.width / 2 / gridSize + _offsetX;
         windowCenterY = _gridCTX.canvas.height / 2 / gridSize + _offsetY;
         gridSize = Math.max(1, gridSize - 1);
@@ -123,6 +131,7 @@ function _onkeydown(event) {
         _isGridSizeChanged = true;
         _isWindowChanged = true;
     } else if (event.keyCode === 190) {
+        // .>: Zoom In
         windowCenterX = _gridCTX.canvas.width / 2 / gridSize + _offsetX;
         windowCenterY = _gridCTX.canvas.height / 2 / gridSize + _offsetY;
         gridSize = Math.min(100, gridSize + 1);
@@ -131,6 +140,7 @@ function _onkeydown(event) {
         _isGridSizeChanged = true;
         _isWindowChanged = true;
     } else if (event.keyCode === 80) {
+        // P: Pause
         _mapForcedPause ^= 1;
     }
 }
@@ -229,7 +239,7 @@ function run() {
                     _offsetY = 0;
                     gridSize = 10;
                     _mapAnimateTick = 0;
-                    _mapSpeed = 80;
+                    _mapSpeed = 250;
                     _mapForcedPause = false;
 
                     _gridCTX = document.getElementById('magnet-canvas-grid').getContext('2d');
@@ -278,7 +288,7 @@ function run() {
                         .removeAttr('disabled')
                         .attr('min', 0)
                         .attr('max', ANIMATE_STEP)
-                        .attr('value', 80)
+                        .attr('value', 250)
                         .bind('change', function () {
                             _mapSpeed = parseInt($('#magnet-settings-speed').val());
                         });
```

---

### Incident Patch 2: `423f3ae6` (2018-09-12)
**Commit Message**: fix bug about initialization of NUM_SEP_BUFFER

**File**: `src/gridworld/GridWorld.cc` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ GridWorld::GridWorld() {
     random_engine.seed(0);
 
     counter_x = counter_y = nullptr;
+    NUM_SEP_BUFFER = 1;
 }
 
 GridWorld::~GridWorld() {
```

---

### Incident Patch 3: `a860bb25` (2017-12-12)
**Commit Message**: fix bug: type error under python3

**File**: `python/magent/renderer/server/arrange_server.py` (modified, +31/-84)
```diff
@@ -8,6 +8,33 @@
 from magent.utility import FontProvider
 
 
+def remove_wall(d, cur_pos, wall_set, unit):
+    if d == 0:
+        for i in range(0, unit):
+            for j in range(0, unit):
+                temp = (cur_pos[0] + i, cur_pos[1] + unit + j)
+                if temp in wall_set:
+                    wall_set.remove(temp)
+    elif d == 1:
+        for i in range(0, unit):
+            for j in range(0, unit):
+                temp = (cur_pos[0] - unit + i, cur_pos[1] + j)
+                if temp in wall_set:
+                    wall_set.remove(temp)
+    elif d == 2:
+        for i in range(0, unit):
+            for j in range(0, unit):
+                temp = (cur_pos[0] + i, cur_pos[1] - unit + j)
+                if temp in wall_set:
+                    wall_set.remove(temp)
+    elif d == 3:
+        for i in range(0, unit):
+            for j in range(0, unit):
+                temp = (cur_pos[0] + unit + i, cur_pos[1] + j)
+                if temp in wall_set:
+                    wall_set.remove(temp)
+
+
 def dfs(x, y, width, height, unit, wall_set):
     pos = set()
     trace = list()
@@ -25,30 +52,7 @@ def dfs(x, y, width, height, unit, wall_set):
             cur_pos = trace[-1]
             trace.pop()
             if random.choice(range(2)) == 0:
-                if d == 0:
-                    for i in range(0, unit):
-                        for j in range(0, unit):
-                            temp = (cur_pos[0] + i, cur_pos[1] + unit + j)
-                            if temp in wall_set:
-                                wall_set.remove(temp)
-                elif d == 1:
-                    for i in range(0, unit):
-                        for j in range(0, unit):
-                            temp = (cur_pos[0] - unit + i, cur_pos[1] + j)
-                            if temp in wall_set:
-                                wall_set.remove(temp)
-                elif d == 2:
-                    for i in range(0, unit):
-                        for j in range(0, unit):
-                            temp = (cur_pos[0] + i, cur_pos[1] - unit + j)
-                            if temp in wall_set:
-                                wall_set.remove(temp)
-                elif d == 3:
-                    for i in range(0, unit):
-                        for j in range(0, unit):
-                            temp = (cur_pos[0] + unit + i, cur_pos[1] + j)
-                            if temp in wall_set:
-                                wall_set.remove(temp)
+                remove_wall(d, cur_pos, wall_set, unit)
             flag = 0
         if len(trace) == 0:
             break
@@ -65,31 +69,7 @@ def dfs(x, y, width, height, unit, wall_set):
             d = (d + 1) % 4
             flag += 1
         else:
-            if d == 0:
-                for i in range(0, unit):
-                    for j in range(0, unit):
-                        temp = (cur_pos[0] + i, cur_pos[1] + unit + j)
-                        if temp in wall_set:
-                            wall_set.remove(temp)
-            elif d == 1:
-                for i in range(0, unit):
-                    for j in range(0, unit):
-                        temp = (cur_pos[0] - unit + i, cur_pos[1] + j)
-                        if temp in wall_set:
-                            wall_set.remove(temp)
-            elif d == 2:
-                for i in range(0, unit):
-                    for j in range(0, unit):
-                        temp = (cur_pos[0] + i, cur_pos[1] - unit + j)
-                        if temp in wall_set:
-                            wall_set.remove(temp)
-            elif d == 3:
-                for i in range(0, unit):
-                    for j in range(0, unit):
-                        temp = (cur_pos[0] + unit + i, cur_pos[1] + j)
-                        if temp in wall_set:
-                            wall_set.remove(temp)
-
+            remove_wall(d, cur_pos, wall_set, unit)
             trace.append(t
```

---

### Incident Patch 4: `0db54dbc` (2017-12-07)
**Commit Message**: fix bug in map separation

**File**: `src/gridworld/GridWorld.cc` (modified, +21/-7)
```diff
@@ -62,13 +62,26 @@ GridWorld::~GridWorld() {
         delete [] counter_x;
     if (counter_y != nullptr)
         delete [] counter_y;
+
+    if (large_map_mode) {
+        delete [] move_buffers;
+        delete [] turn_buffers;
+    }
 }
 
 void GridWorld::reset() {
     id_counter = 0;
 
-    if (width * height > 99 * 99)
+    if (width * height > 99 * 99) {
         large_map_mode = true;
+        if (width * height > 1000 * 1000) {
+            NUM_SEP_BUFFER = 16;
+        } else {
+            NUM_SEP_BUFFER = 8;
+        }
+        move_buffers = new std::vector<MoveAction>[NUM_SEP_BUFFER];
+        turn_buffers = new std::vector<TurnAction>[NUM_SEP_BUFFER];
+    }
 
     // reset map
     map.reset(width, height, food_mode);
@@ -390,7 +403,7 @@ void GridWorld::set_action(GroupHandle group, const int *actions) {
     std::vector<Agent*> &agents = groups[group].get_agents();
     const AgentType &type = groups[group].get_type();
     // action space layout : move turn attack ...
-    const int bandwidth = (width + NUM_MOVE_BUFFER - 1) / NUM_MOVE_BUFFER;
+    const int bandwidth = (width + NUM_SEP_BUFFER - 1) / NUM_SEP_BUFFER;
 
     size_t agent_size = agents.size();
 
@@ -403,7 +416,7 @@ void GridWorld::set_action(GroupHandle group, const int *actions) {
             if (act < type.turn_base) {          // move
                 int x = agent->get_pos().x;
                 int x_ = x % bandwidth;
-                if (x_ < 3 || x_ > bandwidth - 3) {
+                if (x_ < 4 || x_ > bandwidth - 4) {
                     move_buffer_bound.push_back(MoveAction{agent, act - type.move_base});
                 } else {
                     int to = agent->get_pos().x / bandwidth;
@@ -412,7 +425,7 @@ void GridWorld::set_action(GroupHandle group, const int *actions) {
             } else if (act < type.attack_base) { // turn
                 int x = agent->get_pos().x;
                 int x_ = x % bandwidth;
-                if (x_ < 3 || x_ > bandwidth - 3) {
+                if (x_ < 4 || x_ > bandwidth - 4) {
                     turn_buffer_bound.push_back(TurnAction{agent, act - type.move_base});
                 } else {
                     int to = agent->get_pos().x / bandwidth;
@@ -502,7 +515,8 @@ void GridWorld::step(int *done) {
         }
     }
 
-    // starve*LOG(TRACE) << "starve.  ";
+    // starve
+    LOG(TRACE) << "starve.  ";
     for (int i = 0; i < group_size; i++) {
         Group &group = groups[i];
         std::vector<Agent*> &agents = group.get_agents();
@@ -547,7 +561,7 @@ void GridWorld::step(int *done) {
         if (large_map_mode) {
             LOG(TRACE) << "turn parallel.  ";
             #pragma omp parallel for
-            for (int i = 0; i < NUM_TURN_BUFFER; i++) {        // turn in separate areas, do them in parallel
+            for (int i = 0; i < NUM_SEP_BUFFER; i++) {        // turn in separate areas, do them in parallel
                 do_turn_for_a_buffer(turn_buffers[i], map);
             }
         }
@@ -590,7 +604,7 @@ void GridWorld::step(int *done) {
     if (large_map_mode) {
         LOG(TRACE) << "move parallel.  ";
         #pragma omp parallel for
-        for (int i = 0; i < NUM_MOVE_BUFFER; i++) {    // move in separate areas, do them in parallel
+        for (int i = 0; i < NUM_SEP_BUFFER; i++) {    // move in separate areas, do them in parallel
             do_move_for_a_buffer(move_buffers[i], map);
         }
     }
```

**File**: `src/gridworld/GridWorld.h` (modified, +4/-5)
```diff
@@ -112,11 +112,10 @@ class GridWorld: public Environment {
 
     // action buffer
     std::vector<AttackAction> attack_buffer;
-    // split the events to 3 regions and boundary for parallel
-    static const int NUM_MOVE_BUFFER = 16;
-    std::vector<MoveAction> move_buffers[NUM_MOVE_BUFFER], move_buffer_bound;
-    static const int NUM_TURN_BUFFER = 16;
-    std::vector<TurnAction> turn_buffers[NUM_TURN_BUFFER], turn_buffer_bound;
+    // split the events to small regions and boundary for parallel
+    int NUM_SEP_BUFFER;
+    std::vector<MoveAction> *move_buffers, move_buffer_bound;
+    std::vector<TurnAction> *turn_buffers, turn_buffer_bound;
 
     // render
     RenderGenerator render_generator;
```

---

### Incident Patch 5: `b98b1b01` (2017-12-07)
**Commit Message**: Merge pull request #7 from sincatter/fixbug-cmakeMac-20171206

add include and library folder on Mac

**File**: `CMakeLists.txt` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ project(magent)
 IF (APPLE)
     set(CMAKE_CXX_COMPILER "/usr/local/opt/llvm/bin/clang++")
     link_directories("/usr/local/opt/llvm/lib")
+    include_directories( "/usr/local/include" )
+    link_directories("/usr/local/lib/")
 ENDIF()
 
 file(GLOB autopilot_sources src/*.cc src/gridworld/*.cc src/discrete_snake/*.cc src/utility/*.cc)
```

**File**: `build.sh` (modified, +8/-1)
```diff
@@ -8,4 +8,11 @@ fi
 mkdir -p build
 cd build
 cmake ..
-make -j $(nproc)
+#make -j $(nproc)
+if [[ "$OSTYPE" == "linux-gnu" ]]; then
+    # Linux
+    make -j `nproc`
+elif [[ "$OSTYPE" == "darwin"* ]]; then
+    # Mac OSX
+    make -j `sysctl -n hw.ncpu`
+fi
```

---

### Incident Patch 6: `9f8cd245` (2017-12-06)
**Commit Message**: Render has been modified to be compatible with python3, fixing the issue #6.

**File**: `python/magent/renderer/pygame_renderer.py` (modified, +6/-5)
```diff
@@ -43,14 +43,15 @@ def start(
         def draw_line(surface, color, a, b):
             pygame.draw.line(
                 surface, color,
-                map(int, (round(a[0]), round(a[1]))),
-                map(int, (round(b[0]), round(b[1])))
+                (int(round(a[0])), int(round(a[1]))),
+                (int(round(b[0])), int(round(b[1])))
             )
 
         def draw_rect(surface, color, a, w, h):
-            pygame.draw.rect(surface, color, pygame.Rect(
-                map(int, (round(a[0]), round(a[1]), round(w + a[0] - round(a[0])), round(h + a[1] - round(a[1]))))
-            ))
+            pygame.draw.rect(surface, color, pygame.Rect(*map(int, (
+                round(a[0]), round(a[1]),
+                round(w + a[0] - round(a[0])),
+                round(h + a[1] - round(a[1]))))))
             
         def draw_rect_matrix(matrix, color, a, w, h, resolution):
             x, y, w, h = map(int, (round(a[0]), round(a[1]), round(w + a[0] - round(a[0])), round(h + a[1] - round(a[1]))))
```

---

### Incident Patch 7: `93f95506` (2017-12-06)
**Commit Message**: Fix import error for python3 #4

**File**: `python/magent/renderer/__init__.py` (modified, +2/-2)
```diff
@@ -1,2 +1,2 @@
-from base_renderer import BaseRenderer
-from pygame_renderer import PyGameRenderer
\ No newline at end of file
+from .base_renderer import BaseRenderer
+from .pygame_renderer import PyGameRenderer
```

---

### Incident Patch 8: `343ca5d7` (2017-12-03)
**Commit Message**: fix bug in mxdqn

**File**: `examples/train_against.py` (modified, +2/-2)
```diff
@@ -176,7 +176,6 @@ def play_a_round(env, map_size, handles, models, print_every, eps, step_batch_si
     unroll_step = 16
     train_freq = 5
 
-
     models = []
 
     # load opponent
@@ -227,7 +226,8 @@ def play_a_round(env, map_size, handles, models, print_every, eps, step_batch_si
     start = time.time()
     for k in range(start_from, start_from + args.n_round):
         tic = time.time()
-        train_eps = magent.utility.piecewise_decay(k, [0, 100, 250], [1, 0.1, 0.05]) if not args.greedy else 0
+        start = 1 if args.opponent != -1 else 0.1
+        train_eps = magent.utility.piecewise_decay(k, [0, 100, 250], [start, 0.1, 0.05]) if not args.greedy else 0
         opponent_eps = train_eps if k < 0 else 0.05  # can use curriculum learning in first 100 steps
 
         loss, num, reward, value = play_a_round(env, args.map_size, handles, models,
```

**File**: `python/magent/builtin/mx_model/dqn.py` (modified, +3/-5)
```diff
@@ -86,10 +86,8 @@ def __init__(self, env, handle, name,
         self.qvalues = self._create_network(self.input_view, self.input_feature)
         self.gamma = reward_decay
         self.action_onehot = mx.sym.one_hot(self.action, depth=self.num_actions)
-        self.loss = mx.sym.sum(
-            mx.sym.square(
-                self.target - mx.sym.sum(self.qvalues * self.action_onehot, axis=1)
-            )) / mx.sym.sum(self.mask)
+        td_error = mx.sym.square(self.target - mx.sym.sum(self.qvalues * self.action_onehot, axis=1))
+        self.loss = mx.sym.sum(td_error * self.mask) / mx.sym.sum(self.mask)
         self.loss = mx.sym.MakeLoss(data=self.loss)
 
         self.out_qvalues = mx.sym.BlockGrad(self.qvalues)
@@ -334,8 +332,8 @@ def train(self, sample_buffer, print_every=1000):
                                            mx.nd.array(batch_mask)])
             self.model.forward(batch, is_train=True)
             self.model.backward()
-            loss = np.mean(self.model.get_outputs()[1].asnumpy())
             self.model.update()
+            loss = np.mean(self.model.get_outputs()[1].asnumpy())
             total_loss += loss
 
             if ct % self.target_update == 0:
```

---

### Incident Patch 9: `e513b41c` (2017-12-02)
**Commit Message**: Removed debug messages.

**File**: `python/magent/renderer/pygame_renderer.py` (modified, +0/-4)
```diff
@@ -181,18 +181,14 @@ def draw_line_matrix(matrix, color, a, b, resolution):
             if pressed[pygame.K_LEFT]:
                 view_position[0] -= move_rate * grid_size
                 need_static_update = True
-                print("left")
             if pressed[pygame.K_RIGHT]:
                 view_position[0] += move_rate * grid_size
                 need_static_update = True
-                print("right")
             if pressed[pygame.K_UP]:
                 view_position[1] -= move_rate * grid_size
                 need_static_update = True
-                print("up")
             if pressed[pygame.K_DOWN]:
                 view_position[1] += move_rate * grid_size
-                print("down")
                 need_static_update = True
 
             if done:
```

---

### Incident Patch 10: `79274991` (2017-12-02)
**Commit Message**: fix bug: ignored import random

**File**: `python/magent/renderer/server/arrange_server.py` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import time
 
 import numpy as np
-
+import random
 import magent
 from magent.builtin.tf_model import DeepQNetwork
 from magent.renderer.server import BaseServer
```

#### Recent Merged Pull Requests:
- **PR #96** (2022-10-22): Update readme link (@jkterry1)
- **PR #91** (2022-04-04): Update link to maintained fork (@jkterry1)
- **PR #79** (2020-05-28): Mention maintained fork in readme (@jkterry1)
- **PR #40** (2018-09-25): Fix a bug (@TimerChen)
- **PR #20** (2018-05-20): tutorial for many kinds of agents (@bywbilly)
- **PR #12** (2017-12-20): update repo link (@passionke)
- **PR #10** (closed): Loop gifs (@ColCarroll)
- **PR #7** (2017-12-07): add include and library folder on Mac (@sincatter)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
