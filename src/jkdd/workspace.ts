import fs from "node:fs";
import path from "node:path";

export interface WorkspaceSummary {
  projectPath: string;
  files: string[];
}

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
]);

export function scanWorkspace(
  projectPath: string,
  maxFiles = 50
): WorkspaceSummary {
  const files: string[] = [];

  function walk(dir: string) {
    if (files.length >= maxFiles) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= maxFiles) break;

      const full = path.join(dir, entry.name);
      const relative = path.relative(projectPath, full);

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          walk(full);
        }
        continue;
      }

      files.push(relative);
    }
  }

  walk(projectPath);

  return {
    projectPath,
    files,
  };
}