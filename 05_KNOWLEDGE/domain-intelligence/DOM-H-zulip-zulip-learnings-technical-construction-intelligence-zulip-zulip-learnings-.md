# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: zulip-zulip-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "zulip-zulip-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T16:49:41.819Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zulip-zulip-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zulip-zulip-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T16:49:41.819Z`  
> **Learning ID**: `LEARN-EVO-zulip-zulip-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), A (Human & Need Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 77%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from zulip-zulip-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source**: github ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Source Version**: `64b848e5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T12:23:57.022Z  
> **Learning ID**: `learn-github-zulip-zulip`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zulip/zulip

> **Canonical Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T12:23:57.017Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zulip/zulip`
- **Description**: Zulip server and web application. Open-source team chat that helps teams stay productive and focused.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 26250 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `analytics/lib/time_utils.py`
```
from datetime import datetime, timedelta

from analytics.lib.counts import CountStat
from zerver.lib.timestamp import floor_to_day, floor_to_hour, verify_UTC


# If min_length is None, returns end_times from ceiling(start) to floor(end), inclusive.
# If min_length is greater than 0, pads the list to the left.
# So informally, time_range(Sep 20, Sep 22, day, None) returns [Sep 20, Sep 21, Sep 22],
# and time_range(Sep 20, Sep 22, day, 5) returns [Sep 18, Sep 19, Sep 20, Sep 21, Sep 22]
def time_range(
    start: datetime, end: datetime, frequency: str, min_length: int | None
) -> list[datetime]:
    verify_UTC(start)
    verify_UTC(end)
    if frequency == CountStat.HOUR:
        end = floor_to_hour(end)
        step = timedelta(hours=1)
    elif frequency == CountStat.DAY:
        end = floor_to_day(end)
        step = timedelta(days=1)
    else:
        raise AssertionError(f"Unknown frequency: {frequency}")

    times = []
    if min_length is not None:
        start = min(start, end - (min_length - 1) * step)
    current = end
    while current >= start:
        times.append(current)
        current -= step
    times.reverse()
    return times

```

### Core Architecture Module: `analytics/management/commands/check_analytics_state.py`
```
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Literal

from django.utils.timezone import now as timezone_now
from typing_extensions import override

from analytics.lib.counts import ALL_COUNT_STATS, CountStat
from analytics.models import installation_epoch
from scripts.lib.zulip_tools import atomic_nagios_write
from zerver.lib.management import ZulipBaseCommand
from zerver.lib.timestamp import TimeZoneNotUTCError, floor_to_day, floor_to_hour, verify_UTC
from zerver.models import Realm

states = {
    0: "OK",
    1: "WARNING",
    2: "CRITICAL",
    3: "UNKNOWN",
}


@dataclass
class NagiosResult:
    status: Literal["ok", "warning", "critical", "unknown"]
    message: str


class Command(ZulipBaseCommand):
    help = """Checks FillState table.

    Run as a cron job that runs every hour."""

    @override
    def handle(self, *args: Any, **options: Any) -> None:
        fill_state = self.get_fill_state()
        atomic_nagios_write("check-analytics-state", fill_state.status, fill_state.message)

    def get_fill_state(self) -> NagiosResult:
        if not Realm.objects.exists():
            return NagiosResult(status="ok", message="No realms exist, so not checking FillState.")

        warning_unfilled_properties = []
        critical_unfilled_properties = []
        for property, stat in ALL_COUNT_STATS.items():
            last_fill = stat.last_successful_fill()
            if last_fill is None:
                last_fill = installation_epoch()
            try:
                verify_UTC(last_fill)
            except TimeZoneNotUTCError:
                return NagiosResult(
                    status="critical", message=f"FillState not in UTC for {property}"
                )

            if stat.frequency == CountStat.DAY:
                floor_function = floor_to_day
                warning_threshold = timedelta(hours=26)
                critical_threshold = timedelta(hours=50)
            else:  # CountStat.HOUR
                floor_function = floor_to_hour
                warning_threshold = timedelta(minutes=90)
                critical_threshold = timedelta(minutes=150)

            if floor_function(last_fill) != last_fill:
                return NagiosResult(
                    status="critical",
                    message=f"FillState not on {stat.frequency} boundary for {property}",
                )

            time_to_last_fill = timezone_now() - last_fill
            if time_to_last_fill > critical_threshold:
                critical_unfilled_properties.append(property)
            elif time_to_last_fill > warning_threshold:
                warning_unfilled_properties.append(property)

        if len(critical_unfilled_properties) == 0 and len(warning_unfilled_properties) == 0:
            return NagiosResult(status="ok", message="FillState looks fine.")
        if len(critical_unfilled_properties) == 0:
            return NagiosResult(
                status="warning",
                message="Missed filling {} once.".format(
                    ", ".join(warning_unfilled_properties),
                ),
            )
        return NagiosResult(
            status="critical",
            message="Missed filling {} once. Missed filling {} at least twice.".format(
                ", ".join(warning_unfilled_properties),
                ", ".join(critical_unfilled_properties),
            ),
        )

