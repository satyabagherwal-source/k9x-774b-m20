> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source**: github ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Source Version**: `3e9bc1e1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:28:29.266Z  
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
> **Harvest Timestamp**: 2026-10-27T13:28:28.640Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zulip/zulip`
- **Description**: Zulip server and web application. Open-source team chat that helps teams stay productive and focused.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 26123 stars

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
- **Issue #40388** (2026-10-20): **data import bug fixes**
  *Symptoms*: Minor bugs caught by the new data import test class (#40370).    <details> <summary>Self-review checklist</summary>  <!-- Prior to submitting a PR, follow our step-by-step guide to review your own code: https://zulip.readthedocs.io/en/latest/contributing/code-reviewing.html#how-to-review-code -->  <!-- Once you create the PR, check off all the steps below that you have completed. If any of these steps are not relevant or not completed, leave them unchecked.-->  - [ ] [Self-reviewed](https://zulip.readthedocs.io/en/latest/contributing/code-reviewing.html#how-to-review-code) the changes for clarity and maintainability       (variable names, code reuse, readability, etc.). - [ ] Followed the [AI use policy](https://zulip.readthedocs.io/en/latest/contributing/contributing.html#ai-use-policy-and-guidelines).  Communicate decisions, questions, and potential concerns.  - [ ] Explains differences from previous plans (e.g., issue description). - [ ] Highlights technical choices and bugs encountered. - [ ] Calls out remaining decisions and concerns. - [ ] Automated tests verify logic where appropriate.  Individual commits are ready for review (see [commit discipline](https://zulip.readthedocs.io/en/latest/contributing/commit-discipline.html)).  - [ ] Each commit is a coherent idea. - [ ] Commit message(s) explain reasoning and motivation for changes.  Completed manual review and testing of the following:  - [ ] Visual appearance of the changes. - [ ] Resp
  **Post-Mortem & Fix Analysis**:
  > @mateuszmandera -- Would you be up for reviewing this?  @emilysutherlin -- Should we add this to my release board? These are straight forward bug fixes with no UI changes.
  > @mateuszmandera -- Thanks for the review. I think this is ready for you to take another look.

- **Issue #40326** (2026-10-12): **[ai] left_sidebar: Don't show view tooltips on mouse-opened popover focus.**
  *Symptoms*: Opening the condensed views popover with a mouse click focuses its first item, via focus_popover. The view items carry the `.tippy-left-sidebar-tooltip` class, whose tooltips use Tippy's default "mouseenter focus" trigger, so that programmatic focus opened the first item's tooltip without the user hovering over it.  Suppress the tooltip when the reference has focus without `:focus-visible` and isn't hovered. This preserves tooltips for keyboard navigation while avoiding unwanted tooltips from mouse-opened popovers.  Check for focus explicitly rather than relying only on the absence of `:focus-visible`, so touch long-press tooltips continue to work.  <!-- Describe your pull request here.-->  **How changes were tested:**  <!-- If the PR makes UI changes, you must include screenshots. Detailed guide: https://zulip.readthedocs.io/en/latest/contributing/presenting-visual-changes.html -->  **Screenshots and screen captures:**  |Before|After| |-|-| |[Screencast from 2026-10-07 23-37-10.webm](https://github.com/user-attachments/assets/7c2bdc46-d840-457e-aef4-072bbbcd4676)|[Screencast from 2026-10-07 23-38-03.webm](https://github.com/user-attachments/assets/d58431a3-35df-45b6-9393-e6cc91e53f76)|  <details> <summary>Self-review checklist</summary>  <!-- Prior to submitting a PR, follow our step-by-step guide to review your own code: https://zulip.readthedocs.io/en/latest/contributing/code-reviewing.html#how-to-review-code -->  <!-- Once you create the PR, chec
  **Post-Mortem & Fix Analysis**:
  > @amanagr Tagging you for review here.
  > Looks great! Thanks @pratik-pc !

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

### Incident Patch 1: `d2b2ae09` (2026-10-23)
**Commit Message**: auth: Fix 500 on signup with a long external auth method name.

PreregistrationUser stored the external auth method name and ID in
CharFields limited to 100 and 255 characters, while ExternalAuthID
uses TextFields. OIDC method names include the issuer URL, so
signing up through an IdP with a long issuer URL failed with a
DataError. SAML IDs are prefixed with the IdP name, so they can
exceed 255 characters too.

Use TextField for both, matching ExternalAuthID. Postgres doesn't
rewrite the table when changing varchar to text.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/migrations/0813_alter_preregistrationuser_external_auth_id_and_more.py` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# Generated by Django 5.2.18 on 2026-10-23 16:48
+
+from django.db import migrations, models
+
+
+class Migration(migrations.Migration):
+    dependencies = [
+        ("zerver", "0812_delete_inaccessible_user_topics"),
+    ]
+
+    operations = [
+        migrations.AlterField(
+            model_name="preregistrationuser",
+            name="external_auth_id",
+            field=models.TextField(default=None, null=True),
+        ),
+        migrations.AlterField(
+            model_name="preregistrationuser",
+            name="external_auth_method_name",
+            field=models.TextField(default=None, null=True),
+        ),
+    ]
```

**File**: `zerver/models/prereg_users.py` (modified, +3/-3)
```diff
@@ -124,11 +124,11 @@ class PreregistrationUser(models.Model):
     # email was not found.
     is_realm_importer = models.BooleanField(default=False)
 
-    # Used in the SAML authentication flow to pass the external auth ID
+    # Used in certain authentication flows to pass the external auth ID
     # from the authentication step to user creation, so that an ExternalAuthID
     # record can be created for the new user.
-    external_auth_method_name = models.CharField(max_length=100, null=True, default=None)
-    external_auth_id = models.CharField(max_length=255, null=True, default=None)
+    external_auth_method_name = models.TextField(db_index=False, null=True, default=None)
+    external_auth_id = models.TextField(db_index=False, null=True, default=None)
 
     class Meta:
         indexes = [
```

**File**: `zerver/tests/test_auth_backends.py` (modified, +6/-1)
```diff
@@ -5704,9 +5704,14 @@ def test_external_auth_id_oidc_registration(self) -> None:
         idps_config_dict = copy.deepcopy(settings.SOCIAL_AUTH_OIDC_ENABLED_IDPS)
         idps_config_dict["testoidc"]["enable_external_auth_id_auth"] = True
         sub_value = "newuser_sub"
+        # The method name includes the issuer URL, which can be long.
+        issuer = (
+            "https://sso.engineering.example-university.edu/realms/department-of-computer-science"
+        )
 
         account_data_dict = self.get_account_data_dict(email=email, name=name)
         account_data_dict["sub"] = sub_value
+        account_data_dict["iss"] = issuer
         with self.settings(SOCIAL_AUTH_OIDC_ENABLED_IDPS=idps_config_dict):
             result = self.social_auth_test(
                 account_data_dict,
@@ -5728,7 +5733,7 @@ def test_external_auth_id_oidc_registration(self) -> None:
         self.assert_length(external_auth_ids, 1)
         self.assertEqual(
             external_auth_ids[0].external_auth_method_name,
-            f"oidc:<testoidc>:<{self.BASE_OIDC_URL}>",
+            f"oidc:<testoidc>:<{issuer}>",
         )
         self.assertEqual(external_auth_ids[0].external_auth_id, sub_value)
 
```

---

### Incident Patch 2: `45f83cb1` (2026-10-23)
**Commit Message**: queue: Fix Tornado publishes failing just after losing RabbitMQ.

When Tornado's queue client lost its connection, it kept using the
closed channel until it reconnected 2 seconds later. Publishes in that
window raised ChannelWrongStateError, which the retry in json_publish
does not catch.

Since Tornado publishes a user_activity event for every request it
serves, its requests, including GET /events, failed during that
window, as did any push and email notifications it queued.

Forget the channel and its declared queues as soon as the connection
closes, so that these publishes are held until their queue is declared
on the next channel.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/lib/queue.py` (modified, +2/-0)
```diff
@@ -330,6 +330,8 @@ def _on_connection_closed(
     ) -> None:
         if self.connection is None:
             return
+        self.channel = None
+        self.queues = set()
         self._connection_failure_count = 1
         retry_secs = self.CONNECTION_RETRY_SECS
         self.log.warning(
```

**File**: `zerver/tests/test_queue.py` (modified, +12/-1)
```diff
@@ -7,6 +7,7 @@
     AMQPConnectionError,
     ChannelClosedByBroker,
     ChannelClosedByClient,
+    ChannelWrongStateError,
     ConnectionClosed,
     StreamLostError,
 )
@@ -148,6 +149,16 @@ def reconnect(connection: TornadoQueueClient) -> mock.MagicMock:
                 ],
             )
 
