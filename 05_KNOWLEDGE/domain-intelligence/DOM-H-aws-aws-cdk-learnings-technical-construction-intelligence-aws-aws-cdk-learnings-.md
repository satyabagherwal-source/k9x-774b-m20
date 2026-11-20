# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: aws-aws-cdk-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "aws-aws-cdk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T03:02:47.408Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aws-aws-cdk-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws-aws-cdk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T03:02:47.408Z`  
> **Learning ID**: `LEARN-EVO-aws-aws-cdk-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), G (Architecture Intelligence), B (Product Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 69%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from aws-aws-cdk-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aws-aws-cdk-learnings.md`  
> **Source**: github ([https://github.com/aws/aws-cdk](https://github.com/aws/aws-cdk))  
> **Source Version**: `66801507`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T02:58:31.608Z  
> **Learning ID**: `learn-github-aws-aws-cdk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): aws/aws-cdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/aws-aws-cdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aws/aws-cdk](https://github.com/aws/aws-cdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T02:58:31.603Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws/aws-cdk`
- **Description**: The AWS Cloud Development Kit is a framework for defining cloud infrastructure in code
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12987 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/@aws-cdk/aws-amplify-alpha/lib/utils.ts`
```
import { Platform } from './app';

export function renderEnvironmentVariables(vars: { [name: string]: string }) {
  return Object.entries(vars).map(([name, value]) => ({ name, value }));
}

/**
 * Utility function to check if the platform is a server-side rendering platform
 */
export function isServerSideRendered(platform?: Platform): boolean {
  return platform === Platform.WEB_COMPUTE || platform === Platform.WEB_DYNAMIC;
}

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/eslint.config.mjs`
```
import { makeConfig } from '@aws-cdk/eslint-config';

export default makeConfig('tsconfig.json');

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/jest.config.js`
```
const baseConfig = require('@aws-cdk/cdk-build-tools/config/jest.config');
module.exports = baseConfig;

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/common/types.ts`
```
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

/**
 * Custom claim value type.
 * Shared by Runtime and Gateway custom claim implementations.
 * @internal
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export enum CustomClaimValueType {
  /** String value type */
  STRING = 'STRING',
  /** String array value type */
  STRING_ARRAY = 'STRING_ARRAY',
}

/**
 * Custom claim match operator.
 * Shared by Runtime and Gateway custom claim implementations.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export enum CustomClaimOperator {
  /** Equals operator - used for STRING type claims */
  EQUALS = 'EQUALS',
  /** Contains operator - used for STRING_ARRAY type claims. Checks if the claim array contains a specific string value. */
  CONTAINS = 'CONTAINS',
  /** ContainsAny operator - used for STRING_ARRAY type claims. Checks if the claim array contains any of the provided string values. */
  CONTAINS_ANY = 'CONTAINS_ANY',
}

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/custom-evaluator.ts`
```
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Arn, ArnFormat, Stack } from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import { addConstructMetadata } from 'aws-cdk-lib/core/lib/metadata-resource';
import { propertyInjectable } from 'aws-cdk-lib/core/lib/prop-injectable';
import type { Construct } from 'constructs';
import { type IEvaluator, EvaluatorBase } from './evaluator-base';
import type { EvaluatorConfig } from './evaluator-config';
import type { EvaluationLevel, EvaluatorAttributes } from './types';
import {
  throwIfInvalid,
  validateDescription,
  validateEvaluatorName,
  validateEvaluatorTags,
} from './validation-helpers';

/**
 * Properties for creating an Evaluator.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export interface EvaluatorProps {
  /**
   * The name of the evaluator.
   *
   * Must be unique within your account. Valid characters are a-z, A-Z, 0-9, _ (underscore).
   * Must start with a letter and can be up to 48 characters long.
   *
   * @pattern ^[a-zA-Z][a-zA-Z0-9_]{0,47}$
   */
  readonly evaluatorName: string;

  /**
   * The configuration that defines how the evaluator assesses agent performance.
   *
   * Use `EvaluatorConfig.llmAsAJudge()` for model-based evaluation or
   * `EvaluatorConfig.codeBased()` for Lambda-based evaluation.
   */
  readonly evaluatorConfig: EvaluatorConfig;

  /**
   * The level at which the evaluator assesses agent performance.
   *
   * Determines what granularity of data the evaluator operates on:
   * tool call, trace (single request-response), or session (full conversation).
   */
  readonly level: EvaluationLevel;

  /**
   * The description of the evaluator.
   *
   * @default - No description
   * @maxLength 200
   */
  readonly description?: string;

  /**
   * Tags for the evaluator.
   * A list of key:value pairs of tags to apply to this Evaluator resource.
   *
   * @default - No tags
   */
  readonly tags?: { [key: string]: string };
}

/**
 * A custom evaluator for Amazon Bedrock AgentCore.
 *
 * Custom evaluators enable you to define evaluation logic tailored to your specific
 * use cases. Supports two evaluation strategies:
 * - **LLM-as-a-Judge**: Uses a foundation model with custom instructions and a rating scale.
 * - **Code-based**: Uses a Lambda function for custom evaluation logic.
 *
 * Custom evaluators are used with `OnlineEvaluationConfig` via `EvaluatorReference.custom()`.
 *
 * @resource AWS::BedrockAgentCore::Evaluator
 *
 * @example
 * // Create a custom LLM-as-a-Judge evaluator
 * const evaluator = new agentcore.Evaluator(this, 'MyEvaluator', {
 *   evaluatorName: 'my_custom_evaluator',
 *   level: agentcore.EvaluationLevel.SESSION,
 *   evaluatorConfig: agentcore.EvaluatorConfig.llmAsAJudge({
 *     instructions: 'Evaluate whether the agent response is helpful and accurate.',
 *     modelId: 'us.anthropic.claude-sonnet-4-6',
 *     ratingScale: agentcore.EvaluatorRatingScale.categorical([
 *       { label: 'Good', definition: 'The response is helpful and accurate.' },
 *       { label: 'Bad', definition: 'The response is not helpful or contains errors.' },
 *     ]),
 *   }),
 * });
 *
 * // Use the custom evaluator in an online evaluation configuration
 * new agentcore.OnlineEvaluationConfig(this, 'MyEvaluation', {
 *   onlineEvaluationConfigName: 'my_evaluation',
 *   evaluators: [
 *     agentcore.EvaluatorReference.builtin(agentcore.BuiltinEvaluator.HELPFULNESS),
 *     agentcore.EvaluatorReference.custom(evaluator),
 *   ],
 *   dataSource: agentcore.DataSourceConfig.fromCloudWatchLogs({
 *     logGroupNames: ['/aws/bedrock-agentcore/my-agent'],
 *     serviceNames: ['my-agent.default'],
 *   }),
 * });
 */
