import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveConfig } from "../core/config.js";
import { buildCorsHeaders, toTextResponse } from "../core/http.js";
import { proxyProviderRequest } from "../core/proxy.js";
import { resolveProvider } from "../core/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const config = resolveConfig(process.env);

function applyResponse(res, response) {
  res.writeHead(response.status, response.headers);
  res.end(response.body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      applyResponse(res, toTextResponse(404, "Not Found"));
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

function logMissingEnvWarning(routeLabel, envName) {
  console.log(`${routeLabel} route disabled until ${envName} is set.`);
}

function logStartupWarnings() {
  if (!config.GEMINI_API_KEY) {
    logMissingEnvWarning("Gemini", "GEMINI_API_KEY");
  }
  if (!config.GEMINI_URL) {
    logMissingEnvWarning("Gemini", "GEMINI_URL");
  }
  if (!config.GITHUB_TOKEN) {
    logMissingEnvWarning("GitHub Models", "GITHUB_TOKEN");
  }
  if (!config.GH_URL) {
    logMissingEnvWarning("GitHub Models", "GH_URL");
  }
  if (!config.OPENROUTER_API_KEY) {
    logMissingEnvWarning("OpenRouter", "OPENROUTER_API_KEY");
  }
  if (!config.OPENROUTER_URL) {
    logMissingEnvWarning("OpenRouter", "OPENROUTER_URL");
  }
  if (!config.DEEPSEEK_API_KEY) {
    logMissingEnvWarning("DeepSeek", "DEEPSEEK_API_KEY");
  }
  if (!config.DEEPSEEK_URL) {
    logMissingEnvWarning("DeepSeek", "DEEPSEEK_URL");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, buildCorsHeaders("application/json"));
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method === "POST") {
    const provider = resolveProvider(pathname);
    if (provider) {
      const body = await readRequestBody(req);
      const response = await proxyProviderRequest({
        provider,
        body,
        config,
        fetchImpl: fetch
      });
      applyResponse(res, response);
      return;
    }
  }

  if (req.method === "GET") {
    const safePath = pathname === "/" ? "/gemini-node.html" : pathname;
    const filePath = path.join(projectRoot, safePath);
    sendFile(res, filePath);
    return;
  }

  applyResponse(res, toTextResponse(405, "Method Not Allowed"));
});

server.listen(config.PORT, () => {
  console.log(`Unified server running on http://localhost:${config.PORT}`);
  logStartupWarnings();
});
