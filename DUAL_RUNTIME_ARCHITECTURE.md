# Dual-Runtime Architecture: Node.js/DigitalOcean App Platform vs. Cloudflare Workers

## Executive Summary

This codebase is designed to deploy the same core proxy application to **two fundamentally different compute platforms**: Node.js (running on DigitalOcean App Platform) and Cloudflare Workers. This document explains what each platform is, why you'd choose one over the other, and how the code achieves this portability.

---

## Platform Comparison

### DigitalOcean App Platform (Node.js)

**What it is:** A traditional, long-running HTTP server that executes on a single (or multiple) virtual machine(s) in a data center.

**How it works:**
- You start a Node.js process that listens on a port (e.g., `localhost:3000`)
- The process remains running continuously, accepting HTTP requests
- Your application maintains state, can spawn child processes, read files from disk, etc.
- DigitalOcean manages the infrastructure (VM, networking, SSL)

**Key characteristics:**
- Full Node.js runtime: all built-in modules available (`fs`, `net`, `child_process`, etc.)
- CommonJS/ESM module system with full npm ecosystem
- Predictable execution: process runs continuously
- Latency: requests routed through data center (typically 10–100ms depending on client location)
- Persistent resources: can maintain connections, caches, timers across requests

---

### Cloudflare Workers

**What it is:** A serverless compute platform that runs JavaScript on Cloudflare's globally distributed edge servers (300+ data centers worldwide).

**How it works:**
- You deploy JavaScript code to Cloudflare's network
- Cloudflare automatically runs your code on edge servers near your users
- Each request triggers an isolated execution context (V8 isolate)
- No persistent process; code starts fresh for each request (or reused within CPU time limits)
- Responses are served from the nearest geographic location

**Key characteristics:**
- **V8 isolate runtime:** A lightweight, sandboxed JavaScript engine (not full Node.js)
- **Web Standard APIs only:** `fetch()`, `Web Crypto`, `TextEncoder`, `Headers`, `Response`, etc.
- **No filesystem, no Node.js built-ins:** You cannot use `require('fs')`, `require('net')`, etc.
- **Distributed execution:** Your code runs in hundreds of locations simultaneously
- **Edge latency:** Requests typically <50ms, served from nearest Cloudflare POP (point of presence)
- **Stateless by design:** Each request is independent; no shared process state
- **Cost efficiency:** Free plan includes 100,000 requests/day at $0; paid plans scale with usage

---

## Detailed Comparison Table

| Feature | Node.js (DO App) | Cloudflare Workers |
|---------|------------------|-------------------|
| **Runtime Engine** | Node.js (full) | V8 isolate (lightweight) |
| **Module System** | CommonJS + ESM | ESM only |
| **Available APIs** | Node.js APIs (fs, net, os, etc.) + Web Standard | Web Standard only (fetch, crypto, etc.) |
| **Filesystem Access** | Yes (read/write) | No (KV storage available for persistent data) |
| **Child Processes** | Yes (spawn, fork) | No |
| **Execution Model** | Continuous process | Serverless (request-triggered) |
| **Geographic Distribution** | Single data center (or multi-region if replicated) | Global edge (300+ locations) |
| **Latency** | 10–100ms typical | <50ms typical (edge-optimized) |
| **Cold Start** | ~100–500ms (process boot) | <1ms (pre-warmed isolates) |
| **Cost (Free Tier)** | $12/month for DO App | $0 for 100k requests/day |
| **Cost (Paid)** | $12–100+/month (fixed) | Per-request metering (scales with usage) |
| **State Persistence** | ✓ (process-level state, caches) | ✗ (stateless; use KV/Durable Objects) |
| **Connection Pooling** | ✓ (HTTP keep-alive, DB connections) | ✓ (fetch keep-alive within 10s CPU limit) |
| **Horizontal Scaling** | Manual (spawn more processes) | Automatic (inherent in edge model) |
| **Setup Complexity** | Medium (YAML config, env vars) | Low (wrangler CLI, 2–3 secrets) |
| **Monitoring & Logging** | Built into DO (custom logs + CloudWatch) | Cloudflare Dashboard + Logpush |
| **Custom Domains** | ✓ CNAME to DO domain | ✓ CNAME to *.workers.dev or custom | 

---

## Choosing Your Runtime: Node.js vs. Cloudflare Workers

Each platform excels in different scenarios. Evaluate based on your operational needs, traffic patterns, and constraints.

### Benefits of Node.js (DO App)

