/** Shared embed signaling + widget types for Dograh voice and chat embeds. */

export type VoiceCallStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "failed"
  | "ended";

export type ChatStatus =
  | "idle"
  | "starting"
  | "ready"
  | "waiting"
  | "ended"
  | "expired"
  | "error";

export interface ToolCallState {
  toolCallId: string;
  functionName: string;
  arguments?: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  result?: string | null;
}

export interface ToolInvokeRequestPayload {
  tool_call_id: string;
  function_name: string;
  tool_uuid: string;
  arguments: Record<string, unknown>;
  timeout_ms?: number;
}

export interface ToolInvokeResultPayload {
  tool_call_id: string;
  result?: unknown;
  error?: string | null;
}

export type ClientToolHandler = (
  args: Record<string, unknown>,
  context: {
    toolCallId: string;
    functionName: string;
    toolUuid: string;
  },
) => Promise<unknown> | unknown;

export interface DograhWidgetCallbacks {
  onReady?: () => void;
  onCallStart?: () => void;
  onCallConnected?: () => void;
  onCallDisconnected?: () => void;
  onCallEnd?: () => void;
  onError?: (error: unknown) => void;
  onStatusChange?: (status: string) => void;
  onMessage?: (text: string, turn: unknown) => void;
  onChatStateChange?: (status: ChatStatus) => void;
  onToolCallStart?: (call: ToolCallState) => void;
  onToolCallEnd?: (call: ToolCallState) => void;
}

export interface DograhWidgetAPI extends DograhWidgetCallbacks {
  init: () => void;
  start: () => void;
  stop: () => void;
  end: () => void;
  retry: () => void;
  setContext: (context: Record<string, unknown>) => void;
  getContext: () => Record<string, unknown>;
  setClientTools: (handlers: Record<string, ClientToolHandler>) => void;
  open: () => void;
  close: () => void;
  startChat: () => Promise<void>;
  endChat: () => Promise<void>;
  sendMessage: (text: string) => Promise<unknown[] | null>;
  getMessages: () => unknown[];
  isChatMode: () => boolean;
  isInlineMode: () => boolean;
  refresh: () => void;
  getState: () => unknown;
}

declare global {
  interface Window {
    DograhWidget?: DograhWidgetAPI;
  }
}

export {};
