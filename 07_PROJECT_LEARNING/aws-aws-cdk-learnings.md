# Forensic Learning Record (Deep Inspection): aws/aws-cdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/aws-aws-cdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aws/aws-cdk](https://github.com/aws/aws-cdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:23:29.906Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws/aws-cdk`
- **Description**: The AWS Cloud Development Kit is a framework for defining cloud infrastructure in code
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12919 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/eslint.config.mjs`
```
import { makeConfig } from '@aws-cdk/eslint-config';

export default makeConfig('tsconfig.json');

```

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/jest.config.js`
```
const baseConfig = require('@aws-cdk/cdk-build-tools/config/jest.config');
module.exports = {
  ...baseConfig,
};

```

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/lib/app-staging-synthesizer.ts`
```
import type {
  DockerImageAssetLocation,
  DockerImageAssetSource,
  FileAssetLocation,
  FileAssetSource,
  IBoundStackSynthesizer as IBoundAppStagingSynthesizer,
  IReusableStackSynthesizer,
  ISynthesisSession,
  Stack,
} from 'aws-cdk-lib/core';
import {
  AssetManifestBuilder,
  BOOTSTRAP_QUALIFIER_CONTEXT,
  StackSynthesizer,
  Token,
} from 'aws-cdk-lib/core';
import { StringSpecializer, translateCfnTokenToAssetToken } from 'aws-cdk-lib/core/lib/helpers-internal';
import type { BootstrapRole, BootstrapRoles } from './bootstrap-roles';
import { DeploymentIdentities } from './bootstrap-roles';
import type { DefaultStagingStackOptions } from './default-staging-stack';
import { DefaultStagingStack } from './default-staging-stack';
import { PerEnvironmentStagingFactory as PerEnvironmentStagingFactory } from './per-env-staging-factory';
import { AppScopedGlobal } from './private/app-global';
import { validateNoTokens } from './private/no-tokens';
import type { IStagingResources, IStagingResourcesFactory, ObtainStagingResourcesContext } from './staging-stack';

const AGNOSTIC_STACKS = new AppScopedGlobal(() => new Set<Stack>());
const ENV_AWARE_STACKS = new AppScopedGlobal(() => new Set<Stack>());

/**
 * Options that apply to all AppStagingSynthesizer variants
 */
export interface AppStagingSynthesizerOptions {
  /**
   * What roles to use to deploy applications
   *
   * These are the roles that have permissions to interact with CloudFormation
   * on your behalf. By default these are the standard bootstrapped CDK roles,
   * but you can customize them or turn them off and use the CLI credentials
   * to deploy.
   *
   * @default - The standard bootstrapped CDK roles
   */
  readonly deploymentIdentities?: DeploymentIdentities;

  /**
   * Qualifier to disambiguate multiple bootstrapped environments in the same account
   *
   * This qualifier is only used to reference bootstrapped resources. It will not
   * be used in the creation of app-specific staging resources: `appId` is used for that
   * instead.
   *
   * @default - Value of context key '@aws-cdk/core:bootstrapQualifier' if set, otherwise `DEFAULT_QUALIFIER`
   */
  readonly bootstrapQualifier?: string;
}

/**
 * Properties for stackPerEnv static method
 */
export interface DefaultResourcesOptions extends AppStagingSynthesizerOptions, DefaultStagingStackOptions {}

/**
 * Properties for customFactory static method
 */
export interface CustomFactoryOptions extends AppStagingSynthesizerOptions {
  /**
   * The factory that will be used to return staging resources for each stack
   */
  readonly factory: IStagingResourcesFactory;

  /**
   * Reuse the answer from the factory for stacks in the same environment
   *
   * @default true
   */
  readonly oncePerEnv?: boolean;
}

/**
 * Properties for customResources static method
 */
export interface CustomResourcesOptions extends AppStagingSynthesizerOptions {
  /**
   * Use these exact staging resources for every stack that this synthesizer is used for
   */
  readonly resources: IStagingResources;
}

/**
 * Internal properties for AppStagingSynthesizer
 */
interface AppStagingSynthesizerProps extends AppStagingSynthesizerOptions {
  /**
   * A factory method that creates an IStagingStack when given the stack the
   * synthesizer is binding.
   */
  readonly factory: IStagingResourcesFactory;
}

/**
 * App Staging Synthesizer
 */
export class AppStagingSynthesizer extends StackSynthesizer implements IReusableStackSynthesizer {
  /**
   * Default ARN qualifier
   */
  public static readonly DEFAULT_QUALIFIER = 'hnb659fds';

  /**
   * Default CloudFormation role ARN.
   */
  public static readonly DEFAULT_CLOUDFORMATION_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-cfn-exec-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default deploy role ARN.
   */
  public static readonly DEFAULT_DEPLOY_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-deploy-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default lookup role ARN for missing values.
   */
  public static readonly DEFAULT_LOOKUP_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-lookup-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Use the Default Staging Resources, creating a single stack per environment this app is deployed in
   */
  public static defaultResources(options: DefaultResourcesOptions) {
    validateNoTokens(options, 'AppStagingSynthesizer');

    return AppStagingSynthesizer.customFactory({
      factory: DefaultStagingStack.factory(options),
      deploymentIdentities: options.deploymentIdentities,
      bootstrapQualifier: options.bootstrapQualifier,
      oncePerEnv: true,
    });
  }

  /**
   * Use these exact staging resources for every stack that this synthesizer is used for
   */
  public static customResources(options: CustomResourcesOptions) {
    return AppStagingSynthesizer.customFactory({
      deploymentIdentities: options.deploymentIdentities,
      bootstrapQualifier: options.bootstrapQualifier,
      oncePerEnv: false,
      factory: {
        obtainStagingResources() {
          return options.resources;
        },
      },
    });
  }

  /**
   * Supply your own stagingStackFactory method for creating an IStagingStack when
   * a stack is bound to the synthesizer.
   *
   * By default, `oncePerEnv = true`, which means that a new instance of the IStagingStack
   * will be created in new environments. Set `oncePerEnv = false` to turn off that behavior.
   */
  public static customFactory(options: CustomFactoryOptions) {
    const oncePerEnv = options.oncePerEnv ?? true;
    const factory = oncePerEnv ? new PerEnvironmentStagingFactory(options.factory) : options.factory;

    return new AppStagingSynthesizer({
      factory,
      bootstrapQualifier: options.bootstrapQualifier,
      deploymentIdentities: options.deploymentIdentities,
    });
  }

  private readonly roles: Required<BootstrapRoles>;

  private constructor(private readonly props: AppStagingSynthesizerProps) {
    super();

    const defaultIdentities = DeploymentIdentities.defaultBootstrapRoles();
    const identities = props.deploymentIdentities ?? DeploymentIdentities.defaultBootstrapRoles();

    this.roles = {
      deploymentRole: identities.deploymentRole ?? defaultIdentities.deploymentRole!,
      cloudFormationExecutionRole: identities.cloudFormationExecutionRole ?? defaultIdentities.cloudFormationExecutionRole!,
      lookupRole: identities.lookupRole ?? identities.lookupRole!,
    };
  }

  /**
   * Returns a version of the synthesizer bound to a stack.
   */
  public reusableBind(stack: Stack): IBoundAppStagingSynthesizer {
    this.checkEnvironmentGnosticism(stack);
    const qualifier = this.props.bootstrapQualifier ??
      stack.node.tryGetContext(BOOTSTRAP_QUALIFIER_CONTEXT) ??
      AppStagingSynthesizer.DEFAULT_QUALIFIER;
    const spec = new StringSpecializer(stack, qualifier);

    const deployRole = this.roles.deploymentRole._specialize(spec);

    const context: ObtainStagingResourcesContext = {
      environmentString: [
        Token.isUnresolved(stack.account) ? 'ACCOUNT' : stack.account,
        Token.isUnresolved(stack.region) ? 'REGION' : stack.region,
      ].join('-'),
      deployRoleArn: deployRole._arnForCloudFormation(),
      qualifier,
    };

    return new BoundAppStagingSynthesizer(stack, {
      stagingResources: this.props.factory.obtainStagingResources(stack, context),
      deployRole,
      cloudFormationExecutionRole: this.roles.cloudFormationExecutionRole._specialize(spec),
      lookupRole: this.roles.lookupRole._specialize(spec),
      qualifier,
    });
  }

  /**
   * Implemented for legacy purposes; this will never be called.
   */
  public bind(_stack: Stack) {
    throw new Error('This is a legacy API, call reusableBind instead');
  }

  /**
   * Implemented for legacy purposes; this will never be called.
   */
  public synthesize(_session
```

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/lib/bootstrap-roles.ts`
```
import { StringSpecializer, translateAssetTokenToCfnToken, translateCfnTokenToAssetToken } from 'aws-cdk-lib/core/lib/helpers-internal';
import { AppStagingSynthesizer } from './app-staging-synthesizer';

/**
 * Bootstrapped role specifier. These roles must exist already.
 * This class does not create new IAM Roles.
 */
export class BootstrapRole {
  /**
   * Use the currently assumed role/credentials
   */
  public static cliCredentials() {
    return new BootstrapRole(BootstrapRole.CLI_CREDS);
  }

  /**
   * Specify an existing IAM Role to assume
   */
  public static fromRoleArn(arn: string) {
    StringSpecializer.validateNoTokens(arn, 'BootstrapRole ARN');
    return new BootstrapRole(arn);
  }

  private static CLI_CREDS = 'cli-credentials';

  private constructor(private readonly roleArn: string) {}

  /**
   * Whether or not this is object was created using BootstrapRole.cliCredentials()
   */
  public isCliCredentials() {
    return this.roleArn === BootstrapRole.CLI_CREDS;
  }

  /**
   * @internal
   */
  public _arnForCloudFormation() {
    return this.isCliCredentials() ? undefined : translateAssetTokenToCfnToken(this.roleArn);
  }

  /**
   * @internal
   */
  public _arnForCloudAssembly() {
    return this.isCliCredentials() ? undefined : translateCfnTokenToAssetToken(this.roleArn);
  }

  /**
   * @internal
   */
  public _specialize(spec: StringSpecializer) {
    return new BootstrapRole(spec.specialize(this.roleArn));
  }
}

/**
 * Deployment identities are the class of roles to be assumed by the CDK
 * when deploying the App.
 */
export class DeploymentIdentities {
  /**
   * Use CLI credentials for all deployment identities.
   */
  public static cliCredentials(): DeploymentIdentities {
    return new DeploymentIdentities({
      cloudFormationExecutionRole: BootstrapRole.cliCredentials(),
      deploymentRole: BootstrapRole.cliCredentials(),
      lookupRole: BootstrapRole.cliCredentials(),
    });
  }

  /**
   * Specify your own roles for all deployment identities. These roles
   * must already exist.
   */
  public static specifyRoles(roles: BootstrapRoles): DeploymentIdentities {
    return new DeploymentIdentities(roles);
  }

  /**
   * Use the Roles that have been created by the default bootstrap stack
   */
  public static defaultBootstrapRoles(options: DefaultBootstrapRolesOptions = {}): DeploymentIdentities {
    function replacePlaceholders(x: string) {
      if (options.bootstrapRegion !== undefined) {
        x = x.replace(/\$\{AWS::Region\}/g, options.bootstrapRegion);
      }
      return x;
    }

    return new DeploymentIdentities({
      deploymentRole: BootstrapRole.fromRoleArn(replacePlaceholders(AppStagingSynthesizer.DEFAULT_DEPLOY_ROLE_ARN)),
      cloudFormationExecutionRole: BootstrapRole.fromRoleArn(replacePlaceholders(AppStagingSynthesizer.DEFAULT_CLOUDFORMATION_ROLE_ARN)),
      lookupRole: BootstrapRole.fromRoleArn(replacePlaceholders(AppStagingSynthesizer.DEFAULT_LOOKUP_ROLE_ARN)),
    });
  }

  /**
   * CloudFormation Execution Role
   */
  public readonly cloudFormationExecutionRole?: BootstrapRole;

  /**
   * Deployment Action Role
   */
  public readonly deploymentRole?: BootstrapRole;

  /**
   * Lookup Role
    @default - use bootstrapped role
   */
  public readonly lookupRole?: BootstrapRole;

  private constructor(
    /** roles that are bootstrapped to your account. */
    roles: BootstrapRoles,
  ) {
    this.cloudFormationExecutionRole = roles.cloudFormationExecutionRole;
    this.deploymentRole = roles.deploymentRole;
    this.lookupRole = roles.lookupRole;
  }
}

/**
 * Options for `DeploymentIdentities.defaultBootstrappedRoles`
 */
export interface DefaultBootstrapRolesOptions {
  /**
   * The region where the default bootstrap roles have been created
   *
   * By default, the region in which the stack is deployed is used.
   *
   * @default - the stack's current region
   */
  readonly bootstrapRegion?: string;
}

/**
 * Roles that are bootstrapped to your account.
 */
export interface BootstrapRoles {
  /**
   * CloudFormation Execution Role
   *
   * @default - use bootstrapped role
   */
  readonly cloudFormationExecutionRole?: BootstrapRole;

  /**
   * Deployment Action Role
   *
   * @default - use boostrapped role
   */
  readonly deploymentRole?: BootstrapRole;

  /**
   * Lookup Role
   *
   * @default - use bootstrapped role
   */
  readonly lookupRole?: BootstrapRole;
}

/**
 * Roles that are included in the Staging Stack
 * (for access to Staging Resources)
 */
export interface StagingRoles {
  /**
   * File Asset Publishing Role
   *
   * @default - staging stack creates a file asset publishing role
   */
  readonly fileAssetPublishingRole?: BootstrapRole;

  /**
   * Docker Asset Publishing Role
   *
   * @default - staging stack creates a docker asset publishing role
   */
  readonly dockerAssetPublishingRole?: BootstrapRole;
}

```

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/lib/default-staging-stack.ts`
```
import * as fs from 'fs';
import * as path from 'path';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type {
  DockerImageAssetSource,
  FileAssetSource,
  ISynthesisSession,
  StackProps,
} from 'aws-cdk-lib/core';
import {
  App,
  ArnFormat,
  BootstraplessSynthesizer,
  Duration,
  RemovalPolicy,
  Stack,
  INLINE_CUSTOM_RESOURCE_CONTEXT,
} from 'aws-cdk-lib/core';
import { StringSpecializer } from 'aws-cdk-lib/core/lib/helpers-internal';
import * as cxapi from 'aws-cdk-lib/cx-api';
import { Construct } from 'constructs';
import type { BootstrapRole } from './bootstrap-roles';
import type { FileStagingLocation, IStagingResources, IStagingResourcesFactory, ImageStagingLocation } from './staging-stack';

export const DEPLOY_TIME_PREFIX = 'deploy-time/';

/**
 * This is a dummy construct meant to signify that a stack is utilizing
 * the AppStagingSynthesizer. It does not do anything, and is not meant
 * to be created on its own. This construct will be a part of the
 * construct tree only and not the Cfn template. The construct tree is
 * then encoded in the AWS::CDK::Metadata resource of the stack and
 * injested in our metrics like every other construct.
 */
export class UsingAppStagingSynthesizer extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}

/**
 * User configurable options to the DefaultStagingStack.
 */
export interface DefaultStagingStackOptions {
  /**
   * A unique identifier for the application that the staging stack belongs to.
   *
   * This identifier will be used in the name of staging resources
   * created for this application, and should be unique across CDK apps.
   *
   * The identifier should include lowercase characters and dashes ('-') only
   * and have a maximum of 20 characters.
   */
  readonly appId: string;

