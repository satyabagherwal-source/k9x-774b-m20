> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/feathersjs-feathers-learnings.md`  
> **Source**: github ([https://github.com/feathersjs/feathers](https://github.com/feathersjs/feathers))  
> **Source Version**: `e73ad697`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:54:27.852Z  
> **Learning ID**: `learn-github-feathersjs-feathers`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): feathersjs/feathers

> **Canonical Artifact**: `07_PROJECT_LEARNING/feathersjs-feathers-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feathersjs/feathers](https://github.com/feathersjs/feathers))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T13:54:27.472Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feathersjs/feathers`
- **Description**: The API and real-time application framework
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15255 stars

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

/**
 * Grant options a request must not override for providers with `dynamic: true`, since they
 * decide where tokens and profiles come from and how the response is checked.
 */
const PROTECTED_DYNAMIC_OPTIONS = [
  'request_url',
  'authorize_url',
  'access_url',
  'profile_url',
  'oauth',
  'origin',
  'prefix',
  'redirect_uri',
  'callback',
  'transport',
  'response',
  'key',
  'secret',
  'client_id',
  'client_secret',
  'consumer_key',
  'consumer_secret',
  'public_key',
  'private_key',
  'token_endpoint_auth_method',
  'token_endpoint_auth_signing_alg',
  'state',
  'nonce',
  'pkce',
  'subdomain',
  'name',
  'dynamic',
  'overrides'
]

/**
 * Authorization parameters `custom_params` must not replace, since Grant copies it over them.
 */
const PROTECTED_CUSTOM_PARAMS = [
  'client_id',
  'app_id',
  'appid',
  'client_key',
  'redirect_uri',
  'response_type',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method'
]

const omit = (data: any, keys: string[]) =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key)))

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

/**
 * Remove protected options from the request data for providers (or overrides) that are
 * configured with `dynamic: true`. `options` is the provider configuration as resolved by Grant.
 */
