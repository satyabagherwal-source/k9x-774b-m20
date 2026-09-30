# Forensic Learning Record (Deep Inspection): emcie-co/parlant

> **Canonical Artifact**: `07_PROJECT_LEARNING/emcie-co-parlant-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/emcie-co/parlant](https://github.com/emcie-co/parlant))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:45:35.012Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `emcie-co/parlant`
- **Description**: Build reliable customer-facing AI agents with Parlant: an interaction control harness optimized for controlled, consistent, and predictable LLM interactions.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 18300 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/healthcare.py`
```
# healthcare.py

import parlant.sdk as p
import asyncio
from datetime import datetime


@p.tool
async def get_insurance_providers(context: p.ToolContext) -> p.ToolResult:
    return p.ToolResult(["Mega Insurance", "Acme Insurance"])


@p.tool
async def get_upcoming_slots(context: p.ToolContext) -> p.ToolResult:
    # Simulate fetching available times from a database or API
    return p.ToolResult(data=["Monday 10 AM", "Tuesday 2 PM", "Wednesday 1 PM"])


@p.tool
async def get_later_slots(context: p.ToolContext) -> p.ToolResult:
    # Simulate fetching later available times
    return p.ToolResult(data=["November 3, 11:30 AM", "November 12, 3 PM"])


@p.tool
async def schedule_appointment(context: p.ToolContext, datetime: datetime) -> p.ToolResult:
    # Simulate scheduling the appointment
    return p.ToolResult(data=f"Appointment scheduled for {datetime}")


@p.tool
async def get_lab_results(context: p.ToolContext) -> p.ToolResult:
    # Simulate fetching lab results from a database or API,
    # using the customer ID from the context.
    lab_results = {
        "report": "All tests are within the valid range",
        "prognosis": "Patient is healthy as a horse!",
    }

    return p.ToolResult(
        data={
            "report": lab_results["report"],
            "prognosis": lab_results["prognosis"],
        }
    )


async def add_domain_glossary(agent: p.Agent) -> None:
    await agent.create_term(
        name="Office Phone Number",
        description="The phone number of our office, at +1-234-567-8900",
    )

    await agent.create_term(
        name="Office Hours",
        description="Office hours are Monday to Friday, 9 AM to 5 PM",
    )

    await agent.create_term(
        name="Charles Xavier",
        synonyms=["Professor X"],
        description="The doctor who specializes in neurology and is available on Mondays and Tuesdays.",
    )

    # Add other specific terms and definitions here, as needed...


# <<Add this function>>
async def create_scheduling_journey(server: p.Server, agent: p.Agent) -> p.Journey:
    # Create the journey
    journey = await agent.create_journey(
        title="Schedule an Appointment",
        description="Helps the patient find a time for their appointment.",
        triggers=["The patient wants to schedule an appointment"],
    )

    # First, determine the reason for the appointment
    t0 = await journey.initial_state.transition_to(chat_state="Determine the reason for the visit")

    # Load upcoming appointment slots into context
    t1 = await t0.target.transition_to(tool_state=get_upcoming_slots)

    # Ask which one works for them
    # We will transition conditionally from here based on the patient's response
    t2 = await t1.target.transition_to(
        chat_state="List available times and ask which ones works for them"
    )

    # We'll start with the happy path where the patient picks a time
    t3 = await t2.target.transition_to(
        chat_state="Confirm the details with the patient before scheduling",
        condition="The patient picks a time",
    )

    t4 = await t3.target.transition_to(
        tool_state=schedule_appointment,
        condition="The patient confirms the details",
    )
    t5 = await t4.target.transition_to(chat_state="Confirm the appointment has been scheduled")
    await t5.target.transition_to(state=p.END_JOURNEY)

    # Otherwise, if they say none of the times work, ask for later slots
    t6 = await t2.target.transition_to(
        tool_state=get_later_slots,
        condition="None of those times work for the patient",
    )
    t7 = await t6.target.transition_to(chat_state="List later times and ask if any of them works")

    # Transition back to our happy-path if they pick a time
    await t7.target.transition_to(state=t3.target, condition="The patient picks a time")

    # Otherwise, ask them to call the office
    t8 = await t7.target.transition_to(
        chat_state="Ask the patient to call the office to schedule an appointment",
        condition="None of those times work for the patient either",
    )
    await t8.target.transition_to(state=p.END_JOURNEY)

    # Handle edge-cases deliberately with guidelines

    await journey.create_guideline(
        condition="The patient says their visit is urgent",
        action="Tell them to call the office immediately",
    )

    return journey


async def create_lab_results_journey(server: p.Server, agent: p.Agent) -> p.Journey:
    # Create the journey
    journey = await agent.create_journey(
        title="Lab Results",
        description="Retrieves the patient's lab results and explains them.",
        triggers=["The patient wants to see their lab results"],
    )

    t0 = await journey.initial_state.transition_to(tool_state=get_lab_results)

    await t0.target.transition_to(
        chat_state="Tell the patient that the results are not available yet, and to try again later",
        condition="The lab results could not be found",
    )

    await t0.target.transition_to(
        chat_state="Explain the lab results to the patient - that they are normal",
        condition="The lab results are good - i.e., nothing to worry about",
    )

    await t0.target.transition_to(
        chat_state="Present the results and ask them to call the office "
        "for clarifications on the results as you are not a doctor",
        condition="The lab results are not good - i.e., there's an issue with the patient's health",
    )

    # Handle edge cases with guidelines...

    await agent.create_guideline(
        condition="The patient presses you for more conclusions about the lab results",
        action="Assertively tell them that you cannot help and they should call the office",
    )

    return journey


async def main() -> None:
    async with p.Server() as server:
        agent = await server.create_agent(
            name="Healthcare Agent",
            description="Is empathetic and calming to the patient.",
        )

        await add_domain_glossary(agent)
        scheduling_journey = await create_scheduling_journey(server, agent)
        lab_results_journey = await create_lab_results_journey(server, agent)

        status_inquiry = await agent.create_observation(
            "The patient asks to follow up on their visit, but it's not clear in which way",
        )

        # Use this observation to disambiguate between the two journeys
        await status_inquiry.disambiguate([scheduling_journey, lab_results_journey])

        await agent.create_guideline(
            condition="The patient asks about insurance",
            action="List the insurance providers we accept, and tell them to call the office for more details",
            tools=[get_insurance_providers],
        )

        await agent.create_guideline(
            condition="The patient asks to talk to a human agent",
            action="Ask them to call the office, providing the phone number",
        )

        await agent.create_guideline(
            condition="The patient inquires about something that has nothing to do with our healthcare",
            action="Kindly tell them you cannot assist with off-topic inquiries - do not engage with their request.",
        )


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/travel_voice_agent.py`
```
# travel_voice_agent.py

import parlant.sdk as p
import asyncio
from datetime import datetime


@p.tool
async def get_available_destinations(context: p.ToolContext) -> p.ToolResult:
    return p.ToolResult(
        [
            "Paris, France",
            "Tokyo, Japan",
            "Bali, Indonesia",
            "New York, USA",
        ]
    )


@p.tool
async def get_available_flights(context: p.ToolContext, destination: str) -> p.ToolResult:
    # Simulate fetching available flights from a booking system
    return p.ToolResult(
        data=[
            "Flight 123 - June 15, 9:00 AM, $850",
            "Flight 321 - June 16, 2:30 PM, $720",
            "Flight 987 - June 17, 6:45 PM, $680",
        ]
    )


@p.tool
async def get_alternative_flights(context: p.ToolContext, destination: str) -> p.ToolResult:
    # Simulate fetching alternative flights with different dates
    return p.ToolResult(
        data=[
            "Flight 485 - June 25, 11:00 AM, $920",
            "Flight 516 - July 2, 4:15 PM, $780",
        ]
    )


@p.tool
async def book_flight(context: p.ToolContext, flight_details: str) -> p.ToolResult:
    # Simulate booking the flight
    return p.ToolResult(
        data=f"Flight booked: {flight_details} for {p.Customer.current.name}. "
        f"Confirmation number: TRV-{datetime.now().strftime('%Y%m%d')}-001"
    )


@p.tool
async def get_booking_status(context: p.ToolContext, confirmation_number: str) -> p.ToolResult:
    # Simulate fetching booking status from a reservation system,
    # using the customer ID from the context.
    booking_info = {
        "status": "Confirmed",
        "details": "Flight to Paris on June 15, 9:00 AM. Seat 12A assigned.",
        "notes": "Check-in opens 24 hours before departure.",
    }

    return p.ToolResult(
        data={
            "status": booking_info["status"],
            "details": booking_info["details"],
            "notes": booking_info["notes"],
        }
    )


async def add_domain_glossary(agent: p.Agent) -> None:
    await agent.create_term(
        name="Office Phone Number",
        description="The phone number of our travel agency office, at +1-800-TRAVEL-1",
        synonyms=["contact number", "customer service number", "support line"],
    )

    await agent.create_term(
        name="Baggage Policy",
        description="This describes the rules and fees associated with checked and carry-on baggage.",
        synonyms=["luggage policy", "baggage rules", "carry-on policy"],
    )

    await agent.create_term(
        name="Cancellation Policy",
        description="This outlines the terms and conditions for cancelling a booking, including any fees or deadlines.",
        synonyms=["refund policy", "cancellation terms"],
    )

    await agent.create_term(
        name="Travel Insurance",
        description="An optional service that provides coverage for trip cancellations, medical emergencies, lost luggage, and other travel-related issues.",
        synonyms=["insurance", "trip protection", "travel protection"],
    )

    # Add other specific terms and definitions here, as needed...


async def create_flight_booking_journey(server: p.Server, agent: p.Agent) -> p.Journey:
    # Create the journey
    journey = await agent.create_journey(
        title="Book a Flight",
        description="Helps the customer find and book a flight to their desired destination.",
        triggers=["The customer wants to book a flight"],
    )

    # First, determine the destination
    t0 = await journey.initial_state.transition_to(chat_state="Ask about the destination")

    # Then ask about preferred travel dates
    t1 = await t0.target.transition_to(chat_state="Ask about preferred travel dates")

    # Load available flights into context
    t2 = await t1.target.transition_to(tool_state=get_available_flights)

    # Present flight options
    # We will transition conditionally from here based on the customer's response
    t3 = await t2.target.transition_to(
        chat_state="Present available flights and ask which one works for them"
    )

    # We'll start with the happy path where the customer picks a flight
    t4 = await t3.target.transition_to(
        chat_state="Collect passenger information and confirm booking details before proceeding",
        condition="The customer selects a flight",
    )

    t5 = await t4.target.transition_to(
        tool_state=book_flight,
        condition="The customer confirms the booking details",
    )
    t6 = await t5.target.transition_to(chat_state="Provide confirmation number and booking summary")
    await t6.target.transition_to(state=p.END_JOURNEY)

    # Otherwise, if none of the flights work, offer alternative dates
    t7 = await t3.target.transition_to(
        tool_state=get_alternative_flights,
        condition="None of the flights work for the customer",
    )
    t8 = await t7.target.transition_to(chat_state="Present alternative flights and ask if any work")

    # Transition back to our happy-path if they pick a flight
    await t8.target.transition_to(state=t4.target, condition="The customer selects a flight")

    # Otherwise, ask them to call the office or check our website
    t9 = await t8.target.transition_to(
        chat_state="Suggest calling our office or visiting our website for more options",
        condition="None of the alternative flights work either",
    )
    await t9.target.transition_to(state=p.END_JOURNEY)

    # Handle edge-cases deliberately with guidelines

    await journey.create_guideline(
        condition="The customer mentions they need to travel urgently or it's an emergency",
        action="Direct them to call our office immediately for priority booking assistance",
    )

    await journey.create_guideline(
        condition="The customer asks about visa requirements",
        action="Inform them that visa requirements vary by destination and nationality, and suggest they check with the embassy or consulate",
    )

    return journey


async def create_booking_status_journey(server: p.Server, agent: p.Agent) -> p.Journey:
    # Create the journey
    journey = await agent.create_journey(
        title="Check Booking Status",
        description="Retrieves the customer's booking status and provides relevant information.",
        triggers=["The customer wants to check their booking status"],
    )

    t0 = await journey.initial_state.transition_to(
        chat_state="Ask for the confirmation number or booking reference"
    )

    t1 = await t0.target.transition_to(tool_state=get_booking_status)

    await t1.target.transition_to(
        chat_state="Tell the customer that the booking could not be found and ask them to verify the confirmation number or call the office",
        condition="The booking could not be found",
    )

    await t1.target.transition_to(
        chat_state="Provide the booking details and confirm everything is in order",
        condition="The booking is confirmed and all details are correct",
    )

    await t1.target.transition_to(
        chat_state="Present the booking information and mention any issues or pending actions required",
        condition="The booking has issues or requires customer action",
    )

    # Handle edge cases with guidelines...

    await journey.create_guideline(
        condition="The customer wants to make changes to their booking",
        action="Explain the change policy and direct them to call our office for assistance with modifications",
    )

    await journey.create_guideline(
        condition="The customer is concerned about potential cancellation",
        action="Provide our cancellation policy and suggest they call the office to discuss their options",
    )

    return journey


async def configure_container(container: p.Container) -> p.Container:
    container[p.PerceivedPerformancePolicy] = p.VoiceOptimizedPerceivedPerformancePolicy()
    return container


async def main() -> None:
    async with p.Ser
```

