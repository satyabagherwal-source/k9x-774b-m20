# Forensic Learning Record (Deep Inspection): Dataherald/dataherald

> **Canonical Artifact**: `07_PROJECT_LEARNING/dataherald-dataherald-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dataherald/dataherald](https://github.com/Dataherald/dataherald))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:15:21.239Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dataherald/dataherald`
- **Description**: Interact with your SQL database, Natural Language to SQL using LLMs
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3648 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `services/admin-console/src/components/ui/markdown-renderer.tsx`
```
import { FC, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { dracula } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  children: ReactNode
}

const MarkdownRenderer: FC<MarkdownRendererProps> = ({
  children: markdownText,
}) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '')
        if (match) {
          return (
            <SyntaxHighlighter style={dracula} language={match[1]} PreTag="div">
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          )
        } else {
          // Render inline code or code blocks without specified language
          return (
            <code
              style={{
                backgroundColor: '#44475a',
                color: '#f8f8f2',
                padding: '4px',
                margin: '0 1px',
                borderRadius: '0.3em',
                tabSize: 4,
                fontSize: '90%',
                fontFamily:
                  'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                lineHeight: '2',
                textShadow: 'rgba(0, 0, 0, 0.3) 0px 1px',
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </code>
          )
        }
      },
    }}
  >
    {String(markdownText)}
  </ReactMarkdown>
)

export default MarkdownRenderer

```

### Core Architecture Module: `services/admin-console/src/hooks/api/api-keys/useApiKeys.ts`
```
import { API_URL } from '@/config'
import { useAuth } from '@/contexts/auth-context'
import { ApiKeys, ErrorResponse } from '@/models/api'
import useSWR, { KeyedMutator } from 'swr'

interface ApiKeysResponse {
  apiKeys: ApiKeys | undefined
  isLoading: boolean
  isValidating: boolean
  error: ErrorResponse | null
  mutate: KeyedMutator<ApiKeys>
}

const useApiKeys = (): ApiKeysResponse => {
  const endpointUrl = `${API_URL}/keys`
  const { token } = useAuth()
  const { data, isLoading, isValidating, error, mutate } = useSWR<ApiKeys>(
    token ? endpointUrl : null,
  )
  return {
    apiKeys: data,
    isLoading: isLoading || (!data && !error),
    isValidating,
    error,
    mutate,
  }
}

export default useApiKeys

```

### Core Architecture Module: `services/admin-console/src/hooks/api/api-keys/useDeleteApiKey.ts`
```
import { API_URL } from '@/config'
import useDelete from '@/hooks/api/generics/useDelete'

export const useDeleteApiKey = <T = void>() => {
  const deleteApiKey = useDelete<T>()
  return (apiKeyId: string) => deleteApiKey(`${API_URL}/keys/${apiKeyId}`)
}

```

### Core Architecture Module: `services/admin-console/src/hooks/api/api-keys/usePostApiKey.ts`
```
import { API_URL } from '@/config'
import usePost from '@/hooks/api/generics/usePost'
import { ApiKey } from '@/models/api'

type PostApiKeyRequest = { name: string }

export const usePostApiKey = () => {
  const postApiKey = usePost<PostApiKeyRequest, ApiKey>()
  return (resource: PostApiKeyRequest) =>
    postApiKey(`${API_URL}/keys`, resource)
}

```

### Core Architecture Module: `services/admin-console/src/hooks/api/billing/useDeletePaymentMethod.ts`
```
import { API_URL } from '@/config'
import useDelete from '@/hooks/api/generics/useDelete'

type DeletePaymentMethodRequest = { payment_method_id: string }

export const useDeletePaymentMethod = () => {
  const deletePaymentMethod = useDelete<DeletePaymentMethodRequest>()
  return (organizationId: string, paymentMethodId: string) =>
    deletePaymentMethod(
      `${API_URL}/organizations/${organizationId}/invoices/payment-methods/${paymentMethodId}`,
    )
}

```

### Core Architecture Module: `services/admin-console/src/hooks/api/billing/usePaymentMethods.ts`
```
import { API_URL } from '@/config'
import { useAppContext } from '@/contexts/app-context'
import { useAuth } from '@/contexts/auth-context'
import { ErrorResponse, PaymentMethods } from '@/models/api'
import useSWR, { KeyedMutator } from 'swr'

interface PaymentMethodsResponse {
  paymentMethods: PaymentMethods | undefined
  isLoading: boolean
  error: ErrorResponse | null
  mutate: KeyedMutator<PaymentMethods>
}

const usePaymentMethods = (): PaymentMethodsResponse => {
  const { token } = useAuth()
  const { organization } = useAppContext()
  const endpointUrl = `${API_URL}/organizations/${organization?.id}/invoices/payment-methods`
  const { data, isLoading, error, mutate } = useSWR<PaymentMethods>(
    token && organization ? endpointUrl : null,
  )
  return {
    paymentMethods: data,
    isLoading: isLoading || (!data && !error),
    error,
    mutate,
  }
}

export default usePaymentMethods

```

### Core Architecture Module: `services/admin-console/src/hooks/api/billing/usePostPaymentMethod.ts`
```
import { API_URL } from '@/config'
import usePost from '@/hooks/api/generics/usePost'
import { PaymentMethod } from '@/models/api'

type PostPaymentMethodRequest = { payment_method_id: string }

export const usePostPaymentMethod = () => {
  const postPaymentMethod = usePost<PostPaymentMethodRequest, PaymentMethod>()
  return (
    organizationId: string,
    resource: PostPaymentMethodRequest,
    isDefault = true,
  ) => {
    return postPaymentMethod(
      `${API_URL}/organizations/${organizationId}/invoices/payment-methods?default=${isDefault}`,
      resource,
    )
  }
}

```

### Core Architecture Module: `services/admin-console/src/hooks/api/billing/usePutSpendingLimits.ts`
```
import { API_URL } from '@/config'
import usePut from '@/hooks/api/generics/usePut'

type PutLimitsRequest = { spending_limit: number }

const usePutSpendingLimits = () => {
  const putSpendingLimits = usePut<PutLimitsRequest>()
  return (organizationId: string, newLimits: PutLimitsRequest) => {
    return putSpendingLimits(
      `${API_URL}/organizations/${organizationId}/invoices/limits`,
      newLimits,
    )
  }
}

export default usePutSpendingLimits

```

### Core Architecture Module: `services/admin-console/src/hooks/api/billing/useSpendingLimits.tsx`
```
import { API_URL } from '@/config'
import { useAppContext } from '@/contexts/app-context'
import { useAuth } from '@/contexts/auth-context'
import { ErrorResponse, SpendingLimits } from '@/models/api'
import useSWR, { KeyedMutator } from 'swr'

interface SpendingLimitsResponse {
  limits: SpendingLimits | undefined
  isLoading: boolean
  isValidating: boolean
  error: ErrorResponse | null
  mutate: KeyedMutator<SpendingLimits>
}

const useSpendingLimits = (): SpendingLimitsResponse => {
  const { token } = useAuth()
  const { organization } = useAppContext()
  const endpointUrl = `${API_URL}/organizations/${organization?.id}/invoices/limits`
  const { data, isLoading, isValidating, error, mutate } =
    useSWR<SpendingLimits>(token && organization ? endpointUrl : null)
  return {
    limits: data,
    isLoading: isLoading || (!data && !error),
    isValidating,
    error,
    mutate,
  }
}

export default useSpendingLimits

```

