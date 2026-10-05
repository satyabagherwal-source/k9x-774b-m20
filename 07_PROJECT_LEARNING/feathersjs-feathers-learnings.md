# Forensic Learning Record (Deep Inspection): feathersjs/feathers

> **Canonical Artifact**: `07_PROJECT_LEARNING/feathersjs-feathers-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feathersjs/feathers](https://github.com/feathersjs/feathers))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:51:58.619Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feathersjs/feathers`
- **Description**: The API and real-time application framework
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15256 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/authentication-client/src/core.ts`
```
import { NotAuthenticated, FeathersError } from '@feathersjs/errors'
import { Application, Params } from '@feathersjs/feathers'
import { AuthenticationRequest, AuthenticationResult } from '@feathersjs/authentication'
import { Storage, StorageWrapper } from './storage'

class OauthError extends FeathersError {
  constructor(message: string, data?: any) {
    super(message, 'OauthError', 401, 'oauth-error', data)
  }
}

const getMatch = (location: Location, key: string): [string, RegExp] => {
  const regex = new RegExp(`(?:\&?)${key}=([^&]*)`)
  const match = location.hash ? location.hash.match(regex) : null

  if (match !== null) {
    const [, value] = match

    return [value, regex]
  }

  return [null, regex]
}

export type ClientConstructor = new (
  app: Application,
  options: AuthenticationClientOptions
) => AuthenticationClient

export interface AuthenticationClientOptions {
  storage: Storage
  header: string
  scheme: string
  storageKey: string
  locationKey: string
  locationErrorKey: string
  jwtStrategy: string
  path: string
  Authentication: ClientConstructor
}

export class AuthenticationClient {
  app: Application
  authenticated: boolean
  options: AuthenticationClientOptions

  constructor(app: Application, options: AuthenticationClientOptions) {
    const socket = app.io
    const storage = new StorageWrapper(app.get('storage') || options.storage)

    this.app = app
    this.options = options
    this.authenticated = false
    this.app.set('storage', storage)

    if (socket) {
      this.handleSocket(socket)
    }
  }

  get service() {
    return this.app.service(this.options.path)
  }

  get storage() {
    return this.app.get('storage') as Storage
  }

  handleSocket(socket: any) {
    // When the socket disconnects and we are still authenticated, try to reauthenticate right away
    // the websocket connection will handle timeouts and retries
    socket.on('disconnect', () => {
      if (this.authenticated) {
        this.reAuthenticate(true)
      }
    })
  }

  /**
   * Parse the access token or authentication error from the window location hash. Will remove it from the hash
   * if found.
   *
   * @param location The window location
   * @returns The access token if available, will throw an error if found, otherwise null
   */
  getFromLocation(location: Location) {
    const [accessToken, tokenRegex] = getMatch(location, this.options.locationKey)

    if (accessToken !== null) {
      location.hash = location.hash.replace(tokenRegex, '')

      return Promise.resolve(accessToken)
    }

    const [message, errorRegex] = getMatch(location, this.options.locationErrorKey)

    if (message !== null) {
      location.hash = location.hash.replace(errorRegex, '')

      return Promise.reject(new OauthError(decodeURIComponent(message)))
    }

    return Promise.resolve(null)
  }

  /**
   * Set the access token in storage.
   *
   * @param accessToken The access token to set
   * @returns
   */
  setAccessToken(accessToken: string) {
    return this.storage.setItem(this.options.storageKey, accessToken)
  }

  /**
   * Returns the access token from storage or the window location hash.
   *
   * @returns The access token from storage or location hash
   */
  getAccessToken(): Promise<string | null> {
    return this.storage.getItem(this.options.storageKey).then((accessToken: string) => {
      if (!accessToken && typeof window !== 'undefined' && window.location) {
        return this.getFromLocation(window.location)
      }

      return accessToken || null
    })
  }

  /**
   * Remove the access token from storage
   * @returns The removed access token
   */
  removeAccessToken() {
    return this.storage.removeItem(this.options.storageKey)
  }

  /**
   * Reset the internal authentication state. Usually not necessary to call directly.
   *
   * @returns null
   */
  reset() {
    this.app.set('authentication', null)
    this.authenticated = false

    return Promise.resolve(null)
  }

  handleError(error: FeathersError, type: 'authenticate' | 'logout') {
    // For NotAuthenticated, PaymentError, Forbidden, NotFound, MethodNotAllowed, NotAcceptable
    // errors, remove the access token
    if (error.code > 400 && error.code < 408) {
      const promise = this.removeAccessToken().then(() => this.reset())

      return type === 'logout' ? promise : promise.then(() => Promise.reject(error))
    }

    return this.reset().then(() => Promise.reject(error))
  }

  /**
   * Try to reauthenticate using the token from storage. Will do nothing if already authenticated unless
   * `force` is true.
   *
   * @param force force reauthentication with the server
   * @param strategy The name of the strategy to use. Defaults to `options.jwtStrategy`
   * @param authParams Additional authentication parameters
   * @returns The reauthentication result
   */
  reAuthenticate(force = false, strategy?: string, authParams?: Params): Promise<AuthenticationResult> {
    // Either returns the authentication state or
    // tries to re-authenticate with the stored JWT and strategy
    let authPromise = this.app.get('authentication')

    if (!authPromise || force === true) {
      authPromise = this.getAccessToken().then((accessToken) => {
        if (!accessToken) {
          return this.handleError(new NotAuthenticated('No accessToken found in storage'), 'authenticate')
        }

        return this.authenticate(
          {
            strategy: strategy || this.options.jwtStrategy,
            accessToken
          },
          authParams
        )
      })
      this.app.set('authentication', authPromise)
    }

    return authPromise
  }

  /**
   * Authenticate using a specific strategy and data.
   *
   * @param authentication The authentication data
   * @param params Additional parameters
   * @returns The authentication result
   */
  authenticate(authentication?: AuthenticationRequest, params?: Params): Promise<AuthenticationResult> {
    if (!authentication) {
      return this.reAuthenticate()
    }

    const promise = this.service
      .create(authentication, params)
      .then((authResult: AuthenticationResult) => {
        const { accessToken } = authResult

        this.authenticated = true
        this.app.emit('login', authResult)
        this.app.emit('authenticated', authResult)

        return this.setAccessToken(accessToken).then(() => authResult)
      })
      .catch((error: FeathersError) => this.handleError(error, 'authenticate'))

    this.app.set('authentication', promise)

    return promise
  }

  /**
   * Log out the current user and remove their token. Will do nothing
   * if not authenticated.
   *
   * @returns The log out result.
   */
  logout(): Promise<AuthenticationResult | null> {
    return Promise.resolve(this.app.get('authentication'))
      .then(() =>
        this.service.remove(null).then((authResult: AuthenticationResult) =>
          this.removeAccessToken()
            .then(() => this.reset())
            .then(() => {
              this.app.emit('logout', authResult)

              return authResult
            })
        )
      )
      .catch((error: FeathersError) => this.handleError(error, 'logout'))
  }
}

```

### Core Architecture Module: `packages/authentication-client/src/hooks/authentication.ts`
```
import { HookContext, NextFunction } from '@feathersjs/feathers'
import { stripSlashes } from '@feathersjs/commons'

export const authentication = () => {
  return (context: HookContext, next: NextFunction) => {
    const {
      app,
      params,
      path,
      method,
      app: { authentication: service }
    } = context

    if (stripSlashes(service.options.path) === path && method === 'create') {
      return next()
    }

    return Promise.resolve(app.get('authentication'))
      .then((authResult) => {
        if (authResult) {
          context.params = Object.assign({}, authResult, params)
        }
      })
      .then(next)
  }
}

```

### Core Architecture Module: `packages/authentication-client/src/hooks/index.ts`
```
export { authentication } from './authentication'
export { populateHeader } from './populate-header'

```

### Core Architecture Module: `packages/authentication-client/src/hooks/populate-header.ts`
```
import { HookContext, NextFunction } from '@feathersjs/feathers'

export const populateHeader = () => {
  return (context: HookContext, next: NextFunction) => {
    const {
      app,
      params: { accessToken }
    } = context
    const authentication = app.authentication

    // Set REST header if necessary
    if (app.rest && accessToken) {
      const { scheme, header } = authentication.options
      const authHeader = `${scheme} ${accessToken}`

      context.params.headers = Object.assign(
        {},
        {
          [header]: authHeader
        },
        context.params.headers
      )
    }

    return next()
  }
}

```

### Core Architecture Module: `packages/authentication-local/src/hooks/hash-password.ts`
```
import get from 'lodash/get'
import set from 'lodash/set'
import cloneDeep from 'lodash/cloneDeep'
import { BadRequest } from '@feathersjs/errors'
import { createDebug } from '@feathersjs/commons'
import { HookContext, NextFunction } from '@feathersjs/feathers'
import { LocalStrategy } from '../strategy'

const debug = createDebug('@feathersjs/authentication-local/hooks/hash-password')

export interface HashPasswordOptions {
  authentication?: string
  strategy?: string
}

/**
 * @deprecated Use Feathers schema resolvers and the `passwordHash` resolver instead
 * @param field
 * @param options
 * @returns
 * @see https://dove.feathersjs.com/api/authentication/local.html#passwordhash
 */
export default function hashPassword(field: string, options: HashPasswordOptions = {}) {
  if (!field) {
    throw new Error('The hashPassword hook requires a field name option')
  }

  return async (context: HookContext, next?: NextFunction) => {
    const { app, data, params } = context

    if (data !== undefined) {
      const authService = app.defaultAuthentication(options.authentication)
      const { strategy = 'local' } = options

      if (!authService || typeof authService.getStrategies !== 'function') {
        throw new BadRequest('Could not find an authentication service to hash password')
      }

      const [localStrategy] = authService.getStrategies(strategy) as LocalStrategy[]

      if (!localStrategy || typeof localStrategy.hashPassword !== 'function') {
        throw new BadRequest(`Could not find '${strategy}' strategy to hash password`)
      }

      const addHashedPassword = async (data: any) => {
        const password = get(data, field)

        if (password === undefined) {
          debug(`hook.data.${field} is undefined, not hashing password`)
          return data
        }

        const hashedPassword: string = await localStrategy.hashPassword(password, params)

        return set(cloneDeep(data), field, hashedPassword)
      }

      context.data = Array.isArray(data)
        ? await Promise.all(data.map(addHashedPassword))
        : await addHashedPassword(data)
    }

    if (typeof next === 'function') {
      return next()
    }
  }
}

```

### Core Architecture Module: `packages/authentication-local/src/hooks/protect.ts`
```
import omit from 'lodash/omit'
import { HookContext, NextFunction } from '@feathersjs/feathers'

/**
 * @deprecated For reliable safe data representations use Feathers schema dispatch resolvers.
 * @see https://dove.feathersjs.comapi/authentication/local.html#protecting-fields
 */
export default (...fields: string[]) => {
  const o = (current: any) => {
    if (typeof current === 'object' && !Array.isArray(current)) {
      const data = typeof current.toJSON === 'function' ? current.toJSON() : current

      return omit(data, fields)
    }

    return current
  }

  return async (context: HookContext, next?: NextFunction) => {
    if (typeof next === 'function') {
      await next()
    }

    const result = context.dispatch || context.result

    if (result) {
      if (Array.isArray(result)) {
        context.dispatch = result.map(o)
      } else if (result.data && context.method === 'find') {
        context.dispatch = Object.assign({}, result, {
          data: result.data.map(o)
        })
      } else {
        context.dispatch = o(result)
      }

      if (context.params && context.params.provider) {
        context.result = context.dispatch
      }
    }
  }
}

```

### Core Architecture Module: `packages/authentication-oauth/src/utils.ts`
```
import type { RequestHandler } from 'express'
import type { Middleware, Application as KoaApplication } from '@feathersjs/koa'

import type { ServiceOptions } from '@feathersjs/feathers'

import '@feathersjs/koa'
import '@feathersjs/express'
import expressCookieSession from 'cookie-session'
import koaCookieSession from 'koa-session'

import { AuthenticationService } from '@feathersjs/authentication'
import { GrantConfig } from 'grant'

export interface OauthSetupSettings {
  linkStrategy: string
  authService?: string
  expressSession?: RequestHandler
  koaSession?: Middleware
}

export const getGrantConfig = (service: AuthenticationService): GrantConfig => {
  const {
    app,
    configuration: { oauth }
  } = service
  // Set up all the defaults
  const port = app.get('port')
  let host = app.get('host')
  let protocol = 'https'

  // Development environments commonly run on HTTP with an extended port
  if (process.env.NODE_ENV !== 'production') {
    protocol = 'http'
    if (String(port) !== '80') {
      host += `:${port}`
    }
  }

  // omit 'redirect' and 'origins' from oauth
  const { redirect, origins, ...oauthConfig } = oauth

  const grant: GrantConfig = {
    ...oauthConfig,
    defaults: {
      prefix: '/oauth',
      origin: `${protocol}://${host}`,
      transport: 'state',
      response: ['tokens', 'raw', 'profile'],
      ...oauthConfig.defaults
    }
  }

  const getUrl = (url: string) => {
    const { defaults } = grant
    return `${defaults.origin}${defaults.prefix}/${url}`
  }

  // iterate over grant object with key and value
  for (const [name, value] of Object.entries(grant)) {
    if (name !== 'defaults') {
      value.redirect_uri = value.redirect_uri || getUrl(`${name}/callback`)
    }
  }

  return grant
}

export const setExpressParams: RequestHandler = (req, res, next) => {
  req.session.destroy ||= () => {
    req.session = null
  }

  req.feathers = {
    ...req.feathers,
    session: req.session,
    state: res.locals
  }

  next()
}

export const setKoaParams: Middleware = async (ctx, next) => {
  ctx.session.destroy ||= () => {
    ctx.session = null
  }

  ctx.feathers = {
    ...ctx.feathers,
    session: ctx.session,
    state: ctx.state
  } as any

  await next()
}

