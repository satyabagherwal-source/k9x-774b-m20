> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source**: github ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Source Version**: `1f43fca4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T06:19:45.705Z  
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
> **Harvest Timestamp**: 2026-10-20T06:19:45.437Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zulip/zulip`
- **Description**: Zulip server and web application. Open-source team chat that helps teams stay productive and focused.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 26078 stars

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
- **Issue #40326** (2026-10-12): **[ai] left_sidebar: Don't show view tooltips on mouse-opened popover focus.**
  *Symptoms*: Opening the condensed views popover with a mouse click focuses its first item, via focus_popover. The view items carry the `.tippy-left-sidebar-tooltip` class, whose tooltips use Tippy's default "mouseenter focus" trigger, so that programmatic focus opened the first item's tooltip without the user hovering over it.  Suppress the tooltip when the reference has focus without `:focus-visible` and isn't hovered. This preserves tooltips for keyboard navigation while avoiding unwanted tooltips from mouse-opened popovers.  Check for focus explicitly rather than relying only on the absence of `:focus-visible`, so touch long-press tooltips continue to work.  <!-- Describe your pull request here.-->  **How changes were tested:**  <!-- If the PR makes UI changes, you must include screenshots. Detailed guide: https://zulip.readthedocs.io/en/latest/contributing/presenting-visual-changes.html -->  **Screenshots and screen captures:**  |Before|After| |-|-| |[Screencast from 2026-10-07 23-37-10.webm](https://github.com/user-attachments/assets/7c2bdc46-d840-457e-aef4-072bbbcd4676)|[Screencast from 2026-10-07 23-38-03.webm](https://github.com/user-attachments/assets/d58431a3-35df-45b6-9393-e6cc91e53f76)|  <details> <summary>Self-review checklist</summary>  <!-- Prior to submitting a PR, follow our step-by-step guide to review your own code: https://zulip.readthedocs.io/en/latest/contributing/code-reviewing.html#how-to-review-code -->  <!-- Once you create the PR, chec
  **Post-Mortem & Fix Analysis**:
  > @amanagr Tagging you for review here.
  > Looks great! Thanks @pratik-pc !

- **Issue #40230** (2026-09-28): **Authentication failure for flush-memcached during install**
  *Symptoms*: Trying to install Zulip server 12.3 on a fresh VM of Debian 13.  ``` $ sudo zulip-server-12.3/scripts/setup/install --push--notifications --email=somebody@example.com --hostname example.com --self-signed-cert ... CREATE DATABASE "zulip"     OWNER=zulip     ENCODING=UTF8     LC_COLLATE='C.UTF-8'     LC_CTYPE='C.UTF-8'     TEMPLATE=template0; CREATE DATABASE You are now connected to database "zulip" as user "postgres". + '[' zulip '!=' zulip ']' + '[' -e /home/zulip/deployments ']' + /home/zulip/deployments/current/scripts/setup/flush-memcached Traceback (most recent call last):   File "/home/zulip/deployments/current/scripts/setup/flush-memcached", line 24, in <module>     client.flush_all()     ~~~~~~~~~~~~~~~~^^   File "/home/zulip/deployments/2026-09-28-08-57-30/.venv/lib/python3.13/site-packages/bmemcached/client/mixin.py", line 95, in flush_all     returns.append(server.flush_all(time))                    ~~~~~~~~~~~~~~~~^^^^^^   File "/home/zulip/deployments/2026-09-28-08-57-30/.venv/lib/python3.13/site-packages/bmemcached/protocol.py", line 1009, in flush_all     self._send(struct.pack(self.HEADER_STRUCT +     ~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                            self.COMMANDS['flush']['struct'],                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                            self.MAGIC['request'],                            ^^^^^^^^^^^^^^^^^^^^^^                            self.COMMANDS['flush']['command'],                            ^^^^^^^^^^^

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

### Incident Patch 1: `0f75588d` (2026-06-08)
**Commit Message**: icons: Remove dead .fa-eye rule from compose.css.

The '.fa-eye' rule in '.compose-control-buttons-container' stopped
matching anything when the compose preview button moved to
'zulip-icon-preview'.

Fixes part of #36224.

**File**: `web/styles/compose.css` (modified, +0/-5)
```diff
@@ -1698,11 +1698,6 @@ textarea.new_message_textarea {
         }
     }
 