  /**
   * Explicit name for the staging bucket
   *
   * @default - a well-known name unique to this app/env.
   */
  readonly stagingBucketName?: string;

  /**
   * Encryption type for staging bucket
   *
   * In future versions of this package, the default will be BucketEncryption.S3_MANAGED.
   *
   * In previous versions of this package, the default was to use KMS encryption for the staging bucket. KMS keys cost
   * $1/month, which could result in unexpected costs for users who are not aware of this. As we stabilize this module
   * we intend to make the default S3-managed encryption, which is free. However, the migration path from KMS to S3
   * managed encryption for existing buckets is not straightforward. Therefore, for now, this property is required.
   *
   * If you have an existing staging bucket encrypted with a KMS key, you will likely want to set this property to
   * BucketEncryption.KMS. If you are creating a new staging bucket, you can set this property to
   * BucketEncryption.S3_MANAGED to avoid the cost of a KMS key.
   */
  readonly stagingBucketEncryption: s3.BucketEncryption;

  /**
   * Pass in an existing role to be used as the file publishing role.
   *
   * @default - a new role will be created
   */
  readonly fileAssetPublishingRole?: BootstrapRole;

  /**
   * Pass in an existing role to be used as the image publishing role.
   *
   * @default - a new role will be created
   */
  readonly imageAssetPublishingRole?: BootstrapRole;

  /**
   * The lifetime for deploy time file assets.
   *
   * Assets that are only necessary at deployment time (for instance,
   * CloudFormation templates and Lambda source code bundles) will be
   * automatically deleted after this many days. Assets that may be
   * read from the staging bucket during your application's run time
   * will not be deleted.
   *
   * Set this to the length of time you wish to be able to roll back to
   * previous versions of your application without having to do a new
   * `cdk synth` and re-upload of assets.
   *
   * @default - Duration.days(30)
   */
  readonly deployTimeFileAssetLifetime?: Duration;

  /**
   * The maximum number of image versions to store in a repository.
   *
   * Previous versions of an image can be stored for rollback purposes.
   * Once a repository has more than 3 image versions stored, the oldest
   * version will be discarded. This allows for sensible garbage collection
   * while maintaining a few previous versions for rollback scenarios.
   *
   * @default - up to 3 versions stored
   */
  readonly imageAssetVersionCount?: number;

  /**
   * Auto deletes objects in the staging S3 bucket and images in the
   * staging ECR repositories.
   *
   * @default true
   */
  readonly autoDeleteStagingAssets?: boolean;

  /**
   * Specify a custom prefix to be used as the staging stack name and
   * construct ID. The prefix will be appended before the appId, which
   * is required to be part of the stack name and construct ID to
   * ensure uniqueness.
   *
   * @default 'StagingStack'
   */
  readonly stagingStackNamePrefix?: string;
}

/**
 * Default Staging Stack Properties
 */
export interface DefaultStagingStackProps extends DefaultStagingStackOptions, StackProps {
  /**
   * The ARN of the deploy action role, if given
   *
   * This role will need permissions to read from to the staging resources.
   *
   * @default - The CLI credentials are assumed, no additional permissions are granted.
   */
  readonly deployRoleArn?: string;

  /**
   * The qualifier used to specialize strings
   *
   * Can be used to specify custom bootstrapped role names
   */
  readonly qualifier: string;
}

/**
 * A default Staging Stack that implements IStagingResources.
 *
 * @example
 * import { BucketEncryption } from 'aws-cdk-lib/aws-s3';
 * const defaultStagingStack = DefaultStagingStack.factory({ appId: 'my-app-id', stagingBucketEncryption: BucketEncryption.S3_MANAGED });
 */
export class DefaultStagingStack extends Stack implements IStagingResources {
  /**
   * Return a factory that will create DefaultStagingStacks
   */
  public static factory(options: DefaultStagingStackOptions): IStagingResourcesFactory {
    const appId = options.appId.toLocaleLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
    return {
      obtainStagingResources(stack, context) {
        const app = App.of(stack);
        if (!App.isApp(app)) {
          throw new Error(`Stack ${stack.stackName} must be part of an App`);
        }

        // Because we do not keep metrics in the DefaultStagingStack, we will inject
        // a dummy construct into the stack using the DefaultStagingStack instead.
        if (cxapi.ANALYTICS_REPORTING_ENABLED_CONTEXT) {
          new UsingAppStagingSynthesizer(stack, `UsingAppStagingSynthesizer/${stack.stackName}`);
        }

        const stackPrefix = options.stagingStackNamePrefix ?? 'StagingStack';
        // Stack name does not need to contain environment because appId is unique inside an env
        const stackName = `${stackPrefix}-${appId}`;
        const stackId = `${stackName}-${context.environmentString}`;
        return new DefaultStagingStack(app, stackId, {
          ...options,
          stackName,
          env: {
            account: stack.account,
            region: stack.region,
          },
          appId,
          qualifier: context.qualifier,
          deployRoleArn: context.deployRoleArn,
        });
      },
    };
  }

  /**
   * Default asset publishing role name for file (S3) assets.
   */
  private get fileRoleName() {
    return `cdk-${this.appId}-file-role-${this.region}`;
  }

  /**
   * Default asset publishing role name for docker (ECR) assets.
   */
  private get imageRoleName() {
    return `cdk-${this.appId}-image-role-${this.region}`;
  }

  /**
   * The app-scoped, evironment-keyed staging bucket.
   */
  public readonly stagingBucket?: s3.Bucket;

  /**
   * The app-scoped, environment-keyed ecr repositories associated with this app.
   */
  public readonly stagingRepos: Record<s
```

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/lib/index.ts`
```
export * from './default-staging-stack';
export * from './app-staging-synthesizer';
export * from './bootstrap-roles';
export * from './staging-stack';

```

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/lib/per-env-staging-factory.ts`
```
import type { Stack } from 'aws-cdk-lib/core';
import { AppScopedGlobal } from './private/app-global';
import type { IStagingResources, IStagingResourcesFactory, ObtainStagingResourcesContext } from './staging-stack';

/**
 * Per-environment cache
 *
 * This is a global because we might have multiple instances of this class
 * in the app, but we want to cache across all of them.
 */
const ENVIRONMENT_CACHE = new AppScopedGlobal(() => new Map<string, IStagingResources>());

/**
 * Wraps another IStagingResources factory, and caches the result on a per-environment basis.
 */
export class PerEnvironmentStagingFactory implements IStagingResourcesFactory {
  constructor(private readonly wrapped: IStagingResourcesFactory) { }

  public obtainStagingResources(stack: Stack, context: ObtainStagingResourcesContext): IStagingResources {
    const cacheKey = context.environmentString;

    const cache = ENVIRONMENT_CACHE.for(stack);
    const existing = cache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const result = this.wrapped.obtainStagingResources(stack, context);
    cache.set(cacheKey, result);
    return result;
  }
}

```

### Core Architecture Module: `packages/@aws-cdk/app-staging-synthesizer-alpha/lib/private/app-global.ts`
```
import { App } from 'aws-cdk-lib/core';
import type { IConstruct } from 'constructs';

/**
 * Hold an App-wide global variable
 *
 * This is a replacement for a `static` variable, but does the right thing in case people
 * instantiate multiple Apps in the same process space (for example, in unit tests or
 * people using `cli-lib` in advanced configurations).
 *
 * This class assumes that the global you're going to be storing is a mutable object.
 */
export class AppScopedGlobal<A> {
  private readonly map = new WeakMap<App, A>();

  constructor(private readonly factory: () => A) {
  }