export const authenticationServiceOptions = (
  service: AuthenticationService,
  settings: OauthSetupSettings
): ServiceOptions => {
  const { secret } = service.configuration
  const koaApp = service.app as KoaApplication

  if (koaApp.context) {
    koaApp.keys = [secret]

    const { koaSession = koaCookieSession({ key: 'feathers.oauth' }, koaApp as any) } = settings

    return {
      koa: {
        before: [koaSession, setKoaParams]
      }
    }
  }

  const {
    expressSession = expressCookieSession({
      name: 'feathers.oauth',
      keys: [secret]
    })
  } = settings

  return {
    express: {
      before: [expressSession, setExpressParams]
    }
  }
}

```

### Core Architecture Module: `packages/authentication/src/core.ts`
```
import merge from 'lodash/merge'
import jsonwebtoken, { SignOptions, Secret, VerifyOptions, Algorithm } from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { NotAuthenticated } from '@feathersjs/errors'
import { createDebug } from '@feathersjs/commons'
import { Application, Params } from '@feathersjs/feathers'
import { IncomingMessage, ServerResponse } from 'http'
import { AuthenticationConfiguration, defaultOptions } from './options'

const debug = createDebug('@feathersjs/authentication/base')

export interface AuthenticationResult {
  [key: string]: any
}

export interface AuthenticationRequest {
  strategy?: string
  [key: string]: any
}

export interface AuthenticationParams extends Params {
  payload?: { [key: string]: any }
  jwtOptions?: SignOptions
  authStrategies?: string[]
  secret?: string
  [key: string]: any
}

export type ConnectionEvent = 'login' | 'logout' | 'disconnect'

export interface AuthenticationStrategy {
  /**
   * Implement this method to get access to the AuthenticationService
   *
   * @param auth The AuthenticationService
   */
  setAuthentication?(auth: AuthenticationBase): void
  /**
   * Implement this method to get access to the Feathers application
   *
   * @param app The Feathers application instance
   */
  setApplication?(app: Application): void
  /**
   * Implement this method to get access to the strategy name
   *
   * @param name The name of the strategy
   */
  setName?(name: string): void
  /**
   * Implement this method to verify the current configuration
   * and throw an error if it is invalid.
   */
  verifyConfiguration?(): void
  /**
   * Implement this method to setup this strategy
   * @param auth The AuthenticationService
   * @param name The name of the strategy
   */
  setup?(auth: AuthenticationBase, name: string): Promise<void>
  /**
   * Authenticate an authentication request with this strategy.
   * Should throw an error if the strategy did not succeed.
   *
   * @param authentication The authentication request
   * @param params The service call parameters
   */
  authenticate?(
    authentication: AuthenticationRequest,
    params: AuthenticationParams
  ): Promise<AuthenticationResult>
  /**
   * Update a real-time connection according to this strategy.
   *
   * @param connection The real-time connection
   * @param context The hook context
   */
  handleConnection?(event: ConnectionEvent, connection: any, authResult?: AuthenticationResult): Promise<void>
  /**
   * Parse a basic HTTP request and response for authentication request information.
   *
   * @param req The HTTP request
   * @param res The HTTP response
   */
  parse?(req: IncomingMessage, res: ServerResponse): Promise<AuthenticationRequest | null>
}

export interface JwtVerifyOptions extends VerifyOptions {
  algorithm?: string | string[]
}

/**
 * A base class for managing authentication strategies and creating and verifying JWTs
 */
export class AuthenticationBase {
  app: Application
  strategies: { [key: string]: AuthenticationStrategy }
  configKey: string
  isReady: boolean

  /**
   * Create a new authentication service.
   *
   * @param app The Feathers application instance
   * @param configKey The configuration key name in `app.get` (default: `authentication`)
   * @param options Optional initial options
   */
  constructor(app: Application, configKey = 'authentication', options = {}) {
    if (!app || typeof app.use !== 'function') {
      throw new Error('An application instance has to be passed to the authentication service')
    }

    this.app = app
    this.strategies = {}
    this.configKey = configKey
    this.isReady = false

    app.set('defaultAuthentication', app.get('defaultAuthentication') || configKey)
    app.set(configKey, merge({}, app.get(configKey), options))
  }

  /**
   * Return the current configuration from the application
   */
  get configuration(): AuthenticationConfiguration {
    // Always returns a copy of the authentication configuration
    return Object.assign({}, defaultOptions, this.app.get(this.configKey))
  }

  /**
   * A list of all registered strategy names
   */
  get strategyNames() {
    return Object.keys(this.strategies)
  }

  /**
   * Register a new authentication strategy under a given name.
   *
   * @param name The name to register the strategy under
   * @param strategy The authentication strategy instance
   */
  register(name: string, strategy: AuthenticationStrategy) {
    // Call the functions a strategy can implement
    if (typeof strategy.setName === 'function') {
      strategy.setName(name)
    }

    if (typeof strategy.setApplication === 'function') {
      strategy.setApplication(this.app)
    }

    if (typeof strategy.setAuthentication === 'function') {
      strategy.setAuthentication(this)
    }

    if (typeof strategy.verifyConfiguration === 'function') {
      strategy.verifyConfiguration()
    }

    // Register strategy as name
    this.strategies[name] = strategy

    if (this.isReady) {
      strategy.setup?.(this, name)
    }
  }

  /**
   * Get the registered authentication strategies for a list of names.
   *
   * @param names The list or strategy names
   */
  getStrategies(...names: string[]) {
    return names.map((name) => this.strategies[name]).filter((current) => !!current)
  }

  /**
   * Returns a single strategy by name
   *
   * @param name The strategy name
   * @returns The authentication strategy or undefined
   */
  getStrategy(name: string) {
    return this.strategies[name]
  }

  /**
   * Create a new access token with payload and options.
   *
   * @param payload The JWT payload
   * @param optsOverride The options to extend the defaults (`configuration.jwtOptions`) with
   * @param secretOverride Use a different secret instead
   */
  async createAccessToken(
    payload: string | Buffer | object,
    optsOverride?: SignOptions,
    secretOverride?: Secret
  ) {
    const { secret, jwtOptions } = this.configuration
    // Use configuration by default but allow overriding the secret
    const jwtSecret = secretOverride || secret
    // Default jwt options merged with additional options
    const options = merge({}, jwtOptions, optsOverride)

    if (!options.jwtid) {
      // Generate a UUID as JWT ID by default
      options.jwtid = uuidv4()
    }

    return jsonwebtoken.sign(payload, jwtSecret, options)
  }

  /**
   * Verifies an access token.
   *
   * @param accessToken The token to verify
   * @param optsOverride The options to extend the defaults (`configuration.jwtOptions`) with
   * @param secretOverride Use a different secret instead
   */
  async verifyAccessToken(accessToken: string, optsOverride?: JwtVerifyOptions, secretOverride?: Secret) {
    const { secret, jwtOptions } = this.configuration
    const jwtSecret = secretOverride || secret
    const options = merge({}, jwtOptions, optsOverride)
    const { algorithm } = options

    // Normalize the `algorithm` setting into the algorithms array
    if (algorithm && !options.algorithms) {
      options.algorithms = (Array.isArray(algorithm) ? algorithm : [algorithm]) as Algorithm[]
      delete options.algorithm
    }

    try {
      const verified = jsonwebtoken.verify(accessToken, jwtSecret, options)

      return verified as any
    } catch (error: any) {
      throw new NotAuthenticated(error.message, error)
    }
  }

  /**
   * Authenticate a given authentication request against a list of strategies.
   *
   * @param authentication The authentication request
   * @param params Service call parameters
   * @param allowed A list of allowed strategy names
   */
  async authenticate(
    authentication: AuthenticationRequest,
    params: AuthenticationParams,
    ...allowed: string[]
  ) {
    const { strategy } = authentication || {}
    const [authStrategy] = this.getStrategies(strategy)
    const strategyAllowed = allowed.includes(strategy)

    debug('Running authenticate for strategy', strategy, allowed)

    if (!authentication || !authStrategy || !strategyAllowed) {
      const additionalInfo =
        (!strategy && ' (no `strategy` set)') ||
        (!strategyAllowed && ' (strategy not allowed in authStrategies)') ||
        ''

      // If there are no valid strategies or `authentication` is not an object
      throw new NotAuthenticated('Invalid authentication information' + additionalInfo)
    }

    return authStrategy.authenticate(authentication, {
      ...params,
      authenticated: true
    })
  }

  async handleConnection(event: ConnectionEvent, connection: any, authResult?: AuthenticationResult) {
    const strategies = this.getStrategies(...Object.keys(this.strategies)).filter(
      (current) => typeof current.handleConnection === 'function'
    )

    for (const strategy of strategies) {
      await strategy.handleConnection(event, connection, authResult)
    }
  }

  /**
   * Parse an HTTP request and response for authentication request information.
   *
   * @param req The HTTP request
   * @param res The HTTP response
   * @param names A list of strategies to use
   */
  async parse(req: IncomingMessage, res: ServerResponse, ...names: string[]) {
    const strategies = this.getStrategies(...names).filter((current) => typeof current.parse === 'function')

    debug('Strategies parsing HTTP header for authentication information', names)

    for (const authStrategy of strategies) {
      const value = await authStrategy.parse(req, res)

      if (value !== null) {
        return value
      }
    }

    return null
  }

  async setup() {
    this.isReady = true

    for (const name of Object.keys(this.strategies)) {
      const strategy = this.strategies[name]

      await strategy.setup?.(this, name)
    }
  }
}

```

### Core Architecture Module: `packages/authentication/src/hooks/authenticate.ts`
```
import { HookContext, NextFunction } from '@feathersjs/feathers'
import { NotAuthenticated } from '@feathersjs/errors'
import { createDebug } from '@feathersjs/commons'

const debug = createDebug('@feathersjs/authentication/hooks/authenticate')

export interface AuthenticateHookSettings {
  service?: string
  strategies?: string[]
}

export default (originalSettings: string | AuthenticateHookSettings, ...originalStrategies: string[]) => {
  const settings =
    typeof originalSettings === 'string'
      ? { strategies: [originalSettings, ...originalStrategies] }
      : originalSettings

  if (!originalSettings || settings.strategies.length === 0) {
    throw new Error('The authenticate hook needs at least one allowed strategy')
  }

  return async (context: HookContext, _next?: NextFunction) => {
    const next = typeof _next === 'function' ? _next : async () => context
    const { app, params, type, path, service } = context
    const { strategies } = settings
    const { provider, authentication } = params
    const authService = app.defaultAuthentication(settings.service)

    debug(`Running authenticate hook on '${path}'`)

    if (type && type !== 'before' && type !== 'around') {
      throw new NotAuthenticated('The authenticate hook must be used as a before hook')
    }

    if (!authService || typeof authService.authenticate !== 'function') {
      throw new NotAuthenticated('Could not find a valid authentication service')
    }

    if (service === authService) {
      throw new NotAuthenticated(
        'The authenticate hook does not need to be used on the authentication service'
      )
    }

    if (params.authenticated === true) {
      return next()
    }

    if (authentication) {
      const { provider, authentication, ...authParams } = params

      debug('Authenticating with', authentication, strategies)

      const authResult = await authService.authenticate(authentication, authParams, ...strategies)

      const { accessToken, ...authResultWithoutToken } = authResult

      context.params = {
        ...params,
        ...authResultWithoutToken,
        authenticated: true
      }
    } else if (provider) {
      throw new NotAuthenticated('Not authenticated')
    }

    return next()
  }
}

```

### Core Architecture Module: `packages/authentication/src/hooks/connection.ts`
```
import { HookContext, NextFunction } from '@feathersjs/feathers'
import { AuthenticationBase, ConnectionEvent } from '../core'

export default (event: ConnectionEvent) => async (context: HookContext, next: NextFunction) => {
  await next()

  const {
    result,
    params: { connection }
  } = context

  if (connection) {
    const service = context.service as unknown as AuthenticationBase

    await service.handleConnection(event, connection, result)
  }
}

```

### Core Architecture Module: `packages/authentication/src/hooks/event.ts`
```
import { HookContext, NextFunction } from '@feathersjs/feathers'
import { createDebug } from '@feathersjs/commons'
import { ConnectionEvent } from '../core'

const debug = createDebug('@feathersjs/authentication/hooks/connection')

export default (event: ConnectionEvent) => async (context: HookContext, next: NextFunction) => {
  await next()

  const { app, result, params } = context

  if (params.provider && result) {
    debug(`Sending authentication event '${event}'`)
    app.emit(event, result, params, context)
  }
}

```

### Core Architecture Module: `packages/authentication/src/hooks/index.ts`
```
export { default as authenticate } from './authenticate'
export { default as connection } from './connection'
export { default as event } from './event'

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3084** (2023-04-05): **service.get(id) looses the where clause if query created in hook **
  *Symptoms*: Ran into a weird issue, whenever I add a before get hook like this:  ```   before: {     get: [       async (context: HookContext<TeamMembershipsService>) => {         const query = context.service.createQuery(context.params)         context.params.knex = query       }     ],    ...   } ``` which basically should do nothing. I get error: `NotFound: No record found for id 'cb36a3b0-007c-4719-9298-dcdea66705f8'.` That's because the query executed by knex looses the `where` clause and returns more than 1 entry: `knex:query select "team_memberships".* from "team_memberships" order by "team_memberships"."id" asc`  When `get(id)` is invoked it trickles down to this line in `_find()` in `KnexAdapter`: ``` const builder = params.knex ? params.knex.clone() : this.createQuery(params) ```  Since I've already created the query, `createQuery` is not invoked, and the `id` filter doesn't get added. The `id` query parameter is not added in my hook either when I call `createQuery(context.params)` because `id` is not present in params it's in `context.id`  Adding the id filter to the query in the hook helps: ``` async (context: HookContext<TeamMembershipsService>) => {   const query = context.service.createQuery(context.params)   query.where('id', context.id)   context.params.knex = query } ```  ### Expected behavior I expected the id filter to be appended to the query i create in the hook automatically  ### Actual behavior where id=abc filter doesn't get 