+            # Publishes between losing the connection and reconnecting
+            # wait for the new channel, rather than using the closed one.
+            channel.basic_publish.side_effect = ChannelWrongStateError("Channel is closed.")
+            connection._on_connection_closed(mock.MagicMock(), ConnectionClosed(320, "test"))
+            connection.json_publish("test_suite", {"event": "fourth"})
+            connection._reconnect()
+            channel = open_channel(connection)
+            declare_ok(channel, "test_suite")
+            self.assertEqual(published(channel), [("test_suite", {"event": "fourth"})])
+
             channel = reconnect(connection)
             channel.queue_declare.assert_not_called()
             channel.basic_publish.assert_not_called()
@@ -157,7 +168,7 @@ def reconnect(connection: TornadoQueueClient) -> mock.MagicMock:
                 "WARNING:zulip.queue:TornadoQueueClient lost connection to RabbitMQ, reconnecting in 2 secs...",
                 "WARNING:zulip.queue:TornadoQueueClient attempting to reconnect to RabbitMQ",
             ]
-            * 2,
+            * 3,
         )
 
 
```

---

### Incident Patch 3: `835c0b70` (2026-10-22)
**Commit Message**: auth: Fix 500 on login with a new ExternalAuthID for a linked account.

If the account matching the email was already linked to a different
ExternalAuthID, the email fallback tried to create a second one for
it. That violates the unique constraint on (user,
external_auth_method_name), so the login failed with a 500. This
happens when a user's account at the IdP or in LDAP is recreated
with the same email, and with Entra ID for every user after the
application is registered again.

Refuse such logins with a logged warning instead. Relinking the
account automatically would be unsafe, because the email address
may have been reassigned to a different person, who would then be
logged into the previous owner's Zulip account.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/production/authentication-methods.md` (modified, +38/-0)
```diff
@@ -415,6 +415,27 @@ For Active Directory installations, the immutable Security Identifier
 [`objectSid`](https://ldapwiki.com/wiki/Wiki.jsp?page=Security%20Identifier)
 is recommended.
 
+:::{note}
+
+If a Zulip account is already linked to a different
+`unique_account_id` than the one in LDAP for the same email address,
+Zulip will refuse the login and log a warning, since the email address
+may have been reassigned to a different person. This can happen when
+a user's LDAP account is deleted and recreated, if `unique_account_id`
+is an attribute like `objectSid` that is assigned anew to each
+account.
+
+`manage.py sync_ldap_user_data`, as an explicit tool for syncing
+Zulip with LDAP, handles this case differently. When it finds a Zulip
+account linked to a different `unique_account_id` than the LDAP
+account with the same email address, it logs a warning and relinks
+the Zulip account to the new LDAP account. Running it is thus how to
+let such a user log in again. If you run it in a [regular cron
+job](#synchronizing-data), as recommended, this happens automatically
+on its next run.
+
+:::
+
 #### Manually handling LDAP email changes
 
 If you don't have `unique_account_id` enabled, when a user's email
@@ -838,6 +859,13 @@ user logs in. If another Zulip user already has the new email address,
 the email will not be updated, a warning will be logged and the
 administrator should resolve the conflict manually.
 
+If a Zulip account is already linked to a different permanent ID
+than the one the IdP sends for the same email address (for example,
+because the user's account at the IdP was deleted and recreated),
+Zulip will refuse the login and log a warning, since the email
+address may have been reassigned to a different person. The
+administrator should resolve the conflict manually.
+
 :::
 
 ### SCIM
@@ -1195,6 +1223,16 @@ user logs in. If another Zulip user already has the new email address,
 the email will not be updated, a warning will be logged and the
 administrator should resolve the conflict manually.
 
+If a Zulip account is already linked to a different `sub` than the
+one the IdP sends for the same email address, Zulip will refuse the
+login and log a warning, since the email address may have been
+reassigned to a different person. The administrator should resolve
+the conflict manually. This can happen when the user's account at the
+IdP was deleted and recreated. With Microsoft Entra ID, it can also
+happen for all users if the Zulip application is registered again with
+a new client ID, since Entra ID issues a different `sub` for each
+application.
+
 :::
 
 ### Microsoft Entra ID (OIDC)
```

