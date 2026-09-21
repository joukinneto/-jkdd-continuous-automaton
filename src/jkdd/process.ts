import { spawnSync, type SpawnSyncReturns } from "node:child_process";

function quoteWindowsArg(value: string): string {
  if (!/[\s"&|<>^]/.test(value)) return value;
  return '"' + value.replace(/(["\\])/g, "\\$1") + '"';
}

export function runCommand(
  command: string,
  args: string[] = [],
  options: {
    cwd?: string;
    input?: string;
    maxBuffer?: number;
  } = {}
): SpawnSyncReturns<string> {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    const line = [command, ...args].map(quoteWindowsArg).join(" ");

    return spawnSync(comspec, ["/d", "/s", "/c", line], {
      cwd: options.cwd,
      encoding: "utf-8",
      input: options.input,
      stdio: "pipe",
      maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    }) as SpawnSyncReturns<string>;
  }

  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf-8",
    input: options.input,
    stdio: "pipe",
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
  }) as SpawnSyncReturns<string>;
}
