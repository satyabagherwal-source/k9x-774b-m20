# Forensic Learning Record (Deep Inspection): zulip/zulip

> **Canonical Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:41:02.725Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zulip/zulip`
- **Description**: Zulip server and web application. Open-source team chat that helps teams stay productive and focused.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 25995 stars

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

# Soft reactivations share the deferred_work queue unless a server opts
# into a dedicated queue; only then is there a consumer to monitor.
if get_config(get_config_file(), "application_server", "dedicated_soft_reactivation_queue", False):
    normal_queues.append("soft_reactivation")

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

### Core Architecture Module: `scripts/lib/queue_workers.py`
```
#!/usr/bin/env python3
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(BASE_DIR)
from scripts.lib.setup_path import setup_path

setup_path()

os.environ["DJANGO_SETTINGS_MODULE"] = "zproject.settings"

import django

django.setup()
from zerver.worker.queue_processors import get_active_worker_queues

if __name__ == "__main__":
    for worker in sorted(get_active_worker_queues()):
        print(worker)

```

### Core Architecture Module: `scripts/lib/run_hooks.py`
```
#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from scripts.lib.zulip_tools import (
    DEPLOYMENTS_DIR,
    assert_running_as_root,
    get_deploy_root,
    get_zulip_pwent,
    parse_version_from,
    su_to_zulip,
)

assert_running_as_root()

# Updates to the below choices to add a new hook type should
# adjust puppet's `app_frontend_base.pp` as well.
parser = argparse.ArgumentParser()
parser.add_argument("kind", choices=["pre-deploy", "post-deploy"], help="")
parser.add_argument("--from-git", action="store_true", help="Upgrading from git")
args = parser.parse_args()

from version import ZULIP_MERGE_BASE as NEW_ZULIP_MERGE_BASE
from version import ZULIP_VERSION as NEW_ZULIP_VERSION

deploy_path = get_deploy_root()

if args.kind == "post-deploy":
    old_dir_name = "last"
    if not os.path.exists(DEPLOYMENTS_DIR + "/last"):
        # Fresh installs which are doing an OS upgrade don't have a
        # "last" yet
        old_dir_name = "current"
else:
    old_dir_name = "current"
old_version = parse_version_from(DEPLOYMENTS_DIR + "/" + old_dir_name)
old_merge_base = parse_version_from(DEPLOYMENTS_DIR + "/" + old_dir_name, merge_base=True)

path = f"/etc/zulip/hooks/{args.kind}.d"
if not os.path.exists(path):
    sys.exit(0)

# Pass in, via environment variables, the old/new "version
# string" (which is a `git describe` output)
env = os.environ.copy()
env["ZULIP_OLD_VERSION"] = old_version
env["ZULIP_NEW_VERSION"] = NEW_ZULIP_VERSION

# preexec_fn=su_to_zulip normally handles this, but our explicit
# env overrides that
env["HOME"] = get_zulip_pwent().pw_dir


def resolve_version_string(version: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", version], cwd=deploy_path, preexec_fn=su_to_zulip, text=True
    ).strip()


if args.from_git:
    # If we have a git repo, we also resolve those `git describe`
    # values to full commit hashes, as well as provide the
    # merge-base of the old/new commits with mainline.
    env["ZULIP_OLD_COMMIT"] = resolve_version_string(old_version)
    env["ZULIP_NEW_COMMIT"] = resolve_version_string(NEW_ZULIP_VERSION)
    env["ZULIP_OLD_MERGE_BASE_COMMIT"] = resolve_version_string(old_merge_base)
    env["ZULIP_NEW_MERGE_BASE_COMMIT"] = resolve_version_string(NEW_ZULIP_MERGE_BASE)

failures = []
for script_name in sorted(f for f in os.listdir(path) if f.endswith(".hook")):
    result = subprocess.run(
        [os.path.join(path, script_name)],
        check=False,
        cwd=deploy_path,
        preexec_fn=su_to_zulip,
        env=env,
    )
    if result.returncode != 0:
        # Pre-deploy hooks abort on the first failure; post-deploy
        # hooks are best-effort and a failure of one does not abort
        # the rest of them.
        if args.kind == "pre-deploy":
            sys.exit(1)
        failures.append(script_name)