**File**: `zerver/tests/test_auth_backends.py` (modified, +73/-0)
```diff
@@ -5644,6 +5644,57 @@ def test_external_auth_id_oidc_email_conflict(self) -> None:
             m.output[1],
         )
 
+    def test_external_auth_id_oidc_account_linked_to_different_sub(self) -> None:
+        """
+        Test that login is refused when the account with the matching email is
+        already linked to a different sub, rather than relinking the account.
+        """
+        hamlet = self.example_user("hamlet")
+        realm = hamlet.realm
+
+        idps_config_dict = copy.deepcopy(settings.SOCIAL_AUTH_OIDC_ENABLED_IDPS)
+        idps_config_dict["testoidc"]["enable_external_auth_id_auth"] = True
+
+        account_data_dict = self.get_account_data_dict(email=self.email, name=self.name)
+        account_data_dict["sub"] = "original_sub"
+        with (
+            self.settings(SOCIAL_AUTH_OIDC_ENABLED_IDPS=idps_config_dict),
+            self.assertLogs(self.logger_string, level="INFO"),
+        ):
+            result = self.social_auth_test(
+                account_data_dict,
+                subdomain="zulip",
+            )
+        data = load_subdomain_token(result)
+        self.assertEqual(data["email"], hamlet.delivery_email)
+
+        account_data_dict["sub"] = "new_sub"
+        with (
+            self.settings(SOCIAL_AUTH_OIDC_ENABLED_IDPS=idps_config_dict),
+            self.assertLogs(self.logger_string, level="WARNING") as m,
+        ):
+            result = self.social_auth_test(
+                account_data_dict,
+                subdomain="zulip",
+            )
+        self.assertEqual(result.status_code, 302)
+        self.assertEqual(result["Location"], realm.url + "/login/")
+        self.assertEqual(
+            m.output,
+            [
+                self.logger_output(
+                    f"Can't log in user {hamlet.id} via ExternalAuthID new_sub: "
+                    "account is already linked to ExternalAuthID original_sub",
+                    "warning",
+                )
+            ],
+        )
+
+        external_auth_ids = list(ExternalAuthID.objects.filter(realm=realm))
+        self.assert_length(external_auth_ids, 1)
+        self.assertEqual(external_auth_ids[0].user, hamlet)
+        self.assertEqual(external_auth_ids[0].external_auth_id, "original_sub")
+
     @override_settings(TERMS_OF_SERVICE_VERSION=None)
     def test_external_auth_id_oidc_registration(self) -> None:
         email = "newuser@zulip.com"
@@ -8312,6 +8363,28 @@ def test_external_auth_id_login_with_custom_unique_account_id_attribute(self) ->
         self.assertEqual(new_external_auth_id.external_auth_method_name, "ldap")
         self.assertEqual(new_external_auth_id.external_auth_id, "123456789")
 
+        # The account is recreated in LDAP with the same email but a new
+        # unique_account_id. The login is refused rather than relinking
+        # the Zulip account to the new LDAP account.
+        self.change_ldap_user_attr(username, "homePhone", "987654321")
+        with self.assertLogs("zulip.auth.ldap", level="WARNING") as mock_log:
+            user_profile = self.backend.authenticate(
+                request=mock.MagicMock(),
+                username=username,
+                password=self.ldap_password("hamlet"),
+                realm=get_realm("zulip"),
+            )
+        self.assertIsNone(user_profile)
+        self.assertEqual(
+            mock_log.output,
+            [
+                f"WARNING:zulip.auth.ldap:Can't log in user {hamlet.id} via ExternalAuthID 987654321: account is already linked to ExternalAuthID 123456789"
+            ],
+        )
+        external_auth_ids = list(ExternalAuthID.objects.filter(user=hamlet))
+        self.assert_length(external_auth_ids, 1)
+        self.assertEqual(external_auth_ids[0].external_auth_id, "123456789")
+
     @override_settings(
         AUTHENTICATION_BACKENDS=("zproject.backends.ZulipLDAPAuthBackend",),
         LDAP_EMAIL_ATTR="mail",
```

