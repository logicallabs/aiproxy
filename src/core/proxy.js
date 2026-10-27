import { toJsonResponse } from "./http.js";

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return undefined;
  }
  return AbortSignal.timeout(timeoutMs);
}

function isTimeoutError(error) {
  return error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function parseUpstreamJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function prepareRequestBody(provider, rawBody) {
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { body: rawBody };
  }

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)
    || !Object.prototype.hasOwnProperty.call(payload, "responseFormat")) {
    return { body: rawBody };
  }

  const responseFormat = payload.responseFormat;
  delete payload.responseFormat;
  if (responseFormat === null) {
    return { body: JSON.stringify(payload) };
  }
  if (typeof responseFormat !== "object" || Array.isArray(responseFormat)) {
    return { error: "responseFormat must be a JSON object." };
  }

  if (provider === "gemini") {
    const generationConfig = payload.generationConfig;
    payload.generationConfig = {
      ...(generationConfig !== null && typeof generationConfig === "object" && !Array.isArray(generationConfig)
        ? generationConfig
        : {}),
      ...responseFormat
    };
  } else {
    payload.response_format = responseFormat;
  }

  return { body: JSON.stringify(payload) };
}

function buildGeminiUrl(config, token) {
  if (config.GEMINI_URL) {
    if (/([?&])key=/.test(config.GEMINI_URL)) {
      return config.GEMINI_URL;
    }

    const separator = config.GEMINI_URL.includes("?") ? "&" : "?";
    return `${config.GEMINI_URL}${separator}key=${encodeURIComponent(token)}`;
  }

  if (!config.GEMINI_MODEL) {
    return null;
  }

  return `${config.GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(config.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(token)}`;
}

function getProviderConfig(provider, config) {
  switch (provider) {
    case "gemini":
      {
        const upstreamUrl = buildGeminiUrl(config, config.GEMINI_API_KEY || "");
      return {
        token: config.GEMINI_API_KEY,
        tokenName: "GEMINI_API_KEY",
        upstreamUrl,
        upstreamUrlName: "GEMINI_URL",
        buildHeaders: () => ({ "Content-Type": "application/json" }),
        extractText: (data) => {
          return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response text returned.";
        }
      };
      }
    case "github":
      return {
        token: config.GITHUB_TOKEN,
        tokenName: "GITHUB_TOKEN",
        upstreamUrl: config.GH_URL,
        upstreamUrlName: "GH_URL",
        buildHeaders: (token) => ({
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }),
        extractText: (data) => {
          return data?.choices?.[0]?.message?.content || "No response text returned.";
        }
      };
    case "openrouter":
      return {
        token: config.OPENROUTER_API_KEY,
        tokenName: "OPENROUTER_API_KEY",
        upstreamUrl: config.OPENROUTER_URL,
        upstreamUrlName: "OPENROUTER_URL",
        buildHeaders: (token) => ({
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }),
        extractText: (data) => {
          return data?.choices?.[0]?.message?.content || "No response text returned.";
        }
      };
    case "deepseek":
      return {
        token: config.DEEPSEEK_API_KEY,
        tokenName: "DEEPSEEK_API_KEY",
        upstreamUrl: config.DEEPSEEK_URL,
        upstreamUrlName: "DEEPSEEK_URL",
        buildHeaders: (token) => ({
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }),
        extractText: (data) => {
          return data?.choices?.[0]?.message?.content || "No response text returned.";
        }
      };
    default:
      return null;
  }
}

function validateProviderConfig(providerConfig) {
  if (!providerConfig) {
    return toJsonResponse(404, { error: "Unknown API route." });
  }

  if (!providerConfig.token) {
    return toJsonResponse(500, { error: `Missing ${providerConfig.tokenName} environment variable.` });
  }

  if (!providerConfig.upstreamUrl) {
    return toJsonResponse(500, { error: `Missing ${providerConfig.upstreamUrlName} environment variable.` });
  }

  return null;
}

async function proxyProviderRequest({ provider, body, config, fetchImpl = fetch }) {
  const providerConfig = getProviderConfig(provider, config);
  const validationError = validateProviderConfig(providerConfig);
  if (validationError) {
    return validationError;
  }

  const preparedBody = prepareRequestBody(provider, body);
  if (preparedBody.error) {
    return toJsonResponse(400, { error: preparedBody.error });
  }

  try {
    const response = await fetchImpl(providerConfig.upstreamUrl, {
      method: "POST",
      headers: providerConfig.buildHeaders(providerConfig.token),
      body: preparedBody.body,
      signal: createTimeoutSignal(config.UPSTREAM_TIMEOUT_MS)
    });

    const data = await parseUpstreamJson(response);

    if (!response.ok) {
      const message = data?.error?.message || `Upstream API error (HTTP ${response.status})`;
      return toJsonResponse(response.status, { error: message });
    }

    const text = providerConfig.extractText(data);
    return toJsonResponse(200, { text });
  } catch (error) {
    if (isTimeoutError(error)) {
      return toJsonResponse(504, { error: `Upstream request timed out after ${config.UPSTREAM_TIMEOUT_MS} ms.` });
    }

    return toJsonResponse(502, { error: error?.message || "Upstream request failed." });
  }
}

export {
  getProviderConfig,
  proxyProviderRequest
};
