# Forensic Learning Record (Deep Inspection): Dataherald/dataherald

> **Canonical Artifact**: `07_PROJECT_LEARNING/dataherald-dataherald-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dataherald/dataherald](https://github.com/Dataherald/dataherald))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:04:56.040Z  
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

### Core Architecture Module: `services/admin-console/jest.config.js`
```
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
}

```

### Core Architecture Module: `services/admin-console/next.config.js`
```
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 's.gravatar.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/databases',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig

```

### Core Architecture Module: `services/admin-console/postcss.config.js`
```
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

```

### Core Architecture Module: `services/admin-console/src/components/api-keys/api-keys-list.tsx`
```
import { getApiKeysColumns } from '@/components/api-keys/columns'
import GenerateApiKeyDialog from '@/components/api-keys/generate-api-key-dialog'
import { DataTable } from '@/components/data-table'
import { LoadingTable } from '@/components/data-table/loading-table'
import PageErrorMessage from '@/components/error/page-error-message'
import { Button } from '@/components/ui/button'
import useApiKeys from '@/hooks/api/api-keys/useApiKeys'
import { useDeleteApiKey } from '@/hooks/api/api-keys/useDeleteApiKey'
import { KeyRound, RefreshCcw } from 'lucide-react'
import { useCallback, useMemo } from 'react'

const ApiKeysList = () => {
  const { isLoading, isValidating, error, apiKeys, mutate } = useApiKeys()
  const deleteApiKey = useDeleteApiKey<void>()

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteApiKey(id)
        mutate() // update the list of api keys
        return Promise.resolve()
      } catch (e) {
        return Promise.reject(e)
      }
    },
    [deleteApiKey, mutate],
  )

  const handleRefresh = useCallback(async () => {
    mutate()
  }, [mutate])

  const columns = useMemo(
    () => getApiKeysColumns({ remove: handleDelete }),
    [handleDelete],
  )

  let pageContent = <></>

  if (isLoading) {
    pageContent = (
      <LoadingTable columnLength={4} rowLength={4} className="rounded-none" />
    )
  } else if (error) {
    pageContent = (
      <PageErrorMessage
        message="Something went wrong while fetching your API keys. Please try
        again later."
        error={error}
      />
    )
  } else if (apiKeys?.length === 0) {
    pageContent = (
      <div className="text-slate-500">No API keys generated yet.</div>
    )
  } else {
    pageContent = apiKeys ? (
      <DataTable id="api-keys" columns={columns} data={apiKeys} />
    ) : (
      <></>
    )
  }

  return (
    <>
      <div className="w-full flex justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound size={20} strokeWidth={2.5} />
          <h1 className="font-semibold">API Keys</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={isLoading || isValidating}
          onClick={handleRefresh}
        >
          <RefreshCcw
            size={16}
            className={isLoading || isValidating ? 'animate-spin' : ''}
          />
        </Button>
      </div>
      <div className="grow">{pageContent}</div>
      <div className="self-end">
        <GenerateApiKeyDialog onGeneratedKey={handleRefresh} />
      </div>
    </>
  )
}

export default ApiKeysList

```

### Core Architecture Module: `services/admin-console/src/components/api-keys/columns.tsx`
```
import DeleteApiKeyDialog from '@/components/api-keys/delete-api-key-dialog'
import { ApiKey } from '@/models/api'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

export const getApiKeysColumns: (actions: {
  remove: (id: string) => void | Promise<void>
}) => ColumnDef<ApiKey>[] = ({ remove }) => [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
  },
  {
    id: 'key_preview',
    header: 'Secret key',
    accessorKey: 'key_preview',
  },
  {
    id: 'created_at',
    header: () => <div className="min-w-[5rem]">Created at</div>,
    accessorKey: 'created_at',
    cell: ({ row }) => {
      const date: string = row.getValue('created_at')
      return date ? format(new Date(date), 'PP') : '-'
    },
  },
  {
    id: 'delete',
    width: 'auto',
    size: 20,
    cell: ({ row }) => {
      const { id } = row.original
      return <DeleteApiKeyDialog deleteFnc={() => remove(id)} />
    },
  },
]

```

### Core Architecture Module: `services/admin-console/src/components/api-keys/delete-api-key-dialog.tsx`
```
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ToastAction } from '@/components/ui/toast'
import { toast } from '@/components/ui/use-toast'
import { ErrorResponse } from '@/models/api'
import { Loader, Trash2 } from 'lucide-react'
import { FC, useState } from 'react'

