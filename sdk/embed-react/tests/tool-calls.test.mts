import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  toolCallEndFromMessage,
  toolCallStartFromMessage,
} from "../dist/signaling-messages.js";

describe("toolCallStartFromMessage", () => {
  it("parses rtf-function-call-start", () => {
    const call = toolCallStartFromMessage({
      type: "rtf-function-call-start",
      payload: {
        tool_call_id: "tc-1",
        function_name: "lookup_order",
        arguments: { orderId: "42" },
      },
    });
    assert.deepEqual(call, {
      toolCallId: "tc-1",
      functionName: "lookup_order",
      arguments: { orderId: "42" },
      status: "running",
    });
  });

  it("returns null when tool_call_id is missing", () => {
    assert.equal(
      toolCallStartFromMessage({
        type: "rtf-function-call-start",
        payload: { function_name: "x" },
      }),
      null,
    );
  });

  it("returns null for unrelated message types", () => {
    assert.equal(toolCallStartFromMessage({ type: "answer" }), null);
  });
});

describe("toolCallEndFromMessage", () => {
  it("parses rtf-function-call-end and preserves args from existing", () => {
    const call = toolCallEndFromMessage(
      {
        type: "rtf-function-call-end",
        payload: {
          tool_call_id: "tc-1",
          result: "done",
        },
      },
      {
        toolCallId: "tc-1",
        functionName: "lookup_order",
        arguments: { orderId: "42" },
        status: "running",
      },
    );
    assert.deepEqual(call, {
      toolCallId: "tc-1",
      functionName: "lookup_order",
      arguments: { orderId: "42" },
      status: "completed",
      result: "done",
    });
  });

  it("returns null when tool_call_id is missing", () => {
    assert.equal(
      toolCallEndFromMessage({ type: "rtf-function-call-end", payload: {} }),
      null,
    );
  });
});