```

### Core Architecture Module: `analytics/migrations/0001_squashed_0021_alter_fillstate_id.py`
```
# Generated by Django 5.0.7 on 2024-08-13 20:16

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    replaces = [
        ("analytics", "0001_initial"),
        ("analytics", "0002_remove_huddlecount"),
        ("analytics", "0003_fillstate"),
        ("analytics", "0004_add_subgroup"),
        ("analytics", "0005_alter_field_size"),
        ("analytics", "0006_add_subgroup_to_unique_constraints"),
        ("analytics", "0007_remove_interval"),
        ("analytics", "0008_add_count_indexes"),
        ("analytics", "0009_remove_messages_to_stream_stat"),
        ("analytics", "0010_clear_messages_sent_values"),
        ("analytics", "0011_clear_analytics_tables"),
        ("analytics", "0012_add_on_delete"),
        ("analytics", "0013_remove_anomaly"),
        ("analytics", "0014_remove_fillstate_last_modified"),
        ("analytics", "0015_clear_duplicate_counts"),
        ("analytics", "0016_unique_constraint_when_subgroup_null"),
        ("analytics", "0017_regenerate_partial_indexes"),
        ("analytics", "0018_remove_usercount_active_users_audit"),
        ("analytics", "0019_remove_unused_counts"),
        ("analytics", "0020_alter_installationcount_id_alter_realmcount_id_and_more"),
        ("analytics", "0021_alter_fillstate_id"),
    ]

    initial = True

    dependencies = [
        # Needed for foreign keys to core models like Realm.
        ("zerver", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InstallationCount",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("property", models.CharField(max_length=32)),
                ("end_time", models.DateTimeField()),
                ("value", models.BigIntegerField()),
                ("subgroup", models.CharField(max_length=16, null=True)),
            ],
            options={
                "unique_together": set(),
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", False)),
                        fields=("property", "subgroup", "end_time"),
                        name="unique_installation_count",
                    ),
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", True)),
                        fields=("property", "end_time"),
                        name="unique_installation_count_null_subgroup",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="RealmCount",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "realm",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="zerver.realm"
                    ),
                ),
                ("property", models.CharField(max_length=32)),
                ("end_time", models.DateTimeField()),
                ("value", models.BigIntegerField()),
                ("subgroup", models.CharField(max_length=16, null=True)),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["property", "end_time"],
                        name="analytics_realmcount_property_end_time_3b60396b_idx",
                    )
                ],
                "unique_together": set(),
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", False)),
                        fields=("realm", "property", "subgroup", "end_time"),
                        name="unique_realm_count",
                    ),
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", True)),
                        fields=("realm", "property", "end_time"),
                        name="unique_realm_count_null_subgroup",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="StreamCount",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "realm",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="zerver.realm"
                    ),
                ),
                (
                    "stream",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="zerver.stream"
                    ),
                ),
                ("property", models.CharField(max_length=32)),
                ("end_time", models.DateTimeField()),
                ("value", models.BigIntegerField()),
                ("subgroup", models.CharField(max_length=16, null=True)),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["property", "realm", "end_time"],
                        name="analytics_streamcount_property_realm_id_end_time_155ae930_idx",
                    )
                ],
                "unique_together": set(),
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", False)),
                        fields=("stream", "property", "subgroup", "end_time"),
                        name="unique_stream_count",
                    ),
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", True)),
                        fields=("stream", "property", "end_time"),
                        name="unique_stream_count_null_subgroup",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="UserCount",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "realm",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="zerver.realm"
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL
                    ),
                ),
                ("property", models.CharField(max_length=32)),
                ("end_time", models.DateTimeField()),
                ("value", models.BigIntegerField()),
                ("subgroup", models.CharField(max_length=16, null=True)),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["property", "realm", "end_time"],
                        name="analytics_usercount_property_realm_id_end_time_591dbec1_idx",
                    )
                ],
                "unique_together": set(),
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", False)),
                        fields=("user", "property", "subgroup", "end_time"),
                        name="unique_user_count",
                    ),
                    models.UniqueConstraint(
                        condition=models.Q(("subgroup__isnull", True)),
                        fields=("user", "property", "end_time"),
                        name="unique_user_count_null_subgroup",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="FillState",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("property", models.CharField(max_length=40, unique=True)),
                ("end_time", models.DateTimeField()),
                ("state", models.PositiveSmallIntegerField()),
            ],
        ),
    ]

```

### Core Architecture Module: `analytics/migrations/0003_fillstate.py`
```
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0002_remove_huddlecount"),
    ]

    operations = [
        migrations.CreateModel(
            name="FillState",
            fields=[
                (
                    "id",
                    models.AutoField(
                        verbose_name="ID", serialize=False, auto_created=True, primary_key=True
                    ),
                ),
                ("property", models.CharField(unique=True, max_length=40)),
                ("end_time", models.DateTimeField()),
                ("state", models.PositiveSmallIntegerField()),
                ("last_modified", models.DateTimeField(auto_now=True)),
            ],
            bases=(models.Model,),
        ),
    ]

```

### Core Architecture Module: `analytics/migrations/0014_remove_fillstate_last_modified.py`
```
# Generated by Django 1.11.26 on 2020-01-27 04:32

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0013_remove_anomaly"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="fillstate",
            name="last_modified",
        ),
    ]

```

### Core Architecture Module: `analytics/migrations/0021_alter_fillstate_id.py`
```
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0020_alter_installationcount_id_alter_realmcount_id_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="fillstate",
            name="id",
            field=models.BigAutoField(
                auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
            ),
        ),
    ]

```

### Core Architecture Module: `corporate/lib/remote_billing_util.py`
```
import logging
from typing import Literal, TypedDict, overload

from django.http import HttpRequest
from django.utils.timezone import now as timezone_now
from django.utils.translation import gettext as _

from zerver.lib.exceptions import JsonableError, RemoteBillingAuthenticationError
from zerver.lib.timestamp import datetime_to_timestamp
from zilencer.models import (
    RemoteRealm,
    RemoteRealmBillingUser,
    RemoteServerBillingUser,
    RemoteZulipServer,
)

billing_logger = logging.getLogger("corporate.stripe")

# The sessions are relatively short-lived, so that we can avoid issues
# with users who have their privileges revoked on the remote server
# maintaining access to the billing page for too long.
REMOTE_BILLING_SESSION_VALIDITY_SECONDS = 2 * 60 * 60


class RemoteBillingUserDict(TypedDict):
    user_uuid: str
    user_email: str
    user_full_name: str


class RemoteBillingIdentityDict(TypedDict):
    user: RemoteBillingUserDict
    remote_server_uuid: str
    remote_realm_uuid: str

    remote_billing_user_id: int | None
    authenticated_at: int
    uri_scheme: Literal["http://", "https://"]

    next_page: str | None


class LegacyServerIdentityDict(TypedDict):
    # Currently this has only one field. We can extend this
    # to add more information as appropriate.
    remote_server_uuid: str

    remote_billing_user_id: int | None
    authenticated_at: int


class RemoteBillingIdentityExpiredError(Exception):
    def __init__(
        self,
        *,
        realm_uuid: str | None = None,
        server_uuid: str | None = None,
        uri_scheme: Literal["http://", "https://"] | None = None,
    ) -> None:
        self.realm_uuid = realm_uuid
        self.server_uuid = server_uuid
        self.uri_scheme = uri_scheme


@overload
def get_identity_dict_from_session(
    request: HttpRequest,
    *,
    realm_uuid: str | None,
    server_uuid: None,
) -> RemoteBillingIdentityDict | None: ...
@overload
def get_identity_dict_from_session(
    request: HttpRequest,
    *,
    realm_uuid: None,
    server_uuid: str | None,
) -> LegacyServerIdentityDict | None: ...
def get_identity_dict_from_session(
    request: HttpRequest,
    *,
    realm_uuid: str | None,
    server_uuid: str | None,
) -> RemoteBillingIdentityDict | LegacyServerIdentityDict | None:
    if not (realm_uuid or server_uuid):
        return None

    identity_dicts = request.session.get("remote_billing_identities")
    if identity_dicts is None:
        return None

    if realm_uuid is not None:
        result = identity_dicts.get(f"remote_realm:{realm_uuid}")
    else:
        assert server_uuid is not None
        result = identity_dicts.get(f"remote_server:{server_uuid}")

    if result is None:
        return None
    if (
        datetime_to_timestamp(timezone_now()) - result["authenticated_at"]
        > REMOTE_BILLING_SESSION_VALIDITY_SECONDS
    ):
        # In this case we raise, because callers want to catch this as an explicitly
        # different scenario from the user not being authenticated, to handle it nicely
        # by redirecting them to their login page.
        raise RemoteBillingIdentityExpiredError(
            realm_uuid=result.get("remote_realm_uuid"),
            server_uuid=result.get("remote_server_uuid"),
            uri_scheme=result.get("uri_scheme"),
        )

    return result


