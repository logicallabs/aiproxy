function buildCorsHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function toJsonResponse(status, payload) {
  return {
    status,
    headers: buildCorsHeaders("application/json"),
    body: JSON.stringify(payload)
  };
}

function toTextResponse(status, text, contentType = "text/plain") {
  return {
    status,
    headers: buildCorsHeaders(contentType),
    body: text
  };
}

export {
  buildCorsHeaders,
  toJsonResponse,
  toTextResponse
};