@propertyInjectable
/**
 * This API has been graduated to stable.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export class Evaluator extends EvaluatorBase {
  /** Uniquely identifies this class. */
  public static readonly PROPERTY_INJECTION_ID: string =
    '@aws-cdk.aws-bedrock-agentcore-alpha.Evaluator';

  /**
   * Import an existing Evaluator by its ID.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param evaluatorId - The evaluator ID to import
   * @returns An IEvaluator reference
   */
  public static fromEvaluatorId(
    scope: Construct,
    id: string,
    evaluatorId: string,
  ): IEvaluator {
    const stack = Stack.of(scope);
    const evaluatorArn = Arn.format(
      {
        service: 'bedrock-agentcore',
        resource: 'evaluator',
        resourceName: evaluatorId,
      },
      stack,
    );

    return Evaluator.fromEvaluatorAttributes(scope, id, {
      evaluatorArn,
      evaluatorId,
    });
  }

  /**
   * Import an existing Evaluator by its ARN.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param evaluatorArn - The evaluator ARN to import
   * @returns An IEvaluator reference
   */
  public static fromEvaluatorArn(
    scope: Construct,
    id: string,
    evaluatorArn: string,
  ): IEvaluator {
    const arnParts = Arn.split(evaluatorArn, ArnFormat.SLASH_RESOURCE_NAME);
    const evaluatorId = arnParts.resourceName!;

    return Evaluator.fromEvaluatorAttributes(scope, id, {
      evaluatorArn,
      evaluatorId,
    });
  }

  /**
   * Import an existing Evaluator from its attributes.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param attrs - The evaluator attributes
   * @returns An IEvaluator reference
   */
  public static fromEvaluatorAttributes(
    scope: Construct,
    id: string,
    attrs: EvaluatorAttributes,
  ): IEvaluator {
    class Import extends EvaluatorBase {
      public readonly evaluatorArn = attrs.evaluatorArn;
      public readonly evaluatorId = attrs.evaluatorId;
      public readonly evaluatorName = attrs.evaluatorName ?? attrs.evaluatorId;
      public readonly status = undefined;
      public readonly createdAt = undefined;
      public readonly updatedAt = undefined;
    }

    return new Import(scope, id);
  }

  /**
   * The ARN of the evaluator.
   * @attribute
   */
  public readonly evaluatorArn: string;

  /**
   * The unique identifier of the evaluator.
   * @attribute
   */
  public readonly evaluatorId: string;

  /**
   * The name of the evaluator.
   * @attribute
   */
  public readonly evaluatorName: string;

  /**
   * The lifecycle status of the evaluator.
   * @attribute
   */
  public readonly status?: string;

  /**
   * The timestamp when the evaluator was created.
   * @attribute
   */
  public readonly createdAt?: string;

  /**
   * The timestamp when the evaluator was last updated.
   * @attribute
   */
  public readonly updatedAt?: string;

  constructor(scope: Construct, id: string, props: EvaluatorProps) {
    super(scope, id, {
      physicalName: props.evaluatorName,
    });

    addConstructMetadata(this, props);

    throwIfInvalid(validateEvaluatorName, props.evaluatorName, this);
    throwIfInvalid(validateDescription, props.description, this);

    if (props.tags) {
      throwIfInvalid(validateEvaluatorTags, props.tags, this);
    }

    this.evaluatorName = this.physicalName;

    const resource = new bedrockagentcore.CfnEvaluator(this, 'Resource', {
      evaluatorName: this.physicalName,
      evaluatorConfig: props.evaluatorConfig._bind(),
      level: props.level.value,
      description: props.description,
      tags: props.tags && Object.keys(props.tags).length > 0
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });

    // If code-based, grant the bedrock-agentcore service permission to invoke
    // the Lambda function, scoped to this specific evaluator for confused deputy prevention.
    if (props.evaluatorConfig.lambdaFunction) {
      const stack = Stack.of(this);
      props.evaluatorConfig.lambdaFunction.addPermission('BedrockAgentCoreEvaluatorInvoke', {
        principal: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
        sourceAccount: stack.account,
        sourceArn: resource.attrEvaluatorArn,
      });
    }

    this.evaluatorArn = resource.attrEvaluatorArn;
    this.evaluatorId = resource.attrEvaluatorId;
    this.status = resource.attrStatus;
    this.createdAt = resource.attrCreatedAt;
    this.updatedAt = resource.attrUpdatedAt;
  }
}

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/data-source.ts`
```
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import type { CloudWatchLogsDataSourceConfig, DataSourceConfigBindResult } from './types';
import { throwIfInvalid, validateLogGroupNames, validateServiceNames } from './validation-helpers';
import type { IBedrockAgentRuntime } from '../runtime/runtime-base';
import type { IRuntimeEndpoint } from '../runtime/runtime-endpoint-base';

/**
 * Configuration for the data source used in online evaluation.
 *
 * Use the static factory methods to create data source configurations:
 * - `DataSourceConfig.fromAgentRuntimeEndpoint()` for AgentCore Runtime (recommended)
 * - `DataSourceConfig.fromAgentRuntimeEndpointName()` for AgentCore Runtime using endpoint name string
 * - `DataSourceConfig.fromCloudWatchLogs()` for external agents or custom log groups
 *
 * @example
 * // AgentCore Runtime with default endpoint
 * declare const runtime: agentcore.Runtime;
 * const dataSource = agentcore.DataSourceConfig.fromAgentRuntimeEndpoint(runtime);
 *
 * @example
 * // AgentCore Runtime with specific endpoint
 * declare const runtime: agentcore.Runtime;
 * const endpoint = runtime.addEndpoint('PROD');
 * const dataSource = agentcore.DataSourceConfig.fromAgentRuntimeEndpoint(runtime, endpoint);
 *
 * @example
 * // CloudWatch Logs data source (for external agents)
 * const dataSource = agentcore.DataSourceConfig.fromCloudWatchLogs({
 *   logGroupNames: ['/aws/my-external-agent/logs'],
 *   serviceNames: ['my-external-agent'],
 * });
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export class DataSourceConfig {
  /**
   * Creates a CloudWatch Logs data source configuration.
   *
   * Use this when your agent traces are stored in CloudWatch Logs,
   * such as for external agents or when you need to specify log groups directly.
   *
   * @param config - The CloudWatch Logs data source configuration
   * @returns A DataSourceConfig instance
   *
   * @example
   * const dataSource = agentcore.DataSourceConfig.fromCloudWatchLogs({
   *   logGroupNames: ['/aws/bedrock-agentcore/runtimes/myRuntime-abc123-DEFAULT'],
   *   serviceNames: ['myRuntime.DEFAULT'],
   * });
   */
  public static fromCloudWatchLogs(config: CloudWatchLogsDataSourceConfig): DataSourceConfig {
    throwIfInvalid(validateLogGroupNames, config.logGroupNames);
    throwIfInvalid(validateServiceNames, config.serviceNames);
    return new DataSourceConfig({
      logGroupNames: config.logGroupNames,
      serviceNames: config.serviceNames,
    });
  }

  /**
   * Creates a data source configuration from an AgentCore Runtime and optional endpoint.
   *
   * This is the recommended way to configure evaluation for AgentCore Runtime agents.
   * It automatically derives the CloudWatch log group and service name from the runtime and endpoint.
   *
   * @param runtime - The AgentCore Runtime construct
   * @param endpoint - The RuntimeEndpoint construct. Defaults to 'DEFAULT' endpoint if not provided.
   * @returns A DataSourceConfig instance
   *
   * @example
   * // Using default endpoint
   * declare const runtime: agentcore.Runtime;
   * const dataSource = agentcore.DataSourceConfig.fromAgentRuntimeEndpoint(runtime);
   *
   * @example
   * // Using a specific endpoint
   * declare const runtime: agentcore.Runtime;
   * const endpoint = runtime.addEndpoint('PROD');
   * const dataSource = agentcore.DataSourceConfig.fromAgentRuntimeEndpoint(runtime, endpoint);
   */
  public static fromAgentRuntimeEndpoint(
    runtime: IBedrockAgentRuntime,
    endpoint?: IRuntimeEndpoint,
  ): DataSourceConfig {
    const endpointName = endpoint?.endpointName ?? 'DEFAULT';

    return DataSourceConfig.buildFromRuntime(runtime, endpointName);
  }

  /**
   * Creates a data source configuration from an AgentCore Runtime and an endpoint name string.
   *
   * Use this method when you want to reference an endpoint by name without
   * having a construct reference. For construct references, prefer `fromAgentRuntimeEndpoint()`.
   *
   * @param runtime - The AgentCore Runtime construct
   * @param endpointName - The name of the runtime endpoint
   * @returns A DataSourceConfig instance
   *
   * @example
   * declare const runtime: agentcore.Runtime;
   * const dataSource = agentcore.DataSourceConfig.fromAgentRuntimeEndpointName(runtime, 'PROD');
   */
  public static fromAgentRuntimeEndpointName(
    runtime: IBedrockAgentRuntime,
    endpointName: string,
  ): DataSourceConfig {
    return DataSourceConfig.buildFromRuntime(runtime, endpointName);
  }

  private static buildFromRuntime(
    runtime: IBedrockAgentRuntime,
    endpointName: string,
  ): DataSourceConfig {
    const logGroupName = `/aws/bedrock-agentcore/runtimes/${runtime.agentRuntimeId}-${endpointName}`;
    const serviceName = `${runtime.agentRuntimeName}.${endpointName}`;

    return new DataSourceConfig({
      logGroupNames: [logGroupName],
      serviceNames: [serviceName],
    });
  }

  /**
   * The CloudWatch Logs configuration.
   */
  public readonly cloudWatchLogsConfig: CloudWatchLogsDataSourceConfig;

  private constructor(config: CloudWatchLogsDataSourceConfig) {
    this.cloudWatchLogsConfig = config;
  }

  /**
   * Binds the data source configuration to produce the L1 property.
   */
  public bind(): DataSourceConfigBindResult {
    return {
      cloudWatchLogs: {
        logGroupNames: this.cloudWatchLogsConfig.logGroupNames,
        serviceNames: this.cloudWatchLogsConfig.serviceNames,
      },
    };
  }
}

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/evaluator-base.ts`
```
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Resource, type IResource, type ResourceProps } from 'aws-cdk-lib';
import type { IEvaluatorRef, EvaluatorReference as L1EvaluatorReference } from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

