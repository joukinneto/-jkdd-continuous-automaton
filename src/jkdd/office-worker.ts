import fs from "node:fs";
import path from "node:path";
import { executeWithCodex } from "./executor.js";
import { listProjects } from "./projects.js";
import { getOfficePaths, readOfficeState, type OfficeState } from "./office.js";
import { runOmniRoute } from "./omniroute.js";
import { runCommand } from "./process.js";

function writeState(state: OfficeState) {
  const { stateFile } = getOfficePaths();
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function gitStatus(projectPath: string): string {
  const result = runCommand("git", ["status", "--porcelain"], { cwd: projectPath });
  return result.stdout?.trim() ?? "";
}

function ensureBranch(projectPath: string): string {
  const result = runCommand("git", ["branch", "--show-current"], { cwd: projectPath });
  return result.stdout?.trim() ?? "";
}

function safetyCheckpoint(projectPath: string): boolean {
  const dirty = gitStatus(projectPath);
  if (!dirty) return true;

  const check = runCommand("git", ["diff", "--check"], { cwd: projectPath });
  if (check.status !== 0) return false;

  runCommand("git", ["add", "-A"], { cwd: projectPath });
  const commit = runCommand(
    "git",
    ["commit", "-m", "chore(jkdd-office): safety checkpoint"],
    { cwd: projectPath }
  );

  return commit.status === 0 || /nothing to commit/i.test(commit.stdout + commit.stderr);
}

async function chooseTask(projectName: string, projectPath: string): Promise<string> {
  const status = runCommand("git", ["status", "-sb"], { cwd: projectPath });
  const log = runCommand("git", ["log", "-5", "--oneline"], { cwd: projectPath });
  const readmePath = path.join(projectPath, "README.md");
  const readme = fs.existsSync(readmePath)
    ? fs.readFileSync(readmePath, "utf-8").split(/\r?\n/).slice(0, 220).join("\n")
    : "";

  const system = [
    "You are the planning layer for JKDD Continuous Office.",
    "Choose exactly ONE small, high-value, low-risk development task.",
    "Prefer unfinished MVP/roadmap work already documented.",
    "Do not propose deployment, secrets, billing, destructive changes, or broad refactors.",
    "Return only the task instruction in one short paragraph.",
  ].join(" ");

  const user = [
    `Project: ${projectName}`,
    `Git status:\n${status.stdout ?? ""}`,
    `Recent commits:\n${log.stdout ?? ""}`,
    `README excerpt:\n${readme}`,
  ].join("\n\n");

  try {
    const planned = (await runOmniRoute(system, user)).trim();
    if (planned) return planned;
  } catch {
    // Fall back to a conservative local objective.
  }

  return "Continue the documented MVP by choosing and implementing one small unfinished roadmap item. Keep scope narrow, preserve existing behavior, validate locally, and do not publish or deploy.";
}

function commitIteration(projectPath: string, cycle: number): boolean {
  const dirty = gitStatus(projectPath);
  if (!dirty) return true;

  const check = runCommand("git", ["diff", "--check"], { cwd: projectPath });
  if (check.status !== 0) return false;

  runCommand("git", ["add", "-A"], { cwd: projectPath });

  const commit = runCommand(
    "git",
    ["commit", "-m", `feat(jkdd-office): autonomous iteration ${cycle}`],
    { cwd: projectPath }
  );

  return commit.status === 0 || /nothing to commit/i.test(commit.stdout + commit.stderr);
}

async function main() {
  const projectArg = process.argv[2];
  const projects = listProjects();
  const project =
    projects.find(
      (item) =>
        item.key.toLowerCase() === projectArg?.toLowerCase() ||
        item.name.toLowerCase() === projectArg?.toLowerCase()
    ) ?? projects[0];

  const state = readOfficeState();
  if (!state || !project) process.exit(1);

  state.project = project.key;
  writeState(state);

  const branch = ensureBranch(project.path);
  if (!branch || branch === "main" || branch === "master") {
    state.status = "error";
    state.lastError = `Office refuses to run on protected branch: ${branch || "unknown"}`;
    writeState(state);
    process.exit(2);
  }

  if (!safetyCheckpoint(project.path)) {
    state.status = "error";
    state.lastError = "Could not create a safe checkpoint for existing changes.";
    writeState(state);
    process.exit(3);
  }

  while (state.cycle < state.maxCycles) {
    state.cycle += 1;
    writeState(state);

    const task = await chooseTask(project.name, project.path);
    state.lastTask = task;
    writeState(state);

    const result = executeWithCodex(project, task, {
      effort: "low",
      includeReadme: false,
    });

    if (!result.ok) {
      state.status = "error";
      state.lastError = result.stderr || `Codex exit code ${result.exitCode}`;
      writeState(state);
      process.exit(4);
    }

    if (!commitIteration(project.path, state.cycle)) {
      state.status = "error";
      state.lastError = "Validation or commit failed after autonomous iteration.";
      writeState(state);
      process.exit(5);
    }

    if (state.cycle >= state.maxCycles) break;

    await new Promise((resolve) =>
      setTimeout(resolve, state.intervalSeconds * 1000)
    );
  }

  state.status = "completed";
  writeState(state);
}

main().catch((error) => {
  const state = readOfficeState();
  if (state) {
    state.status = "error";
    state.lastError = error instanceof Error ? error.message : String(error);
    writeState(state);
  }
  process.exit(10);
});
