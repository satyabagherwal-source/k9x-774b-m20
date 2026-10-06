# Forensic Learning Record (Deep Inspection): pascalorg/editor

> **Canonical Artifact**: `07_PROJECT_LEARNING/pascalorg-editor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pascalorg/editor](https://github.com/pascalorg/editor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:50:55.825Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pascalorg/editor`
- **Description**: Open-source 3D architectural editor with a local CLI, MCP tools, and practical workflows for humans and AI agents.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 24638 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/editor/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'development'

export const isProduction =
  process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'

export const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'

/**
 * Base URL for the application
 * Uses NEXT_PUBLIC_* variables which are available at build time
 */
export const BASE_URL = (() => {
  // Development: localhost
  if (isDevelopment) {
    return process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
  }

  // Preview deployments: use Vercel branch URL
  if (isPreview && process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  // Production: use custom domain or Vercel production URL
  if (isProduction) {
    return (
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://editor.pascal.app')
    )
  }

  // Fallback (should never reach here in normal operation)
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
})()

```

### Core Architecture Module: `packages/core/src/agent-operations/__fixtures__/cases.ts`
```
import {
  BuildingNode,
  CeilingNode,
  DoorNode,
  GuideNode,
  ItemNode,
  LevelNode,
  RoofNode,
  RoofSegmentNode,
  SlabNode,
  StairNode,
  StairSegmentNode,
  UnitNode,
  WallNode,
  WindowNode,
  ZoneNode,
} from '../../schema'
import { VERIFY_SCENE_CASES } from './verify-scene-cases'

/**
 * Edge cases of the agent tools that run as core operations, written before the operations. One
 * declarative table per tool; the core, MCP and chat runners each run every table, so the three
 * layers cannot disagree. `surfaces` narrows a case whose setup only one surface has (the chat
 * knows the floor a person is viewing; the MCP has no such thing and falls back to the lowest).
 * `after` lists fields some nodes must have once the operation's changes are applied.
 */

export type AgentSurface = 'core' | 'mcp' | 'chat'
export type SceneGraph = { nodes: Record<string, unknown>; rootNodeIds: string[] }

export type AgentToolCase = {
  name: string
  tool: string
  scene: () => SceneGraph
  input: Record<string, unknown>
  context?: { activeLevelId?: string | null }
  surfaces?: AgentSurface[]
  expect:
    | { refusal: string; mentions?: string[] }
    | {
        result: Record<string, unknown>
        present?: string[]
        absent?: string[]
        after?: Record<string, Record<string, unknown>>
        /** Arrays of the result that hold (or lack) an entry matching each partial object. */
        contains?: Record<string, Record<string, unknown>[]>
        lacks?: Record<string, Record<string, unknown>[]>
        /** Text the result must include. */
        mentions?: string[]
      }
}

const graph = (...nodes: { id: string }[]): SceneGraph => ({
  nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  rootNodeIds: nodes
    .filter((node) => (node as { type?: string }).type === 'building')
    .map((node) => node.id),
})

const asset = (id: string, attachTo?: 'ceiling') => ({
  id,
  name: id,
  category: 'furniture',
  thumbnail: `/items/${id}/thumbnail.webp`,
  src: `/items/${id}/model.glb`,
  dimensions: [1, 1, 1] as [number, number, number],
  ...(attachTo ? { attachTo } : {}),
})

// ─── A house of two storeys with its roof on a level of its own, and a shed on a support level ──
//
// Ground: a 4 m wall (2.5 m, a door and a window), a 4 m wall with no height of its own off the
// slab (the 2.8 m storey decides), a 4 × 3 m living room with a slab and a ceiling carrying a lamp,
// a sofa, a stair, and a plan reference. The living room is the flat's only room.

function houseScene(): SceneGraph {
  const door = DoorNode.parse({
    id: 'door_ground',
    parentId: 'wall_ground',
    wallId: 'wall_ground',
    position: [1, 1.05, 0],
  })
  const window = WindowNode.parse({
    id: 'window_ground',
    parentId: 'wall_ground',
    wallId: 'wall_ground',
    position: [3, 1.65, 0],
  })
  const wall = WallNode.parse({
    id: 'wall_ground',
    parentId: 'level_ground',
    start: [0, 0],
    end: [4, 0],
    height: 2.5,
    children: [door.id, window.id],
  })
  const { height: _height, ...sideWall } = WallNode.parse({
    id: 'wall_side',
    parentId: 'level_ground',
    start: [0, 5],
    end: [4, 5],
  })
  const room = [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ] as [number, number][]
  const zone = ZoneNode.parse({
    id: 'zone_ground',
    parentId: 'level_ground',
    name: 'Living',
    polygon: room,
  })
  const slab = SlabNode.parse({ id: 'slab_ground', parentId: 'level_ground', polygon: room })
  const lamp = ItemNode.parse({
    id: 'item_lamp',
    parentId: 'ceiling_ground',
    position: [2, 0, 1.5],
    asset: asset('lamp', 'ceiling'),
  })
  const ceiling = CeilingNode.parse({
    id: 'ceiling_ground',
    parentId: 'level_ground',
    polygon: room,
    children: [lamp.id],
  })
  const sofa = ItemNode.parse({
    id: 'item_sofa',
    parentId: 'level_ground',
    position: [2, 0, 2],
    asset: asset('sofa'),
  })
  const flight = StairSegmentNode.parse({ id: 'sseg_main', parentId: 'stair_main' })
  const stair = StairNode.parse({
    id: 'stair_main',
    parentId: 'level_ground',
    position: [3, 0, 2],
    children: [flight.id],
  })
  const plan = GuideNode.parse({
    id: 'guide_plan',
    parentId: 'level_ground',
    url: '/plans/ground.svg',
  })
  const upperWall = WallNode.parse({
    id: 'wall_upper',
    parentId: 'level_upper',
    start: [0, 0],
    end: [4, 0],
    height: 2.5,
  })
  const roofSegment = RoofSegmentNode.parse({ id: 'rseg_main', parentId: 'roof_main' })
  const roof = RoofNode.parse({
    id: 'roof_main',
    parentId: 'level_roof',
    children: [roofSegment.id],
  })
  const ground = LevelNode.parse({
    id: 'level_ground',
    parentId: 'building_house',
    level: 0,
    name: 'Ground',
    height: 2.8,
    children: [wall.id, sideWall.id, zone.id, slab.id, ceiling.id, sofa.id, stair.id, plan.id],
  })
  const upper = LevelNode.parse({
    id: 'level_upper',
    parentId: 'building_house',
    level: 1,
    name: 'Upper',
    height: 2.8,
    children: [upperWall.id],
  })
  const roofLevel = LevelNode.parse({
    id: 'level_roof',
    parentId: 'building_house',
    level: 2,
    name: 'Roof',
    height: 2.8,
    children: [roof.id],
  })
  const flat = UnitNode.parse({
    id: 'unit_flat',
    parentId: 'building_house',
    name: 'Flat',
    members: [zone.id],
  })
  const house = BuildingNode.parse({
    id: 'building_house',
    children: [roofLevel.id, ground.id, upper.id, flat.id],
  })
  const shedLevel = LevelNode.parse({
    id: 'level_shed',
    parentId: 'building_shed',
    level: -1,
    name: 'Shed',
    height: 2.4,
    metadata: { role: 'support' },
  })
  const shed = BuildingNode.parse({ id: 'building_shed', children: [shedLevel.id] })
  return graph(
    house,
    ground,
    upper,
    roofLevel,
    flat,
    wall,
    door,
    window,
    sideWall as WallNode,
    zone,
    slab,
    ceiling,
    lamp,
    sofa,
    stair,
    flight,
    plan,
    upperWall,
    roof,
    roofSegment,
    shed,
    shedLevel,
  )
}

const emptyScene = (): SceneGraph => ({ nodes: {}, rootNodeIds: [] })

/** A level no building holds. */
function orphanLevelScene(): SceneGraph {
  const level = LevelNode.parse({ id: 'level_orphan', level: 0 })
  return { nodes: { [level.id]: level }, rootNodeIds: [] }
}

export const LIST_LEVELS_CASES: AgentToolCase[] = [
  {
    name: 'every level of every building, in floor order, with its role',
    tool: 'list_levels',
    scene: houseScene,
    input: {},
    expect: {
      result: {
        levelCount: 4,
        occupiedStoryCount: 2,
        supportLevelCount: 2,
        roofLevelIds: ['level_roof'],
        levels: [
          {
            id: 'level_shed',
            floorIndex: -1,
            role: 'support',
            isOccupiedStory: false,
            parentId: 'building_shed',
            childCount: 0,
          },
          {
            id: 'level_ground',
            floorIndex: 0,
            role: 'occupied',
            isOccupiedStory: true,
            parentId: 'building_house',
            childCount: 8,
          },
          {
            id: 'level_upper',
            floorIndex: 1,
            role: 'occupied',
            isOccupiedStory: true,
            childCount: 1,
          },
          { id: 'level_roof', floorIndex: 2, role: 'roof', isOccupiedStory: false, childCount: 1 },
        ],
      },
    },
  },
  {
    name: 'the floor a person is viewing is marked active',
    tool: 'list_levels',
    scene: houseScene,
    input: {},
    context: { activeLevelId: 'level_upper' },
    surfaces: ['core', 'chat'],
    expect: {
      result: {
        activeLevelId: 'level_upper',
        levels: [
          { id: 'level_shed', isActive: false },
          { id: 'level_ground', isActive: false },
          { id: 'level_upper', isActive: true },
          { id: 'level_roof', isActive: false },
        ],
      },
    },
  },
  {
    name: 'with no viewed floor nothing is active',
    tool: 'list_levels',
    scene: houseScene,
    input: {},
    expect: { result: { activeLevelId: null } },
  },
  {
    name: 'an empty scene lists no levels rather than failing',
    tool: 'list_levels',
    scene: emptyScene,
    input: {},
    expect: { result: { levelCount: 0, occupiedStoryCount: 0, roofLevelIds: [], levels: [] } },
  },
]

export const GET_NODE_CASES: AgentToolCase[] = [
  {
    name: 'a node comes whole, children included',
    tool: 'get_node',
    scene: houseScene,
    input: { id: 'wall_ground' },
    expect: {
      result: {
        node: {
          id: 'wall_ground',
          type: 'wall',
          start: [0, 0],
          end: [4, 0],
          children: ['door_ground', 'window_ground'],
        },
      },
    },
  },
  {
    name: 'metadata comes with the node',
    tool: 'get_node',
    scene: houseScene,
    input: { id: 'level_shed' },
    expect: { result: { node: { id: 'level_shed', metadata: { role: 'support' } } } },
  },
  {
    name: 'an unknown id is refused',
    tool: 'get_node',
    scene: houseScene,
    input: { id: 'wall_missing' },
    expect: { refusal: 'node_not_found', mentions: ['wall_missing'] },
  },
]

// Which level a level-scoped read targets: the id given, else the viewed floor, else the lowest
// occupied storey. Run through get_walls; get_zones and get_level_summary share the resolver.
export const LEVEL_TARGET_CASES: AgentToolCase[] = [
  {
    name: 'the level given is the level read',
    tool: 'get_walls',
    scene: houseScene,
    input: { levelId: 'level_upper' },
    expect: { result: { levelId: 'level_upper', walls: [{ id: 'wall_upper' }] } },
  },
  {
    name: 'the viewed floor is the default',
    tool: 'get_walls',
    scene: houseScene,
    input: {},
    context: { activeLevelId: 'level_upper' },
    surfaces: ['core', 'chat'],
    expect: { result: { levelId: 'level_upper' } },
  },
  {
    name: 'with no viewed floor, the lowest storey, not a support level below it',
    tool: 'get_
```

### Core Architecture Module: `packages/core/src/agent-operations/__fixtures__/verify-scene-cases.ts`
```
import {
  type AnyNode,
  BuildingNode,
  CeilingNode,
  DoorNode,
  ItemNode,
  LevelNode,
  RoofNode,
  SlabNode,
  StairNode,
  StairSegmentNode,
  WallNode,
  WindowNode,
  ZoneNode,
} from '../../schema'
import type { AgentToolCase, SceneGraph } from './cases'

/**
 * `verify_scene`: the MCP's checks and the chat's, merged, each issue typed so it can be counted.
 * A case names the issue types a scene must raise (`contains`) or must not (`lacks`).
 */

type Pt = [number, number]
const ROOM: Pt[] = [
  [0, 0],
  [4, 0],
  [4, 3],
  [0, 3],
]

/** Links parents' children and returns the graph, buildings as roots. */
function scene(...nodes: AnyNode[]): SceneGraph {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, { ...node }])) as Record<
    string,
    AnyNode & { children?: string[] }
  >
  for (const node of Object.values(byId)) {
    const parent = node.parentId ? byId[node.parentId] : undefined
    if (parent && Array.isArray(parent.children) && !parent.children.includes(node.id))
      parent.children = [...parent.children, node.id]
  }
  return {
    nodes: byId,
    rootNodeIds: nodes.filter((node) => node.type === 'building').map((node) => node.id),
  }
}

const building = (id = 'building_main') => BuildingNode.parse({ id })
const level = (id: string, index: number, extra: Record<string, unknown> = {}) =>
  LevelNode.parse({
    id,
    parentId: 'building_main',
    level: index,
    name: `Floor ${index}`,
    height: 2.8,
    ...extra,
  })

/** A finished room on a level: a 4 m wall with a centred door, its zone, slab and ceiling. */
function room(levelId: string, tag: string): AnyNode[] {
  const wall = WallNode.parse({
    id: `wall_${tag}`,
    parentId: levelId,
    start: [0, 0],
    end: [4, 0],
    height: 2.5,
  })
  const door = DoorNode.parse({
    id: `door_${tag}`,
    parentId: wall.id,
    wallId: wall.id,
    position: [2, 1.05, 0],
  })
  return [
    wall,
    door,
    ZoneNode.parse({ id: `zone_${tag}`, parentId: levelId, name: 'Room', polygon: ROOM }),
    SlabNode.parse({ id: `slab_${tag}`, parentId: levelId, polygon: ROOM }),
    CeilingNode.parse({ id: `ceiling_${tag}`, parentId: levelId, polygon: ROOM }),
  ]
}

const stairOn = (levelId: string, extra: Record<string, unknown> = {}) => {
  const flight = StairSegmentNode.parse({
    id: `sseg_${levelId}`,
    parentId: `stair_${levelId}`,
    width: 1,
    length: 2,
    height: 2.5,
    stepCount: 10,
  })
  const stair = StairNode.parse({
    id: `stair_${levelId}`,
    parentId: levelId,
    name: 'Main Stair',
    position: [2, 0, 0.5],
    ...extra,
  })
  return [stair, flight]
}

const asset = (id: string, dimensions: [number, number, number]) => ({
  id,
  name: id,
  category: 'furniture',
  thumbnail: `/items/${id}/thumbnail.webp`,
  src: `/items/${id}/model.glb`,
  dimensions,
})

const oneStorey = () => scene(building(), level('level_0', 0), ...room('level_0', 'ground'))
const twoStoreys = (...extra: AnyNode[]) =>
  scene(
    building(),
    level('level_0', 0),
    level('level_1', 1),
    ...room('level_0', 'ground'),
    ...room('level_1', 'upper'),
    ...extra,
  )

const verify = (
  name: string,
  build: () => SceneGraph,
  expectation: {
    result?: Record<string, unknown>
    contains?: string[]
    lacks?: string[]
    mentions?: string[]
  },
  extra: Partial<AgentToolCase> = {},
): AgentToolCase => ({
  name,
  tool: 'verify_scene',
  scene: build,
  input: {},
  ...extra,
  expect: {
    result: expectation.result ?? {},
    ...(expectation.contains && {
      contains: { issues: expectation.contains.map((type) => ({ type })) },
    }),
    ...(expectation.lacks && { lacks: { issues: expectation.lacks.map((type) => ({ type })) } }),
    ...(expectation.mentions && { mentions: expectation.mentions }),
  },
})

