# Forensic Learning Record (Deep Inspection): featureform/featureform

> **Canonical Artifact**: `07_PROJECT_LEARNING/featureform-featureform-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/featureform/featureform](https://github.com/featureform/featureform))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:34:51.758Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `featureform/featureform`
- **Description**: The Virtual Feature Store. Turn your existing data infrastructure into a feature store.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1991 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/api.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package api

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	grpc_health "google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"
	grpc_status "google.golang.org/grpc/status"

	"github.com/featureform/fferr"
	"github.com/featureform/health"
	"github.com/featureform/helpers"
	"github.com/featureform/logging"
	"github.com/featureform/metadata"
	pb "github.com/featureform/metadata/proto"
	srv "github.com/featureform/proto"
	"github.com/featureform/provider"
	pt "github.com/featureform/provider/provider_type"
)

type ApiServer struct {
	Logger     logging.Logger
	address    string
	grpcServer *grpc.Server
	listener   net.Listener
	metadata   MetadataServer
	online     OnlineServer
}

type MetadataServer struct {
	address string
	Logger  logging.Logger
	meta    pb.MetadataClient
	client  *metadata.Client
	pb.UnimplementedApiServer
	health *health.Health
}

type OnlineServer struct {
	Logger  logging.Logger
	address string
	client  srv.FeatureClient
	srv.UnimplementedFeatureServer
}

func NewApiServer(logger logging.Logger, address string, metaAddr string, srvAddr string) (*ApiServer, error) {
	if srvAddr == "" {
		logger.Info("API server not connecting to serving endpoint")
	}
	return &ApiServer{
		Logger:  logger,
		address: address,
		metadata: MetadataServer{
			address: metaAddr,
			Logger:  logger,
		},
		online: OnlineServer{
			Logger:  logger,
			address: srvAddr,
		},
	}, nil
}

// rpc CreateUser(User) returns (Empty);
// - Anyone can create
func (serv *MetadataServer) CreateUser(ctx context.Context, userRequest *pb.UserRequest) (*pb.Empty, error) {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(ctx)
	logger = logger.WithResource(logging.User, userRequest.User.Name, logging.NoVariant)
	logger.Infow("Creating User")
	userRequest.RequestId = requestID.String()

	serv.Logger.Infow("Creating User", "user", userRequest.User)
	out, err := serv.meta.CreateUser(ctx, userRequest)
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (serv *MetadataServer) PruneResource(ctx context.Context, req *pb.PruneResourceRequest) (*pb.PruneResourceResponse, error) {
	_, ctx, logger := serv.Logger.InitializeRequestID(ctx)
	logger = logger.WithResource(logging.ResourceTypeFromProto(req.ResourceId.ResourceType), req.ResourceId.Resource.Name, req.ResourceId.Resource.Variant)
	logger.Infow("Pruning Resource")

	out, err := serv.meta.PruneResource(ctx, req)
	if err != nil {
		serv.Logger.Errorw("Failed to prune resource", "error", err)
		return nil, err
	}

	logger.Infow("Successfully pruned resource")
	return out, nil
}

func (serv *MetadataServer) MarkForDeletion(ctx context.Context, req *pb.MarkForDeletionRequest) (*pb.MarkForDeletionResponse, error) {
	_, ctx, logger := serv.Logger.InitializeRequestID(ctx)
	logger = logger.WithResource(logging.ResourceTypeFromProto(req.ResourceId.ResourceType), req.ResourceId.Resource.Name, req.ResourceId.Resource.Variant)
	logger.Infow("Marking Resource for Deletion")

	out, err := serv.meta.MarkForDeletion(ctx, req)
	if err != nil {
		serv.Logger.Errorw("Failed to mark resource for deletion", "error", err)
		return nil, err
	}

	logger.Infow("Successfully marked resource for deletion")
	return out, nil
}

// rpc GetUsers(stream Name) returns (stream User);
// - Anyone can get
func (serv *MetadataServer) GetUsers(stream pb.Api_GetUsersServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Users")
	proxyStream, err := serv.meta.GetUsers(ctx)
	if err != nil {
		logger.Errorw("Failed to get users from server", "error", err)
		return err
	}
	for {
		nameRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			proxyStream.CloseSend()
			return nil
		}
		if err != nil {
			logger.Errorw("Failed to read client request", "error", err)
			return err
		}
		loggerWithResource := logger.WithResource(logging.User, nameRequest.Name.Name, logging.NoVariant)
		loggerWithResource.Infow("Getting user from stream")
		nameRequest.RequestId = requestID.String()

		sErr := proxyStream.Send(nameRequest)
		if sErr != nil {
			loggerWithResource.Errorw("Failed to send user to the server", "error", sErr)
			return sErr
		}
		res, err := proxyStream.Recv()
		if err != nil {
			loggerWithResource.Errorw("Failed to receive users from server", "error", err)
			return err
		}
		sendErr := stream.Send(res)
		if sendErr != nil {
			loggerWithResource.Errorw("Failed to send users to client", "error", sendErr)
			return sendErr
		}
	}
}

// rpc GetFeatures(stream Name) returns (stream Feature);
// - Anyone can get
func (serv *MetadataServer) GetFeatures(stream pb.Api_GetFeaturesServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Features")
	proxyStream, err := serv.meta.GetFeatures(ctx)
	if err != nil {
		logger.Errorw("Failed to get features from server", "error", err)
		return err
	}
	for {
		nameRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			proxyStream.CloseSend()
			return nil
		}
		if err != nil {
			logger.Errorw("Failed to read client request", "error", err)
			return err
		}
		loggerWithResource := logger.WithResource(logging.Feature, nameRequest.Name.Name, logging.NoVariant)
		loggerWithResource.Infow("Getting feature from stream")
		nameRequest.RequestId = requestID.String()
		sErr := proxyStream.Send(nameRequest)
		if sErr != nil {
			loggerWithResource.Errorw("Failed to send feature to the server", "error", sErr)
			return sErr
		}
		res, err := proxyStream.Recv()
		if err != nil {
			loggerWithResource.Errorw("Failed to receive features from server", "error", err)
			return err
		}
		sendErr := stream.Send(res)
		if sendErr != nil {
			loggerWithResource.Errorw("Failed to send features to client", "error", sendErr)
			return sendErr
		}
	}
}

// rpc GetFeatureVariants(stream NameVariant) returns (stream FeatureVariant);
// - Anyone can get
func (serv *MetadataServer) GetFeatureVariants(stream pb.Api_GetFeatureVariantsServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Feature Variants")
	proxyStream, err := serv.meta.GetFeatureVariants(ctx)
	if err != nil {
		logger.Errorw("Failed to get feature variants from server", "error", err)
		return err
	}
	for {
		nameVariantRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			proxyStream.CloseSend()
			return nil
		}
		if err != nil {
			logger.Errorw("Failed to read client request", "error", err)
			return err
		}
		loggerWithResource := logger.WithResource(logging.Feature, nameVariantRequest.NameVariant.Name, nameVariantRequest.NameVariant.Variant)
		loggerWithResource.Infow("Getting feature variant from stream")
		nameVariantRequest.RequestId = requestID.String()

		sErr := proxyStream.Send(nameVariantRequest)
		if sErr != nil {
			loggerWithResource.Errorw("Failed to send feature variant to the server", "error", sErr)
			return sErr
		}
		res, err := proxyStream.Recv()
		if err != nil {
			loggerWithResource.Errorw("Failed to receive feature variants from server", "error", err)
			return err
		}
		sendErr := stream.Send(res)
		if sendErr != nil {
			loggerWit
```

### Core Architecture Module: `api/main/main.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package main

import (
	"fmt"

	"github.com/joho/godotenv"

	"github.com/featureform/api"
	"github.com/featureform/health"
	help "github.com/featureform/helpers"
	"github.com/featureform/logging"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		fmt.Printf("could not fetch .env file: %s", err.Error())
	}

	logger := logging.NewLogger("api")
	apiPort := help.GetEnv("API_PORT", "7878")
	logger.Infow("Retrieved API port from ENV", "port", apiPort)
	apiStatusPort := help.GetEnv("API_STATUS_PORT", "8443")
	logger.Infow("Retrieved API status port from ENV", "port", apiStatusPort)
	metadataHost := help.GetEnv("METADATA_HOST", "localhost")
	logger.Infow("Retrieved metadata host from ENV", "host", metadataHost)
	metadataPort := help.GetEnv("METADATA_PORT", "8080")
	logger.Infow("Retrieved metadata port from ENV", "port", metadataPort)
	servingHost := help.GetEnv("SERVING_HOST", "localhost")
	logger.Infow("Retrieved serving host from ENV", "host", servingHost)
	servingPort := help.GetEnv("SERVING_PORT", "8080")
	logger.Infow("Retrieved serving port from ENV", "port", servingPort)
	skipFeatureServing := help.GetEnvBool("SKIP_FEATURE_SERVING", false)
	logger.Infow("Should skip feature serving?", "bool", skipFeatureServing)
	apiConn := fmt.Sprintf("0.0.0.0:%s", apiPort)
	metadataConn := fmt.Sprintf("%s:%s", metadataHost, metadataPort)
	servingConn := fmt.Sprintf("%s:%s", servingHost, servingPort)
	if skipFeatureServing {
		servingConn = ""
	}

	if err := health.StartHttpServer(logger, apiStatusPort); err != nil {
		logger.Errorw("Error starting health check HTTP server", "error", err)
		panic(fmt.Sprintf("health check HTTP server failed: %+v", err))
	}

	serv, err := api.NewApiServer(logger, apiConn, metadataConn, servingConn)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(serv.Serve())
}