-    .fa-eye {
-        position: relative;
-        top: -0.7px;
-    }
-
     .divider {
         margin: 0 5px;
         /* Coordinate with the value of
```

---

### Incident Patch 2: `99fedfb3` (2026-05-08)
**Commit Message**: icons: Replace FontAwesome icons with Zulip icons in stream/message UI.

Replace decorative FontAwesome icons with their Zulip equivalents:

- 'fa-bar-chart' to 'zulip-icon-bar-chart'
- 'fa-user-o' and 'fa-user' to 'zulip-icon-user'
- 'fa-exclamation-circle' to 'zulip-icon-exclamation-circle'
- 'fa-question-circle-o' to 'zulip-icon-help'
- 'fa-eye' to 'zulip-icon-eye'

The Zulip glyphs are drawn at a different scale, so some icons are
resized or seated against the text beside them, and the subscriber
and traffic counts center theirs with flexbox. Unlike '.fa',
'.zulip-icon' inherits 'text-decoration', so the navbar help link
keeps the hover underline off its icon.

The traffic icon also gains an 'aria-hidden', like the subscriber
icons beside it; the muted participant icon does not, being the
whole content of its list item.

Fixes part of #36224.

**File**: `web/src/stream_settings_ui.ts` (modified, +2/-2)
```diff
@@ -959,14 +959,14 @@ function setup_page(callback: () => void): void {
                 },
                 {
                     label_html: render_stream_sorter_toggle_label({
-                        icon_class: "fa fa-user-o",
+                        icon_class: "zulip-icon zulip-icon-user",
                         tooltip: $t({defaultMessage: "Sort by number of subscribers"}),
                     }),
                     key: "by-subscriber-count",
                 },
                 {
                     label_html: render_stream_sorter_toggle_label({
-                        icon_class: "fa fa-bar-chart",
+                        icon_class: "zulip-icon zulip-icon-bar-chart",
                         tooltip: $t({defaultMessage: "Sort by estimated weekly traffic"}),
                     }),
                     key: "by-weekly-traffic",
```

**File**: `web/styles/message_view_header.css` (modified, +8/-10)
```diff
@@ -103,23 +103,21 @@
         margin: 0;
 
         .help_link_widget,
-        .fa {
+        .zulip-icon {
             margin: 0;
         }
 
-        .fa-question-circle-o {
-            /* Override relative position for sake of
-               Chrome paint bug that keeps the circle
-               visible when ellipses are showing. */
-            position: static;
+        .zulip-icon-help {
+            /* Eyeballed to sit on the description's baseline. */
+            font-size: 0.88em;
+            vertical-align: -0.1em;
         }
 
         .help_link_widget {
-            /* With relative positioning no longer
-               in effect, we vertically align the
-               help icon with an inline-block assist,
-               which is present on the .fa class. */
+            /* Align the icon against the description text. */
             vertical-align: middle;
+            /* Unlike .fa, .zulip-icon inherits the link's underline. */
+            text-decoration: none;
         }
     }
 
```

**File**: `web/styles/modal.css` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@
         padding: 0.25em; /* 4px at 16px/1em */
     }
 
-    /* help_link_widget margin for the fa-circle-o. */
+    /* help_link_widget margin for the zulip-icon-help. */
     .help_link_widget {
         margin-left: 5px;
     }
```

**File**: `web/styles/recent_view.css` (modified, +1/-1)
```diff
@@ -467,7 +467,7 @@
             padding-right: 0;
         }
 
-        .fa-user {
+        .zulip-icon-user {
             opacity: 0.7;
         }
     }
```

**File**: `web/styles/settings.css` (modified, +5/-4)
```diff
@@ -37,7 +37,7 @@ label,
 
 /* TODO: This should ideally be added to help_link_widget.hbs,
    allowing us to deduplicate at least the opacity CSS with the
-   fa-question-circle-o logic above. */
+   zulip-icon-help logic above. */
 .settings-info-icon {
     padding-left: 3px;
     opacity: 0.7;
@@ -52,9 +52,10 @@ a.help_link_widget {
     color: inherit;
     margin-left: 3px;
 
-    .fa-question-circle-o {
-        position: relative;
-        top: 1px;
+    .zulip-icon-help {
+        /* Eyeballed to sit on the text baseline. */
+        font-size: 0.88em;
+        vertical-align: -0.16em;
     }
 
     &:hover {
```

