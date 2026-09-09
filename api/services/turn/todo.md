# Dograh on Railway — complete task list

Work through these in order. Each item builds on the previous ones.

---

## Phase 0 — Baseline (mostly done)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Deploy Dograh template on Railway (Leave Studio / `zealous-friendship`) | ✅ Done | 5 services: api, ui, postgres, redis, minio |
| 0.2 | Wire API to fork `santanu-labs/dograh@main` | ✅ Done | Commit `910cca40` |
| 0.3 | Build with `deploy/railway/Dockerfile` overlay | ✅ Done | Overlays Cloudflare TURN on `dograhai/dograh-api:1.45.0` |
| 0.4 | Enable Cloudflare TURN on API | ✅ Done | `ENABLE_COTURN`, `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN`, `FORCE_TURN_RELAY=true` |
| 0.5 | Verify health | ✅ Done | `turn_enabled: true`, `force_turn_relay: true` |
| 0.6 | Verify browser test calls (audio, not just signaling) | ✅ Done | Run 12: 2.6MB audio, TURN relay, LLM/tools worked; no audio-frame failures |
| 0.7 | Rotate Cloudflare TURN API token | ⬜ Todo | Token was shared in chat; rotate in Cloudflare dashboard |
| 0.8 | Set `ENABLE_SIGNUP=false` on API after first account | ✅ Done | Set on Railway API service |

**URLs**
- UI: `https://ui-production-3b6b.up.railway.app`
- API: `https://api-production-ccfc.up.railway.app`

---

## Phase 1 — Recordings via Cloudflare R2 (replace MinIO)

**Finding:** Cloud recordings work because Dograh cloud uses AWS S3. On Railway, run 12 captured audio but upload failed after ~2.5 min (`Storage backend rejected mixed audio upload`). Root cause: API uploads to MinIO over public HTTPS; unreliable on Railway. **Decision: use R2 instead of fixing MinIO.**

| # | Task | Details |
|---|------|---------|
| 1.1 | Create R2 bucket | ✅ Done — `dograh-voice-audio` (APAC) |
| 1.2 | Create R2 API token | ✅ Done |
| 1.3 | Enable public access or CORS on R2 | ✅ Done — CORS (not public bucket) |
| 1.4 | Set R2 CORS policy | ✅ Done — `wrangler r2 bucket cors set dograh-voice-audio` |
| 1.5 | Note R2 S3 endpoint | ✅ `https://f4c10eea82683bea7d7cb1af3bf045e3.r2.cloudflarestorage.com` |
| 1.6 | Update Railway **api** env vars | ✅ Done — R2 S3 + credentials on API |
| 1.7 | Remove or stop **minio** service | ⬜ Todo — optional; R2 is live, MinIO unused |
| 1.8 | Redeploy API | ✅ Done |
| 1.9 | Run a browser test call | ✅ Done |
| 1.10 | Verify upload in logs | ✅ Done — R2 upload succeeds |
| 1.11 | Verify DB | ✅ Done — `recording_url` set |
| 1.12 | Verify UI playback | ✅ Done — user confirmed |
| 1.13 | Test library recordings upload | ⬜ Todo — optional |
| 1.14 | Test transcript download | ⬜ Todo — optional |

**Railway API variables for R2**

```bash
ENABLE_AWS_S3=true
S3_BUCKET=dograh-voice-audio          # your bucket name
S3_REGION=auto                         # R2 uses "auto"
S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_SIGNATURE_VERSION=s3v4
S3_ADDRESSING_STYLE=path
AWS_ACCESS_KEY_ID=<R2 access key>
AWS_SECRET_ACCESS_KEY=<R2 secret key>
```

**Remove or ignore (after minio removed):**
- `RAILWAY_SERVICE_MINIO_URL`
- MinIO-specific references in template

**Relevant code paths**
- `api/services/workflow_run_artifacts.py` — upload at call end
- `api/services/filesystem/s3.py` — S3/R2 client
- `api/routes/s3_signed_url.py` — playback URLs
- `ui/src/lib/files.ts` — UI download/preview