```

### Core Architecture Module: `benchmark/data_generator.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

import datetime
import pyarrow as pa
import pyarrow.parquet as pq
import pandas as pd
import numpy as np
from pathlib import Path

import csv


def generate_data(num_rows: int, num_features: int, key_space: int) -> pd.DataFrame:
    features = [f"feature_{i}" for i in range(num_features)]
    columns = ["entity", "event_timestamp"] + features
    df = pd.DataFrame(0, index=np.arange(num_rows), columns=columns)
    df["event_timestamp"] = datetime.datetime.utcnow()
    for column in ["entity"] + features:
        df[column] = np.random.randint(1, key_space, num_rows)
    df["entity"] = df["entity"].astype(str)
    return df


if __name__ == "__main__":
    df = generate_data(10**4, 250, 10**4)
    df.to_csv("generated_data.csv", index=False)

```

### Core Architecture Module: `benchmark/register_features.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

import os

import featureform as ff

import dotenv

dotenv.load_dotenv()


# postgres = ff.register_postgres(
#     name="postgres",
#     host="172.17.0.1",
#     user="postgres",
#     database="postgres",
#     password="password",
# )

sf = ff.register_snowflake(
    name="snowflake2",
    username=os.getenv("SNOWFLAKE_USERNAME"),
    password=os.getenv("SNOWFLAKE_PASSWORD"),
    account=os.getenv("SNOWFLAKE_ACCOUNT"),
    organization=os.getenv("SNOWFLAKE_ORG"),
    database="benchmark",
)


table = sf.register_table(name="generated_data", table="generated", variant="v8")

entity = ff.register_entity("entity")

dynamo = ff.register_dynamodb(
    name="dynamodb",
    region="us-east-1",
    access_key=os.getenv("AWS_ACCESS_KEY"),
    secret_key=os.getenv("AWS_SECRET_KEY"),
)


# redis = ff.register_redis(
#     name="redis-quickstart",
#     host="quickstart-redis",  # The internal dns name for redis
#     port=6379,
#     description="A Redis deployment we created for the Featureform quickstart",
# )
features = []
for i in range(100, 251):
    features.append(
        {
            "name": f"feature_{i}",
            "column": f"feature_{i}",
            "type": "int64",
            "variant": "v10",
        }
    )

table.register_resources(
    entity=entity,
    entity_column="entity",
    inference_store=dynamo,
    features=features,
    timestamp_column="event_timestamp",
)

```

### Core Architecture Module: `client/__init__.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

```

### Core Architecture Module: `client/examples/__init__.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

```

### Core Architecture Module: `client/examples/cli.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

# Run in command line with:
# python3 -m featureform examples/cli.py -host <hostname:port>
import featureform as ff


user = ff.register_user("test")
user.make_default_owner()
snowflake = ff.register_snowflake(
    name="snowflake",
    username="username",
    password="password",
    account="account",
    organization="organization",
    database="database",
    schema="schema",
    description="Snowflake",
    team="Featureform Success Team",
)
table = snowflake.register_table(
    name="transaction",
    variant="final",
    table="Transactions",
    description="Transactions file from Kaggle",
)


@snowflake.sql_transformation(
    variant="variant",
)
def transform():
    """Get all transactions over $500"""
    return "SELECT * FROM {{transactions.final}} WHERE amount > 500"


entity = ff.register_entity("user")
redis = ff.register_redis(
    name="redis",
    host="localhost",
    port=1234,
    password="pass",
    db=0,
)

resources = transform.register_resources(
    entity=entity,
    entity_column="abc",
    inference_store=redis,
    features=[
        {"name": "a", "variant": "b", "column": "c", "type": "float32"},
    ],
    labels=[
        {"name": "la", "variant": "lb", "column": "lc", "type": "float32"},
    ],
    timestamp_column="ts",
)

resources.create_training_set(name="ts", variant="v1")

```

### Core Architecture Module: `client/examples/example_dir/quickstart.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

import featureform as ff

ff.set_run("default")
redis = ff.register_redis(
    name="redis-quickstart",
    host="quickstart-redis",  # The internal dns name for redis
    password="password",
    port=6379,
    description="A Redis deployment we created for the Featureform quickstart",
)

postgres = ff.register_postgres(
    name="postgres-quickstart",
    host="quickstart-postgres",  # The internal dns name for postgres
    port="5432",
    user="postgres",
    password="password",
    database="postgres",
    description="A Postgres deployment we created for the Featureform quickstart",
)

transactions = postgres.register_table(
    name="transactions",
    variant="kaggle",
    description="Fraud Dataset From Kaggle",
    table="Transactions",  # This is the table's name in Postgres
)


@postgres.sql_transformation(variant="quickstart")
def average_user_transactions():
    """the average transaction amount for a user"""
    return (
        "SELECT CustomerID as user_id, avg(TransactionAmount) "
        "as avg_transaction_amt from {{transactions.kaggle}} GROUP BY user_id"
    )


user = ff.register_entity("user")

average_user_transactions.register_resources(
    entity=user,
    entity_column="user_id",
    inference_store=redis,
    features=[
        {
            "name": "avg_transaction",
            "variant": "quickstart",
            "column": "avg_transaction_amt",
            "type": "float32",
        },
    ],
)

