import assert from "node:assert/strict";

import { GeminiChatManager, ChatGPTChatManager, ORChatManager, DSChatManager } from "./chatmanagers.js";

const SYSTEM_PROMPT = "You are a helpful teaching assistant.";
const PROMPTS = ["What is 2+2?", "Now multiply that by 10."];

function isTransientModelError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|503|high demand|temporar|try again later|overload|timeout|rate limit/i.test(message);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestWithRetry(label, requestFn, options = {}) {
  const {
    maxAttempts = 3,
    delayBaseMs = 750,
    waitFn = wait,
    onRetry = (attempt, totalAttempts, error) => {
      console.warn(`${label} transient failure on attempt ${attempt}/${totalAttempts}: ${error.message}`);
    }
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (!isTransientModelError(error) || attempt === maxAttempts) {
        break;
      }

      onRetry(attempt, maxAttempts, error);
      await waitFn(delayBaseMs * attempt);
    }
  }

  throw lastError;
}

function createGeminiAssistant() {
  return new GeminiChatManager(SYSTEM_PROMPT);
}

function createChatGPTAssistant() {
  return new ChatGPTChatManager(SYSTEM_PROMPT);
}

function createOpenRouterAssistant() {
  return new ORChatManager(SYSTEM_PROMPT);
}

function createDeepSeekAssistant() {
  return new DSChatManager(SYSTEM_PROMPT);
}

function rollbackFailedUserTurn(assistant) {
  const lastGeminiTurn = assistant.history?.at(-1);
  if (lastGeminiTurn?.role === "user") {
    assistant.history.pop();
    return;
  }

  const lastChatGPTTurn = assistant.messages?.at(-1);
  if (lastChatGPTTurn?.role === "user") {
    assistant.messages.pop();
  }
}

async function runPrompt(label, assistant, userPrompt, requestFn, emptyResponseMessage, retryOptions) {
  const requestBody = assistant.prepareRequest(userPrompt);

  try {
    const modelText = await requestWithRetry(label, () => requestFn(requestBody), retryOptions);
    if (!modelText || !modelText.trim()) {
      throw new Error(emptyResponseMessage);
    }

    assistant.addModelResponse(modelText);
    return modelText;
  } catch (error) {
    rollbackFailedUserTurn(assistant);
    throw error;
  }
}

function assertAnswerLooksRight(answer, expectedValue) {
  assert.ok(answer.trim().length > 0, "Model returned empty text.");
  assert.match(answer, expectedValue, `Expected answer to match ${expectedValue}. Received: ${answer}`);
}

function assertGeminiHistory(history, prompts = PROMPTS) {
  assert.equal(history.length, 4, "Gemini history should contain two user turns and two model turns.");
  assert.equal(history[0].role, "user");
  assert.equal(history[1].role, "model");
  assert.equal(history[2].role, "user");
  assert.equal(history[3].role, "model");
  assert.equal(history[0].parts[0].text, prompts[0]);
  assert.equal(history[2].parts[0].text, prompts[1]);
  assert.ok(history[1].parts[0].text.trim().length > 0);
  assert.ok(history[3].parts[0].text.trim().length > 0);
}

function assertChatGPTHistory(messages, prompts = PROMPTS) {
  assert.equal(messages.length, 5, "ChatGPT history should contain one system message plus two user/model turns.");
  assert.deepEqual(messages[0], { role: "system", content: SYSTEM_PROMPT });
  assert.deepEqual(messages[1], { role: "user", content: prompts[0] });
  assert.equal(messages[2].role, "assistant");
  assert.deepEqual(messages[3], { role: "user", content: prompts[1] });
  assert.equal(messages[4].role, "assistant");
  assert.ok(messages[2].content.trim().length > 0);
  assert.ok(messages[4].content.trim().length > 0);
}

function assertOpenRouterHistory(messages, prompts = PROMPTS) {
  assert.equal(messages.length, 5, "OpenRouter history should contain one system message plus two user/model turns.");
  assert.deepEqual(messages[0], { role: "system", content: SYSTEM_PROMPT });
  assert.deepEqual(messages[1], { role: "user", content: prompts[0] });
  assert.equal(messages[2].role, "assistant");
  assert.deepEqual(messages[3], { role: "user", content: prompts[1] });
  assert.equal(messages[4].role, "assistant");
  assert.ok(messages[2].content.trim().length > 0);
  assert.ok(messages[4].content.trim().length > 0);
}

function assertDeepSeekHistory(messages, prompts = PROMPTS) {
  assert.equal(messages.length, 5, "DeepSeek history should contain one system message plus two user/model turns.");
  assert.deepEqual(messages[0], { role: "system", content: SYSTEM_PROMPT });
  assert.deepEqual(messages[1], { role: "user", content: prompts[0] });
  assert.equal(messages[2].role, "assistant");
  assert.deepEqual(messages[3], { role: "user", content: prompts[1] });
  assert.equal(messages[4].role, "assistant");
  assert.ok(messages[2].content.trim().length > 0);
  assert.ok(messages[4].content.trim().length > 0);
}

async function assertConversation(assistant, prompts, callModel, getHistory) {
  const firstAnswer = await callModel(assistant, prompts[0]);
  assertAnswerLooksRight(firstAnswer, /\b(4|four)\b/i);

  const secondAnswer = await callModel(assistant, prompts[1]);
  assertAnswerLooksRight(secondAnswer, /\b(40|forty)\b/i);

  return getHistory(assistant);
}

async function runProviderAssertion(testContext, label, createAssistantFn, callModel, getHistory, assertHistory) {
  const assistant = createAssistantFn();

  try {
    const history = await assertConversation(assistant, PROMPTS, callModel, getHistory);
    assertHistory(history, PROMPTS);
  } catch (error) {
    if (isTransientModelError(error)) {
      testContext.skip(`${label} temporarily unavailable: ${error.message}`);
      return;
    }

    throw error;
  }
}

export {
  PROMPTS,
  SYSTEM_PROMPT,
  assertAnswerLooksRight,
  assertChatGPTHistory,
  assertConversation,
  assertGeminiHistory,
  assertOpenRouterHistory,
  assertDeepSeekHistory,
  createChatGPTAssistant,
  createGeminiAssistant,
  createOpenRouterAssistant,
  createDeepSeekAssistant,
  isTransientModelError,
  requestWithRetry,
  rollbackFailedUserTurn,
  runPrompt,
  runProviderAssertion,
  wait
};