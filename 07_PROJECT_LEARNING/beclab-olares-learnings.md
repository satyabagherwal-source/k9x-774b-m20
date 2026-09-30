# Forensic Learning Record (Deep Inspection): beclab/Olares

> **Canonical Artifact**: `07_PROJECT_LEARNING/beclab-olares-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/beclab/Olares](https://github.com/beclab/Olares))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:36.113Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `beclab/Olares`
- **Description**: Open-Source Personal Cloud OS for Always-On Agents
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5296 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/packages/admin/.eslintrc.js`
```
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};

```

### Core Architecture Module: `apps/packages/admin/src/app.module.ts`
```
import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';

@Module({
  imports: [],
  controllers: [VaultController],
  providers: [],
})
export class AppModule {}

```

### Core Architecture Module: `apps/packages/admin/src/config/config.ts`
```
import { Config, ConfigParam } from '@didvault/sdk/src/core/config';
import { ServerConfig } from '@didvault/sdk/src/core/server';

//import { MongoDBStorageConfig } from './storage/mongodb';
//import { AuthType } from '@didvault/sdk/src/core/auth';

import { PostgresConfig } from './postgres';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { BasicProvisionerConfig } from '@didvault/sdk/src/core/provisioning';
// import {
//   ChangeLoggerConfig,
//   RequestLoggerConfig,
// } from '@didvault/sdk/src/core/logging';

export class DataStorageConfig extends Config {
  constructor(init: Partial<DataStorageConfig> = {}) {
    super();
    Object.assign(this, init);
  }

  @ConfigParam()
  backend: 'void' | 'memory' | 'leveldb' | 'mongodb' | 'postgres' = 'leveldb';

  // @ConfigParam(MongoDBStorageConfig)
  // mongodb?: MongoDBStorageConfig;

  @ConfigParam(PostgresConfig)
  postgres?: PostgresConfig;
}

export class ProvisioningConfig extends Config {
  @ConfigParam()
  backend: 'basic' | 'directory' | 'stripe' = 'basic';

  @ConfigParam(BasicProvisionerConfig)
  basic?: BasicProvisionerConfig;

  // @ConfigParam(StripeProvisionerConfig)
  // stripe?: StripeProvisionerConfig;

  // @ConfigParam(DirectoryProvisionerConfig)
  // directory?: DirectoryProvisionerConfig;
}

// export class DirectoryConfig extends Config {
//     @ConfigParam("string[]")
//     providers: "scim"[] = ["scim"];

//     @ConfigParam(ScimServerConfig)
//     scim?: ScimServerConfig;
// }

export class PadlocConfig extends Config {
  constructor(init: Partial<PadlocConfig> = {}) {
    super();
    Object.assign(this, init);
  }

  @ConfigParam(ServerConfig)
  server = new ServerConfig();

  @ConfigParam(DataStorageConfig)
  data = new DataStorageConfig();

  @ConfigParam(ProvisioningConfig)
  provisioning = new ProvisioningConfig();

  // @ConfigParam(DirectoryConfig)
}

export function getConfig() {
  // const envFile = process.argv
  //   .find((arg) => arg.startsWith('--env='))
  //   ?.slice(6);
  // const path = envFile && resolve(process.cwd(), envFile);
  // const override = process.argv.includes('--env-override');
  // dotenv.config({ override, path });
  return new PadlocConfig().fromEnv(
    process.env as { [v: string]: string },
    'PL_',
  );
}

```

### Core Architecture Module: `apps/packages/admin/src/config/postgres.ts`
```
import { Pool } from 'pg';
import {
  Storable,
  StorableConstructor,
  Storage,
  StorageListOptions,
  StorageQuery,
} from '@didvault/sdk/src/core';
import { ConfigParam } from '@didvault/sdk/src/core';
import { Config } from '@didvault/sdk/src/core';
import { Err, ErrorCode } from '@didvault/sdk/src/core';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export class PostgresConfig extends Config {
  @ConfigParam()
  host = 'localhost';

  @ConfigParam()
  user!: string;

  @ConfigParam('string', true)
  password!: string;

  @ConfigParam('number')
  port = 5432;

  @ConfigParam()
  database = 'padloc';

  @ConfigParam('boolean')
  tls?: boolean;

  @ConfigParam()
  tlsCAFile?: string;

  @ConfigParam()
  tlsCAFileContents?: string;

  @ConfigParam('boolean')
  tlsRejectUnauthorized?: boolean = true;
}

function toJsonbPath(path: string) {
  const pathParts = path.split('.');
  return (
    'data' +
    pathParts
      .slice(0, -1)
      .map((part) => `->'${part}'`)
      .join('') +
    `->>'${pathParts[pathParts.length - 1]}'`
  );
}

function queryToSQL(query: StorageQuery): string {
  switch (query.op) {
    case 'and':
      return `(${query.queries.map((q) => queryToSQL(q)).join(' AND ')})`;
    case 'or':
      return `(${query.queries.map((q) => queryToSQL(q)).join(' OR ')})`;
    case 'not':
      return `NOT (${queryToSQL(query.query)})`;
    default: {
      const op = {
        eq: '=',
        ne: '!=',
        gt: '>',
        lt: '<',
        gte: '>=',
        lte: '<=',
        regex: '~*',
        negex: '!~*',
      }[query.op || 'eq'];
      switch (typeof query.value) {
        case 'string':
        case 'boolean':
        case 'number':
          return `${toJsonbPath(query.path)} ${op} '${query.value.toString()}'`;
        default:
          return `${toJsonbPath(query.path)} IS NULL`;
      }
    }
  }
}

export class PostgresStorage implements Storage {
  private _pool: Pool;

  private _ensuredTables = new Map<string, Promise<void>>();

  constructor(public config: PostgresConfig) {
    const {
      host,
      user,
      password,
      port,
      database,
      tls,
      tlsCAFile,
      tlsCAFileContents,
      tlsRejectUnauthorized,
    } = config;
    const tlsCAFilePath = tlsCAFile && resolve(process.cwd(), tlsCAFile);
    const ca =
      tlsCAFileContents ||
      (tlsCAFilePath && readFileSync(tlsCAFilePath).toString());
    this._pool = new Pool({
      host,
      user,
      password,
      port,
      database,
      ssl: tls
        ? {
            rejectUnauthorized: tlsRejectUnauthorized,
            ca,
          }
        : undefined,
    });
  }

  private _ensureTable(kind: string) {
    if (!this._ensuredTables.has(kind)) {
      this._ensuredTables.set(
        kind,
        this._pool
          .query(
            `
                            CREATE TABLE IF NOT EXISTS ${kind} (
                                id text PRIMARY KEY,
                                data jsonb NOT NULL
                            )
                        `,
          )
          .then(() => {
            //
          }),
      );
    }
    return this._ensuredTables.get(kind);
  }

  async save<T extends Storable>(obj: T): Promise<void> {
    console.log('saving kind ' + obj.kind);
    await this._ensureTable(obj.kind);
    await this._pool.query(
      `
            INSERT INTO ${obj.kind} (id, data) values($1, $2) ON CONFLICT (id) DO
                UPDATE SET data=$2
        `,
      [obj.id, obj.toRaw()],
    );
  }

  async saveID<T extends Storable>(id: string, obj: T): Promise<void> {
    await this._ensureTable(obj.kind);
    await this._pool.query(
      `
            INSERT INTO ${obj.kind} (id, data) values($1, $2) ON CONFLICT (id) DO
                UPDATE SET data=$2
        `,
      [id, obj.toRaw()],
    );
  }

  async get<T extends Storable>(
    cls: T | StorableConstructor<T>,
    id: string,
  ): Promise<T> {
    const res = cls instanceof Storable ? cls : new cls();
    //console.log('get kind ' + res.kind);
    await this._ensureTable(res.kind);
    const {
      rows: [row],
    } = await this._pool.query(`SELECT data FROM ${res.kind} WHERE id=$1`, [
      id,
    ]);
    if (!row) {
      throw new Err(
        ErrorCode.NOT_FOUND,
        `Cannot find object: ${res.kind}_${id}`,
      );
    }
    return res.fromRaw(row.data);
  }

  async delete<T extends Storable>(obj: T): Promise<void> {
    await this._ensureTable(obj.kind);
    await this._pool.query(`DELETE FROM ${obj.kind} WHERE id=$1`, [obj.id]);
  }

  clear(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async list<T extends Storable>(
    cls: StorableConstructor<T>,
    {
      limit,
      offset,
      query: where,
      orderBy,
      orderByDirection = 'asc',
    }: StorageListOptions = {},
  ): Promise<T[]> {
    const kind = new cls().kind;
    console.log('list kind ' + kind);
    await this._ensureTable(kind);

    let query = `SELECT data FROM ${kind}`;

    if (where) {
      query += ` WHERE ${queryToSQL(where)}`;
    }

    if (orderBy) {
      query += ` ORDER BY ${toJsonbPath(orderBy)} ${orderByDirection}`;
    }

    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const { rows } = await this._pool.query(query);
    return rows.map((row: any) => new cls().fromRaw(row.data));
  }

  async count<T extends Storable>(
    cls: StorableConstructor<T>,
    query?: StorageQuery,
  ) {
    const kind = new cls().kind;
    await this._ensureTable(kind);
    const sql = `SELECT COUNT(*) FROM ${kind}${
      query ? ` WHERE ${queryToSQL(query)}` : ''
    }`;
    console.log(sql);
    const {
      rows: [{ count }],
    } = await this._pool.query(sql);
    return Number(count);
  }
}

```

### Core Architecture Module: `apps/packages/admin/src/jwt.ts`
```
import { base58btc } from 'multiformats/bases/base58';
import { base64url } from 'multiformats/bases/base64';
import * as varint from 'varint';
import { DIDDocument, LDKeyType, PublicJwk, PrivateJwk } from '@bytetrade/core';
const ED25519_CODEC_ID = varint.encode(parseInt('0xed', 16));

export function resolve(did: string): DIDDocument {
  const [scheme, method, id] = did.split(':');

  if (scheme !== 'did') {
    throw new Error('malformed scheme');
  }

  if (method !== 'key') {
    throw new Error('did method MUST be "key"');
  }

  const idBytes = base58btc.decode(id);
  const publicKeyBytes = idBytes.slice(ED25519_CODEC_ID.length);
  const x = base64url.baseEncode(publicKeyBytes);

  console.log(
    'base64url.baseEncode(publicKeyBytes) ' +
      base64url.baseEncode(publicKeyBytes),
  );

  const mId = `#${id}`;

  const didDocument: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
      'https://w3id.org/security/suites/x25519-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: mId,
        type: LDKeyType.Ed25519VerificationKey2020,
        controller: did,
        publicKeyJwk: {
          alg: 'EdDSA',
          crv: 'Ed25519',
          kid: did,
          kty: 'OKP',
          use: 'sig',
          x: x,
        },
      },
    ],
    authentication: [mId],
    assertionMethod: [mId],
    capabilityDelegation: [mId],
    capabilityInvocation: [mId],
  };

  return didDocument;
}

