# Forensic Learning Record (Deep Inspection): punitarani/fli

> **Canonical Artifact**: `07_PROJECT_LEARNING/punitarani-fli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/punitarani/fli](https://github.com/punitarani/fli))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:37:48.754Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `punitarani/fli`
- **Description**: Google Flights MCP, CLI and Python Library
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3199 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/python/advanced_date_search_validation.py`
```
#!/usr/bin/env python3
"""Advanced date search with comprehensive validation.

This example demonstrates date search functionality with extensive validation
for round trip searches, including duration constraints and date validation.
"""

from datetime import datetime, timedelta

from fli.models import (
    Airport,
    DateSearchFilters,
    FlightSegment,
    PassengerInfo,
    SeatType,
    TimeRestrictions,
    TripType,
)
from fli.search import SearchDates


def validate_dates(from_date: str, to_date: str, min_stay: int, max_stay: int) -> None:
    """Validate date ranges for round trip searches."""
    start = datetime.strptime(from_date, "%Y-%m-%d").date()
    end = datetime.strptime(to_date, "%Y-%m-%d").date()
    today = datetime.now().date()

    if start <= today:
        raise ValueError("Start date must be in the future")
    if end <= start:
        raise ValueError("End date must be after start date")
    if end - start > timedelta(days=180):
        raise ValueError("Date range cannot exceed 180 days")
    if min_stay < 1:
        raise ValueError("Minimum stay must be at least 1 day")
    if max_stay > 30:
        raise ValueError("Maximum stay cannot exceed 30 days")
    if min_stay > max_stay:
        raise ValueError("Minimum stay cannot be greater than maximum stay")

    print(f"✓ Date validation passed: {from_date} to {to_date}")
    print(f"✓ Stay duration: {min_stay}-{max_stay} days")


def main() -> None:
    """Demonstrate advanced date search with validation."""
    from_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    to_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
    min_stay = 2
    max_stay = 4

    try:
        validate_dates(from_date, to_date, min_stay, max_stay)
    except ValueError as exc:
        print(f"❌ Validation failed: {exc}")
        return

    stay_lengths = range(min_stay, max_stay + 1)
    search = SearchDates()
    weekend_trips: list[dict[str, str | int | float]] = []

    print("\n🔍 Searching for round trip dates...")
    for duration in stay_lengths:
        outbound_date = from_date
        return_date = (
            datetime.strptime(outbound_date, "%Y-%m-%d") + timedelta(days=duration)
        ).strftime("%Y-%m-%d")

        flight_segments = [
            FlightSegment(
                departure_airport=[[Airport.JFK, 0]],
                arrival_airport=[[Airport.LAX, 0]],
                travel_date=outbound_date,
                time_restrictions=TimeRestrictions(
                    earliest_departure=9,  # 9 AM
                    latest_departure=18,  # 6 PM
                ),
            ),
            FlightSegment(
                departure_airport=[[Airport.LAX, 0]],
                arrival_airport=[[Airport.JFK, 0]],
                travel_date=return_date,
            ),
        ]

        filters = DateSearchFilters(
            trip_type=TripType.ROUND_TRIP,
            passenger_info=PassengerInfo(adults=1),
            flight_segments=flight_segments,
            from_date=from_date,
            to_date=to_date,
            duration=duration,
            seat_type=SeatType.ECONOMY,
        )

        results = search.search(filters)
        if not results:
            continue

        for trip in results:
            outbound, inbound = trip.date
            if outbound.weekday() >= 5:  # Saturday = 5, Sunday = 6
                weekend_trips.append(
                    {
                        "outbound": outbound.strftime("%Y-%m-%d"),
                        "return": inbound.strftime("%Y-%m-%d"),
                        "stay_length": duration,
                        "price": trip.price,
                    }
                )

    if not weekend_trips:
        print("❌ No weekend trips found in the specified range")
        return

    weekend_trips.sort(key=lambda trip: trip["price"])

    print(f"\n✅ Found {len(weekend_trips)} weekend flight combinations:")
    for index, trip in enumerate(weekend_trips[:5], 1):  # Show top 5 options
        print(f"\n{index}. Weekend Trip:")
        print(f"   Outbound: {trip['outbound']}")
        print(f"   Return:   {trip['return']}")
        print(f"   Stay:     {trip['stay_length']} days")
        print(f"   Price:    ${trip['price']}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/python/advanced_filters_search.py`
```
#!/usr/bin/env python3
"""Advanced filtering: alliances, exclusions, layovers, and locale.

This example pulls together the filters that are easy to miss:

* restrict to an airline **alliance** while **excluding** a specific carrier,
* bound layover duration and total trip duration,
* return prices in a non-USD currency for a specific language/country.

Currency, language, and country are passed to ``search()`` (they map to
Google's ``curr`` / ``hl`` / ``gl`` URL params), not to the filter object.
"""

from datetime import datetime, timedelta

from fli.models import (
    Airline,
    Airport,
    Alliance,
    FlightSearchFilters,
    FlightSegment,
    LayoverRestrictions,
    MaxStops,
    PassengerInfo,
    SeatType,
    SortBy,
)
from fli.search import SearchFlights


def main():
    filters = FlightSearchFilters(
        passenger_info=PassengerInfo(adults=1),
        flight_segments=[
            FlightSegment(
                departure_airport=[[Airport.JFK, 0]],
                arrival_airport=[[Airport.NRT, 0]],
                travel_date=(datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d"),
            )
        ],
        seat_type=SeatType.BUSINESS,
        stops=MaxStops.ONE_STOP_OR_FEWER,
        alliances=[Alliance.ONEWORLD],  # only Oneworld carriers...
        airlines_exclude=[Airline.AA],  # ...but skip American
        layover_restrictions=LayoverRestrictions(min_duration=60, max_duration=240),
        max_duration=1200,  # 20 hours door-to-door, in minutes
        sort_by=SortBy.DURATION,
    )

    search = SearchFlights()
    flights = search.search(filters, currency="EUR", language="en-GB", country="GB")

    if not flights:
        print("No flights matched the filters.")
        return

    print(f"Found {len(flights)} flights (prices in EUR):\n")
    for flight in flights[:10]:
        carriers = " / ".join(sorted({leg.airline.value for leg in flight.legs}))
        print(
            f"  €{flight.price:<7.0f} {flight.duration:>4} min  "
            f"{flight.stops} stop(s)  via {carriers}"
        )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/python/basic_one_way_search.py`
```
#!/usr/bin/env python3
"""Basic one-way flight search example.

This example demonstrates how to search for one-way flights between two airports
on a specific date using the most basic configuration.
"""

from datetime import datetime, timedelta

from fli.models import (
    Airport,
    FlightSearchFilters,
    FlightSegment,
    MaxStops,
    PassengerInfo,
    SeatType,
    SortBy,
)
from fli.search import SearchFlights


def main():
    # Create search filters
    filters = FlightSearchFilters(
        passenger_info=PassengerInfo(adults=1),
        flight_segments=[
            FlightSegment(
                departure_airport=[[Airport.JFK, 0]],
                arrival_airport=[[Airport.LAX, 0]],
                travel_date=(datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            )
        ],
        seat_type=SeatType.ECONOMY,
        stops=MaxStops.NON_STOP,
        sort_by=SortBy.CHEAPEST,
    )

    # Search flights
    search = SearchFlights()
    flights = search.search(filters)

    # Process results
    for flight in flights:
        print(f"💰 Price: ${flight.price}")
        print(f"⏱️ Duration: {flight.duration} minutes")
        print(f"✈️ Stops: {flight.stops}")

        for leg in flight.legs:
            print(f"\n🛫 Flight: {leg.airline.value} {leg.flight_number}")
            print(f"📍 From: {leg.departure_airport.value} at {leg.departure_datetime}")
            print(f"📍 To: {leg.arrival_airport.value} at {leg.arrival_datetime}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/python/complex_flight_search.py`
```
#!/usr/bin/env python3
"""Complex flight search with multiple filters.

This example demonstrates how to search for flights with detailed filters
including airlines, duration limits, and layover restrictions.
"""

from fli.models import (
    Airline,
    Airport,
    FlightSearchFilters,
    FlightSegment,
    LayoverRestrictions,
    MaxStops,
    PassengerInfo,
    SeatType,
    TripType,
)
from fli.search import SearchFlights


def main():
    from datetime import datetime, timedelta

    # Create detailed filters
    filters = FlightSearchFilters(
        trip_type=TripType.ONE_WAY,
        passenger_info=PassengerInfo(adults=2, children=1, infants_on_lap=1),
        flight_segments=[
            FlightSegment(
                departure_airport=[[Airport.JFK, 0]],
                arrival_airport=[[Airport.LHR, 0]],
                travel_date=(datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            )
        ],
        seat_type=SeatType.BUSINESS,
        stops=MaxStops.ONE_STOP_OR_FEWER,
        airlines=[Airline.BA, Airline.VS],  # British Airways and Virgin Atlantic
        max_duration=720,  # 12 hours in minutes
        layover_restrictions=LayoverRestrictions(
            airports=[Airport.BOS, Airport.ORD],  # Prefer these layover airports
            max_duration=180,  # Maximum 3-hour layover
        ),
    )

    search = SearchFlights()
    results = search.search(filters)

    print(f"Found {len(results)} flights:")
    for i, flight in enumerate(results, 1):
        print(f"\n--- Flight {i} ---")
        print(f"Price: ${flight.price}")
        print(f"Duration: {flight.duration} minutes")
        print(f"Stops: {flight.stops}")

        for j, leg in enumerate(flight.legs, 1):
            print(f"\nLeg {j}: {leg.airline.value} {leg.flight_number}")
            print(f"  From: {leg.departure_airport.value} at {leg.departure_datetime}")
            print(f"  To: {leg.arrival_airport.value} at {leg.arrival_datetime}")
            print(f"  Duration: {leg.duration} minutes")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/python/complex_round_trip_validation.py`
```
#!/usr/bin/env python3
"""Complex round trip search with extensive validation.

This example demonstrates advanced round trip flight searching with
comprehensive validation, multiple passengers, and complex requirements.
"""

from datetime import datetime, timedelta

from fli.models import (
    Airline,
    Airport,
    FlightSearchFilters,
    FlightSegment,
    LayoverRestrictions,
    MaxStops,
    PassengerInfo,
    SeatType,
    TimeRestrictions,
    TripType,
)
from fli.search import SearchFlights


def validate_trip_dates(outbound_date_str: str, return_date_str: str):
    """Validate trip dates with comprehensive checks."""
    today = datetime.now().date()
    outbound_date = datetime.strptime(outbound_date_str, "%Y-%m-%d").date()
    return_date = datetime.strptime(return_date_str, "%Y-%m-%d").date()

    if outbound_date <= today:
        raise ValueError("Outbound date must be in the future")
    if return_date <= outbound_date:
        raise ValueError("Return date must be after outbound date")
    if return_date - outbound_date > timedelta(days=30):
        raise ValueError("Trip duration cannot exceed 30 days")

    print(f"✓ Dates validated: {outbound_date} to {return_date}")
    return outbound_date, return_date


def main():
    """Demonstrate complex round trip search with validation."""
    # Create flight segments with time restrictions
    outbound_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    outbound = FlightSegment(
        departure_airport=[[Airport.JFK, 0]],
        arrival_airport=[[Airport.LHR, 0]],
        travel_date=outbound_date,
        time_restrictions=TimeRestrictions(
            earliest_departure=6,  # 6 AM
            latest_departure=12,  # 12 PM
            earliest_arrival=18,  # 6 PM
            latest_arrival=23,  # 11 PM
        ),
    )

    return_date = (datetime.now() + timedelta(days=37)).strftime("%Y-%m-%d")

    return_flight = FlightSegment(
        departure_airport=[[Airport.LHR, 0]],
        arrival_airport=[[Airport.JFK, 0]],
        travel_date=return_date,
        time_restrictions=TimeRestrictions(
            earliest_departure=14,  # 2 PM
            latest_departure=20,  # 8 PM
            earliest_arrival=17,  # 5 PM
            latest_arrival=23,  # 11 PM
        ),
    )

    # Validate dates
    try:
        validate_trip_dates(outbound.travel_date, return_flight.travel_date)
    except ValueError as e:
        print(f"❌ Validation error: {e}")
        return

    # Create filters with complex requirements
    filters = FlightSearchFilters(
        trip_type=TripType.ROUND_TRIP,
        passenger_info=PassengerInfo(adults=2, children=1, infants_on_lap=1),
        flight_segments=[outbound, return_flight],
        stops=MaxStops.ONE_STOP_OR_FEWER,
        seat_type=SeatType.BUSINESS,
        airlines=[Airline.BA, Airline.VS],  # British Airways and Virgin Atlantic
        max_duration=720,  # 12 hours max flight time
        layover_restrictions=LayoverRestrictions(
            airports=[Airport.DUB, Airport.AMS],  # Preferred layover airports
            max_duration=180,  # Maximum 3-hour layover
        ),
    )

    print("\n🔍 Searching for complex round trip flights...")
    search = SearchFlights()
    results = search.search(filters)

    if not results:
        print("❌ No flights found matching criteria")
        return

    # Process results with detailed information
    print(f"\n✅ Found {len(results)} flight combinations:")

    for i, (outbound, return_flight) in enumerate(results[:3], 1):  # Show first 3 results
        print(f"\n{'=' * 50}")
        print(f"Option {i}: Total Price: ${outbound.price}")

        print("\n🛫 Outbound Flight:")
        for leg in outbound.legs:
            print(f"  Flight: {leg.airline.value} {leg.flight_number}")
            print(f"  From: {leg.departure_airport.value} at {leg.departure_datetime}")
            print(f"  To: {leg.arrival_airport.value} at {leg.arrival_datetime}")
            print(f"  Duration: {leg.duration} minutes")
            if hasattr(leg, "layover_duration") and leg.layover_duration:
                print(f"  Layover: {leg.layover_duration} minutes")

        print("\n🛬 Return Flight:")
        for leg in return_flight.legs:
            print(f"  Flight: {leg.airline.value} {leg.flight_number}")
            print(f"  From: {leg.departure_airport.value} at {leg.departure_datetime}")
            print(f"  To: {leg.arrival_airport.value} at {leg.arrival_datetime}")
            print(f"  Duration: {leg.duration} minutes")
            if hasattr(leg, "layover_duration") and leg.layover_duration:
                print(f"  Layover: {leg.layover_duration} minutes")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/python/date_range_search.py`
```
#!/usr/bin/env python3
"""Date range search example.

This example demonstrates how to search for the cheapest flights
across a range of dates.
"""

from fli.models import Airport, DateSearchFilters, FlightSegment, PassengerInfo
from fli.search import SearchDates


def main():
    from datetime import datetime, timedelta

    # Create future dates
    base_date = datetime.now() + timedelta(days=30)
    travel_date = base_date.strftime("%Y-%m-%d")
    from_date = base_date.strftime("%Y-%m-%d")
    to_date = (base_date + timedelta(days=30)).strftime("%Y-%m-%d")

    # Create filters
    filters = DateSearchFilters(
        passenger_info=PassengerInfo(adults=1),
        flight_segments=[
            FlightSegment(
                departure_airport=[[Airport.JFK, 0]],
                arrival_airport=[[Airport.LAX, 0]],
                travel_date=travel_date,
            )
        ],
        from_date=from_date,
        to_date=to_date,
    )

    # Search dates
    search = SearchDates()
    results = search.search(filters)

    # Process results
    for date_price in results:
        print(f"Date: {date_price.date}, Price: ${date_price.price}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/python/date_search_with_preferences.py`
```
#!/usr/bin/env python3
"""Advanced date search with day preferences.

This example demonstrates how to search for flights across a date range
and filter results for specific days of the week (e.g., weekends only).
"""

from datetime import datetime, timedelta

from fli.models import (
    Airport,
    DateSearchFilters,
    FlightSegment,
    PassengerInfo,
    SeatType,
    TripType,
)
from fli.search import SearchDates


def main():
    # Create filters for weekends only
    base_date = datetime.now() + timedelta(days=30)
    travel_date = base_date.strftime("%Y-%m-%d")
    from_date = base_date.strftime("%Y-%m-%d")
    to_date = (base_date + timedelta(days=30)).strftime("%Y-%m-%d")

    filters = DateSearchFilters(
        trip_type=TripType.ONE_WAY,
        passenger_info=PassengerInfo(adults=1),
        flight_segments=[
            FlightSegment(
                departure_airport=[[Airport.JFK, 0]],
                arrival_airport=[[Airport.LAX, 0]],
                travel_date=travel_date,
            )
        ],
        from_date=from_date,
        to_date=to_date,
        seat_type=SeatType.PREMIUM_ECONOMY,
    )

    search = SearchDates()
    results = search.search(filters)

    # Filter for weekends only
    weekend_results = [
        r
        for r in results
        if r.date[0].weekday() >= 5  # Saturday = 5, Sunday = 6
    ]

    print(f"Found {len(weekend_results)} weekend flights:")
    for result in weekend_results:
        day_name = result.date[0].strftime("%A")
        date_str = result.date[0].strftime("%Y-%m-%d")
        print(f"{day_name}, {date_str}: ${result.price}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/python/error_handling_with_retries.py`