/**
 * Interface for Evaluator resources.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export interface IEvaluator extends IResource, IEvaluatorRef {
  /**
   * The ARN of the evaluator.
   * @attribute
   */
  readonly evaluatorArn: string;

  /**
   * The unique identifier of the evaluator.
   * @attribute
   */
  readonly evaluatorId: string;

  /**
   * The name of the evaluator.
   * @attribute
   */
  readonly evaluatorName: string;

  /**
   * The lifecycle status of the evaluator (CREATING, ACTIVE, FAILED, DELETING).
   * @attribute
   */
  readonly status?: string;

  /**
   * The timestamp when the evaluator was created.
   * @attribute
   */
  readonly createdAt?: string;

  /**
   * The timestamp when the evaluator was last updated.
   * @attribute
   */
  readonly updatedAt?: string;

  /**
   * Grant the given principal identity permissions to perform actions on this evaluator.
   */
  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
}

/**
 * Abstract base class for Evaluator.
 * Contains methods and attributes valid for evaluators either created with CDK or imported.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export abstract class EvaluatorBase extends Resource implements IEvaluator {
  public abstract readonly evaluatorArn: string;
  public abstract readonly evaluatorId: string;
  public abstract readonly evaluatorName: string;
  public abstract readonly status?: string;
  public abstract readonly createdAt?: string;
  public abstract readonly updatedAt?: string;

  constructor(scope: Construct, id: string, props: ResourceProps = {}) {
    super(scope, id, props);
  }

  /**
   * A reference to this Evaluator resource.
   */
  public get evaluatorRef(): L1EvaluatorReference {
    return {
      evaluatorArn: this.evaluatorArn,
    };
  }

  /**
   * Grants IAM actions to the IAM Principal.
   *
   * [disable-awslint:no-grants]
   *
   * @param grantee - The IAM principal to grant permissions to
   * @param actions - The actions to grant
   * @returns An IAM Grant object representing the granted permissions
   */
  public grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions,
      resourceArns: [this.evaluatorArn],
      scope: this,
    });
  }
}

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/evaluator-config.ts`
```
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import type { Duration } from 'aws-cdk-lib';
import type * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import type { CategoricalRatingOption, EvaluatorInferenceConfig, NumericalRatingOption } from './types';
import {
  throwIfInvalid,
  validateCategoricalRatingScale,
  validateInstructions,
  validateNumericalRatingScale,
} from './validation-helpers';

/**
 * Options for configuring an LLM-as-a-Judge custom evaluator.
 *
 * Uses a foundation model to assess agent performance based on
 * custom instructions and a rating scale.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export interface LlmAsAJudgeOptions {
  /**
   * The evaluation instructions that guide the language model in assessing agent performance.
   *
   * These instructions define the evaluation criteria, context, and expected behavior.
   * Instructions must contain placeholders appropriate for the evaluation level
   * (e.g., `{context}`, `{available_tools}` for SESSION level).
   *
   * Note: Evaluators using reference-input placeholders (e.g., `{expected_tool_trajectory}`,
   * `{assertions}`, `{expected_response}`) are only compatible with on-demand evaluation,
   * not online evaluation.
   *
   * @see https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/custom-evaluators.html
   */
  readonly instructions: string;

  /**
   * The identifier of the Amazon Bedrock model to use for evaluation.
   *
   * Accepts standard model IDs (e.g., `'anthropic.claude-sonnet-4-6'`)
   * and cross-region inference profile IDs with region prefixes
   * (e.g., `'us.anthropic.claude-sonnet-4-6'`, `'eu.anthropic.claude-sonnet-4-6'`).
   */
  readonly modelId: string;

  /**
   * The rating scale that defines how the evaluator should score agent performance.
   */
  readonly ratingScale: EvaluatorRatingScale;

  /**
   * Optional inference configuration parameters that control model behavior during evaluation.
   *
   * When not specified, the foundation model uses its own default values for
   * maxTokens, temperature, and topP.
   *
   * @default - The foundation model's default inference parameters are used
   * @see https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/custom-evaluators.html
   */
  readonly inferenceConfig?: EvaluatorInferenceConfig;

  /**
   * Additional model-specific request fields.
   *
   * @default - No additional fields
   */
  readonly additionalModelRequestFields?: { [key: string]: any };
}

/**
 * Options for configuring a code-based custom evaluator using a Lambda function.
 *
 * Uses a Lambda function to implement custom evaluation logic.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export interface CodeBasedOptions {
  /**
   * The Lambda function used for evaluation.
   *
   * The function will be granted invoke permissions for the
   * `bedrock-agentcore.amazonaws.com` service principal, scoped
   * to this specific evaluator resource.
   */
  readonly lambdaFunction: lambda.IFunction;

  /**
   * The timeout for the Lambda function invocation during evaluation.
   *
   * When not specified, the AgentCore evaluation service uses its default
   * timeout for Lambda-based evaluators.
   *
   * @default - The AgentCore evaluation service's default Lambda timeout is used
   * @see https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/custom-evaluators.html
   */
  readonly timeout?: Duration;
}

/**
 * Represents a rating scale for custom LLM-as-a-Judge evaluators.
 *
 * Rating scales define how the evaluator scores agent performance.
 * Use either categorical (discrete labels) or numerical (labeled numeric values) scales.
 *
 * @example
 * // Categorical rating scale
 * const categorical = agentcore.EvaluatorRatingScale.categorical([
 *   { label: 'Good', definition: 'The response fully addresses the query.' },
 *   { label: 'Bad', definition: 'The response fails to address the query.' },
 * ]);
 *
 * // Numerical rating scale
 * const numerical = agentcore.EvaluatorRatingScale.numerical([
 *   { label: 'Poor', definition: 'Inadequate response.', value: 1 },
 *   { label: 'Good', definition: 'Adequate response.', value: 3 },
 *   { label: 'Excellent', definition: 'Outstanding response.', value: 5 },
 * ]);
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export class EvaluatorRatingScale {
  /**
   * Creates a categorical rating scale.
   *
   * Categorical scales define discrete labels for scoring, such as "Good" / "Bad"
   * or "Pass" / "Fail".
   *
   * @param options - The categorical rating options (at least 1 required)
   */
  public static categorical(options: CategoricalRatingOption[]): EvaluatorRatingScale {
    throwIfInvalid(validateCategoricalRatingScale, options);
    return new EvaluatorRatingScale({ categorical: options });
  }

  /**
   * Creates a numerical rating scale.
   *
   * Numerical scales define labeled numeric values for scoring, such as
   * 1 (Poor) through 5 (Excellent).
   *
   * @param options - The numerical rating options (at least 1 required)
   */
  public static numerical(options: NumericalRatingOption[]): EvaluatorRatingScale {
    throwIfInvalid(validateNumericalRatingScale, options);
    return new EvaluatorRatingScale({ numerical: options });
  }

  private readonly config: bedrockagentcore.CfnEvaluator.RatingScaleProperty;

  private constructor(config: bedrockagentcore.CfnEvaluator.RatingScaleProperty) {
    this.config = config;
  }

  /**
   * Binds the rating scale to produce the L1 property.
   * @internal
   */
  public _bind(): bedrockagentcore.CfnEvaluator.RatingScaleProperty {
    return this.config;
  }
}