### Core Architecture Module: `services/admin-console/src/hooks/api/billing/useUsage.tsx`
```
import { API_URL } from '@/config'
import { useAppContext } from '@/contexts/app-context'
import { useAuth } from '@/contexts/auth-context'
import { ErrorResponse, Usage } from '@/models/api'
import useSWR, { KeyedMutator } from 'swr'

interface UsageResponse {
  usage: Usage | undefined
  isLoading: boolean
  isValidating: boolean
  error: ErrorResponse | null
  mutate: KeyedMutator<Usage>
}

const useUsage = (): UsageResponse => {
  const { token } = useAuth()
  const { organization } = useAppContext()
  const endpointUrl = `${API_URL}/organizations/${organization?.id}/invoices/pending`
  const { data, isLoading, isValidating, error, mutate } = useSWR<Usage>(
    token && organization ? endpointUrl : null,
    { refreshInterval: 10000, errorRetryCount: 3 },
  )
  return {
    usage: data,
    isLoading: isLoading || (!data && !error),
    isValidating,
    error,
    mutate,
  }
}

export default useUsage

```

### Core Architecture Module: `services/admin-console/src/hooks/api/database-connection/useDatabaseConnection.ts`
```
import { API_URL } from '@/config'
import { useAuth } from '@/contexts/auth-context'
import { DatabaseConnection, ErrorResponse } from '@/models/api'
import useSWR from 'swr'

interface DatabaseConnectionResponse {
  databaseConnection: DatabaseConnection | undefined
  isLoading: boolean
  error: ErrorResponse | null
}

const useDatabaseConnection = (
  databaseConnectionId?: string,
): DatabaseConnectionResponse => {
  const endpointUrl = `${API_URL}/database-connections/${databaseConnectionId}`
  const { token } = useAuth()
  const { data, isLoading, error } = useSWR<DatabaseConnection>(
    token ? endpointUrl : null,
  )

  return {
    databaseConnection: data,
    isLoading: isLoading || (!data && !error),
    error,
  }
}

export default useDatabaseConnection

```

### Core Architecture Module: `services/admin-console/src/hooks/api/database-connection/useDatabaseConnections.ts`
```
import { API_URL } from '@/config'
import { useAuth } from '@/contexts/auth-context'
import { DatabaseConnections, ErrorResponse } from '@/models/api'
import useSWR from 'swr'

interface DatabaseConnectionResponse {
  dbConnections: DatabaseConnections | undefined
  isLoading: boolean
  error: ErrorResponse | null
}

const useDatabaseConnections = (): DatabaseConnectionResponse => {
  const endpointUrl = `${API_URL}/database-connections`
  const { token } = useAuth()
  const { data, isLoading, error } = useSWR<DatabaseConnections>(
    token ? endpointUrl : null,
  )

  return {
    dbConnections: data,
    isLoading: isLoading || (!data && !error),
    error,
  }
}

export default useDatabaseConnections

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #519** (2024-07-11): **Add documentation for environment variables of engine.**
  *Symptoms*: - Added detailed documentation for all the environment variables of engine in envars.rst.  - Modified README.md to include embedding model variable.  - Corrected some typos in .env.example. 
  **Post-Mortem & Fix Analysis**:
  > @aazo11 

- **Issue #516** (2024-06-24): **Added new environment variable for taking the embedding model in engine.**
  *Symptoms*: Added a new environment variable in .env.example file of engine named "EMBEDDING_MODEL" for including the name for embedding model used. If you are using OpenAI, you may enter the value as:  "EMBEDDING_MODEL"="text-embedding-3-large"  or you may comment the variable. If you are using Azure, you may add the name of your text embedding model to this environment variable.  "EMBEDDING_MODEL"="your_embedding_model"

- **Issue #515** (2024-06-24): **fix sorting table relevance scores**
  *Symptoms*: This fixes sorting table relevance scores in the output.  Previously: ``` engine   | Action: DbTablesWithRelevanceScores engine   | Action Input: what is the total number of albums engine   | Observation: Table: `main.media_types`, relevance score: 0.0771 engine   | Table: `main.customers`, relevance score: 0.0827 engine   | Table: `main.employees`, relevance score: 0.1003 engine   | Table: `main.invoices`, relevance score: 0.1282 engine   | Table: `main.invoice_items`, relevance score: 0.1407 engine   | Table: `main.genres`, relevance score: 0.1568 ```  Now: ``` engine   | Action: DbTablesWithRelevanceScores engine   | Action Input: what is the total number of albums engine   | Observation: Table: `main.albums`, relevance score: 0.3576 engine   | Table: `main.artists`, relevance score: 0.2226 engine   | Table: `main.playlist_track`, relevance score: 0.1908 engine   | Table: `main.playlists`, relevance score: 0.1676 engine   | Table: `main.genres`, relevance score: 0.1568 ```
  **Post-Mortem & Fix Analysis**:
  > The tests that run are green. So I am not making things worse ;-)  Resolving the warnings about test classes having `__init__` contructors should be addressed in another PR.   ``` docker-compose exec engine pytest ================================================================== test session starts =================================================================== platform linux -- Python 3.11.4, pytest-7.4.0, pluggy-1.5.0 rootdir: /app configfile: pyproject.toml plugins: anyio-4.4.0, dotenv-0.5.2 collected 1 item  dataherald/tests/test_api.py .                                                                                                                     [100%]  ==================================================================== warnings summary ==================================================================== ../usr/local/lib/python3.11/site-packages/httpx/_client.py:680   /usr/local/lib/python3.11/site-packages/httpx/_client.py:680: DeprecationWarning: The

- **Issue #511** (2024-06-23): **Fix typo in enterprise service's example .env file**
  *Symptoms*: Change `AUTH0_DISABED` to `AUTH0_DISABLED`