# Register label from our base Transactions table
transactions.register_resources(
    entity=user,
    entity_column="customerid",
    labels=[
        {
            "name": "fraudulent",
            "variant": "quickstart",
            "column": "isfraud",
            "type": "bool",
        },
    ],
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1576** (2025-09-19): **[Bug]: Invalid JSON error when specifying S3 output location in Spark Provider**
  *Symptoms*: ### Expected Behavior  I am currently setting up a Featureform environment for my team. I have deployed the featureformcom/featureform:0.14.0 container as an all-in-one service and installed the necessary Spark-related packages, as I require Spark as the backend.  ### Actual Behavior  After installing all the services and configuring the backend, I encountered the error `Invalid JSON: outputLocation:s3a://test-bucket/dev/featureform/HealthCheck/health_check_out`  Based on the error message, it seems that when Featureform executes offline_store_spark_runner.py, there is an issue with the provided input. The system expects a JSON-formatted string, but the actual input does not meet this expectation  ### Steps To Reproduce  The custom featureform docker image is: ``` FROM featureformcom/featureform:0.14.0  RUN apt update && apt install -y build-essential libssl-dev zlib1g-dev \ libbz2-dev libreadline-dev libsqlite3-dev curl git \ libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev  RUN curl https://pyenv.run | bash  ENV PYENV_ROOT /root/.pyenv ENV PATH $PYENV_ROOT/bin:$PATH  RUN bash -c 'eval "$(pyenv init --path)" && \     eval "$(pyenv init -)" && \     pyenv install 3.8.16 && \     pyenv global 3.8.16'  RUN apt-get update && apt-get install -y default-jdk  ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ENV PATH=$PATH:$JAVA_HOME/bin  RUN bash -c 'eval "$(pyenv init --path)" && \     eval "$(pyenv init -)" && \     pip install pyspark==3.4.0'  `
  **Post-Mortem & Fix Analysis**:
  > @ff-kamal  could you take a look at this
  > Taking a look.
  > @ff-kamal Thanks for your help. Do you need any additional information?

- **Issue #1558** (2025-09-19): **[Bug]: Confusing helm chart configuration**
  *Symptoms*: ### Expected Behavior  Hi, I recently tried to install featureform using a helm chart, but I encountered quite a few problems during the installation. Here are the commands I used for the installation:  ```bash helm upgrade --install featureform featureform/featureform \ --namespace featureform \ --create-namespace \ --set repository=featureformcom \ --set nginx.enabled=false \ --set cert.publicCert=false \ --set cert.selfSignedCert=false \ --set cert.letsencryptProd=false \ --set logging.enabled=false \ --set psql.createSecret=true \ ```    ### Actual Behavior  The first problem I encountered is that the chart's repository is featureformenterprise, but most of the images are in the featureformcom repo. When I set `--set repository=featureformcom`, most of the pods can be successfully created, except for search-loader; this pod is still in the featureformenterprise repo. The second issue is that PostgreSQL seems to be necessary for the featureform service, but this isn't specifically mentioned in the documentation.  ### Steps To Reproduce  ```bash helm upgrade --install featureform featureform/featureform \ --namespace featureform \ --create-namespace \ --set repository=featureformcom \ --set nginx.enabled=false \ --set cert.publicCert=false \ --set cert.selfSignedCert=false \ --set cert.letsencryptProd=false \ --set logging.enabled=false \ --set psql.createSecret=true \ ```  ### What mode are you running Featureform in?  Hosted  ### What version of Python are you running?  3
  **Post-Mortem & Fix Analysis**:
  > Good catch, we're actually in the midst of moving this over and the code changed before the docs. Let me get you an update soon. If you'd like specific help in the short term, feel free to join or slack community for specific help for your deployment.
  > @simba-git  Thanks for for your reply.

- **Issue #1543** (2025-01-07): **[Bug]: grpc: error unmarshalling request: string field contains invalid UTF-8**
  *Symptoms*: ### Expected Behavior  Successful application of definitions  ### Actual Behavior  grpc._channel._InactiveRpcError: <_InactiveRpcError of RPC that terminated with:         status = StatusCode.INTERNAL         details = "grpc: error unmarshalling request: string field contains invalid UTF-8"         debug_error_string = "UNKNOWN:Error received from peer  {created_time:"2025-01-07T03:22:45.988764497-05:00", grpc_status:13, grpc_message:"grpc: error unmarshalling request: string field contains invalid UTF-8"}"  ### Steps To Reproduce  featureform apply quickstart/definitions.py --insecure  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.12  ### Featureform Python Package Version  1.14.0  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_
  **Post-Mortem & Fix Analysis**:
  > The issue is resolved, and we have just pushed out a new image, let us know if you run into any further issues.  For the team: The issue was due to the a manual pushing of the `featureformcom/featureform` Docker image without properly tagging it as latest, so an older version of the image was being pulled automatically. This older image had an incompatible protobuf spec as compared to the latest client, which resulted in this error that was thrown above.  Our CI/CD pipeline seems to automatically tags it properly, but it looks like we went with an out-of-band push. We should take proper care in the future to prevent incidents like this.
  > Thank you, @ff-kamal. Appreciate your help.

- **Issue #1495** (2025-01-07): **[Bug]: grpc error when applying definitions.py in local development environment**
  *Symptoms*: ### Expected Behavior  ff should register all providers, sources and transformations  ### Actual Behavior  Getting Error  **grpc._channel._InactiveRpcError: <_InactiveRpcError of RPC that terminated with:         status = StatusCode.INTERNAL         details = "grpc: error unmarshalling request: string field contains invalid UTF-8"         debug_error_string = "UNKNOWN:Error received from peer  {created_time:"2024-09-13T11:40:34.503399+05:30", grpc_status:13, grpc_message:"grpc: error unmarshalling request: string field contains invalid UTF-8"}"**  ### Steps To Reproduce  python -m venv .venv && . .venv/bin/activate ./gen_grpc.sh ./pip_update.sh featureform deploy docker --quickstart featureform apply quickstart/definitions.py --insecure  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.9  ### Featureform Python Package Version  1.12.6  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_
  **Post-Mortem & Fix Analysis**:
  > @NikhilKr872 have you resolved this? Thanks
  > The issue should be resolved, let us know if you run into any more problems.  See #1543 for more context.

- **Issue #1441** (2024-05-08): **[Bug]: Quickstart files return 403**
  *Symptoms*: ### Expected Behavior  Quickstart should enable a quick start of the app.  https://docs.featureform.com/deployment/quickstart-docker  ### Actual Behavior  Quickstart fails to start.  ### Steps To Reproduce  Upon trying to run FeatureForm on Docker using ``` featureform deploy docker --quickstart ```  The quickstart files https://featureform-demo-files.s3.amazonaws.com/definitions.py https://featureform-demo-files.s3.amazonaws.com/serving.py https://featureform-demo-files.s3.amazonaws.com/training.py  Return 403s.  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.10  ### Featureform Python Package Version  1.12.6  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_
  **Post-Mortem & Fix Analysis**:
  > Resolved.

- **Issue #1399** (2024-03-22): **[Bug]: Auth Login is broken**
  *Symptoms*: ### Expected Behavior  The user is able to login using the dashboard.  ### Actual Behavior  When you try to log in via the dashboard, the okta server responds with a failure message suggesting an error with the server configuration.  ### Steps To Reproduce  1. Run a enterprise cluster in k8s. 2. Try to login via the dashboard  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.7  ### Featureform Python Package Version  0.12+  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_

- **Issue #1382** (2024-04-20): **[Bug]: client.dataframe() is extremely slow and doesn't seem to be taking into consideration the limit**
  *Symptoms*: ### Expected Behavior  Should be relatively quick  ### Actual Behavior  Takes too long  ### Steps To Reproduce  client.dataframe(scaled_credit_cards, limit=100) ensure limit is passed through  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.10  ### Featureform Python Package Version  1.12.3-rc1  ### Featureform Helm Chart Version  0.12.3-rc  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_

- **Issue #1365** (2024-03-19): **[Bug]: Can't materialize more than 100k rows/entities from BigQuery to Redis**
  *Symptoms*: ### Expected Behavior  I have over 500k rows/entitites in BQ table, when I succesfully sync them to redis, I expect 500k ids in redis:  ``` 127.0.0.1:6379> HKEYS "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"customer_age\",\"Variant\":\"2024-02-29t09-38-30\"}"  ...  499997) "REDACTED_UID"  499998) "REDACTED_UID"  499999) "REDACTED_UID" 500000) "REDACTED_UID" (2.02s)  ```  ### Actual Behavior  I have over 500k rows/entitites in BQ table, when I succesfully sync them to redis, only 100k of the end up there:  ``` 127.0.0.1:6379> HKEYS "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"customer_age\",\"Variant\":\"2024-02-29t09-38-30\"}"  ...  99997) "REDACTED_UID"  99998) "REDACTED_UID"  99999) "REDACTED_UID" 100000) "REDACTED_UID" (2.02s)  ```  If it is under 100k entitites, everything is fine.  Also the keys look weird in the db.   ``` 127.0.0.1:6379> KEYS * 1) "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"customer_age\",\"Variant\":\"2024-02-29t09-38-30\"}" 2) "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"game_ggr_percent\",\"Variant\":\"2024-02-29t09-28-01\"}" 3) "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"game_ggr_percent\",\"Variant\":\"2024-02-29t09-36-27\"}" 4) "Featureform_table____tables" ```  There's some extra proof in https://featureform-community.slack.com/archives/C02MT18CCAZ/p1709298779194169  ### Steps To Reproduce  - Deploy to GKE with the terraform provided in repo - Register BQ provider  - Re
  **Post-Mortem & Fix Analysis**:
  > Did some further testing and the problem seems to be the coordinator job chunk size which is 100k in jobs larger than 100k. Ie. if you are materializing 1M entities, you get 10 chunks. It seems likely that only one chunk gets actually written to redis.
  > Also, enabling k8s_runner in helm values doesnt resolve this
  > Bug is somewhere around here? https://github.com/featureform/featureform/blob/5accad891059280456dfe44afd129ce42054ee47/provider/bigquery.go#L330  If I look at BigQuery job logs, I see the same query multiple times for the same materialization job `SELECT entity, value, ts FROM (     SELECT *     FROM PROJECT.DATASET.featureform_materialization_FEATURE__VARIANT_NAME      WHERE row_number > 0 AND row_number <= 100000)`  It should probably iterate over DIFFERENT 100K segments. 10 queries per 1M materialization job.

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

### Incident Patch 1: `6805b1cd` (2025-04-24)
**Commit Message**: Bug: Add entity to feature equivalence (#1635)

**File**: `metadata/equivalence/feature_variant.go` (modified, +5/-1)
```diff
@@ -10,16 +10,18 @@ package equivalence
 import (
 	"reflect"
 
+	"github.com/google/go-cmp/cmp"
+
 	"github.com/featureform/fferr"
 	pb "github.com/featureform/metadata/proto"
 	"github.com/featureform/provider/types"
-	"github.com/google/go-cmp/cmp"
 )
 
 type featureVariant struct {
 	Name                    string
 	Provider                string
 	ValueType               types.ValueType
+	Entity                  string
 	ComputationMode         string // TODO move definition from metadata to common
 	Location                featureLocation
 	ResourceSnowflakeConfig resourceSnowflakeConfig
@@ -49,6 +51,7 @@ func FeatureVariantFromProto(proto *pb.FeatureVariant) (featureVariant, error) {
 		Name:                    proto.Name,
 		Provider:                proto.Provider,
 		ValueType:               valueType,
+		Entity:                  proto.Entity,
 		ComputationMode:         proto.Mode.String(),
 		Location:                location,
 		ResourceSnowflakeConfig: resourceSnowflakeConfigFromProto(proto.ResourceSnowflakeConfig),
@@ -66,6 +69,7 @@ func (f featureVariant) IsEquivalent(other Equivalencer) bool {
 			return f1.Name == f2.Name &&
 				f1.Provider == f2.Provider &&
 				f1.ValueType == f2.ValueType &&
+				f1.Entity == f2.Entity &&
 				f1.ComputationMode == f2.ComputationMode &&
 				f1.Location.IsEquivalent(f2.Location) &&
 				reflect.DeepEqual(f1.ResourceSnowflakeConfig, f2.ResourceSnowflakeConfig)
```

**File**: `metadata/equivalence/feature_variant_test.go` (modified, +60/-3)
```diff
@@ -8,11 +8,13 @@
 package equivalence
 
 import (
-	pb "github.com/featureform/metadata/proto"
 	"testing"
 
-	"github.com/featureform/provider/types"
+	pb "github.com/featureform/metadata/proto"
+
 	"github.com/stretchr/testify/assert"
+
+	"github.com/featureform/provider/types"
 )
 
 func TestFeatureVariantIsEquivalent(t *testing.T) {
@@ -29,6 +31,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -40,6 +43,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -49,12 +53,41 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 			},
 			expected: true,
 		},
+		{
+			name: "Different Entity",
+			fv1: featureVariant{
+				Name:            "Feature1",
+				Provider:        "Provider1",
+				ValueType:       types.Int8,
+				Entity:          "user_id",
+				ComputationMode: "Mode1",
+				Location: column{
+					Entity: "Entity1",
+					Value:  "Value1",
+					Ts:     "Timestamp1",
+				},
+			},
+			fv2: featureVariant{
+				Name:            "Feature1",
+				Provider:        "Provider1",
+				ValueType:       types.Int8,
+				Entity:          "customer_id",
+				ComputationMode: "Mode1",
+				Location: column{
+					Entity: "Entity1",
+					Value:  "Value1",
+					Ts:     "Timestamp1",
+				},
+			},
+			expected: false,
+		},
 		{
 			name: "Different Names",
 			fv1: featureVariant{
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -66,6 +99,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature2", // Different Name
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -81,6 +115,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -92,6 +127,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider2", // Different Provider
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -107,6 +143,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -118,6 +155,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int16,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -133,6 +171,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -144,6 +183,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode2",
 				Location: column{
 					Enti
```

---

### Incident Patch 2: `2a8cb469` (2025-04-21)
**Commit Message**: Chore: Remove debug panics (#1629)

**File**: `metadata/client.go` (modified, +3/-3)
```diff
@@ -2773,10 +2773,10 @@ func TrainingSetTypeFromProto(proto pb.TrainingSetType) (TrainingSetType, error)
 	case pb.TrainingSetType_TRAINING_SET_TYPE_VIEW:
 		trainingSetType = ViewTrainingSet
 	case pb.TrainingSetType_TRAINING_SET_TYPE_UNSPECIFIED:
-		logger.DPanic("Training set type unspecified")
+		logger.Error("Training set type unspecified")
 		return trainingSetType, fferr.NewInvalidArgumentErrorf("Training set type unspecified")
 	default:
-		logger.DPanic("Unknown training set type", "proto", proto)
+		logger.Errorw("Unknown training set type", "proto", proto)
 		return trainingSetType, fferr.NewInternalErrorf("Unknown training set type %v", proto)
 	}
 	return trainingSetType, nil
@@ -2792,7 +2792,7 @@ func TrainingSetTypeFromString(trainingSetType string) (TrainingSetType, error)
 	case "VIEW":
 		return ViewTrainingSet, nil
 	default:
-		logger.DPanic("Invalid training set type", "trainingSetType", trainingSetType)
+		logger.Errorw("Invalid training set type", "trainingSetType", trainingSetType)
 		return "", fferr.NewInvalidArgumentErrorf("Invalid training set type %s", trainingSetType)
 	}
 }
```

---

### Incident Patch 3: `070cd454` (2025-04-14)
**Commit Message**: Minor dataset fixes (#1631)

**File**: `provider/clickhouse_test.go` (modified, +0/-6)
```diff
@@ -176,12 +176,6 @@ func (ch *clickHouseOfflineStoreTester) CreateTableFromSchema(loc pl.Location, s
 
 	query := queryBuilder.String()
 	_, err = db.Exec(query)
-	if err != nil {
-		logger.Errorw("error executing query", "query", query, "error", err)
-		return nil, err
-	}
-	// create the table
-	_, err = db.Exec(query)
 	if err != nil {
 		logger.Errorw("error creating table", "error", err)
 		return nil, err
```

**File**: `provider/dataset/sql_dataset.go` (modified, +16/-4)
```diff
@@ -225,21 +225,28 @@ func (it *SqlIterator) Close() error {
 }
 
 func (it *SqlIterator) Next() bool {
-	// Check for context cancellation (optional - depends on whether you need this behavior)
+	// Check for context cancellation
 	select {
 	case <-it.ctx.Done():
 		it.err = it.ctx.Err()
 		it.Close()
 		return false
 	default:
-		// Continue processing
 	}
 
 	if !it.rows.Next() {
 		it.Close()
 		return false
 	}
 
+	if it.scanTargets == nil {
+		it.scanTargets = make([]any, len(it.schema.Fields))
+		for i := range it.scanTargets {
+			var v any
+			it.scanTargets[i] = &v
+		}
+	}
+
 	// Scan row data into scan targets
 	if err := it.rows.Scan(it.scanTargets...); err != nil {
 		it.err = fferr.NewExecutionError("SQL", err)
@@ -252,8 +259,13 @@ func (it *SqlIterator) Next() bool {
 
 	// Convert values according to schema
 	for i, rawPtr := range it.scanTargets {
-		// Extract the value from the pointer
-		val := *(rawPtr.(*any))
+		valPtr, ok := rawPtr.(*any)
+		if !ok {
+			it.err = fferr.NewInternalErrorf("unexpected scan target type at index %d: %T", i, rawPtr)
+			it.Close()
+			return false
+		}
+		val := *valPtr
 
 		nativeType := it.schema.Fields[i].NativeType
 		convertedVal, err := it.converter.ConvertValue(nativeType, val)
```

**File**: `provider/postgres/value_converter.go` (modified, +38/-3)
```diff
@@ -8,6 +8,9 @@
 package postgres
 
 import (
+	"strconv"
+	"strings"
+
 	"github.com/featureform/fferr"
 	types "github.com/featureform/fftypes"
 	"github.com/featureform/logging"
@@ -37,9 +40,12 @@ func (c Converter) GetType(nativeType types.NativeType) (types.ValueType, error)
 
 // ConvertValue converts a value from its PostgreSQL representation to a types.Value
 func (c Converter) ConvertValue(nativeType types.NativeType, value any) (types.Value, error) {
+	// Normalize type name to lowercase
+	normalizedType := strings.ToLower(string(nativeType))
+
 	// Convert the value based on the native type
-	switch nativeType {
-	case "integer":
+	switch normalizedType {
+	case "integer", "int":
 		if value == nil {
 			return types.Value{
 				NativeType: nativeType,
@@ -93,6 +99,35 @@ func (c Converter) ConvertValue(nativeType types.NativeType, value any) (types.V
 			Value:      convertedValue,
 		}, nil
 
+	case "numeric":
+		if value == nil {
+			return types.Value{
+				NativeType: nativeType,
+				Type:       types.Float64,
+				Value:      nil,
+			}, nil
+		}
+		if byteArray, ok := value.([]uint8); ok {
+			floatVal, err := strconv.ParseFloat(string(byteArray), 64)
+			if err != nil {
+				return types.Value{}, err
+			}
+			return types.Value{
+				NativeType: nativeType,
+				Type:       types.Float64,
+				Value:      floatVal,
+			}, nil
+		}
+		convertedValue, err := types.ConvertNumberToFloat64(value)
+		if err != nil {
+			return types.Value{}, err
+		}
+		return types.Value{
+			NativeType: nativeType,
+			Type:       types.Float64,
+			Value:      convertedValue,
+		}, nil
+
 	case "varchar":
 		if value == nil {
 			return types.Value{
@@ -129,7 +164,7 @@ func (c Converter) ConvertValue(nativeType types.NativeType, value any) (types.V
 			Value:      convertedValue,
 		}, nil
 
-	case "timestamp with time zone":
+	case "timestamp with time zone", "timestamptz", "TIMESTAMPTZ":
 		if value == nil {
 			return types.Value{
 				NativeType: nativeType,
```

**File**: `provider/postgres/value_converter_test.go` (modified, +16/-0)
```diff
@@ -32,12 +32,14 @@ func TestConverterGetType(t *testing.T) {
 	}{
 		// Integer types
 		{"integer", "integer", types.Int32, false},
+		{"int", "int", types.Int32, false},
 
 		// Bigint type
 		{"bigint", "bigint", types.Int64, false},
 
 		// Float types
 		{"float8", "float8", types.Float64, false},
+		{"numeric", "numeric", types.Float64, false},
 
 		// String types
 		{"varchar", "varchar", types.String, false},
@@ -47,6 +49,7 @@ func TestConverterGetType(t *testing.T) {
 
 		// Timestamp types
 		{"timestamp with time zone", "timestamp with time zone", types.Timestamp, false},
+		{"timestamptz", "timestamptz", types.Timestamp, false},
 
 		// Unsupported type
 		{"unsupported", "unsupported", nil, true},
@@ -84,6 +87,11 @@ func TestConverterConvertValue(t *testing.T) {
 		{"integer float", "integer", 123.45, types.Value{NativeType: "integer", Type: types.Int32, Value: int32(123)}, false},
 		{"integer string", "integer", "123", types.Value{NativeType: "integer", Type: types.Int32, Value: int32(123)}, false},
 		{"integer invalid", "integer", "abc", types.Value{}, true},
+		{"INT nil", "INT", nil, types.Value{NativeType: "INT", Type: types.Int32, Value: nil}, false},
+		{"INT int", "INT", 123, types.Value{NativeType: "INT", Type: types.Int32, Value: int32(123)}, false},
+		{"INT float", "INT", 123.45, types.Value{NativeType: "INT", Type: types.Int32, Value: int32(123)}, false},
+		{"INT string", "INT", "123", types.Value{NativeType: "INT", Type: types.Int32, Value: int32(123)}, false},
+		{"INT invalid", "INT", "abc", types.Value{}, true},
 
 		// Bigint tests
 		{"bigint nil", "bigint", nil, types.Value{NativeType: "bigint", Type: types.Int64, Value: nil}, false},
@@ -96,6 +104,12 @@ func TestConverterConvertValue(t *testing.T) {
 		{"float8 int", "float8", 123, types.Value{NativeType: "float8", Type: types.Float64, Value: float64(123)}, false},
 		{"float8 string", "float8", "123.45", types.Value{NativeType: "float8", Type: types.Float64, Value: float64(123.45)}, false},
 		{"float8 invalid", "float8", "abc", types.Value{}, true},
+		{"numeric nil", "numeric", nil, types.Value{NativeType: "numeric", Type: types.Float64, Value: nil}, false},
+		{"numeric float", "numeric", 123.45, types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123.45)}, false},
+		{"numeric int", "numeric", 123, types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123)}, false},
+		{"numeric string", "numeric", "123.45", types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123.45)}, false},
+		{"numeric byte array", "numeric", []uint8{49, 50, 51, 46, 52, 53}, types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123.45)}, false},
+		{"numeric invalid", "numeric", "abc", types.Value{}, true},
 
 		// String tests
 		{"varchar nil", "varchar", nil, types.Value{NativeType: "varchar", Type: types.String, Value: nil}, false},
@@ -116,6 +130,8 @@ func TestConverterConvertValue(t *testing.T) {
 		// Timestamp tests
 		{"timestamp with time zone nil", "timestamp with time zone", nil, types.Value{NativeType: "timestamp with time zone", Type: types.Timestamp, Value: nil}, false},
 		{"timestamp with time zone time", "timestamp with time zone", testTime, types.Value{NativeType: "timestamp with time zone", Type: types.Timestamp, Value: testTime}, false},
+		{"timestamptz nil", "timestamptz", nil, types.Value{NativeType: "timestamptz", Type: types.Timestamp, Value: nil}, false},
+		{"timestamptz time", "timestamptz", testTime, types.Value{NativeType: "timestamptz", Type: types.Timestamp, Value: testTime}, false},
 
 		// Unsupported type
 		{"unsupported nil", "unsupported", nil, types.Value{}, true},
```

**File**: `provider/postgres_types_test.go` (modified, +28/-0)
```diff
@@ -80,6 +80,34 @@ func NewPostgresTestData(t *testing.T) TestColumnData {
 					assert.True(t, ok, "timestamp with time zone not converted to time.Time")
 				},
 			},
+			{
+				Name:           "timestamptz_col",
+				NativeType:     "timestamptz",
+				ExpectedGoType: fftypes.Timestamp,
+				TestValue:      formattedTime,
+				VerifyFunc: func(t *testing.T, actual any) {
+					_, ok := actual.(time.Time)
+					assert.True(t, ok, "timestamptz not converted to time.Time")
+				},
+			},
+			{
+				Name:           "numeric_col",
+				NativeType:     "numeric",
+				ExpectedGoType: fftypes.Float64,
+				TestValue:      "123.456",
+				VerifyFunc: func(t *testing.T, actual any) {
+					assert.Equal(t, float64(123.456), actual.(float64), "numeric value mismatch")
+				},
+			},
+			{
+				Name:           "integer_col",
+				NativeType:     "int",
+				ExpectedGoType: fftypes.Int32,
+				TestValue:      int32(42),
+				VerifyFunc: func(t *testing.T, actual any) {
+					assert.Equal(t, int32(42), actual.(int32), "int value mismatch")
+				},
+			},
 		},
 	}
 }
```

---

### Incident Patch 4: `ee384957` (2025-04-11)
**Commit Message**: Fix float conversion for Postgres (#1630)

**File**: `provider/postgres.go` (modified, +13/-0)
```diff
@@ -10,6 +10,7 @@ package provider
 import (
 	"database/sql"
 	"fmt"
+	"strconv"
 	"strings"
 	"text/template"
 	"time"
@@ -268,6 +269,18 @@ func (q postgresSQLQueries) castTableItemType(v interface{}, t interface{}) inte
 	case pgBigInt:
 		return int(v.(int64))
 	case pgFloat:
+		// If the column type is NUMERIC, the SQL interface will return the value as
+		// a []uint8 type. This is the ASCII-formatted value of the float, and is
+		// done because the NUMERIC type has arbitrary precision.
+		if byteArray, ok := v.([]uint8); ok {
+			floatVal, err := strconv.ParseFloat(string(byteArray), 64)
+			if err != nil {
+				return nil
+			}
+			return floatVal
+		}
+
+		// Fall back to the original case for actual float64 values
 		return v.(float64)
 	case pgString:
 		return v.(string)
```

**File**: `provider/postgres_test.go` (modified, +6/-0)
```diff
@@ -112,6 +112,12 @@ func TestPostgresCastTableItemType(t *testing.T) {
 			typeSpec: pgFloat,
 			expected: 3.14,
 		},
+		{
+			name:     "pgFloat numeric type conversion",
+			input:    []uint8{49, 57, 49, 46, 56, 51},
+			typeSpec: pgFloat,
+			expected: 191.83,
+		},
 		{
 			name:     "pgString conversion",
 			input:    "hello",
```

---

### Incident Patch 5: `d6f7a4c3` (2025-04-02)
**Commit Message**: Enterprise port: Fix Pydantic and Pyiceberg version issue (#1625)

**File**: `Dockerfile` (modified, +4/-2)
```diff
@@ -88,10 +88,11 @@ FROM python:3.10 AS streamer-builder
 
 WORKDIR /app/streamer
 
+COPY ./streamer/requirements.txt ./streamer/requirements.txt
 RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
     && rm -rf /var/lib/apt/lists/*
 RUN pip install --break-system-packages --upgrade pip
-RUN pip install --break-system-packages boto3 pyarrow 'pyiceberg[glue]'
+RUN pip install --break-system-packages -r ./streamer/requirements.txt
 
 COPY ./streamer/ /app/streamer/
 
@@ -101,11 +102,12 @@ FROM golang:1.22
 WORKDIR /app
 
 # Install Python for the streamer to work
+COPY ./streamer/requirements.txt ./streamer/requirements.txt
 RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip build-essential \
     && rm -rf /var/lib/apt/lists/*
 
 RUN pip install --break-system-packages --upgrade pip
-RUN pip install --break-system-packages boto3 pyarrow 'pyiceberg[glue]'
+RUN pip install --break-system-packages -r ./streamer/requirements.txt
 
 # Copy the Python virtual environment
 COPY --from=streamer-builder /app/streamer /app/streamer
```

**File**: `pytest-requirements.txt` (modified, +2/-1)
```diff
@@ -8,7 +8,8 @@ google-auth
 google-cloud-core
 google-cloud-storage
 pyspark
-pyiceberg
+pydantic<=2.10.6
+pyiceberg[glue]>=0.9.0
 pytest
 pytest-cov
 pytest-mock
```

**File**: `streamer/Dockerfile` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@ RUN apt-get update && apt-get install -y --no-install-recommends \
 WORKDIR /app
 
 RUN pip install --upgrade pip
-RUN pip install boto3 pyarrow 'pyiceberg[glue]'
+COPY ./streamer/requirements.txt /app/requirements.txt
+RUN pip install -r requirements.txt
 
 ENV PYTHONUNBUFFERED=1
 
```

**File**: `streamer/requirements.txt` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+boto3
+pyarrow
+pydantic<=2.10.6
+pyiceberg[glue]>=0.9.0
\ No newline at end of file
```

---

### Incident Patch 6: `47b8a2bf` (2025-03-03)
**Commit Message**: Hotfix: removes remaining references to Meilisearch (#1861) (#1605)

Co-authored-by: Riddhi Bagadiaa <riddhi@featureform.com>

**File**: `.github/workflows/testing.yml` (modified, +0/-11)
```diff
@@ -145,7 +145,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
@@ -190,13 +189,6 @@ jobs:
       - name: Unit Tests
         run: go test ./... -short
 
-      - name: Install Search Container
-        run: docker pull getmeili/meilisearch:v1.0
-
-      - name: Start Search
-        run: |
-          docker run -d -p $MEILISEARCH_PORT:7700 getmeili/meilisearch:v1.0
-
       - uses: getong/redis-action@v1
         with:
           host port: 6378
@@ -475,7 +467,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
@@ -638,7 +629,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
@@ -803,7 +793,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
```

**File**: `Dockerfile` (modified, +0/-3)
```diff
@@ -121,9 +121,6 @@ RUN curl -sL https://deb.nodesource.com/setup_18.x | sh
 RUN apt-get update
 RUN apt-get install -y nodejs
 
-# Install MeiliSearch
-# RUN curl -L https://install.meilisearch.com | sh
-
 # Install goose for migrations
 RUN go install github.com/pressly/goose/v3/cmd/goose@v3.18.0
 
```

**File**: `charts/featureform/Chart.lock` (modified, +2/-5)
```diff
@@ -2,8 +2,5 @@ dependencies:
 - name: ingress-nginx
   repository: https://kubernetes.github.io/ingress-nginx
   version: 4.1.0
-- name: meilisearch
-  repository: https://meilisearch.github.io/meilisearch-kubernetes
-  version: 0.1.49
-digest: sha256:e92e6d0d55ad21d24ebcbbb3e06ed9a0db26a38f9a8ce0b777656d093480eb06
-generated: "2023-03-04T11:08:43.374076-08:00"
+digest: sha256:c9d0e06078c64e195b2dac589283bbac8070ce54fadbbf8a950812922a1c5e6b
+generated: "2025-02-28T15:24:59.44073-08:00"
```

**File**: `charts/featureform/Chart.yaml` (modified, +0/-4)
```diff
@@ -36,7 +36,3 @@ dependencies:
       - ingress-nginx
     version: 4.1.0
     condition: nginx.enabled
-
-  - name: meilisearch
-    repository: https://meilisearch.github.io/meilisearch-kubernetes
-    version: 0.1.49
```

**File**: `charts/featureform/templates/dashboard-metadata/deployment.yaml` (modified, +0/-6)
```diff
@@ -41,12 +41,6 @@ spec:
               value: {{ .Values.metadata.port | quote }}
             - name: METADATA_HTTP_PORT
               value: {{ .Values.dashboardmetadata.port | quote }}
-            - name: MEILISEARCH_PORT
-              value: {{ .Values.meilisearch.port | quote }}
-            - name: MEILISEARCH_HOST
-              value: {{ .Values.meilisearch.host }}
-            - name: MEILISEARCH_APIKEY
-              value: {{ .Values.meilisearch.apikey | quote }}
             - name: FEATUREFORM_DEBUG_LOGGING
               value: {{ .Values.debug | quote }}
             - name: FEATUREFORM_VERSION
```

---

### Incident Patch 7: `56bce9f4` (2025-03-01)
**Commit Message**: Hotfix: fixes deletion for snowflake and dynamo tables (#1860) (#1604)

**File**: `main/main.go` (modified, +4/-3)
```diff
@@ -153,9 +153,10 @@ func main() {
 	}
 
 	sconfig := coordinator.SchedulerConfig{
-		TaskPollInterval:       1 * time.Second,
-		TaskStatusSyncInterval: 1 * time.Minute,
-		DependencyPollInterval: 1 * time.Second,
+		TaskPollInterval:         1 * time.Second,
+		TaskStatusSyncInterval:   1 * time.Minute,
+		DependencyPollInterval:   1 * time.Second,
+		TaskDistributionInterval: 1,
 	}
 	hostname, err := os.Hostname()
 	if err != nil {
```

**File**: `provider/dynamodb.go` (modified, +29/-2)
```diff
@@ -298,6 +298,24 @@ func (store *dynamodbOnlineStore) getFromMetadataTable(tablename string) (*dynam
 	return tableMeta, nil
 }
 
+func (store *dynamodbOnlineStore) deleteFromMetadataTable(ctx context.Context, tablename string) error {
+	input := &dynamodb.DeleteItemInput{
+		TableName: aws.String(defaultMetadataTableName),
+		Key: map[string]types.AttributeValue{
+			"Tablename": &types.AttributeValueMemberS{
+				Value: tablename,
+			},
+		},
+	}
+	_, err := store.client.DeleteItem(ctx, input)
+	if err != nil {
+		wrappedErr := fferr.NewExecutionError(pt.DynamoDBOnline.String(), err)
+		wrappedErr.AddDetail("tablename", tablename)
+		return wrappedErr
+	}
+	return nil
+}
+
 func formatDynamoTableName(prefix, feature, variant string) string {
 	tablename := fmt.Sprintf("%s__%s__%s", sn.Custom(prefix, "[^a-zA-Z0-9_]"), sn.Custom(feature, "[^a-zA-Z0-9_]"), sn.Custom(variant, "[^a-zA-Z0-9_]"))
 	return sn.Custom(tablename, "[^a-zA-Z0-9_.\\-]")
@@ -359,19 +377,28 @@ func (store *dynamodbOnlineStore) CreateTable(feature, variant string, valueType
 }
 
 func (store *dynamodbOnlineStore) DeleteTable(feature, variant string) error {
+	logger := store.logger.WithResource(logging.FeatureVariant, feature, variant)
+	tableName := formatDynamoTableName(store.prefix, feature, variant)
+	logger.Debugw("Deleting feature table from DynamoDB ...", "tablename", tableName)
 	params := &dynamodb.DeleteTableInput{
-		TableName: aws.String(formatDynamoTableName(store.prefix, feature, variant)),
+		TableName: aws.String(tableName),
 	}
 	_, err := store.client.DeleteTable(context.TODO(), params)
 	if err != nil {
 		var notFoundErr *types.ResourceNotFoundException
 		if errors.As(err, &notFoundErr) {
+			logger.Errorw("Table not found", "err", err)
 			return fferr.NewDatasetNotFoundError(feature, variant, err)
 		} else {
+			logger.Errorw("Failed to delete feature table from DynamoDB", "err", err)
 			return fferr.NewExecutionError(pt.DynamoDBOnline.String(), err)
 		}
 	}
-
+	if err := store.deleteFromMetadataTable(context.TODO(), tableName); err != nil {
+		logger.Errorw("Failed to delete feature table from DynamoDB metadata table", "err", err)
+		return err
+	}
+	logger.Debugw("Successfully deleted feature table from DynamoDB")
 	return nil
 }
 
```

**File**: `provider/snowflake.go` (modified, +45/-13)
```diff
@@ -375,28 +375,60 @@ func (sf *snowflakeOfflineStore) AsOfflineStore() (OfflineStore, error) {
 
 func (sf snowflakeOfflineStore) Delete(location pl.Location) error {
 	logger := sf.logger.With("location", location.Location())
-	if exists, err := sf.sqlOfflineStore.tableExists(location); err != nil {
+
+	logger.Debug("Deleting table ...")
+	sqlLoc, ok := location.(*pl.SQLLocation)
+	if !ok {
+		logger.Errorw("Location is not an SQL location", "location_type", fmt.Sprintf("%T", location))
+		return fferr.NewInternalErrorf("location is not an SQL location")
+	}
+	logger.Debug("Checking if table exists ...")
+	exists, err := sf.sqlOfflineStore.checkExists(sqlLoc)
+	if err != nil {
 		logger.Errorw("Failed to check if table exists", "error", err)
 		return err
-	} else if !exists {
+	}
+	if !exists {
 		logger.Errorw("Table does not exist")
 		return fferr.NewDatasetLocationNotFoundError(location.Location(), nil)
 	}
 
-	sqlLoc, isSqlLoc := location.(*pl.SQLLocation)
-	if !isSqlLoc {
-		logger.Errorw("Location is not an SQL location", "location_type", fmt.Sprintf("%T", location))
-		return fferr.NewInternalErrorf("location is not an SQL location")
+	queries := []string{
+		sf.sfQueries.dropTableQuery(*sqlLoc),
+		sf.sfQueries.dropViewQuery(*sqlLoc),
 	}
 
-	query := sf.sfQueries.dropTableQuery(*sqlLoc)
-	logger.Debugw("Dropping table", "query", query)
-	if _, err := sf.db.Exec(query); err != nil {
-		logger.Errorw("Failed to drop table", "error", err)
-		return sf.handleErr(fferr.NewExecutionError(pt.SnowflakeOffline.String(), err), err)
+	var (
+		dropSuccessful bool
+		errs           []error
+	)
+	logger.Debugw("Running drop queries", "queries", queries)
+	for _, q := range queries {
+		logger.Debugw("Executing drop query", "query", q)
+		if _, err := sf.db.Exec(q); err != nil {
+			logger.Errorw("Failed to execute drop query", "query", q, "error", err)
+			handledErr := sf.handleErr(fferr.NewExecutionError(pt.SnowflakeOffline.String(), err), err)
+			errs = append(errs, handledErr)
+			continue
+		} else {
+			logger.Debugw("Successfully executed drop query", "query", q)
+			dropSuccessful = true
+			break
+		}
 	}
-	logger.Info("Successfully dropped table")
-	return nil
+
+	if dropSuccessful && len(errs) < 2 {
+		logger.Infow("Successfully dropped table", "table", sqlLoc)
+		return nil
+	}
+
+	if len(errs) > 0 {
+		logger.Errorw("Failed to drop table", "errors", errs)
+		return fferr.NewInternalErrorf("failed to drop table")
+	}
+
+	logger.Errorw("Failed to drop table due to unknown errors")
+	return fferr.NewExecutionError(pt.SnowflakeOffline.String(), fmt.Errorf("failed to drop table due to errors"))
 }
 
 // handleErr attempts to add the Snowflake query and session IDs to a wrapped error to aid
```

**File**: `provider/snowflake_queries.go` (modified, +5/-0)
```diff
@@ -121,6 +121,11 @@ func (q snowflakeSQLQueries) dropTableQuery(loc pl.SQLLocation) string {
 	return fmt.Sprintf("DROP TABLE %s", SanitizeSqlLocation(obj))
 }
 
+func (q snowflakeSQLQueries) dropViewQuery(loc pl.SQLLocation) string {
+	obj := loc.TableLocation()
+	return fmt.Sprintf("DROP VIEW %s", SanitizeSqlLocation(obj))
+}
+
 func SanitizeSnowflakeIdentifier(obj pl.FullyQualifiedObject) string {
 	ident := db.Identifier{}
 
```

---

### Incident Patch 8: `effcde3f` (2025-02-28)
**Commit Message**: Bugfix: DynamoDB fails to complete materialization due to throttling errors (#1602)

**File**: `charts/featureform/templates/coordinator/deployment.yaml` (modified, +2/-0)
```diff
@@ -49,6 +49,8 @@ spec:
               value: {{ .Values.k8sRunnerEnable | quote }}
             - name: WORKER_IMAGE
               value: "{{ .Values.repository  }}/worker:{{ .Values.versionOverride | default .Chart.AppVersion }}"
+            - name: MATERIALIZATION_WORKER_POOL_SIZE
+              value: {{ .Values.coordinator.execution.materializationWorkerPoolSize | quote }}
             - name: PANDAS_RUNNER_IMAGE
               value: "{{ .Values.repository | default .Values.repository }}/k8s_runner:{{ .Values.versionOverride | default .Chart.AppVersion }}"
             - name: DEBUG
```

**File**: `charts/featureform/values.yaml` (modified, +1/-0)
```diff
@@ -158,6 +158,7 @@ coordinator:
     taskPollInterval: "1m"
     taskStatusSyncInterval: "1h"
     taskDependencyPollInterval: "1m"
+    materializationWorkerPoolSize: 30
 
 # Configuration for the Dashboard frontend
 dashboard:
```

**File**: `config/config.go` (modified, +4/-0)
```diff
@@ -329,3 +329,7 @@ type FeatureformApp struct {
 	// This will only be set when StateProviderType is PostgresStateProvider
 	Postgres *postgres.Config
 }
+
+func GetMaterializationWorkerPoolSize() int {
+	return helpers.GetEnvInt("MATERIALIZATION_WORKER_POOL_SIZE", 30)
+}
```

**File**: `provider/dynamodb.go` (modified, +87/-74)
```diff
@@ -12,14 +12,14 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
-	"math"
 	"reflect"
 	"strconv"
 	"time"
 
 	pl "github.com/featureform/provider/location"
 
 	"github.com/araddon/dateparse"
+	re "github.com/avast/retry-go/v4"
 	"github.com/aws/aws-sdk-go-v2/aws"
 	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
 	"github.com/aws/aws-sdk-go-v2/aws/retry"
@@ -28,33 +28,29 @@ import (
 	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
 	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
 	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
+	"github.com/aws/smithy-go"
 	"github.com/featureform/fferr"
 	"github.com/featureform/logging"
 	pc "github.com/featureform/provider/provider_config"
 	pt "github.com/featureform/provider/provider_type"
 	se "github.com/featureform/provider/serialization"
 	vt "github.com/featureform/provider/types"
 	sn "github.com/mrz1836/go-sanitize"
-	"go.uber.org/zap"
 )
 
-const defaultMetadataTableName = "FeatureformMetadata"
-
 func init() {
 	if _, ok := serializers[dynamoSerializationVersion]; !ok {
 		panic("Dynamo serializer not implemented")
 	}
 }
 
-const (
-	// Serialization version to use for new tables
-	dynamoSerializationVersion = serializeV1
-)
-
 const (
 	// Default timeout when waiting for dynamoDB tables to be ready
 	defaultDynamoTableTimeout = 30 * time.Second
-	maxRetries                = 5
+	// Serialization version to use for new tables
+	dynamoSerializationVersion = serializeV1
+	defaultMetadataTableName   = "FeatureformMetadata"
+	dynamoDBThrottleErrorCode  = "ThrottlingException"
 )
 
 type dynamodbTableKey struct {
@@ -78,7 +74,7 @@ type dynamodbOnlineStore struct {
 	prefix string
 	BaseProvider
 	timeout            time.Duration
-	logger             *zap.SugaredLogger
+	logger             logging.Logger
 	accessKey          string
 	secretKey          string
 	region             string
@@ -146,6 +142,7 @@ func NewDynamodbOnlineStore(options *pc.DynamodbConfig) (*dynamodbOnlineStore, e
 		config.WithRetryer(func() aws.Retryer {
 			return retry.AddWithMaxBackoffDelay(retry.NewStandard(func(o *retry.StandardOptions) {
 				o.RateLimiter = ratelimit.None
+				o.MaxAttempts = 25
 			}), defaultDynamoTableTimeout)
 		}),
 	}
@@ -179,14 +176,21 @@ func NewDynamodbOnlineStore(options *pc.DynamodbConfig) (*dynamodbOnlineStore, e
 	}
 	logger := logging.NewLogger("dynamodb")
 	tags := toDynamoDBTags(options.Tags)
-	if err := CreateMetadataTable(client, logger.SugaredLogger, tags); err != nil {
+	if err := CreateMetadataTable(client, logger, tags); err != nil {
 		return nil, err
 	}
-	return &dynamodbOnlineStore{client, options.Prefix, BaseProvider{
-		ProviderType:   pt.DynamoDBOnline,
-		ProviderConfig: options.Serialized(),
-	}, defaultDynamoTableTimeout, logger.SugaredLogger,
-		accessKey, secretKey, options.Region, options.StronglyConsistent, tags,
+	return &dynamodbOnlineStore{client, options.Prefix,
+		BaseProvider{
+			ProviderType:   pt.DynamoDBOnline,
+			ProviderConfig: options.Serialized(),
+		},
+		defaultDynamoTableTimeout,
+		logger,
+		accessKey,
+		secretKey,
+		options.Region,
+		options.StronglyConsistent,
+		tags,
 	}, nil
 }
 
@@ -200,7 +204,7 @@ func (store *dynamodbOnlineStore) Close() error {
 }
 
 // TODO(simba) make table name a param
-func CreateMetadataTable(client *dynamodb.Client, logger *zap.SugaredLogger, tags []types.Tag) error {
+func CreateMetadataTable(client *dynamodb.Client, logger logging.Logger, tags []types.Tag) error {
 	tableName := defaultMetadataTableName
 	params := &dynamodb.CreateTableInput{
 		TableName: aws.String(tableName),
@@ -300,12 +304,16 @@ func formatDynamoTableName(prefix, feature, variant string) string {
 }
 
 func (store *dynamodbOnlineStore) GetTable(feature, variant string) (OnlineStoreTable, error) {
+	logger := store.logger.WithResource(logging.FeatureVariant, feature, variant)
 	key := dynamodbTableKey{store.prefix, feature, variant}
+	logger.Debugw("Getting feature table from DynamoDB metadata table ...
```

**File**: `provider/dynamodb_test.go` (modified, +0/-46)
```diff
@@ -359,49 +359,3 @@ func TestFailDeserializeV1(t *testing.T) {
 		})
 	}
 }
-
-func Test_exponentialBackoff(t *testing.T) {
-	maxTime := defaultDynamoTableTimeout
-
-	tests := []struct {
-		name        string
-		attempt     int
-		totalWaited time.Duration
-		wantWait    time.Duration
-		wantTotal   time.Duration
-	}{
-		{
-			name:        "first attempt, no prior wait",
-			attempt:     0,
-			totalWaited: 0,
-			wantWait:    1 * time.Second,
-			wantTotal:   1 * time.Second,
-		},
-		{
-			name:        "second attempt, after 1 second",
-			attempt:     1,
-			totalWaited: 1 * time.Second,
-			wantWait:    2 * time.Second,
-			wantTotal:   3 * time.Second,
-		},
-		{
-			name:        "exceeds default timeout",
-			attempt:     4,
-			totalWaited: maxTime - 1*time.Second,
-			wantWait:    1 * time.Second, // We have 1 second of "room" left before hitting the timeout
-			wantTotal:   maxTime,
-		},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			gotWait, gotTotal := exponentialBackoff(tt.attempt, tt.totalWaited)
-			if gotWait != tt.wantWait {
-				t.Errorf("exponentialBackoff() gotWait = %v, want %v", gotWait, tt.wantWait)
-			}
-			if gotTotal != tt.wantTotal {
-				t.Errorf("exponentialBackoff() gotTotal = %v, want %v", gotTotal, tt.wantTotal)
-			}
-		})
-	}
-}
```

---

### Incident Patch 9: `4f036575` (2025-02-14)
**Commit Message**: Fix Build Workflow (#1591)

**File**: `.github/workflows/publish-docker-images.yml` (modified, +0/-47)
```diff
@@ -103,53 +103,6 @@ jobs:
           cache-from: type=gha
           cache-to: type=gha,mode=max
 
-  backup:
-    name: Build Backup Image
-    environment: Deployment
-    defaults:
-      run:
-        working-directory: ./
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v2
-
-      - name: Set production tag
-        run: ./.github/helpers/set_release_type.sh ${{ inputs.type }} $GITHUB_ENV ${{ inputs.version }}
-
-      - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v2
-        with:
-          cache-from: type=gha
-          cache-to: type=gha,mode=max
-
-      - name: Login to DockerHub
-        uses: docker/login-action@v2
-        with:
-          username: ${{ secrets.DOCKERHUB_USERNAME }}
-          password: ${{ secrets.DOCKERHUB_TOKEN }}
-
-      - name: Build and export pre-release
-        if: ${{ inputs.type == 'pre-release' }}
-        uses: docker/build-push-action@v3
-        with:
-          context: .
-          file: ./backup/Dockerfile
-          tags: featureformcom/backup:${{ env.TAG }}
-          push: true
-          cache-from: type=gha
-          cache-to: type=gha,mode=max
-
-      - name: Build and export release
-        if: ${{ inputs.type == 'release' }}
-        uses: docker/build-push-action@v3
-        with:
-          context: .
-          file: ./backup/Dockerfile
-          tags: featureformcom/backup:${{ env.TAG }},featureformcom/backup:latest
-          push: true
-          cache-from: type=gha
-          cache-to: type=gha,mode=max
-
   coordinator:
     name: Build Coordinator
     environment: Deployment
```

**File**: `api/Dockerfile` (modified, +1/-4)
```diff
@@ -20,12 +20,9 @@ COPY ./storage ./storage
 COPY ./schema ./schema
 COPY ./lib/ ./lib/
 COPY ./filestore/ ./filestore/
-COPY ./metadata/*.go ./metadata/
+COPY ./metadata/ ./metadata/
 COPY ./integrations/ ./integrations/
 COPY ./lib/ ./lib/
-COPY ./metadata/search/ ./metadata/search/
-COPY ./metadata/proto/ ./metadata/proto/
-COPY ./metadata/equivalence/ ./metadata/equivalence/
 COPY ./proto/ ./proto/
 COPY ./helpers/ ./helpers/
 COPY ./logging/ ./logging/
```

**File**: `metadata/Dockerfile` (modified, +2/-6)
```diff
@@ -31,18 +31,14 @@ COPY ./schema ./schema
 COPY ./lib/ ./lib/
 COPY ./filestore/ ./filestore/
 COPY ./logging/ ./logging/
-COPY ./metadata/*.go ./metadata/
-COPY ./metadata/proto/ ./metadata/proto/
+COPY ./metadata/ ./metadata/
 COPY ./db ./db
 COPY ./helpers/ ./helpers/
 COPY ./integrations/ ./integrations/
-COPY ./metadata/search/ ./metadata/search/
-COPY ./metadata/equivalence/ ./metadata/equivalence/
-COPY ./metadata/server/server.go ./metadata/main/server.go
 COPY ./provider/ ./provider
 COPY ./config/ ./config/
 
-RUN go build ./metadata/main/server.go
+RUN go build ./metadata/server/server.go
 
 FROM alpine
 
```

---

### Incident Patch 10: `051dfc28` (2025-02-13)
**Commit Message**: Bugfix: Handle nil when casting tabletype (#1590)

**File**: `provider/sql.go` (modified, +9/-2)
```diff
@@ -20,6 +20,9 @@ import (
 
 	sf "github.com/snowflakedb/gosnowflake"
 
+	"github.com/google/uuid"
+	db "github.com/jackc/pgx/v4"
+
 	"github.com/featureform/fferr"
 	"github.com/featureform/logging"
 	"github.com/featureform/metadata"
@@ -28,8 +31,6 @@ import (
 	ps "github.com/featureform/provider/provider_schema"
 	pt "github.com/featureform/provider/provider_type"
 	"github.com/featureform/provider/types"
-	"github.com/google/uuid"
-	db "github.com/jackc/pgx/v4"
 )
 
 func sanitize(ident string) string {
@@ -1936,6 +1937,12 @@ func (q defaultOfflineSQLQueries) trainingSetUpdate(store *sqlOfflineStore, def
 }
 
 func (q defaultOfflineSQLQueries) castTableItemType(v interface{}, t interface{}) interface{} {
+	logger := logging.GlobalLogger.With("function", "castTableItemType")
+	if v == nil {
+		logger.Debugw("Value is nil")
+		return nil
+	}
+
 	switch t {
 	case sfInt, sfNumber:
 		if intVar, err := strconv.Atoi(v.(string)); err != nil {
```

#### Recent Merged Pull Requests:
- **PR #1639** (2025-05-16): Materialization and Trainingsets to use datasets (@aolfat)
- **PR #1638** (2025-05-16): New native types (@aolfat)
- **PR #1637** (2025-05-15): Move all non-secret env variables to vars (@ghost)
- **PR #1635** (2025-04-24): Bug: Add entity to feature equivalence (@aolfat)
- **PR #1634** (closed): Datasets: Add training Set Iterator (@aolfat)
- **PR #1633** (closed): Add Datasets to Materializations (@aolfat)
- **PR #1632** (2025-04-15): Add rest of primary table adjustments (@aolfat)
- **PR #1631** (2025-04-14): Minor dataset fixes (@aolfat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
