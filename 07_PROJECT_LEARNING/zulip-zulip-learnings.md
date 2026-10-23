> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source**: github ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Source Version**: `0975780a`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T09:51:51.063Z  
> **Learning ID**: `learn-github-zulip-zulip`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): zulip/zulip

---

## 1. Executive Forensic Architecture & System Mechanics

Zulip is an enterprise-scale, asynchronous-first, topic-threaded collaborative communication platform. Its core architecture decouples high-throughput, soft real-time message ingress and dispatch from heavy persistent analytics, external billing, and event notification processing.

```
                           +------------------------------------------+
                           |           Client Ingress Layer           |
                           |  (Web Client / Mobile / Desktop Apps)    |
                           +--------------------+---------------------+
                                                |
                                                | HTTP / REST API / WebSockets
                                                v
               +--------------------------------------------------------------+
               |                  Nginx Ingress & Routing                     |
               +----------------------+-----------------------+---------------+
                                      |                       |
                     (Long-polling /  |                       | (Standard RPC /
                      Events Listen)  |                       |  Mutations)
                                      v                       v
                      +---------------+-------+     +---------+---------------+
                      |   Tornado Push Server  |     |  Django Web Application |
                      | (Async Event Delivery)|     |     (WSGI / uWSGI)      |
                      +---------------+-------+     +---------+---------------+
                                      ^                       |
                                      | Publish Event         | Emit Task
                                      |                       v
                      +---------------+-----------------------+---------------+
                      |                    RabbitMQ Broker                    |
                      |  (Queue Topology: deferred_work, digest_emails, etc.) |
                      +-----------------------+-------------------------------+
                                              |
                                              v
                              +---------------+---------------+
                              |    Asynchronous Workers       |
                              |  (Queue Processors / Shards)  |
                              +---------------+---------------+
                                              |
                   +--------------------------+--------------------------+
                   |                          |                          |
                   v                          v                          v
        +----------+---------+     +----------+---------+     +----------+---------+
        | PostgreSQL (DB)    |     | Redis / Memcached   |     | S3 / Local Storage  |
        | - Partial Unique   |     | - In-memory Caches  |     | - Uploads & Avatars |
        |   Constraints      |     | - Transient State   |     | - Message Payloads  |
        | - Sharded Tables   |     | - Session Stores    |     |                     |
        +--------------------+     +---------------------+     +---------------------+
```

### Subsystem Boundaries & Decoupling Invariants
1. **Frontend Local Echo vs. Backend Rendering Equivalence**:
   The web client implements an optimistic update pipeline ("local echo") utilizing a client-side Markdown rendering pipeline (`web/src/markdown.ts`). To prevent visual "jumping" or UI hydration desynchronization when the server's persisted render returns, the client parser must consume identical configuration dictionaries, URL hashes, and channel state predicates (`is_empty_topic_only_channel`) as the backend Python Markdown pipeline.
2. **Real-Time Push Engine (Tornado) vs. Persistent RPC (Django)**:
   Django handles relational persistence, auth verification, and transaction boundaries. Tornado manages tens of thousands of idle, long-lived client event-queue connections. Inter-process communication operates via RabbitMQ event fanouts and Redis notifications.
3. **Queue Health & Worker Backlog Governance**:
   Queue ingestion scales dynamically. The queue monitoring engine (`scripts/lib/check_rabbitmq_queue.py`) rejects naive static length thresholds; instead, it models backlog clearance time dynamically:
   $$\text{Expected Clearance Time} = \text{Queue Backlog Size} \times \text{Moving Average Consume Time}$$
   This metric is evaluated against explicit per-queue SLAs (e.g., `deferred_work` budget of 600s vs. `missedmessage_mobile_notifications` budget of 120s).