def get_remote_realm_and_user_from_session(
    request: HttpRequest,
    realm_uuid: str | None,
) -> tuple[RemoteRealm, RemoteRealmBillingUser]:
    identity_dict: RemoteBillingIdentityDict | None = get_identity_dict_from_session(
        request, realm_uuid=realm_uuid, server_uuid=None
    )

    if identity_dict is None:
        raise RemoteBillingAuthenticationError

    remote_server_uuid = identity_dict["remote_server_uuid"]
    remote_realm_uuid = identity_dict["remote_realm_uuid"]

    try:
        remote_realm = RemoteRealm.objects.get(
            uuid=remote_realm_uuid, server__uuid=remote_server_uuid
        )
    except RemoteRealm.DoesNotExist:
        raise AssertionError(
            "The remote realm is missing despite being in the RemoteBillingIdentityDict"
        )

    if (
        remote_realm.registration_deactivated
        or remote_realm.realm_deactivated
        or remote_realm.server.deactivated
    ):
        raise JsonableError(_("Registration is deactivated"))

    remote_billing_user_id = identity_dict["remote_billing_user_id"]
    # We only put IdentityDicts with remote_billing_user_id in the session in this flow,
    # because the RemoteRealmBillingUser already exists when this is inserted into the session
    # at the end of authentication.
    assert remote_billing_user_id is not None

    try:
        remote_billing_user = RemoteRealmBillingUser.objects.get(
            id=remote_billing_user_id, remote_realm=remote_realm
        )
    except RemoteRealmBillingUser.DoesNotExist:
        raise AssertionError

    return remote_realm, remote_billing_user


def get_remote_server_and_user_from_session(
    request: HttpRequest,
    server_uuid: str,
) -> tuple[RemoteZulipServer, RemoteServerBillingUser | None]:
    identity_dict: LegacyServerIdentityDict | None = get_identity_dict_from_session(
        request, realm_uuid=None, server_uuid=server_uuid
    )

    if identity_dict is None:
        raise RemoteBillingAuthenticationError

    remote_server_uuid = identity_dict["remote_server_uuid"]
    try:
        remote_server = RemoteZulipServer.objects.get(uuid=remote_server_uuid)
    except RemoteZulipServer.DoesNotExist:
        raise JsonableError(_("Invalid remote server."))

    if remote_server.deactivated:
        raise JsonableError(_("Registration is deactivated"))

    remote_billing_user_id = identity_dict.get("remote_billing_user_id")
    if remote_billing_user_id is None:
        return remote_server, None

    try:
        remote_billing_user = RemoteServerBillingUser.objects.get(
            id=remote_billing_user_id, remote_server=remote_server
        )
    except RemoteServerBillingUser.DoesNotExist:
        remote_billing_user = None

    return remote_server, remote_billing_user

```

### Core Architecture Module: `corporate/models/stripe_state.py`
```
from typing import Any, Union

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import CASCADE, SET_NULL

from corporate.models.customers import Customer


class Event(models.Model):
    stripe_event_id = models.CharField(max_length=255)

    type = models.CharField(max_length=255)

    RECEIVED = 1
    EVENT_HANDLER_STARTED = 30
    EVENT_HANDLER_FAILED = 40
    EVENT_HANDLER_SUCCEEDED = 50
    status = models.SmallIntegerField(default=RECEIVED)

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField(db_index=True)
    content_object = GenericForeignKey("content_type", "object_id")

    handler_error = models.JSONField(default=None, null=True)

    def get_event_handler_details_as_dict(self) -> dict[str, Any]:
        details_dict = {}
        details_dict["status"] = {
            Event.RECEIVED: "not_started",
            Event.EVENT_HANDLER_STARTED: "started",
            Event.EVENT_HANDLER_FAILED: "failed",
            Event.EVENT_HANDLER_SUCCEEDED: "succeeded",
        }[self.status]
        if self.handler_error:
            details_dict["error"] = self.handler_error
        return details_dict


def get_last_associated_event_by_type(
    content_object: Union["Invoice", "PaymentIntent", "Session"], event_type: str
) -> Event | None:
    content_type = ContentType.objects.get_for_model(type(content_object))
    return Event.objects.filter(
        content_type=content_type, object_id=content_object.id, type=event_type
    ).last()


class Session(models.Model):
    customer = models.ForeignKey(Customer, on_delete=CASCADE)
    stripe_session_id = models.CharField(max_length=255, unique=True)

    CARD_UPDATE_FROM_BILLING_PAGE = 40
    CARD_UPDATE_FROM_UPGRADE_PAGE = 50
    type = models.SmallIntegerField()

    CREATED = 1
    COMPLETED = 10
    status = models.SmallIntegerField(default=CREATED)

    # Did the user opt to manually manage licenses before clicking on update button?
    is_manual_license_management_upgrade_session = models.BooleanField(default=False)

    # CustomerPlan tier that the user is upgrading to.
    tier = models.SmallIntegerField(null=True)

    def get_status_as_string(self) -> str:
        return {Session.CREATED: "created", Session.COMPLETED: "completed"}[self.status]

    def get_type_as_string(self) -> str:
        return {
            Session.CARD_UPDATE_FROM_BILLING_PAGE: "card_update_from_billing_page",
            Session.CARD_UPDATE_FROM_UPGRADE_PAGE: "card_update_from_upgrade_page",
        }[self.type]

    def to_dict(self) -> dict[str, Any]:
        session_dict: dict[str, Any] = {}

        session_dict["status"] = self.get_status_as_string()
        session_dict["type"] = self.get_type_as_string()
        session_dict["is_manual_license_management_upgrade_session"] = (
            self.is_manual_license_management_upgrade_session
        )
        session_dict["tier"] = self.tier
        event = self.get_last_associated_event()
        if event is not None:
            session_dict["event_handler"] = event.get_event_handler_details_as_dict()
        return session_dict

    def get_last_associated_event(self) -> Event | None:
        if self.status == Session.CREATED:
            return None
        return get_last_associated_event_by_type(self, "checkout.session.completed")


class PaymentIntent(models.Model):  # nocoverage
    customer = models.ForeignKey(Customer, on_delete=CASCADE)
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True)

    REQUIRES_PAYMENT_METHOD = 1
    REQUIRES_CONFIRMATION = 20
    REQUIRES_ACTION = 30
    PROCESSING = 40
    REQUIRES_CAPTURE = 50
    CANCELLED = 60
    SUCCEEDED = 70

    status = models.SmallIntegerField()
    last_payment_error = models.JSONField(default=None, null=True)

    @classmethod
    def get_status_integer_from_status_text(cls, status_text: str) -> int:
        return getattr(cls, status_text.upper())

    def get_status_as_string(self) -> str:
        return {
            PaymentIntent.REQUIRES_PAYMENT_METHOD: "requires_payment_method",
            PaymentIntent.REQUIRES_CONFIRMATION: "requires_confirmation",
            PaymentIntent.REQUIRES_ACTION: "requires_action",
            PaymentIntent.PROCESSING: "processing",
            PaymentIntent.REQUIRES_CAPTURE: "requires_capture",
            PaymentIntent.CANCELLED: "cancelled",
            PaymentIntent.SUCCEEDED: "succeeded",
        }[self.status]

    def get_last_associated_event(self) -> Event | None:
        if self.status == PaymentIntent.SUCCEEDED:
            event_type = "payment_intent.succeeded"
        # TODO: Add test for this case. Not sure how to trigger naturally.
        else:  # nocoverage
            return None  # nocoverage
        return get_last_associated_event_by_type(self, event_type)

    def to_dict(self) -> dict[str, Any]:
        payment_intent_dict: dict[str, Any] = {}
        payment_intent_dict["status"] = self.get_status_as_string()
        event = self.get_last_associated_event()
        if event is not None:
            payment_intent_dict["event_handler"] = event.get_event_handler_details_as_dict()
        return payment_intent_dict


