# Forensic Learning Record (Deep Inspection): activepieces/activepieces

> **Canonical Artifact**: `07_PROJECT_LEARNING/activepieces-activepieces-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/activepieces/activepieces](https://github.com/activepieces/activepieces))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:33:01.943Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `activepieces/activepieces`
- **Description**: AI Agents & MCPs & AI Workflow Automation • (~400 MCP servers for AI agents) • AI Automation / AI Agent with MCPs • AI Workflows & AI Agents • MCPs for AI Agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 24814 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/oom-code.js`
```
export const code = async () => {
  const chunk = 'x'.repeat(52428800);
  const hog = [];
  for (let i = 0; i < 64; i = i + 1) {
    hog.push(chunk);
  }
  return hog;
};

```

### Core Architecture Module: `benchmark/probe-fs.js`
```
export const code = async () => {
    const fs = require('fs');
    const probe = (p) => {
        try {
            fs.accessSync(p, fs.constants.R_OK);
            return { ok: true, isDir: fs.statSync(p).isDirectory() };
        } catch (e) {
            return { ok: false, code: e.code ?? 'UNKNOWN' };
        }
    };
    const paths = [
        '/usr/src/app',
        '/usr/src/app/cache',
        '/usr/src/node_modules',
        '/usr/bin',
        '/usr/local/bin/node',
        '/etc',
        '/root',
        '/root/codes',
    ];
    return {
        paths: Object.fromEntries(paths.map((p) => [p, probe(p)])),
        envKeys: Object.keys(process.env).sort(),
    };
};

```

### Core Architecture Module: `commitlint.config.js`
```
module.exports = { extends: ['@commitlint/config-conventional'] };

```

### Core Architecture Module: `deploy/pulumi/autotag.ts`
```
import * as pulumi from "@pulumi/pulumi";
import { isTaggable } from "./taggable";

/**
 * registerAutoTags registers a global stack transformation that merges a set
 * of tags with whatever was also explicitly added to the resource definition.
 */
export function registerAutoTags(autoTags: Record<string, string>): void {
    pulumi.runtime.registerStackTransformation((args) => {
        if (isTaggable(args.type)) {
            args.props["tags"] = { ...args.props["tags"], ...autoTags };
            return { props: args.props, opts: args.opts };
        }
        return undefined;
    });
}
```

### Core Architecture Module: `deploy/pulumi/index.ts`
```
import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import { ApplicationLoadBalancer } from "@pulumi/awsx/lb/applicationLoadBalancer";
import { registerAutoTags } from './autotag';
import * as child_process from "child_process";

const stack = pulumi.getStack();
const config = new pulumi.Config();

const apEncryptionKey = config.getSecret("apEncryptionKey")?.apply(secretValue => {
    return secretValue || child_process.execSync("openssl rand -hex 16").toString().trim();
});
const apJwtSecret = config.getSecret("apJwtSecret")?.apply(secretValue => {
    return secretValue || child_process.execSync("openssl rand -hex 32").toString().trim();
});
const containerCpu = config.requireNumber("containerCpu");
const containerMemory = config.requireNumber("containerMemory");
const containerInstances = config.requireNumber("containerInstances");
const addIpToPostgresSecurityGroup = config.get("addIpToPostgresSecurityGroup");
const domain = config.get("domain");
const subDomain = config.get("subDomain");
const usePostgres = config.requireBoolean("usePostgres");
const useRedis = config.requireBoolean("useRedis");
const redisNodeType = config.require("redisNodeType");
const dbIsPublic = config.getBoolean("dbIsPublic");
const dbUsername = config.get("dbUsername");
const dbPassword = config.getSecret("dbPassword");
const dbInstanceClass = config.require("dbInstanceClass");

// Add tags for every resource that allows them, with the following properties.
// Useful to know who or what created the resource/service
registerAutoTags({
    "pulumi:Project": pulumi.getProject(),
    "pulumi:Stack": pulumi.getStack(),
    "Created by": config.get("author") || child_process.execSync("pulumi whoami").toString().trim().replace('\\', '/')
});

let imageName;

// Check if we're deploying a local build or direct from Docker Hub
if (config.getBoolean("deployLocalBuild")) {

    const repoName = config.require("repoName");

    const repo = new aws.ecr.Repository(repoName, {
        name: repoName // https://www.pulumi.com/docs/intro/concepts/resources/names/#autonaming
    }); // Create a private ECR repository

    const repoUrl = pulumi.interpolate`${repo.repositoryUrl}`; // Get registry info (creds and endpoint)
    const name = pulumi.interpolate`${repoUrl}:latest`;

    // Get the repository credentials we use to push the image to the repository
    const repoCreds = repo.registryId.apply(async (registryId) => {
        const credentials = await aws.ecr.getCredentials({
            registryId: registryId,
        });
        const decodedCredentials = Buffer.from(credentials.authorizationToken, "base64").toString();
        const [username, password] = decodedCredentials.split(":");
        return {
            server: credentials.proxyEndpoint,
            username,
            password
        };
    });

    // Build and publish the container image.
    const image = new docker.Image(stack, {
        build: {
            context: `../../`,
            dockerfile: `../../Dockerfile`,
            builderVersion: "BuilderBuildKit",
            args: {
                "BUILDKIT_INLINE_CACHE": "1"
            },
        },
        skipPush: pulumi.runtime.isDryRun(),
        imageName: name,
        registry: repoCreds
    });

    imageName = image.imageName;

    pulumi.log.info(`Finished pushing image to ECR`, image);
} else {
    imageName = process.env.IMAGE_NAME || config.get("imageName") || "activepieces/activepieces:latest";
}

const containerEnvironmentVars: awsx.types.input.ecs.TaskDefinitionKeyValuePairArgs[] = [];

// Allocate a new VPC with the default settings:
const vpc = new awsx.ec2.Vpc(`${stack}-vpc`, {
    numberOfAvailabilityZones: 2,
    natGateways: {
        strategy: "Single"
    },
    tags: {
        // For some reason, this is how you name a VPC with AWS:
        // https://github.com/pulumi/pulumi-terraform/issues/38#issue-262186406
        Name: `${stack}-vpc`
    },
    enableDnsHostnames: true,
    enableDnsSupport: true
});

const albSecGroup = new aws.ec2.SecurityGroup(`${stack}-alb-sg`, {
    name: `${stack}-alb-sg`,
    vpcId: vpc.vpcId,
    ingress: [{ // Allow only http & https traffic
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        cidrBlocks: ["0.0.0.0/0"]
    },
    {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        cidrBlocks: ["0.0.0.0/0"]
    }],
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"]
    }]
})

const fargateSecGroup = new aws.ec2.SecurityGroup(`${stack}-fargate-sg`, {
    name: `${stack}-fargate-sg`,
    vpcId: vpc.vpcId,
    ingress: [
        {
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            securityGroups: [albSecGroup.id]
        }
    ],
    egress: [ // allow all outbound traffic
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"]
        }
    ]
});

if (usePostgres) {
    const rdsSecurityGroupArgs: aws.ec2.SecurityGroupArgs = {
        name: `${stack}-db-sg`,
        vpcId: vpc.vpcId,
        ingress: [{
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            securityGroups: [fargateSecGroup.id]  // The id of the Fargate security group
        }],
        egress: [ // allow all outbound traffic
            {
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ["0.0.0.0/0"]
            }
        ]
    };

    // Optionally add the current outgoing public IP address to the CIDR block
    // so that they can connect directly to the Db during development
    if (addIpToPostgresSecurityGroup) {

        // @ts-ignore
        rdsSecurityGroupArgs.ingress.push({
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            cidrBlocks: [`${addIpToPostgresSecurityGroup}/32`],
            description: `Public IP for local connection`
        });
    }

    const rdsSecurityGroup = new aws.ec2.SecurityGroup(`${stack}-db-sg`, rdsSecurityGroupArgs);

    const rdsSubnets = new aws.rds.SubnetGroup(`${stack}-db-subnet-group`, {
        name: `${stack}-db-subnet-group`,
        subnetIds: dbIsPublic ? vpc.publicSubnetIds : vpc.privateSubnetIds
    });

    const db = new aws.rds.Instance(stack, {
        allocatedStorage: 10,
        engine: "postgres",
        engineVersion: "14.9",
        identifier: stack, // In RDS
        dbName: "postgres", // When connected to the DB host
        instanceClass: dbInstanceClass,
        port: 5432,
        publiclyAccessible: dbIsPublic,
        skipFinalSnapshot: true,
        storageType: "gp2",
        username: dbUsername,
        password: dbPassword,
        dbSubnetGroupName: rdsSubnets.id,
        vpcSecurityGroupIds: [rdsSecurityGroup.id],
        backupRetentionPeriod: 0,
        applyImmediately: true,
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true
    }, {
        protect: dbIsPublic === false,
        deleteBeforeReplace: true
    });

    containerEnvironmentVars.push(
        {
            name: "AP_POSTGRES_DATABASE",
            value: db.dbName
        },
        {
            name: "AP_POSTGRES_HOST",
            value: db.address
        },
        {
            name: "AP_POSTGRES_PORT",
            value: pulumi.interpolate`${db.port}`
        },
        {
            name: "AP_POSTGRES_USERNAME",
            value: db.username
        },
        {
            name: "AP_POSTGRES_PASSWORD",
            value: config.requireSecret("dbPassword")
        },
        {
            name: "AP_POSTGRES_USE_SSL",
            value: "false"
        });

} else {
    containerEnvironmentVars.push(
        {
            name: "AP_DB_TYPE",
            value: "SQLITE3"
        });
}

if
```

### Core Architecture Module: `deploy/pulumi/taggable.ts`
```
/**
 * isTaggable returns true if the given resource type is an AWS resource that supports tags.
 */
 export function isTaggable(t: string): boolean {
    return (taggableResourceTypes.indexOf(t) !== -1);
}

// taggableResourceTypes is a list of known AWS type tokens that are taggable.
const taggableResourceTypes = [
    "aws:accessanalyzer/analyzer:Analyzer",
    "aws:acm/certificate:Certificate",
    "aws:acmpca/certificateAuthority:CertificateAuthority",
    "aws:alb/loadBalancer:LoadBalancer",
    "aws:alb/targetGroup:TargetGroup",
    "aws:apigateway/apiKey:ApiKey",
    "aws:apigateway/clientCertificate:ClientCertificate",
    "aws:apigateway/domainName:DomainName",
    "aws:apigateway/restApi:RestApi",
    "aws:apigateway/stage:Stage",
    "aws:apigateway/usagePlan:UsagePlan",
    "aws:apigateway/vpcLink:VpcLink",
    "aws:applicationloadbalancing/loadBalancer:LoadBalancer",
    "aws:applicationloadbalancing/targetGroup:TargetGroup",
    "aws:appmesh/mesh:Mesh",
    "aws:appmesh/route:Route",
    "aws:appmesh/virtualNode:VirtualNode",
    "aws:appmesh/virtualRouter:VirtualRouter",
    "aws:appmesh/virtualService:VirtualService",
    "aws:appsync/graphQLApi:GraphQLApi",
    "aws:athena/workgroup:Workgroup",
    "aws:autoscaling/group:Group",
    "aws:backup/plan:Plan",
    "aws:backup/vault:Vault",
    "aws:cfg/aggregateAuthorization:AggregateAuthorization",
    "aws:cfg/configurationAggregator:ConfigurationAggregator",
    "aws:cfg/rule:Rule",
    "aws:cloudformation/stack:Stack",
    "aws:cloudformation/stackSet:StackSet",
    "aws:cloudfront/distribution:Distribution",
    "aws:cloudhsmv2/cluster:Cluster",
    "aws:cloudtrail/trail:Trail",
    "aws:cloudwatch/eventRule:EventRule",
    "aws:cloudwatch/logGroup:LogGroup",
    "aws:cloudwatch/metricAlarm:MetricAlarm",
    "aws:codebuild/project:Project",
    "aws:codecommit/repository:Repository",
    "aws:codepipeline/pipeline:Pipeline",
    "aws:codepipeline/webhook:Webhook",
    "aws:codestarnotifications/notificationRule:NotificationRule",
    "aws:cognito/identityPool:IdentityPool",
    "aws:cognito/userPool:UserPool",
    "aws:datapipeline/pipeline:Pipeline",
    "aws:datasync/agent:Agent",
    "aws:datasync/efsLocation:EfsLocation",
    "aws:datasync/locationSmb:LocationSmb",
    "aws:datasync/nfsLocation:NfsLocation",
    "aws:datasync/s3Location:S3Location",
    "aws:datasync/task:Task",
    "aws:dax/cluster:Cluster",
    "aws:directconnect/connection:Connection",
    "aws:directconnect/hostedPrivateVirtualInterfaceAccepter:HostedPrivateVirtualInterfaceAccepter",
    "aws:directconnect/hostedPublicVirtualInterfaceAccepter:HostedPublicVirtualInterfaceAccepter",
    "aws:directconnect/hostedTransitVirtualInterfaceAcceptor:HostedTransitVirtualInterfaceAcceptor",
    "aws:directconnect/linkAggregationGroup:LinkAggregationGroup",
    "aws:directconnect/privateVirtualInterface:PrivateVirtualInterface",
    "aws:directconnect/publicVirtualInterface:PublicVirtualInterface",
    "aws:directconnect/transitVirtualInterface:TransitVirtualInterface",
    "aws:directoryservice/directory:Directory",
    "aws:dlm/lifecyclePolicy:LifecyclePolicy",
    "aws:dms/endpoint:Endpoint",
    "aws:dms/replicationInstance:ReplicationInstance",
    "aws:dms/replicationSubnetGroup:ReplicationSubnetGroup",
    "aws:dms/replicationTask:ReplicationTask",
    "aws:docdb/cluster:Cluster",
    "aws:docdb/clusterInstance:ClusterInstance",
    "aws:docdb/clusterParameterGroup:ClusterParameterGroup",
    "aws:docdb/subnetGroup:SubnetGroup",
    "aws:dynamodb/table:Table",
    "aws:ebs/snapshot:Snapshot",
    "aws:ebs/snapshotCopy:SnapshotCopy",
    "aws:ebs/volume:Volume",
    "aws:ec2/ami:Ami",
    "aws:ec2/amiCopy:AmiCopy",
    "aws:ec2/amiFromInstance:AmiFromInstance",
    "aws:ec2/capacityReservation:CapacityReservation",
    "aws:ec2/customerGateway:CustomerGateway",
    "aws:ec2/defaultNetworkAcl:DefaultNetworkAcl",
    "aws:ec2/defaultRouteTable:DefaultRouteTable",
    "aws:ec2/defaultSecurityGroup:DefaultSecurityGroup",
    "aws:ec2/defaultSubnet:DefaultSubnet",
    "aws:ec2/defaultVpc:DefaultVpc",
    "aws:ec2/defaultVpcDhcpOptions:DefaultVpcDhcpOptions",
    "aws:ec2/eip:Eip",
    "aws:ec2/fleet:Fleet",
    "aws:ec2/instance:Instance",
    "aws:ec2/internetGateway:InternetGateway",
    "aws:ec2/keyPair:KeyPair",
    "aws:ec2/launchTemplate:LaunchTemplate",
    "aws:ec2/natGateway:NatGateway",
    "aws:ec2/networkAcl:NetworkAcl",
    "aws:ec2/networkInterface:NetworkInterface",
    "aws:ec2/placementGroup:PlacementGroup",
    "aws:ec2/routeTable:RouteTable",
    "aws:ec2/securityGroup:SecurityGroup",
    "aws:ec2/spotInstanceRequest:SpotInstanceRequest",
    "aws:ec2/subnet:Subnet",
    "aws:ec2/vpc:Vpc",
    "aws:ec2/vpcDhcpOptions:VpcDhcpOptions",
    "aws:ec2/vpcEndpoint:VpcEndpoint",
    "aws:ec2/vpcEndpointService:VpcEndpointService",
    "aws:ec2/vpcPeeringConnection:VpcPeeringConnection",
    "aws:ec2/vpcPeeringConnectionAccepter:VpcPeeringConnectionAccepter",
    "aws:ec2/vpnConnection:VpnConnection",
    "aws:ec2/vpnGateway:VpnGateway",
    "aws:ec2clientvpn/endpoint:Endpoint",
    "aws:ec2transitgateway/routeTable:RouteTable",
    "aws:ec2transitgateway/transitGateway:TransitGateway",
    "aws:ec2transitgateway/vpcAttachment:VpcAttachment",
    "aws:ec2transitgateway/vpcAttachmentAccepter:VpcAttachmentAccepter",
    "aws:ecr/repository:Repository",
    "aws:ecs/capacityProvider:CapacityProvider",
    "aws:ecs/cluster:Cluster",
    "aws:ecs/service:Service",
    "aws:ecs/taskDefinition:TaskDefinition",
    "aws:efs/fileSystem:FileSystem",
    "aws:eks/cluster:Cluster",
    "aws:eks/fargateProfile:FargateProfile",
    "aws:eks/nodeGroup:NodeGroup",
    "aws:elasticache/cluster:Cluster",
    "aws:elasticache/replicationGroup:ReplicationGroup",
    "aws:elasticbeanstalk/application:Application",
    "aws:elasticbeanstalk/applicationVersion:ApplicationVersion",
    "aws:elasticbeanstalk/environment:Environment",
    "aws:elasticloadbalancing/loadBalancer:LoadBalancer",
    "aws:elasticloadbalancingv2/loadBalancer:LoadBalancer",
    "aws:elasticloadbalancingv2/targetGroup:TargetGroup",
    "aws:elasticsearch/domain:Domain",
    "aws:elb/loadBalancer:LoadBalancer",
    "aws:emr/cluster:Cluster",
    "aws:fsx/lustreFileSystem:LustreFileSystem",
    "aws:fsx/windowsFileSystem:WindowsFileSystem",
    "aws:gamelift/alias:Alias",
    "aws:gamelift/build:Build",
    "aws:gamelift/fleet:Fleet",
    "aws:gamelift/gameSessionQueue:GameSessionQueue",
    "aws:glacier/vault:Vault",
    "aws:glue/crawler:Crawler",
    "aws:glue/job:Job",
    "aws:glue/trigger:Trigger",
    "aws:iam/role:Role",
    "aws:iam/user:User",
    "aws:inspector/resourceGroup:ResourceGroup",
    "aws:kinesis/analyticsApplication:AnalyticsApplication",
    "aws:kinesis/firehoseDeliveryStream:FirehoseDeliveryStream",
    "aws:kinesis/stream:Stream",
    "aws:kms/externalKey:ExternalKey",
    "aws:kms/key:Key",
    "aws:lambda/function:Function",
    "aws:lb/loadBalancer:LoadBalancer",
    "aws:lb/targetGroup:TargetGroup",
    "aws:licensemanager/licenseConfiguration:LicenseConfiguration",
    "aws:lightsail/instance:Instance",
    "aws:mediaconvert/queue:Queue",
    "aws:mediapackage/channel:Channel",
    "aws:mediastore/container:Container",
    "aws:mq/broker:Broker",
    "aws:mq/configuration:Configuration",
    "aws:msk/cluster:Cluster",
    "aws:neptune/cluster:Cluster",
    "aws:neptune/clusterInstance:ClusterInstance",
    "aws:neptune/clusterParameterGroup:ClusterParameterGroup",
    "aws:neptune/eventSubscription:EventSubscription",
    "aws:neptune/parameterGroup:ParameterGroup",
    "aws:neptune/subnetGroup:SubnetGroup",
    "aws:opsworks/stack:Stack",
    "aws:organizations/account:Account",
    "aws:pinpoint/app:App",
    "aws:qldb/ledger:Ledger",
    "aws:ram/resourceShare:ResourceShare",
    "aws:rds/cluster:Cluster",
    "aws:rds/clusterEndpoint:ClusterEndpoint",
    "aws:rds/clusterInstance:ClusterInstance",
    "aws:rds/clusterPara
```