- **Issue #510** (2024-07-24): **Bump langchain-community from 0.0.25 to 0.2.5 in /services/engine**
  *Symptoms*: Bumps [langchain-community](https://github.com/langchain-ai/langchain) from 0.0.25 to 0.2.5. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/langchain-ai/langchain/releases">langchain-community's releases</a>.</em></p> <blockquote> <h2>langchain-community==0.2.5</h2> <h1>Release langchain-community==0.2.5</h1> <p>Changes since langchain-community==0.2.4</p> <p>community: release 0.2.5 (<a href="https://redirect.github.com/langchain-ai/langchain/issues/22923">#22923</a>) docs: Fix wrongly referenced class name in confluence.py (<a href="https://redirect.github.com/langchain-ai/langchain/issues/22879">#22879</a>) community[minor]: Fix long_context_reorder.py async (<a href="https://redirect.github.com/langchain-ai/langchain/issues/22839">#22839</a>) community[major], experimental[patch]: Remove Python REPL from community (<a href="https://redirect.github.com/langchain-ai/langchain/issues/22904">#22904</a>) community[patch]: SitemapLoader restrict depth of parsing sitemap (CVE-2024-2965) (<a href="https://redirect.github.com/langchain-ai/langchain/issues/22903">#22903</a>) core[patch]: fix validation of <a href="https://github.com/deprecated"><code>@​deprecated</code></a> decorator (<a href="https://redirect.github.com/langchain-ai/langchain/issues/22513">#22513</a>) [Community]: HuggingFaceCrossEncoder <code>score</code> accounting for <!-- raw HTML omitted --> pairs. (<a href="https://redirect.github.com/langchain-ai/langchain/issues/
  **Post-Mortem & Fix Analysis**:
  > Superseded by #521.

- **Issue #509** (2024-06-09): **WIP add a new semantic_layer_agent**
  *Symptoms*: 

- **Issue #508** (2024-06-24): **Update .env.example**
  *Symptoms*: 

- **Issue #507** (2024-06-08): **Fix regression in s3.py**
  *Symptoms*: 

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

### Incident Patch 1: `f3cb5051` (2024-06-24)
**Commit Message**: fix sorting table relevance scores (#515)

**File**: `services/engine/dataherald/sql_generator/dataherald_sqlagent.py` (modified, +2/-2)
```diff
@@ -294,8 +294,8 @@ def _run(  # noqa: PLR0912
         df["similarities"] = df.table_embedding.apply(
             lambda x: self.cosine_similarity(x, question_embedding)
         )
-        df = df.sort_values(by="similarities", ascending=True)
-        df = df.tail(TOP_TABLES)
+        df = df.sort_values(by="similarities", ascending=False)
+        df = df.head(TOP_TABLES)
         most_similar_tables = self.similar_tables_based_on_few_shot_examples(df)
         table_relevance = ""
         for _, row in df.iterrows():
```

---

### Incident Patch 2: `7fcd9e82` (2024-06-23)
**Commit Message**: Fix typo in example .env file (#511)

**File**: `services/enterprise/.env.example` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ AUTH0_ISSUER_BASE_URL= # your auth0 issuer url, i.e.: https://auth.dataherald.co
 AUTH0_API_AUDIENCE= # your auth0 API audience, i.e.: https://dataherald.us.auth0.com/api/v2/
 # AUTH0_DISABLED creates a mock authentication token type for testing purposes
 # you can provide an email as the bearer token, note that the admin console will not be able to authenticate
-AUTH0_DISABED=False
+AUTH0_DISABLED=False
 
 # The salt is used to hash the API key, use the string from ENCRYPT_KEY or create a different one
 API_KEY_SALT=
```

**File**: `services/enterprise/README.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ To connect to Auth0 you will need to fill in the following environment variables
 AUTH0_DOMAIN=
 AUTH0_ISSUER_BASE_URL=
 AUTH0_API_AUDIENCE=
-AUTH0_DISABED=False
+AUTH0_DISABLED=False
 ```
 
 Please, read the front-end docs about Auth0 [here](../admin-console/README.md#setting-up-an-auth0-application) if you have troubles setting this up.
```

---

### Incident Patch 3: `f0ee3490` (2024-06-08)
**Commit Message**: Fix regression in s3.py (#507)

**File**: `services/engine/dataherald/utils/s3.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ class S3:
     def __init__(self):
         self.settings = Settings()
 
-    def _get_client(self, access_key: str | None = None, secret_access_key: str | None = None, region: str | None = None): -> boto3.client:
+    def _get_client(self, access_key: str | None = None, secret_access_key: str | None = None, region: str | None = None) -> boto3.client:
         _access_key = access_key or self.settings.s3_aws_access_key_id
         _secret_access_key = secret_access_key or self.settings.s3_aws_secret_access_key
         _region = region or self.settings.s3_region
```

---

### Incident Patch 4: `6a4ccd86` (2024-05-28)
**Commit Message**: fix: update agent_prompts.py (#496)

existance -> existence

**File**: `services/engine/dataherald/utils/agent_prompts.py` (modified, +4/-4)
```diff
@@ -27,7 +27,7 @@
 tip3) Always call the GetAdminInstructions tool before generating the SQL query, it will give you rules to follow when writing the SQL query.
 tip4) The Question/SQL pairs are labelled as correct pairs, so you can use them to answer the question and execute the query to make sure it is correct.
 tip5) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
-tip6) The existance of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
+tip6) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
 tip7) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
 """  # noqa: E501
 
@@ -43,7 +43,7 @@
 tip1) After executing the query, if the SQL query resulted in errors or not correct results, rewrite the SQL query and try again.
 tip2) Always call the GetAdminInstructions tool before generating the SQL query, it will give you rules to follow when writing the SQL query.
 tip3) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
-tip4) The existance of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
+tip4) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
 tip5) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
 """  # noqa: E501
 
@@ -60,7 +60,7 @@
 tip2) After executing the query, if the SQL query resulted in errors or not correct results, rewrite the SQL query and try again.
 tip3) The Question/SQL pairs are labelled as correct pairs, so you can use them to answer the question and execute the query to make sure it is correct.
 tip4) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
-tip5) The existance of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
+tip5) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
 tip6) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
 """  # noqa: E501
 
@@ -74,7 +74,7 @@
 Some tips to always keep in mind:
 tip1) If the SQL query resulted in errors or not correct results, rewrite the SQL query and try again.
 tip2) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
-tip3) The existance of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
+tip3) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
 tip4) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
 """  # noqa: E501
 
```

---

### Incident Patch 5: `d1617e3f` (2024-05-27)
**Commit Message**: Fix stripe disabled functions for organization creation (#502)

**File**: `services/enterprise/modules/organization/invoice/controller.py` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@
 from utils.auth import Authorize, User, authenticate_user
 
 
-def check_stripe_disabled(request: Request):
+def is_stripe_disabled(request: Request):
     if invoice_settings.stripe_disabled:
         raise StripeDisabledError()
     return request
@@ -28,7 +28,7 @@ def check_stripe_disabled(request: Request):
 router = APIRouter(
     prefix="/organizations",
     responses={404: {"description": "Not found"}},
-    dependencies=[Depends(check_stripe_disabled)],
+    dependencies=[Depends(is_stripe_disabled)],
 )
 
 authorize = Authorize()
```

**File**: `services/enterprise/modules/organization/invoice/models/entities.py` (modified, +11/-0)
```diff
@@ -70,3 +70,14 @@ class UsageInvoice(BaseModel):
     sql_generation_cost: int = 0
     finetuning_gpt_35_cost: int = 0
     finetuning_gpt_4_cost: int = 0
+
+
+class MockStripeCustomer(BaseModel):
+    id: str | None = None
+    name: str | None = None
+
+
+class MockStripeSubscription(BaseModel):
+    id: str | None = None
+    status: str | None = None
+    billing_cycle_anchor: int | None = None
```

**File**: `services/enterprise/modules/organization/service.py` (modified, +14/-4)
```diff
@@ -4,6 +4,8 @@
 from modules.organization.invoice.models.entities import (
     Credit,
     InvoiceDetails,
+    MockStripeCustomer,
+    MockStripeSubscription,
     PaymentPlan,
     RecordStatus,
 )
@@ -62,8 +64,12 @@ def add_organization(
             )
         organization = Organization(**org_request.dict())
 
-        customer = self.billing.create_customer(organization.name)
-        subscription = self.billing.create_subscription(customer.id)
+        if invoice_settings.stripe_disabled:
+            customer = MockStripeCustomer()
+            subscription = MockStripeSubscription()
+        else:
+            customer = self.billing.create_customer(organization.name)
+            subscription = self.billing.create_subscription(customer.id)
         # default organization plan is CREDIT_ONLY
         organization.invoice_details = InvoiceDetails(
             plan=PaymentPlan.CREDIT_ONLY,
@@ -161,8 +167,12 @@ def add_organization_by_slack_installation(
             owner=slack_installation_request.user.id,
         )
 
-        customer = self.billing.create_customer(organization.name)
-        subscription = self.billing.create_subscription(customer.id)
+        if invoice_settings.stripe_disabled:
+            customer = MockStripeCustomer()
+            subscription = MockStripeSubscription()
+        else:
+            customer = self.billing.create_customer(organization.name)
+            subscription = self.billing.create_subscription(customer.id)
         organization.invoice_details = InvoiceDetails(
             plan=PaymentPlan.CREDIT_ONLY,
             stripe_customer_id=customer.id,
```

---

### Incident Patch 6: `5b7dacd9` (2024-05-20)
**Commit Message**: add docker run for the entire app + fix env var and container naming

* add script to run docker containers under the same network and project

* add env var example for docker containers

* update engine url env var name

* Update .env.example

* Update .env.example

* Delete services/enterprise/.test.env

* Deleted database info

* final updates and fixes to env vars and docker compose local development

---------

Co-authored-by: Juan Valacco <[REDACTED_EMAIL]>
Co-authored-by: Dishen <[REDACTED_EMAIL]>
Co-authored-by: dishenwang2023 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +17/-1)
```diff
@@ -34,10 +34,26 @@ This repository contains four components under `/services` which can be used tog
 1. Engine: The core natural language-to-SQL engine. If you would like to use the dataherald API without users or authentication, running the engine will suffice.
 2. Enterprise: The application API layer which adds authentication, organizations and users, and other business logic to Dataherald. 
 3. Admin-console: The front-end component of Dataherald which allows a GUI for configuration and observability. You will need to run both engine and enterprise for the admin-console to work.
-4. Slack: A slackbot which allows users from a slack channel to interact with dataherald. Requires both engine and enterprise to run.
+4. Slackbot: A slackbot which allows users from a slack channel to interact with dataherald. Requires both engine and enterprise to run.
 
 For more information on each component, please take a look at their `README.md` files.
 
+## Running locally
+
+Each component in the `/services` directory has its own `docker-compose.yml` file. To set up the environment, follow these steps:
+
+1. **Set Environment Variables**:
+   Each service requires specific environment variables. Refer to the `.env.example` file in each service directory and create a `.env` file with the necessary values. 
+   > For the Next.js front-end app is `.env.local`
+2. **Run Services**:
+   You can run all the services using a single script located in the root directory. This script creates a common Docker network and runs each service in detached mode.
+
+Run the script to start all services:
+
+```bash
+sh docker-run.sh
+```
+
 ## Contributing
 As an open-source project in a rapidly developing field, we are open to contributions, whether it be in the form of a new feature, improved infrastructure, or better documentation.
 
```

**File**: `docker-run.sh` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+#!/bin/bash
+
+# Create Docker network
+docker network create dataherald_network
+
+# Bring up services with Docker Compose
+docker-compose -p dataherald -f services/engine/docker-compose.yml up --build -d
+docker-compose -p dataherald -f services/enterprise/docker-compose.yml up --build -d
+docker-compose -p dataherald -f services/slackbot/docker-compose.yml up --build -d
+docker-compose -p dataherald -f services/admin-console/docker-compose.yml up --build -d
\ No newline at end of file
```

**File**: `services/admin-console/.env.example` (modified, +4/-3)
```diff
@@ -1,21 +1,22 @@
 NODE_ENV="development" # development | production
 
 # API URL
-NEXT_PUBLIC_API_URL=
+NEXT_PUBLIC_API_URL='http://localhost:3001'
 
 # AUTH 0 CONFIG
 AUTH0_BASE_URL='http://localhost:3000'
 AUTH0_SCOPE='openid profile email offline_access'
 AUTH0_SECRET='use [openssl rand -hex 32] to generate a 32 bytes value'
-AUTH0_ISSUER_BASE_URL='https://{yourDomain}'
+AUTH0_ISSUER_BASE_URL='{yourIssuer}'
 AUTH0_API_AUDIENCE='{yourAudience}'
 AUTH0_CLIENT_ID='{yourClientId}'
 AUTH0_CLIENT_SECRET='{yourClientSecret}'
 
 # (OPTIONAL) Posthog Analytics 
+NEXT_PUBLIC_POSTHOG_DISABLED='true'
 NEXT_PUBLIC_POSTHOG_KEY=
 NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
 
 
 # (OPTIONAL) STRIPE
-NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
\ No newline at end of file
+NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

**File**: `services/admin-console/dev.Dockerfile` (modified, +6/-0)
```diff
@@ -1,5 +1,7 @@
 FROM node:18-alpine
 
+LABEL Author="Juan Sebastian Valacco"
+
 WORKDIR /app
 
 # Install dependencies based on the preferred package manager
@@ -12,6 +14,10 @@ COPY . .
 # Uncomment the following line to disable telemetry at run time
 ENV NEXT_TELEMETRY_DISABLED 1
 
+# Docker network URL for the API -- used for nextjs server side API calls inside the docker network
+# The browser needs to access the API from the exposed port in the docker host (i.e.: localhost:3001)
+ENV DOCKER_API_URL='http://api:3001' 
+
 # Note: Don't expose ports here, Compose will handle that for us
 
 # Start Next.js in development mode based on the preferred package manager
```

**File**: `services/admin-console/docker-compose.yml` (modified, +7/-2)
```diff
@@ -1,6 +1,6 @@
 services:
   next-app:
-    container_name: next-app
+    container_name: console
     build:
       context: .
       dockerfile: dev.Dockerfile
@@ -9,6 +9,11 @@ services:
     volumes:
       - ./src:/app/src
       - ./public:/app/public
-    restart: always
     ports:
       - 3000:3000
+    restart: always
+    networks:
+      - dataherald_network
+networks:
+  dataherald_network:
+    external: true
```

**File**: `services/admin-console/prod.Dockerfile` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 FROM --platform=linux/amd64 node:18-alpine AS base
 
+LABEL Author="Juan Sebastian Valacco"
+
 # Install dependencies only when needed
 FROM base AS deps
 # Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
```

**File**: `services/admin-console/src/config.ts` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
-export const API_URL = process.env.NEXT_PUBLIC_API_URL
+const isServer = typeof window === 'undefined';
+export const API_URL = isServer ? process.env.DOCKER_API_URL || process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL;
 export const AUTH = {
   hostname: process.env.AUTH0_BASE_URL,
   cliendId: process.env.AUTH0_CLIENT_ID,
```

**File**: `services/engine/README.md` (modified, +2/-2)
```diff
@@ -123,7 +123,7 @@ Fernet.generate_key()
 >We need to set it up externally to enable external clients running on docker to communicate with this app. 
 Run the following command:
 ```
-docker network create backendnetwork
+docker network create dataherald_network
 ```
 
 4. Build docker images, create containers and raise them. This will raise the app and mongo container
@@ -140,7 +140,7 @@ It should look like this:
 ```
 CONTAINER ID   IMAGE            COMMAND                  CREATED         STATUS         PORTS                      NAMES
 72aa8df0d589   dataherald-app   "uvicorn dataherald.…"   7 seconds ago   Up 6 seconds   0.0.0.0:80->80/tcp         dataherald-app-1
-6595d145b0d7   mongo:latest     "docker-entrypoint.s…"   19 hours ago    Up 6 seconds   0.0.0.0:27017->27017/tcp   dataherald-mongodb-1
+6595d145b0d7   mongo:latest     "docker-entrypoint.s…"   19 hours ago    Up 6 seconds   0.0.0.0:27017->27017/tcp   mongodb
 ```
 
 6. In your browser visit [http://localhost/docs](http://localhost/docs)
```

---

### Incident Patch 7: `91661094` (2024-05-17)
**Commit Message**: DH-5776/fixing the azure openai (#487)

* DH-5776/fixing the azure openai

* Fixing the linter

* reformat with black

**File**: `services/engine/dataherald/api/fastapi.py` (modified, +6/-6)
```diff
@@ -110,8 +110,8 @@ def async_scanning(scanner, database, table_descriptions, storage):
     )
 
 
-def async_fine_tuning(storage, model):
-    openai_fine_tuning = OpenAIFineTuning(storage, model)
+def async_fine_tuning(system, storage, model):
+    openai_fine_tuning = OpenAIFineTuning(system, storage, model)
     openai_fine_tuning.create_fintuning_dataset()
     openai_fine_tuning.create_fine_tuning_job()
 
@@ -626,7 +626,7 @@ def create_finetuning_job(
                 e, fine_tuning_request.dict(), "finetuning_not_created"
             )
 
-        background_tasks.add_task(async_fine_tuning, self.storage, model)
+        background_tasks.add_task(async_fine_tuning, self.system, self.storage, model)
 
         return model
 
@@ -652,7 +652,7 @@ def cancel_finetuning_job(
                 status_code=400, detail="Model has already been cancelled."
             )
 
-        openai_fine_tuning = OpenAIFineTuning(self.storage, model)
+        openai_fine_tuning = OpenAIFineTuning(self.system, self.storage, model)
 
         return openai_fine_tuning.cancel_finetuning_job()
 
@@ -665,7 +665,7 @@ def get_finetunings(self, db_connection_id: str | None = None) -> list[Finetunin
         models = model_repository.find_by(query)
         result = []
         for model in models:
-            openai_fine_tuning = OpenAIFineTuning(self.storage, model)
+            openai_fine_tuning = OpenAIFineTuning(self.system, self.storage, model)
             result.append(
                 Finetuning(**openai_fine_tuning.retrieve_finetuning_job().dict())
             )
@@ -685,7 +685,7 @@ def get_finetuning_job(self, finetuning_job_id: str) -> Finetuning:
         model = model_repository.find_by_id(finetuning_job_id)
         if not model:
             raise HTTPException(status_code=404, detail="Model not found")
-        openai_fine_tuning = OpenAIFineTuning(self.storage, model)
+        openai_fine_tuning = OpenAIFineTuning(self.system, self.storage, model)
         return openai_fine_tuning.retrieve_finetuning_job()
 
     @override
```

**File**: `services/engine/dataherald/config.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ class Settings(BaseSettings):
     encrypt_key: str = os.environ.get("ENCRYPT_KEY")
     s3_aws_access_key_id: str | None = os.environ.get("S3_AWS_ACCESS_KEY_ID")
     s3_aws_secret_access_key: str | None = os.environ.get("S3_AWS_SECRET_ACCESS_KEY")
-    #Needed for Azure OpenAI integration:
+    # Needed for Azure OpenAI integration:
     azure_api_key: str | None = os.environ.get("AZURE_API_KEY")
     embedding_model: str | None = os.environ.get("EMBEDDING_MODEL")
     azure_api_version: str | None = os.environ.get("AZURE_API_VERSION")
```

**File**: `services/engine/dataherald/finetuning/openai_finetuning.py` (modified, +14/-6)
```diff
@@ -7,12 +7,13 @@
 
 import numpy as np
 import tiktoken
-from langchain_openai import OpenAIEmbeddings
+from langchain_openai import AzureOpenAIEmbeddings, OpenAIEmbeddings
 from openai import OpenAI
 from overrides import override
 from sql_metadata import Parser
 from tiktoken import Encoding
 
+from dataherald.config import System
 from dataherald.db_scanner.models.types import TableDescription, TableDescriptionStatus
 from dataherald.db_scanner.repository.base import TableDescriptionRepository
 from dataherald.finetuning import FinetuningModel
@@ -36,17 +37,24 @@ class OpenAIFineTuning(FinetuningModel):
     storage: Any
     client: OpenAI
 
-    def __init__(self, storage: Any, fine_tuning_model: Finetuning):
+    def __init__(self, system: System, storage: Any, fine_tuning_model: Finetuning):
         self.storage = storage
+        self.system = system
         self.fine_tuning_model = fine_tuning_model
         db_connection_repository = DatabaseConnectionRepository(storage)
         db_connection = db_connection_repository.find_by_id(
             fine_tuning_model.db_connection_id
         )
-        self.embedding = OpenAIEmbeddings( #TODO AzureOpenAIEmbeddings when Azure
-            openai_api_key=db_connection.decrypt_api_key(),
-            model=EMBEDDING_MODEL,
-        )
+        if self.system.settings["azure_api_key"] is not None:
+            self.embedding = AzureOpenAIEmbeddings(
+                azure_api_key=db_connection.decrypt_api_key(),
+                model=EMBEDDING_MODEL,
+            )
+        else:
+            self.embedding = OpenAIEmbeddings(
+                openai_api_key=db_connection.decrypt_api_key(),
+                model=EMBEDDING_MODEL,
+            )
         self.encoding = tiktoken.encoding_for_model(
             fine_tuning_model.base_llm.model_name
         )
```

**File**: `services/engine/dataherald/model/base_model.py` (modified, +5/-5)
```diff
@@ -1,7 +1,7 @@
 import os
 from typing import Any
 
-from langchain.llms import AlephAlpha, Anthropic, Cohere, OpenAI
+from langchain.llms import AlephAlpha, Anthropic, AzureOpenAI, Cohere, OpenAI
 from overrides import override
 
 from dataherald.model import LLMModel
@@ -19,16 +19,16 @@ def __init__(self, system):
         self.azure_api_key = os.environ.get("AZURE_API_KEY")
 
     @override
-    def get_model(
+    def get_model(  # noqa: C901
         self,
         database_connection: DatabaseConnection,
         model_family="openai",
         model_name="davinci-003",
         api_base: str | None = None,  # noqa: ARG002
         **kwargs: Any
     ) -> Any:
-        if self.system.settings['azure_api_key'] != None:
-            model_family = 'azure'
+        if self.system.settings["azure_api_key"] is not None:
+            model_family = "azure"
         if database_connection.llm_api_key is not None:
             fernet_encrypt = FernetEncrypt()
             api_key = fernet_encrypt.decrypt(database_connection.llm_api_key)
@@ -39,7 +39,7 @@ def get_model(
             elif model_family == "google":
                 self.google_api_key = api_key
             elif model_family == "azure":
-                self.azure_api_key == api_key
+                self.azure_api_key = api_key
         if self.openai_api_key:
             self.model = OpenAI(model_name=model_name, **kwargs)
         elif self.aleph_alpha_api_key:
```

**File**: `services/engine/dataherald/model/chat_model.py` (modified, +6/-6)
```diff
@@ -1,7 +1,7 @@
 from typing import Any
 
 from langchain_community.chat_models import ChatAnthropic, ChatCohere, ChatGooglePalm
-from langchain_openai import ChatOpenAI, AzureChatOpenAI
+from langchain_openai import AzureChatOpenAI, ChatOpenAI
 from overrides import override
 
 from dataherald.model import LLMModel
@@ -22,16 +22,16 @@ def get_model(
         **kwargs: Any
     ) -> Any:
         api_key = database_connection.decrypt_api_key()
-        if self.system.settings['azure_api_key'] != None:
-            model_family = 'azure'
+        if self.system.settings["azure_api_key"] is not None:
+            model_family = "azure"
         if model_family == "azure":
-            if api_base.endswith("/"): #TODO check where final "/" is added to api_base
+            if api_base.endswith("/"):  # check where final "/" is added to api_base
                 api_base = api_base[:-1]
             return AzureChatOpenAI(
                 deployment_name=model_name,
                 openai_api_key=api_key,
-                azure_endpoint= api_base, 
-                api_version=self.system.settings['azure_api_version'],
+                azure_endpoint=api_base,
+                api_version=self.system.settings["azure_api_version"],
                 **kwargs
             )
         if model_family == "openai":
```

**File**: `services/engine/dataherald/services/sql_generations.py` (modified, +2/-2)
```diff
@@ -63,9 +63,9 @@ def update_the_initial_sql_generation(
         initial_sql_generation.intermediate_steps = sql_generation.intermediate_steps
         return self.sql_generation_repository.update(initial_sql_generation)
 
-    def create(
+    def create(  # noqa: PLR0912
         self, prompt_id: str, sql_generation_request: SQLGenerationRequest
-    ) -> SQLGeneration:
+    ) -> SQLGeneration:  # noqa: PLR0912
         initial_sql_generation = SQLGeneration(
             prompt_id=prompt_id,
             created_at=datetime.now(),
```

**File**: `services/engine/dataherald/sql_generator/__init__.py` (modified, +2/-2)
```diff
@@ -179,15 +179,15 @@ def generate_response(
         """Generates a response to a user question."""
         pass
 
-    def stream_agent_steps(  # noqa: C901
+    def stream_agent_steps(  # noqa: PLR0912, C901
         self,
         question: str,
         agent_executor: AgentExecutor,
         response: SQLGeneration,
         sql_generation_repository: SQLGenerationRepository,
         queue: Queue,
         metadata: dict = None,
-    ):
+    ):  # noqa: PLR0912
         try:
             with get_openai_callback() as cb:
                 for chunk in agent_executor.stream(
```

**File**: `services/engine/dataherald/sql_generator/dataherald_finetuning_agent.py` (modified, +25/-11)
```diff
@@ -21,7 +21,7 @@
 from langchain.chains.llm import LLMChain
 from langchain.tools.base import BaseTool
 from langchain_community.callbacks import get_openai_callback
-from langchain_openai import OpenAIEmbeddings
+from langchain_openai import AzureOpenAIEmbeddings, OpenAIEmbeddings
 from openai import OpenAI
 from overrides import override
 from pydantic import BaseModel, Field
@@ -587,14 +587,24 @@ def generate_response(
         )
         finetunings_repository = FinetuningsRepository(storage)
         finetuning = finetunings_repository.find_by_id(self.finetuning_id)
-        openai_fine_tuning = OpenAIFineTuning(storage, finetuning)
+        openai_fine_tuning = OpenAIFineTuning(self.system, storage, finetuning)
         finetuning = openai_fine_tuning.retrieve_finetuning_job()
         if finetuning.status != FineTuningStatus.SUCCEEDED.value:
             raise FinetuningNotAvailableError(
                 f"Finetuning({self.finetuning_id}) has the status {finetuning.status}."
                 f"Finetuning should have the status {FineTuningStatus.SUCCEEDED.value} to generate SQL queries."
             )
         self.database = SQLDatabase.get_sql_engine(database_connection)
+        if self.system.settings["azure_api_key"] is not None:
+            embedding = AzureOpenAIEmbeddings(
+                openai_api_key=database_connection.decrypt_api_key(),
+                model=EMBEDDING_MODEL,
+            )
+        else:
+            embedding = OpenAIEmbeddings(
+                openai_api_key=database_connection.decrypt_api_key(),
+                model=EMBEDDING_MODEL,
+            )
         toolkit = SQLDatabaseToolkit(
             db=self.database,
             instructions=instructions,
@@ -605,10 +615,7 @@ def generate_response(
             use_finetuned_model_only=self.use_fintuned_model_only,
             model_name=finetuning.base_llm.model_name,
             openai_fine_tuning=openai_fine_tuning,
-            embedding=OpenAIEmbeddings( #TODO AzureOpenAIEmbeddings when Azure
-                openai_api_key=database_connection.decrypt_api_key(),
-                model=EMBEDDING_MODEL,
-            ),
+            embedding=embedding,
         )
         agent_executor = self.create_sql_agent(
             toolkit=toolkit,
@@ -693,14 +700,24 @@ def stream_response(
         )
         finetunings_repository = FinetuningsRepository(storage)
         finetuning = finetunings_repository.find_by_id(self.finetuning_id)
-        openai_fine_tuning = OpenAIFineTuning(storage, finetuning)
+        openai_fine_tuning = OpenAIFineTuning(self.system, storage, finetuning)
         finetuning = openai_fine_tuning.retrieve_finetuning_job()
         if finetuning.status != FineTuningStatus.SUCCEEDED.value:
             raise FinetuningNotAvailableError(
                 f"Finetuning({self.finetuning_id}) has the status {finetuning.status}."
                 f"Finetuning should have the status {FineTuningStatus.SUCCEEDED.value} to generate SQL queries."
             )
         self.database = SQLDatabase.get_sql_engine(database_connection)
+        if self.system.settings["azure_api_key"] is not None:
+            embedding = AzureOpenAIEmbeddings(
+                openai_api_key=database_connection.decrypt_api_key(),
+                model=EMBEDDING_MODEL,
+            )
+        else:
+            embedding = OpenAIEmbeddings(
+                openai_api_key=database_connection.decrypt_api_key(),
+                model=EMBEDDING_MODEL,
+            )
         toolkit = SQLDatabaseToolkit(
             db=self.database,
             instructions=instructions,
@@ -710,10 +727,7 @@ def stream_response(
             use_finetuned_model_only=self.use_fintuned_model_only,
             model_name=finetuning.base_llm.model_name,
             openai_fine_tuning=openai_fine_tuning,
-            embedding=OpenAIEmbeddings( #TODO AzureOpenAIEmbeddings when Azure
-                openai_api_key=database_connection.decrypt_api_key(),
-                model=EMBEDDING_MODEL,
-            ),
+            embedding=embedding,
         )
         agent_executor = self.create_sql_agent(
             toolkit=toolkit,
```

---

### Incident Patch 8: `7860dca1` (2024-04-26)
**Commit Message**: DH-5767 fixed last schema time (#533)

**File**: `apps/ai/server/utils/sample_db.py` (modified, +3/-2)
```diff
@@ -122,12 +122,13 @@ async def add_sample_db(self, sample_db_id: str, org_id: str) -> SampleDBDict:
                 collection=DATABASE_CONNECTION_COL,
             )
 
-        table_descriptions = [
+        table_descriptions: list[TableDescription] = [
             TableDescription(
-                **td,
+                **{k: v for k, v in td.items() if k != "last_schema_sync"},
                 db_connection_id=new_db_id,
                 created_at=datetime.now(),
                 metadata=engine_metadata,
+                last_schema_sync=datetime.now(),
             ).dict(exclude={"id"})
             for td in sample_db.table_descriptions
         ]
```

---

### Incident Patch 9: `576192aa` (2024-04-18)
**Commit Message**: DH-5738 fixing the few-shot samples format

**File**: `apps/ai/server/dataherald` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 15c2190e3d611619054829e95a7be455ffe06dc5
+Subproject commit 6a3df95237dc39f5895f1344b228a209e7037358
```

---

### Incident Patch 10: `cea2f888` (2024-04-18)
**Commit Message**: DH-5747n fix request body param (#525)

**File**: `apps/ai/clients/admin-console/src/hooks/api/database-connection/usePostDatabaseConnection.ts` (modified, +1/-4)
```diff
@@ -14,10 +14,7 @@ const usePostDatabaseConnection = () => {
         formData.append('file', file, file.name)
       }
 
-      formData.append(
-        'db_connection_request_json',
-        JSON.stringify(dbConnection),
-      )
+      formData.append('request_json', JSON.stringify(dbConnection))
 
       return apiFetcher<DatabaseConnection>(`${API_URL}/database-connections`, {
         method: 'POST',
```

**File**: `apps/ai/server/tests/db_connection/test_db_connection_api.py` (modified, +2/-2)
```diff
@@ -89,13 +89,13 @@ class TestDBConnectionAPI(TestCase):
     # @patch(
     #     "modules.organization.service.OrganizationService.update_db_connection_id",
     # def test_add_db_connection(self):
-    #         "db_connection_request_json": json.dumps(
+    #         "request_json": json.dumps(
     #         self.url,
 
     # @patch(
     #     "httpx.AsyncClient.put",
     # @patch(
     #     "modules.db_connection.repository.DBConnectionRepository.get_db_connection",
     # def test_update_db_connection(self):
-    #         "db_connection_request_json": json.dumps(
+    #         "request_json": json.dumps(
     #         self.url + "/0123456789ab0123456789ab",
```

---

### Incident Patch 11: `a03fc14c` (2024-04-18)
**Commit Message**: DH-5738 fixing the malformed sql queries

**File**: `apps/ai/server/dataherald` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 828c64d7cbb99e5d3ec1d0928e429eb5953de4cd
+Subproject commit 15c2190e3d611619054829e95a7be455ffe06dc5
```

---

### Incident Patch 12: `32533a7d` (2024-04-15)
**Commit Message**: [DH-5730] Fix Redshift dialect (#524)

**File**: `apps/ai/server/dataherald` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit c8e55a2b5a2a2a4cfbe764dc061185d59b20c396
+Subproject commit cf1a2e7fd9bff5c0325791a07c7b3f429d6a3e34
```

**File**: `apps/ai/server/modules/db_connection/models/entities.py` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ class DatabaseDialects(Enum):
     DUCKDB = "duckdb"
     BIGQUERY = "bigquery"
     SQLITE = "sqlite"
+    REDSHIFT = "redshift"
 
 
 class SSHSettings(BaseModel):
```

---

### Incident Patch 13: `0c6fa87f` (2024-04-09)
**Commit Message**: Revert "DH-5715 preven concurrent billable endpoint to exceed spending limit …" (#519)

This reverts commit ba245ee09ca1c8d0b9532f7c2218c36a102fa4b5.

**File**: `apps/ai/server/modules/organization/invoice/service.py` (modified, +0/-1)
```diff
@@ -244,7 +244,6 @@ def record_usage(
         quantity: int = 0,
         description: str = None,
     ):
-        self.check_usage(org_id, type, quantity)
         organization = self.org_repo.get_organization(org_id)
         if organization.invoice_details.plan == PaymentPlan.ENTERPRISE:
             return
```

---

### Incident Patch 14: `a056a993` (2024-04-09)
**Commit Message**: DH-5709 fix missing pinecone provider migration

**File**: `apps/ai/server/terraform/branch/main.tf` (modified, +2/-2)
```diff
@@ -6,9 +6,9 @@ terraform {
     }
 
     pinecone = {
-      source  = "skyscrapr/pinecone"
-      version = "0.5.1"
+      source = "pinecone-io/pinecone"
     }
+    
   }
   backend "s3" {
     bucket = "terraform-states2"
```

---

### Incident Patch 15: `1a756b5e` (2024-04-05)
**Commit Message**: DH-5688 fix engine formatting for streaming responses (#508)

* DH-5688 fix engine formatting for streaming responses

* removing backticks from observations

* adding newlines before and after obsevations

* removing newlines for ddl commands

* add new lines for excute query tool

* add some padding

* update latest branch submodule

* DH-5688/removing the brnach and pointing back to main

* updating the submodule with latest main branch

* Fix postman uri error (#512)

* DH-5760 enhance streaming

---------

Co-authored-by: mohammadrezapourreza <[REDACTED_EMAIL]>
Co-authored-by: Dishen <[REDACTED_EMAIL]>

**File**: `apps/ai/clients/admin-console/src/components/ui/markdown-renderer.tsx` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ const MarkdownRenderer: FC<MarkdownRendererProps> = ({
               style={{
                 backgroundColor: '#44475a',
                 color: '#f8f8f2',
-                padding: '3px',
+                padding: '3px 8px',
+                margin: '0 1px',
                 borderRadius: '0.3em',
                 tabSize: 4,
                 fontSize: '90%',
```

**File**: `apps/ai/clients/admin-console/src/pages/playground/index.tsx` (modified, +18/-25)
```diff
@@ -43,6 +43,8 @@ import Image from 'next/image'
 import Link from 'next/link'
 import { FC, useEffect, useRef, useState } from 'react'
 
+const STREAM_CHUNK_SIZE = 2
+
 const NONE_FINE_TUNING_MODEL: SelectOption = {
   label: 'None',
   value: '',
@@ -194,13 +196,11 @@ const PlaygroundPage: FC = () => {
   }
 
   // AI completion
-  const [previousCompletion, setPreviousCompletion] = useState('')
   const [streamText, setStreamText] = useState('')
   const [isStreaming, setIsStreaming] = useState(false)
   const [agentStopped, setAgentStopped] = useState(false)
   const [agentError, setAgentError] = useState<ErrorResponse>()
   const streamEndRef = useRef<HTMLDivElement>(null)
-  const wordQueueRef = useRef<string[]>([])
 
   const { token } = useAuth()
   const {
@@ -224,35 +224,32 @@ const PlaygroundPage: FC = () => {
     },
   })
 
+  // handle streaming
   useEffect(() => {
-    const processNextWord = () => {
-      if (wordQueueRef.current.length > 0) {
-        const nextWord = wordQueueRef.current.shift()
-        setStreamText((currentText) => currentText + ' ' + nextWord)
-        const timer = setTimeout(processNextWord, 100)
-        return () => clearTimeout(timer)
-      }
-    }
-    if (completion) {
-      const newChunk = completion.replace(previousCompletion, '')
-      if (newChunk) {
-        const newWords = newChunk.split(' ')
-        wordQueueRef.current = wordQueueRef.current.concat(newWords)
-        processNextWord()
+    if (agentStopped) {
+      setCompletion(streamText)
+    } else {
+      if (completion && completion.length > streamText.length) {
+        const nextStreamChunk = completion.slice(
+          streamText.length,
+          completion.length - streamText.length > STREAM_CHUNK_SIZE
+            ? streamText.length + STREAM_CHUNK_SIZE
+            : completion.length,
+        )
+        setStreamText((stream) => stream + nextStreamChunk)
       }
-      setPreviousCompletion(completion)
     }
-  }, [completion, previousCompletion])
+  }, [agentStopped, completion, setCompletion, streamText])
 
   useEffect(() => {
     if (isLoading) {
       setIsStreaming(true)
     } else {
-      setIsStreaming(wordQueueRef.current.length > 0)
+      setIsStreaming(completion.length > streamText.length)
     }
   }, [completion, isLoading, streamText])
 
-  // Streaming error handling
+  // streaming error handling
   const { setSubscriptionStatus } = useSubscription()
 
   useEffect(() => {
@@ -265,6 +262,7 @@ const PlaygroundPage: FC = () => {
     }
   }, [streamText, error, isStreaming])
 
+  // handle subscription status error
   useEffect(() => {
     if (agentError && isSubscriptionErrorCode(agentError.error_code)) {
       setSubscriptionStatus(agentError.error_code)
@@ -291,27 +289,22 @@ const PlaygroundPage: FC = () => {
     setInput('')
     setCompletion('')
     setStreamText('')
-    setPreviousCompletion('')
     setAgentStopped(false)
     setAgentError(undefined)
-    wordQueueRef.current = []
   }
 
   const handleStop = () => {
     setAgentStopped(true)
     setAgentError(undefined)
     stop()
-    wordQueueRef.current = []
   }
 
   const handleGenerate = (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault()
     setStreamText('')
-    setPreviousCompletion('')
     setAgentStopped(false)
     setAgentError(undefined)
     handleSubmit(e)
-    wordQueueRef.current = []
   }
 
   let content = <div className="grow"></div>
```

**File**: `apps/ai/server/dataherald` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 39bef010a6585994c161d83bfb7bd476bf782ff7
+Subproject commit a11d1f1e92a5e172f1c69bc89e16919b0a66fa9e
```

**File**: `apps/ai/server/tests/postman/ai-api-test.json` (modified, +3/-2)
```diff
@@ -301,7 +301,8 @@
 													"",
 													"utils.checkErrorCode(pm.response,'invalid_database_uri_format')"
 												],
-												"type": "text/javascript"
+												"type": "text/javascript",
+												"packages": {}
 											}
 										}
 									],
@@ -314,7 +315,7 @@
 										"header": [],
 										"body": {
 											"mode": "raw",
-											"raw": "{\n    \"alias\": \"bad database connection\",\n    \"connection_uri\": \"foo://foo\"\n}",
+											"raw": "{\n    \"alias\": \"bad database connection\",\n    \"connection_uri\": \"foobar\"\n}",
 											"options": {
 												"raw": {
 													"language": "json"
```

#### Recent Merged Pull Requests:
- **PR #519** (2024-07-11): Add documentation for environment variables of engine. (@ashvin-a)
- **PR #516** (2024-06-24): Added new environment variable for taking the embedding model in engine. (@ashvin-a)
- **PR #515** (2024-06-24): fix sorting table relevance scores (@daniel309)
- **PR #511** (2024-06-23): Fix typo in enterprise service's example .env file (@tecz)
- **PR #510** (closed): Bump langchain-community from 0.0.25 to 0.2.5 in /services/engine (@dependabot[bot])
- **PR #509** (closed): WIP add a new semantic_layer_agent (@aazo11)
- **PR #508** (2024-06-24): Update .env.example (@aazo11)
- **PR #507** (2024-06-08): Fix regression in s3.py (@aazo11)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