1. **Full JavaScript ecosystem:** Access to npm packages without restrictions
2. **Stateful operations:** Maintain connections, caches, timers
3. **Familiar development:** Traditional server-side development model
4. **Debugging:** Full Node.js debugging tools (inspect, logging)
5. **Cost transparency:** Predictable, fixed monthly cost
6. **Use cases:**
   - Background jobs and scheduled tasks
   - Database connection pooling
   - Machine learning inference
   - Long-running operations

### Benefits of Cloudflare Workers

1. **Global edge execution:** Serve users from nearest location (~all traffic <50ms)
2. **True serverless:** No ops overhead, pay only for requests made
3. **Zero cold starts:** Requests handled immediately
4. **Automatic scaling:** No capacity planning needed
5. **Free tier:** 100k requests/day = $0 cost
6. **Use cases:**
   - Public APIs with high geographic dispersion
   - Rapid prototyping
   - Cost-sensitive, request-based billing
   - Global content delivery

### Hybrid Approach (This Codebase)

Deploy the **same application to both**, choose based on circumstance:

- **Development & testing:** Use local Node.js (`npm run start`) for fastest feedback, full debugging
- **Public API routes:** Deploy to Cloudflare Workers (edge latency, free tier)
- **Internal/private endpoints:** Use DO App (if needed for additional tooling/state)
- **Failover:** Workers can fallback to DO App using `fetch()` chains

---

## How the Codebase Achieves Dual Deployment

### Architecture Pattern: Shared Core + Adapters

```
                  +----------------------------------+
                  |   Shared Core Logic            |
                  |                                |
                  | src/core/config.js             |
                  | src/core/proxy.js              |
                  | src/core/routes.js             |
                  | src/core/http.js               |
                  +----------------------------------+
                         ^              ^
                         |              |
      +------------------+              +------------------+
      |                                                    |
  +---+--------------------+              +------------------+---+
  | Node.js Adapter        |              | Worker Adapter     |
  |                        |              |                    |
  | src/node/server.js     |              | src/worker/worker.js
  | - Creates http server  |              | - Listens to fetch
  | - Bridges Node req/res |              | - Bridges Web Request
  | - Calls core proxy     |              | - Calls core proxy
  |                        |              |                    |
  +---+--------------------+              +--------------------+---+
      |                                                    |
      v                                                    v
  +---------------------+                +-----------------------+
  | Node.js Server      |                | Cloudflare Workers  |
  |                     |                |                     |
  | (localhost          |                | (*.workers.dev +    |
  |  + DO App)          |                |  custom domains)    |
  +---------------------+                +-----------------------+
```

### How It Works

1. **All business logic lives in `src/core/`**
   - Provider routing (`/api/gemprompt` → Gemini, etc.)
   - HTTP proxying to upstream APIs
   - Conversation history management
   - Response normalization

2. **Two thin adapters** bridge the runtime differences:
   - **Node adapter** (`src/node/server.js`):
     - Creates an `http.Server` listening on `PORT`
     - Converts Node.js `IncomingRequest` to core contract
     - Calls `proxy.handleRequest()`
   
   - **Worker adapter** (`src/worker/worker.js`):
     - Exports a `fetch` event handler
     - Converts Cloudflare `Request` to core contract
     - Calls `proxy.handleRequest()`

3. **Same entry point, two outputs:**
   - `npm run start` → Node server boots at localhost:3000
   - `npm run worker:deploy` → Wrangler deploys to Cloudflare

### Code Example: Shared Core

**`src/core/proxy.js`** (runtime-agnostic):
```javascript
export async function handleRequest(url, method, headers, body) {
  const provider = resolveProvider(url.pathname);
  const response = await proxyUpstream(provider, headers, body);
  return { status: 200, body: response };
}
```

**`src/node/server.js`** (Node adapter):
```javascript
const server = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const result = await proxy.handleRequest(
    new URL(`http://localhost:${PORT}${req.url}`),
    req.method,
    req.headers,
    body
  );
  res.writeHead(result.status);
  res.end(result.body);
});
```

**`src/worker/worker.js`** (Worker adapter):
```javascript
export default {
  async fetch(request) {
    const body = await request.text();
    const result = await proxy.handleRequest(
      new URL(request.url),
      request.method,
      request.headers,
      body
    );
    return new Response(result.body, { status: result.status });
  }
};
```

### Key Constraint: No Node.js APIs in Core

To maintain portability, the shared core **must not use:**
- `require('fs')` — no filesystem
- `require('net')` — no sockets
- `require('child_process')` — no spawning
- Any module requiring Node.js-specific APIs

**Allowed in core:**
- Fetch API (`fetch()`)
- Web Crypto
- TextEncoder/Decoder
- Standard JavaScript (arrays, objects, promises)

---

## Deployment Procedures

### Local Development (Node.js)

```bash
# Check prerequisites
npm run node:check

