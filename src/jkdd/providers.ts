export interface ProviderStatus {
  name: string;
  enabled: boolean;
  priority: number;
}

export const providers: ProviderStatus[] = [
  {
    name: "local",
    enabled: true,
    priority: 0,
  },
  {
    name: "openai",
    enabled: true,
    priority: 1,
  },
  {
    name: "gemini",
    enabled: true,
    priority: 2,
  },
  {
    name: "claude",
    enabled: true,
    priority: 3,
  },
];

export function getFallbackProviders(current: string): ProviderStatus[] {
  return providers
    .filter((p) => p.enabled && p.name !== current)
    .sort((a, b) => a.priority - b.priority);
}