# Forensic Learning Record (Deep Inspection): silexlabs/Silex

> **Canonical Artifact**: `07_PROJECT_LEARNING/silexlabs-silex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/silexlabs/Silex](https://github.com/silexlabs/Silex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:06:17.747Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `silexlabs/Silex`
- **Description**: Silex is an online tool for visually creating static sites with dynamic data. With the free/libre spirit of internet, together.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2995 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `editor/grapesjs/cms/states.ts`
```
import { removeState, setState, COMPONENT_NAME_PREFIX, Property, toExpression, StoredFilter, State, StoredState, StoredToken, Expression } from '@silexlabs/grapesjs-data-source'
import { Silex11tyPluginWebsiteSettings } from './index'
import { Component, Editor, Page } from 'grapesjs'
import { ClientEvent } from '../../events'

export default function(editor: Editor/*, opts: EleventyPluginOptions */): void {
  editor.on('page:select page:update', () => updatePaginationStates(editor))
  editor.on(ClientEvent.SETTINGS_SAVE_END, () => updatePaginationStates(editor))
}

/**
 * Update pagination states for a page with the ability to control which page index to show
 * @param editor - The GrapesJS editor instance
 * @param pageIndex - The current page index (0-based) for pagination preview. Use 0 for publication.
 */
export function updatePaginationStates(editor: Editor, pageIndex = 0, preventTrigger = false) {
  const page = editor.Pages.getSelected()
  const body: Component = page?.getMainComponent() as Component
  if (!body) return // This happens when the current page is deleted

  // Do not show "Body's " prefix for states on the body
  body.attributes.COMPONENT_NAME_PREFIX = ''

  // Store pagination data in the body component
  // This is for the GraphQL query to include it
  const settings = page?.get('settings') as Silex11tyPluginWebsiteSettings | undefined
  const pageData = toExpression(settings?.eleventyPageData) as (Property[] | null)

  if (pageData && pageData.length > 0) {
    try {
      // Taken from the pagination object https://www.11ty.dev/docs/pagination/
      // Apply pagination size limit using slice filter
      const pageSize = parseInt(settings?.eleventyPageSize || '1')
      const startIndex = pageIndex * pageSize
      const endIndex = startIndex + pageSize

      const slice = {
        type: 'filter',
        id: 'slice',
        label: 'slice',
        options: {
          start: startIndex,
          end: endIndex,
        },
      } as StoredFilter

      const itemsExpression = [
        ...pageData,
        slice,
      ]

      if (preventTrigger) {
        const itemsState: StoredState = body.attributes.publicStates.find((state: StoredFilter) => state.id === 'items')
        if (!itemsState) {
          if (!body.attributes.publicStates) body.attributes.publicStates = []
          body.attributes.publicStates.push({
            hidden: true,
            label: 'Pagination items',
            expression: itemsExpression,
          })
        } else {
          itemsState.expression = itemsExpression
        }

        // Add or update pagination state in publicStates
        const paginationState: StoredState = body.attributes.publicStates.find((state: StoredFilter) => state.id === 'pagination')
        const paginationExpression = [{
          label: 'Unused pagination label',
          type: 'property',
          propType: 'field',
          fieldId: 'pagination',
          dataSourceId: 'eleventy',
          typeIds: ['pagination'],
          kind: 'object',
        }] as Expression
        if (!paginationState) {
          body.attributes.publicStates.push({
            hidden: true,
            label: 'pagination',
            expression: paginationExpression,
          })
        } else {
          paginationState.expression = paginationExpression
        }
      } else {
        // FIXME: should we let UndoManager save?
        editor.UndoManager.skip(() => {
          setState(body, 'items', {
            hidden: true,
            label: 'Pagination items',
            expression: itemsExpression,
          }, true, 1)

          // Update body states with the new settings
          setState(body, 'pagination', {
            hidden: true,
            label: 'pagination',
            expression: [{
              label: 'Unused pagination label',
              type: 'property' as const,
              propType: 'field' as const,
              fieldId: 'pagination',
              dataSourceId: 'eleventy',
              typeIds: ['pagination'],
              kind: 'object' as const,
            }]
          }, true, 0)
        })
      }
    } catch (e) {
      console.error('Invalid JSON for eleventyPageData', e)
      removeState(body, 'pagination', true)
      removeState(body, 'items', true)
      editor.runCommand('notifications:add', {
        type: 'error',
        message: 'Invalid JSON for eleventyPageData',
        group: 'Errors in your settings',
        componentId: body.id,
      })
      return
    }
  } else {
    removeState(body, 'pagination', true)
    removeState(body, 'items', true)
  }
}

```

### Core Architecture Module: `editor/grapesjs/core-commands.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Editor } from 'grapesjs'

/**
 * Core GrapesJS commands for blocks, components, styles and classes.
 * Registered as AI capabilities via grapesjs-ai-capabilities.
 */

function findComponentById(editor: Editor, id: string) {
  const all: any[] = []
  const collect = (c) => { all.push(c); c.components().forEach(collect) }
  collect(editor.getWrapper())
  return all.find(c => c.getId() === id)
}