4. **Multi-Tenant State Isolation & Remote Billing Bridging**:
   The `corporate` and `zilencer` subsystems manage remote self-hosted installations communicating with centralized cloud billing. Remote tenant identity is maintained across session boundaries using strongly typed dictionaries (`RemoteBillingIdentityDict`) with cryptographically signed, short-lived timestamps (TTL $\le$ 7200s), decoupling local account models from billing entities.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Engine Parsing Equivalence Invariant
**RULE**:
When an optimistic UI renders domain data client-side before asynchronous server persistence ("local echo"), all parsing filters, linkification predicates, and schema normalizations MUST be parameter-driven via explicit helper contracts and mathematically mirrored across both runtimes. Any server-side condition that causes markdown, syntax, or text linkification to degrade to plain text MUST have an exact counterpart in the client configuration layer.

**WHY**:
If the client-side parser linkifies a stream/topic combination (e.g., `#channel>topic`) because it assumes topics are universally permitted, but the backend server recognizes the channel as empty-topic-only and renders raw escaped text, the client displays a jarring "flash of linkified content" that abruptly reverts to unlinked text upon message roundtrip. This desynchronization corrupts optimistic cache state, resets selection focus, and breaks scroll-anchoring invariants.

**WHEN TO APPLY**:
Apply to any architecture featuring optimistic UI updates, multi-platform Markdown engines (Python backend + TypeScript frontend), or client-side caching of server-validated syntaxes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// web/src/markdown.ts
export type MarkdownHelpers = {
    get_stream_by_name: (stream_name: string) => {stream_id: number; name: string} | undefined;
    is_empty_topic_only_channel: (stream_id: number) => boolean;
    stream_topic_hash: (stream_id: number, topic: string) => string;
};

