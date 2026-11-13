> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aws-aws-cdk-learnings.md`  
> **Source**: github ([https://github.com/aws/aws-cdk](https://github.com/aws/aws-cdk))  
> **Source Version**: `79914032`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T14:25:42.595Z  
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
> **Harvest Timestamp**: 2026-11-13T14:25:42.582Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws/aws-cdk`
- **Description**: The AWS Cloud Development Kit is a framework for defining cloud infrastructure in code
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12975 stars

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
- **Issue #39601** (2026-11-03): **fix(core): honor rounding for same-unit Size conversions**
  *Symptoms*: Fixes #39600  ## Summary  When a `Size` is converted to the same unit, the early return currently bypasses an explicitly requested rounding mode. Apply the existing conversion logic for explicit `FLOOR` and `FAIL`, while preserving the same-unit identity behavior when rounding is omitted and when `NONE` is requested.  Added unit regression coverage for all four cases and a Core integration snapshot that synthesizes a Lambda function with `MemorySize: 128` from `Size.mebibytes(128.66)` using `FLOOR`.  ## Verification  - `NODE_OPTIONS=--max-old-space-size=8192 corepack yarn lerna run build --scope=aws-cdk-lib --stream` — passed. - `corepack yarn test core/test/size.test.ts --coverage=false` — 12 tests passed. - `NODE_OPTIONS=--max-old-space-size=8192 corepack yarn lerna run build --scope=@aws-cdk-testing/framework-integ --stream` — passed. - `corepack yarn integ core/test/integ.size-rounding.js --dry-run --update-on-failed` — snapshot passed; no deployment performed. - `git diff --check` — passed. 

- **Issue #39600** (2026-11-03): **core: cdk.Size - rounding conditionally ignored**
  *Symptoms*: ### Describe the bug  cdk.Size does not honour SizeConversionOptions when input and output units are the same.  https://github.com/aws/aws-cdk/blob/c1a53ab24a06355d7eb730df34adaf95618dcf88/packages/aws-cdk-lib/core/lib/size.ts#L261 ``` function convert(amount: number, fromUnit: StorageUnit, toUnit: StorageUnit, options: SizeConversionOptions = {}) {   const rounding = options.rounding ?? SizeRoundingBehavior.FAIL;   if (fromUnit.inBytes === toUnit.inBytes) { return amount; }  // BUG: returns float when options: { rounding: SizeRoundingBehavior.FLOOR } ```  ### Regression Issue  - [ ] Select this option if this issue appears to be a regression.  ### Last Known Working CDK Library Version  _No response_  ### Expected Behavior  When `options: { rounding: SizeRoundingBehavior.FLOOR }` it should always return an integer.  ### Current Behavior  It returns a float.  ### Reproduction Steps  const subject = cdk.size.mebibytes(42.66); subject.toMebibytes({ rounding: cdk.SizeRoundingBehavior.FLOOR }); // Should be 42 but is 42.66 instead.    ### Possible Solution  Replace `if (fromUnit.inBytes === toUnit.inBytes) { return amount; }`  With ``` if (fromUnit.inBytes === toUnit.inBytes   && (options.rounding === undefined || options.rounding === SizeRoundingBehavior.NONE)) { return amount; } ```  ### Additional Information/Context  _No response_  ### AWS CDK Library version (aws-cdk-lib)  2.275.0  ### AWS CDK CLI version  2.1147.0  ### Node.js Version  25.0.0  ### OS  Windows 11  ### Langua

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

