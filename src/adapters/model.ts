import type { ModelAdapter } from "../types.js";
import { UseAgentsError } from "../utils/errors.js";

function createOpenRouterAdapter(): ModelAdapter {
  return {
    async generate({ model, apiKey, system, prompt, temperature, responseFormat }) {
      const messages = [];
      if (system) {
        messages.push({ role: "system", content: system });
      }
      messages.push({ role: "user", content: prompt });
      
      const body = {
        model,
        messages,
        temperature: temperature ?? 0.7,
        ...(responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      };
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://useagents.dev",
          "X-Title": "UseAgents",
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new UseAgentsError(
          `OpenRouter API error: ${response.status}`,
          "model_api_error",
          { status: response.status, error }
        );
      }
      
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: unknown;
      };
      const text = data.choices?.[0]?.message?.content || "";
      
      return {
        text,
        usage: data.usage,
      };
    },
  };
}

export function createModelAdapter(
  provider: string,
  _secrets: Record<string, string>
): ModelAdapter {
  switch (provider.toLowerCase()) {
    case "openrouter":
      return createOpenRouterAdapter();
    default:
      throw new UseAgentsError(
        `Unsupported model provider: ${provider}`,
        "unsupported_provider",
        { provider }
      );
  }
}
