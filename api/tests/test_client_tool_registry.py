import asyncio

import pytest

from api.services.pipecat.client_tool_registry import (
    ClientToolError,
    await_client_tool_result,
    cancel_pending_for_run,
    complete_client_tool,
)


@pytest.mark.asyncio
async def test_complete_client_tool_resolves_future():
    task = asyncio.create_task(await_client_tool_result(1, "tc-1", timeout_secs=2.0))
    await asyncio.sleep(0.01)
    assert complete_client_tool(1, "tc-1", result={"ok": True}) is True
    assert await task == {"ok": True}


@pytest.mark.asyncio
async def test_complete_client_tool_reports_error():
    task = asyncio.create_task(await_client_tool_result(2, "tc-2", timeout_secs=2.0))
    await asyncio.sleep(0.01)
    complete_client_tool(2, "tc-2", error="handler failed")
    with pytest.raises(ClientToolError, match="handler failed"):
        await task


@pytest.mark.asyncio
async def test_cancel_pending_for_run():
    task = asyncio.create_task(await_client_tool_result(3, "tc-3", timeout_secs=2.0))
    await asyncio.sleep(0.01)
    cancel_pending_for_run(3)
    with pytest.raises(ClientToolError, match="Client disconnected"):
        await task


@pytest.mark.asyncio
async def test_await_client_tool_result_times_out():
    with pytest.raises(asyncio.TimeoutError):
        await await_client_tool_result(4, "tc-4", timeout_secs=0.05)
