import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { JKDDProject } from "./projects.js";
import { scanWorkspace } from "./workspace.js";

export interface ExecutionResult {
  ok: boolean;
  provider: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function run(
  command: string,
  args: string[],
  cwd: string,
  input?: string
) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    shell: process.platform === "win32",
    stdio: "pipe",
    input,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function readText(filePath: string, maxLines = 500): string {
  try {
    return fs
      .readFileSync(filePath, "utf-8")
      .split(/\r?\n/)
      .slice(0, maxLines)
      .join("\n");
  } catch {
    return "";
  }
}

function buildContext(
  project: JKDDProject,
  task: string,
  includeReadme = false
): string {
  const workspace = scanWorkspace(project.path, 50);
  const preferred = [
    "AGENTS.md",
    ".jkdd/continuous.yml",
    ".jkdd/repository-map.md",
    ...(includeReadme ? ["README.md"] : []),
  ];

  const contextParts: string[] = [];

  for (const rel of preferred) {
    if (!workspace.files.includes(rel.replaceAll("/", path.sep)) && !workspace.files.includes(rel)) {
      continue;
    }
    const full = path.join(project.path, rel);
    const text = readText(full, 500);
    if (text) {
      contextParts.push(`--- ${rel} ---\n${text}`);
    }
  }

  return [
    "You are an implementation agent working under JKDD Continuous.",
    "Work only inside the current project workspace.",
    "Read and obey AGENTS.md before editing.",
    "Use minimal context and inspect only files necessary for the task.",
    "Do not modify .git internals.",
    "Do not commit, push, merge, or publish.",
    "Do not change secrets, credentials, billing, or external infrastructure.",
    "After changes, run only safe local validation that is already available.",
    "Finish with a concise summary of changed files and validation.",
    "",
    `PROJECT: ${project.name}`,
    `TASK: ${task}`,
    "",
    "KNOWN PROJECT CONTEXT:",
    contextParts.join("\n\n"),
  ].join("\n");
}

export function executeWithCodex(
  project: JKDDProject,
  task: string,
  options: {
    effort?: "minimal" | "low" | "medium" | "high";
    includeReadme?: boolean;
  } = {}
): ExecutionResult {
  const effort = options.effort ?? "low";
  const prompt = buildContext(project, task, options.includeReadme ?? false);
  const result = run(
    "codex",
    [
      "exec",
      "--sandbox",
      "workspace-write",
      "--config",
      `model_reasoning_effort="${effort}"`,
      "-",
    ],
    project.path,
    prompt
  );

  return {
    ok: result.status === 0,
    provider: "codex",
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function reviewWithGemini(project: JKDDProject, task: string): ExecutionResult {
  const prompt = [
    "Review this project/task in read-only planning mode.",
    "Do not modify files.",
    "Identify risks, likely files, and a concise implementation plan.",
    `Task: ${task}`,
  ].join("\n");

  const result = run(
    "gemini",
    ["--approval-mode", "plan", "-p", prompt],
    project.path
  );

  return {
    ok: result.status === 0,
    provider: "gemini",
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function reviewWithClaude(project: JKDDProject, task: string): ExecutionResult {
  const prompt = [
    "Review this task in read-only mode.",
    "Do not edit files and do not run destructive commands.",
    "Return a concise implementation plan and risks only.",
    `Task: ${task}`,
  ].join("\n");

  const result = run(
    "claude",
    ["-p", "--permission-mode", "plan", "--max-turns", "3", prompt],
    project.path
  );

  return {
    ok: result.status === 0,
    provider: "claude",
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function printExecutionResult(result: ExecutionResult) {
  console.log("");
  console.log(`Provider: ${result.provider}`);
  console.log(`Exit code: ${result.exitCode ?? "unknown"}`);

  if (result.stdout.trim()) {
    console.log("");
    console.log(result.stdout.trim());
  }

  if (result.stderr.trim()) {
    console.log("");
    console.error(result.stderr.trim());
  }
}
