#!/usr/bin/env node

import { routeTask } from "./router.js";
import { defaultTokenBudget } from "./token-budget.js";
import { getFallbackProviders } from "./providers.js";
import { findProject } from "./projects.js";
import { scanWorkspace } from "./workspace.js";
import {
  printDoctor,
  printStatus,
  recoverProject,
  syncProjects,
} from "./commands.js";
import { installAgent, printAgents } from "./agents.js";
import {
  executeWithCodex,
  printExecutionResult,
  reviewWithClaude,
  reviewWithGemini,
} from "./executor.js";
import { checkOmniRoute } from "./omniroute.js";

const args = process.argv.slice(2);
const command = (args[0] ?? "").toLowerCase();

function finish(ok: boolean, message: string): never {
  console.log("");
  console.log(message);
  process.exit(ok ? 0 : 1);
}

if (!command) {
  console.log(`
JKDD Continuous

Comandos:
  jkdd doctor [projeto]
  jkdd status [projeto]
  jkdd sync [projeto]
  jkdd recover <projeto>
  jkdd rebuild <projeto>
  jkdd agents
  jkdd agents install codex
  jkdd agents install gemini
  jkdd run <projeto>
  jkdd "sua tarefa para um projeto"

Exemplos:
  jkdd doctor
  jkdd status jogos-daniel
  jkdd sync jogos-daniel
  jkdd recover jogos-daniel
  jkdd rebuild jogos-daniel
  jkdd agents
  jkdd agents install codex
  jkdd run jogos-daniel
  jkdd "melhore a tela inicial do jogos-daniel"
`);
  process.exit(0);
}

if (command === "doctor") {
  const result = printDoctor(args[1]);
  const omni = await checkOmniRoute();

  console.log("");
  console.log("OmniRoute:");
  console.log(`  Base URL:   ${omni.baseURL}`);
  console.log(`  Reachable:  ${omni.reachable ? "YES" : "NO"}`);
  console.log(`  API key:    ${omni.configured ? "SET" : "NOT SET"}`);
  console.log(`  Model:      ${omni.model ?? "NOT SET"}`);
  if (omni.error) console.log(`  Detail:     ${omni.error}`);

  finish(result.ok && omni.reachable, result.ok && omni.reachable ? "Environment ready." : "One or more checks need attention.");
}

if (command === "status") {
  const result = printStatus(args[1]);
  finish(result.ok, result.message);
}

if (command === "sync") {
  const result = syncProjects(args[1]);
  finish(result.ok, result.message);
}

if (command === "recover") {
  if (!args[1]) finish(false, "Usage: jkdd recover <project>");
  const result = recoverProject(args[1]);
  finish(result.ok, result.message);
}

if (command === "rebuild") {
  if (!args[1]) finish(false, "Usage: jkdd rebuild <project>");

  const project = findProject(args[1]);
  if (!project) finish(false, `Project not found: ${args[1]}`);

  const workspace = scanWorkspace(project.path, 200);
  const sourceFiles = workspace.files.filter((file) =>
    /\.(html|css|js|ts|tsx|jsx|dart|py)$/i.test(file)
  );

  if (sourceFiles.length > 0) {
    finish(
      false,
      "Rebuild blocked because application source files already exist. Use a normal task instead."
    );
  }

  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — REBUILD");
  console.log("========================================");
  console.log(`Project: ${project.name}`);
  console.log("Primary agent: Codex");
  console.log("Mode: workspace-write sandbox");
  console.log("");

  const result = executeWithCodex(
    project,
    [
      "Rebuild the missing application source for this project using README.md, AGENTS.md,",
      ".jkdd/repository-map.md and .jkdd/continuous.yml as the authoritative local specification.",
      "Create a coherent minimal working implementation without inventing external secrets.",
      "Preserve the documented product concept, games, languages, and zero-build static architecture.",
      "Do not commit, push, publish, or change external infrastructure.",
      "If the README references multiple game pages, restore them as separate static pages.",
    ].join(" "),
    { effort: "medium", includeReadme: true }
  );

  printExecutionResult(result);
  finish(result.ok, result.ok ? "Rebuild execution completed." : "Rebuild execution failed.");
}

if (command === "agents") {
  if (!args[1]) {
    const ok = printAgents();
    finish(ok, ok ? "At least one agent CLI is ready." : "No agent CLI is currently available.");
  }

  if (args[1].toLowerCase() === "install") {
    if (!args[2]) finish(false, "Usage: jkdd agents install <codex|gemini>");
    const ok = installAgent(args[2]);
    finish(ok, ok ? "Agent installation complete." : "Agent installation failed.");
  }

  finish(false, "Usage: jkdd agents [install <codex|gemini>]");
}

const task =
  command === "run"
    ? `run ${args.slice(1).join(" ")}`.trim()
    : args.join(" ").trim();

if (command === "run" && args.length < 2) {
  finish(false, "Usage: jkdd run <project>");
}

const decision = routeTask(task);
const project = findProject(task);

if (!project) {
  finish(false, "Project not found in JKDD registry.");
}

const workspace = scanWorkspace(project.path, 20);

console.log("");
console.log("========================================");
console.log(" JKDD CONTINUOUS — TASK ROUTER");
console.log("========================================");
console.log(`Task:     ${task}`);
console.log(`Project:  ${project.name}`);
console.log(`Path:     ${project.path}`);
console.log(`Agent:    ${decision.agent}`);
console.log(`Provider: ${decision.provider}`);
console.log(`Reason:   ${decision.reason}`);

console.log("");
console.log("Workspace files:");
for (const file of workspace.files) {
  console.log(`  - ${file}`);
}

console.log("");
console.log("Token budget:");
console.log(`  Max files: ${defaultTokenBudget.maxFiles}`);
console.log(`  Max lines/file: ${defaultTokenBudget.maxLinesPerFile}`);
console.log(`  Full history: ${defaultTokenBudget.includeFullHistory}`);
console.log(`  Resend unchanged: ${defaultTokenBudget.resendUnchangedFiles}`);

if (decision.provider !== "local") {
  const fallback = getFallbackProviders(decision.provider);

  console.log("");
  console.log(
    "Fallback providers:",
    fallback.map((provider) => provider.name).join(" -> ")
  );
}

console.log("");

const sourceFiles = workspace.files.filter((file) =>
  /\.(html|css|js|ts|tsx|jsx|dart|py)$/i.test(file)
);

if (sourceFiles.length === 0) {
  console.log("Execution blocked: no application source files were found.");
  console.log(`Run: jkdd rebuild ${project.key}`);
  process.exit(2);
}

console.log("Status: routing decision generated.");
console.log("Executing primary coding agent...");

const execution = executeWithCodex(project, task, { effort: "low" });
printExecutionResult(execution);

if (execution.ok) {
  process.exit(0);
}

console.log("");
console.log("Codex execution failed. Requesting read-only fallback reviews...");

const geminiReview = reviewWithGemini(project, task);
printExecutionResult(geminiReview);

if (!geminiReview.ok) {
  const claudeReview = reviewWithClaude(project, task);
  printExecutionResult(claudeReview);
}

process.exit(1);