```

### Core Architecture Module: `apps/packages/admin/src/main.ts`
```
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  //app.useWebSocketAdapter(new WsAdapter(app)); // 使用我们的适配器
  await app.listen(3010);
}
bootstrap();

```

### Core Architecture Module: `apps/packages/admin/src/vault.controller.ts`
```
import {
  Controller,
  Logger,
  Post,
  Body,
  OnModuleInit,
  Req,
  Get,
  Param,
  HttpCode,
} from '@nestjs/common';
import { Account } from '@didvault/sdk/src/core/account';
import { setPlatform } from '@didvault/sdk/src/core';
import { NodePlatform } from '@didvault/sdk/src/core';
import { Auth } from '@didvault/sdk/src/core/auth';
import { Session } from '@didvault/sdk/src/core/session';
import { getIdFromDID } from '@didvault/sdk/src/core/util';
import { Err, ErrorCode } from '@didvault/sdk/src/core/error';
import { Org, OrgID } from '@didvault/sdk/src/core/org';
import { Vault } from '@didvault/sdk/src/core/vault';
import { stripPropertiesRecursive, DeviceInfo } from '@didvault/sdk/src/core';
import { BasicProvisionerConfig } from '@didvault/sdk/src/core/provisioning';
import { BasicProvisioner } from '@didvault/sdk/src/core/provisioning';
import { ListParams } from '@didvault/sdk/src/core/api';
import { PostgresStorage } from './config/postgres';
import { getConfig, DataStorageConfig, PadlocConfig } from './config/config';
import { returnSucceed, Result, DIDDocument } from '@bytetrade/core';
import * as jose from 'jose';
import { resolve } from './jwt';

export interface VerifyDataResponse {
  verify: boolean;
  payload?: any;
  name?: string;
  did?: string;
}

async function initDataStorage(config: DataStorageConfig) {
  //let storage = null;
  switch (config.backend) {
    case 'postgres':
      if (!config.postgres) {
        throw "PL_DATA_STORAGE_BACKEND was set to 'postgres', but no related configuration was found!";
      }
      return new PostgresStorage(config.postgres);

    default:
      throw `Invalid value for PL_DATA_STORAGE_BACKEND: ${config.backend}! Supported values: leveldb, mongodb`;
  }
}

async function initProvisioner(
  config: PadlocConfig,
  storage: PostgresStorage /*, directoryProviders?: DirectoryProvider[]*/,
) {
  switch (config.provisioning.backend) {
    case 'basic':
      if (!config.provisioning.basic) {
        config.provisioning.basic = new BasicProvisionerConfig();
      }
      return new BasicProvisioner(storage, config.provisioning.basic);
    // case "directory":
    //     const directoryProvisioner = new DirectoryProvisioner(
    //         storage,
    //         directoryProviders,
    //         config.provisioning.directory
    //     );
    //     return directoryProvisioner;
    // case "stripe":
    //     if (!config.provisioning.stripe) {
    //         throw "PL_PROVISIONING_BACKEND was set to 'stripe', but no related configuration was found!";
    //     }
    //     const stripeProvisioner = new StripeProvisioner(config.provisioning.stripe, storage);
    //     await stripeProvisioner.init();
    //     return stripeProvisioner;
    default:
      throw `Invalid value for PL_PROVISIONING_BACKEND: ${config.provisioning.backend}! Supported values: "basic", "directory", "stripe"`;
  }
}

@Controller('')
export class VaultController implements OnModuleInit {
  private readonly logger = new Logger(VaultController.name);

  public storage: PostgresStorage;
  public provisioner: BasicProvisioner;

  constructor() {
    //
  }

  async onModuleInit(): Promise<void> {
    this.logger.debug('onModuleInit');
    const config = getConfig();
    try {
      setPlatform(new NodePlatform());

      this.storage = await initDataStorage(config.data);

      //const directoryProviders = await initDirectoryProviders(config, storage);
      this.provisioner = await initProvisioner(
        config,
        this.storage /*, directoryProviders*/,
      );

      console.log(
        'Server started with config: ',
        JSON.stringify(
          stripPropertiesRecursive(config.toRaw(), ['kind', 'version']),
          null,
          4,
        ),
      );
    } catch (e) {
      console.error(
        'Init failed. Error: ',
        e,
        '\nConfig: ',
        JSON.stringify(
          stripPropertiesRecursive(config.toRaw(), ['kind', 'version']),
          null,
          4,
        ),
      );
    }
  }

  @Post('/callback/delete')
  async deleteAccount(@Body() { name }: { name: string }): Promise<void> {
    this.logger.debug('deleteAccount ' + name);

    const list = await this.storage.list(Account, new ListParams());
    //this.logger.verbose(list);
    const account: Account = list.find((l) => l.did == name);
    this.logger.verbose('found ' + name);

    if (!account) {
      // throw new Err(
      //   ErrorCode.AUTHENTICATION_FAILED,
      //   'This account is currently not available!',
      // );
      this.logger.warn('Account not found: ' + name);
      return;
    }

    // let { account, auth } = this._requireAuth();

    // // Deleting other accounts than one's one is only allowed to super admins
    // if (id && account.id !== id) {
    //   this._requireAuth(true);

    //const account = await this.storage.get(Account, id);
    const auth = await this._getAuth(account.did);
    if (auth) {
      this.logger.verbose('found auth');
    } else {
      this.logger.verbose('not_found auth');
    }
    //}

    // Make sure that the account is not owner of any organizations
    const orgs = await Promise.all(
      account.orgs.map(({ id }) => this.storage.get(Org, id)),
    );

    this.logger.verbose('orgs size ' + orgs.length);

    for (const org of orgs) {
      if (org.isOwner(account)) {
        //await this.deleteOrg(org.id);
        console.log("error can't remove owner");
        return;
      } else {
        await org.removeMember(account, false);
        await this.storage.save(org);
      }
    }

    this.logger.verbose('finish orgs');

    await this.provisioner.accountDeleted({ did: account.did });
    this.logger.verbose('finish provisioner');

    // Delete main vault
    await this.storage.delete(
      Object.assign(new Vault(), { id: account.mainVault }),
    );
    this.logger.verbose('finish storage');

    // Revoke all sessions
    if (auth) {
      await auth.sessions.map((s) =>
        this.storage.delete(Object.assign(new Session(), s)),
      );
      this.logger.verbose('finish session');

      // Delete auth object
      await this.storage.delete(auth);
      this.logger.verbose('finish storage auth');
    } else {
      this.logger.verbose('auth is null');
    }

    // Delete account object
    await this.storage.delete(account);

    this.logger.verbose('finish storage account');

    return;
  }

  @Get('/vault/trust_device/:name')
  async getTrustDevices(
    @Req() request: Request,
    @Param('name') name: string,
  ): Promise<Result<DeviceInfo[]>> {
    //
    console.log('name ' + name);
    console.log('headers');
    console.log(request.headers);

    const auth = await this._getAuth(name);
    console.log(auth);
    if (auth) {
      this.logger.verbose('found auth');
    } else {
      this.logger.verbose('not_found auth');
    }

    return returnSucceed(auth.trustedDevices);
  }

  async deleteOrg(id: OrgID) {
    // const { account } = this._requireAuth();

    const org = await this.storage.get(Org, id);

    // if (!org.isOwner(account)) {
    //   this._requireAuth(true);
    // }

    // Delete all associated vaults
    await Promise.all(
      org.vaults.map((v) => this.storage.delete(Object.assign(new Vault(), v))),
    );

    // Remove org from all member accounts
    await Promise.all(
      org.members
        .filter((m) => !!m.accountId)
        .map(async (member) => {
          const acc = await this.storage.get(Account, member.accountId!);
          acc.orgs = acc.orgs.filter(({ id }) => id !== org.id);
          await this.storage.save(acc);
        }),
    );

    await this.storage.delete(org);

    await this.provisioner.orgDeleted(org);

    console.log('org.delete', {
      org: { name: org.name, id: org.id, owner: org.owner },
    });
  }

  @Post('/verify/:name')
  @HttpCode(200)
  async verifyJWS(
    @Req() request: Request,
    @Body() { jws }: { jws: string },
    @Param('name') name: string,
  ): Prom
```

### Core Architecture Module: `apps/packages/admin/webpack.config.js`
```
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const AddAssetPlugin = require('add-asset-webpack-plugin');
const package = require('./package.json');

const isProduction = process.env.NODE_ENV == 'production';

const config = {
  entry: './src/main',
  target: 'node',

  externals: {
    level: 'commonjs2 level',
    bcrypt: 'commonjs2 bcrypt',
  },
  // resolve: {
  //   extensions: ['.js', '.ts', '.json'],
  // },
  resolve: {
    extensions: ['.js', '.ts', '.json'],
  },

  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true },
        },
        exclude: /node_modules/,
      },
    ],
  },

  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },

  plugins: [
    new webpack.IgnorePlugin({
      checkResource(resource) {
        const lazyImports = [
          '@nestjs/microservices',
          '@nestjs/microservices/microservices-module',
          '@nestjs/websockets/socket-module',
          'cache-manager',
          'class-validator',
          'class-transformer',
          'pg-native',
        ];
        if (!lazyImports.includes(resource)) {
          return false;
        }
        try {
          require.resolve(resource, {
            paths: [process.cwd()],
          });
        } catch (err) {
          return true;
        }
        return false;
      },
    }),
    new ForkTsCheckerWebpackPlugin(),
    new AddAssetPlugin('./package.json', createPackage),
    //  new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$/ }),
  ],
};

function createPackage() {
  const externals = config.externals;
  const externalsKeys = Object.keys(externals);
  const dependencies = package.dependencies;
  const externals_dependencies = {};

  for (const key in dependencies) {
    if (externalsKeys.includes(key)) {
      externals_dependencies[key] = dependencies[key];
    }
  }

  const packages = {
    dependencies: externals_dependencies,
    scripts: {
      server: 'node main.js',
    },
  };
  return JSON.stringify(packages);
}