### Core Architecture Module: `packages/cli/src/index.ts`
```
import { Command } from 'commander';
import { createActionCommand } from './lib/commands/create-action';
import { createPieceCommand } from './lib/commands/create-piece';
import { createTriggerCommand } from './lib/commands/create-trigger';
import { syncPieceCommand } from './lib/commands/sync-pieces';
import { publishPieceCommand } from './lib/commands/publish-piece';
import { buildPieceCommand } from './lib/commands/build-piece';
import { bundlePieceCommand } from './lib/commands/bundle-piece';
import { migratePieceCommand } from './lib/commands/migrate-piece';
import { generateWorkerTokenCommand } from './lib/commands/generate-worker-token';
import { generateTranslationFileForAllPiecesCommand, generateTranslationFileForPieceCommand } from './lib/commands/generate-translation-file-for-piece';
import { replaceProjectCommand } from './lib/commands/replace-project';
import { benchmarkCommand } from './lib/commands/benchmark';

const pieceCommand = new Command('pieces')
  .description('Manage pieces');

pieceCommand.addCommand(createPieceCommand);
pieceCommand.addCommand(syncPieceCommand);
pieceCommand.addCommand(publishPieceCommand);
pieceCommand.addCommand(buildPieceCommand);
pieceCommand.addCommand(bundlePieceCommand);
pieceCommand.addCommand(migratePieceCommand);
pieceCommand.addCommand(generateTranslationFileForPieceCommand);
pieceCommand.addCommand(generateTranslationFileForAllPiecesCommand);
const actionCommand = new Command('actions')
  .description('Manage actions');

actionCommand.addCommand(createActionCommand);

const triggerCommand = new Command('triggers')
  .description('Manage triggers')

triggerCommand.addCommand(createTriggerCommand)


const workerCommand = new Command('workers')
  .description('Manage workers')

workerCommand.addCommand(generateWorkerTokenCommand)

const projectCommand = new Command('project')
  .description('Manage projects')

projectCommand.addCommand(replaceProjectCommand)

const program = new Command();

program.version('0.0.1').description('Activepieces CLI');

program.addCommand(pieceCommand);
program.addCommand(actionCommand);
program.addCommand(triggerCommand);
program.addCommand(workerCommand);
program.addCommand(projectCommand);
program.addCommand(benchmarkCommand);
program.parse(process.argv);

```

