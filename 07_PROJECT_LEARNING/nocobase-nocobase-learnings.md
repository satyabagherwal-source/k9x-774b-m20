# Forensic Learning Record (Deep Inspection): nocobase/nocobase

> **Canonical Artifact**: `07_PROJECT_LEARNING/nocobase-nocobase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nocobase/nocobase](https://github.com/nocobase/nocobase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:49:00.545Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nocobase/nocobase`
- **Description**: NocoBase is an open-source AI + no-code platform for building business systems fast. Instead of generating everything from scratch, AI works on top of production-proven infrastructure and a WYSIWYG no-code interface, so you get both speed and reliability.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 24462 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/core/acl/src/acl-available-action.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface AvailableActionOptions {
  /**
   * @deprecated
   */
  type?: 'new-data' | 'old-data';
  displayName?: string;
  aliases?: string[] | string;
  resource?: string;
  // 对新数据进行操作
  onNewRecord?: boolean;
  // 允许配置字段
  allowConfigureFields?: boolean;
}

export class ACLAvailableAction {
  constructor(public name: string, public options: AvailableActionOptions) {}
}

```

### Core Architecture Module: `packages/core/acl/src/acl-available-strategy.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import lodash from 'lodash';
import { ACL } from './acl';

type StrategyValue = false | '*' | string | string[];

export interface AvailableStrategyOptions {
  displayName?: string;
  actions?: false | string | string[];
  allowConfigure?: boolean;
  /**
   * @internal
   */
  resource?: '*';
}

export const predicate = {
  own: {
    filter: {
      createdById: '{{ ctx.state.currentUser.id }}',
    },
  },
  all: {},
};

export class ACLAvailableStrategy {
  acl: ACL;
  options: AvailableStrategyOptions;
  actionsAsObject: { [key: string]: string };

  allowConfigure: boolean;

  constructor(acl: ACL, options: AvailableStrategyOptions) {
    this.acl = acl;
    this.options = options;
    this.allowConfigure = options.allowConfigure;

    let actions = this.options.actions;
    if (lodash.isString(actions) && actions != '*') {
      actions = [actions];
    }

    if (lodash.isArray(actions)) {
      this.actionsAsObject = actions.reduce((carry, action) => {
        const [actionName, predicate] = action.split(':');
        carry[actionName] = predicate;
        return carry;
      }, {});
    }
  }

  matchAction(actionName: string) {
    if (this.options.actions == '*') {
      return true;
    }

    if (Object.prototype.hasOwnProperty.call(this.actionsAsObject || {}, actionName)) {
      const predicateName = this.actionsAsObject[actionName];
      if (predicateName) {
        return lodash.cloneDeep(predicate[predicateName]);
      }

      return true;
    }

    return false;
  }

  allow(resourceName: string, actionName: string) {
    return this.matchAction(this.acl.resolveActionAlias(actionName));
  }
}

```

### Core Architecture Module: `packages/core/acl/src/acl-resource.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ACLRole, RoleActionParams } from './acl-role';
import { ACL, ListenerContext } from './acl';
import lodash from 'lodash';

export type ResourceActions = { [key: string]: RoleActionParams };

interface AclResourceOptions {
  name: string;
  role: ACLRole;
  actions?: ResourceActions;
}

export class ACLResource {
  actions = new Map<string, RoleActionParams>();
  acl: ACL;
  role: ACLRole;
  name: string;

  constructor(options: AclResourceOptions) {
    this.acl = options.role.acl;

    this.role = options.role;
    this.name = options.name;

    const actionsOption: ResourceActions = options.actions || {};
    for (const actionName of Object.keys(actionsOption)) {
      this.actions.set(actionName, actionsOption[actionName]);
    }
  }

  getActions() {
    return Array.from(this.actions.keys()).reduce((carry, key) => {
      carry[key] = this.actions.get(key);
      return carry;
    }, {});
  }

  getAction(name: string) {
    const result = this.actions.get(name) || this.actions.get(this.acl.resolveActionAlias(name));
    if (!result) {
      return null;
    }

    if (Array.isArray(result.fields) && result.fields.length > 0) {
      result.fields = lodash.uniq(result.fields);
    }
    return lodash.cloneDeep(result);
  }

  setAction(name: string, params: RoleActionParams) {
    const context: ListenerContext = {
      role: this.role,
      acl: this.role.acl,
      params: params || {},
      path: `${this.name}:${name}`,
      resourceName: this.name,
      actionName: name,
    };

    this.acl.emit('beforeGrantAction', context);

    this.actions.set(name, context.params);
  }

  setActions(actions: ResourceActions) {
    for (const actionName of Object.keys(actions)) {
      this.setAction(actionName, actions[actionName]);
    }
  }

  removeAction(name: string) {
    this.actions.delete(name);
  }
}

```

### Core Architecture Module: `packages/core/acl/src/acl-role.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { default as _, default as lodash } from 'lodash';
import minimatch from 'minimatch';
import { ACL, DefineOptions } from './acl';
import { ACLAvailableStrategy, AvailableStrategyOptions } from './acl-available-strategy';
import { ACLResource } from './acl-resource';

export interface RoleActionParams {
  fields?: string[];
  filter?: any;
  own?: boolean;
  whitelist?: string[];
  blacklist?: string[];

  [key: string]: any;
}

export interface ResourceActionsOptions {
  [actionName: string]: RoleActionParams;
}

/**
 * @internal
 */
export class ACLRole {
  strategy: string | AvailableStrategyOptions;
  resources = new Map<string, ACLResource>();
  snippets: Set<string> = new Set();
  _snippetCache = {
    params: null,
    result: null,
  };

  constructor(
    public acl: ACL,
    public name: string,
  ) {}

  _serializeSet(set: Set<string>) {
    return JSON.stringify([...set].sort());
  }

  getResource(name: string): ACLResource | undefined {
    return this.resources.get(name);
  }

  public setStrategy(value: string | AvailableStrategyOptions) {
    this.strategy = value;
  }

  public getStrategy() {
    if (!this.strategy) {
      return null;
    }

    return lodash.isString(this.strategy)
      ? this.acl.availableStrategy.get(this.strategy)
      : new ACLAvailableStrategy(this.acl, this.strategy);
  }

  public getResourceActionsParams(resourceName: string) {
    const resource = this.getResource(resourceName);
    return resource.getActions();
  }

  public revokeResource(resourceName: string) {
    for (const key of [...this.resources.keys()]) {
      if (key === resourceName || key.includes(`${resourceName}.`)) {
        this.resources.delete(key);
      }
    }
  }

  public grantAction(path: string, options?: RoleActionParams) {
    let { resource } = this.getResourceActionFromPath(path);
    const { resourceName, actionName } = this.getResourceActionFromPath(path);

    if (!resource) {
      resource = new ACLResource({
        role: this,
        name: resourceName,
      });

      this.resources.set(resourceName, resource);
    }

    resource.setAction(actionName, options);
  }

  public getActionParams(path: string): RoleActionParams {
    const { action } = this.getResourceActionFromPath(path);
    return action;
  }

  public revokeAction(path: string) {
    const { resource, actionName } = this.getResourceActionFromPath(path);
    resource.removeAction(actionName);
  }

  public effectiveSnippets(): { allowed: Array<string>; rejected: Array<string> } {
    const currentParams = this._serializeSet(this.snippets);

    if (this._snippetCache.params === currentParams) {
      return this._snippetCache.result;
    }

    const allowedSnippets = new Set<string>();
    const rejectedSnippets = new Set<string>();

    const availableSnippets = this.acl.snippetManager.snippets;

    for (let snippetRule of this.snippets) {
      const negated = snippetRule.startsWith('!');
      snippetRule = negated ? snippetRule.slice(1) : snippetRule;

      for (const [_, availableSnippet] of availableSnippets) {
        if (minimatch(availableSnippet.name, snippetRule)) {
          if (negated) {
            rejectedSnippets.add(availableSnippet.name);
          } else {
            allowedSnippets.add(availableSnippet.name);
          }
        }
      }
    }

    // get difference of allowed and rejected snippets
    const effectiveSnippets = new Set([...allowedSnippets].filter((x) => !rejectedSnippets.has(x)));

    this._snippetCache = {
      params: currentParams,
      result: {
        allowed: [...effectiveSnippets],
        rejected: [...rejectedSnippets],
      },
    };

    return this._snippetCache.result;
  }

  public snippetAllowed(actionPath: string) {
    const effectiveSnippets = this.effectiveSnippets();

    const getActions = (snippets) => {
      return snippets.map((snippetName) => this.acl.snippetManager.snippets.get(snippetName).actions).flat();
    };

    const allowedActions = getActions(effectiveSnippets.allowed);
    const rejectedActions = getActions(effectiveSnippets.rejected);

    const actionMatched = (actionPath, actionRule) => {
      return minimatch(actionPath, actionRule);
    };

    for (const action of allowedActions) {
      if (actionMatched(actionPath, action)) {
        return true;
      }
    }

    for (const action of rejectedActions) {
      if (actionMatched(actionPath, action)) {
        return false;
      }
    }

    return null;
  }

  public toJSON(): DefineOptions {
    const actions = {};

    for (const resourceName of this.resources.keys()) {
      const resourceActions = this.getResourceActionsParams(resourceName);
      for (const actionName of Object.keys(resourceActions)) {
        actions[`${resourceName}:${actionName}`] = resourceActions[actionName];
      }
    }

    return _.cloneDeep({
      role: this.name,
      strategy: this.strategy,
      actions,
      snippets: Array.from(this.snippets),
    });
  }

  protected getResourceActionFromPath(path: string) {
    const [resourceName, actionName] = path.split(':');

    const resource = this.resources.get(resourceName);

    let action = null;

    if (resource) {
      action = resource.getAction(actionName);
    }

    return {
      resourceName,
      actionName,
      resource,
      action,
    };
  }
}

```

### Core Architecture Module: `packages/core/acl/src/acl.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Action } from '@nocobase/resourcer';
import { assign, parseFilter, Toposort, ToposortOptions } from '@nocobase/utils';
import EventEmitter from 'events';
import compose from 'koa-compose';
import lodash from 'lodash';
import { ACLAvailableAction, AvailableActionOptions } from './acl-available-action';
import { ACLAvailableStrategy, AvailableStrategyOptions, predicate } from './acl-available-strategy';
import { ACLRole, ResourceActionsOptions, RoleActionParams } from './acl-role';
import { AllowManager, ConditionFunc } from './allow-manager';
import { NoPermissionError } from './errors/no-permission-error';
import FixedParamsManager, { Merger, GeneralMerger } from './fixed-params-manager';
import SnippetManager, { SnippetOptions } from './snippet-manager';
import { mergeAclActionParams, removeEmptyParams } from './utils';
import Database from '@nocobase/database';

export interface CanResult {
  role: string;
  resource: string;
  action: string;
  params?: any;
}

export interface DefineOptions {
  role: string;
  /**
   * @internal
   */
  allowConfigure?: boolean;
  strategy?: string | AvailableStrategyOptions;
  actions?: ResourceActionsOptions;
  /**
   * @internal
   */
  routes?: any;
  snippets?: string[];
}

export interface ListenerContext {
  acl: ACL;
  role: ACLRole;
  path: string;
  actionName: string;
  resourceName: string;
  params: RoleActionParams;
}

type Listener = (ctx: ListenerContext) => void;

export type UserProvider = (args: { fields: string[] }) => Promise<any>;

export interface ParseJsonTemplateOptions {
  timezone?: string;
  state?: any;
  userProvider?: UserProvider;
}

interface CanArgs {
  role?: string;
  resource: string;
  action: string;
  rawResourceName?: string;
  ctx?: any;
  roles?: string[];
}

export interface ResolveActionParamsOptions {
  resourceName: string;
  actionName: string;
  rawResourceName?: string;
  params?: any;
  useCurrentRepository?: boolean;
}

export interface ResolvedActionParams {
  actionName: string;
  resourceName: string;
  rawResourceName: string;
  can: CanResult | null;
  rawParams: any;
  parsedParams?: any;
  mergedParams: any;
}

export class ACL extends EventEmitter {
  /**
   * @internal
   */
  public availableStrategy = new Map<string, ACLAvailableStrategy>();

  /**
   * @internal
   */
  public allowManager = new AllowManager(this);

  /**
   * @internal
   */
  public snippetManager = new SnippetManager();

  /**
   * @internal
   */
  roles = new Map<string, ACLRole>();

  /**
   * @internal
   */
  actionAlias = new Map<string, string>();

  protected availableActions = new Map<string, ACLAvailableAction>();

  protected fixedParamsManager = new FixedParamsManager();

  protected middlewares: Toposort<any>;

  protected strategyResources: Set<string> | null = null;

  constructor() {
    super();

    this.middlewares = new Toposort<any>();

    this.beforeGrantAction((ctx) => {
      if (lodash.isPlainObject(ctx.params) && ctx.params.own) {
        ctx.params = lodash.merge(ctx.params, predicate.own);
      }
    });

    this.beforeGrantAction((ctx) => {
      const actionName = this.resolveActionAlias(ctx.actionName);

      if (lodash.isPlainObject(ctx.params)) {
        if ((actionName === 'create' || actionName === 'update') && ctx.params.fields) {
          ctx.params = {
            ...lodash.omit(ctx.params, 'fields'),
            whitelist: ctx.params.fields,
          };
        }
      }
    });

    this.use(this.allowManager.aclMiddleware(), {
      tag: 'allow-manager',
      before: 'core',
    });

    this.addCoreMiddleware();
  }

  setStrategyResources(resources: Array<string> | null) {
    this.strategyResources = new Set(resources);
  }

  getStrategyResources() {
    return this.strategyResources ? [...this.strategyResources] : null;
  }

  appendStrategyResource(resource: string) {
    if (!this.strategyResources) {
      this.strategyResources = new Set();
    }
    this.strategyResources.add(resource);
  }

  removeStrategyResource(resource: string) {
    this.strategyResources.delete(resource);
  }

  define(options: DefineOptions): ACLRole {
    const roleName = options.role;
    const role = new ACLRole(this, roleName);

    if (options.strategy) {
      role.strategy = options.strategy;
    }

    const actions = options.actions || {};

    for (const [actionName, actionParams] of Object.entries(actions)) {
      role.grantAction(actionName, actionParams);
    }

    this.roles.set(roleName, role);

    return role;
  }

  getRole(name: string): ACLRole {
    return this.roles.get(name);
  }

  getRoles(names: string[]): ACLRole[] {
    return names.map((name) => this.getRole(name)).filter((x) => Boolean(x));
  }

  removeRole(name: string) {
    return this.roles.delete(name);
  }

  setAvailableAction(name: string, options: AvailableActionOptions = {}) {
    this.availableActions.set(name, new ACLAvailableAction(name, options));

    if (options.aliases) {
      const aliases = lodash.isArray(options.aliases) ? options.aliases : [options.aliases];
      for (const alias of aliases) {
        this.actionAlias.set(alias, name);
      }
    }
  }

  getAvailableAction(name: string) {
    const actionName = this.actionAlias.get(name) || name;
    return this.availableActions.get(actionName);
  }

  getAvailableActions() {
    return this.availableActions;
  }

  setAvailableStrategy(name: string, options: AvailableStrategyOptions) {
    this.availableStrategy.set(name, new ACLAvailableStrategy(this, options));
  }

  beforeGrantAction(listener?: Listener) {
    this.addListener('beforeGrantAction', listener);
  }

  can(options: CanArgs): CanResult | null {
    if (options.role) {
      return lodash.cloneDeep(this.getCanByRole(options));
    }
    if (options.roles?.length) {
      if (options.roles.includes('root')) {
        options.roles = ['root'];
      }
      return lodash.cloneDeep(this.getCanByRoles(options));
    }

    return null;
  }

  private getCanByRoles(options: CanArgs) {
    let canResult: CanResult | null = null;

    for (const role of options.roles) {
      const result = this.getCanByRole({
        role,
        ...options,
      });
      if (!canResult) {
        canResult = result;
        canResult && removeEmptyParams(canResult.params);
      } else if (canResult && result) {
        canResult.params = mergeAclActionParams(canResult.params, result.params);
      }
    }

    return canResult;
  }

  private getCanByRole(options: CanArgs) {
    const { role, resource, action, rawResourceName } = options;
    const aclRole = this.roles.get(role);

    if (!aclRole) {
      return null;
    }

    if (role === 'root') {
      return {
        resource,
        action,
        role,
      };
    }

    const actionPath = `${rawResourceName ? rawResourceName : resource}:${action}`;
    const snippetAllowed = aclRole.snippetAllowed(actionPath);

    const fixedParams = this.fixedParamsManager.getParams(rawResourceName ? rawResourceName : resource, action);

    const mergeParams = (result: CanResult) => {
      const params = result['params'] || {};

      const mergedParams = assign(params, fixedParams);

      if (Object.keys(mergedParams).length) {
        result['params'] = mergedParams;
      } else {
        delete result['params'];
      }

      return result;
    };

    const aclResource = aclRole.getResource(resource);

    if (aclResource) {
      const actionParams = aclResource.getAction(action);

      if (actionParams) {
        // handle single action config
        return mergeParams({
          role,
          resource,
          action,
          params: actionParams,
        });
      } else {
        return null;
      }
    }

    const roleStrategy = aclRole.getStrategy();

    if (!roleStrategy && !snippetAllowed) {
      return null;
    }

    let roleStrategyParams;

    if (this.strategyResources === null || this.strategyResources.has(resource)) {
      roleStrategyParams = roleStrategy?.allow(resource, this.resolveActionAlias(action));
    }

    if (!roleStrategyParams && snippetAllowed) {
      roleStrategyParams = {};
    }

    if (roleStrategyParams) {
      const result = { role, resource, action, params: {} };

      if (lodash.isPlainObject(roleStrategyParams)) {
        result['params'] = roleStrategyParams;
      }

      return mergeParams(result);
    }

    return null;
  }

  /**
   * @internal
   */
  public resolveActionAlias(action: string) {
    return this.actionAlias.get(action) ? this.actionAlias.get(action) : action;
  }

  use(fn: any, options?: ToposortOptions) {
    this.middlewares.add(fn, {
      group: 'prep',
      ...options,
    });
  }

  allow(resourceName: string, actionNames: string[] | string, condition?: string | ConditionFunc) {
    return this.skip(resourceName, actionNames, condition);
  }

  /**
   * @deprecated
   */
  skip(resourceName: string, actionNames: string[] | string, condition?: string | ConditionFunc) {
    if (!condition) {
      condition = 'public';
    }

    if (!Array.isArray(actionNames)) {
      actionNames = [actionNames];
    }

    for (const actionName of actionNames) {
      this.allowManager.allow(resourceName, actionName, condition);
    }
  }