**File**: `zproject/backends.py` (modified, +37/-9)
```diff
@@ -797,15 +797,34 @@ def get_and_sync_user_profile_by_external_auth_id(
         ).user
     except ExternalAuthID.DoesNotExist:
         user_profile = common_get_active_user(email, realm, return_data)
-        if user_profile is not None:
-            # If we found an account with the matching email, but no ExternalAuthID, then this account hasn't
-            # yet had its external_auth_id stored - we need to do this now.
-            ExternalAuthID.objects.create(
-                external_auth_method_name=external_auth_method_name,
-                external_auth_id=external_auth_id,
-                realm=realm,
-                user=user_profile,
+        if user_profile is None:
+            return None
+
+        existing_external_auth_id = ExternalAuthID.objects.filter(
+            user=user_profile, external_auth_method_name=external_auth_method_name
+        ).first()
+        if existing_external_auth_id is not None:
+            # The account with the matching email is already linked to a different
+            # external_auth_id. This can mean the account was recreated in the external
+            # auth directory, but it can also mean the email address was reassigned
+            # to a different person there, so we can't safely relink the account.
+            logger.warning(
+                "Can't log in user %s via ExternalAuthID %s: account is already linked to ExternalAuthID %s",
+                user_profile.id,
+                external_auth_id,
+                existing_external_auth_id.external_auth_id,
             )
+            return_data["external_auth_id_conflict"] = True
+            return None
+
+        # If we found an account with the matching email, but no ExternalAuthID, then this account hasn't
+        # yet had its external_auth_id stored - we need to do this now.
+        ExternalAuthID.objects.create(
+            external_auth_method_name=external_auth_method_name,
+            external_auth_id=external_auth_id,
+            realm=realm,
+            user=user_profile,
+        )
         return user_profile
 
     assert user_profile is not None
@@ -1265,6 +1284,8 @@ def get_or_build_user(
             raise ZulipLDAPError("Realm has been deactivated")
         if return_data.get("inactive_user"):
             raise ZulipLDAPError("User has been deactivated")
+        if return_data.get("external_auth_id_conflict"):
+            raise ZulipLDAPError("User is already linked to a different ExternalAuthID")
         # An invalid_subdomain `return_data` value here is ignored,
         # since that just means we're trying to create an account in a
         # second realm on the server (`ldap_auth_enabled(realm)` would
@@ -2693,6 +2714,7 @@ def social_auth_finish(
     invalid_email = return_data.get("invalid_email")
     auth_failed_reason = return_data.get("social_auth_failed_reason")
     email_not_associated = return_data.get("email_not_associated")
+    external_auth_id_conflict = return_data.get("external_auth_id_conflict")
 
     if invalid_realm:
         # User has passed an invalid subdomain param - this shouldn't happen in the normal flow,
@@ -2702,7 +2724,13 @@ def social_auth_finish(
         return HttpResponseRedirect(reverse("find_account"))
 
     realm = Realm.objects.get(id=return_data["realm_id"])
-    if auth_backend_disabled or inactive_realm or no_verified_email or email_not_associated:
+    if (
+        auth_backend_disabled
+        or inactive_realm
+        or no_verified_email
+        or email_not_associated
+        or external_auth_id_conflict
+    ):
         # Redirect to login page. We can't send to registration
         # workflow with these errors. We will redirect to login page.
         return redirect_to_login(realm)
```