if failures:
    print("Failed hooks:")
    for failed_script in failures:
        print(f"  {failed_script}")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #40230** (2026-09-28): **Authentication failure for flush-memcached during install**
  *Symptoms*: Trying to install Zulip server 12.3 on a fresh VM of Debian 13.  ``` $ sudo zulip-server-12.3/scripts/setup/install --push--notifications --email=somebody@example.com --hostname example.com --self-signed-cert ... CREATE DATABASE "zulip"     OWNER=zulip     ENCODING=UTF8     LC_COLLATE='C.UTF-8'     LC_CTYPE='C.UTF-8'     TEMPLATE=template0; CREATE DATABASE You are now connected to database "zulip" as user "postgres". + '[' zulip '!=' zulip ']' + '[' -e /home/zulip/deployments ']' + /home/zulip/deployments/current/scripts/setup/flush-memcached Traceback (most recent call last):   File "/home/zulip/deployments/current/scripts/setup/flush-memcached", line 24, in <module>     client.flush_all()     ~~~~~~~~~~~~~~~~^^   File "/home/zulip/deployments/2026-09-28-08-57-30/.venv/lib/python3.13/site-packages/bmemcached/client/mixin.py", line 95, in flush_all     returns.append(server.flush_all(time))                    ~~~~~~~~~~~~~~~~^^^^^^   File "/home/zulip/deployments/2026-09-28-08-57-30/.venv/lib/python3.13/site-packages/bmemcached/protocol.py", line 1009, in flush_all     self._send(struct.pack(self.HEADER_STRUCT +     ~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                            self.COMMANDS['flush']['struct'],                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                            self.MAGIC['request'],                            ^^^^^^^^^^^^^^^^^^^^^^                            self.COMMANDS['flush']['command'],                            ^^^^^^^^^^^
  **Post-Mortem & Fix Analysis**:
  > Hi @frezik! I'm unsure if the typos in the input above are original, or just introduced when anonymizing the information to post here. But I see a second dash in the middle of `--push--notifications`, and a missing '=' for the hostname flag.  If that's not it, you can seek interactive installation help in our [Development Community](https://zulip.com/development-community/)! The #production help channel will be the place.
  > Thanks, @emilysutherlin , and yes, that was a copy/paste error. Problem still occurs with the correct setting.
  > @frezik, are you able to join [Development Community](https://zulip.com/development-community/) and chat in the #production help channel? The right eyes will see your request for assistance there.

- **Issue #40172** (2026-09-21): **Missing gcc-c++ dependencies for Fedora/RHEL in ./tools/provision**
  *Symptoms*:  ### Description  ./tools/provision fails on Fedora/RHEL during the `uv sync` step because `pyicu` needs the C++ compiler (`g++`) to build, but only the C compiler (`gcc`) is listed in the dependencies. On Debian/Ubuntu this isn't a problem because both come together, but on Fedora/RHEL `gcc` and `gcc-c++` are separate packages.  Error Encountered:   ``` error: [Errno 2] No such file or directory: 'g++' ```  This happens in the [Advanced setup (non-Vagrant)]  (https://zulip.readthedocs.io/en/latest/development/setup-advanced.html) on Fedora or RHEL. **Expected behavior:** Running `./tools/provision` should install all required system packages and complete successfully.  **Actual behavior:** The `uv sync` step fails while building the `pyicu` Python package because `g++` (the C++ compiler) is not installed. The error looks like:  ``` error: [Errno 2] No such file or directory: 'g++' ```  The dependency list in `scripts/lib/setup_venv.py` includes `gcc` (C compiler) for Fedora/RHEL systems, but not `gcc-c++` (C++ compiler). The `pyicu` package requires C++ to compile.  On Debian/Ubuntu this is not a problem because `gcc` and `g++` are usually installed together via `build-essential`. On Fedora/RHEL, they are separate packages.  ---  ### Steps to reproduce  1. Use a fresh Fedora or RHEL system without `gcc-c++` installed. 2. Follow the [Advanced setup](https://zulip.readthedocs.io/en/latest/development/setup-advanced.html) instructions:    ```bash    git clone https://github.com
  **Post-Mortem & Fix Analysis**:
  > Please use [provision help](https://chat.zulip.org/#topics/channel/21-provision-help) channel for reporting similar errors in the future.

- **Issue #40163** (2026-09-21): **`tools/provision` fails  if user already has NVM or local `uv` installed**
  *Symptoms*: ### Description   This issue occurs when setting up Zulip using the [Advanced setup (non-Vagrant)](https://zulip.readthedocs.io/en/latest/development/setup-advanced.html) method on a native Linux machine (Linux Fedora Workstation 44 ).  **Expected behavior:** Running `./tools/provision` should install Zulip's Node.js (`v24.19.0`) and `uv` (`0.12.5`) tools and complete successfully.  **Actual behavior:** Setup fails during `install-node` or `install-uv`. If you already have NVM or a local `uv` installed on your computer, your terminal finds your old version first instead of Zulip's newly installed version.  When the installer checks if the tool was installed (`check_version`), it tests your old personal version instead of Zulip's version sitting in `/srv/zulip-node` or `/usr/local/bin`. Because the version numbers do not match, provisioning stops with exit code 1.  This does not happen in the recommended [Vagrant setup](https://zulip.readthedocs.io/en/latest/development/setup-recommended.html) because the Vagrant/Docker container has a clean environment without user-level tool installations.  ---  ### Steps to reproduce  1. Have NVM or a local `uv` installed on your system (e.g. `nvm install 24.14.1`). 2. Follow the [Advanced setup](https://zulip.readthedocs.io/en/latest/development/setup-advanced.html) instructions:    ```bash    git clone https://github.com/zulip/zulip.git && cd zulip    ``` 3. Run `./tools/provision` on your Linux machine. 4. Provisioning fails in `install-
  **Post-Mortem & Fix Analysis**:
  > @zulipbot claim 
  > @Ali-Razahaider You have attempted to claim an issue without the label "help wanted". To learn how to pick up issues, please work through all the "Prior to picking up your first issue" sections of the [Zulip contributor guide](https://zulip.readthedocs.io/en/latest/contributing/index.html).  Please be mindful that attempting to claim issues that aren't available wastes time for other Zulip community members. 
  > Please use [provision help](https://chat.zulip.org/#topics/channel/21-provision-help) channel for reporting similar errors in the future.

- **Issue #40140** (2026-09-16): **Avoid per-stream database queries in add_new_user_history() for guest users and invite-only streams**
  *Symptoms*: ## What happened?  While reviewing `add_new_user_history()` in `zerver/actions/create_user.py`, we found that it calls `can_access_stream_history()` once per stream when setting up a new user's initial message history. `can_access_stream_history()` can in turn reach `access_stream_common()`, which performs a `Subscription.objects.get(...)` lookup. As a result, this can issue one database query per applicable stream instead of a single batched query.  ## When does this happen?  This happens during new human-user setup, whenever `add_new_user_history()` is called with more than a trivial number of streams. The query-producing path is broader than just private streams:  - Invite-only streams can require the subscription lookup for non-guest users. - Guest users can reach the lookup path for both public and private streams.  In other words, the number of extra queries scales with the number of applicable streams passed to `add_new_user_history()`.  ## Expected behavior  `add_new_user_history()` should be able to determine stream history access for a new user without issuing a separate database query per stream, while preserving the existing access semantics implemented by `can_access_stream_history()`.  ## Current behavior  For each stream passed in, `add_new_user_history()` calls `can_access_stream_history()`, which can reach `access_stream_common()` and perform a `Subscription.objects.get(...)` call:  ```python def add_new_user_history(users: Iterable[UserProfile], streams: Ite
  **Post-Mortem & Fix Analysis**:
  > Hi @Injora! If you believe there is an issue with the way queries are batched when setting up a new user, please join us to discuss in the [Zulip Development Community](https://zulip.com/development-community/). Our maintainers there can confirm whether this is a change we would welcome, or if it is set up this way for a reason.  Note, if you do plan to start a conversation on chat.zulip.org, please check out our guidance on using [AI for Communication](https://zulip.readthedocs.io/en/stable/contributing/contributing.html#using-ai-for-communication), first. Brevity is valued, as humans are reading your messages.

- **Issue #40069** (2026-09-08): **Bitbucket Data Center integration broken after version 12.0**
  *Symptoms*: <!-- Describe what you were expecting to see, what you saw instead, and steps to take in order to reproduce the buggy behavior. Screenshots can be helpful. --> After updating to Zulip 12.2 from version 11.6 our Bitbucket (self hosted Bitbucket Data Center) integration stopped working: pull request webhooks get 404 instead of posting notifications on Zulip.  This appears to be caused by PR #37322 "Delete legacy Bitbucket integrations", which removed both the `bitbucket` (Bitbucket Cloud v1, deprecated) and `bitbucket3` (Bitbucket Server) integrations. Removing `bitbucket3` integration seems to break the integration for Bitbucket Data Center as a side effect.  The 12.0 changelog states that these were removed because the services had shut down. However, Bitbucket Server has transitioned to Bitbucket Data Center which remains in active development by Atlassian and is in use in self hosted environments. Any organization running self-hosted Bitbucket Data Center and using Zulip's `bitbucket3` webhook integration for PR/commit notifications loses that integration after updating to Zulip 12.0+.  Expected behavior: - The `bitbucket3` (Bitbucket Server / Data Center) integration is restored, or - If removal is intentional, the changelog/release notes should call out that this is a breaking change for self-hosted Bitbucket Data Center  <!-- Check the box for the version of Zulip you are using (see https://zulip.com/help/view-zulip-version).-->  **Zulip Server and web app version:**  - 
  **Post-Mortem & Fix Analysis**:
  > Essentially, the same problem @timabbott found in review on bitbucket2 - alias-free route deletion breaking existing webhook URLs. The issue was fixed there (rename commit reverted), but not on bitbucket3, that got deleted completely. Its route (/api/v1/external/bitbucket3) returns 404 for any users still using it. And, bitbucket3 isn't really legacy, similar to bitbucket (Bitbucket Enterprise) - while Bitbucket Server's license expired in 2024, the self-hosted product continues as Bitbucket Data Center and actively sold & developed, maintaining the exact webhook structure used by bitbucket3. This way, the change breaks self-hosted Bitbucket on 12.0+.  A few things worth confirming here: 1) bitbucket3 was removed without any alias/redirect - can be seen from the file difference in #37322, the whole folder was deleted without anything to replace it. 2) Bitbucket Data Center is still running, sold and developed - according to Atlassian's documentation of its EOL policy, the only license 
  > Restoring bitbucket3 would be much preferred.
  > Sounds good, I'll put up a PR to restore bitbucket3, keeping the existing route name to avoid re-breaking URLs. Will link it here once ready.

- **Issue #39978** (2026-09-27): **message_overlay: Prevent grid blowouts on messagebox content.**
  *Symptoms*: This corrects an edge case on Safari and other browsers where a long line of non-breaking inline text (such as a link) cause a weird preview in the drafts and other message overlays.  A prep commit fixes the drafts overlay so it resizes as the viewport window gets smaller (and larger).  Fixes: [#issues > weird draft rendering of emoji + URL?](https://chat.zulip.org/#narrow/channel/9-issues/topic/weird.20draft.20rendering.20of.20emoji.20.2B.20URL.3F/with/2459654)  **Screenshots and screen captures:**  | Before | After | | --- | --- | | <img width="2762" height="1794" alt="draft-preview-before" src="https://github.com/user-attachments/assets/cb7c26e3-b58a-4398-8c2c-0b6d8e461136" /> | <img width="2762" height="1794" alt="draft-preview-after" src="https://github.com/user-attachments/assets/2ee2a625-eba1-4e07-b76c-379bedd63a2f" /> |  <details> <summary>Self-review checklist</summary>  <!-- Prior to submitting a PR, follow our step-by-step guide to review your own code: https://zulip.readthedocs.io/en/latest/contributing/code-reviewing.html#how-to-review-code -->  <!-- Once you create the PR, check off all the steps below that you have completed. If any of these steps are not relevant or you have not completed, leave them unchecked.-->  - [x] [Self-reviewed](https://zulip.readthedocs.io/en/latest/contributing/code-reviewing.html#how-to-review-code) the changes for clarity and maintainability       (variable names, code reuse, readability, etc.). - [x] Followe
  **Post-Mortem & Fix Analysis**:
  > Can you add bug reproduction steps? I wasn't able to reproduce the bug on main on Safari.  Also, I thought the value before the `/` was rows, not columns. Did you mean to say you changed row value?
  > Sure. The reproducer is a little tricky and only reproduces reliably in Safari, but just put in an emoji (`:this_style:`) and a longish URL. Eventually you'll hit a sweet spot in Safari with the URL where it falls onto a second line as in the screenshot above.  But whoops, yes, I did mean _row_, though there are column and overall improvements on `grid-template`. I've pushed an updated commit with that. You can better see here how the grid is improved; the source of this bug was really the *second* row, which was doing an auto-column thing (dotted line in the Before); now the second row does get the full content height:  | Before | After | | --- | --- | | <img width="2600" height="1900" alt="drafts-showing-grid-before" src="https://github.com/user-attachments/assets/139bbe70-46dd-4abc-b93c-6c7dafd4c5c2" /> | <img width="2600" height="1900" alt="drafts-showing-grid-after" src="https://github.com/user-attachments/assets/3fce222d-06b5-4b20-acec-280cc2e0cbaa" /> |  While working on
  > I decided not to do manual testing, trusting your screenshots. Looks good to me!

- **Issue #39967** (2026-08-19): **desktop_notifications: Improve checks for Notification API support.**
  *Symptoms*: This PR fixes a bug reported on Safari/iPadOS that prevented the display of the Notifications pane under user settings.  To ensure that this bug doesn't creep up on any other device (mobile or otherwise), the PR removes all instances of `util.is_mobile()` that were intended to prevent execution of Notification logic where it wasn't actually supported.  In place of those checks, the PR introduces a new utility function inside of `desktop_notifications.ts` for desktop-notification support as a feature check, rather than a mobile check. `desktop_notifications.ts` is a better location than `util.ts` for such a thing, because of the logic we've written to support notifications within the Electron app.  I've used the new `has_notification_support()` check in the navbar-alert logic and the notifications-settings logic, which are the two places in the codebase where we're handling desktop notifications.  - [ ] TODO: Once this PR has been merged, I want to file an issue to audit and likely remove all other `util.is_mobile()` checks in the codebase, and replace them with similarly robust feature-detection logic.  Fixes: [#frontend > settings/notifications won't load on iOS web app @ 💬](https://chat.zulip.org/#narrow/channel/6-frontend/topic/settings.2Fnotifications.20won.27t.20load.20on.20iOS.20web.20app/near/2511032)  **Screenshots and screen captures:**  _iPad running the dev server:_  | Before | After | | --- | --- | | <img width="1194" height="834" alt="ipad-sett
  **Post-Mortem & Fix Analysis**:
  > Hello @zulip/server-settings members, this pull request was labeled with the "area: settings (user)" label, so you may want to check it out!  <!-- areaLabelAddition --> 
  > Thanks @karlstolley ! Looks great!

- **Issue #39928** (2026-08-12): **ShareLock while importing converted mattermost export**
  *Symptoms*: My import of converted mattermost export fails. I'v done three times export, convert and import. Every time a failure with message like that:  ``` 2026-08-12 09:34:45.563 INFO [] Importing message dump /tmp/converted_mattermost_data/it/messages-000224.json 2026-08-12 09:34:46.766 INFO [] Successfully imported <class 'zerver.models.messages.Message'> from zerver_message. 2026-08-12 09:34:46.913 INFO [] Successfully imported <class 'zerver.models.messages.Message'> from zerver_message. 2026-08-12 09:34:47.243 INFO [] Processed messages up to 1421 / 1421 2026-08-12 09:34:47.244 INFO [] Successfully imported <class 'zerver.models.messages.UserMessage'> from zerver_usermessage[224]. 2026-08-12 09:34:48.217 INFO [] Processed messages up to 2018 / 2018 2026-08-12 09:34:48.218 INFO [] Successfully imported <class 'zerver.models.messages.UserMessage'> from zerver_usermessage[223]. concurrent.futures.process._RemoteTraceback:  """ Traceback (most recent call last):   File "/usr/lib/python3.12/concurrent/futures/process.py", line 263, in _process_worker     r = call_item.fn(*call_item.args, **call_item.kwargs)         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/home/zulip/deployments/2026-08-10-18-14-46/zerver/lib/import_realm.py", line 2296, in _import_message_file_worker     _process_message_file(dump_file_id, ctx.realm, ctx.sender_map, ctx.import_dir)   File "/home/zulip/deployments/2026-08-10-18-14-46/zerver/lib/import_realm.py", line 2343, in _process_message_file   
  **Post-Mortem & Fix Analysis**:
  > Images was not imported?  <img width="447" height="190" alt="Image" src="https://github.com/user-attachments/assets/3beed657-60bc-49d0-9f52-36f1e8c7250f" />
  > @Kolatzek This is #39743 I believe. You can just `supervisorctl stop process-fts-updates` before doing the import. Then import and start the service back up with `supervisorctl start process-fts-updates`.  I'll close this issue as a duplicate, but feel free to reply here if there are still problems. Or ideally, you can post in[ `#production help`](https://chat.zulip.org/#narrow/channel/31-production-help)

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

### Incident Patch 1: `47d6b697` (2026-10-02)
**Commit Message**: claude: Require reading linked issues and discussions before coding.

**File**: `AGENTS.md` (modified, +6/-3)
```diff
@@ -67,9 +67,12 @@ Before writing any code, you must understand:
 
 1. What the existing code does and why, including the relevant help center or
    developer-facing documentation.
-2. What problem you're solving, in its full scope.
-3. Why your approach is the right solution, and available alternatives.
-4. How you will verify that your work is correct, and avoid regressions
+2. What the issue, the pull requests and issues it links, and the
+   chat.zulip.org discussion actually request, and whether another
+   open pull request already does that work.
+3. What problem you're solving, in its full scope.
+4. Why your approach is the right solution, and available alternatives.
+5. How you will verify that your work is correct, and avoid regressions
    that are plausible for the type of work you're doing.
 
 The answer to "Why is X an improvement?" should never be "I'm not sure."
```

---

### Incident Patch 2: `2b1bdee8` (2026-09-23)
**Commit Message**: integrations: Fix API URL in Home Assistant documentation.

The configuration.yaml example used `external_api_uri` as a
template variable, which rendered as an empty string since that
context variable was removed in commit 271a9f0da74ba. It was
likely added to this documentation as a copy and paste error.

Updated the documentation to us the `api_url` context variable
instead.

**File**: `zerver/webhooks/homeassistant/doc.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
     ```
     notify:
       - platform: rest
-        resource: http: {{ external_api_uri }}v1/external/homeassistant?api_key=<API key>
+        resource: {{ api_url }}/v1/external/homeassistant?api_key=<API key>
         method: POST_JSON
         title_param_name: topic
     ```
```

---

### Incident Patch 3: `6d8c04cc` (2026-10-02)
**Commit Message**: curl_param_value_generators: Fix typo in PATCH /users/{email} key.

new_email_value was registered for "/users/{email]:patch", which
matches no endpoint, so it was never used for the curl example of
PATCH /users/{email}.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/openapi/curl_param_value_generators.py` (modified, +1/-1)
```diff
@@ -262,7 +262,7 @@ def create_user() -> dict[str, object]:
     }
 
 
-@openapi_param_value_generator(["/users/{email]:patch", "/users/{user_id}:patch"])
+@openapi_param_value_generator(["/users/{email}:patch", "/users/{user_id}:patch"])
 def new_email_value() -> dict[str, object]:
     count = 0
     exists = True
```

---

### Incident Patch 4: `bed481d3` (2026-10-02)
**Commit Message**: buildbot: Handle unrecognized build result codes.

The "finished" event's results code was used directly as an index
into our tuple of result names, so a code outside it raised
IndexError (a 500 error), and a negative code was silently reported
as the wrong result. Report unrecognized codes as "unknown" instead,
so that a result code added in a future Buildbot release doesn't
stop notifications from being sent.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/webhooks/buildbot/tests.py` (modified, +14/-0)
```diff
@@ -26,6 +26,20 @@ def test_build_cancelled(self) -> None:
         expected_message = "Build [#10434](https://ci.example.org/#builders/79/builds/307) (result: cancelled) for **AMD64 Ubuntu 18.04 Python 3** finished."
         self.check_webhook("finished_cancelled", expected_topic_name, expected_message)
 
+    def test_build_unknown_result(self) -> None:
+        expected_topic_name = "buildbot-hello"
+        expected_message = "Build [#33](http://exampleurl.com/#builders/1/builds/33) (result: unknown) for **runtests** finished."
+        for result in [7, -1]:
+            payload = self.get_body("finished_success").replace(
+                '"results": 0', f'"results": {result}'
+            )
+            self.check_webhook(
+                "finished_success",
+                expected_topic_name,
+                expected_message,
+                custom_payload=payload,
+            )
+
     def test_unsupported_event(self) -> None:
         payload = orjson.dumps(
             {
```

**File**: `zerver/webhooks/buildbot/view.py` (modified, +2/-1)
```diff
@@ -40,7 +40,8 @@ def get_message(payload: WildValue) -> str:
     elif event == "finished":
         # See http://docs.buildbot.net/latest/developer/results.html
         results = ("success", "warnings", "failure", "skipped", "exception", "retry", "cancelled")
-        status = results[payload["results"].tame(check_int)]
+        result = payload["results"].tame(check_int)
+        status = results[result] if 0 <= result < len(results) else "unknown"
         body = "Build [#{id}]({url}) (result: {status}) for **{name}** finished.".format(
             id=payload["buildid"].tame(check_int),
             name=payload["buildername"].tame(check_string),
```

---

### Incident Patch 5: `7a8fbca8` (2026-10-02)
**Commit Message**: migrations: Fix error message for unparseable realm ID in 0672.

fix_attachment_realm's ValueError handler printed realm_id, which was
never assigned when int() raised ValueError (or still held the value
from a previous attachment). Print the matched path_id prefix
instead, and restrict the try block to the int() call that it's
meant to guard.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/migrations/0672_fix_attachment_realm.py` (modified, +4/-4)
```diff
@@ -39,15 +39,15 @@ def fix_attachment_realm(apps: StateApps, schema_editor: BaseDatabaseSchemaEdito
 
                 try:
                     realm_id = int(matches[0])
-                    if not Realm.objects.filter(id=realm_id).exists():
-                        # If the realm doesn't exist (e.g. due to deletion), we can't do anything.
-                        continue
                 except ValueError:
                     # Don't do anything if path_id doesn't start with a sensible realm id.
                     print(
-                        f"Encountered ValueError for realm_id {realm_id} inferred from path_id of attachment {attachment.id}"
+                        f"Encountered ValueError for realm_id {matches[0]} inferred from path_id of attachment {attachment.id}"
                     )
                     continue
+                if not Realm.objects.filter(id=realm_id).exists():
+                    # If the realm doesn't exist (e.g. due to deletion), we can't do anything.
+                    continue
 
             if realm_id == attachment.realm_id:
                 # It's already correct, nothing to do.
```

---

### Incident Patch 6: `ee976998` (2026-10-02)
**Commit Message**: test-js-with-puppeteer: Fix crash when quitting interactive mode.

In --interactive mode, the index of the failing test was stored in
failed_test_num, but the failure summary printed after the tests
reads current_test_num, so quitting after a failure crashed with
UnboundLocalError instead of naming the failing test. Track the
index in current_test_num in both modes.

Also start from ret = 0, so quitting interactive mode before running
any tests, or passing --loop 0, exits successfully, rather than
reporting the first test as failed.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tools/test-js-with-puppeteer` (modified, +4/-5)
```diff
@@ -102,19 +102,18 @@ def run_tests(files: Iterable[str], external_host: str, loop: int = 1) -> None:
         # Important: do this next call inside the `with` block, when Django
         #            will be pointing at the test database.
         subprocess.check_call("tools/setup/generate-test-credentials")
+        ret = 0
+        current_test_num = 0
         if options.interactive:
             response = input('Press Enter to run tests, "q" to quit: ')
-            ret = 1
-            failed_test_num = 0
             while response != "q":
-                ret, failed_test_num = run_tests(failed_test_num)
+                ret, current_test_num = run_tests(current_test_num)
                 if ret == 0:
-                    failed_test_num = 0
+                    current_test_num = 0
                     response = input('Tests succeeded. Press Enter to re-run tests, "q" to quit: ')
                 else:
                     response = input('Tests failed. Press Enter to re-run tests, "q" to quit: ')
         else:
-            ret = 1
             for loop_num in range(1, loop + 1):
                 print(f"\n\nRunning tests in loop ({loop_num}/{loop})\n")
                 ret, current_test_num = run_tests()
```

---

### Incident Patch 7: `5f4f2b87` (2026-10-02)
**Commit Message**: teamcity: Ignore unsupported build results instead of crashing.

The status text was only set for the "success", "failure", and
"running" build results, so any other buildResult value raised
UnboundLocalError. Raise UnsupportedWebhookEventTypeError instead.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/webhooks/teamcity/tests.py` (modified, +11/-0)
```diff
@@ -32,6 +32,17 @@ def test_teamcity_fixed(self) -> None:
         expected_message = "Project :: Compile build 5535 - CL 123456 has been fixed! :thumbs_up: See [changes](http://teamcity/viewLog.html?buildTypeId=Project_Compile&buildId=19952&tab=buildChangesDiv) and [build log](http://teamcity/viewLog.html?buildTypeId=Project_Compile&buildId=19952)."
         self.check_webhook("fixed", self.TOPIC_NAME, expected_message)
 
+    def test_teamcity_unsupported_build_result(self) -> None:
+        payload = self.get_body("success").replace(
+            '"buildResult": "success"', '"buildResult": "unsupported"'
+        )
+        result = self.client_post(self.url, payload, content_type="application/json")
+        self.assert_json_success(result)
+        self.assert_in_response(
+            "The 'unsupported' event isn't currently supported by the TeamCity webhook; ignoring",
+            result,
+        )
+
     def test_teamcity_personal(self) -> None:
         expected_message = "Your personal build for Project :: Compile build 5535 - CL 123456 is broken with status Exit code 1 (new)! :thumbs_down: See [changes](http://teamcity/viewLog.html?buildTypeId=Project_Compile&buildId=19952&tab=buildChangesDiv) and [build log](http://teamcity/viewLog.html?buildTypeId=Project_Compile&buildId=19952)."
         payload = orjson.dumps(
```

**File**: `zerver/webhooks/teamcity/view.py` (modified, +3/-0)
```diff
@@ -9,6 +9,7 @@
     send_rate_limited_pm_notification_to_bot_owner,
 )
 from zerver.decorator import webhook_view
+from zerver.lib.exceptions import UnsupportedWebhookEventTypeError
 from zerver.lib.request import RequestNotes
 from zerver.lib.response import json_success
 from zerver.lib.send_email import FromAddress
@@ -91,6 +92,8 @@ def api_teamcity_webhook(
             status = f"is still broken with status {build_status}! :thumbs_down:"
     elif build_result == "running":
         status = "has started."
+    else:
+        raise UnsupportedWebhookEventTypeError(build_result)
 
     template = """
 {build_name} build {build_id} {status} See [changes]\
```

---

### Incident Patch 8: `805766bc` (2026-10-02)
**Commit Message**: buildbot: Ignore unsupported events instead of crashing.

get_message only set body for the "new" and "finished" events, so
any other event value raised UnboundLocalError. Raise
UnsupportedWebhookEventTypeError instead, like other integrations.

Also compute the build status inside the "finished" branch, the only
place it's used, so a "finished" payload without "results" fails
with the usual payload validation error rather than an
UnboundLocalError.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/webhooks/buildbot/tests.py` (modified, +19/-0)
```diff
@@ -1,3 +1,5 @@
+import orjson
+
 from zerver.lib.test_classes import WebhookTestCase
 
 
@@ -23,3 +25,20 @@ def test_build_cancelled(self) -> None:
         expected_topic_name = "zulip/zulip-zapier"
         expected_message = "Build [#10434](https://ci.example.org/#builders/79/builds/307) (result: cancelled) for **AMD64 Ubuntu 18.04 Python 3** finished."
         self.check_webhook("finished_cancelled", expected_topic_name, expected_message)
+
+    def test_unsupported_event(self) -> None:
+        payload = orjson.dumps(
+            {
+                "event": "unsupported",
+                "buildid": 33,
+                "buildername": "runtests",
+                "url": "http://exampleurl.com/#builders/1/builds/33",
+                "project": "buildbot-hello",
+            }
+        ).decode()
+        result = self.client_post(self.url, payload, content_type="application/json")
+        self.assert_json_success(result)
+        self.assert_in_response(
+            "The 'unsupported' event isn't currently supported by the Buildbot webhook; ignoring",
+            result,
+        )
```

**File**: `zerver/webhooks/buildbot/view.py` (modified, +6/-5)
```diff
@@ -1,6 +1,7 @@
 from django.http import HttpRequest, HttpResponse
 
 from zerver.decorator import webhook_view
+from zerver.lib.exceptions import UnsupportedWebhookEventTypeError
 from zerver.lib.response import json_success
 from zerver.lib.typed_endpoint import JsonBodyPayload, typed_endpoint
 from zerver.lib.validator import WildValue, check_int, check_string
@@ -29,11 +30,6 @@ def api_buildbot_webhook(
 
 
 def get_message(payload: WildValue) -> str:
-    if "results" in payload:
-        # See http://docs.buildbot.net/latest/developer/results.html
-        results = ("success", "warnings", "failure", "skipped", "exception", "retry", "cancelled")
-        status = results[payload["results"].tame(check_int)]
-
     event = payload["event"].tame(check_string)
     if event == "new":
         body = "Build [#{id}]({url}) for **{name}** started.".format(
@@ -42,11 +38,16 @@ def get_message(payload: WildValue) -> str:
             url=payload["url"].tame(check_string),
         )
     elif event == "finished":
+        # See http://docs.buildbot.net/latest/developer/results.html
+        results = ("success", "warnings", "failure", "skipped", "exception", "retry", "cancelled")
+        status = results[payload["results"].tame(check_int)]
         body = "Build [#{id}]({url}) (result: {status}) for **{name}** finished.".format(
             id=payload["buildid"].tame(check_int),
             name=payload["buildername"].tame(check_string),
             url=payload["url"].tame(check_string),
             status=status,
         )
+    else:
+        raise UnsupportedWebhookEventTypeError(event)
 
     return body
```

---

### Incident Patch 9: `8f552535` (2026-10-02)
**Commit Message**: test_markdown: Fix sender in empty alert words test.

test_alert_words_returns_empty_user_ids_with_alert_words fetched
sender_user_profile but accidentally sent the message as the
user_profile variable left over from the setup loop. Use
sender_user_profile, like the neighboring alert word tests.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/tests/test_markdown.py` (modified, +3/-1)
```diff
@@ -2296,7 +2296,9 @@ def test_alert_words_returns_empty_user_ids_with_alert_words(self) -> None:
             do_add_alert_words(user_profile, alert_words)
         sender_user_profile = self.example_user("polonius")
         msg = Message(
-            sender=user_profile, sending_client=get_client("test"), realm=user_profile.realm
+            sender=sender_user_profile,
+            sending_client=get_client("test"),
+            realm=sender_user_profile.realm,
         )
         realm_alert_words_automaton = get_alert_word_automaton(sender_user_profile.realm)
 
```

---

### Incident Patch 10: `bd9482a0` (2026-10-02)
**Commit Message**: tests: Don't assume the test database was built recently.

Several tests failed when the test database was built more than a
few months before the tests ran (reproducible with `datefudge
2025-03-24 tools/rebuild-test-database`):

* populate_db schedules two messages for Iago a year after the
  database is built. Once those are due,
  try_deliver_one_scheduled_message delivers them instead of the
  test's own scheduled message, so RemindersTest and
  ScheduledMessageTest now delete them in setUp.

* test_check_update_all_streams_active_status expected only
  test_stream1 to become inactive, but every stream does once all
  fixture messages are older than
  LAST_ACTIVITY_DAYS_BEFORE_FOR_ACTIVE. Mark all messages as recent
  first.

* Two user group tests changed waiting_period_threshold, which
  recomputes the full members group from date_joined, before setting
  date_joined to make users provisional. With old fixture join dates,
  those users stayed full members, since promote_new_full_members
  never demotes. Set date_joined first instead.

Verified that the affected tests pass with both a backdated and a
freshly built test database.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAI

**File**: `zerver/tests/test_events.py` (modified, +4/-0)
```diff
@@ -4201,6 +4201,10 @@ def test_check_update_all_streams_active_status(self) -> None:
         self.subscribe(hamlet, "test_stream1")
         stream = get_stream("test_stream1", self.user_profile.realm)
 
+        # Make all other streams recently active, regardless of when
+        # the test database was built.
+        Message.objects.update(date_sent=timezone_now())
+
         # Delete all messages in the stream so that it becomes inactive.
         Message.objects.filter(recipient__type_id=stream.id, realm=stream.realm).delete()
 
```

**File**: `zerver/tests/test_reminders.py` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@
 from unittest import mock
 
 import time_machine
+from typing_extensions import override
 
 from zerver.actions.realm_settings import do_deactivate_realm
 from zerver.actions.scheduled_messages import (
@@ -25,6 +26,13 @@
 
 
 class RemindersTest(ZulipTestCase):
+    @override
+    def setUp(self) -> None:
+        super().setUp()
+        # populate_db schedules messages for a year after the test
+        # database was built, which may already be due.
+        ScheduledMessage.objects.all().delete()
+
     def do_schedule_reminder(
         self,
         message_id: int,
```

**File**: `zerver/tests/test_scheduled_messages.py` (modified, +8/-0)
```diff
@@ -9,6 +9,7 @@
 import time_machine
 from django.conf import settings
 from django.utils.timezone import now as timezone_now
+from typing_extensions import override
 
 from zerver.actions.scheduled_messages import (
     SCHEDULED_MESSAGE_LATE_CUTOFF_MINUTES,
@@ -28,6 +29,13 @@
 
 
 class ScheduledMessageTest(ZulipTestCase):
+    @override
+    def setUp(self) -> None:
+        super().setUp()
+        # populate_db schedules messages for a year after the test
+        # database was built, which may already be due.
+        ScheduledMessage.objects.all().delete()
+
     def last_scheduled_message(self) -> ScheduledMessage:
         return ScheduledMessage.objects.all().order_by("-id")[0]
 
```

**File**: `zerver/tests/test_user_groups.py` (modified, +4/-4)
```diff
@@ -2765,11 +2765,10 @@ def check_create_user_group(acting_user: str, error_msg: str | None = None) -> N
             full_members_group,
             acting_user=None,
         )
-        do_set_realm_property(realm, "waiting_period_threshold", 10, acting_user=None)
-
         othello = self.example_user("othello")
         othello.date_joined = timezone_now() - timedelta(days=9)
         othello.save()
+        do_set_realm_property(realm, "waiting_period_threshold", 10, acting_user=None)
 
         check_create_user_group("othello", "Insufficient permission")
 
@@ -3130,10 +3129,11 @@ def check_removing_members_from_group(
             full_members_group,
             acting_user=None,
         )
-        do_set_realm_property(realm, "waiting_period_threshold", 10, acting_user=None)
-
         othello.date_joined = timezone_now() - timedelta(days=9)
         othello.save()
+        cordelia.date_joined = timezone_now() - timedelta(days=9)
+        cordelia.save()
+        do_set_realm_property(realm, "waiting_period_threshold", 10, acting_user=None)
         promote_new_full_members()
         check_adding_members_to_group("cordelia", "Insufficient permission")
 
```

---

### Incident Patch 11: `fd3bf820` (2026-10-02)
**Commit Message**: check-database-compatibility: Fix NameError for old remote databases.

postgresql_version is only set when PostgreSQL runs on the Zulip
server itself. With an older remote database, logging the
"Unsupported PostgreSQL version" error raised NameError instead of
printing the upgrade instructions. Log the version of the database
we are actually connected to, which is the one being checked.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `scripts/lib/check-database-compatibility` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ if os.path.exists("/etc/init.d/postgresql") and os.path.exists("/etc/zulip/zulip
         sys.exit(1)
 
 if django_pg_version < 14:
-    logging.critical("Unsupported PostgreSQL version: %d", postgresql_version)
+    logging.critical("Unsupported PostgreSQL version: %d", django_pg_version)
     logging.info(
         "Please upgrade to PostgreSQL 14 or newer first.\n"
         "See https://zulip.readthedocs.io/en/stable/production/"
```

---

### Incident Patch 12: `48f51595` (2026-10-02)
**Commit Message**: video_calls: Fix crash on errors raised before getting a response.

The BigBlueButton and Nextcloud Talk error handlers assumed that an
exception with a response came from raise_for_status, and read the
local response variable. But requests can also raise such an
exception from the request itself, e.g. TooManyRedirects, leaving
response unbound. Use the response attached to the exception.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `zerver/tests/test_create_video_call.py` (modified, +18/-0)
```diff
@@ -677,6 +677,24 @@ def test_join_bigbluebutton_connection_refused(self) -> None:
             response, "Error connecting to the BigBlueButton server: Connection refused"
         )
 
+    @responses.activate
+    def test_join_bigbluebutton_too_many_redirects(self) -> None:
+        url = "https://bbb.example.com/bigbluebutton/api/create?meetingID=a&name=a&lockSettingsDisableCam=True&checksum=33349e6374ca9b2d15a0c6e51a42bc3e8f770de13f88660815c6449859856e20"
+        responses.add(
+            responses.GET,
+            url,
+            status=302,
+            headers={"Location": url},
+            body="Redirecting",
+        )
+        response = self.client_get(
+            "/calls/bigbluebutton/join",
+            {"bigbluebutton": self.signed_bbb_a_object},
+        )
+        self.assert_json_error(
+            response, "Error connecting to the BigBlueButton server: HTTP 302: Redirecting"
+        )
+
     @responses.activate
     def test_join_bigbluebutton_redirect_error_by_server(self) -> None:
         # Simulate bbb server error
```

**File**: `zerver/views/video_calls.py` (modified, +2/-2)
```diff
@@ -644,7 +644,7 @@ def join_bigbluebutton(request: HttpRequest, *, bigbluebutton: str) -> HttpRespo
         response.raise_for_status()
     except requests.RequestException as e:
         if e.response is not None:
-            reason = f"HTTP {response.status_code}: {response.text:.200}"
+            reason = f"HTTP {e.response.status_code}: {e.response.text:.200}"
         else:
             reason = str(e)
         raise VideoCallServerConnectionError("BigBlueButton", reason=reason)
@@ -751,7 +751,7 @@ def create_nextcloud_talk_url(
         response.raise_for_status()
     except requests.RequestException as e:
         if e.response is not None:
-            reason = f"HTTP {response.status_code}: {response.text:.200}"
+            reason = f"HTTP {e.response.status_code}: {e.response.text:.200}"
         else:
             reason = str(e)
         raise VideoCallServerConnectionError("Nextcloud Talk", reason=reason)
```

---

### Incident Patch 13: `cab30af5` (2026-10-02)
**Commit Message**: webhooks: Fix incorrect None checks for WildValue.

`wild_value.get("missing")` returns `WildValue(value=None)`, not
`None`.  When possible, we should prefer heing explicit about whether
we’re checking for a missing key (`"missing" in wild_value`) versus a
`null` value (`wild_value["missing"].value is None` or
`wild_value["missing"].tame(check_none_or(…))`).

Fixes these cases where previously a `ValidationError` was raised:

- GoSquared raises `UnsupportedWebhookEventTypeError` if `message` or
  `person` is missing.
- PagerDuty v3 accepts `"agent": null`.
- Raygun accepts `"customData": null` and `"affectedUser": null`.

Signed-off-by: Anders Kaseorg <[REDACTED_EMAIL]>

**File**: `zerver/webhooks/gosquared/view.py` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ def api_gosquared_webhook(
         check_send_webhook_message(request, user_profile, topic_name, body, "traffic_spike")
 
     # Live chat message event
-    elif payload.get("message") is not None and payload.get("person") is not None:
+    elif "message" in payload and "person" in payload:
         # Only support non-direct messages
         if not payload["message"]["private"].tame(check_bool):
             session_title = payload["message"]["session"]["title"].tame(check_string)
```

**File**: `zerver/webhooks/grafana/view.py` (modified, +1/-1)
```diff
@@ -185,7 +185,7 @@ def api_grafana_webhook(
     topic_name = OLD_TOPIC_TEMPLATE.format(alert_title=legacy_alert.title)
 
     eval_matches_text = ""
-    if "evalMatches" in payload and payload["evalMatches"] is not None:
+    if "evalMatches" in payload:
         for match in payload["evalMatches"]:
             eval_matches_text += "**{}:** {}\n".format(
                 match["metric"].tame(check_string),
```

**File**: `zerver/webhooks/pagerduty/view.py` (modified, +7/-8)
```diff
@@ -86,12 +86,11 @@ def build_pagerduty_formatdict_v2(message: WildValue) -> FormatDictType:
     else:
         format_dict["assignee_info"] = "nobody"
 
-    last_status_change_by = message["incident"].get("last_status_change_by")
-    if last_status_change_by is not None:
-        format_dict["agent_info"] = AGENT_TEMPLATE.format(
-            username=last_status_change_by["summary"].tame(check_string),
-            url=last_status_change_by["html_url"].tame(check_string),
-        )
+    last_status_change_by = message["incident"]["last_status_change_by"]
+    format_dict["agent_info"] = AGENT_TEMPLATE.format(
+        username=last_status_change_by["summary"].tame(check_string),
+        url=last_status_change_by["html_url"].tame(check_string),
+    )
 
     return format_dict
 
@@ -120,8 +119,8 @@ def build_pagerduty_formatdict_v3(event: WildValue) -> FormatDictType:
     else:
         format_dict["assignee_info"] = "nobody"
 
-    agent = event.get("agent")
-    if agent is not None:
+    agent = event["agent"]
+    if agent.value is not None:
         format_dict["agent_info"] = AGENT_TEMPLATE.format(
             username=agent["summary"].tame(check_string),
             url=agent["html_url"].tame(check_string),
```

**File**: `zerver/webhooks/raygun/view.py` (modified, +13/-6)
```diff
@@ -7,7 +7,14 @@
 from zerver.lib.response import json_success
 from zerver.lib.timestamp import datetime_to_global_time
 from zerver.lib.typed_endpoint import JsonBodyPayload, typed_endpoint
-from zerver.lib.validator import WildValue, check_anything, check_int, check_list, check_string
+from zerver.lib.validator import (
+    WildValue,
+    check_dict,
+    check_int,
+    check_list,
+    check_none_or,
+    check_string,
+)
 from zerver.lib.webhooks.common import check_send_webhook_message
 from zerver.models import UserProfile
 
@@ -175,28 +182,28 @@ def notification_message_error_occurred(payload: WildValue) -> str:
     # Extract each of the keys and values in error_instance for easier handle
 
     # Contains list of tags for the error. Can be empty (null)
-    tags = error_instance["tags"]
+    tags = error_instance["tags"].tame(check_none_or(check_list(check_string)))
 
     # Contains the identity of affected user at the moment this error
     # happened. This surprisingly can be null. Somehow.
     affected_user = error_instance["affectedUser"]
 
     # Contains custom data for this particular error (if supplied). Can be
     # null.
-    custom_data = error_instance["customData"]
+    custom_data = error_instance["customData"].tame(check_none_or(check_dict()))
 
     if tags is not None:
-        message += "* **Tags**: {}\n".format(", ".join(tags.tame(check_list(check_string))))
+        message += "* **Tags**: {}\n".format(", ".join(tags))
 
-    if affected_user is not None:
+    if affected_user.value is not None:
         user_uuid = affected_user["UUID"].tame(check_string)
         message += f"* **Affected user**: {user_uuid[:6]}...{user_uuid[-5:]}\n"
 
     if custom_data is not None:
         # We don't know what the keys and values beforehand, so we are forced
         # to iterate.
         for key in sorted(custom_data.keys()):
-            message += f"* **{key}**: {custom_data[key].tame(check_anything)}\n"
+            message += f"* **{key}**: {custom_data[key]}\n"
 
     message += make_app_info_chunk(payload["application"])
 
```

**File**: `zerver/webhooks/reviewboard/view.py` (modified, +3/-3)
```diff
@@ -121,7 +121,7 @@ def get_review_request_published_body(payload: WildValue) -> str:
 
     message = REVIEW_REQUEST_PUBLISHED + REVIEW_REQUEST_DETAILS
     branch = payload["review_request"].get("branch").tame(check_none_or(check_string))
-    if branch and branch is not None:
+    if branch:
         branch_info = BRANCH_TEMPLATE.format(branch_name=branch)
         kwargs["extra_info"] = branch_info
 
@@ -142,7 +142,7 @@ def get_review_request_reopened_body(payload: WildValue) -> str:
 
     message = REVIEW_REQUEST_REOPENED + REVIEW_REQUEST_DETAILS
     branch = payload["review_request"].get("branch").tame(check_none_or(check_string))
-    if branch and branch is not None:
+    if branch:
         branch_info = BRANCH_TEMPLATE.format(branch_name=branch)
         kwargs["extra_info"] = branch_info
 
@@ -163,7 +163,7 @@ def get_review_request_closed_body(payload: WildValue) -> str:
 
     message = REVIEW_REQUEST_CLOSED + REVIEW_REQUEST_DETAILS
     branch = payload["review_request"].get("branch").tame(check_none_or(check_string))
-    if branch and branch is not None:
+    if branch:
         branch_info = BRANCH_TEMPLATE.format(branch_name=branch)
         kwargs["extra_info"] = "{}\n{}".format(kwargs["extra_info"], branch_info)
 
```

---

### Incident Patch 14: `bf529603` (2026-10-02)
**Commit Message**: tail-ses: Fix NameError on aborted operations.

An undefined Python variable does not resolve to None.

Signed-off-by: Anders Kaseorg <[REDACTED_EMAIL]>

**File**: `tools/tail-ses` (modified, +2/-0)
```diff
@@ -94,6 +94,7 @@ def our_sqs_queue(session: boto3.session.Session, ses_topic_arn: str) -> Iterato
 
     sqs: SQSClient = session.client("sqs")
     queue_name = "tail-ses-" + secrets.token_hex(10)
+    queue_url = None
     try:
         resp = sqs.create_queue(
             QueueName=queue_name,
@@ -129,6 +130,7 @@ def our_sns_subscription(
     session: boto3.session.Session, ses_topic_arn: str, queue_arn: str
 ) -> Iterator[str]:
     sns: SNSClient = session.client("sns")
+    subscription_arn = None
     try:
         resp = sns.subscribe(
             TopicArn=ses_topic_arn,
```

---

### Incident Patch 15: `cba94ddd` (2026-10-02)
**Commit Message**: export: Revert wrongly nullified is_seeded check.

Commit 8ab6a23a3097079f263d22f75ac601b6bc35ad45 changed this `not
is_seeded` check to `is_seeded is None`, which is wrong (then and now)
because `is_seeded: bool`.

Signed-off-by: Anders Kaseorg <[REDACTED_EMAIL]>

**File**: `zerver/lib/export.py` (modified, +1/-1)
```diff
@@ -648,7 +648,7 @@ def __init__(
             normal_parent.children.append(self)
         elif virtual_parent is not None:
             virtual_parent.children.append(self)
-        elif is_seeded is None:
+        elif not is_seeded:
             raise AssertionError(
                 """
                 You must specify a parent if you are
```

#### Recent Merged Pull Requests:
- **PR #40306** (closed): Docs/project scope (@DanielBG1)
- **PR #40305** (closed): docs: add C4 context diagram (@DanielBG1)
- **PR #40304** (closed): uploads: Handle concurrent attachment deletion during message send. (@siddubakka)
- **PR #40303** (closed): uploads: Handle attachment deleted between validate and claim. (@soumojit-D48)
- **PR #40301** (closed): portico: fix keyboard focus styling (@aryangetsreal)
- **PR #40300** (closed): notifications: Disable missed-message emails for imported stubs (@Kunal-net)
- **PR #40298** (closed): util: Fix custom time parsing. (@Indra55)
- **PR #40293** (closed): Realm update event type refactor (@benprew)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