- **Issue #3065** (2023-04-05): **$select=['id'] in query returns an array of ID's**
  *Symptoms*: I'm receiving an array of 2 IDs when using $select argument in my query object.  ### Steps to reproduce  URL:  http://localhost:3003/submissions?$select[]=id&$select[]=title  ### Expected behavior {   "total": 1,   "limit": 10,   "skip": 0,   "data": [{       "id": 1,       "title": "First submission"     }] }  ### Actual behavior  This is the response: {   "total": 1,   "limit": 10,   "skip": 0,   "data": [{       "id": [         1,         1       ],       "title": "First submission"     }] }  ### System configuration  I'm using MSSQL and Knex.  **Module versions** (especially the part that's not working): feathers 5.0.0-pre.35  **NodeJS version**: v18.13.0  **Operating System**: macOS Ventura 13.2 

- **Issue #2835** (2022-11-25): **[dove/feathers-authentication] Access token not removed on logout when user is not found**
  *Symptoms*: ### Steps to reproduce  Create an OAuth based app which reauthenticates the user using `reAuthenticate()` in the index when an access token is available. In the app add a try/catch block like this: ``` try {         const response = await app.reAuthenticate()         ...       } catch (error) {         // This ensure an old token is not kept when the user has been deleted         if (error.code === 404) await app.logout()         ...       } ```  Now delete the user in the database and try to reauthenticate, the authentication fails probably because it is still using the old token: `error: api/authentication - Method: create: No record found for id '62c5b5921c535f8f68440c17'`  ### Expected behavior  The access token referring to the old user should be deleted so that a new authentication is performed from scratch. It seems that the remove operation performed by `logout()` does not work as the user is not found and the token is not removed as well.  I agree this is a race use case but as with OAuth users should not be persistent it could be possible. Typically to be GDPR compliant you should be forced to purge users in the DB on a regular basis.  Not sure if this is a bug or expected behavior but this code worked with Feathers v3. Maybe it is now expected to call `api.authentication.removeAccessToken()` explicitely as using `logout()` is not sufficient ?  ### Actual behavior  The token is not deleted.  ### System configuration  **Module versions*
  **Post-Mortem & Fix Analysis**:
  > So there was a legit problem with the error being cached which has been fixed in #2892 but I'm not sure if the access token should be removed on all errors. For example, any 5xx error might only be temporary as well as e.g. a 429 (Too Many Requests) in which case retrying with the existing access token could work.
  > I agree we should filter which error requires the token being removed. Typically in the issue use case a 404 should remove the token. 
  > That makes sense. https://github.com/feathersjs/feathers/pull/2894 will remove the access token for all unrecoverable 400 errors. I think for other errors it is up to the developer if they want to remove the access token or not.

- **Issue #2825** (2022-11-04): **dove-docs: footer on mobile is displaced**
  *Symptoms*: The footer of the new docs looks like this on mobile:  ![Screenshot_20221021-063803_Chrome](https://user-images.githubusercontent.com/22286818/197113419-35347a23-123f-499e-bd19-1feca11fd1e2.jpg)  For example here: https://dove.feathersjs.com/api/hooks.html  System: Android Device: Samsung S21 FE Browser: Webview (Samsung Browser (?) and Android Chrome) 
  **Post-Mortem & Fix Analysis**:
  > Can confirm. This must've gotten borked when @marshallswain and I fiddled with it. For some reason it adds a `sidebar-adjust` with a huge margin:  <img width="419" alt="Screenshot 2022-10-21 at 8 17 52 AM" src="https://user-images.githubusercontent.com/338316/197230786-a39f7274-3044-4cd6-ade7-72d711ecfd42.png"> 
  > The problem is the   ```html <style> /* Only indent the footer on pages other than home-page */ #app:not(.home-page) .feathers-footer.sidebar-open .sidebar-adjust {   margin-left: 272px; } </style> ```  in https://github.com/feathersjs/feathers/blob/dove/docs/components/Footer.vue#L61-L66

- **Issue #2764** (2022-10-15): **getGrantConfig being hard-coded to use http on local dev not ideal for some setups**
  *Symptoms*: We recently did a long-overdue dependency update, with one of those updates being a conversion from pre.10 versions of Feathers packages to pre.29. I noticed that in local dev, our oauth logins weren't working any more. I see in the new getGrantConfig in authentication-oauth/src/utils.ts  that, if NODE_ENV is 'development', it's hard-coding the protocol to be 'http' and adding a non-'80' port onto the host. We use https when running locally and were already adding the port onto the host in order to work in prior versions. The latter isn't too much of an issue to change, but the former is more of a problem, since we're not going to switch to http.  I don't think assuming that everyone runs http locally is a good assumption, as we can't be the only people who use https in order to more closely mirror production (and prevent warnings/issues with mixed fetching of http and https resources).   I can get around this by setting NODE_ENV to production locally, and as it turns out we don't seem to be running any important logic off of NODE_ENV so this shouldn't mess up our local dev process, but I don't think NODE_ENV !== 'production' should be forcing http. There may very well be others who are using NODE_ENV to set other logic, which would force them to either not be able to easily test OAuth locally, have to switch to http (which may be impractical), or change that other logic to be conditional on something else.  ### Expected behavior http vs. https for origin urls on local
  **Post-Mortem & Fix Analysis**:
  > I added a test in #2795 that shows how to override the origin in the default settings. It looks like this:  ```ts {   defaults: {     prefix: '/auth',     origin: 'https://localhost:3344'   },   github: {     key: 'some-key',     secret: 'a secret secret',     dynamic: true   } } ```  This will use `https://localhost:3344` as the base URL.

- **Issue #2451** (2021-10-05): **returned hook context not used anymore in workflow**
  *Symptoms*: ### Steps to reproduce  As long as feathers dove should behave like feathers crow, it is currently not possible to create a new context object which will returned and reused in the following hooks.  If I create a new context object with spread operators during the hook, changing some query parameters and returning this context at the end of the hook. It will be used in the following hooks in feathers v4, in feathers v5 the original context from the function parameter will be reused in the next hooks and not the object what was return by the previous hooks. That means the return object isn't available in the following workflow (service and hooks).  Example:  ```js const worksInV4AndV5 = (context) => {   context.params.query.foo = 'worksInV4AndV5';   return context;  };  const worksInV4NotInV5 = (context) => {   return {     ...context,     params: {       ...context.params,       query: {         ...context.params.query,         foo: 'worksInV4NotInV5'       }     }   }; };  const logHook = (context) => {     // logs in v4  'worksInV4NotInV5'      // logs in v5  'worksInV4AndV5'      console.log(context.params.query.foo); };  const hooks = {     before: {       all: [],       get: [         worksInV4AndV5,         worksInV4NotInV5,         logHook       ],       find: [         worksInV4AndV5,         worksInV4NotInV5,         logHook       ],       create: [],       update: [],       patch: [],       remove: [],     },     af

- **Issue #2327** (2021-05-09): **Can not add route with placeholder, using version 5.0-pre3**
  *Symptoms*: ### Steps to reproduce  Use 5.0-pre3  Assuming we have a Message service: ``` const app = feathers();  // Register the message service on the Feathers application app.use('messages', new MessageService()); ```  I wouldn't be able to write a FlagMessageService like so anymore:  ``` app.use('messages/:messageId/flag', new FlagMessageService ()); ```  Nor would I be able to specify it like so:  ```  app.use('messages/:messageId/flag', new FlagMessageService ()); ```  But I could specify it like so: ``` app.use('messages/:__id/flag', new FlagMessageService ()); ```  This seems to not be documented in the Migration to v5 instructions, and I'm not sure if it's intended to be limit the user on this or not.  When using `:id` in the path, I'd get this error: `Can not add route with placeholder ':id' because placeholder ':__id' already exists` This is why I assumed using `:__id` would work and it seems to unblock the initialization of the app.      ### Expected behavior It would be nice if we could specify any route params as we wish, as we could in v4.   ### Actual behavior Getting an error in the form of: `Can not add route with placeholder ':id' because placeholder ':__id' already exists`  ### System configuration  Tell us about the applicable parts of your setup.  **Module versions**  Verison 5.0-pre3  **NodeJS version**: N/A  **Operating System**: N/A  **Browser Version**: N/A  **React Native Version**: N/A  **Module Loa
  **Post-Mortem & Fix Analysis**:
  > This is definitely a regression in the new built-in radix tree router that should be fixed. I just have to get the semantics right because a  ```js app.use('messages', new MessageService()); app.use('messages/:messageId/flag', new FlagMessageService ()); ```  is fine since you can always say which request belongs where, but a  ```js app.use('messages', new MessageService()); app.use('messages/:messageId', new SomeMessageService ()); ```  wouldn't work because you couldn't tell if going to `messages/something` is a `SomeMessageService.find()` or a `MessageService.get('something')`
  > Correct, the 2nd case you mentioned is probably a user error. I'm not expecting the latter case to be valid and the error that is given is probably accurate.

- **Issue #2207** (2021-03-26): **Server Crash when subscribing to undefined connection**
  *Symptoms*: In some edge cases, such as _deleting_ a user or _creating_ and then subscribing a user with _internal_ provider, the connection object might be lost or not active yet. In that case the server will crash, with:  ``` myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:12                 mappings.set(connection, channel.data);                          ^  TypeError: Invalid value used as weak map key     at WeakMap.set (<anonymous>)     at myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:12:26     at Array.forEach (<anonymous>)     at myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:9:29     at Array.forEach (<anonymous>)     at collectConnections (myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:8:14)     at new CombinedChannel (myApp/node_modules/@feathersjs/transport-commons/lib/channels/channel/combined.js:20:43)     at Function.channel (myApp/node_modules/@feathersjs/transport-commons/lib/channels/mixins.js:43:20)     at Function.channel (myApp/node_modules/@feathersjs/transport-commons/lib/channels/mixins.js:30:33)     at Function.leaveChannels (myApp/node_modules/@feathersjs/transport-commons/lib/socket/index.js:17:21)     at Function.emit (events.js:327:22)     at Socket.<anonymous> (myApp/node_modules/@feathersjs/socketio/lib/middleware.js:4:39)     at Object.onceWrapper (events.js:422:26)     at Socket.emit (events.js:315

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

### Incident Patch 1: `572574e3` (2026-09-24)
**Commit Message**: fix(schema): recheck external dispatch after resolving (#3705)

**File**: `packages/schema/src/hooks/resolve.ts` (modified, +3/-2)
```diff
@@ -173,7 +173,8 @@ export const resolveExternal =
           {} as Record<string, any>
         )
 
-        return setDispatch(current, currentDispatch)
+        // Nested or concurrent resolutions may have set dispatch while the resolvers were awaited.
+        return getDispatch(current) ?? setDispatch(current, currentDispatch)
       }
 
       const result = await (Array.isArray(data)
@@ -186,7 +187,7 @@ export const resolveExternal =
           }
         : result
 
-      context.dispatch = setDispatch(context.result, dispatch)
+      context.dispatch = getDispatch(context.result) ?? setDispatch(context.result, dispatch)
     }
   }
 
```

**File**: `packages/schema/test/hooks.test.ts` (modified, +112/-2)
```diff
@@ -1,8 +1,8 @@
-import { createContext, feathers } from '@feathersjs/feathers'
+import { createContext, feathers, HookContext } from '@feathersjs/feathers'
 import assert from 'assert'
 import { VALIDATED } from '@feathersjs/adapter-commons'
 import { MemoryService } from '@feathersjs/memory'
