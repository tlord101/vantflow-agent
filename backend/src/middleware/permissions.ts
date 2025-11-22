import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Check if user has access to a project with specific role
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
  requiredRole?: 'owner' | 'admin' | 'collaborator' | 'viewer'
): Promise<boolean> {
  // Check if user is project owner
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
  });

  if (project) {
    return true; // Owner has all permissions
  }

  // Check if user is a collaborator
  const collaboration = await prisma.projectCollaborator.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  if (!collaboration) {
    return false;
  }

  // Check role hierarchy
  if (!requiredRole) {
    return true; // Any role is acceptable
  }

  const roleHierarchy: { [key: string]: number } = {
    owner: 4,
    admin: 3,
    collaborator: 2,
    viewer: 1,
  };

  return roleHierarchy[collaboration.role] >= roleHierarchy[requiredRole];
}

/**
 * Middleware to require project access
 */
export function requireProjectAccess(
  requiredRole?: 'owner' | 'admin' | 'collaborator' | 'viewer'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const projectId = req.params.projectId || req.params.id || req.body.projectId;
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const hasAccess = await checkProjectAccess(
        req.user.id,
        projectId,
        requiredRole
      );

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredRole || 'any',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user can modify a plan
 */
export async function canModifyPlan(userId: string, planId: string): Promise<boolean> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { project: true },
  });

  if (!plan) {
    return false;
  }

  // Check if user is plan creator or project owner
  if (plan.createdBy === userId || plan.project.userId === userId) {
    return true;
  }

  // Check if user is admin or collaborator
  return checkProjectAccess(userId, plan.projectId, 'collaborator');
}

/**
 * Check if user can run a plan
 */
export async function canRunPlan(userId: string, planId: string): Promise<boolean> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { projectId: true, status: true },
  });

  if (!plan) {
    return false;
  }

  // Plan must be approved
  if (plan.status !== 'approved') {
    return false;
  }

  // Check if user has collaborator access or higher
  return checkProjectAccess(userId, plan.projectId, 'collaborator');
}

/**
 * Middleware to require plan modification permission
 */
export function requirePlanModify() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const planId = req.params.planId || req.params.id;
      if (!planId) {
        return res.status(400).json({ error: 'Plan ID is required' });
      }

      const canModify = await canModifyPlan(req.user.id, planId);
      if (!canModify) {
        return res.status(403).json({ error: 'Insufficient permissions to modify plan' });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
