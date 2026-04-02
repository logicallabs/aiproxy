# AI Proxy Reverse Proxy Server

This folder contains a lightweight Node.js reverse proxy server that forwards prompt requests to:

- Gemini API (model: gemini-2.5-flash)
- GitHub Models API (model: gpt-4o-mini)

The server also serves static files from this folder for GET requests.

## What It Does

- Accepts POST requests from your frontend
- Forwards requests to Gemini or GitHub Models
- Returns normalized JSON: { "text": "..." }
- Handles CORS for browser clients

## Environment Variables

The server expects these variables:

- GEMINI_API_KEY
- GITHUB_TOKEN
- PORT (optional, defaults to 3000)

You can place keys in .env.modelkeys and the startup script will source them.

## How To Run

Use a bash shell.

Requested command format:

    node server.sh

Practical startup command in this folder:

    bash start.sh

The script prompts for missing keys and starts:

    node server.js

## Addressing The Proxy

Base URL:

    http://localhost:3000

Use a URL path for Gemini requests:

    POST /api/gemprompt

Use a URL path for GitModels requests:

    POST /api/ghprompt

Example full URLs:

    http://localhost:3000/api/gemprompt
    http://localhost:3000/api/ghprompt

## Request Body

Send JSON with:

- prompt (string)
- systemPrompt (optional string)

Example body:

    {
      "prompt": "Summarize this text",
      "systemPrompt": "You are a concise assistant"
    }

## Response Body

Success:

    { "text": "...model output..." }

Error:

    { "error": "...message..." }
