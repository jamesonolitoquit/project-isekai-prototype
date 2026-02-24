/**
 * betaKeys.ts - Beta access key management
 * 
 * Handles beta key generation, validation, and revocation
 * Keys are stored in PostgreSQL with per-player metadata
 */

export interface BetaKey {
  keyId: string;
  key: string;
  playerId?: string;
  email?: string;
  createdAt: number;
  expiresAt: number;
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: number;
  metadata?: Record<string, any>;
}

export interface BetaKeyValidationResult {
  isValid: boolean;
  playerId?: string;
  email?: string;
  reason?: string;
}

/**
 * Generate a random beta key
 * Format: BETA-XXXXXXXX-XXXX-XXXX (16 uppercase alphanumeric)
 */
export function generateBetaKey(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'BETA-';

  // Generate key in 4-4-4 format
  const segments = [8, 4, 4];
  for (const segmentLen of segments) {
    for (let i = 0; i < segmentLen; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (segments.indexOf(segmentLen) < segments.length - 1) {
      key += '-';
    }
  }

  return key;
}

/**
 * Create a beta key in memory (would be persisted to DB in production)
 */
export function createBetaKey(
  playerId?: string,
  email?: string,
  expiryDays: number = 30,
  metadata?: Record<string, any>
): BetaKey {
  return {
    keyId: `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    key: generateBetaKey(),
    playerId,
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
    isActive: true,
    usageCount: 0,
    metadata,
  };
}

/**
 * Validate a beta key (check expiry, active status, etc)
 * In production, this would query PostgreSQL
 */
export function validateBetaKey(
  key: string,
  betaKeys: Map<string, BetaKey>
): BetaKeyValidationResult {
  // Find key in map
  let foundKey: BetaKey | undefined;
  for (const betaKey of Array.from(betaKeys.values())) {
    if (betaKey.key === key) {
      foundKey = betaKey;
      break;
    }
  }

  if (!foundKey) {
    return {
      isValid: false,
      reason: 'Beta key not found',
    };
  }

  // Check if active
  if (!foundKey.isActive) {
    return {
      isValid: false,
      reason: 'Beta key has been revoked',
    };
  }

  // Check if expired
  if (Date.now() > foundKey.expiresAt) {
    return {
      isValid: false,
      reason: 'Beta key has expired',
    };
  }

  return {
    isValid: true,
    playerId: foundKey.playerId,
    email: foundKey.email,
  };
}

/**
 * Mark a key as used (increment usage counter, update last used time)
 */
export function markKeyAsUsed(betaKey: BetaKey): void {
  betaKey.usageCount++;
  betaKey.lastUsedAt = Date.now();
}

/**
 * Revoke a beta key (deactivate it)
 */
export function revokeBetaKey(betaKey: BetaKey): void {
  betaKey.isActive = false;
}

/**
 * Batch generate beta keys for initial cohort
 */
export function generateBetaKeyBatch(count: number, expiryDays: number = 30): BetaKey[] {
  const keys: BetaKey[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(createBetaKey(undefined, undefined, expiryDays, { batchGenerated: true }));
  }
  return keys;
}

/**
 * Check if player can join based on beta configuration
 */
export function canPlayerJoinBeta(
  betaKeyResult: BetaKeyValidationResult,
  betaConfig: { enabled: boolean; maxPlayers: number }
): boolean {
  if (!betaConfig.enabled) {
    return false;
  }

  if (!betaKeyResult.isValid) {
    return false;
  }

  return true;
}

export default { generateBetaKey, createBetaKey, validateBetaKey, markKeyAsUsed, revokeBetaKey, generateBetaKeyBatch };
