# @dograh/embed-react

React hooks and a headless client for **browser voice calls** against a self-hosted or cloud Dograh deployment via the [public embed API](https://docs.dograh.com/voice-agent/add-to-website).

Use this when you want your own React UI instead of the `dograh-widget.js` script tag.

## Install

```bash
npm install @dograh/embed-react
```

Peer dependency: React 18+.

## Quick start

```tsx
import { useDograhVoiceCall } from "@dograh/embed-react";

export function VoiceAgent() {
  const { status, start, end, error, toolCalls } = useDograhVoiceCall({
    embedToken: process.env.NEXT_PUBLIC_DOGRAH_EMBED_TOKEN!,
    apiBaseUrl: "https://api-production-ccfc.up.railway.app",
    context: { userId: "123" },
    onToolCallStart: (call) => console.log("tool start", call),
    onToolCallEnd: (call) => console.log("tool end", call),
  });

  return (
    <div>
      <p>Status: {status}</p>
      {error ? <p>{error.message}</p> : null}
      <button onClick={() => void start()} disabled={status === "connecting"}>
        Start
      </button>
      <button onClick={end} disabled={status !== "connected"}>
        End
      </button>
      <ul>
        {toolCalls.map((t) => (
          <li key={t.toolCallId}>
            {t.functionName} ({t.status})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Embed token

Create an embed token in the Dograh UI: **Workflow → Settings → Embed**. Allow your site origin in the token's domain list.

## API

### `useDograhVoiceCall(options)`

| Option | Description |
|--------|-------------|
| `embedToken` | Public embed token from the dashboard |
| `apiBaseUrl` | Dograh API base URL (no trailing slash) |
| `context` | Template variables passed to `POST /public/embed/init` |
| `onToolCallStart` / `onToolCallEnd` | Server-side tool invocations during the call |
| `autoLoadConfig` | Prefetch embed config on mount (default `true`) |

Returns `{ status, error, session, toolCalls, isReady, start, end, setContext }`.

### `DograhVoiceCallClient`

Headless class with the same behavior for non-React apps. Exported from this package.

### `DograhVoiceCall`

Optional render-prop wrapper with a minimal default button UI.

## Related

- [`@dograh/sdk`](../typescript/) — workflow authoring (not runtime calls)
- [`dograh-widget.js`](../../ui/public/embed/dograh-widget.js) — script-tag embed
