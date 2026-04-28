import json
import os
import ssl
import time
from threading import Lock
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = os.getenv("NOMINATIM_USER_AGENT", "CivicLens/1.0 civic-issue-geocoder")
REQUEST_TIMEOUT_SECONDS = 8
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
DEFAULT_CONTEXT = os.getenv("GEOCODING_CONTEXT", "Maharashtra, India")
COUNTRY_CODES = os.getenv("GEOCODING_COUNTRY_CODES", "in")
MIN_REQUEST_INTERVAL_SECONDS = float(os.getenv("NOMINATIM_MIN_INTERVAL_SECONDS", "1.1"))
RATE_LIMIT_BACKOFF_SECONDS = int(os.getenv("NOMINATIM_RATE_LIMIT_BACKOFF_SECONDS", "60"))
_CACHE: dict[str, tuple[float | None, float | None]] = {}
_REQUEST_LOCK = Lock()
_LAST_REQUEST_AT = 0.0
_RATE_LIMITED_UNTIL = 0.0


class GeocodingRateLimitedError(Exception):
    pass


def geocode_location(location: str):
    normalized_location = (location or "").strip()
    if not normalized_location:
        return (None, None)

    cache_key = normalized_location.lower()
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    rate_limited = False
    for query in _build_query_candidates(normalized_location):
        try:
            coordinates = _attempt_geocode_query(query)
        except GeocodingRateLimitedError:
            rate_limited = True
            break
        if coordinates != (None, None):
            _CACHE[cache_key] = coordinates
            return coordinates

    if not rate_limited:
        _CACHE[cache_key] = (None, None)
    return (None, None)


def _build_query_candidates(location: str) -> list[str]:
    candidates = [location]
    lowered_location = location.lower()

    if DEFAULT_CONTEXT and DEFAULT_CONTEXT.lower() not in lowered_location:
        candidates.append(f"{location}, {DEFAULT_CONTEXT}")

    if "india" not in lowered_location:
        candidates.append(f"{location}, India")

    deduped_candidates = []
    for candidate in candidates:
        normalized_candidate = candidate.strip()
        if normalized_candidate and normalized_candidate.lower() not in {
            item.lower() for item in deduped_candidates
        }:
            deduped_candidates.append(normalized_candidate)

    return deduped_candidates


def _attempt_geocode_query(query: str):
    for attempt in range(2):
        try:
            return _geocode_with_nominatim(query)
        except HTTPError as exc:
            if exc.code == 429:
                _mark_rate_limited(exc)
                raise GeocodingRateLimitedError from exc
            if attempt == 0:
                sleep(1)
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            if attempt == 0:
                sleep(1)

    return (None, None)


def _geocode_with_nominatim(query_text: str):
    if _is_rate_limited():
        raise GeocodingRateLimitedError

    query = urlencode({
        "q": query_text,
        "format": "jsonv2",
        "limit": 1,
        "addressdetails": 0,
        "dedupe": 1,
        "countrycodes": COUNTRY_CODES,
    })
    request = Request(
        f"{NOMINATIM_URL}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )

    with _REQUEST_LOCK:
        _wait_for_rate_limit()
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS, context=SSL_CONTEXT) as response:
            results = json.loads(response.read().decode("utf-8"))

    if not results:
        return (None, None)

    first_result = results[0]
    latitude = float(first_result["lat"])
    longitude = float(first_result["lon"])
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return (None, None)

    return (latitude, longitude)


def _wait_for_rate_limit():
    global _LAST_REQUEST_AT

    elapsed = time.monotonic() - _LAST_REQUEST_AT
    if elapsed < MIN_REQUEST_INTERVAL_SECONDS:
        sleep(MIN_REQUEST_INTERVAL_SECONDS - elapsed)
    _LAST_REQUEST_AT = time.monotonic()


def _is_rate_limited() -> bool:
    return time.monotonic() < _RATE_LIMITED_UNTIL


def _mark_rate_limited(exc: HTTPError):
    global _RATE_LIMITED_UNTIL

    retry_after = exc.headers.get("Retry-After")
    try:
        backoff_seconds = int(retry_after) if retry_after else RATE_LIMIT_BACKOFF_SECONDS
    except ValueError:
        backoff_seconds = RATE_LIMIT_BACKOFF_SECONDS

    _RATE_LIMITED_UNTIL = max(_RATE_LIMITED_UNTIL, time.monotonic() + backoff_seconds)


def ensure_issue_coordinates(db, issue):
    if issue.latitude is not None and issue.longitude is not None:
        return False

    latitude, longitude = geocode_location(issue.location)
    if latitude is None or longitude is None:
        return False

    issue.latitude = latitude
    issue.longitude = longitude
    db.add(issue)
    return True
