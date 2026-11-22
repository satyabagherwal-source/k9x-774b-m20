# Domain G — Architecture Intelligence: Architecture Intelligence: zulip-zulip-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "zulip-zulip-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T05:51:02.181Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zulip-zulip-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zulip-zulip-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T05:51:02.181Z`  
> **Learning ID**: `LEARN-EVO-zulip-zulip-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 61%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from zulip-zulip-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source**: github ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Source Version**: `4b6608d2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T14:49:37.408Z  
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
> **Harvest Timestamp**: 2026-11-21T14:49:37.401Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zulip/zulip`
- **Description**: Zulip server and web application. Open-source team chat that helps teams stay productive and focused.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 26282 stars

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

### Incident Patch 1: `307338bc` (2026-10-30)
**Commit Message**: requirements: Upgrade brotli and brotlicffi for security fix.

Versions before brotli 1.2.1 and brotlicffi 1.2.1.0 have an
out-of-bounds write in the decoder (GHSA-9v8h-qqgm-4m35).

Generated with `uv lock --upgrade-package brotli --upgrade-package
brotlicffi`. Newer uv also reorders the resolution markers, which
changes nothing, so this keeps the original order.

**File**: `uv.lock` (modified, +113/-71)
```diff
@@ -788,85 +788,127 @@ wheels = [
 
 [[package]]
 name = "brotli"
-version = "1.2.0"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/f7/16/c92ca344d646e71a43b8bb353f0a6490d7f6e06210f8554c8f874e454285/brotli-1.2.0.tar.gz", hash = "sha256:e310f77e41941c13340a95976fe66a8a95b01e783d430eeaf7a2f87e0a57dd0a", size = 7388632, upload-time = "2025-11-05T18:39:42.86Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/64/10/a090475284fc4a71aed40a96f32e44a7fe5bda39687353dd977720b211b6/brotli-1.2.0-cp310-cp310-macosx_10_9_universal2.whl", hash = "sha256:3b90b767916ac44e93a8e28ce6adf8d551e43affb512f2377c732d486ac6514e", size = 863089, upload-time = "2025-11-05T18:38:01.181Z" },
-    { url = "https://files.pythonhosted.org/packages/03/41/17416630e46c07ac21e378c3464815dd2e120b441e641bc516ac32cc51d2/brotli-1.2.0-cp310-cp310-macosx_10_9_x86_64.whl", hash = "sha256:6be67c19e0b0c56365c6a76e393b932fb0e78b3b56b711d180dd7013cb1fd984", size = 445442, upload-time = "2025-11-05T18:38:02.434Z" },
-    { url = "https://files.pythonhosted.org/packages/24/31/90cc06584deb5d4fcafc0985e37741fc6b9717926a78674bbb3ce018957e/brotli-1.2.0-cp310-cp310-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:0bbd5b5ccd157ae7913750476d48099aaf507a79841c0d04a9db4415b14842de", size = 1532658, upload-time = "2025-11-05T18:38:03.588Z" },
-    { url = "https://files.pythonhosted.org/packages/62/17/33bf0c83bcbc96756dfd712201d87342732fad70bb3472c27e833a44a4f9/brotli-1.2.0-cp310-cp310-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:3f3c908bcc404c90c77d5a073e55271a0a498f4e0756e48127c35d91cf155947", size = 1631241, upload-time = "2025-11-05T18:38:04.582Z" },
-    { url = "https://files.pythonhosted.org/packages/48/10/f47854a1917b62efe29bc98ac18e5d4f71df03f629184575b862ef2e743b/brotli-1.2.0-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl", hash = "sha256:1b557b29782a643420e08d75aea889462a4a8796e9a6cf5621ab05a3f7da8ef2", size = 1424307, upload-time = "2025-11-05T18:38:05.587Z" },
-    { url = "https://files.pythonhosted.org/packages/e4/b7/f88eb461719259c17483484ea8456925ee057897f8e64487d76e24e5e38d/brotli-1.2.0-cp310-cp310-musllinux_1_2_aarch64.whl", hash = "sha256:81da1b229b1889f25adadc929aeb9dbc4e922bd18561b65b08dd9343cfccca84", size = 1488208, upload-time = "2025-11-05T18:38:06.613Z" },
-    { url = "https://files.pythonhosted.org/packages/26/59/41bbcb983a0c48b0b8004203e74706c6b6e99a04f3c7ca6f4f41f364db50/brotli-1.2.0-cp310-cp310-musllinux_1_2_ppc64le.whl", hash = "sha256:ff09cd8c5eec3b9d02d2408db41be150d8891c5566addce57513bf546e3d6c6d", size = 1597574, upload-time = "2025-11-05T18:38:07.838Z" },
-    { url = "https://files.pythonhosted.org/packages/8e/e6/8c89c3bdabbe802febb4c5c6ca224a395e97913b5df0dff11b54f23c1788/brotli-1.2.0-cp310-cp310-musllinux_1_2_x86_64.whl", hash = "sha256:a1778532b978d2536e79c05dac2d8cd857f6c55cd0c95ace5b03740824e0e2f1", size = 1492109, upload-time = "2025-11-05T18:38:08.816Z" },
-    { url = "https://files.pythonhosted.org/packages/ed/9a/4b19d4310b2dbd545c0c33f176b0528fa68c3cd0754e34b2f2bcf56548ae/brotli-1.2.0-cp310-cp310-win32.whl", hash = "sha256:b232029d100d393ae3c603c8ffd7e3fe6f798c5e28ddca5feabb8e8fdb732997", size = 334461, upload-time = "2025-11-05T18:38:10.729Z" },
-    { url = "https://files.pythonhosted.org/packages/ac/39/70981d9f47705e3c2b95c0847dfa3e7a37aa3b7c6030aedc4873081ed005/brotli-1.2.0-cp310-cp310-win_amd64.whl", hash = "sha256:ef87b8ab2704da227e83a246356a2b179ef826f550f794b2c52cddb4efbd0196", size = 369035, upload-time = "2025-11-05T18:38:11.827Z" },
-    { url = "https://files.pythonhosted.org/packages/7a/ef/f285668811a9e1ddb47a18cb0b437d5fc2760d537a2fe8a57875ad6f8448/brotli-1.2.0-cp311-cp311-macosx_10_9_universal2.whl", hash = "sha256:15b33fe93cedc4caaff8a0bd1eb7e3dab1c61bb22a0bf5bdfdfd97cd7da79744", size = 863110, upload-time = "2025-11-05T18:38:12.978Z" },
-    { url = "https://files.pythonhosted.org/packages/50/62/a3b77593587010c789a9d6eaa527c79e0848b7b860402cc64bc0bc28a86c/brotli-1.2.0-cp311-cp311-macosx_10_9_x86_64.whl", hash = "sha256:898be2be399c221d2671d29eed26b6b2713a02c2119168ed914e7d00ceadb56f", size = 445438, upload-time = "2025-11-05T18:38:14.208Z" },
-    { url = "https://files.pythonhosted.org/packages/cd/e1/7fadd47f40ce5549dc44493877db40292277db373da5053aff181656e16e/brotli-1.2.0-cp311-cp311-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:350c8348f0e76fff0a0fd6c26755d2653863279d086d3aa2c290a6a7251135dd", size = 1534420, upload-time = "2025-11-05T18:38:15.111Z" },
-    { url = "https://files.pythonhosted.org/packages/12/8b/1ed2f64054a5a008a4ccd2f271dbba7a5fb1a3067a99f5ceadedd4c1d5a7/brotli-1.2.0-cp311-cp311-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:2e1ad3fda65ae0d93fec742a128d72e145c9c7a99ee2fcd667785d99eb25a7fe", size = 1632619, upload-time = "2025
```

**File**: `version.py` (modified, +1/-1)
```diff
@@ -48,4 +48,4 @@
 #   historical commits sharing the same major version, in which case a
 #   minor version bump suffices.
 
-PROVISION_VERSION = (394, 1)  # bumped 2026-10-27 to rebuild emoji_names
+PROVISION_VERSION = (394, 2)  # bumped 2026-11-09 to upgrade brotli
```

---

### Incident Patch 2: `263b6ac5` (2026-11-15)
**Commit Message**: outgoing_webhook: Fix exception text ending its code block early.

The exception text was put in a code block with a fixed fence, so a
fence in the text ended the code block early.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/lib/outgoing_webhook.py` (modified, +2/-1)
```diff
@@ -15,6 +15,7 @@
 from version import ZULIP_VERSION
 from zerver.actions.message_send import check_send_message
 from zerver.lib.exceptions import JsonableError, StreamDoesNotExistError
+from zerver.lib.markdown.fenced_code import wrap_in_code_block
 from zerver.lib.message_cache import MessageDict
 from zerver.lib.outgoing_http import OutgoingSession
 from zerver.lib.queue import retry_event
@@ -273,7 +274,7 @@ def notify_bot_owner(
     if exception:
         notification_message += (
             "\nWhen trying to send a request to the webhook service, an exception "
-            f"of type {type(exception).__name__} occurred:\n```\n{exception}\n```"
+            f"of type {type(exception).__name__} occurred:\n{wrap_in_code_block(str(exception))}"
         )
     elif failure_message:
         notification_message += "\n" + failure_message
```

---

### Incident Patch 3: `b7447c20` (2026-07-21)
**Commit Message**: markdown: Fix `MarkdownListPreprocessor`'s list regex.

Previously, LIST_ITEM_REGEX only matched single-digit list items. This
updates it to match multi-digit list items (up to 9 digits, to be
exact) and only Arabic digits.

The CommonMark spec for list items says:

```
An ordered list marker is a sequence of 1–9 arabic digits (0-9),
followed by either a . character or a ) character. (The reason for
the length limit is that with 10 digits we start seeing integer
overflows in some browsers.)
```

https://spec.commonmark.org/0.26/#list-items

We still don't handle list items that use the ")" character, but we're
pretty clear about this limitation in the help center.

Fixes #39797.

Co-authored-by: PieterCK <[REDACTED_EMAIL]>

**File**: `zerver/lib/markdown/__init__.py` (modified, +4/-4)
```diff
@@ -1536,10 +1536,10 @@ class Fence:
 
 LIST_ITEM_REGEX = re.compile(
     r"""
-    ^[ ]*        # Start with zero or more spaces
-    ([*+-]|\d\.) # A bullet marker (*, +, or -) or a digit followed by "."
-    [ ]+         # Followed by one or more spaces
-    (.*)         # The list content, which could be empty
+    ^[ ]*                   # Start with zero or more spaces
+    ([*+-]|[0-9]{1,9}\.)    # A bullet marker (*, +, or -) or 1-9 digits followed by "."
+    [ ]+                    # Followed by one or more spaces
+    (.*)                    # The list content, which could be empty
     """,
     re.VERBOSE,
 )
```

**File**: `zerver/tests/fixtures/markdown_test_cases.json` (modified, +20/-0)
```diff
@@ -423,6 +423,26 @@
       "expected_output": "<ol>\n<li>A</li>\n<li>B<ol start=\"2\">\n<li>C</li>\n</ol>\n</li>\n<li>D</li>\n</ol>",
       "text_content": "1. A\n2. B\n  2. C\n3. D"
     },
+    {
+      "name": "numbered_list_double_digit",
+      "input": "8. eight\n9. nine\n10. ten",
+      "expected_output": "<ol start=\"8\">\n<li>eight</li>\n<li>nine</li>\n<li>ten</li>\n</ol>",
+      "text_content": "8. eight\n9. nine\n10. ten"
+    },
+    {
+      "name": "numbered_list_double_digit_after_unordered_list",
+      "input": "8. eight\n9. nine\n   - sub item\n10. ten",
+      "expected_output": "<ol start=\"8\">\n<li>eight</li>\n<li>\n<p>nine</p>\n<ul>\n<li>sub item</li>\n</ul>\n</li>\n<li>\n<p>ten</p>\n</li>\n</ol>",
+      "marked_expected_output": "<ol start=\"8\">\n<li>eight</li>\n<li>nine<ul>\n<li>sub item</li>\n</ul>\n</li>\n<li>ten</li>\n</ol>",
+      "text_content": "8. eight\n9. nine\n\nsub item\n10. ten"
+    },
+    {
+      "name": "numbered_list_nine_digit_cap",
+      "input": "999999999. nine nines\n9999999999. ten digits",
+      "expected_output": "<ol start=\"999999999\">\n<li>nine nines</li>\n<li>ten digits</li>\n</ol>",
+      "marked_expected_output": "<ol start=\"999999999\">\n<li>nine nines<br>\n9999999999. ten digits</li>\n</ol>",
+      "text_content": "999999999. nine nines\n1000000000. ten digits"
+    },
     {
       "name": "linkify_interference",
       "input": "link: xx, x xxxxx xx xxxx xx\n\n[xxxxx #xx](http://xxxxxxxxx:xxxx/xxx/xxxxxx%78xxxx/xx/):**xxxxxxx**\n\nxxxxxxx xxxxx xxxx xxxxx:\n`xxxxxx`: xxxxxxx\n`xxxxxx`: xxxxx\n`xxxxxx`: xxxxx xxxxx",
```

**File**: `zerver/tests/test_markdown.py` (modified, +5/-0)
```diff
@@ -528,6 +528,11 @@ def test_basic_list(self) -> None:
         original, expected = self.split_message("List without a gap\n<>* One\n* Two")
         self.assertEqual(preprocessor.run(original), expected)
 
+    def test_basic_list_with_double_digit_numbers(self) -> None:
+        preprocessor = MarkdownListPreprocessor()
+        original, expected = self.split_message("List without a gap\n<>10. One\n11. Two")
+        self.assertEqual(preprocessor.run(original), expected)
+
     def test_list_after_quotes(self) -> None:
         preprocessor = MarkdownListPreprocessor()
         original, expected = self.split_message(
```

#### Recent Merged Pull Requests:
- **PR #40767** (2026-11-21): message_fetch: Don't backfill message history for spectators. (@mateuszmandera)
- **PR #40766** (2026-11-21): requirements: Upgrade brotli and brotlicffi for security fix. (@mateuszmandera)
- **PR #40763** (2026-11-20): demo-orgs: Restrict invitations until owner has set an email. (@mateuszmandera)
- **PR #40757** (closed): [ai] compose_paste: Fix lost anchors in pasted topic permalinks. (@Celestial-0)
- **PR #40756** (closed): [ai] portico: Fix RTL layout on login and footer pages. (@mo23hammad)
- **PR #40747** (2026-11-18): skills: Keep exploit details out of security advisories. (@mateuszmandera)

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
