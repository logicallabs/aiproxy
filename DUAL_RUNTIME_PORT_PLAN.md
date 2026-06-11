# Dual Runtime Port Plan (DO App + Cloudflare Worker + Local)

## Goal

Keep one repository that can run in three environments without changing client contracts:

1. Local machine (developer)
2. DigitalOcean App Platform (Node runtime)
3. Cloudflare Worker (edge runtime)

The public API contract remains:

- `POST /api/gemprompt`
- `POST /api/ghprompt`
- `POST /api/orprompt`
- `POST /api/dsprompt`

Success and error response normalization remains unchanged:

- success: `{ "text": "..." }`
- error: `{ "error": "..." }`

## Non-Goals

- No model/provider contract redesign.
- No frontend/client payload migration.
- No immediate removal of existing Node entrypoint until parity is verified.

## Phase 0: Baseline And Safety (Done First)

### Objectives

- Work on an isolated branch.
- Capture implementation plan before code changes.

### Deliverables

- Feature branch for dual-runtime work.
- This plan document committed.

### Exit Criteria

- Plan is reviewed and accepted before refactor starts.

## Phase 1: Extract Runtime-Agnostic Core

### Objectives

- Move proxy/provider logic into shared modules independent of Node `http` APIs.
- Keep behavior parity with current server implementation.

### Deliverables

- Shared core request handlers (Gemini, GitHub Models, OpenRouter, DeepSeek).
- Shared utilities for:
  - CORS headers
  - request body handling (where runtime-neutral)
  - upstream fetch/timeout/error normalization
  - JSON/text response helper shape

### Exit Criteria

- Node adapter can call shared core and return same endpoint behavior.
- Existing test suite still passes for Node runtime.

## Phase 2: Add Runtime Adapters

### Objectives

- Keep Node adapter for local and DO App deployment.
- Add Cloudflare Worker adapter using `fetch` event style runtime.

### Deliverables

- Node runtime entrypoint that maps Node req/res to core.
- Worker runtime entrypoint that maps Request/Response to core.
- Shared route map to avoid drift between runtimes.

### Exit Criteria

- Both runtimes expose the same routes and response normalization.
- Worker code compiles and runs in local Worker dev mode.

## Phase 3: Configuration And Deployment Setup

### Objectives

- Standardize env var contract across runtimes.
- Add Worker deployment configuration.

### Deliverables

- `wrangler.toml` with environment variable and secret binding guidance.
- npm scripts for worker dev/deploy flow.
- Updated docs showing local Node, DO App Node, and Worker setup.

### Exit Criteria

- Clear run/deploy commands documented for all targets.
- No required variable ambiguity.

## Phase 4: Testing Matrix Expansion

### Objectives

- Preserve Node unit + live tests.
- Add worker smoke/live test path using base URL override.

### Deliverables

- Test instructions for:
  - Node local
  - Worker local dev endpoint
- Optional worker-specific smoke checks if needed.

### Exit Criteria

- Tests can be pointed at either runtime with the same contract assertions.

## Phase 5: Rollout And Decision Gate

### Objectives

- Evaluate whether to adopt dual runtime long-term.
- Keep rollback path simple.

### Deliverables

- Comparison checklist:
  - operational complexity
  - reliability
  - cost profile
  - latency profile
- Recommendation on maintaining both targets or selecting one.

### Exit Criteria

- Team decision recorded before merging to main.

## Risks And Mitigations

1. Runtime differences (Node vs Worker) around streaming, timeouts, and filesystem
- Mitigation: keep provider logic in core and isolate runtime mechanics in adapters.

2. Env management differences
- Mitigation: one canonical variable list with runtime-specific setup sections.

3. Behavior regression during refactor
- Mitigation: preserve existing endpoint contract and run current tests at each phase.

## Implementation Order For This Branch

1. Phase 1 implementation starts now.
2. Phase 2 minimal Worker adapter next.
3. Validate behavior and tests.
4. Continue with Phase 3 docs/config updates.
5. Add Phase 4 test matrix adjustments.