### Core Architecture Module: `scripts/generate_client_sdk.py`
```
# Copyright 2026 Emcie Co Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#!python

import os
from pathlib import Path
import re
import subprocess
import shutil
import sys
import time


DIR_SCRIPT_ROOT = Path(__file__).parent
DIR_FERN = DIR_SCRIPT_ROOT / "fern"
DIR_SDKS = DIR_SCRIPT_ROOT / "sdks"
DIR_PROJECTS_WORKSPACE = DIR_SCRIPT_ROOT / ".." / ".." / "parlant-sdks"


PATHDICT_SDK_REPO_TARGETS = {
    "python": DIR_PROJECTS_WORKSPACE / "parlant-client-python" / "src" / "parlant" / "client",
    "typescript": DIR_PROJECTS_WORKSPACE / "parlant-client-typescript" / "src",
}


def replace_in_files(rootdir: Path, search: str, replace: str) -> None:
    rewrites: dict[str, str] = {}
    for subdir, _dirs, files in os.walk(rootdir):
        for file in files:
            file_path = os.path.join(subdir, file)

            with open(file_path, "r") as current_file:
                current_file_content = current_file.read()
                if "from parlant import" not in current_file_content:
                    continue

                current_file_content = re.sub(search, replace, current_file_content)
                rewrites[file_path] = current_file_content

    for path, content in rewrites.items():
        with open(path, "w") as current_file:
            current_file.write(content)


if __name__ == "__main__":
    DEFAULT_PORT = 8800
    port = DEFAULT_PORT
    if len(sys.argv) >= 2:
        port = int(sys.argv[1])

    print(f"The script will now try to fetch the latest openapi.json from http://localhost:{port}.")
    input(
        f"Ensure that parlant-server is running on port {port} and then press any key to continue..."
    )

    output_openapi_json = DIR_FERN / "openapi/parlant.openapi.json"
    output_openapi_json.parent.mkdir(exist_ok=True)
    output_openapi_json.touch()

    status, output = subprocess.getstatusoutput(
        f"curl -m 3 -o {output_openapi_json} http://localhost:{port}/openapi.json"
    )

    if status != 0:
        print(f"Failed to fetch openapi.json from http://localhost:{port}", file=sys.stderr)
        print("Please ensure that the desired Parlant server is accessible there.", file=sys.stderr)
        sys.exit(1)

    for sdk, repo in PATHDICT_SDK_REPO_TARGETS.items():
        if os.path.isdir(repo):
            continue

        raise Exception(f"Missing dir for {sdk}: {repo}")

    print(f"Fetched openapi.json from http://localhost:{port}.")

    if not DIR_FERN.is_dir():
        raise Exception("fern directory not found where expected")
    for sdk in PATHDICT_SDK_REPO_TARGETS:
        sdk_path = DIR_SDKS / sdk
        if not sdk_path.is_dir():
            continue

        print(f"Deleting old {sdk} sdk")
        print(f"> rm -rf {sdk_path}")
        shutil.rmtree(sdk_path)

    os.chdir(DIR_SCRIPT_ROOT)

    print("Invoking fern generation")
    print("> fern generate --log-level=debug")
    exit_code, generate_output = subprocess.getstatusoutput("fern generate --log-level=debug")
    with open("fern.generate.log", "w") as fern_log:
        fern_log.write(generate_output)
    if exit_code != os.EX_OK:
        raise Exception(generate_output)

    print("Renaming `parlant` to `parlant.client` in python imports")
    replace_in_files(DIR_SDKS / "python", "from parlant import", "from parlant.client import")

    print("touching python typing")

    print(f"> touch {DIR_SDKS}/python/py.typed")
    open(DIR_SDKS / "python/py.typed", "w")

    for sdk, repo in PATHDICT_SDK_REPO_TARGETS.items():
        print(f"!DANGER! Deleting local `{repo}` directory and all of its contents!")
        time.sleep(3)
        print(f"> rm -rf {repo}")
        shutil.rmtree(repo)

    for sdk, repo in PATHDICT_SDK_REPO_TARGETS.items():
        print(f"copying newly generated {sdk} files to {repo}")
        print(f"> cp -rp {DIR_SDKS}/{sdk} {repo}")
        shutil.copytree(DIR_SDKS / sdk, repo)

```

### Core Architecture Module: `scripts/initialize_repo.py`
```
# Copyright 2026 Emcie Co Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import subprocess
from pathlib import Path

SCRIPTS_DIR = Path("./scripts")


def install_packages() -> None:
    subprocess.run(["python", SCRIPTS_DIR / "install_packages.py"])


def install_hooks() -> None:
    subprocess.run(["git", "config", "core.hooksPath", ".githooks"], check=True)


if __name__ == "__main__":
    install_packages()
    install_hooks()

```

### Core Architecture Module: `scripts/install_packages.py`
```
# Copyright 2026 Emcie Co Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import subprocess
import sys

from utils import Package, die, for_each_package


def install_package(package: Package) -> None:
    if not package.uses_uv:
        print(f"Skipping {package.path}...")
        return

    print(f"Installing {package.path}...")

    status, output = subprocess.getstatusoutput(f"uv sync --all-extras --directory {package.path}")

    if status != 0:
        print(output, file=sys.stderr)
        die(f"error: failed to install package: {package.path}")


if __name__ == "__main__":
    for_each_package(install_package)

```

### Core Architecture Module: `scripts/lint.py`
```
# Copyright 2026 Emcie Co Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import sys
from functools import partial

from utils import Package, die, for_each_package


def run_cmd_or_die(
    cmd: str,
    description: str,
    package: Package,
) -> None:
    print(f"Running {cmd} on {package.name}...")

    status, output = package.run_cmd(cmd)

    if status != 0:
        print(output, file=sys.stderr)
        die(f"error: package '{package.path}': {description}")


def lint_package(mypy: bool, ruff: bool, package: Package) -> None:
    if mypy:
        run_cmd_or_die("mypy", "Please fix MyPy lint errors", package)
    if ruff:
        run_cmd_or_die("ruff check", "Please fix Ruff lint errors", package)
        run_cmd_or_die("ruff format --check", "Please format files with Ruff", package)


if __name__ == "__main__":
    mypy = "--mypy" in sys.argv
    ruff = "--ruff" in sys.argv

    for_each_package(partial(lint_package, mypy, ruff))

```

### Core Architecture Module: `scripts/publish.py`
```
# Copyright 2026 Emcie Co Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#!/usr/bin/python3
import semver  # type: ignore
import sys
import subprocess
import toml  # type: ignore

from utils import die, for_each_package, Package, get_packages


def get_server_version() -> str:
    server_package = next(p for p in get_packages() if p.name == "parlant")
    project_file = server_package.path / "pyproject.toml"
    pyproject = toml.load(project_file)
    version = str(pyproject["tool"]["poetry"]["version"])
    return version


def run_command(args: list[str]) -> None:
    cmd = " ".join(args)

    print(f"Running {cmd}")

    build_process = subprocess.Popen(
        args=args,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    status = build_process.wait()

    if status != 0:
        die(f"error: command failed: {cmd}")


def publish_docker() -> None:
    version = get_server_version()
    version_info = semver.parse_version_info(version)

    tag_versions = [
        f"{version_info.major}.{version_info.minor}.{version_info.patch}.{version_info.prerelease}",
    ]

    if not version_info.prerelease:
        tag_versions = [
            "latest",
            f"{version_info.major}",
            f"{version_info.major}.{version_info.minor}",
            f"{version_info.major}.{version_info.minor}.{version_info.patch}",
        ]
    else:
        tag_versions = [
            f"{version_info.major}.{version_info.minor}.{version_info.patch}.{version_info.prerelease}",
        ]

    platforms = [
        "linux/amd64",
        "linux/arm64",
    ]

    for version in tag_versions:
        run_command(
            [
                "docker",
                "buildx",
                "build",
                "--platform",
                ",".join(platforms),
                "-t",
                f"ghcr.io/emcie-co/parlant:{version}",
                "-f",
                "Dockerfile",
                "--push",
                ".",
            ]
        )


def publish_package(package: Package) -> None:
    if not package.uses_uv or not package.publish:
        print(f"Skipping {package.path}...")
        return

    status, output = package.run_cmd("uv build")

    if status != 0:
        print(output, file=sys.stderr)
        die(f"error: package '{package.path}': build failed")

    status, output = package.run_cmd("uv publish")

    if status != 0:
        print(output, file=sys.stderr)
        die(f"error: package '{package.path}': publish failed")


if __name__ == "__main__":
    for_each_package(publish_package)
    publish_docker()

```

