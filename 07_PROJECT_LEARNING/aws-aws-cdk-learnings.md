# Forensic Learning Record (Deep Inspection): aws/aws-cdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/aws-aws-cdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aws/aws-cdk](https://github.com/aws/aws-cdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:58:55.165Z  
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

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/online-evaluation.ts`
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

import { Arn, ArnFormat, Aws, Stack } from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import { addConstructMetadata } from 'aws-cdk-lib/core/lib/metadata-resource';
import { propertyInjectable } from 'aws-cdk-lib/core/lib/prop-injectable';
import type { Construct } from 'constructs';
import type { DataSourceConfig } from './data-source';
import type { EvaluatorReference } from './evaluator';
import { type IOnlineEvaluationConfig, OnlineEvaluationBase } from './online-evaluation-base';
import {
  EVALUATION_BEDROCK_MODEL_PERMS,
  EVALUATION_CLOUDWATCH_INDEX_POLICY_PERMS,
  EVALUATION_CLOUDWATCH_LOGS_DESCRIBE_PERMS,
  EVALUATION_CLOUDWATCH_LOGS_QUERY_PERMS,
  EVALUATION_CLOUDWATCH_LOGS_WRITE_PERMS,
} from './perms';
import {
  type OnlineEvaluationBaseProps,
  type OnlineEvaluationConfigAttributes,
} from './types';
import {
  validateConfigName,
  validateDescription,
  validateEvaluators,
  validateSamplingPercentage,
  validateFilters,
  validateSessionTimeout,
  validateEvaluationTags,
  throwIfInvalid,
} from './validation-helpers';

/**
 * Properties for creating an OnlineEvaluationConfig.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export interface OnlineEvaluationConfigProps extends OnlineEvaluationBaseProps {
  /**
   * The list of evaluators to apply during online evaluation.
   *
   * Can include both built-in evaluators and custom evaluators.
   *
   * @minimum 1
   * @maximum 10
   */
  readonly evaluators: EvaluatorReference[];

  /**
   * The data source configuration that specifies where to read agent traces from.
   */
  readonly dataSource: DataSourceConfig;

  /**
   * Tags for the online evaluation configuration.
   * A list of key:value pairs of tags to apply to this OnlineEvaluationConfig resource.
   *
   * @default - No tags
   */
  readonly tags?: { [key: string]: string };
}

/**
 * Online evaluation configuration for Amazon Bedrock AgentCore.
 *
 * Enables continuous evaluation of agent performance using built-in or custom evaluators.
 * Supports CloudWatch Logs and Agent Endpoint data sources.
 *
 * @resource AWS::BedrockAgentCore::OnlineEvaluationConfig
 *
 * @example
 * // Basic usage with built-in evaluators
 * const evaluation = new agentcore.OnlineEvaluationConfig(this, 'MyEvaluation', {
 *   onlineEvaluationConfigName: 'my_evaluation',
 *   evaluators: [
 *     agentcore.EvaluatorReference.builtin(agentcore.BuiltinEvaluator.HELPFULNESS),
 *     agentcore.EvaluatorReference.builtin(agentcore.BuiltinEvaluator.CORRECTNESS),
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
export class OnlineEvaluationConfig extends OnlineEvaluationBase {
  /** Uniquely identifies this class. */
  public static readonly PROPERTY_INJECTION_ID: string =
    '@aws-cdk.aws-bedrock-agentcore-alpha.OnlineEvaluationConfig';

  /**
   * Import an existing OnlineEvaluationConfig by its ID.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param onlineEvaluationConfigId - The configuration ID to import
   * @returns An IOnlineEvaluationConfig reference
   */
  public static fromOnlineEvaluationConfigId(
    scope: Construct,
    id: string,
    onlineEvaluationConfigId: string,
  ): IOnlineEvaluationConfig {
    const stack = Stack.of(scope);
    const configArn = Arn.format(
      {
        service: 'bedrock-agentcore',
        resource: 'online-evaluation-config',
        resourceName: onlineEvaluationConfigId,
      },
      stack,
    );

    return OnlineEvaluationConfig.fromOnlineEvaluationConfigAttributes(scope, id, {
      onlineEvaluationConfigArn: configArn,
      onlineEvaluationConfigId: onlineEvaluationConfigId,
      onlineEvaluationConfigName: onlineEvaluationConfigId,
    });
  }

  /**
   * Import an existing OnlineEvaluationConfig by its ARN.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param onlineEvaluationConfigArn - The configuration ARN to import
   * @returns An IOnlineEvaluationConfig reference
   */
  public static fromOnlineEvaluationConfigArn(
    scope: Construct,
    id: string,
    onlineEvaluationConfigArn: string,
  ): IOnlineEvaluationConfig {
    const arnParts = Arn.split(onlineEvaluationConfigArn, ArnFormat.SLASH_RESOURCE_NAME);
    const configId = arnParts.resourceName!;

    return OnlineEvaluationConfig.fromOnlineEvaluationConfigAttributes(scope, id, {
      onlineEvaluationConfigArn: onlineEvaluationConfigArn,
      onlineEvaluationConfigId: configId,
      onlineEvaluationConfigName: configId,
    });
  }

  /**
   * Import an existing OnlineEvaluationConfig from its attributes.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param attrs - The configuration attributes
   * @returns An IOnlineEvaluationConfig reference
   */
  public static fromOnlineEvaluationConfigAttributes(
    scope: Construct,
    id: string,
    attrs: OnlineEvaluationConfigAttributes,
  ): IOnlineEvaluationConfig {
    class Import extends OnlineEvaluationBase {
      public readonly onlineEvaluationConfigArn = attrs.onlineEvaluationConfigArn;
      public readonly onlineEvaluationConfigId = attrs.onlineEvaluationConfigId;
      public readonly onlineEvaluationConfigName = attrs.onlineEvaluationConfigName;
      public readonly executionRole = attrs.executionRoleArn
        ? iam.Role.fromRoleArn(scope, `${id}Role`, attrs.executionRoleArn)
        : undefined;
      public readonly status = undefined;
      public readonly executionStatus = undefined;
      public readonly createdAt = undefined;
      public readonly updatedAt = undefined;
      public readonly grantPrincipal: iam.IPrincipal;

      constructor(s: Construct, i: string) {
        super(s, i);
        this.grantPrincipal = this.executionRole ?? new iam.UnknownPrincipal({ resource: this });
      }
    }

    return new Import(scope, id);
  }

  /**
   * The ARN of the online evaluation configuration.
   * @attribute
   */
  public readonly onlineEvaluationConfigArn: string;

  /**
   * The unique identifier of the online evaluation configuration.
   * @attribute
   */
  public readonly onlineEvaluationConfigId: string;

  /**
   * The name of the online evaluation configuration.
   * @attribute
   */
  public readonly onlineEvaluationConfigName: string;

  /**
   * The IAM execution role for the evaluation.
   */
  public readonly executionRole?: iam.IRole;

  /**
   * The lifecycle status of the configuration.
   * @attribute
   */
  public readonly status?: string;

  /**
   * The execution status of the evaluation (ENABLED or DISABLED).
   */
  public readonly executionStatus?: string;

  /**
   * The timestamp when the configuration was created.
   * @attribute
   */
  public readonly createdAt?: string;

  /**
   * The timestamp when the configuration was last updated.
   * @attribute
   */
  public readonly updatedAt?: string;

  /**
   * The principal to grant permissions to.
   */
  public readonly grantPrincipal: iam.IPrincipal;

  constructor(scope: Construct, id: string, props: OnlineEvaluationConfigProps) {
    super(scope, id, {
      physicalName: props.onlineEvaluationConfigName,
    });

    addConstructMetadata(this, props);

    throwIfInvalid(validateConfigName, props.onlineEvaluationConfigName, this);
    throwIfInvalid(validateDescription, props.description, this);
    throwIfInvalid(validateEvaluators, props.evaluators, this);
    throwIfInvalid(validateSamplingPercentage, props.samplingPercentage, this);
    throwIfInvalid(validateFilters, props.filters, this);
    throwIfInvalid(validateSessionTimeout, props.sessionTimeout?.toMinutes(), this);

    if (props.tags) {
      throwIfInvalid(validateEvaluationTags, props.tags, this);
    }

    this.onlineEvaluationConfigName = this.physicalName;
    this.executionRole = props.executionRole ?? this.createExecutionRole(props.dataSource);
    this.grantPrincipal = this.executionRole;

    const resource = new bedrockagentcore.CfnOnlineEvaluationConfig(this, 'Resource', {
      onlineEvaluationConfigName: this.physicalName,
      evaluators: props.evaluators.map((e) => e.bind()),
      dataSourceConfig: props.dataSource.bind(),
      evaluationExecutionRoleArn: this.executionRole!.roleArn,
      rule: this.buildRuleConfig(props),
      description: props.description,
      executionStatus: props.executionStatus?.value,
      tags: props.tags && Object.keys(props.tags).length > 0
        ? Object.entries(props.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    });

    // Ensure the execution role's policies are created before the L1 resource,
    // because BedrockAgentCore validates role permissions at create time.
    if (this.executionRole instanceof iam.Role && this.executionRole.node.defaultChild) {
      resource.node.addDependency(this.executionRole);
    }

    this.onlineEvaluationConfigArn = resource.attrOnlineEvaluationConfigArn;
    this.onlineEvaluationConfigId = resource.attrOnlineEvaluationCon
```

### Core Architecture Module: `packages/@aws-cdk/aws-bedrock-agentcore-alpha/lib/evaluation/perms.ts`
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
 * Permissions to describe CloudWatch Log Groups.
 * This is a list operation that does not support resource-level permissions.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export const EVALUATION_CLOUDWATCH_LOGS_DESCRIBE_PERMS = [
  'logs:DescribeLogGroups',
];

/**
 * Permissions for the execution role to query CloudWatch Logs.
 * These actions support resource-level permissions scoped to specific log groups.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export const EVALUATION_CLOUDWATCH_LOGS_QUERY_PERMS = [
  'logs:GetQueryResults',
  'logs:StartQuery',
];

/**
 * Permissions for the execution role to invoke Bedrock models.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export const EVALUATION_BEDROCK_MODEL_PERMS = [
  'bedrock:InvokeModel',
  'bedrock:InvokeModelWithResponseStream',
];

/**
 * Permissions for the execution role to write evaluation results.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export const EVALUATION_CLOUDWATCH_LOGS_WRITE_PERMS = [
  'logs:CreateLogGroup',
  'logs:CreateLogStream',
  'logs:PutLogEvents',
];

/**
 * Permissions for CloudWatch index policies.
 * @deprecated Use the equivalent construct from `aws-cdk-lib/aws-bedrockagentcore` instead.
 */
