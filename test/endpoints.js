const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function callGeminiRequest(requestBody) {
  const response = await fetch(`${TEST_BASE_URL}/api/gemprompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        message = errorData.error;
      }
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new Error(message);
  }

  const data = await response.json();
  return data.text;
}

async function callGitHubModelsRequest(requestBody) {
  const response = await fetch(`${TEST_BASE_URL}/api/ghprompt`, {
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

export {callGitHubModelsRequest, callGeminiRequest};
