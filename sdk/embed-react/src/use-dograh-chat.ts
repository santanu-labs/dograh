import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DograhChatClient } from "./chat-client.js";
import type {
  ChatSession,
  ChatStatus,
  ChatTurn,
  UseDograhChatOptions,
  UseDograhChatResult,
} from "./types.js";

export function useDograhChat(options: UseDograhChatOptions): UseDograhChatResult {
  const {
    autoStart = false,
    embedToken,
    apiBaseUrl,
    origin,
    context,
    onMessage,
    onStatusChange,
    onError,
  } = options;

  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const clientRef = useRef<DograhChatClient | null>(null);
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onStatusChangeRef.current = onStatusChange;
  onErrorRef.current = onError;

  const client = useMemo(() => {
    const instance = new DograhChatClient({
      embedToken,
      apiBaseUrl,
      origin,
      context,
      onStatusChange: (next) => {
        setStatus(next);
        onStatusChangeRef.current?.(next);
      },
      onError: (err) => {
        setError(err);
        onErrorRef.current?.(err);
      },
      onMessage: (text, turn) => {
        setTurns((prev) => {
          const idx = prev.findIndex((item) => item.id === turn.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = turn;
            return next;
          }
          return [...prev, turn];
        });
        onMessageRef.current?.(text, turn);
      },
    });
    clientRef.current = instance;
    return instance;
  }, [embedToken, apiBaseUrl, origin, context]);

  useEffect(() => {
    if (!autoStart || !embedToken.trim() || !apiBaseUrl.trim()) {
      return;
    }

    let cancelled = false;
    client
      .start()
      .then(() => {
        if (!cancelled) {
          setSession(client.getSession());
          setTurns(client.getTurns());
        }
      })
      .catch(() => {
        /* onError already fired */
      });

    return () => {
      cancelled = true;
    };
  }, [autoStart, client, embedToken, apiBaseUrl]);

  const sendMessage = useCallback(
    async (text: string) => {
      setError(null);
      await client.sendMessage(text);
      setSession(client.getSession());
      setTurns(client.getTurns());
    },
    [client],
  );

  const end = useCallback(async () => {
    await client.end();
    setSession(client.getSession());
    setTurns(client.getTurns());
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
    turns,
    sendMessage,
    end,
    setContext,
  };
}