function handleStreamTopic({
    stream_name,
    topic,
    get_stream_by_name,
    is_empty_topic_only_channel,
    stream_topic_hash,
}: {
    stream_name: string;
    topic: string;
    get_stream_by_name: (name: string) => {stream_id: number; name: string} | undefined;
    is_empty_topic_only_channel: (stream_id: number) => boolean;
    stream_topic_hash: (stream_id: number, topic: string) => string;
}): string | undefined {
    const stream = get_stream_by_name(stream_name);
    if (stream === undefined) {
        return undefined;
    }
    // Strict Guard: Empty-topic-only channels forbid non-empty topic linking
    if (topic !== "" && is_empty_topic_only_channel(stream.stream_id)) {
        return undefined; // Preserves raw text representation
    }
    const href = stream_topic_hash(stream.stream_id, topic);
    const topic_display_name_html = _.escape(util.get_final_topic_display_name(topic));
    return render_topic_link({ href, text: topic_display_name_html });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Client assumes universal valid syntax without querying channel properties
function handleStreamTopicUnsafe({ stream_name, topic, get_stream_by_name, stream_topic_hash }) {
    const stream = get_stream_by_name(stream_name);
    if (!stream) return undefined;
    // Bug: Renders link even if stream forbids non-empty topics, desyncing with server DB
    return `<a href="${stream_topic_hash(stream.stream_id, topic)}">${topic}</a>`;
}
```

**VERIFICATION METHOD**:
Enforce parity with dual test harnesses verifying raw text vs linkification boundaries:
```javascript
// web/tests/markdown_parse.test.cjs
run_test("empty-topic-only channel topic links", () => {
    assert_parse(
        "#**empty_topic_only_channel>lunch**",
        "<p>#**empty_topic_only_channel&gt;lunch**</p>",
    );
    assert_parse(
        "#**empty_topic_only_channel>**",
        '<p><a class="stream-topic" data-stream-id="302" href="stream-302-topic-">#empty_topic_only_channel &gt; <span class="empty-topic-display">translated: general chat</span></a></p>',
    );
});
```

---

### 2. State-Decoupled Asymmetric Webhook Ingestion Invariant
**RULE**:
External integration webhooks (e.g., Stripe, GitHub) MUST enforce a 4-tier intake validation pipeline before executing state transitions:
1. Cryptographic signature and payload authentication.
2. API contract version identity matching.
3. Event-ID level idempotency check.
4. Entity existence resolution with a silent HTTP 200 acknowledgment on missing local targets.
Webhook endpoints MUST NOT fail with 4xx/5xx status codes when valid signed events reference entities that do not exist locally or are already deleted.

**WHY**:
Returning HTTP 4xx or 5xx on missing records causes external providers (like Stripe) to initiate exponential retry loops, filling server error logs, exhausting connection pools, and blocking legitimate event processing. Returning HTTP 200 for missing entities prevents retry thrashing when webhooks arrive for orphaned, deleted, or un-tracked sessions. Verifying the API schema version prevents unexpected object schema permutations from silently writing corrupt state into JSON database fields.

**WHEN TO APPLY**:
All webhook receivers and asynchronous event ingress controllers interfacing with third-party billing, notification, or CRM systems.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# corporate/views/webhook.py
@csrf_exempt
def stripe_webhook(request: HttpRequest) -> HttpResponse:
    stripe_webhook_endpoint_secret = get_secret("stripe_webhook_endpoint_secret", "")
    
    # Tier 1: Cryptographic signature validation
    if stripe_webhook_endpoint_secret and not settings.TEST_SUITE:
        stripe_signature = request.headers.get("Stripe-Signature")
        if stripe_signature is None:
            return HttpResponse(status=400)
        try:
            stripe_event = stripe.Webhook.construct_event(
                request.body, stripe_signature, stripe_webhook_endpoint_secret
            )
        except (ValueError, stripe.SignatureVerificationError):
            return HttpResponse(status=400)
    else:
        assert not settings.PRODUCTION
        stripe_event = stripe.Event.construct_from(json.loads(request.body), stripe.api_key)

    # Tier 2: API Contract Version Hard Lock
    if stripe_event.api_version != STRIPE_API_VERSION:
        billing_logger.error(
            f"Mismatch between billing API ({STRIPE_API_VERSION}) and webhook ({stripe_event.api_version})"
        )
        return HttpResponse(status=400)

    # Filter unhandled event types early
    if stripe_event.type not in ["checkout.session.completed", "invoice.paid", "invoice.voided"]:
        return HttpResponse(status=200)

    # Tier 3: Event Idempotency Barrier
    if Event.objects.filter(stripe_event_id=stripe_event.id).exists():
        return HttpResponse(status=200)

    # Tier 4: Entity Resolution with Silent Retires on Missing Records
    if stripe_event.type == "checkout.session.completed":
        stripe_session = stripe_event.data.object
        assert isinstance(stripe_session, stripe.checkout.Session)
        try:
            session = Session.objects.get(stripe_session_id=stripe_session.id)
        except Session.DoesNotExist:
            # Return 200 to acknowledge receipt and abort external retry cycles
            return HttpResponse(status=200)
            
        event = Event.objects.create(
            stripe_event_id=stripe_event.id,
            type=stripe_event.type,
            content_type=ContentType.objects.get_for_model(Session),
            object_id=session.id,
        )
        handle_checkout_session_completed_event(stripe_session, event)

    return HttpResponse(status=200)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Direct get_object_or_404 in webhook endpoint triggers external retry storm
def bad_webhook_handler(request):
    event_data = json.loads(request.body)
    # Bug 1: Unverified API version may parse changed payload schemas incorrectly
    # Bug 2: Returns 404 if user cancelled or DB row was deleted, causing Stripe to retry for days
    session = get_object_or_404(Session, stripe_session_id=event_data["data"]["object"]["id"])
    process_session(session)
    return HttpResponse(status=200)
```

**VERIFICATION METHOD**:
Integration test simulating webhook posting for non-existent session:
```python
def test_stripe_webhook_nonexistent_session_returns_200(self):
    payload = {"id": "evt_123", "type": "checkout.session.completed", "data": {"object": {"id": "nonexistent"}}, "api_version": STRIPE_API_VERSION}
    response = self.client.post("/api/v1/stripe/webhook", json.dumps(payload), content_type="application/json")
    self.assertEqual(response.status_code, 200)
    self.assertFalse(Event.objects.filter(stripe_event_id="evt_123").exists())
```

---

### 3. Conditional Unique Constraint for Nullable Relational Partitioning
**RULE**:
When a database table models entity counts, metrics, or logs partitioned by an optional subgroup/tenant (`subgroup` can be `NULL`), you MUST NOT use a single multi-column unique constraint containing the nullable field. Instead, you MUST define two mutually exclusive, partial unique constraints using explicit SQL `WHERE` clauses (`condition=models.Q(subgroup__isnull=False)` and `condition=models.Q(subgroup__isnull=True)`).

**WHY**:
In standard SQL (including ANSI standards and PostgreSQL default behavior), `NULL` does not equal `NULL`. A standard compound constraint `UNIQUE(realm_id, property, subgroup, end_time)` will permit infinite duplicate rows where `subgroup IS NULL`, causing analytics corruption, multi-worker race insertion conditions, and catastrophic aggregations.

**WHEN TO APPLY**:
Any SQL-backed persistence model where a partitioning or grouping key is optional or nullable.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# analytics/migrations/0001_squashed_0021_alter_fillstate_id.py / models.py
class RealmCount(models.Model):
    realm = models.ForeignKey("zerver.realm", on_delete=models.CASCADE)
    property = models.CharField(max_length=32)
    end_time = models.DateTimeField()
    value = models.BigIntegerField()
    subgroup = models.CharField(max_length=16, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                condition=models.Q(subgroup__isnull=False),
                fields=("realm", "property", "subgroup", "end_time"),
                name="unique_realm_count",
            ),
            models.UniqueConstraint(
                condition=models.Q(subgroup__isnull=True),
                fields=("realm", "property", "end_time"),
                name="unique_realm_count_null_subgroup",
            ),
        ]
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Naive unique constraint on nullable field
class BrokenRealmCount(models.Model):
    realm = models.ForeignKey("zerver.realm", on_delete=models.CASCADE)
    property = models.CharField(max_length=32)
    end_time = models.DateTimeField()
    subgroup = models.CharField(max_length=16, null=True)

    class Meta:
        # FAILS: Allows duplicate entries whenever subgroup is None!
        unique_together = [("realm", "property", "subgroup", "end_time")]
