export interface AuthorizationContext {
  playerId?: string;
  role?: string;
  permissions?: string[];
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

export function authorizeAction(
  state: any,
  action: any,
  context: AuthorizationContext
): AuthorizationResult {
  return { allowed: true };
}