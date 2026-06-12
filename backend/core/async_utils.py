"""Helpers for scheduling coroutines from sync code and worker threads."""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any

_main_loop: asyncio.AbstractEventLoop | None = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def schedule_coroutine(coro: Coroutine[Any, Any, Any]) -> None:
    """Schedule a coroutine on the running loop or the app main loop."""
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        if _main_loop is not None and _main_loop.is_running():
            asyncio.run_coroutine_threadsafe(coro, _main_loop)