```

**VERIFICATION METHOD**:
Automated migration and ORM boundary assertion:
```python
def test_null_subgroup_uniqueness(self):
    now = timezone_now()
    RealmCount.objects.create(realm=self.realm, property="active_users", end_time=now, subgroup=None, value=10)
    with self.assertRaises(IntegrityError):
        RealmCount.objects.create(realm=self.realm, property="active_users", end_time=now, subgroup=None, value=20)
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Local Echo Linkification Divergence in Empty-Topic-Only Channels (BUG-PARSER-01)
- **Context**: `web/src/markdown.ts`, `web/src/markdown_config.ts`, `web/tests/markdown_parse.test.cjs`
- **What Was Expected**: Channels configured to allow only the empty topic must treat any attempt to syntax-link a non-empty topic (`#channel>topic`) as raw text, both on the server and inside the browser’s local echo markdown renderer.
- **What Actually Happened**: The server implementation had already been patched to leave non-empty topics as unlinked plain text for empty-topic-only channels. However, the client-side `markdown.ts` helper configuration was unaware of the channel's empty-topic status. As a result, when a user sent a message like `#empty_channel>lunch`, the web client immediately linkified it during local echo, only for the link to disappear once the server returned the canonical rendered HTML.
- **Evidence in Repo**: Commit `c367b879`, PR co-authored with Claude Opus 4.8.
- **Root Cause**: Architectural divergence between Python backend parsing logic and client-side TypeScript parsing logic caused by missing state propagation (`is_empty_topic_only_channel`) through the `MarkdownHelpers` interface.
- **Remediation Code Diff**:
```diff
--- a/web/src/markdown.ts
+++ b/web/src/markdown.ts
@@ -79,6 +79,7 @@ export type MarkdownHelpers = {
      // stream hashes
      get_stream_by_name: (stream_name: string) => {stream_id: number; name: string} | undefined;
+     is_empty_topic_only_channel: (stream_id: number) => boolean;
      stream_hash: (stream_id: number) => string;
@@ -612,12 +614,18 @@ function handleStreamTopic({
      const stream = get_stream_by_name(stream_name);
      if (stream === undefined) {
          return undefined;
      }
+     if (topic !== "" && is_empty_topic_only_channel(stream.stream_id)) {
+         // This channel only allows the empty topic, so a non-empty topic
+         // can never exist in it; don't linkify it.
+         return undefined;
+     }
      const href = stream_topic_hash(stream.stream_id, topic);
```
- **Lesson**: Optimistic UI rendering engines cannot rely on purely static syntax grammars. Dynamic realm/stream metadata predicates must be injected into client-side tokenizers via well-defined helper interfaces.