```
#!/usr/bin/env python3
"""Error handling and retry logic example.

This example demonstrates how to handle rate limits and implement
retry logic for robust flight searching.
"""

from datetime import datetime, timedelta

from fli.models import Airport, FlightSearchFilters, FlightSegment, PassengerInfo
from fli.search import SearchFlights

# Note: Install tenacity with: pip install tenacity
try:
    from tenacity import retry, stop_after_attempt, wait_exponential

    TENACITY_AVAILABLE = True
except ImportError:
    TENACITY_AVAILABLE = False
    print("Warning: tenacity not installed. Install with: pip install tenacity")


def simple_retry_search(filters: FlightSearchFilters, max_attempts=3):
    """Simple retry logic without external dependencies."""
    search = SearchFlights()

    for attempt in range(max_attempts):
        try:
            print(f"Attempt {attempt + 1}/{max_attempts}")
            results = search.search(filters)
            if not results:
                raise ValueError("No results found")
            return results
        except Exception as e:
            print(f"Search failed: {str(e)}")
            if attempt == max_attempts - 1:  # Last attempt
                raise
            print("Retrying...")

    return None


if TENACITY_AVAILABLE:

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=4, max=60))
    def search_with_retry(filters: FlightSearchFilters):
        """Advanced retry logic with exponential backoff."""
        search = SearchFlights()
        try:
            results = search.search(filters)
            if not results:
                raise ValueError("No results found")
            return results
        except Exception as e:
            print(f"Search failed: {str(e)}")
            raise  # Retry will handle this


def main():
    """Demonstrate error handling approaches."""
    # Create search filters
    filters = FlightSearchFilters(
        passenger_info=PassengerInfo(adults=1),
        flight_segments=[
            FlightSegment(
                departure_airport=[[Airport.JFK, 0]],
                arrival_airport=[[Airport.LAX, 0]],
                travel_date=(datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            )
        ],
    )

    print("=== Simple Retry Example ===")
    try:
        results = simple_retry_search(filters)
        print(f"Success! Found {len(results)} flights")
        for i, flight in enumerate(results[:3], 1):  # Show first 3 results
            print(f"  Flight {i}: ${flight.price}")
    except Exception as e:
        print(f"All retry attempts failed: {e}")

    if TENACITY_AVAILABLE:
        print("\n=== Advanced Retry with Tenacity ===")
        try:
            results = search_with_retry(filters)
            print(f"Success! Found {len(results)} flights")
            for i, flight in enumerate(results[:3], 1):  # Show first 3 results
                print(f"  Flight {i}: ${flight.price}")
        except Exception as e:
            print(f"All retry attempts failed: {e}")
    else:
        print("\n=== Advanced Retry (Tenacity not available) ===")
        print("Install tenacity to use advanced retry features: pip install tenacity")


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #258** (2026-09-22): **Live canary failing: Google Flights search**
  *Symptoms*: The scheduled live-canary workflow failed: the live tests failed twice in a row (initial run + one same-run retry of the failed cases). Run: https://github.com/punitarani/fli/actions/runs/35602399130
  **Post-Mortem & Fix Analysis**:
  > Live canary passed again. Run: https://github.com/punitarani/fli/actions/runs/35723219031

- **Issue #256** (2026-09-20): **fix(cli): do not print the sparse-results explanation twice in text mode**
  *Symptoms*: ## Summary  Follow-up to #255, found in a final end-to-end run of the built wheel: in text mode, an empty search for a party with children/infants showed the same explanation **twice**.  ``` $ fli flights SFO NRT <date> --class BUSINESS --children 1 No itineraries were inlined for this passenger mix. Google's search page prices …   ← stderr (library warning) No flights found. No itineraries were inlined for this passenger mix. Google's search page prices …   ← stdout (CLI echo) ```  `SearchFlights.search` already logs the explanation as a warning, which reaches the terminal on stderr like every other library warning. The flights command then printed the same paragraph again. The unit tests could not see this: under pytest the logging plugin replaces Python's last-resort stderr handler, and the mocked `SearchFlights` logs nothing.  ## What changes  - `fli flights` text mode no longer prints its own copy; the library's warning is the single explanation. The `--format json` empty payload keeps its `note` (JSON callers rarely read stderr). MCP is unchanged. - The now-unused `console` import goes with it; one `CLAUDE.md` sentence is corrected.  ## Verification  - Tests written first and watched fail (3 red): for a genuinely empty page there is exactly **one** WARNING record with the explanation and **nothing** on stdout; for rows removed by the caller's own airline filter there is no explanation at all. - Live, real CLI with the streams separated: stdout = `No flights found.`; std
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 100   1m 39s ⏱️ -4s 1 533 tests  - 589  1 404 ✅  - 589  129 💤 ±0  0 ❌ ±0  6 132 runs   - 591  5 616 ✅  - 591  516 💤 ±0  0 ❌ ±0   Results for commit 4e45f8e2. ± Comparison against base commit d925b0e8.  <details>   <summary>This pull request <b>removes</b> 593 and <b>adds</b> 4 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_flights ‑ test

- **Issue #255** (2026-09-20): **fix: say so when children or infants are why a search came back empty**
  *Symptoms*: ## Summary  When a search for a party with **children or infants** came back empty, the library said "no flights" — indistinguishable from a route with no service. Often the route has plenty: Google's search page simply inlines few or no itineraries for those parties (it prices them client-side, through the gated RPC), most of all in premium cabins. Extra adults cost nothing.  Measured live, one-way, 45 days out, rows returned (stable across repeats):  | | 1 adult | 2 adults | 1 adult + 1 child | 1 adult + lap infant | |---|---|---|---|---| | JFK→LHR economy | 23 | 23 | 23 | 16 | | JFK→LHR first | 11 | — | 11 | **0** | | SFO→NRT economy | 8 | — | 2 | 2 | | SFO→NRT business | 9 | 9 | **0** | **0** |  This does **not** fake results — no adults-only fallback, no estimated fares. It makes the empty answer honest.  ## What changes (Python and `fli-js`, mirrored)  - **Library:** when the result is empty, the party includes a child or infant, **and at least one fetched page carried zero rows before client-side filtering**, `SearchFlights.search` / `SearchDates.search` log exactly one warning explaining it, and set a read-only `sparse_passenger_mix` / `sparsePassengerMix` attribute (reset at the start of every search, including ones that raise). - The "before client-side filtering" condition matters: if Google *did* inline rows and the caller's own airline / price / duration / time-window filter removed them all, nothing is logged — the emptiness is the filter's, not Google's. Round 
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     5 files  ±  0    104 suites  +5   1m 35s ⏱️ +3s 2 122 tests + 67  1 993 ✅ + 67  129 💤 ±0  0 ❌ ±0  6 723 runs  +199  6 207 ✅ +199  516 💤 ±0  0 ❌ ±0   Results for commit 4dd96743. ± Comparison against base commit 122ef645.  [test-results]:data:application/gzip;base64,H4sIAPtRsGoC/02NSQ6DMBAEv4J8zsEeb3I+E+EFyQrgyMspyt8zJkA4VrWm5k2mOIdC7oO8DaS0WDdgVCD6lsca04rC9Bm32ldgAAc+SnOuXxjD/+4ZX92BOdU0xhkVPUXIOeXd5Lb2rtLAdzqyCqg+1a8qmTrMJbrxtenSssSKQIT3RmnBnbDBBZBWamsYRRcEgKOWaTsGfPf5AkaVSoQOAQAA 

- **Issue #254** (2026-09-20): **chore: describe code in terms a repo reader can follow (drop review-process references from comments)**
  *Symptoms*: ## Summary  Comment, docstring and one test-label cleanup — **no behaviour change**.  Several recently merged changes left comments that cite the private review process that produced them: internal task identifiers, "fix round 2", "maintainer ruling U1", "reviewer I1", finding labels. None of that exists anywhere a repo reader can look it up, so the comments read as noise, and some bury a genuinely useful *why* under the label.  Each one is rewritten to keep the reasoning and drop the provenance. Public references a reader can follow (PR and issue numbers, function names, measured figures) stay. Example:  ```diff -        # T10 fix round 2, maintainer ruling U1: previously hardcoded -        # "search_error" for both — see the report's "Behaviour changes". +        # Previously hardcoded "search_error" for both; now routed through +        # classify_error (#248) so the JSON error_type matches what MCP +        # reports for the same input. ```  16 files, about 30 locations; the only TypeScript change is one `describe()` label.  ## Verification  - **No code changed:** for each of the 15 Python files, the AST of `main`'s version equals the AST of this branch's version with docstring text blanked (comments are not AST nodes) — checked by the author and again independently. - The test count is identical to `main` on Python 3.10–3.13 (1,360 passed each); `ruff check` + `ruff format --check`; `bun run ci` (568 pass). - A grep for the reference patterns across `fli/`, `tests/`, `fl
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     5 files  ±0     99 suites  ±0   1m 32s ⏱️ ±0s 2 055 tests ±0  1 926 ✅ ±0  129 💤 ±0  0 ❌ ±0  6 524 runs  ±0  6 008 ✅ ±0  516 💤 ±0  0 ❌ ±0   Results for commit 6b42d3ca. ± Comparison against base commit 122ef645.  <details>   <summary>This pull request <b>removes</b> 9 and <b>adds</b> 9 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` SearchDates mostly-failed sweeps (T20) ‑ a minority of failures with no results returns null and warns exactly once SearchDates mostly-failed sweeps (T20) ‑ a tie between loaded and failed dates raises SearchDates mostly-failed sweeps (T20) ‑ all loaded empty returns null with no warnings SearchDates mostly-failed sweeps (T20) ‑ all priced returns the list with no warnings SearchDates mostly-failed sweeps (T20) ‑ attempted:false outcomes are ignored by the new arithmetic SearchDates mostly-failed sweeps (T20) ‑ mostly no-payload failures raise SearchParseError without the SOCS hint SearchDates mostly-failed swee

- **Issue #253** (2026-09-20): **fix(cli): an empty result no longer reports "Unexpected error: Exit: 1" or writes a traceback log**
  *Symptoms*: ## Summary  On an ordinary empty result the CLI printed a bogus crash report, and wrote a traceback file, after the real message:  ``` $ fli flights JFK LHR <date> No flights found. Error: Unexpected error: Exit: 1 Full traceback written to ~/.fli/logs/fli-error-….log ```  `raise typer.Exit(1)` on the empty-result path sits inside the `try:` whose last clause is a broad `except Exception`. `typer.Exit` is `click.exceptions.Exit`, a `RuntimeError` subclass, so the handler caught the control-flow exception and reported it as an unexpected error. Exit code was still 1, which is why nothing noticed. Present since #159 (shipped in v0.9.0); affects `fli flights`, `fli dates` and `fli multi` (both of its `Exit(1)` paths). A `typer.Abort` raised inside the block was swallowed the same way.  ## What changes  - `except (typer.Exit, typer.Abort): raise` immediately before the broad handler in the three commands. No message, exit code or JSON output changes; `--format json` already returned a well-formed empty payload before reaching the `raise`. - `tests/conftest.py`: an autouse fixture redirects `fli.cli.errors._LOG_DIR` to a per-test temp directory. The suite was writing real traceback files into the developer's `~/.fli/logs/` on every run (28 per full run, measured by filename).  ## Verification  - New `tests/cli/test_empty_result_exit.py` (10 tests): per command — exit code 1, the "No flights found…" text, **no** `Unexpected error` / `Exit: 1` / `Full traceback`, and the log directo
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 95   1m 27s ⏱️ +6s 1 489 tests  - 556  1 360 ✅  - 556  129 💤 ±0  0 ❌ ±0  5 956 runs   - 528  5 440 ✅  - 528  516 💤 ±0  0 ❌ ±0   Results for commit f9eefc9e. ± Comparison against base commit 25dec290.  <details>   <summary>This pull request <b>removes</b> 566 and <b>adds</b> 10 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_empty_result_e

- **Issue #252** (2026-09-20): **fix: carry the search's passenger mix into per-flight booking links**
  *Symptoms*: ## Summary  Per-flight booking deep links always encoded **one adult**, even when the search was for a family — the results showed the family price, and the link opened a booking page for a single traveller.  `encode_tfs_payload` already accepted `passengers` (repeated protobuf field 8, one entry per traveller), but `build_tfs_token` never passed it. This threads the search's passenger mix through the same path #231 used for the cabin class, in Python and `fli-js`.  ## What changes  | Area | Change | |---|---| | `fli/search/_proto.py`, `fli-js/src/search/proto.ts` | One shared `passenger_codes` / `passengerCodes` helper (1 adult, 2 child, 3 infant on lap, 4 infant in seat). `build_tfs_token` / `buildTfsToken` accept `passengers`. | | `fli/search/_tfs.py`, `fli-js/src/search/tfs.ts` | The search token now uses the same helper, so the search and booking tokens cannot drift. | | `SearchFlights.build_flight_booking_url` / `buildFlightBookingUrl` | New optional `passenger_info` / `passengerInfo`. Omitted → today's output, byte for byte. Still never raises. | | Call sites | MCP `search_flights`, MCP `get_booking_options` and the CLI flights command pass the search's passengers, as they already pass the cabin. | | Helper validation | Counts must be non-negative integers totalling at most 9 (the same ceiling `PassengerInfo` enforces), checked before anything is allocated; otherwise `ValueError` / `RangeError`. Found in review: a duck-typed `adults=10**6` produced a 2.7 MB URL after ~
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     5 files  ±  0     99 suites  +3   1m 23s ⏱️ +4s 2 045 tests + 62  1 916 ✅ + 62  129 💤 ±0  0 ❌ ±0  6 484 runs  +161  5 968 ✅ +161  516 💤 ±0  0 ❌ ±0   Results for commit cd86be45. ± Comparison against base commit 9982aff5.  [test-results]:data:application/gzip;base64,H4sIAK9EsGoC/03NSQ7DIAyF4atErLsAwtjLVMQBCTVDxbCqevc6NEmz/D9Lz28S4uQzuXfy1pFcY2lhLdZYkytxXbBNj42nsh05FfLIR64AaMwy9bdnfG3G7UnBxQmJnuBTWtMuqS7brhJG7HXMSqvMSb9V2R41uYy2vm7COs+xYBAYjRq8kG7QPgAIz4OWwHQIxmpGHVWK9ZoO5PMFrP3CjA0BAAA= 

- **Issue #251** (2026-09-20): **feat: clear TLS certificate errors and CA-bundle support (carries forward #164)**
  *Symptoms*: ## Summary  Carries forward the TLS half of #164 by @piersonrazzi onto current `main` (every commit is co-authored; the other half of #164 — a stable MCP `error_type` — already landed in #248).  Users behind a TLS-intercepting corporate proxy got a vague "check your connection" error, after three attempts with backoff, and had no way to point the client at their CA.  ## What changes  | Area | Change | |---|---| | `fli/search/exceptions.py` | `SearchCertificateError(SearchConnectionError)`, exported alongside its siblings | | `fli/search/client.py` | CA bundle from `FLI_CA_BUNDLE` → `CURL_CA_BUNDLE` → `REQUESTS_CA_BUNDLE` (first non-empty wins; an unreadable path fails immediately, naming the variable and path). curl_cffi's `CertificateVerifyError` → `SearchCertificateError` with an actionable message. **Certificate errors are no longer retried** — they are deterministic; everything else retries exactly as before. `_session()` still sets the `SOCS` consent cookie. | | `fli/core/errors.py` | `certificate_error`, `retryable: false`, checked before its parent `SearchConnectionError` (`retryable: true`) — same value from CLI `--format json` and the MCP tools | | `fli/cli/errors.py` | the actionable message on the human-readable path | | `tests/conftest.py` | autouse fixture clearing the three CA variables, so the suite is hermetic on a developer machine or CI runner behind a proxy | | Docs | `docs/guides/mcp.md`, `README.md`, `CLAUDE.md`: the variables, precedence, that they are r
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 92   1m 18s ⏱️ -1s 1 446 tests  - 502  1 317 ✅  - 502  129 💤 ±0  0 ❌ ±0  5 784 runs   - 399  5 268 ✅  - 399  516 💤 ±0  0 ❌ ±0   Results for commit 42774f63. ± Comparison against base commit 901d23d9.  <details>   <summary>This pull request <b>removes</b> 549 and <b>adds</b> 47 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_dates ‑ test_d

- **Issue #250** (2026-09-20): **feat: expose top_n for round-trip searches on the CLI and MCP tools**
  *Symptoms*: ## Summary  Fixes #142 — round-trip results "all come from a single airline".  `SearchFlights.search(filters, top_n=5)` fetches the outbound options and expands only the first `top_n` of them into return flights. With the default sort those five are usually the same cheap carrier. The library parameter existed, but neither the CLI nor the MCP tools let a caller change it, and nothing documented the trade-off.  ## What changes  | Layer | Change | |---|---| | CLI | `fli flights … --top-n N` (default 5, 1–10). Round trips only: left at its default it is ignored on a one-way search; set explicitly on a one-way search it is rejected with a one-line error. Echoed in the JSON `query` for round trips. | | MCP | `top_n` on `search_flights` **and** `get_booking_options` (the latter re-runs the search, so a flight found with `top_n=10` can still be priced). The description tells an agent what it does, what it costs, and that raising it is how to see more airlines. | | Library | `SearchFlights.search` validates `top_n` before any network call: an integer 1–10, otherwise a clear `ValueError` (non-ints and `bool` included). Default unchanged. | | Errors | A bad `top_n` reports `error_type: "validation_error"` from both CLI `--format json` and the MCP tools (parity case added). | | Docs | README, `docs/guides/mcp.md`, `CLAUDE.md`: the parameter, the cost model, and the one-line answer to #142. |  **Cost model:** a round trip costs `1 + top_n` page fetches (~2 MB each), so the upper bound of
  **Post-Mortem & Fix Analysis**:
  > ## Test Results     4 files   -   1      4 suites   - 92   1m 17s ⏱️ ±0s 1 411 tests  - 486  1 282 ✅  - 486  129 💤 ±0  0 ❌ ±0  5 644 runs   - 335  5 128 ✅  - 335  516 💤 ±0  0 ❌ ±0   Results for commit 69106af4. ± Comparison against base commit 74fa5506.  <details>   <summary>This pull request <b>removes</b> 537 and <b>adds</b> 51 tests. <i>Note that renamed tests count towards both.</i></summary>  ``` Airline enum ‑ AIRLINE_NAMES carries the name Airline enum ‑ CSV-quoted names with embedded commas are unquoted Airline enum ‑ alliance pseudo-codes are included Airline enum ‑ digit-prefixed codes use underscore Airline enum ‑ major carriers are present Airport CSV quoting ‑ RFC4180 escaped quotes (`""`) decode to a single `"` Airport CSV quoting ‑ names with embedded commas are unquoted Airport enum ‑ AIRPORT_NAMES carries the name Airport enum ‑ common codes are present Airport enum ‑ display names are disambiguated to match the Python package … ```  ``` tests.cli.test_top_n.TestTopN

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

