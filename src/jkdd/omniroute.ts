import OpenAI from "openai";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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


export async function listOmniRouteModels(
  apiKey?: string,
  baseURL?: string
): Promise<string[]> {
  const config = getOmniRouteConfig();
  const url = (baseURL ?? config.baseURL).replace(/\/$/, "") + "/models";
  const key = apiKey ?? config.apiKey;

  const response = await fetch(url, {
    headers: key ? { Authorization: `Bearer ${key}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`OmniRoute /models returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };

  return (body.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id))
    .sort();
}

function saveUserEnv(name: string, value: string): boolean {
  if (process.platform === "win32") {
    const result = spawnSync("setx", [name, value], {
      encoding: "utf-8",
      shell: true,
      stdio: "pipe",
    });
    return result.status === 0;
  }

  return false;
}

async function askHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    const rl = readline.createInterface({ input, output });
    const value = await rl.question(prompt);
    rl.close();
    return value.trim();
  }

  output.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return await new Promise<string>((resolve) => {
    let value = "";

    const onData = (buffer: Buffer) => {
      const char = buffer.toString("utf-8");

      if (char === "\r" || char === "\n") {
        process.stdin.off("data", onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        output.write("\n");
        resolve(value.trim());
        return;
      }

      if (char === "\u0003") {
        process.stdin.off("data", onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        output.write("\n");
        process.exit(130);
      }

      if (char === "\u007f" || char === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }

      value += char;
      output.write("*");
    };

    process.stdin.on("data", onData);
  });
}

export async function setupOmniRouteInteractive(): Promise<boolean> {
  const baseURL = "http://localhost:20128/v1";

  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — OMNIROUTE SETUP");
  console.log("========================================");
  console.log(`Endpoint: ${baseURL}`);
  console.log("Sua chave será digitada localmente e não será exibida.");

  const apiKey = await askHidden("OmniRoute API key: ");
  if (!apiKey) {
    console.error("API key vazia.");
    return false;
  }

  let models: string[];
  try {
    models = await listOmniRouteModels(apiKey, baseURL);
  } catch (error) {
    console.error(
      `Falha ao validar a chave: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }

  console.log("");
  console.log(`Modelos disponíveis: ${models.length}`);
  for (const model of models.slice(0, 30)) {
    console.log(`  - ${model}`);
  }
  if (models.length > 30) {
    console.log(`  ... +${models.length - 30} modelos`);
  }

  const preferred =
    models.find((model) => model === "gpt-5.6-sol") ??
    models.find((model) => model.includes("gpt-5.6")) ??
    models[0];

  if (!preferred) {
    console.error("Nenhum modelo retornado pelo OmniRoute.");
    return false;
  }

  const rl = readline.createInterface({ input, output });
  const answer = (
    await rl.question(`Modelo [${preferred}]: `)
  ).trim();
  rl.close();

  const model = answer || preferred;

  if (!models.includes(model)) {
    console.error(`Modelo não encontrado no OmniRoute: ${model}`);
    return false;
  }

  process.env.OMNIROUTE_BASE_URL = baseURL;
  process.env.OMNIROUTE_API_KEY = apiKey;
  process.env.JKDD_OMNIROUTE_MODEL = model;

  const savedBase = saveUserEnv("OMNIROUTE_BASE_URL", baseURL);
  const savedKey = saveUserEnv("OMNIROUTE_API_KEY", apiKey);
  const savedModel = saveUserEnv("JKDD_OMNIROUTE_MODEL", model);

  console.log("");
  console.log(`Modelo selecionado: ${model}`);

  if (savedBase && savedKey && savedModel) {
    console.log("Configuração salva no perfil do usuário do Windows.");
    console.log("Abra um novo PowerShell para que outros processos recebam as variáveis.");
    return true;
  }

  console.log("Conexão validada, mas não foi possível persistir todas as variáveis automaticamente.");
  return false;
}