module.exports = () => {
  if (isProduction) {
    config.mode = 'production';
  } else {
    config.mode = 'development';
  }
  return config;
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2446** (2026-04-02): **[Bug] Files: Sorting order gets lost**
  *Symptoms*: ## Please Provide the basic information of the app Files  ## Describe the bug Sorting order in Files app can be modified. But if you change the directory and go back, the sorting order is lost. The system seem to believe it's still there, because if you hut the arrow to change the order nothing happens at first. Only if you click twice the desired order is back.  **To Reproduce**  - OS Version: 1.12.2 and 1.12.4  - Browser Safari  - Steps to reproduce the behavior: please see this clip  <!-- Uploading "Sorting in Files.mov"... —>  **Expected behavior** I expect that the order of the folder and files stay the same.  **Screenshots** video attached.  **Additional context** Tried a restart of the server, didn't help. This is a minor issue, not critical. 
  **Post-Mortem & Fix Analysis**:
  > @bayerhazard Thank you. Since Files is a built‑in system application, it is located in this repository.  We’ll follow up on this.

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

### Incident Patch 1: `9983298f` (2026-09-30)
**Commit Message**: docs: add Wukong frame generation workaround (#4170)

* docs: add Wukong frame generation workaround

* docs: refine Wukong frame generation steps

**File**: `docs/use-cases/steam-common-issues.md` (modified, +48/-6)
```diff
@@ -1,20 +1,20 @@
 ---
 outline: [2, 3]
-description: Troubleshoot common Steam Headless issues on Olares, including package persistence after app restarts and upgrades.
+description: "Troubleshoot common Steam Headless issues on Olares, including package persistence and Black Myth: Wukong Frame Generation."
 head:
   - - meta
     - name: keywords
-      content: Olares, Steam Headless, common issues, Flatpak, apt, app persistence, troubleshooting
-app_version: "1.0.43"
-doc_version: "1.0"
-doc_updated: "2026-09-03"
+      content: Olares, Steam Headless, common issues, Flatpak, apt, Black Myth Wukong, DLSS Frame Generation, troubleshooting
+app_version: "1.0.49"
+doc_version: "1.1"
+doc_updated: "2026-09-20"
 ---
 
 # Steam Headless common issues
 
 Find solutions to common Steam Headless problems on Olares.
 
-## Why do packages installed with `apt` disappear after Steam Headless restarts?
+## Packages installed with `apt` disappear after Steam Headless restarts
 
 Packages installed with `apt` are written to the container's root filesystem. Steam Headless recreates this filesystem when the app restarts, is redeployed, or is upgraded. As a result, packages installed manually with `apt` are not retained.
 
@@ -28,3 +28,45 @@ To install a package with Flatpak:
 4. Run the Flatpak installation command in the container shell.
 
 For more information about Pods and containers, see [Manage containers](../manual/olares/controlhub/manage-container.md).
+
+## Frame Generation is unavailable in Black Myth: Wukong
+
+When you run Black Myth: Wukong through Proton, **Frame Generation** might be unavailable in the graphics settings. The latest Steam Headless release includes a script that configures DirectX 12, DLSS, and hardware-accelerated GPU scheduling for the game's Proton environment.
+
+1. Open Market and update Steam Headless to the latest available version.
+2. In the Steam Library, select Black Myth: Wukong. Wait for any download or file validation to finish, and make sure **Play** is available.
+3. Click **Play** and wait until the game reaches the main menu. Then quit the game completely.
+4. Open Control Hub and go to **Browse** > **steamheadless**.
+5. Expand **Deployments** > **steamheadless**, then open the running Pod.
+6. Under **Containers**, click the Terminal icon next to **steam-headless**.
+7. Confirm that the fix script is available:
+
+   ```bash
+   command -v fix-wukong-frame-gen.sh
+   ```
+
+   The command should return:
+
+   ```plain
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+   If the command returns no output, return to Market and confirm that Steam Headless is up to date before continuing.
+
+8. Run the fix script:
+
+   ```bash
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+9. Check that the output includes the following messages:
+
+   ```plain
+   [OK] GameUserSettings.ini: Dx12=1, Dlss=1
+   [OK] Wrote registry HwSchMode=2 into system.reg
+   [OK] Done. Launch Black Myth: Wukong and enable Frame Generation in the graphics menu.
+   ```
+
+10. Launch the game, open its graphics settings, and enable **Frame Generation**.
+
+Run the script again after reinstalling or updating the game. If the script reports that the game is running, quit the game completely before retrying. Do not rely on the `-dx12` Steam launch option because the Steam client might remove it.
```

**File**: `docs/zh/use-cases/steam-common-issues.md` (modified, +48/-6)
```diff
@@ -1,13 +1,13 @@
 ---
 outline: [2, 3]
-description: 排查 Olares 上 Steam Headless 的常见问题，包括应用重启和升级后的软件包持久化问题。
+description: 排查 Olares 上 Steam Headless 的常见问题，包括软件包持久化和《黑神话：悟空》帧生成问题。
 head:
   - - meta
     - name: keywords
-      content: Olares, Steam Headless, 常见问题, Flatpak, apt, 应用持久化, 故障排查
-app_version: "1.0.43"
-doc_version: "1.0"
-doc_updated: "2026-09-03"
+      content: Olares, Steam Headless, 常见问题, Flatpak, apt, 黑神话悟空, DLSS 帧生成, 故障排查
+app_version: "1.0.49"
+doc_version: "1.1"
+doc_updated: "2026-09-20"
 ---
 
 :::warning
@@ -18,7 +18,7 @@ doc_updated: "2026-09-03"
 
 查找 Olares 上 Steam Headless 常见问题的解决方法。
 
-## 为什么通过 `apt` 安装的软件包会在 Steam Headless 重启后消失？
+## 通过 `apt` 安装的软件包在 Steam Headless 重启后消失
 
 通过 `apt` 安装的软件包会写入容器的根文件系统。当 Steam Headless 重启、重新部署或升级时，这个文件系统会重新创建。因此，通过 `apt` 手动安装的软件包不会保留。
 
@@ -32,3 +32,45 @@ doc_updated: "2026-09-03"
 4. 在容器 Shell 中执行 Flatpak 安装命令。
 
 有关 Pod 和容器的更多信息，请参阅[管理容器](../manual/olares/controlhub/manage-container.md)。
+
+## 《黑神话：悟空》无法开启帧生成
+
+通过 Proton 运行《黑神话：悟空》时，游戏的图形设置中可能无法开启**帧生成**。最新版 Steam Headless 内置了修复脚本，用于在游戏的 Proton 环境中配置 DirectX 12、DLSS 和硬件加速 GPU 调度。
+
+1. 打开应用市场，将 Steam Headless 更新到商店提供的最新版本。
+2. 在 Steam 游戏库中选择《黑神话：悟空》。等待下载和文件验证完成，确认页面显示 **Play**。
+3. 点击 **Play**，等待游戏进入主菜单，然后完全退出游戏。
+4. 打开 Control Hub，前往 **Browse** > **steamheadless**。
+5. 展开 **Deployments** > **steamheadless**，然后打开正在运行的 Pod。
+6. 在 **Containers** 下，点击 **steam-headless** 旁边的 Terminal 图标。
+7. 确认修复脚本已安装：
+
+   ```bash
+   command -v fix-wukong-frame-gen.sh
+   ```
+
+   命令应返回：
+
+   ```plain
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+   如果命令没有返回任何内容，请返回应用市场，确认 Steam Headless 已更新到最新版本，再继续操作。
+
+8. 执行修复脚本：
+
+   ```bash
+   /usr/bin/fix-wukong-frame-gen.sh
+   ```
+
+9. 确认输出包含以下信息：
+
+   ```plain
+   [OK] GameUserSettings.ini: Dx12=1, Dlss=1
+   [OK] Wrote registry HwSchMode=2 into system.reg
+   [OK] Done. Launch Black Myth: Wukong and enable Frame Generation in the graphics menu.
+   ```
+
+10. 启动游戏，在图形设置中开启**帧生成**。
+
+重新安装或更新游戏后，需要再次执行该脚本。如果脚本提示游戏正在运行，请完全退出游戏后重试。不要依赖 Steam 启动参数 `-dx12`，Steam 客户端可能会将其清除。
```

---

### Incident Patch 2: `a112d280` (2026-09-28)
**Commit Message**: docs: fix prose and hide blurry Router screenshots (#4193)

docs: clean up prose and hide blurry Router screenshots

**File**: `docs/reusables/README.md` (modified, +1/-1)
```diff
@@ -17,4 +17,4 @@ Use stable, descriptive region names so source line changes do not break referen
 - **sync-files.md**: Sync files to local (intro, Create a library, Enable synchronization, Manage synchronization). Used by `manual/larepass/manage-files.md` and `manual/olares/files/sync-files.md`.
 - **export-system-logs.md**: Steps to export system logs via Settings > Advanced > Logs. Used by `manual/help/request-technical-support.md`.
 - **custom-domain.md**: Custom domain setup procedures (Create DID, Add domain with TXT/NS verification, Create organization, Add user, Join organization). Used by `manual/best-practices/set-custom-domain.md`, `manual/larepass/create-org-account.md`, `manual/space/host-domain.md`, and `manual/space/manage-domain.md`.
-- **ai-service-connections.md**: Reusable explanations and steps for connecting AI clients to models or apps. Use `model-connection-overview` and `get-model-connection-details` when connecting a standalone model on Olares; use `app-endpoint-overview` when connecting another Olares app through its endpoint.
+- **ai-service-connections.md**: Reusable explanations and steps for connecting AI clients to models or apps. Use `model-connection-overview` and `get-model-connection-details` when connecting a standalone model on Olares. Use `app-endpoint-overview` when connecting another Olares app through its endpoint.
```

**File**: `docs/reusables/ai-service-connections.md` (modified, +10/-10)
```diff
@@ -17,13 +17,13 @@ This guide uses Qwen3.8-27B (llama.cpp) as the default chat model. For connectio
 1. Open Router from Launchpad. On **Default models**, set Qwen3.8-27B (llama.cpp) as the default chat model.
 2. Go to **LLM**, find Qwen3.8-27B (llama.cpp), and click **View connection example** on its row.
 
-   ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered)
+   <!-- ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered) -->
 
 3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, including `/v1`.
 
-   ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered)
+   <!-- ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered) -->
 
-4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key; leave the key empty where possible, or use `olares` if the client requires a value.
+4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key. Leave the key empty where possible, or use `olares` if the client requires a value.
 
    `default-chat` is a routing name and is not returned by the model-list API. Add it manually if the client fetches a model list. If the client only supports selecting a listed model, use the full model name from Router instead.
 <!-- #endregion get-model-connection-details -->
@@ -46,13 +46,13 @@ When a client connects to another Olares app, it uses that app's endpoint as the
 1. Open Router from Launchpad. On **Default models**, set Qwen3.8-27B (llama.cpp) as the default chat model.
 2. Go to **LLM**, find Qwen3.8-27B (llama.cpp), and click **View connection example** on its row.
 
