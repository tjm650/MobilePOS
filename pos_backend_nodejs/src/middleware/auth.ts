import { Request, Response, NextFunction } from 'express';
import { DatabaseService, IUser } from '../services/databaseService';
import { JwtUtils, CustomJwtPayload } from '../utils/jwt';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
    }
  }
}

export interface AuthRequest extends Request {
  user: IUser;
  token: string;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JwtUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
      return;
    }

    if (JwtUtils.isTokenExpired(token)) {
      res.status(401).json({
        success: false,
        error: 'Token has expired.'
      });
      return;
    }

    const decoded = JwtUtils.verifyToken(token);

    // Get user from database
    const user = await DatabaseService.findUserById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Token is not valid. User not found.'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: 'User account is deactivated.'
      });
      return;
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Token is not valid.'
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Access denied. Not authenticated.'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Requires one of these roles: ${roles.join(', ')}`
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JwtUtils.extractTokenFromHeader(req.headers.authorization);

    if (token && !JwtUtils.isTokenExpired(token)) {
      const decoded = JwtUtils.verifyToken(token);
      const user = await DatabaseService.findUserById(decoded.id);

      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail if token is invalid
    next();
  }
};

export const requireStoreAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
    return;
  }

  // For now, we'll assume single store per user
  // In a multi-store setup, you'd check if user has access to the requested store
  next();
};

export const checkUserActive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
    return;
  }

  // Update user's last login
  await DatabaseService.updateUserLastLogin(req.user.id);

  next();
};

// Development mode - skip authentication entirely
export const devAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // In development, create a simple mock user without database calls
  if (process.env.NODE_ENV === 'development') {
    req.user = {
      id: 'dev-user-id',
      _id: 'dev-user-id',
      username: 'dev_user',
      email: 'dev@localhost',
      password: 'hashed-password',
      firstName: 'Dev',
      lastName: 'User',
      storeId: 'DEV_STORE',
      role: 'admin',
      isActive: true,
      isActivePos: false,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      comparePassword: async () => true,
      save: async () => req.user!
    } as IUser;
    req.token = 'dev-token';
  }

  next();
};