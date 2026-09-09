import type { ToolCallState } from "./types.js";

export type SignalingMessage = {
  type: string;
  payload?: Record<string, unknown>;
};

export function toolCallStartFromMessage(
  message: SignalingMessage,
): ToolCallState | null {
  if (message.type !== "rtf-function-call-start") {
    return null;
  }
  const payload = message.payload ?? {};
  const toolCallId = payload.tool_call_id;
  if (typeof toolCallId !== "string" || !toolCallId) {
    return null;
  }
  return {
    toolCallId,
    functionName:
      typeof payload.function_name === "string"
        ? payload.function_name
        : "tool",
    arguments:
      payload.arguments && typeof payload.arguments === "object"
        ? (payload.arguments as Record<string, unknown>)
        : undefined,
    status: "running",
  };
}

export function toolCallEndFromMessage(
  message: SignalingMessage,
  existing?: ToolCallState,
): ToolCallState | null {
  if (message.type !== "rtf-function-call-end") {
    return null;
  }
  const payload = message.payload ?? {};
  const toolCallId = payload.tool_call_id;
  if (typeof toolCallId !== "string" || !toolCallId) {
    return null;
  }
  return {
    toolCallId,
    functionName:
      typeof payload.function_name === "string"
        ? payload.function_name
        : (existing?.functionName ?? "tool"),
    arguments: existing?.arguments,
    status: "completed",
    result:
      payload.result === null || typeof payload.result === "string"
        ? payload.result
        : payload.result != null
          ? String(payload.result)
          : null,
  };
}
