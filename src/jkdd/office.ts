import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export interface OfficeState {
  pid: number;
  status: "running" | "stopped" | "error" | "completed";
  startedAt: string;
  updatedAt: string;
  project?: string;
  cycle: number;
  maxCycles: number;
  intervalSeconds: number;
  lastTask?: string;
  lastError?: string;
}

const root = path.join(os.homedir(), ".jkdd-continuous");
const stateFile = path.join(root, "office-state.json");
const logFile = path.join(root, "office.log");

function ensureRoot() {
  fs.mkdirSync(root, { recursive: true });
}

export function readOfficeState(): OfficeState | null {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf-8")) as OfficeState;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function startOffice(project?: string): { ok: boolean; message: string } {
  ensureRoot();

  const current = readOfficeState();
  if (current?.status === "running" && isProcessAlive(current.pid)) {
    return {
      ok: false,
      message: `Office already running (PID ${current.pid}).`,
    };
  }

  const workerPath = path.join(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")),
    "office-worker.js"
  );

  const out = fs.openSync(logFile, "a");
  const child = spawn(process.execPath, [workerPath, ...(project ? [project] : [])], {
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });

  child.unref();

  const now = new Date().toISOString();
  const state: OfficeState = {
    pid: child.pid ?? -1,
    status: "running",
    startedAt: now,
    updatedAt: now,
    project,
    cycle: 0,
    maxCycles: 6,
    intervalSeconds: 300,
  };

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  return {
    ok: true,
    message: `Office started in AUTO mode (PID ${state.pid}). Logs: ${logFile}`,
  };
}

export function stopOffice(): { ok: boolean; message: string } {
  const state = readOfficeState();
  if (!state) {
    return { ok: false, message: "Office state not found." };
  }

  if (state.status !== "running" || !isProcessAlive(state.pid)) {
    state.status = "stopped";
    state.updatedAt = new Date().toISOString();
    ensureRoot();
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    return { ok: true, message: "Office is not running." };
  }

  try {
    process.kill(state.pid);
    state.status = "stopped";
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    return { ok: true, message: `Office stopped (PID ${state.pid}).` };
  } catch (error) {
    return {
      ok: false,
      message: `Failed to stop Office: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function printOfficeStatus(): { ok: boolean; message: string } {
  const state = readOfficeState();

  console.log("");
  console.log("========================================");
  console.log(" JKDD CONTINUOUS — OFFICE");
  console.log("========================================");

  if (!state) {
    console.log("Status: NOT STARTED");
    return { ok: true, message: "Office has not been started yet." };
  }

  const alive = state.status === "running" && isProcessAlive(state.pid);

  console.log(`Status:      ${alive ? "RUNNING" : state.status.toUpperCase()}`);
  console.log(`PID:         ${state.pid}`);
  console.log(`Project:     ${state.project ?? "AUTO"}`);
  console.log(`Cycle:       ${state.cycle}/${state.maxCycles}`);
  console.log(`Interval:    ${state.intervalSeconds}s`);
  console.log(`Started:     ${state.startedAt}`);
  console.log(`Last update: ${state.updatedAt}`);
  if (state.lastTask) console.log(`Last task:   ${state.lastTask}`);
  if (state.lastError) console.log(`Last error:  ${state.lastError}`);
  console.log(`Log:         ${logFile}`);

  return {
    ok: true,
    message: alive ? "Office is running." : `Office state: ${state.status}.`,
  };
}

export function getOfficePaths() {
  ensureRoot();
  return { root, stateFile, logFile };
}
