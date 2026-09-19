export type AgentType =
  | "search"
  | "git"
  | "qa"
  | "coding"
  | "architecture";

export type Provider =
  | "local"
  | "openai"
  | "gemini"
  | "claude";

export interface RouteDecision {
  agent: AgentType;
  provider: Provider;
  reason: string;
}

export function routeTask(task: string): RouteDecision {
  const t = task.toLowerCase();

  if (
    t.includes("git status") ||
    t.includes("git diff") ||
    t.includes("commit") ||
    t.includes("branch")
  ) {
    return {
      agent: "git",
      provider: "local",
      reason: "Git operation does not require an LLM.",
    };
  }

  if (
    t.includes("find") ||
    t.includes("search") ||
    t.includes("locate") ||
    t.includes("where is")
  ) {
    return {
      agent: "search",
      provider: "local",
      reason: "Repository search should run locally first.",
    };
  }

  if (
    t.includes("test") ||
    t.includes("lint") ||
    t.includes("build") ||
    t.includes("validate")
  ) {
    return {
      agent: "qa",
      provider: "local",
      reason: "QA operations should run locally first.",
    };
  }

  if (
    t.includes("architecture") ||
    t.includes("refactor") ||
    t.includes("redesign") ||
    t.includes("multi-module")
  ) {
    return {
      agent: "architecture",
      provider: "openai",
      reason: "Complex architectural task requires stronger reasoning.",
    };
  }

  return {
    agent: "coding",
    provider: "openai",
    reason: "Default coding route uses OpenAI before escalation.",
  };
}