**File**: `web/styles/subscriptions.css` (modified, +22/-0)
```diff
@@ -445,6 +445,11 @@
 
     .tab-switcher.stream_sorter_toggle {
         margin-left: auto;
+
+        .zulip-icon-bar-chart {
+            /* Eyeballed to match the other sort icons. */
+            font-size: 1.1em;
+        }
     }
 
     .tab-switcher,
@@ -1075,6 +1080,19 @@
         .bottom-bar .stream-message-count {
             white-space: nowrap;
             color: hsl(0deg 0% 67%);
+            /* Center the icon against its count, rather than nudging it. */
+            display: flex;
+            align-items: center;
+            gap: 0.1em;
+        }
+
+        /* Eyeballed to match the count text; glyph sizes vary. */
+        .top-bar .subscriber-count .zulip-icon-user {
+            font-size: 1.1em;
+        }
+
+        .bottom-bar .stream-message-count .zulip-icon-bar-chart {
+            font-size: 1.2em;
         }
 
         .top-bar .subscriber-count-text,
@@ -1083,6 +1101,10 @@
             margin-right: 0.3125em; /* 5px at 16px font size */
         }
 
+        .top-bar .subscriber-count-text {
+            margin-left: 0.156em; /* 2.5px at 16px font size */
+        }
+
         .top-bar .stream-name {
             font-weight: 600;
         }
```

**File**: `web/styles/zulip.css` (modified, +5/-0)
```diff
@@ -235,6 +235,11 @@ p.n-margin {
        the message column; the fixed sidebars paint over anything that
        spills past its edges. */
     margin-inline: 2px;
+
+    .zulip-icon-exclamation-circle {
+        /* Eyeballed to center the icon against the text. */
+        vertical-align: -0.15em;
+    }
 }
 
 .messages-logo-svg {
```

**File**: `web/templates/help_link_widget.hbs` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 <a class="help_link_widget" href="{{ link }}" target="_blank" rel="noopener noreferrer">
-    <i class="fa fa-question-circle-o" aria-hidden="true"></i>
+    <i class="zulip-icon zulip-icon-help" aria-hidden="true"></i>
 </a>
```

---

### Incident Patch 3: `15919561` (2026-10-18)
**Commit Message**: views: Fix typo in scheduled message comments.

**File**: `zerver/views/message_send.py` (modified, +2/-2)
```diff
@@ -64,12 +64,12 @@ def send_message_backend(
     if recipient_type_name == "direct":
         # For now, use "private" from Message.API_RECIPIENT_TYPES.
         # TODO: Use "direct" here, as well as in events and
-        # message (created, schdeduled, drafts) objects/dicts.
+        # message (created, scheduled, drafts) objects/dicts.
         recipient_type_name = "private"
     elif recipient_type_name == "channel":
         # For now, use "stream" from Message.API_RECIPIENT_TYPES.
         # TODO: Use "channel" here, as well as in events and
-        # message (created, schdeduled, drafts) objects/dicts.
+        # message (created, scheduled, drafts) objects/dicts.
         recipient_type_name = "stream"
 
     # If to is None, then we default to an
```

**File**: `zerver/views/scheduled_messages.py` (modified, +2/-2)
```diff
@@ -87,7 +87,7 @@ def update_scheduled_message_backend(
     if recipient_type_name is not None and recipient_type_name == "channel":
         # For now, use "stream" from Message.API_RECIPIENT_TYPES.
         # TODO: Use "channel" here, as well as in events and
-        # message (created, schdeduled, drafts) objects/dicts.
+        # message (created, scheduled, drafts) objects/dicts.
         recipient_type_name = "stream"
 
     if recipient_type_name is not None and recipient_type_name == "stream" and topic_name is None:
@@ -154,7 +154,7 @@ def create_scheduled_message_backend(
     elif recipient_type_name == "channel":
         # For now, use "stream" from Message.API_RECIPIENT_TYPES.
         # TODO: Use "channel" here, as well as in events and
-        # message (created, schdeduled, drafts) objects/dicts.
+        # message (created, scheduled, drafts) objects/dicts.
         recipient_type_name = "stream"
 
     deliver_at = timestamp_to_datetime(scheduled_delivery_timestamp)
```

**File**: `zerver/views/typing.py` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ def send_notification_backend(
     if recipient_type_name == "channel":
         # For now, use "stream" from Message.API_RECIPIENT_TYPES.
         # TODO: Use "channel" here, as well as in events and
-        # message (created, schdeduled, drafts) objects/dicts.
+        # message (created, scheduled, drafts) objects/dicts.
         recipient_type_name = "stream"
 
     if recipient_type_name == "stream":
```

#### Recent Merged Pull Requests:
- **PR #40429** (2026-10-20): portico: Mark communities directory realm URLs rel="nofollow". (@prakhar1144)
- **PR #40425** (closed): Feature/pipeline (@kellysolanomt)
- **PR #40424** (2026-10-19): docs & views: Fix typos in comments and Puppeteer documentation. (@theblag)
- **PR #40423** (closed): [ai] invites: Reject invitee names longer than the name limit. (@fadiroot)
- **PR #40420** (closed): [ai] gitea: Add support for delete events for branches and tags. (@Bhumika-1432006)
- **PR #40404** (closed): [ai] streams: Improve error messages when channel name conflicts with archived channel. (@Mighty-Ishu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