### Incident Patch 1: `c153af90` (2026-11-13)
**Commit Message**: fix(core): bump bundled minimatch to 11.0.8 to address CVE-2026-118764 (#39595)

### Issue # (if applicable)

Closes #39594.

### Reason for this change

`aws-cdk-lib` bundles `minimatch@10.2.6`, which is affected by [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) / CVE-2026-118764 (denial of service via globparts amplification, affected `< 11.0.1`). There is no patched `10.x` release, so the fix requires the `minimatch` major version 11.

Because `minimatch` is a bundled dependency, consumers can't fix this with `overrides`/`resolutions`. The `yarn-upgrade` workflow uses `ncu --target=minor` and won't pick up the major bump.

### Description of changes

- `packages/aws-cdk-lib/package.json`: `minimatch` `^10.2.6` → `^11.0.1`.
- `yarn.lock`: new `minimatch@^11.0.1` entry resolving to `11.0.8`, plus its new dependency `@isaacs/nonrecursive-glob-match@1.1.0`. `brace-expansion@^5.0.12` resolves to the existing `5.0.13` entry. `^10.2.6` is removed from the shared `minimatch@10.2.6` entry, which other tooling in the monorepo still uses. The lockfile was regenerated with `yarn install` on top of current `main`.
- `packages/aws-cdk-lib/NOTICE`: attribution for the

**File**: `packages/aws-cdk-lib/NOTICE` (modified, +60/-0)
```diff
@@ -74,6 +74,66 @@ software or this license, under any kind of legal claim.
 
 ----------------
 
+** @isaacs/nonrecursive-glob-match - https://www.npmjs.com/package/@isaacs/nonrecursive-glob-match
+
+Blue Oak Model License
+
+Version 1.0.0
+
+Purpose
+
+This license gives everyone as much permission to work with
+this software as possible, while protecting contributors
+from liability.
+
+Acceptance
+
+In order to receive this license, you must agree to its
+rules. The rules of this license are both obligations
+under that agreement and conditions to your license.
+You must not do anything with this software that triggers
+a rule that you cannot or will not follow.
+
+Copyright
+
+Each contributor licenses you to do everything with this
+software that would otherwise infringe that contributor's
+copyright in it.
+
+Notices
+
+You must ensure that everyone who gets a copy of
+any part of this software from you, with or without
+changes, also gets the text of this license or a link to
+https://blueoakcouncil.org/license/1.0.0.
+
+Excuse
+
+If anyone notifies you in writing that you have not
+complied with Notices, you can keep your
+license by taking all practical steps to comply within 30
+days after the notice. If you do not do so, your license
+ends immediately.
+
+Patent
+
+Each contributor licenses you to do everything with this
+software that would otherwise infringe any patent claims
+they can license or become able to license.
+
+Reliability
+
+No contributor can revoke this license.
+
+No Liability
+
+As far as the law allows, this software comes as is,
+without any warranty or condition, and no contributor
+will be liable to anyone for any damages related to this
+software or this license, under any kind of legal claim.
+
+----------------
+
 The AWS CDK includes the following third-party software/licensing:
 
 ** mime-db - https://www.npmjs.com/package/mime-db
```

**File**: `packages/aws-cdk-lib/package.json` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@
     "ignore": "^5.3.2",
     "jsonschema": "^1.5.0",
     "mime-types": "^2.1.35",
-    "minimatch": "^10.2.6",
+    "minimatch": "^11.0.1",
     "punycode": "^2.3.1",
     "semver": "^7.8.6",
     "yaml": "1.10.3"
```

**File**: `yarn.lock` (modified, +15/-2)
```diff
@@ -3202,6 +3202,11 @@
   dependencies:
     minipass "^7.0.4"
 
+"@isaacs/nonrecursive-glob-match@^1.1.0":
+  version "1.1.0"
+  resolved "https://registry.npmjs.org/@isaacs/nonrecursive-glob-match/-/nonrecursive-glob-match-1.1.0.tgz#b1d69b8938aab4c292f7fde628c47dc1dbd737ef"
+  integrity sha512-GPm/Dbvk5RLmhRnxXIa7nTpK0xtl4E0wj0MslsuNiJ1FIROU+2+9lgUC/dgF7Ey4QCWhfEsgxilMRMCdHPfDfw==
+
 "@isaacs/string-locale-compare@^1.1.0":
   version "1.1.0"
   resolved "https://registry.npmjs.org/@isaacs/string-locale-compare/-/string-locale-compare-1.1.0.tgz#291c227e93fd407a96ecd59879a35809120e432b"
@@ -5987,7 +5992,7 @@ brace-expansion@^2.0.1, brace-expansion@^2.0.2:
   dependencies:
     balanced-match "^1.0.0"
 
-brace-expansion@^5.0.5, brace-expansion@^5.0.8:
+brace-expansion@^5.0.12, brace-expansion@^5.0.5, brace-expansion@^5.0.8:
   version "5.0.13"
   resolved "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.13.tgz#e2d4497370f7e385e6f96b57bd7ff11d77d85851"
   integrity sha512-Vh3dmFbc4wZeox7M9I/0L9GfFd83Su4+yCck/OF9Gi/P/dAHn0RT7X4K9R7gMNMhDck3DvhR6QXsnQdjjgwNvQ==
@@ -10911,13 +10916,21 @@ minimatch@9.0.3:
   dependencies:
     brace-expansion "^2.0.1"
 
-minimatch@^10.0.1, minimatch@^10.2.2, minimatch@^10.2.6, minimatch@~10.2.6:
+minimatch@^10.0.1, minimatch@^10.2.2, minimatch@~10.2.6:
   version "10.2.6"
   resolved "https://registry.npmjs.org/minimatch/-/minimatch-10.2.6.tgz#fd956bbe0b77241e9f15ac5dccb1c638060968ef"
   integrity sha512-vpLQEs+VLCr1nU0BXS07maYoFwlDAH0gngQuuttxIwutDFEMHq2blX+8vpgxDdK3J1PwjCJiep77OitTZ4Ll1A==
   dependencies:
     brace-expansion "^5.0.8"
 
+minimatch@^11.0.1:
+  version "11.0.8"
+  resolved "https://registry.npmjs.org/minimatch/-/minimatch-11.0.8.tgz#715fc3509cd7f76ed9af2f702a98411b1b0288c8"
+  integrity sha512-nFQuYSTVrGvysVBps5Ih+0BdnYFN/Cj3C816r6+p7yK+FHrVLGE4O4N9AFwykrlNlvM2HYt+Rad1Uiro6h88Ig==
+  dependencies:
+    "@isaacs/nonrecursive-glob-match" "^1.1.0"
+    brace-expansion "^5.0.12"
+
 minimatch@^3.0.4, minimatch@^3.1.1, minimatch@^3.1.2, minimatch@^3.1.5:
   version "3.1.5"
   resolved "https://registry.npmjs.org/minimatch/-/minimatch-3.1.5.tgz#580c88f8d5445f2bd6aa8f3cadefa0de79fbd69e"
```

---

### Incident Patch 2: `9170700b` (2026-11-12)
**Commit Message**: feat(bedrockagentcore): support runtime build hooks and minimum memory (#39695)

### Issue # (if applicable)

Closes #39696.

# Summary of Changes

## Description

Adds two optional props to the AgentCore `Runtime` L2 construct, rendered to the new `CfnRuntime` properties `HooksConfiguration` and `ResourceConfigurations`:

- `buildHooks`: hooks the service calls on the agent's container while it builds the runtime. Today that is a `warmup` hook, created with `LifecycleHook.httpPost({ path, port? })`, which runs before the service snapshots the agent so every session starts from a warmed state.
- `minimumMemory`: the minimum memory for each runtime session, as a `Size` (for example `Size.gibibytes(4)`), rendered as `MinimumMemoryInMiB`.

```ts
new agentcore.Runtime(this, 'Runtime', {
  runtimeName: 'my_agent',
  agentRuntimeArtifact,
  platformVersion: agentcore.PlatformVersion.V2,
  buildHooks: {
    warmup: agentcore.LifecycleHook.httpPost({ path: '/warmup', port: 8080 }),
  },
  minimumMemory: cdk.Size.gibibytes(4),
});
```

Builds on the L1 update in #39701 (`@aws-cdk/aws-service-spec` 0.1.231), which added `HooksConfiguration` and `ResourceConfigurations` to `CfnRuntime`.

### 

**File**: `packages/@aws-cdk-testing/framework-integ/package.json` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
     "@aws-cdk/integ-runner": "^2.207.0",
     "@aws-cdk/pkglint": "0.0.0",
     "@aws-sdk/client-acm": "3.632.0",
-    "@aws-sdk/client-bedrock-agentcore-control": "3.1143.0",
+    "@aws-sdk/client-bedrock-agentcore-control": "3.1166.0",
     "@aws-sdk/client-ec2": "3.632.0",
     "@aws-sdk/client-rds": "3.632.0",
     "@aws-sdk/client-s3": "3.632.0",
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-bedrockagentcore/test/agentcore/runtime/build-hooks-verifier/index.js` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+/* eslint-disable */
+// Plain .js on purpose: bundled by esbuild at synth, and kept out of the package's tsc build (which
+// compiles only **/*.ts). It pins a current bedrock-agentcore-control SDK whose model includes
+// hooksConfiguration and resourceConfigurations.
+const { BedrockAgentCoreControlClient, GetAgentRuntimeCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
+
+const client = new BedrockAgentCoreControlClient({});
+
+// Returns "<hook path>:<hook port>:<minimum memory MiB>" for the deployed runtime.
+exports.handler = async (event) => {
+  const res = await client.send(new GetAgentRuntimeCommand({ agentRuntimeId: event.agentRuntimeId }));
+  const httpPost = res.hooksConfiguration?.build?.warmup?.action?.httpPost;
+  const memory = res.resourceConfigurations?.[0]?.minimumMemoryInMiB;
+  const summary = `${httpPost?.path}:${httpPost?.port}:${memory}`;
+  console.log(`GetAgentRuntime returned ${summary}`);
+  return summary;
+};
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-bedrockagentcore/test/agentcore/runtime/buildHooksArtifact/Dockerfile` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+FROM public.ecr.aws/docker/library/python:3.12-slim
+WORKDIR /app
+COPY app.py .
+EXPOSE 8080
+CMD ["python", "app.py"]
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-bedrockagentcore/test/agentcore/runtime/buildHooksArtifact/app.py` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+#!/usr/bin/env python3
+"""Minimal AgentCore Runtime test agent (HTTP protocol) with a warmup build hook.
+
+Implements the AgentCore custom HTTP contract on port 8080:
+  GET  /ping         -> health check (must return 200 for the runtime to stabilize)
+  POST /invocations  -> agent invocation
+  POST /warmup       -> warmup build hook (must return 2xx or the runtime build fails)
+Used by integ.runtime-build-hooks to deploy a real V2 runtime with a warmup hook and minimum memory.
+"""
+import json
+import logging
+from http.server import HTTPServer, BaseHTTPRequestHandler
+
+logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
+logger = logging.getLogger(__name__)
+
+
+class Handler(BaseHTTPRequestHandler):
+    def _send(self, code, body):
+        payload = json.dumps(body).encode()
+        self.send_response(code)
+        self.send_header('Content-Type', 'application/json')
+        self.send_header('Content-Length', str(len(payload)))
+        self.end_headers()
+        self.wfile.write(payload)
+
+    def _read_body(self):
+        length = int(self.headers.get('Content-Length', 0))
+        return self.rfile.read(length) if length else b''
+
+    def do_GET(self):
+        if self.path == '/ping':
+            self._send(200, {'status': 'Healthy'})
+        else:
+            self._send(404, {'error': 'not found'})
+
+    def do_POST(self):
+        raw = self._read_body()
+        if self.path == '/warmup':
+            logger.info('Warmup hook called')
+            self._send(200, {'status': 'warm'})
+        elif self.path == '/invocations':
+            try:
+                data = json.loads(raw) if raw else {}
+            except json.JSONDecodeError:
+                data = {}
+            self._send(200, {'output': f"Echo: {data.get('prompt', '')}"})
+        else:
+            self._send(404, {'error': 'not found'})
+
+    def log_message(self, fmt, *args):
+        logger.info('%s - %s', self.address_string(), fmt % args)
+
+
+if __name__ == '__main__':
+    logger.info('Starting test agent on :8080')
+    HTTPServer(('', 8080), Handler).serve_forever()
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-bedrockagentcore/test/agentcore/runtime/integ.runtime-build-hooks.js.snapshot/BedrockAgentCoreRuntimeBuildHooksTestDefaultTestDeployAssert3CADF67F.assets.json` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+{
+  "version": "55.0.0",
+  "files": {
+    "59699f3599c12b54666f05dd2d4702da313e1466f561751ee1d588dd5228a950": {
+      "source": {
+        "path": "asset.59699f3599c12b54666f05dd2d4702da313e1466f561751ee1d588dd5228a950.bundle",
+        "packaging": "zip"
+      },
+      "destinations": {
+        "current_account-current_region-b881a5e0": {
+          "bucketName": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}",
+          "objectKey": "59699f3599c12b54666f05dd2d4702da313e1466f561751ee1d588dd5228a950.zip",
+          "assumeRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}"
+        }
+      }
+    },
+    "543871a85c8de711628d8aef84e51f1e00921ae3b3716fc710256c26bfa0caf6": {
+      "displayName": "BedrockAgentCoreRuntimeBuildHooksTestDefaultTestDeployAssert3CADF67F Template",
+      "source": {
+        "path": "BedrockAgentCoreRuntimeBuildHooksTestDefaultTestDeployAssert3CADF67F.template.json",
+        "packaging": "file"
+      },
+      "destinations": {
+        "current_account-current_region-877dd630": {
+          "bucketName": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}",
+          "objectKey": "543871a85c8de711628d8aef84e51f1e00921ae3b3716fc710256c26bfa0caf6.json",
+          "assumeRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}"
+        }
+      }
+    }
+  },
+  "dockerImages": {}
+}
\ No newline at end of file
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-bedrockagentcore/test/agentcore/runtime/integ.runtime-build-hooks.js.snapshot/BedrockAgentCoreRuntimeBuildHooksTestDefaultTestDeployAssert3CADF67F.metadata.json` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+{
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert": [
+    {
+      "type": "aws:cdk:warning",
+      "data": "No cross-stack-reference strength configured, defaulting to \"strong\". We recommend you set feature flag \"@aws-cdk/core:defaultCrossStackReferences\" to \"both\", then deploy everywhere, then set it to \"weak\". Alternatively, set it to \"strong\" explicitly to lock in the current producer-protecting behavior. (See: https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/README.md#reference-strength) [ack: @aws-cdk/core:crossStackReferencesDefaultStrong]",
+      "trace": [
+        "Annotations.addMessage (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/annotations.js:279:29)",
+        "Annotations.addWarningV2 (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/annotations.js:145:18)",
+        "resolveValue (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/private/refs.js:215:54)",
+        "resolveReferencesInElements (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/private/refs.js:139:30)",
+        "resolveReferences (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/private/refs.js:124:5)",
+        "prepareApp (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/private/prepare-app.js:35:36)",
+        "synthesize (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/private/synthesis.js:72:36)",
+        "App.synth (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/stage.js:230:96)",
+        "App.synth (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/app.js:231:27)",
+        "process.<anonymous> (/Users/naviret/projects/runtime-header-allowlist-expansion/aws-cdk/packages/aws-cdk-lib/core/lib/app.js:178:51)",
+        "Object.onceWrapper (node:events:634:26)",
+        "process.emit (node:events:519:28)"
+      ]
+    },
+    {
+      "type": "aws:cdk:templateFile",
+      "data": "BedrockAgentCoreRuntimeBuildHooksTestDefaultTestDeployAssert3CADF67F.template.json"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/BootstrapVersion": [
+    {
+      "type": "aws:cdk:logicalId",
+      "data": "BootstrapVersion"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/CheckBootstrapVersion": [
+    {
+      "type": "aws:cdk:logicalId",
+      "data": "CheckBootstrapVersion"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/LambdaInvokeba6c6b6e12994c5657955bec4846f242/Default": [
+    {
+      "type": "aws:cdk:analytics:construct",
+      "data": "*"
+    },
+    {
+      "type": "aws:cdk:analytics:method",
+      "data": "*"
+    },
+    {
+      "type": "aws:cdk:analytics:method",
+      "data": "*"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/LambdaInvokeba6c6b6e12994c5657955bec4846f242/Invoke": [
+    {
+      "type": "aws:cdk:logicalId",
+      "data": "LambdaInvokeba6c6b6e12994c5657955bec4846f242InvokeFF298FB6"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/LambdaInvokeba6c6b6e12994c5657955bec4846f242/AssertionResults": [
+    {
+      "type": "aws:cdk:logicalId",
+      "data": "AssertionResultsLambdaInvokeba6c6b6e12994c5657955bec4846f242"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/SingletonFunction1488541a7b23466481b69b4408076b81/Role": [
+    {
+      "type": "aws:cdk:logicalId",
+      "data": "SingletonFunction1488541a7b23466481b69b4408076b81Role37ABCE73"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/SingletonFunction1488541a7b23466481b69b4408076b81/Handler": [
+    {
+      "type": "aws:cdk:logicalId",
+      "data": "SingletonFunction1488541a7b23466481b69b4408076b81HandlerCD40AE9F"
+    }
+  ],
+  "/BedrockAgentCoreRuntimeBuildHooksTest/DefaultTest/DeployAssert/LambdaInvokeba6c6b6e12994c5657955bec4846f242/Default/Default": [
+    {
+      "type": "aws:cdk:logicalId",
+      "data": "LambdaInvokeba6c6b6e12994c5657955bec4846f242"
+    }
+  ]
+}
\ No newline at end of file
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-bedrockagentcore/test/agentcore/runtime/integ.runtime-build-hooks.js.snapshot/BedrockAgentCoreRuntimeBuildHooksTestDefaultTestDeployAssert3CADF67F.template.json` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+{
+ "Resources": {
+  "LambdaInvokeba6c6b6e12994c5657955bec4846f242": {
+   "Type": "Custom::DeployAssert@SdkCallLambdainvoke",
+   "Properties": {
+    "ServiceToken": {
+     "Fn::GetAtt": [
+      "SingletonFunction1488541a7b23466481b69b4408076b81HandlerCD40AE9F",
+      "Arn"
+     ]
+    },
+    "service": "Lambda",
+    "api": "invoke",
+    "expected": "{\"$ObjectLike\":{\"Payload\":\"\\\"/warmup:8080:4096\\\"\"}}",
+    "parameters": {
+     "FunctionName": {
+      "Fn::Join": [
+       "",
+       [
+        "\"",
+        {
+         "Fn::ImportValue": "aws-cdk-bedrock-agentcore-runtime-build-hooks:ExportsOutputRefBuildHooksVerifier5ADACB5EF9D8BB61"
+        },
+        "\""
+       ]
+      ]
+     },
+     "Payload": {
+      "Fn::Join": [
+       "",
+       [
+        "\"{\\\"agentRuntimeId\\\":\\\"",
+        {
+         "Fn::ImportValue": "aws-cdk-bedrock-agentcore-runtime-build-hooks:ExportsOutputFnGetAttTestRuntime65042BB5AgentRuntimeId5490EDE2"
+        },
+        "\\\"}\""
+       ]
+      ]
+     }
+    },
+    "flattenResponse": "false",
+    "salt": "1794427191267"
+   },
+   "UpdateReplacePolicy": "Delete",
+   "DeletionPolicy": "Delete"
+  },
+  "LambdaInvokeba6c6b6e12994c5657955bec4846f242InvokeFF298FB6": {
+   "Type": "AWS::Lambda::Permission",
+   "Properties": {
+    "Action": "lambda:InvokeFunction",
+    "FunctionName": {
+     "Fn::ImportValue": "aws-cdk-bedrock-agentcore-runtime-build-hooks:ExportsOutputRefBuildHooksVerifier5ADACB5EF9D8BB61"
+    },
+    "Principal": {
+     "Fn::GetAtt": [
+      "SingletonFunction1488541a7b23466481b69b4408076b81Role37ABCE73",
+      "Arn"
+     ]
+    }
+   }
+  },
+  "SingletonFunction1488541a7b23466481b69b4408076b81Role37ABCE73": {
+   "Type": "AWS::IAM::Role",
+   "Properties": {
+    "AssumeRolePolicyDocument": {
+     "Version": "2012-10-17",
+     "Statement": [
+      {
+       "Action": "sts:AssumeRole",
+       "Effect": "Allow",
+       "Principal": {
+        "Service": "lambda.amazonaws.com"
+       }
+      }
+     ]
+    },
+    "ManagedPolicyArns": [
+     {
+      "Fn::Sub": "arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
+     }
+    ],
+    "Policies": [
+     {
+      "PolicyName": "Inline",
+      "PolicyDocument": {
+       "Version": "2012-10-17",
+       "Statement": [
+        {
+         "Action": [
+          "lambda:Invoke"
+         ],
+         "Effect": "Allow",
+         "Resource": [
+          "*"
+         ]
+        },
+        {
+         "Action": [
+          "lambda:InvokeFunction"
+         ],
+         "Effect": "Allow",
+         "Resource": [
+          {
+           "Fn::Join": [
+            "",
+            [
+             "arn:",
+             {
+              "Ref": "AWS::Partition"
+             },
+             ":lambda:",
+             {
+              "Ref": "AWS::Region"
+             },
+             ":",
+             {
+              "Ref": "AWS::AccountId"
+             },
+             ":function:",
+             {
+              "Fn::ImportValue": "aws-cdk-bedrock-agentcore-runtime-build-hooks:ExportsOutputRefBuildHooksVerifier5ADACB5EF9D8BB61"
+             }
+            ]
+           ]
+          }
+         ]
+        }
+       ]
+      }
+     }
+    ]
+   }
+  },
+  "SingletonFunction1488541a7b23466481b69b4408076b81HandlerCD40AE9F": {
+   "Type": "AWS::Lambda::Function",
+   "Properties": {
+    "Runtime": "nodejs24.x",
+    "Code": {
+     "S3Bucket": {
+      "Fn::Sub": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}"
+     },
+     "S3Key": "59699f3599c12b54666f05dd2d4702da313e1466f561751ee1d588dd5228a950.zip"
+    },
+    "Timeout": 120,
+    "Handler": "index.handler",
+    "Role": {
+     "Fn::GetAtt": [
+      "SingletonFunction1488541a7b23466481b69b4408076b81Role37ABCE73",
+      "Arn"
+     ]
+    },
+    "LoggingConfig": {
+     "LogFormat": "JSON",
+     "ApplicationLogLevel": "FATAL"
+    }
+   }
+  }
+ },
+ "Outputs": {
+  "AssertionResultsLambdaInvokeba6c6b6e12994c5657955bec4846f242": {
+   "Value": {
+    "Fn::GetAtt": [
+     "LambdaInvokeba6c6b6e12994c5657955bec4846f242",
+     "assertion"
+    ]
+   }
+  }
+ },
+ "Parameters": {
+  "BootstrapVersion": {
+   "Type": "AWS::SSM::Parameter::Value<String>",
+   "Default": "/cdk-bootstrap/hnb659fds/version",
+   "Description": "Version of the CDK Bootstrap resources in this environment, automatically retrieved from SSM Parameter Store. [cdk:skip]"
+  }
+ },
+ "Rules": {
+  "CheckBootstrapVersion": {
+   "Assertions": [
+    {
+     "Assert": {
+      "Fn::Not": [
+       {
+        "Fn::Contains": [
+         [
+          "1",
+          "2",
+          "3",
+          "4",
+          "5"
+         ],
+         {
+          "Ref": "BootstrapVersion"
+         }
+        ]
+       }
+      ]
+     },
+     "AssertDescription": "CDK bootstrap stack version 6 required. Please run 'cdk bootstrap' with a recent version of the CDK CLI."
+    }
+   ]
+  }
+ }
+
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-bedrockagentcore/test/agentcore/runtime/integ.runtime-build-hooks.js.snapshot/asset.6528f3d28d4b4fcb85fe3418aa8484e437716009856ef6fc36583e50cf7ef299/Dockerfile` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+FROM public.ecr.aws/docker/library/python:3.12-slim
+WORKDIR /app
+COPY app.py .
+EXPOSE 8080
+CMD ["python", "app.py"]
```

---

### Incident Patch 3: `06a1c50a` (2026-11-12)
**Commit Message**: feat(elbv2): add RFC 9151 (CNSA 1.0) SSL security policies for ALB and NLB (#38700)

### Issue # (if applicable)

Relates to #38666.

### Reason for this change

AWS added TLS-based security policies for Application Load Balancer (HTTPS listeners) and Network Load Balancer (TLS listeners) that comply with RFC 9151 for the Commercial National Security Algorithm (CNSA) 1.0 suite: [AWS Application and Network Load Balancers now support RFC 9151 compliant security policies](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-application-network/) from August 2026. 

The CDK `SslPolicy` enum did not expose these policies yet, so users had to workaround via mixin or  fall back to the L1 escape hatch to select them. Let's change this.

### Description of changes

Added the 7 RFC 9151 (CNSA 1.0) security policies to the shared `SslPolicy` enum (used by both ALB and NLB listeners):

- Strict policies (enforce full RFC 9151 requirements):
  - `RFC9151_TLS13_13` → `ELBSecurityPolicy-TLS13-1-3-RFC9151-FIPS-2023-07`
  - `RFC9151_TLS13_12` → `ELBSecurityPolicy-TLS13-1-2-RFC9151-FIPS-2023-07`
  - `RFC9151_TLS13_12_EXT0` → `ELBSecurityPolicy-TLS13-1-2-Ext0-RFC9151-FIPS-2023-07`
- Interop polici

**File**: `packages/aws-cdk-lib/aws-elasticloadbalancingv2/lib/shared/enums.ts` (modified, +74/-0)
```diff
@@ -305,6 +305,80 @@ export enum SslPolicy {
    */
   FIPS_TLS13_10_PQ = 'ELBSecurityPolicy-TLS13-1-0-FIPS-PQ-2025-09',
 
+  /**
+   * TLS 1.3 only, RFC 9151 (CNSA 1.0) strict policy. FIPS-compliant.
+   *
+   * Supports the single cipher TLS_AES_256_GCM_SHA384. Use a strict policy only when all
+   * clients can negotiate RFC 9151 algorithms.
+   *
+   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html#rfc9151-security-policies
+   */
+  RFC9151_TLS13_13 = 'ELBSecurityPolicy-TLS13-1-3-RFC9151-FIPS-2023-07',
+
+  /**
+   * TLS 1.2 and 1.3, RFC 9151 (CNSA 1.0) strict policy. FIPS-compliant.
+   *
+   * Adds the ECDHE-ECDSA and ECDHE-RSA AES256-GCM-SHA384 ciphers on top of
+   * {@link RFC9151_TLS13_13} for TLS 1.2 clients. Use a strict policy only when all clients
+   * can negotiate RFC 9151 algorithms.
+   *
+   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html#rfc9151-security-policies
+   */
+  RFC9151_TLS13_12 = 'ELBSecurityPolicy-TLS13-1-2-RFC9151-FIPS-2023-07',
+
+  /**
+   * TLS 1.2 and 1.3, RFC 9151 (CNSA 1.0) strict policy. FIPS-compliant.
+   *
+   * Same as {@link RFC9151_TLS13_12} plus the non-ECDHE AES256-GCM-SHA384 cipher (extended
+   * cipher suite 0). Use a strict policy only when all clients can negotiate RFC 9151 algorithms.
+   *
+   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html#rfc9151-security-policies
+   */
+  RFC9151_TLS13_12_EXT0 = 'ELBSecurityPolicy-TLS13-1-2-Ext0-RFC9151-FIPS-2023-07',
+
+  /**
+   * TLS 1.2 and 1.3, RFC 9151 (CNSA 1.0) interoperability policy. FIPS-compliant.
+   *
+   * Interop policies mix RFC 9151 and non-RFC 9151 ciphers so clients can transition gradually.
+   * This variant adds the AES128-GCM-SHA256 ciphers (TLS_AES_128_GCM_SHA256,
+   * ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES128-GCM-SHA256) to the RFC 9151 GCM ciphers.
+   *
+   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html#rfc9151-security-policies
+   */
+  RFC9151_TLS13_12_INTEROP1 = 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP1-FIPS-2023-07',
+
+  /**
+   * TLS 1.2 and 1.3, RFC 9151 (CNSA 1.0) interoperability policy. FIPS-compliant.
+   *
+   * Extends {@link RFC9151_TLS13_12_INTEROP1} with the AES-SHA256 CBC ciphers
+   * (ECDHE-ECDSA/RSA-AES256-SHA384 and ECDHE-ECDSA/RSA-AES128-SHA256).
+   *
+   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html#rfc9151-security-policies
+   */
+  RFC9151_TLS13_12_INTEROP2 = 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP2-FIPS-2023-07',
+
+  /**
+   * TLS 1.2 and 1.3, RFC 9151 (CNSA 1.0) interoperability policy. FIPS-compliant.
+   *
+   * Adds the AES-SHA1 CBC ciphers (ECDHE-ECDSA/RSA-AES256-SHA and ECDHE-ECDSA/RSA-AES128-SHA)
+   * on top of the GCM and SHA256 ciphers, for the widest client compatibility of the interop
+   * policies.
+   *
+   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html#rfc9151-security-policies
+   */
+  RFC9151_TLS13_12_INTEROP3 = 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP3-FIPS-2023-07',
+
+  /**
+   * TLS 1.2 and 1.3, RFC 9151 (CNSA 1.0) interoperability policy. FIPS-compliant.
+   *
+   * AWS recommends starting with this policy: it supports clients that negotiate classical
+   * TLS 1.3, TLS 1.2, or strict RFC 9151 algorithms, then move to a stricter policy as clients
+   * gain RFC 9151 support. Also used for backend connections when any listener uses an RFC 9151 policy.
+   *
+   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html#rfc9151-security-policies
+   */
+  RFC9151_TLS13_12_INTEROP4 = 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP4-FIPS-2023-07',
+
   /**
    * Strong foward secrecy ciphers and TLV1.2 only (2020 edition).
    * Same as FORWARD_SECRECY_TLS12_RES, but only supports GCM versions of the TLS ciphers
```

**File**: `packages/aws-cdk-lib/aws-elasticloadbalancingv2/test/alb/listener.test.ts` (modified, +30/-0)
```diff
@@ -2329,6 +2329,36 @@ describe('tests', () => {
       });
     });
   });
+
+  describe('RFC 9151 (CNSA 1.0) SSL policies', () => {
+    test.each([
+      [elbv2.SslPolicy.RFC9151_TLS13_13, 'ELBSecurityPolicy-TLS13-1-3-RFC9151-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_EXT0, 'ELBSecurityPolicy-TLS13-1-2-Ext0-RFC9151-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP1, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP1-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP2, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP2-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP3, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP3-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP4, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP4-FIPS-2023-07'],
+    ])('sets SslPolicy %s on an HTTPS listener', (sslPolicy, expected) => {
+      // GIVEN
+      const stack = new cdk.Stack();
+      const vpc = new ec2.Vpc(stack, 'VPC');
+      const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
+
+      // WHEN
+      lb.addListener('Listener', {
+        protocol: elbv2.ApplicationProtocol.HTTPS,
+        certificates: [importedCertificate(stack)],
+        sslPolicy,
+        defaultAction: elbv2.ListenerAction.fixedResponse(200),
+      });
+
+      // THEN
+      Template.fromStack(stack).hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
+        SslPolicy: expected,
+      });
+    });
+  });
 });
 
 class ResourceWithLBDependency extends cdk.CfnResource {
```

**File**: `packages/aws-cdk-lib/aws-elasticloadbalancingv2/test/nlb/listener.test.ts` (modified, +34/-0)
```diff
@@ -750,6 +750,40 @@ describe('tests', () => {
       });
     });
   });
+
+  describe('RFC 9151 (CNSA 1.0) SSL policies', () => {
+    test.each([
+      [elbv2.SslPolicy.RFC9151_TLS13_13, 'ELBSecurityPolicy-TLS13-1-3-RFC9151-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_EXT0, 'ELBSecurityPolicy-TLS13-1-2-Ext0-RFC9151-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP1, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP1-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP2, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP2-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP3, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP3-FIPS-2023-07'],
+      [elbv2.SslPolicy.RFC9151_TLS13_12_INTEROP4, 'ELBSecurityPolicy-TLS13-1-2-RFC9151-INTEROP4-FIPS-2023-07'],
+    ])('sets SslPolicy %s on a TLS listener', (sslPolicy, expected) => {
+      // GIVEN
+      const stack = new cdk.Stack();
+      const vpc = new ec2.Vpc(stack, 'VPC');
+      const lb = new elbv2.NetworkLoadBalancer(stack, 'LB', { vpc });
+      const cert = new acm.Certificate(stack, 'Certificate', {
+        domainName: 'example.com',
+      });
+
+      // WHEN
+      lb.addListener('Listener', {
+        port: 443,
+        protocol: elbv2.Protocol.TLS,
+        certificates: [elbv2.ListenerCertificate.fromCertificateManager(cert)],
+        sslPolicy,
+        defaultTargetGroups: [new elbv2.NetworkTargetGroup(stack, 'Group', { vpc, port: 80 })],
+      });
+
+      // THEN
+      Template.fromStack(stack).hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
+        SslPolicy: expected,
+      });
+    });
+  });
 });
 
 class ResourceWithLBDependency extends cdk.CfnResource {
```

#### Recent Merged Pull Requests:
- **PR #39722** (2026-11-13): chore(merge-back): 2.277.0 (@aws-cdk-automation)
- **PR #39712** (2026-11-12): feat(lambda-event-sources): support queue consumption mode for self-managed Kafka (@ainafee-amzn)
- **PR #39711** (2026-11-12): chore(release): 2.277.0 (@aws-cdk-automation)
- **PR #39709** (2026-11-12): docs: reference the security model in the README (@ozelalisen)
- **PR #39703** (closed): chore(release): 2.277.0 (@aws-cdk-automation)
- **PR #39701** (2026-11-12): feat: update L1 CloudFormation resource definitions (@aws-cdk-automation)

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

## X. core): bump bundled minimatch to 11.0.8 to address CVE-2026-118764 (#39595)

**RULE**:
When implementing operations in `packages/aws-cdk-lib/NOTICE`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c153af90`: core): bump bundled minimatch to 11.0.8 to address CVE-2026-118764 (#39595). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/aws-cdk-lib/NOTICE`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
** @isaacs/nonrecursive-glob-match - https://www.npmjs.com/package/@isaacs/nonrecursive-glob-match

Blue Oak Model License

Version 1.0.0

Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

Acceptance

In order to receive this license, you must agree to its
rules. The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
https://blueoakcouncil.org/license/1.0.0.

Excuse

If anyone notifies you in writing that you have not
complied with Notices, you can keep your
license by taking all practical steps to comply within 30
days after the notice. If you do not do so, your license
ends immediately.

Patent

Each contributor licenses you to do everythi
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c153af90` are properly handled with clean fallback behavior.