-   ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered)
+   <!-- ![View the Qwen3.8-27B connection example in Router](/images/manual/use-cases/router-view-connection-examp.png#bordered) -->
 
-3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, then remove the trailing `/v1` for the Anthropic-compatible client. For example, use `https://router.<your-olares-domain>`; the client appends `/v1/messages`.
+3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, then remove the trailing `/v1` for the Anthropic-compatible client. For example, use `https://router.<your-olares-domain>`. The client appends `/v1/messages`.
 
-   ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered)
+   <!-- ![Copy the Router Base URL for apps in Olares](/images/manual/use-cases/router-how-to-call-model.png#bordered) -->
 
-4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key; leave the key empty where possible, or use `olares` if the client requires a value.
+4. Use `default-chat` as the model name in the client. Apps in Olares do not need a Router API key. Leave the key empty where possible, or use `olares` if the client requires a value.
 
    `default-chat` is a routing name and is not returned by the model-list API. Add it manually if the client fetches a model list. If the client only supports selecting a listed model, use the full model name from Router instead.
 <!-- #endregion get-model-connection-details-anthropic -->
@@ -61,9 +61,9 @@ When a client connects to another Olares app, it uses that app's endpoint as the
 1. Open Router from Launchpad and go to **Tools**. Find the installed embedding model and wait until it shows **Callable**.
 2. On its model row, click **View connection example**.
 3. In **How to call this model**, select **Apps in Olares** and copy the **Base URL**, including `/v1`.
-4. Copy the full **Model name** from this window, including the `O
```

**File**: `docs/reusables/local-domain.md` (modified, +3/-3)
```diff
@@ -36,7 +36,7 @@ On Windows and macOS, LarePass Desktop can configure direct LAN access for the c
 3. Start the update from either location:
    - Click **Map hosts** in the lower-left corner.
    - Click your avatar, go to **Settings** > **Host mappings**, and click **Enable**.
-4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`; LarePass uses these markers to manage the entries. When you finish, click **Update**.
+4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`. LarePass uses these markers to manage the entries. When you finish, click **Update**.
 5. Enter the administrator password for your computer and confirm the change.
 6. Wait for the **Success** message.
 
@@ -60,7 +60,7 @@ On Windows, use LarePass Desktop to add the required entries to the hosts file s
 3. Start the update from either location:
    - Click **Map hosts** in the lower-left corner.
    - Click your avatar, go to **Settings** > **Host mappings**, and click **Enable**.
-4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`; LarePass uses these markers to manage the entries. When you finish, click **Update**.
+4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`. LarePass uses these markers to manage the entries. When you finish, click **Update**.
 5. Enter the administrator password for your computer and confirm the change.
 <!-- #endregion windows-local-domain -->
 
@@ -78,7 +78,7 @@ LarePass VPN and host mappings are mutually exclusive. Turn off **VPN connection
 3. Start the update from either location:
    - Click **Map hosts** in the lower-left corner.
    - Click your avatar, go to **Settings** > **Host mappings**, and click **Enable**.
-4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`; LarePass uses these markers to manage the entries. When you finish, click **Update**.
+4. In **Update host mappings**, review and edit the entries as needed. Do not edit lines beginning with `#`. LarePass uses these markers to manage the entries. When you finish, click **Update**.
 5. When the password prompt appears, enter the administrator password for your computer and confirm the change.
 6. Wait for the **Success** message.
 
```

**File**: `docs/use-cases/claude-code.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ Use this method to run Claude Code locally. This example uses the model app **Qw
 5. Open Olares Settings, and then go to **Applications** > **Claude Code** > **Manage environment variables**.
 6. Specify the following environment variables:
 
-   - **ANTHROPIC_AUTH_TOKEN**: Enter any text, such as `local`. Router identifies this Olares app through the platform; Claude Code still requires a non-empty token field.
+   - **ANTHROPIC_AUTH_TOKEN**: Enter any text, such as `local`. Router identifies this Olares app through the platform. Claude Code still requires a non-empty token field.
    - **ANTHROPIC_BASE_URL**: Enter the **Base URL** you copied from Router. For example, `https://router.<your-olares-domain>`.
    - **ANTHROPIC_MODEL**: Enter `default-chat`.
 
```

**File**: `docs/use-cases/hermes.md` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ Run a quick setup to connect Hermes Agent to your local model.
     | Use this model? [Y/n] — only when one model is detected | Enter `n`. At the following **Model name** prompt, enter `default-chat`. This confirmation accepts yes/no, not a model name. |
     | Select model [1-N] or type name — only when multiple models are detected | Type `default-chat` instead of selecting a numbered model. |
     | Model name — when no model is detected | Enter `default-chat`. |
-    | Context length in tokens | Enter the exact context size from Router's **Model card > Engine args**, such as `104448` for `-c 104448`. Hermes requires at least `65536` tokens; the value must not exceed the engine configuration. |
+    | Context length in tokens | Enter the exact context size from Router's **Model card > Engine args**, such as `104448` for `-c 104448`. Hermes requires at least `65536` tokens. The value must not exceed the engine configuration. |
     | Display name |  Enter a name to identify this model, such as `router-chat`.|
     | Select terminal backend | Select **Local - run directly on this machine**. |
     | Select platforms to configure | Press **ESC** to skip for now. |
```

---

### Incident Patch 3: `e4a353df` (2026-09-22)
**Commit Message**: market(fix): preinstall replay skipped catalog updates (#4182)

**File**: `framework/market/.olares/config/cluster/deploy/market_deploy.yaml` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ spec:
           name: check-appservice
       containers:
       - name: appstore-backend
-        image: beclab/market-backend:v0.6.123
+        image: beclab/market-backend:v0.6.125
         imagePullPolicy: IfNotPresent
         ports:
           - containerPort: 81
```

---

### Incident Patch 4: `2f7c50c5` (2026-09-21)
**Commit Message**: fix(cli): make etcd backup script fail fast (#4176)

**File**: `cli/pkg/etcd/templates/backup_script.go` (modified, +3/-1)
```diff
@@ -26,6 +26,8 @@ import (
 var EtcdBackupScript = template.Must(template.New("etcd-backup.sh").Parse(
 	dedent.Dedent(`#!/bin/bash
 
+set -euo pipefail
+
 ETCDCTL_PATH='/usr/local/bin/etcdctl'
 ENDPOINTS='{{ .Etcdendpoint }}'
 ETCD_DATA_DIR="/var/lib/etcd"
@@ -52,6 +54,6 @@ export ETCDCTL_API=3;$ETCDCTL_PATH --endpoints="$ENDPOINTS" snapshot save $BACKU
 
 sleep 3
 
-cd $BACKUP_DIR/../;ls -lt |awk '{if(NR > '$KEEPBACKUPNUMBER'){print "rm -rf "$9}}'|sh
+cd "$BACKUP_DIR/.." && ls -lt |awk '{if(NR > '$KEEPBACKUPNUMBER'){print "rm -rf "$9}}'|sh
 
 `)))
```

**File**: `cli/pkg/upgrade/1_12_7.go` (modified, +12/-1)
```diff
@@ -5,6 +5,7 @@ import (
 	"github.com/beclab/Olares/cli/pkg/certs"
 	"github.com/beclab/Olares/cli/pkg/common"
 	"github.com/beclab/Olares/cli/pkg/core/task"
+	"github.com/beclab/Olares/cli/pkg/etcd"
 	"github.com/beclab/Olares/cli/pkg/kubesphere/plugins"
 	"github.com/beclab/Olares/cli/version"
 )
@@ -34,7 +35,8 @@ func (u upgrader_1_12_7) AddedBreakingChange() bool {
 }
 
 func (u upgrader_1_12_7) PrepareForUpgrade() []task.Interface {
-	tasks := migrateContainerdConfigV3()
+	tasks := refreshBackupETCDScript()
+	tasks = append(tasks, migrateContainerdConfigV3()...)
 	tasks = append(tasks, &task.LocalTask{
 		Name:   "RestartNvidiaApplicationPods",
 		Action: new(restartNvidiaApplicationPods),
@@ -59,6 +61,15 @@ func (u upgrader_1_12_7) PrepareForUpgrade() []task.Interface {
 	return tasks
 }
 
+func refreshBackupETCDScript() []task.Interface {
+	return []task.Interface{
+		&task.LocalTask{
+			Name:   "RefreshBackupETCDScript",
+			Action: new(etcd.BackupETCD),
+		},
+	}
+}
+
 func (u upgrader_1_12_7) PostUpgrade() []task.Interface {
 	return append(regenerateKubeFiles(), u.upgraderBase.PostUpgrade()...)
 }
```

**File**: `cli/pkg/upgrade/1_12_7_20260921.go` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+package upgrade
+
+import (
+	"github.com/Masterminds/semver/v3"
+	"github.com/beclab/Olares/cli/pkg/core/task"
+)
+
+type upgrader_1_12_7_20260921 struct {
+	breakingUpgraderBase
+}
+
+func (u upgrader_1_12_7_20260921) Version() *semver.Version {
+	return semver.MustParse("1.12.7-20260921")
+}
+
+func (u upgrader_1_12_7_20260921) PrepareForUpgrade() []task.Interface {
+	tasks := refreshBackupETCDScript()
+	return append(tasks, u.upgraderBase.PrepareForUpgrade()...)
+}
+
+func init() {
+	registerDailyUpgrader(upgrader_1_12_7_20260921{})
+}
```

---

### Incident Patch 5: `a85a55e8` (2026-09-20)
**Commit Message**: fix(cli): run the platform-credential import whatever hook cobra picks (#4175)

**File**: `cli/cmd/ctl/chart/root.go` (modified, +0/-4)
```diff
@@ -20,10 +20,6 @@ and do not require a profile login.`,
 	// full help block on every validation failure.
 	cmd.SilenceErrors = true
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceErrors = true
-		c.SilenceUsage = true
-	}
 	cmd.AddCommand(NewCmdChartLint())
 	cmd.AddCommand(NewCmdChartFromCompose())
 	cmd.AddCommand(NewCmdChartPackage())
```

**File**: `cli/cmd/ctl/cluster/application/root.go` (modified, +0/-3)
```diff
@@ -47,9 +47,6 @@ resulting K8s namespaces.
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/container/root.go` (modified, +0/-3)
```diff
@@ -44,9 +44,6 @@ endpoint (/api/v1/namespaces/<ns>/pods/<name>).
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewEnvCommand(f))
```

**File**: `cli/cmd/ctl/cluster/cronjob/root.go` (modified, +0/-3)
```diff
@@ -58,9 +58,6 @@ For one-shot Jobs see "cluster job".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/job/root.go` (modified, +0/-3)
```diff
@@ -61,9 +61,6 @@ For scheduled jobs see "cluster cronjob".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

---

### Incident Patch 6: `0a754c82` (2026-09-20)
**Commit Message**: fix(cli): run the platform-credential import whatever hook cobra picks

The import hung on the root's PersistentPreRun, and cobra runs only the
nearest one: any subtree declaring a hook of its own removed the identity
from every verb beneath it. Eighteen subtrees had one that did nothing but
set SilenceUsage, so in a fresh container `market list`, `settings`,
`router`, `knowledge` and all of `cluster` reported that no profile was
configured while the credential sat unread on its mount. `profile list`,
one of the few trees without a hook, repaired the container for whatever
ran after it.

Wrap the import around every declared hook instead of placing it in one,
and set SilenceUsage on the root, which covers the whole tree and replaces
the eighteen hooks that caused this. The nfs backend-version gate keeps its
hook and now runs with an identity available.

The existing importer tests all call the importer directly, so none of them
could see this. The new end-to-end cases drive the real tree the way a
container does and assert on config.json.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `cli/cmd/ctl/chart/root.go` (modified, +0/-4)
```diff
@@ -20,10 +20,6 @@ and do not require a profile login.`,
 	// full help block on every validation failure.
 	cmd.SilenceErrors = true
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceErrors = true
-		c.SilenceUsage = true
-	}
 	cmd.AddCommand(NewCmdChartLint())
 	cmd.AddCommand(NewCmdChartFromCompose())
 	cmd.AddCommand(NewCmdChartPackage())
```

**File**: `cli/cmd/ctl/cluster/application/root.go` (modified, +0/-3)
```diff
@@ -47,9 +47,6 @@ resulting K8s namespaces.
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/container/root.go` (modified, +0/-3)
```diff
@@ -44,9 +44,6 @@ endpoint (/api/v1/namespaces/<ns>/pods/<name>).
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewEnvCommand(f))
```

**File**: `cli/cmd/ctl/cluster/cronjob/root.go` (modified, +0/-3)
```diff
@@ -58,9 +58,6 @@ For one-shot Jobs see "cluster job".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

**File**: `cli/cmd/ctl/cluster/job/root.go` (modified, +0/-3)
```diff
@@ -61,9 +61,6 @@ For scheduled jobs see "cluster cronjob".
 `,
 	}
 	cmd.SilenceUsage = true
-	cmd.PersistentPreRun = func(c *cobra.Command, args []string) {
-		c.SilenceUsage = true
-	}
 
 	cmd.AddCommand(NewListCommand(f))
 	cmd.AddCommand(NewGetCommand(f))
```

---

### Incident Patch 7: `cf1f2a5c` (2026-09-20)
**Commit Message**: fix(cli): keep a platform-issued profile usable when the cache directory is not writable (#4174)

**File**: `cli/internal/cachedir/cachedir.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+// Package cachedir resolves the base directory olares-cli keeps its derived
+// state under — the profile index, the encrypted keychain, and the locks that
+// serialize both — inside a container the platform injected a credential into.
+//
+// app-service mounts an emptyDir and exports $OLARES_CLI_CACHE_DIR at it, and
+// both cliconfig.Home and keychain.StorageDir used to take that variable at
+// its word. An agent sandbox breaks the promise: dsh confines the shell to the
+// session workspace, so the mount is present, world-writable by its mode bits,
+// and still refuses every write. What the platform issued then reaches the
+// process and evaporates with it, and the next command reports that no profile
+// is configured — the one diagnosis that sends a user to `profile login`, which
+// is exactly what a platform-issued identity refuses.
+//
+// So the rung is verified rather than trusted, and a rung that cannot be
+// written to is skipped instead of failed on.
+package cachedir
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"sync"
+)
+
+// EnvCacheDir is app-service's contract with the container. The literal is
+// duplicated from credential.EnvCacheDir because that package imports
+// cliconfig, which imports this one.
+const EnvCacheDir = "OLARES_CLI_CACHE_DIR"
+
+// Resolution is memoized per distinct input rather than once per process:
+// probing costs a create and an unlink, Home() is called several times per
+// command, and keying on the inputs keeps a test that changes them honest
+// without a reset hook in the production API.
+var (
+	mu       sync.Mutex
+	cacheKey string
+	cached   string
+)
+
+// Base returns the writable base directory for platform-injected state, and
+// whether there is one at all.
+//
+// A false second return means this is not a managed container: $OLARES_CLI_CACHE_DIR
+// is unset, or nothing derived from it could be written to. Callers keep their
+// own lookup chain for that case, so a host install resolves exactly as it did
+// before this package existed — including creating no directories, since the
+// only way to tell a writable directory from an unwritable one is to write.
+//
+// When true, the layout under the returned base is the same whether it is the
+// platform's directory or the fallback, so a caller joins its own subdirectory
+// without asking which one it got.
+func Base() (string, bool) {
+	configured := os.Getenv(EnvCacheDir)
+	key := configured + "\x00" + os.TempDir()
+
+	mu.Lock()
+	defer mu.Unlock()
+	if key != cacheKey {
+		cached = resolve(configured)
+		cacheKey = key
+	}
+	return cached, cached != ""
+}
+
+func resolve(configured string) string {
+	if configured == "" {
+		return ""
+	}
+	cleaned := filepath.Clean(configured)
+	if !filepath.IsAbs(cleaned) {
+		// Matches keychain's narrow reading of its own directory variables:
+		// a relative path floats with cwd, which is nobody's intent.
+		debugf("ignoring relative %s=%q", EnvCacheDir, configured)
+		return ""
+	}
+	if usable(cleaned) {
+		return cleaned
+	}
+	fallback := tempBase()
+	if usable(fallback) {
+		debugf("%s=%q is not writable; using %q instead", EnvCacheDir, cleaned, fallback)
+		return fallback
+	}
+	debugf("neither %q nor %q is writable", cleaned, fallback)
+	return ""
+}
+
+// tempBase is stable across invocations on purpose: a random directory would
+// make every command re-import the mounted credential and exchange the refresh
+// token again. The uid is in the name because /tmp is shared, and a directory
+// left by another account would be one this process cannot use.
+func tempBase() string {
+	name := "olares-cli"
+	if uid := os.Getuid(); uid >= 0 {
+		name = fmt.Sprintf("olares-cli-%d", uid)
+	}
+	return filepath.Join(os.TempDir(), name)
+}
+
+// usable answers the only question that matters by performing the operation in
+// question. A permission probe would not do: Landlock and seccomp-style
+// confinement deny the syscall while leaving the mode bits th
```

**File**: `cli/internal/cachedir/cachedir_test.go` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+package cachedir
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+// A host install sets nothing, so every caller keeps its own lookup chain and
+// no directory is created behind its back.
+func TestBase_UnsetIsNotAManagedContainer(t *testing.T) {
+	t.Setenv(EnvCacheDir, "")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want no base", got)
+	}
+}
+
+// The ordinary managed container: the platform's directory is writable and is
+// used as it is.
+func TestBase_UsesWritableCacheDir(t *testing.T) {
+	dir := writableDir(t)
+	t.Setenv(EnvCacheDir, dir)
+
+	got, ok := Base()
+	if !ok || got != dir {
+		t.Fatalf("Base() = %q, %v; want %q, true", got, ok, dir)
+	}
+}
+
+// The agent-sandbox case this package exists for: the mount is there, its mode
+// bits say world-writable, and the write is refused anyway.
+func TestBase_UnwritableCacheDirFallsBackToTemp(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	tmp := writableDir(t)
+	t.Setenv("TMPDIR", tmp)
+	t.Setenv(EnvCacheDir, denied)
+
+	got, ok := Base()
+	if !ok {
+		t.Fatal("Base() found nowhere to write, want the temp fallback")
+	}
+	if !strings.HasPrefix(got, tmp) {
+		t.Fatalf("Base() = %q, want a directory under %q", got, tmp)
+	}
+	if fi, err := os.Stat(got); err != nil || !fi.IsDir() {
+		t.Fatalf("fallback %q is not a usable directory: %v", got, err)
+	}
+}
+
+// The fallback has to be the same directory next time, or every command would
+// re-import the mounted credential and exchange the refresh token again.
+func TestBase_FallbackIsStableAcrossResolutions(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	t.Setenv("TMPDIR", writableDir(t))
+	t.Setenv(EnvCacheDir, denied)
+
+	first, _ := Base()
+	if second := resolve(denied); second != first {
+		t.Fatalf("re-resolved to %q, want the same %q", second, first)
+	}
+}
+
+// A relative path floats with cwd, which is nobody's intent; it is declined
+// rather than joined onto wherever the command happened to run.
+func TestBase_RelativeCacheDirIsDeclined(t *testing.T) {
+	t.Setenv(EnvCacheDir, "relative-cache")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want the relative path declined", got)
+	}
+}
+
+// writableDir returns a real directory, resolved through symlinks so a
+// comparison against what Base() returns is not defeated by /var -> /private/var.
+func writableDir(t *testing.T) string {
+	t.Helper()
+	dir, err := filepath.EvalSymlinks(t.TempDir())
+	if err != nil {
+		t.Fatalf("resolve temp dir: %v", err)
+	}
+	return dir
+}
```

**File**: `cli/internal/keychain/keychain_other.go` (modified, +8/-14)
```diff
@@ -10,6 +10,8 @@ import (
 	"path/filepath"
 
 	"github.com/google/uuid"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // AES constants and crypto helpers (encryptData / decryptData) plus
@@ -21,20 +23,14 @@ import (
 // avoids accidental clashes with lark-cli on machines that have both.
 const dataDirEnv = "OLARES_CLI_DATA_DIR"
 
-// cacheDirEnv is set by app-service's cli-credential webhook and points at a
-// writable emptyDir. An application container's HOME is frequently read-only
-// or belongs to a different uid than the process, so without this the very
-// first Set would fail to create the master key. The literal is duplicated
-// from credential.EnvCacheDir rather than imported, matching how this package
-// already keeps dataDirEnv to itself.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
-
 // StorageDir returns the absolute directory for service-scoped encrypted
 // blobs on Linux. The lookup chain is:
 //
 //  1. $OLARES_CLI_DATA_DIR if it's an absolute, cleanly-resolved path,
-//  2. $OLARES_CLI_CACHE_DIR/keychain, same absolute-path rule, which only
-//     exists inside a container the platform injected a credential into,
+//  2. `keychain/<service>` under the platform cache base, which only exists
+//     inside a container the platform injected a credential into. cachedir
+//     owns that rung, including the substitution it makes when the exported
+//     directory turns out not to be writable.
 //  3. XDG-style ~/.local/share/<service>,
 //  4. an absolute fallback under os.TempDir() when HOME is unresolvable.
 //     Earlier versions returned ".local/share/<service>" relative to CWD,
@@ -47,10 +43,8 @@ func StorageDir(service string) string {
 			return filepath.Join(safeDir, service)
 		}
 	}
-	if dir := os.Getenv(cacheDirEnv); dir != "" {
-		if safeDir, ok := safeAbsoluteDir(dir); ok {
-			return filepath.Join(safeDir, "keychain", service)
-		}
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "keychain", service)
 	}
 	home, err := os.UserHomeDir()
 	if err != nil || home == "" {
```

**File**: `cli/internal/keychain/keychain_other_test.go` (modified, +44/-0)
```diff
@@ -5,6 +5,7 @@ package keychain
 import (
 	"os"
 	"path/filepath"
+	"strings"
 	"testing"
 )
 
@@ -82,6 +83,49 @@ func TestStorageDir_NoCacheDirKeepsXDGDefault(t *testing.T) {
 	}
 }
 
+// An agent sandbox leaves the platform's cache directory mounted and refuses
+// every write to it. The keychain is the rung that fails first and loudest:
+// the master key has to be created before anything can be stored at all, so a
+// store that cannot move off that directory cannot hold the access token the
+// mounted grant was just exchanged for.
+func TestPlatformRoundTrip_UnwritableCacheDir(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := t.TempDir()
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	tmp := t.TempDir()
+	tmp, _ = filepath.EvalSymlinks(tmp)
+	t.Setenv("OLARES_CLI_DATA_DIR", "")
+	t.Setenv("TMPDIR", tmp)
+	t.Setenv("OLARES_CLI_CACHE_DIR", denied)
+
+	const (
+		service = "olares-cli-test"
+		account = "alice@olares.com"
+		secret  = `{"olaresId":"alice@olares.com","accessToken":"abc"}`
+	)
+
+	dir := StorageDir(service)
+	if !strings.HasPrefix(dir, tmp) {
+		t.Fatalf("StorageDir() = %q, want it moved under %q", dir, tmp)
+	}
+
+	if err := platformSet(service, account, secret); err != nil {
+		t.Fatalf("platformSet() error = %v", err)
+	}
+	got, err := platformGet(service, account)
+	if err != nil || got != secret {
+		t.Fatalf("platformGet() = (%q, %v), want the secret back", got, err)
+	}
+	if _, err := os.Stat(filepath.Join(dir, "master.key")); err != nil {
+		t.Fatalf("master key was not created in the fallback: %v", err)
+	}
+}
+
 // TestPlatformRoundTrip exercises the full Get/Set/Remove cycle on the file
 // backend (which is what's actually shipped on Linux). This is the closest
 // we can get to a smoke test without mocking keychain bits.
```

**File**: `cli/pkg/cliconfig/paths.go` (modified, +15/-7)
```diff
@@ -11,6 +11,8 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // homeEnv is the environment variable used to override the config dir, mirroring
@@ -21,8 +23,9 @@ const homeEnv = "OLARES_CLI_HOME"
 // writable emptyDir mounted into an application container. It sits between
 // the explicit override and $HOME so a managed container gets a config dir it
 // can actually write to, without changing anything on a host install where
-// the variable is unset.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
+// the variable is unset. Whether it is writable is cachedir's question to
+// answer, not ours; the name is kept here for the tests that set it.
+const cacheDirEnv = cachedir.EnvCacheDir
 
 // defaultDir is the directory name used under $HOME when $OLARES_CLI_HOME is
 // unset.
@@ -52,15 +55,20 @@ const (
 )
 
 // Home returns the resolved olares-cli config directory: $OLARES_CLI_HOME,
-// then $OLARES_CLI_CACHE_DIR/config, then $HOME/.olares-cli. The directory is
-// NOT created here — callers that intend to write should call EnsureHome
-// instead.
+// then the platform cache base's `config`, then $HOME/.olares-cli. The
+// directory is NOT created here — callers that intend to write should call
+// EnsureHome instead.
+//
+// The middle rung goes through cachedir, which substitutes a writable
+// directory when the one the platform exported cannot be written to. Reads
+// resolve through the same call, so config.json is looked for where the last
+// write actually landed.
 func Home() (string, error) {
 	if v := os.Getenv(homeEnv); v != "" {
 		return v, nil
 	}
-	if v := os.Getenv(cacheDirEnv); v != "" {
-		return filepath.Join(v, "config"), nil
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "config"), nil
 	}
 	home, err := os.UserHomeDir()
 	if err != nil {
```

---

### Incident Patch 8: `e151877a` (2026-09-20)
**Commit Message**: fix(cli): stop sending a managed container to profile login

ErrNoProfile named the one recovery a platform-issued identity refuses.
Inside a container whose credential app-service mounted, nothing local can
mint that grant and RequireNotManaged rejects the attempt, so the message
and the envelope's action now point at repairing the application instead.

The singleton stays an empty struct and reads the machine when it renders:
what is missing is the same either way, and which recovery applies is a
property of where the command ran.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `cli/pkg/credential/envelope_test.go` (modified, +30/-0)
```diff
@@ -5,6 +5,9 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
 	"testing"
 	"time"
 
@@ -87,6 +90,33 @@ func TestAManagedCredentialIsNotSentToProfileLogin(t *testing.T) {
 	}
 }
 
+// "Nothing is configured" inside a container the platform issued a credential
+// to means the mount failed to become a profile, not that the user forgot to
+// log in. Sending them to `profile login` there costs them a round of trying
+// a command that is refused.
+func TestNoProfileInAManagedContainerDoesNotSayLogin(t *testing.T) {
+	dir := t.TempDir()
+	if err := os.WriteFile(filepath.Join(dir, credentialFilename), []byte("{}"), 0o600); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Setenv(EnvCredentialsDir, dir)
+
+	body := envelopeFor(t, ErrNoProfile)
+	action, _ := body["action"].(string)
+	message, _ := body["message"].(string)
+	for field, text := range map[string]string{"action": action, "message": message} {
+		if text == "" {
+			t.Fatalf("%s is empty", field)
+		}
+		if strings.Contains(text, "profile login") || strings.Contains(text, "profile import") {
+			t.Errorf("%s points at a command that is refused for managed credentials: %q", field, text)
+		}
+	}
+	if body["code"] != clierr.CodeAuthNoProfile {
+		t.Errorf("code = %v, want it unchanged at %q", body["code"], clierr.CodeAuthNoProfile)
+	}
+}
+
 // ErrNoProfile stopped being errors.New so it could carry a code. Both
 // comparisons callers already use have to survive that.
 func TestErrNoProfileStillCompares(t *testing.T) {
```

**File**: `cli/pkg/credential/managed_credential.go` (modified, +16/-0)
```diff
@@ -59,6 +59,22 @@ func LoadManagedCredential() (*ManagedCredential, bool) {
 	return cred, true
 }
 
+// managedCredentialMounted reports whether this process is running inside a
+// container the platform issued a credential to.
+//
+// It asks a weaker question than LoadManagedCredential on purpose: a mount
+// that is present but malformed is still a mount, and what to do about it is
+// still "repair the application" rather than "log in". Only the presence of
+// the file is read, never its contents.
+func managedCredentialMounted() bool {
+	dir := strings.TrimSpace(os.Getenv(EnvCredentialsDir))
+	if dir == "" {
+		return false
+	}
+	_, err := os.Stat(filepath.Join(dir, credentialFilename))
+	return err == nil
+}
+
 // loadManagedCredentialFrom is the testable core: it reports why a directory
 // yielded no credential instead of collapsing everything into a bool.
 func loadManagedCredentialFrom(dir string) (*ManagedCredential, error) {
```

**File**: `cli/pkg/credential/managed_import.go` (modified, +11/-5)
```diff
@@ -180,12 +180,18 @@ func (m *managedImporter) adoptTokenEntry(olaresID string, deadAt time.Time) {
 	}
 }
 
-// save degrades a write failure to a warning. config.json lands under a
-// directory the container may not be able to create — HOME is sometimes / and
-// sometimes read-only — and refusing to run every other verb over that would
-// be a far bigger failure than the managed profile being absent.
+// save degrades a write failure to a warning, because refusing to run every
+// other verb over it would be a far bigger failure than the managed profile
+// being absent.
+//
+// Reaching this now takes an explicit $OLARES_CLI_HOME pointing somewhere
+// unwritable: cachedir already moves off a platform cache directory it cannot
+// write to, so the container case that used to land here no longer does. The
+// warning names the consequence rather than just the errno, since what the
+// reader is about to see is a command claiming no profile is configured.
 func (m *managedImporter) save(cfg *cliconfig.MultiProfileConfig) {
 	if err := cliconfig.SaveMultiProfileConfig(cfg); err != nil {
-		fmt.Fprintf(m.stderr, "warning: cannot persist the platform-issued profile: %v\n", err)
+		fmt.Fprintf(m.stderr,
+			"warning: cannot persist the platform-issued profile, so later commands will not see it: %v\n", err)
 	}
 }
```

**File**: `cli/pkg/credential/provider.go` (modified, +12/-0)
```diff
@@ -46,15 +46,27 @@ func NewCredentialProvider(managed, local Provider) *CredentialProvider {
 // different things done.
 var ErrNoProfile error = noProfileError{}
 
+// noProfileError stays an empty struct so the singleton keeps comparing equal
+// (TestErrNoProfileStillCompares), and reads the machine when it is rendered
+// rather than when it is built. What is missing is the same either way; which
+// recovery applies is a property of where the command ran, and inside a
+// container the platform issued a credential to, `profile login` is not it —
+// RequireNotManaged refuses it, and nothing local could mint that grant.
 type noProfileError struct{}
 
 func (noProfileError) Error() string {
+	if managedCredentialMounted() {
+		return "no Olares profile is configured: the platform-issued credential for this application is mounted but could not be loaded; reinstall or repair the application that requested it"
+	}
 	return "no Olares profile is configured: run `olares-cli profile login --olares-id <id>` or `olares-cli profile import --olares-id <id> --refresh-token <tok>`"
 }
 
 func (noProfileError) ErrorCode() string { return clierr.CodeAuthNoProfile }
 func (noProfileError) Retryable() *bool  { return &no }
 func (noProfileError) RecoveryAction() string {
+	if managedCredentialMounted() {
+		return managedRecovery("")
+	}
 	return "olares-cli profile login --olares-id <id>"
 }
 
```

---

### Incident Patch 9: `c85617c2` (2026-09-20)
**Commit Message**: fix(cli): skip a cache directory the process cannot write to

app-service exports $OLARES_CLI_CACHE_DIR at an emptyDir it mounts for
permission.loginOlaresCLI, and cliconfig.Home and keychain.StorageDir both
took that variable at its word. An agent sandbox breaks the promise: the
mount is present and world-writable by its mode bits, and every write is
refused anyway, so the platform-issued profile reached the process and
evaporated with it. The next command reported that no profile was
configured, which sends a user to `profile login` — the one recovery a
platform-issued identity refuses.

Resolve the rung through internal/cachedir instead, which verifies it by
writing and substitutes a stable per-uid directory under TempDir when it
cannot. Config, keychain and the refresh locks all hang off that one base,
so they move together. A host install sets no cache directory, resolves
exactly as before, and has no directory created behind its back.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `cli/internal/cachedir/cachedir.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+// Package cachedir resolves the base directory olares-cli keeps its derived
+// state under — the profile index, the encrypted keychain, and the locks that
+// serialize both — inside a container the platform injected a credential into.
+//
+// app-service mounts an emptyDir and exports $OLARES_CLI_CACHE_DIR at it, and
+// both cliconfig.Home and keychain.StorageDir used to take that variable at
+// its word. An agent sandbox breaks the promise: dsh confines the shell to the
+// session workspace, so the mount is present, world-writable by its mode bits,
+// and still refuses every write. What the platform issued then reaches the
+// process and evaporates with it, and the next command reports that no profile
+// is configured — the one diagnosis that sends a user to `profile login`, which
+// is exactly what a platform-issued identity refuses.
+//
+// So the rung is verified rather than trusted, and a rung that cannot be
+// written to is skipped instead of failed on.
+package cachedir
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"sync"
+)
+
+// EnvCacheDir is app-service's contract with the container. The literal is
+// duplicated from credential.EnvCacheDir because that package imports
+// cliconfig, which imports this one.
+const EnvCacheDir = "OLARES_CLI_CACHE_DIR"
+
+// Resolution is memoized per distinct input rather than once per process:
+// probing costs a create and an unlink, Home() is called several times per
+// command, and keying on the inputs keeps a test that changes them honest
+// without a reset hook in the production API.
+var (
+	mu       sync.Mutex
+	cacheKey string
+	cached   string
+)
+
+// Base returns the writable base directory for platform-injected state, and
+// whether there is one at all.
+//
+// A false second return means this is not a managed container: $OLARES_CLI_CACHE_DIR
+// is unset, or nothing derived from it could be written to. Callers keep their
+// own lookup chain for that case, so a host install resolves exactly as it did
+// before this package existed — including creating no directories, since the
+// only way to tell a writable directory from an unwritable one is to write.
+//
+// When true, the layout under the returned base is the same whether it is the
+// platform's directory or the fallback, so a caller joins its own subdirectory
+// without asking which one it got.
+func Base() (string, bool) {
+	configured := os.Getenv(EnvCacheDir)
+	key := configured + "\x00" + os.TempDir()
+
+	mu.Lock()
+	defer mu.Unlock()
+	if key != cacheKey {
+		cached = resolve(configured)
+		cacheKey = key
+	}
+	return cached, cached != ""
+}
+
+func resolve(configured string) string {
+	if configured == "" {
+		return ""
+	}
+	cleaned := filepath.Clean(configured)
+	if !filepath.IsAbs(cleaned) {
+		// Matches keychain's narrow reading of its own directory variables:
+		// a relative path floats with cwd, which is nobody's intent.
+		debugf("ignoring relative %s=%q", EnvCacheDir, configured)
+		return ""
+	}
+	if usable(cleaned) {
+		return cleaned
+	}
+	fallback := tempBase()
+	if usable(fallback) {
+		debugf("%s=%q is not writable; using %q instead", EnvCacheDir, cleaned, fallback)
+		return fallback
+	}
+	debugf("neither %q nor %q is writable", cleaned, fallback)
+	return ""
+}
+
+// tempBase is stable across invocations on purpose: a random directory would
+// make every command re-import the mounted credential and exchange the refresh
+// token again. The uid is in the name because /tmp is shared, and a directory
+// left by another account would be one this process cannot use.
+func tempBase() string {
+	name := "olares-cli"
+	if uid := os.Getuid(); uid >= 0 {
+		name = fmt.Sprintf("olares-cli-%d", uid)
+	}
+	return filepath.Join(os.TempDir(), name)
+}
+
+// usable answers the only question that matters by performing the operation in
+// question. A permission probe would not do: Landlock and seccomp-style
+// confinement deny the syscall while leaving the mode bits th
```

**File**: `cli/internal/cachedir/cachedir_test.go` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+package cachedir
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+// A host install sets nothing, so every caller keeps its own lookup chain and
+// no directory is created behind its back.
+func TestBase_UnsetIsNotAManagedContainer(t *testing.T) {
+	t.Setenv(EnvCacheDir, "")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want no base", got)
+	}
+}
+
+// The ordinary managed container: the platform's directory is writable and is
+// used as it is.
+func TestBase_UsesWritableCacheDir(t *testing.T) {
+	dir := writableDir(t)
+	t.Setenv(EnvCacheDir, dir)
+
+	got, ok := Base()
+	if !ok || got != dir {
+		t.Fatalf("Base() = %q, %v; want %q, true", got, ok, dir)
+	}
+}
+
+// The agent-sandbox case this package exists for: the mount is there, its mode
+// bits say world-writable, and the write is refused anyway.
+func TestBase_UnwritableCacheDirFallsBackToTemp(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	tmp := writableDir(t)
+	t.Setenv("TMPDIR", tmp)
+	t.Setenv(EnvCacheDir, denied)
+
+	got, ok := Base()
+	if !ok {
+		t.Fatal("Base() found nowhere to write, want the temp fallback")
+	}
+	if !strings.HasPrefix(got, tmp) {
+		t.Fatalf("Base() = %q, want a directory under %q", got, tmp)
+	}
+	if fi, err := os.Stat(got); err != nil || !fi.IsDir() {
+		t.Fatalf("fallback %q is not a usable directory: %v", got, err)
+	}
+}
+
+// The fallback has to be the same directory next time, or every command would
+// re-import the mounted credential and exchange the refresh token again.
+func TestBase_FallbackIsStableAcrossResolutions(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	denied := writableDir(t)
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	t.Setenv("TMPDIR", writableDir(t))
+	t.Setenv(EnvCacheDir, denied)
+
+	first, _ := Base()
+	if second := resolve(denied); second != first {
+		t.Fatalf("re-resolved to %q, want the same %q", second, first)
+	}
+}
+
+// A relative path floats with cwd, which is nobody's intent; it is declined
+// rather than joined onto wherever the command happened to run.
+func TestBase_RelativeCacheDirIsDeclined(t *testing.T) {
+	t.Setenv(EnvCacheDir, "relative-cache")
+
+	if got, ok := Base(); ok {
+		t.Fatalf("Base() = %q, true; want the relative path declined", got)
+	}
+}
+
+// writableDir returns a real directory, resolved through symlinks so a
+// comparison against what Base() returns is not defeated by /var -> /private/var.
+func writableDir(t *testing.T) string {
+	t.Helper()
+	dir, err := filepath.EvalSymlinks(t.TempDir())
+	if err != nil {
+		t.Fatalf("resolve temp dir: %v", err)
+	}
+	return dir
+}
```

**File**: `cli/internal/keychain/keychain_other.go` (modified, +8/-14)
```diff
@@ -10,6 +10,8 @@ import (
 	"path/filepath"
 
 	"github.com/google/uuid"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // AES constants and crypto helpers (encryptData / decryptData) plus
@@ -21,20 +23,14 @@ import (
 // avoids accidental clashes with lark-cli on machines that have both.
 const dataDirEnv = "OLARES_CLI_DATA_DIR"
 
-// cacheDirEnv is set by app-service's cli-credential webhook and points at a
-// writable emptyDir. An application container's HOME is frequently read-only
-// or belongs to a different uid than the process, so without this the very
-// first Set would fail to create the master key. The literal is duplicated
-// from credential.EnvCacheDir rather than imported, matching how this package
-// already keeps dataDirEnv to itself.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
-
 // StorageDir returns the absolute directory for service-scoped encrypted
 // blobs on Linux. The lookup chain is:
 //
 //  1. $OLARES_CLI_DATA_DIR if it's an absolute, cleanly-resolved path,
-//  2. $OLARES_CLI_CACHE_DIR/keychain, same absolute-path rule, which only
-//     exists inside a container the platform injected a credential into,
+//  2. `keychain/<service>` under the platform cache base, which only exists
+//     inside a container the platform injected a credential into. cachedir
+//     owns that rung, including the substitution it makes when the exported
+//     directory turns out not to be writable.
 //  3. XDG-style ~/.local/share/<service>,
 //  4. an absolute fallback under os.TempDir() when HOME is unresolvable.
 //     Earlier versions returned ".local/share/<service>" relative to CWD,
@@ -47,10 +43,8 @@ func StorageDir(service string) string {
 			return filepath.Join(safeDir, service)
 		}
 	}
-	if dir := os.Getenv(cacheDirEnv); dir != "" {
-		if safeDir, ok := safeAbsoluteDir(dir); ok {
-			return filepath.Join(safeDir, "keychain", service)
-		}
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "keychain", service)
 	}
 	home, err := os.UserHomeDir()
 	if err != nil || home == "" {
```

**File**: `cli/pkg/cliconfig/paths.go` (modified, +15/-7)
```diff
@@ -11,6 +11,8 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+
+	"github.com/beclab/Olares/cli/internal/cachedir"
 )
 
 // homeEnv is the environment variable used to override the config dir, mirroring