class Invoice(models.Model):
    customer = models.ForeignKey(Customer, on_delete=CASCADE)
    stripe_invoice_id = models.CharField(max_length=255, unique=True)
    plan = models.ForeignKey("CustomerPlan", null=True, default=None, on_delete=SET_NULL)
    is_created_for_free_trial_upgrade = models.BooleanField(default=False)

    SENT = 1
    PAID = 2
    VOID = 3
    status = models.SmallIntegerField()

    def get_status_as_string(self) -> str:
        return {
            Invoice.SENT: "sent",
            Invoice.PAID: "paid",
            Invoice.VOID: "void",
        }[self.status]

    def get_last_associated_event(self) -> Event | None:
        if self.status == Invoice.PAID:
            event_type = "invoice.paid"
        elif self.status == Invoice.VOID:
            event_type = "invoice.voided"
        # A SENT invoice has no associated event yet.
        else:
            return None
        return get_last_associated_event_by_type(self, event_type)

    def to_dict(self) -> dict[str, Any]:
        stripe_invoice_dict: dict[str, Any] = {}
        stripe_invoice_dict["status"] = self.get_status_as_string()
        event = self.get_last_associated_event()
        if event is not None:
            stripe_invoice_dict["event_handler"] = event.get_event_handler_details_as_dict()
        return stripe_invoice_dict

```

### Core Architecture Module: `corporate/views/webhook.py`
```
import json
import logging

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt

from corporate.models.stripe_state import Event, Invoice, Session
from zproject.config import get_secret

billing_logger = logging.getLogger("corporate.stripe")


@csrf_exempt
def stripe_webhook(request: HttpRequest) -> HttpResponse:
    import stripe

    from corporate.lib.stripe import STRIPE_API_VERSION
    from corporate.lib.stripe_event_handler import (
        handle_checkout_session_completed_event,
        handle_invoice_paid_event,
        handle_invoice_voided_event,
    )

    stripe_webhook_endpoint_secret = get_secret("stripe_webhook_endpoint_secret", "")
    if (
        stripe_webhook_endpoint_secret and not settings.TEST_SUITE
    ):  # nocoverage: We can't verify the signature in test suite since we fetch the events
        # from Stripe events API and manually post to the webhook endpoint.
        stripe_signature = request.headers.get("Stripe-Signature")
        if stripe_signature is None:
            return HttpResponse(status=400)
        try:
            stripe_event = stripe.Webhook.construct_event(
                request.body,
                stripe_signature,
                stripe_webhook_endpoint_secret,
            )
        except ValueError:
            return HttpResponse(status=400)
        except stripe.SignatureVerificationError:
            return HttpResponse(status=400)
    else:
        assert not settings.PRODUCTION
        try:
            stripe_event = stripe.Event.construct_from(json.loads(request.body), stripe.api_key)
        except Exception:
            return HttpResponse(status=400)

    if stripe_event.api_version != STRIPE_API_VERSION:
        error_message = f"Mismatch between billing system Stripe API version({STRIPE_API_VERSION}) and Stripe webhook event API version({stripe_event.api_version})."
        billing_logger.error(error_message)
        return HttpResponse(status=400)

    if stripe_event.type not in [
        "checkout.session.completed",
        "invoice.paid",
        "invoice.voided",
    ]:
        return HttpResponse(status=200)

    if Event.objects.filter(stripe_event_id=stripe_event.id).exists():
        return HttpResponse(status=200)

    event = Event(stripe_event_id=stripe_event.id, type=stripe_event.type)

    if stripe_event.type == "checkout.session.completed":
        stripe_session = stripe_event.data.object
        assert isinstance(stripe_session, stripe.checkout.Session)
        try:
            session = Session.objects.get(stripe_session_id=stripe_session.id)
        except Session.DoesNotExist:
            return HttpResponse(status=200)
        event.content_type = ContentType.objects.get_for_model(Session)
        event.object_id = session.id
        event.save()
        handle_checkout_session_completed_event(stripe_session, event)
    elif stripe_event.type in ("invoice.paid", "invoice.voided"):
        stripe_invoice = stripe_event.data.object
        assert isinstance(stripe_invoice, stripe.Invoice)
        try:
            invoice = Invoice.objects.get(stripe_invoice_id=stripe_invoice.id)
        except Invoice.DoesNotExist:
            return HttpResponse(status=200)
        event.content_type = ContentType.objects.get_for_model(Invoice)
        event.object_id = invoice.id
        event.save()
        if stripe_event.type == "invoice.paid":
            handle_invoice_paid_event(stripe_invoice, event)
        else:
            handle_invoice_voided_event(stripe_invoice, event)
    # We don't need to process failed payments via webhooks since we directly charge users
    # when they click on "Purchase" button and immediately provide feedback for failed payments.
    # If the feedback is not immediate, our event_status handler checks for payment status and informs the user.
    return HttpResponse(status=200)

```

### Core Architecture Module: `scripts/lib/check_rabbitmq_queue.py`
```
import json
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from typing import Any

ZULIP_PATH = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(ZULIP_PATH)
from scripts.lib.zulip_tools import atomic_nagios_write, get_config, get_config_file

normal_queues = [
    "deferred_work",
    "deferred_email_senders",
    "digest_emails",
    "email_mirror",
    "email_senders",
    "embed_links",
    "embedded_bots",
    "missedmessage_emails",
    "missedmessage_mobile_notifications",
    "outgoing_webhooks",
    "thumbnail",
    "user_activity",
    "user_activity_interval",
]

# These queues exist only when a server opts into them; until then their
# events stay in deferred_work, and there is no consumer to monitor.
if get_config(get_config_file(), "application_server", "dedicated_soft_reactivation_queue", False):
    normal_queues.append("soft_reactivation")

if get_config(
    get_config_file(), "application_server", "dedicated_deferred_work_high_latency_queue", False
):
    normal_queues.append("deferred_work_high_latency")

mobile_notification_shards = int(
    get_config(get_config_file(), "application_server", "mobile_notification_shards", "1")
)
user_activity_shards = int(
    get_config(get_config_file(), "application_server", "user_activity_shards", "1")
)

OK = 0
WARNING = 1
CRITICAL = 2
UNKNOWN = 3

states = {
    0: "OK",
    1: "WARNING",
    2: "CRITICAL",
    3: "UNKNOWN",
}

