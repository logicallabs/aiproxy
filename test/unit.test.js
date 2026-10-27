import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPTS,
  assertChatGPTHistory,
  assertDeepSeekHistory,
  assertGeminiHistory,
  assertOpenRouterHistory,
  createChatGPTAssistant,
  createDeepSeekAssistant,
  createGeminiAssistant,
  createOpenRouterAssistant,
  requestWithRetry,
  runPrompt
} from "./support.js";
import worker from "../src/worker/worker.js";

const fastRetryOptions = {
  delayBaseMs: 0,
  waitFn: async () => {},
  onRetry: () => {}
};

test("requestWithRetry retries transient failures and eventually succeeds", async () => {
  let attempts = 0;

  const answer = await requestWithRetry("Gemini", async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error("This model is currently experiencing high demand.");
    }
    return "ok";
  }, fastRetryOptions);

  assert.equal(answer, "ok");
  assert.equal(attempts, 3);
});

test("requestWithRetry stops immediately on non-transient errors", async () => {
  let attempts = 0;

  await assert.rejects(
    requestWithRetry("Gemini", async () => {
      attempts += 1;
      throw new Error("Missing API key");
    }, fastRetryOptions),
    /Missing API key/
  );

  assert.equal(attempts, 1);
});

test("runPrompt records Gemini history on successful two-turn conversation", async () => {
  const assistant = createGeminiAssistant();
  const responses = ["4", "40"];

  await runPrompt("Gemini", assistant, PROMPTS[0], async () => responses.shift(), "Gemini response did not include any text.", fastRetryOptions);
  await runPrompt("Gemini", assistant, PROMPTS[1], async () => responses.shift(), "Gemini response did not include any text.", fastRetryOptions);

  assertGeminiHistory(assistant.history, PROMPTS);
});

test("runPrompt records ChatGPT history on successful two-turn conversation", async () => {
  const assistant = createChatGPTAssistant();
  const responses = ["2 + 2 equals 4.", "4 multiplied by 10 equals 40."];

  await runPrompt("ChatGPT", assistant, PROMPTS[0], async () => responses.shift(), "ChatGPT response did not include any text.", fastRetryOptions);
  await runPrompt("ChatGPT", assistant, PROMPTS[1], async () => responses.shift(), "ChatGPT response did not include any text.", fastRetryOptions);

  assertChatGPTHistory(assistant.messages, PROMPTS);
});

test("runPrompt records OpenRouter history on successful two-turn conversation", async () => {
  const assistant = createOpenRouterAssistant();
  const responses = ["2 + 2 equals 4.", "4 multiplied by 10 equals 40."];

  await runPrompt("OpenRouter", assistant, PROMPTS[0], async () => responses.shift(), "OpenRouter response did not include any text.", fastRetryOptions);
  await runPrompt("OpenRouter", assistant, PROMPTS[1], async () => responses.shift(), "OpenRouter response did not include any text.", fastRetryOptions);

  assertOpenRouterHistory(assistant.messages, PROMPTS);
});

test("runPrompt records DeepSeek history on successful two-turn conversation", async () => {
  const assistant = createDeepSeekAssistant();
  const responses = ["2 + 2 equals 4.", "4 multiplied by 10 equals 40."];

  await runPrompt("DeepSeek", assistant, PROMPTS[0], async () => responses.shift(), "DeepSeek response did not include any text.", fastRetryOptions);
  await runPrompt("DeepSeek", assistant, PROMPTS[1], async () => responses.shift(), "DeepSeek response did not include any text.", fastRetryOptions);

  assertDeepSeekHistory(assistant.messages, PROMPTS);
});

test("runPrompt rolls back failed Gemini user turns", async () => {
  const assistant = createGeminiAssistant();

  await assert.rejects(
    runPrompt(
      "Gemini",
      assistant,
      PROMPTS[0],
      async () => {
        throw new Error("HTTP 500");
      },
      "Gemini response did not include any text.",
      fastRetryOptions
    ),
    /HTTP 500/
  );

  assert.deepEqual(assistant.history, []);
});

test("runPrompt rolls back failed ChatGPT user turns", async () => {
  const assistant = createChatGPTAssistant();

  await assert.rejects(
    runPrompt(
      "ChatGPT",
      assistant,
      PROMPTS[0],
      async () => {
        throw new Error("HTTP 500");
      },
      "ChatGPT response did not include any text.",
      fastRetryOptions
    ),
    /HTTP 500/
  );

  assert.deepEqual(assistant.messages, [{ role: "system", content: assistant.system_instruction.content }]);
});