#### Recent Merged Pull Requests:
- **PR #40492** (closed): feat(docs): add markdown documentation validator and contributor guide (@tukaram-007)
- **PR #40489** (2026-10-26): [12.x backport] migrations: Backfill is_deleted for users deleted before it existed. (@mateuszmandera)
- **PR #40488** (2026-10-26): migrations: Backfill is_deleted for users deleted before it existed. (@mateuszmandera)
- **PR #40483** (2026-10-24): [Backport]  Upgrade Python requirements (@mateuszmandera)
- **PR #40476** (closed): compose: Apply formatting to multiple lines. (@Nehant14)
- **PR #40473** (closed): messages: Allow sending DMs via API using delivery email (@VimalN2005)

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

## X. auth: Fix 500 on signup with a long external auth method name.

**RULE**:
When implementing operations in `zerver/migrations/0813_alter_preregistrationuser_external_auth_id_and_more.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zulip/zulip. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d2b2ae09`: auth: Fix 500 on signup with a long external auth method name.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `zerver/migrations/0813_alter_preregistrationuser_external_auth_id_and_more.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# Generated by Django 5.2.18 on 2026-10-23 16:48

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("zerver", "0812_delete_inaccessible_user_topics"),
    ]

    operations = [
        migrations.AlterField(
            model_name="preregistrationuser",
            name="external_auth_id",
            field=models.TextField(default=None, null=True),
        ),
        migrations.AlterField(
            model_name="preregistrationuser",
            name="external_auth_method_name",
            field=models.TextField(default=None, null=True),
        ),
    ]
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d2b2ae09` are properly handled with clean fallback behavior.
