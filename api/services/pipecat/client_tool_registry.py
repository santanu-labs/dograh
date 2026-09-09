"""Pending client-side tool invocations keyed by workflow run + tool_call_id."""

from __future__ import annotations

import asyncio
from typing import Any

_pending: dict[tuple[int, str], asyncio.Future[Any]] = {}


class ClientToolError(Exception):
    """Raised when the browser reports a tool failure or times out."""


async def await_client_tool_result(
    workflow_run_id: int,
    tool_call_id: str,
    timeout_secs: float,
) -> Any:
    """Wait until the signaling client returns tool-invoke-result or timeout."""
    loop = asyncio.get_running_loop()
    future: asyncio.Future[Any] = loop.create_future()
    key = (workflow_run_id, tool_call_id)
    _pending[key] = future
    try:
        return await asyncio.wait_for(future, timeout=timeout_secs)
    finally:
        _pending.pop(key, None)


def complete_client_tool(
    workflow_run_id: int,
    tool_call_id: str,
    *,
    result: Any = None,
    error: str | None = None,
) -> bool:
    """Resolve a pending invocation from a client tool-invoke-result message."""
    key = (workflow_run_id, tool_call_id)
    future = _pending.get(key)
    if future is None or future.done():
        return False
    if error:
        future.set_exception(ClientToolError(error))
    else:
        future.set_result(result)
    return True


def cancel_pending_for_run(workflow_run_id: int) -> None:
    """Fail any in-flight client tool waits when the signaling WS disconnects."""
    keys = [key for key in _pending if key[0] == workflow_run_id]
    for key in keys:
        future = _pending.pop(key)
        if not future.done():
            future.set_exception(ClientToolError("Client disconnected"))