### Core Architecture Module: `scripts/utils.py`
```
# Copyright 2026 Emcie Co Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from dataclasses import dataclass
import os
from pathlib import Path
import subprocess
import sys
from typing import Callable, NoReturn


@dataclass(frozen=True)
class Package:
    name: str
    path: Path
    uses_uv: bool
    cmd_prefix: str
    publish: bool

    def run_cmd(self, cmd: str) -> tuple[int, str]:
        print(f"Running command: {self.cmd_prefix} {cmd}")
        return subprocess.getstatusoutput(f"{self.cmd_prefix} {cmd}")


def get_repo_root() -> Path:
    status, output = subprocess.getstatusoutput("git rev-parse --show-toplevel")

    if status != 0:
        print(output, file=sys.stderr)
        print("error: failed to get repo root", file=sys.stderr)
        sys.exit(1)

    return Path(output.strip())


def get_packages() -> list[Package]:
    root = get_repo_root()

    return [
        Package(
            name="parlant",
            path=root / ".",
            cmd_prefix="uv run",
            uses_uv=True,
            publish=True,
        ),
    ]


def for_each_package(
    f: Callable[[Package], None],
    enter_dir: bool = True,
) -> None:
    for package in get_packages():
        original_cwd = os.getcwd()

        if enter_dir:
            print(f"Entering {package.path}...")
            os.chdir(package.path)

        try:
            f(package)
        finally:
            os.chdir(original_cwd)


def die(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    sys.exit(1)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #828** (2026-07-26): **[Bug]  Guideline↔tag associations dropped on restart (association loader stuck at v0.5.0)**
  *Symptoms*: # Description Guidelines created with tags (`agent:…` / `journey:…`) lose their tags after a server restart. On load, the association documents get moved into a `failed_migrations` collection instead of loading.  The cause looks like `GuidelineDocumentStore._association_document_loader` only handles versions up to `0.5.0`:  ```python if doc["version"] == "0.5.0":     return cast(GuidelineTagAssociationDocument, doc)  return None ``` …but the store writes associations at its current VERSION (0.10.0), so the loader returns None for them and they never load. The guideline _document_loader just above it does have a 0.9.0 → 0.10.0 migration — the association loader seems to have been missed.  How to Reproduce  Steps to reproduce the behavior: 1. Start parlant-server with local (JSON) storage. 2. Create a guideline via the REST client with tags=["agent:<id>"]. 3. Restart the server (with --migrate). 4. guideline_tag_associations is empty, the docs are in failed_migrations, and the guideline is no longer scoped to the agent.  Expected Behavior  Associations written at the store's current version reload normally, so guidelines keep their agent:/journey: scoping across restarts.  Environment  - OS: Windows 11 - Python version: 3.10 - Parlant version: 3.3.2  Discussion  Fails silently — guidelines just quietly stop being agent/journey-scoped after any restart. Journeys are unaffected (they use a separate loader). Looks like it only needs a passthrough branch for the current version (an
  **Post-Mortem & Fix Analysis**:
  > Seems this has been resolved but not yet released, meanwhile done the same patch. Closing and waiting for new release.

- **Issue #761** (2026-04-28): **[Security] LiteLLM supply chain attack**
  *Symptoms*: LiteLLM has been the victim of a critical security compromise. Versions 1.82.7 to 1.82.8 steal credentials from users as detailed [here](https://docs.litellm.ai/blog/security-update-march-2026).  Suggested remediation: - Block the impacted versions in [pyproject.toml](https://python-poetry.org/docs/dependency-specification/) and bump the Parlant version to 3.3.1 - Publish a security notice by following [these instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/publishing-a-repository-security-advisory) - If anyone from Emcie has been impacted directly, revoke and change all passwords, API keys, and authorizations  *Update 3/26: Cybernews has [published](https://cybernews.com/security/critical-litellm-supply-chain-attack-sends-shockwaves/) a useful article summarizing this attack*  *Update 3/27: FutureSearch [reports](https://futuresearch.ai/blog/litellm-hack-were-you-one-of-the-47000/) that there were only about 47,000 impacted users because PyPI quarantined the malicious packages after 46 minutes*
  **Post-Mortem & Fix Analysis**:
  > Fixed in #784 

- **Issue #741** (2026-05-13): **[Bug] MongoDB session store failure**
  *Symptoms*: # Description When using MongoDB session store for `p.Server`, the server hangs when handling client requests (in particular, /sessions endpoint)  # How to Reproduce Steps to reproduce the behavior: 1. Add `pyproject.toml` with dependencies: ```toml [project] name = "agent" version = "0.1.0" description = "Add your description here" readme = "README.md" requires-python = ">=3.11" dependencies = [     "aiohttp>=3.9.0",     "fastapi>=0.115.0",     "lagom>=2.7.7",     "parlant[mongo]>=3.2.0",     "pydantic>=2.11.9",     "pydash>=8.0.6",     "python-dotenv>=1.0.0",     "pyyaml>=6.0",     "qdrant-client>=1.13.0",     "requests>=2.32.5",     "uvicorn[standard]>=0.30.0", ] ``` 2. Set up dockerfile: ```dockerfile FROM astral/uv:python3.11-trixie  WORKDIR /app  COPY pyproject.toml .python-version ./  RUN uv sync  COPY . .  HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \     CMD .venv/bin/python -m src.healthcheck || exit 1  CMD [".venv/bin/python", "-m", "src.main"] ``` 2. Set up the following docker compose for server and Mongo storage: ```yaml services:   agent:     build: .     container_name: agent     env_file: .env     network_mode: host     ports:       - ${SERVER_PORT}:${SERVER_PORT}     volumes:       - parlant-data:/app/parlant-data     depends_on:       - mongo   mongo:     image: mongo:8.2.5     restart: always     environment:       MONGO_INITDB_ROOT_USERNAME: ${MONGODB_USER}       MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD}     ports:       -
  **Post-Mortem & Fix Analysis**:
  > @StaszekM can you please check if the mongo connection string is accessible from your parlant pod? Sometimes you need host.docker.internal instead of localhost in such scenarios.  For reference, we're testing mongo continuously on the managed hosting platform we're building and it's working for us.
  > Hi @kichanyurd, we tried setting the connections once again and the problem does not occur anymore. However it may be the case that in local development scenario we must keep the `?authSource=admin` part in the URL for both collections to work. Without this part, we get `pymongo.errors.OperationFailure: Authentication failed` Anyway closing the issue :)

- **Issue #739** (2026-03-08): **[Bug] Embedding retry policy doesn't cover ValueError: No embedding data received**
  *Symptoms*:  Body:    Description    The @policy retry decorator on OpenRouterEmbedder.do_embed does not retry when the OpenAI   SDK raises ValueError("No embedding data received"). This causes the entire engine   preparation iteration to fail on a transient upstream issue.    Error    ValueError: No embedding data received    Raised by the OpenAI SDK's post-parser in openai/resources/embeddings.py when the API   returns HTTP 200 but with an empty data array.    Root Cause    The retry policy in parlant/adapters/nlp/openrouter_service.py (lines ~418-431) only covers   API transport errors:    @policy(       [           retry(               exceptions=(                   APIConnectionError,                   APITimeoutError,                   ConflictError,                   RateLimitError,                   APIResponseValidationError,               ),           ),           retry(InternalServerError, max_exceptions=2, wait_times=(1.0, 5.0)),       ]   )   async def do_embed(self, texts, hints):    ValueError is a plain Python exception raised after the HTTP call succeeds, so it bypasses   the retry policy entirely.    Impact    A single transient empty embedding response from the upstream provider kills the entire   _run_preparation_iteration — glossary terms fail to load and the agent cannot process the   message.     ---
  **Post-Mortem & Fix Analysis**:
  > @interactivealex thanks for reporting! Would you mind doing a PR to fix this for OpenRouter?

- **Issue #738** (2026-02-28): **[Bug] JSONFileDocumentDatabase.__aexit__ does not handle CancelledError, causing server crash on shutdown**
  *Symptoms*:   ## Summary    An unhandled `asyncio.CancelledError` during `JSONFileDocumentDatabase.__aexit__()` can   crash the entire Parlant server process (exit code 1). The crash occurs because the   `__aexit__` method acquires an `aiorwlock` writer lock — which internally does `await   asyncio.sleep(0.0)` — without any `CancelledError` protection. This is a production crash we    encountered under load.    ## Affected Version    Parlant 3.1.2 (`a512916c`)    ## Bug Description    `JSONFileDocumentDatabase.__aexit__()` ([`src/parlant/adapters/db/json_file.py:74-82`](https   ://github.com/emcie-co/parlant/blob/a512916c/src/parlant/adapters/db/json_file.py#L74-L82))   has no `try/except` around its lock acquisition + flush:    ```python   async def __aexit__(self, exc_type, exc_value, traceback) -> bool:       async with self._lock.writer_lock:           await self._flush_unlocked()       return False    The ReaderWriterLock wraps aiorwlock.RWLock() with default fast=False   (src/parlant/core/async_utils.py:236). With fast=False, aiorwlock calls await   asyncio.sleep(0.0) in _yield_after_acquire on every lock acquisition — even uncontended   ones. This sleep(0) is a cancellation checkpoint: if a CancelledError is pending, it fires   there.    The aiorwlock library handles this correctly on its side (releases lock state, re-raises),   but JSONFileDocumentDatabase.__aexit__ does not catch the re-raised CancelledError. It   propagates through the exit stacks and kills the process.    Why 

