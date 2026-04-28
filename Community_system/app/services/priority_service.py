SEVERITY_WEIGHTS = {
    "critical": 5,
    "high": 4,
    "medium": 3,
    "low": 1,
}


def calculate_priority(severity: str, people_affected: int) -> int:
    severity_weight = SEVERITY_WEIGHTS.get((severity or "").lower(), 1)
    normalized_people = max(people_affected, 0)
    return (severity_weight * 100) + min(normalized_people, 500)