# Start server (port 3000 by default)
npm run start

# Or with npm alias
npm run node:dev
```

**Files involved:**
- `.env` — Committed secrets (if any)
- `.node.local.env` — Local-only overrides (not committed)
- `start.sh` — Startup script
- `scripts/node.sh` — Helper for validation

### Cloudflare Workers Deployment

```bash
# One-time setup per machine
npx wrangler login

# Deploy to staging environment (aiproxy-staging.numerus.workers.dev)
npm run worker:staging:deploy

# Deploy to production (aiproxy.numerus.workers.dev)
npm run worker:prod:deploy

# Run locally (emulation)
npm run worker:dev
```

**Files involved:**
- `wrangler.toml` — Generic config template (committed, with placeholders)
- `.worker.local.env` — Actual account/domain values (not committed)
- `scripts/worker.sh` — Deployment and validation helper
- Secret values uploaded via `wrangler secret put`

**Configuration approach:**
- Generic `wrangler.toml` checked into repo with placeholders (e.g., `YOUR_CLOUDFLARE_ACCOUNT_ID`)
- Actual values in untracked `.worker.local.env` (Cloudflare account ID, zone name, custom domain)
- `scripts/worker.sh` reads `.worker.local.env`, generates temporary runtime config, deploys

### Deployment Workflow Modes (Direct vs Git-Driven)

Both platforms can support multiple deployment paths. In practice, choose one primary path per environment to avoid drift and "last deploy wins" confusion.

| Platform | Direct Deploy | GitHub-Driven Deploy |
|----------|---------------|----------------------|
| Cloudflare Workers | Yes. Current setup uses direct deploy through Wrangler (`npm run worker:deploy`, `npm run worker:deploy:prod`). | Yes, optional. Workers can be connected to a GitHub repo/branch in Cloudflare to auto-deploy on push. |
| DigitalOcean App Platform | Possible via app spec/API/CLI workflows, but this is not the primary path in this repo. | Yes. Current DO app setup is GitHub-connected and builds/deploys from branch pushes. |

**Current source-of-truth in this repository:**
- Cloudflare Workers: GitHub-connected deploy flow.
- DigitalOcean App Platform: GitHub-connected deploy flow.

**Recommendation (conditional):**
- Current plan: use one deployment method per target environment.
- Only if both methods are enabled for the same target, document precedence and release process clearly.

### Branch Mapping for Workers (Current Decision)

- Staging Worker deploys from develop.
- Production Worker deploys from main.
- Keep environment secrets fully separated between staging and production Workers.

### Staging Consumer Policy (For Downstream Projects)

If another project has a staging environment that calls aiproxy, choose one of these policies and keep it consistent:

1. Stability-first staging: point staging to aiproxy production (main-backed Worker).
2. Integration-first staging: point staging to aiproxy staging (develop-backed Worker).

Current recommendation: start with stability-first unless you are actively validating new aiproxy behavior in staging.

---

## Testing Both Runtimes

### Unit Tests (No Network)
```bash
npm test  # 11/11 tests passing, runs on any runtime
```

### Live Tests with Override

Test any runtime by setting `TEST_BASE_URL`:

```bash
# Test local Node
TEST_BASE_URL=http://localhost:3000 npm run test:live

# Test Cloudflare workers.dev (if deployed)
TEST_BASE_URL=https://aiproxy-staging.numerus.workers.dev npm run test:live

# Test custom domain
TEST_BASE_URL=https://aiproxy-staging.numerus.app npm run test:live

# Test DigitalOcean App
TEST_BASE_URL=https://aiproxy.ondigitalocean.app npm run test:live
```

### Test Coverage Matrix

| Environment | Command | Notes |
|-------------|---------|-------|
| Local Node | `npm run start` + `TEST_BASE_URL=http://localhost:3000 npm run test:live` | Full debugging, fastest feedback |
| Worker (local emulation) | `npm run worker:dev` + `TEST_BASE_URL=http://localhost:8787 npm run test:live` | Tests Worker runtime without deploying |
| Worker (staging, deployed) | Deploy to CF, then `TEST_BASE_URL=https://aiproxy-staging.numerus.workers.dev npm run test:live` | Real edge execution |
| Worker (prod, deployed) | Deploy to CF prod, then `TEST_BASE_URL=https://aiproxy.numerus.workers.dev npm run test:live` | Production validation |
| DO App | Running on do.app domain, then `TEST_BASE_URL=https://aiproxy.ondigitalocean.app npm run test:live` | Traditional server testing |