  middleware() {
    const acl = this;

    return async function ACLMiddleware(ctx, next) {
      ctx.acl = acl;

      const roleName = ctx.state.currentRole || 'anonymous';
      const { resourceName: rawResourceName, actionName } = ctx.action;
      const resourceName = resolveResourceName(ctx, rawResourceName, true);

      ctx.can = (options: Omit<CanArgs, 'role'>) => {
        const roles = ctx.state.currentRoles || [roleName];
    
```

### Core Architecture Module: `packages/core/acl/src/allow-manager.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ACL } from './acl';

export type ConditionFunc = (ctx: any) => Promise<boolean> | boolean;

export class AllowManager {
  protected skipActions = new Map<string, Map<string, string | ConditionFunc | true>>();

  protected registeredCondition = new Map<string, ConditionFunc>();

  isPublicCondition = () => {
    return true;
  };

  constructor(public acl: ACL) {
    this.registerAllowCondition('loggedIn', (ctx) => {
      return ctx.state.currentUser;
    });

    this.registerAllowCondition('public', this.isPublicCondition);

    this.registerAllowCondition('allowConfigure', async (ctx) => {
      const roleName = ctx.state.currentRole;
      if (!roleName) {
        return false;
      }

      const role = acl.getRole(roleName);
      if (!role) {
        return false;
      }

      return role.getStrategy()?.allowConfigure;
    });
  }

  allow(resourceName: string, actionName: string, condition?: string | ConditionFunc) {
    const actionMap = this.skipActions.get(resourceName) || new Map<string, string | ConditionFunc>();
    actionMap.set(actionName, condition || true);

    this.skipActions.set(resourceName, actionMap);
  }

  getAllowedConditions(resourceName: string, actionName: string): Array<ConditionFunc | true> {
    const fetchActionSteps: string[] = ['*', resourceName];

    const results = [];

    for (const fetchActionStep of fetchActionSteps) {
      const resource = this.skipActions.get(fetchActionStep);
      if (resource) {
        for (const fetchActionStep of ['*', actionName]) {
          const condition = resource.get(fetchActionStep);
          if (condition) {
            results.push(typeof condition === 'string' ? this.registeredCondition.get(condition) : condition);
          }
        }
      }
    }

    return results;
  }

  registerAllowCondition(name: string, condition: ConditionFunc) {
    this.registeredCondition.set(name, condition);
  }

  async isPublic(resourceName: string, actionName: string, ctx: any) {
    const skippedConditions = this.getAllowedConditions(resourceName, actionName);
    for (const skippedCondition of skippedConditions) {
      if (skippedCondition === this.isPublicCondition) {
        return true;
      }
    }
    return false;
  }

  async isAllowed(resourceName: string, actionName: string, ctx: any) {
    const skippedConditions = this.getAllowedConditions(resourceName, actionName);

    for (const skippedCondition of skippedConditions) {
      if (skippedCondition) {
        let skipResult = false;

        if (typeof skippedCondition === 'function') {
          skipResult = await skippedCondition(ctx);
        } else if (skippedCondition) {
          skipResult = true;
        }

        if (skipResult) {
          return true;
        }
      }
    }

    return false;
  }

  aclMiddleware() {
    return async (ctx, next) => {
      const { resourceName, actionName } = ctx.action;
      const skip = await this.acl.allowManager.isAllowed(resourceName, actionName, ctx);

      if (skip) {
        ctx.permission = {
          ...(ctx.permission || {}),
          skip: true,
        };
      }

      await next();
    };
  }
}

```

### Core Architecture Module: `packages/core/acl/src/errors/index.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export * from './no-permission-error';

```

### Core Architecture Module: `packages/core/acl/src/errors/no-permission-error.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export class NoPermissionError extends Error {}

```

### Core Architecture Module: `packages/core/acl/src/fixed-params-manager.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assign } from '@nocobase/utils';

type Context = any;
export type Merger = () => object;
export type GeneralMerger = (resource: string, action: string) => object;

export type ActionPath = string;

const SPLIT = ':';

export default class FixedParamsManager {
  merger = new Map<ActionPath, Array<Merger>>();
  generalMergers: Array<GeneralMerger> = [];

  addParams(resource: string, action: string, merger: Merger) {
    const path = this.getActionPath(resource, action);
    this.merger.set(path, [...this.getParamsMerger(resource, action), merger]);
  }

  addGeneralParams(merger: GeneralMerger) {
    this.generalMergers.push(merger);
  }

  getParamsMerger(resource: string, action: string) {
    const path = this.getActionPath(resource, action);
    return this.merger.get(path) || [];
  }

  protected getActionPath(resource: string, action: string) {
    return `${resource}${SPLIT}${action}`;
  }

  getParams(resource: string, action: string, extraParams: any = {}) {
    const results = {};

    for (const merger of this.generalMergers) {
      FixedParamsManager.mergeParams(results, merger(resource, action));
    }

    for (const merger of this.getParamsMerger(resource, action)) {
      FixedParamsManager.mergeParams(results, merger());
    }

    if (extraParams) {
      FixedParamsManager.mergeParams(results, extraParams);
    }

    return results;
  }

  static mergeParams(a: any, b: any) {
    assign(a, b, {
      filter: 'andMerge',
      fields: 'intersect',
      appends: 'union',
      except: 'union',
      whitelist: 'intersect',
      blacklist: 'intersect',
      sort: 'overwrite',
    });
  }
}

```

### Core Architecture Module: `packages/core/acl/src/index.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export * from './acl';
export * from './acl-available-action';
export * from './acl-available-strategy';
export * from './acl-resource';
export * from './acl-role';
export * from './skip-middleware';
export * from './errors';
export * from './utils';

```

### Core Architecture Module: `packages/core/acl/src/skip-middleware.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const skip = (options: ACLSkipOptions) => {
  return async function ACLSkipMiddleware(ctx, next) {
    const { resourceName, actionName } = ctx.action;
    if (resourceName === options.resourceName && actionName === options.actionName) {
      ctx.permission = {
        skip: true,
      };
    }
    await next();
  };
};

interface ACLSkipOptions {
  resourceName: string;
  actionName: string;
}

```

### Core Architecture Module: `packages/core/acl/src/snippet-manager.ts`
```
/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import minimatch from 'minimatch';

export type SnippetOptions = {
  name: string;
  actions: Array<string>;
};

class Snippet {
  constructor(
    public name: string,
    public actions: Array<string>,
  ) {}
}

export type SnippetGroup = {
  name: string;
  snippets: SnippetOptions[];
};

class SnippetManager {
  public snippets: Map<string, Snippet> = new Map();

  register(snippet: SnippetOptions) {
    snippet.name = snippet.name.replace('.*', '');

    // throw error if name include * or end with dot
    if (snippet.name.includes('*') || snippet.name.endsWith('.')) {
      throw new Error(`Invalid snippet name: ${snippet.name}, name should not include * or end with dot.`);
    }

    const existed = this.snippets.get(snippet.name);
    if (existed) {
      existed.actions = Array.from(new Set([...existed.actions, ...snippet.actions]));
    } else {
      this.snippets.set(snippet.name, snippet);
    }
  }

  allow(actionPath: string, snippetName: string) {
    const negated = snippetName.startsWith('!');
    snippetName = negated ? snippetName.slice(1) : snippetName;

    const snippet = this.snippets.get(snippetName);

    if (!snippet) {
      return null;
    }

    const matched = snippet.actions.some((action) => minimatch(actionPath, action));

    if (matched) {
      return negated ? false : true;
    }

    return null;
  }
}

export default SnippetManager;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8512** (2026-03-19): **三级菜单浏览器标签不显示菜单名称**
  *Symptoms*: <img width="133" height="47" alt="Image" src="https://github.com/user-attachments/assets/182c223b-0962-43b5-9381-28f5bcd7b1d7" />  版本 v2.0.0-beta.14  然后分组只要超过三层,点击菜单后,浏览器标签栏的名称是不会联动的,二层及一层是正常的
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the issue. Please wait while we fix it.
  > The bug has been fixed. Please upgrade to the latest version and check if the problem is resolved.Back up your database before upgrading.

- **Issue #8346** (2026-01-13): **nocobase crm demo import**
  *Symptoms*:   ## * Describe the bug  nocobase v2.0.0-alpha.61 has been installed with brand new database and imported the provided crm database .sql and the ui templates wont load   <img width="1920" height="869" alt="Image" src="https://github.com/user-attachments/assets/23923a7e-10fc-4c6b-b129-8aaa113602a4" /> <img width="1918" height="809" alt="Image" src="https://github.com/user-attachments/assets/448ca498-6d10-4595-ba5a-ad90feeddfd5" />   screenshots attached for reference 
  **Post-Mortem & Fix Analysis**:
  > Please explain the order of installing NocoBase and importing the SQL file, the detailed commands executed, and whether there were any errors in each command step.
  > the database was imported via command line.  node v20x postgres v16  no problem during   yarn install  yarn nocobase install yarn nocobase build  i tried signing up for free nocobase account even the provided nocobase live solution from your company ui templates when configured will not work  there is core problem with the module itself 
  > The CRM database is an older version; you will need to go through the upgrade process and refer to the official upgrade documentation.

- **Issue #8178** (2026-01-23): **Page v2 Tabs not hiding corresponding to route permissions**
  *Symptoms*: <!--  First off, thank you for reporting bugs.  Please do not clear the contents of the issue template. Items marked with * are required. Issues not filled out according to the template will be closed.   Please communicate in English, and post content in other languages to NocoBase Forum https://forum.nocobase.com/. Non-English issues will be closed. -->  ## * Describe the bug  When creating a v2 page with tabs and setting route permissions for those tabs, said permissions are not applied and every tab stays visible  ## * Environment  <!-- Please view it by clicking on the ? icon in the upper right corner of the NocoBase navigation bar. --> - NocoBase version: v2.0.0-alpha.53  <!-- [e.g. PostgreSQL 12, MySQL 8.x, SQLite] --> - Database type and version: PostgreSQL 16    <!-- [e.g. MacOS, Windows] --> - OS: Linux  <!-- Docker, Create-nocobase-app, Git source code --> - Deployment Methods: Docker  <!-- If using Docker for deployment, please provide. [e.g. nocobase/nocobase:latest] --> - Docker image version: nocobase/nocabase:alpha-full   ## * How To Reproduce  Create a v2 Page and set route permissions like in the following screenshot:  <img width="1239" height="278" alt="Image" src="https://github.com/user-attachments/assets/8f5e93be-b3aa-4ffa-a4ee-0a50dbd9de7d" /> Note, that the "1" tab on the v2 page is not even shown in the permissions menu  <img width="769" height="140" alt="Image" src="https://github.com/user-attachments/assets/2c576b75-2720-4f17-a7e5-74ca1531703d" />  #
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the issue. Please wait while we fix it.
  > The bug has been fixed. Please upgrade to the latest version and check if the problem is resolved.

- **Issue #8116** (2026-03-19): **SubTable--The drawer closes every time a block is configured.**
  *Symptoms*: <!--  First off, thank you for reporting bugs.  Please do not clear the contents of the issue template. Items marked with * are required. Issues not filled out according to the template will be closed.   Please communicate in English, and post content in other languages to NocoBase Forum https://forum.nocobase.com/. Non-English issues will be closed. -->  ## * Describe the bug 1: Add a form block 2: Add a one-to-many relationship field 3: Select the field component as a sub-table 4: Add a list for the one-to-many relationship 5: Select the field component as a data selector 6: Configure the form in the drawer popped up by the data selector; whenever blocks are added, deleted, or dragged, the popped-up drawer will close  <!-- A clear and concise description of what the bug is. -->  ## * Environment  <!-- Please view it by clicking on the ? icon in the upper right corner of the NocoBase navigation bar. --> - NocoBase version: v2.0.0-alpha.51.20251207152825 <!-- [e.g. PostgreSQL 12, MySQL 8.x, SQLite] --> - Database type and version:    Accessing the official website example https://a_shcz8vjo5tc.v13.demo.nocobase.com/admin/auu7ixevcxq <!-- [e.g. MacOS, Windows] --> - OS:   Accessing the official website example https://a_shcz8vjo5tc.v13.demo.nocobase.com/admin/auu7ixevcxq <!-- Docker, Create-nocobase-app, Git source code --> - Deployment Methods:   Accessing the official website example https://a_shcz8vjo5tc.v13.demo.nocobase.com/admin/auu7ixevcxq <!-- If using Docker for deplo
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the issue. Please wait while we fix it.
  > The bug has been fixed. Please upgrade to the latest version and check if the problem is resolved.Back up your database before upgrading.

- **Issue #8014** (2026-05-08): **Field linkage rules not working on form submit button (V2 alpha 49)**
  *Symptoms*: <!--  First off, thank you for reporting bugs.  Please do not clear the contents of the issue template. Items marked with * are required. Issues not filled out according to the template will be closed.   Please communicate in English, and post content in other languages to NocoBase Forum https://forum.nocobase.com/. Non-English issues will be closed. -->  ## * Describe the bug  I have a form to add a new record and I created a linkage rule to disable the submit button based on certain form field content. However, this does not seem to be working.   ## * Environment  V2 alpha 49  <!-- [e.g. PostgreSQL 12, MySQL 8.x, SQLite] --> - Database type and version:    Nocobase main database  <!-- [e.g. MacOS, Windows] --> - OS: Macos (helium browser)  <!-- Docker, Create-nocobase-app, Git source code --> - Deployment Methods: Docker  <!-- If using Docker for deployment, please provide. [e.g. nocobase/nocobase:latest] --> - Docker image version: alpha-full  <!-- If using Create-nocobase-app or Git source code for deployment, please provide. --> - NodeJS version:   ## * How To Reproduce  Create a form to add a new record and include a text field in the form. Then create a linkage rule on the submit button that should disable the submit button Based on a "contains" rule for the text field.   ## Expected behavior  When the text field contains the text in the linkage rule, the submit button should be disabled.   ## Screenshots    ## Logs  <!-- If it's an API error, please provide the releva
  **Post-Mortem & Fix Analysis**:
  > Please provide a screenshot of the link rule configuration.
  > For example, the following linkage rules work as expected to disable form fields:  <img width="1257" height="759" alt="Image" src="https://github.com/user-attachments/assets/af544686-b9eb-4f54-b148-dc6f0965e92c" />  However, the samen does not work with the form submit button:  <img width="1247" height="737" alt="Image" src="https://github.com/user-attachments/assets/e5d1f95d-7cff-436f-8c8a-193da3e1cf95" />  
  > Thank you for reporting the issue. Please wait while we fix it.

- **Issue #7942** (2026-01-23): **Duplicate error: "The field value is required" when deleting a value in cascade select type**
  *Symptoms*: <!--  First off, thank you for reporting bugs.  Please do not clear the contents of the issue template. Items marked with * are required. Issues not filled out according to the template will be closed.   Please communicate in English, and post content in other languages to NocoBase Forum https://forum.nocobase.com/. Non-English issues will be closed. -->  ## * Describe the bug  <!-- A clear and concise description of what the bug is. -->  ## * Environment  <!-- Please view it by clicking on the ? icon in the upper right corner of the NocoBase navigation bar. --> - NocoBase version: 1.8.23  <!-- [e.g. PostgreSQL 12, MySQL 8.x, SQLite] --> - Database type and version:     <!-- [e.g. MacOS, Windows] --> - OS:  <!-- Docker, Create-nocobase-app, Git source code --> - Deployment Methods:  <!-- If using Docker for deployment, please provide. [e.g. nocobase/nocobase:latest] --> - Docker image version:  <!-- If using Create-nocobase-app or Git source code for deployment, please provide. --> - NodeJS version:   ## * How To Reproduce  <!-- Please describe the reproduction process in as much detail as possible. -->  ## Expected behavior  <!-- A clear and concise description of what you expected to happen. -->  ## Screenshots  <img width="402" height="105" alt="Image" src="https://github.com/user-attachments/assets/4e8d05d2-cecd-431f-8a51-8c963a5b5588" />  ## Logs  <!-- If it's an API error, please provide the relevant server logs. --> 
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the issue. Please wait while we fix it.
  > The bug has been fixed. Please upgrade to the latest version and check if the problem is resolved.

- **Issue #7873** (2026-01-23): **[Bug] NocoBase v2.0.0-alpha.39 | Error migrating to new Multi-app**
  *Symptoms*: <!--  First off, thank you for reporting bugs.  Please do not clear the contents of the issue template. Items marked with * are required. Issues not filled out according to the template will be closed.   Please communicate in English, and post content in other languages to NocoBase Forum https://forum.nocobase.com/. Non-English issues will be closed. -->  ## * Describe the bug  Trying to upgrade from the "Multi-app manager (deprecated)" using the "Migrate data to new multi-app" feature on the page https://127.0.0.1:13000/admin/settings/multi-app-manager resolves in an error.  `Cannot find module 'multi-app/package.json' Require stack: - /app/nocobase/node_modules/@nocobase/preset-nocobase/lib/server/index.js - /app/nocobase/node_modules/@nocobase/utils/lib/requireModule.js - /app/nocobase/node_modules/@nocobase/utils/lib/index.js - /app/nocobase/node_modules/@nocobase/server/lib/app-supervisor.js - /app/nocobase/node_modules/@nocobase/server/lib/index.js - /app/nocobase/node_modules/@nocobase/app/lib/index.js`  ## * Environment  <!-- Please view it by clicking on the ? icon in the upper right corner of the NocoBase navigation bar. --> - NocoBase version: NocoBase v2.0.0-alpha.39  <!-- [e.g. PostgreSQL 12, MySQL 8.x, SQLite] --> - Database type and version: n/a (PostgresSQL 10)    <!-- [e.g. MacOS, Windows] --> - OS: n/a (linux Ubuntu 24.04)  <!-- Docker, Create-nocobase-app, Git source code --> - Deployment Methods: docker-compose  <!-- If using Docker for deployment, please 
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the issue. Please wait while we fix it.
  > The bug has been fixed. Please upgrade to the latest version and check if the problem is resolved.

- **Issue #7863** (2025-11-28): **Custom storage not used for file fields; uploads always go to default storage (v2.0.0-alpha.38)**
  *Symptoms*: * Describe the bug  When adding a file attachment field inside a collection and changing its storage to a non-default storage provider, uploaded files are still saved to the default storage, not the selected one.  This behavior occurs in v2.0.0-alpha.38. The issue does not occur in v1.9.6, where files are correctly stored in the configured custom storage.  * Environment  NocoBase version: v2.0.0-alpha.38  Database type and version: PostgreSQL  OS: Windows 10  Deployment Methods: Docker   * How To Reproduce  Create a collection/table.  Add a field of type File or Attachment.  Edit the field configuration and change its Storage to a storage provider different from the default one.  Save the configuration.  Create a new record and upload any file.  Inspect the upload location.  Observed: Files are always stored in the default storage, ignoring the storage provider configured for the field.  Expected behavior  Files should be stored in the storage provider selected in the field configuration, not the default one. 
  **Post-Mortem & Fix Analysis**:
  > I analyzed the issue further and discovered that it only occurs on pages created using Modern Page. When performing the same operation on a Classic Page, the problem does not occur.
  > Thank you for reporting the issue. Please wait while we fix it.
  > The bug has been fixed. Please upgrade to the latest version and check if the problem persists. https://github.com/nocobase/nocobase/pull/7947

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

### Incident Patch 1: `5b47bec1` (2026-10-05)
**Commit Message**: fix(client-v2): keep empty cardless JS blocks accessible in the UI editor (#10563)

* fix(client-v2): keep empty cardless JS blocks accessible in the UI editor

* refactor(client-v2): pass JS block editor min height as a prop

The model's reactive render wrapper already re-renders on UI editor
toggles, so the extra observer wrapper is unnecessary. Use the theme's
controlHeightLG token instead of a hard-coded value.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/core/client-v2/src/flow/models/blocks/js-block/JSBlock.tsx` (modified, +5/-1)
```diff
@@ -152,6 +152,7 @@ const JSBlockPlainHost = ({
   afterContent,
   contentRef,
   marginBlock,
+  minHeight,
   ...rest
 }: React.HTMLAttributes<HTMLDivElement> & {
   uid: string;
@@ -161,6 +162,7 @@ const JSBlockPlainHost = ({
   afterContent?: React.ReactNode;
   contentRef: React.RefObject<HTMLDivElement>;
   marginBlock: number;
+  minHeight: number;
 }) => {
   const hostRef = React.useRef<HTMLDivElement | null>(null);
   const resolvedHeight = usePlainHostHeight({ height, heightMode, hostRef, marginBlock });
@@ -175,7 +177,7 @@ const JSBlockPlainHost = ({
         display: 'flex',
         flexDirection: 'column',
         height: resolvedHeight ?? undefined,
-        minHeight: 0,
+        minHeight,
         overflow: 'auto',
         ...(style || {}),
       }}
@@ -228,6 +230,8 @@ export class JSBlockModel extends BlockModel {
           afterContent={afterContent}
           contentRef={this.context.ref}
           marginBlock={this.context.themeToken?.marginBlock ?? 0}
+          // Keep empty blocks reachable by the settings overlay while the UI editor is active.
+          minHeight={this.context.flowSettingsEnabled ? this.context.themeToken?.controlHeightLG ?? 40 : 0}
         />
       );
     }
```

**File**: `packages/core/client-v2/src/flow/models/blocks/js-block/__tests__/JSBlockModel.test.tsx` (modified, +23/-1)
```diff
@@ -9,7 +9,7 @@
 
 import React from 'react';
 import { App, ConfigProvider } from 'antd';
-import { render } from '@nocobase/test/client';
+import { act, render, waitFor } from '@nocobase/test/client';
 import { describe, expect, it, vi } from 'vitest';
 import { FlowEngine, FlowEngineProvider } from '@nocobase/flow-engine';
 import { JSBlockModel } from '../JSBlock';
@@ -78,6 +78,28 @@ describe('JSBlockModel', () => {
     expect(model.context.ref.current).toBe(host?.firstElementChild);
   });
 
+  it('keeps an empty cardless block reachable only while the UI editor is active', async () => {
+    const { engine, model } = createJSBlock('js-block-empty-without-card', false, { style: undefined });
+    await engine.flowSettings.disable();
+    const { container } = renderBlock(engine, model);
+    const host = container.querySelector('#model-js-block-empty-without-card') as HTMLElement;
+    const content = model.context.ref.current;
+
+    expect(host.style.minHeight).toBe('0');
+    await act(async () => {
+      await engine.flowSettings.enable();
+    });
+    await waitFor(() => expect(host.style.minHeight).toBe('40px'));
+    expect(model.context.ref.current).toBe(content);
+    expect(container.querySelector('.ant-card')).toBeNull();
+
+    await act(async () => {
+      await engine.flowSettings.disable();
+    });
+    await waitFor(() => expect(host.style.minHeight).toBe('0'));
+    expect(model.context.ref.current).toBe(content);
+  });
+
   it('keeps cardless specified-height content scrollable inside the plain host', () => {
     const { engine, model } = createJSBlock('js-block-without-card-height', false, {
       heightMode: 'specifyValue',
```

---

### Incident Patch 2: `1c47410e` (2026-10-05)
**Commit Message**: fix(plugin-ui-templates): hide template collection from block choices (#10561)

**File**: `packages/plugins/@nocobase/plugin-ui-templates/src/client-v2/__tests__/FlowModelTemplatesPage.visibility.test.tsx` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+/**
+ * This file is part of the NocoBase (R) project.
+ * Copyright (c) 2020-2024 NocoBase Co., Ltd.
+ * Authors: NocoBase Team.
+ *
+ * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
+ * For more information, please refer to: https://www.nocobase.com/agreement.
+ */
+
+import React from 'react';
+import { App } from 'antd';
+import { FlowEngineProvider } from '@nocobase/flow-engine';
+import { createMockClient } from '@nocobase/client-v2';
+import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { FlowModelTemplatesPage } from '../components/FlowModelTemplatesPage';
+
+afterEach(cleanup);
+
+describe('FlowModelTemplatesPage collection visibility', () => {
+  it.each(['block', 'popup'] as const)(
+    'keeps the %s template collection out of block choices after deletion',
+    async (templateType) => {
+      const app = createMockClient();
+      app.apiMock.onGet('app:getInfo').reply(200, { data: { version: 'test' } });
+      const main = app.dataSourceManager.getDataSource('main');
+      main.addCollection({ name: 'posts', fields: [{ name: 'title', type: 'string', interface: 'input' }] });
+      const list = vi
+        .fn()
+        .mockResolvedValue({ data: { rows: [{ uid: 'tpl-1', name: 'Template A', usageCount: 0 }], count: 1 } });
+      const destroy = vi.fn().mockResolvedValue(undefined);
+      app.flowEngine.context.defineProperty('api', {
+        value: { resource: () => ({ list, destroy }) },
+      });
+      const { unmount } = render(
+        <App>
+          <FlowEngineProvider engine={app.flowEngine}>
+            <FlowModelTemplatesPage templateType={templateType} />
+          </FlowEngineProvider>
+        </App>,
+      );
+      expect(await screen.findByText('Template A')).toBeTruthy();
+      const assertHidden = () => {
+        expect(main.getCollection('flowModelTemplates')?.getField('name')).toBeDefined();
+        expect(main.getCollections().map((collection) => collection.name)).toContain('posts');
+        expect(main.getCollections().map((collection) => collection.name)).not.toContain('flowModelTemplates');
+      };
+      assertHidden();
+      list.mockResolvedValue({ data: { rows: [], count: 0 } });
+      fireEvent.click(screen.getByRole('button', { name: /Delete$/ }));
+      fireEvent.click(await screen.findByRole('button', { name: /OK/ }));
+      await waitFor(() => expect(destroy).toHaveBeenCalledWith({ filterByTk: 'tpl-1' }));
+      await waitFor(() => expect(screen.queryByText('Template A')).toBeNull());
+      assertHidden();
+      unmount();
+      expect(main.getCollection('flowModelTemplates')).toBeUndefined();
+      expect(main.getCollection('posts')).toBeDefined();
+    },
+  );
+});
```

**File**: `packages/plugins/@nocobase/plugin-ui-templates/src/client-v2/components/FlowModelTemplatesPage.tsx` (modified, +1/-0)
```diff
@@ -82,6 +82,7 @@ const FLOW_MODEL_TEMPLATE_FILTER_FIELD_NAMES = [
 
 const flowModelTemplatesCollection: CollectionOptions = {
   name: FLOW_MODEL_TEMPLATES_COLLECTION_NAME,
+  hidden: true,
   filterTargetKey: 'uid',
   fields: [
     {
```

---

### Incident Patch 3: `81abd940` (2026-09-30)
**Commit Message**: fix(deps): upgrade axios to 1.20.0 (#10566)

* fix(deps): upgrade axios to 1.20.0

main resolves axios@^1.7.0 to 1.7.7 and axios@^1.7.8 to 1.7.9, which
carry 30 known advisories between them -- SSRF, credential leakage,
prototype pollution and DoS -- and has done so for over two months.
^1.7.0 is the entry the nine workspaces declare, so it is what
@nocobase/sdk and every APIClient request actually run on.

develop meanwhile fails its declaration build:

  APIClient.ts:175 - error TS2322: Type 'Promise<AxiosResponseResult<T, R, D, any>>'
  is not assignable to type 'Promise<R>'

Both have one cause. develop drifted to axios 1.20.0 on 2026-09-24 in
f9f77620be, a next -> develop sync where yarn install was re-run to
resolve a lockfile conflict, re-resolving the whole file to whatever was
latest on npm. 1.20.0 carries no advisories, so the drift accidentally
fixed the security problem, but axios 1.19.0 had changed request() from
three generics returning Promise<R> to four returning
Promise<AxiosResponseResult<T, R, D, P>>, and the declared type stopped
matching.

Fixing it here and letting it flow main -> next -> develop closes the
advisories on the release branch, the type build on d

**File**: `packages/core/sdk/src/APIClient.ts` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ export class APIClient {
     if (resource) {
       return this.resource(resource, resourceOf, headers)[action](params);
     }
-    return this.axios.request<T, R, D>(config);
+    return this.axios.request<T, R, D>(config) as Promise<R>;
   }
 
   resource(name: string, of?: any, headers?: RawAxiosRequestHeaders, cancel?: boolean): IResource {
```

**File**: `packages/plugins/@nocobase/plugin-file-manager/src/server/storages/index.ts` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ export abstract class StorageType {
 
       return {
         stream: response.data,
-        contentType: response.headers['content-type'],
+        contentType: response.headers['content-type'] as string | undefined,
       };
     } catch (err) {
       throw new Error(`fetch file failed: ${err}`);
```

**File**: `yarn.lock` (modified, +6/-25)
```diff
@@ -12772,34 +12772,16 @@ axios@^0.18.1:
     follow-redirects "1.5.10"
     is-buffer "^2.0.2"
 
-axios@^1.4.0, axios@^1.8.2:
-  version "1.18.1"
-  resolved "https://registry.npmjs.org/axios/-/axios-1.18.1.tgz#d63f9863bcd8938815c86f9e2abd380189d96dfe"
-  integrity sha512-3nTvFlvpn9Zu/RkHUqtc7/+al4UpRW5az71ap5zccp6e8RAYEzhMTecX8Dz1wWDYrPpUoB1HAQEGEAEvUr7S9g==
+axios@^1.4.0, axios@^1.7.0, axios@^1.7.8, axios@^1.8.2:
+  version "1.20.0"
+  resolved "https://registry.npmjs.org/axios/-/axios-1.20.0.tgz#515513445aa60e71d04b6521ca6210829ccb4786"
+  integrity sha512-r8aOh8j9cGKpgQAqpzrUHnSIc6a59Y3Xf/cv8sy1DrHCkZHzQGEuoq1tARk6qSyDdtQGSDgpb9kFlruzPvrgwg==
   dependencies:
     follow-redirects "^1.16.0"
-    form-data "^4.0.5"
+    form-data "^4.0.6"
     https-proxy-agent "^5.0.1"
     proxy-from-env "^2.1.0"
 
-axios@^1.7.0:
-  version "1.7.7"
-  resolved "https://registry.npmmirror.com/axios/-/axios-1.7.7.tgz#2f554296f9892a72ac8d8e4c5b79c14a91d0a47f"
-  integrity sha512-S4kL7XrjgBmvdGut0sN3yJxqYzrDOnivkBiN0OFs6hLiUam3UPvswUo0kqGyhqUZGEOytHyumEdXsAkgCOUf3Q==
-  dependencies:
-    follow-redirects "^1.15.6"
-    form-data "^4.0.0"
-    proxy-from-env "^1.1.0"
-
-axios@^1.7.8:
-  version "1.7.9"
-  resolved "https://registry.npmmirror.com/axios/-/axios-1.7.9.tgz#d7d071380c132a24accda1b2cfc1535b79ec650a"
-  integrity sha512-LhLcE7Hbiryz8oMDdDptSrWowmB4Bl6RCt6sIJKpRB4XtVf0iEgewX3au/pJqm+Py1kCASkb/FFKjxQaLtxJvw==
-  dependencies:
-    follow-redirects "^1.15.6"
-    form-data "^4.0.0"
-    proxy-from-env "^1.1.0"
-
 b4a@^1.6.4:
   version "1.6.4"
   resolved "https://registry.npmmirror.com/b4a/-/b4a-1.6.4.tgz#ef1c1422cae5ce6535ec191baeed7567443f36c9"
@@ -19111,7 +19093,7 @@ form-data@^3.0.4:
     hasown "^2.0.2"
     mime-types "^2.1.35"
 
-form-data@^4.0.0, form-data@^4.0.5:
+form-data@^4.0.0, form-data@^4.0.5, form-data@^4.0.6:
   version "4.0.6"
   resolved "https://registry.npmjs.org/form-data/-/form-data-4.0.6.tgz#28e864e1b786dbebb68db1f452f9635278665827"
   integrity sha512-vKatAh4SlVfgbv+YtmhiRjhEMJsYpsG1Y2rMQtR+SVSbytsSD1YGzDIcrAJmdFec88u/+VoGmxnl+80gL1tRCQ==
@@ -36114,4 +36096,3 @@ zxing-wasm@^3.1.3:
   dependencies:
     "@types/emscripten" "^1.41.5"
     type-fest "^5.8.0"
-
```

---

### Incident Patch 4: `d0789a5a` (2026-09-30)
**Commit Message**: fix(plugin-kanban): prevent action bar layout flicker (#10553)

* fix(plugin-ai): prevent shortcut layout shift while loading

* fix(plugin-kanban): avoid measured action bar layout shift

* fix(plugin-ai): reuse employee repository for shortcuts

**File**: `packages/plugins/@nocobase/plugin-ai/src/client-v2/__tests__/AIEmployeeShortcut.test.tsx` (modified, +6/-10)
```diff
@@ -48,16 +48,12 @@ vi.mock('antd', async () => {
   };
 });
 
-vi.mock('ahooks', async () => {
-  const actual = await vi.importActual<typeof import('ahooks')>('ahooks');
-  return {
-    ...actual,
-    useRequest: () => ({
-      data: [employee],
-      loading: false,
-    }),
-  };
-});
+vi.mock('../repositories/hooks/useAIConfigRepository', () => ({
+  useAIConfigRepository: () => ({
+    aiEmployees: [{ username: 'atlas', nickname: 'Atlas', avatar: 'baseBlue' }],
+    getAIEmployees: vi.fn().mockResolvedValue([{ username: 'atlas', nickname: 'Atlas', avatar: 'baseBlue' }]),
+  }),
+}));
 
 vi.mock('@nocobase/flow-engine', async () => {
   const actual = await vi.importActual<typeof import('@nocobase/flow-engine')>('@nocobase/flow-engine');
```

**File**: `packages/plugins/@nocobase/plugin-ai/src/client-v2/ai-employees/AIEmployeeShortcut.tsx` (modified, +11/-8)
```diff
@@ -7,15 +7,15 @@
  * For more information, please refer to: https://www.nocobase.com/agreement.
  */
 
-import React, { useCallback, useMemo, useState } from 'react';
+import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import { Avatar, Popover } from 'antd';
 import { observer, type FlowModelContext, useFlowContext } from '@nocobase/flow-engine';
-import { useRequest } from 'ahooks';
 import { avatars } from './avatars';
 import { AIEmployeeProfileCard } from './ProfileCard';
 import { useChat } from './chatbox/hooks/useChat';
 import { useChatBoxActions } from './chatbox/hooks/useChatBoxActions';
 import { useChatMessageActions } from './chatbox/hooks/useChatMessageActions';
+import { useAIConfigRepository } from '../repositories/hooks/useAIConfigRepository';
 import { getTargetChatBoxUid } from './chatbox/utils';
 import { getMountedChatBox, type MountedChatBoxEntry } from './chatbox/stores/mounted-chat-boxes';
 import { type ChatBoxRuntime, useResolvedChatBoxRuntime } from './chatbox/stores/runtime';
@@ -58,12 +58,15 @@ export const AIEmployeeShortcut: React.FC<{
   }) => {
     const resolvedRuntime = useResolvedChatBoxRuntime(runtime);
     const ctx = useFlowContext<FlowModelContext>();
+    const aiConfigRepository = useAIConfigRepository();
     const t = useT();
     const [focus, setFocus] = useState(false);
-    const { data: aiEmployees = [], loading } = useRequest(async (): Promise<AIEmployee[]> => {
-      const response = await ctx.app.apiClient.resource('aiEmployees').listByUser();
-      return response?.data?.data || [];
-    });
+    const aiEmployees = aiConfigRepository.aiEmployees;
+
+    useEffect(() => {
+      aiConfigRepository.getAIEmployees().catch(console.error);
+    }, [aiConfigRepository]);
+
     const currentConversation = resolvedRuntime.chatConversationModel.currentConversation;
     const chat = useChat(currentConversation, resolvedRuntime);
     const { clear, triggerTask } = useChatBoxActions(resolvedRuntime);
@@ -197,8 +200,8 @@ export const AIEmployeeShortcut: React.FC<{
       openChatBox().catch(console.error);
     }, [onClick, openChatBox]);
 
-    if (loading || !resolvedAIEmployee) {
-      return null;
+    if (!resolvedAIEmployee) {
+      return <span aria-hidden="true" style={{ display: 'inline-block', width: size, height: size }} />;
     }
 
     return (
```

**File**: `packages/plugins/@nocobase/plugin-kanban/src/client-v2/models/components/KanbanBlock.tsx` (modified, +5/-50)
```diff
@@ -83,16 +83,11 @@ export const KanbanBlockView = observer(({ model }: { model: KanbanBlockModel })
   const [columnStates, setColumnStates] = useState<Record<string, ColumnState>>({});
   const [columnRefreshMetaByColumn, setColumnRefreshMetaByColumn] = useState<Record<string, ColumnRefreshMeta>>({});
   const containerRef = useRef<HTMLDivElement>(null);
-  const actionsContainerRef = useRef<HTMLDivElement>(null);
-  const errorContainerRef = useRef<HTMLDivElement>(null);
   const columnStatesRef = useRef<Record<string, ColumnState>>({});
   const boardDisplayItemsRef = useRef<Record<string, KanbanRuntimeRecord[]>>({});
   const suppressGlobalRefreshUntilRef = useRef(0);
   const dragPersistingRef = useRef(false);
   const pendingDragRefreshRef = useRef<DeferredRefreshHandle>(null);
-  const [containerHeight, setContainerHeight] = useState(0);
-  const [actionsHeight, setActionsHeight] = useState(0);
-  const [errorHeight, setErrorHeight] = useState(0);
   const groupField = model.getGroupField();
   const token = model.context.themeToken || {};
   const boardGap = token.margin ?? 16;
@@ -164,45 +159,6 @@ export const KanbanBlockView = observer(({ model }: { model: KanbanBlockModel })
     [],
   );
 
-  useEffect(() => {
-    const updateMeasuredHeights = () => {
-      setContainerHeight(containerRef.current?.getBoundingClientRect().height || 0);
-      setActionsHeight(actionsContainerRef.current?.offsetHeight || 0);
-      setErrorHeight(errorContainerRef.current?.offsetHeight || 0);
-    };
-
-    updateMeasuredHeights();
-
-    if (typeof ResizeObserver === 'undefined') {
-      return;
-    }
-
-    const observer = new ResizeObserver(() => updateMeasuredHeights());
-    if (containerRef.current) {
-      observer.observe(containerRef.current);
-    }
-    if (actionsContainerRef.current) {
-      observer.observe(actionsContainerRef.current);
-    }
-    if (errorContainerRef.current) {
-      observer.observe(errorContainerRef.current);
-    }
-
-    return () => {
-      observer.disconnect();
-    };
-  }, [showActionsBar, groupOptionsError]);
-
-  const contentHeight = useMemo(() => {
-    if (!isFixedHeight || !containerHeight) {
-      return undefined;
-    }
-
-    const gapCount =
-      Number(Boolean(showActionsBar && actionsHeight)) + Number(Boolean(groupOptionsError && errorHeight));
-    return Math.max(containerHeight - actionsHeight - errorHeight - gapCount * boardGap, 0);
-  }, [actionsHeight, boardGap, containerHeight, errorHeight, groupOptionsError, isFixedHeight, showActionsBar]);
-
   useEffect(() => {
     let cancelled = false;
 
@@ -554,16 +510,15 @@ export const KanbanBlockView = observer(({ model }: { model: KanbanBlockModel })
   const boardColumns = (
     <div
       className={css`
-        ${contentHeight ? 'flex: 1 1 0;' : ''}
+        ${isFixedHeight ? 'flex: 1 1 0;' : ''}
         min-height: 0;
         overflow-x: auto;
-        overflow-y: ${contentHeight ? 'hidden' : 'visible'};
+        overflow-y: ${isFixedHeight ? 'hidden' : 'visible'};
         display: flex;
         align-items: stretch;
         gap: ${boardGap}px;
         width: 100%;
       `}
-      style={{ height: contentHeight }}
     >
       {groupOptionsLoading && !groupOptions.length ? (
         <CardPlaceholder cardGap={getKanbanCardGap(model)} cardRadius={getKanbanCardRadius(model)} />
@@ -587,7 +542,7 @@ export const KanbanBlockView = observer(({ model }: { model: KanbanBlockModel })
             setState={setColumnStates}
             refreshMeta={columnRefreshMetaByColumn[column.key]}
             designSettingsHost={designSettingsHost}
-            fixedHeight={Boolean(contentHeight)}
+            fixedHeight={isFixedHeight}
             dragEnabled={dragEnabled}
             dragInteractionEnabled={dragInteractionEnabled}
             hidden={hidden}
@@ -608,9 +563,9 @@ export const KanbanBlockView = observer(({ model }: { model: KanbanBlockModel })
         height: isFixedHeight ? '100%' : 'auto',
       }}
     >
-      {showActionsBar ? <div ref={actionsContainerRef}>{model.renderActions()}</div> : null}
+      {showActionsBar ? <div>{model.renderActions()}</div> : null}
       {groupOptionsError ? (
-        <div ref={errorContainerRef}>
+        <div>
           <Alert type="error" showIcon message={groupOptionsError} />
         </div>
       ) : null}
```

---

### Incident Patch 5: `7af646f5` (2026-09-29)
**Commit Message**: fix(client-v2): show popup parent record variable in quick create popups of unsaved forms (#10554)

* fix(client-v2): show popup parent record variable in quick create popups of unsaved forms

When a record select field opens its quick create popup from a form whose
record has no primary key yet (e.g. the approver's interface configured in
the workflow canvas), neither associationName nor sourceId was passed, so the
"Current popup parent record" variable was hidden and could not be configured.

Pass a meta-only sourceAssociationName in that case and let createPopupMeta
build the parent record meta from it. Runtime resolution still relies on
sourceId, and block resource binding in the popup is unchanged.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(client-v2): retain popup configuration mode

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/core/client-v2/src/flow/models/fields/AssociationFieldModel/RecordSelectFieldModel.tsx` (modified, +7/-0)
```diff
@@ -66,6 +66,11 @@ function RemoteModelRenderer({ options }) {
 
 export function CreateContent({ model, toOne = false }) {
   const ctx = useFlowContext();
+  // Quick-create popups isolate business context but must retain the field's configuration mode.
+  ctx.defineProperty('flowSettingsEnabled', {
+    get: () => model.context.flowSettingsEnabled,
+    cache: false,
+  });
   const { Header, type } = ctx.view;
   model._closeView = ctx.view.close;
   return (
@@ -876,6 +881,8 @@ RecordSelectFieldModel.registerFlow({
             dataSourceKey: ctx.collection.dataSourceKey,
             collectionName: ctx.collectionField?.target,
             ...(associationName && sourceId != null ? { associationName, sourceId } : {}),
+            // 上级记录暂无主键（如审批配置态表单）时不能传 associationName，否则弹窗内新建的区块会绑定到关联资源；改传 sourceAssociationName，仅用于展示“当前弹窗上级记录”变量
+            ...(associationName && sourceId == null ? { sourceAssociationName: associationName } : {}),
             collectionField: ctx.collectionField,
             openerUids,
             onChange: (e) => {
```

**File**: `packages/core/client-v2/src/flow/models/fields/AssociationFieldModel/__tests__/RecordSelectFieldModel.quickCreatePopup.test.tsx` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+/**
+ * This file is part of the NocoBase (R) project.
+ * Copyright (c) 2020-2024 NocoBase Co., Ltd.
+ * Authors: NocoBase Team.
+ *
+ * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
+ * For more information, please refer to: https://www.nocobase.com/agreement.
+ */
+
+import {
+  FlowContext,
+  FlowEngine,
+  FlowEngineProvider,
+  FlowViewContextProvider,
+  type FlowModel,
+} from '@nocobase/flow-engine';
+import { cleanup, render, screen, waitFor } from '@testing-library/react';
+import React from 'react';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import '../../../index';
+import { BlockGridModel } from '../../../base/BlockGridModel';
+import { RecordSelectFieldModel } from '../RecordSelectFieldModel';
+
+type OpenViewHandler = (ctx: unknown, params: Record<string, unknown>) => void;
+
+function getOpenViewHandler(): OpenViewHandler {
+  const flow = RecordSelectFieldModel.globalFlowRegistry.getFlow('popupSettings');
+  const handler = flow?.getStep('openView')?.serialize().handler;
+
+  if (!handler) {
+    throw new Error('popupSettings.openView handler is not registered');
+  }
+
+  return handler as OpenViewHandler;
+}
+
+function createContext(record: Record<string, unknown>) {
+  const open = vi.fn();
+  const sourceCollection = {
+    getFilterByTK: vi.fn((sourceRecord: Record<string, unknown>) => sourceRecord.id),
+  };
+  const model = {
+    uid: 'record-select-uid',
+    props: {
+      quickCreate: 'modalAdd',
+      allowMultiple: true,
+    },
+    context: {
+      inputArgs: {},
+      flowSettingsEnabled: false,
+    },
+    flowEngine: {
+      context: {
+        themeToken: {
+          colorBgLayout: '#fff',
+        },
+      },
+    },
+  };
+
+  return {
+    open,
+    context: {
+      inputArgs: { onChange: vi.fn() },
+      view: {
+        inputArgs: {
+          viewUid: 'approval-popup-uid',
+        },
+      },
+      viewer: { open },
+      layoutContentElement: {},
+      model,
+      collection: {
+        dataSourceKey: 'main',
+        filterTargetKey: 'id',
+      },
+      collectionField: {
+        type: 'hasMany',
+        target: 'orgs',
+        resourceName: 'users.orgs',
+        collection: sourceCollection,
+      },
+      record,
+    },
+  };
+}
+
+describe('RecordSelectFieldModel quick create popup', () => {
+  afterEach(() => {
+    cleanup();
+    vi.restoreAllMocks();
+  });
+
+  describe.each(['drawer', 'dialog'])('%s configuration mode', (mode) => {
+    it.each([
+      { scenario: 'configuration', modelEnabled: true, globalEnabled: false },
+      { scenario: 'global configuration', modelEnabled: true, globalEnabled: true },
+      { scenario: 'runtime', modelEnabled: false, globalEnabled: false },
+      { scenario: 'read-only configuration', modelEnabled: false, globalEnabled: true },
+    ])('uses the field configuration state in $scenario', async ({ modelEnabled, globalEnabled }) => {
+      const engine = new FlowEngine();
+      engine.registerModels({ BlockGridModel });
+      engine.flowSettings.enabled = globalEnabled;
+      engine.context.defineProperty('themeToken', {
+        value: { marginBlock: 16, marginSM: 8, paddingLG: 24 },
+      });
+      engine.context.defineProperty('t', { value: (key: string) => key });
+      const save = vi.fn(async (model: FlowModel) => model.serialize());
+      engine.setModelRepository({
+        findOne: vi.fn(async () => null),
+        save,
+        destroy: vi.fn(async () => true),
+        move: vi.fn(async () => undefined),
+        duplicate: vi.fn(async () => null),
+      });
+      const load = vi.spyOn(engine, 'loadOrCreateModel');
+      const { context, open } = createContext({});
+      context.model.context.flowSettingsEnabled = modelEnabled;
+      getOpenViewHandler()(context, { mode, size: 'medium' });
+      const config = open.mock.calls[0][0];
+      expect(config.inheritContext).toBe(false);
+
+      // Detached popups inherit the engine context, not the approval form's model context.
+      const popupContext = new FlowContext();
+      popupContext.addDelegate(engine.context);
+      popupContext.defineProperty('engine', { value: engine });
+      popupContext.defineProperty('view', {
+        value: { type: mode, inputArgs: config.inputArgs, Header: () => null, close: vi.fn() },
+      });
+      const { container } = render(
+        <FlowEngineProvider engine={engine}>
+          <FlowViewContextProvider context={popupContext}>{config.content()}</FlowViewContextProvider>
+        </FlowEngineProvider>,
+      );
+
+      await waitFor(() => expect(container.querySelector('.nb-block-grid')).toBeInTheDocument());
+      if (modelEnabled) {
+        expect(screen.getByRole('button', { name: /Add block/ })).toBeInTheDocument();
+        expect(save).toHaveBeenCalledOnce();
+      } else {
+        expect(screen.queryByRole('button', { name: /Add block/ })).not.toBeInTheDocument();
+        expect(
```

**File**: `packages/core/flow-engine/src/__tests__/createViewMeta.popup.test.ts` (modified, +83/-1)
```diff
@@ -8,7 +8,7 @@
  */
 
 import { describe, it, expect, vi } from 'vitest';
-import { FlowContext } from '../flowContext';
+import { FlowContext, type PropertyMeta } from '../flowContext';
 import { FlowEngine } from '../flowEngine';
 import type { FlowView } from '../views/FlowView';
 import { buildPopupRuntime, createPopupMeta, registerPopupVariable } from '../views/createViewMeta';
@@ -397,4 +397,86 @@ describe('createPopupMeta - popup variables', () => {
 
     expect(ctx.getPropertyOptions('popup')?.resolveOnServer?.('sourceRecord.department.title')).toBe(true);
   });
+
+  describe('popup sourceRecord meta for quick create popups', () => {
+    function makeCtxWithUsers() {
+      const engine = new FlowEngine();
+      const ds = engine.context.dataSourceManager.getDataSource('main');
+      ds.addCollection({
+        name: 'orgs',
+        filterTargetKey: 'id',
+        fields: [{ name: 'id', type: 'integer', interface: 'number' }],
+      });
+      ds.addCollection({
+        name: 'users',
+        filterTargetKey: 'id',
+        fields: [
+          { name: 'id', type: 'integer', interface: 'number' },
+          { name: 'nickname', type: 'string', interface: 'input' },
+          { name: 'orgs', type: 'hasMany', target: 'orgs', interface: 'o2m' },
+        ],
+      });
+      return engine.context;
+    }
+
+    function makeQuickCreatePopupView(inputArgs: Record<string, unknown>): FlowView {
+      return {
+        type: 'drawer',
+        inputArgs: {
+          openerUids: ['approval-form-uid'],
+          scene: 'create',
+          dataSourceKey: 'main',
+          collectionName: 'orgs',
+          ...inputArgs,
+        },
+        Header: null,
+        Footer: null,
+        close: () => void 0,
+        update: () => void 0,
+      } as unknown as FlowView;
+    }
+
+    async function getPopupProps(ctx: FlowContext, view: FlowView) {
+      const meta = await createPopupMeta(ctx, view)();
+      const props = typeof meta?.properties === 'function' ? await meta.properties() : meta?.properties;
+      return { meta, props: props || {} };
+    }
+
+    it('exposes the parent record meta from sourceAssociationName before the parent record has a primary key', async () => {
+      const ctx = makeCtxWithUsers();
+      const view = makeQuickCreatePopupView({ sourceAssociationName: 'users.orgs' });
+
+      const { meta, props } = await getPopupProps(ctx, view);
+      const sourceRecordMeta = props.sourceRecord as PropertyMeta;
+      expect(sourceRecordMeta?.title).toBe('Current popup parent record');
+      const fields =
+        typeof sourceRecordMeta.properties === 'function'
+          ? await sourceRecordMeta.properties()
+          : sourceRecordMeta.properties;
+      expect(fields).toHaveProperty('nickname');
+
+      // 父记录尚无主键时仅用于配置变量，不应生成服务端取值参数
+      const vars = (await meta?.buildVariablesParams?.(ctx)) as { sourceRecord?: unknown } | undefined;
+      expect(vars?.sourceRecord).toBeUndefined();
+    });
+
+    it('does not expose the parent record meta without sourceId or sourceAssociationName', async () => {
+      const ctx = makeCtxWithUsers();
+      const view = makeQuickCreatePopupView({});
+
+      const { props } = await getPopupProps(ctx, view);
+      expect(props.sourceRecord).toBeUndefined();
+    });
+
+    it('keeps resolving the parent record by sourceId once the parent record is persisted', async () => {
+      const ctx = makeCtxWithUsers();
+      const view = makeQuickCreatePopupView({ associationName: 'users.orgs', sourceId: 7 });
+
+      const { meta, props } = await getPopupProps(ctx, view);
+      expect((props.sourceRecord as PropertyMeta)?.title).toBe('Current popup parent record');
+
+      const vars = (await meta?.buildVariablesParams?.(ctx)) as { sourceRecord?: unknown } | undefined;
+      expect(vars?.sourceRecord).toEqual({ collection: 'users', dataSourceKey: 'main', filterByTk: 7 });
+    });
+  });
 });
```

**File**: `packages/core/flow-engine/src/views/createViewMeta.ts` (modified, +17/-7)
```diff
@@ -390,7 +390,13 @@ export function createPopupMeta(ctx: FlowContext, anchorView?: FlowView): Proper
           const view = getPopupView(ctx, anchorView);
           const inputArgs = view?.inputArgs;
           const srcId = inputArgs?.sourceId;
-          let assoc: string | undefined = inputArgs?.associationName;
+          const hasSourceId = srcId != null && srcId !== '';
+          // 上级记录暂无主键时（如审批配置态表单里的快速创建弹窗），只会传 sourceAssociationName：仍展示变量结构，取值依赖运行时的 sourceId
+          const pendingSourceAssoc =
+            !hasSourceId && typeof inputArgs?.sourceAssociationName === 'string'
+              ? inputArgs.sourceAssociationName
+              : undefined;
+          let assoc: string | undefined = inputArgs?.associationName || pendingSourceAssoc;
           let dsKey: string = inputArgs?.dataSourceKey || 'main';
 
           // 兜底：若 associationName 缺失或不含“.”，尝试从当前视图模型的 openView 参数推断
@@ -409,7 +415,7 @@ export function createPopupMeta(ctx: FlowContext, anchorView?: FlowView): Proper
             }
           }
 
-          if (srcId != null && srcId !== '' && assoc && typeof assoc === 'string') {
+          if ((hasSourceId || pendingSourceAssoc) && assoc && typeof assoc === 'string') {
             const parentCollectionName = String(assoc).includes('.') ? String(assoc).split('.')[0] : undefined;
             if (parentCollectionName) {
               const parentCollectionAccessor = () => {
@@ -420,11 +426,15 @@ export function createPopupMeta(ctx: FlowContext, anchorView?: FlowView): Proper
                   return null;
                 }
               };
-              const srcMeta = await buildRecordMeta(parentCollectionAccessor, t('Current popup parent record'), () => ({
-                collection: parentCollectionName,
-                dataSourceKey: dsKey,
-                filterByTk: srcId,
-              }));
+              const srcMeta = await buildRecordMeta(parentCollectionAccessor, t('Current popup parent record'), () =>
+                hasSourceId
+                  ? {
+                      collection: parentCollectionName,
+                      dataSourceKey: dsKey,
+                      filterByTk: srcId,
+                    }
+                  : undefined,
+              );
               if (srcMeta) {
                 props.sourceRecord = srcMeta;
               }
```

---

### Incident Patch 6: `adbadacd` (2026-09-29)
**Commit Message**: fix(deps): close js-yaml and uuid advisories from the latest scan (#10555)

The scan was run against an image built before #10542 (it reports
pdfjs-dist 5.6.205, which came from the old `^5.3.31`), so pdfjs-dist is
already resolved. js-yaml and uuid were not.

js-yaml (CVE-2026-84375, fixed in 3.15.2 / 4.3.2) needed no new override:
every range in the tree (`^3.13.1`, `^4.1.0`, `^4.1.1`) already admits a
patched version, the lockfile was just pinned to stale resolutions.
Refreshing them moves `^3.13.1` to 3.15.2 and `^4.x` to 4.3.2.

pm2 is the one exception — 7.0.4 still pins js-yaml 4.3.1 exactly. The
root `**/pm2/js-yaml` override already covered this repo, but the image
installs the create-nocobase-app template, whose own `resolutions` did
not carry it, so the fix never reached the published image. Add it there.

uuid (CVE-2026-41907, fixed in 11.1.1 / 12.0.1 / 13.0.1 / 14.x) cannot be
fixed at the source. Refreshing the lockfile moves `^11`, `^13` and `^14`
to patched releases, but `^8`, `^9` and `^10` are capped below every fix
and the upstreams have no path forward — sequelize 6.37.8, exceljs 4.4.0
and koa-proxies 0.12.4 all still depend on uuid `^8`/`^9`. Pin `**/uuid`
to 1

**File**: `package.json` (modified, +3/-0)
```diff
@@ -70,6 +70,9 @@
     "eslint": "8.57.1",
     "**/@rushstack/node-core-library/ajv": "8.18.0",
     "**/pm2/js-yaml": "4.3.2",
+    "**/request/uuid": "3.4.0",
+    "**/temp-write/uuid": "3.4.0",
+    "**/uuid": "11.1.1",
     "**/qs": "6.16.0"
   },
   "config": {
```

**File**: `packages/core/client/package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     "@ant-design/icons": "^5.6.1",
     "@ant-design/pro-layout": "^7.22.1",
     "@antv/g2plot": "^2.4.18",
-    "@budibase/handlebars-helpers": "0.14.0",
+    "@budibase/handlebars-helpers": "0.14.3",
     "@codemirror/lang-html": "^6.4.10",
     "@codemirror/theme-one-dark": "^6.1.3",
     "@ctrl/tinycolor": "^3.6.0",
```

**File**: `packages/core/create-nocobase-app/templates/app/package.json` (modified, +3/-1)
```diff
@@ -30,7 +30,9 @@
     "antd": "5.24.2",
     "async": "^3.2.6",
     "rollup": "4.24.0",
-    "semver": "^7.7.1"
+    "semver": "^7.7.1",
+    "**/pm2/js-yaml": "4.3.2",
+    "**/uuid": "11.1.1"
   },
   "dependencies": {
     "pm2": "^7.0.0",
```

**File**: `packages/core/utils/package.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
   "types": "./lib/index.d.ts",
   "license": "Apache-2.0",
   "dependencies": {
-    "@budibase/handlebars-helpers": "0.14.0",
+    "@budibase/handlebars-helpers": "0.14.3",
     "@hapi/topo": "^6.0.0",
     "@rc-component/mini-decimal": "^1.1.0",
     "axios": "^1.7.0",
```

**File**: `yarn.lock` (modified, +27/-47)
```diff
@@ -1,7 +1,6 @@
 # THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 # yarn lockfile v1
 
-
 "@aashutoshrathi/word-wrap@^1.2.3":
   version "1.2.6"
   resolved "https://registry.npmmirror.com/@aashutoshrathi/word-wrap/-/word-wrap-1.2.6.tgz#bd9154aec9983f77b3a034ecaa015c2e4201f6cf"
@@ -3362,6 +3361,25 @@
     to-gfm-code-block "^0.1.1"
     uuid "^9.0.1"
 
+"@budibase/handlebars-helpers@0.14.3":
+  version "0.14.3"
+  resolved "https://registry.npmjs.org/@budibase/handlebars-helpers/-/handlebars-helpers-0.14.3.tgz#2ad64079ed2a900cf1869d7960cc3f329c8b4530"
+  integrity sha512-4q0zSlDh3eQC/mB4UtKXhlreBjUVx+IH9ktR7zyogDE0+y3ePJAkpkFKcwE1vRDwrfkilxzwMJG0JZBFBArFmA==
+  dependencies:
+    get-object "^0.2.0"
+    get-value "^3.0.1"
+    handlebars "^4.7.7"
+    has-value "^2.0.2"
+    html-tag "^2.0.0"
+    is-glob "^4.0.1"
+    kind-of "^6.0.3"
+    micromatch "^4.0.5"
+    relative "^3.0.2"
+    striptags "^3.1.1"
+    to-gfm-code-block "^0.1.1"
+    typeof-article "^0.1.1"
+    uuid "^11.1.1"
+
 "@cfworker/json-schema@^4.0.2":
   version "4.1.1"
   resolved "https://registry.npmmirror.com/@cfworker/json-schema/-/json-schema-4.1.1.tgz#4a2a3947ee9fa7b7c24be981422831b8674c3be6"
@@ -22480,35 +22498,21 @@ js-tokens@^8.0.2:
   resolved "https://registry.npmmirror.com/js-tokens/-/js-tokens-8.0.3.tgz#1c407ec905643603b38b6be6977300406ec48775"
   integrity sha512-UfJMcSJc+SEXEl9lH/VLHSZbThQyLpw1vLO1Lb+j4RWDvG3N2f7yj3PVQA3cmkTBNldJ9eFnM+xEXxHIXrYiJw==
 
-js-yaml@4.3.1, js-yaml@4.3.2:
+js-yaml@4.3.1, js-yaml@4.3.2, js-yaml@^4.1.0, js-yaml@^4.1.1:
   version "4.3.2"
   resolved "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz#8e44fb14a2643c59726bb15787b5f1512cb3d3fb"
   integrity sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==
   dependencies:
     argparse "^2.0.1"
 
 js-yaml@^3.13.1:
-  version "3.14.1"
-  resolved "https://registry.npmmirror.com/js-yaml/-/js-yaml-3.14.1.tgz#dae812fdb3825fa306609a8717383c50c36a0537"
-  integrity sha512-okMH7OXXJ7YrN9Ok3/SXrnu4iX9yOk+25nqX4imS2npuvTYDmo/QEZoqwZkYaIDk3jVvBOTOIEgEhaLOynBS9g==
+  version "3.15.2"
+  resolved "https://registry.npmjs.org/js-yaml/-/js-yaml-3.15.2.tgz#3f83823ac6be17f570f23b2ecdef3777ff5ea364"
+  integrity sha512-6EuL879VkRA+1Cz578mKMiKvjPNEuk6+r1JaFzoSWejZmtf7xWbIyw1e3KkxlkzTIt9Taw6JBhEppG7utc1P+w==
   dependencies:
     argparse "^1.0.7"
     esprima "^4.0.0"
 
-js-yaml@^4.1.0:
-  version "4.1.0"
-  resolved "https://registry.npmmirror.com/js-yaml/-/js-yaml-4.1.0.tgz#c1fb65f8f5017901cdd2c951864ba18458a10602"
-  integrity sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA==
-  dependencies:
-    argparse "^2.0.1"
-
-js-yaml@^4.1.1:
-  version "4.1.1"
-  resolved "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.1.tgz#854c292467705b699476e1a2decc0c8a3458806b"
-  integrity sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==
-  dependencies:
-    argparse "^2.0.1"
-
 jsbn@~0.1.0:
   version "0.1.1"
   resolved "https://registry.npmmirror.com/jsbn/-/jsbn-0.1.1.tgz#a5e654c2e5a2deb5f201d96cefbca80c0ef2f513"
@@ -34914,41 +34918,16 @@ uuid-v4@^0.1.0:
   resolved "https://registry.npmmirror.com/uuid-v4/-/uuid-v4-0.1.0.tgz#62d7b310406f6cecfea1528c69f1e8e0bcec5a3a"
   integrity sha512-m11RYDtowtAIihBXMoGajOEKpAXrKbpKlpmxqyztMYQNGSY5nZAZ/oYch/w2HNS1RMA4WLGcZvuD8/wFMuCEzA==
 
-uuid@^10.0.0:
-  version "10.0.0"
-  resolved "https://registry.npmmirror.com/uuid/-/uuid-10.0.0.tgz#5a95aa454e6e002725c79055fd42aaba30ca6294"
-  integrity sha512-8XkAphELsDnEGrDxUOHB3RGvXz6TeuYSGEZBOjtTtPm2lwhGBjLgOzLHB63IUWfBpNucQjND6d3AOudO+H3RWQ==
-
-uuid@^11.0.3, uuid@^11.0.5, uuid@^11.1.0, uuid@^11.1.1:
+uuid@11.1.1, uuid@^10.0.0, uuid@^11.0.3, uuid@^11.0.5, uuid@^11.1.0, uuid@^11.1.1, uuid@^13.0.0, uuid@^14.0.0, uuid@^8.2.0, uuid@^8.3.0, uuid@^8.3.2, uuid@^9.0.0, uuid@^9.0.1:
   version "11.1.1"
   resolved "https://registry.npmjs.org/uuid/-/uuid-11.1.1.tgz#f6d81d2e1c65d00762e5e29b16c5d2d995e208ad"
   integrity sha512-vIYxrBCC/N/K+Js3qSN88go7kIfNPssr/hHCesKCQNAjmgvYS2oqr69kIufEG+O4+PfezOH4EbIeHCfFov8ZgQ==
 
-uuid@^13.0.0:
-  version "13.0.0"
-  resolved "https://registry.npmmirror.com/uuid/-/uuid-13.0.0.tgz#263dc341b19b4d755eb8fe36b78d95a6b65707e8"
-  integrity sha512-XQegIaBTVUjSHliKqcnFqYypAd4S+WCYt5NIeRs6w/UAry7z8Y9j5ZwRRL4kzq9U3sD6v+85er9FvkEaBpji2w==
-
-uuid@^14.0.0:
-  version "14.0.0"
-  resolved "https://registry.npmjs.org/uuid/-/uuid-14.0.0.tgz#0af883220163d264ffe0c084f6b8a89b9666966d"
-  integrity sha512-Qo+uWgilfSmAhXCMav1uYFynlQO7fMFiMVZsQqZRMIXp0O7rR7qjkj+cPvBHLgBqi960QCoo/PH2/6ZtVqKvrg==
-
-uuid@^3.3.2:
+uuid@3.4.0, uuid@^3.3.2:
   version "3.4.0"
-  resolved "https://registry.npmmirror.com/uuid/-/uuid-3.4.0.tgz#b23e4358afa8a202fe7a100af1f5f883f02007ee"
+  resolved "https://registry.npmjs.org/uuid/-/uuid-3.4.0.tgz#b23e4358afa8a202fe7a100af1f5f883f02007ee"
   integrity sha512-HjSDRw6gZE5JMggctHBcjVak08+KEVhSIiDzFnT9S9aegmp85S/bRe
```

---

### Incident Patch 7: `00ac0057` (2026-09-29)
**Commit Message**: fix(plugin-workflow): preserve jobs status index during initialization (#10552)

**File**: `packages/plugins/@nocobase/plugin-workflow/src/common/collections/jobs.ts` (modified, +4/-4)
```diff
@@ -23,6 +23,10 @@ export default {
       primaryKey: true,
       autoIncrement: false,
     },
+    {
+      type: 'integer',
+      name: 'status',
+    },
     {
       type: 'belongsTo',
       name: 'execution',
@@ -41,10 +45,6 @@ export default {
       name: 'upstream',
       target: 'jobs',
     },
-    {
-      type: 'integer',
-      name: 'status',
-    },
     {
       type: 'json',
       name: 'meta',
```

---

### Incident Patch 8: `2ef71c06` (2026-09-28)
**Commit Message**: feat(client-v2): support data scope for quick edit association fields (#10547)

* feat(client-v2): support data scope for quick edit association fields

Table column quick edit built its editor from the default field binding with
no settings carried over, so an association field always listed every record of
the target collection. The same field configured in a form block has a data
scope setting, making quick edit the only editing surface without one.

Add a "Data scope" item to the table column settings, shown only when the column
is an association field with quick edit enabled and whose editor exposes a data
scope step. The raw filter is stored on the column and handed to the editor model
that QuickEditFormModel builds when the popover opens.

The filter describes records of the association target, so the settings dialog
renders against a scoped context where `collection` is the target collection and
`record` is declared with meta only, keeping "Current record" selectable as a
variable while its value resolves per row.

Also seed the edited row into the resource before dispatching the editor's
flows. Record variables and the foreign key filter that one-to-one and
one-to-many edi

**File**: `packages/core/client-v2/src/flow/components/filter/VariableFilterItem.tsx` (modified, +3/-1)
```diff
@@ -130,7 +130,9 @@ export interface VariableFilterItemProps {
   rightAsVariable?: boolean;
   /**
    * 右侧 VariableInput 的 metaTree 提供器；
-   * 默认使用整棵 ctx 的 metaTree：model.context.getPropertyMetaTree()
+   * 默认使用视图上下文的 metaTree：useFlowViewContext().getPropertyMetaTree()。
+   * 注意它取自视图上下文而非 `model.context`：当调用方传入的 model 与打开设置弹窗的模型不是同一个时，
+   * 右侧变量不会跟随 model 变化，需要显式传入本属性。
    */
   rightMetaTree?: MetaTreeNode[] | (() => MetaTreeNode[] | Promise<MetaTreeNode[]>);
   /**
```

**File**: `packages/core/client-v2/src/flow/internal/utils/__tests__/quickEditDataScope.test.ts` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+/**
+ * This file is part of the NocoBase (R) project.
+ * Copyright (c) 2020-2024 NocoBase Co., Ltd.
+ * Authors: NocoBase Team.
+ *
+ * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
+ * For more information, please refer to: https://www.nocobase.com/agreement.
+ */
+
+import { beforeEach, describe, expect, it } from 'vitest';
+// Prime the model module graph: the association field models sit in an import cycle that only resolves cleanly when the
+// models barrel is loaded first.
+import '../../../models';
+import { FlowEngine, FlowModel } from '@nocobase/flow-engine';
+import { CascadeSelectFieldModel } from '../../../models/fields/AssociationFieldModel/CascadeSelectFieldModel';
+import { RecordSelectFieldModel } from '../../../models/fields/AssociationFieldModel/RecordSelectFieldModel';
+import { SelectFieldModel } from '../../../models/fields/SelectFieldModel';
+import {
+  createQuickEditDataScopeContext,
+  findDataScopeStep,
+  getQuickEditDataScopeFilter,
+  isEmptyDataScopeFilter,
+} from '../quickEditDataScope';
+
+const resolveSubTree = async (subTree: unknown) => {
+  if (typeof subTree === 'function') {
+    return (await (subTree as () => Promise<Array<{ name: string }>>)()) || [];
+  }
+  return (subTree as Array<{ name: string }>) || [];
+};
+
+describe('quickEditDataScope', () => {
+  describe('findDataScopeStep', () => {
+    it('finds the data scope step of the dropdown association editor', () => {
+      expect(findDataScopeStep(RecordSelectFieldModel)).toEqual({ flowKey: 'selectSettings', stepKey: 'dataScope' });
+    });
+
+    it('finds the data scope step of the cascade association editor', () => {
+      expect(findDataScopeStep(CascadeSelectFieldModel)).toEqual({ flowKey: 'selectSettings', stepKey: 'dataScope' });
+    });
+
+    it('returns null for editors without a data scope step', () => {
+      expect(findDataScopeStep(SelectFieldModel)).toBeNull();
+    });
+
+    it('returns null for a missing model class', () => {
+      expect(findDataScopeStep(undefined)).toBeNull();
+    });
+  });
+
+  describe('isEmptyDataScopeFilter', () => {
+    it('treats a filter without conditions as empty', () => {
+      expect(isEmptyDataScopeFilter(undefined)).toBe(true);
+      expect(isEmptyDataScopeFilter({ logic: '$and', items: [] })).toBe(true);
+    });
+
+    it('treats a filter with conditions as non-empty', () => {
+      expect(isEmptyDataScopeFilter({ logic: '$and', items: [{ path: 'name', operator: 'eq', value: 'a' }] })).toBe(
+        false,
+      );
+    });
+  });
+
+  describe('getQuickEditDataScopeFilter', () => {
+    let engine: FlowEngine;
+    let column: FlowModel;
+    let displayField: FlowModel;
+
+    beforeEach(() => {
+      engine = new FlowEngine();
+      column = engine.createModel<FlowModel>({ use: 'FlowModel', uid: 'table-column' });
+      displayField = engine.createModel<FlowModel>({ use: 'FlowModel', uid: 'display-field', parentId: column.uid });
+    });
+
+    it('reads the filter configured on the owning table column', () => {
+      const filter = { logic: '$and', items: [{ path: 'status', operator: 'eq', value: 'active' }] };
+      column.setStepParams('tableColumnSettings', 'quickEditDataScope', { filter });
+
+      expect(getQuickEditDataScopeFilter(displayField)).toEqual(filter);
+    });
+
+    it('ignores an unconfigured filter so no step params are injected', () => {
+      column.setStepParams('tableColumnSettings', 'quickEditDataScope', { filter: { logic: '$and', items: [] } });
+
+      expect(getQuickEditDataScopeFilter(displayField)).toBeUndefined();
+    });
+
+    it('returns undefined when there is no source field model', () => {
+      expect(getQuickEditDataScopeFilter(undefined)).toBeUndefined();
+    });
+  });
+
+  describe('createQuickEditDataScopeContext', () => {
+    let engine: FlowEngine;
+    let column: FlowModel;
+
+    beforeEach(() => {
+      engine = new FlowEngine();
+      const ds = engine.context.dataSourceManager.getDataSource('main');
+      ds.addCollection({
+        name: 'departments',
+        filterTargetKey: 'id',
+        titleField: 'name',
+        fields: [
+          { name: 'id', type: 'integer', interface: 'number' },
+          { name: 'name', type: 'string', interface: 'input', uiSchema: { title: 'Name' } },
+        ],
+      });
+      ds.addCollection({
+        name: 'members',
+        filterTargetKey: 'id',
+        fields: [
+          { name: 'id', type: 'integer', interface: 'number' },
+          { name: 'level', type: 'string', interface: 'input', uiSchema: { title: 'Level' } },
+          {
+            name: 'department',
+            type: 'belongsTo',
+            interface: 'm2o',
+            target: 'departments',
+            targetKey: 'id',
+            uiSchema: { title: 'Department' },
+          },
+        ],
+      });
+      const membersCollection = engine.context.dataSourceManager.getCollection('main', 'members')
```

**File**: `packages/core/client-v2/src/flow/internal/utils/quickEditDataScope.tsx` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
+/**
+ * This file is part of the NocoBase (R) project.
+ * Copyright (c) 2020-2024 NocoBase Co., Ltd.
+ * Authors: NocoBase Team.
+ *
+ * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
+ * For more information, please refer to: https://www.nocobase.com/agreement.
+ */
+
+import type { FlowEngineContext, ModelConstructor } from '@nocobase/flow-engine';
+import {
+  CollectionField,
+  FlowModel,
+  createCollectionContextMeta,
+  createCurrentRecordMetaFactory,
+  createEphemeralContext,
+  useFlowSettingsContext,
+} from '@nocobase/flow-engine';
+import { Skeleton } from 'antd';
+import React, { useCallback, useEffect, useState } from 'react';
+import { FilterGroup, VariableFilterItem } from '../../components/filter';
+import { FormItemModel } from '../../models/blocks/form/FormItemModel';
+
+const DATA_SCOPE_ACTION_NAME = 'dataScope';
+
+export const QUICK_EDIT_DATA_SCOPE_FLOW_KEY = 'tableColumnSettings';
+export const QUICK_EDIT_DATA_SCOPE_STEP_KEY = 'quickEditDataScope';
+
+export type DataScopeStepLocation = { flowKey: string; stepKey: string };
+
+/**
+ * Minimal shape read off a model class: the static flow registry and the `use` of each step. `ModelConstructor` does not
+ * declare the registry, so the lookup reaches for it through this shape instead of widening to `any`.
+ */
+type FlowRegistryHolder = {
+  globalFlowRegistry?: {
+    getFlows?: () => Map<string, { steps?: Record<string, { use?: string } | undefined> } | undefined>;
+  };
+};
+
+type DataScopeFilter = { logic?: string; items?: unknown[] } | undefined;
+
+/**
+ * Locate the flow and step that carry the shared `dataScope` action on a field model class. Both association editors
+ * currently keep it under `selectSettings`, but the lookup resolves it from the class instead of hard-coding that name,
+ * so an editor registered later is picked up without touching the quick edit path. Returns the first match.
+ */
+export function findDataScopeStep(
+  ModelClass: ModelConstructor | typeof FlowModel | undefined | null,
+): DataScopeStepLocation | null {
+  const flows = (ModelClass as unknown as FlowRegistryHolder | undefined)?.globalFlowRegistry?.getFlows?.();
+  if (!flows) {
+    return null;
+  }
+  for (const [flowKey, flow] of flows) {
+    for (const [stepKey, step] of Object.entries(flow?.steps || {})) {
+      if (step?.use === DATA_SCOPE_ACTION_NAME) {
+        return { flowKey, stepKey };
+      }
+    }
+  }
+  return null;
+}
+
+/**
+ * Resolve the data scope step of the editor model that the quick edit popover builds for `collectionField`. Returns null
+ * when the field is not an association or when its default editor has no data scope step, which is what the column
+ * setting uses to decide whether to offer the item at all.
+ */
+export function resolveQuickEditDataScopeStep(
+  ctx: FlowEngineContext,
+  collectionField: CollectionField,
+): DataScopeStepLocation | null {
+  if (!collectionField?.isAssociationField?.()) {
+    return null;
+  }
+  // Resolve through the same class the quick edit popover builds its editor with, so the setting is offered exactly
+  // when the editor that will actually open has a data scope step.
+  const binding = FormItemModel.getDefaultBindingByField(ctx, collectionField);
+  if (!binding?.modelName) {
+    return null;
+  }
+  return findDataScopeStep(ctx.engine?.getModelClass?.(binding.modelName));
+}
+
+export function isEmptyDataScopeFilter(filter: DataScopeFilter) {
+  return !filter || !Array.isArray(filter.items) || filter.items.length === 0;
+}
+
+/** Read the quick edit data scope filter stored on the table column that owns `sourceFieldModel`. */
+export function getQuickEditDataScopeFilter(sourceFieldModel?: FlowModel): DataScopeFilter {
+  const columnModel = sourceFieldModel?.parent as FlowModel | undefined;
+  const params = columnModel?.getStepParams?.(QUICK_EDIT_DATA_SCOPE_FLOW_KEY, QUICK_EDIT_DATA_SCOPE_STEP_KEY);
+  const filter = params?.filter as DataScopeFilter;
+  return isEmptyDataScopeFilter(filter) ? undefined : filter;
+}
+
+/**
+ * Context the filter builder is configured against. The setting lives on the table column, but the filter describes
+ * records of the association target, so `collection` points at the target collection to drive the left-hand field list.
+ * `record` is declared with meta only so that "Current record" is offered as a right-hand variable and describes the row
+ * being edited rather than whatever record an enclosing popup happens to supply; it has no value while configuring and
+ * resolves per row once the popover opens.
+ */
+export function createQuickEditDataScopeContext(columnModel: FlowModel) {
+  const collectionField = columnModel.context.collectionField as CollectionField;
+  const getTargetCollection = () => collectionField?.targetCollection ?? null;
+  const getSourceCollection = () => columnModel.context.collection ?? null;
+  return createEphemeralContext(columnModel.context,
```

**File**: `packages/core/client-v2/src/flow/models/blocks/form/QuickEditFormModel.tsx` (modified, +30/-11)
```diff
@@ -23,6 +23,7 @@ import {
 } from '@nocobase/flow-engine';
 import { Button, Form, Skeleton, Space } from 'antd';
 import React from 'react';
+import { findDataScopeStep, getQuickEditDataScopeFilter } from '../../../internal/utils/quickEditDataScope';
 import { FieldModel } from '../../base/FieldModel';
 import { FormComponent } from './FormBlockModel';
 import { FormItemModel } from './FormItemModel';
@@ -167,6 +168,7 @@ export class QuickEditFormModel extends FlowModel {
   __onSubmitSuccess;
   _fieldProps: any;
   _onOk: any;
+  _dataScopeFilter: Record<string, any> | undefined;
 
   get form() {
     return this.context.form;
@@ -220,6 +222,7 @@ export class QuickEditFormModel extends FlowModel {
       },
       sourceFieldModel ? { delegate: sourceFieldModel.context } : undefined,
     ) as QuickEditFormModel;
+    model._dataScopeFilter = getQuickEditDataScopeFilter(sourceFieldModel);
 
     const bodyStyles = {
       maxHeight: QUICK_EDIT_POPOVER_MAX_HEIGHT,
@@ -418,28 +421,46 @@ QuickEditFormModel.registerFlow({
         resource.setDataSourceKey(dataSourceKey);
         resource.setResourceName(collectionName);
         ctx.model.resource = resource;
+        // Seed the edited row before dispatching the field model's flows. An association data scope resolves
+        // `ctx.record` while the field renders, and so does the foreign key filter that one-to-one and one-to-many
+        // editors build, so the record has to be in place first.
+        if (ctx.inputArgs.filterByTk || ctx.inputArgs.record) {
+          resource.setFilterByTk(ctx.inputArgs.filterByTk);
+          resource.setData(ctx.inputArgs.record);
+        }
         const collectionField = ctx.model.collection.getField(fieldPath) as CollectionField;
         if (collectionField) {
           const binding = FormItemModel.getDefaultBindingByField(ctx, collectionField);
           if (!binding) {
             return;
           }
           const use = binding.modelName;
+          const stepParams: Record<string, Record<string, Record<string, unknown>>> = {
+            fieldSettings: {
+              init: {
+                dataSourceKey,
+                collectionName,
+                fieldPath,
+              },
+            },
+          };
+          const dataScopeFilter = ctx.model._dataScopeFilter;
+          if (dataScopeFilter) {
+            const dataScopeStep = findDataScopeStep(ctx.engine.getModelClass(use));
+            if (dataScopeStep) {
+              stepParams[dataScopeStep.flowKey] = {
+                ...stepParams[dataScopeStep.flowKey],
+                [dataScopeStep.stepKey]: { filter: dataScopeFilter },
+              };
+            }
+          }
           const fieldModel = ctx.model.addSubModel<FieldModel>('fields', {
             use,
             props:
               typeof binding.defaultProps === 'function'
                 ? binding.defaultProps(ctx, collectionField)
                 : binding.defaultProps,
-            stepParams: {
-              fieldSettings: {
-                init: {
-                  dataSourceKey,
-                  collectionName,
-                  fieldPath,
-                },
-              },
-            },
+            stepParams,
           });
           fieldModel.setProps(getQuickEditFieldProps(collectionField, ctx.model._fieldProps));
           fieldModel.setProps({ sourceFieldModelUid: ctx.inputArgs.sourceFieldModelUid });
@@ -457,8 +478,6 @@ QuickEditFormModel.registerFlow({
           await fieldModel.dispatchEvent('beforeRender');
         }
         if (ctx.inputArgs.filterByTk || ctx.inputArgs.record) {
-          resource.setFilterByTk(ctx.inputArgs.filterByTk);
-          resource.setData(ctx.inputArgs.record);
           ctx.model.form?.setFieldsValue(resource.getData());
         }
       },
```

**File**: `packages/core/client-v2/src/flow/models/blocks/form/__tests__/QuickEditFormModel.quickEdit.test.ts` (modified, +76/-0)
```diff
@@ -9,7 +9,10 @@
 
 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
 import { FlowEngine, FlowModel, SingleRecordResource } from '@nocobase/flow-engine';
+import '../../../index';
 import { QuickEditFormModel } from '../QuickEditFormModel';
+import { dataScope } from '../../../../actions/dataScope';
+import { RecordSelectFieldModel } from '../../../fields/AssociationFieldModel/RecordSelectFieldModel';
 import { SelectFieldModel } from '../../../fields/SelectFieldModel';
 
 describe('QuickEditFormModel - quick edit save triggers API (regression)', () => {
@@ -56,6 +59,54 @@ describe('QuickEditFormModel - quick edit save triggers API (regression)', () =>
     });
   };
 
+  const addMemberCollections = () => {
+    const ds = engine.context.dataSourceManager.getDataSource('main');
+    ds.addCollection({
+      name: 'departments',
+      filterTargetKey: 'id',
+      titleField: 'name',
+      fields: [
+        { name: 'id', type: 'integer', interface: 'number' },
+        { name: 'name', type: 'string', interface: 'input', uiSchema: { title: 'Name' } },
+        { name: 'level', type: 'string', interface: 'input', uiSchema: { title: 'Level' } },
+      ],
+    });
+    ds.addCollection({
+      name: 'members',
+      filterTargetKey: 'id',
+      fields: [
+        { name: 'id', type: 'integer', interface: 'number' },
+        { name: 'level', type: 'string', interface: 'input', uiSchema: { title: 'Level' } },
+        {
+          name: 'department',
+          type: 'belongsTo',
+          interface: 'm2o',
+          target: 'departments',
+          targetKey: 'id',
+          uiSchema: { title: 'Department' },
+        },
+      ],
+    });
+  };
+
+  const openQuickEditForAssociation = async (dataScopeFilter?: Record<string, unknown>) => {
+    engine.registerModels({ QuickEditFormModel, RecordSelectFieldModel });
+    engine.registerActions({ dataScope });
+    addMemberCollections();
+    const model = engine.createModel<QuickEditFormModel>({
+      use: QuickEditFormModel,
+      uid: `qe-association-${dataScopeFilter ? 'scoped' : 'plain'}`,
+      stepParams: {
+        quickEditFormSettings: {
+          init: { dataSourceKey: 'main', collectionName: 'members', fieldPath: 'department' },
+        },
+      },
+    });
+    model._dataScopeFilter = dataScopeFilter;
+    await model.applyFlow('quickEditFormSettings', { filterByTk: 7, record: { id: 7, level: 'senior' } });
+    return model;
+  };
+
   it('uses source field context when opening quick edit', async () => {
     engine.registerModels({ QuickEditFormModel });
     engine.context.defineProperty('pageActive', { value: { value: false } });
@@ -458,4 +509,29 @@ describe('QuickEditFormModel - quick edit save triggers API (regression)', () =>
     await mobileModel.applyFlow('quickEditFormSettings', { record: {} });
     expect(mobileModel.subModels.fields[0].props.placement).toBeUndefined();
   });
+
+  it('hands the column data scope to the association editor built for the popover', async () => {
+    const filter = { logic: '$and', items: [{ path: 'level', operator: 'eq', value: '{{ctx.record.level}}' }] };
+
+    const model = await openQuickEditForAssociation(filter);
+
+    const fieldModel = model.subModels.fields[0];
+    expect(fieldModel.use).toBe('RecordSelectFieldModel');
+    expect(fieldModel.getStepParams('selectSettings', 'dataScope')).toEqual({ filter });
+  });
+
+  it('leaves the association editor unscoped when the column has no data scope', async () => {
+    const model = await openQuickEditForAssociation();
+
+    expect(model.subModels.fields[0].getStepParams('selectSettings', 'dataScope')).toBeUndefined();
+  });
+
+  it('seeds the edited row before the editor flows run so record variables resolve', async () => {
+    const filter = { logic: '$and', items: [{ path: 'level', operator: 'eq', value: '{{ctx.record.level}}' }] };
+
+    const model = await openQuickEditForAssociation(filter);
+
+    expect(model.resource.getData()).toMatchObject({ id: 7, level: 'senior' });
+    expect(JSON.stringify(model.subModels.fields[0].resource.getFilter() ?? null)).toContain('senior');
+  });
 });
```

**File**: `packages/core/client-v2/src/flow/models/blocks/table/TableColumnModel.tsx` (modified, +31/-0)
```diff
@@ -37,6 +37,7 @@ import { getRowKey } from './utils';
 import { getSavedAssociationTitleField, getTableColumnSortField } from './sortUtils';
 import { getFieldBindingUse, rebuildFieldSubModel } from '../../../internal/utils/rebuildFieldSubModel';
 import { getSavedDateTimeFormatParams, resolveDateTimeDisplayProps } from '../../../utils/dateTimeDisplayProps';
+import { QuickEditDataScopeInput, resolveQuickEditDataScopeStep } from '../../../internal/utils/quickEditDataScope';
 
 export function FieldDeletePlaceholder(props: any) {
   const { t } = useTranslation();
@@ -542,6 +543,36 @@ TableColumnModel.registerFlow({
         ctx.model.setProps('editable', ctx.model.associationPathName ? false : params.editable);
       },
     },
+    quickEditDataScope: {
+      title: tExpr('Data scope'),
+      uiMode: {
+        type: 'dialog',
+        props: {
+          width: 800,
+        },
+      },
+      uiSchema: {
+        filter: {
+          type: 'object',
+          'x-decorator': 'FormItem',
+          'x-component': QuickEditDataScopeInput,
+        },
+      },
+      useRawParams: true,
+      defaultParams: {
+        filter: { logic: '$and', items: [] },
+      },
+      hideInSettings(ctx) {
+        if (ctx.model.associationPathName || !ctx.model.props.editable) {
+          return true;
+        }
+        return !resolveQuickEditDataScopeStep(ctx, ctx.collectionField);
+      },
+      handler() {
+        // Settings-only step. The filter is kept raw on the column and handed to the editor model that
+        // QuickEditFormModel builds when the popover opens, so there is nothing to apply to the column itself.
+      },
+    },
     model: {
       title: tExpr('Field component'),
       use: 'displayFieldComponent',
```

**File**: `packages/core/client-v2/src/flow/models/blocks/table/__tests__/TableColumnModel.test.tsx` (modified, +64/-0)
```diff
@@ -9,8 +9,36 @@
 
 import { FlowEngine } from '@nocobase/flow-engine';
 import { describe, expect, it, vi } from 'vitest';
+// Prime the model module graph so the editable field bindings used by the quick edit data scope setting are registered.
+import '../../../index';
+import { RecordSelectFieldModel } from '../../../fields/AssociationFieldModel/RecordSelectFieldModel';
 import { TableColumnModel } from '../TableColumnModel';
 
+const createQuickEditDataScopeCtx = (
+  overrides: { associationPathName?: string; editable?: boolean; isAssociation?: boolean } = {},
+) => {
+  const engine = new FlowEngine();
+  engine.registerModels({ RecordSelectFieldModel });
+  const { associationPathName, editable = true, isAssociation = true } = overrides;
+  return {
+    engine,
+    model: {
+      associationPathName,
+      props: { editable },
+    },
+    collectionField: {
+      interface: isAssociation ? 'm2o' : 'input',
+      isAssociationField: () => isAssociation,
+      targetCollection: isAssociation ? { template: 'general' } : undefined,
+    },
+  };
+};
+
+const getQuickEditDataScopeStep = (engine: FlowEngine) => {
+  const model = new TableColumnModel({ uid: 'table-column-quick-edit-data-scope', flowEngine: engine } as any);
+  return model.getFlow('tableColumnSettings')?.steps?.quickEditDataScope as any;
+};
+
 describe('TableColumnModel sorter settings', () => {
   it('clamps custom column width to the minimum value', () => {
     const engine = new FlowEngine();
@@ -30,6 +58,42 @@ describe('TableColumnModel sorter settings', () => {
     expect(setProps).toHaveBeenCalledWith('width', 10);
   });
 
+  it('offers the quick edit data scope on an editable association column', async () => {
+    const engine = new FlowEngine();
+    const step = getQuickEditDataScopeStep(engine);
+
+    const hidden = await step.hideInSettings(createQuickEditDataScopeCtx());
+
+    expect(hidden).toBe(false);
+  });
+
+  it('hides the quick edit data scope when quick edit is off', async () => {
+    const engine = new FlowEngine();
+    const step = getQuickEditDataScopeStep(engine);
+
+    const hidden = await step.hideInSettings(createQuickEditDataScopeCtx({ editable: false }));
+
+    expect(hidden).toBe(true);
+  });
+
+  it('hides the quick edit data scope for non-association columns', async () => {
+    const engine = new FlowEngine();
+    const step = getQuickEditDataScopeStep(engine);
+
+    const hidden = await step.hideInSettings(createQuickEditDataScopeCtx({ isAssociation: false }));
+
+    expect(hidden).toBe(true);
+  });
+
+  it('hides the quick edit data scope for relation path columns', async () => {
+    const engine = new FlowEngine();
+    const step = getQuickEditDataScopeStep(engine);
+
+    const hidden = await step.hideInSettings(createQuickEditDataScopeCtx({ associationPathName: 'department' }));
+
+    expect(hidden).toBe(true);
+  });
+
   it('hides quick edit setting for relation path columns added from association groups', async () => {
     const engine = new FlowEngine();
     const model = new TableColumnModel({ uid: 'table-column-relation-path-quick-edit', flowEngine: engine } as any);
```

---

### Incident Patch 9: `3a7ee1cc` (2026-09-28)
**Commit Message**: fix(plugin-action-bulk-update): prevent stale option values from being updated (#10540)

**File**: `packages/plugins/@nocobase/plugin-action-bulk-update/src/client-v2/BulkUpdateActionModel.tsx` (modified, +5/-0)
```diff
@@ -19,6 +19,7 @@ import {
 import { tExpr } from '@nocobase/flow-engine';
 import type { ButtonProps } from 'antd/es/button';
 import { NAMESPACE } from './locale';
+import { getUnavailableAssignedFieldNames } from '../validateAssignedValues';
 
 const SETTINGS_FLOW_KEY = 'assignSettings';
 const AFTER_SUCCESS_DEFAULT_PARAMS = {
@@ -128,6 +129,10 @@ BulkUpdateActionModel.registerFlow({
           ctx.message.error(ctx.t('Collection is required to perform this action'));
           return;
         }
+        if (getUnavailableAssignedFieldNames(ctx.collection, assignedValues).length) {
+          ctx.message.error(ctx.t('The configured field value is no longer available', { ns: NAMESPACE }));
+          return;
+        }
         const updateModeParams = ctx.model.getStepParams(SETTINGS_FLOW_KEY, 'updateMode') || {};
         const mode = updateModeParams?.value || 'selected';
         if (mode === 'selected') {
```

**File**: `packages/plugins/@nocobase/plugin-action-bulk-update/src/client-v2/__tests__/BulkUpdateActionModel.test.ts` (modified, +49/-0)
```diff
@@ -11,6 +11,7 @@ import { FlowEngine, FlowModel, tExpr } from '@nocobase/flow-engine';
 import { describe, expect, it, vi } from 'vitest';
 import { BulkUpdateActionModel } from '../BulkUpdateActionModel';
 import { PluginActionBulkUpdateClient } from '../index';
+import { NAMESPACE } from '../locale';
 
 class TestAssignFormModel extends FlowModel {
   private values: Record<string, unknown> = {};
@@ -571,6 +572,54 @@ describe('BulkUpdateActionModel apply action', () => {
     expect(update).not.toHaveBeenCalled();
   });
 
+  it('does not update with an option value that was removed from the collection field', async () => {
+    const engine = new FlowEngine();
+    const model = new BulkUpdateActionModel({ uid: 'bulk-update-stale-option-action', flowEngine: engine } as never);
+    const update = vi.fn();
+    const handler = model.getFlow('apply')?.getStep('apply')?.serialize().handler;
+    const ctx = {
+      model: {
+        getStepParams: vi.fn((_flowKey: string, stepKey: string) => {
+          if (stepKey === 'updateMode') {
+            return { value: 'all' };
+          }
+          return undefined;
+        }),
+        setProps: vi.fn(),
+      },
+      runAction: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
+      collection: {
+        name: 'posts',
+        getField: vi.fn(() => ({
+          interface: 'select',
+          uiSchema: {
+            enum: [{ label: 'Published', value: 'published' }],
+          },
+        })),
+      },
+      blockModel: {
+        resource: {
+          refresh: vi.fn(),
+        },
+      },
+      api: {
+        resource: vi.fn(() => ({ update })),
+      },
+      message: {
+        success: vi.fn(),
+        warning: vi.fn(),
+        error: vi.fn(),
+      },
+      t: vi.fn((value: string) => value),
+    };
+
+    await handler?.(ctx as never, { assignedValues: { status: 'archived' } } as never);
+
+    expect(ctx.message.error).toHaveBeenCalledWith('The configured field value is no longer available');
+    expect(ctx.t).toHaveBeenCalledWith('The configured field value is no longer available', { ns: NAMESPACE });
+    expect(update).not.toHaveBeenCalled();
+  });
+
   it('exits early when runjs assigned values fail to resolve', async () => {
     const engine = new FlowEngine();
     const model = new BulkUpdateActionModel({ uid: 'bulk-update-runjs-error-action', flowEngine: engine } as never);
```

**File**: `packages/plugins/@nocobase/plugin-action-bulk-update/src/client/utils.tsx` (modified, +40/-31)
```diff
@@ -25,6 +25,7 @@ import { isURL } from '@nocobase/utils/client';
 import { App, message } from 'antd';
 import { useContext } from 'react';
 import { useBulkUpdateTranslation } from './locale';
+import { getUnavailableAssignedFieldNames } from '../validateAssignedValues';
 
 export const useCustomizeBulkUpdateActionProps = () => {
   const { field, resource, __parent, service } = useBlockRequestContext();
@@ -44,42 +45,48 @@ export const useCustomizeBulkUpdateActionProps = () => {
   const localVariables = useLocalVariables();
   return {
     async onClick(e, callBack) {
-      return new Promise<void>(async (resolve) => {
-        const {
-          assignedValues: originalAssignedValues = {},
-          onSuccess,
-          updateMode,
-        } = actionSchema?.['x-action-settings'] ?? {};
-        actionField.data = field.data || {};
-        actionField.data.loading = true;
-        const selectedRecordKeys =
-          tableBlockContext.field?.data?.selectedRowKeys ??
-          expressionScope?.selectedRecordKeys ??
-          tableSelectorContext.field?.data?.selectedRowKeys ??
-          {};
+      const {
+        assignedValues: originalAssignedValues = {},
+        onSuccess,
+        updateMode,
+      } = actionSchema?.['x-action-settings'] ?? {};
+      actionField.data = field.data || {};
+      actionField.data.loading = true;
+      const selectedRecordKeys =
+        tableBlockContext.field?.data?.selectedRowKeys ??
+        expressionScope?.selectedRecordKeys ??
+        tableSelectorContext.field?.data?.selectedRowKeys ??
+        {};
 
-        const assignedValues = {};
-        const waitList = Object.keys(originalAssignedValues).map(async (key) => {
-          const value = originalAssignedValues[key];
-          const collectionField = getField(key);
+      const assignedValues = {};
+      const waitList = Object.keys(originalAssignedValues).map(async (key) => {
+        const value = originalAssignedValues[key];
+        const collectionField = getField(key);
 
-          if (process.env.NODE_ENV !== 'production') {
-            if (!collectionField) {
-              throw new Error(`useCustomizeBulkUpdateActionProps: field "${key}" not found in collection "${name}"`);
-            }
+        if (process.env.NODE_ENV !== 'production') {
+          if (!collectionField) {
+            throw new Error(`useCustomizeBulkUpdateActionProps: field "${key}" not found in collection "${name}"`);
           }
+        }
 
-          if (isVariable(value)) {
-            const result = await variables?.parseVariable(value, localVariables).then(({ value }) => value);
-            if (result) {
-              assignedValues[key] = transformVariableValue(result, { targetCollectionField: collectionField });
-            }
-          } else if (value !== '') {
-            assignedValues[key] = value;
+        if (isVariable(value)) {
+          const result = await variables?.parseVariable(value, localVariables).then(({ value }) => value);
+          if (result) {
+            assignedValues[key] = transformVariableValue(result, { targetCollectionField: collectionField });
           }
-        });
-        await Promise.all(waitList);
+        } else if (value !== '') {
+          assignedValues[key] = value;
+        }
+      });
+      await Promise.all(waitList);
+
+      if (getUnavailableAssignedFieldNames({ getField }, assignedValues).length) {
+        message.error(t('The configured field value is no longer available'));
+        actionField.data.loading = false;
+        return;
+      }
 
+      await new Promise<void>((resolve) => {
         modal.confirm({
           title: t('Bulk update', { ns: 'client' }),
           content:
@@ -97,6 +104,7 @@ export const useCustomizeBulkUpdateActionProps = () => {
               if (!selectedRecordKeys?.length) {
                 message.error(t('Please select the records to be updated'));
                 actionField.data.loading = false;
+                resolve();
                 return;
               }
               updateData.filter = { $and: [{ [rowKey || 'id']: { $in: selectedRecordKeys } }] };
@@ -119,6 +127,7 @@ export const useCustomizeBulkUpdateActionProps = () => {
               __parent?.service?.refresh?.();
             }
             if (!onSuccess?.successMessage) {
+              resolve();
               return;
             }
             if (onSuccess?.manualClose) {
@@ -147,7 +156,7 @@ export const useCustomizeBulkUpdateActionProps = () => {
 
             resolve();
           },
-          async onCancel() {
+          onCancel() {
             actionField.data.loading = false;
             resolve();
           },
```

**File**: `packages/plugins/@nocobase/plugin-action-bulk-update/src/locale/en-US.json` (modified, +3/-2)
```diff
@@ -3,5 +3,6 @@
   "Bulk update": "Bulk update",
   "Bulk update action settings": "Bulk update action settings",
   "Entire collection": "Entire collection",
-  "Please select the records to be updated": "Please select the records to be updated"
-}
\ No newline at end of file
+  "Please select the records to be updated": "Please select the records to be updated",
+  "The configured field value is no longer available": "The configured field value is no longer available"
+}
```

**File**: `packages/plugins/@nocobase/plugin-action-bulk-update/src/locale/zh-CN.json` (modified, +3/-2)
```diff
@@ -3,5 +3,6 @@
   "Bulk update": "批量更新",
   "Bulk update action settings": "批量更新操作设置",
   "Entire collection": "全表",
-  "Please select the records to be updated": "请选择要更新的记录"
-}
\ No newline at end of file
+  "Please select the records to be updated": "请选择要更新的记录",
+  "The configured field value is no longer available": "配置的字段值已不存在，请重新配置"
+}
```

**File**: `packages/plugins/@nocobase/plugin-action-bulk-update/src/validateAssignedValues.test.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+/**
+ * This file is part of the NocoBase (R) project.
+ * Copyright (c) 2020-2024 NocoBase Co., Ltd.
+ * Authors: NocoBase Team.
+ *
+ * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
+ * For more information, please refer to: https://www.nocobase.com/agreement.
+ */
+
+import { describe, expect, it } from 'vitest';
+import { getUnavailableAssignedFieldNames } from './validateAssignedValues';
+
+describe('getUnavailableAssignedFieldNames', () => {
+  it('finds removed values in single and multiple option fields', () => {
+    const fields = {
+      status: {
+        interface: 'select',
+        uiSchema: { enum: [{ label: 'Published', value: 'published' }] },
+      },
+      tags: {
+        interface: 'multipleSelect',
+        uiSchema: { enum: ['frontend', 'backend'] },
+      },
+    };
+
+    expect(
+      getUnavailableAssignedFieldNames(
+        { getField: (name: string) => fields[name as keyof typeof fields] },
+        {
+          status: 'archived',
+          tags: ['frontend', 'archived'],
+        },
+      ),
+    ).toEqual(['status', 'tags']);
+  });
+
+  it('keeps valid values and skips dynamic or empty values', () => {
+    const fields = {
+      status: {
+        interface: 'radioGroup',
+        enum: [1, 2],
+      },
+      relation: {
+        interface: 'collection',
+        uiSchema: { enum: [{ label: 'Dynamic record', value: 'record-1' }] },
+      },
+    };
+
+    expect(
+      getUnavailableAssignedFieldNames(
+        { getField: (name: string) => fields[name as keyof typeof fields] },
+        {
+          status: 2,
+          relation: 'record-2',
+          missing: 'ignored',
+          cleared: null,
+        },
+      ),
+    ).toEqual([]);
+  });
+});
```

**File**: `packages/plugins/@nocobase/plugin-action-bulk-update/src/validateAssignedValues.ts` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+/**
+ * This file is part of the NocoBase (R) project.
+ * Copyright (c) 2020-2024 NocoBase Co., Ltd.
+ * Authors: NocoBase Team.
+ *
+ * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
+ * For more information, please refer to: https://www.nocobase.com/agreement.
+ */
+
+type CollectionFieldLike = {
+  enum?: unknown;
+  interface?: unknown;
+  uiSchema?: unknown;
+};
+
+const LOCAL_ENUM_INTERFACES = new Set(['select', 'multipleSelect', 'radioGroup', 'checkboxGroup']);
+
+function isRecord(value: unknown): value is Record<string, unknown> {
+  return typeof value === 'object' && value !== null;
+}
+
+function getOptionValue(option: unknown): unknown {
+  if (!isRecord(option)) {
+    return option;
+  }
+  if ('value' in option) {
+    return option.value;
+  }
+  return 'label' in option ? option.label : option;
+}
+
+function getFieldEnum(field: CollectionFieldLike): unknown[] | undefined {
+  if (Array.isArray(field.enum)) {
+    return field.enum.map(getOptionValue);
+  }
+
+  if (!isRecord(field.uiSchema) || !Array.isArray(field.uiSchema.enum)) {
+    return undefined;
+  }
+
+  return field.uiSchema.enum.map(getOptionValue);
+}
+
+function hasOptionValue(value: unknown, options: unknown[]): boolean {
+  if (Array.isArray(value)) {
+    return value.every((item) => options.some((option) => Object.is(option, item)));
+  }
+  return options.some((option) => Object.is(option, value));
+}
+
+export function getUnavailableAssignedFieldNames(collection: unknown, assignedValues: unknown): string[] {
+  if (!isRecord(collection) || typeof collection.getField !== 'function' || !isRecord(assignedValues)) {
+    return [];
+  }
+
+  const unavailable: string[] = [];
+  for (const [fieldName, value] of Object.entries(assignedValues)) {
+    if (value === null || typeof value === 'undefined') {
+      continue;
+    }
+
+    const field = collection.getField(fieldName);
+    if (!isRecord(field)) {
+      continue;
+    }
+
+    const fieldInterface = field.interface;
+    if (typeof fieldInterface !== 'string' || !LOCAL_ENUM_INTERFACES.has(fieldInterface)) {
+      continue;
+    }
+
+    const options = getFieldEnum(field as CollectionFieldLike);
+    if (options && !hasOptionValue(value, options)) {
+      unavailable.push(fieldName);
+    }
+  }
+
+  return unavailable;
+}
```

---

### Incident Patch 10: `7c7f1c2f` (2026-09-28)
**Commit Message**: fix(client-v2): clear cached routes when the session ends (#10549)

After signing out in-page and signing in as another user, the admin
entry reused the previous user's cached accessible routes and redirected
to a page the new user cannot access, showing 404.

Clear the route repository caches when the auth token is cleared (sign
out or invalid token) so the next user always loads their own routes.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/core/client-v2/src/BaseApplication.tsx` (modified, +2/-0)
```diff
@@ -274,6 +274,8 @@ export abstract class BaseApplication<
     this.eventBus.addEventListener('auth:tokenChanged', (event: Event) => {
       const detail = (event as CustomEvent<AuthTokenPayload>).detail;
       if (!detail?.token) {
+        // 登录态已结束（退出登录或 token 失效），清空路由缓存，避免下一个用户沿用上一个用户的可访问路由。
+        this.context.routeRepository?.clear();
         return;
       }
       this.setTokenInWebSocket(detail);
```

**File**: `packages/core/client-v2/src/RouteRepository.ts` (modified, +14/-0)
```diff
@@ -153,6 +153,20 @@ export class RouteRepository {
     return loadingPromise;
   }
 
+  /**
+   * 清空所有布局的路由缓存，并丢弃清空前发起的请求结果。
+   *
+   * 用于登录态失效（如退出登录）时，避免下一个用户沿用上一个用户的可访问路由。
+   */
+  clear() {
+    this.routeCaches.clear();
+    this.accessibleLoadingPromises.clear();
+    this.refreshRequestIds.forEach((requestId, layoutUid) => {
+      this.refreshRequestIds.set(layoutUid, requestId + 1);
+    });
+    this.syncRoutesProperty();
+  }
+
   /**
    * 订阅路由缓存变化，用于驱动 React 上下文刷新。
    *
```

**File**: `packages/core/client-v2/src/__tests__/RouteRepository.test.ts` (modified, +51/-0)
```diff
@@ -193,6 +193,57 @@ describe('RouteRepository', () => {
     unsubscribeCustom();
   });
 
+  it('should drop cached routes of every layout when cleared', () => {
+    const { repository } = createRouteRepository();
+
+    repository.setRoutes([route('admin-page')], 'admin-layout-model');
+    repository.setRoutes([route('custom-page')], 'custom-desktop-layout-model');
+
+    repository.clear();
+
+    expect(repository.isAccessibleLoaded()).toBe(false);
+    expect(repository.listAccessible()).toEqual([]);
+    expect(repository.routes).toEqual([]);
+    const deactivateLayout = repository.activateLayout({
+      uid: 'custom-desktop-layout-model',
+    });
+    expect(repository.isAccessibleLoaded()).toBe(false);
+    expect(repository.listAccessible()).toEqual([]);
+    deactivateLayout();
+  });
+
+  it('should reload accessible routes after being cleared', async () => {
+    const { repository, request } = createRouteRepository();
+    request.mockResolvedValueOnce({ data: { data: [route('previous-user-page')] } });
+    await repository.ensureAccessibleLoaded();
+
+    repository.clear();
+    request.mockResolvedValueOnce({ data: { data: [route('next-user-page')] } });
+    const routes = await repository.ensureAccessibleLoaded();
+
+    expect(request).toHaveBeenCalledTimes(2);
+    expect(routes.map((item) => item.schemaUid)).toEqual(['next-user-page']);
+  });
+
+  it('should ignore refresh results requested before being cleared', async () => {
+    const { repository, request } = createRouteRepository();
+    let resolveStaleRequest: (value: unknown) => void = () => {};
+    request.mockImplementationOnce(
+      () =>
+        new Promise((resolve) => {
+          resolveStaleRequest = resolve;
+        }),
+    );
+
+    const staleRefresh = repository.refreshAccessible();
+    repository.clear();
+    resolveStaleRequest({ data: { data: [route('previous-user-page')] } });
+    await staleRefresh;
+
+    expect(repository.isAccessibleLoaded()).toBe(false);
+    expect(repository.listAccessible()).toEqual([]);
+  });
+
   it('should pass the default admin layout when creating a route', async () => {
     const { repository, create } = createRouteRepository();
 
```

**File**: `packages/core/client-v2/src/__tests__/app.test.tsx` (modified, +13/-0)
```diff
@@ -171,6 +171,19 @@ describe('app', () => {
       expect(document.documentElement.lang).toBe('ja-JP');
     });
 
+    it('should clear cached accessible routes when the auth token is cleared', () => {
+      const app = new Application({ router });
+      const routeRepository = app.flowEngine.context.routeRepository;
+      routeRepository.setRoutes([{ schemaUid: 'previous-user-page' }]);
+
+      app.apiClient.auth.setToken('renewed-token');
+      expect(routeRepository.listAccessible().map((route) => route.schemaUid)).toEqual(['previous-user-page']);
+
+      app.apiClient.auth.setToken(null);
+      expect(routeRepository.isAccessibleLoaded()).toBe(false);
+      expect(routeRepository.listAccessible()).toEqual([]);
+    });
+
     it('should escape app version html placeholder content', () => {
       expect(getAppVersionHTML('<script>alert(1)</script>&"')).toBe(
         '<span class="nb-app-version">v&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;</span>',
```

**File**: `packages/core/client/src/route-switch/antd/admin-layout/__tests__/route-runtime.test.tsx` (modified, +46/-0)
```diff
@@ -10,8 +10,12 @@
 import { act, render, screen, userEvent, waitFor } from '@nocobase/test/client';
 import { RouteRepository } from '@nocobase/client-v2';
 import React from 'react';
+import { MemoryRouter, useLocation } from 'react-router-dom';
 import { describe, expect, it, vi } from 'vitest';
+import { CustomRouterContextProvider } from '../../../../application/CustomRouterContextProvider';
+import { NavigateToDefaultPage } from '../AdminShellProvider';
 import { RoutesRequestProvider, useAllAccessDesktopRoutes } from '../route-runtime';
+import { NocoBaseDesktopRouteType } from '../route-types';
 
 vi.mock('@nocobase/flow-engine', async (importOriginal) => {
   const actual = await importOriginal<typeof import('@nocobase/flow-engine')>();
@@ -123,4 +127,46 @@ describe('RoutesRequestProvider', () => {
 
     consoleErrorSpy.mockRestore();
   });
+
+  it('should land on the next user first page instead of a page cached for the previous user', async () => {
+    const api = {
+      request: vi.fn().mockResolvedValue({
+        data: {
+          data: [{ id: 2, schemaUid: 'next-user-page', type: NocoBaseDesktopRouteType.page }],
+        },
+      }),
+    } as any;
+    const routeRepository = new RouteRepository({ api });
+    routeRepository.setRoutes([
+      { id: 1, schemaUid: 'previous-user-page', type: NocoBaseDesktopRouteType.page },
+      { id: 2, schemaUid: 'next-user-page', type: NocoBaseDesktopRouteType.page },
+    ]);
+    // Signing out clears the auth token, which drops the routes cached for the previous user.
+    routeRepository.clear();
+
+    mockedUseFlowEngineContext.mockReturnValue({
+      routeRepository,
+    } as any);
+
+    const PathnameDisplay = () => <div data-testid="pathname">{useLocation().pathname}</div>;
+
+    await act(async () => {
+      render(
+        <MemoryRouter initialEntries={['/admin']}>
+          <CustomRouterContextProvider>
+            <RoutesRequestProvider>
+              <NavigateToDefaultPage>
+                <PathnameDisplay />
+              </NavigateToDefaultPage>
+            </RoutesRequestProvider>
+          </CustomRouterContextProvider>
+        </MemoryRouter>,
+      );
+    });
+
+    await waitFor(() => {
+      expect(screen.getByTestId('pathname').textContent).toBe('/admin/next-user-page');
+    });
+    expect(api.request).toHaveBeenCalledTimes(1);
+  });
 });
```

---

### Incident Patch 11: `0b976ede` (2026-09-25)
**Commit Message**: fix(plugin-block-grid-card): restore simple pagination switching (#10541)

**File**: `packages/plugins/@nocobase/plugin-block-grid-card/src/client-v2/models/GridCardBlockModel.tsx` (modified, +8/-0)
```diff
@@ -151,13 +151,21 @@ export class GridCardBlockModel extends CollectionBlockModel<GridBlockModelStruc
         showTitle: false,
         showSizeChanger: true,
         hideOnSinglePage: false,
+        current: nextCurrent,
         pageSize: nextPageSize,
+        pageSizeOptions,
         total: getUnknownCountPaginationTotal({
           dataLength: data?.length,
           pageSize: nextPageSize,
           current: nextCurrent,
           hasNext,
         }),
+        onChange: (page, pageSize) => {
+          this.resource.loading = true;
+          this.resource.setPage(page);
+          this.resource.setPageSize(pageSize);
+          this.resource.refresh();
+        },
         className: mergePaginationClassName(getSimpleModePaginationClassName(true), undefined),
         itemRender: createCompactSimpleItemRender({
           current: nextCurrent,
```

**File**: `packages/plugins/@nocobase/plugin-block-grid-card/src/client-v2/models/__tests__/GridCardBlockModel.pagination.test.ts` (modified, +18/-0)
```diff
@@ -99,6 +99,24 @@ describe('GridCardBlockModel pagination', () => {
     expect(pagination.showSizeChanger).toBe(false);
     expect(pagination.showTotal).toBe(false);
     expect(pagination.total).toBe(13);
+    expect(pagination.pageSizeOptions).toEqual([9, 18, 27, 45, 90]);
     expect(typeof pagination.itemRender).toBe('function');
   });
+
+  it('未知总数时切换分页会更新资源并刷新数据', () => {
+    const { model, setPage, setPageSize, refresh } = createGridCardModel({
+      count: 0,
+      page: 1,
+      pageSize: 12,
+      hasNext: true,
+      dataLength: 12,
+    });
+
+    const pagination = model.pagination() as any;
+    pagination.onChange(2, 24);
+
+    expect(setPage).toHaveBeenCalledWith(2);
+    expect(setPageSize).toHaveBeenCalledWith(24);
+    expect(refresh).toHaveBeenCalledTimes(1);
+  });
 });
```

---

### Incident Patch 12: `a11bad20` (2026-09-24)
**Commit Message**: fix(client): support local schema persistence (#10545)

**File**: `packages/core/client/src/schema-component/common/dnd-context/index.tsx` (modified, +3/-2)
```diff
@@ -15,7 +15,7 @@ import { useAPIClient } from '../../../api-client/hooks/useAPIClient';
 import { createDesignable, useDesignable } from '../../hooks/useDesignable';
 
 const useDragEnd = (onDragEnd) => {
-  const { refresh } = useDesignable();
+  const { localPersistence, refresh } = useDesignable();
   const api = useAPIClient();
   const { t } = useTranslation();
 
@@ -49,6 +49,7 @@ const useDragEnd = (onDragEnd) => {
         api,
         refresh: ({ refreshParentSchema = true } = {}) => refresh({ refreshParentSchema }),
         current: overSchema,
+        localPersistence,
       });
 
       dn.loadAPIClientEvents();
@@ -70,7 +71,7 @@ const useDragEnd = (onDragEnd) => {
         return;
       }
     },
-    [api, onDragEnd, refresh, t],
+    [api, localPersistence, onDragEnd, refresh, t],
   );
 };
 
```

**File**: `packages/core/client/src/schema-component/hooks/__tests__/designable.test.ts` (modified, +65/-0)
```diff
@@ -9,6 +9,7 @@
 
 import { vi } from 'vitest';
 import { Schema } from '@formily/react';
+import type { APIClient } from '../../../api-client';
 import { createDesignable, Designable } from '../useDesignable';
 
 describe('createDesignable', () => {
@@ -271,6 +272,70 @@ describe('createDesignable', () => {
   });
 });
 
+describe('local persistence', () => {
+  test('updates and refreshes the local schema without sending UI schema requests', async () => {
+    const schema = new Schema({
+      type: 'void',
+      name: 'grid',
+      'x-uid': 'grid',
+      properties: {
+        current: {
+          type: 'void',
+          'x-uid': 'current',
+        },
+      },
+    });
+    const request = vi.fn();
+    const refresh = vi.fn();
+    const dn = createDesignable({
+      api: { request } as unknown as APIClient,
+      current: schema.properties.current,
+      localPersistence: true,
+      refresh,
+    });
+    dn.loadAPIClientEvents();
+
+    await dn.insertAfterEnd({
+      name: 'local',
+      type: 'void',
+    });
+    await dn.emit('patch', { schema: { 'x-uid': 'current', title: 'Local title' } });
+    await dn.emit('batchPatch', { schemas: [{ 'x-uid': 'current', title: 'Local title' }] });
+    await dn.emit('initializeActionContext', { schema: { 'x-uid': 'current' } });
+    await dn.remove();
+
+    expect(schema.properties.local).toBeDefined();
+    expect(schema.properties.current).toBeUndefined();
+    expect(refresh).toHaveBeenCalledTimes(4);
+    expect(request).not.toHaveBeenCalled();
+  });
+
+  test('keeps remote persistence enabled by default', async () => {
+    const schema = new Schema({
+      type: 'void',
+      name: 'current',
+      'x-uid': 'current',
+    });
+    const request = vi.fn().mockResolvedValue({});
+    const dn = createDesignable({
+      api: { request } as unknown as APIClient,
+      current: schema,
+    });
+    dn.loadAPIClientEvents();
+
+    await dn.emit('patch', { schema: { 'x-uid': 'current', title: 'Remote title' } });
+
+    expect(request).toHaveBeenCalledWith({
+      url: '/uiSchemas:patch',
+      method: 'post',
+      data: {
+        'x-uid': 'current',
+        title: 'Remote title',
+      },
+    });
+  });
+});
+
 describe('x-index', () => {
   let dn: Designable;
   let schema: Schema;
```

**File**: `packages/core/client/src/schema-component/hooks/useDesignable.tsx` (modified, +28/-9)
```diff
@@ -33,6 +33,7 @@ interface CreateDesignableProps {
   query?: Query;
   api?: APIClient;
   refresh?: (options?: { refreshParentSchema?: boolean }) => void;
+  localPersistence?: boolean;
   onSuccess?: any;
   t?: any;
   /**
@@ -146,8 +147,8 @@ export class Designable {
   }
 
   loadAPIClientEvents() {
-    const { api, t = translate } = this.options;
-    if (!api) {
+    const { api, localPersistence = false, t = translate } = this.options;
+    if (!api && !localPersistence) {
       return;
     }
     const updateColumnSize = (parent: Schema) => {
@@ -180,7 +181,7 @@ export class Designable {
         schemas = schemas.concat(updateColumnSize(removed.parent));
       }
       this.refresh();
-      if (!current['x-uid']) {
+      if (localPersistence || !api || !current['x-uid']) {
         return;
       }
       const res = await api.request({
@@ -209,7 +210,7 @@ export class Designable {
     });
     this.on('patch', async ({ schema }) => {
       this.refresh();
-      if (!schema?.['x-uid']) {
+      if (localPersistence || !api || !schema?.['x-uid']) {
         return;
       }
       await api.request({
@@ -222,7 +223,7 @@ export class Designable {
       message.success(t('Saved successfully'), 0.2);
     });
     this.on('initializeActionContext', async ({ schema }) => {
-      if (!schema?.['x-uid']) {
+      if (localPersistence || !api || !schema?.['x-uid']) {
         return;
       }
       await api.request({
@@ -235,6 +236,9 @@ export class Designable {
     });
     this.on('batchPatch', async ({ schemas }) => {
       this.refresh();
+      if (localPersistence || !api) {
+        return;
+      }
       await api.request({
         url: `/uiSchemas:batchPatch`,
         method: 'post',
@@ -248,7 +252,7 @@ export class Designable {
         schemas = updateColumnSize(removed.parent);
       }
       this.refresh();
-      if (!removed?.['x-uid']) {
+      if (localPersistence || !api || !removed?.['x-uid']) {
         return;
       }
       await api.request({
@@ -745,7 +749,13 @@ export function useFindComponent() {
 
 // TODO
 export function useDesignable() {
-  const { designable, setDesignable, refresh: refreshFromContext, reset } = useContext(SchemaComponentContext);
+  const {
+    designable,
+    localPersistence,
+    setDesignable,
+    refresh: refreshFromContext,
+    reset,
+  } = useContext(SchemaComponentContext);
   const schemaOptions = useContext(SchemaOptionsContext);
   const components = useMemo(() => schemaOptions?.components || {}, [schemaOptions]);
   const DesignableBar = useMemo(
@@ -774,8 +784,16 @@ export function useDesignable() {
   const api = useAPIClient();
   const { t } = useTranslation();
   const dn = useMemo(() => {
-    return createDesignable({ t, api, refresh, current: fieldSchema, model: field, appVersion: clientPkg.version });
-  }, [t, api, refresh, fieldSchema, field]);
+    return createDesignable({
+      t,
+      api,
+      refresh,
+      current: fieldSchema,
+      model: field,
+      appVersion: clientPkg.version,
+      localPersistence,
+    });
+  }, [t, api, refresh, fieldSchema, field, localPersistence]);
 
   useEffect(() => {
     dn.loadAPIClientEvents();
@@ -786,6 +804,7 @@ export function useDesignable() {
   return {
     dn,
     designable: isMobileLayout ? false : designable,
+    localPersistence,
     reset,
     refresh,
     setDesignable,
```

**File**: `packages/core/client/src/schema-component/types.ts` (modified, +2/-0)
```diff
@@ -18,6 +18,8 @@ export interface ISchemaComponentContext {
   reset?: () => void;
   designable?: boolean;
   setDesignable?: (value: boolean) => void;
+  /** Keep schema changes in the current context without persisting them through the UI schema API. */
+  localPersistence?: boolean;
   SchemaField?: React.FC<ISchemaFieldProps>;
   distributed?: boolean;
   [key: string]: any;
```

**File**: `packages/plugins/@nocobase/plugin-workflow-manual/src/client/instruction/SchemaConfig.tsx` (modified, +1/-0)
```diff
@@ -511,6 +511,7 @@ export function SchemaConfig({ value, onChange }) {
       value={{
         ...ctx,
         designable: !executed,
+        localPersistence: true,
         refresh,
       }}
     >
```

---

### Incident Patch 13: `9dc4393b` (2026-09-24)
**Commit Message**: fix(client-v2): save association fields in sub-table columns (#10544)

**File**: `packages/core/client-v2/src/flow/models/fields/AssociationFieldModel/SubTableFieldModel/SubTableColumnModel.tsx` (modified, +5/-0)
```diff
@@ -620,6 +620,11 @@ export class SubTableColumnModel<
 
   onInit(options: any): void {
     super.onInit(options);
+    const resource = this.context.blockModel?.context?.resource;
+    const fieldPath = this.context.fieldPath;
+    if (resource?.addUpdateAssociationValues && fieldPath && this.collectionField?.isAssociationField?.()) {
+      resource.addUpdateAssociationValues(fieldPath);
+    }
     this.context.defineProperty('resourceName', {
       get: () => {
         return this.context.collectionField.collection.name;
```

---

### Incident Patch 14: `0b1bc323` (2026-09-24)
**Commit Message**: fix(plugin-workflow-aggregate): preserve associated collection fields (#10543)

**File**: `packages/plugins/@nocobase/plugin-workflow-aggregate/src/client-v2/__tests__/aggregateFieldset.test.tsx` (modified, +17/-0)
```diff
@@ -177,4 +177,21 @@ describe('AggregateFieldset', () => {
       expect(getForm()?.getFieldValue(['config', 'params', 'filter'])).toBeNull();
     });
   });
+
+  it('keeps showing fields from an associated collection after the collection field is unmounted', async () => {
+    const getForm = renderWithForm({
+      config: {
+        aggregator: 'count',
+        associated: true,
+        collection: 'comments',
+        association: { name: 'comments' },
+      },
+    });
+
+    await waitFor(() => {
+      expect(screen.getByLabelText('field')).toHaveAttribute('data-collection', 'comments');
+      expect(screen.getByTestId('filter')).toHaveAttribute('data-collection', 'comments');
+      expect(getForm()?.getFieldValue(['config', 'collection'])).toBe('comments');
+    });
+  });
 });
```

**File**: `packages/plugins/@nocobase/plugin-workflow-aggregate/src/client-v2/components/AggregateFieldset.tsx` (modified, +4/-2)
```diff
@@ -31,7 +31,9 @@ function AggregateFieldSelect({ collection }: { collection?: string }) {
 
 function AggregateParamsFields() {
   const t = useT();
-  const collection = Form.useWatch(['config', 'collection']);
+  // The collection field is conditionally rendered when aggregating an associated collection. Keep watching its
+  // value after that field is unmounted so the aggregate field and filter selectors can still load the target table.
+  const collection = Form.useWatch(['config', 'collection'], { preserve: true });
   const aggregator = Form.useWatch(['config', 'aggregator']);
 
   if (!collection) {
@@ -57,7 +59,7 @@ export function AggregateFieldset() {
   const t = useT();
   const form = Form.useFormInstance();
   const associated = Form.useWatch(['config', 'associated']);
-  const collection = Form.useWatch(['config', 'collection']);
+  const collection = Form.useWatch(['config', 'collection'], { preserve: true });
   const associatedTargetOptions = [
     { label: t('Data of collection'), value: ASSOCIATED_TARGETS.COLLECTION },
     { label: t('Data of associated collection'), value: ASSOCIATED_TARGETS.ASSOCIATION },
```

---

### Incident Patch 15: `912b9395` (2026-09-24)
**Commit Message**: fix(deps): upgrade vulnerable application dependencies (#10542)

* fix(deps): upgrade vulnerable application dependencies

* fix(deps): narrow overrides and update Hono adapter

* fix(deps): pin request qs to patched version

* fix(deps): close remaining gaps from the vulnerability scan

Widen the qs override to `**/qs`. The previous `**/request/qs` pattern
only matches when `request` itself depends on qs, so it never covered
`express -> qs@~6.15.1`; qs 6.15.3 stayed in the lockfile and failed the
Dependency Review check.

Bump joi in @nocobase/database, the one package still pinned to ^17.13.3,
so joi 17.13.3 is no longer installed next to 17.13.8.

Drop @types/decompress, which became dead when decompress was replaced by
@xhmikosr/decompress, and declare the subset of that package used by the
server and plugins, since it ships no type declarations of its own.

* fix(test): use named type import for mariadb Connection

mariadb v2 typings were `export =` plus `declare namespace mariadb`, so
`mariadb.Connection` resolved as a namespace type. v3 exports its types
as plain named exports, so that reference fails with TS2503 and broke the
declaration build. Import `Connection` directly;

**File**: `package.json` (modified, +6/-3)
```diff
@@ -67,7 +67,10 @@
     "nwsapi": "2.2.7",
     "antd": "5.24.2",
     "dayjs": "1.11.13",
-    "eslint": "8.57.1"
+    "eslint": "8.57.1",
+    "**/@rushstack/node-core-library/ajv": "8.18.0",
+    "**/pm2/js-yaml": "4.3.2",
+    "**/qs": "6.16.0"
   },
   "config": {
     "ghooks": {
@@ -97,11 +100,11 @@
     "eslint-plugin-react": "^7.37.5",
     "eslint-plugin-testing-library": "^5.11.0",
     "ghooks": "^2.0.4",
-    "joi": "^17.13.3",
+    "joi": "^17.13.6",
     "lint-staged": "^13.2.3",
     "loadjs": "^4.3.0",
     "patch-package": "^8.0.0",
-    "pm2": "^6.0.5",
+    "pm2": "^7.0.0",
     "pretty-format": "^24.0.0",
     "pretty-quick": "^3.1.0",
     "react": "^18.0.0",
```

**File**: `packages/core/cli-v1/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "fast-glob": "^3.3.1",
     "fs-extra": "^11.1.1",
     "p-all": "3.0.0",
-    "pm2": "^6.0.5",
+    "pm2": "^7.0.0",
     "portfinder": "^1.0.28",
     "tar": "^7.4.3",
     "tree-kill": "^1.2.2"
```

**File**: `packages/core/cli-v1/src/__tests__/client-upload.test.js` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+/**
+ * This file is part of the NocoBase (R) project.
+ * Copyright (c) 2020-2024 NocoBase Co., Ltd.
+ * Authors: NocoBase Team.
+ *
+ * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
+ * For more information, please refer to: https://www.nocobase.com/agreement.
+ */
+
+/* eslint-env jest */
+/* global vi */
+
+const { putWithRetry, OSS_TIMEOUT, OSS_MAX_ATTEMPTS } = require('../commands/client')._test;
+
+describe('cli-v1 client:upload', () => {
+  let warn;
+
+  beforeEach(() => {
+    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
+  });
+
+  afterEach(() => {
+    warn.mockRestore();
+  });
+
+  it('should raise the ali-oss response timeout above its 60s default', () => {
+    expect(OSS_TIMEOUT).toBeGreaterThan(60000);
+  });
+
+  it('should return the result without retrying when the upload succeeds', async () => {
+    const put = vi.fn().mockResolvedValue({ name: 'a.js' });
+
+    await expect(putWithRetry({ put }, 'a.js', '/tmp/a.js')).resolves.toEqual({ name: 'a.js' });
+
+    expect(put).toHaveBeenCalledTimes(1);
+    expect(put).toHaveBeenCalledWith('a.js', '/tmp/a.js');
+    expect(warn).not.toHaveBeenCalled();
+  });
+
+  it('should retry a transient timeout and resolve', async () => {
+    const put = vi
+      .fn()
+      .mockRejectedValueOnce(new Error('Response timeout for 60000ms'))
+      .mockResolvedValue({ name: 'a.js' });
+
+    await expect(putWithRetry({ put }, 'a.js', '/tmp/a.js')).resolves.toEqual({ name: 'a.js' });
+
+    expect(put).toHaveBeenCalledTimes(2);
+    expect(warn).toHaveBeenCalledTimes(1);
+  });
+
+  it('should give up and rethrow after the attempt limit', async () => {
+    const error = new Error('Response timeout for 60000ms');
+    const put = vi.fn().mockRejectedValue(error);
+
+    await expect(putWithRetry({ put }, 'a.js', '/tmp/a.js')).rejects.toThrow(error);
+
+    expect(put).toHaveBeenCalledTimes(OSS_MAX_ATTEMPTS);
+  });
+});
```

**File**: `packages/core/cli-v1/src/commands/client.js` (modified, +33/-1)
```diff
@@ -63,6 +63,31 @@ async function writeActiveVersion(version) {
   return activeVersionFile;
 }
 
+// 客户端资源里有体积较大的 bundle，ali-oss 默认的 60s 响应超时在 CI 上不够用。
+const OSS_TIMEOUT = 300000;
+// 单个文件偶发超时不应该让整次上传前功尽弃，做有限重试。
+const OSS_MAX_ATTEMPTS = 3;
+
+/**
+ * 上传单个文件，对偶发失败重试
+ * @param {Client} client - OSS 客户端实例
+ * @param {string} ossKey - OSS 对象名
+ * @param {string} filePath - 本地文件路径
+ */
+async function putWithRetry(client, ossKey, filePath) {
+  for (let attempt = 1; ; attempt++) {
+    try {
+      return await client.put(ossKey, filePath);
+    } catch (error) {
+      if (attempt >= OSS_MAX_ATTEMPTS) {
+        throw error;
+      }
+      console.warn(chalk.yellow(`Retrying ${ossKey} (${attempt}/${OSS_MAX_ATTEMPTS - 1}): ${error.message}`));
+      await new Promise((_resolve) => setTimeout(_resolve, attempt * 2000));
+    }
+  }
+}
+
 /**
  * 递归上传目录到 OSS
  * @param {Client} client - OSS 客户端实例
@@ -96,7 +121,7 @@ async function uploadDirectoryToOSS(client, localDir, ossPrefix = '') {
       // 上传文件
       const ossKey = ossPrefix ? `${ossPrefix}/${file}` : file;
       try {
-        await client.put(ossKey, filePath);
+        await putWithRetry(client, ossKey, filePath);
         // console.log(chalk.green(`Uploaded: ${ossKey}`));
         uploadedCount++;
       } catch (error) {
@@ -179,6 +204,7 @@ module.exports = (cli) => {
         accessKeySecret: process.env.CDN_ALI_OSS_ACCESS_KEY_SECRET,
         bucket: process.env.CDN_ALI_OSS_BUCKET,
         region: process.env.CDN_ALI_OSS_REGION,
+        timeout: OSS_TIMEOUT,
       });
 
       if (!(await fs.exists(target))) {
@@ -198,3 +224,9 @@ module.exports = (cli) => {
       }
     });
 };
+
+module.exports._test = {
+  putWithRetry,
+  OSS_TIMEOUT,
+  OSS_MAX_ATTEMPTS,
+};
```

**File**: `packages/core/client/package.json` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@
     "react-quill": "^2.0.0",
     "react-router-dom": "^6.30.1",
     "react-to-print": "^2.14.7",
-    "sanitize-html": "2.17.5",
+    "sanitize-html": "2.17.7",
     "tabulator-tables": "^6.3.1",
     "use-deep-compare-effect": "^1.8.1",
     "vditor": "^3.10.3"
```

**File**: `packages/core/create-nocobase-app/templates/app/package.json` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
     "semver": "^7.7.1"
   },
   "dependencies": {
-    "pm2": "^6.0.5",
+    "pm2": "^7.0.0",
     "mysql2": "^3.14.0",
     "mariadb": "^2.5.6",
     "pg": "^8.14.1",
```

**File**: `packages/core/database/package.json` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
     "flat": "^5.0.2",
     "glob": "^7.1.6",
     "graphlib": "^2.1.8",
-    "joi": "^17.13.3",
+    "joi": "^17.13.6",
     "lodash": "^4.17.21",
     "nanoid": "^3.3.11",
     "node-fetch": "^2.6.7",
```

**File**: `packages/core/server/package.json` (modified, +1/-2)
```diff
@@ -25,7 +25,6 @@
     "@nocobase/snowflake-id": "2.2.17",
     "@nocobase/telemetry": "2.2.17",
     "@nocobase/utils": "2.2.17",
-    "@types/decompress": "4.2.7",
     "@types/ini": "^1.3.31",
     "@types/koa-send": "^4.1.3",
     "@types/multer": "^1.4.12",
@@ -37,7 +36,7 @@
     "cron": "^2.4.4",
     "cronstrue": "^2.11.0",
     "dayjs": "^1.11.8",
-    "decompress": "4.2.1",
+    "@xhmikosr/decompress": "^11.1.4",
     "find-package-json": "^1.2.0",
     "fs-extra": "^11.1.1",
     "i18next": "^22.4.9",
```

#### Recent Merged Pull Requests:
- **PR #10566** (2026-09-30): fix(deps): upgrade axios to 1.20.0 (@2013xile)
- **PR #10564** (closed): fix(deps): align axios with main to unbreak the sdk type build (@2013xile)
- **PR #10563** (2026-10-05): fix(client-v2): keep empty cardless JS blocks accessible in the UI editor (@gchust)
- **PR #10561** (2026-10-05): fix(plugin-ui-templates): hide template collection from block choices (@gchust)
- **PR #10560** (2026-09-29): feat(plugin-ai): expose referenced knowledge base documents in chat responses (@cgyrock)
- **PR #10555** (2026-09-29): fix(deps): close js-yaml and uuid advisories from the latest scan (@2013xile)
- **PR #10554** (2026-09-29): fix(client-v2): show popup parent record variable in quick create popups of unsaved forms (@zhangzhonghe)
- **PR #10553** (2026-09-30): fix(plugin-kanban): prevent action bar layout flicker (@jiannx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
