const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL;
// const GEMINI_MODEL = "gemini-pro";
const GH_URL = process.env.GH_URL;
const GEMINI_URL = process.env.GEMINI_URL;
const OPENROUTER_URL = process.env.OPENROUTER_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = process.env.DEEPSEEK_URL ;
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 30000);

function logMissingEnvWarning(routeLabel, envName) {
  console.log(`${routeLabel} route disabled until ${envName} is set.`);
}

function buildCorsHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, buildCorsHeaders("application/json"));
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload, contentType = "text/plain") {
  res.writeHead(statusCode, buildCorsHeaders(contentType));
  res.end(payload);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, "Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json"
    };

    res.writeHead(200, buildCorsHeaders(types[ext] || "application/octet-stream"));
    res.end(data);
  });
}

async function parseUpstreamJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isTimeoutError(error) {
  return error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", reject);
  });
}

async function handleGeminiPrompt(req, res) {
  if (!GEMINI_API_KEY) {
    sendJson(res, 500, { error: "Missing GEMINI_API_KEY environment variable." });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const response = await fetch(GEMINI_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      }
    );

    const data = await parseUpstreamJson(response);

    if (!response.ok) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : `Upstream API error (HTTP ${response.status})`;
      sendJson(res, response.status, { error: message });
      return;
    }

    const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : "No response text returned.";

    sendJson(res, 200, { text });
  } catch (error) {
    if (isTimeoutError(error)) {
      sendJson(res, 504, { error: `Upstream request timed out after ${UPSTREAM_TIMEOUT_MS} ms.` });
      return;
    }
    sendJson(res, 502, { error: error.message || "Upstream request failed." });
  }
}

function handleOpenAIModelsPrompt(token, url, tokenName) {
  return async function (req, res) {
    if (!token) {
      sendJson(res, 500, { error: `Missing ${tokenName} environment variable.` });
      return;
    }

    if (!url) {
      sendJson(res, 500, { error: "Missing upstream URL environment variable." });
      return;
    }

    try {
      const body = await readRequestBody(req);
      const response = await fetch(url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: body,
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
        }
      );

      const data = await parseUpstreamJson(response);

      if (!response.ok) {
        const message = data && data.error && data.error.message
          ? data.error.message
          : `Upstream API error (HTTP ${response.status})`;
        sendJson(res, response.status, { error: message });
        return;
      }

      const text = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "No response text returned.";

      sendJson(res, 200, { text });
    } catch (error) {
      if (isTimeoutError(error)) {
        sendJson(res, 504, { error: `Upstream request timed out after ${UPSTREAM_TIMEOUT_MS} ms.` });
        return;
      }
      sendJson(res, 502, { error: error.message || "Upstream request failed." });
    }
  }
}

var handleGitHubModelsPrompt = handleOpenAIModelsPrompt(GITHUB_TOKEN, GH_URL, "GITHUB_TOKEN");
var handleOpenRouterModelsPrompt = handleOpenAIModelsPrompt(OPENROUTER_API_KEY, OPENROUTER_URL, "OPENROUTER_API_KEY");
var handleDeepSeekPrompt = handleOpenAIModelsPrompt(DEEPSEEK_API_KEY, DEEPSEEK_URL, "DEEPSEEK_API_KEY");

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, buildCorsHeaders("application/json"));
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method === "POST") {
    switch (pathname) {
      case "/api/gemprompt":
        handleGeminiPrompt(req, res);
        return;
      case "/api/ghprompt":
        handleGitHubModelsPrompt(req, res);
        return;
      case "/api/orprompt":
        handleOpenRouterModelsPrompt(req, res);
        return;
      case "/api/dsprompt":
        handleDeepSeekPrompt(req, res);
        return;
      default:
        break;
    }
  }
  if (req.method === "GET") {
    const safePath = pathname === "/" ? "/gemini-node.html" : pathname;
    const filePath = path.join(__dirname, safePath);
    sendFile(res, filePath);
    return;
  }
  sendText(res, 405, "Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`Unified server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    logMissingEnvWarning("Gemini", "GEMINI_API_KEY");
  }
  if (!GEMINI_URL) {
    logMissingEnvWarning("Gemini", "GEMINI_URL");
  }
  if (!GITHUB_TOKEN) {
    logMissingEnvWarning("GitHub Models", "GITHUB_TOKEN");
  }
  if (!GH_URL) {
    logMissingEnvWarning("GitHub Models", "GH_URL");
  }
  if (!OPENROUTER_API_KEY) {
    logMissingEnvWarning("OpenRouter", "OPENROUTER_API_KEY");
  }
  if (!OPENROUTER_URL) {
    logMissingEnvWarning("OpenRouter", "OPENROUTER_URL");
  }
});
