import { Response } from 'express';
import { auth } from '../config/firebase';
import FirestoreService, { User, Organization, Project, ApiKey } from '../lib/firebase';
import { COLLECTIONS } from '../config/firebase';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { SecurityUtils } from '../utils/security';
import { updateUserSchema } from '../utils/validation';

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await FirestoreService.getById<User>(
      COLLECTIONS.USERS,
      req.user!.id
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get organization
    const organization = user.organizationId
      ? await FirestoreService.getById<Organization>(COLLECTIONS.ORGANIZATIONS, user.organizationId)
      : null;

    // Get recent projects
    const projects = await FirestoreService.find<Project>(
      COLLECTIONS.PROJECTS,
      [{ field: 'userId', operator: '==', value: user.id }],
      { field: 'createdAt', direction: 'desc' },
      10
    );

    // Get API keys
    const apiKeys = await FirestoreService.find<ApiKey>(
      COLLECTIONS.API_KEYS,
      [{ field: 'userId', operator: '==', value: user.id }],
      { field: 'createdAt', direction: 'desc' }
    );

    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organizationId: user.organizationId,
        organization,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt,
        })),
        apiKeys: apiKeys.map(k => ({
          id: k.id,
          key: k.key,
          createdAt: k.createdAt,
        })),
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateUserSchema.parse(req.body);

    const updateData: Partial<User> = {};

    if (data.name) {
      updateData.name = data.name;
    }

    // Update Firestore user
    await FirestoreService.update<User>(
      COLLECTIONS.USERS,
      req.user!.id,
      updateData
    );

    // Update Firebase Auth user if name changed
    if (data.name) {
      await auth.updateUser(req.user!.firebaseUid, {
        displayName: data.name,
      });
    }

    // Update password if provided
    if (data.password) {
      await auth.updateUser(req.user!.firebaseUid, {
        password: data.password,
      });
    }

    const user = await FirestoreService.getById<User>(
      COLLECTIONS.USERS,
      req.user!.id
    );

    const organization = user?.organizationId
      ? await FirestoreService.getById<Organization>(COLLECTIONS.ORGANIZATIONS, user.organizationId)
      : null;

    logger.info(`User updated: ${req.user!.email}`);

    res.json({ 
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        updatedAt: user?.updatedAt,
        organizationId: user?.organizationId,
        organization,
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const createApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const apiKey = SecurityUtils.generateApiKey();

    const newApiKey = await FirestoreService.create<ApiKey>(
      COLLECTIONS.API_KEYS,
      {
        key: apiKey,
        userId: req.user!.id,
        name: name || 'API Key',
        lastUsedAt: null,
      }
    );

    logger.info(`API key created for user: ${req.user!.email}`);

    res.status(201).json({
      apiKey: {
        id: newApiKey.id,
        key: newApiKey.key,
        name: newApiKey.name,
        createdAt: newApiKey.createdAt,
      },
      message: 'API key created. Please save it securely - it won\'t be shown again.',
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
};

export const getApiKeys = async (req: AuthRequest, res: Response) => {
  try {
    const apiKeys = await FirestoreService.find<ApiKey>(
      COLLECTIONS.API_KEYS,
      [{ field: 'userId', operator: '==', value: req.user!.id }],
      { field: 'createdAt', direction: 'desc' }
    );

    res.json({ 
      apiKeys: apiKeys.map(k => ({
        id: k.id,
        key: k.key,
        name: k.name,
        createdAt: k.createdAt,
      }))
    });
  } catch (error) {
    logger.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
};

export const deleteApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const apiKey = await FirestoreService.getById<ApiKey>(
      COLLECTIONS.API_KEYS,
      id
    );

    if (!apiKey || apiKey.userId !== req.user!.id) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await FirestoreService.delete(COLLECTIONS.API_KEYS, id);

    logger.info(`API key deleted: ${id}`);

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
};