test("runPrompt rolls back failed OpenRouter user turns", async () => {
  const assistant = createOpenRouterAssistant();

  await assert.rejects(
    runPrompt(
      "OpenRouter",
      assistant,
      PROMPTS[0],
      async () => {
        throw new Error("HTTP 500");
      },
      "OpenRouter response did not include any text.",
      fastRetryOptions
    ),
    /HTTP 500/
  );

  assert.deepEqual(assistant.messages, [{ role: "system", content: assistant.system_instruction.content }]);
});

test("runPrompt rolls back failed DeepSeek user turns", async () => {
  const assistant = createDeepSeekAssistant();

  await assert.rejects(
    runPrompt(
      "DeepSeek",
      assistant,
      PROMPTS[0],
      async () => {
        throw new Error("HTTP 500");
      },
      "DeepSeek response did not include any text.",
      fastRetryOptions
    ),
    /HTTP 500/
  );

  assert.deepEqual(assistant.messages, [{ role: "system", content: assistant.system_instruction.content }]);
});

test("runPrompt rejects empty model text and rolls back the pending user turn", async () => {
  const assistant = createGeminiAssistant();

  await assert.rejects(
    runPrompt(
      "Gemini",
      assistant,
      PROMPTS[0],
      async () => "   ",
      "Gemini response did not include any text.",
      fastRetryOptions
    ),
    /did not include any text/
  );

  assert.deepEqual(assistant.history, []);
});

const workerEnv = {
  GEMINI_API_KEY: "test",
  GEMINI_URL: "https://upstream.example/gemini",
  GITHUB_TOKEN: "test",
  GH_URL: "https://upstream.example/github",
  UPSTREAM_TIMEOUT_MS: 1000
};

async function postToWorker(path, rawBody, upstreamData) {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (url, options) => {
    upstreamRequest = { url, ...options };
    return new Response(JSON.stringify(upstreamData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const response = await worker.fetch(new Request(`https://proxy.example${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody
    }), workerEnv);
    return {
      response,
      data: await response.json(),
      upstreamRequest
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Worker merges Gemini responseFormat into generationConfig", async () => {
  const responseFormat = { responseMimeType: "application/json", responseSchema: { type: "OBJECT" } };
  const { response, data, upstreamRequest } = await postToWorker(
    "/api/gemprompt",
    JSON.stringify({ contents: [], generationConfig: { temperature: 0.2 }, responseFormat }),
    { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }
  );

  assert.equal(response.status, 200);
  const forwarded = JSON.parse(upstreamRequest.body);
  assert.equal(forwarded.responseFormat, undefined);
  assert.deepEqual(forwarded.generationConfig, { temperature: 0.2, ...responseFormat });
  assert.equal(data.text, '{"ok":true}');
});

test("Worker maps OpenAI responseFormat and returns structured text verbatim", async () => {
  const responseFormat = { type: "json_schema", json_schema: { name: "result", schema: { type: "object" } } };
  const structuredText = '{"value":"literal \\\\n"}';
  const { response, data, upstreamRequest } = await postToWorker(
    "/api/ghprompt",
    JSON.stringify({ model: "test", messages: [], responseFormat }),
    { choices: [{ message: { content: structuredText } }] }
  );

  assert.equal(response.status, 200);
  const forwarded = JSON.parse(upstreamRequest.body);
  assert.equal(forwarded.responseFormat, undefined);
  assert.deepEqual(forwarded.response_format, responseFormat);
  assert.equal(data.text, structuredText);
});

test("Worker strips null responseFormat and forwards legacy bodies byte-for-byte", async () => {
  const rawBody = '{ "model": "test", "messages": [], "responseFormat": null }';
  const { response, upstreamRequest } = await postToWorker(
    "/api/ghprompt",
    rawBody,
    { choices: [{ message: { content: "ok" } }] }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(upstreamRequest.body), { model: "test", messages: [] });

  const legacyRawBody = '{ "model": "test", "messages": [] }';
  const legacy = await postToWorker(
    "/api/ghprompt",
    legacyRawBody,
    { choices: [{ message: { content: "ok" } }] }
  );
  assert.equal(legacy.upstreamRequest.body, legacyRawBody);
});

test("Worker rejects a non-object responseFormat without calling upstream", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("upstream should not be called");
  };

  try {
    const response = await worker.fetch(new Request("https://proxy.example/api/gemprompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [], responseFormat: "json" })
    }), workerEnv);

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /responseFormat/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});