-import { validateQuery } from '../src'
+import { getDispatch, resolve, resolveExternal, validateQuery } from '../src'
 import { app, Message, User } from './fixture'
 
 describe('@feathersjs/schema/hooks', () => {
@@ -197,6 +197,116 @@ describe('@feathersjs/schema/hooks', () => {
     assert.deepStrictEqual(await service.find(), [{ message: 'Hello' }])
   })
 
+  for (const paginated of [false, true]) {
+    it(`resolves repeated result objects with paginated=${paginated} (#3476)`, async () => {
+      const record = { message: 'Hello', password: 'secret' }
+      const records = [record, record]
+      const result = paginated ? { total: 2, limit: 10, skip: 0, data: records } : records
+      const localApp = feathers().use('shared', {
+        async find() {
+          return result
+        }
+      })
+      const service = localApp.service('shared')
+
+      service.hooks({
+        around: {
+          all: [resolveExternal(resolve<typeof record, HookContext>({ password: async () => undefined }))]
+        }
+      })
+
+      const context = await service.find({}, createContext(service, 'find'))
+      const dispatch = [{ message: 'Hello' }, { message: 'Hello' }]
+
+      assert.strictEqual(context.result, result)
+      assert.deepStrictEqual(
+        context.dispatch,
+        paginated ? { total: 2, limit: 10, skip: 0, data: dispatch } : dispatch
+      )
+      const dispatchedRecords = Array.isArray(context.dispatch) ? context.dispatch : context.dispatch.data
+      assert.strictEqual(dispatchedRecords[0], dispatchedRecords[1])
+      assert.strictEqual(dispatchedRecords[0], getDispatch(record))
+      assert.strictEqual(record.password, 'secret')
+    })
+
+    it(`resolves concurrent calls sharing paginated=${paginated} results (#3476)`, async () => {
+      const record = { message: 'Hello', password: 'secret' }
+      const records = [record]
+      const result = paginated ? { total: 1, limit: 10, skip: 0, data: records } : records
+      const localApp = feathers().use('shared', {
+        async find() {
+          return result
+        }
+      })
+      const service = localApp.service('shared')
+
+      service.hooks({
+        around: {
+          all: [resolveExternal(resolve<typeof record, HookContext>({ password: async () => undefined }))]
+        }
+      })
+
+      const [first, second] = await Promise.all([
+        service.find({}, createContext(service, 'find')),
+        service.find({}, createContext(service, 'find'))
+      ])
+      const dispatch = [{ message: 'Hello' }]
+
+      assert.deepStrictEqual(
+        first.dispatch,
+        paginated ? { total: 1, limit: 10, skip: 0, data: dispatch } : dispatch
+      )
+      assert.strictEqual(first.dispatch, second.dispatch)
+      assert.strictEqual(first.result, result)
+      assert.strictEqual(second.result, result)
+      assert.strictEqual(record.password, 'secret')
+    })
+  }
+
+  it('keeps dispatch set by a resolver service call (#3476)', async () => {
+    const record = { message: 'Hello', password: 'secret' }
+    const localApp = feathers()
+
+    for (const name of ['inner', 'outer']) {
+      localApp.use(name, {
+        async get() {
+          return record
+        }
+      })
+    }
+
+    localApp.service('inner').hooks({
+      around: {
+        all: [resolveExternal(resolve<typeof record, HookContext>({ password: async () => undefined }))]
+      }
+    })
+    const service = localApp.service('outer')
+    service.hooks({
+      around: {
+        all: [
+          resolveExternal(
+            resolve<typeof record, HookContext>(
+              {},
+              {
+                converter: async (data, context) => {
+                  await context.app.service('inner').get(0)
+                  return data
+                }
+              }
+            )
+          )
+        ]
+      }
+    })
+
+    const context = await service.get(0, {}, createContext(service, 'get'))
+
+    assert.strictEqual(context.result, record)
+    assert.deepStrictEqual(context.dispatch, { message: 'Hello' })
+    assert.strictEqual(context.dispatch, getDispatch(record))
+    assert.strictEqual(record.password, 'secret')
+  })
+
   it('resolves data for custom methods', async () => {
     const result = await app.service('messages').customMethod({ message: 'Hello' })
     const user = {
```

---

### Incident Patch 2: `05bb6c8d` (2026-09-17)
**Commit Message**: fix(generators): use entity camelName for auth params in schema templates (#3706)

**File**: `packages/generators/src/service/templates/schema.json.tpl.ts` (modified, +2/-2)
```diff
@@ -115,8 +115,8 @@ export const ${camelName}QueryResolver = resolve<${upperName}Query, HookContext<
       ? `
   // If there is a user (e.g. with authentication), they are only allowed to see their own data
   ${type === 'mongodb' ? '_id' : 'id'}: async (value, user, context) => {
-    if (context.params.user) {
-      return context.params.user.${type === 'mongodb' ? '_id' : 'id'}
+    if (context.params.${camelName}) {
+      return context.params.${camelName}.${type === 'mongodb' ? '_id' : 'id'}
     }
 
     return value
```

**File**: `packages/generators/src/service/templates/schema.typebox.tpl.ts` (modified, +2/-2)
```diff
@@ -103,8 +103,8 @@ export const ${camelName}QueryResolver = resolve<${upperName}Query, HookContext<
       ? `
   // If there is a user (e.g. with authentication), they are only allowed to see their own data
   ${type === 'mongodb' ? '_id' : 'id'}: async (value, user, context) => {
-    if (context.params.user) {
-      return context.params.user.${type === 'mongodb' ? '_id' : 'id'}
+    if (context.params.${camelName}) {
+      return context.params.${camelName}.${type === 'mongodb' ? '_id' : 'id'}
     }
 
     return value
```

---

### Incident Patch 3: `4dd36da8` (2026-09-11)
**Commit Message**: fix: Update dependencies (#3703)

**File**: `docs/package.json` (modified, +16/-16)
```diff
@@ -11,30 +11,30 @@
     "start": "npm run dev"
   },
   "dependencies": {
-    "@vueuse/core": "^14.3.0",
+    "@vueuse/core": "^14.4.0",
     "date-fns": "^4.4.0",
-    "element-plus": "^2.14.2",
-    "query-string": "^9.4.0",
-    "shiki": "^4.2.0",
-    "vue": "^3.5.38"
+    "element-plus": "^2.14.5",
+    "query-string": "^9.5.1",
+    "shiki": "^4.4.3",
+    "vue": "^3.5.42"
   },
   "devDependencies": {
-    "@feathersjs/generators": "^5.0.45",
-    "@iconify-json/carbon": "^1.2.23",
+    "@feathersjs/generators": "^5.0.49",
+    "@iconify-json/carbon": "^1.2.27",
     "@types/node": "^26.0.0",
-    "@unocss/preset-typography": "^66.7.2",
-    "@unocss/reset": "^66.7.2",
-    "@unocss/transformer-directives": "^66.7.2",
-    "@vitejs/plugin-vue": "^6.0.7",
+    "@unocss/preset-typography": "^66.10.2",
+    "@unocss/reset": "^66.10.2",
+    "@unocss/transformer-directives": "^66.10.2",
+    "@vitejs/plugin-vue": "^6.0.8",
     "esno": "^4.8.0",
     "fast-glob": "^3.3.3",
     "flexsearch": "^0.7.31",
-    "https-localhost": "^4.7.1",
-    "markdown-it": "^14.2.0",
-    "sass": "^1.101.0",
+    "https-localhost": "^4.7.2",
+    "markdown-it": "^15.0.2",
+    "sass": "^1.104.0",
     "sitemap": "^9.0.1",
-    "unocss": "^66.7.2",
-    "unplugin-auto-import": "^21.0.0",
+    "unocss": "^66.10.2",
+    "unplugin-auto-import": "^21.1.0",
     "unplugin-vue-components": "^32.1.0",
     "vite-plugin-pwa": "^1.3.0",
     "vitepress": "^1.6.4",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
     "lint": "npm run prettier && npm run eslint",
     "compile": "lerna run compile",
     "build:docs": "npm run build --workspace docs",
-    "update-dependencies": "npm exec --workspaces --include-workspace-root -- ncu -u --dep prod,dev,optional,peer -x node-fetch,\"@sinclair/typebox\",\"@types/express\",\"@types/express-serve-static-core\",commander,express,flexsearch,uuid,mongodb",
+    "update-dependencies": "npm exec --workspaces --include-workspace-root -- ncu -u --dep prod,dev,optional,peer -x node-fetch,\"@sinclair/typebox\",\"@types/express\",\"@types/express-serve-static-core\",commander,express,flexsearch,uuid,mongodb,typescript",
     "clean": "find . -name node_modules -exec rm -rf '{}' + && find . -name package-lock.json -exec rm -rf '{}' +",
     "test:deno": "deno test --config deno/tsconfig.json deno/test.ts",
     "test": "npm run lint && npm run compile && c8 lerna run test --ignore @feathersjs/tests",
```

**File**: `packages/adapter-commons/package.json` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@
     "@types/mocha": "^10.0.10",
     "@types/mongodb": "^4.0.6",
     "@types/node": "^26.0.0",
-    "mocha": "^11.7.6",
+    "mocha": "^12.0.1",
     "mongodb": "^6.19.0",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
```

**File**: `packages/adapter-tests/package.json` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
   "devDependencies": {
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
-    "mocha": "^11.7.6",
+    "mocha": "^12.0.1",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-client/package.json` (modified, +2/-2)
```diff
@@ -67,8 +67,8 @@
     "@feathersjs/socketio-client": "^5.0.49",
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
-    "axios": "^1.18.0",
-    "mocha": "^11.7.6",
+    "axios": "^1.20.0",
+    "mocha": "^12.0.1",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-local/package.json` (modified, +2/-2)
```diff
@@ -64,10 +64,10 @@
     "@feathersjs/memory": "^5.0.49",
     "@feathersjs/schema": "^5.0.49",
     "@types/bcryptjs": "^2.4.6",
-    "@types/lodash": "^4.17.24",
+    "@types/lodash": "^4.17.25",
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
-    "mocha": "^11.7.6",
+    "mocha": "^12.0.1",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-oauth/package.json` (modified, +4/-4)
```diff
@@ -64,7 +64,7 @@
     "cookie-session": "^2.1.1",
     "grant": "^5.4.24",
     "koa-session": "^7.0.2",
-    "qs": "^6.15.2"
+    "qs": "^6.16.0"
   },
   "devDependencies": {
     "@feathersjs/memory": "^5.0.49",
@@ -74,10 +74,10 @@
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
     "@types/tough-cookie": "^4.0.5",
-    "axios": "^1.18.0",
-    "mocha": "^11.7.6",
+    "axios": "^1.20.0",
+    "mocha": "^12.0.1",
     "shx": "^0.4.0",
-    "tough-cookie": "^6.0.1",
+    "tough-cookie": "^6.0.2",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
   },
```

**File**: `packages/authentication/package.json` (modified, +2/-2)
```diff
@@ -67,11 +67,11 @@
   },
   "devDependencies": {
     "@feathersjs/memory": "^5.0.49",
-    "@types/lodash": "^4.17.24",
+    "@types/lodash": "^4.17.25",
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
     "@types/uuid": "^10.0.0",
-    "mocha": "^11.7.6",
+    "mocha": "^12.0.1",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

---

### Incident Patch 4: `fcbf602c` (2026-09-11)
**Commit Message**: fix(transport-commons): map HEAD requests like GET for REST services (#3701)

**File**: `packages/transport-commons/src/http.ts` (modified, +3/-1)
```diff
@@ -38,7 +38,9 @@ export function getServiceMethod(_httpMethod: string, id: unknown, headerOverrid
     return mappedMethod
   }
 
-  if (httpMethod === 'get') {
+  // HEAD is semantically a GET without a body (RFC 9110). Map it the same
+  // way so Express/Koa REST endpoints do not 405/500 on HEAD probes.
+  if (httpMethod === 'get' || httpMethod === 'head') {
     return id === null ? 'find' : 'get'
   }
 
```

**File**: `packages/transport-commons/test/http.test.ts` (modified, +3/-0)
```diff
@@ -68,6 +68,9 @@ describe('@feathersjs/transport-commons HTTP helpers', () => {
   it('getServiceMethod', () => {
     assert.strictEqual(http.getServiceMethod('GET', 2), 'get')
     assert.strictEqual(http.getServiceMethod('GET', null), 'find')
+    assert.strictEqual(http.getServiceMethod('HEAD', 2), 'get')
+    assert.strictEqual(http.getServiceMethod('HEAD', null), 'find')
+    assert.strictEqual(http.getServiceMethod('head', null), 'find')
     assert.strictEqual(http.getServiceMethod('PoST', null), 'create')
     assert.strictEqual(http.getServiceMethod('PoST', null, 'customMethod'), 'customMethod')
     assert.strictEqual(http.getServiceMethod('delete', null), 'remove')
```

---

### Incident Patch 5: `ab6f0eb7` (2026-08-14)
**Commit Message**: fix(core): Set version back to development

**File**: `packages/feathers/src/version.ts` (modified, +1/-1)
```diff
@@ -1 +1 @@
-export default '5.0.49'
+export default 'development'
```

---

### Incident Patch 6: `304a1aac` (2026-08-14)
**Commit Message**: fix(adapter-commons): validate query operators nested in arrays (#3700)

* fix(adapter-commons): validate query operators nested in arrays

validateQueryProperty skipped array values because isPlainObject
excludes arrays. That let unknown $ operators through when wrapped
in an extra array level, e.g. $or: [[{ $where: '1==1' }]]. Recurse
into arrays so the operator allow-list applies at every level.

* fix: validate filter values and tighten ObjectIdSchema

filterQuery left $select, $or, $and, and $sort object values
unvalidated, so unknown $ operators could ride through those
filters. ObjectIdSchema accepted any object, which let operator
documents pass querySyntax on generated MongoDB services.

Validate those filter values with validateQueryProperty. The
objectid keyword now accepts ObjectId instances and rejects
other objects, and ObjectIdSchema uses that for its object branch.

* fix(schema): allow $exists on queryProperty after ObjectIdSchema tighten

Tightening ObjectIdSchema dropped { _id: { $exists: true } }, which
only passed because the old any-object branch treated the operator
document as an id. Add $exists as a boolean operator on queryProperty
so it is allowed on ever

**File**: `docs/api/databases/knex.md` (modified, +6/-4)
```diff
@@ -113,19 +113,21 @@ In addition to the [common querying mechanism](./querying.md), this adapter also
 ```ts
 const messageQuerySchema = Type.Intersect(
   [
-    // This will additionally allow querying for `{ name: { $ilike: 'Dav%' } }`
     querySyntax(messageQueryProperties, {
       name: {
-        $ilike: Type.String()
+        $like: Type.String(),
+        $notlike: Type.String(),
+        $ilike: Type.String() // PostgreSQL
       }
     }),
-    // Add additional query properties here
-    Type.Object({})
+    Type.Object({}, { additionalProperties: false })
   ],
   { additionalProperties: false }
 )
 ```
 
+More extension examples are in [querySyntax](../schema/typebox.md#querysyntax). `{ age: null }` and `{ age: { $ne: null } }` work when the query property type includes `null` (see the `age` field in the adapter tests).
+
 ### $like
 
 Find all records where the value matches the given string pattern. The following query retrieves all messages that start with `Hello`:
```

**File**: `docs/api/databases/mongodb.md` (modified, +16/-3)
```diff
@@ -215,13 +215,13 @@ new MongoDBService({
 
 <BlockQuote type="warning" label="Important">
 
-Note that in a normal application all MongoDB specific operators have to explicitly be added to the [TypeBox query schema](../schema/typebox.md#query-schemas) or [JSON query schema](../schema/schema.md#querysyntax).
+Note that in a normal application all MongoDB specific operators have to explicitly be added to the [TypeBox query schema](../schema/typebox.md#querysyntax) or [JSON query schema](../schema/schema.md#querysyntax).
 
 </BlockQuote>
 
 There are two ways to perform search queries with MongoDB:
 
-- Perform basic Regular Expression matches using the `$regex` filter.
+- Perform basic Regular Expression matches using the `$regex` operator.
 - Perform full-text search using the `$search` filter.
 
 ### Basic Regex Search
@@ -234,6 +234,19 @@ You can perform basic search using regular expressions with the `$regex` operato
 }
 ```
 
+Allow those operators on the properties that need them:
+
+```ts
+querySyntax(messageQueryProperties, {
+  text: {
+    $regex: Type.String(),
+    $options: Type.String()
+  }
+})
+```
+
+If you also use [`validateQuery(schema, { skipSanitize: false })`](../schema/validators.md#keeping-adapter-sanitization), list them on the service as well: `operators: ['$regex', '$options']`.
+
 ### Full-Text Search
 
 See the MongoDB documentation for instructions on performing full-text search using the `$search` operator:
@@ -456,7 +469,7 @@ validator.addKeyword(keywordObjectId)
 
 ### ObjectIdSchema
 
-Both, `@feathersjs/typebox` and `@feathersjs/schema` export an `ObjectIdSchema` helper that creates a schema which can be both, a MongoDB ObjectId or a string that will be converted with the `objectid` keyword:
+Both, `@feathersjs/typebox` and `@feathersjs/schema` export an `ObjectIdSchema` helper that creates a schema which can be a MongoDB ObjectId instance or a string that will be converted with the `objectid` keyword. Arbitrary objects — including query operator documents like `{ $ne: null }` or `{ $where: '…' }` — are not valid ObjectIds.
 
 ```ts
 import { ObjectIdSchema } from '@feathersjs/typebox' // or '@feathersjs/schema'
```

**File**: `docs/api/schema/schema.md` (modified, +2/-4)
```diff
@@ -171,7 +171,7 @@ const userQuery: UserQuery = {
 }
 ```
 
-Additional special query properties [that are not already included in the query syntax](../databases/querying.md) like `$ilike` can be added like this:
+Additional operators that are [not already in the common query syntax](../databases/querying.md) (`$like`, `$regex`, …) are added per property. Only add operators your adapter supports. See [TypeBox querySyntax](./typebox.md#querysyntax) for more examples.
 
 ```ts
 import { querySyntax } from '@feathersjs/schema'
@@ -184,9 +184,7 @@ export const userQuerySchema = {
   properties: {
     ...querySyntax(userSchema.properties, {
       email: {
-        $ilike: {
-          type: 'string'
-        }
+        $ilike: { type: 'string' }
       }
     } as const)
   }
```

**File**: `docs/api/schema/typebox.md` (modified, +16/-8)
```diff
@@ -101,30 +101,38 @@ const messageQuerySchema = querySyntax(messageQueryProperties)
 type MessageQuery = Static<typeof messageQuerySchema>
 ```
 
-Additional special query properties [that are not already included in the query syntax](../databases/querying.md) like `$ilike` can be added like this:
+Additional operators that are [not already in the common query syntax](../databases/querying.md) must be added per property. Only add operators your adapter actually supports.
 
 ```ts
-import { querySyntax } from '@feathersjs/typebox'
+import { querySyntax, Type } from '@feathersjs/typebox'
 
-// Schema for allowed query properties
 const messageQueryProperties = Type.Pick(messageSchema, ['id', 'text', 'createdAt', 'userId'], {
   additionalProperties: false
 })
+
 const messageQuerySchema = Type.Intersect(
   [
-    // This will additionally allow querying for `{ name: { $ilike: 'Dav%' } }`
     querySyntax(messageQueryProperties, {
-      name: {
-        $ilike: Type.String()
+      text: {
+        $like: Type.String(),
+        $notlike: Type.String(),
+        $ilike: Type.String(), // PostgreSQL
+        $regex: Type.String(),
+        $options: Type.String()
       }
     }),
-    // Add additional query properties here
-    Type.Object({})
+    Type.Object({}, { additionalProperties: false })
   ],
   { additionalProperties: false }
 )
 ```
 
+That allows `{ text: { $like: 'Hello%' } }` and `{ text: { $regex: 'feathers', $options: 'i' } }`.
+
+`$ne: null` and `{ userId: null }` are allowed when the **query** property type includes `null` (for example `Type.Union([Type.Number(), Type.Null()])` or `Type.Union([ObjectIdSchema(), Type.Null()])`). That is a field type, not a new operator. Do not change the create/patch data schema unless you also want to store nulls.
+
+Mongo `$meta` / `$slice` in object `$select` or `$sort` are not part of the common syntax. On the adapter sanitizer path, list them on the existing service `operators` option if you need them. `querySyntax` `$select` remains a string array.
+
 To allow additional query properties outside of the query syntax use the intersection type:
 
 ```ts
```

**File**: `docs/api/schema/validators.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ This is intentional. Schema validation and the legacy sanitizer are alternative
 
 - Prefer [`querySyntax`](./typebox.md#querysyntax) (or the [JSON schema helpers](./schema.md#query-helpers)) so only the common operators are allowed on each property.
 - Set `additionalProperties: false` on query objects so unknown keys (including unexpected `$` operators) are rejected. Generated applications already do this.
-- Only add extra operators (for example `$ilike` or `$regex`) when your adapter supports them and your application needs them.
+- Only add extra operators (for example `$ilike` or `$regex`) when your adapter supports them and your application needs them. Copy-paste examples: [querySyntax](./typebox.md#querysyntax).
 - Avoid permissive schemas such as `additionalProperties: true` or an open object on external query validation unless you intentionally want clients to send those keys.
 
 <BlockQuote type="warning" label="TypeBox and JSON Schema defaults">
```

**File**: `docs/guides/cli/service.schemas.md` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ export const messageQueryValidator = getValidator(messageQuerySchema, queryValid
 export const messageQueryResolver = resolve<MessageQuery, HookContext>({})
 ```
 
-To add additional operators like `$like` see the [querySyntax](../../api/schema/typebox.md#querysyntax) documentation. You can also add your own query parameters in the `Type.Object({}, { additionalProperties: false })` definition.
+To add additional operators like `$like` or `$regex`, see [querySyntax](../../api/schema/typebox.md#querysyntax). You can also add your own query parameters in the `Type.Object({}, { additionalProperties: false })` definition.
 
 <BlockQuote type="warning" label="Important">
 
```

**File**: `packages/adapter-commons/src/query.ts` (modified, +15/-12)
```diff
@@ -8,6 +8,10 @@ const parse = (value: any) => (typeof value !== 'undefined' ? parseInt(value, 10
 const isPlainObject = (value: any) => _.isObject(value) && value.constructor === {}.constructor
 
 const validateQueryProperty = (query: any, operators: string[] = []): Query => {
+  if (Array.isArray(query)) {
+    return query.map((value) => validateQueryProperty(value, operators))
+  }
+
   if (!isPlainObject(query)) {
     return query
   }
@@ -17,11 +21,7 @@ const validateQueryProperty = (query: any, operators: string[] = []): Query => {
       throw new BadRequest(`Invalid query parameter ${key}`, query)
     }
 
-    const value = query[key]
-
-    if (isPlainObject(value)) {
-      query[key] = validateQueryProperty(value, operators)
-    }
+    query[key] = validateQueryProperty(query[key], operators)
   }
 
   return {
@@ -91,41 +91,44 @@ export const OPERATORS = ['$in', '$nin', '$lt', '$lte', '$gt', '$gte', '$ne', '$
 
 export const FILTERS: FilterSettings = {
   $skip: (value: any) => parse(value),
-  $sort: (sort: any): { [key: string]: number } => {
+  $sort: (sort: any, { operators }: FilterQueryOptions): { [key: string]: any } => {
     if (typeof sort !== 'object' || Array.isArray(sort)) {
       return sort
     }
 
     return Object.keys(sort).reduce(
       (result, key) => {
-        result[key] = typeof sort[key] === 'object' ? sort[key] : parse(sort[key])
+        result[key] =
+          typeof sort[key] === 'object' && sort[key] !== null
+            ? validateQueryProperty(sort[key], operators)
+            : parse(sort[key])
 
         return result
       },
-      {} as { [key: string]: number }
+      {} as { [key: string]: any }
     )
   },
   $limit: (_limit: any, { paginate }: FilterQueryOptions) => getLimit(_limit, paginate),
-  $select: (select: any) => {
+  $select: (select: any, { operators }: FilterQueryOptions) => {
     if (Array.isArray(select)) {
       return select.map((current) => `${current}`)
     }
 
-    return select
+    return validateQueryProperty(select, operators)
   },
   $or: (or: any, { operators }: FilterQueryOptions) => {
     if (Array.isArray(or)) {
       return or.map((current) => validateQueryProperty(current, operators))
     }
 
-    return or
+    return validateQueryProperty(or, operators)
   },
   $and: (and: any, { operators }: FilterQueryOptions) => {
     if (Array.isArray(and)) {
       return and.map((current) => validateQueryProperty(current, operators))
     }
 
-    return and
+    return validateQueryProperty(and, operators)
   }
 }
 
```

**File**: `packages/adapter-commons/test/query.test.ts` (modified, +199/-0)
```diff
@@ -245,6 +245,169 @@ describe('@feathersjs/adapter-commons/filterQuery', () => {
         $or: [{ value: { $gte: 10 } }]
       })
     })
+
+    it('rejects unknown operators nested one array level under $or', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            $or: [[{ $where: '1==1' }]]
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $where'
+        }
+      )
+    })
+
+    it('rejects unknown operators nested one array level under $and', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            $and: [[{ $where: '1==1' }]]
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $where'
+        }
+      )
+    })
+
+    it('rejects unknown operators in a property value array', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            name: [{ $where: '1==1' }]
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $where'
+        }
+      )
+    })
+
+    it('rejects unknown operators nested inside an allowed operator array', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            name: { $in: [{ $where: '1==1' }] }
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $where'
+        }
+      )
+    })
+
+    it('rejects unknown operators in deeply nested arrays', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            $or: [[[{ $exists: false }]]]
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $exists'
+        }
+      )
+    })
+
+    it('allows primitive arrays and valid nested objects', () => {
+      const { query, filters } = filterQuery({
+        tags: ['a', 'b'],
+        name: { $in: ['dave', 'alice'] },
+        $or: [{ value: { $gte: 10 } }, { name: 'dave' }]
+      })
+
+      assert.deepStrictEqual(query, {
+        tags: ['a', 'b'],
+        name: { $in: ['dave', 'alice'] }
+      })
+      assert.deepStrictEqual(filters, {
+        $or: [{ value: { $gte: 10 } }, { name: 'dave' }]
+      })
+    })
+
+    it('rejects unknown operators in a non-array $or object', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            $or: { $where: '1==1' }
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $where'
+        }
+      )
+    })
+
+    it('rejects unknown operators in a non-array $and object', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            $and: { $where: '1==1' }
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $where'
+        }
+      )
+    })
+
+    it('rejects unknown operators nested in an object $select', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            $select: {
+              owned: { $function: { body: 'return 1', lang: 'js', args: [] } }
+            }
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $function'
+        }
+      )
+    })
+
+    it('allows MongoDB inclusion-style object $select', () => {
+      const { filters } = filterQuery({
+        $select: { name: 1, age: 1 }
+      })
+
+      assert.deepStrictEqual(filters.$select, { name: 1, age: 1 })
+    })
+
+    it('allows extra operators in object $select when listed on operators', () => {
+      const { filters } = filterQuery(
+        {
+          $select: { score: { $meta: 'textScore' } }
+        },
+        { operators: ['$meta'] }
+      )
+
+      assert.deepStrictEqual(filters.$select, { score: { $meta: 'textScore' } })
+    })
+
+    it('rejects unknown operators nested in a $sort value', () => {
+      assert.throws(
+        () => {
+          filterQuery({
+            $sort: { score: { $function: { body: 'return 1', lang: 'js', args: [] } } }
+          })
+        },
+        {
+          name: 'BadRequest',
+          message: 'Invalid query parameter $function'
+        }
+      )
+    })
   })
 
   describe('additional filters', () => {
@@ -286,6 +449,42 @@ describe('@feathersjs/adapter-commons/filterQuery', () => {
     })
   })
 
+  describe('configured operators', () => {
+    it('allows $exists when listed on operators', () => {
+      const { query } = filterQuery({ name: { $exists: true } }, { operators: ['$exists'] })
+
+      assert.deepStrictEqual(query, { name: { $exists: true } })
+    })
+
+    it('allows $regex and $options when listed on operators', () => {
+      const { query } = filterQuery(
+        { name: { $regex: 'Dav', $options: 'i' } },
+        { operators: ['$regex', '$options'] }
+      )
+
+      assert.deepStrictEqual(query, { name: 
```

---

### Incident Patch 7: `1a58896a` (2026-08-11)
**Commit Message**: fix(authentication-oauth): allow any port on loopback OAuth origins (#3699)

* fix(authentication-oauth): allow any port on loopback OAuth origins

Exact origin matching from the 5.0.40 security fix rejected common local
dev setups where the frontend runs on a different port than the configured
origin (e.g. http://localhost vs http://localhost:5173).

For localhost, 127.0.0.1, and ::1 only, match on scheme + host and ignore
port, then redirect using the referer origin so the token returns to the
correct local port. Non-loopback hosts still require an exact origin match.

Closes #3684

* fix(authentication-oauth): treat 0.0.0.0 as loopback and improve origin errors

Include 0.0.0.0 in the loopback port-flex allowlist used for local OAuth
redirects. When a referer is rejected, report the normalized origin,
configured allowlist, and a short hint about ports and loopback matching.

**File**: `packages/authentication-oauth/src/strategy.ts` (modified, +53/-5)
```diff
@@ -11,6 +11,51 @@ import qs from 'qs'
 
 const debug = createDebug('@feathersjs/authentication-oauth/strategy')
 
+// Local machine addresses: match any port when scheme + host are allowlisted.
+const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])
+
+/** Strip IPv6 brackets so `[::1]` and `::1` compare the same. */
+function normalizeHostname(hostname: string) {
+  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
+}
+
+function isLoopbackHost(hostname: string) {
+  return LOOPBACK_HOSTS.has(normalizeHostname(hostname))
+}
+
+/**
+ * Match key for origin allowlisting.
+ * Non-loopback hosts use the full WHATWG origin (scheme + host + port).
+ * Loopback hosts drop the port so local frontends on any port can match a single allowlist entry.
+ */
+function originMatchKey(value: string) {
+  const url = new URL(value)
+  const host = normalizeHostname(url.hostname)
+
+  if (isLoopbackHost(host)) {
+    return `${url.protocol}//${host}`
+  }
+
+  return url.origin.toLowerCase()
+}
+
+function isOriginAllowed(refererOrigin: string, configured: string) {
+  try {
+    return originMatchKey(refererOrigin) === originMatchKey(configured)
+  } catch {
+    return false
+  }
+}
+
+function originNotAllowedMessage(refererOrigin: string, origins: string[]) {
+  return (
+    `Referer origin "${refererOrigin}" is not allowed. ` +
+    `Configured origins: ${origins.join(', ')}. ` +
+    `Use a full origin (scheme + host + port when non-default). ` +
+    `Loopback hosts (localhost, 127.0.0.1, ::1, 0.0.0.0) match any port.`
+  )
+}
+
 /**
  * Validates that appending a user-supplied path to a base URL does not change the origin.
  * Uses both URL resolution and string concatenation checks to catch all open redirect vectors:
@@ -117,17 +162,20 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
       try {
         refererOrigin = new URL(referer).origin
       } catch {
-        throw new NotAuthenticated(`Invalid referer "${referer}".`)
+        throw new NotAuthenticated(
+          `Invalid referer "${referer}". Expected an absolute URL (e.g. http://localhost:3000).`
+        )
       }
 
-      // Compare full origins
-      const allowedOrigin = origins.find((current) => refererOrigin.toLowerCase() === current.toLowerCase())
+      // Exact origin match; loopback hosts also match any port (see originMatchKey).
+      // Always return the referer origin so redirects use the port the client came from.
+      const allowedOrigin = origins.find((current) => isOriginAllowed(refererOrigin, current))
 
       if (!allowedOrigin) {
-        throw new NotAuthenticated(`Referer "${referer}" is not allowed.`)
+        throw new NotAuthenticated(originNotAllowedMessage(refererOrigin, origins))
       }
 
-      return allowedOrigin
+      return refererOrigin
     }
 
     return redirect
```

**File**: `packages/authentication-oauth/test/strategy.test.ts` (modified, +166/-3)
```diff
@@ -202,7 +202,11 @@ describe('@feathersjs/authentication-oauth/strategy security', () => {
             }
           ),
         {
-          message: 'Referer "https://target.com.attacker.com/login" is not allowed.'
+          message:
+            'Referer origin "https://target.com.attacker.com" is not allowed. ' +
+            'Configured origins: https://target.com. ' +
+            'Use a full origin (scheme + host + port when non-default). ' +
+            'Loopback hosts (localhost, 127.0.0.1, ::1, 0.0.0.0) match any port.'
         }
       )
     })
@@ -220,7 +224,11 @@ describe('@feathersjs/authentication-oauth/strategy security', () => {
             }
           ),
         {
-          message: 'Referer "https://target.com-evil.attacker.com/login" is not allowed.'
+          message:
+            'Referer origin "https://target.com-evil.attacker.com" is not allowed. ' +
+            'Configured origins: https://target.com. ' +
+            'Use a full origin (scheme + host + port when non-default). ' +
+            'Loopback hosts (localhost, 127.0.0.1, ::1, 0.0.0.0) match any port.'
         }
       )
     })
@@ -238,6 +246,157 @@ describe('@feathersjs/authentication-oauth/strategy security', () => {
       assert.equal(redirect, 'https://target.com#access_token=testing')
     })
   })
+
+  describe('loopback origin port matching (#3684)', () => {
+    afterEach(() => {
+      delete app.get('authentication').oauth.origins
+    })
+
+    it('should allow any port on localhost when configured without a port', async () => {
+      app.get('authentication').oauth.origins = ['http://localhost']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://localhost:5173/login'
+          }
+        }
+      )
+
+      // Redirect must use the referer port, not the config string
+      assert.equal(redirect, 'http://localhost:5173#access_token=testing')
+    })
+
+    it('should allow a different loopback port than the configured one', async () => {
+      app.get('authentication').oauth.origins = ['http://localhost:3030']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://localhost:3000/app'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://localhost:3000#access_token=testing')
+    })
+
+    it('should allow any port on 127.0.0.1', async () => {
+      app.get('authentication').oauth.origins = ['http://127.0.0.1:8080']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://127.0.0.1:5173/'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://127.0.0.1:5173#access_token=testing')
+    })
+
+    it('should allow any port on IPv6 loopback', async () => {
+      app.get('authentication').oauth.origins = ['http://[::1]']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://[::1]:4173/path'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://[::1]:4173#access_token=testing')
+    })
+
+    it('should allow any port on 0.0.0.0', async () => {
+      app.get('authentication').oauth.origins = ['http://0.0.0.0:3030']
+
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          headers: {
+            referer: 'http://0.0.0.0:5173/app'
+          }
+        }
+      )
+
+      assert.equal(redirect, 'http://0.0.0.0:5173#access_token=testing')
+    })
+
+    it('should not treat localhost and 127.0.0.1 as the same host', async () => {
+      app.get('authentication').oauth.origins = ['http://localhost']
+
+      await assert.rejects(
+        () =>
+          strategy.getRedirect(
+            { accessToken: 'testing' },
+            {
+              headers: {
+                referer: 'http://127.0.0.1:3000/login'
+              }
+            }
+          ),
+        {
+          message:
+            'Referer origin "http://127.0.0.1:3000" is not allowed. ' +
+            'Configured origins: http://localhost. ' +
+            'Use a full origin (scheme + host + port when non-default). ' +
+            'Loopback hosts (localhost, 127.0.0.1, ::1, 0.0.0.0) match any port.'
+        }
+      )
+    })
+
+    it('should still require exact port match for non-loopback hosts', async () => {
+      app.get('authentication').oauth.origins = ['https://app.example.com']
+
+      await assert.rejects(
+        () =>
+          strategy.getRedirect(
+            { accessToken: 'testing' },
+            {
+              headers: {
+                referer: 'https://app.example.com:8443/login'
+              }
+            }
+          ),
+        {
+          message:
+            'Referer origin "https://app.exa
```

---

### Incident Patch 8: `15f5ee92` (2026-08-11)
**Commit Message**: docs(authentication): clarify OAuth authStrategies security (#3698)

Document that OAuth providers belong under authentication.oauth and
must not be listed in public authStrategies for browser redirect SSO.
Rewrite flow #2 guidance so provider-token login requires a verifying
getProfile, and cross-link guides and cookbooks.

**File**: `docs/api/authentication/oauth.md` (modified, +74/-9)
```diff
@@ -56,6 +56,55 @@ The following settings for `app.configure(oauth())` are available:
 - `expressSession` - An Express middleware for handling sessions. By default will use an HTTP cookie that is only available for the oAuth flow. **This normally does not need to be changed.**
 - `koaSession` - A Koa middleware for handling sessions. By default will use an HTTP cookie that is only available for the oAuth flow. **This normally does not need to be changed.**
 
+### Configuration and security
+
+OAuth setup uses three separate pieces. Only the first two are required for the usual browser redirect login:
+
+| Piece | Role |
+| --- | --- |
+| `authentication.register('google', new OAuthStrategy())` | Registers the strategy so the OAuth callback can run it |
+| `authentication.oauth.google` in configuration | Grant provider options (`key`, `secret`, `scope`, …) |
+| `authentication.authStrategies` | Strategy names clients may use on **external** `POST /authentication` |
+
+Browser redirect SSO (`/oauth/<provider>`) only needs **register** + **`authentication.oauth`**. The OAuth callback allows that provider for the internal authentication call after Grant finishes. Provider names do **not** need to be listed in public [`authStrategies`](./service.md#configuration).
+
+The [Feathers generator](../../guides/cli/authentication.md) already follows this pattern: OAuth providers are configured under `authentication.oauth`, while `authStrategies` typically stays `["jwt", "local"]`.
+
+```json
+// Typical safe config for browser-only OAuth (matches the generator)
+{
+  "authentication": {
+    "authStrategies": ["jwt", "local"],
+    "oauth": {
+      "google": {
+        "key": "<Client ID>",
+        "secret": "<Client secret>"
+      }
+    }
+  }
+}
+```
+
+```json
+// Unsafe for the default OAuthStrategy when you only need browser SSO.
+// Do not list provider names here unless you implement verified token login (flow #2).
+{
+  "authentication": {
+    "authStrategies": ["jwt", "local", "google", "microsoft"]
+  }
+}
+```
+
+<BlockQuote type="warning" label="Important">
+
+Putting an OAuth provider name (for example `google` or `github`) in [`authStrategies`](./service.md#configuration) exposes that strategy on external `POST /authentication`.
+
+The default [`getProfile`](#getprofile-data-params) implementation returns `data.profile` from the authentication payload. That is safe when the payload is built **server-side** by the OAuth callback after Grant. It is **not** safe to accept a client-supplied `profile` (for example `{ strategy: 'google', profile: { sub: '...' } }`) as proof of identity. A provider `sub` or `id` is an identifier, not a credential.
+
+Only add a provider to `authStrategies` when you intentionally support [flow #2](#flow) (existing provider access token) **and** override `getProfile` to verify that token with the provider. See the [Facebook](../../cookbook/authentication/facebook.md) and [Firebase](../../cookbook/authentication/firebase.md) cookbooks for verified-token patterns.
+
+</BlockQuote>
+
 ### Providers
 
 For specific OAuth provider setup see the following [cookbook](../../cookbook/) guides:
@@ -73,22 +122,29 @@ There are two ways to initiate OAuth authentication:
    - User clicks on link to OAuth URL (`oauth/<provider>`)
    - Gets redirected to provider and authorizes the application
    - Callback to the [OauthStrategy](#oauthstrategy) which
-     - Gets the users profile
+     - Gets the users profile (from the server-side Grant response)
      - Finds or creates the user (entity) for that profile
    - The [AuthenticationService](./service.md) creates an access token for that entity
    - Redirects back to the origin URL including the generated access token
    - The frontend (e.g. the Feathers [authentication client](./client.md)) uses the returned access token to authenticate
 
-2. With an existing access token, e.g. obtained through the Facebook mobile SDK
-   - Authenticate normally through the [authentication service](./service.md) with `{ strategy: '<name>', accessToken: 'oauth access token' }`.
-   - Calls the [OauthStrategy](#oauthstrategy) which
-     - Gets the users profile
-     - Finds or creates the entity for that profile
+   This flow does **not** require the provider name in [`authStrategies`](./service.md#configuration). See [Configuration and security](#configuration-and-security).
+
+2. With an existing provider access token (for example from a mobile SDK)
+
+   - Authenticate through the [authentication service](./service.md) with a request like `{ strategy: '<name>', accessToken: '<provider access token>' }` (some providers use `access_token` or an ID token instead).
+   - The strategy must obtain the user profile by **verifying that token with the provider** (userinfo endpoint, Graph API, ID token verification, and so on).
+   - Finds or creates the entity for that profile
    - Returns the authentication result
 
 <BlockQuote type="warning" label="Impor
```

**File**: `docs/api/authentication/service.md` (modified, +2/-2)
```diff
@@ -63,7 +63,7 @@ The following options are available:
 
 - `secret`: The JWT signing secret.
 - `service`: The path of the entity service
-- `authStrategies`: A list of authentication strategy names to allow on this authentication service to create access tokens.
+- `authStrategies`: A list of authentication strategy names allowed for **external** `create` calls (`POST /authentication` / `app.service('authentication').create`). Typical values are `jwt`, `local`, API keys, and only those custom strategies that accept external credentials. [OAuth](./oauth.md) providers used solely via the `/oauth/<provider>` redirect flow should be [registered](#register-name-strategy) and configured under `authentication.oauth`, but are usually **omitted** from this list. See [OAuth configuration and security](./oauth.md#configuration-and-security).
 - `parseStrategies`: A list of authentication strategies that should be used to parse HTTP requests. Defaults to the same as `authStrategies`.
 - `entity`: The name of the field that will contain the entity after successful authentication. Will also be used to set `params[entity]` (usually `params.user`) when using the [authenticate hook](./hook). Can be `null` if no entity is used (see [stateless tokens](../../cookbook/authentication/stateless.md)).
 - `entityId`: The id property of an entity object. Only necessary if the entity service does not have an `id` property (e.g. when using a custom entity service).
@@ -95,7 +95,7 @@ An authentication service configuration in `config/default.json` can look like t
 
 </BlockQuote>
 
-Additionally to the above configuration, most [strategies](./strategy.md) will look for their own configuration under the name it was registered. An example can be found in the [local strategy configuration](./local.md#configuration).
+Additionally to the above configuration, most [strategies](./strategy.md) will look for their own configuration under the name it was registered. An example can be found in the [local strategy configuration](./local.md#configuration). OAuth provider settings live under `authentication.oauth` (see [OAuth options](./oauth.md#options)), which is separate from `authStrategies`.
 
 ## Authentication flows
 
```

**File**: `docs/cookbook/authentication/facebook.md` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ The client id (App ID) and secret can be found in the Settings of the [Facebook
 
 The standard OAuth strategy only returns the default profile fields (`id` and `name`). To get other fields, like the email or profile picture, the [getProfile](../../api/authentication/oauth.md#getprofile-data-params) method of the [OAuth strategy needs to be customized](../../api/authentication/oauth.md#customization) to call the Graph API profile endpoint `https://graph.facebook.com/me` with an HTTP request library like [Axios](https://developers.facebook.com/tools/explorer/) requesting the additional fields.
 
+This `getProfile` pattern (call Graph with the provider access token) is also **required** if you put `"facebook"` in [`authStrategies`](../../api/authentication/service.md#configuration) so clients can authenticate with `{ strategy: 'facebook', accessToken: '...' }` on `POST /authentication`. Never accept a client-supplied `profile` as identity. Browser-only Facebook login via `/oauth/facebook` does not need the provider in `authStrategies`. See [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
+
 > __Pro tip:__ Facebook API requests can be tested via the [Graph API explorer](https://developers.facebook.com/tools/explorer/).
 
 The following example allows to log in with Facebook in the [chat application from the guide](../../guides/index.md):
```

**File**: `docs/cookbook/authentication/firebase.md` (modified, +3/-0)
```diff
@@ -16,6 +16,7 @@ Update `config/default.json`:
 ```json
 {
   "authentication": {
+    "authStrategies": ["jwt", "firebase"],
     "oauth": {}
   },
   "firebase": {
@@ -28,6 +29,8 @@ Update `config/default.json`:
 ```
 > Note: Since Firebase can be used for more than just authentication, we'll store our service account in the root of our config. Otherwise, if preferred, you can store under `authentication.oauth`.
 
+`"firebase"` must be listed in `authStrategies` because clients authenticate with `POST /authentication` (flow #2). That is only safe because `getProfile` below calls `verifyIdToken` — never trust a client-supplied profile. See [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
+
 ## Authentication Strategy
 
 Create a file under `src/firebase.js`:
```

**File**: `docs/cookbook/authentication/google.md` (modified, +2/-0)
```diff
@@ -111,4 +111,6 @@ module.exports = app => {
 ```
 **Important**: googleId, profilePicture and email are properties that should exist on the database model!
 
+Browser Google login uses `/oauth/google`. You do **not** need to add `"google"` to `authentication.authStrategies` for that redirect flow. Only add it if you implement verified provider-token login on `POST /authentication` — see [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
+
 
```

**File**: `docs/guides/basics/login.md` (modified, +1/-1)
```diff
@@ -239,7 +239,7 @@ export const authentication = (app: Application) => {
 
 <BlockQuote type="info">
 
-For more information about the OAuth flow and strategy see the [OAuth API documentation](../../api/authentication/oauth.md).
+For more information about the OAuth flow and strategy see the [OAuth API documentation](../../api/authentication/oauth.md). Generated apps keep OAuth providers under `authentication.oauth` and **out** of public `authStrategies` on purpose so browser login uses `/oauth/github` only. See [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
 
 </BlockQuote>
 
```

**File**: `docs/guides/cli/authentication.md` (modified, +3/-1)
```diff
@@ -30,4 +30,6 @@ export const authentication = (app: Application) => {
 
 ## oAuth
 
-Note that when selecting oAuth logins (Google, Facebook, GitHub etc.), the standard registered oAuth strategy only uses the `<name>Id` property to create a new user. This will fail validation against the default user [schema](./service.schemas.md) which requires an `email` property to exist. If the provider (and user) allows fetching the email, you can customize the oAuth strategy like shown for GitHub in the [oAuth authentication guide](../basics/authentication.md#login-with-github). You can also make the email in the schema optional with `email: Type.Optional(Type.String())`.
+When you select oAuth logins (Google, Facebook, GitHub etc.), the generator registers each provider strategy and adds it under `authentication.oauth` in configuration. Provider names are **not** added to `authentication.authStrategies` — browser SSO uses `/oauth/<provider>` instead of `POST /authentication`. See [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
+
+Note that the standard registered oAuth strategy only uses the `<name>Id` property to create a new user. This will fail validation against the default user [schema](./service.schemas.md) which requires an `email` property to exist. If the provider (and user) allows fetching the email, you can customize the oAuth strategy like shown for GitHub in the [oAuth authentication guide](../basics/authentication.md#login-with-github). You can also make the email in the schema optional with `email: Type.Optional(Type.String())`.
```

**File**: `docs/guides/cli/default.json.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ These options are used directly in the generated application
 
 ### authentication
 
-`authentication` contains the configuration for the authentication service and strategies. See the [authentication service configuration](../../api/authentication/service.md#configuration) for more information. For strategy specific settings refer to the [jwt](../../api/authentication/jwt.md#options), [local](../../api/authentication/local.md#options) and [oAuth](../../api/authentication/oauth.md#options) API documentation.
+`authentication` contains the configuration for the authentication service and strategies. See the [authentication service configuration](../../api/authentication/service.md#configuration) for more information. For strategy specific settings refer to the [jwt](../../api/authentication/jwt.md#options), [local](../../api/authentication/local.md#options) and [oAuth](../../api/authentication/oauth.md#options) API documentation. `authStrategies` lists strategies allowed on external `POST /authentication` (usually `jwt` and `local`). OAuth provider keys live under `authentication.oauth` and are separate from that list — see [OAuth configuration and security](../../api/authentication/oauth.md#configuration-and-security).
 
 ### Databases
 
```

---

### Incident Patch 9: `4e312b49` (2026-06-27)
**Commit Message**: fix(mongodb): let objectid keyword fail validation (#3691)

Co-authored-by: Deepak kudi <[REDACTED_EMAIL]>

**File**: `packages/mongodb/src/converters.ts` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ export const keywordObjectId = {
         parentData[parentDataProperty] = new ObjectId(value)
         return true
       } catch (error) {
-        throw new Error(`invalid objectid for property "${parentDataProperty}"`)
+        return false
       }
     }
   }
```

**File**: `packages/mongodb/test/converters.test.ts` (modified, +24/-2)
```diff
@@ -89,7 +89,7 @@ describe('objectid keyword', () => {
     assert.equal(typeof data.otherId, 'string')
   })
 
-  it('fails on invalid objectids', async () => {
+  it('fails validation on invalid objectids', async () => {
     const schema = {
       type: 'object',
       properties: {
@@ -104,6 +104,28 @@ describe('objectid keyword', () => {
     }
     assert.equal(typeof data._id, 'string')
 
-    assert.throws(() => validate(data), /invalid objectid for property "_id"/)
+    assert.equal(validate(data), false)
+    assert.equal(validate.errors?.[0].keyword, 'objectid')
+  })
+
+  it('continues validating nullable unions when an objectid branch fails', async () => {
+    const nullableValidator = new Ajv({ coerceTypes: true, useDefaults: true })
+    nullableValidator.addKeyword(keywordObjectId)
+
+    const schema: any = {
+      type: 'object',
+      properties: {
+        refId: {
+          anyOf: [{ type: 'string', objectid: true }, { type: 'null' }],
+          default: null
+        }
+      },
+      additionalProperties: false
+    }
+    const validate = nullableValidator.compile(schema)
+    const data: { refId?: ObjectId | null } = {}
+
+    assert.equal(validate(data), true)
+    assert.equal(data.refId, null)
   })
 })
```

---

### Incident Patch 10: `d7e4cc95` (2026-06-27)
**Commit Message**: fix: Update all dependencies (#3692)

**File**: `docs/package.json` (modified, +19/-19)
```diff
@@ -11,35 +11,35 @@
     "start": "npm run dev"
   },
   "dependencies": {
-    "@vueuse/core": "^14.2.1",
-    "date-fns": "^4.1.0",
-    "element-plus": "^2.13.6",
-    "query-string": "^9.3.1",
-    "shiki": "^4.0.2",
-    "vue": "^3.5.31"
+    "@vueuse/core": "^14.3.0",
+    "date-fns": "^4.4.0",
+    "element-plus": "^2.14.2",
+    "query-string": "^9.4.0",
+    "shiki": "^4.2.0",
+    "vue": "^3.5.38"
   },
   "devDependencies": {
-    "@feathersjs/generators": "^5.0.43",
-    "@iconify-json/carbon": "^1.2.20",
-    "@types/node": "^25.5.0",
-    "@unocss/preset-typography": "^66.6.7",
-    "@unocss/reset": "^66.6.7",
-    "@unocss/transformer-directives": "^66.6.7",
-    "@vitejs/plugin-vue": "^6.0.5",
+    "@feathersjs/generators": "^5.0.45",
+    "@iconify-json/carbon": "^1.2.23",
+    "@types/node": "^26.0.0",
+    "@unocss/preset-typography": "^66.7.2",
+    "@unocss/reset": "^66.7.2",
+    "@unocss/transformer-directives": "^66.7.2",
+    "@vitejs/plugin-vue": "^6.0.7",
     "esno": "^4.8.0",
     "fast-glob": "^3.3.3",
     "flexsearch": "^0.7.31",
     "https-localhost": "^4.7.1",
-    "markdown-it": "^14.1.1",
-    "sass": "^1.98.0",
+    "markdown-it": "^14.2.0",
+    "sass": "^1.101.0",
     "sitemap": "^9.0.1",
-    "unocss": "^66.6.7",
+    "unocss": "^66.7.2",
     "unplugin-auto-import": "^21.0.0",
-    "unplugin-vue-components": "^32.0.0",
-    "vite-plugin-pwa": "^1.2.0",
+    "unplugin-vue-components": "^32.1.0",
+    "vite-plugin-pwa": "^1.3.0",
     "vitepress": "^1.6.4",
     "vitepress-plugin-google-analytics": "^1.0.2",
     "vitepress-plugin-search": "^1.0.4-alpha.22",
-    "workbox-window": "^7.4.0"
+    "workbox-window": "^7.4.1"
   }
 }
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -55,6 +55,6 @@
     "lerna": "^8.1.2",
     "npm-check-updates": "^16.14.20",
     "prettier": "^3.2.5",
-    "typescript": "^5.4.5"
+    "typescript": "^5.9.3"
   }
 }
```

**File**: `packages/adapter-commons/package.json` (modified, +2/-2)
```diff
@@ -57,8 +57,8 @@
   "devDependencies": {
     "@types/mocha": "^10.0.10",
     "@types/mongodb": "^4.0.6",
-    "@types/node": "^25.5.0",
-    "mocha": "^11.7.5",
+    "@types/node": "^26.0.0",
+    "mocha": "^11.7.6",
     "mongodb": "^6.19.0",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
```

**File**: `packages/adapter-tests/package.json` (modified, +2/-2)
```diff
@@ -51,8 +51,8 @@
   },
   "devDependencies": {
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
-    "mocha": "^11.7.5",
+    "@types/node": "^26.0.0",
+    "mocha": "^11.7.6",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-client/package.json` (modified, +3/-3)
```diff
@@ -66,9 +66,9 @@
     "@feathersjs/socketio": "^5.0.45",
     "@feathersjs/socketio-client": "^5.0.45",
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
-    "axios": "^1.14.0",
-    "mocha": "^11.7.5",
+    "@types/node": "^26.0.0",
+    "axios": "^1.18.0",
+    "mocha": "^11.7.6",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-local/package.json` (modified, +3/-3)
```diff
@@ -58,16 +58,16 @@
     "@feathersjs/errors": "^5.0.45",
     "@feathersjs/feathers": "^5.0.45",
     "bcryptjs": "^3.0.3",
-    "lodash": "^4.17.23"
+    "lodash": "^4.18.1"
   },
   "devDependencies": {
     "@feathersjs/memory": "^5.0.45",
     "@feathersjs/schema": "^5.0.45",
     "@types/bcryptjs": "^2.4.6",
     "@types/lodash": "^4.17.24",
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
-    "mocha": "^11.7.5",
+    "@types/node": "^26.0.0",
+    "mocha": "^11.7.6",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

**File**: `packages/authentication-oauth/package.json` (modified, +4/-4)
```diff
@@ -64,18 +64,18 @@
     "cookie-session": "^2.1.1",
     "grant": "^5.4.24",
     "koa-session": "^7.0.2",
-    "qs": "^6.15.0"
+    "qs": "^6.15.2"
   },
   "devDependencies": {
     "@feathersjs/memory": "^5.0.45",
     "@types/cookie-session": "^2.0.49",
     "@types/express": "^4.17.21",
     "@types/koa-session": "^6.4.5",
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
+    "@types/node": "^26.0.0",
     "@types/tough-cookie": "^4.0.5",
-    "axios": "^1.14.0",
-    "mocha": "^11.7.5",
+    "axios": "^1.18.0",
+    "mocha": "^11.7.6",
     "shx": "^0.4.0",
     "tough-cookie": "^6.0.1",
     "ts-node": "^10.9.2",
```

**File**: `packages/authentication/package.json` (modified, +3/-3)
```diff
@@ -61,17 +61,17 @@
     "@feathersjs/transport-commons": "^5.0.45",
     "@types/jsonwebtoken": "^9.0.10",
     "jsonwebtoken": "^9.0.3",
-    "lodash": "^4.17.23",
+    "lodash": "^4.18.1",
     "long-timeout": "^0.1.1",
     "uuid": "^11.1.0"
   },
   "devDependencies": {
     "@feathersjs/memory": "^5.0.45",
     "@types/lodash": "^4.17.24",
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
+    "@types/node": "^26.0.0",
     "@types/uuid": "^10.0.0",
-    "mocha": "^11.7.5",
+    "mocha": "^11.7.6",
     "shx": "^0.4.0",
     "ts-node": "^10.9.2",
     "typescript": "^5.9.3"
```

---

### Incident Patch 11: `28b3c03c` (2026-06-04)
**Commit Message**: fix(commons): skip prototype-polluting keys in _.merge (#3690)

Object.keys() returns __proto__ as an own enumerable key for
JSON-parsed sources, causing the recursive merge to write onto
Object.prototype. Skip __proto__/constructor/prototype keys.

Reported-by: Andrew Ridings (@ridingsa)

**File**: `packages/commons/src/index.ts` (modified, +4/-0)
```diff
@@ -75,6 +75,10 @@ export const _ = {
   merge(target: any, source: any) {
     if (_.isObject(target) && _.isObject(source)) {
       Object.keys(source).forEach((key) => {
+        // Skip prototype-polluting keys (e.g. JSON-parsed `__proto__`)
+        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
+          return
+        }
         if (_.isObject(source[key])) {
           if (!target[key]) {
             Object.assign(target, { [key]: {} })
```

**File**: `packages/commons/test/utils.test.ts` (modified, +9/-0)
```diff
@@ -212,5 +212,14 @@ describe('@feathersjs/commons utils', () => {
 
       assert.equal(_.merge('hello', {}), 'hello')
     })
+
+    it('merge does not pollute Object.prototype', () => {
+      _.merge({}, JSON.parse('{"__proto__":{"polluted":"x"}}'))
+      _.merge({}, JSON.parse('{"constructor":{"prototype":{"polluted2":"y"}}}'))
+      assert.strictEqual(({} as any).polluted, undefined)
+      assert.strictEqual(({} as any).polluted2, undefined)
+      assert.strictEqual((Object.prototype as any).polluted, undefined)
+      assert.strictEqual((Object.prototype as any).polluted2, undefined)
+    })
   })
 })
```

---

### Incident Patch 12: `0a139424` (2026-03-21)
**Commit Message**: chore: Fix update-dependencies workflow

**File**: `.github/workflows/update-dependencies.yml` (modified, +1/-1)
```diff
@@ -27,4 +27,4 @@ jobs:
       - run: |
           gh pr create --title "chore(dependencies): Update all dependencies" --body ""
         env:
-          GITHUB_TOKEN: ${{secrets.CI_ACCESS_TOKEN}}
+          GH_TOKEN: ${{secrets.CI_ACCESS_TOKEN}}
```

---

### Incident Patch 13: `32f04d0d` (2026-03-21)
**Commit Message**: fix(authentication-oauth): Use actual URL origin comparison for origin check (#3676)

**File**: `packages/authentication-oauth/src/strategy.ts` (modified, +41/-9)
```diff
@@ -11,6 +11,45 @@ import qs from 'qs'
 
 const debug = createDebug('@feathersjs/authentication-oauth/strategy')
 
+/**
+ * Validates that appending a user-supplied path to a base URL does not change the origin.
+ * Uses both URL resolution and string concatenation checks to catch all open redirect vectors:
+ * authority injection (@), protocol-relative (//), backslash, and domain suffix attacks.
+ *
+ * @throws NotAuthenticated if the redirect path would change the URL origin
+ */
+function validateRedirectOrigin(baseUrl: string, redirectPath: string) {
+  let allowedOrigin: string
+
+  try {
+    allowedOrigin = new URL(baseUrl).origin
+  } catch {
+    // baseUrl is a relative path (e.g. /home) — no open redirect risk
+    return
+  }
+
+  try {
+    // URL resolution catches protocol-relative (//) and backslash attacks
+    // e.g. new URL('//attacker.com', 'https://target.com') → https://attacker.com
+    const resolvedUrl = new URL(redirectPath, baseUrl)
+
+    if (resolvedUrl.origin !== allowedOrigin) {
+      throw new NotAuthenticated('Invalid redirect path.')
+    }
+
+    // String concatenation check catches domain suffix attacks
+    // e.g. 'https://target.com' + '.evil.com' → https://target.com.evil.com
+    const concatenatedUrl = new URL(`${baseUrl}${redirectPath}`)
+
+    if (concatenatedUrl.origin !== allowedOrigin) {
+      throw new NotAuthenticated('Invalid redirect path.')
+    }
+  } catch (error: any) {
+    if (error instanceof NotAuthenticated) throw error
+    throw new NotAuthenticated('Invalid redirect path.')
+  }
+}
+
 export interface OAuthProfile {
   id?: string | number
   [key: string]: any
@@ -105,15 +144,8 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
       return null
     }
 
-    // Validate redirect parameter to prevent open redirect via URL authority injection
-    // Only allow relative paths starting with / to prevent:
-    // - @attacker.com -> https://target.com@attacker.com (authority injection)
-    // - .attacker.com -> https://target.com.attacker.com (domain suffix attack)
-    // - -attacker.com -> https://target.com-attacker.com (domain suffix attack)
-    // - //attacker.com -> protocol-relative redirect
-    // - \attacker.com -> backslash redirect
-    if (queryRedirect && (!/^\//.test(queryRedirect) || /[@\\]|\/\//.test(queryRedirect))) {
-      throw new NotAuthenticated('Invalid redirect path.')
+    if (queryRedirect) {
+      validateRedirectOrigin(redirect, queryRedirect)
     }
 
     const redirectUrl = `${redirect}${queryRedirect}`
```

---

### Incident Patch 14: `9905f9fe` (2026-03-19)
**Commit Message**: fix(authentication-oauth): prevent open redirect via domain suffix attack (#3669)

**File**: `packages/authentication-oauth/src/strategy.ts` (modified, +7/-3)
```diff
@@ -106,9 +106,13 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
     }
 
     // Validate redirect parameter to prevent open redirect via URL authority injection
-    // Reject characters that could change the URL's authority: @, //, \
-    // e.g., @attacker.com would make https://target.com@attacker.com redirect to attacker.com
-    if (queryRedirect && /[@\\]|^\/\/|\/\//.test(queryRedirect)) {
+    // Only allow relative paths starting with / to prevent:
+    // - @attacker.com -> https://target.com@attacker.com (authority injection)
+    // - .attacker.com -> https://target.com.attacker.com (domain suffix attack)
+    // - -attacker.com -> https://target.com-attacker.com (domain suffix attack)
+    // - //attacker.com -> protocol-relative redirect
+    // - \attacker.com -> backslash redirect
+    if (queryRedirect && (!/^\//.test(queryRedirect) || /[@\\]|\/\//.test(queryRedirect))) {
       throw new NotAuthenticated('Invalid redirect path.')
     }
 
```

**File**: `packages/authentication-oauth/test/strategy.test.ts` (modified, +93/-0)
```diff
@@ -86,6 +86,99 @@ describe('@feathersjs/authentication-oauth/strategy security', () => {
     })
   })
 
+  describe('open redirect via domain suffix attack', () => {
+    beforeEach(() => {
+      app.get('authentication').oauth.origins = ['https://target.com']
+    })
+
+    afterEach(() => {
+      delete app.get('authentication').oauth.origins
+    })
+
+    it('should reject redirect starting with dot (domain suffix attack)', async () => {
+      // Attack: ?redirect=.attacker.com -> https://target.com.attacker.com
+      await assert.rejects(
+        () =>
+          strategy.getRedirect(
+            { accessToken: 'testing' },
+            {
+              redirect: '.attacker.com',
+              headers: {
+                referer: 'https://target.com/login'
+              }
+            }
+          ),
+        {
+          name: 'NotAuthenticated'
+        }
+      )
+    })
+
+    it('should reject redirect starting with hyphen (domain suffix attack)', async () => {
+      // Attack: ?redirect=-attacker.com -> https://target.com-attacker.com
+      await assert.rejects(
+        () =>
+          strategy.getRedirect(
+            { accessToken: 'testing' },
+            {
+              redirect: '-attacker.com',
+              headers: {
+                referer: 'https://target.com/login'
+              }
+            }
+          ),
+        {
+          name: 'NotAuthenticated'
+        }
+      )
+    })
+
+    it('should reject redirect with bare domain', async () => {
+      // Attack: ?redirect=attacker.com -> https://target.comattacker.com
+      await assert.rejects(
+        () =>
+          strategy.getRedirect(
+            { accessToken: 'testing' },
+            {
+              redirect: 'attacker.com',
+              headers: {
+                referer: 'https://target.com/login'
+              }
+            }
+          ),
+        {
+          name: 'NotAuthenticated'
+        }
+      )
+    })
+
+    it('should allow valid relative path redirect', async () => {
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          redirect: '/dashboard',
+          headers: {
+            referer: 'https://target.com/login'
+          }
+        }
+      )
+      assert.equal(redirect, 'https://target.com/dashboard#access_token=testing')
+    })
+
+    it('should allow relative path with query string', async () => {
+      const redirect = await strategy.getRedirect(
+        { accessToken: 'testing' },
+        {
+          redirect: '/callback?state=abc',
+          headers: {
+            referer: 'https://target.com/login'
+          }
+        }
+      )
+      assert.ok(redirect!.startsWith('https://target.com/callback?state=abc'))
+    })
+  })
+
   describe('origin validation bypass via startsWith', () => {
     beforeEach(() => {
       app.get('authentication').oauth.origins = ['https://target.com']
```

---

### Incident Patch 15: `0526ffd9` (2026-03-05)
**Commit Message**: fix(mongodb): Block $rename operator in _patch data by default (CWE-943) (#3665)

**File**: `docs/api/databases/mongodb.md` (modified, +47/-0)
```diff
@@ -63,6 +63,7 @@ MongoDB adapter specific options are:
 - `Model {Promise<MongoDBCollection>}` (**required**) - A Promise that resolves with the MongoDB collection instance. This can also be the return value of an `async` function without `await`
 - `disableObjectify {boolean}` (_optional_, default `false`) - This will disable conversion of the id field to a MongoDB ObjectID if you want to e.g. use normal strings
 - `useEstimatedDocumentCount {boolean}` (_optional_, default `false`) - If `true` document counting will rely on `estimatedDocumentCount` instead of `countDocuments`
+- `disabledOperators {string[]}` (_optional_, default `['$rename']`) - A list of [MongoDB update operators](https://www.mongodb.com/docs/manual/reference/operator/update/) to block in `patch` data. See [Securing update operators](#securing-update-operators) for details.
 
 The [common API options](./common.md#options) are:
 
@@ -164,6 +165,52 @@ Note that creating indexes for an existing collection with many entries should b
 
 Additionally to the [common querying mechanism](./querying.md) this adapter also supports [MongoDB's query syntax](https://www.mongodb.com/docs/manual/tutorial/query-documents/) and the `update` method also supports MongoDB [update operators](https://www.mongodb.com/docs/manual/reference/operator/update/).
 
+## Securing update operators
+
+The `patch` method supports MongoDB [update operators](https://www.mongodb.com/docs/manual/reference/operator/update/) like `$push`, `$inc`, and `$unset` in the data payload. While this is powerful, it can be a security risk if patch data from the client is not properly validated. For example, an authenticated user who can patch their own profile could send:
+
+```ts
+// Escalate privileges by pushing to a roles array
+await app.service('users').patch(userId, { $push: { roles: 'admin' } })
+
+// Expose internal fields by renaming them
+await app.service('users').patch(userId, { $rename: { secretField: 'public' } })
+```
+
+### Schema validation
+
+The primary defense is to use [schema validation](../schema/validators.md) on your patch data. When your schema only allows known fields with known types, unexpected operators will be rejected before they reach the database.
+
+### The `disabledOperators` option
+
+As an additional layer of defense, the `disabledOperators` option blocks specific update operators from being passed through to MongoDB. By default, `$rename` is blocked.
+
+To block additional operators on a service:
+
+```ts
+new MongoDBService({
+  Model: app.get('mongodbClient').then((db) => db.collection('users')),
+  disabledOperators: ['$rename', '$unset', '$inc']
+})
+```
+
+To override per-call via `params.adapter`:
+
+```ts
+service.patch(id, data, {
+  adapter: { disabledOperators: ['$rename', '$unset'] }
+})
+```
+
+To allow all operators (not recommended without schema validation):
+
+```ts
+new MongoDBService({
+  Model: app.get('mongodbClient').then((db) => db.collection('messages')),
+  disabledOperators: []
+})
+```
+
 ## Search
 
 <BlockQuote type="warning" label="Important">
```

**File**: `packages/mongodb/src/adapter.ts` (modified, +8/-1)
```diff
@@ -29,6 +29,12 @@ export interface MongoDBAdapterOptions extends AdapterServiceOptions {
   Model: Collection | Promise<Collection>
   disableObjectify?: boolean
   useEstimatedDocumentCount?: boolean
+  /**
+   * A list of MongoDB update operators to block in `patch` data.
+   * Defaults to `['$rename']`. Any `$`-prefixed key in this list will be
+   * silently dropped from the update.
+   */
+  disabledOperators?: string[]
 }
 
 export interface MongoDBAdapterParams<Q = AdapterQuery> extends AdapterParams<
@@ -404,6 +410,7 @@ export class MongoDbAdapter<
       query,
       filters: { $sort, $select }
     } = this.filterQuery(id, params)
+    const disabledOperators = this.getOptions(params).disabledOperators || ['$rename']
 
     const replacement = Object.keys(data).reduce(
       (current, key) => {
@@ -416,7 +423,7 @@ export class MongoDbAdapter<
             ...current.$set,
             ...value
           }
-        } else {
+        } else if (!disabledOperators.includes(key)) {
           current[key] = value
         }
 
```

**File**: `packages/mongodb/test/index.test.ts` (modified, +47/-0)
```diff
@@ -839,6 +839,53 @@ describe('Feathers MongoDB Service', () => {
     })
   })
 
+  describe('disabledOperators in _patch', () => {
+    it('drops $rename by default', async () => {
+      const person = await app.service('people').create({ name: 'Secure', age: 30 })
+
+      const result = await app.service('people').patch(person._id, {
+        name: 'Updated',
+        $rename: { age: 'exposed' }
+      } as any)
+
+      assert.strictEqual(result.name, 'Updated')
+      assert.strictEqual(result.age, 30)
+
+      await app.service('people').remove(person._id)
+    })
+
+    it('allows $push and other operators not in the denylist', async () => {
+      const person = await app.service('people').create({ name: 'PushTest', age: 20 })
+
+      const result = await app.service('people').patch(person._id, {
+        $push: { friends: 'Alice' }
+      } as any)
+
+      assert.strictEqual(result.friends?.length, 1)
+      assert.strictEqual(result.friends[0], 'Alice')
+
+      await app.service('people').remove(person._id)
+    })
+
+    it('drops operators added to disabledOperators', async () => {
+      const person = await app.service('people').create({ name: 'IncTest', age: 25 })
+
+      const result = await app.service('people').patch(
+        person._id,
+        {
+          $inc: { age: 100 }
+        } as any,
+        {
+          adapter: { disabledOperators: ['$rename', '$inc'] }
+        }
+      )
+
+      assert.strictEqual(result.age, 25)
+
+      await app.service('people').remove(person._id)
+    })
+  })
+
   describe('NoSQL injection via object id', () => {
     let target: Person
 
```

#### Recent Merged Pull Requests:
- **PR #3706** (2026-09-17): fix(authentication): reject leftover codegen params for user (#3599) (@tonycoder-hub)
- **PR #3705** (2026-09-24): fix(schema): recheck external dispatch after resolving (@akasakariko)
- **PR #3704** (2026-09-11): fix: Update all dependencies (@daffl)
- **PR #3703** (2026-09-11): fix: Update dependencies (@daffl)
- **PR #3701** (2026-09-11): fix(transport-commons): map HEAD requests like GET for REST services (@rome-xi)
- **PR #3700** (2026-08-14): fix(adapter-commons): validate query operators nested in arrays (@marshallswain)
- **PR #3699** (2026-08-11): fix(authentication-oauth): allow any port on loopback OAuth origins (@marshallswain)
- **PR #3698** (2026-08-11): docs(authentication): clarify OAuth authStrategies security (@marshallswain)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