### Incident Patch 1: `881aee5f` (2026-09-20)
**Commit Message**: fix(cli): do not print the sparse-passenger-mix explanation twice in text mode (#256)

SearchFlights.search already logs the explanation as a warning, which
reaches the terminal on stderr like every other library warning. The
flights command then printed the same paragraph again under "No flights
found.", so a terminal user read it twice. Text mode now leaves it to the
library; the JSON empty payload keeps its `note`, since JSON callers
rarely read stderr.

Tests assert the explanation appears exactly once (one WARNING record,
nothing on stdout) for a genuinely empty page, and not at all when the
caller's own filter emptied the result.

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `CLAUDE.md` (modified, +5/-3)
```diff
@@ -152,9 +152,11 @@ Consequences to keep in mind when changing search code:
   came back with zero rows, not when the caller's own airline/price/
   duration/window filter removed rows Google did return (see
   `SearchFlights.sparse_passenger_mix`). The MCP `search_flights` empty
-  response carries the same text as `note`, and the CLI prints it under
-  "No flights found.", both reading that attribute rather than recomputing
-  the condition — an adults-only search shows the schedule.
+  response and the CLI's `--format json` empty payload carry the same text
+  as `note`, both reading that attribute rather than recomputing the
+  condition. The CLI's text mode prints no copy of its own: the library's
+  warning already reaches the terminal on stderr, and echoing it showed the
+  same paragraph twice — an adults-only search shows the schedule.
 - Date searches have no calendar grid: one page fetch per date, capped at
   `fli.search.dates.MAX_DATES_PER_SEARCH` (93) per `SearchDates.search`. At the
   cap that is several hundred MB of pages and parsed JSON at peak.
```

**File**: `fli/cli/commands/flights.py` (modified, +6/-3)
```diff
@@ -5,7 +5,6 @@
 import typer
 from pydantic import ValidationError
 
-from fli.cli.console import console
 from fli.cli.enums import OutputFormat
 from fli.cli.errors import json_error_payload, report_cli_error
 from fli.cli.utils import (
@@ -250,9 +249,13 @@ def _search_flights_core(
                 )
                 return
 
+            # Text mode prints no copy of the note: SearchFlights.search has
+            # already logged the same explanation as a warning, which — like
+            # every other library warning — reaches the terminal on stderr.
+            # Echoing it here showed the user the same paragraph twice. JSON
+            # callers rarely read stderr, which is why the note rides in the
+            # payload above instead.
             typer.echo("No flights found.")
-            if sparse_note:
-                console.print(sparse_note, style="dim", soft_wrap=True)
             raise typer.Exit(1)
 
         # Build per-flight booking deep-links (tfs; never raises).
```

**File**: `tests/cli/test_flights.py` (modified, +49/-24)
```diff
@@ -1,6 +1,7 @@
 """Tests for the flights CLI command."""
 
 import json
+import logging
 from datetime import datetime, timedelta
 
 import pytest
@@ -520,13 +521,17 @@ def test_flights_no_results(runner, mock_search_flights, mock_console):
     assert "client-side" not in result.stdout
 
 
-def test_flights_no_results_with_child_explains_the_sparsity(runner, mock_search_flights):
-    """An empty result for a party with children/infants gets the extra hint.
-
-    Google's search page inlines fewer (sometimes zero) rows for those
-    parties — see SPARSE_PASSENGER_MIX_WARNING in fli.search.flights. The
-    CLI reads search_client.sparse_passenger_mix rather than recomputing
-    it, so the mock sets it the way the real library would for this party.
+def test_flights_no_results_with_child_does_not_repeat_the_library_warning(
+    runner, mock_search_flights
+):
+    """Text mode leaves the explanation to the library's own warning.
+
+    Google's search page inlines fewer (sometimes zero) rows for parties with
+    children/infants — see SPARSE_PASSENGER_MIX_WARNING in fli.search.flights.
+    ``SearchFlights.search`` logs that warning itself, and like every other
+    library warning it reaches the terminal on stderr, so printing it again
+    on stdout would show the user the same paragraph twice. (The mock here
+    logs nothing, which is what isolates the CLI's own output.)
     """
     mock_search_flights.search.return_value = []
     mock_search_flights.sparse_passenger_mix = True
@@ -546,10 +551,12 @@ def test_flights_no_results_with_child_explains_the_sparsity(runner, mock_search
     )
     assert result.exit_code == 1
     assert "No flights found" in result.stdout
-    assert "client-side" in result.stdout
+    assert "client-side" not in result.stdout
 
 
-def test_flights_no_results_with_infant_explains_the_sparsity(runner, mock_search_flights):
+def test_flights_no_results_with_infant_does_not_repeat_the_library_warning(
+    runner, mock_search_flights
+):
     mock_search_flights.search.return_value = []
     mock_search_flights.sparse_passenger_mix = True
 
@@ -565,17 +572,26 @@ def test_flights_no_results_with_infant_explains_the_sparsity(runner, mock_searc
         ],
     )
     assert result.exit_code == 1
-    assert "client-side" in result.stdout
+    assert "client-side" not in result.stdout
 
 
 class TestFlightsNoteTracksGoogleNotTheCallersFilter:
     """End-to-end (stubbed page, real ``SearchFlights.search``) — mirrors the MCP-level check.
 
-    A page that genuinely carries no rows still gets the hint; a page that
-    carries a row the caller's own airline filter then removes does not —
-    that emptiness is the filter's doing, not Google's.
+    A page that genuinely carries no rows is explained exactly once — by the
+    library's warning, not repeated on stdout; a page that carries a row the
+    caller's own airline filter then removes is not explained at all — that
+    emptiness is the filter's doing, not Google's.
     """
 
+    @staticmethod
+    def _sparse_warnings(caplog) -> list[str]:
+        return [
+            record.getMessage()
+            for record in caplog.records
+            if record.levelno == logging.WARNING and "client-side" in record.getMessage()
+        ]
+
     def _page(self, rows: list) -> str:
         payload = [[None, None, None, None, "FAKE_SESSION"], None, [rows], None]
         return as_search_page(payload)
@@ -586,20 +602,32 @@ def _fake_get(self, url, **kwargs):  # noqa: ANN001
 
         monkeypatch.setattr("fli.search.client.Client.get", _fake_get)
 
-    def test_genuinely_empty_page_prints_the_hint(self, runner, monkeypatch):
+    def test_genuinely_empty_page_is_explained_exactly_once(self, runner, monkeypatch, caplog):
         self._stub_get(monkeypatch, self._page([]))
-        result = runner.invoke(
-            app,
-            ["flights", "JFK", "LHR", datetime.now().strftime("%Y-%m-%d"), "--children", "1"],
-        )
+        with 
```

---

### Incident Patch 2: `d925b0e8` (2026-09-20)
**Commit Message**: fix: say so when children or infants are why a search came back empty (#255)

* fix(search): warn when an empty result may be Google's sparse-mix pricing gap

Google's search page prices parties with children or infants client-side, so
an empty SearchFlights.search / SearchDates.search result for those parties
used to read the same as a route with no flights at all. Log one warning
(SPARSE_PASSENGER_MIX_WARNING) when the final result is empty and the party
includes a child or infant; extra adults never trigger it. Fires at most once
per search() call, even for round trips, and never stacks on top of #249's
minority-date-failure warning in the date sweep.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

* fix(mcp): add a note explaining sparse results for children/infants

search_flights' empty response now carries a "note" key with the same
sparse-passenger-mix explanation the library logs, so an agent relaying the
result says why the list is empty instead of implying the route has no
flights. Adults-only and non-empty results never get the key.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

* fix(cli): explain sparse results for children/infants on empty search

**File**: `CLAUDE.md` (modified, +14/-0)
```diff
@@ -141,6 +141,20 @@ Consequences to keep in mind when changing search code:
   offline and unaffected.
 - A search returns fewer rows than the old RPC (~20-45), and client-side
   filtering is not back-filled.
+- **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries for
+  them, and in premium cabins often none (measured 2026-09: JFK→LHR economy
+  23 rows for one adult, 16 with an infant; SFO→NRT business 9 rows for one
+  or two adults, 0 with a child). Extra adults cost nothing. An empty result
+  for such a search does not mean the route has no flights — and neither
+  does it mean this is why: `SearchFlights.search` / `SearchDates.search`
+  only warn (`SPARSE_PASSENGER_MIX_WARNING`) when the fetched page itself
+  came back with zero rows, not when the caller's own airline/price/
+  duration/window filter removed rows Google did return (see
+  `SearchFlights.sparse_passenger_mix`). The MCP `search_flights` empty
+  response carries the same text as `note`, and the CLI prints it under
+  "No flights found.", both reading that attribute rather than recomputing
+  the condition — an adults-only search shows the schedule.
 - Date searches have no calendar grid: one page fetch per date, capped at
   `fli.search.dates.MAX_DATES_PER_SEARCH` (93) per `SearchDates.search`. At the
   cap that is several hundred MB of pages and parsed JSON at peak.
```

**File**: `README.md` (modified, +10/-0)
```diff
@@ -190,6 +190,16 @@ What that means in practice:
 * **Fewer rows per search.** Expect roughly 20-45 itineraries, fewer than the
   old RPC returned — and a client-side filter cannot back-fill the list the way
   Google's server-side one did.
+* **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries for
+  them, and in premium cabins often none (measured 2026-09: JFK→LHR economy
+  23 rows for one adult, 16 with an infant; SFO→NRT business 9 rows for one
+  or two adults, 0 with a child). Extra adults cost nothing. An empty result
+  for such a search does not mean the route has no flights — and neither
+  does it mean this is why: `search()` only warns when the fetched page
+  itself came back with zero rows, not when the caller's own airline/price/
+  duration/window filter removed rows Google did return. An adults-only
+  search shows the schedule.
 * **Date searches cost one page fetch per date.** The page has no calendar
   grid, so a range is priced date by date; one `SearchDates.search` covers at
   most 93 dates and a wider range raises `ValueError`. Budget for it: 93 dates
```

**File**: `docs/typescript/quickstart.md` (modified, +10/-0)
```diff
@@ -233,6 +233,16 @@ What that means in practice:
 * **Fewer rows per search.** Expect roughly 20–45 itineraries, fewer than
   the old RPC returned — and a client-side filter cannot back-fill the
   list the way Google's server-side one did.
+* **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries
+  for them, and in premium cabins often none (measured 2026-09: JFK→LHR
+  economy 23 rows for one adult, 16 with an infant; SFO→NRT business 9
+  rows for one or two adults, 0 with a child). Extra adults cost nothing.
+  An empty result for such a search does not mean the route has no
+  flights — and neither does it mean this is why: `search()` only warns
+  when the fetched page itself came back with zero rows, not when the
+  caller's own airline/price/duration/window filter removed rows Google
+  did return. An adults-only search shows the schedule.
 * **Date searches cost one page fetch per date**, capped at 93 dates. A
   sweep that never loads a single page stops once five dates have come
   back payload-less and throws, rather than paying the retry budget on
```

**File**: `fli-js/README.md` (modified, +10/-0)
```diff
@@ -124,6 +124,16 @@ What that means in practice:
 - **Fewer rows per search.** Expect roughly 20–45 itineraries, fewer than the
   old RPC returned — and a client-side filter cannot back-fill the list the way
   Google's server-side one did.
+- **Children and infants thin the results — sometimes to nothing.** Google
+  prices those parties client-side, so the page inlines fewer itineraries for
+  them, and in premium cabins often none (measured 2026-09: JFK→LHR economy
+  23 rows for one adult, 16 with an infant; SFO→NRT business 9 rows for one
+  or two adults, 0 with a child). Extra adults cost nothing. An empty result
+  for such a search does not mean the route has no flights — and neither
+  does it mean this is why: `search()` only warns when the fetched page
+  itself came back with zero rows, not when the caller's own airline/price/
+  duration/window filter removed rows Google did return. An adults-only
+  search shows the schedule.
 - **Date searches cost one page fetch per date.** The page has no calendar
   grid, so a range is priced date by date; one `SearchDates.search` covers at
   most 93 dates (`MAX_DATES_PER_SEARCH`) and a wider range throws `RangeError`.
```

**File**: `fli-js/src/search/dates.ts` (modified, +127/-5)
```diff
@@ -12,7 +12,7 @@
  */
 
 import { formatIsoDate, parseIsoDate } from "../core/dates.ts";
-import type { FlightResult } from "../models/google-flights/base.ts";
+import type { FlightResult, PassengerInfo } from "../models/google-flights/base.ts";
 import { TripType } from "../models/google-flights/base.ts";
 import type { DateSearchFilters } from "../models/google-flights/dates.ts";
 import { type Client, getClient } from "./client.ts";
@@ -44,6 +44,29 @@ export const NO_PAYLOAD =
   "the search page carried no ds:1 payload — Google may have changed the " +
   "page shape, or served a consent/blocked page instead";
 
+/**
+ * Same wording `flights.ts` uses for the same condition — see
+ * {@link SPARSE_PASSENGER_MIX_WARNING} there for the live JFK-LHR / SFO-NRT
+ * row counts behind it. Duplicated rather than imported so this module's
+ * empty-result path stays self-contained.
+ */
+export const SPARSE_PASSENGER_MIX_WARNING =
+  "No itineraries were inlined for this passenger mix. Google's search page " +
+  "prices parties with children or infants client-side, so it often carries " +
+  "few or no rows for them — most of all in premium cabins. This does not " +
+  "mean the route has no flights: an adults-only search shows the schedule.";
+
+/**
+ * Whether the party includes anyone Google prices client-side.
+ *
+ * Extra adults ride the request for free; children and infants (lap or
+ * seat) are the passenger types that make the search-page transport inline
+ * fewer — sometimes zero — rows. See {@link SPARSE_PASSENGER_MIX_WARNING}.
+ */
+function hasChildrenOrInfants(passengerInfo: PassengerInfo): boolean {
+  return passengerInfo.children + passengerInfo.infants_on_lap + passengerInfo.infants_in_seat > 0;
+}
+
 /**
  * Most dates a single {@link SearchDates.search} call will price.
  *
@@ -164,10 +187,29 @@ export interface DateOutcome {
   error: unknown;
   /** False for dates skipped before any request, so they don't count as failures. */
   attempted: boolean;
+  /**
+   * How many rows the page decoded to *before* `applyClientSideFilters` ran,
+   * or `null`/absent when the page never loaded (`failure` is set) or the
+   * outcome was built by hand. Zero here means Google itself inlined
+   * nothing for the date; a positive count that still left `price` unset
+   * means the caller's own airline/price/duration/window filter removed
+   * every row — a different cause, so the two must not be conflated when
+   * deciding whether to blame a sparse passenger mix. Optional so existing
+   * hand-built ``DateOutcome`` literals (test fixtures predating this field)
+   * still type-check; an absent value reads the same as `null`.
+   */
+  rowsBeforeFilters?: number | null;
 }
 
 function outcome(over: Partial<DateOutcome> = {}): DateOutcome {
-  return { price: null, failure: null, error: null, attempted: true, ...over };
+  return {
+    price: null,
+    failure: null,
+    error: null,
+    attempted: true,
+    rowsBeforeFilters: null,
+    ...over,
+  };
 }
 
 /** Midnight UTC today. */
@@ -253,11 +295,32 @@ export class SearchDates {
   static readonly MAX_DATES_PER_SEARCH = MAX_DATES_PER_SEARCH;
 
   private readonly client: Client;
+  private _sparsePassengerMix = false;
 
   constructor(client?: Client) {
     this.client = client ?? getClient();
   }
 
+  /**
+   * Whether the sparse-passenger-mix warning fired on the most recent `search()`.
+   *
+   * `true` exactly when the empty sweep this instance last returned (or
+   * threw out of) was consistent with Google's client-side pricing gap for
+   * children/infants rather than the caller's own filters — see
+   * {@link SearchDates._warnIfSparsePassengerMix}. Reset to `false` at the
+   * start of every `search()` call, including ones that throw, so a stale
+   * `true` from an earlier call never leaks into a later one.
+   *
+   * Reflects only the *last completed* `search()` call on this instance and
+   * is not meant for instances shared across concurr
```

---

### Incident Patch 3: `122ef645` (2026-09-20)
**Commit Message**: fix(cli): an empty result no longer reports "Unexpected error: Exit: 1" or writes a traceback log (#253)

* fix(cli): stop reporting empty search results as an unexpected error

flights, dates, and multi each raise typer.Exit(1) inside their try block
once a search legitimately returns nothing. typer.Exit is
click.exceptions.Exit, a RuntimeError subclass, so it fell through into
the trailing `except Exception` handler and got reported as a crash: a
bogus "Unexpected error: Exit: 1" line plus a full traceback log file
under ~/.fli/logs/ for a perfectly normal "no flights matched" outcome.

Add an `except (typer.Exit, typer.Abort): raise` clause before the broad
handler in all three commands so deliberate control-flow exits (empty
results in flights/dates/multi, and multi's "at least 2 legs" guard) pass
through untouched. Genuinely unexpected exceptions are unaffected — none
of the narrower clauses (ParseError, ValidationError, AttributeError/
ValueError, SearchClientError) catch RuntimeError subclasses either, so
this was the only gap. JSON mode was already unaffected: it returns a
well-formed empty payload before reaching the raise.

Co-Authored-By: Claude Sonnet 5 <noreply@anthrop

**File**: `fli/cli/commands/dates.py` (modified, +7/-0)
```diff
@@ -598,6 +598,13 @@ def dates(
             raise typer.Exit(1) from e
         typer.echo(f"Error: {str(e)}")
         raise typer.Exit(1) from e
+    except (typer.Exit, typer.Abort):
+        # click.exceptions.Exit/Abort are RuntimeError subclasses, so without
+        # this clause the broad except below would catch the deliberate
+        # `raise typer.Exit(1)` above (empty results) and report it as a
+        # crash: bogus "Unexpected error" text plus a traceback log file for
+        # a perfectly normal "no flights matched" outcome.
+        raise
     except Exception as e:  # noqa: BLE001 — fall back to clean reporting
         if output_format == OutputFormat.JSON:
             payload_info = json_error_payload(e, command="dates")
```

**File**: `fli/cli/commands/flights.py` (modified, +7/-0)
```diff
@@ -346,6 +346,13 @@ def _search_flights_core(
             emit_json(payload)
             raise typer.Exit(1) from e
         raise report_cli_error(e, command="flights") from e
+    except (typer.Exit, typer.Abort):
+        # click.exceptions.Exit/Abort are RuntimeError subclasses, so without
+        # this clause the broad except below would catch the deliberate
+        # `raise typer.Exit(1)` above (empty results) and report it as a
+        # crash: bogus "Unexpected error" text plus a traceback log file for
+        # a perfectly normal "no flights matched" outcome.
+        raise
     except Exception as e:  # noqa: BLE001 — fall back to clean reporting
         if output_format == OutputFormat.JSON:
             payload_info = json_error_payload(e, command="flights")
```

**File**: `fli/cli/commands/multi.py` (modified, +7/-0)
```diff
@@ -213,5 +213,12 @@ def multi(
         raise typer.Exit(1) from e
     except SearchClientError as e:
         raise report_cli_error(e, command="multi") from e
+    except (typer.Exit, typer.Abort):
+        # click.exceptions.Exit/Abort are RuntimeError subclasses, so without
+        # this clause the broad except below would catch either of the
+        # deliberate `raise typer.Exit(1)` calls above (too few legs, empty
+        # results) and report it as a crash: bogus "Unexpected error" text
+        # plus a traceback log file for a perfectly normal outcome.
+        raise
     except Exception as e:  # noqa: BLE001 — fall back to clean reporting
         raise report_cli_error(e, command="multi") from e
```

**File**: `tests/cli/test_empty_result_exit.py` (added, +220/-0)
```diff
@@ -0,0 +1,220 @@
+"""An ordinary empty search result must exit clean, not report a crash.
+
+`typer.Exit(1)` — raised in the empty-result branch of `flights`, `dates`, and
+`multi` once the search legitimately returns nothing — is `click.exceptions.Exit`,
+a `RuntimeError` subclass. Each command's broad `except Exception` handler used to
+catch that control-flow exception too, so a perfectly normal "no flights matched"
+outcome also printed a bogus "Unexpected error: Exit: 1" line and wrote a
+traceback log file under `~/.fli/logs/`.
+
+These tests pin down two things per command: the empty-result path exits clean
+with exactly its own message (no extra "Unexpected error" text, no log file),
+and a genuine unexpected exception is still caught and reported exactly as
+before (message + log file) — the fix must not blind the broad handler.
+
+Kept in a new file rather than appended to test_flights.py /test_dates.py /
+test_multi.py: another branch in flight also touches those files, and this
+avoids conflicting with it.
+"""
+
+import json
+from datetime import datetime, timedelta
+from pathlib import Path
+
+import pytest
+from typer.testing import CliRunner
+
+from fli.cli.main import app
+
+
+@pytest.fixture
+def runner() -> CliRunner:
+    """Return a CliRunner instance."""
+    return CliRunner()
+
+
+@pytest.fixture(autouse=True)
+def _isolated_tmp_log_dir(monkeypatch, tmp_path):
+    """Redirect _LOG_DIR so log files land under tmp_path instead of ~/.fli/logs/.
+
+    The target subdirectory does not exist until `_write_log` creates it, so
+    "no log file was written" can be asserted as "the directory was never
+    created" — a bug that silently creates-and-writes would fail that check,
+    while a test that merely looked for zero *known* filenames would not.
+    """
+    monkeypatch.setattr("fli.cli.errors._LOG_DIR", tmp_path / "fli-logs")
+
+
+def _log_dir(tmp_path: Path) -> Path:
+    return tmp_path / "fli-logs"
+
+
+def _future_date(days_ahead: int) -> str:
+    """Return a future date string in YYYY-MM-DD format, relative to today."""
+    return (datetime.now() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
+
+
+# ---------------------------------------------------------------------------
+# flights
+# ---------------------------------------------------------------------------
+
+
+def test_flights_empty_result_exits_clean(runner, mock_search_flights, mock_console, tmp_path):
+    """An ordinary empty flight search exits 1 with only the empty-result message."""
+    mock_search_flights.search.return_value = []
+
+    result = runner.invoke(app, ["flights", "JFK", "LHR", _future_date(40)])
+
+    assert result.exit_code == 1
+    assert result.output.count("No flights found.") == 1
+    assert "Unexpected error" not in result.output
+    assert "Exit: 1" not in result.output
+    assert "Full traceback" not in result.output
+    assert not _log_dir(tmp_path).exists()
+
+
+def test_flights_json_empty_result_unchanged(runner, mock_search_flights, mock_console):
+    """`--format json` still exits 0 with an empty flights[] payload, untouched by the fix."""
+    mock_search_flights.search.return_value = []
+
+    result = runner.invoke(app, ["flights", "JFK", "LHR", _future_date(40), "--format", "json"])
+
+    assert result.exit_code == 0
+    payload = json.loads(result.stdout)
+    assert payload["success"] is True
+    assert payload["count"] == 0
+    assert payload["flights"] == []
+
+
+def test_flights_unexpected_exception_still_reported(
+    runner, mock_search_flights, mock_console, tmp_path
+):
+    """A genuine crash still goes through the broad handler: message + log file."""
+    mock_search_flights.search.side_effect = RuntimeError("boom")
+
+    result = runner.invoke(app, ["flights", "JFK", "LHR", _future_date(40)])
+
+    assert result.exit_code == 1
+    assert "Unexpected error: RuntimeError: boom" in result.output
+    assert "Full traceback written to" in result.output
+    log_dir = _log
```

**File**: `tests/conftest.py` (modified, +21/-0)
```diff
@@ -61,6 +61,27 @@ def _scrub_ca_bundle_env(monkeypatch):
     monkeypatch.delenv("REQUESTS_CA_BUNDLE", raising=False)
 
 
+@pytest.fixture(autouse=True)
+def _isolate_cli_error_log_dir(monkeypatch, tmp_path):
+    """Redirect ``fli.cli.errors._LOG_DIR`` under ``tmp_path`` for every test.
+
+    ``_LOG_DIR`` is ``Path.home() / ".fli" / "logs"`` — a module-level
+    constant, read once at import time. Any test that exercises
+    ``report_cli_error`` / ``json_error_payload``, directly or indirectly
+    (a CLI command hitting an error path, a search helper whose error
+    surfaces through the CLI reporter), calls ``_write_log()``, which
+    creates that directory and drops a full traceback file into it. Left
+    unpatched, running the suite writes real files into the developer's
+    actual ``~/.fli/logs/`` on every run — tests must never touch that
+    directory. Autouse, suite-wide, so no test file has to remember to opt
+    in; a test whose assertions depend on the exact redirected path (e.g.
+    to check the directory is never created for a control-flow exit) can
+    still set its own ``monkeypatch.setattr("fli.cli.errors._LOG_DIR", ...)``
+    — defined closer to the test, it runs after this one and wins.
+    """
+    monkeypatch.setattr("fli.cli.errors._LOG_DIR", tmp_path / "fli-logs")
+
+
 def pytest_addoption(parser) -> None:
     """Add options to pytest."""
     parser.addoption("--fuzz", action="store_true", help="Run fuzz tests")
```

---

### Incident Patch 4: `25dec290` (2026-09-20)
**Commit Message**: fix: carry the search's passenger mix into per-flight booking links (#252)

* fix(search): thread the search's passenger mix into tfs booking deep-links

build_tfs_token hardcoded protobuf field 8 to a single adult, so a
booking URL from a family/group search (2 adults + 1 child, etc.)
always opened Google's booking page priced for one adult, even though
the search results themselves were priced for the full party.
encode_tfs_payload already accepted a `passengers` list; it just never
reached the booking-URL builder.

Extract the PassengerInfo -> field-8 codes conversion (previously
inlined in _tfs.build_tfs / tfs.ts::buildTfs) into a shared
passenger_codes()/passengerCodes() helper next to encode_tfs_payload,
so the search token and the booking token cannot drift on how they
encode the mix again. Thread it through build_tfs_token and
SearchFlights.build_flight_booking_url (mirroring how PR #231 threaded
seat_type through the same path), and wire it at all three call sites
that build per-flight booking links: the MCP server's search_flights
and get_booking_options, and the CLI's flights command.

Verified live against Google's booking page (2026-09-20): the decoded
field-8 array on

**File**: `CLAUDE.md` (modified, +7/-4)
```diff
@@ -216,10 +216,13 @@ Search for flights on a specific date.
 **Response:** Each flight in `flights[]` carries its own `booking_url` — a
 `tfs` protobuf deep link that opens the specific itinerary's booking page
 (vendor fares + "Continue" CTA) on Google Flights. The token is deterministic
-(no session id), so the same itinerary always yields the same URL. The
-top-level `booking_url` is a broader search-page link (route + dates
-pre-filled) kept as a reliable fallback. Each flight's `flight_number` can be
-passed to `get_booking_options` for per-vendor pricing.
+(no session id), so the same itinerary always yields the same URL, and it
+carries the search's cabin class and passenger mix (adults, children,
+infants) so the booking page opens priced for the same travelers as the
+search results. The top-level `booking_url` is a broader search-page link
+(route + dates pre-filled) kept as a reliable fallback. Each flight's
+`flight_number` can be passed to `get_booking_options` for per-vendor
+pricing.
 
 ### `search_dates`
 Find cheapest travel dates within a range.
```

**File**: `docs/guides/mcp.md` (modified, +6/-4)
```diff
@@ -138,10 +138,12 @@ Search for flights between two airports on a specific date.
 
 Each flight in `flights[]` carries a `booking_url` that deep-links directly to
 that specific flight's booking page on Google Flights (pre-loaded itinerary, no
-search step required). The top-level `booking_url` is a broader search-page
-link (route + date pre-filled) and is a reliable fallback. To retrieve
-per-vendor prices and airline-direct booking links, pass the flight's
-`flight_number` (e.g. `BA178`) to [`get_booking_options`](#get_booking_options).
+search step required). It carries the search's cabin class and passenger mix
+too, so it opens priced for the same travelers as the search results. The
+top-level `booking_url` is a broader search-page link (route + date
+pre-filled) and is a reliable fallback. To retrieve per-vendor prices and
+airline-direct booking links, pass the flight's `flight_number` (e.g.
+`BA178`) to [`get_booking_options`](#get_booking_options).
 
 ### `search_dates`
 
```

**File**: `fli-js/src/search/flights.ts` (modified, +13/-3)
```diff
@@ -11,7 +11,7 @@
  */
 
 import type { GoogleFlightsUrlOptions } from "../core/links.ts";
-import type { BookingOption, FlightResult } from "../models/google-flights/base.ts";
+import type { BookingOption, FlightResult, PassengerInfo } from "../models/google-flights/base.ts";
 import { SeatType, SortBy, TripType } from "../models/google-flights/base.ts";
 import type { FlightSearchFilters } from "../models/google-flights/flights.ts";
 import { type Client, getClient } from "./client.ts";
@@ -20,7 +20,7 @@ import { parallelMap, throwIfAborted } from "./concurrency.ts";
 import { parseBookingChunk, parseFlightRow } from "./decoders.ts";
 import { SearchParseError } from "./exceptions.ts";
 import { getSearchLogger } from "./logging.ts";
-import { buildBookingToken, buildTfsToken, type LegSpec } from "./proto.ts";
+import { buildBookingToken, buildTfsToken, type LegSpec, passengerCodes } from "./proto.ts";
 import {
   applyClientSideFilters,
   buildTfs,
@@ -91,6 +91,12 @@ export interface BookingOptions {
 export interface BookingUrlOptions extends GoogleFlightsUrlOptions {
   /** Cabin class encoded into the `tfs` token (field 9). Defaults to economy. */
   seatType?: SeatType;
+  /**
+   * Passenger mix encoded into the `tfs` token (field 8, one entry per
+   * traveller). Defaults to a single adult, matching this method's output
+   * before this option existed.
+   */
+  passengerInfo?: Partial<PassengerInfo>;
 }
 
 export class SearchFlights {
@@ -409,7 +415,11 @@ export class SearchFlights {
           flightNumber: leg.flight_number,
         })),
       );
-      const tfs = buildTfsToken(segments, { isOneWay, seat: options.seatType ?? SeatType.ECONOMY });
+      const tfs = buildTfsToken(segments, {
+        isOneWay,
+        passengers: passengerCodes(options.passengerInfo),
+        seat: options.seatType ?? SeatType.ECONOMY,
+      });
       url = `https://www.google.com/travel/flights/booking?tfs=${tfs}`;
     } catch {
       url = "https://www.google.com/travel/flights";
```

**File**: `fli-js/src/search/proto.ts` (modified, +87/-1)
```diff
@@ -6,6 +6,7 @@
  */
 
 import { Buffer } from "node:buffer";
+import type { PassengerInfo } from "../models/google-flights/base.ts";
 
 function concatBytes(...parts: Uint8Array[]): Uint8Array {
   let total = 0;
@@ -347,6 +348,13 @@ export interface LegSpec {
 export interface BuildTfsTokenOptions {
   /** `true` for one-way (incl. multi-city); `false` for round-trip. */
   isOneWay?: boolean;
+  /**
+   * Passenger kind codes, one entry per traveller (field 8). Build these
+   * from a search's `PassengerInfo` with {@link passengerCodes}. Defaults
+   * to a single adult so existing callers keep producing the captured
+   * tokens.
+   */
+  passengers?: readonly number[];
   /**
    * Cabin class encoded in field 9.
    * `1` = economy, `2` = premium economy, `3` = business, `4` = first.
@@ -376,6 +384,83 @@ export interface BuildTfsTokenOptions {
 
 const MAX_U64 = (1n << 64n) - 1n;
 
+/**
+ * Passenger kinds, in the order Google's repeated field 8 numbers them:
+ * 1 = adult, 2 = child, 3 = infant on lap, 4 = infant in own seat.
+ *
+ * The two infant codes are easy to transpose and the mistake is expensive
+ * rather than loud: on an international route a lap infant prices at ~10%
+ * of the adult fare and an infant in its own seat at ~100%, so a swap
+ * quotes a plausible but wrong fare instead of erroring. The legacy RPC
+ * struct orders the same four counts
+ * `[adults, children, infants_on_lap, infants_in_seat]`.
+ */
+const PASSENGER_FIELDS: ReadonlyArray<readonly [keyof PassengerInfo, number]> = [
+  ["adults", 1],
+  ["children", 2],
+  ["infants_on_lap", 3],
+  ["infants_in_seat", 4],
+];
+
+/**
+ * Google's own per-booking limit. The Python port's `PassengerInfo` enforces
+ * this in `validate_passenger_counts`
+ * (`fli/models/google_flights/base.py`) — `PassengerInfoSchema` here has no
+ * equivalent cross-field check, so this is the one place on the TypeScript
+ * side that rejects an over-the-limit mix. Keep this in sync with the
+ * Python validator if Google's limit ever changes.
+ */
+const MAX_TOTAL_PASSENGERS = 9;
+
+/**
+ * Convert a `PassengerInfo` into `tfs` field-8 codes, one per traveller.
+ *
+ * Shared by {@link buildTfs} in `tfs.ts` (the search token) and
+ * {@link buildTfsToken} (the per-flight booking token) so the two cannot
+ * drift on how they encode the passenger mix.
+ *
+ * @param passengerInfo A `PassengerInfo`, or any duck-typed object exposing
+ *   some subset of `adults`/`children`/`infants_on_lap`/`infants_in_seat`
+ *   (missing ones count as zero). `null`/`undefined` is treated as an
+ *   all-zero mix.
+ * @returns One code per traveller, in field order. Falls back to `[1]` (a
+ *   single adult) when the mix would otherwise be empty.
+ * @throws {RangeError} Any count is not a non-negative integer, or the
+ *   total exceeds {@link MAX_TOTAL_PASSENGERS}. Checked before building the
+ *   result array, so a wildly out-of-range count (a duck-typed
+ *   `adults: 1_000_000`, say) fails immediately instead of allocating an
+ *   array that size — callers that pass a validated `PassengerInfo` never
+ *   hit this; it exists for the duck-typed callers this function otherwise
+ *   tolerates.
+ */
+export function passengerCodes(passengerInfo: Partial<PassengerInfo> | null | undefined): number[] {
+  let total = 0;
+  const counts: Array<readonly [number, number]> = []; // [code, count]
+  for (const [field, code] of PASSENGER_FIELDS) {
+    const count = (passengerInfo as Partial<PassengerInfo> | null)?.[field] ?? 0;
+    if (!Number.isInteger(count) || count < 0) {
+      throw new RangeError(
+        `passengerInfo.${field} must be a non-negative integer, got ${JSON.stringify(count)}`,
+      );
+    }
+    total += count;
+    counts.push([code, count]);
+  }
+
+  if (total > MAX_TOTAL_PASSENGERS) {
+    throw new RangeError(
+      `passengerInfo totals ${total} travellers, over the ` +
+        `${MAX_TOTAL_PASSENGERS}-traveller limit Google's booking page enforces`,
+   
```

**File**: `fli-js/src/search/tfs.ts` (modified, +3/-27)
```diff
@@ -43,7 +43,7 @@ import type { Client } from "./client.ts";
 import { sleep, throwIfAborted } from "./concurrency.ts";
 import { SearchUnsupportedError } from "./exceptions.ts";
 import { getSearchLogger } from "./logging.ts";
-import { encodeTfsPayload, encodeTfsSegment, type LegSpec } from "./proto.ts";
+import { encodeTfsPayload, encodeTfsSegment, type LegSpec, passengerCodes } from "./proto.ts";
 
 /** Filter objects this transport can encode — both carry the same core fields. */
 export type TfsFilters = FlightSearchFilters | DateSearchFilters;
@@ -89,26 +89,6 @@ const DS_BLOB = /AF_initDataCallback\((\{[\s\S]*?\})\);/g;
 const DS_KEY = /key:\s*'([^']+)'/;
 const DS_DATA = /data:([\s\S]*?), sideChannel/;
 
-/**
- * Passenger kinds, in the order Google's repeated field 8 numbers them:
- * 1 = adult, 2 = child, 3 = infant on lap, 4 = infant in own seat.
- *
- * The two infant codes are easy to transpose and the mistake is expensive
- * rather than loud: on an international route a lap infant prices at ~10%
- * of the adult fare and an infant in its own seat at ~100%, so a swap
- * quotes a plausible but wrong fare instead of erroring. Pricing one fixed
- * itinerary (BA178 JFK->LHR, economy) confirms the mapping — $295 for
- * `[1]`, $324 for `[1, 3]` (+10%, lap), $589 for `[1, 4]` (+100%, own
- * seat, same as the `[1, 2]` child fare). The legacy RPC struct orders the
- * same four counts `[adults, children, infants_on_lap, infants_in_seat]`.
- */
-const PASSENGER_FIELDS = [
-  ["adults", 1],
-  ["children", 2],
-  ["infants_on_lap", 3],
-  ["infants_in_seat", 4],
-] as const;
-
 /**
  * Filters with no `tfs` encoding and no reliable post-hoc equivalent —
  * the decoded rows don't carry the data needed to apply them locally.
@@ -182,11 +162,7 @@ export function buildTfs(filters: TfsFilters, options: BuildTfsOptions = {}): st
 
   const travelDates = options.travelDates ?? null;
   const stops = filters.stops;
-  const passengers: number[] = [];
-  for (const [field, code] of PASSENGER_FIELDS) {
-    const count = filters.passenger_info[field] ?? 0;
-    for (let i = 0; i < count; i++) passengers.push(code);
-  }
+  const passengers = passengerCodes(filters.passenger_info);
 
   // Google reads alliances out of the same carrier lists as airline codes.
   const carriers = (filters.alliances ?? []).map((a) => String(a));
@@ -231,7 +207,7 @@ export function buildTfs(filters: TfsFilters, options: BuildTfsOptions = {}): st
 
   return encodeTfsPayload(segments, {
     isOneWay: filters.trip_type === TripType.ONE_WAY,
-    passengers: passengers.length > 0 ? passengers : [1],
+    passengers,
     seat: filters.seat_type,
   });
 }
```

---

### Incident Patch 5: `74fa5506` (2026-09-20)
**Commit Message**: fix(search): a date sweep that mostly failed to load raises instead of reporting no dates (#249)

* fix(search): raise on a date sweep that mostly failed to load

_collect only raised when every attempted date failed or the circuit
breaker tripped. Neither condition catches a sweep like "1 loaded empty,
29 timeouts": the breaker disarms for good the instant any page loads,
even an empty one, so it never trips — and the sweep returns None, which
the CLI/MCP report as "no flights found" on the strength of one date out
of thirty.

Raise instead when nothing priced and at least half the attempted dates
never loaded (failed >= loaded). The error class follows the existing
rule (SearchParseError only when every failure is the no-payload one),
but the branch never adds the FLI_SOCS_COOKIE hint: a page did load,
which rules out a consent wall.

Also: a sweep with a minority of load failures no longer ends quietly
either way — it logs exactly one summary warning, whether it returns
partial results or an empty range, so a caller can tell a complete sweep
from a merely lucky one.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

* fix(js): mirror the mostly-failed date sweep raise in

**File**: `CLAUDE.md` (modified, +7/-0)
```diff
@@ -157,6 +157,13 @@ Consequences to keep in mind when changing search code:
   the bound scales with `configure_concurrency`.
   When it trips but prices still come back, `_collect` emits exactly one
   warning naming the skipped count: a truncated answer must never be silent.
+- The breaker alone can't catch "1 loaded, 29 timeouts" — one loaded page,
+  even empty, disarms it for good. So `_collect` also raises when 0 priced
+  and at least half the attempted dates never loaded (`failed >= loaded`),
+  without the `FLI_SOCS_COOKIE` hint (a page did load, so it isn't a consent
+  wall). A minority of load failures with 0 results still returns `None`;
+  a minority alongside partial results still returns those results; both
+  log exactly one summary warning naming the counts.
 - ~1 page in 60 arrives HTTP 200 with no `ds:1` blob. `fetch_payload` in
   `fli/search/_tfs.py` is the single fetch path for both flights and dates and
   retries exactly that case (`PAGE_FETCH_ATTEMPTS`, `PAGE_RETRY_BACKOFF`);
```

**File**: `README.md` (modified, +7/-1)
```diff
@@ -197,7 +197,13 @@ What that means in practice:
   own retries multiply in) and about 4 seconds, the same whether the range is 30
   days or 93. Unbroken, a 93-date range would have cost 279 fetches and up to
   837 requests. The bound is `(5 + worker count) x 3`, so raising
-  `configure_concurrency` raises it proportionally.
+  `configure_concurrency` raises it proportionally. That breaker disarms for
+  good the moment any page loads, even an empty one, so it cannot catch a
+  sweep that is mostly timeouts around one lucky date — `SearchDates.search`
+  raises that case too, whenever nothing priced and at least half the
+  attempted dates never loaded. A minority of failures alongside real
+  results, or alongside a confirmed-empty range (`None`), still returns
+  normally but logs one warning naming the counts.
 * **A page occasionally arrives without results.** Roughly one request in sixty
   returns HTTP 200 with no `ds:1` blob; the client retries that case up to twice
   (0.5s then 1.5s) before raising `SearchParseError`. A healthy search never
```

**File**: `docs/typescript/quickstart.md` (modified, +6/-1)
```diff
@@ -239,7 +239,12 @@ What that means in practice:
   all of them. Ten dates are in flight at once, so around fourteen are
   attempted first — about 42 page fetches, whether the range is 30, 61 or
   93 days. One that was cut short but found prices returns them with a
-  warning.
+  warning. That breaker disarms for good the moment any page loads, even
+  an empty one, so it cannot catch a sweep that is mostly timeouts around
+  one lucky date — `search` throws that case too, whenever nothing priced
+  and at least half the attempted dates never loaded. A minority of
+  failures alongside real results, or alongside a confirmed-empty range,
+  still returns normally but logs one warning naming the counts.
 * **A page occasionally arrives without results.** Roughly one request in
   sixty returns HTTP 200 with no `ds:1` blob; the client retries that case
   up to twice (0.5s then 1.5s) before throwing `SearchParseError`.
```

**File**: `fli-js/README.md` (modified, +8/-1)
```diff
@@ -135,7 +135,14 @@ What that means in practice:
   is 30, 61 or 93 days). Only pages served without results count towards that:
   a timeout or a dropped connection says nothing about the dates not yet tried,
   so those never abandon a sweep. A sweep cut short that still found prices
-  returns them with one warning saying so.
+  returns them with one warning saying so. The breaker itself disarms for
+  good the moment any page loads, even an empty one — so it cannot catch a
+  sweep that is mostly timeouts around one lucky date. `SearchDates.search`
+  throws that case too: if nothing priced and at least half the attempted
+  dates never loaded, that is not enough evidence to call the range
+  flight-free. A minority of failures alongside real results, or alongside
+  a confirmed-empty range, still returns normally but logs one warning
+  naming the counts.
 - **A page occasionally arrives without results.** Roughly one request in sixty
   returns HTTP 200 with no `ds:1` blob; the client retries that case up to twice
   (0.5s then 1.5s) before throwing `SearchParseError`. A healthy search never
```

**File**: `fli-js/src/search/dates.ts` (modified, +85/-8)
```diff
@@ -35,8 +35,12 @@ const DAY_MS = 24 * 60 * 60 * 1000;
 /**
  * Same wording the flight path uses for the same condition, so a caller
  * who sees it on either path gets the same hint about what to check.
+ *
+ * Exported (mirroring the Python module's `_NO_PAYLOAD`, importable despite
+ * the underscore) so tests can build `DateOutcome`s that exercise the
+ * no-payload branch of {@link SearchDates._collect} exactly.
  */
-const NO_PAYLOAD =
+export const NO_PAYLOAD =
   "the search page carried no ds:1 payload — Google may have changed the " +
   "page shape, or served a consent/blocked page instead";
 
@@ -214,6 +218,23 @@ function flightsIn(payload: unknown): FlightResult[] {
   return flights;
 }
 
+/**
+ * Up to 3 distinct failure messages, in the order they were first seen.
+ *
+ * Shared by every `_collect` branch that raises or warns about failed
+ * dates, so the same range always gets the same short list however it is
+ * reported.
+ */
+function reasonsFor(failed: DateOutcome[]): string[] {
+  const reasons: string[] = [];
+  for (const o of failed) {
+    if (o.failure != null && !reasons.includes(o.failure) && reasons.length < 3) {
+      reasons.push(o.failure);
+    }
+  }
+  return reasons;
+}
+
 export class SearchDates {
   /**
    * @deprecated Kept only so the exported surface does not move. The
@@ -252,7 +273,9 @@ export class SearchDates {
    *   {@link MAX_DATES_PER_SEARCH} dates.
    * @throws {SearchParseError} Every date came back without a payload —
    *   a consent or block page, not an empty route.
-   * @throws {SearchClientError} Every date failed for some other reason.
+   * @throws {SearchClientError} Every date failed for some other reason,
+   *   or nothing priced because at least half the attempted dates never
+   *   loaded — see {@link SearchDates._collect}.
    */
   async search(
     filters: DateSearchFilters,
@@ -329,6 +352,20 @@ export class SearchDates {
    * either. With prices to show, the answer is real but incomplete, so it
    * comes with one warning naming the count.
    *
+   * The breaker is not the only way a sweep can go quietly wrong, though:
+   * it disarms for good the instant any page loads, empty or not, so "1
+   * loaded, 29 timeouts" sails straight past it — one date out of thirty
+   * is not enough evidence that a route has no flights. When nothing
+   * priced and at least half the attempted dates never loaded (`failed
+   * >= loaded`), that is raised too. A page did load in that case, which
+   * rules out an EU/EEA consent wall — those block every request alike —
+   * so this path never adds the `FLI_SOCS_COOKIE` hint the branch above
+   * does.
+   *
+   * Short of either throw, a sweep that lost some dates but not enough to
+   * doubt the rest still owes the caller exactly one line saying so,
+   * whether or not it ends up with anything to return.
+   *
    * Internal — underscore-prefixed rather than `private` so tests can
    * drive it with a fixed set of outcomes instead of racing the sweep's
    * concurrent fetches into the state they want to assert.
@@ -342,19 +379,19 @@ export class SearchDates {
     const results = outcomes.flatMap((o) => (o.price != null ? [o.price] : []));
     const attempted = outcomes.filter((o) => o.attempted);
     const failed = attempted.filter((o) => o.failure != null);
+    // "loaded" counts every attempted date whose page actually arrived,
+    // priced or not — it does not distinguish the two, because when
+    // `results` is empty (the only time this number matters below) every
+    // loaded date is by definition one with no flights.
+    const loaded = attempted.length - failed.length;
     // The breaker only ever trips on payload-less pages, so a non-zero
     // skip count *is* the blocked-page diagnosis, whatever else failed
     // alongside.
     const tripped = skipped > 0;
     const everythingFailed = attempted.length > 0 && failed.length === attempted.length;
 
     if (results.length === 0 
```

---

### Incident Patch 6: `b37dc1d8` (2026-09-20)
**Commit Message**: fix(search): decode wrb.fr chunks by JSON grammar, and surface Google's error envelopes (#224)

* fix(search): decode wrb.fr chunks by JSON grammar and surface error envelopes

Two independent defects in the batchexecute reader, both of which end as
"No flights found" for the user.

1. Chunk framing broke on non-ASCII responses.

   iter_wrb_chunks trusted the decimal length header preceding each chunk
   and sliced the body by that many UTF-8 bytes. Google counts the chunk
   plus its two surrounding newlines in *characters*, so the two agree
   only while the response is pure ASCII — which every checked-in fixture
   happens to be. Add one accented airport name and the reader slices
   short: the chunk fails to parse and is discarded, the cursor lands
   mid-JSON, and the stream is truncated with "Malformed length header at
   offset N". A Paris-New York search returns nothing at all.

   Rather than swap one guess about Google's convention for another, stop
   using the header as a frame delimiter: json.JSONDecoder.raw_decode
   locates the end of each chunk exactly, under either convention. The
   headers are still used to re-synchronise after an unparseable chunk, so
   the pr

**File**: `fli/search/_wire.py` (modified, +268/-69)
```diff
@@ -3,20 +3,29 @@
 The Service returns JSONP-flavoured responses of the form::
 
     )]}'\n\n
-    <chunk1_byte_len>\n
+    <chunk1_len>\n
     [["wrb.fr", null, "<inner JSON string>"]]
-    <chunk2_byte_len>\n
+    <chunk2_len>\n
     [["wrb.fr", null, "<inner JSON string>"]]
     ...
 
 `GetShoppingResults` and `GetCalendarGraph` happen to emit a single chunk so
 the legacy parsers in this package could get away with `lstrip(")]}'")`.
 `GetBookingResults` emits two chunks, so we need a proper multi-chunk reader.
+Since the flight/date searches moved to the public page transport
+(:mod:`fli.search._tfs`), `SearchFlights.get_booking_options` is the only
+live consumer of this module.
 
-Important quirk: the length headers count UTF-8 **bytes**, not Python string
-characters. When the response contains any non-ASCII characters (which it
-sometimes does — airport names, airline names) the offsets diverge, so the
-reader must operate over the byte representation of the body.
+Important quirk: the length headers are **not** a dependable frame
+delimiter. They count the chunk plus its two surrounding newlines, but in
+characters rather than UTF-8 bytes, so any response carrying non-ASCII text
+(accented airport or airline names) desynchronises a byte-oriented reader —
+and an ASCII response hides the difference entirely. Rather than encode a
+guess about Google's convention, this reader ignores the announced length
+and lets the JSON grammar delimit each chunk, which is correct either way.
+The headers' *positions* are still used — to re-synchronise after a
+malformed chunk, and to bound each decode to one chunk's worth of text —
+but their values never are.
 
 This module centralises that reader and exposes :func:`iter_wrb_chunks` which
 yields the decoded inner JSON of each ``wrb.fr`` chunk.
@@ -26,78 +35,261 @@
 
 import json
 import logging
+import re
 from collections.abc import Iterator
-from typing import Any
+from typing import Any, NamedTuple
+
+from fli.search.exceptions import _GRPC_STATUS_NAMES, SearchRejectedError
 
 logger = logging.getLogger(__name__)
 
-_PREFIX = b")]}'"
+_PREFIX = ")]}'"
+
+# Framing noise between two chunks: the length header and the newlines
+# around it. Skipped wholesale — the header's value is never trusted.
+_FRAMING_CHARS = "0123456789 \t\r\n"
+
+# A chunk boundary in the raw stream: line break, decimal length header,
+# line break, then the "[" that opens the next chunk. CRLF is accepted so
+# a CRLF-framed body gets the same bounded decode as an LF-framed one —
+# but only as the trailing ``\r?``. A CRLF ends in "\n", so anchoring the
+# pattern on a literal "\n" still matches "\r\n<digits>\r\n[" (one
+# character later, which only leaves the "\r" in the window as trailing
+# whitespace the decoder ignores) while keeping the engine's literal-prefix
+# scan. Spelling the first break "\r?\n" instead costs it: a 20 MB body
+# went from 61 ms to 172 ms purely on that.
+#
+# This pattern cannot occur inside a well-formed JSON document, so the
+# next match is always at or after the current chunk's end. CR and LF are
+# both illegal unescaped inside a JSON string, so the digits would have to
+# be a number token surrounded by whitespace — and a number followed by
+# "[" with only whitespace between them is not valid JSON in any container
+# (an array needs a comma, an object a comma or colon, and a top-level
+# document ends after its one value). That makes the match position a safe
+# upper bound for where the current chunk ends, which is what lets the
+# decode below work on a bounded window. Only the header's *position* is
+# used; its value is still never trusted.
+# ``TestChunkBoundaryCannotSplitAValue`` enumerates the claim.
+_CHUNK_BOUNDARY = re.compile(r"\n\d+\r?\n(?=\[)")
+
+# Error details are echoed into the exception message, so cap them.
+_MAX_DETAIL_CHARS = 200
+
+# A body of nothing but bad chunks would otherwise emit one warning per
+# chunk. Warn on the first few, then say how 
```

**File**: `fli/search/exceptions.py` (modified, +42/-4)
```diff
@@ -30,6 +30,29 @@ def __init__(self, message: str, *, status_code: int | None = None):
         self.status_code = status_code
 
 
+# Google reports a rejected request with gRPC's canonical status codes, so
+# the bare number can be named instead of left for the reader to look up.
+_GRPC_STATUS_NAMES = {
+    0: "OK",
+    1: "CANCELLED",
+    2: "UNKNOWN",
+    3: "INVALID_ARGUMENT",
+    4: "DEADLINE_EXCEEDED",
+    5: "NOT_FOUND",
+    6: "ALREADY_EXISTS",
+    7: "PERMISSION_DENIED",
+    8: "RESOURCE_EXHAUSTED",
+    9: "FAILED_PRECONDITION",
+    10: "ABORTED",
+    11: "OUT_OF_RANGE",
+    12: "UNIMPLEMENTED",
+    13: "INTERNAL",
+    14: "UNAVAILABLE",
+    15: "DATA_LOSS",
+    16: "UNAUTHENTICATED",
+}
+
+
 class SearchRejectedError(SearchClientError):
     """Google answered HTTP 200 but declined to serve results.
 
@@ -39,17 +62,32 @@ class SearchRejectedError(SearchClientError):
     over the exact request bytes, so a plain HTTP client always lands here.
     Without this error the caller saw an empty list and reported "no
     flights found", which is indistinguishable from a route with no service.
+
+    A richer rejection carries a status message and/or a ``google.rpc``-style
+    detail block after the code, kept verbatim (truncated) in ``detail`` —
+    the code alone is often too coarse to debug with. An ``INTERNAL`` (13),
+    for instance, can mean either "Google declined to serve this" or "a
+    required request header was missing", and only the detail tells the two
+    apart.
     """
 
-    def __init__(self, code: int | None = None):
-        """Record the numeric error code alongside the user-facing message."""
+    def __init__(self, code: int | None = None, *, detail: str | None = None):
+        """Record the status code, its gRPC name and any detail block."""
         self.code = code
-        suffix = f" (error {code})" if code is not None else ""
-        super().__init__(
+        self.detail = detail
+        self.status_name = _GRPC_STATUS_NAMES.get(code) if code is not None else None
+        named = f"{code} ({self.status_name})" if self.status_name else code
+        # ``0`` is gRPC's OK, so there is no error number to name — it reads
+        # the same as no code at all rather than claiming "error 0".
+        suffix = f" with error {named}" if code else ""
+        message = (
             f"Google Flights declined the request{suffix} and returned no data. "
             "Its API now requires a browser-signed x-goog-batchexecute-bgr header, "
             "which this client cannot produce. See github.com/punitarani/fli#223."
         )
+        if detail:
+            message = f"{message} Details: {detail}"
+        super().__init__(message)
 
 
 class SearchUnsupportedError(SearchClientError):
```

**File**: `tests/search/test_booking_options.py` (modified, +93/-0)
```diff
@@ -253,6 +253,99 @@ def _fake_post(url, data, **kwargs):  # noqa: ANN001
         assert opts == []
 
 
+class TestGetBookingOptionsRejectionEnvelope:
+    """A declined booking call must not read as "no bookable fares".
+
+    Google answers a request it refuses with ``HTTP 200`` and a payload-less
+    ``wrb.fr`` row carrying a gRPC status. That used to yield zero chunks,
+    which is indistinguishable from an itinerary nobody sells — so the wire
+    reader raises :class:`SearchRejectedError` instead, and it has to reach
+    the caller through ``get_booking_options`` unchanged.
+    """
+
+    @staticmethod
+    def _canned(body: str):
+        """Return a client plus a patch making its booking POST answer ``body``.
+
+        ``sf.client`` is a process-wide singleton, so the patch is handed
+        back as a context manager rather than started here — a leaked patch
+        feeds this canned body to every later test.
+        """
+        from unittest.mock import patch
+
+        def _fake_post(url, data, **kwargs):  # noqa: ANN001
+            return type(
+                "R",
+                (),
+                {
+                    "content": body.encode("utf-8"),
+                    "text": body,
+                    "raise_for_status": lambda self: None,
+                },
+            )()
+
+        sf = SearchFlights()
+        sf._last_session_id = "S"
+        return sf, patch.object(sf.client, "post", side_effect=_fake_post)
+
+    def test_error_envelope_raises_instead_of_returning_no_options(self):
+        """HTTP 200 + error envelope surfaces the status code, not an empty list."""
+        from fli.search import SearchRejectedError
+
+        body = ")]}'\n\n" + json.dumps(
+            [
+                ["wrb.fr", None, None, None, None, [13]],
+                ["di", 39],
+                ["af.httprm", 38, "-1963517503", 5],
+            ]
+        )
+        filters = _round_trip_filters()
+        flight = filters.flight_segments[1].selected_flight
+        sf, patcher = self._canned(body)
+        with patcher, pytest.raises(SearchRejectedError, match=r"13 \(INTERNAL\)") as excinfo:
+            sf.get_booking_options(flight, filters, currency="USD")
+        assert excinfo.value.code == 13
+
+    def test_rejection_reaches_the_cli_and_mcp_friendly_messages(self, monkeypatch, tmp_path):
+        """The typed error stays classified, not an "unexpected error"."""
+        from fli.cli.errors import _friendly_message, json_error_payload
+        from fli.core.errors import classify_error
+        from fli.mcp.server import _search_error_message
+        from fli.search import SearchRejectedError
+
+        # ``json_error_payload`` writes a real traceback file. Send it to
+        # tmp_path instead of the user's ~/.fli/logs, the way the autouse
+        # fixture in tests/cli/test_errors.py does for the same helper.
+        log_dir = tmp_path / "fli-logs"
+        monkeypatch.setattr("fli.cli.errors._LOG_DIR", log_dir)
+
+        exc = SearchRejectedError(13, detail="req-abc123")
+        assert "declined the request" in _friendly_message(exc)
+        assert "Unexpected error" not in _friendly_message(exc)
+        assert "declined the request" in _search_error_message(exc)
+
+        # Both surfaces classify it through the shared classifier, so they
+        # have to agree — a rejection is deterministic and never retryable.
+        payload = json_error_payload(exc, command="flights")
+        assert payload.error_type == "rejected_error"
+        assert payload.retryable is False
+        mcp_fields = classify_error(exc).as_fields()
+        assert mcp_fields["error_type"] == "rejected_error"
+        assert mcp_fields["retryable"] is False
+
+        assert list(log_dir.iterdir()), "the log file should have landed under tmp_path"
+
+    def test_genuinely_empty_response_still_returns_no_options(self):
+        """A well-formed response with no vendor rows keeps returning []."""
+        in
```

**File**: `tests/search/test_wire.py` (modified, +695/-12)
```diff
@@ -1,10 +1,12 @@
 """Tests for the wire-format parser shared by all FlightsFrontendService responses."""
 
 import json
+import logging
+import time
 
 import pytest
 
-from fli.search._wire import iter_wrb_chunks, parse_first_wrb_payload
+from fli.search._wire import _CHUNK_BOUNDARY, iter_wrb_chunks, parse_first_wrb_payload
 from fli.search.exceptions import SearchRejectedError
 
 
@@ -16,20 +18,22 @@ def _single_chunk(payload):
 
 
 def _multi_chunk(*payloads):
-    """Build a multi-chunk response with explicit length prefixes.
+    """Build a multi-chunk response with byte-counted length prefixes.
 
-    Mirrors Google's actual format: each length header counts both the
-    leading newline that follows the header AND the trailing newline that
-    separates this chunk from the next (i.e. ``len(outer_json) + 1``).
+    Each length header counts the chunk plus its two surrounding newlines,
+    measured in UTF-8 bytes. Google measures in characters instead (see
+    :func:`_google_framed`); both helpers exist so the reader is pinned as
+    working under either convention.
+
+    ``json.dumps`` escapes non-ASCII by default, so the bodies this builds
+    are pure ASCII and the two counts coincide in them. The byte count is
+    exercised against a genuinely multi-byte body in
+    ``TestNonAsciiFraming.test_byte_counted_framing_of_the_same_body_also_parses``.
     """
     parts = [")]}'\n\n"]
     for p in payloads:
         inner_json = json.dumps(p, separators=(",", ":"))
         outer_json = json.dumps([["wrb.fr", None, inner_json]], separators=(",", ":"))
-        # The length header counts UTF-8 BYTES (not Python str chars) plus
-        # the two surrounding newlines. Encoding the JSON before measuring
-        # keeps the test correct when payloads contain non-ASCII characters
-        # like accented airport names or Japanese carrier strings.
         byte_len = len(outer_json.encode("utf-8")) + 2
         parts.append(f"{byte_len}\n{outer_json}\n")
     return "".join(parts)
@@ -60,9 +64,7 @@ def test_handles_malformed_inner_json_gracefully(self):
         assert list(iter_wrb_chunks(body)) == []
 
     def test_non_ascii_chunk_payload(self):
-        # The length header counts UTF-8 bytes, not characters — confirm a
-        # payload with multi-byte chars round-trips correctly (regression
-        # guard for the byte-vs-char-length bug in the test helper).
+        # Multi-byte payloads round-trip under the byte-counted framing.
         body = _multi_chunk([1, "東京", "café", "résumé"])
         chunks = list(iter_wrb_chunks(body))
         assert chunks == [[1, "東京", "café", "résumé"]]
@@ -146,6 +148,687 @@ def test_skips_invalid_inner_to_find_second_valid_chunk(self):
         assert parse_first_wrb_payload(body) == [42]
 
 
+def _google_framed(*payloads: object) -> str:
+    """Build a multi-chunk response framed the way Google actually frames it.
+
+    Measured on a live August 2026 ``GetShoppingResults`` response whose
+    airport names carry accents: the length header counts the chunk *plus
+    its two surrounding newlines*, in **characters**. On an ASCII-only
+    response that is indistinguishable from a byte count, which is why the
+    checked-in fixtures never exercised the difference.
+    """
+    parts = [")]}'\n\n"]
+    for p in payloads:
+        inner_json = json.dumps(p, separators=(",", ":"), ensure_ascii=False)
+        outer_json = json.dumps(
+            [["wrb.fr", None, inner_json]], separators=(",", ":"), ensure_ascii=False
+        )
+        parts.append(f"{len(outer_json) + 2}\n{outer_json}\n")
+    return "".join(parts)
+
+
+def _error_envelope(code: int) -> str:
+    """Build the HTTP 200 error envelope Google returns for a rejected request."""
+    outer = [
+        ["wrb.fr", None, None, None, None, [code]],
+        ["di", 39],
+        ["af.httprm", 38, "-1963517503", 5],
+    ]
+    return ")]}'\n\n" + json.dumps(outer, separators=(",", ":"))
+
+
+def _error_status_row(s
```

---

### Incident Patch 7: `787db0e7` (2026-09-20)
**Commit Message**: fix(js): restore search in fli-js via the public search page (port of #230) (#247)

* refactor(js): share one tfs encoder between deep links and searches

`buildTfsToken` wrote the `tfs` message inline, so the search-page
transport landing next would have had to fork a second encoder for the
same bytes. Split the segment and envelope writers out as
`encodeTfsSegment` / `encodeTfsPayload` — mirroring the Python
`fli/search/_proto.py` split — and rebuild `buildTfsToken` on top of
them.

The new segment writer carries the fields a search needs and a deep link
does not: the zero-based stop ceiling (field 5), carrier include/exclude
lists (6/7, which also carry alliance names), layover airports (15) and
layover bounds (17/18). The envelope writer takes one field-8 entry per
traveller instead of a hardcoded single adult.

Pinned against the `tfs` values Google itself issued for the same
queries — the same captures `tests/search/test_tfs.py` uses — and against
the existing deep-link captures, which are unchanged byte-for-byte.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

* feat(js): complete the typed-error family and report RPC rejections

Three gaps the page transport need

**File**: `README.md` (modified, +7/-0)
```diff
@@ -531,6 +531,13 @@ const filters = new FlightSearchFilters({
 const results = await new SearchFlights().search(filters, { currency: "USD" });
 ```
 
+`fli-js` uses the same search-page transport as the Python package (see
+[Search transport](#search-transport) above), with the same consequences:
+`emissions` / `bags` / `exclude_basic_economy` are dropped with a warning,
+multi-city throws `SearchUnsupportedError`, `getBookingOptions` throws
+`SearchRejectedError`, date searches cost one page fetch per date and are
+capped at 93, and `FLI_SOCS_COOKIE` controls the consent cookie.
+
 The TypeScript source lives in [`fli-js/`](fli-js); see the
 [TypeScript Quick Start](https://punitarani.github.io/fli/typescript/quickstart/)
 for the full guide.
```

**File**: `docs/typescript/examples.md` (modified, +21/-0)
```diff
@@ -35,6 +35,14 @@ On Node, run through a TypeScript loader: `npx tsx basic_one_way_search.ts`.
 
 ## Multi-city
 
+!!! warning "Not available through the current transport"
+    Google loads multi-city results client-side through the RPC it gated
+    in 2026-08, so the search page carries no rows to read.
+    `search(...)` throws `SearchUnsupportedError` for
+    `TripType.MULTI_CITY` rather than returning the first leg's one-way
+    board, which would decode cleanly into wrong results. Search each leg
+    separately for now. The example below is kept for when that changes.
+
 ```ts
 import {
   Airport,
@@ -78,9 +86,12 @@ for (const legs of itineraries ?? []) {
 
 ```ts
 import {
+  SearchClientError,
   SearchConnectionError,
   SearchHTTPError,
+  SearchParseError,
   SearchTimeoutError,
+  SearchUnsupportedError,
 } from "fli-js";
 
 try {
@@ -92,10 +103,20 @@ try {
     // network/proxy problem
   } else if (err instanceof SearchHTTPError) {
     // non-2xx from Google
+  } else if (err instanceof SearchParseError) {
+    // the page loaded but carried no readable results — a consent or
+    // block page, or a change in Google's page shape
+  } else if (err instanceof SearchUnsupportedError) {
+    // the current transport cannot serve this query (multi-city)
   } else {
     throw err;
   }
 }
 ```
 
+All of the above extend `SearchClientError`, so `catch (err) { if (err
+instanceof SearchClientError) … }` covers "the search failed" in one
+branch. A search that simply found nothing returns `null` instead of
+throwing.
+
 See the [Python examples](../python/examples.md) for the equivalent scripts.
```

**File**: `docs/typescript/quickstart.md` (modified, +66/-4)
```diff
@@ -131,8 +131,14 @@ for (const { date, price } of dates ?? []) {
 ```
 
 `DatePrice.date` is a tuple of `Date` objects: `[outbound]` for one-way,
-`[outbound, return]` for round trips. Ranges larger than 61 days are split
-into multiple calls automatically.
+`[outbound, return]` for round trips.
+
+!!! warning "One page fetch per date"
+    Google's search page carries no calendar grid, so every date in the
+    range costs its own full page fetch (~2 MB). A single
+    `SearchDates.search` prices at most **93 dates**
+    (`MAX_DATES_PER_SEARCH`); a wider range throws `RangeError`. See
+    [Search transport](#search-transport).
 
 ## Filters, alliances, and locale
 
@@ -193,8 +199,64 @@ const search = new SearchFlights(client);
 ```
 
 Typed errors — `SearchTimeoutError`, `SearchConnectionError`,
-`SearchHTTPError`, all extending `SearchClientError` — let you branch on
-failure mode.
+`SearchHTTPError`, `SearchParseError`, `SearchRejectedError` and
+`SearchUnsupportedError`, all extending `SearchClientError` — let you
+branch on failure mode.
+
+## Search transport
+
+Searches are served by Google's public search page rather than the
+`FlightsFrontendService` RPC. Since 2026-08 `GetShoppingResults` and
+`GetCalendarGraph` require an `x-goog-batchexecute-bgr` header that only
+the page's own JavaScript can produce, so a plain HTTP client gets HTTP
+200 with no payload. `fli-js` issues
+`GET https://www.google.com/travel/flights?tfs=<protobuf>` instead and
+reads the results out of the page's inline `AF_initDataCallback` blob
+keyed `ds:1`. This matches the Python library, which moved the same way.
+
+What that means in practice:
+
+* **Three filters are not supported.** `emissions`, `bags` and
+  `exclude_basic_economy` have no `tfs` field and cannot be reconstructed
+  from the decoded rows, so they are dropped with a warning. Stops,
+  cabin, passengers, alliances and layover bounds ride in the request;
+  airline include/exclude, price cap, max duration and departure windows
+  are applied to the results after fetching, and `sort_by` orders them
+  afterwards (`TOP_FLIGHTS` / `BEST` keep Google's own ranking).
+* **Multi-city throws `SearchUnsupportedError`.** Google loads those
+  results client-side through the gated RPC, so the page carries no rows
+  to read. Search each leg separately.
+* **`getBookingOptions` is unavailable.** It calls `GetBookingResults`,
+  which is gated the same way, and currently throws
+  `SearchRejectedError`. `buildFlightBookingUrl` is built offline from
+  the itinerary and still works.
+* **Fewer rows per search.** Expect roughly 20–45 itineraries, fewer than
+  the old RPC returned — and a client-side filter cannot back-fill the
+  list the way Google's server-side one did.
+* **Date searches cost one page fetch per date**, capped at 93 dates. A
+  sweep that never loads a single page stops once five dates have come
+  back payload-less and throws, rather than paying the retry budget on
+  all of them. Ten dates are in flight at once, so around fourteen are
+  attempted first — about 42 page fetches, whether the range is 30, 61 or
+  93 days. One that was cut short but found prices returns them with a
+  warning.
+* **A page occasionally arrives without results.** Roughly one request in
+  sixty returns HTTP 200 with no `ds:1` blob; the client retries that case
+  up to twice (0.5s then 1.5s) before throwing `SearchParseError`.
+* **`FLI_SOCS_COOKIE`.** EU/EEA IPs are redirected to Google's consent
+  interstitial, which serves no `ds:1` blob. The client sends a
+  pre-accepted `SOCS` consent cookie by default; set `FLI_SOCS_COOKIE` to
+  change the value, or to an empty string to send none.
+
+Warnings (dropped filters, a sweep cut short) go to `console.warn`.
+Redirect or silence them with `setSearchLogger`:
+
+```ts
+import { setSearchLogger } from "fli-js";
+
+setSearchLogger({ warn: (m) => myLogger.warn(m), debug: () => {} });
+setSearchLogger(null); // back to console.warn
+```
 
 #
```

**File**: `examples/python/multi_city_search.py` (modified, +10/-0)
```diff
@@ -1,6 +1,16 @@
 #!/usr/bin/env python3
 """Multi-city flight search example.
 
+CURRENTLY UNAVAILABLE. Since 2026-08 searches are served by Google's
+public ``/travel/flights`` page rather than the ``GetShoppingResults``
+RPC, which now requires a browser-signed header. Google loads multi-city
+results client-side through that same gated RPC, so the page carries no
+flight rows to read — :meth:`SearchFlights.search` raises
+``SearchUnsupportedError`` rather than returning the first leg's one-way
+board, which would decode cleanly into wrong results. Search each leg
+separately for now. This example is kept for when that changes; see
+github.com/punitarani/fli#223.
+
 This example demonstrates how to search a multi-city itinerary (three or
 more one-way legs on different dates) in a single request. Multi-city
 results come back as tuples of ``FlightResult`` — one entry per leg, in
```

**File**: `examples/typescript/multi_city_search.ts` (modified, +10/-0)
```diff
@@ -1,6 +1,16 @@
 /**
  * Multi-city itinerary search (three legs on different dates).
  *
+ * CURRENTLY UNAVAILABLE. Since 2026-08 searches are served by Google's
+ * public `/travel/flights` page rather than the `GetShoppingResults` RPC,
+ * which now requires a browser-signed header. Google loads multi-city
+ * results client-side through that same gated RPC, so the page carries no
+ * flight rows to read — `search()` raises `SearchUnsupportedError` rather
+ * than returning the first leg's one-way board, which would decode
+ * cleanly into wrong results. Search each leg separately for now. This
+ * example is kept for when that changes; see
+ * https://github.com/punitarani/fli#223.
+ *
  * Mirrors examples/python/multi_city_search.py. Results come back as an
  * array of itineraries, each itinerary an array of FlightResult — one per
  * leg, in order. Run with:
```

---

### Incident Patch 8: `9bab6a86` (2026-09-20)
**Commit Message**: fix(mcp): keep the " (CODE)" enum-uniqueness suffix out of flight results (#245)

#160 made every Airport/Airline Enum value unique by suffixing shared names
with " (CODE)", and hid that suffix from the CLI and from `find_airports`.
The MCP flight serializer was missed: it put the raw Enum members into each
leg, so tool responses read "Naha Airport (OKA)" / "Wizz Air (W4)" for the 104
affected names, next to a separate code field.

Serialize leg airports and airline through `display_name`. The serializer is
duck-typed, so anything that is not an Airport/Airline member passes through
unchanged (covered by a test, after the first attempt broke 24 existing tests
that use string-valued test doubles).

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `fli/mcp/server.py` (modified, +14/-3)
```diff
@@ -35,12 +35,14 @@
 )
 from fli.core.parsers import ParseError
 from fli.models import (
+    Airline,
     Airport,
     BagsFilter,
     DateSearchFilters,
     FlightSearchFilters,
     PassengerInfo,
     TripType,
+    display_name,
 )
 from fli.search import SearchDates, SearchFlights
 from fli.search.dates import MAX_DATES_PER_SEARCH
@@ -409,15 +411,24 @@ def _flight_idents(flight: Any) -> list[str]:
     return [f"{_airline_code(leg.airline)}{leg.flight_number}" for leg in _flight_legs(flight)]
 
 
+def _plain_name(value: Any) -> Any:
+    """Return an airport/airline's display name without the internal `` (CODE)`` suffix.
+
+    Legs are duck-typed here (tests and callers may pass plain strings), so
+    anything that is not an ``Airport``/``Airline`` member passes through as is.
+    """
+    return display_name(value) if isinstance(value, Airport | Airline) else value
+
+
 def _serialize_flight_leg(leg: Any) -> dict[str, Any]:
     """Serialize a single flight leg to a dictionary."""
     out: dict[str, Any] = {
-        "departure_airport": leg.departure_airport,
-        "arrival_airport": leg.arrival_airport,
+        "departure_airport": _plain_name(leg.departure_airport),
+        "arrival_airport": _plain_name(leg.arrival_airport),
         "departure_time": leg.departure_datetime,
         "arrival_time": leg.arrival_datetime,
         "duration": leg.duration,
-        "airline": leg.airline,
+        "airline": _plain_name(leg.airline),
         "airline_code": _airline_code(leg.airline),
         "flight_number": leg.flight_number,
     }
```

**File**: `tests/mcp/test_leg_display_names.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+"""MCP flight results must show plain airport/airline names.
+
+Names shared by several airports or airlines are stored with an internal
+`` (CODE)`` suffix so every Enum value stays unique. That suffix must not leak
+into tool responses: the code is already returned in its own field.
+"""
+
+import json
+from datetime import datetime
+from enum import Enum
+
+from fli.mcp.server import _serialize_flight_leg as _serialize_leg
+from fli.models import Airline, Airport, FlightLeg
+
+
+def _leg(airline: Airline, origin: Airport, destination: Airport) -> FlightLeg:
+    return FlightLeg(
+        airline=airline,
+        flight_number="6012",
+        departure_airport=origin,
+        arrival_airport=destination,
+        departure_datetime=datetime(2026, 12, 15, 9, 25),
+        arrival_datetime=datetime(2026, 12, 15, 11, 55),
+        duration=150,
+    )
+
+
+def _as_json(payload: dict) -> dict:
+    """Round-trip the way an MCP client receives it (Enums collapse to their value)."""
+
+    def encode(value: object) -> object:
+        return value.value if isinstance(value, Enum) else value.isoformat()
+
+    return json.loads(json.dumps(payload, default=encode))
+
+
+def test_disambiguated_names_are_shown_without_their_code_suffix():
+    """OKA/NTL/W4 all carry an internal suffix; none of it reaches the response."""
+    assert Airport.OKA.value.endswith("(OKA)")  # guards the premise of this test
+    leg = _as_json(_serialize_leg(_leg(Airline.W4, Airport.OKA, Airport.NTL)))
+
+    assert leg["departure_airport"] == "Naha Airport"
+    assert leg["arrival_airport"] == "Newcastle Airport"
+    assert leg["airline"] == "Wizz Air"
+    assert leg["airline_code"] == "W4"
+
+
+def test_ordinary_names_are_unchanged():
+    """Names that were never ambiguous are returned exactly as before."""
+    leg = _as_json(_serialize_leg(_leg(Airline.BA, Airport.JFK, Airport.LHR)))
+
+    assert leg["departure_airport"] == Airport.JFK.value
+    assert leg["arrival_airport"] == Airport.LHR.value
+    assert leg["airline"] == Airline.BA.value
+
+
+def test_duck_typed_legs_with_plain_strings_pass_through():
+    """The serializer accepts leg-like objects whose names are already strings."""
+    from types import SimpleNamespace
+
+    leg = SimpleNamespace(
+        airline="Example Air",
+        flight_number="1",
+        departure_airport="Somewhere (XYZ)",
+        arrival_airport="Elsewhere",
+        departure_datetime=datetime(2026, 12, 15, 9, 25),
+        arrival_datetime=datetime(2026, 12, 15, 11, 55),
+        duration=150,
+    )
+    out = _as_json(_serialize_leg(leg))
+
+    assert out["departure_airport"] == "Somewhere (XYZ)"  # untouched: not an Enum member
+    assert out["airline"] == "Example Air"
```

---

### Incident Patch 9: `5c092f12` (2026-09-20)
**Commit Message**: fix(search): restore search via the public page's tfs parameter (#223) (#230)

* fix(search): restore search via the public page's tfs parameter (#223)

Google's FlightsFrontendService RPC endpoints have required an
x-goog-batchexecute-bgr header since early August. The page's own
JavaScript signs it over the exact request bytes, so a captured token
cannot be replayed against a different body. Both GetShoppingResults and
GetCalendarGraph now answer HTTP 200 with a payload-less wrb.fr row
carrying error 13, which parse_first_wrb_payload reads as None and the
CLI reports as "No flights found" — indistinguishable from a route with
no service. Every route returns count: 0.

The public /travel/flights page is not gated that way. It embeds the same
result payload in an AF_initDataCallback blob keyed ds:1, whose elements
[2] and [3] hold exactly the flight rows the RPC returned, so the
decoders, models, CLI and MCP surface all keep working unchanged. Only
the transport moves.

The page takes the tfs protobuf parameter rather than the f.req JSON
struct. build_tfs_token already encoded tfs for booking deep links, so
its field layout is now shared: encode_tfs_segment and encode_tfs_payload
s

**File**: `CLAUDE.md` (modified, +60/-4)
```diff
@@ -93,6 +93,53 @@ uv run mkdocs build         # Build static docs
 - **Shared Utilities**: Core parsing/building logic shared between CLI and MCP
 - **Validation**: Pydantic models ensure data integrity throughout
 
+## Search transport
+
+Searches go through Google's public search page, not the
+`FlightsFrontendService` RPC. Since 2026-08 `GetShoppingResults` and
+`GetCalendarGraph` require an `x-goog-batchexecute-bgr` header that only the
+page's JavaScript can produce, so the client issues
+`GET https://www.google.com/travel/flights?tfs=<protobuf>` and reads the
+`AF_initDataCallback` blob keyed `ds:1`. Request encoding lives in
+`fli/search/_tfs.py` and `fli/search/_proto.py`.
+
+Consequences to keep in mind when changing search code:
+
+- `emissions`, `bags` and `exclude_basic_economy` have no `tfs` field and no
+  post-hoc equivalent; `unsupported_filters()` names them and the caller warns.
+- Airline include/exclude, price cap, max duration and departure windows are
+  applied after fetching by `apply_client_side_filters()`; stops, cabin,
+  passengers, alliances and layover bounds are encoded into the request.
+- Multi-city raises `SearchUnsupportedError` — the page inlines no rows for it.
+- `get_booking_options` hits `GetBookingResults`, which is still gated, so it
+  currently raises `SearchRejectedError`. Booking deep links (`tfs`) are built
+  offline and unaffected.
+- A search returns fewer rows than the old RPC (~20-45), and client-side
+  filtering is not back-filled.
+- Date searches have no calendar grid: one page fetch per date, capped at
+  `fli.search.dates.MAX_DATES_PER_SEARCH` (93) per `SearchDates.search`. At the
+  cap that is several hundred MB of pages and parsed JSON at peak.
+- `_SweepHealth` (`SWEEP_FAILURE_THRESHOLD`, 5) is the sweep's circuit breaker.
+  It counts **only** payload-less pages — that failure is deterministic, so the
+  untried dates will fail the same way; a timeout or connection error says
+  nothing about them and deliberately does not count. It is armed only while no
+  date has loaded a page and disarmed permanently by the first success, so a
+  working sweep keeps the full retry budget for transient misses.
+  Measured with the real backoff, it turns a fully blocked 93-date sweep from
+  279 page fetches (up to 837 HTTP requests once the client's own retries
+  multiply) into 42 in ~4s, bounded at
+  (threshold + pool workers) x `PAGE_FETCH_ATTEMPTS` = 45 regardless of range —
+  the bound scales with `configure_concurrency`.
+  When it trips but prices still come back, `_collect` emits exactly one
+  warning naming the skipped count: a truncated answer must never be silent.
+- ~1 page in 60 arrives HTTP 200 with no `ds:1` blob. `fetch_payload` in
+  `fli/search/_tfs.py` is the single fetch path for both flights and dates and
+  retries exactly that case (`PAGE_FETCH_ATTEMPTS`, `PAGE_RETRY_BACKOFF`);
+  HTTP errors and error-13 rejections are not retried there.
+- `FLI_SOCS_COOKIE` overrides the pre-accepted `SOCS` consent cookie the client
+  sends so EU/EEA IPs skip Google's consent interstitial; set it empty to send
+  no cookie.
+
 ## Key Files and Entry Points
 
 - `fli/cli/main.py` - CLI entry point and command registration
@@ -150,6 +197,11 @@ Find cheapest travel dates within a range.
 Flights for that specific date (and return date for round trips).
 
 ### `get_booking_options`
+**Currently unavailable:** it calls `GetBookingResults`, which is gated behind
+the browser-signed header (see "Search transport"), so it raises
+`SearchRejectedError`. Use a flight's `booking_url` deep link instead. The rest
+of this section describes the tool for when that RPC becomes reachable again.
+
 Get bookable fares (vendor names, prices, and direct booking URLs) for a
 single itinerary. Runs a fresh search, selects the flight identified by
 `flight_numbers` (or the top result when omitted), then calls
@@ -185,10 +237,14 @@ one-line `Error: ...` and a non-zero exit code; the MCP to
```

**File**: `README.md` (modified, +50/-0)
```diff
@@ -157,6 +157,56 @@ fli --help
     * Comprehensive error handling
     * Input validation
 
+## Search transport
+
+Searches are served by Google's public search page rather than the
+`FlightsFrontendService` RPC. Since 2026-08 `GetShoppingResults` and
+`GetCalendarGraph` require an `x-goog-batchexecute-bgr` header that only the
+page's own JavaScript can produce, so a plain HTTP client gets HTTP 200 with no
+payload. Fli issues `GET https://www.google.com/travel/flights?tfs=<protobuf>`
+instead and reads the results out of the page's inline `AF_initDataCallback`
+blob keyed `ds:1`.
+
+What that means in practice:
+
+* **Three filters are not supported.** `emissions`, `bags` and
+  `exclude_basic_economy` have no `tfs` field and cannot be reconstructed from
+  the decoded rows, so they are dropped with a warning. Stops, cabin,
+  passengers, alliances and layover bounds ride in the request; airline
+  include/exclude, price cap, max duration and departure windows are applied to
+  the results after fetching.
+* **Multi-city raises `SearchUnsupportedError`.** Google loads those results
+  client-side through the gated RPC, so the page carries no rows to read.
+  Search each leg separately.
+* **`get_booking_options` is unavailable.** It calls `GetBookingResults`, which
+  is gated the same way, and currently raises `SearchRejectedError`. The
+  per-flight `tfs` booking deep links are built offline and still work.
+* **Fewer rows per search.** Expect roughly 20-45 itineraries, fewer than the
+  old RPC returned — and a client-side filter cannot back-fill the list the way
+  Google's server-side one did.
+* **Date searches cost one page fetch per date.** The page has no calendar
+  grid, so a range is priced date by date; one `SearchDates.search` covers at
+  most 93 dates and a wider range raises `ValueError`. Budget for it: 93 dates
+  across 10 workers is several hundred MB of pages and parsed JSON at peak.
+  A sweep that never manages to load a single page — the shape a blocked or
+  consent-gated client produces — gives up after a handful of dates rather than
+  paying the retry budget on all of them. Only pages served without results
+  count towards that: a timeout or a dropped connection says nothing about the
+  dates not yet tried, so those never abandon a sweep. Measured with the real backoff: **42
+  page fetches** (bounded at 45, so up to ~135 HTTP requests once the client's
+  own retries multiply in) and about 4 seconds, the same whether the range is 30
+  days or 93. Unbroken, a 93-date range would have cost 279 fetches and up to
+  837 requests. The bound is `(5 + worker count) x 3`, so raising
+  `configure_concurrency` raises it proportionally.
+* **A page occasionally arrives without results.** Roughly one request in sixty
+  returns HTTP 200 with no `ds:1` blob; the client retries that case up to twice
+  (0.5s then 1.5s) before raising `SearchParseError`. A healthy search never
+  pays for it.
+* **`FLI_SOCS_COOKIE`.** EU/EEA IPs are redirected to Google's consent
+  interstitial, which serves no `ds:1` blob. The client sends a pre-accepted
+  `SOCS` consent cookie by default; set `FLI_SOCS_COOKIE` to change the value,
+  or to an empty string to send none.
+
 ## CLI Usage
 
 ### Search for Flights
```

**File**: `docs/guides/mcp.md` (modified, +4/-4)
```diff
@@ -227,15 +227,15 @@ find out where (and at what price) a specific flight can be booked.
 | `infants_in_seat` | int | No | 0 | Number of infants (under 2) occupying their own seat |
 | `infants_on_lap` | int | No | 0 | Number of lap infants (under 2, no seat) — cannot exceed `passengers` |
 | `airlines` | list | No | null | Filter by airline codes (e.g., ['BA', 'AA']) |
-| `exclude_basic_economy` | bool | No | false | Exclude basic economy fares |
+| `exclude_basic_economy` | bool | No | false | Exclude basic economy fares. **Currently ignored by the search transport** (logged as a warning). |
 | `departure_window` | string | No | null | Time window in 'HH-HH' format (e.g., '6-20') |
 | `sort_by` | string | No | CHEAPEST | Sort order — matters when `flight_numbers` is omitted |
 | `exclude_airlines` | list | No | null | Airline IATA codes to **exclude** |
 | `alliance` / `exclude_alliance` | list | No | null | Restrict / exclude ONEWORLD, SKYTEAM, STAR_ALLIANCE |
 | `min_layover` / `max_layover` | int | No | null | Layover duration bounds (minutes) |
-| `emissions` | string | No | ALL | ALL or LESS |
-| `checked_bags` | int | No | 0 | Checked bags included in price (0–2) |
-| `carry_on` | bool | No | false | Include carry-on bag fee in price |
+| `emissions` | string | No | ALL | ALL or LESS. **Currently ignored by the search transport** (logged as a warning). |
+| `checked_bags` | int | No | 0 | Checked bags included in price (0–2). **Currently ignored by the search transport** (logged as a warning). |
+| `carry_on` | bool | No | false | Include carry-on bag fee in price. **Currently ignored by the search transport** (logged as a warning). |
 | `currency` | string | No | null | ISO 4217 currency code (`curr=`) |
 | `language` | string | No | null | BCP-47 language code (`hl=`) |
 | `country` | string | No | null | ISO 3166-1 alpha-2 country (`gl=`) |
```

**File**: `fli/cli/commands/dates.py` (modified, +8/-3)
```diff
@@ -36,6 +36,7 @@
     TripType,
 )
 from fli.search import SearchClientError, SearchDates
+from fli.search.dates import MAX_DATES_PER_SEARCH
 
 
 def _build_selected_days(
@@ -74,9 +75,13 @@ def dates(
         str,
         typer.Option("--from", help="Start date (YYYY-MM-DD)"),
     ] = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
-    end_date: Annotated[str, typer.Option("--to", help="End date (YYYY-MM-DD)")] = (
-        datetime.now() + timedelta(days=60)
-    ).strftime("%Y-%m-%d"),
+    end_date: Annotated[
+        str,
+        typer.Option(
+            "--to",
+            help=(f"End date (YYYY-MM-DD); at most {MAX_DATES_PER_SEARCH} dates per search"),
+        ),
+    ] = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d"),
     trip_duration: Annotated[
         int,
         typer.Option(
```

**File**: `fli/cli/commands/flights.py` (modified, +9/-4)
```diff
@@ -385,7 +385,7 @@ def flights(
         typer.Option(
             "--exclude-basic",
             "-e",
-            help="Exclude basic economy fares",
+            help="Exclude basic economy fares. [currently ignored by the search transport]",
         ),
     ] = False,
     layover: Annotated[
@@ -400,15 +400,20 @@ def flights(
         str,
         typer.Option(
             "--emissions",
-            help="Filter by emissions level (ALL, LESS)",
+            help=(
+                "Filter by emissions level (ALL, LESS). [currently ignored by the search transport]"
+            ),
         ),
     ] = "ALL",
     checked_bags: Annotated[
         int,
         typer.Option(
             "--bags",
             "-b",
-            help="Number of checked bags to include in price (0, 1, or 2)",
+            help=(
+                "Checked bags included in price (0, 1, or 2). "
+                "[currently ignored by the search transport]"
+            ),
             min=0,
             max=2,
         ),
@@ -417,7 +422,7 @@ def flights(
         bool,
         typer.Option(
             "--carry-on",
-            help="Include carry-on bag fee in price",
+            help="Include carry-on bag fee in price. [currently ignored by the search transport]",
         ),
     ] = False,
     all_results: Annotated[
```

---

### Incident Patch 10: `0caa8b2f` (2026-09-20)
**Commit Message**: fix: decode per-leg amenity slots correctly (Wi-Fi, power, video, seat quality, cabin) (#244)

* fix: decode per-leg amenity slots correctly (#217)

`leg[12]` slot 1 is an in-seat-power flag, not Wi-Fi, and `leg[12][11]`
is a Wi-Fi *tier* code rather than a boolean, so the old decoder
reported Wi-Fi for every leg with a power outlet and never reported it
for legs that only publish the tier (e.g. every BA long-haul row).
`power` read slot 5, which only European/ULCC USB-only cabins ever set,
so mainline US carriers came back as `power=None`.

Verified by tabulating leg[12][0..11], leg[13], leg[14] and leg[16]
across ~280 distinct legs in the captured fixtures plus three live
public-page captures (business, premium economy, first):

  slots 1..6  power group, mutually exclusive across the whole corpus.
              1 = plug+USB (US majors), 3 = plug only (AA A319, UA 737),
              5 = USB only (BA/AF/LH/OS/LX short-haul, Sun Country).
  slots 8..10 video group, mutually exclusive. 8 = live TV (JetBlue,
              Delta domestic narrowbodies), 9 = on demand (widebodies,
              AA transcon A321neo), 10 = stream to device (Alaska, AA
              737/A321 Sharklets, re

**File**: `fli-js/src/models/google-flights/base.ts` (modified, +56/-0)
```diff
@@ -173,13 +173,64 @@ export const LayoverRestrictionsSchema = z.object({
 });
 export type LayoverRestrictions = z.infer<typeof LayoverRestrictionsSchema>;
 
+/** In-seat power flavour decoded from the leg[12] power slot group. */
+export const POWER_TYPES = ["plug_and_usb", "plug", "usb"] as const;
+export type PowerType = (typeof POWER_TYPES)[number];
+
+/** In-flight entertainment flavour decoded from the leg[12] video group. */
+export const VIDEO_TYPES = ["live_tv", "on_demand", "stream_to_device"] as const;
+export type VideoType = (typeof VIDEO_TYPES)[number];
+
+/** Whether Google flags the leg's Wi-Fi as complimentary or chargeable. */
+export const WIFI_TIERS = ["free", "paid"] as const;
+export type WifiTier = (typeof WIFI_TIERS)[number];
+
+/**
+ * Human-readable label for Google's leg[13] seat-quality code.
+ *
+ * These are labels, not an ordered score: "average"/"below_average"/
+ * "above_average" describe an economy-style pitch, while the remaining four
+ * name a seat *product*. The code tracks the fare's cabin rather than the
+ * airframe — in the captured fixtures AA 1209 (ORD-LAX, 737 MAX 8) appears
+ * twice, as "average" in economy and "recliner" in first.
+ */
+export const SEAT_QUALITIES = [
+  "average",
+  "below_average",
+  "above_average",
+  "extra_reclining",
+  "lie_flat",
+  "lie_flat_suite_with_door",
+  "recliner",
+] as const;
+export type SeatQuality = (typeof SEAT_QUALITIES)[number];
+
+/**
+ * Per-leg amenities reported by Google Flights. Booleans are tri-state
+ * (true / false / null when Google did not publish that signal).
+ *
+ * Google never publishes an explicit "no" for any of these amenities — the
+ * wire format only ever sets a flag or omits it — so `false` is always an
+ * inference and is used exactly once: `in_seat_video` is false when
+ * `video_type === "stream_to_device"`, which is Google's way of saying the
+ * aircraft has no seatback screen. Every other unknown stays null,
+ * including `usb_power` for a plug-only cabin and `on_demand_video` for a
+ * live-TV or stream-to-device leg.
+ */
 export const AmenitiesSchema = z.object({
   wifi: z.boolean().nullable().optional(),
   power: z.boolean().nullable().optional(),
   usb_power: z.boolean().nullable().optional(),
   in_seat_video: z.boolean().nullable().optional(),
   on_demand_video: z.boolean().nullable().optional(),
   legroom_rating: z.number().int().nonnegative().nullable().optional(),
+  // Optional detail — populated only for slot values confirmed against
+  // captured responses, so callers never see a confidently wrong label.
+  wifi_tier: z.enum(WIFI_TIERS).nullable().optional(),
+  power_type: z.enum(POWER_TYPES).nullable().optional(),
+  video_type: z.enum(VIDEO_TYPES).nullable().optional(),
+  seat_quality: z.enum(SEAT_QUALITIES).nullable().optional(),
+  legroom_inches: z.number().int().positive().nullable().optional(),
 });
 export type Amenities = z.infer<typeof AmenitiesSchema>;
 
@@ -210,6 +261,11 @@ export interface FlightLeg {
   amenities?: Amenities | null;
   overnight?: boolean;
   co2_emissions_g?: number | null;
+  /**
+   * Cabin actually flown on this leg, from leg[16]. Per-leg, so a business
+   * itinerary can still show an economy connecting leg.
+   */
+  cabin?: SeatType | null;
 }
 
 export interface BookingOption {
```

**File**: `fli-js/src/search/decoders.ts` (modified, +164/-11)
```diff
@@ -12,7 +12,12 @@ import type {
   FlightLeg,
   FlightResult,
   Layover,
+  PowerType,
+  SeatQuality,
+  VideoType,
+  WifiTier,
 } from "../models/google-flights/base.ts";
+import { SeatType } from "../models/google-flights/base.ts";
 import { asBool, asInt, asNonNegativeInt, asStr, safeGet } from "./helpers.ts";
 
 // Pseudo-codes Google emits in place of a real IATA carrier identifier.
@@ -71,25 +76,171 @@ function safeAirline(code: unknown): Airline | null {
   return null;
 }
 
-function parseAmenities(slots: unknown, seatQuality: unknown = null): Amenities | null {
-  const wifi = asBool(safeGet(slots, 1));
-  const power = asBool(safeGet(slots, 5));
-  const onDemandVideo = asBool(safeGet(slots, 9));
+// --- leg[12] amenity slot map (issue #217) --------------------------------
+//
+// leg[12] is a sparse array of amenity flags with trailing nulls trimmed.
+// Two mutually-exclusive groups plus a Wi-Fi tier code were confirmed by
+// tabulating all 481 leg instances across the captured fixtures (plus
+// three live public-page captures) against published fleet facts:
+//
+//   slots 1..6  power group — exactly one is ever set on a leg.
+//   slots 8..10 video group — exactly one is ever set on a leg.
+//   slot 11     Wi-Fi tier code (a number, never a bool).
+//
+// Slots 2, 4 and 6 are reported to be "some seats only" variants of 1, 3
+// and 5, and slot 11 === 1 is reported to mean "Wi-Fi, tier unknown", but
+// none of those values occurs anywhere in the corpus. Nothing is inferred
+// from them: an unobserved slot yields null, never a guessed value.
+//
+// No slot in the corpus ever holds JSON `false`, so every `false` this
+// decoder emits is an inference. Only one is made — see `inSeatVideo` in
+// parseAmenities.
+
+/** Power slots whose flavour is confirmed. */
+const POWER_SLOTS: ReadonlyMap<number, PowerType> = new Map<number, PowerType>([
+  [1, "plug_and_usb"],
+  [3, "plug"],
+  [5, "usb"],
+]);
+/**
+ * Every index in the power group, scanned in wire order. Includes the
+ * unobserved 2/4/6 "some seats" variants deliberately: the first *set* slot
+ * wins even when it is one we cannot label, so a payload that ever does set
+ * one yields "unknown" rather than skipping ahead to a slot we can name and
+ * reporting something Google did not say.
+ */
+const POWER_GROUP: readonly number[] = [1, 2, 3, 4, 5, 6];
+/** Video slots, in wire order. */
+const VIDEO_SLOTS: ReadonlyMap<number, VideoType> = new Map<number, VideoType>([
+  [8, "live_tv"],
+  [9, "on_demand"],
+  [10, "stream_to_device"],
+]);
+const VIDEO_GROUP: readonly number[] = [8, 9, 10];
+/** Video products delivered on a seatback screen rather than to a phone. */
+const SEATBACK_VIDEO: ReadonlySet<VideoType> = new Set<VideoType>(["live_tv", "on_demand"]);
+/** Position of the Wi-Fi tier code within leg[12]. */
+const WIFI_TIER_SLOT = 11;
+/** Confirmed Wi-Fi tier codes. */
+const WIFI_TIERS_BY_CODE: ReadonlyMap<number, WifiTier> = new Map<number, WifiTier>([
+  [2, "free"],
+  [3, "paid"],
+]);
+/**
+ * Confirmed leg[13] seat-quality codes. Code 9 ("angled flat") is reported
+ * but unobserved, so it deliberately has no label here.
+ */
+const SEAT_QUALITY_BY_CODE: ReadonlyMap<number, SeatQuality> = new Map<number, SeatQuality>([
+  [1, "average"],
+  [2, "below_average"],
+  [3, "above_average"],
+  [4, "extra_reclining"],
+  [5, "lie_flat"],
+  [6, "lie_flat_suite_with_door"],
+  [8, "recliner"],
+]);
+
+/**
+ * True when slots[index] is a set flag. Google's RPC payload encodes these
+ * as JSON booleans while the public travel page encodes them as 1; accept
+ * both and treat every other value (including 0, non-integers and strings)
+ * as unset. The integer check keeps this identical to Python's
+ * `isinstance(value, int)`, which rejects floats such as 1.5.
+ */
+function slotOn(slots: unknown, index: number): boolean {
+  const value = safeGet(slots, index);
+  if (typeof value === "boolean") return value;
+  return typeof value === "
```

**File**: `fli-js/tests/search/amenities_decoding.test.ts` (added, +435/-0)
```diff
@@ -0,0 +1,435 @@
+import { describe, expect, test } from "bun:test";
+import { readFileSync } from "node:fs";
+import type { FlightLeg, FlightResult } from "../../src/models/google-flights/base.ts";
+import { SeatType } from "../../src/models/google-flights/base.ts";
+import { parseFlightRow } from "../../src/search/decoders.ts";
+
+/**
+ * Mirror of tests/search/test_amenities_decoding.py (issue #217).
+ *
+ * Every expectation is pinned to a named flight in a captured Google
+ * Flights response. The slot mapping was verified by tabulating
+ * leg[12][0..11], leg[13], leg[14] and leg[16] across ~280 distinct legs:
+ * slots 1..6 are a mutually-exclusive power group, slots 8..10 a
+ * mutually-exclusive video group, and slot 11 a Wi-Fi tier code.
+ */
+
+function load(name: string): FlightResult[] {
+  const fixture = readFileSync(
+    new URL(`../../../tests/search/fixtures/${name}`, import.meta.url),
+    "utf8",
+  );
+  const outer = JSON.parse(fixture.slice(fixture.indexOf("[")));
+  const inner = JSON.parse(outer[0][2]);
+  const rows: unknown[][] = [2, 3].flatMap((i) => (Array.isArray(inner[i]) ? inner[i][0] : []));
+  const flights: FlightResult[] = [];
+  for (const row of rows) {
+    try {
+      flights.push(parseFlightRow(row));
+    } catch {
+      // Malformed / sponsor rows are skipped, same as the Python replay.
+    }
+  }
+  return flights;
+}
+
+function rawLegs(name: string): unknown[][] {
+  const fixture = readFileSync(
+    new URL(`../../../tests/search/fixtures/${name}`, import.meta.url),
+    "utf8",
+  );
+  const outer = JSON.parse(fixture.slice(fixture.indexOf("[")));
+  const inner = JSON.parse(outer[0][2]);
+  const rows: unknown[][] = [2, 3].flatMap((i) => (Array.isArray(inner[i]) ? inner[i][0] : []));
+  return rows.flatMap((row) => ((row[0] as unknown[])[2] as unknown[][]) ?? []);
+}
+
+function leg(flights: FlightResult[], carrier: string, number: string): FlightLeg {
+  for (const flight of flights) {
+    for (const l of flight.legs) {
+      if (l.airline === carrier && l.flight_number === number) return l;
+    }
+  }
+  throw new Error(`${carrier}${number} not found in fixture`);
+}
+
+function rawRows(name: string): unknown[][] {
+  const fixture = readFileSync(
+    new URL(`../../../tests/search/fixtures/${name}`, import.meta.url),
+    "utf8",
+  );
+  const outer = JSON.parse(fixture.slice(fixture.indexOf("[")));
+  const inner = JSON.parse(outer[0][2]);
+  return [2, 3].flatMap((i) => (Array.isArray(inner[i]) ? inner[i][0] : []));
+}
+
+/**
+ * Parse a real fixture row with leg[12]/[13]/[14] overridden. Cloning a
+ * genuine row keeps every other position realistic. Mirrors
+ * `_synthetic_leg` in tests/search/test_amenities_decoding.py.
+ */
+function syntheticLeg(
+  slots: unknown = null,
+  seatQuality: unknown = 1,
+  legroom: unknown = "31 in",
+): FlightLeg {
+  const row = structuredClone(rawRows("flight_search_jfk_lax_oneway_usd.bin")[0]) as unknown[];
+  const l = ((row[0] as unknown[])[2] as unknown[][])[0] as unknown[];
+  l[12] = slots;
+  l[13] = seatQuality;
+  l[14] = legroom;
+  l[30] = null; // isolate leg[14] from the long-form fallback
+  return parseFlightRow(row).legs[0] as FlightLeg;
+}
+
+function emptySlots(): unknown[] {
+  return Array.from({ length: 12 }, () => null);
+}
+
+const FIXTURES = [
+  "flight_search_jfk_lax_oneway_usd.bin",
+  "flight_search_jfk_lax_eur.bin",
+  "flight_search_jfk_lax_exclude_dl.bin",
+  "flight_search_jfk_fra_oneworld.bin",
+  "flight_search_buf_ath_min_layover_120.bin",
+  "flight_search_lax_lhr_rt_biz_2a1c.bin",
+];
+
+const jfkLax = load("flight_search_jfk_lax_oneway_usd.bin");
+const jfkFra = load("flight_search_jfk_fra_oneworld.bin");
+const bufAth = load("flight_search_buf_ath_min_layover_120.bin");
+const jfkLaxNoDl = load("flight_search_jfk_lax_exclude_dl.bin");
+const laxLhrBiz = load("flight_search_lax_lhr_rt_biz_2a1c.bin");
+
+describe("wifi tier (leg[12][11])", () => {
+  test("JetBlue reports free Wi-Fi", ()
```

**File**: `fli/cli/utils.py` (modified, +3/-0)
```diff
@@ -199,6 +199,9 @@ def serialize_flight_leg(leg: Any) -> dict[str, Any]:
         payload["aircraft"] = leg.aircraft
     if getattr(leg, "legroom", None):
         payload["legroom"] = leg.legroom
+    cabin_name = getattr(getattr(leg, "cabin", None), "name", None)
+    if isinstance(cabin_name, str):
+        payload["cabin"] = cabin_name
     if getattr(leg, "overnight", False):
         payload["overnight"] = True
     if getattr(leg, "operating_airline", None) is not None:
```

**File**: `fli/mcp/server.py` (modified, +6/-0)
```diff
@@ -409,6 +409,12 @@ def _serialize_flight_leg(leg: Any) -> dict[str, Any]:
         out["aircraft"] = leg.aircraft
     if getattr(leg, "legroom", None):
         out["legroom"] = leg.legroom
+    cabin_name = getattr(getattr(leg, "cabin", None), "name", None)
+    if isinstance(cabin_name, str):
+        # Report the SeatType member name (ECONOMY / BUSINESS / ...) so it
+        # matches the `cabin_class` tool parameter rather than Google's
+        # numeric code.
+        out["cabin"] = cabin_name
     if getattr(leg, "overnight", False):
         out["overnight"] = True
     amenities = getattr(leg, "amenities", None)
```

#### Recent Merged Pull Requests:
- **PR #256** (2026-09-20): fix(cli): do not print the sparse-results explanation twice in text mode (@punitarani)
- **PR #255** (2026-09-20): fix: say so when children or infants are why a search came back empty (@punitarani)
- **PR #254** (2026-09-20): chore: describe code in terms a repo reader can follow (drop review-process references from comments) (@punitarani)
- **PR #253** (2026-09-20): fix(cli): an empty result no longer reports "Unexpected error: Exit: 1" or writes a traceback log (@punitarani)
- **PR #252** (2026-09-20): fix: carry the search's passenger mix into per-flight booking links (@punitarani)
- **PR #251** (2026-09-20): feat: clear TLS certificate errors and CA-bundle support (carries forward #164) (@punitarani)
- **PR #250** (2026-09-20): feat: expose top_n for round-trip searches on the CLI and MCP tools (@punitarani)
- **PR #249** (2026-09-20): fix(search): a date sweep that mostly failed to load raises instead of reporting no dates (@punitarani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
