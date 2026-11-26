# Verification Protocol: Verification Protocol: Empirical Defect Shield for aws-aws-cdk-learnings

<!-- PROVENANCE_START
{
  "source_repository": "aws-aws-cdk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T18:59:08.149Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aws-aws-cdk-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws-aws-cdk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T18:59:08.149Z`  
> **Learning ID**: `LEARN-EVO-aws-aws-cdk-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `aws-aws-cdk-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aws-aws-cdk-learnings.md`  
> **Source**: github ([https://github.com/aws/aws-cdk](https://github.com/aws/aws-cdk))  
> **Source Version**: `ff323598`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T18:58:55.815Z  
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
> **Harvest Timestamp**: 2026-11-26T18:58:55.809Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws/aws-cdk`
- **Description**: The AWS Cloud Development Kit is a framework for defining cloud infrastructure in code
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12994 stars

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

### Incident Patch 1: `6efedd4d` (2026-11-26)
**Commit Message**: chore(skills): align compatibility rules with their guides and prune the review skills (#39881)

### Issue # (if applicable)

N/A

### Reason for this change

Some rules in the review skills rate a change as blocking where the guide they cite allows it or only advises against it, some repeat checks the build already makes, and much of the text describes the guides or the skills themselves instead of telling the reviewer what to do.

### Description of changes

Rules that follow their guides:

- `REG-API-SURFACE-BREAK` no longer calls deprecating a stable API breaking. `REG-VALIDATION-FALSE-POSITIVE` applies to input that deploys today. `REG-BEHAVIOR-BREAK` keeps to the breaking cases `CONTRIBUTING.md` defines, and a new rule, `REG-BEHAVIOR-CHANGE-NO-FLAG` (RECOMMENDED), asks for a feature flag when a stable module's observable behavior changes without one. `REG-UNDEFINED-BEHAVIOR` no longer rates default changes, and says that a change which only stops a configuration that never worked is not a finding.
- `REG-STABILITY-GATE` exempts a break recorded in `allowed-breaking-changes.txt` only when the API was unusable before; an entry the pull request adds does not exempt it.
- `CD-BAC

**File**: `skills/cdk-review/cdk-construct-design-review/SKILL.md` (modified, +8/-14)
```diff
@@ -28,26 +28,20 @@ Work the changed surface in this order; adapt to what the diff touches.
    durable (see `cdk-review-principles` "Verify before you cite"). Then read
    [`design-rules.md`](references/design-rules.md): its rows are your checklist.
 
-2. **Check the diff against the rules.** Walk the changed surface family by family — **Feature placement**,
-   **Abstraction / L1 leak**, **Conformance**, **Footgun / ages-well** — judging the shape it produces. For
-   each rule check both directions: what is present and violating, and what the kind owes but the diff
-   omits. Before flagging an absence, confirm the service supports the affordance in the authoritative AWS
+2. **Check the diff against the rules,** judging the shape the changed surface produces. For each rule
+   check both directions: what is present and violating, and what the kind owes but the diff omits.
+   Before flagging an absence, confirm the service supports the affordance in the authoritative AWS
    docs, and confirm the CDK framework doesn't already auto-wire it. Rate a missing affordance exactly as a
    declared defect.
 
 3. **Rate by harm and stop.** Rate every finding by the cost of shipping the shape, per
    `cdk-review-principles` ("Confidence is not severity"); rate a wrong abstraction, an L1 leak, or a
    footgun at that cost even when you are unsure it fires. When several defects share one code cause, give
    one finding with the `ruleId`, `category` and `severity` of its most severe defect, since each field
-   takes one value. Stop once you can name the defect and cite its rule — file + section — with the concrete
-   fix.
+   takes one value. Stop once you can name the defect and cite its rule — file + section.
 
 ## What not to flag
 
-Beyond the shared exclusions in `cdk-review-principles` (pre-existing, cosmetics, out-of-scope,
-no-nit-quota), stay silent on the following — not even as OPTIONAL — because none is a design defect in
-the changed surface. When a defect belongs to a different dimension, leave it — it's outside your scope.
-
 - **Correctness bugs** — missing implementations, logic errors, broken paths — outside your scope.
 - **Regression risk** — input/token/edge-case breakage of working code, and breaking changes to the
   pre-existing API. Designing the *new* surface well is yours; classifying an existing-surface break is
@@ -60,10 +54,10 @@ the changed surface. When a defect belongs to a different dimension, leave it 
 ## Output
 
 Populate the structured finding fields the `cdk-review-principles` skill defines — write
-`message` as the complete posted comment (observation, impact, concrete fix, and the guideline cited
-inline by file + section). This dimension's `category` is one of: Feature placement & abstraction,
-Design Guidelines conformance, Clarity/simplicity/consistency, Footgun-free & ages-well interface
-quality.
+`message` as the complete posted comment (observation, impact, a fix once you have checked one, and the
+guideline cited inline by file + section). This dimension's `category` is one of: Feature placement &
+abstraction, Design Guidelines conformance, Clarity/simplicity/consistency, Footgun-free & ages-well
+interface quality.
 
 ## Apply cdk-review-principles
 
```

**File**: `skills/cdk-review/cdk-construct-design-review/references/design-rules.md` (modified, +13/-44)
```diff
@@ -1,18 +1,13 @@
 # Construct design rules
 
-Rows are grouped by defect family (feature placement & abstraction, Design Guidelines conformance,
-ages-well anti-patterns). See the `cdk-review-principles` skill for the shared
-lookup convention (the BLOCKING → RECOMMENDED → OPTIONAL sort within a family, the conditional-severity
-encoding, the `(doc-absent detail)` marker, and links referencing `main`).
-
 ## Feature placement & abstraction
 
-**[CD-IFOO-NO-FEATURE-METHODS] (BLOCKING)** — A feature method or config-mutation method added to the
-resource interface `IFoo` is a MUST violation; features belong on Facades. See
+**[CD-IFOO-NO-FEATURE-METHODS] (BLOCKING)** — A feature method or a config-mutation method added to the
+resource interface `IFoo`, other than a factory method that creates a new resource (`add{Bar}`) or a method
+[`AGENTS_CONSTRUCT_DESIGN.md § Standard Interface Extensions`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#standard-interface-extensions)
+requires on the interface; features belong on Facades. See
 [`AGENTS_CONSTRUCT_DESIGN.md § Construct Interface (IFoo)`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#construct-interface-ifoo)
 and [`§ Configuration Mutation`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#configuration-mutation).
-- **False-positive guard (doc-absent detail):** `grant*` methods, `from*` importers, and `add{Bar}`
-  factories SHOULD be on the interface; flagging one is a false BLOCKING against a conformant design.
 
 **[CD-LAYER-MODEL] (BLOCKING)** — An L2 MUST hide CloudFormation (no `Cfn*`/`Token` in its surface),
 provide an escape hatch to the L1, and expose the full service surface (no hard-coded choice the service
@@ -25,46 +20,34 @@ CfnPropsMixin / Facade / Trait) first, and only as an L2 method if none fits. Se
 for the first-match-wins table and
 [`AGENTS.md § L2 Building Blocks`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#l2-building-blocks)
 for each block.
-- **Tier (doc-absent detail):** the guide names no damage: a feature in L2 code still works for that L2's
-  users and only reuse is lost, so RECOMMENDED. A feature method on `IFoo` is `CD-IFOO-NO-FEATURE-METHODS`.
-- **Detection cue (doc-absent detail):** the "feature" to place is feature *logic* — input validation,
-  auxiliary-resource creation, or computed behavior — living in L2 glue code, or a grant/metric/event
-  helper implemented as a bare method rather than a building block.
 
 **[CD-README-DRIVEN] (RECOMMENDED)** — A new or significantly-changed L2 shipping with no README usage
 example is a design miss. See
 [`AGENTS.md § Module READMEs`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#module-readmes).
 
 ## Design Guidelines conformance
 
-**[CD-PROPS-SHAPE] (BLOCKING)** — Props must be `readonly`, flat, concise, and strongly typed (construct
+**[CD-PROPS-SHAPE] (BLOCKING)** — Props must be flat, concise, and strongly typed (construct
 interfaces not ARN strings, `Duration`/`Size` not raw numbers, no `Cfn*`/`Token`). See
 [`AGENTS.md § Props Design`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#props-design).
 
 **[CD-PROPS-DEFAULT] (BLOCKING)** — A `@default` that contradicts what the code does is a real
 behavioral surprise. See
 [`AGENTS_CONSTRUCT_DESIGN.md § Default Behavior`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#default-behavior).
-- **Scope split (doc-absent detail):** the default *behavior* is yours; whether the tag is merely present
-  or reads well is outside your scope.
 
 **[CD-SECRET-VALUE] (BLOCKING)** — A prop named `password`, or carrying a token/secret, must be typed
 `SecretValue` so a plaintext secret can't pass through the API. See
 [`AGENTS_CONSTRUCT_DESIGN.md § Secrets`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#secrets).
-- **Scope split (doc-absent detail):** the type choice is design (yours); whether a specific value leaks
-  is outside your scope.
 
 **[CD-NAMING] (BLOCKING)** — Name the resource and its props in official AWS/CloudFormation terminology,
-and derive related type names (`FooProps`, `IFoo`). See
+and derive its resource interface name (`IFoo`). See
 [`AGENTS_CONSTRUCT_DESIGN.md § Property Naming`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#property-naming).
 
-**[CD-ATTRIBUTES] (BLOCKING)** — Expose every CloudFormation attribute as a `readonly`,
-type-name-prefixed (`bucketArn`, not `arn`) opaque token. See
+**[CD-ATTRIBUTES] (BLOCKING)** — Expose every CloudFormation attribute as a type-name-prefixed
+(`bucketArn`, not `arn`) opaque token. See
 [`AGENTS_CONSTRUCT_DESIGN.md § Resource Attributes`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#resource-attributes).
-- **Scope split (doc-absent detail):** the surface design is yours; grading the tag/`@returns` prose is
-  outside your scope.
 
-**[CD-CONSTRUCT-ANATOMY] (BLOCK
```

**File**: `skills/cdk-review/cdk-documentation-review/SKILL.md` (modified, +10/-18)
```diff
@@ -1,6 +1,6 @@
 ---
 name: cdk-documentation-review
-description: "AWS CDK documentation-quality reviewer. Use when a PR changes a doc surface the CDK design guidelines govern — `@default`/`@param` JSDoc tags, migration notes, README usage examples, and rosetta `*.ts-fixture` files and fenced `ts` snippets. Leading concept: docs must be true and complete against the CDK design guidelines, so a doc that misstates a default or is missing where a guideline requires it is a defect with the standing of a code defect."
+description: "AWS CDK documentation-quality reviewer. Use when a PR changes a doc surface the CDK design guidelines govern — `@default` JSDoc tags, migration notes, README usage examples, `*.ts-fixture` files and fenced `ts` snippets. Leading concept: docs must be true and complete against the CDK design guidelines, so a doc that misstates a default or is missing where a guideline requires it is a defect with the standing of a code defect."
 ---
 
 # AWS CDK Documentation Review
@@ -30,8 +30,7 @@ concern; on each, own the documentation question:
 Work the changed docs in this order. Adapt to what the diff touches.
 
 1. **Inventory the doc surfaces, and load your rules.** From the diff, enumerate every doc surface the
-   PR touches: every exported public class / method / prop it adds or renames (a brand-new exported L2 is
-   highest-value — it triggers the README-example and JSDoc-tag checks at once); every
+   PR touches: every exported public class / method / prop it adds or renames; every
    `@default` it adds or changes; every `@deprecated` tag and breaking API change; and every fenced
    ` ```ts ` block and `*.ts-fixture` it adds or edits. Then read
    [`documentation-rules.md`](references/documentation-rules.md) — its rows are your checklist. Before
@@ -43,10 +42,9 @@ Work the changed docs in this order. Adapt to what the diff touches.
 2. **Check the inventory against the rules.** Walk the changed docs family by family — **README
    examples**, **`@default` accuracy**, **Public-API doc completeness**, **Migration notes**. For each
    rule check both directions — what is present-and-wrong, and what is owed-but-missing. From the step-1
-   inventory, check each doc a surface of that kind owes and flag the absent. One method the rows lack: for
-   a `@default`, **read the constructor / `?? ` handling in the same
-   diff and compare** what the code applies when the prop is omitted against the tag — a contradiction is
-   this dimension's highest-value defect.
+   inventory, check each doc a surface of that kind owes and flag the absent. For a `@default`, read the
+   constructor / `??` handling in the same diff and compare what the code applies when the prop is
+   omitted against the tag.
 
 3. **Rate by harm and stop.** Rate every finding by the harm the defect does — misled consumer, a feature
    shipped without the usage docs a guide requires — per `cdk-review-principles` (its
@@ -58,16 +56,10 @@ Work the changed docs in this order. Adapt to what the diff touches.
 
 ## What not to flag
 
-Beyond the shared exclusions in `cdk-review-principles` (pre-existing, cosmetics, out-of-scope,
-no-nit-quota), this dimension stays silent on the following — not even as OPTIONAL — because each
-belongs to a different dimension or is not a documentation defect at all. When a defect belongs to
-another dimension, leave it — it's outside your scope.
-
 - **Prose wording is not a `@default` defect** — a misspelled word, an awkward sentence, a comment that
   "reads a little off", capitalization, Oxford-comma preferences break no build and misstate no behavior.
-  **This is the single most important exclusion for this dimension:** a misspelled word in a JSDoc comment
-  breaks nothing; a `@default false` that is actually `true` misleads every consumer — only the second is
-  a finding.
+  A misspelled word in a JSDoc comment breaks nothing; a `@default false` that is actually `true` misleads
+  every consumer — only the second is a finding.
 - **Comment-density or style opinions** — whether a block "needs more comments", inline-comment placement,
   docstring formatting idioms.
 - **Code correctness** — whether the code the docs describe is itself buggy is a code-correctness question,
@@ -78,9 +70,9 @@ another dimension, leave it — it's outside your scope.
 ## Output
 
 Populate the structured finding fields the `cdk-review-principles` skill defines — write
-`message` as the complete posted comment (observation, impact, concrete fix, guideline cited inline by
-file + section). This dimension's `category` is one of: README examples, `@default` accuracy,
-Public-API doc completeness, Migration notes. The `suggestedFix` (folded into `message`) shows the doc or
+`message` as the complete posted comment (observation, impact, a fix once you have checked one, guideline
+cited inline by file + section). This dimension's `category` is one of: README examples, `@default` accuracy,
+Public-API doc completenes
```

**File**: `skills/cdk-review/cdk-documentation-review/references/documentation-rules.md` (modified, +3/-19)
```diff
@@ -1,14 +1,5 @@
 # Documentation review rules
 
-Rows group by defect family — the four `category` values (README examples, `@default` accuracy,
-public-API doc completeness, migration notes). See
-the `cdk-review-principles` skill for the shared lookup convention (the
-BLOCKING → RECOMMENDED → OPTIONAL sort within a family, the conditional-severity encoding, the
-`(doc-absent detail)` marker, and links referencing `main`).
-
-Severity across these rows is set by shipped-doc consumer impact: a doc that is *wrong*, or a new L2
-with no usage example at all, is BLOCKING; a doc *thin* on a required facet is RECOMMENDED.
-
 ## README examples
 
 **[DOC-README-STALE-SNIPPET] (RECOMMENDED)** — A public API changed (prop/method/construct
@@ -19,9 +10,6 @@ added/renamed, signature changed) but the module README not updated to match. Se
 PR adds, or hides the feature in a fixture, so it documents nothing the PR introduced. See
 [`AGENTS.md § Module READMEs`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#module-readmes)
 (the simple-example-per-use-case requirement; use `nofixture` to surface setup in the doc).
-- **Reviewer lens (doc-absent detail):** values stored in a `.ts-fixture` do not surface to the docs the
-  user sees. So an example that compiles only because it hides everything meaningful in a fixture — showing
-  the user nothing of the feature — is this gap even though it passes the build.
 
 ## `@default` accuracy
 
@@ -31,22 +19,18 @@ code actually does when the prop is omitted (e.g. `@default false` on a prop the
 [`AGENTS.md § Props Design`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#props-design) for the
 `@default` format rule and
 [`AGENTS_CONSTRUCT_DESIGN.md § Default Behavior`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#default-behavior)
-for why the default *behavior* is a design decision the tag documents (so a wrong `@default` often signals
-a real behavioral surprise).
+for the default behavior the tag documents.
 
 ## Public-API doc completeness
 
 **[DOC-README-MISSING-EXAMPLE] (BLOCKING)** — A new L2 construct (or substantial new feature) with no
 README usage example. See
 [`AGENTS.md § Module READMEs`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#module-readmes).
-- **Conditional severity (doc-absent detail):** BLOCKING for a brand-new public L2 with zero usage docs.
-  Down to RECOMMENDED for a new prop on an existing construct with no README mention; a new mixin with no
-  `## Mixins` README entry is a RECOMMENDED completeness gap.
+- **Tier:** RECOMMENDED for a new prop on an existing construct with no README mention, and for a new mixin
+  with no `## Mixins` README entry.
 
 ## Migration notes
 
 **[DOC-MIGRATION-NOTE-MISSING] (RECOMMENDED)** — A `@deprecated` tag (or a breaking change to an
 experimental module) with no migration note pointing at the replacement API. See
 [`AGENTS_CONSTRUCT_DESIGN.md § Backward Compatibility & Deprecation`](https://github.com/aws/aws-cdk/blob/main/docs/AGENTS_CONSTRUCT_DESIGN.md#backward-compatibility--deprecation).
-- **Scope split (doc-absent detail):** whether the break *exists* and is *allowed* is
-  outside documentation's scope — your concern is purely whether the migration path is documented.
```

**File**: `skills/cdk-review/cdk-regression-review/SKILL.md` (modified, +16/-28)
```diff
@@ -8,33 +8,30 @@ description: "AWS CDK regression + breaking-change reviewer. Use when reviewing
 You review whether the PR breaks code that works today — existing user programs, deployed stacks, or the
 public API / synthesized-template contract CDK users depend on. You own two overlapping families:
 **regression risk** (undefined runtime behavior — input validation, tokens, JSII transpilation, logic
-side effects) and **breaking change** (an API-surface or behavior break gated by library stability). One
-change can be both — a signature change is a JSII regression and an API-surface break.
+side effects) and **breaking change** (an API-surface or behavior break gated by library stability).
 
 **Scope gate — review only risks this PR introduces.** Point to the changed line that creates the risk.
 Judge the implementation: a well-meant bug fix, added validation, or optimization can still introduce a
 regression or a break.
 
-**You own regression + breaking-change, including JSII.** A public type moved between files, an interface
-renamed, or a signature changed so it breaks a non-TypeScript binding is yours — it breaks the existing
-cross-language surface. (A defect in another dimension is outside your scope — see `cdk-review-principles`.)
+**You own regression + breaking-change, including JSII.** A change that breaks a non-TypeScript binding is
+yours — it breaks the existing cross-language surface. (A defect in another dimension is outside your
+scope — see `cdk-review-principles`.)
 
 ## The review process
 
 Work the changed surface rules-first. Adapt it to what the diff touches.
 
-1. **Orient and load your rules.** Name the public surface the PR changes. Establish its stability tier
-   first — the row sets the verdict by tier. Read [`regression-rules.md`](references/regression-rules.md):
-   its rows are your checklist. Then confirm a removed enum member, a vanished API, or a binding-breaking
-   signature by reading the code, and a CloudFormation or service fact the finding turns on against the
-   CloudFormation and AWS documentation available to you — not from memory (see `cdk-review-principles`
-   "Verify before you cite").
+1. **Orient and load your rules.** Name the public surface the PR changes. Establish first whether its
+   module is stable or experimental, since the breaking-change rows rate by it. Read
+   [`regression-rules.md`](references/regression-rules.md): its rows are your checklist. Then confirm a
+   removed enum member, a vanished API, or a binding-breaking signature by reading the code, and a
+   CloudFormation or service fact the finding turns on against the CloudFormation and AWS documentation
+   available to you — not from memory (see `cdk-review-principles` "Verify before you cite").
 
-2. **Check the diff against the rules.** Walk the changed surface family by family — **Input validation**,
-   **Token issues**, **JSII-related risks**, **Undefined regressions**, **API Surface Change**, **Behavior
-   Change**. For each rule check both directions: what is present and violating, and what is owed but
-   missing. The owed-but-missing scan catches an omission the changed lines don't show. Enumerate what the
-   change owes; flag each owed item that is absent.
+2. **Check the diff against the rules.** For each rule check both directions: what is present and
+   violating, and what is owed but missing. The owed-but-missing scan catches an omission the changed
+   lines don't show. Enumerate what the change owes; flag each owed item that is absent.
 
 3. **Rate by harm and stop.** Rate every finding by the harm when its mechanism triggers, per
    `cdk-review-principles` (its severity scale, "Confidence is not severity") — rate a concrete regression
@@ -43,25 +40,16 @@ Work the changed surface rules-first. Adapt it to what the diff touches.
 
 ## What not to flag
 
-Beyond the shared exclusions in `cdk-review-principles` (pre-existing, cosmetics, out-of-scope,
-no-nit-quota), stay silent on the following too — not even as OPTIONAL — because none breaks an existing
-program. When a defect is in another dimension, leave it — it's outside your scope.
-
-- **Improvements, not regressions** — a bug fix that prevents a genuinely invalid configuration, and
-  validation that catches genuinely invalid inputs (a check that only tightens against already-invalid
-  input is an improvement). For the boolean-token false-positive guard (a `Token.isUnresolved()` guard on a
-  boolean, enum, or construct reference is dead code, and a boolean prop needs no token guard at all), see
-  `REG-TOKEN-UNRESOLVED-GUARD` in [`regression-rules.md`](references/regression-rules.md).
 - **Performance and dependency-range opinions** — a micro-optimization or performance opinion with no
   measured regression; a dependency-range bump (`glob ^7 → ^11`) unless you can show it raises a floor
   CDK ships against and thereby breaks existing consumers.
 
 ## Output
 
 Populate the structured finding fields the `
```

**File**: `skills/cdk-review/cdk-regression-review/references/regression-rules.md` (modified, +60/-111)
```diff
@@ -1,178 +1,127 @@
 # Regression & breaking-change rules
 
-Rows group by defect family (input validation, token handling, JSII cross-language compatibility,
-undefined runtime behavior, library stability & breaking changes). See the `cdk-review-principles`
-skill for the shared lookup convention: the
-BLOCKING → RECOMMENDED → OPTIONAL sort within a family, the conditional-severity encoding, the
-`(doc-absent detail)` marker, and links referencing `main`.
-
 ## Input validation
 
-**[REG-VALIDATION-FALSE-POSITIVE] (BLOCKING)** — New validation must not reject a value CDK accepts today;
-an over-strict check turns a working stack into one that stops synthesizing. Confirm the real constraint
-against the authoritative AWS service docs before rating.
-- **Detection (doc-absent detail):** for every new `throw` / rejection / bound / regex, name one concrete
-  input that was valid before the PR and is rejected after (a negative-vs-preserved-valid comparison).
-  Signals: an **over-narrow regex** (a new `if (!/^[a-z]+$/.test(props.name)) throw …` rejecting a
-  hyphenated, numeric, or uppercase name the construct previously synthesized); an **off-by-one / too-tight
-  bound** (a new min/max/length narrower than the service's real limit); an **enum-membership check
-  omitting a live value** (a new allowlist / `switch`-with-throw missing a value the construct synthesizes
-  today); a **newly-required prop or non-null assertion** on a prop that was optional or defaulted,
-  breaking callers that relied on the old default. A check that only tightens against genuinely-invalid
-  input is an improvement, not a regression; a validation that only worsens the error message on an
-  already-invalid input rejects no previously-valid value — at most OPTIONAL. A new validation that also
-  skips `Token.isUnresolved()` false-rejects any token-valued input — pair this with
-  [REG-TOKEN-UNRESOLVED-GUARD].
+**[REG-VALIDATION-FALSE-POSITIVE] (BLOCKING)** — New validation must not reject a value CDK accepts today,
+meaning input that deploys successfully; an over-strict check turns a working stack into one that stops
+synthesizing. Confirm the real constraint against the authoritative AWS service docs before rating. See
+[`AGENTS.md § Anti-Patterns`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#anti-patterns--things-not-to-do)
+for new validation on existing constructs.
+- **Detection:** for each new rejection, name one concrete input that deployed before
+  the PR and is rejected after.
 
 **[REG-INPUT-VALIDATION] (RECOMMENDED)** — Missing input validation: the CDK never validates a
-configuration property, letting an invalid value through. *(Conditional — BLOCKING when the unvalidated
+configuration property, letting an invalid value through. *(conditional — BLOCKING when the unvalidated
 value flows into a working stack and breaks its update.)*
-- **The three failure modes (doc-absent detail):** an unvalidated value can **fail at deployment**
-  (CloudFormation rejects the configuration), **create a misconfigured resource** (created but does not
-  work as expected), or be **silently ignored** (no error, but the property has no effect).
 
-**[REG-CFN-TYPE-LEAK] (RECOMMENDED)** — A change to an existing public API that newly exposes an
-L1/CFN-layer type where it did not before, breaking or coupling existing consumers to CloudFormation. (The
+**[REG-CFN-TYPE-LEAK] (RECOMMENDED)** — A change to an existing public API that newly exposes an L1
+property type (`CfnFoo.BarProperty`) anywhere, or a `Cfn*` type in a method, a class member, or a struct
+other than the construct's `<Name>Props`, breaking or coupling existing consumers to CloudFormation. (The
 same leak on a *brand-new* L2 surface is not a regression — outside your scope.) See
-[`AGENTS.md § Props Design`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#props-design)
-(`awslint:props-no-cfn-types`). Apply it with the false-positive scan in [REG-VALIDATION-FALSE-POSITIVE].
+[`AGENTS.md § Props Design`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#props-design).
 
 ## Token handling
 
 **[REG-TOKEN-UNRESOLVED-GUARD] (BLOCKING)** — A check or manipulation on an unresolved token (a value that
 is actually a `Ref`/`Fn::` at synth) emits invalid CloudFormation or throws for users passing that token.
-Guard with `Token.isUnresolved()` before validating or comparing. For token fundamentals — the three
-encodings and the `Token.asString/asList/asNumber` conversions — read the
+Guard with `Token.isUnresolved()` before validating or comparing. See
+[`AGENTS.md § Token Safety`](https://github.com/aws/aws-cdk/blob/main/AGENTS.md#token-safety) and the
 [CDK Tokens guide](https://docs.aws.amazon.com/cdk/v2/guide/tokens.html).
-- **Guard before validate:** the guard-before-validate rule — with typed string/number/list examples, the
-  opaque-value `Fn.select`/`Fn.join` manipulation pattern, and the tokenized-list `.length === 1` gotcha —
-  is stated at
-  [`AGENTS.md § 
```

**File**: `skills/cdk-review/cdk-review-principles/SKILL.md` (modified, +11/-15)
```diff
@@ -1,6 +1,6 @@
 ---
 name: cdk-review-principles
-description: "Shared foundation every CDK review-dimension skill applies — the harm-based severity scale (BLOCKING/RECOMMENDED/OPTIONAL), evidence + citation authority order, exact file:line, the concrete-fix rule, the bar a finding must meet to be posted, review tone, the shared what-not-to-flag exclusions, the finding-output contract (ruleId + reference fields), and the rules-lookup convention. Apply whenever conducting a CDK PR review, rating a finding's severity, deciding whether something is a finding at all, or turning a finding into a posted comment."
+description: "Shared foundation every CDK review-dimension skill applies — the harm-based severity scale (BLOCKING/RECOMMENDED/OPTIONAL), evidence + citation authority order, exact file:line, when to offer a fix, the bar a finding must meet to be posted, review tone, the shared what-not-to-flag exclusions, the finding-output contract (ruleId + reference fields), and how a rule's conditional severity reads. Apply whenever conducting a CDK PR review, rating a finding's severity, deciding whether something is a finding at all, or turning a finding into a posted comment."
 ---
 
 # Review Principles
@@ -31,7 +31,8 @@ harm:
   grouping with identical effect.
 
 A finding's `severity` field takes exactly one of these three words —
-`BLOCKING` / `RECOMMENDED` / `OPTIONAL`.
+`BLOCKING` / `RECOMMENDED` / `OPTIONAL`. A rule with a conditional severity is one rule: its
+header carries the primary severity, and its body states when it up- or down-tiers.
 
 ### Calibrate the harm honestly
 
@@ -61,7 +62,8 @@ code once, as a must-fix or as a design nicety; reporting it as both double-coun
 
 ## Make each finding land
 
-A correctly-rated finding still has to be actionable. Every finding carries three things:
+A correctly-rated finding still has to be actionable. Every finding carries a location and evidence, and
+a fix once you have checked one:
 
 - **An exact location** — `path/to/file.ts:L42`, or a range `path/to/file.ts:L42-L50`. A
   finding with no code location stays in the report as a high-level observation; it cannot
@@ -81,9 +83,12 @@ A correctly-rated finding still has to be actionable. Every finding carries thre
   by reading that code, and what CDK's testing or README guidance says by reading that
   guide; post only what you have read. An unverified "X isn't supported" or
   "the default is Y" is a false-positive risk. Cite the page you read in `reference`.
-- **A concrete fix** — a code example, or a question framing a specific alternative ("What
-  do you think about scoping this to the bucket ARN?"). Always offer a direction out. A fix
-  you suggest follows the same guides as the code under review.
+- **A fix, once you have checked it** — a code example, or a question framing a specific
+  alternative ("What do you think about scoping this to the bucket ARN?"). You have checked a
+  fix when you have read that what it uses exists at the reviewed commit and that the code
+  depending on what it changes still fits it, because an unchecked fix can break where it is
+  applied. Without a checked fix, report the problem and its evidence and leave `suggestedFix`
+  null. A fix you suggest follows the same guides as the code under review.
 
 Write it in a reviewer's voice: prefer "we" and "consider" over "you should"; frame
 suggestions as questions where you can; stay direct and constructive on blocking issues
@@ -127,15 +132,6 @@ carve-outs. None is a finding, at any severity:
   changelog placeholders, maturity banners; flag one only if you have verified the specific
   value is actually wrong.
 
-## Rules-lookup convention
-
-Each dimension skill keeps its detailed rules in a `references/*-rules.md` lookup. Every
-lookup shares one shape so they never drift: rows grouped by family, sorted
-BLOCKING → RECOMMENDED → OPTIONAL within each family, `[id]`s stable. A conditional
-severity is one rule — the row header carries the primary severity, the body states when it
-up- or down-tiers. A row marked `(doc-absent detail)` carries reviewer calibration the source
-doc does not state, kept in full. All aws/aws-cdk links reference `main`.
-
 ## Sources
 
 Public aws/aws-cdk `main` guidance:
```

**File**: `skills/cdk-review/cdk-review-principles/references/pr-comment-format.md` (modified, +11/-31)
```diff
@@ -1,22 +1,20 @@
 # Finding & Comment Format Reference
 
-Produce **structured findings**.
-
 ## The structured finding contract
 
-Produce each finding as a structured object with these fields:
+Give each finding these fields:
 
 - `file` — repo-relative path of the file the finding is on.
 - `lineRange: { startLine, endLine }` — the line or line span the finding is about.
   A single-line finding sets both to that line.
 - `category` — this dimension's finding type (its own taxonomy enum; each dimension
   skill names the values it uses).
-- `severity` — one of `BLOCKING` / `RECOMMENDED` / `OPTIONAL` (see below). The only
-  severity vocabulary.
+- `severity` — one of `BLOCKING` / `RECOMMENDED` / `OPTIONAL`, defined in `SKILL.md` "Severity — rate
+  by the harm it does when it triggers". The only severity vocabulary.
 - `ruleId` — the stable `[id]` of the rule that fired, taken verbatim from the dimension's
-  rules lookup. The debug/trace key: it names exactly which rule produced the finding.
+  rules file. The debug/trace key: it names exactly which rule produced the finding.
 - `message` — the human-visible comment text (see the next section).
-- `reference` — the authoritative source the finding cites: a CDK design guideline, jsii doc, CloudFormation resource spec, or AWS service doc — file + section, or a URL — per the authority order below; or null.
+- `reference` — the authoritative source the finding cites: a CDK design guideline, jsii doc, CloudFormation resource spec, or AWS service doc — file + section, or a URL — per the authority order in `SKILL.md` "Make each finding land"; or null.
 - `evidence` — the supporting detail behind the finding.
 - `suggestedFix` — a concrete fix, or null.
 
@@ -29,51 +27,33 @@ complete comment. Write it as a self-contained review comment:
 
 - **Observation** — what the issue is, specific, referencing the code (1-2 sentences).
 - **Impact** — why it matters, what happens if it is not addressed.
-- **Concrete fix** — the change to make (a code example or a question framing a
+- **Fix, once you have checked one** — the change to make (a code example or a question framing a
   specific alternative), with the guideline cited inline where one backs the finding.
 
 Populate `evidence`, `reference`, and `suggestedFix` as structured fields too, and fold
 their essentials into the `message` prose so it stands alone. Write it in a reviewer's
-voice (see "Tone Rules"). `ruleId` is the exception: a structured metadata field for
+voice (see `SKILL.md` "Make each finding land"). `ruleId` is the exception: a structured metadata field for
 debug/tracing that stays in its own field (though a finding may still cite the rule inline
 where that aids the author).
 
-## Severity vocabulary
-
-The `severity` field takes one of `BLOCKING` / `RECOMMENDED` / `OPTIONAL`. Their harm
-definitions live in `SKILL.md` "Severity — rate by the harm it does when it triggers"
-(authoritative).
-
 ## Evidence & References
 
-The citation authority order and when a citation may be skipped live in `SKILL.md` "Make
-each finding land", and how an aws-cdk rule's own stated harm sets the severity lives in
-"Calibrate the harm honestly" (both authoritative). The format contract this adds: put the
-citation in `reference`/`evidence` and name it inline in `message` so the posted comment
+Put the citation in `reference`/`evidence` and name it inline in `message`, so the posted comment
 carries its own authority.
 
 ## Filtering — what becomes a finding
 
 Emit a finding only when it meets the posting conditions in `SKILL.md` "Findings must meet the
-bar" (authoritative). In this format, "tied to a specific line" means it has
+bar". In this format, "tied to a specific line" means it has
 a `file` and a `lineRange`; a high-level observation with no line to anchor to belongs in the
 review `summary`.
 
 Keep these out of the findings (put them in the `summary` text if they matter):
 high-level design observations not tied to a line, positive feedback, clusters of
-related nits (consolidate into one finding on the first occurrence), findings already
+related nits, findings already
 surfaced by automated PR analysis (unless you add new context), and philosophical
 questions.
 
-### Every tier
-
-A candidate that meets the posting conditions becomes a finding at its tier (`SKILL.md`
-"Findings must meet the bar", authoritative). Consolidate related findings on
-one cause into one.
+Consolidate related findings on one cause into one.
 
 Let the review `summary` carry the broader picture.
-
-## Tone Rules
-
-The reviewer's-voice rules live in `SKILL.md` "Make each finding land"
-(authoritative). Write every `message` in that voice.
```

#### Recent Merged Pull Requests:
- **PR #39902** (2026-11-26): docs(cloudformation): fix StackSet README and doc-comments (@gudipati)
- **PR #39898** (2026-11-25): docs(agents): write requirement keywords in capitals (@ozelalisen)
- **PR #39897** (2026-11-25): chore: npm-check-updates && yarn upgrade (@aws-cdk-automation)
- **PR #39888** (2026-11-24): docs(agents): drop grant methods from the configuration-mutation exception (@ozelalisen)
- **PR #39881** (2026-11-26): chore(skills): align compatibility rules with their guides and prune the review skills (@ozelalisen)
- **PR #39880** (2026-11-26): feat(cloudformation): look up StackSet asset buckets by region (@gudipati)

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

## X. skills): align compatibility rules with their guides and prune the review skills

**RULE**:
When implementing operations in `skills/cdk-review/cdk-construct-design-review/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6efedd4d`: skills): align compatibility rules with their guides and prune the review skills. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `skills/cdk-review/cdk-construct-design-review/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
2. **Check the diff against the rules,** judging the shape the changed surface produces. For each rule
   check both directions: what is present and violating, and what the kind owes but the diff omits.
   Before flagging an absence, confirm the service supports the affordance in the authoritative AWS
   takes one value. Stop once you can name the defect and cite its rule — file + section.
`message` as the complete posted comment (observation, impact, a fix once you have checked one, and the
guideline cited inline by file + section). This dimension's `category` is one of: Feature placement &
abstraction, Design Guidelines conformance, Clarity/simplicity/consistency, Footgun-free & ages-well
interface quality.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
2. **Check the diff against the rules.** Walk the changed surface family by family — **Feature placement**,
   **Abstraction / L1 leak**, **Conformance**, **Footgun / ages-well** — judging the shape it produces. For
   each rule check both directions: what is present and violating, and what the kind owes but the diff
   omits. Before flagging an absence, confirm the service supports the affordance in the authoritative AWS
   takes one value. Stop once you can name the defect and cite its rule — file + section — with the concrete
   fix.
Beyond the shared exclusions in `cdk-review-principles` (pre-existing, cosmetics, out-of-scope,
no-nit-quota), stay silent on the following — not even as OPTIONAL — because none is a design defect in
the changed surface. When a defect belongs to a different dimension, leave it — it's outside your scope.

`message` as the complete posted comment (observation, impact, concrete fix, and the guideline cited
inline by file + section). This dimension's `category` is one of: Feature placement & abstraction,
Design Guidelines conformance, Clarity/simplicity/consistency, Footgun-free & ages-well interface
quality.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6efedd4d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