export const VERIFY_SCENE_CASES: AgentToolCase[] = [
  verify('a finished storey has no issues', oneStorey, {
    result: {
      ok: true,
      valid: true,
      levelCount: 1,
      occupiedStoryCount: 1,
      emptyLevelIds: [],
      issues: [],
      hasIssues: false,
    },
  }),
  verify(
    'the viewed floor is marked',
    oneStorey,
    { result: { activeLevelId: 'level_0', levels: [{ levelId: 'level_0', isActive: true }] } },
    { context: { activeLevelId: 'level_0' }, surfaces: ['core', 'chat'] },
  ),
  verify(
    'walls with no room and no door are reported',
    () =>
      scene(
        building(),
        level('level_0', 0),
        WallNode.parse({ id: 'wall_bare', parentId: 'level_0', start: [0, 0], end: [4, 0] }),
      ),
    {
      contains: ['walls_no_zones', 'walls_no_doors'],
      mentions: ['walls but no zones'],
    },
  ),
  verify(
    'a room with no floor or ceiling is reported',
    () =>
      scene(
        building(),
        level('level_0', 0),
        ZoneNode.parse({ id: 'zone_bare', parentId: 'level_0', name: 'Room', polygon: ROOM }),
      ),
    { contains: ['zones_no_slabs', 'zones_no_ceilings'] },
  ),
  verify(
    'an empty storey is reported by name and id',
    () =>
      scene(
        building(),
        level('level_0', 0),
        level('level_1', 1),
        ...room('level_0', 'ground'),
        ...stairOn('level_0'),
      ),
    {
      result: { emptyLevelIds: ['level_1'] },
      contains: ['empty_levels'],
      mentions: ['level_1'],
    },
  ),
  verify('two storeys with no stair are reported', () => twoStoreys(), {
    contains: ['missing_stair'],
  }),
  verify('a stair on a storey connects them', () => twoStoreys(...stairOn('level_0')), {
    lacks: ['missing_stair'],
  }),
  verify(
    'a roof-only level is neither a storey nor empty: one storey needs no stair',
    () =>
      scene(
        building(),
        level('level_0', 0),
        level('level_roof', 1, { name: 'Roof' }),
        ...room('level_0', 'ground'),
        RoofNode.parse({ id: 'roof_main', parentId: 'level_roof' }),
      ),
    {
      result: { occupiedStoryCount: 1, roofLevelIds: ['level_roof'], hasIssues: false },
      lacks: ['missing_stair', 'empty_levels'],
    },
  ),
  verify(
    'two single-storey buildings need no stair',
    () =>
      scene(
        building(),
        level('level_0', 0),
        ...room('level_0', 'ground'),
        building('building_annex'),
        level('level_annex', 0, { parentId: 'building_annex' }),
        ...room('level_annex', 'annex'),
      ),
    { lacks: ['missing_stair'] },
  ),
  verify(
    'a roof level with storey content is reported',
    () =>
      scene(
        building(),
        level('level_0', 0),
        level('level_roof', 1, { metadata: { role: 'roof' } }),
        ...room('level_0', 'ground'),
        RoofNode.parse({ id: 'roof_main', parentId: 'level_roof' }),
        WallNode.parse({ id: 'wall_attic', parentId: 'level_roof', start: [0, 0], end: [4, 0] }),
      ),
    { contains: ['roof_level_occupied'] },
  ),
  verify(
    'a declared roof level with no roof is reported',
    () =>
      scene(
        building(),
        level('level_0', 0),
        level('level_roof', 1, { metadata: { role: 'roof' } }),
        ...room('level_0', 'ground'),
      ),
    { contains: ['roof_level_no_roof'] },
  ),
  verify(
    'a roof on a storey is reported',
    () =>
      scene(
        building(),
        level('level_0', 0),
        ...room('level_0', 'ground'),
        RoofNode.parse({ id: 'roof_low', parentId: 'level_0' }),
      ),
    {
      contains: ['roof_mixed_in_storey'],
      mentions: ['dedicated roof level'],
    },
  ),
  verify(
    'a wall taller than its storey in a multi-storey building is reported',
    () =>
      twoStoreys(
        ...stairOn('level_0'),
        WallNode.parse({
          id: 'wall_tall',
          parentId: 'level_0',
          start: [0, 3],
          end: [4, 3],
          height: 5.6,
        }),
      ),
    {
      contains: ['wall_spans_storeys'],
      mentions: ['multi-story exterior walls should be split'],
    },
  ),
  verify(
    'a tall wall on a one-storey annex beside a two-storey house spans no storeys',
    () =>
      scene(
        building(),
        level('level_0', 0),
        level('level_1', 1),
        ...room('level_0', 'ground'),
        ...room('level_1', 'upper'),
        ...stairOn('level_0'),
        building('building_annex'),
        level('level_annex', 0, { parentId: 'building_annex' }),
        ...room('level_annex', 'annex'),
        WallNode.parse({
          id: 'wall_annex_tall',
          parentId: 'level_annex',
          start: [0, 3],
          end: [4, 3],
          height: 5.6,
        }),
      ),
    { lacks: ['wall_spans_storeys'] },
  ),
  verify(
    'an opening on the wrong wall, past its end and above its top is reported',
    () =>
      scene(
        building(),
        level('level_0', 0),
        ...room('level_0', 'ground'),
        WallNode.parse({ id: 'wall_other', parentId: 'level_0', start: [0, 2], end: [4, 2] }),
        WindowNode.parse({
          id: 'window_astray',
          parentId: 'wall_ground',
          wallId: 'wall_other',
          position: [4.8, 2.4, 0],
          width: 1,
          height: 1,
        }),
      ),
    {
      contains: ['opening_wall_mismatch', 'opening_outside_wall', 'opening_outside_height'],
      mentions: [
        'window window_astray has wallId wall_other',
        'window window_astray extends outside wall wall_ground',
      ],
    },
  ),
  verify(
    'a stair reaching past its floor slab is reported',
    () =>
      scene(
        building(),
        level('level_0', 0),
        ...room('level_0', 'ground'),
        ...stairOn('level_0', { position: [3.6, 0, 1], rotation: Math.PI / 2 }),
      ),
    {
      contains: ['stair_outside_slab'],
      mentions: ['Stair Main Stair footprint extends outside source floor slab'],
    },
  ),
  verify(
    'a wall across a stair is reported',
    () =>
      twoStoreys(
        ...stairOn('level_0'),
        WallNode.parse({
          id: 'wall_blocker',
          parentId: '
```

### Core Architecture Module: `packages/core/src/agent-operations/add-object.ts`
```
import { refuse } from '../agent-tools/refusal'
import { artifactUrl } from '../lib/artifact-store'
import {
  isScriptedNode,
  type ScriptedNode,
  scriptedSize,
  scriptInteractive,
  scriptSource,
} from '../lib/geometry-script-node'
import { geometryRestingHeight, resettledPosition } from '../lib/geometry-surfaces'
import {
  type AnyNode,
  type CompiledGeometryScript,
  type GeometryScriptMount,
  type GeometryScriptParamValue,
  generateId,
  ItemNode,
} from '../schema'
import { targetLevel } from './level-target'
import type { AgentOperation } from './types'

type Vec3 = [number, number, number]

export type AddObjectInput = {
  /** Absent for a params-only edit: the host compiled the object's stored script. */
  code?: string
  params?: Record<string, GeometryScriptParamValue>
  nodeId?: string
  parentId?: string
  position?: number[]
  /** Degrees about Y, as the contract parses it. */
  rotation?: number
  side?: 'front' | 'back'
  name?: string
  category?: string
  /** What the surface's compile produced from `code` (compiled before the operation runs). */
  compiled: CompiledGeometryScript
}

const ATTACH: Record<GeometryScriptMount, ItemNode['asset']['attachTo']> = {
  floor: undefined,
  wall: 'wall',
  'wall-side': 'wall-side',
  ceiling: 'ceiling',
}

const HOSTS: Record<GeometryScriptMount, readonly AnyNode['type'][]> = {
  floor: ['level', 'item'],
  wall: ['wall'],
  'wall-side': ['wall'],
  ceiling: ['ceiling'],
}

function scriptAsset(
  compiled: CompiledGeometryScript,
  input: AddObjectInput,
  previous: ItemNode['asset'] | undefined,
): ItemNode['asset'] {
  const { min, max } = compiled.manifest.bounds
  const restingHeight = geometryRestingHeight(compiled.manifest)
  return {
    id: `script_${compiled.sha256.slice(0, 16)}`,
    category: input.category ?? previous?.category ?? 'object',
    name: input.name ?? previous?.name ?? 'Authored object',
    thumbnail: previous?.thumbnail ?? '',
    source: 'mine',
    src: artifactUrl(compiled.sha256),
    dimensions: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    attachTo: ATTACH[compiled.mount],
    surface: restingHeight === null ? undefined : { height: restingHeight },
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    interactive: scriptInteractive(compiled.manifest),
  }
}

const round = (value: number) => Math.round(value * 1000) / 1000

function summary(node: { id: string }, compiled: CompiledGeometryScript, orphanedSlots: string[]) {
  const { bounds, parts, slots, lights, params, triangles, cutout, animations } = compiled.manifest
  return {
    nodeId: node.id,
    mount: compiled.mount,
    size: bounds.max.map((v, i) => round(v - bounds.min[i]!)),
    parts: parts.map((part) => (part.type ? `${part.id} (${part.type})` : part.id)),
    slots: slots.map((slot) => slot.id),
    lights: lights.map((light) => light.id),
    animations: animations.map((clip) => clip.name),
    params: params.map((spec) => ({ ...spec, value: compiled.params[spec.id] })),
    cutout,
    triangles,
    ...(orphanedSlots.length > 0
      ? {
          orphanedSlots,
          note: `Paint on ${orphanedSlots.join(', ')} is kept but no longer shows: the new output has no slot with that id.`,
        }
      : {}),
  }
}

/**
 * `add_object`: the item a compiled three.js module becomes. Not in
 * AGENT_OPERATIONS: each surface compiles `code` first (the chat in its
 * worker, the MCP on the server) and passes the result as `compiled`.
 * The artifact is referenced by hash and its bounds become the item's dimensions; editing
 * keeps the item's identity, placement, children and paint.
 */
export const addObject: AgentOperation<AddObjectInput> = (nodes, input, context) => {
  const { compiled } = input
  const rotation: Vec3 | undefined =
    input.rotation === undefined ? undefined : [0, (input.rotation * Math.PI) / 180, 0]

  if (input.nodeId) {
    const previous = authoredObject(nodes, input.nodeId)
    if (previous.type !== 'item')
      refuse(
        'use_opening_tool',
        `${previous.id} is a ${previous.type}: rebuild it with add_${previous.type} and nodeId.`,
        { id: previous.id, type: previous.type },
      )
    const slotIds = new Set(compiled.manifest.slots.map((slot) => slot.id))
    const orphanedSlots = Object.keys(previous.slots ?? {}).filter((id) => !slotIds.has(id))
    const next = ItemNode.parse({
      ...previous,
      name: input.name ?? previous.name,
      position: (input.position as Vec3 | undefined) ?? previous.position,
      rotation: rotation ?? previous.rotation,
      side: input.side ?? previous.side,
      source: scriptSource(compiled),
      asset: scriptAsset(compiled, input, previous.asset),
    })
    // Children resting on or hanging from the object follow its new geometry.
    const resettled: { id: string; position: Vec3 }[] = []
    for (const childId of previous.children) {
      const child = nodes[childId]
      if (child?.type !== 'item' || child.wallId) continue
      const position = resettledPosition(compiled.manifest, child, next.scale)
      if (!position || position.every((v, i) => Math.abs(v - child.position[i]!) < 1e-4)) continue
      resettled.push({ id: child.id, position })
    }
    return {
      result: {
        ...summary(next, compiled, orphanedSlots),
        ...(resettled.length > 0 ? { resettled: resettled.map((entry) => entry.id) } : {}),
      },
      changes: {
        update: [
          { id: next.id, data: next },
          ...resettled.map(({ id, position }) => ({ id, data: { position } })),
        ],
      },
    }
  }

  const parent = input.parentId ? nodes[input.parentId] : targetLevel(nodes, {}, context)
  if (!parent)
    refuse('node_not_found', `Node not found: ${input.parentId}.`, { id: input.parentId })
  const hosts = HOSTS[compiled.mount]
  if (!hosts.includes(parent.type)) {
    refuse(
      'wrong_host',
      `A ${compiled.mount} object goes on a ${hosts.join(' or ')}, not on a ${parent.type}. Pass parentId of a ${hosts[0]}, or change \`mount\`.`,
      { mount: compiled.mount, parentType: parent.type },
    )
  }
  const asset = scriptAsset(compiled, input, undefined)
  const node = ItemNode.parse({
    object: 'node',
    id: generateId('item'),
    type: 'item',
    name: input.name ?? asset.name,
    parentId: parent.id,
    ...(parent.type === 'wall' ? { wallId: parent.id, side: input.side ?? 'front' } : {}),
    position: (input.position as Vec3 | undefined) ?? [0, 0, 0],
    rotation: rotation ?? [0, 0, 0],
    source: scriptSource(compiled),
    asset,
  })
  return {
    result: summary(node, compiled, []),
    changes: { create: [{ node, parentId: parent.id }] },
  }
}

export type RescriptOpeningInput = {
  nodeId: string
  /** Where it goes; without one its bottom edge stays put. */
  position?: number[]
  name?: string
  /** What the host compiled: new code, or the stored script with new params. */
  compiled: CompiledGeometryScript
}

/**
 * `add_window` / `add_door` with a nodeId: a window or door built from (or
 * given) a script, rebuilt from what the host compiled. Its size is what the
 * script built; marks, hosting and the opening's own fields are kept.
 */
export const rescriptOpening: AgentOperation<RescriptOpeningInput> = (nodes, input) => {
  const { compiled } = input
  const previous = nodes[input.nodeId]
  if (!previous) refuse('node_not_found', `Node not found: ${input.nodeId}.`, { id: input.nodeId })
  if (previous.type !== 'window' && previous.type !== 'door')
    refuse('not_an_opening', `${input.nodeId} is a ${previous.type}, not a window or door.`, {
      id: input.nodeId,
      type: previous.type,
    })
  const slotIds = new Set(compiled.manifest.slots.map((slot) => slot.id))
  const orphanedSlots = Object.keys(previous.slots ?? {}).filter((id) => !slotIds.has(id))
  // A window or door keeps its place on the wall and its bottom edge; its size is what the script built.
  if (compiled.mount !== 'wall')
    refuse('wrong_mount', `A ${previous.type}'s script uses mount 'wall'.`, {
      mount: compiled.mount,
    })
  const [width, height] = scriptedSize(compiled.manifest)
  // Given a position, that is where it goes; otherwise its bottom edge stays put.
  const [x, y, z] = previous.position
  const placed: Vec3 = (input.position as Vec3 | undefined) ?? [
    x,
    y - previous.height / 2 + height / 2,
    z,
  ]
  // A wider rebuild stays on its wall, as a new opening does.
  const wall = previous.wallId ? nodes[previous.wallId] : undefined
  const wallLength =
    wall?.type === 'wall' ? Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]) : 0
  const position: Vec3 =
    wallLength >= width
      ? [Math.min(wallLength - width / 2, Math.max(width / 2, placed[0])), placed[1], placed[2]]
      : placed
  return {
    result: summary(previous, compiled, orphanedSlots),
    changes: {
      update: [
        {
          id: previous.id,
          data: {
            name: input.name ?? previous.name,
            source: scriptSource(compiled),
            width,
            height,
            position,
          },
        },
      ],
    },
  }
}

/** The scripted node `get_source` and a params-only rebuild act on, or a refusal. */
export function authoredObject(nodes: Record<string, AnyNode>, nodeId: string): ScriptedNode {
  const node = nodes[nodeId]
  if (!node) refuse('node_not_found', `Node not found: ${nodeId}.`, { id: nodeId })
  if (!isScriptedNode(node))
    refuse(
      'not_authored',
      `${nodeId} is a ${node.type} without a script; only objects, windows and doors built from code have one.`,
      { id: nodeId, type: node.type },
    )
  return node
}

/** What `get_source` answers once the host has the module's text. */
export function readSourceResult(node: ScriptedNode, code: string) {
  return {
    nodeId: node.id,
    type: node.type,
    name: node.name,
    code,
    params: node.source.manifest.params.map((spec) => ({
      ...spec,
   
```

### Core Architecture Module: `packages/core/src/agent-operations/apply-changes.ts`
```
import type { AnyNode } from '../schema'
import type { SceneChanges, SceneNodes } from './types'

/** The scene after an operation's changes, without a store: for checks and previews. */
export function applySceneChanges(
  nodes: SceneNodes,
  changes: SceneChanges | undefined,
): Record<string, AnyNode> {
  const next: Record<string, AnyNode> = { ...nodes }
  const remove = (id: string) => {
    const node = next[id]
    delete next[id]
    if (node && 'children' in node && Array.isArray(node.children))
      for (const child of node.children as string[]) remove(child)
  }
  for (const id of changes?.delete ?? []) remove(id)
  for (const { id, data } of changes?.update ?? [])
    if (next[id]) next[id] = { ...next[id], ...data } as AnyNode
  for (const { node } of changes?.create ?? []) next[node.id] = node
  return next
}

```

### Core Architecture Module: `packages/core/src/agent-operations/delete-node.ts`
```
import { refuse } from '../agent-tools/refusal'
import { descendantsOf } from './scene-queries'
import type { AgentOperation } from './types'

/** `delete_node`: the editor's Delete, which takes a node with everything under it. */
export const deleteNode: AgentOperation<{ id: string }> = (nodes, { id }) => {
  if (!nodes[id]) refuse('node_not_found', `Node not found: ${id}.`, { id })
  const deletedIds = [id, ...descendantsOf(nodes, id).map((node) => node.id)]
  return { result: { deletedIds }, changes: { delete: [id] } }
}

```

### Core Architecture Module: `packages/core/src/agent-operations/door-clearance.ts`
```
/**
 * Door access keep-outs for MCP layout tools.
 *
 * Furniture that overlaps a door clear zone is reported as blocking the door.
 * Used by furnish_room (skip placements) and verify_scene (layout issues).
 *
 * See docs/layout-clearance-error-log.md for pitfalls (levels, gap sign, scale).
 */

import { type AnyNode, getScaledDimensions } from '../schema'
import { type Vec2, wallLength } from './plan-geometry'

export type PlanAabb = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type ItemFootprintFailureReason =
  | 'missing_dimensions'
  | 'non_finite_position'
  | 'non_finite_rotation'
  | 'non_finite_dimensions'
  | 'non_positive_plan_dimensions'
  | 'non_finite_scale'
  | 'zero_plan_scale'
  | 'non_planar_rotation'
  | 'unsupported_attachment'

export type ItemFootprintInspection =
  | {
      ok: true
      aabb: PlanAabb
      sourceDimensions: [number, number, number]
      effectiveDimensions: [number, number, number]
      rotationY: number
    }
  | { ok: false; reason: ItemFootprintFailureReason }

export type DoorKeepout = {
  doorId: string
  wallId: string
  levelId: string | null
  /** World-space AABB on both sides of the wall opening. */
  aabb: PlanAabb
  width: number
  localX: number
}

/**
 * Wall shape these helpers accept. Deliberately structural rather than
 * `Pick<WallNode, …>`: `keepoutForPolygonEdge` feeds in synthetic `edge-N`
 * segments for room edges that do not have a wall node yet, so the id cannot
 * be the branded `wall_${string}`.
 */
export type WallSegmentLike = { id: string; start: Vec2; end: Vec2 }

/**
 * Door shape these helpers accept — a real `DoorNode` or a planned opening.
 * `Pick<AnyNode, 'position' | 'width'>` does not work: those keys exist on
 * only some members of the `AnyNode` union, so `Pick` rejects them.
 */
export type DoorOpeningLike = {
  id: string
  position?: readonly number[]
  width?: number
}

/** Plan depth (m) cleared on each side of the wall face through the opening. */
export const DEFAULT_DOOR_CLEAR_DEPTH = 0.65
/** Extra half-width (m) beyond the door leaf along the wall. */
export const DEFAULT_DOOR_SIDE_PAD = 0.05

/**
 * True when A and B come closer than `gap` meters (including penetration).
 * `gap` is the **minimum free space required** between boxes:
 * expand each box by gap/2, then test intersection.
 */
export function aabbsOverlap(a: PlanAabb, b: PlanAabb, gap = 0): boolean {
  const g = gap
  return a.maxX + g > b.minX && a.minX - g < b.maxX && a.maxZ + g > b.minZ && a.minZ - g < b.maxZ
}

/**
 * Walk parentId chain to the enclosing level id (pure; no bridge required).
 */
export function resolveNodeLevelId(nodeId: string, byId: Map<string, AnyNode>): string | null {
  let current: AnyNode | undefined = byId.get(nodeId)
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) return null
    seen.add(current.id)
    if (current.type === 'level') return current.id
    const parentId = current.parentId
    if (parentId && byId.has(parentId)) {
      current = byId.get(parentId)
      continue
    }
    current = findParentByChildren(current.id, byId)
  }
  return null
}

function findParentByChildren(nodeId: string, byId: Map<string, AnyNode>): AnyNode | undefined {
  for (const candidate of byId.values()) {
    if (!('children' in candidate) || !Array.isArray(candidate.children)) continue
    const containsNode = (candidate.children as unknown[]).some((child) => {
      if (typeof child === 'string') return child === nodeId
      return (
        child !== null &&
        typeof child === 'object' &&
        'id' in child &&
        (child as { id?: unknown }).id === nodeId
      )
    })
    if (containsNode) return candidate
  }
  return undefined
}

/**
 * Axis-aligned item footprint in plan (x/z), rotation-aware.
 * Prefer scaled dimensions when the node is available.
 */
export function itemPlanAabb(
  position: [number, number, number] | number[],
  dimensions: [number, number, number] | number[] | undefined,
  rotationYRad = 0,
): PlanAabb {
  const x = position[0] ?? 0
  const z = position[2] ?? 0
  const [w = 1, , d = 1] = dimensions ?? [1, 1, 1]
  const cos = Math.abs(Math.cos(rotationYRad))
  const sin = Math.abs(Math.sin(rotationYRad))
  const halfW = (w * cos + d * sin) / 2
  const halfD = (w * sin + d * cos) / 2
  return {
    minX: x - halfW,
    maxX: x + halfW,
    minZ: z - halfD,
    maxZ: z + halfD,
  }
}

/** Scaled plan footprint used by legacy placement and door-clearance callers. */
export function itemNodePlanAabb(node: AnyNode): PlanAabb | null {
  if (node.type !== 'item') return null
  if (!Array.isArray(node.asset.dimensions)) return null
  const [width, height, depth] = getScaledDimensions(node)
  const rotationY = Array.isArray(node.rotation) ? (node.rotation[1] ?? 0) : 0
  if (
    ![node.position[0], node.position[2], width, height, depth, rotationY].every(Number.isFinite)
  ) {
    return null
  }
  return itemPlanAabb(
    node.position,
    [Math.abs(width), Math.abs(height), Math.abs(depth)],
    rotationY,
  )
}

export function inspectItemPlanFootprint(
  node: Extract<AnyNode, { type: 'item' }>,
  options?: { floorOnly?: boolean },
): ItemFootprintInspection {
  if (
    options?.floorOnly &&
    (node.asset.attachTo === 'wall' ||
      node.asset.attachTo === 'wall-side' ||
      node.asset.attachTo === 'ceiling')
  ) {
    return { ok: false, reason: 'unsupported_attachment' }
  }

  const position = node.position
  if (!Array.isArray(position)) {
    return { ok: false, reason: 'non_finite_position' }
  }
  const x = position[0]
  const y = position[1]
  const z = position[2]
  if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
    return { ok: false, reason: 'non_finite_position' }
  }

  const rotation = Array.isArray(node.rotation) ? node.rotation : [0, 0, 0]
  const rotationX = rotation[0] ?? Number.NaN
  const rotationY = rotation[1] ?? Number.NaN
  const rotationZ = rotation[2] ?? Number.NaN
  if (!(Number.isFinite(rotationX) && Number.isFinite(rotationY) && Number.isFinite(rotationZ))) {
    return { ok: false, reason: 'non_finite_rotation' }
  }
  if (Math.abs(rotationX) > 1e-6 || Math.abs(rotationZ) > 1e-6) {
    return { ok: false, reason: 'non_planar_rotation' }
  }

  const dimensions = node.asset.dimensions
  if (!Array.isArray(dimensions) || dimensions.length !== 3) {
    return { ok: false, reason: 'missing_dimensions' }
  }
  const width = dimensions[0] ?? Number.NaN
  const height = dimensions[1] ?? Number.NaN
  const depth = dimensions[2] ?? Number.NaN
  if (!(Number.isFinite(width) && Number.isFinite(height) && Number.isFinite(depth))) {
    return { ok: false, reason: 'non_finite_dimensions' }
  }
  if (width <= 0 || depth <= 0) {
    return { ok: false, reason: 'non_positive_plan_dimensions' }
  }

  const scale = Array.isArray(node.scale) ? node.scale : [1, 1, 1]
  const scaleX = scale[0] ?? Number.NaN
  const scaleY = scale[1] ?? Number.NaN
  const scaleZ = scale[2] ?? Number.NaN
  if (!(Number.isFinite(scaleX) && Number.isFinite(scaleY) && Number.isFinite(scaleZ))) {
    return { ok: false, reason: 'non_finite_scale' }
  }
  if (scaleX === 0 || scaleZ === 0) {
    return { ok: false, reason: 'zero_plan_scale' }
  }

  const [scaledWidth, scaledHeight, scaledDepth] = getScaledDimensions(node)
  const effectiveDimensions: [number, number, number] = [
    Math.abs(scaledWidth),
    Math.abs(scaledHeight),
    Math.abs(scaledDepth),
  ]
  if (!effectiveDimensions.every(Number.isFinite)) {
    return { ok: false, reason: 'non_finite_dimensions' }
  }
  if (effectiveDimensions[0] <= 0 || effectiveDimensions[2] <= 0) {
    return { ok: false, reason: 'non_positive_plan_dimensions' }
  }

  return {
    ok: true,
    aabb: itemPlanAabb(node.position, effectiveDimensions, rotationY),
    sourceDimensions: [width, height, depth],
    effectiveDimensions,
    rotationY,
  }
}

/**
 * Build a rectangular keep-out around a wall door, extruded perpendicular to the wall
 * on both faces so either swing side is protected.
 */
export function doorKeepoutFromWall(
  wall: WallSegmentLike,
  door: DoorOpeningLike,
  options?: { clearDepth?: number; sidePad?: number; levelId?: string | null },
): DoorKeepout | null {
  const clearDepth = options?.clearDepth ?? DEFAULT_DOOR_CLEAR_DEPTH
  const sidePad = options?.sidePad ?? DEFAULT_DOOR_SIDE_PAD
  const length = wallLength(wall)
  if (length <= 1e-6) return null

  const width = typeof door.width === 'number' && door.width > 0 ? door.width : 0.9
  const localX = Array.isArray(door.position) ? (door.position[0] ?? length / 2) : length / 2

  const [sx, sz] = wall.start
  const [ex, ez] = wall.end
  const dx = (ex - sx) / length
  const dz = (ez - sz) / length
  const nx = -dz
  const nz = dx

  const half = width / 2 + sidePad
  const corners: Vec2[] = []
  for (const along of [localX - half, localX + half]) {
    const cx = sx + dx * along
    const cz = sz + dz * along
    for (const side of [-clearDepth, clearDepth]) {
      corners.push([cx + nx * side, cz + nz * side])
    }
  }

  const xs = corners.map((c) => c[0])
  const zs = corners.map((c) => c[1])
  return {
    doorId: door.id,
    wallId: wall.id,
    levelId: options?.levelId ?? null,
    width,
    localX,
    aabb: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    },
  }
}

export function collectDoorKeepouts(
  nodes: Iterable<AnyNode>,
  options?: { clearDepth?: number; sidePad?: number; levelId?: string },
): DoorKeepout[] {
  const byId = new Map<string, AnyNode>()
  for (const node of nodes) byId.set(node.id, node)

  const keepouts: DoorKeepout[] = []
  for (const node of byId.values()) {
    if (node.type !== 'door') continue
    const wallId = node.wallId ?? node.parentId
    if (!wallId) continue
    const wall = byId.get(wallId)
    if (wall?.type !== 'wall') continue
    const levelId = resolveNodeLevelId(wall
```

### Core Architecture Module: `packages/core/src/agent-operations/duplicate-level.ts`
```
import { refuse } from '../agent-tools/refusal'
import {
  buildLevelDuplicateCreateOps,
  type LevelDuplicatePreset,
  levelBuildingId,
} from '../building/level-duplication'
import type { AnyNode, AnyNodeId } from '../schema'
import { requireLevel } from './level-target'
import { levelsOf } from './scene-queries'
import type { AgentOperation } from './types'

type DuplicateLevelInput = {
  levelId?: string
  position?: 'above' | 'below'
  name?: string
  preset?: LevelDuplicatePreset
}

const countByType = (nodes: readonly AnyNode[]) => {
  const counts: Record<string, number> = {}
  for (const node of nodes) counts[node.type] = (counts[node.type] ?? 0) + 1
  return counts
}

/** `duplicate_level`: the editor's level duplication, above or below the original. */
export const duplicateLevel: AgentOperation<DuplicateLevelInput> = (nodes, input, context) => {
  const levelId = input.levelId ?? context.activeLevelId
  if (!levelId) refuse('level_required', 'Say which level to copy: a levelId from list_levels.')
  const level = requireLevel(nodes, levelId)
  const all = nodes as Record<AnyNodeId, AnyNode>
  const buildingId = levelBuildingId(all, level)
  const building = buildingId ? nodes[buildingId] : undefined
  if (building?.type !== 'building')
    refuse('no_building', `Level ${levelId} is not in a building, so it has no floors to join.`, {
      levelId,
    })

  const { createOps, newLevelId, shiftedLevels, skippedNodes } = buildLevelDuplicateCreateOps({
    nodes: all,
    level,
    levels: levelsOf(nodes).filter(
      (entry) => entry.parentId === building.id || building.children.includes(entry.id),
    ),
    preset: input.preset ?? 'everything',
    position: input.position ?? 'above',
  })
  const name = input.name ?? level.name
  const create = createOps.map(({ node, parentId }) => ({
    node: node.id === newLevelId ? ({ ...node, name } as AnyNode) : node,
    parentId,
  }))
  const copy = create.find(({ node }) => node.id === newLevelId)!.node as { level: number }

  return {
    result: {
      newLevelId,
      name,
      floorIndex: copy.level,
      shiftedLevelIds: shiftedLevels.map((entry) => entry.id),
      copied: countByType(create.map(({ node }) => node)),
      skipped: countByType(skippedNodes),
      newNodeIds: create.map(({ node }) => node.id),
    },
    changes: {
      create,
      update: shiftedLevels.map((entry) => ({ id: entry.id, data: { level: entry.level } })),
    },
  }
}

```

### Core Architecture Module: `packages/core/src/agent-operations/find-by-type.ts`
```
import type { AnyNode, ItemNode } from '../schema'
import { levelIdOf } from './scene-queries'
import type { AgentOperation } from './types'

type Vec3 = [number, number, number]

const round = (v: number) => Math.round(v * 1000) / 1000

/** A point in an item's frame, in its level's frame (items on a level: position + yaw). */
function toLevel(item: ItemNode, [x, y, z]: Vec3): Vec3 {
  const yaw = item.rotation[1] ?? 0
  const [sx, sy, sz] = item.scale
  const lx = x * sx
  const lz = z * sz
  return [
    round(item.position[0] + Math.cos(yaw) * lx + Math.sin(yaw) * lz),
    round(item.position[1] + y * sy),
    round(item.position[2] - Math.sin(yaw) * lx + Math.cos(yaw) * lz),
  ]
}

function boundsInLevel(item: ItemNode, bounds: { min: Vec3; max: Vec3 }) {
  const corners: Vec3[] = []
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push(toLevel(item, [x, y, z]))
  return {
    min: [0, 1, 2].map((k) => Math.min(...corners.map((c) => c[k]!))) as Vec3,
    max: [0, 1, 2].map((k) => Math.max(...corners.map((c) => c[k]!))) as Vec3,
  }
}

const emitsLight = (node: AnyNode) =>
  node.type === 'item' &&
  Boolean(node.asset.interactive?.effects.some((effect) => effect.kind === 'light'))

const matchesWord = (text: string | undefined, word: string) =>
  Boolean(text) &&
  text!
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .includes(word)

/**
 * `find_by_type`: everything of one type, nodes and the typed parts of
 * authored objects alike. Parts are read from each object's manifest; the
 * object stays the thing that is selected, moved and edited.
 */
export const findByType: AgentOperation<{ type: string; levelId?: string }> = (
  nodes,
  { type, levelId },
) => {
  const word = type.trim().toLowerCase().replace(/s$/, '')
  const results: Record<string, unknown>[] = []
  for (const node of Object.values(nodes)) {
    const level = levelIdOf(nodes, node.id)
    if (levelId && level !== levelId) continue
    const item = node.type === 'item' ? node : null
    const typed = (item?.source?.manifest.parts ?? []).filter((part) => part.type)
    const typedParts = typed.filter((part) => part.type === word)
    // An authored object whose typed parts are all of this type is one (a
    // lantern); a mixed one (a porch) answers with its parts.
    const wholeAuthored = typedParts.length > 0 && typedParts.length === typed.length
    const wholeMatch =
      node.type === word ||
      wholeAuthored ||
      (item &&
        (matchesWord(item.asset.category, word) ||
          (word === 'light' && emitsLight(node) && typedParts.length === 0)))
    if (wholeMatch) {
      results.push({
        id: node.id,
        name: node.name ?? item?.asset.name,
        nodeType: node.type,
        levelId: level,
      })
      continue
    }
    for (const part of typedParts) {
      results.push({
        id: node.id,
        name: node.name ?? item!.asset.name,
        nodeType: node.type,
        levelId: level,
        part: part.id,
        partType: part.type,
        ...(part.bounds && item!.parentId === level
          ? { bounds: boundsInLevel(item!, part.bounds) }
          : {}),
      })
    }
  }
  return {
    result: {
      type: word,
      count: results.length,
      nodes: results.filter((entry) => !entry.part).length,
      parts: results.filter((entry) => entry.part).length,
      results,
    },
  }
}

```

### Core Architecture Module: `packages/core/src/agent-operations/get-node.ts`
```
import { refuse } from '../agent-tools/refusal'
import { isFloorAnchoredOpening } from '../lib/floor-opening-footprints'
import { getOpeningFloorDatum } from '../lib/opening-floor-datum'
import type { AgentOperation } from './types'

/** `get_node`: a node, whole; a door or window also says where its floor is and what it hangs from. */
export const getNode: AgentOperation<{ id: string }> = (nodes, { id }) => {
  const node = nodes[id]
  if (!node) refuse('node_not_found', `Node not found: ${id}.`, { id })
  const wall = node.parentId ? nodes[node.parentId] : undefined
  const resolvedOpening =
    (node.type === 'door' || node.type === 'window') && wall?.type === 'wall'
      ? {
          floorDatum: getOpeningFloorDatum(wall, node, nodes),
          anchor: isFloorAnchoredOpening(node) ? 'floor' : 'wall',
        }
      : undefined
  return { result: { node: resolvedOpening ? { ...node, resolvedOpening } : node } }
}

```

### Core Architecture Module: `packages/core/src/agent-operations/index.ts`
```
import { deleteNode } from './delete-node'
import { duplicateLevel } from './duplicate-level'
import { findByType } from './find-by-type'
import { getNode } from './get-node'
import { getLevelSummary, getWalls, getZones } from './level-reads'
import { listLevels } from './list-levels'
import { verifyScene } from './verify-scene'

export * from './add-object'
export * from './apply-changes'
export * from './delete-node'
export * from './door-clearance'
export * from './duplicate-level'
export * from './find-by-type'
export * from './get-node'
export * from './layout-clearance'
export * from './level-reads'
export * from './level-target'
export * from './list-levels'
export * from './plan-geometry'
export * from './scene-queries'
export * from './types'
export * from './verify-scene'

/** Each shared agent tool's operation, by tool name: what every surface executes. */
export const AGENT_OPERATIONS = {
  list_levels: listLevels,
  get_node: getNode,
  get_level_summary: getLevelSummary,
  get_walls: getWalls,
  get_zones: getZones,
  duplicate_level: duplicateLevel,
  verify_scene: verifyScene,
  delete_node: deleteNode,
  find_by_type: findByType,
} as const

```

### Core Architecture Module: `packages/core/src/agent-operations/layout-clearance.ts`
```
/**
 * Shared plan-layout clearance for agent tools.
 *
 * - Door keep-outs (level-scoped)
 * - Item–item AABB overlap (rotation + scale aware)
 * - Placement candidate search when primary pose is blocked
 *
 * See packages/mcp/docs/layout-clearance-error-log.md for regression checklist.
 */

import type { AnyNode } from '../schema'
import {
  aabbsOverlap,
  findBlockedDoors,
  itemNodePlanAabb,
  itemPlanAabb,
  type PlanAabb,
  resolveNodeLevelId,
} from './door-clearance'

export {
  aabbsOverlap,
  collectDoorKeepouts,
  findBlockedDoors,
  itemNodePlanAabb,
  itemPlanAabb,
  type PlanAabb,
  resolveNodeLevelId,
} from './door-clearance'

/** Minimum free space (m) required between item footprints. */
export const DEFAULT_ITEM_GAP = 0.08

export type OccupiedFootprint = {
  id: string
  name?: string
  levelId?: string | null
  aabb: PlanAabb
}

export type ItemCollision = {
  aId: string
  bId: string
  aName?: string
  bName?: string
  levelId?: string | null
  kind: 'item-aabb'
  violation: 'overlap' | 'clearance'
  minimumClearanceMeters: number
  message: string
}

export function nodeItemAabb(node: AnyNode): PlanAabb | null {
  return itemNodePlanAabb(node)
}

export function collectOccupiedFootprints(
  nodes: Iterable<AnyNode>,
  options?: { levelId?: string; excludeIds?: Set<string>; floorOnly?: boolean },
): OccupiedFootprint[] {
  const list = [...nodes]
  const byId = new Map<string, AnyNode>(list.map((n) => [n.id, n]))
  const out: OccupiedFootprint[] = []
  for (const node of list) {
    if (node.type !== 'item') continue
    if (options?.excludeIds?.has(node.id)) continue
    const attach = node.asset?.attachTo
    if (
      options?.floorOnly &&
      (attach === 'wall' || attach === 'wall-side' || attach === 'ceiling')
    ) {
      continue
    }
    const levelId = resolveNodeLevelId(node.id, byId)
    if (options?.levelId && levelId !== options.levelId) continue
    // Floor packing: prefer level-parented items (not wall-hosted children).
    if (options?.floorOnly && node.parentId && levelId && node.parentId !== levelId) {
      if (attach === 'wall' || attach === 'wall-side' || attach === 'ceiling') continue
      // Wall-parented items without attachTo still skipped for floor packing.
      if (byId.get(node.parentId)?.type === 'wall') continue
    }
    const aabb = nodeItemAabb(node)
    if (!aabb) continue
    const name = node.name ?? node.asset?.name
    out.push({
      id: node.id,
      name: typeof name === 'string' ? name : undefined,
      levelId,
      aabb,
    })
  }
  return out
}

export function findItemItemCollisions(args: {
  nodes: Iterable<AnyNode>
  levelId?: string
  gap?: number
}): ItemCollision[] {
  const gap = args.gap ?? DEFAULT_ITEM_GAP
  const footprints = collectOccupiedFootprints(args.nodes, { levelId: args.levelId })
  const collisions: ItemCollision[] = []
  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      const a = footprints[i]!
      const b = footprints[j]!
      if (a.levelId && b.levelId && a.levelId !== b.levelId) continue
      if (!aabbsOverlap(a.aabb, b.aabb, gap)) continue
      collisions.push({
        aId: a.id,
        bId: b.id,
        aName: a.name,
        bName: b.name,
        levelId: a.levelId ?? b.levelId,
        kind: 'item-aabb',
        violation: aabbsOverlap(a.aabb, b.aabb, 0) ? 'overlap' : 'clearance',
        minimumClearanceMeters: gap,
        message: aabbsOverlap(a.aabb, b.aabb, 0)
          ? `Items overlap: ${a.name ?? a.id} (${a.id}) and ${b.name ?? b.id} (${b.id})`
          : `Items are closer than ${gap} m: ${a.name ?? a.id} (${a.id}) and ${b.name ?? b.id} (${b.id})`,
      })
    }
  }
  return collisions
}

export type PlacementCandidate = {
  x: number
  z: number
  rotationDeg: number
}

export type PlacementRejectReason =
  | 'outside_bounds'
  | 'blocks_door_clearance'
  | 'overlaps_item'
  | 'ok'

export function classifyPlacement(args: {
  aabb: PlanAabb
  doorKeepouts: PlanAabb[]
  occupied: PlanAabb[]
  roomBounds?: { minX: number; maxX: number; minZ: number; maxZ: number }
  padding?: number
  itemGap?: number
  doorGap?: number
}): PlacementRejectReason {
  const padding = args.padding ?? 0.05
  const itemGap = args.itemGap ?? DEFAULT_ITEM_GAP
  const doorGap = args.doorGap ?? 0.02
  if (args.roomBounds) {
    const b = args.roomBounds
    if (
      args.aabb.minX < b.minX + padding ||
      args.aabb.maxX > b.maxX - padding ||
      args.aabb.minZ < b.minZ + padding ||
      args.aabb.maxZ > b.maxZ - padding
    ) {
      return 'outside_bounds'
    }
  }
  if (args.doorKeepouts.some((k) => aabbsOverlap(args.aabb, k, doorGap))) {
    return 'blocks_door_clearance'
  }
  if (args.occupied.some((o) => aabbsOverlap(args.aabb, o, itemGap))) {
    return 'overlaps_item'
  }
  return 'ok'
}

export function generatePlacementCandidates(
  primary: PlacementCandidate,
  options?: {
    lateralsM?: number[]
    insetsM?: number[]
    inward?: { x: number; z: number }
    along?: { x: number; z: number }
  },
): PlacementCandidate[] {
  const laterals = options?.lateralsM ?? [0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2]
  const insets = options?.insetsM ?? [0, 0.25, 0.5, 0.75]
  const along = options?.along ?? { x: 1, z: 0 }
  const inward = options?.inward ?? { x: 0, z: 1 }
  const out: PlacementCandidate[] = []
  const seen = new Set<string>()
  for (const lat of laterals) {
    for (const inset of insets) {
      const x = primary.x + along.x * lat + inward.x * inset
      const z = primary.z + along.z * lat + inward.z * inset
      const key = `${x.toFixed(3)},${z.toFixed(3)},${primary.rotationDeg}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ x, z, rotationDeg: primary.rotationDeg })
    }
  }
  return out
}

export function findValidPlacement(args: {
  primary: PlacementCandidate
  dimensions: [number, number, number] | number[] | undefined
  doorKeepouts: PlanAabb[]
  occupied: PlanAabb[]
  roomBounds?: { minX: number; maxX: number; minZ: number; maxZ: number }
  along?: { x: number; z: number }
  inward?: { x: number; z: number }
}):
  | { candidate: PlacementCandidate; reason: PlacementRejectReason }
  | { candidate: null; reason: PlacementRejectReason } {
  const candidates = generatePlacementCandidates(args.primary, {
    along: args.along,
    inward: args.inward,
  })

  // Prefer reporting why the **primary** pose failed (door/overlap), not the
  // last lateral/inset candidate (often outside_bounds after large nudges).
  let primaryReason: PlacementRejectReason | null = null
  const reasonPriority: PlacementRejectReason[] = [
    'blocks_door_clearance',
    'overlaps_item',
    'outside_bounds',
  ]
  let bestFailReason: PlacementRejectReason = 'overlaps_item'

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!
    const rot = (c.rotationDeg * Math.PI) / 180
    const aabb = itemPlanAabb([c.x, 0, c.z], args.dimensions, rot)
    const reason = classifyPlacement({
      aabb,
      doorKeepouts: args.doorKeepouts,
      occupied: args.occupied,
      roomBounds: args.roomBounds,
    })
    if (reason === 'ok') return { candidate: c, reason }
    if (i === 0) primaryReason = reason
    const prevRank = reasonPriority.indexOf(bestFailReason)
    const nextRank = reasonPriority.indexOf(reason)
    if (nextRank >= 0 && (prevRank < 0 || nextRank < prevRank)) {
      bestFailReason = reason
    }
  }
  return { candidate: null, reason: primaryReason ?? bestFailReason }
}

/**
 * Collect layout issues, scoped per level so stacked floors do not false-positive.
 */
export function layoutIssuesFromScene(
  nodes: Iterable<AnyNode>,
): { type: 'door_blocked' | 'item_overlap' | 'item_too_close'; message: string }[] {
  const list = [...nodes]
  const byId = new Map(list.map((n) => [n.id, n] as const))
  const levelIds = new Set<string>()
  for (const n of list) {
    if (n.type === 'level') levelIds.add(n.id)
  }
  // Also collect levels referenced by walls/items (in case filter missed)
  for (const n of list) {
    const lid = resolveNodeLevelId(n.id, byId)
    if (lid) levelIds.add(lid)
  }

  const issues = new Map<string, 'door_blocked' | 'item_overlap' | 'item_too_close'>()
  const levels = levelIds.size > 0 ? [...levelIds] : [undefined]

  for (const levelId of levels) {
    for (const b of findBlockedDoors({ nodes: list, levelId })) {
      issues.set(b.message, 'door_blocked')
    }
    for (const c of findItemItemCollisions({ nodes: list, levelId })) {
      issues.set(c.message, c.violation === 'overlap' ? 'item_overlap' : 'item_too_close')
    }
  }

  // Deduplicate (node may appear under multiple walks)
  return [...issues].map(([message, type]) => ({ type, message }))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #826** (2026-09-12): **[CRITICAL]: SECURITY.md asks for Private Vulnerability Reporting, but there is no "Report a vulnerability" button**
  *Symptoms*: ### What happened?  ### Bug Description  SECURITY.md tells researchers not to file public GitHub issues and to use GitHub Private Vulnerability Reporting:  > Go to the Security tab of the repository, click on "Advisories", and select "Report a vulnerability".  That button is not available to me as an external reporter.  On the Security Overview page, all three features show as Enabled:  - Security policy • Enabled - Security advisories • Enabled - Private vulnerability reporting • Enabled  Enabled in Overview is not the same as a working intake path. I can open the policy and the advisories list, but I never get a "Report a vulnerability" action. The Advisories page is empty ("There aren't any published security advisories") with no report CTA.  I have verified security findings that I am withholding from this public issue on purpose, per your own policy. I cannot send them until a private report button (or another private inbox) actually works for non-maintainers.  Please expose "Report a vulnerability" for logged-in outside contributors, or reply here with a private intake (security email or a handle I can contact). Do not ask me to paste the findings on this thread.  ### Steps to reproduce  1. Open https://github.com/pascalorg/editor (logged in to GitHub, not a maintainer). 2. Click the Security tab. 3. Open Security Overview and confirm all three rows are Enabled:    - Security policy • Enabled → "View security policy"    - Security advisories • Enabled → "View security a
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this publicly without disclosing the findings. You were right: the repository setting was disabled even though the security policy pointed to it. Private vulnerability reporting is now enabled. Please use the new “Report a vulnerability” action under Security → Advisories; if GitHub still does not show it for your account, security@pascal.app remains available. I’m closing this public intake issue now so the actual findings can move to the private channel.

- **Issue #734** (2026-09-12): **Save Build / Load Build round-trip drops collections**
  *Symptoms*: Split out of #729 (review note). Materials had the same gap on the import side; #729 fixes materials — collections have it on **both** sides:  - `handleSaveBuild` (`packages/editor/src/components/ui/sidebar/panels/settings-panel/index.tsx`) exports `{ nodes, rootNodeIds, installedPlugins }` — no `collections`. - `validateBuildJson` (`packages/core/src/validation/validate-build-json.ts`) has no `collections` pass, so even a hand-added table is silently dropped. - `handleConfirmImport` doesn't pass collections to `setScene` — although `setScene` already accepts `extra.collections`, and the hosted loader round-trips them.  Repro: create a collection, Save Build, Load Build the same file → collection gone.  Fix shape mirrors #729: include `collections` in the saved `sceneData`, add a validated pass in `validateBuildJson` (per-entry skip + warning naming the skipped ids), pass through to `setScene`.

- **Issue #725** (2026-08-31): **MCP live-sync silently drops mutations when no active scene is bound**
  *Symptoms*: Found by @Srujanreddy1234 while investigating chat/prompt persistence (#561) — the PR went stale but the underlying observation is correct and still unfixed on main.  `packages/mcp/src/operations/live-sync.ts:33`:  ```ts if (!(active && operations.canAppendSceneEvents)) return ```  When a store is attached but no scene is bound, `publishLiveSceneSnapshot` returns silently: mutations vanish with no error, no log, and no signal to the caller. The failure mode sends people hunting in the wrong layer (chat, prompts, transport) when the real cause is an unbound scene.  **Design decision needed before fixing** (the question #561 never resolved): throw a typed `no_active_scene` error, or lazily bind a draft scene so the mutation lands somewhere recoverable. Constraints:  - `src/bin/pascal-mcp.ts` attaches a store unconditionally and never calls `setActiveScene` in the plain `--stdio` flow, so a bare throw would break the README quick start on the first `create_wall`. - Main already has the narrower `canAppendSceneEvents` gate (`scene-operations.ts:103`), which is the seam a correct fix should build on. - Whatever the choice, it needs a test — which also means teaching `InMemorySceneStore` (`tools/scene-lifecycle/test-utils.ts`) `appendSceneEvent`/`listSceneEvents`, which it currently lacks.  Related: #706 fixed the `this`-binding bug on the same `appendSceneEvent` path (shipped in `263b4ab6`, #489).
  **Post-Mortem & Fix Analysis**:
  > Design decision, and a candidate: #736.  Between the two options #561 debated, neither survives the constraints in this issue. A typed `no_active_scene` throw breaks the `--stdio` quick start on the first `create_wall` (the store is attached, no scene is ever bound). Lazy draft binding silently creates persistent scenes the user never asked for, and not every store can create one without project context.  What #736 does instead: kills the *silence* rather than the skip. `publishLiveSceneSnapshot` returns `'published' | 'unbound' | 'events_unsupported'` (split on the existing `canAppendSceneEvents` seam), and all 17 mutating tool sites surface a `persistence: { status, warning }` field in their result when the change stayed in-memory — declared in each tool's output schema so structured-content validation keeps it. An AI caller reads the warning and binds a scene with `save_scene`/`load_scene`; a human reading the transcript sees exactly why nothing persisted, in the layer where they we

- **Issue #715** (2026-09-12): **@pascal-app/editor beta.5 pulls node:module into external browser builds through Manifold print export**
  *Symptoms*: ### What happened?  Hi Pascal team,  we are integrating @pascal-app/editor into an external Next.js application and found a browser packaging issue in beta.5.  The public @pascal-app/editor root pulls the Manifold print-export path into the browser dependency graph even when print export is not used.  As a result, an optimized Next/Webpack build fails when it reaches `node:module` through `manifold-3d`.  The relevant import chain is:  node:module → manifold-3d → print-shell-compiler-manifold-core → print-shell-compiler-manifold.worker → print-shell-compiler-manifold-worker → export-manager.tsx → @pascal-app/editor root → external Next.js application  The build error is:  Module build failed: UnhandledSchemeError: Reading from "node:module" is not handled by plugins.  The editor APIs and runtime functionality we use otherwise work correctly. The failure is specifically at the optimized browser production-build boundary.  ### Steps to reproduce  1. Consume the public `@pascal-app/editor` root from an external Next.js application. 2. Use the current beta.5 source. 3. Import the editor through its public package entrypoint. 4. Run an optimized Next/Webpack production build. 5. The browser bundle traverses the print-export dependency path and eventually reaches `node:module` through `manifold-3d`. 6. The build fails with `UnhandledSchemeError`.  We most recently rechecked exact upstream source SHA:  cfe13068fe9e4ef97c1b94ce24f5a40b44d5fe07  The issue is still present there.  ### E
  **Post-Mortem & Fix Analysis**:
  > Thanks — this is real, and the chain you traced is accurate. Two clarifications, then where I land.  First, the version: published `@pascal-app/editor@1.0.0-beta.5` went out on 2026-08-18, and the print export landed on 2026-08-21 in #701. So the npm beta.5 tarball has no manifold in it at all — what you're hitting is `main` (your `cfe13068` re-test is after both #701 and #703). Worth knowing so you don't chase the wrong artifact.  Second, #703 doesn't help you. It only collapsed the print-export UI into a single button; the import chain is unchanged. `export-manager.tsx` still statically imports the manifold worker module, and `ExportManager` renders unconditionally from the editor root, so it's in every consumer's graph.  Confirmed at `main`: `manifold-3d@3.5.1` has no `browser` field and its `.` entry is the emscripten `manifold.js` that reads `node:module`. Webpack statically parses the `new Worker(new URL(...))` call and builds that chunk, which is where it dies. Our own builds do
  > Thanks - sounds good.  Please ping me when you have a candidate and I’ll validate it against our external Next/Webpack integration.  We’ll stay pinned for now rather than add the `resolve.fallback` workaround, since the current integration is stable and I’d prefer to verify the proper browser-safe boundary once it’s available.  And thanks again for looking into this. 
  > @smokie40 Candidate is up: #735.  The shape, so you can judge it before spending time: the worker chunk is still built by your bundler, but it no longer contains any traceable `manifold-3d` specifier. The core module keeps only a type import; the emscripten factory loads at runtime through an `import()` webpack can't follow — bare specifier first, then a version-pinned jsDelivr copy of `manifold.js` (the wasm self-resolves relative to the glue's URL). So your build stops seeing `node:module` entirely, and print export in a bundled browser app runs off the CDN copy unless you point `configureManifoldRuntime({ moduleUrl, wasmUrl })` at self-hosted assets — that's the new export on the package entry, worth wiring if your deployment is CSP-strict or offline.  If you can validate the branch against your external Next/webpack integration, that's the last piece I can't reproduce exactly on my side: `github:pascalorg/editor#fix/manifold-out-of-bundler-graph`, or wait for the merge and test `ma

- **Issue #706** (2026-08-28): **[Bug] save_failed: this.withWriteTransaction undefined — appendSceneEvent loses `this` binding in SceneOperationsFacade**
  *Symptoms*: ### What happened?  Calling `create_from_template` with `save: true` throws:  ``` save_failed: undefined is not an object (evaluating 'this.withWriteTransaction') ```  **Root cause:** In `SceneOperationsFacade.appendSceneEvent()` (dist/operations/scene-operations.js), the store method is destructured from its object and then called as a plain function — losing the `this` binding:  ```js // BUGGY (before fix) async appendSceneEvent(options) {     const append = this.requireStore().appendSceneEvent; // method extracted     if (!append) return null;     return append(options); // called without this → this.withWriteTransaction is undefined } ```  When `append(options)` is called without a receiver, `this` inside `SqliteSceneStore.appendSceneEvent` is `undefined` (strict mode), and the first line `return this.withWriteTransaction(...)` throws.  The same pattern in `listSceneEvents` has the identical bug (store method destructured and called without binding).  **Call chain:** `create-from-template.js:126` → `appendLiveSceneEvent(bridge, ...)` → `live-sync.js:61` `operations.appendSceneEvent({...})` → `scene-operations.js:169` `const append = this.requireStore().appendSceneEvent` ← loses `this` → `scene-operations.js:172` `append(options)` → `sqlite-scene-store.js:385` `this.withWriteTransaction(...)` ← `this` is `undefined` → crash  ### Steps to reproduce  1. Install `@pascal-app/mcp` v0.3.2 globally: `bun install -g @pascal-app/mcp` 2. Set `PASCAL_DATA_DIR` to a writable director
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report — the lost  binding is clear. I'll put up a fix.
  > Great report — the diagnosis is exactly right, and the patch you wrote is character-for-character the one already on `main`: `263b4ab6` (#489), merged 2026-07-19. Both `appendSceneEvent` and `listSceneEvents` take the receiver properly now.  The reason you hit it is on me, though. The npm `latest` tag still points at `0.3.2` from 2026-07-17 — two days before that fix — so `bun install -g @pascal-app/mcp` hands you the stale build. I verified it by unpacking both tarballs: 0.3.2 has the unbound call, `1.0.0-beta.6` has the fix.  `bun install -g @pascal-app/mcp@beta` will get you a working `create_from_template --save` today. I'm sorting out the dist-tags so an unpinned install stops handing out a July build — the same stale resolve is behind two other reports. Closing this as fixed, but thank you: the dist-tag problem is the more valuable find and I wouldn't have gone looking without these reports landing together.  @aryansk — appreciate the offer, but no PR needed here; it's already fi

- **Issue #704** (2026-09-28): **No documented way to bridge a Pascal Capture (cloud) scan into the local MCP server; local MCP also fails to start under Cowork/Code with "Connection closed"**
  *Symptoms*: ### What happened?  Two related problems with the local MCP server (@pascal-app/mcp) and cloud/local project sync:  1. Cloud-to-local bridge: We're building a pipeline where a room is scanned via Pascal Capture (iPad LiDAR) into a cloud project (editor.pascal.app/editor/<project_id>), and we want to operate on that project via the local MCP server (get_walls, export_json, etc.) instead of manually re-measuring. Testing shows the cloud web editor and the local MCP server are two entirely separate data stores: calling get_project_status against a real cloud project id from the local MCP server returns project_not_found.  2. Separate connection failure: in Claude's Cowork/Code environment, the Local MCP servers panel shows the pascal server status as "failed", with the error: "Couldn't start this server for Cowork and Code sessions (they run their own copy of it), so they can't use its tools: Connection closed" This is a different symptom from the draft-07 outputSchema error reported separately — this one is the server process itself failing to start when a second/independent copy is spawned for these session types.  ### Steps to reproduce  For (1): 1. Scan a room with Pascal Capture on iPad, creating a cloud project at editor.pascal.app/editor/<project_id> 2. Run the local MCP server (bunx @pascal-app/mcp) and call get_project_status with that same project id 3. Observe project_not_found  For (2): 1. Open Claude's Cowork/Code environment with @pascal-app/mcp configured as a loc
  **Post-Mortem & Fix Analysis**:
  > Splitting these, because (2) turned out to be a straightforward bug on my side and (1) is a real gap.  **(2) "Connection closed" — reproduced, root cause found.** The published package can't run under Node at all. Its dist has 189 extensionless relative import specifiers and zero with `.js`, so Node's ESM resolver fails on the very first import:  ``` Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../dist/bridge/node-shims' ```  Bun tolerates extensionless specifiers, which is why `bunx @pascal-app/mcp` works standalone and Claude Desktop is fine. Anything that spawns its own copy under Node dies before the transport connects, and the client reports that as "Connection closed." Worse, `0.3.2`'s shebang is `#!/usr/bin/env bun` but `1.0.0-beta.6`'s is `#!/usr/bin/env node` — so the newer package advertises a Node entrypoint it can't execute. That's mine to fix and it's the priority here.  While I'm in there: `createSceneStore()` currently runs before the transport connects, so a sandb
  > Status update from a fresh September 12 check: the runtime half is still reproducible in the published `@pascal-app/mcp@1.0.0`. Its Node entrypoint exits on the first extensionless ESM import with `ERR_MODULE_NOT_FOUND`. #861 now fixes emitted imports in both MCP and its core peer and adds real Node CLI/subpath smoke gates; I verified packed tarballs in an isolated Node 26 consumer. I’ll keep this issue open until that fix is merged and released. The separate Capture cloud→local handoff remains tracked by #737.
  > #861 merged on September 12, 2026 (`5275f3e`). The source tree now emits Node-resolvable JavaScript and declaration imports, and CI covers the Node CLI entrypoint.  I’m keeping this issue open because the package currently published on npm is still `@pascal-app/mcp@1.0.0`, which predates the fix. The runtime half is resolved in source but will only be resolved for users after the next coordinated `@pascal-app/core` + `@pascal-app/mcp` release. The separate Capture cloud→local handoff remains tracked by #737. 

- **Issue #696** (2026-09-12): **MCP tool output schemas declare `draft-07` dialect — rejected by clients enforcing JSON Schema 2020-12**
  *Symptoms*: ### What happened?  Every tool call against the local @pascal-app/mcp server fails immediately with a schema validation error, even though the server process itself starts and runs fine:  Error: Tool '<tool_name>' has an invalid outputSchema: JSON Schema declares an unsupported dialect ("$schema": "http://json-schema.org/draft-07/schema#"). The default validator supports JSON Schema 2020-12 only; pass a pre-configured Ajv instance to AjvJs  Confirmed to affect every tool tried, including: list_levels, get_walls, export_json, create_project, list_scenes.  Environment: - Package: @pascal-app/mcp (installed via `bunx @pascal-app/mcp`, unpinned/latest tag as of 2026-08-20) - Client: Claude Desktop (macOS), via its MCP connector config - The server itself starts fine standalone (`bunx @pascal-app/mcp` prints "[pascal-mcp] stdio server running" and hangs waiting for a client) — so this is specifically about how tool output schemas are declared, not a startup/connectivity issue. - Refreshing the client's tool list and fully restarting the MCP connection does not change the error.  ### Steps to reproduce  1. Configure @pascal-app/mcp as an MCP server in Claude Desktop (bunx @pascal-app/mcp) 2. Call any tool, e.g. list_levels, get_walls, or export_json 3. See the outputSchema validation error above instead of a result  ### Expected behavior  **The tool call should succeed and return the requested data. The outputSchema fields should use the JSON Schema 2020-12 dialect (or omit/correct
  **Post-Mortem & Fix Analysis**:
  > Confirmed, and thanks for the precise error text — it pointed straight at the cause.  This is an upstream default we're inheriting. The MCP SDK's `McpServer` converts tool schemas via `toJsonSchemaCompat` without passing a `target`, and the compat layer's fallback is `draft-7`. I reproduced it against our installed SDK and zod 4.4.3:  ``` {"$schema":"http://json-schema.org/draft-07/schema#","type":"object",...} ```  I checked whether upgrading fixes it — it doesn't. SDK 1.30.0 has the same default and the same call sites with no `target`, and we're already on zod v4, so there's no version bump that gets us out of this. `registerTool` also has no JSON-Schema passthrough, so we can't hand it a pre-built 2020-12 schema.  The fix is on us anyway and it's small: re-register the `tools/list` handler after tool registration and normalize `$schema` on the way out. The SDK exposes `removeRequestHandler`, so that's about a dozen lines. Doing that rather than waiting on upstream, since your clien

- **Issue #647** (2026-09-12): **AI agent has no repsonse and always preparing**
  *Symptoms*: ### What happened?  <img width="324" height="180" alt="Image" src="https://github.com/user-attachments/assets/e437581d-6664-4c74-9da1-70e3a0ae52ec" />   I would like to get refund if it didnt work.  ### Steps to reproduce  Using ai agent to create objects  ### Expected behavior  fixed  ### Browser & OS  _No response_  ### Screenshots or screen recordings  _No response_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Sorry you hit this — a run that starts and never finishes is genuinely frustrating, and "Preparing the next step…" sticking around means the request began but never came back.  To actually find the cause I need something traceable, because at least three different failures look identical from the outside (credits exhausted, a stalled connection, or a provider error we're swallowing instead of showing you). Could you add:  - the project URL (`editor.pascal.app/editor/<id>`) - roughly when it happened, with your timezone - browser and OS - what you typed, and whether the credit counter moved  With the project id and a rough timestamp I can pull the actual run from our logs and tell you which of the three it was. If it turns out credits were taken for a run that never delivered, those go back regardless of what the root cause is — the account support channel can sort that without waiting on this bug.
  > I’m closing this individual report because the trace details requested on August 28 were never supplied, so there is no run we can diagnose or credit event we can reconcile. The underlying product defect—failed streams can leave the UI spinning without a useful error—remains open in #594. If this happens again, please open a fresh report with the project URL, approximate timestamp and timezone, browser/OS, prompt, and whether the credit counter moved.

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

### Incident Patch 1: `ff8b3deb` (2026-10-02)
**Commit Message**: feat(openings): add_window/add_door rebuild an opening by nodeId; author_object is for objects

The door's guidance (an open clip, width/height params) lives on add_door,
but every update went through author_object, which never mentions doors:
the scripted door came out without its open clip. A window or door is now
created and rebuilt through its own tool: add_window/add_door take nodeId
(new code, or the stored script with new params; wallId becomes optional)
through a rescriptOpening operation shared by the chat, the MCP, the
Parameters panel and the resize arrows. author_object refuses an opening's
id with where to go, and its description drops the door sentence. A wider
rebuild stays on its wall.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-operations/author-object.ts` (modified, +72/-48)
```diff
@@ -11,12 +11,10 @@ import { geometryRestingHeight, resettledPosition } from '../lib/geometry-surfac
 import {
   type AnyNode,
   type CompiledGeometryScript,
-  type DoorNode,
   type GeometryScriptMount,
   type GeometryScriptParamValue,
   generateId,
   ItemNode,
-  type WindowNode,
 } from '../schema'
 import { targetLevel } from './level-target'
 import type { AgentOperation } from './types'
@@ -114,44 +112,15 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
     input.rotation === undefined ? undefined : [0, (input.rotation * Math.PI) / 180, 0]
 
   if (input.nodeId) {
-    // New code may also give a native window or door its script; params alone need one already.
-    const previous = input.code
-      ? scriptTarget(nodes, input.nodeId)
-      : authoredObject(nodes, input.nodeId)
+    const previous = authoredObject(nodes, input.nodeId)
+    if (previous.type !== 'item')
+      refuse(
+        'use_opening_tool',
+        `${previous.id} is a ${previous.type}: rebuild it with add_${previous.type} and nodeId.`,
+        { id: previous.id, type: previous.type },
+      )
     const slotIds = new Set(compiled.manifest.slots.map((slot) => slot.id))
     const orphanedSlots = Object.keys(previous.slots ?? {}).filter((id) => !slotIds.has(id))
-    if (previous.type !== 'item') {
-      // A window or door keeps its place on the wall and its bottom edge; its size is what the script built.
-      if (compiled.mount !== 'wall')
-        refuse('wrong_mount', `A ${previous.type}'s script uses mount 'wall'.`, {
-          mount: compiled.mount,
-        })
-      const [width, height] = scriptedSize(compiled.manifest)
-      // Given a position, that is where it goes; otherwise its bottom edge stays put.
-      const [x, y, z] = previous.position
-      const position: Vec3 = (input.position as Vec3 | undefined) ?? [
-        x,
-        y - previous.height / 2 + height / 2,
-        z,
-      ]
-      return {
-        result: summary(previous, compiled, orphanedSlots),
-        changes: {
-          update: [
-            {
-              id: previous.id,
-              data: {
-                name: input.name ?? previous.name,
-                source: scriptSource(compiled),
-                width,
-                height,
-                position,
-              },
-            },
-          ],
-        },
-      }
-    }
     const next = ItemNode.parse({
       ...previous,
       name: input.name ?? previous.name,
@@ -214,6 +183,71 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
   }
 }
 
+export type RescriptOpeningInput = {
+  nodeId: string
+  /** Where it goes; without one its bottom edge stays put. */
+  position?: number[]
+  name?: string
+  /** What the host compiled: new code, or the stored script with new params. */
+  compiled: CompiledGeometryScript
+}
+
+/**
+ * `add_window` / `add_door` with a nodeId: a window or door built from (or
+ * given) a script, rebuilt from what the host compiled. Its size is what the
+ * script built; marks, hosting and the opening's own fields are kept.
+ */
+export const rescriptOpening: AgentOperation<RescriptOpeningInput> = (nodes, input) => {
+  const { compiled } = input
+  const previous = nodes[input.nodeId]
+  if (!previous) refuse('node_not_found', `Node not found: ${input.nodeId}.`, { id: input.nodeId })
+  if (previous.type !== 'window' && previous.type !== 'door')
+    refuse('not_an_opening', `${input.nodeId} is a ${previous.type}, not a window or door.`, {
+      id: input.nodeId,
+      type: previous.type,
+    })
+  const slotIds = new Set(compiled.manifest.slots.map((slot) => slot.id))
+  const orphanedSlots = Object.keys(previous.slots ?? {}).filter((id) => !slotIds.has(id))
+  // A window or door keeps its place on the wall and its bottom edge; its size is what the script built.
+  if (compiled.mount !== 'wall')
+    refuse('wrong_mount', `A ${previous.type}'s script uses mount 'wall'.`, {
+      mount: compiled.mount,
+    })
+  const [width, height] = scriptedSize(compiled.manifest)
+  // Given a position, that is where it goes; otherwise its bottom edge stays put.
+  const [x, y, z] = previous.position
+  const placed: Vec3 = (input.position as Vec3 | undefined) ?? [
+    x,
+    y - previous.height / 2 + height / 2,
+    z,
+  ]
+  // A wider rebuild stays on its wall, as a new opening does.
+  const wall = previous.wallId ? nodes[previous.wallId] : undefined
+  const wallLength =
+    wall?.type === 'wall' ? Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]) : 0
+  const position: Vec3 =
+    wallLength >= width
+      ? [Math.min(wallLength - width / 2, Math.max(width / 2, placed[0])), placed[1], placed[2]]
+      : placed
+  return {
+    result: summary(previous, compiled, orphanedSlots),
+    changes: {
+      update: [
+        {
+          id: previous.id,
+          data: {
+            name: input.name ?? previous.name,
+            so
```

**File**: `packages/core/src/agent-tools/author-object.ts` (modified, +3/-3)
```diff
@@ -17,12 +17,12 @@ Conventions (they make the object work in Pascal; follow them):
 - Paint: name every material slot_<finish> (slot_trim, slot_frame, slot_metal) and reuse one material per finish; a material named "glass" renders as glass.
 - Parts: name the few groups a person would point at part:<id> (part:column_left, part:canopy, part:landing), usually 2–24, a group per part, not every mesh. Set userData.type on parts someone would look for: column, beam, slab, roof, railing, panel, trim, step, light.
 - Lights: add a THREE.PointLight or SpotLight named light:<id> where the bulb is; it becomes a switchable light.
-- Motion: put THREE.AnimationClips on the returned group's .animations, as in any three.js project; tracks target <objectName>.<property> or <object.uuid>.<property> and may use any transform property (position, rotation, rotation[y], quaternion, scale); material and visibility tracks do not animate. A clip named open becomes the object's open/close control (close plays a clip named close, or open reversed); a clip named loop runs continuously; every other clip gets its own play toggle labelled with its name (name it for the person: "Twirl", "Music"). Write as many clips as the object needs. A window or door opens with its open clip (the sash, the leaves): write one unless it is fixed.
+- Motion: put THREE.AnimationClips on the returned group's .animations, as in any three.js project; tracks target <objectName>.<property> or <object.uuid>.<property> and may use any transform property (position, rotation, rotation[y], quaternion, scale); material and visibility tracks do not animate. A clip named open becomes the object's open/close control (close plays a clip named close, or open reversed); a clip named loop runs continuously; every other clip gets its own play toggle labelled with its name (name it for the person: "Twirl", "Music"). Write as many clips as the object needs.
 - Wall opening: a mesh named cutout (wall mount), shaped like the hole and as deep as the wall or deeper, is cut out of the host wall in that shape and never renders (a niche, a vent, a pass-through).
 - Sockets: an empty Object3D named anchor:<id> marks where other things attach.
 - No textures, network or DOM. At most 300k triangles, 32 materials, 60 m per side.
 
-Edit: pass nodeId (an object, or any window or door: code gives it a script, keeping its place and mark) with new code and/or params (params alone rebuild the stored script; read it first with read_source to change the code); identity, placement and paint are kept. The result lists the size, parts, slots, lights, animations and params.`
+Edit: pass nodeId with new code and/or params (params alone rebuild the stored script; read it first with read_source to change the code); identity, placement and paint are kept. The result lists the size, parts, slots, lights, animations and params.`
 
 export const authorObjectTool = {
   name: 'author_object',
@@ -74,7 +74,7 @@ export const readSourceTool = {
   name: 'read_source',
   title: 'Read object script',
   description:
-    "The three.js module an object (or a window or door built from code) runs, with its params and their current values. Read it before changing an object's code, then pass the edited module to author_object with the same nodeId.",
+    'The three.js module an object (or a window or door built from code) runs, with its params and their current values. Read it before changing its code, then pass the edited module back with the same nodeId: to author_object for an object, to add_window / add_door for a window or door.',
   input: {
     nodeId: NodeId.describe('An object, window or door built from code.'),
   },
```

**File**: `packages/core/src/agent-tools/wall-openings.ts` (modified, +8/-2)
```diff
@@ -58,7 +58,10 @@ export const addDoorTool = {
   description:
     'Add a door to an existing straight wall at t (0..1 along it). The door slides to stay on the wall and reports clamped. Refused with a code, as in the editor: curved walls, walls shorter than the door, and overlapping another door, window or wall item unless force is set. Match the reference with the outline (rectangle, rounded, arch), doorType and style.',
   input: {
-    wallId: NodeId.describe('The wall to add the door to.'),
+    wallId: NodeId.optional().describe('The wall to add the door to.'),
+    nodeId: NodeId.optional().describe(
+      'Rebuild this door instead of adding one: new code and/or params (read_source first to change its code). Its native fields change with update_node.',
+    ),
     ...placement,
     width: measurement('length', 'm', {
       positive: true,
@@ -93,7 +96,10 @@ export const addWindowTool = {
   description:
     "Add a window to an existing straight wall at t (0..1 along it), on sillHeight above the floor. It slides to stay on the wall and under the wall's ceiling, and reports clamped. Refused with a code, as in the editor: curved walls, walls shorter than the window, and overlapping another door, window or wall item unless force is set. Match the reference with the outline (rectangle, rounded, arch), windowType and panes (columns × rows, or a style).",
   input: {
-    wallId: NodeId.describe('The wall to add the window to.'),
+    wallId: NodeId.optional().describe('The wall to add the window to.'),
+    nodeId: NodeId.optional().describe(
+      'Rebuild this window instead of adding one: new code and/or params (read_source first to change its code). Its native fields change with update_node.',
+    ),
     ...placement,
     width: measurement('length', 'm', {
       positive: true,
```

**File**: `packages/core/src/building/wall-openings.ts` (modified, +6/-1)
```diff
@@ -164,7 +164,7 @@ export function hasWallChildOverlap(
 
 export type WallOpeningInput = {
   kind: 'door' | 'window'
-  wallId: string
+  wallId?: string
   t?: number
   position?: number
   width?: number
@@ -201,6 +201,11 @@ const metres = (value: number) => `${value.toFixed(2)} m`
  */
 export function planWallOpening(nodes: Nodes, input: WallOpeningInput) {
   const { kind, wallId } = input
+  if (!wallId)
+    refuse(
+      'wall_required',
+      `Say which wall the ${kind} goes on (wallId), or pass nodeId to rebuild one.`,
+    )
   const host = nodes[wallId]
   if (!host) refuse('wall_not_found', `Wall not found: ${wallId}.`, { wallId })
   if (host.type !== 'wall')
```

**File**: `packages/editor/src/lib/geometry-script/author.ts` (modified, +6/-6)
```diff
@@ -6,7 +6,7 @@ import {
   getArtifactStore,
   useScene,
 } from '@pascal-app/core'
-import { authoredObject, authorObject } from '@pascal-app/core/agent-operations'
+import { authoredObject, authorObject, rescriptOpening } from '@pascal-app/core/agent-operations'
 import { compileGeometryScriptInWorker } from './client'
 
 /**
@@ -56,11 +56,11 @@ export async function rebuildAuthoredObject(
   rebuildGeneration.set(nodeId, generation)
   const compiled = await compileAndStoreGeometryScript({ nodeId, params })
   if (rebuildGeneration.get(nodeId) !== generation) return
-  const { changes } = authorObject(
-    useScene.getState().nodes,
-    { params, nodeId, compiled, position },
-    { activeLevelId: null },
-  )
+  const nodes = useScene.getState().nodes
+  const opening = nodes[nodeId as AnyNodeId]?.type !== 'item'
+  const { changes } = opening
+    ? rescriptOpening(nodes, { nodeId, compiled, position }, { activeLevelId: null })
+    : authorObject(nodes, { params, nodeId, compiled, position }, { activeLevelId: null })
   for (const { id, data } of changes?.update ?? []) {
     useScene.getState().updateNode(id as AnyNodeId, data)
   }
```

**File**: `packages/mcp/src/tools/author-object.ts` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ export async function compileAndStore(
   return compiled
 }
 
-async function readScript(
+export async function readScript(
   host: GeometryScriptHost,
   sceneId: string,
   bridge: SceneOperations,
```

**File**: `packages/mcp/src/tools/room-tools.ts` (modified, +65/-2)
```diff
@@ -10,9 +10,10 @@ import {
   type PlanAabb,
   polygonArea,
   polygonBounds,
+  rescriptOpening,
   type Vec2,
 } from '@pascal-app/core/agent-operations'
-import { addDoorTool, addWindowTool } from '@pascal-app/core/agent-tools'
+import { addDoorTool, addWindowTool, isAgentRefusal } from '@pascal-app/core/agent-tools'
 import { planWallOpening } from '@pascal-app/core/building'
 import type {
   AnyNode,
@@ -27,7 +28,7 @@ import { z } from 'zod'
 import type { SceneOperations } from '../operations'
 import { ADDITIVE_TOOL_ANNOTATIONS, READ_ONLY_TOOL_ANNOTATIONS } from './annotations'
 import { findCatalogItem, searchCatalogItems } from './asset-catalog'
-import { compileAndStore, type GeometryScriptHost } from './author-object'
+import { compileAndStore, type GeometryScriptHost, readScript } from './author-object'
 import { ErrorCode, refusalResult, throwMcpError, toolError } from './errors'
 import {
   type LiveSyncStatus,
@@ -37,6 +38,7 @@ import {
 } from './live-sync'
 import { measurement } from './measurement'
 import { NodeIdSchema, Vec2Schema } from './schemas'
+import { toPatches } from './shared-tools'
 
 const ROOM_TYPES = [
   'bedroom',
@@ -539,6 +541,63 @@ export function registerCreateRoom(server: McpServer, bridge: SceneOperations):
   )
 }
 
+/**
+ * `add_door` / `add_window` with a nodeId: rebuild that opening from new code,
+ * or its stored script with new params, through the shared operation.
+ */
+async function rebuildOpening(
+  kind: 'door' | 'window',
+  bridge: SceneOperations,
+  host: GeometryScriptHost | undefined,
+  input: {
+    nodeId: string
+    code?: string
+    params?: Record<string, GeometryScriptParamValue>
+  },
+) {
+  if (!host)
+    return toolError('This Pascal server cannot run geometry scripts.', {
+      code: 'scripts_unavailable',
+    })
+  const scene = bridge.getActiveScene()
+  if (!scene) return toolError('Open or save a scene first.', { code: 'no_active_scene' })
+  const nodes = bridge.getNodes() as Record<string, AnyNode>
+  let outcome: ReturnType<typeof rescriptOpening>
+  try {
+    const code = input.code ?? (await readScript(host, scene.id, bridge, input.nodeId))
+    const compiled = await compileAndStore(host, scene.id, code, input.params)
+    outcome = rescriptOpening(nodes, { nodeId: input.nodeId, compiled }, { activeLevelId: null })
+  } catch (error) {
+    if (isAgentRefusal(error)) return refusalResult(error)
+    return toolError(error instanceof Error ? error.message : String(error), {
+      code: 'script_failed',
+    })
+  }
+  if (outcome.changes) bridge.applyPatch(toPatches(outcome.changes))
+  const node = bridge.getNodes()[input.nodeId as AnyNodeId] as AnyNode & {
+    position: [number, number, number]
+    height: number
+    wallId?: string
+  }
+  const wall = node.wallId
+    ? (bridge.getNodes()[node.wallId as AnyNodeId] as WallNodeType)
+    : undefined
+  const wallLength = wall ? Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]) : 0
+  const persistence = await publishLiveSceneSnapshot(bridge, `add_${kind}`)
+  return textResult({
+    [kind === 'door' ? 'doorId' : 'windowId']: input.nodeId,
+    localX: node.position[0],
+    t: wallLength ? node.position[0] / wallLength : 0,
+    position: wallLength ? node.position[0] / wallLength : 0,
+    wallLength,
+    clamped: false,
+    coordinateSystem: 'wall-local-meters' as const,
+    ...(kind === 'window' ? { sillHeight: node.position[1] - node.height / 2 } : {}),
+    ...outcome.result,
+    ...persistencePayload(persistence),
+  })
+}
+
 /** A door or window passed `code`: compiled and stored the way author_object does, or the tool's error. */
 async function compileOpeningScript(
   bridge: SceneOperations,
@@ -581,6 +640,8 @@ export function registerAddDoor(
       annotations: ADDITIVE_TOOL_ANNOTATIONS,
     },
     async (input) => {
+      if (input.nodeId)
+        return rebuildOpening('door', bridge, geometryScripts, { ...input, nodeId: input.nodeId })
       const compiled = await compileOpeningScript(bridge, geometryScripts, input)
       if ('error' in compiled) return compiled.error
       let planned: ReturnType<typeof planWallOpening>
@@ -624,6 +685,8 @@ export function registerAddWindow(
       annotations: ADDITIVE_TOOL_ANNOTATIONS,
     },
     async (input) => {
+      if (input.nodeId)
+        return rebuildOpening('window', bridge, geometryScripts, { ...input, nodeId: input.nodeId })
       const compiled = await compileOpeningScript(bridge, geometryScripts, input)
       if ('error' in compiled) return compiled.error
       let planned: ReturnType<typeof planWallOpening>
```

**File**: `wiki/architecture/authored-objects.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Applies to: `packages/geometry-script/**`, `item.source` in `packages/core/src/s
 
 An authored object is an `item` whose `source` holds the hash of its module (`script`), its `params`, the hash of the GLB it compiled to (`artifact`) and the `manifest` read from it. The code never rides in the scene: it is a `text/javascript` artifact that only people who may edit the project can read, so publishing geometry never publishes the code. The manifest stays inline because placement, cuts and queries read it synchronously; the compiler keeps it under 24 KiB (outlines thinned, then the smallest surfaces dropped). `asset.src` is `artifact://<sha256>` and `asset.dimensions` are the compiled bounds, so everything items already do (paint, hosting, lights, the move tool, plan footprint, collections, bake, export) applies unchanged. A catalog item is the same node without `source`.
 
-A `window` or `door` takes the same `source` when its fields cannot express the design (a fan grille, tracery, a carved leaf): `add_window`/`add_door` accept `code` and `params`. Everything script-side is shared with items: the renderer shows the artifact through the item's model path (`ScriptedOpeningModel`), the wall cuts its `cutout` mesh, the Parameters panel replaces the parametric frame's fields, an `open` clip is the Open control, `author_object` edits it by `nodeId` and `read_source` reads it. The kind keeps what makes it an opening: mark, schedule row, plan symbol, opening rules, `IfcWindow`/`IfcDoor`. Width and height are the compiled bounds; params named `width` and `height` are its size controls.
+A `window` or `door` takes the same `source` when its fields cannot express the design (a fan grille, tracery, a carved leaf): `add_window`/`add_door` accept `code` and `params`. Everything script-side is shared with items: the renderer shows the artifact through the item's model path (`ScriptedOpeningModel`), the wall cuts its `cutout` mesh, the Parameters panel replaces the parametric frame's fields, an `open` clip is the Open control, and `read_source` reads it. It is created and rebuilt through its own tool (`add_window`/`add_door`, with `nodeId` to rebuild), where the opening's guidance lives; `author_object` is for objects and points an opening's id there. The kind keeps what makes it an opening: mark, schedule row, plan symbol, opening rules, `IfcWindow`/`IfcDoor`. Width and height are the compiled bounds; params named `width` and `height` are its size controls.
 
 The artifact is the truth: the module runs again only when its code, params or host inputs change, never on view, publish or bake. Where artifacts live is the host's choice through `configureArtifactStore` (in-memory by default).
 
```

---

### Incident Patch 2: `63df9f15` (2026-10-02)
**Commit Message**: fix(openings): scripted openings export their clips, place the toolbar on what renders, and open by default

- GLB export: a window or door built from a script bakes its own clips
  (through the item path) instead of the parametric door/window baker, so
  its open/close reaches the file.
- The selection toolbar of a scripted node sits above its visible meshes,
  not its hidden hit box, cutout and collider; without a height param there
  is no height arrow to clear, so it uses the default lift.
- The hit box of a scripted opening is the script's bounds, never stale
  width/height fields.
- author_object's motion rule asks a window or door for an open clip (the
  path that scripts an existing door), and a position passed to it is taken
  as given; only without one does the bottom edge stay put.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-operations/author-object.ts` (modified, +8/-3)
```diff
@@ -127,8 +127,13 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
           mount: compiled.mount,
         })
       const [width, height] = scriptedSize(compiled.manifest)
-      const [x, y, z] = (input.position as Vec3 | undefined) ?? previous.position
-      const bottom = y - previous.height / 2
+      // Given a position, that is where it goes; otherwise its bottom edge stays put.
+      const [x, y, z] = previous.position
+      const position: Vec3 = (input.position as Vec3 | undefined) ?? [
+        x,
+        y - previous.height / 2 + height / 2,
+        z,
+      ]
       return {
         result: summary(previous, compiled, orphanedSlots),
         changes: {
@@ -140,7 +145,7 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
                 source: scriptSource(compiled),
                 width,
                 height,
-                position: [x, bottom + height / 2, z],
+                position,
               },
             },
           ],
```

**File**: `packages/core/src/agent-tools/author-object.ts` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ Conventions (they make the object work in Pascal; follow them):
 - Paint: name every material slot_<finish> (slot_trim, slot_frame, slot_metal) and reuse one material per finish; a material named "glass" renders as glass.
 - Parts: name the few groups a person would point at part:<id> (part:column_left, part:canopy, part:landing), usually 2–24, a group per part, not every mesh. Set userData.type on parts someone would look for: column, beam, slab, roof, railing, panel, trim, step, light.
 - Lights: add a THREE.PointLight or SpotLight named light:<id> where the bulb is; it becomes a switchable light.
-- Motion: put THREE.AnimationClips on the returned group's .animations, as in any three.js project; tracks target <objectName>.<property> or <object.uuid>.<property> and may use any transform property (position, rotation, rotation[y], quaternion, scale); material and visibility tracks do not animate. A clip named open becomes the object's open/close control (close plays a clip named close, or open reversed); a clip named loop runs continuously; every other clip gets its own play toggle labelled with its name (name it for the person: "Twirl", "Music"). Write as many clips as the object needs.
+- Motion: put THREE.AnimationClips on the returned group's .animations, as in any three.js project; tracks target <objectName>.<property> or <object.uuid>.<property> and may use any transform property (position, rotation, rotation[y], quaternion, scale); material and visibility tracks do not animate. A clip named open becomes the object's open/close control (close plays a clip named close, or open reversed); a clip named loop runs continuously; every other clip gets its own play toggle labelled with its name (name it for the person: "Twirl", "Music"). Write as many clips as the object needs. A window or door opens with its open clip (the sash, the leaves): write one unless it is fixed.
 - Wall opening: a mesh named cutout (wall mount), shaped like the hole and as deep as the wall or deeper, is cut out of the host wall in that shape and never renders (a niche, a vent, a pass-through).
 - Sockets: an empty Object3D named anchor:<id> marks where other things attach.
 - No textures, network or DOM. At most 300k triangles, 32 materials, 60 m per side.
```

**File**: `packages/editor/src/components/editor/floating-action-menu.tsx` (modified, +36/-1)
```diff
@@ -144,6 +144,14 @@ const MENU_Y_OFFSETS: Record<string, number> = {
 
 export function getMenuYOffset(node: AnyNode | null): number {
   if (!node) return MENU_Y_OFFSET_DEFAULT + EXTRA_MENU_LIFT
+  // A window or door built from a script has a height arrow only when its script declares height.
+  if (
+    (node.type === 'door' || node.type === 'window') &&
+    node.source &&
+    !node.source.manifest.params.some((spec) => spec.id === 'height')
+  ) {
+    return MENU_Y_OFFSET_DEFAULT + EXTRA_MENU_LIFT
+  }
   if (node.type === 'stair-segment') {
     return (MENU_Y_OFFSETS[`stair-${node.segmentType}`] ?? MENU_Y_OFFSET_DEFAULT) + EXTRA_MENU_LIFT
   }
@@ -236,6 +244,28 @@ function getObjectGeometryKey(object: THREE.Object3D): string {
   return parts.join('|')
 }
 
+const _meshBox = new THREE.Box3()
+
+/** The bounds of what renders: hidden objects and invisible-material hit boxes are skipped. */
+function setFromVisibleMeshes(box: THREE.Box3, root: THREE.Object3D): void {
+  box.makeEmpty()
+  root.updateWorldMatrix(true, true)
+  const visit = (object: THREE.Object3D) => {
+    if (!object.visible) return
+    const mesh = object as THREE.Mesh
+    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
+    const shown = Array.isArray(material) ? material.some((m) => m.visible) : material?.visible
+    if (mesh.isMesh && shown && mesh.geometry) {
+      mesh.geometry.computeBoundingBox()
+      if (mesh.geometry.boundingBox) {
+        box.union(_meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld))
+      }
+    }
+    for (const child of object.children) visit(child)
+  }
+  visit(root)
+}
+
 function setNodeDerivedMenuAnchor(
   node: AnyNode,
   object: THREE.Object3D,
@@ -450,7 +480,12 @@ export function FloatingActionMenu() {
       if (needsRecompute) {
         const effectiveNode = getEffectiveNode(node)
         if (!setNodeDerivedMenuAnchor(effectiveNode, obj, anchorRef.current)) {
-          _anchorBox.setFromObject(obj)
+          // Built from a script: its hidden hit box, cutout and collider are not what the person sees.
+          if ('source' in effectiveNode && effectiveNode.source)
+            setFromVisibleMeshes(_anchorBox, obj)
+          if (_anchorBox.isEmpty() || !('source' in effectiveNode && effectiveNode.source)) {
+            _anchorBox.setFromObject(obj)
+          }
           if (!_anchorBox.isEmpty()) {
             _anchorBox.getCenter(_anchorCenter)
             // Position above the object. Per-type offsets clear each kind's
```

**File**: `packages/editor/src/lib/glb-export.ts` (modified, +11/-7)
```diff
@@ -1444,15 +1444,19 @@ function bakeAnimationClips(
     const target = cloneByOriginal.get(original)
     if (!node || !target) continue
 
+    // A window or door built from a script carries its clips like an authored item.
+    const scripted = (node.type === 'door' || node.type === 'window') && node.source
     const clip =
       bakeRegistryAnimationClips(node, target) ??
-      (node.type === 'door'
-        ? bakeDoorClip(id, node, target)
-        : node.type === 'window'
-          ? bakeWindowClip(id, node as WindowNode, target)
-          : node.type === 'item'
-            ? bakeItemClip(id, target)
-            : null)
+      (scripted
+        ? bakeItemClip(id, target)
+        : node.type === 'door'
+          ? bakeDoorClip(id, node, target)
+          : node.type === 'window'
+            ? bakeWindowClip(id, node as WindowNode, target)
+            : node.type === 'item'
+              ? bakeItemClip(id, target)
+              : null)
 
     if (clip) {
       const nodeClips = Array.isArray(clip) ? clip : [clip]
```

**File**: `packages/viewer/src/systems/door/door-system.tsx` (modified, +8/-2)
```diff
@@ -11,6 +11,7 @@ import {
   type SceneMaterial,
   type SceneMaterialId,
   sceneRegistry,
+  scriptedSize,
   useInteractive,
   useLiveNodeOverrides,
   useScene,
@@ -2322,8 +2323,13 @@ function updateDoorMesh(rawNode: DoorNode, mesh: THREE.Mesh): boolean {
   mesh.position.set(...placement.position)
   mesh.rotation.set(...placement.rotation)
 
-  // Built from a script: the renderer shows its artifact, not the parametric frame.
-  if (node.source) return settleScriptedOpening(mesh)
+  // Built from a script: the renderer shows its artifact, not the parametric
+  // frame, and the hit box is what the script built.
+  if (node.source) {
+    mesh.geometry.dispose()
+    mesh.geometry = new THREE.BoxGeometry(...scriptedSize(node.source.manifest))
+    return settleScriptedOpening(mesh)
+  }
 
   // Dispose and remove all old visual children; preserve 'cutout'
   for (const child of [...mesh.children]) {
```

**File**: `packages/viewer/src/systems/window/window-system.tsx` (modified, +8/-2)
```diff
@@ -7,6 +7,7 @@ import {
   type SceneMaterial,
   type SceneMaterialId,
   sceneRegistry,
+  scriptedSize,
   useInteractive,
   useLiveNodeOverrides,
   useScene,
@@ -3391,8 +3392,13 @@ function updateWindowMesh(node: WindowNode, mesh: THREE.Mesh): boolean {
   mesh.position.set(...placement.position)
   mesh.rotation.set(...placement.rotation)
 
-  // Built from a script: the renderer shows its artifact, not the parametric frame.
-  if (node.source) return settleScriptedOpening(mesh)
+  // Built from a script: the renderer shows its artifact, not the parametric
+  // frame, and the hit box is what the script built.
+  if (node.source) {
+    mesh.geometry.dispose()
+    mesh.geometry = new THREE.BoxGeometry(...scriptedSize(node.source.manifest))
+    return settleScriptedOpening(mesh)
+  }
 
   // Dispose and remove all old visual children; preserve 'cutout'
   for (const child of [...mesh.children]) {
```

---

### Incident Patch 3: `77bc1ff8` (2026-10-02)
**Commit Message**: fix(geometry-script): clips are stored ending on their last pose; author_object scripts a native opening

The compiler re-samples clips through a mixer whose action looped, so the
sample at the clip's end wrapped to its first frame: an open clip opened,
then snapped shut, and closing (open reversed) ended open. The action now
plays once and holds; a regression test reads the stored GLB back.

author_object with new code may give an existing window or door its script,
keeping its place and mark, instead of the agent deleting and re-adding it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-operations/author-object.ts` (modified, +16/-1)
```diff
@@ -11,10 +11,12 @@ import { geometryRestingHeight, resettledPosition } from '../lib/geometry-surfac
 import {
   type AnyNode,
   type CompiledGeometryScript,
+  type DoorNode,
   type GeometryScriptMount,
   type GeometryScriptParamValue,
   generateId,
   ItemNode,
+  type WindowNode,
 } from '../schema'
 import { targetLevel } from './level-target'
 import type { AgentOperation } from './types'
@@ -112,7 +114,10 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
     input.rotation === undefined ? undefined : [0, (input.rotation * Math.PI) / 180, 0]
 
   if (input.nodeId) {
-    const previous = authoredObject(nodes, input.nodeId)
+    // New code may also give a native window or door its script; params alone need one already.
+    const previous = input.code
+      ? scriptTarget(nodes, input.nodeId)
+      : authoredObject(nodes, input.nodeId)
     const slotIds = new Set(compiled.manifest.slots.map((slot) => slot.id))
     const orphanedSlots = Object.keys(previous.slots ?? {}).filter((id) => !slotIds.has(id))
     if (previous.type !== 'item') {
@@ -217,6 +222,16 @@ export function authoredObject(nodes: Record<string, AnyNode>, nodeId: string):
   return node
 }
 
+/** What `author_object` with new code may edit: a scripted node, or a window or door taking its first script. */
+function scriptTarget(
+  nodes: Record<string, AnyNode>,
+  nodeId: string,
+): ScriptedNode | WindowNode | DoorNode {
+  const node = nodes[nodeId]
+  if (node?.type === 'window' || node?.type === 'door') return node
+  return authoredObject(nodes, nodeId)
+}
+
 /** What `read_source` answers once the host has the module's text. */
 export function readSourceResult(node: ScriptedNode, code: string) {
   return {
```

**File**: `packages/core/src/agent-tools/author-object.ts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ Conventions (they make the object work in Pascal; follow them):
 - Sockets: an empty Object3D named anchor:<id> marks where other things attach.
 - No textures, network or DOM. At most 300k triangles, 32 materials, 60 m per side.
 
-Edit: pass nodeId (an object, or a window or door built from code) with new code and/or params (params alone rebuild the stored script; read it first with read_source to change the code); identity, placement and paint are kept. The result lists the size, parts, slots, lights, animations and params.`
+Edit: pass nodeId (an object, or any window or door: code gives it a script, keeping its place and mark) with new code and/or params (params alone rebuild the stored script; read it first with read_source to change the code); identity, placement and paint are kept. The result lists the size, parts, slots, lights, animations and params.`
 
 export const authorObjectTool = {
   name: 'author_object',
```

**File**: `packages/geometry-script/bunfig.toml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+preload = ["../../scripts/bun-preload-three.ts"]
+
+[test]
+preload = ["../../scripts/bun-preload-three.ts"]
```

**File**: `packages/geometry-script/package.json` (modified, +2/-1)
```diff
@@ -25,7 +25,8 @@
     "build": "tsc --build",
     "dev": "tsgo --build --watch",
     "check-types": "tsgo --noEmit",
-    "prepublishOnly": "npm run build"
+    "prepublishOnly": "npm run build",
+    "test": "bun test"
   },
   "dependencies": {
     "@pascal-app/core": "^1.0.3",
```

**File**: `packages/geometry-script/src/compile.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { describe, expect, test } from 'bun:test'
+import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
+import { compileGeometryScript } from './compile'
+
+const SASH = `
+import * as THREE from 'three'
+export const mount = 'wall'
+export default function build() {
+  const g = new THREE.Group()
+  const sash = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05), new THREE.MeshStandardMaterial())
+  sash.name = 'sash'
+  g.add(sash)
+  const times = [0, 1]
+  g.animations = [new THREE.AnimationClip('open', 1, [new THREE.VectorKeyframeTrack('sash.position', times, [0, 0, 0, 0, 0.7, 0])])]
+  return g
+}
+`
+
+describe('clips', () => {
+  test('a clip is stored ending on its last pose, not wrapped to its first', async () => {
+    const { glb } = await compileGeometryScript({ code: SASH })
+    const gltf = await new GLTFLoader().parseAsync(glb, '')
+    const track = gltf.animations[0]!.tracks.find((t) => t.name.endsWith('.position'))!
+    const start = track.values[1]!
+    const end = track.values[track.values.length - 2]!
+    expect(end - start).toBeCloseTo(0.7, 3)
+  })
+})
```

**File**: `packages/geometry-script/src/compile.ts` (modified, +4/-0)
```diff
@@ -565,6 +565,10 @@ function sampleTransformClips(root: THREE.Object3D, clips: THREE.AnimationClip[]
       scale: [] as number[],
     }))
     const action = mixer.clipAction(clip)
+    // Played once and held: a looping action wraps to its first frame at the
+    // clip's end, so `open` would be stored ending closed.
+    action.setLoop(THREE.LoopOnce, 1)
+    action.clampWhenFinished = true
     action.play()
     for (const time of times) {
       mixer.setTime(time)
```

---

### Incident Patch 4: `3fd26144` (2026-10-02)
**Commit Message**: feat(openings): windows and doors built from a script, through the item's pipeline

A window or door takes the same source as an authored item when its fields
cannot express the design. add_window/add_door accept code and params
(compiled and stored as author_object does, on MCP and in the chat); the
size is the compiled bounds. The window and door systems keep the hitbox
and wall placement but leave the frame to the renderer, which shows the
artifact through the item's model path (paint slots, clips, lights,
settling); the wall cuts the script's cutout mesh, or the outline until it
loads. The Parameters panel replaces the parametric frame's fields, the
open clip is the Open control, author_object edits and read_source reads
any scripted node. Script helpers (scriptSource, scriptInteractive,
scriptedSize) move to core/lib/geometry-script-node.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-operations/author-object.ts` (modified, +42/-72)
```diff
@@ -1,5 +1,12 @@
 import { refuse } from '../agent-tools/refusal'
 import { artifactUrl } from '../lib/artifact-store'
+import {
+  isScriptedNode,
+  type ScriptedNode,
+  scriptedSize,
+  scriptInteractive,
+  scriptSource,
+} from '../lib/geometry-script-node'
 import { geometryRestingHeight, resettledPosition } from '../lib/geometry-surfaces'
 import {
   type AnyNode,
@@ -44,54 +51,6 @@ const HOSTS: Record<GeometryScriptMount, readonly AnyNode['type'][]> = {
   ceiling: ['ceiling'],
 }
 
-/**
- * The item's controls from what the module emitted: a light switch for its
- * lights, an open/close toggle for an `open` clip (closing plays `close`, or
- * `open` reversed), a `loop` clip that runs throughout, and a play toggle per
- * other clip, labelled with its name.
- */
-function scriptInteractive(
-  manifest: CompiledGeometryScript['manifest'],
-): ItemNode['asset']['interactive'] {
-  const controls: NonNullable<ItemNode['asset']['interactive']>['controls'] = []
-  const effects: NonNullable<ItemNode['asset']['interactive']>['effects'] = []
-  if (manifest.lights.length > 0) {
-    controls.push({ kind: 'toggle', label: 'Lights', default: true })
-    for (const light of manifest.lights) {
-      effects.push({
-        kind: 'light',
-        color: light.color,
-        intensityRange: [0, light.intensity],
-        distance: light.distance,
-        offset: light.position,
-      })
-    }
-  }
-  const clip = (name: string) => manifest.animations.some((animation) => animation.name === name)
-  if (clip('open')) {
-    effects.push({
-      kind: 'animation',
-      mode: 'open-close',
-      control: controls.length,
-      clips: { on: 'open', off: clip('close') ? 'close' : undefined },
-    })
-    controls.push({ kind: 'toggle', label: 'Open', default: false })
-  }
-  if (clip('loop')) effects.push({ kind: 'animation', mode: 'ambient', clips: { loop: 'loop' } })
-  // Every other clip gets its own play toggle, labelled with its name.
-  for (const { name } of manifest.animations) {
-    if (name === 'open' || name === 'close' || name === 'loop') continue
-    effects.push({
-      kind: 'animation',
-      mode: 'ambient',
-      control: controls.length,
-      clips: { on: name },
-    })
-    controls.push({ kind: 'toggle', label: name, default: false })
-  }
-  return effects.length > 0 ? { controls, effects } : undefined
-}
-
 function scriptAsset(
   compiled: CompiledGeometryScript,
   input: AuthorObjectInput,
@@ -116,18 +75,9 @@ function scriptAsset(
   }
 }
 
-const scriptSource = (compiled: CompiledGeometryScript) => ({
-  kind: 'script' as const,
-  language: 'three' as const,
-  script: compiled.script,
-  params: compiled.params,
-  artifact: compiled.sha256,
-  manifest: compiled.manifest,
-})
-
 const round = (value: number) => Math.round(value * 1000) / 1000
 
-function summary(node: ItemNode, compiled: CompiledGeometryScript, orphanedSlots: string[]) {
+function summary(node: { id: string }, compiled: CompiledGeometryScript, orphanedSlots: string[]) {
   const { bounds, parts, slots, lights, params, triangles, cutout, animations } = compiled.manifest
   return {
     nodeId: node.id,
@@ -165,6 +115,33 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
     const previous = authoredObject(nodes, input.nodeId)
     const slotIds = new Set(compiled.manifest.slots.map((slot) => slot.id))
     const orphanedSlots = Object.keys(previous.slots ?? {}).filter((id) => !slotIds.has(id))
+    if (previous.type !== 'item') {
+      // A window or door keeps its place on the wall and its bottom edge; its size is what the script built.
+      if (compiled.mount !== 'wall')
+        refuse('wrong_mount', `A ${previous.type}'s script uses mount 'wall'.`, {
+          mount: compiled.mount,
+        })
+      const [width, height] = scriptedSize(compiled.manifest)
+      const [x, y, z] = (input.position as Vec3 | undefined) ?? previous.position
+      const bottom = y - previous.height / 2
+      return {
+        result: summary(previous, compiled, orphanedSlots),
+        changes: {
+          update: [
+            {
+              id: previous.id,
+              data: {
+                name: input.name ?? previous.name,
+                source: scriptSource(compiled),
+                width,
+                height,
+                position: [x, bottom + height / 2, z],
+              },
+            },
+          ],
+        },
+      }
+    }
     const next = ItemNode.parse({
       ...previous,
       name: input.name ?? previous.name,
@@ -227,31 +204,24 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
   }
 }
 
-/** The authored object `read_source` and a params-only rebuild act on, or a refusal. */
-export function authoredObject(
-  nodes: Record<string, AnyNode>,
-  nodeId: string,
-): ItemNode & {
-  source: NonNullable<ItemNode['source']>
-} {
+/** The scripted node `read_source` and a params-only rebuild act 
```

**File**: `packages/core/src/agent-tools/author-object.ts` (modified, +3/-3)
```diff
@@ -22,7 +22,7 @@ Conventions (they make the object work in Pascal; follow them):
 - Sockets: an empty Object3D named anchor:<id> marks where other things attach.
 - No textures, network or DOM. At most 300k triangles, 32 materials, 60 m per side.
 
-Edit: pass nodeId with new code and/or params (params alone rebuild the stored script; read it first with read_source to change the code); identity, placement and paint are kept. The result lists the size, parts, slots, lights, animations and params.`
+Edit: pass nodeId (an object, or a window or door built from code) with new code and/or params (params alone rebuild the stored script; read it first with read_source to change the code); identity, placement and paint are kept. The result lists the size, parts, slots, lights, animations and params.`
 
 export const authorObjectTool = {
   name: 'author_object',
@@ -74,8 +74,8 @@ export const readSourceTool = {
   name: 'read_source',
   title: 'Read object script',
   description:
-    "The three.js module an object built with author_object runs, with its params and their current values. Read it before changing an object's code, then pass the edited module to author_object with the same nodeId.",
+    "The three.js module an object (or a window or door built from code) runs, with its params and their current values. Read it before changing an object's code, then pass the edited module to author_object with the same nodeId.",
   input: {
-    nodeId: NodeId.describe('An object built with author_object.'),
+    nodeId: NodeId.describe('An object, window or door built from code.'),
   },
 }
```

**File**: `packages/core/src/agent-tools/wall-openings.ts` (modified, +17/-0)
```diff
@@ -20,6 +20,21 @@ const placement = {
     ),
 }
 
+const script = (kind: string) => ({
+  code: z
+    .string()
+    .min(1)
+    .max(48_000)
+    .optional()
+    .describe(
+      `A three.js module for a ${kind} the fields cannot express (a fan grille, tracery, carved trim): the same module and conventions as author_object, with mount 'wall'. Its size is what it builds (name params width and height so the ${kind}'s size controls edit them), and its cutout mesh cuts the wall. Fields first; code only beyond them.`,
+    ),
+  params: z
+    .record(z.string(), z.union([z.number(), z.boolean(), z.string()]))
+    .optional()
+    .describe('Values for the params the module declares.'),
+})
+
 const outline = (archDefault: string) => ({
   openingShape: z
     .enum(['rectangle', 'rounded', 'arch'])
@@ -59,6 +74,7 @@ export const addDoorTool = {
       .optional()
       .describe('Which way the door opens (default inward).'),
     ...outline('0.45 m'),
+    ...script('door'),
     doorType: DoorType.optional().describe(
       'How it opens (default hinged); garage types for garage doors.',
     ),
@@ -92,6 +108,7 @@ export const addWindowTool = {
       description: 'Height from the floor to the bottom of the window (default 0.9 m).',
     }).optional(),
     ...outline('0.35 m'),
+    ...script('window'),
     windowType: WindowType.optional().describe('How it opens (default fixed).'),
     columns: z
       .number()
```

**File**: `packages/core/src/building/wall-openings.ts` (modified, +11/-2)
```diff
@@ -1,8 +1,10 @@
 import { refuse } from '../agent-tools/refusal'
+import { scriptedSize, scriptSource } from '../lib/geometry-script-node'
 import { wallSupportForNodes } from '../lib/opening-floor-datum'
 import {
   type AnyNode,
   type AnyNodeId,
+  type CompiledGeometryScript,
   DoorNode,
   getScaledDimensions,
   type ItemNode,
@@ -179,6 +181,8 @@ export type WallOpeningInput = {
   windowType?: WindowType
   columns?: number
   rows?: number
+  /** A compiled script the opening is built from; its bounds set width and height. */
+  compiled?: CompiledGeometryScript
 }
 
 const equalRatios = (count: number) => Array.from({ length: count }, () => 1 / count)
@@ -226,8 +230,12 @@ export function planWallOpening(nodes: Nodes, input: WallOpeningInput) {
       'Say where on the wall: t (or position) from 0 at its start to 1 at its end.',
     )
 
-  const width = input.width ?? DEFAULTS[kind].width
-  const height = input.height ?? DEFAULTS[kind].height
+  const { compiled } = input
+  if (compiled && compiled.mount !== 'wall')
+    refuse('wrong_mount', `A ${kind}'s script uses mount 'wall'.`, { mount: compiled.mount })
+  const [scriptedWidth, scriptedHeight] = compiled ? scriptedSize(compiled.manifest) : []
+  const width = scriptedWidth ?? input.width ?? DEFAULTS[kind].width
+  const height = scriptedHeight ?? input.height ?? DEFAULTS[kind].height
   const wallLength = lengthOf(wall)
   if (wallLength < width)
     refuse(
@@ -277,6 +285,7 @@ export function planWallOpening(nodes: Nodes, input: WallOpeningInput) {
     ...(input.openingShape ? { openingShape: input.openingShape } : {}),
     ...(input.archHeight === undefined ? {} : { archHeight: Math.min(input.archHeight, height) }),
     ...(input.cornerRadius === undefined ? {} : { cornerRadius: input.cornerRadius }),
+    ...(compiled ? { source: scriptSource(compiled) } : {}),
   }
   const node =
     kind === 'door'
```

**File**: `packages/core/src/contracts/reference-inventory.ts` (modified, +18/-15)
```diff
@@ -721,21 +721,24 @@ export const NON_REFERENCES: readonly { kind: string; path: string; reason: stri
     reason: 'Inline versioned recipe (R7 stores recipes above 24 KiB by hash).',
   },
   { kind: 'procedural-item', path: 'parameters.@key', reason: 'Recipe parameter name.' },
-  ...(
-    [
-      'source.manifest.anchors[].id',
-      'source.manifest.lights[].id',
-      'source.manifest.params[].id',
-      'source.manifest.parts[].id',
-      'source.manifest.slots[].id',
-    ] as const
-  ).map((path) => ({
-    kind: 'item',
-    path,
-    reason: "Defines a key in an authored object's compiled manifest, read from its script.",
-  })),
-  { kind: 'item', path: 'source.params.@key', reason: 'Authored script parameter name.' },
-  { kind: 'item', path: 'source.params.*', reason: 'Authored script parameter value.' },
+  // Scripted nodes (an authored item, or a window or door built from code) share one `source`.
+  ...(['item', 'window', 'door'] as const).flatMap((kind) => [
+    ...(
+      [
+        'source.manifest.anchors[].id',
+        'source.manifest.lights[].id',
+        'source.manifest.params[].id',
+        'source.manifest.parts[].id',
+        'source.manifest.slots[].id',
+      ] as const
+    ).map((path) => ({
+      kind,
+      path,
+      reason: "Defines a key in a scripted node's compiled manifest, read from its script.",
+    })),
+    { kind, path: 'source.params.@key', reason: 'Script parameter name.' },
+    { kind, path: 'source.params.*', reason: 'Script parameter value.' },
+  ]),
   { kind: 'scan', path: 'layers.@key', reason: 'Layer visibility flag name.' },
   { kind: 'site', path: 'frontEdge', reason: "Index of the lot polygon's street-facing edge." },
   ...[
```

**File**: `packages/core/src/index.ts` (modified, +7/-0)
```diff
@@ -170,6 +170,13 @@ export {
   withFloorStepOverride,
   withoutFloorStepOverrideKeys,
 } from './lib/floor-step-finish'
+export {
+  isScriptedNode,
+  type ScriptedNode,
+  scriptedSize,
+  scriptInteractive,
+  scriptSource,
+} from './lib/geometry-script-node'
 export {
   flushMountRotation,
   geometryRestingHeight,
```

**File**: `packages/core/src/lib/geometry-script-node.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import type { CompiledGeometryScript } from '../schema'
+import type { DoorNode } from '../schema/nodes/door'
+import type { ItemNode } from '../schema/nodes/item'
+import type { WindowNode } from '../schema/nodes/window'
+
+/** A node built from a three.js script: an authored item, or a window or door with a script source. */
+export type ScriptedNode = (ItemNode | WindowNode | DoorNode) & {
+  source: NonNullable<ItemNode['source']>
+}
+
+export const isScriptedNode = (
+  node: { type: string; source?: unknown } | undefined,
+): node is ScriptedNode =>
+  Boolean(node?.source) &&
+  (node!.type === 'item' || node!.type === 'window' || node!.type === 'door')
+
+/** The `source` a compile produces, the same on every kind. */
+export const scriptSource = (compiled: CompiledGeometryScript) => ({
+  kind: 'script' as const,
+  language: 'three' as const,
+  script: compiled.script,
+  params: compiled.params,
+  artifact: compiled.sha256,
+  manifest: compiled.manifest,
+})
+
+/** Width, height and depth of what the script built. */
+export function scriptedSize(
+  manifest: CompiledGeometryScript['manifest'],
+): [number, number, number] {
+  const { min, max } = manifest.bounds
+  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
+}
+
+/**
+ * The item's controls from what the module emitted: a light switch for its
+ * lights, an open/close toggle for an `open` clip (closing plays `close`, or
+ * `open` reversed), a `loop` clip that runs throughout, and a play toggle per
+ * other clip, labelled with its name.
+ */
+export function scriptInteractive(
+  manifest: CompiledGeometryScript['manifest'],
+): ItemNode['asset']['interactive'] {
+  const controls: NonNullable<ItemNode['asset']['interactive']>['controls'] = []
+  const effects: NonNullable<ItemNode['asset']['interactive']>['effects'] = []
+  if (manifest.lights.length > 0) {
+    controls.push({ kind: 'toggle', label: 'Lights', default: true })
+    for (const light of manifest.lights) {
+      effects.push({
+        kind: 'light',
+        color: light.color,
+        intensityRange: [0, light.intensity],
+        distance: light.distance,
+        offset: light.position,
+      })
+    }
+  }
+  const clip = (name: string) => manifest.animations.some((animation) => animation.name === name)
+  if (clip('open')) {
+    effects.push({
+      kind: 'animation',
+      mode: 'open-close',
+      control: controls.length,
+      clips: { on: 'open', off: clip('close') ? 'close' : undefined },
+    })
+    controls.push({ kind: 'toggle', label: 'Open', default: false })
+  }
+  if (clip('loop')) effects.push({ kind: 'animation', mode: 'ambient', clips: { loop: 'loop' } })
+  // Every other clip gets its own play toggle, labelled with its name.
+  for (const { name } of manifest.animations) {
+    if (name === 'open' || name === 'close' || name === 'loop') continue
+    effects.push({
+      kind: 'animation',
+      mode: 'ambient',
+      control: controls.length,
+      clips: { on: name },
+    })
+    controls.push({ kind: 'toggle', label: name, default: false })
+  }
+  return effects.length > 0 ? { controls, effects } : undefined
+}
```

**File**: `packages/core/src/schema/nodes/door.ts` (modified, +6/-0)
```diff
@@ -1,6 +1,7 @@
 import dedent from 'dedent'
 import { z } from 'zod'
 import { BaseNode, nodeType, objectId } from '../base'
+import { GeometryScriptSource } from '../geometry-source'
 import { MaterialSchema } from '../material'
 import { DoorType } from './opening-types'
 
@@ -44,6 +45,11 @@ export const DoorNode = BaseNode.extend({
   // door body), `glass`. Value = a `MaterialRef` (`library:<id>` / `scene:<id>`).
   // Absent = the body/glass default. Mirrors `ShelfNode.slots`.
   slots: z.record(z.string(), z.string()).optional(),
+  /**
+   * A three.js script the door is built from instead of its parametric frame, as on an item:
+   * width and height are the compiled bounds and the wall cuts the script's `cutout` mesh.
+   */
+  source: GeometryScriptSource.optional(),
 
   position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
   rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
```

---

### Incident Patch 5: `e30f17f8` (2026-10-02)
**Commit Message**: fix(agent-tools): shaped doors and windows go through author_object

author_object told models never to build doors or windows, so asked for an
arched window with a fan grille the chat offered a rectangular substitute.
add_door/add_window make rectangular openings; author_object builds every
other shape with a cutout shaped like the opening, and the opening tools
say so.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-tools/author-object.ts` (modified, +2/-2)
```diff
@@ -10,15 +10,15 @@ Module shape (import THREE from the three package as usual; the addons below too
   export const mount = 'floor'   // 'floor' | 'wall-side' (on a wall face) | 'wall' (through a wall, like a window) | 'ceiling'
   export default function build({ params, THREE }) { const group = new THREE.Group(); /* … */ return group }
 
-One object is one feature that changes together: a porch, a railing run, a fireplace surround, a ceiling with its beams. Never a whole house, and never walls, rooms, floors, roofs, stairs, doors or windows: those have their own tools.
+One object is one feature that changes together: a porch, a railing run, a fireplace surround, a ceiling with its beams. Never a whole house, and never walls, rooms, floors, roofs or stairs: those have their own tools. Doors and windows: add_door and add_window make rectangular ones; build any other shape here (an arched or round window, a fanlight, grilles, a carved or arched door) with mount 'wall' and a cutout shaped like the opening.
 
 Conventions (they make the object work in Pascal; follow them):
 - Metres, Y up, modelled as it stands. Pascal puts the bottom-centre of the bounds at the placement point; for wall-side the back face sits on the wall and the object faces +Z.
 - Paint: name every material slot_<finish> (slot_trim, slot_frame, slot_metal) and reuse one material per finish; a material named "glass" renders as glass.
 - Parts: name the few groups a person would point at part:<id> (part:column_left, part:canopy, part:landing), usually 2–24, a group per part, not every mesh. Set userData.type on parts someone would look for: column, beam, slab, roof, railing, panel, trim, step, light.
 - Lights: add a THREE.PointLight or SpotLight named light:<id> where the bulb is; it becomes a switchable light.
 - Motion: put THREE.AnimationClips on the returned group's .animations, as in any three.js project; tracks target <objectName>.<property> or <object.uuid>.<property> and may use any transform property (position, rotation, rotation[y], quaternion, scale); material and visibility tracks do not animate. A clip named open becomes the object's open/close control (close plays a clip named close, or open reversed); a clip named loop runs continuously; every other clip gets its own play toggle labelled with its name (name it for the person: "Twirl", "Music"). Write as many clips as the object needs.
-- Wall opening: a box mesh named cutout (wall mount) is cut out of the host wall and never renders.
+- Wall opening: a mesh named cutout (wall mount), shaped like the opening (a box, an arch, a circle) and as deep as the wall or deeper, is cut out of the host wall in that shape and never renders.
 - Sockets: an empty Object3D named anchor:<id> marks where other things attach.
 - No textures, network or DOM. At most 300k triangles, 32 materials, 60 m per side.
 
```

**File**: `packages/core/src/agent-tools/wall-openings.ts` (modified, +2/-2)
```diff
@@ -23,7 +23,7 @@ export const addDoorTool = {
   name: 'add_door',
   title: 'Add door',
   description:
-    'Add a door to an existing straight wall at t (0..1 along it). The door slides to stay on the wall and reports clamped. Refused with a code, as in the editor: curved walls, walls shorter than the door, and overlapping another door, window or wall item unless force is set.',
+    'Add a door to an existing straight wall at t (0..1 along it). The door slides to stay on the wall and reports clamped. Refused with a code, as in the editor: curved walls, walls shorter than the door, and overlapping another door, window or wall item unless force is set. Rectangular doors only: build an arched or otherwise shaped door with author_object.',
   input: {
     wallId: NodeId.describe('The wall to add the door to.'),
     ...placement,
@@ -53,7 +53,7 @@ export const addWindowTool = {
   name: 'add_window',
   title: 'Add window',
   description:
-    "Add a window to an existing straight wall at t (0..1 along it), on sillHeight above the floor. It slides to stay on the wall and under the wall's ceiling, and reports clamped. Refused with a code, as in the editor: curved walls, walls shorter than the window, and overlapping another door, window or wall item unless force is set.",
+    "Add a window to an existing straight wall at t (0..1 along it), on sillHeight above the floor. It slides to stay on the wall and under the wall's ceiling, and reports clamped. Refused with a code, as in the editor: curved walls, walls shorter than the window, and overlapping another door, window or wall item unless force is set. Rectangular windows only: build an arched, round or otherwise shaped window (fanlight, grilles) with author_object.",
   input: {
     wallId: NodeId.describe('The wall to add the window to.'),
     ...placement,
```

---

### Incident Patch 6: `042d2420` (2026-10-02)
**Commit Message**: fix(core): classify authored-manifest keys; keep a literal three import out of core

The reference inventory now lists the manifest and script-param keys an
authored item defines. The author_object description describes the three
import in words: the architecture scan reads core source text.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-tools/author-object.ts` (modified, +1/-2)
```diff
@@ -4,8 +4,7 @@ import { NodeId } from './node-id'
 
 const DESCRIPTION = `Build an object by writing a plain three.js module, the way you would in any three.js project. Use it for what the catalog and the structure tools cannot reproduce faithfully: custom columns and capitals, mouldings and trim, panels, lanterns and fixtures, exposed beams, vaulted or tray ceiling bodies, canopies, a porch, railings, built-ins. Pascal runs the module in a sandbox, stores the result and places it as one object the user can move, paint, and ask you to edit again.
 
-Module shape:
-  import * as THREE from 'three'
+Module shape (import THREE from the three package as usual; the addons below too):
   // also available: three/addons/utils/BufferGeometryUtils.js, three/addons/geometries/{RoundedBoxGeometry,ConvexGeometry,LoftGeometry,ParametricGeometry}.js, three-bvh-csg (Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION)
   export const params = { width: { default: 4.8, min: 3, max: 8, step: 0.1, unit: 'm', label: 'Width' } }
   export const mount = 'floor'   // 'floor' | 'wall-side' (on a wall face) | 'wall' (through a wall, like a window) | 'ceiling'
```

**File**: `packages/core/src/contracts/reference-inventory.ts` (modified, +15/-0)
```diff
@@ -721,6 +721,21 @@ export const NON_REFERENCES: readonly { kind: string; path: string; reason: stri
     reason: 'Inline versioned recipe (R7 stores recipes above 24 KiB by hash).',
   },
   { kind: 'procedural-item', path: 'parameters.@key', reason: 'Recipe parameter name.' },
+  ...(
+    [
+      'source.manifest.anchors[].id',
+      'source.manifest.lights[].id',
+      'source.manifest.params[].id',
+      'source.manifest.parts[].id',
+      'source.manifest.slots[].id',
+    ] as const
+  ).map((path) => ({
+    kind: 'item',
+    path,
+    reason: "Defines a key in an authored object's compiled manifest, read from its script.",
+  })),
+  { kind: 'item', path: 'source.params.@key', reason: 'Authored script parameter name.' },
+  { kind: 'item', path: 'source.params.*', reason: 'Authored script parameter value.' },
   { kind: 'scan', path: 'layers.@key', reason: 'Layer visibility flag name.' },
   { kind: 'site', path: 'frontEdge', reason: "Index of the lot polygon's street-facing edge." },
   ...[
```

---

### Incident Patch 7: `ac7b8e85` (2026-10-02)
**Commit Message**: feat(authored objects): children re-settle when the object is rebuilt

A rebuild (param change, code edit; panel, chat or MCP) re-seats the
object's children in the same undo step: a resting item back on the surface
under it, moved onto the main surface's nearest point when that shrank away
(a box on a narrowed porch), a hanging one from the underside above it.
The result lists what moved.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-operations/author-object.ts` (modified, +20/-3)
```diff
@@ -1,6 +1,6 @@
 import { refuse } from '../agent-tools/refusal'
 import { artifactUrl } from '../lib/artifact-store'
-import { geometryRestingHeight } from '../lib/geometry-surfaces'
+import { geometryRestingHeight, resettledPosition } from '../lib/geometry-surfaces'
 import {
   type AnyNode,
   type CompiledGeometryScript,
@@ -182,9 +182,26 @@ export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, co
       source: scriptSource(compiled, input.code),
       asset: scriptAsset(compiled, input, previous.asset),
     })
+    // Children resting on or hanging from the object follow its new geometry.
+    const resettled: { id: string; position: Vec3 }[] = []
+    for (const childId of previous.children) {
+      const child = nodes[childId]
+      if (child?.type !== 'item' || child.wallId) continue
+      const position = resettledPosition(compiled.manifest, child, next.scale)
+      if (!position || position.every((v, i) => Math.abs(v - child.position[i]!) < 1e-4)) continue
+      resettled.push({ id: child.id, position })
+    }
     return {
-      result: summary(next, compiled, orphanedSlots),
-      changes: { update: [{ id: next.id, data: next }] },
+      result: {
+        ...summary(next, compiled, orphanedSlots),
+        ...(resettled.length > 0 ? { resettled: resettled.map((entry) => entry.id) } : {}),
+      },
+      changes: {
+        update: [
+          { id: next.id, data: next },
+          ...resettled.map(({ id, position }) => ({ id, data: { position } })),
+        ],
+      },
     }
   }
 
```

**File**: `packages/core/src/index.ts` (modified, +2/-0)
```diff
@@ -176,6 +176,8 @@ export {
   geometrySurfaceAt,
   geometryUndersideAt,
   mountsFlush,
+  nearestPointIn,
+  resettledPosition,
 } from './lib/geometry-surfaces'
 export {
   type ExposedInterval,
```

**File**: `packages/core/src/lib/geometry-surfaces.ts` (modified, +59/-0)
```diff
@@ -137,3 +137,62 @@ export function mountsFlush(asset: {
 }): boolean {
   return Boolean(asset.recessed) || (asset.dimensions?.[1] ?? 1) <= FLUSH_MOUNT_MAX_HEIGHT
 }
+
+/** The closest point to (x, z) inside a convex outline (itself when inside). */
+export function nearestPointIn(
+  polygon: readonly [number, number][],
+  x: number,
+  z: number,
+): [number, number] {
+  if (contains(polygon as [number, number][], x, z)) return [x, z]
+  let best: [number, number] = [x, z]
+  let bestDistance = Number.POSITIVE_INFINITY
+  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
+    const [ax, az] = polygon[j]!
+    const [bx, bz] = polygon[i]!
+    const dx = bx - ax
+    const dz = bz - az
+    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
+    const px = ax + t * dx
+    const pz = az + t * dz
+    const distance = Math.hypot(px - x, pz - z)
+    if (distance < bestDistance) {
+      bestDistance = distance
+      best = [px, pz]
+    }
+  }
+  return best
+}
+
+/**
+ * Where a child item of an authored object sits after the object is rebuilt:
+ * a resting item back on the surface under it (moved onto the main surface
+ * when that shrank away from it), a hanging one from the underside above it.
+ * Positions are in the object's frame; `scale` is the object's. Null when
+ * nothing applies (wall-mounted children, objects without surfaces).
+ */
+export function resettledPosition(
+  manifest: Pick<GeometryArtifactManifest, 'surfaces' | 'undersides' | 'parts' | 'bounds'>,
+  child: {
+    position: readonly [number, number, number]
+    asset: { attachTo?: string; recessed?: boolean; dimensions?: readonly number[] }
+  },
+  scale: readonly [number, number, number],
+): [number, number, number] | null {
+  const [sx, sy, sz] = scale
+  const x = child.position[0] / sx
+  const z = child.position[2] / sz
+  if (child.asset.attachTo === 'ceiling') {
+    const underside = geometryUndersideAt(manifest, x, z)
+    if (!underside) return null
+    const drop = mountsFlush(child.asset) ? 0.02 : (child.asset.dimensions?.[1] ?? 0)
+    return [child.position[0], underside.y * sy - drop, child.position[2]]
+  }
+  if (child.asset.attachTo) return null
+  const surface = geometrySurfaceAt(manifest, x, z)
+  if (surface) return [child.position[0], surface.y * sy, child.position[2]]
+  const main = mainSurfaces(manifest).sort((a, b) => b.y - a.y)[0]
+  if (!main) return null
+  const [nx, nz] = nearestPointIn(main.polygon, x, z)
+  return [nx * sx, main.y * sy, nz * sz]
+}
```

---

### Incident Patch 8: `d630fa30` (2026-10-02)
**Commit Message**: feat(item): X/Z rotation in the panel; flush fixtures tilt with sloped undersides

- Item panel: X and Z rotation sliders around Y (aim a spot, lean a frame).
- Flush ceiling fixtures (recessed flag, or 15 cm tall or less: catalog data
  often lacks the flag) seat along an authored underside and tilt with its
  slope; pendants and fans hang plumb. Same rule for manual placement,
  place_on_surface and MCP place_item (core flushMountRotation / mountsFlush).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/index.ts` (modified, +2/-0)
```diff
@@ -171,9 +171,11 @@ export {
   withoutFloorStepOverrideKeys,
 } from './lib/floor-step-finish'
 export {
+  flushMountRotation,
   geometryRestingHeight,
   geometrySurfaceAt,
   geometryUndersideAt,
+  mountsFlush,
 } from './lib/geometry-surfaces'
 export {
   type ExposedInterval,
```

**File**: `packages/core/src/lib/geometry-surfaces.ts` (modified, +48/-3)
```diff
@@ -82,13 +82,58 @@ export function geometryUndersideAt(
   manifest: Pick<GeometryArtifactManifest, 'undersides'>,
   x: number,
   z: number,
-): { part?: string; y: number } | null {
-  let best: { part?: string; y: number } | null = null
+): { part?: string; y: number; normal: [number, number, number] } | null {
+  let best: { part?: string; y: number; normal: [number, number, number] } | null = null
   for (const underside of manifest.undersides) {
     const [a, b, c, d] = underside.plane
     if (b === 0 || !contains(underside.polygon, x, z)) continue
     const y = -(a * x + c * z + d) / b
-    if (!best || y < best.y) best = { part: underside.part, y }
+    if (!best || y < best.y) best = { part: underside.part, y, normal: [a, b, c] }
   }
   return best
 }
+
+/**
+ * The rotation that seats a flush fixture (a recessed can) on a sloped
+ * underside: its +Y goes into the surface, against the downward `normal`,
+ * then it keeps its own turn `yaw`. Euler XYZ, as items store rotation.
+ */
+export function flushMountRotation(
+  normal: readonly [number, number, number],
+  yaw: number,
+): [number, number, number] {
+  // Quaternion turning +Y onto -normal (the direction into the surface).
+  const [vx, vy, vz] = [-normal[0], -normal[1], -normal[2]]
+  let [qx, qy, qz, qw] = [vz, 0, -vx, 1 + vy]
+  const length = Math.hypot(qx, qy, qz, qw) || 1
+  ;[qx, qy, qz, qw] = [qx / length, qy / length, qz / length, qw / length]
+  // Then the fixture's own yaw about its local +Y.
+  const [sy, cy] = [Math.sin(yaw / 2), Math.cos(yaw / 2)]
+  const [x, y, z, w] = [qx * cy - qz * sy, qw * sy + qy * cy, qz * cy + qx * sy, qw * cy - qy * sy]
+  const m11 = 1 - 2 * (y * y + z * z)
+  const m12 = 2 * (x * y - w * z)
+  const m13 = 2 * (x * z + w * y)
+  const m22 = 1 - 2 * (x * x + z * z)
+  const m23 = 2 * (y * z - w * x)
+  const m32 = 2 * (y * z + w * x)
+  const m33 = 1 - 2 * (x * x + y * y)
+  const ry = Math.asin(Math.max(-1, Math.min(1, m13)))
+  return Math.abs(m13) < 0.9999999
+    ? [Math.atan2(-m23, m33), ry, Math.atan2(-m12, m11)]
+    : [Math.atan2(m32, m22), ry, 0]
+}
+
+/** At or under this height a ceiling fixture mounts flush (a can, a surface light) rather than hangs. */
+const FLUSH_MOUNT_MAX_HEIGHT = 0.15
+
+/**
+ * Whether a ceiling fixture sits flush on a surface (tilting with a slope)
+ * rather than hanging plumb: flagged `recessed`, or shallow enough that it
+ * can only be a can or a surface light (catalog data often lacks the flag).
+ */
+export function mountsFlush(asset: {
+  recessed?: boolean
+  dimensions?: readonly number[]
+}): boolean {
+  return Boolean(asset.recessed) || (asset.dimensions?.[1] ?? 1) <= FLUSH_MOUNT_MAX_HEIGHT
+}
```

**File**: `packages/mcp/src/tools/place-item.ts` (modified, +16/-7)
```diff
@@ -1,5 +1,10 @@
 import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
-import { geometrySurfaceAt, geometryUndersideAt } from '@pascal-app/core'
+import {
+  flushMountRotation,
+  geometrySurfaceAt,
+  geometryUndersideAt,
+  mountsFlush,
+} from '@pascal-app/core'
 import { projectWorldPointToWallLocalX, wallLength } from '@pascal-app/core/agent-operations'
 import type { AnyNodeId } from '@pascal-app/core/schema'
 import { ItemNode } from '@pascal-app/core/schema'
@@ -97,6 +102,7 @@ export function registerPlaceItem(server: McpServer, bridge: SceneOperations): v
       }
 
       let restingOn: string | undefined
+      let tilt: [number, number, number] | undefined
       if (target.type === 'item') {
         const host = bridge.getNode(target.parentId as AnyNodeId)
         if (host?.type !== 'level') {
@@ -121,22 +127,25 @@ export function registerPlaceItem(server: McpServer, bridge: SceneOperations): v
         const explicitY = !hanging && requestedPosition[1] > 0
         restingOn = explicitY ? undefined : surface?.part
         // A ceiling item hangs below the underside (its top flush); others rest on top.
-        const drop = hanging
-          ? 'recessed' in baseAsset && baseAsset.recessed
-            ? 0.02
-            : (baseAsset.dimensions?.[1] ?? 0)
-          : 0
+        const flush = Boolean(hanging) && mountsFlush(baseAsset)
+        const drop = hanging ? (flush ? 0.02 : (baseAsset.dimensions?.[1] ?? 0)) : 0
         const ly = explicitY
           ? requestedPosition[1] - hy
           : surface
             ? surface.y * target.scale[1] - drop
             : (target.asset.surface?.height ?? target.asset.dimensions[1]) * target.scale[1]
         itemPosition = [lx * target.scale[0], ly, lz * target.scale[2]]
+        // A recessed fixture tilts with a sloped underside (a can in a vault plane).
+        // Its turn is relative to the host's.
+        tilt =
+          flush && surface && 'normal' in surface
+            ? flushMountRotation(surface.normal, (rotation ?? 0) - yaw)
+            : [0, (rotation ?? 0) - yaw, 0]
       }
 
       const item = ItemNode.parse({
         position: itemPosition,
-        rotation: [0, rotation ?? 0, 0],
+        rotation: tilt ?? [0, rotation ?? 0, 0],
         asset: baseAsset,
         ...wallExtras,
       })
```

**File**: `packages/nodes/src/item/authored-face-host.ts` (modified, +18/-8)
```diff
@@ -1,7 +1,9 @@
 import {
   type FaceHostCapability,
   type FaceHostPlacementArgs,
+  flushMountRotation,
   type ItemNode,
+  mountsFlush,
   sceneRegistry,
 } from '@pascal-app/core'
 import { type BufferGeometry, type Mesh, Quaternion, Triangle, Vector3 } from 'three'
@@ -44,27 +46,35 @@ function resolveUnderside(args: FaceHostPlacementArgs<ItemNode>) {
     .applyQuaternion(toHost)
     .normalize()
   if (normal.y > UNDERSIDE_MAX_NORMAL_Y) return null
-  return { world, point }
+  return { world, point, normal }
 }
 
 /**
  * Authored objects host ceiling items (pendants, fans, recessed cans) on
  * their real undersides — a vault plane, a soffit, a beam — found from the
- * pointer's hit, so placement follows the geometry the script built. The
- * item hangs upright from the point and becomes the object's child.
+ * pointer's hit, so placement follows the geometry the script built. A
+ * pendant hangs plumb, a recessed fixture tilts with the slope; either
+ * becomes the object's child.
  */
 export const authoredItemFaceHost: FaceHostCapability<ItemNode> = {
   currentFaceId: (item) => (item?.asset.attachTo === 'ceiling' ? UNDERSIDE_FACE : null),
   clearItemFields: [],
   resolvePlacement: (args) => {
     const hit = resolveUnderside(args)
     if (!hit) return null
-    const drop = args.asset.recessed ? 0.02 : args.rawDimensions[1]
-    const position: [number, number, number] = [hit.point.x, hit.point.y - drop, hit.point.z]
     const yaw = args.draftItem?.rotation[1] ?? 0
-    const rotation: [number, number, number] = [0, yaw, 0]
-    const cursor = hit.world.clone()
-    cursor.y -= drop
+    // A recessed fixture seats flush along the face, tilted with a slope; a
+    // pendant or fan hangs plumb from the point.
+    const flush = mountsFlush({ ...args.asset, dimensions: args.rawDimensions })
+    const offset = flush
+      ? hit.normal.clone().multiplyScalar(0.02)
+      : new Vector3(0, -args.rawDimensions[1], 0)
+    const at = hit.point.clone().add(offset)
+    const position: [number, number, number] = [at.x, at.y, at.z]
+    const rotation: [number, number, number] = flush
+      ? flushMountRotation([hit.normal.x, hit.normal.y, hit.normal.z], yaw)
+      : [0, yaw, 0]
+    const cursor = hit.world.clone().add(offset)
     return {
       faceId: UNDERSIDE_FACE,
       nodeUpdate: {
```

**File**: `packages/nodes/src/item/panel.tsx` (modified, +37/-0)
```diff
@@ -162,6 +162,7 @@ export default function ItemPanel() {
       </PanelSection>
 
       <PanelSection title="Rotation">
+        <TiltSlider axis={0} label="X" node={node} onUpdate={handleUpdate} />
         <SliderControl
           label={
             <>
@@ -179,6 +180,7 @@ export default function ItemPanel() {
           unit="°"
           value={Math.round((node.rotation[1] * 180) / Math.PI)}
         />
+        <TiltSlider axis={2} label="Z" node={node} onUpdate={handleUpdate} />
         <div className="flex gap-1.5 px-1 pt-2 pb-1">
           <ActionButton
             label="-45°"
@@ -331,3 +333,38 @@ export default function ItemPanel() {
     </PanelWrapper>
   )
 }
+
+/** Tilt about X or Z: aiming a spotlight, leaning a frame. Y stays the main turn above. */
+function TiltSlider({
+  axis,
+  label,
+  node,
+  onUpdate,
+}: {
+  axis: 0 | 2
+  label: string
+  node: ItemNode
+  onUpdate: (updates: Partial<ItemNode>) => void
+}) {
+  return (
+    <SliderControl
+      label={
+        <>
+          {label}
+          <sub className="ml-[1px] text-[11px] opacity-70">rot</sub>
+        </>
+      }
+      max={180}
+      min={-180}
+      onChange={(degrees) => {
+        const rotation = [...node.rotation] as [number, number, number]
+        rotation[axis] = (degrees * Math.PI) / 180
+        onUpdate({ rotation })
+      }}
+      precision={0}
+      step={1}
+      unit="°"
+      value={Math.round((node.rotation[axis] * 180) / Math.PI)}
+    />
+  )
+}
```

---

### Incident Patch 9: `3f25474c` (2026-10-02)
**Commit Message**: fix(authored objects): no parts cap; the panel shows a plain error

The 64-part refusal blocked a 245-part porch and surfaced an AI-facing rule
to the person. No cap for now; the parts guidance stays in the tool
description. A failed rebuild says so plainly and logs the reason.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-operations/author-object.ts` (modified, +0/-10)
```diff
@@ -14,9 +14,6 @@ import type { AgentOperation } from './types'
 
 type Vec3 = [number, number, number]
 
-/** How many named parts one object may carry; past this it is several objects. */
-export const AUTHORED_OBJECT_MAX_PARTS = 64
-
 export type AuthorObjectInput = {
   code: string
   params?: Record<string, GeometryScriptParamValue>
@@ -160,13 +157,6 @@ function summary(node: ItemNode, compiled: CompiledGeometryScript, orphanedSlots
  */
 export const authorObject: AgentOperation<AuthorObjectInput> = (nodes, input, context) => {
   const { compiled } = input
-  if (compiled.manifest.parts.length > AUTHORED_OBJECT_MAX_PARTS) {
-    refuse(
-      'too_many_parts',
-      `The object has ${compiled.manifest.parts.length} parts; at most ${AUTHORED_OBJECT_MAX_PARTS}. Group detail into fewer parts, or build separate objects for things that are separate.`,
-      { parts: compiled.manifest.parts.length },
-    )
-  }
   const rotation: Vec3 | undefined =
     input.rotation === undefined ? undefined : [0, (input.rotation * Math.PI) / 180, 0]
 
```

**File**: `packages/nodes/src/item/authored-params.tsx` (modified, +4/-3)
```diff
@@ -26,9 +26,10 @@ export function AuthoredParams({ node }: { node: ItemNode }) {
     setBusy(true)
     setError(null)
     rebuildAuthoredObject(node.id, { ...source.params, [id]: value })
-      .catch((reason: unknown) =>
-        setError(reason instanceof Error ? reason.message : String(reason)),
-      )
+      .catch((reason: unknown) => {
+        console.error('[authored object] rebuild failed', reason)
+        setError("Couldn't rebuild with these values.")
+      })
       .finally(() => {
         setBusy(false)
         setDrafts((current) => {
```

---

### Incident Patch 10: `c4457815` (2026-10-02)
**Commit Message**: fix(geometry-script): sample clips to transform tracks so any motion survives glTF

GLTFExporter keeps only position/quaternion/scale tracks and silently dropped
an Euler rotation[y] track, leaving an authored music box with an empty clip.
Each clip now plays once in a mixer and is sampled (30 fps) back into
position/quaternion/scale tracks; a clip that moves nothing is refused with
the reason.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/core/src/agent-tools/author-object.ts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ Conventions (they make the object work in Pascal; follow them):
 - Paint: name every material slot_<finish> (slot_trim, slot_frame, slot_metal) and reuse one material per finish; a material named "glass" renders as glass.
 - Parts: name the few groups a person would point at part:<id> (part:column_left, part:canopy, part:landing), usually 2–24, a group per part, not every mesh. Set userData.type on parts someone would look for: column, beam, slab, roof, railing, panel, trim, step, light.
 - Lights: add a THREE.PointLight or SpotLight named light:<id> where the bulb is; it becomes a switchable light.
-- Motion: put THREE.AnimationClips on the returned group's .animations, as in any three.js project; tracks target <objectName>.<property> or <object.uuid>.<property>. A clip named open becomes the object's open/close control (close plays a clip named close, or open reversed); a clip named loop runs continuously; every other clip gets its own play toggle labelled with its name (name it for the person: "Twirl", "Music"). Write as many clips as the object needs.
+- Motion: put THREE.AnimationClips on the returned group's .animations, as in any three.js project; tracks target <objectName>.<property> or <object.uuid>.<property> and may use any transform property (position, rotation, rotation[y], quaternion, scale); material and visibility tracks do not animate. A clip named open becomes the object's open/close control (close plays a clip named close, or open reversed); a clip named loop runs continuously; every other clip gets its own play toggle labelled with its name (name it for the person: "Twirl", "Music"). Write as many clips as the object needs.
 - Wall opening: a box mesh named cutout (wall mount) is cut out of the host wall and never renders.
 - Sockets: an empty Object3D named anchor:<id> marks where other things attach.
 - No textures, network or DOM. At most 300k triangles, 32 materials, 60 m per side.
```

**File**: `packages/geometry-script/src/compile.ts` (modified, +77/-1)
```diff
@@ -492,6 +492,80 @@ function readAnimations(built: THREE.Object3D, root: THREE.Object3D) {
   return { clips, animated }
 }
 
+const SAMPLE_FPS = 30
+const MAX_SAMPLES = 900
+
+/**
+ * glTF stores only position, quaternion and scale tracks, and the exporter
+ * silently drops the rest (an Euler `rotation[y]` track, a `position[x]`
+ * one). So each clip is played once in a mixer and the transforms it
+ * produces are sampled back as position / quaternion / scale tracks: any
+ * track that moves objects survives, however the module wrote it.
+ */
+function sampleTransformClips(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
+  const mixer = new THREE.AnimationMixer(root)
+  const sampled: THREE.AnimationClip[] = []
+  for (const clip of clips) {
+    const targets = [
+      ...new Set(
+        clip.tracks
+          .map((track) => root.getObjectByProperty('uuid', track.name.split('.')[0]!))
+          .filter((object): object is THREE.Object3D => Boolean(object)),
+      ),
+    ]
+    const rest = targets.map((object) => ({
+      position: object.position.clone(),
+      quaternion: object.quaternion.clone(),
+      scale: object.scale.clone(),
+    }))
+    const count = Math.min(MAX_SAMPLES, Math.ceil(clip.duration * SAMPLE_FPS) + 1)
+    const times = Array.from({ length: count }, (_, i) => (clip.duration * i) / (count - 1))
+    const values = targets.map(() => ({
+      position: [] as number[],
+      quaternion: [] as number[],
+      scale: [] as number[],
+    }))
+    const action = mixer.clipAction(clip)
+    action.play()
+    for (const time of times) {
+      mixer.setTime(time)
+      targets.forEach((object, k) => {
+        values[k]!.position.push(...object.position.toArray())
+        values[k]!.quaternion.push(...object.quaternion.toArray())
+        values[k]!.scale.push(...object.scale.toArray())
+      })
+    }
+    action.stop()
+    mixer.uncacheClip(clip)
+    const tracks: THREE.KeyframeTrack[] = []
+    targets.forEach((object, k) => {
+      const { position, quaternion, scale } = rest[k]!
+      object.position.copy(position)
+      object.quaternion.copy(quaternion)
+      object.scale.copy(scale)
+      const moves = (series: number[], base: number[]) =>
+        series.some((value, i) => Math.abs(value - base[i % base.length]!) > 1e-6)
+      const v = values[k]!
+      if (moves(v.position, position.toArray()))
+        tracks.push(new THREE.VectorKeyframeTrack(`${object.uuid}.position`, times, v.position))
+      if (moves(v.quaternion, quaternion.toArray()))
+        tracks.push(
+          new THREE.QuaternionKeyframeTrack(`${object.uuid}.quaternion`, times, v.quaternion),
+        )
+      if (moves(v.scale, scale.toArray()))
+        tracks.push(new THREE.VectorKeyframeTrack(`${object.uuid}.scale`, times, v.scale))
+    })
+    if (tracks.length === 0) {
+      throw new Error(
+        `Clip "${clip.name}" moves nothing: only position, rotation and scale animate (material or visibility tracks do not)`,
+      )
+    }
+    sampled.push(new THREE.AnimationClip(clip.name, clip.duration, tracks))
+  }
+  root.updateWorldMatrix(true, true)
+  return sampled
+}
+
 // GLTFExporter writes binaries through FileReader, which Bun and Node lack.
 function ensureFileReader() {
   const g = globalThis as { FileReader?: unknown }
@@ -583,7 +657,9 @@ export async function compileGeometryScript(
   built.position.sub(originFor(box, mount))
   root.updateWorldMatrix(true, true)
 
-  const { clips, animated } = readAnimations(built, root)
+  const read = readAnimations(built, root)
+  const clips = sampleTransformClips(root, read.clips)
+  const animated = read.animated
   const conventions = readConventions(root)
   if (conventions.triangles > GEOMETRY_SCRIPT_LIMITS.triangles) {
     throw new Error(
```

---

### Incident Patch 11: `b81990e9` (2026-10-01)
**Commit Message**: fix(geometry-script): worker loads three under Turbopack; compile-only subpath

Turbopack folds three's typeof-window guard to true in worker chunks, so the
worker defines window before three evaluates; the worker imports the compile
subpath so core (which needs window) stays out of it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01QUGvAXaawxPa5rnLSE53iZ

**File**: `packages/editor/src/lib/geometry-script/geometry-script.worker.ts` (modified, +3/-1)
```diff
@@ -1,5 +1,7 @@
 /// <reference lib="webworker" />
-import { compileGeometryScript } from '@pascal-app/geometry-script'
+import './worker-window-shim'
+// The compile subpath only: the package index pulls in core, which needs `window`.
+import { compileGeometryScript } from '@pascal-app/geometry-script/compile'
 import type { GeometryScriptWorkerRequest, GeometryScriptWorkerResponse } from './protocol'
 
 // Model-written code runs in this worker. Before any of it runs, remove the
```

**File**: `packages/editor/src/lib/geometry-script/worker-window-shim.ts` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+// Turbopack compiles worker modules as browser code and folds three's
+// `typeof window !== 'undefined'` guard to true, so `window` must exist before
+// three evaluates. Imported first by the worker.
+const scope = globalThis as { window?: unknown }
+if (scope.window === undefined) scope.window = globalThis
```

**File**: `packages/geometry-script/package.json` (modified, +6/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@pascal-app/geometry-script",
   "version": "1.0.3",
-  "description": "Compiles AI-authored three.js geometry scripts into GLB artifacts with a Pascal manifest. Runs in a browser worker, Bun or Node — no DOM, no React.",
+  "description": "Compiles AI-authored three.js geometry scripts into GLB artifacts with a Pascal manifest. Runs in a browser worker, Bun or Node \u2014 no DOM, no React.",
   "type": "module",
   "main": "./dist/index.js",
   "types": "./dist/index.d.ts",
@@ -10,6 +10,11 @@
       "types": "./dist/index.d.ts",
       "import": "./dist/index.js",
       "default": "./dist/index.js"
+    },
+    "./compile": {
+      "types": "./dist/compile.d.ts",
+      "import": "./dist/compile.js",
+      "default": "./dist/compile.js"
     }
   },
   "files": [
```

---

### Incident Patch 12: `03a9aa17` (2026-10-01)
**Commit Message**: docs(wiki): describe registry renderer dispatch; correct the systems map

renderers.md still described NodeRenderer switching on node.type into
WallRenderer and told contributors to add a case. It now describes the
registry dispatch (nodeRegistry.get(kind) → def.renderer, else
ParametricNodeRenderer filled by GeometrySystem, else nothing), and the one way
to add a renderer: a def.renderer field, never a case or a viewer folder.
The node.visible invariant is kept.

systems.md listed Ceiling/Door/Window/Item systems under core/src/systems; the
real core directories are elevator, fence, roof, slab, stair, wall, and the
tables now say what each owns and how viewer systems are mounted
(<RegisteredSystems> for def.system). The ~60-line initial wall build narration
is reduced to where hydration happens, what it guarantees and the dirty
lifecycle. The system example no longer shows core importing
@react-three/fiber (now a Biome error), and "Adding a new system" starts from
def.system.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01MUcNLY1ATeAiqM9U2zxciv

**File**: `wiki/architecture/README.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Canonical rules for code that touches `packages/core`, `packages/viewer`, `packa
 |---|---|
 | [layers](layers.md) | Three.js layer constants, ownership, and rendering separation |
 | [systems](systems.md) | Core and viewer systems architecture |
-| [renderers](renderers.md) | Node renderer pattern in `packages/viewer` |
+| [renderers](renderers.md) | Registry renderer dispatch and the custom `def.renderer` contract |
 | [node-definitions](node-definitions.md) | Three-checkbox composition model for registry-driven kinds (`geometry` / `renderer` / `system`) |
 | [materials-and-themes](materials-and-themes.md) | Surface colour: surface roles, colour presets, the textures axis, and scene themes (appearance / ground / clay tints) |
 | [item-authoring](item-authoring.md) | Content-author contract for catalog item GLBs: `slot_` material naming, authored defaults + `pascal_material` extras, the `cutout` reserved mesh, UV world scale, and the validated Blender/export recipe |
```

**File**: `wiki/architecture/node-definitions.md` (modified, +1/-1)
```diff
@@ -603,7 +603,7 @@ mechanism: {
 
 ## See also
 
-- [renderers.md](renderers.md) — the legacy renderer pattern (still authoritative for kinds with custom `def.renderer`).
+- [renderers.md](renderers.md) — `NodeRenderer` dispatch and the contract for a custom `def.renderer`.
 - [systems.md](systems.md) — per-kind systems, frame-priority ordering, and core/viewer split.
 - [scene-registry.md](scene-registry.md) — how `sceneRegistry` indexes nodes by ID and type.
 - [Registry type definitions](../../packages/core/src/registry/types.ts) — schemas, capabilities, parametrics and MCP contracts for node kinds.
```

**File**: `wiki/architecture/renderers.md` (modified, +22/-60)
```diff
@@ -1,78 +1,40 @@
 # Renderers
 
-*Node renderer pattern in `packages/viewer`.*
+*How the viewer decides what React mounts for a node.*
 
-Applies to: `packages/viewer/**`.
+Applies to: `packages/viewer/src/components/renderers/`, every `def.renderer` in `packages/nodes/src/<kind>/` and in plugins.
 
-Renderers live in `packages/viewer/src/components/renderers/`. Each renderer is responsible for one node type's Three.js geometry and materials — nothing else.
-
-> **For registry-driven kinds, the default is no custom renderer.** Set `def.geometry` instead and the framework mounts a generic renderer + geometry system for you. See [node-definitions.md](node-definitions.md). The pattern below applies to kinds that *do* need a custom renderer (GLB, `<Html>`, drei, instancing, shader materials).
-
-## Dispatch Chain
+## Dispatch
 
 ```
-<SceneRenderer>          — iterates rootNodeIds from useScene
-  └─ <NodeRenderer>      — switches on node.type, renders the matching component
-       └─ <WallRenderer> — (or SlabRenderer, DoorRenderer, …)
+<SceneRenderer>                — maps useScene rootNodeIds to <NodeRenderer>
+  └─ <NodeRenderer nodeId>     — def = nodeRegistry.get(node.type)
+       ├─ def.renderer set     → the kind's lazy component, under <Suspense>
+       ├─ else def.geometry    → <ParametricNodeRenderer>, filled by <GeometrySystem>
+       └─ else                 → nothing
 ```
 
-See `packages/viewer/src/components/renderers/scene-renderer.tsx` and `packages/viewer/src/components/renderers/node-renderer.tsx`.
+`NodeRenderer` (`node-renderer.tsx`) renders nothing when the kind is not registered or its plugin is not installed in the project (`isNodeKindEnabled`). It subscribes to registry changes for its own kind only, so a plugin that registers after the first mount re-renders that kind's nodes and no others.
 
-## Renderer Responsibilities
+`def.renderer` is a `RendererSource`: today `{ kind: 'parametric', module: () => import('./renderer') }`, made lazy once per source and cached. The `glb` / `instanced-glb` variants are declared but not dispatched yet.
 
-A renderer **should**:
-- Read its node from `useScene` via the node's ID
-- Register its mesh(es) with `useRegistry()` so other systems can look them up
-- Subscribe to pointer events via `useNodeEvents()`
-- Render geometry and apply materials based on node properties
+`ParametricNodeRenderer` is the generic renderer for `def.geometry` kinds: an empty `<group>` registered in `sceneRegistry`, with `useNodeEvents`, live drag transforms and overrides, `visible`, a dirty mark on mount, and its hosted children rendered through `<NodeRenderer>`. `<GeometrySystem>` swaps the builder's output into it. See [node-definitions.md](node-definitions.md) for choosing between `geometry`, `renderer` and `system`.
 
-A renderer **must not**:
-- Run geometry generation logic (that belongs in a System)
-- Import anything from `apps/editor`
-- Manage selection state directly (use `useViewer` for read, emit events for write)
-- Perform expensive per-frame calculations in the component body
+## Adding a renderer
 
-## `node.visible` Is the Renderer's Job
+Set `def.renderer` on the kind's definition. That is the only way: never a `case` in `NodeRenderer` and never a per-kind folder under `viewer/src/components/renderers/` (DECISIONS.md E-002). Prefer `def.geometry` unless the kind needs JSX-only features (GLB via `useGLTF`, `<Html>`, drei, instancing, TSL materials).
 
-A custom renderer **must** apply `visible={node.visible !== false}` to its root group (or outer renderable). Registry-driven kinds get this for free — `ParametricNodeRenderer` already sets it — but a kind that ships its own `renderer.tsx` and forgets it stays drawn in the 3D viewport while it is already gone everywhere else: selection candidates, first-person collision, the 2D plan and every export honour the flag. The result is a node that is on screen but unclickable.
+A custom renderer:
 
-If a system writes `.visible` on the kind's registry object every frame (solo mode does this for levels, the zone systems do it to keep `<Html>` labels alive), that write has to fold the node flag in as well, or it silently undoes the prop on the next frame.
+- registers its root with `useRegistry(node.id, kind, ref)` and spreads `useNodeEvents(node, kind)` on it (both public exports of `@pascal-app/core` / `@pascal-app/viewer`);
+- renders hosted children with `<NodeRenderer nodeId={childId} />`, or declares `rendersChildren: false`;
+- memoises geometry that depends on node fields and leaves dirty-driven rebuilds and cross-node work to a `def.system`;
+- imports nothing from `@pascal-app/editor` (DECISIONS.md E-001).
 
-The **Site is the one exception**: its flag governs only its own presentation — ground fill, sculpted terrain, boundary line — and stops there. Buildings and items standing on a hidden Site keep their own flag and still render, and the horizon disc is a world backdrop rather than part of the parc
```

**File**: `wiki/architecture/systems.md` (modified, +82/-109)
```diff
@@ -8,22 +8,40 @@ Systems own business logic, geometry generation, and constraints. They run in th
 
 > **For registry-driven kinds, prefer no per-kind system.** If your kind's only job is "rebuild geometry on dirty", set `def.geometry` and let the framework's `<GeometrySystem>` handle the rebuild loop. Per-kind systems remain for *extra* responsibilities — animations, cross-kind dirty cascades, named-mesh material poking. See [node-definitions.md](node-definitions.md).
 
-## Two Kinds of Systems
+## Where systems live
 
-### Core Systems — `packages/core/src/systems/`
+### Core — `packages/core/src/systems/`
 
-Pure logic: no rendering, no Three.js objects. They read nodes from `useScene`, compute derived values (geometry, constraints), and write results back.
+Plain data: no Three.js, no `useFrame` (DECISIONS.md E-001). Pure helpers, plus a few React components that subscribe to the scene store and write derived data back.
 
-| System | Responsibility |
+| Directory | Owns |
 |---|---|
-| `WallSystem` | Wall mitering, corner joints |
-| `CeilingSystem` | Polygon-based ceiling generation |
-| `RoofSystem` | Pitched roof shape |
-| `DoorSystem` | Placement constraints on walls |
-| `WindowSystem` | Placement constraints on walls |
-| `ItemSystem` | Item transforms, collision |
+| `wall/` | Mitering, topology, tops, merge, finishes and layer bands, frame and reference line — the pure inputs of the viewer's `WallSystem` |
+| `slab/` | Slab support and placement, `ensureSlabOpenings` |
+| `stair/` | Rise, flight and footprints; `StairOpeningSystem` syncs rises and cuts slab openings |
+| `elevator/` | Dispatch and runtime service, opening sync, `ElevatorOpeningSystem` |
+| `roof/` | Footprint; `RoofElevationSystem` keeps wall-following roofs on their walls |
+| `fence/` | Spline and centerline |
 
-Slab geometry has no dedicated system: it renders through the registry `def.geometry` (`packages/nodes/src/slab/geometry.ts`, calling the pure generators in `packages/viewer/src/systems/slab/slab-system.tsx`) with a small `def.system` for dirty tracking.
+`owned-floor-openings.ts` / `reconcile-owned-floor-openings.ts` at the top level reconcile floor openings owned by other nodes.
+
+### Viewer — `packages/viewer/src/systems/`
+
+Three.js side-effects on registered objects (`sceneRegistry`). `<Viewer>` mounts the framework systems directly: `FloorElevationSystem`, `GeometrySystem`, core's `StairOpeningSystem` and `RoofElevationSystem`, and `<RegisteredSystems>`, which mounts every registered kind's `def.system`. The per-kind implementations below are exported by `@pascal-app/viewer` and wrapped by the kinds' `def.system` modules in `packages/nodes`.
+
+| Directory | Owns |
+|---|---|
+| `geometry/` | `GeometrySystem`: rebuilds `def.geometry` kinds on dirty |
+| `floor-elevation/` | `FloorElevationSystem`: lifts `floorPlaced` kinds over slabs |
+| `level/` | `LevelSystem`: stacked / exploded / solo / manual level positions |
+| `wall/` | `WallSystem` (dirty drain, miter cache, initial build) and `WallCutout` (opening holes) |
+| `slab/`, `ceiling/`, `fence/`, `roof/`, `stair/`, `column/` | Kind geometry generators and their dirty consumers |
+| `door/`, `window/` | Rebuild on dirty, plus the animation systems that advance `operationState` |
+| `item/`, `item-light/`, `interactive/` | Item transforms, item lights, in-scene toggles and sliders |
+| `zone/`, `guide/`, `scan/`, `elevator/` | Zone display and labels, helper geometry, point clouds, elevator interaction |
+| `perf-action-settle/` | `?perf` settle detection |
+
+### Frame priorities and the dirty lifecycle
 
 Ceiling geometry consumes dirty marks at frame priority 2, like `GeometrySystem` (slabs).
 The node batch snapshots marks at priority 1 and processes membership at priority 5,
@@ -46,71 +64,42 @@ sources until settled; a playing procedural motion releases its item, and part
 lights keep it out. Level mode/selected-level changes re-offer sources rejected while
 shadow-only.
 
-### Initial wall build
-
-`setScene` assigns a non-persisted hydration identity, then publishes its eligible
-`hydrationToken` after synchronous reconciliation and hydration-owned deferred
-normalization finish. The shared, server-safe `ensureSceneOpenings(nodes)` runs
-in `migrateNodes` immediately after M4/M5. It derives stair rises from the supplied
-graph (including persisted slab/terrain support), then ensures openings. Hydration
-and system mounts reuse that function; a queued pass covers reconciliation during
-the store transition. Existing slab polygons and metadata are preserved: a saved
-hole owned by that stair/elevator, or holes covering at least 99.9% of the proposed
-opening, count as present. Stair/elevator edits still recalculate openings.
-Read-only snapshots receive the pure migration before publication; reactive writes
-continue to honor the scene mutation lock.
-Ordinary document writes cancel pending publication or invalidate an issued token atomically before s
```

---

### Incident Patch 13: `b3be7dd5` (2026-10-01)
**Commit Message**: test(nodes): run the whole suite in one process

Thirteen files re-launched `bun test <self>` in a child process
(PASCAL_*_ISOLATED gates) because three files installed process-global
`mock.module` mocks. Remove the mocks at the source and the re-spawns:

- wall/rectangle-tool-sfx: `spyOn(Html, 'render')` instead of
  `mock.module('@react-three/drei')` (and its "restore" by re-mocking).
- shared/roof-surface-placement-guides: drop the never-restored
  `mock.module('../skylight/frame-csg')`; the real frame geometry works.
- duct-fitting/parametrics: drop `mock.module('@pascal-app/editor')`,
  which replaced the whole editor barrel with one export.
- Unwrap the 11 `src/__tests__` gates, `wall/justification`'s per-test
  `isolate()` and `zone/renderer`'s gate.

Running in one process surfaced three cross-file leaks the children hid:

- unrenderable-host-audit wrote `useEditor.setState({ movingNode: null })`
  (not a store field); merge-restore kept the key, and
  cabinet/hosting-matrix asserted that same non-field, a check that was
  always vacuous. The matrix now asserts `getMovingNode()`.
- wall/justification's 3D endpoint test left a 300 ms click-swallow
  cleanup on a `window` it 

**File**: `packages/nodes/src/__tests__/block-edit-audit.test.tsx` (modified, +667/-711)
```diff
@@ -48,772 +48,728 @@ function htmlText(node: ReactNode): string {
   if (React.isValidElement<{ children?: ReactNode }>(node)) return htmlText(node.props.children)
   return ''
 }
-// Other node tests install process-global renderer mocks; this audit must observe production modules.
-if (process.env.PASCAL_BLOCK_EDIT_AUDIT_ISOLATED !== '1') {
-  test('block edit audit with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/block-edit-audit.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_BLOCK_EDIT_AUDIT_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout)
-    console.log(
-      stderr
-        .split('\n')
-        .filter(
-          (line) =>
-            !line.startsWith('The current testing environment') &&
-            !line.startsWith('[zustand persist') &&
-            !line.startsWith('THREE.Clock'),
-        )
-        .join('\n'),
-    )
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const recipe: Recipe = {
-    version: 1,
-    name: 'Audit box',
-    description: '',
-    constraints: [],
-    parameters: [
-      { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
-    ],
-    slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
-    parts: [
-      {
-        id: 'body',
-        label: 'Body',
-        count: 1,
-        shapes: [
-          {
-            id: 'box',
-            primitive: 'box',
-            size: [0.1, 0.2, 0.1],
-            position: [0, 0.1, 0],
-            slot: 'body',
-          },
-        ],
-      },
-    ],
-    surfaces: [],
-  }
-  const asset = {
-    id: 'audit-box',
-    name: 'Audit box',
-    category: 'decor',
-    thumbnail: '',
-    src: '/unrenderable-host-audit.glb',
-    dimensions: [0.1, 0.2, 0.1] as [number, number, number],
-  }
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
-  let htmlLabels: ReturnType<typeof spyOn>
+const recipe: Recipe = {
+  version: 1,
+  name: 'Audit box',
+  description: '',
+  constraints: [],
+  parameters: [
+    { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
+  ],
+  slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
+  parts: [
+    {
+      id: 'body',
+      label: 'Body',
+      count: 1,
+      shapes: [
+        {
+          id: 'box',
+          primitive: 'box',
+          size: [0.1, 0.2, 0.1],
+          position: [0, 0.1, 0],
+          slot: 'body',
+        },
+      ],
+    },
+  ],
+  surfaces: [],
+}
+const asset = {
+  id: 'audit-box',
+  name: 'Audit box',
+  category: 'decor',
+  thumbnail: '',
+  src: '/unrenderable-host-audit.glb',
+  dimensions: [0.1, 0.2, 0.1] as [number, number, number],
+}
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
+let htmlLabels: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
-      (props: { children: ReactNode }) => <group userData={{ ui: htmlText(props.children) }} />,
-    )
-    savedScene = useScene.getState()
-    savedEditor = useEditor.getState()
-    savedViewer = useViewer.getState()
-    savedScope = useInteractionScope.getState()
-    useBlockEditSession.setState({
-      nodeId: null,
-      lastOperation: null,
-      selection: { mode: 'face', ids: [], activeId: null },
+beforeEach(() => {
+  htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
+    (props: { children: ReactNode }) => <group userData={{ ui: htmlText(props.children) }} />,
+  )
+  savedScene = useScene.getState()
+  savedEditor = useEditor.getState()
+  savedViewer = useViewer.getState()
+  savedScope = useInteractionScope.getState()
+  useBlockEditSession.setState({
+    nodeId: null,
+    lastO
```

**File**: `packages/nodes/src/__tests__/block-edit-audit2.test.tsx` (modified, +460/-505)
```diff
@@ -41,428 +41,435 @@ import { builtinPlugin } from '../index'
 import { ItemGLTFLoader } from '../item/model-loader'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
-// Other node tests install process-global renderer mocks; this audit must observe production modules.
-if (process.env.PASCAL_BLOCK_EDIT_AUDIT2_ISOLATED !== '1') {
-  test('second block edit audit with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/block-edit-audit2.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_BLOCK_EDIT_AUDIT2_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout)
-    console.log(
-      stderr
-        .split('\n')
-        .filter(
-          (line) =>
-            !line.startsWith('The current testing environment') &&
-            !line.startsWith('[zustand persist') &&
-            !line.startsWith('THREE.Clock'),
-        )
-        .join('\n'),
-    )
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const recipe: Recipe = {
-    version: 1,
-    name: 'Audit box',
-    description: '',
-    constraints: [],
-    parameters: [
-      { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
-    ],
-    slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
-    parts: [
-      {
-        id: 'body',
-        label: 'Body',
-        count: 1,
-        shapes: [
-          {
-            id: 'box',
-            primitive: 'box',
-            size: [0.1, 0.2, 0.1],
-            position: [0, 0.1, 0],
-            slot: 'body',
-          },
-        ],
-      },
-    ],
-    surfaces: [],
-  }
-  const asset = {
-    id: 'audit-box',
-    name: 'Audit box',
-    category: 'decor',
-    thumbnail: '',
-    src: '/unrenderable-host-audit.glb',
-    dimensions: [0.1, 0.2, 0.1] as [number, number, number],
-  }
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
-  let htmlLabels: ReturnType<typeof spyOn>
+const recipe: Recipe = {
+  version: 1,
+  name: 'Audit box',
+  description: '',
+  constraints: [],
+  parameters: [
+    { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
+  ],
+  slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
+  parts: [
+    {
+      id: 'body',
+      label: 'Body',
+      count: 1,
+      shapes: [
+        {
+          id: 'box',
+          primitive: 'box',
+          size: [0.1, 0.2, 0.1],
+          position: [0, 0.1, 0],
+          slot: 'body',
+        },
+      ],
+    },
+  ],
+  surfaces: [],
+}
+const asset = {
+  id: 'audit-box',
+  name: 'Audit box',
+  category: 'decor',
+  thumbnail: '',
+  src: '/unrenderable-host-audit.glb',
+  dimensions: [0.1, 0.2, 0.1] as [number, number, number],
+}
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
+let htmlLabels: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
-      (props: { children: ReactNode }) => (
-        <group userData={{ ui: renderToStaticMarkup(props.children) }} />
-      ),
-    )
-    savedScene = useScene.getState()
-    savedEditor = useEditor.getState()
-    savedViewer = useViewer.getState()
-    savedScope = useInteractionScope.getState()
-    useBlockEditSession.setState({
-      nodeId: null,
-      lastOperation: null,
-      selection: { mode: 'face', ids: [], activeId: null },
+beforeEach(() => {
+  htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
+    (props: { children: ReactNode }) => (
+      <group userData={{ ui: renderToStaticMarkup(props.children) }} />
+    ),
+  )
+  savedScene = useScene.getState()
+  savedEditor = useEditor.getState()
+  savedViewer = useViewer.getState()
+  savedScope = useInteractionScop
```

**File**: `packages/nodes/src/__tests__/block-face-blink.test.tsx` (modified, +276/-298)
```diff
@@ -33,310 +33,288 @@ import { ItemGLTFLoader } from '../item/model-loader'
 import { getInitialState } from '../item/move-tool'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
-// Other suites replace production renderers with process-global mocks.
-if (process.env.PASCAL_BLOCK_BLINK_ISOLATED !== '1') {
-  test('block face blink with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/block-face-blink.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_BLOCK_BLINK_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout, stderr)
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    savedScene = useScene.getState()
-    savedEditor = useEditor.getState()
-    savedViewer = useViewer.getState()
-    savedScope = useInteractionScope.getState()
-    const names = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'] as const
-    const descriptors = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
-    restoreGlobals = () =>
-      names.forEach((name, i) => {
-        const descriptor = descriptors[i]
-        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
-        else Reflect.deleteProperty(globalThis, name)
-      })
-    globalThis.window = new EventTarget() as Window & typeof globalThis
-    globalThis.document = {
-      body: { style: { cursor: '' } },
-      createElement: (tag: string) => {
-        if (tag !== 'canvas') throw new Error(`Unexpected DOM element: ${tag}`)
-        const context = new Proxy(
-          {},
-          {
-            get: (_target, key) =>
-              key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {},
-          },
-        )
-        return { width: 0, height: 0, getContext: () => context }
-      },
-    } as unknown as Document
-    getDefaultPanelMaterial()
-    Reflect.deleteProperty(globalThis.document, 'createElement')
-    globalThis.requestAnimationFrame = () => 0
-    globalThis.cancelAnimationFrame = () => {}
-    loadModel = spyOn(ItemGLTFLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
-      const scene = new Group()
-      scene.add(
-        new Mesh(new BoxGeometry(0.1, 0.2, 0.1).translate(0, 0.1, 0), new MeshBasicMaterial()),
-      )
-      onLoad({
-        scene,
-        scenes: [scene],
-        animations: [],
-        cameras: [],
-        asset: { version: '2.0' },
-        parser: {},
-      } as never)
+beforeEach(() => {
+  savedScene = useScene.getState()
+  savedEditor = useEditor.getState()
+  savedViewer = useViewer.getState()
+  savedScope = useInteractionScope.getState()
+  const names = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'] as const
+  const descriptors = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
+  restoreGlobals = () =>
+    names.forEach((name, i) => {
+      const descriptor = descriptors[i]
+      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
+      else Reflect.deleteProperty(globalThis, name)
     })
-    restoreRegistry = nodeRegistry._snapshot()
-    nodeRegistry._reset()
-    for (const def of builtinPlugin.nodes!) registerNode(def)
-  })
-  afterEach(() => {
-    loadModel.mockRestore()
-    sceneRegistry.nodes.clear()
-    spatialGridManager.clear()
-    useLiveNodeOverrides.getState().clearAll()
-    useLiveTransforms.getState().clearAll()
-    useScene.temporal.getState().resume()
-    useScene.temporal.getState().clear()
-    useScene.setState(savedScene)
-    useEditor.setState(savedEditor)
-    useViewer.setState(savedViewer)
-    useInteractionScope.setStat
```

**File**: `packages/nodes/src/__tests__/block-tops.test.tsx` (modified, +944/-985)
```diff
@@ -55,1061 +55,1020 @@ import { MoveItemTool } from '../item/move-tool'
 import ItemTool from '../item/tool'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
-// Other node tests install process-global renderer mocks; this audit must observe production modules.
-if (process.env.PASCAL_BLOCK_TOPS_ISOLATED !== '1') {
-  test('block tops with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/block-tops.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_BLOCK_TOPS_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout)
-    console.log(
-      stderr
-        .split('\n')
-        .filter(
-          (line) =>
-            !line.startsWith('The current testing environment') &&
-            !line.startsWith('[zustand persist') &&
-            !line.startsWith('THREE.Clock'),
-        )
-        .join('\n'),
-    )
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const recipe: Recipe = {
-    version: 1,
-    name: 'Audit box',
-    description: '',
-    constraints: [],
-    parameters: [
-      { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
-    ],
-    slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
-    parts: [
-      {
-        id: 'body',
-        label: 'Body',
-        count: 1,
-        shapes: [
-          {
-            id: 'box',
-            primitive: 'box',
-            size: [0.1, 0.2, 0.1],
-            position: [0, 0.1, 0],
-            slot: 'body',
-          },
-        ],
-      },
-    ],
-    surfaces: [],
-  }
-  const asset = {
-    id: 'audit-box',
-    name: 'Audit box',
-    category: 'decor',
-    thumbnail: '',
-    src: '/unrenderable-host-audit.glb',
-    dimensions: [0.1, 0.2, 0.1] as [number, number, number],
-  }
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  type Mover = 'registry' | 'catalog'
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
-  let htmlLabels: ReturnType<typeof spyOn>
+const recipe: Recipe = {
+  version: 1,
+  name: 'Audit box',
+  description: '',
+  constraints: [],
+  parameters: [
+    { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
+  ],
+  slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
+  parts: [
+    {
+      id: 'body',
+      label: 'Body',
+      count: 1,
+      shapes: [
+        {
+          id: 'box',
+          primitive: 'box',
+          size: [0.1, 0.2, 0.1],
+          position: [0, 0.1, 0],
+          slot: 'body',
+        },
+      ],
+    },
+  ],
+  surfaces: [],
+}
+const asset = {
+  id: 'audit-box',
+  name: 'Audit box',
+  category: 'decor',
+  thumbnail: '',
+  src: '/unrenderable-host-audit.glb',
+  dimensions: [0.1, 0.2, 0.1] as [number, number, number],
+}
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+type Mover = 'registry' | 'catalog'
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
+let htmlLabels: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
-      () => null,
-    )
-    savedScene = useScene.getState()
-    savedEditor = useEditor.getState()
-    savedViewer = useViewer.getState()
-    savedScope = useInteractionScope.getState()
-    const names = [
-      'window',
-      'document',
-      'requestAnimationFrame',
-      'cancelAnimationFrame',
-      'HTMLElement',
-      'HTMLInputElement',
-      'HTMLTextAreaElement',
-    ] as const
-    const descriptors = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
-    restoreGlobals = () =>
-      names.forEach((name, i) => {
-        const descriptor = descriptors[i]
-        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
-        else Reflect.deleteProperty(globalThis, name)
-      })
-    for (const name of ['HTMLElement', 'HTMLInputElement'
```

**File**: `packages/nodes/src/__tests__/column-audit2.test.tsx` (modified, +547/-584)
```diff
@@ -46,602 +46,565 @@ import { MoveItemTool } from '../item/move-tool'
 import { restingNodePlanFrame } from '../shared/resting-surface-plan'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
-// Other node tests install process-global renderer mocks; this audit must observe production modules.
-if (process.env.PASCAL_COLUMN_AUDIT2_ISOLATED !== '1') {
-  test('second column audit with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/column-audit2.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_COLUMN_AUDIT2_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout)
-    console.log(
-      stderr
-        .split('\n')
-        .filter(
-          (line) =>
-            !line.startsWith('The current testing environment') &&
-            !line.startsWith('[zustand persist') &&
-            !line.startsWith('THREE.Clock'),
-        )
-        .join('\n'),
-    )
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const recipe: Recipe = {
-    version: 1,
-    name: 'Audit box',
-    description: '',
-    constraints: [],
-    parameters: [
-      { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
-    ],
-    slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
-    parts: [
-      {
-        id: 'body',
-        label: 'Body',
-        count: 1,
-        shapes: [
-          {
-            id: 'box',
-            primitive: 'box',
-            size: [0.1, 0.2, 0.1],
-            position: [0, 0.1, 0],
-            slot: 'body',
-          },
-        ],
-      },
-    ],
-    surfaces: [],
-  }
-  const asset = {
-    id: 'audit-box',
-    name: 'Audit box',
-    category: 'decor',
-    thumbnail: '',
-    src: '/unrenderable-host-audit.glb',
-    dimensions: [0.1, 0.2, 0.1] as [number, number, number],
-  }
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  type Mover = 'registry' | 'catalog'
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
-  let htmlLabels: ReturnType<typeof spyOn>
+const recipe: Recipe = {
+  version: 1,
+  name: 'Audit box',
+  description: '',
+  constraints: [],
+  parameters: [
+    { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
+  ],
+  slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
+  parts: [
+    {
+      id: 'body',
+      label: 'Body',
+      count: 1,
+      shapes: [
+        {
+          id: 'box',
+          primitive: 'box',
+          size: [0.1, 0.2, 0.1],
+          position: [0, 0.1, 0],
+          slot: 'body',
+        },
+      ],
+    },
+  ],
+  surfaces: [],
+}
+const asset = {
+  id: 'audit-box',
+  name: 'Audit box',
+  category: 'decor',
+  thumbnail: '',
+  src: '/unrenderable-host-audit.glb',
+  dimensions: [0.1, 0.2, 0.1] as [number, number, number],
+}
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+type Mover = 'registry' | 'catalog'
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
+let htmlLabels: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
-      () => null,
-    )
-    savedScene = useScene.getState()
-    savedEditor = useEditor.getState()
-    savedViewer = useViewer.getState()
-    savedScope = useInteractionScope.getState()
-    const names = [
-      'window',
-      'document',
-      'requestAnimationFrame',
-      'cancelAnimationFrame',
-      'HTMLElement',
-      'HTMLInputElement',
-      'HTMLTextAreaElement',
-    ] as const
-    const descriptors = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
-    restoreGlobals = () =>
-      names.forEach((name, i) => {
-        const descriptor = descriptors[i]
-        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
-        else Reflect.deleteProperty(globalThis, name)
-      })
-    for
```

**File**: `packages/nodes/src/__tests__/column-audit3.test.tsx` (modified, +571/-604)
```diff
@@ -55,639 +55,606 @@ import { MoveItemTool } from '../item/move-tool'
 import { restingNodePlanFrame } from '../shared/resting-surface-plan'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
-// Other node tests install process-global renderer mocks; this audit must observe production modules.
-if (process.env.PASCAL_COLUMN_AUDIT3_ISOLATED !== '1') {
-  test('third column audit with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/column-audit3.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_COLUMN_AUDIT3_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout)
-    console.log(
-      stderr
-        .split('\n')
-        .filter(
-          (line) =>
-            !line.startsWith('The current testing environment') &&
-            !line.startsWith('[zustand persist') &&
-            !line.startsWith('THREE.Clock'),
-        )
-        .join('\n'),
-    )
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const recipe: Recipe = {
-    version: 1,
-    name: 'Audit box',
-    description: '',
-    constraints: [],
-    parameters: [
-      { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
-    ],
-    slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
-    parts: [
-      {
-        id: 'body',
-        label: 'Body',
-        count: 1,
-        shapes: [
-          {
-            id: 'box',
-            primitive: 'box',
-            size: [0.1, 0.2, 0.1],
-            position: [0, 0.1, 0],
-            slot: 'body',
-          },
-        ],
-      },
-    ],
-    surfaces: [],
-  }
-  const asset = {
-    id: 'audit-box',
-    name: 'Audit box',
-    category: 'decor',
-    thumbnail: '',
-    src: '/unrenderable-host-audit.glb',
-    dimensions: [0.1, 0.2, 0.1] as [number, number, number],
-  }
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  type Mover = 'registry' | 'catalog'
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
-  let htmlLabels: ReturnType<typeof spyOn>
+const recipe: Recipe = {
+  version: 1,
+  name: 'Audit box',
+  description: '',
+  constraints: [],
+  parameters: [
+    { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
+  ],
+  slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
+  parts: [
+    {
+      id: 'body',
+      label: 'Body',
+      count: 1,
+      shapes: [
+        {
+          id: 'box',
+          primitive: 'box',
+          size: [0.1, 0.2, 0.1],
+          position: [0, 0.1, 0],
+          slot: 'body',
+        },
+      ],
+    },
+  ],
+  surfaces: [],
+}
+const asset = {
+  id: 'audit-box',
+  name: 'Audit box',
+  category: 'decor',
+  thumbnail: '',
+  src: '/unrenderable-host-audit.glb',
+  dimensions: [0.1, 0.2, 0.1] as [number, number, number],
+}
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+type Mover = 'registry' | 'catalog'
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
+let htmlLabels: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
-      () => null,
-    )
-    savedScene = useScene.getState()
-    savedEditor = useEditor.getState()
-    savedViewer = useViewer.getState()
-    savedScope = useInteractionScope.getState()
-    const names = [
-      'window',
-      'document',
-      'requestAnimationFrame',
-      'cancelAnimationFrame',
-      'HTMLElement',
-      'HTMLInputElement',
-      'HTMLTextAreaElement',
-    ] as const
-    const descriptors = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
-    restoreGlobals = () =>
-      names.forEach((name, i) => {
-        const descriptor = descriptors[i]
-        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
-        else Reflect.deleteProperty(globalThis, name)
-      })
-    for 
```

**File**: `packages/nodes/src/__tests__/column-audit4.test.tsx` (modified, +446/-480)
```diff
@@ -44,484 +44,470 @@ import { ItemGLTFLoader } from '../item/model-loader'
 import { MoveItemTool } from '../item/move-tool'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
-// Other node tests install process-global renderer mocks; this audit must observe production modules.
-if (process.env.PASCAL_COLUMN_AUDIT4_ISOLATED !== '1') {
-  test('fourth column audit with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/column-audit4.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_COLUMN_AUDIT4_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout)
-    console.log(
-      stderr
-        .split('\n')
-        .filter(
-          (line) =>
-            !line.startsWith('The current testing environment') &&
-            !line.startsWith('[zustand persist') &&
-            !line.startsWith('THREE.Clock'),
-        )
-        .join('\n'),
-    )
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const recipe: Recipe = {
-    version: 1,
-    name: 'Audit box',
-    description: '',
-    constraints: [],
-    parameters: [
-      { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
-    ],
-    slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
-    parts: [
-      {
-        id: 'body',
-        label: 'Body',
-        count: 1,
-        shapes: [
-          {
-            id: 'box',
-            primitive: 'box',
-            size: [0.1, 0.2, 0.1],
-            position: [0, 0.1, 0],
-            slot: 'body',
-          },
-        ],
-      },
-    ],
-    surfaces: [],
-  }
-  const asset = {
-    id: 'audit-box',
-    name: 'Audit box',
-    category: 'decor',
-    thumbnail: '',
-    src: '/unrenderable-host-audit.glb',
-    dimensions: [0.1, 0.2, 0.1] as [number, number, number],
-  }
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  type Mover = 'registry' | 'catalog'
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
-  let htmlLabels: ReturnType<typeof spyOn>
+const recipe: Recipe = {
+  version: 1,
+  name: 'Audit box',
+  description: '',
+  constraints: [],
+  parameters: [
+    { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
+  ],
+  slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
+  parts: [
+    {
+      id: 'body',
+      label: 'Body',
+      count: 1,
+      shapes: [
+        {
+          id: 'box',
+          primitive: 'box',
+          size: [0.1, 0.2, 0.1],
+          position: [0, 0.1, 0],
+          slot: 'body',
+        },
+      ],
+    },
+  ],
+  surfaces: [],
+}
+const asset = {
+  id: 'audit-box',
+  name: 'Audit box',
+  category: 'decor',
+  thumbnail: '',
+  src: '/unrenderable-host-audit.glb',
+  dimensions: [0.1, 0.2, 0.1] as [number, number, number],
+}
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+type Mover = 'registry' | 'catalog'
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
+let htmlLabels: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    htmlLabels = spyOn(Html as unknown as { render: () => ReactNode }, 'render').mockImplementation(
-      () => null,
-    )
-    savedScene = useScene.getState()
-    savedEditor = useEditor.getState()
-    savedViewer = useViewer.getState()
-    savedScope = useInteractionScope.getState()
-    const names = [
-      'window',
-      'document',
-      'requestAnimationFrame',
-      'cancelAnimationFrame',
-      'HTMLElement',
-      'HTMLInputElement',
-      'HTMLTextAreaElement',
-    ] as const
-    const descriptors = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
-    restoreGlobals = () =>
-      names.forEach((name, i) => {
-        const descriptor = descriptors[i]
-        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
-        else Reflect.deleteProperty(globalThis, name)
-      })
-    for (const name of 
```

**File**: `packages/nodes/src/__tests__/column-tops.test.tsx` (modified, +1053/-1095)
```diff
@@ -70,1180 +70,1138 @@ import { MoveItemTool } from '../item/move-tool'
 import ItemTool from '../item/tool'
 import { getDefaultPanelMaterial } from '../solar-panel/geometry'
 
-// Other node tests install process-global renderer mocks; this audit must observe production modules.
-if (process.env.PASCAL_COLUMN_TOPS_ISOLATED !== '1') {
-  test('column tops with production registrations', async () => {
-    const child = Bun.spawn(
-      [process.execPath, 'run', 'test', 'src/__tests__/column-tops.test.tsx'],
-      {
-        cwd: new URL('../..', import.meta.url).pathname,
-        env: { ...process.env, PASCAL_COLUMN_TOPS_ISOLATED: '1' },
-        stdout: 'pipe',
-        stderr: 'pipe',
-      },
-    )
-    const [stdout, stderr, code] = await Promise.all([
-      new Response(child.stdout).text(),
-      new Response(child.stderr).text(),
-      child.exited,
-    ])
-    console.log(stdout)
-    console.log(
-      stderr
-        .split('\n')
-        .filter(
-          (line) =>
-            !line.startsWith('The current testing environment') &&
-            !line.startsWith('[zustand persist') &&
-            !line.startsWith('THREE.Clock'),
-        )
-        .join('\n'),
-    )
-    expect(code).toBe(0)
-  }, 120_000)
-} else {
-  const recipe: Recipe = {
-    version: 1,
-    name: 'Audit box',
-    description: '',
-    constraints: [],
-    parameters: [
-      { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
-    ],
-    slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
-    parts: [
-      {
-        id: 'body',
-        label: 'Body',
-        count: 1,
-        shapes: [
-          {
-            id: 'box',
-            primitive: 'box',
-            size: [0.1, 0.2, 0.1],
-            position: [0, 0.1, 0],
-            slot: 'body',
-          },
-        ],
-      },
-    ],
-    surfaces: [],
-  }
-  const asset = {
-    id: 'audit-box',
-    name: 'Audit box',
-    category: 'decor',
-    thumbnail: '',
-    src: '/unrenderable-host-audit.glb',
-    dimensions: [0.1, 0.2, 0.1] as [number, number, number],
-  }
-  const site = SiteNode.parse({})
-  const building = BuildingNode.parse({ parentId: site.id })
-  const level = LevelNode.parse({ parentId: building.id })
-  type Mover = 'registry' | 'catalog'
-  type Row = {
-    kind: string
-    mover: Mover
-    order: string
-    accepted: boolean
-    parent: string
-    mounted: boolean
-    rendered: boolean
-    survives: boolean
-    samePose: boolean
-    reloadRendered: boolean
-    parsedSamePose: boolean | null
-    parsedRendered: boolean | null
-    parsedSurvives: boolean | null
-    retainsChildren: boolean
-    plan: boolean
-    planError: string
-    moveError: string
-    parseError: string
-  }
-  let savedScene: ReturnType<typeof useScene.getState>
-  let savedEditor: ReturnType<typeof useEditor.getState>
-  let savedViewer: ReturnType<typeof useViewer.getState>
-  let savedScope: ReturnType<typeof useInteractionScope.getState>
-  let restoreRegistry: () => void
-  let restoreGlobals: () => void
-  let loadModel: ReturnType<typeof spyOn>
-  let htmlLabels: ReturnType<typeof spyOn>
+const recipe: Recipe = {
+  version: 1,
+  name: 'Audit box',
+  description: '',
+  constraints: [],
+  parameters: [
+    { id: 'width', label: 'Width', default: 0.1, min: 0.05, max: 1, step: 0.05, unit: 'm' },
+  ],
+  slots: [{ id: 'body', label: 'Body', color: '#ffffff' }],
+  parts: [
+    {
+      id: 'body',
+      label: 'Body',
+      count: 1,
+      shapes: [
+        {
+          id: 'box',
+          primitive: 'box',
+          size: [0.1, 0.2, 0.1],
+          position: [0, 0.1, 0],
+          slot: 'body',
+        },
+      ],
+    },
+  ],
+  surfaces: [],
+}
+const asset = {
+  id: 'audit-box',
+  name: 'Audit box',
+  category: 'decor',
+  thumbnail: '',
+  src: '/unrenderable-host-audit.glb',
+  dimensions: [0.1, 0.2, 0.1] as [number, number, number],
+}
+const site = SiteNode.parse({})
+const building = BuildingNode.parse({ parentId: site.id })
+const level = LevelNode.parse({ parentId: building.id })
+type Mover = 'registry' | 'catalog'
+type Row = {
+  kind: string
+  mover: Mover
+  order: string
+  accepted: boolean
+  parent: string
+  mounted: boolean
+  rendered: boolean
+  survives: boolean
+  samePose: boolean
+  reloadRendered: boolean
+  parsedSamePose: boolean | null
+  parsedRendered: boolean | null
+  parsedSurvives: boolean | null
+  retainsChildren: boolean
+  plan: boolean
+  planError: string
+  moveError: string
+  parseError: string
+}
+let savedScene: ReturnType<typeof useScene.getState>
+let savedEditor: ReturnType<typeof useEditor.getState>
+let savedViewer: ReturnType<typeof useViewer.getState>
+let savedScope: ReturnType<typeof useInteractionScope.getState>
+let restoreRegistry: () => void
+let restoreGlobals: () => void
+let loadModel: ReturnType<typeof spyOn>
+let htmlLabels: ReturnType<typeof spyOn>
 
-  beforeEach(() => {
-    htmlLabels =
```

---

### Incident Patch 14: `02b49df1` (2026-10-01)
**Commit Message**: fix(mcp): create_room and create_story_shell group their edits on the bridge

Both wrapped their patch in runAsSingleSceneHistoryStep(useScene, …), the
editor's global store. The hosted MCP keeps its scene and undo history in its own
bridge, and in the Next server bundle the global store has no history, so both
tools failed there with "Cannot read properties of undefined (reading
'getState')". They now use bridge.runAsSingleHistoryStep, as structure-tools.ts
does: SceneBridge groups on the store, the hosted bridge on its own history.

Found driving the hosted MCP end to end for this PR; pinned in the private repo
(hosted-mcp-history.test.ts, run against a bridge without the store history).

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `packages/mcp/src/tools/construction-tools.ts` (modified, +1/-3)
```diff
@@ -5,8 +5,6 @@ import {
   cutFloorOpening,
   generateId,
   resolveStairTotalRise,
-  runAsSingleSceneHistoryStep,
-  useScene,
 } from '@pascal-app/core'
 import type { AnyNode, AnyNodeId } from '@pascal-app/core/schema'
 import {
@@ -351,7 +349,7 @@ export function registerConstructionTools(server: McpServer, bridge: SceneOperat
       const wallIds = plan.changes.flatMap((change) =>
         change.op === 'create' && change.node.type === 'wall' ? [change.node.id] : [],
       )
-      runAsSingleSceneHistoryStep(useScene, () => {
+      bridge.runAsSingleHistoryStep(() => {
         bridge.applyPatch(
           plan.changes.map((change) =>
             change.op === 'create'
```

**File**: `packages/mcp/src/tools/room-tools.ts` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
-import { createZone, generateId, runAsSingleSceneHistoryStep, useScene } from '@pascal-app/core'
+import { createZone, generateId } from '@pascal-app/core'
 import {
   collectDoorKeepouts,
   collectOccupiedFootprints,
@@ -490,7 +490,7 @@ export function registerCreateRoom(server: McpServer, bridge: SceneOperations):
           areaSqMeters: 0,
           conflicts: plan.conflicts,
         })
-      runAsSingleSceneHistoryStep(useScene, () => {
+      bridge.runAsSingleHistoryStep(() => {
         bridge.applyPatch(
           plan.changes.map((change) =>
             change.op === 'create'
```

---

### Incident Patch 15: `3598a5c0` (2026-10-01)
**Commit Message**: fix(agent): a stair's floor opening is checked in its own building; overlap refusals size wall items

- verify_scene's destination-opening check took every level between the stair's
  from and to storeys, other buildings included, so the house next door's upper
  floor was reported as missing this stair's opening. targetLevelIdsForStair now
  keeps the stair's own building, like missing_stair and wall_spans_storeys.
- The opening_overlap refusal read `width` on the blocking child; a wall-mounted
  item keeps its size on its asset, so the span read 0.00 m–0.00 m. It now uses
  getScaledDimensions, as the overlap check does.

Each pinned by a case: verify-scene-cases.ts (an annex with its own upper floor)
and wall-opening-cases.ts (a door over a wall-mounted shelf, core and MCP).
Both from Cursor Bugbot's second review of #990.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `packages/core/src/agent-operations/__fixtures__/verify-scene-cases.ts` (modified, +37/-0)
```diff
@@ -383,6 +383,43 @@ export const VERIFY_SCENE_CASES: AgentToolCase[] = [
     // Only core: a live store cuts the opening itself when the scene loads, as the editor does.
     { surfaces: ['core'] },
   ),
+  verify(
+    "a stair's floor opening is checked in its own building, not in the house next door",
+    () =>
+      scene(
+        building(),
+        level('level_0', 0),
+        level('level_1', 1),
+        ...room('level_0', 'ground'),
+        ...room('level_1', 'upper').filter((node) => node.type !== 'slab'),
+        SlabNode.parse({
+          id: 'slab_upper',
+          parentId: 'level_1',
+          polygon: ROOM,
+          holes: [
+            [
+              [1.5, 0.2],
+              [2.5, 0.2],
+              [2.5, 2.2],
+              [1.5, 2.2],
+            ],
+          ],
+          holeMetadata: [{ source: 'stair', stairId: 'stair_level_0' }],
+        }),
+        ...stairOn('level_0', {
+          fromLevelId: 'level_0',
+          toLevelId: 'level_1',
+          slabOpeningMode: 'destination',
+        }),
+        building('building_annex'),
+        level('level_annex_0', 0, { parentId: 'building_annex' }),
+        level('level_annex_1', 1, { parentId: 'building_annex' }),
+        ...room('level_annex_0', 'annex_ground'),
+        ...room('level_annex_1', 'annex_upper'),
+      ),
+    { lacks: ['stair_no_opening'] },
+    { surfaces: ['core'] },
+  ),
   verify(
     'furniture in front of a door is reported',
     () =>
```

**File**: `packages/core/src/agent-operations/verify-scene.ts` (modified, +9/-0)
```diff
@@ -167,8 +167,17 @@ function targetLevelIdsForStair(nodes: SceneNodes, stair: StairNode): string[] {
   if (fromLevel === undefined || toLevel === undefined) return toLevelId ? [toLevelId] : []
   const low = Math.min(fromLevel, toLevel)
   const high = Math.max(fromLevel, toLevel)
+  const fromLevelNode = fromLevelId ? nodes[fromLevelId] : undefined
+  const buildingId =
+    fromLevelNode?.type === 'level'
+      ? levelBuildingId(nodes as Record<AnyNodeId, AnyNode>, fromLevelNode)
+      : null
   return levelsOf(nodes)
     .filter((level) => level.level > low && level.level <= high)
+    .filter(
+      (level) =>
+        !buildingId || levelBuildingId(nodes as Record<AnyNodeId, AnyNode>, level) === buildingId,
+    )
     .map((level) => level.id)
 }
 
```

**File**: `packages/core/src/building/__fixtures__/wall-opening-cases.ts` (modified, +30/-4)
```diff
@@ -1,4 +1,4 @@
-import { BuildingNode, DoorNode, LevelNode, WallNode } from '../../schema'
+import { BuildingNode, DoorNode, ItemNode, LevelNode, WallNode } from '../../schema'
 
 /**
  * The edge cases of `add_door` / `add_window`, written before the operation: one table that the
@@ -24,6 +24,9 @@ export const OPENING_SCENE = {
   curved: 'wall_curved',
   /** 4 m wall with no height of its own: the 2.8 m storey decides. */
   storey: 'wall_storey',
+  /** 4 m wall carrying a 1.2 m wall-mounted shelf centred at 2.0 m (1.4–2.6 m, 1.0–1.6 m high). */
+  shelved: 'wall_shelved',
+  wallShelf: 'item_wall_shelf',
 } as const
 
 const wall = (id: string, z: number, length: number, extra: Record<string, unknown> = {}) =>
@@ -37,7 +40,7 @@ const wall = (id: string, z: number, length: number, extra: Record<string, unkno
     ...extra,
   })
 
-/** A fresh scene graph for every case: one building, one 2.8 m storey, six walls. */
+/** A fresh scene graph for every case: one building, one 2.8 m storey, seven walls. */
 export function openingScene() {
   // No height of its own: the storey decides.
   const { height: _height, ...storeyWall } = wall(OPENING_SCENE.storey, 10, 4)
@@ -48,6 +51,7 @@ export function openingScene() {
     { ...wall(OPENING_SCENE.busy, 6, 4), children: [OPENING_SCENE.existingDoor] },
     wall(OPENING_SCENE.curved, 8, 4, { curveOffset: 0.5 }),
     storeyWall as WallNode,
+    { ...wall(OPENING_SCENE.shelved, 12, 4), children: [OPENING_SCENE.wallShelf] },
   ]
   const door = DoorNode.parse({
     id: OPENING_SCENE.existingDoor,
@@ -57,6 +61,21 @@ export function openingScene() {
     width: 0.9,
     height: 2.1,
   })
+  const shelf = ItemNode.parse({
+    id: OPENING_SCENE.wallShelf,
+    parentId: OPENING_SCENE.shelved,
+    wallId: OPENING_SCENE.shelved,
+    position: [2, 1, 0],
+    asset: {
+      id: 'wall-shelf',
+      name: 'Wall shelf',
+      category: 'storage',
+      thumbnail: '/items/wall-shelf/thumbnail.webp',
+      src: '/items/wall-shelf/model.glb',
+      dimensions: [1.2, 0.6, 0.3],
+      attachTo: 'wall',
+    },
+  })
   const level = LevelNode.parse({
     id: OPENING_SCENE.levelId,
     parentId: OPENING_SCENE.buildingId,
@@ -65,7 +84,7 @@ export function openingScene() {
     children: walls.map((w) => w.id),
   })
   const building = BuildingNode.parse({ id: OPENING_SCENE.buildingId, children: [level.id] })
-  const nodes = Object.fromEntries([building, level, ...walls, door].map((node) => [node.id, node]))
+  const nodes = Object.fromEntries([building, level, ...walls, door, shelf].map((node) => [node.id, node]))
   return { nodes, rootNodeIds: [building.id] }
 }
 
@@ -89,7 +108,8 @@ export type WallOpeningCase = {
     | { localX: number; centerY: number; clamped: boolean; glassPanels?: boolean }
 }
 
-const { main, short, exact, busy, curved, storey, levelId, existingDoor } = OPENING_SCENE
+const { main, short, exact, busy, curved, storey, shelved, wallShelf, levelId, existingDoor } =
+  OPENING_SCENE
 
 export const WALL_OPENING_CASES: readonly WallOpeningCase[] = [
   // Where it goes
@@ -178,6 +198,12 @@ export const WALL_OPENING_CASES: readonly WallOpeningCase[] = [
     input: { wallId: busy, t: 0.5 },
     expect: { refusal: 'opening_overlap', mentions: [existingDoor] },
   },
+  {
+    name: 'a door over a wall-mounted item is refused with the item\'s span',
+    tool: 'add_door',
+    input: { wallId: shelved, t: 0.5 },
+    expect: { refusal: 'opening_overlap', mentions: [wallShelf, '1.40 m–2.60 m'] },
+  },
   {
     name: 'openings whose edges touch both fit',
     tool: 'add_door',
```

**File**: `packages/core/src/building/wall-openings.ts` (modified, +4/-1)
```diff
@@ -237,7 +237,10 @@ export function planWallOpening(nodes: Nodes, input: WallOpeningInput) {
   if (!input.force) {
     const blocking = findWallChildOverlap(wallId, nodes, clampedX, clampedY, width, height)
     if (blocking) {
-      const span = 'width' in blocking ? (blocking as { width: number }).width : 0
+      const span =
+        blocking.type === 'item'
+          ? getScaledDimensions(blocking as ItemNode)[0]
+          : (blocking as { width: number }).width
       const center = (blocking as { position: [number, number, number] }).position[0]
       refuse(
         'opening_overlap',
```

#### Recent Merged Pull Requests:
- **PR #994** (2026-10-02): Authored geometry: agents build objects, windows and doors in three.js (@wass08)
- **PR #993** (2026-10-01): Layer rules in Biome, validator path filter, public wiki recipes, renderers/systems pages, differential deleted (#992) (@wass08)
- **PR #991** (2026-10-01): nodes: one test process, one harness on virtual time, lifecycle goldens → contract (173 s → 62 s) (@wass08)
- **PR #990** (2026-10-01): refactor(agent): one set of agent tools for the chat and the MCP — shared contracts and operations (@AxiomeCG)
- **PR #989** (2026-10-01): Tests: delete refactor scaffolding and review-round audits (−14k lines) (@wass08)
- **PR #988** (2026-10-01): DECISIONS.md, AGENTS.md as a map, one open-pr skill (@wass08)
- **PR #987** (2026-10-01): Docs: snapping rule contradiction, nodes + wall-frame in the index, open-pr command (@wass08)
- **PR #986** (2026-10-01): CI: path-filter cli-smoke, dedupe mcp-ci, fast git hooks (@wass08)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
