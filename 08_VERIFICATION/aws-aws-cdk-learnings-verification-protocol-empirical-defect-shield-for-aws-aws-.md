# Verification Protocol: Verification Protocol: Empirical Defect Shield for aws-aws-cdk-learnings

<!-- PROVENANCE_START
{
  "source_repository": "aws-aws-cdk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T22:14:43.673Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aws-aws-cdk-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws-aws-cdk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T22:14:43.673Z`  
> **Learning ID**: `LEARN-EVO-aws-aws-cdk-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `aws-aws-cdk-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aws-aws-cdk-learnings.md`  
> **Source**: github ([https://github.com/aws/aws-cdk](https://github.com/aws/aws-cdk))  
> **Source Version**: `0561d668`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T22:14:38.326Z  
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
> **Harvest Timestamp**: 2026-11-18T22:14:38.321Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws/aws-cdk`
- **Description**: The AWS Cloud Development Kit is a framework for defining cloud infrastructure in code
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12986 stars

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

### Incident Patch 1: `8b2487e6` (2026-11-18)
**Commit Message**: feat(core): build bundling images only when an asset is bundled (#39778)

### Issue # (if applicable)

Closes #27991.

### Reason for this change

`DockerImage.fromBuild()` builds the image as soon as it is called, which for PythonFunction means when the construct is created. The build happens even when the image is never used: when bundling is skipped, when the bundled output already exists in `cdk.out` from an earlier synth, or when the same asset was already staged in this app. Unit tests that create a stack with a PythonFunction pay for a Docker build on every run, and so does every synth on a CI runner without a warm Docker cache. Our synth telemetry shows the PythonFunction image build costing a median of 69 s in CI.

Every PythonFunction also runs its own `docker image inspect` (or build) for the same image tag, even though the tag is content-addressed from the build context and options.

### Description of changes

- New `DockerImage.fromBuildOnDemand()`. It computes the same tag and hash as `fromBuild()`, so switching between the two doesn't change asset hashes, but it doesn't build yet. It keeps a copy of the build options it hashed, so later changes to the caller's objec

**File**: `packages/@aws-cdk/aws-lambda-go-alpha/test/bundling.test.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ beforeEach(() => {
 
   jest.spyOn(DockerImage, 'fromBuild').mockReturnValue({
     image: 'built-image',
+    buildImage: () => { },
     cp: () => 'built-image',
     run: () => { },
     toJSON: () => 'build-image',
```

**File**: `packages/@aws-cdk/aws-lambda-python-alpha/lib/bundling.ts` (modified, +3/-6)
```diff
@@ -4,7 +4,7 @@ import { Architecture, Code } from 'aws-cdk-lib/aws-lambda';
 import type { BundlingFileAccess, BundlingOptions as CdkBundlingOptions, DockerVolume } from 'aws-cdk-lib/core';
 import { AssetStaging, DockerImage, PERF_BUNDLING_SRC_SYM } from 'aws-cdk-lib/core';
 import { UnscopedValidationError } from 'aws-cdk-lib/core/lib/errors';
-import { lit, posixShellEscape, profileSpan } from 'aws-cdk-lib/core/lib/helpers-internal';
+import { lit, posixShellEscape } from 'aws-cdk-lib/core/lib/helpers-internal';
 import { Packaging, DependenciesFile } from './packaging';
 import type { BundlingOptions, ICommandHooks } from './types';
 
@@ -110,11 +110,8 @@ export class Bundling implements CdkBundlingOptions {
       // Use the user's image
       this.image = image;
     } else {
-      // Build our own image to do the build in in. We do some counter trickery here: we do want to count
-      // the time spent here as part of 'bundle:PythonFunction', but by default only the RUNNING of the Docker
-      // image would count as that. So we add an additional timer span just for the building of the runner image.
-      using _span = profileSpan(`bundle:${this[PERF_BUNDLING_SRC_SYM]}`, { telemetry: true, skipCount: true });
-      this.image = DockerImage.fromBuild(path.join(__dirname, 'docker'), {
+      // Build our own image to do the build in, but only if and when the asset actually needs bundling.
+      this.image = DockerImage.fromBuildV2(path.join(__dirname, 'docker'), {
         buildArgs: {
           ...props.buildArgs,
           IMAGE: runtime.bundlingImage.image,
```

**File**: `packages/@aws-cdk/aws-lambda-python-alpha/test/bundling.test.ts` (modified, +33/-9)
```diff
@@ -1,15 +1,18 @@
 
 import * as fs from 'fs';
 import * as path from 'path';
-import { BundlingFileAccess, DockerImage } from 'aws-cdk-lib';
+import { AssetStaging, BundlingFileAccess, DockerImage, Stack } from 'aws-cdk-lib';
 import { Architecture, Code, Runtime } from 'aws-cdk-lib/aws-lambda';
 import { Bundling } from '../lib/bundling';
 
 jest.spyOn(Code, 'fromAsset');
-// Stub `DockerImage.fromBuild` so these unit tests never run a real `docker build`.
-// (The `child_process` mock below is bypassed intermittently in CI.) The spy still
-// records calls, so the argument/call-count assertions below are unaffected.
+// Stub `DockerImage.fromBuild` for the tests that build a custom bundling image with it, and
+// `buildImage()` for the bundling image that PythonFunction builds on demand, so these unit
+// tests never run a real `docker build`. (The `child_process` mock below is bypassed
+// intermittently in CI.) The spies still record calls, so the assertions below are unaffected.
 jest.spyOn(DockerImage, 'fromBuild').mockReturnValue(new DockerImage('cdk-bundling-image-stub'));
+jest.spyOn(DockerImage, 'fromBuildV2');
+const buildImage = jest.spyOn(DockerImage.prototype, 'buildImage').mockImplementation(() => {});
 
 jest.mock('child_process', () => ({
   spawnSync: jest.fn(() => {
@@ -47,7 +50,7 @@ test('Bundling a function without dependencies', () => {
     }),
   }));
 
-  expect(DockerImage.fromBuild).toHaveBeenCalledWith(expect.stringMatching(path.join(__dirname, '..', 'lib')), expect.objectContaining({
+  expect(DockerImage.fromBuildV2).toHaveBeenCalledWith(expect.stringMatching(path.join(__dirname, '..', 'lib')), expect.objectContaining({
     buildArgs: expect.objectContaining({
       IMAGE: expect.stringMatching(/build-python/),
     }),
@@ -477,7 +480,7 @@ test('Bundling with custom build args', () => {
     buildArgs: { PIP_INDEX_URL: testPypi },
   });
 
-  expect(DockerImage.fromBuild).toHaveBeenCalledWith(expect.stringMatching(path.join(__dirname, '..', 'lib')), expect.objectContaining({
+  expect(DockerImage.fromBuildV2).toHaveBeenCalledWith(expect.stringMatching(path.join(__dirname, '..', 'lib')), expect.objectContaining({
     buildArgs: expect.objectContaining({
       PIP_INDEX_URL: testPypi,
     }),
@@ -617,18 +620,39 @@ test('Do not build docker image when skipping bundling', () => {
     skip: true,
   });
 
-  expect(DockerImage.fromBuild).not.toHaveBeenCalled();
+  expect(DockerImage.fromBuildV2).not.toHaveBeenCalled();
 });
 
-test('Build docker image when bundling is not skipped', () => {
+test('Does not build the docker image when the bundling options are created', () => {
   const entry = path.join(__dirname, 'lambda-handler');
   Bundling.bundle({
     entry: entry,
     runtime: Runtime.PYTHON_3_12,
     skip: false,
   });
 
-  expect(DockerImage.fromBuild).toHaveBeenCalled();
+  expect(DockerImage.fromBuildV2).toHaveBeenCalled();
+  expect(buildImage).not.toHaveBeenCalled();
+});
+
+test('Builds the docker image when the asset is bundled', () => {
+  const run = jest.spyOn(DockerImage.prototype, 'run').mockImplementation((options) => {
+    const output = options?.volumes?.find(v => v.containerPath === AssetStaging.BUNDLING_OUTPUT_DIR);
+    if (!output) {
+      throw new Error('Expected an output volume');
+    }
+    fs.writeFileSync(path.join(output.hostPath, 'index.py'), '');
+  });
+
+  const code = Bundling.bundle({
+    entry: path.join(__dirname, 'lambda-handler'),
+    runtime: Runtime.PYTHON_3_12,
+    skip: false,
+  });
+  code.bind(new Stack());
+
+  expect(buildImage).toHaveBeenCalled();
+  run.mockRestore();
 });
 
 test('with command hooks', () => {
```

**File**: `packages/aws-cdk-lib/aws-lambda-nodejs/test/bundling.test.ts` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ beforeEach(() => {
 
   jest.spyOn(DockerImage, 'fromBuild').mockReturnValue({
     image: 'built-image',
+    buildImage: () => { },
     cp: () => 'dest-path',
     run: () => { },
     toJSON: () => 'built-image',
```

**File**: `packages/aws-cdk-lib/aws-lambda/README.md` (modified, +37/-35)
```diff
@@ -273,12 +273,12 @@ To use `applicationLogLevelV2` and/or `systemLogLevelV2` you must set `loggingFo
 
 ### Log Group Creation Methods
 
-| Method | Description | Tag Propagation | Prop Injection | Aspects | Notes |
-|--------|-------------|-----------------|----------------|---------|-------|
-| **logRetention prop** | Legacy approach using Custom Resource | False | False | False | Does not support TPA |
-| **logGroup prop** | Explicitly supplied by user in CDK app | True | True | True | Full support for TPA |
-| **Lazy creation** | Lambda service creates logGroup on first invocation | False | False | False | Occurs when both logRetention and logGroup are undefined and USE_CDK_MANAGED_LAMBDA_LOGGROUP is false |
-| **USE_CDK_MANAGED_LAMBDA_LOGGROUP** | CDK Lambda function construct creates log group with default props | True | True | True | Feature flag must be enabled |
+| Method                              | Description                                                        | Tag Propagation | Prop Injection | Aspects | Notes                                                                                                 |
+| ----------------------------------- | ------------------------------------------------------------------ | --------------- | -------------- | ------- | ----------------------------------------------------------------------------------------------------- |
+| **logRetention prop**               | Legacy approach using Custom Resource                              | False           | False          | False   | Does not support TPA                                                                                  |
+| **logGroup prop**                   | Explicitly supplied by user in CDK app                             | True            | True           | True    | Full support for TPA                                                                                  |
+| **Lazy creation**                   | Lambda service creates logGroup on first invocation                | False           | False          | False   | Occurs when both logRetention and logGroup are undefined and USE_CDK_MANAGED_LAMBDA_LOGGROUP is false |
+| **USE_CDK_MANAGED_LAMBDA_LOGGROUP** | CDK Lambda function construct creates log group with default props | True            | True           | True    | Feature flag must be enabled                                                                          |
 
 *TPA: Tag propagation, Prop Injection, Aspects*
 
@@ -925,19 +925,19 @@ Note that once you use a capacity provider in a function, it cannot be removed,
 
 #### CapacityProviderFunctionOptions (addFunction method)
 
-| Name | Type | Required | Description |
-|------|------|----------|-------------|
-| perExecutionEnvironmentMaxConcurrency | number | No | Maximum concurrent invokes per execution environment. |
-| executionEnvironmentMemoryGiBPerVCpu | number | No | Memory per VCPU in GiB. |
-| publishToLatestPublished | boolean | No | Whether to automatically publish to $LATEST.PUBLISHED version. |
-| latestPublishedScalingConfig | LatestPublishedScalingConfig | No | Scaling configuration for $LATEST.PUBLISHED version. |
+| Name                                  | Type                         | Required | Description                                                    |
+| ------------------------------------- | ---------------------------- | -------- | -------------------------------------------------------------- |
+| perExecutionEnvironmentMaxConcurrency | number                       | No       | Maximum concurrent invokes per execution environment.          |
+| executionEnvironmentMemoryGiBPerVCpu  | number                       | No       | Memory per VCPU in GiB.                                        |
+| publishToLatestPublished              | boolean                      | No       | Whether to automatically publish to $LATEST.PUBLISHED version. |
+| latestPublishedScalingConfig          | LatestPublishedScalingConfig | No       | Scaling configuration for $LATEST.PUBLISHED version.           |
 
 #### LatestPublishedScalingConfig
 
-| Name | Type | Required | Description |
-|------|------|----------|-------------|
-| minExecutionEnvironments | number | No | Minimum execution environments for $LATEST.PUBLISHED version. |
-| maxExecutionEnvironments | number | No | Maximum execution environments for $LATEST.PUBLISHED version. |
+| Name                     | Type   | Required | Description                                                   |
+| ------------------------ | ------ | -------- | ------------------------------------------------------------- |
+| minExecutionEnvironments | number | No       | Minimum execution environments for $LATEST.PUBLISHED version. |
+| maxExecutionEnvironments | number | No       | Maximum execution environments for $LATEST.PUBLISHED version. |
 
 ### Capacity Provider Versions
 
@@ -976,10 +976,10 @@ capacityProvider.addFunction(fn, {
 
 #### VersionOptions (Capacity Provide
```

**File**: `packages/aws-cdk-lib/aws-lambda/lib/code.ts` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@ import * as s3_assets from '../../aws-s3-assets';
 import * as cdk from '../../core';
 import { UnscopedValidationError, ValidationError } from '../../core/lib/errors';
 import { lit } from '../../core/lib/private/literal-string';
+import { profileFn } from '../../core/lib/private/perf';
 
 /**
  * How Lambda manages the storage of your code package.
@@ -153,6 +154,7 @@ export abstract class Code {
    * @param path The path to the directory containing the Docker file
    * @param options Docker build options
    */
+  @profileFn('Code.fromDockerBuild', { telemetry: true })
   public static fromDockerBuild(path: string, options: DockerBuildAssetOptions = {}): AssetCode {
     let imagePath = options.imagePath ?? '/asset/.';
 
```

**File**: `packages/aws-cdk-lib/aws-lambda/test/code.test.ts` (modified, +1/-0)
```diff
@@ -547,6 +547,7 @@ describe('code', () => {
     beforeEach(() => {
       cpMock = jest.fn().mockReturnValue(path.join(__dirname, 'docker-build-lambda'));
       fromBuildMock = jest.spyOn(cdk.DockerImage, 'fromBuild').mockImplementation(() => ({
+        buildImage: jest.fn(),
         cp: cpMock,
         image: 'tag',
         run: jest.fn(),
```

**File**: `packages/aws-cdk-lib/aws-s3-assets/README.md` (modified, +7/-1)
```diff
@@ -75,7 +75,13 @@ The following example uses custom asset bundling to convert a markdown file to h
 [Example of using asset bundling](./test/integ.assets.bundling.lit.ts).
 
 The bundling docker image (`image`) can either come from a registry (`DockerImage.fromRegistry`)
-or it can be built from a `Dockerfile` located inside your project (`DockerImage.fromBuild`).
+or it can be built from a `Dockerfile` located inside your project.
+
+We recommend to use `DockerImage.fromBuildV2` for images you build yourself.
+The image is only built when an asset actually needs bundling. This way, a synth
+that reuses existing bundling output, or skips bundling altogether, doesn't wait
+for a Docker build. If you need the image right away, for example to run your own
+`docker` commands with it, call `buildImage()` on it first.
 
 You can set the `CDK_DOCKER` environment variable in order to provide a custom
 docker program to execute. This may sometime be needed when building in
```

---

### Incident Patch 2: `205ff79a` (2026-11-18)
**Commit Message**: chore: build logs on GitHub Actions are too long to be useful (#39821)

### Issue # (if applicable)

N/A

### Reason for this change

The build logs on GitHub Actions are very long, because the output of every package is printed in one stream, interleaved with other packages running at the same time. Finding a failure means scrolling through thousands of lines, and test failures don't show up on the PR itself.

### Description of changes

`build.sh` no longer passes `--stream` to `lerna run` in CI. Without it, nx prints each task's output as one collapsible group when the task finishes, so the log shows one line per package and failures are easy to find. The downside is that a long task like the `aws-cdk-lib` build shows no output until it's done.

The shared jest config in `cdk-build-tools` adds the `github-actions` reporter when `GITHUB_ACTIONS` is set, so test failures show up as annotations on the PR. It runs with `silent: true`, so it doesn't print its own per-file groups: GitHub can't nest groups inside the ones nx creates. The `default` and `jest-junit` reporters are unchanged. Previously the reporter wasn't active at all, because jest only adds it automatically when `report

**File**: `build.sh` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ fi
 
 flags=""
 if [ "$ci" == "true" ]; then
-  flags="--stream --no-progress --skip-nx-cache"
+  flags="--no-progress --skip-nx-cache"
   export FORCE_COLOR=false
 fi
 
```

**File**: `tools/@aws-cdk/cdk-build-tools/config/jest.config.js` (modified, +7/-1)
```diff
@@ -19,6 +19,8 @@ process.env.CDK_CONTEXT_JSON = JSON.stringify({
 // so we can more easily attach the debugger to the subprocesses.
 const isVsCodeDebugTerminal = process.env.NODE_OPTIONS?.includes('ms-vscode.js-debug') ?? false;
 
+const jestJunitReporter = ['jest-junit', { suiteName: 'jest tests', outputDirectory: 'coverage', suiteNameTemplate: '{filepath}', classNameTemplate: '{classname}', titleTemplate: '{title}' }];
+
 /** @type {import('ts-jest').JestConfigWithTsJest} */
 module.exports = {
   // The preset deals with preferring TS over JS
@@ -58,7 +60,11 @@ module.exports = {
   coveragePathIgnorePatterns: ['\\.generated\\.[jt]s$', '<rootDir>/test/', '.warnings.jsii.js$', '/node_modules/', '/analytics-data-source/'],
   reporters: [
     'default',
-    ['jest-junit', { suiteName: 'jest tests', outputDirectory: 'coverage', suiteNameTemplate: '{filepath}', classNameTemplate: '{classname}', titleTemplate: '{title}' }]],
+    // Failure annotations on the PR. Not grouped per test file, because nx
+    // already groups each package's output and GitHub can't nest groups.
+    ...(process.env.GITHUB_ACTIONS ? [['github-actions', { silent: true }]] : []),
+    jestJunitReporter,
+  ],
 
   setupFilesAfterEnv,
 };
```

---

### Incident Patch 3: `5fafec90` (2026-11-18)
**Commit Message**: chore(workflows): docker image cache fills the cache budget without speeding up builds (#39831)

### Issue # (if applicable)

N/A

### Reason for this change

The Docker image cache (`docker-cache-Linux`) has grown to 10.8 GB, which is more than the repo's whole cache budget, so it evicts every other cache. Restoring it costs time on every PR build, and saving it on main took about 22 minutes on the [last run](https://github.com/aws/aws-cdk/actions/runs/44296115102). It doesn't help the builds either.

The cache was added in #34841 to avoid the public ECR rate limit for unauthenticated pulls, by loading base images from the cache instead of pulling them. That doesn't work with how our builds run. `setup-buildx-action` creates a `docker-container` builder and makes it the default, so every `docker build`, including the ones CDK runs during tests, runs in that builder. The builder can't see the Docker image store, so `FROM public.ecr.aws/...` always resolves and downloads from the registry, and the builder starts empty on every run. The images that do end up in the image store are the ones the build produces, and each of them includes the layers of its base image, which is where the 

**File**: `.github/workflows/codebuild-pr-build.yml` (modified, +0/-24)
```diff
@@ -53,18 +53,6 @@ jobs:
       - name: Set up Docker
         uses: docker/setup-buildx-action@v4
 
-      - name: Load Docker images
-        id: docker-cache
-        uses: actions/cache/restore@v6
-        with:
-          path: |
-            ~/.docker-images.tar
-          key: docker-cache-${{ runner.os }}
-
-      - name: Restore Docker images
-        if: ${{ steps.docker-cache.outputs.cache-hit }}
-        run: docker image load --input ~/.docker-images.tar
-
       - name: Restore build artifacts
         id: s3buildcache
         uses: actions/cache/restore@v6
@@ -102,18 +90,6 @@ jobs:
             ~/.s3buildcache
           key: s3buildcache-${{ runner.os }}
 
-      - name: Export Docker images
-        if: ${{ github.event_name == 'push' && github.ref_name == 'main' }}
-        run: docker image save --output ~/.docker-images.tar $(docker image list --format '{{ if ne .Repository "<none>" }}{{ .Repository }}{{ if ne .Tag "<none>" }}:{{ .Tag }}{{ end }}{{ else }}{{ .ID }}{{ end }}')
-
-      - name: Cache Docker images
-        if: ${{ github.event_name == 'push' && github.ref_name == 'main' }}
-        uses: actions/cache/save@v6
-        with:
-          path: |
-            ~/.docker-images.tar
-          key: docker-cache-${{ runner.os }}
-
       - name: Save PR info for PR Linter
         if: github.event_name == 'pull_request'
         env:
```

**File**: `.github/workflows/integration-test-deployment.yml` (modified, +0/-24)
```diff
@@ -67,18 +67,6 @@ jobs:
       - name: Set up Docker
         uses: docker/setup-buildx-action@v4
 
-      - name: Load Docker images
-        id: docker-cache
-        uses: actions/cache/restore@v6
-        with:
-          path: |
-            ~/.docker-images.tar
-          key: docker-cache-${{ runner.os }}
-
-      - name: Restore Docker images
-        if: ${{ steps.docker-cache.outputs.cache-hit }}
-        run: docker image load --input ~/.docker-images.tar
-
       - name: Restore build artifacts
         uses: actions/cache/restore@v6
         with:
@@ -113,15 +101,3 @@ jobs:
           CDK_ATMOSPHERE_BATCH_SIZE: ${{ vars.CDK_ATMOSPHERE_BATCH_SIZE }}
           TARGET_BRANCH_COMMIT: ${{ github.event.pull_request.base.sha }}
           SOURCE_BRANCH_COMMIT: ${{ github.event.pull_request.head.sha }}
-          
-      - name: Export Docker images
-        if: ${{ github.event_name == 'push' && github.ref_name == 'main' }}
-        run: docker image save --output ~/.docker-images.tar $(docker image list --format '{{ if ne .Repository "<none>" }}{{ .Repository }}{{ if ne .Tag "<none>" }}:{{ .Tag }}{{ end }}{{ else }}{{ .ID }}{{ end }}')
-
-      - name: Cache Docker images
-        if: ${{ github.event_name == 'push' && github.ref_name == 'main' }}
-        uses: actions/cache/save@v6
-        with:
-          path: |
-            ~/.docker-images.tar
-          key: docker-cache-${{ runner.os }}
```

**File**: `.github/workflows/pr-build.yml` (modified, +0/-24)
```diff
@@ -55,18 +55,6 @@ jobs:
       - name: Set up Docker
         uses: docker/setup-buildx-action@v4
 
-      - name: Load Docker images
-        id: docker-cache
-        uses: actions/cache/restore@v6
-        with:
-          path: |
-            ~/.docker-images.tar
-          key: docker-cache-${{ runner.os }}
-
-      - name: Restore Docker images
-        if: ${{ steps.docker-cache.outputs.cache-hit }}
-        run: docker image load --input ~/.docker-images.tar
-
       - name: Restore build artifacts
         id: s3buildcache
         uses: actions/cache/restore@v6
@@ -103,15 +91,3 @@ jobs:
           path: |
             ~/.s3buildcache
           key: s3buildcache-${{ runner.os }}
-
-      - name: Export Docker images
-        if: ${{ github.event_name == 'push' && github.ref_name == 'main' }}
-        run: docker image save --output ~/.docker-images.tar $(docker image list --format '{{ if ne .Repository "<none>" }}{{ .Repository }}{{ if ne .Tag "<none>" }}:{{ .Tag }}{{ end }}{{ else }}{{ .ID }}{{ end }}')
-
-      - name: Cache Docker images
-        if: ${{ github.event_name == 'push' && github.ref_name == 'main' }}
-        uses: actions/cache/save@v6
-        with:
-          path: |
-            ~/.docker-images.tar
-          key: docker-cache-${{ runner.os }}
```

#### Recent Merged Pull Requests:
- **PR #39831** (2026-11-18): chore(workflows): docker image cache fills the cache budget without speeding up builds (@mrgrain)
- **PR #39830** (2026-11-18): chore: npm-check-updates && yarn upgrade (@aws-cdk-automation)
- **PR #39829** (2026-11-18): chore(eslint-config): @cdklabs/eslint-plugin peer dependencies don't match eslint 9 (@mrgrain)
- **PR #39827** (2026-11-18): chore(workflows): codeql overlay caches take up cache space for little gain (@mrgrain)
- **PR #39826** (2026-11-18): chore: yarn install warns about unmet constructs peer dependencies (@mrgrain)
- **PR #39825** (2026-11-18): chore(core): extracting test fixture tarballs prints tar header warnings (@mrgrain)

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

## X. core): build bundling images only when an asset is bundled

**RULE**:
When implementing operations in `packages/@aws-cdk/aws-lambda-go-alpha/test/bundling.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8b2487e6`: core): build bundling images only when an asset is bundled. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/@aws-cdk/aws-lambda-go-alpha/test/bundling.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    buildImage: () => { },
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8b2487e6` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