---

### Incident 2: Programmatic Popover Focus Triggering Errant Tippy Tooltips (BUG-UI-02)
- **Context**: `web/src/left_sidebar_navigation_area.ts`, Issue `#40326`
- **What Was Expected**: When a user clicks a button to open a condensed views popover, keyboard focus is moved programmatically to the first item for accessibility, but no visual tooltip should be displayed unless hovered or navigated via keyboard (`:focus-visible`).
- **What Actually Happened**: Tippy tooltips were initialized with the default trigger `"mouseenter focus"`. When the popover opened, `focus_popover` focused the first element, causing its tooltip to appear immediately in the center of the user's viewport without mouse hover.
- **Evidence in Repo**: PR `#40326`, commit `[ai] left_sidebar: Don't show view tooltips on mouse-opened popover focus.`
- **Root Cause**: Naive reliance on Tippy’s compound `"focus"` trigger coupled with programmatic focus management. Simply relying on `:focus-visible` alone was also insufficient because touch devices triggering long-press tooltips require manual focus handling without standard mouse hover events.
- **Remediation Code Diff**:
```diff
--- a/web/src/tippyjs.ts
+++ b/web/src/tippyjs.ts
@@ -120,6 +120,13 @@ export function setup_left_sidebar_tooltips(): void {
         onShow(instance) {
+            const reference = instance.reference;
+            // Suppress the tooltip when the reference has focus without :focus-visible
+            // and isn't hovered (prevents mouse-opened popover autofocus tooltip leak).
+            if (
+                reference.matches(":focus") &&
+                !reference.matches(":focus-visible") &&
+                !reference.matches(":hover")
+            ) {
+                return false;
+            }
             return true;
         }
```
- **Lesson**: Programmatic accessibility focus (`element.focus()`) produces DOM focus events that trigger generic tooltip listeners. Explicitly assert the combination of `:focus`, `:focus-visible`, and `:hover` before displaying overlays.

---

