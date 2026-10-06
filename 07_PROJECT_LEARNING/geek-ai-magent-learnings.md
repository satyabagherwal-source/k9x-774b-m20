# Forensic Learning Record (Deep Inspection): geek-ai/MAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/geek-ai-magent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/geek-ai/MAgent](https://github.com/geek-ai/MAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:23.868Z  
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

### Core Architecture Module: `python/magent/renderer/__init__.py`
```
from .base_renderer import BaseRenderer
from .pygame_renderer import PyGameRenderer

```

### Core Architecture Module: `python/magent/renderer/base_renderer.py`
```
from abc import ABCMeta, abstractmethod


class BaseRenderer:
    __metaclass__ = ABCMeta

    def __init__(self):
        pass

    @abstractmethod
    def start(self, *args, **kwargs):
        pass

```

### Core Architecture Module: `python/magent/renderer/pygame_renderer.py`
```
from __future__ import absolute_import
from __future__ import division

import math

import pygame
import numpy as np

from magent.renderer.base_renderer import BaseRenderer
from magent.renderer.server import BaseServer


class PyGameRenderer(BaseRenderer):
    def __init__(self):
        super(PyGameRenderer, self).__init__()

    def start(
            self,
            server,
            animation_total=2,
            animation_stop=0,
            resolution=None,
            fps_soft_bound=60,
            background_rgb=(255, 255, 255),
            attack_line_rgb=(0, 0, 0),
            attack_dot_rgb=(0, 0, 0),
            attack_dot_size=0.3,
            text_rgb=(0, 0, 0),
            text_size=16,
            text_spacing=3,
            banner_size=32,
            banner_spacing=3,
            bigscreen_size=72,
            bigscreen_spacing=0,
            grid_rgba=(pygame.Color(0, 0, 0), 30),
            grid_size=7.5,
            grid_min_size=2,
            grid_max_size=100,
            zoom_rate=1 / 30,
            move_rate=4,
            full_screen=False
    ):
        def draw_line(surface, color, a, b):
            pygame.draw.line(
                surface, color,
                (int(round(a[0])), int(round(a[1]))),
                (int(round(b[0])), int(round(b[1])))
            )

        def draw_rect(surface, color, a, w, h):
            pygame.draw.rect(surface, color, pygame.Rect(*map(int, (
                round(a[0]), round(a[1]),
                round(w + a[0] - round(a[0])),
                round(h + a[1] - round(a[1]))))))
            
        def draw_rect_matrix(matrix, color, a, w, h, resolution):
            x, y, w, h = map(int, (round(a[0]), round(a[1]), round(w + a[0] - round(a[0])), round(h + a[1] - round(a[1]))))
            matrix[max(x, 0):min(x + w, resolution[0]), max(y, 0):min(h + y, resolution[1]), :] = color
                    
        def draw_line_matrix(matrix, color, a, b, resolution):
            a = (min(max(0, a[0]), resolution[0] - 1), min(max(0, a[1]), resolution[1] - 1))
            b = (min(max(0, b[0]), resolution[0] - 1), min(max(0, b[1]), resolution[1] - 1))
            a = map(int, (round(a[0]), round(a[1])))
            b = map(int, (round(b[0]), round(b[1])))
            if a[0] == b[0]:
                if a[1] > b[1]:
                    matrix[a[0], b[1]:a[1] + 1] = color
                else:
                    matrix[a[0], a[1]:b[1] + 1] = color
            elif a[1] == b[1]:
                if a[0] > b[0]:
                    matrix[b[0]:a[0] + 1, a[1]] = color
                else:
                    matrix[a[0]:b[0] + 1, a[1]] = color
            else:
                raise NotImplementedError

        if not isinstance(server, BaseServer):
            raise BaseException('property server must be an instance of BaseServer')

        pygame.init()
        pygame.display.init()

        if resolution is None:
            info = pygame.display.Info()
            resolution = info.current_w, info.current_h

        clock = pygame.time.Clock()
        
        if full_screen:
            canvas = pygame.display.set_mode(resolution, pygame.DOUBLEBUF | pygame.FULLSCREEN, 0)
        else:
            canvas = pygame.display.set_mode(resolution, pygame.DOUBLEBUF, 0)

        pygame.display.set_caption('MAgent Renderer Window')
        text_formatter = pygame.font.SysFont(None, text_size, True)
        banner_formatter = pygame.font.SysFont(None, banner_size, True)
        bigscreen_formatter = pygame.font.SysFont(None, bigscreen_size, True)

        map_size, groups, static_info = server.get_info()
        view_position = [map_size[0] / 2 * grid_size - resolution[0] / 2, 
                         map_size[1] / 2 * grid_size - resolution[1] / 2]
        frame_id = 0

        walls  = static_info['wall']

        old_data = None
        new_data = None

        need_static_update = True
        #show_grid = False
        animation_progress = 0
        
        grid_map = np.zeros((resolution[0], resolution[1], 3), dtype=np.int16)

        while True:
            done = False
            status = server.get_status(frame_id)
            triggered = False
            # calculate the relative moues coordinates in the gridworld
            mouse_x, mouse_y = pygame.mouse.get_pos()
            mouse_x = int((mouse_x + view_position[0]) / grid_size)
            mouse_y = int((mouse_y + view_position[1]) / grid_size)
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    done = True
                elif event.type == pygame.KEYDOWN:
                    #if event.key == pygame.K_g:
                    #    show_grid = not show_grid
                    #else:
                    #    triggered = server.keydown(frame_id, event.key, mouse_x, mouse_y)
                    triggered = server.keydown(frame_id, event.key, mouse_x, mouse_y)
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    if event.button == 4 or event.button == 5:
                        center_before = (
                            (view_position[0] + resolution[0] / 2) / grid_size,
                            (view_position[1] + resolution[1] / 2) / grid_size
                        )
                        if event.button == 5:
                            grid_size = max(grid_size - grid_size * zoom_rate, grid_min_size)
                            need_static_update = True
                        else:
                            grid_size = min(grid_size + grid_size * zoom_rate, grid_max_size)
                            need_static_update = True
                        center_after = (
                            (view_position[0] + resolution[0] / 2) / grid_size,
                            (view_position[1] + resolution[1] / 2) / grid_size
                        )
                        view_position[0] += (center_before[0] - center_after[0]) * grid_size
                        view_position[1] += (center_before[1] - center_after[1]) * grid_size
                    else:
                        triggered = server.mousedown(frame_id, pygame.mouse.get_pressed(), mouse_x, mouse_y)

            pressed = pygame.key.get_pressed()
            if pressed[pygame.K_ESCAPE]:
                pygame.quit()
                done = True

            if pressed[pygame.K_COMMA] or pressed[pygame.K_PERIOD]:
                # center before means the center before zoom operation
                # center after means the center after zoom operation
                # we need to keep that the above two are consistent during zoom operation
                # and hence we need to adjust view_position simultaneously
                center_before = (
                    (view_position[0] + resolution[0] / 2) / grid_size,
                    (view_position[1] + resolution[1] / 2) / grid_size
                )
                if pressed[pygame.K_COMMA]:
                    grid_size = max(grid_size - grid_size * zoom_rate, grid_min_size)
                    need_static_update = True
                else:
                    grid_size = min(grid_size + grid_size * zoom_rate, grid_max_size)
                    need_static_update = True
                center_after = (
                    (view_position[0] + resolution[0] / 2) / grid_size,
                    (view_position[1] + resolution[1] / 2) / grid_size
                )
                view_position[0] += (center_before[0] - center_after[0]) * grid_size
                view_position[1] += (center_before[1] - center_after[1]) * grid_size

            if pressed[pygame.K_LEFT]:
                view_position[0] -= move_rate * grid_size
                need_static_update = True
            if pressed[pygame.K_RIGHT]:
                view_position[0] += move_rate * grid_size
                need_static_update = True
            if pressed[pygame.K_UP]:
                view_position[1] -= move_rate * grid_size
                need_static_update = True
            if pressed[pygame.K_DOWN]:
                view_position[1] += move_rate * grid_size
                need_static_update = True

            if done:
                break

            # x_range: which vertical gridlines should be shown on the display
            # y_range: which horizontal gridlines should be shown on the display
            x_range = (
                max(0, int(math.floor(max(0, view_position[0]) / grid_size))),
                min(map_size[0], int(math.ceil(max(0, view_position[0] + resolution[0]) / grid_size)))
            )

            y_range = (
                max(0, int(math.floor(max(0, view_position[1]) / grid_size))),
                min(map_size[1], int(math.ceil(max(0, view_position[1] + resolution[1]) / grid_size)))
            )

            canvas.fill(background_rgb)

            #if show_grid:
            #    if need_static_update or True:
            #        grids = pygame.Surface(resolution)
            #        grids.set_alpha(grid_rgba[1])
            #        grids.fill(background_rgb)
            #
            #        for i in range(x_range[0], x_range[1] + 1):
            #            draw_line(
            #                canvas, grid_rgba[0],
            #                (i * grid_size - view_position[0], max(0, view_position[1]) - view_position[1]),
            #                (
            #                    i * grid_size - view_position[0],
            #                    min(view_position[1] + resolution[1], map_size[1] * grid_size) - view_position[1]
            #                )
            #            )
            #        for i in range(y_range[0], y_range[1] + 1):
            #            draw_line(
            #                canvas, grid_rgba[0],
            #                (max(0, view_position[0]) - view_position[0], i * grid_size - view_position[1]),
            #                (
            #                    min(view
```

