import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';

const SALT_ROUNDS = 10;

export class SecurityUtils {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload: {
    userId: string;
    email: string;
    organizationId?: string | null;
  }): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): {
    userId: string;
    email: string;
    organizationId?: string | null;
  } {
    return jwt.verify(token, config.jwt.secret) as {
      userId: string;
      email: string;
      organizationId?: string | null;
    };
  }

  /**
   * Generate API key
   */
  static generateApiKey(): string {
    return `vf_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Generate session expiration date (7 days from now)
   */
  static getSessionExpiration(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }

  /**
   * Sanitize user object for response (remove sensitive data)
   */
  static sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
