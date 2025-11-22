import { Response } from 'express';
import { z } from 'zod';
import FirestoreService, { Project } from '../lib/firebase';
import { COLLECTIONS } from '../config/firebase';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  settings: z.any().optional(),
});

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);

    const project = await FirestoreService.create<Project>(
      COLLECTIONS.PROJECTS,
      {
        ...data,
        userId: req.user!.id,
        organizationId: req.user!.organizationId || null,
        description: data.description || null,
        settings: {},
      }
    );

    logger.info(`Project created: ${project.id} by ${req.user!.email}`);

    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const listProjects = async (req: AuthRequest, res: Response) => {
  try {
    const projects = await FirestoreService.find<Project>(
      COLLECTIONS.PROJECTS,
      [{ field: 'userId', operator: '==', value: req.user!.id }],
      { field: 'createdAt', direction: 'desc' }
    );

    res.json({ projects });
  } catch (error) {
    logger.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
};

export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await FirestoreService.getById<Project>(
      COLLECTIONS.PROJECTS,
      id
    );

    if (!project || project.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateProjectSchema.parse(req.body);

    const project = await FirestoreService.getById<Project>(
      COLLECTIONS.PROJECTS,
      id
    );

    if (!project || project.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await FirestoreService.update<Project>(
      COLLECTIONS.PROJECTS,
      id,
      data
    );

    const updatedProject = await FirestoreService.getById<Project>(
      COLLECTIONS.PROJECTS,
      id
    );

    logger.info(`Project updated: ${id}`);

    res.json({ project: updatedProject });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await FirestoreService.getById<Project>(
      COLLECTIONS.PROJECTS,
      id
    );

    if (!project || project.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await FirestoreService.delete(COLLECTIONS.PROJECTS, id);

    logger.info(`Project deleted: ${id}`);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
