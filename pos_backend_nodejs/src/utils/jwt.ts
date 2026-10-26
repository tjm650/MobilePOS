import jwt from 'jsonwebtoken';
import { IUser } from '../services/databaseService';

export interface CustomJwtPayload {
  id: string;
  username: string;
  email: string;
  storeId: string;
  role: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export class JwtUtils {
  private static secret: string;
  private static expiresIn: string;
  private static refreshExpiresIn: string;

  static initialize() {
    this.secret = process.env.JWT_SECRET || 'fallback-secret';
    this.expiresIn = process.env.JWT_EXPIRE || '1h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRE || '7d';
  }

  static generateAccessToken(user: IUser): string {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      storeId: user.storeId,
      role: user.role
    };

    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  static generateRefreshToken(user: IUser): string {
    const payload = {
      id: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, this.secret, { expiresIn: this.refreshExpiresIn } as jwt.SignOptions);
  }

  static verifyToken(token: string): CustomJwtPayload {
    try {
      return (jwt.verify as any)(token, this.secret) as CustomJwtPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static generateTokens(user: IUser): { accessToken: string; refreshToken: string } {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user)
    };
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const decoded = this.verifyToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return (decoded.exp || 0) < currentTime;
    } catch {
      return true;
    }
  }

  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.verifyToken(token);
      return decoded.exp ? new Date(decoded.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  static generateEmailVerificationToken(user: IUser): string {
    const payload = {
      id: user.id,
      email: user.email,
      type: 'email_verification'
    };

    // Token expires in 24 hours
    return jwt.sign(payload, this.secret, { expiresIn: '24h' } as jwt.SignOptions);
  }
}

// Initialize on module load
JwtUtils.initialize();