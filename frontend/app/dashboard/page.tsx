'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      loadDashboardData();
    }
  }, [user, loading]);

  const loadDashboardData = async () => {
    try {
      setLoadingData(true);
      const projectsRes = await api.get('/projects', { params: { limit: 5 } });
      setRecentProjects(projectsRes.data.projects || []);

      // Calculate basic stats
      setStats({
        totalProjects: projectsRes.data.total || 0,
        activeRuns: 0,
        completedRuns: 0,
        failedRuns: 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>

      {/* Header */}
      <header className="glass-dark border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="animate-slide-up">
              <h1 className="text-3xl font-bold text-gradient">Dashboard</h1>
              <p className="text-sm text-gray-400 mt-1">
                Welcome back, {user.name || user.email}
              </p>
            </div>
            <div className="flex items-center space-x-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <Link
                href="/profile"
                className="btn-glass text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </Link>
              <Link
                href="/projects/new"
                className="btn-primary"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Stats Grid */}
        {loadingData ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card-glass animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-white/10 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="card-glass group hover:scale-105 transition-transform duration-300 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-400">Total Projects</div>
                  <div className="text-3xl font-bold text-white mt-2">
                    {stats?.totalProjects || 0}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl glass-strong flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="card-glass group hover:scale-105 transition-transform duration-300 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-400">Active Runs</div>
                  <div className="text-3xl font-bold text-blue-400 mt-2">
                    {stats?.activeRuns || 0}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl glass-strong flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="card-glass group hover:scale-105 transition-transform duration-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-400">Completed</div>
                  <div className="text-3xl font-bold text-green-400 mt-2">
                    {stats?.completedRuns || 0}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl glass-strong flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="card-glass group hover:scale-105 transition-transform duration-300 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-400">Failed</div>
                  <div className="text-3xl font-bold text-red-400 mt-2">
                    {stats?.failedRuns || 0}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl glass-strong flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Projects */}
        <div className="card-glass animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Recent Projects</h3>
            <Link href="/projects" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </Link>
          </div>
          
          {recentProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-strong mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-6">No projects yet</p>
              <Link href="/projects/new" className="btn-primary inline-flex">
                Create Your First Project
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((project, idx) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block glass hover:glass-strong transition-all duration-300 rounded-xl p-4 group animate-fade-in"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg glass-strong flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-blue-400 transition-colors">
                            {project.name}
                          </p>
                          {project.description && (
                            <p className="text-sm text-gray-400 mt-1 line-clamp-1">{project.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(project.createdAt))} ago
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
        {/* Stats Grid */}
        {loadingData ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
                <div className="p-5">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
              <div className="text-sm font-medium text-gray-500">Total Projects</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {stats?.totalProjects || 0}
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
              <div className="text-sm font-medium text-gray-500">Active Runs</div>
              <div className="text-2xl font-semibold text-blue-600 mt-1">
                {stats?.activeRuns || 0}
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
              <div className="text-sm font-medium text-gray-500">Completed</div>
              <div className="text-2xl font-semibold text-green-600 mt-1">
                {stats?.completedRuns || 0}
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg p-5">
              <div className="text-sm font-medium text-gray-500">Failed</div>
              <div className="text-2xl font-semibold text-red-600 mt-1">
                {stats?.failedRuns || 0}
              </div>
            </div>
          </div>
        )}

        {/* Recent Projects */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Projects</h3>
          </div>
          <ul className="divide-y divide-gray-200">
            {recentProjects.length === 0 ? (
              <li className="px-6 py-8 text-center text-gray-500">
                <p className="mb-4">No projects yet</p>
                <Link
                  href="/projects/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Your First Project
                </Link>
              </li>
            ) : (
              recentProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="block hover:bg-gray-50 px-6 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{project.name}</p>
                        {project.description && (
                          <p className="text-sm text-gray-500">{project.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Created {formatDistanceToNow(new Date(project.createdAt))} ago
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