export const EVALUATION_CLOUDWATCH_INDEX_POLICY_PERMS = [
  'logs:DescribeIndexPolicies',
  'logs:PutIndexPolicy',
];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #38940** (2026-10-01): **cdk: alias package published without matching aws-cdk version**
  *Symptoms*: ### Describe the bug  `cdk@2.1144.0` has been published to npm, but it depends on `aws-cdk@2.1144.0`, which does not appear to exist in the registry.  As a result, running npx cdk without a local aws-cdk dependency fails with: ``` npm error code ETARGET npm error notarget No matching version found for aws-cdk@2.1144.0. ```  This appears to be a publishing issue where the cdk alias package was released before the corresponding aws-cdk version.  ### Regression Issue  - [x] Select this option if this issue appears to be a regression.  ### Last Known Working CDK Library Version  2.1143.0  ### Expected Behavior  Have the separated npm publications match up and be consistent  ### Current Behavior  ``` npm error code ETARGET npm error notarget No matching version found for aws-cdk@2.1144.0. ```   ### Reproduction Steps  Run `npx cdk` without a (dev) dependency on `cdk` or `aws-cdk`  ### Possible Solution  _No response_  ### Additional Information/Context  _No response_  ### AWS CDK Library version (aws-cdk-lib)  n/a  ### AWS CDK CLI version  2.1144  ### Node.js Version  24  ### OS  macOS  ### Language  TypeScript  ### Language Version  _No response_  ### Other information  _No response_
  **Post-Mortem & Fix Analysis**:
  > For further details, see this issue in AWS CDK CLI repo: https://github.com/aws/aws-cdk-cli/issues/2007
  > close in favor of tracking in https://github.com/aws/aws-cdk-cli/issues/2007
  > Comments on closed issues and PRs are hard for our team to see.  If you need help, please open a new issue that references this one.

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

