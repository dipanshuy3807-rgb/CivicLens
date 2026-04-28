import re


ISSUE_TYPE_RULES = {
    "Garbage Overflow": ["garbage", "waste", "trash"],
    "Water Shortage": ["water", "shortage", "supply", "contamination", "pipeline leakage", "pipeline"],
    "Road Damage": ["road", "pothole", "damage", "footpath", "traffic congestion"],
    "Power Issue": ["electricity", "power", "outage", "transformer", "street light"],
    "Sewage Problem": ["sewage", "drain", "drainage", "open defecation", "toilet"],
}

INVALID_LOCATIONS = {"progress", "area", "place", "location", "issue"}
LOCATION_PATTERNS = [
    re.compile(r"\bin\s+([a-zA-Z][a-zA-Z\s.-]*)", re.IGNORECASE),
    re.compile(r"\bat\s+([a-zA-Z][a-zA-Z\s.-]*)", re.IGNORECASE),
    re.compile(r"\bnear\s+([a-zA-Z][a-zA-Z\s.-]*)", re.IGNORECASE),
]
LOCATION_STOP_WORDS = re.compile(
    r"\b(?:affecting|affected|impacting|impacted|reported|reporting|causing|with|for|due|because|where|that|which|critical|urgent|severe|high|medium|low)\b",
    re.IGNORECASE,
)


def extract_issue_data(text: str) -> dict:
    issues = extract_issue_records(text)
    if issues:
        return issues[0]

    return {
        "issue_type": "General Issue",
        "severity": "Low",
        "people_affected": 0,
        "location": None,
    }


def extract_issue_records(text: str) -> list[dict]:
    normalized_text = (text or "").strip()
    if not normalized_text:
        return []

    structured_issues = _extract_structured_issues(normalized_text)
    if structured_issues:
        return structured_issues

    lowered_text = normalized_text.lower()
    people_affected = _extract_people_affected(lowered_text)

    return [
        {
            "issue_type": _extract_issue_type(lowered_text),
            "severity": _extract_severity(lowered_text, people_affected),
            "people_affected": people_affected,
            "location": _extract_location(normalized_text),
        }
    ]


def _extract_structured_issues(text: str) -> list[dict]:
    issues = []
    for line in text.splitlines():
        issue = _parse_csv_like_row(line)
        if issue is not None:
            issues.append(issue)
    return issues


def _parse_csv_like_row(line: str) -> dict | None:
    cleaned_line = line.strip()
    if not cleaned_line or cleaned_line.lower().startswith("id,"):
        return None

    parts = [part.strip() for part in cleaned_line.split(",")]
    if len(parts) < 5:
        return None

    record_id = _normalize_numeric_text(parts[0])
    if not re.fullmatch(r"\d+", record_id):
        return None

    issue_text = parts[1]
    severity_text = parts[2]
    people_text = parts[3]
    location_text = parts[4]

    issue_type = _extract_issue_type(issue_text.lower())
    people_affected = _parse_structured_people(people_text)
    severity = _extract_severity(severity_text.lower(), people_affected)
    location = _clean_location_value(location_text)

    return {
        "issue_type": issue_type,
        "severity": severity,
        "people_affected": people_affected,
        "location": location,
    }


def _extract_issue_type(text: str) -> str:
    for issue_type, keywords in ISSUE_TYPE_RULES.items():
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}\b", text):
                return issue_type
    return "General Issue"


def _extract_severity(text: str, people_affected: int) -> str:
    keyword_severity = None
    if "critical" in text:
        keyword_severity = "Critical"
    elif any(word in text for word in ("urgent", "severe", "high")):
        keyword_severity = "High"
    elif "medium" in text:
        keyword_severity = "Medium"

    people_severity = _severity_from_people(people_affected)

    if keyword_severity == "Critical" and people_affected < 50:
        return "Low"

    if keyword_severity is None:
        return people_severity

    return _more_realistic_severity(keyword_severity, people_severity)


def _severity_from_people(people_affected: int) -> str:
    if people_affected >= 500:
        return "Critical"
    if people_affected >= 100:
        return "High"
    if people_affected >= 50:
        return "Medium"
    return "Low"


def _more_realistic_severity(keyword_severity: str, people_severity: str) -> str:
    severity_order = {
        "Low": 1,
        "Medium": 2,
        "High": 3,
        "Critical": 4,
    }

    if abs(severity_order[keyword_severity] - severity_order[people_severity]) >= 2:
        return people_severity

    if severity_order[people_severity] > severity_order[keyword_severity]:
        return people_severity

    return keyword_severity


def _extract_people_affected(text: str) -> int:
    match = re.search(r"\d+", text)
    if match:
        return int(match.group())
    return 0


def _parse_structured_people(text: str) -> int:
    normalized = _normalize_numeric_text(text)
    digits = re.findall(r"\d+", normalized)
    if not digits:
        return 0
    return int(digits[0])


def _normalize_numeric_text(text: str) -> str:
    return (
        text.replace("@", "0")
        .replace("O", "0")
        .replace("o", "0")
        .replace("I", "1")
        .replace("l", "1")
    )


def _extract_location(text: str) -> str | None:
    for pattern in LOCATION_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        location = _clean_location_value(match.group(1))
        if location is not None:
            return location

    return None


def _clean_location_value(text: str) -> str | None:
    location = text.strip(" ,.-")
    location = LOCATION_STOP_WORDS.split(location, maxsplit=1)[0].strip(" ,.-")
    location = re.sub(r"\s+", " ", location)
    if not location:
        return None

    normalized_words = []
    for word in location.split():
        cleaned_word = word.strip(" ,.-")
        if not cleaned_word:
            continue
        if cleaned_word.lower() in INVALID_LOCATIONS:
            continue
        normalized_words.append(cleaned_word.capitalize())

    if not normalized_words:
        return None

    return " ".join(normalized_words)
