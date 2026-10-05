# Forensic Learning Record (Deep Inspection): zulip/zulip

> **Canonical Artifact**: `07_PROJECT_LEARNING/zulip-zulip-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zulip/zulip](https://github.com/zulip/zulip))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:02:25.612Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zulip/zulip`
- **Description**: Zulip server and web application. Open-source team chat that helps teams stay productive and focused.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 25978 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `analytics/lib/counts.py`
```
import logging
import time
from collections import OrderedDict, defaultdict
from collections.abc import Callable, Sequence
from datetime import datetime, timedelta, timezone
from typing import TypeAlias, Union

from django.conf import settings
from django.db import connection, models
from django.utils.timezone import now as timezone_now
from psycopg2.sql import SQL, Composable, Identifier, Literal
from typing_extensions import override

from analytics.models import (
    BaseCount,
    FillState,
    InstallationCount,
    RealmCount,
    StreamCount,
    UserCount,
    installation_epoch,
)
from zerver.lib.timestamp import ceiling_to_day, ceiling_to_hour, floor_to_hour, verify_UTC
from zerver.models import Message, Realm, Stream, UserActivityInterval, UserProfile
from zerver.models.realm_audit_logs import AuditLogEventType

if settings.ZILENCER_ENABLED:
    from zilencer.models import (
        RemoteInstallationCount,
        RemoteRealm,
        RemoteRealmCount,
        RemoteZulipServer,
    )


logger = logging.getLogger("zulip.analytics")


# You can't subtract timedelta.max from a datetime, so use this instead
TIMEDELTA_MAX = timedelta(days=365 * 1000)


## Class definitions ##


class CountStat:
    HOUR = "hour"
    DAY = "day"
    FREQUENCIES = frozenset([HOUR, DAY])

    @property
    def time_increment(self) -> timedelta:
        if self.frequency == CountStat.HOUR:
            return timedelta(hours=1)
        return timedelta(days=1)

    def __init__(
        self,
        property: str,
        data_collector: "DataCollector",
        frequency: str,
        interval: timedelta | None = None,
    ) -> None:
        self.property = property
        self.data_collector = data_collector
        # might have to do something different for bitfields
        if frequency not in self.FREQUENCIES:
            raise AssertionError(f"Unknown frequency: {frequency}")
        self.frequency = frequency
        if interval is not None:
            self.interval = interval
        else:
            self.interval = self.time_increment

    @override
    def __repr__(self) -> str:
        return f"<CountStat: {self.property}>"

    def last_successful_fill(self) -> datetime | None:
        fillstate = FillState.objects.filter(property=self.property).first()
        if fillstate is None:
            return None
        if fillstate.state == FillState.DONE:
            return fillstate.end_time
        return fillstate.end_time - self.time_increment

    def current_month_accumulated_count_for_user(self, user: UserProfile) -> int:
        now = timezone_now()
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12:  # nocoverage
            start_of_next_month = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else:  # nocoverage
            start_of_next_month = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)

        # We just want to check we are not using BaseCount, otherwise all
        # `output_table` have `objects` property.
        assert self.data_collector.output_table == UserCount
        result = self.data_collector.output_table.objects.filter(
            user=user,
            property=self.property,
            end_time__gt=start_of_month,
            end_time__lte=start_of_next_month,
        ).aggregate(models.Sum("value"))

        total_value = result["value__sum"] or 0
        return total_value


class LoggingCountStat(CountStat):
    def __init__(self, property: str, output_table: type[BaseCount], frequency: str) -> None:
        CountStat.__init__(self, property, DataCollector(output_table, None), frequency)


class DependentCountStat(CountStat):
    def __init__(
        self,
        property: str,
        data_collector: "DataCollector",
        frequency: str,
        interval: timedelta | None = None,
        dependencies: Sequence[str] = [],
    ) -> None:
        CountStat.__init__(self, property, data_collector, frequency, interval=interval)
        self.dependencies = dependencies


class DataCollector:
    def __init__(
        self,
        output_table: type[BaseCount],
        pull_function: Callable[[str, datetime, datetime, Realm | None], int] | None,
    ) -> None:
        self.output_table = output_table
        self.pull_function = pull_function

    def depends_on_realm(self) -> bool:
        return self.output_table in (UserCount, StreamCount)


## CountStat-level operations ##


def process_count_stat(stat: CountStat, fill_to_time: datetime, realm: Realm | None = None) -> None:
    # TODO: The realm argument is not yet supported, in that we don't
    # have a solution for how to update FillState if it is passed.  It
    # exists solely as partial plumbing for when we do fully implement
    # doing single-realm analytics runs for use cases like data import.
    #
    # Also, note that for the realm argument to be properly supported,
    # the CountStat object passed in needs to have come from
    # E.g. get_count_stats(realm), i.e. have the realm_id already
    # entered into the SQL query defined by the CountState object.
    verify_UTC(fill_to_time)
    if floor_to_hour(fill_to_time) != fill_to_time:
        raise ValueError(f"fill_to_time must be on an hour boundary: {fill_to_time}")

    fill_state = FillState.objects.filter(property=stat.property).first()
    if fill_state is None:
        currently_filled = installation_epoch()
        fill_state = FillState.objects.create(
            property=stat.property, end_time=currently_filled, state=FillState.DONE
        )
        logger.info("INITIALIZED %s %s", stat.property, currently_filled)
    elif fill_state.state == FillState.STARTED:
        logger.info("UNDO START %s %s", stat.property, fill_state.end_time)
        do_delete_counts_at_hour(stat, fill_state.end_time)
        currently_filled = fill_state.end_time - stat.time_increment
        do_update_fill_state(fill_state, currently_filled, FillState.DONE)
        logger.info("UNDO DONE %s", stat.property)
    elif fill_state.state == FillState.DONE:
        currently_filled = fill_state.end_time
    else:
        raise AssertionError(f"Unknown value for FillState.state: {fill_state.state}.")

    if isinstance(stat, DependentCountStat):
        for dependency in stat.dependencies:
            dependency_fill_time = COUNT_STATS[dependency].last_successful_fill()
            if dependency_fill_time is None:
                logger.warning(
                    "DependentCountStat %s run before dependency %s.", stat.property, dependency
                )
                return
            fill_to_time = min(fill_to_time, dependency_fill_time)

    currently_filled += stat.time_increment
    while currently_filled <= fill_to_time:
        logger.info("START %s %s", stat.property, currently_filled)
        start = time.time()
        do_update_fill_state(fill_state, currently_filled, FillState.STARTED)
        do_fill_count_stat_at_hour(stat, currently_filled, realm)
        do_update_fill_state(fill_state, currently_filled, FillState.DONE)
        end = time.time()
        currently_filled += stat.time_increment
        logger.info("DONE %s (%dms)", stat.property, (end - start) * 1000)


def do_update_fill_state(fill_state: FillState, end_time: datetime, state: int) -> None:
    fill_state.end_time = end_time
    fill_state.state = state
    fill_state.save()


# We assume end_time is valid (e.g. is on a day or hour boundary as appropriate)
# and is time-zone-aware. It is the caller's responsibility to enforce this!
def do_fill_count_stat_at_hour(
    stat: CountStat, end_time: datetime, realm: Realm | None = None
) -> None:
    start_time = end_time - stat.interval
    if not isinstance(stat, LoggingCountStat):
        timer = time.time()
        assert stat.data_collector.pull_function is not None
        rows_added = stat.data_collector.pull_function(stat.property, start_time, end_time, realm)
        logger.info(
            "%s r
```

