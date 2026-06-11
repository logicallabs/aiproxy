# AI Proxy Reverse Proxy Server

This folder contains a lightweight Node.js reverse proxy server that forwards model-specific prompt payloads to Gemini, GitHub Models, OpenRouter, and DeepSeek.

The server also serves static files from this folder for `GET` requests.

## Dual-Runtime Port Status

This repo now includes a phased port toward dual runtime support:

- Node runtime for local development and DigitalOcean App Platform
- Cloudflare Worker runtime adapter

Implementation phases, scope, and checkpoints are documented in:

- `DUAL_RUNTIME_PORT_PLAN.md`

Current branch-level implementation status:

- Phase 1 complete: shared runtime-agnostic core modules under `src/core/`
- Phase 2 complete: Node adapter (`src/node/server.js`) and Worker adapter (`src/worker/worker.js`)
- Phase 3 complete: `wrangler.toml` has `dev` (default) and `production` environments with separate worker names and routes
- Phase 4 complete: full test matrix documented below

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

`start.sh` sources `.env` if it exists (fallback to legacy `.env.modelspecs`), exports the variables above, prompts for missing API keys, and starts `server.cjs`.

Use `.env.modelspecs.example` as the tracked template, then create your local `.env` with real credentials.

Template file:

```bash
cp .env.modelspecs.example .env
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

`.env` should stay untracked and contain your real keys. `.env.modelspecs.example` is the safe file to commit and document.

## How To Run (Local / Dev)

There are two ways to start the server locally. Both end up running `node server.cjs` — they differ only in how environment variables are supplied.

### Option A — via start.sh (recommended for local dev)

`start.sh` sources `.env` if it exists (fallback to `.env.modelspecs`), exports all required variables, and prompts interactively for any that are still missing (e.g. API keys). This is the easiest path when you do not want to export variables manually.

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

## Cloudflare Worker

The Worker adapter uses the same API route contract as Node for `POST` endpoints. Static file serving is not supported in the Worker — it handles API routes only.

Before using the Worker on a machine, run `npx wrangler login` once so Wrangler can authenticate with Cloudflare. The committed files intentionally stay generic; Cloudflare names, routes, account IDs, and zone details live in the untracked `.worker.local.env` file.

`wrangler.toml` is a public template. The restore script renders the actual Cloudflare values from `.worker.local.env`.

| Environment | Worker name | Custom domain | Command |
|---|---|---|---|
| dev (default) | `CF_DEV_WORKER_NAME` | `CF_DEV_CUSTOM_DOMAIN` | `npm run worker:deploy` |
| production | `CF_PROD_WORKER_NAME` | `CF_PROD_CUSTOM_DOMAIN` | `npm run worker:deploy:prod` |

> When you decide to cut over the public production domain to the Worker, update the values in your local `.worker.local.env` file, rerun `npm run worker:deploy:prod`, and change the DNS CNAME. No committed file needs to change for that cutover.

### First-time secret setup

Run once per environment. Secrets are stored in Cloudflare and never in `wrangler.toml`.

```bash
# Dev secrets (default)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put DEEPSEEK_API_KEY

# Production secrets
npx wrangler secret put GEMINI_API_KEY -e production
npx wrangler secret put GITHUB_TOKEN -e production
npx wrangler secret put OPENROUTER_API_KEY -e production
npx wrangler secret put DEEPSEEK_API_KEY -e production
```

### Run Worker locally (emulated)

```bash
npm run worker:dev
```

Wrangler runs the Worker on `http://127.0.0.1:8787` using a local runtime emulation layer. The script reads `.env` for API credentials and `.worker.local.env` for Cloudflare-specific names/routes.

The local machine needs all of the following before this can work:

- `npx wrangler login`
- `.env` with provider credentials
- `.worker.local.env` with Cloudflare account, zone, worker names, and routes
- DNS access to the relevant Cloudflare zone if you want the custom domain to resolve

### Deploy to Cloudflare

```bash
# Deploy to dev environment
npm run worker:deploy

# Deploy to production environment
npm run worker:deploy:prod
```

### Custom domain DNS

Cloudflare route bindings in `wrangler.toml` do not create DNS records automatically. Each hostname needs a CNAME in your DNS zone:

| Name | Target | Proxy |
|---|---|---|
| `CF_DEV_CUSTOM_DOMAIN` host | `CF_DEV_WORKER_NAME.workers.dev` | Proxied |
| `CF_PROD_CUSTOM_DOMAIN` host | `CF_PROD_WORKER_NAME.workers.dev` | Proxied |

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

The test suite has two layers and can target any runtime via `TEST_BASE_URL`.

### Test Matrix

| Layer | What it tests | Command | Prerequisites |
|---|---|---|---|
| Unit | Local logic, retry, history rollback | `npm test` | None |
| Live — Node local | Full proxy via local Node server | `npm run test:live` | `npm run start:dev` running |
| Live — Worker local | Full proxy via wrangler emulation | `TEST_BASE_URL=http://127.0.0.1:8787 npm run test:live` | `npm run worker:dev` running |
| Live — CF dev | Full proxy via deployed dev Worker | `TEST_BASE_URL=https://<CF_DEV_CUSTOM_DOMAIN> npm run test:live` | Worker deployed, DNS live |
| Live — CF prod | Full proxy via deployed prod Worker | `TEST_BASE_URL=https://<CF_PROD_CUSTOM_DOMAIN> npm run test:live` | Worker deployed, DNS live |
| Live — DO App | Full proxy via deployed DO App | `TEST_BASE_URL=https://<DO_APP_URL> npm run test:live` | DO App running |
| All local | Unit + Node live together | `npm run test:all` | `npm run start:dev` running |

### Unit Tests

```bash
npm test
```

No network required. Covers retry behavior, empty-response handling, rollback of failed user turns, and conversation-history updates. CI-safe.

### Live Integration Tests

```bash
# Node local (requires: npm run start:dev in another terminal)
npm run test:live

# Worker local emulation (requires: npm run worker:dev in another terminal)
TEST_BASE_URL=http://127.0.0.1:8787 npm run test:live

# Deployed Cloudflare dev Worker
TEST_BASE_URL=https://<CF_DEV_CUSTOM_DOMAIN> npm run test:live

# Deployed Cloudflare production Worker
TEST_BASE_URL=https://<CF_PROD_CUSTOM_DOMAIN> npm run test:live
```

Tests can skip individual providers when an upstream returns a transient overload (e.g. Gemini high demand).

### Run Unit + Node Live Together

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