---

## Phase 2 — Harden Railway deployment

| # | Task | Details |
|---|------|---------|
| 2.1 | Set `FORCE_TURN_RELAY=false` after TURN verified | Optional; `true` is safer on PaaS |
| 2.2 | Confirm `FORWARDED_ALLOW_IPS=*` on API | Required for telephony webhooks behind Railway edge |
| 2.3 | Set provider keys in UI | STT/TTS/LLM (e.g. Sarvam, Gemini) |
| 2.4 | Set `TELEPHONY_WS_TOKEN_ENFORCE=true` | After telephony works; template two-step |
| 2.5 | Document env vars in fork | ✅ Done — `docs/developer/environment-variables.mdx` R2 + Railway; `deploy/railway/R2.md` |
| 2.6 | Update Railway template manifest (optional) | PR to upstream or fork template: R2 instead of MinIO |
| 2.7 | Merge Cloudflare TURN PR to upstream (optional) | `santanu-labs/dograh` → `dograh-hq/dograh` |

---

## Phase 3 — React SDK for browser voice calls (`@dograh/embed-react`)

**Finding:** No published React hook. Options today: `dograh-widget.js` (script tag) or internal `useWebSocketRTC` (auth-only, not embed). `@dograh/sdk` is workflow authoring only.

| # | Task | Status | Details |
|---|------|--------|---------|
| 3.1 | Create package scaffold | ✅ Done | `sdk/embed-react/` |
| 3.2 | Extract shared WebRTC client | ✅ Done (in-package) | `DograhVoiceCallClient` mirrors widget; separate `@dograh/embed-core` deferred |
| 3.3 | Define public types | ✅ Done | `src/types.ts` |
| 3.4 | Implement `useDograhVoiceCall` hook | ✅ Done | Init, start, end, status, error |
| 3.5 | Wire public REST APIs | ✅ Done | config, init, TURN creds |
| 3.6 | Wire public WebSocket | ✅ Done | public signaling WS |
| 3.7 | Implement `<DograhVoiceCall />` component | ✅ Done | Render-prop + default UI |
| 3.8 | Support `context` / `setContext` | ✅ Done | |
| 3.9 | Publish to npm | ⬜ Todo | Local `@dograh/embed-react@0.1.0` only |
| 3.10 | Add docs + example app | ✅ Partial | README + `examples/embed-react/` stub |
| 3.11 | Add tests | ✅ Partial | URL utils; WS state machine tests todo |

**Reference files**
- `ui/public/embed/dograh-widget.js`
- `ui/src/app/workflow/.../hooks/useWebSocketRTC.tsx`
- `api/routes/public_embed.py`
- `api/routes/webrtc_signaling.py` (public WS ~line 880)
- `docs/voice-agent/add-to-website.mdx`

**Target API**

```tsx
const { status, start, end, error, session } = useDograhVoiceCall({
  embedToken: "...",
  apiBaseUrl: "https://api-production-ccfc.up.railway.app",
  context: { userId: "123" },
});
```

---

## Phase 4 — Tool call observation in React hook

**Finding:** Tools run server-side. UI tester receives `rtf-function-call-start/end` over WS but only stores them internally. Embed widget ignores them.

| # | Task | Status | Details |
|---|------|--------|---------|
| 4.1 | Extend embed WS handler | ✅ Done | `DograhVoiceCallClient` handles start/end |
| 4.2 | Add hook callbacks | ✅ Done | `onToolCallStart`, `onToolCallEnd` |
| 4.3 | Expose `toolCalls` state | ✅ Done | Hook state array |
| 4.4 | Update `dograh-widget.js` | ✅ Done | `onToolCallStart` / `onToolCallEnd` |
| 4.5 | Verify public WS sends tool events | ✅ Done | Same `RealtimeFeedbackObserver` path as authenticated WS |
| 4.6 | Add TypeScript types | ✅ Done | `ToolCallState` in `types.ts` |
| 4.7 | Document in embed-react README | ✅ Done | Tool call example in README |
| 4.8 | Add tests | ⬜ Todo | WS message → hook state updates |

