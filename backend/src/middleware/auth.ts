import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import FirestoreService, { User } from '../lib/firebase';
import { COLLECTIONS } from '../config/firebase';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    userId: string;  // Alias for id for backward compatibility
    email: string;
    organizationId?: string | null;
    firebaseUid: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify Firebase ID token
    try {
      const decodedToken = await auth.verifyIdToken(token);
      
      // Get user from Firestore
      const user = await FirestoreService.findOne<User>(
        COLLECTIONS.USERS,
        [{ field: 'firebaseUid', operator: '==', value: decodedToken.uid }]
      );

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        firebaseUid: user.firebaseUid,
      };

      next();
    } catch (firebaseError) {
      logger.error('Firebase token verification failed:', firebaseError);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