MAX_SECONDS_TO_CLEAR: defaultdict[str, int] = defaultdict(
    lambda: 30,
    deferred_work=600,
    # Soft reactivations are the deferred_work backfills split into their
    # own queue; keep deferred_work's generous clear-time budget so the slow
    # backfills that motivated the split don't trip false alerts.
    soft_reactivation=600,
    # Every job in this queue can take many minutes, so even a single job
    # in flight makes the estimated time to clear the backlog that long.
    deferred_work_high_latency=3 * 60 * 60,
    digest_emails=1200,
    missedmessage_mobile_notifications=120,
    embed_links=60,
    email_senders=90,
    deferred_email_senders=3600,
)
CRITICAL_SECONDS_TO_CLEAR: defaultdict[str, int] = defaultdict(
    lambda: 60,
    deferred_work=900,
    soft_reactivation=900,
    deferred_work_high_latency=6 * 60 * 60,
    missedmessage_mobile_notifications=180,
    digest_emails=1800,
    embed_links=90,
    email_senders=300,
    deferred_email_senders=4500,
)


def analyze_queue_stats(
    queue_name: str, stats: dict[str, Any], queue_count_rabbitmqctl: int
) -> dict[str, Any]:
    now = int(time.time())
    if stats == {}:
        return dict(status=UNKNOWN, name=queue_name, message="invalid or no stats data")

    if now - stats["update_time"] > 180 and queue_count_rabbitmqctl > 10:
        # Queue isn't updating the stats file and has some events in
        # the backlog, it's likely stuck.
        #
        # TODO: There's an unlikely race condition here - if the queue
        # was fully emptied and was idle due to no new events coming
        # for over 180 seconds, suddenly gets a burst of events and
        # this code runs exactly in the very small time window between
        # those events popping up and the queue beginning to process
        # the first one (which will refresh the stats file at the very
        # start), we'll incorrectly return the CRITICAL status. The
        # chance of that happening should be negligible because the queue
        # worker should wake up immediately and log statistics before
        # starting to process the first event.
        return dict(
            status=CRITICAL,
            name=queue_name,
            message="queue appears to be stuck, last update {}, queue size {}".format(
                stats["update_time"], queue_count_rabbitmqctl
            ),
        )

    current_size = queue_count_rabbitmqctl
    average_consume_time = stats["recent_average_consume_time"]
    if average_consume_time is None:
        # Queue just started; we can't effectively estimate anything.
        #
        # If the queue is stuck in this state and not processing
        # anything, eventually the `update_time` rule above will fire.
        return dict(status=OK, name=queue_name, message="")

    expected_time_to_clear_backlog = current_size * average_consume_time
    if expected_time_to_clear_backlog > MAX_SECONDS_TO_CLEAR[queue_name]:
        if expected_time_to_clear_backlog > CRITICAL_SECONDS_TO_CLEAR[queue_name]:
            status = CRITICAL
        else:
            status = WARNING

        return dict(
            status=status,
            name=queue_name,
            message=f"clearing the backlog will take too long: {expected_time_to_clear_backlog}s, size: {current_size}",
        )

    return dict(status=OK, name=queue_name, message="")


WARN_COUNT_THRESHOLD_DEFAULT = 10
CRITICAL_COUNT_THRESHOLD_DEFAULT = 50


def check_other_queues(queue_counts_dict: dict[str, int]) -> list[dict[str, Any]]:
    """Do a simple queue size check for queues whose workers don't publish stats files."""

    results = []
    for queue, count in queue_counts_dict.items():
        if queue in normal_queues:
            continue

        if count > CRITICAL_COUNT_THRESHOLD_DEFAULT:
            results.append(dict(status=CRITICAL, name=queue, message=f"count critical: {count}"))
        elif count > WARN_COUNT_THRESHOLD_DEFAULT:
            results.append(dict(status=WARNING, name=queue, message=f"count warning: {count}"))
        else:
            results.append(dict(status=OK, name=queue, message=""))

    return results


def check_rabbitmq_queues() -> None:
    pattern = re.compile(r"(\w+)\t(\d+)\t(\d+)")
    if "USER" in os.environ and os.environ["USER"] not in ["root", "rabbitmq"]:
        print("This script must be run as the root or rabbitmq user")

    list_queues_output = subprocess.check_output(
        ["/usr/sbin/rabbitmqctl", "list_queues", "name", "messages", "consumers"],
        text=True,
    )
    queue_counts_rabbitmqctl = {}
    queues_with_consumers = []
    for line in list_queues_output.split("\n"):
        line = line.strip()
        m = pattern.match(line)
        if m:
            queue = m.group(1)
            count = int(m.group(2))
            consumers = int(m.group(3))
            queue_counts_rabbitmqctl[queue] = count
            if consumers > 0 and not queue.startswith("notify_tornado"):
                queues_with_consumers.append(queue)

    queue_stats_dir = subprocess.check_output(
        [os.path.join(ZULIP_PATH, "scripts/get-django-setting"), "QUEUE_STATS_DIR"],
        text=True,
    ).strip()
    queue_stats: dict[str, dict[str, Any]] = {}

    check_queues = normal_queues
    if mobile_notification_shards > 1:
        # For sharded queue workers, where there's a separate queue
        # for each shard, we need to make sure none of those are
        # backlogged.
        check_queues += [
            f"missedmessage_mobile_notifications_shard{d}"
            for d in range(1, mobile_notification_shards + 1)
        ]
    if user_activity_shards > 1:
        check_queues += [f"user_activity_shard{d}" for d in range(1, user_activity_shards + 1)]

    queues_to_check = set(check_queues).intersection(set(queues_with_consumers))
    for queue in queues_to_check:
        fn = queue + ".stats"
        file_path = os.path.join(queue_stats_dir, fn)
        if not os.path.exists(file_path):
            queue_stats[queue] = {}
            continue

        with open(file_path) as f:
            try:
                queue_stats[queue] = json.load(f)
            except json.decoder.JSONDecodeError:
                queue_stats[queue] = {}

    results = []
    for queue_name, stats in queue_stats.items():
        results.append(analyze_queue_stats(queue_name, stats, queue_counts_rabbitmqctl[queue_name]))

    results.extend(check_other_queues(queue_counts_rabbitmqctl))

    status = max(result["status"] for result in results)

    if status > 0:
        queue_error_template = "queue {} problem: {}:{}"
        error_message = "; ".join(
            queue_error_template.format(result["name"], states[result["status"]], result["message"])
            for result in results
            if result["status"] > 0
        )
        sys.exit(
            atomic_nagios_write(
                "check-rabbitmq-results",
                "critical" if status == CRITICAL else "warning",
                error_message,
            )
        )
    else:
        atomic_nagios_write("check-rabbitmq-results", "ok", "queues normal")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #40737** (2026-11-17): **Vagrant 2.4 on macOS fails with false forwarded port 9991 collision**
  *Symptoms*: ### Describe the bug When running `vagrant up --provider=docker` on macOS using modern Vagrant (v2.4.x, which embeds Ruby 3.3), provisioning fails immediately due to a false `ForwardPortCollision`:  ```text Vagrant cannot forward the specified ports on this VM, since they would collide with some other application that is already listening on these ports. The forwarded port to 9991 is already in use on the host machine. ```  No service or process is listening on port 9991 (verified via `lsof -nP -iTCP:9991`).  ### Environment - **Host OS**: macOS (Apple Silicon / Intel) - **Vagrant Version**: 2.4.9 (embedded Ruby 3.3.0) - **Provider**: Docker (Docker Desktop on macOS)  ### Steps to reproduce 1. Clone the Zulip repository on macOS. 2. Install Docker Desktop and Vagrant via Homebrew (`brew install hashicorp/tap/hashicorp-vagrant`). 3. Ensure no local service is listening on port 9991. 4. Run `vagrant up --provider=docker`. 5. Observe the false port collision failure on port 9991.  ### Root Cause Vagrant checks whether a port is open in `lib/vagrant/util/is_port_open.rb` by executing: ```ruby Socket.tcp(host, port, connect_timeout: 0.1).close ``` expecting an `Errno::ECONNREFUSED` exception if the port is closed.  On Darwin with Ruby 3.3, a non-blocking connect (`connect_timeout`) to an unused port does not raise `Errno::ECONNREFUSED`. Instead, `IO.select` marks the socket writable, and the error code is held in the socket option `SO_ERROR: 61 (ECONNREFUSED)`.   Because no except

