import asyncio
from typing import Any


async def wait_until_false(conn: Any, obj: Any, attr: str, rate: float = 1.0) -> None:
    """Wait until a kRPC stream attribute becomes false."""
    stream = conn.add_stream(getattr, obj, attr)
    stream.rate = rate
    try:
        await asyncio.to_thread(_blocking_wait, stream)
    finally:
        stream.remove()


def _blocking_wait(stream: Any) -> None:
    with stream.condition:
        while stream():
            stream.wait()