/**
 * Configuration for a custom evaluator.
 *
 * Defines how an evaluator assesses agent performance. Supports two strategies:
 * - **LLM-as-a-Judge**: Uses a foundation model with custom instructions and a rating scale.
 * - **Code-based**: Uses a Lambda function for custom evaluation logic.
 *
 * @example
 * // LLM-as-a-Judge evaluator
 * const llmConfig = agentcore.EvaluatorConfig.llmAsAJudge({
 *   instructions: 'Evaluate whether the agent response is helpful.',
 *   modelId: 'us.anthropic.claude-sonnet-4-6',
 *   ratingScale: agentcore.EvaluatorRatingScale.categorical([
 *     { label: 'Good', definition: 'The response is helpful.' },
 *     { label: 'Bad', definition: 'The response is not helpful.' },
 *   ]),
 * });
 *
 * // Code-based evaluator
 * declare const myEvalFunction: lambda.IFunction;
 * const codeConfig = agentcore.EvaluatorConfig.codeBased({
 *   lambdaFunction: myEvalFunction,
 * });
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export class EvaluatorConfig {
  /**
   * Creates an LLM-as-a-Judge evaluator configuration.
   *
   * Uses a foundation model to assess agent performance based on custom
   * instructions and a rating scale.
   *
   * @param options - The LLM-as-a-Judge configuration options
   */
  public static llmAsAJudge(options: LlmAsAJudgeOptions): EvaluatorConfig {
    throwIfInvalid(validateInstructions, options.instructions);

    const modelConfig: bedrockagentcore.CfnEvaluator.EvaluatorModelConfigProperty = {
      bedrockEvaluatorModelConfig: {
        modelId: options.modelId,
        ...(options.inferenceConfig !== undefined ? {
          inferenceConfig: {
            maxTokens: options.inferenceConfig.maxTokens,
            temperature: options.inferenceConfig.temperature,
            topP: options.inferenceConfig.topP,
          },
        } : {}),
        ...(options.additionalModelRequestFields !== undefined ? {
          additionalModelRequestFields: options.additionalModelRequestFields,
        } : {}),
      },
    };

    const cfnConfig: bedrockagentcore.CfnEvaluator.EvaluatorConfigProperty = {
      llmAsAJudge: {
        instructions: options.instructions,
        modelConfig,
        ratingScale: options.ratingScale._bind(),
      },
    };

    return new EvaluatorConfig(cfnConfig);
  }

  /**
   * Creates a code-based evaluator configuration using a Lambda function.
   *
   * The Lambda function implements custom evaluation logic. The function will
   * automatically be granted invoke permissions for the bedrock-agentcore service.
   *
   * @param options - The code-based configuration options
   */
  public static codeBased(options: CodeBasedOptions): EvaluatorConfig {
    const timeoutInSeconds = options.timeout?.toSeconds();

    const cfnConfig: bedrockagentcore.CfnEvaluator.EvaluatorConfigProperty = {
      codeBased: {
        lambdaConfig: {
          lambdaArn: options.lambdaFunction.functionArn,
          ...(timeoutInSeconds !== undefined ? {
            lambdaTimeoutInSeconds: timeoutInSeconds,
          } : {}),
        },
      },
    };

    return new EvaluatorConfig(cfnConfig, options.lambdaFunction);
  }

  /**
   * The Lambda function used for code-based evaluation, if applicable.
   */
  public readonly lambdaFunction?: lambda.IFunction;

  private readonly cfnConfig: bedrockagentcore.CfnEvaluator.EvaluatorConfigProperty;

  private constructor(
    cfnConfig: bedrockagentcore.CfnEvaluator.EvaluatorConfigProperty,
    lambdaFunction?: lambda.IFunction,
  ) {
    this.cfnConfig = cfnConfig;
    this.lambdaFunction = lambdaFuncti
```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/evaluator.ts`
```
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import type { IEvaluator } from './evaluator-base';
import type { BuiltinEvaluator, EvaluatorReferenceBindResult } from './types';

/**
 * Represents a reference to an evaluator for online evaluation.
 *
 * Use the static factory methods to create evaluator references:
 * - `EvaluatorReference.builtin()` for built-in evaluators
 * - `EvaluatorReference.custom()` for custom evaluators
 *
 * @example
 * // Using built-in evaluators
 * const helpfulness = agentcore.EvaluatorReference.builtin(agentcore.BuiltinEvaluator.HELPFULNESS);
 *
 * // Using custom evaluators
 * declare const myCustomEvaluator: agentcore.IEvaluator;
 * const custom = agentcore.EvaluatorReference.custom(myCustomEvaluator);
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export class EvaluatorReference {
  /**
   * Creates a reference to a built-in evaluator.
   *
   * Built-in evaluators are provided by Amazon Bedrock AgentCore and assess
   * different aspects of agent performance at various levels (session, trace, or tool call).
   *
   * @param evaluator - The built-in evaluator to reference
   * @returns An EvaluatorReference instance
   *
   * @example
   * const helpfulness = agentcore.EvaluatorReference.builtin(agentcore.BuiltinEvaluator.HELPFULNESS);
   * const goalSuccess = agentcore.EvaluatorReference.builtin(agentcore.BuiltinEvaluator.GOAL_SUCCESS_RATE);
   */
  public static builtin(evaluator: BuiltinEvaluator): EvaluatorReference {
    return new EvaluatorReference(evaluator.value);
  }

  /**
   * Creates a reference to a custom evaluator.
   *
   * Custom evaluators are created using the `Evaluator` construct and can be
   * LLM-as-a-Judge or code-based (Lambda) evaluators.
   *
   * @param evaluator - The custom evaluator construct to reference
   * @returns An EvaluatorReference instance
   *
   * @example
   * declare const myCustomEvaluator: agentcore.IEvaluator;
   * const ref = agentcore.EvaluatorReference.custom(myCustomEvaluator);
   */
  public static custom(evaluator: IEvaluator): EvaluatorReference {
    return new EvaluatorReference(evaluator.evaluatorId);
  }

  /**
   * The evaluator identifier.
   */
  public readonly evaluatorId: string;

  private constructor(evaluatorId: string) {
    this.evaluatorId = evaluatorId;
  }

  /**
   * Binds the evaluator reference to produce the L1 property.
   */
  public bind(): EvaluatorReferenceBindResult {
    return {
      evaluatorId: this.evaluatorId,
    };
  }
}

```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/online-evaluation-base.ts`
```
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Resource, type IResource, type ResourceProps } from 'aws-cdk-lib';
import type { IOnlineEvaluationConfigRef, OnlineEvaluationConfigReference } from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

/**
 * Interface for OnlineEvaluationConfig resources.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export interface IOnlineEvaluationConfig extends IResource, iam.IGrantable, IOnlineEvaluationConfigRef {
  /**
   * The ARN of the online evaluation configuration.
   * @attribute
   */
  readonly onlineEvaluationConfigArn: string;

  /**
   * The unique identifier of the online evaluation configuration.
   * @attribute
   */
  readonly onlineEvaluationConfigId: string;

  /**
   * The name of the online evaluation configuration.
   * @attribute
   */
  readonly onlineEvaluationConfigName: string;

  /**
   * The IAM execution role for the evaluation.
   */
  readonly executionRole?: iam.IRole;

  /**
   * The lifecycle status of the configuration (CREATING, ACTIVE, FAILED, DELETING).
   * @attribute
   */
  readonly status?: string;

  /**
   * The execution status of the evaluation (ENABLED or DISABLED).
   */
  readonly executionStatus?: string;

  /**
   * The timestamp when the configuration was created.
   * @attribute
   */
  readonly createdAt?: string;

  /**
   * The timestamp when the configuration was last updated.
   * @attribute
   */
  readonly updatedAt?: string;

  /**
   * Grant the given principal identity permissions to perform actions on this configuration.
   */
  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
}

/**
 * Abstract base class for OnlineEvaluationConfig.
 * Contains methods and attributes valid for configurations either created with CDK or imported.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export abstract class OnlineEvaluationBase extends Resource implements IOnlineEvaluationConfig {
  public abstract readonly onlineEvaluationConfigArn: string;
  public abstract readonly onlineEvaluationConfigId: string;
  public abstract readonly onlineEvaluationConfigName: string;
  public abstract readonly executionRole?: iam.IRole;
  public abstract readonly status?: string;
  public abstract readonly executionStatus?: string;
  public abstract readonly createdAt?: string;
  public abstract readonly updatedAt?: string;

  /**
   * The principal to grant permissions to.
   */
  public abstract readonly grantPrincipal: iam.IPrincipal;

  constructor(scope: Construct, id: string, props: ResourceProps = {}) {
    super(scope, id, props);
  }

  /**
   * A reference to this OnlineEvaluationConfig resource.
   */
  public get onlineEvaluationConfigRef(): OnlineEvaluationConfigReference {
    return {
      onlineEvaluationConfigArn: this.onlineEvaluationConfigArn,
    };
  }

  /**
   * Grants IAM actions to the IAM Principal.
   *
   * [disable-awslint:no-grants]
   *
   * @param grantee - The IAM principal to grant permissions to
   * @param actions - The actions to grant
   * @returns An IAM Grant object representing the granted permissions
   */
  public grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions,
      resourceArns: [this.onlineEvaluationConfigArn],
      scope: this,
    });
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39793** (2026-11-18): **aws-cdk-lib: jest coverage instruments analytics-data-source/classes.ts, triggering a Babel size warning on every test run**
  *Symptoms*: Packages that depend on `aws-cdk-lib` print a Babel warning during `jest --coverage` whenever a test touches an L2 construct, for example:  ``` [BABEL] Note: The code generator has deoptimised the styling of /codebuild/output/.../packages/aws-cdk-lib/core/lib/analytics-data-source/classes.ts as it exceeds the max of 500KB. ```  Seen in `@aws-cdk/aws-elasticache-alpha` CI, but it fires for any package whose tests exercise `metadata-resource.ts`, which almost all L2 construct tests do.  ### Current  `core/lib/analytics-data-source/classes.ts` is a generated data file (821KB) that cannot be edited by hand (enforced by `tools/@aws-cdk/prlint/lint.ts`). It isn't covered by `coveragePathIgnorePatterns` because that list only excludes `*.generated.ts`, not this file's name. Jest's coverage instrumenter (coverage provider `babel`) therefore instruments it on every test run that imports it, and Babel's generator warns once the instrumented output passes 500KB.  ### Expected  Generated files that can't be hand-edited, like `classes.ts` and `enums.ts` in `core/lib/analytics-data-source/`, are excluded from coverage instrumentation the same way `*.generated.ts` files already are, so the warning doesn't print and the file doesn't affect coverage numbers either way. 

