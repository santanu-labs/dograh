import { useMemo, useState } from "react";

import { useDograhVoiceCall } from "@dograh/embed-react";

const apiBaseUrl = import.meta.env.VITE_DOGRAH_API_URL?.trim() ?? "";
const envEmbedToken = import.meta.env.VITE_DOGRAH_EMBED_TOKEN?.trim() ?? "";

function loadStoredToken(): string {
  try {
    return sessionStorage.getItem("dograh_embed_token") ?? "";
  } catch {
    return "";
  }
}

function formatError(message: string): string {
  if (message === "Failed to fetch") {
    return "Could not reach the Dograh API (network/CORS). Add http://localhost:5174 to the embed token allowed domains and restart the dev server after editing .env.";
  }
  return message;
}

export function App() {
  const [tokenOverride, setTokenOverride] = useState(loadStoredToken);
  const embedToken = envEmbedToken || tokenOverride.trim();

  const hookOptions = useMemo(
    () => ({
      embedToken,
      apiBaseUrl,
      context: { source: "embed-react-example" as const },
      autoLoadConfig: Boolean(embedToken && apiBaseUrl),
      onToolCallStart: (call: { functionName: string; arguments?: Record<string, unknown> }) => {
        console.log("[tool start]", call.functionName, call.arguments);
      },
      onToolCallEnd: (call: { functionName: string; result?: string | null }) => {
        console.log("[tool end]", call.functionName, call.result);
      },
    }),
    [embedToken],
  );

  const { status, error, toolCalls, isReady, start, end } =
    useDograhVoiceCall(hookOptions);

  const missingApiUrl = !apiBaseUrl;
  const missingToken = !embedToken;
  const inCall = status === "connected" || status === "connecting";

  return (
    <main className="page">
      <h1>Dograh voice embed</h1>
      <p className="muted">
        Minimal React example using <code>@dograh/embed-react</code> via a local{" "}
        <code>file:</code> dependency.
      </p>

      {missingApiUrl ? (
        <p className="error" role="alert">
          Set <code>VITE_DOGRAH_API_URL</code> in <code>.env</code> and restart{" "}
          <code>npm run dev</code>.
        </p>
      ) : null}

      {missingToken ? (
        <section className="card">
          <h2>Embed token</h2>
          <p className="muted">
            Copy from <strong>Workflow → Settings → Embed</strong> in the Dograh
            UI. Also add <code>http://localhost:5174</code> to allowed domains.
          </p>
          <label className="field">
            <span>Embed token</span>
            <input
              type="text"
              value={tokenOverride}
              placeholder="emb_..."
              onChange={(event) => {
                const value = event.target.value;
                setTokenOverride(value);
                try {
                  sessionStorage.setItem("dograh_embed_token", value);
                } catch {
                  /* ignore */
                }
              }}
            />
          </label>
        </section>
      ) : null}

      <section className="card">
        <dl className="meta">
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>Ready</dt>
            <dd>{isReady ? "yes" : "no"}</dd>
          </div>
        </dl>

        <div className="actions">
          <button
            type="button"
            disabled={missingApiUrl || missingToken || !isReady || inCall}
            onClick={() => void start()}
          >
            Start call
          </button>
          <button type="button" disabled={!inCall} onClick={() => end()}>
            End call
          </button>
        </div>

        {error ? (
          <p className="error" role="alert">
            {formatError(error.message)}
          </p>
        ) : null}
      </section>

      {toolCalls.length > 0 ? (
        <section className="card">
          <h2>Tool calls</h2>
          <ul className="tool-list">
            {toolCalls.map((tool) => (
              <li key={tool.toolCallId}>
                <strong>{tool.functionName}</strong> — {tool.status}
                {tool.result ? <pre>{tool.result}</pre> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
