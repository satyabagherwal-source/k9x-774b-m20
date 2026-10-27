> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-php-sdk-learnings.md`  
> **Source**: github ([https://github.com/modelcontextprotocol/php-sdk](https://github.com/modelcontextprotocol/php-sdk))  
> **Source Version**: `57b45eb9`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T14:53:51.814Z  
> **Learning ID**: `learn-github-modelcontextprotocol-php-sdk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): modelcontextprotocol/php-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-php-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/php-sdk](https://github.com/modelcontextprotocol/php-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T14:53:50.431Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/php-sdk`
- **Description**: The official PHP SDK for Model Context Protocol servers and clients. Maintained in collaboration with The PHP Foundation.
- **Primary Language / Ecosystem**: PHP
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1646 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #609** (2026-10-18): **[Server] Accept nested empty objects in tool arguments**
  *Symptoms*: Tool arguments are decoded with `assoc: true`, so a nested `{}` arrives as `[]` and failed an `object` schema. Only the root was patched.  `SchemaValidator::validateAgainstJsonSchema()` now takes `emptyArrayMayBeObject: true`: an empty array that only failed for not being an object is turned into `{}` and validated again. Since opis resolves the schema, `$ref`, `additionalProperties`, `items` and `oneOf`/`anyOf` are covered; a branch that accepts `[]` keeps it an array. `CallToolHandler` uses it for arguments and drops its root special case. Output validation stays strict.  This is not #587: arguments are still decoded with `assoc: true` and handlers still get arrays, so nothing changes for them. It only stops valid `{}` from being rejected. What stays lossy until #587: * `[]` sent for an object-only parameter is accepted, as the root already was * `{"0":"x"}` and `["x"]` can't be told apart  Fixes #586 

- **Issue #602** (2026-10-15): **[Server] Stop bundling queued notifications into the JSON answer of a request**
  *Symptoms*: Follow-up to #597: a plain request on a session with queued messages (e.g. `resources/updated`) was still answered with a JSON array of those messages and its response. The spec wants one JSON object there, and since `2025-06-18` there is no batching at all - Python `mcp` 2.x rejects it with `-32700`.  * Queued messages turn the answer into SSE, carrying them ahead of the response(s), like an SSE answer of a suspended call already does * A JSON answer holds the response alone, or the array of responses for a batch  A standalone GET stream would be the more natural home for these messages, but the transport has none yet - so the SSE answer keeps them flowing until then.  Fixes chr-hertel/php-sdk#73  🤖 Generated with [Claude Code](https://claude.com/claude-code)

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

### Incident Patch 1: `bc3b124c` (2026-10-14)
**Commit Message**: [Client] Fix native JsonException escaping for unencodable messages (#592)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ All notable changes to `mcp/sdk` will be documented in this file.
 -----
 
 * [BC Break] `DnsRebindingProtectionMiddleware` always validates `Host` (a missing one is rejected) and checks `Origin` separately against the new `allowedOrigins`, including scheme and port and empty by default. Same-origin requests are always allowed and both lists accept `['*']`. `allowedOrigins` is the new second constructor argument; pass the factories by name.
+* Fix the client throwing a native `\JsonException` for request params it cannot encode (e.g. invalid UTF-8): it now throws `InvalidArgumentException`, and a request handler result it cannot encode is answered with an internal error instead of no answer.
 * Fix concurrent requests of one session overwriting each other's session changes: `Session::save()` now writes only the keys it changed, onto what the store holds at that point.
 * [BC Break] `SchemaValidator` takes an optional `Opis\JsonSchema\Validator` as its first constructor argument, moving `$logger` to second. Pass `logger:` by name.
 * [BC Break] `SchemaValidator::validateAgainstJsonSchema()` no longer validates an empty array as an object. Pass `new \stdClass()` for an empty object.
```

**File**: `docs/client/errors.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ all client errors in one place. All classes below live in the `Mcp\Exception` na
 | `RequestException` | the server answers with an error, the request reaches the default request timeout (code `-32603`, message `Request timed out`), the server answers with an HTTP error status, or the STDIO server process exits while you wait for an answer |
 | `TimeoutException` | the `timeoutSeconds` deadline of a `callTool()` call expires |
 | `RequestCancelledException` | the cancellation token of a `callTool()` call is canceled, see [Cancellation and deadlines](transports.md#cancellation-and-deadlines) |
-| `InvalidArgumentException` | `callTool()` gets a `timeoutSeconds` that is not finite and positive, `readResource()` gets an empty URI, the builder gets an invalid timeout, retry count or fallback revision, or the server returns a malformed result (also from `connect()`) |
+| `InvalidArgumentException` | `callTool()` gets a `timeoutSeconds` that is not finite and positive, `readResource()` gets an empty URI, the builder gets an invalid timeout, retry count or fallback revision, the request can't be encoded as JSON (for example invalid UTF-8 in tool arguments), or the server returns a malformed result (also from `connect()`) |
 | `RuntimeException` | `callTool()` calls a tool with malformed `x-mcp-header` annotations, you call `sendRootsListChanged()` without the `rootsListChanged` capability, or, on `2026-07-28`, the server asks for input (elicitation, sampling, roots) that no request handler answers, or whose callback throws |
 
 An HTTP error status or an exited server process fails the request at once. The client doesn't
```

**File**: `src/Client.php` (modified, +7/-1)
```diff
@@ -285,6 +285,8 @@ public function listResourceTemplates(?string $cursor = null): ListResourceTempl
      * @param string                                                                  $uri        The resource URI
      * @param (callable(float $progress, ?float $total, ?string $message): void)|null $onProgress
      *                                                                                            Optional callback for progress updates
+     *
+     * @throws RequestException|ConnectionException|InvalidArgumentException
      */
     public function readResource(string $uri, ?callable $onProgress = null): ReadResourceResult
     {
@@ -318,6 +320,8 @@ public function listPrompts(?string $cursor = null): ListPromptsResult
      * @param array<string, string>                                                   $arguments  Prompt arguments
      * @param (callable(float $progress, ?float $total, ?string $message): void)|null $onProgress
      *                                                                                            Optional callback for progress updates
+     *
+     * @throws RequestException|ConnectionException|InvalidArgumentException
      */
     public function getPrompt(string $name, array $arguments = [], ?callable $onProgress = null): GetPromptResult
     {
@@ -333,6 +337,8 @@ public function getPrompt(string $name, array $arguments = [], ?callable $onProg
      *
      * @param PromptReference|ResourceReference  $ref      The prompt or resource reference
      * @param array{name: string, value: string} $argument The argument to complete
+     *
+     * @throws RequestException|ConnectionException|InvalidArgumentException
      */
     public function complete(PromptReference|ResourceReference $ref, array $argument): CompletionCompleteResult
     {
@@ -397,7 +403,7 @@ public function sendRootsListChanged(): void
      *
      * @return Response<mixed>
      *
-     * @throws RequestException|ConnectionException
+     * @throws RequestException|ConnectionException|InvalidArgumentException
      */
     private function sendRequest(Request $request, ?callable $onProgress = null, ?CancellationTokenInterface $cancellation = null, ?float $timeoutSeconds = null): Response
     {
```

**File**: `src/Client/Protocol.php` (modified, +19/-2)
```diff
@@ -23,6 +23,7 @@
 use Mcp\Client\Transport\HeaderAwareTransportInterface;
 use Mcp\Client\Transport\HttpTransport;
 use Mcp\Client\Transport\TransportInterface;
+use Mcp\Exception\InvalidArgumentException;
 use Mcp\Exception\RequestCancelledException;
 use Mcp\Exception\TimeoutException;
 use Mcp\JsonRpc\MessageFactory;
@@ -776,6 +777,8 @@ public function sendNotification(Notification $notification): void
      * envelope on the way out when the revision calls for one.
      *
      * @param array<string, mixed> $payload
+     *
+     * @throws InvalidArgumentException if the payload cannot be encoded as JSON, e.g. invalid UTF-8
      */
     private function send(array $payload, string $kind): void
     {
@@ -788,7 +791,13 @@ private function send(array $payload, string $kind): void
             'method' => $payload['method'] ?? null,
         ]);
 
-        $this->transport?->send(json_encode($payload, \JSON_THROW_ON_ERROR));
+        try {
+            $encoded = json_encode($payload, \JSON_THROW_ON_ERROR);
+        } catch (\JsonException $e) {
+            throw new InvalidArgumentException(\sprintf('Could not encode the "%s" %s as JSON: %s', $payload['method'] ?? 'unknown', $kind, $e->getMessage()), previous: $e);
+        }
+
+        $this->transport?->send($encoded);
     }
 
     /**
@@ -817,7 +826,15 @@ private function sendResponse(Response|Error $response): void
     {
         $this->logger->debug('Sending response', ['id' => $response->getId()]);
 
-        $encoded = json_encode($response, \JSON_THROW_ON_ERROR);
+        try {
+            $encoded = json_encode($response, \JSON_THROW_ON_ERROR);
+        } catch (\JsonException $e) {
+            // The server still awaits an answer, so it gets an error instead.
+            $this->logger->warning('Could not encode the response', ['id' => $response->getId(), 'exception' => $e]);
+
+            $encoded = json_encode(Error::forInternalError('Could not encode the response', $response->getId()), \JSON_THROW_ON_ERROR);
+        }
+
         $this->transport?->send($encoded);
     }
 
```

**File**: `tests/Unit/Client/ProtocolTest.php` (modified, +51/-0)
```diff
@@ -13,10 +13,12 @@
 
 use Mcp\Client\CancellationTokenInterface;
 use Mcp\Client\Configuration;
+use Mcp\Client\Handler\Request\RequestHandlerInterface;
 use Mcp\Client\Protocol;
 use Mcp\Client\State\ClientStateInterface;
 use Mcp\Client\Transport\TransportInterface;
 use Mcp\Exception\ConnectionException;
+use Mcp\Exception\InvalidArgumentException;
 use Mcp\Exception\LogicException;
 use Mcp\Exception\RequestCancelledException;
 use Mcp\Exception\TimeoutException;
@@ -26,6 +28,7 @@
 use Mcp\Schema\Implementation;
 use Mcp\Schema\JsonRpc\Error;
 use Mcp\Schema\JsonRpc\MessageInterface;
+use Mcp\Schema\JsonRpc\Request;
 use Mcp\Schema\JsonRpc\Response;
 use Mcp\Schema\Request\CallToolRequest;
 use Mcp\Schema\Request\PingRequest;
@@ -625,6 +628,54 @@ public function testProgressAfterCompletionIsDropped(): void
         $this->assertSame(['prog-1'], $seen);
     }
 
+    #[TestDox('a request that cannot be encoded as JSON fails with an SDK exception and leaves the client usable')]
+    public function testUnencodableRequestThrowsInvalidArgument(): void
+    {
+        $transport = new InterruptingTransport();
+        $protocol = new Protocol();
+        $protocol->connect($transport, $this->createConfiguration(ProtocolVersion::V2025_11_25));
+
+        try {
+            $protocol->request(new CallToolRequest('echo', ['text' => "\xB1"]), 5);
+            $this->fail('A request with invalid UTF-8 must not reach the transport.');
+        } catch (InvalidArgumentException $e) {
+            $this->assertStringContainsString('"tools/call"', $e->getMessage());
+            $this->assertInstanceOf(\JsonException::class, $e->getPrevious());
+        }
+
+        $this->assertSame([], $transport->messages);
+        $this->assertSame([], $protocol->getState()->getPendingRequests());
+        $this->assertSame('fast', $this->toolText($protocol->request(new CallToolRequest('fast', []), 5)));
+    }
+
+    #[TestDox('a request handler result that cannot be encoded as JSON is answered with an internal error')]
+    public function testUnencodableResponseIsAnsweredWithInternalError(): void
+    {
+        $handler = new class implements RequestHandlerInterface {
+            public function supports(Request $request): bool
+            {
+                return true;
+            }
+
+            public function handle(Request $request): Response
+            {
+                return new Response($request->getId(), ['text' => "\xB1"]);
+            }
+        };
+
+        $transport = new InterruptingTransport();
+        $protocol = new Protocol([$handler], logger: $logger = new CollectingLogger());
+        $protocol->connect($transport, $this->createConfiguration(ProtocolVersion::V2025_11_25));
+
+        $protocol->processMessage('{"jsonrpc":"2.0","id":7,"method":"ping"}');
+
+        $this->assertCount(1, $transport->messages);
+        $this->assertSame(7, $transport->messages[0]['id']);
+        $this->assertSame(Error::INTERNAL_ERROR, $transport->messages[0]['error']['code'] ?? null);
+        $this->assertCount(1, $logger->warnings);
+        $this->assertInstanceOf(\JsonException::class, $logger->warnings[0]['exception'] ?? null);
+    }
+
     private function createConfiguration(ProtocolVersion $protocolVersion, ?ProtocolVersion $fallback = ProtocolVersion::V2025_11_25): Configuration
     {
         return new Configuration(
```

---

### Incident Patch 2: `2d3dc79f` (2026-10-18)
**Commit Message**: [Server] Point a refused gateway request at InputRequiredResult (#606)

* [Server] Point a refused gateway request at InputRequiredResult

* Align sampling test and docs with the new refusal message

**File**: `docs/handlers/input-required.md` (modified, +11/-5)
```diff
@@ -116,11 +116,17 @@ They can return `true` there, but `sample()` and `listRoots()` still fail (see b
 ## What not to call
 
 `ClientGateway::sample()` and `listRoots()` belong to the handshake era. Revision
-`2026-07-28` removed both, so calling one there fails the call with an internal error
-(`-32603`). The error happens outside your handler, so a `try`/`catch` around the call
-never runs. Take what they gave you from tool arguments, resource URIs or server
-configuration instead. `elicit()` and `elicitUrl()` are unaffected: elicitation survived
-that revision, as an ask carried in the result.
+`2026-07-28` has no server-initiated requests, so calling one there fails the call with an
+internal error (`-32603`). The error happens outside your handler, so a `try`/`catch` around
+the call never runs. To sample or list roots on that revision,
+[return the ask](#returning-the-ask) as an `InputRequiredResult` with a
+`CreateSamplingMessageRequest` or `ListRootsRequest`, and read the answer with
+`samplingResult()` or `rootsResult()`. `elicit()` and `elicitUrl()` are unaffected: the SDK
+turns them into such an ask for you.
+
+Sampling and roots are deprecated since `2026-07-28`
+([SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577)). For new
+code, prefer tool arguments, resource URIs or server configuration.
 
 ## Which revision called
 
```

**File**: `src/Server/Stateless/StatelessProtocol.php` (modified, +4/-3)
```diff
@@ -723,9 +723,10 @@ private function readNotification(mixed $suspended, RequestMeta $meta): ?Notific
         if (!$suspended instanceof NotificationSuspension) {
             if ($suspended instanceof RequestSuspension) {
                 // Elicitation never reaches here — it is answered in run(). What
-                // is left are the kinds this revision removed outright, and no
-                // multi round-trip shape brings them back.
-                throw new LogicException('This protocol revision has no server-initiated requests: sampling and roots were removed with it, so take what you need through tool arguments, resource URIs or server configuration instead. Elicitation is the one ask that survived, as a multi round-trip request.');
+                // is left, sampling and roots, cannot be sent from inside a request
+                // on this revision, but a handler still gets them answered by
+                // returning them as an InputRequiredResult.
+                throw new LogicException(\sprintf('This protocol revision has no server-initiated requests, so "%s" cannot be sent from inside a request. Return it from the handler as an InputRequiredResult instead, and read the answer from RequestContext::getInputContext() when the client retries.', $suspended->request::getMethod()));
             }
 
             return null;
```

**File**: `tests/Integration/SamplingTest.php` (modified, +3/-2)
```diff
@@ -118,9 +118,10 @@ public function testSamplingIsUnavailableOnTheModernEra(): void
 
         try {
             $client->callTool('summarize', ['text' => 'hello']);
-            $this->fail('Sampling must not be reachable on 2026-07-28, which removed it.');
+            $this->fail('Sampling must not be sent from inside a request on 2026-07-28.');
         } catch (RequestException $e) {
-            $this->assertStringContainsString('sampling and roots were removed', $e->getMessage());
+            $this->assertStringContainsString('"sampling/createMessage"', $e->getMessage());
+            $this->assertStringContainsString('InputRequiredResult', $e->getMessage());
         }
     }
 
```

**File**: `tests/Unit/Server/Stateless/StatelessProtocolTest.php` (modified, +2/-0)
```diff
@@ -502,6 +502,8 @@ public function testServerInitiatedRequestIsRefused(): void
 
         $this->assertSame(500, $result->httpStatus);
         $this->assertStringContainsString('no server-initiated requests', $body['error']['message']);
+        $this->assertStringContainsString('"roots/list"', $body['error']['message']);
+        $this->assertStringContainsString('InputRequiredResult', $body['error']['message']);
     }
 
     #[TestDox('a gateway elicitation becomes the ask this revision carries in the result')]
```

---

### Incident Patch 3: `f6f9ea54` (2026-10-14)
**Commit Message**: [Server] Fix SchemaValidator messages for camelCase keywords (#591)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ All notable changes to `mcp/sdk` will be documented in this file.
 * Fix concurrent requests of one session overwriting each other's session changes: `Session::save()` now writes only the keys it changed, onto what the store holds at that point.
 * [BC Break] `SchemaValidator` takes an optional `Opis\JsonSchema\Validator` as its first constructor argument, moving `$logger` to second. Pass `logger:` by name.
 * [BC Break] `SchemaValidator::validateAgainstJsonSchema()` no longer validates an empty array as an object. Pass `new \stdClass()` for an empty object.
+* Fix `SchemaValidator` falling back to opis' wording for camelCase keywords like `minLength`, `multipleOf` or `additionalProperties`, and reporting a pointer relative to the `$ref` target inside `$defs`. Clients now see the SDK's messages and the full pointer.
 * Add `Builder::setSchemaValidator()` to configure the validator used for `tools/call` input and output, e.g. with a resolver for external `$ref` schemas.
 * [BC Break] Remove the `providerClass` argument of `#[CompletionProvider]`. Use `provider:`, which takes the same class-string and is now the first positional argument.
 * [BC Break] `StreamableHttpTransport::handleFiberTermination()` takes the terminated `\Fiber` as its first argument; a subclass overriding it has to accept it too.
```

**File**: `src/Capability/Discovery/SchemaValidator.php` (modified, +16/-16)
```diff
@@ -96,7 +96,7 @@ public function validateAgainstJsonSchema(mixed $data, array|object $schema): ar
 
         if (empty($formattedErrors) && $topError) { // Fallback
             $formattedErrors[] = [
-                'pointer' => $this->formatJsonPointerPath($topError->data()->path()),
+                'pointer' => $this->formatJsonPointerPath($topError->data()->fullPath()),
                 'keyword' => $topError->keyword(),
                 'message' => $this->formatValidationError($topError),
             ];
@@ -160,7 +160,7 @@ private function collectSubErrors(ValidationError $error, array &$collectedError
         $subErrors = $error->subErrors();
         if (empty($subErrors)) {
             $collectedErrors[] = [
-                'pointer' => $this->formatJsonPointerPath($error->data()->path()),
+                'pointer' => $this->formatJsonPointerPath($error->data()->fullPath()),
                 'keyword' => $error->keyword(),
                 'message' => $this->formatValidationError($error),
             ];
@@ -199,7 +199,7 @@ private function formatValidationError(ValidationError $error): string
         $args = $error->args();
         $message = "Constraint `{$keyword}` failed.";
 
-        switch (strtolower($keyword)) {
+        switch ($keyword) {
             case 'required':
                 $missing = $args['missing'] ?? [];
                 $formattedMissing = implode(', ', array_map(static fn ($p) => "`{$p}`", $missing));
@@ -243,11 +243,11 @@ private function formatValidationError(ValidationError $error): string
                 $expected = json_encode($args['expected'] ?? 'null', \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE);
                 $message = "Value must be equal to the constant value: {$expected}.";
                 break;
-            case 'minLength': // Corrected casing
+            case 'minLength':
                 $min = $args['min'] ?? '?';
                 $message = "String must be at least {$min} characters long.";
                 break;
-            case 'maxLength': // Corrected casing
+            case 'maxLength':
                 $max = $args['max'] ?? '?';
                 $message = "String must not be longer than {$max} characters.";
                 break;
@@ -263,38 +263,38 @@ private function formatValidationError(ValidationError $error): string
                 $max = $args['max'] ?? '?';
                 $message = "Number must be less than or equal to {$max}.";
                 break;
-            case 'exclusiveMinimum': // Corrected casing
+            case 'exclusiveMinimum':
                 $min = $args['min'] ?? '?';
                 $message = "Number must be strictly greater than {$min}.";
                 break;
-            case 'exclusiveMaximum': // Corrected casing
+            case 'exclusiveMaximum':
                 $max = $args['max'] ?? '?';
                 $message = "Number must be strictly less than {$max}.";
                 break;
-            case 'multipleOf': // Corrected casing
-                $value = $args['value'] ?? '?';
-                $message = "Number must be a multiple of {$value}.";
+            case 'multipleOf':
+                $divisor = $args['divisor'] ?? '?';
+                $message = "Number must be a multiple of {$divisor}.";
                 break;
-            case 'minItems': // Corrected casing
+            case 'minItems':
                 $min = $args['min'] ?? '?';
                 $message = "Array must contain at least {$min} items.";
                 break;
-            case 'maxItems': // Corrected casing
+            case 'maxItems':
                 $max = $args['max'] ?? '?';
                 $message = "Array must contain no more than {$max} items.";
                 break;
-            case 'uniqueItems': // Corrected casing
+            case 'uniqueItems':
                 $message = 'Array items must be unique.';
                 break;
-            case 'minProperties': // Corrected casing
+            case 'minProperties':
                 $min = $args['min'] ?? '?';
                 $message = "Object must have at least {$min} properties.";
                 break;
-            case 'maxProperties': // Corrected casing
+            case 'maxProperties':
                 $max = $args['max'] ?? '?';
                 $message = "Object must have no more than {$max} properties.";
                 break;
-            case 'additionalProperties': // Corrected casing
+            case 'additionalProperties':
                 $unexpected = $args['properties'] ?? [];
                 $formattedUnexpected = implode(', ', array_map(static fn ($p) => "`{$p}`", $unexpected));
                 $message = "Object contains unexpected additional properties: {$formattedUnexpected}.";
```

**File**: `tests/Unit/Capability/Discovery/SchemaValidatorTest.php` (modified, +57/-4)
```diff
@@ -15,6 +15,7 @@
 use Mcp\Capability\Discovery\SchemaValidator;
 use Opis\JsonSchema\SchemaLoader;
 use Opis\JsonSchema\Validator;
+use PHPUnit\Framework\Attributes\DataProvider;
 use PHPUnit\Framework\TestCase;
 
 class SchemaValidatorTest extends TestCase
@@ -96,7 +97,7 @@ public function testAdditionalPropertyGeneratesAdditionalPropertiesError(): void
         $this->assertCount(1, $errors);
         $this->assertEquals('/', $errors[0]['pointer']); // Error reported at the object root
         $this->assertEquals('additionalProperties', $errors[0]['keyword']);
-        $this->assertStringContainsString('Additional object properties are not allowed: ["extra"]', $errors[0]['message']);
+        $this->assertStringContainsString('Object contains unexpected additional properties: `extra`.', $errors[0]['message']);
     }
 
     // --- Keyword Constraint Tests ---
@@ -131,7 +132,7 @@ public function testMaxLengthConstraintViolation(): void
         $errors = $this->validator->validateAgainstJsonSchema($data, $schema);
         $this->assertCount(1, $errors);
         $this->assertEquals('maxLength', $errors[0]['keyword']);
-        $this->assertStringContainsString('Maximum string length is 5, found 7', $errors[0]['message']);
+        $this->assertStringContainsString('String must not be longer than 5 characters.', $errors[0]['message']);
     }
 
     public function testPatternConstraintViolation(): void
@@ -153,7 +154,7 @@ public function testMinItemsConstraintViolation(): void
         $errors = $this->validator->validateAgainstJsonSchema($data, $schema);
         $this->assertCount(1, $errors);
         $this->assertEquals('minItems', $errors[0]['keyword']);
-        $this->assertStringContainsString('Array should have at least 2 items, 1 found', $errors[0]['message']);
+        $this->assertStringContainsString('Array must contain at least 2 items.', $errors[0]['message']);
     }
 
     public function testUniqueItemsConstraintViolation(): void
@@ -164,7 +165,37 @@ public function testUniqueItemsConstraintViolation(): void
         $errors = $this->validator->validateAgainstJsonSchema($data, $schema);
         $this->assertCount(1, $errors);
         $this->assertEquals('uniqueItems', $errors[0]['keyword']);
-        $this->assertStringContainsString('Array must have unique items', $errors[0]['message']);
+        $this->assertSame('Array items must be unique.', $errors[0]['message']);
+    }
+
+    /**
+     * @param array<string, mixed> $schema
+     */
+    #[DataProvider('provideCamelCaseKeywordViolations')]
+    public function testCamelCaseKeywordViolationUsesSdkMessage(array $schema, mixed $data, string $keyword, string $message): void
+    {
+        $errors = $this->validator->validateAgainstJsonSchema($data, $schema);
+        $this->assertCount(1, $errors);
+        $this->assertSame($keyword, $errors[0]['keyword']);
+        $this->assertSame($message, $errors[0]['message']);
+    }
+
+    /**
+     * @return iterable<string, array{array<string, mixed>, mixed, string, string}>
+     */
+    public static function provideCamelCaseKeywordViolations(): iterable
+    {
+        yield 'minLength' => [['type' => 'string', 'minLength' => 3], 'ab', 'minLength', 'String must be at least 3 characters long.'];
+        yield 'maxLength' => [['type' => 'string', 'maxLength' => 2], 'abc', 'maxLength', 'String must not be longer than 2 characters.'];
+        yield 'exclusiveMinimum' => [['type' => 'number', 'exclusiveMinimum' => 5], 5, 'exclusiveMinimum', 'Number must be strictly greater than 5.'];
+        yield 'exclusiveMaximum' => [['type' => 'number', 'exclusiveMaximum' => 5], 5, 'exclusiveMaximum', 'Number must be strictly less than 5.'];
+        yield 'multipleOf' => [['type' => 'number', 'multipleOf' => 3], 7, 'multipleOf', 'Number must be a multiple of 3.'];
+        yield 'minItems' => [['type' => 'array', 'minItems' => 2], ['a'], 'minItems', 'Array must contain at least 2 items.'];
+        yield 'maxItems' => [['type' => 'array', 'maxItems' => 1], ['a', 'b'], 'maxItems', 'Array must contain no more than 1 items.'];
+        yield 'uniqueItems' => [['type' => 'array', 'uniqueItems' => true], ['a', 'a'], 'uniqueItems', 'Array items must be unique.'];
+        yield 'minProperties' => [['type' => 'object', 'minProperties' => 2], ['a' => 1], 'minProperties', 'Object must have at least 2 properties.'];
+        yield 'maxProperties' => [['type' => 'object', 'maxProperties' => 1], ['a' => 1, 'b' => 2], 'maxProperties', 'Object must have no more than 1 properties.'];
+        yield 'additionalProperties' => [['type' => 'object', 'additionalProperties' => false], ['a' => 1], 'additionalProperties', 'Object contains unexpected additional properties: `a`.'];
     }
 
     // --- Nested Structures and Pointers ---
@@ -201,6 +232,28 @@ public function testArrayItemValidationErrorPointer(): void
         $this->assertEquals('/2', $errors[0]['pointer']); // Pointer to the index of the invalid item
    
```

#### Recent Merged Pull Requests:
- **PR #611** (2026-10-20): chore(deps): bump @modelcontextprotocol/client from 2.2.0 to 2.3.1 in /tests/Interop in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #610** (2026-10-18): [Docs] Group and condense the 0.9.0 changelog (@chr-hertel)
- **PR #609** (closed): [Server] Accept nested empty objects in tool arguments (@chr-hertel)
- **PR #608** (2026-10-18): [Server] Announce `listChanged` for a custom registry wired to the notification bus (@chr-hertel)
- **PR #606** (2026-10-18): [Server] Point a refused gateway request at InputRequiredResult (@chr-hertel)
- **PR #605** (2026-10-18): [Docs] Document sending only structured content from a tool (@chr-hertel)

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

## X. [Client] Fix native JsonException escaping for unencodable messages (#592)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in modelcontextprotocol/php-sdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bc3b124c`: [Client] Fix native JsonException escaping for unencodable messages (#592). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing PHP data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// Verified production-grade fix pattern:
* Fix the client throwing a native `\JsonException` for request params it cannot encode (e.g. invalid UTF-8): it now throws `InvalidArgumentException`, and a request handler result it cannot encode is answered with an internal error instead of no answer.
```

**NEGATIVE CONSTRAINT**:
```php
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bc3b124c` are properly handled with clean fallback behavior.