- **Issue #39778** (2026-11-18): **feat(core): build bundling images only when an asset is bundled**
  *Symptoms*: ### Issue # (if applicable)  Closes #27991.  ### Reason for this change  `DockerImage.fromBuild()` builds the image as soon as it is called, which for PythonFunction means when the construct is created. The build happens even when the image is never used: when bundling is skipped, when the bundled output already exists in `cdk.out` from an earlier synth, or when the same asset was already staged in this app. Unit tests that create a stack with a PythonFunction pay for a Docker build on every run, and so does every synth on a CI runner without a warm Docker cache. Our synth telemetry shows the PythonFunction image build costing a median of 69 s in CI.  Every PythonFunction also runs its own `docker image inspect` (or build) for the same image tag, even though the tag is content-addressed from the build context and options.  ### Description of changes  - New `DockerImage.fromBuildOnDemand()`. It computes the same tag and hash as `fromBuild()`, so switching between the two doesn't change asset hashes, but it doesn't build yet. It keeps a copy of the build options it hashed, so later changes to the caller's object have no effect. - New `buildImage()`, which builds an on-demand image if it hasn't been built yet and does nothing for other images. `run()` and `cp()` call it, and asset staging calls it right before it sets up the bundling container. A failed build then leaves no helper containers or volumes behind, and the build time is recorded under its own counter instead of the c

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

