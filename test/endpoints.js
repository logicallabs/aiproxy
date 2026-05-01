const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function callGeminiRequest(requestBody) {
    return callProxyTextEndpoint("/api/gemprompt", requestBody);
}

async function callGitHubModelsRequest(requestBody) {
  return callProxyTextEndpoint("/api/ghprompt", requestBody);
}

async function callOpenRouterModelsRequest(requestBody) {
  return callProxyTextEndpoint("/api/orprompt", requestBody);
}

async function callDeepSeekRequest(requestBody) {
  return callProxyTextEndpoint("/api/dsprompt", requestBody);
}

async function callProxyTextEndpoint(urlPath, requestBody) {
  const response = await fetch(`${TEST_BASE_URL}${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) message = errorData.error;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new Error(message);
  }

  const data = await response.json();
  return data.text;
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

function isTransientModelError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|503|high demand|temporar|try again later|overload|timeout|rate limit/i.test(message);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export {callGitHubModelsRequest, callGeminiRequest, 
        callOpenRouterModelsRequest, callDeepSeekRequest};
