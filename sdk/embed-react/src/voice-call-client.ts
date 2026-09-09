import type {
  DograhVoiceCallClientOptions,
  EmbedConfigResponse,
  EmbedInitResponse,
  ToolCallState,
  TurnCredentialsResponse,
  VoiceCallSession,
  VoiceCallStatus,
} from "./types.js";
import {
  toolCallEndFromMessage,
  toolCallStartFromMessage,
  type SignalingMessage,
} from "./signaling-messages.js";
import { httpToWs, normalizeApiBaseUrl } from "./utils.js";

export { normalizeApiBaseUrl } from "./utils.js";

function generatePeerId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return (
    "PC-" +
    Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Browser voice-call client for Dograh public embed (REST init + WS signaling).
 * Mirrors the voice path in `ui/public/embed/dograh-widget.js`.
 */
export class DograhVoiceCallClient {
  private readonly embedToken: string;
  private readonly apiBaseUrl: string;
  private readonly origin: string;
  private context: Record<string, string | number | boolean | null>;
  private readonly playRemoteAudio: boolean;
  private readonly callbacks: Pick<
    DograhVoiceCallClientOptions,
    | "onStatusChange"
    | "onError"
    | "onConnected"
    | "onDisconnected"
    | "onToolCallStart"
    | "onToolCallEnd"
  >;

  private status: VoiceCallStatus = "idle";
  private embedConfig: EmbedConfigResponse | null = null;
  private turnCredentials: TurnCredentialsResponse | null = null;
  private session: VoiceCallSession | null = null;

  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private pcId: string | null = null;
  private callStartedAt: number | null = null;
  private gracefulDisconnect = false;
  private toolCalls = new Map<string, ToolCallState>();

  constructor(options: DograhVoiceCallClientOptions) {
    this.embedToken = options.embedToken;
    this.apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
    this.origin =
      options.origin ??
      (typeof window !== "undefined" ? window.location.origin : "");
    this.context = { ...(options.context ?? {}) };
    this.playRemoteAudio = options.playRemoteAudio !== false;
    this.callbacks = {
      onStatusChange: options.onStatusChange,
      onError: options.onError,
      onConnected: options.onConnected,
      onDisconnected: options.onDisconnected,
      onToolCallStart: options.onToolCallStart,
      onToolCallEnd: options.onToolCallEnd,
    };
  }

  getStatus(): VoiceCallStatus {
    return this.status;
  }

  getSession(): VoiceCallSession | null {
    return this.session;
  }

  getToolCalls(): ToolCallState[] {
    return Array.from(this.toolCalls.values());
  }

  setContext(context: Record<string, string | number | boolean | null>): void {
    this.context = { ...context };
  }

  async loadConfig(): Promise<EmbedConfigResponse> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/public/embed/config/${this.embedToken}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Origin: this.origin,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch embed config: ${response.status}`);
    }

    const data = (await response.json()) as EmbedConfigResponse;
    if (data.settings?.widgetType === "chat") {
      throw new Error("Embed token is configured for chat, not voice");
    }

    this.embedConfig = data;
    return data;
  }

  async start(): Promise<void> {
    this.gracefulDisconnect = false;
    this.toolCalls.clear();
    this.setStatus("connecting");

    try {
      if (!this.embedConfig) {
        await this.loadConfig();
      }

      await this.initializeSession();
      await this.acquireMicrophone();
      this.createPeerConnection();
      await this.connectWebSocket();
      await this.negotiate();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.cleanupMedia();
      this.setStatus("failed");
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  end(): void {
    this.stopCall({ graceful: true });
  }

  private setStatus(status: VoiceCallStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  private async initializeSession(): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/public/embed/init`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: this.origin,
        },
        body: JSON.stringify({
          token: this.embedToken,
          context_variables: this.context,
        }),
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        detail?: string;
      };
      throw new Error(body.detail ?? "Failed to initialize embed session");
    }

    const data = (await response.json()) as EmbedInitResponse;
    this.session = {
      sessionToken: data.session_token,
      workflowRunId: data.workflow_run_id,
      workflowId: data.config.workflow_id,
    };

    await this.fetchTurnCredentials();
  }

  private async fetchTurnCredentials(): Promise<void> {
    if (this.embedConfig?.turn_enabled === false || !this.session) {
      return;
    }

    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/public/embed/turn-credentials/${this.session.sessionToken}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Origin: this.origin,
        },
      },
    );

    if (response.ok) {
      this.turnCredentials = (await response.json()) as TurnCredentialsResponse;
    } else if (response.status !== 503) {
      console.warn(`Failed to fetch TURN credentials: ${response.status}`);
    }
  }

  private async acquireMicrophone(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
      }
      this.stream = stream;
    } catch (micError) {
      const err = micError as DOMException;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        throw new Error(
          "Microphone permission denied. Allow microphone access to start the call.",
        );
      }
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        throw new Error("No microphone found.");
      }
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        throw new Error("Microphone is already in use by another application.");
      }
      throw new Error("Microphone access failed.");
    }
  }

  private createPeerConnection(): void {
    const forceTurnRelay = Boolean(this.embedConfig?.force_turn_relay);
    const iceServers: RTCIceServer[] = forceTurnRelay
      ? []
      : [{ urls: ["stun:stun.l.google.com:19302"] }];

    if (this.turnCredentials?.uris?.length) {
      iceServers.push({
        urls: this.turnCredentials.uris,
        username: this.turnCredentials.username,
        credential: this.turnCredentials.password,
      });
    }

    if (forceTurnRelay && iceServers.length === 0) {
      console.error(
        "FORCE_TURN_RELAY is on but no TURN credentials are available.",
      );
    }

    const config: RTCConfiguration = { iceServers };
    if (forceTurnRelay) {
      config.iceTransportPolicy = "relay";
    }

    this.pc = new RTCPeerConnection(config);

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.stream!);
      });
    }

    if (this.playRemoteAudio && typeof document !== "undefined") {
      if (!this.audioElement) {
        this.audioElement = document.createElement("audio");
        this.audioElement.autoplay = true;
        this.audioElement.style.display = "none";
        document.body.appendChild(this.audioElement);
      }
    }

    this.pc.ontrack = (event) => {
      if (event.track.kind === "audio" && this.audioElement) {
        this.audioElement.srcObject = event.streams[0] ?? null;
      }
    };

    this.pc.oniceconnectionstatechange = () => this.handleConnectionState();
    this.pc.onconnectionstatechange = () => this.handleConnectionState();
    this.pc.onicecandidate = (event) => this.sendIceCandidate(event);
  }

  private handleConnectionState(): void {
    const pc = this.pc;
    if (!pc) return;

    if (
      pc.connectionState === "connected" ||
      pc.iceConnectionState === "connected" ||
      pc.iceConnectionState === "completed"
    ) {
      const wasConnected = this.callStartedAt !== null;
      this.setStatus("connected");
      if (!wasConnected && this.session) {
        this.callStartedAt = Date.now();
        this.callbacks.onConnected?.({
          workflowId: this.session.workflowId,
          workflowRunId: this.session.workflowRunId,
          sessionToken: this.session.sessionToken,
        });
      }
      return;
    }

    if (pc.connectionState === "failed" || pc.iceConnectionState === "failed") {
      this.stopCall({ graceful: false, status: "failed" });
      return;
    }

    if (
      pc.connectionState === "closed" ||
      pc.connectionState === "disconnected" ||
      pc.iceConnectionState === "closed" ||
      pc.iceConnectionState === "disconnected"
    ) {
      this.stopCall({ graceful: true });
    }
  }

  private sendIceCandidate(event: RTCPeerConnectionIceEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "ice-candidate",
      payload: {
        candidate: event.candidate
          ? {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            }
          : null,
        pc_id: this.pcId,
      },
    };
    this.ws.send(JSON.stringify(message));
  }

  private connectWebSocket(): Promise<void> {
    if (!this.session) {
      return Promise.reject(new Error("No embed session"));
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `${httpToWs(this.apiBaseUrl)}/api/v1/ws/public/signaling/${this.session!.sessionToken}`;
      this.ws = new WebSocket(wsUrl);
      this.pcId = generatePeerId();

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("WebSocket connection failed"));

      this.ws.onclose = (event) => {
        this.ws = null;
        if (event.reason === "call ended") {
          this.stopCall({ graceful: true, closeWebSocket: false });
          return;
        }
        if (this.status === "connected" && !this.gracefulDisconnect) {
          this.setStatus("failed");
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(String(event.data)) as SignalingMessage;
          await this.handleWebSocketMessage(message);
        } catch (e) {
          console.error("Failed to handle WebSocket message", e);
        }
      };
    });
  }

  private async handleWebSocketMessage(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case "answer": {
        const answer = message.payload as { sdp: string };
        await this.pc!.setRemoteDescription({ type: "answer", sdp: answer.sdp });
        break;
      }
      case "ice-candidate": {
        const payload = message.payload as {
          candidate: RTCIceCandidateInit | null;
        };
        if (payload.candidate) {
          await this.pc!.addIceCandidate(payload.candidate);
        }
        break;
      }
      case "error": {
        const payload = message.payload as { message?: string };
        this.setStatus("failed");
        this.callbacks.onError?.(
          new Error(payload.message ?? "Signaling server error"),
        );
        break;
      }
      case "call-ended":
        this.stopCall({ graceful: true });
        break;
      case "rtf-function-call-start": {
        const call = toolCallStartFromMessage(message);
        if (!call) break;
        this.toolCalls.set(call.toolCallId, call);
        this.callbacks.onToolCallStart?.(call);
        break;
      }
      case "rtf-function-call-end": {
        const payload = message.payload as { tool_call_id?: string } | undefined;
        const existing = payload?.tool_call_id
          ? this.toolCalls.get(payload.tool_call_id)
          : undefined;
        const call = toolCallEndFromMessage(message, existing);
        if (!call) break;
        this.toolCalls.set(call.toolCallId, call);
        this.callbacks.onToolCallEnd?.(call);
        break;
      }
      default:
        break;
    }
  }

  private async negotiate(): Promise<void> {
    if (!this.pc || !this.ws || !this.session) {
      throw new Error("WebRTC not initialized");
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const message = {
      type: "offer",
      payload: {
        sdp: offer.sdp,
        type: "offer",
        pc_id: this.pcId,
        workflow_id: this.session.workflowId,
        workflow_run_id: this.session.workflowRunId,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  private stopCall(options: {
    graceful?: boolean;
    closeWebSocket?: boolean;
    status?: VoiceCallStatus;
  } = {}): void {
    const graceful = options.graceful !== false;
    const closeWebSocket = options.closeWebSocket !== false;
    const status = options.status ?? "ended";

    this.gracefulDisconnect = graceful;

    if (this.callStartedAt && this.session) {
      const durationSeconds = Math.round(
        (Date.now() - this.callStartedAt) / 1000,
      );
      this.callbacks.onDisconnected?.({
        workflowId: this.session.workflowId,
        workflowRunId: this.session.workflowRunId,
        sessionToken: this.session.sessionToken,
        durationSeconds,
      });
    }
    this.callStartedAt = null;

    this.setStatus(status);

    if (closeWebSocket && this.ws) {
      const ws = this.ws;
      this.ws = null;
      if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close();
      }
    } else if (!closeWebSocket) {
      this.ws = null;
    }

    this.cleanupMedia();
  }

  private cleanupMedia(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.pc) {
      const pc = this.pc;
      this.pc = null;
      if (pc.signalingState !== "closed") {
        pc.close();
      }
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }
  }

  destroy(): void {
    this.stopCall({ graceful: true });
    if (this.audioElement?.parentNode) {
      this.audioElement.parentNode.removeChild(this.audioElement);
    }
    this.audioElement = null;
  }
}