### Core Architecture Module: `python/magent/renderer/server/__init__.py`
```
from .base_server import BaseServer
from .sample_server import SampleServer
from .random_server import RandomServer
from .battle_server import BattleServer
from .arrange_server import ArrangeServer

```

### Core Architecture Module: `python/magent/renderer/server/arrange_server.py`
```
import time

import numpy as np
import random
import magent
from magent.builtin.tf_model import DeepQNetwork
from magent.renderer.server import BaseServer
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
         'damage': 2, 'step_recover': -10.0/400,

         'step_reward': 0,
         })

    g_goal = cfg.add_group(goal)
    g_agent = cfg.add_group(agent)

    g = gw.AgentSymbol(g_goal, 'any')
    a = gw.AgentSymbol(g_agent, 'any')

    cfg.add_reward_rule(gw.Event(a, 'collide', g), receiver=a, value=10)

    return cfg


def generate_map(mode, env, map_size, goal_handle, handles, messages, font):
    # pre-process message
    max_len = 8
    new = []
    for msg in messages:
        if len(msg) > max_len:
            for i in range(0, len(msg), max_len):
                new.append(msg[i:i+max_len])
        else:
            new.append(msg)
    messages = new

    center_x, center_y = map_size // 2, map_size // 2

    # create maze
    if mode == 1:
        radius = 90
        pos_list = create_maze([center_x - radius, center_y - radius], radius + 1, 15, 2, font_area=[radius * 2 - 28, radius * 2 - 28])
        env.add_walls(method="custom", pos=pos_list)

    def add_square(pos, side, gap):
        side = int(side)
        for x in range(center_x - side//2, center_x + side//2 + 1, gap):
            pos.append([x, center_y - side//2])
            pos.append([x, center_y + side//2])
        for y in range(center_y - side//2, center_y + side//2 + 1, gap):
            pos.append([center_x - side//2, y])
            pos.append([center_x + side//2, y])

    def draw(base_x, base_y, scale, data):
        w, h = len(data), len(data[0])
        pos = []
        for i in range(w):
            for j in range(h):
                if data[i][j] == 1:
                    start_x = i * scale + base_y
                    start_y = j * scale + base_x
                    for x in range(start_x, start_x + scale):
                        for y in range(start_y, start_y + scale):
                            pos.append([y, x])

        env.add_agents(goal_handle, method="custom", pos=pos)

    base_y = (map_size - len(messages) * font.height) // 2
    for message in messages:
        base_x = (map_size - len(message) * font.width) // 2
        scale = 1
        for x in message:
            data = font.get(x)
            draw(base_x, base_y, scale, data)
            base_x += font.width
        base_y += font.height + 1

    alpha_goal_num = env.get_num(goal_handle)

    # agent
    pos = []

    add_square(pos, map_size * 0.95, 1)
    add_square(pos, map_size * 0.90, 1)
    add_square(pos, map_size * 0.85, 1)
    add_square(pos, map_size * 0.80, 1)

    pos = np.array(pos)
    pos = pos[np.random.choice(np.arange(len(pos)), int(alpha_goal_num * 1.6), replace=False)]

    env.add_agents(handles[0], method="custom", pos=pos)


class ArrangeServer(BaseServer):
    def get_banners(self, frame_id, resolution):
        return []

    def keydown(self, frame_id, key, mouse_x, mouse_y):
        return False

    def get_status(self, frame_id):
        if self.done:
            return None
        else:
            return True

    def get_endscreen(self, frame_id):
        return []

    def mousedown(self, frame_id, key, mouse_x, mouse_y):
        return False

    def get_info(self):
        ret = self.env._get_groups_info()
        ret[1] = ret[0]
        return (self.map_size, self.map_size), ret, {'wall': self.env._get_walls_info()}

    def __init__(self, path="data/arrange_model", messages=None, mode=1):
        # some parameter
        map_size = 250
        eps = 0.15

        # init the game
        env = magent.GridWorld(load_config(map_size))
        font = FontProvider('data/font_8x8/basic.txt')

        handles = env.get_handles()
        food_handle, handles = handles[0], handles[1:]
        models = []
        models.append(DeepQNetwork(env, handles[0], 'arrange', use_conv=True))

        # load model
        models[0].load(path, 10)

        # init environment
        env.reset()
        generate_map(mode, env, map_size, food_handle, handles, messages, font)

        # save to member variable
        self.env = env
        self.food_handle = food_handle
        self.handles = handles
        self.eps = eps
        self.models = models
        self.done = False
        self.map_size = map_size
        self.new_rule_ct = 0
        self.pos_
```

