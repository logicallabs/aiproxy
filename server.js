const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = "gemini-2.5-flash";
// const GEMINI_MODEL = "gemini-pro";
const GH_MODEL = "gpt-4o-mini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json"
    };

    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
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
    const parsed = JSON.parse(body || "{}");
    const prompt = parsed.prompt || "Write a haiku about coding.";
    const systemPrompt = parsed.systemPrompt || null;

    const requestText = systemPrompt
      ? `${systemPrompt}\n\nUser request:\n${prompt}`
      : prompt;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: requestText }] }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : "Upstream API error";
      sendJson(res, response.status, { error: message });
      return;
    }

    const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : "No response text returned.";

    sendJson(res, 200, { text });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleGitHubModelsPrompt(req, res) {
  if (!GITHUB_TOKEN) {
    sendJson(res, 500, { error: "Missing GITHUB_TOKEN environment variable." });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const parsed = JSON.parse(body || "{}");
    const prompt = parsed.prompt || "Write a haiku about coding.";
    const systemPrompt = parsed.systemPrompt || null;

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await fetch(
      "https://models.inference.ai.azure.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GITHUB_TOKEN}`
        },
        body: JSON.stringify({ model: GH_MODEL, messages })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : "Upstream API error";
      sendJson(res, response.status, { error: message });
      return;
    }

    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "No response text returned.";

    sendJson(res, 200, { text });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method === "POST" && pathname === "/api/gemprompt") {
    handleGeminiPrompt(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/ghprompt") {
    handleGitHubModelsPrompt(req, res);
    return;
  }

  if (req.method === "GET") {
    const safePath = pathname === "/" ? "/gemini-node.html" : pathname;
    const filePath = path.join(__dirname, safePath);
    sendFile(res, filePath);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`Unified server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.log("Gemini route disabled until GEMINI_API_KEY is set.");
  }
  if (!GITHUB_TOKEN) {
    console.log("GitHub Models route disabled until GITHUB_TOKEN is set.");
  }
});
