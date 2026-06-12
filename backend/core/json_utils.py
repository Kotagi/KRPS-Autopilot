"""Normalize kRPC float values for JSON WebSocket payloads."""

from __future__ import annotations

import math
from typing import Any


def finite_or_none(value: float | None) -> float | None:
    if value is None:
        return None
    if not math.isfinite(value):
        return None
    return value


def sanitize_json_floats(value: Any) -> Any:
    """Replace NaN/Inf with None so browser JSON.parse accepts the payload."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: sanitize_json_floats(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_json_floats(item) for item in value]
    if isinstance(value, tuple):
        return [sanitize_json_floats(item) for item in value]
    return value