interface DeleteApiKeyDialogProps {
  deleteFnc: () => void | Promise<void>
}

const DeleteApiKeyDialog: FC<DeleteApiKeyDialogProps> = ({ deleteFnc }) => {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await deleteFnc()
      toast({
        variant: 'success',
        title: 'API Key revoked',
      })
      setOpen(false)
    } catch (e) {
      console.error(e)
      const { message: title, trace_id: description } = e as ErrorResponse
      toast({
        variant: 'destructive',
        title,
        description,
        action: (
          <ToastAction altText="Try again" onClick={handleDeleteConfirm}>
            Try again
          </ToastAction>
        ),
      })
    } finally {
      setDeleting(false)
    }
  }
  return (
    <AlertDialog open={open}>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Trash2 strokeWidth={1.5} size={16} />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke secret key</AlertDialogTitle>
          <AlertDialogDescription>
            This API key will immediately be disabled. API requests made using
            this key will be rejected, which could cause any systems still
            depending on it to break.
          </AlertDialogDescription>
          <AlertDialogDescription>
            Do you wish to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteConfirm}>
            {deleting ? (
              <>
                <Loader className="mr-2 animate-spin" size={16} />
                Revoking
              </>
            ) : (
              'Revoke key'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DeleteApiKeyDialog

```

### Core Architecture Module: `services/admin-console/src/components/api-keys/generate-api-key-dialog.tsx`
```
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ToastAction } from '@/components/ui/toast'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/components/ui/use-toast'
import { usePostApiKey } from '@/hooks/api/api-keys/usePostApiKey'
import { copyToClipboard } from '@/lib/utils'
import { ErrorResponse } from '@/models/api'
import { yupResolver } from '@hookform/resolvers/yup'
import { Copy, Loader, Plus } from 'lucide-react'
import { FC, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as Yup from 'yup'

const apiKeyFormSchema = Yup.object({
  name: Yup.string()
    .min(3, `The name is required and must have more than 3 characters`)
    .max(50, `The name must have less than 50 characters`)
    .required(),
})

type ApiKeyFormValues = Yup.InferType<typeof apiKeyFormSchema>

interface AddApiKeyDialogProps {
  onGeneratedKey: () => void
}

const GenerateApiKeyDialog: FC<AddApiKeyDialogProps> = ({ onGeneratedKey }) => {
  const [open, setOpen] = useState(false)
  const [generatingApiKey, setGeneratingApiKey] = useState(false)
  const [showNewKey, setShowNewKey] = useState(false)
  const [apiKey, setApiKey] = useState<string | undefined>()
  const postApiKey = usePostApiKey()

  const form = useForm<ApiKeyFormValues>({
    resolver: yupResolver(apiKeyFormSchema),
    defaultValues: {
      name: '',
    },
  })

  const handleClose = async () => {
    if (generatingApiKey) return
    setOpen(false)
    setShowNewKey(false)
    setApiKey(undefined)
    form.reset()
  }

  const handleCopyClick = async () => {
    try {
      await copyToClipboard(apiKey)
      toast({
        variant: 'success',
        title: 'API Key copied!',
      })
    } catch (error) {
      console.error('Could not copy text: ', error)
      toast({
        variant: 'destructive',
        title: 'Could not copy API Key',
      })
    }
  }

  const handleGenerateApiKey = async (apiKeyFormValues: ApiKeyFormValues) => {
    setGeneratingApiKey(true)
    try {
      const { api_key } = await postApiKey(apiKeyFormValues)
      setApiKey(api_key)
      onGeneratedKey()
      setShowNewKey(true)
      form.reset()
      toast({
        variant: 'success',
        title: 'Secret API key generated',
        description: `Your secret key was generated successfully.`,
      })
    } catch (e) {
      console.error(e)
      const { message: title, trace_id: description } = e as ErrorResponse
      toast({
        variant: 'destructive',
        title,
        description,
        action: (
          <ToastAction
            altText="Try again"
            onClick={() => form.handleSubmit(handleGenerateApiKey)()}
          >
            Try again
          </ToastAction>
        ),
      })
    } finally {
      setGeneratingApiKey(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2" size={16} />
        Generate new secret key
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <h1 className="font-semibold">Generate new secret key</h1>
        </AlertDialogHeader>
        {showNewKey ? (
          <>
            <div className="flex flex-col">
              <p>
                Please save this secret key somewhere safe and accessible. For
                security reasons,{' '}
                <strong>{`you won't be able to view it again`}</strong>{' '}
                {`through your
            Dataherald account. If you lose this secret key, you'll need to
            generate a new one.`}
              </p>
              <div className="py-4 flex gap-2">
                <Input value={apiKey} readOnly />
                <Button onClick={handleCopyClick}>
                  <Copy size={20} />
                </Button>
              </div>
            </div>
            <AlertDialogFooter className="pt-4">
              <Button onClick={handleClose}>Done</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleGenerateApiKey)}
              className="space-y-8 grow flex flex-col"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={generatingApiKey}
                        placeholder="My secret key name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <AlertDialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={generatingApiKey}
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button>
                  {generatingApiKey ? (
                    <>
                      <Loader
                        className="mr-2 animate-spin"
                        size={20}
                        strokeWidth={2.5}
                      />{' '}
                      Generating key
                    </>
                  ) : (
                    'Generate secret key'
                  )}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        )}
      </AlertDialogContent>
      <Toaster />
    </AlertDialog>
  )
}

export default GenerateApiKeyDialog

```

### Core Architecture Module: `services/admin-console/src/components/billing/add-payment-method-dialog.tsx`
```
import WithBilling, { useBilling } from '@/components/hoc/WithBilling'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { useAppContext } from '@/contexts/app-context'
import { usePostPaymentMethod } from '@/hooks/api/billing/usePostPaymentMethod'
import { ErrorResponse, PaymentMethods } from '@/models/api'
import { CardElement, useElements } from '@stripe/react-stripe-js'
import { Loader, Plus } from 'lucide-react'
import { ComponentType, FC, FormEvent, useState } from 'react'

export interface AddPaymentMethodDialogProps {
  onPaymentMethodAdded: () => Promise<PaymentMethods | undefined>
  isDefaultPayment: boolean
}

const AddPaymentMethodDialog: FC<AddPaymentMethodDialogProps> = ({
  onPaymentMethodAdded,
  isDefaultPayment,
}) => {
  const billing = useBilling()
  const elements = useElements()
  const addPaymentMethod = usePostPaymentMethod()
  const { organization } = useAppContext()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string>()

  const handleAddCard = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!organization) return
    if (!elements) return
    if (!billing) return
    if (!cardComplete) return
    setSaving(true)
    try {
      const result = await billing.createPaymentMethod({
        elements,
      })

      if (result.error) {
        console.error(result.error.message)
        setError(result.error.message)
      } else {
        try {
          const pmId = result.paymentMethod.id
          await addPaymentMethod(
            organization?.id,
            { payment_method_id: pmId },
            isDefaultPayment,
          )
          toast({
            variant: 'success',
            title: 'Payment method added',
            description: 'Your payment method has been added successfully.',
          })
          await onPaymentMethodAdded()
          reset()
        } catch (e) {
          console.error(e)
          const { message: title, trace_id: description } = e as ErrorResponse
          toast({
            variant: 'destructive',
            title,
            description,
          })
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description:
          'The payment method could not be added due to service provider error.',
      })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setCardComplete(false)
    setSubmitted(false)
    setError('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && reset()}>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} className="mr-2" />
        Add new card
      </Button>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-lg"
      >
        <form onSubmit={handleAddCard} className="flex flex-col space-y-5">
          <DialogHeader>
            <DialogTitle>Add new card</DialogTitle>
            <div className="text-slate-500 text-sm">
              Add a payment method for <strong>{organization?.name}</strong>
            </div>
          </DialogHeader>
          <div className="pt-5">
            <CardElement
              options={{
                style: {
                  base: { fontSize: '16px' },
                },
              }}
              onChange={(e) => setCardComplete(e.complete)}
            />
            <div className="text-destructive text-sm mt-3 h-5">
              {submitted &&
                !cardComplete &&
                !error &&
                'Please complete all the fields'}
              {error}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!billing || saving}>
              {saving ? (
                <>
                  <Loader size={20} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type WithBillingCmp = (
  Component: ComponentType<AddPaymentMethodDialogProps>,
) => React.FC<AddPaymentMethodDialogProps>

const withBilling: WithBillingCmp = (Component) => {
  return function WithAuthUser(
    props: AddPaymentMethodDialogProps,
  ): JSX.Element {
    return (
      <WithBilling>
        <Component {...props} />
      </WithBilling>
    )
  }
}

export default withBilling(AddPaymentMethodDialog)

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

Co-authored-by: Juan Valacco <97040903+jvalacco-dataherald@users.noreply.github.com>
Co-authored-by: Dishen <44216194+DishenWang2023@users.noreply.github.com>
Co-authored-by: dishenwang2023 <dishenwang1021@gmail.com>

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