@@ -21,8 +23,9 @@ const homeEnv = "OLARES_CLI_HOME"
 // writable emptyDir mounted into an application container. It sits between
 // the explicit override and $HOME so a managed container gets a config dir it
 // can actually write to, without changing anything on a host install where
-// the variable is unset.
-const cacheDirEnv = "OLARES_CLI_CACHE_DIR"
+// the variable is unset. Whether it is writable is cachedir's question to
+// answer, not ours; the name is kept here for the tests that set it.
+const cacheDirEnv = cachedir.EnvCacheDir
 
 // defaultDir is the directory name used under $HOME when $OLARES_CLI_HOME is
 // unset.
@@ -52,15 +55,20 @@ const (
 )
 
 // Home returns the resolved olares-cli config directory: $OLARES_CLI_HOME,
-// then $OLARES_CLI_CACHE_DIR/config, then $HOME/.olares-cli. The directory is
-// NOT created here — callers that intend to write should call EnsureHome
-// instead.
+// then the platform cache base's `config`, then $HOME/.olares-cli. The
+// directory is NOT created here — callers that intend to write should call
+// EnsureHome instead.
+//
+// The middle rung goes through cachedir, which substitutes a writable
+// directory when the one the platform exported cannot be written to. Reads
+// resolve through the same call, so config.json is looked for where the last
+// write actually landed.
 func Home() (string, error) {
 	if v := os.Getenv(homeEnv); v != "" {
 		return v, nil
 	}
-	if v := os.Getenv(cacheDirEnv); v != "" {
-		return filepath.Join(v, "config"), nil
+	if base, ok := cachedir.Base(); ok {
+		return filepath.Join(base, "config"), nil
 	}
 	home, err := os.UserHomeDir()
 	if err != nil {
```

**File**: `cli/pkg/credential/managed_import_test.go` (modified, +29/-0)
```diff
@@ -343,6 +343,35 @@ func TestImport_UnwritableConfigWarnsAndContinues(t *testing.T) {
 	}
 }
 
+// An agent sandbox refuses writes to the directory the platform exported,
+// which used to mean the mounted identity lived only as long as the process
+// and every later command reported that no profile was configured. The entry
+// has to survive to disk somewhere the process can actually write.
+func TestImport_UnwritableCacheDirStillLandsTheProfile(t *testing.T) {
+	if os.Geteuid() == 0 {
+		t.Skip("root ignores directory permissions")
+	}
+	h := newImportHarness(t, testCredential())
+	denied := t.TempDir()
+	if err := os.Chmod(denied, 0o555); err != nil {
+		t.Fatalf("prepare: %v", err)
+	}
+	t.Cleanup(func() { _ = os.Chmod(denied, 0o700) })
+	t.Setenv("OLARES_CLI_HOME", "")
+	t.Setenv("TMPDIR", t.TempDir())
+	t.Setenv("OLARES_CLI_CACHE_DIR", denied)
+
+	h.run(context.Background())
+
+	p := loadProfile(t, managedID)
+	if p == nil || !p.Managed {
+		t.Fatalf("profile = %+v, want a managed entry readable by the next command", p)
+	}
+	if h.stderr.Len() != 0 {
+		t.Errorf("stderr = %q, want silence once the write found a home", h.stderr.String())
+	}
+}
+
 // A mount naming something that is not a parseable Olares ID is skipped
 // rather than turned into a profile no URL can be derived from.
 func TestImport_UnparseableOlaresIDIsSkipped(t *testing.T) {
```

---

### Incident Patch 10: `adae46db` (2026-09-20)
**Commit Message**: fix(cli): improve log upload recovery and ticket creation reliability (#4169)

* fix(cli): stop log uploads failing with unexpected EOF right after the archive lands

The presign, S3 PUT and ticket POST all shared one http.Client, so the
ticket POST reused a Cloudflare connection that had sat idle for the
whole upload and came back as "unexpected EOF"; a slow TLS handshake on
the storage host also blew the 10s default. Give the JSON calls their own
keep-alive-free client, raise the handshake timeout, retry transient
network errors, and send an Idempotency-Key so a retried ticket create
cannot duplicate. On failure the collected archive is kept so the user
can retry with --file instead of gathering logs again.

Co-authored-by: Cursor <cursoragent@cursor.com>

* fix(cli): handle truncated ticket responses and uncertain creation

* fix(cli): preserve storage upload errors for retries

---------

Co-authored-by: zdf-org <zhang_df@sohu.com>
Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `cli/cmd/ctl/os/logs_upload.go` (modified, +184/-29)
```diff
@@ -2,10 +2,14 @@ package os
 
 import (
 	"bytes"
+	"crypto/rand"
+	"encoding/hex"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"io"
 	"log"
+	"net"
 	"net/http"
 	"os"
 	"path/filepath"
@@ -34,8 +38,18 @@ const (
 	ticketEndpointEnv     = "OLARES_TICKET_API"
 	defaultTicketEndpoint = "https://ticket.olares.com"
 	gzipMimeType          = "application/gzip"
-	presignPath       = "/v1/olares-cli/attachments/presigned-upload"
-	ticketPath        = "/v1/olares-cli/tickets"
+	presignPath           = "/v1/olares-cli/attachments/presigned-upload"
+	ticketPath            = "/v1/olares-cli/tickets"
+	headerIdempotencyKey  = "Idempotency-Key"
+
+	// JSON calls (presign / create ticket) are tiny; a long shared timeout
+	// is only for the S3 PUT. Mixing them on one Client also reuses the
+	// Cloudflare connection after a minutes-long upload, which surfaces as
+	// "unexpected EOF" on the follow-up POST.
+	jsonRequestTimeout   = 30 * time.Second
+	tlsHandshakeTimeout  = 45 * time.Second
+	maxTransientAttempts = 3
+	defaultUploadTimeout = 30 * time.Minute
 )
 
 type presignRequest struct {
@@ -73,7 +87,7 @@ type ticketResponse struct {
 }
 
 func newCmdLogsUpload() *cobra.Command {
-	options := &logUploadOptions{Timeout: 30 * time.Minute}
+	options := &logUploadOptions{Timeout: defaultUploadTimeout}
 
 	cmd := &cobra.Command{
 		Use:   "upload",
@@ -85,7 +99,10 @@ only credential required: together with your Olares ID it authorizes this
 upload, no login token is needed.
 
 If --file is omitted, logs are collected first (requires root) and the
-resulting archive is uploaded.`,
+resulting archive is uploaded. If upload or ticket creation fails after
+collection, the archive is kept. Upload failures can be retried with --file
+to skip collecting again. After a ticket creation failure, check AssistHub
+before retrying: the ticket may already exist.`,
 		Run: func(cmd *cobra.Command, args []string) {
 			options.Endpoint = resolveTicketEndpoint(options.Endpoint)
 			if err := runLogsUpload(options); err != nil {
@@ -100,7 +117,7 @@ resulting archive is uploaded.`,
 	cmd.Flags().StringVar(&options.File, "file", "", "Path to an existing log archive to upload; if empty, logs are collected first")
 	cmd.Flags().StringVar(&options.Description, "description", "", "Optional ticket description")
 	cmd.Flags().StringVar(&options.OlaresVersion, "olares-version", "", "Optional Olares version recorded on the ticket")
-	cmd.Flags().DurationVar(&options.Timeout, "timeout", options.Timeout, "HTTP timeout for each upload/API call, raise it for large archives on slow links")
+	cmd.Flags().DurationVar(&options.Timeout, "timeout", options.Timeout, "HTTP timeout for the archive upload to storage, raise it for large archives on slow links")
 
 	_ = cmd.MarkFlagRequired("olares-id")
 	_ = cmd.MarkFlagRequired("code")
@@ -121,53 +138,80 @@ func resolveTicketEndpoint(flagValue string) string {
 }
 
 func runLogsUpload(options *logUploadOptions) error {
+	collected := false
 	archivePath := options.File
+	var cleanup func()
 	if archivePath == "" {
-		collected, cleanup, err := collectForUpload()
-		if cleanup != nil {
-			defer cleanup()
-		}
+		collectedPath, collectedCleanup, err := collectForUpload()
+		cleanup = collectedCleanup
 		if err != nil {
+			if cleanup != nil {
+				cleanup()
+			}
 			return err
 		}
-		archivePath = collected
+		archivePath = collectedPath
+		collected = true
 	}
 
 	info, err := os.Stat(archivePath)
 	if err != nil {
-		return fmt.Errorf("failed to stat archive %s: %v", archivePath, err)
+		return keepArchiveHint(archivePath, collected, fmt.Errorf("failed to stat archive %s: %v", archivePath, err))
 	}
 	if info.IsDir() {
-		return fmt.Errorf("archive %s is a directory, expected a file", archivePath)
+		return keepArchiveHint(archivePath, collected, fmt.Errorf("archive %s is a directory, expected a file", archivePath))
 	}
 
 	endpoint := strings.TrimRight(options.Endpoint, "/")
 	timeout := options.Timeout
 	if timeout <= 0 {
-		timeout
```

**File**: `cli/cmd/ctl/os/logs_upload_test.go` (modified, +264/-0)
```diff
@@ -2,12 +2,69 @@ package os
 
 import (
 	"bytes"
+	"errors"
+	"fmt"
 	"io"
+	"net"
+	"net/http"
+	"net/http/httptest"
 	"os"
+	"path/filepath"
 	"strings"
 	"testing"
+	"time"
 )
 
+type uploadTestTransport func(*http.Request) (*http.Response, error)
+
+func (f uploadTestTransport) RoundTrip(req *http.Request) (*http.Response, error) {
+	return f(req)
+}
+
+func TestPutArchiveRetriesWrappedNetworkErrors(t *testing.T) {
+	orig := sleep
+	sleep = func(time.Duration) {}
+	defer func() { sleep = orig }()
+	archive := filepath.Join(t.TempDir(), "logs.tar.gz")
+	const payload = "complete archive contents"
+	if err := os.WriteFile(archive, []byte(payload), 0600); err != nil {
+		t.Fatal(err)
+	}
+	for _, tc := range []struct {
+		name string
+		err  error
+	}{
+		{"EOF", io.EOF},
+		{"timeout", &net.OpError{Op: "write", Net: "tcp", Err: os.ErrDeadlineExceeded}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			for _, succeedsOnRetry := range []bool{true, false} {
+				attempts := 0
+				client := &http.Client{Transport: uploadTestTransport(func(req *http.Request) (*http.Response, error) {
+					defer req.Body.Close()
+					body, err := io.ReadAll(req.Body)
+					if err != nil || string(body) != payload {
+						t.Errorf("attempt %d: body=%q err=%v", attempts+1, body, err)
+					}
+					attempts++
+					if !succeedsOnRetry || attempts == 1 {
+						return nil, tc.err
+					}
+					return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("")), Header: make(http.Header)}, nil
+				})}
+				err := putArchive(client, &presignResponse{UploadURL: "https://storage.example/logs"}, archive, int64(len(payload)))
+				if succeedsOnRetry {
+					if err != nil || attempts != 2 {
+						t.Fatalf("recovery: attempts=%d err=%v", attempts, err)
+					}
+				} else if !errors.Is(err, tc.err) || attempts != maxTransientAttempts {
+					t.Fatalf("exhaustion: attempts=%d err=%v", attempts, err)
+				}
+			}
+		})
+	}
+}
+
 // captureStderr swaps os.Stderr for a pipe (never a TTY) and returns whatever
 // fn wrote to it.
 func captureStderr(t *testing.T, fn func()) string {
@@ -84,3 +141,210 @@ func TestProgressReaderFinishNoOpWhenNothingDrawn(t *testing.T) {
 		t.Errorf("finish after a draw wrote %q, want a single newline", out)
 	}
 }
+
+func TestIsTransientNetErr(t *testing.T) {
+	cases := []struct {
+		err  error
+		want bool
+	}{
+		{nil, false},
+		{io.ErrUnexpectedEOF, true},
+		{io.EOF, true},
+		{fmt.Errorf("upload archive: Put \"https://s3\": net/http: TLS handshake timeout"), true},
+		{fmt.Errorf("create ticket: Post \"https://ticket.olares.com/v1/olares-cli/tickets\": unexpected EOF"), true},
+		{fmt.Errorf("read tcp 10.0.0.1:443: connection reset by peer"), true},
+		{apiError(400, []byte(`{"message":"bad"}`)), false},
+	}
+	for _, tc := range cases {
+		if got := isTransientNetErr(tc.err); got != tc.want {
+			t.Errorf("isTransientNetErr(%v) = %v, want %v", tc.err, got, tc.want)
+		}
+	}
+}
+
+func TestNewIdempotencyKeyFitsTicketAPI(t *testing.T) {
+	a := newIdempotencyKey()
+	b := newIdempotencyKey()
+	if a == b {
+		t.Fatal("expected distinct keys")
+	}
+	if len(a) < 8 || len(a) > 64 {
+		t.Fatalf("key length %d outside ticket API 8–64 bound", len(a))
+	}
+}
+
+func TestPostJSONRetriesTransientThenSucceeds(t *testing.T) {
+	orig := sleep
+	sleep = func(time.Duration) {}
+	defer func() { sleep = orig }()
+
+	attempts := 0
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		attempts++
+		if attempts == 1 {
+			conn, _, err := w.(http.Hijacker).Hijack()
+			if err != nil {
+				t.Errorf("hijack: %v", err)
+				return
+			}
+			conn.Close()
+			return
+		}
+		if got := r.Header.Get(headerIdempotencyKey); got != "retry-key-1" {
+			t.Errorf("Idempotency-Key = %q, want retry-key-1", got)
+		}
+		w.WriteHeader(http.StatusCreated)
+		_, _ = w.Write([]byte(`{"ticket_id":"id-1","ticket_number":"TKT-1"}`))
+	}))
+	defer srv.Close()
+
+	var out ticketResponse
+	err := postJSON(s
```

#### Recent Merged Pull Requests:
- **PR #4208** (2026-09-30): docs: generalize two-node cluster upgrade guide (@fnalways)
- **PR #4206** (2026-09-30): docs: add BIOS version 107 to changelog (@Power-One-2025)
- **PR #4205** (2026-09-30): docs: refresh multilingual READMEs for Olares 1.12.7 (@fnalways)
- **PR #4202** (2026-09-29): chore: bump version to 1.12.8 (@eball)
- **PR #4200** (2026-09-28): docs: clarify system error support and log collection options (@fnalways)
- **PR #4199** (2026-09-30): docs: add OpenClaw Android and iOS pairing guides (@TShentu)
- **PR #4198** (2026-09-29): docs: add Wake-on-LAN guide for Olares One (@fnalways)
- **PR #4197** (2026-09-27): cli/router: add canonical image edit calls (@pengpeng)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