### Core Architecture Module: `analytics/lib/fixtures.py`
```
from math import sqrt
from random import Random

from analytics.lib.counts import CountStat


def generate_time_series_data(
    days: int = 100,
    business_hours_base: float = 10,
    non_business_hours_base: float = 10,
    growth: float = 1,
    autocorrelation: float = 0,
    spikiness: float = 1,
    holiday_rate: float = 0,
    frequency: str = CountStat.DAY,
    partial_sum: bool = False,
    random_seed: int = 26,
) -> list[int]:
    """
    Generate semi-realistic looking time series data for testing analytics graphs.

    days -- Number of days of data. Is the number of data points generated if
        frequency is CountStat.DAY.
    business_hours_base -- Average value during a business hour (or day) at beginning of
        time series, if frequency is CountStat.HOUR (CountStat.DAY, respectively).
    non_business_hours_base -- The above, for non-business hours/days.
    growth -- Ratio between average values at end of time series and beginning of time series.
    autocorrelation -- Makes neighboring data points look more like each other. At 0 each
        point is unaffected by the previous point, and at 1 each point is a deterministic
        function of the previous point.
    spikiness -- 0 means no randomness (other than holiday_rate), higher values increase
        the variance.
    holiday_rate -- Fraction of days randomly set to 0, largely for testing how we handle 0s.
    frequency -- Should be CountStat.HOUR or CountStat.DAY.
    partial_sum -- If True, return partial sum of the series.
    random_seed -- Seed for random number generator.
    """
    rng = Random(random_seed)

    if frequency == CountStat.HOUR:
        length = days * 24
        seasonality = [non_business_hours_base] * 24 * 7
        for day in range(5):
            for hour in range(8):
                seasonality[24 * day + hour] = business_hours_base
        holidays = []
        for i in range(days):
            holidays.extend([rng.random() < holiday_rate] * 24)
    elif frequency == CountStat.DAY:
        length = days
        seasonality = [8 * business_hours_base + 16 * non_business_hours_base] * 5 + [
            24 * non_business_hours_base
        ] * 2
        holidays = [rng.random() < holiday_rate for i in range(days)]
    else:
        raise AssertionError(f"Unknown frequency: {frequency}")
    if length < 2:
        raise AssertionError(
            f"Must be generating at least 2 data points. Currently generating {length}"
        )
    growth_base = growth ** (1.0 / (length - 1))
    values_no_noise = [seasonality[i % len(seasonality)] * (growth_base**i) for i in range(length)]

    noise_scalars = [rng.gauss(0, 1)]
    for i in range(1, length):
        noise_scalars.append(
            noise_scalars[-1] * autocorrelation + rng.gauss(0, 1) * (1 - autocorrelation)
        )

    values = [
        0 if holiday else int(v + sqrt(v) * noise_scalar * spikiness)
        for v, noise_scalar, holiday in zip(values_no_noise, noise_scalars, holidays, strict=False)
    ]
    if partial_sum:
        for i in range(1, length):
            values[i] = values[i - 1] + values[i]
    return [max(v, 0) for v in values]

```

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

### Incident Patch 1: `25a08ae4` (2026-09-29)
**Commit Message**: Revert "recipients: Reduce query count for new DirectMessageGroup."

This reverts commit 8e6797d9abdced91710cc1462fa7f9409df19319, which was
merged by mistake.