### Incident Patch 1: `e6521e19` (2026-10-05)
**Commit Message**: docs(acm): fix link text for exportable certificates documentation (#38971)

### Issue # (if applicable)

Closes #38970.

### Reason for this change

In the `aws-certificatemanager` README, the section "Requesting public SSL/TLS certificates exportable to use anywhere" links to the exportable public certificates guide, but the link text reads "opting out of certificate transparency logging". The text was copied from the following section and does not describe the linked page. This was introduced in #35079.

### Description of changes

Change the link text to "AWS Certificate Manager exportable public certificates", the title of the linked page. The URL is unchanged.

### Describe any new or updated permissions being added

N/A

### Description of how you validated changes

Documentation only. Verified that the link points to the exportable public certificates page of the ACM User Guide and that the new text matches its title.

### Checklist
- [x] My code adheres to the [CONTRIBUTING GUIDE](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md) and [DESIGN GUIDELINES](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)

----

*By submitting this pull request, I co

**File**: `packages/aws-cdk-lib/aws-certificatemanager/README.md` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ new acm.PrivateCertificate(this, 'PrivateCertificate', {
 
 ## Requesting public SSL/TLS certificates exportable to use anywhere
 
-AWS Certificate Manager can issue an exportable public certificate. There is a charge at certificate issuance and again when the certificate renews. See [opting out of certificate transparency logging](https://docs.aws.amazon.com/acm/latest/userguide/acm-exportable-certificates.html) for details.
+AWS Certificate Manager can issue an exportable public certificate. There is a charge at certificate issuance and again when the certificate renews. See [AWS Certificate Manager exportable public certificates](https://docs.aws.amazon.com/acm/latest/userguide/acm-exportable-certificates.html) for details.
 
 ```ts
 new acm.Certificate(this, 'Certificate', {
```

---

### Incident Patch 2: `d213cc71` (2026-10-02)
**Commit Message**: fix(cloudfront-origins): missing OAC permissions for Function URL (#35919)

### Issue # (if applicable)

Closes #35872.

### Reason for this change



**AWS Lambda's Dual Auth requirement** (introduced in PR https://github.com/aws/aws-cdk/pull/35725) now requires **both** `lambda:InvokeFunctionUrl` AND `lambda:InvokeFunction` (with `invokedViaFunctionUrl: true` condition) for Function URL invocations.

However, the [`FunctionUrlOriginWithOAC.addInvokePermission()`](https://github.com/aws/aws-cdk/blob/75139b2145010bc74e8017b23450d7af95327f49/packages/aws-cdk-lib/aws-cloudfront-origins/lib/function-url-origin.ts#L144-L153) method **currently grants only the** `lambda:InvokeFunctionUrl` permission:
https://github.com/aws/aws-cdk/blob/75139b2145010bc74e8017b23450d7af95327f49/packages/aws-cdk-lib/aws-cloudfront-origins/lib/function-url-origin.ts#L144-L153

Consequently, when integrating a Lambda Function URLs with CloudFront's OAC using the `aws_cloudfront_origins.FunctionUrlOrigin.withOriginAccessControl` construct, the resulting resource-based policy grants the CloudFront Service Principal only `lambda:InvokeFunctionUrl`. It is **currently missing the required** `lambda:InvokeFunction

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-ip-address-type.js.snapshot/FunctionUrlOriginIpAddressTypeStack.assets.json` (modified, +3/-3)
```diff
@@ -1,16 +1,16 @@
 {
   "version": "48.0.0",
   "files": {
-    "b7e8ed41fe2151cc77027ad5555063973c7bec83ec9b0c78cd5309b13029f31b": {
+    "2925ccbbc01b4936f82a7aaa616fd86f894b85b5bc7f56b7ab7c8c5e9b315d5b": {
       "displayName": "FunctionUrlOriginIpAddressTypeStack Template",
       "source": {
         "path": "FunctionUrlOriginIpAddressTypeStack.template.json",
         "packaging": "file"
       },
       "destinations": {
-        "current_account-current_region-117b58a1": {
+        "current_account-current_region-23c913e0": {
           "bucketName": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}",
-          "objectKey": "b7e8ed41fe2151cc77027ad5555063973c7bec83ec9b0c78cd5309b13029f31b.json",
+          "objectKey": "2925ccbbc01b4936f82a7aaa616fd86f894b85b5bc7f56b7ab7c8c5e9b315d5b.json",
           "assumeRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}"
         }
       }
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-ip-address-type.js.snapshot/FunctionUrlOriginIpAddressTypeStack.template.json` (modified, +132/-0)
```diff
@@ -124,6 +124,39 @@
     }
    }
   },
+  "DistributionWithoutIpAddressTypePropIPv4Origin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypePropIPv4Origin19CE58A8D11AC39DD": {
+   "Type": "AWS::Lambda::Permission",
+   "Properties": {
+    "Action": "lambda:InvokeFunction",
+    "FunctionName": {
+     "Fn::GetAtt": [
+      "TestFunctionFunctionUrlF8C7B1A2",
+      "FunctionArn"
+     ]
+    },
+    "InvokedViaFunctionUrl": true,
+    "Principal": "cloudfront.amazonaws.com",
+    "SourceArn": {
+     "Fn::Join": [
+      "",
+      [
+       "arn:",
+       {
+        "Ref": "AWS::Partition"
+       },
+       ":cloudfront::",
+       {
+        "Ref": "AWS::AccountId"
+       },
+       ":distribution/",
+       {
+        "Ref": "DistributionWithoutIpAddressTypePropIPv457500ACB"
+       }
+      ]
+     ]
+    }
+   }
+  },
   "DistributionWithoutIpAddressTypePropIPv457500ACB": {
    "Type": "AWS::CloudFront::Distribution",
    "Properties": {
@@ -216,6 +249,39 @@
     }
    }
   },
+  "DistributionWithIPv4Origin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv4Origin16D09790183D60B9B": {
+   "Type": "AWS::Lambda::Permission",
+   "Properties": {
+    "Action": "lambda:InvokeFunction",
+    "FunctionName": {
+     "Fn::GetAtt": [
+      "TestFunctionFunctionUrlF8C7B1A2",
+      "FunctionArn"
+     ]
+    },
+    "InvokedViaFunctionUrl": true,
+    "Principal": "cloudfront.amazonaws.com",
+    "SourceArn": {
+     "Fn::Join": [
+      "",
+      [
+       "arn:",
+       {
+        "Ref": "AWS::Partition"
+       },
+       ":cloudfront::",
+       {
+        "Ref": "AWS::AccountId"
+       },
+       ":distribution/",
+       {
+        "Ref": "DistributionWithIPv467452C1E"
+       }
+      ]
+     ]
+    }
+   }
+  },
   "DistributionWithIPv467452C1E": {
    "Type": "AWS::CloudFront::Distribution",
    "Properties": {
@@ -309,6 +375,39 @@
     }
    }
   },
+  "DistributionWithIPv6Origin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv6Origin13DB75E92C9E5ABDB": {
+   "Type": "AWS::Lambda::Permission",
+   "Properties": {
+    "Action": "lambda:InvokeFunction",
+    "FunctionName": {
+     "Fn::GetAtt": [
+      "TestFunctionFunctionUrlF8C7B1A2",
+      "FunctionArn"
+     ]
+    },
+    "InvokedViaFunctionUrl": true,
+    "Principal": "cloudfront.amazonaws.com",
+    "SourceArn": {
+     "Fn::Join": [
+      "",
+      [
+       "arn:",
+       {
+        "Ref": "AWS::Partition"
+       },
+       ":cloudfront::",
+       {
+        "Ref": "AWS::AccountId"
+       },
+       ":distribution/",
+       {
+        "Ref": "DistributionWithIPv69F24DA5D"
+       }
+      ]
+     ]
+    }
+   }
+  },
   "DistributionWithIPv69F24DA5D": {
    "Type": "AWS::CloudFront::Distribution",
    "Properties": {
@@ -402,6 +501,39 @@
     }
    }
   },
+  "DistributionWithDualstackOrigin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithDualstackOrigin1C9A16E087EF55EB6": {
+   "Type": "AWS::Lambda::Permission",
+   "Properties": {
+    "Action": "lambda:InvokeFunction",
+    "FunctionName": {
+     "Fn::GetAtt": [
+      "TestFunctionFunctionUrlF8C7B1A2",
+      "FunctionArn"
+     ]
+    },
+    "InvokedViaFunctionUrl": true,
+    "Principal": "cloudfront.amazonaws.com",
+    "SourceArn": {
+     "Fn::Join": [
+      "",
+      [
+       "arn:",
+       {
+        "Ref": "AWS::Partition"
+       },
+       ":cloudfront::",
+       {
+        "Ref": "AWS::AccountId"
+       },
+       ":distribution/",
+       {
+        "Ref": "DistributionWithDualstackCB183339"
+       }
+      ]
+     ]
+    }
+   }
+  },
   "DistributionWithDualstackCB183339": {
    "Type": "AWS::CloudFront::Distribution",
    "Properties": {
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-ip-address-type.js.snapshot/FunctionUrlOriginIpAddressTypeTestDefaultTestDeployAssert2EE4695B.assets.json` (modified, +7/-7)
```diff
@@ -1,29 +1,29 @@
 {
   "version": "48.0.0",
   "files": {
-    "53e3ecec991005bc2ddc98d13a897e8eadf082b86dedf53475c933aed3069238": {
+    "c11608a15785084ea1afe65826e575ee316add10c8b1bb373e93297e26aec564": {
       "source": {
-        "path": "asset.53e3ecec991005bc2ddc98d13a897e8eadf082b86dedf53475c933aed3069238.bundle",
+        "path": "asset.c11608a15785084ea1afe65826e575ee316add10c8b1bb373e93297e26aec564.bundle",
         "packaging": "zip"
       },
       "destinations": {
-        "current_account-current_region-4d6ddfe7": {
+        "current_account-current_region-ddc2bfd5": {
           "bucketName": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}",
-          "objectKey": "53e3ecec991005bc2ddc98d13a897e8eadf082b86dedf53475c933aed3069238.zip",
+          "objectKey": "c11608a15785084ea1afe65826e575ee316add10c8b1bb373e93297e26aec564.zip",
           "assumeRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}"
         }
       }
     },
-    "33306370e37beda754cb7b033584b15c9d9ceabc5a95fe3b427b222efd5fcc8f": {
+    "3c07e16570d7086d873e04cdd36f087c9938d23ee0d076c977c42c53367b8626": {
       "displayName": "FunctionUrlOriginIpAddressTypeTestDefaultTestDeployAssert2EE4695B Template",
       "source": {
         "path": "FunctionUrlOriginIpAddressTypeTestDefaultTestDeployAssert2EE4695B.template.json",
         "packaging": "file"
       },
       "destinations": {
-        "current_account-current_region-b454303f": {
+        "current_account-current_region-e3bc8340": {
           "bucketName": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}",
-          "objectKey": "33306370e37beda754cb7b033584b15c9d9ceabc5a95fe3b427b222efd5fcc8f.json",
+          "objectKey": "3c07e16570d7086d873e04cdd36f087c9938d23ee0d076c977c42c53367b8626.json",
           "assumeRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}"
         }
       }
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-ip-address-type.js.snapshot/FunctionUrlOriginIpAddressTypeTestDefaultTestDeployAssert2EE4695B.template.json` (modified, +166/-157)
```diff
@@ -11,8 +11,8 @@
     },
     "service": "CloudFront",
     "api": "getDistribution",
-    "expected": "{\"$Exact\":false}",
-    "actualPath": "Distribution.DistributionConfig.IsIPV6Enabled",
+    "expected": "{\"$Exact\":true}",
+    "actualPath": "Distribution.DistributionConfig.IsIPV4Enabled",
     "parameters": {
      "Id": {
       "Fn::Join": [
@@ -29,9 +29,9 @@
     },
     "flattenResponse": "true",
     "outputPaths": [
-     "Distribution.DistributionConfig.IsIPV6Enabled"
+     "Distribution.DistributionConfig.IsIPV4Enabled"
     ],
-    "salt": "1759199662495"
+    "salt": "1762057131275"
    },
    "UpdateReplacePolicy": "Delete",
    "DeletionPolicy": "Delete"
@@ -62,6 +62,33 @@
       "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [
+        {
+         "Action": [
+          "cloudfront:GetDistribution"
+         ],
+         "Effect": "Allow",
+         "Resource": [
+          "*"
+         ]
+        },
+        {
+         "Action": [
+          "cloudfront:GetDistribution"
+         ],
+         "Effect": "Allow",
+         "Resource": [
+          "*"
+         ]
+        },
+        {
+         "Action": [
+          "cloudfront:GetDistribution"
+         ],
+         "Effect": "Allow",
+         "Resource": [
+          "*"
+         ]
+        },
         {
          "Action": [
           "cloudfront:GetDistribution"
@@ -98,20 +125,12 @@
   "SingletonFunction1488541a7b23466481b69b4408076b81HandlerCD40AE9F": {
    "Type": "AWS::Lambda::Function",
    "Properties": {
-    "Runtime": {
-     "Fn::FindInMap": [
-      "LatestNodeRuntimeMap",
-      {
-       "Ref": "AWS::Region"
-      },
-      "value"
-     ]
-    },
+    "Runtime": "nodejs22.x",
     "Code": {
      "S3Bucket": {
       "Fn::Sub": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}"
      },
-     "S3Key": "53e3ecec991005bc2ddc98d13a897e8eadf082b86dedf53475c933aed3069238.zip"
+     "S3Key": "c11608a15785084ea1afe65826e575ee316add10c8b1bb373e93297e26aec564.zip"
     },
     "Timeout": 120,
     "Handler": "index.handler",
@@ -123,7 +142,79 @@
     }
    }
   },
+  "AwsApiCallCloudFrontgetDistribution4614290a52593596f8d940647c7465e51": {
+   "Type": "Custom::DeployAssert@SdkCallCloudFrontgetDistribution",
+   "Properties": {
+    "ServiceToken": {
+     "Fn::GetAtt": [
+      "SingletonFunction1488541a7b23466481b69b4408076b81HandlerCD40AE9F",
+      "Arn"
+     ]
+    },
+    "service": "CloudFront",
+    "api": "getDistribution",
+    "expected": "{\"$Exact\":false}",
+    "actualPath": "Distribution.DistributionConfig.IsIPV6Enabled",
+    "parameters": {
+     "Id": {
+      "Fn::Join": [
+       "",
+       [
+        "\"",
+        {
+         "Fn::ImportValue": "FunctionUrlOriginIpAddressTypeStack:ExportsOutputRefDistributionWithIPv467452C1EFE039C9B"
+        },
+        "\""
+       ]
+      ]
+     }
+    },
+    "flattenResponse": "true",
+    "outputPaths": [
+     "Distribution.DistributionConfig.IsIPV6Enabled"
+    ],
+    "salt": "1762057131277"
+   },
+   "UpdateReplacePolicy": "Delete",
+   "DeletionPolicy": "Delete"
+  },
   "AwsApiCallCloudFrontgetDistributioneee3b1157e24dc02a70f0a2971ed8c70": {
+   "Type": "Custom::DeployAssert@SdkCallCloudFrontgetDistribution",
+   "Properties": {
+    "ServiceToken": {
+     "Fn::GetAtt": [
+      "SingletonFunction1488541a7b23466481b69b4408076b81HandlerCD40AE9F",
+      "Arn"
+     ]
+    },
+    "service": "CloudFront",
+    "api": "getDistribution",
+    "expected": "{\"$Exact\":false}",
+    "actualPath": "Distribution.DistributionConfig.IsIPV4Enabled",
+    "parameters": {
+     "Id": {
+      "Fn::Join": [
+       "",
+       [
+        "\"",
+        {
+         "Fn::ImportValue": "FunctionUrlOriginIpAddressTypeStack:ExportsOutputRefDistributionWithIPv69F24DA5D6A4AB011"
+        },
+        "\""
+       ]
+      ]
+     }
+    },
+    "flattenResponse": "true",
+    "outputPaths": [
+     "Distribution.DistributionConfig.IsIPV4Enabled"
+    ],
+    "salt": "1762057131277"
+   },
+   "UpdateReplacePolicy": "Delete",
+   "DeletionPolicy": "Delete"
+  },
+  "AwsApiCallCloudFrontgetDistributioneee3b1157e24dc02a70f0a2971ed8c701": {
    "Type": "Custom::DeployAssert@SdkCallCloudFrontgetDistribution",
    "Properties": {
     "ServiceToken": {
@@ -154,12 +245,48 @@
     "outputPaths": [
      "Distribution.DistributionConfig.IsIPV6Enabled"
     ],
-    "salt": "1759199662495"
+    "salt": "1762057131277"
    },
    "UpdateReplacePolicy": "Delete",
    "DeletionPolicy": "Delete"
   },
   "AwsApiCallCloudFrontgetDistribution6c222f9b6410c728f9995017259cf3fa": {
+   "Type": "Custom::DeployAssert@SdkCallCloudFrontgetDistribution",
+   "Properties": {
+    "ServiceToken": {
+     "Fn::GetAtt": [
+      "SingletonFunction1488541a7b23466481b69b4408076b81HandlerCD40AE9F",
+      "Arn"
+     ]
+    },
+    "service": "CloudFront",
+    "api": "getDistribution",
+    "expected": "{\"$Exact\":true}",
+    "actualPath": "Distribution.DistributionC
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-ip-address-type.js.snapshot/asset.c11608a15785084ea1afe65826e575ee316add10c8b1bb373e93297e26aec564.bundle/index.js` (renamed, +23/-10)
```diff
@@ -1,3 +1,4 @@
+"use strict";
 var __create = Object.create;
 var __defProp = Object.defineProperty;
 var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
@@ -63,14 +64,18 @@ var init_matcher = __esm({
       }
     };
     MatchResult = class {
+      /**
+       * The target for which this result was generated.
+       */
+      target;
+      failuresHere = /* @__PURE__ */ new Map();
+      captures = /* @__PURE__ */ new Map();
+      finalized = false;
+      innerMatchFailures = /* @__PURE__ */ new Map();
+      _hasFailed = false;
+      _failCount = 0;
+      _cost = 0;
       constructor(target) {
-        this.failuresHere = /* @__PURE__ */ new Map();
-        this.captures = /* @__PURE__ */ new Map();
-        this.finalized = false;
-        this.innerMatchFailures = /* @__PURE__ */ new Map();
-        this._hasFailed = false;
-        this._failCount = 0;
-        this._cost = 0;
         this.target = target;
       }
       /**
@@ -403,9 +408,7 @@ var init_sparse_matrix = __esm({
   "../../aws-cdk-lib/assertions/lib/private/sparse-matrix.ts"() {
     "use strict";
     SparseMatrix = class {
-      constructor() {
-        this.matrix = /* @__PURE__ */ new Map();
-      }
+      matrix = /* @__PURE__ */ new Map();
       get(row, col) {
         return this.matrix.get(row)?.get(col);
       }
@@ -532,6 +535,7 @@ var init_match = __esm({
           throw new AssertionError("LiteralMatch cannot directly contain another matcher. Remove the top-level matcher or nest it more deeply.");
         }
       }
+      partialObjects;
       test(actual) {
         if (Array.isArray(this.pattern)) {
           return new ArrayMatch(this.name, this.pattern, { subsequence: false, partialObjects: this.partialObjects }).test(actual);
@@ -566,6 +570,8 @@ var init_match = __esm({
         this.subsequence = options.subsequence ?? true;
         this.partialObjects = options.partialObjects ?? false;
       }
+      subsequence;
+      partialObjects;
       test(actual) {
         if (!Array.isArray(actual)) {
           return new MatchResult(actual).recordFailure({
@@ -666,6 +672,7 @@ var init_match = __esm({
         this.pattern = pattern;
         this.partial = options.partial ?? true;
       }
+      partial;
       test(actual) {
         if (typeof actual !== "object" || Array.isArray(actual)) {
           return new MatchResult(actual).recordFailure({
@@ -30149,6 +30156,12 @@ var init_api_call = __esm({
     init_find_client_constructor();
     init_sdk_info();
     ApiCall = class {
+      service;
+      action;
+      v3PackageName;
+      v3Package;
+      // For testing purposes
+      client;
       // For testing purposes
       constructor(service, action) {
         this.service = normalizeServiceName(service);
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-ip-address-type.js.snapshot/manifest.json` (modified, +151/-4)
```diff
@@ -18,7 +18,7 @@
         "validateOnSynth": false,
         "assumeRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-deploy-role-${AWS::AccountId}-${AWS::Region}",
         "cloudFormationExecutionRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-cfn-exec-role-${AWS::AccountId}-${AWS::Region}",
-        "stackTemplateAssetObjectUrl": "s3://cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}/b7e8ed41fe2151cc77027ad5555063973c7bec83ec9b0c78cd5309b13029f31b.json",
+        "stackTemplateAssetObjectUrl": "s3://cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}/2925ccbbc01b4936f82a7aaa616fd86f894b85b5bc7f56b7ab7c8c5e9b315d5b.json",
         "requiresBootstrapStackVersion": 6,
         "bootstrapStackVersionSsmParameter": "/cdk-bootstrap/hnb659fds/version",
         "additionalDependencies": [
@@ -135,6 +135,12 @@
             "data": "DistributionWithoutIpAddressTypePropIPv4Origin1InvokeFromApiForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypePropIPv4Origin19CE58A8D68C10388"
           }
         ],
+        "/FunctionUrlOriginIpAddressTypeStack/DistributionWithoutIpAddressTypeProp(IPv4)/Origin1/InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypePropIPv4Origin19CE58A8D": [
+          {
+            "type": "aws:cdk:logicalId",
+            "data": "DistributionWithoutIpAddressTypePropIPv4Origin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypePropIPv4Origin19CE58A8D11AC39DD"
+          }
+        ],
         "/FunctionUrlOriginIpAddressTypeStack/DistributionWithoutIpAddressTypeProp(IPv4)/Resource": [
           {
             "type": "aws:cdk:logicalId",
@@ -169,6 +175,12 @@
             "data": "DistributionWithIPv4Origin1InvokeFromApiForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv4Origin16D09790128D49D13"
           }
         ],
+        "/FunctionUrlOriginIpAddressTypeStack/DistributionWithIPv4/Origin1/InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv4Origin16D097901": [
+          {
+            "type": "aws:cdk:logicalId",
+            "data": "DistributionWithIPv4Origin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv4Origin16D09790183D60B9B"
+          }
+        ],
         "/FunctionUrlOriginIpAddressTypeStack/DistributionWithIPv4/Resource": [
           {
             "type": "aws:cdk:logicalId",
@@ -203,6 +215,12 @@
             "data": "DistributionWithIPv6Origin1InvokeFromApiForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv6Origin13DB75E92367EAB99"
           }
         ],
+        "/FunctionUrlOriginIpAddressTypeStack/DistributionWithIPv6/Origin1/InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv6Origin13DB75E92": [
+          {
+            "type": "aws:cdk:logicalId",
+            "data": "DistributionWithIPv6Origin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv6Origin13DB75E92C9E5ABDB"
+          }
+        ],
         "/FunctionUrlOriginIpAddressTypeStack/DistributionWithIPv6/Resource": [
           {
             "type": "aws:cdk:logicalId",
@@ -237,6 +255,12 @@
             "data": "DistributionWithDualstackOrigin1InvokeFromApiForFunctionUrlOriginIpAddressTypeStackDistributionWithDualstackOrigin1C9A16E08C93B3E02"
           }
         ],
+        "/FunctionUrlOriginIpAddressTypeStack/DistributionWithDualstack/Origin1/InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithDualstackOrigin1C9A16E08": [
+          {
+            "type": "aws:cdk:logicalId",
+            "data": "DistributionWithDualstackOrigin1InvokeFunctionFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithDualstackOrigin1C9A16E087EF55EB6"
+          }
+        ],
         "/FunctionUrlOriginIpAddressTypeStack/DistributionWithDualstack/Resource": [
           {
             "type": "aws:cdk:logicalId",
@@ -272,6 +296,42 @@
             "type": "aws:cdk:logicalId",
             "data": "CheckBootstrapVersion"
           }
+        ],
+        "DistributionWithoutIpAddressTypePropIPv4Origin1InvokeFunctionUrlFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypePropIPv4Origin19CE58A8D1FF3A265": [
+          {
+            "type": "aws:cdk:logicalId",
+            "data": "DistributionWithoutIpAddressTypePropIPv4Origin1InvokeFunctionUrlFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypePropIPv4Origin19CE58A8D1FF3A265",
+            "trace": [
+              "!!DESTRUCTIVE_CHANGES: WILL_DESTROY"
+            ]
+          }
+        ],
+        "DistributionWithIPv4Origin1InvokeFunctionUrlFromCloudFrontForFunctionUrlOriginIpAddressTypeStackDistributionWithIPv4Origin16D0979012F724D97": [
+          {
+            "type": "aws:cdk:logicalId",
+            "data": "DistributionWithIPv4Origin1InvokeFu
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-ip-address-type.js.snapshot/tree.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"version":"tree-0.1","tree":{"id":"App","path":"","constructInfo":{"fqn":"aws-cdk-lib.App","version":"0.0.0"},"children":{"FunctionUrlOriginIpAddressTypeStack":{"id":"FunctionUrlOriginIpAddressTypeStack","path":"FunctionUrlOriginIpAddressTypeStack","constructInfo":{"fqn":"aws-cdk-lib.Stack","version":"0.0.0"},"children":{"TestFunction":{"id":"TestFunction","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction","constructInfo":{"fqn":"aws-cdk-lib.aws_lambda.Function","version":"0.0.0","metadata":[{"code":"*","handler":"*","runtime":"*"}]},"children":{"ServiceRole":{"id":"ServiceRole","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/ServiceRole","constructInfo":{"fqn":"aws-cdk-lib.aws_iam.Role","version":"0.0.0","metadata":[{"assumedBy":{"principalAccount":"*","assumeRoleAction":"*"},"managedPolicies":[{"managedPolicyArn":"*"}]}]},"children":{"ImportServiceRole":{"id":"ImportServiceRole","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/ServiceRole/ImportServiceRole","constructInfo":{"fqn":"aws-cdk-lib.Resource","version":"0.0.0","metadata":["*"]}},"Resource":{"id":"Resource","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/ServiceRole/Resource","constructInfo":{"fqn":"aws-cdk-lib.aws_iam.CfnRole","version":"0.0.0"},"attributes":{"aws:cdk:cloudformation:type":"AWS::IAM::Role","aws:cdk:cloudformation:props":{"assumeRolePolicyDocument":{"Statement":[{"Action":"sts:AssumeRole","Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"}}],"Version":"2012-10-17"},"managedPolicyArns":[{"Fn::Join":["",["arn:",{"Ref":"AWS::Partition"},":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]]}]}}}}},"Resource":{"id":"Resource","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/Resource","constructInfo":{"fqn":"aws-cdk-lib.aws_lambda.CfnFunction","version":"0.0.0"},"attributes":{"aws:cdk:cloudformation:type":"AWS::Lambda::Function","aws:cdk:cloudformation:props":{"code":{"zipFile":"exports.handler = async () => ({ statusCode: 200, body: \"Hello\" });"},"handler":"index.handler","role":{"Fn::GetAtt":["TestFunctionServiceRole6ABD93C7","Arn"]},"runtime":"nodejs20.x"}}},"LogGroup":{"id":"LogGroup","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/LogGroup","constructInfo":{"fqn":"aws-cdk-lib.aws_logs.LogGroup","version":"0.0.0","metadata":[{"logGroupName":"*"}]},"children":{"Resource":{"id":"Resource","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/LogGroup/Resource","constructInfo":{"fqn":"aws-cdk-lib.aws_logs.CfnLogGroup","version":"0.0.0"},"attributes":{"aws:cdk:cloudformation:type":"AWS::Logs::LogGroup","aws:cdk:cloudformation:props":{"logGroupName":{"Fn::Join":["",["/aws/lambda/",{"Ref":"TestFunction22AD90FC"}]]},"retentionInDays":731}}}}},"FunctionUrl":{"id":"FunctionUrl","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/FunctionUrl","constructInfo":{"fqn":"aws-cdk-lib.aws_lambda.FunctionUrl","version":"0.0.0","metadata":[{"function":"*","authType":"AWS_IAM"}]},"children":{"Resource":{"id":"Resource","path":"FunctionUrlOriginIpAddressTypeStack/TestFunction/FunctionUrl/Resource","constructInfo":{"fqn":"aws-cdk-lib.aws_lambda.CfnUrl","version":"0.0.0"},"attributes":{"aws:cdk:cloudformation:type":"AWS::Lambda::Url","aws:cdk:cloudformation:props":{"authType":"AWS_IAM","targetFunctionArn":{"Fn::GetAtt":["TestFunction22AD90FC","Arn"]}}}}}}}},"DistributionWithoutIpAddressTypeProp(IPv4)":{"id":"DistributionWithoutIpAddressTypeProp(IPv4)","path":"FunctionUrlOriginIpAddressTypeStack/DistributionWithoutIpAddressTypeProp(IPv4)","constructInfo":{"fqn":"aws-cdk-lib.aws_cloudfront.Distribution","version":"0.0.0","metadata":[{"defaultBehavior":{"origin":"*"}}]},"children":{"Origin1":{"id":"Origin1","path":"FunctionUrlOriginIpAddressTypeStack/DistributionWithoutIpAddressTypeProp(IPv4)/Origin1","constructInfo":{"fqn":"constructs.Construct","version":"10.4.2"},"children":{"FunctionUrlOriginAccessControl":{"id":"FunctionUrlOriginAccessControl","path":"FunctionUrlOriginIpAddressTypeStack/DistributionWithoutIpAddressTypeProp(IPv4)/Origin1/FunctionUrlOriginAccessControl","constructInfo":{"fqn":"aws-cdk-lib.aws_cloudfront.FunctionUrlOriginAccessControl","version":"0.0.0","metadata":["*"]},"children":{"Resource":{"id":"Resource","path":"FunctionUrlOriginIpAddressTypeStack/DistributionWithoutIpAddressTypeProp(IPv4)/Origin1/FunctionUrlOriginAccessControl/Resource","constructInfo":{"fqn":"aws-cdk-lib.aws_cloudfront.CfnOriginAccessControl","version":"0.0.0"},"attributes":{"aws:cdk:cloudformation:type":"AWS::CloudFront::OriginAccessControl","aws:cdk:cloudformation:props":{"originAccessControlConfig":{"name":"FunctionUrlOriginIpAddressTynctionUrlOriginAccessControl7A3061EB","signingBehavior":"always","signingProtocol":"sigv4","originAccessControlOriginType":"lambda"}}}}}},"InvokeFromApiForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypePropIPv4Origin19CE58A8D":{"id":"InvokeFromApiForFunctionUrlOriginIpAddressTypeStackDistributionWithoutIpAddressTypeProp
```

**File**: `packages/@aws-cdk-testing/framework-integ/test/aws-cloudfront-origins/test/integ.function-url-origin-oac-alias.js.snapshot/asset.c11608a15785084ea1afe65826e575ee316add10c8b1bb373e93297e26aec564.bundle/index.js` (renamed, +54/-29)
```diff
@@ -1,3 +1,4 @@
+"use strict";
 var __create = Object.create;
 var __defProp = Object.defineProperty;
 var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
@@ -63,14 +64,18 @@ var init_matcher = __esm({
       }
     };
     MatchResult = class {
+      /**
+       * The target for which this result was generated.
+       */
+      target;
+      failuresHere = /* @__PURE__ */ new Map();
+      captures = /* @__PURE__ */ new Map();
+      finalized = false;
+      innerMatchFailures = /* @__PURE__ */ new Map();
+      _hasFailed = false;
+      _failCount = 0;
+      _cost = 0;
       constructor(target) {
-        this.failuresHere = /* @__PURE__ */ new Map();
-        this.captures = /* @__PURE__ */ new Map();
-        this.finalized = false;
-        this.innerMatchFailures = /* @__PURE__ */ new Map();
-        this._hasFailed = false;
-        this._failCount = 0;
-        this._cost = 0;
         this.target = target;
       }
       /**
@@ -403,9 +408,7 @@ var init_sparse_matrix = __esm({
   "../../aws-cdk-lib/assertions/lib/private/sparse-matrix.ts"() {
     "use strict";
     SparseMatrix = class {
-      constructor() {
-        this.matrix = /* @__PURE__ */ new Map();
-      }
+      matrix = /* @__PURE__ */ new Map();
       get(row, col) {
         return this.matrix.get(row)?.get(col);
       }
@@ -532,6 +535,7 @@ var init_match = __esm({
           throw new AssertionError("LiteralMatch cannot directly contain another matcher. Remove the top-level matcher or nest it more deeply.");
         }
       }
+      partialObjects;
       test(actual) {
         if (Array.isArray(this.pattern)) {
           return new ArrayMatch(this.name, this.pattern, { subsequence: false, partialObjects: this.partialObjects }).test(actual);
@@ -566,6 +570,8 @@ var init_match = __esm({
         this.subsequence = options.subsequence ?? true;
         this.partialObjects = options.partialObjects ?? false;
       }
+      subsequence;
+      partialObjects;
       test(actual) {
         if (!Array.isArray(actual)) {
           return new MatchResult(actual).recordFailure({
@@ -666,6 +672,7 @@ var init_match = __esm({
         this.pattern = pattern;
         this.partial = options.partial ?? true;
       }
+      partial;
       test(actual) {
         if (typeof actual !== "object" || Array.isArray(actual)) {
           return new MatchResult(actual).recordFailure({
@@ -812,7 +819,7 @@ var init_match = __esm({
 var require_helpers_internal = __commonJS({
   "../../aws-cdk-lib/assertions/lib/helpers-internal/index.js"(exports2) {
     "use strict";
-    var __createBinding2 = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
+    var __createBinding2 = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
       if (k2 === void 0)
         k2 = k;
       var desc = Object.getOwnPropertyDescriptor(m, k);
@@ -822,11 +829,11 @@ var require_helpers_internal = __commonJS({
         } };
       }
       Object.defineProperty(o, k2, desc);
-    } : function(o, m, k, k2) {
+    }) : (function(o, m, k, k2) {
       if (k2 === void 0)
         k2 = k;
       o[k2] = m[k];
-    });
+    }));
     var __exportStar2 = exports2 && exports2.__exportStar || function(m, exports3) {
       for (var p in m)
         if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p))
@@ -835,11 +842,23 @@ var require_helpers_internal = __commonJS({
     Object.defineProperty(exports2, "__esModule", { value: true });
     var _noFold;
     exports2.Match = void 0;
-    Object.defineProperty(exports2, _noFold = "Match", { enumerable: true, configurable: true, get: () => (init_match(), __toCommonJS(match_exports)).Match });
+    Object.defineProperty(exports2, _noFold = "Match", { enumerable: true, configurable: true, get: () => {
+      var value = (init_match(), __toCommonJS(match_exports)).Match;
+      Object.defineProperty(exports2, _noFold = "Match", { enumerable: true, configurable: true, value });
+      return value;
+    } });
     exports2.Matcher = void 0;
-    Object.defineProperty(exports2, _noFold = "Matcher", { enumerable: true, configurable: true, get: () => (init_matcher(), __toCommonJS(matcher_exports)).Matcher });
+    Object.defineProperty(exports2, _noFold = "Matcher", { enumerable: true, configurable: true, get: () => {
+      var value = (init_matcher(), __toCommonJS(matcher_exports)).Matcher;
+      Object.defineProperty(exports2, _noFold = "Matcher", { enumerable: true, configurable: true, value });
+      return value;
+    } });
     exports2.MatchResult = void 0;
-    Object.defineProperty(exports2, _noFold = "MatchResult", { enumerable: true, configurable: true, get: () => (init_matcher(), __toCommonJS(matcher_exports)).MatchResult });
+    Object.defineProperty(exports2, _noFold = "MatchResult", { enumerable: true, configurable: true, get: () => {
+      var value = (init_matcher(), __toCommonJS(matcher_exports)).MatchResult;
+      Object.d
```

---

### Incident Patch 3: `49ac6186` (2026-10-02)
**Commit Message**: fix(bedrockagentcore): accept aws-cn ECR image URIs in Runtime container URI validation (#38948)

### Issue # (if applicable)

Closes #38947.

### Reason for this change

ECR registry hostnames in the `aws-cn` partition end in `.amazonaws.com.cn`. The ECR URI pattern used by `AgentRuntimeArtifact.fromImageUri()` and `Runtime.validateContainerUri()` only accepts `.amazonaws.com/`, so any literal China-region image URI fails synth with `InvalidEcrContainerUri` / `InvalidContainerUri` even though CloudFormation and the service accept it.

### Description of changes

- Allow an optional `.cn` after `amazonaws.com` in both copies of the ECR URI pattern (`lib/runtime/runtime-artifact.ts`, `lib/runtime/runtime.ts`): `\.amazonaws\.com(?:\.cn)?\/`.
- Mention the aws-cn form in the `fromImageUri` doc comment and in both error messages.

No change for commercial / GovCloud URIs, and no change for token-based URIs (validation is already skipped for unresolved tokens).

### Describe any new or updated permissions being added

None.

### Description of how you validated changes

- New unit test `Should accept aws-cn partition ECR container URIs` covers `cn-north-1` (tag) and `cn-northwest-1` (ne

**File**: `packages/aws-cdk-lib/aws-bedrockagentcore/lib/runtime/runtime-artifact.ts` (modified, +4/-3)
```diff
@@ -145,7 +145,8 @@ export abstract class AgentRuntimeArtifact {
    * **Note:** No IAM permissions are automatically granted. You must ensure the runtime has
    * ECR pull permissions for the repository.
    *
-   * @param containerUri The ECR container image URI (format: {account}.dkr.ecr.{region}.amazonaws.com/{repository}:{tag})
+   * @param containerUri The ECR container image URI (format: {account}.dkr.ecr.{region}.amazonaws.com/{repository}:{tag},
+   * or {account}.dkr.ecr.{region}.amazonaws.com.cn/{repository}:{tag} in the aws-cn partition)
    */
   public static fromImageUri(containerUri: string): AgentRuntimeArtifact {
     return new ImageUriArtifact(containerUri);
@@ -318,11 +319,11 @@ class ImageUriArtifact extends AgentRuntimeArtifact {
     super();
 
     // Validate ECR container URI format per CloudFormation requirements
-    const ecrPattern = /^\d{12}\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com\/((?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*)([:@]\S+)$/;
+    const ecrPattern = /^\d{12}\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?\/((?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*)([:@]\S+)$/;
     if (!Token.isUnresolved(containerUri) && !ecrPattern.test(containerUri)) {
       throw new UnscopedValidationError(
         lit`InvalidEcrContainerUri`,
-        `Invalid ECR container URI format: ${containerUri}. Must be an ECR URI: {account}.dkr.ecr.{region}.amazonaws.com/{repository}:{tag}`,
+        `Invalid ECR container URI format: ${containerUri}. Must be an ECR URI: {account}.dkr.ecr.{region}.amazonaws.com/{repository}:{tag} (or .amazonaws.com.cn in the aws-cn partition)`,
       );
     }
   }
```

**File**: `packages/aws-cdk-lib/aws-bedrockagentcore/lib/runtime/runtime.ts` (modified, +2/-2)
```diff
@@ -803,11 +803,11 @@ export class Runtime extends RuntimeBase {
     }
 
     // Only validate if the URI is a concrete string (not a token)
-    const pattern = /^\d{12}\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com\/((?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*)([:@]\S+)$/;
+    const pattern = /^\d{12}\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?\/((?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*)([:@]\S+)$/;
     if (!pattern.test(uri)) {
       throw new ValidationError(
         lit`InvalidContainerUri`,
-        `Invalid container URI format: ${uri}. Must be a valid ECR URI (e.g., 123456789012.dkr.ecr.us-west-2.amazonaws.com/my-agent:latest)`,
+        `Invalid container URI format: ${uri}. Must be a valid ECR URI (e.g., 123456789012.dkr.ecr.us-west-2.amazonaws.com/my-agent:latest or 123456789012.dkr.ecr.cn-north-1.amazonaws.com.cn/my-agent:latest)`,
         this,
       );
     }
```

**File**: `packages/aws-cdk-lib/aws-bedrockagentcore/test/agentcore/runtime/runtime-artifact.test.ts` (modified, +31/-0)
```diff
@@ -162,6 +162,28 @@ describe('AgentRuntimeArtifact tests', () => {
     expect(rendered.containerUri).toBe('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-repo:latest');
   });
 
+  test('Should accept aws-cn partition ECR container URIs', () => {
+    const cnUris = [
+      '123456789012.dkr.ecr.cn-north-1.amazonaws.com.cn/my-repo:latest',
+      '123456789012.dkr.ecr.cn-northwest-1.amazonaws.com.cn/team/my-repo@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
+    ];
+
+    cnUris.forEach((containerUri, i) => {
+      const artifact = AgentRuntimeArtifact.fromImageUri(containerUri);
+
+      // Also exercises Runtime.validateContainerUri, which carries the same ECR pattern
+      const runtime = new Runtime(stack, `test-runtime-cn-${i}`, {
+        runtimeName: `test_runtime_cn_${i}`,
+        agentRuntimeArtifact: artifact,
+      });
+
+      artifact.bind(stack, runtime);
+      const rendered: any = artifact._render();
+
+      expect(rendered.containerUri).toBe(containerUri);
+    });
+  });
+
   test('Should reject non-ECR container URIs', () => {
     expect(() => {
       AgentRuntimeArtifact.fromImageUri('docker.io/myimage:latest');
@@ -170,6 +192,15 @@ describe('AgentRuntimeArtifact tests', () => {
     expect(() => {
       AgentRuntimeArtifact.fromImageUri('ghcr.io/owner/repo:tag');
     }).toThrow(/Invalid ECR container URI format/);
+
+    // Wrong aws-cn suffix (missing ".com") and a look-alike domain must still be rejected
+    expect(() => {
+      AgentRuntimeArtifact.fromImageUri('123456789012.dkr.ecr.cn-north-1.amazonaws.cn/my-repo:latest');
+    }).toThrow(/Invalid ECR container URI format/);
+
+    expect(() => {
+      AgentRuntimeArtifact.fromImageUri('123456789012.dkr.ecr.cn-north-1.amazonaws.com.cn.evil.example/my-repo:latest');
+    }).toThrow(/Invalid ECR container URI format/);
   });
 
   test('Should use static construct ID for asset image regardless of directory', () => {
```

---

### Incident Patch 4: `5d102886` (2026-10-02)
**Commit Message**: fix(applicationautoscaling): target tracking silently ignores custom metric account and region (#36503)

### Issue #

Closes #36401.

### Reason for this change

When users specify a custom metric with an `account` or `region` property that differs from the stack's for Application Auto Scaling target tracking policies, the account and region are silently ignored. This leads to unexpected behavior where the policy uses metrics from the current account and region instead of the specified ones.

### Description of changes

Simply adding `account: metric.account` to the return object will not fix the problem. Here's why:

#### 1. CloudFormation schema does not support `Account` for CustomizedMetricSpecification

The AWS CloudFormation documentation for [CustomizedMetricSpecification](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-applicationautoscaling-scalingpolicy-customizedmetricspecification.html) only supports these properties:
- `Dimensions`
- `MetricName`
- `Metrics`
- `Namespace`
- `Statistic`
- `Unit`

There is **no `Account`, `AccountId` or `Region` property** listed.

#### 2. CloudFormation schema does not support `AccountId` for Target

**File**: `packages/aws-cdk-lib/aws-applicationautoscaling/lib/target-tracking-scaling-policy.ts` (modified, +21/-0)
```diff
@@ -98,6 +98,8 @@ export interface BasicTargetTrackingScalingPolicyProps extends BaseTargetTrackin
    * The metric must track utilization. Scaling out will happen if the metric is higher than
    * the target value, scaling in will happen in the metric is lower than the target value.
    *
+   * The metric must be in the same account and region as the scaling policy.
+   *
    * Exactly one of customMetric or predefinedMetric must be specified.
    *
    * @default - No custom metric.
@@ -168,6 +170,16 @@ function renderCustomMetric(scope: Construct, metric?: cloudwatch.IMetric): CfnS
     throw new ValidationError(lit`CannotStatistic`, `Cannot use statistic '${c.statistic}' for Target Tracking: only 'Average', 'Minimum', 'Maximum', 'SampleCount', and 'Sum' are supported.`, scope);
   }
 
+  const stack = cdk.Stack.of(scope);
+  if (definitelyDifferent(c.account, stack.account)) {
+    cdk.Annotations.of(scope).addWarningV2('@aws-cdk/aws-applicationautoscaling:crossAccountMetricIgnored',
+      `target tracking can only use metrics from its own account; metric account ${JSON.stringify(c.account)} is ignored and account ${JSON.stringify(stack.account)} is used`);
+  }
+  if (definitelyDifferent(c.region, stack.region)) {
+    cdk.Annotations.of(scope).addWarningV2('@aws-cdk/aws-applicationautoscaling:crossRegionMetricIgnored',
+      `target tracking can only use metrics from its own region; metric region ${JSON.stringify(c.region)} is ignored and region ${JSON.stringify(stack.region)} is used`);
+  }
+
   return {
     dimensions: c.dimensions,
     metricName: c.metricName,
@@ -177,6 +189,15 @@ function renderCustomMetric(scope: Construct, metric?: cloudwatch.IMetric): CfnS
   };
 }
 
+/**
+ * Whether a metric's account or region is known at synth time to differ from the expected one.
+ *
+ * Returns false when either side is an unresolved token, since such values can only be compared at deploy time.
+ */
+function definitelyDifferent(value: string | undefined, expected: string): boolean {
+  return value !== undefined && !cdk.Token.isUnresolved(value) && !cdk.Token.isUnresolved(expected) && value !== expected;
+}
+
 /**
  * One of the predefined autoscaling metrics
  */
```

**File**: `packages/aws-cdk-lib/aws-applicationautoscaling/test/target-tracking.test.ts` (modified, +91/-1)
```diff
@@ -1,5 +1,5 @@
 import { createScalableTarget } from './util';
-import { Template } from '../../assertions';
+import { Annotations, Match, Template } from '../../assertions';
 import * as cloudwatch from '../../aws-cloudwatch';
 import * as cdk from '../../core';
 import * as appscaling from '../lib';
@@ -174,4 +174,94 @@ describe('target tracking', () => {
 
     });
   });
+
+  test('warns when a custom metric is from another account', () => {
+    // GIVEN
+    const stack = new cdk.Stack(undefined, 'Stack', { env: { account: '111111111111', region: 'us-east-1' } });
+
+    // WHEN
+    createScalableTarget(stack).scaleToTrackMetric('Tracking', {
+      customMetric: new cloudwatch.Metric({ namespace: 'Test', metricName: 'Metric', account: '222222222222' }),
+      targetValue: 30,
+    });
+
+    // THEN
+    Annotations.fromStack(stack).hasWarning('*', Match.stringLikeRegexp('crossAccountMetricIgnored'));
+  });
+
+  test('warns when a custom metric is from another region', () => {
+    // GIVEN
+    const stack = new cdk.Stack(undefined, 'Stack', { env: { account: '111111111111', region: 'us-east-1' } });
+
+    // WHEN
+    createScalableTarget(stack).scaleToTrackMetric('Tracking', {
+      customMetric: new cloudwatch.Metric({ namespace: 'Test', metricName: 'Metric', region: 'eu-west-1' }),
+      targetValue: 30,
+    });
+
+    // THEN
+    Annotations.fromStack(stack).hasWarning('*', Match.stringLikeRegexp('crossRegionMetricIgnored'));
+  });
+
+  test.each([
+    ['env-agnostic stack, concrete metric account', {}, '222222222222'],
+    ['concrete stack, token metric account', { account: '111111111111', region: 'us-east-1' }, cdk.Aws.ACCOUNT_ID],
+  ])('does not warn when accounts cannot be compared at synth: %s', (_, env, account) => {
+    // GIVEN
+    const stack = new cdk.Stack(undefined, 'Stack', { env });
+
+    // WHEN
+    createScalableTarget(stack).scaleToTrackMetric('Tracking', {
+      customMetric: new cloudwatch.Metric({ namespace: 'Test', metricName: 'Metric', account }),
+      targetValue: 30,
+    });
+
+    // THEN
+    Annotations.fromStack(stack).hasNoWarning('*', Match.stringLikeRegexp('crossAccountMetricIgnored'));
+  });
+
+  test.each([
+    ['env-agnostic stack, concrete metric region', {}, 'eu-west-1'],
+    ['concrete stack, token metric region', { account: '111111111111', region: 'us-east-1' }, cdk.Aws.REGION],
+  ])('does not warn when regions cannot be compared at synth: %s', (_, env, region) => {
+    // GIVEN
+    const stack = new cdk.Stack(undefined, 'Stack', { env });
+
+    // WHEN
+    createScalableTarget(stack).scaleToTrackMetric('Tracking', {
+      customMetric: new cloudwatch.Metric({ namespace: 'Test', metricName: 'Metric', region }),
+      targetValue: 30,
+    });
+
+    // THEN
+    Annotations.fromStack(stack).hasNoWarning('*', Match.stringLikeRegexp('crossRegionMetricIgnored'));
+  });
+
+  test('allows custom metric from same account', () => {
+    // GIVEN
+    const stack = new cdk.Stack(undefined, 'Stack', { env: { account: '111111111111', region: 'us-east-1' } });
+    const target = createScalableTarget(stack);
+
+    // WHEN
+    target.scaleToTrackMetric('Tracking', {
+      customMetric: new cloudwatch.Metric({
+        namespace: 'Test',
+        metricName: 'Metric',
+        account: '111111111111', // Same account
+      }),
+      targetValue: 30,
+    });
+
+    // THEN
+    Template.fromStack(stack).hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
+      TargetTrackingScalingPolicyConfiguration: {
+        CustomizedMetricSpecification: {
+          MetricName: 'Metric',
+          Namespace: 'Test',
+        },
+        TargetValue: 30,
+      },
+    });
+    Annotations.fromStack(stack).hasNoWarning('*', Match.stringLikeRegexp('crossAccountMetricIgnored'));
+  });
 });
```

---

### Incident Patch 5: `53439f95` (2026-10-01)
**Commit Message**: fix(s3-deployment): `Source.data` objectKey can write outside the staging directory (#38921)

### Issue # (if applicable)

N/A

### Reason for this change

`Source.data()` (and the `Source.jsonData()` / `Source.yamlData()` helpers that delegate to it) joined the caller-supplied `objectKey` onto a temporary staging directory and wrote the rendered content there without checking that the result stayed inside that directory:

```ts
const outputPath = join(workdir, objectKey);
fs.mkdirSync(dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, rendered.text);
```

`objectKey` is documented as a destination S3 object key relative to the deployment root, not a local filesystem path. When an `objectKey` contained parent-directory segments (for example `../config.txt`), `join` resolved to a path outside the staging directory, so the rendered file was written to an unintended location on the machine running `cdk synth` / `diff` / `deploy` and was not packaged into the deployment as intended.

### Description of changes

Resolve the computed output path and throw a `ValidationError` when the `objectKey` resolves outside the staging directory, before creating any directories 

**File**: `packages/aws-cdk-lib/aws-s3-deployment/lib/source.ts` (modified, +13/-1)
```diff
@@ -1,12 +1,13 @@
 import * as fs from 'fs';
-import { join, dirname } from 'path';
+import { join, dirname, resolve } from 'path';
 import type { Construct } from 'constructs';
 import { renderData } from './render-data';
 import type * as iam from '../../aws-iam';
 import type * as s3 from '../../aws-s3';
 import * as s3_assets from '../../aws-s3-assets';
 import { FileSystem, Stack, Token } from '../../core';
 import { ValidationError } from '../../core/lib/errors';
+import { isInternalPath } from '../../core/lib/fs/utils';
 import { lit } from '../../core/lib/private/literal-string';
 import * as yaml_cfn from '../../core/lib/private/yaml-cfn';
 
@@ -196,6 +197,17 @@ export class Source {
         const workdir = FileSystem.mkdtemp('s3-deployment');
         try {
           const outputPath = join(workdir, objectKey);
+          // `objectKey` is a destination S3 object key relative to the deployment root, not a
+          // local filesystem path. Guard against keys containing parent-directory segments
+          // (e.g. `../`) that would resolve outside the staging directory and write the
+          // rendered file to an unintended location.
+          if (!isInternalPath(resolve(workdir), resolve(outputPath))) {
+            throw new ValidationError(
+              lit`ObjectKeyOutsideDeploymentRoot`,
+              `object key ${JSON.stringify(objectKey)} points outside the deployment root, remove the '..' segments that go above it`,
+              scope,
+            );
+          }
           const rendered = renderData(data);
           fs.mkdirSync(dirname(outputPath), { recursive: true });
           fs.writeFileSync(outputPath, rendered.text);
```

**File**: `packages/aws-cdk-lib/aws-s3-deployment/test/content.test.ts` (modified, +60/-0)
```diff
@@ -134,3 +134,63 @@ test('Source.data with empty string does not throw error', () => {
     expect(actual.zipObjectKey).toBeDefined();
   }).not.toThrow();
 });
+
+describe('Source.data() validates objectKey stays within the staging directory', () => {
+  const makeHandler = (stack: Stack) => new lambda.Function(stack, 'Handler', {
+    runtime: lambda.Runtime.NODEJS_LATEST,
+    code: lambda.Code.fromInline('foo'),
+    handler: 'index.handler',
+  });
+
+  test.each([
+    '../outside.txt',
+    '../../outside.txt',
+    'a/../../outside.txt',
+  ])('Source.data() throws when objectKey %s resolves outside the staging directory', (objectKey) => {
+    const stack = new Stack();
+    const handler = makeHandler(stack);
+
+    expect(() => {
+      Source.data(objectKey, 'hello, world').bind(stack, { handlerRole: handler.role! });
+    }).toThrow(/points outside the deployment root/);
+  });
+
+  test('Source.jsonData() inherits the same validation', () => {
+    const stack = new Stack();
+    const handler = makeHandler(stack);
+
+    expect(() => {
+      Source.jsonData('../outside.json', { foo: 'bar' }).bind(stack, { handlerRole: handler.role! });
+    }).toThrow(/points outside the deployment root/);
+  });
+
+  test('Source.yamlData() inherits the same validation', () => {
+    const stack = new Stack();
+    const handler = makeHandler(stack);
+
+    expect(() => {
+      Source.yamlData('../outside.yaml', { foo: 'bar' }).bind(stack, { handlerRole: handler.role! });
+    }).toThrow(/points outside the deployment root/);
+  });
+
+  test('Source.data() still accepts normal nested keys', () => {
+    const stack = new Stack();
+    const handler = makeHandler(stack);
+
+    expect(() => {
+      const actual = Source.data('nested/dir/config.txt', 'hello, world').bind(stack, { handlerRole: handler.role! });
+      expect(actual.bucket).toBeDefined();
+      expect(actual.zipObjectKey).toBeDefined();
+    }).not.toThrow();
+  });
+
+  test('Source.data() accepts a key with interior ".." that stays within the staging dir', () => {
+    const stack = new Stack();
+    const handler = makeHandler(stack);
+
+    // 'a/../b.txt' normalizes to 'b.txt', which is still inside the staging directory.
+    expect(() => {
+      Source.data('a/../b.txt', 'hello, world').bind(stack, { handlerRole: handler.role! });
+    }).not.toThrow();
+  });
+});
```

---

### Incident Patch 6: `0b763a78` (2026-10-01)
**Commit Message**: fix(core): validation  E2001 inadvertently not enabled (#38920)

These check actual invalid template syntax, and should be enabled. The indicated syntax is not valid CFN.


----

*By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license*

**File**: `packages/aws-cdk-lib/core/lib/validation/cloudformation-validate-plugin.ts` (modified, +0/-8)
```diff
@@ -336,14 +336,6 @@ const IGNORE_RULES = new Set([
   // span accounts.
   'W9013',
 
-  // WHAT: value type tracking (parameter default should be a string)
-  // WHY: This is a valid finding, but CDK can synthesize Fn::ImportValue as a parameter default when resolving
-  // a cross-stack reference. CloudFormation does not support intrinsic functions in the Parameters section.
-  // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html
-  // https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference.html
-  // <https://github.com/aws-cloudformation/cloudformation-validate/issues/194>
-  'E2001',
-
   // WHAT: built-in function not recognized
   // WHY: there are intrinsic functions that the plugin doesn't know about that are nevertheless valid.
   // This diagnostic is intended to protect against typos in templates, but since the intrinsics
```

**File**: `packages/aws-cdk-lib/core/test/stack.test.ts` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ describe('stack', () => {
       { id: 'CloudFormation-Validate::F3003', reason: "For cross-stack tests, we don't care about property names being valid" },
       { id: 'CloudFormation-Validate::E9004', reason: 'We are using non-existing property names' },
       { id: 'CloudFormation-Validate::F6101', reason: 'We are doing nonsensical type manipulations in these tests' },
+      { id: 'CloudFormation-Validate::E2001', reason: 'We are using Fn::ImportValue where they are not allowed' },
     );
     return app;
   }
```

---

### Incident Patch 7: `269052d6` (2026-09-29)
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
+    // readdirSync before this reassignment and silently make the mock a no-op.
+    let spoofInvocations = 0;
+    fsMutable.readdirSync = ((...args: any[]) => {
+      const [dirPath, options] = args;
+      const entries = (passthrough as any).apply(fsMutable, args);
+      const wantsFileTypes = options && typeof options === 'object' && options.withFileTypes;
+      if (!wantsFileTypes || typeof dirPath !== 'string' || path.resolve(dirPath) !== path.resolve(outdir)) {
+        return entries;
+      }
+      return (entries as fs.Dirent[]).map((entry) => {
+        if (entry.name !== 'reparse-lookalike') return entry;
+        spoofInvocations++;
+        // Match what libuv reports for a directory reparse point whose tag
+        // it cannot readlink(): isSymbolicLink() === true, isDirectory() === false.
+        const proxy = Object.create(entry);
+        proxy.isSymbolicLink = () => true;
+        proxy.isDirectory = () => false;
+        proxy.isFile = () => false;
+        return proxy;
+      });
+    }) as t
```

---

### Incident Patch 8: `9d4ae5f8` (2026-09-28)
**Commit Message**: test(lambda-python): stub DockerImage.fromBuild so bundling unit tests never invoke docker (#38895)

### Issue # (if applicable)

Closes #38910

(Follow-up to the runtime-only fix in https://github.com/aws/aws-cdk/pull/38881, which addressed #38880 but left the underlying Docker dependency in place.)

### Reason for this change

`packages/@aws-cdk/aws-lambda-python-alpha/test/bundling.test.ts` still builds the Python bundling Docker image for real. The file's `jest.mock('child_process')` is meant to fake the build, but it does not reliably intercept the compiled `aws-cdk-lib`: `DockerImage.fromBuild` reaches `child_process` through a memoized lazy `require("child_process")` baked into the built `aws-cdk-lib`. When another test file loads `aws-cdk-lib` and touches that require first, the memoized reference resolves to the **real** module and this file's mock is bypassed — so a real `docker build` runs.

This is order- and worker-dependent, so it passes locally (this file loads `aws-cdk-lib` mock-first) but fails intermittently in CI. The case that surfaces it is `Bundling with custom build args`, which points `pip` at `https://test.pypi.org/simple/`; when the real build runs, it fai

**File**: `packages/@aws-cdk/aws-lambda-python-alpha/test/bundling.test.ts` (modified, +4/-1)
```diff
@@ -6,7 +6,10 @@ import { Architecture, Code, Runtime } from 'aws-cdk-lib/aws-lambda';
 import { Bundling } from '../lib/bundling';
 
 jest.spyOn(Code, 'fromAsset');
-jest.spyOn(DockerImage, 'fromBuild');
+// Stub `DockerImage.fromBuild` so these unit tests never run a real `docker build`.
+// (The `child_process` mock below is bypassed intermittently in CI.) The spy still
+// records calls, so the argument/call-count assertions below are unaffected.
+jest.spyOn(DockerImage, 'fromBuild').mockReturnValue(new DockerImage('cdk-bundling-image-stub'));
 
 jest.mock('child_process', () => ({
   spawnSync: jest.fn(() => {
```

---

### Incident Patch 9: `aff4a2f3` (2026-09-28)
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

### Incident Patch 10: `edd162d8` (2026-09-25)
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

### Incident Patch 11: `0c5e732d` (2026-09-25)
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
-    core.Validations.of(app).addPlugins(new core.CloudFormationValidatePlugin());
-    core.Validations.of(app).addPlugins(new core.CloudFormationValidatePlugin());
+    core.Validations.of(app).addPlugins(newPlugin());
+    core.Validations.of(app).addPlugins(newPlugin());
 
     const stack = new core.Stack(app, 'TestStack');
     new core.CfnResource(stack, 'MyBucket', {
@@ -303,7 +370,7 @@ describe('CloudFormationValidatePlugin', () => {
       },
     });
     const stage = new core.Stage(app, 'MyStage');
-    core.Validations.of(stage).addPlugins(new core.CloudFormationValidatePlugin());
+    core.Validations.of(stage).addPlugins(newPlugin());
     const stack = new core.Stack(stage, 'TestStack');
     new core.CfnResource(stack, 'MyBucket', {
       type: 'AWS::S3::Bucket',
@@ -326,14 +393,8 @@ describe('CloudFormationValidatePlugin', () => {
       },
     }));
 
-    const plugin = new core.CloudFormationValidatePlugin();
-    const report = plugin.validate({
-      templatePath
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

**File**: `packages/aws-cdk-lib/testhelpers/jest-global-app-testhook.ts` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ if (hasTemporarySchemas()) {
   });
 }
 
+afterAll(() => {
+  cdk.CloudFormationValidatePlugin._disposeSingleton();
+});
+
 const APP_INIT_HOOK_SYMBOL = Symbol.for('@aws-cdk/core.App#initHook');
 (globalThis as any)[APP_INIT_HOOK_SYMBOL] = (app: cdk.App) => {
   cdk.Validations.of(app).acknowledge(
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -2354,10 +2354,10 @@
     "@smithy/types" "^4.16.0"
     tslib "^2.6.2"
 
-"@aws/cloudformation-validate@1.9.0-beta":
-  version "1.9.0-beta"
-  resolved "https://registry.npmjs.org/@aws/cloudformation-validate/-/cloudformation-validate-1.9.0-beta.tgz#5442b4821cbdf421d372111732a9832116c6da98"
-  integrity sha512-y7mFIu3ne6KuygYT8D95+M6dW7P0PeNqqcUZofYB2aAMaz9mIcqHoeQRY8HeM9GOjGCVSwp+MVPPLnuC5bcnyA==
+"@aws/cloudformation-validate@1.12.1":
+  version "1.12.1"
+  resolved "https://registry.npmjs.org/@aws/cloudformation-validate/-/cloudformation-validate-1.12.1.tgz#3d19861ef68aaa1c8b9d8cf3cc24efd27c20ce13"
+  integrity sha512-syZyTZQ1JPubKfzkfxQ8AoLEhma+2Upsz/ESLiosVnncdo4cdWDhsLp5Bxol3Wi94j8gJkch8H4rsYZWk4K0OQ==
 
 "@aws/lambda-invoke-store@^0.3.0":
   version "0.3.0"
```

---

### Incident Patch 12: `40de511b` (2026-09-24)
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
     fs-extra "^10.1.0"
-    jsii-reflect "^1.139.0"
+    jsii-reflect "^1.140.0"
     semver "^7.8.5"
-    spdx-license-list "^6.11.0"
+    spdx-license-list "^6.12.0"
     xmlbuilder "^15.1.1"
     yargs "^17.7.3"
 
-jsii-reflect@1.139.0, jsii-reflect@^1.139.0:
-  version "1.139.0"
-  resolved "https://registry.npmjs.org/jsii-reflect/-/jsii-reflect-1.139.0.tgz#de57f7505ec10bb31fa2149b97dd884a0d89ea01"
-  integrity sha512-Z8rGDzykcg6REfFV8HJZ0oms5zi8wBO4T7B5thSS4iME0osbWJP62pFn2yT6VivOESKnkFZOI3RkIKYkynPbGg==
+jsii-reflect@1.140.0, jsii-reflect@^1.140.0:
+  version "1.140.0"
+  resolved "https://registry.npmjs.org/jsii-reflect/-/jsii-reflect-1.140.0.tgz#8929a3fbccee9c02bc6a1a2a9f49df2b0026086d"
+  integrity sha512-8bRD6WSQfWrB6/31sz92bi21HWaMVzvxZUgaJt/IiT3RqGKc57dO+idekn8WNpTBneE9vVhj24UDExHH8YfJAQ==
   dependencies:
-    "@jsii/check-node" "1.139.0"
-    "@jsii/spec" "1.139.0"
+    "@jsii/check-node" "1.140.0"
+    "@jsii/spec" "1.140.0"
     chalk "^4"
     fs-extra "^10.1.0"
-   
```

---

### Incident Patch 13: `f482f4f3` (2026-09-24)
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

### Incident Patch 14: `600ffc86` (2026-09-24)
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

### Incident Patch 15: `da682989` (2026-09-24)
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
+function readCreationStack(art: CloudFormationStackArtifact, constructPath: string): string[] {
+  const items = art.findMetadataByType('aws:cdk:creationStack').filter(e => e.path === constructPath);
+  if (items.length === 0) {
+    throw new Error(`No creation stack found for ${constructPath}`);
+  }
+  return items[0].data as string[];
+}
+
+function readPropertyAssignments(art: CloudFormationStackArtifact, constructPath: string): PropertyMutationMetadataEntry[] {
+  return art.findMetadataByType('aws:cdk:propertyAssignment')
+    .filter(e => e.path === constructPath)
+    .map(e => e.data as PropertyMutationMetadataEntry);
+}
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

**File**: `packages/aws-cdk-lib/core/lib/private/stack-trace.ts` (modified, +30/-5)
```diff
@@ -146,6 +146,8 @@ export function parseErrorStack(stack: string): CallSite[] {
  * new <constructor> (<file>:<line>:<col>)
  * <file>:<line>:<col>
  * ```
+ *
+ * See https://v8.dev/docs/stack-trace-api#appendix%3A-stack-trace-format
  */
 function parseStackFrame(frame: string): CallSite {
   let fileName;
@@ -163,7 +165,9 @@ function parseStackFrame(frame: string): CallSite {
 
   let asI = functionName.indexOf(' [as ');
   if (asI > -1) {
-    functionName = functionName.slice(0, asI);
+    const endOfAlias = functionName.indexOf(']', asI);
+    const lastPeriod = functionName.lastIndexOf('.', asI);
+    functionName = functionName.slice(0, lastPeriod + 1) + functionName.slice(asI + 5, endOfAlias);
   }
 
   // line = <file>:<line>:<col>, but file can contain : as well.
@@ -265,18 +269,39 @@ export function renderCallStackJustMyCode(stack: CallSite[], indent = true): str
   }
 }
 
+/**
+ * Interface for a class that can determine whether a stack frame is interesting to the user or not.
+ *
+ * The input is a formatted stack frame, as produced by `captureCallStack` and
+ * `renderCallStackJustMyCode`. The output is a boolean indicating whether the
+ * frame is user code or not.
+ */
+export interface StackFrameFinder {
+  isUserCodeFrame(frame: string): boolean;
+}
+
+/**
+ * Recognize "actual" call frames by them containing ` (` and ending in `)`.
+ *
+ * The `node_modules` frames have already been masked away by
+ * `renderCallStackJustMyCode` during capture.
+ */
+export const DEFAULT_STACK_FRAME_FINDER: StackFrameFinder = {
+  isUserCodeFrame(frame: string): boolean {
+    return frame.includes(' (') && frame.endsWith(')');
+  },
+};
+
 /**
  * Return the first user frame from a "Just My Code" call stack
  *
  * With all the NON-"my code" call frames redacted, the top level frame should
  * be the last user frame that is associated with the given call stack.
  *
- * May return `undefined` if no such call frame is found. We recognize
- * "actual" call frames by them containing ` (` and ending in `)`.
  */
-export function topUserFrame(stackTrace: string[]): CallSite | undefined {
+export function topUserFrame(stackTrace: string[], frameFinder: StackFrameFinder): CallSite | undefined {
   for (const frame of stackTrace) {
-    if (frame.includes(' (') && frame.endsWith(')')) {
+    if (frameFinder.isUserCodeFrame(frame)) {
       return parseStackFrame(frame);
     }
   }
```

**File**: `packages/aws-cdk-lib/core/lib/private/synthesis-validation.ts` (modified, +42/-16)
```diff
@@ -17,11 +17,12 @@ import type { Stage } from '../stage';
 import type { IPolicyValidationPlugin, PolicyValidationPluginReport, PolicyValidationStack, PolicyViolatingResource } from '../validation';
 import { STAGE_TYPE } from './core-construct-finders';
 import { profileSpan } from './perf';
+import { DEFAULT_STACK_FRAME_FINDER } from './stack-trace';
 import { CloudFormationValidatePlugin } from '../validation/cloudformation-validate-plugin';
 import { ConstructTree } from '../validation/private/construct-tree';
-import { formatValidationReports, humanFriendlyFilename } from '../validation/private/modern-formatter';
-import type { NamedValidationPluginReport, SuppressedViolation } from '../validation/private/report';
-import { isSuppressibleViolation, mkPluginFailure, PolicyValidationReportFormatter } from '../validation/private/report';
+import { formatValidationReports, humanFriendlyFilename, stripAnsi } from '../validation/private/modern-formatter';
+import type { NamedValidationPluginReport, SuppressedViolation, ViolationStackTraces } from '../validation/private/report';
+import { ExtraObjectData, isSuppressibleViolation, mkPluginFailure, PolicyValidationReportFormatter } from '../validation/private/report';
 import { namespaceFromPluginName, normalizeValidationId } from '../validation/private/validation-id';
 
 const LEGACY_POLICY_VALIDATION_FILE_PATH = 'policy-validation-report.json';
@@ -67,11 +68,12 @@ export function validateTemplates(root: IConstruct, outdir: string, assembly: pr
 
   const tree = new ConstructTree(root);
   inferConstructPathsFromLogicalIds(reports, tree);
+  const stackTraces = collectViolationStackTraces(reports, tree);
 
   const suppressedByReport: Map<number, SuppressedViolation[]> = collectSuppressions(root, reports);
 
-  const formatter = new PolicyValidationReportFormatter(tree);
-  const reportJson = formatter.formatJson(reports, assembly.version, suppressedByReport);
+  const formatter = new PolicyValidationReportFormatter(new ConstructTree(root));
+  const reportJson = formatter.formatJson(reports, assembly.version, stackTraces, suppressedByReport);
 
   // Always write validation report to disk
   const reportFile = path.join(assembly.directory, cxapi.VALIDATION_REPORT_FILE);
@@ -116,7 +118,7 @@ export function validateTemplates(root: IConstruct, outdir: string, assembly: pr
   // with warnings, we fail.
   const constructLibStrictMode = getBooleanContext(root, cxapi.STRICT_CFN_VALIDATE_ERRORS, false);
   const validationFails = reports.some(r => !r.success) || (constructLibStrictMode && reports.some(r => r.violations.some(v => v.severity === 'warning')));
-  const reportText = formatValidationReports(process.cwd(), reportJson.pluginReports);
+  const reportText = formatValidationReports(process.cwd(), reportJson.pluginReports, DEFAULT_STACK_FRAME_FINDER);
   const reportPath = humanFriendlyFilename(process.cwd(), reportFile);
 
   let preamble = '';
@@ -389,6 +391,40 @@ function groupResourcesBySuppressions(resources: PolicyViolatingResource[], path
   }
 }
 
+function collectViolationStackTraces(
+  reports: NamedValidationPluginReport[],
+  tree: ConstructTree,
+): ViolationStackTraces {
+  const ret = new ExtraObjectData<PolicyViolatingResource, string[]>();
+
+  for (const report of reports) {
+    for (const violation of report.violations) {
+      for (const resource of violation.violatingResources) {
+        const constructPath = resource.constructPath;
+        if (!constructPath) {
+          continue;
+        }
+
+        const stacks: string[] = [];
+
+        // Always creation trace
+        const creationTrace = tree.creationTraceByPath(constructPath);
+        if (creationTrace) {
+          stacks.push(creationTrace);
+        }
+
+        // Mutation traces
+        stacks.push(...resource.locations.flatMap(location => tree.mutationTracesByPath(constructPath, location)));
+
+        if (stacks.length > 0) {
+          ret.attach(resource, stacks);
+        }
+      }
+    }
+  }
+  return ret;
+}
+
 /**
  * Invoke all validation plugins, make sure they don't accidentally modify any files in the output directory (so they are strictly readonly).
  */
@@ -613,13 +649,3 @@ function cdkAppMode(root: IConstruct): 'process' | 'inmemory' | 'unknown' {
   // Unknown mode, either a legacy CLI or running via toolkit-lib.
   return 'unknown';
 }
-
-function stripAnsi(x: string) {
-  const pattern = [
-    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
-    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
-  ].join('|');
-
-  const re = new RegExp(pattern, 'g');
-  return x.replaceAll(re, '');
-}
```

**File**: `packages/aws-cdk-lib/core/lib/prop-injectable.ts` (modified, +3/-4)
```diff
@@ -26,7 +26,7 @@ export function propertyInjectable<T extends PropertyInjectableConstructConstruc
   //
   // I couldn't find a clear reference on what that error is trying to say, but it's possible
   // to cast it away, and the signature of the containing function seems to hold water.
-  const WrappedClass = class extends (constructor as ArbitraryConstructor) {
+  const PropertyInjectable = class extends (constructor as ArbitraryConstructor) {
     constructor(scope: Construct, id: string, props: object, ...args: any[]) {
       const uniqueId = constructor.PROPERTY_INJECTION_ID;
       if (uniqueId === undefined) {
@@ -41,10 +41,9 @@ export function propertyInjectable<T extends PropertyInjectableConstructConstruc
       super(scope, id, props, ...args);
     }
   };
-  // Preserve the static `name` property
-  Object.defineProperty(WrappedClass, 'name', {
+  Object.defineProperty(PropertyInjectable, 'name', {
     value: constructor.name,
     writable: false,
   });
-  return WrappedClass as any;
+  return PropertyInjectable as any;
 }
```

#### Recent Merged Pull Requests:
- **PR #38971** (2026-10-05): docs(acm): fix link text for exportable certificates documentation (@frankhefeng)
- **PR #38968** (2026-10-05): chore(deps): bump dawidd6/action-download-artifact from 25 to 27 (@dependabot[bot])
- **PR #38963** (closed): fix(ecr): accept a tokenized image tag exclusion pattern (@lindsay-cheng)
- **PR #38962** (closed): fix(docdb): accept a tokenized engine version (@lindsay-cheng)
- **PR #38961** (closed): fix(ses-actions): accept a tokenized AddHeader name (@lindsay-cheng)
- **PR #38959** (closed): fix(apigateway): deployment ignores a generated state machine name (@lindsay-cheng)
- **PR #38948** (2026-10-02): fix(bedrockagentcore): accept aws-cn ECR image URIs in Runtime container URI validation (@shawnxli)
- **PR #38939** (2026-10-01): chore: update Contributors File (@aws-cdk-automation)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