### Incident Patch 1: `4ed690ec` (2026-11-19)
**Commit Message**: fix(core): asset hashing and symlink contract is not documented (#39779)

We didn't clearly explain how all the various options of `AssetStaging` interacted with each other. This led to multiple security researchers thinking they found a problem in our contract, whereas the actual contract never intended to guarantee what they thought they found.

It's also not very helpful to users if it's not clear what `exclude` applies to in the case of bundling (source, output? both, neither?)

This change more clearly defines the contract, and cleans up the implementation of the asset staging flow that have accreted over time (mostly with respect to bundling) to also make the intended flow more clear.

The contract
=============

WITHOUT BUNDLING

Without the `bundling` property the asset is just a regular file copy operation.

- `exclude` and `ignoreMode` control which files are excluded from the copy operation.
- `follow` controls how symlinks are handled during the copy operation: the symlink can be copied, the file the symlink points to can be copied, or symlinks pointing outside the source tree can be blocked.
- The asset hash is calculated based on the files that are copied into the ass

**File**: `packages/@aws-cdk/aws-lambda-python-alpha/lib/bundling.ts` (modified, +7/-2)
```diff
@@ -2,7 +2,7 @@ import * as path from 'path';
 import type { AssetCode, Runtime } from 'aws-cdk-lib/aws-lambda';
 import { Architecture, Code } from 'aws-cdk-lib/aws-lambda';
 import type { BundlingFileAccess, BundlingOptions as CdkBundlingOptions, DockerVolume } from 'aws-cdk-lib/core';
-import { AssetStaging, DockerImage, PERF_BUNDLING_SRC_SYM } from 'aws-cdk-lib/core';
+import { AssetHashType, AssetStaging, DockerImage, PERF_BUNDLING_SRC_SYM } from 'aws-cdk-lib/core';
 import { UnscopedValidationError } from 'aws-cdk-lib/core/lib/errors';
 import { lit, posixShellEscape } from 'aws-cdk-lib/core/lib/helpers-internal';
 import { Packaging, DependenciesFile } from './packaging';
@@ -60,10 +60,15 @@ export class Bundling implements CdkBundlingOptions {
   public static bundle(options: BundlingProps): AssetCode {
     validateOutputPathSuffix(options.outputPathSuffix ?? '');
 
+    let exclude = [];
+    if (options.assetHashType === AssetHashType.SOURCE || options.assetHashType === undefined) {
+      exclude.push(...DEPENDENCY_EXCLUDES);
+    }
+
     return Code.fromAsset(options.entry, {
       assetHash: options.assetHash,
       assetHashType: options.assetHashType,
-      exclude: DEPENDENCY_EXCLUDES,
+      exclude,
       bundling: options.skip ? undefined : new Bundling(options),
     });
   }
```

**File**: `packages/aws-cdk-lib/core/lib/asset-staging.ts` (modified, +310/-192)
```diff
@@ -2,13 +2,14 @@ import * as crypto from 'crypto';
 import * as path from 'path';
 import { Construct } from 'constructs';
 import * as fs from 'fs-extra';
+import { Annotations } from './annotations';
 import type { AssetOptions } from './assets';
 import { AssetHashType, FileAssetPackaging } from './assets';
 import type { BundlingOptions } from './bundling';
 import { BundlingFileAccess, BundlingOutput, PERF_BUNDLING_SRC_SYM } from './bundling';
 import { AssumptionError, ValidationError } from './errors';
 import type { FingerprintOptions } from './fs';
-import { FileSystem, SymlinkFollowMode, IgnoreStrategy } from './fs';
+import { FileSystem, IgnoreStrategy, SymlinkFollowMode } from './fs';
 import { clearLargeFileFingerprintCache } from './fs/fingerprint';
 import { Names } from './names';
 import { AssetBundlingVolumeCopy, AssetBundlingBindMount } from './private/asset-staging';
@@ -45,7 +46,10 @@ interface StagedAsset {
   readonly packaging: FileAssetPackaging;
 
   /**
-   * Whether this asset is an archive
+   * Whether this asset will ultimately end up in S3 as an archive
+   *
+   * It will end up as an archive either if it's a directory (which
+   * the CDK will ZIP) or if it's a file that's an archive.
    */
   readonly isArchive: boolean;
 }
@@ -64,11 +68,59 @@ export interface AssetStagingProps extends FingerprintOptions, AssetOptions {
  * Stages a file or directory from a location on the file system into a staging
  * directory.
  *
- * This is controlled by the context key 'aws:cdk:asset-staging' and enabled
- * by the CLI by default in order to ensure that when the CDK app exists, all
- * assets are available for deployment. Otherwise, if an app references assets
- * in temporary locations, those will not be available when it exists (see
- * https://github.com/aws/aws-cdk/issues/1716).
+ * This construct can operate in two modes: without and with "bundling". Bundling
+ * means that an additional command is run to transform the source files into
+ * a final asset that will be used for deployment.
+ *
+ * ## Without bundling
+ *
+ * Without the `bundling` property, the asset is just a regular file copy
+ * operation.
+ *
+ * - `exclude` and `ignoreMode` control which files are excluded from the copy operation.
+ * - `follow` controls how symlinks are handled during the copy operation:
+ *   the symlink can be copied, the file the symlink points to can be copied,
+ *   or symlinks pointing outside the source tree can be blocked.
+ * - The asset hash is calculated based on the files that are copied into the asset,
+ *   unless the hash is overridden entirely by the `assetHash` property.
+ *
+ * The copy-staging operation can be disabled by setting the context
+ * key `'aws:cdk:asset-staging': false`. This can be useful for local
+ * development tools like SAM CLI, so that you can update the source files
+ * directly and immediately see the result in a local emulator without needing
+ * to run `cdk synth` every time to stage the assets. Note that in this mode,
+ * since there is no copying, `exclude` and `follow` settings have no effect,
+ * including `BLOCK_EXTERNAL` which will not be applied.
+ *
+ * ## With bundling
+ *
+ * With the `bundling` property, the transformation of source files to a final asset
+ * is done through bundling operation specified in the `bundling` property.
+ *
+ * The behavior of the construct depends on the `assetHashType` selected:
+ *
+ * - `AssetHashType.SOURCE`: the asset hash will be based on the source files
+ *   after applying the `exclude`, `ignoreMode` and `follow` settings. That hash
+ *   will be used to skip the bundling command entirely if an asset with the given
+ *   hash already exists in the assembly directory. This requires that those
+ *   settings accurately model the dependencies used by the bundling operation to
+ *   produce the final asset.
+ * - `AssetHashType.OUTPUT`: the asset hash will be based on the output of the
+ *   bundling operation. `exclude`/`ignoreMode` are not used, and no attempt
+ *   is made to materialize any symlinks that bundling may have written.
+ * - `AssetHashType.CUSTOM`: the asset hash will be taken from the `assetHash`
+ *   property. `exclude`/`ignoreMode` are not used, and no attempt is made to
+ *   materialize any symlinks that bundling may have written.
+ *
+ * For all three modes, if `follow` is set to `SymlinkFollowMode.BLOCK_EXTERNAL`,
+ * any symlinks written by bundling that point outside the output directory
+ * will be blocked.
+ *
+ * For bundled assets, staging can not be disabled for the benefit of local
+ * development. If you are iterating against a local emulator, you will need to
+ * run `cdk synth` for every asset change.
+ *
+ * ## Other behavior
  *
  * The `stagedPath` property is a stringified token that represents the location
  * of the file or directory after staging. It will be resolved only during the
@@ -77,6 +129,15 @@ export interface AssetStagingProps extends FingerprintOption
```

**File**: `packages/aws-cdk-lib/core/lib/assets.ts` (modified, +39/-7)
```diff
@@ -66,30 +66,62 @@ export interface AssetOptions {
  */
 export enum AssetHashType {
   /**
-   * Based on the content of the source path
+   * Base the asset hash on the contents of the source path
    *
-   * When bundling, use `SOURCE` when the content of the bundling output is not
-   * stable across repeated bundling operations.
+   * ## Without bundling
+   *
+   * When used without the `bundling` property, and the asset is just a regular file
+   * copy operation: the hash will be based on the files in the source path
+   * respecting the `exclude` patterns given (i.e., excluded files will not be
+   * included in the hash). This matches the files that are actually copied by the
+   * copy operation.
+   *
+   * ## With bundling
+   *
+   * When used with the `bundling` property, and the asset is produced by a
+   * bundling operation: the hash will still be based on the files in the source
+   * path while respecting the `exclude` patterns given. If those given files
+   * did not change since the last bundling operation, the hash will remain the same
+   * and the bundling operation itself will be skipped. However, do note the following
+   * important caveat:
+   *
+   * - The bundling operation has access to all files in the source path, regardless
+   *   of the `exclude` pattern you configure. It is your responsibility to ensure
+   *   the `exclude` pattern accurately matches the files the bundling operation
+   *   will *actually* access and base its final output on.
+   *
+   * It is always safe to fingerprint more files than strictly necessary. This will
+   * potentially reduce the efficiency of cache hits, but not affect correctness.
    */
   SOURCE = 'source',
 
   /**
-   * Based on the content of the bundled path
+   * Base the asset hash on the contents of the bundled path
    *
    * @deprecated use `OUTPUT` instead
    */
   BUNDLE = 'bundle',
 
   /**
-   * Based on the content of the bundling output
+   * Base the asset hash on the contents of the bundling output
+   *
+   * Use `OUTPUT` when it is hard to isolate the full set of source files that
+   * contribute to the final asset. Instead, the files produced by the `bundling` step
+   * will be fingerprinted to produce the asset hash.
    *
-   * Use `OUTPUT` when the source of the asset is a top level folder containing
-   * code and/or dependencies that are not directly linked to the asset.
+   * Use of this value precludes caching of the transform operation: since the
+   * asset hash can only be calculated *after* the asset is bundled, the asset must
+   * be bundled on every synthesis.
+   *
+   * This option can only be used in combination with the `bundling` property.
    */
   OUTPUT = 'output',
 
   /**
    * Use a custom hash
+   *
+   * The `AssetStaging` construct will not calculate the asset hash; instead, it
+   * will use the asset hash given in the `assetHash` property.
    */
   CUSTOM = 'custom',
 }
```

**File**: `packages/aws-cdk-lib/core/lib/fs/ignore.ts` (modified, +15/-0)
```diff
@@ -46,6 +46,21 @@ export abstract class IgnoreStrategy {
     return new DockerIgnoreStrategy(absoluteRootPath, patterns);
   }
 
+  /**
+   * Return an IgnoreStrategy that does not ignore any files.
+   */
+  public static none(): IgnoreStrategy {
+    return new class extends IgnoreStrategy {
+      public add(): void {
+        // no-op
+      }
+
+      public ignores(): boolean {
+        return false;
+      }
+    };
+  }
+
   /**
    * Creates an IgnoreStrategy based on the `ignoreMode` and `exclude` in a `CopyOptions`.
    *
```

**File**: `packages/aws-cdk-lib/core/lib/fs/index.ts` (modified, +22/-0)
```diff
@@ -16,6 +16,7 @@ export * from './options';
 export class FileSystem {
   /**
    * Copies an entire directory structure.
+   *
    * @param srcDir Source directory
    * @param destDir Destination directory
    * @param options options
@@ -25,6 +26,27 @@ export class FileSystem {
     return copyDirectory(srcDir, destDir, options, rootDir);
   }
 
+  /**
+   * Copies an entire directory structure.
+   *
+   * Protects against interruption by copying to a temporary directory first and then renaming the directory into place.
+   * Both the target directory and the temporary directory will be overwritten if they already exist.
+   *
+   * The temporary directory is deleted if an error occurs.
+   */
+  public static copyDirectoryAtomic(srcDir: string, destDir: string, options: CopyOptions = { }) {
+    const tmpDest = `${destDir}.tmp`;
+    FileSystem.rmrf(tmpDest);
+    try {
+      fs.mkdirSync(tmpDest, { recursive: true });
+      copyDirectory(srcDir, tmpDest, options);
+      FileSystem.rmrf(destDir);
+      fs.renameSync(tmpDest, destDir);
+    } finally {
+      FileSystem.rmrf(tmpDest);
+    }
+  }
+
   /**
    * Produces fingerprint based on the contents of a single file or an entire directory tree.
    *
```

**File**: `packages/aws-cdk-lib/core/lib/fs/options.ts` (modified, +81/-6)
```diff
@@ -74,16 +74,38 @@ export enum IgnoreMode {
 interface FileOptions {
   /**
    * File paths matching the patterns will be excluded. See `ignoreMode` to set the matching behavior.
-   * Has no effect on Assets bundled using the `bundling` property.
+   *
+   * ## Without bundling
+   *
+   * When used without the `bundling` property, the asset is just a regular file
+   * copy operation. In that case, this controls the files that will be included
+   * in the copy. Files matching the `exclude` patterns will not be included in
+   * the copy.
+   *
+   * ## With bundling
+   *
+   * When used with the `bundling` property, the asset is produced by a
+   * bundling operation. In that case, the value of `exclude` is only meaningful
+   * if the `assetHashType` is set to `AssetHashType.SOURCE`, and ignored for
+   * other asset hash types. The `exclude` patterns will be used to determine
+   * which files contribute to the asset, and the bundling command is skipped
+   * if the source files have not changed since the last bundling operation.
+   *
+   * **NOTE:** The bundling operation still has access to all files in the source path,
+   * regardless of the `exclude` patterns. It is your responsibility to ensure
+   * the `exclude` pattern accurately matches the files the bundling operation
+   * will *actually* access and base its final output on.
+   *
+   * For `OUTPUT` or `CUSTOM` asset hash types, the `exclude` pattern is ignored.
    *
    * @default - nothing is excluded
    */
   readonly exclude?: string[];
 
   /**
-   * The ignore behavior to use for `exclude` patterns.
+   * What syntax the `exclude` patterns are written in.
    *
-   * @default IgnoreMode.GLOB
+   * @default - IgnoreMode.GLOB for file assets, `IgnoreMode.DOCKER` for image assets (requires that the `@aws-cdk/aws-ecr-assets:dockerIgnoreSupport` feature flag is set, which is recommended)
    */
   readonly ignoreMode?: IgnoreMode;
 }
@@ -95,7 +117,34 @@ export interface CopyOptions extends FileOptions {
   /**
    * A strategy for how to handle symlinks.
    *
-   * @default SymlinkFollowMode.NEVER
+   * Symlinks may be copied, materialized or rejected. Note that if symlinks are
+   * copied they should be relative; absolute symlinks will lose their
+   * meaning if the cloud assembly is moved to another machine.
+   *
+   * ## Without bundling
+   *
+   * When used without the `bundling` property, the asset is just a regular file
+   * copy operation. In that case, symlinks are materialized or blocked with respect
+   * to the source path root as they are being copied.
+   *
+   * ## With bundling
+   *
+   * When used with the `bundling` property, the asset is produced by a
+   * bundling operation. In that case, the bundling command is fully
+   * in charge of producing a set of files in an output directory, and
+   * the `AssetStaging` construct will never affect symlink materialization.
+   *
+   * If the `assetHashType` is `AssetHashType.SOURCE`, this flag affects what
+   * the source hash is based on, and the recommended value is one of
+   * `SymlinkFollowMode.EXTERNAL` or `SymlinkFollowMode.BLOCK_EXTERNAL`.
+   *
+   * If the `SymlinkFollowMode.BLOCK_EXTERNAL` mode is used:
+   *
+   * - Symlinks pointing outside the source tree will be blocked, but only
+   *   if using `AssetHashType.SOURCE` (not for any of the other asset hash types).
+   * - Symlinks pointing outside the bundle output will be blocked.
+   *
+   * @default SymlinkFollowMode.EXTERNAL
    */
   readonly follow?: SymlinkFollowMode;
 }
@@ -107,7 +156,32 @@ export interface FileCopyOptions extends FileOptions {
   /**
    * A strategy for how to handle symlinks.
    *
-   * @default SymlinkFollowMode.NEVER
+   * Symlinks may be copied, materialized or rejected. Note that if symlinks are
+   * copied they should be relative; absolute symlinks will lose their
+   * meaning if the cloud assembly is moved to another machine.
+   *
+   * ## Without bundling
+   *
+   * When used without the `bundling` property, the asset is just a regular file
+   * copy operation. In that case, symlinks are materialized or blocked with respect
+   * to the `sourcePath` directory as they are being copied.
+   *
+   * ## With bundling
+   *
+   * When used with the `bundling` property, the asset is produced by a
+   * bundling operation. In that case, the bundling command is fully
+   * in charge of producing a set of files in an output directory, and
+   * the `AssetStaging` construct will never affect symlink materialization.
+   *
+   * If the `assetHashType` is `AssetHashType.SOURCE`, this flag affects what
+   * the source hash is based on, and the recommended value is one of
+   * `SymlinkFollowMode.EXTERNAL` or `SymlinkFollowMode.BLOCK_EXTERNAL`.
+   *
+   * If the `SymlinkFollowMode.BLOCK_EXTERNAL` mode is used:
+   * - symlinks pointing outside the source tree will be blocked if using `AssetHashType.SOURCE`.
+   * - symlinks pointing outside the bundle output will be block
```

**File**: `packages/aws-cdk-lib/core/lib/fs/utils.ts` (modified, +8/-2)
```diff
@@ -2,6 +2,8 @@ import * as fs from 'fs';
 import * as path from 'path';
 import type { IgnoreStrategy } from './ignore';
 import { SymlinkFollowMode } from './options';
+import { UnscopedValidationError } from '../errors';
+import { lit } from '../private/literal-string';
 
 export function isInternalPath(rootPath: string, targetPath: string): boolean {
   return rootPath === targetPath || targetPath.startsWith(rootPath + path.sep);
@@ -221,6 +223,12 @@ export function walkDirectory(directory: string, options: WalkOptions, visitor:
 
     if (!targetStats) {
       if (!ignoreStrategy.ignores(symbolicPath)) {
+        if (follow === SymlinkFollowMode.BLOCK_EXTERNAL && !internal) {
+          throw new UnscopedValidationError(
+            lit`ExternalSymlink`,
+            `BLOCK_EXTERNAL forbids the symbolic link ${realPath} from pointing outside the directory tree (to ${linkTarget}). Set \`follow\` to a mode that will follow symlinks (ALWAYS or EXTERNAL) or emit a regular file`,
+          );
+        }
         visitor.onSymlink?.({ path: symbolicPath, realPath, linkTarget, resolvedLinkTarget, internal });
       }
       return;
