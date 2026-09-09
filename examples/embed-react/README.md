# Dograh embed React example

Minimal Vite + React app that uses `@dograh/embed-react` from the monorepo via a `file:` dependency.

## Setup

```bash
cd examples/embed-react
cp .env.example .env
# Edit .env — set VITE_DOGRAH_EMBED_TOKEN and VITE_DOGRAH_API_URL

npm install   # builds sdk/embed-react via postinstall
npm run dev
```

Open http://localhost:5174. Allow microphone access when prompted.

## Embed token

Create a token in the Dograh UI: **Workflow → Settings → Embed**. Add `http://localhost:5174` to the token's allowed domains.

## Package link

`package.json` references the local package:

```json
"@dograh/embed-react": "file:../../sdk/embed-react"
```

After changing the SDK source, rebuild it:

```bash
npm run build --prefix ../../sdk/embed-react
```

Or reinstall in this directory (`npm install`) to run the postinstall build.