- **Issue #40704** (2026-11-17): **Update 12.4 to 13.2**
  *Symptoms*: Following an update from 12.4 to 13.2, the following issues have appeared on Windows 7 clients using Firefox 115.26: 1. Status indicators have turned white. 2. The `message_feed_container` header overlaps with the main window.  <img width="1366" height="452" alt="zulip" src="https://github.com/user-attachments/assets/92a03a3e-31aa-4ca9-b3d4-937ff6b6c628" />  I also noticed that there are long-running requests leading up to these events:  <img width="1262" height="335" alt="events_1" src="https://github.com/user-attachments/assets/997b752a-28df-4ba3-a42b-3705af83a81d" /> 
  **Post-Mortem & Fix Analysis**:
  > A couple preliminary things to try on your end while I chat with folks here: - Are your users able to update to a more recent version of Firefox ESR 115? It looks like 115.45 was just released. - Can they try Zulip Desktop https://zulip.com/apps/?
  > Update: the oldest Firefox that we support in Zulip 13 is ESR 126. However, our team is not able to think of any changes between 12 and 13 that would cause the display issues you're seeing. Wondering if there could be something cached on the user's system that’s causing this?  Please feel welcome to come chat about it in the [production help](https://chat.zulip.org/#narrow/channel/31-production-help) channel of the [Zulip Development Community](https://zulip.com/development-community/)! Folks with more helpful context are active there.

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

### Incident Patch 1: `08bb8255` (2026-10-02)
**Commit Message**: reactions: Remove `overflow: hidden` from the reactions box.

With reaction pills now shrinking to fit the reactions box, nothing
in the box can extend past its edges, so its `overflow: hidden` is no
longer needed. It was added in bb0225acec to suppress a scroll bar,
back when the pills were floats contained by the overflow; the box
is now a wrapping flexbox, which contains its items by itself.

Fixes #38594.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `web/styles/reactions.css` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 .message_reactions {
-    overflow: hidden;
     user-select: none;
 
     &:has(.message_reaction) {
```

---

### Incident Patch 2: `543451f6` (2026-10-21)
**Commit Message**: streams: Fix "-1 days" in channel retention change notice.

When a channel's retention period changed between the organization
default and an explicit value, and both resolved to forever, the
notice showed "New retention period: -1 days" and said messages would
be deleted "-1 days after they are sent". Only the notice was wrong;
such channels are still excluded from retention-based deletion.

Fix this by formatting the old and new periods independently, and
label a period that comes from the organization default, so that
default-to-explicit changes with the same effective period no longer
read as "Forever -> Forever" or "N days -> N days".

Reported at
https://chat.zulip.org/#narrow/channel/31-production-help/topic/bug.20when.20retention.20is.20set.20to.20forever.3F/with/2542327

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `zerver/actions/streams.py` (modified, +15/-11)
```diff
@@ -1634,27 +1634,31 @@ def send_change_stream_message_retention_days_notification(
     sender = get_system_bot(settings.NOTIFICATION_BOT, user_profile.realm_id)
     user_mention = silent_mention_syntax_for_user(user_profile)
 
+    old_is_realm_default = old_value is None
+    new_is_realm_default = new_value is None
+
     # If switching from or to the organization's default retention policy,
     # we want to take the realm's default into account.
     if old_value is None:
         old_value = stream.realm.message_retention_days
     if new_value is None:
         new_value = stream.realm.message_retention_days
 
+    def format_retention_period(value: int, is_realm_default: bool) -> str:
+        if value == Stream.MESSAGE_RETENTION_SPECIAL_VALUES_MAP["unlimited"]:
+            if is_realm_default:
+                return _("Forever (organization default)")
+            return _("Forever")
+        if is_realm_default:
+            return _("{number_of_days} days (organization default)").format(number_of_days=value)
+        return _("{number_of_days} days").format(number_of_days=value)
+
     with override_language(stream.realm.default_language):
-        if old_value == Stream.MESSAGE_RETENTION_SPECIAL_VALUES_MAP["unlimited"]:
-            old_retention_period = _("Forever")
-            new_retention_period = _("{number_of_days} days").format(number_of_days=new_value)
-            summary_line = _(
-                "Messages in this channel will now be automatically deleted {number_of_days} days after they are sent."
-            ).format(number_of_days=new_value)
-        elif new_value == Stream.MESSAGE_RETENTION_SPECIAL_VALUES_MAP["unlimited"]:
-            old_retention_period = _("{number_of_days} days").format(number_of_days=old_value)
-            new_retention_period = _("Forever")
+        old_retention_period = format_retention_period(old_value, old_is_realm_default)
+        new_retention_period = format_retention_period(new_value, new_is_realm_default)
+        if new_value == Stream.MESSAGE_RETENTION_SPECIAL_VALUES_MAP["unlimited"]:
             summary_line = _("Messages in this channel will now be retained forever.")
         else:
-            old_retention_period = _("{number_of_days} days").format(number_of_days=old_value)
-            new_retention_period = _("{number_of_days} days").format(number_of_days=new_value)
             summary_line = _(
                 "Messages in this channel will now be automatically deleted {number_of_days} days after they are sent."
             ).format(number_of_days=new_value)
```

**File**: `zerver/tests/test_subs.py` (modified, +83/-2)
```diff
@@ -2314,7 +2314,7 @@ def test_change_stream_message_retention_days_notifications(self) -> None:
         self.assert_length(messages, 1)
         expected_notification = (
             f"@_**Desdemona|{user_profile.id}** has changed the [message retention period](/help/message-retention-policy) for this channel:\n"
-            "* **Old retention period**: Forever\n"
+            "* **Old retention period**: Forever (organization default)\n"
             "* **New retention period**: 2 days\n\n"
             "Messages in this channel will now be automatically deleted 2 days after they are sent."
         )
@@ -2358,7 +2358,7 @@ def test_change_stream_message_retention_days_notifications(self) -> None:
         expected_notification = (
             f"@_**Desdemona|{user_profile.id}** has changed the [message retention period](/help/message-retention-policy) for this channel:\n"
             "* **Old retention period**: 8 days\n"
-            "* **New retention period**: Forever\n\n"
+            "* **New retention period**: Forever (organization default)\n\n"
             "Messages in this channel will now be retained forever."
         )
         self.assertEqual(messages[2].content, expected_notification)
@@ -2372,6 +2372,87 @@ def test_change_stream_message_retention_days_notifications(self) -> None:
         }
         self.assertEqual(realm_audit_log.extra_data, expected_extra_data)
 
+        # Go from realm default (forever) to forever
+        result = self.client_patch(
+            f"/json/streams/{stream.id}",
+            {"message_retention_days": orjson.dumps("unlimited").decode()},
+        )
+        self.assert_json_success(result)
+        messages = get_topic_messages(user_profile, stream, "channel events")
+        self.assert_length(messages, 4)
+        expected_notification = (
+            f"@_**Desdemona|{user_profile.id}** has changed the [message retention period](/help/message-retention-policy) for this channel:\n"
+            "* **Old retention period**: Forever (organization default)\n"
+            "* **New retention period**: Forever\n\n"
+            "Messages in this channel will now be retained forever."
+        )
+        self.assertEqual(messages[3].content, expected_notification)
+
+        # Go from forever to realm default (forever)
+        result = self.client_patch(
+            f"/json/streams/{stream.id}",
+            {"message_retention_days": orjson.dumps("realm_default").decode()},
+        )
+        self.assert_json_success(result)
+        messages = get_topic_messages(user_profile, stream, "channel events")
+        self.assert_length(messages, 5)
+        expected_notification = (
+            f"@_**Desdemona|{user_profile.id}** has changed the [message retention period](/help/message-retention-policy) for this channel:\n"
+            "* **Old retention period**: Forever\n"
+            "* **New retention period**: Forever (organization default)\n\n"
+            "Messages in this channel will now be retained forever."
+        )
+        self.assertEqual(messages[4].content, expected_notification)
+
+        do_set_realm_property(realm, "message_retention_days", 10, acting_user=None)
+
+        # Go from realm default (10 days) to 10 days
+        result = self.client_patch(
+            f"/json/streams/{stream.id}", {"message_retention_days": orjson.dumps(10).decode()}
+        )
+        self.assert_json_success(result)
+        messages = get_topic_messages(user_profile, stream, "channel events")
+        self.assert_length(messages, 6)
+        expected_notification = (
+            f"@_**Desdemona|{user_profile.id}** has changed the [message retention period](/help/message-retention-policy) for this channel:\n"
+            "* **Old retention period**: 10 days (organization default)\n"
+            "* **New retention period**: 10 days\n\n"
+            "Messages in this channel will now be automatically deleted 10 days after they are sent."
+        )
+        self.assertEqual(messages[5].content, expected_notification)
+
+        # Go from 10 days to realm default (10 days)
+        result = self.client_patch(
+            f"/json/streams/{stream.id}",
+            {"message_retention_days": orjson.dumps("realm_default").decode()},
+        )
+        self.assert_json_success(result)
+        messages = get_topic_messages(user_profile, stream, "channel events")
+        self.assert_length(messages, 7)
+        expected_notification = (
+            f"@_**Desdemona|{user_profile.id}** has changed the [message retention period](/help/message-retention-policy) for this channel:\n"
+            "* **Old retention period**: 10 days\n"
+            "* **New retention period**: 10 days (organization default)\n\n"
+            "Messages in this channel will now be automatically deleted 10 days after they are sent."
+        )
+        self.assertEqual(messages[6].content, expected_notification)
+
+        # Go from realm default (10 days) to forever
+ 
```

---

### Incident Patch 3: `c0b7d8bd` (2026-11-16)
**Commit Message**: message_edit: Fix move notification links breaking on topic renames.

When a topic's name can't be written in the `#**channel>topic**`
syntax, for example because it contains backticks, the notifications
sent when messages are moved fall back to a plain Markdown link to
that topic. That link had no `with` operand, unlike the link the
syntax renders to, so it stopped working once the topic was renamed
or moved again.

Fix this by adding a `with` operand to the fallback link. It uses the
latest message in the linked topic that the user who moved the
messages can access, which is the message the syntax would have
picked.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `zerver/actions/message_edit.py` (modified, +32/-3)
```diff
@@ -73,6 +73,7 @@
 from zerver.lib.timestamp import datetime_to_timestamp
 from zerver.lib.topic import (
     RESOLVED_TOPIC_PREFIX,
+    get_latest_message_for_user_in_topic,
     get_topic_display_name,
     maybe_rename_general_chat_to_empty_topic,
     messages_for_topic,
@@ -81,7 +82,10 @@
     update_edit_history,
     update_messages_for_topic_edit,
 )
-from zerver.lib.topic_link_util import get_stream_topic_link_syntax
+from zerver.lib.topic_link_util import (
+    get_stream_topic_link_syntax,
+    topic_link_needs_fallback_markdown_link,
+)
 from zerver.lib.types import (
     DirectMessageEditRequest,
     EditHistoryEvent,
@@ -334,6 +338,27 @@ def maybe_delete_previous_resolve_topic_notification(
     return True
 
 
+def get_topic_link_syntax_for_move_notification(
+    stream: Stream, topic_name: str, user_profile: UserProfile
+) -> str:
+    # The #**channel>topic** syntax gets its `with` operand when it is
+    # rendered, so we only look one up when that syntax can't be used.
+    with_message_id = None
+    if topic_link_needs_fallback_markdown_link(stream.name, topic_name):
+        assert stream.recipient_id is not None
+        with_message_id = get_latest_message_for_user_in_topic(
+            stream.realm_id,
+            user_profile,
+            stream.recipient_id,
+            topic_name,
+            stream.is_history_public_to_subscribers(),
+            acting_user_has_channel_content_access=True,
+        )
+    return get_stream_topic_link_syntax(
+        stream.id, stream.name, topic_name, with_message_id=with_message_id
+    )
+
+
 def send_message_moved_breadcrumbs(
     target_message: Message,
     user_profile: UserProfile,
@@ -352,8 +377,6 @@ def send_message_moved_breadcrumbs(
     old_topic_name = message_edit_request.orig_topic_name
     new_stream = message_edit_request.target_stream
     new_topic_name = message_edit_request.target_topic_name
-    old_topic_link = get_stream_topic_link_syntax(old_stream.id, old_stream.name, old_topic_name)
-    new_topic_link = get_stream_topic_link_syntax(new_stream.id, new_stream.name, new_topic_name)
     message = {
         "id": target_message.id,
         "stream_id": new_stream.id,
@@ -363,6 +386,9 @@ def send_message_moved_breadcrumbs(
     moved_message_link = stream_message_url(target_message.realm, message)
 
     if new_thread_notification_string is not None:
+        old_topic_link = get_topic_link_syntax_for_move_notification(
+            old_stream, old_topic_name, user_profile
+        )
         with override_language(new_stream.realm.default_language):
             internal_send_stream_message(
                 sender,
@@ -379,6 +405,9 @@ def send_message_moved_breadcrumbs(
             )
 
     if old_thread_notification_string is not None:
+        new_topic_link = get_topic_link_syntax_for_move_notification(
+            new_stream, new_topic_name, user_profile
+        )
         with override_language(old_stream.realm.default_language):
             # Send a notification to the old stream that the topic was moved.
             internal_send_stream_message(
```

**File**: `zerver/lib/topic_link_util.py` (modified, +19/-3)
```diff
@@ -58,19 +58,31 @@ def get_message_link_label(
 
 
 def get_fallback_markdown_link(
-    stream_id: int, stream_name: str, topic_name: str | None = None, message_id: int | None = None
+    stream_id: int,
+    stream_name: str,
+    topic_name: str | None = None,
+    message_id: int | None = None,
+    *,
+    with_message_id: int | None = None,
 ) -> str:
     """
     Helper that should only be called by other methods in this file.
 
     Generates the vanilla markdown link syntax for a stream/topic/message link, as
     a fallback for cases where the nicer Zulip link syntax would not
     render properly due to special characters in the channel or topic name.
+
+    `with_message_id` makes a topic link follow that message if the
+    topic is later moved or renamed, as the `#**channel>topic**` syntax
+    does when rendered.
     """
     link = f"#narrow/channel/{encode_channel(stream_id, stream_name)}"
     if topic_name is not None:
         link += f"/topic/{encode_hash_component(topic_name)}"
 
+    if with_message_id is not None:
+        link += f"/with/{with_message_id}"
+
     if message_id is not None:
         link += f"/near/{message_id}"
 
@@ -95,11 +107,15 @@ def get_message_link_syntax(
     return f"#**{stream_name}>{topic_name}@{message_id}**"
 
 
-def get_stream_topic_link_syntax(stream_id: int, stream_name: str, topic_name: str) -> str:
+def get_stream_topic_link_syntax(
+    stream_id: int, stream_name: str, topic_name: str, *, with_message_id: int | None = None
+) -> str:
     # If the stream/topic name is such that it will generate an invalid #**stream>topic** syntax,
     # we revert to generating the normal markdown syntax for a link.
     if topic_link_needs_fallback_markdown_link(stream_name, topic_name):
-        return get_fallback_markdown_link(stream_id, stream_name, topic_name)
+        return get_fallback_markdown_link(
+            stream_id, stream_name, topic_name, with_message_id=with_message_id
+        )
     return f"#**{stream_name}>{topic_name}**"
 
 
```

**File**: `zerver/tests/test_message_move_stream.py` (modified, +64/-0)
```diff
@@ -446,6 +446,70 @@ def test_move_message_to_stream(self) -> None:
             f"This topic was moved here from #**test move stream>test** by @_**Iago|{user_profile.id}**.",
         )
 
+    def test_move_message_to_topic_name_unsupported_by_topic_link_syntax(self) -> None:
+        (user_profile, old_stream, new_stream, msg_id, _msg_id_lt) = self.prepare_move_topics(
+            "iago", "test move stream", "new stream", "test"
+        )
+
+        result = self.client_patch(
+            f"/json/messages/{msg_id}",
+            {
+                "stream_id": new_stream.id,
+                "topic": "new `code` topic",
+                "propagate_mode": "change_all",
+                "send_notification_to_old_thread": "true",
+            },
+        )
+        self.assert_json_success(result)
+
+        messages = get_topic_messages(user_profile, new_stream, "new `code` topic")
+        self.assert_length(messages, 4)
+        latest_message_id_in_new_topic = messages[3].id
+
+        messages = get_topic_messages(user_profile, old_stream, "test")
+        self.assert_length(messages, 1)
+        self.assertEqual(
+            messages[0].content,
+            f"This topic was moved to [#new stream > new &#96;code&#96; topic](#narrow/channel/{new_stream.id}-new-stream/topic/new.20.60code.60.20topic/with/{latest_message_id_in_new_topic}) by @_**Iago|{user_profile.id}**.",
+        )
+
+    def test_move_message_from_topic_name_unsupported_by_topic_link_syntax(self) -> None:
+        (user_profile, old_stream, new_stream, _msg_id, msg_id_later) = self.prepare_move_topics(
+            "iago", "test move stream", "new stream", "old `code` topic"
+        )
+
+        result = self.client_patch(
+            f"/json/messages/{msg_id_later}",
+            {
+                "stream_id": new_stream.id,
+                "propagate_mode": "change_one",
+                "send_notification_to_old_thread": "false",
+                "send_notification_to_new_thread": "true",
+            },
+        )
+        self.assert_json_success(result)
+
+        messages = get_topic_messages(user_profile, old_stream, "old `code` topic")
+        self.assert_length(messages, 2)
+        latest_message_id_in_old_topic = messages[1].id
+
+        messages = get_topic_messages(user_profile, new_stream, "old `code` topic")
+        self.assert_length(messages, 2)
+        self.assertEqual(messages[0].id, msg_id_later)
+        moved_message_link = stream_message_url(
+            user_profile.realm,
+            {
+                "id": msg_id_later,
+                "stream_id": new_stream.id,
+                "display_recipient": new_stream.name,
+                "topic": "old `code` topic",
+            },
+        )
+        self.assertEqual(
+            messages[1].content,
+            f"[A message]({moved_message_link}) was moved here from [#test move stream > old &#96;code&#96; topic](#narrow/channel/{old_stream.id}-test-move-stream/topic/old.20.60code.60.20topic/with/{latest_message_id_in_old_topic}) by @_**Iago|{user_profile.id}**.",
+        )
+
     def test_move_message_to_preexisting_topic(self) -> None:
         (user_profile, old_stream, new_stream, msg_id, _msg_id_lt) = self.prepare_move_topics(
             "iago",
```

**File**: `zerver/tests/test_topic_link_util.py` (modified, +10/-0)
```diff
@@ -32,6 +32,16 @@ def test_stream_topic_link_syntax(self) -> None:
         self.assertEqual(
             get_stream_topic_link_syntax(sweden_id, "Sweden", "topic"), "#**Sweden>topic**"
         )
+        self.assertEqual(
+            get_stream_topic_link_syntax(sweden_id, "Sweden", "topic", with_message_id=123),
+            "#**Sweden>topic**",
+        )
+        self.assertEqual(
+            get_stream_topic_link_syntax(
+                sweden_id, "Sweden", "test `test` test", with_message_id=123
+            ),
+            f"[#Sweden > test &#96;test&#96; test](#narrow/channel/{sweden_id}-Sweden/topic/test.20.60test.60.20test/with/123)",
+        )
         self.assertEqual(
             get_stream_topic_link_syntax(sweden_id, "Sweden", "test `test` test"),
             f"[#Sweden > test &#96;test&#96; test](#narrow/channel/{sweden_id}-Sweden/topic/test.20.60test.60.20test)",
```

#### Recent Merged Pull Requests:
- **PR #40743** (2026-11-18): Updated translations for main from Weblate. (@mateuszmandera)
- **PR #40742** (closed): Updated translations for main from Weblate. (@mateuszmandera)
- **PR #40733** (2026-11-17): [ai] ci: Test upgrades from 13.0. (@amanagr)
- **PR #40728** (2026-11-17): [Backport] oidc: Enable PKCE. (@mateuszmandera)
- **PR #40727** (closed): message_flags: Fix marking empty topics as read. (@nikitha-bit)
- **PR #40720** (2026-11-18): message_edit: Fix "moved to" links breaking when the topic is renamed. (@evykassirer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