### Core Architecture Module: `python/magent/renderer/server/base_server.py`
```
from abc import ABCMeta, abstractmethod


class BaseServer:
    __metaclass__ = ABCMeta

    @abstractmethod
    def get_info(self):
        pass

    @abstractmethod
    def get_data(self, frame_id, x_range, y_range):
        pass

    @abstractmethod
    def add_agents(self, x, y, g):
        pass
        
    @abstractmethod
    def get_map_size(self):
        pass

    @abstractmethod
    def get_banners(self, frame_id, resolution):
        pass

    @abstractmethod
    def get_status(self, frame_id):
        pass

    @abstractmethod
    def keydown(self, frame_id, key, mouse_x, mouse_y):
        pass

    @abstractmethod
    def mousedown(self, frame_id, key, mouse_x, mouse_y):
        pass

    @abstractmethod
    def get_endscreen(self, frame_id):
        pass
```

### Core Architecture Module: `python/magent/renderer/server/battle_server.py`
```
import math
import time

import matplotlib.pyplot as plt
import numpy as np

import magent
from magent.builtin.tf_model import DeepQNetwork
from magent.renderer.server import BaseServer


def load_config(map_size):
    gw = magent.gridworld
    cfg = gw.Config()

    cfg.set({"map_width": map_size, "map_height": map_size})
    cfg.set({"minimap_mode": True})

    cfg.set({"embedding_size": 10})

    small = cfg.register_agent_type(
        "small",
        {'width': 1, 'length': 1, 'hp': 10, 'speed': 2,
         'view_range': gw.CircleRange(6), 'attack_range': gw.CircleRange(1.5),
         'damage': 2, 'step_recover': 0.1,
         'step_reward': -0.001, 'kill_reward': 100, 'dead_penalty': -0.05, 'attack_penalty': -1,
         })

    g0 = cfg.add_group(small)
    g1 = cfg.add_group(small)

    a = gw.AgentSymbol(g0, index='any')
    b = gw.AgentSymbol(g1, index='any')

    cfg.add_reward_rule(gw.Event(a, 'attack', b), receiver=a, value=2)
    cfg.add_reward_rule(gw.Event(b, 'attack', a), receiver=b, value=2)

    return cfg


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
    for x in range(width // 2 - gap - side, width // 2 - gap - side + side, 2):
        for y in range((height - side) // 2, (height - side) // 2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[leftID], method="custom", pos=pos)

    # right
    n = init_num
    side = int(math.sqrt(n)) * 2
    pos = []
    for x in range(width // 2 + gap, width // 2 + gap + side, 2):
        for y in range((height - side) // 2, (height - side) // 2 + side, 2):
            pos.append([x, y, 0])
    env.add_agents(handles[rightID], method="custom", pos=pos)


class BattleServer(BaseServer):
    def __init__(self, path="data/battle_model", total_step=1000, add_counter=10, add_interval=50):
        # some parameter
        map_size = 125
        eps = 0.05

        # init the game
        env = magent.GridWorld(load_config(map_size))

        handles = env.get_handles()
        models = []
        models.append(DeepQNetwork(env, handles[0], 'trusty-battle-game-l', use_conv=True))
        models.append(DeepQNetwork(env, handles[1], 'trusty-battle-game-r', use_conv=True))

        # load model
        models[0].load(path, 0, 'trusty-battle-game-l')
        models[1].load(path, 0, 'trusty-battle-game-r')

        # init environment
        env.reset()
        generate_map(env, map_size, handles)

        # save to member variable
        self.env = env
        self.handles = handles
        self.eps = eps
        self.models = models
        self.map_size = map_size
        self.total_step = total_step
        self.add_interval = add_interval
        self.add_counter = add_counter
        self.done = False
        print(env.get_view2attack(handles[0]))
        plt.show()

    def get_info(self):
        return (self.map_size, self.map_size), self.env._get_groups_info(), {'wall': self.env._get_walls_info()}

    def step(self):
        handles = self.handles
        models = self.models
        env = self.env

        obs = [env.get_observation(handle) for handle in handles]
        ids = [env.get_agent_id(handle) for handle in handles]

        counter = []
        for i in range(len(handles)):
            acts = models[i].infer_action(obs[i], ids[i], 'e_greedy', eps=self.eps)
            env.set_action(handles[i], acts)
            counter.append(np.zeros(shape=env.get_action_space(handles[i])))
            for j in acts:
                counter[-1][j] += 1
        # plt.clf()
        # for c in counter:
        #    plt.bar(range(len(c)), c / np.sum(c))
        # plt.draw()
        # plt.pause(1e-8)

        # code for checking the correctness of observation
        # for channel in range(7):
        #     x = magent.round(list(obs[1][0][0][:,:,channel]), 2)
        #     for row in x:
        #         print row
        #     print("-------------")
        # input()

        done = env.step()
        env.clear_dead()

        return done

    def get_data(self, frame_id, x_range, y_range):
        start = time.time()
        if self.done:
            return None
        self.done = self.step()
        pos, event = self.env._get_render_info(x_range, y_range)
        print(" fps ", 1 / (time.time() - start))
        return pos, event

    def add_agents(self, x, y, g):
        pos = []
        for i in range(-5, 5):
            for j in range(-5, 5):
                pos.append((x + i, y + j))
        self.env.add_agents(self.handles[g], method="custom", pos=pos)

        pos = []
        x = np.random.randint(0, self.map_size - 1)
        y = np.random.randint(0, self.map_size - 1)
        for i in range(-5, 5):
            for j in range(-5, 6):
                pos.append((x + i, y + j))
        self.env.add_agents(self.handles[g ^ 1], method="custom", pos=pos)

    def get_map_size(self):
        return self.map_size, self.map_size

    def get_banners(self, frame_id, resolution):
        red = '{}'.format(self.env.get_num(self.handles[0])), (200, 0, 0)
        vs = ' vs ', (0, 0, 0)
        blue = '{}'.format(self.env.get_num(self.handles[1])), (0, 0, 200)
        result = [(red, vs, blue)]

        tmp = '{} chance(s) remained'.format(
            max(0, self.add_counter)), (0, 0, 0)
        result.append((tmp,))

        tmp = '{} / {} steps'.format(frame_id, self.total_step), (0, 0, 0)
        result.append((tmp,))
        if frame_id % self.add_interval == 0 and frame_id < self.total_step and self.add_counter > 0:
            tmp = 'Please press your left mouse button to add agents', (0, 0, 0)
            result.append((tmp,))
        return result

    def get_status(self, frame_id):
        if frame_id % self.add_interval == 0 and self.add_counter > 0:
            return False
        elif frame_id >= self.total_step or self.done:
            return None
        else:
            return True

    def keydown(self, frame_id, key, mouse_x, mouse_y):
        return False

    def mousedown(self, frame_id, pressed, mouse_x, mouse_y):
        if frame_id % self.add_interval == 0 and frame_id < self.total_step and pressed[0] \
                and self.add_counter > 0 and not self.done:
            self.add_counter -= 1
            pos = []
            for i in range(-5, 5):
                for j in range(-5, 5):
                    pos.append((mouse_x + i, mouse_y + j))
            self.env.add_agents(self.handles[0], method="custom", pos=pos)

            pos = []
            x = np.random.randint(0, self.map_size - 1)
            y = np.random.randint(0, self.map_size - 1)
            for i in range(-5, 6):
                for j in range(-5, 5):
                    pos.append((x + i, y + j))
            self.env.add_agents(self.handles[1], method="custom", pos=pos)
            return True
        return False

    def get_endscreen(self, frame_id):
        if frame_id == self.total_step or self.done:
            if self.env.get_num(self.handles[0]) > self.env.get_num(self.handles[1]):
                return [(("You", (200, 0, 0)), (" win! :)", (0, 0, 0)))]
            else:
                return [(("You", (200, 0, 0)), (" lose. :(", (0, 0, 0)))]
        else:
            return []

```