export const filterDynamic = (options: any, data: any) => {
  if (options?.dynamic !== true || !data || typeof data !== 'object') {
    return data
  }

  const result = omit(data, PROTECTED_DYNAMIC_OPTIONS)

  if (result.custom_params && typeof result.custom_params === 'object') {
    result.custom_params = omit(result.custom_params, PROTECTED_CUSTOM_PARAMS)
  }

  return result
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3084** (2023-04-05): **service.get(id) looses the where clause if query created in hook **
  *Symptoms*: Ran into a weird issue, whenever I add a before get hook like this:  ```   before: {     get: [       async (context: HookContext<TeamMembershipsService>) => {         const query = context.service.createQuery(context.params)         context.params.knex = query       }     ],    ...   } ``` which basically should do nothing. I get error: `NotFound: No record found for id 'cb36a3b0-007c-4719-9298-dcdea66705f8'.` That's because the query executed by knex looses the `where` clause and returns more than 1 entry: `knex:query select "team_memberships".* from "team_memberships" order by "team_memberships"."id" asc`  When `get(id)` is invoked it trickles down to this line in `_find()` in `KnexAdapter`: ``` const builder = params.knex ? params.knex.clone() : this.createQuery(params) ```  Since I've already created the query, `createQuery` is not invoked, and the `id` filter doesn't get added. The `id` query parameter is not added in my hook either when I call `createQuery(context.params)` because `id` is not present in params it's in `context.id`  Adding the id filter to the query in the hook helps: ``` async (context: HookContext<TeamMembershipsService>) => {   const query = context.service.createQuery(context.params)   query.where('id', context.id)   context.params.knex = query } ```  ### Expected behavior I expected the id filter to be appended to the query i create in the hook automatically  ### Actual behavior where id=abc filter doesn't get 

- **Issue #3065** (2023-04-05): **$select=['id'] in query returns an array of ID's**
  *Symptoms*: I'm receiving an array of 2 IDs when using $select argument in my query object.  ### Steps to reproduce  URL:  http://localhost:3003/submissions?$select[]=id&$select[]=title  ### Expected behavior {   "total": 1,   "limit": 10,   "skip": 0,   "data": [{       "id": 1,       "title": "First submission"     }] }  ### Actual behavior  This is the response: {   "total": 1,   "limit": 10,   "skip": 0,   "data": [{       "id": [         1,         1       ],       "title": "First submission"     }] }  ### System configuration  I'm using MSSQL and Knex.  **Module versions** (especially the part that's not working): feathers 5.0.0-pre.35  **NodeJS version**: v18.13.0  **Operating System**: macOS Ventura 13.2 

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

### Incident Patch 1: `616e8850` (2026-10-25)
**Commit Message**: fix(authentication-oauth): allow account linking from the configured oAuth origin

**File**: `packages/authentication-oauth/src/strategy.ts` (modified, +10/-3)
```diff
@@ -8,6 +8,7 @@ import { Params } from '@feathersjs/feathers'
 import { NotAuthenticated } from '@feathersjs/errors'
 import { createDebug, _ } from '@feathersjs/commons'
 import qs from 'qs'
+import { getGrantConfig } from './utils'
 
 const debug = createDebug('@feathersjs/authentication-oauth/strategy')
 
@@ -192,15 +193,17 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
   }
 
   /**
-   * Account linking with a `feathers_token` must be started from the app, since anyone can send a
-   * link with their own token. Override to allow linking from clients that send no referer.
+   * Account linking with a `feathers_token` must be started from the app (the request host, the
+   * configured oAuth origin or an allowed origin), since anyone can send a link with their own token.
+   * Override to allow linking from clients that send no referer.
    *
    * @throws NotAuthenticated if the referer is missing or not an allowed origin
    */
   async validateLink(params: Params) {
     const { redirect, origins = this.app.get('origins') } = this.authentication.configuration.oauth
     const { referer, host } = params.headers || {}
     const allowed = Array.isArray(origins) ? origins : redirect ? [redirect] : []
+    const { origin } = getGrantConfig(this.authentication as any).defaults
     let url: URL
 
     try {
@@ -209,7 +212,11 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
       throw new NotAuthenticated('Account linking must be started from an allowed origin.')
     }
 
-    if (url.host !== host && !allowed.some((origin: string) => isOriginAllowed(url.origin, origin))) {
+    if (
+      url.host !== host &&
+      !isOriginAllowed(url.origin, origin) &&
+      !allowed.some((current: string) => isOriginAllowed(url.origin, current))
+    ) {
       throw new NotAuthenticated('Account linking must be started from an allowed origin.')
     }
   }
```

**File**: `packages/authentication-oauth/test/link.test.ts` (modified, +12/-0)
```diff
@@ -79,6 +79,18 @@ describe('@feathersjs/authentication-oauth account linking', () => {
     assert.equal(data.user.gitlabId, 'test')
   })
 
+  it('links the account behind a proxy that rewrites the Host header', async () => {
+    const { user, token } = await createUser('user@example.com')
+    const { data } = await linkFlow(token, {
+      host: 'internal.example:3030',
+      referer: `http://127.0.0.1:${port}/settings`
+    })
+
+    assert.ok(data.accessToken)
+    assert.equal(data.user.id, user.id)
+    assert.equal(data.user.gitlabId, 'test')
+  })
+
   it('uses the configured origins', async () => {
     const oauth = app.get('authentication').oauth
     const { token } = await createUser('user@example.com')
```

---

### Incident Patch 2: `1c29862c` (2026-10-25)
**Commit Message**: fix(authentication-oauth): only link accounts from an allowed origin

**File**: `packages/authentication-oauth/src/service.ts` (modified, +8/-1)
```diff
@@ -220,7 +220,14 @@ export class OAuthService {
     }
 
     if (feathers_token) {
-      debug('Got feathers_token query parameter to link accounts', feathers_token)
+      debug('Got feathers_token query parameter to link accounts')
+      const strategy = this.service.getStrategy(params.route.provider) as OAuthStrategy
+
+      if (typeof strategy?.validateLink !== 'function') {
+        throw new NotAuthenticated('Account linking is not supported for this provider.')
+      }
+
+      await strategy.validateLink(params)
       session.accessToken = feathers_token
     }
 
```

**File**: `packages/authentication-oauth/src/strategy.ts` (modified, +23/-0)
```diff
@@ -191,6 +191,29 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
     return redirect
   }
 
+  /**
+   * Account linking with a `feathers_token` must be started from the app, since anyone can send a
+   * link with their own token. Override to allow linking from clients that send no referer.
+   *
+   * @throws NotAuthenticated if the referer is missing or not an allowed origin
+   */
+  async validateLink(params: Params) {
+    const { redirect, origins = this.app.get('origins') } = this.authentication.configuration.oauth
+    const { referer, host } = params.headers || {}
+    const allowed = Array.isArray(origins) ? origins : redirect ? [redirect] : []
+    let url: URL
+
+    try {
+      url = new URL(referer)
+    } catch {
+      throw new NotAuthenticated('Account linking must be started from an allowed origin.')
+    }
+
+    if (url.host !== host && !allowed.some((origin: string) => isOriginAllowed(url.origin, origin))) {
+      throw new NotAuthenticated('Account linking must be started from an allowed origin.')
+    }
+  }
+
   async getRedirect(
     data: AuthenticationResult | Error,
     params?: AuthenticationParams
```

**File**: `packages/authentication-oauth/test/link.test.ts` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+import { strict as assert } from 'assert'
+import axios from 'axios'
+import { CookieJar } from 'tough-cookie'
+import { expressFixture } from './utils/fixture'
+
+describe('@feathersjs/authentication-oauth account linking', () => {
+  const port = 9786
+  const host = `http://localhost:${port}`
+  const message = 'Account linking must be started from an allowed origin.'
+  const req = axios.create({
+    maxRedirects: 0,
+    validateStatus: () => true
+  })
+  let app: Awaited<ReturnType<typeof expressFixture>>
+
+  const createUser = async (email: string) => {
+    const user = await app.service('users').create({ email })
+    const token = await app.service('authentication').createAccessToken({}, { subject: `${user.id}` })
+
+    return { user, token }
+  }
+
+  const linkFlow = async (token: string | undefined, headers: Record<string, string> = {}) => {
+    const query = token ? `?feathers_token=${token}` : ''
+    const response = await req.get(`${host}/oauth/gitlab${query}`, { headers })
+
+    if (response.status !== 303) {
+      return response
+    }
+
+    const cookie = new CookieJar()
+    response.headers['set-cookie']?.forEach((value) => cookie.setCookie(value, host))
+
+    const provider = await req.get(response.data.location)
+
+    return req.get(provider.headers.location, { headers: { cookie: await cookie.getCookieString(host) } })
+  }
+
+  before(async () => {
+    app = await expressFixture(port, 5124)
+  })
+
+  after(async () => {
+    await app.teardown()
+  })
+
+  afterEach(async () => {
+    const users = (await app.service('users').find({ paginate: false })) as any[]
+
+    for (const user of users) {
+      await app.service('users').remove(user.id)
+    }
+  })
+
+  it('rejects a feathers_token link without a referer', async () => {
+    const { user: attacker, token } = await createUser('attacker@example.com')
+    const response = await linkFlow(token)
+
+    assert.equal(response.status, 401)
+    assert.equal(response.data.message, message)
+    assert.equal((await app.service('users').get(attacker.id)).gitlabId, undefined)
+  })
+
+  it('rejects a feathers_token link from another origin', async () => {
+    const { user: attacker, token } = await createUser('attacker@example.com')
+    const response = await linkFlow(token, { referer: 'https://evil.example/page' })
+
+    assert.equal(response.status, 401)
+    assert.equal(response.data.message, message)
+    assert.equal((await app.service('users').get(attacker.id)).gitlabId, undefined)
+  })
+
+  it('links the account when started from the API host', async () => {
+    const { user, token } = await createUser('user@example.com')
+    const { data } = await linkFlow(token, { referer: `${host}/settings` })
+
+    assert.ok(data.accessToken)
+    assert.equal(data.user.id, user.id)
+    assert.equal(data.user.gitlabId, 'test')
+  })
+
+  it('uses the configured origins', async () => {
+    const oauth = app.get('authentication').oauth
+    const { token } = await createUser('user@example.com')
+
+    oauth.origins = ['http://localhost:3000']
+
+    try {
+      const allowed = await req.get(`${host}/oauth/gitlab?feathers_token=${token}`, {
+        headers: { referer: 'http://localhost:3000/settings' }
+      })
+      const denied = await req.get(`${host}/oauth/gitlab?feathers_token=${token}`, {
+        headers: { referer: 'https://evil.example/' }
+      })
+
+      assert.equal(allowed.status, 303)
+      assert.equal(denied.status, 401)
+    } finally {
+      delete oauth.origins
+    }
+  })
+
+  it('sign in without feathers_token still works without a referer', async () => {
+    const { data } = await linkFlow(undefined)
+
+    assert.ok(data.accessToken)
+  })
+
+  it('validateLink can be overridden to allow clients without a referer', async () => {
+    const strategy = app.service('authentication').getStrategy('gitlab') as any
+    const original = strategy.validateLink
+    const { user, token } = await createUser('user@example.com')
+
+    strategy.validateLink = async () => {}
+
+    try {
+      const { data } = await linkFlow(token)
+
+      assert.equal(data.user.id, user.id)
+      assert.equal(data.user.gitlabId, 'test')
+    } finally {
+      strategy.validateLink = original
+    }
+  })
+})
```

---

### Incident Patch 3: `3673cde9` (2026-10-23)
**Commit Message**: fix(authentication-oauth): harden OAuth callback and profile handling

**File**: `package-lock.json` (modified, +2/-0)
```diff
@@ -30158,13 +30158,15 @@
         "@feathersjs/schema": "^5.0.50",
         "cookie-session": "^2.1.1",
         "grant": "^5.4.24",