**File**: `zerver/models/recipients.py` (modified, +17/-64)
```diff
@@ -2,9 +2,8 @@
 from collections import defaultdict
 from typing import TYPE_CHECKING
 
-from django.db import connection, models, transaction
+from django.db import models, transaction
 from django.db.models import QuerySet
-from psycopg2.sql import SQL, Identifier
 from typing_extensions import override
 
 from zerver.lib.display_recipient import get_display_recipient
@@ -157,69 +156,23 @@ def get_or_create_direct_message_group(id_list: list[int]) -> DirectMessageGroup
             huddle_hash=direct_message_group_hash,
             group_size=len(id_list),
         )
-
-        if not created:
-            return direct_message_group
-
-        recipient = Recipient.objects.create(
-            type_id=direct_message_group.id, type=Recipient.DIRECT_MESSAGE_GROUP
-        )
-
-        # The equivalent effect of doing
-        # direct_message_group.save(update_fields=["recipient"]) is handled
-        # in the following raw query via UPDATE to save us a query.
-        direct_message_group.recipient = recipient
-
-        # In a single raw query, we do 2 required things after creating
-        # a new DirectMessageGroup object:
-        # 1. Update the recipient field to reflect the above assignment in db.
-        # 2. Bulk create subscriptions for the participants.
-        query = SQL(
-            """
-            UPDATE {dmg_table}
-            SET recipient_id = %(recipient_id)s
-            WHERE {dmg_table}.id = %(dmg_id)s;
-
-            INSERT INTO {subscription_table}
-                (
-                    user_profile_id,
-                    is_user_active,
-                    recipient_id,
-                    active,
-                    is_muted,
-                    color,
-                    pin_to_top
-                )
-            SELECT
-                {user_profile_table}.id,
-                {user_profile_table}.is_active,
-                %(recipient_id)s,
-                %(active)s,
-                %(is_muted)s,
-                %(color)s,
-                %(pin_to_top)s
-            FROM {user_profile_table}
-            WHERE {user_profile_table}.id = ANY(%(participant_ids)s);
-        """
-        ).format(
-            dmg_table=Identifier(DirectMessageGroup._meta.db_table),
-            subscription_table=Identifier(Subscription._meta.db_table),
-            user_profile_table=Identifier(UserProfile._meta.db_table),
-        )
-        with connection.cursor() as cursor:
-            cursor.execute(
-                query,
-                {
-                    "recipient_id": recipient.id,
-                    "dmg_id": direct_message_group.id,
-                    "active": Subscription._meta.get_field("active").get_default(),
-                    "is_muted": Subscription._meta.get_field("is_muted").get_default(),
-                    "color": Subscription._meta.get_field("color").get_default(),
-                    "pin_to_top": Subscription._meta.get_field("pin_to_top").get_default(),
-                    "participant_ids": id_list,
-                },
+        if created:
+            recipient = Recipient.objects.create(
+                type_id=direct_message_group.id, type=Recipient.DIRECT_MESSAGE_GROUP
             )
-
+            direct_message_group.recipient = recipient
+            direct_message_group.save(update_fields=["recipient"])
+            subs_to_create = [
+                Subscription(
+                    recipient=recipient,
+                    user_profile_id=user_profile_id,
+                    is_user_active=is_active,
+                )
+                for user_profile_id, is_active in UserProfile.objects.filter(id__in=id_list)
+                .distinct("id")
+                .values_list("id", "is_active")
+            ]
+            Subscription.objects.bulk_create(subs_to_create)
         return direct_message_group
 
 
```

**File**: `zerver/tests/test_channel_fetch.py` (modified, +1/-1)
```diff
@@ -883,7 +883,7 @@ def test_gather_subscriptions(self) -> None:
             polonius.id,
         ]
 
-        with self.assert_database_query_count(61):
+        with self.assert_database_query_count(67):
             self.subscribe_via_post(
                 self.user_profile,
                 stream_names,
```

**File**: `zerver/tests/test_example.py` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ def test_capturing_queries(self) -> None:
         cordelia = self.example_user("cordelia")
 
         # when direct message group doesn't exist and should be created as part of the flow
-        with self.assert_database_query_count(20):
+        with self.assert_database_query_count(22):
             self.send_personal_message(
                 from_user=hamlet,
                 to_user=cordelia,
```

**File**: `zerver/tests/test_message_send.py` (modified, +8/-8)
```diff
@@ -2950,7 +2950,7 @@ def test_personal_message(self) -> None:
         prospero = self.example_user("prospero")
 
         # A normal user sends a personal message.
-        with self.assert_database_query_count(20):
+        with self.assert_database_query_count(22):
             self.send_personal_message(hamlet, cordelia)
 
         # Give guests limited user access.
@@ -2961,12 +2961,12 @@ def test_personal_message(self) -> None:
 
         # A guest with limited user access sends a personal message
         # to another accessible user.
-        with self.assert_database_query_count(21):
+        with self.assert_database_query_count(23):
             self.send_personal_message(polonius, hamlet)
 
         # A guest with limited user access sends a personal message
         # to themself.
-        with self.assert_database_query_count(17):
+        with self.assert_database_query_count(19):
             self.send_personal_message(polonius, polonius)
 
         # A guest with limited user access sends a personal message
@@ -2999,7 +2999,7 @@ def test_group_direct_message(self) -> None:
 
         # A normal user sends the first message
         # to a new DirectMessageGroup.
-        with self.assert_database_query_count(24):
+        with self.assert_database_query_count(26):
             self.send_group_direct_message(iago, recipients)
 
         # A normal user sends a message
@@ -3018,7 +3018,7 @@ def test_group_direct_message(self) -> None:
 
         # A guest with limited user access sends the first message
         # to a new DirectMessageGroup.
-        with self.assert_database_query_count(26):
+        with self.assert_database_query_count(28):
             self.send_group_direct_message(polonius, recipients)
 
         # A guest with limited user access sends a message
@@ -3116,7 +3116,7 @@ def test_direct_message_initiator_group_setting(self) -> None:
             acting_user=None,
         )
         othello = self.example_user("othello")
-        with self.assert_database_query_count(19):
+        with self.assert_database_query_count(21):
             self.send_personal_message(user_profile, othello)
 
     def test_direct_message_permission_group_setting(self) -> None:
@@ -3144,7 +3144,7 @@ def test_direct_message_permission_group_setting(self) -> None:
             acting_user=None,
         )
         # Tests if the user is allowed to send to administrators.
-        with self.assert_database_query_count(20):
+        with self.assert_database_query_count(22):
             self.send_personal_message(user_profile, admin)
         self.send_personal_message(admin, user_profile)
         # Tests if we can send messages to self irrespective of the value of the setting.