**Reference files**
- `api/services/pipecat/realtime_feedback_observer.py`
- `api/services/pipecat/realtime_feedback_events.py`
- `ui/src/app/workflow/.../hooks/useWebSocketRTC.tsx` (lines ~495–526)
- `ui/src/components/workflow/conversation/types.ts`

---

## Phase 5 — Client-side tool execution (browser runs tools)

**Finding:** No browser tool protocol exists. All tools execute in `CustomToolManager` on the server. Client invocation needs new backend + WS protocol.

| # | Task | Details |
|---|------|---------|
| 5.1 | Design WS protocol | `tool-invoke-request` (server→client), `tool-invoke-result` (client→server) |
| 5.2 | Add `browser_tool` / `client_tool` category | `api/enums.py`, tool schema, DB |
| 5.3 | Implement server stub handler | Await client result with timeout in `CustomToolManager` |
| 5.4 | Wire into signaling WS | Route invoke/result on authenticated + public paths |
| 5.5 | Security model | Allowlist per workflow; embed origin checks; no arbitrary code |
| 5.6 | Add `useDograhClientTools` hook | `handlers: Record<string, (args) => Promise<unknown>>` |
| 5.7 | UI for tool registration in workflow builder | Optional: mark tools as “browser-executed” |
| 5.8 | Integration tests | End-to-end: LLM calls tool → browser runs → result back |
| 5.9 | Document security implications | Embed docs: only trusted origins, handler allowlist |

**Reference files**
- `api/services/workflow/pipecat_engine_custom_tools.py`
- `api/services/workflow/tools/custom_tool.py`
- `api/routes/webrtc_signaling.py`

**Target API**

```tsx
useDograhVoiceCall({
  clientTools: {
    lookupOrder: async ({ orderId }) => fetch(`/api/orders/${orderId}`).then(r => r.json()),
  },
  onToolCallStart: ...,
  onToolCallEnd: ...,
});
```

---

## Phase 6 — SDK / product alignment (optional)

| # | Task | Details |
|---|------|---------|
| 6.1 | Extend `@dograh/sdk` or keep separate | `@dograh/sdk` = authoring; `@dograh/embed-react` = runtime |
| 6.2 | Export widget TypeScript types | `@dograh/embed-types` for `window.DograhWidget` |
| 6.3 | Chat embed hook | `useDograhChat` mirroring voice (public embed chat API) |
| 6.4 | Upstream contributions | Cloudflare TURN, R2 Railway docs, embed-react |

---

## Summary: recommended sequence

```
Phase 0  → finish verification (0.6–0.8)
Phase 1  → R2 storage (recordings)          ← you chose R2
Phase 2  → harden Railway
Phase 3  → @dograh/embed-react hook
Phase 4  → tool call observation
Phase 5  → client-side tool execution       ← largest; only if needed
Phase 6  → polish / upstream
```

---

## Quick reference: what works vs what doesn’t today

| Capability | Dograh cloud | Your Railway (now) | After R2 | After embed-react |
|------------|--------------|--------------------|----------|-------------------|
| Dashboard / workflows | ✅ | ✅ | ✅ | ✅ |
| Browser voice calls | ✅ | ✅ (with Cloudflare TURN) | ✅ | ✅ |
| Call recordings | ✅ | ❌ (upload fails) | ✅ | ✅ |
| React hook for calls | ❌ (widget only) | ❌ | ❌ | ✅ (local package) |
| Observe tool calls in app | N/A | ❌ | ❌ | ✅ (Phase 4, local) |
| Browser executes tools | ❌ | ❌ | ❌ | ✅ (Phase 5) |
| Phone via carrier | ✅ | ✅ (bring Twilio etc.) | ✅ | ✅ |

---

Say which phase to start with and I can execute it step by step (e.g. Phase 1 R2 env vars on Railway + R2 setup checklist, or Phase 3 package scaffold in your fork).