---

## Configuration Management

### Environment Variables

Both runtimes use the same environment resolution via `src/core/config.js`:

```javascript
export const config = {
  PORT: process.env.PORT || 3000,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  // ... etc
};
```

**Node.js** sources environment from:
1. System environment
2. `.env` file (committed, if any)
3. `.node.local.env` file (local-only overrides)

**Cloudflare Workers** sources environment from:
1. `vars` in `wrangler.toml` (committed, generic placeholders)
2. Secrets uploaded via `wrangler secret put` (not in files)
3. `.worker.local.env` (used by `scripts/worker.sh` to generate temp config)

### Secrets Best Practices

**Committed (no secrets):**
- `wrangler.toml` with placeholder values
- `.node.local.env.example` showing expected keys

**Never committed:**
- `.worker.local.env` (Cloudflare credentials, zone names, domain names)
- `.node.local.env` (local overrides)
- `.env.local` or `.env.*.local`

---

## Trade-offs: When to Use Each

### Use Node.js (DO App) When:

- You need **predictable, consistent latency** for internal APIs
- You're using npm packages that require **Node.js APIs** (fs, net, etc.)
- You need **state persistence** across requests (caches, connection pools)
- You're running **background jobs or scheduled tasks**
- You want **traditional debugging and logging** tools
- Cost is **predictable** (fixed monthly bill acceptable)
- You need **database connection pooling** at the server level

### Use Cloudflare Workers When:

- You want **global edge latency** (sub-50ms for most users)
- You have **spiky, unpredictable traffic** (pay only for requests)
- You want **zero ops overhead** (no process management, auto-scaling)
- You need **instant deployments** with no cold starts
- Your code uses **only Web Standard APIs**
- You want **free tier for public APIs** (100k requests/day)
- You're building a **CDN-friendly API** (geographic distribution matters)

### Hybrid Approach:

Deploy to **both** and choose by use case:
- Public routes → **Cloudflare Workers** (edge speed, free tier)
- Internal/private endpoints → **Node.js** (if needed for state/tooling)
- Failover chains → Workers call Node as a fallback
- A/B testing → Route subsets to each platform

---

## Operational Checklist

### Setting Up Local Development

- [ ] Clone repo
- [ ] `npm install`
- [ ] Copy `.node.local.env.example` to `.node.local.env` (or use `.env` from team)
- [ ] `npm run node:check` (validates Node and local files)
- [ ] `npm run start` (boots server)
- [ ] `TEST_BASE_URL=http://localhost:3000 npm run test:live` (validates routes)

### Setting Up Cloudflare Workers

- [ ] `npx wrangler login` (one-time auth per machine)
- [ ] Copy `.worker.local.env.example` to `.worker.local.env`
- [ ] Fill in `.worker.local.env`: CF_ACCOUNT_ID, CF_ZONE_NAME, custom domains
- [ ] `npm run worker:staging:deploy` (deploys to staging environment)
- [ ] Upload secrets: `npx wrangler secret put GEMINI_API_KEY --env staging` (for each secret)
- [ ] Verify custom domain DNS: Create CNAME records in Cloudflare DNS pointing to Workers
- [ ] Test: `TEST_BASE_URL=https://aiproxy-staging.numerus.workers.dev npm run test:live`

### Monitoring & Logs

**Node.js (DO App):**
- Check DO dashboard for app logs
- SSH into instance or use DO built-in log viewer
- Custom logging to stdout (captured by DO)

**Cloudflare Workers:**
- View real-time logs in Cloudflare Dashboard (Workers > aiproxy-staging > Logs)
- Enable Logpush for external log aggregation
- `wrangler tail` for local log streaming (requires login)

---

## Summary

This codebase demonstrates **write-once, deploy-anywhere** architecture for a proxy service:

1. **Shared core** contains all business logic (provider routing, proxying, response handling)
2. **Two thin adapters** bridge Node.js and Cloudflare Worker runtime models
3. **Same tests** validate both deployments
4. **Configuration abstraction** keeps secrets out of code
5. **Helper scripts** automate setup and deployment for each runtime

The result: **a single codebase deployable to two fundamentally different compute platforms**, each with distinct performance and cost characteristics. Choose the platform (or both) based on your operational needs.

---

## Further Reading

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Web Standards (MDN)](https://developer.mozilla.org/en-US/docs/Web/API)
