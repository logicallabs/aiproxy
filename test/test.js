import test from "node:test";

import { callGitHubModelsRequest, callGeminiRequest, callOpenRouterModelsRequest, callDeepSeekRequest } from "./endpoints.js";
import {
  assertChatGPTHistory,
  assertGeminiHistory,
  assertOpenRouterHistory,
  assertDeepSeekHistory,
  createChatGPTAssistant,
  createGeminiAssistant,
  createOpenRouterAssistant,
  createDeepSeekAssistant,
  runPrompt,
  runProviderAssertion
} from "./support.js";

async function callGemini(assistant, userPrompt) {
  return runPrompt(
    "Gemini",
    assistant,
    userPrompt,
    callGeminiRequest,
    "Gemini response did not include any text."
  );
}

async function callChatGPT(assistant, userPrompt) {
  return runPrompt(
    "ChatGPT",
    assistant,
    userPrompt,
    callGitHubModelsRequest,
    "ChatGPT response did not include any text."
  );
}

async function callOpenRouter(assistant, userPrompt) {
  return runPrompt(
    "OpenRouter",
    assistant,
    userPrompt,
    callOpenRouterModelsRequest,
    "OpenRouter response did not include any text."
  );
}

async function callDeepSeekRouter(assistant, userPrompt) {
  return runPrompt(
    "DeepSeek",
    assistant,
    userPrompt,
    callDeepSeekRequest,
    "DeepSeek response did not include any text."
  );
}

test("Gemini proxy preserves conversational context", async (testContext) => {
  await runProviderAssertion(
    testContext,
    "Gemini",
    createGeminiAssistant,
    callGemini,
    (assistant) => assistant.history,
    assertGeminiHistory
  );
});

test("ChatGPT proxy preserves conversational context", async (testContext) => {
  await runProviderAssertion(
    testContext,
    "ChatGPT",
    createChatGPTAssistant,
    callChatGPT,
    (assistant) => assistant.messages,
    assertChatGPTHistory
  );
});

test("OpenRouter proxy preserves conversational context", async (testContext) => {
  await runProviderAssertion(
    testContext,
    "OpenRouter",
    createOpenRouterAssistant,
    callOpenRouter,
    (assistant) => assistant.messages,
    assertOpenRouterHistory
  );
});

test("DeepSeek proxy preserves conversational context", async (testContext) => {
  await runProviderAssertion(
    testContext,
    "DeepSeek",
    createDeepSeekAssistant,
    callDeepSeekRouter,
    (assistant) => assistant.messages,
    assertDeepSeekHistory
  );
});