- **Issue #736** (2026-02-28): **[Bug] Non-consequential tool rejected due to optional parameters marked "<<missing>>"**
  *Symptoms*: # Description  I’m observing behavior that I’m not sure is intentional; it may conflict with documentation or comments. Details below:  ### Observed behavior - Tool `my_tool_call` defines two optional parameters `foo` and `bar` (not required). - In the non-consequential path, the LLM inference outputs CASE 3, marking both optional parameters as `"<<__missing__>>"` with `should_run: true`. - However, in the subsequent evaluation phase, the tool is rejected with logs indicating “Missing arguments” and CANNOT_RUN.  ### Relevant code references - In `_evaluate_non_consequential_tool_calls`, `missing_required` includes any parameter with value `"<<__missing__>>"`, regardless of whether it’s in `tool.required` . - Whenever `missing_required` is non-empty, the tool call is rejected and missing warnings are logged [2](#3-1) . - The method’s comment says “Check if all required parameters are present,” but the implementation doesn’t distinguish required from optional  . - The non-consequential prompt’s CASE 1 explicitly allows inserting `null` for optional parameters that can’t be inferred and creating the call  .  ### Contrast with the consequential path - In the consequential path, execution is blocked only when parameters in `tool.required` are MISSING; optional MISSING does not block  . - Missing optional parameters are explicitly set to `None`, and the tool still executes  .  ### Potential conflict with documentation - Documentation I’ve seen describes non-consequential as “Instan
  **Post-Mortem & Fix Analysis**:
  > Fixed in 12afdb490.  The issue was in `_evaluate_non_consequential_tool_calls` in `single_tool_batch.py`.  The missing-parameter check was treating all parameters with "`<<__missing__>>"` as blocking, without distinguishing between required and optional.        The consequential path already handled this correctly (only blocking on missing required params, and setting optional ones to None), but the non-consequential path didn't follow the same logic. They're now aligned.  Thanks for bringing this up, @flowjzh !
  > Hi @kichanyurd ,  Thanks for the lightning-fast fix! I really appreciate the quick turnaround and for aligning the non-consequential path logic with the consequential one.  BTW, I’ve been testing the new non-consequential feature with the qwen-next-80b-a3b model, and the results are impressive. It cut our tool call processing time from ~10s down to under 5s. This is a massive performance gain for our workflow!  Thanks to the whole Parlant team for the great work. Wishing the project continued and long-term success! 🚀

- **Issue #735** (2026-03-18): **[Bug] LiteLLMEmbedder fails to resolve via lagom container when LITELLM_EMBEDDING_MODEL_NAME is set**
  *Symptoms*: # Environment    - parlant[litellm]: 3.2.2   - Python: 3.13  # Description  When using `p.Server(nlp_service=p.NLPServices.litellm)` with `LITELLM_EMBEDDING_MODEL_NAME` set, the server raises:  ``` lagom.exceptions.UnresolvableType: Unable to construct dependency of type LiteLLMEmbedder   The constructor probably has some unresolvable dependencies: LiteLLMEmbedder ```  ## Point of crash  I saw that it crashes in `parlant/core/nlp/embedding.py`:  ```py   def create_embedder(self, embedder_type: type[Embedder]) -> Embedder:       if embedder_type == NullEmbedder:           return NullEmbedder()       else:           return self._container[embedder_type]  # ← fails for LiteLLMEmbedder ```  ## Possible explanation (from Claude)  `LiteLLMEmbedder.__init__` requires model_name: str as its first positional argument. Lagom cannot auto-wire this because str is not a specifically registered type in the container. Since `LiteLLMEmbedder` is never registered with a factory that supplies model_name from the environment, the container raises UnresolvableType.  Note that `LiteLLMService.get_embedder()` already contains the correct logic to construct LiteLLMEmbedder from env vars — but this path is apparently bypassed in some code paths that go through EmbedderFactory.  # Workaround (suggested by Codex)  Subclass LiteLLMService and override get_embedder to bypass the container:  ```py     # TODO: Patched classes suggested by Codex     class DynamicLiteLLMEmbedder(LiteLLMEmbedder):         de
  **Post-Mortem & Fix Analysis**:
  > Fixed in fa563be81. The issue was that LiteLLMEmbedder takes a model_name: str constructor parameter that lagom's DI container can't auto-resolve. We now pre-register the embedder instance in the container during LiteLLM service initialization, so EmbedderFactory can resolve it.  **A related caveat to be aware of:**  The LiteLLM NLP service was an external contribution that doesn't fully meet our design standards for first-class NLP services.  Specifically, the vector DB layer identifies collections by embedder class name (e.g. `glossary_LiteLLMEmbedder`). This means if you change `LITELLM_EMBEDDING_MODEL_NAME` between server restarts (say from `text-embedding-3-small` to `text-embedding-ada-002`), the system won't detect that the embedder changed and won't re-index your data, so you'll end up querying stale embeddings from the old model, which corrupts your semantic space.  If you do switch embedding models, you should clear your vector store data to force re-indexing on the next star

- **Issue #734** (2026-02-27): **Chat UI event polling creates a tight infinite loop on idle sessions**
  *Symptoms*:    Affected version: Parlant SDK **3.1.2** (polling-based chat UI, before the SSE migration on main)    Symptom: Thousands of GET /sessions/{id}/events?min_offset=N requests per second on sessions that have    finished processing. The min_offset never advances.    Root cause: In session-view.tsx, formatMessagesFromEvents() calls setLastOffset(offset + 1) and then   refetch() synchronously on line 173. Since React batches state updates, the refetch() triggers   fetchData() inside useFetch which captures params (including min_offset) from the current render   closure — before React commits the new lastOffset. The fetch goes out with the stale min_offset.    On the backend, PollingSessionListener.wait_for_events() returns True immediately when events exist at    the requested offset (sessions.py:1337-1338). So the API returns 200 instantly instead of blocking   for 60s. Combined with the stale offset, this creates a tight loop: fetch → 200 → same events →   refetch with same offset → 200 → repeat, with no backoff.    Additional factor: useFetch is called with checkErr=false, so 504 timeouts also retry immediately   without any delay (line 84).    Impact: Saturates the server with requests, floods OTEL trace exports, and wastes bandwidth.    Note: We see the SSE migration on main (0afdb95c, dee012ec) fixes this by using EventSource + useRef    for offset tracking. Any timeline for releasing this in the SDK?
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report, @interactivealex.                                                                                                                                       The tight polling loop you identified in the chat UI has been fixed, like you mentioned.  Regarding the Python SDK (parlant-client-python): the `list_events` endpoint supports both long-polling and SSE modes.  If you're using the SDK directly in a polling loop, I'd recommend switching to `sse=True` to avoid this class of issue entirely.  With long-polling mode, the 504 timeout on idle sessions is expected behavior. Callers should add a backoff delay before retrying.  Thanks again for raising this!

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

### Incident Patch 1: `a96888a4` (2026-06-21)
**Commit Message**: fix(core): prevent version drift from silently dropping tag associations on restart

The `_association_document_loader` and several `_document_loader` implementations were using strict equality checks (`==`) against specific version numbers (e.g., `doc["version"] == "0.5.0"`). When a main store's `VERSION` was bumped, new tag associations were written with the newer version string. However, upon restart, these new documents failed the strict equality check and were silently dropped and moved to the `_failed_migrations` collection.

Changes:
- Added `__ge__` and `__le__` methods to the `Version` class in `common.py` to support semantic version range comparisons.
- Replaced the strict `==` version checks with `>=` range checks on the latest supported versions.
- Applied this fix across all affected document stores without an automated `DocumentMigrationHelper` (`guidelines.py`, `agents.py`, `customers.py`, `tags.py`, `capabilities.py`, `nlp/embedding.py`, and `guideline_tool_associations.py`).

**File**: `src/parlant/core/agents.py` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ async def _association_document_loader(
                 tag_id=TagId(doc["tag_id"]),
             )
 
-        if doc["version"] == "0.5.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.5.0"):
             return doc
 
         return None
```

**File**: `src/parlant/core/capabilities.py` (modified, +3/-3)
```diff
@@ -193,19 +193,19 @@ def __init__(
     async def _vector_document_loader(
         self, doc: VectorBaseDocument
     ) -> Optional[CapabilityVectorDocument]:
-        if doc["version"] == self.VERSION.to_string():
+        if Version.from_string(doc["version"]) >= self.VERSION:
             return cast(CapabilityVectorDocument, doc)
         return None
 
     async def _document_loader(self, doc: BaseDocument) -> Optional[CapabilityDocument]:
-        if doc["version"] == self.VERSION.to_string():
+        if Version.from_string(doc["version"]) >= self.VERSION:
             return cast(CapabilityDocument, doc)
         return None
 
     async def _association_document_loader(
         self, doc: BaseDocument
     ) -> Optional[CapabilityTagAssociationDocument]:
-        if doc["version"] == self.VERSION.to_string():
+        if Version.from_string(doc["version"]) >= self.VERSION:
             return cast(CapabilityTagAssociationDocument, doc)
         return None
 
```

**File**: `src/parlant/core/common.py` (modified, +10/-0)
```diff
@@ -138,6 +138,16 @@ def __gt__(self, other: object) -> bool:
             return NotImplemented
         return self._v > other._v
 
+    def __ge__(self, other: object) -> bool:
+        if not isinstance(other, Version):
+            return NotImplemented
+        return self._v >= other._v
+
+    def __le__(self, other: object) -> bool:
+        if not isinstance(other, Version):
+            return NotImplemented
+        return self._v <= other._v
+
 
 class ItemNotFoundError(Exception):
     def __init__(self, item_id: UniqueId, message: Optional[str] = None) -> None:
```

**File**: `src/parlant/core/customers.py` (modified, +2/-2)
```diff
@@ -167,7 +167,7 @@ def __init__(
         self._lock = ReaderWriterLock()
 
     async def _document_loader(self, doc: BaseDocument) -> Optional[_CustomerDocument]:
-        if doc["version"] == "0.1.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.1.0"):
             return cast(_CustomerDocument, doc)
 
         return None
@@ -185,7 +185,7 @@ async def _association_document_loader(
                 tag_id=doc["tag_id"],
             )
 
-        if doc["version"] == "0.2.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.2.0"):
             return cast(_CustomerTagAssociationDocument, doc)
 
         return None
```

**File**: `src/parlant/core/guideline_tool_associations.py` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ async def _document_loader(
         self,
         doc: BaseDocument,
     ) -> Optional[_GuidelineToolAssociationDocument]:
-        if doc["version"] == "0.1.0":
+        if Version.from_string(doc["version"]) >= Version.from_string("0.1.0"):
             return cast(_GuidelineToolAssociationDocument, doc)
         return None
 
```

---

### Incident Patch 2: `70c7b24c` (2026-06-03)
**Commit Message**: Merge pull request #805 from santangelx/fix/journey-reachable-follow-ups-fan-in

fix: make journey reachable-follow-ups order-independent at fan-in nodes

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ All notable changes to Parlant will be documented here.
 
 - Fix low-criticality matcher logging the entire inference blob once per guideline in a batch (N copies of the same payload at debug level); now logs a single per-item entry
 - Fix WebSocketLogger event loop starvation — when no WebSocket clients are subscribed, the drain loop processed queued messages without yielding, progressively blocking the async event loop and causing increasing latency over time
+- Fix journey reachable-follow-ups evaluation being order-dependent at fan-in nodes — `JourneyReachableNodesEvaluator` captured a child's path list by reference and then prepended to it in place, so a node with multiple parents had its stored routes mutated by whichever parent was visited first; the second parent then lost routes (or double-counted a hop) depending purely on graph/DFS order. The child's routes are now snapshotted per parent, making the result depend only on journey structure. This intentionally changes the computed follow-ups for existing fan-in journeys: a shared child's later parent now retains the routes it previously lost
 
 ### Security
 
