# AI Proxy Reverse Proxy Server

This folder contains a lightweight Node.js reverse proxy server that forwards model-specific prompt payloads to Gemini, GitHub Models, OpenRouter, and DeepSeek.

The server also serves static files from this folder for `GET` requests.

## What It Does

- Accepts `POST` requests from browser or test clients
- Forwards provider-shaped request bodies upstream
- Normalizes successful responses to `{ "text": "..." }`
- Normalizes upstream errors to `{ "error": "..." }`
- Handles CORS for browser clients

## Runtime Requirement

- Node.js `>=18.0.0`

The project uses the built-in `node:test` runner and ESM imports, so older Node releases will fail to start the test suite.

## Environment Variables

The proxy uses these values:

- `GEMINI_API_KEY`
- `GITHUB_TOKEN`
- `OPENROUTER_API_KEY`
- `DEEPSEEK_API_KEY`
- `PORT` optional, defaults to `3000`
- `GEMINI_MODEL` Gemini model name used to build the Gemini upstream URL
- `GEMINI_URL` required Gemini upstream URL, typically defined in terms of `GEMINI_MODEL` and `GEMINI_API_KEY`
- `GH_URL` required GitHub Models upstream URL
- `OPENROUTER_URL` required OpenRouter chat-completions URL
- `DEEPSEEK_URL` required DeepSeek chat-completions URL

`start.sh` sources `.env.modelspecs` if it exists, exports the variables above, prompts for missing API keys, and starts `server.cjs`.

Use `.env.modelspecs.example` as the tracked template, then create your local `.env.modelspecs` with real credentials.

Template file:

```bash
cp .env.modelspecs.example .env.modelspecs
```

Example `.env.modelspecs.example`:

```bash
GEMINI_API_KEY=your_gemini_key
DEEPSEEK_API_KEY=your_deepseek_key
OPENROUTER_API_KEY=your_openrouter_key
GITHUB_TOKEN=your_github_token
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}"
GH_URL="https://models.inference.ai.azure.com/chat/completions"
DEEPSEEK_URL="https://api.deepseek.com/chat/completions"
OPENROUTER_URL="https://openrouter.ai/api/v1/chat/completions"
PORT=3000
```

With that layout, the Gemini model name appears only once in the file, and `GEMINI_URL` is derived from it when the file is sourced by `bash`.

`.env.modelspecs` should stay untracked and contain your real keys. `.env.modelspecs.example` is the safe file to commit and document.

## How To Run (Local / Dev)

There are two ways to start the server locally. Both end up running `node server.cjs` — they differ only in how environment variables are supplied.

### Option A — via start.sh (recommended for local dev)

`start.sh` sources `.env.modelspecs` if it exists, exports all required variables, and prompts interactively for any that are still missing (e.g. API keys). This is the easiest path when you do not want to export variables manually.

Run it directly:

```bash
bash start.sh
```

Or via npm:

```bash
npm run start:dev
```

### Option B — via npm start (manual env management)

If your environment variables are already exported in your shell session (e.g. via your shell profile or a separate env tool), you can start the server directly without the shell script:

```bash
npm start
```

The server will fail to reach upstream providers if the required variables are not already set — there is no interactive prompt in this path.

### Base URL

```text
http://localhost:3000
```

### Endpoints

- `POST /api/gemprompt`
- `POST /api/ghprompt`
- `POST /api/orprompt`
- `POST /api/dsprompt`

## Request And Response Contract

The proxy forwards the request body you send as-is to the upstream provider. It does not accept a generic `{ prompt, systemPrompt }` body.

Clients should therefore send provider-shaped JSON:

- Gemini clients send a Gemini `generateContent` style payload
- GitHub Models clients send a chat-completions style payload
- OpenRouter clients send a chat-completions style payload
- DeepSeek clients send a chat-completions style payload

Current examples live in these files:

- [/Users/rms/Sites/WY/aiproxy/test/chatmanagers.js](/Users/rms/Sites/WY/aiproxy/test/chatmanagers.js)
- [/Users/rms/Sites/WY/aiproxy/test/endpoints.js](/Users/rms/Sites/WY/aiproxy/test/endpoints.js)

Successful responses are normalized to:

```json
{ "text": "...model output..." }
```

Errors are normalized to:

```json
{ "error": "...message..." }
```

## Testing

The test suite is split into deterministic unit tests and opt-in live integration tests.

### Unit Tests

Run local logic only:

```bash
npm test
```

These tests do not call the network. They cover retry behavior, empty-response handling, rollback of failed user turns, and conversation-history updates. This is the CI-friendly layer because failures here usually mean local code regressed.

### Live Integration Tests

Run the real end-to-end path through the local proxy and upstream providers:

```bash
npm run test:live
```

You can also target a deployed environment by overriding the test base URL:

```bash
TEST_BASE_URL=https://${AIPROXY_DEPLOYED_URL} npm run test:live
```

Requirements:

- the local proxy server is already running (via `bash start.sh`, `npm run start:dev`, or `npm start` with env vars pre-set)
- valid provider credentials are available
- upstream providers are reachable

The live test helpers in this folder now cover Gemini, GitHub Models, OpenRouter, and DeepSeek through the local proxy endpoints.

These tests can skip when a provider returns a transient overload response such as Gemini high demand.

### Run Everything

Run both layers:

```bash
npm run test:all
```

## Why The Tests Were Split

The original prompt test mixed two separate concerns:

- local request and conversation-state logic
- real external provider availability

That made failures ambiguous. A red test could mean broken local code, a stopped proxy, missing credentials, or upstream overload.

The split makes failures easier to interpret:

- unit tests answer: did local code break?
- live tests answer: does the full external system work right now?