@@ -3162,7 +3162,7 @@ def test_direct_message_permission_group_setting(self) -> None:
 
         # We can send to this direct message group as it has administrator as one of the
         # recipient.
-        with self.assert_database_query_count(20):
+        with self.assert_database_query_count(22):
             self.send_group_direct_message(user_profile, direct_message_group)
         self.send_group_direct_message(admin, direct_message_group)
 
```

**File**: `zerver/tests/test_signup.py` (modified, +1/-1)
```diff
@@ -1068,7 +1068,7 @@ def test_register(self) -> None:
         # to sending messages, such as getting the welcome bot, looking up
         # the alert words for a realm, etc.
         with (
-            self.assert_database_query_count(97),
+            self.assert_database_query_count(99),
             self.assert_memcached_count(19),
             self.captureOnCommitCallbacks(execute=True),
         ):
```

---

### Incident Patch 2: `50dd0dca` (2026-09-29)
**Commit Message**: puppeteer: Fix flaky click racing the users table presence re-render.

`test_deactivate_user` intermittently failed with "Error: Node is
detached from document" when clicking deactivate button.

`settings_users.populate_users` renders the users table, then
rebuilds it from scratch once the `POST /json/users/me/presence`
fetch completes. On the first render, user row has an empty
`.loading-placeholder`, which only gets its spinner in a
`setTimeout(0)`. Puppeteer treats elements with a zero-height
bounding box as hidden, so waiting for the placeholder with
`{hidden: true}` could succeed before the spinner was added,
without waiting for the re-render. If the re-render then landed
while `page.click` was between finding the button and clicking
it, the click failed on the removed element.

Wait for the placeholder to be removed from the DOM instead.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `web/e2e-tests/user-deactivation.test.ts` (modified, +8/-2)
```diff
@@ -46,8 +46,14 @@ async function test_deactivate_user(page: Page): Promise<void> {
     const cordelia_user_row = await user_row(page, common.fullname.cordelia);
     await page.waitForSelector(cordelia_user_row, {visible: true});
     // Wait for the presence-data fetch in `settings_users.populate_users`
-    // to complete and the table to re-render.
-    await page.waitForSelector(cordelia_user_row + " .loading-placeholder", {hidden: true});
+    // to complete and the table to re-render. We check that the placeholder
+    // is removed, not hidden, because it has zero height (which Puppeteer
+    // treats as hidden) until its loading indicator is added.
+    await page.waitForFunction(
+        (selector: string) => document.querySelector(selector) === null,
+        {},
+        cordelia_user_row + " .loading-placeholder",
+    );
     await page.waitForSelector(cordelia_user_row + " .zulip-icon-user-x", {visible: true});
     await page.click(cordelia_user_row + " .deactivate");
     await common.wait_for_micromodal_to_open(page);
```

---

### Incident Patch 3: `41860b07` (2026-09-04)
**Commit Message**: realm-logo: Fix distortion for images with aspect ratio > 10:1.

The navbar constrains the organization logo to a 12.5em by 1.25em
box, an aspect ratio of 10:1. Because the height was a fixed
length, clamping a wider logo's width to max-width left the height
untouched, so anything wider than 10:1 was squashed horizontally; a
16:1 logo was drawn as 10:1.

Constraining with max-height instead lets the height follow
proportionally when max-width binds, so the box always matches the
image's aspect ratio and every logo is drawn as large as it can be
inside the box. The max-height values match the previous fixed
heights, so logos at 10:1 or narrower render exactly as before.

This requires giving the default logo explicit width and height
attributes. It declared only a viewBox, so it had an aspect ratio
but no intrinsic size, and with height: auto inside the navbar's
flex container it collapsed to 0x0. That is the regression that
caused d55e300 to be reverted. Uploaded logos are unaffected, since
SVG is not an accepted upload format and rasters always carry their
dimensions.

The issue describes the box as 200x25 and the threshold as 8:1,
which was accurate when it was filed; c5b8255d4 l

**File**: `static/images/logo/zulip-org-logo.svg` (modified, +1/-1)
```diff
@@ -1 +1 @@
-<svg xmlns="http://www.w3.org/2000/svg" viewBox="68.96 55.62 1742.12 450.43"><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#50adff"/><stop offset="1" stop-color="#7877fc"/></linearGradient><linearGradient id="b" x1="0" y1="-1" x2="0" y2="2"><stop offset="0" stop-color="#50adff"/><stop offset="1" stop-color="#7877fc"/></linearGradient><path fill="url(#a)" d="M473.09 122.97c0 22.69-10.19 42.85-25.72 55.08L296.61 312.69c-2.8 2.4-6.44-1.47-4.42-4.7l55.3-110.72c1.55-3.1-.46-6.91-3.64-6.91H129.36c-33.22 0-60.4-30.32-60.4-67.37 0-37.06 27.18-67.37 60.4-67.37h283.33c33.22-.02 60.4 30.3 60.4 67.35zM129.36 506.05h283.33c33.22 0 60.4-30.32 60.4-67.37 0-37.06-27.18-67.37-60.4-67.37H198.2c-3.18 0-5.19-3.81-3.64-6.91l55.3-110.72c2.02-3.23-1.62-7.1-4.42-4.7L94.68 383.6c-15.53 12.22-25.72 32.39-25.72 55.08 0 37.05 27.18 67.37 60.4 67.37z"/><path d="m651.86 381.9 124.78-179.6v-1.56H663.52v-48.98h190.09v34.21L731.55 363.24v1.56h124.01v48.98h-203.7V381.9zm338.98-230.14V302.6c0 45.09 17.1 68.03 47.43 68.03 31.1 0 48.2-21.77 48.2-68.03V151.76h59.09V298.7c0 80.86-40.82 119.34-109.24 119.34-66.09 0-104.96-36.54-104.96-120.12V151.76h59.48zm244.91 0h59.48v212.25h104.18v49.76h-163.66V151.76zm297 0v262.01h-59.48V151.76h59.48zm90.18 3.5c18.27-3.11 43.93-5.44 80.08-5.44 36.54 0 62.59 7 80.08 20.99 16.72 13.22 27.99 34.99 27.99 60.64 0 25.66-8.55 47.43-24.1 62.2-20.21 19.05-50.15 27.6-85.13 27.6-7.77 0-14.77-.39-20.21-1.17v93.69h-58.7V155.26zm58.7 118.96c5.05 1.17 11.27 1.55 19.83 1.55 31.49 0 50.92-15.94 50.92-42.76 0-24.1-16.72-38.49-46.26-38.49-12.05 0-20.21 1.17-24.49 2.33v77.37z" fill="url(#b)"/></svg>
\ No newline at end of file
+<svg xmlns="http://www.w3.org/2000/svg" width="1742.12" height="450.43" viewBox="68.96 55.62 1742.12 450.43"><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#50adff"/><stop offset="1" stop-color="#7877fc"/></linearGradient><linearGradient id="b" x1="0" y1="-1" x2="0" y2="2"><stop offset="0" stop-color="#50adff"/><stop offset="1" stop-color="#7877fc"/></linearGradient><path fill="url(#a)" d="M473.09 122.97c0 22.69-10.19 42.85-25.72 55.08L296.61 312.69c-2.8 2.4-6.44-1.47-4.42-4.7l55.3-110.72c1.55-3.1-.46-6.91-3.64-6.91H129.36c-33.22 0-60.4-30.32-60.4-67.37 0-37.06 27.18-67.37 60.4-67.37h283.33c33.22-.02 60.4 30.3 60.4 67.35zM129.36 506.05h283.33c33.22 0 60.4-30.32 60.4-67.37 0-37.06-27.18-67.37-60.4-67.37H198.2c-3.18 0-5.19-3.81-3.64-6.91l55.3-110.72c2.02-3.23-1.62-7.1-4.42-4.7L94.68 383.6c-15.53 12.22-25.72 32.39-25.72 55.08 0 37.05 27.18 67.37 60.4 67.37z"/><path d="m651.86 381.9 124.78-179.6v-1.56H663.52v-48.98h190.09v34.21L731.55 363.24v1.56h124.01v48.98h-203.7V381.9zm338.98-230.14V302.6c0 45.09 17.1 68.03 47.43 68.03 31.1 0 48.2-21.77 48.2-68.03V151.76h59.09V298.7c0 80.86-40.82 119.34-109.24 119.34-66.09 0-104.96-36.54-104.96-120.12V151.76h59.48zm244.91 0h59.48v212.25h104.18v49.76h-163.66V151.76zm297 0v262.01h-59.48V151.76h59.48zm90.18 3.5c18.27-3.11 43.93-5.44 80.08-5.44 36.54 0 62.59 7 80.08 20.99 16.72 13.22 27.99 34.99 27.99 60.64 0 25.66-8.55 47.43-24.1 62.2-20.21 19.05-50.15 27.6-85.13 27.6-7.77 0-14.77-.39-20.21-1.17v93.69h-58.7V155.26zm58.7 118.96c5.05 1.17 11.27 1.55 19.83 1.55 31.49 0 50.92-15.94 50.92-42.76 0-24.1-16.72-38.49-46.26-38.49-12.05 0-20.21 1.17-24.49 2.33v77.37z" fill="url(#b)"/></svg>
\ No newline at end of file
```

**File**: `web/styles/zulip.css` (modified, +6/-2)
```diff
@@ -1185,11 +1185,15 @@ nav {
 
         .nav-logo {
             display: inline-block;
-            height: 1.25em; /* 20px at 16px em */
+            /* Constrain the logo with maximums rather than a fixed
+               height, so that logos wider than the box's aspect ratio
+               scale down proportionally instead of being squashed. */
+            height: auto;
+            max-height: 1.25em; /* 20px at 16px em */
             max-width: var(--realm-logo-max-width);
 
             @media (height < $short_navbar_cutoff_height) {
-                height: 0.9375em; /* 15px at 16px em */
+                max-height: 0.9375em; /* 15px at 16px em */
             }
         }
 
```

---

### Incident Patch 4: `a39eb2dc` (2026-09-16)
**Commit Message**: web tests: Split the realm update_dict fixture by data variant.

The server sends one setting family per realm/update_dict event, and
RealmUpdateDictEvent.data is a union of one model per family, but the
node fixture bundled every family into a single data dict. It only
passed check-schemas because GroupSettingUpdateData, whose fields are
all optional, accepts any dict; once event models reject undeclared
fields, no variant accepts the mix. Split it into one fixture per
variant, matching what the server sends -- including mandatory_topics
alongside topics_policy.

Also drop the header's claim that check-schemas skips edge cases; it
has no skip list.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `web/tests/dispatch.test.cjs` (modified, +7/-2)
```diff
@@ -760,7 +760,6 @@ run_test("realm settings", ({override}) => {
     dispatch(event);
     assert_same(realm.realm_media_preview_size, 150);
 
-    event = event_fixtures.realm__update_dict__default;
     override(realm, "realm_create_multiuse_invite_group", 1);
     override(realm, "realm_allow_message_editing", false);
     override(realm, "realm_message_content_edit_limit_seconds", 0);
@@ -797,7 +796,12 @@ run_test("realm settings", ({override}) => {
         assert.deepEqual(sub, {...events.test_streams.devel, can_add_subscribers: false});
         add_subscribers_element_updated = true;
     });
-    dispatch(event);
+    dispatch(event_fixtures.realm__update_dict__allow_message_editing);
+    dispatch(event_fixtures.realm__update_dict__message_content_edit_limit_seconds);
+    dispatch(event_fixtures.realm__update_dict__authentication_methods);
+    dispatch(event_fixtures.realm__update_dict__group_settings);
+    dispatch(event_fixtures.realm__update_dict__plan_type);
+    dispatch(event_fixtures.realm__update_dict__topics_policy);
     assert_same(realm.realm_create_multiuse_invite_group, 3);
     assert_same(realm.realm_allow_message_editing, true);
     assert_same(realm.realm_message_content_edit_limit_seconds, 5);
@@ -813,6 +817,7 @@ run_test("realm settings", ({override}) => {
     assert_same(realm.realm_can_resolve_topics_group, 1);
     assert_same(realm.realm_direct_message_permission_group, 3);
     assert_same(realm.realm_topics_policy, "disable_empty_topic");
+    assert_same(realm.realm_mandatory_topics, true);
     assert_same(realm.realm_plan_type, 3);
     assert_same(realm.realm_upload_quota_mib, 50000);
     assert_same(realm.max_file_upload_size_mib, 1024);
```

**File**: `web/tests/lib/events.cjs` (modified, +52/-12)
```diff
@@ -4,11 +4,10 @@ const {Role} = require("./example_user.cjs");
 
 //  These events are not guaranteed to be perfectly
 //  representative of what the server sends.  We
-//  have a tool called check-schemas that tries
-//  to validate this data against server side schemas,
-//  but there are certain edge cases that the tool now
-//  skips.  And even when the data matches the schema,
-//  it may not be completely representative.
+//  have a tool called check-schemas that validates
+//  this data against server side schemas, but even
+//  when the data matches the schema, it may not be
+//  completely representative.
 
 const test_user = {
     email: "test@example.com",
@@ -470,17 +469,32 @@ exports.fixtures = {
         value: 42,
     },
 
-    realm__update_dict__default: {
+    realm__update_dict__allow_message_editing: {
         type: "realm",
         op: "update_dict",
         property: "default",
         data: {
             allow_message_editing: true,
-            message_content_edit_limit_seconds: 5,
-            create_multiuse_invite_group: 3,
+        },
+    },
+
+    realm__update_dict__authentication_methods: {
+        type: "realm",
+        op: "update_dict",
+        property: "default",
+        data: {
             authentication_methods: {
                 Google: {enabled: true, available: true},
             },
+        },
+    },
+
+    realm__update_dict__group_settings: {
+        type: "realm",
+        op: "update_dict",
+        property: "default",
+        data: {
+            create_multiuse_invite_group: 3,
             can_add_custom_emoji_group: 3,
             can_add_subscribers_group: 3,
             can_create_bots_group: 3,
@@ -489,10 +503,6 @@ exports.fixtures = {
             can_move_messages_between_topics_group: 3,
             can_resolve_topics_group: 1,
             direct_message_permission_group: 3,
-            plan_type: 3,
-            upload_quota_mib: 50000,
-            max_file_upload_size_mib: 1024,
-            topics_policy: "disable_empty_topic",
         },
     },
 
@@ -516,6 +526,15 @@ exports.fixtures = {
         },
     },
 
+    realm__update_dict__message_content_edit_limit_seconds: {
+        type: "realm",
+        op: "update_dict",
+        property: "default",
+        data: {
+            message_content_edit_limit_seconds: 5,
+        },
+    },
+
     realm__update_dict__night_logo: {
         type: "realm",
         op: "update_dict",
@@ -526,6 +545,27 @@ exports.fixtures = {
         },
     },
 
+    realm__update_dict__plan_type: {
+        type: "realm",
+        op: "update_dict",
+        property: "default",
+        data: {
+            plan_type: 3,
+            upload_quota_mib: 50000,
+            max_file_upload_size_mib: 1024,
+        },
+    },
+
+    realm__update_dict__topics_policy: {
+        type: "realm",
+        op: "update_dict",
+        property: "default",
+        data: {
+            topics_policy: "disable_empty_topic",
+            mandatory_topics: true,
+        },
+    },
+
     realm_bot__add: {
         type: "realm_bot",
         op: "add",
```

---

### Incident Patch 5: `01359204` (2026-09-25)
**Commit Message**: eslint: Fix @typescript-eslint/prefer-optional-chain.

Signed-off-by: Anders Kaseorg <anders@zulip.com>

**File**: `web/e2e-tests/lib/common.ts` (modified, +1/-5)
```diff
@@ -359,11 +359,7 @@ export async function wait_for_fully_processed_message(page: Page, content: stri
                       re-rendered based on server info?
             */
             const last_msg = zulip_test.current_msg_list?.last();
-            if (
-                last_msg === undefined ||
-                last_msg.raw_content !== content ||
-                last_msg.locally_echoed
-            ) {
+            if (last_msg?.raw_content !== content || last_msg.locally_echoed) {
                 return false;
             }
 
```

**File**: `web/src/vdom.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ export function eq_array<T>(
         return true;
     }
 
-    if (a === undefined || b === undefined || a.length !== b.length) {
+    if (a === undefined || a.length !== b?.length) {
         return false;
     }
 
```

---

### Incident Patch 6: `95bdfcaa` (2026-09-25)
**Commit Message**: eslint: Fix unicorn/prefer-logical-operator-over-ternary.

Signed-off-by: Anders Kaseorg <anders@zulip.com>

**File**: `web/debug-require-webpack-plugin.ts` (modified, +2/-2)
```diff
@@ -62,8 +62,8 @@ export default class DebugRequirePlugin implements webpack.WebpackPluginInstance
                         import.meta.dirname,
                         "./debug-require.cjs",
                         {},
-                        (err?: Error | null, result?: string | false) => {
-                            resolve(err ? false : result!);
+                        (err, result) => {
+                            resolve(err === null && result!);
                         },
                     );
                 });
```

**File**: `web/src/buddy_list.ts` (modified, +1/-1)
```diff
@@ -424,7 +424,7 @@ export class BuddyList extends BuddyListConf {
             // the user specified otherwise.
             this.set_section_collapse(
                 "#buddy-list-other-users-container",
-                this.render_data.hide_headers ? false : this.other_users_section.is_collapsed,
+                !this.render_data.hide_headers && this.other_users_section.is_collapsed,
             );
         }
 
```

**File**: `web/src/compose_notifications.ts` (modified, +1/-4)
```diff
@@ -176,11 +176,8 @@ export function should_jump_to_sent_message_conversation(message: Message): bool
         return true;
     }
 
-    const current_filter = narrow_state.filter();
-    const is_conversation_view =
-        current_filter === undefined ? false : current_filter.is_conversation_view();
     const $row = message_lists.current.get_row(message.id);
-    if (is_conversation_view && $row.length > 0) {
+    if (narrow_state.filter()?.is_conversation_view() && $row.length > 0) {
         // If our message is in the current conversation view, we do
         // not have a mix, so we are happy.
         return false;
```

**File**: `web/src/compose_send_menu_popover.ts` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ export function open_schedule_message_menu(
         },
         onHide() {
             // onHide returning false prevents Tippy from closing the popover when flatpickr is open.
-            return flatpickr.is_open() ? false : undefined;
+            return !flatpickr.is_open() && undefined;
         },
         onShow(instance) {
             // Only show send later options that are possible today.
```

**File**: `web/src/compose_ui.ts` (modified, +2/-3)
```diff
@@ -1299,9 +1299,8 @@ export let format_text = (
             text.slice(range.start - 1, range.start) === "[" &&
             text.slice(range.end, range.end + 2) === "](" &&
             text.includes(")", range.end + 2) &&
-            (text.includes("(", range.end + 2)
-                ? text.indexOf(")", range.end + 2) < text.indexOf("(", range.end + 2)
-                : true);
+            (!text.includes("(", range.end + 2) ||
+                text.indexOf(")", range.end + 2) < text.indexOf("(", range.end + 2));
 
         if (is_selection_description_of_link()) {
             let url = text.slice(range.end + 2, text.indexOf(")", range.end));
```

---

### Incident Patch 7: `91da9342` (2026-09-25)
**Commit Message**: eslint: Fix unicorn/prefer-smaller-scope.

Signed-off-by: Anders Kaseorg <anders@zulip.com>

**File**: `web/src/inbox_ui.ts` (modified, +1/-1)
```diff
@@ -2115,8 +2115,8 @@ export function update_internal(): void {
         const stream_unread = unread.unread_count_info_for_stream(stream_id);
         const stream_unread_count = stream_unread.unmuted_count + stream_unread.muted_count;
         const stream_key = get_stream_key(stream_id);
-        let stream_post_filter_unread_count = 0;
         if (stream_unread_count > 0) {
+            let stream_post_filter_unread_count = 0;
             const stream_topics_data = topics_dict.get(stream_key);
 
             // Stream isn't rendered.
```

**File**: `web/src/message_fetch.ts` (modified, +1/-1)
```diff
@@ -167,8 +167,8 @@ function process_result(data: MessageFetchResponse, opts: MessageFetchOptions):
     // messages not tracked in unread.ts during this fetching process.
     message_util.do_unread_count_updates(messages, true);
 
-    const is_contiguous_history = true;
     if (messages.length > 0) {
+        const is_contiguous_history = true;
         if (opts.msg_list) {
             if (opts.validate_filter_topic_post_fetch) {
                 opts.msg_list.data.filter.try_adjusting_for_moved_with_target(messages[0]);
```

**File**: `web/src/recent_view_ui.ts` (modified, +1/-1)
```diff
@@ -369,8 +369,8 @@ function update_load_more_banner(): void {
 }
 
 function get_min_load_count(already_rendered_count: number, load_count: number): number {
-    const extra_rows_for_viewing_pleasure = 15;
     if (row_focus > already_rendered_count + load_count) {
+        const extra_rows_for_viewing_pleasure = 15;
         return row_focus + extra_rows_for_viewing_pleasure - already_rendered_count;
     }
     return load_count;
```

---

### Incident Patch 8: `7e0b5aee` (2026-09-25)
**Commit Message**: eslint: Fix unicorn/prefer-set-methods.

Signed-off-by: Anders Kaseorg <anders@zulip.com>

**File**: `web/src/inbox_ui.ts` (modified, +1/-2)
```diff
@@ -448,8 +448,7 @@ function load_data_from_ls(): void {
     const saved_filters = new Set(z.optional(z.array(z.string())).parse(ls.get(ls_filter_key)));
     const valid_filters = new Set(Object.values(views_util.FILTERS));
     // If saved filters are not in the list of valid filters, we reset to default.
-    const is_subset = [...saved_filters].every((filter) => valid_filters.has(filter));
-    if (saved_filters.size === 0 || !is_subset) {
+    if (saved_filters.size === 0 || !saved_filters.isSubsetOf(valid_filters)) {
         filters = new Set([views_util.FILTERS.UNMUTED_TOPICS]);
     } else {
         filters = saved_filters;
```

**File**: `web/src/peer_data.ts` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function has_complete_subscriber_data(): boolean {
     const all_stream_ids = new Set(sub_store.stream_ids());
     return (
         all_stream_ids.size === fetched_stream_ids.size &&
-        all_stream_ids.difference(fetched_stream_ids).size === 0
+        all_stream_ids.isSubsetOf(fetched_stream_ids)
     );
 }
 
```

**File**: `web/src/people.ts` (modified, +1/-1)
```diff
@@ -1835,7 +1835,7 @@ function get_combined_promise_for_user_ids(user_ids: Set<number>): {
     // Check if we have an ongoing fetch that includes some of the
     // users needed by this request.
     for (const [user_ids_set, promise_data] of fetch_users_storage.promise_for_in_transit) {
-        if (user_ids_set.intersection(user_ids_pending_fetch).size > 0) {
+        if (!user_ids_set.isDisjointFrom(user_ids_pending_fetch)) {
             user_ids_pending_fetch = user_ids_pending_fetch.difference(user_ids_set);
             promises.push(promise_data.promise);
         }
```

**File**: `web/src/recent_view_ui.ts` (modified, +1/-2)
```diff
@@ -2301,8 +2301,7 @@ function load_filters(): void {
     // Verify that the dropdown_filters are valid.
     const valid_filters = new Set(Object.values(views_util.FILTERS));
     // If saved filters are not in the list of valid filters, we reset to default.
-    const is_subset = [...dropdown_filters].every((filter) => valid_filters.has(filter));
-    if (dropdown_filters.size === 0 || !is_subset) {
+    if (dropdown_filters.size === 0 || !dropdown_filters.isSubsetOf(valid_filters)) {
         dropdown_filters = new Set([views_util.FILTERS.UNMUTED_TOPICS]);
     }
 
```

---

### Incident Patch 9: `95a5da94` (2026-09-24)
**Commit Message**: eslint: Fix unicorn/no-lonely-if.

Signed-off-by: Anders Kaseorg <anders@zulip.com>

**File**: `web/src/emoji_frequency.ts` (modified, +6/-7)
```diff
@@ -19,13 +19,12 @@ function should_ignore_reaction(
     message: message_store.Message,
     reaction_sender_id?: number,
 ): boolean {
-    if (message.type === "stream") {
-        if (
-            user_topics.is_topic_muted(message.stream_id, message.topic) ||
-            stream_data.is_muted(message.stream_id)
-        ) {
-            return true;
-        }
+    if (
+        message.type === "stream" &&
+        (user_topics.is_topic_muted(message.stream_id, message.topic) ||
+            stream_data.is_muted(message.stream_id))
+    ) {
+        return true;
     }
     if (reaction_sender_id && muted_users.is_user_muted(reaction_sender_id)) {
         return true;
```

---

### Incident Patch 10: `7ac101c1` (2026-09-24)
**Commit Message**: eslint: Fix unicorn/prefer-combined-guards.

Signed-off-by: Anders Kaseorg <anders@zulip.com>

**File**: `web/e2e-tests/lib/common.ts` (modified, +5/-9)
```diff
@@ -359,15 +359,11 @@ export async function wait_for_fully_processed_message(page: Page, content: stri
                       re-rendered based on server info?
             */
             const last_msg = zulip_test.current_msg_list?.last();
-            if (last_msg === undefined) {
-                return false;
-            }
-
-            if (last_msg.raw_content !== content) {
-                return false;
-            }
-
-            if (last_msg.locally_echoed) {
+            if (
+                last_msg === undefined ||
+                last_msg.raw_content !== content ||
+                last_msg.locally_echoed
+            ) {
                 return false;
             }
 
```

**File**: `web/src/attachments_ui.ts` (modified, +1/-4)
```diff
@@ -68,10 +68,7 @@ export function percentage_used_space(uploads_size: number): string | null {
 }
 
 function set_upload_space_stats(): void {
-    if (realm.realm_upload_quota_mib === null) {
-        return;
-    }
-    if (current_user.is_guest) {
+    if (realm.realm_upload_quota_mib === null || current_user.is_guest) {
         return;
     }
 
```

**File**: `web/src/billing/event_status.ts` (modified, +4/-4)
```diff
@@ -61,10 +61,10 @@ async function stripe_checkout_session_status_check(stripe_session_id: string):
     });
     const response_data = stripe_response_schema.parse(response);
 
-    if (response_data.session.status === "created") {
-        return false;
-    }
-    if (response_data.session.event_handler!.status === "started") {
+    if (
+        response_data.session.status === "created" ||
+        response_data.session.event_handler!.status === "started"
+    ) {
         return false;
     }
     if (response_data.session.event_handler!.status === "succeeded") {
```

**File**: `web/src/click_handlers.ts` (modified, +6/-4)
```diff
@@ -598,10 +598,12 @@ export function initialize(): void {
     });
 
     $(".buddy-list-section").on("click", ".selectable_sidebar_block", (e) => {
-        if (e.metaKey || e.ctrlKey || e.shiftKey) {
-            return;
-        }
-        if ($(e.target).parents(".user-profile-picture").length === 1) {
+        if (
+            e.metaKey ||
+            e.ctrlKey ||
+            e.shiftKey ||
+            $(e.target).parents(".user-profile-picture").length === 1
+        ) {
             return;
         }
         if (mouse_drag.is_drag(e)) {
```

**File**: `web/src/components.ts` (modified, +1/-4)
```diff
@@ -79,10 +79,7 @@ export function toggle(opts: {
     // Returns false if the requested tab is disabled.
     function select_tab(idx: number): boolean {
         const $elem = meta.$ind_tab.eq(idx);
-        if ($elem.hasClass("disabled")) {
-            return false;
-        }
-        if ($elem.css("display") === "none") {
+        if ($elem.hasClass("disabled") || $elem.css("display") === "none") {
             return false;
         }
 
```

#### Recent Merged Pull Requests:
- **PR #40251** (2026-09-29): puppeteer: Remove unused wait_for_modal_to_close (@andersk)
- **PR #40250** (2026-09-29): web: Remove unused rewire functions (@andersk)
- **PR #40249** (2026-09-29): alert_popup: Remove unused module (@andersk)
- **PR #40248** (2026-09-29): dependencies: Remove unused JavaScript dependencies (@andersk)
- **PR #40246** (2026-09-29): python-warnings: Remove obsolete ignores (@andersk)
- **PR #40245** (2026-09-29): Upgrade JavaScript dependencies (@andersk)
- **PR #40244** (2026-09-30): puppeteer: Fix flaky click racing the users table presence re-render. (@sahil839)
- **PR #40243** (2026-09-30): Fixes to the incorrect merging of #39307 (@mateuszmandera)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
