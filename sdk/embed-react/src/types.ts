export type VoiceCallStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "failed"
  | "ended";

export interface EmbedConfigResponse {
  workflow_id: number;
  turn_enabled?: boolean;
  force_turn_relay?: boolean;
  settings?: {
    widgetType?: string;
  };
}

export interface EmbedInitResponse {
  session_token: string;
  workflow_run_id: number;
  config: {
    workflow_id: number;
  };
}

export interface TurnCredentialsResponse {
  username: string;
  password: string;
  ttl: number;
  uris: string[];
}

export interface VoiceCallSession {
  sessionToken: string;
  workflowRunId: number;
  workflowId: number;
}

export interface ToolCallState {
  toolCallId: string;
  functionName: string;
  arguments?: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  result?: string | null;
}

export interface ClientToolContext {
  toolCallId: string;
  functionName: string;
  toolUuid: string;
}

export type ClientToolHandler = (
  args: Record<string, unknown>,
  context: ClientToolContext,
) => Promise<unknown> | unknown;

export interface ToolInvokeRequestPayload {
  tool_call_id: string;
  function_name: string;
  tool_uuid: string;
  arguments: Record<string, unknown>;
  timeout_ms?: number;
}

export type ChatStatus =
  | "idle"
  | "starting"
  | "ready"
  | "waiting"
  | "ended"
  | "expired"
  | "error";

export interface ChatMessage {
  text: string;
  createdAt?: string | null;
}

export interface ChatTurn {
  id: string;
  status: string;
  userMessage?: ChatMessage | null;
  assistantMessage?: ChatMessage | null;
}

export interface ChatSession {
  sessionToken: string;
  workflowRunId: number;
  revision: number;
  turns: ChatTurn[];
  isCompleted: boolean;
}

export interface VoiceCallConnectedInfo {
  workflowId: number;
  workflowRunId: number;
  sessionToken: string;
}

export interface VoiceCallDisconnectedInfo extends VoiceCallConnectedInfo {
  durationSeconds: number;
}

export interface DograhVoiceCallClientOptions {
  embedToken: string;
  apiBaseUrl: string;
  /** Page origin sent as the Origin header. Defaults to `window.location.origin`. */
  origin?: string;
  context?: Record<string, string | number | boolean | null>;
  /** Play remote audio through a hidden <audio> element (default true). */
  playRemoteAudio?: boolean;
  onStatusChange?: (status: VoiceCallStatus) => void;
  onError?: (error: Error) => void;
  onConnected?: (info: VoiceCallConnectedInfo) => void;
  onDisconnected?: (info: VoiceCallDisconnectedInfo) => void;
  onToolCallStart?: (call: ToolCallState) => void;
  onToolCallEnd?: (call: ToolCallState) => void;
  /** Handlers for browser_tool category tools (server sends tool-invoke-request). */
  clientTools?: Record<string, ClientToolHandler>;
}

export interface UseDograhVoiceCallOptions extends DograhVoiceCallClientOptions {
  /** When false, skip loading embed config until start() (default true). */
  autoLoadConfig?: boolean;
}

export interface UseDograhVoiceCallResult {
  status: VoiceCallStatus;
  error: Error | null;
  session: VoiceCallSession | null;
  toolCalls: ToolCallState[];
  isReady: boolean;
  start: () => Promise<void>;
  end: () => void;
  setContext: (context: Record<string, string | number | boolean | null>) => void;
}

export interface UseDograhChatOptions {
  embedToken: string;
  apiBaseUrl: string;
  origin?: string;
  context?: Record<string, string | number | boolean | null>;
  autoStart?: boolean;
  onMessage?: (text: string, turn: ChatTurn) => void;
  onStatusChange?: (status: ChatStatus) => void;
  onError?: (error: Error) => void;
}

export interface UseDograhChatResult {
  status: ChatStatus;
  error: Error | null;
  session: ChatSession | null;
  turns: ChatTurn[];
  sendMessage: (text: string) => Promise<void>;
  end: () => Promise<void>;
  setContext: (context: Record<string, string | number | boolean | null>) => void;
}
