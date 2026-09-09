import type {
  ChatSession,
  ChatStatus,
  ChatTurn,
  EmbedInitResponse,
} from "./types.js";
import { normalizeApiBaseUrl } from "./utils.js";

type ChatSessionResponse = {
  revision: number;
  state: string;
  is_completed: boolean;
  turns: Array<{
    id: string;
    status: string;
    user_message?: { text: string; created_at?: string | null } | null;
    assistant_message?: { text: string; created_at?: string | null } | null;
  }>;
};

export interface DograhChatClientOptions {
  embedToken: string;
  apiBaseUrl: string;
  origin?: string;
  context?: Record<string, string | number | boolean | null>;
  onStatusChange?: (status: ChatStatus) => void;
  onError?: (error: Error) => void;
  onMessage?: (text: string, turn: ChatTurn) => void;
}

export class DograhChatClient {
  private readonly embedToken: string;
  private readonly apiBaseUrl: string;
  private readonly origin: string;
  private context: Record<string, string | number | boolean | null>;
  private readonly callbacks: Pick<
    DograhChatClientOptions,
    "onStatusChange" | "onError" | "onMessage"
  >;

  private status: ChatStatus = "idle";
  private session: ChatSession | null = null;
  private seenAssistantTurnIds = new Set<string>();

  constructor(options: DograhChatClientOptions) {
    this.embedToken = options.embedToken;
    this.apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
    this.origin =
      options.origin ??
      (typeof window !== "undefined" ? window.location.origin : "");
    this.context = { ...(options.context ?? {}) };
    this.callbacks = {
      onStatusChange: options.onStatusChange,
      onError: options.onError,
      onMessage: options.onMessage,
    };
  }

  getStatus(): ChatStatus {
    return this.status;
  }

  getSession(): ChatSession | null {
    return this.session;
  }

  getTurns(): ChatTurn[] {
    return this.session?.turns ?? [];
  }

  setContext(context: Record<string, string | number | boolean | null>): void {
    this.context = { ...context };
  }

  async start(): Promise<void> {
    this.setStatus("starting");
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/public/embed/init`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: this.embedToken,
            context_variables: this.context,
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 402) {
          this.setStatus("ended");
          throw new Error("The agent is unavailable right now.");
        }
        throw new Error(`Failed to start chat: ${response.status}`);
      }

      const data = (await response.json()) as EmbedInitResponse & {
        chat_session?: ChatSessionResponse;
      };

      if (!data.chat_session) {
        throw new Error("Embed token is configured for voice, not chat");
      }

      this.session = {
        sessionToken: data.session_token,
        workflowRunId: data.workflow_run_id,
        revision: data.chat_session.revision,
        turns: this.mapTurns(data.chat_session.turns),
        isCompleted: data.chat_session.is_completed,
      };
      this.seenAssistantTurnIds.clear();
      this.notifyNewAssistantMessages();

      this.setStatus(data.chat_session.is_completed ? "ended" : "ready");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus("error");
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || !this.session) {
      return;
    }
    if (
      this.status === "waiting" ||
      this.status === "starting" ||
      this.status === "ended" ||
      this.status === "expired"
    ) {
      return;
    }

    this.setStatus("waiting");

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/public/embed/chat/${this.session.sessionToken}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: trimmed,
            expected_revision: this.session.revision,
          }),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as ChatSessionResponse;
        this.applyChatSession(data);
        this.setStatus(data.is_completed ? "ended" : "ready");
        return;
      }

      if (response.status === 409) {
        await this.resync();
        throw new Error("Chat session changed elsewhere; resynced — retry send.");
      }

      throw new Error(`Failed to send message: ${response.status}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setStatus("error");
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  async end(): Promise<void> {
    if (!this.session) {
      return;
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/public/embed/chat/${this.session.sessionToken}/end`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expected_revision: this.session.revision }),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as ChatSessionResponse;
        this.applyChatSession(data);
      }
      this.setStatus("ended");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  private async resync(): Promise<void> {
    if (!this.session) {
      return;
    }

    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/public/embed/chat/${this.session.sessionToken}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (response.status === 410) {
      this.setStatus("expired");
      return;
    }

    if (!response.ok) {
      throw new Error(`Failed to resync chat: ${response.status}`);
    }

    const data = (await response.json()) as ChatSessionResponse;
    this.applyChatSession(data);
    this.setStatus(data.is_completed ? "ended" : "ready");
  }

  private applyChatSession(chatSession: ChatSessionResponse): void {
    if (!this.session) {
      return;
    }
    this.session = {
      ...this.session,
      revision: chatSession.revision,
      turns: this.mapTurns(chatSession.turns),
      isCompleted: chatSession.is_completed,
    };
    this.notifyNewAssistantMessages();
  }

  private mapTurns(
    turns: ChatSessionResponse["turns"],
  ): ChatTurn[] {
    return turns.map((turn) => ({
      id: turn.id,
      status: turn.status,
      userMessage: turn.user_message
        ? {
            text: turn.user_message.text,
            createdAt: turn.user_message.created_at ?? null,
          }
        : null,
      assistantMessage: turn.assistant_message
        ? {
            text: turn.assistant_message.text,
            createdAt: turn.assistant_message.created_at ?? null,
          }
        : null,
    }));
  }

  private notifyNewAssistantMessages(): void {
    for (const turn of this.session?.turns ?? []) {
      if (turn.status !== "completed" || !turn.assistantMessage?.text) {
        continue;
      }
      if (this.seenAssistantTurnIds.has(turn.id)) {
        continue;
      }
      this.seenAssistantTurnIds.add(turn.id);
      this.callbacks.onMessage?.(turn.assistantMessage.text, turn);
    }
  }

  private setStatus(status: ChatStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }
}