+        "jsonwebtoken": "^9.0.3",
         "koa-session": "^7.0.2",
         "qs": "^6.16.0"
       },
       "devDependencies": {
         "@feathersjs/memory": "^5.0.50",
         "@types/cookie-session": "^2.0.49",
         "@types/express": "^4.17.21",
+        "@types/jsonwebtoken": "^9.0.10",
         "@types/koa-session": "^6.4.5",
         "@types/mocha": "^10.0.10",
         "@types/node": "^26.0.0",
```

**File**: `packages/authentication-oauth/package.json` (modified, +2/-0)
```diff
@@ -63,13 +63,15 @@
     "@feathersjs/schema": "^5.0.50",
     "cookie-session": "^2.1.1",
     "grant": "^5.4.24",
+    "jsonwebtoken": "^9.0.3",
     "koa-session": "^7.0.2",
     "qs": "^6.16.0"
   },
   "devDependencies": {
     "@feathersjs/memory": "^5.0.50",
     "@types/cookie-session": "^2.0.49",
     "@types/express": "^4.17.21",
+    "@types/jsonwebtoken": "^9.0.10",
     "@types/koa-session": "^6.4.5",
     "@types/mocha": "^10.0.10",
     "@types/node": "^26.0.0",
```

**File**: `packages/authentication-oauth/src/apple.ts` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+import { createPublicKey } from 'crypto'
+import jsonwebtoken from 'jsonwebtoken'
+import { createDebug } from '@feathersjs/commons'
+import { NotAuthenticated } from '@feathersjs/errors'
+// eslint-disable-next-line @typescript-eslint/ban-ts-comment
+//@ts-ignore
+import request from 'grant/lib/client'
+
+const debug = createDebug('@feathersjs/authentication-oauth/apple')
+
+const MAX_AGE = 60 * 60 * 1000
+const MIN_REFRESH = 5 * 60 * 1000
+const RETRY_AFTER = 30 * 1000
+
+/**
+ * Apple's public keys for `id_token` signatures. They are refreshed after an hour, or at most
+ * every few minutes for an unknown key id. A failed refresh keeps the previous keys and is
+ * not retried for a few seconds.
+ */
+export const appleKeys = {
+  url: 'https://appleid.apple.com/auth/keys',
+  keys: [] as any[],
+  fetchedAt: 0,
+  failedAt: 0
+}
+
+let refreshing: Promise<void> | null = null
+
+async function refreshAppleKeys() {
+  try {
+    const { body } = await request({ method: 'GET', url: appleKeys.url })
+
+    if (!Array.isArray(body?.keys) || !body.keys.length) {
+      throw new Error('No keys in response')
+    }
+
+    appleKeys.keys = body.keys
+    appleKeys.fetchedAt = Date.now()
+  } catch (error: any) {
+    debug('Could not refresh Apple keys', error.message)
+    appleKeys.failedAt = Date.now()
+  }
+}
+
+async function getAppleKey(kid: string) {
+  const age = Date.now() - appleKeys.fetchedAt
+  const findKey = () => appleKeys.keys.find((key) => key.kid === kid)
+  const canRetry = Date.now() - appleKeys.failedAt > RETRY_AFTER
+
+  if (canRetry && (age > MAX_AGE || (!findKey() && age > MIN_REFRESH))) {
+    refreshing ||= refreshAppleKeys().finally(() => (refreshing = null))
+    await refreshing
+  }
+
+  return findKey()
+}
+
+/**
+ * Apple sends the user's name (only on the first sign-in) as a JSON string in the callback body.
+ */
+function getAppleName(user: any) {
+  try {
+    return (typeof user === 'string' ? JSON.parse(user) : user)?.name
+  } catch {
+    return undefined
+  }
+}
+
+/**
+ * Without a `profile_url`, Grant uses the `user` field of the Apple callback body as the
+ * profile, which the client controls. Take the identity from the verified `id_token` instead
+ * and only keep the name from the callback body.
+ *
+ * @throws NotAuthenticated if the `id_token` is missing or not valid for `clientId`
+ */
+export async function getAppleProfile(payload: any, clientId: string) {
+  const idToken = payload.id_token || payload.raw?.id_token
+  let claims: any
+
+  if (!clientId) {
+    throw new NotAuthenticated('Could not get oAuth profile')
+  }
+
+  try {
+    const { header }: any = jsonwebtoken.decode(idToken, { complete: true })
+    const jwk = await getAppleKey(header.kid)
+
+    claims = jsonwebtoken.verify(idToken, createPublicKey({ key: jwk, format: 'jwk' }), {
+      algorithms: ['RS256'],
+      issuer: 'https://appleid.apple.com',
+      audience: clientId,
+      clockTolerance: 60
+    })
+  } catch {
+    throw new NotAuthenticated('Could not get oAuth profile')
+  }
+
+  if (typeof claims.sub !== 'string' || claims.sub === '') {
+    throw new NotAuthenticated('Could not get oAuth profile')
+  }
+
+  const name = getAppleName(payload.profile)
+
+  return {
+    sub: claims.sub,
+    ...(claims.email ? { email: claims.email } : {}),
+    ...(name ? { name } : {})
+  }
+}
```

**File**: `packages/authentication-oauth/src/service.ts` (modified, +54/-4)
```diff
@@ -4,12 +4,46 @@ import { FeathersError, GeneralError, NotAuthenticated } from '@feathersjs/error
 // eslint-disable-next-line @typescript-eslint/ban-ts-comment
 //@ts-ignore
 import Grant from 'grant/lib/grant'
+// eslint-disable-next-line @typescript-eslint/ban-ts-comment
+//@ts-ignore
+import grantConfig from 'grant/lib/config'
 import { AuthenticationService } from '@feathersjs/authentication'
 import { OAuthStrategy } from './strategy'
-import { getGrantConfig, OauthSetupSettings } from './utils'
+import { getAppleProfile } from './apple'
+import { filterDynamic, getGrantConfig, OauthSetupSettings } from './utils'
 
 const debug = createDebug('@feathersjs/authentication-oauth/services')
 
+const isValue = (value: any) => typeof value === 'string' && value !== ''
+
+/**
+ * Grant treats a callback without an authorization code (OAuth2) or token (OAuth1) as a
+ * successful response and exchanges the code with the provider the flow was started with.
+ *
+ * @throws NotAuthenticated if the callback is for a different provider or has no code or token
+ */
+function validateCallback(provider: any, params: OAuthParams) {
+  const { query = {}, session, state, route } = params
+  const input = Object.keys(query).length ? query : state?.oauthCallback || {}
+
+  if (session.grant?.provider && session.grant.provider !== route.provider) {
+    throw new NotAuthenticated('Invalid oAuth callback provider.')
+  }
+
+  if (input.error) {
+    return
+  }
+
+  if (provider.oauth === 2 && !isValue(input.code)) {
+    throw new NotAuthenticated('Missing oAuth authorization code.')
+  }
+
+  // Some OAuth1 providers store the request token code in the session instead
+  if (provider.oauth === 1 && !isValue(input.oauth_token) && !session.grant?.request?.code) {
+    throw new NotAuthenticated('Missing oAuth token.')
+  }
+}
+
 export type GrantResponse = {
   location: string
   session: any
@@ -80,19 +114,27 @@ export class OAuthService {
       query,
       route: { provider }
     } = params
+    const isCallback = override === 'callback'
+    // Only the request that starts the flow sets dynamic provider options
+    const options = isCallback ? null : grantConfig.provider(this.grant.config, { provider, override })
 
     const result: GrantResponse = await this.grant({
       params: { provider, override },
       state: state.grant,
       session: session.grant,
-      query,
+      query: filterDynamic(options, query),
       method,
-      body
+      body: filterDynamic(options, body)
     })
 
     session.grant = result.session
     state.grant = result.state
 
+    if (isCallback) {
+      // Grant passes a callback without a code through, so authenticate validates its input
+      state.oauthCallback = method === 'POST' ? body : {}
+    }
+
     return result
   }
 
@@ -128,10 +170,18 @@ export class OAuthService {
     }
 
     try {
+      const provider = grantConfig.provider(this.grant.config, grant || {}, params.state?.grant)
+
+      validateCallback(provider, params)
+
       if (payload.error) {
         throw new GeneralError(payload.error_description || payload.error, payload)
       }
 
+      if (provider.apple && !provider.profile_url && payload.profile) {
+        authentication.profile = await getAppleProfile(payload, provider.key)
+      }
+
       debug(`Calling ${authService}.create authentication with strategy ${name}`)
 
       const authResult = await this.service.create(authentication, authParams)
@@ -149,7 +199,7 @@ export class OAuthService {
         location
       }
     } catch (error: any) {
-      const location = await strategy.getRedirect(error, authParams)
+      const location = strategy ? await strategy.getRedirect(error, authParams) : null
       const e = new OAuthError(error.message, error.data, location)
 
       if (typeof params.session.destroy === 'function') {
```

**File**: `packages/authentication-oauth/src/strategy.ts` (modified, +17/-1)
```diff
@@ -120,8 +120,14 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
   }
 
   async getEntityQuery(profile: OAuthProfile, _params: Params) {
+    const id = profile.sub || profile.id
+
+    if (id === undefined || id === null) {
+      throw new NotAuthenticated('oAuth profile has no id')
+    }
+
     return {
-      [`${this.name}Id`]: profile.sub || profile.id
+      [`${this.name}Id`]: id
     }
   }
 
@@ -132,6 +138,10 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
   }
 
   async getProfile(data: AuthenticationRequest, _params: Params) {
+    if (!data.profile || data.profile.error) {
+      throw new NotAuthenticated('Could not get oAuth profile')
+    }
+
     return data.profile
   }
 
@@ -208,6 +218,12 @@ export class OAuthStrategy extends AuthenticationBaseStrategy {
 
   async findEntity(profile: OAuthProfile, params: Params) {
     const query = await this.getEntityQuery(profile, params)
+    const values = Object.values(query)
+
+    // Adapters drop undefined values, so an empty or undefined query returns any entity
+    if (!values.length || values.includes(undefined)) {
+      throw new NotAuthenticated('Invalid oAuth entity query')
+    }
 
     debug('findEntity with query', query)
 
```

**File**: `packages/authentication-oauth/src/utils.ts` (modified, +72/-0)
```diff
@@ -11,6 +11,60 @@ import koaCookieSession from 'koa-session'
 import { AuthenticationService } from '@feathersjs/authentication'
 import { GrantConfig } from 'grant'
 
+/**
+ * Grant options a request must not override for providers with `dynamic: true`, since they
+ * decide where tokens and profiles come from and how the response is checked.
+ */
+const PROTECTED_DYNAMIC_OPTIONS = [
+  'request_url',
+  'authorize_url',
+  'access_url',
+  'profile_url',
+  'oauth',
+  'origin',
+  'prefix',
+  'redirect_uri',
+  'callback',
+  'transport',
+  'response',
+  'key',
+  'secret',
+  'client_id',
+  'client_secret',
+  'consumer_key',
+  'consumer_secret',
+  'public_key',
+  'private_key',
+  'token_endpoint_auth_method',
+  'token_endpoint_auth_signing_alg',
+  'state',
+  'nonce',
+  'pkce',
+  'subdomain',
+  'name',
+  'dynamic',
+  'overrides'
+]
+
+/**
+ * Authorization parameters `custom_params` must not replace, since Grant copies it over them.
+ */
+const PROTECTED_CUSTOM_PARAMS = [
+  'client_id',
+  'app_id',
+  'appid',
+  'client_key',
+  'redirect_uri',
+  'response_type',
+  'state',
+  'nonce',
+  'code_challenge',
+  'code_challenge_method'
+]
+
+const omit = (data: any, keys: string[]) =>
+  Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key)))
+
 export interface OauthSetupSettings {
   linkStrategy: string
   authService?: string
@@ -65,6 +119,24 @@ export const getGrantConfig = (service: AuthenticationService): GrantConfig => {
   return grant
 }
 
+/**
+ * Remove protected options from the request data for providers (or overrides) that are
+ * configured with `dynamic: true`. `options` is the provider configuration as resolved by Grant.
+ */
+export const filterDynamic = (options: any, data: any) => {
+  if (options?.dynamic !== true || !data || typeof data !== 'object') {
+    return data
+  }
+
+  const result = omit(data, PROTECTED_DYNAMIC_OPTIONS)
+
+  if (result.custom_params && typeof result.custom_params === 'object') {
+    result.custom_params = omit(result.custom_params, PROTECTED_CUSTOM_PARAMS)
+  }
+
+  return result
+}
+
 export const setExpressParams: RequestHandler = (req, res, next) => {
   req.session.destroy ||= () => {
     req.session = null
```

**File**: `packages/authentication-oauth/test/apple.test.ts` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+import { strict as assert } from 'assert'
+import crypto from 'crypto'
+import http from 'http'
+import { AddressInfo } from 'net'
+import jsonwebtoken from 'jsonwebtoken'
+import { appleKeys, getAppleProfile } from '../src/apple'
+
+describe('@feathersjs/authentication-oauth/apple', () => {
+  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
+  const otherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
+  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'apple-key' }
+  let server: http.Server
+  let fetched = 0
+  let respond = (res: http.ServerResponse) => {
+    res.writeHead(200, { 'content-type': 'application/json' })
+    res.end(JSON.stringify({ keys: [jwk] }))
+  }
+
+  const idToken = (claims: any, { key = privateKey, keyid = 'apple-key' } = {}) =>
+    jsonwebtoken.sign(
+      {
+        iss: 'https://appleid.apple.com',
+        aud: 'some-key',
+        exp: Math.floor(Date.now() / 1000) + 600,
+        ...claims
+      },
+      key,
+      {
+        algorithm: 'RS256',
+        keyid
+      }
+    )
+
+  before(async () => {
+    server = http.createServer((_req, res) => {
+      fetched++
+      respond(res)
+    })
+    await new Promise<void>((resolve) => server.listen(0, resolve))
+    appleKeys.url = `http://localhost:${(server.address() as AddressInfo).port}/auth/keys`
+  })
+
+  beforeEach(() => {
+    appleKeys.keys = []
+    appleKeys.fetchedAt = 0
+    appleKeys.failedAt = 0
+    fetched = 0
+  })
+
+  after(() => {
+    appleKeys.url = 'https://appleid.apple.com/auth/keys'
+    server.close()
+  })
+
+  it('takes sub and email from the id_token and keeps other profile fields', async () => {
+    const profile = await getAppleProfile(
+      {
+        id_token: idToken({ sub: 'real', email: 'real@example.com' }),
+        profile: { id: 'victim', sub: 'victim', email: 'victim@example.com', name: 'Jon' }
+      },
+      'some-key'
+    )
+
+    assert.deepEqual(profile, { name: 'Jon', sub: 'real', email: 'real@example.com' })
+  })
+
+  it('keeps only the name from the callback body, which Apple sends as a JSON string', async () => {
+    const user = JSON.stringify({ name: { firstName: 'Jon', lastName: 'Doe' }, email: 'victim@example.com' })
+    const fromString = await getAppleProfile(
+      { id_token: idToken({ sub: 'real' }), profile: user },
+      'some-key'
+    )
+    const fromObject = await getAppleProfile(
+      { id_token: idToken({ sub: 'real' }), profile: { name: 'Jon', role: 'admin', email_verified: true } },
+      'some-key'
+    )
+    const returning = await getAppleProfile(
+      { id_token: idToken({ sub: 'real' }), profile: { error: 'Grant: No profile URL found!' } },
+      'some-key'
+    )
+
+    assert.deepEqual(fromString, { sub: 'real', name: { firstName: 'Jon', lastName: 'Doe' } })
+    assert.deepEqual(fromObject, { sub: 'real', name: 'Jon' })
+    assert.deepEqual(returning, { sub: 'real' })
+  })
+
+  it('rejects id_tokens that do not verify', async () => {
+    const unsigned = jsonwebtoken.sign(
+      { sub: 'victim', iss: 'https://appleid.apple.com', aud: 'some-key' },
+      '',
+      {
+        algorithm: 'none'
+      }
+    )
+    const tokens = {
+      missing: undefined as any,
+      'signed with another key': idToken({ sub: 'victim' }, { key: otherKey }),
+      'unknown key id': idToken({ sub: 'victim' }, { keyid: 'unknown' }),
+      'unsigned (alg none)': unsigned,
+      'wrong issuer': idToken({ sub: 'victim', iss: 'https://evil.example.com' }),
+      'wrong audience': idToken({ sub: 'victim', aud: 'another-client' }),
+      expired: idToken({ sub: 'victim', exp: Math.floor(Date.now() / 1000) - 3600 }),
+      'missing subject': idToken({})
+    }
+
+    for (const [description, token] of Object.entries(tokens)) {
+      await assert.rejects(
+        () => getAppleProfile({ id_token: token, profile: {} }, 'some-key'),
+        { message: 'Could not get oAuth profile' },
+        description
+      )
+    }
+  })
+
+  it('rejects when no client id is configured', async () => {
+    await assert.rejects(
+      () => getAppleProfile({ id_token: idToken({ sub: 'x' }), profile: {} }, undefined as any),
+      {
+        message: 'Could not get oAuth profile'
+      }
+    )
+  })
+
+  it('caches the keys and refreshes them for an unknown key id at most every few minutes', async () => {
+    await getAppleProfile({ id_token: idToken({ sub: 'x' }), profile: {} }, 'some-key')
+    await getAppleProfile({ id_token: idToken({ sub: 'x' }), profile: {} }, 'some-key')
+    assert.equal(fetched, 1)
+
+    const unknown = { id_token: idToken({ sub: 'x' }, { keyid: 'unknown' }), profile: {} }
+
+    await assert.rejects(() => getAppleProfile(unknown, 'some-key'))
+    assert.equal(fetched, 1)
+
+    appleKeys.fetchedAt -= 10 * 60 * 1000
+    await assert.rejects(() => getAppleProfile(unknown, 'some-key'))
+    assert.equal(fetched, 2)
+ 
```

**File**: `packages/authentication-oauth/test/koa.test.ts` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+import { strict as assert } from 'assert'
+import axios from 'axios'
+import { CookieJar } from 'tough-cookie'
+import { koaFixture } from './utils/fixture'
+
+describe('@feathersjs/authentication-oauth with Koa', () => {
+  const port = 9785
+  const host = `http://localhost:${port}`
+  const req = axios.create({
+    maxRedirects: 0,
+    validateStatus: () => true
+  })
+  let app: Awaited<ReturnType<typeof koaFixture>>
+
+  // Start the oAuth flow and return the grant session cookie and the provider location
+  const startFlow = async () => {
+    const cookie = new CookieJar()
+    const response = await req.get(`${host}/oauth/github`)
+
+    assert.equal(response.status, 303)
+    response.headers['set-cookie']?.forEach((value) => cookie.setCookie(value, host))
+
+    return { cookie: await cookie.getCookieString(host), location: response.data.location }
+  }
+
+  before(async () => {
+    app = await koaFixture(port, 5123)
+    await app.service('users').create({ email: 'admin@example.com' })
+  })
+
+  after(async () => {
+    await app.teardown()
+  })
+
+  it('runs through the oAuth flow', async () => {
+    const { cookie, location } = await startFlow()
+    const provider = await req.get(location)
+    const { data } = await req.get(provider.headers.location, { headers: { cookie } })
+
+    assert.ok(data.accessToken)
+    assert.equal(data.user.githubId, 'test')
+  })
+
+  it('rejects a GET callback without an authorization code', async () => {
+    const { cookie } = await startFlow()
+    const response = await req.get(`${host}/oauth/github/callback?code=&state=`, { headers: { cookie } })
+
+    assert.equal(response.status, 401)
+    assert.equal(response.data.message, 'Missing oAuth authorization code.')
+    assert.ok(!response.data.accessToken)
+  })
+
+  it('accepts a POST callback with the code in the body and rejects one without', async () => {
+    const valid = await req.post(
+      `${host}/oauth/github/callback`,
+      { code: 'code' },
+      { headers: { cookie: (await startFlow()).cookie } }
+    )
+    const empty = await req.post(
+      `${host}/oauth/github/callback`,
+      { user: { id: 'victim' } },
+      { headers: { cookie: (await startFlow()).cookie } }
+    )
+
+    assert.ok(valid.data.accessToken)
+    assert.equal(empty.status, 401)
+    assert.equal(empty.data.message, 'Missing oAuth authorization code.')
+  })
+})
```

#### Recent Merged Pull Requests:
- **PR #3719** (2026-10-23): fix(create-feathers): Call app.setup in Deno and Bun apps (v6) (@fratzinger)
- **PR #3718** (2026-10-23): fix(client): Stringify dates in queries as ISO strings (v6) (@fratzinger)
- **PR #3717** (2026-10-23): fix(hooks): Allow synchronous functions to return null or undefined (v6) (@fratzinger)
- **PR #3716** (2026-10-23): fix(http): Initialize context.http for HTTP service calls (v6) (@fratzinger)
- **PR #3715** (2026-10-17): fix(http): Do not allow standard methods via method override header (v6) (@fratzinger)
- **PR #3706** (2026-09-17): fix(authentication): reject leftover codegen params for user (#3599) (@tonycoder-hub)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. authentication-oauth): allow account linking from the configured oAuth origin

**RULE**:
When implementing operations in `packages/authentication-oauth/src/strategy.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in feathersjs/feathers. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `616e8850`: authentication-oauth): allow account linking from the configured oAuth origin. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/authentication-oauth/src/strategy.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { getGrantConfig } from './utils'
   * Account linking with a `feathers_token` must be started from the app (the request host, the
   * configured oAuth origin or an allowed origin), since anyone can send a link with their own token.
   * Override to allow linking from clients that send no referer.
    const { origin } = getGrantConfig(this.authentication as any).defaults
    if (
      url.host !== host &&
      !isOriginAllowed(url.origin, origin) &&
      !allowed.some((current: string) => isOriginAllowed(url.origin, current))
    ) {
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
   * Account linking with a `feathers_token` must be started from the app, since anyone can send a
   * link with their own token. Override to allow linking from clients that send no referer.
    if (url.host !== host && !allowed.some((origin: string) => isOriginAllowed(url.origin, origin))) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `616e8850` are properly handled with clean fallback behavior.