### Core Architecture Module: `python/magent/renderer/server/random_server.py`
```
import random

from .base_server import BaseServer


class RandomServer(BaseServer):
    def __init__(self, agent_number=1000, group_number=20, map_size=100, shape_range=3, speed=5, event_range=100):
        self._data = {}
        self._map_size = map_size
        self._number = agent_number
        for i in range(agent_number):
            self._data.setdefault(i, [
                random.randint(0, map_size - 1),
                random.randint(0, map_size - 1),
                random.randint(0, group_number - 1)
            ])
        self._group = []
        for i in range(group_number):
            self._group.append([
                random.randint(1, shape_range),
                random.randint(1, shape_range),
                random.randint(0, 255),
                random.randint(0, 255),
                random.randint(0, 255)
            ])
        self._speed = speed
        self._event_range = event_range
        self._map_size = map_size

    def get_group_info(self):
        return self._group

    def get_static_info(self):
        return {"wall": []}

    def get_data(self, frame_id, x_range, y_range):
        result = {}
        event = []
        for i in self._data:
            olddata = self._data[i]
            data = [0, 0, 0]
            data[0] = olddata[0] + random.randint(-self._speed, self._speed)
            data[1] = olddata[1] + random.randint(-self._speed, self._speed)
            data[0] = min(max(data[0], 0), self._map_size - 1)
            data[1] = min(max(data[1], 0), self._map_size - 1)
            data[2] = olddata[2]
            self._data[i] = data
            if (x_range[0] <= data[0] <= x_range[1] and y_range[0] <= data[1] <= y_range[1]) or \
                    (x_range[0] <= olddata[0] <= x_range[1] and y_range[0] <= olddata[1] <= y_range[1]):
                result.setdefault(i, olddata)
        event_number = random.randint(0, self._event_range)
        for i in range(event_number):
            agent_id, _ = random.choice(self._data.items())
            event.append(
                (
                    agent_id,
                    random.randint(0, self._map_size - 1),
                    random.randint(0, self._map_size - 1)
                )
            )
        return result, event

    def add_agents(self, x, y, g):
        self._data.setdefault(self._number, (x, y, g))
        self._number += 1
        
    def get_map_size(self):
        return self._map_size, self._map_size


```

### Core Architecture Module: `python/magent/renderer/server/sample_server.py`
```
from .base_server import BaseServer


class SampleServer(BaseServer):
    def get_group_info(self):
        return [[1, 1, 0, 0, 0]]

    def get_static_info(self):
        return {"walls": []}

    def get_data(self, frame_id, x_range, y_range):
        if frame_id == 0:
            return {1: [10, 10, 0]}, [(1, 0, 0)]
        elif frame_id == 1:
            return {1: [9, 10, 0]}, [(1, 0, 0)]
        elif frame_id == 2:
            return {1: [8, 10, 0]}, [(1, 0, 0)]
        elif frame_id == 3:
            return {1: [14, 12, 0]}, [(1, 0, 0)]
        else:
            return {1: [10, 10, 0]}, [(1, 0, 0)]

    def add_agents(self, x, y, g):
        pass

    def get_map_size(self):
        return [50, 50]

```

