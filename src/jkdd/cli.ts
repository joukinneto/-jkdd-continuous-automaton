#!/usr/bin/env node

import { routeTask } from "./router.js";
import { defaultTokenBudget } from "./token-budget.js";
import { getFallbackProviders } from "./providers.js";
import { findProject } from "./projects.js";
import { scanWorkspace } from "./workspace.js";

const task = process.argv.slice(2).join(" ").trim();

if (!task) {
  console.log(`
JKDD Continuous

Uso:
  jkdd "sua tarefa"

Exemplo:
  jkdd "melhore a tela inicial do jogos-daniel"
`);
  process.exit(0);
}

const decision = routeTask(task);
const project = findProject(task);

if (!project) {
  console.error("Project not found in JKDD registry.");
  process.exit(1);
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
    fallback.map((p) => p.name).join(" -> ")
  );
}

console.log("");
console.log("Status: routing decision generated.");
console.log("Execution provider integration is the next layer.");