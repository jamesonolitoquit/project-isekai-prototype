/**
 * auth.ts - JWT-based authentication for M69 Moderator Console
 * 
 * Provides:
 * - JWT token generation and validation
 * - Moderator session management
 * - Fine-grained permission checking
 * - Role-based access control (RBAC)
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface ModeratorPermissions {
  view_reports: boolean;
  approve_actions: boolean;
  ban_players: boolean;
  view_analytics: boolean;
  manage_campaigns: boolean;
  manage_moderators: boolean;
}

export interface ModeratorSession {
  moderatorId: string;
  username: string;
  email: string;
  role: 'admin' | 'viewer' | 'support';
  permissions: ModeratorPermissions;
  loginTime: number;
  lastActivityTime: number;
  isActive: boolean;
}

export interface JWTPayload {
  moderatorId: string;
  username: string;
  role: 'admin' | 'viewer' | 'support';
  email: string;
  iat: number;
  exp: number;
}

// Default permissions by role
const ROLE_PERMISSIONS: Record<string, ModeratorPermissions> = {
  admin: {
    view_reports: true,
    approve_actions: true,
    ban_players: true,
    view_analytics: true,
    manage_campaigns: true,
    manage_moderators: true,
  },
  viewer: {
    view_reports: true,
    approve_actions: false,
    ban_players: false,
    view_analytics: true,
    manage_campaigns: false,
    manage_moderators: false,
  },
  support: {
    view_reports: true,
    approve_actions: true,
    ban_players: false,
    view_analytics: true,
    manage_campaigns: true,
    manage_moderators: false,
  },
};

/**
 * Generate JWT token for moderator login
 */
export function generateToken(
  moderatorId: string,
  username: string,
  email: string,
  role: 'admin' | 'viewer' | 'support',
  expiryHours: number = 24
): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-key-must-be-at-least-32-chars-long!';

  const payload: JWTPayload = {
    moderatorId,
    username,
    role,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiryHours * 3600,
  };

  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-key-must-be-at-least-32-chars-long!';
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return decoded as JWTPayload;
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
}

/**
 * Express middleware: Authenticate JWT token
 * On success: attaches payload to req.user
 * On failure: returns 401 Unauthorized
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided',
    });
  }

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }

  // Attach payload to request
  (req as any).user = payload;
  next();
}

/**
 * Express middleware: Check specific permission
 * Usage: app.post('/api/admin/ban', requirePermission('ban_players'), handler)
 */
export function requirePermission(requiredPermission: keyof ModeratorPermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = (req as any).user as JWTPayload | undefined;

    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = ROLE_PERMISSIONS[payload.role];

    if (!permissions[requiredPermission]) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission '${requiredPermission}' required`,
      });
    }

    next();
  };
}

/**
 * Express middleware: Require specific role
 * Usage: app.post('/api/moderators/create', requireRole('admin'), handler)
 */
export function requireRole(requiredRole: 'admin' | 'viewer' | 'support' | 'admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = (req as any).user as JWTPayload | undefined;

    if (!payload || payload.role !== requiredRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role '${requiredRole}' required`,
      });
    }

    next();
  };
}

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: 'admin' | 'viewer' | 'support'): ModeratorPermissions {
  return ROLE_PERMISSIONS[role];
}

/**
 * Create moderator session record
 */
export function createSession(moderatorId: string, username: string, email: string, role: 'admin' | 'viewer' | 'support'): ModeratorSession {
  return {
    moderatorId,
    username,
    email,
    role,
    permissions: ROLE_PERMISSIONS[role],
    loginTime: Date.now(),
    lastActivityTime: Date.now(),
    isActive: true,
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export default { generateToken, verifyToken, authenticateToken, requirePermission, requireRole };
