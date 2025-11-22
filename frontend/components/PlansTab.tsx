'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { 
  DocumentTextIcon, 
  PlayIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon 
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface PlansTabProps {
  projectId: string;
  project: any;
}

export default function PlansTab({ projectId, project }: PlansTabProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  useEffect(() => {
    loadPlans();
  }, [projectId]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${projectId}/plans`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePlan = async (planId: string) => {
    try {
      await api.post(`/plans/${planId}/approve`);
      toast.success('Plan approved!');
      loadPlans();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve plan');
    }
  };

  const handleRunPlan = async (planId: string) => {
    try {
      const response = await api.post(`/plans/${planId}/run`);
      toast.success('Run started! Check the Runs tab for progress.');
      router.refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start run');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      await api.delete(`/plans/${planId}`);
      toast.success('Plan deleted');
      loadPlans();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete plan');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any }> = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: ClockIcon },
      approved: { color: 'bg-blue-100 text-blue-800', icon: CheckCircleIcon },
      running: { color: 'bg-yellow-100 text-yellow-800', icon: PlayIcon },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircleIcon },
    };

    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-4 w-4 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedPlan) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{selectedPlan.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{selectedPlan.description}</p>
          </div>
          <button
            onClick={() => setSelectedPlan(null)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Back to list
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4">
            {getStatusBadge(selectedPlan.status)}
          </div>

          <h4 className="font-medium text-gray-900 mb-3">Tasks ({selectedPlan.jsonPlan.tasks.length})</h4>
          <div className="space-y-3">
            {selectedPlan.jsonPlan.tasks.map((task: any, index: number) => (
              <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-800 text-xs font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <h5 className="font-medium text-gray-900">{task.name}</h5>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Type:</span> {task.type}</p>
                      {task.url && <p><span className="font-medium">URL:</span> {task.url}</p>}
                      {task.selector && <p><span className="font-medium">Selector:</span> {task.selector}</p>}
                      {task.value && <p><span className="font-medium">Value:</span> {JSON.stringify(task.value)}</p>}
                      {task.timeout && <p><span className="font-medium">Timeout:</span> {task.timeout}ms</p>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex space-x-3">
            {selectedPlan.status === 'draft' && (
              <button
                onClick={() => handleApprovePlan(selectedPlan.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Approve Plan
              </button>
            )}
            {selectedPlan.status === 'approved' && (
              <button
                onClick={() => handleRunPlan(selectedPlan.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <PlayIcon className="h-5 w-5 inline mr-2" />
                Run Plan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Plans</h3>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No plans yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Use the Chat tab to generate automation plans
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {plans.map((plan) => (
            <li key={plan.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="text-left w-full"
                  >
                    <div className="flex items-center space-x-3">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {plan.name}
                      </h4>
                      {getStatusBadge(plan.status)}
                    </div>
                    {plan.description && (
                      <p className="text-sm text-gray-500 mt-1 truncate">{plan.description}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span>{plan.jsonPlan.tasks.length} tasks</span>
                      <span>Created {formatDistanceToNow(new Date(plan.createdAt))} ago</span>
                      {plan.runs?.length > 0 && (
                        <span>{plan.runs.length} run{plan.runs.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </button>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {plan.status === 'approved' && (
                    <button
                      onClick={() => handleRunPlan(plan.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                      title="Run plan"
                    >
                      <PlayIcon className="h-5 w-5" />
                    </button>
                  )}
                  {plan.status === 'draft' && (
                    <>
                      <button
                        onClick={() => handleApprovePlan(plan.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Approve plan"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete plan"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