### Core Architecture Module: `packages/cli/src/lib/commands/benchmark.ts`
```
import os from 'os';
import autocannon from 'autocannon';
import axios, { AxiosInstance, AxiosError } from 'axios';
import chalk from 'chalk';
import { Command } from 'commander';
import { Project } from '@activepieces/shared';

const BENCHMARK_DOC = 'Load-test a deployment\'s sync-webhook path, auto-discover its shape, and attribute latency (queue-wait vs service-time) against the recommended setup.';

export const benchmarkCommand = new Command('benchmark')
    .description(BENCHMARK_DOC)
    .option('--url <url>', 'Activepieces base URL (dev env API port)', 'http://localhost:3000')
    .option('--requests <n>', 'Total requests to fire (default: 40 x concurrency)')
    .option('--concurrency <c>', 'Concurrent connections (default: auto = sum of worker execution slots)')
    .option('--api-key <key>', 'Platform API key (Bearer). Or set AP_API_KEY.')
    .option('--body <json>', 'JSON request body sent to the webhook', '{"test":true}')
    .option('--json', 'Emit machine-readable JSON output')
    .action(async (opts) => {
        const config = benchmarkUtils.normalizeOptions(opts);
        try {
            const client = axios.create({ baseURL: config.url, validateStatus: () => true });
            await waitForReady(client);
            const auth = authenticate({ config });
            const authed = axios.create({
                baseURL: config.url,
                headers: { Authorization: `Bearer ${auth.token}` },
                validateStatus: () => true,
            });

            const [setup, health, diagnostics, flags, network] = await Promise.all([
                discoverSetup(authed),
                collectHealth(authed),
                collectDiagnostics(authed),
                collectFlags(authed),
                measureNetwork(authed),
            ]);

            const project = await provisionProject({ client: authed });
            log(config, `Provisioned throwaway project ${project.id}`);
            const runsFailed = await (async () => {
                const projectLimits = await collectProjectLimits({ client: authed, projectId: project.id, rateLimiterEnabled: flags['PROJECT_RATE_LIMITER_ENABLED'] === true });
                const flowId = await createBenchmarkFlow({ client: authed, projectId: project.id });
                log(config, `Flow ready: ${flowId}`);

                const slots = setup.executionSlots;
                const phases = benchmarkUtils.resolvePhases({ concurrency: config.concurrency, slots });

                const diagnosticsSampler = startDiagnosticsSampler(authed);
                const runs: PhaseReport[] = [];
                for (const phase of phases) {
                    const requests = config.requests ?? Math.max(200, phase.connections * 40);
                    log(config, `Running ${phase.label}: ${requests} requests @ ${phase.connections} connections`);
                    // createdAfter is compared against the server clock, but this timestamp is the CLI's.
                    // The CLI runs cross-region, so its clock can lead the server's — widen the window by a
                    // skew buffer so runs aren't silently dropped. Safe because each benchmark builds a fresh
                    // flow, so the flowId filter still admits only this run's flow runs.
                    const startedAt = new Date(Date.now() - CLOCK_SKEW_BUFFER_MS).toISOString();
                    const queueSampler = startQueueSampler(authed);
                    const result = await autocannon({
                        url: `${config.url}/api/v1/webhooks/${flowId}/sync`,
                        connections: phase.connections,
                        amount: requests,
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: config.body,
                    });
                    const queueDepth = queueSampler.stop();
                    const summary = benchmarkUtils.toSummary({ result, flowId, connections: phase.connections });
                    const runsInWindow = await collectRuns({ client: authed, projectId: project.id, flowId, since: startedAt });
                    runs.push({ label: phase.label, connections: phase.connections, requests, startedAt, summary, timeline: runsInWindow.timeline, outcomes: runsInWindow.outcomes, queueDepth });
                }

                const diagnosticsTimeline = { intervalMs: DIAGNOSTICS_SAMPLE_INTERVAL_MS, samples: diagnosticsSampler.stop() };
                log(config, 'Scanning other projects for flows that ran during the benchmark...');
                const outsideFlows = await collectOutsideFlows({ client: authed, benchmarkProjectId: project.id, since: runs[0].startedAt });
                const storage = await probeStorage({ client: authed, projectId: project.id, flowId });
                const report: BenchmarkReport = { meta: buildMeta({ url: config.url }), flowId, project: { id: project.id, limits: projectLimits }, health, diagnostics, diagnosticsTimeline, setup, flags, network, storage, outsideFlows, runs };

                if (config.json) {
                    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
                } else {
                    renderReport(report);
                }
                return runs.some((r) => r.summary.failed > 0);
            })().finally(async () => {
                log(config, `Deleting throwaway project ${project.id}`);
                await deleteProject({ client: authed, id: project.id });
            });
            process.exit(runsFailed ? 1 : 0);
        } catch (e) {
            const message = e instanceof AxiosError ? `${e.message}${e.response ? ` (HTTP ${e.response.status}: ${JSON.stringify(e.response.data)})` : ''}` : e instanceof Error ? e.message : String(e);
            if (config.json) {
                process.stdout.write(JSON.stringify({ error: message }) + '\n');
            } else {
                console.error(chalk.red(`Benchmark failed: ${message}`));
            }
            process.exit(2);
        }
    });

function normalizeOptions(opts: Record<string, string | boolean | undefined>): BenchmarkConfig {
    const requests = optionalPositiveInt(opts.requests, '--requests');
    const concurrency = optionalPositiveInt(opts.concurrency, '--concurrency');
    const body = String(opts.body);
    try {
        JSON.parse(body);
    } catch {
        throw new Error(`--body must be valid JSON, got "${opts.body}"`);
    }
    const url = String(opts.url);
    return {
        url: url.endsWith('/') ? url.slice(0, -1) : url,
        requests,
        concurrency,
        apiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
        body,
        json: opts.json === true,
    };
}

function resolvePhases({ concurrency, slots }: ResolvePhasesParams): Phase[] {
    if (concurrency !== undefined) {
        return [{ label: `conc ${concurrency}`, connections: concurrency }];
    }
    const base = slots ?? DEFAULT_CONCURRENCY;
    return [{ label: `conc ${base} (= slots)`, connections: base }];
}

function validateSetup(machines: WorkerMachineWithStatus[]): SetupCheck[] {
    if (machines.length === 0) {
        return [{ dimension: 'workers', status: 'WARN', detail: 'No connected workers reported (need a platform-admin token, or no workers online).' }];
    }
    const props = machines.map((m) => m.information.workerProps);
    const modes = unique(props.map((p) => p.EXECUTION_MODE ?? 'unset'));
    const reuse = unique(props.map((p) => p.REUSE_SANDBOX ?? 'unset'));
    const concs = props.map((p) => parseSlot(p.WORKER_CONCURRENCY));
    const cpus = machines.map((m) => m.information.totalCpuCores);
    const ramsGb = machines.map((m) => m.information.totalAvailableRamInBytes / BYTES_PER_GB);

    return [
        {
            dimension: 'sandbox mode',
            status: modes.length === 1 && modes[0] === 'SANDBOX_CODE_ONLY' ? 'PASS' : 'WARN',
            detai
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15824** (2026-09-26): **[BUG]: :latest Docker tag lags behind actual newest release (stuck at 0.82.0 vs 0.92.0). likely sync-version-to-main PR not merged before release-candidate cut**
  *Symptoms*: edit -- it looks like the continuous delivery yml was taken out of commission a few months ago.  Can you guys delete the :latest tag or mark it depreciated if possible?  that would basically fix the issue.  TYSM.  **Describe the bug** The `activepieces/activepieces:latest` Docker tag is stuck on `0.82.0`, while the GitHub Releases page banner shows `0.91.3` as "Latest" and the actual newest release is `0.92.0` (which `docker-compose.yml` on main already points to). Three different "current versions" depending on where you look.  **To Reproduce** 1. Pull repo with :latest tag, check version of -app and -worker - is `0.82.0` 2. Go to the repo's Releases page main banner - shows "0.91.3 (latest)" 3, Click into the full Releases list: newest is `0.92.0` 4. Compare against `docker-compose.yml` on `main`: pinned to `0.92.0`  **Expected behavior** `:latest` should always match the newest published release (`0.92.0`), and the Releases page banner shouldn't lag behind the actual newest release either  **Screenshots** n/a  **Additional context** looks like the same thing as the mismatch around `0.85.x`  I tried looking at the github actions but there are a lot of workflows in there and I can't tell what's what.
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/activepieces/issue/GIT-1939">GIT-1939</a></p>
  > ### ⚠️COMMENT VISIBILITY WARNING⚠️ Comments on closed issues are hard for our team to see. If this issue is continuing with the latest stable version of Activepieces, please open a new issue that references this one.

- **Issue #14390** (2026-07-27): **[BUG]: piece schedule trigger every-x-minutes publish fail**
  *Symptoms*: **Describe the bug** When adding trigger Scheduler > Every x minute (0.1.18), flow publishing fall in error  ```json {   "standardError": "TypeError: Cannot read properties of undefined (reading 'trim')\n    at split (/usr/src/app/cache/v11/common/main.js:61:3574)\n    at exports2.isValidCron (/usr/src/app/cache/v11/common/main.js:61:3782)\n    at Object.setSchedule (/usr/src/app/cache/v11/common/main.js:240:239304)\n    at Se.onEnable (/usr/src/app/cache/v11/common/node_modules/.bun/@activepieces+piece-schedule@0.1.18/node_modules/@activepieces/piece-schedule/src/index.js:1:92482)\n    at Object.executeTrigger (/usr/src/app/cache/v11/common/main.js:240:240315)\n    at async tryCatch (/usr/src/app/cache/v11/common/main.js:240:69907)\n    at async Object.tryCatchAndThrowOnEngineError (/usr/src/app/cache/v11/common/main.js:240:134620)\n    at async Object.execute (/usr/src/app/cache/v11/common/main.js:317:22386)\n    at async tryCatch (/usr/src/app/cache/v11/common/main.js:240:69907)\n    at async execute2 (/usr/src/app/cache/v11/common/main.js:317:22723)",   "standardOutput": "" } ```  **To Reproduce** Steps to reproduce the behavior: 1. Create a new flow 2. Add trigger Scheduler > Every x minutes 3. Define settings 4. Publish directly 5. Error : Panel open with the error message below  **Screenshots**  <img width="791" height="880" alt="Image" src="https://github.com/user-attachments/assets/d0d5d24f-3a75-4167-8da5-168350634625" />  **Additional context** Add any other context
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/activepieces/issue/GIT-1659">GIT-1659</a></p>
  > This looks already fixed on `main` — posting the trail so it can be closed or reopened with confidence rather than sitting.  The crash is `isValidCron(undefined)`, and on `0.1.18` the trigger passed a cron string while the engine had moved to accepting an interval. **PR #14393 ("fix: git 1630 schedule double fire", merged 2026-07-24, the day after this report)** changed exactly that call:  ```diff    onEnable: async (ctx) => { -    const cronExpression = `*/${ctx.propsValue.minutes} * * * *`;      ctx.setSchedule({ -      cronExpression: cronExpression, -      timezone: 'UTC', +      intervalMs: ctx.propsValue.minutes * 60_000,      }); ```  and `trigger-helper.ts` now takes the interval branch before any cron validation runs:  ```ts setSchedule(request: SetScheduleRequest) {     if ('intervalMs' in request) {          // <- taken now; returns early         ...         return     }     if (!isValidCron(request.cronExpression)) {   // <- where 0.1.18 blew up ```  So the `.trim()` on `un
  > ok, ok, it has been merged 3 days ago, that reassures me because I hadn't seen any mention of it in the issues  Good to know that Jiho, thanks for the feedback, we'll waiting the piece to be updated automatically (on self-hosted instance, it didn't require to upgrade the main instance of Activepieces, pieces will are updated OTH)  We can close this issue for the moment so :)

- **Issue #14308** (2026-07-23): **fix: some telemetry events for billing were not being fired for cloud because it had thousands of platforms**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge — the change is additive (new batch/flush loop), errors are handled gracefully, and three new unit tests cover the critical paths.  The logic change is narrow and well-tested: the new outer chunk loop never skips events, the queue size is 2× the batch size so no overflow can occur within a batch, flush failures are swallowed with a warning rather than crashing the job, and the feature doc was updated in the same PR.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/api/src/app/helper/telemetry.utils.ts | Adds `BILLING_EVENTS_FLUSH_BATCH_SIZE`, `BILLING_EVENTS_MAX_QUEUE_SIZE`, and `flushBillingEvents()` to the PostHog wrapper; sets `maxQueueSize` on the shared instance so the queue can hold 2× a single batch without dropping events. | | packages/server/api/src/app/ee/flow-run-tracking/flow-run-tracking-service.ts | Replaces the flat `for…of` loop with 

- **Issue #14111** (2026-07-08): **fix(event-destinations): fire event streaming to internal handler flows on self-hosted instances behind private IPs**
  *Symptoms*: ## Problem  On self-hosted deployments, the event-destination worker POSTs every event to the destination's webhook URL through the SSRF filter (`safeHttp.axios`), which rejects private/loopback/internal IPs. When the destination is a handler flow on the **same instance** (the auto-generated default), the instance's own hostname resolves to a private IP and the POST is blocked. The worker swallowed the failure as `warn` + `OK`, so the handler flow never ran and nothing indicated why.  Confirmed on real traffic on a live self-hosted EE deployment (instance behind an internal load balancer). Ref: Pylon #5036.  ## Fix  - `eventDestinationService.trigger`/`test` now classify each destination URL against the instance's public API origin (exact parsed-origin equality + `/v1/webhooks/` path prefix, reusing the cycle-guard helper). Same-origin handler-flow destinations are dispatched **internally** through `webhookService.handleWebhook` (async `EXECUTE_WEBHOOK` path) instead of an outbound HTTP call back to ourselves; external URLs keep going through the SSRF-protected worker job unchanged. - Internal dispatch is limited to rewrite-safe webhook routes (`''` and `/sync`). `/draft` and `/test` have different version/sample-data semantics and stay on the outbound path. - The destination URL's query params are forwarded on internal dispatch instead of being silently dropped (shared-secret pattern). - The worker now logs delivery failures (transport errors and 4xx/5xx responses) at `error
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge. The SSRF bypass is tightly scoped to exact origin equality plus the /v1/webhooks/ path prefix, and the internal dispatch path never makes an outbound HTTP call, so no request can escape the SSRF filter.  The classification logic is simple and clearly tested: origin equality check plus a prefix match. The cycle guard correctly carries forward to all same-origin URLs. Error handling is explicit at every branch, and the tests cover internal dispatch, external passthrough, query-param forwarding, the attacker-origin bypass, and the cycle guard across multiple route suffix variants.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/api/src/app/event-destinations/event-destinations.service.ts | Core fix: classifies destinations as internal/external, dispatches same-origin handler-flow URLs through webhookService.handleWebhook instead of an outbound HTTP ca
  > @greptile review
  > <!-- mintlify-preview-comment-activepieces-feature-git-1539 --> Preview deployment for your docs. Learn more about [Mintlify Previews](https://www.mintlify.com/docs/deploy/preview-deployments).  | Project | Status | Preview | Updated (UTC) | |---------|--------|---------|---------------| | [activepieces](https://app.mintlify.com/activepieces/activepieces?section=previews) | 🟢 Ready | [View Preview](https://activepieces-feature-git-1539.mintlify.app) | Jul 8, 2026, 3:00 PM |  💡 **Tip:** Enable [Workflows](https://www.mintlify.com/docs/agent/workflows) to automatically generate PRs for you.

- **Issue #14104** (2026-07-08): **fix(engine): dynamic property slugs with reserved characters break required-field validation**
  *Symptoms*: ## Problem  Fixes GIT-1515 (and GIT-1336, same root cause).  When `Property.DynamicProperties` returns child properties whose slug contains `.` (e.g. `employee.firstName`) — or `[`, `]`, `"`, `'` — the builder shows the field as required-and-empty even after the user types a value, and the step can never be saved.  ## Root cause (verified)  react-hook-form's path parser (`stringToPath`) splits field names on every `.` and `[` and strips `]` and quotes, with no escaping mechanism. So for a dotted child key:  - the zod form schema (`buildSchema`) validates the **flat literal key** `"employee.firstName"`, seeded with `''` - but the `FormField` name `settings.input.<dynProp>.employee.firstName` makes RHF write the typed value into a **nested** object  Validation always sees the empty seed → permanent required error. The dynamic-value toggle (`settings.propertySettings.<childName>`) corrupts `propertySettings` the same way.  ## Fix  Everything funnels through two engine choke points, so the fix lives there and the web layer needs no changes:  1. **`piece-helper.ts` → `executeProps`** — the single place dynamic props are resolved (builder UI, MCP tools, agent tools). Child keys are escaped JSON-Pointer style (`~0`–`~5` for `~ . [ ] " '`), fully reversible for any input. Downstream (RHF paths, zod schema, propertySettings writes) the keys contain no reserved characters, so the form just works. 2. **`props-processor.ts`** — the single place resolved input becomes `propsValue` for act
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 4/5</h3>  This is close, but the remaining key-mutation case should be fixed before merging.  - Escaped builder-created keys are restored before pieces consume them. - Literal schema-less dynamic keys that begin with `~ap~` can still be rewritten. - That can make callers and pieces disagree about the actual child slug.  packages/server/engine/src/lib/helper/dynamic-prop-keys.ts  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/engine/src/lib/helper/dynamic-prop-keys.ts | Adds dynamic property key escaping and unescaping, but marker-prefixed literal keys can still be decoded unintentionally. | | packages/server/engine/src/lib/helper/piece-helper.ts | Escapes dynamic property options at the `executeProps` boundary before returning them to callers. | | packages/server/engine/src/lib/variables/props-processor.ts | Restores escaped dynamic input and schema keys before nested processing, while still calling the marke

- **Issue #14103** (2026-07-09): **fix(event-streaming): accept null stepNameToTest so real flow-run events pass schema**
  *Symptoms*: ## Problem  On self-hosted EE, Event Streaming never triggers the handler flow for **real** flow runs. When a real (production) flow finishes, the `flow.run.finished` event is enqueued as an `EVENT_DESTINATION` job, but the job is **dropped at dequeue** (`Failing job with invalid schema as unrecoverable`) *before* the worker runs it — so the handler flow never executes. Silent: no error/toast, dispatch reports success.  The **Test destination** button works because it sends a *mock* event that omits the offending field (`undefined`, not `null`), so it never exercises the bug.  ## Root cause  `FlowRunEventData.flowRun.stepNameToTest` was declared `z.string().optional()`, which accepts `string | undefined` but **rejects `null`**. Every real `FlowRun` carries `stepNameToTest: null` (it's null for all non-test/production runs), so the payload fails `FlowRunEvent` validation, `JobData.safeParse` fails in the job broker, and the job is moved to failed at dequeue. Sibling fields `startTime` / `finishTime` correctly use `.nullish()`; `stepNameToTest` was missed.  ## Fix  One line — make the field null-safe like its siblings, plus the required `@activepieces/shared` patch bump.  Fixes GIT-1543 (ref Pylon #5036, #13632)  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  This looks safe to merge.  - No blocking issues found in the changed code.    <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/core/shared/src/lib/ee/audit-events/index.ts | Allows production flow-run events to validate when `stepNameToTest` is `null`. | | packages/server/api/test/integration/cloud/event-destinations/event-destination-trigger.test.ts | Updates event-destination test payloads to match the production flow-run event shape. | | packages/core/shared/package.json | Bumps the shared package patch version. |   <!-- greptile_other_comments_section -->  <sub>Reviews (5): Last reviewed commit: ["Merge branch &#39;main&#39; into fix/git-1543"](https://github.com/activepieces/activepieces/commit/d0188c058a02b5c1e2be549a7af8c410058e9574) | [Re-trigger Greptile](https://app.greptile.com/api/retrigger?id=42563964)</sub>

- **Issue #14100** (2026-07-09): **fix(web): taking over a locked flow or table no longer breaks embedded views**
  *Symptoms*: ## Problem  Clicking **Take Over** on the resource-lock banner called `window.location.reload()` after the force-lock succeeded. A full document reload does not survive **embed mode**: the iframe re-mounts standalone without the embed SDK handshake (the SDK removes its init listener after the first handshake), so it hangs on a blank spinner with no error. Reported via Pylon #5019 and GitHub #13554 (GIT-1529). Present since `0.82.0`.  The reload lived on the take-over path in three places named in the issue: `use-resource-lock.ts` (the shared hook, powering both the builder and tables), the builder banner, and the tables header (plus the tables import dialog).  ## Fix  Refresh the resource **in place** instead of reloading the document — the same end state the reload produced, minus the reload:  - **`use-resource-lock.ts`** — `takeOver` no longer reloads. On a successful force-acquire it clears `lockedBy`, bumps a `lockSession` so the acquire effect re-runs (re-emitting a non-force `LOCK_RESOURCE` over the same socket), and calls an `onTakeOver` callback. The re-acquire is important: the server's `force` acquire does **not** set `socket.data.lockedResourceId`, so this follow-up non-force acquire is what re-registers ownership for disconnect-release — exactly what a fresh page mount used to do. `isOwner` is reset before the session bump so the effect cleanup can't emit a spurious `UNLOCK` that would release the just-taken lock. - **Builder (`use-flow-lock.ts`)** — `onTakeOver` 
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge — all three reload sites are replaced with embed-compatible in-place refresh, the lock lifecycle invariants are preserved, and the critical paths are mutation-verified by new unit tests.  The change is frontend-only, well-scoped, and every critical line is guarded by a new test that fails if the old reload() behaviour is reintroduced. The isOwner reset before the session bump correctly prevents a spurious UNLOCK from briefly releasing the force-acquired lock. The TableLockProvider hoisting above the remount boundary is both logically sound and directly tested. No server, API, or DB changes are involved.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/web/src/hooks/use-resource-lock.ts | Core fix: replaces window.location.reload() with a lockSession bump that re-runs the acquire effect; isOwner is reset before the session bump to prevent a spurious UNLOCK d
  > @greptile review

- **Issue #14093** (2026-07-07): **fix(tables): neq filter returns rows with empty/unset cells**
  *Symptoms*: ## Problem  The Tables `neq` filter silently drops rows where the target column is empty or was never filled. Reported case: filtering `converted neq "true"` returned an empty result even though rows existed where `converted` was empty — and empty ≠ `"true"`, so those rows should match.  ## Root cause  Record filtering runs in-memory in `record.service.ts`. A record with **no cell** for the filtered field was special-cased to match only `NOT_EXISTS`:  ```ts const cell = record.cells.find(c => c.fieldId === filter.fieldId) if (!cell) {     return filter.operator === FilterOperator.NOT_EXISTS } ```  So for a never-filled column, `neq` (and `eq`, `co`, …) always returned `false` and the row was excluded — regardless of the actual comparison.  ## Fix  Treat a missing cell as an empty value (`''`, the same sentinel `update` writes via `value: cellData.value ?? ''`) and route it through the normal operator logic. All operators now handle empty/unset columns consistently — `neq "true"` returns the empty rows, while `exists` / `not_exists` still behave correctly since `''` is the empty sentinel.  ## Tests  Added two integration cases to `record.test.ts`: - `NEQ: should match record without a cell for the field` - `NEQ: should match record with empty string cell`  Both pass on CE (`AP_EDITION=ce`); logic is edition-agnostic.
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge — the change is a minimal, well-reasoned fix to in-memory filter logic with no database or API contract changes.  The two-line core change is logically sound: every filter operator in doesCellValueMatchFilters already handles an empty string correctly (EXISTS → false, NOT_EXISTS → true, NEQ → true when filter value is non-empty, numeric operators → false via NaN). The function signature tightening to Pick<Cell, 'fieldId' | 'value'> is backward-compatible. Feature docs and integration tests are included in the same PR.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/api/src/app/tables/record/record.service.ts | Correctly treats missing cells as empty-string sentinels instead of short-circuiting to false, fixing NEQ/EQ/CO/numeric filters for unset columns; EXISTS and NOT_EXISTS still behave correctly since '' triggers the right branches | | packages/s

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

### Incident Patch 1: `e44f97ef` (2026-09-30)
**Commit Message**: fix(xml): keep leading zeros in Convert XML to JSON (#15856)

**File**: `bun.lock` (modified, +1/-1)
```diff
@@ -10731,7 +10731,7 @@
     },
     "packages/pieces/core/xml": {
       "name": "@activepieces/piece-xml",
-      "version": "0.2.0",
+      "version": "0.2.1",
       "dependencies": {
         "@activepieces/core-piece-types": "workspace:*",
         "@activepieces/core-utils": "workspace:*",
```

**File**: `packages/pieces/core/xml/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@activepieces/piece-xml",
-  "version": "0.2.0",
+  "version": "0.2.1",
   "main": "./dist/src/index.js",
   "types": "./dist/src/index.d.ts",
   "dependencies": {
```

**File**: `packages/pieces/core/xml/src/i18n/translation.json` (modified, +3/-1)
```diff
@@ -29,5 +29,7 @@
   "Write empty values as <tag/> instead of <tag></tag>.": "Write empty values as <tag/> instead of <tag></tag>.",
   "Keys starting with this prefix become attributes. Defaults to \"@_\", the prefix Convert XML to JSON uses.": "Keys starting with this prefix become attributes. Defaults to \"@_\", the prefix Convert XML to JSON uses.",
   "Key that holds the text of an element that also has attributes. Defaults to \"#text\".": "Key that holds the text of an element that also has attributes. Defaults to \"#text\".",
-  "Key whose value is written as a CDATA section, so it is not escaped. Defaults to \"#cdata\".": "Key whose value is written as a CDATA section, so it is not escaped. Defaults to \"#cdata\"."
+  "Key whose value is written as a CDATA section, so it is not escaped. Defaults to \"#cdata\".": "Key whose value is written as a CDATA section, so it is not escaped. Defaults to \"#cdata\".",
+  "Keep Leading Zeros": "Keep Leading Zeros",
+  "Keep numbers that start with a zero as text so values like ZIP codes, IDs and account numbers are not changed (e.g. \"02134\" stays \"02134\" instead of becoming 2134). Other numbers are still converted to numbers.": "Keep numbers that start with a zero as text so values like ZIP codes, IDs and account numbers are not changed (e.g. \"02134\" stays \"02134\" instead of becoming 2134). Other numbers are still converted to numbers."
 }
\ No newline at end of file
```

**File**: `packages/pieces/core/xml/src/lib/actions/convert-xml-to-json.ts` (modified, +13/-3)
```diff
@@ -8,7 +8,7 @@ export const convertXmlToJson = createAction({
   displayName: 'Convert XML to JSON',
   description: 'Convert XML to JSON',
   aiMetadata: {
-    description: 'Parses an XML string into a JSON structure, in either of two modes: keep tag attributes (surfaced as "@_"-prefixed keys) or ignore attributes and keep element text only. Use it to make an XML payload from an HTTP response, webhook body, or RSS/SOAP feed addressable by later steps; for the opposite direction use Create XML, which accepts this output as-is. Requires a well-formed XML string passed as text, and the XML declaration is always dropped; read-only and idempotent.',
+    description: 'Parses an XML string into a JSON structure, in either of two modes: keep tag attributes (surfaced as "@_"-prefixed keys) or ignore attributes and keep element text only. Numeric-looking text is converted to numbers unless Keep Leading Zeros is on, in which case zero-prefixed values such as ZIP codes and IDs stay strings. Use it to make an XML payload from an HTTP response, webhook body, or RSS/SOAP feed addressable by later steps; for the opposite direction use Create XML, which accepts this output as-is. Requires a well-formed XML string passed as text, and the XML declaration is always dropped; read-only and idempotent.',
     idempotent: true,
   },
   props: {
@@ -23,10 +23,20 @@ export const convertXmlToJson = createAction({
       required: false,
       defaultValue: false,
     }),
+    keepLeadingZeros: Property.Checkbox({
+      displayName: 'Keep Leading Zeros',
+      description: 'Keep numbers that start with a zero as text so values like ZIP codes, IDs and account numbers are not changed (e.g. "02134" stays "02134" instead of becoming 2134). Other numbers are still converted to numbers.',
+      required: false,
+      defaultValue: true,
+    }),
   },
   async run(context) {
-    const { xml, ignoreAttributes } = context.propsValue;
-    const parser = new XMLParser({ ignoreAttributes: ignoreAttributes ?? false, ignoreDeclaration: true });
+    const { xml, ignoreAttributes, keepLeadingZeros } = context.propsValue;
+    const parser = new XMLParser({
+      ignoreAttributes: ignoreAttributes ?? false,
+      ignoreDeclaration: true,
+      ...((keepLeadingZeros ?? false) ? { numberParseOptions: { hex: true, leadingZeros: false, eNotation: true } } : {}),
+    });
     return parser.parse(xml);
   },
 });
```

**File**: `packages/pieces/core/xml/test/convert-xml-to-json.test.ts` (modified, +68/-0)
```diff
@@ -64,3 +64,71 @@ describe('convertXmlToJson', () => {
     expect(root['item']).toEqual([1, 2, 3]);
   });
 });
+
+describe('convertXmlToJson keepLeadingZeros', () => {
+  test('keeps leading zeros as strings when enabled', async () => {
+    const ctx = createMockActionContext({
+      propsValue: {
+        xml: '<root><zip>02134</zip><id>00123</id><count>42</count></root>',
+        ignoreAttributes: false,
+        keepLeadingZeros: true,
+      },
+    });
+    const result = await convertXmlToJson.run(ctx);
+    expect(result).toEqual({ root: { zip: '02134', id: '00123', count: 42 } });
+  });
+
+  test('keeps leading zeros in nested elements and arrays when enabled', async () => {
+    const ctx = createMockActionContext({
+      propsValue: {
+        xml: '<customers><customer><account>000987</account><address><zip>02134</zip></address></customer><customer><account>12345</account><address><zip>00501</zip></address></customer></customers>',
+        ignoreAttributes: false,
+        keepLeadingZeros: true,
+      },
+    });
+    const result = await convertXmlToJson.run(ctx);
+    expect(result).toEqual({
+      customers: {
+        customer: [
+          { account: '000987', address: { zip: '02134' } },
+          { account: 12345, address: { zip: '00501' } },
+        ],
+      },
+    });
+  });
+
+  test('keeps parsing zero, decimals and exponents as numbers when enabled', async () => {
+    const ctx = createMockActionContext({
+      propsValue: {
+        xml: '<root><a>0</a><b>0.5</b><c>1e5</c><d>007.5</d></root>',
+        ignoreAttributes: false,
+        keepLeadingZeros: true,
+      },
+    });
+    const result = await convertXmlToJson.run(ctx);
+    expect(result).toEqual({ root: { a: 0, b: 0.5, c: 100000, d: '007.5' } });
+  });
+
+  test('strips leading zeros when disabled', async () => {
+    const ctx = createMockActionContext({
+      propsValue: {
+        xml: '<root><zip>02134</zip><id>00123</id><count>42</count></root>',
+        ignoreAttributes: false,
+        keepLeadingZeros: false,
+      },
+    });
+    const result = await convertXmlToJson.run(ctx);
+    expect(result).toEqual({ root: { zip: 2134, id: 123, count: 42 } });
+  });
+
+  test('keeps the previous numeric output for existing steps without the option', async () => {
+    const ctx = createMockActionContext({
+      propsValue: {
+        xml: '<root><zip>02134</zip><item>007</item><item>8</item></root>',
+        ignoreAttributes: false,
+      },
+    });
+    const result = await convertXmlToJson.run(ctx);
+    expect(result).toEqual({ root: { zip: 2134, item: [7, 8] } });
+  });
+});
```

---

### Incident Patch 2: `7e7e3809` (2026-09-30)
**Commit Message**: fix(chat): changing a saved agent after the chat read your data now asks for your approval (#15927)

**File**: `brain/knowledge/flows-execution/chat.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ A turn is kept alive / reclaimed by three separate mechanisms in `execute-agent-
 - **A failed turn used to leave status ERROR with an empty reply.** The error text only travelled as a websocket `ERROR` event, so a reload, another tab, or a user who was away saw a dead conversation (and often no user message either when the job died inside `getAgentConfig`, before it persists the turn). The `execute-agent-run.ts` catch now sends `failure: { message, userMessage? }` on the empty `saveAgentMessages` call and `conversation-rpc.ts` appends it to `uiMessages` as an assistant text reply; `use-chat.ts` shows the Retry banner when a loaded conversation is ERROR. Stale STREAMING to IDLE recovery, a worker that never picks the job up, and `assertAgentMessageRateLimitNotExceeded` still leave no reply of their own.
 - **A built flow ends with a "Turn it on?" card, never an auto-publish**: an audit found 40% of built-but-unpublished flows ended on "open it to review", some claiming LIVE. Chat never publishes on its own; only a yes to the card calls `ap_lock_and_publish` (`build_flow.md` "Turn it on?"). Pinned by the `build-then-ask-turn-it-on` fixture (`askedToTurnItOn`, `noLiveClaimWithoutPublish`). The live-claim check is a regex plus "was `ap_lock_and_publish` called", so it cannot see whether publish succeeded.
 - **Server-managed connections**: the LLM never sees connection externalIds; `ap_execute_action` auto-fills them from a Redis store.
-- **Prompt-injection taint**: a per-turn `taintState` flips to `tainted` once the turn reads outside or user data (MCP tools, web/search/scrape, `ap_explore_data`, `ap_execute_action`, `ap_run_code`, `ap_list_across_projects`, configured tools). It forces the action-preview gate on non-read-only actions, blocks saved-agent edits, and makes `ap_remember` ask before saving (memory reaches every future conversation). It carries one message: each saved reply stores `tainted` (this reply's own reads, via `createTaintState`), and the next message starts from it. Deletes are confirmed always, not by taint.
+- **Prompt-injection taint**: a per-turn `taintState` flips to `tainted` once the turn reads outside or user data (MCP tools, web/search/scrape, `ap_explore_data`, `ap_execute_action`, `ap_run_code`, `ap_list_across_projects`, configured tools). It forces the action-preview gate on non-read-only actions, makes saved-agent edits (`ap_update_agent`, `ap_add_agent_tool`, `ap_remove_agent_tool`, `ap_create_agent`) ask for approval on the action card instead of refusing, and makes `ap_remember` ask before saving (memory reaches every future conversation). It carries one message: each saved reply stores `tainted` (this reply's own reads, via `createTaintState`), and the next message starts from it. Deletes are confirmed always, not by taint.
 - **Write-check gate**: before a live `ap_test_flow`, `__flow_write_check` RPC flags write/destructive PIECE steps; read-only flows run ungated; gate fails open on RPC error.
 - **Cloud rollout cap**: opens to non-embed users without `chatEnabled` until 200 distinct users have sent a message (`CLOUD_CHAT_ROLLOUT_CAP`); grandfathered after close. Embedded sessions never see chat.
 - **Flow correctness is 100% prompt/guide-driven — nothing in code enforces it.** The "#1 silent bug" ("Class A"): the agent frames a *recurring* automation as a *one-time task* and omits any anti-reprocessing step, so run N+1 redoes run N's work (re-pays, re-sends). It's a design-time reasoning gap, not a testing gap — `ap_test_flow` runs ONCE, so a single test looks perfect; the bug only shows on the 2nd run. Fix lives in the prompt (`chat-system-prompt.md` `<decision_framework>` + `build_flow.md` "Recurring flows must not reprocess") + capability eval fixtures with a `recurring_avoids_reprocessing` judge dimension. The platform already has every primitive (Tables New-Record webhook, polling `DedupeStrategy`, `_dedupe_key`, Store, update/delete-record); the agent just wasn
```

**File**: `packages/server/api/src/app/ee/agent/agent-approval-gate.ts` (modified, +12/-3)
```diff
@@ -6,7 +6,7 @@ const GATE_TTL_SECONDS = 15 * 60
 const CANCEL_TTL_SECONDS = 2 * 60 * 60
 
 const CONNECTION_STORE_TTL_SECONDS = 24 * 60 * 60
-const KEY_PREFIX = 'tool-approval-decision:'
+const KEY_PREFIX = 'tool-approval-decision:v2:'
 const CHANNEL_PREFIX = 'tool-approval:'
 const CANCEL_KEY_PREFIX = 'chat-cancel:'
 const AVAILABLE_CONNECTIONS_PREFIX = 'chat-conn-avail:'
@@ -27,7 +27,8 @@ async function resolveGate({ gateId, approved, payload, log }: { gateId: string,
     const conversationId = await distributedStore.get<string>(`${PENDING_GATE_PREFIX}gate:${gateId}`)
     const pendingGate = conversationId ? (await readPendingGates({ conversationId }))[gateId] : undefined
     const approvedInput = pendingGate?.toolInput
-    const wasSet = await distributedStore.putIfAbsent(decisionKey(gateId), { approved, payload, approvedInput }, GATE_TTL_SECONDS)
+    const decision: GateDecision = { approved, payload, approvedInput, approvedToolName: pendingGate?.toolName, approvedConversationId: conversationId ?? undefined, approvedRunId: pendingGate?.runId }
+    const wasSet = await distributedStore.putIfAbsent(decisionKey(gateId), decision, GATE_TTL_SECONDS)
     if (wasSet) {
         await pubsub.publish(channelName(gateId), JSON.stringify({ approved, payload }))
         if (conversationId) {
@@ -44,7 +45,11 @@ async function resolveGate({ gateId, approved, payload, log }: { gateId: string,
 async function checkDecision({ gateId }: { gateId: string }): Promise<GateDecision | 'pending'> {
     const raw = await distributedStore.get<GateDecision>(decisionKey(gateId))
     if (!raw) return 'pending'
-    return { approved: raw.approved === true, payload: raw.payload, approvedInput: raw.approvedInput }
+    return { approved: raw.approved === true, payload: raw.payload, approvedInput: raw.approvedInput, approvedToolName: raw.approvedToolName, approvedConversationId: raw.approvedConversationId, approvedRunId: raw.approvedRunId }
+}
+
+async function consumeApproval({ gateId }: { gateId: string }): Promise<boolean> {
+    return distributedStore.putIfAbsent(`${decisionKey(gateId)}:consumed`, true, GATE_TTL_SECONDS)
 }
 
 async function waitForDecision({ gateId, timeoutMs }: { gateId: string, timeoutMs: number }): Promise<GateDecision | 'pending'> {
@@ -162,6 +167,7 @@ async function clearPendingGate({ conversationId }: { conversationId: string }):
 export const agentApprovalGate = {
     resolveGate,
     checkDecision,
+    consumeApproval,
     waitForDecision,
     requestCancel,
     isCancelled,
@@ -180,6 +186,9 @@ type GateDecision = {
     approved: boolean
     payload?: Record<string, unknown>
     approvedInput?: Record<string, unknown>
+    approvedToolName?: string
+    approvedConversationId?: string
+    approvedRunId?: string
 }
 
 type StoredConnection = {
```

**File**: `packages/server/api/src/app/ee/agent/rpc/tool-execution-rpc.ts` (modified, +23/-1)
```diff
@@ -1,3 +1,4 @@
+import { isDeepStrictEqual } from 'node:util'
 import { ActivepiecesAiConsumerSource, ActivepiecesError, ErrorCode, isNil, spreadIfDefined, tryCatch } from '@activepieces/core-utils'
 import { aiUtils } from '@activepieces/server-utils'
 import { AGENT_SELF_EDIT_TOOLS, AGENT_SURFACE_TOOLS, AgentActionOutcome, AgentRunSource, agentToolClassification, ExecuteAgentToolRequest, ExecuteAgentToolResponse, ExecuteFlowToolRequest, ExecuteFlowToolResponse, ExecuteKnowledgeBaseToolRequest, ExecuteKnowledgeBaseToolResponse, ExecutePieceToolRequest, ExecutePieceToolResponse, FlowActionType, flowStructureUtil } from '@activepieces/shared'
@@ -154,7 +155,8 @@ export const toolExecutionRpc = (log: FastifyBaseLogger) => ({
         }
         if (AGENT_SELF_EDIT_TOOLS.includes(input.toolName) || input.toolName === 'ap_create_agent') {
             const readAlready = await turnHasRead({ conversationId: input.conversationId ?? '', ...spreadIfDefined('runId', input.runId) })
-            if (readAlready) {
+            const approvedByUser = readAlready && await approvedByHuman({ toolName: input.toolName, toolInput: input.toolInput, conversationId: input.conversationId, runId: input.runId })
+            if (readAlready && !approvedByUser) {
                 log.warn({ tool: { name: input.toolName }, source: input.source, conversation: { id: input.conversationId } }, '[agentRpc#executeAgentTool] Refused a saved-agent change for a turn that already read something')
                 throw new ActivepiecesError({
                     code: ErrorCode.AUTHORIZATION,
@@ -281,6 +283,26 @@ export const toolExecutionRpc = (log: FastifyBaseLogger) => ({
 const MAX_APPROVAL_BLOCK_MS = 50_000
 const CHAT_ONLY_TOOL_PREFIX = '__'
 const OWNER_SCOPED_TOOLS = ['ap_remember']
+async function approvedByHuman({ toolName, toolInput, conversationId, runId }: { toolName: string, toolInput: Record<string, unknown>, conversationId?: string, runId?: string }): Promise<boolean> {
+    const { [APPROVED_GATE_KEY]: gateId, ...requested } = toolInput
+    if (typeof gateId !== 'string') {
+        return false
+    }
+    const decision = await agentApprovalGate.checkDecision({ gateId })
+    const approvedThisCall = decision !== 'pending'
+        && decision.approved
+        && decision.approvedToolName === toolName
+        && decision.approvedConversationId === conversationId
+        && decision.approvedRunId === runId
+        && !isNil(decision.approvedInput)
+        && isDeepStrictEqual(decision.approvedInput, requested)
+    if (!approvedThisCall) {
+        return false
+    }
+    return agentApprovalGate.consumeApproval({ gateId })
+}
+
+const APPROVED_GATE_KEY = 'approvedGateId'
 const ATTENDED_STATE_TOOLS = ['__cancel_check', '__approval_wait', '__store_pending_gate', '__store_selected_connection', '__get_selected_connection']
 const SOURCE_EXTRA_TOOLS: Partial<Record<AgentRunSource, readonly string[]>> = {
     [AgentRunSource.AGENT_BUILDER]: AGENT_SURFACE_TOOLS,
```

**File**: `packages/server/api/test/integration/ee/agent/agent-self-edit.test.ts` (modified, +72/-0)
```diff
@@ -2,6 +2,7 @@ import { AgentIcon, AgentRunSource, AIProviderName, apId, ApplicationEvent, Appl
 import { FastifyInstance } from 'fastify'
 import { afterAll, beforeAll, describe, expect, it } from 'vitest'
 import { agentRpcHandlers } from '../../../../src/app/ee/agent/agent-rpc-handlers'
+import { agentApprovalGate } from '../../../../src/app/ee/agent/agent-approval-gate'
 import { markTurnAsHavingRead } from '../../../../src/app/ee/agent/rpc/rpc-shared'
 import { db } from '../../../helpers/db'
 import { mockAndSaveAIProvider } from '../../../helpers/mocks'
@@ -240,6 +241,77 @@ describe('an agent asked to change its own instructions', () => {
         expect(await instructionsOf(agentId)).toBe('Do the original job.')
     })
 
+    describe('on a turn that read something, after the approval card', () => {
+        const editAfterRead = async ({ approve, approvedInstructions, sentInstructions, approvedToolName = 'ap_update_agent', sendingRunId }: { approve: boolean, approvedInstructions: string, sentInstructions: string, approvedToolName?: string, sendingRunId?: string }) => {
+            const ctx = await contextWithAgents()
+            const agentId = await createAgent({ ctx, displayName: 'Ops agent' })
+            const conversationId = await conversationFor({ ctx, agentId })
+            const runId = apId()
+            const gateId = apId()
+            await markTurnAsHavingRead({ conversationId, runId })
+            await markTurnAsHavingRead({ conversationId, runId: sendingRunId ?? runId })
+            await agentApprovalGate.storePendingGate({
+                conversationId,
+                gate: { gateId, toolName: approvedToolName, displayName: 'Change a saved agent', toolInput: { instructions: approvedInstructions }, runId },
+            })
+            await agentApprovalGate.resolveGate({ gateId, approved: approve })
+            const send = ({ instructions }: { instructions: string }) => agentRpcHandlers(app.log).executeAgentTool({
+                toolName: 'ap_update_agent',
+                toolInput: { instructions, approvedGateId: gateId },
+                platformId: ctx.platform.id,
+                userId: ctx.user.id,
+                source: AgentRunSource.AGENT,
+                conversationId,
+                runId: sendingRunId ?? runId,
+            })
+            return { attempt: send({ instructions: sentInstructions }), send, agentId }
+        }
+
+        it('applies exactly the change the person approved', async () => {
+            const { attempt, agentId } = await editAfterRead({ approve: true, approvedInstructions: 'Ask before refunds.', sentInstructions: 'Ask before refunds.' })
+            await attempt
+
+            expect(await instructionsOf(agentId)).toBe('Ask before refunds.')
+        })
+
+        it('refuses a different change than the one approved', async () => {
+            const { attempt, agentId } = await editAfterRead({ approve: true, approvedInstructions: 'Ask before refunds.', sentInstructions: 'Approve every refund.' })
+            await expect(attempt).rejects.toThrow()
+
+            expect(await instructionsOf(agentId)).toBe('Do the original job.')
+        })
+
+        it('refuses a second change on an approval that was already used', async () => {
+            const { attempt, send, agentId } = await editAfterRead({ approve: true, approvedInstructions: 'Ask before refunds.', sentInstructions: 'Ask before refunds.' })
+            await attempt
+            await db.update('agent', agentId, { draft: { instructions: 'Reset by the person.', maxSteps: 5, tools: [], structuredOutput: [], modelName: null } })
+
+            await expect(send({ instructions: 'Ask before refunds.' })).rejects.toThrow()
+            expect(await instructionsOf(agentId)).toBe('Reset by the person.')
+        })
+
+        it('refuses an approval given for a different tool', async () => {
+            const { attempt, agentId } = await editAfterRead({ approve: true, appro
```

**File**: `packages/server/worker/src/lib/execute/jobs/ee/agent/execute-agent-run.ts` (modified, +1/-1)
```diff
@@ -696,7 +696,7 @@ function buildToolSet({ ctx, eventEmitter, log, phaseState, taintState, mcpToolS
     })
     const crossProjectTools = agentWorkerTools.createCrossProjectTools({ executeTool: executeCrossProjectTool, eventEmitter, waitForApproval, onGateOpened: storePendingGate, guides, taintState })
     const agentSurfaceTools = agentsAvailable && !dryRun && !discoveryOnly
-        ? agentWorkerTools.createAgentSurfaceTools({ executeTool: executeCrossProjectTool, taintState })
+        ? agentWorkerTools.createAgentSurfaceTools({ executeTool: executeCrossProjectTool, taintState, eventEmitter, waitForApproval, onGateOpened: storePendingGate })
         : {}
     const thinkingTools = agentWorkerTools.createThinkingTools()
     const phaseTools = agentWorkerTools.createPhaseTools({ onPhaseChange: (phase) => {
```

---

### Incident Patch 3: `112cac0f` (2026-09-30)
**Commit Message**: fix(sandbox): code steps can import node: builtins again (#15980)

**File**: `packages/server/sandbox/src/lib/utils/esbuild-build-options.ts` (modified, +3/-0)
```diff
@@ -34,6 +34,9 @@ export function stepFolderResolvePlugin(rootDir: string): Plugin {
                 if (args.kind === 'entry-point' || isBareSpecifier(args.path)) {
                     return null
                 }
+                if (args.path.startsWith('node:')) {
+                    return { external: true }
+                }
                 if (/^[a-z][a-z0-9+.-]*:/i.test(args.path)) {
                     return { errors: [{ text: IMPORT_OUT_OF_SCOPE_MESSAGE }] }
                 }
```

**File**: `packages/server/sandbox/test/lib/utils/esbuild-build-options.test.ts` (modified, +16/-0)
```diff
@@ -90,6 +90,22 @@ describe('stepFolderResolvePlugin', () => {
         expect(result.bundle).not.toContain(SECRET)
     })
 
+    it('allows a node:-prefixed builtin import', async () => {
+        const result = await compile({
+            code: `import { createHash } from 'node:crypto'; export const code = async () => createHash('md5').update('x').digest('hex')`,
+        })
+        expect(result.built).toBe(true)
+        expect(result.bundle).toContain('node:crypto')
+    })
+
+    it('still blocks non-node scheme imports', async () => {
+        const result = await compile({
+            code: `import s from 'file://${secretDir}/secret.js'; export const code = async () => ({ s })`,
+        })
+        expect(result.built).toBe(false)
+        expect(result.error).toContain(IMPORT_OUT_OF_SCOPE_MESSAGE)
+    })
+
     it('allows a legitimate relative import inside the step folder', async () => {
         const result = await compile({
             code: `import s from './helper'; export const code = async () => ({ s })`,
```

---

### Incident Patch 4: `7e08a33a` (2026-09-30)
**Commit Message**: fix: Activepieces AI credits now only run the models offered in the picker (#15928)

**File**: `brain/knowledge/ai-intelligence/ai-providers.md` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ enqueued. `AP_MODEL_TIERS_URL` overrides the URL. The file is published from the
 decision 000041. The console publishes both lists and both fast pointers on every Publish, and on its first load
 after a file without chat keys it seeds the chat list from the live flow list.
 ### Gotchas
+- **The managed key only runs models the tiers or the chat allow-list permit, enforced in `aiUtils.createModel`.** The managed provider is OpenRouter underneath, so before this guard a crafted step naming any OpenRouter model ran on our key; the picker hid it but nothing denied it. `assertManagedModelAllowed` (`server/utils/src/ai-utils.ts`) checks `managedChatModelIds()` plus both surfaces' published tier `modelId`s and throws a `VALIDATION` error. Image models are checked too, in `createModel` (`imageGeneration: true`) and `createModelForImages`: only `ACTIVEPIECES_IMAGE_TIERS` model ids, plus the id the chat path passes as `adminChosenImageModelId` (the server-chosen Capabilities model). The worker now calls `modelTierCatalog.warmUp()` at start so a cold worker does not judge a newly published tier against the bundled list.
 - **A catalog change takes up to ~2 days to reach a dropdown, through three caches in series.** CDN edge (`--cache-control max-age=3600`, 1h) → the server's in-memory catalog (`CATALOG_TTL_MS`, 24h) → `modelsCache` (flushed by the nightly `cron.schedule('0 0 * * *')`). So "I republished but the UI still shows the old price" is expected, not a bug; restarting the API short-circuits the two in-process layers. The edge TTL is deliberately 1h and not the 604800 that `publish-embed-sdk.yml` uses — that path is version-stamped, ours is a stable key rewritten in place, so a week-long edge cache would pin stale prices for a week.
 - **`Sync AI Model Catalog` is the only workflow that proves the CDN S3 credentials still work — a green `Publish Embed SDK` proves nothing.** Both read the same `CDN_S3_ACCESS_KEY_ID` / `CDN_S3_SECRET_ACCESS_KEY` / `CDN_S3_BUCKET` / `CDN_S3_ENDPOINT` secrets, but `publish-embed-sdk.yml` guards its upload job on `needs.check.outputs.publish == 'true'`, which is false whenever the version in `packages/ee/embed-sdk/package.json` is already on the CDN. Its daily cron then finishes in about nine seconds with the upload skipped and the run still marked success, so the key can rot for weeks behind a green tick — that is how the model-catalog cron came to fail with `InvalidAccessKeyId` on three consecutive Mondays while the embed SDK looked healthy. To date a dead key, find the last embed-SDK run whose `publish` job actually ran (`gh run list --workflow=publish-embed-sdk.yml`, look for a duration in minutes rather than seconds) and compare it against the first model-catalog failure. To test a rotated key, dispatch `sync-model-catalog.yml` — it uploads unconditionally.
 - **Publishing is an overwrite of one S3 key, and it only ever happens on the Monday cron or a manual `workflow_dispatch`.** Never on merge, deploy or release. There is no versioning and no history: last write wins and the previous contents are gone, which is why the object carries `generatedAt` — `curl -s https://cdn.activepieces.com/ai/model-catalog.json | jq .generatedAt` is the only way to tell how fresh what you are serving is. Editing the generator changes nothing in production until someone dispatches the workflow.
```

**File**: `packages/server/utils/src/ai-utils.ts` (modified, +33/-4)
```diff
@@ -1,6 +1,6 @@
-import { ActivepiecesAiBilling, aiChargeFor, AIProviderName, isNil, observedProviderFetch, ProviderOutcomeReporter, spreadIfDefined } from '@activepieces/core-utils';
+import { ActivepiecesAiBilling, aiChargeFor, ActivepiecesError, AIProviderName, ErrorCode, isNil, observedProviderFetch, ProviderOutcomeReporter, spreadIfDefined } from '@activepieces/core-utils';
 import { CloudflareGatewayMetadata, createCloudflareGatewayModel, createImageModel, createLanguageModel } from '@activepieces/ai-providers';
-import { AI_PROVIDER_CAPABILITIES, AiProviderCredentials, getEffectiveProviderAndModel } from '@activepieces/shared';
+import { ACTIVEPIECES_IMAGE_TIERS, AI_PROVIDER_CAPABILITIES, AiProviderCredentials, aiProviderUtils, getEffectiveProviderAndModel } from '@activepieces/shared';
 import { anthropic } from '@ai-sdk/anthropic'
 import { createAzure } from '@ai-sdk/azure'
 import { createGoogleGenerativeAI, google } from '@ai-sdk/google'
@@ -10,6 +10,7 @@ import { createOpenRouter, OpenRouterChatSettings } from '@openrouter/ai-sdk-pro
 import { EmbeddingModel, generateText, ImageModel, LanguageModel, ToolSet } from 'ai'
 import { billedEmbeddingModel, billedLanguageModel } from './activepieces-ai-cost'
 import { keyHealthReporterFor } from './ai-provider-key-health'
+import { modelTierCatalog } from './model-tier-catalog'
 
 const DEFAULT_WEB_SEARCH_RESULTS = 5
 const MIN_OPENROUTER_WEB_SEARCH_RESULTS = 1
@@ -132,7 +133,30 @@ function openRouterWebSearchResults(options?: WebSearchOptions): number {
     )
 }
 
-function createModel({ credentials, modelId, metadata, flowStep, billing, turnAlreadyCharged, openaiResponsesModel = false, webSearchEnabled = false, webSearchOptions, platformId, providerConfigId }: {
+function managedModelIds(): string[] {
+    return [
+        ...aiProviderUtils.managedChatModelIds(),
+        ...(['flow', 'chat'] as const).flatMap((surface) => modelTierCatalog.current(surface).tiers.map((tier) => tier.modelId)),
+    ]
+}
+
+function managedImageModelIds(): string[] {
+    return ACTIVEPIECES_IMAGE_TIERS.map((tier) => tier.modelId)
+}
+
+function assertManagedModelAllowed({ provider, modelId, image, adminChosenModelId }: { provider: AIProviderName, modelId: string, image: boolean, adminChosenModelId?: string }): void {
+    const allowed = image ? [...managedImageModelIds(), ...(isNil(adminChosenModelId) ? [] : [adminChosenModelId])] : managedModelIds()
+    if (provider !== AIProviderName.ACTIVEPIECES || allowed.includes(modelId)) {
+        return
+    }
+    const message = `The model "${modelId}" is not available on Activepieces AI credits. Choose one of the listed models or connect your own AI provider key.`
+    throw new ActivepiecesError({
+        code: ErrorCode.VALIDATION,
+        params: { message },
+    }, message)
+}
+
+function createModel({ credentials, modelId, metadata, flowStep, billing, turnAlreadyCharged, openaiResponsesModel = false, webSearchEnabled = false, webSearchOptions, platformId, providerConfigId, imageGeneration = false, adminChosenImageModelId }: {
     credentials: AiProviderCredentials
     modelId: string
     metadata?: ChatModelMetadata
@@ -144,7 +168,10 @@ function createModel({ credentials, modelId, metadata, flowStep, billing, turnAl
     webSearchOptions?: WebSearchOptions
     platformId?: string
     providerConfigId?: string
+    imageGeneration?: boolean
+    adminChosenImageModelId?: string
 }): LanguageModel {
+    assertManagedModelAllowed({ provider: credentials.provider, modelId, image: imageGeneration, ...spreadIfDefined('adminChosenModelId', adminChosenImageModelId) })
     const model = buildModel({ credentials, modelId, metadata, flowStep, openaiResponsesModel, webSearchEnabled, webSearchOptions, onOutcome: keyHealthReporterFor({ platformId, providerConfigId }) })
     return billedLanguageModel({
         model,
@@ -208,11 +235,13 @@ function flowStepMetadataHeaders(flowStep?: FlowStepMetadata): Record<string, st
     }
 }
 
-fun
```

**File**: `packages/server/utils/test/ai-utils-published-tiers.test.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { AIProviderName } from '@activepieces/core-utils'
+import { aiProviderCredentials } from '@activepieces/shared'
+import { beforeEach, describe, expect, it, vi } from 'vitest'
+
+const get = vi.fn()
+
+vi.mock('../src/safe-http', () => ({
+    safeHttp: {
+        get retryingAxios() {
+            return { get }
+        },
+    },
+}))
+
+const PUBLISHED_ONLY_MODEL = 'acme/brand-new-model'
+
+const PUBLISHED = {
+    version: 1,
+    publishedAt: '2026-09-29T00:00:00.000Z',
+    publishedBy: 'ops@activepieces.com',
+    tiers: [{ id: 'fast', label: 'Fast', modelId: PUBLISHED_ONLY_MODEL, thinkingBudget: 5_000 }],
+    defaultTierId: 'fast',
+}
+
+describe('aiUtils.createModel on the managed key with a published tier file', () => {
+    beforeEach(() => {
+        get.mockReset()
+        process.env['AP_MODEL_TIERS_URL'] = 'https://tiers.test/pricing.json'
+        vi.resetModules()
+    })
+
+    it('runs a model only the published tiers permit once the file is loaded', async () => {
+        get.mockResolvedValue({ data: PUBLISHED })
+        const { modelTierCatalog } = await import('../src/model-tier-catalog')
+        const { aiUtils } = await import('../src/ai-utils')
+        const managed = aiProviderCredentials({ provider: AIProviderName.ACTIVEPIECES, auth: { apiKey: 'sk-managed' }, config: {} })
+
+        await modelTierCatalog.warmUp()
+
+        expect(() => aiUtils.createModel({ credentials: managed, modelId: PUBLISHED_ONLY_MODEL })).not.toThrow()
+    })
+})
```

**File**: `packages/server/utils/test/ai-utils.test.ts` (modified, +32/-2)
```diff
@@ -1,5 +1,5 @@
 import { AIProviderName } from '@activepieces/core-utils'
-import { aiProviderCredentials } from '@activepieces/shared'
+import { ACTIVEPIECES_CHAT_TIERS, ACTIVEPIECES_IMAGE_TIERS, aiProviderCredentials } from '@activepieces/shared'
 import { describe, expect, it } from 'vitest'
 import { aiUtils, WebSearchOptions } from '../src/ai-utils'
 
@@ -143,9 +143,39 @@ describe('aiUtils.createModelForImages', () => {
     })
 })
 
+describe('aiUtils.createModel on the managed Activepieces key', () => {
+    const managed = aiProviderCredentials({ provider: AIProviderName.ACTIVEPIECES, auth: { apiKey: 'sk-managed' }, config: {} })
+
+    it('refuses a model that no published tier or allow-list entry permits', () => {
+        expect(() => aiUtils.createModel({ credentials: managed, modelId: 'perplexity/sonar-deep-research' }))
+            .toThrow(/not available on Activepieces AI credits/)
+    })
+
+    it('runs a model the tiers permit', () => {
+        expect(() => aiUtils.createModel({ credentials: managed, modelId: ACTIVEPIECES_CHAT_TIERS[0].modelId })).not.toThrow()
+    })
+
+    it('refuses an image model outside the managed image tiers', () => {
+        expect(() => aiUtils.createModelForImages({ credentials: managed, modelId: 'openai/gpt-5-image' }))
+            .toThrow(/not available on Activepieces AI credits/)
+        expect(() => aiUtils.createModel({ credentials: managed, modelId: 'openai/gpt-5-image', imageGeneration: true }))
+            .toThrow(/not available on Activepieces AI credits/)
+    })
+
+    it('runs the managed default image model and an image model the admin chose', () => {
+        expect(() => aiUtils.createModelForImages({ credentials: managed, modelId: ACTIVEPIECES_IMAGE_TIERS[0].modelId })).not.toThrow()
+        expect(() => aiUtils.createModelForImages({ credentials: managed, modelId: 'openai/gpt-5-image', adminChosenImageModelId: 'openai/gpt-5-image' })).not.toThrow()
+    })
+
+    it('leaves a customer-supplied OpenRouter key unrestricted', () => {
+        const own = aiProviderCredentials({ provider: AIProviderName.OPENROUTER, auth: { apiKey: 'sk-own' }, config: {} })
+        expect(() => aiUtils.createModel({ credentials: own, modelId: 'perplexity/sonar-deep-research' })).not.toThrow()
+    })
+})
+
 describe('what the managed provider is asked to send back', () => {
     function settingsFor({ provider, webSearchEnabled = false }: { provider: AIProviderName, webSearchEnabled?: boolean }): Record<string, unknown> | undefined {
-        const model = aiUtils.createModel({ credentials: aiProviderCredentials({ provider, auth: { apiKey: 'key' }, config: {} }), modelId: 'anthropic/claude-sonnet-5', webSearchEnabled })
+        const model = aiUtils.createModel({ credentials: aiProviderCredentials({ provider, auth: { apiKey: 'key' }, config: {} }), modelId: ACTIVEPIECES_CHAT_TIERS[0].modelId, webSearchEnabled })
         return (model as unknown as { settings?: Record<string, unknown> }).settings
     }
 
```

**File**: `packages/server/worker/src/lib/execute/jobs/ai/generate-image.ts` (modified, +7/-5)
```diff
@@ -24,7 +24,7 @@ export async function generateImageStep({ ctx, data, resolved, flowStep, billing
     return url
 }
 
-export async function getGeneratedImage({ credentials, modelId, prompt, advancedOptions, inputImages, flowStep, billing, turnAlreadyCharged = false, aspectRatio, abortSignal }: {
+export async function getGeneratedImage({ credentials, modelId, prompt, advancedOptions, inputImages, flowStep, billing, turnAlreadyCharged = false, aspectRatio, abortSignal, adminChosenImageModelId }: {
     credentials: AiProviderCredentials
     modelId: string
     prompt: string
@@ -35,8 +35,9 @@ export async function getGeneratedImage({ credentials, modelId, prompt, advanced
     turnAlreadyCharged?: boolean
     aspectRatio?: `${number}:${number}`
     abortSignal?: AbortSignal
+    adminChosenImageModelId?: string
 }): Promise<GeneratedImage> {
-    const model = createImageCapableModel({ credentials, modelId, flowStep, billing, turnAlreadyCharged })
+    const model = createImageCapableModel({ credentials, modelId, flowStep, billing, turnAlreadyCharged, adminChosenImageModelId })
     const { provider: effectiveProvider } = getEffectiveProviderAndModel({ provider: credentials.provider, model: modelId })
     const resolvedProvider = effectiveProvider ?? credentials.provider
     const hasInputImages = inputImages.length > 0
@@ -71,21 +72,22 @@ export function imageBytesOf(image: GeneratedImage): Buffer {
     return !isNil(image.base64) && image.base64.length > 0 ? Buffer.from(image.base64, 'base64') : Buffer.from(image.uint8Array)
 }
 
-function createImageCapableModel({ credentials, modelId, flowStep, billing, turnAlreadyCharged }: {
+function createImageCapableModel({ credentials, modelId, flowStep, billing, turnAlreadyCharged, adminChosenImageModelId }: {
     credentials: AiProviderCredentials
     modelId: string
     flowStep?: FlowStepMetadata
     billing: ActivepiecesAiBilling
     turnAlreadyCharged: boolean
+    adminChosenImageModelId?: string
 }): ImageCapableModel {
     if (!AI_PROVIDER_CAPABILITIES[credentials.provider].supportsImageGeneration) {
         throw new Error(`Provider ${credentials.provider} does not support image models`)
     }
-    const imageModel = aiUtils.createModelForImages({ credentials, modelId, flowStep })
+    const imageModel = aiUtils.createModelForImages({ credentials, modelId, flowStep, ...spreadIfDefined('adminChosenImageModelId', adminChosenImageModelId) })
     if (!isNil(imageModel)) {
         return { kind: 'image', model: imageModel }
     }
-    return { kind: 'language', model: aiUtils.createModel({ credentials, modelId, flowStep, billing, turnAlreadyCharged }) }
+    return { kind: 'language', model: aiUtils.createModel({ credentials, modelId, flowStep, billing, turnAlreadyCharged, imageGeneration: true, ...spreadIfDefined('adminChosenImageModelId', adminChosenImageModelId) }) }
 }
 
 async function generateImageUsingGenerateText({ model, prompt, inputImages, aspectRatio, abortSignal }: {
```

---

### Incident Patch 5: `208671f7` (2026-09-30)
**Commit Message**: fix(chat): chat finishes long jobs instead of stopping partway (#15925)

**File**: `brain/knowledge/flows-execution/chat.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ A turn is kept alive / reclaimed by three separate mechanisms in `execute-agent-
 - **Stream idle watchdog** (`STREAM_IDLE_TIMEOUT_MS` 90s, in `streamChunksToClient`): aborts the turn if the drain-stream reader is silent 90s. It must be SUSPENDED while legitimate silent work is in flight — pending tool calls AND in-flight reasoning (`reasoning-start`→`reasoning-end`). **Reasoning-awareness was missing and caused the bug where long "thinking" on the Expert tier randomly aborted a healthy turn** (a >90s gap between reasoning deltas looked like a wedge). Backstop for a genuine mid-reasoning wedge is `MAX_TURN_WALL_CLOCK_MS` (20 min).
 
 ### Gotchas
+- **Chat has no fixed step cap.** A chat turn is bounded by credits (checked after every step), the runaway-token ceiling (`RUNAWAY_TURN_CONTEXT_MULTIPLE` × the context window), the identical-failure guard and the 2-hour `MAX_AGENT_TURN_WALL_CLOCK_MS`, so it finishes long jobs. A saved agent's author-set `maxSteps` is still honored on its last step: an agent with structured output is forced to call `TASK_COMPLETION_TOOL_NAME` so the flow gets a result, and any other agent runs with `toolChoice: 'none'` plus a wrap-up note, so it replies with what's done and what's left. Never a silent stop or an error.
 - **The streaming lock is per run, not per conversation.** A re-send can claim `activeRunId` before the first job reaches `getAgentConfig`. `agentHelpers.acquireStreamingLock` only lets the owning run set STREAMING; an older run gets `AGENT_RUN_SUPERSEDED` and the worker exits quietly, with no ERROR save and no events. A lock that ignored `runId` let the old run stream unowned while the new one was rejected as busy and marked ERROR, which is how users saw nothing after tapping a starter card twice.
 - **A failed turn used to leave status ERROR with an empty reply.** The error text only travelled as a websocket `ERROR` event, so a reload, another tab, or a user who was away saw a dead conversation (and often no user message either when the job died inside `getAgentConfig`, before it persists the turn). The `execute-agent-run.ts` catch now sends `failure: { message, userMessage? }` on the empty `saveAgentMessages` call and `conversation-rpc.ts` appends it to `uiMessages` as an assistant text reply; `use-chat.ts` shows the Retry banner when a loaded conversation is ERROR. Stale STREAMING to IDLE recovery, a worker that never picks the job up, and `assertAgentMessageRateLimitNotExceeded` still leave no reply of their own.
 - **A built flow ends with a "Turn it on?" card, never an auto-publish**: an audit found 40% of built-but-unpublished flows ended on "open it to review", some claiming LIVE. Chat never publishes on its own; only a yes to the card calls `ap_lock_and_publish` (`build_flow.md` "Turn it on?"). Pinned by the `build-then-ask-turn-it-on` fixture (`askedToTurnItOn`, `noLiveClaimWithoutPublish`). The live-claim check is a regex plus "was `ap_lock_and_publish` called", so it cannot see whether publish succeeded.
```

**File**: `packages/server/worker/src/lib/execute/jobs/ee/agent/run-agent-turn.ts` (modified, +23/-8)
```diff
@@ -1,12 +1,11 @@
 import { AIProviderName, ErrorCode, formatPieceError, isNil, isObject, isProviderBillingError, isTransientProviderError, spreadIfDefined, tryCatch, tryCatchSync } from '@activepieces/core-utils'
 import { agentAiUtils, ContentPartLike } from '@activepieces/server-utils'
-import { AgentPhase, AgentRunSource, agentToolClassification, agentToolPhases, AI_PROVIDER_ENTITY_TYPES, aiProviderUtils, apErrorOf, CHAT_CREDITS_PER_TOOL_CALL, chatBilling, ChatToolCall, PersistedAgentPart } from '@activepieces/shared'
-import { APICallError, generateText, isLoopFinished, isStepCount, LanguageModel, LanguageModelUsage, ModelMessage, NoSuchToolError, RetryError, StepResultPerformance, StopCondition, streamText, ToolExecutionOptions, ToolSet } from 'ai'
+import { AgentPhase, AgentRunSource, agentToolClassification, agentToolPhases, AI_PROVIDER_ENTITY_TYPES, aiProviderUtils, apErrorOf, CHAT_CREDITS_PER_TOOL_CALL, chatBilling, ChatToolCall, PersistedAgentPart, TASK_COMPLETION_TOOL_NAME } from '@activepieces/shared'
+import { APICallError, generateText, isLoopFinished, isStepCount, LanguageModel, LanguageModelUsage, ModelMessage, NoSuchToolError, RetryError, StepResultPerformance, StopCondition, streamText, ToolChoice, ToolExecutionOptions, ToolSet } from 'ai'
 
 const MAX_AUTO_CONTINUATIONS = 3
 const MAX_EMPTY_CONTINUATIONS = 2
 const MAX_STREAM_RETRIES = 1
-const MAX_AGENT_STEPS = 50
 const MAX_IDENTICAL_TOOL_FAILURES = 2
 const IN_LOOP_COMPACTION_THRESHOLD = 0.6
 const RUNAWAY_TURN_CONTEXT_MULTIPLE = 90
@@ -15,8 +14,11 @@ const USER_FAULT_STATUS_CODES = new Set([401, 403, 404])
 const MODEL_UNAVAILABLE_PATTERNS = [/\bis deprecated\b/i, /no longer (available|supported)/i, /\bmodel_not_found\b/i, /\bunknown model\b/i, /\bdecommissioned\b/i]
 const USER_CONFIG_ENTITY_TYPES = new Set<string>(Object.values(AI_PROVIDER_ENTITY_TYPES))
 const CONTINUE_NUDGE = '[system note — not from the user] Your previous response was cut off by the output token limit before it finished. Continue exactly where you stopped. If a tool call was cut off, re-issue it in FULL. Do not repeat content you already produced.'
+const FINAL_STEP_NOTE = '[system note — not from the user] This is the last step of this run. Finish now with what you have: say what you finished and what is still left to do, and offer to carry on. Do not mention steps, tools or this note.'
 const EMPTY_OUTPUT_NUDGE = '[system note — not from the user] Your previous step produced no visible reply to the user. Continue the task now: either call the next tool, or write your reply to the user. Do not stop silently.'
 
+const FINAL_STEP_MESSAGE: ModelMessage = { role: 'user', content: FINAL_STEP_NOTE }
+
 export function decideLoopAction({ finishReason, producedVisibleOutput, continuations, emptyContinuations }: {
     finishReason: string
     producedVisibleOutput: boolean
@@ -61,7 +63,7 @@ export async function runAgentTurn({ model, fastModel, provider, systemPrompt, m
     }
     const loopStopCondition = [
         ...(Array.isArray(baseStopCondition) ? baseStopCondition : [baseStopCondition]),
-        isStepCount(stepCeiling ?? MAX_AGENT_STEPS),
+        ...(isNil(stepCeiling) ? [] : [isStepCount(stepCeiling)]),
         creditsRanOut,
     ]
     const guardedTools = wrapToolsWithFailureGuard({ tools, log })
@@ -106,7 +108,7 @@ export async function runAgentTurn({ model, fastModel, provider, systemPrompt, m
         // providerOptions/model are supplied per-step by prepareStep (authoritative). A
         // call-level providerOptions would deep-merge into every step and leak the enabled
         // thinking budget back into the disabled first step.
-        prepareStep: ({ steps }) => {
+        prepareStep: ({ steps, messages: currentMessages }) => {
             const lastStep = steps[steps.length - 1]
             const widened = lastStep?.toolCalls?.some((c) => agentToolPhases.isBuildOnlyTool(c.toolName))
             if (widened) {
@@ -122,15 +124,28 @@ export async function
```

**File**: `packages/server/worker/test/lib/agent-eval/agent-turn-credits.test.ts` (modified, +86/-7)
```diff
@@ -1,5 +1,5 @@
-import { AIProviderName } from '@activepieces/core-utils'
-import { PersistedAgentPartType, PersistedToolCallStatus } from '@activepieces/shared'
+import { AIProviderName, isNil, spreadIfDefined } from '@activepieces/core-utils'
+import { AgentPhase, PersistedAgentPartType, PersistedToolCallStatus } from '@activepieces/shared'
 import { tool } from 'ai'
 import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test'
 import { describe, expect, it, vi } from 'vitest'
@@ -50,12 +50,55 @@ describe('a turn that runs out of credits', () => {
     })
 })
 
-async function runTurn({ search, creditsLeft, stepCeiling = 20, model = alwaysSearchingModel() }: {
+describe('a turn with many steps', () => {
+    it('ends a saved agent\'s step budget with a reply instead of a silent stop', async () => {
+        const search = vi.fn(async () => SEARCH_RESULT)
+        const model = searchUntilToldToAnswer({ searches: 10 })
+
+        const turn = await runTurn({ search, creditsLeft: async () => 100, stepCeiling: 3, model, drainsStream: true })
+
+        const toolChoices = model.doStreamCalls.map((call) => call.toolChoice?.type)
+        expect(search).toHaveBeenCalledTimes(2)
+        expect(toolChoices.at(-1)).toBe('none')
+        expect(JSON.stringify(model.doStreamCalls.at(-1)?.prompt)).toContain('last step of this run')
+        expect(turn.uiParts.at(-1)?.type).toBe(PersistedAgentPartType.TEXT)
+    })
+
+    it('makes a flow-step agent report its structured output on the last step, so the flow still gets a result', async () => {
+        const capture = vi.fn()
+        const model = searchUntilToldToAnswer({ searches: 10 })
+
+        await runTurn({ search: async () => SEARCH_RESULT, creditsLeft: async () => 100, stepCeiling: 3, model, drainsStream: true, completion: capture, phase: 'build' })
+
+        const thinkingPerCall = model.doStreamCalls.map((call) => JSON.stringify(call.providerOptions).includes('"enabled"'))
+        const lastCall = model.doStreamCalls.at(-1)
+        expect(lastCall?.toolChoice).toEqual({ type: 'tool', toolName: 'updateTaskStatus' })
+        expect(thinkingPerCall.slice(1, -1).every(Boolean)).toBe(true)
+        expect(thinkingPerCall.at(-1)).toBe(false)
+        expect(capture).toHaveBeenCalledWith({ output: { summary: 'partial' } })
+    })
+
+    it('lets chat finish a long job, since credits, time and context already bound the turn', async () => {
+        const search = vi.fn(async () => SEARCH_RESULT)
+
+        await runTurn({ search, creditsLeft: async () => 1_000, stepCeiling: null, model: searchUntilToldToAnswer({ searches: 60 }), drainsStream: true })
+
+        expect(search).toHaveBeenCalledTimes(60)
+    })
+})
+
+async function runTurn({ search, creditsLeft, stepCeiling = 20, model = alwaysSearchingModel(), drainsStream = false, completion, phase = 'discovery' }: {
     search: () => Promise<unknown>
     creditsLeft: (pendingCredits: number) => Promise<number | null>
-    stepCeiling?: number
+    stepCeiling?: number | null
     model?: MockLanguageModelV3
+    drainsStream?: boolean
+    completion?: (input: unknown) => void
+    phase?: AgentPhase
 }): ReturnType<typeof runAgentTurn> {
+    const completionTools = isNil(completion)
+        ? {}
+        : { updateTaskStatus: tool({ description: 'report the result', inputSchema: z.object({ output: z.object({ summary: z.string() }) }), execute: async (input) => { completion(input); return SEARCH_RESULT } }) }
     return runAgentTurn({
         model,
         provider: AIProviderName.ANTHROPIC,
@@ -64,14 +107,16 @@ async function runTurn({ search, creditsLeft, stepCeiling = 20, model = alwaysSe
         tools: {
             ap_web_search: tool({ description: 'search the web', inputSchema: z.object({ query: z.string() }), execute: search }),
             ap_fetch_url: tool({ description: 'read a page', inputSchema: z.object({ url: z.string() }), execute: async () => SEARCH_RESULT }),
+            ...co
```

---

### Incident Patch 6: `6881d9f2` (2026-09-30)
**Commit Message**: ci: skip redis-memory-server compile in piece validate and release pieces workflows (#15844)

**File**: `.github/workflows/release-pieces.yml` (modified, +2/-0)
```diff
@@ -42,6 +42,8 @@ jobs:
 
       - name: Install dependencies
         run: bun install
+        env:
+          REDISMS_DISABLE_POSTINSTALL: "1"
 
       - name: copy project .npmrc to user level
         run: cp .npmrc $HOME/.npmrc
```

**File**: `.github/workflows/validate-publishable-packages.yml` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ jobs:
 
       - name: Install dependencies
         run: bun install
+        env:
+          REDISMS_DISABLE_POSTINSTALL: "1"
 
       - name: validate publishable packages
         run: npx ts-node -r tsconfig-paths/register -P packages/server/engine/tsconfig.lib.json tools/scripts/validate-publishable-packages.ts
```

**File**: `packages/pieces/community/figma/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@activepieces/piece-figma",
-  "version": "0.6.2",
+  "version": "0.6.3",
   "main": "./dist/src/index.js",
   "types": "./dist/src/index.d.ts",
   "scripts": {
```

---

### Incident Patch 7: `611db01a` (2026-09-29)
**Commit Message**: fix(chat): show why a reply failed and let users retry (#15931)

**File**: `brain/knowledge/flows-execution/chat.md` (modified, +2/-0)
```diff
@@ -31,6 +31,8 @@ A turn is kept alive / reclaimed by three separate mechanisms in `execute-agent-
 - **Stream idle watchdog** (`STREAM_IDLE_TIMEOUT_MS` 90s, in `streamChunksToClient`): aborts the turn if the drain-stream reader is silent 90s. It must be SUSPENDED while legitimate silent work is in flight — pending tool calls AND in-flight reasoning (`reasoning-start`→`reasoning-end`). **Reasoning-awareness was missing and caused the bug where long "thinking" on the Expert tier randomly aborted a healthy turn** (a >90s gap between reasoning deltas looked like a wedge). Backstop for a genuine mid-reasoning wedge is `MAX_TURN_WALL_CLOCK_MS` (20 min).
 
 ### Gotchas
+- **The streaming lock is per run, not per conversation.** A re-send can claim `activeRunId` before the first job reaches `getAgentConfig`. `agentHelpers.acquireStreamingLock` only lets the owning run set STREAMING; an older run gets `AGENT_RUN_SUPERSEDED` and the worker exits quietly, with no ERROR save and no events. A lock that ignored `runId` let the old run stream unowned while the new one was rejected as busy and marked ERROR, which is how users saw nothing after tapping a starter card twice.
+- **A failed turn used to leave status ERROR with an empty reply.** The error text only travelled as a websocket `ERROR` event, so a reload, another tab, or a user who was away saw a dead conversation (and often no user message either when the job died inside `getAgentConfig`, before it persists the turn). The `execute-agent-run.ts` catch now sends `failure: { message, userMessage? }` on the empty `saveAgentMessages` call and `conversation-rpc.ts` appends it to `uiMessages` as an assistant text reply; `use-chat.ts` shows the Retry banner when a loaded conversation is ERROR. Stale STREAMING to IDLE recovery, a worker that never picks the job up, and `assertAgentMessageRateLimitNotExceeded` still leave no reply of their own.
 - **A built flow ends with a "Turn it on?" card, never an auto-publish**: an audit found 40% of built-but-unpublished flows ended on "open it to review", some claiming LIVE. Chat never publishes on its own; only a yes to the card calls `ap_lock_and_publish` (`build_flow.md` "Turn it on?"). Pinned by the `build-then-ask-turn-it-on` fixture (`askedToTurnItOn`, `noLiveClaimWithoutPublish`). The live-claim check is a regex plus "was `ap_lock_and_publish` called", so it cannot see whether publish succeeded.
 - **Server-managed connections**: the LLM never sees connection externalIds; `ap_execute_action` auto-fills them from a Redis store.
 - **Prompt-injection taint**: a per-turn `taintState` flips to `tainted` once the turn reads outside or user data (MCP tools, web/search/scrape, `ap_explore_data`, `ap_execute_action`, `ap_run_code`, `ap_list_across_projects`, configured tools). It forces the action-preview gate on non-read-only actions, blocks saved-agent edits, and makes `ap_remember` ask before saving (memory reaches every future conversation). It carries one message: each saved reply stores `tainted` (this reply's own reads, via `createTaintState`), and the next message starts from it. Deletes are confirmed always, not by taint.
```

**File**: `packages/core/execution/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@activepieces/core-execution",
-  "version": "0.23.4",
+  "version": "0.23.5",
   "type": "commonjs",
   "main": "./dist/src/index.js",
   "scripts": {
```

**File**: `packages/core/execution/src/lib/workers/worker-contract.ts` (modified, +1/-0)
```diff
@@ -184,6 +184,7 @@ export type SaveAgentMessagesRequest = {
     uiMessages: unknown[]
     title?: string
     modelName?: string
+    failure?: { message: string, userMessage?: string }
 }
 
 export type SaveAgentFileRequest = {
```

**File**: `packages/core/utils/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@activepieces/core-utils",
-  "version": "0.8.2",
+  "version": "0.8.3",
   "type": "commonjs",
   "main": "./dist/src/index.js",
   "scripts": {
```

**File**: `packages/core/utils/src/lib/activepieces-error.ts` (modified, +9/-0)
```diff
@@ -50,6 +50,7 @@ export type ApErrorParams =
     | TriggerUpdateStatusErrorParams
     | TriggerFailedErrorParams
     | ValidationErrorParams
+    | AgentRunSupersededErrorParams
     | FileTooLargeErrorParams
     | InvitationOnlySignUpParams
     | UserIsInActiveErrorParams
@@ -325,6 +326,13 @@ ErrorCode.VALIDATION,
 }
 >
 
+export type AgentRunSupersededErrorParams = BaseErrorParams<
+ErrorCode.AGENT_RUN_SUPERSEDED,
+{
+    message: string
+}
+>
+
 export type FileTooLargeErrorParams = BaseErrorParams<
 ErrorCode.FILE_TOO_LARGE,
 {
@@ -592,6 +600,7 @@ export enum ErrorCode {
     USER_IS_INACTIVE = 'USER_IS_INACTIVE',
     USER_NOT_FOUND_ON_PLATFORM = 'USER_NOT_FOUND_ON_PLATFORM',
     VALIDATION = 'VALIDATION',
+    AGENT_RUN_SUPERSEDED = 'AGENT_RUN_SUPERSEDED',
     FILE_TOO_LARGE = 'FILE_TOO_LARGE',
     INVALID_LICENSE_KEY = 'INVALID_LICENSE_KEY',
     EMAIL_ALREADY_HAS_ACTIVATION_KEY = 'EMAIL_ALREADY_HAS_ACTIVATION_KEY',
```

---

### Incident Patch 8: `3b227019` (2026-09-29)
**Commit Message**: fix(chat): long conversations no longer fail with a context-length error (#15923)

**File**: `brain/knowledge/flows-execution/chat.md` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ A turn is kept alive / reclaimed by three separate mechanisms in `execute-agent-
 - **Write-check gate**: before a live `ap_test_flow`, `__flow_write_check` RPC flags write/destructive PIECE steps; read-only flows run ungated; gate fails open on RPC error.
 - **Cloud rollout cap**: opens to non-embed users without `chatEnabled` until 200 distinct users have sent a message (`CLOUD_CHAT_ROLLOUT_CAP`); grandfathered after close. Embedded sessions never see chat.
 - **Flow correctness is 100% prompt/guide-driven — nothing in code enforces it.** The "#1 silent bug" ("Class A"): the agent frames a *recurring* automation as a *one-time task* and omits any anti-reprocessing step, so run N+1 redoes run N's work (re-pays, re-sends). It's a design-time reasoning gap, not a testing gap — `ap_test_flow` runs ONCE, so a single test looks perfect; the bug only shows on the 2nd run. Fix lives in the prompt (`chat-system-prompt.md` `<decision_framework>` + `build_flow.md` "Recurring flows must not reprocess") + capability eval fixtures with a `recurring_avoids_reprocessing` judge dimension. The platform already has every primitive (Tables New-Record webhook, polling `DedupeStrategy`, `_dedupe_key`, Store, update/delete-record); the agent just wasn't reaching for them. Watch the `build_flow.md` "don't over-build" bias — it once actively discouraged the fix.
-- **The context budget ignores tool schemas and reserved `max_tokens`.** Anthropic/OpenRouter count both against the 200k window; `agent-compaction.ts` budgets neither. It trims history to `COMPACTION_THRESHOLD (0.7) × 200_000 = 140_000` and its fit check looks only at message chars, while `run-agent-turn.ts` sets `maxOutputTokens: tier.thinkingBudget + 32_000` → 52k reserved on premium, plus ~12k of tool schemas (62 tools, 41 via MCP). 140k + 12k + 52k = 204k, so a conversation that compacts to just under the threshold still 400s with "maximum context length is 200000 tokens" — and it gets retried ~6× (`streamText maxRetries: 3` × `MAX_STREAM_RETRIES`), burning ~20s per turn. `maxOutputTokens` is set at the `streamText` call level, so the full thinking budget stays reserved even on step one where `prepareStep` disables thinking and swaps in haiku-4.5 (real case: 148_628 text + 11_872 tool + 52_000 output = 212_500; dropping the unused 20k reservation alone would have fit). `ESTIMATED_TOKENS_PER_MESSAGE = 200` also sizes the recent window by message *count*, so a 12-message history holding ~235k tokens of uploaded documents summarized only 1 message. When budgeting, subtract the reserved output window and tool-schema size from `getMaxContextTokens`, and don't reserve `thinkingBudget` on a thinking-disabled step.
+- **The context budget subtracts what the request reserves.** Anthropic/OpenRouter count tool schemas and the reserved `max_tokens` against the 200k window, so `getAgentConfig` passes `reservedTokens` (the clamped output window from `agentAiUtils.affordableOutputTokens`, the same helper the worker uses for `maxOutputTokens`, plus `TOOL_SCHEMA_TOKEN_ESTIMATE = 12_000`) into `agentCompaction`. The threshold, the fit check and the recent window are all measured against `maxContext - reservedTokens`, and the recent window is sized by estimated tokens, not message count. The tool-schema figure is a constant because the tools are built in the worker and the API never sees their definitions. The worker sets `maxOutputTokens` per step in `prepareStep`, so a thinking-disabled step (round one, discovery phase) does not reserve `thinkingBudget`. The system prompt's size is added to the reserve for the window and fit check, and each message is capped at 20k chars in the summary request so the summarizer itself cannot overflow.
 - **A write tool in `BUILD_ONLY_TOOL_NAMES` is only reachable if something flips the phase for it.** The denylist is the consistent home for anything that writes (`ap_create_flow`, `ap_create_table`, `ap_lock_and_publish` are all in it), but the only r
```

**File**: `packages/server/api/src/app/ee/agent/agent-compaction.ts` (modified, +83/-31)
```diff
@@ -10,8 +10,8 @@ const COMPACTION_THRESHOLD = 0.7
 const RECENT_WINDOW_RATIO = 0.3
 const CHARS_PER_TOKEN_ESTIMATE = 4
 const MIN_MESSAGES_BEFORE_COMPACTION = 6
-const ESTIMATED_TOKENS_PER_MESSAGE = 200
 const MAX_TOOL_RESULT_CHARS_FOR_SUMMARY = 2_000
+const SUMMARY_OUTPUT_RESERVE_TOKENS = 4_000
 
 const COMPACTION_SYSTEM_PROMPT = readFileSync(
     path.resolve('packages/server/api/src/assets/prompts/chat-compaction-prompt.md'),
@@ -22,20 +22,33 @@ function estimateTokenCount({ messages, systemPromptLength }: {
     messages: ModelMessage[]
     systemPromptLength: number
 }): number {
-    const totalChars = JSON.stringify(messages).length + systemPromptLength
-    return Math.ceil(totalChars / CHARS_PER_TOKEN_ESTIMATE)
+    return tokensIn(JSON.stringify(messages)) + Math.ceil(systemPromptLength / CHARS_PER_TOKEN_ESTIMATE)
 }
 
-function shouldCompact({ estimatedTokens, provider, messageCount }: {
+function contextBudget({ provider, reservedTokens }: { provider: AIProviderName, reservedTokens: number }): number {
+    return Math.max(0, aiProviderUtils.getMaxContextTokens({ provider }) - reservedTokens)
+}
+
+function recentWindowSizeFor({ messages, targetTokens }: { messages: ModelMessage[], targetTokens: number }): number {
+    let tokens = 0
+    let size = 0
+    for (let i = messages.length - 1; i > 0 && tokens < targetTokens; i--) {
+        tokens += tokensIn(JSON.stringify(messages[i]))
+        size++
+    }
+    return Math.min(Math.max(2, size), messages.length - 1)
+}
+
+function shouldCompact({ estimatedTokens, provider, messageCount, reservedTokens }: {
     estimatedTokens: number
     provider: AIProviderName
     messageCount: number
+    reservedTokens: number
 }): boolean {
     if (messageCount < MIN_MESSAGES_BEFORE_COMPACTION) {
         return false
     }
-    const maxContext = aiProviderUtils.getMaxContextTokens({ provider })
-    return estimatedTokens > maxContext * COMPACTION_THRESHOLD
+    return estimatedTokens > contextBudget({ provider, reservedTokens }) * COMPACTION_THRESHOLD
 }
 
 /**
@@ -55,20 +68,19 @@ function snapToSafeMessageBoundary({ messages, rawCutoff }: {
     return idx
 }
 
-async function compactMessages({ messages, existingSummary, summarizedUpToIndex, provider, model, log }: {
+async function compactMessages({ messages, existingSummary, summarizedUpToIndex, provider, reservedTokens, model, log }: {
     messages: ModelMessage[]
     existingSummary: string | null
     summarizedUpToIndex: number | null
     provider: AIProviderName
+    reservedTokens: number
     model: LanguageModel
     log: FastifyBaseLogger
 }): Promise<{ summary: string, summarizedUpToIndex: number }> {
-    const maxContext = aiProviderUtils.getMaxContextTokens({ provider })
-    const targetRecentTokens = maxContext * RECENT_WINDOW_RATIO
-    const recentWindowSize = Math.min(
-        Math.max(2, Math.floor(targetRecentTokens / ESTIMATED_TOKENS_PER_MESSAGE)),
-        messages.length - 1,
-    )
+    const recentWindowSize = recentWindowSizeFor({
+        messages,
+        targetTokens: contextBudget({ provider, reservedTokens }) * RECENT_WINDOW_RATIO,
+    })
     const rawCutoff = messages.length - recentWindowSize
     const newCutoffIndex = snapToSafeMessageBoundary({ messages, rawCutoff })
 
@@ -83,12 +95,17 @@ async function compactMessages({ messages, existingSummary, summarizedUpToIndex,
         contentToSummarize += `Previous conversation summary:\n${existingSummary}\n\nNew messages since last summary:\n`
     }
 
-    for (const msg of messagesToSummarize) {
-        const content = extractTextContent(msg)
+    const texts = messagesToSummarize.map((msg) => extractTextContent(msg))
+    const summaryInputTokens = contextBudget({ provider, reservedTokens: SUMMARY_OUTPUT_RESERVE_TOKENS }) * COMPACTION_THRESHOLD
+        - tokensIn(COMPACTION_SYSTEM_PROMPT)
+        - tokensIn(contentToSummarize)
+    const perMessageTokens = fairShareCap({ lengths: texts.map(tokensIn), budget: summaryInpu
```

**File**: `packages/server/api/src/app/ee/agent/rpc/agent-config-rpc.ts` (modified, +8/-1)
```diff
@@ -204,10 +204,13 @@ export const agentConfigRpc = (log: FastifyBaseLogger) => ({
         })
         await agentApprovalGate.clearCancel({ conversationId })
 
+        const reservedOutputTokens = await agentAiUtils.affordableOutputTokens({ provider: providerConfig.provider, modelIds: [resolvedModelId, fastModelId], thinkingBudget: tier.thinkingBudget })
+        const reservedTokens = reservedOutputTokens + TOOL_SCHEMA_TOKEN_ESTIMATE
+        const payloadReservedTokens = reservedTokens + agentAiUtils.estimateTokenCount({ messages: [], systemPromptLength: systemPromptText.length })
         const estimatedTokens = agentCompaction.estimateTokenCount({ messages: llmHistory, systemPromptLength: systemPromptText.length })
         let compactionState = { summary: conversation.summary ?? null, summarizedUpToIndex: conversation.summarizedUpToIndex ?? null }
 
-        const willCompact = agentCompaction.shouldCompact({ estimatedTokens, provider: providerConfig.provider, messageCount: llmHistory.length })
+        const willCompact = agentCompaction.shouldCompact({ estimatedTokens, provider: providerConfig.provider, messageCount: llmHistory.length, reservedTokens })
         log.debug({ estimatedTokens, willCompact, messageCount: llmHistory.length, systemPromptLength: systemPromptText.length }, '[agentRpc#getAgentConfig] Compaction decision')
         if (willCompact) {
             const model = aiUtils.createModel({
@@ -219,6 +222,7 @@ export const agentConfigRpc = (log: FastifyBaseLogger) => ({
                 existingSummary: compactionState.summary,
                 summarizedUpToIndex: compactionState.summarizedUpToIndex,
                 provider: providerConfig.provider,
+                reservedTokens: payloadReservedTokens,
                 model,
                 log,
             })
@@ -234,6 +238,7 @@ export const agentConfigRpc = (log: FastifyBaseLogger) => ({
             summary: compactionState.summary,
             summarizedUpToIndex: compactionState.summarizedUpToIndex,
             provider: providerConfig.provider,
+            reservedTokens: payloadReservedTokens,
         })
 
         log.info({
@@ -275,3 +280,5 @@ export const agentConfigRpc = (log: FastifyBaseLogger) => ({
     },
 
 })
+
+const TOOL_SCHEMA_TOKEN_ESTIMATE = 12_000
```

**File**: `packages/server/api/test/unit/app/agent/agent-compaction.test.ts` (modified, +131/-2)
```diff
@@ -1,8 +1,18 @@
 import { AIProviderName, ErrorCode } from '@activepieces/core-utils'
-import { ModelMessage } from 'ai'
-import { describe, expect, it } from 'vitest'
+import { generateText, ModelMessage } from 'ai'
+import { MockLanguageModelV3 } from 'ai/test'
+import Fastify from 'fastify'
+import { describe, expect, it, vi } from 'vitest'
 import { agentCompaction } from '../../../../src/app/ee/agent/agent-compaction'
 
+vi.mock('ai', async (importOriginal) => ({
+    ...(await importOriginal<Record<string, unknown>>()),
+    generateText: vi.fn().mockResolvedValue({ text: 'summary' }),
+}))
+
+const summaryModel = new MockLanguageModelV3()
+const silentLog = Fastify({ logger: false }).log
+
 function makeMessages(count: number, charsPer = 100): ModelMessage[] {
     return Array.from({ length: count }, (_, i) => ({
         role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
@@ -36,6 +46,7 @@ describe('agentCompaction.shouldCompact', () => {
         const result = agentCompaction.shouldCompact({
             estimatedTokens: 999_999,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
             messageCount: 5,
         })
         expect(result).toBe(false)
@@ -46,6 +57,7 @@ describe('agentCompaction.shouldCompact', () => {
         const result = agentCompaction.shouldCompact({
             estimatedTokens: 100_000,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
             messageCount: 20,
         })
         expect(result).toBe(false)
@@ -56,6 +68,7 @@ describe('agentCompaction.shouldCompact', () => {
         const result = agentCompaction.shouldCompact({
             estimatedTokens: 150_000,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
             messageCount: 20,
         })
         expect(result).toBe(true)
@@ -66,6 +79,7 @@ describe('agentCompaction.shouldCompact', () => {
         const result = agentCompaction.shouldCompact({
             estimatedTokens: 150_000,
             provider: AIProviderName.GOOGLE,
+            reservedTokens: 0,
             messageCount: 20,
         })
         expect(result).toBe(false)
@@ -80,6 +94,7 @@ describe('agentCompaction.buildCompactedPayload', () => {
             summary: null,
             summarizedUpToIndex: null,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
         })
         expect(result).toBe(messages)
     })
@@ -91,6 +106,7 @@ describe('agentCompaction.buildCompactedPayload', () => {
             summary: 'User discussed flow creation.',
             summarizedUpToIndex: 7,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
         })
 
         expect(result.length).toBe(4) // 1 summary + 3 recent (index 7,8,9)
@@ -115,6 +131,7 @@ describe('agentCompaction.buildCompactedPayload', () => {
             summary: 'Short summary.',
             summarizedUpToIndex: 5,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
         })
 
         // Should have trimmed some recent messages
@@ -134,6 +151,7 @@ describe('agentCompaction.buildCompactedPayload', () => {
             summary: 'Summary',
             summarizedUpToIndex: 0,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
         })).toThrow(expect.objectContaining({
             error: expect.objectContaining({
                 code: ErrorCode.CHAT_CONTEXT_LIMIT_EXCEEDED,
@@ -159,6 +177,7 @@ describe('agentCompaction.buildCompactedPayload', () => {
             summary: 'Summary of earlier messages.',
             summarizedUpToIndex: 4,
             provider: AIProviderName.ANTHROPIC,
+            reservedTokens: 0,
         })
 
         // First message should be summary, second should NOT be a tool message
@@ -177,9 +196,119 @@ describe('agentCompaction.buildCompactedPayload', () => {
             summary: 'Brief summary.',
             summarizedUpToIndex:
```

**File**: `packages/server/utils/src/agent-ai-utils.ts` (modified, +15/-0)
```diff
@@ -3,9 +3,11 @@ import { agentPersistenceUtils, agentToolClassification, PersistedAgentPart, Per
 import { agentProviderOptions } from './agent-provider-options'
 import { ModelMessage, TelemetryOptions } from 'ai'
 import { createEvlogIntegration } from 'evlog/ai'
+import { modelCatalog } from './model-catalog'
 import { wideEvent } from './wide-event'
 
 
+const MAX_RESPONSE_OUTPUT_TOKENS = 32_000
 const KEEP_RECENT_TOOL_RESULTS = 6
 const COLLAPSE_OUTPUT_OVER_CHARS = 600
 // Tool results that are the agent's working memory of an action's input schema — never collapsed,
@@ -385,7 +387,20 @@ function isPlainObject(value: unknown): value is Record<string, unknown> {
     return typeof value === 'object' && value !== null && !Array.isArray(value)
 }
 
+async function affordableOutputTokens({ provider, modelIds, thinkingBudget }: { provider: AIProviderName, modelIds: (string | undefined)[], thinkingBudget: number }): Promise<number> {
+    const catalog = await modelCatalog.load()
+    const ceilings = modelIds.map((modelId) => isNil(modelId) ? undefined : catalog.lookup({ provider, modelId })?.maxOutputTokens)
+    return clampOutputTokens({ thinkingBudget, ceilings })
+}
+
+function clampOutputTokens({ thinkingBudget, ceilings }: { thinkingBudget: number, ceilings: (number | undefined)[] }): number {
+    const known = ceilings.filter((ceiling) => !isNil(ceiling))
+    return Math.min(thinkingBudget + MAX_RESPONSE_OUTPUT_TOKENS, ...known)
+}
+
 export const agentAiUtils = {
+    affordableOutputTokens,
+    clampOutputTokens,
     stripThinkingBlocks,
     sanitizeTruncatedAssistantTail,
     collectStepMessages,
```

---

### Incident Patch 9: `e5391e22` (2026-09-29)
**Commit Message**: fix: get alerted when the weekly AI model catalog update fails (#15929)

**File**: `.github/workflows/sync-model-catalog.yml` (modified, +11/-0)
```diff
@@ -60,3 +60,14 @@ jobs:
         run: |
           STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://cdn.activepieces.com/ai/model-catalog.json?run=$GITHUB_RUN_ID" || true)
           [ "$STATUS" = "200" ] || { echo "Publish verification failed: HTTP $STATUS"; exit 1; }
+
+      - name: Notify Discord on failure
+        if: failure()
+        env:
+          WEBHOOK: ${{ secrets.DISCORD_ON_CALL_WEBHOOK }}
+          BRANCH: ${{ github.ref_name }}
+          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
+        run: |
+          jq -n --arg branch "$BRANCH" --arg url "$RUN_URL" \
+            '{content: "🚨 **Sync AI Model Catalog Workflow Failed** 🚨\n\n**Branch:** \($branch)\n**Action URL:** \($url)\n\nThe AI model catalog sync did not finish. Please check the logs for more details."}' \
+            | curl --fail --silent --show-error -H "Content-Type: application/json" -X POST -d @- "$WEBHOOK"
```

**File**: `brain/knowledge/ai-intelligence/ai-providers.md` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ after a file without chat keys it seeds the chat list from the live flow list.
 - **The pricing console shows bundled constants when no file is published, and says nothing.** `overview()` in `ai-pricing-service.ts` has three states, and two of them render the same numbers: **absent** (`NoSuchKey`) silently seeds the editor from `DEFAULT_PRICING_DRAFT`, the console's own checked-in copy of the tiers and weights, while **unreadable** (any other S3 error) shows those same constants *plus* a banner and blocks publishing. Only **present** is live data. So a screen full of plausible tiers is not evidence that anything was ever published — `curl -I https://cdn.activepieces.com/ai/pricing.json` is. The absent state is deliberate, it is how the first publish bootstraps, but it means "I can see the tiers" and "the prices are live" are unrelated facts. Worse, **absent and misconfigured are the same state**: `cdnClient.getJson` catches `NoSuchKey` and returns `undefined`, so a wrong bucket or an endpoint with the bucket in its path reads as "nothing published yet" and hides behind the defaults. The tell is the History tab — `list` does *not* catch `NoSuchKey`, so the same misconfiguration that reads as empty on the pricing page returns a 500 there. A 500 on history with a normal-looking pricing page means the S3 addressing is wrong, not that the history is empty.
 - **Deleting the live tier file is safe for customers and confusing for everyone else.** `ai/pricing.json` was deleted on 2026-09-24 to drop a leftover test tier, and Activepieces kept serving the right tiers throughout: the 404 makes `fetchTiers` throw, the failure is logged and backed off, and `current()` keeps serving the last good copy the process fetched; only a process that never fetched one, a fresh boot during the outage, runs the `ACTIVEPIECES_CHAT_TIERS` shipped with the release. Two things do change. Each server logs 'Failed to refresh the AI model tiers file' (or 'Failed to load…' on a process that never got a copy) on every failed attempt, and attempts happen at boot and whenever `current()` is called with a stale or missing copy, at most once per five minutes (`FAILURE_BACKOFF_MS`), so a permanent 404 is retried the same way as a blip. And the console reads the missing key as **absent**, so the next publish starts again at `version: 1` while the `ai/pricing/history/` objects from the old numbering are still there — the version number is `live.version + 1`, not a counter, so it is only meaningful between two publishes that never lost the live key. To remove one bad tier, edit and publish; do not delete the object.
 - **`CDN_S3_*` and `AP_S3_*` are two different buckets on two different providers, and mixing them puts public objects in customer data.** `cdn.activepieces.com` is a **DigitalOcean Spaces** bucket, `activepieces-cdn` in `fra1`, fronted by Cloudflare — a 200 from it carries `x-rgw-object-type` and `x-do-cdn-uuid`, which is how you tell. That is where `ai/model-catalog.json`, `ai/pricing.json` and `sdk/embed/*.js` live, and the credentials are the `CDN_S3_*` GitHub secrets. `AP_S3_BUCKET` is something else entirely: the **Cloudflare R2** file-storage bucket (`ap-files-prod` in production) holding run logs, step checkpoints, webhook payloads and flow bundles. The names are similar enough that the pricing console was once configured with the R2 file-storage key by mistake, which would have written a `public-read` `ai/pricing.json` into the customer-data bucket while `cdn.activepieces.com` stayed 404. When wiring anything that publishes to the CDN, confirm the endpoint is the Spaces region origin (`https://fra1.digitaloceanspaces.com`, never with the bucket in the path — the SDK appends `Bucket` itself and the doubled path returns `NoSuchKey` on every call).
-- **The weekly sync workflow can fail and nobody is told.** `sync-model-catalog.yml` has no alert on failure, and the only signal that it broke is a 404 on the object, which every reade
```

---

### Incident Patch 10: `1e69fe0d` (2026-09-29)
**Commit Message**: fix(chat): ask before turning on the automations it builds (#15926)

**File**: `brain/knowledge/flows-execution/chat.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ A turn is kept alive / reclaimed by three separate mechanisms in `execute-agent-
 - **Stream idle watchdog** (`STREAM_IDLE_TIMEOUT_MS` 90s, in `streamChunksToClient`): aborts the turn if the drain-stream reader is silent 90s. It must be SUSPENDED while legitimate silent work is in flight — pending tool calls AND in-flight reasoning (`reasoning-start`→`reasoning-end`). **Reasoning-awareness was missing and caused the bug where long "thinking" on the Expert tier randomly aborted a healthy turn** (a >90s gap between reasoning deltas looked like a wedge). Backstop for a genuine mid-reasoning wedge is `MAX_TURN_WALL_CLOCK_MS` (20 min).
 
 ### Gotchas
+- **A built flow ends with a "Turn it on?" card, never an auto-publish**: an audit found 40% of built-but-unpublished flows ended on "open it to review", some claiming LIVE. Chat never publishes on its own; only a yes to the card calls `ap_lock_and_publish` (`build_flow.md` "Turn it on?"). Pinned by the `build-then-ask-turn-it-on` fixture (`askedToTurnItOn`, `noLiveClaimWithoutPublish`). The live-claim check is a regex plus "was `ap_lock_and_publish` called", so it cannot see whether publish succeeded.
 - **Server-managed connections**: the LLM never sees connection externalIds; `ap_execute_action` auto-fills them from a Redis store.
 - **Prompt-injection taint**: a per-turn `taintState` flips to `tainted` once the turn reads outside or user data (MCP tools, web/search/scrape, `ap_explore_data`, `ap_execute_action`, `ap_run_code`, `ap_list_across_projects`, configured tools). It forces the action-preview gate on non-read-only actions, blocks saved-agent edits, and makes `ap_remember` ask before saving (memory reaches every future conversation). It carries one message: each saved reply stores `tainted` (this reply's own reads, via `createTaintState`), and the next message starts from it. Deletes are confirmed always, not by taint.
 - **Write-check gate**: before a live `ap_test_flow`, `__flow_write_check` RPC flags write/destructive PIECE steps; read-only flows run ungated; gate fails open on RPC error.
```

**File**: `packages/server/api/src/assets/prompts/chat-system-prompt.md` (modified, +2/-2)
```diff
@@ -326,7 +326,7 @@ Every request starts with `<discovery>` — understand WHAT and WHY first.
 
 **One-time vs recurring — read the signal, don't default to recurring.** A one-time task and a scheduled automation are different builds; misreading the cadence wastes the whole turn. Decide from the wording:
 - **One-time** (→ `one_time_task`): an imperative to act *now* on data that already exists — "categorize *these* tickets", "send *this* now", "check my inbox", "score the rows in my sheet". No recurrence cue → treat as one-time.
-- **Recurring** (→ `<automation_build>`): an explicit ongoing/triggered cue — "when/whenever/each time/every new …", "every day/hour", "on a schedule", "from now on".
+- **Recurring** (→ `<automation_build>`): an explicit ongoing/triggered cue — "when/whenever/each time/every new …", "every day/hour", "on a schedule", "from now on", or the words "workflow", "automation", "monitor", "keep track of" used for something ongoing (an imperative to act once, like "track down this issue now", is still one-time). Build a flow for these; never answer with a one-off `ap_run_code` / `ap_web_search` or the showcase instead.
 - Only when the cadence is genuinely ambiguous, ask the single binary business question ("Run this once, or every time?") via `ap_show_questions` — never guess recurring. (Converting a one-time task into a recurring one later: `build_flow.md` → "Converting a one-time task".)
 - **Once it's recurring, guarantee it won't reprocess.** A recurring flow that reads data which persists between runs (a sheet, a table, an inbox, a record set) sees the SAME data again on the next run — so during discovery you MUST settle *what makes run N+1 skip what run N already handled*: a "new item"/dedup trigger instead of read-all, a processed-flag filter, delete/archive-after, or a stored high-water mark. Treating a recurring job as if it runs once — read-all → act → done, with no such mechanism — is the #1 silent logic bug (e.g. a weekly "summarize hours and tell me who to pay" that re-pays everyone every week because nobody was marked paid). This shapes the trigger and steps, so decide it now, not after building; the mechanisms are in `build_flow.md` → "Recurring flows must not reprocess".
 
@@ -350,7 +350,7 @@ This applies ONLY to deliverables the user asked you to produce. Normal conversa
 1. **DISCOVER** — follow `<discovery>`: understand the goal, then INFER the business logic from context (their company/domain, their data via `ap_explore_data`, market practice). Don't ask the user to supply categories, routing, or thresholds. If it's recurring and reads persistent data, also settle how run N+1 avoids reprocessing run N's data (see `<decision_framework>`) — a build-shaping decision, not an afterthought.
 2. **RESEARCH (the 2-call happy path)** — `ap_research_pieces({pieceNames:[app], forIntent:"<what you're doing>"})` for the apps involved (missing app → `http_fallback`); read the returned `recommendedActions` + each action's AI hint to pick the right action in one shot. Then call `ap_get_piece_props({pieceName, actionName, auth})` ONCE with the connection — this resolves the dropdowns/dynamic sub-fields AND returns `requiredInputs` + a ready-to-run `exampleInput`. Don't call `ap_resolve_property_options` separately when that one `ap_get_piece_props(auth)` call already resolved the field. Fill the example, then execute.
 3. **HANDOFF** — write a one-line recap of what you'll build and go. Make sure each app has a connection the user selected (`ap_show_connection_picker`/`ap_show_connection_required`). Pick sensible context-grounded defaults for every open choice; only show a choice-only `ap_show_questions` for a single make-or-break business choice you truly can't infer. No separate approval step, no upfront questionnaire.
-4. **BUILD** — `ap_set_phase('build')`, publish the live build plan with `ap_set_build_plan` (`phase: 'detecting'`, all steps `pending`), load `build_flow`, and execute it — keep the pla
```

**File**: `packages/server/api/src/assets/prompts/guides/build_flow.md` (modified, +5/-1)
```diff
@@ -111,7 +111,11 @@ Wire the **specific fields** a step consumes, never an entire upstream output. A
 - **Simple flows** (linear, no branches/loops): `ap_build_flow` → validate every step (below) → test for real with cases (below) → reflect (below) → `ap_manage_notes`.
 - **Flows with loops**: `ap_build_flow` supports nesting. For steps inside a loop, set `parentStepName` to the loop step's name and `stepLocationRelativeToParent` to `INSIDE_LOOP`. Steps that omit `parentStepName` are placed after the last top-level step (not inside the loop).
 - **Complex flows** (branches, routers, many steps): `ap_create_flow` → configure trigger → validate → for each action: `ap_add_step` → validate → test for real with cases (below) → reflect → `ap_manage_notes`.
-- Share the flow link. The flow is a draft — do NOT auto-publish.
+- Share the flow link, then finish per "Turn it on?" below. Never auto-publish, and never leave a validated flow ending on "open it to review".
+
+## Turn it on? — the one way every built flow ends
+Chat NEVER publishes on its own. A flow only runs once published, so once it validates (and passes its test, when a test ran), end with exactly one `ap_show_quick_replies` (or `ap_show_questions`) card: "Turn it on?" with chips like "Turn it on" / "Not yet". Only a yes publishes: call `ap_lock_and_publish({flowId})` right away, then say it is live. "Not yet" leaves it a draft.
+**Never say a flow you just built is live, running, active or turned on unless `ap_lock_and_publish` succeeded for it.** If publish returned an error, say so and fix it. Until then call it "a draft, not running yet". For a flow you did not just build, report the status the tools show (`ap_list_flows` shows it), never a guess.
 
 **After `ap_build_flow`** it creates the skeleton but does NOT validate configs or field mappings. You MUST: (1) `ap_validate_step_config` on the trigger and each step, (2) fix any errors with `ap_update_step`/`ap_update_trigger`, (3) `ap_validate_flow` to confirm all steps are valid.
 
```

**File**: `packages/server/worker/test/lib/agent-eval/core/fixture.ts` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ export type ChatEvalAssertion =
     | { type: 'calledBefore', a: string, b: string }
     | { type: 'reachedToolWithin', toolName: string, n: number }
     | { type: 'maxQuestionCards', n: number, toolNames?: string[] }
+    | { type: 'neverCalledTool', toolName: string }
+    | { type: 'askedToTurnItOn' }
+    | { type: 'noLiveClaimWithoutPublish' }
 
 export type ChatEvalJudgeDimension = {
     dimension: string
```

**File**: `packages/server/worker/test/lib/agent-eval/core/transcript-assertions.test.ts` (modified, +29/-0)
```diff
@@ -131,3 +131,32 @@ describe('transcriptAssertions.maxQuestionCards', () => {
         expect(transcriptAssertions.maxQuestionCards(result, 1, ['ap_show_questions']).pass).toBe(true)
     })
 })
+
+describe('transcriptAssertions publish behaviour', () => {
+    const build = toolCall({ toolName: 'ap_build_flow', order: 0, phase: 'build' })
+    const publish = toolCall({ toolName: 'ap_lock_and_publish', order: 1, phase: 'build' })
+
+    it('fails when a flow is built and ends on open it to review, or is published without asking', () => {
+        const review = makeResult({ toolCalls: [build], uiParts: [textPart('Open it to review.')] })
+        expect(transcriptAssertions.askedToTurnItOn(review).pass).toBe(false)
+        expect(transcriptAssertions.askedToTurnItOn(makeResult({ toolCalls: [build, publish] })).pass).toBe(false)
+    })
+
+    it('passes when a card is shown before any publish', () => {
+        const card = { ...toolCall({ toolName: 'ap_show_quick_replies', order: 1 }), input: { replies: ['Turn it on', 'Not yet'] } }
+        const unrelated = { ...toolCall({ toolName: 'ap_show_quick_replies', order: 1 }), input: { replies: ['Open it to review'] } }
+        expect(transcriptAssertions.askedToTurnItOn(makeResult({ toolCalls: [build, card] })).pass).toBe(true)
+        expect(transcriptAssertions.askedToTurnItOn(makeResult({ toolCalls: [build, unrelated] })).pass).toBe(false)
+    })
+
+    it('fails a live claim without a publish call and allows it after one', () => {
+        const uiParts = [textPart('Your flow is live and will run every morning.')]
+        expect(transcriptAssertions.noLiveClaimWithoutPublish(makeResult({ uiParts })).pass).toBe(false)
+        expect(transcriptAssertions.noLiveClaimWithoutPublish(makeResult({ uiParts, toolCalls: [build, publish] })).pass).toBe(true)
+    })
+
+    it('flags a forbidden one-off tool', () => {
+        const result = makeResult({ toolCalls: [toolCall({ toolName: 'ap_run_code', order: 0 })] })
+        expect(transcriptAssertions.neverCalledTool(result, 'ap_run_code').pass).toBe(false)
+    })
+})
```

#### Recent Merged Pull Requests:
- **PR #15983** (2026-09-30): feat(exa): run Exa agents, watch searches with a monitor trigger, and give AI agents search, contents and answer actions (@OdaiAhmed99)
- **PR #15982** (2026-09-30): feat(zoho-crm): work with records in any module, watch new and updated records, and add agent actions (@OdaiAhmed99)
- **PR #15981** (2026-09-30): feat(elevenlabs): add AI actions and output schemas (@kishanprmr)
- **PR #15980** (2026-09-30): fix(sandbox): code steps can import node: builtins again (@MrChaker)
- **PR #15978** (closed): feat(platform): admins seed the danger, warning and success colours (@moaaz-ae)
- **PR #15969** (2026-09-30): feat(ntfy): update, clear and delete notifications, send files and trigger on new messages (@OdaiAhmed99)
- **PR #15961** (closed): feat(upload-post): add Upload-Post piece (@mutonby)
- **PR #15958** (2026-09-29): feat(platform): lock AI Center behind the Plus plan like SSO (@Louai-Zokerburg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
