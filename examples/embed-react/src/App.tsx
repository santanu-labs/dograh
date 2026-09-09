import { useDograhVoiceCall } from "@dograh/embed-react";

const apiBaseUrl = import.meta.env.VITE_DOGRAH_API_URL;
const embedToken = import.meta.env.VITE_DOGRAH_EMBED_TOKEN;

export function App() {
  const { status, error, toolCalls, isReady, start, end } = useDograhVoiceCall({
    embedToken: embedToken ?? "",
    apiBaseUrl: apiBaseUrl ?? "",
    context: { source: "embed-react-example" },
    onToolCallStart: (call) => {
      console.log("[tool start]", call.functionName, call.arguments);
    },
    onToolCallEnd: (call) => {
      console.log("[tool end]", call.functionName, call.result);
    },
  });

  const missingConfig = !apiBaseUrl || !embedToken;
  const inCall = status === "connected" || status === "connecting";

  return (
    <main className="page">
      <h1>Dograh voice embed</h1>
      <p className="muted">
        Minimal React example using{" "}
        <code>@dograh/embed-react</code> via a local{" "}
        <code>file:</code> dependency.
      </p>

      {missingConfig ? (
        <p className="error" role="alert">
          Set <code>VITE_DOGRAH_API_URL</code> and{" "}
          <code>VITE_DOGRAH_EMBED_TOKEN</code> in <code>.env</code> (see{" "}
          <code>.env.example</code>).
        </p>
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
            disabled={missingConfig || !isReady || inCall}
            onClick={() => void start()}
          >
            Start call
          </button>
          <button
            type="button"
            disabled={!inCall}
            onClick={() => end()}
          >
            End call
          </button>
        </div>

        {error ? (
          <p className="error" role="alert">
            {error.message}
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
                {tool.result ? (
                  <pre>{tool.result}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