  public for(ctr: IConstruct): A {
    const app = App.of(ctr);
    if (!App.isApp(app)) {
      throw new Error(`Construct ${ctr.node.path} must be part of an App`);
    }

    const existing = this.map.get(app);
    if (existing) {
      return existing;
    }
    const instance = this.factory();
    this.map.set(app, instance);
    return instance;
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #38840** (2026-09-21): **fix(ec2): synth-time AMI lookup leads to W9010**
  *Symptoms*: This warning checks that users didn't hardcode AMI IDs into their template, which are region-sensitive and unlikely to be portable.  But synth-time lookups are safe, even though they also lead to a literal AMI ID in the template, so in those cases those warnings can be acknowledged.  Closes #38390.  ----  *By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license* 
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-issue-check-bot --> 👋 It looks like your PR description references an issue, but not in the expected location.  The issue number must appear in the first section of the description (the first two lines), following the template format: ``` ### Issue # (if applicable)  Closes #123. ``` Please move your issue reference to the top of the description.
  > **Automated review**  A maintainer will still review this — treat the notes below as a starting point.  This PR fixes a spurious CloudFormation-validate W9010 ("Hardcoded AMI ID") warning that fired when an EC2 machine image resolves its AMI ID via a synth-time context lookup and bakes the literal `ami-xxxx` value into the template. It adds an exported helper `acknowledgeAmiLookupWarning(scope)` that acknowledges W9010, wires it into `LookupMachineImage.getImage` and the `cachedInContext` branch of `lookupImage`, adds a test helper `disableTestSuppressions()`, and adds unit tests. The approach is sound and follows the established `Validations.of(x).acknowledge(...)` suppression pattern; the dynamic-reference branch is correctly left untouched, and the positive/boundary tests give meaningful coverage. Two lower-severity items remain: the acknowledgement's subtree-wide breadth is understated in the docstring and untested for the stack-scoped call path, and the new test discards the resto
  > Thank you for contributing! Your pull request will be updated from main and then merged automatically (do not update manually, and be sure to [allow changes to be pushed to your fork](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork)).

- **Issue #38834** (2026-09-18): **fix(cloudwatch): iqm alarms are not rendered correctly**
  *Symptoms*: IQM was rendered as a simple `Statistic`, while it's actually an `ExtendedStatistic`.  Taking the opportunity to clean up the metric parsing code and model the types a little better with the facilities that TypeScript offers, and removing features that are unused ("can be rendered as single param statistic" is not used).  Closes #28812  ----  *By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license* 
  **Post-Mortem & Fix Analysis**:
  > **Automated review**  A maintainer will still review this — treat the notes below as a starting point.  This PR fixes CloudWatch alarms built with `Stats.IQM` (issue #28812), which were rendered into the `Statistic` property instead of `ExtendedStatistic`, and refactors the private statistic parser (`private/statistic.ts`) into a discriminated union plus a shared `parseStatisticToFields` helper used by both `alarm.ts` and `metric.ts`. The core IQM fix is correct and well-covered by both a parser unit test and a synthesized-template regression test, and the rendering equivalence for existing percentile/TM-range statistics is guarded by the pre-existing template tests.  One blocking regression remains: consolidating the alarm-level statistic override onto the new helper dropped the previous behavior of clearing the complementary CFN field, so an override that switches statistic families now emits both `Statistic` and `ExtendedStatistic` and produces a template CloudWatch rejects. See the
  > <!-- pr-issue-check-bot --> 👋 It looks like your PR description references an issue, but not in the expected location.  The issue number must appear in the first section of the description (the first two lines), following the template format: ``` ### Issue # (if applicable)  Closes #123. ``` Please move your issue reference to the top of the description.
  > Thank you for contributing! Your pull request will be updated from main and then merged automatically (do not update manually, and be sure to [allow changes to be pushed to your fork](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork)).

- **Issue #38833** (2026-09-18): **fix: secret.fromSsmParameter introduces W2001 warning**
  *Symptoms*: Use of this code always adds a `CfnParameter`, even if it is never read.  This triggers the W2001 warning which warns you that your template has an unused parameter. Only create the parameter when the value is actually referenced.  Closes #38396.  ----  *By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license* 
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-issue-check-bot --> 👋 It looks like your PR description references an issue, but not in the expected location.  The issue number must appear in the first section of the description (the first two lines), following the template format: ``` ### Issue # (if applicable)  Closes #123. ``` Please move your issue reference to the top of the description.
  > **Automated review**  A maintainer will still review this — treat the notes below as a starting point.  This PR fixes a spurious CloudFormation W2001 warning (issue #38396) for imported SSM parameters: when a parameter is imported only for its name/ARN — for example as an ECS task secret — CDK previously emitted an unreferenced `Parameters` entry. The fix defers creation of the backing `CfnParameter` in the aws-ssm import factories (`fromStringParameterArn`, `fromStringParameterAttributes`, `fromListParameterAttributes`) by turning the eager `stringValue`/`stringListValue` assignments into memoized `get` accessors that build the parameter only on first read.  The approach is sound and the public interface contract is unchanged, since a `get` accessor legitimately satisfies the `readonly` attribute declarations. The main consideration is that reading these attributes now has a side effect on the construct tree, which is order-dependent once synthesis begins; the memoization that makes r
  > I'm not sure. You need to go out of your way to fuck that up. The natural way to write the broken version, the one it predicted (`??=` gets replaced with `=`) would lead to a "construct with that ID already exists" error.  So you really need to put in effort to get it to do that, at which point you probably have a good reason to do it.  I'll add it because you're asking me to, but in general I feel that the AI reviewer has a tendency to lock down way too much behavior in tests that is not actually interesting to assert on, thereby giving itself too little wiggle room for future evolution. Either that, OR the test is not a contract and it can be broken just fine--but in that case, is it really that valuable to assert in the first place?

- **Issue #38827** (2026-09-29): **core: CloudFormation-Validate false positive — `AWS::SSO::Assignment` `PrincipalId` (32-hex Identity Store ID) rejected as not matching the GUID pattern**
  *Symptoms*: ### Describe the bug  The built-in CloudFormation template validation introduced in `aws-cdk-lib` (`CloudFormationValidatePlugin`) reports a `PrincipalId ... does not match pattern` warning for every `AWS::SSO::Assignment` resource, even though the value is a valid IAM Identity Center (Identity Store) principal ID.  IAM Identity Center commonly issues user/group IDs as a **32-character lowercase hex string without hyphens** (e.g. `0123456789abcdef0123456789abcdef `). The validator expects a hyphenated GUID and flags the non-hyphenated form:  ``` [Warning] Template validation found issues in your templates (reported as warnings). Set feature flag "@aws-cdk/core:validateAgainstDefaultRules" to true to turn these into errors.  WARNING PrincipalId: '0123456789abcdef0123456789abcdef' does not match pattern   '^([0-9a-f]{10}-|)[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$'   (CloudFormation Validate)   ... aws-cdk-lib.aws_sso.CfnAssignment ```  These are valid principal IDs that deploy successfully — `AWS::SSO::Assignment` accepts them and stacks deploy without error. The warning is a false positive from the validation ruleset's regex, which does not account for the non-hyphenated Identity Store ID form.  In a real project with many assignments this produces a very large amount of log noise (in our case ~1,955 such warning lines / ~1 MB per `cdk synth`), which buries genuine synth errors.   ### Regression Issue  - [ ] Select this option if this issue 
  **Post-Mortem & Fix Analysis**:
  > Reproduced on 2.268.0 and traced where that warning comes from.  The `does not match pattern` diagnostic is not emitted by `aws-cdk-lib` itself. It comes from the bundled validation engine (`@aws/cloudformation-validate`, the JS build of `aws-cloudformation/cloudformation-validate`), which validates against the CloudFormation registry schema. In that engine's schema data the `AWS::SSO::Assignment` `PrincipalId` constraint is:  ``` pattern: ^([0-9a-f]{10}-|)[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$ minLength: 1 maxLength: 47 ```  i.e. exactly the regex from the report. It only matches a hyphenated GUID (optionally prefixed by a 10-hex identity-store segment), so a non-hyphenated 32-hex Identity Store ID is rejected even though the service accepts it. The `maxLength: 47` also suggests the field is meant to hold more than the bare GUID form (GUID plus the 10-hex prefix).  This is the same class as #38460, where the rule likewise lived in the engine rathe
  > @shashankvarma499   Thank you for the detailed investigation and for tracing this down to the `@aws/cloudformation-validate` engine and the registry schema pattern — that's very helpful, and it lines up with the behavior we're seeing.  Raising it upstream (the same route as #38460 → aws-cloudformation/cloudformation-validate#264) sounds like exactly the right approach to me. I'd be grateful if you could help push that forward.  For reference, the `PrincipalId` values that IAM Identity Center issues in our environment are non-hyphenated 32-character hex strings, and they deploy successfully via `AWS::SSO::Assignment` — so allowing that form in the schema pattern (e.g. an additional `|^[A-Fa-f0-9]{32}$` alternative, as you suggested) would resolve the false positive on our side.  Please let me know if there's anything further you'd like from me — a reference to the upstream issue once it's opened would be great so I can follow along.  Thanks again for looking into this!
  > Hi @teru9999,  ``` ┌────────────────────────────────────────────────────────────┐ │ 🔴 Reported State                                          │ │ Every AWS::SSO::Assignment with a 32-hex PrincipalId       │ │ emits a "does not match pattern" warning at synth          │ └─────────────────────────────┬──────────────────────────────┘                               │                               ▼ ┌────────────────────────────────────────────────────────────┐ │ 🔍 Root Cause                                              │ │ Registry schema pattern (mirrored from the SSO API docs)   │ │ only allows hyphenated GUIDs; bundled into the validate    │ │ engine's WASM — not patchable inside aws-cdk-lib           │ └─────────────────────────────┬──────────────────────────────┘                               │                               ▼ ┌────────────────────────────────────────────────────────────┐ │ 🟢 Suggested Fix                                           │ │ Relax the pattern upstream in re

- **Issue #38820** (2026-09-18): **core: acknowledgeWarning() before addWarningV2() on the same construct does not suppress the warning**
  *Symptoms*: ### Describe the bug  `Annotations.of(scope).acknowledgeWarning(id)` is documented as subtree-scoped ("The acknowledgement will apply to all child scopes"). However, if you acknowledge a warning on a construct **before** a warning with that same id is emitted on the **same** construct, the acknowledgement is ignored and the warning is still emitted.  The reverse order (emit first, then acknowledge) works, and acknowledging on an **ancestor** works for descendants in either order. Only the "acknowledge-then-emit on the same construct" case is broken. `acknowledgeInfo()` / `addInfoV2()` share the same lookup and have the same bug.  ### Expected Behavior  Acknowledging a warning id on construct `C` suppresses a later `addWarningV2` with that id emitted on `C` itself (consistent with the documented subtree semantics and with the ancestor/child cases).  ### Current Behavior  The warning is emitted anyway. Synthesizing the app below yields a warning on `/S1/C1`:  ``` [ { path: '/S1/C1', message: 'You should know this! [ack: MESSAGE]' } ] ```  ### Reproduction Steps  ```ts import { App, Stack } from 'aws-cdk-lib'; import { Annotations } from 'aws-cdk-lib'; import { Construct } from 'constructs';  const app = new App(); const stack = new Stack(app, 'S1'); const c1 = new Construct(stack, 'C1');  // Acknowledge FIRST, then emit on the SAME construct Annotations.of(c1).acknowledgeWarning('MESSAGE', 'ack'); Annotations.of(c1).addWarningV2('MESSAGE', 'You should know this!');  app.synth()
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed writeup and the fix — this is a good catch. I didn't deploy anything since it's synth-time framework behavior, but I confirmed the root cause directly against the source on `main`. Your diagnosis is exactly right: `Acknowledgements.add()` records the ack under the construct's exact path, `addWarningV2` gates emission on `has()`, and `has()` only walks the paths from `searchPaths()` — which never includes the node's own full path, despite its docstring saying it should.  https://github.com/aws/aws-cdk/blob/db16761ded5c51f2066ee6ba901601c920cd61c9/packages/aws-cdk-lib/core/lib/annotations.ts#L282  https://github.com/aws/aws-cdk/blob/db16761ded5c51f2066ee6ba901601c920cd61c9/packages/aws-cdk-lib/core/lib/annotations.ts#L73  Making `searchPaths()` self-inclusive (matching its docstring) is the right fix, and it also covers the `acknowledgeInfo`/`addInfoV2` branch since they share the lookup. I see PR #38821 already does exactly this.  On the linter failure ("Fixes mu
  > Comments on closed issues and PRs are hard for our team to see.  If you need help, please open a new issue that references this one.

- **Issue #38806** (2026-09-10): **fix(dynamodb): `TableV2` emits internal grants deprecation warnings**
  *Symptoms*: ### Issue # (if applicable)  Closes #38709.  ### Reason for this change  `TableV2` constructs its public `grants` helper with the deprecated `TableGrantsProps.encryptedResource` and `policyResource` fields. jsii checks deprecated struct fields by key presence, so every Python `TableV2` construction emits two warnings even when no grant API is called.  The fields were removed by #38399, but the constructor block later retained them while #37892 changed how `hasIndex` is passed.  ### Description of changes  Omit the deprecated resource props when constructing `TableGrants` and rely on its existing `EncryptedResources` and `ResourceWithPolicies` discovery. Add a comment documenting the intentional omission to prevent recurrence.  This does not change the public API or synthesized CloudFormation. Existing tests cover discovered KMS-key grants and DynamoDB resource-policy grants.  ### Describe any new or updated permissions being added  None.  ### Description of how you validated changes  - Built `aws-cdk-lib` successfully, including jsii compilation and lint. - Ran all 148 tests in `aws-dynamodb/test/table-v2.test.ts` with `JSII_DEPRECATED=fail`. - Ran a compiled JavaScript smoke test that constructs `TableV2` with `JSII_DEPRECATED=fail`; no deprecation failure was emitted.  ### Checklist  - [x] My code adheres to the [CONTRIBUTING GUIDE](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md) and [DESIGN GUIDELINES](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELIN
  **Post-Mortem & Fix Analysis**:
  > Exemption Request: This change fixes jsii deprecation warnings by removing deprecated fields from an internal `TableGrantsProps` object. The behavior is covered by the existing `TableV2` unit tests for KMS-key and resource-policy discovery, and the patch does not change synthesized CloudFormation, so a new integration test or snapshot would not provide additional coverage. 
  > Thank you for contributing! Your pull request will be updated from main and then merged automatically (do not update manually, and be sure to [allow changes to be pushed to your fork](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork)).
  > <!--- DO NOT EDIT -*- Mergify Payload -*- {"version": 1, "state": "merged", "queue_rule_name": "default-squash", "queued_at": "2026-09-10T12:03:24.931148+00:00", "estimated_time_of_merge": null, "speculative_check_pr": null, "required_conditions": []} -*- Mergify Payload End -*- -->  # Merge Queue Status  - ✅ **Entered queue** — `2026-09-10 12:03 UTC` · Rule: `default-squash` · triggered by rule `automatic merge` - ✅ **Checks passed** · in-place - ✅ **Merged** — `2026-09-10 13:59 UTC` · at `57b304363240cbe333e6b3222d9ddb7803f81258` · squash  This pull request spent **1 hour 55 minutes 52 seconds** in the queue, including **1 hour 1 minute 51 seconds** running CI.  <details> <summary>Required conditions to merge</summary>  - [`github-review-approved`](https://docs.mergify.com/configuration/conditions/#pull-request-attributes-github-review-approved) [🛡 GitHub branch protection]   - [X] #38806 - [X] any of [🛡 GitHub branch protection]:   - [X] `check-success = validate-pr`   - [ ] `chec

- **Issue #38794** (2026-09-10): **aws-cdk-lib: bundled @aws-cdk/asset-node-proxy-agent-v6@2.1.2 dependant package vulnerability CVE-2026-69192 (ip-address)**
  *Symptoms*: ### Describe the bug  `aws-cdk-lib` bundles `@aws-cdk/asset-node-proxy-agent-v6` (currently at `2.1.2`, the latest published version), which pins `ip-address@10.2.0` in its baked-in Lambda layer zip (`layer/package-lock.json`).  `ip-address@10.2.0` is affected by CVE-2026-69192: `Address4` parses a leading-zero octet as decimal while the network stack (WHATWG URL host parser, `inet_aton`, `getaddrinfo`) decodes it as octal, so code relying on `isPrivate()`/`isLoopback()`/etc. for a trust-boundary decision (e.g. SSRF filtering) can be bypassed. Fixed upstream in `ip-address@10.3.1`.  I confirmed via `aws-cdk-lib@2.264.0` (the latest version I tested) that the `ip-address` version bundled in the layer zip is unchanged at 10.2.0 — bumping `aws-cdk-lib` does not pick up a rebuilt layer, since `@aws-cdk/asset-node-proxy-agent-v6` itself hasn't published a new version since 2.1.2.  This looks like the same underlying gap as #37566 (the layer lagging behind its bundled `basic-ftp` dependency for CVE-2026-39983) — the `asset-node-proxy-agent-v6` layer isn't being rebuilt/republished when its own dependencies get security patches.  ### Regression Issue  - [ ] Select this option if this issue appears to be a regression.  ### Last Known Working CDK Library Version  N/A — affects all published versions of `@aws-cdk/asset-node-proxy-agent-v6` up to and including 2.1.2.  ### Expected Behavior  `@aws-cdk/asset-node-proxy-agent-v6` is rebuilt/republished with a patched `ip-address` (>=10.3.1
  **Post-Mortem & Fix Analysis**:
  > Filed a PR against the actual source repo for this asset: cdklabs/awscdk-asset-node-proxy-agent#805. That's a separate repo from aws-cdk itself — this repo's own dependency on `@aws-cdk/asset-node-proxy-agent-v6` can be bumped once that repo cuts a new release.
  > Thanks for the detailed report and for verifying the published artifact rather than just the lockfile. Good news: this is already fixed. `@aws-cdk/asset-node-proxy-agent-v6@2.1.3` was published on 2026-09-08 (the same day you filed this) from release `node-proxy-agent-v6v2.1.3`:  https://github.com/cdklabs/awscdk-asset-node-proxy-agent/releases/tag/node-proxy-agent-v6v2.1.3  I verified the published 2.1.3 artifact locally — the layer zip now bundles `ip-address@10.7.0` (well past the 10.3.1 patch) and also `basic-ftp@5.3.1`, which resolves the related #37566 as well:  ```bash npm pack @aws-cdk/asset-node-proxy-agent-v6@2.1.3 unzip -p package/lib/layer.zip nodejs/node_modules/ip-address/package.json | grep version # "version": "10.7.0" ```  Since `aws-cdk-lib` declares this dependency as `^2.1.2` (it is not a bundled dependency), no new `aws-cdk-lib` release is needed — a fresh install already resolves to 2.1.3. For existing projects:  1. `npm update @aws-cdk/asset-node-proxy-agent-v6` 
  > Comments on closed issues and PRs are hard for our team to see.  If you need help, please open a new issue that references this one.

- **Issue #38789** (2026-09-18): **fix(core): validations.acknowledge() does not respect scopes**
  *Symptoms*: The applied scope of validation suppressions was not taken into account when considering which rules were being suppressed.   In this change, we retain that information and apply the closest suppression to any resource. This looks somewhat more complex than you'd expect because the structure of a violations report looks like   ``` { rule, resources } ```  And some of those resources might be suppressed and not others. In fact, they might be suppressed by different suppression rules as well and for different reasons, which the suppression report expects to be reported accurately.  Fixes #38495.  Other changes:  - We used to infer `constructPath` from `logicalId` during JSON formatting. This is now a discrete step during violation processing, because the scope checker needs that information.  ----  *By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license* 
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-issue-check-bot --> 👋 It looks like your PR description references an issue, but not in the expected location.  The issue number must appear in the first section of the description (the first two lines), following the template format: ``` ### Issue # (if applicable)  Closes #123. ``` Please move your issue reference to the top of the description.
  > **Automated review**  A maintainer will still review this — treat the notes below as a starting point.  This PR fixes `Validations.of(scope).acknowledge()` in CDK core so suppression is genuinely scope-based: a violation is now suppressed only when its resource's construct path equals or descends from the path the acknowledgment was recorded on, replacing the previous behavior where acknowledging a rule anywhere suppressed it App-wide. The change reshapes the internal acknowledgment map to `ruleId -> constructPath -> Acknowledgement`, adds an `inferConstructPathsFromLogicalIds` step moved out of the JSON formatter, and partitions each violation's resources into suppressed groups and a surviving unsuppressed set; it also retargets in-library EKS/EKS-v2 `W2506` acknowledgments to `Stack.of(scope)` and adds an S3 test acknowledgment to accommodate the narrower scoping.  The core rewrite is sound — the path walk splits on `/` boundaries so siblings sharing a string prefix are not false-mat
  > Thank you for contributing! Your pull request will be updated from main and then merged automatically (do not update manually, and be sure to [allow changes to be pushed to your fork](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork)).

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

### Incident Patch 1: `269052d6` (2026-09-29)
**Commit Message**: fix(core): synth crashes with EISDIR on cloud-placeholder directories in cdk.out (#38672)

Closes #38653.

### Reason for this change

Since `aws-cdk-lib` v2.262.0, `cdk synth` crashes with

```
Error: EISDIR: illegal operation on a directory, read
    at hashFile (.../core/lib/private/synthesis-validation.ts)
    at snapshotFileHashes (...)
    at doInvokeValidationPlugins (...)
    at validateTemplates (...)
```
when the project's `cdk.out` contains Windows reparse points (e.g. Windows cloud files placeholders). In our validations, we classified these as "files or symlinks" using `readdirSync`. Later, in the `hashFile` function here:
```
  const content = fs.lstatSync(filePath).isSymbolicLink()
    ? Buffer.from(fs.readlinkSync(filePath))
    : fs.readFileSync(filePath);
```
the check against isSymbolicLink is false (lstat and readdirSync disagree), so we run `readFileSync`. This throws EISDIR because lstat thinks it's a directory.

The previous fix in #38299 covers real symlinks-to-directory, where lstat agrees the entry is a symlink, but doesn't account for this disagreement.

### Description of changes

`collectFilePaths()` now gates on what `lstat()` says the entry **is**, ra

**File**: `packages/aws-cdk-lib/core/lib/private/synthesis-validation.ts` (modified, +19/-3)
```diff
@@ -568,10 +568,26 @@ function collectFilePaths(dir: string): string[] {
         // `isDirectory()` is false for a symlink-to-directory, so we never recurse
         // through symlinks (avoids following links out of the cloud assembly / cycles).
         walk(full);
-      } else if (entry.isFile() || entry.isSymbolicLink()) {
-        // Collect regular files and symlinks (including symlink-to-directory). The
-        // symlink is hashed by its target path in hashFile(), never dereferenced.
+      } else if (entry.isFile()) {
+        // collect regular files
         results.push(full);
+      } else if (entry.isSymbolicLink()) {
+        /**
+         * Windows reparse points (OneDrive/Dropbox cloud placeholders, etc.)
+         * are classified as symlinks by readdir but as directories by lstat,
+         * so we implement an extra check with lstat here
+         * @see https://github.com/aws/aws-cdk/issues/38653
+         **/
+        let st: fs.Stats;
+        try {
+          st = fs.lstatSync(full);
+        } catch {
+          // nothing to snapshot
+          continue;
+        }
+        if (st.isFile() || st.isSymbolicLink()) {
+          results.push(full);
+        }
       }
     }
   }
```

**File**: `packages/aws-cdk-lib/core/test/validation/synthesis-validation-symlink.test.ts` (modified, +115/-0)
```diff
@@ -61,3 +61,118 @@ describe('policy validation plugins tolerate symlinks in the cloud assembly (#38
     expect(fs.lstatSync(seedLink).isSymbolicLink()).toBe(true);
   });
 });
+
+/**
+ * Regression test for https://github.com/aws/aws-cdk/issues/38653
+ *
+ * On Windows, `cdk.out` can contain **directory reparse points** whose tag libuv
+ * cannot `readlink()` — Cloud Files placeholders (OneDrive/Dropbox,
+ * IO_REPARSE_TAG_CLOUD_*), ProjFS, dedup, WCI, volume-GUID junctions, etc. For
+ * these, libuv's `fs__scandir` classifies the entry as a symlink in
+ * `readdirSync({ withFileTypes: true })` (because it checks
+ * FILE_ATTRIBUTE_REPARSE_POINT before FILE_ATTRIBUTE_DIRECTORY), but
+ * `fs__readlink_handle` refuses the tag and `fs__stat_impl` retries with
+ * do_lstat = 0, so `lstatSync()` reports it as an ordinary directory.
+ *
+ * `hashFile()` in `synthesis-validation.ts` then calls `readFileSync()` on what
+ * is really a directory and throws `EISDIR`, crashing `cdk synth`. The prior
+ * fix in #38299 only covers real symlinks-to-directory on POSIX; it does not
+ * cover this case because it structurally relies on `lstat` reporting the path
+ * as a symlink, which it never does for these tags.
+ *
+ * We can't easily manufacture a real reparse point on POSIX CI (would need
+ * `mountvol` on Windows, or a cloud sync engine). So we capture the invariant
+ * with a mock: force `readdirSync({ withFileTypes: true })` to report a real
+ * directory as a symbolic-link entry, leave `lstatSync` honest, and assert
+ * `app.synth()` no longer crashes.
+ */
+describe('policy validation plugins tolerate readdir/lstat disagreement (#38653)', () => {
+  let outdir: string;
+  let originalReaddirSync: typeof fs.readdirSync | undefined;
+
+  beforeEach(() => {
+    outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-reparse-asm-'));
+  });
+
+  afterEach(() => {
+    if (originalReaddirSync) {
+      // eslint-disable-next-line @typescript-eslint/no-require-imports
+      require('fs').readdirSync = originalReaddirSync;
+      originalReaddirSync = undefined;
+    }
+    fs.rmSync(outdir, { recursive: true, force: true });
+  });
+
+  test('synth succeeds when readdir classifies a directory as a symlink (Windows reparse-point behavior)', () => {
+    const app = new App({
+      outdir,
+      policyValidationBeta1: [
+        { name: 'noop', validate: () => ({ success: true, violations: [] }) },
+      ],
+    });
+    const stack = new Stack(app, 'Stack');
+    new CfnResource(stack, 'Res', {
+      type: 'Test::Resource::Fake',
+      properties: { result: 'success' },
+    });
+
+    // Seed a real directory that the pre-plugin snapshot in snapshotFileHashes()
+    // will walk. We give it a child so its Dirent survives readdir.
+    const reparseLookalike = path.join(outdir, 'reparse-lookalike');
+    fs.mkdirSync(reparseLookalike);
+    fs.writeFileSync(path.join(reparseLookalike, 'child.txt'), 'inside');
+
+    // Force libuv-on-Windows behavior for this one entry: readdir says "symlink",
+    // lstat (untouched) says "directory". Any other readdir call — different
+    // path, no withFileTypes option — passes through unchanged. jest.spyOn on
+    // the fs module doesn't work in Node 20 (readdirSync is exposed via a
+    // non-configurable getter on the ES-module namespace), so we mutate the
+    // underlying CommonJS module.exports directly and restore in afterEach.
+    // eslint-disable-next-line @typescript-eslint/no-require-imports
+    const fsMutable: any = require('fs');
+    originalReaddirSync = fsMutable.readdirSync;
+    const passthrough = originalReaddirSync;
+    // Counts how many times the code under test drove the spoofed entry through
+    // the mock. Guards against a vacuous pass if synthesis-validation ever stops
+    // reaching this mock — e.g. a refactor from `fs.readdirSync(...)` to a
+    // destructured `const { readdirSync } = fs` binding, which would resolve
+    // readdirSync before this reass
```

---

### Incident Patch 2: `aff4a2f3` (2026-09-28)
**Commit Message**: fix(bedrockagentcore): browser grantUse is missing ConnectBrowserAutomationStream (#38657)

### Issue # (if applicable)

Closes #38656.

### Reason for this change

`BrowserCustom.grantUse()` does not grant enough permissions for the grantee to actually use the browser.

Granting `grantUse()` to an agent runtime and then driving the browser, `StartBrowserSession` succeeds, but the subsequent connection to the automation stream is rejected with `403 Forbidden`:

```
INFO bedrock_agentcore.tools.browser_client ✅ Session started: 01M0T9ME4FBJQY2QCXZ1M33ADP
INFO bedrock_agentcore.tools.browser_client Generating websocket headers...
→ 403 Forbidden
```

This is unpleasant to debug, because the session is created successfully and reaches `READY`. Only the WebSocket connection to the returned stream endpoint fails, so nothing in the logs points at IAM.

The cause is that `BROWSER_USE_PERMS` is missing `bedrock-agentcore:ConnectBrowserAutomationStream`:

https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-bedrockagentcore/lib/tools/perms.ts#L61-L65

Connecting to the automation stream over the Chrome DevTools Protocol is not an optional extra — it is how you interact with a b

**File**: `packages/aws-cdk-lib/aws-bedrockagentcore/README.md` (modified, +1/-1)
```diff
@@ -1117,7 +1117,7 @@ const userRole = new iam.Role(this, "UserRole", {
 // Grant read permissions (Get and List actions)
 browser.grantRead(userRole);
 
-// Grant use permissions (Start, Update, Stop actions)
+// Grant use permissions (Start, Update, Connect to the automation stream, and Stop actions)
 browser.grantUse(userRole);
 
 // Grant specific custom permissions
```

**File**: `packages/aws-cdk-lib/aws-bedrockagentcore/lib/tools/browser.ts` (modified, +10/-4)
```diff
@@ -133,7 +133,8 @@ export interface IBrowserCustom extends IResource, iam.IGrantable, ec2.IConnecta
    */
   grantRead(grantee: iam.IGrantable): iam.Grant;
   /**
-   * Grants `Invoke`, `Start`, and `Update` actions on the Browser
+   * Grants the actions needed to start a browser session, connect to its
+   * automation stream and stop it again
    */
   grantUse(grantee: iam.IGrantable): iam.Grant;
 
@@ -298,13 +299,18 @@ export abstract class BrowserCustomBase extends Resource implements IBrowserCust
   }
 
   /**
-   * Grant invoke permissions on this browser to an IAM principal.
+   * Grant permissions to use this browser to an IAM principal.
+   *
+   * This includes `ConnectBrowserAutomationStream`, which is required to connect
+   * to the automation stream of a session over the Chrome DevTools Protocol.
+   * Without it, `StartBrowserSession` succeeds but the subsequent connection to
+   * the returned stream endpoint is rejected.
    *
    * [disable-awslint:no-grants]
    *
-   * @param grantee - The IAM principal to grant invoke permissions to
+   * @param grantee - The IAM principal to grant use permissions to
    * @default - Default grant configuration:
-   * - actions: ['bedrock-agentcore:StartBrowserSession', 'bedrock-agentcore:UpdateBrowserStream', 'bedrock-agentcore:StopBrowserSession']
+   * - actions: ['bedrock-agentcore:StartBrowserSession', 'bedrock-agentcore:UpdateBrowserStream', 'bedrock-agentcore:ConnectBrowserAutomationStream', 'bedrock-agentcore:StopBrowserSession']
    * - resourceArns: [this.browserArn]
    * @returns An IAM Grant object representing the granted permissions
    */
```

**File**: `packages/aws-cdk-lib/aws-bedrockagentcore/lib/tools/perms.ts` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@ export const BROWSER_LIST_PERMS = [
 export const BROWSER_USE_PERMS = [
   'bedrock-agentcore:StartBrowserSession',
   'bedrock-agentcore:UpdateBrowserStream',
+  'bedrock-agentcore:ConnectBrowserAutomationStream',
   'bedrock-agentcore:StopBrowserSession',
 ];
 
```

**File**: `packages/aws-cdk-lib/aws-bedrockagentcore/test/agentcore/tools/browser.test.ts` (modified, +90/-0)
```diff
@@ -1206,6 +1206,96 @@ describe('BrowserCustom grant method tests', () => {
   });
 });
 
+describe('BrowserCustom granted actions tests', () => {
+  let stack: cdk.Stack;
+  let browser: BrowserCustom;
+  let role: iam.Role;
+
+  beforeEach(() => {
+    const app = new cdk.App();
+    stack = new cdk.Stack(app, 'test-stack', {
+      env: {
+        account: '123456789012',
+        region: 'us-east-1',
+      },
+    });
+
+    browser = new BrowserCustom(stack, 'test-browser', {
+      browserCustomName: 'test_browser',
+      networkConfiguration: BrowserNetworkConfiguration.usingPublicNetwork(),
+    });
+
+    role = new iam.Role(stack, 'TestRole', {
+      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
+    });
+  });
+
+  test('grantUse grants the actions required to start and drive a browser session', () => {
+    browser.grantUse(role);
+
+    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
+      PolicyDocument: {
+        Statement: Match.arrayWith([
+          Match.objectLike({
+            Action: [
+              'bedrock-agentcore:StartBrowserSession',
+              'bedrock-agentcore:UpdateBrowserStream',
+              'bedrock-agentcore:ConnectBrowserAutomationStream',
+              'bedrock-agentcore:StopBrowserSession',
+            ],
+            Effect: 'Allow',
+            Resource: stack.resolve(browser.browserArn),
+          }),
+        ]),
+      },
+    });
+  });
+
+  test('grantUse grants ConnectBrowserAutomationStream, which the automation stream connection requires', () => {
+    const grant = browser.grantUse(role);
+
+    const actions = grant.principalStatements.flatMap(s => s.actions);
+    expect(actions).toContain('bedrock-agentcore:ConnectBrowserAutomationStream');
+  });
+
+  test('grantRead grants read actions on the browser and list actions on all resources', () => {
+    browser.grantRead(role);
+
+    const template = Template.fromStack(stack);
+
+    template.hasResourceProperties('AWS::IAM::Policy', {
+      PolicyDocument: {
+        Statement: Match.arrayWith([
+          Match.objectLike({
+            Action: [
+              'bedrock-agentcore:GetBrowser',
+              'bedrock-agentcore:GetBrowserSession',
+            ],
+            Effect: 'Allow',
+            Resource: stack.resolve(browser.browserArn),
+          }),
+        ]),
+      },
+    });
+
+    // List actions do not support resource-level permissions.
+    template.hasResourceProperties('AWS::IAM::Policy', {
+      PolicyDocument: {
+        Statement: Match.arrayWith([
+          Match.objectLike({
+            Action: [
+              'bedrock-agentcore:ListBrowsers',
+              'bedrock-agentcore:ListBrowserSessions',
+            ],
+            Effect: 'Allow',
+            Resource: '*',
+          }),
+        ]),
+      },
+    });
+  });
+});
+
 describe('BrowserCustom recording configuration with S3 location tests', () => {
   test('Should grant S3 permissions when recording is enabled with S3 location', () => {
     const app = new cdk.App();
```

---

### Incident Patch 3: `edd162d8` (2026-09-25)
**Commit Message**: fix(lambda-nodejs): local bundling fails under AllSigned PowerShell execution policy (#38447)

### Issue # (if applicable)

Closes #38439.

### Reason for this change

Local bundling on Windows runs `powershell.exe -NoProfile -Command "& 'npm' 'ci'"`. Because the call operator receives a bare command name, PowerShell's command discovery can select the `npm.ps1` shim over `npm.cmd`, and `.ps1` scripts are subject to the execution policy. Under `AllSigned` there is no developer-side workaround: `MachinePolicy` scope overrides the `Process` scope that `-ExecutionPolicy Bypass` would set.

### Description of changes

Resolve the executable with `Get-Command <name> -CommandType Application` before invoking it. `Application` matches only external programs (`.cmd`, `.exe`), so the `.ps1` shim is never a candidate.

Both prior fixes are preserved: the command name and all arguments are still individually quoted via `powershellEscape` (command injection fix), and spawn steps still route through PowerShell rather than spawning `.cmd` directly (`EINVAL` fix from #37412).

Behavior note: a missing executable now surfaces as PowerShell's `CommandNotFoundException` instead of a spawn failure. Th

**File**: `packages/aws-cdk-lib/aws-lambda-nodejs/lib/bundling.ts` (modified, +23/-1)
```diff
@@ -525,7 +525,7 @@ export class Bundling implements cdk.BundlingOptions {
           // Powershell.exe instead of cmd.exe because the quoting rules are saner.
           // See https://github.com/aws/aws-cdk/issues/37387
           if (isWindows) {
-            exec('powershell.exe', ['-NoProfile', '-Command', `& ${step.command.map(powershellEscape).join(' ')}`], {
+            exec('powershell.exe', ['-NoProfile', '-Command', powershellCommandLine(step.command)], {
               ...execOptions,
               cwd: step.cwd ?? cwd,
             });
@@ -678,6 +678,28 @@ function powershellEscape(arg: string): string {
   return "'" + arg.replace(/'/g, "''") + "'";
 }
 
+/**
+ * Build the PowerShell command line used to run a bundling spawn step on Windows.
+ *
+ * The executable is resolved with `Get-Command -CommandType Application` rather than
+ * being passed to the call operator directly. Given a bare command name such as `npm`,
+ * PowerShell's own command discovery can select the `npm.ps1` shim, and `.ps1` scripts
+ * are subject to the execution policy: under `AllSigned` (typically set at
+ * `MachinePolicy` scope via Group Policy, which overrides every other scope) the shim is
+ * refused and bundling fails. `-CommandType Application` only matches external programs
+ * such as `npm.cmd`, which the execution policy does not apply to.
+ *
+ * Arguments remain individually quoted, so this keeps the argument handling introduced
+ * to fix command injection in local bundling.
+ *
+ * See https://github.com/aws/aws-cdk/issues/38439
+ */
+function powershellCommandLine(command: string[]): string {
+  const [executable, ...args] = command;
+  const resolved = `(Get-Command ${powershellEscape(executable)} -CommandType Application)[0].Source`;
+  return ['&', resolved, ...args.map(powershellEscape)].join(' ');
+}
+
 /**
  * Chain commands
  */
```

**File**: `packages/aws-cdk-lib/aws-lambda-nodejs/test/bundling.test.ts` (modified, +44/-0)
```diff
@@ -1605,6 +1605,50 @@ test('Local bundling on Windows uses powershell for spawn steps', () => {
   expect(cmdString).toContain("'--bundle'");
   expect(cmdString).toContain("'--platform=node'");
 
+  // The executable is resolved to an Application so PowerShell cannot select the
+  // .ps1 shim, which the AllSigned execution policy refuses. See issue #38439.
+  expect(cmdString).toMatch(/^& \(Get-Command '[^']+' -CommandType Application\)\[0\]\.Source /);
+
+  spawnSyncMock.mockRestore();
+  osPlatformMock.mockRestore();
+});
+
+test('Local bundling on Windows resolves the spawned executable to an Application', () => {
+  // A bare command name passed to the PowerShell call operator can resolve to the
+  // .ps1 shim (e.g. npm.ps1), which is blocked under an AllSigned execution policy.
+  // Resolving with -CommandType Application only matches npm.cmd / npm.exe.
+  // See https://github.com/aws/aws-cdk/issues/38439
+  const osPlatformMock = jest.spyOn(os, 'platform').mockReturnValue('win32');
+  const spawnSyncMock = jest.spyOn(child_process, 'spawnSync').mockReturnValue(spawnSyncMockReturnValue);
+  jest.spyOn(fs, 'copyFileSync').mockReturnValue();
+  jest.spyOn(fs, 'writeFileSync').mockReturnValue();
+
+  const packageLock = path.join(__dirname, '..', 'package-lock.json');
+  const bundler = new Bundling(stack, {
+    entry: __filename,
+    projectRoot: path.dirname(packageLock),
+    depsLockFilePath: packageLock,
+    runtime: STANDARD_RUNTIME,
+    architecture: Architecture.X86_64,
+    nodeModules: ['delay'],
+  });
+
+  bundler.local?.tryBundle('/outdir', { image: STANDARD_RUNTIME.bundlingDockerImage });
+
+  const psCommands = spawnSyncMock.mock.calls
+    .filter(c => c[0] === 'powershell.exe')
+    .map(c => (c[1] as string[])[2]);
+  expect(psCommands.length).toBeGreaterThan(0);
+
+  for (const command of psCommands) {
+    // Every spawn resolves its executable rather than invoking a bare name.
+    expect(command).toMatch(/^& \(Get-Command '[^']+' -CommandType Application\)\[0\]\.Source/);
+    expect(command).not.toMatch(/^& '/);
+  }
+
+  // The npm install step is present and goes through the resolved form.
+  expect(psCommands.some(c => c.includes('-CommandType Application') && c.includes("'ci'"))).toEqual(true);
+
   spawnSyncMock.mockRestore();
   osPlatformMock.mockRestore();
 });
```

---

### Incident Patch 4: `0c5e732d` (2026-09-25)
**Commit Message**: fix(core): upgrade CloudFormation validation to latest version (#38884)

### Description
This upgrades `@aws/cloudformation-validate` to [1.12.1](https://github.com/aws-cloudformation/cloudformation-validate/compare/1.9.0-beta...1.12.1) in order to get the latest fixes and improvements.

Changes:
* Move to the `CompositeEngine` which evaluates rules in pure rust instead of Rego, while still supporting custom Rego rules. This significantly improves performance and memory usage
* Fixes schema issues reported in
  * https://github.com/aws/aws-cdk/issues/38531 and https://github.com/aws-cloudformation/cloudformation-validate/issues/300
* Includes latest resource schemas
* Free the WASM engine memory to speed up tests
* Switch to `STANDARD` detail level since the extra analysis is not being used

### Checklist
- [x] My code adheres to the [CONTRIBUTING GUIDE](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md) and [DESIGN GUIDELINES](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)

----

*By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license*

**File**: `packages/aws-cdk-lib/aws-rds/test/serverless-cluster.test.ts` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ describe('serverless cluster', () => {
   test('can create a Serverless Cluster with Aurora Postgres database engine', () => {
     // GIVEN
     const stack = testStack();
+    cdk.Validations.of(stack).acknowledge({
+      id: 'CloudFormation-Validate::E3002',
+      reason: 'This test intentionally uses the reserved username "admin" to verify explicit credentials are synthesized unchanged',
+    });
     const vpc = new ec2.Vpc(stack, 'VPC');
 
     // WHEN
```

**File**: `packages/aws-cdk-lib/core/lib/validation/cloudformation-validate-plugin.ts` (modified, +34/-8)
```diff
@@ -1,14 +1,14 @@
 import * as fs from 'fs';
 import * as path from 'path';
-import { RegoEngine, TemplateFile, version } from '@aws/cloudformation-validate';
-import type { AdditionalSchemaSource, Engine, EngineConfig, RuleInfo, Severity } from '@aws/cloudformation-validate';
+import { CompositeEngine, TemplateFile, version } from '@aws/cloudformation-validate';
+import type { AdditionalSchemaSource, CompositeEngineConfig, Engine, RuleInfo, Severity } from '@aws/cloudformation-validate';
 import type { PolicyValidationPluginReport, PolicyViolatingResource } from './report';
 import type { IPolicyValidationPlugin, IPolicyValidationContext } from './validation';
 import { UnscopedValidationError } from '../errors';
 import { lit } from '../private/literal-string';
 import { profileSpan, recordPerformanceEntry } from '../private/perf';
 
-const VALIDATE_DETAILED_METRIC = 'CloudFormationValidate.validate';
+const VALIDATE_METRIC = 'CloudFormationValidate.validate';
 const DIAGNOSTICS_METRIC = 'CloudFormationValidate.diagnostics';
 
 interface MutableViolation {
@@ -121,23 +121,35 @@ export class CloudFormationValidatePlugin implements IPolicyValidationPlugin {
    * @internal
    */
   public static _configureSingleton(props: CloudFormationValidatePluginProps) {
+    CloudFormationValidatePlugin._disposeSingleton();
     CloudFormationValidatePlugin._instance = new CloudFormationValidatePlugin(props);
   }
 
+  /**
+   * Release the validator engine’s off-heap WASM memory and forget the instance
+   *
+   * @internal
+   */
+  public static _disposeSingleton() {
+    CloudFormationValidatePlugin._instance?._dispose();
+    CloudFormationValidatePlugin._instance = undefined;
+  }
+
   private static _instance: CloudFormationValidatePlugin | undefined;
 
   public readonly name = CloudFormationValidatePlugin.PLUGIN_NAME;
 
   private readonly engine: Engine;
+  private disposed = false;
 
   constructor(props: CloudFormationValidatePluginProps = {}) {
-    const config: EngineConfig = {};
+    const config: CompositeEngineConfig = {};
     const regoRules = [
       ...(props.includeDefaultRules ?? true) ? defaultRegoRules() : [],
       ...props.regoRules ?? [],
     ];
     if (regoRules.length > 0) {
-      config.customRules = regoRules;
+      config.regoRules = regoRules;
     }
     if (props.guardRules) {
       config.guardRules = props.guardRules;
@@ -147,7 +159,20 @@ export class CloudFormationValidatePlugin implements IPolicyValidationPlugin {
         additionalSchemas: loadSchemasFromDirectory(props._additionalSchemasDirectory),
       };
     }
-    this.engine = new RegoEngine(config);
+    this.engine = new CompositeEngine(config);
+  }
+
+  /**
+   * Release the validator engine’s off-heap WASM memory
+   *
+   * @internal
+   */
+  public _dispose(): void {
+    if (this.disposed) {
+      return;
+    }
+    this.disposed = true;
+    this.engine.free();
   }
 
   public get version(): string | undefined {
@@ -167,9 +192,10 @@ export class CloudFormationValidatePlugin implements IPolicyValidationPlugin {
     for (const { stackConstructPath, templatePath, accountId, region } of context.stackTemplates) {
       const templateFile = new TemplateFile(templatePath);
       const report = (() => {
-        using _span = profileSpan(VALIDATE_DETAILED_METRIC, { telemetry: true });
+        using _span = profileSpan(VALIDATE_METRIC, { telemetry: true });
 
-        return this.engine.validateDetailed(templateFile, {
+        return this.engine.validateTemplate(templateFile, {
+          detailLevel: 'STANDARD',
           pseudoParameterOverrides: {
             accountId,
             region,
```

**File**: `packages/aws-cdk-lib/core/test/validation/cloudformation-validate-plugin.test.ts` (modified, +115/-29)
```diff
@@ -5,6 +5,7 @@ import type { PolicyValidationReportJson } from '@aws-cdk/cloud-assembly-schema'
 import { Construct } from 'constructs';
 import * as cxapi from '../../../cx-api';
 import * as core from '../../lib';
+import type { IPolicyValidationContext } from '../../lib';
 import { readPerfCounters, resetCounters } from '../../lib/private/perf';
 
 let consoleErrorMock: jest.SpyInstance;
@@ -17,6 +18,11 @@ beforeEach(() => {
 
 afterEach(() => {
   jest.clearAllMocks();
+  disposePlugins();
+});
+
+afterAll(() => {
+  core.CloudFormationValidatePlugin._disposeSingleton();
 });
 
 const originalContextJson = process.env.CDK_CONTEXT_JSON;
@@ -36,6 +42,31 @@ afterAll(() => {
 });
 
 describe('CloudFormationValidatePlugin', () => {
+  test('_dispose frees the engine exactly once', () => {
+    const plugin = newPlugin();
+    const free = jest.spyOn((plugin as any).engine, 'free');
+
+    plugin._dispose();
+    plugin._dispose();
+
+    expect(free).toHaveBeenCalledTimes(1);
+  });
+
+  test('_configureSingleton frees the previous engine', () => {
+    core.CloudFormationValidatePlugin._configureSingleton({ includeDefaultRules: false });
+    const previous = core.CloudFormationValidatePlugin._singletonInstance();
+    const free = jest.spyOn((previous as any).engine, 'free');
+
+    try {
+      core.CloudFormationValidatePlugin._configureSingleton({ includeDefaultRules: false });
+
+      expect(free).toHaveBeenCalledTimes(1);
+    } finally {
+      previous._dispose();
+      core.CloudFormationValidatePlugin._disposeSingleton();
+    }
+  });
+
   test('reports schema violations for invalid properties', () => {
     const app = new core.App({
       context: {
@@ -250,7 +281,7 @@ describe('CloudFormationValidatePlugin', () => {
   });
 
   test('plugin can be instantiated directly with custom rules', () => {
-    const plugin = new core.CloudFormationValidatePlugin({
+    const plugin = newPlugin({
       regoRules: [{ name: 'my-rule', content: 'package main' }],
     });
 
@@ -259,14 +290,50 @@ describe('CloudFormationValidatePlugin', () => {
     expect(plugin.ruleIds).toBeDefined();
   });
 
+  test('plugin evaluates custom Guard rules', () => {
+    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-validate-guard-'));
+    const templatePath = path.join(tmpDir, 'template.json');
+    fs.writeFileSync(templatePath, JSON.stringify({
+      Resources: {
+        MyBucket: {
+          Type: 'AWS::S3::Bucket',
+        },
+      },
+    }));
+
+    try {
+      const plugin = newPlugin({
+        guardRules: [{
+          name: 'encryption.guard',
+          content: [
+            'rule check_bucket_encryption {',
+            '    AWS::S3::Bucket {',
+            '        Properties.BucketEncryption EXISTS',
+            '        <<S3 bucket must have encryption configured>>',
+            '    }',
+            '}',
+          ].join('\n'),
+        }],
+      });
+      const report = plugin.validate(validationContext(templatePath));
+
+      expect(report.violations).toContainEqual(expect.objectContaining({
+        ruleName: 'check_bucket_encryption',
+        violatingResources: [expect.objectContaining({ resourceLogicalId: 'MyBucket' })],
+      }));
+    } finally {
+      fs.rmSync(tmpDir, { recursive: true });
+    }
+  });
+
   test('user-registered instance replaces the auto-registered one', () => {
     const app = new core.App({
       context: {
         [cxapi.VALIDATE_AGAINST_DEFAULT_RULES]: true,
         [cxapi.FAIL_SYNTH_ON_VALIDATION_ERRORS_CONTEXT]: true,
       },
     });
-    core.Validations.of(app).addPlugins(new core.CloudFormationValidatePlugin());
+    core.Validations.of(app).addPlugins(newPlugin());
     const stack = new core.Stack(app, 'TestStack');
     new core.CfnResource(stack, 'MyBucket', {
       type: 'AWS::S3::Bucket',
@@ -284,8 +351,8 @@ describe('CloudFormationValidatePlugin', () => {
         [cxapi.FAIL_SYNTH_ON_VALIDATION_ERRORS_CONTEXT]: true,
       },
     });
-  
```

**File**: `packages/aws-cdk-lib/core/test/validation/default-rego-rules.test.ts` (modified, +22/-2)
```diff
@@ -12,6 +12,11 @@ beforeEach(() => {
 
 afterEach(() => {
   jest.clearAllMocks();
+  disposePlugins();
+});
+
+afterAll(() => {
+  core.CloudFormationValidatePlugin._disposeSingleton();
 });
 
 const originalContextJson = process.env.CDK_CONTEXT_JSON;
@@ -309,7 +314,7 @@ describe('default GameLift rules', () => {
 
   test('an explicitly registered plugin with custom rules still evaluates the default rules', () => {
     const app = testApp();
-    core.Validations.of(app).addPlugins(new core.CloudFormationValidatePlugin({
+    core.Validations.of(app).addPlugins(newPlugin({
       regoRules: [{
         name: 'my-custom.rego',
         content: [
@@ -368,7 +373,7 @@ describe('default GameLift rules', () => {
 
   test('includeDefaultRules: false opts out of the default rules', () => {
     const app = testApp();
-    core.Validations.of(app).addPlugins(new core.CloudFormationValidatePlugin({
+    core.Validations.of(app).addPlugins(newPlugin({
       includeDefaultRules: false,
     }));
     const stack = new core.Stack(app, 'TestStack');
@@ -400,6 +405,21 @@ function testApp() {
   });
 }
 
+let constructedPlugins: core.CloudFormationValidatePlugin[] = [];
+
+function newPlugin(props?: core.CloudFormationValidatePluginProps) {
+  const constructed = new core.CloudFormationValidatePlugin(props);
+  constructedPlugins.push(constructed);
+  return constructed;
+}
+
+function disposePlugins() {
+  for (const constructed of constructedPlugins) {
+    constructed._dispose();
+  }
+  constructedPlugins = [];
+}
+
 function loadValidationReport(asm: cxapi.CloudAssembly) {
   const p = path.join(asm.directory, 'validation-report.json');
   return JSON.parse(fs.readFileSync(p, { encoding: 'utf-8' })) as PolicyValidationReportJson;
```

**File**: `packages/aws-cdk-lib/package.json` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@
     "@aws-cdk/asset-node-proxy-agent-v6": "^2.1.2",
     "@aws-cdk/cloud-assembly-api": "^2.2.6",
     "@aws-cdk/cloud-assembly-schema": "^54.24.0",
-    "@aws/cloudformation-validate": "1.9.0-beta",
+    "@aws/cloudformation-validate": "1.12.1",
     "@balena/dockerignore": "^1.0.2",
     "case": "1.6.3",
     "fs-extra": "^11.3.6",
```

---

### Incident Patch 5: `40de511b` (2026-09-24)
**Commit Message**: chore: upgrade jsii tooling to 1.140.0 to fix failing docs build (#38891)

### Issue # (if applicable)

N/A

### Reason for this change

Our (non-public) Docs Build stage is failing because `@aws-cdk/cloud-assembly-schema` and this repo have different minimal requirements for the jsiii runtime packages. This causes the build to fail.

### Description of changes

Upgrade jsii tooling to the same version.

### Describe any new or updated permissions being added

n/a


### Checklist
- [ ] My code adheres to the [CONTRIBUTING GUIDE](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md) and [DESIGN GUIDELINES](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)

----

*By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license*

**File**: `package.json` (modified, +3/-3)
```diff
@@ -28,9 +28,9 @@
     "fs-extra": "^9.1.0",
     "graceful-fs": "^4.2.11",
     "jest-junit": "^13.2.0",
-    "jsii-diff": "1.139.0",
-    "jsii-pacmak": "1.139.0",
-    "jsii-reflect": "1.139.0",
+    "jsii-diff": "1.140.0",
+    "jsii-pacmak": "1.140.0",
+    "jsii-reflect": "1.140.0",
     "jsii-rosetta": "~5.9.56",
     "lerna": "^8.2.4",
     "nx": "^23",
```

**File**: `packages/awslint/package.json` (modified, +3/-3)
```diff
@@ -18,10 +18,10 @@
     "awslint": "bin/awslint"
   },
   "dependencies": {
-    "@jsii/spec": "1.139.0",
+    "@jsii/spec": "1.140.0",
     "chalk": "^4",
     "fs-extra": "^9.1.0",
-    "jsii-reflect": "1.139.0",
+    "jsii-reflect": "1.140.0",
     "change-case": "^4.1.2",
     "yargs": "^16.2.2"
   },
@@ -69,4 +69,4 @@
   "publishConfig": {
     "tag": "latest"
   }
-}
\ No newline at end of file
+}
```

**File**: `tools/@aws-cdk/cdk-build-tools/package.json` (modified, +3/-3)
```diff
@@ -55,8 +55,8 @@
     "jest-junit": "^13.2.0",
     "jsii": "~5.9.44",
     "jsii-rosetta": "~5.9.56",
-    "jsii-pacmak": "1.139.0",
-    "jsii-reflect": "1.139.0",
+    "jsii-pacmak": "1.140.0",
+    "jsii-reflect": "1.140.0",
     "markdownlint-cli": "^0.49.0",
     "nyc": "^15.1.0",
     "semver": "^7.8.5",
@@ -81,4 +81,4 @@
   "ubergen": {
     "exclude": true
   }
-}
\ No newline at end of file
+}
```

**File**: `yarn.lock` (modified, +44/-31)
```diff
@@ -3488,6 +3488,14 @@
     chalk "^4.1.2"
     semver "^7.8.5"
 
+"@jsii/check-node@1.140.0":
+  version "1.140.0"
+  resolved "https://registry.npmjs.org/@jsii/check-node/-/check-node-1.140.0.tgz#cc52431daf11ae18437397348f7aabedef5bb99d"
+  integrity sha512-NTiY2Nd9ZtACPZjaU+k9+oiaD191Yw0FoiUR7bB+NoOtB5nMEhrLKn5O/PYmCIZGK0G1JaJs+PmLcyj68J6RKw==
+  dependencies:
+    chalk "^4.1.2"
+    semver "^7.8.5"
+
 "@jsii/spec@1.132.0":
   version "1.132.0"
   resolved "https://registry.npmjs.org/@jsii/spec/-/spec-1.132.0.tgz#b6465fcd6a4ffeab2706fa2daed1fa937baf60e7"
@@ -3503,6 +3511,11 @@
   resolved "https://registry.npmjs.org/@jsii/spec/-/spec-1.139.0.tgz#4e21bf6538665861d7496d04eaf338a06289a574"
   integrity sha512-+l1B0h4WAg6KOQ7PGykW/FvxeFmyt74U0/n41cus9Jdjv3VfQJKynsv5r9Ng23B1KwWqJkS5YvJuv2yGYoULdw==
 
+"@jsii/spec@1.140.0":
+  version "1.140.0"
+  resolved "https://registry.npmjs.org/@jsii/spec/-/spec-1.140.0.tgz#a9a92005e189b6ea47808cb1f003ac69d8182882"
+  integrity sha512-1rGS+iJtejQ3ybSJfV0if9PzZuSQmORbVF3MkqE0csatF//Rj8raCqptZLMX6rkdfZ8C2Jsw5hU4PrmuCzBk6A==
+
 "@lerna/create@8.2.4":
   version "8.2.4"
   resolved "https://registry.npmjs.org/@lerna/create/-/create-8.2.4.tgz#59a050f58681e9236db38cc5bcc6986ae79d1389"
@@ -6367,10 +6380,10 @@ code-block-writer@^13.0.3:
   resolved "https://registry.npmjs.org/code-block-writer/-/code-block-writer-13.0.3.tgz#90f8a84763a5012da7af61319dd638655ae90b5b"
   integrity sha512-Oofo0pq3IKnsFtuHqSF7TqBfr71aeyZDVJ0HpmqB7FBM2qEigL0iPONSCZSO9pE9dZTAxANe5XHG9Uy0YMv8cg==
 
-codemaker@^1.139.0:
-  version "1.139.0"
-  resolved "https://registry.npmjs.org/codemaker/-/codemaker-1.139.0.tgz#708560424f1d1feb73e6c22cf0ebbd3c97616e22"
-  integrity sha512-v93CwWcepdmHDENEJuPepaOzo2J8SZ5HKNVgH/+6vPrvLOoDDfVXEkBMr6KUu4trHN7QvZjFwxJBpjCYCBG9+g==
+codemaker@^1.140.0:
+  version "1.140.0"
+  resolved "https://registry.npmjs.org/codemaker/-/codemaker-1.140.0.tgz#aac0ea372f982e911299e25480a681fc366b899a"
+  integrity sha512-/EPlxI+2i9ji7aZac2kLEUyjzfgHWBl8hDZ98T6BnED9mTLRInCNToA0vqgZPcTotiP6g6YNeZo7cBAc90Ok9A==
   dependencies:
     camelcase "^6.3.0"
     decamelize "^5.0.1"
@@ -9819,46 +9832,46 @@ jsesc@^3.0.2:
   resolved "https://registry.npmjs.org/jsesc/-/jsesc-3.1.0.tgz#74d335a234f67ed19907fdadfac7ccf9d409825d"
   integrity sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==
 
-jsii-diff@1.139.0:
-  version "1.139.0"
-  resolved "https://registry.npmjs.org/jsii-diff/-/jsii-diff-1.139.0.tgz#9d41f0ca95ec5651f79d72356344864562eeb6fe"
-  integrity sha512-ApfAu+R8RvdiIhw+9afwW6U9/1TJTa082ePDqiR3Jl60oMCdbsr0aIKHdCerKnmtJU1CvSh/iTupMs0Eix0LUw==
+jsii-diff@1.140.0:
+  version "1.140.0"
+  resolved "https://registry.npmjs.org/jsii-diff/-/jsii-diff-1.140.0.tgz#fb64a471643673bc611dbcf4882e37445c2dd34b"
+  integrity sha512-nK6y3X08YDt7hrkgl45gn9uzQFioqeBLXwj/OZ1AyeejvvPQJvaNuIogRdrfjBuNuksjnQlW/RJk8ocgzaXCvA==
   dependencies:
-    "@jsii/check-node" "1.139.0"
-    "@jsii/spec" "1.139.0"
+    "@jsii/check-node" "1.140.0"
+    "@jsii/spec" "1.140.0"
     fs-extra "^10.1.0"
-    jsii-reflect "^1.139.0"
+    jsii-reflect "^1.140.0"
     log4js "^6.9.1"
     yargs "^17.7.3"
 
-jsii-pacmak@1.139.0:
-  version "1.139.0"
-  resolved "https://registry.npmjs.org/jsii-pacmak/-/jsii-pacmak-1.139.0.tgz#1a8bd1e8601b7bfdcd1e99cfc2bf6c3dba3ee646"
-  integrity sha512-hE+rc+RS4Qwe+MzGqG515tXueOhn6r++/L8kpX5wT18HqUoBJdOdqFOv90PYitDgNywovOE0kEd8YyV1S5Mh6Q==
+jsii-pacmak@1.140.0:
+  version "1.140.0"
+  resolved "https://registry.npmjs.org/jsii-pacmak/-/jsii-pacmak-1.140.0.tgz#137cd513229177384b2715374959bf2e582cc858"
+  integrity sha512-BHv63POC099uGm08UM7L5UZUanN3rfESzWv54xpwhamiIJ+zlw0+6Sj790LP2skRkezTdTj8Qj6mhU5Kxfko7g==
   dependencies:
-    "@jsii/check-node" "1.139.0"
-    "@jsii/spec" "1.139.0"
+    "@jsii/check-node" "1.140.0"
+    "@jsii/spec" "1.140.0"
     clone "^2.1.2"
-    codemaker "^1.139.0"
+    codemaker "^1.140.0"
     commonmark "^0.31.2"
     escape-string-regexp "^4.0.0"
```

---

### Incident Patch 6: `f482f4f3` (2026-09-24)
**Commit Message**: fix(ecs): support digest references in TagParameterContainerImage via imageDigest option (#37868)

Closes #37718.

Credit to @nguyengg for filing this with a clear diagnosis, and to @pahud for the key insight that `repositoryUriForTagOrDigest()` can't be used here because `CfnParameter.valueAsString` is an unresolved CloudFormation token at synth time — the `startsWith('sha256:')` check always fails.

### Reason for this change

`TagParameterContainerImage.bind()` always calls `repositoryUriForTag()`, which produces a colon separator between the repository URI and the parameter value. When the parameter holds a digest (`sha256:...`), the correct separator is `@`. The naive fix of switching to `repositoryUriForTagOrDigest()` doesn't work because that method resolves the tag/digest at synth time using `startsWith('sha256:')`, but `CfnParameter.valueAsString` is an unresolved token — so it always falls through to the tag path.

### Description of changes

Adds an optional `imageDigest?: boolean` prop to `TagParameterContainerImage` (default: `false`, fully backward-compatible). When `true`, `bind()` calls `repositoryUriForDigest()` instead of `repositoryUriForTag()`, producing the cor

**File**: `packages/aws-cdk-lib/aws-ecs/lib/images/tag-parameter-container-image.ts` (modified, +27/-6)
```diff
@@ -6,35 +6,56 @@ import type { ContainerDefinition } from '../container-definition';
 import type { ContainerImageConfig } from '../container-image';
 import { ContainerImage } from '../container-image';
 
+/**
+ * Properties for `TagParameterContainerImage`.
+ */
+export interface TagParameterContainerImageProps {
+  /**
+   * Whether the CloudFormation Parameter holds an image digest (`sha256:...`) rather than a tag.
+   *
+   * When `true`, the separator between the repository URI and the parameter value is `@`
+   * instead of `:`, producing `ACCOUNT.dkr.ecr.REGION.amazonaws.com/REPO@sha256:...`.
+   *
+   * Use this when your pipeline passes a digest rather than a mutable tag.
+   *
+   * @default false
+   */
+  readonly isImageDigest?: boolean;
+}
+
 /**
  * A special type of `ContainerImage` that uses an ECR repository for the image,
- * but a CloudFormation Parameter for the tag of the image in that repository.
- * This allows providing this tag through the Parameter at deploy time,
+ * but a CloudFormation Parameter for the tag or digest of the image in that repository.
+ * This allows providing this tag or digest through the Parameter at deploy time,
  * for example in a CodePipeline that pushes a new tag of the image to the repository during a build step,
  * and then provides that new tag through the CloudFormation Parameter in the deploy step.
  *
  * @see #tagParameterName
  */
 export class TagParameterContainerImage extends ContainerImage {
   private readonly repository: ecr.IRepository;
+  private readonly isImageDigest: boolean;
   private imageTagParameter?: cdk.CfnParameter;
 
-  public constructor(repository: ecr.IRepository) {
+  public constructor(repository: ecr.IRepository, props: TagParameterContainerImageProps = {}) {
     super();
     this.repository = repository;
+    this.isImageDigest = props.isImageDigest ?? false;
   }
 
   public bind(scope: Construct, containerDefinition: ContainerDefinition): ContainerImageConfig {
     this.repository.grantPull(containerDefinition.taskDefinition.obtainExecutionRole());
     const imageTagParameter = new cdk.CfnParameter(scope, 'ImageTagParam');
     this.imageTagParameter = imageTagParameter;
     return {
-      imageName: this.repository.repositoryUriForTag(imageTagParameter.valueAsString),
+      imageName: this.isImageDigest
+        ? this.repository.repositoryUriForDigest(imageTagParameter.valueAsString)
+        : this.repository.repositoryUriForTag(imageTagParameter.valueAsString),
     };
   }
 
   /**
-   * Returns the name of the CloudFormation Parameter that represents the tag of the image
+   * Returns the name of the CloudFormation Parameter that represents the tag or digest of the image
    * in the ECR repository.
    */
   public get tagParameterName(): string {
@@ -50,7 +71,7 @@ export class TagParameterContainerImage extends ContainerImage {
   }
 
   /**
-   * Returns the value of the CloudFormation Parameter that represents the tag of the image
+   * Returns the value of the CloudFormation Parameter that represents the tag or digest of the image
    * in the ECR repository.
    */
   public get tagParameterValue(): string {
```

**File**: `packages/aws-cdk-lib/aws-ecs/test/images/tag-parameter-container-image.test.ts` (modified, +62/-0)
```diff
@@ -33,6 +33,68 @@ describe('tag parameter container image', () => {
       }).toThrow(/TagParameterContainerImage must be used in a container definition when using tagParameterValue/);
     });
 
+    test('synthesizes image URI with ":" separator for tag (default)', () => {
+      // GIVEN
+      const stack = new cdk.Stack();
+      const repository = new ecr.Repository(stack, 'Repository');
+      const tagParameterContainerImage = new ecs.TagParameterContainerImage(repository);
+      const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');
+
+      // WHEN
+      taskDefinition.addContainer('Container', { image: tagParameterContainerImage });
+
+      // THEN — Image URI must use ":" between repo URI and tag parameter
+      Template.fromStack(stack).hasResourceProperties('AWS::ECS::TaskDefinition', {
+        ContainerDefinitions: Match.arrayWith([
+          Match.objectLike({
+            Image: {
+              'Fn::Join': ['', Match.arrayWith([':'])],
+            },
+          }),
+        ]),
+      });
+      Template.fromStack(stack).hasResourceProperties('AWS::ECS::TaskDefinition', {
+        ContainerDefinitions: Match.arrayWith([
+          Match.objectLike({
+            Image: Match.not({
+              'Fn::Join': ['', Match.arrayWith(['@'])],
+            }),
+          }),
+        ]),
+      });
+    });
+
+    test('synthesizes image URI with "@" separator when isImageDigest is true', () => {
+      // GIVEN
+      const stack = new cdk.Stack();
+      const repository = new ecr.Repository(stack, 'Repository');
+      const tagParameterContainerImage = new ecs.TagParameterContainerImage(repository, { isImageDigest: true });
+      const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');
+
+      // WHEN
+      taskDefinition.addContainer('Container', { image: tagParameterContainerImage });
+
+      // THEN — Image URI must use "@" between repo URI and digest parameter
+      Template.fromStack(stack).hasResourceProperties('AWS::ECS::TaskDefinition', {
+        ContainerDefinitions: Match.arrayWith([
+          Match.objectLike({
+            Image: {
+              'Fn::Join': ['', Match.arrayWith(['@'])],
+            },
+          }),
+        ]),
+      });
+      Template.fromStack(stack).hasResourceProperties('AWS::ECS::TaskDefinition', {
+        ContainerDefinitions: Match.arrayWith([
+          Match.objectLike({
+            Image: Match.not({
+              'Fn::Join': ['', Match.arrayWith([':'])],
+            }),
+          }),
+        ]),
+      });
+    });
+
     test('can be used in a cross-account manner', () => {
       // GIVEN
       const app = new cdk.App();
```

---

### Incident Patch 7: `600ffc86` (2026-09-24)
**Commit Message**: fix: telemetry numbers don't allow making a good model for synth time yet (#38889)

We can't find a good (linear?) correlation between number of stacks and synth time from the numbers we are seeing. Add the number of constructs, to see if we can find a better correlation that way.

----

*By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license*

**File**: `packages/aws-cdk-lib/core/lib/app.ts` (modified, +18/-0)
```diff
@@ -2,6 +2,7 @@ import { performance } from 'perf_hooks';
 import type { Construct, IConstruct } from 'constructs';
 import * as fs from 'fs-extra';
 import { readPerfCounters, recordPerformanceEntry, resetCounters } from './helpers-internal';
+import { iterateDfsPreorder } from './private/construct-iteration';
 import { PRIVATE_CONTEXT_DEFAULT_STACK_SYNTHESIZER } from './private/private-context';
 import type { ICustomSynthesis } from './private/synthesis';
 import { addCustomSynthesis } from './private/synthesis';
@@ -328,6 +329,15 @@ export class App extends Stage {
 
     const totalAppTimeMs = performance.now() - this.initMark;
     const stackCount = ret.stacksRecursively.length;
+
+    // Record how many constructs we had to iterate over to synthesize the app, to get a sense for
+    // how synthesis time scales with number of constructs.
+    recordPerformanceEntry('count:Constructs', {
+      count: countConstructs(this),
+      durationMs: 0,
+      telemetry: true,
+    });
+
     if (this.shouldReportSlowSynth(totalAppTimeMs / stackCount)) {
       emitPerformanceCountersFile();
     }
@@ -355,6 +365,14 @@ export class App extends Stage {
   }
 }
 
+function countConstructs(construct: IConstruct): number {
+  let ret = 0;
+  for (const _ of iterateDfsPreorder(construct)) {
+    ret++;
+  }
+  return ret;
+}
+
 /**
  * Add a custom synthesis for the given construct
  *
```

**File**: `packages/aws-cdk-lib/core/test/app.test.ts` (modified, +30/-0)
```diff
@@ -422,6 +422,36 @@ describe('app', () => {
       delete process.env[cxapi.PERF_COUNTERS_FILE_ENV];
     }
   });
+
+  test('App performance counters include stack and construct counts', () => {
+    // GIVEN
+    const countersDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-counters'));
+    const countersFile = path.join(countersDir, 'counters.json');
+    process.env[cxapi.PERF_COUNTERS_FILE_ENV] = countersFile;
+    try {
+      // WHEN
+      const app = new App({
+        outdir: countersDir,
+        context: {
+          '@aws-cdk/core.slowSynthThreshold': 0,
+        },
+      });
+      const stack1 = new Stack(app, 'Stack1');
+      new CfnResource(stack1, 'Resource1', { type: 'AWS::Test::Resource' });
+      const stack2 = new Stack(app, 'Stack2');
+      new CfnResource(stack2, 'Resource2', { type: 'AWS::Test::Resource' });
+      new Construct(stack2, 'PlainConstruct');
+      app.synth();
+
+      // THEN
+      const counters = JSON.parse(fs.readFileSync(countersFile, 'utf-8')).counters;
+      // App + Tree + Stack1 + Resource1 + Stack2 + Resource2 + PlainConstruct = at least 7
+      expect(counters['count:Constructs(cnt)']).toBeGreaterThanOrEqual(7);
+    } finally {
+      fs.rmSync(countersDir, { force: true, recursive: true });
+      delete process.env[cxapi.PERF_COUNTERS_FILE_ENV];
+    }
+  });
 });
 
 class MyConstruct extends Construct {
```

---

### Incident Patch 8: `da682989` (2026-09-24)
**Commit Message**: feat: render property traces with 'cdk --debug' (#38844)

If `CDK_DEBUG=true` (set when `cdk --debug[-app]` is used during
synthesis), we capture stack traces when CloudFormation Resource
properties are being mutated in addition to when constructs are being
created.

These stack traces are now linked to findings reported by the
`CloudFormationValidatePlugin`, so that if that plugin reports
a problem with a property we will tell users all the locations where
that property is being populated.

Print all the locations that might be relevant to a finding when we print the report.

----

*By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license*

**File**: `packages/aws-cdk-lib/assertions/lib/helpers-internal/assembly-validation-report.ts` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ export class AssemblyValidationReport {
     return new AssemblyValidationReport(newReport);
   }
 
-  private constructor(private readonly report: PolicyValidationReportJson) {
+  private constructor(public readonly report: PolicyValidationReportJson) {
   }
 
   public pluginReport(pluginName: string) {
```

**File**: `packages/aws-cdk-lib/aws-s3/test/validation.test.ts` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+// Test property validation source attribution, by means of the S3 construct
+
+import { AssemblyValidationReport } from '../../assertions/lib/helpers-internal';
+import type { PropertyMutationMetadataEntry } from '../../cloud-assembly-schema';
+import { App, Stack } from '../../core';
+import type { StackFrameFinder } from '../../core/lib/private/stack-trace';
+import { formatValidationReports, stripAnsi } from '../../core/lib/validation/private/modern-formatter';
+import type { CloudFormationStackArtifact } from '../../cx-api';
+import * as s3 from '../lib';
+
+let app: App;
+let stack: Stack;
+beforeEach(() => {
+  process.env.CDK_DEBUG = 'true';
+  app = new App({
+    postCliContext: AssemblyValidationReport.APP_CONTEXT,
+  });
+  stack = new Stack(app, 'Stack');
+});
+
+function createFineBucket() {
+  return new s3.Bucket(stack, 'MyBucket', {
+    abacStatus: true,
+  });
+}
+
+test('invalid properties can be attributed to a construct mutation, not just creation', () => {
+  function addLifecycleRule1(b: s3.Bucket) {
+    b.addLifecycleRule({
+      id: 'asdf',
+      noncurrentVersionsToRetain: 0,
+    });
+  }
+  // WHEN
+  const b = createFineBucket();
+  addLifecycleRule1(b);
+
+  // THEN - we have different stack traces for the abacStatus and the lifecycle rule's ID,
+  // and they contain the function names that we defined above.
+  const asm = app.synth();
+  const art = asm.getStackByName(stack.stackName);
+  const creationStack = readCreationStack(art, '/Stack/MyBucket/Resource');
+  const propertyAssignments = readPropertyAssignments(art, '/Stack/MyBucket/Resource');
+
+  expect(creationStack).toContainEqual(expect.stringContaining('createFineBucket'));
+  expect(propertyAssignments[0]).toMatchObject({
+    propertyName: 'LifecycleConfiguration',
+    stackTrace: expect.arrayContaining([expect.stringContaining('addLifecycleRule1')]),
+  });
+});
+
+test('invalid properties are attributed to the correct code line', () => {
+  function addTooLongLifecycleRule(b: s3.Bucket) {
+    b.addLifecycleRule({
+      id: 'x'.repeat(300), // invalid, too long
+      noncurrentVersionsToRetain: 0,
+    });
+  }
+
+  function addCorrectLifecycleRule(b: s3.Bucket) {
+    b.addLifecycleRule({ id: 'y', noncurrentVersionsToRetain: 0 });
+  }
+
+  // WHEN
+  const b = createFineBucket();
+  addTooLongLifecycleRule(b);
+  addCorrectLifecycleRule(b);
+
+  // THEN - the validation error should BOTH point to where the bucket was
+  // created, as well as where the lifecycle rules were mutated
+  const report = AssemblyValidationReport.fromApp(app);
+  const violatingConstruct = report.allViolations()
+    .filter(v => v.ruleName === 'F3033')
+    .flatMap(v => v.violatingConstructs)
+    [0];
+
+  expect(violatingConstruct).toMatchObject({
+    constructPath: 'Stack/MyBucket/Resource',
+    cloudFormationResource: {
+      propertyPaths: ['Properties.LifecycleConfiguration.Rules.0.Id'],
+    },
+    stackTraces: expect.arrayContaining([
+      expect.stringContaining('createFineBucket'),
+      expect.stringContaining('addTooLongLifecycleRule'),
+      expect.stringContaining('addCorrectLifecycleRule'),
+    ]),
+  });
+
+  // AND they are all rendered.
+  // Use a custom StackFrameFinder to make sure we only render the test frames, ignoring those
+  // from the CDK library itself.
+  const finder: StackFrameFinder = {
+    isUserCodeFrame(frame) {
+      return !frame.includes('/lib/');
+    },
+  };
+
+  const reportText = stripAnsi(formatValidationReports(__dirname, report.report.pluginReports, finder).join('\n'));
+  expect(reportText).toMatchInlineSnapshot(`
+"validation.test.ts:22:10
+or validation.test.ts:54:7
+or validation.test.ts:61:7
+WARNING LifecycleConfiguration.Rules.0.Id: length 300 exceeds maximum 255 (CloudFormation Validate)
+   Stack/MyBucket/Resource (MyBucketF68F3FF0) constructs.Construct
+   Acknowledge with 'CloudFormation-Validate::F3033'"
+`);
+});
+
+function readCreationStack(art: CloudF
```

**File**: `packages/aws-cdk-lib/core/lib/cfn-resource.ts` (modified, +1/-1)
```diff
@@ -776,6 +776,6 @@ export function traceProperty(node: Node, propertyName: string) {
     node.addMetadata(cxschema.ArtifactMetadataEntryType.PROPERTY_ASSIGNMENT, {
       propertyName,
       stackTrace: captureStackTrace(traceProperty),
-    });
+    } satisfies cxschema.PropertyMutationMetadataEntry);
   }
 }
```

**File**: `packages/aws-cdk-lib/core/lib/helpers-internal/box.ts` (modified, +9/-8)
```diff
@@ -1,3 +1,4 @@
+/* eslint-disable @typescript-eslint/unbound-method */
 import { debugModeEnabled } from '../debug';
 import { captureStackTrace } from '../private/stack-trace';
 import type { IResolvable, IResolveContext } from '../resolvable';
@@ -582,7 +583,7 @@ class State<A> extends ReadonlyState<A> implements IBox<A> {
       return;
     }
     if (debugModeEnabled() && stackTraceCollectionEnabled) {
-      this.orderedTraces = [{ trace: captureStackTrace(this.set.bind(this)), seq: globalSeq++ }];
+      this.orderedTraces = [{ trace: captureStackTrace(State.prototype.set), seq: globalSeq++ }];
     }
     this.value = value;
   }
@@ -611,12 +612,12 @@ class ArrayState<A> extends State<Array<A>> implements IArrayBox<A> {
 
   public push(...items: A[]): void {
     this.array.push(...items);
-    this.appendTrace(() => captureStackTrace(this.push.bind(this)));
+    this.appendTrace(() => captureStackTrace(ArrayState.prototype.push));
   }
 
   public pop(): A | undefined {
     const result = this.array.pop();
-    this.appendTrace(() => captureStackTrace(this.pop.bind(this)));
+    this.appendTrace(() => captureStackTrace(ArrayState.prototype.pop));
     return result;
   }
 
@@ -634,7 +635,7 @@ class ArrayState<A> extends State<Array<A>> implements IArrayBox<A> {
 
   public splice(start: number, deleteCount: number, ...items: A[]): A[] {
     const result = this.array.splice(start, deleteCount, ...items);
-    this.appendTrace(() => captureStackTrace(this.splice.bind(this)));
+    this.appendTrace(() => captureStackTrace(ArrayState.prototype.splice));
     return result;
   }
 
@@ -681,12 +682,12 @@ class MapState<K, V> extends State<Map<K, V>> implements IMapBox<K, V> {
 
   public put(key: K, value: V): void {
     this.map.set(key, value);
-    this.appendTrace(() => captureStackTrace(this.put.bind(this)));
+    this.appendTrace(() => captureStackTrace(MapState.prototype.put));
   }
 
   public delete(key: K): boolean {
     const result = this.map.delete(key);
-    this.appendTrace(() => captureStackTrace(this.delete.bind(this)));
+    this.appendTrace(() => captureStackTrace(MapState.prototype.delete));
     return result;
   }
 
@@ -741,12 +742,12 @@ class SetState<A> extends State<Set<A>> implements ISetBox<A> {
 
   public add(value: A): void {
     this._set.add(value);
-    this.appendTrace(() => captureStackTrace(this.add.bind(this)));
+    this.appendTrace(() => captureStackTrace(SetState.prototype.add));
   }
 
   public delete(value: A): boolean {
     const result = this._set.delete(value);
-    this.appendTrace(() => captureStackTrace(this.delete.bind(this)));
+    this.appendTrace(() => captureStackTrace(SetState.prototype.delete));
     return result;
   }
 
```

**File**: `packages/aws-cdk-lib/core/lib/no-box-stack-traces.ts` (modified, +3/-3)
```diff
@@ -36,7 +36,7 @@ type ArbitraryConstructor = (abstract new (...args: any[]) => {}) | (new (...arg
  * ```
  */
 export function noBoxStackTraces<T extends ArbitraryConstructor>(constructor: T): T {
-  const WrappedClass = class extends constructor {
+  const NoBoxStackTraces = class extends constructor {
     constructor(...args: any[]) {
       Box.disableStackTraceCollection();
       try {
@@ -46,9 +46,9 @@ export function noBoxStackTraces<T extends ArbitraryConstructor>(constructor: T)
       }
     }
   };
-  Object.defineProperty(WrappedClass, 'name', {
+  Object.defineProperty(NoBoxStackTraces, 'name', {
     value: constructor.name,
     writable: false,
   });
-  return WrappedClass as any;
+  return NoBoxStackTraces as any;
 }
```

---

### Incident Patch 9: `9bbce929` (2026-09-21)
**Commit Message**: docs(ec2): fix default description for VpcEndPointServiceProps.allowedRegions (#37301)

…dRegions

### Issue # (if applicable)

Closes #<issue number here>.

### Reason for this change

The @default for `allowedRegions` says "No region restrictions" but the actual AWS Behavior when Supported Regions is not set is a local-region-only access. Cross-region PrivateLink was launched in Nov 2024 and requires explicitly listing supported regions. 

https://aws.amazon.com/blogs/networking-and-content-delivery/introducing-cross-region-connectivity-for-aws-privatelink/

### Description of changes

Updated documentation to be accurate to avoid consumers incorrectly assuming default allowed regions allows all regions to access.

### Describe any new or updated permissions being added

N/A


### Description of how you validated changes

Deployed with the value not set to validate only that region was permitted. Simple text change

### Checklist
- [ x] My code adheres to the [CONTRIBUTING GUIDE](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md) and [DESIGN GUIDELINES](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)

----

*By submitting this pull request, I confirm th

**File**: `packages/aws-cdk-lib/aws-ec2/lib/vpc-endpoint-service.ts` (modified, +1/-1)
```diff
@@ -247,7 +247,7 @@ export interface VpcEndpointServiceProps {
 
   /**
    * The Regions from which service consumers can access the service.
-   * @default - No Region restrictions
+   * @default - the region hosting the service only
    */
   readonly allowedRegions?: string[];
 }
```

---

### Incident Patch 10: `6eb07ddd` (2026-09-21)
**Commit Message**: fix: validating CloudAssembly throws `Invalid URL` error (#38867)

### Issue # (if applicable)

N/A

### Reason for this change

From Node.js 24.20.0 onwards, a new URL parser is used that implements the WHATWG URL spec more strictly. `aws-cdk-lib/cloud-assembly-schema` ships with a feature that allows validation of a produced CloudAssembly. This schema validator had bug which is now starting to fail in the most recent Node.js version.

More details in https://github.com/aws/aws-cdk-cli/pull/1945

### Description of changes

Since the validator is introduced via `@aws-cdk/cloud-assembly-schema` (with `aws-cdk-lib` re-exporting it for backwards-compatiblity reasons), updating the dependency resolves the issue. Also removed a reference to a non existent helper script.

### Describe any new or updated permissions being added

n/a

### Description of how you validated changes

Tested upstream, this is a mechanical dependency upgrade.

### Checklist
- [x] My code adheres to the [CONTRIBUTING GUIDE](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md) and [DESIGN GUIDELINES](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)

----

*By submitting this pull request, 

**File**: `packages/@aws-cdk/cx-api/package.json` (modified, +2/-2)
```diff
@@ -84,12 +84,12 @@
     "@aws-cdk/cloud-assembly-api": "^2.2.6"
   },
   "peerDependencies": {
-    "@aws-cdk/cloud-assembly-schema": ">=53.25.0"
+    "@aws-cdk/cloud-assembly-schema": ">=54.24.0"
   },
   "license": "Apache-2.0",
   "devDependencies": {
     "@aws-cdk/cdk-build-tools": "0.0.0",
-    "@aws-cdk/cloud-assembly-schema": "^54.11.0",
+    "@aws-cdk/cloud-assembly-schema": "^54.24.0",
     "@aws-cdk/pkglint": "0.0.0",
     "@types/jest": "^29.5.14",
     "@types/mock-fs": "^4.13.4",
```

**File**: `packages/aws-cdk-lib/package.json` (modified, +1/-2)
```diff
@@ -21,7 +21,6 @@
     "build+test+package": "yarn build+test && yarn package",
     "watch": "cdk-watch",
     "compat": "cdk-compat",
-    "update-schema": "bash cloud-assembly-schema/scripts/update-schema.sh",
     "rosetta:extract": "yarn --silent jsii-rosetta extract",
     "build+extract": "yarn build && yarn rosetta:extract",
     "build+test+extract": "yarn build+test && yarn rosetta:extract",
@@ -121,7 +120,7 @@
     "@aws-cdk/asset-awscli-v1": "2.2.292",
     "@aws-cdk/asset-node-proxy-agent-v6": "^2.1.2",
     "@aws-cdk/cloud-assembly-api": "^2.2.6",
-    "@aws-cdk/cloud-assembly-schema": "^54.11.0",
+    "@aws-cdk/cloud-assembly-schema": "^54.24.0",
     "@aws/cloudformation-validate": "1.9.0-beta",
     "@balena/dockerignore": "^1.0.2",
     "case": "1.6.3",
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -74,10 +74,10 @@
     jsonschema "^1.5.0"
     semver "^7.8.4"
 
-"@aws-cdk/cloud-assembly-schema@^54.11.0":
-  version "54.11.0"
-  resolved "https://registry.npmjs.org/@aws-cdk/cloud-assembly-schema/-/cloud-assembly-schema-54.11.0.tgz#610db94722d1a4a5d5629522e931ebb0937d44be"
-  integrity sha512-qpkGINVp8CIaXXkEX5sPmARPk8bbvCFXhMHm/Nmae3K3V+OzDVthntuFVwGxl/jzfdrKPIhbkE9Mrxk+f1mK3A==
+"@aws-cdk/cloud-assembly-schema@^54.24.0":
+  version "54.24.0"
+  resolved "https://registry.npmjs.org/@aws-cdk/cloud-assembly-schema/-/cloud-assembly-schema-54.24.0.tgz#ad24c3de22e695a1579ecc4c2f9d46e8c8ed86ec"
+  integrity sha512-9sH1pBpWuqZR/9rYAveNi62B/jDrc9BNOL83alD/wtIUSbRkg1aj6JX2r1cSugQwLBjCizQscQZgAb5wWnTTMg==
   dependencies:
     jsonschema "^1.5.0"
     semver "^7.8.5"
```

#### Recent Merged Pull Requests:
- **PR #38936** (2026-09-30): chore(merge-back): 2.272.0 (@aws-cdk-automation)
- **PR #38931** (2026-09-30): chore(release): 2.272.0 (@aws-cdk-automation)
- **PR #38925** (2026-09-29): chore(deps): bump ip-address from 10.4.0 to 10.7.2 in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #38923** (2026-09-29): chore: update cdk-generate-synthetic-examples to 0.2.58 (@gasolima)
- **PR #38919** (2026-09-29): chore(bedrock): add Claude Sonnet 5.5, Opus 5.5 and Fable 5.1 foundation models (@lazerg)
- **PR #38907** (2026-09-28): chore(deps): bump dawidd6/action-download-artifact from 24 to 25 (@dependabot[bot])
- **PR #38896** (2026-09-25): chore(merge-back): 2.271.0 (@aws-cdk-automation)
- **PR #38895** (2026-09-28): test(lambda-python): stub DockerImage.fromBuild so bundling unit tests never invoke docker (@matboros)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