export default (editor: Editor) => {
  // Blocks
  editor.Commands.add('blocks:list', () => {
    return editor.BlockManager.getAll().map(b => ({
      id: b.getId(),
      label: b.getLabel(),
      category: b.getCategoryLabel(),
    }))
  })
  editor.Commands.add('blocks:add', (_ed, _sender, options: any = {}) => {
    const { blockId } = options
    if (!blockId) throw new Error('Required: blockId. Use blocks:list to see available blocks.')
    const block = editor.BlockManager.get(blockId)
    if (!block) throw new Error(`Block "${blockId}" not found. Use blocks:list to see available blocks.`)
    const selected = editor.getSelected() || editor.getWrapper()
    return selected.append(block.getContent())?.[0]?.toHTML()
  })

  // Components
  editor.Commands.add('components:list', () => {
    const walk = (comp, depth = 0) => {
      const result: any[] = [{
        id: comp.getId(),
        tagName: comp.get('tagName'),
        type: comp.get('type'),
        name: comp.getName(),
        depth,
      }]
      comp.components().forEach(c => result.push(...walk(c, depth + 1)))
      return result
    }
    return walk(editor.getWrapper())
  })
  editor.Commands.add('components:select', (_ed, _sender, options: any = {}) => {
    const { id } = options
    if (!id) throw new Error('Required: id. Use components:list to see all component ids.')
    const found = findComponentById(editor, id)
    if (!found) throw new Error(`Component "${id}" not found. Use components:list to see all component ids.`)
    editor.select(found)
  })
  editor.Commands.add('components:remove', (_ed, _sender, options: any = {}) => {
    const comp = options.id ? findComponentById(editor, options.id) : editor.getSelected()
    if (!comp) throw new Error(options.id ? `Component "${options.id}" not found. Use components:list to see all component ids.` : 'No component selected. Use components:select first, or pass {id}.')
    if (comp === editor.getWrapper()) throw new Error('Cannot remove the body component.')
    comp.remove()
  })
  editor.Commands.add('components:move', (_ed, _sender, options: any = {}) => {
    const { id, targetId, position } = options
    if (!id) throw new Error('Required: id — the component to move. Use components:list to see all ids.')
    if (!targetId) throw new Error('Required: targetId — the parent to move into. Use components:list to see all ids.')
    const comp = findComponentById(editor, id)
    if (!comp) throw new Error(`Component "${id}" not found. Use components:list to see all component ids.`)
    const target = findComponentById(editor, targetId)
    if (!target) throw new Error(`Target "${targetId}" not found. Use components:list to see all component ids.`)
    const idx = typeof position === 'number' ? position : undefined
    target.append(comp.clone(), { at: idx })
    comp.remove()
  })
  editor.Commands.add('components:update', (_ed, _sender, options: any = {}) => {
    const selected = editor.getSelected()
    if (!selected) throw new Error('No component selected. Use components:select first.')
    const { content, tagName, attributes } = options
    if (content !== undefined) selected.components(content)
    if (tagName) selected.set('tagName', tagName)
    if (attributes && typeof attributes === 'object') {
      Object.entries(attributes).forEach(([k, v]) => selected.addAttributes({ [k]: v }))
    }
    if (content === undefined && !tagName && !attributes) {
      throw new Error('Required: at least one of {content, tagName, attributes}. Example: {content: "<b>Hello</b>"} or {tagName: "section"} or {attributes: {title: "My div"}}')
    }
  })

  // CSS Classes
  editor.Commands.add('classes:list', () => {
    const selected = editor.getSelected()
    if (!selected) throw new Error('No component selected. Use components:select first.')
    return selected.getClasses()
  })
  editor.Commands.add('classes:add', (_ed, _sender, options: any = {}) => {
    const selected = editor.getSelected()
    if (!selected) throw new Error('No component selected. Use components:select first.')
    const { name } = options
    if (!name) throw new Error('Required: name (CSS class name, e.g. "my-card", "container"). Use classes:list to see existing classes.')
    selected.addClass(name)
  })
  editor.Commands.add('classes:remove', (_ed, _sender, options: { name?: string } = {}) => {
    const selected = editor.getSelected()
    if (!selected) throw new Error('No component selected. Use components:select first.')
    const { name } = options
    if (!name) throw new Error('Required: name (CSS class name). Use classes:list to see classes on the selected component.')
    const classes: string[] = selected.getClasses()
    if (!classes.includes(name)) {
      throw new Error(classes.length
        ? `Class "${name}" is not on the selected element. Its classes are: ${classes.join(', ')}.`
        : `Class "${name}" is not on the selected element. It has no classes.`)
    }
    selected.removeClass(name)
  })

  // Devices
  editor.Commands.add('device:list', () => {
    return editor.Devices.getDevices().map((d: any) => ({
      id: d.id,
      name: d.get('name'),
      width: d.get('width'),
      widthMedia: d.get('widthMedia'),
    }))
  })
  editor.Commands.add('device:set', (_ed, _sender, options: any = {}) => {
    const { name } = options
    if (!name) throw new Error('Required: name (device name or id, e.g. "Desktop", "Tablet", "Mobile"). Use device:list to see available devices.')
    const dev = editor.Devices.get(name)
      || editor.Devices.getDevices().find((d: any) => d.get('name') === name)
    if (!dev) throw new Error(`Device "${name}" not found. Use device:list to see available devices.`)
    editor.Devices.select(dev)
  })

  // History
  editor.Commands.add('history:undo', () => {
    if (!editor.UndoManager.hasUndo()) throw new Error('Nothing to undo.')
    editor.UndoManager.undo()
  })
  editor.Commands.add('history:redo', () => {
    if (!editor.UndoManager.hasRedo()) throw new Error('Nothing to redo.')
    editor.UndoManager.redo()
  })

  // Register AI capabilities
  editor.on('ai-capabilities:ready', (addCapability) => {
    addCapability({
      id: 'blocks:list',
      command: 'blocks:list',
      description: 'List available blocks',
      readOnly: true,
      tags: ['blocks'],
    })
    addCapability({
      id: 'blocks:add',
      command: 'blocks:add',
      description: 'Insert a block into selected element',
      inputSchema: {
        type: 'object',
        required: ['blockId'],
        properties: {
          blockId: { type: 'string' },
        },
      },
      tags: ['blocks'],
    })
    addCapability({
      id: 'components:list',
      command: 'components:list',
      description: 'List all elements in the page',
      readOnly: true,
      tags: ['components'],
    })
    addCapability({
      id: 'components:select',
      command: 'components:select',
      description: 'Select an element by id',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      tags: ['components'],
    })
    addCapability({
      id: 'components:remove',
      command: 'components:remove',
      description: 'Remove an element',
      destructive: true,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Element id. Omit to remove selected.' },
        },
      },
      tags: ['components'],
    })
    addCapability({
      id: 'components:move',
      command: 'components:move',
      description: 'Move an element into another parent',
      inputSchema: {
        type: 'object',
        required: ['id', 'targetId'],
        properties: {
          id: { type: 'string' },
          targetId: { type: 'string' },
          position: { type: 'number', description: 'Index in target children' },
        },
      },
      tags: ['components'],
    })
    addCapability({
      id: 'components:update',
      command: 'components:update',
      description: 'Update content, tagName or attributes of selected element',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'HTML content' },
          tagName: { type: 'string' },
          attributes: { type: 'object' },
        },
      },
      tags: ['components'],
    })
    addCapability({
      id: 'classes:list',
      command: 'classes:list',
      description: 'List CSS classes on selected element',
      readOnly: true,
      tags: ['classes'],
    })
    addCapability({
      id: 'classes:add',
      command: 'classes:add',
      description: 'Add CSS class to selected element',
      inputSchema: {
        type: 'object',
        required: ['name'],
   
```

### Core Architecture Module: `editor/utils.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Component, Editor } from 'grapesjs'

// Browse all elements of all pages
export function onAll(editor: Editor, cbk: (c: Component) => void) {
  editor.Pages.getAll()
    .forEach(page => {
      const mainComponent = page.getMainComponent()
      if (mainComponent) {
        mainComponent.onAll(c => cbk(c))
      }
    })
}

/**
 * SHA256 hash a string
 */
export async function hashString(str: string): Promise<string> {
  if (crypto.subtle != undefined) {
    // Convert the string to an ArrayBuffer
    const encoder = new TextEncoder()
    const data = encoder.encode(str)

    // Hash the data with SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)

    // Convert the ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    return hashHex
  }
  else {return 'local'}
}

/**
 * Select the <body> element in the editor.
 * @param editor The GrapesJS editor.
 */
export function selectBody(editor: Editor): void {
  editor.select(editor.DomComponents.getWrapper())
}

/**
 * Checks if an element is a text or input field.
 * @param element The element to check.
 */
export function isTextOrInputField(element: HTMLElement): boolean {
  if(element.getAttribute('type') === 'submit') return false
  const isInput: boolean = element.tagName === 'INPUT'
  const isOtherFormElement: boolean = ['TEXTAREA', 'OPTION', 'OPTGROUP', 'SELECT', 'BUTTON'].includes(element.tagName)

  return isInput || isOtherFormElement
}

/**
 * Makes every word in a string start with an uppercase letter.
 * @param str The string to title-case.
 * @param sep The separator between words.
 */
export function titleCase(str: string, sep: string = ' '): string {
  const split = str.split(sep)
  return split.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(sep)
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait = 100): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function(this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}

```

### Core Architecture Module: `grapesjs-plugins/grapesjs-data-source/src/model/state.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Component, Editor } from 'grapesjs'
import { Expression, StateId, State } from '../types'

/**
 * @fileoverview This file contains the model for components states
 * A state is a value which can be used in expressions
 * If exported it will be available in the context of child components
 */

// Keys to store the states in the component
const EXPORTED_STATES_KEY = 'publicStates'
const PRIVATE_STATES_KEY = 'privateStates'

/**
 * Persistant ID is used to identify a component reliably
 * It will be stored with the website data
 */
const PERSISTANT_ID_KEY = 'id-plugin-data-source'

/**
 * Override the prefix of state names
 */
export const COMPONENT_NAME_PREFIX = 'nameForDataSource'

/**
 * Types
 */
export interface StoredState {
  label?: string
  hidden?: boolean
  expression: Expression
}

export interface StoredStateWithId extends StoredState {
  id: StateId
}

export type PersistantId = string

/**
 * Get the persistant ID of a component
 */
export function getPersistantId(component: Component): PersistantId | null {
  return component.get(PERSISTANT_ID_KEY) ?? null
}

/**
 * Get the persistant ID of a component and create it if it does not exist
 */
export function getOrCreatePersistantId(component: Component): PersistantId {
  const persistantId = component.get(PERSISTANT_ID_KEY)
  if(persistantId) return persistantId
  const newPersistantId = `${component.ccid}-${Math.round(Math.random() * 10000)}` as PersistantId
  component.set(PERSISTANT_ID_KEY, newPersistantId)
  return newPersistantId
}

/**
 * Find a component by its persistant ID in the current page
 */
export function getComponentByPersistentId(id: PersistantId, editor: Editor): Component | null {
  const pages = editor.Pages.getAll()
  for(const page of pages) {
    const body = page.getMainComponent()
    const component = getChildByPersistantId(id, body)
    if(component) return component
  }
  return null
}

/**
 * Find a component by its persistant ID in
 */
export function getChildByPersistantId(id: PersistantId, parent: Component): Component | null {
  if(getPersistantId(parent) === id) return parent
  for(const child of parent.components()) {
    const component = getChildByPersistantId(id, child)
    if(component) return component
  }
  return null
}

/**
 * Find a component by its persistant ID in the current page
 */
export function getParentByPersistentId(id: PersistantId, component: Component | undefined): Component | null {
  if(!component) return null
  if(getPersistantId(component) === id) return component
  return getParentByPersistentId(id, component.parent())
}

/**
 * Get the display name of a state
 */
export function getStateDisplayName(child: Component, state: State): string {
  const component = getParentByPersistentId(state.componentId, child)
  //const name = component?.getName() ?? '[Not found]'
  const prefix = component?.get(COMPONENT_NAME_PREFIX) ?? '' // `${name}'s`
  return  `${prefix ? prefix + ' ' : ''}${state.label || state.storedStateId}`
}

/**
 * Callbacks called when a state is changed
 * @returns A function to remove the callback
 */
const _callbacks: ((state: StoredState | null, component: Component) => void)[] = []
export function onStateChange(callback: (state: StoredState | null, component: Component) => void): () => void {
  _callbacks.push(callback)
  return () => {
    const index = _callbacks.indexOf(callback)
    if(index >= 0) _callbacks.splice(index, 1)
  }
}
function fireChange(state: StoredState | null, component: Component) {
  _callbacks.forEach(callback => callback(state, component))
}

/**
 * List all exported states
 */
export function getStateIds(component: Component, exported: boolean = true, before?: StateId): StateId[] {
  try {
    const states = component.get(exported ? EXPORTED_STATES_KEY : PRIVATE_STATES_KEY) as StoredStateWithId[] ?? []
    const allStates = states
      .sort((a, b) => Number(b.hidden ?? false) - Number(a.hidden ?? false)) // Hidden states first
      .map(state => state.id)
    if(before) {
      const index = allStates.indexOf(before)
      if(index < 0) return allStates
      return allStates.slice(0, index)
    }
    return allStates
  } catch(e) {
    // this happens when the old deprecated state system is used
    console.error('Error while getting state ids', e)
    return []
  }
}

/**
 * List all exported states
 */
export function getStates(component: Component, exported: boolean = true): StoredState[] {
  const states = component.get(exported ? EXPORTED_STATES_KEY : PRIVATE_STATES_KEY) as StoredStateWithId[] ?? []
  return states.map(state => ({
    label: state.label,
    hidden: state.hidden,
    expression: state.expression,
  }))
}

/**
 * Get the name of a state variable
 * Useful to generate code
 */
export function getStateVariableName(componentId: string, stateId: StateId): string {
  return `state_${ componentId }_${ stateId }`
}

/**
 * Get a state
 */
export function getState(component: Component, id: StateId, exported: boolean = true): StoredState | null {
  const states = component.get(exported ? EXPORTED_STATES_KEY : PRIVATE_STATES_KEY) as StoredStateWithId[] ?? []
  const state = states.find(state => state.id === id) ?? null
  if(!state) {
    return null
  }
  return {
    label: state.label,
    hidden: state.hidden,
    expression: state.expression,
  }
}

/**
 * Set a state
 * The state will be updated or created at the end of the list
 * Note: index is not used in this project anymore (maybe in apps using this plugins)
 */
export function setState(component: Component, id: StateId, state: StoredState, exported = true, index = -1): void {
  const key = exported ? EXPORTED_STATES_KEY : PRIVATE_STATES_KEY
  const states = component.get(key) as StoredStateWithId[] ?? []
  const existing = states.find(s => s.id === id) ?? null
  if(existing) {
    component.set(key, states.map(s => s.id !== id ? s : {
      id,
      ...state,
    }))
  } else {
    component.set(key, [
      ...states,
      {
        id,
        ...state,
      },
    ])
  }
  // Set the index if needed
  if(index >= 0) {
    const states = [...component.get(key) as StoredStateWithId[]]
    const state = states.find(s => s.id === id)
    if(state && index < states.length) {
      states.splice(states.indexOf(state), 1)
      states.splice(index, 0, state)
      component.set(key, states)
    }
  }
  // Notify the change
  fireChange({
    label: state.label,
    hidden: state.hidden,
    expression: state.expression,
  }, component)
}

/**
 * Remove a state
 */
export function removeState(component: Component, id: StateId, exported: boolean = true): void {
  const key = exported ? EXPORTED_STATES_KEY : PRIVATE_STATES_KEY
  const states = component.get(key) as StoredStateWithId[] ?? []
  const newStates = states.filter(s => s.id !== id)
  component.set(key, newStates)
  fireChange(null, component)
}

```

### Core Architecture Module: `grapesjs-plugins/grapesjs-data-source/src/utils.ts`
```
import { Expression, Field, FieldKind, IDataSource, Options, Token, TypeId, Type } from './types'
import { Editor } from 'grapesjs'
import { getParentByPersistentId, getStateDisplayName, getState } from './model/state'
import { TemplateResult, html } from 'lit'
import { Component } from 'grapesjs'
import { fromStored, getExpressionResultType } from './model/token'
import GraphQL, { GraphQLOptions } from './datasources/GraphQL'
import { getDataSource, getAllDataSources } from './model/dataSourceRegistry'
import { FIXED_TOKEN_ID } from './types'

export const NOTIFICATION_GROUP = 'Data source'


/**
 * Get the display name of a field
 */
export function cleanStateName(name: string | null) {
  return name?.toLowerCase()
    ?.replace(/[^a-z0-9:._-]/g, '-')
    ?.replace(/^[0-9]+/, '-') // HTML attributes cannot start with digits
}

/**
 * Get the display type of a field
 * For the dropdown in expressions
 * @example "String", "String [ ]", "String { }"
 */
function getTypeDisplayName(typeIds: TypeId[], kind: FieldKind | null): string {
  // Cap union types (e.g. Relay `node` lists ~24 types) so the option stays short and
  // the native <select> popup doesn't stretch to fit it
  const MAX_TYPES = 3
  const shown = typeIds.slice(0, MAX_TYPES)
  const extra = typeIds.length - shown.length
  const typeIdsStr = (shown.join(', ') + (extra > 0 ? `, +${extra}` : '')).toLowerCase()
  return kind === 'list' ? ` (${typeIdsStr}[])` : kind === 'object' ? ` (${typeIdsStr}{})` : ` (${typeIdsStr})`
}

export function getComponentDebug(component: Component): string {
  const parent = component.parent()
  const parentName = parent?.getName()
  const parentTagName = parent?.get('tagName')
  const parentDebug = parentName ? `${parentName} (${parentTagName})` : parentTagName
  const id = component.cid
  const tagName = component.get('tagName')
  const classes = component.getClasses()
  const classesStr = classes.length ? `.${classes.join('.')}` : ''
  const name = component.getName()
  return `${parentDebug} > ${name} (${tagName}#${id}${classesStr})`
}

/**
 * Concatenate strings to get a desired length string as result
 * Exported for tests
 */
export function concatWithLength(desiredNumChars: number, ...strings: string[]): string {
  // const diff = desiredNumChars - `${token.label} ${type}`.length
  // return `${token.label}${'\xA0'.repeat(diff * 2)} ${type} ${desiredNumChars}`
  // Get current string length
  const len = strings.reduce((acc, str) => acc + str.length, 0)
  const diff = Math.max(desiredNumChars - len, 0)
  // Give the fist string the desired length
  const [first, ...rest] = strings
  const newFirst = first + '\xA0'.repeat(diff)
  // Return the concatenated string
  return [newFirst, ...rest].join('')
}

/**
 * Get the label for a token
 * This is mostly about formatting a string for the dropdowns
 */
export function getTokenDisplayName(component: Component, token: Token): string {
  switch (token.type) {
  case 'property': {
    const type = getTypeDisplayName(token.typeIds, token.kind)
    return `${token.label} ${type}`
  }
  case 'filter': return token.label
  case 'state':
    return getStateDisplayName(component, token)
  default:
    console.error('Unknown token type (reading type)', token)
    throw new Error('Unknown token type')
  }
}

/**
 * Group tokens by type
 * This is used to create the groups in dropdowns
 */
export function groupByType(editor: Editor, component: Component, completion: Token[], expression: Expression): Record<string, Token[]> {
  return completion
    .reduce((acc, token) => {
      let label
      switch (token.type) {
      case 'filter': label = 'Filters'; break
      case 'property': {
        if(token.dataSourceId) {
          if(expression.length > 0) {
            try {
              const type = getExpressionResultType(expression, component)
              label = type?.label ?? type?.id ?? 'Unknown'
            } catch(e) {
              // FIXME: notify user
              console.error('Error while getting expression result type in groupByType', {expression, component})
              label = 'Unknown'
            }
          } else {
            const dataSource = getDataSource(token.dataSourceId)
            if(dataSource) {
              label = (dataSource as any).label || (dataSource as any).get?.('label') || token.dataSourceId
            } else {
              console.error('Data source not found', token.dataSourceId)
              editor.runCommand('notifications:add', {
                type: 'error',
                group: NOTIFICATION_GROUP,
                message: `Data source not found: ${token.dataSourceId}`,
              })
              throw new Error(`Data source not found: ${token.dataSourceId}`)
            }
          }
        } else {
          label = 'Fields'
        }
        break
      }
      case 'state': {
        const parent = getParentByPersistentId(token.componentId, component)
        const name = parent?.get('tagName') === 'body' ? 'Website' : parent?.getName()
        label = name ? `${name}'s states` : 'States'
        break
      }
      default:
        console.error('Unknown token type (reading type)', token)
        throw new Error('Unknown token type')
      }
      if (!acc[label]) acc[label] = []
      acc[label].push(token)
      return acc
    }, {} as Record<string, Token[]>)
}

/**
 * Create a "fixed" token
 * It is a hard coded content with which you can start an expression
 */
export function getFixedToken(value: string): Token {
  return {
    type: 'property',
    propType: 'field',
    fieldId: FIXED_TOKEN_ID,
    label: 'Fixed value',
    kind: 'scalar',
    typeIds: ['String'],
    options: {
      value,
    },
    optionsForm: () => html`
        <label>Value
          <input type="text" name="value" .value=${value}>
        </label>
    `,
  }
}

/**
 * Convert a token to a string
 * This is used to store the token in the component
 */
export function toValue(token: Token): string {
  return JSON.stringify({
    ...token,
  })
}

/**
 * Convert a token to an option's tag value (json string)
 */
export function toId(token: Token): string {
  switch (token.type) {
  case 'property': return `property__${token.dataSourceId || ''}__${token.fieldId}__${token.kind}__${token.typeIds.join(',')}`
  case 'filter': return `filter____${token.id}`
  case 'state': return `state__${token.componentId}__${token.storedStateId}`
  default:
    console.error('Unknown token type (reading type)', token)
    throw new Error('Unknown token type')
  }
}

/**
 * Whether a completion token is a backend "secondary" field (plumbing) hidden from the
 * dropdown until the user asks for all fields. Only property tokens whose data source
 * declares the field via getSecondaryFieldNames qualify.
 */
export function isSecondaryToken(token: Token, dataSources: IDataSource[]): boolean {
  if (token.type !== 'property') return false
  const ds = dataSources.find(d => String(d.id) === String(token.dataSourceId))
  return !!ds?.getSecondaryFieldNames?.().includes(token.fieldId)
}

/**
 * Filter a completion list for display: hides secondary fields unless showAll is set or
 * the token is currently selected (its id is in keepIds) — a selected field must always
 * stay in its dropdown even when secondary, otherwise its value would vanish.
 */
export function filterDisplayedCompletion(
  completion: Token[],
  isSecondary: (token: Token) => boolean,
  showAll: boolean,
  keepIds: string[] = [],
): Token[] {
  if (showAll) return completion
  return completion.filter(token => !isSecondary(token) || keepIds.includes(toId(token)))
}

/**
 * Revert an option's tag value to a token
 * @throws Error if the token type is not found
 */
export function fromString(editor: Editor, id: string, componentId: string | null): Token {
  return fromStored(JSON.parse(id), componentId) as Token
}

/**
 * Check if a json is an expression, i.e. an array of tokens
 */
export function isExpression(json: unknown): boolean {
  if(typeof json === 'string') throw new Error('json must be parsed')
  if (!Array.isArray(json)) return false
  return json.every(token => {
    if (typeof token !== 'object') return false
    if (!token.type) return false
    switch (token.type) {
    case 'property': {
      if (!token.fieldId) return false
      if (token.fieldId === FIXED_TOKEN_ID) {
        if (!token.options?.value) return false
      }
      break
    }
    case 'state': {
      if (!token.componentId) return false
      if (!token.storedStateId) return false
      break
    }
    case 'filter': {
      if (!token.id) return false
      break
    }
    }
    return true
  })
}

/**
 * Convert a json to an expression
 */
export function toExpression(json: unknown | string): Expression | null {
  try {
    if(typeof json === 'string') json = JSON.parse(json)
    if(isExpression(json)) return json as Expression
    return null
  } catch(e) {
    return null
  }
}

/**
 * Apply a kind to a field
 */
export function convertKind(field: Field | null, from: FieldKind, to: FieldKind): Field | null {
  if (!field) {
    return null
  }
  if (field.kind !== from) {
    console.error(`Field is not a ${from}`, field)
    throw new Error(`Field ${field.label} is not a ${from}`)
  }
  return {
    ...field,
    kind: to,
  }
}

/**
 * Get the type of a field, as provided by the data source
 * @throws Error if the field has a token with an unknown type
 */
export function getFieldType(editor: Editor, field: Field | null, key: string | undefined, componentId: string | null): Field | null {
  if (!field || !key) return null
  
  const allDataSources = getAllDataSources()
  const dataSource = allDataSources.find((ds: IDataSource) => ds.id === field.dataSourceId)
  if (!dataSource?.isConnected()) return null
  
  const types = field.typeIds.map(typeId => {
    const dsTypes = dataSource.getTypes()
    return dsTypes.find((type: Type) => type.id === typeId)
  }).filter(Boolean)
  
  const fields = types.ma
```

### Core Architecture Module: `grapesjs-plugins/grapesjs-data-source/src/view/custom-states-editor.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {LitElement, html} from 'lit'
import { ref } from 'lit/directives/ref.js'
import {property} from 'lit/decorators.js'
import { StoredState, getState, getStateIds, removeState, setState } from '../model/state'
import { Token  } from '../types'

import './state-editor'
import { StateEditor } from './state-editor'
import { Component, Editor } from 'grapesjs'
import { PROPERTY_STYLES } from './defaultStyles'
import { fromStored } from '../model/token'
import { cleanStateName } from '../utils'

interface Item {
  name: string
  publicState?: boolean
  state: StoredState
}

/**
 * Editor for selected element's states
 *
 */
export class CustomStatesEditor extends LitElement {
  @property({type: Boolean})
    disabled = false

  @property({type: Boolean, attribute: 'private-state'})
    privateState = false

  @property({type: String})
    title = 'Custom states'

  @property({type: Boolean, attribute: 'default-fixed'})
    defaultFixed = false

  @property({type: String, attribute: 'create-prompt'})
    createPrompt = 'Name this state'

  @property({type: String, attribute: 'rename-prompt'})
    renamePrompt = 'Rename this state'

  @property({type: String, attribute: 'default-name'})
    defaultName = 'New state'

  // This is a comma separated list of reserved names
  // Or an array of reserved names
  @property({type: String, attribute: 'reserved-names'})
  get reservedNames() { return this._reservedNames }
  set reservedNames(value: string | string[]) {
    if(typeof value === 'string') this._reservedNames = value.split(',').map(s => s.trim())
    else this._reservedNames = value
  }

  @property({type: Boolean, attribute: 'hide-loop-data'})
    hideLoopData = false

  @property({type: String, attribute: 'help-text'})
    helpText = ''

  @property({type: String, attribute: 'help-link'})
    helpLink = ''

  private _reservedNames: string[] = []
  private editor: Editor | null = null
  private redrawing = false

  setEditor(editor: Editor) {
    if (this.editor) {
      console.warn('property-editor setEditor already set')
      return
    }
    this.editor = editor

    // Update the UI when a page is added/renamed/removed
    this.editor.on('page', () => this.requestUpdate())

    // Update the UI on component selection change
    this.editor.on('component:selected', () => this.requestUpdate())

    // Update the UI on component change
    this.editor.on('component:update', () => this.requestUpdate())
  }

  getHead(selected: Component | null) {
    return html`
      <style>
        ${PROPERTY_STYLES}
      </style>
      <slot></slot>
      <section class="ds-section">
        <div>
          <div class="gjs-traits-label">
            <span>${this.title}</span>
            <span>
              ${ selected ? html`
              <button
              title="Add a new state"
              class="ds-states__add-button ds-states__button"
              @click=${() => {
    const item = this.createCustomState(selected)
    if(!item) return
    this.setState(selected, item.name, item.state)
  }}
              >+</button>
              ` : ''}
              ${this.helpText ? html`
              <details class="ds-states__help">
              <summary title="Help">?</summary>
              <div class="ds-states__help--tooltip">
              <span>${ this.helpText }</span>
              ${this.helpLink ? html`
              <a
                class="ds-states__help-link"
                href="${this.helpLink}"
                target="_blank"
                >\u{1F517} Read more...</a>
              ` : ''}
              </div>
              </details>
              ` : ''}
            </span>
          </div>
        </div>
      </section>
    `
  }

  override render() {
    super.render()
    this.redrawing = true
    const selected = this.editor?.getSelected()
    const empty = html`
      ${this.getHead(null)}
      <p class="ds-empty">Select an element to edit its states</p>
    `
    if(!this.editor || this.disabled) {
      this.redrawing = false
      return html``
    }
    if(!selected) {
      this.redrawing = false
      return empty
    }
    const items: Item[] = this.getStateIds(selected)
      .map(stateId => ({
        name: stateId,
        publicState: !this.privateState,
        state: this.getState(selected, stateId)!,
      }))
      .filter(item => item.state && !item.state.hidden)
    const result =  html`
      ${this.getHead(selected)}
      <div class="ds-states">
        <div class="ds-states__items">
          ${ items.length === 0 ? html`
            <p>Use the "+" button to add elements to this list</p>
          ` : ''}
          ${items
    .map((item, index) => html`
            <div class="ds-states__item">
              ${this.getStateEditor(selected, item.state.label || '', item.name)}
              <div class="ds-states__buttons">
                <button
                  title="Remove this state"
                  class="ds-states__remove-button ds-states__button"
                  @click=${() => {
    this.removeState(selected, item.name)
    this.requestUpdate()
  }}
                  >×</button>
                <button
                  title="Rename this state"
                  class="ds-states__rename-button ds-states__button"
                  @click=${() => {
    const newItem = this.renameCustomState(item)
    if(!newItem || newItem === item) return
    this.removeState(selected, item.name)
    this.setState(selected, newItem.name, newItem.state)
    this.requestUpdate()
  }}
                  >\u270F</button>
                  <button
                    title="Move this state up"
                    class="ds-states__item-move-up ds-states__button${ index === 0 ? ' ds-states__button--disabled' : '' }"
                    @click=${() => {
    items.splice(index - 1, 0, items.splice(index, 1)[0])
    this.updateOrderCustomStates(selected, items)
  }}
                    >\u2191</button>
                  <button
                    title="Move this state down"
                    class="ds-states__item-move-down ds-states__button${ index === items.length - 1 ? ' ds-states__button--disabled' : '' }"
                    @click=${() => {
    items.splice(index + 1, 0, items.splice(index, 1)[0])
    this.updateOrderCustomStates(selected, items)
  }}
                  >\u2193</button>
              </div>
            </div>
          `)}
        </div>
      </div>
    `
    this.redrawing = false
    return result
  }

  /**
   * Get the states for this type of editor
   */
  getStateIds(component: Component): string[] {
    return getStateIds(component, !this.privateState)
      // Filter out the states which are properties
      .filter(stateId => !this.reservedNames.includes(stateId))
  }

  /**
   * Get the states for this type of editor
   */
  getState(component: Component, name: string): StoredState | null {
    return getState(component, name, !this.privateState)
  }

  /**
   * Set the states for this type of editor
   */
  setState(component: Component, name: string, state: StoredState) {
    setState(component, name, state, !this.privateState)
  }

  /**
   * Remove the states for this type of editor
   */
  removeState(component: Component, name: string) {
    removeState(component, name, !this.privateState)
  }

  getStateEditor(selected: Component, label: string, name: string) {
    return html`
      <state-editor
        .selected=${selected}
        .editor=${this.editor}
        id="${name}"
        name=${name}
        ?hide-loop-data=${this.hideLoopData}
        default-fixed=${this.defaultFixed}
        ${ref(el => {
    if (el) {
      const stateEditor = el as StateEditor
      stateEditor.data = this.getTokens(selected, name)
    }
  })}
        @change=${() => this.onChange(selected, name, label)}
        .disabled=${this.disabled}
      >
        <label slot="label">${label || name}</label>
      </state-editor>
    `
  }

  onChange(component: Component, name: string, label: string) {
    if(this.redrawing) return
    const stateEditor = this.shadowRoot!.querySelector(`#${name}`) as StateEditor
    this.setState(component, name, {
      expression: stateEditor.data,
      label,
    })
  }

  getTokens(component: Component, name: string): Token[] {
    const state = this.getState(component, name)
    if(!state || !state.expression) return []
    return state.expression.map(token => {
      try {
        return fromStored(token, component.getId())
      } catch {
        // FIXME: notify user
        console.error('Error while getting expression result type in getTokens', {expression: state.expression, component, name})
        return {
          type: 'property',
          propType: 'field',
          fieldId: 'unknown',
          label: 'unknown',
          kind: 'scalar',
          typeIds: [],
        }
      }
    })
  }

  /**
   * Rename a custom state
   */
  renameCustomState(item: Item): Item {
    const label = prompt(this.renamePrompt, item.state.label)
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]/g, '-')
      ?.replace(/^-+|-+$/g, '')
    if (!label || label === item.state.label) return item
    return {
      ...item,
      state: {
        ...item.state,
      
```

### Core Architecture Module: `grapesjs-plugins/grapesjs-data-source/src/view/state-editor.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {LitElement, TemplateResult, html} from 'lit'
import {property} from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { styleMap } from 'lit/directives/style-map.js'
import { PROPERTY_STYLES } from './defaultStyles'
import { DATA_SOURCE_CHANGED, DATA_SOURCE_DATA_LOAD_END, Filter, FIXED_TOKEN_ID, Property, Token } from '../types'
import { filterDisplayedCompletion, fromString, getFixedToken, getTokenDisplayName, groupByType, isSecondaryToken, toExpression, toId, toValue } from '../utils'
import { ExpressionInput, PopinForm } from '@silexlabs/expression-input'
import { Component, Editor } from 'grapesjs'

import '@silexlabs/expression-input'
import { getCompletion } from '../model/completion'
import { evaluateExpressionTokens, EvaluationContext } from '../model/expressionEvaluator'
import { getAllDataSources } from '../model/dataSourceRegistry'
import { getFilters, getPreviewData, getManager } from '../model/dataSourceManager'
import { fromStored, getExpressionResultType } from '../model/token'

/**
 * Editor for a state of the selected element's properties
 *
 * Usage:
 *
 * ```
 * <state-editor
 *  name="state"
 *  disabled
 *  hide-loop-data
 *  parent-name="parent"
 *  no-filters
 *  root-type="root"
 *  default-fixed
 *  dismiss-current-component-states
 *  ></state-editor>
 * ```
 *
 */

export class StateEditor extends LitElement {
  @property({type: Boolean})
    disabled = false

  @property({type: String})
    name = ''

  @property({type: Boolean, attribute: 'hide-loop-data'})
    hideLoopData = false

  /**
   * used in the expressions found in filters options
   * This will be used to filter states which are not defined yet
   */
  @property({type: String, attribute: 'parent-name'})
    parentName = ''

  @property({type: Boolean, attribute: 'no-filters'})
    noFilters = false

  @property({type: String, attribute: 'root-type'})
    rootType = ''

  @property({type: Boolean, attribute: 'default-fixed'})
    defaultFixed = false

  // Note: dismissCurrentComponentStates not used in this project anymore
  @property({type: Boolean, attribute: 'dismiss-current-component-states'})
    dismissCurrentComponentStates = false

  private _selected: Component | null = null
  @property({type: Object})
  get selected(): Component | null {
    return this._selected
  }
  set selected(value: Component | null) {
    this._selected = value
    this.requestUpdate()
  }

  /**
   * Value string for for submissions
   */
  @property()
  get value(): string {
    return JSON.stringify(this.data)
  }
  set value(newValue: string) {
    const expression = toExpression(newValue)
    if (!expression) {
      this.data = newValue
      return
    }
    this.data = expression as Token[]
  }

  /**
   * Form id
   * This is the same API as input elements
   */
  @property({type: String, attribute: 'for'})
    for = ''

  /**
   * Binded listeners
   */
  private onFormdata_ = this.onFormdata.bind(this)
  private renderBinded = () => this.requestUpdate()

  override connectedCallback() {
    super.connectedCallback()
    // Use the form to add formdata
    if(this.for) {
      const form = document.querySelector<HTMLFormElement>(`form#${this.for}`)
      if(form) {
        this.form = form
      }
    } else {
      this.form = this.closest('form')
    }

    this.editor?.on(`${DATA_SOURCE_CHANGED} ${DATA_SOURCE_DATA_LOAD_END}`, this.renderBinded)
  }

  override disconnectedCallback() {
    this.form = null
    super.disconnectedCallback()
    this.editor?.off(`${DATA_SOURCE_CHANGED} ${DATA_SOURCE_DATA_LOAD_END}`, this.renderBinded)
  }

  /**
   * Handle formdata event to add the current value to the form
   */
  private onFormdata(event: FormDataEvent) {
    event.preventDefault()
    const formData = event.formData
    formData.set(this.name, this.value)
  }

  /**
   * Form setter
   * Handle formdata event to add the current value to the form
   */
  protected _form: HTMLFormElement | null = null
  set form(newForm: HTMLFormElement | null) {
    if(this._form) {
      this._form.removeEventListener('formdata', this.onFormdata_)
    }
    if(newForm) {
      newForm.addEventListener('formdata', this.onFormdata_)
    }
  }
  get form() {
    return this._form
  }

  /**
   * Structured data
   */
  private _data: Token[] = []
  get data(): Token[] {
    const input = this.expressionInputRef.value
    if(!this._selected || !this.editor) {
      console.error('selected and editor are required', this._selected, this.editor)
      //throw new Error('selected and editor are required')
      return []
    }
    if(!input || input.value.length === 0) return []
    if(input.fixed) {
      return [getFixedToken(input.value[0] || '')]
    } else {
      const ids = input.value
      return ids
        .filter((id: string) => !!id)
        .map((id: string) => {
          try {
            return fromString(this.editor!, id, this.selected!.getId())
          } catch(e) {
            console.error(`Error while getting token from id ${id}`, e)
            // Return unknown
            return {
              type: 'property',
              propType: 'field',
              fieldId: 'unknown',
              label: 'Unknown',
              kind: 'scalar',
              typeIds: [],
              options: {},
            } as Property
          }
        })
        // Here the data is missing options as data comes from completion
        // Add the options
        .map((token: Token, idx: number) => {
          const popin = this.popinsRef[idx]?.value
          switch(token.type) {
          case 'property':
          case 'filter':
            token.options = popin?.value || token.options
            break
          default:
            break
          }
          return token
        })
    }
  }
  set data(value: Token[] | string) {
    if(typeof value === 'string') {
      this._data = value === '' ? [] : [getFixedToken(value)]
    } else {
      this._data = value
    }
    if (this.editor) this.requestUpdate()
  }

  private _editor: Editor | null = null
  @property({type: Object})
  get editor(): Editor | null {
    return this._editor
  }
  set editor(value: Editor | null) {
    this._editor = value
    this.requestUpdate()
  }

  private redrawing = false
  // When true, backend "secondary" fields (plumbing) are shown in the dropdowns
  private showAllFields = false
  private expressionInputRef = createRef<ExpressionInput>()
  private popinsRef: Ref<PopinForm>[] = []

  override render() {
    this.redrawing = true
    super.render()
    if(!this.name) throw new Error('name is required on state-editor')
    if(!this.editor || !this.selected) {
      console.error('editor and selected are required', this.editor, this.selected)
      return html`<div class="ds-section
        ds-section--error">Error rendering state-editor component: editor and selected are required</div>`
    }

    const selected = this.selected
    // FIXME: fromStored every time we render is not efficient, it is supposed to have been done before
    const _currentValue = this._data.map(token => fromStored(token, selected.getId()))

    // Get the data to show in the "+" drop down
    const manager = getManager()
    const completion = getCompletion({
      component: this.dismissCurrentComponentStates ? selected.parent()! : selected,
      expression: _currentValue || [],
      rootType: this.rootType,
      currentStateId: this.parentName || this.name,
      hideLoopData: this.hideLoopData,
      manager,
    })
      .filter(token => token.type !== 'filter' || !this.noFilters)

    // Hide backend "secondary" fields (plumbing) unless the user toggled "show all"
    const dataSources = getAllDataSources()
    const isSecondary = (token: Token) => isSecondaryToken(token, dataSources)
    // Each dropdown that hides fields shows a "Show all fields" option at its top
    const mainHasSecondary = completion.some(isSecondary)
    const displayedCompletion = filterDisplayedCompletion(completion, isSecondary, this.showAllFields)

    const groupedCompletion = groupByType(this.editor, selected, displayedCompletion, _currentValue)

    // Check if the expression has a fixed value and nothing else
    const fixed = (_currentValue?.length === 1 && _currentValue[0].type === 'property' && _currentValue[0].fieldId === FIXED_TOKEN_ID)
      // If the value is empty and the default is fixed, then the input is fixed
      || (this.defaultFixed && _currentValue.length === 0)
      // If there is no completion and the value is empty
      || (completion.length === 0 && _currentValue.length === 0)

    // Fixed text
    const text = fixed ? (_currentValue![0] as Property)?.options?.value || '' : ''

    let currentData = '' as unknown
    try {
      const context: EvaluationContext = {
        dataSources: getAllDataSources(),
        filters: getFilters(),
        previewData: getPreviewData(),
        component: selected,
        resolvePreviewIndex: true,
      }
      const realData = evaluateExpressionTokens(_currentValue || [], context)
      currentData = realData
    } catch(e) {
      console.error('Current data could not be retrieved:', e)
    }
    if (typeof curr
```

### Core Architecture Module: `grapesjs-plugins/grapesjs-symbols/src/id-utils.ts`
```
import { Component, Editor } from 'grapesjs'

/**
 * Attributes that can contain references to element IDs.
 * These should be updated when IDs are made unique.
 */
const ID_REFERENCE_ATTRIBUTES = [
  'for',                    // <label for="...">
  'aria-labelledby',        // ARIA: labels
  'aria-describedby',       // ARIA: descriptions
  'aria-controls',          // ARIA: controls
  'aria-owns',              // ARIA: ownership
  'aria-activedescendant',  // ARIA: active descendant
  'aria-flowto',            // ARIA: flow
  'aria-errormessage',      // ARIA: error message
  'list',                   // <input list="..."> for datalist
  'form',                   // <input form="..."> for form association
  'headers',                // <td headers="..."> for table headers
]

/**
 * Attributes that contain ID references prefixed with #
 */
const HASH_ID_ATTRIBUTES = [
  'href',           // <a href="#id">
  'data-target',    // Bootstrap 4: data-target="#id"
  'data-bs-target', // Bootstrap 5: data-bs-target="#id"
]

/**
 * Helper to get all components under a root component in depth-first order.
 */
function flattenComponents(root: Component): Component[] {
  const components: Component[] = []
  root.onAll((c: Component) => components.push(c))
  return components
}

/**
 * Build a map from main symbol component IDs to instance component IDs
 * Uses component order to correlate since both have the same structure
 */
function buildIdMap(mainSymbol: Component, instance: Component): Map<string, string> {
  const idMap = new Map<string, string>()
  const mainComponents = flattenComponents(mainSymbol)
  const instanceComponents = flattenComponents(instance)
  const n = Math.min(mainComponents.length, instanceComponents.length)

  for (let i = 0; i < n; i++) {
    const mainId = mainComponents[i].getAttributes().id
    const instanceId = instanceComponents[i].getAttributes().id
    if (mainId && instanceId) {
      idMap.set(mainId, instanceId)
    }
  }
  return idMap
}

type IdReference = { index: number, attr: string, isHash: boolean }

/**
 * Collect all ID reference values from the main symbol.
 * Returns a map of: referenced ID -> list of {component index, attribute name, isHash}
 */
function collectIdReferences(mainSymbol: Component): Map<string, IdReference[]> {
  const refs = new Map<string, IdReference[]>()
  flattenComponents(mainSymbol).forEach((component, index) => {
    const attrs = component.getAttributes()

    // Check direct ID references
    for (const attr of ID_REFERENCE_ATTRIBUTES) {
      const value = attrs[attr]
      if (typeof value === 'string' && value) {
        const ids = value.split(/\s+/)
        ids.forEach(id => {
          if (!refs.has(id)) refs.set(id, [])
          refs.get(id)!.push({ index, attr, isHash: false })
        })
      }
    }

    // Check hash-prefixed ID references
    for (const attr of HASH_ID_ATTRIBUTES) {
      const value = attrs[attr]
      if (typeof value === 'string' && value.startsWith('#')) {
        const id = value.substring(1)
        if (!refs.has(id)) refs.set(id, [])
        refs.get(id)!.push({ index, attr, isHash: true })
      }
    }
  })

  return refs
}

/**
 * Update ID references in a symbol instance to match the new unique IDs.
 *
 * This function:
 * 1. Gets the main symbol for this instance
 * 2. Builds a map of main symbol IDs -> instance IDs
 * 3. Finds all ID references in the main symbol (for, aria-*, href="#...", etc.)
 * 4. Updates those references in the instance to use the new IDs
 *
 * @param editor - The GrapesJS editor instance
 * @param instance - The root component of the symbol instance
 */
export function makeInstanceIdsUnique(editor: Editor, instance: Component): void {
  const symbolInfo = editor.Components.getSymbolInfo(instance)
  if (!symbolInfo?.main) return
  const mainSymbol = symbolInfo.main

  const idMap = buildIdMap(mainSymbol, instance)
  if (idMap.size === 0) return

  const refs = collectIdReferences(mainSymbol)
  const instanceComponents = flattenComponents(instance)

  refs.forEach((refList, referencedId) => {
    // Prefer exact match, fallback to prefix match (e.g., for GrapesJS suffixes)
    let newId: string | undefined
    idMap.forEach((instanceId, mainId) => {
      if (mainId === referencedId || mainId.startsWith(referencedId + '-')) {
        newId = instanceId
      }
    })
    if (!newId) return

    refList.forEach(ref => {
      const component = instanceComponents[ref.index]
      if (!component) return

      const attrs = component.getAttributes()
      const currentValue = attrs[ref.attr]

      let newValue: string
      if (ref.isHash) {
        newValue = `#${newId}`
      } else if (typeof currentValue === 'string' && currentValue.includes(' ')) {
        // Handle space-separated list of IDs
        newValue = currentValue
          .split(/\s+/)
          .map(id => id === referencedId ? newId! : id)
          .join(' ')
      } else {
        newValue = newId!
      }

      // Temporarily add symbol override for attributes, then set attribute, then restore overrides
      const overrides = component.getSymbolOverride() || []
      const overridesArray = Array.isArray(overrides) ? overrides : []
      const hasAttrOverride = overridesArray.includes('attributes')
      if (!hasAttrOverride) component.setSymbolOverride([...overridesArray, 'attributes'])
      component.setAttributes({ [ref.attr]: newValue })
      if (!hasAttrOverride) component.setSymbolOverride(overrides)
    })
  })
}

```

### Core Architecture Module: `grapesjs-plugins/grapesjs-symbols/src/utils.ts`
```
import { Component, Editor, SymbolInfo } from 'grapesjs'

/**
 * Make sure we can drop a symbol instance
 */
export function allowDrop(editor: Editor, component: Component): boolean {
  if (!component) {
    throw new Error('No component provided to check drop permission.')
  }
  // Check if the component or one of its parents is a symbol instance
  let current: Component | undefined = component
  do {
    const info = editor.Components.getSymbolInfo(current)
    if (info?.isSymbol) {
      return false
    }
    current = current.parent()
  } while (current)
  // If no symbol instance is found, allow the drop
  return true
}

/**
 * Get all the symbols
 */
export function getSymbols(editor: Editor): Array<SymbolInfo> {
  return editor.Components.getSymbols().map(symbol => {
    return editor.Components.getSymbolInfo(symbol)
  })

  // const symbols = editor.Components.getSymbols()
  // return symbols.map(symbol => {
  //   const info = editor.Components.getSymbolInfo(symbol)
  //   return {
  //     symbol,
  //     info,
  //   }
  // })
}

/**
 * Get a symbol by its ID
 */
export function getSymbol(editor: Editor, component: Component): SymbolInfo | null {
  const info = editor.Components.getSymbolInfo(component)
  if (info?.isSymbol) {
    return info
  }
  return null
}

/**
 * Create a new symbol from a component
 */
export function createSymbol(editor: Editor, component: Component): SymbolInfo | null {
  if (!component) {
    throw new Error('No component provided to create a symbol.')
  }
  const symbol = editor.Components.addSymbol(component)
  if (symbol) {
    return editor.Components.getSymbolInfo(symbol)
  } else {
    throw new Error('Failed to create symbol from the provided component.')
  }
}

/**
 * Bind a symbol instance to a component
 */
export function unbindSymbolInstance(editor: Editor, component: Component) {
  const info = editor.Components.getSymbolInfo(component)
  if (info?.isInstance) {
    editor.Components.detachSymbol(component) // Detach instance from its symbol
  } else {
    throw new Error('Component is not a symbol instance.')
  }
}

/**
 * Delete a symbol instance and all its references
 * This will remove the main symbol but leave the instances
 */
export function deleteSymbol(editor: Editor, symbol: Component) {
  const symbolInfo = editor.Components.getSymbolInfo(symbol)
  if (!symbolInfo) {
    throw new Error(`Can not delete symbol: symbol info not found for ${symbol?.getId() || 'unknown'}`)
  }
  // Delete the symbol
  symbol?.remove()
}

```

### Core Architecture Module: `grapesjs-plugins/grapesjs-version-flow/src/upgrade-engine.js`
```
export default class UpgradeEngine {
  constructor(editor, options, versionManager, eventSystem) {
    this.editor = editor;
    this.options = options;
    this.versionManager = versionManager;
    this.eventSystem = eventSystem;
    this.isUpgrading = false;
    this.currentStep = null;
    this.allLogs = [];
    this.failedSteps = [];
  }

  async runUpgrades() {
    if (this.isUpgrading) {
      console.warn('[grapesjs-version-flow] Upgrade already in progress');
      return { success: false, logs: [], upgradedTo: this.options.builderVersion, error: 'Upgrade already in progress' };
    }

    const savedVersion = this.versionManager.getSavedVersion();
    const currentVersion = this.options.builderVersion;
    const pendingSteps = this.versionManager.getPendingUpgrades(savedVersion, currentVersion);

    if (pendingSteps.length === 0) {
      return { success: true, logs: [], upgradedTo: currentVersion };
    }

    this.isUpgrading = true;
    this.allLogs = [];
    this.failedSteps = [];
    let lastSuccessfulVersion = savedVersion;

    try {
      this.eventSystem.emit('version:upgrade:start', {
        pending: pendingSteps.map(step => step.builderVersion)
      });

      for (const step of pendingSteps) {
        this.currentStep = step;
        
        try {
          this.eventSystem.emit('version:versionUpgrade:start', {
            toVersion: step.builderVersion
          });

          let stepLogs;
          try {
            stepLogs = await this.runSingleUpgrade(step);
          } catch (upgradeError) {
            // Ensure any error from runSingleUpgrade is caught and handled
            console.error(`[grapesjs-version-flow] Upgrade error caught:`, upgradeError);
            throw upgradeError;
          }
          
          // Update version but don't save to storage yet
          this.versionManager.updateVersion(step.builderVersion);
          lastSuccessfulVersion = step.builderVersion;

          this.eventSystem.emit('version:versionUpgrade:end', {
            toVersion: step.builderVersion,
            log: stepLogs || []
          });

        } catch (error) {
          // Get log message from error or use default
          const logMessage = error.message || 'Unknown error occurred';
          
          const errorLog = {
            level: 'error',
            message: `Failed to upgrade to ${step.builderVersion}: ${logMessage}`
          };
          
          this.allLogs.push(errorLog);
          this.failedSteps.push(step.builderVersion);

          this.eventSystem.emit('version:upgrade:error', {
            toVersion: step.builderVersion,
            error: {
              message: logMessage,
              step: step.builderVersion
            }
          });

          // Emit the error log so UI can display it
          this.eventSystem.emit('version:versionUpgrade:end', {
            toVersion: step.builderVersion,
            log: [errorLog]
          });

          if (!this.options.continueOnError) {
            break;
          }
        }
      }

      const hasFailures = this.failedSteps.length > 0;
      
      // Always emit completion since we continue on error
      this.eventSystem.emit('version:upgrade:end', {
        upgradedTo: lastSuccessfulVersion,
        hasFailures: hasFailures
      });

      return {
        success: this.failedSteps.length === 0, // Success only if no steps failed
        logs: this.allLogs,
        upgradedTo: lastSuccessfulVersion,
        failedSteps: this.failedSteps
      };

    } catch (catastrophicError) {
      // Handle any catastrophic errors that weren't caught by individual step handling
      console.error('[grapesjs-version-flow] Catastrophic error during upgrade process:', catastrophicError);
      
      const errorLog = {
        level: 'error',
        message: `Catastrophic upgrade error: ${catastrophicError.message || 'Unknown error'}`
      };
      
      this.allLogs.push(errorLog);
      
      return {
        success: false,
        logs: this.allLogs,
        upgradedTo: lastSuccessfulVersion,
        failedSteps: this.failedSteps,
        error: catastrophicError.message || 'Catastrophic upgrade error'
      };
    } finally {
      this.isUpgrading = false;
      this.currentStep = null;
    }
  }

  async runSingleUpgrade(step) {
    const context = this.createUpgradeContext();
    
    // Run the upgrade function first and catch any errors
    let logMessage;
    try {
      logMessage = await step.upgrade(context);
    } catch (error) {
      // If upgrade function throws an error, handle it properly
      throw error;
    }
    
    // If upgrade was successful, use UndoManager.skip to prevent change tracking
    // This should not fail since upgrade already succeeded
    await this.editor.UndoManager.skip(async () => {
      // No actual work here, just marking this execution as non-trackable
      return Promise.resolve();
    });
    
    // Upgrade function should return a string log message
    const log = {
      level: 'info',
      message: logMessage || `Upgraded to ${step.builderVersion}`
    };
    
    this.allLogs.push(log);
    return [log];
  }

  async runWhatsNew() {
    const savedVersion = this.versionManager.getSavedVersion();
    const currentVersion = this.options.builderVersion;
    const whatsNewSteps = this.versionManager.getPendingWhatsNew(savedVersion, currentVersion);

    const context = this.createUpgradeContext();

    for (const step of whatsNewSteps) {
      try {
        if (typeof step.whatsNew === 'function') {
          await step.whatsNew(context);
        }
      } catch (error) {
        console.warn(`[grapesjs-version-flow] Error in whatsNew for ${step.builderVersion}:`, error);
      }
    }
  }

  createUpgradeContext() {
    return {
      editor: this.editor,
      getComponents: () => this.editor.getComponents(),
      getStyles: () => this.editor.getStyleManager().getAll(),
      getPages: () => this.editor.getPages ? this.editor.getPages().getAll() : [],
      getProjectData: () => this.editor.getProjectData(),
      setProjectData: (data) => this.editor.setProjectData(data),
      addLog: (level, message) => {
        const log = { level, message };
        this.allLogs.push(log);
        return log;
      }
    };
  }

  retryFromFailedStep() {
    if (!this.failedSteps.length) {
      return this.runUpgrades();
    }

    const lastFailedStep = this.failedSteps[this.failedSteps.length - 1];
    const savedVersion = this.versionManager.getSavedVersion();
    const currentVersion = this.options.builderVersion;
    const allSteps = this.versionManager.getPendingUpgrades(savedVersion, currentVersion);
    
    const failedStepIndex = allSteps.findIndex(step => step.builderVersion === lastFailedStep);
    if (failedStepIndex === -1) {
      return this.runUpgrades();
    }

    const remainingSteps = allSteps.slice(failedStepIndex);
    const originalSteps = this.options.versions;
    
    this.options.versions = remainingSteps;
    const result = this.runUpgrades();
    this.options.versions = originalSteps;
    
    return result;
  }

  getCurrentStep() {
    return this.currentStep;
  }

  isRunning() {
    return this.isUpgrading;
  }

  getAllLogs() {
    return [...this.allLogs];
  }

  getFailedSteps() {
    return [...this.failedSteps];
  }
}
```

### Core Architecture Module: `server/utils/BackwardCompat.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @fileoverview Handle backward compatibility when a user opens a site for edition
 *
 */

//import * as Path from 'path'
//import * as fs from 'fs'
//
//import { Constants } from '~/common/constants.js'
//import {
//  ElementData,
//  ElementState,
//  ElementType,
//  Link,
//  LinkType
//} from '../../client/element-store/types'
//import { PageData } from '../../client/page-store/types'
//import { PersistantData } from '../../client/store/types'
//import {
//  cleanupBefore,
//  getElementsFromDomBC,
//  getPagesFromDom,
//  getSiteFromDom,
//  writeSiteStyles,
//  writeStyles
//} from './BackwardCompatV2.5.60'
//import { getDomElement } from '../../client/element-store/dom'
//import { setTagName } from '../../client/utils/dom'
//import { writeDataToDom } from '../../client/store/dom'
//
///**
// * util function for the "fixes", @see fixes
// */
//function updateLinks<T extends { link?: Link }>(items: T[]): T[] {
//  return items
//    .map((item: T) => {
//      if(!!item.link && !item.link.linkType) {
//        // add new props
//        const link: any = {
//          ...item.link,
//          linkType: item.link.type as LinkType,
//          href: (item.link as any).value,
//        }
//        // remove old props
//        delete link.type
//        delete link.value
//        // return the updated element
//        return {
//          ...item,
//          link,
//        }
//      } else {
//        return item
//      }
//    })
//}
//
///**
// * class name for containers which are created with sections
// */
//const SECTION_CONTAINER = 'silex-container-content'
//
//export default class BackwardCompat {
//  private data: PersistantData = null
//  private frontEndVersion: string[]
//  private silexVersion: number[]
//
//  constructor(private rootUrl: string, rootPath = __dirname + '/../../../..') {
//    /**
//     * the version of the website is stored in the generator tag as "Silex v-X-Y-Z"
//     * we get it from package.json
//     * used for backward compat and for the static files URLs taken from //{{host}}/static/{{Y-Z}}
//     */
//    const packageJson = JSON.parse(fs.readFileSync(Path.resolve(rootPath, 'package.json')).toString())
//    this.frontEndVersion = packageJson['version:frontend'].split('.').map((s) => parseInt(s))
//    this.silexVersion = packageJson['version:backwardcompat'].split('.').map((s) => parseInt(s))
//
//    // const components = require('../../../dist/client/libs/prodotype/components/components.json')
//    console.log(`\nStarting. Version is ${this.silexVersion} for the websites and ${this.frontEndVersion} for Silex\n`)
//  }
//
//  // remove all tags
//  // export for tests
//  removeIfExist(doc: HTMLDocument, selector: string) {
//    Array.from(doc.querySelectorAll(selector))
//      .forEach((tag) => tag.remove())
//  }
//
//  // remove all useless css class
//  // export for tests
//  removeUselessCSSClass(doc: HTMLDocument, className: string) {
//    Array.from(doc.querySelectorAll('.' + className))
//      .forEach((el) => el.classList.remove(className))
//  }
//
//  getVersion(doc): number[] {
//    // if no generator tag, create one
//    let metaNode = doc.querySelector('meta[name="generator"]')
//    if (!metaNode) {
//      metaNode = doc.createElement('meta')
//      metaNode.setAttribute('name', 'generator')
//      doc.head.appendChild(metaNode)
//    }
//    // retrieve the website version from generator tag
//    return (metaNode.getAttribute('content') || '')
//      .replace('Silex v', '')
//      .split('.')
//      .map((str) => parseInt(str, 10) || 0)
//  }
//
//  hasDataFile(doc): boolean {
//    return !this.hasToUpdate(this.getVersion(doc), [2, 2, 11])
//  }
//
//  /**
//   * handle backward compatibility issues
//   * Backwardcompatibility process takes place after opening a file
//   * @param {Document} doc
//   * @return {Promise} a Promise, resolve can be called with a warning message
//   */
//  async update(doc: HTMLDocument, data: PersistantData): Promise<[string, PersistantData]> {
//    // // fix an issue when the style tag has no type, then json is "broken"
//    // const styleTag = doc.querySelector('.' + Constants.JSON_STYLE_TAG_CLASS_NAME);
//    // if (styleTag) { styleTag.type = 'text/json'; } // old versions of silex have no json at all so do nothing in that case
//    // TODO: move this to the data model (e.g. data.site.silexVersion)
//
//    // we need this.data as to2_2_11 will extract it and set it from the dom
//    this.data = data
//
//    const version = this.getVersion(doc)
//    const hasToUpdate = this.hasToUpdate(version, this.silexVersion)
//
//    // warn the user
//    if (this.amIObsolete(version, this.silexVersion)) {
//      return ['This website has been saved with a newer version of Silex. Continue at your own risks.', this.data]
//    } else if (this.hasToUpdate(version, [2, 2, 7])) {
//      return Promise.reject({
//        message: 'This website has been saved with an older version of Silex, which is not supported anymore as of March 2018. In order to convert it to a newer version, please go to <a href="https://old.silex.me">old.silex.me</a> to open and then save your website. <a href="https://github.com/silexlabs/Silex/wiki/Website-saved-with-older-version-of-Silex">More about this here</a>',
//      })
//    } else if (hasToUpdate) {
//      // convert to the latest version
//      const allActions = {
//        '2.2.8': await this.to2_2_8(version, doc),
//        '2.2.9': await this.to2_2_9(version, doc),
//        '2.2.10': await this.to2_2_10(version, doc),
//        '2.2.11': await this.to2_2_11(version, doc), // this will set this.data
//        '2.2.12': await this.to2_2_12(version, doc),
//        '2.2.13': await this.to2_2_13(version, doc),
//        '2.2.14': await this.to2_2_14(version, doc),
//      }
//      // update the static scripts to match the current server and latest version
//      this.updateStatic(doc)
//      // store the latest version
//      const metaNode = doc.querySelector('meta[name="generator"]')
//      metaNode.setAttribute('content', 'Silex v' + this.silexVersion.join('.'))
//      // apply all-time fixes
//      this.fixes(doc)
//      // build the report for the user
//      const report = Object.keys(allActions)
//        .filter((_version) => allActions[_version].length > 0)
//        .map((_version) => {
//          return `<p>Update to version ${ _version }:
//            <ul>${ allActions[_version].map((_action) => `<li class="no-list">${ _action }</li>`).join('') }</ul>
//        </p>`
//        }).join('')
//      // save data to dom for front-end.js and other scripts
//      // in case data has been changed
//      // FIXME: should not have this.data mutated but returned by update scripts
//      writeDataToDom(doc, this.data)
//      // needs to reload if silex scripts and stylesheets have been updated
//      return [`
//        <p>This website has been updated to Silex latest version.</p>
//        <p>Before you save it, please check that everything is fine. Saving it with another name could be a good idea too (menu file > save as).</p>
//        <details>
//          <summary>Details</summary>
//          <small>
//            ${ report }
//          </small>
//        </details>
//      `,
//      this.data,
//      ]
//    } else {
//      // update the static scripts to match the current server URL
//      this.updateStatic(doc)
//      // apply all-time fixes
//      this.fixes(doc)
//      // resolve immediately
//      return ['', this.data]
//    }
//  }
//
//  /**
//   * Check for common errors in editable html files
//   */
//  fixes(doc: HTMLDocument) {
//    // const pages: HTMLElement[] = Array.from(doc.querySelectorAll(`.${Constants.PAGES_CONTAINER_CLASS_NAME} a[${Constants.TYPE_ATTR}="page"]`));
//    // if (pages.length > 0) {
//    //   console.log('Fix error of wrong silex type for', pages.length, 'pages');
//    //   pages.forEach((page) => page.setAttribute(Constants.TYPE_ATTR, Constants.TYPE_PAGE));
//    // }
//
//    // the following is a fix following the beta version of 07-2020
//    // for elements and pages:
//    // link.value becomes href
//    // link.type becomes linkType
//    this.data = {
//      site: this.data.site,
//      pages: updateLinks<PageData>(this.data.pages),
//      elements: updateLinks<ElementData>(this.data.elements),
//    }
//    // remove juery-ui at publication, in case the website has been updated before the fix of 2.6.2
//    Array.from(doc.querySelectorAll('script[src$="pageable.js"], script[src$="jquery-ui.js"]'))
//      .forEach((tag) => tag.setAttribute(Constants.ATTR_REMOVE_PUBLISH, ''))
//    // this does not work because sections can not be smaller than their content:
//    // // resizable sections
//    // this.data = {
//    //   ...this.data,
//    //   elements: this.data.elements
//    //     .map((el) => el.type === ElementType.SECTION ? {
//    //       ...el,
//    //       enableResize: {
//    //         bottom: true,
//    //         top: true,
//    //         left: false,
//    //         right: false,
//    //       }
//    //     } : el),
//    // }
//
//    // remove pages which do not exist (was caused by
```

### Core Architecture Module: `server/utils/validation.ts`
```
/*
 * Silex website builder, free/libre no-code tool for makers.
 * Copyright (c) 2023 lexoyo and Silex Labs foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Throw an error if a parameter is missing
 * @param value the value to check
 * @param name the name of the parameter
 * @throws Error if the parameter is missing
 */
export function requiredParam<T>(value: T | undefined, name: string, defaultValue?: T): NonNullable<T> {
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue as NonNullable<T>
    }
    const error = new Error(`Missing required parameter ${name}`)
    console.error(`Missing required parameter ${name}`, error)
    throw error
  }
  return value as NonNullable<T>
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1868** (2026-10-05): **MCP tools return a success when nothing was done**
  *Symptoms*: These tools return a success when their target does not exist:  - `classes_remove`: class not on the element - `styles_remove`: property not set - `css-var_remove`, `css-var_rename`: unknown variable (and `css-var_rename` overwrites an existing `newName`) - `css-var_set`: the new `type` of an existing variable is ignored - `data-source_remove-state`: unknown `stateId` - `history_undo`, `history_redo`: nothing to undo or redo  Each one should return an error that says what to do, and gives the valid values when there are some, for example "Class "x" is not on the selected element. Its classes are: card, hero."  Also: `fonts_remove` says `Font "roboto" not installed` when `Roboto` is installed. The name is compared with the case (`grapesjs-fonts/src/commands.js`, line 93), while `fonts_install` ignores the case.
  **Post-Mortem & Fix Analysis**:
  > A useful contract here is to make “tool completed” and “requested postcondition” separate fields:  - For a mutating tool, return the selection/context, a normalized operation outcome, and a fresh postcondition snapshot. Suggested outcomes are `changed`, `no_op`, `rejected`, and `unknown`; protocol success should not mean that the requested state changed. - For removals, make an absent class/property/state an explicit, actionable rejection when the caller asked to remove it. Include the valid classes/properties/state IDs from the same fresh context, rather than accepting a stale target silently. - For `history_undo`/`history_redo`, return the history cursor/revision before and after plus `no_op` when no entry exists. That preserves idempotent inspection without telling an agent that an undo happened. - For add/move/delete/screenshot/publish-style actions, validate the authoritative postcondition after the command: selected element or page identity, document revision, saved artifact exis
  > Taking this.  Mutating MCP tools that currently report success on a no-op (`classes_remove`, `styles_remove`, `css-var_remove` / `_rename` / `_set` type, `data-source_remove-state`, `history_undo` / `_redo`) will throw an actionable error instead, including the valid current values when there are some (classes on the element, style keys, CSS variable names, state ids).  `fonts_remove` will match font family case-insensitively, same as `fonts_install`.  This does not address #1866 (wrong MCP names / selection id mismatch) — that stays a separate PR.
  > This issue is free again: the previous PR was withdrawn. Anyone can take it, just comment here first

- **Issue #1860** (2026-09-18): **MCP symbols_unlink fails with "missing param component"**
  *Symptoms*: Calling `symbols_unlink` returns an error: `Can not unlink the component: missing param component`. Seen on Silex Desktop built from `main` on 16 September 2026.  1. Open Silex Desktop and connect an AI agent to its MCP server. 2. Ask the agent to create a website, add a text and turn it into a symbol. 3. Ask the agent to unlink the symbol. The agent gets the error above.  The tool takes no parameter, but the command it runs expects a `component`. It should unlink the selected element. 

- **Issue #1855** (2026-09-27): **Opening a template fails when the user is connected to another GitLab instance**
  *Symptoms*: Reported by ceubri on the forum: https://community.silex.me/d/317  A user connected with the gitlab connector but from another instance than gitlab.com - e.g. framagit.org, cannot open any template. They get `Project not found: silex-templates/silex_devdocs-template`. The template does exist, but on gitlab.com, and Silex looks for it on framagit.org.  How to reproduce:  1. Open https://v3.silex.me/ and log in with framagit.org 2. Create a new website, click on "from a template" 3. Click "Open in Silex" on any template 4. You get `Project not found: silex-templates/silex_devdocs-template`  The same steps work when you log in with gitlab.com.  Why this happens:  - templates are always on gitlab.com, in a public repo - GitLab cannot fork a project of a different instance  How to fix it:  * GitLab connector should fork only if the user is logged in on gitlab.com * otherwise, create the project with `import_url`, the "Repository by URL" import of the GitLab API * the destination instance must have this import source enabled. It is on by default on gitlab.com, to be checked on framagit.org  FTP and the local storage will be covered separately in #1856. Templates never worked there at all.  

- **Issue #1850** (2026-09-11): **Text align "justified" writes an invalid CSS value**
  *Symptoms*: Thanks to Saumon for reporting this on the forum, and thanks to Brice (ceubri) for finding the cause.  Forum thread: https://community.silex.me/d/315-question-alignement-de-texte  ## What we want  Set a text to justified, with the Text align option in the Typography section.  ## What we get  An invalid CSS value: `text-align: justified`  The valid CSS value is `justify`. The browser ignores the invalid one, so the text stays aligned to the left. Left, center and right work fine, only "justified" is broken.  Workaround until this is fixed: open the gear icon on the left, go to the "Code" tab, and add your own CSS rule with `text-align: justify`  ## Also  The same kind of mistake can be somewhere else. Please look at the other style options too, in every section, and check that each one writes a valid CSS value.  ## How to test  1. Run the editor: `pnpm install` then `pnpm run dev`, and open http://localhost:6805 2. Add a text block with two long paragraphs 3. In the Typography section, set Text align to "justified" 4. Look at the generated CSS: it must be `text-align: justify` 5. Look at the page in the browser: the text must really be justified, with both edges aligned  Please test it yourself in a browser and add a screenshot in your pull request. It helps us review much faster. 
  **Post-Mortem & Fix Analysis**:
  > While looking at the style options, we saw three other things. They are not confirmed bugs, so please check each one before you change it:  - `text-decoration-line` offers `blink`. This value is deprecated and does nothing in modern browsers. It should probably be removed. - `text-align` has no `start` and `end` options. Both are valid CSS and they help with right to left languages. Adding them is optional, tell us what you think. - `scroll-snap-type` is a composite option with two parts named `scroll-snap-type-direction` and `scroll-snap-type-mode`. These two names are not real CSS properties. Please check in the browser what the editor really writes. It should be one rule like `scroll-snap-type: x mandatory` 

- **Issue #1845** (2026-09-27): **Removing an attribute does not remove it from the canvas**
  *Symptoms*: When you remove an attribute in the Attributes section of the element settings, the attribute stays on the element in the canvas. It only goes away after a reload.  Steps to reproduce, in Silex:  1. Select any element in the editor 2. Open the element settings and go to the Attributes section 3. Click "+" and add an attribute named `title` with the value `hello` 4. Remove that same attribute from the list  Then, in the browser developer tools:  5. Inspect the element inside the editor canvas 6. The attribute `title="hello"` is still on the element  Expected: the attribute is removed from the element in the canvas as soon as you remove it from the list.  Actual: the attribute stays until you reload the page. After a reload the website opens without the attribute, so the saved data is correct and only the canvas is out of date.  Tested on v3.silex.me and on canary.silex.me.  One more thing to check: the HTML content and Visibility condition fields are rendered the same way. Please check if they have the same problem.  @SparshM07 you have worked on the editor recently. Would you like to take this one? 
  **Post-Mortem & Fix Analysis**:
  > Sure lexoyo! I would love to work on this...but I'm currently working on my college project..So i would need 4-5 days time!! 
  > Hi lexoyo!! Now, I am going to work on this 
  > Excellent :) Let me know if I can help

- **Issue #1841** (2026-09-27): **Preview mode cannot be left with the keyboard**
  *Symptoms*: ### What happens  There is no way out of preview mode with the keyboard. Escape was pressed twice, nothing happened.  The only way out is the `gjs-off-prv` icon: 24 px, no label, in the very corner of the screen at (0,0). In the desktop app there is no browser tab to fall back on, so a user who does not find that icon is stuck in the preview.  ### Expected  Escape leaves the preview.  Found during the manual test session of #1837, 26 August 2026. 

- **Issue #1839** (2026-09-11): **Deleting a page asks nothing, and the trash icon is in the middle of the row**
  *Symptoms*: ### What happens  Clicking the trash icon in the Pages panel deletes the page at once. There is no confirmation, and there is no undo for it. A page was really lost this way while testing.  The icon is also in the middle of the row. Measured at the default panel width (147 px), across the height of a row:  | position in the row | what is there | |---|---| | 10 % | the page name, selects the page | | 25 % | the drag handle | | **50 %** | **the trash icon, deletes the page** | | 75 % and 90 % | the gear icon |  So the area that selects a page is about 15 % of the row, and the natural click "I want this page" lands on delete.  ### Where it is  `editor/grapesjs/page-panel.ts:275` wires the trash icon to `removePage()`.  A `removePageWithConfirm()` already exists in the same file, line 104, with an "Are you sure?" dialog and a Cancel button. It is only wired to the `cmdRemovePage` command, line 315. There are two ways to delete a page, only one asks, and it is not the one users click.  ### Expected  Deleting a page asks for confirmation, whichever way it is triggered. And the click target that selects a page is bigger than the one that destroys it.  Found during the manual test session of #1837, 26 August 2026. 

- **Issue #1824** (2026-08-19): **[Windows] Server crashes at startup loading .silex.js — ESM loader rejects C:\ paths (even when no config file exists)**
  *Symptoms*: Reported by @SparshM07 while testing #1807 on Windows (thank you!): the dev server crashes at startup while loading `server/deploy/.silex.js`, because Node's ESM loader rejects the Windows absolute path. This blocks every Windows contributor at their first server start.  ## Reproduction  On Windows, clone the repo, install, build, then start the server. It aborts with `ERR_UNSUPPORTED_ESM_URL_SCHEME` (protocol `c:`) while loading the default config file — whether or not a `.silex.js` file exists.  ## Root cause  - `server/config.ts` resolves the default config path to a Windows absolute path (`C:\...\server\deploy\.silex.js`) and always attempts to load it. - `common/silex-plugins/plugin.ts` (`getLocation`) runs the path through `new URL()`. On Windows this does not throw: the drive letter `C:` parses as a URL scheme, so the dynamic `import()` receives a `c:` protocol URL, which Node's ESM loader rejects (`Only URLs with a scheme in: file, data, node are supported`). - The catch in `loadSilexConfig()` only treats `MODULE_NOT_FOUND` as "no config file, continue" — the ESM error doesn't match, so it is fatal even when no config file exists.  ## Fix direction  - Convert filesystem paths to `file://` URLs with `pathToFileURL()` (from `node:url`) before the dynamic import. This belongs on the server side (`server/config.ts`, or a server-only branch in the plugin loader): `common/silex-plugins/plugin.ts` also runs in the browser, where the current URL handling is correct. - A missi
  **Post-Mortem & Fix Analysis**:
  > Hi, I’d like to work on a fix for this Windows ESM path issue. I’ll convert the server-side config paths to file: URLs and add regression tests.. ..Please let me know if there’s a preferred approach...
  > Great, thank you @SparshM07  I'll take a look soon 👍 

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

### Incident Patch 1: `2af9a32d` (2026-10-06)
**Commit Message**: fix: point the links to the documentation at its new addresses (#1905)

**File**: `.github/workflows/desktop.yml` (modified, +1/-1)
```diff
@@ -375,7 +375,7 @@ jobs:
           [ ${#LINUX[@]} -eq 0 ] && { echo "no Linux artifacts, skipping"; exit 0; }
           sha256sum "${LINUX[@]}" > SHA256SUMS
           INNER="$(find .. -name silex-desktop.sha256 | head -1)"
-          [ -n "$INNER" ] && echo "$(cat "$INNER")  silex-desktop [reproducible binary — see https://docs.silex.me/en/developer/desktop/verifying-releases/]" > SHA256SUMS.inner
+          [ -n "$INNER" ] && echo "$(cat "$INNER")  silex-desktop [reproducible binary — see https://docs.silex.me/developer/desktop/verifying-releases/]" > SHA256SUMS.inner
           echo "--- SHA256SUMS ---"; cat SHA256SUMS SHA256SUMS.inner 2>/dev/null
 
       # Version-less copies of each installer, so the download page can use permanent
```

**File**: `CONTRIBUTING.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Contributing to Silex
 
-Thanks for your interest in contributing to Silex! This guide covers code contributions. For other ways to help (templates, documentation, testing, tutorials, financial support), see the [full contribute page](https://docs.silex.me/en/designer/contribute/).
+Thanks for your interest in contributing to Silex! This guide covers code contributions. For other ways to help (templates, documentation, testing, tutorials, financial support), see the [full contribute page](https://docs.silex.me/designer/contribute/).
 
 ## Discuss before coding
 
@@ -126,7 +126,7 @@ A maintenance branch (e.g. `v3-maintenance`) is created on demand only when an o
 
 ## Extending Silex with plugins
 
-If your change can work as a plugin rather than a core modification, that's preferred. See [Creating plugins](https://docs.silex.me/en/developer/plugins/creating/) for how to build and publish Silex plugins.
+If your change can work as a plugin rather than a core modification, that's preferred. See [Creating plugins](https://docs.silex.me/developer/plugins/creating/) for how to build and publish Silex plugins.
 
 ## Getting help
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ owes just as much to people whose work lives elsewhere: see [THANKS.md](THANKS.m
 - [Official website](https://www.silex.me/)
 - [Manifesto](https://www.silex.me/manifesto/) — our values and commitments
 - [User documentation](https://docs.silex.me/)
-- [Developer documentation](https://docs.silex.me/en/dev)
+- [Developer documentation](https://docs.silex.me/developer/self-hosting/overview/)
 - [Road map](https://roadmap.silex.me) — help define tasks and priorities
 - [Community forums](https://community.silex.me)
 - [Newsletter (EN)](https://short.silex.me/news_en) | [(FR)](https://short.silex.me/news_fr)
```

**File**: `common/constants.ts` (modified, +2/-2)
```diff
@@ -79,8 +79,8 @@ __________________________________________________________
 
   Users are expected to contribute:
 
-  * Web designers: https://docs.silex.me/en/user/contribute
-  * Developers: https://docs.silex.me/en/dev/contribute
+  * Web designers: https://docs.silex.me/designer/contribute/
+  * Developers: https://docs.silex.me/developer/plugins/creating/
 
 __________________________________________________________
 `
```

**File**: `desktop/dashboard/src/components/AppSidebar.vue` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ const home = computed(() => localized({ en: 'https://www.silex.me/', fr: 'https:
 const forum = { en: 'https://short.silex.me/community_en', fr: 'https://short.silex.me/community_fr' }
 
 const links = computed(() => [
-  { text: t('Documentation'), href: localized({ en: 'https://short.silex.me/docs', fr: 'https://docs.silex.me/fr/home' }) },
+  { text: t('Documentation'), href: localized({ en: 'https://short.silex.me/docs', fr: 'https://docs.silex.me/fr/' }) },
   { text: t('Videos'), href: localized({ en: 'https://short.silex.me/video_en', fr: 'https://short.silex.me/video_fr' }) },
   { text: t('Forum'), href: localized(forum) },
   { text: t('Roadmap'), href: 'https://short.silex.me/roadmap' },
```

**File**: `editor/grapesjs/PublicationUi.ts` (modified, +3/-3)
```diff
@@ -254,7 +254,7 @@ export class PublicationUi {
           @click=${() => this.editor.Commands.run(cmdPublicationLogin, this.settings.connector)}
         >Connect</button>
       `: nothing}
-      <a href="https://docs.silex.me/en/user/publish" target="_blank">Help</a>
+      <a href="https://docs.silex.me/designer/publishing/overview/" target="_blank">Help</a>
       <button
         class="silex-button silex-button--secondary"
         id="publish-button--secondary"
@@ -298,7 +298,7 @@ export class PublicationUi {
         </div>
       </main>
       <footer>
-        <a href="https://docs.silex.me/en/user/publish" target="_blank">Help</a>
+        <a href="https://docs.silex.me/designer/publishing/overview/" target="_blank">Help</a>
         <button
           class="silex-button silex-button--secondary"
           id="publish-button--secondary"
@@ -317,7 +317,7 @@ export class PublicationUi {
         <p>Something went wrong: ${err.message}</p>
       </main>
       <footer>
-        <a href="https://docs.silex.me/en/user/publish" target="_blank">Help</a>
+        <a href="https://docs.silex.me/designer/publishing/overview/" target="_blank">Help</a>
         <button
           class="silex-button silex-button--secondary"
           id="publish-button--secondary"
```

**File**: `editor/grapesjs/cms/page-settings.ts` (modified, +4/-4)
```diff
@@ -214,9 +214,9 @@ function renderSettingsSection(settings: Silex11tyPluginWebsiteSettings, editor:
         <p>Tip: Click the “?” icons to view inline help about pagination, expressions, and permalinks.</p>
         <p>Related links to the docs:
         <ul>
-          <li><a target="_blank" href="https://docs.silex.me/en/user/cms-concepts">documentation about Silex CMS concepts</a></li>
-          <li><a href="https://docs.silex.me/en/user/cms-concepts#expressions" target="_blank">Expressions</a></li>
-          <li><a href="https://docs.silex.me/en/user/cms-collection-pages" target="_blank">Collection pages</a></li>
+          <li><a target="_blank" href="https://docs.silex.me/designer/cms/overview/">documentation about Silex CMS concepts</a></li>
+          <li><a href="https://docs.silex.me/designer/cms/expressions/" target="_blank">Expressions</a></li>
+          <li><a href="https://docs.silex.me/designer/cms/collection-pages/" target="_blank">Collection pages</a></li>
           <li><a href="https://www.11ty.dev/docs/pagination/" target="_blank">11ty pagination</a></li>
         </ul>
         </p>
@@ -278,7 +278,7 @@ function renderSettingsSection(settings: Silex11tyPluginWebsiteSettings, editor:
                       <li>For collection pages, this is evaluated for each generated page.</li>
                     </ul>
                     <ul>
-                      <li><a href="https://docs.silex.me/en/user/cms-concepts#permalink" target="_blank">Permalinks in Silex</a></li>
+                      <li><a href="https://docs.silex.me/designer/cms/collection-pages/#permalink-structure" target="_blank">Permalinks in Silex</a></li>
                       <li><a href="https://www.11ty.dev/docs/pagination/#permalink" target="_blank">11ty permalink docs</a></li>
                     </ul>
                   </div>
```

**File**: `grapesjs-plugins/grapesjs-advanced-selector/README.md` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-[![Documentation](https://img.shields.io/badge/docs-selector%20guide-blue?style=flat-square)](https://docs.silex.me/en/user/selectors#valid-selectors-guide)
+[![Documentation](https://img.shields.io/badge/docs-selector%20guide-blue?style=flat-square)](https://docs.silex.me/designer/styling/selectors/)
 
 # GrapesJS Advanced Selector Manager
 
@@ -102,7 +102,7 @@ Customize the plugin’s behavior by passing options:
 |-------------|----------------------------------------|------------------|
 | `i18n`      | Internationalization object see the files in `src/i18n` | The content of `src/i18n/en.ts` |
 | `helpLinks` | Links to help resources                | `{}`             |
-| `helpLinks.actionBar` | Link to help resources for the action bar | `https://docs.silex.me/en/user/selectors` |
+| `helpLinks.actionBar` | Link to help resources for the action bar | `https://docs.silex.me/designer/styling/selectors/` |
 
 ---
 
```

---

### Incident Patch 2: `948150e1` (2026-10-05)
**Commit Message**: feat(desktop): tell the Linux distribution and desktop in error reports (#1904)

**File**: `desktop/src-tauri/src/main.rs` (modified, +46/-0)
```diff
@@ -564,6 +564,38 @@ fn without_home(text: &str) -> String {
     }
 }
 
+/// The Linux distribution, in the fields Sentry defines for it, read where its
+/// Python SDK reads them: a bug can hang on the libraries of one distribution
+fn distribution() -> &'static [(&'static str, String)] {
+    static RELEASE: std::sync::OnceLock<Vec<(&'static str, String)>> = std::sync::OnceLock::new();
+    RELEASE.get_or_init(|| {
+        let text = std::fs::read_to_string("/etc/os-release")
+            .or_else(|_| std::fs::read_to_string("/usr/lib/os-release"))
+            .unwrap_or_default();
+        [
+            ("ID", "distribution_name"),
+            ("VERSION_ID", "distribution_version"),
+            ("PRETTY_NAME", "distribution_pretty_name"),
+        ]
+        .into_iter()
+        .filter_map(|(key, field)| {
+            text.lines()
+                .find_map(|line| line.strip_prefix(key)?.strip_prefix('='))
+                .map(|value| (field, value.trim_matches('"').to_string()))
+        })
+        .collect()
+    })
+}
+
+/// Sentry itself only says "Linux" and the kernel
+fn with_distribution(event: &mut sentry::protocol::Event<'static>) {
+    if let Some(sentry::protocol::Context::Os(os)) = event.contexts.get_mut("os") {
+        for (field, value) in distribution() {
+            os.other.insert(field.to_string(), value.clone().into());
+        }
+    }
+}
+
 /// The query of an API call carries what the user typed to publish
 fn without_query(request: &sentry::protocol::Request) -> sentry::protocol::Request {
     let mut url = request.url.clone();
@@ -850,6 +882,7 @@ fn main() {
             for exception in event.exception.values.iter_mut() {
                 exception.value = exception.value.as_deref().map(without_home);
             }
+            with_distribution(&mut event);
             Some(event)
         })
         .before_breadcrumb(|mut breadcrumb| {
@@ -871,6 +904,19 @@ fn main() {
         if let Ok(webview) = tauri::webview_version() {
             scope.set_tag("webview", webview);
         }
+        // GlitchTip drops the distribution fields of the os context
+        let release: Vec<&str> = distribution()
+            .iter()
+            .filter(|(field, _)| *field != "distribution_pretty_name")
+            .map(|(_, value)| value.as_str())
+            .collect();
+        if !release.is_empty() {
+            scope.set_tag("distro", release.join(" "));
+        }
+        // Opening a folder or a browser goes through the desktop on Linux
+        if let Ok(desktop) = std::env::var("XDG_CURRENT_DESKTOP") {
+            scope.set_tag("desktop", desktop);
+        }
         // Anonymous install id → distinguishes distinct installs from repeat crashes.
         scope.set_user(Some(sentry::protocol::User {
             id: Some(install_id.clone()),
```

---

### Incident Patch 3: `7c9a9824` (2026-10-05)
**Commit Message**: fix(desktop): keep the whole AppImage environment away from the programs Silex runs (#1903)

**File**: `desktop/src-tauri/src/integrations/common/run.rs` (modified, +21/-15)
```diff
@@ -122,22 +122,28 @@ pub fn failure(program: &Path, ran: &Ran) -> String {
     )
 }
 
-/// The AppImage puts the libraries it carries for Silex in front of
-/// LD_LIBRARY_PATH, and the git, ssh and curl of the system would load those
-/// instead of their own
-fn without_appimage_libraries(command: &mut Command) {
-    let (Some(appdir), Some(paths)) = (env::var_os("APPDIR"), env::var_os("LD_LIBRARY_PATH"))
-    else {
+/// The AppImage points LD_LIBRARY_PATH, PYTHONHOME, PATH and others at what
+/// it carries for Silex, and the git, ssh, python or perl of the system would
+/// load that instead of their own
+fn without_appimage_environment(command: &mut Command) {
+    let Some(appdir) = env::var_os("APPDIR") else {
         return;
     };
-    let users: Vec<PathBuf> = env::split_paths(&paths)
-        // An empty entry is the working directory, here the website folder
-        .filter(|path| !path.as_os_str().is_empty() && !path.starts_with(&appdir))
-        .collect();
-    command.env_remove("LD_LIBRARY_PATH");
-    if let Ok(paths) = env::join_paths(&users) {
-        if !users.is_empty() {
-            command.env("LD_LIBRARY_PATH", paths);
+    // An AppImage started from here would take them for its own
+    command.env_remove("APPDIR").env_remove("APPIMAGE");
+    for (name, value) in env::vars_os() {
+        let paths: Vec<PathBuf> = env::split_paths(&value).collect();
+        if !paths.iter().any(|path| path.starts_with(&appdir)) {
+            continue;
+        }
+        let users: Vec<PathBuf> = paths
+            .into_iter()
+            // An empty entry is the working directory, here the website folder
+            .filter(|path| !path.as_os_str().is_empty() && !path.starts_with(&appdir))
+            .collect();
+        command.env_remove(&name);
+        if let (false, Ok(value)) = (users.is_empty(), env::join_paths(&users)) {
+            command.env(&name, value);
         }
     }
 }
@@ -174,7 +180,7 @@ fn run_within(
         // reads what they say
         .env("LC_ALL", "C");
 
-    without_appimage_libraries(&mut command);
+    without_appimage_environment(&mut command);
 
     // A killed program takes with it whatever it started: git leaves an ssh
     // behind, and that ssh holds the connection and the pipes
```

---

### Incident Patch 4: `9823ded4` (2026-10-05)
**Commit Message**: fix(desktop): keep the AppImage libraries away from git and ssh (#1901)

**File**: `desktop/src-tauri/src/integrations/common/run.rs` (modified, +24/-1)
```diff
@@ -13,8 +13,9 @@
 //! directory, no way for it to ask the user anything, a time limit, a bounded
 //! amount of output kept, and no secret in what comes back.
 
+use std::env;
 use std::io::Read;
-use std::path::Path;
+use std::path::{Path, PathBuf};
 use std::process::{Child, Command, Stdio};
 use std::sync::mpsc::{self, Receiver};
 use std::sync::{Arc, Mutex};
@@ -110,6 +111,26 @@ pub fn failure(program: &Path, ran: &Ran) -> String {
     )
 }
 
+/// The AppImage puts the libraries it carries for Silex in front of
+/// LD_LIBRARY_PATH, and the git, ssh and curl of the system would load those
+/// instead of their own
+fn without_appimage_libraries(command: &mut Command) {
+    let (Some(appdir), Some(paths)) = (env::var_os("APPDIR"), env::var_os("LD_LIBRARY_PATH"))
+    else {
+        return;
+    };
+    let users: Vec<PathBuf> = env::split_paths(&paths)
+        // An empty entry is the working directory, here the website folder
+        .filter(|path| !path.as_os_str().is_empty() && !path.starts_with(&appdir))
+        .collect();
+    command.env_remove("LD_LIBRARY_PATH");
+    if let Ok(paths) = env::join_paths(&users) {
+        if !users.is_empty() {
+            command.env("LD_LIBRARY_PATH", paths);
+        }
+    }
+}
+
 fn run_within(program: &Path, dir: &Path, args: &[&str], timeout: Duration) -> Result<Ran, String> {
     let mut command = Command::new(program);
     command
@@ -132,6 +153,8 @@ fn run_within(program: &Path, dir: &Path, args: &[&str], timeout: Duration) -> R
         // reads what they say
         .env("LC_ALL", "C");
 
+    without_appimage_libraries(&mut command);
+
     // A killed program takes with it whatever it started: git leaves an ssh
     // behind, and that ssh holds the connection and the pipes
     #[cfg(unix)]
```

---

### Incident Patch 5: `59c667a9` (2026-10-05)
**Commit Message**: fix(mcp): error on no-op remove/undo/redo, case-insensitive fonts_remove (#1896)

* fix(mcp): error on no-op remove/undo/redo, case-insensitive fonts_remove

* refactor(css-var): extract requireVariable helper for remove/rename

**File**: `editor/grapesjs/core-commands.ts` (modified, +9/-1)
```diff
@@ -114,11 +114,17 @@ export default (editor: Editor) => {
     if (!name) throw new Error('Required: name (CSS class name, e.g. "my-card", "container"). Use classes:list to see existing classes.')
     selected.addClass(name)
   })
-  editor.Commands.add('classes:remove', (_ed, _sender, options: any = {}) => {
+  editor.Commands.add('classes:remove', (_ed, _sender, options: { name?: string } = {}) => {
     const selected = editor.getSelected()
     if (!selected) throw new Error('No component selected. Use components:select first.')
     const { name } = options
     if (!name) throw new Error('Required: name (CSS class name). Use classes:list to see classes on the selected component.')
+    const classes: string[] = selected.getClasses()
+    if (!classes.includes(name)) {
+      throw new Error(classes.length
+        ? `Class "${name}" is not on the selected element. Its classes are: ${classes.join(', ')}.`
+        : `Class "${name}" is not on the selected element. It has no classes.`)
+    }
     selected.removeClass(name)
   })
 
@@ -142,9 +148,11 @@ export default (editor: Editor) => {
 
   // History
   editor.Commands.add('history:undo', () => {
+    if (!editor.UndoManager.hasUndo()) throw new Error('Nothing to undo.')
     editor.UndoManager.undo()
   })
   editor.Commands.add('history:redo', () => {
+    if (!editor.UndoManager.hasRedo()) throw new Error('Nothing to redo.')
     editor.UndoManager.redo()
   })
 
```

**File**: `grapesjs-plugins/grapesjs-advanced-selector/src/commands.ts` (modified, +7/-0)
```diff
@@ -99,6 +99,13 @@ export default function registerCommands(editor: Editor) {
       const { property } = cmdOpts
       if (!property) throw new Error('Required: property (CSS property name, e.g. "color", "font-size", "margin")')
       const style = rule.getStyle()
+      if (!Object.prototype.hasOwnProperty.call(style, property)) {
+        const set = Object.keys(style)
+        const selector = rule.selectorsToString?.() ?? ''
+        throw new Error(set.length
+          ? `Property "${property}" is not set on "${selector}". Set properties are: ${set.join(', ')}.`
+          : `Property "${property}" is not set on "${selector}". It has no properties set.`)
+      }
       delete style[property]
       rule.setStyle(style)
     },
```

**File**: `grapesjs-plugins/grapesjs-css-variables/src/capabilities.js` (modified, +30/-2)
```diff
@@ -24,6 +24,22 @@ export const cmdSetVar = 'css-var:set'
 export const cmdRemoveVar = 'css-var:remove'
 export const cmdRenameVar = 'css-var:rename'
 
+/** Names of all defined CSS variables, in order. */
+function getVariableNames(editor) {
+  return getAllVariablesOrdered(editor).map(v => v.name)
+}
+
+/** Throw an actionable error unless `name` is a defined variable. */
+function requireVariable(editor, name, label = 'Variable') {
+  const names = getVariableNames(editor)
+  if (!names.includes(name)) {
+    throw new Error(names.length
+      ? `${label} "${name}" not found. Existing variables: ${names.join(', ')}.`
+      : `${label} "${name}" not found. No variables defined.`)
+  }
+  return names
+}
+
 export function registerCommands(editor) {
   editor.Commands.add(cmdListVars, {
     run() {
@@ -41,10 +57,14 @@ export function registerCommands(editor) {
       if (!canonical) {
         throw new Error(`Invalid type "${type}". Must be one of: color, size, typo (aliases: font, font-family, typography)`)
       }
+      const order = editor.getModel().get('cssVarOrder') || []
+      const existing = order.find(o => o.name === name)
+      if (existing && existing.type !== canonical) {
+        throw new Error(`Variable "${name}" already exists with type "${existing.type}", not "${canonical}". Remove it first or reuse its type.`)
+      }
       setVariable(editor, { name, value })
       // Track type in cssVarOrder
-      const order = editor.getModel().get('cssVarOrder') || []
-      if (!order.some(o => o.name === name)) {
+      if (!existing) {
         order.push({ type: canonical, name })
         editor.getModel().set('cssVarOrder', [...order])
       }
@@ -57,6 +77,7 @@ export function registerCommands(editor) {
       if (!name) {
         throw new Error('Required: name. Example: {name: "primary"}. Use css-var:list to see existing variables.')
       }
+      requireVariable(editor, name)
       removeVariable(editor, { name })
       // Remove from cssVarOrder
       const order = editor.getModel().get('cssVarOrder') || []
@@ -71,6 +92,13 @@ export function registerCommands(editor) {
       if (!oldName || !newName) {
         throw new Error('Required: oldName, newName. Example: {oldName: "primary", newName: "brand"}. Use css-var:list to see existing variables.')
       }
+      const names = requireVariable(editor, oldName)
+      if (oldName === newName) {
+        throw new Error(`Variable "${oldName}" already has that name.`)
+      }
+      if (names.includes(newName)) {
+        throw new Error(`Variable "${newName}" already exists. Choose a different name. Existing variables: ${names.join(', ')}.`)
+      }
       renameVariable(editor, { oldName, newName })
     },
   })
```

**File**: `grapesjs-plugins/grapesjs-data-source/src/commands.ts` (modified, +7/-1)
```diff
@@ -253,14 +253,20 @@ export default (editor: Editor, opts: DataSourceEditorOptions) => {
 
   // Remove a state from the selected component
   editor.Commands.add(CMD_DS_REMOVE_STATE, {
-    run(editor: Editor, sender: any, options: any = {}) {
+    run(editor: Editor, sender: unknown, options: { component?: Component; stateId?: string; exported?: boolean } = {}) {
       const component = options.component || editor.getSelected()
       if (!component) throw new Error('No component selected. Use components:select first.')
 
       const { stateId, exported } = options
       if (!stateId) throw new Error('Required: stateId (e.g. "innerHTML", "src", "href"). Use data-source:get-states to list existing states.')
 
       const isExported = exported !== false
+      if (!getState(component, stateId, isExported)) {
+        const ids = getStateIds(component, isExported)
+        throw new Error(ids.length
+          ? `State "${stateId}" not found on the selected component. Existing states: ${ids.join(', ')}.`
+          : `State "${stateId}" not found on the selected component. It has no states.`)
+      }
       removeState(component, stateId, isExported)
 
       if (isPreviewActive) forceRender(editor)
```

**File**: `grapesjs-plugins/grapesjs-fonts/src/commands.js` (modified, +7/-2)
```diff
@@ -90,8 +90,13 @@ export default function (editor, opts) {
     if (!family) throw new Error('Required: family (e.g. "Roboto"). Use fonts:installed to list installed fonts.')
 
     const fonts = editor.getModel().get('fonts') || []
-    const idx = fonts.findIndex(f => f.family === family)
-    if (idx === -1) throw new Error(`Font "${family}" not installed. Use fonts:installed to list installed fonts.`)
+    const idx = fonts.findIndex(f => f.family.toLowerCase() === family.toLowerCase())
+    if (idx === -1) {
+      const installed = fonts.map(f => f.family)
+      throw new Error(installed.length
+        ? `Font "${family}" not installed. Installed fonts: ${installed.join(', ')}.`
+        : `Font "${family}" not installed. No fonts installed.`)
+    }
 
     fonts.splice(idx, 1)
     editor.getModel().set('fonts', [...fonts])
```

---

### Incident Patch 6: `cb6e36ee` (2026-10-04)
**Commit Message**: fix(editor): select container and eleventy blocks on drop (#1900)

**File**: `editor/grapesjs/blocks.ts` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ export const blocksPlugin = (editor, opts) => {
   editor.BlockManager.add(containerId, {
     label: 'Container',
     category: 'Basics',
+    select: true,
     attributes: { class: 'container-png' },
     content: {
       type: containerId,
```

**File**: `editor/grapesjs/cms/blocks.ts` (modified, +3/-0)
```diff
@@ -7,6 +7,7 @@ export default function(editor: Editor/*, opts: EleventyPluginOptions*/): void {
   editor.BlockManager.add('eleventy-shortcode', {
     label: 'Shortcode',
     category: 'Eleventy',
+    select: true,
     content: { type: 'eleventy-shortcode' },
     media: '<span style="font-size: 50px;">{%</span>',
   })
@@ -79,6 +80,7 @@ export default function(editor: Editor/*, opts: EleventyPluginOptions*/): void {
   editor.BlockManager.add('eleventy-select', {
     label: 'select',
     category: 'Eleventy',
+    select: true,
     media: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M22 9c0-.6-.5-1-1.3-1H3.4C2.5 8 2 8.4 2 9v6c0 .6.5 1 1.3 1h17.4c.8 0 1.3-.4 1.3-1V9zm-1 6H3V9h18v6z"></path><path d="M18.5 13l1.5-2h-3zM4 11.5h11v1H4z"></path></svg>',
     content: { type: 'eleventy-select' },
   })
@@ -101,6 +103,7 @@ export default function(editor: Editor/*, opts: EleventyPluginOptions*/): void {
   editor.BlockManager.add('eleventy-option', {
     label: 'option',
     category: 'Eleventy',
+    select: true,
     media: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>',
     content: { type: 'eleventy-option' },
   })
```

---

### Incident Patch 7: `7dc22ccc` (2026-10-01)
**Commit Message**: feat(editor): add revert to the Display options (#1894)

* feat(editor): add revert to the Display options

The Display select offered inherit, initial and unset but not revert.
display: revert lets the browser hide a popover menu while it is closed
and show it when it is open, which initial and unset do not.

Closes #1892

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* test: remove tests that do not cover the change

The first one only read back the option list, the second one passed
with any value.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `editor/grapesjs/css-props.ts` (modified, +1/-0)
```diff
@@ -85,6 +85,7 @@ export default (editor: Editor, opts) => {
         { id: 'none', value: 'none', name: 'none' },
         { id: 'inherit', value: 'inherit', name: 'inherit' },
         { id: 'initial', value: 'initial', name: 'initial' },
+        { id: 'revert', value: 'revert', name: 'revert' },
         { id: 'unset', value: 'unset', name: 'unset' },
       ],
       info: '',
```

---

### Incident Patch 8: `95018d37` (2026-09-30)
**Commit Message**: fix(server): keep file paths inside the storage folder (#1882)

**File**: `server/connectors/FsHosting.ts` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@
 import fs from 'fs/promises'
 import { ConnectorFile, StorageConnector, HostingConnector, StatusCallback, ConnectorSession, contentToString, toConnectorData, ConnectorFileContent} from './connectors.js'
 import { join } from 'path'
-import { FsStorage } from './FsStorage.js'
+import { FsStorage, underPath } from './FsStorage.js'
 import { ConnectorType, JobData, JobStatus, PublicationJobData, WebsiteId } from '~/common/types.js'
 import { JobManager } from '../jobs.js'
 
@@ -59,7 +59,7 @@ export class FsHosting extends FsStorage implements HostingConnector<FsSession>
   }
 
   async getUrl(session: FsSession, id: WebsiteId): Promise<string> {
-    const filePath = join(this.options.path, id, 'index.html')
+    const filePath = underPath(this.options.path, id, 'index.html')
     const fileUrl = new URL(filePath, 'file://')
     return fileUrl.toString()
   }
```

**File**: `server/connectors/FsStorage.test.ts` (modified, +28/-0)
```diff
@@ -53,3 +53,31 @@ describe('FsStorage website', () => {
     expect(parsed).toEqual(EMPTY_WEBSITE)
   })
 })
+
+describe('FsStorage path confinement', () => {
+  function connector() {
+    return new FsStorage({} as ServerConfig, {
+      path: storageRootPath,
+      assetsFolder,
+    })
+  }
+
+  it('should read an asset of the website', async () => {
+    const storage = connector()
+    const id = await storage.createWebsite(dummySession, { name: 'dummy name', connectorUserSettings: {} })
+    await storage.writeAssets(dummySession, id, [{ path: '/asset.txt', content: 'hello' }])
+    const content = await storage.readAsset(dummySession, id, 'asset.txt')
+    expect(content.toString()).toBe('hello')
+  })
+
+  it('should refuse an asset name which leads out of the website', async () => {
+    const storage = connector()
+    const id = await storage.createWebsite(dummySession, { name: 'dummy name', connectorUserSettings: {} })
+    await expect(storage.readAsset(dummySession, id, '../../../../etc/hostname')).rejects.toThrow()
+    await expect(storage.writeAssets(dummySession, id, [{ path: '/../../../pwned.txt', content: 'pwned' }])).rejects.toThrow()
+  })
+
+  it('should refuse a website id which leads out of the storage folder', async () => {
+    await expect(connector().updateWebsite(dummySession, '../../evil', dummyWebsite as any)).rejects.toThrow()
+  })
+})
```

**File**: `server/connectors/FsStorage.ts` (modified, +28/-17)
```diff
@@ -18,8 +18,8 @@
 import fs from 'fs/promises'
 import { createWriteStream } from 'fs'
 import { ConnectorFile, StorageConnector, StatusCallback, ConnectorSession, toConnectorData, ConnectorFileContent} from './connectors.js'
-import { dirname, join } from 'path'
-import { ConnectorUser, WebsiteMeta, JobStatus, WebsiteId, ConnectorType, WebsiteMetaFileContent, WebsiteData, EMPTY_WEBSITE, ConnectorOptions } from '~/common/types.js'
+import { dirname, join, resolve, sep } from 'path'
+import { ApiError, ConnectorUser, WebsiteMeta, JobStatus, WebsiteId, ConnectorType, WebsiteMetaFileContent, WebsiteData, EMPTY_WEBSITE, ConnectorOptions } from '~/common/types.js'
 import { userInfo } from 'os'
 import { requiredParam } from '../utils/validation.js'
 import { ServerConfig } from '../config.js'
@@ -52,6 +52,17 @@ async function copyDir(src, dest) {
 }
 
 
+// Website ids, page paths and asset names come from the client, and the file
+// may not exist yet, so `..` is resolved on the path itself, not on the disk
+export function underPath(root: string, ...parts: string[]): string {
+  const rootPath = resolve(root)
+  const path = resolve(join(rootPath, ...parts))
+  if (path !== rootPath && !path.startsWith(rootPath + sep)) {
+    throw new ApiError('Invalid path: it leads out of the storage folder', 400)
+  }
+  return path
+}
+
 type FsSession = ConnectorSession
 
 const USER_ICON = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' height=\'1em\' viewBox=\'0 0 448 512\'%3E%3Cpath d=\'M304 128a80 80 0 1 0 -160 0 80 80 0 1 0 160 0zM96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM49.3 464H398.7c-8.9-63.3-63.3-112-129-112H178.3c-65.7 0-120.1 48.7-129 112zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3z\'/%3E%3C/svg%3E'
@@ -147,15 +158,15 @@ export class FsStorage implements StorageConnector<FsSession> {
   async setWebsiteMeta(session: any, id: string, data: WebsiteMetaFileContent): Promise<void> {
     const websiteId = requiredParam<WebsiteId>(id, 'website id')
     const content = stringify(data)
-    const path = join(this.options.path, id, WEBSITE_META_DATA_FILE)
+    const path = underPath(this.options.path, id, WEBSITE_META_DATA_FILE)
     await fs.writeFile(path, content)
   }
 
   async getWebsiteMeta(session: FsSession, id: WebsiteId): Promise<WebsiteMeta> {
     const websiteId = requiredParam<WebsiteId>(id, 'website id')
     // Get stats for website folder
-    const fileStat = await fs.stat(join(this.options.path, websiteId))
-    const path = join(this.options.path, websiteId, WEBSITE_META_DATA_FILE)
+    const fileStat = await fs.stat(underPath(this.options.path, websiteId))
+    const path = underPath(this.options.path, websiteId, WEBSITE_META_DATA_FILE)
     // Get meta file
     const content = await fs.readFile(path)
     const meta = await JSON.parse(content.toString())
@@ -183,7 +194,7 @@ export class FsStorage implements StorageConnector<FsSession> {
 
   async readWebsite(session: FsSession, websiteId: WebsiteId): Promise<WebsiteData> {
     const id = requiredParam<WebsiteId>(websiteId, 'website id')
-    const path = join(this.options.path, id, WEBSITE_DATA_FILE)
+    const path = underPath(this.options.path, id, WEBSITE_DATA_FILE)
 
     const content = await fs.readFile(path)
     const websiteDataContent = content.toString()
@@ -192,7 +203,7 @@ export class FsStorage implements StorageConnector<FsSession> {
     const parsedData = JSON.parse(websiteDataContent)
     // Use the merge function to reconstruct website data
     const pageLoader = async (pagePath: string): Promise<string> => {
-      const fullPath = join(this.options.path, id, pagePath)
+      const fullPath = underPath(this.options.path, id, pagePath)
       const pageContent = await fs.readFile(fullPath)
       return pageContent.toString()
     }
@@ -202,7 +213,7 @@ export class FsStorage implements StorageConnector<FsSession> {
 
   async updateWebsite(session: FsSession, websiteId: WebsiteId, data: WebsiteData): Promise<void> {
     const id = requiredParam<WebsiteId>(websiteId, 'website id')
-    const websitePath = join(this.options.path, id)
+    const websitePath = underPath(this.options.path, id)
 
     // Use the split function to create separate files for pages
     const filesToWrite = split(data)
@@ -216,12 +227,12 @@ export class FsStorage implements StorageConnector<FsSession> {
     // Ensure the pages directory exists if we have page files
     const hasPageFiles = filesToWrite.some(f => f.path.startsWith(pagesFolder))
     if (hasPageFiles) {
-      await fs.mkdir(join(websitePath, pagesFolder), { recursive: true })
+      await fs.mkdir(underPath(websitePath, pagesFolder), { recursive: true })
     }
 
     // **
     // Delete pages that are not in the new website data
-    const pagesPath = join(websitePath, pagesFolder)
+    const pagesPath = underPath(websitePath, pagesFolder)
     try {
       const existi
```

---

### Incident Patch 9: `18b50ab2` (2026-09-27)
**Commit Message**: fix(gitlab): import templates by URL when connected to another GitLab instance (#1863)

**File**: `server/plugins/GitlabConnector.test.ts` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+import { expect, jest, beforeEach, afterEach, it, describe } from '@jest/globals'
+import { ServerConfig } from '~/server/config'
+import { ApiError } from '~/common/types'
+import GitlabConnector from './GitlabConnector'
+
+const TEMPLATE_PATH = 'silex-templates/silex_devdocs-template'
+const TEMPLATE_API_URL = 'https://gitlab.com/api/v4/projects/silex-templates%2Fsilex_devdocs-template'
+const TEMPLATE_REPO_URL = 'https://gitlab.com/silex-templates/silex_devdocs-template.git'
+const ACCESS_TOKEN = 'dummy-access-token'
+const NEW_PROJECT_ID = 42
+
+const fetchMock = jest.fn<typeof fetch>()
+const realFetch = global.fetch
+
+const session = {
+  gitlab: {
+    token: { access_token: ACCESS_TOKEN },
+  },
+}
+
+function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
+  return new Response(JSON.stringify(body), {
+    status,
+    statusText,
+    headers: { 'content-type': 'application/json' },
+  })
+}
+
+function createConnector(domain: string): GitlabConnector {
+  return new GitlabConnector({} as ServerConfig, {
+    clientId: 'dummy client id',
+    clientSecret: 'dummy client secret',
+    domain,
+  })
+}
+
+type Route = [method: string, url: string, response: () => Response]
+
+// Route each mocked request by method and URL (without the query string), so the tests read like the GitLab API
+function mockGitlab(routes: Route[]) {
+  fetchMock.mockImplementation(async (input, init) => {
+    const url = String(input)
+    const method = init?.method ?? 'GET'
+    const route = routes.find(([m, u]) => m === method && url.split('?')[0] === u)
+    if (!route) throw new Error(`Unexpected request ${method} ${url}`)
+    return route[2]()
+  })
+}
+
+function requests(): Array<{ method: string, url: string, body?: any }> {
+  return fetchMock.mock.calls.map(([input, init]) => ({
+    method: init?.method ?? 'GET',
+    url: String(input),
+    body: init?.body ? JSON.parse(String(init.body)) : undefined,
+  }))
+}
+
+beforeEach(() => {
+  global.fetch = fetchMock as typeof fetch
+  fetchMock.mockReset()
+  // The connector logs every API error, keep the test output readable
+  jest.spyOn(console, 'error').mockImplementation(() => {})
+  jest.spyOn(console, 'info').mockImplementation(() => {})
+})
+
+afterEach(() => {
+  global.fetch = realFetch
+  jest.restoreAllMocks()
+})
+
+describe('GitlabConnector forkWebsite on gitlab.com', () => {
+  const DOMAIN = 'https://gitlab.com'
+  let connector: GitlabConnector
+
+  beforeEach(() => {
+    connector = createConnector(DOMAIN)
+  })
+
+  it('forks the project and waits for the fork to finish', async () => {
+    mockGitlab([
+      ['GET', `${TEMPLATE_API_URL}`, () => jsonResponse({ id: 1, name: 'silex_devdocs-template' })],
+      ['POST', `${TEMPLATE_API_URL}/fork`, () => jsonResponse({ id: NEW_PROJECT_ID, import_status: 'scheduled' })],
+      ['GET', `${DOMAIN}/api/v4/projects/${NEW_PROJECT_ID}`, () => jsonResponse({ id: NEW_PROJECT_ID, import_status: 'finished' })],
+    ])
+
+    await expect(connector.forkWebsite(session, TEMPLATE_PATH)).resolves.toBe(String(NEW_PROJECT_ID))
+
+    const calls = requests()
+    expect(calls.map(({ method, url }) => `${method} ${url.split('?')[0]}`)).toEqual([
+      `GET ${TEMPLATE_API_URL}`,
+      `POST ${TEMPLATE_API_URL}/fork`,
+      `GET ${DOMAIN}/api/v4/projects/${NEW_PROJECT_ID}`,
+    ])
+    // Every call is made with the user's token, on gitlab.com
+    calls.forEach(({ url }) => expect(url).toContain(`access_token=${ACCESS_TOKEN}`))
+    // The fork request is unchanged
+    expect(calls[1].body).toEqual({
+      name: expect.stringMatching(/^silex_devdocs-template \d{4}-\d{2}-\d{2} [a-z0-9]*$/),
+      path: expect.stringMatching(/^silex_devdocs-template-\d{4}-\d{2}-\d{2}-?[a-z0-9]*$/),
+      visibility: 'private',
+    })
+    expect(calls[1].body).not.toHaveProperty('import_url')
+  })
+})
+
+describe('GitlabConnector forkWebsite on another GitLab instance', () => {
+  const DOMAIN = 'https://framagit.org'
+  const CREATE_PROJECT_URL = `${DOMAIN}/api/v4/projects/`
+  const NEW_PROJECT_URL = `${DOMAIN}/api/v4/projects/${NEW_PROJECT_ID}`
+  let connector: GitlabConnector
+
+  const templateRoute: Route = ['GET', `${TEMPLATE_API_URL}`, () => jsonResponse({
+    id: 1,
+    name: 'silex_devdocs-template',
+    http_url_to_repo: TEMPLATE_REPO_URL,
+  })]
+
+  beforeEach(() => {
+    connector = createConnector(DOMAIN)
+  })
+
+  it('creates the project from the template URL instead of forking', async () => {
+    mockGitlab([
+      templateRoute,
+      ['POST', CREATE_PROJECT_URL, () => jsonResponse({ id: NEW_PROJECT_ID, import_status: 'scheduled' })],
+      ['GET', NEW_PROJECT_URL, () => jsonResponse({ id: NEW_PROJECT_ID, import_status: 'finished' })],
+    ])
+
+    await expect(connector.forkWebsite(session, TEMPLATE_PATH)).resolves.toBe(String(NEW_PROJECT_ID))
+
+    const calls = requests()
+    expect(calls.map(({ method, url }) => `${method} ${url.split('?'
```

**File**: `server/plugins/GitlabConnector.ts` (modified, +66/-26)
```diff
@@ -36,6 +36,8 @@ import { stringify, split, merge, getPagesFolder } from '~/server/utils/websiteD
 const MAX_BATCH_UPLOAD_SIZE = 100
 const MAX_BODY_SIZE_KB = 8 * 1000 * 1024 // 8MB (note that 10 MB PNG → becomes ~13.3 MB → ❌ often too big for Gitlab)
 const WEBSITE_DATA_FILE_FORMAT_VERSION = '1.0.0'
+// The templates are public projects on gitlab.com, whatever instance the user is connected to
+const TEMPLATES_DOMAIN = 'https://gitlab.com'
 
 export interface GitlabOptions {
   clientId: string
@@ -120,6 +122,13 @@ interface GitlabFetchCommits {
   since: string
 }
 
+interface GitlabCreateProject {
+  name: string
+  path?: string
+  visibility?: 'private' | 'internal' | 'public'
+  import_url?: string
+}
+
 
 // interface MetaRepoFileContent {
 //   websites: {
@@ -306,7 +315,7 @@ export default class GitlabConnector implements StorageConnector {
     session: GitlabSession,
     path: string,
     method?: 'POST' | 'GET' | 'PUT' | 'DELETE',
-    requestBody?: GitlabWriteFile | GitlabGetToken | GitlabWebsiteName | GitlabCreateBranch | GitlabGetTags | GitlabCreateTag | GitlabFetchCommits | null,
+    requestBody?: GitlabWriteFile | GitlabGetToken | GitlabWebsiteName | GitlabCreateBranch | GitlabGetTags | GitlabCreateTag | GitlabFetchCommits | GitlabCreateProject | null,
     params?: any,
     responseHeaders?: any,
   }): Promise<any> {
@@ -934,6 +943,9 @@ export default class GitlabConnector implements StorageConnector {
 
   /**
    * Fork an external/public GitLab project (from any user/organization)
+   * The source project lives on gitlab.com, where the templates are. GitLab can only
+   * fork within one instance, so when the user is connected to another instance
+   * (e.g. framagit.org) the project is created from the source repository URL instead
    * @param session - The user session
    * @param gitlabUrl - The project path in the "username/repo" format
    * @returns The new website ID (project ID)
@@ -947,41 +959,43 @@ export default class GitlabConnector implements StorageConnector {
 
     // URL-encode the project path for the API
     const encodedPath = encodeURIComponent(projectPath)
+    const canFork = this.isUsingOfficialInstance()
 
     // First, get the source project info to extract its name
-    let sourceProject: any
+    const sourceProject = await this.getSourceProject(session, projectPath, canFork)
+
+    // Generate a unique name for the fork
+    const sourceName = sourceProject.name.replace(this.options.repoPrefix, '')
+    const forkName = `${sourceName} ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).substring(2, 4)}`
+    const newProject: GitlabCreateProject = {
+      name: this.options.repoPrefix + forkName,
+      path: sanitizeGitlabPath(this.options.repoPrefix + forkName),
+      visibility: 'private',
+    }
+
+    // Fork the project to the user's namespace, or import it by URL on another instance
+    let forkedProject: any
     try {
-      sourceProject = await this.callApi({
+      forkedProject = await this.callApi(canFork ? {
         session,
-        path: `api/v4/projects/${encodedPath}`,
-        method: 'GET',
+        path: `api/v4/projects/${encodedPath}/fork`,
+        method: 'POST',
+        requestBody: newProject,
+      } : {
+        session,
+        path: 'api/v4/projects/',
+        method: 'POST',
+        requestBody: { ...newProject, import_url: sourceProject.http_url_to_repo },
       })
     } catch (e) {
-      if (e.httpStatusCode === 404) {
-        throw new ApiError(`Project not found: ${projectPath}. Make sure the project exists and is public or you have access to it.`, 404)
+      // GitLab answers 403 when the "Repository by URL" import source is disabled on the instance
+      if (!canFork && e.httpStatusCode === 403) {
+        throw new ApiError(`Could not import the project ${projectPath}: the "Repository by URL" import source is disabled on ${this.options.domain}. Ask the administrator of this GitLab instance to enable it (Admin area > Settings > General > Import and export settings), or connect with gitlab.com.`, 403)
       }
       throw e
     }
 
-    // Generate a unique name for the fork
-    const sourceName = sourceProject.name.replace(this.options.repoPrefix, '')
-    const forkName = `${sourceName} ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).substring(2, 4)}`
-    const safePath = sanitizeGitlabPath(this.options.repoPrefix + forkName)
-
-    // Fork the project to the user's namespace
-    const forkedProject = await this.callApi({
-      session,
-      path: `api/v4/projects/${encodedPath}/fork`,
-      method: 'POST',
-      requestBody: {
-        name: this.options.repoPrefix + forkName,
-        /* @ts-ignore */
-        path: safePath,
-        visibility: 'private',
-      },
-    })
-
-    // Wait for the fork to complete (GitLab forks asynchronously)
+    // Wait for the fork to complete (GitLab forks and imports asynchronously)
     const forkedProj
```

---

### Incident Patch 10: `c98ca7a6` (2026-09-27)
**Commit Message**: fix(editor): allow leaving preview mode with Escape key (#1844)

**File**: `editor/grapesjs/keymaps.ts` (modified, +4/-2)
```diff
@@ -28,15 +28,17 @@ function resetPanel(editor: Editor): void {
 }
 
 /**
- * Escapes the current context in this order : modal, Publish dialog, left panel.
+ * Escapes the current context in this order : preview mode, modal, Publish dialog, left panel.
  * If none of these are open, it selects the body.
  * @param editor The editor.
  */
 function escapeContext(editor: Editor): void {
   const publishDialog = (editor as PublishableEditor).PublicationManager.dialog
   const projectBarPanel = editor.Panels.getPanel('project-bar-panel')
 
-  if (editor.Modal.isOpen()) {
+  if (editor.Commands.isActive('preview')) {
+    editor.stopCommand('preview')
+  } else if (editor.Modal.isOpen()) {
     editor.Modal.close()
   } else if (publishDialog && publishDialog.isOpen) {
     publishDialog.closeDialog()
```

---

### Incident Patch 11: `b91d4596` (2026-09-27)
**Commit Message**: fix(data-source): synchronize live canvas DOM (#1862)

**File**: `grapesjs-plugins/grapesjs-data-source/src/integration.test.ts` (modified, +592/-3)
```diff
@@ -5,22 +5,23 @@
 import { jest } from '@jest/globals'
 import fs from 'fs'
 import path from 'path'
-import grapesjs from 'grapesjs'
+import grapesjs, { Editor } from 'grapesjs'
 import plugin from './index'
-import { Type, Field, DataSourceType } from './types'
+import { Type, Field, DataSourceType, Properties, COMPONENT_STATE_CHANGED } from './types'
 import { addDataSource } from './api'
 import { GQLField, GQLType } from './datasources/GraphQL'
 import { FieldKind, IDataSource } from '../dist'
 import { setPreviewData } from './api'
 import { compare, GroupingReporter } from 'dom-compare'
 import { diff as jestDiff } from 'jest-diff'
+import { setState, removeState } from './model/state'
+import { getFixedToken } from './utils'
 
 // ////
 // Use require instead of import so the TextEncoder/TextDecoder polyfill is set before jsdom loads (avoids hoisting).
 /* @ts-expect-error Workaround jest+jsdom bug */
 import { TextEncoder, TextDecoder } from 'util'
 import { doRender } from './view/canvas'
-;import { act } from 'react'
 (global as any).TextEncoder = TextEncoder
 ;(global as any).TextDecoder = TextDecoder
 ;(global as any).ReadableStream = require('stream/web').ReadableStream
@@ -502,3 +503,591 @@ _______________________
     })
   })
 })
+
+describe('Issue #1845 - Live canvas synchronization', () => {
+  let container: HTMLDivElement
+  let editor: Editor
+
+  beforeEach((done) => {
+    container = document.createElement('div')
+    document.body.appendChild(container)
+
+    editor = grapesjs.init({
+      container,
+      headless: false,
+      plugins: [plugin],
+      pluginsOpts: {
+        [plugin.toString()]: {
+          view: {
+            el: null,
+            previewRefreshEvents: '',
+          },
+          filters: 'liquid',
+        },
+      },
+    })
+
+    editor.on('load', () => {
+      done()
+    })
+  })
+
+  afterEach(async () => {
+    try {
+      editor.select(null)
+    } catch {
+      // Ignore if editor already destroyed or no selection
+    }
+    await new Promise(resolve => setTimeout(resolve, 250))
+    editor.destroy()
+    container.remove()
+  })
+
+  test('A. Attribute addition: model attribute title="hello" -> canvas DOM contains title="hello"', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-add">Test</div>')
+    expect(comp.view?.el.hasAttribute('title')).toBe(false)
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('hello')],
+    }, false)
+
+    doRender(editor)
+
+    expect(comp.view?.el.getAttribute('title')).toBe('hello')
+  })
+
+  test('B. Attribute update: title="hello" -> title="world" -> canvas DOM contains title="world"', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-update">Test</div>')
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('hello')],
+    }, false)
+    doRender(editor)
+    expect(comp.view?.el.getAttribute('title')).toBe('hello')
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('world')],
+    }, false)
+    doRender(editor)
+    expect(comp.view?.el.getAttribute('title')).toBe('world')
+  })
+
+  test('C. Attribute removal: title="hello" -> remove title -> canvas DOM no longer contains title', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-rm">Test</div>')
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('hello')],
+    }, false)
+    doRender(editor)
+    expect(comp.view?.el.getAttribute('title')).toBe('hello')
+
+    // Remove the attribute
+    removeState(comp, 'test-attr-title', false)
+
+    // Render preview again
+    doRender(editor)
+
+    // Expected: title attribute must disappear from canvas DOM immediately without reload
+    expect(comp.view?.el.hasAttribute('title')).toBe(false)
+  })
+
+  test('D. Multiple attributes: title="hello", data-test="123" -> remove title -> data-test remains, title is gone', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-multi">Test</div>')
+
+    setState(comp, 'test-attr-title', {
+      label: 'title',
+      expression: [getFixedToken('hello')],
+    }, false)
+    setState(comp, 'test-attr-datatest', {
+      label: 'data-test',
+      expression: [getFixedToken('123')],
+    }, false)
+
+    doRender(editor)
+    expect(comp.view?.el.getAttribute('title')).toBe('hello')
+    expect(comp.view?.el.getAttribute('data-test')).toBe('123')
+
+    removeState(comp, 'test-attr-title', false)
+    doRender(editor)
+
+    expect(comp.view?.el.hasAttribute('title')).toBe(false)
+    expect(comp.view?.el.getAttribute('data-test')).toBe('123')
+  })
+
+  test('E. Repeated changes: add -> remove -> add -> change -> remove -> DOM always matches current model', () => {
+    const [comp] = editor.addComponents('<div id="comp-attr-repeated">Test</div>')
+
+    // 1. add title="first"
+    setState(comp,
```

**File**: `grapesjs-plugins/grapesjs-data-source/src/view/canvas.ts` (modified, +99/-6)
```diff
@@ -357,9 +357,73 @@ export function isComponentVisible(
   }
 }
 
+// Tracks attribute names that were dynamically applied by data-source to each live DOM element
+const renderedAttributesMap = new WeakMap<Element, Set<string>>()
+
+// Tracks elements that currently have dynamic innerHTML applied
+const renderedInnerHTMLMap = new WeakSet<Element>()
+
+function restoreAttribute(
+  component: Component,
+  el: Element,
+  attrName: string,
+): void {
+  if (attrName === 'class') {
+    // If GrapesJS view provides updateClasses, use it directly as it properly
+    // restores the model classes and re-applies runtime status classes (e.g. gjs-selected)
+    const view = component.view as (Component['view'] & { updateClasses?: () => void; updateStatus?: () => void }) | undefined
+    if (view?.updateClasses) {
+      view.updateClasses()
+      return
+    }
+
+    const classes = (component.getClasses ? component.getClasses() : []) as (string | { get?: (k: string) => unknown; name?: string })[]
+    const classList = classes
+      .map(c => (typeof c === 'string' ? c : (c?.get ? String(c.get('name')) : c?.name) || String(c)))
+      .filter(Boolean)
+    if (classList.length > 0) {
+      el.setAttribute('class', classList.join(' '))
+    } else {
+      const baseAttrs: Record<string, unknown> = (component.getAttributes ? component.getAttributes() : component.get?.('attributes')) || {}
+      const baseVal = baseAttrs['class']
+      if (baseVal !== undefined && baseVal !== null && baseVal !== '') {
+        el.setAttribute('class', String(baseVal))
+      } else {
+        el.removeAttribute('class')
+      }
+    }
+    view?.updateStatus?.()
+    return
+  }
+
+  const baseAttrs: Record<string, unknown> = (component.getAttributes ? component.getAttributes() : component.get?.('attributes')) || {}
+  const baseVal = baseAttrs[attrName]
+  if (baseVal !== undefined && baseVal !== null) {
+    if (typeof baseVal === 'boolean') {
+      if (baseVal) {
+        el.setAttribute(attrName, '')
+      } else {
+        el.removeAttribute(attrName)
+      }
+    } else {
+      el.setAttribute(attrName, String(baseVal))
+    }
+  } else {
+    el.removeAttribute(attrName)
+  }
+}
+
 function renderAttributes(
   component: Component,
 ): void {
+  const el = component.view?.el
+  if (!el) {
+    return
+  }
+
+  const prevAttributes = renderedAttributesMap.get(el) || new Set<string>()
+  const currentAttributes = new Set<string>()
+
   const privateStates = component.get('privateStates') || []
   privateStates.forEach((state: {id: string, expression: StoredToken[], label?: string}) => {
     // Skip condition states and internal data states - they should not become HTML attributes
@@ -369,16 +433,32 @@ function renderAttributes(
         state.id !== Properties.condition &&
         state.id !== Properties.condition2 &&
         state.expression) {
+      const attrName = state.label || state.id
       try {
         const value = evaluateExpression(state.expression, component, true)
         if (value !== null && value !== undefined) {
-          component.view?.el.setAttribute(state.label || state.id, String(value))
+          el.setAttribute(attrName, String(value))
+          if (attrName === 'class') {
+            const view = component.view as (Component['view'] & { updateStatus?: () => void }) | undefined
+            view?.updateStatus?.()
+          }
+          currentAttributes.add(attrName)
         }
       } catch (e) {
         console.warn(`Error evaluating attribute ${state.id}:`, e)
       }
     }
   })
+
+  // Clean up any attributes that were previously rendered by data-source
+  // but are no longer present or evaluated to null/undefined
+  prevAttributes.forEach(attrName => {
+    if (!currentAttributes.has(attrName)) {
+      restoreAttribute(component, el, attrName)
+    }
+  })
+
+  renderedAttributesMap.set(el, currentAttributes)
 }
 
 // // Helper to extend a component instance
@@ -409,10 +489,16 @@ function renderContent(comp: Component, deep: number) {
   const innerHtml = renderInnerHTML(comp)
 
   if (innerHtml === null) {
+    const el = comp.view?.el
+    if (el && renderedInnerHTMLMap.has(el)) {
+      renderedInnerHTMLMap.delete(el)
+      comp.view!.render()
+    }
     comp.components()
       .forEach(c => renderPreview(c, deep+1))
   } else {
     const el = comp.view!.el
+    renderedInnerHTMLMap.add(el)
 
     // Parse new HTML into a temporary container
     const temp = document.createElement('div')
@@ -447,7 +533,12 @@ export function restoreOriginalRender(comp: Component) {
     return
   }
 
-  // Force standard GrapesJS render
+  if (view.el) {
+    renderedAttributesMap.delete(view.el)
+    renderedInnerHTMLMap.delete(view.el)
+  }
+
+  // Force standard GrapesJS render - rebuilds all attributes and classes from the model
   view.render()
 
   // Recursively restore all children
@@ -616,6 +707,7 @@ export function renderPreview(comp: Component, deep = 0) {
         
```

---

### Incident Patch 12: `9a6e4390` (2026-09-26)
**Commit Message**: fix(editor): make native selects readable in the desktop app (#1889)

**File**: `editor/css/design-system.scss` (modified, +6/-0)
```diff
@@ -23,6 +23,12 @@
 
 @use "variables" as silex-vars;
 
+// Without it WebKitGTK paints native selects light, ignoring their dark background.
+// Not on :root: iframes whose document has another color-scheme get an opaque white backdrop
+select {
+  color-scheme: dark;
+}
+
 :root {
   // ============================================================
   // BASE COLORS - Modern Dark 2025
```

---

### Incident Patch 13: `f68e43a6` (2026-09-26)
**Commit Message**: fix(css-variables): keep the chosen unit of a size variable (#1890)

**File**: `grapesjs-plugins/grapesjs-css-variables/package.json` (modified, +4/-2)
```diff
@@ -19,7 +19,8 @@
   "scripts": {
     "start": "grapesjs-cli serve",
     "build": "grapesjs-cli build --patch=false",
-    "lint": "eslint src"
+    "lint": "eslint src",
+    "test": "node --conditions=browser --test test/*.test.js"
   },
   "keywords": [
     "silex",
@@ -32,7 +33,8 @@
   ],
   "devDependencies": {
     "eslint": "^10.6.0",
-    "grapesjs-cli": "^4.1.3"
+    "grapesjs-cli": "^4.1.3",
+    "jsdom": "^24.1.3"
   },
   "peerDependencies": {
     "grapesjs": ">=0.19.0 <0.23.0",
```

**File**: `grapesjs-plugins/grapesjs-css-variables/src/modal.js` (modified, +2/-2)
```diff
@@ -286,7 +286,7 @@ function parseSizeValue(val) {
   if (!val) return { number: '', unit: 'px' }
   const match = val.match(/^(-?[\d.]+)\s*(.*)$/)
   if (!match) return { number: val, unit: '' }
-  return { number: match[1], unit: match[2] || 'px' }
+  return { number: match[1], unit: match[2] }
 }
 
 /**
@@ -569,7 +569,7 @@ export function renderModal(el, editor, options) {
     if (num) onSizeChange(varItem, wm, num, e.target.value)
   }}
         >
-          ${SIZE_UNITS.map(u => html`<option value=${u} ?selected=${(hasValue ? parsed.unit : 'px') === u}>${u}</option>`)}
+          ${SIZE_UNITS.map(u => html`<option value=${u} ?selected=${(parsed.unit || 'px') === u}>${u}</option>`)}
         </select>
       </div>
     `
```

**File**: `grapesjs-plugins/grapesjs-css-variables/test/modal.test.js` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+const { test } = require('node:test')
+const assert = require('node:assert')
+const { JSDOM, VirtualConsole } = require('jsdom')
+
+const { window } = new JSDOM('<!DOCTYPE html><div id="gjs"></div>', { pretendToBeVisual: true, virtualConsole: new VirtualConsole() })
+for (const key of ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'Event', 'getComputedStyle', 'requestAnimationFrame']) {
+  Object.defineProperty(globalThis, key, { value: window[key], configurable: true })
+}
+
+test('changing the unit of a size variable updates its value', async () => {
+  const grapesjs = require('grapesjs')
+  const { setVariable } = await import('../src/variables.js')
+  const { renderModal } = await import('../src/modal.js')
+  const editor = grapesjs.init({ container: '#gjs', headless: true, storageManager: false })
+  editor.getModel().set('cssVarOrder', [{ type: 'size', name: 'size' }])
+  setVariable(editor, { name: 'size', value: '16px' })
+  const el = document.createElement('div')
+  renderModal(el, editor, { enableSizes: true })
+
+  const select = el.querySelector('.css-vars-size-unit')
+  select.value = 'rem'
+  select.dispatchEvent(new window.Event('change'))
+
+  assert.match(editor.getCss(), /--size:16rem/)
+})
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -393,6 +393,9 @@ importers:
       grapesjs-cli:
         specifier: ^4.1.3
         version: 4.1.3(@types/node@26.0.1)(postcss@8.5.19)(typescript@6.0.3)
+      jsdom:
+        specifier: ^24.1.3
+        version: 24.1.3(canvas@3.2.3)
 
   grapesjs-plugins/grapesjs-data-source:
     dependencies:
```

---

### Incident Patch 14: `4be7fdcd` (2026-09-26)
**Commit Message**: fix(desktop): show the address the host gives, not a stale one (#1888)

**File**: `desktop/src-tauri/src/integrations/glab.rs` (modified, +6/-9)
```diff
@@ -49,15 +49,12 @@ impl Deploy for Glab {
         let web_url = json_string(&repo, "web_url")
             .ok_or_else(|| format!("{} did not say where the repository is", self.program()))?;
 
-        // The address the user named rather than the one GitLab would answer:
-        // that request costs a round trip, and before a first publication
-        // there is nothing to ask for anyway
-        let site_url = match options.named(WEBSITE_URL) {
-            Some(url) => Some(url.to_string()),
-            None => run(cli, site, &["api", "projects/:fullpath/pages"])
-                .ok()
-                .and_then(|pages| json_string(&pages, "url")),
-        };
+        // Asked again at each publication in case it changed, so the address
+        // saved with the website stays right
+        let site_url = run(cli, site, &["api", "projects/:fullpath/pages"])
+            .ok()
+            .and_then(|pages| json_string(&pages, "url"))
+            .or_else(|| options.named(WEBSITE_URL).map(String::from));
 
         Ok(Some(Urls {
             site: site_url,
```

**File**: `editor/grapesjs/PublicationManager.test.ts` (modified, +14/-2)
```diff
@@ -4,8 +4,8 @@
 
 import { expect, jest, describe, it, beforeEach } from '@jest/globals'
 import grapesjs, { Editor } from 'grapesjs'
-import { WebsiteSettings } from '~/common/types'
-import { PublicationManager } from './PublicationManager'
+import { ConnectorData, ConnectorType, WebsiteSettings } from '~/common/types'
+import { PublicationManager, withConnectorOptions } from './PublicationManager'
 
 // Prevent lit-html from being imported (it is a peer dependency and breaks the tests)
 jest.mock('lit-html', () => ({}))
@@ -61,3 +61,15 @@ describe('PublicationManager html output', () => {
     expect(settings?.title).toBeUndefined()
   })
 })
+
+describe('withConnectorOptions', () => {
+  const host: ConnectorData = {
+    connectorId: 'fs-hosting', type: ConnectorType.HOSTING, displayName: 'gitlab.com', icon: '', disableLogout: true,
+    isLoggedIn: true, oauthUrl: null, color: '', background: '',
+    options: { websiteUrl: 'https://now.gitlab.io' },
+  }
+
+  it('takes the address of the host over one saved from an earlier answer', () => {
+    expect(withConnectorOptions({ options: { websiteUrl: 'https://before.gitlab.io' } }, host).websiteUrl).toBe('https://now.gitlab.io')
+  })
+})
```

**File**: `editor/grapesjs/PublicationManager.ts` (modified, +4/-8)
```diff
@@ -67,15 +67,11 @@ export default function publishPlugin(editor, opts) {
   (editor as PublishableEditor).PublicationManager = new PublicationManager(editor, opts)
 }
 
-/**
- * The publication options of a website, once the connector has had its say
- *
- * What a connector answers is a starting point. What the user filled in is
- * saved with the website and wins, or publishing would move a site away from
- * the domain somebody chose for it.
- */
+// What the user filled in wins, anything else comes from the host, which knows better than an old copy
 export function withConnectorOptions(settings: PublicationSettings, connector: ConnectorData): ConnectorOptions {
-  return { ...connector.options, ...settings.options }
+  const asked = new Set(connector.optionsForm?.fields.map(field => field.name))
+  const filledIn = Object.fromEntries(Object.entries(settings.options ?? {}).filter(([name]) => asked.has(name)))
+  return { ...settings.options, ...connector.options, ...filledIn }
 }
 
 function jobStatusToPublicationStatus(status: JobStatus): PublicationStatus {
```

---

### Incident Patch 15: `fe65cc7e` (2026-09-25)
**Commit Message**: fix(desktop): block DNS rebinding and cross-site requests on local servers (#1883)

**File**: `Cargo.lock` (modified, +88/-42)
```diff
@@ -199,9 +199,9 @@ dependencies = [
 
 [[package]]
 name = "anyhow"
-version = "1.0.101"
+version = "1.0.104"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5f0e0fee31ef5ed1ba1316088939cea399010ed7731dba877ed44aeb407a75ea"
+checksum = "330a5ed07fa54e4702c9d6c4174f74427fc0ef6e214bbd677ae50a5099946470"
 
 [[package]]
 name = "arbitrary"
@@ -380,24 +380,25 @@ checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
 [[package]]
 name = "aws-lc-rs"
-version = "1.15.4"
+version = "1.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b7b6141e96a8c160799cc2d5adecd5cbbe5054cb8c7c4af53da0f83bb7ad256"
+checksum = "b281d307588d634de920874890732659e2e7672f72b5e10e81badc1a8a83621e"
 dependencies = [
  "aws-lc-sys",
  "zeroize",
 ]
 
 [[package]]
 name = "aws-lc-sys"
-version = "0.37.1"
+version = "0.45.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b092fe214090261288111db7a2b2c2118e5a7f30dc2569f1732c4069a6840549"
+checksum = "9bff6c3b54fad79a2e60b8102caf565819711497c1f5f092f49508e2f5c31b27"
 dependencies = [
  "cc",
  "cmake",
  "dunce",
  "fs_extra",
+ "pkg-config",
 ]
 
 [[package]]
@@ -713,6 +714,17 @@ version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
 
+[[package]]
+name = "chacha20"
+version = "0.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "65c35e4b699c7e15ccbe7ee35c005e4fc0a278d22238a2857e6ce2dadeda1b06"
+dependencies = [
+ "cfg-if",
+ "cpufeatures 0.3.1",
+ "rand_core 0.10.1",
+]
+
 [[package]]
 name = "chrono"
 version = "0.4.43"
@@ -839,6 +851,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "cpufeatures"
+version = "0.3.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "5ca28b0ae3115b884660db4118d803791fd6756b6e88f39c0f3f7859060d7566"
+dependencies = [
+ "libc",
+]
+
 [[package]]
 name = "crc32fast"
 version = "1.5.0"
@@ -1001,11 +1022,10 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.5.6"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cc3dc5ad92c2e2d1c193bbbbdf2ea477cb81331de4f3103f267ca18368b988c4"
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 dependencies = [
- "powerfmt",
  "serde_core",
 ]
 
@@ -1678,11 +1698,9 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "899def5c37c4fd7b2664648c28120ecec138e4d395b459e5ca34f9cce2dd77fd"
 dependencies = [
  "cfg-if",
- "js-sys",
  "libc",
  "r-efi",
  "wasip2",
- "wasm-bindgen",
 ]
 
 [[package]]
@@ -1692,10 +1710,13 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "139ef39800118c7683f2fd3c98c1b23c09ae076556b435f8e9064ae108aaeeec"
 dependencies = [
  "cfg-if",
+ "js-sys",
  "libc",
  "r-efi",
+ "rand_core 0.10.1",
  "wasip2",
  "wasip3",
+ "wasm-bindgen",
 ]
 
 [[package]]
@@ -1866,9 +1887,9 @@ dependencies = [
 
 [[package]]
 name = "h2"
-version = "0.4.13"
+version = "0.4.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2f44da3a8150a6703ed5d34e164b875fd14c2cdab9af1252a9a1020bde2bdc54"
+checksum = "ef8e5e5a340588f4452631496976cf8636d4a7ecf600239fdc27615d2530bc16"
 dependencies = [
  "atomic-waker",
  "bytes",
@@ -2787,9 +2808,9 @@ dependencies = [
 
 [[package]]
 name = "num-conv"
-version = "0.2.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cf97ec579c3c42f953ef76dbf8d55ac91fb219dde70e49aa4a6b7d74e9919050"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "num-traits"
@@ -3634,15 +3655,16 @@ dependencies = [
 
 [[package]]
 name = "quinn-proto"
-version = "0.11.13"
+version = "0.11.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1906b49b0c3bc04b5fe5d86a77925ae6524a19b816ae38ce1e426255f1d8a31"
+checksum = "a9746dbde176634f4f2f1faf2404e30a31b2bc1e9cafb5329c95d8177a18c9fc"
 dependencies = [
  "aws-lc-rs",
  "bytes",
- "getrandom 0.3.4",
+ "getrandom 0.4.1",
  "lru-slab",
- "rand 0.9.5",
+ "rand 0.10.3",
+ "rand_pcg 0.10.2",
  "ring",
  "rustc-hash",
  "rustls",
@@ -3694,7 +3716,7 @@ dependencies = [
  "rand_chacha 0.2.2",
  "rand_core 0.5.1",
  "rand_hc",
- "rand_pcg",
+ "rand_pcg 0.2.1",
 ]
 
 [[package]]
@@ -3718,6 +3740,17 @@ dependencies = [
  "rand_core 0.9.5",
 ]
 
+[[package]]
+name = "rand"
+version = "0.10.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "65c9fb96cbc91e3478eaae79a69fcd3f1ae4ad052e471fe6732fff548984b4af"
+dependencies = [
+ "chacha20",
+ "getrandom 0.4.1",
+ "rand_core 0.10.1",
+]
+
 [[package]]
 name = "rand_chacha"
 version = "0.2.2"
@@ -3775,6 +3808,12 @@ dependencies = [
  "getrandom 0.3.4",
 ]
 
+[[package]]
+name = "rand_core"
+version = "0.10.1"
+source =
```

**File**: `desktop/src-tauri/Cargo.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ tracing-subscriber = { version = "0.3", features = ["env-filter"] }
 
 # MCP (Model Context Protocol) support
 reqwest = { version = "0.13", features = ["json"] }
-rmcp = { version = "0.15", features = ["server", "transport-streamable-http-server", "transport-io"] }
+rmcp = { version = "1", features = ["server", "transport-streamable-http-server", "transport-io"] }
 # Required as a direct dependency: the JsonSchema derive expands to ::schemars paths
 schemars = "1"
 
```

**File**: `desktop/src-tauri/src/main.rs` (modified, +41/-0)
```diff
@@ -424,6 +424,46 @@ async fn trace_without_query(
     next.run(request).await
 }
 
+fn is_local_authority(authority: &str) -> bool {
+    axum::http::uri::Authority::try_from(authority).is_ok_and(|a| {
+        let host = a.host().trim_start_matches('[').trim_end_matches(']');
+        ["localhost", "127.0.0.1", "::1"]
+            .iter()
+            .any(|local| host.eq_ignore_ascii_case(local))
+    })
+}
+
+// A web page can point its own domain at 127.0.0.1 (DNS rebinding) and then
+// call this API as same-origin; only the Host header gives it away.
+// A plain cross-site form POST keeps a local Host, but not a local Origin
+async fn reject_foreign_host(
+    request: axum::extract::Request,
+    next: axum::middleware::Next,
+) -> axum::response::Response {
+    use axum::http::{header, Method};
+    use axum::response::IntoResponse;
+
+    let headers = request.headers();
+    let host = headers
+        .get(header::HOST)
+        .and_then(|h| h.to_str().ok())
+        .unwrap_or("");
+    let safe_method = matches!(*request.method(), Method::GET | Method::HEAD);
+    let same_origin = match headers.get(header::ORIGIN) {
+        None => true,
+        Some(origin) => origin
+            .to_str()
+            .ok()
+            .and_then(|o| o.strip_prefix("http://"))
+            .is_some_and(|o| o.eq_ignore_ascii_case(host)),
+    };
+    if is_local_authority(host) && (safe_method || same_origin) {
+        next.run(request).await
+    } else {
+        axum::http::StatusCode::FORBIDDEN.into_response()
+    }
+}
+
 async fn start_server(
     pending_evals: mcp::PendingEvals,
     data_path: std::path::PathBuf,
@@ -466,6 +506,7 @@ async fn start_server(
 
     let app = app
         .layer(axum::middleware::from_fn(trace_without_query))
+        .layer(axum::middleware::from_fn(reject_foreign_host))
         .layer(sentry::integrations::tower::SentryHttpLayer::new().enable_transaction());
 
     let app = frontend::configure(app);
```

**File**: `desktop/src-tauri/src/mcp.rs` (modified, +24/-46)
```diff
@@ -289,30 +289,19 @@ impl SilexMcp {
                 _ => serde_json::Map::new(),
             };
 
-            let annotations = ToolAnnotations {
-                read_only_hint: cap.read_only.or(Some(false)),
-                destructive_hint: if cap.read_only == Some(true) {
-                    None
-                } else {
-                    cap.destructive.or(Some(false))
-                },
-                idempotent_hint: cap.idempotent,
-                open_world_hint: cap.open_world,
-                ..Default::default()
+            let mut annotations = ToolAnnotations::new();
+            annotations.read_only_hint = cap.read_only.or(Some(false));
+            annotations.destructive_hint = if cap.read_only == Some(true) {
+                None
+            } else {
+                cap.destructive.or(Some(false))
             };
+            annotations.idempotent_hint = cap.idempotent;
+            annotations.open_world_hint = cap.open_world;
 
-            let tool = Tool {
-                // ':' in capability ids is not allowed in tool names (clients require ^[a-zA-Z0-9_-]+$)
-                name: cap.id.replace(':', "_").into(),
-                title: None,
-                description: Some(cap.description.into()),
-                input_schema: Arc::new(schema_obj),
-                output_schema: None,
-                annotations: Some(annotations),
-                execution: None,
-                icons: None,
-                meta: None,
-            };
+            // ':' in capability ids is not allowed in tool names (clients require ^[a-zA-Z0-9_-]+$)
+            let tool = Tool::new(cap.id.replace(':', "_"), cap.description, schema_obj)
+                .with_annotations(annotations);
 
             let cap_command = Arc::new(cap.command);
 
@@ -350,11 +339,11 @@ impl SilexMcp {
                                         || v.get("success").map_or(false, |s| s == false)
                                 })
                                 .unwrap_or(false);
-                            Ok(CallToolResult {
-                                content: vec![Content::text(text)],
-                                structured_content: None,
-                                is_error: if is_error { Some(true) } else { None },
-                                meta: None,
+                            let content = vec![Content::text(text)];
+                            Ok(if is_error {
+                                CallToolResult::error(content)
+                            } else {
+                                CallToolResult::success(content)
                             })
                         }
                         Err(e) => Ok(tool_error(e)),
@@ -376,12 +365,7 @@ impl SilexMcp {
 
 /// Create an error CallToolResult (is_error = true).
 fn tool_error(msg: impl Into<String>) -> CallToolResult {
-    CallToolResult {
-        content: vec![Content::text(msg.into())],
-        structured_content: None,
-        is_error: Some(true),
-        meta: None,
-    }
+    CallToolResult::error(vec![Content::text(msg.into())])
 }
 
 // ==========================================================================
@@ -753,11 +737,10 @@ pub async fn eval_callback(
 
 impl ServerHandler for SilexMcp {
     fn get_info(&self) -> ServerInfo {
-        ServerInfo {
-            protocol_version: ProtocolVersion::V_2024_11_05,
-            capabilities: ServerCapabilities::builder().enable_tools().build(),
-            server_info: Implementation::from_build_env(),
-            instructions: Some(
+        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
+            .with_protocol_version(ProtocolVersion::V_2024_11_05)
+            .with_server_info(Implementation::from_build_env())
+            .with_instructions(
                 r#"Silex Desktop MCP — controls the Silex no-code visual website builder.
 
 GETTING STARTED:
@@ -775,10 +758,8 @@ RULES:
 - Homepage page name must be "index". Internal links start with "./".
 - Autosave is active — no manual save needed.
 - After making visual changes, use take_screenshot to verify your work.
-"#
-                .into(),
-            ),
-        }
+"#,
+            )
     }
 
     fn list_tools(
@@ -805,10 +786,7 @@ RULES:
             for tool in &mut tools {
                 let name = tool.name.as_ref();
                 if name == "take_screenshot" {
-                    tool.annotations = Some(ToolAnnotations {
-                        read_only_hint: Some(true),
-                        ..Default::default()
-                    });
+                    tool.annotations = Some(ToolAnnotations::new().read_only(true));
                 }
             }
             let static_count = tools.len();
```

**File**: `server-rust/Cargo.lock` (removed, +0/-1645)
```diff
@@ -1,1645 +0,0 @@
-# This file is automatically @generated by Cargo.
-# It is not intended for manual editing.
-version = 4
-
-[[package]]
-name = "adler2"
-version = "2.0.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "320119579fcad9c21884f5c4861d16174d0e06250625266f50fe6898340abefa"
-
-[[package]]
-name = "aho-corasick"
-version = "1.1.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
-dependencies = [
- "memchr",
-]
-
-[[package]]
-name = "android_system_properties"
-version = "0.1.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "819e7219dbd41043ac279b19830f2efc897156490d7fd6ea916720117ee66311"
-dependencies = [
- "libc",
-]
-
-[[package]]
-name = "anyhow"
-version = "1.0.100"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a23eb6b1614318a8071c9b2521f36b424b2c83db5eb3a0fead4a6c0809af6e61"
-
-[[package]]
-name = "async-compression"
-version = "0.4.37"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d10e4f991a553474232bc0a31799f6d24b034a84c0971d80d2e2f78b2e576e40"
-dependencies = [
- "compression-codecs",
- "compression-core",
- "pin-project-lite",
- "tokio",
-]
-
-[[package]]
-name = "async-trait"
-version = "0.1.89"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9035ad2d096bed7955a320ee7e2230574d28fd3c3a0f186cbea1ff3c7eed5dbb"
-dependencies = [
- "proc-macro2",
- "quote",
- "syn",
-]
-
-[[package]]
-name = "atomic-waker"
-version = "1.1.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
-
-[[package]]
-name = "autocfg"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
-
-[[package]]
-name = "axum"
-version = "0.7.9"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "edca88bc138befd0323b20752846e6587272d3b03b0343c8ea28a6f819e6e71f"
-dependencies = [
- "async-trait",
- "axum-core",
- "axum-macros",
- "bytes",
- "futures-util",
- "http",
- "http-body",
- "http-body-util",
- "hyper",
- "hyper-util",
- "itoa",
- "matchit",
- "memchr",
- "mime",
- "multer",
- "percent-encoding",
- "pin-project-lite",
- "rustversion",
- "serde",
- "serde_json",
- "serde_path_to_error",
- "serde_urlencoded",
- "sync_wrapper",
- "tokio",
- "tower 0.5.3",
- "tower-layer",
- "tower-service",
- "tracing",
-]
-
-[[package]]
-name = "axum-core"
-version = "0.4.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "09f2bd6146b97ae3359fa0cc6d6b376d9539582c7b4220f041a33ec24c226199"
-dependencies = [
- "async-trait",
- "bytes",
- "futures-util",
- "http",
- "http-body",
- "http-body-util",
- "mime",
- "pin-project-lite",
- "rustversion",
- "sync_wrapper",
- "tower-layer",
- "tower-service",
- "tracing",
-]
-
-[[package]]
-name = "axum-macros"
-version = "0.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "57d123550fa8d071b7255cb0cc04dc302baa6c8c4a79f55701552684d8399bce"
-dependencies = [
- "proc-macro2",
- "quote",
- "syn",
-]
-
-[[package]]
-name = "base64"
-version = "0.22.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
-
-[[package]]
-name = "bitflags"
-version = "2.10.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "812e12b5285cc515a9c72a5c1d3b6d46a19dac5acfef5265968c166106e31dd3"
-
-[[package]]
-name = "bumpalo"
-version = "3.19.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5dd9dc738b7a8311c7ade152424974d8115f2cdad61e8dab8dac9f2362298510"
-
-[[package]]
-name = "bytes"
-version = "1.11.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b35204fbdc0b3f4446b89fc1ac2cf84a8a68971995d0bf2e925ec7cd960f9cb3"
-
-[[package]]
-name = "cc"
-version = "1.2.55"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "47b26a0954ae34af09b50f0de26458fa95369a0d478d8236d3f93082b219bd29"
-dependencies = [
- "find-msvc-tools",
- "shlex",
-]
-
-[[package]]
-name = "cfg-if"
-version = "1.0.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
-
-[[package]]
-name = "chrono"
-version = "0.4.43"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fac4744fb15ae8337dc853fee7fb3f4e48c0fbaa23d0afe49c447b4fab126118"
-dependencies = [
- "iana-time-zone",
- "js-sys",
- "num-traits",
- "serde",
- "wasm-bindgen",
- "windows-link",
-]
-
-[[package]]
-name = "compression-codecs"
-version = "0.4.36"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "00828ba
```

#### Recent Merged Pull Requests:
- **PR #1905** (2026-10-06): fix: point the links to the documentation at its new addresses (@lexoyo)
- **PR #1904** (2026-10-05): feat(desktop): tell the Linux distribution and desktop in error reports (@lexoyo)
- **PR #1903** (2026-10-05): fix(desktop): keep the whole AppImage environment away from the programs Silex runs (@lexoyo)
- **PR #1902** (2026-10-05): chore(deps): update dependencies to their latest version (@lexoyo)
- **PR #1901** (2026-10-05): fix(desktop): keep the AppImage env vars away from git CLI (@lexoyo)
- **PR #1900** (2026-10-04): fix(editor): select container and eleventy blocks on drop (@lexoyo)
- **PR #1897** (2026-10-05): feat(desktop): add a per-site state indicator in the application (@lexoyo)
- **PR #1896** (2026-10-05): fix(mcp): error on no-op remove/undo/redo, case-insensitive fonts_remove (@DangTAnh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