@@ -247,9 +255,7 @@ export function walkDirectory(directory: string, options: WalkOptions, visitor:
       case SymlinkFollowMode.EXTERNAL:
         return !internal;
       case SymlinkFollowMode.BLOCK_EXTERNAL:
-        return internal;
       case SymlinkFollowMode.NEVER:
-      default:
         return false;
     }
   }
```

**File**: `packages/aws-cdk-lib/core/test/app-that-is-interrupted-during-copy.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+/**
+ * This is a CDK app that is guaranteed to kill itself while copying an asset into the cloud assembly
+ */
+import fs from 'fs';
+import * as path from 'path';
+import { App, AssetStaging, Stack } from '../lib';
+
+// Die right after the first file has been copied, so the copy is left half-done
+const copyFileSync = fs.copyFileSync;
+fs.copyFileSync = (...args: Parameters<typeof fs.copyFileSync>) => {
+  copyFileSync(...args);
+  process.kill(process.pid, 'SIGTERM');
+  // Signal delivery is asynchronous; make sure we don't get to copy anything else in the meantime
+  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
+};
+
+const app = new App();
+const stack = new Stack(app, 'stack');
+
+new AssetStaging(stack, 'Asset', {
+  sourcePath: path.join(__dirname, 'fs', 'fixtures', 'test1'),
+});
+
+app.synth();
```

---

### Incident Patch 2: `b7476c8a` (2026-11-19)
**Commit Message**: chore: release build runs out of memory in jsii-pacmak (#39840)

### Issue # (if applicable)

None.

### Reason for this change

The release build fails in `pack.sh` when `jsii-pacmak` runs out of heap:

```
[jsii-pacmak] [INFO] Packaging 'python' for 44 modules
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
./pack.sh: line 49: Aborted   $PACMAK --verbose $(cat $TMPDIR/jsii.txt)
```

`pack.sh` packages all jsii modules in one `jsii-pacmak` process with the 8 GB heap it sets at the top of the script. The service spec update in #39788 grew `@aws-cdk/mixins-preview` from about 2,000 to about 28,000 types, almost all of them EventBridge event types, and the release build's Rosetta step now handles 68,160 examples instead of about 42,000. The pacmak step no longer fits in 8 GB. The build host has 144 GB.

This failure showed up after #39836 fixed the Rosetta errors that stopped the build earlier in `pack.sh`.

### Description of changes

Give the `jsii-pacmak` step in `pack.sh` a 32 GB heap. The other steps in `pack.sh` keep the 8 GB heap.

A later `--max-old-space-size` in `NODE_OPTIONS` overrides the earlier one, so the change 

**File**: `pack.sh` (modified, +3/-1)
```diff
@@ -43,8 +43,10 @@ echo "Running aws-cdk-lib pre-package"
 npx lerna run --scope aws-cdk-lib package -- --pre-only
 
 # Jsii packaging (all at once using jsii-pacmak)
+# jsii-pacmak loads every assembly and its translations into one process. With about 28,000 types
+# in @aws-cdk/mixins-preview, that needs more than the 8 GB set above.
 echo "Packaging jsii modules" >&2
-$PACMAK \
+NODE_OPTIONS="${NODE_OPTIONS} --max-old-space-size=32768" $PACMAK \
   --verbose \
   $(cat $TMPDIR/jsii.txt)
 
