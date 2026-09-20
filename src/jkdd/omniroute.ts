import OpenAI from "openai";

export interface OmniRouteConfig {
  baseURL: string;
  apiKey?: string;
  model?: string;
}

export interface OmniRouteHealth {
  reachable: boolean;
  configured: boolean;
  baseURL: string;
  model?: string;
  error?: string;
}

export function getOmniRouteConfig(): OmniRouteConfig {
  return {
    baseURL:
      process.env.OMNIROUTE_BASE_URL?.trim() ||
      "http://localhost:20128/v1",
    apiKey: process.env.OMNIROUTE_API_KEY?.trim(),
    model: process.env.JKDD_OMNIROUTE_MODEL?.trim(),
  };
}

export async function checkOmniRoute(): Promise<OmniRouteHealth> {
  const config = getOmniRouteConfig();

  try {
    const response = await fetch(
      config.baseURL.replace(/\/$/, "") + "/models",
      {
        headers: config.apiKey
          ? { Authorization: `Bearer ${config.apiKey}` }
          : undefined,
      }
    );

    if (!response.ok) {
      return {
        reachable: true,
        configured: Boolean(config.apiKey),
        baseURL: config.baseURL,
        model: config.model,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      reachable: true,
      configured: Boolean(config.apiKey),
      baseURL: config.baseURL,
      model: config.model,
    };
  } catch (error) {
    return {
      reachable: false,
      configured: Boolean(config.apiKey),
      baseURL: config.baseURL,
      model: config.model,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runOmniRoute(
  system: string,
  user: string
): Promise<string> {
  const config = getOmniRouteConfig();

  if (!config.apiKey) {
    throw new Error(
      "OMNIROUTE_API_KEY is not configured. Create a key in OmniRoute and set it as an environment variable."
    );
  }

  if (!config.model) {
    throw new Error(
      "JKDD_OMNIROUTE_MODEL is not configured. Set it to a model or route name exposed by OmniRoute."
    );
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}
