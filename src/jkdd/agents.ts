
import { runCommand } from "./process.js";
export interface AgentCliStatus {
  name: "codex" | "gemini" | "claude";
  command: string;
  installed: boolean;
  version?: string;
}

function run(command: string, args: string[] = []) {
  return runCommand(command, args);
}

function probe(name: AgentCliStatus["name"], command: string): AgentCliStatus {
  const result = run(command, ["--version"]);
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    name,
    command,
    installed: result.status === 0,
    version: result.status === 0 ? output || "available" : undefined,
  };
}

export function getAgentCliStatus(): AgentCliStatus[] {
  return [
    probe("codex", "codex"),
    probe("gemini", "gemini"),
    probe("claude", "claude"),
  ];
}

export function printAgents(): boolean {
  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — AGENTS");
  console.log("========================================");

  const statuses = getAgentCliStatus();
  for (const status of statuses) {
    console.log(
      `${status.name.padEnd(8)} ${status.installed ? "READY" : "NOT INSTALLED"}${status.version ? ` — ${status.version}` : ""}`
    );
  }

  return statuses.some((status) => status.installed);
}

export function installAgent(name: string): boolean {
  const normalized = name.toLowerCase();

  const packages: Record<string, string> = {
    codex: "@openai/codex",
    gemini: "@google/gemini-cli",
  };

  const pkg = packages[normalized];

  if (!pkg) {
    console.error("Supported installs: codex, gemini");
    console.error("Claude Code is detected but not installed by JKDD Continuous.");
    return false;
  }

  console.log(`Installing ${normalized} via npm...`);
  const result = run("npm", ["install", "-g", pkg]);

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    console.error(`Failed to install ${normalized}.`);
    return false;
  }

  console.log(`${normalized} installed.`);
  return true;
}
