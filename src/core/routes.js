const ROUTES = {
  "/api/gemprompt": "gemini",
  "/api/ghprompt": "github",
  "/api/orprompt": "openrouter",
  "/api/dsprompt": "deepseek"
};

function resolveProvider(pathname) {
  return ROUTES[pathname] || null;
}

function isProxyPath(pathname) {
  return Boolean(resolveProvider(pathname));
}

export {
  ROUTES,
  isProxyPath,
  resolveProvider
};
