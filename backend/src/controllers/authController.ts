import { Request, Response } from 'express';
import { auth } from '../config/firebase';
import FirestoreService, { User, Organization } from '../lib/firebase';
import { COLLECTIONS } from '../config/firebase';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { registerSchema, loginSchema } from '../utils/validation';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Create Firebase Auth user
    const firebaseUser = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Create organization for new user
    const organizationName = name
      ? `${name}'s Organization`
      : `${email.split('@')[0]}'s Organization`;
    
    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 7);

    const organization = await FirestoreService.create<Organization>(
      COLLECTIONS.ORGANIZATIONS,
      {
        name: organizationName,
        slug,
      }
    );

    // Create user in Firestore
    const user = await FirestoreService.create<User>(
      COLLECTIONS.USERS,
      {
        email,
        name,
        organizationId: organization.id,
        firebaseUid: firebaseUser.uid,
        role: 'user',
      }
    );

    // Generate custom token for immediate login
    const customToken = await auth.createCustomToken(firebaseUser.uid);

    logger.info(`User registered: ${email} with organization: ${organization.id}`);

    res.status(201).json({
      message: 'User created successfully',
      token: customToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        organization: {
          id: organization.id,
          name: organization.name,
        },
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'User already exists' });
    }
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Note: Firebase Admin SDK doesn't support password verification
    // For password-based login, you should use Firebase Client SDK on the frontend
    // This endpoint is mainly for custom token generation after verification
    
    // Find user by email in Firestore
    const user = await FirestoreService.findOne<User>(
      COLLECTIONS.USERS,
      [{ field: 'email', operator: '==', value: email }]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get organization
    const organization = user.organizationId 
      ? await FirestoreService.getById<Organization>(COLLECTIONS.ORGANIZATIONS, user.organizationId)
      : null;

    // Generate custom token
    const customToken = await auth.createCustomToken(user.firebaseUid);

    logger.info(`User logged in: ${email}`);

    res.json({
      token: customToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        organization,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    // With Firebase, you revoke refresh tokens
    if (req.user?.firebaseUid) {
      await auth.revokeRefreshTokens(req.user.firebaseUid);
    }

    logger.info(`User logged out: ${req.user?.email}`);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

export const getSession = async (req: AuthRequest, res: Response) => {
  try {
    const user = await FirestoreService.getById<User>(
      COLLECTIONS.USERS,
      req.user!.id
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const organization = user.organizationId
      ? await FirestoreService.getById<Organization>(COLLECTIONS.ORGANIZATIONS, user.organizationId)
      : null;

    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        organizationId: user.organizationId,
        organization,
      }
    });
  } catch (error) {
    logger.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
};
