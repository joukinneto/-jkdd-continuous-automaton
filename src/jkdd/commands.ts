import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { JKDDProject, listProjects } from "./projects.js";
import { scanWorkspace } from "./workspace.js";

export interface CommandResult {
  ok: boolean;
  message: string;
}

function run(command: string, args: string[], cwd?: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    shell: false,
  });
}

function resolveProject(name?: string): JKDDProject | null {
  if (!name) return null;
  const needle = name.toLowerCase();
  return (
    listProjects().find(
      (project) =>
        project.key.toLowerCase() === needle ||
        project.name.toLowerCase() === needle ||
        project.key.toLowerCase().includes(needle)
    ) ?? null
  );
}

export function printDoctor(projectName?: string): CommandResult {
  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — DOCTOR");
  console.log("========================================");

  const nodeVersion = process.version;
  const git = run("git", ["--version"]);
  const pnpm = run("pnpm", ["--version"]);

  console.log(`Node:  ${nodeVersion}`);
  console.log(`Git:   ${git.status === 0 ? git.stdout.trim() : "NOT FOUND"}`);
  console.log(`pnpm:  ${pnpm.status === 0 ? pnpm.stdout.trim() : "NOT FOUND"}`);

  const projects = projectName
    ? [resolveProject(projectName)].filter(Boolean) as JKDDProject[]
    : listProjects();

  if (projectName && projects.length === 0) {
    return { ok: false, message: `Project not found: ${projectName}` };
  }

  let ok = git.status === 0 && pnpm.status === 0;

  for (const project of projects) {
    const exists = fs.existsSync(project.path);
    const agents = fs.existsSync(path.join(project.path, "AGENTS.md"));
    const config = fs.existsSync(path.join(project.path, ".jkdd", "continuous.yml"));
    const isGit = fs.existsSync(path.join(project.path, ".git"));

    console.log("");
    console.log(`Project: ${project.name}`);
    console.log(`  Path:        ${project.path}`);
    console.log(`  Exists:      ${exists ? "YES" : "NO"}`);
    console.log(`  Git repo:    ${isGit ? "YES" : "NO"}`);
    console.log(`  AGENTS.md:   ${agents ? "YES" : "NO"}`);
    console.log(`  JKDD config: ${config ? "YES" : "NO"}`);

    ok = ok && exists && isGit && agents && config;
  }

  console.log("");
  console.log(`Doctor status: ${ok ? "OK" : "ATTENTION REQUIRED"}`);
  return { ok, message: ok ? "Environment ready." : "One or more checks need attention." };
}

export function syncProjects(projectName?: string): CommandResult {
  const projects = projectName
    ? [resolveProject(projectName)].filter(Boolean) as JKDDProject[]
    : listProjects();

  if (projectName && projects.length === 0) {
    return { ok: false, message: `Project not found: ${projectName}` };
  }

  let ok = true;

  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — SAFE SYNC");
  console.log("========================================");
  console.log("Mode: fetch/prune only; no automatic merge or pull.");

  for (const project of projects) {
    console.log("");
    console.log(`Project: ${project.name}`);

    if (!fs.existsSync(path.join(project.path, ".git"))) {
      console.log("  Not a Git repository.");
      ok = false;
      continue;
    }

    const fetch = run("git", ["fetch", "--all", "--prune"], project.path);
    if (fetch.status !== 0) {
      console.log(`  Fetch failed: ${fetch.stderr.trim()}`);
      ok = false;
      continue;
    }

    const status = run("git", ["status", "-sb"], project.path);
    console.log(status.stdout.trim());
  }

  return { ok, message: ok ? "Safe sync complete." : "Sync completed with errors." };
}

function gitHtmlHistory(projectPath: string): string[] {
  const result = run(
    "git",
    ["log", "--all", "--name-only", "--pretty=format:", "--", "*.html"],
    projectPath
  );

  if (result.status !== 0) return [];

  return Array.from(
    new Set(
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.toLowerCase().endsWith(".html"))
    )
  );
}

export function recoverProject(projectName: string): CommandResult {
  const project = resolveProject(projectName);
  if (!project) {
    return { ok: false, message: `Project not found: ${projectName}` };
  }

  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — RECOVER");
  console.log("========================================");
  console.log(`Project: ${project.name}`);
  console.log(`Path:    ${project.path}`);

  if (!fs.existsSync(project.path)) {
    return { ok: false, message: "Project directory does not exist." };
  }

  const workspace = scanWorkspace(project.path, 200);
  const htmlFiles = workspace.files.filter((file) =>
    file.toLowerCase().endsWith(".html")
  );

  if (htmlFiles.length > 0) {
    console.log("");
    console.log("HTML files already present:");
    for (const file of htmlFiles) console.log(`  - ${file}`);
    return { ok: true, message: "Source files are present; recovery is not required." };
  }

  console.log("");
  console.log("No HTML source files are present in the working tree.");
  console.log("Checking all local Git history/branches...");

  const historyFiles = gitHtmlHistory(project.path);

  if (historyFiles.length > 0) {
    console.log("HTML paths found in Git history:");
    for (const file of historyFiles) console.log(`  - ${file}`);
    console.log("");
    console.log("Recovery candidate found. No file was restored automatically.");
    return { ok: true, message: "Recovery candidates exist in Git history." };
  }

  console.log("No HTML files were found anywhere in the repository Git history.");
  console.log("The game source must be recovered from an external deployment/backup or rebuilt.");
  return {
    ok: false,
    message: "No recoverable HTML source exists in the local Git repository.",
  };
}

export function printStatus(projectName?: string): CommandResult {
  const projects = projectName
    ? [resolveProject(projectName)].filter(Boolean) as JKDDProject[]
    : listProjects();

  if (projectName && projects.length === 0) {
    return { ok: false, message: `Project not found: ${projectName}` };
  }

  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — STATUS");
  console.log("========================================");

  for (const project of projects) {
    console.log("");
    console.log(`${project.name} — ${project.path}`);

    if (!fs.existsSync(path.join(project.path, ".git"))) {
      console.log("Not a Git repository.");
      continue;
    }

    const branch = run("git", ["branch", "--show-current"], project.path);
    const status = run("git", ["status", "--porcelain"], project.path);
    const workspace = scanWorkspace(project.path, 200);

    console.log(`Branch: ${branch.stdout.trim() || "unknown"}`);
    console.log(`Working tree: ${status.stdout.trim() ? "CHANGED" : "CLEAN"}`);
    console.log(`Files visible: ${workspace.files.length}`);
  }

  return { ok: true, message: "Status complete." };
}