### Core Architecture Module: `python/magent/utility.py`
```
""" some utilities """

import math
import collections
import platform

import numpy as np
import logging
import collections
import os

from magent.builtin.rule_model import RandomActor


class EpisodesBufferEntry:
    """Entry for episode buffer"""
    def __init__(self):
        self.views = []
        self.features = []
        self.actions = []
        self.rewards = []
        self.terminal = False

    def append(self, view, feature, action, reward, alive):
        self.views.append(view.copy())
        self.features.append(feature.copy())
        self.actions.append(action)
        self.rewards.append(reward)
        if not alive:
            self.terminal = True


class EpisodesBuffer:
    """Replay buffer to store a whole episode for all agents
       one entry for one agent
    """
    def __init__(self, capacity):
        self.buffer = {}
        self.capacity = capacity
        self.is_full = False

    def record_step(self, ids, obs, acts, rewards, alives):
        """record transitions (s, a, r, terminal) in a step"""
        buffer = self.buffer
        index = np.random.permutation(len(ids))

        if self.is_full:  # extract loop invariant in else part
            for i in range(len(ids)):
                entry = buffer.get(ids[i])
                if entry is None:
                    continue
                entry.append(obs[0][i], obs[1][i], acts[i], rewards[i], alives[i])
        else:
            for i in range(len(ids)):
                i = index[i]
                entry = buffer.get(ids[i])
                if entry is None:
                    if self.is_full:
                        continue
                    else:
                        entry = EpisodesBufferEntry()
                        buffer[ids[i]] = entry
                        if len(buffer) >= self.capacity:
                            self.is_full = True

                entry.append(obs[0][i], obs[1][i], acts[i], rewards[i], alives[i])

    def reset(self):
        """ clear replay buffer """
        self.buffer = {}
        self.is_full = False

    def episodes(self):
        """ get episodes """
        return self.buffer.values()


# decay schedulers
def exponential_decay(now_step, total_step, final_value, rate):
    """exponential decay scheduler"""
    decay = math.exp(math.log(final_value)/total_step ** rate)
    return max(final_value, 1 * decay ** (now_step ** rate))


def linear_decay(now_step, total_step, final_value):
    """linear decay scheduler"""
    decay = (1 - final_value) / total_step
    return max(final_value, 1 - decay * now_step)


def piecewise_decay(now_step, anchor, anchor_value):
    """piecewise linear decay scheduler

    Parameters
    ---------
    now_step : int
        current step
    anchor : list of integer
        step anchor
    anchor_value: list of float
        value at corresponding anchor
    """
    i = 0
    while i < len(anchor) and now_step >= anchor[i]:
        i += 1

    if i == len(anchor):
        return anchor_value[-1]
    else:
        return anchor_value[i-1] + (now_step - anchor[i-1]) * \
                                   ((anchor_value[i] - anchor_value[i-1]) / (anchor[i] - anchor[i-1]))


# eval observation set generator
def sample_observation(env, handles, n_obs=-1, step=-1):
    """Sample observations by random actors.
    These samples can be used for evaluation

    Parameters
    ----------
    env : environment
    handles: list of handle
    n_obs : int
        number of observation
    step : int
        maximum step

    Returns
    -------
    ret : list of raw observation
        raw observation for every group
        the format of raw observation is tuple(view, feature)
    """
    models = [RandomActor(env, handle) for handle in handles]

    n = len(handles)
    views = [[] for _ in range(n)]
    features = [[] for _ in range(n)]

    done = False
    step_ct = 0
    while not done:
        obs = [env.get_observation(handle) for handle in handles]
        ids = [env.get_agent_id(handle) for handle in handles]

        for i in range(n):
            act = models[i].infer_action(obs[i], ids[i])
            env.set_action(handles[i], act)

        done = env.step()
        env.clear_dead()

        # record steps
        for i in range(n):
            views[i].append(obs[i][0])
            features[i].append(features[i][1])

        if step != -1 and step_ct > step:
            break

        if step_ct % 100 == 0:
            print("sample step %d" % step_ct)

        step_ct += 1

    for i in range(n):
        views[i] = np.array(views[i], dtype=np.float32).reshape((-1,) +
                            env.get_view_space(handles[i]))
        features[i] = np.array(features[i], dtype=np.float32).reshape((-1,) +
                               env.get_feature_space(handles[i]))

    if n_obs != -1:
        for i in range(n):
            views[i] = views[i][np.random.choice(np.arange(views[i].shape[0]), n_obs)]
            features[i] = features[i][np.random.choice(np.arange(features[i].shape[0]), n_obs)]

    ret = [(v, f) for v, f in zip(views, features)]
    return ret


def init_logger(filename):
    """ initialize logger config

    Parameters
    ----------
    filename : str
        filename of the log
    """
    logging.basicConfig(level=logging.INFO, filename=filename + ".log")
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    logging.getLogger('').addHandler(console)


def rec_round(x, ndigits=2):
    """ round x recursively

    Parameters
    ----------
    x: float, int, list, list of list, ...
        variable to round, support many types
    ndigits: int
        precision in decimal digits
    """
    if isinstance(x, collections.Iterable):
        return [rec_round(item, ndigits) for item in x]
    return round(x, ndigits)


def has_gpu():
    """ check where has a nvidia gpu """
    ret = os.popen("nvidia-smi -L 2>/dev/null").read()
    return ret.find("GPU") != -1


def download_file(filename, url):
    """download url to filename"""
    print("Download %s from %s..." % (filename, url))

    ret = os.system("wget -O %s '%s'" % (filename, url))

    if ret != 0:
        print("ERROR: wget fails!")
        print("If you are an OSX user, you can install wget by 'brew install wget' and retry.")
        exit(-1)
    else:
        print("download done!")


def download_model(url):
    """download model from url"""
    name = url.split('/')[-1]
    name = os.path.join('data', name)
    download_file(name, url)
    def do_commond(cmd):
        print(cmd)
        os.system(cmd)
    do_commond("tar xzf %s -C data" % name)
    do_commond("rm %s" % name)


def check_model(name):
    """check whether a model is downloaded"""
    infos = {
        'against':
            (('data/battle_model/battle/tfdqn_0.index',),
            'https://raw.githubusercontent.com/merrymercy/merrymercy.github.io/master/_data/magent/against-0.tar.gz'),

        'battle-game':
            (("data/battle_model/trusty-battle-game-l/tfdqn_0.index",
             "data/battle_model/trusty-battle-game-r/tfdqn_0.index"),
             'https://raw.githubusercontent.com/merrymercy/merrymercy.github.io/master/_data/magent/battle_model.tar.gz'),

        'arrange':
            (('data/arrange_model/arrange/tfdqn_10.index',),
             'https://raw.githubusercontent.com/merrymercy/merrymercy.github.io/master/_data/magent/arrange_game.tar.gz',)
    }

    if name not in infos:
        raise RuntimeError("Unknown model name")

    info = infos[name]
    missing = False
    for check in info[0]:
        if not os.path.exists(check):
            missing = True
    if missing:
        download_model(info[1])


class FontProvider:
    """provide pixel font"""
    def __init__(self, filename):
        data = []
        # read raw
        with open(filename) as fin:
            for line in fin.readlines():
                char = []
                for x in line.split(','):
                    char.append(eval(x))
                data.append(char)

        height = 8
        width  = 8

        # expand bit compress
        expand_data = []
        for char in data:
            expand_char = [[0 for _ in range(width)] for _ in range(height)]
            for i in range(width):
                for j in range(height):
                    set = char[i] & (1 << j)
                    if set:
                        expand_char[i][j] = 1
            expand_data.append(expand_char)

        self.data = expand_data
        self.width = width
        self.height = height

    def get(self, i):
        if isinstance(i, int):
            return self.data[i]
        else:
            return self.data[ord(i)]

```

