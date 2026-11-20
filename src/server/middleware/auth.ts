import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { getOrCreateUser } from '../../db/users.ts';
import type { users } from '../../db/schema.ts';

export type DbUser = typeof users.$inferSelect;

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: DbUser;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;

    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@applysmart.local`,
      typeof decoded.name === 'string' ? decoded.name : undefined,
      typeof decoded.picture === 'string' ? decoded.picture : undefined
    );

    if (!dbUser.isActive) {
      return res.status(403).json({ error: 'Your account has been disabled by an administrator.' });
    }

    req.dbUser = dbUser;
    return next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@applysmart.local`,
      typeof decoded.name === 'string' ? decoded.name : undefined,
      typeof decoded.picture === 'string' ? decoded.picture : undefined
    );
    if (dbUser.isActive) {
      req.dbUser = dbUser;
    }
  } catch {
    // Ignore invalid optional token
  }
  return next();
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }
    return next();
  };
};
