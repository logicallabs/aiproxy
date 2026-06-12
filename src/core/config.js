function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveConfig(envSource = {}) {
  return {
    PORT: toNumber(envSource.PORT, 3000),
    GEMINI_API_KEY: envSource.GEMINI_API_KEY,
    GEMINI_MODEL: envSource.GEMINI_MODEL,
    GEMINI_API_BASE: envSource.GEMINI_API_BASE || "https://generativelanguage.googleapis.com",
    GEMINI_URL: envSource.GEMINI_URL,
    GITHUB_TOKEN: envSource.GITHUB_TOKEN,
    GH_URL: envSource.GH_URL,
    OPENROUTER_API_KEY: envSource.OPENROUTER_API_KEY,
    OPENROUTER_URL: envSource.OPENROUTER_URL,
    DEEPSEEK_API_KEY: envSource.DEEPSEEK_API_KEY,
    DEEPSEEK_URL: envSource.DEEPSEEK_URL,
    UPSTREAM_TIMEOUT_MS: toNumber(envSource.UPSTREAM_TIMEOUT_MS, 30000)
  };
}

export {
  resolveConfig
};