### Core Architecture Module: `src/discrete_snake/RenderGenerator.h`
```
/**
 * \file RenderGenerator.h
 * \brief Generate data for render
 */

#ifndef MAGNET_DISCRETE_SNAKE_RENDER_H
#define MAGNET_DISCRETE_SNAKE_RENDER_H

#include <string>

#include "snake_def.h"
#include "Map.h"

namespace magent {
namespace discrete_snake {

class RenderGenerator {
public:
    RenderGenerator();

    void next_file();

    void set_render(const char *key, const char *value);
    void gen_config(const Map &map, int w, int h);

    void render_a_frame(const std::vector<Agent *> &agents, const std::set<Food *> &foods);


    std::string get_save_dir() {
        return save_dir;
    }

private:
    std::string save_dir;

    int file_ct;
    int frame_ct;
    int frame_per_file;
    unsigned int id_ct;
};

} // namespace magent
} // namespace discrete_snake

#endif //MAGNET_DISCRETE_SNAKE_RENDER_H

```

### Core Architecture Module: `src/gridworld/RenderGenerator.h`
```
/**
 * \file RenderGenerator.h
 * \brief Generate data for render
 */

#ifndef MAGNET_GRIDWORLD_RENDER_H
#define MAGNET_GRIDWORLD_RENDER_H

#include <vector>
#include <string>

#include "grid_def.h"
#include "Map.h"

namespace magent {
namespace gridworld {

struct RenderAttackEvent{
    int id;
    int x, y;
};

class RenderGenerator {
public:
    RenderGenerator();

    // move to next file
    void next_file();

    // getter and setter for attack_events
    void set_attack_event(std::vector<RenderAttackEvent> &attack_events);
    std::vector<RenderAttackEvent> &get_attack_event();

    void set_render(const char *key, const char *value);
    void gen_config(std::vector<Group> &group, int w, int h);

    void render_a_frame(std::vector<Group> &groups, const Map &map);

    std::string get_save_dir() {
        return save_dir;
    }

private:
    std::string save_dir;

    int file_ct;
    int frame_ct;
    int frame_per_file;

    std::vector<RenderAttackEvent> attack_events;
};

} // namespace gridworld
} // namespace magent

#endif //MAGNET_GRIDWORLD_RENDER_H

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
             trace.append(tuple(cur_pos))
             pos.add(tuple(cur_pos))
             d = random.choice(range(4))
@@ -159,39 +139,6 @@ def create_maze(pos, width, height, unit, font_area):
     temp.extend(open_the_door(pos[0], pos[1], font_area[0] + height * unit, font_area[1] + height * unit, unit))
     res = clean_pos_set_convert_to_list(pos_set, temp)
     return res
-    # return pos_set
-
-
-def draw_split_line(x, y, width, height, split=10):
-    pos_set = []
-    if height > width:
-        splits = set(np.random.choice(height // 2, split) * 2)
-        for r in range(height):
-            if r in splits or (r - 1 in splits):
-                continue
-            for c in range(width):
-                pos_set.append((x + c, y + r))
-    else:
-        splits = set(np.random.choice(width // 2, split) * 2)
-        for r in range(height):
-            for c in range(width):
-                if c in splits or (c - 1 in splits):
-                    continue
-                pos_set.append((x + c, y
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

### Incident Patch 10: `81d7f347` (2017-12-02)
**Commit Message**: Render performance improved & battle game modified.

**File**: `examples/show_battle_game.py` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@
 
 
 if __name__ == "__main__":
-    if not (os.path.exists("data/battle_model/trusty-l/tfdqn_0.index")
-            and os.path.exists("data/battle_model/trusty-r/tfdqn_0.index")):
+    if not (os.path.exists("data/battle_model/trusty-battle-game-l/tfdqn_0.index")
+            and os.path.exists("data/battle_model/trusty-battle-game-r/tfdqn_0.index")):
         magent.utility.download_model("https://od.lk/d/NDFfNjA2MTU1N18/battle_model.tar.gz")
 
     PyGameRenderer().start(Server())
```