### Incident 3: Upstream Stripe SDK Parameter Deprecation & Environment Constraint Desync (BUG-DEPS-03)
- **Context**: `corporate/lib/stripe.py`, `pyproject.toml`, `version.py`
- **What Was Expected**: Upgrading dependencies in lockfiles must not introduce breaking API parameter changes across runtime environments or drop backward compatibility with target Python base versions ($3.10$).
- **What Actually Happened**: Stripe deprecated `payment_method_types` in favor of `allowed_payment_method_types` in newer library releases. Simultaneously, multiple upstream packages (`markdown>=3.11`, `firebase-admin>=7.7`, `soupsieve>=3.0`, `dnspython>=2.9`, `pydantic-settings>=2.16`) dropped support for Python 3.10 by requiring Python $\ge 3.11$.
- **Evidence in Repo**: Commit `811fffc2`, `version.py` bump to `PROVISION_VERSION = (393, 0)`.
- **Root Cause**: Transitive package upgrades breaking runtime invariants across older LTS platforms while upgrading Stripe client SDKs.
- **Remediation Code Diff**:
```diff
--- a/corporate/lib/stripe.py
+++ b/corporate/lib/stripe.py
@@ -1394,7 +1394,7 @@ def create_card_update_session_for_upgrade(
             customer=customer.stripe_customer_id,
             metadata=metadata,
             mode="setup",
-            payment_method_types=["card"],
+            allowed_payment_method_types=["card"],
             success_url=f"{self.billing_session_url}/billing/event_status/?stripe_session_id={{CHECKOUT_SESSION_ID}}",
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -19,3 +19,3 @@ prod = [
   # Needed for Markdown processing
-  "markdown",
+  "markdown<3.11.0",  # 3.11.0 requires Python ≥ 3.11
```
- **Lesson**: Strict platform compatibility policies require dependency managers to explicitly pin maximum versions (`<X.Y`) for all third-party libraries dropping support for minimum supported engine baselines, coupled with automated provision counter bumps (`PROVISION_VERSION`).

---

### Incident 4: Outdated Security/Permissions Invariant Text in Reactivation Modal (BUG-UI-04)
- **Context**: `web/templates/confirm_dialog/confirm_reactivate_bot.hbs`
- **What Was Expected**: Confirmation dialogs presented to organization administrators must accurately reflect active permission inheritance rules upon entity reactivation.
- **What Actually Happened**: The modal informed administrators: *"However, it will no longer be subscribed to the private channels that you are not subscribed to."* This text was rendered invalid by commit `e57c43b705`, which refactored bot permission sets such that reactivation retained specific channel memberships. Administrators were misled regarding channel visibility.
- **Evidence in Repo**: Commit `50d811eb`.
- **Root Cause**: Backend authorization semantics were updated without updating user-facing localization template strings.
- **Remediation Code Diff**:
```diff
--- a/web/templates/confirm_dialog/confirm_reactivate_bot.hbs
+++ b/web/templates/confirm_dialog/confirm_reactivate_bot.hbs
@@ -11,6 +11,5 @@
          Because the original owner of this bot <z-bot-owner></z-bot-owner> is deactivated, you will become the owner for this bot.
          {{#*inline "z-bot-owner"}}<strong>{{owner_name}}</strong>{{/inline}}
          {{/tr}}
-        {{t "However, it will no longer be subscribed to the private channels that you are not subscribed to." }}
      </p>
  {{/if}}
```
- **Lesson**: Security and permission logic refactors must mandate automated grep checks across template files (`.hbs`, `.html`) for associated translatable strings (`{{t "..."}}`).

---

### Incident 5: Stuck RabbitMQ Worker Backlog Detection & False Alert Storms (BUG-OPS-05)
- **Context**: `scripts/lib/check_rabbitmq_queue.py`
- **What Was Expected**: Monitoring scripts must detect wedged or non-consuming RabbitMQ queues without tripping false positives during temporary bursts or scheduled batch backfills.
- **What Actually Happened**: Idle queue workers whose statistics files (`queue.stats`) were older than 180 seconds immediately raised `CRITICAL` alerts whenever a sudden spike of 10+ jobs arrived before the worker could write updated timestamps to disk. Additionally, slow queues like `soft_reactivation` and `deferred_work_high_latency` tripped alarms because their clearance times naturally span hours.
- **Evidence in Repo**: `scripts/lib/check_rabbitmq_queue.py`, `MAX_SECONDS_TO_CLEAR` dictionary.
- **Root Cause**: Lack of differentiated queue profiles. Treating single long-latency operations identically to micro-task workers caused constant operational false positives.
- **Remediation Code Diff**:
```python
# scripts/lib/check_rabbitmq_queue.py
MAX_SECONDS_TO_CLEAR: defaultdict[str, int] = defaultdict(
    lambda: 30,
    deferred_work=600,
    # High-latency jobs naturally take hours; configure explicit clearing SLA
    soft_reactivation=600,
    deferred_work_high_latency=3 * 60 * 60,
    digest_emails=1200,
    missedmessage_mobile_notifications=120,
    embed_links=60,
    email_senders=90,
    deferred_email_senders=3600,
)
```
- **Lesson**: Queue monitoring health must never rely solely on instantaneous queue depth; it must evaluate consumption velocity against task-specific latency distributions.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Time Window Padding Invariant**: In `analytics/lib/time_utils.py`, `time_range()` constructs time series bounds. When computing backward padding with `min_length`, subtraction must be scaled by `(min_length - 1)`:
  ```python
  if min_length is not None:
      # (min_length - 1) ensures inclusive count matches min_length exactly
      start = min(start, end - (min_length - 1) * step)
  current = end
  while current >= start:
      times.append(current)
      current -= step
  times.reverse()
  ```
  *Trap Avoided*: Subtracting `min_length * step` results in an off-by-one window that prepends an extra period, causing array size mismatches in analytics matrix zip routines.
