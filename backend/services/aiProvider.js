const axios = require("axios");

// Ordered list of AI providers. Each provider uses the OpenAI
// chat-completions request/response shape so the rest of the app does not
// care which provider actually served the call.
//
// Providers without an API key are skipped, so a single-key setup keeps
// working exactly as before.
function buildProviders() {
  return [
    {
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      apiKey: process.env.GROQ_API_KEY,
    },
    {
      name: "gemini",
      // Google's OpenAI-compatible endpoint (https://ai.google.dev/gemini-api/docs/openai)
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
    },
  ].filter((provider) => provider.apiKey);
}

const AI_TIMEOUT_MS = 60000;

// Rotated once per call so two healthy keys share the load instead of
// hammering one free-tier quota until it rate-limits.
let roundRobinCounter = 0;

async function completeChat({
  messages,
  temperature = 0.8,
  maxTokens,
}) {
  const providers = buildProviders();

  if (providers.length === 0) {
    throw new Error("No AI provider configured");
  }

  const startIndex = roundRobinCounter % providers.length;

  roundRobinCounter += 1;

  let lastError = null;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[(startIndex + i) % providers.length];

    try {
      const response = await axios.post(
        `${provider.baseURL}/chat/completions`,
        {
          model: provider.model,
          messages,
          temperature,
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: AI_TIMEOUT_MS,
        }
      );

      console.log(`[ai] served by ${provider.name}`);

      return response;
    } catch (error) {
      lastError = error;

      const status = error.response?.status;

      // Fall through on rate limits (429), missing models (404, e.g. a
      // decommissioned model id), server errors (5xx) and network/timeout
      // failures; fail fast on other config errors (400/401/403) so
      // misconfigurations surface instead of being hidden.
      const shouldTryNext =
        status === 429 ||
        status === 404 ||
        (typeof status === "number" && status >= 500) ||
        !error.response;

      if (!shouldTryNext) {
        throw error;
      }

      if (status === 404) {
        console.warn(
          `[ai] ${provider.name} model "${provider.model}" was not found (decommissioned or misconfigured). Update GROQ_MODEL / GEMINI_MODEL in backend/.env`
        );
      }

      console.log(
        `[ai] ${provider.name} failed (${status || "network"}), trying next provider`
      );
    }
  }

  throw lastError;
}

module.exports = {
  completeChat,
};