**File**: `python/magent/renderer/pygame_renderer.py` (modified, +88/-53)
```diff
@@ -4,6 +4,7 @@
 import math
 
 import pygame
+import numpy as np
 
 from magent.renderer.base_renderer import BaseRenderer
 from magent.renderer.server import BaseServer
@@ -20,11 +21,11 @@ def start(
             animation_stop=0,
             resolution=None,
             fps_soft_bound=60,
-            background_rgb=pygame.Color(255, 255, 255),
-            attack_line_rgb=pygame.Color(0, 0, 0),
-            attack_dot_rgb=pygame.Color(0, 0, 0),
+            background_rgb=(255, 255, 255),
+            attack_line_rgb=(0, 0, 0),
+            attack_dot_rgb=(0, 0, 0),
             attack_dot_size=0.3,
-            text_rgb=pygame.Color(0, 0, 0),
+            text_rgb=(0, 0, 0),
             text_size=16,
             text_spacing=3,
             banner_size=32,
@@ -37,7 +38,7 @@ def start(
             grid_max_size=100,
             zoom_rate=1 / 30,
             move_rate=4,
-            full_screen=True
+            full_screen=False
     ):
         def draw_line(surface, color, a, b):
             pygame.draw.line(
@@ -50,6 +51,28 @@ def draw_rect(surface, color, a, w, h):
             pygame.draw.rect(surface, color, pygame.Rect(
                 map(int, (round(a[0]), round(a[1]), round(w + a[0] - round(a[0])), round(h + a[1] - round(a[1]))))
             ))
+            
+        def draw_rect_matrix(matrix, color, a, w, h, resolution):
+            x, y, w, h = map(int, (round(a[0]), round(a[1]), round(w + a[0] - round(a[0])), round(h + a[1] - round(a[1]))))
+            matrix[max(x, 0):min(x + w, resolution[0]), max(y, 0):min(h + y, resolution[1]), :] = color
+                    
+        def draw_line_matrix(matrix, color, a, b, resolution):
+            a = (min(max(0, a[0]), resolution[0] - 1), min(max(0, a[1]), resolution[1] - 1))
+            b = (min(max(0, b[0]), resolution[0] - 1), min(max(0, b[1]), resolution[1] - 1))
+            a = map(int, (round(a[0]), round(a[1])))
+            b = map(int, (round(b[0]), round(b[1])))
+            if a[0] == b[0]:
+                if a[1] > b[1]:
+                    matrix[a[0], b[1]:a[1] + 1] = color
+                else:
+                    matrix[a[0], a[1]:b[1] + 1] = color
+            elif a[1] == b[1]:
+                if a[0] > b[0]:
+                    matrix[b[0]:a[0] + 1, a[1]] = color
+                else:
+                    matrix[a[0]:b[0] + 1, a[1]] = color
+            else:
+                raise NotImplementedError
 
         if not isinstance(server, BaseServer):
             raise BaseException('property server must be an instance of BaseServer')
@@ -64,7 +87,7 @@ def draw_rect(surface, color, a, w, h):
         clock = pygame.time.Clock()
         
         if full_screen:
-            canvas = pygame.display.set_mode(resolution, pygame.DOUBLEBUF, 0)
+            canvas = pygame.display.set_mode(resolution, pygame.DOUBLEBUF | pygame.FULLSCREEN, 0)
         else:
             canvas = pygame.display.set_mode(resolution, pygame.DOUBLEBUF, 0)
 
@@ -83,9 +106,11 @@ def draw_rect(surface, color, a, w, h):
         old_data = None
         new_data = None
 
-        grids = None
-        show_grid = False
+        need_static_update = True
+        #show_grid = False
         animation_progress = 0
+        
+        grid_map = np.zeros((resolution[0], resolution[1], 3), dtype=np.int16)
 
         while True:
             done = False
@@ -100,10 +125,11 @@ def draw_rect(surface, color, a, w, h):
                     pygame.quit()
                     done = True
                 elif event.type == pygame.KEYDOWN:
-                    if event.key == pygame.K_g:
-                        show_grid = not show_grid
-                    else:
-                        triggered = server.keydown(frame_id, event.key, mouse_x, mouse_y)
+                    #if event.key == pygame.K_g:
+                    #    show_grid = not show_grid
+                    #else:
+                    #    triggered = server.keydown(frame_id, event.key, mouse_x, mouse_y)
+                    triggered = server.keydown(frame_id, event.key, mouse_x, mouse_y)
                 elif event.type == pygame.MOUSEBUTTONDOWN:
                     if event.button == 4 or event.button == 5:
                         center_before = (
@@ -112,10 +138,10 @@ def draw_rect(surface, color, a, w, h):
                         )
                         if event.button == 5:
                             grid_size = max(grid_size - grid_size * zoom_rate, grid_min_size)
-                            grids = None
+                            need_static_update = True
                         else:
                             grid_size = min(grid_size + grid_size * zoom_rate, grid_max_size)
-                            grids = None
+                            need_static_update = True
                         center_after = (
                             (view_position[0] + resolution[0] / 2) / grid_size,
                             (view_position[1] + resolution[1] / 2) 
```

---

### Incident Patch 11: `79274991` (2017-12-02)
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

---

### Incident Patch 12: `d3f936e2` (2017-12-01)
**Commit Message**: fix bug: generate_map accepts param rnd

**File**: `examples/train_arrange.py` (modified, +4/-4)
```diff
@@ -13,7 +13,7 @@
 from magent.utility import FontProvider
 
 
-def remove_wall(d, cur_pos, wall_set):
+def remove_wall(d, cur_pos, wall_set, unit):
     if d == 0:
         for i in range(0, unit):
             for j in range(0, unit):
@@ -57,7 +57,7 @@ def dfs(x, y, width, height, unit, wall_set):
             cur_pos = trace[-1]
             trace.pop()
             if random.choice(range(2)) == 0:
-                remove_wall(d, cur_pos, wall_set)
+                remove_wall(d, cur_pos, wall_set, unit)
             flag = 0
         if len(trace) == 0:
             break
@@ -74,7 +74,7 @@ def dfs(x, y, width, height, unit, wall_set):
             d = (d + 1) % 4
             flag += 1
         else:
-            remove_wall(d, cur_pos, wall_set)
+            remove_wall(d, cur_pos, wall_set, unit)
             trace.append(tuple(cur_pos))
             pos.add(tuple(cur_pos))
             d = random.choice(range(4))
@@ -214,7 +214,7 @@ def load_config(map_size):
     return cfg
 
 
-def generate_map(env, map_size, goal_handle, handles, rnd):
+def generate_map(env, map_size, goal_handle, handles):
     # random message
     font = FontProvider('data/font_8x8/basic.txt')
     n_msg = random.randint(1, 4)
```

---

### Incident Patch 13: `e34b376f` (2017-12-01)
**Commit Message**: Fixed bugs in arrange game & battle game.

