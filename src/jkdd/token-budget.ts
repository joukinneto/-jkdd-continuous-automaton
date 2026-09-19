export interface TokenBudget {
  maxFiles: number;
  maxLinesPerFile: number;
  includeFullHistory: boolean;
  resendUnchangedFiles: boolean;
}

export const defaultTokenBudget: TokenBudget = {
  maxFiles: 8,
  maxLinesPerFile: 500,
  includeFullHistory: false,
  resendUnchangedFiles: false,
};

export function shouldExpandContext(
  failedAttempts: number
): boolean {
  return failedAttempts > 0;
}