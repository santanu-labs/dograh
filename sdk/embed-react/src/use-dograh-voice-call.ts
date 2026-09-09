import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ToolCallState,
  UseDograhVoiceCallOptions,
  UseDograhVoiceCallResult,
  VoiceCallSession,
  VoiceCallStatus,
} from "./types.js";
import { DograhVoiceCallClient } from "./voice-call-client.js";

export function useDograhVoiceCall(
  options: UseDograhVoiceCallOptions,
): UseDograhVoiceCallResult {
  const {
    autoLoadConfig = true,
    embedToken,
    apiBaseUrl,
    origin,
    context,
    playRemoteAudio,
    onStatusChange,
    onError,
    onConnected,
    onDisconnected,
    onToolCallStart,
    onToolCallEnd,
  } = options;

  const [status, setStatus] = useState<VoiceCallStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState<VoiceCallSession | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);
  const [isReady, setIsReady] = useState(false);

  const clientRef = useRef<DograhVoiceCallClient | null>(null);

  const client = useMemo(() => {
    const instance = new DograhVoiceCallClient({
      embedToken,
      apiBaseUrl,
      origin,
      context,
      playRemoteAudio,
      onStatusChange: (next) => {
        setStatus(next);
        onStatusChange?.(next);
      },
      onError: (err) => {
        setError(err);
        onError?.(err);
      },
      onConnected: (info) => {
        setSession({
          sessionToken: info.sessionToken,
          workflowRunId: info.workflowRunId,
          workflowId: info.workflowId,
        });
        onConnected?.(info);
      },
      onDisconnected: (info) => {
        onDisconnected?.(info);
      },
      onToolCallStart: (call) => {
        setToolCalls((prev) => {
          const idx = prev.findIndex((c) => c.toolCallId === call.toolCallId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = call;
            return next;
          }
          return [...prev, call];
        });
        onToolCallStart?.(call);
      },
      onToolCallEnd: (call) => {
        setToolCalls((prev) => {
          const idx = prev.findIndex((c) => c.toolCallId === call.toolCallId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = call;
            return next;
          }
          return [...prev, call];
        });
        onToolCallEnd?.(call);
      },
    });
    clientRef.current = instance;
    return instance;
  }, [embedToken, apiBaseUrl, origin, playRemoteAudio]);

  useEffect(() => {
    if (!autoLoadConfig) {
      setIsReady(true);
      return;
    }

    let cancelled = false;
    client
      .loadConfig()
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err);
          setIsReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [autoLoadConfig, client]);

  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setToolCalls([]);
    await client.start();
    const active = client.getSession();
    if (active) setSession(active);
  }, [client]);

  const end = useCallback(() => {
    client.end();
  }, [client]);

  const setContext = useCallback(
    (next: Record<string, string | number | boolean | null>) => {
      client.setContext(next);
    },
    [client],
  );

  return {
    status,
    error,
    session,
    toolCalls,
    isReady,
    start,
    end,
    setContext,
  };
}