**File**: `examples/show_arrange.py` (modified, +2/-3)
```diff
@@ -6,11 +6,10 @@
 
 import os
 import sys
-import argparse
 
 import magent
 from magent.renderer import PyGameRenderer
-from magent.server import ArrangeServer as Server
+from magent.renderer.server import ArrangeServer as Server
 
 if __name__ == "__main__":
     if len(sys.argv) < 2:
@@ -20,4 +19,4 @@
     if not os.path.exists("data/arrange_model/arrange/tfdqn_10.index"):
         magent.utility.download_model("https://od.lk/s/NDFfNjAzNTA3OF8/arrange_game.tar.gz")
 
-    PyGameRenderer().start(Server(messages=sys.argv[1:]), grid_size=5, add_counter=0)
+    PyGameRenderer().start(Server(messages=sys.argv[1:]), grid_size=3.5)
```

**File**: `examples/show_battle_game.py` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 import magent
 from magent.renderer import PyGameRenderer
-from magent.server import BattleServer as Server
+from magent.renderer.server import BattleServer as Server
 
 
 if __name__ == "__main__":
```

**File**: `python/magent/renderer/pygame_renderer.py` (modified, +0/-19)
```diff
@@ -73,13 +73,7 @@ def draw_rect(surface, color, a, w, h):
         banner_formatter = pygame.font.SysFont(None, banner_size, True)
         bigscreen_formatter = pygame.font.SysFont(None, bigscreen_size, True)
 
-<<<<<<< HEAD
         map_size, groups, static_info = server.get_info()
-=======
-        banner_formatter = pygame.font.SysFont(None, 32)
-
-        map_size = server.get_map_size()
->>>>>>> 7fbc18b05289570747daa2cd8822b3f46dd8cbe7
         view_position = [map_size[0] / 2 * grid_size - resolution[0] / 2, 
                          map_size[1] / 2 * grid_size - resolution[1] / 2]
         frame_id = 0
@@ -108,7 +102,6 @@ def draw_rect(surface, color, a, w, h):
                 elif event.type == pygame.KEYDOWN:
                     if event.key == pygame.K_g:
                         show_grid = not show_grid
-<<<<<<< HEAD
                     else:
                         triggered = server.keydown(frame_id, event.key, mouse_x, mouse_y)
                 elif event.type == pygame.MOUSEBUTTONDOWN:
@@ -131,12 +124,6 @@ def draw_rect(surface, color, a, w, h):
                         view_position[1] += (center_before[1] - center_after[1]) * grid_size
                     else:
                         triggered = server.mousedown(frame_id, pygame.mouse.get_pressed(), mouse_x, mouse_y)
-=======
-                    elif event.key == pygame.K_a:
-                        if pause:
-                            server.add_agents(mouse_x, mouse_y, 0)
-                            pause = False
->>>>>>> 7fbc18b05289570747daa2cd8822b3f46dd8cbe7
 
             pressed = pygame.key.get_pressed()
             if pressed[pygame.K_ESCAPE]:
@@ -311,12 +298,6 @@ def draw_rect(surface, color, a, w, h):
 
                 text_grids = text_formatter.render('Numbers: %d' % len(new_data[0]), True, text_rgb)
                 text_mouse = text_formatter.render('Mouse: (%d, %d)' % (mouse_x, mouse_y), True, text_rgb)
-                text_please = banner_formatter.render('Please press a to add your agents', True, text_rgb)
-
-                numbers = server.get_numbers()
-                banner_red = banner_formatter.render('{}'.format(numbers[0]), True, pygame.Color(200, 0, 0))
-                banner_vs = banner_formatter.render(' vs ', True, text_rgb)
-                banner_blue = banner_formatter.render('{}'.format(numbers[1]), True, pygame.Color(0, 0, 200))
 
                 canvas.blit(text_fps, (0, 0))
                 canvas.blit(text_window, (0, (text_size + text_spacing) / 1.5))
```

**File**: `python/magent/renderer/server/arrange_server.py` (modified, +4/-1)
```diff
@@ -306,7 +306,10 @@ def keydown(self, frame_id, key, mouse_x, mouse_y):
         return False
 
     def get_status(self, frame_id):
-        return True
+        if self.done:
+            return None
+        else:
+            return True
 
     def get_endscreen(self, frame_id):
         return []
```

**File**: `python/magent/renderer/server/battle_server.py` (modified, +7/-7)
```diff
@@ -106,6 +106,7 @@ def __init__(self, path="data/battle_model", total_step=1000, add_counter=10, ad
         self.total_step = total_step
         self.add_interval = add_interval
         self.add_counter = add_counter
+        self.done = False
         print(env.get_view2attack(handles[0]))
         plt.show()
 
@@ -148,11 +149,9 @@ def step(self):
 
     def get_data(self, frame_id, x_range, y_range):
         start = time.time()
-        done = self.step()
-
-        if done:
+        if self.done:
             return None
-
+        self.done = self.step()
         pos, event = self.env._get_render_info(x_range, y_range)
         print(" fps ", 1 / (time.time() - start))
         return pos, event
@@ -195,7 +194,7 @@ def get_banners(self, frame_id, resolution):
     def get_status(self, frame_id):
         if frame_id % self.add_interval == 0 and self.add_counter > 0:
             return False
-        elif frame_id >= self.total_step:
+        elif frame_id >= self.total_step or self.done:
             return None
         else:
             return True
@@ -204,7 +203,8 @@ def keydown(self, frame_id, key, mouse_x, mouse_y):
         return False
 
     def mousedown(self, frame_id, pressed, mouse_x, mouse_y):
-        if frame_id % self.add_interval == 0 and frame_id < self.total_step and pressed[0] and self.add_counter > 0:
+        if frame_id % self.add_interval == 0 and frame_id < self.total_step and pressed[0] \
+                and self.add_counter > 0 and not self.done:
             self.add_counter -= 1
             pos = []
             for i in range(-5, 5):
@@ -223,7 +223,7 @@ def mousedown(self, frame_id, pressed, mouse_x, mouse_y):
         return False
 
     def get_endscreen(self, frame_id):
-        if frame_id == self.total_step:
+        if frame_id == self.total_step or self.done:
             if self.env.get_num(self.handles[0]) > self.env.get_num(self.handles[1]):
                 return [(("You", (200, 0, 0)), (" win! :)", (0, 0, 0)))]
             else:
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