- **Strict UTC Boundary Normalization**: In Zulip, all analytics records must fall on exact hour or day boundaries. `check_analytics_state.py` validates this invariant:
  ```python
  if floor_function(last_fill) != last_fill:
      return NagiosResult(
          status="critical",
          message=f"FillState not on {stat.frequency} boundary for {property}",
      )
  ```
  Any timezone offset or microsecond residue fails validation.

### 2. Infinite Loop & Recursion Guards
- **Queue Monitor File Ingestion Protection**: In `scripts/lib/check_rabbitmq_queue.py`, parsing stats files avoids infinite loops and deadlocks by wrapping parsing in strict `try/except` blocks and filtering queue names against active consumers:
  ```python
  queues_to_check = set(check_queues).intersection(set(queues_with_consumers))
  for queue in queues_to_check:
      file_path = os.path.join(queue_stats_dir, queue + ".stats")
      if not os.path.exists(file_path):
          queue_stats[queue] = {}
          continue
      with open(file_path) as f:
          try:
              queue_stats[queue] = json.load(f)
          except json.decoder.JSONDecodeError:
              queue_stats[queue] = {}
  ```
- **Bounded Session Search**: `corporate/lib/remote_billing_util.py` guards against unbounded traversals by enforcing a strict session lifetime:
  ```python
  REMOTE_BILLING_SESSION_VALIDITY_SECONDS = 2 * 60 * 60  # 2 Hours
  if (datetime_to_timestamp(timezone_now()) - result["authenticated_at"] > REMOTE_BILLING_SESSION_VALIDITY_SECONDS):
      raise RemoteBillingIdentityExpiredError(...)
  ```

### 3. UI & UX Micro-Mechanics
- **Tippy Interaction Boundary Matrix**:
  | Interaction State | `:focus` | `:focus-visible` | `:hover` | Tooltip Display Action |
  | :--- | :--- | :--- | :--- | :--- |
  | Mouse Click on Button | `true` | `false` | `false` | **SUPPRESS** (`return false`) |
  | Keyboard Tab to Button | `true` | `true` | `false` | **SHOW** (`return true`) |
  | Mouse Hover over Button| `false`| `false` | `true`  | **SHOW** (`return true`) |
  | Touch Long-Press       | `true` | `false` | `false` (handled via touch hook) | **SHOW** (explicit trigger) |

  By asserting `reference.matches(":focus") && !reference.matches(":focus-visible") && !reference.matches(":hover")`, Zulip eliminates popover auto-focus tooltip leaks while preserving full keyboard accessibility.

### 4. Backend Concurrency & Memory Safety
- **Atomic Nagios Status Writing**: To prevent monitoring daemons from reading half-written alert states or colliding on disk writes, Zulip enforces atomic file replacement (`atomic_nagios_write`):
  ```python
  def atomic_nagios_write(service_name: str, status: str, message: str) -> int:
      temp_path = f"/var/lib/nagios/{service_name}.tmp.{