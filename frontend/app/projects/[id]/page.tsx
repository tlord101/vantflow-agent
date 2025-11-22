'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useWebSocket, useWebSocketEvent } from '@/hooks/useWebSocket';
import { Tab } from '@headlessui/react';
import ChatInterface from '@/components/ChatInterface';
import PlansTab from '@/components/PlansTab';
import RunsTab from '@/components/RunsTab';
import toast from 'react-hot-toast';

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const router = useRouter();
  const { subscribeToProject, unsubscribeFromProject } = useWebSocket();

  useEffect(() => {
    loadProject();
    subscribeToProject(params.id);

    return () => {
      unsubscribeFromProject(params.id);
    };
  }, [params.id]);

  // Listen for real-time events
  useWebSocketEvent('plan:created', (data) => {
    if (data.projectId === params.id) {
      toast.success('New plan created!');
      loadProject();
    }
  });

  useWebSocketEvent('run:started', (data) => {
    if (data.projectId === params.id) {
      toast.success('Run started!');
      loadProject();
    }
  });

  const loadProject = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${params.id}`);
      setProject(response.data.project);
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-strong mb-6">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Project not found</h2>
          <p className="text-gray-400 mb-6">This project doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => router.push('/projects')}
            className="btn-primary"
          >
            Back to Projects
          </button>
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
      <div className="glass-dark border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between animate-slide-up">
            <div>
              <button
                onClick={() => router.push('/projects')}
                className="text-gray-400 hover:text-white transition-colors mb-3 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to projects
              </button>
              <h1 className="text-3xl font-bold text-gradient">{project.name}</h1>
              {project.description && (
                <p className="text-gray-400 mt-2">{project.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
          <Tab.List className="glass-dark rounded-2xl p-1.5 flex space-x-1 mb-8 animate-fade-in">
            {[
              { name: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
              { name: 'Plans', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
              { name: 'Runs', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              { name: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
            ].map((tab, idx) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  `flex-1 rounded-xl py-3 px-4 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                    selected
                      ? 'glass-strong text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:glass'
                  }`
                }
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.name}
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels>
            {/* Chat Tab */}
            <Tab.Panel className="animate-fade-in">
              <ChatInterface projectId={params.id} project={project} />
            </Tab.Panel>

            {/* Plans Tab */}
            <Tab.Panel className="animate-fade-in">
              <PlansTab projectId={params.id} project={project} onRunPlan={() => setSelectedTab(2)} />
            </Tab.Panel>

            {/* Runs Tab */}
            <Tab.Panel className="animate-fade-in">
              <RunsTab projectId={params.id} project={project} />
            </Tab.Panel>

            {/* Settings Tab */}
            <Tab.Panel className="animate-fade-in">
              <div className="card-glass">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl glass-strong flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Project Settings</h3>
                    <p className="text-sm text-gray-400">Configure your project preferences</p>
                  </div>
                </div>
                <div className="glass-dark rounded-xl p-6 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <p className="text-gray-400">Advanced settings coming soon...</p>
                </div>
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
}