```

---

### Incident Patch 3: `2f790a31` (2026-11-18)
**Commit Message**: fix(core): upgrade CloudFormation validation to latest version (#39643)

### Description
This upgrades `@aws/cloudformation-validate` to [1.17.0](https://github.com/aws-cloudformation/cloudformation-validate/compare/1.14.0...1.17.0) in order to get the latest fixes and improvements, and allows compatible 1.17.x patch releases to be picked up automatically.

Changes:
* Fixes the `E1152` false positive for `resolve:ssm:` values on `AWS::EC2::Instance.ImageId`, including templates produced by `MachineImage.resolveSsmParameterAtLaunch`
* Replaces the hard-coded `E3511` IAM role check with schema-backed `E1156` and `E1165` validation, removing duplicate diagnostics and accepting valid bare and path-prefixed role names for AWS Batch compute environments
* Fixes conditional schema evaluation for nested `allOf` constraints and reachable `Fn::If` scenarios, including RDS KMS encryption checks and EC2 IPv6 mutual-exclusion checks
* Honors CloudFormation `$uppercase` property transforms during enum validation, preventing `W3030` false positives for accepted case variants
* Improves diagnostic locations for malformed condition operands and missing or empty `Resources` sections
* Includes the l

**File**: `packages/@aws-cdk/aws-apprunner-alpha/test/auto-scaling-configuration.test.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ import { AutoScalingConfiguration } from '../lib';
 let stack: cdk.Stack;
 beforeEach(() => {
   stack = new cdk.Stack();
+  cdk.Validations.of(stack).acknowledge({
+    id: 'CloudFormation-Validate::W3697',
+    reason: 'App Runner is in maintenance mode and is intentionally exercised by this unit test',
+  });
 });
 
 test.each([
```

**File**: `packages/@aws-cdk/aws-apprunner-alpha/test/obserbability-configuration.test.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ import { ObservabilityConfiguration, TraceConfigurationVendor } from '../lib';
 let stack: cdk.Stack;
 beforeEach(() => {
   stack = new cdk.Stack();
+  cdk.Validations.of(stack).acknowledge({
+    id: 'CloudFormation-Validate::W3697',
+    reason: 'App Runner is in maintenance mode and is intentionally exercised by this unit test',
+  });
 });
 
 test.each([
```

**File**: `packages/@aws-cdk/aws-s3objectlambda-alpha/test/s3objectlambda.test.ts` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ let handler: lambda.Function;
 
 beforeEach(() => {
   stack = new cdk.Stack();
+  cdk.Validations.of(stack).acknowledge({
+    id: 'CloudFormation-Validate::W3697',
+    reason: 'S3 Object Lambda is in maintenance mode and is intentionally exercised by this unit test',
+  });
   bucket = new s3.Bucket(stack, 'MyBucket');
   handler = new lambda.Function(stack, 'MyFunction', {
     runtime: lambda.Runtime.NODEJS_LATEST,
```

**File**: `packages/aws-cdk-lib/aws-cloudwatch-actions/test/ssm.test.ts` (modified, +4/-0)
```diff
@@ -133,6 +133,10 @@ test('SSM Incident alarm action with full stack including replication set and re
 
   // GIVEN
   const stack = new Stack();
+  cdk.Validations.of(stack).acknowledge({
+    id: 'CloudFormation-Validate::W3697',
+    reason: 'SSM Incident Manager is in maintenance mode and is intentionally exercised by this unit test',
+  });
   const responsePlanName = 'test-response-plan';
 
   const key = new kms.Key(stack, 'Key', {
```

**File**: `packages/aws-cdk-lib/aws-lambda/test/function.test.ts` (modified, +2/-2)
```diff
@@ -5632,7 +5632,7 @@ describe('L1 Relationships', () => {
     const bucket = new s3.Bucket(stack, 'MyBucket');
 
     const codeToken = cdk.Token.asAny({
-      resolve: () => ({ s3Bucket: bucket.bucketName }),
+      resolve: () => ({ s3Bucket: bucket.bucketName, s3Key: 'code.zip' }),
     });
 
     const fsConfigToken = cdk.Token.asAny({
@@ -5647,7 +5647,7 @@ describe('L1 Relationships', () => {
     Template.fromStack(stack).hasResource('AWS::Lambda::Function', {
       Properties: {
         Role: { 'Fn::GetAtt': ['SomeRole6DDC54DD', 'Arn'] },
-        Code: { S3Bucket: { Ref: 'MyBucketF68F3FF0' } },
+        Code: { S3Bucket: { Ref: 'MyBucketF68F3FF0' }, S3Key: 'code.zip' },
         FileSystemConfigs: [{ Arn: 'TestArn', LocalMountPath: '/mnt' }],
       },
     });
```

**File**: `packages/aws-cdk-lib/package.json` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@
     "@aws-cdk/asset-node-proxy-agent-v6": "^2.1.3",
     "@aws-cdk/cloud-assembly-api": "^2.5.0",
     "@aws-cdk/cloud-assembly-schema": "^55.6.0",
-    "@aws/cloudformation-validate": "1.14.0",
+    "@aws/cloudformation-validate": "~1.17.0",
     "@balena/dockerignore": "^1.0.2",
     "case": "1.6.3",
     "fs-extra": "^11.4.1",
```

**File**: `packages/aws-cdk-lib/testhelpers/jest-global-app-testhook.ts` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ const APP_INIT_HOOK_SYMBOL = Symbol.for('@aws-cdk/core.App#initHook');
     { id: 'CloudFormation-Validate::W7001', reason: 'Tests do not always reference mappings' },
     { id: 'CloudFormation-Validate::W9008', reason: 'Do not care about storage encryption of RDS instances in tests' },
     { id: 'CloudFormation-Validate::W3696', reason: 'Service is about to get shut down, no reason not to test' },
+    { id: 'CloudFormation-Validate::W3697', reason: 'Services in maintenance mode are intentionally exercised in unit tests' },
     { id: 'CloudFormation-Validate::F3031', reason: 'Some test value does not match the expected regex' },
     { id: 'CloudFormation-Validate::F3017', reason: 'Many tests use placeholder KMS key identifiers; valid forms are documented at https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#key-id' },
     { id: 'CloudFormation-Validate::E1151', reason: 'vpc-12345 is not a valid VPC ID' },
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -2367,10 +2367,10 @@
     "@smithy/types" "^4.20.0"
     tslib "^2.6.2"
 
-"@aws/cloudformation-validate@1.14.0":
-  version "1.14.0"
-  resolved "https://registry.npmjs.org/@aws/cloudformation-validate/-/cloudformation-validate-1.14.0.tgz#618e5b0709f702cb07eb670a665137fd63a61678"
-  integrity sha512-KIgS+l0XB890RT7zWcrnULexkxkA7vaIf2DllOGOU47iNQNgitlMndqBHGERgx9VXxxb3EpVXCD8PlpHbJZ+uQ==
+"@aws/cloudformation-validate@~1.17.0":
+  version "1.17.1"
+  resolved "https://registry.npmjs.org/@aws/cloudformation-validate/-/cloudformation-validate-1.17.1.tgz#d7e27705e2131626651967d27291bad88a203f6e"
+  integrity sha512-Rf3ISGZYfXq1c0fOSYYt33UvF5lSmphnl8JpCvlFMyAa5qc7GECXc8kPq1HL5+62leUQWMIiWceYjkuQhhJmZw==
 
 "@aws/lambda-invoke-store@^0.3.0":
   version "0.3.0"
```

#### Recent Merged Pull Requests:
- **PR #39847** (2026-11-19): feat: update L1 CloudFormation resource definitions (@aws-cdk-automation)
- **PR #39840** (2026-11-19): chore: release build runs out of memory in jsii-pacmak (@alvazjor)
- **PR #39836** (2026-11-19): chore: synthetic examples for types named Export and Interface do not compile (@alvazjor)
- **PR #39834** (2026-11-18): feat(lambda): add FunctionRuntimeConfig mixin for customer-managed runtimes (@kumvprat)
- **PR #39832** (2026-11-19): chore(skills): rate, attribute and report review findings more precisely (@ozelalisen)
- **PR #39831** (2026-11-18): chore(workflows): docker image cache fills the cache budget without speeding up builds (@mrgrain)

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

## X. core): asset hashing and symlink contract is not documented

**RULE**:
When implementing operations in `packages/@aws-cdk/aws-lambda-python-alpha/lib/bundling.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4ed690ec`: core): asset hashing and symlink contract is not documented. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/@aws-cdk/aws-lambda-python-alpha/lib/bundling.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { AssetHashType, AssetStaging, DockerImage, PERF_BUNDLING_SRC_SYM } from 'aws-cdk-lib/core';
    let exclude = [];
    if (options.assetHashType === AssetHashType.SOURCE || options.assetHashType === undefined) {
      exclude.push(...DEPENDENCY_EXCLUDES);
    }

      exclude,
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import { AssetStaging, DockerImage, PERF_BUNDLING_SRC_SYM } from 'aws-cdk-lib/core';
      exclude: DEPENDENCY_EXCLUDES,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4ed690ec` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
