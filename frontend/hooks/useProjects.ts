'use client';

import { useState, useEffect } from 'react';
import { projectsApi } from '@/lib/api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  plan?: any;
  createdAt: string;
  updatedAt: string;
  executions?: any[];
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await projectsApi.list();
      setProjects(response.data.projects);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (data: { name: string; description?: string }) => {
    const response = await projectsApi.create(data);
    await fetchProjects();
    return response.data.project;
  };

  const deleteProject = async (id: string) => {
    await projectsApi.delete(id);
    await fetchProjects();
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    deleteProject,
  };
}
