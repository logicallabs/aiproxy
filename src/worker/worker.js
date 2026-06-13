import { resolveConfig } from "../core/config.js";
import { buildCorsHeaders, toTextResponse } from "../core/http.js";
import { proxyProviderRequest } from "../core/proxy.js";
import { resolveProvider } from "../core/routes.js";

function toFetchResponse(response) {
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders("application/json")
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "POST") {
      const provider = resolveProvider(pathname);
      if (provider) {
        const body = await request.text();
        const config = resolveConfig(env || {});
        const response = await proxyProviderRequest({
          provider,
          body,
          config,
          fetchImpl: fetch
        });
        return toFetchResponse(response);
      }
    }

    return toFetchResponse(toTextResponse(404, "Not Found"));
  }
};
