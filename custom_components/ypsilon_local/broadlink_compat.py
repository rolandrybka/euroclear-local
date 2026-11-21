"""Select the BroadLink API supplied by the installed Home Assistant release."""

from __future__ import annotations

import asyncio
import inspect
from typing import Any, Callable

try:
    import broadlink_async as broadlink
except ModuleNotFoundError as err:
    if err.name != "broadlink_async":
        raise
    import broadlink

IS_ASYNC_BROADLINK = inspect.iscoroutinefunction(broadlink.hello)


async def async_call(method: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    """Call either the legacy blocking library or the current async library."""
    if inspect.iscoroutinefunction(method):
        return await method(*args, **kwargs)
    return await asyncio.to_thread(method, *args, **kwargs)