```

**File**: `src/parlant/core/services/indexing/journey_reachable_nodes_evaluation.py` (modified, +2/-1)
```diff
@@ -373,7 +373,8 @@ async def evaluate_reachable_follow_ups(
                         ):
                             truncated_follow_ups[str(id)] = _ReachableFollowUps(
                                 condition=r.condition,
-                                path=r.path,
+                                # copy so a parent's prepend can't mutate the child's shared list
+                                path=list(r.path),
                             )
                             id += 1
                 children_info[child_idx] = _ChildInfo(
```

**File**: `tests/core/stable/services/indexing/test_journey_reachable_nodes_evaluator.py` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+# Copyright 2026 Emcie Co Ltd.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+import re
+from datetime import datetime, timezone
+from typing import Any, Mapping, Sequence
+from lagom import Container
+from typing_extensions import override
+
+from parlant.core.common import Criticality
+from parlant.core.engines.alpha.optimization_policy import OptimizationPolicy
+from parlant.core.engines.alpha.prompt_builder import PromptBuilder
+from parlant.core.guidelines import Guideline, GuidelineContent, GuidelineId
+from parlant.core.loggers import Logger
+from parlant.core.nlp.generation import SchematicGenerator, SchematicGenerationResult
+from parlant.core.nlp.generation_info import GenerationInfo, UsageInfo
+from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.services.indexing.journey_reachable_nodes_evaluation import (
+    ChildEvaluation,
+    JourneyReachableNodesEvaluator,
+    PathCondition,
+    ReachableNodesEvaluation,
+    ReachableNodesEvaluationSchema,
+)
+from parlant.core.services.tools.service_registry import ServiceRegistry
+
+
+class _ForwardAllReachableNodesGenerator(SchematicGenerator[ReachableNodesEvaluationSchema]):
+    # A deterministic stand-in for the LLM: it reads which children and onward-path ids
+    # the prompt exposes for the current node and forwards all of them, mimicking an
+    # ideal compliant model. This lets us exercise the graph-walk/path logic without
+    # real generation. Only `generate` is used.
+
+    _CHILD_RE = re.compile(r"Child id:\s*(\S+)")
+    _PATH_RE = re.compile(r"-\s*Condition\s*\((\d+)\)\s*:")
+
+    @override
+    async def generate(
+        self,
+        prompt: str | PromptBuilder,
+        hints: Mapping[str, Any] = {},
+    ) -> SchematicGenerationResult[ReachableNodesEvaluationSchema]:
+        text = prompt.build() if isinstance(prompt, PromptBuilder) else prompt
+        # Drop the few-shot examples, which render the same child/condition lines.
+        real_data = text.split("Example section is over")[-1]
+
+        children: dict[str, list[str]] = {}
+        current_child: str | None = None
+        for line in real_data.splitlines():
+            if child_match := self._CHILD_RE.search(line):
+                current_child = child_match.group(1)
+                children[current_child] = []
+            elif (path_match := self._PATH_RE.search(line)) and current_child is not None:
+                children[current_child].append(path_match.group(1))
+
+        children_conditions = [
+            ChildEvaluation(
+                child_id=child_id,
+                child_action=f"action of {child_id}",
+                condition_to_child=f"condition to {child_id}",
+                condition_to_child_and_stop=f"reached {child_id} and stopped",
+                conditions_to_child_and_forward=[
+                    PathCondition(
+                        id=path_id,
+                        path_condition=f"path {path_id} from {child_id}",
+                        condition_to_child_then_to_path=f"through {child_id} via {path_id}",
+                    )
+                    for path_id in path_ids
+                ]
+                or None,
+            )
+            for child_id, path_ids in children.items()
+        ]
+
+        return SchematicGenerationResult(
+            content=ReachableNodesEvaluationSchema(
+                step_action="step action",
+                step_action_completed="step ac
```

---

### Incident Patch 3: `fa875a25` (2026-06-02)
**Commit Message**: fix: make journey reachable-follow-ups order-independent at fan-in nodes

Signed-off-by: Alex Santangelo <a.santangeloibanez@gmail.com>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ All notable changes to Parlant will be documented here.
 
 - Fix low-criticality matcher logging the entire inference blob once per guideline in a batch (N copies of the same payload at debug level); now logs a single per-item entry
 - Fix WebSocketLogger event loop starvation — when no WebSocket clients are subscribed, the drain loop processed queued messages without yielding, progressively blocking the async event loop and causing increasing latency over time
+- Fix journey reachable-follow-ups evaluation being order-dependent at fan-in nodes — `JourneyReachableNodesEvaluator` captured a child's path list by reference and then prepended to it in place, so a node with multiple parents had its stored routes mutated by whichever parent was visited first; the second parent then lost routes (or double-counted a hop) depending purely on graph/DFS order. The child's routes are now snapshotted per parent, making the result depend only on journey structure. This intentionally changes the computed follow-ups for existing fan-in journeys: a shared child's later parent now retains the routes it previously lost
 
 ### Security
 
```

**File**: `src/parlant/core/services/indexing/journey_reachable_nodes_evaluation.py` (modified, +2/-1)
```diff
@@ -373,7 +373,8 @@ async def evaluate_reachable_follow_ups(
                         ):
                             truncated_follow_ups[str(id)] = _ReachableFollowUps(
                                 condition=r.condition,
-                                path=r.path,
+                                # copy so a parent's prepend can't mutate the child's shared list
+                                path=list(r.path),
                             )
                             id += 1
                 children_info[child_idx] = _ChildInfo(
```

**File**: `tests/core/stable/services/indexing/test_journey_reachable_nodes_evaluator.py` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+# Copyright 2026 Emcie Co Ltd.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+import re
+from datetime import datetime, timezone
+from typing import Any, Mapping, Sequence
+from lagom import Container
+from typing_extensions import override
+
+from parlant.core.common import Criticality
+from parlant.core.engines.alpha.optimization_policy import OptimizationPolicy
+from parlant.core.engines.alpha.prompt_builder import PromptBuilder
+from parlant.core.guidelines import Guideline, GuidelineContent, GuidelineId
+from parlant.core.loggers import Logger
+from parlant.core.nlp.generation import SchematicGenerator, SchematicGenerationResult
+from parlant.core.nlp.generation_info import GenerationInfo, UsageInfo
+from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.services.indexing.journey_reachable_nodes_evaluation import (
+    ChildEvaluation,
+    JourneyReachableNodesEvaluator,
+    PathCondition,
+    ReachableNodesEvaluation,
+    ReachableNodesEvaluationSchema,
+)
+from parlant.core.services.tools.service_registry import ServiceRegistry
+
+
+class _ForwardAllReachableNodesGenerator(SchematicGenerator[ReachableNodesEvaluationSchema]):
+    # A deterministic stand-in for the LLM: it reads which children and onward-path ids
+    # the prompt exposes for the current node and forwards all of them, mimicking an
+    # ideal compliant model. This lets us exercise the graph-walk/path logic without
+    # real generation. Only `generate` is used.
+
+    _CHILD_RE = re.compile(r"Child id:\s*(\S+)")
+    _PATH_RE = re.compile(r"-\s*Condition\s*\((\d+)\)\s*:")
+
+    @override
+    async def generate(
+        self,
+        prompt: str | PromptBuilder,
+        hints: Mapping[str, Any] = {},
+    ) -> SchematicGenerationResult[ReachableNodesEvaluationSchema]:
+        text = prompt.build() if isinstance(prompt, PromptBuilder) else prompt
+        # Drop the few-shot examples, which render the same child/condition lines.
+        real_data = text.split("Example section is over")[-1]
+
+        children: dict[str, list[str]] = {}
+        current_child: str | None = None
+        for line in real_data.splitlines():
+            if child_match := self._CHILD_RE.search(line):
+                current_child = child_match.group(1)
+                children[current_child] = []
+            elif (path_match := self._PATH_RE.search(line)) and current_child is not None:
+                children[current_child].append(path_match.group(1))
+
+        children_conditions = [
+            ChildEvaluation(
+                child_id=child_id,
+                child_action=f"action of {child_id}",
+                condition_to_child=f"condition to {child_id}",
+                condition_to_child_and_stop=f"reached {child_id} and stopped",
+                conditions_to_child_and_forward=[
+                    PathCondition(
+                        id=path_id,
+                        path_condition=f"path {path_id} from {child_id}",
+                        condition_to_child_then_to_path=f"through {child_id} via {path_id}",
+                    )
+                    for path_id in path_ids
+                ]
+                or None,
+            )
+            for child_id, path_ids in children.items()
+        ]
+
+        return SchematicGenerationResult(
+            content=ReachableNodesEvaluationSchema(
+                step_action="step action",
+                step_action_completed="step ac
```

---

### Incident Patch 4: `152f0582` (2026-05-19)
**Commit Message**: fix: bump dependency version pins for security vulnerabilities

- litellm >= 1.83.0 → >= 1.83.10 (CVE-2026-42203, CVE-2026-42271, CVE-2026-42208, CVE-2026-40217)
- Mako >= 1.3.11 → >= 1.3.12 (CVE-2026-44307)
- python-multipart >= 0.0.26 → >= 0.0.27 (CVE-2026-42561)
- urllib3 >= 2.6.3 → >= 2.7.0 (CVE-2026-44431, CVE-2026-44432)

Signed-off-by: Dor Zohar <dor@emcie.co>

**File**: `pyproject.toml` (modified, +4/-4)
```diff
@@ -96,7 +96,7 @@ vertex = [
 
 ollama = ["ollama>=0.5.0"]
 
-litellm = ["litellm>=1.83.0", "torch>=2.8.0", "transformers>=4.53.0"]
+litellm = ["litellm>=1.83.10", "torch>=2.8.0", "transformers>=4.53.0"]
 
 azure = ["azure-identity>=1.20.0"]
 
@@ -141,15 +141,15 @@ constraint-dependencies = [
     "diskcache>=5.6.4",
     "filelock>=3.20.3",
     "fonttools>=4.60.2",
-    "Mako>=1.3.11",
+    "Mako>=1.3.12",
     "orjson>=3.11.6",
     "pillow>=12.2.0",
     "protobuf>=6.33.5",
     "pyasn1>=0.6.3",
     "Pygments>=2.20.0",
     "pyopenssl>=26.0.0",
-    "python-multipart>=0.0.26",
-    "urllib3>=2.6.3",
+    "python-multipart>=0.0.27",
+    "urllib3>=2.7.0",
     "werkzeug>=3.1.6",
 ]
 
```

**File**: `uv.lock` (modified, +16/-16)
```diff
@@ -25,15 +25,15 @@ constraints = [
     { name = "diskcache", specifier = ">=5.6.4" },
     { name = "filelock", specifier = ">=3.20.3" },
     { name = "fonttools", specifier = ">=4.60.2" },
-    { name = "mako", specifier = ">=1.3.11" },
+    { name = "mako", specifier = ">=1.3.12" },
     { name = "orjson", specifier = ">=3.11.6" },
     { name = "pillow", specifier = ">=12.2.0" },
     { name = "protobuf", specifier = ">=6.33.5" },
     { name = "pyasn1", specifier = ">=0.6.3" },
     { name = "pygments", specifier = ">=2.20.0" },
     { name = "pyopenssl", specifier = ">=26.0.0" },
-    { name = "python-multipart", specifier = ">=0.0.26" },
-    { name = "urllib3", specifier = ">=2.6.3" },
+    { name = "python-multipart", specifier = ">=0.0.27" },
+    { name = "urllib3", specifier = ">=2.7.0" },
     { name = "werkzeug", specifier = ">=3.1.6" },
 ]
 overrides = [
@@ -2908,7 +2908,7 @@ wheels = [
 
 [[package]]
 name = "litellm"
-version = "1.83.0"
+version = "1.85.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "aiohttp" },
@@ -2924,21 +2924,21 @@ dependencies = [
     { name = "tiktoken" },
     { name = "tokenizers" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/22/92/6ce9737554994ca8e536e5f4f6a87cc7c4774b656c9eb9add071caf7d54b/litellm-1.83.0.tar.gz", hash = "sha256:860bebc76c4bb27b4cf90b4a77acd66dba25aced37e3db98750de8a1766bfb7a", size = 17333062, upload-time = "2026-03-31T05:08:25.331Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/3b/d5/3c9b560db2ffa9e498655d0dfd74f408bc5b32ede858b5731c2a5fa4c752/litellm-1.85.0.tar.gz", hash = "sha256:babdd569809af913d08a08a7eb55df1ed3e6a3960ee365c6cef4ad031c9bc72a", size = 15344387, upload-time = "2026-05-17T01:59:15.97Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/19/2c/a670cc050fcd6f45c6199eb99e259c73aea92edba8d5c2fc1b3686d36217/litellm-1.83.0-py3-none-any.whl", hash = "sha256:88c536d339248f3987571493015784671ba3f193a328e1ea6780dbebaa2094a8", size = 15610306, upload-time = "2026-03-31T05:08:21.987Z" },
+    { url = "https://files.pythonhosted.org/packages/1c/38/e6a4abb062e039d18d59538cc4e6fc370c2c10cd2bff4a2e546acb69dcb9/litellm-1.85.0-py3-none-any.whl", hash = "sha256:2bb449153610691faffd76f5b94a8c29e4b66fc5394156ebf54fd4fe92759b1a", size = 16978229, upload-time = "2026-05-17T01:59:11.902Z" },
 ]
 
 [[package]]
 name = "mako"
-version = "1.3.11"
+version = "1.3.12"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "markupsafe" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/59/8a/805404d0c0b9f3d7a326475ca008db57aea9c5c9f2e1e39ed0faa335571c/mako-1.3.11.tar.gz", hash = "sha256:071eb4ab4c5010443152255d77db7faa6ce5916f35226eb02dc34479b6858069", size = 399811, upload-time = "2026-04-14T20:19:51.493Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/00/62/791b31e69ae182791ec67f04850f2f062716bbd205483d63a215f3e062d3/mako-1.3.12.tar.gz", hash = "sha256:9f778e93289bd410bb35daadeb4fc66d95a746f0b75777b942088b7fd7af550a", size = 400219, upload-time = "2026-04-28T19:01:08.512Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/68/a5/19d7aaa7e433713ffe881df33705925a196afb9532efc8475d26593921a6/mako-1.3.11-py3-none-any.whl", hash = "sha256:e372c6e333cf004aa736a15f425087ec977e1fcbd2966aae7f17c8dc1da27a77", size = 78503, upload-time = "2026-04-14T20:19:53.233Z" },
+    { url = "https://files.pythonhosted.org/packages/bc/b1/a0ec7a5a9db730a08daef1fdfb8090435b82465abbf758a596f0ea88727e/mako-1.3.12-py3-none-any.whl", hash = "sha256:8f61569480282dbf557145ce441e4ba888be453c30989f879f0d652e39f53ea9", size = 78521, upload-time = "2026-04-28T19:01:10.393Z" },
 ]
 
 [[package]]
@@ -4615,7 +4615,7 @@ requires-dist = [
     { name = "jsonschema", specifier = ">=4.23.0" },
     { name = "lagom", specifier = ">=2.6.0" },
     { name = "limits", specifier = ">=5.5.0" },
-    { name = "litellm", marker = "extra == 'litellm'", specifier = ">=
```

---

### Incident Patch 5: `16c3e6c0` (2026-05-04)
**Commit Message**: Add application instance ID and fix some boot bugs

**File**: `src/parlant/adapters/nlp/emcie_service.py` (modified, +12/-0)
```diff
@@ -31,6 +31,8 @@
 from parlant.core.engines.alpha.prompt_builder import PromptBuilder
 from parlant.core.loggers import Logger
 from parlant.core.meter import Meter
+from parlant.core.services.indexing.common import ProgressReport
+from parlant.core.services.indexing.indexer import IndexRequest, Indexer
 from parlant.core.nlp.policies import policy, retry
 from parlant.core.nlp.tokenization import EstimatingTokenizer
 from parlant.core.nlp.service import (
@@ -661,6 +663,16 @@ def dimensions(self) -> int:
         return 1536
 
 
+class EmcieIndexer(Indexer):
+    @override
+    async def index(
+        self,
+        payload: Mapping[str, Mapping[str, IndexRequest]],
+        progress_report: ProgressReport,
+    ) -> None:
+        return
+
+
 class EmcieService(NLPService):
     @staticmethod
     def verify_environment() -> str | None:
```

**File**: `src/parlant/adapters/nlp/parlant_cloud_service.py` (modified, +11/-36)
```diff
@@ -28,13 +28,7 @@
 import tiktoken
 
 from parlant.adapters.nlp.common import normalize_json_output, record_llm_metrics
-from parlant.core.agents import AgentStore
-from parlant.core.canned_responses import CannedResponseStore
-from parlant.core.context_variables import ContextVariableStore
 from parlant.core.engines.alpha.prompt_builder import PromptBuilder
-from parlant.core.glossary import GlossaryStore
-from parlant.core.guidelines import GuidelineStore
-from parlant.core.journeys import JourneyStore
 from parlant.core.loggers import Logger
 from parlant.core.meter import Meter
 from parlant.core.nlp.policies import policy, retry
@@ -59,10 +53,8 @@
     ModerationService,
     NoModeration,
 )
-from parlant.core.relationships import RelationshipStore
 from parlant.core.services.indexing.common import ProgressReport
 from parlant.core.services.indexing.indexer import IndexRequest, Indexer
-from parlant.core.services.tools.service_registry import ServiceRegistry
 from parlant.core.tracer import Tracer
 from parlant.core.version import VERSION
 from parlant.core.health import HealthReporter
@@ -715,7 +707,17 @@ def dimensions(self) -> int:
         return 1536
 
 
-class ParlantCloudService(NLPService, Indexer):
+class ParlantCloudIndexer(Indexer):
+    @override
+    async def index(
+        self,
+        payload: Mapping[str, Mapping[str, IndexRequest]],
+        progress_report: ProgressReport,
+    ) -> None:
+        return
+
+
+class ParlantCloudService(NLPService):
     @staticmethod
     def verify_environment() -> str | None:
         """Returns an error message if the environment is not set up correctly."""
@@ -737,28 +739,9 @@ def __init__(
         tracer: Tracer,
         meter: Meter,
         health_reporter: HealthReporter,
-        agent_store: AgentStore,
-        guideline_store: GuidelineStore,
-        journey_store: JourneyStore,
-        relationship_store: RelationshipStore,
-        glossary_store: GlossaryStore,
-        context_variable_store: ContextVariableStore,
-        canned_response_store: CannedResponseStore,
-        service_registry: ServiceRegistry,
         model_tier: GenerationModelTier | None = None,
         model_role: ModelRole | None = None,
     ) -> None:
-        super().__init__(
-            agent_store=agent_store,
-            guideline_store=guideline_store,
-            journey_store=journey_store,
-            relationship_store=relationship_store,
-            glossary_store=glossary_store,
-            context_variable_store=context_variable_store,
-            canned_response_store=canned_response_store,
-            service_registry=service_registry,
-        )
-
         self._logger = logger
         self._tracer = tracer
         self._meter = meter
@@ -774,14 +757,6 @@ def __init__(
 
         self._logger.info("Initialized ParlantCloudService")
 
-    @override
-    async def index(
-        self,
-        payload: Mapping[str, Mapping[str, IndexRequest]],
-        progress_report: ProgressReport,
-    ) -> None:
-        return
-
     @property
     @override
     def supports_streaming(self) -> bool:
```

**File**: `src/parlant/bin/server.py` (modified, +7/-5)
```diff
@@ -18,7 +18,6 @@
 from contextlib import asynccontextmanager, AsyncExitStack
 from contextvars import ContextVar
 from dataclasses import dataclass, field
-from datetime import timedelta
 import importlib
 import inspect
 import os
@@ -55,7 +54,8 @@
 )
 
 from parlant.core.capabilities import CapabilityStore, CapabilityVectorStore
-from parlant.core.common import IdGenerator
+from parlant.core.application_context import ApplicationContext
+from parlant.core.common import IdGenerator, generate_id
 from parlant.core.engines.alpha import message_generator
 from parlant.core.engines.alpha.guideline_matching.generic import (
     guideline_actionable_batch,
@@ -678,9 +678,11 @@ async def setup_container() -> AsyncIterator[Container]:
 
     _define_singleton(c, Engine, AlphaEngine)
 
-    c[EventLoopMonitor] = EventLoopMonitor()
-
-    c[HealthReporter] = HealthReporter()
+    _define_singleton_value(
+        c, ApplicationContext, ApplicationContext(instance_id=generate_id())
+    )
+    _define_singleton(c, EventLoopMonitor, EventLoopMonitor)
+    _define_singleton(c, HealthReporter, HealthReporter)
 
     _define_singleton(c, Application, Application)
 
```

**File**: `src/parlant/core/application_context.py` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Copyright 2026 Emcie Co Ltd.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+from dataclasses import dataclass
+
+
+@dataclass(frozen=True)
+class ApplicationContext:
+    instance_id: str
```

**File**: `src/parlant/core/health/__init__.py` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@
     SchemaThresholds,
 )
 from parlant.core.health.reporter import (
-    Criticality,
+    StatusCriticality,
     HealthReport,
     HealthReporter,
     HealthView,
@@ -40,7 +40,7 @@
 )
 
 __all__ = [
-    "Criticality",
+    "StatusCriticality",
     "ENGINE_TTFM_KIND",
     "ENGINE_TURN_KIND",
     "ENGINE_TURNS_COUNTER",
```

---

### Incident Patch 6: `88c8ea9c` (2026-04-29)
**Commit Message**: Health report architectural fixes

**File**: `docs/superpowers/plans/2026-04-27-agent-scoped-context-variable-values.md` (removed, +0/-362)
```diff
@@ -1,362 +0,0 @@
-# Agent-scoped Context Variable Values Implementation Plan
-
-> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
-
-**Goal:** Add an "agent (by id)" tier to the context-variable value-resolution chain so the same variable can carry per-agent defaults, with SDK methods on `Variable` to set/get them.
-
-**Architecture:** No store schema change. Agent-tier values are stored in the existing `_value_collection` keyed by `Tag.for_agent_id(agent.id).id` (i.e., the literal string `"agent:{agent_id}"`, distinct from the `"tag:{...}"` keys used for customer-tag values). The engine inserts a single new key into its precedence list between the customer-tag tier and the global tier; `_load_context_variable_value` and the tool-based fallback are unaffected. The SDK exposes two new methods on the `Variable` dataclass that mirror the existing `set_value_for_customer` / `set_value_for_tag` / `set_global_value` pattern.
-
-**Tech Stack:** Python 3, MyPy strict, pytest, ruff, the project's existing `SDKTest` harness.
-
-**Spec:** `docs/superpowers/specs/2026-04-27-agent-scoped-context-variable-values-design.md`
-
----
-
-## File Map
-
-| File | Action | Responsibility |
-|---|---|---|
-| `src/parlant/sdk.py` | Modify (around 2942–2996) | Add `Variable.set_value_for_agent` and `Variable.get_value_for_agent`. |
-| `src/parlant/core/engines/alpha/engine.py` | Modify (1101–1105 + imports) | Insert agent-tier key into precedence list; add `Tag` import. |
-| `tests/sdk/test_variables.py` | Modify (append) | Three new `SDKTest` classes covering SDK round-trip, engine resolution of agent tier, and customer-tag-vs-agent precedence regression guard. |
-
-No new files. No store, schema, migration, or API-layer changes.
-
----
-
-## Task 1: SDK methods on `Variable` for agent-scoped values
-
-**Files:**
-- Modify: `src/parlant/sdk.py:2942-2996` (add two methods to the `Variable` dataclass)
-- Test: `tests/sdk/test_variables.py` (append a new class)
-
-**Why test first:** Per project TDD policy (`CLAUDE.md`), we add a failing test that exercises the new SDK surface before implementing it. This test is a pure round-trip through the store via the new SDK methods — it does not need the engine change yet.
-
-- [ ] **Step 1: Append the failing test to `tests/sdk/test_variables.py`**
-
-Append at the end of the file:
-
-```python
-class Test_that_a_variable_value_can_be_set_for_an_agent(SDKTest):
-    async def setup(self, server: p.Server) -> None:
-        self.agent = await server.create_agent(
-            name="Var Agent",
-            description="Agent for variable per-agent value test",
-        )
-
-        self.variable = await self.agent.create_variable(
-            name="subscription_plan",
-            description="The current subscription plan of the user.",
-        )
-
-        await self.variable.set_value_for_agent(self.agent, "premium")
-
-    async def run(self, ctx: Context) -> None:
-        assert "premium" == await self.variable.get_value_for_agent(self.agent)
-```
-
-- [ ] **Step 2: Run the test and confirm it fails**
-
-Run: `uv run pytest tests/sdk/test_variables.py::Test_that_a_variable_value_can_be_set_for_an_agent -v`
-
-Expected: FAIL — `AttributeError: 'Variable' object has no attribute 'set_value_for_agent'` (raised inside `setup`).
-
-- [ ] **Step 3: Add the two methods to `Variable` in `src/parlant/sdk.py`**
-
-Locate the `Variable` dataclass (around line 2926). It already imports `Tag as _Tag` at line 272 and uses `_Tag.for_agent_id(...)` elsewhere in the file (e.g., line 3265), so no new imports are needed.
-
-Insert these two methods immediately **after** `set_global_value` and **before** `get_value_for_customer` (i.e., between current lines 2967 and 2969 — the natural symmetric position alongside the existing `set_*` / `get_*` siblings):
```

**File**: `docs/superpowers/specs/2026-04-27-agent-scoped-context-variable-values-design.md` (removed, +0/-130)
```diff
@@ -1,130 +0,0 @@
-# Agent-scoped context variable values
-
-## Problem
-
-The engine currently resolves a context variable's value for a given turn by trying keys in this order, stopping at the first match:
-
-1. `customer.id` — customer-specific value
-2. `f"tag:{tag_id}"` for each customer tag — customer-tag value
-3. `ContextVariableStore.GLOBAL_KEY` (`"DEFAULT"`) — global value
-4. (Variable's tool, if defined) — tool-based fallback inside `_load_context_variable_value`
-
-Reference: `src/parlant/core/engines/alpha/engine.py:1101-1105`.
-
-There is no tier for "value owned by *this agent*, applied to every customer this agent talks to, regardless of customer tags". Agents that share a single context variable definition currently can't carry different defaults without either tagging every customer or defining separate variables per agent.
-
-## Goal
-
-Insert an **agent tier** between the customer-tag tier and the global tier. New precedence:
-
-1. Customer-specific
-2. Customer-tag
-3. **Agent (by id)** — new
-4. Global
-5. Tool-based
-
-Expose this tier in the SDK via `Variable.set_value_for_agent(agent, value)` and `Variable.get_value_for_agent(agent)`.
-
-## Non-goals
-
-- No agent-tag tier (e.g., "all agents tagged X share this default"). YAGNI; can be added later if needed.
-- No new method on `Agent` (e.g., `agent.set_variable_value(variable, value)`). Surface stays on `Variable`, mirroring the existing `set_value_for_customer` / `set_value_for_tag` / `set_global_value` pattern.
-- No store schema change, no migration. The values store remains key-agnostic.
-
-## Design
-
-### Key encoding
-
-Reuse the existing `Tag.for_agent_id(agent_id)` helper from `src/parlant/core/tags.py` (line 53–59). Its `.id` produces the canonical string `f"agent:{agent_id}"`. Use that string directly as the value-store key for the agent tier.
-
-This is distinct from the customer-tag tier: customer tags are wrapped as `f"tag:{tag_id}"` before being used as keys (`engine.py:1103`), so a customer carrying a tag named `agent:X` would produce key `"tag:agent:X"` — different from the agent-tier key `"agent:X"`. No collision, no aliasing across tiers.
-
-The `agent:{id}` namespace is already used across the codebase as a *resource ownership* tag (e.g., a context variable is tagged `agent:{id}` to scope it to that agent — see `entity_cq.py:124,214,262`). Using the same string as a *value key* in the values store is a parallel use of the same namespace; the values store itself is unaffected because it is key-agnostic.
-
-### Store changes
-
-None. `ContextVariableStore.update_value` / `read_value` / `delete_value` / `list_values` already accept arbitrary string keys. No new helper, no new method, no schema or migration change.
-
-### Engine changes
-
-**File:** `src/parlant/core/engines/alpha/engine.py`
-
-Modify `_load_context_variables` (around line 1089) so the precedence list includes the agent tier:
-
-```python
-keys_to_check_in_order_of_importance = (
-    [context.customer.id]
-    + [f"tag:{tag_id}" for tag_id in context.customer.tags]
-    + [Tag.for_agent_id(context.agent.id).id]   # NEW: agent-specific value
-    + [ContextVariableStore.GLOBAL_KEY]
-)
-```
-
-Add `from parlant.core.tags import Tag` to the imports — `engine.py` does not currently import `Tag`.
-
-`_load_context_variable_value` and `load_fresh_context_variable_value` (around line 2023 and 2200) require no changes — they already accept any key and run the variable's tool (if any) against it for the tool-based fallback.
-
-### SDK changes
-
-**File:** `src/parlant/sdk.py`
-
-Add two methods to the `Variable` dataclass alongside the existing setters/getters (around line 2942–2996):
-
-```python
-async def set_value_for_agent(self, agent: Agent, value: JSONSerializable) -> None:
-    """Sets the value of the variable for a specific agent."""
-    await self._container[ContextVariableStore].update_value(
-        variable_id=self.id,
-        key=_Tag.for_agent_id(agent.id).
```

**File**: `src/parlant/adapters/nlp/anthropic_service.py` (modified, +16/-14)
```diff
@@ -58,6 +58,7 @@
 )
 from parlant.core.nlp.generation import StreamingTextGenerator
 from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.health import HealthReporter
 
 
 class AnthropicEstimatingTokenizer(EstimatingTokenizer):
@@ -78,14 +79,13 @@ async def estimate_token_count(self, prompt: str) -> int:
 class AnthropicAISchematicGenerator(BaseSchematicGenerator[T]):
     supported_hints = ["temperature"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
         self._estimating_tokenizer = AnthropicEstimatingTokenizer(self._client, model_name)
@@ -203,12 +203,12 @@ async def _do_generate(
 
 
 class Claude_Sonnet_3_5(AnthropicAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="claude-3-5-sonnet-20241022",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @property
@@ -218,12 +218,12 @@ def max_tokens(self) -> int:
 
 
 class Claude_Sonnet_4(AnthropicAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="claude-sonnet-4-20250514",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @property
@@ -233,12 +233,12 @@ def max_tokens(self) -> int:
 
 
 class Claude_Opus_4_1(AnthropicAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="claude-opus-4-1-20250805",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @property
@@ -260,11 +260,13 @@ def verify_environment() -> str | None:
 
         return None
 
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         self.logger = logger
         self._tracer = tracer
         self._meter = meter
 
+        self._health_reporter = health_reporter
+
         self.logger.info("Initialized AnthropicService")
 
     @property
@@ -287,12 +289,12 @@ async def get_schematic_generator(
             or t == DisambiguationGuidelineMatchesSchema
             or t == CannedResponseSelectionSchema
         ):
-            return Claude_Opus_4_1[t](self.logger, self._tracer, self._meter)  # type: ignore
-        return Claude_Sonnet_4[t](self.logger, self._tracer, self._meter)  # type: ignore
+            return Claude_Opus_4_1[t](self.logger, self._tracer, self._meter, self._health_reporter)  # type: ignore
+        return Claude_Sonnet_4[t](self.logger, self._tracer, self._meter, self._health_reporter)  # type: ignore
 
     @override
     async def get_embedder(self, hints: EmbedderHints = {}) -> Embedder:
-        return JinaAIEmbedder(self.logger, self._tracer, self._meter)
+        return JinaAIEm
```

**File**: `src/parlant/adapters/nlp/aws_service.py` (modified, +11/-9)
```diff
@@ -51,6 +51,7 @@
     StreamingTextGeneratorHints,
 )
 from parlant.core.nlp.tokenization import EstimatingTokenizer
+from parlant.core.health import HealthReporter
 
 
 class AnthropicBedrockEstimatingTokenizer(EstimatingTokenizer):
@@ -66,14 +67,13 @@ async def estimate_token_count(self, prompt: str) -> int:
 class AnthropicBedrockAISchematicGenerator(BaseSchematicGenerator[T]):
     supported_hints = ["temperature"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = AsyncAnthropicBedrock(
             aws_access_key=os.environ["AWS_ACCESS_KEY_ID"],
@@ -192,12 +192,12 @@ async def _do_generate(
 
 
 class Claude_Sonnet_3_5(AnthropicBedrockAISchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         super().__init__(
             model_name="anthropic.claude-3-5-sonnet-20240620-v1:0",
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
         )
 
     @override
@@ -223,11 +223,13 @@ def verify_environment() -> str | None:
 """
         return None
 
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         self._logger = logger
         self._tracer = tracer
         self._meter = meter
 
+        self._health_reporter = health_reporter
+
     @property
     @override
     def supports_streaming(self) -> bool:
@@ -243,11 +245,11 @@ async def get_streaming_text_generator(
     async def get_schematic_generator(
         self, t: type[T], hints: SchematicGeneratorHints = {}
     ) -> AnthropicBedrockAISchematicGenerator[T]:
-        return Claude_Sonnet_3_5[t](self._logger, self._tracer, self._meter)  # type: ignore
+        return Claude_Sonnet_3_5[t](self._logger, self._tracer, self._meter, self._health_reporter)  # type: ignore
 
     @override
     async def get_embedder(self, hints: EmbedderHints = {}) -> Embedder:
-        return JinaAIEmbedder(self._logger, self._tracer, self._meter)
+        return JinaAIEmbedder(self._logger, self._tracer, self._meter, self._health_reporter)
 
     @override
     async def get_moderation_service(self) -> ModerationService:
```

**File**: `src/parlant/adapters/nlp/azure_service.py` (modified, +35/-37)
```diff
@@ -53,6 +53,7 @@
 )
 from parlant.core.nlp.generation_info import GenerationInfo, UsageInfo
 from parlant.core.nlp.moderation import ModerationService, NoModeration
+from parlant.core.health import HealthReporter
 
 
 class AzureEstimatingTokenizer(EstimatingTokenizer):
@@ -72,15 +73,14 @@ class AzureSchematicGenerator(BaseSchematicGenerator[T]):
         "gpt-5": ["temperature"],
     }
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
         client: AsyncAzureOpenAI,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = client
         self._tokenizer = AzureEstimatingTokenizer(model_name=self.model_name)
@@ -329,14 +329,14 @@ async def token_provider() -> str:
 
 
 class CustomAzureSchematicGenerator(AzureSchematicGenerator[T]):
-    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter) -> None:
+    def __init__(self, logger: Logger, tracer: Tracer, meter: Meter, health_reporter: HealthReporter) -> None:
         _client = create_azure_client()
 
         super().__init__(
             model_name=os.environ["AZURE_GENERATIVE_MODEL_NAME"],
             logger=logger,
             tracer=tracer,
-            meter=meter,
+            meter=meter, health_reporter=health_reporter,
             client=_client,
         )
 
@@ -346,15 +346,14 @@ def max_tokens(self) -> int:
 
 
 class GPT_4o(AzureSchematicGenerator[T]):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         _client = create_azure_client()
         super().__init__(
-            model_name="gpt-4o", logger=logger, tracer=tracer, meter=meter, client=_client
+            model_name="gpt-4o", logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, client=_client
         )
 
     @property
@@ -363,15 +362,14 @@ def max_tokens(self) -> int:
 
 
 class GPT_4o_Mini(AzureSchematicGenerator[T]):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         _client = create_azure_client()
         super().__init__(
-            model_name="gpt-4o-mini", logger=logger, tracer=tracer, meter=meter, client=_client
+            model_name="gpt-4o-mini", logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, client=_client
         )
         self._token_estimator = AzureEstimatingTokenizer(model_name=self.model_name)
 
@@ -383,15 +381,14 @@ def max_tokens(self) -> int:
 class AzureEmbedder(BaseEmbedder):
     supported_arguments = ["dimensions"]
 
-    def __init__(
-        self,
+    def __init__(self,
         model_name: str,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
         client: AsyncAzureOpenAI,
     ) -> None:
-        super().__init__(logger=logger, tracer=tracer, meter=meter, model_name=model_name)
+        super().__init__(logger=logger, tracer=tracer, meter=meter, health_reporter=health_reporter, model_name=model_name)
 
         self._client = client
         self._tokenizer = AzureEstimatingTokenizer(model_name=self.model_name)
@@ -439,18 +436,17 @@ async def do_embed(
 
 
 class CustomAzureEmbedder(AzureEmbedder):
-    def __init__(
-        self,
+    def __init__(self,
         logger: Logger,
         tracer: Tracer,
-        meter: Meter,
+        meter: Meter, health_reporter: HealthReporter,
     ) -> None:
         _client = create_azure_client()
  
```

---

### Incident Patch 7: `f664e960` (2026-04-27)
**Commit Message**: Fix redundant batch creation in ToolCaller across guideline matches

Signed-off-by: Dor Zohar <dor@emcie.co>

**File**: `src/parlant/core/engines/alpha/tool_calling/tool_caller.py` (modified, +7/-7)
```diff
@@ -215,15 +215,15 @@ async def _do_infer_tool_calls(
 
                 tools[(tool_id, tool)].append(guideline_match)
 
-            batches = await self.batcher.create_batches(
-                tools=tools,
-                context=context,
-            )
+        batches = await self.batcher.create_batches(
+            tools=tools,
+            context=context,
+        )
 
-            batch_tasks = [batch.process() for batch in batches]
-            batch_results = await async_utils.safe_gather(*batch_tasks)
+        batch_tasks = [batch.process() for batch in batches]
+        batch_results = await async_utils.safe_gather(*batch_tasks)
 
-            t_end = time.time()
+        t_end = time.time()
 
         # Aggregate insights from all batch results (e.g., missing data across batches)
         aggregated_evaluations: list[tuple[ToolId, ToolCallEvaluation]] = []
```

---

### Incident Patch 8: `e7313978` (2026-04-23)
**Commit Message**: fix: upgrade dependencies and remove overrides for security improvements

Signed-off-by: Menachem Brichta <menachem@emcie.co>

**File**: `src/parlant/api/chat/package-lock.json` (modified, +67/-0)
```diff
@@ -3741,6 +3741,18 @@
         "node": ">= 8"
       }
     },
+    "node_modules/anymatch/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/arg": {
       "version": "5.0.2",
       "resolved": "https://registry.npmjs.org/arg/-/arg-5.0.2.tgz",
@@ -4180,6 +4192,13 @@
         "node": ">= 6"
       }
     },
+    "node_modules/concat-map": {
+      "version": "0.0.1",
+      "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
+      "integrity": "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/convert-source-map": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
@@ -5821,6 +5840,19 @@
         "node": "^14.15.0 || ^16.10.0 || >=18.0.0"
       }
     },
+    "node_modules/jest-util/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "dev": true,
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/jiti": {
       "version": "1.21.7",
       "resolved": "https://registry.npmjs.org/jiti/-/jiti-1.21.7.tgz",
@@ -7007,6 +7039,18 @@
         "node": ">=8.6"
       }
     },
+    "node_modules/micromatch/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/mime-db": {
       "version": "1.52.0",
       "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
@@ -7053,6 +7097,17 @@
         "node": "*"
       }
     },
+    "node_modules/minimatch/node_modules/brace-expansion": {
+      "version": "1.1.14",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.14.tgz",
+      "integrity": "sha512-MWPGfDxnyzKU7rNOW9SP/c50vi3xrmrua/+6hfPbCS2ABNWfx24vPidzvC7krjU/RTo235sV776ymlsMtGKj8g==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "balanced-match": "^1.0.0",
+        "concat-map": "0.0.1"
+      }
+    },
     "node_modules/minipass": {
       "version": "7.1.2",
       "resolved": "https://registry.npmjs.org/minipass/-/minipass-7.1.2.tgz",
@@ -7808,6 +7863,18 @@
         "node": ">=8.10.0"
       }
     },
+    "node_modules/readdirp/node_modules/picomatch": {
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/jonschlinkert"
+      }
+    },
     "node_modules/redent": {
       "version": "3.0.0",
       "resolved": "https://registry.npmjs.org/redent/-/redent-3.0.0.tgz",
```

**File**: `src/parlant/api/chat/package.json` (modified, +0/-8)
```diff
@@ -71,13 +71,5 @@
     "typescript": "^5.5.3",
     "typescript-eslint": "^8.7.0",
     "vitest": "^4.0.6"
-  },
-  "overrides": {
-    "brace-expansion": "^2.0.3",
-    "flatted": "^3.4.2",
-    "immutable": "^5.1.5",
-    "lodash": "^4.18.0",
-    "picomatch": "^4.0.4",
-    "yaml": "^2.8.3"
   }
 }
```

---

### Incident Patch 9: `3783c554` (2026-03-14)
**Commit Message**: Fix mypy errors in MCP service, tests, and journey edge type annotations

Signed-off-by: Alex Santangelo <a.santangeloibanez@gmail.com>

**File**: `src/parlant/core/services/tools/mcp_service.py` (modified, +2/-2)
```diff
@@ -212,7 +212,7 @@ async def _close_client(
         traceback: Optional[TracebackType] = None,
     ) -> None:
         try:
-            await client.__aexit__(exc_type, exc_value, traceback)  # type: ignore[arg-type]
+            await client.__aexit__(exc_type, exc_value, traceback)  # type: ignore[no-untyped-call]
         except RuntimeError:
             pass
         except Exception as exc:
@@ -247,7 +247,7 @@ async def _connect(self, force: bool = False) -> Client[StreamableHttpTransport]
                 client = self._create_client()
 
                 try:
-                    await asyncio.wait_for(client.__aenter__(), timeout=10.0)  # type: ignore[arg-type]
+                    await asyncio.wait_for(client.__aenter__(), timeout=10.0)  # type: ignore[no-untyped-call]
                     self._client = client
                     return client
                 except asyncio.TimeoutError:
```

**File**: `tests/core/stable/services/tools/test_mcp_client.py` (modified, +6/-3)
```diff
@@ -28,15 +28,18 @@ async def test_that_mcp_client_reconnects_after_its_session_is_closed(
             assert "Ahoy Short Jon Nickel! I doubled your lucky number to 14 !" in result.data
 
             assert client._client is not None
-            await client._client.close()
+            await client._client.close()  # type: ignore[no-untyped-call]
 
             reconnected_result = await client.call_tool(
                 "greet_me_like_pirate",
                 ToolContext("", "", ""),
                 {"name": "Another Pirate", "lucky_number": 9},
             )
 
-            assert "Ahoy Another Pirate! I doubled your lucky number to 18 !" in reconnected_result.data
+            assert (
+                "Ahoy Another Pirate! I doubled your lucky number to 18 !"
+                in reconnected_result.data
+            )
 
 
 async def test_that_mcp_client_retries_initial_connection(
@@ -75,7 +78,7 @@ def fake_create_client() -> FakeClient:
         attempted_clients.append(fake_client)
         return fake_client
 
-    client._create_client = fake_create_client  # type: ignore[method-assign]
+    client._create_client = fake_create_client  # type: ignore[method-assign, assignment]
 
     async with client:
         assert len(attempted_clients) == 2
```

---

### Incident Patch 10: `363a8c29` (2026-04-26)
**Commit Message**: multiple small test fixes

Signed-off-by: Bar Karov <bar@emcie.co>

**File**: `tests/core/stable/services/indexing/test_continuous_guideline_proposer.py` (modified, +0/-4)
```diff
@@ -101,10 +101,6 @@ async def test_that_continuous_guidelines_mark_as_continuous(
             condition="The user indicates they have dietary restrictions while discussing meal options.",
             action="Ensure that all suggested meal options respect their dietary restrictions.",
         ),
-        GuidelineContent(
-            condition="The user wants to replace their current meal with a healthier option.",
-            action="Suggest healthier alternatives and then assist the user in replacing their meal choice until they are satisfied",
-        ),
     ]
 
     tasks = [continuous_proposer.propose_continuous(guideline=g) for g in guidelines]
```

**File**: `tests/core/stable/services/indexing/test_guideline_action_proposer.py` (modified, +1/-3)
```diff
@@ -67,9 +67,7 @@ async def test_that_no_action_is_proposed_when_guideline_already_contains_action
         tool_ids=[],
     )
 
-    assert result
-    assert result.content == guideline
-    assert result.rationale == "No action proposed"
+    assert result is None
 
 
 async def test_that_action_is_proposed_when_guideline_lacks_action_and_tools_are_supplied(
```

**File**: `tests/core/stable/services/indexing/test_relative_action_step_proposer.py` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ async def test_action_is_proposed_when_needed(
     to_propose_action = {
         "2": "Ask what they need the loan for",
         "5": "The loan application process looks good or the initial eligibility check looks good",
-        "8": "Submit the loan application for review",
+        "8": "Submit the loan application (along with the documents, potentially) for review",
     }
     await base_test_that_related_action_step_proposed(
         context,
```

#### Recent Merged Pull Requests:
- **PR #824** (closed): Add Compass telemetry to OSS package (@mc-dorzo)
- **PR #822** (2026-07-10): perf(core): optimize batch deserialization and parallelize entity loading (@chibexme)
- **PR #820** (2026-06-25): perf(db): optimize MongoDB startup document migration (@chibexme)
- **PR #817** (2026-06-22): fix(core): prevent version drift from silently dropping tag associati… (@chibexme)
- **PR #816** (closed): Preserve SDK startup errors (@mc-dorzo)
- **PR #815** (closed): Preserve SDK startup errors (@mc-dorzo)
- **PR #814** (2026-06-17): feat: expose Parlant version over tunnel RPC (@mc-dorzo)
- **PR #812** (2026-06-17): feat: stream session events through cloud tunnel (@mc-dorzo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
